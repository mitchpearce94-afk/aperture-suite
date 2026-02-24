import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CONTRACT } from '@/lib/default-contract';

// Service role client — bypasses RLS for creating records on behalf of the photographer
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slot_id, name, email, phone } = body;

    if (!slot_id || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields: slot_id, name, email' }, { status: 400 });
    }

    // Check service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error. Please contact the photographer.' }, { status: 500 });
    }

    const sb = getServiceClient();

    // 1. Fetch the slot and verify it's still available
    const { data: slot, error: slotError } = await sb
      .from('booking_slots')
      .select('*, event:booking_events(*, package:packages(*))')
      .eq('id', slot_id)
      .eq('status', 'available')
      .single();

    if (slotError || !slot) {
      return NextResponse.json({ error: 'This time slot is no longer available.' }, { status: 409 });
    }

    const event = slot.event;
    if (!event) {
      return NextResponse.json({ error: 'Booking event not found.' }, { status: 404 });
    }

    const photographerId = event.photographer_id;
    const pkg = event.package;

    // 2. Find or create client
    let clientId: string | null = null;

    // Check if client with this email already exists for this photographer
    const { data: existingClient } = await sb
      .from('clients')
      .select('id')
      .eq('photographer_id', photographerId)
      .eq('email', email)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // Split name into first/last
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || name;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      const { data: newClient, error: clientError } = await sb
        .from('clients')
        .insert({
          photographer_id: photographerId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone || null,
          source: 'booking',
          tags: ['booking'],
        })
        .select('id')
        .single();

      if (clientError) {
        console.error('Error creating client:', clientError);
        return NextResponse.json({ error: 'Failed to create client record.' }, { status: 500 });
      }
      clientId = newClient.id;
    }

    // 3. Create job (if auto_create_job is enabled)
    let jobId: string | null = null;
    let jobNumber: number | null = null;

    if (event.auto_create_job) {
      // Get next job number via atomic increment
      const { data: rpcData, error: rpcError } = await sb.rpc('increment_job_number', {
        p_id: photographerId,
      });

      if (rpcError || !rpcData) {
        // Fallback: query max job number
        const { data: maxJob } = await sb
          .from('jobs')
          .select('job_number')
          .eq('photographer_id', photographerId)
          .order('job_number', { ascending: false })
          .limit(1)
          .single();
        jobNumber = (maxJob?.job_number || 0) + 1;
      } else {
        jobNumber = rpcData;
      }

      const packageAmount = event.custom_price ?? (pkg ? Number(pkg.price) : null);
      const packageName = pkg?.name || event.title;
      const includedImages = pkg?.included_images || null;
      const durationHours = pkg?.duration_hours ? Number(pkg.duration_hours) : (event.slot_duration_minutes / 60);

      // Calculate end time from slot
      const { data: newJob, error: jobError } = await sb
        .from('jobs')
        .insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_number: jobNumber,
          title: event.title,
          job_type: 'Mini Session',
          date: slot.date,
          time: slot.start_time?.slice(0, 5),
          end_time: slot.end_time?.slice(0, 5),
          location: event.location || null,
          package_name: packageName,
          package_amount: packageAmount,
          included_images: includedImages,
          status: 'upcoming',
          booking_slot_id: slot_id,
          notes: `Booked via online booking page. Client: ${name} (${email})`,
        })
        .select('id, job_number')
        .single();

      if (jobError) {
        console.error('Error creating job:', jobError);
        return NextResponse.json({ error: 'Failed to create job.' }, { status: 500 });
      }

      jobId = newJob.id;
      jobNumber = newJob.job_number;
    }

    // 4. Create invoice(s) (if auto_create_invoice and we have a job + amount)
    const packageAmount = event.custom_price ?? (pkg ? Number(pkg.price) : null);

    if (event.auto_create_invoice && jobId && packageAmount && packageAmount > 0) {
      const requiresDeposit = pkg?.require_deposit ?? false;
      const depositPercent = pkg?.deposit_percent ?? 25;
      const gst = 10;
      const jobLabel = event.title;
      const pkgLabel = pkg?.name || 'Session';
      const jobNum = String(jobNumber || 0).padStart(4, '0');

      // Helper dates
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
      const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];

      const fourteenBeforeShoot = (dateStr: string) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() - 14);
        return d.toISOString().split('T')[0];
      };

      if (requiresDeposit) {
        const depositAmount = Math.round(packageAmount * (depositPercent / 100) * 100) / 100;
        const finalAmount = Math.round((packageAmount - depositAmount) * 100) / 100;
        const depositDue = fourteenDaysStr;
        const finalDue = slot.date ? fourteenBeforeShoot(slot.date) : fourteenDaysStr;

        const depositTax = Math.round(depositAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: jobId,
          invoice_number: `INV-${jobNum}-DEP`,
          invoice_type: 'deposit',
          amount: depositAmount,
          tax: depositTax,
          total: Math.round((depositAmount + depositTax) * 100) / 100,
          currency: 'AUD',
          status: 'sent',
          due_date: depositDue,
          line_items: [{
            description: `${jobLabel} — ${pkgLabel} (${depositPercent}% deposit)`,
            quantity: 1, unit_price: depositAmount, total: depositAmount,
          }],
          notes: `Deposit of ${depositPercent}% to secure your booking. Due within 14 days.`,
        });

        const finalTax = Math.round(finalAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: jobId,
          invoice_number: `INV-${jobNum}-FIN`,
          invoice_type: 'final',
          amount: finalAmount,
          tax: finalTax,
          total: Math.round((finalAmount + finalTax) * 100) / 100,
          currency: 'AUD',
          status: 'draft',
          due_date: finalDue,
          line_items: [{
            description: `${jobLabel} — ${pkgLabel} (remaining balance)`,
            quantity: 1, unit_price: finalAmount, total: finalAmount,
          }],
          notes: finalDue ? `Final payment due ${new Date(finalDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (14 days before session).` : 'Final payment — remaining balance.',
        });
      } else {
        // Single invoice
        const fullDue = slot.date ? fourteenBeforeShoot(slot.date) : fourteenDaysStr;
        const fullTax = Math.round(packageAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: jobId,
          invoice_number: `INV-${jobNum}`,
          invoice_type: 'final',
          amount: packageAmount,
          tax: fullTax,
          total: Math.round((packageAmount + fullTax) * 100) / 100,
          currency: 'AUD',
          status: 'sent',
          due_date: fullDue,
          line_items: [{
            description: `${jobLabel} — ${pkgLabel}`,
            quantity: 1, unit_price: packageAmount, total: packageAmount,
          }],
          notes: `Payment due ${new Date(fullDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        });
      }
    }

    // 5. Update the slot — mark as booked with all references
    const { error: updateError } = await sb
      .from('booking_slots')
      .update({
        status: 'booked',
        client_id: clientId,
        job_id: jobId,
        booked_name: name,
        booked_email: email,
        booked_phone: phone || null,
        booked_at: new Date().toISOString(),
      })
      .eq('id', slot_id)
      .eq('status', 'available'); // Safety: only if still available

    if (updateError) {
      console.error('Error updating slot:', updateError);
      return NextResponse.json({ error: 'This time slot is no longer available.' }, { status: 409 });
    }

    // 6. Send booking confirmation email + invoice email + create & send contract
    try {
      const { data: photographer } = await sb
        .from('photographers')
        .select('name, business_name, brand_settings, contract_template, signature_image')
        .eq('id', photographerId)
        .single();

      if (photographer) {
        const brandColor = photographer.brand_settings?.primary_color || '#c47d4a';
        const businessName = photographer.business_name || photographer.name || '';
        const photographerName = photographer.name || '';

        // Send booking confirmation email
        await fetch(`${request.nextUrl.origin}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: 'booking_confirmation',
            to: email,
            data: {
              clientName: name.split(' ')[0],
              jobTitle: event.title || 'Photography Session',
              jobDate: slot.date ? new Date(slot.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
              jobTime: slot.start_time || '',
              location: event.location || '',
              photographerName,
              businessName,
              brandColor,
            },
          }),
        });

        // Build delayed emails array (sent 30s after booking confirmation)
        const delayedEmails: any[] = [];

        // Invoice email (if invoice was created)
        if (event.auto_create_invoice && jobId && packageAmount && packageAmount > 0) {
          const requiresDeposit = pkg?.require_deposit ?? false;
          const depositPercent = pkg?.deposit_percent ?? 25;
          const invoiceAmount = requiresDeposit
            ? Math.round(packageAmount * (depositPercent / 100) * 100) / 100
            : packageAmount;
          const gstAmount = Math.round(invoiceAmount * 0.1 * 100) / 100;
          const totalAmount = Math.round((invoiceAmount + gstAmount) * 100) / 100;
          const jobNum = String(jobNumber || 0).padStart(4, '0');
          const invoiceNum = requiresDeposit ? `INV-${jobNum}-DEP` : `INV-${jobNum}`;

          delayedEmails.push({
            template: 'invoice',
            to: email,
            data: {
              clientName: name.split(' ')[0],
              invoiceNumber: invoiceNum,
              amount: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(totalAmount),
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
              jobTitle: event.title || 'Photography Session',
              photographerName,
              businessName,
              brandColor,
            },
          });
        }

        // Auto-create contract (if job was created) — contract is created immediately, email is delayed
        if (jobId) {
          try {
            const template = photographer.contract_template || DEFAULT_CONTRACT;

            const { data: clientData } = await sb
              .from('clients')
              .select('first_name, last_name, email')
              .eq('id', clientId!)
              .single();

            const clientFullName = clientData
              ? `${clientData.first_name} ${clientData.last_name || ''}`.trim()
              : name;

            const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
            const jobDate = slot.date ? new Date(slot.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC';

            let requireDeposit = false;
            let depositPct = 25;
            if (pkg) {
              requireDeposit = pkg.require_deposit ?? false;
              depositPct = pkg.deposit_percent ?? 25;
            }
            const depositAmt = requireDeposit ? Math.round((packageAmount || 0) * (depositPct / 100) * 100) / 100 : 0;
            const finalAmt = (packageAmount || 0) - depositAmt;

            const formatAUD = (amt: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amt);

            let content = template
              .replace(/\{\{client_name\}\}/g, clientFullName)
              .replace(/\{\{client_email\}\}/g, email)
              .replace(/\{\{job_date\}\}/g, jobDate)
              .replace(/\{\{job_time\}\}/g, slot.start_time?.slice(0, 5) || 'TBC')
              .replace(/\{\{job_location\}\}/g, event.location || 'TBC')
              .replace(/\{\{package_name\}\}/g, pkg?.name || event.title || 'Custom')
              .replace(/\{\{package_amount\}\}/g, formatAUD(packageAmount || 0))
              .replace(/\{\{included_images\}\}/g, String(pkg?.included_images || 'as per package'))
              .replace(/\{\{business_name\}\}/g, businessName)
              .replace(/\{\{photographer_name\}\}/g, photographerName)
              .replace(/\{\{today_date\}\}/g, today)
              .replace(/\{\{deposit_amount\}\}/g, formatAUD(depositAmt))
              .replace(/\{\{deposit_percent\}\}/g, String(depositPct))
              .replace(/\{\{final_amount\}\}/g, formatAUD(finalAmt));

            const conditions: Record<string, boolean> = {
              deposit: requireDeposit,
              no_deposit: !requireDeposit,
              second_shooter: false,
              minors: false,
            };
            for (const [key, value] of Object.entries(conditions)) {
              const regex = new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g');
              content = value ? content.replace(regex, '$1') : content.replace(regex, '');
            }
            content = content.replace(/\n{3,}/g, '\n\n');

            const { data: contract } = await sb
              .from('contracts')
              .insert({
                photographer_id: photographerId,
                job_id: jobId,
                client_id: clientId,
                content,
                status: 'sent',
                sent_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                signature_data: photographer.signature_image
                  ? { photographer_signature: photographer.signature_image }
                  : null,
              })
              .select('id, signing_token')
              .single();

            if (contract?.signing_token) {
              delayedEmails.push({
                template: 'contract_signing',
                to: email,
                data: {
                  clientName: name.split(' ')[0],
                  jobTitle: event.title || 'Photography Session',
                  signingUrl: `${request.nextUrl.origin}/sign/${contract.signing_token}`,
                  photographerName,
                  businessName,
                  brandColor,
                },
              });
            }
          } catch (contractErr) {
            console.error('Failed to create contract:', contractErr);
          }
        }

        // Fire off delayed emails (30s after booking confirmation) — fire and forget
        if (delayedEmails.length > 0) {
          fetch(`${request.nextUrl.origin}/api/send-followup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails: delayedEmails, delaySeconds: 30 }),
          }).catch((err) => console.error('Failed to trigger delayed emails:', err));
        }
      }
    } catch (emailErr) {
      console.error('Failed to send booking emails:', emailErr);
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      client_id: clientId,
      message: 'Booking confirmed!',
    });

  } catch (err) {
    console.error('Booking API error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

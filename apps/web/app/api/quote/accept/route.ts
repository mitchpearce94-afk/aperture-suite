import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CONTRACT } from '@/lib/default-contract';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const sb = getServiceClient();

    // 1. Find the lead by quote token
    const { data: lead, error: leadError } = await sb
      .from('leads')
      .select('*, client:clients(*)')
      .eq('quote_token', token)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Quote not found or has expired.' }, { status: 404 });
    }

    if (lead.status === 'booked') {
      return NextResponse.json({ error: 'This quote has already been accepted.', already_booked: true }, { status: 409 });
    }

    if (lead.status === 'lost') {
      return NextResponse.json({ error: 'This quote is no longer available.' }, { status: 410 });
    }

    const photographerId = lead.photographer_id;
    const clientId = lead.client_id;
    const client = lead.client;
    const clientName = client ? `${client.first_name} ${client.last_name || ''}`.trim() : 'Client';
    const clientEmail = client?.email;

    // 2. Get package details if quoted_package_id exists
    let pkg: any = null;
    if (lead.quoted_package_id) {
      const { data: pkgData } = await sb
        .from('packages')
        .select('*')
        .eq('id', lead.quoted_package_id)
        .single();
      pkg = pkgData;
    }

    const packageAmount = lead.quoted_amount || (pkg ? Number(pkg.price) : 0);
    const packageName = pkg?.name || lead.job_type || 'Photography Session';

    // 3. Create job
    const { data: rpcData } = await sb.rpc('increment_job_number', { p_id: photographerId });
    let jobNumber = rpcData;
    if (!jobNumber) {
      const { data: maxJob } = await sb
        .from('jobs')
        .select('job_number')
        .eq('photographer_id', photographerId)
        .order('job_number', { ascending: false })
        .limit(1)
        .single();
      jobNumber = (maxJob?.job_number || 0) + 1;
    }

    const { data: newJob, error: jobError } = await sb
      .from('jobs')
      .insert({
        photographer_id: photographerId,
        client_id: clientId,
        job_number: jobNumber,
        title: packageName,
        job_type: lead.job_type || 'Photography',
        date: lead.preferred_date || null,
        location: lead.location || null,
        package_name: pkg?.name || null,
        package_amount: packageAmount || null,
        included_images: pkg?.included_images || null,
        status: 'upcoming',
        notes: `Auto-created from accepted quote. Lead source: ${lead.source || 'direct'}`,
      })
      .select('id, job_number')
      .single();

    if (jobError || !newJob) {
      console.error('Error creating job from quote:', jobError);
      return NextResponse.json({ error: 'Failed to create job.' }, { status: 500 });
    }

    // 4. Create invoice(s)
    if (packageAmount > 0) {
      const requiresDeposit = pkg?.require_deposit ?? false;
      const depositPercent = pkg?.deposit_percent ?? 25;
      const gst = 10;
      const jobNum = String(jobNumber).padStart(4, '0');

      const now = new Date();
      const fourteenDaysFromNow = new Date(now);
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
      const fourteenDaysStr = fourteenDaysFromNow.toISOString().split('T')[0];

      const smartDueDate = (dateStr: string | null, daysBefore: number) => {
        if (!dateStr) return fourteenDaysStr;
        const shootDate = new Date(dateStr);
        const dueDate = new Date(shootDate);
        dueDate.setDate(dueDate.getDate() - daysBefore);
        if (dueDate <= now) return now.toISOString().split('T')[0];
        return dueDate.toISOString().split('T')[0];
      };

      if (requiresDeposit) {
        const depositAmount = Math.round(packageAmount * (depositPercent / 100) * 100) / 100;
        const finalAmount = Math.round((packageAmount - depositAmount) * 100) / 100;
        const depositDue = fourteenDaysStr;
        const finalDue = smartDueDate(lead.preferred_date, 14);

        const depositTax = Math.round(depositAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: newJob.id,
          invoice_number: `INV-${jobNum}-DEP`,
          invoice_type: 'deposit',
          amount: depositAmount,
          tax: depositTax,
          total: Math.round((depositAmount + depositTax) * 100) / 100,
          currency: 'AUD',
          status: 'sent',
          due_date: depositDue,
          line_items: [{
            description: `${packageName} (${depositPercent}% deposit)`,
            quantity: 1, unit_price: depositAmount, total: depositAmount,
          }],
          notes: `Deposit of ${depositPercent}% to secure your booking. Due within 14 days.`,
        });

        const finalTax = Math.round(finalAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: newJob.id,
          invoice_number: `INV-${jobNum}-FIN`,
          invoice_type: 'final',
          amount: finalAmount,
          tax: finalTax,
          total: Math.round((finalAmount + finalTax) * 100) / 100,
          currency: 'AUD',
          status: 'draft',
          due_date: finalDue,
          line_items: [{
            description: `${packageName} (remaining balance)`,
            quantity: 1, unit_price: finalAmount, total: finalAmount,
          }],
          notes: `Final payment due ${new Date(finalDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (14 days before session).`,
        });
      } else {
        const fullDue = smartDueDate(lead.preferred_date, 14);
        const fullTax = Math.round(packageAmount * (gst / 100) * 100) / 100;
        await sb.from('invoices').insert({
          photographer_id: photographerId,
          client_id: clientId,
          job_id: newJob.id,
          invoice_number: `INV-${jobNum}`,
          invoice_type: 'final',
          amount: packageAmount,
          tax: fullTax,
          total: Math.round((packageAmount + fullTax) * 100) / 100,
          currency: 'AUD',
          status: 'sent',
          due_date: fullDue,
          line_items: [{
            description: packageName,
            quantity: 1, unit_price: packageAmount, total: packageAmount,
          }],
          notes: `Payment due ${new Date(fullDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
        });
      }
    }

    // 5. Update lead to booked
    await sb
      .from('leads')
      .update({ status: 'booked', quote_accepted_at: new Date().toISOString() })
      .eq('id', lead.id);

    // 6. Get photographer info for emails
    const { data: photographer } = await sb
      .from('photographers')
      .select('name, business_name, brand_settings, contract_template, signature_image, phone, email, website, payment_details')
      .eq('id', photographerId)
      .single();

    if (photographer && clientEmail) {
      const brandColor = photographer.brand_settings?.primary_color || '#c47d4a';
      const businessName = photographer.business_name || photographer.name || '';
      const photographerName = photographer.name || '';
      const origin = request.nextUrl.origin;
      const pd = photographer.payment_details || {};

      const brandData: Record<string, string> = {
        photographerName,
        businessName,
        brandColor,
        logoUrl: photographer.brand_settings?.logo_url || '',
        phone: photographer.phone || '',
        contactEmail: photographer.email || '',
        website: photographer.website || '',
        bankName: pd.bank_name || '',
        accountName: pd.account_name || '',
        bsb: pd.bsb || '',
        accountNumber: pd.account_number || '',
        payidEmail: pd.payid_email || '',
        payidPhone: pd.payid_phone || '',
        paymentInstructions: pd.payment_instructions || '',
      };

      // Booking confirmation
      await fetch(`${origin}/api/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'booking_confirmation',
          to: clientEmail,
          data: {
            ...brandData,
            clientName: client?.first_name || clientName.split(' ')[0],
            jobTitle: packageName,
            jobDate: lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC',
            location: lead.location || '',
          },
        }),
      });

      // Build delayed emails (sent 30s after booking confirmation)
      const delayedEmails: any[] = [];

      // Invoice email
      if (packageAmount > 0) {
        const requiresDeposit = pkg?.require_deposit ?? false;
        const depositPercent = pkg?.deposit_percent ?? 25;
        const invoiceAmount = requiresDeposit
          ? Math.round(packageAmount * (depositPercent / 100) * 100) / 100
          : packageAmount;
        const gstAmt = Math.round(invoiceAmount * 0.1 * 100) / 100;
        const totalAmt = Math.round((invoiceAmount + gstAmt) * 100) / 100;
        const jobNum = String(jobNumber).padStart(4, '0');
        const invoiceNum = requiresDeposit ? `INV-${jobNum}-DEP` : `INV-${jobNum}`;

        delayedEmails.push({
          template: 'invoice',
          to: clientEmail,
          data: {
            ...brandData,
            clientName: client?.first_name || clientName.split(' ')[0],
            invoiceNumber: invoiceNum,
            amount: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(totalAmt),
            dueDate: new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
            jobTitle: packageName,
          },
        });
      }

      // Contract — create immediately, delay the email
      try {
        const template = photographer.contract_template || DEFAULT_CONTRACT;
        const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
        const formatAUD = (amt: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amt);

        let content = template
          .replace(/\{\{client_name\}\}/g, clientName)
          .replace(/\{\{client_email\}\}/g, clientEmail)
          .replace(/\{\{job_date\}\}/g, lead.preferred_date ? new Date(lead.preferred_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC')
          .replace(/\{\{job_time\}\}/g, 'TBC')
          .replace(/\{\{job_location\}\}/g, lead.location || 'TBC')
          .replace(/\{\{package_name\}\}/g, pkg?.name || 'Custom')
          .replace(/\{\{package_amount\}\}/g, formatAUD(packageAmount))
          .replace(/\{\{included_images\}\}/g, String(pkg?.included_images || 'as per package'))
          .replace(/\{\{business_name\}\}/g, businessName)
          .replace(/\{\{photographer_name\}\}/g, photographerName)
          .replace(/\{\{today_date\}\}/g, today)
          .replace(/\{\{deposit_amount\}\}/g, formatAUD(0))
          .replace(/\{\{deposit_percent\}\}/g, '0')
          .replace(/\{\{final_amount\}\}/g, formatAUD(packageAmount));

        content = content.replace(/\{\{#if \w+\}\}[\s\S]*?\{\{\/if\}\}/g, '');
        content = content.replace(/\n{3,}/g, '\n\n');

        const { data: contract } = await sb
          .from('contracts')
          .insert({
            photographer_id: photographerId,
            job_id: newJob.id,
            client_id: clientId,
            content,
            status: 'sent',
            sent_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            signature_data: photographer.signature_image
              ? { photographer_signature: photographer.signature_image }
              : null,
          })
          .select('id, signing_token')
          .single();

        if (contract?.signing_token) {
          delayedEmails.push({
            template: 'contract_signing',
            to: clientEmail,
            data: {
              ...brandData,
              clientName: client?.first_name || clientName.split(' ')[0],
              jobTitle: packageName,
              signingUrl: `${origin}/sign/${contract.signing_token}`,
            },
          });
        }
      } catch (err) {
        console.error('Contract creation failed:', err);
      }

      // Fire off delayed emails (30s after booking confirmation)
      if (delayedEmails.length > 0) {
        fetch(`${origin}/api/send-followup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: delayedEmails, delaySeconds: 30 }),
        }).catch((err) => console.error('Failed to trigger delayed emails:', err));
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Quote accepted! Your booking is confirmed.',
      job_id: newJob.id,
    });

  } catch (err) {
    console.error('Quote accept error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

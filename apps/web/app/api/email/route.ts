import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Resend API endpoint
const RESEND_API = 'https://api.resend.com/emails';

type EmailTemplate = 'gallery_delivery' | 'booking_confirmation' | 'invoice' | 'contract_signing' | 'reminder' | 'quote';

interface SendEmailRequest {
  template: EmailTemplate;
  to: string;
  data: Record<string, string>;
}

// --- Email Templates ---

function galleryDeliveryEmail(data: Record<string, string>) {
  const { clientName, galleryTitle, galleryUrl, photographerName, businessName, brandColor = '#c47d4a', photoCount, expiryDate } = data;
  
  return {
    subject: `Your photos are ready! — ${galleryTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <!-- Main card -->
    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Your photos are ready!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        Hi ${clientName}, your gallery <strong>${galleryTitle}</strong> is ready to view. 
        ${photoCount ? `There are ${photoCount} photos waiting for you.` : ''}
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${galleryUrl}" style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
          View Your Gallery
        </a>
      </div>

      <!-- Details -->
      <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:24px;">
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          You can favourite your top picks, download images, and share individual photos right from your gallery.
        </p>
        ${expiryDate ? `<p style="margin:8px 0 0;font-size:12px;color:#d97706;">This gallery expires on ${expiryDate}.</p>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

function bookingConfirmationEmail(data: Record<string, string>) {
  const { clientName, jobTitle, jobDate, jobTime, location, photographerName, businessName, brandColor = '#c47d4a' } = data;

  return {
    subject: `Booking confirmed — ${jobTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Booking Confirmed!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        Hi ${clientName}, your session has been confirmed. Here are the details:
      </p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-size:13px;color:#9ca3af;width:80px;">Session</td><td style="padding:6px 0;font-size:14px;color:#374151;font-weight:500;">${jobTitle}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9ca3af;">Date</td><td style="padding:6px 0;font-size:14px;color:#374151;font-weight:500;">${jobDate}</td></tr>
          ${jobTime ? `<tr><td style="padding:6px 0;font-size:13px;color:#9ca3af;">Time</td><td style="padding:6px 0;font-size:14px;color:#374151;font-weight:500;">${jobTime}</td></tr>` : ''}
          ${location ? `<tr><td style="padding:6px 0;font-size:13px;color:#9ca3af;">Location</td><td style="padding:6px 0;font-size:14px;color:#374151;font-weight:500;">${location}</td></tr>` : ''}
        </table>
      </div>

      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        You'll receive a contract to sign and an invoice shortly. If you have any questions, feel free to reply to this email.
      </p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

function invoiceEmail(data: Record<string, string>) {
  const { clientName, invoiceNumber, amount, dueDate, jobTitle, photographerName, businessName, brandColor = '#c47d4a' } = data;

  return {
    subject: `Invoice ${invoiceNumber} — ${businessName || photographerName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Invoice ${invoiceNumber}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${clientName}, here's your invoice for <strong>${jobTitle}</strong>.</p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#9ca3af;">Amount Due</p>
        <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#111827;">${amount}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">Due by ${dueDate}</p>
      </div>

      <p style="margin:0;font-size:13px;color:#9ca3af;">Payment details will be provided separately. Please feel free to reply if you have any questions.</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

function contractSigningEmail(data: Record<string, string>) {
  const { clientName, jobTitle, signingUrl, photographerName, businessName, brandColor = '#c47d4a' } = data;

  return {
    subject: `Contract ready to sign — ${jobTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Contract Ready</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        Hi ${clientName}, your contract for <strong>${jobTitle}</strong> is ready to sign.
      </p>

      <div style="text-align:center;margin:24px 0;">
        <a href="${signingUrl}" style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
          Review & Sign Contract
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#9ca3af;">This contract can be signed electronically. Your signature is legally binding.</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

function reminderEmail(data: Record<string, string>) {
  const { clientName, subject: subjectLine, message, photographerName, businessName, brandColor = '#c47d4a' } = data;

  return {
    subject: subjectLine || `Reminder from ${businessName || photographerName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">Hi ${clientName}</h1>
      <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;white-space:pre-wrap;">${message}</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

function quoteEmail(data: Record<string, string>) {
  const { clientName, packageName, amount, includedImages, jobDate, location, photographerName, businessName, brandColor = '#c47d4a', acceptUrl } = data;

  return {
    subject: `Your photography quote — ${businessName || photographerName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background-color:${brandColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;">
        ${(businessName || photographerName || 'A').charAt(0)}
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${businessName || photographerName}</p>
    </div>

    <div style="background:#fff;border-radius:16px;padding:32px;border:1px solid #f3f4f6;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Hi ${clientName}!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        Thanks for your enquiry! Here's a quote for your photography session.
      </p>

      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Package</td><td style="padding:8px 0;font-size:14px;color:#374151;font-weight:600;text-align:right;">${packageName}</td></tr>
          ${amount ? `<tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Total</td><td style="padding:8px 0;font-size:20px;color:#111827;font-weight:700;text-align:right;">${amount}</td></tr>` : ''}
          ${includedImages ? `<tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Included Images</td><td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${includedImages}</td></tr>` : ''}
          ${jobDate ? `<tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Date</td><td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${jobDate}</td></tr>` : ''}
          ${location ? `<tr><td style="padding:8px 0;font-size:13px;color:#9ca3af;">Location</td><td style="padding:8px 0;font-size:14px;color:#374151;text-align:right;">${location}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${acceptUrl}" style="display:inline-block;padding:14px 40px;background-color:${brandColor};color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
          Accept Quote & Book
        </a>
      </div>

      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
        Click the button above to confirm your booking. You'll receive an invoice and contract to sign.
      </p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:11px;color:#d1d5db;">Sent via Apelier</p>
    </div>
  </div>
</body>
</html>`
  };
}

// --- Template dispatcher ---
function getEmailContent(template: EmailTemplate, data: Record<string, string>) {
  switch (template) {
    case 'gallery_delivery': return galleryDeliveryEmail(data);
    case 'booking_confirmation': return bookingConfirmationEmail(data);
    case 'invoice': return invoiceEmail(data);
    case 'contract_signing': return contractSigningEmail(data);
    case 'reminder': return reminderEmail(data);
    case 'quote': return quoteEmail(data);
    default: throw new Error(`Unknown template: ${template}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { template, to, data } = body;

    if (!template || !to || !data) {
      return NextResponse.json({ error: 'Missing required fields: template, to, data' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Dev mode — log and return success
      console.log('[Email Dev Mode] Would send:', { template, to, data });
      return NextResponse.json({
        success: true,
        dev_mode: true,
        message: 'Email logged (RESEND_API_KEY not configured)',
      });
    }

    const { subject, html } = getEmailContent(template, data);
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'noreply@apelier.com.au';

    const response = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${data.businessName || 'Apelier'} <${fromAddress}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Resend API error:', err);
      return NextResponse.json({ error: 'Failed to send email', details: err }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, id: result.id });

  } catch (err) {
    console.error('Email route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

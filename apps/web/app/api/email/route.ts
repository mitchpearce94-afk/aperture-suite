import { NextRequest, NextResponse } from 'next/server';

const RESEND_API = 'https://api.resend.com/emails';

type EmailTemplate = 'gallery_delivery' | 'booking_confirmation' | 'invoice' | 'contract_signing' | 'reminder' | 'quote';

interface SendEmailRequest {
  template: EmailTemplate;
  to: string;
  data: Record<string, string>;
}

// ─── Shared Components ───

function darken(hex: string, amt: number): string {
  const c = (n: number) => Math.min(255, Math.max(0, n));
  const h = hex.replace('#', '');
  return '#' + [0, 2, 4].map(i => c(parseInt(h.substring(i, i + 2), 16) + amt).toString(16).padStart(2, '0')).join('');
}

function emailHeader(brandColor: string, businessName: string, photographerName: string, logoUrl?: string, phone?: string, contactEmail?: string, website?: string) {
  const name = businessName || photographerName || 'Studio';
  const initial = name.charAt(0).toUpperCase();

  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;max-width:200px;display:block;margin:0 auto;" />`
    : `<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,${brandColor},${darken(brandColor, -30)});margin:0 auto;text-align:center;line-height:52px;color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;">${initial}</div>`;

  const contactParts: string[] = [];
  if (phone) contactParts.push(phone);
  if (contactEmail) contactParts.push(contactEmail);
  if (website) contactParts.push(website.replace(/^https?:\/\//, ''));
  const contactLine = contactParts.length > 0
    ? `<p style="margin:6px 0 0;font-size:11px;color:#4a5568;">${contactParts.join('&nbsp; · &nbsp;')}</p>`
    : '';

  return `
    <div style="text-align:center;padding:36px 0 24px;">
      ${logo}
      <p style="margin:12px 0 0;font-size:13px;font-weight:600;color:#94a3b8;letter-spacing:0.04em;">${name}</p>
      ${contactLine}
    </div>
    <div style="height:1px;background:linear-gradient(90deg, transparent 0%, ${brandColor}66 50%, transparent 100%);margin:0 auto;max-width:120px;"></div>`;
}

function emailFooter(brandColor: string) {
  return `
    <div style="text-align:center;padding:28px 0 12px;">
      <p style="margin:0;font-size:10px;color:#374151;letter-spacing:0.06em;">POWERED BY <a href="https://apelier.com.au" style="color:${brandColor};text-decoration:none;font-weight:600;">APELIER</a></p>
    </div>`;
}

function emailCard(inner: string) {
  return `
    <div style="background:#111118;border-radius:16px;padding:36px 32px;border:1px solid rgba(255,255,255,0.06);margin-top:28px;">
      ${inner}
    </div>`;
}

function ctaBtn(text: string, url: string, brandColor: string) {
  return `
    <div style="text-align:center;margin:28px 0 20px;">
      <a href="${url}" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,${brandColor},${darken(brandColor, -20)});color:#ffffff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;letter-spacing:0.02em;">${text}</a>
    </div>`;
}

function detailRow(label: string, value: string) {
  if (!value) return '';
  return `<tr>
    <td style="padding:10px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.04);width:110px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;font-size:14px;color:#e2e8f0;font-weight:500;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;">${value}</td>
  </tr>`;
}

function detailTable(rows: string) {
  return `<table style="width:100%;border-collapse:collapse;margin:20px 0;">${rows}</table>`;
}

function emailWrap(brandColor: string, businessName: string, photographerName: string, content: string, logoUrl?: string, phone?: string, contactEmail?: string, website?: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#08080f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:20px 16px;">
    ${emailHeader(brandColor, businessName, photographerName, logoUrl, phone, contactEmail, website)}
    ${content}
    ${emailFooter(brandColor)}
  </div>
</body>
</html>`;
}

// ─── Templates ───

function galleryDeliveryEmail(d: Record<string, string>) {
  const { clientName, galleryTitle, galleryUrl, photographerName, businessName, brandColor = '#c47d4a', photoCount, expiryDate, logoUrl, phone, contactEmail, website } = d;

  const content = emailCard(`
    <div style="text-align:center;margin-bottom:8px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${brandColor}15;text-align:center;line-height:56px;">
        <span style="font-size:24px;">&#128248;</span>
      </div>
    </div>
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;font-family:Georgia,'Times New Roman',serif;">Your photos are ready</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#94a3b8;line-height:1.7;text-align:center;">
      Hi ${clientName}, your gallery <strong style="color:#e2e8f0;">${galleryTitle}</strong> is ready to view${photoCount ? ` &mdash; ${photoCount} photos waiting for you` : ''}.
    </p>
    ${ctaBtn('View Your Gallery', galleryUrl, brandColor)}
    <p style="margin:0;font-size:12px;color:#4a5568;text-align:center;line-height:1.6;">
      You can favourite your top picks, download images, and share individual photos right from your gallery.
      ${expiryDate ? `<br/><span style="color:#d97706;">Gallery expires ${expiryDate}</span>` : ''}
    </p>
  `);

  return {
    subject: `Your photos are ready! &mdash; ${galleryTitle}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

function bookingConfirmationEmail(d: Record<string, string>) {
  const { clientName, jobTitle, jobDate, jobTime, location, photographerName, businessName, brandColor = '#c47d4a', logoUrl, phone, contactEmail, website } = d;

  const rows = [
    detailRow('Session', jobTitle),
    detailRow('Date', jobDate),
    detailRow('Time', jobTime),
    detailRow('Location', location),
  ].join('');

  const content = emailCard(`
    <div style="text-align:center;margin-bottom:8px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:#10b98115;text-align:center;line-height:56px;">
        <span style="font-size:26px;color:#10b981;">&#10003;</span>
      </div>
    </div>
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;font-family:Georgia,'Times New Roman',serif;">Booking Confirmed</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.7;text-align:center;">
      Hi ${clientName}, your session with ${businessName || photographerName} has been confirmed.
    </p>

    <div style="background:#0d0d15;border-radius:12px;padding:4px 20px;border:1px solid rgba(255,255,255,0.04);">
      ${detailTable(rows)}
    </div>

    <p style="margin:24px 0 0;font-size:13px;color:#64748b;text-align:center;line-height:1.6;">
      You'll receive your contract and invoice shortly.<br/>If you have any questions, feel free to reply to this email.
    </p>
  `);

  return {
    subject: `Booking confirmed &mdash; ${jobTitle}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

function invoiceEmail(d: Record<string, string>) {
  const { clientName, invoiceNumber, amount, dueDate, jobTitle, photographerName, businessName, brandColor = '#c47d4a', logoUrl, phone, contactEmail, website,
    bankName, accountName, bsb, accountNumber, payidEmail, payidPhone, paymentInstructions } = d;

  const hasBank = bankName || accountName || bsb || accountNumber;
  const hasPayId = payidEmail || payidPhone;

  let paymentBlock = '';
  if (hasBank || hasPayId) {
    let bankRows = '';
    if (hasBank) {
      bankRows = `
        <p style="margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Bank Transfer</p>
        <table style="width:100%;border-collapse:collapse;">
          ${bankName ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:100px;">Bank</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;">${bankName}</td></tr>` : ''}
          ${accountName ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Account</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;">${accountName}</td></tr>` : ''}
          ${bsb ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;">BSB</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;font-family:'Courier New',monospace;">${bsb}</td></tr>` : ''}
          ${accountNumber ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Account No.</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;font-family:'Courier New',monospace;">${accountNumber}</td></tr>` : ''}
        </table>`;
    }

    let payIdRows = '';
    if (hasPayId) {
      payIdRows = `
        ${hasBank ? '<div style="height:16px;"></div>' : ''}
        <p style="margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">PayID</p>
        <table style="width:100%;border-collapse:collapse;">
          ${payidEmail ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;width:100px;">Email</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;">${payidEmail}</td></tr>` : ''}
          ${payidPhone ? `<tr><td style="padding:4px 0;font-size:12px;color:#64748b;">Phone</td><td style="padding:4px 0;font-size:13px;color:#e2e8f0;">${payidPhone}</td></tr>` : ''}
        </table>`;
    }

    paymentBlock = `
      <div style="background:#0d0d15;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04);margin-top:20px;">
        <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#e2e8f0;">Payment Details</p>
        ${bankRows}
        ${payIdRows}
        ${paymentInstructions ? `<p style="margin:14px 0 0;font-size:12px;color:#94a3b8;font-style:italic;">${paymentInstructions}</p>` : ''}
      </div>`;
  }

  const content = emailCard(`
    <div>
      <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Invoice</p>
      <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">${invoiceNumber}</h1>
    </div>

    <p style="margin:16px 0 24px;font-size:14px;color:#94a3b8;">Hi ${clientName}, here's your invoice for <strong style="color:#e2e8f0;">${jobTitle}</strong>.</p>

    <div style="background:linear-gradient(135deg, ${brandColor}12, ${brandColor}06);border:1px solid ${brandColor}30;border-radius:14px;padding:28px;text-align:center;margin-bottom:4px;">
      <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Amount Due</p>
      <p style="margin:8px 0;font-size:36px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">${amount}</p>
      <p style="margin:0;font-size:13px;color:${brandColor};">Due by ${dueDate}</p>
    </div>

    ${paymentBlock}

    <p style="margin:24px 0 0;font-size:12px;color:#4a5568;text-align:center;">
      Please include <strong style="color:#94a3b8;">${invoiceNumber}</strong> as the payment reference.
      <br/>Reply to this email if you have any questions.
    </p>
  `);

  return {
    subject: `Invoice ${invoiceNumber} — ${businessName || photographerName}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

function contractSigningEmail(d: Record<string, string>) {
  const { clientName, jobTitle, signingUrl, photographerName, businessName, brandColor = '#c47d4a', logoUrl, phone, contactEmail, website } = d;

  const content = emailCard(`
    <div style="text-align:center;margin-bottom:8px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:${brandColor}15;text-align:center;line-height:56px;">
        <span style="font-size:24px;">&#128221;</span>
      </div>
    </div>
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;text-align:center;font-family:Georgia,'Times New Roman',serif;">Contract Ready</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#94a3b8;line-height:1.7;text-align:center;">
      Hi ${clientName}, your contract for <strong style="color:#e2e8f0;">${jobTitle}</strong> is ready to review and sign.
    </p>
    ${ctaBtn('Review & Sign Contract', signingUrl, brandColor)}
    <p style="margin:0;font-size:12px;color:#4a5568;text-align:center;">
      This contract can be signed electronically. Your signature is legally binding.
    </p>
  `);

  return {
    subject: `Contract ready to sign — ${jobTitle}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

function reminderEmail(d: Record<string, string>) {
  const { clientName, subject: subjectLine, message, photographerName, businessName, brandColor = '#c47d4a', logoUrl, phone, contactEmail, website } = d;

  const content = emailCard(`
    <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">Hi ${clientName}</h1>
    <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.8;white-space:pre-wrap;">${message}</p>
  `);

  return {
    subject: subjectLine || `Reminder from ${businessName || photographerName}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

function quoteEmail(d: Record<string, string>) {
  const { clientName, packageName, amount, includedImages, jobDate, location, photographerName, businessName, brandColor = '#c47d4a', acceptUrl, logoUrl, phone, contactEmail, website } = d;

  const rows = [
    detailRow('Package', packageName),
    amount ? `<tr>
      <td style="padding:10px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(255,255,255,0.04);width:110px;">Total</td>
      <td style="padding:10px 0;font-size:20px;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;font-family:Georgia,'Times New Roman',serif;">${amount}</td>
    </tr>` : '',
    detailRow('Images', includedImages),
    detailRow('Date', jobDate),
    detailRow('Location', location),
  ].join('');

  const content = emailCard(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;font-family:Georgia,'Times New Roman',serif;">Hi ${clientName}!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.7;">
      Thanks for your enquiry! Here's a quote for your photography session with ${businessName || photographerName}.
    </p>

    <div style="background:#0d0d15;border-radius:12px;padding:4px 20px;border:1px solid rgba(255,255,255,0.04);">
      ${detailTable(rows)}
    </div>

    ${ctaBtn('Accept Quote & Book', acceptUrl, brandColor)}

    <p style="margin:0;font-size:12px;color:#4a5568;text-align:center;line-height:1.6;">
      Click above to confirm your booking. You'll receive a booking confirmation, invoice, and contract to sign.
    </p>
  `);

  return {
    subject: `Your photography quote — ${businessName || photographerName}`,
    html: emailWrap(brandColor, businessName, photographerName, content, logoUrl, phone, contactEmail, website),
  };
}

// ─── Dispatcher ───

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

// ─── Route Handler ───

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { template, to, data } = body;

    if (!template || !to || !data) {
      return NextResponse.json({ error: 'Missing required fields: template, to, data' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.log('[Email Dev Mode] Would send:', { template, to, data });
      return NextResponse.json({ success: true, dev_mode: true, message: 'Email logged (RESEND_API_KEY not configured)' });
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

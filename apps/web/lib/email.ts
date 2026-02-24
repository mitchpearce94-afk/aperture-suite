// Email sending helper — calls /api/email route

export type EmailTemplate = 'gallery_delivery' | 'booking_confirmation' | 'invoice' | 'contract_signing' | 'reminder' | 'quote';

export async function sendEmail(template: EmailTemplate, to: string, data: Record<string, string>): Promise<{ success: boolean; dev_mode?: boolean; error?: string }> {
  try {
    const response = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, data }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email send failed:', result);
      return { success: false, error: result.error || 'Failed to send email' };
    }

    return result;
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Network error' };
  }
}

// Convenience helpers

export async function sendGalleryDeliveryEmail(options: {
  to: string;
  clientName: string;
  galleryTitle: string;
  galleryUrl: string;
  photographerName: string;
  businessName: string;
  brandColor?: string;
  photoCount?: string;
  expiryDate?: string;
}) {
  return sendEmail('gallery_delivery', options.to, {
    clientName: options.clientName,
    galleryTitle: options.galleryTitle,
    galleryUrl: options.galleryUrl,
    photographerName: options.photographerName,
    businessName: options.businessName,
    brandColor: options.brandColor || '#b8860b',
    photoCount: options.photoCount || '',
    expiryDate: options.expiryDate || '',
  });
}

export async function sendBookingConfirmationEmail(options: {
  to: string;
  clientName: string;
  jobTitle: string;
  jobDate: string;
  jobTime?: string;
  location?: string;
  photographerName: string;
  businessName: string;
  brandColor?: string;
}) {
  return sendEmail('booking_confirmation', options.to, {
    clientName: options.clientName,
    jobTitle: options.jobTitle,
    jobDate: options.jobDate,
    jobTime: options.jobTime || '',
    location: options.location || '',
    photographerName: options.photographerName,
    businessName: options.businessName,
    brandColor: options.brandColor || '#b8860b',
  });
}

export async function sendInvoiceEmail(options: {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  jobTitle: string;
  photographerName: string;
  businessName: string;
  brandColor?: string;
}) {
  return sendEmail('invoice', options.to, {
    clientName: options.clientName,
    invoiceNumber: options.invoiceNumber,
    amount: options.amount,
    dueDate: options.dueDate,
    jobTitle: options.jobTitle,
    photographerName: options.photographerName,
    businessName: options.businessName,
    brandColor: options.brandColor || '#b8860b',
  });
}

export async function sendContractSigningEmail(options: {
  to: string;
  clientName: string;
  jobTitle: string;
  signingUrl: string;
  photographerName: string;
  businessName: string;
  brandColor?: string;
}) {
  return sendEmail('contract_signing', options.to, {
    clientName: options.clientName,
    jobTitle: options.jobTitle,
    signingUrl: options.signingUrl,
    photographerName: options.photographerName,
    businessName: options.businessName,
    brandColor: options.brandColor || '#b8860b',
  });
}

// Email sending helper — calls /api/email route

export type EmailTemplate = 'gallery_delivery' | 'booking_confirmation' | 'invoice' | 'contract_signing' | 'reminder' | 'quote';

export async function sendEmail(template: EmailTemplate, to: string, data: Record<string, string>): Promise<{ success: boolean; dev_mode?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, data }),
    });
    const result = await res.json();
    if (!res.ok) {
      console.error(`Email API error (${template}):`, result);
      return { success: false, error: result.error || 'Unknown error' };
    }
    return result;
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: 'Network error' };
  }
}

// Brand data that all templates can use
interface BrandData {
  photographerName: string;
  businessName: string;
  brandColor?: string;
  logoUrl?: string;
  phone?: string;
  contactEmail?: string;
  website?: string;
  // Payment details (used by invoice)
  bankName?: string;
  accountName?: string;
  bsb?: string;
  accountNumber?: string;
  payidEmail?: string;
  payidPhone?: string;
  paymentInstructions?: string;
}

function brandToData(b: BrandData): Record<string, string> {
  return {
    photographerName: b.photographerName,
    businessName: b.businessName,
    brandColor: b.brandColor || '#c47d4a',
    logoUrl: b.logoUrl || '',
    phone: b.phone || '',
    contactEmail: b.contactEmail || '',
    website: b.website || '',
    bankName: b.bankName || '',
    accountName: b.accountName || '',
    bsb: b.bsb || '',
    accountNumber: b.accountNumber || '',
    payidEmail: b.payidEmail || '',
    payidPhone: b.payidPhone || '',
    paymentInstructions: b.paymentInstructions || '',
  };
}

// Convenience helpers

export async function sendGalleryDeliveryEmail(options: BrandData & {
  to: string;
  clientName: string;
  galleryTitle: string;
  galleryUrl: string;
  photoCount?: string;
  expiryDate?: string;
}) {
  return sendEmail('gallery_delivery', options.to, {
    ...brandToData(options),
    clientName: options.clientName,
    galleryTitle: options.galleryTitle,
    galleryUrl: options.galleryUrl,
    photoCount: options.photoCount || '',
    expiryDate: options.expiryDate || '',
  });
}

export async function sendBookingConfirmationEmail(options: BrandData & {
  to: string;
  clientName: string;
  jobTitle: string;
  jobDate: string;
  jobTime?: string;
  location?: string;
}) {
  return sendEmail('booking_confirmation', options.to, {
    ...brandToData(options),
    clientName: options.clientName,
    jobTitle: options.jobTitle,
    jobDate: options.jobDate,
    jobTime: options.jobTime || '',
    location: options.location || '',
  });
}

export async function sendInvoiceEmail(options: BrandData & {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  jobTitle: string;
}) {
  return sendEmail('invoice', options.to, {
    ...brandToData(options),
    clientName: options.clientName,
    invoiceNumber: options.invoiceNumber,
    amount: options.amount,
    dueDate: options.dueDate,
    jobTitle: options.jobTitle,
  });
}

export async function sendContractSigningEmail(options: BrandData & {
  to: string;
  clientName: string;
  jobTitle: string;
  signingUrl: string;
}) {
  return sendEmail('contract_signing', options.to, {
    ...brandToData(options),
    clientName: options.clientName,
    jobTitle: options.jobTitle,
    signingUrl: options.signingUrl,
  });
}

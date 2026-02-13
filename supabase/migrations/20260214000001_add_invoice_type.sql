-- Add invoice_type to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'custom' CHECK (invoice_type IN ('deposit', 'final', 'custom'));

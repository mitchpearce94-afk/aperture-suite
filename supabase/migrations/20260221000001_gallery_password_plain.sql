-- Add password_plain column to galleries so photographers can view the password later
-- The password_hash column is kept for client-side verification
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS password_plain text;

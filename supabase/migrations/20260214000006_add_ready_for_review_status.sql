-- Add ready_for_review to job status options + included_images column
-- Run in Supabase SQL Editor

-- Update the status check constraint on jobs to include ready_for_review
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
  CHECK (status IN ('upcoming', 'in_progress', 'editing', 'ready_for_review', 'delivered', 'completed', 'canceled'));

-- Add included_images column if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'included_images') THEN
    ALTER TABLE jobs ADD COLUMN included_images INTEGER;
  END IF;
END $$;

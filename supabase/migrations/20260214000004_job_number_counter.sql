-- Add persistent job number counter to photographers
ALTER TABLE photographers ADD COLUMN IF NOT EXISTS next_job_number INTEGER NOT NULL DEFAULT 0;

-- Backfill: set counter to highest existing job number for each photographer
UPDATE photographers p
SET next_job_number = COALESCE(
  (SELECT MAX(job_number) FROM jobs WHERE photographer_id = p.id),
  0
);

-- Atomic increment function — returns the new number
CREATE OR REPLACE FUNCTION increment_job_number(p_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_number INTEGER;
BEGIN
  UPDATE photographers
  SET next_job_number = next_job_number + 1
  WHERE id = p_id
  RETURNING next_job_number INTO new_number;
  
  RETURN new_number;
END;
$$;

-- Add job_number to jobs table (auto-incrementing per photographer)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number INTEGER;

-- Backfill existing jobs with sequential numbers per photographer
WITH numbered AS (
  SELECT id, photographer_id, ROW_NUMBER() OVER (PARTITION BY photographer_id ORDER BY created_at ASC) as rn
  FROM jobs
  WHERE job_number IS NULL
)
UPDATE jobs SET job_number = numbered.rn
FROM numbered WHERE jobs.id = numbered.id;

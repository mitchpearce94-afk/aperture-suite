-- Add booking_slot_id to jobs so cancellation can free the slot
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS booking_slot_id UUID REFERENCES booking_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_booking_slot ON jobs(booking_slot_id);

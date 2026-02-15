-- Booking Events & Slots system
-- Lets photographers create bookable sessions (e.g. Christmas Minis)
-- with configurable time slots that clients can book from a public page

-- booking_events: The parent event (e.g. "Christmas Mini Sessions 2026")
CREATE TABLE booking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    cover_image_url TEXT,
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    -- Custom pricing override (if null, uses package price)
    custom_price NUMERIC(10,2),
    slot_duration_minutes INTEGER NOT NULL DEFAULT 15,
    buffer_minutes INTEGER NOT NULL DEFAULT 0, -- gap between slots
    max_bookings_per_slot INTEGER NOT NULL DEFAULT 1,
    -- Booking form fields
    require_phone BOOLEAN DEFAULT TRUE,
    require_address BOOLEAN DEFAULT FALSE,
    custom_questions JSONB DEFAULT '[]', -- [{label, type, required}]
    -- Public page settings
    slug TEXT UNIQUE,
    is_published BOOLEAN DEFAULT FALSE,
    accent_color TEXT, -- override brand colour for this event
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
    -- Auto-create job + invoice on booking?
    auto_create_job BOOLEAN DEFAULT TRUE,
    auto_create_invoice BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_events_photographer ON booking_events(photographer_id);
CREATE INDEX idx_booking_events_slug ON booking_events(slug);
CREATE INDEX idx_booking_events_status ON booking_events(photographer_id, status);

-- booking_slots: Individual time slots within an event
CREATE TABLE booking_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES booking_events(id) ON DELETE CASCADE,
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    -- Booking status
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked', 'canceled')),
    -- When booked, links to these
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    -- Client info captured at booking (before client record may exist)
    booked_name TEXT,
    booked_email TEXT,
    booked_phone TEXT,
    booked_answers JSONB DEFAULT '{}', -- answers to custom_questions
    booked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_slots_event ON booking_slots(event_id);
CREATE INDEX idx_booking_slots_date ON booking_slots(event_id, date);
CREATE INDEX idx_booking_slots_status ON booking_slots(event_id, status);
CREATE INDEX idx_booking_slots_photographer ON booking_slots(photographer_id);

-- RLS for booking_events
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_events_select" ON booking_events FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_events_insert" ON booking_events FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_events_update" ON booking_events FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_events_delete" ON booking_events FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Anon access for published events (clients need to see them)
CREATE POLICY "booking_events_anon_select" ON booking_events FOR SELECT TO anon USING (is_published = TRUE AND status = 'published');

-- RLS for booking_slots
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_slots_select" ON booking_slots FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_slots_insert" ON booking_slots FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_slots_update" ON booking_slots FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "booking_slots_delete" ON booking_slots FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Anon can see available slots for published events and update when booking
CREATE POLICY "booking_slots_anon_select" ON booking_slots FOR SELECT TO anon USING (
    event_id IN (SELECT id FROM booking_events WHERE is_published = TRUE AND status = 'published')
);
-- Anon can book available slots (update from available to booked)
CREATE POLICY "booking_slots_anon_book" ON booking_slots FOR UPDATE TO anon USING (
    status = 'available' AND event_id IN (SELECT id FROM booking_events WHERE is_published = TRUE AND status = 'published')
) WITH CHECK (
    status = 'booked'
);

-- Auto-generate slug from title
CREATE OR REPLACE FUNCTION generate_booking_event_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_event_slug_trigger
    BEFORE INSERT ON booking_events
    FOR EACH ROW
    EXECUTE FUNCTION generate_booking_event_slug();

-- Updated_at trigger for booking_events
CREATE OR REPLACE FUNCTION update_booking_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_events_updated_at
    BEFORE UPDATE ON booking_events
    FOR EACH ROW
    EXECUTE FUNCTION update_booking_events_updated_at();

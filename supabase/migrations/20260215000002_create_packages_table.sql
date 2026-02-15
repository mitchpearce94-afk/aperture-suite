-- Create packages table (move from localStorage to Supabase)
-- This stores photographer's service packages for quoting, job creation, and invoicing

CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    duration_hours NUMERIC(4,1) NOT NULL DEFAULT 1,
    included_images INTEGER NOT NULL DEFAULT 50,
    deliverables TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    require_deposit BOOLEAN DEFAULT FALSE,
    deposit_percent INTEGER DEFAULT 25,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_photographer ON packages(photographer_id);
CREATE INDEX idx_packages_active ON packages(photographer_id, is_active);

-- RLS
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_select" ON packages FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "packages_insert" ON packages FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "packages_update" ON packages FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "packages_delete" ON packages FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER packages_updated_at
    BEFORE UPDATE ON packages
    FOR EACH ROW
    EXECUTE FUNCTION update_packages_updated_at();

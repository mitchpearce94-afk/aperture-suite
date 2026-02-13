-- Aperture Suite: Initial Schema Migration
-- Created: 2026-02-13

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PHOTOGRAPHERS (platform users)
-- ============================================
CREATE TABLE photographers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE NOT NULL, -- Links to Supabase auth.users
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    business_name TEXT,
    phone TEXT,
    address JSONB, -- { street, city, state, zip, country }
    brand_settings JSONB DEFAULT '{}', -- { logo_url, colors, fonts, custom_domain }
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'studio', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    stripe_customer_id TEXT,
    timezone TEXT DEFAULT 'Australia/Brisbane',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address JSONB,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    source TEXT, -- referral, website, instagram, facebook, google, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_photographer ON clients(photographer_id);
CREATE INDEX idx_clients_email ON clients(photographer_id, email);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    job_type TEXT,
    preferred_date DATE,
    location TEXT,
    source TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'booked', 'lost')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_photographer ON leads(photographer_id);
CREATE INDEX idx_leads_status ON leads(photographer_id, status);

-- ============================================
-- JOBS / SHOOTS
-- ============================================
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    job_type TEXT,
    title TEXT,
    date DATE,
    end_date DATE, -- For multi-day events
    location TEXT,
    package_name TEXT,
    package_amount DECIMAL(10,2),
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'editing', 'delivered', 'completed', 'canceled')),
    notes TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible extra data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_photographer ON jobs(photographer_id);
CREATE INDEX idx_jobs_date ON jobs(photographer_id, date);
CREATE INDEX idx_jobs_status ON jobs(photographer_id, status);
CREATE INDEX idx_jobs_client ON jobs(client_id);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    invoice_number TEXT,
    amount DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'AUD',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void')),
    due_date DATE,
    paid_date DATE,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    stripe_invoice_id TEXT,
    line_items JSONB DEFAULT '[]', -- [{ description, quantity, unit_price, total }]
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_photographer ON invoices(photographer_id);
CREATE INDEX idx_invoices_status ON invoices(photographer_id, status);

-- ============================================
-- CONTRACTS
-- ============================================
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML template with {{variables}}
    variables JSONB DEFAULT '[]', -- List of variable names used
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
    content TEXT NOT NULL, -- Rendered contract HTML
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed')),
    signed_at TIMESTAMPTZ,
    signature_data JSONB, -- { signature_image, ip_address, user_agent }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_job ON contracts(job_id);

-- ============================================
-- STYLE PROFILES (AI editing)
-- ============================================
CREATE TABLE style_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    reference_image_keys TEXT[] DEFAULT '{}', -- B2 storage keys
    model_weights_key TEXT, -- B2 key for trained model
    settings JSONB DEFAULT '{}', -- { retouch_intensity, auto_crop, cleanup_level, etc. }
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'training', 'ready', 'error')),
    training_started_at TIMESTAMPTZ,
    training_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_style_profiles_photographer ON style_profiles(photographer_id);

-- ============================================
-- GALLERIES
-- ============================================
CREATE TABLE galleries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    slug TEXT, -- URL-friendly identifier
    password_hash TEXT, -- bcrypt hash, nullable for public galleries
    access_type TEXT DEFAULT 'password' CHECK (access_type IN ('password', 'email', 'public', 'private')),
    download_permissions JSONB DEFAULT '{"allow_full_res": true, "allow_web": true, "allow_favorites_only": false}',
    brand_override JSONB, -- Override photographer default branding
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'delivered', 'expired', 'archived')),
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_galleries_photographer ON galleries(photographer_id);
CREATE INDEX idx_galleries_job ON galleries(job_id);
CREATE UNIQUE INDEX idx_galleries_slug ON galleries(slug) WHERE slug IS NOT NULL;

-- ============================================
-- PHOTOS
-- ============================================
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    -- Storage keys (Backblaze B2)
    original_key TEXT NOT NULL,
    edited_key TEXT,
    web_key TEXT,
    thumb_key TEXT,
    watermarked_key TEXT,
    -- File metadata
    filename TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    -- EXIF data
    exif_data JSONB DEFAULT '{}',
    -- AI processing results
    scene_type TEXT,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    face_data JSONB DEFAULT '[]', -- [{ bbox, identity_cluster, expression_score, eyes_open }]
    ai_edits JSONB DEFAULT '{}', -- All AI adjustments applied
    manual_edits JSONB DEFAULT '{}', -- Photographer's manual tweaks
    prompt_edits JSONB DEFAULT '[]', -- [{ prompt, result, timestamp }]
    -- Status and organization
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'edited', 'approved', 'delivered', 'rejected')),
    star_rating INTEGER DEFAULT 0 CHECK (star_rating >= 0 AND star_rating <= 5),
    color_label TEXT,
    is_culled BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE, -- Client favorited
    is_sneak_peek BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    section TEXT, -- Gallery section: ceremony, reception, portraits, etc.
    -- Edit confidence
    edit_confidence INTEGER CHECK (edit_confidence >= 0 AND edit_confidence <= 100),
    needs_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_gallery ON photos(gallery_id);
CREATE INDEX idx_photos_status ON photos(gallery_id, status);
CREATE INDEX idx_photos_sort ON photos(gallery_id, sort_order);

-- ============================================
-- PROCESSING JOBS (AI pipeline tracking)
-- ============================================
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    style_profile_id UUID REFERENCES style_profiles(id) ON DELETE SET NULL,
    total_images INTEGER DEFAULT 0,
    processed_images INTEGER DEFAULT 0,
    current_phase TEXT, -- ingest, style, retouch, cleanup, compose, finalize
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'canceled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_log TEXT,
    settings_override JSONB, -- Per-shoot settings override
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_gallery ON processing_jobs(gallery_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);

-- ============================================
-- WORKFLOW & EMAIL TEMPLATES
-- ============================================
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML with {{variables}}
    variables JSONB DEFAULT '[]',
    category TEXT, -- gallery_delivery, invoice, booking_confirmation, marketing, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE questionnaire_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fields JSONB NOT NULL, -- [{ type, label, required, options }]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photographer_id UUID NOT NULL REFERENCES photographers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- lead_created, job_booked, gallery_delivered, invoice_paid, etc.
    steps JSONB NOT NULL DEFAULT '[]', -- [{ type, delay_days, template_id, conditions }]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflows_photographer ON workflows(photographer_id);
CREATE INDEX idx_workflows_trigger ON workflows(trigger_type);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()',
            t, t);
    END LOOP;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE photographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Photographers can only see their own data
CREATE POLICY "photographers_own_data" ON photographers
    FOR ALL USING (auth_user_id = auth.uid());

-- All other tables: photographer_id must match
CREATE POLICY "clients_own_data" ON clients
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "leads_own_data" ON leads
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "jobs_own_data" ON jobs
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "invoices_own_data" ON invoices
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "contracts_own_data" ON contracts
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "contract_templates_own_data" ON contract_templates
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "style_profiles_own_data" ON style_profiles
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "galleries_own_data" ON galleries
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "photos_own_data" ON photos
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "processing_jobs_own_data" ON processing_jobs
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "email_templates_own_data" ON email_templates
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "questionnaire_templates_own_data" ON questionnaire_templates
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

CREATE POLICY "workflows_own_data" ON workflows
    FOR ALL USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

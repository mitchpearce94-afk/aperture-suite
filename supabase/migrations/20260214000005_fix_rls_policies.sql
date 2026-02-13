-- Fix RLS policies: the original "FOR ALL USING" policies don't cover INSERT
-- because INSERT requires WITH CHECK, not just USING.
-- This migration drops the old policies and recreates them properly.

-- Photographers
DROP POLICY IF EXISTS "photographers_own_data" ON photographers;
DROP POLICY IF EXISTS "photographers_insert_own" ON photographers;
DROP POLICY IF EXISTS "photographers_update_own" ON photographers;
CREATE POLICY "photographers_select" ON photographers FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "photographers_insert" ON photographers FOR INSERT WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "photographers_update" ON photographers FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "photographers_delete" ON photographers FOR DELETE USING (auth_user_id = auth.uid());

-- Clients
DROP POLICY IF EXISTS "clients_own_data" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Leads
DROP POLICY IF EXISTS "leads_own_data" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Jobs
DROP POLICY IF EXISTS "jobs_own_data" ON jobs;
CREATE POLICY "jobs_select" ON jobs FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "jobs_insert" ON jobs FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "jobs_update" ON jobs FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "jobs_delete" ON jobs FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Invoices
DROP POLICY IF EXISTS "invoices_own_data" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Galleries
DROP POLICY IF EXISTS "galleries_own_data" ON galleries;
CREATE POLICY "galleries_select" ON galleries FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "galleries_insert" ON galleries FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "galleries_update" ON galleries FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "galleries_delete" ON galleries FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Photos
DROP POLICY IF EXISTS "photos_own_data" ON photos;
CREATE POLICY "photos_select" ON photos FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Style Profiles
DROP POLICY IF EXISTS "style_profiles_own_data" ON style_profiles;
CREATE POLICY "style_profiles_select" ON style_profiles FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "style_profiles_insert" ON style_profiles FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "style_profiles_update" ON style_profiles FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "style_profiles_delete" ON style_profiles FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Contracts
DROP POLICY IF EXISTS "contracts_own_data" ON contracts;
CREATE POLICY "contracts_select" ON contracts FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "contracts_insert" ON contracts FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "contracts_update" ON contracts FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "contracts_delete" ON contracts FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Workflows
DROP POLICY IF EXISTS "workflows_own_data" ON workflows;
CREATE POLICY "workflows_select" ON workflows FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "workflows_insert" ON workflows FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "workflows_update" ON workflows FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "workflows_delete" ON workflows FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Processing Jobs
DROP POLICY IF EXISTS "processing_jobs_own_data" ON processing_jobs;
CREATE POLICY "processing_jobs_select" ON processing_jobs FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "processing_jobs_insert" ON processing_jobs FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "processing_jobs_update" ON processing_jobs FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "processing_jobs_delete" ON processing_jobs FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

-- Email Templates
DROP POLICY IF EXISTS "email_templates_own_data" ON email_templates;
CREATE POLICY "email_templates_select" ON email_templates FOR SELECT USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "email_templates_insert" ON email_templates FOR INSERT WITH CHECK (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "email_templates_update" ON email_templates FOR UPDATE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));
CREATE POLICY "email_templates_delete" ON email_templates FOR DELETE USING (photographer_id IN (SELECT id FROM photographers WHERE auth_user_id = auth.uid()));

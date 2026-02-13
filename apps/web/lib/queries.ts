import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Client, Lead, Job, Invoice, Gallery, Photographer } from '@/lib/types';

const supabase = () => createSupabaseClient();

// ============================================
// Photographer
// ============================================

export async function getCurrentPhotographer(): Promise<Photographer | null> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb
    .from('photographers')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching photographer:', error);
    return null;
  }
  return data;
}

// ============================================
// Clients
// ============================================

export async function getClients(): Promise<Client[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
  return data || [];
}

export async function getClient(id: string): Promise<Client | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }
  return data;
}

export async function createClient(client: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  notes?: string;
  photographer_id: string;
}): Promise<Client | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('clients')
    .insert(client)
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }
  return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating client:', error);
    return null;
  }
  return data;
}

export async function deleteClient(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting client:', error);
    return false;
  }
  return true;
}

// ============================================
// Leads
// ============================================

export async function getLeads(): Promise<Lead[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('leads')
    .select('*, client:clients(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
  return data || [];
}

export async function createLead(lead: {
  photographer_id: string;
  client_id?: string;
  job_type?: string;
  preferred_date?: string;
  location?: string;
  source?: string;
  status?: string;
  notes?: string;
}): Promise<Lead | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('leads')
    .insert(lead)
    .select('*, client:clients(*)')
    .single();

  if (error) {
    console.error('Error creating lead:', error);
    return null;
  }
  return data;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select('*, client:clients(*)')
    .single();

  if (error) {
    console.error('Error updating lead:', error);
    return null;
  }
  return data;
}

export async function deleteLead(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('leads').delete().eq('id', id);
  if (error) {
    console.error('Error deleting lead:', error);
    return false;
  }
  return true;
}

// ============================================
// Jobs
// ============================================

export async function getJobs(): Promise<Job[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('jobs')
    .select('*, client:clients(*)')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
  return data || [];
}

export async function createJob(job: {
  photographer_id: string;
  client_id?: string;
  lead_id?: string;
  job_type?: string;
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  location?: string;
  package_name?: string;
  package_amount?: number;
  status?: string;
  notes?: string;
}): Promise<Job | null> {
  const sb = supabase();

  // Atomically increment and get next job number from photographer record
  const { data: photographer, error: pError } = await sb.rpc('increment_job_number', {
    p_id: job.photographer_id,
  });

  // Fallback if RPC doesn't exist yet — use read-then-write
  let nextNumber: number;
  if (pError || photographer === null || photographer === undefined) {
    const { data: pg } = await sb
      .from('photographers')
      .select('next_job_number')
      .eq('id', job.photographer_id)
      .single();
    nextNumber = (pg?.next_job_number || 0) + 1;
    await sb
      .from('photographers')
      .update({ next_job_number: nextNumber })
      .eq('id', job.photographer_id);
  } else {
    nextNumber = photographer;
  }

  const { data, error } = await sb
    .from('jobs')
    .insert({ ...job, job_number: nextNumber })
    .select('*, client:clients(*)')
    .single();

  if (error) {
    console.error('Error creating job:', error);
    return null;
  }
  return data;
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select('*, client:clients(*)')
    .single();

  if (error) {
    console.error('Error updating job:', error);
    return null;
  }
  return data;
}

export async function deleteJob(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('jobs').delete().eq('id', id);
  if (error) {
    console.error('Error deleting job:', error);
    return false;
  }
  return true;
}

// ============================================
// Invoices
// ============================================

export async function getInvoices(): Promise<Invoice[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('invoices')
    .select('*, client:clients(*), job:jobs(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
  return data || [];
}

export async function createInvoice(invoice: {
  photographer_id: string;
  client_id?: string;
  job_id?: string;
  invoice_number?: string;
  invoice_type?: string;
  amount: number;
  tax: number;
  total: number;
  currency?: string;
  status?: string;
  due_date?: string;
  line_items?: { description: string; quantity: number; unit_price: number; total: number }[];
  notes?: string;
}): Promise<Invoice | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('invoices')
    .insert(invoice)
    .select('*, client:clients(*), job:jobs(*)')
    .single();

  if (error) {
    console.error('Error creating invoice:', error);
    return null;
  }
  return data;
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select('*, client:clients(*), job:jobs(*)')
    .single();

  if (error) {
    console.error('Error updating invoice:', error);
    return null;
  }
  return data;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('invoices').delete().eq('id', id);
  if (error) {
    console.error('Error deleting invoice:', error);
    return false;
  }
  return true;
}

// ============================================
// Galleries
// ============================================

export async function getGalleries(): Promise<Gallery[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('galleries')
    .select('*, client:clients(*), job:jobs(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching galleries:', error);
    return [];
  }
  return data || [];
}

// ============================================
// Dashboard Stats
// ============================================

export async function getDashboardStats() {
  const sb = supabase();

  const [
    { count: clientCount },
    { data: leads },
    { data: jobs },
    { data: invoices },
    { data: galleries },
  ] = await Promise.all([
    sb.from('clients').select('*', { count: 'exact', head: true }),
    sb.from('leads').select('id, status'),
    sb.from('jobs').select('id, status, date, package_amount'),
    sb.from('invoices').select('id, status, total, paid_amount'),
    sb.from('galleries').select('id, status'),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const paidInvoices = invoices?.filter((i) => i.status === 'paid') || [];
  const revenueMonth = paidInvoices
    .filter((i) => i.paid_amount)
    .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);

  return {
    total_clients: clientCount || 0,
    pending_leads: leads?.filter((l) => l.status === 'new' || l.status === 'contacted').length || 0,
    active_jobs: jobs?.filter((j) => j.status === 'upcoming' || j.status === 'in_progress' || j.status === 'editing').length || 0,
    upcoming_shoots: jobs?.filter((j) => j.status === 'upcoming').length || 0,
    overdue_invoices: invoices?.filter((i) => i.status === 'overdue').length || 0,
    revenue_month: revenueMonth,
    galleries_delivered: galleries?.filter((g) => g.status === 'delivered').length || 0,
  };
}

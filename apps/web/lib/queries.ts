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

  if (error || !data) {
    // Auto-create photographer profile if it doesn't exist
    // This handles cases where signup profile creation failed (RLS, network, etc.)
    console.warn('Photographer profile not found, attempting to create...');
    const meta = user.user_metadata || {};
    const name = meta?.full_name || meta?.name || 
      `${meta?.first_name || ''} ${meta?.last_name || ''}`.trim() || 
      user.email?.split('@')[0] || 'Photographer';
    
    const { data: newProfile, error: createError } = await sb
      .from('photographers')
      .insert({
        auth_user_id: user.id,
        email: user.email,
        name,
        business_name: null,
        subscription_tier: 'free',
        subscription_status: 'trialing',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating photographer profile:', createError);
      return null;
    }
    return newProfile;
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

export async function createNewClient(client: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  tags?: string[];
  source?: string;
  notes?: string;
}): Promise<Client | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create client');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('clients')
    .insert({
      ...client,
      photographer_id: photographer.id,
    })
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
  const { error } = await sb.from('clients').delete().eq('id', id);
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
    .select('*, client:clients(first_name, last_name, email, phone)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
  return data || [];
}

export async function createLead(lead: {
  client_id?: string;
  status?: string;
  job_type?: string;
  preferred_date?: string;
  location?: string;
  package_name?: string;
  estimated_value?: number;
  source?: string;
  notes?: string;
}): Promise<Lead | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create lead');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('leads')
    .insert({
      ...lead,
      photographer_id: photographer.id,
      status: lead.status || 'new',
    })
    .select('*, client:clients(first_name, last_name, email, phone)')
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
    .select('*, client:clients(first_name, last_name, email, phone)')
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
    .select('*, client:clients(first_name, last_name, email, phone)')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
  return data || [];
}

export async function createJob(job: {
  client_id?: string;
  title?: string;
  job_type?: string;
  status?: string;
  date?: string;
  time?: string;
  end_time?: string;
  location?: string;
  package_name?: string;
  package_amount?: number;
  included_images?: number;
  notes?: string;
}): Promise<Job | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create job');
    return null;
  }

  // Get next job number via atomic increment
  const sb = supabase();
  let jobNumber: number;
  
  const { data: rpcData, error: rpcError } = await sb.rpc('increment_job_number', {
    p_id: photographer.id,
  });

  if (rpcError || !rpcData) {
    // Fallback: query max job number
    console.warn('RPC failed, falling back to max query:', rpcError);
    const { data: maxJob } = await sb
      .from('jobs')
      .select('job_number')
      .eq('photographer_id', photographer.id)
      .order('job_number', { ascending: false })
      .limit(1)
      .single();
    jobNumber = (maxJob?.job_number || 0) + 1;
  } else {
    jobNumber = rpcData;
  }

  const { data, error } = await sb
    .from('jobs')
    .insert({
      ...job,
      photographer_id: photographer.id,
      job_number: jobNumber,
      status: job.status || 'upcoming',
    })
    .select('*, client:clients(first_name, last_name, email, phone)')
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
    .select('*, client:clients(first_name, last_name, email, phone)')
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
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
  return data || [];
}

export async function createInvoice(invoice: {
  client_id?: string;
  job_id?: string;
  invoice_number: string;
  invoice_type?: string;
  status?: string;
  amount: number;
  tax: number;
  total: number;
  currency?: string;
  line_items: any[];
  due_date?: string;
  notes?: string;
}): Promise<Invoice | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create invoice');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('invoices')
    .insert({
      ...invoice,
      photographer_id: photographer.id,
      status: invoice.status || 'draft',
      invoice_type: invoice.invoice_type || 'custom',
    })
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number)')
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
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number)')
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
    .select('*, client:clients(first_name, last_name), job:jobs(title)')
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
  
  const [clients, leads, jobs, invoices] = await Promise.all([
    sb.from('clients').select('id', { count: 'exact' }),
    sb.from('leads').select('id, status', { count: 'exact' }),
    sb.from('jobs').select('id, status, package_amount, date, time, end_time, title, client:clients(first_name, last_name)', { count: 'exact' }),
    sb.from('invoices').select('id, status, total'),
  ]);

  const totalRevenue = (invoices.data || [])
    .filter((i: any) => i.status === 'paid')
    .reduce((sum: number, i: any) => sum + (i.total || 0), 0);

  const activeLeads = (leads.data || []).filter((l: any) => !['lost', 'booked'].includes(l.status)).length;

  const upcomingJobs = (jobs.data || [])
    .filter((j: any) => j.status === 'upcoming' && j.date)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return {
    totalClients: clients.count || 0,
    totalLeads: leads.count || 0,
    activeLeads,
    totalJobs: jobs.count || 0,
    totalRevenue,
    upcomingJobs,
  };
}

// ============================================
// Job end time sync (when package duration changes)
// ============================================

export async function syncJobEndTimes(packageName: string, durationHours: number): Promise<number> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) return 0;

  const sb = supabase();
  const { data: jobs } = await sb
    .from('jobs')
    .select('id, time')
    .eq('photographer_id', photographer.id)
    .eq('package_name', packageName)
    .not('time', 'is', null);

  if (!jobs || jobs.length === 0) return 0;

  let updated = 0;
  for (const job of jobs) {
    if (!job.time) continue;
    const [hours, minutes] = job.time.split(':').map(Number);
    const endHours = hours + durationHours;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    const { error } = await sb
      .from('jobs')
      .update({ end_time: endTime })
      .eq('id', job.id);
    
    if (!error) updated++;
  }

  return updated;
}

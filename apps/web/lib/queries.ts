import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Client, Lead, Job, Invoice, Gallery, Photographer, Photo, ProcessingJob, StyleProfile, Package, BookingEvent, BookingSlot } from '@/lib/types';

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

// ============================================
// Processing Jobs
// ============================================

export async function getProcessingJobs(): Promise<ProcessingJob[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('processing_jobs')
    .select('*, gallery:galleries(title, job_id, job:jobs(title, job_number, client:clients(first_name, last_name)))')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching processing jobs:', error);
    return [];
  }
  return data || [];
}

export async function createProcessingJob(processingJob: {
  gallery_id: string;
  style_profile_id?: string;
  total_images: number;
  settings_override?: Record<string, unknown>;
}): Promise<ProcessingJob | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create processing job');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('processing_jobs')
    .insert({
      ...processingJob,
      photographer_id: photographer.id,
      status: 'queued',
      processed_images: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating processing job:', error);
    return null;
  }
  return data;
}

export async function updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('processing_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating processing job:', error);
    return null;
  }
  return data;
}

// ============================================
// Photos
// ============================================

export async function getPhotos(galleryId: string): Promise<Photo[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('photos')
    .select('*')
    .eq('gallery_id', galleryId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
  return data || [];
}

export async function updatePhoto(id: string, updates: Partial<Photo>): Promise<Photo | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('photos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating photo:', error);
    return null;
  }
  return data;
}

export async function bulkUpdatePhotos(ids: string[], updates: Partial<Photo>): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb
    .from('photos')
    .update(updates)
    .in('id', ids);

  if (error) {
    console.error('Error bulk updating photos:', error);
    return false;
  }
  return true;
}

// ============================================
// Style Profiles
// ============================================

export async function getStyleProfiles(): Promise<StyleProfile[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('style_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching style profiles:', error);
    return [];
  }
  return data || [];
}

export async function createStyleProfile(profile: {
  name: string;
  description?: string;
  settings?: Record<string, unknown>;
}): Promise<StyleProfile | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create style profile');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('style_profiles')
    .insert({
      ...profile,
      photographer_id: photographer.id,
      status: 'pending',
      reference_image_keys: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating style profile:', error);
    return null;
  }
  return data;
}

export async function updateStyleProfile(id: string, updates: Partial<StyleProfile>): Promise<StyleProfile | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('style_profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating style profile:', error);
    return null;
  }
  return data;
}

export async function deleteStyleProfile(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('style_profiles').delete().eq('id', id);
  if (error) {
    console.error('Error deleting style profile:', error);
    return false;
  }
  return true;
}

// ============================================
// Jobs with editing status (for Auto Editor page)
// ============================================

export async function getEditingJobs(): Promise<Job[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('jobs')
    .select('*, client:clients(first_name, last_name, email, phone)')
    .in('status', ['editing', 'delivered', 'completed'])
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching editing jobs:', error);
    return [];
  }
  return data || [];
}

// ============================================
// Storage & Photo Upload
// ============================================

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  photoId?: string;
}

export async function uploadPhotoToStorage(
  file: File,
  photographerId: string,
  galleryId: string,
  onProgress?: (progress: number) => void
): Promise<{ storageKey: string; publicUrl: string } | null> {
  const sb = supabase();

  // Path: photos/{photographer_id}/{gallery_id}/originals/{filename}
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storageKey = `${photographerId}/${galleryId}/originals/${timestamp}_${safeName}`;

  const { data, error } = await sb.storage
    .from('photos')
    .upload(storageKey, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  // Get the path (not public URL since bucket is private)
  return {
    storageKey: data.path,
    publicUrl: '', // Private bucket — will use signed URLs when needed
  };
}

export async function createPhotoRecord(photo: {
  gallery_id: string;
  original_key: string;
  filename: string;
  file_size: number;
  mime_type: string;
  sort_order: number;
}): Promise<Photo | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create photo');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('photos')
    .insert({
      ...photo,
      photographer_id: photographer.id,
      status: 'uploaded',
      star_rating: 0,
      is_culled: false,
      is_favorite: false,
      is_sneak_peek: false,
      needs_review: false,
      exif_data: {},
      face_data: [],
      ai_edits: {},
      manual_edits: {},
      prompt_edits: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating photo record:', error);
    return null;
  }
  return data;
}

export async function createGalleryForJob(jobId: string, title: string): Promise<Gallery | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create gallery');
    return null;
  }

  // Get the job to find client_id
  const sb = supabase();
  const { data: job } = await sb.from('jobs').select('client_id').eq('id', jobId).single();

  // Use photographer's global gallery defaults
  const p = photographer as any;
  const defaultAccessType = p.gallery_default_access_type || 'password';
  const defaultExpiryDays = p.gallery_default_expiry_days ?? 30;
  const defaultDownloadFullRes = p.gallery_default_download_full_res ?? true;
  const defaultDownloadWeb = p.gallery_default_download_web ?? true;

  const expiresAt = defaultExpiryDays > 0
    ? new Date(Date.now() + defaultExpiryDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await sb
    .from('galleries')
    .insert({
      photographer_id: photographer.id,
      job_id: jobId,
      client_id: job?.client_id || null,
      title,
      status: 'ready',
      access_type: defaultAccessType,
      view_count: 0,
      expires_at: expiresAt,
      download_permissions: {
        allow_full_res: defaultDownloadFullRes,
        allow_web: defaultDownloadWeb,
        allow_favorites_only: false,
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating gallery:', error);
    return null;
  }
  return data;
}

export async function getGallery(id: string): Promise<Gallery | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('galleries')
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number, date)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching gallery:', error);
    return null;
  }
  return data;
}

export async function getGalleryBySlug(slug: string): Promise<Gallery | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('galleries')
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number)')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching gallery by slug:', error);
    return null;
  }
  return data;
}

export async function getGalleryPhotos(galleryId: string): Promise<Photo[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('photos')
    .select('*')
    .eq('gallery_id', galleryId)
    .in('status', ['edited', 'approved', 'delivered'])
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching gallery photos:', error);
    return [];
  }
  return data || [];
}

export async function updateGallery(id: string, updates: Partial<Gallery>): Promise<Gallery | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('galleries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating gallery:', error);
    return null;
  }
  return data;
}

export async function deliverGallery(id: string): Promise<Gallery | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('galleries')
    .update({
      status: 'delivered',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, client:clients(first_name, last_name, email), job:jobs(title, job_number)')
    .single();

  if (error) {
    console.error('Error delivering gallery:', error);
    return null;
  }
  return data;
}

export async function incrementGalleryViews(id: string): Promise<void> {
  const sb = supabase();
  // Use RPC or raw update — increment view_count
  await sb.rpc('increment_gallery_views', { gallery_id: id });
}

export async function togglePhotoFavorite(photoId: string, isFavorite: boolean): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb
    .from('photos')
    .update({ is_favorite: isFavorite })
    .eq('id', photoId);

  if (error) {
    console.error('Error toggling favorite:', error);
    return false;
  }
  return true;
}

export async function getPhotographerBranding(photographerId: string): Promise<{ business_name?: string; brand_settings: any; logo_url?: string } | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('photographers')
    .select('business_name, brand_settings')
    .eq('id', photographerId)
    .single();

  if (error) {
    console.error('Error fetching branding:', error);
    return null;
  }
  return data;
}

export async function getUploadableJobs(): Promise<Job[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('jobs')
    .select('*, client:clients(first_name, last_name)')
    .in('status', ['upcoming', 'in_progress'])
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching uploadable jobs:', error);
    return [];
  }
  return data || [];
}

// ============================================
// Packages
// ============================================

export async function getPackages(activeOnly = false): Promise<Package[]> {
  const sb = supabase();
  let query = sb
    .from('packages')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching packages:', error);
    return [];
  }
  return data || [];
}

export async function createPackage(pkg: {
  name: string;
  description?: string;
  price: number;
  duration_hours: number;
  included_images: number;
  deliverables?: string;
  is_active?: boolean;
  require_deposit?: boolean;
  deposit_percent?: number;
  sort_order?: number;
}): Promise<Package | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create package');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('packages')
    .insert({
      ...pkg,
      photographer_id: photographer.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating package:', error);
    return null;
  }
  return data;
}

export async function updatePackage(id: string, updates: Partial<Package>): Promise<Package | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('packages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating package:', error);
    return null;
  }
  return data;
}

export async function deletePackage(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('packages').delete().eq('id', id);
  if (error) {
    console.error('Error deleting package:', error);
    return false;
  }
  return true;
}

// ============================================
// Booking Events
// ============================================

export async function getBookingEvents(): Promise<BookingEvent[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('booking_events')
    .select('*, package:packages(id, name, price, duration_hours, included_images, require_deposit, deposit_percent)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching booking events:', error);
    return [];
  }
  return data || [];
}

export async function getBookingEvent(id: string): Promise<BookingEvent | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('booking_events')
    .select('*, package:packages(id, name, price, duration_hours, included_images, require_deposit, deposit_percent)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching booking event:', error);
    return null;
  }
  return data;
}

export async function createBookingEvent(event: {
  title: string;
  description?: string;
  location?: string;
  package_id?: string;
  custom_price?: number;
  slot_duration_minutes?: number;
  buffer_minutes?: number;
  max_bookings_per_slot?: number;
  require_phone?: boolean;
  require_address?: boolean;
  custom_questions?: any[];
  accent_color?: string;
  auto_create_job?: boolean;
  auto_create_invoice?: boolean;
}): Promise<BookingEvent | null> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create booking event');
    return null;
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('booking_events')
    .insert({
      ...event,
      photographer_id: photographer.id,
      status: 'draft',
      is_published: false,
    })
    .select('*, package:packages(id, name, price, duration_hours, included_images, require_deposit, deposit_percent)')
    .single();

  if (error) {
    console.error('Error creating booking event:', error);
    return null;
  }
  return data;
}

export async function updateBookingEvent(id: string, updates: Partial<BookingEvent>): Promise<BookingEvent | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('booking_events')
    .update(updates)
    .eq('id', id)
    .select('*, package:packages(id, name, price, duration_hours, included_images, require_deposit, deposit_percent)')
    .single();

  if (error) {
    console.error('Error updating booking event:', error);
    return null;
  }
  return data;
}

export async function deleteBookingEvent(id: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('booking_events').delete().eq('id', id);
  if (error) {
    console.error('Error deleting booking event:', error);
    return false;
  }
  return true;
}

// ============================================
// Booking Slots
// ============================================

export async function getBookingSlots(eventId: string): Promise<BookingSlot[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from('booking_slots')
    .select('*')
    .eq('event_id', eventId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching booking slots:', error);
    return [];
  }
  return data || [];
}

export async function createBookingSlots(slots: {
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
}[]): Promise<BookingSlot[]> {
  const photographer = await getCurrentPhotographer();
  if (!photographer) {
    console.error('No photographer profile found — cannot create booking slots');
    return [];
  }

  const sb = supabase();
  const { data, error } = await sb
    .from('booking_slots')
    .insert(slots.map((s) => ({
      ...s,
      photographer_id: photographer.id,
      status: 'available',
    })))
    .select();

  if (error) {
    console.error('Error creating booking slots:', error);
    return [];
  }
  return data || [];
}

export async function updateBookingSlot(id: string, updates: Partial<BookingSlot>): Promise<BookingSlot | null> {
  const sb = supabase();
  const { data, error } = await sb
    .from('booking_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating booking slot:', error);
    return null;
  }
  return data;
}

export async function deleteBookingSlots(eventId: string): Promise<boolean> {
  const sb = supabase();
  const { error } = await sb.from('booking_slots').delete().eq('event_id', eventId);
  if (error) {
    console.error('Error deleting booking slots:', error);
    return false;
  }
  return true;
}


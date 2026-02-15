// ============================================
// Core Data Types — Apelier
// ============================================

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'studio' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export interface Photographer {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  business_name?: string;
  phone?: string;
  address?: Address;
  brand_settings: BrandSettings;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string;
  timezone: string;
  contract_template?: string;
  signature_image?: string;
  next_job_number: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface BrandSettings {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_heading?: string;
  font_body?: string;
  custom_domain?: string;
}

// ============================================
// Packages
// ============================================

export interface Package {
  id: string;
  photographer_id: string;
  name: string;
  description: string;
  price: number;
  duration_hours: number;
  included_images: number;
  deliverables: string;
  is_active: boolean;
  require_deposit: boolean;
  deposit_percent: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Booking Events & Slots
// ============================================

export type BookingEventStatus = 'draft' | 'published' | 'closed' | 'archived';
export type BookingSlotStatus = 'available' | 'booked' | 'blocked' | 'canceled';

export interface BookingEvent {
  id: string;
  photographer_id: string;
  title: string;
  description: string;
  location: string;
  cover_image_url?: string;
  package_id?: string;
  package?: Package;
  custom_price?: number;
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_bookings_per_slot: number;
  require_phone: boolean;
  require_address: boolean;
  custom_questions: CustomQuestion[];
  slug?: string;
  is_published: boolean;
  accent_color?: string;
  status: BookingEventStatus;
  auto_create_job: boolean;
  auto_create_invoice: boolean;
  created_at: string;
  updated_at: string;
  // Computed / joined
  slots?: BookingSlot[];
  total_slots?: number;
  booked_slots?: number;
}

export interface BookingSlot {
  id: string;
  event_id: string;
  photographer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: BookingSlotStatus;
  client_id?: string;
  job_id?: string;
  booked_name?: string;
  booked_email?: string;
  booked_phone?: string;
  booked_answers: Record<string, string>;
  booked_at?: string;
  created_at: string;
  // Joined
  event?: BookingEvent;
}

export interface CustomQuestion {
  label: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[]; // for select type
}

// ============================================
// CRM Types
// ============================================

export interface Client {
  id: string;
  photographer_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: Address;
  notes?: string;
  tags: string[];
  source?: string;
  created_at: string;
  updated_at: string;
  // Computed / joined
  full_name?: string;
  jobs_count?: number;
  total_revenue?: number;
}

export type LeadStatus = 'new' | 'contacted' | 'quoted' | 'booked' | 'lost';

export interface Lead {
  id: string;
  photographer_id: string;
  client_id?: string;
  client?: Client;
  job_type?: string;
  preferred_date?: string;
  location?: string;
  source?: string;
  status: LeadStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type JobStatus = 'upcoming' | 'in_progress' | 'editing' | 'ready_for_review' | 'delivered' | 'completed' | 'canceled';

export interface Job {
  id: string;
  photographer_id: string;
  client_id?: string;
  client?: Client;
  lead_id?: string;
  gallery_id?: string;
  job_number?: number;
  job_type?: string;
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  end_date?: string;
  location?: string;
  package_name?: string;
  package_amount?: number;
  status: JobStatus;
  notes?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type InvoiceType = 'deposit' | 'final' | 'custom';

export interface Invoice {
  id: string;
  photographer_id: string;
  job_id?: string;
  client_id?: string;
  client?: Client;
  job?: Job;
  invoice_number?: string;
  invoice_type?: InvoiceType;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  due_date?: string;
  paid_date?: string;
  paid_amount: number;
  stripe_invoice_id?: string;
  line_items: LineItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed';

export interface Contract {
  id: string;
  photographer_id: string;
  job_id?: string;
  client_id?: string;
  client?: Client;
  job?: Job;
  template_id?: string;
  content: string;
  status: ContractStatus;
  signing_token?: string;
  sent_at?: string;
  viewed_at?: string;
  expires_at?: string;
  signed_at?: string;
  signature_data?: {
    signature_image: string;
    ip_address: string;
    user_agent: string;
    photographer_signature?: string;
  };
  created_at: string;
}

// ============================================
// Gallery & AI Types
// ============================================

export type GalleryStatus = 'processing' | 'ready' | 'delivered' | 'expired' | 'archived';
export type GalleryAccessType = 'password' | 'email' | 'public' | 'private';

export interface Gallery {
  id: string;
  photographer_id: string;
  job_id?: string;
  client_id?: string;
  client?: Client;
  job?: Job;
  title: string;
  description?: string;
  slug?: string;
  access_type: GalleryAccessType;
  download_permissions: DownloadPermissions;
  brand_override?: BrandSettings;
  expires_at?: string;
  status: GalleryStatus;
  view_count: number;
  photo_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DownloadPermissions {
  allow_full_res: boolean;
  allow_web: boolean;
  allow_favorites_only: boolean;
}

export type PhotoStatus = 'uploaded' | 'processing' | 'edited' | 'approved' | 'delivered' | 'rejected';

export interface Photo {
  id: string;
  gallery_id: string;
  photographer_id: string;
  original_key: string;
  edited_key?: string;
  web_key?: string;
  thumb_key?: string;
  watermarked_key?: string;
  filename: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  exif_data: Record<string, unknown>;
  scene_type?: string;
  quality_score?: number;
  face_data: FaceData[];
  ai_edits: Record<string, unknown>;
  manual_edits: Record<string, unknown>;
  prompt_edits: PromptEdit[];
  status: PhotoStatus;
  star_rating: number;
  color_label?: string;
  is_culled: boolean;
  is_favorite: boolean;
  is_sneak_peek: boolean;
  sort_order: number;
  section?: string;
  edit_confidence?: number;
  needs_review: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceData {
  bbox: [number, number, number, number];
  identity_cluster?: string;
  expression_score?: number;
  eyes_open?: boolean;
}

export interface PromptEdit {
  prompt: string;
  result: string;
  timestamp: string;
  confidence?: number;
}

export type StyleProfileStatus = 'pending' | 'training' | 'ready' | 'error';

export interface StyleProfile {
  id: string;
  photographer_id: string;
  name: string;
  description?: string;
  reference_image_keys: string[];
  model_weights_key?: string;
  settings: StyleSettings;
  status: StyleProfileStatus;
  training_started_at?: string;
  training_completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StyleSettings {
  retouch_intensity?: 'off' | 'light' | 'medium' | 'heavy';
  auto_crop?: boolean;
  cleanup_level?: 'off' | 'conservative' | 'moderate' | 'aggressive';
  skin_smoothing?: number; // 0-100
  blemish_removal?: boolean;
  stray_hair_cleanup?: boolean;
  eye_enhancement?: boolean;
  teeth_whitening?: boolean;
  background_person_removal?: 'off' | 'flag' | 'auto';
  distraction_removal?: 'off' | 'flag' | 'auto';
  power_line_removal?: boolean;
  horizon_correction?: boolean;
}

export type ProcessingJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';

export interface ProcessingJob {
  id: string;
  gallery_id: string;
  photographer_id: string;
  style_profile_id?: string;
  total_images: number;
  processed_images: number;
  current_phase?: string;
  status: ProcessingJobStatus;
  started_at?: string;
  completed_at?: string;
  error_log?: string;
  created_at: string;
}

// ============================================
// Workflow Types
// ============================================

export interface Workflow {
  id: string;
  photographer_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  steps: WorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  type: 'email' | 'task' | 'wait' | 'update_status';
  delay_days?: number;
  template_id?: string;
  conditions?: Record<string, unknown>;
  description?: string;
}

// ============================================
// Dashboard / Stats Types
// ============================================

export interface DashboardStats {
  total_revenue_month: number;
  total_revenue_year: number;
  active_jobs: number;
  pending_leads: number;
  upcoming_shoots: number;
  overdue_invoices: number;
  galleries_delivered: number;
  photos_processed: number;
}

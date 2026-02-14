import type { ProcessingJob, StyleProfile, Photo } from '@/lib/types';

export const PHASES = [
  { id: 'analysis', label: 'Analysis', description: 'Scene detection, quality scoring, duplicate grouping' },
  { id: 'style', label: 'Style', description: 'Applying your trained editing style' },
  { id: 'retouch', label: 'Retouch', description: 'Face & skin retouching' },
  { id: 'cleanup', label: 'Cleanup', description: 'Background & distraction removal' },
  { id: 'compose', label: 'Compose', description: 'Horizon, crop & composition' },
  { id: 'finalize', label: 'QA & Output', description: 'Quality check & output generation' },
];

export type ProcessingJobWithGallery = ProcessingJob & {
  gallery?: {
    title: string;
    job?: {
      title: string;
      job_number: number;
      client?: { first_name: string; last_name?: string };
    };
  };
};

export function generateMockProcessingJobs(): ProcessingJobWithGallery[] {
  return [
    {
      id: 'pj-1',
      gallery_id: 'g-1',
      photographer_id: 'p-1',
      style_profile_id: 'sp-1',
      total_images: 342,
      processed_images: 342,
      current_phase: 'finalize',
      status: 'completed',
      started_at: '2026-02-13T09:00:00Z',
      completed_at: '2026-02-13T09:47:00Z',
      created_at: '2026-02-13T08:55:00Z',
      gallery: {
        title: 'Sarah & James — Wedding',
        job: { title: 'Wedding Photography', job_number: 1, client: { first_name: 'Sarah', last_name: 'Mitchell' } },
      },
    },
    {
      id: 'pj-2',
      gallery_id: 'g-2',
      photographer_id: 'p-1',
      style_profile_id: 'sp-1',
      total_images: 156,
      processed_images: 89,
      current_phase: 'retouch',
      status: 'processing',
      started_at: '2026-02-14T14:30:00Z',
      created_at: '2026-02-14T14:25:00Z',
      gallery: {
        title: 'Emma Chen — Portraits',
        job: { title: 'Portrait Session', job_number: 3, client: { first_name: 'Emma', last_name: 'Chen' } },
      },
    },
    {
      id: 'pj-3',
      gallery_id: 'g-3',
      photographer_id: 'p-1',
      total_images: 210,
      processed_images: 0,
      current_phase: undefined,
      status: 'queued',
      created_at: '2026-02-14T15:00:00Z',
      gallery: {
        title: 'Corporate Headshots — Meridian Law',
        job: { title: 'Corporate Headshots', job_number: 5, client: { first_name: 'David', last_name: 'Park' } },
      },
    },
  ];
}

export function generateMockPhotos(): Photo[] {
  const scenes = ['ceremony', 'reception', 'portraits', 'details', 'getting-ready', 'first-dance'];
  const statuses: Photo['status'][] = ['edited', 'edited', 'edited', 'edited', 'edited', 'approved', 'approved', 'edited', 'edited', 'edited', 'edited', 'edited'];
  return Array.from({ length: 48 }, (_, i) => ({
    id: `photo-${i + 1}`,
    gallery_id: 'g-1',
    photographer_id: 'p-1',
    original_key: `originals/img_${String(i + 1).padStart(4, '0')}.cr3`,
    edited_key: `edited/img_${String(i + 1).padStart(4, '0')}.jpg`,
    web_key: `web/img_${String(i + 1).padStart(4, '0')}.jpg`,
    thumb_key: `thumb/img_${String(i + 1).padStart(4, '0')}.jpg`,
    filename: `IMG_${String(i + 1).padStart(4, '0')}.CR3`,
    file_size: 25000000 + Math.floor(Math.random() * 15000000),
    mime_type: 'image/x-canon-cr3',
    width: 6720,
    height: 4480,
    exif_data: { iso: 400 + Math.floor(Math.random() * 3200), aperture: 'f/2.8', shutter: '1/200' },
    scene_type: scenes[Math.floor(Math.random() * scenes.length)],
    quality_score: 70 + Math.floor(Math.random() * 30),
    face_data: i % 3 === 0 ? [{ bbox: [100, 100, 300, 300] as [number, number, number, number], eyes_open: true }] : [],
    ai_edits: { exposure: 0.3, white_balance: 5600, contrast: 10, saturation: -5 },
    manual_edits: {},
    prompt_edits: [],
    status: statuses[i % statuses.length],
    star_rating: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 3 : 0,
    color_label: undefined,
    is_culled: i === 15 || i === 32,
    is_favorite: false,
    is_sneak_peek: i < 3,
    sort_order: i,
    section: scenes[Math.floor(Math.random() * scenes.length)],
    edit_confidence: 75 + Math.floor(Math.random() * 25),
    needs_review: Math.random() > 0.85,
    created_at: '2026-02-13T08:00:00Z',
    updated_at: '2026-02-13T09:47:00Z',
  }));
}

export function generateMockStyles(): StyleProfile[] {
  return [
    {
      id: 'sp-1',
      photographer_id: 'p-1',
      name: 'Clean & Bright',
      description: 'Light, airy look with lifted shadows and warm tones. Perfect for weddings and portraits.',
      reference_image_keys: Array.from({ length: 187 }, (_, i) => `ref/style1/img_${i}.jpg`),
      model_weights_key: 'models/style1_v2.pt',
      settings: {
        retouch_intensity: 'medium', auto_crop: true, cleanup_level: 'moderate',
        skin_smoothing: 40, blemish_removal: true, stray_hair_cleanup: true,
        eye_enhancement: false, teeth_whitening: true, background_person_removal: 'flag',
        distraction_removal: 'auto', power_line_removal: true, horizon_correction: true,
      },
      status: 'ready',
      training_started_at: '2026-02-10T10:00:00Z',
      training_completed_at: '2026-02-10T12:30:00Z',
      created_at: '2026-02-10T09:00:00Z',
      updated_at: '2026-02-10T12:30:00Z',
    },
    {
      id: 'sp-2',
      photographer_id: 'p-1',
      name: 'Moody Film',
      description: 'Rich shadows, desaturated greens, film grain. Great for editorial and moody portraits.',
      reference_image_keys: Array.from({ length: 152 }, (_, i) => `ref/style2/img_${i}.jpg`),
      settings: { retouch_intensity: 'light', auto_crop: false, cleanup_level: 'conservative', skin_smoothing: 20, blemish_removal: true, stray_hair_cleanup: false },
      status: 'ready',
      training_started_at: '2026-02-12T08:00:00Z',
      training_completed_at: '2026-02-12T10:15:00Z',
      created_at: '2026-02-12T07:30:00Z',
      updated_at: '2026-02-12T10:15:00Z',
    },
    {
      id: 'sp-3',
      photographer_id: 'p-1',
      name: 'Vibrant Natural',
      description: 'Punchy colours with natural skin tones. Ideal for outdoor and lifestyle shoots.',
      reference_image_keys: Array.from({ length: 64 }, (_, i) => `ref/style3/img_${i}.jpg`),
      settings: { retouch_intensity: 'medium', cleanup_level: 'moderate' },
      status: 'training',
      training_started_at: '2026-02-14T16:00:00Z',
      created_at: '2026-02-14T15:30:00Z',
      updated_at: '2026-02-14T16:00:00Z',
    },
  ];
}

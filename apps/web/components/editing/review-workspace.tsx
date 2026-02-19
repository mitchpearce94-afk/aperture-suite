'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { Photo } from '@/lib/types';
import { getPhotosWithUrls, updatePhoto, getCurrentPhotographer, uploadPhotoToStorage, createPhotoRecord, type PhotoWithUrls } from '@/lib/queries';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { ProcessingJobWithGallery } from './mock-data';
import { generateMockPhotos } from './mock-data';
import {
  Wand2, CheckCircle2, Sparkles, Camera, SlidersHorizontal,
  MessageSquare, Check, X, Star, Filter, ArrowLeft, Send,
  AlertCircle, ImageIcon, Share2, Loader2, Upload, Palette,
} from 'lucide-react';

// ── Restyle: Change Style Panel ────────────────────────────
function ChangeStylePanel({ photo, onRestyled }: {
  photo: PhotoWithUrls;
  onRestyled: (updatedPhoto: Partial<PhotoWithUrls>) => void;
}) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { getStyleProfiles } = await import('@/lib/queries');
        const data = await getStyleProfiles();
        setProfiles(data.filter((p: any) => p.status === 'ready'));
      } catch (err) {
        console.error('Failed to load style profiles:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleApplyStyle = async (profileId: string) => {
    setApplying(profileId);
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restyle',
          photo_id: photo.id,
          style_profile_id: profileId,
        }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        // Force refresh the photo URLs by updating edited_key
        onRestyled({ id: photo.id, edited_key: result.output_key });
      }
    } catch (err) {
      console.error('Restyle failed:', err);
    }
    setApplying(null);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
        <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-amber-400" />Change Style
        </h4>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
      <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
        <Palette className="w-3.5 h-3.5 text-amber-400" />Change Style
      </h4>
      {profiles.length === 0 ? (
        <p className="text-[11px] text-slate-500">No trained styles available. Train a style in Settings → Editing Style.</p>
      ) : (
        <div className="space-y-1.5">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleApplyStyle(profile.id)}
              disabled={applying !== null}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-left disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-1 truncate">{profile.name}</span>
              {applying === profile.id && <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helper: render photo image (signed URL or placeholder) ────────
function PhotoImage({ photo, size = 'thumb', className = '' }: {
  photo: PhotoWithUrls;
  size?: 'thumb' | 'web' | 'edited' | 'original';
  className?: string;
}) {
  // For RAW files, browsers can't display the original — use web preview instead
  const isRaw = photo.filename?.match(/\.(dng|cr2|cr3|nef|nrw|arw|srf|sr2|orf|rw2|pef|raf|raw|3fr|mrw|x3f|srw|erf|kdc|dcr|iiq)$/i);

  const url = size === 'thumb' ? (photo.thumb_url || photo.web_url)
    : size === 'web' ? (photo.web_url || photo.edited_url || photo.thumb_url)
    : size === 'edited' ? (photo.edited_url || photo.web_url)
    : isRaw ? (photo.web_url || photo.edited_url || photo.thumb_url)
    : (photo.original_url || photo.web_url);

  if (!url) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 ${className}`}>
        <Camera className="w-6 h-6 text-slate-700" />
      </div>
    );
  }

  const objectFit = className.includes('object-contain') ? '' : 'object-cover';
  
  return (
    <img
      src={url}
      alt={photo.filename}
      className={`w-full h-full ${objectFit} ${className}`}
      loading="lazy"
    />
  );
}

// ── Main Component ────────────────────────────────────────────────
export function ReviewWorkspace({ processingJob, onBack }: { processingJob: ProcessingJobWithGallery; onBack: () => void }) {
  const [photos, setPhotos] = useState<PhotoWithUrls[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMockData, setUseMockData] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoWithUrls | null>(null);
  const [filterSection, setFilterSection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [promptText, setPromptText] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingToGallery, setSendingToGallery] = useState(false);
  const [sentToGallery, setSentToGallery] = useState(false);
  const [autoDeliver, setAutoDeliver] = useState(false);
  const [uploadingMore, setUploadingMore] = useState(false);
  const [uploadMoreCount, setUploadMoreCount] = useState(0);
  const [uploadMoreTotal, setUploadMoreTotal] = useState(0);
  const uploadMoreRef = useRef<HTMLInputElement>(null);

  const handleUploadMore = useCallback(async (fileList: FileList) => {
    if (!processingJob.gallery_id || fileList.length === 0) return;

    setUploadingMore(true);
    setUploadMoreCount(0);
    setUploadMoreTotal(fileList.length);

    try {
      const photographer = await getCurrentPhotographer();
      if (!photographer) { setUploadingMore(false); return; }

      const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2'];
      let uploadedCount = 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!validExts.includes(ext)) continue;

        try {
          const result = await uploadPhotoToStorage(file, photographer.id, processingJob.gallery_id);
          if (result) {
            await createPhotoRecord({
              gallery_id: processingJob.gallery_id,
              original_key: result.storageKey,
              filename: file.name,
              file_size: file.size,
              mime_type: file.type || 'application/octet-stream',
              sort_order: photos.length + i,
            });
            uploadedCount++;
          }
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
        }

        setUploadMoreCount(i + 1);
      }

      // Trigger AI processing on the gallery so new photos get edited
      if (uploadedCount > 0) {
        try {
          await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'process',
              gallery_id: processingJob.gallery_id,
              style_profile_id: processingJob.style_profile_id || null,
            }),
          });
        } catch (err) {
          console.error('Failed to trigger AI processing:', err);
        }
      }

      // Reload photos to show the newly uploaded ones (they'll be in "uploaded" status until AI finishes)
      const data = await getPhotosWithUrls(processingJob.gallery_id);
      if (data.length > 0) {
        setPhotos(data);
        setUseMockData(false);
      }
    } catch (err) {
      console.error('Upload more error:', err);
    }

    setUploadingMore(false);
  }, [processingJob.gallery_id, processingJob.style_profile_id, photos.length]);

  useEffect(() => {
    async function loadPhotos() {
      try {
        if (!processingJob.gallery_id) {
          setPhotos([]);
          setLoading(false);
          return;
        }
        const data = await getPhotosWithUrls(processingJob.gallery_id);
        setPhotos(data);
        setUseMockData(false);
      } catch {
        setPhotos([]);
      }
      setLoading(false);
    }
    loadPhotos();
  }, [processingJob.gallery_id]);

  const sections = ['all', ...Array.from(new Set(photos.map((p) => p.section).filter(Boolean)))] as string[];

  const filtered = photos.filter((p) => {
    if (p.is_culled) return false;
    if (filterSection !== 'all' && p.section !== filterSection) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: photos.filter((p) => !p.is_culled).length,
    edited: photos.filter((p) => p.status === 'edited').length,
    approved: photos.filter((p) => p.status === 'approved').length,
    needsReview: photos.filter((p) => p.needs_review).length,
    culled: photos.filter((p) => p.is_culled).length,
  };

  const handleApprove = async (photoId: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, status: 'approved' as const, needs_review: false } : p)));
    const idx = filtered.findIndex((p) => p.id === photoId);
    if (idx < filtered.length - 1) setSelectedPhoto(filtered[idx + 1]);
    else setSelectedPhoto(null);
    if (!useMockData) {
      await updatePhoto(photoId, { status: 'approved', needs_review: false });
    }
  };

  const handleReject = async (photoId: string) => {
    // Find the photo before removing from state
    const photo = photos.find((p) => p.id === photoId);

    setPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== photoId);
      // If no photos left, clean up and navigate back
      if (updated.length === 0 && !useMockData) {
        fetch('/api/processing-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', processing_job_id: processingJob.id }),
        }).then(() => {
          onBack();
        }).catch(console.error);
      }
      return updated;
    });

    // Move to next photo
    const idx = filtered.findIndex((p) => p.id === photoId);
    const remaining = filtered.filter((p) => p.id !== photoId);
    if (remaining.length > 0) {
      setSelectedPhoto(remaining[Math.min(idx, remaining.length - 1)]);
    } else {
      setSelectedPhoto(null);
    }

    if (!useMockData) {
      // Delete photo record from DB (cascade will handle related data)
      // Also delete storage files
      try {
        const res = await fetch('/api/photos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_id: photoId,
            storage_keys: [
              photo?.original_key,
              photo?.edited_key,
              photo?.web_key,
              photo?.thumb_key,
            ].filter(Boolean),
          }),
        });
        if (!res.ok) {
          console.error('[Reject] Delete failed:', await res.text());
        }
      } catch (err) {
        console.error('[Reject] Delete error:', err);
      }
    }
  };

  const handleBulkApprove = async () => {
    const targetIds = selectedIds.size > 0
      ? selectedIds
      : new Set(filtered.map((p) => p.id));

    setPhotos((prev) => prev.map((p) => (targetIds.has(p.id) ? { ...p, status: 'approved' as const, needs_review: false } : p)));
    setSelectedIds(new Set());
    setSelectMode(false);

    if (!useMockData) {
      const sb = createSupabaseClient();
      await sb
        .from('photos')
        .update({ status: 'approved', needs_review: false })
        .in('id', Array.from(targetIds));
    }
  };

  const handlePromptSubmit = () => {
    if (!promptText.trim() || !selectedPhoto) return;
    const edit = { prompt: promptText, result: 'Applied', timestamp: new Date().toISOString(), confidence: 92 };
    setPhotos((prev) => prev.map((p) => p.id === selectedPhoto.id ? { ...p, prompt_edits: [...(p.prompt_edits || []), edit] } : p));
    setPromptText('');
    // TODO: Send prompt to AI engine for per-image editing once GPU phases are built
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSendToGallery = async () => {
    setSendingToGallery(true);

    if (!useMockData) {
      // Single server-side API call handles ALL DB writes (bypasses RLS)
      try {
        const jobId = (processingJob as any).gallery?.job_id;
        console.log('[SendToGallery] sending with job_id:', jobId, 'gallery_id:', processingJob.gallery_id);
        const res = await fetch('/api/processing-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_to_gallery',
            processing_job_id: processingJob.id,
            gallery_id: processingJob.gallery_id,
            job_id: jobId,
            auto_deliver: autoDeliver,
          }),
        });
        const result = await res.json();
        console.log('[SendToGallery] response:', res.status, JSON.stringify(result));
      } catch (err) {
        console.error('[SendToGallery] failed:', err);
      }

      // If autoDeliver, send delivery email
      if (autoDeliver) {
        try {
          const sb = createSupabaseClient();
          const { sendGalleryDeliveryEmail } = await import('@/lib/email');
          const { getCurrentPhotographer } = await import('@/lib/queries');
          const { data: galleryFull } = await sb
            .from('galleries')
            .select('*, client:clients(first_name, last_name, email)')
            .eq('id', processingJob.gallery_id)
            .single();
          if (galleryFull?.client?.email) {
            const photographer = await getCurrentPhotographer();
            if (photographer) {
              await sendGalleryDeliveryEmail({
                to: galleryFull.client.email,
                clientName: `${galleryFull.client.first_name} ${galleryFull.client.last_name || ''}`.trim(),
                galleryTitle: galleryFull.title,
                galleryUrl: `${window.location.origin}/gallery/${galleryFull.slug || galleryFull.id}`,
                photographerName: photographer.business_name || photographer.name,
                businessName: photographer.business_name || photographer.name,
              });
            }
          }
        } catch (emailErr) {
          console.error('Failed to send delivery email:', emailErr);
        }
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setSendingToGallery(false);
    onBack();
  };


  const approvedCount = photos.filter((p) => p.status === 'approved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const clientName = processingJob.gallery?.job?.client
    ? `${processingJob.gallery.job.client.first_name} ${processingJob.gallery.job.client.last_name || ''}`
    : '';

  // ====== Single photo detail view ======
  if (selectedPhoto) {
    const idx = filtered.findIndex((p) => p.id === selectedPhoto.id);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPhoto(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-white">{selectedPhoto.filename}</h2>
              <p className="text-xs text-slate-500">
                {idx + 1} of {filtered.length} · {selectedPhoto.scene_type} · Quality: {selectedPhoto.quality_score}/100
                {selectedPhoto.edit_confidence !== undefined && ` · AI Confidence: ${selectedPhoto.edit_confidence}%`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => handleReject(selectedPhoto.id)}>
              <X className="w-3 h-3" />Reject
            </Button>
            <Button size="sm" onClick={() => handleApprove(selectedPhoto.id)}>
              <Check className="w-3 h-3" />Approve
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Before / After */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Original</span>
                </div>
                <div className="flex items-center justify-center bg-black/20 min-h-[200px] max-h-[500px]">
                  <PhotoImage photo={selectedPhoto} size="original" className="object-contain max-h-[500px]" />
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-[#0c0c16] overflow-hidden">
                <div className="px-3 py-2 border-b border-amber-500/20 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">AI Edited</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <div className="flex items-center justify-center bg-black/20 min-h-[200px] max-h-[500px]">
                  <PhotoImage photo={selectedPhoto} size="web" className="object-contain max-h-[500px]" />
                </div>
              </div>
            </div>

            {/* AI Adjustments */}
            {selectedPhoto.ai_edits && Object.keys(selectedPhoto.ai_edits).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
                <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />AI Adjustments Applied
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(selectedPhoto.ai_edits)
                    .filter(([, val]) => val !== null && val !== undefined)
                    .map(([key, val]) => {
                      let displayVal: string;
                      if (typeof val === 'boolean') {
                        displayVal = val ? 'Yes' : 'No';
                      } else if (typeof val === 'object') {
                        // Show summary for composition object
                        const obj = val as Record<string, unknown>;
                        if (obj.horizon_corrected || obj.crop_applied) {
                          const parts: string[] = [];
                          if (obj.horizon_corrected) parts.push(`Horizon ${Number(obj.horizon_angle || 0).toFixed(1)}°`);
                          if (obj.crop_applied) parts.push('Cropped');
                          displayVal = parts.join(', ') || 'None';
                        } else {
                          displayVal = 'Applied';
                        }
                      } else {
                        displayVal = String(val);
                      }
                      return (
                        <div key={key} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-[10px] text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                          <p className="text-xs text-white font-medium mt-0.5">{displayVal}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Prompt edits history */}
            {selectedPhoto.prompt_edits && selectedPhoto.prompt_edits.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
                <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />Prompt Edits
                </h4>
                <div className="space-y-2">
                  {selectedPhoto.prompt_edits.map((edit, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex-1">{edit.prompt}</div>
                      <span className="text-emerald-400 text-[10px] mt-1">✓ Applied</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Prompt editor */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
              <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />Prompt Editor
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">Describe what you want changed. The AI will interpret and apply non-destructively.</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Remove person in background..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()}
                    className="flex-1 px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
                  />
                  <Button size="sm" onClick={handlePromptSubmit} disabled={!promptText.trim()}>
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Remove background people', 'Make sky more blue', 'Smooth skin more', 'Straighten horizon', 'Remove power lines'].map((s) => (
                    <button key={s} onClick={() => setPromptText(s)} className="px-2 py-1 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.1] transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Change Style */}
            <ChangeStylePanel
              photo={selectedPhoto}
              onRestyled={(updates) => {
                // Refresh this photo's URLs after restyle
                setPhotos((prev) => prev.map((p) => p.id === updates.id ? { ...p, ...updates } : p));
                // Re-load all photo URLs to get fresh signed URLs
                if (processingJob.gallery_id) {
                  getPhotosWithUrls(processingJob.gallery_id).then((fresh) => {
                    if (fresh.length > 0) {
                      setPhotos(fresh);
                      const updated = fresh.find((f) => f.id === selectedPhoto.id);
                      if (updated) setSelectedPhoto(updated);
                    }
                  });
                }
              }}
            />

            {/* Photo metadata */}
            <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
              <h4 className="text-xs font-semibold text-white mb-3">Details</h4>
              <div className="space-y-2 text-xs">
                {[
                  ['Scene', selectedPhoto.scene_type || 'Unknown'],
                  ['Faces detected', String(selectedPhoto.face_data?.length || 0)],
                  ['Quality score', selectedPhoto.quality_score],
                  ['AI confidence', selectedPhoto.edit_confidence],
                  ['File size', selectedPhoto.file_size ? `${((selectedPhoto.file_size) / 1024 / 1024).toFixed(1)} MB` : undefined],
                  ['ISO', (selectedPhoto.exif_data as any)?.iso],
                  ['Aperture', (selectedPhoto.exif_data as any)?.aperture],
                  ['Shutter', (selectedPhoto.exif_data as any)?.shutter],
                ].filter(([, v]) => v !== undefined && v !== null).map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-slate-500 capitalize">{label}</span>
                    <span className={`${
                      label === 'Quality score' ? ((Number(val) || 0) >= 80 ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium')
                        : label === 'AI confidence' ? ((Number(val) || 0) >= 85 ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium')
                        : 'text-slate-300'
                    }`}>
                      {label === 'Quality score' ? `${val}/100` : label === 'AI confidence' ? `${val}%` : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" disabled={idx <= 0} onClick={() => idx > 0 && setSelectedPhoto(filtered[idx - 1])}>
                ← Previous
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" disabled={idx >= filtered.length - 1} onClick={() => idx < filtered.length - 1 && setSelectedPhoto(filtered[idx + 1])}>
                Next →
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====== Grid view ======
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-all mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{processingJob.gallery?.title || 'Review Gallery'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{clientName} · {stats.total} images</p>
          </div>
        </div>

        {useMockData && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Showing demo data — real processed photos will appear here once AI processing completes.</span>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>Cancel</Button>
              <Button size="sm" onClick={handleBulkApprove} disabled={selectedIds.size === 0}>
                <Check className="w-3 h-3" />Approve
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setSelectMode(true)}>
                <CheckCircle2 className="w-3 h-3" />Select
              </Button>
              <Button size="sm" onClick={handleBulkApprove}>
                <Check className="w-3 h-3" /><span className="hidden sm:inline">Approve All Visible</span><span className="sm:hidden">Approve All</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => uploadMoreRef.current?.click()} disabled={uploadingMore}>
                {uploadingMore ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />{uploadMoreCount}/{uploadMoreTotal}</>
                ) : (
                  <><Upload className="w-3 h-3" /><span className="hidden sm:inline">Upload More</span><span className="sm:hidden">Upload</span></>
                )}
              </Button>
              <input
                ref={uploadMoreRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.tiff,.tif,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2"
                onChange={(e) => e.target.files && handleUploadMore(e.target.files)}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Stats + Filters combined row */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-slate-400">{stats.edited}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-slate-400">{stats.approved}</span>
        </div>
        {stats.needsReview > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-amber-400">{stats.needsReview}</span>
          </div>
        )}
        {stats.culled > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
            <X className="w-2.5 h-2.5 text-slate-600" />
            <span className="text-slate-500">{stats.culled}</span>
          </div>
        )}

        <div className="flex-1" />

        <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500/50">
          {sections.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All sections' : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500/50">
          <option value="all">All</option>
          <option value="edited">Edited</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      {/* Photo grid */}
      <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 ${approvedCount > 0 && !selectMode && !sentToGallery ? 'pb-36 sm:pb-24' : ''}`}>
        {filtered.map((photo) => {
          const isSelected = selectedIds.has(photo.id);
          return (
            <div
              key={photo.id}
              onClick={() => selectMode ? toggleSelect(photo.id) : setSelectedPhoto(photo)}
              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group transition-all ${
                isSelected ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-[#07070d]' : 'hover:ring-1 hover:ring-white/20'
              }`}
            >
              <PhotoImage photo={photo} size="thumb" />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-[9px] text-white/80 truncate">{photo.filename}</span>
                  <span className={`text-[9px] font-medium ${(photo.quality_score || 0) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {photo.quality_score}
                  </span>
                </div>
              </div>

              {photo.status === 'approved' && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {photo.needs_review && photo.status !== 'approved' && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <AlertCircle className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {selectMode && isSelected && (
                <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {photo.is_sneak_peek && !selectMode && (
                <div className="absolute top-1 left-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send to Gallery */}
      {sentToGallery ? (
        <div className={`rounded-xl border p-5 ${autoDeliver ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${autoDeliver ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
              <Check className={`w-5 h-5 ${autoDeliver ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${autoDeliver ? 'text-emerald-300' : 'text-amber-300'}`}>
                {autoDeliver ? 'Delivered to Client' : 'Sent to Gallery'}
              </p>
              <p className={`text-xs mt-0.5 ${autoDeliver ? 'text-emerald-400/70' : 'text-amber-400/70'}`}>
                {autoDeliver
                  ? `${approvedCount} photos have been delivered to the client. The gallery email and all post-delivery automations have been triggered.`
                  : `${approvedCount} photos are ready in the gallery. Head to Galleries to review and deliver to the client.`
                }
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft className="w-3 h-3" />Back to Queue
            </Button>
          </div>
        </div>
      ) : approvedCount > 0 && !selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 lg:pl-[264px] lg:px-6 pb-3 pt-3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent pointer-events-none">
          <div className="max-w-full pointer-events-auto">
            <div className="rounded-xl border border-amber-500/20 bg-[#0c0c16] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">
                    {approvedCount} photo{approvedCount !== 1 ? 's' : ''} approved
                    {stats.edited > 0 && <span className="text-slate-500"> · {stats.edited} unreviewed</span>}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                    {autoDeliver
                      ? 'Gallery will be created and delivered to the client immediately'
                      : 'Gallery will be created in "Ready" status — deliver manually from Galleries page'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <button
                    onClick={() => setAutoDeliver(!autoDeliver)}
                    className={`w-8 h-[18px] rounded-full relative transition-colors ${autoDeliver ? 'bg-emerald-500' : 'bg-white/[0.08]'}`}
                  >
                    <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${autoDeliver ? 'left-[15px]' : 'left-[2px]'}`} />
                  </button>
                  <span className={`text-[11px] whitespace-nowrap ${autoDeliver ? 'text-emerald-400' : 'text-slate-500'}`}>Auto-deliver</span>
                </label>
                <Button size="sm" onClick={handleSendToGallery} disabled={sendingToGallery} className="flex-shrink-0 w-full sm:w-auto">
                  {sendingToGallery ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</>
                  ) : autoDeliver ? (
                    <><Share2 className="w-3.5 h-3.5" />Send &amp; Deliver</>
                  ) : (
                    <><Share2 className="w-3.5 h-3.5" />Send to Gallery</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

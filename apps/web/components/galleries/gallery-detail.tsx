'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import { getPhotos, deliverGallery, updateGallery, getCurrentPhotographer, hydratePhotoUrls } from '@/lib/queries';
import { sendGalleryDeliveryEmail } from '@/lib/email';
import type { Gallery, Photo, GalleryAccessType } from '@/lib/types';
import {
  ArrowLeft, Eye, Share2, Copy, Check, ExternalLink,
  Camera, Heart, Download, Lock, Globe, Mail, Star,
  Calendar, ImageIcon, Link2, Loader2,
  X, ChevronLeft, ChevronRight, ZoomIn,
  Send, Settings, Save, Pencil,
} from 'lucide-react';

interface GalleryDetailProps {
  gallery: Gallery;
  onBack: () => void;
  onUpdate?: (gallery: Gallery) => void;
}

function PhotoLightbox({ photo, photos, onClose, onPrev, onNext }: {
  photo: Photo; photos: Photo[]; onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const idx = photos.findIndex(p => p.id === photo.id);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors z-10">
        <X className="w-6 h-6" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors z-10">
        <ChevronLeft className="w-8 h-8" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors z-10">
        <ChevronRight className="w-8 h-8" />
      </button>
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {((photo as any).web_url || (photo as any).edited_url) ? (
          <img src={(photo as any).web_url || (photo as any).edited_url} alt={photo.filename} className="max-w-full max-h-[85vh] rounded-lg object-contain" />
        ) : (
          <div className="w-[800px] h-[533px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">{photo.filename}</p>
              <p className="text-xs text-slate-600 mt-1">{photo.width}×{photo.height}</p>
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 text-xs text-white/60">
        <span>{idx + 1} / {photos.length}</span>
        {photo.section && <span className="capitalize">· {photo.section.replace('-', ' ')}</span>}
        {photo.is_favorite && <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />}
      </div>
    </div>
  );
}

export function GalleryDetail({ gallery: initialGallery, onBack, onUpdate }: GalleryDetailProps) {
  const [gallery, setGallery] = useState(initialGallery);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [delivering, setDelivering] = useState(false);
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  const [showDeliverSuccess, setShowDeliverSuccess] = useState(false);
  const [deliverSuccessMessage, setDeliverSuccessMessage] = useState('');

  // Per-gallery settings state
  const [showSettings, setShowSettings] = useState(false);
  const [editTitle, setEditTitle] = useState(gallery.title);
  const [editDescription, setEditDescription] = useState(gallery.description || '');
  const [editAccessType, setEditAccessType] = useState<GalleryAccessType>(gallery.access_type);
  const [editExpiryDays, setEditExpiryDays] = useState<string>(() => {
    if (!gallery.expires_at) return 'none';
    const days = Math.round((new Date(gallery.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 7) return '7';
    if (days <= 14) return '14';
    if (days <= 30) return '30';
    if (days <= 60) return '60';
    if (days <= 90) return '90';
    return 'none';
  });
  const [editDownloadFullRes, setEditDownloadFullRes] = useState(gallery.download_permissions?.allow_full_res ?? true);
  const [editDownloadWeb, setEditDownloadWeb] = useState(gallery.download_permissions?.allow_web ?? true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [galleryPassword, setGalleryPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const clientName = gallery.client
    ? `${gallery.client.first_name} ${gallery.client.last_name || ''}`.trim()
    : 'Unknown Client';

  const galleryUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gallery/${gallery.slug || gallery.id}`;

  useEffect(() => {
    async function loadPhotos() {
      try {
        const data = await getPhotos(gallery.id);
        // Filter out rejected/declined photos — only show delivered, approved, edited, uploaded
        const visible = data.filter(p => p.status !== 'rejected');
        if (visible.length > 0) {
          const hydrated = await hydratePhotoUrls(visible);
          setPhotos(hydrated);
        }
      } catch (err) {
        console.error('Error loading photos:', err);
      }
      setLoading(false);
    }
    loadPhotos();
  }, [gallery.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    const expiresAt = editExpiryDays === 'none'
      ? null
      : new Date(Date.now() + parseInt(editExpiryDays) * 24 * 60 * 60 * 1000).toISOString();

    const updated = await updateGallery(gallery.id, {
      title: editTitle.trim() || gallery.title,
      description: editDescription.trim() || undefined,
      access_type: editAccessType,
      expires_at: expiresAt || undefined,
      download_permissions: {
        allow_full_res: editDownloadFullRes,
        allow_web: editDownloadWeb,
        allow_favorites_only: gallery.download_permissions?.allow_favorites_only ?? false,
      },
    });

    if (updated) {
      const merged = { ...gallery, ...updated };
      setGallery(merged);
      onUpdate?.(merged);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    }
    setSettingsSaving(false);
  };

  const cuteMessages = [
    "Your client is going to love these! 📸",
    "Another gallery delivered — you're on fire! 🔥",
    "Photos sent! Time for a coffee break ☕",
    "Gallery away! Your client's inbox just got prettier ✨",
    "Delivered! Now sit back and wait for the 'OMG I LOVE THEM' text 💬",
    "Gallery sent! You absolute legend 🎉",
    "Photos are on their way — prepare for happy tears! 🥹",
    "Another happy client incoming! Gallery delivered 💛",
    "Boom! Gallery delivered. Nailed it as always 🎯",
    "Gallery's live! Your client is about to have the best day 🌟",
  ];

  const handleDeliver = async () => {
    setDelivering(true);
    const delivered = await deliverGallery(gallery.id);
    if (delivered) {
      setGallery({ ...gallery, ...delivered, status: 'delivered' });
      onUpdate?.({ ...gallery, ...delivered, status: 'delivered' });

      const jobId = (gallery as any).job_id || (delivered as any).job_id;
      if (jobId) {
        try {
          await fetch('/api/processing-jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_job_status', target_job_id: jobId, status: 'delivered' }),
          });
        } catch (err) {
          console.error('[DeliverGallery] job status update failed:', err);
        }
      }

      const clientEmail = (delivered as any)?.client?.email || (gallery as any)?.client?.email;
      if (clientEmail && clientName) {
        try {
          const photographer = await getCurrentPhotographer();
          await sendGalleryDeliveryEmail({
            to: clientEmail,
            clientName: clientName.split(' ')[0],
            galleryTitle: gallery.title,
            galleryUrl,
            photographerName: photographer?.name || '',
            businessName: photographer?.business_name || '',
            brandColor: photographer?.brand_settings?.primary_color,
            photoCount: String(photos.length),
            expiryDate: gallery.expires_at ? new Date(gallery.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
          });
        } catch (e) {
          console.error('Failed to send delivery email:', e);
        }
      }

      // Show success popup
      setDeliverSuccessMessage(cuteMessages[Math.floor(Math.random() * cuteMessages.length)]);
      setShowDeliverSuccess(true);
      setDelivering(false);
      setShowDeliverConfirm(false);
      return;
    }
    setDelivering(false);
    setShowDeliverConfirm(false);
  };

  const sections = ['all', ...Array.from(new Set(photos.map((p) => p.section).filter(Boolean)))] as string[];
  const filtered = activeSection === 'all' ? photos : photos.filter((p) => p.section === activeSection);
  const favoriteCount = photos.filter((p) => p.is_favorite).length;

  const lightboxIndex = lightboxPhoto ? photos.findIndex(p => p.id === lightboxPhoto.id) : -1;
  const goLightbox = useCallback((dir: -1 | 1) => {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + dir + photos.length) % photos.length;
    setLightboxPhoto(photos[next]);
  }, [lightboxIndex, photos]);

  const AccessIcon = gallery.access_type === 'password' ? Lock
    : gallery.access_type === 'email' ? Mail
    : Globe;

  return (
    <div className="space-y-4 sm:space-y-6">
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photos={photos}
          onClose={() => setLightboxPhoto(null)}
          onPrev={() => goLightbox(-1)}
          onNext={() => goLightbox(1)}
        />
      )}

      {/* Delivery success popup */}
      {showDeliverSuccess && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
          <div className="bg-[#0c0c16] border border-emerald-500/30 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-emerald-500/10">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Gallery Delivered!</h3>
            <p className="text-xs text-slate-600 mt-4">{deliverSuccessMessage}</p>
            <div className="mt-6">
              <Button size="sm" onClick={() => { setShowDeliverSuccess(false); onBack(); }}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-all mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{gallery.title}</h2>
              <StatusBadge status={gallery.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {gallery.status === 'delivered' || gallery.status === 'ready' ? (
            <>
              <Button size="sm" variant="secondary" onClick={copyLink}>
                {copied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.open(galleryUrl, '_blank')}>
                <ExternalLink className="w-3 h-3" />Preview
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="w-3 h-3" />{showSettings ? 'Hide Settings' : 'Settings'}
              </Button>
              {gallery.status === 'ready' && (
                <button onClick={async () => {
                  const updated = await updateGallery(gallery.id, { status: 'processing' as any });
                  if (updated) {
                    const jobId = (gallery as any).job_id;
                    if (jobId) {
                      try {
                        await fetch('/api/processing-jobs', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'send_back_to_review', gallery_id: gallery.id, job_id: jobId }),
                        });
                      } catch (err) {
                        console.error('Failed to send back to review:', err);
                      }
                    }
                    window.location.href = '/editing?tab=review';
                  }
                }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                  <ArrowLeft className="w-3 h-3" />Send Back to Review
                </button>
              )}
            </>
          ) : gallery.status === 'processing' ? (
            <Button size="sm" variant="ghost" disabled>
              <Loader2 className="w-3 h-3 animate-spin" />Processing...
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Photos', value: photos.length, icon: ImageIcon, color: 'amber' },
          { label: 'Views', value: gallery.view_count, icon: Eye, color: 'violet' },
          { label: 'Favourites', value: favoriteCount, icon: Heart, color: 'pink' },
          { label: 'Downloads', value: 0, icon: Download, color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-3 sm:p-4">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: stat.color === 'amber' ? 'rgba(245,158,11,0.1)' : stat.color === 'violet' ? 'rgba(139,92,246,0.1)' : stat.color === 'pink' ? 'rgba(236,72,153,0.1)' : 'rgba(16,185,129,0.1)' }}>
              <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                style={{ color: stat.color === 'amber' ? '#f59e0b' : stat.color === 'violet' ? '#a78bfa' : stat.color === 'pink' ? '#f472b6' : '#34d399' }} />
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500">{stat.label}</p>
            <p className="text-lg sm:text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Per-gallery settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Pencil className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Gallery Settings</h3>
          </div>

          {/* Gallery name */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5">Gallery Name</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Sarah & James | 14.02.2026"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <p className="text-[10px] text-slate-600 mt-1">This is what the client sees as the gallery title.</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1.5">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              placeholder="A short message for the client..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
            />
          </div>

          {/* Password (required when gallery access type is password — set in Global Gallery Settings) */}
          {gallery.access_type === 'password' && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">Gallery Password</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={galleryPassword}
                  onChange={(e) => { setGalleryPassword(e.target.value); setPasswordSaved(false); }}
                  placeholder="Set a password for this gallery"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!galleryPassword.trim() || passwordSaving}
                  onClick={async () => {
                    setPasswordSaving(true);
                    try {
                      const res = await fetch('/api/gallery-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'set', gallery_id: gallery.id, password: galleryPassword.trim() }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setPasswordSaved(true);
                        setTimeout(() => setPasswordSaved(false), 3000);
                      }
                    } catch (err) {
                      console.error('Failed to set password:', err);
                    }
                    setPasswordSaving(false);
                  }}
                >
                  {passwordSaved ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {passwordSaving ? 'Saving...' : passwordSaved ? 'Saved!' : 'Set'}
                </Button>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">Share this password with your client so they can access their gallery.</p>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : settingsSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {settingsSaving ? 'Saving...' : settingsSaved ? 'Saved!' : 'Save Settings'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Gallery link bar */}
      {!showSettings && (gallery.status === 'delivered' || gallery.status === 'ready') && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <AccessIcon className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500 mb-0.5">Gallery Link</p>
              <p className="text-xs text-slate-300 truncate font-mono">{galleryUrl}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={copyLink} className="flex-shrink-0">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1 capitalize">
              <AccessIcon className="w-2.5 h-2.5" />{gallery.access_type} access
            </span>
            {gallery.expires_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />Expires {formatDate(gallery.expires_at, 'short')}
              </span>
            )}
            {gallery.download_permissions?.allow_full_res && (
              <span className="flex items-center gap-1">
                <Download className="w-2.5 h-2.5" />Full-res
              </span>
            )}
          </div>
        </div>
      )}

      {/* Section filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-3 py-1.5 text-[11px] rounded-full whitespace-nowrap border transition-all ${
              activeSection === s
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
            }`}
          >
            {s === 'all' ? `All (${photos.length})` : `${s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}`}
          </button>
        ))}
      </div>

      {/* Photo grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Camera className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm text-slate-400">No photos in this gallery yet</p>
          <p className="text-xs text-slate-600 mt-1">Photos will appear here once sent from Auto Editor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-2">
          {filtered.map((photo) => {
            const thumbUrl = (photo as any).thumb_url || (photo as any).web_url || (photo as any).edited_url;
            return (
            <div
              key={photo.id}
              onClick={() => setLightboxPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-gradient-to-br from-slate-900 to-slate-800 hover:ring-1 hover:ring-white/20 transition-all"
            >
              {thumbUrl ? (
                <img src={thumbUrl} alt={photo.filename} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-5 h-5 text-slate-700" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-[9px] text-white/80 truncate">{photo.filename}</span>
                  <ZoomIn className="w-3 h-3 text-white/60" />
                </div>
              </div>
              {photo.is_favorite && (
                <div className="absolute top-1 right-1">
                  <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
                </div>
              )}
              {photo.is_sneak_peek && (
                <div className="absolute top-1 left-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar — Deliver */}
      {gallery.status === 'ready' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 lg:pl-[264px] lg:px-6 pb-3 pt-3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <div className="rounded-xl border border-emerald-500/20 bg-[#0c0c16] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white">Ready to deliver</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">
                    {photos.length} photos · {gallery.access_type} access
                    {gallery.expires_at ? ` · expires ${formatDate(gallery.expires_at, 'short')}` : ' · no expiry'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {showDeliverConfirm ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-400 hidden sm:inline">Send gallery email to {clientName}?</span>
                    <Button size="sm" onClick={handleDeliver} disabled={delivering}>
                      {delivering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Confirm
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowDeliverConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => setShowDeliverConfirm(true)} className="w-full sm:w-auto">
                    <Share2 className="w-3 h-3" />Deliver to Client
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {gallery.status === 'delivered' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 lg:pl-[264px] lg:px-6 pb-3 pt-3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <div className="rounded-xl border border-emerald-500/20 bg-[#0c0c16] p-3 sm:p-4 flex items-center justify-between shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-emerald-400">Delivered</p>
                  <p className="text-[10px] sm:text-[11px] text-slate-500">
                    {photos.length} photos · {gallery.view_count} view{gallery.view_count !== 1 ? 's' : ''}
                    {gallery.expires_at ? ` · expires ${formatDate(gallery.expires_at, 'short')}` : ''}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => window.open(galleryUrl, '_blank')}>
                <ExternalLink className="w-3 h-3" />View as Client
              </Button>
            </div>
          </div>
        </div>
      )}

      {(gallery.status === 'ready' || gallery.status === 'delivered') && <div className="h-20" />}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import { getPhotos, deliverGallery, getCurrentPhotographer } from '@/lib/queries';
import { sendGalleryDeliveryEmail } from '@/lib/email';
import { generateMockGalleryPhotos } from './mock-data';
import type { Gallery, Photo } from '@/lib/types';
import {
  ArrowLeft, Eye, Share2, Copy, Check, ExternalLink,
  Camera, Heart, Download, Lock, Globe, Mail, Star,
  Calendar, ImageIcon, Link2, Loader2,
  X, ChevronLeft, ChevronRight, ZoomIn,
  Send, AlertCircle,
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
        <div className="w-[800px] h-[533px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Camera className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{photo.filename}</p>
            <p className="text-xs text-slate-600 mt-1">{photo.width}×{photo.height}</p>
          </div>
        </div>
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
  const [useMockPhotos, setUseMockPhotos] = useState(false);

  const clientName = gallery.client
    ? `${gallery.client.first_name} ${gallery.client.last_name || ''}`.trim()
    : 'Unknown Client';

  const galleryUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gallery/${gallery.slug || gallery.id}`;

  useEffect(() => {
    async function loadPhotos() {
      try {
        const data = await getPhotos(gallery.id);
        if (data.length > 0) {
          setPhotos(data);
        } else {
          setUseMockPhotos(true);
          setPhotos(generateMockGalleryPhotos(gallery.photo_count || 24));
        }
      } catch {
        setUseMockPhotos(true);
        setPhotos(generateMockGalleryPhotos(gallery.photo_count || 24));
      }
      setLoading(false);
    }
    loadPhotos();
  }, [gallery.id, gallery.photo_count]);

  const copyLink = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeliver = async () => {
    setDelivering(true);
    const delivered = await deliverGallery(gallery.id);
    if (delivered) {
      setGallery({ ...gallery, ...delivered, status: 'delivered' });
      onUpdate?.({ ...gallery, ...delivered, status: 'delivered' });

      // Send delivery email
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
          { label: 'Photos', value: photos.length, icon: ImageIcon, color: 'indigo' },
          { label: 'Views', value: gallery.view_count, icon: Eye, color: 'violet' },
          { label: 'Favourites', value: favoriteCount, icon: Heart, color: 'pink' },
          { label: 'Downloads', value: 0, icon: Download, color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-3 sm:p-4">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ backgroundColor: stat.color === 'indigo' ? 'rgba(99,102,241,0.1)' : stat.color === 'violet' ? 'rgba(139,92,246,0.1)' : stat.color === 'pink' ? 'rgba(236,72,153,0.1)' : 'rgba(16,185,129,0.1)' }}>
              <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                style={{ color: stat.color === 'indigo' ? '#818cf8' : stat.color === 'violet' ? '#a78bfa' : stat.color === 'pink' ? '#f472b6' : '#34d399' }} />
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500">{stat.label}</p>
            <p className="text-lg sm:text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Gallery info bar (read-only — settings controlled globally in Settings page) */}
      {(gallery.status === 'delivered' || gallery.status === 'ready') && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <AccessIcon className="w-4 h-4 text-indigo-400" />
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
            {gallery.download_permissions.allow_full_res && (
              <span className="flex items-center gap-1">
                <Download className="w-2.5 h-2.5" />Full-res downloads
              </span>
            )}
            {gallery.download_permissions.allow_web && (
              <span className="flex items-center gap-1">
                <Download className="w-2.5 h-2.5" />Web downloads
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Gallery settings are managed globally in Settings → Branding → Gallery Settings.</p>
        </div>
      )}

      {useMockPhotos && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Showing demo photos — real photos will appear once uploaded via Auto Editor.</span>
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
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
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
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-2">
          {filtered.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setLightboxPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-gradient-to-br from-slate-900 to-slate-800 hover:ring-1 hover:ring-white/20 transition-all"
            >
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-slate-700" />
              </div>
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
          ))}
        </div>
      )}

      {/* Sticky bottom bar */}
      {gallery.status === 'ready' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a14]/95 backdrop-blur-md border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Send className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Ready to deliver</p>
                <p className="text-[11px] text-slate-500">
                  {photos.length} photos · {gallery.access_type} access
                  {gallery.expires_at ? ` · expires ${formatDate(gallery.expires_at, 'short')}` : ' · no expiry'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showDeliverConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Send gallery email to {clientName}?</span>
                  <Button size="sm" onClick={handleDeliver} disabled={delivering}>
                    {delivering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Confirm
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowDeliverConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowDeliverConfirm(true)}>
                  <Share2 className="w-3 h-3" />Deliver to Client
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {gallery.status === 'delivered' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a14]/95 backdrop-blur-md border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">Delivered</p>
                <p className="text-[11px] text-slate-500">
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
      )}

      {(gallery.status === 'ready' || gallery.status === 'delivered') && <div className="h-16" />}
    </div>
  );
}

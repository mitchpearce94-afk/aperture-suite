'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Photo } from '@/lib/types';
import {
  Camera, Heart, Download, Lock, X, ChevronLeft, ChevronRight,
  Grid3X3, LayoutGrid, Share2, ShoppingBag, ChevronDown, Check, ArrowDown,
} from 'lucide-react';

type GalleryData = {
  id: string; photographer_id: string; title: string; description?: string;
  slug: string; access_type: string; status: string; view_count: number;
  photo_count: number; expires_at?: string; cover_photo_url?: string;
  download_permissions: { allow_full_res: boolean; allow_web: boolean; allow_favorites_only: boolean };
  client?: { first_name: string; last_name: string } | null;
};
type BrandData = {
  business_name?: string;
  brand_settings: { primary_color?: string; secondary_color?: string; logo_url?: string };
};

/* ─── Password Gate ─── */
function PasswordGate({ galleryId, onUnlock, brandColor, businessName }: {
  galleryId: string; onUnlock: () => void; brandColor: string; businessName: string;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) { setError(true); return; }
    setChecking(true); setError(false);
    try {
      const res = await fetch('/api/gallery-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', gallery_id: galleryId, password: password.trim() }),
      });
      const data = await res.json();
      if (data.valid) onUnlock(); else setError(true);
    } catch { setError(true); }
    setChecking(false);
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-lg font-bold shadow-lg"
            style={{ backgroundColor: brandColor, boxShadow: `0 8px 24px ${brandColor}25` }}>
            {businessName.charAt(0)}
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#B5A999] mb-2">{businessName}</p>
          <h2 className="text-xl font-semibold text-[#1A1A1A]">Protected Gallery</h2>
          <p className="text-sm text-[#4A453F] mt-2">Enter the password to view your photos.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5A999]" />
            <input type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter password" autoFocus
              className={`w-full pl-11 pr-4 py-3.5 text-sm border-2 rounded-2xl bg-white text-[#1A1A1A] placeholder:text-[#B5A999] focus:outline-none transition-all ${
                error ? 'border-red-300 focus:border-red-400' : 'border-[#F0ECE5] focus:border-[#B5A999]'}`} />
          </div>
          {error && <p className="text-xs text-red-500 pl-1">Incorrect password. Please try again.</p>}
          <button type="submit" disabled={checking}
            className="w-full py-3.5 text-sm font-semibold text-white rounded-2xl disabled:opacity-60 transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: brandColor, boxShadow: `0 4px 16px ${brandColor}30` }}>
            {checking ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking...</span> : 'View Gallery'}
          </button>
        </form>
        <p className="text-center text-[10px] text-[#B5A999] mt-8">Powered by <span className="font-medium">Apelier</span></p>
      </div>
    </div>
  );
}

/* ─── Lightbox ─── */
function Lightbox({ photo, photos, onClose, onPrev, onNext, onToggleFav, canDownload, brandColor }: {
  photo: Photo; photos: Photo[]; onClose: () => void; onPrev: () => void; onNext: () => void;
  onToggleFav: (id: string, fav: boolean) => void; canDownload: boolean; brandColor: string;
}) {
  const idx = photos.findIndex(p => p.id === photo.id);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') onPrev(); if (e.key === 'ArrowRight') onNext(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose, onPrev, onNext]);
  return (
    <div className="fixed inset-0 z-50 bg-black/95" onClick={onClose}>
      {/* Top bar — fade gradient */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-8 py-4" onClick={e => e.stopPropagation()}>
        <span className="text-[13px] text-white/40 tabular-nums">{idx + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleFav(photo.id, !photo.is_favorite)} className="p-2.5 rounded-full hover:bg-white/10 transition-colors">
            <Heart className={`w-[18px] h-[18px] ${photo.is_favorite ? 'text-pink-400 fill-pink-400' : 'text-white/30 hover:text-white/60'}`} />
          </button>
          {canDownload && (
            <button onClick={async () => {
              try { const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`); const data = await res.json();
                if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
              } catch {} }} className="p-2.5 rounded-full hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"><Download className="w-[18px] h-[18px]" /></button>
          )}
          <div className="w-px h-4 bg-white/10 mx-1.5" />
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>
      {/* Nav arrows */}
      <button onClick={e => { e.stopPropagation(); onPrev(); }} className="absolute left-3 sm:left-8 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full text-white/10 hover:text-white/60 hover:bg-white/5 transition-all"><ChevronLeft className="w-8 h-8" /></button>
      <button onClick={e => { e.stopPropagation(); onNext(); }} className="absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full text-white/10 hover:text-white/60 hover:bg-white/5 transition-all"><ChevronRight className="w-8 h-8" /></button>
      {/* Image — absolutely positioned to fill entire viewport with proper centering */}
      <div className="absolute inset-0 flex items-center justify-center p-12 sm:p-16 md:p-20" onClick={e => e.stopPropagation()}>
        {(photo as any).web_url || (photo as any).thumb_url ? (
          <img src={(photo as any).web_url || (photo as any).thumb_url} alt={photo.filename} className="max-w-full max-h-full object-contain select-none" />
        ) : (
          <div className="w-[800px] max-w-full aspect-[3/2] bg-[#111] rounded flex items-center justify-center"><Camera className="w-12 h-12 text-[#333]" /></div>
        )}
      </div>
    </div>
  );
}

/* ─── Masonry Grid ─── */
function MasonryGrid({ photos, onPhotoClick, onToggleFav, canDownload, brandColor }: {
  photos: Photo[]; onPhotoClick: (p: Photo) => void; onToggleFav: (id: string, fav: boolean) => void;
  canDownload: boolean; brandColor: string;
}) {
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
      {photos.map((photo, i) => (
        <MasonryPhoto key={photo.id} photo={photo} index={i}
          onClick={() => onPhotoClick(photo)}
          onToggleFav={onToggleFav} canDownload={canDownload} brandColor={brandColor} />
      ))}
    </div>
  );
}

function MasonryPhoto({ photo, index, onClick, onToggleFav, canDownload, brandColor }: {
  photo: Photo; index: number; onClick: () => void;
  onToggleFav: (id: string, fav: boolean) => void; canDownload: boolean; brandColor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}
      className={`break-inside-avoid relative group cursor-pointer transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${(index % 4) * 80}ms` }}
      onClick={onClick}
    >
      <div className="overflow-hidden rounded-sm">
        {(photo as any).thumb_url || (photo as any).web_url ? (
          <img src={(photo as any).web_url || (photo as any).thumb_url} alt={photo.filename}
            className="w-full block transition-transform duration-700 ease-out group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="w-full aspect-[4/3] bg-[#F0ECE5] flex items-center justify-center">
            <Camera className="w-5 h-5 text-[#B5A999]" />
          </div>
        )}
        {/* Hover overlay — minimal, from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onToggleFav(photo.id, !photo.is_favorite); }}
              className="p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm transition-all">
              <Heart className={`w-3.5 h-3.5 ${photo.is_favorite ? 'text-pink-500 fill-pink-500' : 'text-gray-700'}`} />
            </button>
            {canDownload && (
              <button onClick={async (e) => {
                e.stopPropagation();
                try { const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`);
                  const data = await res.json();
                  if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                } catch {} }} className="p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm transition-all">
                <Download className="w-3.5 h-3.5 text-gray-700" />
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Fav badge (visible when not hovering) */}
      {photo.is_favorite && (
        <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity">
          <div className="p-1 rounded-full bg-white/80 backdrop-blur-sm shadow-sm">
            <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Uniform Grid (toggle option) ─── */
function UniformGrid({ photos, onPhotoClick, onToggleFav, canDownload, brandColor, gridSize }: {
  photos: Photo[]; onPhotoClick: (p: Photo) => void; onToggleFav: (id: string, fav: boolean) => void;
  canDownload: boolean; brandColor: string; gridSize: 'small' | 'large';
}) {
  return (
    <div className={`grid gap-1.5 sm:gap-2 ${gridSize === 'large' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'}`}>
      {photos.map((photo, i) => (
        <MasonryPhoto key={photo.id} photo={photo} index={i} onClick={() => onPhotoClick(photo)} onToggleFav={onToggleFav} canDownload={canDownload} brandColor={brandColor} />
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function PublicGalleryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [layout, setLayout] = useState<'masonry' | 'grid'>('masonry');
  const [gridSize, setGridSize] = useState<'small' | 'large'>('large');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  const brandColor = brand?.brand_settings?.primary_color || '#C47D4A';
  const businessName = brand?.business_name || 'Gallery';

  useEffect(() => { loadGallery(); }, [slug]);

  // Hide sticky bar when at top
  useEffect(() => {
    const h = () => setHeaderVisible(window.scrollY > 400);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  async function loadGallery() {
    setLoading(true);
    try {
      const sb = createSupabaseClient();
      const { data: gData, error: gErr } = await sb.from('galleries').select('*, client:clients(first_name, last_name)').eq('slug', slug).in('status', ['delivered', 'ready']).single();
      if (gErr || !gData) { setError('Gallery not found or no longer available.'); setLoading(false); return; }
      if (gData.expires_at && new Date(gData.expires_at) < new Date()) { setError('This gallery has expired. Please contact your photographer if you need access.'); setLoading(false); return; }
      const g: GalleryData = { ...gData, client: Array.isArray(gData.client) ? gData.client[0] ?? null : gData.client };
      setGallery(g);
      if (g.access_type !== 'password') { setUnlocked(true); }
      else { try { const pwRes = await fetch('/api/gallery-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', gallery_id: g.id }) }); const pwData = await pwRes.json(); if (!pwData.has_password) setUnlocked(true); } catch {} }
      const { data: brandData } = await sb.from('photographers').select('business_name, brand_settings').eq('id', g.photographer_id).single();
      if (brandData) setBrand(brandData);
      const { data: photoData } = await sb.from('photos').select('*').eq('gallery_id', g.id).in('status', ['edited', 'approved', 'delivered']).order('sort_order', { ascending: true });
      if (photoData && photoData.length > 0) {
        try { const urlRes = await fetch(`/api/gallery-photos?gallery_id=${g.id}`); const urlData = await urlRes.json();
          if (urlRes.ok && urlData.photos) setPhotos(urlData.photos); else setPhotos(photoData);
        } catch { setPhotos(photoData); }
      } else { setPhotos(photoData || []); }
      try { await sb.rpc('increment_gallery_views', { gallery_id: g.id }); } catch {}
    } catch { setError('Something went wrong loading this gallery.'); }
    setLoading(false);
  }

  const toggleFavorite = async (photoId: string, isFavorite: boolean) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_favorite: isFavorite } : p));
    if (lightboxPhoto?.id === photoId) setLightboxPhoto(prev => prev ? { ...prev, is_favorite: isFavorite } : null);
    try { const sb = createSupabaseClient(); await sb.from('photos').update({ is_favorite: isFavorite }).eq('id', photoId); }
    catch { setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, is_favorite: !isFavorite } : p)); }
  };

  const sections = ['all', ...Array.from(new Set(photos.map(p => p.section).filter(Boolean)))] as string[];
  let displayPhotos = photos;
  if (activeSection !== 'all') displayPhotos = displayPhotos.filter(p => p.section === activeSection);
  if (showFavoritesOnly) displayPhotos = displayPhotos.filter(p => p.is_favorite);
  const favoriteCount = photos.filter(p => p.is_favorite).length;
  const canDownload = gallery?.download_permissions?.allow_web || gallery?.download_permissions?.allow_full_res || false;
  const lightboxIndex = lightboxPhoto ? displayPhotos.findIndex(p => p.id === lightboxPhoto.id) : -1;
  const goLightbox = useCallback((dir: -1 | 1) => {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + dir + displayPhotos.length) % displayPhotos.length;
    setLightboxPhoto(displayPhotos[next]);
  }, [lightboxIndex, displayPhotos]);

  // Pick the first photo as cover if no cover_photo_url
  // Prefer highest-res available for hero cover: web_url (2048px) > edited_url > thumb_url (400px)
  const coverPhoto = gallery?.cover_photo_url || (photos.length > 0 ? ((photos[0] as any).web_url || (photos[0] as any).edited_url || (photos[0] as any).thumb_url) : null);

  if (loading) return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-2 rounded-full animate-spin" style={{ borderColor: brandColor + '20', borderTopColor: brandColor }} />
        <span className="text-[11px] text-[#B5A999] tracking-wide">Loading gallery...</span>
      </div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 bg-[#F0ECE5] flex items-center justify-center"><Camera className="w-7 h-7 text-[#B5A999]" /></div>
        <h2 className="text-lg font-semibold text-[#1A1A1A]">Gallery Unavailable</h2>
        <p className="text-sm text-[#4A453F] mt-2 leading-relaxed">{error}</p>
      </div>
    </div>
  );
  if (!gallery) return null;
  if (gallery.access_type === 'password' && !unlocked) return <PasswordGate galleryId={gallery.id} onUnlock={() => setUnlocked(true)} brandColor={brandColor} businessName={businessName} />;

  const clientName = gallery.client ? [gallery.client.first_name, gallery.client.last_name].filter(Boolean).join(' ') || null : null;

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {lightboxPhoto && <Lightbox photo={lightboxPhoto} photos={displayPhotos} onClose={() => setLightboxPhoto(null)} onPrev={() => goLightbox(-1)} onNext={() => goLightbox(1)} onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} />}

      {/* ─── Full-bleed Hero ─── */}
      <section className="relative h-[70vh] sm:h-[80vh] flex items-end overflow-hidden bg-[#1A1A1A]">
        {coverPhoto ? (
          <img src={coverPhoto} alt={gallery.title} className="absolute inset-0 w-full h-full object-cover object-[center_30%]" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2d1810] via-[#1A1A1A] to-[#0E0E10]" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

        {/* Hero content — bottom-left */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 pb-10 sm:pb-14">
          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/50 mb-3">{businessName}</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-white leading-[1.05] tracking-tight max-w-2xl" style={{ fontFamily: "'Georgia', 'Libre Baskerville', serif" }}>
            {gallery.title}
          </h1>
          {gallery.description && <p className="text-sm sm:text-base text-white/60 mt-3 max-w-lg leading-relaxed">{gallery.description}</p>}
          <div className="flex items-center gap-4 mt-4 text-xs text-white/40">
            <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
            {clientName && clientName.trim() && !clientName.includes('null') && <><span className="text-white/20">·</span><span>For {clientName}</span></>}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ArrowDown className="w-4 h-4 text-white/20" />
        </div>
      </section>

      {/* ─── Sticky toolbar (appears on scroll) ─── */}
      <div className={`sticky top-0 z-30 transition-all duration-300 ${headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="bg-white/90 backdrop-blur-xl border-b border-[#F0ECE5]/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-10 h-12 sm:h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: brandColor }}>{businessName.charAt(0)}</div>
              <span className="text-sm font-medium text-[#1A1A1A] truncate">{gallery.title}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border transition-all ${showFavoritesOnly ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-[#E2DDD4] text-[#4A453F] hover:border-[#B5A999]'}`}>
                <Heart className={`w-3 h-3 ${showFavoritesOnly ? 'fill-pink-500' : ''}`} />
                {favoriteCount > 0 && <span>{favoriteCount}</span>}
              </button>
              {canDownload && (
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-full border border-[#E2DDD4] text-[#4A453F] hover:border-[#B5A999] transition-all">
                    <Download className="w-3 h-3" /><span className="hidden sm:inline">Download</span>
                  </button>
                  {showDownloadMenu && (<>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-[#F0ECE5] shadow-xl z-50 py-1">
                      <button className="w-full px-3 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#FAF9F7] transition-colors">Download Full Gallery</button>
                      {favoriteCount > 0 && <button className="w-full px-3 py-2 text-left text-xs text-[#1A1A1A] hover:bg-[#FAF9F7] transition-colors">Download Favourites ({favoriteCount})</button>}
                    </div>
                  </>)}
                </div>
              )}
              <button onClick={() => setLayout(layout === 'masonry' ? 'grid' : 'masonry')}
                className="p-1.5 rounded-full border border-[#E2DDD4] text-[#B5A999] hover:text-[#4A453F] hover:border-[#B5A999] transition-all hidden sm:flex">
                {layout === 'masonry' ? <Grid3X3 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Favourites banner ─── */}
      {showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-10 pt-5">
          <div className="flex items-center justify-between rounded-xl bg-pink-50/80 border border-pink-100 px-4 py-3">
            <div className="flex items-center gap-2"><Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" /><span className="text-sm text-pink-700 font-medium">{favoriteCount} Favourite{favoriteCount !== 1 ? 's' : ''}</span></div>
            <button onClick={() => setShowFavoritesOnly(false)} className="text-xs text-pink-500 hover:text-pink-700 font-medium">Show all</button>
          </div>
        </div>
      )}

      {/* ─── Section tabs ─── */}
      {sections.length > 2 && !showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-10 pt-6 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sections.map(s => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                  activeSection === s ? 'text-white shadow-sm' : 'text-[#4A453F] hover:text-[#1A1A1A] bg-white border border-[#E2DDD4] hover:border-[#B5A999]'}`}
                style={activeSection === s ? { backgroundColor: brandColor } : undefined}>
                {s === 'all' ? `All (${photos.length})` : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Photo Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-10 py-6 sm:py-8">
        {displayPhotos.length === 0 ? (
          <div className="text-center py-24">
            {showFavoritesOnly ? (<>
              <Heart className="w-8 h-8 text-pink-200 mx-auto mb-3" />
              <p className="text-sm text-[#4A453F]">No favourites yet</p>
              <p className="text-xs text-[#B5A999] mt-1">Tap the heart on photos you love</p>
              <button onClick={() => setShowFavoritesOnly(false)} className="text-xs mt-3 font-medium" style={{ color: brandColor }}>Show all photos</button>
            </>) : (<>
              <Camera className="w-8 h-8 text-[#B5A999] mx-auto mb-3" />
              <p className="text-sm text-[#4A453F]">No photos in this section</p>
            </>)}
          </div>
        ) : layout === 'masonry' ? (
          <MasonryGrid photos={displayPhotos} onPhotoClick={setLightboxPhoto} onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} />
        ) : (
          <UniformGrid photos={displayPhotos} onPhotoClick={setLightboxPhoto} onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} gridSize={gridSize} />
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#F0ECE5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[#B5A999]">
            <svg width="14" height="14" viewBox="0 0 44 44" fill="none"><path d="M22 3.5L25.5 15.5 22 13Z" fill="#C47D4A" opacity=".95"/><path d="M38 11 29 19 28.5 14.5Z" fill="#D4A574" opacity=".7"/><path d="M22 40.5 18.5 28.5 22 31Z" fill="#D4A574" opacity=".95"/><path d="M6 33 15 25.5 15.5 30Z" fill="#C47D4A" opacity=".7"/><circle cx="22" cy="22" r="4" fill="#C47D4A"/></svg>
            Powered by <span className="font-medium text-[#4A453F]">Apelier</span>
          </div>
          <span className="text-[11px] text-[#B5A999] tabular-nums">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        </div>
      </footer>
    </div>
  );
}

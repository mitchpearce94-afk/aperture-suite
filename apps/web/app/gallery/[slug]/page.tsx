'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Photo } from '@/lib/types';
import {
  Heart, Download, Lock, X, ChevronLeft, ChevronRight,
  Grid3X3, LayoutGrid, Share2, ChevronDown, Camera,
} from 'lucide-react';

/* ─── Types ─── */
type GalleryData = {
  id: string; photographer_id: string; title: string; description?: string;
  slug: string; access_type: string; status: string; view_count: number;
  photo_count: number; expires_at?: string; cover_photo_url?: string;
  download_permissions: { allow_full_res: boolean; allow_web: boolean; allow_favorites_only: boolean };
  client?: { first_name: string; last_name: string } | null;
};
type BrandData = {
  business_name?: string;
  brand_settings: { primary_color?: string; secondary_color?: string; logo_url?: string; logo_key?: string };
  logo_url?: string | null;
};

/* ─── Apelier Aperture Mark ─── */
function ApertureMark({ className = 'w-5 h-5', color = '#c47d4a' }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none">
      <rect x="5" y="9" width="34" height="26" rx="2" stroke={color} strokeWidth="0.5" opacity="0.25" />
      <rect x="29" y="4.5" width="6" height="3.5" rx="0.8" stroke={color} strokeWidth="0.5" opacity="0.25" />
      <path d="M22 3.5 L25.5 15.5 L22 13 Z" fill={color} opacity="0.95" />
      <path d="M38 11 L29 19 L28.5 14.5 Z" fill={color} opacity="0.7" />
      <path d="M38 33 L28 25.5 L29.5 21 Z" fill={color} opacity="0.55" />
      <path d="M22 40.5 L18.5 28.5 L22 31 Z" fill={color} opacity="0.95" />
      <path d="M6 33 L15 25.5 L15.5 30 Z" fill={color} opacity="0.7" />
      <path d="M6 11 L16 19 L14.5 23.5 Z" fill={color} opacity="0.55" />
      <circle cx="22" cy="22" r="4" fill={color} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PROGRESSIVE HERO IMAGE                                                    */
/* Shows blurred thumbnail instantly, fades in crisp 2048px version          */
/* ═══════════════════════════════════════════════════════════════════════════ */
function ProgressiveHeroImage({ thumbSrc, fullSrc, alt }: { thumbSrc: string | null; fullSrc: string | null; alt: string }) {
  const [fullLoaded, setFullLoaded] = useState(false);

  useEffect(() => {
    if (!fullSrc || fullSrc === thumbSrc) return;
    const img = new Image();
    img.onload = () => setFullLoaded(true);
    img.src = fullSrc;
  }, [fullSrc, thumbSrc]);

  if (!thumbSrc && !fullSrc) {
    return <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-night to-ink" />;
  }

  return (
    <>
      {/* Layer 1: Blurred thumbnail — loads instantly, provides colour/shape while full loads */}
      {thumbSrc && (
        <img
          src={thumbSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
          style={{
            filter: fullLoaded ? 'blur(0px)' : 'blur(24px)',
            transform: fullLoaded ? 'scale(1)' : 'scale(1.08)',
            transition: 'filter 0.8s ease-out, transform 0.8s ease-out, opacity 0.8s ease-out',
            opacity: fullLoaded ? 0 : 1,
          }}
        />
      )}
      {/* Layer 2: Full resolution (2048px) — fades in on top once loaded */}
      {fullSrc && fullLoaded && (
        <img
          src={fullSrc}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover object-[center_30%] animate-fade-in"
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PASSWORD GATE                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */
function PasswordGate({ galleryId, onUnlock, brandColor, businessName, logoUrl }: {
  galleryId: string; onUnlock: () => void; brandColor: string; businessName: string; logoUrl: string | null;
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
    <div className="min-h-screen bg-night flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <Lock className="w-12 h-12 mx-auto mb-8 text-brand-500/50" strokeWidth={1} />
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="h-10 max-w-[200px] object-contain" />
          ) : (
            <>
              <ApertureMark className="w-6 h-6" color={brandColor} />
              <span className="font-display text-base text-white/80">{businessName}</span>
            </>
          )}
        </div>
        <h2 className="font-display text-2xl text-white mb-2">Protected Gallery</h2>
        <p className="text-sm font-body text-dark-warm mb-8">Enter the password to view your photos</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/15" />
            <input
              type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Gallery password" autoFocus
              className={`w-full pl-11 pr-4 py-3.5 text-sm font-body bg-white/[0.03] border rounded-xl text-white placeholder:text-white/20 focus:outline-none transition-all text-center tracking-[3px] ${
                error ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/[0.08] focus:border-brand-500/50'}`}
            />
          </div>
          {error && <p className="text-xs text-red-400/80 font-body">Incorrect password. Please try again.</p>}
          <button type="submit" disabled={checking}
            className="w-full py-3.5 text-sm font-sans font-semibold text-white rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: brandColor, boxShadow: `0 8px 24px ${brandColor}25` }}>
            {checking ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking...</span> : 'View Gallery'}
          </button>
        </form>
        <p className="text-[10px] text-dark-warm mt-10 flex items-center justify-center gap-1.5">
          <ApertureMark className="w-3 h-3" color="#4a453f" />
          Powered by <span className="font-medium text-warm-grey">Apelier</span>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* CINEMATIC LIGHTBOX                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */
function Lightbox({ photo, photos, onClose, onPrev, onNext, onToggleFav, canDownload, brandColor }: {
  photo: Photo; photos: Photo[]; onClose: () => void; onPrev: () => void; onNext: () => void;
  onToggleFav: (id: string, fav: boolean) => void; canDownload: boolean; brandColor: string;
}) {
  const idx = photos.findIndex(p => p.id === photo.id);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') onPrev(); if (e.key === 'ArrowRight') onNext(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [onClose, onPrev, onNext]);

  const imgSrc = (photo as any).web_url || (photo as any).thumb_url;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/[0.96]" />
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 sm:px-8 py-5" onClick={e => e.stopPropagation()}>
        <span className="text-[13px] font-sans font-light text-white/25 tracking-wider tabular-nums">
          {idx + 1} <span className="text-white/10 mx-1">/</span> {photos.length}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onToggleFav(photo.id, !photo.is_favorite)} className="p-2.5 rounded-full hover:bg-white/[0.06] transition-colors">
            <Heart className={`w-[18px] h-[18px] transition-colors ${photo.is_favorite ? 'fill-brand-500 text-brand-500' : 'text-white/25 hover:text-white/50'}`} />
          </button>
          {canDownload && (
            <button onClick={async () => {
              try { const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`); const data = await res.json();
                if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
              } catch {} }} className="p-2.5 rounded-full hover:bg-white/[0.06] transition-colors text-white/25 hover:text-white/50">
              <Download className="w-[18px] h-[18px]" />
            </button>
          )}
          <button onClick={() => { if (navigator.share) navigator.share({ title: 'Photo', url: window.location.href }); }}
            className="p-2.5 rounded-full hover:bg-white/[0.06] transition-colors text-white/25 hover:text-white/50">
            <Share2 className="w-[18px] h-[18px]" />
          </button>
          <div className="w-px h-4 bg-white/[0.08] mx-2" />
          <button onClick={onClose} className="p-2.5 rounded-full hover:bg-white/[0.06] text-white/25 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>
      {idx > 0 && (
        <button onClick={e => { e.stopPropagation(); onPrev(); }} className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full text-white/10 hover:text-white/50 hover:bg-white/[0.04] transition-all"><ChevronLeft className="w-7 h-7" /></button>
      )}
      {idx < photos.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNext(); }} className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full text-white/10 hover:text-white/50 hover:bg-white/[0.04] transition-all"><ChevronRight className="w-7 h-7" /></button>
      )}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-14 md:p-20" onClick={e => e.stopPropagation()}>
        {imgSrc ? (
          <img src={imgSrc} alt={photo.filename} className="max-w-full max-h-full object-contain select-none" />
        ) : (
          <div className="w-[800px] max-w-full aspect-[3/2] bg-white/[0.02] rounded-lg flex items-center justify-center"><Camera className="w-12 h-12 text-white/10" /></div>
        )}
      </div>
      {photo.section && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
          <span className="text-[10px] font-sans font-medium uppercase tracking-[0.2em] text-white/15">{photo.section}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PHOTO TILE WITH SCROLL ANIMATION                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */
function PhotoTile({ photo, index, onClick, onToggleFav, canDownload }: {
  photo: Photo; index: number; onClick: () => void;
  onToggleFav: (id: string, fav: boolean) => void; canDownload: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const imgSrc = (photo as any).web_url || (photo as any).thumb_url;

  return (
    <div
      ref={ref}
      className={`break-inside-avoid relative group cursor-pointer transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
      style={{ transitionDelay: `${(index % 6) * 60}ms` }}
      onClick={onClick}
    >
      <div className="overflow-hidden rounded-[3px]">
        {imgSrc ? (
          <img src={imgSrc} alt={photo.filename}
            className="w-full block transition-transform duration-700 ease-out group-hover:scale-[1.025]" loading="lazy" />
        ) : (
          <div className="w-full aspect-[4/3] bg-white/[0.02] flex items-center justify-center"><Camera className="w-5 h-5 text-white/10" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onToggleFav(photo.id, !photo.is_favorite); }}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all">
              <Heart className={`w-3.5 h-3.5 transition-colors ${photo.is_favorite ? 'text-brand-500 fill-brand-500' : 'text-white/70'}`} />
            </button>
            {canDownload && (
              <button onClick={async (e) => { e.stopPropagation();
                try { const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`);
                  const data = await res.json(); if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                } catch {} }} className="p-2 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-all">
                <Download className="w-3.5 h-3.5 text-white/70" />
              </button>
            )}
          </div>
        </div>
      </div>
      {photo.is_favorite && (
        <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity duration-200">
          <div className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm"><Heart className="w-3 h-3 text-brand-500 fill-brand-500" /></div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */
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
  const [gridSize, setGridSize] = useState<'large' | 'small'>('large');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  const brandColor = brand?.brand_settings?.primary_color || '#C47D4A';
  const businessName = brand?.business_name || 'Gallery';
  const logoUrl = brand?.logo_url || null;

  useEffect(() => { loadGallery(); }, [slug]);

  useEffect(() => {
    const h = () => setHeaderVisible(window.scrollY > 450);
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
      if (brandData) setBrand(brandData as any);
      try {
        const brandRes = await fetch(`/api/gallery-branding?photographer_id=${g.photographer_id}`);
        const brandJson = await brandRes.json();
        if (brandRes.ok && brandJson) {
          setBrand((prev) => ({
            ...prev,
            business_name: brandJson.business_name || prev?.business_name,
            brand_settings: brandJson.brand_settings || prev?.brand_settings || {},
            logo_url: brandJson.logo_url || null,
          }));
        }
      } catch {}
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

  // Hero cover sources — progressive: thumb (400px, blurred) → web (2048px, crisp)
  const firstPhoto = photos.length > 0 ? photos[0] as any : null;
  const coverThumb = gallery?.cover_photo_url || firstPhoto?.thumb_url || null;
  const coverFull = gallery?.cover_photo_url || firstPhoto?.web_url || null;

  const photoGroups: { section: string; photos: Photo[] }[] = [];
  if (activeSection === 'all' && sections.length > 2 && !showFavoritesOnly) {
    const sectionOrder: string[] = [];
    const sectionMap: Record<string, Photo[]> = {};
    for (const p of displayPhotos) {
      const s = p.section || 'Photos';
      if (!sectionMap[s]) { sectionMap[s] = []; sectionOrder.push(s); }
      sectionMap[s].push(p);
    }
    for (const s of sectionOrder) photoGroups.push({ section: s, photos: sectionMap[s] });
  } else {
    photoGroups.push({ section: '', photos: displayPhotos });
  }

  if (loading) return (
    <div className="min-h-screen bg-night flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 max-w-[200px] object-contain animate-pulse" />
        ) : (
          <ApertureMark className="w-10 h-10 animate-pulse" color={brandColor} />
        )}
        <span className="text-[11px] font-sans text-dark-warm tracking-wider">Loading gallery...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-night flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <ApertureMark className="w-12 h-12 mx-auto mb-5" color="#4a453f" />
        <h2 className="font-display text-xl text-white mb-2">Gallery Unavailable</h2>
        <p className="text-sm font-body text-dark-warm leading-relaxed">{error}</p>
      </div>
    </div>
  );

  if (!gallery) return null;
  if (gallery.access_type === 'password' && !unlocked) return <PasswordGate galleryId={gallery.id} onUnlock={() => setUnlocked(true)} brandColor={brandColor} businessName={businessName} logoUrl={logoUrl} />;

  const clientName = gallery.client ? [gallery.client.first_name, gallery.client.last_name].filter(Boolean).join(' ') || null : null;

  return (
    <div className="min-h-screen bg-night">
      {lightboxPhoto && <Lightbox photo={lightboxPhoto} photos={displayPhotos} onClose={() => setLightboxPhoto(null)} onPrev={() => goLightbox(-1)} onNext={() => goLightbox(1)} onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} />}

      {/* ─── Full-bleed Hero Cover — Progressive Image Loading ─── */}
      <section className="relative h-[70vh] sm:h-[80vh] max-h-[900px] min-h-[480px] flex items-end overflow-hidden">
        <ProgressiveHeroImage thumbSrc={coverThumb} fullSrc={coverFull} alt={gallery.title} />

        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent opacity-60" />
        {/* Subtle radial vignette for cinematic depth */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(14,14,16,0.45) 100%)' }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 pb-12 sm:pb-16 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-5 animate-fade-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-16 sm:h-20 max-w-[320px] object-contain opacity-90 drop-shadow-lg" />
            ) : (
              <>
                <ApertureMark className="w-6 h-6" color={brandColor} />
                <span className="text-xs font-sans font-medium uppercase tracking-[0.2em] text-white/45">{businessName}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-white leading-[1.08] tracking-tight max-w-3xl mx-auto animate-fade-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            {gallery.title}
          </h1>
          {gallery.description && (
            <p className="text-sm sm:text-base font-body text-white/45 mt-4 max-w-lg mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>{gallery.description}</p>
          )}
          <div className="flex items-center justify-center gap-3 mt-5 text-[11px] font-sans text-white/25 tracking-wider animate-fade-up" style={{ animationDelay: '0.45s', animationFillMode: 'both' }}>
            <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
            {clientName && clientName.trim() && !clientName.includes('null') && <><span className="text-brand-500/40">·</span><span>For {clientName}</span></>}
          </div>
          <div className="mt-10 animate-fade-up" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
            <button onClick={() => document.getElementById('gallery-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/[0.1] text-white/20 hover:text-white/50 hover:border-white/20 transition-all animate-bounce"
              style={{ animationDuration: '2.5s' }}>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Sticky Toolbar ─── */}
      <div className={`sticky top-0 z-30 transition-all duration-300 ${headerVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="bg-night/85 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-4 sm:px-10 h-14 flex items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {sections.map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`px-3 py-1.5 text-[11px] font-sans font-medium rounded-full whitespace-nowrap transition-all ${
                    activeSection === s ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'}`}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-sans font-medium rounded-full transition-all ${
                  showFavoritesOnly ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25' : 'text-white/30 hover:text-white/50 border border-transparent'}`}>
                <Heart className={`w-3 h-3 ${showFavoritesOnly ? 'fill-brand-500' : ''}`} />
                {favoriteCount > 0 && <span>{favoriteCount}</span>}
              </button>
              <div className="hidden sm:flex items-center bg-white/[0.03] rounded-lg overflow-hidden">
                <button onClick={() => setGridSize('large')} className={`p-1.5 transition-colors ${gridSize === 'large' ? 'text-white/60 bg-white/[0.05]' : 'text-white/15 hover:text-white/30'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
                <button onClick={() => setGridSize('small')} className={`p-1.5 transition-colors ${gridSize === 'small' ? 'text-white/60 bg-white/[0.05]' : 'text-white/15 hover:text-white/30'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
              </div>
              {canDownload && (
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-sans font-medium rounded-full border border-white/[0.08] text-white/35 hover:text-white/60 hover:border-white/[0.12] transition-all">
                    <Download className="w-3 h-3" /><span className="hidden sm:inline">Download</span>
                  </button>
                  {showDownloadMenu && (<>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-ink/95 backdrop-blur-xl rounded-xl border border-white/[0.08] shadow-2xl shadow-black/60 z-50 py-1 overflow-hidden">
                      <button onClick={async () => { setShowDownloadMenu(false);
                        try { const res = await fetch(`/api/gallery-photos?action=download_all&gallery_id=${gallery.id}&resolution=web`); const data = await res.json();
                          if (data.downloads) data.downloads.forEach((d: any) => { if (d.url) { const a = document.createElement('a'); a.href = d.url; a.download = d.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } });
                        } catch {} }}
                        className="w-full px-4 py-2.5 text-left text-xs font-body text-white/70 hover:bg-white/[0.04] transition-colors">Download All Photos</button>
                      {favoriteCount > 0 && <button className="w-full px-4 py-2.5 text-left text-xs font-body text-white/70 hover:bg-white/[0.04] transition-colors">Download Favourites ({favoriteCount})</button>}
                    </div>
                  </>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-10 pt-5">
          <div className="flex items-center justify-between rounded-xl bg-brand-500/[0.06] border border-brand-500/15 px-4 py-3">
            <div className="flex items-center gap-2"><Heart className="w-3.5 h-3.5 text-brand-500 fill-brand-500" /><span className="text-sm font-sans font-medium text-brand-300">{favoriteCount} Favourite{favoriteCount !== 1 ? 's' : ''}</span></div>
            <button onClick={() => setShowFavoritesOnly(false)} className="text-xs font-sans text-brand-400 hover:text-brand-300 font-medium">Show all</button>
          </div>
        </div>
      )}

      <div id="gallery-grid" className="max-w-7xl mx-auto px-4 sm:px-10 py-8 sm:py-10">
        {displayPhotos.length === 0 ? (
          <div className="text-center py-28">
            {showFavoritesOnly ? (<>
              <Heart className="w-8 h-8 text-brand-500/20 mx-auto mb-3" />
              <p className="text-sm font-body text-white/40">No favourites yet</p>
              <p className="text-xs font-body text-dark-warm mt-1">Tap the heart on photos you love</p>
              <button onClick={() => setShowFavoritesOnly(false)} className="text-xs font-sans font-medium mt-3" style={{ color: brandColor }}>Show all photos</button>
            </>) : (<>
              <Camera className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-sm font-body text-white/30">No photos in this section</p>
            </>)}
          </div>
        ) : (
          photoGroups.map((group, gi) => (
            <div key={group.section || gi} className={gi > 0 ? 'mt-14' : ''}>
              {group.section && (
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                  <h2 className="font-display text-base sm:text-lg text-white/50 whitespace-nowrap">{group.section}</h2>
                  <span className="text-[10px] font-sans text-white/15 tracking-wider">{group.photos.length}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                </div>
              )}
              <div className={`${gridSize === 'large' ? 'columns-2 sm:columns-3 lg:columns-3' : 'columns-2 sm:columns-3 md:columns-4 lg:columns-4'} gap-2.5 sm:gap-3`}>
                {group.photos.map((photo, i) => (
                  <div key={photo.id} className="mb-2.5 sm:mb-3">
                    <PhotoTile photo={photo} index={i} onClick={() => setLightboxPhoto(photo)} onToggleFav={toggleFavorite} canDownload={canDownload} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-10 py-8 flex items-center justify-between">
          <a href="https://apelier.com.au" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[11px] font-body text-dark-warm hover:text-warm-grey transition-colors">
            <ApertureMark className="w-3.5 h-3.5" color="#4a453f" />
            Powered by <span className="font-medium">Apelier</span>
          </a>
          <span className="text-[11px] font-body text-dark-warm tabular-nums">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        </div>
      </footer>
    </div>
  );
}

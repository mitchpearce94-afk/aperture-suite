'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import type { Photo } from '@/lib/types';
import {
  Camera, Heart, Download, Lock, X, ChevronLeft, ChevronRight,
  Grid3X3, LayoutGrid, Share2, ShoppingBag, ChevronDown, Check,
} from 'lucide-react';

type GalleryData = {
  id: string; photographer_id: string; title: string; description?: string;
  slug: string; access_type: string; status: string; view_count: number;
  photo_count: number; expires_at?: string;
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
          <p className="text-sm text-[#4A453F] mt-2">Enter the password your photographer provided to view your photos.</p>
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
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0E10] flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/60 to-transparent absolute top-0 left-0 right-0 z-10">
        <span className="text-sm text-white/50 tabular-nums font-medium">{idx + 1} / {photos.length}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onToggleFav(photo.id, !photo.is_favorite)} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors" title="Favourite">
            <Heart className={`w-5 h-5 transition-colors ${photo.is_favorite ? 'text-pink-400 fill-pink-400' : 'text-white/40 hover:text-white/70'}`} />
          </button>
          {canDownload && (
            <button onClick={async () => {
              try {
                const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`);
                const data = await res.json();
                if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
              } catch {}
            }} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Download">
              <Download className="w-5 h-5" />
            </button>
          )}
          <button className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Share"><Share2 className="w-5 h-5" /></button>
          <div className="w-px h-5 bg-white/10 mx-2" />
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <button onClick={onPrev} className="absolute left-2 sm:left-6 p-3 text-white/15 hover:text-white/70 transition-colors z-10 group">
          <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors"><ChevronLeft className="w-7 h-7" /></div>
        </button>
        <div className="max-w-[92vw] max-h-[88vh] flex items-center justify-center">
          {(photo as any).web_url || (photo as any).thumb_url ? (
            <img src={(photo as any).web_url || (photo as any).thumb_url} alt={photo.filename} className="max-w-full max-h-[88vh] rounded-lg object-contain shadow-2xl" />
          ) : (
            <div className="w-[800px] max-w-full aspect-[3/2] bg-[#1A1A1A] rounded-lg flex items-center justify-center"><Camera className="w-12 h-12 text-[#4A453F]" /></div>
          )}
        </div>
        <button onClick={onNext} className="absolute right-2 sm:right-6 p-3 text-white/15 hover:text-white/70 transition-colors z-10 group">
          <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors"><ChevronRight className="w-7 h-7" /></div>
        </button>
      </div>
      <div className="px-4 py-3 bg-gradient-to-t from-black/60 to-transparent absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 text-xs text-white/30">
        {photo.section && <span className="capitalize px-2.5 py-1 rounded-full bg-white/5">{photo.section.replace('-', ' ')}</span>}
        <span>{photo.filename}</span>
      </div>
    </div>
  );
}

/* ─── Shop Section ─── */
function ShopSection({ brandColor }: { brandColor: string }) {
  const products = [
    { name: 'Fine Art Prints', desc: 'Museum-quality prints on archival paper', price: 'From $29', icon: '\u{1F5BC}\u{FE0F}' },
    { name: 'Canvas Wrap', desc: 'Gallery-wrapped canvas, ready to hang', price: 'From $89', icon: '\u{1F3A8}' },
    { name: 'Photo Album', desc: 'Hardcover lay-flat album, 20 pages', price: 'From $199', icon: '\u{1F4D6}' },
    { name: 'Metal Print', desc: 'Vibrant HD print on brushed aluminium', price: 'From $69', icon: '\u2728' },
    { name: 'Greeting Cards', desc: 'Pack of 25, folded or flat', price: 'From $49', icon: '\u{1F48C}' },
    { name: 'Photo Mug', desc: 'Ceramic mug with your favourite photo', price: 'From $24', icon: '\u2615' },
  ];
  return (
    <div className="border-t border-[#F0ECE5] bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#B5A999] mb-2">Keepsakes</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1A1A1A]">Print Shop</h2>
          <p className="text-sm text-[#4A453F] mt-2">Turn your favourite moments into beautiful keepsakes</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
          {products.map(product => (
            <button key={product.name} className="group text-left rounded-2xl border border-[#F0ECE5] bg-white hover:border-[#E2DDD4] hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className="aspect-[4/3] bg-gradient-to-br from-[#FAF9F7] to-[#F0ECE5] flex items-center justify-center text-4xl group-hover:scale-[1.02] transition-transform duration-300">{product.icon}</div>
              <div className="p-3.5 sm:p-4">
                <h3 className="text-sm font-medium text-[#1A1A1A]">{product.name}</h3>
                <p className="text-xs text-[#B5A999] mt-0.5 hidden sm:block">{product.desc}</p>
                <p className="text-xs font-semibold mt-2" style={{ color: brandColor }}>{product.price}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-[#B5A999] mt-8">Print ordering coming soon &mdash; powered by Apelier</p>
      </div>
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
  const [gridSize, setGridSize] = useState<'small' | 'large'>('large');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const brandColor = brand?.brand_settings?.primary_color || '#C47D4A';
  const businessName = brand?.business_name || 'Gallery';

  useEffect(() => { loadGallery(); }, [slug]);

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
      else {
        try {
          const pwRes = await fetch('/api/gallery-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', gallery_id: g.id }) });
          const pwData = await pwRes.json();
          if (!pwData.has_password) setUnlocked(true);
        } catch {}
      }
      const { data: brandData } = await sb.from('photographers').select('business_name, brand_settings').eq('id', g.photographer_id).single();
      if (brandData) setBrand(brandData);
      const { data: photoData } = await sb.from('photos').select('*').eq('gallery_id', g.id).in('status', ['edited', 'approved', 'delivered']).order('sort_order', { ascending: true });
      if (photoData && photoData.length > 0) {
        try {
          const urlRes = await fetch(`/api/gallery-photos?gallery_id=${g.id}`);
          const urlData = await urlRes.json();
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

  if (loading) return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-2 rounded-full animate-spin" style={{ borderColor: brandColor + '20', borderTopColor: brandColor }} />
        <span className="text-xs text-[#B5A999]">Loading gallery...</span>
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

  const clientName = gallery.client ? `${gallery.client.first_name} ${gallery.client.last_name}` : null;

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {lightboxPhoto && <Lightbox photo={lightboxPhoto} photos={displayPhotos} onClose={() => setLightboxPhoto(null)} onPrev={() => goLightbox(-1)} onNext={() => goLightbox(1)} onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} />}

      {/* ─── Hero Header ─── */}
      <div className="relative bg-white border-b border-[#F0ECE5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm" style={{ backgroundColor: brandColor }}>{businessName.charAt(0)}</div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#B5A999]">{businessName}</p>
                  {clientName && <p className="text-xs text-[#4A453F]">For {clientName}</p>}
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] tracking-tight">{gallery.title}</h1>
              {gallery.description && <p className="text-sm text-[#4A453F] mt-2 max-w-xl leading-relaxed">{gallery.description}</p>}
              <p className="text-xs text-[#B5A999] mt-2">{photos.length} photos{sections.length > 2 ? ` \u00B7 ${sections.length - 1} sections` : ''}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border transition-all duration-200 ${showFavoritesOnly ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-[#E2DDD4] bg-white text-[#4A453F] hover:border-[#B5A999] hover:shadow-sm'}`}>
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-pink-500' : ''}`} />
                <span>Favourites{favoriteCount > 0 ? ` (${favoriteCount})` : ''}</span>
              </button>
              {canDownload && (
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border border-[#E2DDD4] bg-white text-[#4A453F] hover:border-[#B5A999] hover:shadow-sm transition-all duration-200">
                    <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Download</span><ChevronDown className="w-3 h-3 text-[#B5A999]" />
                  </button>
                  {showDownloadMenu && (<>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-[#F0ECE5] shadow-xl z-50 py-1.5 overflow-hidden">
                      <button className="w-full px-4 py-2.5 text-left text-sm text-[#1A1A1A] hover:bg-[#FAF9F7] transition-colors flex items-center gap-2.5"><Download className="w-3.5 h-3.5 text-[#B5A999]" />Download Full Gallery</button>
                      {favoriteCount > 0 && <button className="w-full px-4 py-2.5 text-left text-sm text-[#1A1A1A] hover:bg-[#FAF9F7] transition-colors flex items-center justify-between"><span className="flex items-center gap-2.5"><Heart className="w-3.5 h-3.5 text-pink-400" />Download Favourites</span><span className="text-xs text-[#B5A999] tabular-nums">{favoriteCount}</span></button>}
                      <div className="border-t border-[#F0ECE5] my-1" />
                      <button className="w-full px-4 py-2.5 text-left text-sm text-[#4A453F] hover:bg-[#FAF9F7] transition-colors flex items-center gap-2.5"><Check className="w-3.5 h-3.5 text-[#B5A999]" />Select Multiple...</button>
                    </div>
                  </>)}
                </div>
              )}
              <button onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border border-[#E2DDD4] bg-white text-[#4A453F] hover:border-[#B5A999] hover:shadow-sm transition-all duration-200">
                <ShoppingBag className="w-3.5 h-3.5" /><span className="hidden sm:inline">Shop</span>
              </button>
              <button onClick={() => setGridSize(gridSize === 'large' ? 'small' : 'large')}
                className="p-2 rounded-full border border-[#E2DDD4] bg-white text-[#B5A999] hover:text-[#4A453F] hover:border-[#B5A999] hover:shadow-sm transition-all duration-200 hidden sm:flex">
                {gridSize === 'large' ? <Grid3X3 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Favourites banner ─── */}
      {showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex items-center justify-between rounded-2xl bg-pink-50/80 border border-pink-100 px-5 py-3.5">
            <div className="flex items-center gap-2.5"><Heart className="w-4 h-4 text-pink-500 fill-pink-500" /><span className="text-sm text-pink-700 font-medium">{favoriteCount} Favourite{favoriteCount !== 1 ? 's' : ''}</span></div>
            <div className="flex items-center gap-3">
              {canDownload && favoriteCount > 0 && <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full text-white transition-all hover:shadow-md" style={{ backgroundColor: brandColor }}><Download className="w-3 h-3" />Download All</button>}
              <button onClick={() => setShowFavoritesOnly(false)} className="text-xs text-pink-500 hover:text-pink-700 transition-colors font-medium">Show all photos</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section tabs ─── */}
      {sections.length > 2 && !showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {sections.map(s => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap border transition-all duration-200 ${activeSection === s ? 'text-white border-transparent shadow-sm' : 'border-[#E2DDD4] bg-white text-[#4A453F] hover:text-[#1A1A1A] hover:border-[#B5A999]'}`}
                style={activeSection === s ? { backgroundColor: brandColor } : undefined}>
                {s === 'all' ? `All (${photos.length})` : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Photo Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {displayPhotos.length === 0 ? (
          <div className="text-center py-24">
            {showFavoritesOnly ? (<>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 bg-pink-50 flex items-center justify-center"><Heart className="w-7 h-7 text-pink-300" /></div>
              <p className="text-sm text-[#4A453F] font-medium">No favourites yet</p>
              <p className="text-xs text-[#B5A999] mt-1">Click the heart on any photo to add it here</p>
              <button onClick={() => setShowFavoritesOnly(false)} className="text-xs mt-3 font-medium hover:underline" style={{ color: brandColor }}>Show all photos</button>
            </>) : (<>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 bg-[#F0ECE5] flex items-center justify-center"><Camera className="w-7 h-7 text-[#B5A999]" /></div>
              <p className="text-sm text-[#4A453F] font-medium">No photos in this section</p>
            </>)}
          </div>
        ) : (
          <div className={`grid gap-2 sm:gap-2.5 ${gridSize === 'large' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'}`}>
            {displayPhotos.map(photo => (
              <div key={photo.id} className="relative group cursor-pointer" onClick={() => setLightboxPhoto(photo)}>
                <div className={`${gridSize === 'large' ? 'aspect-[4/3]' : 'aspect-square'} rounded-xl overflow-hidden bg-[#F0ECE5]`}>
                  {(photo as any).thumb_url || (photo as any).web_url ? (
                    <img src={(photo as any).thumb_url || (photo as any).web_url} alt={photo.filename} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Camera className="w-6 h-6 text-[#B5A999]" /></div>
                  )}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(photo.id, !photo.is_favorite); }} className="p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all hover:scale-105 active:scale-95">
                        <Heart className={`w-3.5 h-3.5 ${photo.is_favorite ? 'text-pink-500 fill-pink-500' : 'text-[#4A453F]'}`} />
                      </button>
                      {canDownload && (
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const res = await fetch(`/api/gallery-photos?action=download&gallery_id=${photo.gallery_id}&photo_id=${photo.id}&resolution=full`);
                            const data = await res.json();
                            if (data.url) { const a = document.createElement('a'); a.href = data.url; a.download = photo.filename || 'photo.jpg'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                          } catch {}
                        }} className="p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all hover:scale-105 active:scale-95">
                          <Download className="w-3.5 h-3.5 text-[#4A453F]" />
                        </button>
                      )}
                      <button onClick={(e) => e.stopPropagation()} className="p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all hover:scale-105 active:scale-95"><Share2 className="w-3.5 h-3.5 text-[#4A453F]" /></button>
                    </div>
                  </div>
                </div>
                {photo.is_favorite && (
                  <div className="absolute top-2.5 right-2.5 group-hover:opacity-0 transition-opacity duration-200">
                    <div className="p-1.5 rounded-full bg-white/90 shadow-sm"><Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="shop-section"><ShopSection brandColor={brandColor} /></div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#F0ECE5] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[#B5A999]">
            <svg width="16" height="16" viewBox="0 0 44 44" fill="none"><path d="M22 3.5L25.5 15.5 22 13Z" fill="#C47D4A" opacity=".95"/><path d="M38 11 29 19 28.5 14.5Z" fill="#D4A574" opacity=".7"/><path d="M22 40.5 18.5 28.5 22 31Z" fill="#D4A574" opacity=".95"/><path d="M6 33 15 25.5 15.5 30Z" fill="#C47D4A" opacity=".7"/><circle cx="22" cy="22" r="4" fill="#C47D4A"/></svg>
            <span>Powered by <span className="font-medium text-[#4A453F]">Apelier</span></span>
          </div>
          <p className="text-[11px] text-[#B5A999] tabular-nums">{photos.length} photos</p>
        </div>
      </footer>
    </div>
  );
}

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
function PasswordGate({ galleryId, onUnlock, brandColor }: { galleryId: string; onUnlock: () => void; brandColor: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) { setError(true); return; }
    setChecking(true);
    setError(false);
    try {
      const res = await fetch('/api/gallery-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', gallery_id: galleryId, password: password.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        onUnlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setChecking(false);
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: brandColor + '15' }}>
            <Lock className="w-5 h-5" style={{ color: brandColor }} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Protected Gallery</h2>
          <p className="text-sm text-gray-500 mt-1">Enter the password your photographer provided.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }} placeholder="Enter password" autoFocus
            className={`w-full px-4 py-3 text-sm border rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-gray-200'}`} />
          {error && <p className="text-xs text-red-500">Incorrect password. Please try again.</p>}
          <button type="submit" disabled={checking} className="w-full py-3 text-sm font-medium text-white rounded-xl disabled:opacity-60" style={{ backgroundColor: brandColor }}>
            {checking ? 'Checking...' : 'View Gallery'}
          </button>
        </form>
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <span className="text-sm text-white/60 tabular-nums">{idx + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleFav(photo.id, !photo.is_favorite)} className="p-2.5 rounded-lg hover:bg-white/10 transition-colors" title="Favourite">
            <Heart className={`w-5 h-5 ${photo.is_favorite ? 'text-pink-400 fill-pink-400' : 'text-white/50 hover:text-white/80'}`} />
          </button>
          {canDownload && (
            <button className="p-2.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80" title="Download">
              <Download className="w-5 h-5" />
            </button>
          )}
          <button className="p-2.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80" title="Share">
            <Share2 className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button onClick={onClose} className="p-2.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center relative">
        <button onClick={onPrev} className="absolute left-2 sm:left-6 p-3 text-white/20 hover:text-white/80 transition-colors"><ChevronLeft className="w-8 h-8" /></button>
        <div className="max-w-[92vw] max-h-[82vh] flex items-center justify-center">
          {(photo as any).preview_url ? (
            <img src={(photo as any).preview_url.replace('/800/533', '/1200/800')} alt={photo.filename} className="max-w-full max-h-[82vh] rounded object-contain" />
          ) : (
            <div className="w-[800px] max-w-full aspect-[3/2] bg-gray-900 rounded flex items-center justify-center">
              <Camera className="w-12 h-12 text-gray-700" />
            </div>
          )}
        </div>
        <button onClick={onNext} className="absolute right-2 sm:right-6 p-3 text-white/20 hover:text-white/80 transition-colors"><ChevronRight className="w-8 h-8" /></button>
      </div>

      {/* Bottom info */}
      <div className="px-4 py-3 bg-black/80 flex items-center justify-center gap-4 text-xs text-white/40">
        {photo.section && <span className="capitalize">{photo.section.replace('-', ' ')}</span>}
        <span>{photo.filename}</span>
      </div>
    </div>
  );
}

/* ─── Shop Section ─── */
function ShopSection({ brandColor, photos }: { brandColor: string; photos: Photo[] }) {
  const products = [
    { name: 'Fine Art Prints', desc: 'Museum-quality prints on archival paper', price: 'From $29', icon: '🖼️' },
    { name: 'Canvas Wrap', desc: 'Gallery-wrapped canvas, ready to hang', price: 'From $89', icon: '🎨' },
    { name: 'Photo Album', desc: 'Hardcover lay-flat album, 20 pages', price: 'From $199', icon: '📖' },
    { name: 'Metal Print', desc: 'Vibrant HD print on brushed aluminium', price: 'From $69', icon: '✨' },
    { name: 'Greeting Cards', desc: 'Pack of 25, folded or flat', price: 'From $49', icon: '💌' },
    { name: 'Photo Mug', desc: 'Ceramic mug with your favourite photo', price: 'From $24', icon: '☕' },
  ];

  return (
    <div className="border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Print Shop</h2>
          <p className="text-sm text-gray-500 mt-2">Turn your favourite moments into beautiful keepsakes</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {products.map(product => (
            <button key={product.name} className="group text-left rounded-xl border border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden">
              {/* Product preview area */}
              <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-4xl">
                {product.icon}
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="text-sm font-medium text-gray-900">{product.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{product.desc}</p>
                <p className="text-xs font-medium mt-2" style={{ color: brandColor }}>{product.price}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Print ordering coming soon — powered by Apelier</p>
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

  const brandColor = brand?.brand_settings?.primary_color || '#6366f1';
  const businessName = brand?.business_name || 'Gallery';

  useEffect(() => { loadGallery(); }, [slug]);

  async function loadGallery() {
    setLoading(true);
    try {
      const sb = createSupabaseClient();
      const { data: gData, error: gErr } = await sb
        .from('galleries').select('*, client:clients(first_name, last_name)')
        .eq('slug', slug).in('status', ['delivered', 'ready']).single();
      if (gErr || !gData) { setError('Gallery not found or no longer available.'); setLoading(false); return; }
      if (gData.expires_at && new Date(gData.expires_at) < new Date()) { setError('This gallery has expired. Please contact your photographer if you need access.'); setLoading(false); return; }
      const g: GalleryData = { ...gData, client: Array.isArray(gData.client) ? gData.client[0] ?? null : gData.client };
      setGallery(g);
      if (g.access_type !== 'password') setUnlocked(true);
      const { data: brandData } = await sb.from('photographers').select('business_name, brand_settings').eq('id', g.photographer_id).single();
      if (brandData) setBrand(brandData);
      const { data: photoData } = await sb.from('photos').select('*').eq('gallery_id', g.id)
        .in('status', ['edited', 'approved', 'delivered']).order('sort_order', { ascending: true });
      setPhotos(photoData || []);
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
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: brandColor + '30', borderTopColor: brandColor }} />
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <Camera className="w-10 h-10 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Gallery Unavailable</h2>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
      </div>
    </div>
  );
  if (!gallery) return null;
  if (gallery.access_type === 'password' && !unlocked) return <PasswordGate galleryId={gallery.id} onUnlock={() => setUnlocked(true)} brandColor={brandColor} />;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {lightboxPhoto && (
        <Lightbox photo={lightboxPhoto} photos={displayPhotos}
          onClose={() => setLightboxPhoto(null)} onPrev={() => goLightbox(-1)} onNext={() => goLightbox(1)}
          onToggleFav={toggleFavorite} canDownload={canDownload} brandColor={brandColor} />
      )}

      {/* ─── Navigation Bar ─── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: brand + title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: brandColor }}>
                {businessName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 truncate">{gallery.title}</h1>
                <p className="text-[11px] text-gray-400 truncate">{businessName} · {photos.length} photos</p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Favourites toggle */}
              <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-all ${
                  showFavoritesOnly ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                title={showFavoritesOnly ? 'Show all photos' : 'Show favourites'}>
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-pink-500' : ''}`} />
                {favoriteCount > 0 && <span>{favoriteCount}</span>}
              </button>

              {/* Download dropdown */}
              {canDownload && (
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showDownloadMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-50 py-1">
                        <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          Download Full Gallery
                        </button>
                        {favoriteCount > 0 && (
                          <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between">
                            <span>Download Favourites</span>
                            <span className="text-xs text-gray-400">{favoriteCount}</span>
                          </button>
                        )}
                        <div className="border-t border-gray-100 my-1" />
                        <button className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          Select Multiple...
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Shop */}
              <button onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shop</span>
              </button>

              {/* Grid toggle */}
              <button onClick={() => setGridSize(gridSize === 'large' ? 'small' : 'large')}
                className="p-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all hidden sm:flex">
                {gridSize === 'large' ? <Grid3X3 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Description ─── */}
      {gallery.description && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <p className="text-sm text-gray-500 max-w-2xl">{gallery.description}</p>
        </div>
      )}

      {/* ─── Favourites banner ─── */}
      {showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between rounded-xl bg-pink-50 border border-pink-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
              <span className="text-sm text-pink-700 font-medium">
                {favoriteCount} Favourite{favoriteCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canDownload && favoriteCount > 0 && (
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full text-white transition-colors" style={{ backgroundColor: brandColor }}>
                  <Download className="w-3 h-3" />Download All Favourites
                </button>
              )}
              <button onClick={() => setShowFavoritesOnly(false)} className="text-xs text-pink-500 hover:text-pink-700 transition-colors">
                Show all photos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section tabs ─── */}
      {sections.length > 2 && !showFavoritesOnly && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {sections.map(s => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap border transition-all ${
                  activeSection === s ? 'text-white border-transparent' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700'}`}
                style={activeSection === s ? { backgroundColor: brandColor } : undefined}>
                {s === 'all' ? `All (${photos.length})` : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Photo Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {displayPhotos.length === 0 ? (
          <div className="text-center py-20">
            {showFavoritesOnly ? (
              <>
                <Heart className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No favourites yet — click the heart on any photo!</p>
                <button onClick={() => setShowFavoritesOnly(false)} className="text-xs mt-2 hover:underline" style={{ color: brandColor }}>Show all photos</button>
              </>
            ) : (
              <>
                <Camera className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No photos in this section.</p>
              </>
            )}
          </div>
        ) : (
          <div className={`grid gap-1.5 sm:gap-2 ${
            gridSize === 'large' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
          }`}>
            {displayPhotos.map(photo => (
              <div key={photo.id} className="relative group cursor-pointer" onClick={() => setLightboxPhoto(photo)}>
                <div className={`${gridSize === 'large' ? 'aspect-[4/3]' : 'aspect-square'} rounded-lg overflow-hidden bg-gray-100`}>
                  {(photo as any).preview_url ? (
                    <img src={(photo as any).preview_url} alt={photo.filename} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Camera className="w-6 h-6 text-gray-300" /></div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-all duration-200">
                    <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(photo.id, !photo.is_favorite); }}
                        className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-colors">
                        <Heart className={`w-3.5 h-3.5 ${photo.is_favorite ? 'text-pink-500 fill-pink-500' : 'text-gray-600'}`} />
                      </button>
                      {canDownload && (
                        <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-colors">
                          <Download className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      )}
                      <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-full bg-white/90 hover:bg-white shadow-sm transition-colors">
                        <Share2 className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Favourite badge (visible when not hovering) */}
                {photo.is_favorite && (
                  <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity">
                    <Heart className="w-4 h-4 text-pink-500 fill-pink-500 drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Shop Section ─── */}
      <div id="shop-section">
        <ShopSection brandColor={brandColor} photos={photos} />
      </div>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Camera className="w-3.5 h-3.5" />
            <span>Powered by <span className="font-medium">Apelier</span></span>
          </div>
          <p className="text-xs text-gray-400">{photos.length} photos</p>
        </div>
      </footer>
    </div>
  );
}

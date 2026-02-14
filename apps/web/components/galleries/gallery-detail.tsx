'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import { generateMockGalleryPhotos } from './mock-data';
import type { Gallery, Photo } from '@/lib/types';
import {
  ArrowLeft, Eye, Share2, Copy, Check, ExternalLink,
  Camera, Heart, Download, Lock, Globe, Mail, Star,
  Calendar, Clock, ImageIcon, BarChart3, Link2,
  Settings, ChevronDown, Loader2,
} from 'lucide-react';

interface GalleryDetailProps {
  gallery: Gallery;
  onBack: () => void;
}

export function GalleryDetail({ gallery, onBack }: GalleryDetailProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  const clientName = gallery.client
    ? `${gallery.client.first_name} ${gallery.client.last_name || ''}`.trim()
    : 'Unknown Client';

  const galleryUrl = `https://gallery.aperturesuite.com/${gallery.slug || gallery.id}`;

  useEffect(() => {
    // Load photos — mock for now
    const mockPhotos = generateMockGalleryPhotos(gallery.photo_count || 24);
    setPhotos(mockPhotos);
    setLoading(false);
  }, [gallery.id, gallery.photo_count]);

  const copyLink = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = ['all', ...Array.from(new Set(photos.map((p) => p.section).filter(Boolean)))] as string[];
  const filtered = activeSection === 'all' ? photos : photos.filter((p) => p.section === activeSection);
  const favoriteCount = photos.filter((p) => p.is_favorite).length;
  const sneakPeekCount = photos.filter((p) => p.is_sneak_peek).length;

  const AccessIcon = gallery.access_type === 'password' ? Lock
    : gallery.access_type === 'email' ? Mail
    : gallery.access_type === 'public' ? Globe
    : Lock;

  return (
    <div className="space-y-4 sm:space-y-6">
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

        {/* Action buttons */}
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
              {gallery.status === 'ready' && (
                <Button size="sm">
                  <Share2 className="w-3 h-3" />Deliver to Client
                </Button>
              )}
            </>
          ) : gallery.status === 'processing' ? (
            <Button size="sm" variant="ghost" disabled>
              <Loader2 className="w-3 h-3 animate-spin" />Processing...
            </Button>
          ) : null}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all ml-auto"
          >
            <Settings className="w-4 h-4" />
          </button>
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
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center mb-2`}>
              <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-${stat.color}-400`} />
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500">{stat.label}</p>
            <p className="text-lg sm:text-xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Gallery link bar */}
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
                <Download className="w-2.5 h-2.5" />Full-res downloads enabled
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0c0c16] p-4 space-y-4">
          <h3 className="text-xs font-semibold text-white">Gallery Settings</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Access Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['password', 'email', 'public'] as const).map((type) => (
                  <button key={type} className={`px-2 py-1.5 text-[11px] rounded-lg border capitalize transition-all ${
                    gallery.access_type === type ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500'
                  }`}>{type}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Downloads</label>
              <div className="space-y-1.5">
                {[
                  ['Full Resolution', gallery.download_permissions.allow_full_res],
                  ['Web Size', gallery.download_permissions.allow_web],
                  ['Favourites Only', gallery.download_permissions.allow_favorites_only],
                ].map(([label, enabled]) => (
                  <div key={String(label)} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{String(label)}</span>
                    <div className={`w-7 h-4 rounded-full relative cursor-pointer ${enabled ? 'bg-indigo-500' : 'bg-white/[0.08]'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${enabled ? 'left-[14px]' : 'left-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Expiry Date</label>
            <input
              type="date"
              defaultValue={gallery.expires_at ? gallery.expires_at.slice(0, 10) : ''}
              className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500/50"
            />
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
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-gradient-to-br from-slate-900 to-slate-800 hover:ring-1 hover:ring-white/20 transition-all"
            >
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-slate-700" />
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-[9px] text-white/80 truncate">{photo.filename}</span>
                </div>
              </div>

              {/* Favourite indicator */}
              {photo.is_favorite && (
                <div className="absolute top-1 right-1">
                  <Heart className="w-3 h-3 text-pink-400 fill-pink-400" />
                </div>
              )}

              {/* Sneak peek */}
              {photo.is_sneak_peek && (
                <div className="absolute top-1 left-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

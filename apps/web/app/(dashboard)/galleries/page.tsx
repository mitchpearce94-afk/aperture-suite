'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import { getGalleries } from '@/lib/queries';
import { ImageIcon, Plus, Eye, Share2, Wand2, MoreHorizontal, Search } from 'lucide-react';
import type { Gallery } from '@/lib/types';

function GalleryCard({ gallery }: { gallery: Gallery }) {
  const clientName = gallery.client
    ? `${gallery.client.first_name} ${gallery.client.last_name || ''}`
    : undefined;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] hover:border-white/[0.1] transition-all cursor-pointer group overflow-hidden">
      <div className="relative h-40 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 flex items-center justify-center">
        <ImageIcon className="w-10 h-10 text-slate-700" />
        {gallery.status === 'processing' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-white">
              <Wand2 className="w-4 h-4 animate-pulse" />
              <span>AI Processing...</span>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <StatusBadge status={gallery.status} />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{gallery.title}</h3>
            {clientName && <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>}
          </div>
          <button className="p-1 rounded-md text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          {gallery.view_count > 0 && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{gallery.view_count} views</span>
          )}
          <span>{formatDate(gallery.created_at, 'relative')}</span>
        </div>
        <div className="flex items-center gap-2">
          {gallery.status === 'ready' && (
            <Button size="sm" className="flex-1"><Share2 className="w-3 h-3" />Deliver</Button>
          )}
          {gallery.status === 'delivered' && (
            <Button variant="secondary" size="sm" className="flex-1"><Eye className="w-3 h-3" />View Gallery</Button>
          )}
          {gallery.status === 'processing' && (
            <Button variant="ghost" size="sm" className="flex-1" disabled>
              <Wand2 className="w-3 h-3 animate-spin" />Processing...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getGalleries();
      setGalleries(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = galleries.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Galleries</h1>
          <p className="text-sm text-slate-500 mt-1">
            {galleries.length} galler{galleries.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-3.5 h-3.5" />New Gallery
        </Button>
      </div>

      {galleries.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No galleries yet"
          description="Galleries are created automatically when you upload photos to a job, or you can create one manually."
        />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search galleries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

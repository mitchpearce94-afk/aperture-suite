'use client';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import type { ProcessingJob, StyleProfile } from '@/lib/types';
import type { ProcessingJobWithGallery } from './mock-data';
import { PHASES } from './mock-data';
import {
  Check, Loader2, Eye, Clock, Trash2,
  Image as ImageIcon, Sparkles,
} from 'lucide-react';

// ============================================
// Phase Progress Component
// ============================================
export function PhaseProgress({ currentPhase, status }: { currentPhase?: string; status: string }) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isComplete = status === 'completed' || (currentIndex > -1 && i < currentIndex);
        const isCurrent = status === 'processing' && i === currentIndex;

        return (
          <div key={phase.id} className="flex items-center gap-1">
            <div
              className={`relative group flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold transition-all ${
                isComplete
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isCurrent
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 ring-2 ring-indigo-500/20'
                  : 'bg-white/[0.04] text-slate-600 border border-white/[0.06]'
              }`}
            >
              {isComplete ? (
                <Check className="w-3.5 h-3.5" />
              ) : isCurrent ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>{i}</span>
              )}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a2e] border border-white/[0.08] rounded-md text-[10px] text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <span className="font-medium text-white">{phase.label}</span>
                <br />
                {phase.description}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-3 h-px ${isComplete ? 'bg-emerald-500/40' : isCurrent ? 'bg-indigo-500/30' : 'bg-white/[0.06]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Processing Queue Card
// ============================================
export function ProcessingCard({ job, onReview }: { job: ProcessingJobWithGallery; onReview: () => void }) {
  const progress = job.total_images > 0 ? Math.round((job.processed_images / job.total_images) * 100) : 0;
  const clientName = job.gallery?.job?.client
    ? `${job.gallery.job.client.first_name} ${job.gallery.job.client.last_name || ''}`
    : 'Unknown Client';
  const jobNumber = job.gallery?.job?.job_number ? `#${String(job.gallery.job.job_number).padStart(4, '0')}` : '';

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-5 hover:border-white/[0.1] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {jobNumber && <span className="text-xs font-mono text-slate-500">{jobNumber}</span>}
            <StatusBadge status={job.status} />
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{job.gallery?.title || 'Untitled Gallery'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{clientName}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-3">
          {job.status === 'completed' && (
            <Button size="sm" onClick={onReview}><Eye className="w-3 h-3" />Review</Button>
          )}
          {job.status === 'processing' && (
            <Button variant="ghost" size="sm" disabled><Loader2 className="w-3 h-3 animate-spin" />Processing</Button>
          )}
          {job.status === 'queued' && (
            <Button variant="secondary" size="sm" disabled><Clock className="w-3 h-3" />Queued</Button>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">{job.processed_images} / {job.total_images} images</span>
          <span className={`font-medium ${job.status === 'completed' ? 'text-emerald-400' : job.status === 'processing' ? 'text-indigo-400' : 'text-slate-500'}`}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === 'completed' ? 'bg-emerald-500' : job.status === 'processing' ? 'bg-indigo-500' : 'bg-slate-700'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <PhaseProgress currentPhase={job.current_phase} status={job.status} />
        <div className="text-[10px] text-slate-600">
          {job.status === 'completed' && job.completed_at && <span>Completed {formatDate(job.completed_at, 'relative')}</span>}
          {job.status === 'processing' && job.started_at && <span>Started {formatDate(job.started_at, 'relative')}</span>}
          {job.status === 'queued' && <span>Waiting...</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Style Profile Card
// ============================================
export function StyleCard({ profile, onDelete }: { profile: StyleProfile; onDelete: (id: string) => void }) {
  const imageCount = profile.reference_image_keys?.length || 0;
  const settings = (profile.settings || {}) as Record<string, any>;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] overflow-hidden hover:border-white/[0.1] transition-all group">
      <div className={`h-1 ${
        profile.status === 'ready' ? 'bg-emerald-500'
          : profile.status === 'training' ? 'bg-amber-500 animate-pulse'
          : profile.status === 'error' ? 'bg-red-500'
          : 'bg-slate-700'
      }`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-white">{profile.name}</h3>
              <StatusBadge status={profile.status} />
            </div>
            {profile.description && (
              <p className="text-xs text-slate-400 leading-relaxed mt-1">{profile.description}</p>
            )}
          </div>
          <button
            onClick={() => onDelete(profile.id)}
            className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />{imageCount} reference images
          </span>
          {profile.training_completed_at && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />Trained {formatDate(profile.training_completed_at, 'relative')}
            </span>
          )}
        </div>

        {profile.status === 'ready' && (
          <div className="flex flex-wrap gap-1.5">
            {settings.retouch_intensity && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Retouch: {settings.retouch_intensity}</span>
            )}
            {settings.cleanup_level && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Cleanup: {settings.cleanup_level}</span>
            )}
            {settings.skin_smoothing !== undefined && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Skin: {settings.skin_smoothing}%</span>
            )}
            {settings.auto_crop && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Auto crop</span>
            )}
            {settings.blemish_removal && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Blemish removal</span>
            )}
            {settings.horizon_correction && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">Horizon fix</span>
            )}
          </div>
        )}

        {profile.status === 'training' && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />Training in progress...
          </div>
        )}
      </div>
    </div>
  );
}

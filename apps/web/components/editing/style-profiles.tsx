'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getStyleProfiles, deleteStyleProfile } from '@/lib/queries';
import { CreateStyleFlow } from './style-upload';
import type { StyleProfile } from '@/lib/types';
import {
  Sparkles, Plus, Trash2, RefreshCw, Loader2, Check, AlertCircle,
  ImageIcon, Clock, Palette,
} from 'lucide-react';

export function StyleProfiles() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [retrainingId, setRetrainingId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await getStyleProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Error loading style profiles:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Poll for training status on any pending/training profiles
  useEffect(() => {
    const trainingProfiles = profiles.filter(
      (p) => p.status === 'pending' || p.status === 'training'
    );

    if (trainingProfiles.length > 0 && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        // Re-fetch all profiles to check for status updates
        const fresh = await getStyleProfiles();
        setProfiles(fresh);

        // Stop polling if nothing is training anymore
        const stillTraining = fresh.some(
          (p) => p.status === 'pending' || p.status === 'training'
        );
        if (!stillTraining && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [profiles]);

  const handleCreated = (profileId: string) => {
    // Refresh profiles to show the new one (status: training)
    loadProfiles();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteStyleProfile(deleteId);
    setDeleteId(null);
    loadProfiles();
  };

  const handleRetrain = async (profileId: string) => {
    setRetrainingId(profileId);
    try {
      const res = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retrain', profile_id: profileId }),
      });
      if (res.ok) {
        loadProfiles();
      }
    } catch (err) {
      console.error('Retrain failed:', err);
    }
    setRetrainingId(null);
  };

  const statusConfig = {
    pending: { label: 'Pending', color: 'text-slate-400', bgColor: 'bg-slate-500/10', icon: Clock },
    training: { label: 'Training...', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', icon: Loader2 },
    ready: { label: 'Ready', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Check },
    error: { label: 'Failed', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: AlertCircle },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            Train the AI to replicate your editing style from reference images.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3 h-3" />New Style
        </Button>
      </div>

      {/* Profiles list */}
      {profiles.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <Palette className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-slate-200 mb-1">No style profiles yet</p>
          <p className="text-xs text-slate-500 mb-4">
            Create a style profile by uploading 50–300 of your best edited photos. The AI will learn your colour grading, 
            white balance, contrast, and tonal preferences.
          </p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Sparkles className="w-3 h-3" />Create Your First Style
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {profiles.map((profile) => {
            const config = statusConfig[profile.status];
            const StatusIcon = config.icon;
            const refCount = profile.reference_image_keys?.length || 0;

            return (
              <div
                key={profile.id}
                className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4 flex items-center gap-4"
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                  {profile.status === 'training' ? (
                    <Loader2 className={`w-5 h-5 ${config.color} animate-spin`} />
                  ) : (
                    <Sparkles className={`w-5 h-5 ${config.color}`} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{profile.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bgColor} ${config.color}`}>
                      <StatusIcon className={`w-2.5 h-2.5 ${profile.status === 'training' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </span>
                  </div>
                  {profile.description && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{profile.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                      <ImageIcon className="w-2.5 h-2.5" />{refCount} reference images
                    </span>
                    {profile.training_completed_at && (
                      <span className="text-[10px] text-slate-600">
                        Trained {new Date(profile.training_completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {profile.status === 'ready' && (
                    <button
                      onClick={() => handleRetrain(profile.id)}
                      disabled={retrainingId === profile.id}
                      className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all disabled:opacity-50"
                      title="Re-train"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retrainingId === profile.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  {profile.status === 'error' && (
                    <button
                      onClick={() => handleRetrain(profile.id)}
                      disabled={retrainingId === profile.id}
                      className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all disabled:opacity-50"
                      title="Retry training"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retrainingId === profile.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(profile.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create flow modal */}
      <CreateStyleFlow
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Style Profile"
        message="This will permanently delete this style profile and its training data. Photos already edited with this style won't be affected."
        confirmLabel="Delete"
      />
    </div>
  );
}

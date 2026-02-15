'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { getProcessingJobs } from '@/lib/queries';
import type { ProcessingJob } from '@/lib/types';
import { ProcessingCard } from '@/components/editing/editing-cards';
import { ReviewWorkspace } from '@/components/editing/review-workspace';
import { PhotoUpload } from '@/components/editing/photo-upload';
import { StyleProfiles } from '@/components/editing/style-profiles';
import {
  generateMockProcessingJobs,
  type ProcessingJobWithGallery,
} from '@/components/editing/mock-data';
import {
  Wand2, CheckCircle2, Sparkles, Eye,
  Clock, Image as ImageIcon, Loader2, Palette,
} from 'lucide-react';

type TabId = 'upload' | 'queue' | 'review' | 'styles';

export default function EditingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJobWithGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingJob, setReviewingJob] = useState<ProcessingJobWithGallery | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pjData = await getProcessingJobs();

      if (pjData.length === 0) {
        setUseMockData(true);
        setProcessingJobs(generateMockProcessingJobs());
      } else {
        setUseMockData(false);
        setProcessingJobs(pjData as ProcessingJobWithGallery[]);
      }
    } catch (err) {
      console.error('Error loading editing data:', err);
      setUseMockData(true);
      setProcessingJobs(generateMockProcessingJobs());
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for processing job status when on the queue tab
  useEffect(() => {
    if (activeTab !== 'queue') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const activeJobs = processingJobs.filter(
      (j) => j.status === 'processing' || j.status === 'queued'
    );

    if (activeJobs.length > 0 && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        // Poll status for each active job via the API bridge
        for (const job of activeJobs) {
          try {
            const res = await fetch('/api/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'status', job_id: job.id }),
            });
            if (res.ok) {
              const statusData = await res.json();
              setProcessingJobs((prev) =>
                prev.map((p) =>
                  p.id === job.id
                    ? {
                        ...p,
                        status: statusData.status,
                        current_phase: statusData.current_phase,
                        processed_images: statusData.processed_images ?? p.processed_images,
                      }
                    : p
                )
              );
            }
          } catch {
            // AI engine not reachable — skip this poll
          }
        }

        // Refresh full list if any job completed
        const fresh = await getProcessingJobs();
        if (fresh.length > 0) {
          setProcessingJobs(fresh as ProcessingJobWithGallery[]);
          setUseMockData(false);
        }

        // Stop polling if no more active jobs
        const stillActive = fresh.some(
          (j: ProcessingJob) => j.status === 'processing' || j.status === 'queued'
        );
        if (!stillActive && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }, 4000); // Poll every 4 seconds
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeTab, processingJobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (reviewingJob) {
    return <ReviewWorkspace processingJob={reviewingJob} onBack={() => setReviewingJob(null)} />;
  }

  const queuedCount = processingJobs.filter((j) => j.status === 'queued' || j.status === 'processing').length;
  const completedCount = processingJobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Auto Editor</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered photo processing pipeline</p>
        </div>
      </div>

      {useMockData && activeTab !== 'styles' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Showing demo data — processing jobs will appear here once you upload photos to a job.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] -mb-px overflow-x-auto">
        {([
          { id: 'upload' as TabId, label: 'Upload Photos', count: undefined },
          { id: 'queue' as TabId, label: 'Processing Queue', count: queuedCount > 0 ? queuedCount : undefined },
          { id: 'review' as TabId, label: 'Ready for Review', count: completedCount > 0 ? completedCount : undefined },
          { id: 'styles' as TabId, label: 'Style Profiles', count: undefined },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                  activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.06] text-slate-500'
                }`}>{tab.count}</span>
              )}
            </span>
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {activeTab === 'upload' && (
        <div className="max-w-2xl">
          <PhotoUpload onUploadComplete={() => loadData()} />
        </div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Processing', value: processingJobs.filter((j) => j.status === 'processing').length, icon: Loader2, color: 'indigo' },
              { label: 'Queued', value: processingJobs.filter((j) => j.status === 'queued').length, icon: Clock, color: 'slate' },
              { label: 'Completed', value: processingJobs.filter((j) => j.status === 'completed').length, icon: CheckCircle2, color: 'emerald' },
              { label: 'Total Images', value: processingJobs.reduce((sum, j) => sum + j.total_images, 0), icon: ImageIcon, color: 'violet' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          {processingJobs.length === 0 ? (
            <EmptyState icon={Wand2} title="No processing jobs" description="Upload photos to a job and the AI processing pipeline will appear here." />
          ) : (
            <div className="space-y-3">
              {processingJobs.filter((j) => j.status === 'processing' || j.status === 'queued').map((job) => (
                <ProcessingCard key={job.id} job={job} onReview={() => setReviewingJob(job)} />
              ))}
              {processingJobs.filter((j) => j.status === 'processing' || j.status === 'queued').length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">No active processing jobs. All caught up!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review tab */}
      {activeTab === 'review' && (
        <div className="space-y-3">
          {processingJobs.filter((j) => j.status === 'completed').length === 0 ? (
            <EmptyState icon={Eye} title="Nothing to review" description="Completed processing jobs will appear here for you to review and approve." />
          ) : (
            processingJobs.filter((j) => j.status === 'completed').map((job) => (
              <ProcessingCard key={job.id} job={job} onReview={() => setReviewingJob(job)} />
            ))
          )}
        </div>
      )}

      {/* Style Profiles tab */}
      {activeTab === 'styles' && <StyleProfiles />}
    </div>
  );
}

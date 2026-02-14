'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import {
  getProcessingJobs,
  getStyleProfiles,
  createStyleProfile,
  deleteStyleProfile,
} from '@/lib/queries';
import type { ProcessingJob, StyleProfile } from '@/lib/types';
import { ProcessingCard, StyleCard } from '@/components/editing/editing-cards';
import { ReviewWorkspace } from '@/components/editing/review-workspace';
import {
  generateMockProcessingJobs,
  generateMockStyles,
  type ProcessingJobWithGallery,
} from '@/components/editing/mock-data';
import {
  Wand2, Plus, CheckCircle2, Sparkles, Palette, Upload, Eye,
  Clock, Image as ImageIcon, Loader2,
} from 'lucide-react';

type TabId = 'queue' | 'review' | 'styles';

// ============================================
// Create Style Modal
// ============================================
function CreateStyleModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, description: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name, description);
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Style Profile">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Style Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Clean & Bright, Moody Film..."
            className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the look and feel of this style..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none"
          />
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-start gap-2">
            <Upload className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-300">Reference Images</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Upload 50–200 reference images that represent your editing style. These will be used to train the AI to match your look.
              </p>
              <button className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium">Upload images →</button>
              <p className="text-[10px] text-slate-600 mt-1">File upload infrastructure coming soon. Style profile will be saved and ready for training once uploads are enabled.</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim()}>
            <Plus className="w-3 h-3" />Create Style
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Main Page
// ============================================
export default function EditingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [processingJobs, setProcessingJobs] = useState<ProcessingJobWithGallery[]>([]);
  const [styles, setStyles] = useState<StyleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingJob, setReviewingJob] = useState<ProcessingJobWithGallery | null>(null);
  const [showCreateStyle, setShowCreateStyle] = useState(false);
  const [useMockData, setUseMockData] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pjData, styleData] = await Promise.all([
        getProcessingJobs(),
        getStyleProfiles(),
      ]);

      if (pjData.length === 0 && styleData.length === 0) {
        setUseMockData(true);
        setProcessingJobs(generateMockProcessingJobs());
        setStyles(generateMockStyles());
      } else {
        setProcessingJobs(pjData as ProcessingJobWithGallery[]);
        setStyles(styleData);
      }
    } catch (err) {
      console.error('Error loading editing data:', err);
      setUseMockData(true);
      setProcessingJobs(generateMockProcessingJobs());
      setStyles(generateMockStyles());
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateStyle = async (name: string, description: string) => {
    if (useMockData) {
      const newStyle: StyleProfile = {
        id: `sp-new-${Date.now()}`,
        photographer_id: 'p-1',
        name,
        description,
        reference_image_keys: [],
        settings: { retouch_intensity: 'medium', cleanup_level: 'moderate' },
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setStyles((prev) => [newStyle, ...prev]);
    } else {
      const result = await createStyleProfile({ name, description });
      if (result) setStyles((prev) => [result, ...prev]);
    }
  };

  const handleDeleteStyle = async (id: string) => {
    if (useMockData) {
      setStyles((prev) => prev.filter((s) => s.id !== id));
    } else {
      const ok = await deleteStyleProfile(id);
      if (ok) setStyles((prev) => prev.filter((s) => s.id !== id));
    }
  };

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
          <h1 className="text-2xl font-bold text-white tracking-tight">Auto Editing</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered photo processing pipeline</p>
        </div>
      </div>

      {useMockData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Showing demo data — processing jobs will appear here once you upload photos to a job.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] -mb-px overflow-x-auto">
        {([
          { id: 'queue' as TabId, label: 'Processing Queue', count: queuedCount > 0 ? queuedCount : undefined },
          { id: 'review' as TabId, label: 'Ready for Review', count: completedCount > 0 ? completedCount : undefined },
          { id: 'styles' as TabId, label: 'Style Profiles', count: styles.length > 0 ? styles.length : undefined },
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

      {/* Styles tab */}
      {activeTab === 'styles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Style profiles teach the AI your editing look. Upload 50–200 reference images and the AI learns your style.
            </p>
            <Button size="sm" onClick={() => setShowCreateStyle(true)}>
              <Plus className="w-3.5 h-3.5" />New Style
            </Button>
          </div>

          {styles.length === 0 ? (
            <EmptyState icon={Palette} title="No style profiles" description="Create a style profile to teach the AI your editing look. Upload 50–200 reference images to get started." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {styles.map((profile) => (
                <StyleCard key={profile.id} profile={profile} onDelete={handleDeleteStyle} />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateStyleModal open={showCreateStyle} onClose={() => setShowCreateStyle(false)} onCreate={handleCreateStyle} />
    </div>
  );
}

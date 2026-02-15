'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  getUploadableJobs,
  getCurrentPhotographer,
  uploadPhotoToStorage,
  createPhotoRecord,
  createGalleryForJob,
  updateJob,
  getStyleProfiles,
} from '@/lib/queries';
import type { Job, StyleProfile } from '@/lib/types';
import {
  Upload, X, Check, AlertCircle, Loader2, Camera,
  FolderOpen, ChevronDown, ImageIcon, FileWarning, Sparkles, Wand2,
} from 'lucide-react';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface PhotoUploadProps {
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'image/x-canon-cr2', 'image/x-canon-cr3', 'image/x-nikon-nef',
  'image/x-sony-arw', 'image/x-adobe-dng', 'image/x-fuji-raf',
  'image/x-olympus-orf', 'image/x-panasonic-rw2',
  'application/octet-stream',
];

const ACCEPTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif',
  '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isValidFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function PhotoUpload({ onUploadComplete }: PhotoUploadProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [processingTriggered, setProcessingTriggered] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [autoProcess, setAutoProcess] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    async function load() {
      const [jobData, profileData] = await Promise.all([
        getUploadableJobs(),
        getStyleProfiles(),
      ]);
      setJobs(jobData);
      const readyProfiles = profileData.filter((p) => p.status === 'ready');
      setStyleProfiles(readyProfiles);
      // Auto-select the first ready style profile
      if (readyProfiles.length > 0 && !selectedStyleId) {
        setSelectedStyleId(readyProfiles[0].id);
      }
      setLoadingJobs(false);
    }
    load();
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles: UploadFile[] = [];
    const invalid: string[] = [];

    Array.from(newFiles).forEach((file) => {
      if (isValidFile(file)) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        fileMapRef.current.set(id, file);
        validFiles.push({
          id,
          file,
          progress: 0,
          status: 'pending',
        });
      } else {
        invalid.push(file.name);
      }
    });

    if (invalid.length > 0) {
      console.warn('Rejected files:', invalid);
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setUploadComplete(false);
    setProcessingTriggered(false);
    setProcessingError(null);
  };

  const startUpload = async () => {
    if (!selectedJob || files.length === 0) return;

    setUploading(true);
    setUploadComplete(false);

    try {
      const photographer = await getCurrentPhotographer();
      if (!photographer) {
        console.error('No photographer found');
        setUploading(false);
        return;
      }

      // Create gallery for this job
      const clientName = selectedJob.client
        ? `${selectedJob.client.first_name} ${selectedJob.client.last_name || ''}`
        : 'Untitled';
      const galleryTitle = selectedJob.title || `${clientName} — ${selectedJob.job_type || 'Photos'}`;
      const gallery = await createGalleryForJob(selectedJob.id, galleryTitle);

      if (!gallery) {
        console.error('Failed to create gallery');
        setUploading(false);
        return;
      }

      // Update job status to editing
      await updateJob(selectedJob.id, { status: 'editing' as any });

      // Upload each file sequentially
      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i];
        const actualFile = fileMapRef.current.get(uploadFile.id) || uploadFile.file;

        // Mark as uploading
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f))
        );

        try {
          const result = await uploadPhotoToStorage(
            actualFile,
            photographer.id,
            gallery.id
          );

          if (result) {
            // Create photo record in database
            await createPhotoRecord({
              gallery_id: gallery.id,
              original_key: result.storageKey,
              filename: uploadFile.file.name,
              file_size: uploadFile.file.size,
              mime_type: uploadFile.file.type || 'application/octet-stream',
              sort_order: i,
            });

            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'complete' as const, progress: 100 } : f))
            );
          } else {
            setFiles((prev) =>
              prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'error' as const, error: 'Upload failed' } : f))
            );
          }
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? { ...f, status: 'error' as const, error: err instanceof Error ? err.message : 'Upload failed' }
                : f
            )
          );
        }
      }

      // Update gallery with photo count
      setUploadComplete(true);

      // Auto-trigger AI processing pipeline
      if (autoProcess && gallery) {
        setProcessingTriggered(true);
        setProcessingError(null);
        try {
          const processRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'process',
              gallery_id: gallery.id,
              style_profile_id: selectedStyleId || null,
              included_images: selectedJob.included_images || null,
            }),
          });
          const processResult = await processRes.json();
          if (!processRes.ok || processResult.status === 'error') {
            setProcessingError(processResult.message || processResult.error || 'Failed to start processing');
          }
        } catch (err) {
          setProcessingError('AI Engine not reachable. Start it locally or check Railway deployment.');
        }
      }

      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
    }

    setUploading(false);
  };

  const completedCount = files.filter((f) => f.status === 'complete').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="space-y-5">
      {/* Step 1: Select Job */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">1. Select a job to upload photos to</label>
        {loadingJobs ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
            <Loader2 className="w-3 h-3 animate-spin" />Loading jobs...
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-300 font-medium">No jobs available for upload</p>
              <p className="text-[11px] text-amber-400/60 mt-0.5">Create a job first from the Jobs page, then come back here to upload photos.</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowJobPicker(!showJobPicker)}
              disabled={uploading}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-left hover:border-white/[0.12] transition-all disabled:opacity-50"
            >
              {selectedJob ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-slate-200 truncate block">
                      {selectedJob.job_number ? `#${String(selectedJob.job_number).padStart(4, '0')} — ` : ''}
                      {selectedJob.title || selectedJob.job_type || 'Untitled Job'}
                    </span>
                    {selectedJob.client && (
                      <span className="text-[11px] text-slate-500">
                        {selectedJob.client.first_name} {selectedJob.client.last_name || ''}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">Select a job...</span>
              )}
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showJobPicker ? 'rotate-180' : ''}`} />
            </button>

            {showJobPicker && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0c0c16] shadow-xl">
                {jobs.map((job) => {
                  const clientName = job.client ? `${job.client.first_name} ${job.client.last_name || ''}` : '';
                  return (
                    <button
                      key={job.id}
                      onClick={() => { setSelectedJob(job); setShowJobPicker(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors ${
                        selectedJob?.id === job.id ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <Camera className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-200 truncate">
                          {job.job_number ? `#${String(job.job_number).padStart(4, '0')} — ` : ''}
                          {job.title || job.job_type || 'Untitled Job'}
                        </p>
                        <p className="text-[10px] text-slate-500">{clientName}{job.date ? ` · ${job.date}` : ''}</p>
                      </div>
                      {selectedJob?.id === job.id && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Style Profile (optional) */}
      {selectedJob && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">2. Choose a style profile <span className="text-slate-600">(optional)</span></label>
          {styleProfiles.length === 0 ? (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-slate-500">No trained styles yet. Photos will be processed without style matching.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Create a style profile in the Style Profiles tab to apply your editing look automatically.</p>
              </div>
            </div>
          ) : (
            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              disabled={uploading}
              className="w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50"
            >
              <option value="">No style — process without colour grading</option>
              {styleProfiles.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}{sp.description ? ` — ${sp.description}` : ''}</option>
              ))}
            </select>
          )}

          {/* Auto-process toggle */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setAutoProcess(!autoProcess)}
              className={`relative w-8 h-[18px] rounded-full transition-colors ${autoProcess ? 'bg-indigo-500' : 'bg-white/[0.1]'}`}
            >
              <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${autoProcess ? 'left-[16px]' : 'left-[2px]'}`} />
            </button>
            <span className="text-[11px] text-slate-400">
              {autoProcess ? 'Auto-process after upload' : 'Upload only — process manually later'}
            </span>
          </div>
        </div>
      )}

      {/* Step 3: Drop zone */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">{selectedJob ? '3' : '2'}. Add your photos</label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
            dragOver
              ? 'border-indigo-500 bg-indigo-500/5'
              : files.length > 0
              ? 'border-white/[0.08] bg-white/[0.02]'
              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.03]'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />

          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-200 mb-1">Drag & drop your photos here</p>
              <p className="text-xs text-slate-500 mb-3">or click to browse files</p>
              <p className="text-[10px] text-slate-600">
                Supports RAW formats (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2) + JPEG, PNG, TIFF · Max 100MB per file
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-300 font-medium">{files.length} files</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-500">{formatFileSize(totalSize)}</span>
                  {completedCount > 0 && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-emerald-400">{completedCount} uploaded</span>
                    </>
                  )}
                  {errorCount > 0 && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-red-400">{errorCount} failed</span>
                    </>
                  )}
                </div>
                {!uploading && (
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); clearAll(); }} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* File list */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1" onClick={(e) => e.stopPropagation()}>
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] group">
                    <ImageIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
                      f.status === 'complete' ? 'text-emerald-400' : f.status === 'error' ? 'text-red-400' : f.status === 'uploading' ? 'text-indigo-400' : 'text-slate-600'
                    }`} />
                    <span className="text-[11px] text-slate-300 truncate flex-1 min-w-0">{f.file.name}</span>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">{formatFileSize(f.file.size)}</span>
                    {f.status === 'complete' && <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                    {f.status === 'error' && (
                      <span className="text-[10px] text-red-400 flex-shrink-0" title={f.error}><AlertCircle className="w-3 h-3" /></span>
                    )}
                    {f.status === 'uploading' && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />}
                    {f.status === 'pending' && !uploading && (
                      <button onClick={() => removeFile(f.id)} className="p-0.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!uploading && !uploadComplete && (
                <div className="flex items-center justify-center pt-3 border-t border-white/[0.04] mt-3">
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                    + Add more files
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload progress summary */}
      {uploading && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            <span className="text-xs font-medium text-indigo-300">
              Uploading {completedCount} of {files.length}...
            </span>
          </div>
          <div className="h-1.5 bg-indigo-500/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${files.length > 0 ? (completedCount / files.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Complete message */}
      {uploadComplete && (
        <div className="space-y-2">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-emerald-300 font-medium">Upload complete!</p>
              <p className="text-[11px] text-emerald-400/60 mt-0.5">
                {completedCount} photos uploaded. Job status changed to &quot;Editing&quot;.
                {errorCount > 0 && ` ${errorCount} files failed — you can retry them.`}
              </p>
            </div>
          </div>

          {/* AI Processing status */}
          {processingTriggered && !processingError && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2">
              <Wand2 className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-indigo-300 font-medium">AI processing started</p>
                <p className="text-[11px] text-indigo-400/60 mt-0.5">
                  {selectedStyleId ? 'Applying your style profile and processing all phases.' : 'Processing without style — analysis, composition, and output generation.'}
                  {' '}Check the Processing Queue tab for live progress.
                </p>
              </div>
            </div>
          )}

          {processingError && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-amber-300 font-medium">AI processing could not start</p>
                <p className="text-[11px] text-amber-400/60 mt-0.5">{processingError}</p>
                <p className="text-[10px] text-amber-500/50 mt-1">Photos uploaded successfully — you can trigger processing manually later from the Processing Queue.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {uploadComplete ? (
          <Button size="sm" onClick={clearAll}>
            <Upload className="w-3 h-3" />Upload More
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={startUpload}
            disabled={!selectedJob || files.length === 0 || uploading}
          >
            {uploading ? (
              <><Loader2 className="w-3 h-3 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="w-3 h-3" />Upload {files.length > 0 ? `${files.length} Photos` : 'Photos'}</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

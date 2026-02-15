'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getCurrentPhotographer } from '@/lib/queries';
import {
  Upload, X, Check, AlertCircle, Loader2, Camera, Sparkles,
} from 'lucide-react';

const MIN_IMAGES = 50;
const RECOMMENDED_IMAGES = 200;
const MAX_IMAGES = 300;

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];

interface StyleUploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
}

interface CreateStyleFlowProps {
  open: boolean;
  onClose: () => void;
  onCreated: (profileId: string) => void;
}

export function CreateStyleFlow({ open, onClose, onCreated }: CreateStyleFlowProps) {
  const [step, setStep] = useState<'details' | 'upload' | 'training'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<StyleUploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<'uploading' | 'starting' | 'training' | 'error' | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('details');
    setName('');
    setDescription('');
    setFiles([]);
    setUploading(false);
    setUploadProgress(0);
    setTrainingStatus(null);
    setTrainingError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const remaining = MAX_IMAGES - files.length;
    const toAdd = Array.from(newFiles).slice(0, remaining);

    const mapped: StyleUploadFile[] = toAdd
      .filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return ACCEPTED_EXTENSIONS.includes(ext);
      })
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'pending' as const,
      }));

    setFiles((prev) => [...prev, ...mapped]);
  }, [files.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    if (files.length < MIN_IMAGES) return;

    setUploading(true);
    setUploadProgress(0);
    setTrainingStatus('uploading');
    setTrainingError(null);

    try {
      const photographer = await getCurrentPhotographer();
      if (!photographer) {
        setTrainingError('No photographer profile found');
        setTrainingStatus('error');
        setUploading(false);
        return;
      }

      const imageKeys: string[] = [];
      const styleFolderName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

      // Upload each reference image via server-side API route
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'uploading' } : p));

        try {
          const safeName = f.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageKey = `${photographer.id}/styles/${styleFolderName}/${Date.now()}_${safeName}`;

          // Upload via server-side route (bypasses browser auth cookie issue)
          const formData = new FormData();
          formData.append('file', f.file);
          formData.append('storageKey', storageKey);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const result = await res.json();

          if (!res.ok || result.error) {
            throw new Error(result.error || 'Upload failed');
          }

          imageKeys.push(result.storageKey);
          setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'complete' } : p));
        } catch (err) {
          console.error(`Failed to upload ${f.file.name}:`, err);
          setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'error' } : p));
        }

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      if (imageKeys.length < 10) {
        setTrainingError(`Only ${imageKeys.length} images uploaded successfully — need at least 10 for training.`);
        setTrainingStatus('error');
        setUploading(false);
        return;
      }

      // Trigger training via AI engine bridge route
      setTrainingStatus('starting');

      const trainRes = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          photographer_id: photographer.id,
          name,
          description: description || null,
          reference_image_keys: imageKeys,
        }),
      });

      const trainResult = await trainRes.json();

      if (!trainRes.ok || trainResult.status === 'error') {
        setTrainingError(trainResult.message || trainResult.error || 'Failed to start training');
        setTrainingStatus('error');
        setUploading(false);
        return;
      }

      setTrainingStatus('training');
      setStep('training');
      setUploading(false);

      // Pass the profile ID back to parent for polling
      if (trainResult.id) {
        onCreated(trainResult.id);
      }

    } catch (err) {
      console.error('Style upload error:', err);
      setTrainingError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setTrainingStatus('error');
      setUploading(false);
    }
  };

  const imageCountStatus = files.length < MIN_IMAGES ? 'insufficient' : files.length < RECOMMENDED_IMAGES ? 'good' : 'excellent';

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Create Style Profile" className="sm:max-w-2xl">
      <div className="space-y-5">
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {(['details', 'upload', 'training'] as const).map((s, i) => {
            const labels = ['Name & Description', 'Upload Reference Images', 'Training'];
            const isCurrent = step === s;
            const isComplete = (step === 'upload' && i === 0) || (step === 'training' && i < 2);
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 ${isCurrent ? 'text-indigo-400' : isComplete ? 'text-emerald-400' : 'text-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    isCurrent ? 'border-indigo-500/40 bg-indigo-500/20' : isComplete ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-white/[0.08] bg-white/[0.02]'
                  }`}>
                    {isComplete ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium">{labels[i]}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px ${isComplete ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Style Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Clean & Bright, Moody Film, Warm Editorial..."
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description <span className="text-slate-600">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the look — helps you remember what this style is for..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none"
              />
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">How it works</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Upload 50–300 of your best edited images and the AI will learn everything about your style — exposure, colour grading, 
                    white balance, contrast, tone curves, skin tone handling, saturation, and how you keep everything consistent across 
                    different scenes and lighting conditions. The more variety you give it, the better it handles edge cases.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setStep('upload')} disabled={!name.trim()}>
                Next — Upload Images
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload reference images */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Image count indicator */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">{files.length} images added</span>
                <span className={`font-medium ${
                  imageCountStatus === 'insufficient' ? 'text-red-400'
                    : imageCountStatus === 'good' ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {imageCountStatus === 'insufficient' ? `Need ${MIN_IMAGES - files.length} more`
                    : imageCountStatus === 'good' ? 'Good — more is better'
                    : 'Excellent'}
                </span>
              </div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    imageCountStatus === 'insufficient' ? 'bg-red-500' : imageCountStatus === 'good' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((files.length / MAX_IMAGES) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                <span>0</span>
                <span>{MIN_IMAGES} min</span>
                <span>{RECOMMENDED_IMAGES} ideal</span>
                <span>{MAX_IMAGES}</span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
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
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-200 mb-1">Drop your edited photos here</p>
                  <p className="text-xs text-slate-500">JPEG, PNG, TIFF — your finished, edited work</p>
                </div>
              ) : (
                <div className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-40 overflow-y-auto">
                    {files.map((f) => (
                      <div key={f.id} className="relative aspect-square rounded bg-white/[0.04] flex items-center justify-center group">
                        <Camera className={`w-3 h-3 ${
                          f.status === 'complete' ? 'text-emerald-600' : f.status === 'error' ? 'text-red-600' : f.status === 'uploading' ? 'text-indigo-400' : 'text-slate-700'
                        }`} />
                        {f.status === 'complete' && (
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="w-1.5 h-1.5 text-white" />
                          </div>
                        )}
                        {f.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded">
                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                          </div>
                        )}
                        {f.status === 'error' && (
                          <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 flex items-center justify-center">
                            <X className="w-1.5 h-1.5 text-white" />
                          </div>
                        )}
                        {f.status === 'pending' && !uploading && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2 h-2 text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                    {files.length < MAX_IMAGES && !uploading && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded border border-dashed border-white/[0.1] flex items-center justify-center hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all"
                      >
                        <span className="text-lg text-slate-600">+</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            {files.length > 0 && files.length < MIN_IMAGES && (
              <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                <p className="text-[11px] font-medium text-slate-300 mb-1.5">For best results, include a mix of:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-500">
                  <span>• Indoor & outdoor shots</span>
                  <span>• Different skin tones</span>
                  <span>• Natural light & flash</span>
                  <span>• Ceremony & reception</span>
                  <span>• Golden hour & overcast</span>
                  <span>• Portraits & details</span>
                </div>
              </div>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs font-medium text-indigo-300">
                    {trainingStatus === 'uploading' && `Uploading reference images... ${uploadProgress}%`}
                    {trainingStatus === 'starting' && 'Starting AI training...'}
                  </span>
                </div>
                <div className="h-1.5 bg-indigo-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Error */}
            {trainingStatus === 'error' && trainingError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-red-300 font-medium">Training failed</p>
                  <p className="text-[11px] text-red-400/60 mt-0.5">{trainingError}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('details')} disabled={uploading}>← Back</Button>
              <Button size="sm" onClick={handleSubmit} disabled={files.length < MIN_IMAGES || uploading}>
                {uploading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Processing...</>
                ) : (
                  <><Sparkles className="w-3 h-3" />Upload & Start Training</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Training started */}
        {step === 'training' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-emerald-300 mb-1">Training started!</p>
              <p className="text-xs text-emerald-400/60 leading-relaxed">
                The AI is now analysing your {files.filter(f => f.status === 'complete').length} reference images to learn your 
                editing style. This usually takes a minute or two. You can close this dialog — the style will appear 
                as &quot;Ready&quot; in your Style Profiles when training is complete.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleClose}>
                <Check className="w-3 h-3" />Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

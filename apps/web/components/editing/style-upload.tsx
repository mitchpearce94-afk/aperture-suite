'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getCurrentPhotographer } from '@/lib/queries';
import {
  Upload, X, Check, AlertCircle, Loader2, Camera, Sparkles,
  ArrowRight, Layers, Zap,
} from 'lucide-react';

const MIN_PAIRS = 20;
const RECOMMENDED_PAIRS = 50;
const MAX_PAIRS = 200;
const MIN_REFS = 100;
const RECOMMENDED_REFS = 200;
const MAX_REFS = 300;

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
}

interface PairFile {
  id: string;
  originalFile: File;
  editedFile: File;
  baseName: string;
  status: 'matched' | 'uploading' | 'complete' | 'error';
}

type TrainingMode = 'pairs' | 'reference';

interface CreateStyleFlowProps {
  open: boolean;
  onClose: () => void;
  onCreated: (profileId: string) => void;
}

export function CreateStyleFlow({ open, onClose, onCreated }: CreateStyleFlowProps) {
  const [step, setStep] = useState<'details' | 'upload' | 'training'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('pairs');

  // Pair mode state
  const [originalFiles, setOriginalFiles] = useState<File[]>([]);
  const [editedFiles, setEditedFiles] = useState<File[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<PairFile[]>([]);
  const [unmatchedOriginals, setUnmatchedOriginals] = useState<string[]>([]);
  const [unmatchedEdited, setUnmatchedEdited] = useState<string[]>([]);

  // Reference mode state
  const [refFiles, setRefFiles] = useState<UploadFile[]>([]);

  // Shared state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState<'uploading' | 'starting' | 'training' | 'error' | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'original' | 'edited' | 'ref' | null>(null);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const editedInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('details');
    setName('');
    setDescription('');
    setTrainingMode('pairs');
    setOriginalFiles([]);
    setEditedFiles([]);
    setMatchedPairs([]);
    setUnmatchedOriginals([]);
    setUnmatchedEdited([]);
    setRefFiles([]);
    setUploading(false);
    setUploadProgress(0);
    setTrainingStatus(null);
    setTrainingError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // ─── Pair matching logic ─────────────────────────────
  const getBaseName = (filename: string): string => {
    const noExt = filename.replace(/\.[^.]+$/, '');
    return noExt
      .replace(/[-_ ]?(edited|final|edit|processed|output|after|new|v2|done|retouched|colour|color|graded)$/i, '')
      .toLowerCase()
      .trim();
  };

  const matchFiles = useCallback((originals: File[], edited: File[]) => {
    const editedMap = new Map<string, File>();
    edited.forEach(f => editedMap.set(getBaseName(f.name), f));

    const pairs: PairFile[] = [];
    const unmatched_orig: string[] = [];

    originals.forEach(orig => {
      const base = getBaseName(orig.name);
      const match = editedMap.get(base);
      if (match) {
        pairs.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          originalFile: orig,
          editedFile: match,
          baseName: base,
          status: 'matched',
        });
        editedMap.delete(base);
      } else {
        unmatched_orig.push(orig.name);
      }
    });

    const unmatched_edit = Array.from(editedMap.values()).map(f => f.name);

    setMatchedPairs(pairs.slice(0, MAX_PAIRS));
    setUnmatchedOriginals(unmatched_orig);
    setUnmatchedEdited(unmatched_edit);
  }, []);

  const isValidImage = (f: File) => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const addOriginals = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(isValidImage);
    const newOriginals = [...originalFiles, ...valid];
    setOriginalFiles(newOriginals);
    if (editedFiles.length > 0) matchFiles(newOriginals, editedFiles);
  }, [originalFiles, editedFiles, matchFiles]);

  const addEdited = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(isValidImage);
    const newEdited = [...editedFiles, ...valid];
    setEditedFiles(newEdited);
    if (originalFiles.length > 0) matchFiles(originalFiles, newEdited);
  }, [originalFiles, editedFiles, matchFiles]);

  const addRefFiles = useCallback((newFiles: FileList | File[]) => {
    const remaining = MAX_REFS - refFiles.length;
    const toAdd = Array.from(newFiles).slice(0, remaining)
      .filter(isValidImage)
      .map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'pending' as const,
      }));
    setRefFiles(prev => [...prev, ...toAdd]);
  }, [refFiles.length]);

  // ─── Upload helper ───────────────────────────────────
  const uploadFile = async (file: File, storageKey: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storageKey', storageKey);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Upload failed');
    return result.storageKey;
  };

  // ─── Submit ──────────────────────────────────────────
  const handleSubmit = async () => {
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

      const styleFolderName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

      if (trainingMode === 'pairs') {
        // Upload before/after pairs
        const pairs: { original_key: string; edited_key: string }[] = [];
        const allRefKeys: string[] = [];

        for (let i = 0; i < matchedPairs.length; i++) {
          const pair = matchedPairs[i];
          setMatchedPairs(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'uploading' } : p));

          try {
            const origName = pair.originalFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const editName = pair.editedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const ts = Date.now();
            const origKey = `${photographer.id}/styles/${styleFolderName}/originals/${ts}_${origName}`;
            const editKey = `${photographer.id}/styles/${styleFolderName}/edited/${ts}_${editName}`;

            const uploadedOrigKey = await uploadFile(pair.originalFile, origKey);
            const uploadedEditKey = await uploadFile(pair.editedFile, editKey);

            pairs.push({ original_key: uploadedOrigKey, edited_key: uploadedEditKey });
            allRefKeys.push(uploadedOrigKey, uploadedEditKey);
            setMatchedPairs(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'complete' } : p));
          } catch (err) {
            console.error(`Failed to upload pair ${pair.baseName}:`, err);
            setMatchedPairs(prev => prev.map(p => p.id === pair.id ? { ...p, status: 'error' } : p));
          }

          setUploadProgress(Math.round(((i + 1) / matchedPairs.length) * 100));
        }

        if (pairs.length < 5) {
          setTrainingError(`Only ${pairs.length} pairs uploaded. Need at least 5.`);
          setTrainingStatus('error');
          setUploading(false);
          return;
        }

        // Trigger GPU neural training via Next.js bridge → Railway
        setTrainingStatus('starting');
        const trainRes = await fetch('/api/style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'train_neural',
            photographer_id: photographer.id,
            name,
            description: description || null,
            reference_image_keys: allRefKeys,
            pairs,
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
        if (trainResult.id) onCreated(trainResult.id);

      } else {
        // Reference-only mode (existing flow — CPU histogram)
        const imageKeys: string[] = [];

        for (let i = 0; i < refFiles.length; i++) {
          const f = refFiles[i];
          setRefFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'uploading' } : p));

          try {
            const safeName = f.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageKey = `${photographer.id}/styles/${styleFolderName}/${Date.now()}_${safeName}`;
            const uploadedKey = await uploadFile(f.file, storageKey);
            imageKeys.push(uploadedKey);
            setRefFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'complete' } : p));
          } catch (err) {
            console.error(`Failed to upload ${f.file.name}:`, err);
            setRefFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'error' } : p));
          }

          setUploadProgress(Math.round(((i + 1) / refFiles.length) * 100));
        }

        if (imageKeys.length < 10) {
          setTrainingError(`Only ${imageKeys.length} images uploaded. Need at least 10.`);
          setTrainingStatus('error');
          setUploading(false);
          return;
        }

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
        if (trainResult.id) onCreated(trainResult.id);
      }
    } catch (err) {
      console.error('Style upload error:', err);
      setTrainingError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setTrainingStatus('error');
      setUploading(false);
    }
  };

  const pairsReady = trainingMode === 'pairs' && matchedPairs.length >= MIN_PAIRS;
  const refsReady = trainingMode === 'reference' && refFiles.length >= MIN_REFS;
  const canSubmit = pairsReady || refsReady;

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Create Style Profile" className="sm:max-w-2xl">
      <div className="space-y-5">
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {(['details', 'upload', 'training'] as const).map((s, i) => {
            const labels = ['Name & Method', 'Upload Images', 'Training'];
            const isCurrent = step === s;
            const isComplete = (step === 'upload' && i === 0) || (step === 'training' && i < 2);
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 ${isCurrent ? 'text-amber-400' : isComplete ? 'text-emerald-400' : 'text-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    isCurrent ? 'border-amber-500/40 bg-amber-500/20' : isComplete ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-white/[0.08] bg-white/[0.02]'
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

        {/* ─── Step 1: Details & Training Mode ─── */}
        {step === 'details' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Style Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Clean & Bright, Moody Film, Warm Editorial..."
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description <span className="text-slate-600">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the look — helps you remember what this style is for..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none"
              />
            </div>

            {/* Training mode selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Training Method</label>
              <div className="grid grid-cols-2 gap-3">
                {/* Before/After Pairs — Recommended */}
                <button
                  onClick={() => setTrainingMode('pairs')}
                  className={`relative rounded-xl border p-3.5 text-left transition-all ${
                    trainingMode === 'pairs'
                      ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                >
                  {trainingMode === 'pairs' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-amber-400" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Before & After Pairs</p>
                      <span className="text-[9px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">GPU · Recommended</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Upload matching SOOC + edited pairs. The AI learns your exact colour grading on GPU — highest accuracy.
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">Min {MIN_PAIRS} pairs · ~10-15 min training</p>
                </button>

                {/* Reference Only */}
                <button
                  onClick={() => setTrainingMode('reference')}
                  className={`relative rounded-xl border p-3.5 text-left transition-all ${
                    trainingMode === 'reference'
                      ? 'border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                >
                  {trainingMode === 'reference' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-indigo-400" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Edited References Only</p>
                      <span className="text-[9px] font-medium text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded-full">CPU · Basic</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Upload only your finished edits. AI learns general colour tendencies — good enough for simple styles.
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">Min {MIN_REFS} images · ~1-2 min training</p>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setStep('upload')} disabled={!name.trim()}>
                Next — Upload Images
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Upload ─── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {trainingMode === 'pairs' ? (
              <>
                {/* Pair count indicator */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">{matchedPairs.length} matched pairs</span>
                    <span className={`font-medium ${
                      matchedPairs.length < MIN_PAIRS ? 'text-red-400'
                        : matchedPairs.length < RECOMMENDED_PAIRS ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {matchedPairs.length < MIN_PAIRS ? `Need ${MIN_PAIRS - matchedPairs.length} more`
                        : matchedPairs.length < RECOMMENDED_PAIRS ? 'Good — more is better'
                        : 'Excellent'}
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        matchedPairs.length < MIN_PAIRS ? 'bg-red-500' : matchedPairs.length < RECOMMENDED_PAIRS ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((matchedPairs.length / RECOMMENDED_PAIRS) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Two side-by-side drop zones */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Originals (SOOC) */}
                  <div
                    onDrop={(e) => { e.preventDefault(); setDragOverZone(null); addOriginals(e.dataTransfer.files); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('original'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onClick={() => !uploading && originalInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[120px] flex flex-col items-center justify-center p-4 ${
                      dragOverZone === 'original' ? 'border-slate-400 bg-slate-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                    } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input ref={originalInputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')}
                      onChange={(e) => e.target.files && addOriginals(e.target.files)} className="hidden" />
                    <div className="w-9 h-9 rounded-xl bg-slate-500/10 flex items-center justify-center mb-2">
                      <Camera className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-[11px] font-medium text-slate-300 mb-0.5">Originals (SOOC)</p>
                    <p className="text-[10px] text-slate-600 text-center">Straight out of camera</p>
                    {originalFiles.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{originalFiles.length} files</p>
                    )}
                  </div>

                  {/* Edited versions */}
                  <div
                    onDrop={(e) => { e.preventDefault(); setDragOverZone(null); addEdited(e.dataTransfer.files); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('edited'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onClick={() => !uploading && editedInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[120px] flex flex-col items-center justify-center p-4 ${
                      dragOverZone === 'edited' ? 'border-amber-400 bg-amber-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                    } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input ref={editedInputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')}
                      onChange={(e) => e.target.files && addEdited(e.target.files)} className="hidden" />
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-[11px] font-medium text-slate-300 mb-0.5">Your Edits</p>
                    <p className="text-[10px] text-slate-600 text-center">Same photos, edited</p>
                    {editedFiles.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{editedFiles.length} files</p>
                    )}
                  </div>
                </div>

                {/* Matching results */}
                {(originalFiles.length > 0 || editedFiles.length > 0) && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className="text-emerald-400 font-medium">{matchedPairs.length} matched</span>
                      {unmatchedOriginals.length > 0 && (
                        <span className="text-slate-500">{unmatchedOriginals.length} unmatched originals</span>
                      )}
                      {unmatchedEdited.length > 0 && (
                        <span className="text-slate-500">{unmatchedEdited.length} unmatched edits</span>
                      )}
                    </div>
                    {matchedPairs.length > 0 && matchedPairs.length < 6 && (
                      <div className="mt-2 space-y-1">
                        {matchedPairs.slice(0, 5).map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-[10px] text-slate-500">
                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                            <span className="truncate">{p.originalFile.name}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-600 flex-shrink-0" />
                            <span className="truncate">{p.editedFile.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] text-slate-600 mt-2 leading-relaxed">
                      Files are matched by name — originals and edits should have the same base filename 
                      (e.g. DSC_001.jpg and DSC_001_edited.jpg).
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Reference mode — same as original */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">{refFiles.length} images added</span>
                    <span className={`font-medium ${
                      refFiles.length < MIN_REFS ? 'text-red-400'
                        : refFiles.length < RECOMMENDED_REFS ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {refFiles.length < MIN_REFS ? `Need ${MIN_REFS - refFiles.length} more`
                        : refFiles.length < RECOMMENDED_REFS ? 'Good — more is better'
                        : 'Excellent'}
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        refFiles.length < MIN_REFS ? 'bg-red-500' : refFiles.length < RECOMMENDED_REFS ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((refFiles.length / MAX_REFS) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div
                  onDrop={(e) => { e.preventDefault(); setDragOverZone(null); addRefFiles(e.dataTransfer.files); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('ref'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onClick={() => !uploading && refInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    dragOverZone === 'ref' ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                  } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input ref={refInputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS.join(',')}
                    onChange={(e) => e.target.files && addRefFiles(e.target.files)} className="hidden" />
                  <div className="flex flex-col items-center justify-center py-10 px-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3">
                      <Upload className="w-5 h-5 text-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-200 mb-1">Drop your edited photos here</p>
                    <p className="text-xs text-slate-500">JPEG, PNG, TIFF — your finished, edited work</p>
                  </div>
                </div>
              </>
            )}

            {/* Upload progress */}
            {uploading && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-xs font-medium text-amber-300">
                    {trainingStatus === 'uploading' && `Uploading images... ${uploadProgress}%`}
                    {trainingStatus === 'starting' && 'Starting AI training...'}
                  </span>
                </div>
                <div className="h-1.5 bg-amber-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
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
              <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || uploading}>
                {uploading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Processing...</>
                ) : (
                  <><Sparkles className="w-3 h-3" />Upload & Start Training</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Training started ─── */}
        {step === 'training' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-emerald-300 mb-1">
                {trainingMode === 'pairs' ? 'GPU training started!' : 'Training started!'}
              </p>
              <p className="text-xs text-emerald-400/60 leading-relaxed">
                {trainingMode === 'pairs' ? (
                  <>The AI is training a neural colour model from your {matchedPairs.filter(p => p.status === 'complete').length} before/after pairs on GPU. This usually takes 10–15 minutes. You can close this dialog — the style will appear as &quot;Ready&quot; when complete.</>
                ) : (
                  <>The AI is analysing your {refFiles.filter(f => f.status === 'complete').length} reference images to learn your editing style. This usually takes a minute or two. You can close this dialog — the style will appear as &quot;Ready&quot; when complete.</>
                )}
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

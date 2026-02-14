'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getCurrentPhotographer, uploadPhotoToStorage } from '@/lib/queries';
import {
  Upload, X, Check, AlertCircle, Loader2, Camera,
  Image as ImageIcon, Palette, Sun, Contrast, Droplets,
  Eye, Sparkles, SlidersHorizontal, Aperture, Focus,
  Layers, CircleDot, Brush, Mountain,
} from 'lucide-react';

const MIN_IMAGES = 100;
const RECOMMENDED_IMAGES = 200;
const MAX_IMAGES = 300;

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];

interface StyleUploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  preview?: string;
}

interface StyleTrainingConfig {
  retouch_intensity: 'off' | 'light' | 'medium' | 'heavy';
  auto_crop: boolean;
  cleanup_level: 'off' | 'conservative' | 'moderate' | 'aggressive';
  skin_smoothing: number;
  blemish_removal: boolean;
  stray_hair_cleanup: boolean;
  eye_enhancement: boolean;
  teeth_whitening: boolean;
  background_person_removal: 'off' | 'flag' | 'auto';
  distraction_removal: 'off' | 'flag' | 'auto';
  power_line_removal: boolean;
  horizon_correction: boolean;
}

const DEFAULT_CONFIG: StyleTrainingConfig = {
  retouch_intensity: 'medium',
  auto_crop: true,
  cleanup_level: 'moderate',
  skin_smoothing: 40,
  blemish_removal: true,
  stray_hair_cleanup: true,
  eye_enhancement: false,
  teeth_whitening: true,
  background_person_removal: 'flag',
  distraction_removal: 'auto',
  power_line_removal: true,
  horizon_correction: true,
};

// What the AI learns from reference images
const AI_LEARNS = [
  { icon: Sun, label: 'Exposure & Brightness', description: 'Lifted shadows, crushed blacks, highlight recovery, overall brightness preferences' },
  { icon: Palette, label: 'Colour Grading', description: 'Split toning, colour cast, warm/cool shifts, shadow & highlight colour balance' },
  { icon: Droplets, label: 'White Balance', description: 'Colour temperature tendencies — warm, cool, or neutral across different lighting' },
  { icon: Contrast, label: 'Contrast & Tone Curve', description: 'S-curve intensity, matte/film look (lifted blacks), fade, tonal range compression' },
  { icon: Layers, label: 'HSL Channels', description: 'Per-colour hue, saturation & luminance — desaturated greens, orange skin tones, teal shadows' },
  { icon: CircleDot, label: 'Saturation & Vibrance', description: 'Global and per-channel saturation, vibrance intensity, colour purity preferences' },
  { icon: Eye, label: 'Skin Tone Handling', description: 'How skin is preserved/modified across different ethnicities, lighting, and conditions' },
  { icon: Sparkles, label: 'Grain & Texture', description: 'Film grain simulation, clarity slider, texture enhancement, softness/sharpness balance' },
  { icon: Focus, label: 'Sharpening & Detail', description: 'Sharpening amount, radius, masking, detail recovery, noise reduction approach' },
  { icon: Aperture, label: 'Vignetting', description: 'Edge darkening amount, feather radius, midpoint — cinematic vs clean' },
  { icon: Brush, label: 'Lens Corrections', description: 'Distortion correction, chromatic aberration removal, profile-based corrections' },
  { icon: Mountain, label: 'Scene Consistency', description: 'How the overall mood stays cohesive across ceremony, reception, portraits, details, golden hour' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CreateStyleFlowProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, config: StyleTrainingConfig, imageKeys: string[]) => void;
}

export function CreateStyleFlow({ open, onClose, onCreate }: CreateStyleFlowProps) {
  const [step, setStep] = useState<'details' | 'upload' | 'config' | 'review'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<StyleUploadFile[]>([]);
  const [config, setConfig] = useState<StyleTrainingConfig>(DEFAULT_CONFIG);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('details');
    setName('');
    setDescription('');
    setFiles([]);
    setConfig(DEFAULT_CONFIG);
    setUploading(false);
    setUploadProgress(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const currentCount = files.length;
    const remaining = MAX_IMAGES - currentCount;
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

    try {
      const photographer = await getCurrentPhotographer();
      if (!photographer) {
        setUploading(false);
        return;
      }

      const imageKeys: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'uploading' } : p));

        try {
          const safeName = f.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageKey = `${photographer.id}/styles/${name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/${Date.now()}_${safeName}`;

          const { createClient } = await import('@/lib/supabase/client');
          const sb = createClient();
          const { data, error } = await sb.storage
            .from('photos')
            .upload(storageKey, f.file, { cacheControl: '3600', upsert: false });

          if (error) throw error;

          imageKeys.push(data.path);
          setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'complete' } : p));
        } catch (err) {
          setFiles((prev) => prev.map((p) => p.id === f.id ? { ...p, status: 'error' } : p));
        }

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      onCreate(name, description, config, imageKeys);
      handleClose();
    } catch (err) {
      console.error('Style upload error:', err);
    }

    setUploading(false);
  };

  const imageCountStatus = files.length < MIN_IMAGES ? 'insufficient' : files.length <= RECOMMENDED_IMAGES ? 'good' : files.length <= MAX_IMAGES ? 'excellent' : 'over';

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Create Style Profile" className="sm:max-w-2xl">
      <div className="space-y-5">
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {(['details', 'upload', 'config', 'review'] as const).map((s, i) => {
            const labels = ['Details', 'Reference Images', 'AI Settings', 'Review'];
            const isCurrent = step === s;
            const isComplete = (['details', 'upload', 'config', 'review'] as const).indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 ${isCurrent ? 'text-indigo-400' : isComplete ? 'text-emerald-400' : 'text-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    isCurrent ? 'border-indigo-500/40 bg-indigo-500/20' : isComplete ? 'border-emerald-500/40 bg-emerald-500/20' : 'border-white/[0.08] bg-white/[0.02]'
                  }`}>
                    {isComplete ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium hidden sm:inline">{labels[i]}</span>
                </div>
                {i < 3 && <div className={`flex-1 h-px ${isComplete ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />}
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
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the look — light and airy? moody and dark? film-inspired? This helps you remember what this style is for."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none"
              />
            </div>

            {/* What the AI learns */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">What the AI learns from your images</p>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {AI_LEARNS.map((item) => (
                  <div key={item.label} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <item.icon className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-slate-300">{item.label}</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
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
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
              <p className="text-xs text-indigo-300 font-medium mb-1">Upload your best edited work</p>
              <p className="text-[11px] text-indigo-400/70 leading-relaxed">
                Upload <strong>100–300 finished, edited images</strong> (JPEGs) that represent your style. Include a mix of: 
                indoor & outdoor shots, different lighting conditions (natural, flash, golden hour), various skin tones, 
                ceremony, reception, portraits, and details. The more variety you give, the better the AI handles edge cases.
              </p>
            </div>

            {/* Image count indicator */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">{files.length} / {RECOMMENDED_IMAGES} images (min {MIN_IMAGES})</span>
                <span className={`font-medium ${
                  imageCountStatus === 'insufficient' ? 'text-red-400'
                    : imageCountStatus === 'good' ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {imageCountStatus === 'insufficient' ? `Need ${MIN_IMAGES - files.length} more`
                    : imageCountStatus === 'good' ? 'Good'
                    : 'Excellent'}
                </span>
              </div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      imageCountStatus === 'insufficient' ? 'bg-red-500' : imageCountStatus === 'good' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min((files.length / RECOMMENDED_IMAGES) * 100, 100)}%` }}
                  />
                </div>
                {/* Min marker */}
                <div className="relative -mt-2">
                  <div
                    className="absolute top-0 w-px h-2 bg-white/30"
                    style={{ left: `${(MIN_IMAGES / RECOMMENDED_IMAGES) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                <span>0</span>
                <span>{MIN_IMAGES} min</span>
                <span>{RECOMMENDED_IMAGES} recommended</span>
                <span>{MAX_IMAGES} max</span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                dragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
              }`}
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
                  <p className="text-xs text-slate-500">JPEG, PNG, TIFF · These should be your finished, edited images</p>
                </div>
              ) : (
                <div className="p-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-40 overflow-y-auto">
                    {files.map((f) => (
                      <div key={f.id} className="relative aspect-square rounded bg-white/[0.04] flex items-center justify-center group">
                        <Camera className={`w-3 h-3 ${f.status === 'complete' ? 'text-emerald-600' : f.status === 'error' ? 'text-red-600' : 'text-slate-700'}`} />
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
                        {f.status === 'pending' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2 h-2 text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                    {/* Add more button */}
                    {files.length < MAX_IMAGES && (
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

            {/* Upload tips */}
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <p className="text-[11px] font-medium text-slate-300 mb-1.5">Tips for best results:</p>
              <ul className="text-[10px] text-slate-500 space-y-1">
                <li>• Include at least 15–20 portrait shots with different skin tones</li>
                <li>• Include indoor AND outdoor shots to cover different white balance scenarios</li>
                <li>• Include golden hour, overcast, shade, and flash-lit images</li>
                <li>• Include ceremony, reception, detail shots, and candids for scene variety</li>
                <li>• Only upload images that represent YOUR style — don&apos;t mix different editing styles</li>
                <li>• Use your absolute best work — the AI will replicate what you give it</li>
              </ul>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('details')}>← Back</Button>
              <Button size="sm" onClick={() => setStep('config')} disabled={files.length < MIN_IMAGES}>
                Next — AI Settings {files.length < MIN_IMAGES && `(${MIN_IMAGES - files.length} more needed)`}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: AI Settings */}
        {step === 'config' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Configure how aggressively each AI phase should process your photos. These are defaults — you can override per-shoot.</p>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {/* Retouch intensity */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Retouch Intensity</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['off', 'light', 'medium', 'heavy'] as const).map((val) => (
                    <button key={val} onClick={() => setConfig((c) => ({ ...c, retouch_intensity: val }))}
                      className={`px-2 py-1.5 text-[11px] rounded-lg border transition-all capitalize ${
                        config.retouch_intensity === val ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                      }`}>{val}</button>
                  ))}
                </div>
              </div>

              {/* Cleanup level */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Scene Cleanup Level</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['off', 'conservative', 'moderate', 'aggressive'] as const).map((val) => (
                    <button key={val} onClick={() => setConfig((c) => ({ ...c, cleanup_level: val }))}
                      className={`px-2 py-1.5 text-[11px] rounded-lg border transition-all capitalize ${
                        config.cleanup_level === val ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                      }`}>{val}</button>
                  ))}
                </div>
              </div>

              {/* Skin smoothing slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Skin Smoothing</label>
                  <span className="text-xs text-indigo-400 font-medium">{config.skin_smoothing}%</span>
                </div>
                <input type="range" min="0" max="100" value={config.skin_smoothing}
                  onChange={(e) => setConfig((c) => ({ ...c, skin_smoothing: Number(e.target.value) }))}
                  className="w-full h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-600">
                  <span>Natural</span><span>Moderate</span><span>Heavy</span>
                </div>
              </div>

              {/* Background person removal */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Background Person Removal</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['off', 'Off'], ['flag', 'Flag for Review'], ['auto', 'Auto Remove']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setConfig((c) => ({ ...c, background_person_removal: val }))}
                      className={`px-2 py-1.5 text-[11px] rounded-lg border transition-all ${
                        config.background_person_removal === val ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                      }`}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Distraction removal */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Distraction Removal (signs, trash, bright objects)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['off', 'Off'], ['flag', 'Flag for Review'], ['auto', 'Auto Remove']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setConfig((c) => ({ ...c, distraction_removal: val }))}
                      className={`px-2 py-1.5 text-[11px] rounded-lg border transition-all ${
                        config.distraction_removal === val ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                      }`}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Toggle grid */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['blemish_removal', 'Blemish Removal'],
                  ['stray_hair_cleanup', 'Stray Hair Cleanup'],
                  ['eye_enhancement', 'Eye Enhancement'],
                  ['teeth_whitening', 'Teeth Whitening'],
                  ['power_line_removal', 'Power Line Removal'],
                  ['horizon_correction', 'Horizon Correction'],
                  ['auto_crop', 'Auto Crop & Straighten'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] transition-all ${
                      config[key] ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      config[key] ? 'border-indigo-500 bg-indigo-500' : 'border-white/20'
                    }`}>
                      {config[key] && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>← Back</Button>
              <Button size="sm" onClick={() => setStep('review')}>Next — Review</Button>
            </div>
          </div>
        )}

        {/* Step 4: Review & submit */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Style Name</span>
                <span className="text-white font-medium">{name}</span>
              </div>
              {description && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Description</span>
                  <span className="text-slate-300 text-right max-w-[60%]">{description}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Reference Images</span>
                <span className={`font-medium ${files.length >= RECOMMENDED_IMAGES ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {files.length} images
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Retouch</span>
                <span className="text-slate-300 capitalize">{config.retouch_intensity}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Cleanup</span>
                <span className="text-slate-300 capitalize">{config.cleanup_level}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Skin Smoothing</span>
                <span className="text-slate-300">{config.skin_smoothing}%</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.blemish_removal && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Blemish removal</span>}
                {config.stray_hair_cleanup && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Hair cleanup</span>}
                {config.teeth_whitening && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Teeth whitening</span>}
                {config.power_line_removal && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Power lines</span>}
                {config.horizon_correction && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Horizon fix</span>}
                {config.auto_crop && <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Auto crop</span>}
              </div>
            </div>

            {uploading && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs font-medium text-indigo-300">
                    Uploading reference images... {uploadProgress}%
                  </span>
                </div>
                <div className="h-1.5 bg-indigo-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              <p className="text-[11px] text-slate-500">
                Once uploaded, the AI will analyse your reference images and learn your editing style. Training typically takes 15–30 minutes depending on image count. You&apos;ll get a notification when it&apos;s ready.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('config')} disabled={uploading}>← Back</Button>
              <Button size="sm" onClick={handleSubmit} disabled={uploading}>
                {uploading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Uploading...</>
                ) : (
                  <><Sparkles className="w-3 h-3" />Create & Start Training</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

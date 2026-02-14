'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { RotateCcw, Upload, Pencil, Check } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  initialSignature?: string | null;
  height?: number;
  /** Light theme for public pages, dark theme for dashboard */
  theme?: 'light' | 'dark';
  /** Show upload option */
  allowUpload?: boolean;
  /** Label text */
  label?: string;
}

export function SignaturePad({
  onSignatureChange,
  initialSignature = null,
  height = 160,
  theme = 'dark',
  allowUpload = true,
  label = 'Signature',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<'draw' | 'upload'>(initialSignature ? 'upload' : 'draw');
  const [uploadedImage, setUploadedImage] = useState<string | null>(initialSignature || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If initial signature provided, set it
  useEffect(() => {
    if (initialSignature) {
      setUploadedImage(initialSignature);
      setMode('upload');
    }
  }, [initialSignature]);

  const isDark = theme === 'dark';

  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [getCanvasCoords]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = isDark ? '#c8c8d8' : '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [isDrawing, getCanvasCoords, isDark]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  function saveSignature() {
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedImage(dataUrl);
      onSignatureChange(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function clearUpload() {
    setUploadedImage(null);
    onSignatureChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function switchToMode(newMode: 'draw' | 'upload') {
    setMode(newMode);
    if (newMode === 'draw') {
      clearUpload();
    } else {
      clearCanvas();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={`block text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          {label}
        </label>
        {allowUpload && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => switchToMode('draw')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'draw'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Pencil className="w-3 h-3" />Draw
            </button>
            <button
              type="button"
              onClick={() => switchToMode('upload')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                mode === 'upload'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-gray-100 text-gray-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Upload className="w-3 h-3" />Upload
            </button>
          </div>
        )}
      </div>

      {mode === 'draw' ? (
        <>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className={`w-full border-2 border-dashed rounded-lg cursor-crosshair touch-none ${
                isDark
                  ? 'border-white/[0.08] bg-white/[0.02]'
                  : 'border-gray-200 bg-white'
              }`}
              style={{ height: `${height}px` }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className={`text-sm ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
                  Draw your signature here
                </p>
              </div>
            )}
          </div>
          {hasDrawn && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveSignature}
                className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-500 hover:text-indigo-600'
                }`}
              >
                <Check className="w-3 h-3" />Confirm
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                  isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <RotateCcw className="w-3 h-3" />Clear
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {uploadedImage ? (
            <div className="space-y-2">
              <div className={`rounded-lg border p-4 flex items-center justify-center ${
                isDark
                  ? 'border-white/[0.06] bg-white/[0.02]'
                  : 'border-gray-200 bg-white'
              }`} style={{ height: `${height}px` }}>
                <img
                  src={uploadedImage}
                  alt="Signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearUpload}
                  className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
                    isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />Remove
                </button>
                <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer transition-colors ${
                  isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'
                }`}>
                  <Upload className="w-3 h-3" />Replace
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className={`block rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDark
                ? 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`} style={{ height: `${height}px` }}>
              <div className="flex flex-col items-center justify-center h-full">
                <Upload className={`w-6 h-6 mb-2 ${isDark ? 'text-slate-600' : 'text-gray-400'}`} />
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                  Upload signature image
                </p>
                <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                  PNG, JPG or SVG — transparent background recommended
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}

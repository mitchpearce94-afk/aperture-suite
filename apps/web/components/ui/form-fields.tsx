import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Text Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 text-sm bg-white/[0.04] border rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all',
            error ? 'border-red-500/50' : 'border-white/[0.08]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#0c0c16]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
Select.displayName = 'Select';

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none',
            className
          )}
          rows={3}
          {...props}
        />
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

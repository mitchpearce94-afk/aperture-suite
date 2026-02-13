import { cn } from '@/lib/utils';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
          // Variants
          variant === 'primary' && 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm shadow-indigo-500/20',
          variant === 'secondary' && 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]',
          variant === 'ghost' && 'hover:bg-white/[0.06] text-slate-400 hover:text-slate-200',
          variant === 'danger' && 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
          // Sizes
          size === 'sm' && 'text-xs px-3 py-1.5 gap-1.5',
          size === 'md' && 'text-sm px-4 py-2 gap-2',
          size === 'lg' && 'text-sm px-5 py-2.5 gap-2',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

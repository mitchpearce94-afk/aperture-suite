'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, ChevronDown } from 'lucide-react';

interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  emptyMessage?: string;
}

export function Combobox({ options, value, onChange, placeholder = 'Search...', label, emptyMessage = 'No results found' }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.label.toLowerCase().includes(s) || o.sublabel?.toLowerCase().includes(s);
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setSearch('');
  }

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}

      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className={cn(
          'w-full px-3 py-2.5 text-sm border rounded-lg cursor-pointer flex items-center gap-2 transition-all',
          open ? 'border-indigo-500/50 ring-1 ring-indigo-500/20 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.04] hover:border-white/[0.12]'
        )}
      >
        {!open && selected ? (
          <>
            <span className="flex-1 text-slate-300">{selected.label}</span>
            <button onClick={handleClear} className="p-0.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : !open ? (
          <>
            <Search className="w-3.5 h-3.5 text-slate-600" />
            <span className="flex-1 text-slate-600">{placeholder}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
          </>
        ) : (
          <>
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-slate-300 placeholder:text-slate-600 focus:outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 rounded hover:bg-white/[0.08] text-slate-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border border-white/[0.08] bg-[#0c0c16] shadow-xl max-h-60 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors flex items-center justify-between',
                  value === option.value && 'bg-indigo-500/10'
                )}
              >
                <div>
                  <p className="text-sm text-slate-300">{option.label}</p>
                  {option.sublabel && <p className="text-[11px] text-slate-600">{option.sublabel}</p>}
                </div>
                {value === option.value && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-xs text-slate-600">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}

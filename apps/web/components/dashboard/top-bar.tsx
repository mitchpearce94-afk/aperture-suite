'use client';

import { Search, Bell, Plus, ChevronDown, LogOut, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [initials, setInitials] = useState('');
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try photographer record first
      const { data: photographer } = await supabase
        .from('photographers')
        .select('name')
        .eq('auth_user_id', user.id)
        .single();

      const name = photographer?.name
        || user.user_metadata?.full_name
        || user.user_metadata?.name
        || `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim()
        || user.email?.split('@')[0]
        || '';

      setUserName(name);
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        setInitials(`${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase());
      } else if (parts.length === 1) {
        setInitials(parts[0].slice(0, 2).toUpperCase());
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between h-14 lg:h-16 px-4 lg:px-6 border-b border-white/[0.06] bg-[#07070d]/95 backdrop-blur-md flex-shrink-0 z-30">
      {/* Left side */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors lg:hidden flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search — hidden on small mobile, shown from sm up */}
        <div className="relative max-w-md w-full hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search clients, jobs, galleries..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08] hidden md:inline">
            ⌘K
          </kbd>
        </div>

        {/* Mobile search icon */}
        <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors sm:hidden flex-shrink-0">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>

        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 lg:pl-3 pr-1.5 lg:pr-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
              <span className="text-[11px] font-semibold text-white">{initials || '??'}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/[0.08] bg-[#0c0c16] shadow-xl z-50 py-1">
                {userName && (
                  <div className="px-4 py-2 border-b border-white/[0.06]">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

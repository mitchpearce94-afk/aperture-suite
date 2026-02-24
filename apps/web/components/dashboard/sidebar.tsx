'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Users, Inbox, Briefcase, Calendar, CalendarCheck, FileText,
  ScrollText, Zap, ImageIcon, Wand2, BarChart3, Settings,
  ChevronLeft, X, Sparkles,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'CRM',
    items: [
      { name: 'Leads', href: '/leads', icon: Inbox },
      { name: 'Clients', href: '/clients', icon: Users },
      { name: 'Jobs', href: '/jobs', icon: Briefcase },
      { name: 'Calendar', href: '/calendar', icon: Calendar },
      { name: 'Bookings', href: '/bookings', icon: CalendarCheck },
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Contracts', href: '/contracts', icon: ScrollText },
      { name: 'Workflows', href: '/workflows', icon: Zap },
    ],
  },
  {
    label: 'Studio',
    items: [
      { name: 'Auto Editor', href: '/editing', icon: Wand2 },
      { name: 'Galleries', href: '/galleries', icon: ImageIcon },
    ],
  },
  {
    label: 'Business',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function NavContent({ collapsed, onLinkClick, showClose, onClose }: {
  collapsed: boolean;
  onLinkClick: () => void;
  showClose: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  useEffect(() => {
    async function checkTier() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('photographers')
        .select('subscription_tier')
        .eq('auth_user_id', user.id)
        .single();
      if (data) {
        setNeedsUpgrade(data.subscription_tier === 'free_trial' || data.subscription_tier === 'free');
      }
    }
    checkTier();
  }, []);

  return (
    <>
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <svg width="26" height="26" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="9" width="34" height="26" rx="2" stroke="#d4a574" strokeWidth="0.5" opacity="0.15"/>
            <rect x="29" y="4.5" width="6" height="3.5" rx="0.8" stroke="#d4a574" strokeWidth="0.5" opacity="0.15"/>
            <path d="M22 3.5 L25.5 15.5 L22 13 Z" fill="#c47d4a" opacity="0.95"/>
            <path d="M38 11 L29 19 L28.5 14.5 Z" fill="#d4a574" opacity="0.7"/>
            <path d="M38 33 L28 25.5 L29.5 21 Z" fill="#c47d4a" opacity="0.55"/>
            <path d="M22 40.5 L18.5 28.5 L22 31 Z" fill="#d4a574" opacity="0.95"/>
            <path d="M6 33 L15 25.5 L15.5 30 Z" fill="#c47d4a" opacity="0.7"/>
            <path d="M6 11 L16 19 L14.5 23.5 Z" fill="#d4a574" opacity="0.55"/>
            <circle cx="22" cy="22" r="4" fill="#c47d4a"/>
          </svg>
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-tight" style={{ fontFamily: "'Libre Baskerville', serif" }}>Apelier</span>
        )}
        {showClose && (
          <button onClick={onClose} className="ml-auto p-1 rounded-md text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 px-3 mb-2">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive ? 'bg-brand-500/10 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-brand-400' : 'text-slate-500')} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Upgrade CTA — only for free trial users */}
        {needsUpgrade && !collapsed && (
          <div className="mt-2 mx-1">
            <Link
              href="/settings?tab=billing"
              onClick={onLinkClick}
              className="block rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-4 hover:border-amber-500/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">Upgrade Plan</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Unlock unlimited edits, priority processing & more.
              </p>
              <div className="mt-3 text-center py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors">
                View Plans
              </div>
            </Link>
          </div>
        )}
        {needsUpgrade && collapsed && (
          <div className="mt-2 flex justify-center">
            <Link
              href="/settings?tab=billing"
              onClick={onLinkClick}
              title="Upgrade Plan"
              className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center hover:bg-amber-500/20 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-white/[0.06] bg-[#07070d] transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}>
        <NavContent collapsed={collapsed} onLinkClick={() => {}} showClose={false} onClose={() => {}} />
        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform duration-300', collapsed && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col bg-[#07070d] border-r border-white/[0.06] transition-transform duration-300 ease-out lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavContent collapsed={false} onLinkClick={onMobileClose} showClose={true} onClose={onMobileClose} />
      </aside>
    </>
  );
}

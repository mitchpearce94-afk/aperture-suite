'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Inbox, Briefcase, Calendar, FileText,
  ScrollText, Zap, ImageIcon, Wand2, BarChart3, Settings,
  ChevronLeft, Camera, X,
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
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Contracts', href: '/contracts', icon: ScrollText },
      { name: 'Workflows', href: '/workflows', icon: Zap },
    ],
  },
  {
    label: 'Studio',
    items: [
      { name: 'Auto Editing', href: '/editing', icon: Wand2 },
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

  return (
    <>
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <Camera className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-tight">Aperture Suite</span>
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
                      isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-indigo-400' : 'text-slate-500')} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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

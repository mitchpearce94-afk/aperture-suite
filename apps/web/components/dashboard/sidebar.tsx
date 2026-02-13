'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Inbox,
  Briefcase,
  Calendar,
  FileText,
  ScrollText,
  Zap,
  ImageIcon,
  Wand2,
  BarChart3,
  Settings,
  ChevronLeft,
  Camera,
} from 'lucide-react';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
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
      { name: 'Galleries', href: '/galleries', icon: ImageIcon },
      { name: 'AI Editing', href: '/editing', icon: Wand2 },
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

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-white/[0.06] bg-[#07070d] transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <Camera className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-tight">
            Aperture Suite
          </span>
        )}
      </div>

      {/* Navigation */}
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
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={cn(
                        'w-[18px] h-[18px] flex-shrink-0',
                        isActive ? 'text-indigo-400' : 'text-slate-500'
                      )}
                    />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-white/[0.06] p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors"
        >
          <ChevronLeft
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              collapsed && 'rotate-180'
            )}
          />
        </button>
      </div>
    </aside>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getDashboardStats, getLeads, getJobs, getGalleries } from '@/lib/queries';
import {
  DollarSign, Inbox, Briefcase, Calendar, ImageIcon, Wand2,
  AlertCircle, ArrowRight, Users, ImageIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalClients: 0, totalLeads: 0, activeLeads: 0, openJobs: 0,
    totalRevenue: 0, upcomingJobs: [] as any[],
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
  const [recentGalleries, setRecentGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsData, leads, jobs, galleries] = await Promise.all([
        getDashboardStats(),
        getLeads(),
        getJobs(),
        getGalleries(),
      ]);
      setStats(statsData);
      setRecentLeads(leads.slice(0, 5));
      setUpcomingJobs(jobs.filter((j) => j.status === 'upcoming').slice(0, 5));
      setRecentGalleries(galleries.slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = stats.totalClients === 0 && stats.activeLeads === 0 && stats.openJobs === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isEmpty ? 'Welcome to Apelier! Add your first client to get started.' : 'Here\'s your studio overview.'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} />
        <StatCard title="Active Leads" value={stats.activeLeads} icon={Inbox} />
        <StatCard title="Open Jobs" value={stats.openJobs} icon={Briefcase} />
        <StatCard title="Total Clients" value={stats.totalClients} icon={Users} />
        <StatCard title="Edited This Month" value={stats.imagesEditedThisMonth || 0} icon={ImageIcon} />
      </div>

      {/* Content panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming shoots */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white">Upcoming Shoots</h2>
            </div>
            <Link href="/jobs" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {upcomingJobs.length > 0 ? upcomingJobs.map((job) => (
              <div key={job.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white">{job.title || job.job_type || 'Untitled'}</p>
                  {job.package_amount && <span className="text-xs text-slate-500">{formatCurrency(job.package_amount)}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {job.client && <span>{job.client.first_name} {job.client.last_name}</span>}
                  {job.date && <><span>·</span><span>{formatDate(job.date)}</span></>}
                  {job.location && <><span>·</span><span>{job.location}</span></>}
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-xs text-slate-600">No upcoming shoots</div>
            )}
          </div>
        </div>

        {/* Recent leads */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white">Recent Leads</h2>
            </div>
            <Link href="/leads" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {recentLeads.length > 0 ? recentLeads.map((lead) => (
              <div key={lead.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white">
                    {lead.client ? `${lead.client.first_name} ${lead.client.last_name || ''}` : 'Unknown'}
                  </p>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {lead.job_type && <span>{lead.job_type}</span>}
                  {lead.preferred_date && <><span>·</span><span>{formatDate(lead.preferred_date)}</span></>}
                  {lead.source && <><span>·</span><span>via {lead.source}</span></>}
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-xs text-slate-600">No leads yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

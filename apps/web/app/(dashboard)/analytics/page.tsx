'use client';

import { useState, useEffect, useMemo } from 'react';
import { StatCard } from '@/components/dashboard/stat-card';
import { formatCurrency, cn } from '@/lib/utils';
import { getJobs, getLeads, getInvoices, getClients } from '@/lib/queries';
import {
  DollarSign, Users, Inbox, TrendingUp, Briefcase, Target,
  BarChart3, PieChart,
} from 'lucide-react';
import type { Job, Lead, Invoice, Client } from '@/lib/types';

export default function AnalyticsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('year');

  useEffect(() => {
    async function load() {
      const [j, l, i, c] = await Promise.all([getJobs(), getLeads(), getInvoices(), getClients()]);
      setJobs(j); setLeads(l); setInvoices(i); setClients(c);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'quarter') startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(0);

    const periodJobs = jobs.filter((j) => new Date(j.created_at) >= startDate);
    const periodLeads = leads.filter((l) => new Date(l.created_at) >= startDate);
    const periodInvoices = invoices.filter((i) => new Date(i.created_at) >= startDate);

    const totalRevenue = periodInvoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);

    const totalBooked = periodJobs.reduce((sum, j) => sum + Number(j.package_amount || 0), 0);

    const leadsBooked = periodLeads.filter((l) => l.status === 'booked').length;
    const totalLeads = periodLeads.length;
    const conversionRate = totalLeads > 0 ? Math.round((leadsBooked / totalLeads) * 100) : 0;

    const avgJobValue = periodJobs.length > 0
      ? periodJobs.reduce((sum, j) => sum + Number(j.package_amount || 0), 0) / periodJobs.filter((j) => j.package_amount).length || 0
      : 0;

    // Revenue by month
    const revenueByMonth: { month: string; amount: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(now.getFullYear(), m, 1);
      const monthEnd = new Date(now.getFullYear(), m + 1, 0);
      const monthRevenue = invoices
        .filter((i) => i.status === 'paid' && i.paid_date)
        .filter((i) => {
          const d = new Date(i.paid_date!);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
      revenueByMonth.push({
        month: monthStart.toLocaleDateString('en-AU', { month: 'short' }),
        amount: monthRevenue,
      });
    }

    // Lead sources
    const sourceCounts: Record<string, number> = {};
    periodLeads.forEach((l) => {
      const src = l.source || 'Unknown';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const leadSources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Job types
    const typeCounts: Record<string, number> = {};
    periodJobs.forEach((j) => {
      const type = j.job_type || 'Other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    const jobTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRevenue,
      totalBooked,
      totalLeads,
      conversionRate,
      avgJobValue,
      totalClients: clients.length,
      completedJobs: periodJobs.filter((j) => j.status === 'completed').length,
      revenueByMonth,
      leadSources,
      jobTypes,
    };
  }, [jobs, leads, invoices, clients, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const maxRevenue = Math.max(...stats.revenueByMonth.map((m) => m.amount), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Track your business performance</p>
        </div>
        <div className="flex items-center rounded-lg border border-white/[0.08] overflow-hidden">
          {(['month', 'quarter', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                period === p ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue Collected" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} />
        <StatCard title="Total Booked" value={formatCurrency(stats.totalBooked)} icon={TrendingUp} />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={Target} />
        <StatCard title="Avg Job Value" value={formatCurrency(stats.avgJobValue)} icon={Briefcase} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats.totalClients} icon={Users} />
        <StatCard title="Total Leads" value={stats.totalLeads} icon={Inbox} />
        <StatCard title="Completed Jobs" value={stats.completedJobs} icon={Briefcase} />
        <StatCard title="Leads Booked" value={stats.conversionRate > 0 ? `${stats.conversionRate}%` : '—'} icon={Target} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-white">Revenue by Month</h2>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {stats.revenueByMonth.map((m, i) => {
              const height = maxRevenue > 0 ? (m.amount / maxRevenue) * 100 : 0;
              const now = new Date();
              const isCurrentMonth = i === now.getMonth();
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-32">
                    {m.amount > 0 && (
                      <span className="text-[9px] text-slate-600 mb-1">{formatCurrency(m.amount)}</span>
                    )}
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        isCurrentMonth ? 'bg-indigo-500' : m.amount > 0 ? 'bg-indigo-500/40' : 'bg-white/[0.04]',
                      )}
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                  <span className={cn('text-[10px]', isCurrentMonth ? 'text-white font-medium' : 'text-slate-600')}>{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead sources */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-white">Lead Sources</h2>
          </div>
          {stats.leadSources.length > 0 ? (
            <div className="space-y-3">
              {stats.leadSources.map((src) => {
                const pct = stats.totalLeads > 0 ? Math.round((src.count / stats.totalLeads) * 100) : 0;
                return (
                  <div key={src.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{src.source}</span>
                      <span className="text-xs text-slate-500">{src.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-indigo-500/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-8">No lead data yet</p>
          )}
        </div>

        {/* Job types */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-white">Job Types</h2>
          </div>
          {stats.jobTypes.length > 0 ? (
            <div className="space-y-3">
              {stats.jobTypes.map((jt) => {
                const total = stats.jobTypes.reduce((s, j) => s + j.count, 0);
                const pct = total > 0 ? Math.round((jt.count / total) * 100) : 0;
                return (
                  <div key={jt.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{jt.type}</span>
                      <span className="text-xs text-slate-500">{jt.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-8">No job data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

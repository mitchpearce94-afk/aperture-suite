'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, cn } from '@/lib/utils';
import { getJobs } from '@/lib/queries';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { Job } from '@/lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getJobs();
      setJobs(data);
      setLoading(false);
    }
    load();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: { date: Date; inMonth: boolean; jobs: Job[] }[] = [];

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false, jobs: [] });
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toISOString().split('T')[0];
      const dayJobs = jobs.filter((j) => j.date === dateStr);
      days.push({ date: d, inMonth: true, jobs: dayJobs });
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, inMonth: false, jobs: [] });
    }

    return days;
  }, [year, month, jobs]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const monthJobs = jobs.filter((j) => {
    if (!j.date) return false;
    const d = new Date(j.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">
            {monthJobs.length} shoot{monthJobs.length !== 1 ? 's' : ''} this month
          </p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-white min-w-[200px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <Button size="sm" variant="secondary" onClick={goToday}>Today</Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {DAYS.map((day) => (
            <div key={day} className="px-2 py-2.5 text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase">{day}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateStr = day.date.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={i}
                className={cn(
                  'min-h-[100px] p-1.5 border-b border-r border-white/[0.03] transition-colors',
                  !day.inMonth && 'bg-white/[0.01]',
                  day.inMonth && 'hover:bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday && 'bg-indigo-500 text-white',
                    !isToday && day.inMonth && 'text-slate-400',
                    !day.inMonth && 'text-slate-700',
                  )}>
                    {day.date.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {day.jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={cn(
                        'w-full text-left px-1.5 py-1 rounded text-[11px] font-medium truncate transition-colors',
                        job.status === 'upcoming' && 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25',
                        job.status === 'in_progress' && 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
                        job.status === 'editing' && 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25',
                        job.status === 'delivered' && 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
                        job.status === 'completed' && 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25',
                        job.status === 'canceled' && 'bg-red-500/10 text-red-400/60 line-through hover:bg-red-500/20',
                      )}
                    >
                      {job.title || job.job_type || 'Shoot'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Job detail popup */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedJob(null)} />
          <div className="relative bg-[#0c0c16] border border-white/[0.08] rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedJob.title || selectedJob.job_type || 'Untitled'}</h3>
                {selectedJob.client && (
                  <p className="text-xs text-slate-500 mt-0.5">{selectedJob.client.first_name} {selectedJob.client.last_name || ''}</p>
                )}
              </div>
              <StatusBadge status={selectedJob.status} />
            </div>
            <div className="space-y-2 text-xs text-slate-400">
              {selectedJob.date && <p><CalendarIcon className="w-3 h-3 inline mr-1.5 text-slate-600" />{new Date(selectedJob.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{selectedJob.time && ` · ${selectedJob.time}${selectedJob.end_time ? `–${selectedJob.end_time}` : ''}`}</p>}
              {selectedJob.location && <p>📍 {selectedJob.location}</p>}
              {selectedJob.package_name && <p>📦 {selectedJob.package_name}{selectedJob.package_amount ? ` — ${formatCurrency(selectedJob.package_amount)}` : ''}</p>}
            </div>
            <button onClick={() => setSelectedJob(null)} className="mt-4 text-xs text-slate-600 hover:text-slate-400 transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

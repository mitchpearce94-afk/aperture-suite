'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SlideOver } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { Combobox } from '@/components/ui/combobox';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { getJobs, getClients, createJob, updateJob, deleteJob, getCurrentPhotographer } from '@/lib/queries';
import { Briefcase, Plus, Search, MapPin, Calendar as CalendarIcon, Pencil, Trash2, User, DollarSign, MessageSquare, X } from 'lucide-react';
import type { Job, JobStatus, Client } from '@/lib/types';

interface PackageItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_hours: number;
  included_images: number;
  deliverables: string;
  is_active: boolean;
  require_deposit: boolean;
  deposit_percent: number;
}

const jobTypeOptions = [
  { value: '', label: 'Select type...' },
  { value: 'Wedding', label: 'Wedding' },
  { value: 'Engagement', label: 'Engagement' },
  { value: 'Family', label: 'Family' },
  { value: 'Newborn', label: 'Newborn' },
  { value: 'Maternity', label: 'Maternity' },
  { value: 'Portrait', label: 'Portrait' },
  { value: 'Corporate', label: 'Corporate' },
  { value: 'Event', label: 'Event' },
  { value: 'Mini Session', label: 'Mini Session' },
  { value: 'Other', label: 'Other' },
];

const statusOptions = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'editing', label: 'Editing' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Cancelled' },
];

const statusTabs: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Editing', value: 'editing' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Completed', value: 'completed' },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [addFormPackageAmount, setAddFormPackageAmount] = useState('');
  const [addFormPackageName, setAddFormPackageName] = useState('');
  const [addFormIncludedImages, setAddFormIncludedImages] = useState('');
  const [addFormStartTime, setAddFormStartTime] = useState('');
  const [addFormEndTime, setAddFormEndTime] = useState('');
  const [addFormDurationHours, setAddFormDurationHours] = useState(0);

  function calcEndTime(startTime: string, durationHours: number): string {
    if (!startTime || !durationHours) return '';
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationHours * 60;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }

  function handleStartTimeChange(time: string) {
    setAddFormStartTime(time);
    if (addFormDurationHours > 0) {
      setAddFormEndTime(calcEndTime(time, addFormDurationHours));
    }
  }

  function handlePackageSelect(pkgName: string) {
    const pkg = packages.find((p) => p.name === pkgName);
    if (pkg) {
      setAddFormPackageName(pkg.name);
      setAddFormPackageAmount(String(pkg.price));
      setAddFormIncludedImages(String(pkg.included_images));
      setAddFormDurationHours(pkg.duration_hours);
      if (addFormStartTime) {
        setAddFormEndTime(calcEndTime(addFormStartTime, pkg.duration_hours));
      }
    } else {
      setAddFormPackageName('');
      setAddFormPackageAmount('');
      setAddFormIncludedImages('');
      setAddFormDurationHours(0);
      setAddFormEndTime('');
    }
  }

  // Detail/Edit
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editClientId, setEditClientId] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [photographer, jobsData, clientsData] = await Promise.all([
      getCurrentPhotographer(),
      getJobs(),
      getClients(),
    ]);
    if (photographer) {
      setPhotographerId(photographer.id);
      // Load packages from settings
      try {
        const savedPkgs = localStorage.getItem(`packages_${photographer.id}`);
        if (savedPkgs) setPackages(JSON.parse(savedPkgs).filter((p: PackageItem) => p.is_active));
      } catch {}
    }
    // Sort by date, soonest first, no-date at bottom
    setJobs(jobsData.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }));
    setClients(clientsData);
    setLoading(false);
  }

  async function handleAddJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photographerId) return;
    setSaving(true);

    const form = new FormData(e.currentTarget);

    const newJob = await createJob({
      photographer_id: photographerId,
      client_id: selectedClientId || undefined,
      job_type: form.get('job_type') as string || undefined,
      title: form.get('title') as string || undefined,
      date: form.get('date') as string || undefined,
      time: addFormStartTime || undefined,
      end_time: addFormEndTime || undefined,
      location: form.get('location') as string || undefined,
      package_name: addFormPackageName || form.get('package_name') as string || undefined,
      package_amount: addFormPackageAmount ? parseFloat(addFormPackageAmount) : undefined,
      status: 'upcoming',
      notes: form.get('notes') as string || undefined,
    });

    if (newJob) {
      setJobs((prev) => [newJob, ...prev]);
      setShowAddModal(false);
      setSelectedClientId('');
      setAddFormPackageName('');
      setAddFormPackageAmount('');
      setAddFormIncludedImages('');
      setAddFormStartTime('');
      setAddFormEndTime('');
      setAddFormDurationHours(0);
    }
    setSaving(false);
  }

  async function handleEditJob(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedJob) return;
    setEditSaving(true);

    const form = new FormData(e.currentTarget);
    const amount = form.get('package_amount') as string;

    const updated = await updateJob(selectedJob.id, {
      client_id: editClientId || selectedJob.client_id,
      job_type: form.get('job_type') as string || undefined,
      title: form.get('title') as string || undefined,
      date: form.get('date') as string || undefined,
      time: form.get('time') as string || undefined,
      end_time: form.get('end_time') as string || undefined,
      location: form.get('location') as string || undefined,
      package_name: form.get('package_name') as string || undefined,
      package_amount: amount ? parseFloat(amount) : undefined,
      status: form.get('status') as JobStatus,
      notes: form.get('notes') as string || undefined,
    });

    if (updated) {
      setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j));
      setSelectedJob(updated);
      setEditing(false);
    }
    setEditSaving(false);
  }

  async function handleStatusChange(jobId: string, newStatus: JobStatus) {
    const updated = await updateJob(jobId, { status: newStatus });
    if (updated) {
      setJobs((prev) => prev.map((j) => j.id === jobId ? updated : j));
      if (selectedJob?.id === jobId) setSelectedJob(updated);
    }
  }

  async function handleDeleteJob() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteJob(deleteTarget.id);
    if (success) {
      setJobs((prev) => prev.filter((j) => j.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (selectedJob?.id === deleteTarget.id) setSelectedJob(null);
    }
    setDeleting(false);
  }

  function openEdit() {
    if (!selectedJob) return;
    setEditClientId(selectedJob.client_id || '');
    setEditing(true);
  }

  const filteredJobs = jobs
    .filter((j) => filter === 'all' || j.status === filter)
    .filter((j) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        j.title?.toLowerCase().includes(s) ||
        j.client?.first_name?.toLowerCase().includes(s) ||
        j.client?.last_name?.toLowerCase().includes(s) ||
        j.job_type?.toLowerCase().includes(s) ||
        j.location?.toLowerCase().includes(s)
      );
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">
            {jobs.length} total job{jobs.length !== 1 ? 's' : ''} · {jobs.filter((j) => j.status === 'upcoming').length} upcoming
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-3.5 h-3.5" />New Job
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Create your first job when a lead books."
          action={{ label: 'New Job', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex items-center gap-1 border-b border-white/[0.06] -mb-[1px]">
            {statusTabs.map((tab) => {
              const count = tab.value === 'all' ? jobs.length : jobs.filter((j) => j.status === tab.value).length;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                    filter === tab.value ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                  )}
                >
                  {tab.label}<span className="ml-1.5 text-xs text-slate-600">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* Job cards */}
          <div className="space-y-3">
            {filteredJobs.length > 0 ? filteredJobs.map((job) => {
              const clientName = job.client ? `${job.client.first_name} ${job.client.last_name || ''}` : 'No client assigned';
              return (
                <div
                  key={job.id}
                  onClick={() => { setSelectedJob(job); setEditing(false); }}
                  className="p-4 rounded-xl border border-white/[0.06] bg-[#0c0c16] hover:border-white/[0.1] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400/10 to-violet-400/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Briefcase className="w-4 h-4 text-indigo-400/60" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {job.job_number && <span className="text-[10px] font-mono text-slate-600">#{String(job.job_number).padStart(4, '0')}</span>}
                          <h3 className="text-sm font-semibold text-white">{job.title || job.job_type || 'Untitled'}</h3>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{clientName}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {job.date && (
                            <span className="flex items-center gap-1.5">
                              <CalendarIcon className="w-3 h-3" />{formatDate(job.date, 'long')}{job.time && ` · ${job.time}${job.end_time ? `–${job.end_time}` : ''}`}
                            </span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" />{job.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {job.package_amount && <p className="text-sm font-semibold text-white">{formatCurrency(job.package_amount)}</p>}
                      {job.package_name && <p className="text-xs text-slate-600 mt-0.5">{job.package_name}</p>}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-12 text-sm text-slate-500">No jobs match your filters.</div>
            )}
          </div>
        </>
      )}

      {/* Add Job Modal */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setSelectedClientId(''); setAddFormPackageName(''); setAddFormPackageAmount(''); setAddFormIncludedImages(''); setAddFormStartTime(''); setAddFormEndTime(''); setAddFormDurationHours(0); }} title="New Job">
        <form onSubmit={handleAddJob} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault(); }} className="space-y-4">
          <Combobox
            label="Client"
            options={clients.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`, sublabel: c.email || c.phone || undefined }))}
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder="Search clients by name or email..."
            emptyMessage="No clients found"
          />
          <Input name="title" label="Job Title" placeholder="Johnson Wedding" />
          <Select name="job_type" label="Job Type" options={jobTypeOptions} />
          <div className="grid grid-cols-3 gap-3">
            <Input name="date" label="Shoot Date" type="date" />
            <Input label="Start Time" type="time" value={addFormStartTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
            <Input name="location" label="Location" placeholder="Venue or area" />
          </div>
          {addFormEndTime && (
            <div className="flex items-center gap-2 -mt-2 px-1">
              <span className="text-[10px] text-slate-600">End time: <span className="text-slate-400 font-medium">{addFormEndTime}</span></span>
              {addFormDurationHours > 0 && <span className="text-[10px] text-slate-600">({addFormDurationHours}hr{addFormDurationHours !== 1 ? 's' : ''} based on package)</span>}
            </div>
          )}

          {/* Package selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Package</label>
            {packages.length > 0 ? (
              <div className="space-y-3">
                <select
                  className="w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  value={addFormPackageName}
                  onChange={(e) => {
                    if (e.target.value === '__custom') {
                      setAddFormPackageName('__custom');
                      setAddFormPackageAmount('');
                      setAddFormIncludedImages('');
                      setAddFormDurationHours(0);
                      setAddFormEndTime('');
                    } else {
                      handlePackageSelect(e.target.value);
                    }
                  }}
                >
                  <option value="" className="bg-[#0c0c16]">Select package...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.name} className="bg-[#0c0c16]">
                      {pkg.name} — {formatCurrency(pkg.price)} · {pkg.included_images} images
                    </option>
                  ))}
                  <option value="__custom" className="bg-[#0c0c16]">Custom...</option>
                </select>
                {/* Show filled values / override */}
                {addFormPackageName && addFormPackageName !== '__custom' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Package" value={addFormPackageName} onChange={(e) => setAddFormPackageName(e.target.value)} />
                    <Input label="Amount ($)" type="number" step="0.01" value={addFormPackageAmount} onChange={(e) => setAddFormPackageAmount(e.target.value)} />
                    <Input label="Images" type="number" value={addFormIncludedImages} onChange={(e) => setAddFormIncludedImages(e.target.value)} />
                  </div>
                )}
                {addFormPackageName === '__custom' && (
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Package Name" value="" onChange={(e) => setAddFormPackageName(e.target.value)} placeholder="Custom" />
                    <Input label="Amount ($)" type="number" step="0.01" value={addFormPackageAmount} onChange={(e) => setAddFormPackageAmount(e.target.value)} placeholder="0" />
                    <Input label="Images" type="number" value={addFormIncludedImages} onChange={(e) => setAddFormIncludedImages(e.target.value)} placeholder="50" />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Input value={addFormPackageName} onChange={(e) => setAddFormPackageName(e.target.value)} placeholder="Package name" />
                <Input type="number" step="0.01" value={addFormPackageAmount} onChange={(e) => setAddFormPackageAmount(e.target.value)} placeholder="Amount ($)" />
                <Input type="number" value={addFormIncludedImages} onChange={(e) => setAddFormIncludedImages(e.target.value)} placeholder="Images" />
              </div>
            )}
          </div>
          <Textarea name="notes" label="Notes" placeholder="Any special requirements..." />
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Create Job'}</Button>
          </div>
        </form>
      </Modal>

      {/* Job Detail Slide-over */}
      <SlideOver
        open={!!selectedJob}
        onClose={() => { setSelectedJob(null); setEditing(false); }}
        title={selectedJob ? `${selectedJob.job_number ? `#${String(selectedJob.job_number).padStart(4, '0')} — ` : ''}${selectedJob.title || selectedJob.job_type || 'Job Details'}` : 'Job Details'}
      >
        {selectedJob && !editing && (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={openEdit}>
                <Pencil className="w-3 h-3" />Edit
              </Button>
              {selectedJob.status !== 'canceled' ? (
                <Button size="sm" variant="danger" onClick={() => handleStatusChange(selectedJob.id, 'canceled' as JobStatus)}>
                  <X className="w-3 h-3" />Cancel Job
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => handleStatusChange(selectedJob.id, 'upcoming' as JobStatus)}>
                  Restore Job
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selectedJob)} className="ml-auto text-slate-600 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {/* Status buttons */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Status</p>
              <div className="flex items-center gap-2 flex-wrap">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(selectedJob.id, opt.value as JobStatus)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                      selectedJob.status === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.1]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-4">
              {selectedJob.client && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Client</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-300">{selectedJob.client.first_name} {selectedJob.client.last_name || ''}</span>
                  </div>
                  {selectedJob.client.email && <p className="text-xs text-slate-500 ml-6">{selectedJob.client.email}</p>}
                  {selectedJob.client.phone && <p className="text-xs text-slate-500 ml-6">{selectedJob.client.phone}</p>}
                </div>
              )}

              {selectedJob.job_type && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Job Type</p>
                  <p className="text-sm text-slate-300">{selectedJob.job_type}</p>
                </div>
              )}

              {(selectedJob.date || selectedJob.time) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Shoot Date & Time</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <CalendarIcon className="w-4 h-4 text-slate-500" />
                    <span>
                      {selectedJob.date ? formatDate(selectedJob.date, 'long') : '—'}
                      {selectedJob.time && ` · ${selectedJob.time}${selectedJob.end_time ? ` – ${selectedJob.end_time}` : ''}`}
                    </span>
                  </div>
                </div>
              )}

              {selectedJob.location && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Location</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>{selectedJob.location}</span>
                  </div>
                </div>
              )}

              {(selectedJob.package_name || selectedJob.package_amount) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Package</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <span>
                      {selectedJob.package_name && <span className="font-medium">{selectedJob.package_name}</span>}
                      {selectedJob.package_name && selectedJob.package_amount && <span className="text-slate-500"> — </span>}
                      {selectedJob.package_amount && <span className="text-emerald-400 font-semibold">{formatCurrency(selectedJob.package_amount)}</span>}
                    </span>
                  </div>
                </div>
              )}

              {selectedJob.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Notes</p>
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedJob.notes}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Created</p>
                <p className="text-sm text-slate-400">{formatDate(selectedJob.created_at, 'long')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {selectedJob && editing && (
          <form onSubmit={handleEditJob} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault(); }} className="space-y-4">
            <Combobox
              label="Client"
              options={clients.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`, sublabel: c.email || c.phone || undefined }))}
              value={editClientId}
              onChange={setEditClientId}
              placeholder="Search clients..."
              emptyMessage="No clients found"
            />
            <Input name="title" label="Job Title" defaultValue={selectedJob.title || ''} />
            <Select name="status" label="Status" options={statusOptions} defaultValue={selectedJob.status} />
            <Select name="job_type" label="Job Type" options={jobTypeOptions} defaultValue={selectedJob.job_type || ''} />
            <div className="grid grid-cols-2 gap-3">
              <Input name="date" label="Shoot Date" type="date" defaultValue={selectedJob.date || ''} />
              <Input name="location" label="Location" defaultValue={selectedJob.location || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="time" label="Start Time" type="time" defaultValue={selectedJob.time || ''} />
              <Input name="end_time" label="End Time" type="time" defaultValue={selectedJob.end_time || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="package_name" label="Package" defaultValue={selectedJob.package_name || ''} />
              <Input name="package_amount" label="Amount ($)" type="number" step="0.01" defaultValue={selectedJob.package_amount || ''} />
            </div>
            <Textarea name="notes" label="Notes" defaultValue={selectedJob.notes || ''} />
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        )}
      </SlideOver>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteJob}
        title="Delete Job"
        message={`Are you sure you want to delete "${deleteTarget?.title || deleteTarget?.job_type || 'this job'}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

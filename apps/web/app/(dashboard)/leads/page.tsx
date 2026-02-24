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
import { formatDate, initials, cn, formatCurrency } from '@/lib/utils';
import { getLeads, getClients, createLead, updateLead, deleteLead, getCurrentPhotographer, createNewClient, getPackages, createJob, createInvoice } from '@/lib/queries';
import { generateContract } from '@/lib/contract-queries';
import { sendInvoiceEmail, sendBookingConfirmationEmail, sendContractSigningEmail } from '@/lib/email';
import { Inbox, Plus, LayoutGrid, List, Calendar as CalendarIcon, Pencil, Trash2, MapPin, User, MessageSquare, Briefcase, Loader2 } from 'lucide-react';
import type { Lead, LeadStatus, Client, Photographer } from '@/lib/types';

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

const sourceOptions = [
  { value: '', label: 'Select source...' },
  { value: 'Website', label: 'Website' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Google', label: 'Google' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Word of Mouth', label: 'Word of Mouth' },
  { value: 'Other', label: 'Other' },
];

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
];

const pipelineColumns: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'new', label: 'New', color: 'bg-blue-500' },
  { status: 'contacted', label: 'Contacted', color: 'bg-amber-500' },
  { status: 'quoted', label: 'Quoted', color: 'bg-purple-500' },
  { status: 'booked', label: 'Booked', color: 'bg-emerald-500' },
];

function LeadCard({ lead, onStatusChange, onClick }: { lead: Lead; onStatusChange: (id: string, status: LeadStatus) => void; onClick: () => void }) {
  const clientName = lead.client
    ? `${lead.client.first_name} ${lead.client.last_name || ''}`
    : 'Unknown';

  return (
    <div onClick={onClick} className="p-3 rounded-lg border border-white/[0.06] bg-[#0a0a12] hover:border-white/[0.1] transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-semibold text-indigo-300">{initials(clientName)}</span>
          </div>
          <p className="text-sm font-medium text-white">{clientName}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {lead.job_type && (
          <span className="inline-block px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 text-xs">{lead.job_type}</span>
        )}
        {lead.preferred_date && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarIcon className="w-3 h-3" />
            <span>{formatDate(lead.preferred_date)}</span>
          </div>
        )}
        {lead.location && <p className="text-xs text-slate-600">{lead.location}</p>}
        {lead.source && <p className="text-[10px] text-slate-600">via {lead.source}</p>}
      </div>
      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {pipelineColumns.filter((c) => c.status !== lead.status).slice(0, 2).map((col) => (
          <button
            key={col.status}
            onClick={(e) => { e.stopPropagation(); onStatusChange(lead.id, col.status); }}
            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [isNewClient, setIsNewClient] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showLost, setShowLost] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [photographer, leadsData, clientsData] = await Promise.all([
      getCurrentPhotographer(),
      getLeads(),
      getClients(),
    ]);
    if (photographer) {
      setPhotographerId(photographer.id);
      setPhotographer(photographer);
      const pkgs = await getPackages(true);
      setPackages(pkgs.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: Number(p.price),
        duration_hours: Number(p.duration_hours),
        included_images: p.included_images,
        deliverables: p.deliverables || '',
        is_active: p.is_active,
        require_deposit: p.require_deposit,
        deposit_percent: p.deposit_percent,
      })));
    }
    setLeads(leadsData.sort((a, b) => {
      if (!a.preferred_date && !b.preferred_date) return 0;
      if (!a.preferred_date) return 1;
      if (!b.preferred_date) return -1;
      return new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime();
    }));
    setClients(clientsData);
    setLoading(false);
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    const updated = await updateLead(leadId, { status: newStatus });
    if (updated) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? updated : l));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
    }
  }

  async function handleAddLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photographerId) return;
    setSaving(true);

    const form = new FormData(e.currentTarget);
    let clientId = selectedClientId;

    if (isNewClient) {
      const firstName = form.get('new_first_name') as string;
      if (!firstName) { setSaving(false); return; }
      const newClient = await createNewClient({
        first_name: firstName,
        last_name: form.get('new_last_name') as string || undefined,
        email: form.get('new_email') as string || undefined,
        phone: form.get('new_phone') as string || undefined,
        source: form.get('source') as string || undefined,
      });
      if (!newClient) { setSaving(false); return; }
      clientId = newClient.id;
      setClients((prev) => [newClient, ...prev]);
    }

    const pkg = selectedPackage ? packages.find((p) => p.id === selectedPackage) : null;

    const newLead = await createLead({
      client_id: clientId || undefined,
      job_type: form.get('job_type') as string || undefined,
      preferred_date: form.get('preferred_date') as string || undefined,
      location: form.get('location') as string || undefined,
      source: form.get('source') as string || undefined,
      status: pkg ? 'quoted' : 'new',
      notes: form.get('notes') as string || undefined,
      quoted_package_id: pkg?.id || undefined,
      quoted_amount: pkg?.price || undefined,
    } as any);

    if (newLead) {
      // Send quote email if package selected and client has email
      if (pkg && newLead.quote_token && photographer) {
        const client = isNewClient
          ? { first_name: form.get('new_first_name') as string, email: form.get('new_email') as string }
          : clients.find((c) => c.id === clientId);

        if (client?.email) {
          const brandColor = photographer.brand_settings?.primary_color || '#c47d4a';
          const bizName = photographer.business_name || photographer.name || '';
          const acceptUrl = `${window.location.origin}/quote/${newLead.quote_token}`;

          fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template: 'quote',
              to: client.email,
              data: {
                clientName: client.first_name || 'there',
                packageName: pkg.name,
                amount: formatCurrency(pkg.price),
                includedImages: String(pkg.included_images || ''),
                jobDate: form.get('preferred_date') as string || '',
                location: form.get('location') as string || '',
                photographerName: photographer.name || '',
                businessName: bizName,
                brandColor,
                acceptUrl,
              },
            }),
          }).catch((err) => console.error('Failed to send quote email:', err));

          // Update quote_sent_at
          const { createClient: createSB } = await import('@/lib/supabase/client');
          const sb = createSB();
          await sb.from('leads').update({ quote_sent_at: new Date().toISOString() }).eq('id', newLead.id);
        }
      }

      setLeads((prev) => [newLead, ...prev]);
      setShowAddModal(false);
      setIsNewClient(true);
      setSelectedClientId('');
      setSelectedPackage('');
    }
    setSaving(false);
  }

  async function handleEditLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLead) return;
    setEditSaving(true);

    const form = new FormData(e.currentTarget);
    const updated = await updateLead(selectedLead.id, {
      job_type: form.get('job_type') as string || undefined,
      preferred_date: form.get('preferred_date') as string || undefined,
      location: form.get('location') as string || undefined,
      source: form.get('source') as string || undefined,
      status: form.get('status') as LeadStatus,
      notes: form.get('notes') as string || undefined,
    });

    if (updated) {
      setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      setSelectedLead(updated);
      setEditing(false);
    }
    setEditSaving(false);
  }

  async function handleDeleteLead() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteLead(deleteTarget.id);
    if (success) {
      setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (selectedLead?.id === deleteTarget.id) setSelectedLead(null);
    }
    setDeleting(false);
  }

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
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">
            {leads.filter((l) => l.status !== 'lost').length} active lead{leads.filter((l) => l.status !== 'lost').length !== 1 ? 's' : ''}
            {leads.filter((l) => l.status === 'lost').length > 0 && (
              <span className="text-slate-600"> · {leads.filter((l) => l.status === 'lost').length} lost</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-white/[0.08] overflow-hidden">
            <button onClick={() => setView('pipeline')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'pipeline' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView('list')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'list' ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />Add Lead
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <EmptyState icon={Inbox} title="No leads yet" description="Add your first lead to start building your pipeline." action={{ label: 'Add Lead', onClick: () => setShowAddModal(true) }} />
      ) : view === 'pipeline' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {pipelineColumns.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.status);
            return (
              <div key={col.status} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className={cn('w-2 h-2 rounded-full', col.color)} />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{col.label}</p>
                  <span className="text-xs text-slate-600 ml-auto">{colLeads.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {colLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onStatusChange={handleStatusChange} onClick={() => { setSelectedLead(lead); setEditing(false); }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'list' ? (
        <div>
          {leads.filter((l) => l.status === 'lost').length > 0 && (
            <button
              onClick={() => setShowLost(!showLost)}
              className={cn('mb-3 text-xs px-3 py-1.5 rounded-lg border transition-all', showLost ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300')}
            >
              {showLost ? 'Hide' : 'Show'} lost leads ({leads.filter((l) => l.status === 'lost').length})
            </button>
          )}
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] divide-y divide-white/[0.03]">
            {leads.filter((l) => showLost || l.status !== 'lost').map((lead) => {
              const clientName = lead.client ? `${lead.client.first_name} ${lead.client.last_name || ''}` : 'Unknown';
              return (
                <div key={lead.id} onClick={() => { setSelectedLead(lead); setEditing(false); }} className="px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-indigo-300">{initials(clientName)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{clientName}</p>
                    <p className="text-xs text-slate-500">{lead.job_type}{lead.location ? ` · ${lead.location}` : ''}{lead.source ? ` · via ${lead.source}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={lead.status} />
                    {lead.preferred_date && <p className="text-xs text-slate-600 mt-1">{formatDate(lead.preferred_date)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Add Lead Modal */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setIsNewClient(true); setSelectedClientId(''); setSelectedPackage(''); }} title="Add Lead">
        <form onSubmit={handleAddLead} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Client</label>
            <div className="flex items-center rounded-lg border border-white/[0.08] overflow-hidden mb-3">
              <button type="button" onClick={() => setIsNewClient(true)} className={cn('flex-1 px-3 py-2 text-xs font-medium transition-colors', isNewClient ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>New Client</button>
              <button type="button" onClick={() => setIsNewClient(false)} className={cn('flex-1 px-3 py-2 text-xs font-medium transition-colors', !isNewClient ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300')}>Existing Client</button>
            </div>
            {isNewClient ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input name="new_first_name" label="First Name" placeholder="Sarah" required />
                  <Input name="new_last_name" label="Last Name" placeholder="Johnson" />
                </div>
                <Input name="new_email" label="Email" type="email" placeholder="sarah@example.com" />
                <Input name="new_phone" label="Phone" placeholder="0412 345 678" />
              </div>
            ) : (
              <Combobox
                options={clients.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`, sublabel: c.email || c.phone || undefined }))}
                value={selectedClientId}
                onChange={setSelectedClientId}
                placeholder="Search clients by name or email..."
                emptyMessage="No clients found"
              />
            )}
          </div>
          <Select name="job_type" label="Job Type" options={jobTypeOptions} />

          {/* Package interest */}
          {packages.length > 0 && (
            <Select
              name="interested_package"
              label="Interested Package"
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              options={[
                { value: '', label: 'Select package (optional)...' },
                ...packages.map((pkg) => ({
                  value: pkg.id,
                  label: `${pkg.name} — ${formatCurrency(pkg.price)} · ${pkg.included_images} images`,
                })),
              ]}
            />
          )}

          <Input name="preferred_date" label="Preferred Date" type="date" />
          <Input name="location" label="Location" placeholder="Venue or area" />
          <Select name="source" label="Source" options={sourceOptions} />
          <Textarea name="notes" label="Notes" placeholder="Budget, guest count, style preferences..." />
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Add Lead'}</Button>
          </div>
        </form>
      </Modal>

      {/* Lead Detail Slide-over */}
      <SlideOver
        open={!!selectedLead}
        onClose={() => { setSelectedLead(null); setEditing(false); }}
        title={selectedLead?.client ? `${selectedLead.client.first_name} ${selectedLead.client.last_name || ''}` : 'Lead Details'}
      >
        {selectedLead && !editing && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3" />Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(selectedLead)}>
                <Trash2 className="w-3 h-3" />Delete
              </Button>
            </div>

            {/* Status buttons */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Status</p>
              <div className="flex items-center gap-2 flex-wrap">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(selectedLead.id, opt.value as LeadStatus)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                      selectedLead.status === opt.value
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.1]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {selectedLead.client && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Client</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-300">{selectedLead.client.first_name} {selectedLead.client.last_name || ''}</span>
                  </div>
                  {selectedLead.client.email && <p className="text-xs text-slate-500 ml-6">{selectedLead.client.email}</p>}
                  {selectedLead.client.phone && <p className="text-xs text-slate-500 ml-6">{selectedLead.client.phone}</p>}
                </div>
              )}

              {selectedLead.job_type && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Job Type</p>
                  <p className="text-sm text-slate-300">{selectedLead.job_type}</p>
                </div>
              )}

              {selectedLead.preferred_date && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Preferred Date</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <CalendarIcon className="w-4 h-4 text-slate-500" />
                    <span>{formatDate(selectedLead.preferred_date, 'long')}</span>
                  </div>
                </div>
              )}

              {selectedLead.location && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Location</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>{selectedLead.location}</span>
                  </div>
                </div>
              )}

              {selectedLead.source && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Source</p>
                  <p className="text-sm text-slate-300">{selectedLead.source}</p>
                </div>
              )}

              {selectedLead.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Notes</p>
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Created</p>
                <p className="text-sm text-slate-400">{formatDate(selectedLead.created_at, 'long')}</p>
              </div>
            </div>
          </div>
        )}

        {selectedLead && editing && (
          <form onSubmit={handleEditLead} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).getAttribute('type') !== 'submit') e.preventDefault(); }} className="space-y-4">
            <Select name="status" label="Status" options={statusOptions} defaultValue={selectedLead.status} />
            <Select name="job_type" label="Job Type" options={jobTypeOptions} defaultValue={selectedLead.job_type || ''} />
            <Input name="preferred_date" label="Preferred Date" type="date" defaultValue={selectedLead.preferred_date || ''} />
            <Input name="location" label="Location" defaultValue={selectedLead.location || ''} placeholder="Venue or area" />
            <Select name="source" label="Source" options={sourceOptions} defaultValue={selectedLead.source || ''} />
            <Textarea name="notes" label="Notes" defaultValue={selectedLead.notes || ''} />
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        )}
      </SlideOver>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteLead}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This cannot be undone."
        loading={deleting}
      />
    </div>
  );
}

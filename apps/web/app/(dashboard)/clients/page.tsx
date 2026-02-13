'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SlideOver } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { formatDate, initials } from '@/lib/utils';
import { getClients, createNewClient, updateClient, deleteClient, getCurrentPhotographer } from '@/lib/queries';
import { Users, Plus, Search, Mail, Phone, Pencil, Trash2, X } from 'lucide-react';
import type { Client } from '@/lib/types';

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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photographerId, setPhotographerId] = useState<string | null>(null);

  // Detail/Edit
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [photographer, clientData] = await Promise.all([
      getCurrentPhotographer(),
      getClients(),
    ]);
    if (photographer) setPhotographerId(photographer.id);
    setClients(clientData);
    setLoading(false);
  }

  async function handleAddClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photographerId) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const tagsRaw = form.get('tags') as string;
    const newClient = await createNewClient({
      first_name: form.get('first_name') as string,
      last_name: form.get('last_name') as string || undefined,
      email: form.get('email') as string || undefined,
      phone: form.get('phone') as string || undefined,
      source: form.get('source') as string || undefined,
      notes: form.get('notes') as string || undefined,
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
    if (newClient) {
      setClients((prev) => [newClient, ...prev]);
      setShowAddModal(false);
    }
    setSaving(false);
  }

  async function handleEditClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedClient) return;
    setEditSaving(true);
    const form = new FormData(e.currentTarget);
    const tagsRaw = form.get('tags') as string;
    const updated = await updateClient(selectedClient.id, {
      first_name: form.get('first_name') as string,
      last_name: form.get('last_name') as string || undefined,
      email: form.get('email') as string || undefined,
      phone: form.get('phone') as string || undefined,
      source: form.get('source') as string || undefined,
      notes: form.get('notes') as string || undefined,
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
    if (updated) {
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setSelectedClient(updated);
      setEditing(false);
    }
    setEditSaving(false);
  }

  async function handleDeleteClient() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteClient(deleteTarget.id);
    if (success) {
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (selectedClient?.id === deleteTarget.id) {
        setSelectedClient(null);
      }
    }
    setDeleting(false);
  }

  const filteredClients = clients.filter((client) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const fullName = `${client.first_name} ${client.last_name || ''}`.toLowerCase();
    return fullName.includes(s) || client.email?.toLowerCase().includes(s) || client.phone?.includes(s);
  });

  const columns = [
    {
      key: 'name',
      label: 'Client',
      render: (client: Client) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-semibold text-indigo-300">{initials(`${client.first_name} ${client.last_name || ''}`)}</span>
          </div>
          <div>
            <p className="font-medium text-white text-sm">{client.first_name} {client.last_name}</p>
            {client.email && <span className="flex items-center gap-1 text-[11px] text-slate-500"><Mail className="w-3 h-3" />{client.email}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (client: Client) => (
        <span className="flex items-center gap-1.5 text-slate-400">
          {client.phone ? <><Phone className="w-3 h-3 text-slate-600" />{client.phone}</> : '—'}
        </span>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (client: Client) => (
        <div className="flex items-center gap-1 flex-wrap">
          {(client.tags || []).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06]">{tag}</span>
          ))}
        </div>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: '100px',
      render: (client: Client) => <span className="text-slate-500 text-xs">{client.source || '—'}</span>,
    },
    {
      key: 'created_at',
      label: 'Added',
      width: '120px',
      render: (client: Client) => <span className="text-slate-500">{formatDate(client.created_at, 'relative')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">{clients.length} total client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-3.5 h-3.5" />Add Client
        </Button>
      </div>

      {!loading && clients.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filteredClients.length > 0 ? (
        <DataTable columns={columns} data={filteredClients} onRowClick={(c) => { setSelectedClient(c); setEditing(false); }} />
      ) : clients.length > 0 ? (
        <div className="text-center py-12 text-sm text-slate-500">No clients match your search.</div>
      ) : (
        <EmptyState icon={Users} title="No clients yet" description="Add your first client to get started." action={{ label: 'Add Client', onClick: () => setShowAddModal(true) }} />
      )}

      {/* Add Client Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Client">
        <form onSubmit={handleAddClient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="first_name" label="First Name" placeholder="Sarah" required />
            <Input name="last_name" label="Last Name" placeholder="Johnson" />
          </div>
          <Input name="email" label="Email" type="email" placeholder="sarah@example.com" />
          <Input name="phone" label="Phone" placeholder="0412 345 678" />
          <Select name="source" label="How did they find you?" options={sourceOptions} />
          <Input name="tags" label="Tags" placeholder="wedding, vip (comma separated)" />
          <Textarea name="notes" label="Notes" placeholder="Any notes about this client..." />
          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Add Client'}</Button>
          </div>
        </form>
      </Modal>

      {/* Client Detail Slide-over */}
      <SlideOver
        open={!!selectedClient}
        onClose={() => { setSelectedClient(null); setEditing(false); }}
        title={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name || ''}` : ''}
      >
        {selectedClient && !editing && (
          <div className="space-y-6">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3" />Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(selectedClient)}>
                <Trash2 className="w-3 h-3" />Delete
              </Button>
            </div>

            {/* Info */}
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Contact</p>
                <div className="space-y-2">
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <a href={`mailto:${selectedClient.email}`} className="text-indigo-400 hover:text-indigo-300">{selectedClient.email}</a>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <a href={`tel:${selectedClient.phone}`} className="text-slate-300">{selectedClient.phone}</a>
                    </div>
                  )}
                </div>
              </div>

              {(selectedClient.tags || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Tags</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {selectedClient.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06]">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedClient.source && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Source</p>
                  <p className="text-sm text-slate-300">{selectedClient.source}</p>
                </div>
              )}

              {selectedClient.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Notes</p>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedClient.notes}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Added</p>
                <p className="text-sm text-slate-400">{formatDate(selectedClient.created_at, 'long')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {selectedClient && editing && (
          <form onSubmit={handleEditClient} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input name="first_name" label="First Name" defaultValue={selectedClient.first_name} required />
              <Input name="last_name" label="Last Name" defaultValue={selectedClient.last_name || ''} />
            </div>
            <Input name="email" label="Email" type="email" defaultValue={selectedClient.email || ''} />
            <Input name="phone" label="Phone" defaultValue={selectedClient.phone || ''} />
            <Select name="source" label="Source" options={sourceOptions} defaultValue={selectedClient.source || ''} />
            <Input name="tags" label="Tags" defaultValue={(selectedClient.tags || []).join(', ')} placeholder="comma separated" />
            <Textarea name="notes" label="Notes" defaultValue={selectedClient.notes || ''} />
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
        onConfirm={handleDeleteClient}
        title="Delete Client"
        message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name || ''}? This will also remove their leads, jobs, and invoices. This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

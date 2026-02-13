'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SlideOver } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { Combobox } from '@/components/ui/combobox';
import { formatDate, formatCurrency, initials, cn } from '@/lib/utils';
import { getInvoices, getClients, getJobs, createInvoice, updateInvoice, deleteInvoice, getCurrentPhotographer } from '@/lib/queries';
import { FileText, Plus, Pencil, Trash2, Send, Check, Calendar as CalendarIcon, User, Briefcase, Zap } from 'lucide-react';
import type { Invoice, InvoiceStatus, InvoiceType, Client, Job } from '@/lib/types';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PackageItem {
  id: string;
  name: string;
  price: number;
  duration_hours: number;
  included_images: number;
  deliverables: string;
  is_active: boolean;
  require_deposit: boolean;
  deposit_percent: number;
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

const invoiceTypeLabels: Record<string, string> = {
  deposit: 'Deposit',
  final: 'Final Payment',
  custom: 'Custom',
};

function getTwoWeeksBefore(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 14);
  return d.toISOString().split('T')[0];
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);

  // Create modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(10);
  const [dueDate, setDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('custom');

  // Auto-generate
  const [autoJobId, setAutoJobId] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Detail/Edit
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [photographer, invoicesData, clientsData, jobsData] = await Promise.all([
      getCurrentPhotographer(), getInvoices(), getClients(), getJobs(),
    ]);
    if (photographer) {
      setPhotographerId(photographer.id);
      try {
        const savedPkgs = localStorage.getItem(`packages_${photographer.id}`);
        if (savedPkgs) setPackages(JSON.parse(savedPkgs));
      } catch {}
    }
    setInvoices(invoicesData);
    setClients(clientsData);
    setJobs(jobsData);
    setLoading(false);
  }

  function generateInvoiceNumber(jobId?: string) {
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId);
      if (job?.job_number) {
        return `INV-${String(job.job_number).padStart(4, '0')}`;
      }
    }
    const num = String(invoices.length + 1).padStart(4, '0');
    return `INV-${num}`;
  }

  // ==============================
  // Auto-generate deposit + final
  // ==============================
  async function handleAutoGenerate() {
    if (!photographerId || !autoJobId) return;
    const job = jobs.find((j) => j.id === autoJobId);
    if (!job || !job.package_amount) return;

    // Find matching package to get deposit settings
    const pkg = packages.find((p) => p.name === job.package_name);
    const requiresDeposit = pkg?.require_deposit ?? false;
    const depositPercent = pkg?.deposit_percent ?? 30;

    setAutoGenerating(true);
    const packageAmount = Number(job.package_amount);
    const gst = 10;
    const jobLabel = job.title || job.job_type || 'Photography';
    const pkgLabel = job.package_name || 'Package';
    const jobNum = String(job.job_number || 0).padStart(4, '0');

    if (requiresDeposit) {
      // Split into deposit + final
      const depositAmount = Math.round(packageAmount * (depositPercent / 100) * 100) / 100;
      const finalAmount = Math.round((packageAmount - depositAmount) * 100) / 100;
      const depositDue = getTodayStr();
      const finalDue = job.date ? getTwoWeeksBefore(job.date) : undefined;

      const depositTax = Math.round(depositAmount * (gst / 100) * 100) / 100;
      const depositInv = await createInvoice({
        client_id: job.client_id || undefined,
        job_id: job.id,
        invoice_number: `INV-${jobNum}-DEP`,
        invoice_type: 'deposit',
        subtotal: depositAmount,
        tax_rate: gst,
        tax_amount: depositTax,
        total: Math.round((depositAmount + depositTax) * 100) / 100,
        status: 'sent',
        due_date: depositDue,
        line_items: [{
          description: `${jobLabel} — ${pkgLabel} (${depositPercent}% deposit)`,
          quantity: 1, unit_price: depositAmount, total: depositAmount,
        }],
        notes: `Deposit of ${depositPercent}% to secure your booking. Due upon receipt.`,
      });

      const finalTax = Math.round(finalAmount * (gst / 100) * 100) / 100;
      const finalInv = await createInvoice({
        client_id: job.client_id || undefined,
        job_id: job.id,
        invoice_number: `INV-${jobNum}-FIN`,
        invoice_type: 'final',
        subtotal: finalAmount,
        tax_rate: gst,
        tax_amount: finalTax,
        total: Math.round((finalAmount + finalTax) * 100) / 100,
        status: 'draft',
        due_date: finalDue,
        line_items: [{
          description: `${jobLabel} — ${pkgLabel} (remaining balance)`,
          quantity: 1, unit_price: finalAmount, total: finalAmount,
        }],
        notes: finalDue ? `Final payment due ${new Date(finalDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (14 days before shoot).` : 'Final payment — remaining balance.',
      });

      const newInvoices: Invoice[] = [];
      if (depositInv) newInvoices.push(depositInv);
      if (finalInv) newInvoices.push(finalInv);
      setInvoices((prev) => [...newInvoices, ...prev]);
    } else {
      // Single invoice — full amount, due 2 weeks before shoot
      const fullDue = job.date ? getTwoWeeksBefore(job.date) : undefined;
      const fullTax = Math.round(packageAmount * (gst / 100) * 100) / 100;
      const fullInv = await createInvoice({
        client_id: job.client_id || undefined,
        job_id: job.id,
        invoice_number: `INV-${jobNum}`,
        invoice_type: 'final',
        subtotal: packageAmount,
        tax_rate: gst,
        tax_amount: fullTax,
        total: Math.round((packageAmount + fullTax) * 100) / 100,
        status: 'draft',
        due_date: fullDue,
        line_items: [{
          description: `${jobLabel} — ${pkgLabel}`,
          quantity: 1, unit_price: packageAmount, total: packageAmount,
        }],
        notes: fullDue ? `Payment due ${new Date(fullDue).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (14 days before shoot).` : undefined,
      });

      if (fullInv) setInvoices((prev) => [fullInv, ...prev]);
    }

    setAutoGenerating(false);
    setShowAutoModal(false);
    setAutoJobId('');
  }

  // ==============================
  // Manual create
  // ==============================
  function handleJobSelect(jobId: string) {
    setSelectedJobId(jobId);
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      if (job.client_id) setSelectedClientId(job.client_id);
      if (job.package_amount) {
        setLineItems([{
          description: `${job.title || job.job_type || 'Photography'} — ${job.package_name || 'Package'}`,
          quantity: 1,
          unit_price: job.package_amount,
          total: job.package_amount,
        }]);
      }
    }
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].total = Number(updated[index].quantity) * Number(updated[index].unit_price);
      }
      return updated;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!photographerId) return;
    setSaving(true);

    const newInvoice = await createInvoice({
      client_id: selectedClientId || undefined,
      job_id: selectedJobId || undefined,
      invoice_number: generateInvoiceNumber(selectedJobId || undefined),
      invoice_type: invoiceType,
      subtotal: subtotal,
      tax_rate: taxRate,
      tax_amount: tax,
      total: total,
      status: 'draft',
      due_date: dueDate || undefined,
      line_items: lineItems.filter((li) => li.description),
      notes: invoiceNotes || undefined,
    });

    if (newInvoice) {
      setInvoices((prev) => [newInvoice, ...prev]);
      resetAddForm();
    }
    setSaving(false);
  }

  function resetAddForm() {
    setShowAddModal(false);
    setSelectedClientId('');
    setSelectedJobId('');
    setLineItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
    setDueDate('');
    setInvoiceNotes('');
    setInvoiceType('custom');
  }

  async function handleStatusChange(invoiceId: string, newStatus: InvoiceStatus) {
    const updates: Partial<Invoice> = { status: newStatus };
    if (newStatus === 'paid') {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (inv) updates.paid_amount = inv.total;
    }
    const updated = await updateInvoice(invoiceId, updates);
    if (updated) {
      setInvoices((prev) => prev.map((i) => i.id === invoiceId ? updated : i));
      if (selectedInvoice?.id === invoiceId) setSelectedInvoice(updated);
    }
  }

  async function handleDeleteInvoice() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteInvoice(deleteTarget.id);
    if (success) {
      setInvoices((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (selectedInvoice?.id === deleteTarget.id) setSelectedInvoice(null);
    }
    setDeleting(false);
  }

  const totalOutstanding = invoices
    .filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + (Number(i.total) - Number(i.paid_amount || 0)), 0);
  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);

  // Jobs with package amounts that don't already have both invoices
  const invoicableJobs = jobs.filter((j) => {
    if (!j.package_amount) return false;
    const jobInvoices = invoices.filter((i) => i.job_id === j.id);
    const hasDeposit = jobInvoices.some((i) => i.invoice_type === 'deposit');
    const hasFinal = jobInvoices.some((i) => i.invoice_type === 'final');
    return !hasDeposit || !hasFinal;
  });

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice',
      render: (inv: Invoice) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}</p>
            {inv.invoice_type && inv.invoice_type !== 'custom' && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                inv.invoice_type === 'deposit' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'
              )}>
                {invoiceTypeLabels[inv.invoice_type]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{inv.line_items?.[0]?.description || '—'}</p>
        </div>
      ),
    },
    {
      key: 'client',
      label: 'Client',
      render: (inv: Invoice) => {
        const name = inv.client ? `${inv.client.first_name} ${inv.client.last_name || ''}` : '—';
        return <span className="text-slate-300 text-sm">{name}</span>;
      },
    },
    {
      key: 'total',
      label: 'Amount',
      width: '120px',
      render: (inv: Invoice) => <span className="text-white font-semibold">{formatCurrency(Number(inv.total))}</span>,
    },
    {
      key: 'due_date',
      label: 'Due Date',
      width: '120px',
      render: (inv: Invoice) => (
        <span className={cn('text-sm', inv.status === 'overdue' ? 'text-red-400' : 'text-slate-500')}>
          {inv.due_date ? formatDate(inv.due_date) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (inv: Invoice) => <StatusBadge status={inv.status} />,
    },
  ];

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
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            {invoices.length > 0
              ? `${formatCurrency(totalOutstanding)} outstanding · ${formatCurrency(totalPaid)} collected`
              : 'No invoices yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {invoicableJobs.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowAutoModal(true)}>
              <Zap className="w-3.5 h-3.5" />Generate from Job
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-3.5 h-3.5" />Custom Invoice
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Generate deposit + final invoices from a job, or create a custom invoice." action={{ label: 'Generate from Job', onClick: () => setShowAutoModal(true) }} />
      ) : (
        <>
          <div className="flex items-center gap-1 border-b border-white/[0.06] -mb-[1px]">
            {[
              { label: 'All', value: 'all' as const },
              { label: 'Draft', value: 'draft' as const },
              { label: 'Sent', value: 'sent' as const },
              { label: 'Overdue', value: 'overdue' as const },
              { label: 'Paid', value: 'paid' as const },
            ].map((tab) => {
              const count = tab.value === 'all' ? invoices.length : invoices.filter((i) => i.status === tab.value).length;
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
          <DataTable columns={columns} data={filtered} onRowClick={(inv) => { setSelectedInvoice(inv); setEditing(false); }} emptyMessage="No invoices found" />
        </>
      )}

      {/* Auto-Generate Modal */}
      <Modal open={showAutoModal} onClose={() => { setShowAutoModal(false); setAutoJobId(''); }} title="Generate Invoices from Job">
        <div className="space-y-4">
          <Select
            label="Select Job"
            value={autoJobId}
            onChange={(e) => setAutoJobId(e.target.value)}
            options={[
              { value: '', label: 'Choose a job...' },
              ...invoicableJobs.map((j) => ({
                value: j.id,
                label: `${j.title || j.job_type || 'Untitled'} — ${j.client ? `${j.client.first_name} ${j.client.last_name || ''}` : 'No client'}${j.package_amount ? ` — ${formatCurrency(j.package_amount)}` : ''}`,
              })),
            ]}
          />

          {autoJobId && (() => {
            const job = jobs.find((j) => j.id === autoJobId);
            if (!job?.package_amount) return null;
            const pkgAmount = Number(job.package_amount);
            const pkg = packages.find((p) => p.name === job.package_name);
            const requiresDeposit = pkg?.require_deposit ?? false;
            const depositPercent = pkg?.deposit_percent ?? 30;
            const dep = Math.round(pkgAmount * (depositPercent / 100) * 100) / 100;
            const fin = Math.round((pkgAmount - dep) * 100) / 100;
            const finDue = job.date ? getTwoWeeksBefore(job.date) : null;
            const fullDue = job.date ? getTwoWeeksBefore(job.date) : null;

            return (
              <div className="space-y-3">
                {requiresDeposit ? (
                  <>
                    <p className="text-sm text-slate-400">This package requires a deposit. Two invoices will be created:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/15 bg-amber-500/5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-400">DEPOSIT</span>
                        <span className="text-sm text-slate-300">{depositPercent}% — {formatCurrency(dep)} — due today</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-indigo-500/15 bg-indigo-500/5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-500/15 text-indigo-400">FINAL</span>
                        <span className="text-sm text-slate-300">{100 - depositPercent}% — {formatCurrency(fin)} — due {finDue ? formatDate(finDue) : 'TBD'}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Package total</span><span className="text-white font-semibold">{formatCurrency(pkgAmount)}</span></div>
                      <div className="flex justify-between text-xs pt-1 border-t border-white/[0.06]">
                        <span className="text-slate-600">+ 10% GST on each invoice</span>
                        <span className="text-slate-600">Total inc. GST: {formatCurrency(Math.round(pkgAmount * 1.1 * 100) / 100)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">No deposit required. One invoice will be created:</p>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-indigo-500/15 bg-indigo-500/5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-500/15 text-indigo-400">FULL</span>
                      <span className="text-sm text-slate-300">{formatCurrency(pkgAmount)} — due {fullDue ? formatDate(fullDue) : 'TBD'}</span>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] p-3 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Total inc. GST</span><span className="text-white font-semibold">{formatCurrency(Math.round(pkgAmount * 1.1 * 100) / 100)}</span></div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowAutoModal(false); setAutoJobId(''); }}>Cancel</Button>
            <Button className="flex-1" disabled={!autoJobId || autoGenerating} onClick={handleAutoGenerate}>
              {autoGenerating ? 'Generating...' : <><Zap className="w-3.5 h-3.5" />Generate Invoice{autoJobId && (() => { const job = jobs.find(j => j.id === autoJobId); const pkg = packages.find(p => p.name === job?.package_name); return pkg?.require_deposit ? 's' : ''; })()}</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Custom Invoice Modal */}
      <Modal open={showAddModal} onClose={resetAddForm} title="Custom Invoice" className="max-w-xl">
        <form onSubmit={handleCreateInvoice} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
          {jobs.length > 0 && (
            <Select
              label="Link to Job (optional)"
              value={selectedJobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              options={[
                { value: '', label: 'No job linked...' },
                ...jobs.map((j) => ({
                  value: j.id,
                  label: `${j.title || j.job_type || 'Untitled'} — ${j.client ? `${j.client.first_name} ${j.client.last_name || ''}` : 'No client'}${j.package_amount ? ` — ${formatCurrency(j.package_amount)}` : ''}`,
                })),
              ]}
            />
          )}

          <Combobox
            label="Client"
            options={clients.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name || ''}`, sublabel: c.email || undefined }))}
            value={selectedClientId}
            onChange={setSelectedClientId}
            placeholder="Search clients..."
            emptyMessage="No clients found"
          />

          {/* Line items */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Line Items</label>
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <label className="block text-[10px] text-slate-600 mb-1">Description</label>}
                    <input value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} placeholder="Photography package" className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-[10px] text-slate-600 mb-1">Qty</label>}
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateLineItem(i, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 text-center focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <label className="block text-[10px] text-slate-600 mb-1">Price</label>}
                    <input type="number" step="0.01" value={item.unit_price || ''} onChange={(e) => updateLineItem(i, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-sm text-slate-400 flex-1 text-right">{formatCurrency(item.total)}</span>
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLineItem(i)} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLineItem} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add line item</button>
          </div>

          {/* Totals */}
          <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-300">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">GST</span>
                <input type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="w-12 px-1.5 py-0.5 text-xs text-center bg-white/[0.04] border border-white/[0.08] rounded text-slate-400 focus:outline-none" />
                <span className="text-slate-600 text-xs">%</span>
              </div>
              <span className="text-slate-300">{formatCurrency(tax)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-white/[0.06]">
              <span className="text-white">Total</span>
              <span className="text-white">{formatCurrency(total)}</span>
            </div>
          </div>

          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Textarea label="Notes" value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Payment terms, bank details..." />

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={resetAddForm}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</Button>
          </div>
        </form>
      </Modal>

      {/* Invoice Detail Slide-over */}
      <SlideOver open={!!selectedInvoice} onClose={() => { setSelectedInvoice(null); setEditing(false); }} title={selectedInvoice?.invoice_number || 'Invoice'} width="lg">
        {selectedInvoice && !editing && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="w-3 h-3" />Edit</Button>
              {selectedInvoice.status === 'draft' && (
                <Button size="sm" onClick={() => handleStatusChange(selectedInvoice.id, 'sent')}><Send className="w-3 h-3" />Mark Sent</Button>
              )}
              {['sent', 'viewed', 'overdue'].includes(selectedInvoice.status) && (
                <Button size="sm" onClick={() => handleStatusChange(selectedInvoice.id, 'paid')}><Check className="w-3 h-3" />Mark Paid</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selectedInvoice)} className="ml-auto text-slate-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
            </div>

            {/* Type + Status */}
            <div className="flex items-center gap-3">
              {selectedInvoice.invoice_type && selectedInvoice.invoice_type !== 'custom' && (
                <span className={cn(
                  'text-xs px-2 py-1 rounded-lg font-medium',
                  selectedInvoice.invoice_type === 'deposit' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                )}>
                  {invoiceTypeLabels[selectedInvoice.invoice_type]}
                </span>
              )}
              <StatusBadge status={selectedInvoice.status} />
            </div>

            {/* Status buttons */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Status</p>
              <div className="flex items-center gap-2 flex-wrap">
                {statusOptions.map((opt) => (
                  <button key={opt.value} onClick={() => handleStatusChange(selectedInvoice.id, opt.value as InvoiceStatus)} className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    selectedInvoice.status === opt.value ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.1]'
                  )}>{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Client & Job */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {selectedInvoice.client && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Client</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300"><User className="w-4 h-4 text-slate-500" /><span>{selectedInvoice.client.first_name} {selectedInvoice.client.last_name || ''}</span></div>
                </div>
              )}
              {selectedInvoice.job && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Job</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300"><Briefcase className="w-4 h-4 text-slate-500" /><span>{selectedInvoice.job.title || selectedInvoice.job.job_type}</span></div>
                </div>
              )}
            </div>

            {/* Line items */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Line Items</p>
              <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                {(selectedInvoice.line_items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] last:border-0">
                    <div>
                      <p className="text-sm text-slate-300">{item.description}</p>
                      <p className="text-xs text-slate-600">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                    </div>
                    <span className="text-sm font-medium text-white">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="text-slate-300">{formatCurrency(Number(selectedInvoice.amount))}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Tax</span><span className="text-slate-300">{formatCurrency(Number(selectedInvoice.tax))}</span></div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-white/[0.06]"><span className="text-white">Total</span><span className="text-white">{formatCurrency(Number(selectedInvoice.total))}</span></div>
              {Number(selectedInvoice.paid_amount) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-emerald-500">Paid</span><span className="text-emerald-400 font-medium">{formatCurrency(Number(selectedInvoice.paid_amount))}</span></div>
              )}
            </div>

            {selectedInvoice.due_date && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Due Date</p>
                <div className="flex items-center gap-2 text-sm text-slate-300"><CalendarIcon className="w-4 h-4 text-slate-500" /><span>{formatDate(selectedInvoice.due_date, 'long')}</span></div>
              </div>
            )}

            {selectedInvoice.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Notes</p>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{selectedInvoice.notes}</p>
              </div>
            )}
          </div>
        )}

        {selectedInvoice && editing && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setEditSaving(true);
            const form = new FormData(e.currentTarget);
            const updated = await updateInvoice(selectedInvoice.id, {
              status: form.get('status') as InvoiceStatus,
              due_date: form.get('due_date') as string || undefined,
              notes: form.get('notes') as string || undefined,
            });
            if (updated) {
              setInvoices((prev) => prev.map((i) => i.id === updated.id ? updated : i));
              setSelectedInvoice(updated);
              setEditing(false);
            }
            setEditSaving(false);
          }} className="space-y-4">
            <Select name="status" label="Status" options={statusOptions} defaultValue={selectedInvoice.status} />
            <Input name="due_date" label="Due Date" type="date" defaultValue={selectedInvoice.due_date || ''} />
            <Textarea name="notes" label="Notes" defaultValue={selectedInvoice.notes || ''} />
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </form>
        )}
      </SlideOver>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteInvoice} title="Delete Invoice" message={`Are you sure you want to delete ${deleteTarget?.invoice_number || 'this invoice'}? This cannot be undone.`} loading={deleting} />
    </div>
  );
}

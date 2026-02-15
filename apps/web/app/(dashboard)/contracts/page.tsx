'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SlideOver } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate } from '@/lib/utils';
import { getContracts, deleteContract, generateContract } from '@/lib/contract-queries';
import { getJobs, getCurrentPhotographer } from '@/lib/queries';
import { sendContractSigningEmail } from '@/lib/email';
import type { Contract, Job, Photographer } from '@/lib/types';
import {
  ScrollText, Plus, Eye, Copy, Trash2, CheckCircle2,
  Clock, Send, FileSignature, ExternalLink, Search,
} from 'lucide-react';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [photographer, setPhotographer] = useState<Photographer | null>(null);

  // Detail panel
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Generate contract
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copy link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [contractData, jobData, photographerData] = await Promise.all([
      getContracts(),
      getJobs(),
      getCurrentPhotographer(),
    ]);
    setContracts(contractData);
    setJobs(jobData);
    if (photographerData) setPhotographer(photographerData);
    setLoading(false);
  }

  async function handleGenerate(jobId: string) {
    setGenerating(true);
    const contract = await generateContract(jobId);
    if (contract) {
      setContracts((prev) => [contract, ...prev]);
      setShowGenerateModal(false);
      setSelectedContract(contract);

      // Send contract signing email to client
      const clientEmail = (contract as any).client?.email;
      const clientName = [(contract as any).client?.first_name, (contract as any).client?.last_name].filter(Boolean).join(' ');
      const jobTitle = (contract as any).job?.title || (contract as any).job?.job_type || 'Photography Session';
      if (clientEmail && photographer) {
        const signingUrl = `${window.location.origin}/sign/${contract.signing_token}`;
        sendContractSigningEmail({
          to: clientEmail,
          clientName,
          jobTitle,
          signingUrl,
          photographerName: photographer.name || '',
          businessName: photographer.business_name || photographer.name || '',
          brandColor: photographer.brand_settings?.primary_color || '#6366f1',
        }).catch((err) => console.error('Failed to send contract email:', err));
      }
    }
    setGenerating(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteContract(deleteTarget.id);
    if (success) {
      setContracts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      if (selectedContract?.id === deleteTarget.id) setSelectedContract(null);
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  function getSigningUrl(contract: Contract) {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/sign/${contract.signing_token}`;
  }

  function copySigningLink(contract: Contract) {
    const url = getSigningUrl(contract);
    navigator.clipboard.writeText(url);
    setCopiedId(contract.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filter contracts
  const filtered = contracts.filter((c) => {
    const matchesSearch = search === '' ||
      (c.client && `${c.client.first_name} ${c.client.last_name}`.toLowerCase().includes(search.toLowerCase())) ||
      (c.job && (c.job.title || c.job.job_type || '').toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Jobs that don't already have a contract
  const contractJobIds = new Set(contracts.map((c) => c.job_id).filter(Boolean));
  const availableJobs = jobs.filter((j) => !contractJobIds.has(j.id) && j.client_id);

  // Status counts
  const statusCounts = {
    all: contracts.length,
    draft: contracts.filter((c) => c.status === 'draft').length,
    sent: contracts.filter((c) => c.status === 'sent').length,
    viewed: contracts.filter((c) => c.status === 'viewed').length,
    signed: contracts.filter((c) => c.status === 'signed').length,
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-3.5 h-3.5 text-slate-500" />;
      case 'sent': return <Send className="w-3.5 h-3.5 text-blue-400" />;
      case 'viewed': return <Eye className="w-3.5 h-3.5 text-amber-400" />;
      case 'signed': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default: return null;
    }
  };

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
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Contracts</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage client contracts and e-signatures</p>
        </div>
        <Button size="sm" onClick={() => setShowGenerateModal(true)}>
          <Plus className="w-3.5 h-3.5" />Send Contract
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(['all', 'sent', 'viewed', 'signed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === status
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {status !== 'all' && statusIcon(status)}
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="text-slate-600 ml-1">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      {contracts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or job..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
          />
        </div>
      )}

      {/* Contract list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={contracts.length === 0 ? 'No contracts yet' : 'No matching contracts'}
          description={contracts.length === 0
            ? 'Contracts are automatically generated when you send one to a client. Click "Send Contract" to get started.'
            : 'Try adjusting your search or filter.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((contract) => (
            <div
              key={contract.id}
              onClick={() => setSelectedContract(contract)}
              className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#0c0c16] hover:bg-white/[0.02] cursor-pointer transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400/10 to-violet-400/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                {statusIcon(contract.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white truncate">
                    {contract.client
                      ? `${contract.client.first_name} ${contract.client.last_name || ''}`
                      : 'Unknown Client'}
                  </p>
                  <StatusBadge status={contract.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {contract.job && (
                    <span>
                      {contract.job.job_number ? `#${contract.job.job_number} · ` : ''}
                      {contract.job.title || contract.job.job_type || 'Untitled Job'}
                    </span>
                  )}
                  {contract.sent_at && <span>Sent {formatDate(contract.sent_at, 'relative')}</span>}
                  {contract.signed_at && <span className="text-emerald-400">Signed {formatDate(contract.signed_at, 'relative')}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {contract.status !== 'signed' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); copySigningLink(contract); }}
                    className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy signing link"
                  >
                    {copiedId === contract.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(contract); }}
                  className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition-colors"
                  title="Delete contract"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contract Detail Slide-Over */}
      <SlideOver
        open={!!selectedContract}
        onClose={() => setSelectedContract(null)}
        title="Contract Details"
      >
        {selectedContract && (
          <div className="space-y-6">
            {/* Status header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400/10 to-violet-400/10 border border-white/[0.08] flex items-center justify-center">
                {statusIcon(selectedContract.status)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedContract.client
                    ? `${selectedContract.client.first_name} ${selectedContract.client.last_name || ''}`
                    : 'Unknown Client'}
                </p>
                <StatusBadge status={selectedContract.status} />
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Timeline</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  Created {formatDate(selectedContract.created_at)}
                </div>
                {selectedContract.sent_at && (
                  <div className="flex items-center gap-2 text-blue-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Sent {formatDate(selectedContract.sent_at)}
                  </div>
                )}
                {selectedContract.viewed_at && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Viewed {formatDate(selectedContract.viewed_at)}
                  </div>
                )}
                {selectedContract.signed_at && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Signed {formatDate(selectedContract.signed_at)}
                  </div>
                )}
              </div>
            </div>

            {/* Signing link */}
            {selectedContract.status !== 'signed' && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Signing Link</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={getSigningUrl(selectedContract)}
                    className="flex-1 px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-400 truncate"
                  />
                  <Button size="sm" variant="secondary" onClick={() => copySigningLink(selectedContract)}>
                    {copiedId === selectedContract.id ? <><CheckCircle2 className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </Button>
                </div>
                <a
                  href={getSigningUrl(selectedContract)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Open signing page <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Signature display (if signed) */}
            {selectedContract.status === 'signed' && selectedContract.signature_data && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Signatures</p>
                {selectedContract.signature_data.photographer_signature && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500">Photographer</p>
                    <div className="rounded-lg border border-white/[0.06] bg-white p-3">
                      <img
                        src={selectedContract.signature_data.photographer_signature}
                        alt="Photographer signature"
                        className="max-h-16 mx-auto"
                      />
                    </div>
                  </div>
                )}
                {selectedContract.signature_data.signature_image && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500">Client</p>
                    <div className="rounded-lg border border-white/[0.06] bg-white p-3">
                      <img
                        src={selectedContract.signature_data.signature_image}
                        alt="Client signature"
                        className="max-h-16 mx-auto"
                      />
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Signed from IP {selectedContract.signature_data.ip_address} on {formatDate(selectedContract.signed_at!, 'long')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Contract content preview */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Contract Content</p>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedContract.content}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
              <Button
                size="sm"
                variant="secondary"
                className="text-red-400 hover:text-red-300"
                onClick={() => { setDeleteTarget(selectedContract); setSelectedContract(null); }}
              >
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Generate Contract Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !generating && setShowGenerateModal(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#0c0c16] shadow-2xl">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Send Contract</h2>
              <p className="text-xs text-slate-500 mt-0.5">Select a job to generate and send a contract to the client.</p>
            </div>
            <div className="px-5 py-4 max-h-[400px] overflow-y-auto">
              {availableJobs.length === 0 ? (
                <div className="text-center py-6">
                  <FileSignature className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No jobs available for contracts.</p>
                  <p className="text-xs text-slate-600 mt-1">All existing jobs already have contracts, or no jobs with clients exist.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleGenerate(job.id)}
                      disabled={generating}
                      className="w-full text-left p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-medium text-white">
                          {job.job_number ? `#${job.job_number} · ` : ''}
                          {job.title || job.job_type || 'Untitled Job'}
                        </p>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {job.client && <span>{job.client.first_name} {job.client.last_name || ''}</span>}
                        {job.date && <span>· {formatDate(job.date)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setShowGenerateModal(false)} disabled={generating}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Contract"
        message={`Are you sure you want to delete this contract${deleteTarget?.client ? ` for ${deleteTarget.client.first_name} ${deleteTarget.client.last_name || ''}` : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

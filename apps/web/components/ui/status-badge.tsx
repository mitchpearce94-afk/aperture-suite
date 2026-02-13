import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  // Lead statuses
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  quoted: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  booked: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lost: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  // Job statuses
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  editing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  canceled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  // Invoice statuses
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewed: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  partially_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  void: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  // Gallery statuses
  processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  expired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  // Photo statuses
  uploaded: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  edited: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  // Style profile statuses
  pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  training: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  // Processing
  queued: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  // Generic
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  signed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const statusLabels: Record<string, string> = {
  in_progress: 'In Progress',
  partially_paid: 'Partially Paid',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses = statusColors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  const label = statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border',
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}

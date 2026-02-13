'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Delete', loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-sm text-slate-400 pt-1">{message}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

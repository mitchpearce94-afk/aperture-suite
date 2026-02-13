import { EmptyState } from '@/components/ui/empty-state';
import { Construction } from 'lucide-react';

export default function EditingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Editing</h1>
      <EmptyState
        icon={Construction}
        title="Coming Soon"
        description="This feature is currently under development."
      />
    </div>
  );
}

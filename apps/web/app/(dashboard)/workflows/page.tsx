'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Zap, Plus, Mail, Clock, CheckCircle, ArrowRight,
  Inbox, Briefcase, FileText, Image, Bell,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: string[];
  icon: React.ElementType;
  enabled: boolean;
}

const defaultWorkflows: WorkflowPreset[] = [
  {
    id: '1',
    name: 'New Lead Auto-Response',
    description: 'Automatically send an email when a new lead comes in via your website.',
    trigger: 'New lead created',
    steps: ['Wait 5 minutes', 'Send welcome email with availability', 'Create follow-up task for 3 days'],
    icon: Inbox,
    enabled: false,
  },
  {
    id: '2',
    name: 'Booking Confirmation',
    description: 'Send confirmation details when a lead is booked.',
    trigger: 'Lead status → Booked',
    steps: ['Create job from lead', 'Generate invoice(s) based on package (deposit + final, or single invoice)', 'Send booking confirmation email with shoot details', 'Send contract for signing'],
    icon: Briefcase,
    enabled: false,
  },
  {
    id: '3',
    name: 'Pre-Shoot Reminder',
    description: 'Remind client about their upcoming shoot.',
    trigger: '3 days before shoot date',
    steps: ['Send reminder email with date, time, location & preparation tips'],
    icon: Bell,
    enabled: false,
  },
  {
    id: '4',
    name: 'Post-Shoot Workflow',
    description: 'Trigger after a shoot is completed.',
    trigger: 'Job status → Editing',
    steps: ['Send "your photos are being edited" email', 'Start AI processing', 'Wait 48 hours', 'Send "how did we do?" email with review link', 'Notify when gallery is ready'],
    icon: Image,
    enabled: false,
  },
  {
    id: '5',
    name: 'Gallery Delivery',
    description: 'Automatically deliver gallery and handle final payment.',
    trigger: 'Gallery approved by photographer',
    steps: ['Send gallery link to client', 'If final invoice exists and unpaid → send payment reminder', 'Wait 7 days', 'Send download reminder if images not yet downloaded'],
    icon: Image,
    enabled: false,
  },
  {
    id: '6',
    name: 'Payment Reminder',
    description: 'Chase overdue invoices automatically.',
    trigger: 'Invoice overdue by 7 days',
    steps: ['Send friendly reminder email', 'Wait 7 days', 'Send second reminder', 'Create task: call client'],
    icon: FileText,
    enabled: false,
  },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowPreset[]>(defaultWorkflows);

  function toggleWorkflow(id: string) {
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w));
  }

  const enabledCount = workflows.filter((w) => w.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">
            {enabledCount} of {workflows.length} workflows active
          </p>
        </div>
        <Button size="sm" disabled>
          <Plus className="w-3.5 h-3.5" />Custom Workflow
        </Button>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Workflows are in preview</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Toggle workflows on to see how they'll work. Email sending and full automation will be enabled once email integration is set up in Settings.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {workflows.map((workflow) => (
          <div key={workflow.id} className={cn(
            'rounded-xl border p-5 transition-all',
            workflow.enabled ? 'border-indigo-500/20 bg-indigo-500/[0.03]' : 'border-white/[0.06] bg-[#0c0c16]'
          )}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0',
                  workflow.enabled ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/[0.03] border-white/[0.06]'
                )}>
                  <workflow.icon className={cn('w-4 h-4', workflow.enabled ? 'text-indigo-400' : 'text-slate-600')} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{workflow.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{workflow.description}</p>
                </div>
              </div>
              <button onClick={() => toggleWorkflow(workflow.id)} className="flex-shrink-0">
                {workflow.enabled ? (
                  <ToggleRight className="w-8 h-8 text-indigo-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>

            {/* Steps */}
            <div className="ml-[52px]">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trigger: {workflow.trigger}</span>
              </div>
              <div className="space-y-1.5">
                {workflow.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-1 h-1 rounded-full', workflow.enabled ? 'bg-indigo-400' : 'bg-slate-700')} />
                      <span className="text-xs text-slate-400">{step}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

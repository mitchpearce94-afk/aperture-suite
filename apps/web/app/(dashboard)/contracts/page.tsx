'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils';
import { FileSignature, Save, AlertCircle, Pencil, RotateCcw } from 'lucide-react';

export default function ContractsPage() {
  const [content, setContent] = useState(DEFAULT_CONTRACT);
  const [name, setName] = useState('Photography Services Agreement');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState('');

  function handleSave() {
    if (!name.trim()) {
      setNameError('Contract name is required');
      return;
    }
    setNameError('');
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setContent(DEFAULT_CONTRACT);
    setName('Photography Services Agreement');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Contract</h1>
          <p className="text-sm text-slate-500 mt-1">
            Your contract template auto-fills with client and job details when sent. Conditional sections are included only when relevant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit Contract</Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>
                {saved ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved</> : <><Save className="w-3.5 h-3.5" />Save</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview mode */}
      {!editing && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#0c0c16] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400/10 to-violet-400/10 border border-white/[0.08] flex items-center justify-center">
                <FileSignature className="w-4 h-4 text-indigo-400/60" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{name}</h2>
                <p className="text-xs text-slate-500">This contract is automatically sent when a booking is confirmed</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 max-h-[600px] overflow-y-auto">
              <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">How it works</p>
            <div className="space-y-1.5 text-xs text-slate-500">
              <p>• Merge tags like <span className="text-indigo-400">{'{{client_name}}'}</span> are replaced with real data when the contract is generated.</p>
              <p>• Conditional blocks like <span className="text-amber-400">{'{{#if deposit}}'}</span> are only included when the job's package requires a deposit.</p>
              <p>• The contract adapts automatically — you write one template, it handles every job type.</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="space-y-4">
          <div>
            <Input
              label="Contract Name"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
              placeholder="Photography Services Agreement"
              className={nameError ? 'border-red-500/50' : ''}
            />
            {nameError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 mt-1.5">
                <AlertCircle className="w-3 h-3" />{nameError}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-400">Contract Content</label>
              <button onClick={handleReset} className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
                <RotateCcw className="w-3 h-3" />Reset to default
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={30}
              className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono resize-y leading-relaxed"
              placeholder="Enter your contract text..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Merge Tags</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['{{client_name}}', '{{client_email}}', '{{job_date}}', '{{job_time}}', '{{job_location}}', '{{package_name}}', '{{package_amount}}', '{{included_images}}', '{{business_name}}', '{{photographer_name}}', '{{today_date}}'].map((tag) => (
                  <button key={tag} type="button" onClick={() => setContent((prev) => prev + tag)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-indigo-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer">{tag}</button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Conditional Blocks</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { tag: '{{#if deposit}}...{{/if}}', desc: 'Deposit required' },
                  { tag: '{{#if second_shooter}}...{{/if}}', desc: 'Second shooter' },
                ].map((item) => (
                  <button key={item.tag} type="button" onClick={() => setContent((prev) => prev + '\n' + item.tag)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-amber-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer">{item.desc}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_CONTRACT = `PHOTOGRAPHY SERVICES AGREEMENT

This Photography Services Agreement ("Agreement") is entered into on {{today_date}} between:

Photographer: {{business_name}}, operated by {{photographer_name}}
Client: {{client_name}} ({{client_email}})


1. SERVICES

The Photographer agrees to provide professional photography services as follows:

    Date:       {{job_date}}
    Time:       {{job_time}}
    Location:   {{job_location}}
    Package:    {{package_name}}


2. COMPENSATION

The total fee for the services described above is {{package_amount}} (inclusive of GST where applicable).

{{#if deposit}}
DEPOSIT & PAYMENT SCHEDULE:
A non-refundable deposit of {{deposit_amount}} ({{deposit_percent}}% of the total fee) is required to confirm and secure the booking. The deposit is due upon signing this agreement. The remaining balance of {{final_amount}} is due no later than 14 days before the scheduled date. Failure to pay the remaining balance by the due date may result in cancellation of services, with the deposit forfeited.
{{/if}}

{{#if no_deposit}}
PAYMENT:
Full payment of {{package_amount}} is due prior to the session date. Payment must be received before the scheduled date for services to proceed.
{{/if}}

Accepted payment methods include bank transfer, credit card, or any method made available through the Photographer's invoicing system.


3. IMAGE DELIVERY

The Photographer will deliver {{included_images}} professionally edited images via a private online gallery with download access.

Delivery timeline:
    - Standard sessions: within 2-3 weeks of the session date.
    - Weddings and full-day events: within 4-6 weeks of the event date.

The Photographer reserves creative discretion over the style, composition, and final selection of images delivered. RAW or unedited files are not included and will not be provided.


4. WHAT'S INCLUDED

The selected package ({{package_name}}) includes:
    - Professional photography coverage for the duration specified in the package.
    - Professional editing and colour grading of all delivered images.
    - A private online gallery for viewing and downloading.
    - A personal-use license for all delivered images.

{{#if second_shooter}}
SECOND SHOOTER:
A qualified second photographer is included in this package. The Photographer is responsible for coordinating, directing, and editing all second shooter imagery.
{{/if}}


5. COPYRIGHT & IMAGE USAGE

The Photographer retains full copyright of all images produced under this agreement, in accordance with the Copyright Act 1968 (Cth).

The Client is granted a non-exclusive, non-transferable, personal-use license for all delivered images. This means the Client may:
    - Print images for personal display.
    - Share images on personal social media accounts.
    - Use images for personal, non-commercial purposes.

The Client may NOT:
    - Sell, license, or sublicense any images.
    - Use images for commercial or promotional purposes without prior written consent.
    - Edit, alter, or apply filters to images in a way that misrepresents the Photographer's work.

The Photographer may use selected images from the session for portfolio, website, social media, marketing, print materials, and competition entries, unless the Client requests otherwise in writing prior to the session.


6. CANCELLATION & RESCHEDULING

BY THE CLIENT:
    - 30+ days before the scheduled date: {{#if deposit}}Deposit forfeited. No further payment required.{{/if}}{{#if no_deposit}}Full refund minus a $50 administration fee.{{/if}}
    - 14-29 days before: 50% of the total fee is due.
    - Less than 14 days before: the full fee is due.
    - No-show without notice: the full fee is due, no refund.

BY THE PHOTOGRAPHER:
    - If the Photographer must cancel for any reason, the Client will receive a full refund of all payments made, or the option to reschedule at no additional cost.

RESCHEDULING:
    - The Client may reschedule once at no additional charge with a minimum of 14 days written notice, subject to the Photographer's availability.
    - Additional rescheduling requests may incur a $50 rebooking fee.

WEATHER (OUTDOOR SESSIONS):
    - In the event of severe weather that would significantly impact the quality of the session, the Photographer may offer to reschedule at no additional cost. This decision is at the Photographer's reasonable discretion.


7. LIABILITY

The Photographer carries professional indemnity insurance and takes all reasonable precautions, including the use of backup equipment and storage, to ensure the safety and delivery of images.

However, the Photographer's total liability under this agreement is limited to the total fee paid by the Client. The Photographer is not liable for:
    - Images not captured due to guest interference, venue restrictions, lighting conditions, or timeline changes outside the Photographer's control.
    - Loss, damage, or corruption of images after delivery to the Client.
    - Circumstances beyond the Photographer's reasonable control.


8. FORCE MAJEURE

If the scheduled session or event cannot proceed due to circumstances beyond either party's reasonable control — including but not limited to natural disasters, pandemics, government restrictions, severe weather events, or personal emergencies — the parties agree to work together in good faith to reschedule at a mutually agreeable date.

If rescheduling is not possible within 12 months of the original date, the Photographer will refund all payments made minus any reasonable expenses already incurred (such as travel bookings or subcontractor fees).


9. PRIVACY

The Photographer will handle all personal information in accordance with the Australian Privacy Principles. Client contact details and images are stored securely and are not shared with third parties without consent, except as required to deliver the services described in this agreement (e.g. online gallery hosting, printing partners).

{{#if minors}}
MINORS:
A parent or legal guardian must be present for all sessions involving children under 18. By signing this agreement, the Client confirms they have the authority to consent on behalf of any minors being photographed.
{{/if}}


10. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the Photographer and the Client. Any amendments must be made in writing and agreed upon by both parties.


AGREED AND ACCEPTED:


Client: {{client_name}}
Signature: ___________________________
Date: {{today_date}}


Photographer: {{photographer_name}}
Signature: ___________________________
Date: {{today_date}}`;

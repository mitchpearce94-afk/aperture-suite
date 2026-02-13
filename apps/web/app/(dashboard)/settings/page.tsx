'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { cn, formatCurrency } from '@/lib/utils';
import { getCurrentPhotographer } from '@/lib/queries';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  User, Package, Palette, Bell, CreditCard,
  Plus, Trash2, Save, Check, Pencil, Upload, ImageIcon,
} from 'lucide-react';
import type { Photographer } from '@/lib/types';

// ============================================
// Types
// ============================================

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

type SettingsTab = 'profile' | 'packages' | 'branding' | 'notifications' | 'billing';

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Business Profile', icon: User },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

const timezoneOptions = [
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
];

const currencyOptions = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
];

// ============================================
// Component
// ============================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncedJobs, setSyncedJobs] = useState(0);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    business_name: '',
    email: '',
    phone: '',
    timezone: 'Australia/Brisbane',
    currency: 'AUD',
    website: '',
    instagram: '',
    abn: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_zip: '',
  });

  // Packages
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);

  // Branding
  const [brandForm, setBrandForm] = useState({
    primary_color: '#6366f1',
    secondary_color: '#8b5cf6',
    gallery_watermark: true,
    gallery_download: true,
    custom_domain: '',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Notifications
  const [notifForm, setNotifForm] = useState({
    email_new_lead: true,
    email_booking_confirmed: true,
    email_payment_received: true,
    email_gallery_viewed: true,
    email_contract_signed: true,
    auto_followup_days: '3',
    auto_reminder_unpaid: true,
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const p = await getCurrentPhotographer();
    if (p) {
      setPhotographer(p);
      setProfileForm({
        name: p.name || '',
        business_name: p.business_name || '',
        email: p.email || '',
        phone: p.phone || '',
        timezone: p.timezone || 'Australia/Brisbane',
        currency: 'AUD',
        website: '',
        instagram: '',
        abn: '',
        address_street: p.address?.street || '',
        address_city: p.address?.city || '',
        address_state: p.address?.state || '',
        address_zip: p.address?.zip || '',
      });
      if (p.brand_settings) {
        setBrandForm((prev) => ({
          ...prev,
          primary_color: p.brand_settings.primary_color || '#6366f1',
          secondary_color: p.brand_settings.secondary_color || '#8b5cf6',
          custom_domain: p.brand_settings.custom_domain || '',
        }));
      }
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!photographer) return;
    setSaving(true);
    const sb = createSupabaseClient();
    const { error } = await sb
      .from('photographers')
      .update({
        name: profileForm.name,
        business_name: profileForm.business_name,
        phone: profileForm.phone,
        timezone: profileForm.timezone,
        address: {
          street: profileForm.address_street,
          city: profileForm.address_city,
          state: profileForm.address_state,
          zip: profileForm.address_zip,
        },
      })
      .eq('id', photographer.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function savePackages(updated: PackageItem[]) {
    setPackages(updated);
    if (photographer) {
      localStorage.setItem(`packages_${photographer.id}`, JSON.stringify(updated));
    }
  }

  function addPackage() {
    const newPkg: PackageItem = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      price: 0,
      duration_hours: 1,
      included_images: 50,
      deliverables: '',
      is_active: true,
      require_deposit: false,
      deposit_percent: 25,
    };
    setEditingPackage(newPkg);
  }

  async function saveEditingPackage() {
    if (!editingPackage) return;
    const exists = packages.find((p) => p.id === editingPackage.id);

    // Check if duration changed on an existing package
    const oldPkg = exists ? packages.find((p) => p.id === editingPackage.id) : null;
    const durationChanged = oldPkg && oldPkg.duration_hours !== editingPackage.duration_hours;

    const updated = exists
      ? packages.map((p) => p.id === editingPackage.id ? editingPackage : p)
      : [...packages, editingPackage];
    savePackages(updated);
    setEditingPackage(null);

    // If duration changed, update end_time on matching jobs
    if (durationChanged && photographer) {
      const sb = createSupabaseClient();
      const { data: matchingJobs } = await sb
        .from('jobs')
        .select('id, time, end_time')
        .eq('photographer_id', photographer.id)
        .eq('package_name', editingPackage.name)
        .not('time', 'is', null);

      if (matchingJobs && matchingJobs.length > 0) {
        const duration = editingPackage.duration_hours;
        for (const job of matchingJobs) {
          if (job.time) {
            const [h, m] = job.time.split(':').map(Number);
            const totalMin = h * 60 + m + duration * 60;
            const endH = Math.floor(totalMin / 60) % 24;
            const endM = totalMin % 60;
            const newEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
            await sb.from('jobs').update({ end_time: newEndTime }).eq('id', job.id);
          }
        }
        setSyncedJobs(matchingJobs.length);
        setTimeout(() => setSyncedJobs(0), 3000);
      }
    }
  }

  function deletePackage(id: string) {
    savePackages(packages.filter((p) => p.id !== id));
  }

  // Load packages from localStorage on mount
  useEffect(() => {
    if (photographer) {
      const savedPkgs = localStorage.getItem(`packages_${photographer.id}`);
      if (savedPkgs) {
        try { setPackages(JSON.parse(savedPkgs)); } catch {}
      }
    }
  }, [photographer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your business profile and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                activeTab === tab.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {/* ==================== PROFILE ==================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <Section title="Business Details" description="Your business name and contact information.">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Your Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  <Input label="Business Name" value={profileForm.business_name} onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Email" value={profileForm.email} disabled className="opacity-50" />
                  <Input label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="0412 345 678" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Website" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://yoursite.com" />
                  <Input label="Instagram" value={profileForm.instagram} onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })} placeholder="@yourbusiness" />
                </div>
                <Input label="ABN" value={profileForm.abn} onChange={(e) => setProfileForm({ ...profileForm, abn: e.target.value })} placeholder="12 345 678 901" />
              </Section>

              <Section title="Address" description="Used on invoices and contracts.">
                <Input label="Street" value={profileForm.address_street} onChange={(e) => setProfileForm({ ...profileForm, address_street: e.target.value })} />
                <div className="grid grid-cols-3 gap-4">
                  <Input label="City" value={profileForm.address_city} onChange={(e) => setProfileForm({ ...profileForm, address_city: e.target.value })} />
                  <Input label="State" value={profileForm.address_state} onChange={(e) => setProfileForm({ ...profileForm, address_state: e.target.value })} />
                  <Input label="Postcode" value={profileForm.address_zip} onChange={(e) => setProfileForm({ ...profileForm, address_zip: e.target.value })} />
                </div>
              </Section>

              <Section title="Preferences" description="Regional and display settings.">
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Timezone" options={timezoneOptions} value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} />
                  <Select label="Currency" options={currencyOptions} value={profileForm.currency} onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })} />
                </div>
              </Section>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={saveProfile} disabled={saving}>
                  {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Changes</>}
                </Button>
              </div>
            </div>
          )}

          {/* ==================== PACKAGES ==================== */}
          {activeTab === 'packages' && (
            <div className="space-y-6">
              <Section title="Photography Packages" description="Define your packages so they auto-fill when creating jobs and quotes.">
                {packages.length === 0 && !editingPackage ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
                    <Package className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 mb-4">No packages yet. Add your first package to speed up quoting.</p>
                    <Button size="sm" onClick={addPackage}><Plus className="w-3.5 h-3.5" />Add Package</Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {packages.map((pkg) => (
                        <div key={pkg.id} className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-[#0a0a12] group">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-white">{pkg.name || 'Untitled'}</h3>
                              <span className="text-sm font-semibold text-emerald-400">{formatCurrency(pkg.price)}</span>
                              {!pkg.is_active && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-600">Inactive</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {pkg.duration_hours}hr{pkg.duration_hours !== 1 ? 's' : ''}
                              {pkg.included_images > 0 && ` · ${pkg.included_images} images`}
                              {pkg.deliverables && ` · ${pkg.deliverables}`}
                              {pkg.require_deposit && ` · ${pkg.deposit_percent}% deposit`}
                            </p>
                            {pkg.description && <p className="text-xs text-slate-600 mt-1">{pkg.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" onClick={() => setEditingPackage({ ...pkg })}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deletePackage(pkg.id)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {!editingPackage && (
                      <Button size="sm" variant="secondary" onClick={addPackage}>
                        <Plus className="w-3.5 h-3.5" />Add Package
                      </Button>
                    )}
                  </>
                )}
              </Section>

              {/* Package editor */}
              {editingPackage && (
                <Section title={packages.find((p) => p.id === editingPackage.id) ? 'Edit Package' : 'New Package'}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Package Name" value={editingPackage.name} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} placeholder="Full Day Wedding" />
                      <Input label="Price ($)" type="number" step="0.01" value={editingPackage.price || ''} onChange={(e) => setEditingPackage({ ...editingPackage, price: parseFloat(e.target.value) || 0 })} placeholder="3500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Duration (hours)" type="number" step="0.5" value={editingPackage.duration_hours || ''} onChange={(e) => setEditingPackage({ ...editingPackage, duration_hours: parseFloat(e.target.value) || 0 })} placeholder="8" />
                      <Input label="Included Images" type="number" value={editingPackage.included_images || ''} onChange={(e) => setEditingPackage({ ...editingPackage, included_images: parseInt(e.target.value) || 0 })} placeholder="50" />
                    </div>
                    <Input label="Other Deliverables" value={editingPackage.deliverables} onChange={(e) => setEditingPackage({ ...editingPackage, deliverables: e.target.value })} placeholder="e.g. USB drive, print credits, engagement shoot" />
                    <Textarea label="Description" value={editingPackage.description} onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })} placeholder="What's included in this package..." />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editingPackage.is_active} onChange={(e) => setEditingPackage({ ...editingPackage, is_active: e.target.checked })} className="rounded border-white/[0.08] bg-white/[0.04] text-indigo-500 focus:ring-indigo-500/20" />
                      <span className="text-sm text-slate-400">Active (show in quotes)</span>
                    </label>
                    <div className="rounded-lg border border-white/[0.06] p-3 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editingPackage.require_deposit} onChange={(e) => setEditingPackage({ ...editingPackage, require_deposit: e.target.checked })} className="rounded border-white/[0.08] bg-white/[0.04] text-indigo-500 focus:ring-indigo-500/20" />
                        <span className="text-sm text-slate-400">Require deposit to secure booking</span>
                      </label>
                      {editingPackage.require_deposit && (
                        <div className="flex items-center gap-2 ml-6">
                          <Input type="number" value={editingPackage.deposit_percent} onChange={(e) => setEditingPackage({ ...editingPackage, deposit_percent: parseInt(e.target.value) || 0 })} className="w-20 text-center" />
                          <span className="text-sm text-slate-500">% deposit</span>
                          {editingPackage.price > 0 && (
                            <span className="text-xs text-slate-600 ml-2">
                              ({formatCurrency(Math.round(editingPackage.price * (editingPackage.deposit_percent / 100) * 100) / 100)} of {formatCurrency(editingPackage.price)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" onClick={saveEditingPackage}><Save className="w-3.5 h-3.5" />Save Package</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingPackage(null)}>Cancel</Button>
                    </div>
                  </div>
                </Section>
              )}

              {syncedJobs > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Updated end times on {syncedJobs} existing job{syncedJobs !== 1 ? 's' : ''}</span>
                </div>
              )}}
            </div>
          )}

          {/* ==================== BRANDING ==================== */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <Section title="Logo" description="Your business logo. Used on galleries, invoices, contracts, and emails.">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-xl border border-white/[0.06] bg-[#0a0a12] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                    )}
                  </div>
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-500">PNG or SVG, recommended 500×500px or larger. Transparent background works best.</p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/svg+xml,image/jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] font-medium transition-colors cursor-pointer">
                          <Upload className="w-3 h-3" />Upload Logo
                        </span>
                      </label>
                      {logoPreview && (
                        <Button size="sm" variant="ghost" onClick={() => setLogoPreview(null)} className="text-red-400 hover:text-red-300">
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Brand Colours" description="Used on client-facing galleries, invoices, and emails.">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Primary Colour</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={brandForm.primary_color} onChange={(e) => setBrandForm({ ...brandForm, primary_color: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer" />
                      <Input value={brandForm.primary_color} onChange={(e) => setBrandForm({ ...brandForm, primary_color: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Secondary Colour</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={brandForm.secondary_color} onChange={(e) => setBrandForm({ ...brandForm, secondary_color: e.target.value })} className="w-10 h-10 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer" />
                      <Input value={brandForm.secondary_color} onChange={(e) => setBrandForm({ ...brandForm, secondary_color: e.target.value })} className="flex-1" />
                    </div>
                  </div>
                </div>
                {/* Preview with contrast-aware text */}
                <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-[#0a0a12]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-3">Preview</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 px-4 rounded-lg flex items-center text-xs font-medium"
                      style={{ backgroundColor: brandForm.primary_color, color: getContrastColor(brandForm.primary_color) }}
                    >
                      Book Now
                    </div>
                    <div
                      className="h-8 px-4 rounded-lg flex items-center text-xs font-medium"
                      style={{ backgroundColor: brandForm.secondary_color, color: getContrastColor(brandForm.secondary_color) }}
                    >
                      View Gallery
                    </div>
                  </div>
                  {/* Gallery header preview */}
                  <div className="mt-4 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      {logoPreview && <img src={logoPreview} alt="" className="w-6 h-6 object-contain" />}
                      <span className="text-xs font-semibold text-white">{profileForm.business_name || 'Your Business'}</span>
                    </div>
                    <div className="h-1 w-16 rounded-full" style={{ backgroundColor: brandForm.primary_color }} />
                  </div>
                </div>
              </Section>

              <Section title="Gallery Settings" description="Defaults for new client galleries.">
                <ToggleRow label="Show watermark on preview images" checked={brandForm.gallery_watermark} onChange={(v) => setBrandForm({ ...brandForm, gallery_watermark: v })} />
                <ToggleRow label="Allow clients to download images" checked={brandForm.gallery_download} onChange={(v) => setBrandForm({ ...brandForm, gallery_download: v })} />
              </Section>

              <Section title="Custom Domain" description="Use your own domain for client galleries (e.g. gallery.yourbusiness.com). Requires Pro plan.">
                <Input value={brandForm.custom_domain} onChange={(e) => setBrandForm({ ...brandForm, custom_domain: e.target.value })} placeholder="gallery.yourbusiness.com" disabled />
                <p className="text-xs text-slate-600">Coming soon — available on Pro plan</p>
              </Section>

              <Button onClick={() => { /* TODO: save to Supabase */ setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
                {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : <><Save className="w-3.5 h-3.5" />Save Branding</>}
              </Button>
            </div>
          )}

          {/* ==================== NOTIFICATIONS ==================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <Section title="Email Notifications" description="Choose what you get notified about.">
                <ToggleRow label="New lead received" checked={notifForm.email_new_lead} onChange={(v) => setNotifForm({ ...notifForm, email_new_lead: v })} />
                <ToggleRow label="Booking confirmed" checked={notifForm.email_booking_confirmed} onChange={(v) => setNotifForm({ ...notifForm, email_booking_confirmed: v })} />
                <ToggleRow label="Payment received" checked={notifForm.email_payment_received} onChange={(v) => setNotifForm({ ...notifForm, email_payment_received: v })} />
                <ToggleRow label="Gallery viewed by client" checked={notifForm.email_gallery_viewed} onChange={(v) => setNotifForm({ ...notifForm, email_gallery_viewed: v })} />
                <ToggleRow label="Contract signed" checked={notifForm.email_contract_signed} onChange={(v) => setNotifForm({ ...notifForm, email_contract_signed: v })} />
              </Section>

              <Section title="Automation" description="Automatic follow-ups and reminders.">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">Auto follow-up on new leads after</span>
                  <Input type="number" value={notifForm.auto_followup_days} onChange={(e) => setNotifForm({ ...notifForm, auto_followup_days: e.target.value })} className="w-16 text-center" />
                  <span className="text-sm text-slate-400">days</span>
                </div>
                <ToggleRow label="Send payment reminders for overdue invoices" checked={notifForm.auto_reminder_unpaid} onChange={(v) => setNotifForm({ ...notifForm, auto_reminder_unpaid: v })} />
              </Section>

              <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
                {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : <><Save className="w-3.5 h-3.5" />Save Notifications</>}
              </Button>
            </div>
          )}

          {/* ==================== BILLING ==================== */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Section title="Current Plan" description="Manage your Aperture Suite subscription.">
                <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Free Trial</h3>
                      <p className="text-xs text-slate-500">14 days remaining</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Trial</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Includes all features. No credit card required.</p>
                  <Button size="sm">Upgrade Plan</Button>
                </div>
              </Section>

              <Section title="Payment Method" description="Used for your subscription.">
                <div className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center">
                  <CreditCard className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-3">No payment method on file</p>
                  <Button size="sm" variant="secondary" disabled>Add Payment Method</Button>
                </div>
              </Section>

              <Section title="Stripe Connect" description="Connect your Stripe account to accept payments from clients.">
                <div className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center">
                  <p className="text-sm text-slate-500 mb-3">Connect Stripe to send invoices and accept online payments</p>
                  <Button size="sm" variant="secondary" disabled>Connect Stripe</Button>
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ============================================
// Helper Components
// ============================================

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-indigo-500' : 'bg-white/[0.08]'
        )}
      >
        <div className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
          checked ? 'left-[18px]' : 'left-0.5'
        )} />
      </button>
    </label>
  );
}

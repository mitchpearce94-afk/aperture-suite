'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { cn, formatCurrency } from '@/lib/utils';
import { getCurrentPhotographer, getStyleProfiles, createStyleProfile, deleteStyleProfile, getPackages, createPackage as createPackageDB, updatePackage as updatePackageDB, deletePackage as deletePackageDB } from '@/lib/queries';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  User, Package, Palette, Bell, CreditCard, FileSignature,
  Plus, Trash2, Save, Check, Pencil, Upload, ImageIcon,
  Wand2, Sparkles, Camera, X, Loader2,
} from 'lucide-react';
import type { Photographer } from '@/lib/types';
import { DEFAULT_CONTRACT } from '@/lib/default-contract';
import { SignaturePad } from '@/components/ui/signature-pad';
import BillingSection from '@/components/dashboard/billing-section';

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

type SettingsTab = 'profile' | 'packages' | 'contract' | 'gallery_settings' | 'editing_style' | 'notifications' | 'billing';

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Business Profile', icon: User },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'contract', label: 'Contract Template', icon: FileSignature },
  { id: 'gallery_settings', label: 'Gallery Settings', icon: Palette },
  { id: 'editing_style', label: 'Editing Style', icon: Wand2 },
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

  // Read ?tab= from URL (e.g. after Stripe checkout redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as SettingsTab | null;
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, []);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  // Gallery Settings (was Branding)
  const [galleryForm, setGalleryForm] = useState({
    gallery_watermark: true,
    gallery_download: true,
    gallery_default_expiry_days: 30,
    gallery_default_access_type: 'password',
    gallery_default_download_full_res: true,
    gallery_default_download_web: true,
    custom_domain: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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

  // Contract template
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractEditing, setContractEditing] = useState(false);
  const [contractSaving, setContractSaving] = useState(false);
  const [contractSaved, setContractSaved] = useState(false);

  // Photographer signature
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);

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
        currency: (p as any).currency || 'AUD',
        website: (p as any).website || '',
        instagram: (p as any).instagram || '',
        abn: (p as any).abn || '',
        address_street: p.address?.street || '',
        address_city: p.address?.city || '',
        address_state: p.address?.state || '',
        address_zip: p.address?.zip || '',
      });
      // Load logo — generate signed URL from stored key
      const logoKey = (p.brand_settings as any)?.logo_key;
      if (logoKey) {
        try {
          const sb = createSupabaseClient();
          const { data: signedData, error: signErr } = await sb.storage.from('photos').createSignedUrl(logoKey, 3600);
          if (signErr) console.error('Logo signed URL error on load:', signErr);
          if (signedData?.signedUrl) setLogoPreview(signedData.signedUrl);
        } catch (e) {
          console.error('Logo load error:', e);
        }
      }
      // Load gallery default settings
      setGalleryForm((prev) => ({
        ...prev,
        gallery_default_expiry_days: (p as any).gallery_default_expiry_days ?? 30,
        gallery_default_access_type: (p as any).gallery_default_access_type || 'password',
        gallery_default_download_full_res: (p as any).gallery_default_download_full_res ?? true,
        gallery_default_download_web: (p as any).gallery_default_download_web ?? true,
        gallery_watermark: (p as any).gallery_default_watermark ?? true,
        custom_domain: p.brand_settings?.custom_domain || '',
      }));
      // Load notification settings
      const ns = (p as any).notification_settings;
      if (ns) {
        setNotifForm({
          email_new_lead: ns.email_new_lead ?? true,
          email_booking_confirmed: ns.email_booking_confirmed ?? true,
          email_payment_received: ns.email_payment_received ?? true,
          email_gallery_viewed: ns.email_gallery_viewed ?? true,
          email_contract_signed: ns.email_contract_signed ?? true,
          auto_followup_days: String(ns.auto_followup_days ?? 3),
          auto_reminder_unpaid: ns.auto_reminder_unpaid ?? true,
        });
      }
      // Load contract template
      setContractTemplate(p.contract_template || DEFAULT_CONTRACT);
      // Load signature
      setSignatureImage(p.signature_image || null);
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!photographer) return;
    setSaving(true);
    setSaveError(null);
    const sb = createSupabaseClient();

    // Step 1: Upload logo if a new file was selected
    let logoKey = (photographer.brand_settings as any)?.logo_key || null;
    if (logoFile) {
      setLogoUploading(true);
      const ext = logoFile.name.split('.').pop()?.toLowerCase() || 'png';
      const newKey = `${photographer.id}/branding/logo_${Date.now()}.${ext}`;
      
      // Use the /api/upload route (same as style pair uploads)
      const formData = new FormData();
      formData.append('file', logoFile);
      formData.append('storageKey', newKey);
      
      try {
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadResult = await uploadRes.json();
        
        if (!uploadRes.ok || uploadResult.error) {
          console.error('Logo upload failed:', uploadResult);
          setSaveError(`Logo upload failed: ${uploadResult.error || 'Unknown error'}`);
        } else {
          // Delete old logo if it exists (non-blocking, don't fail save)
          if (logoKey) {
            try { await sb.storage.from('photos').remove([logoKey]); } catch {}
          }
          logoKey = uploadResult.storageKey || newKey;
        }
      } catch (err: any) {
        console.error('Logo upload error:', err);
        setSaveError(`Logo upload failed: ${err?.message || err}`);
      }
      setLogoUploading(false);
      setLogoFile(null);
    }

    // If logo was removed, delete from storage (non-blocking) and clear key
    if (!logoPreview && !logoFile) {
      if (logoKey) {
        try { await sb.storage.from('photos').remove([logoKey]); } catch {}
      }
      logoKey = null;
    }

    // Step 2: Build brand_settings — use null instead of undefined for JSON
    const updatedBrandSettings: Record<string, any> = {
      ...(photographer.brand_settings || {}),
    };
    if (logoKey) {
      updatedBrandSettings.logo_key = logoKey;
    } else {
      delete updatedBrandSettings.logo_key;
      delete updatedBrandSettings.logo_url;
    }

    // Step 3: Save core profile fields (ones that definitely exist as DB columns)
    const updatePayload: Record<string, any> = {
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
      brand_settings: updatedBrandSettings,
    };

    // Add optional columns — these may not exist if migration hasn't been run
    // Supabase will ignore unknown columns gracefully
    updatePayload.currency = profileForm.currency;
    updatePayload.website = profileForm.website;
    updatePayload.instagram = profileForm.instagram;
    updatePayload.abn = profileForm.abn;

    const { error } = await sb
      .from('photographers')
      .update(updatePayload)
      .eq('id', photographer.id);

    if (error) {
      console.error('Profile save error:', error);
      // If the error is about unknown columns, retry without them
      if (error.message?.includes('column') || error.code === '42703') {
        const { error: retryErr } = await sb
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
            brand_settings: updatedBrandSettings,
          })
          .eq('id', photographer.id);
        if (retryErr) {
          setSaveError(`Save failed: ${retryErr.message}`);
        } else {
          setSaveError('Saved (some fields need migration — run the SQL migration for website, instagram, abn, currency)');
        }
      } else {
        setSaveError(`Save failed: ${error.message}`);
      }
    }

    setSaving(false);

    // Step 4: Refresh logo preview & update local state
    if (!error || error?.code === '42703') {
      if (logoKey) {
        try {
          const { data: signedData, error: signErr } = await sb.storage.from('photos').createSignedUrl(logoKey, 3600);
          if (signErr) console.error('Signed URL error:', signErr);
          if (signedData?.signedUrl) setLogoPreview(signedData.signedUrl);
        } catch (e) {
          console.error('Signed URL error:', e);
        }
      }
      setPhotographer((prev) => prev ? { ...prev, brand_settings: updatedBrandSettings as any } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function addPackage() {
    const newPkg: PackageItem = {
      id: '', // Will be assigned by Supabase
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
    setSaving(true);

    const exists = editingPackage.id && packages.find((p) => p.id === editingPackage.id);

    // Check if duration changed on an existing package
    const oldPkg = exists ? packages.find((p) => p.id === editingPackage.id) : null;
    const durationChanged = oldPkg && oldPkg.duration_hours !== editingPackage.duration_hours;

    if (exists) {
      // Update existing package in Supabase
      const updated = await updatePackageDB(editingPackage.id, {
        name: editingPackage.name,
        description: editingPackage.description,
        price: editingPackage.price,
        duration_hours: editingPackage.duration_hours,
        included_images: editingPackage.included_images,
        deliverables: editingPackage.deliverables,
        is_active: editingPackage.is_active,
        require_deposit: editingPackage.require_deposit,
        deposit_percent: editingPackage.deposit_percent,
      } as any);
      if (updated) {
        setPackages((prev) => prev.map((p) => p.id === updated.id ? { ...editingPackage, id: updated.id } : p));
      }
    } else {
      // Create new package in Supabase
      const created = await createPackageDB({
        name: editingPackage.name,
        description: editingPackage.description,
        price: editingPackage.price,
        duration_hours: editingPackage.duration_hours,
        included_images: editingPackage.included_images,
        deliverables: editingPackage.deliverables,
        is_active: editingPackage.is_active,
        require_deposit: editingPackage.require_deposit,
        deposit_percent: editingPackage.deposit_percent,
      });
      if (created) {
        setPackages((prev) => [...prev, { ...editingPackage, id: created.id }]);
      }
    }

    setEditingPackage(null);
    setSaving(false);

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

  async function handleDeletePackage(id: string) {
    const success = await deletePackageDB(id);
    if (success) {
      setPackages((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // Load packages from Supabase on mount
  useEffect(() => {
    if (photographer) {
      getPackages().then((pkgs) => {
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
      });
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
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your business profile and preferences</p>
      </div>

      {/* Mobile tab bar */}
      <div className="flex overflow-x-auto gap-1 pb-1 -mx-4 px-4 lg:hidden no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
              activeTab === tab.id
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav — desktop only */}
        <div className="w-52 flex-shrink-0 space-y-1 hidden lg:block">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Input label="Your Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  <Input label="Business Name" value={profileForm.business_name} onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Input label="Email" value={profileForm.email} disabled className="opacity-50" />
                  <Input label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="0412 345 678" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Input label="Website" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://yoursite.com" />
                  <Input label="Instagram" value={profileForm.instagram} onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })} placeholder="@yourbusiness" />
                </div>
                <Input label="ABN" value={profileForm.abn} onChange={(e) => setProfileForm({ ...profileForm, abn: e.target.value })} placeholder="12 345 678 901" />
              </Section>

              <Section title="Address" description="Used on invoices and contracts.">
                <Input label="Street" value={profileForm.address_street} onChange={(e) => setProfileForm({ ...profileForm, address_street: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Input label="City" value={profileForm.address_city} onChange={(e) => setProfileForm({ ...profileForm, address_city: e.target.value })} />
                  <Input label="State" value={profileForm.address_state} onChange={(e) => setProfileForm({ ...profileForm, address_state: e.target.value })} />
                  <Input label="Postcode" value={profileForm.address_zip} onChange={(e) => setProfileForm({ ...profileForm, address_zip: e.target.value })} />
                </div>
              </Section>

              <Section title="Preferences" description="Regional and display settings.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Select label="Timezone" options={timezoneOptions} value={profileForm.timezone} onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })} />
                  <Select label="Currency" options={currencyOptions} value={profileForm.currency} onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })} />
                </div>
              </Section>

              <Section title="Business Logo" description="Used on galleries, invoices, contracts, and emails.">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-xl border border-white/[0.06] bg-[#0a0a12] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                    )}
                  </div>
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-500">PNG or JPEG, recommended 500×500px or larger. Transparent background works best.</p>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setLogoFile(file);
                              const reader = new FileReader();
                              reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] font-medium transition-colors cursor-pointer">
                          <Upload className="w-3 h-3" />{logoPreview ? 'Change Logo' : 'Upload Logo'}
                        </span>
                      </label>
                      {logoPreview && (
                        <Button size="sm" variant="ghost" onClick={() => { setLogoPreview(null); setLogoFile(null); }} className="text-red-400 hover:text-red-300">
                          Remove
                        </Button>
                      )}
                    </div>
                    {logoUploading && <p className="text-[10px] text-amber-400">Uploading...</p>}
                  </div>
                </div>
              </Section>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={saveProfile} disabled={saving || logoUploading}>
                  {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Changes</>}
                </Button>
                {saveError && <p className="text-xs text-red-400">{saveError}</p>}
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
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePackage(pkg.id)} className="text-red-400 hover:text-red-300">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <Input label="Package Name" value={editingPackage.name} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} placeholder="Full Day Wedding" />
                      <Input label="Price ($)" type="number" step="0.01" value={editingPackage.price || ''} onChange={(e) => setEditingPackage({ ...editingPackage, price: parseFloat(e.target.value) || 0 })} placeholder="3500" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
              )}
            </div>
          )}

          {/* ==================== CONTRACT TEMPLATE ==================== */}
          {activeTab === 'contract' && (
            <div className="space-y-6">
              <Section title="Contract Template" description="Your contract auto-fills with client and job details when sent. Conditional sections are included only when relevant.">
                {!contractEditing ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 max-h-[500px] overflow-y-auto">
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{contractTemplate}</pre>
                    </div>
                    <Button size="sm" onClick={() => setContractEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit Template</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={contractTemplate}
                      onChange={(e) => setContractTemplate(e.target.value)}
                      rows={30}
                      className="w-full px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono resize-y leading-relaxed"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-lg border border-white/[0.06] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Merge Tags</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['{{client_name}}', '{{client_email}}', '{{job_date}}', '{{job_time}}', '{{job_location}}', '{{package_name}}', '{{package_amount}}', '{{included_images}}', '{{business_name}}', '{{photographer_name}}', '{{today_date}}'].map((tag) => (
                            <button key={tag} type="button" onClick={() => setContractTemplate((prev) => prev + tag)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-indigo-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer">{tag}</button>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Conditional Blocks</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { tag: '{{#if deposit}}...{{/if}}', desc: 'Deposit required' },
                            { tag: '{{#if no_deposit}}...{{/if}}', desc: 'No deposit' },
                            { tag: '{{#if second_shooter}}...{{/if}}', desc: 'Second shooter' },
                            { tag: '{{#if minors}}...{{/if}}', desc: 'Minors present' },
                          ].map((item) => (
                            <button key={item.tag} type="button" onClick={() => setContractTemplate((prev) => prev + '\n' + item.tag)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-amber-400 border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer">{item.desc}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!photographer) return;
                          setContractSaving(true);
                          const sb = createSupabaseClient();
                          const { error } = await sb
                            .from('photographers')
                            .update({ contract_template: contractTemplate })
                            .eq('id', photographer.id);
                          setContractSaving(false);
                          if (!error) {
                            setContractEditing(false);
                            setContractSaved(true);
                            setTimeout(() => setContractSaved(false), 2000);
                          }
                        }}
                        disabled={contractSaving}
                      >
                        {contractSaved ? <><Check className="w-3.5 h-3.5" />Saved</> : contractSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Template</>}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setContractEditing(false)}>Cancel</Button>
                      <button onClick={() => setContractTemplate(DEFAULT_CONTRACT)} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors ml-auto">Reset to default</button>
                    </div>
                  </div>
                )}
              </Section>

              <div className="rounded-lg border border-white/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">How it works</p>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p>• Merge tags like <span className="text-indigo-400">{'{{client_name}}'}</span> are replaced with real data when the contract is generated.</p>
                  <p>• Conditional blocks like <span className="text-amber-400">{'{{#if deposit}}'}</span> are only included when relevant.</p>
                  <p>• The contract adapts automatically — you write one template, it handles every job type.</p>
                  <p>• Clients receive a link to view and electronically sign the contract.</p>
                </div>
              </div>

              <Section title="Your Signature" description="Your signature appears on every contract you send. Draw it or upload an image of your signature.">
                <SignaturePad
                  onSignatureChange={(dataUrl) => setSignatureImage(dataUrl)}
                  initialSignature={signatureImage}
                  theme="dark"
                  allowUpload={true}
                  label=""
                  height={140}
                />
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!photographer) return;
                      setSignatureSaving(true);
                      const sb = createSupabaseClient();
                      const { error } = await sb
                        .from('photographers')
                        .update({ signature_image: signatureImage })
                        .eq('id', photographer.id);
                      setSignatureSaving(false);
                      if (!error) {
                        setSignatureSaved(true);
                        setTimeout(() => setSignatureSaved(false), 2000);
                      }
                    }}
                    disabled={signatureSaving}
                  >
                    {signatureSaved ? <><Check className="w-3.5 h-3.5" />Saved</> : signatureSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Signature</>}
                  </Button>
                </div>
              </Section>
            </div>
          )}

          {/* ==================== BRANDING ==================== */}
          {activeTab === 'gallery_settings' && (
            <div className="space-y-6">
              <Section title="Gallery Defaults" description="Default settings for new client galleries. Can be overridden per gallery.">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Default Expiry</label>
                    <select value={galleryForm.gallery_default_expiry_days} onChange={(e) => setGalleryForm({ ...galleryForm, gallery_default_expiry_days: Number(e.target.value) })}
                      className="w-full text-xs bg-[#12121e] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500/50"
                      style={{ colorScheme: 'dark' }}>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={21}>21 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={0}>No expiry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Default Access Type</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['public', 'password', 'email'] as const).map((type) => (
                        <button key={type} onClick={() => setGalleryForm({ ...galleryForm, gallery_default_access_type: type })}
                          className={`px-2 py-1.5 text-[11px] rounded-lg border capitalize transition-all ${
                            galleryForm.gallery_default_access_type === type ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300'
                          }`}>{type}</button>
                      ))}
                    </div>
                  </div>
                  <ToggleRow label="Show watermark on preview images" checked={galleryForm.gallery_watermark} onChange={(v) => setGalleryForm({ ...galleryForm, gallery_watermark: v })} />
                  <ToggleRow label="Allow full resolution downloads" checked={galleryForm.gallery_default_download_full_res} onChange={(v) => setGalleryForm({ ...galleryForm, gallery_default_download_full_res: v })} />
                  <ToggleRow label="Allow web-size downloads" checked={galleryForm.gallery_default_download_web} onChange={(v) => setGalleryForm({ ...galleryForm, gallery_default_download_web: v })} />
                </div>
              </Section>

              <Section title="Custom Domain" description="Use your own domain for client galleries (e.g. gallery.yourbusiness.com). Requires Pro plan.">
                <Input value={galleryForm.custom_domain} onChange={(e) => setGalleryForm({ ...galleryForm, custom_domain: e.target.value })} placeholder="gallery.yourbusiness.com" disabled />
                <p className="text-xs text-slate-600">Coming soon — available on Pro plan</p>
              </Section>

              <Button onClick={async () => {
                if (!photographer) return;
                setSaving(true);
                const sb = createSupabaseClient();
                const { error } = await sb
                  .from('photographers')
                  .update({
                    gallery_default_expiry_days: galleryForm.gallery_default_expiry_days,
                    gallery_default_access_type: galleryForm.gallery_default_access_type,
                    gallery_default_download_full_res: galleryForm.gallery_default_download_full_res,
                    gallery_default_download_web: galleryForm.gallery_default_download_web,
                    gallery_default_watermark: galleryForm.gallery_watermark,
                    brand_settings: {
                      ...(photographer.brand_settings || {}),
                      custom_domain: galleryForm.custom_domain || undefined,
                    },
                  })
                  .eq('id', photographer.id);
                setSaving(false);
                if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
              }} disabled={saving}>
                {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Gallery Settings</>}
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

              <Button onClick={async () => {
                if (!photographer) return;
                setSaving(true);
                const sb = createSupabaseClient();
                const { error } = await sb
                  .from('photographers')
                  .update({
                    notification_settings: {
                      email_new_lead: notifForm.email_new_lead,
                      email_booking_confirmed: notifForm.email_booking_confirmed,
                      email_payment_received: notifForm.email_payment_received,
                      email_gallery_viewed: notifForm.email_gallery_viewed,
                      email_contract_signed: notifForm.email_contract_signed,
                      auto_followup_days: Number(notifForm.auto_followup_days) || 3,
                      auto_reminder_unpaid: notifForm.auto_reminder_unpaid,
                    },
                  })
                  .eq('id', photographer.id);
                setSaving(false);
                if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
              }} disabled={saving}>
                {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : saving ? 'Saving...' : <><Save className="w-3.5 h-3.5" />Save Notifications</>}
              </Button>
            </div>
          )}

          {/* ==================== BILLING ==================== */}
          {activeTab === 'editing_style' && (
            <EditingStyleSection photographerId={photographer?.id} />
          )}

          {activeTab === 'billing' && photographer && (
            <BillingSection photographerId={photographer.id} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Image Resize Utility (client-side)
// ============================================

function resizeImage(file: File, maxDimension: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Only resize if larger than max dimension
      if (Math.max(width, height) > maxDimension) {
        if (width >= height) {
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

// ============================================
// Trainee Comments (rolling AI comments during style training)
// ============================================

const TRAINEE_COMMENTS = [
  "Oh yeah, I love that colour grading 👌",
  "Omg that is so cute",
  "Ooh, the way you handle shadows... *chef's kiss*",
  "OK I see you with those warm tones",
  "This skin tone work is immaculate",
  "Wait, how did you get that glow?? Noted.",
  "Golden hour AND consistent whites? You're a wizard",
  "The contrast here is *perfect*",
  "I'm obsessed with your highlight rolloff",
  "Taking notes... lots of notes 📝",
  "Your colour palette is so cohesive, I'm impressed",
  "Oooh moody but not muddy — I see what you did there",
  "The way you lifted those shadows without losing depth 🤌",
  "This is giving main character energy",
  "OK this white balance consistency is elite",
  "I can already feel my neurons rewiring",
  "Warm, clean, dreamy — got it, got it",
  "You really said 'let there be light' and meant it",
  "These tones are *butter*",
  "Learning so much rn, don't mind me",
  "Your editing style has range and I'm here for it",
  "Saving this one as a personal favourite... for research",
  "The vibes are immaculate, just saying",
  "Rich blacks but airy highlights — love the balance",
  "This deserves to be on a magazine cover tbh",
  "OK teacher, I think I'm getting the hang of this",
  "Yep, this is going in the mood board 📌",
  "You make it look effortless but I know it's not",
  "Studying your colour science like it's a final exam",
  "Almost there... just soaking in a few more ✨",
];

function TraineeComments() {
  const [currentComment, setCurrentComment] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    function showNext() {
      setIsVisible(false);

      setTimeout(() => {
        setUsedIndices((prev) => {
          let available = Array.from({ length: TRAINEE_COMMENTS.length }, (_, i) => i).filter((i) => !prev.has(i));
          if (available.length === 0) {
            available = Array.from({ length: TRAINEE_COMMENTS.length }, (_, i) => i);
            prev = new Set();
          }
          const idx = available[Math.floor(Math.random() * available.length)];
          const next = new Set(prev);
          next.add(idx);
          setCurrentComment(TRAINEE_COMMENTS[idx]);
          return next;
        });
        setIsVisible(true);
      }, 400);
    }

    // Show first comment quickly
    const initialTimeout = setTimeout(showNext, 800);

    // Rotate every 3-5 seconds
    const interval = setInterval(showNext, 3000 + Math.random() * 2000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mt-3 pt-3 border-t border-amber-500/10">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
        <div
          className={`px-3 py-1.5 rounded-xl rounded-tl-sm bg-amber-500/10 border border-amber-500/15 transition-all duration-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
        >
          <p className="text-xs text-amber-300/90 italic">{currentComment}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Editing Style Section — Multi-Style RAW + Edited Pair Training
// ============================================

const PAIR_MIN = 10;
const PAIR_RECOMMENDED = 25;
const PAIR_IDEAL = 50;
const PAIR_MAX = 100;

const RAW_EXTENSIONS = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.x3f', '.3fr', '.mef', '.mrw', '.nrw', '.rwl', '.iiq', '.erf', '.kdc', '.dcr'];
const EDITED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif'];

interface PairFile {
  id: string;
  file: File;
  baseName: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  preview?: string;
}

interface MatchedPair {
  baseName: string;
  raw: PairFile;
  edited: PairFile;
}

function getBaseName(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length > 1) parts.pop();
  return parts.join('.').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function isRawFile(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return RAW_EXTENSIONS.includes(ext);
}

function isEditedFile(fileName: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return EDITED_EXTENSIONS.includes(ext);
}

interface StyleProfileSummary {
  id: string;
  name: string;
  status: string;
  pairCount: number;
  trainingDate: string | null;
}

function EditingStyleSection({ photographerId }: { photographerId?: string }) {
  const [profiles, setProfiles] = useState<StyleProfileSummary[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await getStyleProfiles();
      setProfiles(data.map((p) => {
        const settings = p.settings as Record<string, unknown> | null;
        const rawKeys = (settings?.raw_image_keys as string[]) || [];
        const editedKeys = p.reference_image_keys || [];
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          pairCount: Math.min(rawKeys.length, editedKeys.length),
          trainingDate: p.training_completed_at || p.training_started_at || null,
        };
      }));
    } catch (err) {
      console.error('Error loading profiles:', err);
    }
    setLoadingProfiles(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const success = await deleteStyleProfile(id);
    if (success) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    }
    setDeletingId(null);
  };

  if (loadingProfiles) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section
        title="Editing Styles"
        description="Train multiple styles so you can apply different looks to different photos — your main style, black & white, film, etc."
      >
        {/* How it works (only show if no styles yet) */}
        {profiles.length === 0 && !creatingNew && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 mb-1">Teach the AI your editing styles</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload RAW + edited pairs for each style you use. Create your main editing style,
                  then add additional styles like Black &amp; White, Film, Moody, etc.
                  When reviewing photos, you can apply any trained style to individual images.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Existing styles list */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.id} className={`rounded-xl border p-4 transition-all ${
                profile.status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/5'
                  : profile.status === 'training' ? 'border-amber-500/20 bg-amber-500/5'
                  : profile.status === 'error' ? 'border-red-500/20 bg-red-500/5'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      profile.status === 'ready' ? 'bg-emerald-500/20'
                        : profile.status === 'training' ? 'bg-amber-500/20'
                        : 'bg-white/[0.06]'
                    }`}>
                      {profile.status === 'ready' ? <Check className="w-4 h-4 text-emerald-400" />
                        : profile.status === 'training' ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        : <Wand2 className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{profile.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {profile.pairCount} pair{profile.pairCount !== 1 ? 's' : ''}
                        {profile.status === 'ready' && ' · Trained'}
                        {profile.status === 'training' && ' · Training...'}
                        {profile.status === 'error' && ' · Failed'}
                        {profile.trainingDate && ` · ${new Date(profile.trainingDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {profile.status === 'ready' && (
                      <button
                        onClick={async () => {
                          setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, status: 'training' } : p));
                          try {
                            await fetch('/api/style', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'retrain', profile_id: profile.id }),
                            });
                          } catch {}
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white transition-all"
                      >
                        Retrain
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(profile.id)}
                      disabled={deletingId === profile.id}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingId === profile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {(profile.status === 'training' || profile.status === 'pending') && (
                  <TraineeComments />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new style button */}
        {!creatingNew && (
          <Button size="sm" variant="secondary" onClick={() => setCreatingNew(true)}>
            <Plus className="w-3.5 h-3.5" />Add Style
          </Button>
        )}

        {/* New style form */}
        {creatingNew && (
          <NewStyleForm
            photographerId={photographerId}
            onComplete={() => { setCreatingNew(false); loadProfiles(); }}
            onCancel={() => setCreatingNew(false)}
          />
        )}
      </Section>
    </div>
  );
}

// ============================================
// New Style Form — RAW + Edited Pair Upload
// ============================================

function NewStyleForm({ photographerId, onComplete, onCancel }: {
  photographerId?: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [styleName, setStyleName] = useState('');
  const [rawFiles, setRawFiles] = useState<PairFile[]>([]);
  const [editedFiles, setEditedFiles] = useState<PairFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [rawDragOver, setRawDragOver] = useState(false);
  const [editedDragOver, setEditedDragOver] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'uploading' | 'starting' | null>(null);
  const rawInputRef = useRef<HTMLInputElement>(null);
  const editedInputRef = useRef<HTMLInputElement>(null);

  // Warn user if they try to leave during upload
  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploading]);

  const matchedPairs: MatchedPair[] = (() => {
    const pairs: MatchedPair[] = [];
    for (const raw of rawFiles) {
      const match = editedFiles.find((e) => e.baseName === raw.baseName);
      if (match) pairs.push({ baseName: raw.baseName, raw, edited: match });
    }
    return pairs;
  })();

  const unmatchedRaw = rawFiles.filter((r) => !editedFiles.some((e) => e.baseName === r.baseName));
  const unmatchedEdited = editedFiles.filter((e) => !rawFiles.some((r) => r.baseName === e.baseName));
  const newPairCount = matchedPairs.length;

  const addRawFiles = useCallback((fileList: FileList | File[]) => {
    const remaining = PAIR_MAX - rawFiles.length;
    const toAdd = Array.from(fileList).slice(0, Math.max(0, remaining));
    const mapped: PairFile[] = toAdd
      .filter((f) => isRawFile(f.name))
      .map((file) => ({
        id: `raw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        baseName: getBaseName(file.name),
        status: 'pending' as const,
      }));
    setRawFiles((prev) => [...prev, ...mapped]);
  }, [rawFiles.length]);

  const addEditedFiles = useCallback((fileList: FileList | File[]) => {
    const remaining = PAIR_MAX - editedFiles.length;
    const toAdd = Array.from(fileList).slice(0, Math.max(0, remaining));
    const mapped: PairFile[] = toAdd
      .filter((f) => isEditedFile(f.name))
      .map((file) => {
        const sf: PairFile = {
          id: `edit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          baseName: getBaseName(file.name),
          status: 'pending' as const,
        };
        const img = new window.Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          canvas.width = 80; canvas.height = 80;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 80, 80);
          setEditedFiles((prev) => prev.map((p) => p.id === sf.id ? { ...p, preview: canvas.toDataURL('image/jpeg', 0.5) } : p));
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
        return sf;
      });
    setEditedFiles((prev) => [...prev, ...mapped]);
  }, [editedFiles.length]);

  const handleUpload = async () => {
    if (matchedPairs.length < PAIR_MIN || !styleName.trim()) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');

    try {
      const photographer = await getCurrentPhotographer();
      if (!photographer) { setUploading(false); return; }

      const newRawKeys: string[] = [];
      const newEditedKeys: string[] = [];
      const totalUploads = matchedPairs.length * 2;
      let completedUploads = 0;

      for (const pair of matchedPairs) {
        // Upload RAW
        setRawFiles((prev) => prev.map((p) => p.id === pair.raw.id ? { ...p, status: 'uploading' } : p));
        try {
          const safeName = pair.raw.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const rawKey = `${photographer.id}/styles/${styleName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}/raw/${Date.now()}_${safeName}`;
          const formData = new FormData();
          formData.append('file', pair.raw.file);
          formData.append('storageKey', rawKey);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Upload failed');
          newRawKeys.push(result.storageKey);
          setRawFiles((prev) => prev.map((p) => p.id === pair.raw.id ? { ...p, status: 'complete' } : p));
        } catch {
          setRawFiles((prev) => prev.map((p) => p.id === pair.raw.id ? { ...p, status: 'error' } : p));
        }
        completedUploads++;
        setUploadProgress(Math.round((completedUploads / totalUploads) * 100));

        // Upload edited (resized)
        setEditedFiles((prev) => prev.map((p) => p.id === pair.edited.id ? { ...p, status: 'uploading' } : p));
        try {
          const safeName = pair.edited.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const editedKey = `${photographer.id}/styles/${styleName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}/edited/${Date.now()}_${safeName}`;
          const resizedBlob = await resizeImage(pair.edited.file, 1600, 0.85);
          const formData = new FormData();
          formData.append('file', resizedBlob, safeName);
          formData.append('storageKey', editedKey);
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const result = await res.json();
          if (!res.ok || result.error) throw new Error(result.error || 'Upload failed');
          newEditedKeys.push(result.storageKey);
          setEditedFiles((prev) => prev.map((p) => p.id === pair.edited.id ? { ...p, status: 'complete' } : p));
        } catch {
          setEditedFiles((prev) => prev.map((p) => p.id === pair.edited.id ? { ...p, status: 'error' } : p));
        }
        completedUploads++;
        setUploadProgress(Math.round((completedUploads / totalUploads) * 100));
      }

      if (newEditedKeys.length < PAIR_MIN) {
        setUploading(false);
        setUploadPhase(null);
        return;
      }

      setUploadPhase('starting');

      const res = await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          photographer_id: photographer.id,
          name: styleName.trim(),
          description: `${newPairCount} RAW + edited pairs`,
          reference_image_keys: newEditedKeys,
          settings: { raw_image_keys: newRawKeys, training_mode: 'paired' },
        }),
      });

      if (res.ok) {
        onComplete();
      }
    } catch (err) {
      console.error('Upload error:', err);
    }

    setUploading(false);
    setUploadPhase(null);
  };

  const pairStatus = newPairCount < PAIR_MIN ? 'insufficient'
    : newPairCount < PAIR_RECOMMENDED ? 'minimum'
    : newPairCount < PAIR_IDEAL ? 'good'
    : 'excellent';

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">New Style</h3>
        {!uploading && (
          <button onClick={onCancel} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Style name */}
      <div>
        <label className="text-[11px] font-medium text-slate-400 block mb-1">Style Name</label>
        <input
          type="text"
          value={styleName}
          onChange={(e) => setStyleName(e.target.value)}
          placeholder="e.g. My Style, Black & White, Film, Moody..."
          className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
        />
      </div>

      {/* Pair count progress */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">{newPairCount} matched pair{newPairCount !== 1 ? 's' : ''}</span>
          <span className={`font-medium ${
            pairStatus === 'insufficient' ? 'text-red-400'
              : pairStatus === 'minimum' ? 'text-amber-400'
              : pairStatus === 'good' ? 'text-amber-400'
              : 'text-emerald-400'
          }`}>
            {pairStatus === 'insufficient' ? `Need ${PAIR_MIN - newPairCount} more` : pairStatus === 'minimum' ? 'OK — more = better' : pairStatus === 'good' ? 'Good' : 'Excellent'}
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              pairStatus === 'insufficient' ? 'bg-red-500' : pairStatus === 'minimum' ? 'bg-amber-500' : pairStatus === 'good' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min((newPairCount / PAIR_MAX) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
          <span>0</span><span>{PAIR_MIN} min</span><span>{PAIR_RECOMMENDED}</span><span>{PAIR_IDEAL}</span><span>{PAIR_MAX}</span>
        </div>
      </div>

      {/* Side-by-side drop zones */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onDrop={(e) => { e.preventDefault(); setRawDragOver(false); if (e.dataTransfer.files.length > 0) addRawFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setRawDragOver(true); }}
          onDragLeave={() => setRawDragOver(false)}
          onClick={() => !uploading && rawInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed transition-all min-h-[120px] ${
            rawDragOver ? 'border-amber-500 bg-amber-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
          } ${uploading ? 'opacity-80' : 'cursor-pointer'}`}
        >
          <input ref={rawInputRef} type="file" multiple accept={RAW_EXTENSIONS.join(',')} onChange={(e) => e.target.files && addRawFiles(e.target.files)} className="hidden" />
          <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
              <Camera className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs font-medium text-slate-200 mb-0.5">RAW Originals</p>
            <p className="text-[10px] text-slate-500">CR2, NEF, ARW, DNG...</p>
            {rawFiles.length > 0 && <p className="text-[10px] text-amber-400 mt-1 font-medium">{rawFiles.length} added</p>}
          </div>
        </div>

        <div
          onDrop={(e) => { e.preventDefault(); setEditedDragOver(false); if (e.dataTransfer.files.length > 0) addEditedFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setEditedDragOver(true); }}
          onDragLeave={() => setEditedDragOver(false)}
          onClick={() => !uploading && editedInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed transition-all min-h-[120px] ${
            editedDragOver ? 'border-amber-500 bg-amber-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
          } ${uploading ? 'opacity-80' : 'cursor-pointer'}`}
        >
          <input ref={editedInputRef} type="file" multiple accept={EDITED_EXTENSIONS.join(',')} onChange={(e) => e.target.files && addEditedFiles(e.target.files)} className="hidden" />
          <div className="flex flex-col items-center justify-center py-5 px-3 text-center">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
              <Wand2 className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs font-medium text-slate-200 mb-0.5">Edited Versions</p>
            <p className="text-[10px] text-slate-500">JPEG, PNG, TIFF</p>
            {editedFiles.length > 0 && <p className="text-[10px] text-amber-400 mt-1 font-medium">{editedFiles.length} added</p>}
          </div>
        </div>
      </div>

      {/* Matching status */}
      {(rawFiles.length > 0 || editedFiles.length > 0) && (
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 space-y-1.5">
          {newPairCount > 0 && (
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-emerald-400">{newPairCount} matched pair{newPairCount !== 1 ? 's' : ''}</span>
            </div>
          )}
          {unmatchedRaw.length > 0 && (
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-400">{unmatchedRaw.length} RAW without matching edit</span>
            </div>
          )}
          {unmatchedEdited.length > 0 && (
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-400">{unmatchedEdited.length} edited without matching RAW</span>
            </div>
          )}
          <p className="text-[10px] text-slate-600">Matched by filename — <span className="text-slate-400">IMG_1234.CR2</span> ↔ <span className="text-slate-400">IMG_1234.jpg</span></p>
        </div>
      )}

      {/* Tips */}
      {rawFiles.length === 0 && editedFiles.length === 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
          <p className="text-[10px] text-slate-500">Variety matters more than volume — 25 diverse pairs across different scenes will outperform 100 from the same shoot.</p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs font-medium text-amber-300">
              {uploadPhase === 'starting' ? 'Starting AI training...' : `Uploading pairs... ${uploadProgress}%`}
            </span>
          </div>
          <div className="h-1.5 bg-amber-500/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          {uploadPhase === 'starting' && (
            <p className="text-[10px] text-amber-400/60 mt-2">Training happens in the background — you can leave this page.</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!uploading && (
        <div className="flex items-center justify-between pt-1">
          <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
          <Button size="sm" onClick={handleUpload} disabled={newPairCount < PAIR_MIN || !styleName.trim()}>
            <Upload className="w-3 h-3" />Upload {newPairCount} Pairs &amp; Train
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

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

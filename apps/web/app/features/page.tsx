'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import {
  ArrowRight, Users, Wand2, ImageIcon, CheckCircle2, Lock, Download,
  Heart, Calendar, FileText, ScrollText, Zap, Mail, Sparkles, ScanFace,
  Eraser, Crop, Layers, Palette, Star, Share2,
} from 'lucide-react';

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, inView } = useInView();
  return (
    <section id={id} ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </section>
  );
}

/* ─── Hero ─── */
function FeaturesHero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-brand-500/[0.05] rounded-full blur-[100px]" />
      </div>
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Features</p>
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] mb-6">
          Everything you need.<br />Nothing you don&apos;t.
        </h1>
        <p className="text-lg font-body text-warm-grey max-w-2xl mx-auto leading-relaxed">
          CRM, AI editing, and client galleries — designed specifically for photographers, built to work together seamlessly.
        </p>
      </div>
    </section>
  );
}

/* ─── AI Editing Deep Dive ─── */
function AIEditingSection() {
  const phases = [
    { icon: Layers, name: 'Analysis', desc: 'Scene detection, face detection, quality scoring, duplicate grouping' },
    { icon: Palette, name: 'Style Application', desc: 'Your trained editing style — exposure, colour grading, tone curves, HSL' },
    { icon: ScanFace, name: 'Face & Skin', desc: 'Texture-preserving skin smoothing, blemish removal, subtle retouching' },
    { icon: Eraser, name: 'Scene Cleanup', desc: 'Background distractions, exit signs, power lines, lens flare removal' },
    { icon: Crop, name: 'Composition', desc: 'Horizon straightening, crop optimisation, rule-of-thirds alignment' },
    { icon: CheckCircle2, name: 'QA & Output', desc: 'Quality check, web-res + full-res + thumbnails, top N image selection' },
  ];

  return (
    <Section id="ai-editing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/20 bg-white/[0.02] mb-5">
              <Wand2 className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-warm-grey">AI Photo Editing</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl text-white mb-4 leading-snug">
              Your editing style, applied to every photo automatically
            </h2>
            <p className="text-base font-body text-warm-grey leading-relaxed mb-6">
              Upload 10–100 RAW + edited pairs. Apelier&apos;s AI learns exactly what you change — exposure adjustments, colour grading, tone curves, HSL shifts, everything. Then it applies your style to entire shoots in minutes instead of weeks.
            </p>
            <p className="text-sm font-body text-dark-warm leading-relaxed mb-8">
              Unlike Imagen (which needs 3,000–5,000 images), Apelier learns from as few as 10 pairs. Create multiple named styles — &ldquo;Wedding&rdquo;, &ldquo;B&amp;W&rdquo;, &ldquo;Film&rdquo; — and switch between them per shoot or per photo.
            </p>

            <div className="space-y-3">
              {[
                'Learns from your RAW + edited pairs (10 minimum)',
                'Multiple named styles per photographer',
                '6-phase pipeline: analysis → style → retouch → cleanup → compose → output',
                'Processes full RAW files (CR2, NEF, ARW, DNG + 15 more formats)',
                'Cloud-based — no local GPU required',
                'Review & approve before delivery',
              ].map((feat) => (
                <div key={feat} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-body text-slate-300">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phases visual */}
          <div className="flex-1 w-full max-w-lg">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c12] p-6 shadow-2xl">
              <p className="text-xs font-sans font-semibold text-white mb-5">6-Phase AI Pipeline</p>
              <div className="space-y-3">
                {phases.map((phase, i) => (
                  <div key={phase.name} className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-brand-500/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                      <phase.icon className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-sans font-bold text-brand-500/50">Phase {i}</span>
                        <span className="text-xs font-sans font-medium text-white">{phase.name}</span>
                      </div>
                      <p className="text-[11px] font-body text-dark-warm leading-relaxed">{phase.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── CRM Section ─── */
function CRMSection() {
  const features = [
    { icon: Users, title: 'Client Management', desc: 'Full CRUD with search, tags, source tracking, revenue per client, and contact history.' },
    { icon: Wand2, title: 'Lead Pipeline', desc: 'Kanban view from New → Contacted → Quoted → Booked. Automatic status transitions.' },
    { icon: Calendar, title: 'Booking System', desc: 'Public booking pages, custom time slots, auto-creates client + job + invoice on booking.' },
    { icon: FileText, title: 'Smart Invoicing', desc: 'Auto-generated from packages. Deposit + final invoice splits. Overdue reminders.' },
    { icon: ScrollText, title: 'Contracts & E-Sign', desc: 'Universal template with merge tags. Canvas signature pad. IP + timestamp capture.' },
    { icon: Mail, title: 'Email Automation', desc: 'Booking confirmations, contract signing, invoice, gallery delivery — all branded, all automatic.' },
  ];

  return (
    <Section id="crm" className="py-24 md:py-32 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-white/[0.02] mb-5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-warm-grey">CRM & Automation</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">
            Your entire business, automated
          </h2>
          <p className="text-base font-body text-warm-grey max-w-xl mx-auto">
            From the moment a lead enquires to the final follow-up email, Apelier handles the admin so you can focus on shooting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat) => (
            <div key={feat.title} className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/20 transition-all duration-300">
              <div className="inline-flex p-2.5 rounded-xl bg-emerald-500/10 mb-4">
                <feat.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-sans font-semibold text-base text-white mb-2">{feat.title}</h3>
              <p className="text-sm font-body text-dark-warm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── Galleries Section ─── */
function GalleriesSection() {
  return (
    <Section id="galleries" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row-reverse gap-12 lg:gap-16 items-center">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/20 bg-white/[0.02] mb-5">
              <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-warm-grey">Client Galleries</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl text-white mb-4 leading-snug">
              Stunning galleries that reflect your brand
            </h2>
            <p className="text-base font-body text-warm-grey leading-relaxed mb-8">
              Every gallery is branded with your colours, logo, and business name. Password-protected or public, with configurable download permissions, favourites, expiry dates, and section filtering.
            </p>

            <div className="space-y-3">
              {[
                { icon: Palette, text: 'Custom branding — your colours, your logo, your name' },
                { icon: Lock, text: 'Password protection with secure hash verification' },
                { icon: Download, text: 'Full-res and web-res download options' },
                { icon: Heart, text: 'Client favourites with heart toggle' },
                { icon: Share2, text: 'Social sharing with photographer credit' },
                { icon: Star, text: 'Section filtering, lightbox, keyboard navigation' },
              ].map((feat) => (
                <div key={feat.text} className="flex items-start gap-3">
                  <feat.icon className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-body text-slate-300">{feat.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery preview mock */}
          <div className="flex-1 w-full max-w-lg">
            <div className="rounded-2xl border border-white/[0.06] bg-[#fafafa] overflow-hidden shadow-2xl">
              {/* Gallery header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-display font-bold text-brand-600">JL</span>
                  </div>
                  <div>
                    <p className="text-xs font-sans font-semibold text-gray-900">Jessica Lewis Photography</p>
                    <p className="text-[10px] font-body text-gray-400">Sarah & Tom — Wedding Gallery</p>
                  </div>
                </div>
              </div>
              {/* Gallery grid mock */}
              <div className="p-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="relative aspect-[3/2] rounded-lg overflow-hidden" style={{ backgroundColor: `hsl(${25 + i * 8}, ${20 + i * 3}%, ${85 - i * 4}%)` }}>
                      {i === 2 && (
                        <div className="absolute top-1 right-1">
                          <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-body text-gray-400">247 photos · 3 sections</span>
                  <span className="text-[10px] font-sans text-brand-600">Download All</span>
                </div>
              </div>
              {/* Powered by */}
              <div className="px-5 py-2 bg-gray-50 text-center">
                <span className="text-[9px] font-body text-gray-300">Powered by Apelier</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── Automation Timeline ─── */
function AutomationSection() {
  const automations = [
    { trigger: 'Lead added', action: 'Auto-response email sent within minutes', icon: Mail, color: 'text-blue-400' },
    { trigger: 'Quote accepted', action: 'Contract generated & sent for e-signing', icon: ScrollText, color: 'text-emerald-400' },
    { trigger: 'Contract signed', action: 'Invoice(s) created & sent automatically', icon: FileText, color: 'text-amber-400' },
    { trigger: '7 days before shoot', action: 'Prep tips & location details emailed to client', icon: Calendar, color: 'text-violet-400' },
    { trigger: 'Photos uploaded', action: 'AI editing pipeline starts automatically', icon: Wand2, color: 'text-brand-400' },
    { trigger: 'Gallery delivered', action: 'Delivery email + follow-ups + review request scheduled', icon: Zap, color: 'text-pink-400' },
  ];

  return (
    <Section className="py-24 md:py-32 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/20 bg-white/[0.02] mb-5">
            <Zap className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-warm-grey">Workflows</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">
            Set it once, never think about it again
          </h2>
          <p className="text-base font-body text-warm-grey max-w-xl mx-auto">
            Every repetitive task is handled by configurable automations. Toggle them on, customise timing and templates, and let Apelier run your business.
          </p>
        </div>

        <div className="space-y-3">
          {automations.map((auto, i) => (
            <div key={auto.trigger} className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                <auto.icon className={`w-5 h-5 ${auto.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-white">{auto.trigger}</p>
                <p className="text-xs font-body text-dark-warm">{auto.action}</p>
              </div>
              <span className="text-[9px] font-sans font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                Auto
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── CTA ─── */
function FeaturesCTA() {
  return (
    <Section className="py-24 md:py-32 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-6" />
        <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Ready to simplify your workflow?</h2>
        <p className="text-lg font-body text-warm-grey mb-8 max-w-xl mx-auto">
          14 days free. No credit card. Import your existing data and be running in minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/waitlist" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/25">
            Join the Waitlist
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 px-6 py-4 text-base font-sans font-medium text-warm-grey hover:text-white transition-colors">
            View Pricing
          </Link>
        </div>
      </div>
    </Section>
  );
}

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <FeaturesHero />
      <AIEditingSection />
      <CRMSection />
      <GalleriesSection />
      <AutomationSection />
      <FeaturesCTA />
    </MarketingLayout>
  );
}

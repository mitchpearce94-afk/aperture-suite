'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MarketingLayout, ApelierLogo } from '@/components/marketing/marketing-layout';
import {
  ArrowRight, Camera, Wand2, ImageIcon, Users, CalendarCheck,
  ChevronRight, CheckCircle2, Sparkles, Shield, Clock,
} from 'lucide-react';

/* ─── Intersection Observer hook for scroll animations ─── */
function useInView(threshold = 0.15) {
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

/* ─── Section wrapper with fade-up ─── */
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, inView } = useInView(0.1);
  return (
    <section
      id={id}
      ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  );
}

/* ─── Hero Section ─── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/[0.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-600/[0.04] rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(196,125,74,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(196,125,74,0.3) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-32 pb-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-500/20 bg-brand-500/[0.06] mb-8 animate-fade-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-sans font-medium text-brand-300 tracking-wide">Now with AI-powered editing</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white leading-[1.1] mb-6 animate-fade-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          From shutter click to<br />
          client delivery in{' '}
          <span className="shimmer-text">under 1 hour</span>
        </h1>

        {/* Sub */}
        <p className="text-lg md:text-xl font-body text-warm-grey max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up" style={{ animationDelay: '0.35s', animationFillMode: 'both' }}>
          Apelier replaces your CRM, your editing software, and your gallery platform
          with one beautiful tool. Automate everything except the shutter button.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
          <Link href="/waitlist" className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all duration-300 shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02]">
            Join the Waitlist
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/features" className="inline-flex items-center gap-2 px-6 py-4 text-base font-sans font-medium text-warm-grey hover:text-white transition-colors">
            See How It Works
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dashboard preview mock */}
        <div className="relative max-w-4xl mx-auto animate-fade-up" style={{ animationDelay: '0.65s', animationFillMode: 'both' }}>
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c12] overflow-hidden shadow-2xl shadow-black/50">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#09090e]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
              <div className="flex-1 mx-8"><div className="w-48 h-5 bg-white/[0.04] rounded-full mx-auto" /></div>
            </div>

            <div className="p-6 md:p-8">
              <div className="flex gap-6">
                {/* Sidebar mock */}
                <div className="hidden md:block w-44 space-y-3">
                  <div className="flex items-center gap-2.5 mb-6">
                    <ApelierLogo className="w-5 h-5" />
                    <span className="font-display text-xs text-white">Apelier</span>
                  </div>
                  {['Dashboard', 'Leads', 'Clients', 'Jobs', 'Calendar'].map((item, i) => (
                    <div key={item} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-sans ${i === 0 ? 'bg-brand-500/10 text-brand-400' : 'text-dark-warm'}`}>
                      <div className={`w-3.5 h-3.5 rounded ${i === 0 ? 'bg-brand-500/30' : 'bg-white/[0.06]'}`} />
                      {item}
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-white/[0.04]">
                    {['Auto Editor', 'Galleries'].map((item) => (
                      <div key={item} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-sans text-dark-warm">
                        <div className="w-3.5 h-3.5 rounded bg-white/[0.06]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main content mock */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Clients', value: '142', color: 'text-white' },
                      { label: 'Active Leads', value: '23', color: 'text-brand-400' },
                      { label: 'Open Jobs', value: '8', color: 'text-emerald-400' },
                      { label: 'This Month', value: '$12,450', color: 'text-white' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <p className="text-[10px] font-sans text-dark-warm uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-lg font-sans font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-xs font-sans font-medium text-warm-grey mb-3">Upcoming Shoots</p>
                      {['Sarah & Tom — Wedding', 'Emma L. — Portrait', 'The Nguyens — Family'].map((job, i) => (
                        <div key={job} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                          <span className="text-xs font-body text-slate-300">{job}</span>
                          <span className="text-[10px] font-sans text-dark-warm">{i === 0 ? 'Tomorrow' : i === 1 ? 'Sat' : 'Mon'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-xs font-sans font-medium text-warm-grey mb-3">Recent Activity</p>
                      {[
                        { text: '247 photos edited & delivered', icon: '✨' },
                        { text: 'INV-0042 paid — $2,800', icon: '💰' },
                        { text: 'Gallery viewed by Emma L.', icon: '👀' },
                      ].map((act) => (
                        <div key={act.text} className="flex items-center gap-2.5 py-2 border-b border-white/[0.03] last:border-0">
                          <span className="text-sm">{act.icon}</span>
                          <span className="text-xs font-body text-slate-300">{act.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-brand-500/10 blur-3xl rounded-full" />
        </div>
      </div>
    </section>
  );
}

/* ─── Replaces Section ─── */
function ReplacesSection() {
  const tools = [
    { icon: Users, name: 'Your CRM', cost: '$28–45/mo', extra: null },
    { icon: Wand2, name: 'Your editing app', cost: '$15–30/mo', extra: '+ 8–15 hrs/week editing' },
    { icon: ImageIcon, name: 'Your gallery host', cost: '$15–58/mo', extra: null },
  ];

  return (
    <Section className="py-20 border-t border-white/[0.04]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Replaces your entire stack</p>
        <h2 className="font-display text-2xl md:text-3xl text-white mb-12">One subscription instead of three</h2>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-3 mb-8">
          {tools.map((tool, i) => (
            <div key={tool.name} className="contents">
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] w-full md:w-auto">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <tool.icon className="w-4.5 h-4.5 text-warm-grey" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-sans font-medium text-slate-300 line-through decoration-warm-grey/40">{tool.name}</p>
                  <p className="text-xs font-body text-dark-warm">{tool.cost}</p>
                  {tool.extra && (
                    <p className="text-[10px] font-body text-warm-grey/70 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {tool.extra}
                    </p>
                  )}
                </div>
              </div>
              {i < tools.length - 1 && (
                <span className="text-dark-warm text-lg font-light hidden md:block">+</span>
              )}
            </div>
          ))}

          <span className="text-warm-grey text-lg font-light hidden md:block mx-2">=</span>

          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-brand-500/[0.08] border border-brand-500/30 w-full md:w-auto">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-brand-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-sans font-semibold text-white">Apelier</p>
              <p className="text-xs font-body text-brand-300">From $39/mo — everything included</p>
              <p className="text-[10px] font-body text-brand-400/70 flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5" />
                AI edits in minutes, not days
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm font-body text-dark-warm max-w-lg mx-auto">
          Most photographers pay $70–150/mo for separate CRM, editing, and gallery tools — and spend 8–15 hours a week on manual edits. Apelier does it all.
        </p>
      </div>
    </Section>
  );
}

/* ─── Three Pillars ─── */
function PillarsSection() {
  const pillars = [
    {
      icon: Users, label: 'CRM & Automation',
      title: 'From lead to delivery, on autopilot',
      description: 'Leads, bookings, contracts, invoices, reminders — all automated. Your only job is to add a lead and shoot the photos.',
      features: ['Lead pipeline & kanban', 'Auto-contracts & e-signatures', 'Smart invoicing with deposits', 'Booking pages & calendar sync', 'Email automations'],
      gradient: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-400', accentColor: 'border-emerald-500/20',
    },
    {
      icon: Wand2, label: 'AI Photo Editing',
      title: 'Your style. Every photo. Instantly.',
      description: 'Upload 10–100 before/after pairs. Our AI learns exactly how you edit — exposure, colour grading, retouching — then applies it to entire shoots in minutes.',
      features: ['Learns from your RAW + edited pairs', 'Multiple named styles', 'Face & skin retouching', 'Scene cleanup & distractions', 'One-click batch processing'],
      gradient: 'from-brand-500/10 to-brand-600/5', iconColor: 'text-brand-400', accentColor: 'border-brand-500/20',
    },
    {
      icon: ImageIcon, label: 'Client Galleries',
      title: 'Beautiful delivery they\'ll love',
      description: 'Password-protected, branded galleries with favourites, downloads, and print ordering. Your photos, your brand, zero compromise.',
      features: ['Custom branding & colours', 'Password protection', 'Full-res downloads', 'Favourite & share', 'Expiry & access controls'],
      gradient: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-400', accentColor: 'border-violet-500/20',
    },
  ];

  return (
    <Section className="py-24 md:py-32" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Three pillars, one platform</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Everything a photographer needs</h2>
          <p className="text-base font-body text-warm-grey max-w-xl mx-auto">Most photographers juggle 3–4 subscriptions. Apelier combines them all into one seamless workflow.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {pillars.map((pillar) => (
            <div key={pillar.label} className={`group relative rounded-2xl border ${pillar.accentColor} bg-gradient-to-b ${pillar.gradient} p-8 hover:border-white/[0.12] transition-all duration-300`}>
              <div className="inline-flex p-3 rounded-xl bg-white/[0.04] mb-5">
                <pillar.icon className={`w-6 h-6 ${pillar.iconColor}`} />
              </div>
              <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-warm-grey mb-2">{pillar.label}</p>
              <h3 className="font-display text-xl text-white mb-3 leading-snug">{pillar.title}</h3>
              <p className="text-sm font-body text-dark-warm leading-relaxed mb-6">{pillar.description}</p>
              <ul className="space-y-2.5">
                {pillar.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${pillar.iconColor} flex-shrink-0`} />
                    <span className="text-sm font-body text-slate-300">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── Before/After Slider ─── */
function BeforeAfterSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setPosition(pct);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e.clientX);
  };
  const handlePointerUp = () => setIsDragging(false);

  return (
    <Section className="py-24 md:py-32 bg-gradient-to-b from-transparent via-brand-500/[0.02] to-transparent">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">See the difference</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">RAW to finished. In minutes.</h2>
          <p className="text-base font-body text-warm-grey max-w-xl mx-auto">
            Drag the slider to compare. The AI learns your exact editing style from just 10 before/after pairs — then applies it to every photo.
          </p>
        </div>

        {/* Slider container */}
        <div
          ref={containerRef}
          className="relative max-w-md mx-auto rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40 select-none touch-none cursor-col-resize"
          style={{ aspectRatio: '683 / 1024' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* "After" (edited) — real photo */}
          <div className="absolute inset-0">
            <img src="/images/after-sample.jpg" alt="Edited photo" className="w-full h-full object-cover" draggable={false} />
          </div>

          {/* "Before" (RAW) — clipped by slider position */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <img src="/images/before-sample.jpg" alt="RAW unedited photo" className="w-full h-full object-cover" draggable={false} />
          </div>

          {/* Divider line + handle */}
          <div
            className="absolute top-0 bottom-0 z-10"
            style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
          >
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/80 shadow-lg shadow-black/30" />

            {/* Drag handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl shadow-black/40 flex items-center justify-center gap-0.5 border-2 border-white/90">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.5 3L1.5 7L4.5 11" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9.5 3L12.5 7L9.5 11" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-white/80">RAW</span>
          </div>
          <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-brand-300">Edited</span>
          </div>
        </div>

        <p className="text-center text-xs font-body text-dark-warm mt-6">
          Real before &amp; after. With Apelier, your RAW photos get this treatment — using your trained editing style.
        </p>
      </div>
    </Section>
  );
}

/* ─── How It Works ─── */
function HowItWorksSection() {
  const steps = [
    { num: '01', title: 'Add a lead', description: 'Client enquires via your website, Instagram DMs, or a phone call. Add them in one click.', manual: true },
    { num: '02', title: 'Auto-quote & book', description: 'Client receives a branded quote link, picks their package, and books. Contracts and invoices generate automatically.', manual: false },
    { num: '03', title: 'Shoot & upload', description: "After the shoot, drag and drop your RAW files. That's your last manual step.", manual: true },
    { num: '04', title: 'AI edits everything', description: 'Our AI applies your exact editing style to every photo — exposure, colour, retouching, cleanup. Minutes, not weeks.', manual: false },
    { num: '05', title: 'Quick review', description: 'Scroll through the gallery, approve the edits. 95% of photos are perfect first time.', manual: true },
    { num: '06', title: 'Client receives gallery', description: 'One click delivers a beautiful, branded gallery with downloads, favourites, and print ordering.', manual: false },
  ];

  return (
    <Section className="py-24 md:py-32 bg-gradient-to-b from-transparent via-brand-500/[0.02] to-transparent">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">The workflow</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Six steps. Three are yours.</h2>
          <p className="text-base font-body text-warm-grey max-w-xl mx-auto">Add a lead, upload photos, review the gallery. Everything else is automated.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map((step) => (
            <div key={step.num} className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-brand-500/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-display text-brand-500/40 font-bold">{step.num}</span>
                {step.manual ? (
                  <span className="text-[9px] font-sans font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">You</span>
                ) : (
                  <span className="text-[9px] font-sans font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Auto</span>
                )}
              </div>
              <h3 className="font-display text-base text-white mb-2">{step.title}</h3>
              <p className="text-sm font-body text-dark-warm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── Stats ─── */
function StatsSection() {
  return (
    <Section className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '<1hr', label: 'Average turnaround', detail: 'vs 4–8 weeks industry average' },
            { value: '6', label: 'Phases of AI processing', detail: 'Analysis to delivery' },
            { value: '10', label: 'Training pairs minimum', detail: 'vs 3,000+ with competitors' },
            { value: '$39', label: 'Starting price', detail: 'Replaces $70–150 in tools' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-3xl md:text-4xl text-brand-400 mb-2">{stat.value}</p>
              <p className="text-sm font-sans font-medium text-white mb-1">{stat.label}</p>
              <p className="text-xs font-body text-dark-warm">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── Comparison ─── */
function ComparisonSection() {
  const features = [
    { name: 'CRM & Booking', apelier: true, crm: true, editing: false, gallery: false },
    { name: 'AI Photo Editing', apelier: true, crm: false, editing: true, gallery: false },
    { name: 'Client Galleries', apelier: true, crm: false, editing: false, gallery: true },
    { name: 'E-Signatures & Contracts', apelier: true, crm: '◐', editing: false, gallery: false },
    { name: 'Automated Invoicing', apelier: true, crm: true, editing: false, gallery: false },
    { name: 'Prompt-Based Edits', apelier: true, crm: false, editing: false, gallery: false },
    { name: 'Auto Scene Cleanup', apelier: true, crm: false, editing: false, gallery: false },
    { name: 'End-to-End Automation', apelier: true, crm: false, editing: false, gallery: false },
  ];

  const Cell = ({ value }: { value: boolean | string }) => (
    <td className="px-4 py-3 text-center">
      {value === true ? <CheckCircle2 className="w-4 h-4 text-brand-400 mx-auto" /> :
       value === '◐' ? <span className="text-warm-grey text-xs">Partial</span> :
       <span className="text-dark-warm text-xs">—</span>}
    </td>
  );

  return (
    <Section className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Why use one platform?</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">All-in-one vs piecing it together</h2>
          <p className="text-sm font-body text-warm-grey max-w-lg mx-auto">See what you get with Apelier compared to using separate tools for each job.</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">Feature</th>
                  <th className="px-4 py-3 font-sans font-semibold text-brand-400 text-xs uppercase tracking-wider">Apelier</th>
                  <th className="px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">CRM Tool</th>
                  <th className="px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">Editing App</th>
                  <th className="px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">Gallery Host</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feat) => (
                  <tr key={feat.name} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                    <td className="px-4 py-3 font-body text-slate-300">{feat.name}</td>
                    <Cell value={feat.apelier} />
                    <Cell value={feat.crm} />
                    <Cell value={feat.editing} />
                    <Cell value={feat.gallery} />
                  </tr>
                ))}
                <tr className="bg-white/[0.02]">
                  <td className="px-4 py-3 font-body font-medium text-white">Typical monthly cost</td>
                  <td className="px-4 py-3 text-center font-sans font-bold text-brand-400">$39+</td>
                  <td className="px-4 py-3 text-center font-sans text-dark-warm">$28–45</td>
                  <td className="px-4 py-3 text-center font-sans text-dark-warm">$15–30</td>
                  <td className="px-4 py-3 text-center font-sans text-dark-warm">$15–58</td>
                </tr>
                <tr className="bg-brand-500/[0.04]">
                  <td className="px-4 py-3 font-body font-medium text-white">Combined total</td>
                  <td className="px-4 py-3 text-center font-sans font-bold text-brand-400">$39+</td>
                  <td colSpan={3} className="px-4 py-3 text-center font-sans font-medium text-warm-grey">$58–133/mo for all three</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-center text-xs font-body text-dark-warm mt-4">Apelier replaces all three — and connects them together so nothing falls through the cracks.</p>
      </div>
    </Section>
  );
}

/* ─── Pricing Preview ─── */
function PricingPreview() {
  return (
    <Section className="py-24 md:py-32 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Simple pricing</p>
        <h2 className="font-display text-3xl md:text-4xl text-white mb-4">One platform. Three tiers.</h2>
        <p className="text-base font-body text-warm-grey max-w-xl mx-auto mb-12">Start free for 14 days. No credit card required. Every plan includes CRM, booking, invoicing, contracts, and galleries.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { name: 'Starter', price: 39, edits: '2,000', desc: 'For solo photographers starting out' },
            { name: 'Pro', price: 109, edits: '10,000', desc: 'For busy professionals', popular: true },
            { name: 'Studio', price: 279, edits: '25,000', desc: 'For studios & teams' },
          ].map((tier) => (
            <div key={tier.name} className={`relative p-6 rounded-2xl border text-left ${tier.popular ? 'border-brand-500/40 bg-brand-500/[0.05]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-brand-500 text-white">Most Popular</span>
              )}
              <h3 className="font-sans font-semibold text-lg text-white mb-1">{tier.name}</h3>
              <p className="text-xs font-body text-dark-warm mb-4">{tier.desc}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-display text-3xl text-white">${tier.price}</span>
                <span className="text-sm font-body text-dark-warm">/mo</span>
              </div>
              <p className="text-xs font-sans text-warm-grey mb-4">{tier.edits} AI edits/month</p>
              <Link href="/pricing" className={`block text-center py-2.5 rounded-full text-sm font-sans font-semibold transition-all ${tier.popular ? 'bg-brand-500 text-white hover:bg-brand-600' : 'bg-white/[0.06] text-white hover:bg-white/[0.1]'}`}>
                Join the Waitlist
              </Link>
            </div>
          ))}
        </div>

        <Link href="/pricing" className="inline-flex items-center gap-2 mt-8 text-sm font-sans text-brand-400 hover:text-brand-300 transition-colors">
          View full pricing comparison <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Section>
  );
}

/* ─── Migration CTA ─── */
function MigrationCTA() {
  return (
    <Section className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="p-10 md:p-16 rounded-3xl border border-brand-500/20 bg-gradient-to-b from-brand-500/[0.06] to-transparent relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-brand-500/[0.08] rounded-full blur-[80px]" />
          <div className="relative">
            <Shield className="w-10 h-10 text-brand-400 mx-auto mb-6" />
            <h2 className="font-display text-2xl md:text-3xl text-white mb-4">Switching is painless</h2>
            <p className="text-base font-body text-warm-grey max-w-lg mx-auto mb-6">
              Already using a CRM or gallery platform? Import your clients, jobs, and invoices in minutes. Upload a CSV, our smart mapper does the rest.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              {['CSV Import', 'Smart Field Mapping', 'Deduplication', 'Keeps Your History'].map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-xs font-sans text-slate-300 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <CheckCircle2 className="w-3 h-3 text-brand-400" />
                  {p}
                </span>
              ))}
            </div>
            <Link href="/waitlist" className="inline-flex items-center gap-2 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20">
              Start Your Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── Final CTA ─── */
function FinalCTA() {
  return (
    <Section className="py-24 md:py-32 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <ApelierLogo className="w-12 h-12 mx-auto mb-6" />
        <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Ready to shoot, edit, deliver?</h2>
        <p className="text-lg font-body text-warm-grey mb-8 max-w-xl mx-auto">14 days free. No credit card. Import your data from any CRM. Be running in minutes.</p>
        <Link href="/waitlist" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all duration-300 shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40">
          Join the Waitlist
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Section>
  );
}

/* ─── Page ─── */
export default function HomePage() {
  return (
    <MarketingLayout>
      <Hero />
      <ReplacesSection />
      <PillarsSection />
      <BeforeAfterSlider />
      <HowItWorksSection />
      <StatsSection />
      <ComparisonSection />
      <PricingPreview />
      <MigrationCTA />
      <FinalCTA />
    </MarketingLayout>
  );
}

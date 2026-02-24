'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { ArrowRight, CheckCircle2, X, ChevronDown, Sparkles } from 'lucide-react';

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

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <section ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </section>
  );
}

/* ─── Pricing Cards ─── */
function PricingCards() {
  const [annual, setAnnual] = useState(false);

  const tiers = [
    {
      name: 'Starter',
      desc: 'For solo photographers starting out',
      monthly: 39,
      annual: 390,
      edits: '2,000',
      styles: '1',
      features: [
        'Full CRM & lead pipeline',
        'Booking pages & calendar',
        'Contracts & e-signatures',
        'Smart invoicing with deposits',
        'Email automations',
        'Client galleries',
        '2,000 AI edits/month',
        '1 editing style',
      ],
      cta: 'Join the Waitlist',
    },
    {
      name: 'Pro',
      desc: 'For busy professionals',
      monthly: 109,
      annual: 1090,
      edits: '10,000',
      styles: '3',
      popular: true,
      features: [
        'Everything in Starter',
        '10,000 AI edits/month',
        '3 editing styles',
        'Branded galleries (no watermark)',
        'Face & skin retouching',
        'Priority AI processing',
        'Advanced analytics',
        'Priority support',
      ],
      cta: 'Join the Waitlist',
    },
    {
      name: 'Studio',
      desc: 'For studios & teams',
      monthly: 279,
      annual: 2790,
      edits: '25,000',
      styles: 'Unlimited',
      features: [
        'Everything in Pro',
        '25,000 AI edits/month',
        'Unlimited editing styles',
        'Multi-shooter support',
        'White-label galleries',
        'API access',
        'Dedicated support',
        'Custom onboarding',
      ],
      cta: 'Join the Waitlist',
    },
  ];

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-500/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-sans font-semibold uppercase tracking-[0.2em] text-brand-500 mb-4">Pricing</p>
          <h1 className="font-display text-4xl md:text-5xl text-white leading-[1.1] mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg font-body text-warm-grey max-w-xl mx-auto mb-8">
            Every plan includes CRM, booking, invoicing, contracts, galleries, and AI editing. Start free for 14 days — no credit card required.
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-sans font-medium transition-all ${!annual ? 'bg-brand-500 text-white shadow-lg' : 'text-warm-grey hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-sans font-medium transition-all flex items-center gap-2 ${annual ? 'bg-brand-500 text-white shadow-lg' : 'text-warm-grey hover:text-white'}`}
            >
              Annual
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const price = annual ? Math.round(tier.annual / 12) : tier.monthly;
            const yearPrice = tier.annual;
            const savings = tier.monthly * 12 - tier.annual;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-7 flex flex-col ${
                  tier.popular
                    ? 'border-brand-500/40 bg-gradient-to-b from-brand-500/[0.08] to-brand-500/[0.02] scale-[1.02] shadow-xl shadow-brand-500/10'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-sans font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30">
                    Most Popular
                  </span>
                )}

                <div className="mb-6">
                  <h3 className="font-sans font-bold text-xl text-white mb-1">{tier.name}</h3>
                  <p className="text-xs font-body text-dark-warm">{tier.desc}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl text-white">${price}</span>
                    <span className="text-sm font-body text-dark-warm">/mo</span>
                  </div>
                  {annual && (
                    <p className="text-xs font-body text-emerald-400 mt-1">
                      ${yearPrice}/year — save ${savings}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-6">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span className="text-xs font-sans text-slate-300">{tier.edits} AI edits/month</span>
                  <span className="text-[10px] font-sans text-dark-warm ml-auto">{tier.styles} {tier.styles === '1' ? 'style' : 'styles'}</span>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${tier.popular ? 'text-brand-400' : 'text-emerald-400'}`} />
                      <span className="text-sm font-body text-slate-300">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/waitlist"
                  className={`block text-center py-3 rounded-full text-sm font-sans font-semibold transition-all ${
                    tier.popular
                      ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20'
                      : 'bg-white/[0.06] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Free trial callout */}
        <div className="text-center mt-10">
          <p className="text-sm font-body text-warm-grey">
            All plans will include a <span className="text-white font-medium">14-day free trial</span> at launch — no credit card required. Join the waitlist to be first in line.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Feature Comparison Table ─── */
function ComparisonTable() {
  const categories = [
    {
      name: 'CRM & Business',
      features: [
        { name: 'Client management', starter: true, pro: true, studio: true },
        { name: 'Lead pipeline (kanban + list)', starter: true, pro: true, studio: true },
        { name: 'Booking pages', starter: true, pro: true, studio: true },
        { name: 'Contracts & e-signatures', starter: true, pro: true, studio: true },
        { name: 'Smart invoicing', starter: true, pro: true, studio: true },
        { name: 'Calendar view', starter: true, pro: true, studio: true },
        { name: 'Email automations', starter: true, pro: true, studio: true },
        { name: 'Advanced analytics', starter: false, pro: true, studio: true },
      ],
    },
    {
      name: 'AI Editing',
      features: [
        { name: 'AI edits per month', starter: '2,000', pro: '10,000', studio: '25,000' },
        { name: 'Editing styles', starter: '1', pro: '3', studio: 'Unlimited' },
        { name: 'RAW file support', starter: true, pro: true, studio: true },
        { name: 'Style application', starter: true, pro: true, studio: true },
        { name: 'Face & skin retouching', starter: false, pro: true, studio: true },
        { name: 'Scene cleanup', starter: false, pro: true, studio: true },
        { name: 'Priority processing', starter: false, pro: true, studio: true },
      ],
    },
    {
      name: 'Galleries',
      features: [
        { name: 'Client galleries', starter: true, pro: true, studio: true },
        { name: 'Custom branding', starter: true, pro: true, studio: true },
        { name: 'Password protection', starter: true, pro: true, studio: true },
        { name: 'Downloads', starter: true, pro: true, studio: true },
        { name: 'Gallery watermark removed', starter: false, pro: true, studio: true },
        { name: 'White-label galleries', starter: false, pro: false, studio: true },
      ],
    },
    {
      name: 'Support & Extras',
      features: [
        { name: 'CRM data import', starter: true, pro: true, studio: true },
        { name: 'Multi-shooter support', starter: false, pro: false, studio: true },
        { name: 'API access', starter: false, pro: false, studio: true },
        { name: 'Priority support', starter: false, pro: true, studio: true },
        { name: 'Dedicated onboarding', starter: false, pro: false, studio: true },
      ],
    },
  ];

  const Cell = ({ value }: { value: boolean | string }) => {
    if (typeof value === 'string') return <td className="px-4 py-2.5 text-center text-xs font-sans font-medium text-white">{value}</td>;
    return (
      <td className="px-4 py-2.5 text-center">
        {value ? <CheckCircle2 className="w-4 h-4 text-brand-400 mx-auto" /> : <X className="w-3.5 h-3.5 text-white/10 mx-auto" />}
      </td>
    );
  };

  return (
    <Section className="py-24 md:py-32">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">Full feature comparison</h2>
        </div>

        <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider w-1/2">Feature</th>
                  <th className="px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">Starter</th>
                  <th className="px-4 py-3 font-sans font-semibold text-brand-400 text-xs uppercase tracking-wider">Pro</th>
                  <th className="px-4 py-3 font-sans font-medium text-warm-grey text-xs uppercase tracking-wider">Studio</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <>
                    <tr key={cat.name} className="border-b border-white/[0.06] bg-white/[0.01]">
                      <td colSpan={4} className="px-4 py-2.5 font-sans font-semibold text-xs uppercase tracking-wider text-brand-500">{cat.name}</td>
                    </tr>
                    {cat.features.map((feat) => (
                      <tr key={feat.name} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                        <td className="px-4 py-2.5 font-body text-slate-300 text-sm">{feat.name}</td>
                        <Cell value={feat.starter} />
                        <Cell value={feat.pro} />
                        <Cell value={feat.studio} />
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How will the free trial work at launch?',
      a: 'When we launch, every plan will include 14 days of full access with no credit card required. The trial will include 50 AI edits and all CRM, booking, invoicing, contract, and gallery features. Join the waitlist to be notified when we\'re ready.',
    },
    {
      q: 'What happens if I exceed my monthly AI edit limit?',
      a: 'Your existing edited photos remain accessible. You simply won\'t be able to start new AI processing jobs until your counter resets on your billing date. You can upgrade your tier at any time for immediate access to more edits.',
    },
    {
      q: 'Can I import my data from another CRM?',
      a: 'Yes! We support imports from HoneyBook, Dubsado, Studio Ninja, VSCO Workspace, 17hats, Bloom, Sprout Studio, Pixieset, Light Blue, and any generic CSV. Our smart mapper auto-detects columns and creates clients, jobs, and invoices in Apelier.',
    },
    {
      q: 'How does the AI learn my editing style?',
      a: 'Upload 10–100 RAW + edited pairs. The AI compares each before/after to learn exactly what you change — exposure, colour grading, HSL shifts, tone curves, everything. It then applies those same changes to new photos. You can create multiple named styles (e.g. "Wedding", "B&W", "Film").',
    },
    {
      q: 'What RAW formats are supported?',
      a: 'Apelier supports CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, and 15+ more RAW formats from all major camera manufacturers. JPEG, PNG, TIFF, and WEBP are also supported.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes, no contracts. Cancel from your billing settings and your subscription stays active until the end of your current period. Your data remains accessible for 30 days after cancellation.',
    },
    {
      q: 'Do you process photos locally or in the cloud?',
      a: 'Everything is cloud-based. No downloads, no local GPU required. Upload your RAW files through the browser, and Apelier processes them on GPU-accelerated servers. Results are stored securely in your account.',
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. All photos are stored with row-level security (each photographer can only access their own data). Galleries use signed URLs with expiry. Passwords are bcrypt-hashed. All connections are encrypted via HTTPS.',
    },
  ];

  return (
    <Section className="py-24 md:py-32 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">Frequently asked questions</h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-sans font-medium text-white pr-4">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-warm-grey flex-shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm font-body text-dark-warm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ─── CTA ─── */
function PricingCTA() {
  return (
    <Section className="py-24 md:py-32 text-center">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Join the waitlist</h2>
        <p className="text-lg font-body text-warm-grey mb-8 max-w-xl mx-auto">14 days. No credit card. Full access to everything.</p>
        <Link href="/waitlist" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/25">
          Join the Waitlist
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Section>
  );
}

export default function PricingPage() {
  return (
    <MarketingLayout>
      <PricingCards />
      <ComparisonTable />
      <FAQ />
      <PricingCTA />
    </MarketingLayout>
  );
}

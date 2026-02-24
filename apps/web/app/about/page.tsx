'use client';

import Link from 'next/link';
import { MarketingLayout, ApelierLogo } from '@/components/marketing/marketing-layout';
import { ArrowRight, Heart, Zap, Shield, Globe } from 'lucide-react';

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-[500px] h-[400px] bg-brand-500/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <ApelierLogo className="w-14 h-14 mx-auto mb-6" />
          <h1 className="font-display text-4xl md:text-5xl text-white leading-[1.1] mb-6">
            Built by a photographer,<br />for photographers
          </h1>
          <p className="text-lg font-body text-warm-grey max-w-2xl mx-auto leading-relaxed">
            Apelier started because the tools available to photographers were fragmented, expensive, and slow. We knew there had to be a better way.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 max-w-3xl mx-auto px-6">
        <div className="space-y-6 font-body text-warm-grey leading-relaxed">
          <p className="text-lg text-slate-300">
            The photography industry has a workflow problem. After every shoot, photographers spend weeks bouncing between 3–4 different tools: a CRM to manage clients, editing software to process photos, and a gallery platform to deliver them. Each tool has its own subscription, its own login, its own learning curve.
          </p>
          <p>
            Apelier was built to fix that. We combined CRM, AI-powered photo editing, and client galleries into a single platform — so photographers can go from shutter click to client delivery in under an hour instead of 4–8 weeks.
          </p>
          <p>
            The name blends <em className="text-brand-400 not-italic">aperture</em> (the heart of every lens) with <em className="text-brand-400 not-italic">atelier</em> (a creative workshop). It&apos;s the place where photographers do their best work.
          </p>
          <p>
            We&apos;re an independent Australian company, and we&apos;re just getting started.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display text-2xl md:text-3xl text-white text-center mb-12">What we believe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Heart, title: 'Craft matters', desc: 'Photography is art, not a commodity. Every tool we build respects the photographer\'s creative vision and never compromises their style.' },
              { icon: Zap, title: 'Automation should be invisible', desc: 'The best software gets out of the way. Photographers should spend their time shooting and being creative — not doing admin.' },
              { icon: Shield, title: 'Your data, your business', desc: 'We don\'t sell data, we don\'t show ads, and we make it easy to export everything. If you ever leave, your data goes with you.' },
              { icon: Globe, title: 'Built in Australia', desc: 'Designed and developed in Australia, serving photographers worldwide. Local support during AEST business hours.' },
            ].map((val) => (
              <div key={val.title} className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <val.icon className="w-6 h-6 text-brand-400 mb-4" />
                <h3 className="font-sans font-semibold text-base text-white mb-2">{val.title}</h3>
                <p className="text-sm font-body text-dark-warm leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl text-white mb-4">Join the waitlist</h2>
          <p className="text-lg font-body text-warm-grey mb-8">We&apos;re building the all-in-one platform for photography businesses. Join the waitlist to be first in line.</p>
          <Link href="/waitlist" className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/25">
            Join the Waitlist
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}

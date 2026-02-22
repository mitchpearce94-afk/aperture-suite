'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Blog', href: '/blog' },
  { name: 'About', href: '/about' },
];

/* ─── Apelier Logo SVG ─── */
function ApelierLogo({ className = '', light = false }: { className?: string; light?: boolean }) {
  const fillPrimary = light ? '#c47d4a' : '#c47d4a';
  const fillSecondary = light ? '#d4a574' : '#d4a574';
  const strokeColor = light ? '#d4a574' : '#d4a574';
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="9" width="34" height="26" rx="2" stroke={strokeColor} strokeWidth="0.5" opacity="0.2" />
      <rect x="29" y="4.5" width="6" height="3.5" rx="0.8" stroke={strokeColor} strokeWidth="0.5" opacity="0.2" />
      <path d="M22 3.5 L25.5 15.5 L22 13 Z" fill={fillPrimary} opacity="0.95" />
      <path d="M38 11 L29 19 L28.5 14.5 Z" fill={fillSecondary} opacity="0.7" />
      <path d="M38 33 L28 25.5 L29.5 21 Z" fill={fillPrimary} opacity="0.55" />
      <path d="M22 40.5 L18.5 28.5 L22 31 Z" fill={fillSecondary} opacity="0.95" />
      <path d="M6 33 L15 25.5 L15.5 30 Z" fill={fillPrimary} opacity="0.7" />
      <path d="M6 11 L16 19 L14.5 23.5 Z" fill={fillSecondary} opacity="0.55" />
      <circle cx="22" cy="22" r="4" fill={fillPrimary} />
    </svg>
  );
}

/* ─── Navbar ─── */
function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-night/90 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16 lg:h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <ApelierLogo className="w-8 h-8 transition-transform duration-300 group-hover:scale-105" />
          <span className="font-display text-lg text-white tracking-wide">Apelier</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-sans font-medium transition-colors duration-200',
                pathname === link.href
                  ? 'text-brand-400'
                  : 'text-warm-grey hover:text-white'
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-sans font-medium text-warm-grey hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all duration-200 shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30"
          >
            Start Free Trial
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-warm-grey hover:text-white transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-night/98 backdrop-blur-xl border-t border-white/[0.06]">
          <div className="px-6 py-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block text-base font-sans font-medium py-2',
                  pathname === link.href ? 'text-brand-400' : 'text-warm-grey'
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/[0.06] flex flex-col gap-3">
              <Link href="/login" className="text-sm font-sans text-warm-grey text-center py-2">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-sans font-semibold text-white bg-brand-500 rounded-full"
              >
                Start Free Trial
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Footer ─── */
function Footer() {
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: 'Product',
      links: [
        { name: 'Features', href: '/features' },
        { name: 'Pricing', href: '/pricing' },
        { name: 'AI Editing', href: '/features#ai-editing' },
        { name: 'Galleries', href: '/features#galleries' },
      ],
    },
    {
      title: 'Company',
      links: [
        { name: 'About', href: '/about' },
        { name: 'Blog', href: '/blog' },
        { name: 'Careers', href: '#' },
        { name: 'Contact', href: '#' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { name: 'Help Centre', href: '#' },
        { name: 'Migration Guide', href: '#' },
        { name: 'API Docs', href: '#' },
        { name: 'Status', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { name: 'Privacy', href: '#' },
        { name: 'Terms', href: '#' },
        { name: 'Security', href: '#' },
      ],
    },
  ];

  return (
    <footer className="relative bg-night border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-12 border-b border-white/[0.06]">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <ApelierLogo className="w-7 h-7" />
              <span className="font-display text-base text-white">Apelier</span>
            </Link>
            <p className="text-sm text-dark-warm leading-relaxed max-w-xs font-body">
              The all-in-one photography business platform. From shutter click to client delivery in under 1 hour.
            </p>
            <p className="text-xs text-dark-warm mt-4 font-sans tracking-wider uppercase">
              Shoot · Edit · Deliver
            </p>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-sans text-xs font-semibold uppercase tracking-widest text-warm-grey mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-body text-dark-warm hover:text-brand-400 transition-colors duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-xs font-body text-dark-warm">
            &copy; {currentYear} Apelier Pty Ltd. Made in Australia.
          </p>
          <div className="flex items-center gap-1">
            <span className="text-xs font-body text-dark-warm">Built with</span>
            <span className="text-brand-500 text-xs">♥</span>
            <span className="text-xs font-body text-dark-warm">for photographers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Marketing Layout Wrapper ─── */
export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-night grain">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export { ApelierLogo };

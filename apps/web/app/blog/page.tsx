'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { ArrowRight, Clock, Tag, Sparkles, Search, ChevronRight } from 'lucide-react';

/* ─── Types ─── */
interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  featured: boolean;
  source: 'file' | 'supabase';
}

/* ─── Intersection Observer hook ─── */
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

/* ─── Category pill colours ─── */
const categoryColours: Record<string, string> = {
  'Comparisons': 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  'AI & Editing': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Workflow': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'Business': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'General': 'bg-white/5 text-warm-grey border-white/10',
};

function getCategoryStyle(cat: string) {
  return categoryColours[cat] || categoryColours['General'];
}

/* ─── Format date ─── */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ─── Featured Post Card ─── */
function FeaturedCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative block rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden hover:border-brand-500/20 transition-all duration-500"
    >
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-[300px] h-[200px] bg-brand-500/[0.04] rounded-full blur-[80px] group-hover:bg-brand-500/[0.08] transition-all duration-700" />

      <div className="relative p-8 md:p-10">
        {/* Top row */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-medium border ${getCategoryStyle(post.category)}`}>
            {post.category}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-body text-dark-warm">
            <Sparkles className="w-3 h-3 text-brand-400" />
            Featured
          </span>
        </div>

        {/* Title */}
        <h2 className="font-display text-2xl md:text-3xl text-white leading-[1.2] mb-4 group-hover:text-brand-300 transition-colors duration-300">
          {post.title}
        </h2>

        {/* Description */}
        <p className="font-body text-warm-grey leading-relaxed mb-6 max-w-2xl">
          {post.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-sm font-body text-dark-warm">
          <span>{formatDate(post.date)}</span>
          <span className="w-1 h-1 rounded-full bg-dark-warm" />
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {post.readingTime} min read
          </span>
        </div>

        {/* Arrow */}
        <div className="absolute bottom-8 right-8 md:bottom-10 md:right-10 w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center group-hover:border-brand-500/30 group-hover:bg-brand-500/10 transition-all duration-300">
          <ArrowRight className="w-4 h-4 text-warm-grey group-hover:text-brand-400 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

/* ─── Post Card ─── */
function PostCard({ post, index }: { post: BlogPostMeta; index: number }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-brand-500/15 hover:bg-white/[0.04] transition-all duration-400"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Category */}
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium border mb-4 ${getCategoryStyle(post.category)}`}>
        {post.category}
      </span>

      {/* Title */}
      <h3 className="font-display text-lg text-white leading-snug mb-3 group-hover:text-brand-300 transition-colors duration-300">
        {post.title}
      </h3>

      {/* Description */}
      <p className="font-body text-sm text-warm-grey leading-relaxed mb-4 line-clamp-2">
        {post.description}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs font-body text-dark-warm">
        <span>{formatDate(post.date)}</span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {post.readingTime} min
        </span>
      </div>

      {/* Read more hint */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center gap-1.5 text-xs font-sans font-medium text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        Read article
        <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

/* ─── Main Blog Page ─── */
export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadPosts() {
      try {
        // Fetch from combined API endpoint
        const res = await fetch('/api/blog/list');
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch {
        // Fallback — no posts loaded
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  // Extract categories
  const categories = ['All', ...Array.from(new Set(posts.map(p => p.category)))];

  // Filter posts
  const filtered = posts.filter(p => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const featured = filtered.filter(p => p.featured);
  const regular = filtered.filter(p => !p.featured);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/3 w-[600px] h-[400px] bg-brand-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-brand-600/[0.03] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl text-white leading-[1.1] mb-4">
            The Apelier Blog
          </h1>
          <p className="text-lg font-body text-warm-grey max-w-2xl mx-auto leading-relaxed">
            Honest guides, tool comparisons, and workflow tips for photographers who'd rather be shooting than stuck at a desk editing.
          </p>
        </div>
      </section>

      {/* Filters */}
      <Section>
        <div className="max-w-5xl mx-auto px-6 mb-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-sans font-medium border transition-all duration-200 ${
                    activeCategory === cat
                      ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                      : 'bg-white/[0.03] text-dark-warm border-white/[0.08] hover:border-white/[0.15] hover:text-warm-grey'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-warm" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm font-body text-white placeholder:text-dark-warm focus:outline-none focus:border-brand-500/30 transition-colors"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Featured posts */}
      {featured.length > 0 && (
        <Section>
          <div className="max-w-5xl mx-auto px-6 mb-12">
            <div className="grid gap-6">
              {featured.map((post) => (
                <FeaturedCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* All posts grid */}
      <Section>
        <div className="max-w-5xl mx-auto px-6 pb-24">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse">
                  <div className="w-20 h-5 bg-white/[0.06] rounded-full mb-4" />
                  <div className="w-full h-6 bg-white/[0.06] rounded mb-2" />
                  <div className="w-3/4 h-6 bg-white/[0.06] rounded mb-4" />
                  <div className="w-full h-4 bg-white/[0.04] rounded mb-2" />
                  <div className="w-2/3 h-4 bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
          ) : regular.length > 0 ? (
            <>
              {featured.length > 0 && (
                <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-warm-grey mb-6">
                  All Articles
                </h2>
              )}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {regular.map((post, i) => (
                  <PostCard key={post.slug} post={post} index={i} />
                ))}
              </div>
            </>
          ) : filtered.length === 0 && !loading ? (
            <div className="text-center py-16">
              <p className="font-body text-warm-grey text-lg mb-2">No articles found</p>
              <p className="font-body text-dark-warm text-sm">
                {searchQuery ? 'Try a different search term.' : 'Check back soon — we\'re writing new content regularly.'}
              </p>
            </div>
          ) : null}
        </div>
      </Section>

      {/* CTA Section */}
      <section className="border-t border-white/[0.04] py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-2xl md:text-3xl text-white mb-4">
            Ready to simplify your workflow?
          </h2>
          <p className="font-body text-warm-grey mb-8 max-w-xl mx-auto">
            Apelier combines CRM, AI editing, and gallery delivery in one platform. Stop juggling tools — start delivering galleries faster.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all duration-300 shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02]"
          >
            Start Free — 14 Days, No Card
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}

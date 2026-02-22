'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MarketingLayout } from '@/components/marketing/marketing-layout';
import { ArrowLeft, ArrowRight, Clock, Calendar, Tag, Share2, ChevronRight } from 'lucide-react';

/* ─── Types ─── */
interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  featured: boolean;
  content: string;
  source: 'file' | 'supabase';
  seoTitle?: string;
  seoDescription?: string;
}

/* ─── Simple Markdown → HTML renderer ─── */
function renderMarkdown(md: string): string {
  let html = md;

  // Escape HTML (but not our own tags)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-10 border-white/[0.06]" />');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-\s:|]+\|)\n((?:\|.+\|\n?)*)/gm, (_match, header: string, _sep: string, body: string) => {
    const headers = header.split('|').filter((c: string) => c.trim()).map((c: string) =>
      `<th class="px-4 py-3 text-left text-xs font-sans font-semibold uppercase tracking-wider text-brand-300">${c.trim()}</th>`
    ).join('');
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) =>
        `<td class="px-4 py-3 text-sm font-body text-warm-grey border-t border-white/[0.04]">${c.trim()}</td>`
      ).join('');
      return `<tr class="hover:bg-white/[0.02]">${cells}</tr>`;
    }).join('');
    return `<div class="overflow-x-auto my-8 rounded-lg border border-white/[0.06]"><table class="w-full"><thead class="bg-white/[0.03]"><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-display text-lg text-white mt-10 mb-4">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-display text-xl md:text-2xl text-white mt-12 mb-5">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-display text-2xl md:text-3xl text-white mt-12 mb-6">$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-white"><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="text-brand-300 not-italic">$1</em>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors" target="_blank" rel="noopener">$1</a>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.06] text-brand-300 text-sm font-mono">$1</code>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="flex gap-2 items-start mb-2"><span class="mt-2 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span><span class="font-body text-warm-grey leading-relaxed">$1</span></li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[\s\S]*?<\/li>\n?)+)/g, '<ul class="my-4 space-y-1">$1</ul>');

  // Ordered lists
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="flex gap-3 items-start mb-2"><span class="text-brand-400 font-sans font-semibold text-sm mt-0.5 shrink-0">$1.</span><span class="font-body text-warm-grey leading-relaxed">$2</span></li>');

  // Paragraphs — lines that aren't already wrapped in HTML
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, '<p class="font-body text-warm-grey leading-relaxed mb-4">$1</p>');

  // Clean up double line breaks
  html = html.replace(/\n\n+/g, '\n');

  return html;
}

/* ─── Format date ─── */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ─── Share button ─── */
function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/blog/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] text-xs font-sans font-medium text-warm-grey hover:text-white hover:border-white/[0.15] transition-all"
    >
      <Share2 className="w-3.5 h-3.5" />
      {copied ? 'Link copied!' : 'Share'}
    </button>
  );
}

/* ─── Blog Post Page ─── */
export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPost() {
      try {
        const res = await fetch(`/api/blog/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data.post);
          // Update page title
          if (data.post) {
            document.title = `${data.post.seoTitle || data.post.title} | Apelier`;
          }
        }
      } catch {
        // Post not found
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadPost();
  }, [slug]);

  if (loading) {
    return (
      <MarketingLayout>
        <div className="pt-32 pb-24 max-w-3xl mx-auto px-6">
          <div className="animate-pulse space-y-6">
            <div className="w-32 h-5 bg-white/[0.06] rounded-full" />
            <div className="w-full h-10 bg-white/[0.06] rounded" />
            <div className="w-3/4 h-10 bg-white/[0.06] rounded" />
            <div className="w-48 h-5 bg-white/[0.04] rounded" />
            <div className="space-y-3 pt-8">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-full h-4 bg-white/[0.04] rounded" />
              ))}
            </div>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  if (!post) {
    return (
      <MarketingLayout>
        <div className="pt-32 pb-24 max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-display text-3xl text-white mb-4">Post not found</h1>
          <p className="font-body text-warm-grey mb-8">This article doesn't exist or has been removed.</p>
          <Link href="/blog" className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300 font-sans text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to blog
          </Link>
        </div>
      </MarketingLayout>
    );
  }

  const renderedContent = renderMarkdown(post.content);

  return (
    <MarketingLayout>
      {/* Article header */}
      <article className="relative pt-28 pb-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-brand-500/[0.03] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-dark-warm hover:text-warm-grey font-sans text-sm font-medium mb-8 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All articles
          </Link>

          {/* Category + meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-medium border bg-brand-500/10 text-brand-400 border-brand-500/20">
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-body text-dark-warm">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-body text-dark-warm">
              <Clock className="w-3.5 h-3.5" />
              {post.readingTime} min read
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-[2.75rem] text-white leading-[1.15] mb-6">
            {post.title}
          </h1>

          {/* Description */}
          <p className="text-lg font-body text-warm-grey leading-relaxed mb-8 max-w-2xl">
            {post.description}
          </p>

          {/* Author + share */}
          <div className="flex items-center justify-between pb-8 mb-10 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-500/15 border border-brand-500/20 flex items-center justify-center">
                <span className="text-sm font-sans font-bold text-brand-400">
                  {post.author.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-sans font-medium text-white">{post.author}</p>
                <p className="text-xs font-body text-dark-warm">Apelier</p>
              </div>
            </div>
            <ShareButton title={post.title} slug={post.slug} />
          </div>

          {/* Article body */}
          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-12 pt-8 border-t border-white/[0.06]">
              <Tag className="w-3.5 h-3.5 text-dark-warm" />
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-sans font-medium bg-white/[0.04] text-dark-warm border border-white/[0.06]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-16 p-8 rounded-2xl border border-brand-500/15 bg-gradient-to-br from-brand-500/[0.06] to-transparent">
            <h3 className="font-display text-xl text-white mb-3">
              Ready to simplify your photography workflow?
            </h3>
            <p className="font-body text-warm-grey mb-6">
              Apelier combines CRM, AI editing, and gallery delivery in one platform. Founding members get 30% off for life.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-sans font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-all duration-300 shadow-lg shadow-brand-500/20"
            >
              Start Free — 14 Days, No Card
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Back to blog */}
          <div className="mt-12 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300 font-sans text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to all articles
            </Link>
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
}

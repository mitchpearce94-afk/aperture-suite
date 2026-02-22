import { NextResponse } from 'next/server';
import { getAllBlogPosts } from '@/lib/blog';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Get file-based posts (MDX from /content/blog/)
    const filePosts = getAllBlogPosts().map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      date: p.date,
      author: p.author,
      category: p.category,
      tags: p.tags,
      readingTime: p.readingTime,
      featured: p.featured || false,
      source: 'file' as const,
    }));

    // 2. Get Supabase posts (published only)
    let supabasePosts: any[] = [];
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const supabase = createClient(url, key);
        const { data } = await supabase
          .from('blog_posts')
          .select('slug, title, description, published_at, author, category, tags, reading_time, featured')
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (data) {
          supabasePosts = data.map((p) => ({
            slug: p.slug,
            title: p.title,
            description: p.description || '',
            date: p.published_at || '',
            author: p.author || 'Apelier',
            category: p.category || 'General',
            tags: p.tags || [],
            readingTime: p.reading_time || 5,
            featured: p.featured || false,
            source: 'supabase' as const,
          }));
        }
      }
    } catch {
      // Supabase table might not exist yet — that's fine, just use file posts
    }

    // 3. Merge — Supabase wins on slug conflicts (it's the more up-to-date source)
    const slugSet = new Set(supabasePosts.map((p) => p.slug));
    const merged = [
      ...supabasePosts,
      ...filePosts.filter((p) => !slugSet.has(p.slug)),
    ];

    // Sort by date descending
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ posts: merged });
  } catch (err) {
    console.error('[blog/list] error:', err);
    return NextResponse.json({ posts: [] });
  }
}

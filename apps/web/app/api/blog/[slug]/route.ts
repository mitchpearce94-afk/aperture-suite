import { NextRequest, NextResponse } from 'next/server';
import { getBlogPost } from '@/lib/blog';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  try {
    // 1. Try file-based post first
    const filePost = getBlogPost(slug);
    if (filePost) {
      return NextResponse.json({
        post: {
          ...filePost,
          source: 'file',
        },
      });
    }

    // 2. Try Supabase
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (data) {
        return NextResponse.json({
          post: {
            slug: data.slug,
            title: data.title,
            description: data.description || '',
            date: data.published_at || data.created_at,
            author: data.author || 'Apelier',
            category: data.category || 'General',
            tags: data.tags || [],
            readingTime: data.reading_time || 5,
            featured: data.featured || false,
            content: data.content,
            seoTitle: data.seo_title,
            seoDescription: data.seo_description,
            source: 'supabase',
          },
        });
      }
    }

    // Not found
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  } catch (err) {
    console.error('[blog/slug] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

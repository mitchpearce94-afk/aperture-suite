import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing env vars: URL=${!!url}, SERVICE_KEY=${!!key}`);
  }
  return createClient(url, key);
}

/* ─── GET: List published blog posts from Supabase ─── */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'published';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getAdminClient();

    let query = supabase
      .from('blog_posts')
      .select('id, slug, title, description, author, category, tags, image_url, status, publish_at, published_at, reading_time, featured, created_at, updated_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Public requests only see published posts
    // Service role (ClawBot) can pass ?status=all to see everything
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ─── POST: Create or update a blog post (for ClawBot) ─── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug, title, description, content, author, category, tags,
      image_url, status, publish_at, seo_title, seo_description,
      reading_time, featured,
    } = body;

    if (!slug || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, title, content' },
        { status: 400 }
      );
    }

    // Calculate reading time if not provided
    const calcReadingTime = reading_time || Math.max(1, Math.round(content.split(/\s+/).length / 230));

    const supabase = getAdminClient();

    // Upsert — if slug exists, update it; otherwise create
    const postData: any = {
      slug,
      title,
      description: description || '',
      content,
      author: author || 'Apelier',
      category: category || 'General',
      tags: tags || [],
      image_url: image_url || null,
      status: status || 'draft',
      publish_at: publish_at || null,
      seo_title: seo_title || null,
      seo_description: seo_description || null,
      reading_time: calcReadingTime,
      featured: featured || false,
      updated_at: new Date().toISOString(),
    };

    // If publishing now, set published_at
    if (status === 'published' && !body.published_at) {
      postData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .upsert(postData, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ post: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/* ─── DELETE: Remove a blog post by slug ─── */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('slug', slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: slug });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

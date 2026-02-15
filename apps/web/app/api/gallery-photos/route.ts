import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to generate signed URLs (client gallery is unauthenticated)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SIGNED_URL_EXPIRY = 3600; // 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const galleryId = searchParams.get('gallery_id');
  const action = searchParams.get('action') || 'photos';

  if (!galleryId) {
    return NextResponse.json({ error: 'Missing gallery_id' }, { status: 400 });
  }

  try {
    // Verify gallery exists and is in a viewable state
    const { data: gallery, error: gError } = await supabaseAdmin
      .from('galleries')
      .select('id, status')
      .eq('id', galleryId)
      .single();

    if (gError || !gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }

    if (!['ready', 'delivered', 'published'].includes(gallery.status)) {
      return NextResponse.json({ error: 'Gallery not available' }, { status: 403 });
    }

    if (action === 'download') {
      // Generate a signed URL for a specific photo download
      const photoId = searchParams.get('photo_id');
      const resolution = searchParams.get('resolution') || 'web'; // 'web' or 'full'

      if (!photoId) {
        return NextResponse.json({ error: 'Missing photo_id' }, { status: 400 });
      }

      const { data: photo } = await supabaseAdmin
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .eq('gallery_id', galleryId)
        .single();

      if (!photo) {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      }

      const key = resolution === 'full' ? (photo.edited_key || photo.web_key) : (photo.web_key || photo.edited_key);
      if (!key) {
        return NextResponse.json({ error: 'No file available' }, { status: 404 });
      }

      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(key, SIGNED_URL_EXPIRY, { download: photo.filename || 'photo.jpg' });

      if (signError || !signedData?.signedUrl) {
        return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
      }

      return NextResponse.json({ url: signedData.signedUrl });
    }

    if (action === 'download_all') {
      // Generate signed download URLs for all photos in gallery
      const resolution = searchParams.get('resolution') || 'web';

      const { data: photos } = await supabaseAdmin
        .from('photos')
        .select('id, filename, web_key, edited_key')
        .eq('gallery_id', galleryId)
        .in('status', ['edited', 'approved', 'delivered'])
        .order('sort_order', { ascending: true });

      if (!photos || photos.length === 0) {
        return NextResponse.json({ error: 'No photos available' }, { status: 404 });
      }

      const keys = photos.map((p) => {
        const key = resolution === 'full' ? (p.edited_key || p.web_key) : (p.web_key || p.edited_key);
        return key;
      }).filter(Boolean);

      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrls(keys as string[], SIGNED_URL_EXPIRY, { download: true });

      if (signError || !signedData) {
        return NextResponse.json({ error: 'Failed to generate download URLs' }, { status: 500 });
      }

      const downloads = photos.map((p, i) => ({
        id: p.id,
        filename: p.filename,
        url: signedData[i]?.signedUrl || null,
      })).filter((d) => d.url);

      return NextResponse.json({ downloads });
    }

    // Default: return photos with signed thumbnail + web URLs for display
    const { data: photos, error: pError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .eq('gallery_id', galleryId)
      .in('status', ['edited', 'approved', 'delivered'])
      .order('sort_order', { ascending: true });

    if (pError || !photos) {
      return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 });
    }

    // Collect all keys for batch signing
    const allKeys: string[] = [];
    for (const p of photos) {
      if (p.thumb_key) allKeys.push(p.thumb_key);
      if (p.web_key) allKeys.push(p.web_key);
    }

    const urlMap = new Map<string, string>();
    // Batch sign in groups of 100
    for (let i = 0; i < allKeys.length; i += 100) {
      const batch = allKeys.slice(i, i + 100);
      const { data: signedBatch } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrls(batch, SIGNED_URL_EXPIRY);

      if (signedBatch) {
        for (const item of signedBatch) {
          if (item.signedUrl && item.path) {
            urlMap.set(item.path, item.signedUrl);
          }
        }
      }
    }

    // Attach URLs to photos
    const photosWithUrls = photos.map((p) => ({
      ...p,
      thumb_url: p.thumb_key ? urlMap.get(p.thumb_key) || null : null,
      web_url: p.web_key ? urlMap.get(p.web_key) || null : null,
    }));

    return NextResponse.json({ photos: photosWithUrls });

  } catch (err) {
    console.error('Gallery photos API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

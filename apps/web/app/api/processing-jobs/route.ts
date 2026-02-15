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

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { action, job_id } = body;

    console.log('[processing-jobs API]', action, job_id || '');

    if (action === 'mark_delivered') {
      if (!job_id) {
        return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('processing_jobs')
        .update({ status: 'delivered', completed_at: new Date().toISOString() })
        .eq('id', job_id)
        .select('id, status');

      console.log('[mark_delivered] result:', data, 'error:', error);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, updated: data });
    }

    if (action === 'send_to_gallery') {
      const { processing_job_id, gallery_id, auto_deliver } = body;
      
      if (!processing_job_id || !gallery_id) {
        return NextResponse.json({ error: 'Missing processing_job_id or gallery_id' }, { status: 400 });
      }

      const results: Record<string, any> = {};

      // 1. Update all approved/edited photos to 'delivered'
      const { data: updatedPhotos, error: photoErr } = await supabaseAdmin
        .from('photos')
        .update({ status: 'delivered' })
        .eq('gallery_id', gallery_id)
        .in('status', ['approved', 'edited', 'uploaded', 'processing'])
        .select('id');
      results.photos = { updated: updatedPhotos?.length || 0, error: photoErr?.message };

      // 2. Update gallery status
      const newGalleryStatus = auto_deliver ? 'delivered' : 'ready';
      const { error: galErr } = await supabaseAdmin
        .from('galleries')
        .update({ status: newGalleryStatus })
        .eq('id', gallery_id);
      results.gallery = { status: newGalleryStatus, error: galErr?.message };

      // 3. Find and update the job
      // First try: gallery.job_id
      const { data: galData } = await supabaseAdmin
        .from('galleries')
        .select('job_id')
        .eq('id', gallery_id)
        .single();
      
      let jobId = galData?.job_id;
      console.log('[send_to_gallery] gallery job_id:', jobId);

      // Fallback: find job that references this gallery
      if (!jobId) {
        const { data: jobData } = await supabaseAdmin
          .from('jobs')
          .select('id')
          .eq('gallery_id', gallery_id)
          .limit(1)
          .single();
        jobId = jobData?.id;
        console.log('[send_to_gallery] fallback job lookup:', jobId);
      }

      // Fallback 2: find job linked to this gallery via galleries table
      if (!jobId) {
        const { data: jobsWithGallery } = await supabaseAdmin
          .from('galleries')
          .select('id, job_id')
          .eq('id', gallery_id)
          .single();
        console.log('[send_to_gallery] gallery record:', jobsWithGallery);
      }

      if (jobId) {
        const newJobStatus = auto_deliver ? 'delivered' : 'edited';
        const { data: jobResult, error: jobErr } = await supabaseAdmin
          .from('jobs')
          .update({ status: newJobStatus })
          .eq('id', jobId)
          .select('id, status');
        results.job = { id: jobId, status: newJobStatus, updated: jobResult, error: jobErr?.message };
      } else {
        results.job = { error: 'No job_id found for this gallery' };
      }

      // 4. Delete the processing job
      const { error: pjErr } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .eq('id', processing_job_id);
      results.processing_job = { deleted: !pjErr, error: pjErr?.message };

      console.log('[send_to_gallery] ALL results:', JSON.stringify(results));

      return NextResponse.json({ success: true, results });
    }

    if (action === 'update_job_status') {
      // Update a job's status using service role (bypasses RLS)
      const { target_job_id, status } = body;
      if (!target_job_id || !status) {
        return NextResponse.json({ error: 'Missing target_job_id or status' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('jobs')
        .update({ status })
        .eq('id', target_job_id)
        .select('id, status');

      console.log('[update_job_status]', target_job_id, status, 'result:', data, 'error:', error);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, updated: data });
    }

    if (action === 'delete') {
      if (!job_id) {
        return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
      }
      const { data, error } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .eq('id', job_id)
        .select('id');

      console.log('[delete] result:', data, 'error:', error);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deleted: data?.length || 0 });
    }

    if (action === 'clear_all') {
      // Delete all non-active processing jobs
      const { data, error } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .in('status', ['completed', 'delivered', 'failed', 'error'])
        .select('id');

      console.log('[clear_all] deleted:', data?.length, 'error:', error);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deleted: data?.length || 0 });
    }

    if (action === 'clear_force') {
      // Delete ALL processing jobs regardless of status
      const { data, error } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id');

      console.log('[clear_force] deleted:', data?.length, 'error:', error);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, deleted: data?.length || 0 });
    }

    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[processing-jobs API] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

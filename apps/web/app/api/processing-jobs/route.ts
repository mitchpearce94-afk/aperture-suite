import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const sb = createServerSupabaseClient();
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { action, job_id } = body;

    if (action === 'mark_delivered') {
      // Mark a specific job as delivered
      const { error } = await supabaseAdmin
        .from('processing_jobs')
        .update({ status: 'delivered' })
        .eq('id', job_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      // Delete a specific job
      const { error } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .eq('id', job_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'clear_completed') {
      // Delete all completed/delivered jobs for this user's photographer account
      const { data: photographer } = await supabaseAdmin
        .from('photographers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!photographer) {
        return NextResponse.json({ error: 'No photographer profile' }, { status: 404 });
      }

      const { data: deleted, error } = await supabaseAdmin
        .from('processing_jobs')
        .delete()
        .eq('photographer_id', photographer.id)
        .in('status', ['completed', 'delivered'])
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, deleted: deleted?.length || 0 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Processing jobs cleanup error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

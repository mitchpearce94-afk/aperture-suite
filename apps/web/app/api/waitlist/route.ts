import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email, name, business_name, source } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await sb
      .from('waitlist')
      .upsert(
        { email: email.toLowerCase().trim(), name, business_name, source: source || 'website' },
        { onConflict: 'email' },
      )
      .select('id, email')
      .single();

    if (error) {
      console.error('Waitlist insert error:', error);
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error('Waitlist route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

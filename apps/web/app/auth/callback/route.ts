import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if photographer profile exists, create if not (first OAuth login)
      const { data: existing } = await supabase
        .from('photographers')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .single();

      if (!existing) {
        const meta = data.user.user_metadata;
        const name = meta?.full_name || meta?.name || `${meta?.first_name || ''} ${meta?.last_name || ''}`.trim() || data.user.email?.split('@')[0] || 'Photographer';

        await supabase.from('photographers').insert({
          auth_user_id: data.user.id,
          email: data.user.email,
          name,
          business_name: null,
          subscription_tier: 'free',
          subscription_status: 'trialing',
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

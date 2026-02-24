import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { photographerId, returnUrl } = await request.json();

    if (!photographerId) {
      return NextResponse.json({ error: 'Missing photographerId' }, { status: 400 });
    }

    // Get photographer's Stripe customer ID
    const { data: photographer } = await supabaseAdmin
      .from('photographers')
      .select('stripe_customer_id')
      .eq('id', photographerId)
      .single();

    if (!photographer?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 400 });
    }

    const baseUrl = returnUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://apelier.com.au';

    const session = await stripe.billingPortal.sessions.create({
      customer: photographer.stripe_customer_id,
      return_url: `${baseUrl}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

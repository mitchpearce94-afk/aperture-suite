import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, TIER_CONFIG, SubscriptionTier, FREE_TRIAL_DAYS } from '@/lib/stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { tier, photographerId, email, returnUrl } = await request.json();

    if (!tier || !photographerId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!TIER_CONFIG[tier as Exclude<SubscriptionTier, 'free_trial'>]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const tierConfig = TIER_CONFIG[tier as Exclude<SubscriptionTier, 'free_trial'>];

    // Check if photographer already has a Stripe customer ID
    const { data: photographer } = await supabaseAdmin
      .from('photographers')
      .select('stripe_customer_id, subscription_tier, subscription_status')
      .eq('id', photographerId)
      .single();

    let customerId = photographer?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { photographer_id: photographerId },
      });
      customerId = customer.id;

      // Save customer ID immediately
      await supabaseAdmin
        .from('photographers')
        .update({ stripe_customer_id: customerId })
        .eq('id', photographerId);
    }

    // Build checkout session params
    const baseUrl = returnUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://apelier.com.au';

    const sessionParams: any = {
      customer: customerId,
      line_items: [{ price: tierConfig.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings?tab=billing&canceled=true`,
      metadata: {
        photographer_id: photographerId,
        tier,
      },
      subscription_data: {
        metadata: {
          photographer_id: photographerId,
          tier,
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

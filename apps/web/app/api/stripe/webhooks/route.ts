import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, getTierFromPriceId } from '@/lib/stripe';
import Stripe from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`Webhook handler error for ${event.type}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- checkout.session.completed ---
// Fires when a customer completes Stripe Checkout
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const photographerId = session.metadata?.photographer_id;
  const tier = session.metadata?.tier;

  if (!photographerId || !tier) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  // Get the subscription ID from the session
  const subscriptionId = session.subscription as string;

  await supabaseAdmin
    .from('photographers')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscriptionId,
      subscription_tier: tier,
      subscription_status: 'active',
      billing_interval: 'month',
    })
    .eq('id', photographerId);

  console.log(`✅ Checkout complete: photographer ${photographerId} → ${tier}`);
}

// --- invoice.paid ---
// Fires on successful payment (including renewals)
// Reset monthly edit counter on each successful payment
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: photographer } = await supabaseAdmin
    .from('photographers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!photographer) {
    console.log('No photographer found for customer:', customerId);
    return;
  }

  // Reset edit counter on each billing cycle payment
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabaseAdmin
    .from('photographers')
    .update({
      subscription_status: 'active',
      images_edited_count: 0,
      billing_period_start: now.toISOString(),
      billing_period_end: periodEnd.toISOString(),
    })
    .eq('id', photographer.id);

  console.log(`✅ Invoice paid: photographer ${photographer.id}, edit counter reset`);
}

// --- customer.subscription.updated ---
// Fires on plan changes, trial end, payment method updates, etc.
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: photographer } = await supabaseAdmin
    .from('photographers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!photographer) {
    console.log('No photographer found for customer:', customerId);
    return;
  }

  // Determine tier from the subscription's price
  const priceId = subscription.items.data[0]?.price?.id;
  const tier = priceId ? getTierFromPriceId(priceId) : null;

  const updateData: any = {
    subscription_status: subscription.status === 'trialing' ? 'trialing' :
                         subscription.status === 'active' ? 'active' :
                         subscription.status === 'past_due' ? 'past_due' :
                         subscription.status === 'canceled' ? 'canceled' : 'unpaid',
    stripe_subscription_id: subscription.id,
  };

  if (tier) {
    updateData.subscription_tier = tier;
  }

  // If subscription has trial_end, store it
  if (subscription.trial_end) {
    updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
  }

  await supabaseAdmin
    .from('photographers')
    .update(updateData)
    .eq('id', photographer.id);

  console.log(`✅ Subscription updated: photographer ${photographer.id} → ${tier || 'unchanged'} (${updateData.subscription_status})`);
}

// --- customer.subscription.deleted ---
// Fires when subscription is fully canceled
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: photographer } = await supabaseAdmin
    .from('photographers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!photographer) {
    console.log('No photographer found for customer:', customerId);
    return;
  }

  await supabaseAdmin
    .from('photographers')
    .update({
      subscription_status: 'canceled',
      stripe_subscription_id: null,
    })
    .eq('id', photographer.id);

  console.log(`✅ Subscription deleted: photographer ${photographer.id} → canceled`);
}

// --- invoice.payment_failed ---
// Fires when a payment attempt fails (Stripe will auto-retry via Smart Retries)
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: photographer } = await supabaseAdmin
    .from('photographers')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!photographer) return;

  await supabaseAdmin
    .from('photographers')
    .update({ subscription_status: 'past_due' })
    .eq('id', photographer.id);

  console.log(`⚠️ Payment failed: photographer ${photographer.id} → past_due`);
}

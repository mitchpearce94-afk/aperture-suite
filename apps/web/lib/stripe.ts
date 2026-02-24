import Stripe from 'stripe';

// --- Stripe client (server-side only) ---
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// --- Tier definitions ---
export type SubscriptionTier = 'free_trial' | 'starter' | 'pro' | 'studio';

export interface TierConfig {
  name: string;
  priceId: string;
  productId: string;
  monthlyPrice: number; // AUD cents
  editLimit: number;
  features: string[];
}

export const TIER_CONFIG: Record<Exclude<SubscriptionTier, 'free_trial'>, TierConfig> = {
  starter: {
    name: 'Starter',
    priceId: 'price_1T4HP9GnwGOkt6wQSbArLPu3',
    productId: 'prod_U2M7a9IU0gXDRv',
    monthlyPrice: 3900,
    editLimit: 2_000,
    features: [
      'AI photo editing (2,000/mo)',
      'CRM & job management',
      'Client galleries',
      'E-sign contracts',
      'Automated invoicing',
      'Email automations',
    ],
  },
  pro: {
    name: 'Pro',
    priceId: 'price_1T4HPZGnwGOkt6wQSj6yYzeu',
    productId: 'prod_U2M7PWgIqcbb2D',
    monthlyPrice: 10900,
    editLimit: 10_000,
    features: [
      'AI photo editing (10,000/mo)',
      'Everything in Starter',
      'Priority processing',
      'Custom branding',
      'Advanced analytics',
    ],
  },
  studio: {
    name: 'Studio',
    priceId: 'price_1T4HQ9GnwGOkt6wQ4WkBsIPG',
    productId: 'prod_U2M8VmcZOHuryl',
    monthlyPrice: 27900,
    editLimit: 25_000,
    features: [
      'AI photo editing (25,000/mo)',
      'Everything in Pro',
      'Team members (coming soon)',
      'White-label galleries',
      'Dedicated support',
    ],
  },
};

export const FREE_TRIAL_EDIT_LIMIT = 50;
export const FREE_TRIAL_DAYS = 14;

// --- Helper: Get edit limit for a tier ---
export function getEditLimit(tier: SubscriptionTier): number {
  if (!tier || tier === 'free_trial') return FREE_TRIAL_EDIT_LIMIT;
  return TIER_CONFIG[tier]?.editLimit ?? FREE_TRIAL_EDIT_LIMIT;
}

// --- Helper: Get tier from Stripe price ID ---
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    if (config.priceId === priceId) return tier as SubscriptionTier;
  }
  return null;
}

// --- Helper: Get tier from Stripe product ID ---
export function getTierFromProductId(productId: string): SubscriptionTier | null {
  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    if (config.productId === productId) return tier as SubscriptionTier;
  }
  return null;
}

// --- Helper: Check if photographer can process more images ---
export function canProcessImages(
  tier: SubscriptionTier,
  subscriptionStatus: string,
  imagesEditedCount: number,
  trialEndsAt: string | null
): { allowed: boolean; reason?: string; limit: number; used: number } {
  const limit = getEditLimit(tier);
  const used = imagesEditedCount;

  // Check trial expiry
  if (tier === 'free_trial') {
    if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
      return { allowed: false, reason: 'Your free trial has expired. Please subscribe to continue editing.', limit, used };
    }
  }

  // Check subscription status
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'unpaid') {
    return { allowed: false, reason: 'Your subscription is inactive. Please resubscribe to continue editing.', limit, used };
  }

  // Check edit limit
  if (used >= limit) {
    return {
      allowed: false,
      reason: tier === 'free_trial'
        ? `You've used all ${limit} free trial edits. Subscribe to unlock more.`
        : `You've reached your ${limit.toLocaleString()} edit limit this month. Upgrade your plan for more.`,
      limit,
      used,
    };
  }

  return { allowed: true, limit, used };
}

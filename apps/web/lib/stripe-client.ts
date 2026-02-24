// Client-safe Stripe config — no secret key, just tier definitions
// Import this in 'use client' components. Import stripe.ts in server routes only.

export type SubscriptionTier = 'free_trial' | 'starter' | 'pro' | 'studio';

export interface TierConfig {
  name: string;
  priceId: string;
  productId: string;
  monthlyPrice: number;
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

export function getEditLimit(tier: SubscriptionTier): number {
  if (!tier || tier === 'free_trial') return FREE_TRIAL_EDIT_LIMIT;
  return TIER_CONFIG[tier]?.editLimit ?? FREE_TRIAL_EDIT_LIMIT;
}

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIER_CONFIG, FREE_TRIAL_EDIT_LIMIT, getEditLimit, type SubscriptionTier } from '@/lib/stripe-client';

interface BillingProps {
  photographerId: string;
}

export default function BillingSection({ photographerId }: BillingProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<{
    subscription_tier: SubscriptionTier;
    subscription_status: string;
    images_edited_count: number;
    billing_period_start: string | null;
    billing_period_end: string | null;
    trial_ends_at: string | null;
    email: string;
  } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    const { data } = await supabase
      .from('photographers')
      .select('subscription_tier, subscription_status, images_edited_count, billing_period_start, billing_period_end, trial_ends_at, email')
      .eq('id', photographerId)
      .single();

    if (data) setBillingData(data as any);
    setLoading(false);
  }

  async function handleSubscribe(tier: string) {
    setActionLoading(tier);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          photographerId,
          email: billingData?.email,
          returnUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      alert('Failed to connect to payment provider');
    }
    setActionLoading(null);
  }

  async function handleManageBilling() {
    setActionLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photographerId,
          returnUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
      }
    } catch (err) {
      alert('Failed to connect to billing portal');
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-white">Billing & Subscription</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-white/5 rounded-xl" />
          <div className="h-48 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!billingData) return null;

  const tier = billingData.subscription_tier as SubscriptionTier;
  const status = billingData.subscription_status;
  const editLimit = getEditLimit(tier);
  const editCount = billingData.images_edited_count || 0;
  const editPercent = Math.min(100, Math.round((editCount / editLimit) * 100));
  const isTrialing = tier === 'free_trial';
  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';

  // Trial days remaining
  let trialDaysLeft = 0;
  if (isTrialing && billingData.trial_ends_at) {
    trialDaysLeft = Math.max(0, Math.ceil(
      (new Date(billingData.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
  }

  const tierDisplay = isTrialing ? 'Free Trial' :
    tier === 'starter' ? 'Starter' :
    tier === 'pro' ? 'Pro' :
    tier === 'studio' ? 'Studio' : tier;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-white">Billing & Subscription</h2>

      {/* Current Plan Card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">{tierDisplay}</h3>
              <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                isPastDue ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {isPastDue ? 'Payment Due' : status}
              </span>
            </div>
            {isTrialing && (
              <p className="text-sm text-amber-400 mt-1">
                {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining` : 'Trial expired'}
              </p>
            )}
            {!isTrialing && isActive && (
              <p className="text-sm text-zinc-400 mt-1">
                ${(TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.monthlyPrice || 0) / 100}/month
              </p>
            )}
          </div>
          {!isTrialing && isActive && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="px-4 py-2 text-sm font-medium text-zinc-300 border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'portal' ? 'Opening...' : 'Manage Billing'}
            </button>
          )}
        </div>

        {/* Usage Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">AI edits this month</span>
            <span className="text-sm font-medium text-zinc-300">
              {editCount.toLocaleString()} / {editLimit.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                editPercent >= 90 ? 'bg-red-500' :
                editPercent >= 70 ? 'bg-amber-500' :
                'bg-amber-500'
              }`}
              style={{ width: `${editPercent}%` }}
            />
          </div>
          {editPercent >= 90 && (
            <p className="text-xs text-red-400 mt-1.5">
              {editPercent >= 100 ? 'Edit limit reached. ' : 'Approaching edit limit. '}
              {tier !== 'studio' && 'Upgrade for more edits.'}
            </p>
          )}
        </div>

        {/* Billing Period */}
        {billingData.billing_period_start && billingData.billing_period_end && (
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>Billing period: {new Date(billingData.billing_period_start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} — {new Date(billingData.billing_period_end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}
      </div>

      {/* Plan Selection */}
      {(isTrialing || status === 'canceled') && (
        <div>
          <h3 className="text-base font-medium text-white mb-4">
            {isTrialing ? 'Choose a plan to continue after your trial' : 'Reactivate your subscription'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['starter', 'pro', 'studio'] as const).map((t) => {
              const config = TIER_CONFIG[t];
              const isPopular = t === 'pro';
              return (
                <div
                  key={t}
                  className={`relative rounded-xl border p-5 space-y-4 transition-all ${
                    isPopular
                      ? 'border-amber-500/30 bg-amber-500/[0.04]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-2.5 left-4 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Most Popular
                    </span>
                  )}
                  <div>
                    <h4 className="text-lg font-semibold text-white">{config.name}</h4>
                    <p className="text-2xl font-bold text-white mt-1">
                      ${config.monthlyPrice / 100}<span className="text-sm font-normal text-zinc-400">/mo</span>
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {config.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                        <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscribe(t)}
                    disabled={actionLoading === t}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                      isPopular
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {actionLoading === t ? 'Redirecting...' : `Subscribe to ${config.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade prompt for paid tiers (not studio) */}
      {isActive && !isTrialing && tier !== 'studio' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-sm text-zinc-400 mb-3">
            Need more edits? Upgrade your plan for higher limits and additional features.
          </p>
          <button
            onClick={handleManageBilling}
            disabled={actionLoading === 'portal'}
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'portal' ? 'Opening...' : 'Upgrade Plan'}
          </button>
        </div>
      )}
    </div>
  );
}

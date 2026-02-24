import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { canProcessImages, type SubscriptionTier } from '@/lib/stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/stripe/check-tier?photographerId=xxx&imageCount=50
// Returns whether the photographer can process the requested number of images
export async function GET(request: NextRequest) {
  try {
    const photographerId = request.nextUrl.searchParams.get('photographerId');
    const imageCount = parseInt(request.nextUrl.searchParams.get('imageCount') || '0');

    if (!photographerId) {
      return NextResponse.json({ error: 'Missing photographerId' }, { status: 400 });
    }

    const { data: photographer, error } = await supabaseAdmin
      .from('photographers')
      .select('subscription_tier, subscription_status, images_edited_count, trial_ends_at')
      .eq('id', photographerId)
      .single();

    if (error || !photographer) {
      return NextResponse.json({ error: 'Photographer not found' }, { status: 404 });
    }

    const result = canProcessImages(
      photographer.subscription_tier as SubscriptionTier,
      photographer.subscription_status,
      photographer.images_edited_count || 0,
      photographer.trial_ends_at
    );

    // Also check if adding imageCount would exceed limit
    const wouldExceed = (photographer.images_edited_count || 0) + imageCount > result.limit;

    return NextResponse.json({
      ...result,
      imageCount,
      wouldExceed,
      tier: photographer.subscription_tier,
      status: photographer.subscription_status,
    });
  } catch (error: any) {
    console.error('Tier check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

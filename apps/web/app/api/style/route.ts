import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// AI Engine URL — Railway deployment or local dev
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, profile_id, photographer_id, name, description, reference_image_keys, settings } = body;

    if (action === 'create') {
      // Create and train a style profile via AI engine
      if (!photographer_id || !name || !reference_image_keys?.length) {
        return NextResponse.json(
          { error: 'Missing photographer_id, name, or reference_image_keys' },
          { status: 400 }
        );
      }

      const response = await fetch(`${AI_ENGINE_URL}/api/style/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photographer_id,
          name,
          description: description || null,
          reference_image_keys,
          settings: settings || null,
        }),
      });

      const result = await response.json();
      return NextResponse.json(result, { status: response.ok ? 200 : 500 });
    }

    if (action === 'status') {
      // Check training status
      if (!profile_id) {
        return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 });
      }

      const response = await fetch(`${AI_ENGINE_URL}/api/style/${profile_id}/status`);
      const result = await response.json();
      return NextResponse.json(result);
    }

    if (action === 'retrain') {
      // Re-train an existing profile
      if (!profile_id) {
        return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 });
      }

      const response = await fetch(`${AI_ENGINE_URL}/api/style/${profile_id}/retrain`, {
        method: 'POST',
      });
      const result = await response.json();
      return NextResponse.json(result, { status: response.ok ? 200 : 500 });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "create", "status", or "retrain".' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Style API error:', err);
    return NextResponse.json(
      { error: 'AI Engine is not reachable. Make sure it is running.' },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// AI Engine URL — Railway deployment or local dev
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action, profile_id, photographer_id, name, description,
      reference_image_keys, settings, preset_file_key, pairs,
    } = body;

    if (action === 'create') {
      // Create and train a style profile via AI engine (CPU histogram)
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
          preset_file_key: preset_file_key || null,
        }),
      });

      const result = await response.json();
      return NextResponse.json(result, { status: response.ok ? 200 : 500 });
    }

    if (action === 'train_neural') {
      // Create and train a neural LUT style profile via AI engine → Modal GPU
      if (!photographer_id || !name || !pairs?.length) {
        return NextResponse.json(
          { error: 'Missing photographer_id, name, or pairs' },
          { status: 400 }
        );
      }

      const response = await fetch(`${AI_ENGINE_URL}/api/style/create-neural`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photographer_id,
          name,
          description: description || null,
          reference_image_keys: reference_image_keys || [],
          pairs,
        }),
      });

      const result = await response.json();
      return NextResponse.json(result, { status: response.ok ? 200 : 500 });
    }

    if (action === 'status') {
      if (!profile_id) {
        return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 });
      }

      const response = await fetch(`${AI_ENGINE_URL}/api/style/${profile_id}/status`);
      const result = await response.json();
      return NextResponse.json(result);
    }

    if (action === 'retrain') {
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
      { error: 'Invalid action. Use "create", "train_neural", "status", or "retrain".' },
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

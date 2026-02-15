import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createAnonClient } from '@/lib/supabase/client';

// Simple password hashing using Web Crypto API (no extra deps)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_apelier_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST: Set or verify a gallery password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, gallery_id, password } = body;

    if (!gallery_id || !password) {
      return NextResponse.json({ error: 'Missing gallery_id or password' }, { status: 400 });
    }

    const hash = await hashPassword(password);

    if (action === 'set') {
      // Set password — requires auth (service role or authenticated user)
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        // Fall back to anon client — RLS will enforce auth
        const sb = createAnonClient();
        const { error } = await sb
          .from('galleries')
          .update({ password_hash: hash })
          .eq('id', gallery_id);
        if (error) {
          return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
        }
      } else {
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
        );
        const { error } = await sb
          .from('galleries')
          .update({ password_hash: hash })
          .eq('id', gallery_id);
        if (error) {
          return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'verify') {
      // Verify password — public access (anon)
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data: gallery, error } = await sb
        .from('galleries')
        .select('password_hash')
        .eq('id', gallery_id)
        .single();

      if (error || !gallery) {
        return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
      }

      // If no password hash set, accept any password (backwards compat)
      if (!gallery.password_hash) {
        return NextResponse.json({ success: true, valid: true });
      }

      const valid = gallery.password_hash === hash;
      return NextResponse.json({ success: true, valid });
    }

    return NextResponse.json({ error: 'Invalid action. Use "set" or "verify".' }, { status: 400 });

  } catch (err) {
    console.error('Gallery password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

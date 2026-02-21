import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SIGNED_URL_EXPIRY = 3600; // 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const photographerId = searchParams.get('photographer_id');

  if (!photographerId) {
    return NextResponse.json({ error: 'Missing photographer_id' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('photographers')
      .select('business_name, brand_settings, gallery_default_watermark')
      .eq('id', photographerId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Photographer not found' }, { status: 404 });
    }

    let logoUrl: string | null = null;
    const logoKey = (data.brand_settings as any)?.logo_key;

    if (logoKey) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(logoKey, SIGNED_URL_EXPIRY);
      if (signedData?.signedUrl) {
        logoUrl = signedData.signedUrl;
      }
    }

    return NextResponse.json({
      business_name: data.business_name,
      brand_settings: data.brand_settings,
      logo_url: logoUrl,
      show_watermark: (data as any).gallery_default_watermark ?? true,
    });
  } catch (err) {
    console.error('Gallery branding API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

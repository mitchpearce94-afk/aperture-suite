import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const sb = getServiceClient();

  const { data: lead, error } = await sb
    .from('leads')
    .select('status, job_type, preferred_date, location, quoted_amount, quoted_package_id, photographer_id')
    .eq('quote_token', token)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  }

  if (lead.status === 'booked') {
    return NextResponse.json({ error: 'Already accepted.', already_booked: true }, { status: 409 });
  }

  if (lead.status === 'lost') {
    return NextResponse.json({ error: 'This quote is no longer available.' }, { status: 410 });
  }

  // Get package info
  let packageName = lead.job_type || 'Photography Session';
  let includedImages: number | null = null;
  if (lead.quoted_package_id) {
    const { data: pkg } = await sb
      .from('packages')
      .select('name, included_images')
      .eq('id', lead.quoted_package_id)
      .single();
    if (pkg) {
      packageName = pkg.name;
      includedImages = pkg.included_images;
    }
  }

  // Get photographer business name
  const { data: photographer } = await sb
    .from('photographers')
    .select('business_name, name')
    .eq('id', lead.photographer_id)
    .single();

  return NextResponse.json({
    packageName,
    amount: lead.quoted_amount || 0,
    includedImages,
    preferredDate: lead.preferred_date,
    location: lead.location,
    businessName: photographer?.business_name || photographer?.name || '',
  });
}

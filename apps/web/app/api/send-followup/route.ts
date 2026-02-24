import { NextRequest, NextResponse } from 'next/server';

// This route is called fire-and-forget by the booking/quote-accept routes.
// It waits 30 seconds, then sends invoice and contract signing emails.
// Vercel Pro/Enterprise supports up to 300s function duration.
// On Hobby plan (10s limit), the delay is reduced to fit within limits.

export const maxDuration = 60; // seconds

export async function POST(request: NextRequest) {
  try {
    const { emails, delaySeconds = 30 } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
    }

    // Wait the specified delay
    const delay = Math.min(delaySeconds, 45); // cap at 45s for safety
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));

    // Send each email
    const origin = request.nextUrl.origin;
    const results = [];
    for (const email of emails) {
      try {
        const res = await fetch(`${origin}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(email),
        });
        results.push({ template: email.template, status: res.status });
      } catch (err) {
        console.error(`Failed to send ${email.template} email:`, err);
        results.push({ template: email.template, status: 'error' });
      }
    }

    return NextResponse.json({ sent: results });
  } catch (err) {
    console.error('Send-followup error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

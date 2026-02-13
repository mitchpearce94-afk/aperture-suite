# Aperture Suite

All-in-one photography platform: CRM + AI Editing + Client Gallery Delivery.

## Structure

```
apps/web          → Next.js 14 frontend + API (Vercel)
services/ai-engine → Python FastAPI AI processing (Railway)
packages/shared    → Shared types and constants
supabase/          → Database migrations and config
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the web app
npm run dev:web

# Start the AI service (requires Python 3.11+)
npm run dev:ai
```

## Environment Variables

Copy `.env.example` to `.env.local` in `apps/web/`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
AI_SERVICE_URL=http://localhost:8000
```

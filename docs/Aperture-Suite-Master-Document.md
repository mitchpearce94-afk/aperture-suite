# Aperture Suite — Master Document

**Project:** Aperture Suite — All-in-One Photography Platform  
**Owner:** Mitchell Pearce  
**Working Name:** Aperture Suite (subject to change before launch)  
**Created:** February 13, 2026  
**Last Updated:** February 13, 2026

---

## 1. Project Overview

Aperture Suite is a vertically integrated SaaS platform for professional photographers and videographers that combines:

1. **CRM & Business Management** (replacing Studio Ninja, HoneyBook, Dubsado)
2. **AI Photo Editing & Retouching** (replacing Aftershoot, Imagen AI, Photoshop retouching)
3. **Client Gallery & Delivery** (replacing Pic-Time, Pixieset, ShootProof)

The core value proposition: **Upload RAW photos → AI edits everything automatically → One-click deliver to client gallery.** The industry average for wedding photo delivery is 4-8 weeks. Aperture Suite enables same-day delivery.

---

## 2. Tech Stack

| Layer | Technology | Hosting | Purpose |
|-------|-----------|---------|---------|
| Frontend | Next.js 14 (React) | Vercel | Dashboard, client galleries, all UI |
| Backend API | Next.js API Routes | Vercel | CRM logic, auth, gallery management |
| AI Service | Python FastAPI | Railway (+ GPU provider) | RAW processing, AI editing, style training |
| Database | PostgreSQL | Supabase | All application data |
| Auth | Supabase Auth | Supabase | Photographer + client authentication |
| File Storage | Backblaze B2 (S3-compatible) | Backblaze | RAW files, edited JPEGs, thumbnails |
| CDN | Cloudflare R2 / Cloudflare CDN | Cloudflare | Fast image delivery for galleries |
| Job Queue | BullMQ (Redis) | Railway (Redis) | AI processing pipeline queue |
| Real-time | Supabase Realtime | Supabase | Processing status updates, notifications |
| Email | Resend or Postmark | Cloud | Transactional + marketing emails |
| Payments | Stripe | Cloud | Subscriptions + print store payments |

---

## 3. Repository Structure

```
aperture-suite/
├── apps/
│   └── web/                    # Next.js 14 app (frontend + API routes)
│       ├── app/                # App router pages
│       │   ├── (auth)/         # Login, signup, forgot password
│       │   ├── (dashboard)/    # Photographer dashboard
│       │   │   ├── jobs/       # CRM: jobs & leads
│       │   │   ├── clients/    # CRM: client management
│       │   │   ├── calendar/   # CRM: calendar view
│       │   │   ├── invoices/   # CRM: invoicing
│       │   │   ├── contracts/  # CRM: digital contracts
│       │   │   ├── workflows/  # CRM: automation workflows
│       │   │   ├── gallery/    # AI editing workspace
│       │   │   ├── settings/   # Account, branding, style profiles
│       │   │   └── analytics/  # Business analytics & reports
│       │   ├── (client)/       # Client-facing gallery pages
│       │   │   ├── [galleryId]/  # Individual gallery view
│       │   │   └── download/     # Download management
│       │   └── api/            # API routes
│       │       ├── auth/       # Auth endpoints
│       │       ├── jobs/       # CRM endpoints
│       │       ├── clients/    # Client endpoints
│       │       ├── gallery/    # Gallery endpoints
│       │       ├── upload/     # File upload endpoints
│       │       ├── ai/         # AI processing triggers
│       │       └── webhooks/   # Stripe, email webhooks
│       ├── components/         # Shared React components
│       ├── lib/                # Utilities, Supabase client, etc.
│       ├── styles/             # Global styles, Tailwind config
│       ├── public/             # Static assets
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.js
│       └── tsconfig.json
│
├── services/
│   └── ai-engine/              # Python FastAPI service
│       ├── app/
│       │   ├── main.py         # FastAPI app entry
│       │   ├── routers/        # API route handlers
│       │   │   ├── process.py  # Image processing endpoints
│       │   │   ├── style.py    # Style profile management
│       │   │   └── health.py   # Health check
│       │   ├── pipeline/       # AI processing pipeline
│       │   │   ├── ingest.py       # Phase 0: Analysis
│       │   │   ├── style_edit.py   # Phase 1: Style editing
│       │   │   ├── retouch.py      # Phase 2: Face retouching
│       │   │   ├── cleanup.py      # Phase 3: Scene cleanup
│       │   │   ├── compose.py      # Phase 4: Crop & composition
│       │   │   ├── finalize.py     # Phase 5: QA & output
│       │   │   └── prompt_edit.py  # Prompt-based editing
│       │   ├── models/         # AI model loading & inference
│       │   ├── storage/        # B2/S3 storage interface
│       │   └── workers/        # BullMQ job consumers
│       ├── requirements.txt
│       ├── Dockerfile
│       └── railway.toml
│
├── packages/
│   └── shared/                 # Shared types, constants, utils
│       ├── types/              # TypeScript types shared across apps
│       └── constants/          # Shared constants
│
├── supabase/
│   ├── migrations/             # Database migrations
│   ├── seed.sql                # Seed data
│   └── config.toml             # Supabase config
│
├── docs/                       # Project documentation
│   └── Aperture-Suite-Master-Document.md
│
├── .github/
│   └── workflows/              # CI/CD (future)
│
├── .gitignore
├── package.json                # Root package.json (monorepo)
├── turbo.json                  # Turborepo config
└── README.md
```

---

## 4. Database Schema (Supabase/PostgreSQL)

### Core Tables

**photographers** — Platform users (the photographers)
- id (uuid, PK)
- email, name, business_name, phone, address
- brand_settings (jsonb) — logo URL, colors, fonts, custom domain
- subscription_tier, subscription_status
- stripe_customer_id
- created_at, updated_at

**clients** — Photographer's clients
- id (uuid, PK)
- photographer_id (FK → photographers)
- first_name, last_name, email, phone, address
- notes, tags (text[])
- source (referral, website, instagram, etc.)
- created_at, updated_at

**leads** — Pre-booking inquiries
- id (uuid, PK)
- photographer_id (FK)
- client_id (FK → clients)
- job_type, preferred_date, location
- source, status (new, contacted, quoted, booked, lost)
- notes
- created_at, updated_at

**jobs** — Confirmed bookings/shoots
- id (uuid, PK)
- photographer_id (FK)
- client_id (FK → clients)
- lead_id (FK → leads, nullable)
- gallery_id (FK → galleries, nullable)
- job_type, title, date, location
- package_name, package_amount
- status (upcoming, in_progress, editing, delivered, completed)
- notes
- workflow_id (FK → workflows, nullable)
- created_at, updated_at

**invoices**
- id (uuid, PK)
- job_id (FK → jobs)
- photographer_id (FK)
- client_id (FK → clients)
- amount, tax, total
- status (draft, sent, partially_paid, paid, overdue)
- due_date, paid_date
- stripe_invoice_id
- line_items (jsonb)
- created_at, updated_at

**contracts**
- id (uuid, PK)
- job_id (FK → jobs)
- photographer_id (FK)
- template_id (FK → contract_templates)
- content (text) — rendered contract HTML
- signed_at, signature_data (jsonb)
- status (draft, sent, signed)
- created_at

**questionnaires**
- id (uuid, PK)
- job_id (FK → jobs)
- photographer_id (FK)
- template_id (FK → questionnaire_templates)
- responses (jsonb)
- submitted_at
- created_at

**workflows**
- id (uuid, PK)
- photographer_id (FK)
- name, description
- trigger_type (lead_created, job_booked, gallery_delivered, etc.)
- steps (jsonb) — array of { type, delay, template_id, conditions }
- is_active (boolean)
- created_at, updated_at

### Gallery & AI Tables

**galleries**
- id (uuid, PK)
- photographer_id (FK)
- job_id (FK → jobs, nullable)
- client_id (FK → clients, nullable)
- title, description
- password_hash (nullable)
- access_type (password, email, public)
- download_permissions (jsonb) — { allow_full_res, allow_web, allow_favorites_only }
- brand_override (jsonb, nullable) — override photographer's default branding
- expires_at (timestamp, nullable)
- status (processing, ready, delivered, expired, archived)
- created_at, updated_at

**photos**
- id (uuid, PK)
- gallery_id (FK → galleries)
- photographer_id (FK)
- original_key (text) — B2 storage key for RAW/original file
- edited_key (text) — B2 key for full-res edited JPEG
- web_key (text) — B2 key for web-optimized JPEG
- thumb_key (text) — B2 key for thumbnail
- watermarked_key (text) — B2 key for watermarked preview
- filename, file_size, mime_type
- width, height
- exif_data (jsonb) — camera, lens, settings, GPS, timestamp
- scene_type (text) — AI classification
- quality_score (integer) — 0-100
- ai_edits (jsonb) — all adjustments applied by AI
- manual_edits (jsonb) — photographer's manual tweaks
- prompt_edits (jsonb[]) — array of prompt-based edits
- status (uploaded, processing, edited, approved, delivered)
- star_rating (integer) — 0-5
- color_label (text)
- is_culled (boolean) — AI suggested cull
- is_favorite (boolean) — client favorited
- sort_order (integer)
- created_at, updated_at

**style_profiles**
- id (uuid, PK)
- photographer_id (FK)
- name, description
- reference_images (text[]) — B2 keys for reference images
- model_weights_key (text) — B2 key for trained model weights
- settings (jsonb) — retouching intensity, auto-crop, cleanup preferences
- status (training, ready, error)
- training_started_at, training_completed_at
- created_at, updated_at

**processing_jobs**
- id (uuid, PK)
- gallery_id (FK → galleries)
- photographer_id (FK)
- style_profile_id (FK → style_profiles)
- total_images (integer)
- processed_images (integer)
- status (queued, processing, completed, failed)
- started_at, completed_at
- error_log (text, nullable)
- created_at

### Template Tables

**email_templates**, **contract_templates**, **questionnaire_templates**
- id, photographer_id, name, subject (email only), content, variables (jsonb), created_at, updated_at

---

## 5. Current Progress

### Session: February 13, 2026

**Completed:**
- [x] Competitive research: Pic-Time, Studio Ninja, Aftershoot, Imagen AI, Neurapix, FilterPixel
- [x] Full pricing analysis of all competitors
- [x] AI photo editing workflow architecture (6-phase automatic pipeline)
- [x] Prompt-based editing feature design (chat-based per-image edits)
- [x] Client gallery & delivery system design
- [x] Marketing automation system design (10 automated campaigns)
- [x] Migration/import strategy for all major CRMs
- [x] Data model design (unified CRM → Gallery → AI schema)
- [x] Tech stack selection
- [x] Repository structure design
- [x] Database schema design
- [x] Master document created
- [x] Project scaffolding initiated

**Key Documents Created:**
- Photography-Platform-Research-and-AI-Scope.md — Competitive research
- ai-editing-workflow.jsx — Editing workflow interactive diagram
- prompt-based-editing.jsx — Prompt editing UI/UX design
- auto-processing-pipeline.jsx — 6-phase AI pipeline breakdown
- migration-strategy.jsx — CRM migration/import strategy
- client-delivery-system.jsx — Gallery delivery & automation design

---

## 6. Roadmap

### Phase 1 — Foundation (Current)
- [ ] Project scaffolding (Next.js + Supabase + monorepo)
- [ ] Authentication (photographer signup/login)
- [ ] Database migrations for core schema
- [ ] Basic dashboard layout
- [ ] File upload infrastructure (B2 integration)

### Phase 2 — CRM Core
- [ ] Client management (CRUD + CSV import)
- [ ] Lead management & pipeline
- [ ] Job creation & tracking
- [ ] Calendar integration
- [ ] Invoicing (Stripe integration)
- [ ] Digital contracts with e-signatures
- [ ] Questionnaires
- [ ] Email sending (Resend integration)

### Phase 3 — AI Editing Engine
- [ ] RAW file ingestion & thumbnail generation
- [ ] Style profile training (reference image upload)
- [ ] Phase 0: Scene classification & face detection
- [ ] Phase 1: Style editing application
- [ ] Phase 2: Auto retouching (skin, blemish, stray hair)
- [ ] Phase 3: Scene cleanup (background people, distractions)
- [ ] Phase 4: Crop & composition
- [ ] Phase 5: QA & output generation
- [ ] Prompt-based editing (chat interface)
- [ ] In-browser editing workspace (WebGL preview + sliders)

### Phase 4 — Client Gallery
- [ ] Gallery creation & theming
- [ ] Client-facing gallery pages (responsive, fast)
- [ ] Download management (individual, favorites, ZIP)
- [ ] AI-powered gallery search (face recognition, keywords)
- [ ] Favorites/heart system
- [ ] Social sharing
- [ ] Print store integration
- [ ] Gallery analytics

### Phase 5 — Automation & Polish
- [ ] Workflow automation engine
- [ ] Marketing email automations
- [ ] Migration importers (Studio Ninja, HoneyBook, etc.)
- [ ] Template marketplace
- [ ] Style profile marketplace
- [ ] Custom domains for galleries
- [ ] Mobile app (React Native)

---

## 7. Environment & Deployment

### Local Development
- **Web app:** `cd apps/web && npm run dev` → localhost:3000
- **AI service:** `cd services/ai-engine && uvicorn app.main:app --reload` → localhost:8000
- **Supabase:** Local via `supabase start` or remote project

### Production
- **Web app:** Vercel (auto-deploy from `main` branch)
- **AI service:** Railway (auto-deploy from `main` branch)
- **Database:** Supabase cloud project
- **Storage:** Backblaze B2 bucket
- **CDN:** Cloudflare R2 or Cloudflare in front of B2

### GitHub Repository
- **Repo name:** `aperture-suite` (or rename later)
- **Branch strategy:** `main` (production), `dev` (development), feature branches

---

## 8. File Locations

| Item | Path |
|------|------|
| Project root | `C:\Users\mitch\OneDrive\Documents\Photo AI\aperture-suite` |
| Master document | `C:\Users\mitch\OneDrive\Documents\Photo AI\aperture-suite\docs\Aperture-Suite-Master-Document.md` |
| Web app | `C:\Users\mitch\OneDrive\Documents\Photo AI\aperture-suite\apps\web` |
| AI service | `C:\Users\mitch\OneDrive\Documents\Photo AI\aperture-suite\services\ai-engine` |
| Database migrations | `C:\Users\mitch\OneDrive\Documents\Photo AI\aperture-suite\supabase\migrations` |

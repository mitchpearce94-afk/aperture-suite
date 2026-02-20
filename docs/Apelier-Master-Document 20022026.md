# Apelier — Master Document

**Version:** 4.2  
**Last Updated:** 20 February 2026 (Marketing site built + gold rebrand, Railway AI engine crash fix, client gallery redesign with full-bleed hero + masonry layout)  
**Project Location:** `C:\Users\mitch\OneDrive\Documents\aperture-suite`  
**GitHub:** `github.com/mitchpearce94-afk/aperture-suite`  
**Live URL:** Deployed on Vercel (auto-deploys from `main` branch)  
**Supabase Project Ref:** `ibugbyrbjabpveybuqsv`  
**Supabase SQL Editor:** `https://supabase.com/dashboard/project/ibugbyrbjabpveybuqsv/sql`  
**Tar command for upload:** `tar -czf aperture-suite.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=dist --exclude=.turbo .`

---

## 1. What Is Apelier?

Apelier is a vertically integrated SaaS platform for photographers that combines CRM/job management (replacing Studio Ninja), client gallery delivery (replacing Pic-Time), and AI-powered photo editing (replacing Aftershoot/Imagen) into a single product.

**The core promise:** From shutter click to client delivery in under 1 hour, versus the industry average of 4–8 weeks.

**Key differentiator:** The photographer's only manual actions are (1) adding a lead and (2) uploading photos after a shoot. Everything else — quoting, booking, invoicing, editing, delivery, follow-ups, reviews, referrals — is fully automated.

---

## 2. The Fully Automated Client Journey

This is the complete end-to-end flow. The photographer's only touchpoints are marked with 👤. Everything else happens automatically.

### Stage 1: Lead Capture
- **Automated sources:** Website contact form auto-creates lead → future: Facebook/Instagram lead ads via Meta API, email parsing
- **Manual sources:** 👤 Photographer manually adds lead from Instagram DMs, phone calls, word-of-mouth
- **System auto-responds** with a personalised enquiry response email within minutes

### Stage 2: Quoting
- System auto-generates a **client-facing quote link** (e.g. `yourbrand.apelier.com.au/quote/abc123`)
- Client opens the link and sees: photographer's branding, package options with pricing, what's included (images, duration, deliverables), and options to add extras (additional images, prints, etc. — configurable by the photographer in Settings)
- Client **accepts or declines the quote:**
  - **Accept →** triggers Stage 3 (Booking)
  - **No response →** system auto-sends follow-up emails at configurable intervals ("Just checking in — did you have any questions about the quote?")
  - **Decline →** lead updated accordingly, optional "what could we do differently?" follow-up

### Stage 3: Booking
There are two paths to booking:

**Path A — Automated (from accepted quote):**
- **All of the following happen automatically when the client accepts the quote:**
  - Lead status → "Booked"
  - Job created with all details from the selected package (duration, included images, start/end time, any extras they added)
  - Job number assigned (permanent, auto-incrementing, never resets: #0001, #0002...)
  - Contract auto-sent to client for e-signing
  - Once contract signed → Invoice(s) generated and sent (see invoicing rules below)
  - Booking confirmation email sent to client with date, time, location, what to expect
  - Job added to calendar
  - Pre-shoot workflow automation triggered (reminder emails scheduled)

**Path B — Manual (direct booking from DM/phone call):**
- 👤 Photographer creates a job directly from the dashboard (client DMs saying "book me in for your available times", or books on a phone call)
- 👤 Selects the client (or creates new), picks a package, sets the date/time
- Same automation kicks in from that point: contract sent, invoices generated, confirmation email, calendar entry, workflow triggers

**Invoicing rules (apply to both paths):**
- If package requires deposit → Deposit invoice `INV-0001-DEP` sent immediately on booking (due 14 days after sent) + Final invoice `INV-0001-FIN` created on booking, auto-sent 28 days before shoot date, with due date set to 14 days before shoot date
- If no deposit (pay in full) → Single invoice `INV-0001` created and sent on booking, with due date set to 14 days before shoot date (or 14 days from now if no shoot date)
- **Payment happens separately** when the client pays their invoice(s) — not at the quoting/booking stage
- Overdue invoice reminders sent automatically at configurable intervals after the due date

### Stage 4: Pre-Shoot
- **7 days before:** Auto-email to client with shoot prep tips, location details, what to wear suggestions
- **1 day before:** Auto-reminder email with time, location, and any last-minute details
- **Final invoice reminder** if balance is still unpaid (configurable timing)
- Job status auto-updates to "In Progress" on shoot date

### Stage 5: Post-Shoot — Upload & AI Processing
- 👤 Photographer uploads RAW files to the job (browser upload or future desktop sync agent)
- **Job status workflow on upload:**
  1. Upload starts → Job status changes to **"Editing"**
  2. AI processing pipeline kicks off automatically (6 phases below)
  3. AI finishes → Job status changes to **"Ready for Review"** → photographer gets notification
  4. 👤 Photographer reviews and approves (Stage 6)
  5. 👤 Photographer clicks "Send to Gallery" → Job status changes to **"Edited"** (stays in Open tab)
  6. 👤 Photographer goes to Galleries → clicks "Deliver to Client" → Job status changes to **"Delivered"** (moves to Delivered tab)
  7. Client views gallery AND invoice is paid → Job status auto-changes to **"Completed"**
  8. If invoice is unpaid after delivery → Job stays on "Delivered" with unpaid flag

- **AI processing pipeline (6 phases, 24 steps):**

  **Phase 0 — Analysis:** Scene detection (portrait/landscape/ceremony/reception), face detection, quality scoring (exposure, focus, noise), duplicate grouping, EXIF extraction

  **Phase 1 — Style Application:** Applies photographer's trained style profile (exposure, white balance, contrast, colour grading, shadows, highlights, HSL, tone curve). Trained from 10–100 RAW + edited pairs the photographer uploads — the AI compares each pair to learn exactly what they change (much lower barrier than Imagen's 3,000–5,000 requirement)

  **Phase 2 — Face & Skin Retouching:** Automatic skin smoothing (texture-preserving), blemish/acne removal, stray hair cleanup, red-eye removal, subtle teeth whitening

  **Phase 3 — Scene Cleanup:** Background person/distraction removal, exit sign removal, power line removal, lens flare removal, trash/bright distraction removal

  **Phase 4 — Composition:** Horizon straightening, crop optimisation, rule-of-thirds alignment

  **Phase 5 — QA & Output:** Final quality check, generate web-res + thumbnails + full-res outputs, verify all images processed

- **AI selects the top N images** based on the package's "Included Images" count (e.g. 50), using quality score, variety (different scenes/poses/people), and composition
- If AI can only find fewer good images than the package requires → notification to photographer
- If more selected than package count → notification to confirm or trim
- **48 hours post-shoot:** Auto-email asking client "How did we do?" (review request)

### Stage 6: Review & Approval
- 👤 Photographer receives notification that AI processing is complete
- 👤 Photographer opens the gallery workspace, scrolls through before/after previews
- 👤 Photographer approves the gallery (95%+ of images should be perfect; the prompt-based chat editor handles the other 5%)
- **Prompt-based editing** for edge cases: photographer types natural language instructions per image (e.g. "remove the person in the background", "make the sky more blue", "smooth out the wrinkles on the tablecloth"). AI interprets and applies using inpainting/generative fill. Non-destructive with full undo history.

### Stage 7: Delivery
- 👤 Photographer clicks "Send to Gallery" in the Review Workspace (Auto Editor) → photos sent to gallery, job status → "Edited"
- 👤 Photographer goes to Galleries page, opens the gallery, clicks "Deliver to Client" → confirms → job status → "Delivered"
- **Everything else is automatic:**
  - Client-facing gallery created with photographer's branding, colours, logo, watermark settings
  - Gallery link generated (password-protected if configured)
  - Delivery email sent to client with gallery link
  - Gallery features: AI-powered search ("ceremony", "first dance"), face recognition grouping, favourites/heart system, configurable download permissions, social sharing with photographer credit, video support, print ordering
  - Client can view, download, favourite, share, and order prints
  - Photographer sees analytics: which images viewed, favourited, downloaded

### Stage 8: Post-Delivery Automations (run forever once configured)
- **3 days post-delivery:** Follow-up email — "Have you had a chance to view your gallery?"
- **Gallery expiry warning:** 7 days before gallery expires (if expiry is set)
- **Early bird print sales:** Promotional pricing on prints within first 2 weeks
- **Favourites follow-up:** "You favourited 12 images — would you like prints?"
- **Review request:** Prompt for Google/Facebook review with direct links
- **Referral prompt:** "Know someone who needs a photographer?" with referral link/discount
- **Anniversary email:** 1 year later — "Happy anniversary! Book a session to celebrate"
- **Overdue invoice reminders:** Automated escalation at configurable intervals

### Summary: What the Photographer Actually Does
| Action | Manual? |
|--------|---------|
| Add lead (from DM/call) | 👤 Yes |
| Create job directly (if client books via DM/phone) | 👤 Yes (optional path) |
| Upload photos after shoot | 👤 Yes |
| Review AI-edited gallery | 👤 Yes (quick scan) |
| Send to Gallery | 👤 Yes (one click) |
| Deliver to Client | 👤 Yes (one click from Galleries page) |
| Everything else | ✅ Automated |

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (React + TypeScript) | Dashboard, client galleries, SSR for SEO |
| Styling | Tailwind CSS | Utility-first responsive design |
| Hosting (Web) | Vercel | Auto-deploys from GitHub `main` branch |
| Database | Supabase (PostgreSQL) | Auth, data, RLS, real-time subscriptions |
| AI Service | Python FastAPI | RAW processing, image analysis, style transfer |
| AI Hosting | Railway (CPU) / Modal (GPU — live) | AI engine serves on port 8000, GPU phases on Modal A10G |
| Storage | Supabase Storage (photos bucket) | Photo storage with RLS, 100MB/file |
| CDN | Cloudflare R2 | Fast gallery delivery, watermarking |
| Queue | BullMQ (Redis) | Job queue for AI processing pipeline |
| Payments | Stripe + Stripe Connect | Client payments, photographer payouts |
| Email | Resend or Postmark | Transactional + marketing automations |
| AI/ML | Pillow, OpenCV, NumPy, rawpy | Image processing, analysis, style transfer (CPU). PyTorch/SAM 2 planned for GPU phases |

---

## 4. Database Schema (Supabase PostgreSQL)

**14 tables + 3 new tables + RLS policies per photographer. 17 migrations applied. Storage RLS simplified for uploads.**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `photographers` | User accounts | auth_user_id, name, email, business_name, subscription_tier, next_job_number, contract_template, signature_image |
| `clients` | Client records | photographer_id, first_name, last_name, email, phone, address, tags, source, notes |
| `leads` | Sales pipeline | photographer_id, client_id, status (new/contacted/quoted/booked/lost), job_type, preferred_date, package_name, estimated_value, source, notes, location |
| `jobs` | Confirmed bookings | photographer_id, client_id, job_number, title, job_type, status (upcoming/in_progress/editing/edited/ready_for_review/delivered/completed/canceled), date, time, end_time, location, package_name, package_amount, included_images, booking_slot_id, notes |
| `invoices` | Billing | photographer_id, client_id, job_id, invoice_number, invoice_type (deposit/final/custom), status, line_items (JSONB), amount, tax, currency, total, due_date, paid_date |
| `contracts` | Agreements & e-signing | photographer_id, job_id, client_id, name, content, merge_tags, is_default, status (draft/sent/viewed/signed), signing_token (UUID), signature_data (JSONB), client_signed_at, client_ip, expires_at, viewed_at, sent_at |
| `packages` | Service packages | photographer_id, name, description, price, duration_hours, included_images, deliverables, is_active, require_deposit, deposit_percent, sort_order |
| `booking_events` | Bookable sessions | photographer_id, title, description, location, package_id, custom_price, slot_duration_minutes, buffer_minutes, slug, is_published, status (draft/published/closed/archived), auto_create_job, auto_create_invoice |
| `booking_slots` | Time slots within events | event_id, photographer_id, date, start_time, end_time, status (available/booked/blocked/canceled), client_id, job_id, booked_name, booked_email, booked_phone, booked_answers, booked_at |
| `galleries` | Photo collections | photographer_id, job_id, client_id, title, description, slug, access_type, download_permissions, brand_override, expires_at, status, view_count, password_hash, delivered_at |
| `photos` | Individual images | gallery_id, photographer_id, original_key, edited_key, web_key, thumb_key, watermarked_key, filename, file_size, width, height, exif_data, scene_type, quality_score, face_data, ai_edits, manual_edits, prompt_edits, status, star_rating, color_label, is_culled, is_favorite, is_sneak_peek, sort_order, section, edit_confidence, needs_review |
| `style_profiles` | AI editing styles | photographer_id, name, description, reference_image_keys, model_weights_key, settings (JSONB), status (pending/training/ready/error) |
| `processing_jobs` | AI queue | photographer_id, gallery_id, style_profile_id, total_images, processed_images, current_phase, status (queued/processing/completed/failed/canceled) |
| `workflows` | Automation rules | photographer_id, name, trigger, actions (JSONB), is_active, conditions (JSONB) |
| `templates` | Email/message templates | photographer_id, name, type, subject, body, merge_tags |
| `workflow_actions` | Executed automations | workflow_id, action_type, status, executed_at, result |
| `audit_log` | Activity tracking | photographer_id, action, entity_type, entity_id, details (JSONB) |

**Job Status Check Constraint:**
```sql
CHECK (status IN ('upcoming', 'in_progress', 'editing', 'edited', 'ready_for_review', 'delivered', 'completed', 'canceled'))
```
This was updated on 15 Feb 2026 to include `edited`. If you ever need to add another status, update this constraint first.

**Supabase Storage:**
- `photos` bucket — 100MB per file limit, accepts JPEG/PNG/WEBP/TIFF/RAW formats (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2). RLS policies enforce photographer-scoped folder access (`photos/{photographer_id}/...`)

**Migrations applied:**
1. `20260213000000_initial_schema.sql` — Core 14 tables ✅ Run
2. `20260214000001_add_invoice_type.sql` — invoice_type column ✅ Run
3. `20260214000002_add_job_number.sql` — job_number + next_job_number counter ✅ Run
4. `20260214000003_add_job_time.sql` — time + end_time columns ✅ Run
5. `20260214000004_job_number_counter.sql` — Atomic RPC function `increment_job_number()` ✅ Run
6. `20260214000005_fix_rls_policies.sql` — **Critical:** Proper INSERT/UPDATE/DELETE policies with `WITH CHECK` ✅ Run
7. `20260214000006_contract_signing.sql` — Contract signing fields + anon RLS policies ✅ Run
8. `20260214000006_add_ready_for_review_status.sql` — `ready_for_review` job status + `included_images` ✅ Run
9. `20260214000007_photographer_signature.sql` — `signature_image` on photographers ✅ Run
10. `20260214000007_create_photos_storage.sql` — `photos` storage bucket with RLS ✅ Run
11. `20260215000001_gallery_delivery.sql` — Gallery delivery features ✅ Run
12. `20260215000002_create_packages_table.sql` — `packages` table with full RLS ✅ Run
13. `20260215000003_booking_events_slots.sql` — `booking_events` + `booking_slots` tables ✅ Run
14. `20260215000004_job_booking_slot_link.sql` — `booking_slot_id` FK on jobs ✅ Run
15. **Manual SQL (15 Feb 2026):** Updated `jobs_status_check` constraint to include `'edited'` status ✅ Run
16. `20260219000001_style_profiles_update.sql` — Added model_key, training_method, training_status to style_profiles ✅ Run
17. `20260219000002_images_edited_counter.sql` — Added images_edited_count, billing_period_start/end to photographers + increment_images_edited() RPC ✅ Run

---

## 5. Current Build Status

### ✅ Fully Working
- **Auth:** Signup, login, logout, route protection via middleware, OAuth callback ready (Google/Apple buttons in UI, needs provider credentials in Supabase). Dynamic user initials in header from photographer profile
- **Dashboard:** Live stats from Supabase (total clients, leads, jobs, revenue), upcoming shoots, recent leads, gallery status
- **Clients:** Full CRUD — add, search, click-to-view slide-over, edit, delete. Searchable with tags/source/revenue tracking
- **Leads:** Full CRUD — add (new or existing client via searchable combobox), pipeline kanban view + list view, status transitions, package selector, edit slide-over, delete. Lost leads hidden from pipeline, visible in list with toggle. Sorted by preferred date (soonest first)
- **Jobs:** Full CRUD — add with package selector (auto-fills price, images, calculates end time from duration), permanent job numbering (#0001+), status tabs (Open includes edited, Delivered tab, All tab), cancel/restore, edit, delete. Time + end time fields throughout. Job status is view-only — changes automatically through the workflow
- **Invoices:** Full CRUD — create custom or auto-generate from job. Deposit/final split based on package settings (25% default deposit). Job-linked invoice numbers (INV-0001-DEP/FIN). Line item editor, GST calculation, status management
- **Calendar:** Monthly view with colour-coded jobs, navigate months, today button, job detail popups with time ranges
- **Contracts:** E-sign system — single universal template with conditional deposit/no-deposit sections, 10 sections covering all scenarios, merge tags auto-filled from job/client data. Public signing page (`/sign/[token]`) with canvas signature pad (draw with mouse/finger, multi-stroke support with confirm/clear). Photographer signature stored in Settings (draw or upload). Both signatures shown on signed contract. Signing captures IP, user agent, timestamp. Contract status tracking (draft → sent → viewed → signed). Copy signing link from contracts list
- **Workflows:** 6 pre-built automation presets (lead auto-response, booking confirmation, pre-shoot reminder, post-shoot with 48hr review email, gallery delivery, payment reminders). All deposit-aware. Toggle on/off. Preview mode
- **Analytics:** Period filters, revenue/booked/conversion stats, bar chart revenue by month, lead source + job type breakdowns
- **Auto Editing (AI Workspace):**
  - **Photo Upload tab:** Select a job → drag-and-drop or click to upload RAW/JPEG files. Accepts CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, TIFF, JPEG, PNG, WEBP. Shows per-file upload progress, auto-creates gallery for job, uploads to Supabase Storage via server-side API route (`/api/upload`), creates photo records in DB. Auto-triggers AI processing after upload (toggle in UI)
  - **AI Processing Pipeline (Python FastAPI):** Fully built and tested. Upload triggers `/api/process` → AI engine runs 6 phases → outputs uploaded to Supabase Storage (`edited/`, `web/`, `thumbs/`). Photo records updated with output keys, quality scores, scene types, face data. Gallery marked `ready`, job marked `ready_for_review`
  - **Processing Queue tab:** Stats cards (processing/queued/completed/total images). Processing cards with 6-phase progress indicator (Analysis → Style → Retouch → Cleanup → Composition → Output). Smooth 3-second polling, no glitching. Phase IDs match AI engine output (`analysis`, `style`, `retouch`, `cleanup`, `composition`, `output`). No mock data — shows empty state when no processing jobs exist
  - **Review Workspace:** Full photo review UI with real photos from Supabase Storage. Grid view with section/status filters. Click photo for before/after comparison (original vs edited) with `object-contain` display (no cropping). Approve/reject individual photos, star ratings, bulk select. "Send to Gallery" button calls server-side API that updates photos/gallery/job/processing_job in one call (bypasses RLS). Auto-navigates back to editing page after send. Optional auto-deliver toggle
  - **Style profiles:** Multi-style system — create named styles, each trained from 10–100 RAW + edited pairs. Side-by-side drop zones with filename matching (IMG_1234.CR2 ↔ IMG_1234.jpg). Change Style panel in review workspace applies different styles to individual photos via restyle endpoint. Training status polling per style
- **Galleries:**
  - Dashboard page with grid cards showing cover, status badge, access type icon, photo count
  - Status filters (all/ready/delivered/processing/draft), search
  - Gallery detail view with real photos from Supabase (signed URLs), settings panel (access type, expiry, download permissions)
  - Photo lightbox with keyboard nav (arrow keys, Escape), photo counter, section label
  - **Sticky "Deliver to Client" bar** at bottom when gallery status is `ready` — confirm flow with client email confirmation → updates gallery to `delivered` AND updates job to `delivered` via server API (bypasses RLS) → sends gallery delivery email via Resend
  - **Delivered banner** at bottom when gallery status is `delivered` — shows photo count, views, "View as Client" button
  - Gallery password setting with hash
  - Queries: `getGallery`, `getGalleryBySlug`, `getGalleryPhotos`, `updateGallery`, `deliverGallery`, `incrementGalleryViews`, `togglePhotoFavorite`, `getPhotographerBranding`
- **Client-Facing Gallery (`/gallery/[slug]`):**
  - Public route excluded from auth middleware (like `/sign`)
  - Loads gallery + photos with **server-side signed URLs** via `/api/gallery-photos` API route (client isn't authenticated as photographer so can't sign URLs directly)
  - Auto-unlocks if access_type is password but no password_hash is set
  - Password gate for password-protected galleries (check via `/api/gallery-password?action=check`)
  - Photographer branding (logo initial, colours, business name)
  - Section filters, favourites filter (heart button), grid size toggle (large/small)
  - Photo lightbox with keyboard nav, favourite toggle
  - **Download buttons work** — calls `/api/gallery-photos?action=download` for signed download URLs, defaults to full-res
  - Gallery expiry check — shows error if expired
  - View count auto-incremented via `increment_gallery_views()` RPC
  - Footer with "Powered by Apelier"
- **Email Integration (Resend):**
  - API route at `/api/email` — accepts template name, recipient, and data
  - 5 email templates: gallery_delivery, booking_confirmation, invoice, contract_signing, reminder
  - All templates are branded with photographer's colour and business initial
  - Dev mode: logs emails when `RESEND_API_KEY` not configured
  - Helper functions in `lib/email.ts`: `sendGalleryDeliveryEmail`, `sendBookingConfirmationEmail`, `sendInvoiceEmail`, `sendContractSigningEmail`
  - Gallery delivery wired: "Deliver to Client" sends branded email with gallery link to client
- **Settings:**
  - Business Profile — saves to Supabase
  - Packages — name, price, duration, included images, description, deposit toggle + deposit %, active toggle
  - Branding — primary/secondary colours with contrast-aware preview, logo upload, watermark/download toggles
  - Contract Template — preview/edit modes, merge tag click-to-insert, conditional block helpers
  - Editing Style — multi-style support: create named styles (e.g. "Wedding", "B&W", "Film"), each trained from 10–100 RAW + edited pairs with filename matching. Side-by-side drop zones (RAW originals / edited versions). Auto-matching by filename. Pair preview grid. Training status polling. Retrain/delete per style. Change Style panel in review workspace to apply different styles to individual photos
  - Notifications — email toggles, auto follow-up timing, overdue reminders
  - Billing — plan display, Stripe placeholder
- **Responsive Design:** Full mobile/tablet pass — collapsible sidebar with hamburger menu, sticky header, no horizontal scroll, responsive grids, mobile-optimised modals/slide-overs, horizontal scroll tabs
- **Deployment:** Live on Vercel, auto-deploys from GitHub main branch. AI engine on Railway

### 🔧 Built but Not Yet Connected to Real Backend
- **Workflows:** UI only, email templates exist but workflow triggers not wired to automatic scheduling
- **Analytics:** Uses Supabase data but some mock calculations
- **Branding:** Logo upload is local preview only (needs file storage)
- **Email sending:** Resend API route built. Gallery delivery, booking confirmation, contract signing, and invoice emails all wired to their respective flows. Requires `RESEND_API_KEY` env var to actually send (dev mode logs to console). **⚠️ No Resend account created yet — no domain verification, no API key, zero emails actually send. This is the #1 setup task before beta launch**
- **Gallery password verification:** Password hash stored but actual verification on client-facing page not fully implemented

### ❌ Not Yet Built
- **AI processing on GPU** (Phase 1 GPU style transfer via Modal A10G is LIVE — 3D LUT predictor with 5 endpoints. Phases 2 & 3 are stubs — skin retouching needs SAM 2/face models, scene cleanup needs inpainting models. Phases 0/4/5 are fully working on CPU)
- **Prompt-based per-image editing backend** (chat interface built in review workspace, needs AI inference)
- **Client-facing quote page** (view packages, add extras, accept/decline — triggers booking flow)
- **Public contact form** (auto-creates leads from website)
- **Stripe payment integration** (invoicing, deposits, print orders)
- **Print ordering / e-commerce** (client purchases prints from gallery)
- **Google/Apple OAuth** (buttons exist, needs provider credentials configured in Supabase)
- **Native app** (iOS/Android — React Native or Expo)
- **Full UI/UX redesign** (current dark theme is functional, not polished)
- **Complete user tutorial/documentation** (in-app walkthrough + standalone docs — do this LAST so nothing gets missed)

---

## 6. Critical Development Rules

**These rules exist because we hit painful build failures. Follow them every time.**

### Rule 1: types.ts is the single source of truth
- `apps/web/lib/types.ts` defines the shape of every data type (Job, Invoice, Client, Lead, etc.)
- `apps/web/lib/queries.ts` function signatures MUST match the field names in types.ts
- Page components pass data to queries functions — the fields they pass must exist in the function signature
- **Chain of truth:** `types.ts` → `queries.ts` function params → `page.tsx` create/update calls

### Rule 2: Never import server-only modules in client components
- `lib/supabase/server.ts` uses `next/headers` — cannot be imported in `'use client'` files
- Client components use `lib/supabase/client.ts`
- Server components and API routes use `lib/supabase/server.ts`

### Rule 3: Field name mapping (types.ts ↔ database)
These are the actual field names. Do not invent alternatives:

| Type | Field | NOT this |
|------|-------|----------|
| Job | `date` | ~~shoot_date~~ |
| Job | `title` (optional) | ~~title (required)~~ |
| Invoice | `amount` | ~~subtotal~~ |
| Invoice | `tax` | ~~tax_amount~~ |
| Invoice | `currency` | (don't omit) |
| Lead | `location` | (don't omit from createLead) |

### Rule 4: RLS policies need WITH CHECK for INSERT
- Supabase `FOR ALL USING (...)` covers SELECT/UPDATE/DELETE but NOT INSERT
- INSERT requires separate `FOR INSERT WITH CHECK (...)`
- Migration `20260214000005_fix_rls_policies.sql` fixed this — don't revert to `FOR ALL`

### Rule 5: Always run `npx next build` before pushing
- TypeScript strict mode catches field mismatches at build time
- `npm run dev` does NOT catch these — it uses loose compilation
- Never push code that hasn't passed `npx next build`

### Rule 6: When editing queries.ts or types.ts
1. Check `types.ts` for the interface definition
2. Update `queries.ts` function params to match exactly
3. Check every page that calls the function — ensure fields match
4. Run `npx next build` to verify
5. Only then push

### Rule 7: React component names must be capitalised
- `<accessIcon />` → JSX treats as HTML element → type error
- `<AccessIcon />` → JSX treats as React component → works

### Rule 8: RLS blocks all client-side writes — use server API routes
- The Supabase anon client (browser-side) is blocked by RLS for most writes
- ALL DB mutations that need to bypass RLS must go through Next.js API routes using the service role client
- Key API routes that use service role: `/api/processing-jobs`, `/api/upload`, `/api/book`, `/api/gallery-photos`, `/api/gallery-password`
- **SUPABASE_SERVICE_ROLE_KEY must be set in Vercel env vars** — without it, all server API routes fail

---

## 7. File Structure

```
aperture-suite/
├── apps/
│   └── web/                          # Next.js 14 frontend
│       ├── app/
│       │   ├── (auth)/               # Auth pages
│       │   │   ├── login/page.tsx
│       │   │   ├── signup/page.tsx
│       │   │   └── layout.tsx
│       │   ├── (dashboard)/          # Protected dashboard pages
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── clients/page.tsx
│       │   │   ├── leads/page.tsx
│       │   │   ├── jobs/page.tsx
│       │   │   ├── invoices/page.tsx
│       │   │   ├── galleries/page.tsx
│       │   │   ├── calendar/page.tsx
│       │   │   ├── bookings/page.tsx
│       │   │   ├── contracts/page.tsx
│       │   │   ├── workflows/page.tsx
│       │   │   ├── analytics/page.tsx
│       │   │   ├── editing/page.tsx   # AI editing workspace (3 tabs: upload/queue/review)
│       │   │   ├── settings/page.tsx
│       │   │   └── layout.tsx
│       │   ├── sign/[token]/page.tsx  # Public contract signing page
│       │   ├── book/[slug]/page.tsx   # Public client-facing booking page
│       │   ├── gallery/[slug]/page.tsx # Public client-facing gallery page
│       │   ├── api/
│       │   │   ├── email/route.ts     # Resend email API
│       │   │   ├── upload/route.ts    # Server-side photo upload to Supabase Storage
│       │   │   ├── process/route.ts   # Bridge to AI engine
│       │   │   ├── processing-jobs/route.ts  # **KEY** — Server-side DB operations (service role, bypasses RLS)
│       │   │   ├── gallery-photos/route.ts   # Server-side signed URL generation for client gallery
│       │   │   ├── gallery-password/route.ts # Gallery password check/set/verify
│       │   │   ├── book/route.ts      # Public booking API
│       │   │   └── style/route.ts     # Bridge to AI engine for style training
│       │   ├── auth/callback/route.ts # OAuth callback
│       │   ├── layout.tsx
│       │   └── page.tsx              # Landing page
│       ├── components/
│       │   ├── dashboard/
│       │   │   ├── sidebar.tsx
│       │   │   ├── top-bar.tsx
│       │   │   └── stat-card.tsx
│       │   ├── editing/
│       │   │   ├── editing-cards.tsx   # ProcessingCard + PhaseProgress components
│       │   │   ├── photo-upload.tsx    # Job picker + drag-drop RAW upload with progress
│       │   │   ├── review-workspace.tsx # Full photo review UI — sends to gallery via server API
│       │   │   ├── style-upload.tsx    # Style profile creation flow
│       │   │   ├── style-profiles.tsx  # Style profile list/manage with training status polling
│       │   │   └── mock-data.ts       # ProcessingJobWithGallery type + phase definitions (no mock data generation)
│       │   ├── galleries/
│       │   │   ├── gallery-detail.tsx  # Gallery detail/settings — deliver button updates job via server API
│       │   │   └── mock-data.ts       # Mock gallery data for demo
│       │   └── ui/
│       │       ├── button.tsx
│       │       ├── combobox.tsx
│       │       ├── confirm-dialog.tsx
│       │       ├── data-table.tsx
│       │       ├── empty-state.tsx
│       │       ├── form-fields.tsx
│       │       ├── modal.tsx
│       │       ├── signature-pad.tsx
│       │       ├── slide-over.tsx
│       │       └── status-badge.tsx
│       ├── lib/
│       │   ├── auth-actions.ts
│       │   ├── contract-queries.ts
│       │   ├── default-contract.ts
│       │   ├── email.ts
│       │   ├── queries.ts            # All Supabase CRUD operations (40+ exported functions)
│       │   ├── types.ts              # TypeScript interfaces — single source of truth
│       │   ├── utils.ts
│       │   └── supabase/
│       │       ├── client.ts
│       │       └── server.ts
│       ├── styles/globals.css
│       ├── middleware.ts              # Auth route protection (excludes /sign, /gallery, /book)
│       └── [config files]
├── services/
│   └── ai-engine/                    # Python FastAPI service (FULLY BUILT)
│       ├── app/
│       │   ├── main.py
│       │   ├── config.py             # Settings + lightweight SupabaseClient via httpx
│       │   ├── routers/
│       │   │   ├── health.py
│       │   │   ├── process.py
│       │   │   └── style.py
│       │   ├── pipeline/
│       │   │   ├── phase0_analysis.py
│       │   │   ├── phase1_style.py
│       │   │   ├── phase4_composition.py
│       │   │   ├── phase5_output.py    # Separate quality settings: full-res 95, web 92, thumb 80
│       │   │   └── orchestrator.py
│       │   ├── storage/
│       │   │   ├── supabase_storage.py
│       │   │   └── db.py
│       │   └── workers/
│       │       └── style_trainer.py
│       ├── .env
│       ├── Dockerfile
│       ├── railway.toml
│       └── requirements.txt
├── supabase/
│   └── migrations/
├── docs/
│   └── Apelier-Master-Document.md
├── CLAUDE-aperture.md
├── packages/shared/
├── package.json
└── turbo.json
```

**queries.ts exported functions (67+):**
`getCurrentPhotographer`, `getClients`, `getClient`, `createNewClient`, `updateClient`, `deleteClient`, `getLeads`, `createLead`, `updateLead`, `deleteLead`, `getJobs`, `createJob`, `updateJob`, `deleteJob`, `getInvoices`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `getGalleries`, `getGallery`, `getGalleryBySlug`, `getGalleryPhotos`, `updateGallery`, `deliverGallery`, `incrementGalleryViews`, `togglePhotoFavorite`, `getPhotographerBranding`, `getDashboardStats`, `syncJobEndTimes`, `getProcessingJobs`, `createProcessingJob`, `updateProcessingJob`, `getPhotos`, `updatePhoto`, `bulkUpdatePhotos`, `getStyleProfiles`, `createStyleProfile`, `updateStyleProfile`, `deleteStyleProfile`, `getEditingJobs`, `uploadPhotoToStorage`, `createPhotoRecord`, `createGalleryForJob`, `getUploadableJobs`, `getPackages`, `createPackage`, `updatePackage`, `deletePackage`, `getBookingEvents`, `getBookingEvent`, `createBookingEvent`, `updateBookingEvent`, `deleteBookingEvent`, `getBookingSlots`, `createBookingSlots`, `updateBookingSlot`, `deleteBookingSlots`

---

## 8. Competitive Landscape

| Feature | Apelier | Studio Ninja | Pic-Time | Aftershoot | Imagen |
|---------|---------|-------------|----------|-----------|--------|
| CRM & Booking | ✅ | ✅ | ❌ | ❌ | ❌ |
| AI Photo Editing | ✅ | ❌ | ❌ | ✅ | ✅ |
| Client Galleries | ✅ | ❌ | ✅ | ❌ | ❌ |
| Prompt-Based Edits | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auto Scene Cleanup | ✅ | ❌ | ❌ | ❌ | ❌ |
| End-to-End Automation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Print Ordering | ✅ (planned) | ❌ | ✅ | ❌ | ❌ |
| Combined cost | $39–279/mo | $28–45/mo | $15–58/mo | $15–30/mo | $7+/mo |
| Separate tools total | — | $68–149/mo combined | — | — | — |

**Studio Ninja weakness:** Acquired by ImageQuix, support quality declined, years of unfulfilled feature requests (bulk email, date-specific workflows). Wide open door for migration.

**AI editing advantage:** Aftershoot requires local processing. Imagen charges $0.05/photo with 3,000–5,000 image training requirement. Apelier: cloud-based, bundled in subscription, only 10–100 RAW+edited pairs to train style.

---

## 9. Package & Invoicing System

### Packages (configured in Settings, stored in Supabase `packages` table)
- Name, price, duration (hours), included images count
- Optional deposit requirement: toggle + percentage (default 25%)
- Active/inactive toggle for quoting
- Changing package duration auto-syncs existing job end times
- Full CRUD: `getPackages`, `createPackage`, `updatePackage`, `deletePackage`
- All pages (settings, jobs, leads, invoices) load packages from Supabase

### Invoice Flow
- **Auto-created on job creation:** When a job is created with a package, invoice(s) are generated automatically
- **Package with deposit:** Creates `INV-{JOB#}-DEP` (deposit %, sent immediately, due 14 days after sent) + `INV-{JOB#}-FIN` (remaining balance, draft, due 14 days before shoot)
- **Package without deposit:** Creates `INV-{JOB#}` (full amount, sent immediately, due 14 days before shoot or 14 days from now)
- **Custom invoices:** Manual line items for one-off billing
- Line item editor with qty × price, adjustable GST %
- **Job status is view-only:** Cannot be manually changed — flows automatically through the workflow stages

### Job Numbering
- Permanent auto-incrementing counter stored on `photographers.next_job_number`
- Atomic increment via `increment_job_number()` RPC — no duplicates even with concurrent requests
- Never resets, even if all jobs are deleted
- Format: `#0001`, `#0002`, etc.

---

## 10. AI Processing Pipeline (6 Phases — FULLY BUILT & TESTED)

**Status:** ✅ End-to-end pipeline runs on Railway (production). Upload → analysis → style → composition → output → Supabase Storage. All DB updates working.

### Phase 0 — Image Analysis (CPU — `phase0_analysis.py`)
- **EXIF extraction:** Camera, lens, ISO, aperture, shutter speed, focal length via Pillow
- **Scene classification:** portrait/group/landscape/detail/ceremony/reception/candid — based on face count + aspect ratio + edge density + colour analysis
- **Quality scoring:** Exposure (histogram spread, clipping), sharpness (Laplacian variance), noise (patch variance), composition (rule-of-thirds) — each 0-100, weighted average
- **Face detection:** Haar cascade, returns bounding boxes
- **Duplicate grouping:** Perceptual hashing (DCT-based), Hamming distance threshold

### Phase 1 — Style Application (CPU — `phase1_style.py`)
- **Preset parsing:** Lightroom `.xmp` and `.lrtemplate` presets parsed via `preset_parser.py` — extracts ~50-80 parameters (exposure, contrast, highlights, shadows, tone curves, HSL shifts, split toning, sharpening, vibrance, clarity, etc.)
- **Preset application:** `apply_preset_params()` applies parsed values to images using LAB/HSV colour space operations — exposure (stops), contrast (S-curve), highlights/shadows/whites/blacks (luminance range masks), HSL per-channel shifts, split toning, clarity (local contrast), vibrance (saturation-aware boost with skin protection), sharpening, vignette, grain
- **Adaptive adjustments:** `compute_adaptive_adjustments()` analyses each image's histogram, exposure, backlit status → computes per-image corrections (exposure shift, shadow lift, highlight recovery, contrast mod, saturation mod)
- **Combined:** `apply_preset_adaptive()` merges preset baseline with per-image adaptive adjustments
- **BUG FIXED (17 Feb):** `apply_preset_adaptive()` had `* 100.0` multiplier on exposure_shift and highlights/shadows_shift — exposure is in stops, so 0.15 shift became 15 stops (2^15 = 32,768× brightness). Fixed to add shift directly for exposure, scale by 30 for highlights/shadows
- **CURRENT STATE:** Histogram matching disabled (overcorrecting — muddy greens, bad skin tones). Preset application fixed but basic adaptive adjustments only until GPU neural approach is built. Reference-only learning produces mediocre results (statistical averaging)
- **NEXT:** GPU neural style transfer via Modal — 3D LUT predictor learns from before/after pairs (see Phase 1 GPU plan below)

### Phase 2 — Face & Skin Retouching (STUB — needs GPU)
- Basic unsharp mask implemented as placeholder
- Architecture ready for SAM 2 / face models when GPU available

### Phase 3 — Scene Cleanup (STUB — needs GPU)
- Skipped, ready for inpainting models (Stable Diffusion / InstructPix2Pix)

### Phase 4 — Composition (CPU — `phase4_composition.py`)
- **Horizon detection:** Hough line detection, weighted average of horizontal lines
- **Straightening:** Rotate if angle >1.0° and <3.0°
- **Crop optimisation:** Interest map (edge density + face regions), find crop maximising thirds alignment, only apply if 1-15% trim

### Phase 5 — QA & Output (CPU — `phase5_output.py`)
- Generate web-res (2048px max), thumbnail (400px max), full-res JPEG
- **Quality settings:** Full-res `jpeg_quality: 95`, web-res `web_quality: 92`, thumbnail `thumb_quality: 80` (separate settings prevent double-compression quality loss)
- Quality-based selection: Top N images by quality score with scene diversity
- Upload all variants to Supabase Storage (`edited/`, `web/`, `thumbs/` folders)

### Orchestrator (`orchestrator.py`)
- Runs all phases sequentially for a gallery
- Updates `processing_jobs` status in real-time (current_phase, processed_images)
- Updates photo records with analysis results, output keys, ai_edits metadata
- Marks unselected photos as culled
- Updates gallery status → `ready`, job status → `ready_for_review`

### Supabase Client (`config.py`)
- Lightweight httpx-based client — no heavy SDK needed
- Methods: `select`, `select_single`, `insert`, `update`, `update_many`, `storage_download`, `storage_upload`
- Built-in numpy type sanitizer for JSON serialization

### Cost Model (verified against Modal pricing, 17 Feb 2026)
- **GPU:** Modal A10G serverless @ US$0.000306/sec + CPU (2 cores) US$0.0000262/sec + RAM (8 GiB) US$0.0000178/sec = **US$0.000350/sec total**
- **Per-image cost (conservative 4s pipeline):** US$0.0014 → **A$0.00217/image** (at 1.55 AUD/USD)
- **Per-image cost (realistic 2s pipeline):** US$0.0007 → **A$0.00108/image**
- **Per wedding (500 photos):** A$0.54 (realistic) to A$1.08 (conservative)
- **Tier margins at max usage (conservative 4s):** Starter A$4.34 GPU/A$39 price = 89% margin | Pro A$21.70/A$109 = 80% | Studio A$54.24/A$279 = 81%
- **Tier margins at realistic 2s:** Starter 94% | Pro 90% | Studio 90%
- **Fixed infra:** Supabase Pro US$25 + Vercel Pro US$20 + Railway Pro US$20 + misc = **~A$104/month** — covered by 2–3 subscribers
- Phases 0/4/5 run on CPU (no extra cost beyond Railway hosting)
- Phases 1/2/3 run on Modal GPU (serverless, zero idle cost)
- **3D LUT approach:** <600K parameters, processes 4K image in <2ms after LUT generation (Zeng et al., 2020). Total pipeline time dominated by LUT prediction + scene analysis, not LUT application

### Local Development
```powershell
# Terminal 1 — AI Engine
cd services/ai-engine
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Next.js
cd apps/web
npm run dev
```

### Production Deployment (Railway)
1. Connect GitHub repo → point to `services/ai-engine` directory
2. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Builds from Dockerfile, serves on `$PORT`
4. Set `AI_ENGINE_URL` in Vercel env vars to Railway URL

---

## 11. Server-Side API Routes (Critical Architecture)

**Why:** The browser Supabase client (anon key) is blocked by RLS for most write operations. All DB mutations go through Next.js API routes that use the service role key to bypass RLS.

### `/api/processing-jobs` (POST) — **The main server-side DB operations route**
Actions:
- **`send_to_gallery`**: All-in-one workflow when photographer clicks "Send to Gallery" in Review Workspace. Updates photos → `delivered`, gallery → `ready` or `delivered` (based on auto_deliver), job → `edited` or `delivered`, deletes processing_job. Accepts `job_id` directly from frontend (with gallery lookup fallback)
- **`update_job_status`**: Update any job's status (used by gallery deliver button). Takes `target_job_id` + `status`
- **`delete`**: Delete a single processing job
- **`clear_all`**: Delete all completed/delivered/failed processing jobs
- **`clear_force`**: Nuclear option — delete ALL processing jobs
- **Env var validation:** Throws error if `SUPABASE_SERVICE_ROLE_KEY` missing

### `/api/gallery-photos` (GET) — Server-side signed URL generation for client gallery
Actions:
- **`photos`**: Batch-signs thumb_url + web_url for all gallery photos (1-hour expiry)
- **`download`**: Single photo download with signed URL (defaults to full-res `edited_key`)
- **`download_all`**: Batch download URLs
- **`check`**: Returns whether gallery has photos

### `/api/gallery-password` (GET/POST) — Gallery password management
- **`check`**: Returns `{has_password: boolean}` for a gallery
- **`set`**: Set/update gallery password
- **`verify`**: Check if entered password matches

### `/api/upload` (POST) — Server-side photo upload to Supabase Storage
- Handles multipart form data, verifies auth, uploads to Storage

### `/api/process` (POST) — Bridge to AI engine
- Forwards to AI engine at `AI_ENGINE_URL`

### `/api/style` (POST) — Bridge to AI engine for style training
- Supports `create`, `status`, `retrain`

### `/api/book` (POST) — Public booking API
- Creates client, job, invoice(s) server-side with service role

### `/api/email` (POST) — Resend email sending
- 5 branded templates

---

## 12. Job Status Flow

```
upcoming → in_progress → editing → ready_for_review → edited → delivered → completed
                                                                    ↓
                                                                canceled
```

**Transitions:**
1. **upcoming → in_progress**: Auto on shoot date
2. **in_progress → editing**: When photos are uploaded
3. **editing → ready_for_review**: When AI processing completes
4. **ready_for_review → edited**: When photographer clicks "Send to Gallery" in Review Workspace (via `/api/processing-jobs` `send_to_gallery` action)
5. **edited → delivered**: When photographer clicks "Deliver to Client" on Gallery detail page (gallery-detail.tsx calls `/api/processing-jobs` `update_job_status` action)
6. **delivered → completed**: When client views gallery AND invoice is paid (future automation)

**Jobs Page Tabs:**
- **Open** (default): All non-closed jobs — upcoming, in_progress, editing, ready_for_review, **edited** (edited stays in Open so photographer can track galleries awaiting delivery)
- **Delivered**: Jobs delivered to client
- **All**: Everything

**DB Constraint:** `jobs_status_check CHECK (status IN ('upcoming', 'in_progress', 'editing', 'edited', 'ready_for_review', 'delivered', 'completed', 'canceled'))` — must be updated if adding new statuses

---

## 13. TODO List (Priority Order)

### High Priority — Revenue-Enabling
1. ~~Client-facing gallery pages~~ ✅ Built with signed URLs and downloads
2. ~~Move packages from localStorage to Supabase~~ ✅ Done
3. ~~Auto-create invoice on job creation~~ ✅ Done
4. ~~Deposit invoice due 14 days after sent~~ ✅ Fixed
5. ~~Job status view-only~~ ✅ Done
6. ~~Booking events system~~ ✅ Built
7. ~~Send to Gallery / Deliver to Client flow~~ ✅ Working end-to-end via server API
8. Stripe payment integration (deposits, final payments, print orders)
9. ~~Wire remaining email templates to their flows (booking confirmation, invoice sent, contract signing)~~ ✅ Code wired — **but Resend account not set up (CRITICAL)**
10. Client-facing quote page (view packages, add extras, accept/decline)

### Booking Events — Still Needed
- ~~Booking auto-creates client + job + invoice~~ ✅ Done
- ~~Booking confirmation email sent on booking~~ ✅ Code wired (needs Resend setup)
- Cover image upload for booking event pages
- Custom questions on booking form

### Gallery-Specific TODO
- ~~Gallery settings in Settings page~~ ✅ Done
- ~~Gallery expiry options~~ ✅ Done
- ~~Sticky "Deliver to Client" bar~~ ✅ Done
- ~~Real images in gallery from Supabase Storage~~ ✅ Done (signed URLs)
- ~~Client-facing gallery shows real images~~ ✅ Done (server-side signed URLs)
- ~~Download buttons work~~ ✅ Done (full-res default)
- **Clean up Galleries page tabs:** ~~Reorder to Ready → Delivered → All~~ ✅ Done 18 Feb
- **Watermarks on client-side gallery page:** Apply photographer's watermark to images shown on `/gallery/[slug]`. Watermark settings already exist in Settings → Branding
- Gallery password hash verification on client page
- Print ordering in client-facing gallery

### Dashboard TODO
- **Overdue invoices tile on Dashboard:** Show count of overdue invoices (due_date past, status not paid) as a prominent tile/alert on the dashboard

### Analytics TODO
- **Change "Completed Jobs" tile to "Delivered Jobs":** Analytics completed jobs stat should pull from `delivered` status instead of `completed` (since completed requires payment + view, most jobs will be in delivered state)

### Medium Priority — Features
11. GPU phases (2 & 3) — skin retouching + scene cleanup
12. Prompt-based per-image editing backend
13. Google OAuth provider setup
14. Apple OAuth provider setup
15. Public contact form (auto-creates leads)
16. Print ordering / e-commerce
17. Migration import wizard (CSV from Studio Ninja, etc.)
18. Custom domain support for galleries
19. Large file upload support (RAW >4.5MB needs direct-to-Supabase with signed URLs)

### Lower Priority — Polish
20. Full UI/UX redesign
21. Native app (iOS/Android)
22. Complete user tutorial/documentation (do this LAST)

---

## 14. Deployment & DevOps

### Local Development
```powershell
cd "C:\Users\mitch\OneDrive\Documents\aperture-suite\apps\web"
npm run dev
# → http://localhost:3000
```

### Build & Deploy
```powershell
# Test build locally first
cd "C:\Users\mitch\OneDrive\Documents\aperture-suite\apps\web"
npx next build

# Push to deploy (Vercel auto-deploys from main)
cd "C:\Users\mitch\OneDrive\Documents\aperture-suite"
git add .
git commit -m "descriptive message"
git push
```

### Supabase Migrations
Run new SQL in Supabase Dashboard → SQL Editor. Migration files stored in `supabase/migrations/` for version control.

**All migrations run ✅:**
1–14 as listed in Section 4 above, plus manual `jobs_status_check` constraint update.

### Environment Variables (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://ibugbyrbjabpveybuqsv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]  ← CRITICAL — all server API routes fail without this
RESEND_API_KEY=[resend api key — get from resend.com/api-keys]
RESEND_FROM_EMAIL=[verified sender email]
AI_ENGINE_URL=https://your-railway-app.railway.app  ← Production Railway URL
```

### AI Engine Environment Variables (`services/ai-engine/.env`)
```
SUPABASE_URL=https://ibugbyrbjabpveybuqsv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

### File Move Commands
All files delivered with PowerShell `Move-Item` commands from Downloads to project directory with `-Force` flag. Git push commands included after every change that needs deploying.

---

## 15. Key Design Decisions

- **Monorepo (Turborepo):** Shared types and constants between frontend and AI service
- **Next.js 14 App Router:** Server components for SEO on public galleries, client components for interactive dashboard
- **Supabase RLS:** Every table has row-level security scoped to `photographer_id` — multi-tenant by default
- **Server API routes for all writes:** Browser Supabase client blocked by RLS — all mutations go through Next.js API routes with service role key. This is the #1 architectural pattern to understand
- **Package-driven automation:** Deposit %, included images, duration — all set per package, inherited by every job using that package
- **Permanent job numbering:** Counter on photographer record, atomic increment, never resets
- **Invoice numbers tied to jobs:** Always traceable (`INV-0001-DEP` tells you exactly which job and what type)
- **AI controls per-step:** Photographers choose how aggressive each AI phase is — from "off" to "auto-fix"
- **Style training from 10–100 RAW+edited pairs:** Much lower barrier than competitors (Imagen needs 3,000–5,000). Photographer uploads matching RAW + edited JPEGs, AI compares pairs to learn exact edits. Multi-style support with named profiles
- **One contract template per photographer:** Simpler than a template library — uses conditional blocks
- **Photographer signature in Settings:** Draw with canvas or upload image. Stored as base64
- **Client signing via public URL:** `/sign/[token]` route excluded from auth middleware
- **Lost leads hidden by default:** Visible in list view with a toggle
- **No mock data in Auto Editor:** Empty states shown when no real data exists — cleaner than fake demo data. Mock data fallback fully removed
- **Gallery deliver flow:** Three-step: Upload creates gallery as `processing` → Pipeline completes (stays `processing`) → Photographer reviews + sends to gallery (`ready`) → Deliver to Client (`delivered`, email sent)
- **RAW file handling:** Phase 0 decodes RAW once via rawpy, converts to full-res JPEG, uploads web preview + thumbnail. All later phases work with JPEG only
- **Images edited billing counter:** Stored on photographer record, incremented by pipeline, persists across photo deletions. Resets monthly via billing_period fields
- **Photo rejection = deletion:** Reject button deletes photo from DB + storage entirely (not soft-delete). Counter already tracked separately
- **Mitchell prefers Claude.ai workflow:** Tried Claude Code but prefers chatting with Claude.ai and getting files to download + Move-Item commands. Don't suggest Claude Code workflow

---

## 16. Storage Tiers & Gallery Expiry (Planned — Not Yet Built)

### Proposed Storage Tiers
- **Hot** — Active/delivered galleries. Full-res + web-res available. Fast CDN delivery (Cloudflare R2). No expiry countdown yet
- **Warm** — Post-expiry. Web-res thumbnails kept for photographer reference. Full-res moved to cheaper storage (Backblaze B2 cold). Client link disabled
- **Cold** — Long-term archive. Only originals stored compressed in B2. No gallery accessible. Photographer can restore on demand

### Gallery Expiry Options (configurable in Settings)
- 7 days / 14 days / 21 days / 30 days / 60 days / 90 days / No expiry
- Default set globally in Settings
- Override per gallery when delivering

---

## 17. Session History

### Session: 16–17 Feb 2026 — Preset Bug Fix, Cost Verification, Investor Pitch
- **CRITICAL BUG FIXED:** `apply_preset_adaptive()` in `phase1_style.py` had `* 100.0` multiplier on `exposure_shift`, `highlights_shift`, and `shadows_shift`. Exposure is in stops — a 0.15 adaptive shift became +15 stops (32,768× brightness), destroying every image. Fixed: exposure shift adds directly in stops, highlights/shadows scale by 30 instead of 100
- **Preset confirmed parsing correctly:** Wedding.xmp preset (highlights -74, shadows +50, vibrance +45, 8 HSL channels, split toning, tone curves) all extracted accurately by `preset_parser.py`
- **Histogram matching previously disabled** (session before) due to overcorrecting — muddy greens, bad skin tones
- **Cost model fully verified** against Modal pricing page (modal.com/pricing). Previous estimates of $0.01–0.017/image were ~10× too high. Actual cost: A$0.001–0.002/image on A10G
- **Investor pitch deck created** (14-slide branded HTML) with correct unit economics, all numbers traced to sources
- **Railway upgraded to Pro** (8GB memory limit, pay-per-use ~$5-10/mo)
- **Style trainer fixed:** One-at-a-time image processing to prevent OOM on 104 training images
- **DB note:** Style profile may be stuck in "training" status after OOM crash — fix: `UPDATE style_profiles SET status = 'ready', training_completed_at = now() WHERE id = '...' AND status = 'training'`

### Features Added (15 Feb 2026 — Railway Deployment, Style Training, Review Workspace)
- AI engine deployed to Railway (production)
- Style training wired end-to-end (upload refs → train → poll status)
- Review workspace loads real photos from Supabase Storage with signed URLs
- Before/after comparison using original_key vs web_key
- Processing queue live polling (3-second interval)

### Features Added (15 Feb 2026 — Send to Gallery, Job Status, Client Gallery)
- **Send to Gallery fully working via server API:** Review workspace calls `/api/processing-jobs` with `send_to_gallery` action. Single server-side call updates photos, gallery, job, and deletes processing_job — all bypassing RLS. `job_id` passed directly from frontend (with gallery lookup fallback)
- **Deliver to Client fully working:** Gallery detail page's "Deliver to Client" button now also calls `/api/processing-jobs` with `update_job_status` action to set job → `delivered` (previously only updated gallery status, not job status)
- **Job status `edited` added:** New status in the flow between `ready_for_review` and `delivered`. Required updating the `jobs_status_check` DB constraint and adding to `JobStatus` TypeScript type
- **Jobs page tabs restructured:** Open (includes edited) → Delivered → All. Removed separate Edited tab. Deliver button removed from jobs page (delivery happens from Galleries page only)
- **Processing queue polish:** Removed mock data generation — shows empty states instead. Smooth 3-second polling without glitching (removed double state update, `pollingActiveRef` prevents duplicate intervals). Phase IDs fixed (`compose` → `composition`, `finalize` → `output`). Removed hover tooltips. Progress never goes backwards
- **Review tab cleanup:** Removed "Clear All" button and X dismiss buttons. Jobs auto-removed when sent to gallery (processing_job deleted)
- **Before/after preview fixed:** Removed fixed `aspect-[3/2]` container, changed to flexible height with `object-contain` — portrait photos no longer cropped
- **Client-facing gallery with signed URLs:** New `/api/gallery-photos` route generates server-side signed URLs (1-hour expiry) for thumb/web/full-res. Client gallery page loads photos via this API. Auto-unlocks if password access but no password set
- **Download buttons work:** Client gallery download calls API for signed URL, triggers browser download. Defaults to full-res (`edited_key`)
- **Image quality improvements:** AI engine outputs full-res at 95 quality, web at 92, thumb at 80 (separate settings prevent double-compression quality loss)
- **New gallery default access type:** `public` instead of `password` (most photographers want public galleries)

### Known Issues (to fix)
- **Cloud files fail upload:** Files synced via OneDrive/cloud that aren't fully downloaded locally cause `ERR_FAILED` on upload. Only locally-available files work
- **DNG/RAW quality:** Internet-sourced DNG files may still look pixelated due to low original quality. Need to test with real camera RAW files (CR2, NEF, ARW) to verify full pipeline
- **Gallery cover image zoomed:** Cover uses `object-cover` which crops to fill — looks zoomed on portrait-heavy images. Consider `object-contain` or smart crop
- **Resend email account not set up:** All email code is wired and working (dev mode logs to console), but no Resend account exists. Need: create account, verify apelier.com.au domain, set RESEND_API_KEY + RESEND_FROM_EMAIL in Vercel env vars. Without this, zero emails actually send to clients

### Next Session Priorities
1. **Resend email setup:** Create Resend account, verify apelier.com.au domain (DNS records), set RESEND_API_KEY + RESEND_FROM_EMAIL env vars in Vercel. Without this, zero emails send — blocks all automation
2. **Subscription tier system (Stripe):** Stripe Checkout for signup, Customer Portal for billing management. Webhook handler for payment events. Tier enforcement middleware (edit limits: Starter 2,000, Pro 10,000, Studio 25,000/month). Usage dashboard in Settings. Free trial flow (14 days, no CC, 50 edits, watermarked galleries). Annual billing (2 months free)
3. **Marketing homepage + pricing page:** Public-facing site at apelier.com.au. Hero, feature showcase, pricing cards, trial signup CTA. Dark theme matching branding guide
4. **CRM import tool:** 6-step wizard to migrate from HoneyBook, Dubsado, Studio Ninja, VSCO Workspace, 17hats, Bloom, Sprout Studio, Pixieset, Light Blue. CSV upload with smart field mapping
5. **Client gallery watermarks:** Server-side or client-side watermark overlay. Enforces free trial limitation
6. **Test RAW pipeline with real camera files:** Need CR2/NEF/ARW files from actual cameras to verify rawpy decode quality
7. **Client-facing quote page:** View packages, add extras, accept/decline
8. **Stripe payment integration (client invoices):** Deposits, final payments, print orders (separate from subscription billing)
9. **Workflows backend (cron/event triggers):** UI exists, no backend
10. **Supabase RLS policies:** Multi-tenant security enforcement

### Session: 18 Feb 2026 — Gallery Fixes, Branding, Email Wiring
- **FIX #3 — Duplicate galleries per job:** `createGalleryForJob()` now checks `getGalleryForJob()` first and returns existing gallery if one exists. Also auto-generates a URL-safe slug on creation
- **FIX #1 — Gallery photo count:** `getGalleries()` now joins photos table, computes active (non-culled) photo count, and returns it as `photo_count`
- **FIX #2 — Gallery cover image:** `getGalleries()` extracts first photo's `thumb_key`, batch-signs URLs, and returns `cover_thumb_url`. Gallery cards display real cover photos instead of Camera icon
- **FIX #4 — Old branding URLs:** Email from-address fallback updated from `noreply@aperturesuite.com` to `noreply@apelier.com.au`
- **FIX #5 — Gallery tab reorder:** Tabs changed from `[all, ready, delivered, processing]` to `[ready, delivered, all]`. Processing tab removed entirely. Default view is now "Ready" so photographer sees galleries awaiting action first
- **FIX #6 — Per-gallery editable settings:** Gallery detail now has a collapsible Settings panel with: editable gallery name (what client sees), description, access type selector (public/password/email/private), expiry dropdown (7/14/30/60/90 days/none), download permissions (full-res/web checkboxes), password field (when access type is password). All saved via `updateGallery()`. Removed "Gallery settings are managed globally" text
- **FIX #7 — Empty review cleanup:** When all photos in a review entry are rejected/culled, the processing job is auto-deleted and user navigates back to editing page
- **FIX #14 — Booking confirmation email wired:** `/api/book` route now sends booking confirmation email via Resend after successful booking, with photographer's branding
- **FIX #10 — Click-to-browse button:** "Add more files" button in upload component now properly triggers `fileInputRef.current?.click()` with `e.stopPropagation()`
- **Indigo → Gold rebrand:** Galleries page, gallery detail, photo upload component, upload progress bar, email brand color defaults all updated from indigo (#6366f1) to gold/amber (#b8860b). Spinners, filter tabs, focus rings, active states all use amber-500
- **Mock data removed:** Galleries page no longer falls back to mock data. Shows empty state when no galleries exist
- **Gallery list refreshes:** Returning from gallery detail view re-fetches gallery data so counts/status are current
- **Gallery type updated:** Added `cover_thumb_key` and `cover_thumb_url` optional fields

### TODO — UI/UX Fixes (17 Feb 2026)
1. ~~**Galleries page restructure:** Re-order tabs to: Ready → Delivered → All~~ ✅ Done 18 Feb
2. **Multiple uploads must merge into one review:** Currently uploading photos multiple times to the same job creates separate review entries. All uploads for a job must consolidate into a single "Ready for Review" entry
3. ~~**Empty review cleanup:** If all images in a "Ready for Review" entry have been rejected and none remain, the review entry should be automatically deleted~~ ✅ Done 18 Feb
4. ~~**Gallery tiles showing 0 photos / no preview:** Gallery cards display "0 photos" and no thumbnail~~ ✅ Done 18 Feb
5. ~~**Per-gallery settings & client-facing name:** Clicking into a gallery needs editable settings~~ ✅ Done 18 Feb

### Session: 20 Feb 2026 (Session 1) — Marketing Site, Railway Fix, Client Gallery Redesign

**Marketing Site — Complete Homepage + Features + Pricing + About (#55, #56, #57, #58 DONE):**
- Full marketing site built with `MarketingLayout` component (navbar, footer, Apelier aperture SVG logo)
- **Homepage (/):** Hero with shimmer-gold animated text + dashboard mockup, "Replaces Your Stack" section (category-based — CRM/Editing/Gallery cards with pricing, NOT competitor name-shaming), Three Pillars (CRM, AI Editing, Galleries), interactive Before/After slider (pointer-event drag, placeholder gradients until real sample photos), 6-step How It Works (3 You + 3 Auto badges), stats section, comparison table (Apelier vs category columns with combined cost row), pricing preview (3 tiers from GTM plan), Migration CTA (CSV Import, Smart Field Mapping, Deduplication, Keeps History badges), Final CTA
- **Pricing page (/pricing):** 3 tier cards (Starter $39, Pro $109, Studio $279) with AI edit limits, annual toggle placeholder, feature comparison, FAQ section, enterprise CTA
- **Features page (/features):** Deep dive on AI Editing, CRM, Galleries with feature grids
- **About page (/about):** Story, mission, Australian-made, founder section
- Design: Dark theme (#0E0E10 bg), gold accents (#C47D4A), Libre Baskerville headings, Manrope/DM Sans body, scroll fade-up animations via IntersectionObserver, mobile responsive

**Branding Foundation Files:**
- `tailwind.config.ts`: Extended with full brand palette (brand-50 through brand-950, night, ink, cream, sand, warm-grey), custom font families (display, sans, body)
- `globals.css`: CSS custom properties for dark theme, gold selection colour, custom scrollbar, shimmer keyframes
- `marketing-layout.tsx`: Shared navbar + footer, ApelierLogo SVG component, mobile hamburger menu

**Railway AI Engine Crash Fix:**
- Railway deployment failed: `ImportError: cannot import name 'settings' from 'app.config'`
- Root cause: `orchestrator.py` and `style.py` import `from app.config import settings, supabase` but config.py only had `get_settings()`/`get_supabase()` functions
- Fix: Added `_LazySettings` and `_LazySupabase` proxy classes to `config.py` with module-level aliases. Both import styles now work

**Homepage Refinement — Removed Competitor Name-Shaming:**
- Replaced 8 named competitor badges with 3 category cards ("Your CRM" / "Your editing app" / "Your gallery host")
- Added time cost visibility ("8–15 hrs/week editing" with Clock icon)
- Comparison table columns changed from "Studio Ninja / Pic-Time / Aftershoot" to "CRM Tool / Editing App / Gallery Host"
- Migration CTA: removed platform name badges, replaced with capability badges (CSV Import, Smart Field Mapping, etc.)
- Added "Combined total" row showing $58–133/mo for separate tools vs $39+ for Apelier

**Client Gallery Redesign (#28 DONE):**
- Complete redesign inspired by Pic-Time galleries
- **Full-bleed hero cover:** 70-80vh viewport hero with first photo (or `cover_photo_url`) as background, gradient overlays, large serif gallery title bottom-left, photographer name + client name + photo count
- **Masonry layout (default):** CSS `columns` for natural aspect ratio flow (no forced crops). Photos stagger-fade-in on scroll via IntersectionObserver with column-based animation delays
- **Minimal chrome:** Toolbar hidden until scroll past hero (400px), then appears as slim glassmorphic bar (white/90 + backdrop-blur-xl). Just essentials: brand circle, title, favourites, download, layout toggle
- **Lightbox redesign:** Click-outside-to-close, near-invisible UI (white/30 icons), gradient fades at top/bottom, no solid bars
- **Layout toggle:** Switch between masonry (editorial) and uniform grid (organised)
- **Photo hover:** Slow 1.02x scale over 700ms, bottom gradient reveals frosted glass action pills
- Password gate: Full redesign with photographer brand circle, uppercase business name, lock icon in input
- Removed Print Shop section (placeholder — will return when print ordering is live)
- All colours updated from gray-100/indigo to Apelier palette (#FAF9F7 cream, #F0ECE5 sand, #B5A999 warm grey, #1A1A1A ink)
- Default brand colour changed from indigo (#6366f1) to gold (#C47D4A)

**Files modified:** `apps/web/tailwind.config.ts`, `apps/web/app/globals.css`, `apps/web/components/marketing/marketing-layout.tsx`, `apps/web/app/page.tsx` (homepage), `apps/web/app/pricing/page.tsx`, `apps/web/app/features/page.tsx`, `apps/web/app/about/page.tsx`, `apps/web/app/gallery/[slug]/page.tsx`, `services/ai-engine/app/config.py`

**Commits:**
- `feat: marketing site + gold rebrand + fix Railway ImportError`
- `feat: remove competitor name-shaming, add category-based messaging`
- `feat: add time cost to replaces section + before/after slider`
- `feat: redesign client gallery with full-bleed hero, masonry layout, minimal chrome`

### Session: 19 Feb 2026 (Session 2) — Editing Style Rewrite, Multi-Style, Signed Uploads, CRM Research

**Editing Style Rewrite — RAW + Edited Pairs (#37 DONE):**
- Completely rewrote EditingStyleSection from single-style 100-300 image upload to multi-style RAW+edited pair training
- Side-by-side drop zones: "RAW Originals" (CR2/NEF/ARW/DNG) and "Edited Versions" (JPEG/PNG/TIFF)
- Automatic filename matching — `IMG_1234.CR2` pairs with `IMG_1234.jpg` via `getBaseName()` stripping extension
- Pair matching status showing matched count, unmatched RAWs, unmatched edits
- Matched pairs preview grid with thumbnails from edited versions
- Multi-style support: create named styles ("Wedding", "B&W", "Film"), each with own pair set
- Style list with status badges, retrain/delete buttons, training comments animation
- NewStyleForm component: name input, pair upload, progress, create via `/api/style`
- Change Style panel added to review workspace — apply different trained styles to individual photos
- Added `/api/process` restyle_photo action → `/api/process/restyle` on AI engine
- Pair count guidance: 10 min, 25 good, 50 ideal, 100 max (variety > volume)
- RAW files upload at full resolution, edited files resize to 1600px
- RAW keys stored in `settings.raw_image_keys`, edited in `reference_image_keys` (backward compatible)

**Signed Upload URLs (#40 DONE):**
- Supabase Storage signed URLs for direct upload, supports up to 50MB (bypasses Vercel 4.5MB body limit)

**CRM Import Research (10 platforms):**
- Documented exact export methods, CSV column headers, and limitations for: HoneyBook, Dubsado, Studio Ninja, VSCO Workspace (formerly Táve), 17hats, Bloom, Sprout Studio, Pixieset, Light Blue, generic CSV
- Key finding: most platforms only export contacts easily; jobs/invoices are the lock-in mechanism
- Designed 6-step import wizard UI with platform-specific instructions and smart field mapping

**Subscription Tier System Planning:**
- Defined tiers from pitch deck: Starter $39/mo (2,000 edits), Pro $109/mo (10,000), Studio $279/mo (25,000)
- Planned Stripe integration: Checkout, webhooks, Customer Portal, tier gates, usage tracking
- Free trial: 14 days, no CC, 50 edits, watermarked galleries

**Email Setup Gap Identified:**
- All 4 email automations (booking, contract, invoice, gallery) have working code
- BUT: no Resend account exists, no domain verification, no API key set — zero emails actually send
- Added as CRITICAL priority #1 for next session

**Files modified:** settings/page.tsx (705 lines changed), review-workspace.tsx (restyle panel), api/process/route.ts (restyle action)

### Session: 19 Feb 2026 (Session 1) — GPU Pipeline Rewrite, RAW Support, Gallery Flow Fixes

**Critical GPU Pipeline Fixes (8 files):**
- **config.py rewritten:** Lazy `settings` and `supabase` module aliases fix ImportError. `_normalise_filters()` auto-converts simple filters to PostgREST format. `update()` accepts `(table, id, data)` directly. `_sanitize()` handles numpy types
- **orchestrator.py complete rewrite (500+ lines):** Calls actual phase functions instead of non-existent `run_phase0/4/5()`. Photo state accumulator tracks `ai_edits`, `quality_score`, `face_data` across all 6 phases. Proper `asyncio` for Modal calls. Real-time progress updates to processing_jobs
- **storage/db.py:** All calls updated to match new config API signatures (was causing 400/406 errors)
- **process.py router:** Fixed `run_pipeline()` call signature, proper async handling in background thread
- **style.py router:** Fixed double-prefix routes, added `/create` endpoint
- **main.py:** Added `/api/process/restyle` endpoint for single-photo restyle
- **Migration 20260219000001:** Added `model_key`, `training_method`, `training_status` etc. to style_profiles

**Phase 0 — 400 Bad Request Fix:**
- Root cause: `quality_score` was numpy float (e.g. 72.5) sent to INTEGER column with CHECK constraint
- Fix: Cast to `int(round())`, sanitise face_data bbox values to native Python types, clean non-serialisable EXIF data

**RAW File Support (DNG, CR2, CR3, NEF, ARW + 15 more formats):**
- Added `decode_raw()` using rawpy for full-resolution RAW processing (tested: 7040×4688 DNG = 33MP)
- Phase 0 decodes RAW once, converts to full-res JPEG, uploads as `edited_key`, generates web preview (2048px) and thumbnail (400px)
- All later phases work with JPEG — no re-downloading/re-decoding the 28MB DNG
- Frontend `PhotoImage` component detects RAW extensions and uses `web_url` for Original panel (browsers can't render DNG)

**Gallery Flow Fixes:**
- Gallery created as `processing` status (was `ready` — caused premature appearance on Galleries page)
- Pipeline sets gallery to `processing` on completion (not `ready` — photographer must explicitly deliver)
- `getGalleries()` only shows `ready`/`delivered` status galleries
- `getGalleryPhotos()` now filters `is_culled = false`
- Reject button now **deletes** photo from DB + storage (was only setting `is_culled: true`)
- New `/api/photos` DELETE endpoint for photo deletion with storage cleanup
- Mock data fallback removed — no more placeholder photos flashing when all rejected

**Composition Fixes:**
- Horizon straightening threshold raised from 0.3° to 1.0° minimum (below 1° is noise/false positive)
- Max angle reduced from 5.0° to 3.0° (less aggressive)
- Border blur fixed: changed from `BORDER_REPLICATE` to `BORDER_CONSTANT` + proper inscribed rectangle crop

**Images Edited Counter:**
- Added `images_edited_count`, `billing_period_start/end` columns to photographers table (migration 20260219000002)
- `increment_images_edited()` RPC function with auto-reset on new billing period
- Orchestrator increments counter via direct update after pipeline completion
- Dashboard + editing page both read from `photographer.images_edited_count` (persists across job deletions)
- Previous approach (counting processing_jobs) broke because jobs get deleted on "Send to Gallery"

**Password Validation on Gallery Delivery:**
- Both review workspace "Send to Gallery" and gallery detail "Deliver" buttons check `access_type === 'password'` and block delivery if no password set
- Public galleries skip the check

**Gold Rebrand Completion:**
- Settings page: 26 indigo references → amber
- Review workspace: 23 indigo references → amber (done in earlier fix)

**Files modified this session:** config.py, orchestrator.py, db.py, process.py, style.py, main.py, phase0_analysis.py, phase4_composition.py, phase5_output.py, queries.ts, review-workspace.tsx, gallery-detail.tsx, editing/page.tsx, dashboard/page.tsx, settings/page.tsx, api/photos/route.ts, api/process/route.ts, 2 migrations

### Session: 18 Feb 2026 (Evening) — Dashboard, Contracts, Invoices, Review Flow
- **Dashboard open jobs:** Stat tile now only counts jobs not in delivered/completed/canceled status
- **Delivery success popup:** Random cute message overlay + auto-redirects to galleries after 2.5s
- **Contract auto-sends on job creation:** `generateContract()` called after job creation, signing email sent to client automatically
- **Contract deposit logic fixed:** Reads `require_deposit` and `deposit_percent` from actual package record in DB. Only shows deposit section if package has deposit enabled
- **Invoice tabs reordered:** Outstanding → Paid → All. Default view is Outstanding. Paid invoices only show in Paid and All tabs
- **Empty review auto-cleanup enhanced:** `getProcessingJobs()` checks completed jobs for active photos, auto-deletes processing jobs with 0 non-culled photos
- **Processing queue stat:** Changed from "Total Images" to "Edited This Month" (filters by current month)
- **Upload job picker:** Today's jobs shown first under "Today" header, other jobs grouped under "Other Jobs", sorted by nearest date
- **Send Back to Review button:** Orange outlined button in gallery detail. Sets gallery to processing (disappears from galleries page), creates completed processing job, redirects to Auto Editor → Review tab
- **Editing page tab param:** Reads `?tab=review` from URL to auto-open review tab (SSG-safe via window.location)
- **Gold rebrand continued:** Dashboard, editing page, invoices page, client gallery brand fallback all updated from indigo to gold/amber
- **All email templates now wired:** Booking confirmation, contract signing, invoice, gallery delivery all auto-send on their respective triggers

**Files modified this session (9):** dashboard/page.tsx, editing/page.tsx, invoices/page.tsx, jobs/page.tsx, gallery-detail.tsx, photo-upload.tsx, queries.ts, contract-queries.ts, processing-jobs/route.ts

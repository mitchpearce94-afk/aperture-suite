# Apelier — Master Document

**Version:** 3.3  
**Last Updated:** 15 February 2026 (booking API auto-creates client/job/invoice, cancel job frees slot, edit event, public slots show booked as greyed out)  
**Project Location:** `C:\Users\mitch\OneDrive\Documents\aperture-suite`  
**GitHub:** `github.com/mitchpearce94-afk/aperture-suite`  
**Live URL:** Deployed on Vercel (auto-deploys from `main` branch)  
**Supabase Project Ref:** `ibugbyrbjabpveybuqsv`  
**Supabase SQL Editor:** `https://supabase.com/dashboard/project/ibugbyrbjabpveybuqsv/sql`  
**Tar command for upload:** `tar -czf aperture-suite.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=dist --exclude=.turbo .`

---

## 1. What Is Aperture Suite?

Aperture Suite is a vertically integrated SaaS platform for photographers that combines CRM/job management (replacing Studio Ninja), client gallery delivery (replacing Pic-Time), and AI-powered photo editing (replacing Aftershoot/Imagen) into a single product.

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
- System auto-generates a **client-facing quote link** (e.g. `yourbrand.aperturesuite.com/quote/abc123`)
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
  5. 👤 Photographer clicks "Approve & Deliver" → Job status changes to **"Delivered"**
  6. Client views gallery AND invoice is paid → Job status auto-changes to **"Completed"**
  7. If invoice is unpaid after delivery → Job stays on "Delivered" with unpaid flag

- **AI processing pipeline (6 phases, 24 steps):**

  **Phase 0 — Analysis:** Scene detection (portrait/landscape/ceremony/reception), face detection, quality scoring (exposure, focus, noise), duplicate grouping, EXIF extraction

  **Phase 1 — Style Application:** Applies photographer's trained style profile (exposure, white balance, contrast, colour grading, shadows, highlights, HSL, tone curve). Trained from 50–200 reference images the photographer uploads (much lower barrier than Imagen's 3,000–5,000 requirement)

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
- 👤 Photographer clicks "Approve & Deliver"
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
| Approve & deliver | 👤 Yes (one click) |
| Everything else | ✅ Automated |

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (React + TypeScript) | Dashboard, client galleries, SSR for SEO |
| Styling | Tailwind CSS | Utility-first responsive design |
| Hosting (Web) | Vercel | Auto-deploys from GitHub `main` branch |
| Database | Supabase (PostgreSQL) | Auth, data, RLS, real-time subscriptions |
| AI Service | Python FastAPI | RAW processing, GPU model inference |
| AI Hosting | Railway or Modal (GPU) | Scalable compute for image processing |
| Storage | Backblaze B2 (S3-compatible) | Photo storage ($0.005/GB vs AWS $0.023/GB) |
| CDN | Cloudflare R2 | Fast gallery delivery, watermarking |
| Queue | BullMQ (Redis) | Job queue for AI processing pipeline |
| Payments | Stripe + Stripe Connect | Client payments, photographer payouts |
| Email | Resend or Postmark | Transactional + marketing automations |
| AI/ML | LibRAW, Pillow, OpenCV, PyTorch | Image processing, style transfer, inpainting |

---

## 4. Database Schema (Supabase PostgreSQL)

**14 tables + 3 new tables + RLS policies per photographer. 14 migrations applied:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `photographers` | User accounts | auth_user_id, name, email, business_name, subscription_tier, next_job_number, contract_template, signature_image |
| `clients` | Client records | photographer_id, first_name, last_name, email, phone, address, tags, source, notes |
| `leads` | Sales pipeline | photographer_id, client_id, status (new/contacted/quoted/booked/lost), job_type, preferred_date, package_name, estimated_value, source, notes, location |
| `jobs` | Confirmed bookings | photographer_id, client_id, job_number, title, job_type, status (upcoming/in_progress/editing/ready_for_review/delivered/completed/canceled), date, time, end_time, location, package_name, package_amount, included_images, booking_slot_id, notes |
| `invoices` | Billing | photographer_id, client_id, job_id, invoice_number, invoice_type (deposit/final/custom), status, line_items (JSONB), amount, tax, currency, total, due_date, paid_date |
| `contracts` | Agreements & e-signing | photographer_id, job_id, client_id, name, content, merge_tags, is_default, status (draft/sent/viewed/signed), signing_token (UUID), signature_data (JSONB), client_signed_at, client_ip, expires_at, viewed_at, sent_at |
| `packages` | Service packages | photographer_id, name, description, price, duration_hours, included_images, deliverables, is_active, require_deposit, deposit_percent, sort_order |
| `booking_events` | Bookable sessions | photographer_id, title, description, location, package_id, custom_price, slot_duration_minutes, buffer_minutes, slug, is_published, status (draft/published/closed/archived), auto_create_job, auto_create_invoice |
| `booking_slots` | Time slots within events | event_id, photographer_id, date, start_time, end_time, status (available/booked/blocked/canceled), client_id, job_id, booked_name, booked_email, booked_phone, booked_answers, booked_at |
| `galleries` | Photo collections | photographer_id, job_id, client_id, title, description, slug, access_type, download_permissions, brand_override, expires_at, status, view_count, photo_count |
| `photos` | Individual images | gallery_id, photographer_id, original_key, edited_key, web_key, thumb_key, watermarked_key, filename, file_size, width, height, exif_data, scene_type, quality_score, face_data, ai_edits, manual_edits, prompt_edits, status, star_rating, color_label, is_culled, is_favorite, is_sneak_peek, sort_order, section, edit_confidence, needs_review |
| `style_profiles` | AI editing styles | photographer_id, name, description, reference_image_keys, model_weights_key, settings (JSONB), status (pending/training/ready/error) |
| `processing_jobs` | AI queue | photographer_id, gallery_id, style_profile_id, total_images, processed_images, current_phase, status (queued/processing/completed/failed/canceled) |
| `workflows` | Automation rules | photographer_id, name, trigger, actions (JSONB), is_active, conditions (JSONB) |
| `templates` | Email/message templates | photographer_id, name, type, subject, body, merge_tags |
| `workflow_actions` | Executed automations | workflow_id, action_type, status, executed_at, result |
| `audit_log` | Activity tracking | photographer_id, action, entity_type, entity_id, details (JSONB) |

**Supabase Storage:**
- `photos` bucket — 100MB per file limit, accepts JPEG/PNG/WEBP/TIFF/RAW formats (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2). RLS policies enforce photographer-scoped folder access (`photos/{photographer_id}/...`)

**Migrations applied:**
1. `20260213000000_initial_schema.sql` — Core 14 tables
2. `20260214000001_add_invoice_type.sql` — invoice_type column
3. `20260214000002_add_job_number.sql` — job_number + next_job_number counter
4. `20260214000003_add_job_time.sql` — time + end_time columns
5. `20260214000004_job_number_counter.sql` — Atomic RPC function `increment_job_number()` for permanent job numbering
6. `20260214000005_fix_rls_policies.sql` — **Critical:** Proper INSERT/UPDATE/DELETE policies with `WITH CHECK` for all tables
7. `20260214000006_contract_signing.sql` — Contract signing fields + anon RLS policies for public contract signing
8. `20260214000006_add_ready_for_review_status.sql` — `ready_for_review` job status + `included_images` column on jobs
9. `20260214000007_photographer_signature.sql` — `signature_image` on photographers
10. `20260214000007_create_photos_storage.sql` — `photos` storage bucket with RLS policies for photographer-scoped upload/view/delete
11. `20260215000001_gallery_delivery.sql` — Gallery delivery features
12. `20260215000002_create_packages_table.sql` — `packages` table (moved from localStorage to Supabase) with full RLS + updated_at trigger ✅ Run
13. `20260215000003_booking_events_slots.sql` — `booking_events` + `booking_slots` tables with RLS (authenticated + anon for published events), slug auto-generation trigger, updated_at trigger ✅ Run
14. `20260215000004_job_booking_slot_link.sql` — `booking_slot_id` FK on jobs table linking to booking_slots, enables cancel/restore to free/re-book slots ✅ Run
11. `20260215000001_gallery_delivery.sql` — Gallery delivery: photographer gallery defaults columns, `password_hash` + `delivered_at` on galleries, unique slug index + auto-slug trigger, `increment_gallery_views()` RPC, anon RLS policies for public gallery/photo/photographer access
11. `20260215000001_gallery_delivery.sql` — Gallery delivery features: photographer gallery defaults, password_hash, delivered_at, slug unique index, auto-slug trigger, `increment_gallery_views()` RPC, anon RLS for public gallery/photo/photographer access, anon photo favourite updates ⚠️ Run this

---

## 5. Current Build Status

### ✅ Fully Working
- **Auth:** Signup, login, logout, route protection via middleware, OAuth callback ready (Google/Apple buttons in UI, needs provider credentials in Supabase). Dynamic user initials in header from photographer profile
- **Dashboard:** Live stats from Supabase (total clients, leads, jobs, revenue), upcoming shoots, recent leads, gallery status
- **Clients:** Full CRUD — add, search, click-to-view slide-over, edit, delete. Searchable with tags/source/revenue tracking
- **Leads:** Full CRUD — add (new or existing client via searchable combobox), pipeline kanban view + list view, status transitions, package selector, edit slide-over, delete. Lost leads hidden from pipeline, visible in list with toggle. Sorted by preferred date (soonest first)
- **Jobs:** Full CRUD — add with package selector (auto-fills price, images, calculates end time from duration), permanent job numbering (#0001+), status tabs (including ready_for_review), cancel/restore, edit, delete. Time + end time fields throughout
- **Invoices:** Full CRUD — create custom or auto-generate from job. Deposit/final split based on package settings (25% default deposit). Job-linked invoice numbers (INV-0001-DEP/FIN). Line item editor, GST calculation, status management
- **Calendar:** Monthly view with colour-coded jobs, navigate months, today button, job detail popups with time ranges
- **Contracts:** E-sign system — single universal template with conditional deposit/no-deposit sections, 10 sections covering all scenarios, merge tags auto-filled from job/client data. Public signing page (`/sign/[token]`) with canvas signature pad (draw with mouse/finger, multi-stroke support with confirm/clear). Photographer signature stored in Settings (draw or upload). Both signatures shown on signed contract. Signing captures IP, user agent, timestamp. Contract status tracking (draft → sent → viewed → signed). Copy signing link from contracts list
- **Workflows:** 6 pre-built automation presets (lead auto-response, booking confirmation, pre-shoot reminder, post-shoot with 48hr review email, gallery delivery, payment reminders). All deposit-aware. Toggle on/off. Preview mode
- **Analytics:** Period filters, revenue/booked/conversion stats, bar chart revenue by month, lead source + job type breakdowns
- **Auto Editing (AI Workspace):**
  - **Photo Upload tab:** Select a job → drag-and-drop or click to upload RAW/JPEG files. Accepts CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, TIFF, JPEG, PNG, WEBP. Shows per-file upload progress, auto-creates gallery for job, uploads to Supabase Storage (`photos/{photographer_id}/{gallery_id}/originals/`), creates photo records in DB. Real Supabase integration (queries: `getUploadableJobs`, `uploadPhotoToStorage`, `createPhotoRecord`, `createGalleryForJob`)
  - **Processing Queue tab:** Stats cards (processing/queued/completed/total images). Processing cards with 6-phase progress indicator (Analysis → Style → Retouch → Cleanup → Composition → QA). Each phase shows tooltip with description on hover. Click to review when complete
  - **Review Workspace:** Full photo review UI with grid view, section filters (ceremony/reception/portraits/etc.), status filters (all/edited/approved/needs review). Click photo to enlarge with before/after. Approve/reject individual photos. Star ratings. Bulk select mode. Prompt-based editing chat input per photo. "Send to Gallery" button to deliver approved photos. Stats bar showing total/edited/approved/needs review/culled counts
  - **Style profiles:** Create style flow modal with name/description → upload 100-200+ reference images (min 100, recommended 200, max 300) → trains style. Accepted formats: JPEG, PNG, WEBP, TIFF. Upload progress tracking
  - Falls back to **mock data** when no real processing jobs exist — shows demo content with "Showing demo data" banner
- **Galleries:**
  - Dashboard page with grid cards showing cover placeholder, status badge, access type icon, photo count
  - Status filters (all/ready/delivered/processing/draft), search
  - Gallery card actions: copy gallery link, deliver button (when ready), view externally (when delivered)
  - Gallery detail view with settings panel (access type, expiry dropdown 7/14/21/30/60/90/no expiry, download permissions toggles), saves settings to Supabase
  - Photo lightbox with keyboard nav (arrow keys, Escape), photo counter, section label
  - Sticky "Deliver to Client" bar at bottom when gallery status is `ready` — confirm flow, sends gallery delivery email via Resend
  - Real photo loading from Supabase with mock fallback
  - Queries: `getGallery`, `getGalleryBySlug`, `getGalleryPhotos`, `updateGallery`, `deliverGallery`, `incrementGalleryViews`, `togglePhotoFavorite`, `getPhotographerBranding`
- **Client-Facing Gallery (`/gallery/[slug]`):**
  - Public route excluded from auth middleware (like `/sign`)
  - Loads gallery + photos from Supabase by slug
  - Password gate for password-protected galleries
  - Photographer branding (logo initial, colours, business name)
  - Section filters, favourites filter (heart button), grid size toggle (large/small)
  - Photo lightbox with keyboard nav, favourite toggle
  - Client can toggle favourites (saved to Supabase via anon RLS)
  - Download button (when download permissions allow)
  - Gallery expiry check — shows error if expired
  - View count auto-incremented via `increment_gallery_views()` RPC
  - Footer with "Powered by Aperture Suite"
- **Email Integration (Resend):**
  - API route at `/api/email` — accepts template name, recipient, and data
  - 5 email templates: gallery_delivery, booking_confirmation, invoice, contract_signing, reminder
  - All templates are branded with photographer's colour and business initial
  - Dev mode: logs emails when `RESEND_API_KEY` not configured
  - Helper functions in `lib/email.ts`: `sendGalleryDeliveryEmail`, `sendBookingConfirmationEmail`, `sendInvoiceEmail`, `sendContractSigningEmail`
  - Gallery delivery wired: "Deliver to Client" button sends branded email with gallery link to client
- **Settings:**
  - Business Profile — saves to Supabase
  - Packages — name, price, duration, included images, description, deposit toggle + deposit %, active toggle. Updates existing job end times when duration changes
  - Branding — primary/secondary colours with contrast-aware preview, logo upload, watermark/download toggles
  - Contract Template — preview/edit modes, merge tag click-to-insert, conditional block helpers (deposit/no-deposit), reset to default. Photographer signature section with draw (multi-stroke canvas) or upload image
  - Notifications — email toggles, auto follow-up timing, overdue reminders
  - Billing — plan display, Stripe placeholder
- **Responsive Design:** Full mobile/tablet pass — collapsible sidebar with hamburger menu, sticky header, no horizontal scroll, responsive grids, mobile-optimised modals/slide-overs, horizontal scroll tabs
- **Deployment:** Live on Vercel, auto-deploys from GitHub main branch

### 🔧 Built but Not Yet Connected to Real Backend
- **Workflows:** UI only, email templates exist but workflow triggers not wired to automatic scheduling
- **Analytics:** Uses Supabase data but some mock calculations
- **Branding:** Logo upload is local preview only (needs file storage)
- **Auto Editing — Processing Queue & Review:** Upload infrastructure is real (Supabase Storage + queries), but AI processing pipeline (Python FastAPI) not yet running, so processing queue and review workspace use mock data for demo purposes
- **Style profile training:** UI and upload flow built, backend training not connected
- **Gallery images:** Photo placeholders shown (Camera icon) — real image display needs Supabase Storage URL integration for thumbnails/web-res
- **Email sending:** Resend API route built, gallery delivery email wired, but requires `RESEND_API_KEY` env var to actually send (logs in dev mode without it). Booking/invoice/contract emails have templates but aren't wired to their respective flows yet
- **Gallery password protection:** Password gate UI built on client-facing page, but actual hash verification not implemented (accepts any input currently)

### ❌ Not Yet Built
- **AI processing pipeline running** (Python service with 6 phases — FastAPI scaffolded but no actual image processing)
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
- Before writing any create/update function, check the type definition first

### Rule 2: queries.ts functions handle photographer_id internally
- Every create function (`createNewClient`, `createLead`, `createJob`, `createInvoice`) calls `getCurrentPhotographer()` internally and adds `photographer_id` to the insert
- **NEVER pass `photographer_id` from a page component** — it will cause a TypeScript error because it's not in the function's param type
- If a page needs the photographer ID for display purposes, fetch it separately via `getCurrentPhotographer()`

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
- Always capitalise variables that hold components before using in JSX

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
│       │   │   ├── bookings/page.tsx  # Booking events management (create events, generate slots, publish)
│       │   │   ├── contracts/page.tsx
│       │   │   ├── workflows/page.tsx
│       │   │   ├── analytics/page.tsx
│       │   │   ├── editing/page.tsx   # AI editing workspace (3 tabs: upload/queue/review)
│       │   │   ├── settings/page.tsx
│       │   │   └── layout.tsx
│       │   ├── sign/[token]/page.tsx  # Public contract signing page
│       │   ├── book/[slug]/page.tsx  # Public client-facing booking page
│       │   ├── gallery/[slug]/page.tsx # Public client-facing gallery page
│       │   ├── api/
│       │   │   └── email/route.ts     # Resend email API (gallery delivery, booking, invoice, contract, reminder)
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
│       │   │   ├── review-workspace.tsx # Full photo review UI with filters, approve/reject, prompt chat
│       │   │   ├── style-upload.tsx    # Style profile creation flow (name → upload refs)
│       │   │   └── mock-data.ts       # Mock processing jobs, photos, phases for demo
│       │   ├── galleries/
│       │   │   ├── gallery-detail.tsx  # Gallery detail/settings panel
│       │   │   └── mock-data.ts       # Mock gallery data for demo
│       │   └── ui/
│       │       ├── button.tsx
│       │       ├── combobox.tsx       # Searchable client dropdown
│       │       ├── confirm-dialog.tsx
│       │       ├── data-table.tsx
│       │       ├── empty-state.tsx
│       │       ├── form-fields.tsx
│       │       ├── modal.tsx
│       │       ├── signature-pad.tsx  # Reusable draw/upload signature (multi-stroke, confirm/clear)
│       │       ├── slide-over.tsx
│       │       └── status-badge.tsx
│       ├── lib/
│       │   ├── auth-actions.ts
│       │   ├── contract-queries.ts    # Contract-specific Supabase operations (generate, sign, mark viewed)
│       │   ├── default-contract.ts    # Default contract template constant
│       │   ├── email.ts              # Email sending helpers (sendGalleryDeliveryEmail, sendBookingConfirmationEmail, etc.)
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
│   └── ai-engine/                    # Python FastAPI service (scaffolded)
│       ├── app/
│       │   ├── main.py
│       │   ├── routers/
│       │   │   ├── health.py
│       │   │   ├── process.py
│       │   │   └── style.py
│       │   ├── pipeline/             # 6-phase AI processing (empty, to be built)
│       │   ├── models/
│       │   ├── storage/
│       │   └── workers/
│       ├── Dockerfile
│       ├── railway.toml
│       └── requirements.txt
├── supabase/
│   └── migrations/                   # SQL migrations (run in Supabase Dashboard SQL Editor)
│       ├── 20260213000000_initial_schema.sql
│       ├── 20260214000001_add_invoice_type.sql
│       ├── 20260214000002_add_job_number.sql
│       ├── 20260214000003_add_job_time.sql
│       ├── 20260214000004_job_number_counter.sql
│       ├── 20260214000005_fix_rls_policies.sql
│       ├── 20260214000006_contract_signing.sql
│       ├── 20260214000006_add_ready_for_review_status.sql
│       ├── 20260214000007_photographer_signature.sql
│       ├── 20260214000007_create_photos_storage.sql
│       ├── 20260215000001_gallery_delivery.sql
│       ├── 20260215000002_create_packages_table.sql
│       └── 20260215000003_booking_events_slots.sql
├── docs/
│   ├── Aperture-Suite-Master-Document.md
│   ├── Aperture-Suite-Overview-For-Partner.md
│   └── Aperture-Suite-Overview-For-Partner.pdf
├── CLAUDE-aperture.md                # Claude Code briefing file
├── packages/shared/                  # Shared types/constants
├── package.json                      # Root monorepo config (includes packageManager field for Vercel)
└── turbo.json                        # Turborepo build config (uses "tasks" not "pipeline")
```

**queries.ts exported functions (67+):**
`getCurrentPhotographer`, `getClients`, `getClient`, `createNewClient`, `updateClient`, `deleteClient`, `getLeads`, `createLead`, `updateLead`, `deleteLead`, `getJobs`, `createJob`, `updateJob`, `deleteJob`, `getInvoices`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `getGalleries`, `getGallery`, `getGalleryBySlug`, `getGalleryPhotos`, `updateGallery`, `deliverGallery`, `incrementGalleryViews`, `togglePhotoFavorite`, `getPhotographerBranding`, `getDashboardStats`, `syncJobEndTimes`, `getProcessingJobs`, `createProcessingJob`, `updateProcessingJob`, `getPhotos`, `updatePhoto`, `bulkUpdatePhotos`, `getStyleProfiles`, `createStyleProfile`, `updateStyleProfile`, `deleteStyleProfile`, `getEditingJobs`, `uploadPhotoToStorage`, `createPhotoRecord`, `createGalleryForJob`, `getUploadableJobs`, `getPackages`, `createPackage`, `updatePackage`, `deletePackage`, `getBookingEvents`, `getBookingEvent`, `createBookingEvent`, `updateBookingEvent`, `deleteBookingEvent`, `getBookingSlots`, `createBookingSlots`, `updateBookingSlot`, `deleteBookingSlots`

---

## 8. Competitive Landscape

| Feature | Aperture Suite | Studio Ninja | Pic-Time | Aftershoot | Imagen |
|---------|---------------|-------------|----------|-----------|--------|
| CRM & Booking | ✅ | ✅ | ❌ | ❌ | ❌ |
| AI Photo Editing | ✅ | ❌ | ❌ | ✅ | ✅ |
| Client Galleries | ✅ | ❌ | ✅ | ❌ | ❌ |
| Prompt-Based Edits | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auto Scene Cleanup | ✅ | ❌ | ❌ | ❌ | ❌ |
| End-to-End Automation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Print Ordering | ✅ (planned) | ❌ | ✅ | ❌ | ❌ |
| Combined cost | $39–89/mo | $28–45/mo | $15–58/mo | $15–30/mo | $7+/mo |
| Separate tools total | — | $68–149/mo combined | — | — | — |

**Studio Ninja weakness:** Acquired by ImageQuix, support quality declined, years of unfulfilled feature requests (bulk email, date-specific workflows). Wide open door for migration.

**AI editing advantage:** Aftershoot requires local processing. Imagen charges $0.05/photo with 3,000–5,000 image training requirement. Aperture Suite: cloud-based, bundled in subscription, only 50–200 reference images to train style.

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

## 10. AI Processing Pipeline (6 Phases, 24 Steps)

### Phase 0 — Image Analysis
Scene type detection, face detection + counting, quality scoring (exposure, focus, noise, composition), duplicate/burst grouping, EXIF metadata extraction

### Phase 1 — Style Application
Apply photographer's trained style profile: exposure, white balance, contrast, colour grading, shadows, highlights, HSL, tone curve. Style learned from 50–200 reference images.

### Phase 2 — Face & Skin Retouching
Skin smoothing (texture-preserving), blemish/acne removal, stray hair cleanup, red-eye removal, subtle teeth whitening

### Phase 3 — Scene Cleanup
Background person/distraction removal, exit sign removal, power line removal, lens flare removal, trash/bright distraction removal in venue shots

### Phase 4 — Composition
Horizon straightening, crop optimisation, rule-of-thirds alignment

### Phase 5 — QA & Output
Final quality check, generate web-res + thumbnail + full-res outputs, verify all images processed, select top N based on package's included images count

### Photographer Controls
Every automated step has a configurable level: Off → Flag Only → Auto-Fix. Set defaults once, override per-shoot.

### Prompt-Based Editing (Edge Cases)
For the ~5% of images the AI doesn't get perfect:
- Natural language prompts per image ("remove the person in the background")
- Draw + prompt for precision masking
- Click + prompt for quick removals
- Batch prompts across multiple images
- Conversational refinement ("make it more subtle")
- Powered by: Grounding DINO + SAM 2 (auto-detection) → Stable Diffusion inpainting / InstructPix2Pix (editing)
- Non-destructive with full undo history

---

## 11. Migration Strategy

### Supported Import Sources
- **Studio Ninja:** CSV export of clients, leads, jobs
- **HoneyBook:** CSV contacts export
- **Dubsado:** CSV client data
- **17hats:** CSV export
- **Táve:** CSV export
- **Lightroom:** Style/preset import for AI training

### Smart Import Features
- AI auto-detects column mappings ("First Name" vs "fname" vs "Client First Name")
- Platform-specific importers ("I'm coming from Studio Ninja")
- Template Recreation Assistant: paste contract text → AI structures it with merge tags
- Concierge migration service: free with annual plans

---

## 12. TODO List (Priority Order)

### High Priority — Revenue-Enabling
1. ~~Client-facing gallery pages~~ ✅ Built
2. ~~Move packages from localStorage to Supabase~~ ✅ Done (migration 12, full CRUD in queries.ts, all pages updated)
3. ~~Auto-create invoice on job creation~~ ✅ Done (respects deposit settings from package, creates deposit + final or single invoice)
4. ~~Deposit invoice due 14 days after sent (not immediately)~~ ✅ Fixed
5. ~~Job status view-only (not manually editable)~~ ✅ Done (status buttons and edit dropdown removed)
6. ~~Booking events system~~ ✅ Built (photographer creates events with time slots, publishes, clients book via `/book/[slug]`)
7. Stripe payment integration (deposits, final payments, print orders)
8. Wire remaining email templates to their flows (booking confirmation, invoice sent, contract signing — templates exist, just need triggering)
9. Client-facing quote page (view packages, add extras, accept/decline — triggers booking flow)
10. ~~Email sending~~ ✅ Built (Resend API route + 5 templates — needs RESEND_API_KEY env var + wiring to remaining flows)

### Booking Events — Still Needed
- ~~Booking auto-creates client + job + invoice~~ ✅ Done (API route `/api/book` handles everything server-side with service role)
- Booking confirmation email sent on booking
- Cover image upload for booking event pages
- Custom questions on booking form (schema supports it, UI not yet built)

### Gallery-Specific TODO
- ~~Gallery settings should live in the Settings page (global defaults)~~ ✅ Done
- ~~Gallery expiry options~~ ✅ Done
- ~~Sticky "Deliver to Client" bar~~ ✅ Done
- Images in gallery should show actual images from Supabase Storage (currently placeholders)
- Gallery password verification (currently accepts any input — needs hash comparison)
- Print ordering in client-facing gallery

### Medium Priority — Features
11. AI processing pipeline running (Python FastAPI service — scaffolded, needs actual image processing logic)
12. Style profile training backend (model training from reference images — UI built)
13. Google OAuth provider setup (credentials in Supabase — buttons already in UI)
14. Apple OAuth provider setup
15. Prompt-based per-image editing backend (chat UI built in review workspace, needs AI inference)
16. Public contact form (auto-creates leads from website)
17. Print ordering / e-commerce in client galleries
18. Migration import wizard (CSV from Studio Ninja, HoneyBook, etc.)
19. Custom domain support for galleries

### Lower Priority — Polish
20. Full UI/UX redesign (move beyond dark prototype aesthetic)
21. Native app (iOS/Android — React Native or Expo)
22. Complete user tutorial/documentation (in-app walkthrough + standalone — do this LAST so nothing gets missed)

---

## 13. Deployment & DevOps

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

**Migrations that MUST be run in Supabase SQL Editor (in order):**
1. `20260213000000_initial_schema.sql` — Core 14 tables ✅ Run
2. `20260214000001_add_invoice_type.sql` — `invoice_type` column on invoices ✅ Run
3. `20260214000002_add_job_number.sql` — `job_number` column on jobs ✅ Run
4. `20260214000003_add_job_time.sql` — `time` + `end_time` columns on jobs ✅ Run
5. `20260214000004_job_number_counter.sql` — `next_job_number` on photographers + `increment_job_number()` RPC ✅ Run
6. `20260214000005_fix_rls_policies.sql` — **Critical:** Proper INSERT policies with `WITH CHECK` for all tables ✅ Run
7. `20260214000006_contract_signing.sql` — Contract signing fields + anon RLS policies ✅ Run
8. `20260214000006_add_ready_for_review_status.sql` — `ready_for_review` job status + `included_images` column ⚠️ Check if run
9. `20260214000007_photographer_signature.sql` — `signature_image` on photographers ✅ Run
10. `20260214000007_create_photos_storage.sql` — `photos` storage bucket + RLS policies ⚠️ Check if run
11. `20260215000001_gallery_delivery.sql` — Gallery delivery features ✅ Run
12. `20260215000002_create_packages_table.sql` — `packages` table with RLS + updated_at trigger ✅ Run
13. `20260215000003_booking_events_slots.sql` — `booking_events` + `booking_slots` tables with RLS, anon policies, slug trigger ✅ Run
14. `20260215000004_job_booking_slot_link.sql` — `booking_slot_id` FK on jobs for cancel/restore slot sync ✅ Run

### Bugs Fixed (14 Feb 2026 — All Sessions)
- **Wrong function imports:** `clients/page.tsx` and `leads/page.tsx` imported `createClient` instead of `createNewClient`
- **RLS INSERT blocked:** Original policies used `FOR ALL USING(...)` which doesn't cover INSERT — fixed with separate `FOR INSERT WITH CHECK` policies
- **Dashboard stats mismatch:** Dashboard expected `total_clients` etc. but `getDashboardStats()` returns `totalClients` — aligned field names
- **photographer_id passed to create functions:** Pages passed `photographer_id` but the functions handle it internally — removed from all pages (clients, leads, jobs, invoices)
- **Invoice field mismatch:** `createInvoice` used `subtotal/tax_rate/tax_amount` but Invoice type uses `amount/tax/currency` — aligned queries.ts to match types.ts
- **Job title type error:** `createJob` required `title` as `string` but pages passed `undefined` — made optional
- **Missing `location` on createLead:** Lead type has `location` but `createLead` params didn't include it — added
- **`shoot_date` vs `date`:** `getJobs()` and `getDashboardStats()` used `shoot_date` in queries but database column is `date` — caused 400 errors on all job fetches
- **Missing database columns:** `time`, `end_time`, `job_number`, `next_job_number` columns didn't exist until migrations 2-4 were run
- **+New button in header:** Removed placeholder button from top-bar that had no functionality
- **Mobile horizontal scroll:** Added `overflow-x: hidden` to html/body and `max-w-full` wrapper around main content
- **Header not sticky:** Wrapped TopBar in `sticky top-0` container so it stays fixed while scrolling content
- **Invoicing timing corrected:** Final invoices auto-sent 28 days before shoot (not on booking), due 14 days before shoot
- **Logout dropdown not showing:** `overflow-hidden` on `<header>` element and parent layout div clipped the absolute-positioned dropdown — removed, moved overflow control to main content area only
- **Signature pad locking on mouse release:** Separated `stopDrawing` from `saveSignature` — added Confirm/Clear buttons for multi-stroke drawing
- **Vercel build: missing `packageManager`:** Added `"packageManager": "npm@10.8.2"` to root `package.json`
- **Vercel build: `pipeline` renamed to `tasks`:** Updated `turbo.json` for Turbo v2
- **Gallery detail `accessIcon` lowercase:** Renamed to `AccessIcon` (capital A) — React treats lowercase JSX as HTML elements
- **Hardcoded user initials "MP":** Updated top bar to fetch name from photographers table with auth metadata fallback

### Features Added (15 Feb 2026 — Gallery & Email Session)
- **Gallery detail rewrite:** Settings panel with access type selector, expiry dropdown (7/14/21/30/60/90/no expiry), download permission toggles — all save to Supabase
- **Photo lightbox in gallery detail:** Click any photo → full-screen view with keyboard nav (←/→/Escape), photo counter, section labels
- **Sticky deliver bar:** Fixed bottom bar on gallery detail when status is `ready` — shows photo count, settings, confirm dialog before delivery
- **Deliver to client sends email:** Gallery delivery triggers Resend email with branded template, gallery link, photo count, expiry date
- **Client-facing gallery page (`/gallery/[slug]`):** Public route, password gate, photographer branding, section filters, favourites, grid size toggle, lightbox, download buttons, expiry check, view tracking
- **Email API route (`/api/email`):** Resend integration with 5 branded templates (gallery_delivery, booking_confirmation, invoice, contract_signing, reminder). Dev mode logging when no API key
- **Email helpers (`lib/email.ts`):** Convenience functions for each email type
- **Gallery default settings in Settings page:** Default expiry, access type, download permissions
- **Gallery slug auto-generation:** Database trigger auto-generates URL-safe slug from title on insert
- **Anon RLS policies:** Public access to delivered galleries, photos, photographer branding for client-facing gallery
- **`increment_gallery_views()` RPC:** Atomic view count increment callable by anonymous users

### Features Added (15 Feb 2026 — Packages, Invoicing, Bookings Session)
- **Packages moved to Supabase:** New `packages` table with full CRUD (`getPackages`, `createPackage`, `updatePackage`, `deletePackage`). All pages (settings, jobs, leads, invoices) now load packages from Supabase instead of localStorage. Zero localStorage references remain
- **Auto-invoice on job creation:** When a job is created with a package amount, invoice(s) are auto-generated. Respects deposit settings: if deposit required → deposit invoice (sent, due 14 days) + final invoice (draft, due 14 days before shoot). If no deposit → single invoice (sent, due 14 days before shoot or 14 days from now)
- **Deposit invoice due date fixed:** Changed from "due immediately" to "due 14 days after sent" — both in auto-generate on invoices page and auto-create on job creation
- **Job status is view-only:** Removed clickable status toggle buttons from job detail slide-over. Removed status dropdown from job edit form. Status now displayed as a badge only — changes automatically through the workflow (upcoming → in_progress → editing → ready_for_review → delivered → completed)
- **Booking Events page (`/bookings`):** Photographer creates booking events (e.g. "Christmas Mini Sessions 2026") with title, description, location, linked package or custom price, slot duration, buffer time. Generate time slots by adding dates + time ranges — auto-calculates slots. Publish/unpublish events, copy shareable booking link, view booked vs available slots grouped by date
- **Public booking page (`/book/[slug]`):** Client-facing page excluded from auth middleware. Shows event details with photographer branding. Clients see available slots grouped by date, select one, enter name/email/phone, confirm. Slot immediately becomes unavailable. Branded confirmation screen shown
- **New DB tables:** `packages` (migration 12), `booking_events` + `booking_slots` (migration 13) — all with full RLS policies for authenticated users, plus anon read/book policies for published events
- **Sidebar updated:** Added "Bookings" nav item with CalendarCheck icon
- **Types updated:** Added `Package`, `BookingEvent`, `BookingSlot`, `CustomQuestion` interfaces to types.ts
- **Queries updated:** Added 12 new functions — `getPackages`, `createPackage`, `updatePackage`, `deletePackage`, `getBookingEvents`, `getBookingEvent`, `createBookingEvent`, `updateBookingEvent`, `deleteBookingEvent`, `getBookingSlots`, `createBookingSlots`, `deleteBookingSlots`

### Features Added (15 Feb 2026 — Booking API, Cancel/Restore, Edit Event Session)
- **Booking API route (`/api/book`):** Server-side POST endpoint using Supabase service role key. When a client books via `/book/[slug]`, the API: finds or creates the client record (matches by email), creates a job with atomic job number increment, auto-creates invoice(s) respecting deposit settings from the linked package, updates the slot with client_id/job_id references. Requires `SUPABASE_SERVICE_ROLE_KEY` env var in Vercel
- **Cancel job frees booking slot:** When a job with a `booking_slot_id` is cancelled, the linked booking slot is reset to `available` (client info cleared). The time slot immediately becomes bookable again on the public page
- **Restore job re-books slot:** Restoring a cancelled booking job re-books the slot with the client's name, email, and phone from the linked client record
- **`booking_slot_id` on jobs:** New FK column (migration 14) linking jobs to their originating booking slot, enabling the cancel/restore ↔ slot sync
- **Edit Event button:** Replaced "Close Event" with "Edit Event" in the booking event detail slide-over. Opens a modal to edit title, description, location, package, custom price, slot duration, and buffer time
- **Public booking page — booked slots visible:** Changed from hiding booked slots to showing all slots. Booked slots appear greyed out with strikethrough text and are disabled/unclickable. Clients can see the full schedule but only book available times
- **Public booking page — useParams fix:** Fixed `use(params)` to `useParams()` for Next.js 14 compatibility
- **Time format fix:** Booking API now saves job times as `HH:MM` instead of `HH:MM:SS` from Postgres TIME columns

### Environment Variables (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://ibugbyrbjabpveybuqsv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
RESEND_API_KEY=[resend api key — get from resend.com/api-keys]
RESEND_FROM_EMAIL=[verified sender email — e.g. noreply@yourdomain.com]
```

### File Move Commands
All files delivered with PowerShell `Move-Item` commands from Downloads to project directory with `-Force` flag. Git push commands included after every change that needs deploying.

---

## 14. Key Design Decisions

- **Monorepo (Turborepo):** Shared types and constants between frontend and AI service
- **Next.js 14 App Router:** Server components for SEO on public galleries, client components for interactive dashboard
- **Supabase RLS:** Every table has row-level security scoped to `photographer_id` — multi-tenant by default
- **Package-driven automation:** Deposit %, included images, duration — all set per package, inherited by every job using that package
- **Permanent job numbering:** Counter on photographer record, atomic increment, never resets
- **Invoice numbers tied to jobs:** Always traceable (`INV-0001-DEP` tells you exactly which job and what type)
- **AI controls per-step:** Photographers choose how aggressive each AI phase is — from "off" to "auto-fix"
- **Style training from 50–200 images:** Much lower barrier than competitors (Imagen needs 3,000–5,000)
- **One contract template per photographer:** Simpler than a template library — less confusing. Uses conditional blocks (`{{#if deposit}}` / `{{#if no_deposit}}`) so one template handles all scenarios
- **Photographer signature in Settings:** Draw with canvas (multi-stroke) or upload image. Stored as base64 on photographer record. Auto-embedded into every contract
- **Client signing via public URL:** `/sign/[token]` route excluded from auth middleware. Captures IP, user agent, timestamp. Canvas signature pad with multi-stroke support
- **Lost leads hidden by default:** Lost leads don't show in pipeline view (clutters the board over time). Visible in list view with a toggle. Count shown in header
- **Mock data fallback:** Editing and Galleries pages show demo data with a banner when no real data exists, so the UI is always explorable
- **Mitchell prefers Claude.ai workflow:** Tried Claude Code but prefers chatting with Claude.ai and getting files to download + Move-Item commands. Don't suggest Claude Code workflow

---

## 15. Storage Tiers & Gallery Expiry (Planned — Not Yet Built)

### Proposed Storage Tiers
- **Hot** — Active/delivered galleries. Full-res + web-res available. Fast CDN delivery (Cloudflare R2). No expiry countdown yet
- **Warm** — Post-expiry. Web-res thumbnails kept for photographer reference. Full-res moved to cheaper storage (Backblaze B2 cold). Client link disabled
- **Cold** — Long-term archive. Only originals stored compressed in B2. No gallery accessible. Photographer can restore on demand

### Gallery Expiry Options (configurable in Settings)
- 7 days / 14 days / 21 days / 30 days / 60 days / 90 days / No expiry
- Default set globally in Settings
- Override per gallery when delivering
- Expiry options must map to storage tier transitions

### Gallery Delivery Features (discussed)
- Sticky "Deliver to Client" bar at bottom of gallery review page
- Auto-deliver checkbox on AI editing sticky bar — if checked, gallery auto-delivers when AI finishes without manual approval
- If auto-deliver is on, galleries page shows green "Delivered" button instead of "Deliver to Customer"
- Image preview in gallery shows exact same photo the client will see, including watermarks
- Gallery link with configurable access type (public / password-protected)

# Apelier — To-Do: CRM Import Tool + Marketing Site Redesign

**Created:** 19 February 2026  
**Status:** Research complete, ready to build tomorrow  

---

## 1. CRM Import Tool — "Switch to Apelier"

### Overview
Build a Settings → Import Data page with a dropdown to select the source CRM, step-by-step instructions for exporting from that platform, and a CSV upload + smart field mapper that creates clients, jobs, invoices, and contacts in Apelier's database automatically.

### Competitor CRMs & Their Export Capabilities

#### 1. HoneyBook
- **Export method:** CSV download
- **How to export:**
  - Contacts: Clients → Contacts → triple-dot → "Download spreadsheet"
  - Projects: Reports section → select data type → Download CSV
  - Financial: Reports → select time frame → Download (CSV)
- **Available data in export:**
  - Contacts CSV: name, email, phone, address, notes, date created
  - Projects CSV: project name, client, service type, stage, dates
  - Financial CSV: payment amounts, dates, methods, invoice totals
- **Limitations:** No bulk export of contracts/documents as files. Projects export is via reports, not a direct project dump.

#### 2. Dubsado
- **Export method:** CSV download (enhanced export feature)
- **How to export:**
  - Projects tab → select status → Export
  - Address Book → Export
  - Reporting → Transactions → Export as CSV
  - Reporting → Invoices → Export as CSV
- **Available data in export:**
  - Contacts: first name, last name, email, phone, address, notes, custom-mapped fields
  - Projects: project name, client, status, source, custom fields, invoices
  - Financial: invoice amounts, payment status, dates, profit & loss
- **Limitations:** Contracts/forms exported as PDFs individually, not bulk CSV. Custom-mapped fields come through as columns.

#### 3. Studio Ninja
- **Export method:** CSV for clients/payments, ZIP for leads/jobs
- **How to export:**
  - Clients: Clients page → "Export Clients" button → CSV download
  - Leads/Jobs: Export page → "Export Leads/Jobs" → ZIP file emailed (includes invoices, quotes, contracts, questionnaires)
  - Payments: Export Payments button → select type/date/columns → CSV
- **Available data in export:**
  - Clients CSV: name, email, phone, address
  - Jobs ZIP: job name, status, dates, associated invoices/contracts/questionnaires as files
  - Payments CSV: client email, status, job name, job status, invoice ID, issue date, due date, paid date, main shoot date, amounts, tax, tips, payment method
- **Limitations:** Jobs export is a ZIP (not flat CSV) — includes PDFs of contracts/invoices. Need to parse the ZIP structure.

#### 4. VSCO Workspace (formerly Táve)
- **Export method:** CSV download from any list view
- **How to export:**
  - Any list (Leads, Jobs, Address Book, Quotes, Orders) → download icon (top right) → CSV of visible or all columns
  - Includes Client Emails column in Leads/Jobs exports
- **Available data in export:**
  - Contacts: name, email, phone, custom fields
  - Jobs: job name, type, stage, dates, client info, custom fields
  - Leads: lead name, status, dates, client emails
  - Quotes/Orders: amounts, items, status
- **Limitations:** Export is per-list-view. No single "export everything" button. Users may need to do multiple exports.

#### 5. 17hats
- **Export method:** CSV download
- **How to export:**
  - Contacts/Leads page → gear icon → "Export Contacts"
  - Bookkeeping → Client/Product Sales Reports → Export as CSV
  - QuickBooks export (transactions.iff file)
- **Available data in export:**
  - Contacts CSV: first name, last name, email, phone, type (Hot Lead/Client/Cold Prospect/Other), tags
  - Sales Reports CSV: client names, invoice amounts, payment dates (only fully paid invoices)
- **Limitations:** "Contact Details" only — project info (documents, details, emails, timelines) cannot be exported. Very limited compared to others.

#### 6. Bloom.io
- **Export method:** CSV download
- **How to export:**
  - Settings → Exporting → Contact Data
  - Import: CSV upload with field mapping
- **Available data in export:**
  - Contacts: email (required), first name, last name, additional mapped fields
- **Limitations:** Export appears to be contacts-only. No bulk project/invoice export documented.

#### 7. Sprout Studio
- **Export method:** CSV via Reports
- **How to export:**
  - Reports → Contact Analytics → set date range/brand/users → Export
  - Contact import supports CSV with custom contact details mapping
- **Available data in export:**
  - Contacts: name, email, phone, custom contact details
- **Limitations:** Contact-centric export only. Jobs/invoices not easily bulk-exported.

#### 8. Pixieset Studio Manager
- **Export method:** CSV download
- **How to export:**
  - Contacts → Actions → Export Contacts (select client/lead/other types)
  - Payments → Transactions → Export (payment data CSV)
- **Available data in export:**
  - Contacts CSV: name, email, phone, address, type (client/lead/other)
  - Payments CSV: client name, email, payment method, amount, currency, transaction date
- **Limitations:** No project/job bulk export. Contacts and payments only.

#### 9. Light Blue
- **Export method:** CSV via Records → Export
- **How to export:**
  - Select records via Query/Quick Queries → Records menu → Export → Records
  - Choose fields to include → Save as CSV
  - Financial: "Export Financial Information" → generates multiple CSVs (Sales, Payments, Expenses)
- **Available data in export:**
  - Contacts: name, email, phone, address, any queryable field
  - Shoots/Jobs: dates, types, locations, all associated fields
  - Financial: multiple CSVs covering sales, payments, expenses
- **Limitations:** Desktop app (Mac/Windows) — export is done locally. Users need to find the export menu. Very flexible field selection.

#### 10. ShootQ
- **Export method:** CSV (limited documentation)
- **Likely data:** Contacts, basic project info
- **Note:** ShootQ is less common now, include as "Other/Generic CSV" option

#### 11. Picsello
- **Export method:** Unknown/limited
- **Note:** Newer platform, include as "Other/Generic CSV" option

---

### What Apelier Needs to Import (Target Fields)

**Clients table:**
- first_name, last_name, email, phone, address, city, state, postcode, country, notes, source, tags, created_at

**Jobs table:**
- title, type (wedding/portrait/event/etc), status (lead/booked/completed/archived), event_date, location, notes, package_amount, client_id (linked)

**Invoices table:**
- amount, status (draft/sent/paid/overdue), due_date, paid_date, paid_amount, notes, job_id (linked), client_id (linked)

**Contacts (secondary contacts on a job):**
- first_name, last_name, email, phone, relationship (partner/planner/etc), client_id (linked)

---

### Implementation Plan

#### UI: Settings → Import Data page
1. **Step 1:** Dropdown — "Where are you coming from?"
   - HoneyBook, Dubsado, Studio Ninja, VSCO Workspace (Táve), 17hats, Bloom, Sprout Studio, Pixieset, Light Blue, Other (Generic CSV)
2. **Step 2:** Platform-specific instructions with screenshots showing exactly where to click to export
3. **Step 3:** Upload zone — drag & drop CSV (or ZIP for Studio Ninja)
4. **Step 4:** Smart field mapper — auto-detect columns based on selected platform, show preview of first 5 rows, let user confirm/adjust mappings
5. **Step 5:** Import summary — X clients, Y jobs, Z invoices will be created. Confirm button.
6. **Step 6:** Progress bar → completion summary with any skipped/failed rows

#### Backend: API route `/api/import`
- Accept CSV upload + source platform identifier
- Platform-specific column mapping presets (auto-map known column names)
- Parse CSV, create records in order: clients first → jobs → invoices
- Deduplicate by email address
- Return summary of imported records

#### Platform-Specific Mappers (pre-configured column mappings):

**HoneyBook:**
```
"Contact Name" → split into first_name + last_name
"Email" → email
"Phone" → phone  
"Address" → address
"Notes" → notes
"Date Created" → created_at
```

**Dubsado:**
```
"First Name" → first_name
"Last Name" → last_name
"Email" → email
"Phone Number" → phone
"Address" → address + city + state + postcode
"Notes" → notes
Custom-mapped fields → notes (appended)
```

**Studio Ninja:**
```
Clients CSV:
"First Name" → first_name
"Last Name" → last_name  
"Email" → email
"Phone" → phone
"Address" → address

Payments CSV:
"Client Email" → match to client
"Job Name" → job title
"Job Status" → status mapping
"Main Shoot Date" → event_date
"Invoice Total" → amount
"Amount Paid" → paid_amount
"Paid Date" → paid_date
```

**VSCO Workspace / Táve:**
```
Column names vary by user's list config — use smart detection
"Name" / "Client Name" → split first/last
"Email" / "Client Email" → email
"Phone" → phone
"Job Type" → job type
"Stage" → status mapping
```

**17hats:**
```
"First Name" → first_name
"Last Name" → last_name
"Email" → email
"Phone" → phone (format: 888-888-888)
"Type" → tags (Hot Lead/Client/Cold Prospect)
"Project Name" → job title
"Project Date" → event_date
"Project Location" → location
"Project Tags" → tags
```

**Generic CSV (catch-all):**
- Show all columns, let user manually map each one
- Auto-detect common header names (name, email, phone, etc.)

---

## 2. Marketing Site / Landing Pages Redesign

### Overview
Build beautiful, conversion-optimized marketing pages that sell Apelier. Current app has dashboard/CRM pages but no public-facing marketing site. Need:

### Pages to Build

#### Homepage (/)
- Hero section with bold headline + subheadline + CTA
- "From shutter click to client delivery in under 1 hour"
- Feature showcase: CRM + AI Editing + Client Galleries — all-in-one
- Social proof / testimonials
- Pricing preview
- Final CTA

#### Features (/features)
- Deep dive into each major feature area:
  - AI Photo Editing (learn your style, batch process, review & approve)
  - CRM & Job Management (leads → bookings → delivery, automated)
  - Client Galleries (password-protected, shareable, beautiful)
  - Contracts & E-signatures
  - Invoicing & Payments
  - Booking System
  - Email Automation
- Each feature section: headline, description, screenshot/mockup, benefit statement

#### Pricing (/pricing)
- Tiered pricing cards
- Feature comparison table
- FAQ section
- Free trial CTA

#### About (/about)
- Story, mission, team
- Why we built this

#### Blog (/blog) — optional/later
- SEO content, tutorials, photography tips

### Design Direction
- Dark theme consistent with dashboard (slate/charcoal backgrounds)
- Gold/amber accent colors from rebrand
- Serif headings (matching Apelier brand)
- Large hero images of photography work
- Smooth scroll animations
- Mobile-first responsive
- Fast loading (Next.js SSG for marketing pages)
- Professional typography — editorial feel

### Tech Approach
- Marketing pages as Next.js static pages in the same repo
- Public layout (no auth required) vs dashboard layout
- Could use a separate `/marketing` or root-level pages
- Tailwind CSS + custom components
- No heavy JS — mostly static content with subtle animations

---

## Priority Order
1. **CRM Import Tool** — highest impact for user acquisition/conversion. Removing friction from switching is the #1 thing that will get photographers to actually move.
2. **Marketing Homepage** — needed to sell the product
3. **Features page** — supports homepage
4. **Pricing page** — needed for conversion
5. **About page** — nice to have

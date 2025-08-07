# README_FOR_CLAUDE

**Purpose**: Build and maintain the ForgeRank Chrome Extension MVP

**Use**: Claude handles all code execution and technical logic. No strategy or branding here.

---

## 🔧 Tech Stack

- Vite + React
- Tailwind CSS (PostCSS)
- Zustand or Context API (state)
- Supabase (for Pro sync)
- Stripe (7-day trial, monthly + annual Pro plans)
- Chrome Extension APIs (manifest v3)
- Playwright (local headless scraper)

---

## 🔐 Auth Requirements

- Modal login only
- GitHub, Google, Email/Password (via Supabase auth)
- Stripe trial management
- Store user session locally (persist token, validate on launch)

---

## 🧠 Build Principles

- Shelf-style extension (not popup)
- Passive scanning is non-negotiable
- All functionality must run smooth locally
- No server-side costs outside Supabase and Stripe

---

## 🗂 Layout Structure

The extension is a **shelf panel** (full-width side panel).

It contains these tabs:

1. `Dashboard`
2. `Tracked Links`
3. `Backlinks`
4. `Keywords`
5. `Settings`
6. `Upgrade`

*(Optional future: Help tab)*

---

## ✅ Free Tier (No Login)

- Passive scanning (auto-scan current tab on every page load)
- Track up to 3 URLs
- Anchor text + timestamp logs
- Basic keyword detection
- Tabbed shelf UI

---

## 🔒 Pro Tier (Login Required)

- Track up to 20 URLs
- Export to CSV
- Advanced keyword filtering (stoplist, signal boost)
- Broken link detection (HTTP HEAD request)
- Verified source metadata (context classification)
- Stripe-managed 7-day trial

---

## 🧩 Feature Logic

### 🔁 Passive Scanning (Core Feature)

- Triggered automatically on page load
- Inject scraper into current tab
- Detect:
  - `<a>` links with anchor text
  - href
  - timestamp
  - (Pro) parent DOM context

### 🔧 Tracked Links

- Input field appears for each URL
- + Add button adds one more (3 max for free, 20 for Pro)
- Validate duplicates and invalid URLs
- Store locally for free users
- Sync to Supabase for Pro users

### 🧠 Keywords

- Extract all page text
- Remove stopwords + UI fluff
- Show top keywords by:
  - Frequency
  - Position relevance
- Advanced filtering = Pro only

### 🧱 Verified Source Metadata (Pro Only)

- Traverse parent nodes of each link
- Add visual tag:
  - 📦 code
  - 🧱 config
  - 💬 comment
  - 🔗 generic
- Show this in backlink list via tooltip

### 🔗 Broken Link Detection (Pro Only)

- HEAD request for each detected link
- Show:
  - ✅ 200
  - ⚠️ 301/302
  - ❌ 404, timeout, failed

### 📤 Export (Pro Only)

- Export full backlinks + keywords list to CSV
- Include:
  - URL
  - Anchor
  - Timestamp
  - Keywords
  - Broken status
  - Source metadata

---

## 🧪 Stripe Integration

- 7-day free trial on both plans
- Claude must NOT handle payment logic — only gate Pro features by Stripe status

---

## 🛑 Scope Lock

Everything in this README is in scope. Anything not listed is out of scope.

Do not:
- Add domain rating (DR)
- Include cross-tab scanning
- Build server-side scraper
- Use GPT or paid APIs

# ForgeRank Chrome Extension - Product Requirements Document

**Version**: 1.0 (Current Implementation)  
**Last Updated**: August 25, 2025  
**Document Purpose**: Complete specification of implemented features and future roadmap

---

## 🎯 Product Overview

ForgeRank is a Chrome extension that provides real-time backlink discovery and competitor intelligence for solo founders and small teams. It operates passively in the background, analyzing pages as users browse naturally, requiring zero manual effort or expensive third-party APIs.

### Core Value Proposition
- **Passive Discovery**: Finds backlinks automatically while browsing
- **Zero-Cost Intelligence**: Browser-based competitor analysis
- **Real-Time Insights**: Immediate alerts and data updates
- **Startup-Friendly Pricing**: £9/month for pro features

---

## 🔧 Technical Architecture

### Extension Framework
- **Chrome Extension** (Manifest V3)
- **React 18** + **Vite** (UI Framework)
- **Tailwind CSS** (Styling)
- **Framer Motion** (Animations)
- **Zustand** (State Management)
- **TypeScript** (Type Safety)

### Backend Integration
- **Supabase** (Authentication, Database, Real-time sync)
- **Stripe** (Payment Processing, 7-day trials)
- **Chrome APIs** (Storage, Tabs, Scripting)

### Data Flow
1. **Content Script** injects into all pages
2. **Background Script** manages state and messaging
3. **React UI** displays data in side panel
4. **Supabase Sync** for authenticated users

---

## 🏗️ Current Implementation Status (v1.0)

### ✅ Core Features - IMPLEMENTED & WORKING

#### Passive Backlink Scanning
- **Real-time detection** on every page load
- **9 detection methods**:
  - Standard `<a>` tags
  - JavaScript onclick handlers  
  - Button-wrapped links
  - Data attributes (`data-href`, `data-url`)
  - Raw URLs in text nodes
  - Iframe content (when accessible)
  - Shadow DOM elements
  - Hidden elements (`display:none`)
  - Dynamic content via MutationObserver
- **URL normalization** with deduplication
- **Context detection** (code, config, comment, generic)

#### Authentication System
- **Multi-provider OAuth**: GitHub, Google, Email/Password
- **Supabase Integration**: Secure session management
- **Persistent State**: Chrome storage + React state sync
- **Pro Status Detection**: Database field `is_pro` with trial logic

#### Smart Site Scanning (Redesigned v1.0)
- **Competitor Intelligence Extraction**:
  - SEO analysis (meta tags, keywords, headings)
  - Partnership discovery (sponsors, clients, features)
  - Social media profiles mapping
  - Directory listings detection
  - Content strategy analysis
- **Zero-Cost Architecture**: Browser-based crawling
- **Background Processing**: Invisible tab analysis
- **Real-time Progress**: Live status updates
- **Opportunity Identification**: Automated actionable insights

#### Data Management
- **Chrome Storage**: Local persistence with quotas
- **Supabase Sync**: Cloud backup for authenticated users
- **Export Functionality**: JSON format with full metadata
- **Data Deduplication**: Sophisticated URL + anchor text matching
- **Storage Cleanup**: Automatic old data removal

---

## 📊 Tier Structure & Limits

### Starter Tier (Free - £0/month)
- **Tracked Domains**: 2 maximum
- **Backlink Storage**: 50 locally stored
- **History Retention**: 7 days
- **Keyword Extraction**: Basic TF-IDF algorithm
- **Smart Site Scanning**: ❌ Not available
- **Export**: JSON only, local data
- **Notifications**: Essential browser badges
- **Authentication**: Optional (local storage only)

### Growth Tier (Pro - £9/month)
- **Tracked Domains**: 10 maximum
- **Backlink Storage**: Unlimited with cloud sync
- **History Retention**: 6 months
- **Keyword Extraction**: Advanced + semantic clustering + niche detection
- **Smart Site Scanning**: ✅ Full competitor intelligence
- **Export**: Enhanced JSON with all metadata
- **Notifications**: Priority alerts + real-time updates
- **Authentication**: Required for cloud features
- **7-Day Free Trial**: Automatic via Stripe

---

## 🎨 User Interface

### Side Panel Design
- **Tab Navigation**: Dashboard, Tracked Links, Backlinks, Keywords, Smart Scanning, Settings, Upgrade
- **Dark Mode**: Default with toggle option
- **Responsive Layout**: Adapts to panel width
- **Real-time Updates**: Live data refresh without page reload
- **Animated Interactions**: Smooth transitions and micro-interactions

### Key UI Components
- **Dashboard**: Stats overview with recent activity
- **Tracked Links**: Domain management with validation
- **Backlinks**: Detailed list with context and metadata
- **Keywords**: Advanced filtering and clustering (Pro)
- **Smart Scanning**: Competitor queue and intelligence display
- **Settings**: Data management, theme, notifications
- **Upgrade**: Tier comparison and payment integration

---

## 🔍 Smart Site Scanning - Detailed Specification

### Intelligence Extraction Engine
**Input**: Competitor domain URL  
**Output**: Comprehensive intelligence report

#### Data Points Collected
1. **SEO Intelligence**
   - Meta keywords and descriptions
   - H1-H6 heading structure
   - Target keyword identification
   - Content strategy analysis

2. **Link Intelligence**
   - Partnership detection (sponsors, clients)
   - Directory listings identification
   - Social media profile mapping
   - External relationship analysis

3. **Opportunity Analysis**
   - Guest blogging opportunities
   - Directory submission targets  
   - Press coverage sources
   - Partnership prospects

#### Processing Workflow
1. **Initial Page Analysis** (80% progress)
   - Extract meta data and content structure
   - Identify external links and social profiles
   - Categorize partnership indicators

2. **Deep Page Scanning** (20% progress)
   - Analyze 2-3 high-value internal pages
   - Focus on About, Team, Contact, Partners pages
   - Extract additional context and relationships

3. **Intelligence Compilation**
   - Process raw data into actionable insights
   - Generate opportunity recommendations
   - Store results for user review

### Performance Characteristics
- **Pages Analyzed**: 1-3 per competitor site
- **Processing Time**: 30-60 seconds per site
- **Queue Capacity**: 10 sites maximum (Growth tier)
- **Background Execution**: Uses invisible Chrome tabs
- **Resource Usage**: Minimal CPU, respects browser idle time

---

## 🚨 Known Limitations & Issues

### Partially Implemented Features
- **CSV Export**: Only JSON export currently available
- **Broken Link Detection**: UI exists but HTTP checking not implemented
- **Context Classification**: Icons shown but detection algorithm incomplete
- **Email Notifications**: Only browser notifications working

### Technical Limitations
- **Cross-Origin Restrictions**: Cannot access some iframes
- **SPA Detection**: Some single-page apps may need page refresh
- **Memory Constraints**: Large datasets may hit browser limits
- **HTTP Checking**: Requires server-side implementation for scale

### Browser Compatibility  
- **Chrome Only**: Extension uses Chrome-specific APIs
- **Manifest V3**: Uses latest Chrome extension standards
- **Storage Quotas**: Limited by Chrome's storage API limits

---

## 🗺️ Version 2.0 Roadmap (Future Development)

### V2.1 - Enhanced Analytics (Q4 2025)
- **Competitor Keyword Analysis**
  - Extract competitor target keywords
  - Compare keyword overlap with user's domains
  - Identify keyword gap opportunities
  - Track keyword ranking changes over time

- **Directory Discovery Engine**
  - Automated detection of industry directories
  - Submission status tracking
  - Directory authority scoring
  - Bulk submission workflow

### V2.2 - Advanced Intelligence (Q1 2026)
- **Partner Detection System**
  - Advanced relationship mapping
  - Partner network visualization
  - Mutual connection identification
  - Partnership opportunity scoring

- **Historical Trend Analysis**
  - Backlink growth tracking over time
  - Competitor intelligence changes
  - Market share analysis
  - Seasonal pattern detection

### V2.3 - API & Integrations (Q2 2026)
- **External Tool Connections**
  - Google Search Console integration
  - Ahrefs/SEMrush data correlation
  - CRM system synchronization
  - Slack/Discord notifications

- **Bulk Operations**
  - CSV import for tracked URLs
  - Batch competitor analysis
  - Automated report generation
  - Scheduled intelligence updates

---

## 🔒 Security & Compliance

### Data Protection
- **Row Level Security**: Supabase RLS policies prevent cross-user access
- **Local Storage**: Sensitive data stored in Chrome's secure storage
- **OAuth Security**: Industry-standard authentication flows
- **No API Keys**: Zero third-party API dependencies reduce attack surface

### Privacy Considerations
- **Minimal Data Collection**: Only essential data stored
- **User Consent**: Explicit opt-in for cloud sync
- **Data Portability**: Full export capability
- **Right to Delete**: Complete data removal on request

---

## 💰 Business Model

### Pricing Strategy
- **Starter Tier**: Free forever (acquisition funnel)
- **Growth Tier**: £9/month (core revenue driver)
- **No Enterprise Tier**: Keep simple for solo founders

### Trial & Conversion
- **7-Day Free Trial**: Automatic via Stripe
- **Upgrade Prompts**: Triggered at domain limit
- **Feature Gating**: Smart Scanning exclusive to Growth tier
- **Payment Processing**: Stripe handles all billing

### Cost Structure
- **Supabase**: ~£5/month for 1000 active users
- **Stripe**: 2.9% + 30p per transaction
- **Chrome Store**: One-time £5 developer fee
- **Zero Third-Party APIs**: No variable costs for intelligence features

---

## 📈 Success Metrics

### Product Metrics
- **Backlinks Discovered**: Total across all users
- **Competitor Sites Analyzed**: Smart Scanning usage
- **User Retention**: 7-day, 30-day, 90-day cohorts
- **Feature Adoption**: Tab usage patterns

### Business Metrics  
- **Starter → Growth Conversion**: Target 15-20%
- **Trial → Paid Conversion**: Target 25-30%
- **Monthly Recurring Revenue**: Growth trajectory
- **Customer Acquisition Cost**: Organic vs paid channels

### Technical Metrics
- **Extension Performance**: Page load impact
- **Data Accuracy**: Backlink detection precision
- **Scanning Success Rate**: Competitor analysis completion
- **Error Rates**: Failed operations and crashes

---

## 🎭 User Personas

### Primary: Solo Technical Founder
- **Background**: Building SaaS/tech products
- **Pain Point**: No time for manual SEO research
- **Behavior**: Browses competitor sites regularly
- **Goal**: Find backlink opportunities without dedicated SEO tools

### Secondary: Small Team Marketer  
- **Background**: 1-3 person marketing team
- **Pain Point**: Limited budget for expensive SEO tools
- **Behavior**: Researches competitors systematically
- **Goal**: Professional SEO insights at startup prices

---

## 🎯 Competitive Positioning

### Advantages Over Traditional Tools
- **Passive Discovery**: vs Active manual searching (Ahrefs, SEMrush)
- **Real-time Detection**: vs Batch processing monthly reports
- **Zero Setup Cost**: vs $99-399/month enterprise tools
- **Browser Integration**: vs Separate web applications
- **Competitor Intelligence**: vs Basic backlink lists

### Differentiation Points
1. **Effortless Operation**: Works while you browse naturally
2. **Startup Pricing**: Affordable for bootstrap budgets  
3. **Instant Insights**: No waiting for crawl updates
4. **Intelligence Focus**: Actionable insights vs raw data dumps
5. **Chrome Native**: Seamless browser integration

---

This PRD represents the complete current state of ForgeRank v1.0 with accurate implementation status and future roadmap. All features marked as "implemented" have been tested and are working in the current build.
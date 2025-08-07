# ForgeRank Chrome Extension

A shelf-style Chrome Extension for real-time backlink monitoring and keyword insights.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- Chrome browser for testing
- Supabase account with project
- Stripe account (for payments)

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd forgerank-extension
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your Supabase and Stripe details
```

4. Build the extension
```bash
npm run build
# or
yarn build
```

5. Load in Chrome
- Open Chrome and navigate to `chrome://extensions/`
- Enable "Developer mode" (top right)
- Click "Load unpacked"
- Select the `dist` folder from the project

## 🛠 Development

Run the development server:
```bash
npm run dev
# or
yarn dev
```

The extension will need to be rebuilt and reloaded in Chrome after changes.

## 📁 Project Structure

```
forgerank-extension/
├── public/
│   ├── manifest.json      # Chrome extension manifest v3
│   └── icons/            # Extension icons
├── src/
│   ├── background/       # Background service worker
│   ├── content/          # Content script (backlink scanner)
│   ├── components/       # React UI components
│   ├── pages/           # Tab page components
│   ├── store/           # Zustand state management
│   ├── lib/             # Supabase client
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── package.json
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## ✅ Features Implemented

### Core Functionality
- ✅ Shelf-style Chrome Extension (side panel)
- ✅ Passive backlink scanning on every page
- ✅ Deep link detection (hidden links, buttons, iframes, shadow DOM)
- ✅ Keyword extraction from pages
- ✅ Real-time backlink monitoring
- ✅ Chrome storage for local data
- ✅ Supabase sync for authenticated users

### Authentication
- ✅ Supabase Auth integration
- ✅ GitHub OAuth
- ✅ Google OAuth
- ✅ Email/Password auth
- ✅ Session persistence
- ✅ Auth state management

### UI/UX
- ✅ Dark mode with theme toggle
- ✅ Tab-based navigation with animations
- ✅ Responsive design
- ✅ Modal components (Login, Upgrade)
- ✅ Real-time stats dashboard
- ✅ Loading states
- ✅ Error handling

### Free Tier Features
- ✅ Track up to 3 URLs
- ✅ Passive scanning
- ✅ Basic keyword extraction
- ✅ Local storage
- ✅ Backlink history

### Pro Tier Features
- ✅ Track up to 20 URLs
- ✅ Export to CSV/JSON
- ✅ Advanced keyword filtering
- ✅ Broken link detection (placeholder)
- ✅ Source metadata (code, comment, etc.)
- ✅ Cloud sync via Supabase
- ✅ 7-day trial via Stripe

### Data Management
- ✅ Add/Remove tracked URLs
- ✅ URL validation
- ✅ Duplicate prevention
- ✅ Export all data
- ✅ Clear cache
- ✅ Reset functionality

### State Management
- ✅ Zustand store with TypeScript
- ✅ Persistent auth state
- ✅ Real-time data sync
- ✅ Chrome storage integration
- ✅ Pending backlinks queue

## 🔧 Technical Implementation

### Backlink Detection
The content script (`src/content/scanner.ts`) uses multiple methods to find ALL backlinks:

1. **Standard `<a>` tags** - Direct anchor elements
2. **Onclick handlers** - Elements with navigation JavaScript
3. **Button wrapping** - Links inside buttons
4. **Data attributes** - `data-href`, `data-url` attributes
5. **Deep text scan** - Raw URLs in text nodes
6. **Iframe scanning** - Links inside accessible iframes
7. **Shadow DOM** - Links in web components
8. **Hidden elements** - Detects display:none links
9. **Dynamic content** - MutationObserver for SPA apps

### Database Schema
- `users` - Extended auth.users with Pro status
- `tracked_urls` - User's monitored URLs
- `backlinks` - Discovered backlinks with metadata
- `keywords` - Extracted keywords with relevance
- `user_preferences` - Settings and filters
- `scan_history` - Analytics and debugging

### Security
- Row Level Security (RLS) enabled
- Users can only access their own data
- Secure OAuth implementation
- Chrome storage for sensitive data

## 🚦 Setup Requirements

### 1. Supabase Setup
- Run cleanup SQL to remove old tables
- Run schema SQL to create new structure
- Configure OAuth providers
- Set up RLS policies

### 2. OAuth Configuration
- GitHub: Create OAuth app with callback URL
- Google: Set up OAuth 2.0 credentials
- Add credentials to Supabase Auth

### 3. Stripe Integration
- Create payment links with 7-day trial
- Add links to environment variables
- Set up webhook for subscription updates

### 4. Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_MONTHLY_LINK=your_monthly_link
VITE_STRIPE_YEARLY_LINK=your_yearly_link
```

## 📝 Notes

- Content script runs automatically on all pages
- Backlinks are detected in real-time
- Free users limited to 100 local backlinks
- Pro users sync unlimited to cloud
- Keywords extracted using TF-IDF algorithm
- Export includes all user data

## 🎯 Design Decisions

1. **Content Script Architecture** - Comprehensive detection methods ensure no backlinks are missed
2. **Zustand + Chrome Storage** - Hybrid approach for auth persistence
3. **Supabase Auth** - Handles OAuth complexity and session management
4. **Dark Mode First** - Matches developer audience preferences
5. **Passive Scanning** - Zero-friction user experience

## 🐛 Known Limitations

1. Cannot access cross-origin iframes
2. Some SPAs may require page reload for detection
3. Export limited by browser memory for large datasets
4. Broken link detection requires server-side implementation

## 🚀 Future Enhancements

- Advanced broken link checking
- Competitor backlink comparison
- Historical backlink tracking
- API for external integrations
- Bulk URL import
- Email notifications
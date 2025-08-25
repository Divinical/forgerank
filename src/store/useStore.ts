import { create } from 'zustand'
import type { Keyword } from '../types/keyword'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { LinkHealthChecker } from '../utils/linkHealthChecker'

// Utility for robust message passing with retry logic
async function sendMessageWithRetry(message: any, context: string, maxRetries: number = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await chrome.runtime.sendMessage(message)
      if (attempt > 1) {
        console.log(`🔍 ${context}: Message sent successfully on attempt ${attempt}`)
      }
      return
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`🔍 ${context}: Failed to send message after ${maxRetries} attempts:`, error)
      } else {
        console.log(`🔍 ${context}: Message attempt ${attempt} failed, retrying...`)
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
      }
    }
  }
}

// Utility for sending messages to specific tabs with retry
async function sendTabMessageWithRetry(tabId: number, message: any, context: string, maxRetries: number = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message)
      if (attempt > 1) {
        console.log(`🔍 ${context}: Tab message sent successfully on attempt ${attempt}`)
      }
      return true
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`🔍 ${context}: Failed to send tab message after ${maxRetries} attempts:`, error)
        return false
      } else {
        console.log(`🔍 ${context}: Tab message attempt ${attempt} failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 50 * attempt))
      }
    }
  }
  return false
}

// Utility to verify scanner connectivity across all tabs
async function verifyScannerConnectivity(): Promise<{ active: number, total: number }> {
  try {
    const tabs = await chrome.tabs.query({})
    let active = 0
    let total = 0
    
    for (const tab of tabs) {
      if (!tab.id || !tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:')) {
        continue
      }
      
      total++
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING_SCANNER' })
        if (response?.alive) {
          active++
          console.log(`🔍 Scanner active in tab ${tab.id}: ${response.trackedUrls} URLs, ${response.lastScan} backlinks`)
        }
      } catch {
        // Scanner not active in this tab
      }
    }
    
    console.log(`🔍 Scanner connectivity: ${active}/${total} tabs have active scanners`)
    return { active, total }
  } catch (error) {
    console.error('🔍 Failed to verify scanner connectivity:', error)
    return { active: 0, total: 0 }
  }
}

type Tab = 'dashboard' | 'tracked-links' | 'backlinks' | 'keywords' | 'smart-scanning' | 'settings' | 'upgrade'

interface Backlink {
  id: string
  source_url: string
  source_domain: string
  target_url: string
  target_domain?: string
  anchor_text: string | null
  context_type: string
  is_broken: boolean
  http_status: number | null
  first_seen_at?: string
  last_checked_at?: string
  created_at: string
  timestamp?: string
  isHidden?: boolean
  parentTagName?: string
  href?: string
  anchorText?: string
  contextType?: string
  health_check_error?: string
  redirect_url?: string
  response_time?: number
}

interface QueuedSite {
  id: string
  url: string
  domain: string
  status: 'pending' | 'scanning' | 'completed' | 'error' | 'paused'
  progress: number
  foundBacklinks: number
  lastScanned?: string
  queuedAt: string
  errorMessage?: string
  totalPages?: number
  scannedPages?: number
}

interface AppState {
  // Tab Management
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  
  // UI State
  isDarkMode: boolean
  toggleDarkMode: () => void
  notificationsEnabled: boolean
  toggleNotifications: () => void
  sendNewBacklinkEmail: (backlinks: Backlink[]) => Promise<void>
  sendWeeklyDigest: () => Promise<void>
  sendHealthCheckSummary: (healthStats: any) => Promise<void>
  
  // Onboarding State
  showOnboarding: boolean
  setShowOnboarding: (show: boolean) => void
  
  // Modal State
  isLoginModalOpen: boolean
  setLoginModalOpen: (open: boolean) => void
  isUpgradeModalOpen: boolean
  setUpgradeModalOpen: (open: boolean) => void
  
  // Auth State
  user: User | null
  setUser: (user: User | null) => void
  isAuthenticated: boolean
  setIsAuthenticated: (auth: boolean) => void
  isPro: boolean
  isLoading: boolean
  
  // Data State
  trackedUrls: string[]
  backlinks: Backlink[]
  keywords: Keyword[]
  
  // Smart Site Scanning State
  queuedSites: QueuedSite[]
  isScanning: boolean
  
  // Core Actions
  initializeAuth: () => Promise<void>
  signIn: (provider: 'github' | 'google' | 'email', email?: string, password?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  loadUserData: (forceRefresh?: boolean) => Promise<void>
  checkOnboardingStatus: () => Promise<void>
  
  // Data Actions
  addTrackedUrl: (url: string) => Promise<void>
  removeTrackedUrl: (url: string) => Promise<void>
  fetchTrackedUrls: () => Promise<void>
  fetchBacklinks: () => Promise<void>
  syncBacklinksToSupabase: () => Promise<void>
  fetchKeywords: () => Promise<void>
  
  // Smart Site Scanning Actions
  addCompetitorSite: (url: string) => Promise<void>
  removeCompetitorSite: (siteId: string) => Promise<void>
  startSiteScanning: (siteId: string) => Promise<void>
  pauseSiteScanning: (siteId: string) => Promise<void>
  fetchQueuedSites: () => Promise<void>
  updateScanProgress: (siteId: string, progress: number, foundBacklinks?: number) => void
  
  // Link Health Monitoring
  checkBacklinkHealth: (backlinkIds?: string[]) => Promise<void>
  isHealthCheckRunning: boolean
  
  // Data Cleanup
  cleanupDuplicateBacklinks: () => Promise<void>
  normalizeUrl: (url: string) => string
  
  // Domain Authority Proxy Metrics
  calculateDomainAuthority: (domain: string) => number
  getDomainInsights: (domain: string) => { authority: number, insights: string[] }
  
  // Data Integrity & Recovery
  verifyDataIntegrity: () => Promise<{ isHealthy: boolean, issues: string[] }>
  recoverLostData: () => Promise<boolean>
}

export const useStore = create<AppState>((set, get) => {
  // Immediately load persisted data on store creation
  const initializePersistedData = async () => {
    try {
      const result = await chrome.storage.local.get(['trackedUrls', 'queuedSites'])
      const trackedUrls = result.trackedUrls || []
      const queuedSites = result.queuedSites || []
      
      console.log('🔍 Store initialization: Loaded persisted data:', {
        trackedUrls: trackedUrls.length,
        queuedSites: queuedSites.length
      })
      
      set({ 
        trackedUrls, 
        queuedSites 
      })
      
      // Always notify background script about tracked URLs (even if empty)
      // This ensures background script is ready for onboarding
      sendMessageWithRetry({ 
        type: 'TRACKED_URLS_UPDATED', 
        trackedUrls 
      }, 'Store init')
    } catch (error) {
      console.error('🔍 Store initialization error:', error)
      // Continue with empty state if loading fails
    }
  }
  
  // Run initialization immediately
  initializePersistedData()
  
  return {
    // Tab Management
    activeTab: 'dashboard',
    setActiveTab: (tab) => set({ activeTab: tab }),
  
  // UI State
  isDarkMode: true,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.isDarkMode
    chrome.storage.local.set({ isDarkMode: newMode })
    return { isDarkMode: newMode }
  }),
  notificationsEnabled: false,
  toggleNotifications: () => set((state) => {
    const newValue = !state.notificationsEnabled
    chrome.storage.local.set({ notificationsEnabled: newValue })
    return { notificationsEnabled: newValue }
  }),
  
  // Onboarding State
  showOnboarding: false,
  setShowOnboarding: (show) => {
    set({ showOnboarding: show })
    localStorage.setItem('hasCompletedOnboarding', (!show).toString())
  },
  
  // Modal State
  isLoginModalOpen: false,
  setLoginModalOpen: (open) => set({ isLoginModalOpen: open }),
  isUpgradeModalOpen: false,
  setUpgradeModalOpen: (open) => set({ isUpgradeModalOpen: open }),
  
  // Auth State
  user: null,
  setUser: (user) => set({ user }),
  isAuthenticated: false,
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  isPro: false,
  isLoading: false,
  
  // Data State
  trackedUrls: [],
  backlinks: [],
  keywords: [] as Keyword[],
  
  // Smart Site Scanning State
  queuedSites: [],
  isScanning: false,
  
  // Link Health Monitoring State
  isHealthCheckRunning: false,
  
  // Strict auth initialization - only real authenticated users allowed
  initializeAuth: async () => {
    console.log('🔍 initializeAuth: Starting STRICT auth initialization...')
    
    try {
      // Get current session from Supabase Auth
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('🔍 initializeAuth: Auth error:', error)
        set({ isAuthenticated: false, user: null, isPro: false })
        return
      }
      
      if (session?.user && session.access_token) {
        console.log('🔍 initializeAuth: VALID session found')
        console.log('🔍 initializeAuth: User ID:', session.user.id)
        console.log('🔍 initializeAuth: User email:', session.user.email)
        console.log('🔍 initializeAuth: Session expires:', new Date(session.expires_at! * 1000))
        
        // Verify this is a real Supabase Auth user by checking the JWT
        if (session.user.aud === 'authenticated' && session.user.email) {
          console.log('🔍 initializeAuth: Verified authenticated user')
          set({ user: session.user, isAuthenticated: true })
          get().loadUserData()
          return
        } else {
          console.error('🔍 initializeAuth: Invalid user - not properly authenticated')
          await supabase.auth.signOut()
        }
      }
      
      console.log('🔍 initializeAuth: No valid session - user must sign in')
      set({ isAuthenticated: false, user: null, isPro: false })
      
    } catch (error) {
      console.error('🔍 initializeAuth: Initialization error:', error)
      set({ isAuthenticated: false, user: null, isPro: false })
    }
    
    // Always ensure tracked URLs are loaded (for both authenticated and unauthenticated users)
    await get().fetchTrackedUrls()
    
    // Check if user should see onboarding (after data is loaded)
    get().checkOnboardingStatus()
  },

  // Core Actions
  signIn: async (provider, email, password) => {
    try {
      console.log('🔍 signIn: Starting authentication for provider:', provider)
      let result
      
      if (provider === 'email' && email && password) {
        console.log('🔍 signIn: Attempting email sign-in for:', email)
        
        // Try sign in - do NOT automatically create account on failure
        result = await supabase.auth.signInWithPassword({ email, password })
        
        if (result.error) {
          console.log('🔍 signIn: Authentication failed:', result.error.message)
          
          // Check if user exists to provide better error message
          const { data: existingUser } = await supabase
            .schema('forgerank')
            .from('users')
            .select('email')
            .eq('email', email)
            .single()
          
          if (existingUser) {
            // User exists, so it's likely a wrong password
            throw new Error('Invalid email or password. Please check your credentials and try again.')
          } else {
            // User doesn't exist, offer to create account
            throw new Error(`No account found for ${email}. Please check your email address or contact support to create an account.`)
          }
        }
        
      } else if (provider === 'github' || provider === 'google') {
        console.log('🔍 signIn: OAuth sign-in for:', provider)
        result = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: chrome.identity.getRedirectURL()
          }
        })
      }
      
      if (result?.error) {
        console.error('🔍 signIn: Authentication error:', result.error)
        throw result.error
      }
      
      // For email auth, immediately verify the session
      if (provider === 'email' && result?.data && 'session' in result.data && result.data.session?.user) {
        console.log('🔍 signIn: Email auth successful')
        console.log('🔍 signIn: New user ID:', result.data.session.user.id)
        console.log('🔍 signIn: New user email:', result.data.session.user.email)
        
        set({ user: result.data.session.user, isAuthenticated: true })
        // loadUserData will be called by SIGNED_IN event in App.tsx
      }
      
      set({ isLoginModalOpen: false })
      
    } catch (error) {
      console.error('🔍 signIn: Sign-in failed:', error)
      throw error
    }
  },
  
  signOut: async () => {
    console.log('🔍 signOut: Clearing user data and cache')
    await supabase.auth.signOut()
    set({ 
      user: null, 
      isAuthenticated: false, 
      isPro: false,
      backlinks: [],
      keywords: []
    })
    console.log('🔍 signOut: Removing isPro from Chrome storage')
    chrome.storage.local.remove(['isPro'])
  },

  resetPassword: async (email) => {
    try {
      console.log('🔍 resetPassword: Sending password reset email to:', email)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: chrome.identity.getRedirectURL()
      })
      
      if (error) {
        console.error('🔍 resetPassword: Failed to send reset email:', error)
        throw error
      }
      
      console.log('🔍 resetPassword: Password reset email sent successfully')
    } catch (error) {
      console.error('🔍 resetPassword: Password reset failed:', error)
      throw error
    }
  },
  
  checkOnboardingStatus: async () => {
    try {
      // Check if user has completed onboarding before
      const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true'
      
      // Also check if they have any tracked URLs (key activation metric)
      const { trackedUrls = [] } = await chrome.storage.local.get('trackedUrls')
      
      // Show onboarding if:
      // 1. They haven't completed it before, AND
      // 2. They have no tracked URLs (new user)
      const shouldShowOnboarding = !hasCompletedOnboarding && trackedUrls.length === 0
      
      console.log('🔍 Onboarding check:', {
        hasCompletedOnboarding,
        trackedUrlsCount: trackedUrls.length,
        shouldShowOnboarding
      })
      
      set({ showOnboarding: shouldShowOnboarding })
    } catch (error) {
      console.error('🔍 checkOnboardingStatus error:', error)
      // Default to not showing onboarding if there's an error
      set({ showOnboarding: false })
    }
  },
  
  loadUserData: async (forceRefresh = false) => {
    const { user, backlinks, keywords } = get()
    if (!user) {
      console.log('🔍 loadUserData: No user found, skipping')
      return
    }

    // If we already have data and this isn't a forced refresh, still check pro status
    // but skip the expensive data fetching operations
    if (!forceRefresh && backlinks.length > 0 && keywords.length > 0) {
      console.log('🔍 loadUserData: Data exists, syncing URLs and verifying pro status')
      await get().fetchTrackedUrls() // Always sync tracked URLs
      
      // Always verify pro status even if we have data - this was the bug!
      try {
        const { data: profile } = await supabase
          .schema('forgerank')
          .from('users')  
          .select('is_pro, trial_ends_at')
          .eq('id', user.id)
          .single()
          
        if (profile) {
          const isPro = profile.is_pro || 
            (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
          
          console.log('🔍 loadUserData: Quick pro status check:', {
            isPro,
            'profile.is_pro': profile.is_pro,
            'profile.trial_ends_at': profile.trial_ends_at
          })
          
          set({ isPro })
          chrome.storage.local.set({ isPro })
        }
      } catch (error) {
        console.error('🔍 loadUserData: Pro status check failed:', error)
      }
      
      return // Still return early to skip data fetching
    }
    
    console.log('🔍 Auth user:', { id: user.id, email: user.email })
    console.log('🔍 Querying forgerank.users with ID:', user.id)
    
    try {
      // First try: lookup by ID
      console.log('🔍 Attempting ID lookup first')
      let { data: profile, error: queryError } = await supabase
        .schema('forgerank')
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      console.log('🔍 ID Query error:', queryError)
      console.log('🔍 ID Profile found:', profile)
      
      // If ID lookup fails, try email lookup as fallback
      if (!profile && user.email) {
        console.log('🔍 ID lookup failed, trying email fallback:', user.email)
        const emailResult = await supabase
          .schema('forgerank')
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single()
        
        profile = emailResult.data
        queryError = emailResult.error
        
        console.log('🔍 Email Query error:', queryError)
        console.log('🔍 Email Profile found:', profile)
      }
      
      if (profile) {
        const isPro = profile.is_pro || 
          (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
        
        console.log('🔍 Pro status calculation:', {
          isPro,
          'profile.is_pro': profile.is_pro,
          'profile.trial_ends_at': profile.trial_ends_at,
          'trial_active': profile.trial_ends_at ? new Date(profile.trial_ends_at) > new Date() : false
        })
        
        console.log('🔍 Setting isPro in React state:', isPro)
        set({ isPro })
        
        console.log('🔍 Saving isPro to Chrome storage:', isPro)
        chrome.storage.local.set({ isPro })
      } else {
        console.log('🔍 No profile found, creating new user profile')
        // Create new user profile in forgerank.users
        const { data: newProfile, error: createError } = await supabase
          .schema('forgerank')
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            is_pro: false,
            subscription_status: 'free',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
          
        if (createError) {
          console.error('🔍 Failed to create user profile:', createError)
          set({ isPro: false })
        } else {
          console.log('🔍 Created new user profile:', newProfile)
          set({ isPro: false })
        }
      }
      
      await Promise.all([
        get().fetchTrackedUrls(),
        get().fetchBacklinks(),
        get().fetchKeywords()
      ])
      
      get().syncBacklinksToSupabase()
      
    } catch (error) {
      console.error('🔍 loadUserData error:', error)
    }
  },
  
  // Data Actions
  addTrackedUrl: async (url) => {
    const { user, isPro, trackedUrls } = get()

    try {
      // Normalize & validate URL
      let normalizedUrl: string
      let urlToValidate = url.trim()
      
      // Auto-prepend https:// if no protocol provided
      if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        urlToValidate = 'https://' + urlToValidate
      }
      
      try {
        normalizedUrl = new URL(urlToValidate).href
      } catch {
        throw new Error('Invalid URL format. Please enter a valid domain like example.com or https://example.com')
      }

      if (trackedUrls.includes(normalizedUrl)) {
        throw new Error('URL already tracked')
      }

      const maxUrls = isPro ? 10 : 2
      if (trackedUrls.length >= maxUrls) {
        throw new Error(`Maximum ${maxUrls} URLs allowed. ${isPro ? '' : 'Upgrade to Growth tier for up to 10 domains.'}`)
      }

      const updatedUrls = [...trackedUrls, normalizedUrl]
      
      console.log('🔍 addTrackedUrl: Saving to storage:', updatedUrls)
      
      // Always save to local storage with retry logic
      let saveAttempts = 0
      const maxSaveAttempts = 3
      while (saveAttempts < maxSaveAttempts) {
        try {
          await chrome.storage.local.set({ trackedUrls: updatedUrls })
          set({ trackedUrls: updatedUrls })
          console.log('🔍 addTrackedUrl: Successfully saved to storage')
          break
        } catch (error) {
          saveAttempts++
          console.error(`🔍 addTrackedUrl: Save attempt ${saveAttempts} failed:`, error)
          if (saveAttempts >= maxSaveAttempts) {
            throw new Error('Failed to save URL after multiple attempts. Please try again.')
          }
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Verify the save worked
      const verification = await chrome.storage.local.get('trackedUrls')
      console.log('🔍 addTrackedUrl: Verification - storage now contains:', verification.trackedUrls)
      console.log('🔍 addTrackedUrl: Successfully saved to storage and state')

      // Save to Supabase if authenticated
      if (user) {
        const { error } = await supabase
          .schema('forgerank')
          .from('tracked_urls')
          .insert({
            user_id: user.id,
            url: normalizedUrl,
            domain: new URL(normalizedUrl).hostname
          })

        if (error) {
          console.error('Failed to sync to Supabase:', error)
          // Don't throw - local save was successful
        }
      }

      // Notify background script and all tabs about URL update
      await Promise.all([
        // Notify background script (for content script injection)
        sendMessageWithRetry({
          type: 'TRACKED_URLS_UPDATED',
          trackedUrls: updatedUrls
        }, 'Add URL'),
        
        // Notify current tab scanner directly (for immediate scanning)
        (async () => {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tabs[0]?.id) {
            await sendTabMessageWithRetry(tabs[0].id, {
              type: 'RELOAD_SCANNER_STATE',
              trackedUrls: updatedUrls
            }, 'Add URL - Current Tab')
          }
        })()
      ])
      
      // Verify scanner connectivity and implement fallback recovery
      setTimeout(async () => {
        const connectivity = await verifyScannerConnectivity()
        if (connectivity.active === 0 && connectivity.total > 0) {
          console.warn('🔍 Warning: No active scanners found after adding URL - attempting recovery')
          
          // Fallback: Force re-injection of content scripts
          try {
            await sendMessageWithRetry({
              type: 'FORCE_REINJECT_CONTENT_SCRIPTS'
            }, 'Recovery - Force Reinject')
            
            // Wait and verify again
            setTimeout(async () => {
              const recoveryCheck = await verifyScannerConnectivity()
              if (recoveryCheck.active > 0) {
                console.log(`🔍 Recovery successful: ${recoveryCheck.active} scanners now active`)
              } else {
                console.error('🔍 Recovery failed: Manual page refresh may be required')
                // Could emit an event here for UI to show recovery options
              }
            }, 2000)
            
          } catch (error) {
            console.error('🔍 Recovery attempt failed:', error)
          }
        } else {
          console.log(`🔍 Scanner verification: ${connectivity.active} active scanners ready`)
        }
      }, 1000)

    } catch (error) {
      console.error('Error adding tracked URL:', error)
      throw error
    }
  },
  
  removeTrackedUrl: async (url) => {
    const { user, trackedUrls } = get()
    const updatedUrls = trackedUrls.filter(u => u !== url)
    
    // Update local storage
    await chrome.storage.local.set({ trackedUrls: updatedUrls })
    set({ trackedUrls: updatedUrls })
    
    // Update Supabase if authenticated
    if (user) {
      await supabase
        .schema('forgerank')
        .from('tracked_urls')
        .delete()
        .eq('user_id', user.id)
        .eq('url', url)
    }
  },
  
  fetchTrackedUrls: async () => {
    const { user } = get()
    
    console.log('🔍 fetchTrackedUrls: Starting simplified fetch')
    
    try {
      // 1. Load current local URLs (Chrome storage is source of truth)
      const localResult = await chrome.storage.local.get('trackedUrls')
      const localUrls = localResult.trackedUrls || []
      console.log('🔍 fetchTrackedUrls: Local storage URLs:', localUrls)
      
      // 2. Update state with local URLs immediately
      set({ trackedUrls: localUrls })
      
      // 3. For authenticated users, merge with Supabase data
      if (user) {
        console.log('🔍 fetchTrackedUrls: Syncing with Supabase for user:', user.id)
        
        const { data, error } = await supabase
          .schema('forgerank')
          .from('tracked_urls')
          .select('*')
          .eq('user_id', user.id)
        
        if (!error && data) {
          const supabaseUrls = data.map(d => d.url)
          const mergedUrls = [...new Set([...localUrls, ...supabaseUrls])]
          
          console.log('🔍 fetchTrackedUrls: Merged URLs:', {
            local: localUrls.length,
            supabase: supabaseUrls.length,
            merged: mergedUrls.length
          })
          
          // Update both state and storage if we have changes
          if (JSON.stringify(mergedUrls.sort()) !== JSON.stringify(localUrls.sort())) {
            await chrome.storage.local.set({ trackedUrls: mergedUrls })
            set({ trackedUrls: mergedUrls })
            console.log('🔍 fetchTrackedUrls: Updated with merged data')
          }
          
          // Always notify background script about tracked URLs (even if empty)
          await sendMessageWithRetry({ 
            type: 'TRACKED_URLS_UPDATED', 
            trackedUrls: mergedUrls 
          }, 'Fetch URLs')
        } else {
          console.log('🔍 fetchTrackedUrls: Supabase sync failed, using local data')
          // Still notify background about local URLs
          await sendMessageWithRetry({ 
            type: 'TRACKED_URLS_UPDATED', 
            trackedUrls: localUrls 
          }, 'Fetch URLs - Local Only')
        }
      } else {
        console.log('🔍 fetchTrackedUrls: No user, using local data only')
        // Always notify background script about tracked URLs (even if empty)
        await sendMessageWithRetry({ 
          type: 'TRACKED_URLS_UPDATED', 
          trackedUrls: localUrls 
        }, 'Fetch URLs - No User')
      }
    } catch (error) {
      console.error('🔍 fetchTrackedUrls: Error during fetch:', error)
      // In case of error, at least try to load from local storage
      const fallbackResult = await chrome.storage.local.get('trackedUrls')
      const fallbackUrls = fallbackResult.trackedUrls || []
      set({ trackedUrls: fallbackUrls })
    }
  },
  
  fetchBacklinks: async () => {
    const { user, isPro } = get()
    
    try {
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      // Simple normalization - handle common field variations
      const allBacklinks = localBacklinks.map((bl: any) => ({
        id: bl.id || `local-${Date.now()}-${Math.random()}`,
        source_url: bl.source_url || bl.sourceUrl || '',
        source_domain: bl.source_domain || bl.sourceDomain || '',
        target_url: bl.target_url || bl.targetUrl || bl.href || '',
        anchor_text: bl.anchor_text || bl.anchorText || '',
        context_type: bl.context_type || bl.contextType || 'generic',
        is_broken: bl.is_broken || false,
        http_status: bl.http_status || null,
        first_seen_at: bl.first_seen_at || bl.timestamp || bl.created_at || new Date().toISOString(),
        last_checked_at: bl.last_checked_at || new Date().toISOString(),
        created_at: bl.created_at || bl.timestamp || new Date().toISOString(),
        timestamp: bl.timestamp,
        isHidden: bl.isHidden,
        parentTagName: bl.parentTagName,
        href: bl.href,
        anchorText: bl.anchorText,
        contextType: bl.contextType
      }))
      
      // Apply tier limits for backlink storage
      const maxBacklinks = isPro ? Number.MAX_SAFE_INTEGER : 50 // Starter tier: 50, Growth tier: unlimited
      const normalizedBacklinks = allBacklinks.slice(0, maxBacklinks)
      
      // If Pro user, merge with Supabase data
      if (user && isPro) {
        const { data } = await supabase
          .schema('forgerank')
          .from('backlinks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (data) {
          // Merge local and Supabase data, prioritizing newer items
          const merged = [...normalizedBacklinks, ...data]
            .sort((a: any, b: any) => {
              const timeA = new Date(a.created_at || a.timestamp || a.first_seen_at || 0).getTime()
              const timeB = new Date(b.created_at || b.timestamp || b.first_seen_at || 0).getTime()
              return timeB - timeA // Newest first
            })
            .slice(0, 100)
          set({ backlinks: merged })
        } else {
          // No Supabase data, just use local sorted
          const sorted = normalizedBacklinks.sort((a: any, b: any) => {
            const timeA = new Date(a.created_at || a.timestamp || a.first_seen_at || 0).getTime()
            const timeB = new Date(b.created_at || b.timestamp || b.first_seen_at || 0).getTime()
            return timeB - timeA // Newest first
          })
          set({ backlinks: sorted })
        }
      } else {
        // Not Pro user, just use local sorted
        const sorted = normalizedBacklinks.sort((a: any, b: any) => {
          const timeA = new Date(a.created_at || a.timestamp || a.first_seen_at || 0).getTime()
          const timeB = new Date(b.created_at || b.timestamp || b.first_seen_at || 0).getTime()
          return timeB - timeA // Newest first
        })
        set({ backlinks: sorted })
      }
      
    } catch (error) {
      const localResult = await chrome.storage.local.get('localBacklinks')
      set({ backlinks: localResult.localBacklinks || [] })
    }
  },
  
  syncBacklinksToSupabase: async () => {
    const { user, isPro } = get()
    if (!user || !isPro) return
    
    try {
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      if (localBacklinks.length === 0) return
      
      const { data: trackedUrls } = await supabase
        .schema('forgerank')
        .from('tracked_urls')
        .select('id, url')
        .eq('user_id', user.id)
      
      if (!trackedUrls?.length) return
      
      const backlinksToSync = localBacklinks
        .slice(0, 20) // Smaller batch size
        .map((bl: any) => ({
          user_id: user.id,
          tracked_url_id: trackedUrls[0].id, // Use first tracked URL as fallback
          source_url: bl.source_url || bl.sourceUrl || '',
          source_domain: bl.source_domain || bl.sourceDomain || '',
          target_url: bl.target_url || bl.targetUrl || bl.href || '',
          anchor_text: bl.anchor_text || bl.anchorText || null,
          context_type: bl.context_type || bl.contextType || 'generic',
          is_broken: false,
          http_status: null,
          first_seen_at: bl.timestamp || new Date().toISOString(),
          last_checked_at: new Date().toISOString()
        }))
      
      if (backlinksToSync.length > 0) {
        await supabase
          .schema('forgerank')
          .from('backlinks')
          .upsert(backlinksToSync, { 
            ignoreDuplicates: true 
          })
        
        const remainingBacklinks = localBacklinks.slice(backlinksToSync.length)
        await chrome.storage.local.set({ localBacklinks: remainingBacklinks })
      }
    } catch (error) {
      // Silent fail for sync
    }
  },
  
  fetchKeywords: async () => {
    const { user, isPro } = get()
    
    try {
      const localResult = await chrome.storage.local.get('localKeywords')
      const localKeywords = localResult.localKeywords || []
      set({ keywords: localKeywords })
      
      if (user && isPro) {
        const { data } = await supabase
          .schema('forgerank')
          .from('keywords')
          .select('*')
          .eq('user_id', user.id)
          .order('frequency', { ascending: false })
          .limit(50)
        
        if (data) {
          const merged = [...data, ...localKeywords]
            .slice(0, 50)
          set({ keywords: merged })
        }
      }
    } catch (error) {
      // Silent fail for keywords
    }
  },

  // Smart Site Scanning Actions (Zero-Cost Implementation)
  addCompetitorSite: async (url: string) => {
    const { queuedSites, trackedUrls } = get()
    
    try {
      // Normalize URL
      let normalizedUrl: string
      let urlToValidate = url.trim()
      
      // Auto-prepend https:// if no protocol provided
      if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
        urlToValidate = 'https://' + urlToValidate
      }
      
      try {
        normalizedUrl = new URL(urlToValidate).href
      } catch {
        throw new Error('Invalid URL format. Please enter a valid domain like competitor.com or https://competitor.com')
      }
      
      const domain = new URL(normalizedUrl).hostname
      
      // Check if already queued
      if (queuedSites.some(site => site.domain === domain)) {
        throw new Error('This competitor site is already in your scanning queue')
      }
      
      // Check if it's one of their tracked URLs (doesn't make sense)
      if (trackedUrls.some(trackedUrl => new URL(trackedUrl).hostname === domain)) {
        throw new Error('This is one of your tracked domains. Smart Scanning is for competitor analysis.')
      }
      
      // Growth tier limit check
      const maxSites = 10
      if (queuedSites.length >= maxSites) {
        throw new Error(`Maximum ${maxSites} competitor sites allowed in scanning queue`)
      }
      
      const newSite: QueuedSite = {
        id: `site-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: normalizedUrl,
        domain,
        status: 'pending',
        progress: 0,
        foundBacklinks: 0,
        queuedAt: new Date().toISOString()
      }
      
      const updatedQueue = [...queuedSites, newSite]
      set({ queuedSites: updatedQueue })
      
      // Save to Chrome storage
      await chrome.storage.local.set({ queuedSites: updatedQueue })
      
      console.log('🎯 Added competitor site to queue:', domain)
      
    } catch (error) {
      console.error('Error adding competitor site:', error)
      throw error
    }
  },

  removeCompetitorSite: async (siteId: string) => {
    const { queuedSites } = get()
    const updatedQueue = queuedSites.filter(site => site.id !== siteId)
    
    set({ queuedSites: updatedQueue })
    await chrome.storage.local.set({ queuedSites: updatedQueue })
    
    console.log('🗑️ Removed competitor site from queue:', siteId)
  },

  startSiteScanning: async (siteId: string) => {
    const { queuedSites } = get()
    const site = queuedSites.find(s => s.id === siteId)
    
    if (!site) {
      throw new Error('Site not found in queue')
    }
    
    if (site.status === 'scanning') {
      console.log('🎯 Site already scanning:', site.domain)
      return
    }
    
    // Update site status to scanning
    const updatedQueue = queuedSites.map(s => 
      s.id === siteId 
        ? { ...s, status: 'scanning' as const, progress: 0, errorMessage: undefined }
        : s
    )
    
    set({ queuedSites: updatedQueue, isScanning: true })
    await chrome.storage.local.set({ queuedSites: updatedQueue })
    
    console.log('🚀 Starting scan for competitor site:', site.domain)
    
    // Send message to background script to start scanning
    chrome.runtime.sendMessage({
      type: 'START_COMPETITOR_SCAN',
      siteId,
      domain: site.domain,
      url: site.url
    }).catch(error => {
      console.error('Failed to start scanning:', error)
      // Update status to error
      get().updateScanProgress(siteId, 0, 0)
      const errorQueue = get().queuedSites.map(s => 
        s.id === siteId 
          ? { ...s, status: 'error' as const, errorMessage: 'Failed to start scanning' }
          : s
      )
      set({ queuedSites: errorQueue })
    })
  },

  pauseSiteScanning: async (siteId: string) => {
    const { queuedSites } = get()
    const updatedQueue = queuedSites.map(s => 
      s.id === siteId 
        ? { ...s, status: 'paused' as const }
        : s
    )
    
    set({ queuedSites: updatedQueue })
    await chrome.storage.local.set({ queuedSites: updatedQueue })
    
    // Send message to background script to pause scanning
    chrome.runtime.sendMessage({
      type: 'PAUSE_COMPETITOR_SCAN',
      siteId
    }).catch(error => {
      console.error('Failed to pause scanning:', error)
    })
    
    console.log('⏸️ Paused scanning for site:', siteId)
  },

  fetchQueuedSites: async () => {
    try {
      const result = await chrome.storage.local.get('queuedSites')
      const queuedSites = result.queuedSites || []
      set({ queuedSites })
      console.log('🔄 Loaded queued sites:', queuedSites.length)
    } catch (error) {
      console.error('Failed to fetch queued sites:', error)
      set({ queuedSites: [] })
    }
  },

  updateScanProgress: (siteId: string, progress: number, foundBacklinks?: number) => {
    const { queuedSites } = get()
    const updatedQueue = queuedSites.map(site => {
      if (site.id === siteId) {
        const updated = {
          ...site,
          progress: Math.min(progress, 100),
          ...(foundBacklinks !== undefined && { foundBacklinks })
        }
        
        // Mark as completed if progress is 100
        if (progress >= 100) {
          updated.status = 'completed'
          updated.lastScanned = new Date().toISOString()
        }
        
        return updated
      }
      return site
    })
    
    set({ queuedSites: updatedQueue })
    
    // Update Chrome storage
    chrome.storage.local.set({ queuedSites: updatedQueue }).catch(error => {
      console.error('Failed to update scan progress in storage:', error)
    })
    
    // Check if any sites are still scanning
    const stillScanning = updatedQueue.some(site => site.status === 'scanning')
    if (!stillScanning) {
      set({ isScanning: false })
    }
  },

  // Link Health Monitoring - Zero-cost browser fetch API approach
  checkBacklinkHealth: async (backlinkIds?: string[]) => {
    const { backlinks, isPro } = get()
    
    if (!isPro) {
      console.log('🔗 Health check is a Growth tier feature')
      return
    }

    const linksToCheck = backlinkIds 
      ? backlinks.filter(bl => backlinkIds.includes(bl.id))
      : backlinks.slice(0, 50) // Increased limit with better rate limiting

    if (linksToCheck.length === 0) {
      console.log('🔗 No backlinks to check')
      return
    }

    set({ isHealthCheckRunning: true })
    console.log(`🔗 Starting health check for ${linksToCheck.length} backlinks`)

    try {
      const healthChecker = new LinkHealthChecker()
      const urls = linksToCheck.map(bl => bl.source_url)
      
      // Check URLs with progress reporting
      const healthResults = await healthChecker.checkUrlsBatch(urls, {
        retryFailed: true,
        maxRetries: 1,
        onProgress: (progress, result) => {
          console.log(`🔗 Health check progress: ${progress}% - ${result.url}: ${healthChecker.getStatusText(result)}`)
        }
      })

      // Update backlinks with health check results
      const updatedBacklinks = [...backlinks]
      
      healthResults.forEach(result => {
        const backlinkIndex = updatedBacklinks.findIndex(bl => bl.source_url === result.url)
        if (backlinkIndex !== -1) {
          updatedBacklinks[backlinkIndex] = {
            ...updatedBacklinks[backlinkIndex],
            is_broken: healthChecker.isBrokenLink(result),
            http_status: result.httpStatus || null,
            last_checked_at: result.checkedAt,
            health_check_error: result.error,
            redirect_url: result.redirectUrl,
            response_time: result.responseTime
          }
        }
      })

      // Update state
      set({ backlinks: updatedBacklinks })

      // Save to Chrome storage and sync to Supabase if authenticated
      await chrome.storage.local.set({ 
        localBacklinks: updatedBacklinks,
        lastHealthCheck: Date.now()
      })

      // Get health stats for logging
      const stats = healthChecker.getHealthStats(healthResults)
      console.log(`🔗 Health check completed:`, {
        total: stats.total,
        healthy: stats.healthy,
        broken: stats.broken,
        redirected: stats.redirected,
        errorRate: `${stats.errorRate}%`
      })

      // Send email notification if there are broken links or this is a scheduled check
      if (stats.broken > 0 || stats.total > 20) {
        try {
          await get().sendHealthCheckSummary(stats)
        } catch (emailError) {
          console.log('📧 Failed to send health check email:', emailError)
        }
      }

      // Sync to Supabase for authenticated users
      const { isAuthenticated } = get()
      if (isAuthenticated) {
        try {
          await get().syncBacklinksToSupabase()
        } catch (error) {
          console.log('🔗 Failed to sync health check results to Supabase:', error)
        }
      }

    } catch (error) {
      console.error('🔗 Health check error:', error)
    } finally {
      set({ isHealthCheckRunning: false })
    }
  },

  // Domain Authority Proxy Metrics - Zero-cost heuristic-based scoring
  calculateDomainAuthority: (domain: string) => {
    let score = 0
    const insights: string[] = []
    
    // Basic domain quality signals (no API required)
    
    // 1. Domain length (shorter = better)
    if (domain.length <= 10) {
      score += 15
      insights.push('Short, memorable domain')
    } else if (domain.length <= 15) {
      score += 10
    } else if (domain.length > 25) {
      score -= 5
      insights.push('Very long domain')
    }
    
    // 2. TLD quality
    const tld = domain.split('.').pop()?.toLowerCase()
    const highQualityTlds = ['com', 'org', 'net', 'edu', 'gov']
    const mediumQualityTlds = ['io', 'co', 'ai', 'app']
    
    if (highQualityTlds.includes(tld || '')) {
      score += 20
      insights.push('Premium TLD (.com, .org, .net)')
    } else if (mediumQualityTlds.includes(tld || '')) {
      score += 15
      insights.push('Popular modern TLD')
    } else if (tld === 'edu' || tld === 'gov') {
      score += 35
      insights.push('Institutional domain (high authority)')
    }
    
    // 3. Subdomain analysis
    const parts = domain.split('.')
    if (parts.length === 2) {
      score += 10
      insights.push('Root domain (no subdomain)')
    } else if (parts.length > 3) {
      score -= 5
      insights.push('Deep subdomain structure')
    }
    
    // 4. Domain age heuristics (common patterns)
    const hasYear = /\d{4}/.test(domain)
    if (hasYear) {
      score -= 5
      insights.push('Contains year (may indicate temporary content)')
    }
    
    // 5. Authority domain patterns
    const authorityPatterns = [
      'wikipedia', 'github', 'stackoverflow', 'medium', 'dev.to',
      'hackernews', 'reddit', 'linkedin', 'twitter', 'facebook',
      'google', 'microsoft', 'amazon', 'apple', 'mozilla',
      'w3', 'ietf', 'rfc-editor', 'ieee', 'acm'
    ]
    
    const isAuthorityDomain = authorityPatterns.some(pattern => 
      domain.toLowerCase().includes(pattern)
    )
    
    if (isAuthorityDomain) {
      score += 40
      insights.push('Recognized authority platform')
    }
    
    // 6. Blog/content platform indicators
    const contentPlatforms = ['blog', 'news', 'post', 'article', 'content']
    const hasContentIndicator = contentPlatforms.some(keyword =>
      domain.toLowerCase().includes(keyword)
    )
    
    if (hasContentIndicator) {
      score += 15
      insights.push('Content-focused domain')
    }
    
    // 7. Hyphens and numbers (generally lower quality)
    const hyphenCount = (domain.match(/-/g) || []).length
    const numberCount = (domain.match(/\d/g) || []).length
    
    if (hyphenCount > 0) {
      score -= hyphenCount * 3
      insights.push('Contains hyphens (may affect memorability)')
    }
    
    if (numberCount > 2) {
      score -= 5
      insights.push('Heavy use of numbers')
    }
    
    // 8. Common words bonus
    const commonWords = [
      'tech', 'dev', 'code', 'design', 'business', 'startup',
      'company', 'corp', 'solutions', 'services', 'consulting',
      'research', 'institute', 'university', 'college'
    ]
    
    const hasCommonWord = commonWords.some(word =>
      domain.toLowerCase().includes(word)
    )
    
    if (hasCommonWord) {
      score += 10
      insights.push('Contains industry-relevant terms')
    }
    
    // Normalize score to 0-100 range
    score = Math.max(0, Math.min(100, score))
    
    return score
  },

  getDomainInsights: (domain: string) => {
    // Run full domain analysis to get both score and insights
    let score = 0
    const insights: string[] = []
    
    // Duplicate the analysis logic to collect insights
    // 1. Domain length
    if (domain.length <= 10) {
      score += 15
      insights.push('✓ Short, memorable domain')
    } else if (domain.length <= 15) {
      score += 10
    } else if (domain.length > 25) {
      score -= 5
      insights.push('⚠ Very long domain')
    }
    
    // 2. TLD quality
    const tld = domain.split('.').pop()?.toLowerCase()
    const highQualityTlds = ['com', 'org', 'net']
    if (tld === 'edu' || tld === 'gov') {
      score += 35
      insights.push('🎓 Institutional domain (high authority)')
    } else if (highQualityTlds.includes(tld || '')) {
      score += 20
      insights.push('✓ Premium TLD')
    }
    
    // 3. Authority domain check
    const authorityPatterns = [
      'wikipedia', 'github', 'stackoverflow', 'medium',
      'google', 'microsoft', 'amazon', 'apple'
    ]
    
    const isAuthorityDomain = authorityPatterns.some(pattern => 
      domain.toLowerCase().includes(pattern)
    )
    
    if (isAuthorityDomain) {
      score += 40
      insights.push('🏆 Recognized authority platform')
    }
    
    // Normalize score
    score = Math.max(0, Math.min(100, score + 30)) // Base score of 30
    
    // Add score-based insights
    if (score >= 80) {
      insights.unshift('🏆 High authority domain')
    } else if (score >= 60) {
      insights.unshift('⭐ Good authority domain') 
    } else if (score >= 40) {
      insights.unshift('📊 Medium authority domain')
    } else {
      insights.unshift('📉 Lower authority domain')
    }
    
    return {
      authority: score,
      insights: insights.length > 0 ? insights : [`Authority Score: ${score}/100`]
    }
  },

  // Data Integrity & Recovery Functions
  verifyDataIntegrity: async () => {
    const issues: string[] = []
    
    try {
      // Check Chrome storage accessibility
      const storageTest = await chrome.storage.local.get('trackedUrls')
      if (!storageTest) {
        issues.push('Chrome storage is not accessible')
      }
      
      // Check state vs storage consistency
      const { trackedUrls: stateUrls } = get()
      const { trackedUrls: storageUrls = [] } = storageTest
      
      if (JSON.stringify(stateUrls.sort()) !== JSON.stringify(storageUrls.sort())) {
        issues.push('State and storage URLs are out of sync')
        console.warn('🔍 Data integrity issue - state/storage mismatch:', {
          state: stateUrls,
          storage: storageUrls
        })
      }
      
      // Check for empty data when it shouldn't be
      const hasOnboarded = localStorage.getItem('hasCompletedOnboarding') === 'true'
      if (hasOnboarded && storageUrls.length === 0) {
        issues.push('User completed onboarding but has no tracked URLs')
      }
      
      console.log('🔍 Data integrity check:', {
        healthy: issues.length === 0,
        issues
      })
      
      return {
        isHealthy: issues.length === 0,
        issues
      }
    } catch (error) {
      console.error('🔍 Data integrity check failed:', error)
      return {
        isHealthy: false,
        issues: ['Failed to perform integrity check']
      }
    }
  },

  recoverLostData: async () => {
    try {
      console.log('🔍 Attempting data recovery...')
      
      // Try to recover from storage
      await get().fetchTrackedUrls()
      
      // Verify recovery worked
      const { isHealthy } = await get().verifyDataIntegrity()
      
      if (isHealthy) {
        console.log('🔍 Data recovery successful')
        return true
      } else {
        console.log('🔍 Data recovery incomplete')
        return false
      }
    } catch (error) {
      console.error('🔍 Data recovery failed:', error)
      return false
    }
  },

  // URL normalization helper (matches content script)
  normalizeUrl: (url: string): string => {
    if (!url) return ''
    
    try {
      const absoluteUrl = new URL(url, window.location.href)
      let normalized = absoluteUrl.href.toLowerCase()
      
      // Remove trailing slash (except root)
      if (normalized.endsWith('/') && normalized !== absoluteUrl.origin + '/') {
        normalized = normalized.slice(0, -1)
      }
      
      // Remove www. for consistency
      normalized = normalized.replace('://www.', '://')
      
      return normalized
    } catch {
      return ''
    }
  },

  cleanupDuplicateBacklinks: async () => {
    try {
      console.log('🧹 Starting duplicate backlinks cleanup...')
      const { backlinks } = get()
      
      if (backlinks.length === 0) {
        console.log('🧹 No backlinks to clean up')
        return
      }
      
      // Create deduplication map using normalized URLs + anchor text
      const uniqueBacklinks = []
      const seenKeys = new Set()
      
      for (const backlink of backlinks) {
        const sourceUrl = get().normalizeUrl(backlink.source_url || '')
        const targetUrl = get().normalizeUrl(backlink.target_url || '')
        const anchorText = (backlink.anchor_text || '').toLowerCase().trim()
        const key = `${sourceUrl}|${targetUrl}|${anchorText}`
        
        if (!seenKeys.has(key) && key !== '||') {
          seenKeys.add(key)
          // Keep the backlink with normalized URLs
          uniqueBacklinks.push({
            ...backlink,
            source_url: sourceUrl,
            target_url: targetUrl,
            target_domain: (() => {
              try {
                return new URL(targetUrl).hostname
              } catch {
                return backlink.target_domain || ''
              }
            })()
          })
        }
      }
      
      const duplicatesRemoved = backlinks.length - uniqueBacklinks.length
      console.log(`🧹 Removed ${duplicatesRemoved} duplicate backlinks`)
      
      if (duplicatesRemoved > 0) {
        set({ backlinks: uniqueBacklinks })
        
        // Update storage
        await chrome.storage.local.set({ localBacklinks: uniqueBacklinks })
        
        // Sync to Supabase if user is pro
        const { user, isPro } = get()
        if (user && isPro) {
          await get().syncBacklinksToSupabase()
        }
      }
      
    } catch (error) {
      console.error('🧹 Cleanup failed:', error)
    }
  },

  // Email Notification Functions
  sendNewBacklinkEmail: async (backlinks: Backlink[]) => {
    const { user, isAuthenticated, notificationsEnabled } = get()
    
    if (!isAuthenticated || !user || !notificationsEnabled) {
      return
    }

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'new_backlinks',
          to: user.email,
          user_id: user.id,
          data: backlinks.slice(0, 10).map(bl => ({
            source_url: bl.source_url,
            source_domain: bl.source_domain,
            target_url: bl.target_url,
            anchor_text: bl.anchor_text,
            context_type: bl.context_type || bl.contextType || 'generic',
            found_at: bl.created_at
          }))
        }
      })

      if (error) {
        console.error('📧 Failed to send new backlink email:', error)
      } else {
        console.log('📧 New backlink email sent successfully')
      }
    } catch (error) {
      console.error('📧 Email service error:', error)
    }
  },

  sendWeeklyDigest: async () => {
    const { user, isAuthenticated, notificationsEnabled, backlinks, keywords } = get()
    
    if (!isAuthenticated || !user || !notificationsEnabled) {
      return
    }

    try {
      // Calculate weekly stats
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      const newBacklinks = backlinks.filter(bl => 
        new Date(bl.created_at) > weekAgo
      )
      
      const brokenLinks = backlinks.filter(bl => bl.is_broken).length
      
      // Get top domains
      const domainCounts = new Map<string, number>()
      backlinks.forEach(bl => {
        const domain = bl.source_domain
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
      })
      
      const topDomains = Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain]) => domain)

      const digestData = {
        new_backlinks: newBacklinks.length,
        total_backlinks: backlinks.length,
        broken_links: brokenLinks,
        keywords_discovered: keywords.filter(kw => 
          kw.created_at && new Date(kw.created_at) > weekAgo
        ).length,
        top_domains: topDomains,
        period: {
          start: weekAgo.toISOString(),
          end: now.toISOString()
        }
      }

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'weekly_digest',
          to: user.email,
          user_id: user.id,
          data: digestData
        }
      })

      if (error) {
        console.error('📧 Failed to send weekly digest:', error)
      } else {
        console.log('📧 Weekly digest sent successfully')
      }
    } catch (error) {
      console.error('📧 Weekly digest error:', error)
    }
  },

  sendHealthCheckSummary: async (healthStats: any) => {
    const { user, isAuthenticated, notificationsEnabled, isPro } = get()
    
    if (!isAuthenticated || !user || !notificationsEnabled || !isPro) {
      return
    }

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'health_check_summary',
          to: user.email,
          user_id: user.id,
          data: {
            healthy_count: healthStats.healthy,
            broken_count: healthStats.broken,
            redirected_count: healthStats.redirected,
            total_checked: healthStats.total,
            error_rate: healthStats.errorRate
          }
        }
      })

      if (error) {
        console.error('📧 Failed to send health check summary:', error)
      } else {
        console.log('📧 Health check summary sent successfully')
      }
    } catch (error) {
      console.error('📧 Health check summary error:', error)
    }
  }
  } // Close the return object
}) // Close the create function

// Initialize message listeners for Smart Site Scanning
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const handleBackgroundMessage = (message: any) => {
    console.log('Store: Received background message:', message.type)
    
    if (message.type === 'UPDATE_SCAN_STATUS') {
      const store = useStore.getState()
      const updatedSites = store.queuedSites.map(site => 
        site.id === message.siteId 
          ? { 
              ...site, 
              status: message.status,
              progress: message.progress !== undefined ? message.progress : site.progress,
              foundBacklinks: message.foundBacklinks !== undefined ? message.foundBacklinks : site.foundBacklinks,
              totalPages: message.totalPages !== undefined ? message.totalPages : site.totalPages,
              scannedPages: message.scannedPages !== undefined ? message.scannedPages : site.scannedPages,
              errorMessage: message.errorMessage || site.errorMessage,
              lastScanned: message.status === 'completed' ? new Date().toISOString() : site.lastScanned
            }
          : site
      )
      
      useStore.setState({ queuedSites: updatedSites })
      
      // Persist to storage if user is authenticated
      if (store.isAuthenticated) {
        chrome.storage.local.set({ queuedSites: updatedSites }).catch(console.error)
      }
      
      // Check if scanning is still active
      const stillScanning = updatedSites.some(site => site.status === 'scanning')
      if (!stillScanning) {
        useStore.setState({ isScanning: false })
      }
    }
    
    if (message.type === 'BACKLINKS_UPDATED') {
      // Reload backlinks when background script finds new ones
      const currentBacklinks = useStore.getState().backlinks
      const oldCount = currentBacklinks.length
      
      // Fetch updated backlinks
      useStore.getState().fetchBacklinks().then(() => {
        const newBacklinks = useStore.getState().backlinks
        const newCount = newBacklinks.length
        
        // If we have new backlinks (more than 3 new ones to avoid spam), send email notification
        if (newCount > oldCount && (newCount - oldCount) >= 3) {
          const recentBacklinks = newBacklinks
            .filter(bl => !currentBacklinks.find(old => old.id === bl.id))
            .slice(0, 10) // Limit to 10 most recent
          
          if (recentBacklinks.length > 0) {
            useStore.getState().sendNewBacklinkEmail(recentBacklinks).catch(error => {
              console.log('📧 Failed to send new backlink email:', error)
            })
          }
        }
      })
    }
    
    if (message.type === 'COMPETITOR_INTELLIGENCE_FOUND') {
      // Store competitor intelligence data
      console.log('Store: Received competitor intelligence for site:', message.siteId)
      console.log('Store: Intelligence data:', message.intelligence)
      
      // For now, we'll just log it - in future we might want to store this in state
      // or send it to the backend for analysis
    }
  }
  
  // Add message listener
  chrome.runtime.onMessage.addListener(handleBackgroundMessage)

  // Set up weekly digest scheduler (runs on Sundays)
  const scheduleWeeklyDigest = () => {
    const now = new Date()
    const nextSunday = new Date()
    nextSunday.setDate(now.getDate() + (7 - now.getDay()))
    nextSunday.setHours(9, 0, 0, 0) // 9 AM on Sunday
    
    const timeUntilSunday = nextSunday.getTime() - now.getTime()
    
    setTimeout(() => {
      const store = useStore.getState()
      if (store.isAuthenticated && store.notificationsEnabled) {
        store.sendWeeklyDigest().catch(error => {
          console.log('📧 Failed to send weekly digest:', error)
        })
      }
      
      // Schedule the next one
      scheduleWeeklyDigest()
    }, timeUntilSunday)
  }
  
  // Start the weekly digest scheduler
  scheduleWeeklyDigest()
}
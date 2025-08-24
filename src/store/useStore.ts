import { create } from 'zustand'
import type { Keyword } from '../types/keyword'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

type Tab = 'dashboard' | 'tracked-links' | 'backlinks' | 'keywords' | 'settings' | 'upgrade'

interface Backlink {
  id: string
  source_url: string
  source_domain: string
  target_url: string
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
  
  // Core Actions
  initializeAuth: () => Promise<void>
  signIn: (provider: 'github' | 'google' | 'email', email?: string, password?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  loadUserData: (forceRefresh?: boolean) => Promise<void>
  
  // Data Actions
  addTrackedUrl: (url: string) => Promise<void>
  removeTrackedUrl: (url: string) => Promise<void>
  fetchTrackedUrls: () => Promise<void>
  fetchBacklinks: () => Promise<void>
  syncBacklinksToSupabase: () => Promise<void>
  fetchKeywords: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
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
        await get().loadUserData()
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
  
  
  loadUserData: async (forceRefresh = false) => {
    const { user, backlinks, keywords, trackedUrls } = get()
    if (!user) {
      console.log('🔍 loadUserData: No user found, skipping')
      return
    }

    // If we already have data and this isn't a forced refresh, skip data fetching
    if (!forceRefresh && backlinks.length > 0 && keywords.length > 0 && trackedUrls.length > 0) {
      console.log('🔍 loadUserData: Data already loaded, skipping refresh')
      return
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
      try {
        normalizedUrl = new URL(url).href
      } catch {
        throw new Error('Invalid URL format. Please enter a valid URL like https://example.com')
      }

      if (trackedUrls.includes(normalizedUrl)) {
        throw new Error('URL already tracked')
      }

      const maxUrls = isPro ? 20 : 3
      if (trackedUrls.length >= maxUrls) {
        throw new Error(`Maximum ${maxUrls} URLs allowed. ${isPro ? '' : 'Upgrade to Pro for up to 20 URLs.'}`)
      }

      const updatedUrls = [...trackedUrls, normalizedUrl]
      
      // Always save to local storage
      await chrome.storage.local.set({ trackedUrls: updatedUrls })
      set({ trackedUrls: updatedUrls })

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

      // Notify scanner to reload
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'RELOAD_SCANNER_STATE',
            trackedUrls: updatedUrls
          })
        }
      })

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
    
    // Always load from local first
    const localResult = await chrome.storage.local.get('trackedUrls')
    const localUrls = localResult.trackedUrls || []
    set({ trackedUrls: localUrls })
    
    // Then fetch from Supabase if authenticated
    if (user) {
      const { data, error } = await supabase
        .schema('forgerank')
        .from('tracked_urls')
        .select('*')
        .eq('user_id', user.id)
      
      if (!error && data) {
        const supabaseUrls = data.map(d => d.url)
        const mergedUrls = [...new Set([...localUrls, ...supabaseUrls])]
        await chrome.storage.local.set({ trackedUrls: mergedUrls })
        set({ trackedUrls: mergedUrls })
      }
    }
  },
  
  fetchBacklinks: async () => {
    const { user, isPro } = get()
    
    try {
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      // Simple normalization - handle common field variations
      const normalizedBacklinks = localBacklinks.map((bl: any) => ({
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
            onConflict: 'source_url,target_url,user_id',
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
  }
}))
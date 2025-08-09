import { create } from 'zustand'
import type { Keyword } from '../types/keyword'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

const WHITELISTED_EMAILS = [
  'ben@forgeheart.run',
  // Add any other emails you want to whitelist for Pro features
]

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
  signIn: (provider: 'github' | 'google' | 'email', email?: string, password?: string) => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  loadUserData: () => Promise<void>
  
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
  
  // Core Actions
  signIn: async (provider, email, password) => {
    try {
      let result
      
      if (provider === 'email' && email && password) {
        // Try sign in first
        result = await supabase.auth.signInWithPassword({ email, password })
        
        // If sign in fails with invalid credentials, try sign up
        if (result.error?.message?.includes('Invalid login credentials')) {
          result = await supabase.auth.signUp({ email, password })
        }
      } else {
        result = await supabase.auth.signInWithOAuth({
          provider: provider as 'github' | 'google',
          options: {
            redirectTo: chrome.runtime.getURL('index.html')
          }
        })
      }
      
      if (result?.error) throw result.error
      
      // Auth state change listener will handle the rest
      set({ isLoginModalOpen: false })
    } catch (error: any) {
      throw error
    }
  },
  
  signOut: async () => {
    try {
      await supabase.auth.signOut()
      
      // Clear auth data but keep local backlinks and tracked URLs
      const preserveData = await chrome.storage.local.get(['localBacklinks', 'trackedUrls', 'isDarkMode', 'notificationsEnabled'])
      await chrome.storage.local.clear()
      await chrome.storage.local.set(preserveData)
      
      set({
        user: null,
        isAuthenticated: false,
        isPro: false,
        trackedUrls: [],
        backlinks: [],
        keywords: [] as Keyword[]
      })
    } catch (error) {
      // Silent fail
    }
  },
  
  checkAuth: async () => {
    try {
      // Load UI settings immediately
      if (chrome?.storage?.local) {
        const uiSettings = await chrome.storage.local.get(['isDarkMode', 'notificationsEnabled'])
        if (uiSettings.isDarkMode !== undefined) set({ isDarkMode: uiSettings.isDarkMode })
        if (uiSettings.notificationsEnabled !== undefined) set({ notificationsEnabled: uiSettings.notificationsEnabled })
      }

      // Quick session check only - don't load data
      const { data: { session }, error } = await supabase.auth.getSession()

      if (!error && session?.user) {
        // Whitelist check
        const isWhitelisted = WHITELISTED_EMAILS.includes(session.user.email || '')

        set({
          user: session.user,
          isAuthenticated: true,
          isPro: isWhitelisted, // immediate Pro if whitelisted
          isLoading: false,
        })

        // Store minimal auth state
        if (chrome?.storage?.local) {
          await chrome.storage.local.set({
            userId: session.user.id,
            userEmail: session.user.email,
            isAuthenticated: true,
            isPro: isWhitelisted,
          })
        }

        // Load full user data after a short delay (non-blocking)
        setTimeout(() => {
          get().loadUserData()
        }, 100)
      } else {
        set({
          isAuthenticated: false,
          user: null,
          isPro: false,
          isLoading: false,
        })
        // Still load tracked URLs from local storage for non-authenticated users
        await get().fetchTrackedUrls()
        await get().fetchBacklinks() // Load local backlinks
      }
    } catch {
      set({
        isAuthenticated: false,
        user: null,
        isPro: false,
        isLoading: false,
      })
      await get().fetchTrackedUrls()
      await get().fetchBacklinks() // Load local backlinks
    }
  },
  
  loadUserData: async () => {
    const { user } = get()
    if (!user) return
    
    try {
      // Check if user is whitelisted FIRST
      const isWhitelisted = WHITELISTED_EMAILS.includes(user.email || '')
      
      if (isWhitelisted) {
        set({ isPro: true })
        if (chrome?.storage?.local) {
          await chrome.storage.local.set({ isPro: true })
        }
      } else {
        // Normal Pro status check
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          const isPro = profile.is_pro || 
            (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
          
          set({ isPro })
          
          if (chrome?.storage?.local) {
            await chrome.storage.local.set({ isPro })
          }
        }
      }
      
      // Load all user data in parallel
      await Promise.all([
        get().fetchTrackedUrls(),
        get().fetchBacklinks(),
        get().fetchKeywords()
      ])
      
      // Sync local backlinks to Supabase in background
      setTimeout(() => {
        get().syncBacklinksToSupabase()
      }, 1000)
      
    } catch (error) {
      console.error('Error loading user data:', error)
      // Check whitelist even on error
      const isWhitelisted = WHITELISTED_EMAILS.includes(user.email || '')
      if (isWhitelisted) {
        set({ isPro: true })
      }
    }
  },
  
  // Data Actions
  addTrackedUrl: async (url) => {
    const { user, isPro, trackedUrls } = get()

    try {
      // Normalize & validate URL with friendly error
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

      const newUrls = [...trackedUrls, normalizedUrl]
      
      // Always update local storage first for immediate effect
      set({ trackedUrls: newUrls })
      await chrome.storage.local.set({ trackedUrls: newUrls })
      
      // Then sync to Supabase if authenticated
      if (user) {
        try {
          const { error } = await supabase
            .from('tracked_urls')
            .insert({
              user_id: user.id,
              url: normalizedUrl,
              domain: new URL(normalizedUrl).hostname,
            })

          if (error) {
            console.error('Supabase sync error:', error)
            // Don't throw - local update succeeded
          }
        } catch (e) {
          console.error('Supabase sync failed:', e)
          // Don't throw - local update succeeded
        }
      }
    } catch (error: any) {
      console.error('addTrackedUrl error:', error)
      throw error
    }
  },
  
  removeTrackedUrl: async (url) => {
    const { user, trackedUrls } = get()
    
    const newUrls = trackedUrls.filter(u => u !== url)
    
    // Update local first for immediate effect
    set({ trackedUrls: newUrls })
    await chrome.storage.local.set({ trackedUrls: newUrls })
    
    // Then sync to Supabase if authenticated
    if (user) {
      try {
        const { error } = await supabase
          .from('tracked_urls')
          .delete()
          .eq('user_id', user.id)
          .eq('url', url)
        
        if (error) {
          console.error('Supabase delete error:', error)
        }
      } catch (e) {
        console.error('Supabase delete failed:', e)
      }
    }
  },
  
  fetchTrackedUrls: async () => {
    const { user } = get()
    
    try {
      // Always load from local storage first
      const localResult = await chrome.storage.local.get('trackedUrls')
      const localUrls = localResult.trackedUrls || []
      set({ trackedUrls: localUrls })
      
      // Then sync from Supabase if authenticated
      if (user) {
        const { data, error } = await supabase
          .from('tracked_urls')
          .select('url')
          .eq('user_id', user.id)
          .eq('is_active', true)
        
        if (!error && data) {
          const supabaseUrls = data.map(d => d.url)
          
          // Merge local and Supabase URLs (deduplicate)
          const mergedUrls = Array.from(new Set([...localUrls, ...supabaseUrls]))
          
          set({ trackedUrls: mergedUrls })
          await chrome.storage.local.set({ trackedUrls: mergedUrls })
        }
      }
    } catch (error) {
      console.error('fetchTrackedUrls error:', error)
    }
  },
  
  fetchBacklinks: async () => {
    const { user } = get()
    
    try {
      // ALWAYS load from local storage first for immediate display
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      console.log('UI: localBacklinks length =', localBacklinks.length)
      
      // Transform local backlinks to match expected shape
      const transformedBacklinks = localBacklinks.map((bl: any, index: number) => ({
        id: bl.id || `local-${index}-${Date.now()}`,
        source_url: bl.source_url || bl.sourceUrl || '',
        source_domain: bl.source_domain || bl.sourceDomain || (bl.source_url ? new URL(bl.source_url).hostname : ''),
        target_url: bl.target_url || bl.targetUrl || bl.href || '',
        anchor_text: bl.anchor_text || bl.anchorText || null,
        context_type: bl.context_type || bl.contextType || 'generic',
        is_broken: bl.is_broken || false,
        http_status: bl.http_status || null,
        first_seen_at: bl.first_seen_at || bl.timestamp || bl.created_at,
        last_checked_at: bl.last_checked_at || bl.timestamp,
        created_at: bl.created_at || bl.timestamp || new Date().toISOString()
      }))
      
      console.table(transformedBacklinks.slice(0, 3)) // Show first 3 rows to verify shape
      
      // Set local backlinks immediately
      set({ backlinks: transformedBacklinks })
      
      // If authenticated, also fetch from Supabase and merge
      if (user) {
        const { data, error } = await supabase
          .from('backlinks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (!error && data && data.length > 0) {
          // Merge Supabase data with local (Supabase takes precedence for duplicates)
          const supabaseIds = new Set(data.map(d => d.source_url + d.target_url))
          const uniqueLocalBacklinks = transformedBacklinks.filter(
            (bl: any) => !supabaseIds.has(bl.source_url + bl.target_url)
          )
          
          const mergedBacklinks = [...data, ...uniqueLocalBacklinks]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 100)
          
          set({ backlinks: mergedBacklinks })
        }
      }
    } catch (error) {
      console.error('fetchBacklinks error:', error)
      // On error, still show local backlinks
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      set({ backlinks: localBacklinks })
    }
  },
  
  syncBacklinksToSupabase: async () => {
    const { user, backlinks } = get()
    if (!user || backlinks.length === 0) return
    
    try {
      // Get local backlinks that haven't been synced
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      // Transform and prepare for Supabase
      const backlinksToSync = localBacklinks
        .filter((bl: any) => !bl.id?.startsWith('local-'))
        .map((bl: any) => ({
          user_id: user.id,
          tracked_url_id: user.id, // Simplified - should map to actual tracked URL
          source_url: bl.source_url || bl.sourceUrl || bl.href,
          source_domain: bl.source_domain || (bl.source_url ? new URL(bl.source_url).hostname : ''),
          target_url: bl.target_url || bl.targetUrl || bl.href,
          anchor_text: bl.anchor_text || bl.anchorText || null,
          context_type: bl.context_type || bl.contextType || 'generic',
          is_broken: false,
          http_status: null,
          first_seen_at: bl.timestamp || new Date().toISOString(),
          last_checked_at: bl.timestamp || new Date().toISOString()
        }))
        .slice(0, 50) // Limit batch size
      
      if (backlinksToSync.length > 0) {
        const { error } = await supabase
          .from('backlinks')
          .upsert(backlinksToSync, { 
            onConflict: 'source_url,target_url,user_id',
            ignoreDuplicates: true 
          })
        
        if (error) {
          console.error('Sync to Supabase failed:', error)
        } else {
          // Clear synced backlinks from local storage
          const unsyncedBacklinks = localBacklinks.slice(backlinksToSync.length)
          await chrome.storage.local.set({ localBacklinks: unsyncedBacklinks })
        }
      }
    } catch (error) {
      console.error('syncBacklinksToSupabase error:', error)
    }
  },
  
  fetchKeywords: async () => {
    const { user } = get()
    
    try {
      // Always load from local first
      const localResult = await chrome.storage.local.get('localKeywords')
      const localKeywords = localResult.localKeywords || []
      set({ keywords: localKeywords })
      
      // Then fetch from Supabase if authenticated
      if (user) {
        const { data, error } = await supabase
          .from('keywords')
          .select('*')
          .eq('user_id', user.id)
          .order('frequency', { ascending: false })
          .limit(50)
        
        if (!error && data && data.length > 0) {
          // Merge with local keywords
          const keywordMap = new Map()
          
          // Add Supabase keywords first (higher priority)
          data.forEach(kw => {
            keywordMap.set(kw.keyword, kw)
          })
          
          // Add local keywords if not already present
          localKeywords.forEach((kw: Keyword) => {
            if (!keywordMap.has(kw.keyword)) {
              keywordMap.set(kw.keyword, kw)
            }
          })
          
          const mergedKeywords = Array.from(keywordMap.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 50)
          
          set({ keywords: mergedKeywords })
        }
      }
    } catch (error) {
      console.error('fetchKeywords error:', error)
      // On error, still show local keywords
      const localResult = await chrome.storage.local.get('localKeywords')
      const localKeywords = localResult.localKeywords || []
      set({ keywords: localKeywords })
    }
  }
}))

// Add runtime listener for background notifications
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'BACKLINKS_UPDATED') {
      // re-read localBacklinks and update state
      useStore.getState().fetchBacklinks()
    }
  })
}
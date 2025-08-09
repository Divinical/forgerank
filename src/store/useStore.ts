import { create } from 'zustand'
import type { Keyword } from '../types/keyword'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

// Remove hardcoded whitelist - use Supabase user table instead
const IS_DEV = import.meta.env.DEV

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
        
        // If user doesn't exist, sign up
        if (result.error?.message?.includes('Invalid login credentials')) {
          result = await supabase.auth.signUp({ email, password })
        }
      } else if (provider === 'github' || provider === 'google') {
        result = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: chrome.identity.getRedirectURL()
          }
        })
      }
      
      if (result?.error) throw result.error
      
      // For OAuth providers, result.data contains { provider, url } not user data
      // User data comes later via session callback, so just close modal
      if (provider === 'email' && result?.data && 'user' in result.data && result.data.user) {
        set({ user: result.data.user, isAuthenticated: true })
        await get().loadUserData()
      }
      // For OAuth, the auth state change listener will handle setting user data
      
      set({ isLoginModalOpen: false })
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  },
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ 
      user: null, 
      isAuthenticated: false, 
      isPro: false,
      backlinks: [],
      keywords: []
    })
    chrome.storage.local.remove(['isPro'])
  },
  
  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, isAuthenticated: true })
        // Load user data in background
        setTimeout(() => get().loadUserData(), 100)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    }
  },
  
  loadUserData: async () => {
    const { user } = get()
    if (!user) return
    
    try {
      // Check Pro status from database
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        // Check if user is pro OR has active trial
        const isPro = profile.is_pro || 
          (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
        
        set({ isPro })
        
        if (chrome?.storage?.local) {
          await chrome.storage.local.set({ isPro })
        }
        
        // Log for debugging
        if (IS_DEV) {
          console.log('User Pro Status:', {
            email: user.email,
            is_pro: profile.is_pro,
            trial_ends_at: profile.trial_ends_at,
            isPro
          })
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
    const { user } = get()
    
    try {
      // ALWAYS load from local storage first
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      if (IS_DEV) {
        console.log('Raw local backlinks:', localBacklinks.slice(0, 2))
      }
      
      // Normalize the data structure - handle both old and new field names
      const normalizedBacklinks = localBacklinks.map((bl: any) => {
        const normalized: Backlink = {
          id: bl.id || `local-${Date.now()}-${Math.random()}`,
          // Handle multiple possible field names
          source_url: bl.source_url || bl.sourceUrl || window.location.href,
          source_domain: bl.source_domain || bl.sourceDomain || 
            (bl.source_url ? new URL(bl.source_url).hostname : window.location.hostname),
          target_url: bl.target_url || bl.targetUrl || bl.href || '',
          anchor_text: bl.anchor_text || bl.anchorText || bl.anchor_text || '',
          context_type: bl.context_type || bl.contextType || 'generic',
          is_broken: bl.is_broken || false,
          http_status: bl.http_status || null,
          first_seen_at: bl.first_seen_at || bl.timestamp || bl.created_at || new Date().toISOString(),
          last_checked_at: bl.last_checked_at || bl.timestamp || new Date().toISOString(),
          created_at: bl.created_at || bl.timestamp || new Date().toISOString(),
          // Keep legacy fields for compatibility
          timestamp: bl.timestamp,
          isHidden: bl.isHidden,
          parentTagName: bl.parentTagName,
          href: bl.href,
          anchorText: bl.anchorText,
          contextType: bl.contextType
        }
        return normalized
      })
      
      // Set local backlinks immediately for instant display
      set({ backlinks: normalizedBacklinks })
      
      // If authenticated and Pro, fetch from Supabase and merge
      if (user && get().isPro) {
        const { data, error } = await supabase
          .from('backlinks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (!error && data && data.length > 0) {
          // Create a Set for deduplication based on source_url + target_url
          const existingKeys = new Set(
            data.map(d => `${d.source_url}|${d.target_url}`)
          )
          
          // Filter local backlinks to avoid duplicates
          const uniqueLocalBacklinks = normalizedBacklinks.filter(
            (bl: any) => !existingKeys.has(`${bl.source_url}|${bl.target_url}`)
          )
          
          // Merge and sort by creation date
          const mergedBacklinks = [...data, ...uniqueLocalBacklinks]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 100) // Keep only the most recent 100
          
          set({ backlinks: mergedBacklinks })
        }
      }
      
      if (IS_DEV) {
        console.log('Normalized backlinks count:', normalizedBacklinks.length)
        console.log('Final backlinks in state:', get().backlinks.length)
      }
      
    } catch (error) {
      console.error('fetchBacklinks error:', error)
      // On error, still try to show local backlinks
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      set({ backlinks: localBacklinks })
    }
  },
  
  syncBacklinksToSupabase: async () => {
    const { user, isPro } = get()
    if (!user || !isPro) return
    
    try {
      // Get local backlinks
      const localResult = await chrome.storage.local.get('localBacklinks')
      const localBacklinks = localResult.localBacklinks || []
      
      if (localBacklinks.length === 0) return
      
      // Get tracked URLs for proper mapping
      const { data: trackedUrls } = await supabase
        .from('tracked_urls')
        .select('id, url')
        .eq('user_id', user.id)
      
      if (!trackedUrls || trackedUrls.length === 0) {
        console.log('No tracked URLs found for user')
        return
      }
      
      // Create a map of URL to tracked_url_id
      const urlToIdMap = new Map(
        trackedUrls.map(tu => [tu.url, tu.id])
      )
      
      // Transform and prepare for Supabase
      const backlinksToSync = localBacklinks
        .filter((bl: any) => {
          // Only sync backlinks that match tracked URLs
          const targetUrl = bl.target_url || bl.targetUrl || bl.href
          return targetUrl && Array.from(urlToIdMap.keys()).some(trackedUrl => 
            targetUrl.includes(trackedUrl.replace(/https?:\/\//, ''))
          )
        })
        .slice(0, 50) // Limit batch size
        .map((bl: any) => {
          const targetUrl = bl.target_url || bl.targetUrl || bl.href
          // Find the matching tracked URL
          let trackedUrlId = user.id // fallback
          for (const [url, id] of urlToIdMap.entries()) {
            if (targetUrl.includes(url.replace(/https?:\/\//, ''))) {
              trackedUrlId = id
              break
            }
          }
          
          return {
            user_id: user.id,
            tracked_url_id: trackedUrlId,
            source_url: bl.source_url || bl.sourceUrl || window.location.href,
            source_domain: bl.source_domain || 
              (bl.source_url ? new URL(bl.source_url).hostname : window.location.hostname),
            target_url: targetUrl,
            anchor_text: bl.anchor_text || bl.anchorText || null,
            context_type: bl.context_type || bl.contextType || 'generic',
            is_broken: false,
            http_status: null,
            first_seen_at: bl.timestamp || new Date().toISOString(),
            last_checked_at: new Date().toISOString()
          }
        })
      
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
          const remainingBacklinks = localBacklinks.slice(backlinksToSync.length)
          await chrome.storage.local.set({ localBacklinks: remainingBacklinks })
          
          if (IS_DEV) {
            console.log(`Synced ${backlinksToSync.length} backlinks to Supabase`)
          }
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
      if (user && get().isPro) {
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
          localKeywords.forEach((kw: any) => {
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
    }
  }
}))
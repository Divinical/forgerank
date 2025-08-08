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
  first_seen_at: string
  last_checked_at: string
  created_at: string
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
      await chrome.storage.local.clear()
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
      }
    } catch {
      set({
        isAuthenticated: false,
        user: null,
        isPro: false,
        isLoading: false,
      })
      await get().fetchTrackedUrls()
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

      if (user) {
        // Persist to Supabase for authenticated users
        const { error } = await supabase
          .from('tracked_urls')
          .insert({
            user_id: user.id,
            url: normalizedUrl,
            domain: new URL(normalizedUrl).hostname,
          })

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(error.message || 'Failed to add URL to database')
        }

        await get().fetchTrackedUrls()
      } else {
        // Local storage for guests
        const newUrls = [...trackedUrls, normalizedUrl]
        set({ trackedUrls: newUrls })
        await chrome.storage.local.set({ trackedUrls: newUrls })
      }
    } catch (error: any) {
      console.error('addTrackedUrl error:', error)
      throw error
    }
  },
  
  removeTrackedUrl: async (url) => {
    const { user, trackedUrls } = get()
    
    if (user) {
      const { error } = await supabase
        .from('tracked_urls')
        .delete()
        .eq('user_id', user.id)
        .eq('url', url)
      
      if (error) throw error
      
      await get().fetchTrackedUrls()
    } else {
      const newUrls = trackedUrls.filter(u => u !== url)
      set({ trackedUrls: newUrls })
      await chrome.storage.local.set({ trackedUrls: newUrls })
    }
  },
  
  fetchTrackedUrls: async () => {
    const { user } = get()
    
    try {
      if (user) {
        const { data, error } = await supabase
          .from('tracked_urls')
          .select('url')
          .eq('user_id', user.id)
          .eq('is_active', true)
        
        if (!error && data) {
          const urls = data.map(d => d.url)
          set({ trackedUrls: urls })
          await chrome.storage.local.set({ trackedUrls: urls })
        }
      } else {
        const result = await chrome.storage.local.get('trackedUrls')
        const urls = result.trackedUrls || []
        set({ trackedUrls: urls })
      }
    } catch (error) {
      // Silent fail
    }
  },
  
  fetchBacklinks: async () => {
    const { user } = get()
    
    try {
      if (user) {
        const { data, error } = await supabase
          .from('backlinks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (!error && data) {
          set({ backlinks: data })
        } else {
          set({ backlinks: [] })
        }
      } else {
        const result = await chrome.storage.local.get('localBacklinks')
        const backlinks = result.localBacklinks || []
        set({ backlinks })
      }
    } catch (error) {
      set({ backlinks: [] })
    }
  },
  
  fetchKeywords: async () => {
    const { user } = get()
    
    try {
      if (user) {
        const { data, error } = await supabase
          .from('keywords')
          .select('*')
          .eq('user_id', user.id)
          .order('frequency', { ascending: false })
          .limit(50)
        
        if (!error && data) {
          set({ keywords: data })
        } else {
          set({ keywords: [] as Keyword[] })
        }
      } else {
        if (!chrome || !chrome.storage || !chrome.storage.local) {
          return
        }
        
        const result = await chrome.storage.local.get('localKeywords')
        const keywords = result.localKeywords || []
        set({ keywords })
      }
    } catch (error) {
      set({ keywords: [] as Keyword[] })
    }
  }
}))
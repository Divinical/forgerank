import { create } from 'zustand'
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
  first_seen_at: string
  last_checked_at: string
  created_at: string
}

interface Keyword {
  id: string
  keyword: string
  frequency: number
  relevance: string
  created_at: string
}

interface AppState {
  // Tab Management
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  
  // UI State
  isDarkMode: boolean
  toggleDarkMode: () => void
  
  // Modal State
  isLoginModalOpen: boolean
  setLoginModalOpen: (open: boolean) => void
  isUpgradeModalOpen: boolean
  setUpgradeModalOpen: (open: boolean) => void
  
  // Auth State
  user: User | null
  isAuthenticated: boolean
  isPro: boolean
  trialDaysLeft: number
  isLoading: boolean
  
  // Data State
  trackedUrls: string[]
  backlinks: Backlink[]
  keywords: Keyword[]
  
  // Actions
  signIn: (provider: 'github' | 'google' | 'email', email?: string, password?: string) => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  addTrackedUrl: (url: string) => Promise<void>
  removeTrackedUrl: (url: string) => Promise<void>
  fetchTrackedUrls: () => Promise<void>
  fetchBacklinks: () => Promise<void>
  fetchKeywords: () => Promise<void>
  syncPendingBacklinks: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  // Tab Management
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // UI State
  isDarkMode: true,
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  
  // Modal State
  isLoginModalOpen: false,
  setLoginModalOpen: (open) => set({ isLoginModalOpen: open }),
  isUpgradeModalOpen: false,
  setUpgradeModalOpen: (open) => set({ isUpgradeModalOpen: open }),
  
  // Auth State
  user: null,
  isAuthenticated: false,
  isPro: false,
  trialDaysLeft: 0,
  isLoading: true,
  
  // Data State
  trackedUrls: [],
  backlinks: [],
  keywords: [],
  
  // Auth Actions
  signIn: async (provider, email, password) => {
    try {
      let result
      
      if (provider === 'email' && email && password) {
        result = await supabase.auth.signInWithPassword({ email, password })
      } else if (provider === 'github' || provider === 'google') {
        result = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: chrome.runtime.getURL('index.html')
          }
        })
      }
      
      if (result?.error) throw result.error
      
      // Check auth will handle the rest
      await get().checkAuth()
      set({ isLoginModalOpen: false })
    } catch (error) {
      console.error('Sign in error:', error)
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
        keywords: []
      })
    } catch (error) {
      console.error('Sign out error:', error)
    }
  },
  
  checkAuth: async () => {
    try {
      set({ isLoading: true })
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          const isPro = profile.is_pro || 
            (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
          
          const trialDaysLeft = profile.trial_ends_at 
            ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 0
          
          set({
            user,
            isAuthenticated: true,
            isPro,
            trialDaysLeft
          })
          
          // Store auth state in chrome storage
          await chrome.storage.local.set({
            userId: user.id,
            isAuthenticated: true,
            isPro
          })
          
          // Fetch user data
          await Promise.all([
            get().fetchTrackedUrls(),
            get().fetchBacklinks(),
            get().fetchKeywords()
          ])
        }
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isPro: false
        })
        
        await chrome.storage.local.set({
          isAuthenticated: false,
          isPro: false
        })
      }
    } catch (error) {
      console.error('Auth check error:', error)
    } finally {
      set({ isLoading: false })
    }
  },
  
  // Data Actions
  addTrackedUrl: async (url) => {
    const { user, isPro, trackedUrls } = get()
    
    // Validate URL
    try {
      const normalizedUrl = new URL(url).href
      
      // Check limits
      const maxUrls = isPro ? 20 : 3
      if (trackedUrls.length >= maxUrls) {
        throw new Error(`Maximum ${maxUrls} URLs allowed`)
      }
      
      if (user) {
        // Save to Supabase
        const { error } = await supabase
          .from('tracked_urls')
          .insert({
            user_id: user.id,
            url: normalizedUrl,
            domain: new URL(normalizedUrl).hostname
          })
        
        if (error) throw error
        
        await get().fetchTrackedUrls()
      } else {
        // Save locally
        const newUrls = [...trackedUrls, normalizedUrl]
        set({ trackedUrls: newUrls })
        await chrome.storage.local.set({ trackedUrls: newUrls })
      }
    } catch (error) {
      console.error('Add URL error:', error)
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
      // Load from local storage
      const result = await chrome.storage.local.get('trackedUrls')
      set({ trackedUrls: result.trackedUrls || [] })
    }
  },
  
  fetchBacklinks: async () => {
    const { user } = get()
    
    if (user) {
      const { data, error } = await supabase
        .from('backlinks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!error && data) {
        set({ backlinks: data })
      }
    } else {
      // Load from local storage
      const result = await chrome.storage.local.get('localBacklinks')
      set({ backlinks: result.localBacklinks || [] })
    }
  },
  
  fetchKeywords: async () => {
    const { user } = get()
    
    if (user) {
      const { data, error } = await supabase
        .from('keywords')
        .select('*')
        .eq('user_id', user.id)
        .order('frequency', { ascending: false })
        .limit(50)
      
      if (!error && data) {
        set({ keywords: data })
      }
    }
  },
  
  syncPendingBacklinks: async () => {
    const { user } = get()
    
    if (!user) return
    
    const result = await chrome.storage.local.get('pendingBacklinks')
    const pending = result.pendingBacklinks || []
    
    if (pending.length === 0) return
    
    // Get tracked URLs for this user
    const { data: trackedUrls } = await supabase
      .from('tracked_urls')
      .select('id, url')
      .eq('user_id', user.id)
    
    if (!trackedUrls) return
    
    // Process pending backlinks
    for (const backlink of pending) {
      const trackedUrl = trackedUrls.find(tu => 
        backlink.href === tu.url || 
        backlink.href.startsWith(tu.url) ||
        new URL(backlink.href).hostname === new URL(tu.url).hostname
      )
      
      if (trackedUrl) {
        await supabase
          .from('backlinks')
          .insert({
            user_id: user.id,
            tracked_url_id: trackedUrl.id,
            source_url: backlink.sourceUrl,
            source_domain: new URL(backlink.sourceUrl).hostname,
            target_url: backlink.href,
            anchor_text: backlink.anchorText,
            context_type: backlink.contextType
          })
      }
    }
    
    // Clear pending
    await chrome.storage.local.remove('pendingBacklinks')
    
    // Refresh backlinks
    await get().fetchBacklinks()
  }
}))
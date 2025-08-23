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
        result = await supabase.auth.signInWithPassword({ email, password })
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
      
      if (provider === 'email' && result?.data && 'user' in result.data && result.data.user) {
        set({ user: result.data.user, isAuthenticated: true })
        get().loadUserData()
      }
      
      set({ isLoginModalOpen: false })
    } catch (error) {
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
        get().loadUserData()
      }
    } catch (error) {
      // Silent fail for auth check
    }
  },
  
  loadUserData: async () => {
    const { user } = get()
    if (!user) return
    
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        const isPro = profile.is_pro || 
          (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date())
        
        set({ isPro })
        chrome.storage.local.set({ isPro })
      }
      
      await Promise.all([
        get().fetchTrackedUrls(),
        get().fetchBacklinks(),
        get().fetchKeywords()
      ])
      
      get().syncBacklinksToSupabase()
      
    } catch (error) {
      // Silent fail for user data loading
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
      
      // Set local backlinks immediately
      set({ backlinks: normalizedBacklinks })
      
      // If Pro user, merge with Supabase data
      if (user && isPro) {
        const { data } = await supabase
          .from('backlinks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (data) {
          const merged = [...data, ...normalizedBacklinks]
            .slice(0, 100)
          set({ backlinks: merged })
        }
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
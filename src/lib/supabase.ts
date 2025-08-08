import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Dual storage adapter for better session persistence
const dualStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Try localStorage first (faster, synchronous-like)
      if (typeof window !== 'undefined' && window.localStorage) {
        const localItem = window.localStorage.getItem(key)
        if (localItem) return localItem
      }
      
      // Fallback to chrome.storage if available
      if (chrome?.storage?.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null)
          })
        })
      }
      
      return null
    } catch (error) {
      return null
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Store in localStorage for fast access
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
      
      // Also store in chrome.storage for persistence
      if (chrome?.storage?.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve()
          })
        })
      }
    } catch (error) {
      // Silent fail - storage might be full or unavailable
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      // Remove from localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
      
      // Remove from chrome.storage
      if (chrome?.storage?.local) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.remove([key], () => {
            resolve()
          })
        })
      }
    } catch (error) {
      // Silent fail
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: dualStorage,
    storageKey: 'forgerank-auth',
    flowType: 'pkce'
  }
})
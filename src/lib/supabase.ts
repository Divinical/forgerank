import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      getItem: async (key) => {
        try {
          if (!chrome || !chrome.storage || !chrome.storage.local) {
            return null
          }
          const result = await chrome.storage.local.get([key])
          return result[key] || null
        } catch (error) {
          return null
        }
      },
      setItem: async (key, value) => {
        try {
          if (!chrome || !chrome.storage || !chrome.storage.local) {
            return
          }
          await chrome.storage.local.set({ [key]: value })
        } catch (error) {
          // Silently fail
        }
      },
      removeItem: async (key) => {
        try {
          if (!chrome || !chrome.storage || !chrome.storage.local) {
            return
          }
          await chrome.storage.local.remove([key])
        } catch (error) {
          // Silently fail
        }
      }
    }
  }
})
export interface Database {
  forgerank: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          is_pro: boolean
          trial_ends_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          is_pro?: boolean
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          is_pro?: boolean
          trial_ends_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      tracked_urls: {
        Row: {
          id: string
          user_id: string
          url: string
          domain: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          domain: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          domain?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      backlinks: {
        Row: {
          id: string
          user_id: string
          tracked_url_id: string
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
        Insert: {
          id?: string
          user_id: string
          tracked_url_id: string
          source_url: string
          source_domain: string
          target_url: string
          anchor_text?: string | null
          context_type?: string
          is_broken?: boolean
          http_status?: number | null
          first_seen_at?: string
          last_checked_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tracked_url_id?: string
          source_url?: string
          source_domain?: string
          target_url?: string
          anchor_text?: string | null
          context_type?: string
          is_broken?: boolean
          http_status?: number | null
          first_seen_at?: string
          last_checked_at?: string
          created_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          user_id: string
          backlink_id: string
          keyword: string
          frequency: number
          relevance: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          backlink_id: string
          keyword: string
          frequency?: number
          relevance?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          backlink_id?: string
          keyword?: string
          frequency?: number
          relevance?: string
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          dark_mode: boolean
          notifications_enabled: boolean
          notify_new_backlinks: boolean
          keyword_filters: any
          stopwords: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dark_mode?: boolean
          notifications_enabled?: boolean
          notify_new_backlinks?: boolean
          keyword_filters?: any
          stopwords?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dark_mode?: boolean
          notifications_enabled?: boolean
          notify_new_backlinks?: boolean
          keyword_filters?: any
          stopwords?: any
          created_at?: string
          updated_at?: string
        }
      }
      scan_history: {
        Row: {
          id: string
          user_id: string
          page_url: string
          page_title: string | null
          scan_type: string
          links_found: number
          keywords_extracted: number
          duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          page_url: string
          page_title?: string | null
          scan_type?: string
          links_found?: number
          keywords_extracted?: number
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          page_url?: string
          page_title?: string | null
          scan_type?: string
          links_found?: number
          keywords_extracted?: number
          duration_ms?: number | null
          created_at?: string
        }
      }
    }
  }
}
export interface Keyword {
  id: string
  keyword: string
  frequency: number
  relevance: 'high' | 'medium' | 'low'
  source_url?: string
  created_at: string
}

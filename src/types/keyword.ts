export interface Keyword {
  id: string
  keyword: string
  frequency: number
  relevance: 'high' | 'medium' | 'low'
  source_url?: string
  created_at: string
  // Niche-aware enhancements
  niche?: string
  semantic_cluster?: string
  llm_relevance_score?: number
  keyword_type?: 'single-word' | 'phrase' | 'entity' | 'technical-term'
  context_score?: number
  co_occurrence_boost?: number
}

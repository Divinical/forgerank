// Semantic clustering for keyword relationships and LLM-aware grouping
import type { Keyword } from '../types/keyword'

interface SemanticCluster {
  id: string
  name: string
  keywords: string[]
  centerKeyword: string
  coherenceScore: number
  llmRelevance: number
}

// Common semantic relationships for clustering
const SEMANTIC_RELATIONSHIPS = {
  // Technology clusters
  'ai-ml': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural network', 'algorithm', 'data science', 'predictive analytics', 'automation'],
  'web-dev': ['web development', 'frontend', 'backend', 'javascript', 'react', 'vue', 'angular', 'nodejs', 'html', 'css', 'responsive design'],
  'cloud-saas': ['cloud', 'saas', 'paas', 'iaas', 'aws', 'azure', 'google cloud', 'serverless', 'microservices', 'api', 'integration'],
  'cybersecurity': ['security', 'cybersecurity', 'encryption', 'firewall', 'authentication', 'authorization', 'vulnerability', 'penetration testing', 'compliance'],
  
  // Business clusters
  'digital-marketing': ['marketing', 'digital marketing', 'seo', 'sem', 'social media', 'content marketing', 'email marketing', 'ppc', 'conversion', 'analytics'],
  'ecommerce': ['ecommerce', 'online store', 'shopping cart', 'payment gateway', 'product catalog', 'inventory management', 'order fulfillment', 'customer service'],
  'finance-fintech': ['finance', 'fintech', 'banking', 'investment', 'blockchain', 'cryptocurrency', 'payment processing', 'financial planning', 'trading'],
  'healthcare-med': ['healthcare', 'medical', 'telemedicine', 'patient care', 'diagnosis', 'treatment', 'pharmaceutical', 'clinical', 'wellness', 'therapy'],
  
  // Content clusters
  'content-creation': ['content', 'blog', 'article', 'copywriting', 'storytelling', 'video', 'podcast', 'infographic', 'social media content'],
  'design-ux': ['design', 'ui', 'ux', 'user experience', 'user interface', 'graphic design', 'web design', 'branding', 'visual identity'],
  'data-analytics': ['data', 'analytics', 'business intelligence', 'reporting', 'dashboard', 'kpi', 'metrics', 'visualization', 'insights'],
  
  // Industry clusters
  'real-estate': ['real estate', 'property', 'mortgage', 'investment property', 'commercial real estate', 'residential', 'mls', 'realtor', 'home buying'],
  'education-learning': ['education', 'learning', 'training', 'course', 'curriculum', 'elearning', 'certification', 'skill development', 'knowledge'],
  'travel-hospitality': ['travel', 'tourism', 'hotel', 'booking', 'vacation', 'destination', 'hospitality', 'adventure', 'experience']
}

// Calculate semantic similarity between two keywords
function calculateSemanticSimilarity(keyword1: string, keyword2: string): number {
  // Simple similarity based on common words and character similarity
  const words1 = keyword1.toLowerCase().split(/\s+|-|_/)
  const words2 = keyword2.toLowerCase().split(/\s+|-|_/)
  
  // Exact match
  if (keyword1.toLowerCase() === keyword2.toLowerCase()) {
    return 1.0
  }
  
  // Contains relationship
  if (keyword1.toLowerCase().includes(keyword2.toLowerCase()) || 
      keyword2.toLowerCase().includes(keyword1.toLowerCase())) {
    return 0.8
  }
  
  // Common words
  const commonWords = words1.filter(w => words2.includes(w)).length
  const totalWords = new Set([...words1, ...words2]).size
  const wordSimilarity = commonWords / totalWords
  
  // Character similarity (Jaccard coefficient for trigrams)
  const trigrams1 = getTrigrams(keyword1.toLowerCase())
  const trigrams2 = getTrigrams(keyword2.toLowerCase())
  const intersection = trigrams1.filter(t => trigrams2.includes(t)).length
  const union = new Set([...trigrams1, ...trigrams2]).size
  const charSimilarity = union > 0 ? intersection / union : 0
  
  // Combined similarity
  return Math.max(wordSimilarity * 0.7 + charSimilarity * 0.3, 0)
}

function getTrigrams(text: string): string[] {
  const trigrams: string[] = []
  for (let i = 0; i <= text.length - 3; i++) {
    trigrams.push(text.substring(i, i + 3))
  }
  return trigrams
}

// Check if keywords belong to a known semantic cluster
function findSemanticCluster(keyword: string): string | null {
  const keywordLower = keyword.toLowerCase()
  
  for (const [clusterId, clusterKeywords] of Object.entries(SEMANTIC_RELATIONSHIPS)) {
    for (const clusterKeyword of clusterKeywords) {
      if (keywordLower.includes(clusterKeyword) || 
          clusterKeyword.includes(keywordLower) ||
          calculateSemanticSimilarity(keyword, clusterKeyword) > 0.6) {
        return clusterId
      }
    }
  }
  
  return null
}

// Cluster keywords based on semantic relationships
export function clusterKeywords(keywords: Keyword[]): SemanticCluster[] {
  const clusters = new Map<string, SemanticCluster>()
  const unclustered: Keyword[] = []
  
  // First pass: assign to known semantic clusters
  keywords.forEach(keyword => {
    const clusterName = findSemanticCluster(keyword.keyword)
    
    if (clusterName) {
      if (!clusters.has(clusterName)) {
        clusters.set(clusterName, {
          id: clusterName,
          name: clusterName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          keywords: [],
          centerKeyword: keyword.keyword,
          coherenceScore: 0,
          llmRelevance: 0
        })
      }
      
      const cluster = clusters.get(clusterName)!
      cluster.keywords.push(keyword.keyword)
      
      // Update center keyword if this one has higher frequency
      const centerFrequency = keywords.find(k => k.keyword === cluster.centerKeyword)?.frequency || 0
      if (keyword.frequency > centerFrequency) {
        cluster.centerKeyword = keyword.keyword
      }
    } else {
      unclustered.push(keyword)
    }
  })
  
  // Second pass: create similarity-based clusters for unclustered keywords
  const similarityThreshold = 0.4
  
  unclustered.forEach(keyword => {
    let bestCluster: SemanticCluster | null = null
    let bestSimilarity = 0
    
    // Check similarity with existing clusters
    for (const cluster of clusters.values()) {
      const avgSimilarity = cluster.keywords.reduce((sum, clusterKeyword) => {
        return sum + calculateSemanticSimilarity(keyword.keyword, clusterKeyword)
      }, 0) / cluster.keywords.length
      
      if (avgSimilarity > bestSimilarity && avgSimilarity > similarityThreshold) {
        bestSimilarity = avgSimilarity
        bestCluster = cluster
      }
    }
    
    if (bestCluster) {
      bestCluster.keywords.push(keyword.keyword)
    } else {
      // Create new cluster for this keyword
      const newClusterId = `custom-${keyword.keyword.replace(/\s+/g, '-')}`
      clusters.set(newClusterId, {
        id: newClusterId,
        name: keyword.keyword.replace(/\b\w/g, l => l.toUpperCase()),
        keywords: [keyword.keyword],
        centerKeyword: keyword.keyword,
        coherenceScore: 1.0,
        llmRelevance: keyword.llm_relevance_score || 0.5
      })
    }
  })
  
  // Calculate coherence scores and LLM relevance for clusters
  clusters.forEach(cluster => {
    if (cluster.keywords.length > 1) {
      // Calculate average pairwise similarity as coherence score
      let totalSimilarity = 0
      let pairs = 0
      
      for (let i = 0; i < cluster.keywords.length - 1; i++) {
        for (let j = i + 1; j < cluster.keywords.length; j++) {
          totalSimilarity += calculateSemanticSimilarity(cluster.keywords[i], cluster.keywords[j])
          pairs++
        }
      }
      
      cluster.coherenceScore = pairs > 0 ? totalSimilarity / pairs : 1.0
    }
    
    // Calculate LLM relevance based on keyword characteristics
    cluster.llmRelevance = calculateClusterLLMRelevance(cluster, keywords)
  })
  
  return Array.from(clusters.values())
    .filter(cluster => cluster.keywords.length > 0)
    .sort((a, b) => b.llmRelevance - a.llmRelevance)
}

function calculateClusterLLMRelevance(cluster: SemanticCluster, allKeywords: Keyword[]): number {
  let relevanceScore = 0
  
  cluster.keywords.forEach(keywordStr => {
    const keyword = allKeywords.find(k => k.keyword === keywordStr)
    if (!keyword) return
    
    // Base LLM relevance factors
    let keywordLLMScore = 0
    
    // Multi-word phrases are more valuable for LLMs
    if (keywordStr.includes(' ')) {
      keywordLLMScore += 0.3
    }
    
    // Longer keywords tend to be more specific and valuable
    if (keywordStr.length > 10) {
      keywordLLMScore += 0.2
    }
    
    // Technical terms and proper nouns are valuable
    if (/^[A-Z]/.test(keywordStr) || keywordStr.includes('-') || keywordStr.includes('_')) {
      keywordLLMScore += 0.2
    }
    
    // Domain-specific terms (not generic)
    const genericTerms = ['data', 'information', 'service', 'company', 'business', 'website', 'online']
    if (!genericTerms.some(term => keywordStr.toLowerCase().includes(term))) {
      keywordLLMScore += 0.2
    }
    
    // Frequency-based relevance (but capped to avoid over-weighting common terms)
    const frequencyScore = Math.min(keyword.frequency / 10, 0.3)
    keywordLLMScore += frequencyScore
    
    relevanceScore += keywordLLMScore
  })
  
  // Average relevance across cluster keywords
  const avgRelevance = cluster.keywords.length > 0 ? relevanceScore / cluster.keywords.length : 0
  
  // Boost for cluster coherence (well-related keywords are more valuable)
  const coherenceBoost = cluster.coherenceScore * 0.2
  
  return Math.min(avgRelevance + coherenceBoost, 1.0)
}

// Get related keywords for a given keyword
export function getRelatedKeywords(targetKeyword: string, allKeywords: Keyword[], maxResults = 10): Keyword[] {
  const similarities = allKeywords
    .filter(kw => kw.keyword !== targetKeyword)
    .map(kw => ({
      keyword: kw,
      similarity: calculateSemanticSimilarity(targetKeyword, kw.keyword)
    }))
    .filter(item => item.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
  
  return similarities.map(item => item.keyword)
}

// Assign semantic clusters to keywords
export function assignSemanticClusters(keywords: Keyword[]): Keyword[] {
  const clusters = clusterKeywords(keywords)
  
  return keywords.map(keyword => {
    const cluster = clusters.find(c => c.keywords.includes(keyword.keyword))
    
    return {
      ...keyword,
      semantic_cluster: cluster?.id,
      llm_relevance_score: cluster ? 
        calculateClusterLLMRelevance(cluster, keywords) : 
        calculateLLMRelevanceScore(keyword)
    }
  })
}

function calculateLLMRelevanceScore(keyword: Keyword): number {
  let score = 0.5 // base score
  
  // Multi-word phrases
  if (keyword.keyword.includes(' ')) score += 0.2
  
  // Length specificity
  if (keyword.keyword.length > 8) score += 0.1
  
  // Avoid generic terms
  const genericTerms = ['data', 'information', 'service', 'company', 'website']
  if (!genericTerms.some(term => keyword.keyword.includes(term))) score += 0.2
  
  return Math.min(score, 1.0)
}
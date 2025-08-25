import type { Keyword } from '../types/keyword'
import { detectNiche, getNicheRelevanceTerms, getNicheStopWords, getNicheContextWeights } from './nicheDetector'
import { assignSemanticClusters } from './semanticClustering'
// Advanced keyword extraction with niche detection, semantic clustering, and LLM optimization

// Comprehensive English stopwords to filter out
const STOPWORDS = new Set([
  // Articles, pronouns, prepositions
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had', 
  'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all', 'would',
  'there', 'their', 'said', 'each', 'she', 'do', 'his', 'her', 'if',
  'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so',
  'some', 'make', 'like', 'him', 'into', 'time', 'look', 'two', 'more',
  'go', 'see', 'no', 'way', 'could', 'my', 'than', 'first', 'been',
  'call', 'find', 'may', 'part', 'over', 'know', 'water', 'oil', 'now',
  'did', 'get', 'come', 'made', 'after', 'back', 'little', 'only',
  'round', 'man', 'year', 'came', 'show', 'every', 'good', 'me', 'give',
  'our', 'under', 'name', 'very', 'through', 'just', 'form', 'i', 'we',
  'you', 'can', 'am', 'or', 'nor', 'not', 'too', 'also', 'those',
  
  // Common generic terms that appeared in your data
  'data', 'your', 'one', 'thing', 'start', 'please', 'hit', 'fairly',
  'love', 'total', 'run', 'use', 'using', 'used', 'new', 'old', 'big',
  'small', 'long', 'short', 'high', 'low', 'here', 'there', 'now', 'then',
  'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday', 'sunday', 'yes', 'no', 'ok', 'okay',
  
  // Contractions and variations
  "don't", "didn't", "won't", "wouldn't", "can't", "couldn't", "shouldn't",
  "hasn't", "haven't", "isn't", "aren't", "wasn't", "weren't", "i'm", "you're",
  "he's", "she's", "it's", "we're", "they're", "i'll", "you'll", "he'll",
  "she'll", "it'll", "we'll", "they'll", "i'd", "you'd", "he'd", "she'd",
  "it'd", "we'd", "they'd", "i've", "you've", "we've", "they've"
])

// Web UI and technical stopwords that pollute results
const WEB_UI_STOPWORDS = new Set([
  // UI elements
  'click', 'button', 'link', 'page', 'site', 'website', 'web', 'app',
  'email', 'submit', 'form', 'field', 'input', 'search', 'login', 'logout',
  'signup', 'register', 'password', 'username', 'account', 'profile',
  'dashboard', 'settings', 'preferences', 'options', 'menu', 'nav',
  'navigation', 'footer', 'header', 'sidebar', 'content', 'main',
  
  // Legal/privacy terms
  'privacy', 'policy', 'terms', 'conditions', 'copyright', 'reserved',
  'rights', 'legal', 'disclaimer', 'notice', 'consent', 'cookies',
  'gdpr', 'ccpa', 'agreement', 'license',
  
  // Technical/system terms
  'loading', 'error', 'success', 'warning', 'info', 'debug', 'log',
  'cache', 'storage', 'session', 'cookie', 'token', 'api', 'url',
  'http', 'https', 'www', 'html', 'css', 'js', 'javascript', 'json',
  'xml', 'sql', 'database', 'server', 'client', 'browser', 'chrome',
  'firefox', 'safari', 'edge', 'mobile', 'desktop', 'tablet',
  
  // Generic actions
  'save', 'cancel', 'delete', 'edit', 'update', 'create', 'add', 'remove',
  'copy', 'paste', 'cut', 'undo', 'redo', 'refresh', 'reload', 'download',
  'upload', 'import', 'export', 'share', 'print', 'help', 'support',
  
  // Status/state terms
  'active', 'inactive', 'enabled', 'disabled', 'online', 'offline',
  'connected', 'disconnected', 'available', 'unavailable', 'busy',
  'idle', 'pending', 'complete', 'failed', 'canceled', 'expired',
  
  // Generic web content
  'home', 'about', 'contact', 'blog', 'news', 'events', 'gallery',
  'portfolio', 'services', 'products', 'pricing', 'faq', 'testimonials',
  'team', 'careers', 'jobs', 'press', 'media', 'resources', 'documentation',
  'docs', 'guide', 'tutorial', 'example', 'demo', 'test', 'sample'
])

// Named Entity Recognition patterns
const ENTITY_PATTERNS = {
  // Brand/Company names (capitalized words)
  brands: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
  // Technical terms with special chars
  technical: /\b\w+[-_]\w+\b/g,
  // Acronyms
  acronyms: /\b[A-Z]{2,}\b/g,
  // Version numbers or model numbers
  versions: /\b\w+\s*\d+(?:\.\d+)*\b/g
}

// LLM-preferred keyword types
const LLM_KEYWORD_INDICATORS = {
  // Multi-word phrases are more semantically rich
  multiWord: (text: string) => text.includes(' '),
  // Compound terms with hyphens/underscores
  compound: (text: string) => text.includes('-') || text.includes('_'),
  // Technical specificity indicators
  technical: (text: string) => /\b(?:api|sdk|cli|framework|platform|solution|system|service|tool|software|application|technology|method|process|strategy|approach)\b/i.test(text),
  // Domain-specific terminology (not generic web terms)
  domainSpecific: (text: string) => !/(website|online|internet|digital|web|page|site|click|button|link)\b/i.test(text)
}

// Enhanced keyword validation for better internationalization
function isValidKeyword(word: string): boolean {
  // Allow words with letters, numbers, hyphens, underscores, and basic international characters
  if (!/^[\w\-'àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšž]+$/i.test(word)) {
    return false
  }
  
  // Reject if it's mostly numbers
  if (/^\d+[\w]*$/.test(word) && word.replace(/\d/g, '').length < 2) {
    return false
  }
  
  // Reject common file extensions and technical noise
  if (/\.(jpg|jpeg|png|gif|pdf|doc|docx|xlsx|mp4|avi|mp3|wav|zip|tar|gz)$/i.test(word)) {
    return false
  }
  
  // Reject CSS classes and JavaScript-like patterns
  if (/^[a-z]+[A-Z]/.test(word) && word.length > 8) { // camelCase
    return false
  }
  
  return true
}

// Improved phrase quality scoring
function getPhraseQualityScore(phrase: string, words: string[]): number {
  let score = 0
  
  // Bonus for meaningful length
  if (phrase.length >= 8 && phrase.length <= 40) {
    score += 0.3
  }
  
  // Penalty for phrases with repeated words
  const uniqueWords = new Set(words)
  if (uniqueWords.size < words.length) {
    score -= 0.2
  }
  
  // Bonus for phrases with mix of common and uncommon words
  const commonWordCount = words.filter(w => STOPWORDS.has(w)).length
  if (commonWordCount === 0 && words.length > 1) {
    score += 0.4 // All meaningful words
  } else if (commonWordCount === 1 && words.length > 2) {
    score += 0.2 // One connector word
  }
  
  // Bonus for technical or domain-specific phrases
  if (/\b(?:api|sdk|framework|platform|solution|strategy|methodology|implementation|optimization|analytics|automation)\b/i.test(phrase)) {
    score += 0.3
  }
  
  return Math.max(0, Math.min(1, score))
}

// Enhanced position-based scoring
function calculatePositionScore(positions: number[], totalSentences: number): number {
  if (positions.length === 0) return 0
  
  let score = 0
  
  // Bonus for appearing early in text (likely important concepts)
  const earlyAppearances = positions.filter(p => p < totalSentences * 0.2).length
  score += (earlyAppearances / positions.length) * 0.3
  
  // Bonus for consistent distribution (not just clustered)
  if (positions.length > 1) {
    const spread = Math.max(...positions) - Math.min(...positions)
    const maxSpread = totalSentences - 1
    if (maxSpread > 0) {
      score += (spread / maxSpread) * 0.2
    }
  }
  
  return score
}

export function extractKeywords(
  text: string, 
  sourceUrl?: string,
  maxKeywords: number = 30,
  htmlContext?: Record<string, string>, // For position-based scoring
  metaTags?: Record<string, string>
): Keyword[] {
  // Detect niche for context-aware scoring
  const detectedNiche = detectNiche(sourceUrl || '', text, metaTags)
  const nicheRelevanceTerms = new Set(getNicheRelevanceTerms(detectedNiche))
  const nicheStopWords = getNicheStopWords(detectedNiche)
  const contextWeights = getNicheContextWeights(detectedNiche)
  
  // Extract different types of keywords
  const keywordCandidates = new Map<string, {
    frequency: number
    contexts: string[]
    positions: number[]
    isEntity: boolean
    entityType?: string
    originalCase: string
  }>()
  
  // Process text preserving original casing for entity detection
  const sentences = text.split(/[.!?]+/)
  
  sentences.forEach((sentence, sentenceIndex) => {
    const cleanSentence = sentence
      .replace(/[^a-zA-Z0-9\s-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (!cleanSentence) return
    
    // Extract entities first (before lowercasing)
    const entities = extractEntities(sentence)
    entities.forEach(entity => {
      const key = entity.text.toLowerCase()
      if (key.length < 2) return
      
      if (!keywordCandidates.has(key)) {
        keywordCandidates.set(key, {
          frequency: 0,
          contexts: [],
          positions: [],
          isEntity: true,
          entityType: entity.type,
          originalCase: entity.text
        })
      }
      
      const candidate = keywordCandidates.get(key)!
      candidate.frequency++
      candidate.positions.push(sentenceIndex)
      candidate.contexts.push('entity')
    })
    
    // Extract regular words and phrases
    const words = cleanSentence.toLowerCase().split(/\s+/)
    
    // Single words
    words.forEach((word, _wordIndex) => {
      if (word.length < 3) return
      if (STOPWORDS.has(word) || WEB_UI_STOPWORDS.has(word) || nicheStopWords.has(word)) return
      if (/^\d+$/.test(word)) return
      
      // Improved non-English character handling
      if (!isValidKeyword(word)) return
      
      if (!keywordCandidates.has(word)) {
        keywordCandidates.set(word, {
          frequency: 0,
          contexts: [],
          positions: [],
          isEntity: false,
          originalCase: word
        })
      }
      
      const candidate = keywordCandidates.get(word)!
      candidate.frequency++
      candidate.positions.push(sentenceIndex)
      candidate.contexts.push('word')
    })
    
    // Extract meaningful phrases (2-4 words)
    for (let phraseLength = 2; phraseLength <= 4; phraseLength++) {
      for (let i = 0; i <= words.length - phraseLength; i++) {
        const phrase = words.slice(i, i + phraseLength).join(' ')
        
        const phraseWords = words.slice(i, i + phraseLength)
        
        // Skip phrases with stop words (but allow one stop word as connector)
        const stopWordCount = phraseWords.filter(w => 
          STOPWORDS.has(w) || WEB_UI_STOPWORDS.has(w) || nicheStopWords.has(w)
        ).length
        
        if (stopWordCount > 1 || (stopWordCount > 0 && phraseLength === 2)) continue
        
        // Skip if too short or contains numbers only
        if (phrase.length < 6 || /^\d+\s\d+/.test(phrase)) continue
        
        // Enhanced phrase validation
        if (!phraseWords.every(w => isValidKeyword(w) || STOPWORDS.has(w))) continue
        
        // Get quality score for this phrase
        const qualityScore = getPhraseQualityScore(phrase, phraseWords)
        if (qualityScore < 0.1) continue // Skip very low quality phrases
        
        if (!keywordCandidates.has(phrase)) {
          keywordCandidates.set(phrase, {
            frequency: 0,
            contexts: [],
            positions: [],
            isEntity: false,
            originalCase: phrase
          })
        }
        
        const candidate = keywordCandidates.get(phrase)!
        candidate.frequency++
        candidate.positions.push(sentenceIndex)
        candidate.contexts.push('phrase')
      }
    }
  })
  
  // Calculate advanced TF-IDF and LLM-aware scores
  const totalSentences = sentences.length
  const keywords: Keyword[] = []
  
  Array.from(keywordCandidates.entries()).forEach(([keywordText, candidate]) => {
    // Calculate TF-IDF score
    const tf = candidate.frequency / totalSentences
    const idf = Math.log(totalSentences / (candidate.positions.length || 1))
    const tfidf = tf * idf
    
    // Calculate context score based on position and HTML context
    let contextScore = 1.0
    if (htmlContext) {
      candidate.contexts.forEach(context => {
        contextScore += (contextWeights[context] || 1.0) - 1.0
      })
    }
    
    // Add position-based scoring
    const positionScore = calculatePositionScore(candidate.positions, totalSentences)
    contextScore += positionScore
    
    // Calculate LLM relevance score
    let llmScore = 0.5 // base score
    
    // Entity boost
    if (candidate.isEntity) {
      llmScore += 0.3
    }
    
    // Multi-word phrases are more semantically rich
    if (LLM_KEYWORD_INDICATORS.multiWord(keywordText)) {
      llmScore += 0.2
    }
    
    // Compound terms
    if (LLM_KEYWORD_INDICATORS.compound(keywordText)) {
      llmScore += 0.15
    }
    
    // Technical specificity
    if (LLM_KEYWORD_INDICATORS.technical(keywordText)) {
      llmScore += 0.2
    }
    
    // Domain specificity (avoid generic web terms)
    if (LLM_KEYWORD_INDICATORS.domainSpecific(keywordText)) {
      llmScore += 0.15
    }
    
    // Niche relevance boost
    if (nicheRelevanceTerms.has(keywordText) || 
        Array.from(nicheRelevanceTerms).some(term => 
          keywordText.includes(term) || term.includes(keywordText)
        )) {
      llmScore += 0.25
    }
    
    // Length-based specificity
    if (keywordText.length > 12) {
      llmScore += 0.1
    }
    
    // Penalize overly frequent terms
    if (candidate.frequency > totalSentences * 0.1) {
      llmScore *= 0.8
    }
    
    llmScore = Math.min(llmScore, 1.0)
    
    // Combined score
    const combinedScore = (tfidf * 0.4) + (contextScore * 0.3) + (llmScore * 0.3)
    
    // Determine keyword type
    let keywordType: 'single-word' | 'phrase' | 'entity' | 'technical-term'
    if (candidate.isEntity) {
      keywordType = 'entity'
    } else if (keywordText.includes(' ')) {
      keywordType = 'phrase'
    } else if (keywordText.includes('-') || keywordText.includes('_') || 
               LLM_KEYWORD_INDICATORS.technical(keywordText)) {
      keywordType = 'technical-term'
    } else {
      keywordType = 'single-word'
    }
    
    // Determine relevance
    let relevance: 'high' | 'medium' | 'low'
    if (combinedScore >= 1.5) {
      relevance = 'high'
    } else if (combinedScore >= 0.8) {
      relevance = 'medium'
    } else {
      relevance = 'low'
    }
    
    // Special handling for SEO-related keywords
    const seoKeywords = ['backlink', 'seo', 'link building', 'anchor text', 'domain authority', 'page rank']
    if (seoKeywords.some(seoWord => keywordText.includes(seoWord))) {
      relevance = 'high'
    }
    
    keywords.push({
      id: `${keywordText.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      keyword: keywordText,
      frequency: candidate.frequency,
      relevance,
      source_url: sourceUrl,
      created_at: new Date().toISOString(),
      niche: detectedNiche,
      llm_relevance_score: llmScore,
      keyword_type: keywordType,
      context_score: contextScore,
      co_occurrence_boost: 0 // Will be calculated in post-processing
    })
  })
  
  // Sort by combined relevance and return top keywords
  const sortedKeywords = keywords
    .sort((a, b) => {
      const scoreA = (a.llm_relevance_score || 0) * (a.context_score || 1) * a.frequency
      const scoreB = (b.llm_relevance_score || 0) * (b.context_score || 1) * b.frequency
      return scoreB - scoreA
    })
    .slice(0, maxKeywords)
  
  // Apply semantic clustering
  return assignSemanticClusters(sortedKeywords)
}

// Process keywords using idle callbacks to avoid blocking UI
export function processKeywordsInIdle(
  sources: Array<{ url: string; content?: string }>,
  onComplete: (keywords: Keyword[]) => void
) {
  const allKeywords: Keyword[] = []
  let currentIndex = 0
  
  function processNext(deadline: IdleDeadline) {
    while (deadline.timeRemaining() > 0 && currentIndex < sources.length) {
      const source = sources[currentIndex]
      
      if (source.content) {
        const keywords = extractKeywords(source.content, source.url)
        allKeywords.push(...keywords)
      }
      
      currentIndex++
    }
    
    if (currentIndex < sources.length) {
      // More to process, request another idle callback
      requestIdleCallback(processNext)
    } else {
      // All done, deduplicate and return results
      const keywordMap = new Map<string, Keyword>()
      
      allKeywords.forEach(kw => {
        const key = `${kw.keyword}|${kw.source_url || ''}`
        const existing = keywordMap.get(key)
        
        if (!existing || kw.frequency > existing.frequency) {
          keywordMap.set(key, kw)
        }
      })
      
      // Sort by frequency and return top keywords
      const finalKeywords = Array.from(keywordMap.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 50)
      
      onComplete(finalKeywords)
    }
  }
  
  // Start processing
  if ('requestIdleCallback' in window) {
    requestIdleCallback(processNext)
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      sources.forEach(source => {
        if (source.content) {
          const keywords = extractKeywords(source.content, source.url)
          allKeywords.push(...keywords)
        }
      })
      
      const keywordMap = new Map<string, Keyword>()
      allKeywords.forEach(kw => {
        const key = `${kw.keyword}|${kw.source_url || ''}`
        const existing = keywordMap.get(key)
        if (!existing || kw.frequency > existing.frequency) {
          keywordMap.set(key, kw)
        }
      })
      
      const finalKeywords = Array.from(keywordMap.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 50)
      
      onComplete(finalKeywords)
    }, 100)
  }
}

// Extract keywords from page content when backlinks are found
export async function extractKeywordsFromBacklinks(
  backlinks: Array<{ source_url: string }>
): Promise<Keyword[]> {
  console.log(`🔍 Extracting keywords from ${backlinks.length} backlink sources...`)
  
  // Get stored keyword sources from background
  const { localKeywordSources = {} } = await chrome.storage.local.get('localKeywordSources')
  
  const availableUrls = Object.keys(localKeywordSources)
  console.log(`🔍 Available content sources: ${availableUrls.length}`)
  
  const sources = backlinks
    .map(bl => ({
      url: bl.source_url,
      content: localKeywordSources[bl.source_url]?.content
    }))
    .filter(s => s.content && s.content.length > 100) // Only process sources with substantial content
  
  console.log(`🔍 Processing ${sources.length} sources with content`)
  
  if (sources.length === 0) {
    console.log('🔍 No content sources available for keyword extraction')
    return []
  }
  
  return new Promise((resolve) => {
    processKeywordsInIdle(sources, (keywords) => {
      console.log(`🔍 Extracted ${keywords.length} unique keywords`)
      
      // Store keywords locally
      chrome.storage.local.set({ localKeywords: keywords })
      resolve(keywords)
    })
  })
}

// Extract named entities from text
function extractEntities(text: string): Array<{ text: string; type: string }> {
  const entities: Array<{ text: string; type: string }> = []
  
  // Extract brands/company names
  const brandMatches = text.match(ENTITY_PATTERNS.brands) || []
  brandMatches.forEach(match => {
    if (match.length > 2 && !STOPWORDS.has(match.toLowerCase())) {
      entities.push({ text: match, type: 'brand' })
    }
  })
  
  // Extract technical terms
  const techMatches = text.match(ENTITY_PATTERNS.technical) || []
  techMatches.forEach(match => {
    if (match.length > 3) {
      entities.push({ text: match, type: 'technical' })
    }
  })
  
  // Extract acronyms
  const acronymMatches = text.match(ENTITY_PATTERNS.acronyms) || []
  acronymMatches.forEach(match => {
    if (match.length >= 2 && match.length <= 8) {
      entities.push({ text: match, type: 'acronym' })
    }
  })
  
  // Extract version/model numbers
  const versionMatches = text.match(ENTITY_PATTERNS.versions) || []
  versionMatches.forEach(match => {
    entities.push({ text: match, type: 'version' })
  })
  
  return entities
}
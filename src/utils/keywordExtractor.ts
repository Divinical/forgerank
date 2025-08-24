import type { Keyword } from '../types/keyword'
// Keyword extraction utility - runs in UI thread with idle callbacks

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

// General business/tech terms that indicate relevance
const BUSINESS_TECH_TERMS = new Set([
  'development', 'developer', 'software', 'code', 'coding', 'programming',
  'tech', 'technology', 'startup', 'business', 'product', 'tool', 'tools',
  'platform', 'service', 'solution', 'framework', 'library', 'repository',
  'project', 'open', 'source', 'community', 'build', 'building', 'maker',
  'creator', 'founder', 'entrepreneur', 'innovation', 'digital', 'online',
  'api', 'sdk', 'cli', 'npm', 'package', 'module', 'component', 'feature'
])


export function extractKeywords(
  text: string, 
  sourceUrl?: string,
  maxKeywords: number = 30
): Keyword[] {
  // Clean and normalize text
  const cleanText = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Split into words
  const words = cleanText.split(' ')
  
  // Count word frequencies
  const wordCounts = new Map<string, number>()
  
  words.forEach(word => {
    // Skip short words (minimum 2 characters, but prefer 3+)
    if (word.length < 2) return
    
    // Skip all types of stopwords
    if (STOPWORDS.has(word)) return
    if (WEB_UI_STOPWORDS.has(word)) return
    
    // Skip pure numbers and common patterns
    if (/^\d+$/.test(word)) return
    if (/^[a-z]{1}$/.test(word)) return // Single letters
    
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })
  
  // Sort by frequency
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
  
  // Calculate smart relevance scoring
  const totalWords = words.length
  const maxFrequency = sortedWords[0]?.[1] || 1
  
  return sortedWords.map(([keyword, frequency]) => {
    // Base score from frequency
    let score = frequency / maxFrequency
    
    // Boost for business/tech relevance
    if (BUSINESS_TECH_TERMS.has(keyword)) {
      score *= 1.5
    }
    
    // Boost for longer, more specific terms
    if (keyword.length >= 6) {
      score *= 1.2
    }
    
    // Penalize very high frequency terms (likely generic)
    const documentFrequency = frequency / totalWords
    if (documentFrequency > 0.05) { // Appears in >5% of words
      score *= 0.7
    }
    
    // Boost for compound words or technical terms
    if (keyword.includes('-') || keyword.includes('_')) {
      score *= 1.3
    }
    
    // Boost for capitalized terms that might be proper nouns/brands
    const originalCase = text.match(new RegExp(`\\b${keyword}\\b`, 'i'))?.[0] || keyword
    if (originalCase[0] && originalCase[0] !== originalCase[0].toLowerCase()) {
      score *= 1.2
    }
    
    // Determine relevance category based on final score
    let relevance: 'high' | 'medium' | 'low'
    if (score >= 0.8) {
      relevance = 'high'
    } else if (score >= 0.4) {
      relevance = 'medium'
    } else {
      relevance = 'low'
    }
    
    // Boost relevance for SEO-related keywords
    const seoKeywords = ['backlink', 'seo', 'link', 'anchor', 'domain', 'url', 'rank', 'search', 'optimization']
    if (seoKeywords.some(seoWord => keyword.includes(seoWord))) {
      relevance = 'high'
    }
    
    return {
      id: `${keyword}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      keyword,
      frequency,
      relevance,
      source_url: sourceUrl,
      created_at: new Date().toISOString()
    }
  })
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
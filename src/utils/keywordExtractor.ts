// Keyword extraction utility - runs in UI thread with idle callbacks

// Common English stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
  'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how', 'all',
  'would', 'there', 'their', 'said', 'each', 'she', 'which', 'do',
  'his', 'her', 'if', 'will', 'up', 'other', 'about', 'out', 'many',
  'then', 'them', 'these', 'so', 'some', 'would', 'make', 'like',
  'him', 'into', 'time', 'has', 'look', 'two', 'more', 'go', 'see',
  'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call',
  'find', 'may', 'part', 'over', 'know', 'water', 'oil', 'now',
  'did', 'get', 'come', 'made', 'after', 'back', 'little', 'only',
  'round', 'man', 'year', 'came', 'show', 'every', 'good', 'me',
  'give', 'our', 'under', 'name', 'very', 'through', 'just', 'form',
  'i', 'we', 'you', 'can', "don't", "didn't", "won't", "wouldn't",
  'am', 'or', 'nor', 'not', 'too', 'also', 'than', 'those'
])

// Web-specific stopwords
const WEB_STOPWORDS = new Set([
  'click', 'button', 'link', 'page', 'site', 'website', 'web',
  'email', 'submit', 'form', 'field', 'privacy', 'policy', 'terms',
  'copyright', 'reserved', 'rights', 'contact', 'about', 'home',
  'nav', 'navigation', 'menu', 'footer', 'header', 'sidebar'
])

interface ExtractedKeyword {
  id?: string
  keyword: string
  frequency: number
  relevance: 'high' | 'medium' | 'low'
  source_url?: string
  created_at?: string
}

export function extractKeywords(
  text: string, 
  sourceUrl?: string,
  maxKeywords: number = 30
): ExtractedKeyword[] {
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
    // Skip short words and stopwords
    if (word.length < 3) return
    if (STOPWORDS.has(word)) return
    if (WEB_STOPWORDS.has(word)) return
    
    // Skip numbers
    if (/^\d+$/.test(word)) return
    
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  })
  
  // Sort by frequency
  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
  
  // Calculate relevance based on frequency
  const maxFrequency = sortedWords[0]?.[1] || 1
  
  return sortedWords.map(([keyword, frequency]) => {
    let relevance: 'high' | 'medium' | 'low'
    
    const relativeFrequency = frequency / maxFrequency
    
    if (relativeFrequency > 0.7) {
      relevance = 'high'
    } else if (relativeFrequency > 0.3) {
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
      id: sourceUrl ? `${sourceUrl}-${keyword}` : undefined,
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
  onComplete: (keywords: ExtractedKeyword[]) => void
) {
  const allKeywords: ExtractedKeyword[] = []
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
      const keywordMap = new Map<string, ExtractedKeyword>()
      
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
      
      const keywordMap = new Map<string, ExtractedKeyword>()
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
  backlinks: Array<{ source_url: string }>,
  onProgress?: (processed: number, total: number) => void
): Promise<ExtractedKeyword[]> {
  // Get stored keyword sources from background
  const { localKeywordSources = {} } = await chrome.storage.local.get('localKeywordSources')
  
  const sources = backlinks
    .map(bl => ({
      url: bl.source_url,
      content: localKeywordSources[bl.source_url]?.content
    }))
    .filter(s => s.content)
  
  return new Promise((resolve) => {
    processKeywordsInIdle(sources, (keywords) => {
      // Store keywords locally
      chrome.storage.local.set({ localKeywords: keywords })
      resolve(keywords)
    })
  })
}
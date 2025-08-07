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
  'sentence', 'great', 'think', 'say', 'help', 'low', 'line', 'differ',
  'turn', 'cause', 'much', 'mean', 'before', 'move', 'right', 'boy',
  'old', 'too', 'same', 'tell', 'does', 'set', 'three', 'want',
  'air', 'well', 'also', 'play', 'small', 'end', 'put', 'home',
  'read', 'hand', 'port', 'large', 'spell', 'add', 'even', 'land',
  'here', 'must', 'big', 'high', 'such', 'follow', 'act', 'why',
  'ask', 'men', 'change', 'went', 'light', 'kind', 'off', 'need',
  'house', 'picture', 'try', 'us', 'again', 'animal', 'point', 'mother',
  'world', 'near', 'build', 'self', 'earth', 'father', 'any', 'new',
  'work', 'place', 'live', 'back', 'take', 'only', 'little', 'help',
  'year', 'came', 'show', 'every', 'good', 'me', 'give', 'under',
  'went', 'himself', 'say', 'very', 'something', 'through', 'back',
  'before', 'now', 'only', 'look', 'people', 'could', 'over', 'know',
  'water', 'than', 'call', 'first', 'may', 'down', 'side', 'been',
  'now', 'find', 'any', 'new', 'part', 'take', 'get', 'place',
  'made', 'live', 'where', 'after', 'back', 'little', 'only', 'round',
  'man', 'year', 'came', 'show', 'every', 'good', 'me', 'give',
  'our', 'under', 'am', 'i', 'we', 'you', 'can', "don't", "didn't",
  "won't", "wouldn't", "couldn't", "shouldn't", "isn't", "aren't",
  "wasn't", "weren't", "hasn't", "haven't", "hadn't", "doesn't"
])

// Additional web-specific stopwords
const WEB_STOPWORDS = new Set([
  'click', 'button', 'link', 'page', 'site', 'website', 'web',
  'email', 'submit', 'form', 'field', 'privacy', 'policy', 'terms',
  'copyright', 'reserved', 'rights', 'contact', 'about', 'home',
  'nav', 'navigation', 'menu', 'footer', 'header', 'sidebar',
  'content', 'main', 'div', 'span', 'class', 'style', 'script',
  'undefined', 'null', 'true', 'false', 'function', 'var', 'const',
  'let', 'return', 'console', 'log', 'error', 'warning'
])

interface ExtractedKeyword {
  keyword: string
  frequency: number
  relevance: 'high' | 'medium' | 'low'
}

export function extractKeywords(text: string, maxKeywords: number = 50): ExtractedKeyword[] {
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
  
  // Calculate relevance based on frequency and position
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
      keyword,
      frequency,
      relevance
    }
  })
}

// Extract keywords specifically from around backlinks
export function extractKeywordsAroundBacklinks(
  pageText: string,
  backlinkPositions: { start: number; end: number }[]
): ExtractedKeyword[] {
  const contextWindow = 200 // Characters before and after backlink
  const contexts: string[] = []
  
  backlinkPositions.forEach(position => {
    const start = Math.max(0, position.start - contextWindow)
    const end = Math.min(pageText.length, position.end + contextWindow)
    contexts.push(pageText.substring(start, end))
  })
  
  const combinedContext = contexts.join(' ')
  return extractKeywords(combinedContext)
}
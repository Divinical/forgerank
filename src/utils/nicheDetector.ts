// Advanced niche detection for keyword relevance optimization
// Niche detection for keyword relevance optimization

export type Niche = 
  | 'ecommerce' 
  | 'saas' 
  | 'healthcare' 
  | 'finance' 
  | 'education' 
  | 'content-marketing'
  | 'technology'
  | 'real-estate'
  | 'legal'
  | 'food-restaurant'
  | 'fitness-health'
  | 'travel'
  | 'fashion'
  | 'automotive'
  | 'gaming'
  | 'b2b-services'
  | 'nonprofit'
  | 'government'
  | 'entertainment'
  | 'general'

interface NicheIndicators {
  keywords: string[]
  urlPatterns: RegExp[]
  metaIndicators: string[]
  weight: number
}

// Comprehensive niche detection patterns
const NICHE_PATTERNS: Record<Niche, NicheIndicators> = {
  'ecommerce': {
    keywords: ['product', 'shop', 'cart', 'buy', 'purchase', 'price', 'discount', 'sale', 'shipping', 'checkout', 'inventory', 'catalog', 'retail', 'store', 'marketplace', 'ecommerce', 'woocommerce', 'shopify', 'magento', 'payment', 'paypal', 'stripe'],
    urlPatterns: [/shop/, /store/, /buy/, /cart/, /product/, /catalog/, /marketplace/],
    metaIndicators: ['ecommerce', 'online store', 'shop', 'retail'],
    weight: 1.0
  },
  
  'saas': {
    keywords: ['software', 'platform', 'dashboard', 'api', 'integration', 'subscription', 'saas', 'cloud', 'service', 'analytics', 'automation', 'workflow', 'productivity', 'crm', 'erp', 'enterprise', 'solution', 'tool', 'application', 'digital transformation'],
    urlPatterns: [/app/, /platform/, /dashboard/, /api/, /saas/, /software/],
    metaIndicators: ['saas', 'software platform', 'business software', 'cloud solution'],
    weight: 1.0
  },
  
  'healthcare': {
    keywords: ['health', 'medical', 'patient', 'doctor', 'hospital', 'clinic', 'treatment', 'medicine', 'therapy', 'pharmaceutical', 'wellness', 'healthcare', 'diagnosis', 'symptom', 'disease', 'care', 'nursing', 'surgery', 'clinical', 'medical device'],
    urlPatterns: [/health/, /medical/, /clinic/, /hospital/, /doctor/, /patient/],
    metaIndicators: ['healthcare', 'medical', 'health services'],
    weight: 1.0
  },
  
  'finance': {
    keywords: ['finance', 'financial', 'bank', 'banking', 'investment', 'insurance', 'loan', 'credit', 'mortgage', 'trading', 'accounting', 'tax', 'wealth', 'portfolio', 'fintech', 'cryptocurrency', 'blockchain', 'payment', 'money', 'capital'],
    urlPatterns: [/bank/, /finance/, /loan/, /credit/, /investment/, /trading/, /fintech/],
    metaIndicators: ['financial services', 'banking', 'investment', 'fintech'],
    weight: 1.0
  },
  
  'education': {
    keywords: ['education', 'learning', 'course', 'student', 'teacher', 'school', 'university', 'training', 'tutorial', 'lesson', 'academic', 'curriculum', 'degree', 'certification', 'elearning', 'online course', 'study', 'research', 'knowledge', 'skill'],
    urlPatterns: [/edu/, /school/, /university/, /course/, /learning/, /training/],
    metaIndicators: ['education', 'learning platform', 'online courses', 'training'],
    weight: 1.0
  },
  
  'content-marketing': {
    keywords: ['blog', 'content', 'marketing', 'seo', 'social media', 'advertising', 'campaign', 'brand', 'engagement', 'audience', 'traffic', 'conversion', 'leads', 'copywriting', 'storytelling', 'influencer', 'viral', 'organic', 'paid media', 'content strategy'],
    urlPatterns: [/blog/, /news/, /article/, /content/, /marketing/, /media/],
    metaIndicators: ['content marketing', 'digital marketing', 'blog', 'media'],
    weight: 1.0
  },
  
  'technology': {
    keywords: ['technology', 'tech', 'software', 'hardware', 'development', 'programming', 'coding', 'ai', 'artificial intelligence', 'machine learning', 'data science', 'cybersecurity', 'blockchain', 'iot', 'robotics', 'quantum', 'innovation', 'digital', 'computing'],
    urlPatterns: [/tech/, /dev/, /code/, /software/, /ai/, /ml/, /data/],
    metaIndicators: ['technology', 'software development', 'tech innovation'],
    weight: 1.0
  },
  
  'real-estate': {
    keywords: ['real estate', 'property', 'home', 'house', 'apartment', 'rent', 'buy', 'sell', 'mortgage', 'realtor', 'agent', 'listing', 'market', 'investment property', 'commercial', 'residential', 'broker', 'mls', 'neighborhood', 'valuation'],
    urlPatterns: [/realty/, /property/, /homes/, /real-estate/, /realtor/],
    metaIndicators: ['real estate', 'property', 'homes for sale'],
    weight: 1.0
  },
  
  'legal': {
    keywords: ['law', 'legal', 'lawyer', 'attorney', 'court', 'case', 'litigation', 'contract', 'compliance', 'regulation', 'justice', 'firm', 'counsel', 'lawsuit', 'settlement', 'legal advice', 'paralegal', 'judge', 'trial', 'legal services'],
    urlPatterns: [/law/, /legal/, /attorney/, /lawyer/, /court/],
    metaIndicators: ['legal services', 'law firm', 'attorney'],
    weight: 1.0
  },
  
  'food-restaurant': {
    keywords: ['restaurant', 'food', 'menu', 'recipe', 'cooking', 'chef', 'cuisine', 'dining', 'meal', 'ingredient', 'nutrition', 'catering', 'delivery', 'takeout', 'bar', 'beverage', 'culinary', 'gourmet', 'organic', 'local food'],
    urlPatterns: [/restaurant/, /food/, /menu/, /recipe/, /dining/, /cafe/],
    metaIndicators: ['restaurant', 'food service', 'culinary'],
    weight: 1.0
  },
  
  'fitness-health': {
    keywords: ['fitness', 'workout', 'exercise', 'gym', 'training', 'nutrition', 'diet', 'weight loss', 'muscle', 'cardio', 'strength', 'yoga', 'pilates', 'wellness', 'healthy', 'supplement', 'protein', 'athletic', 'sports', 'personal trainer'],
    urlPatterns: [/fitness/, /gym/, /workout/, /health/, /nutrition/, /wellness/],
    metaIndicators: ['fitness', 'health and wellness', 'gym'],
    weight: 1.0
  },
  
  'travel': {
    keywords: ['travel', 'vacation', 'trip', 'hotel', 'flight', 'booking', 'destination', 'tourism', 'adventure', 'holiday', 'resort', 'cruise', 'backpacking', 'sightseeing', 'itinerary', 'guide', 'culture', 'experience', 'journey', 'explore'],
    urlPatterns: [/travel/, /vacation/, /hotel/, /booking/, /tourism/, /trip/],
    metaIndicators: ['travel', 'tourism', 'vacation'],
    weight: 1.0
  },
  
  'fashion': {
    keywords: ['fashion', 'style', 'clothing', 'apparel', 'designer', 'trend', 'outfit', 'accessories', 'jewelry', 'shoes', 'handbag', 'beauty', 'cosmetics', 'makeup', 'skincare', 'boutique', 'runway', 'model', 'brand', 'luxury'],
    urlPatterns: [/fashion/, /style/, /clothing/, /boutique/, /beauty/],
    metaIndicators: ['fashion', 'style', 'clothing'],
    weight: 1.0
  },
  
  'automotive': {
    keywords: ['car', 'auto', 'vehicle', 'automotive', 'truck', 'motorcycle', 'dealer', 'repair', 'maintenance', 'parts', 'service', 'insurance', 'financing', 'lease', 'used cars', 'new cars', 'dealership', 'garage', 'mechanic', 'driving'],
    urlPatterns: [/auto/, /car/, /vehicle/, /dealer/, /automotive/],
    metaIndicators: ['automotive', 'car dealer', 'auto service'],
    weight: 1.0
  },
  
  'gaming': {
    keywords: ['gaming', 'game', 'esports', 'video game', 'console', 'pc gaming', 'mobile game', 'multiplayer', 'strategy', 'rpg', 'fps', 'mmorpg', 'indie game', 'steam', 'twitch', 'streaming', 'tournament', 'player', 'level', 'achievement'],
    urlPatterns: [/game/, /gaming/, /esports/, /steam/, /twitch/],
    metaIndicators: ['gaming', 'video games', 'esports'],
    weight: 1.0
  },
  
  'b2b-services': {
    keywords: ['b2b', 'business services', 'consulting', 'enterprise', 'professional', 'corporate', 'solution', 'strategic', 'advisory', 'management', 'operations', 'efficiency', 'optimization', 'transformation', 'partnership', 'client', 'industry', 'expertise', 'implementation', 'scalable'],
    urlPatterns: [/consulting/, /services/, /solutions/, /enterprise/, /business/],
    metaIndicators: ['business services', 'consulting', 'b2b'],
    weight: 1.0
  },
  
  'nonprofit': {
    keywords: ['nonprofit', 'charity', 'donation', 'volunteer', 'foundation', 'cause', 'fundraising', 'social impact', 'community', 'mission', 'giving', 'humanitarian', 'advocacy', 'awareness', 'support', 'outreach', 'program', 'grant', 'sponsor', 'benefit'],
    urlPatterns: [/nonprofit/, /charity/, /foundation/, /donate/, /cause/],
    metaIndicators: ['nonprofit', 'charity', 'social impact'],
    weight: 1.0
  },
  
  'government': {
    keywords: ['government', 'public', 'municipal', 'federal', 'state', 'local', 'policy', 'regulation', 'citizen', 'service', 'department', 'agency', 'official', 'administration', 'legislation', 'public service', 'civic', 'community', 'taxes', 'permits'],
    urlPatterns: [/gov/, /municipal/, /city/, /county/, /state/, /federal/],
    metaIndicators: ['government', 'public service', 'municipal'],
    weight: 1.0
  },
  
  'entertainment': {
    keywords: ['entertainment', 'music', 'movie', 'film', 'concert', 'show', 'performer', 'artist', 'celebrity', 'event', 'venue', 'ticket', 'streaming', 'media', 'production', 'theater', 'comedy', 'drama', 'documentary', 'festival'],
    urlPatterns: [/entertainment/, /music/, /movie/, /show/, /concert/, /theater/],
    metaIndicators: ['entertainment', 'music', 'media'],
    weight: 1.0
  },
  
  'general': {
    keywords: [],
    urlPatterns: [],
    metaIndicators: [],
    weight: 0.1
  }
}

export function detectNiche(url: string, content: string, metaTags?: Record<string, string>): Niche {
  const scores: Record<Niche, number> = {} as Record<Niche, number>
  
  // Initialize scores
  Object.keys(NICHE_PATTERNS).forEach(niche => {
    scores[niche as Niche] = 0
  })
  
  const urlLower = url.toLowerCase()
  const contentLower = content.toLowerCase()
  const metaContent = metaTags ? Object.values(metaTags).join(' ').toLowerCase() : ''
  
  // Score each niche
  Object.entries(NICHE_PATTERNS).forEach(([niche, patterns]) => {
    const nicheKey = niche as Niche
    let score = 0
    
    // URL pattern matching
    patterns.urlPatterns.forEach(pattern => {
      if (pattern.test(urlLower)) {
        score += 2.0 * patterns.weight
      }
    })
    
    // Keyword frequency analysis
    patterns.keywords.forEach(keyword => {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = (contentLower.match(keywordRegex) || []).length
      
      if (matches > 0) {
        // Higher weight for multiple occurrences, but with diminishing returns
        score += Math.min(matches * 0.5, 3.0) * patterns.weight
      }
      
      // Boost for keywords in meta tags
      const metaMatches = (metaContent.match(keywordRegex) || []).length
      if (metaMatches > 0) {
        score += metaMatches * 1.5 * patterns.weight
      }
    })
    
    // Meta indicator matching
    patterns.metaIndicators.forEach(indicator => {
      if (metaContent.includes(indicator)) {
        score += 3.0 * patterns.weight
      }
    })
    
    scores[nicheKey] = score
  })
  
  // Find the highest scoring niche
  let maxScore = 0
  let detectedNiche: Niche = 'general'
  
  Object.entries(scores).forEach(([niche, score]) => {
    if (score > maxScore) {
      maxScore = score
      detectedNiche = niche as Niche
    }
  })
  
  // If no clear niche detected with sufficient confidence, return general
  if (maxScore < 2.0) {
    return 'general'
  }
  
  return detectedNiche
}

// Get niche-specific relevance boosters
export function getNicheRelevanceTerms(niche: Niche): string[] {
  return NICHE_PATTERNS[niche]?.keywords || []
}

// Get niche-specific stop words (terms that should be filtered out for this niche)
export function getNicheStopWords(niche: Niche): Set<string> {
  const commonStopWords = new Set<string>()
  
  // Add stop words that are noise for specific niches
  switch (niche) {
    case 'ecommerce':
      commonStopWords.add('website').add('online').add('internet').add('digital')
      break
    case 'healthcare':
      commonStopWords.add('website').add('online').add('service').add('company')
      break
    case 'finance':
      commonStopWords.add('website').add('online').add('service').add('digital')
      break
    case 'saas':
      commonStopWords.add('website').add('online').add('internet').add('company')
      break
    default:
      break
  }
  
  return commonStopWords
}

// Get contextual weight multipliers based on niche
export function getNicheContextWeights(niche: Niche): Record<string, number> {
  const baseWeights = {
    title: 3.0,
    h1: 2.5,
    h2: 2.0,
    h3: 1.5,
    meta_description: 2.5,
    meta_keywords: 2.0,
    strong: 1.5,
    em: 1.3,
    a: 1.2,
    body: 1.0
  }
  
  // Adjust weights based on niche
  switch (niche) {
    case 'content-marketing':
      return {
        ...baseWeights,
        title: 4.0,
        h1: 3.5,
        meta_description: 3.0
      }
    case 'ecommerce':
      return {
        ...baseWeights,
        title: 3.5,
        h1: 3.0,
        strong: 2.0 // Product features are often in strong tags
      }
    case 'saas':
      return {
        ...baseWeights,
        h2: 2.5, // Feature sections
        strong: 2.0
      }
    default:
      return baseWeights
  }
}
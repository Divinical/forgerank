// Content script for detecting ALL backlinks on a page
// This is injected into every page the user visits

interface DetectedLink {
  href: string
  anchorText: string
  contextType: 'code' | 'config' | 'comment' | 'generic'
  parentTagName: string
  isHidden: boolean
  timestamp: string
  source_url?: string
  source_domain?: string
  target_url?: string
  anchor_text?: string
}

interface CandidateLink {
  href: string
  normalizedHref: string
  anchorText: string
  matchResult: 'MATCHED' | 'SKIPPED'
  skipReason?: string
  matchReason?: string
  element: string
}

// Prevent multiple class declarations when content script is re-injected
if (!(window as any).BacklinkScanner) {

class BacklinkScanner {
  public trackedUrls: string[] = []
  private foundLinks: DetectedLink[] = []
  private candidateLinks: CandidateLink[] = []
  private mutationObserver: MutationObserver | null = null
  private rescanTimeout: number | null = null
  
  constructor() {
    this.init()
    this.setupMessageListener()
  }

  private setupMessageListener() {
    // Listen for requests from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const content = this.extractPageContent()
        sendResponse({
          content: content,
          title: document.title,
          url: window.location.href
        })
        return true // Keep message channel open for async response
      }
      
      if (message.type === 'PING_SCANNER') {
        sendResponse({
          alive: true,
          trackedUrls: this.trackedUrls.length,
          url: window.location.href,
          lastScan: this.foundLinks.length
        })
        return true
      }
    })
  }

  private extractPageContent(): string {
    try {
      // Clone document to avoid modifying the original
      const clonedDoc = document.cloneNode(true) as Document
      
      // Remove unwanted elements that contain UI/noise
      const unwantedSelectors = [
        'script', 'style', 'noscript', 'iframe', 'object', 'embed',
        'nav', 'header', 'footer', 'aside', 'menu', 'menuitem',
        '.nav', '.navigation', '.menu', '.header', '.footer', '.sidebar',
        '.ad', '.ads', '.advertisement', '.banner', '.popup', '.modal',
        '.cookie', '.consent', '.privacy', '.gdpr', '.subscribe',
        '.newsletter', '.social', '.share', '.follow', '.comment', '.comments',
        '.breadcrumb', '.breadcrumbs', '.pagination', '.pager',
        '[aria-label*="navigation"]', '[aria-label*="menu"]', '[aria-label*="banner"]',
        '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
        '[role="contentinfo"]', '[class*="skip"]', '[class*="screen-reader"]'
      ]
      
      unwantedSelectors.forEach(selector => {
        const elements = clonedDoc.querySelectorAll(selector)
        elements.forEach(el => el.remove())
      })
      
      // Priority content selectors - most specific to least specific
      const contentSelectors = [
        'main[role="main"]',
        'div[role="main"]',
        'main',
        'article',
        '.post-content', '.entry-content', '.article-content', '.content-area',
        '.post', '.article', '.entry', '.blog-post',
        '#content', '#main-content', '#primary-content',
        '.content', '.main-content', '.primary-content',
        '[itemprop="articleBody"]', '[itemprop="text"]'
      ]
      
      let bestContent = ''
      let bestScore = 0
      
      // Try each selector and score the content quality
      for (const selector of contentSelectors) {
        const element = clonedDoc.querySelector(selector)
        if (!element) continue
        
        const text = element.textContent || ''
        const score = this.scoreContentQuality(text, element as Element)
        
        if (score > bestScore && text.length > 100) {
          bestContent = text
          bestScore = score
        }
      }
      
      // Fallback to body if no good content found
      if (!bestContent || bestContent.length < 100) {
        const bodyElement = clonedDoc.body
        if (bodyElement) {
          bestContent = bodyElement.textContent || ''
        }
      }
      
      // Clean up and return the text
      return this.cleanExtractedText(bestContent)
        
    } catch (error) {
      console.error('Failed to extract page content:', error)
      return ''
    }
  }

  private scoreContentQuality(text: string, element: Element): number {
    let score = 0
    
    // Base score from text length (longer is generally better for main content)
    score += Math.min(text.length / 1000, 10)
    
    // Boost for paragraph density (main content usually has many <p> tags)
    const paragraphs = element.querySelectorAll('p').length
    score += paragraphs * 2
    
    // Boost for headings (h1-h6)
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length
    score += headings * 1.5
    
    // Penalize for too many links (navigation areas have lots of links)
    const links = element.querySelectorAll('a').length
    const linkDensity = links / Math.max(1, text.length / 100)
    score -= linkDensity * 2
    
    // Penalize for UI keywords in the text
    const uiKeywords = ['click', 'button', 'menu', 'navigation', 'cookie', 'privacy', 'terms', 'login', 'register']
    const uiMatches = uiKeywords.filter(keyword => text.toLowerCase().includes(keyword)).length
    score -= uiMatches * 0.5
    
    // Boost for semantic content indicators
    const contentKeywords = ['article', 'content', 'post', 'story', 'blog', 'news']
    const contentMatches = contentKeywords.filter(keyword => 
      element.className.toLowerCase().includes(keyword) || 
      element.tagName.toLowerCase().includes(keyword)
    ).length
    score += contentMatches * 2
    
    return score
  }

  private cleanExtractedText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\t+/g, ' ') // Replace tabs with spaces
      .replace(/[^\w\s\-.,!?;:()"'/]/g, ' ') // Keep only common punctuation
      .trim()
      .substring(0, 50000) // Limit to 50KB to avoid storage issues
  }
  
  async init() {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        return
      }
      
      const result = await chrome.storage.local.get('trackedUrls')
      this.trackedUrls = result.trackedUrls || []
      
      // Always set up page observation, even with no tracked URLs
      // This ensures scanner is ready when URLs are added during onboarding
      this.observePageChanges()
      
      if (this.trackedUrls.length > 0) {
        this.performScan()
      } else {
        console.log('CS: Scanner initialized with no tracked URLs - ready for onboarding')
      }
      
    } catch (error) {
      // Silent fail - extension context may be invalidated
    }
  }
  
  
  public isCurrentPageTracked(): boolean {
    const result = this.isTrackedUrl(window.location.href, 'current-page')
    return result.isMatch
  }
  
  performScan() {
    if (!chrome || !chrome.storage || !chrome.runtime) {
      return
    }
    
    const startTime = performance.now()
    
    this.foundLinks = []
    this.candidateLinks = []
    
    try {
      this.scanAllAnchors()
      this.scanTextContent()
      this.scanButtonsAndData()
    } catch (error) {
      return
    }
    
    const duration = Math.round(performance.now() - startTime)
    this.sendResults(duration)
  }
  
  private scanAllAnchors() {
    const anchors = document.querySelectorAll('a[href]')
    
    anchors.forEach((anchor, index) => {
      const element = anchor as HTMLAnchorElement
      const href = element.href
      const text = element.textContent?.trim() || element.getAttribute('aria-label') || ''
      
      this.processCandidate({
        href,
        anchorText: text,
        element: `anchor[${index}]`,
        parentTag: element.parentElement?.tagName || 'unknown',
        htmlElement: element
      })
    })
  }
  
  private scanTextContent() {
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let node: Node | null
    let textNodeCount = 0
    
    while (node = walker.nextNode()) {
      const text = node.textContent || ''
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
      const matches = text.match(urlRegex)
      
      if (matches) {
        matches.forEach(url => {
          textNodeCount++
          this.processCandidate({
            href: url,
            anchorText: url,
            element: `text[${textNodeCount}]`,
            parentTag: (node?.parentElement?.tagName || 'TEXT'),
            htmlElement: node?.parentElement || undefined
          })
        })
      }
    }
  }
  
  private scanButtonsAndData() {
    const elements = document.querySelectorAll('button[data-href], [data-url], [onclick*="http"]')
    
    elements.forEach((element, index) => {
      const el = element as HTMLElement
      const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url')
      const onclick = el.getAttribute('onclick')
      
      if (dataHref) {
        this.processCandidate({
          href: dataHref,
          anchorText: el.textContent?.trim() || '',
          element: `data[${index}]`,
          parentTag: el.tagName,
          htmlElement: el
        })
      }
      
      if (onclick) {
        const urlMatch = onclick.match(/https?:\/\/[^\s"']+/)
        if (urlMatch) {
          this.processCandidate({
            href: urlMatch[0],
            anchorText: el.textContent?.trim() || '',
            element: `onclick[${index}]`,
            parentTag: el.tagName,
            htmlElement: el
          })
        }
      }
    })
  }
  
  private processCandidate(candidate: {
    href: string
    anchorText: string
    element: string
    parentTag: string
    htmlElement?: HTMLElement
  }) {
    const normalizedHref = this.normalizeUrl(candidate.href)
    if (!normalizedHref) {
      this.candidateLinks.push({
        href: candidate.href,
        normalizedHref: '',
        anchorText: candidate.anchorText,
        matchResult: 'SKIPPED',
        skipReason: 'Invalid URL',
        element: candidate.element
      })
      return
    }
    
    const matchResult = this.isTrackedUrl(candidate.href, candidate.element)
    
    const candidateLink: CandidateLink = {
      href: candidate.href,
      normalizedHref,
      anchorText: candidate.anchorText,
      matchResult: matchResult.isMatch ? 'MATCHED' : 'SKIPPED',
      skipReason: matchResult.skipReason,
      matchReason: matchResult.matchReason,
      element: candidate.element
    }
    
    this.candidateLinks.push(candidateLink)
    
    if (matchResult.isMatch) {
      
      const detectedLink: DetectedLink = {
        href: candidate.href,
        anchorText: candidate.anchorText,
        contextType: this.detectContextType(candidate.htmlElement || null, candidate.parentTag),
        parentTagName: candidate.parentTag,
        isHidden: false,
        timestamp: this.safeTimestamp(),
        // Add fields for better compatibility
        source_url: window.location.href,
        source_domain: window.location.hostname,
        target_url: candidate.href,
        anchor_text: candidate.anchorText
      }
      
      this.foundLinks.push(detectedLink)
    }
  }
  
  private normalizeUrl(url: string): string {
    if (!url) return ''
    
    try {
      const absoluteUrl = new URL(url, window.location.href)
      let normalized = absoluteUrl.href.toLowerCase()
      
      // Remove trailing slash (except root)
      if (normalized.endsWith('/') && normalized !== absoluteUrl.origin + '/') {
        normalized = normalized.slice(0, -1)
      }
      
      // Remove www. for consistency
      normalized = normalized.replace('://www.', '://')
      
      return normalized
    } catch (e) {
      return ''
    }
  }
  
  private isTrackedUrl(candidateUrl: string, _context?: string): {
    isMatch: boolean
    matchReason?: string
    skipReason?: string
  } {
    if (!candidateUrl || this.trackedUrls.length === 0) {
      return { isMatch: false, skipReason: 'Empty URL or no tracked URLs' }
    }
    
    const normalizedCandidate = this.normalizeUrl(candidateUrl)
    if (!normalizedCandidate) {
      return { isMatch: false, skipReason: 'URL normalization failed' }
    }
    
    // CRITICAL FIX: Skip internal links (same domain)
    // A backlink should only be from an EXTERNAL site linking TO your tracked domain
    try {
      const currentDomain = window.location.hostname
      const candidateDomain = new URL(normalizedCandidate).hostname
      
      if (currentDomain === candidateDomain) {
        return { 
          isMatch: false, 
          skipReason: `Internal link (same domain: ${currentDomain}) - not a backlink` 
        }
      }
    } catch (e) {
      // Continue with normal processing if domain parsing fails
    }
    
    // Check against each tracked URL
    for (let i = 0; i < this.trackedUrls.length; i++) {
      const trackedUrl = this.trackedUrls[i]
      const normalizedTracked = this.normalizeUrl(trackedUrl)
      
      if (!normalizedTracked) continue
      
      try {
        const candidateParsed = new URL(normalizedCandidate)
        const trackedParsed = new URL(normalizedTracked)
        
        // 1. Exact match
        if (normalizedCandidate === normalizedTracked) {
          return { isMatch: true, matchReason: `External backlink: exact match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 2. Subpage match (candidate starts with tracked)
        if (normalizedCandidate.startsWith(normalizedTracked + '/')) {
          return { isMatch: true, matchReason: `External backlink: subpage match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 3. Same domain
        if (candidateParsed.hostname === trackedParsed.hostname) {
          return { isMatch: true, matchReason: `External backlink: same domain match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 4. Subdomain match
        if (candidateParsed.hostname.endsWith('.' + trackedParsed.hostname)) {
          return { isMatch: true, matchReason: `External backlink: subdomain match with tracked[${i}]: ${trackedUrl}` }
        }
        
      } catch (e) {
        // URL parsing error - skip
      }
    }
    
    return { 
      isMatch: false, 
      skipReason: `No match against ${this.trackedUrls.length} tracked URLs` 
    }
  }
  
  private detectContextType(element: HTMLElement | null, parentTag: string): 'code' | 'config' | 'comment' | 'generic' {
    if (!element) {
      // Fallback to basic detection if no element provided
      const tag = parentTag.toLowerCase()
      if (['pre', 'code'].includes(tag)) return 'code'
      if (tag.includes('comment')) return 'comment'
      if (tag.includes('config') || tag.includes('setting')) return 'config'
      return 'generic'
    }

    // Advanced context detection using DOM traversal
    const context = this.analyzeElementContext(element)
    
    if (context.isCodeContext) return 'code'
    if (context.isCommentContext) return 'comment'
    if (context.isConfigContext) return 'config'
    
    return 'generic'
  }

  private analyzeElementContext(element: HTMLElement): {
    isCodeContext: boolean
    isCommentContext: boolean
    isConfigContext: boolean
  } {
    // Check element and its ancestors up to 5 levels
    let currentElement: HTMLElement | null = element
    let depth = 0
    const maxDepth = 5

    while (currentElement && depth < maxDepth) {
      const tagName = currentElement.tagName.toLowerCase()
      const className = currentElement.className.toLowerCase()
      const id = currentElement.id.toLowerCase()
      
      // Code context detection
      const codeIndicators = [
        // Direct code tags
        tagName === 'code',
        tagName === 'pre',
        tagName === 'kbd',
        tagName === 'samp',
        tagName === 'var',
        // Common code block classes
        className.includes('code'),
        className.includes('highlight'),
        className.includes('syntax'),
        className.includes('language-'),
        className.includes('hljs'),
        className.includes('prism'),
        className.includes('codehilite'),
        className.includes('sourceCode'),
        // Code block IDs
        id.includes('code'),
        id.includes('syntax')
      ]

      if (codeIndicators.some(Boolean)) {
        return { isCodeContext: true, isCommentContext: false, isConfigContext: false }
      }

      // Comment context detection
      const commentIndicators = [
        className.includes('comment'),
        className.includes('reply'),
        className.includes('discussion'),
        className.includes('feedback'),
        className.includes('review'),
        id.includes('comment'),
        id.includes('discussion'),
        // GitHub-style comments
        className.includes('js-comment'),
        className.includes('comment-body'),
        // Blog/forum comments
        tagName === 'aside' && (className.includes('comment') || className.includes('reply')),
        // WordPress/common CMS comment patterns
        className.includes('wp-comment'),
        className.includes('comment-content'),
        className.includes('comment-text')
      ]

      if (commentIndicators.some(Boolean)) {
        return { isCodeContext: false, isCommentContext: true, isConfigContext: false }
      }

      // Config context detection
      const href = element.getAttribute('href') || ''
      const configIndicators = [
        className.includes('config'),
        className.includes('settings'),
        className.includes('preferences'),
        className.includes('options'),
        id.includes('config'),
        id.includes('settings'),
        // File extension patterns in URLs
        href.includes('.json'),
        href.includes('.yaml'),
        href.includes('.yml'),
        href.includes('.toml'),
        href.includes('.ini'),
        href.includes('.conf'),
        href.includes('.cfg'),
        href.includes('.env'),
        href.includes('package.json'),
        href.includes('composer.json'),
        href.includes('tsconfig.json'),
        href.includes('webpack.config'),
        href.includes('vite.config'),
        // Config-related text content
        (currentElement.textContent || '').toLowerCase().includes('configuration'),
        (currentElement.textContent || '').toLowerCase().includes('package.json'),
        (currentElement.textContent || '').toLowerCase().includes('config file')
      ]

      if (configIndicators.some(Boolean)) {
        return { isCodeContext: false, isCommentContext: false, isConfigContext: true }
      }

      currentElement = currentElement.parentElement
      depth++
    }

    return { isCodeContext: false, isCommentContext: false, isConfigContext: false }
  }
  
  private safeTimestamp(): string {
    try {
      return new Date().toISOString()
    } catch (error) {
      return new Date(Date.now()).toISOString()
    }
  }
  
  // Reload tracked URLs from storage (for state synchronization)
  async reloadTrackedUrls() {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        return
      }
      
      const result = await chrome.storage.local.get('trackedUrls')
      const newTrackedUrls = result.trackedUrls || []
      
      if (JSON.stringify(this.trackedUrls) !== JSON.stringify(newTrackedUrls)) {
        console.log('CS: Updating tracked URLs:', newTrackedUrls.length)
        this.trackedUrls = newTrackedUrls
        
        if (newTrackedUrls.length > 0) {
          this.performScan()
        } else {
          // Clear existing results if no URLs to track
          this.foundLinks = []
          this.candidateLinks = []
        }
      }
    } catch (error) {
      console.log('CS: Failed to reload tracked URLs:', error)
    }
  }
  
  // Enhanced state refresh method
  public refreshState() {
    console.log('CS: Refreshing scanner state for', window.location.href)
    this.reloadTrackedUrls()
  }
  
  
  private sendResults(duration: number) {
    const isTrackedPage = this.isCurrentPageTracked()
    
    // Send page scan result for badge
    this.safeSendMessage({
      type: 'PAGE_SCAN_RESULT',
      data: {
        isTrackedPage,
        backlinkCount: this.foundLinks.length
      }
    })
    
    // Send backlinks if found
    if (this.foundLinks.length > 0) {
      this.safeSendMessage({
        type: 'BACKLINKS_FOUND',
        data: {
          links: this.foundLinks,
          pageUrl: window.location.href,
          pageTitle: document.title,
          scanDuration: duration
        }
      })
    }
  }
  
  private safeSendMessage(message: any) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, () => {
          if (chrome.runtime.lastError) {
            // Silent fail - extension context may be invalidated
          }
        })
      }
    } catch (error) {
      // Silent fail - extension context invalidated
    }
  }
  
  private observePageChanges() {
    // Disconnect existing observer if any
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
    }
    
    this.mutationObserver = new MutationObserver(() => {
      if (this.rescanTimeout) {
        clearTimeout(this.rescanTimeout)
      }
      this.rescanTimeout = window.setTimeout(() => {
        this.performScan()
      }, 1000)
    })
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
  
  // Cleanup method to prevent memory leaks
  public cleanup() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    if (this.rescanTimeout) {
      clearTimeout(this.rescanTimeout)
      this.rescanTimeout = null
    }
  }
}

// Store the class on window to prevent redeclaration
;(window as any).BacklinkScanner = BacklinkScanner

}

// Initialize scanner only if extension context is valid
if (chrome && chrome.storage && chrome.runtime) {
  // Prevent double initialization if content script is re-injected
  if ((window as any).forgeRankScanner) {
    console.log('CS: Scanner already exists, refreshing state...')
    ;(window as any).forgeRankScanner.refreshState()
  } else {
    console.log('CS: Creating new scanner instance...')
    const scanner = new (window as any).BacklinkScanner()
    ;(window as any).forgeRankScanner = scanner

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'RELOAD_SCANNER_STATE') {
        scanner.trackedUrls = message.trackedUrls || []
        scanner.performScan()
        sendResponse({ success: true })
      }
    })

    // Enhanced initialization - fixes navigation scanning
    let currentUrl = window.location.href
    
    function initializeScanner() {
      console.log('CS: Initializing scanner for', currentUrl)
      scanner.performScan()
    }
    
    // Trigger scan when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeScanner)
    } else {
      initializeScanner()
    }
    
    // Detect URL changes (fixes SPA navigation scanning)
    const urlChangeObserver = new MutationObserver(() => {
      const newUrl = window.location.href
      if (newUrl !== currentUrl) {
        console.log('CS: URL changed from', currentUrl, 'to', newUrl)
        currentUrl = newUrl
        
        // Small delay to let SPA content load
        setTimeout(() => {
          scanner.refreshState()
        }, 1000)
      }
    })
    
    // Start observing for SPA navigation
    urlChangeObserver.observe(document, {
      subtree: true,
      childList: true
    })
    
    // Also listen for history API changes
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      setTimeout(() => scanner.refreshState(), 1000)
    }
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      setTimeout(() => scanner.refreshState(), 1000)
    }
    
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      setTimeout(() => scanner.refreshState(), 1000)
    })
    
    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      urlChangeObserver.disconnect()
      scanner.cleanup()
    })
  }  // Close the else block
  
} else {
  console.log('CS: Extension context not available - skipping scanner initialization')
}
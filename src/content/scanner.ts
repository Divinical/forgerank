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

class BacklinkScanner {
  public trackedUrls: string[] = []
  private foundLinks: DetectedLink[] = []
  private candidateLinks: CandidateLink[] = []
  private mutationObserver: MutationObserver | null = null
  private rescanTimeout: number | null = null
  
  constructor() {
    this.init()
  }
  
  async init() {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        return
      }
      
      const result = await chrome.storage.local.get('trackedUrls')
      this.trackedUrls = result.trackedUrls || []
      
      if (this.trackedUrls.length === 0) {
        return
      }
      
      this.performScan()
      this.observePageChanges()
      
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
        parentTag: element.parentElement?.tagName || 'unknown'
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
            parentTag: (node?.parentElement?.tagName || 'TEXT')
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
          parentTag: el.tagName
        })
      }
      
      if (onclick) {
        const urlMatch = onclick.match(/https?:\/\/[^\s"']+/)
        if (urlMatch) {
          this.processCandidate({
            href: urlMatch[0],
            anchorText: el.textContent?.trim() || '',
            element: `onclick[${index}]`,
            parentTag: el.tagName
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
        contextType: this.detectContextType(candidate.parentTag),
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
          return { isMatch: true, matchReason: `Exact match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 2. Subpage match (candidate starts with tracked)
        if (normalizedCandidate.startsWith(normalizedTracked + '/')) {
          return { isMatch: true, matchReason: `Subpage match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 3. Same domain
        if (candidateParsed.hostname === trackedParsed.hostname) {
          return { isMatch: true, matchReason: `Same domain match with tracked[${i}]: ${trackedUrl}` }
        }
        
        // 4. Subdomain match
        if (candidateParsed.hostname.endsWith('.' + trackedParsed.hostname)) {
          return { isMatch: true, matchReason: `Subdomain match with tracked[${i}]: ${trackedUrl}` }
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
  
  private detectContextType(parentTag: string): 'code' | 'config' | 'comment' | 'generic' {
    const tag = parentTag.toLowerCase()
    if (['pre', 'code'].includes(tag)) return 'code'
    if (tag.includes('comment')) return 'comment'
    if (tag.includes('config') || tag.includes('setting')) return 'config'
    return 'generic'
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
        this.trackedUrls = newTrackedUrls
        
        if (newTrackedUrls.length > 0) {
          this.performScan()
        }
      }
    } catch (error) {
      // Silent fail
    }
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

// Initialize scanner only if extension context is valid
if (chrome && chrome.storage && chrome.runtime) {
  const scanner = new BacklinkScanner()
  ;(window as any).forgeRankScanner = scanner

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'RELOAD_SCANNER_STATE') {
      scanner.trackedUrls = message.trackedUrls || []
      scanner.performScan()
      sendResponse({ success: true })
    }
  })

  // Trigger scan when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanner.performScan()
    })
  } else {
    scanner.performScan()
  }
  
  // Cleanup on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    scanner.cleanup()
  })
  
} else {
  // Extension context not available - skip initialization
}
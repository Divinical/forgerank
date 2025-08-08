// Content script for detecting ALL backlinks on a page
// This is injected into every page the user visits

interface DetectedLink {
  href: string
  anchorText: string
  contextType: 'code' | 'config' | 'comment' | 'generic'
  parentTagName: string
  isHidden: boolean
  timestamp: string
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
  
  constructor() {
    console.log('🔍 ForgeRank Scanner: Initializing on', window.location.href)
    this.init()
  }
  
  async init() {
    try {
      console.log('🔍 ForgeRank Scanner: Loading tracked URLs from storage...')
      
      // Check if extension context is still valid
      if (!chrome.storage || !chrome.storage.local) {
        console.log('🔍 ForgeRank Scanner: Extension context invalidated - skipping initialization')
        return
      }
      
      const result = await chrome.storage.local.get('trackedUrls')
      this.trackedUrls = result.trackedUrls || []
      
      console.log(`🔍 ForgeRank Scanner: Found ${this.trackedUrls.length} tracked URLs:`, this.trackedUrls)
      
      if (this.trackedUrls.length === 0) {
        console.log('🔍 ForgeRank Scanner: No tracked URLs - skipping scan')
        return
      }
      
      this.testDOMAccess()
      this.performScan()
      this.observePageChanges()
      
    } catch (error) {
      console.log('🔍 ForgeRank Scanner: Init failed (extension context may be invalidated):', error)
    }
  }
  
  private testDOMAccess() {
    try {
      const anchors = document.querySelectorAll('a')
      console.log(`🔍 ForgeRank Scanner: DOM Access OK - Found ${anchors.length} anchors`)
      
      // Sample first few links
      for (let i = 0; i < Math.min(3, anchors.length); i++) {
        const anchor = anchors[i] as HTMLAnchorElement
        console.log(`🔍 Sample link ${i + 1}: "${anchor.href}" (${anchor.textContent?.trim() || 'no text'})`)
      }
    } catch (error) {
      console.error('🔍 ForgeRank Scanner: DOM Access Failed:', error)
    }
  }
  
  public isCurrentPageTracked(): boolean {
    const result = this.isTrackedUrl(window.location.href, 'current-page')
    console.log(`🔍 Current page ${window.location.href} tracked: ${result.isMatch}`)
    return result.isMatch
  }
  
  performScan() {
    // Check extension context before scanning
    if (!chrome || !chrome.storage || !chrome.runtime) {
      console.log('🔍 ForgeRank Scanner: Extension context invalidated - skipping scan')
      return
    }
    
    console.log('🔍 ForgeRank Scanner: === STARTING SCAN ===')
    const startTime = performance.now()
    
    this.foundLinks = []
    this.candidateLinks = []
    
    try {
      this.scanAllAnchors()
      this.scanTextContent()
      this.scanButtonsAndData()
    } catch (error) {
      console.log('🔍 ForgeRank Scanner: Scan error (may be context invalidation):', error)
      return
    }
    
    const duration = Math.round(performance.now() - startTime)
    this.generateFinalReport(duration)
    this.sendResults(duration)
  }
  
  private scanAllAnchors() {
    const anchors = document.querySelectorAll('a[href]')
    console.log(`🔍 ForgeRank Scanner: Scanning ${anchors.length} anchor elements`)
    
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
    console.log('🔍 ForgeRank Scanner: Scanning text content for raw URLs')
    
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
    console.log(`🔍 ForgeRank Scanner: Scanning ${elements.length} button/data elements`)
    
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
      console.log(`✅ MATCH FOUND: ${candidate.href} (${matchResult.matchReason})`)
      
      const detectedLink: DetectedLink = {
        href: candidate.href,
        anchorText: candidate.anchorText,
        contextType: this.detectContextType(candidate.parentTag),
        parentTagName: candidate.parentTag,
        isHidden: false, // Simplified for debugging
        timestamp: this.safeTimestamp()
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
        console.warn(`🔍 Error parsing URLs: candidate=${normalizedCandidate}, tracked=${normalizedTracked}`, e)
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
        console.log('🔍 ForgeRank Scanner: Extension context invalid - cannot reload URLs')
        return
      }
      
      const result = await chrome.storage.local.get('trackedUrls')
      const newTrackedUrls = result.trackedUrls || []
      
      if (JSON.stringify(this.trackedUrls) !== JSON.stringify(newTrackedUrls)) {
        console.log('🔍 ForgeRank Scanner: Tracked URLs changed, updating:', newTrackedUrls)
        this.trackedUrls = newTrackedUrls
        
        if (newTrackedUrls.length > 0) {
          this.performScan()
        }
      }
    } catch (error) {
      console.log('🔍 ForgeRank Scanner: Failed to reload tracked URLs:', error)
    }
  }
  
  private generateFinalReport(duration: number) {
    console.log('🔍 ForgeRank Scanner: === SCAN COMPLETE ===')
    console.log(`⏱️ Duration: ${duration}ms`)
    console.log(`📊 Total candidates: ${this.candidateLinks.length}`)
    console.log(`✅ Matches found: ${this.foundLinks.length}`)
    
    if (this.candidateLinks.length > 0) {
      console.log('📋 Detailed Results:')
      
      this.candidateLinks.forEach((candidate, index) => {
        if (candidate.matchResult === 'MATCHED') {
          console.log(`  ✅ [${index}] MATCH: ${candidate.href} (${candidate.matchReason})`)
        }
      })
      
      // Show some skipped examples
      const skipped = this.candidateLinks.filter(c => c.matchResult === 'SKIPPED')
      if (skipped.length > 0) {
        console.log(`❌ Skipped ${skipped.length} candidates. First 5:`)
        skipped.slice(0, 5).forEach((candidate, index) => {
          console.log(`  ❌ [${index}] SKIP: ${candidate.href} (${candidate.skipReason})`)
        })
      }
    } else {
      console.log('⚠️ No candidates found - possible DOM access issue')
    }
    
    console.log('🔍 ForgeRank Scanner: === END REPORT ===')
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
      console.log('📤 Sending backlinks to background:', this.foundLinks)
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
          // Handle potential runtime errors
          if (chrome.runtime.lastError) {
            console.log('🔍 ForgeRank Scanner: Message send failed (extension context may be invalidated):', chrome.runtime.lastError.message)
          }
        })
      }
    } catch (error) {
      console.log('🔍 ForgeRank Scanner: Failed to send message (extension context invalidated):', error)
    }
  }
  
  private observePageChanges() {
    const observer = new MutationObserver(() => {
      clearTimeout(this.rescanTimeout)
      this.rescanTimeout = window.setTimeout(() => {
        console.log('🔍 ForgeRank Scanner: DOM changed - rescanning...')
        this.performScan()
      }, 1000)
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
  
  private rescanTimeout?: number
}

// Initialize scanner only if extension context is valid
if (chrome && chrome.storage && chrome.runtime) {
  const scanner = new BacklinkScanner()
  ;(window as any).forgeRankScanner = scanner

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'RELOAD_SCANNER_STATE') {
      console.log('🔍 ForgeRank Scanner: Reloading state with tracked URLs:', message.trackedUrls)
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
} else {
  console.log('🔍 ForgeRank Scanner: Extension context not available - skipping initialization')
}
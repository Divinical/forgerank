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

class BacklinkScanner {
  private trackedUrls: string[] = []
  private foundLinks: DetectedLink[] = []
  
  constructor() {
    this.init()
  }
  
  async init() {
    // Get tracked URLs from storage
    const result = await chrome.storage.local.get('trackedUrls')
    this.trackedUrls = result.trackedUrls || []
    
    if (this.trackedUrls.length === 0) {
      return // No URLs to track
    }
    
    // Start scanning
    this.performScan()
    
    // Watch for dynamic content changes
    this.observePageChanges()
  }
  
  performScan() {
    const startTime = performance.now()
    this.foundLinks = []
    
    // Method 1: Get all anchor tags (standard links)
    const anchorTags = document.querySelectorAll('a[href]')
    anchorTags.forEach(anchor => {
      this.processElement(anchor as HTMLAnchorElement)
    })
    
    // Method 2: Get all elements with onclick handlers that might navigate
    const clickableElements = document.querySelectorAll('[onclick*="location"], [onclick*="href"], [onclick*="url"], [onclick*="link"]')
    clickableElements.forEach(element => {
      this.processClickableElement(element as HTMLElement)
    })
    
    // Method 3: Check all buttons that might contain links
    const buttons = document.querySelectorAll('button, [role="button"], [type="button"]')
    buttons.forEach(button => {
      this.processButtonElement(button as HTMLElement)
    })
    
    // Method 4: Check divs and spans that might be clickable links
    const potentialLinks = document.querySelectorAll('div[data-href], span[data-href], div[data-url], span[data-url]')
    potentialLinks.forEach(element => {
      this.processDataElement(element as HTMLElement)
    })
    
    // Method 5: Deep scan for hidden or obfuscated links
    this.deepScanForLinks()
    
    // Method 6: Check for links in iframes (if accessible)
    this.scanIframes()
    
    // Method 7: Check shadow DOM elements
    this.scanShadowDOM()
    
    const endTime = performance.now()
    const duration = Math.round(endTime - startTime)
    
    // Send results back to extension
    if (this.foundLinks.length > 0) {
      chrome.runtime.sendMessage({
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
  
  processElement(anchor: HTMLAnchorElement) {
    const href = this.normalizeUrl(anchor.href)
    if (!href || !this.isTrackedUrl(href)) return
    
    const link: DetectedLink = {
      href,
      anchorText: this.extractAnchorText(anchor),
      contextType: this.detectContextType(anchor),
      parentTagName: anchor.parentElement?.tagName || 'UNKNOWN',
      isHidden: this.isElementHidden(anchor),
      timestamp: new Date().toISOString()
    }
    
    this.foundLinks.push(link)
  }
  
  processClickableElement(element: HTMLElement) {
    // Extract URL from onclick attribute
    const onclickAttr = element.getAttribute('onclick') || ''
    const urlMatch = onclickAttr.match(/(?:location|href|url|link)\s*=\s*["']([^"']+)["']/)
    
    if (urlMatch && urlMatch[1]) {
      const href = this.normalizeUrl(urlMatch[1])
      if (!href || !this.isTrackedUrl(href)) return
      
      const link: DetectedLink = {
        href,
        anchorText: this.extractTextContent(element),
        contextType: 'generic',
        parentTagName: element.tagName,
        isHidden: this.isElementHidden(element),
        timestamp: new Date().toISOString()
      }
      
      this.foundLinks.push(link)
    }
  }
  
  processButtonElement(button: HTMLElement) {
    // Check if button contains an anchor tag
    const anchor = button.querySelector('a[href]')
    if (anchor) {
      this.processElement(anchor as HTMLAnchorElement)
      return
    }
    
    // Check for data attributes
    const dataHref = button.getAttribute('data-href') || button.getAttribute('data-url')
    if (dataHref) {
      const href = this.normalizeUrl(dataHref)
      if (!href || !this.isTrackedUrl(href)) return
      
      const link: DetectedLink = {
        href,
        anchorText: this.extractTextContent(button),
        contextType: 'generic',
        parentTagName: button.tagName,
        isHidden: this.isElementHidden(button),
        timestamp: new Date().toISOString()
      }
      
      this.foundLinks.push(link)
    }
  }
  
  processDataElement(element: HTMLElement) {
    const dataHref = element.getAttribute('data-href') || element.getAttribute('data-url')
    if (dataHref) {
      const href = this.normalizeUrl(dataHref)
      if (!href || !this.isTrackedUrl(href)) return
      
      const link: DetectedLink = {
        href,
        anchorText: this.extractTextContent(element),
        contextType: this.detectContextType(element),
        parentTagName: element.tagName,
        isHidden: this.isElementHidden(element),
        timestamp: new Date().toISOString()
      }
      
      this.foundLinks.push(link)
    }
  }
  
  deepScanForLinks() {
    // Scan all text nodes for URLs
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let node
    while (node = walker.nextNode()) {
      const text = node.textContent || ''
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
      const matches = text.match(urlRegex)
      
      if (matches) {
        matches.forEach(url => {
          const href = this.normalizeUrl(url)
          if (href && this.isTrackedUrl(href)) {
            const parentElement = node.parentElement
            const link: DetectedLink = {
              href,
              anchorText: url,
              contextType: this.detectContextType(parentElement!),
              parentTagName: parentElement?.tagName || 'TEXT',
              isHidden: parentElement ? this.isElementHidden(parentElement) : false,
              timestamp: new Date().toISOString()
            }
            
            this.foundLinks.push(link)
          }
        })
      }
    }
  }
  
  scanIframes() {
    try {
      const iframes = document.querySelectorAll('iframe')
      iframes.forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          if (iframeDoc) {
            // Recursively scan iframe content
            const iframeLinks = iframeDoc.querySelectorAll('a[href]')
            iframeLinks.forEach(anchor => {
              this.processElement(anchor as HTMLAnchorElement)
            })
          }
        } catch (e) {
          // Cross-origin iframe, can't access
        }
      })
    } catch (e) {
      console.error('Error scanning iframes:', e)
    }
  }
  
  scanShadowDOM() {
    // Find all elements that might have shadow roots
    const allElements = document.querySelectorAll('*')
    allElements.forEach(element => {
      if (element.shadowRoot) {
        const shadowLinks = element.shadowRoot.querySelectorAll('a[href]')
        shadowLinks.forEach(anchor => {
          this.processElement(anchor as HTMLAnchorElement)
        })
      }
    })
  }
  
  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldRescan = false
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement
              if (element.querySelector('a[href]') || element.tagName === 'A') {
                shouldRescan = true
              }
            }
          })
        }
      })
      
      if (shouldRescan) {
        // Debounce rescan
        clearTimeout(this.rescanTimeout)
        this.rescanTimeout = window.setTimeout(() => {
          this.performScan()
        }, 1000)
      }
    })
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
  
  private rescanTimeout?: number
  
  private normalizeUrl(url: string): string {
    try {
      // Handle relative URLs
      const absoluteUrl = new URL(url, window.location.href)
      return absoluteUrl.href
    } catch (e) {
      return ''
    }
  }
  
  private isTrackedUrl(url: string): boolean {
    return this.trackedUrls.some(trackedUrl => {
      // Check if URL matches exactly or is a subdomain/subpath
      return url === trackedUrl || 
             url.startsWith(trackedUrl) ||
             new URL(url).hostname === new URL(trackedUrl).hostname
    })
  }
  
  private extractAnchorText(element: HTMLElement): string {
    // First try direct text content
    let text = element.textContent?.trim() || ''
    
    // If no text, check for images with alt text
    if (!text) {
      const img = element.querySelector('img')
      text = img?.alt || img?.title || ''
    }
    
    // If still no text, check for aria-label
    if (!text) {
      text = element.getAttribute('aria-label') || element.getAttribute('title') || ''
    }
    
    // If still no text, use href as fallback
    if (!text && element instanceof HTMLAnchorElement) {
      text = element.href
    }
    
    return text.substring(0, 200) // Limit length
  }
  
  private extractTextContent(element: HTMLElement): string {
    return this.extractAnchorText(element)
  }
  
  private detectContextType(element: HTMLElement): 'code' | 'config' | 'comment' | 'generic' {
    // Check if inside code block
    if (element.closest('pre, code, .highlight, .hljs, .prism')) {
      return 'code'
    }
    
    // Check if inside comment section
    if (element.closest('.comment, .comments, #comments, [class*="comment"]')) {
      return 'comment'
    }
    
    // Check if inside config/settings
    if (element.closest('.config, .settings, .configuration, [class*="config"]')) {
      return 'config'
    }
    
    return 'generic'
  }
  
  private isElementHidden(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    return style.display === 'none' || 
           style.visibility === 'hidden' || 
           style.opacity === '0' ||
           element.offsetParent === null
  }
}

// Initialize scanner when content script loads
new BacklinkScanner()
// Background script for handling extension events

// Safe date utility
function safeTimestamp(): string {
  try {
    return new Date().toISOString()
  } catch (error) {
    return new Date(Date.now()).toISOString()
  }
}

// Deduplicate backlinks by source domain + target URL
function deduplicateBacklinks(backlinks: any[]): any[] {
  const seen = new Map<string, any>()
  
  for (const backlink of backlinks) {
    const key = `${backlink.source_domain}|${backlink.target_url}`
    const existing = seen.get(key)
    
    if (!existing) {
      seen.set(key, backlink)
    } else {
      // If anchor text is different and meaningful, keep both
      const existingAnchor = (existing.anchor_text || '').trim()
      const newAnchor = (backlink.anchor_text || '').trim()
      
      if (newAnchor && existingAnchor !== newAnchor && !existingAnchor.includes(newAnchor)) {
        // Combine anchor texts
        existing.anchor_text = existingAnchor + (existingAnchor ? ' | ' : '') + newAnchor
        existing.last_checked_at = backlink.last_checked_at // Update timestamp
      }
    }
  }
  
  return Array.from(seen.values())
}

// Extract keywords from page content
function extractKeywords(content: string, sourceUrl: string): any[] {
  if (!content || typeof content !== 'string') return []
  
  // Clean the content - remove HTML, scripts, styles
  const cleanContent = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  
  // Basic stopwords
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their', 'from', 'up', 'out', 'down', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'as', 'so', 'than', 'too', 'very', 'about', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'all', 'any',
    'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'now'
  ])
  
  // Extract words (2+ characters, letters/numbers/hyphens only)
  const words = cleanContent.match(/\b[a-z0-9-]{2,}\b/g) || []
  
  // Count frequency of meaningful words
  const wordFreq = new Map<string, number>()
  for (const word of words) {
    if (!stopwords.has(word) && word.length > 2 && !/^\d+$/.test(word)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }
  }
  
  // Get top keywords with frequency > 1
  const keywords = Array.from(wordFreq.entries())
    .filter(([_, freq]) => freq > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, frequency]) => ({
      id: `${sourceUrl}-${keyword}`,
      keyword,
      frequency,
      relevance: frequency > 5 ? 'high' : frequency > 2 ? 'medium' : 'low',
      source_url: sourceUrl,
      created_at: safeTimestamp()
    }))
  
  return keywords
}

// Extract keywords from page and store them
async function extractAndStoreKeywords(pageUrl: string, tabId?: number) {
  try {
    if (!tabId) {
      console.log('🔧 Background: No tabId for keyword extraction')
      return
    }
    
    // Inject script to get page content
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Get page content, excluding script and style elements
        const content = document.body ? document.body.innerText || document.body.textContent || '' : ''
        return content.substring(0, 10000) // Limit to first 10k chars for performance
      }
    })
    
    if (results && results[0] && results[0].result) {
      const pageContent = results[0].result
      const extractedKeywords = extractKeywords(pageContent, pageUrl)
      
      if (extractedKeywords.length > 0) {
        console.log(`🔧 Background: Extracted ${extractedKeywords.length} keywords from ${pageUrl}`)
        
        // Store keywords locally
        const existingData = await chrome.storage.local.get('localKeywords')
        const existingKeywords = existingData.localKeywords || []
        
        // Deduplicate keywords by keyword + source_url
        const keywordMap = new Map()
        
        // Add existing keywords
        for (const kw of existingKeywords) {
          keywordMap.set(`${kw.keyword}|${kw.source_url}`, kw)
        }
        
        // Add new keywords (or update frequency)
        for (const kw of extractedKeywords) {
          const key = `${kw.keyword}|${kw.source_url}`
          const existing = keywordMap.get(key)
          if (existing) {
            existing.frequency = Math.max(existing.frequency, kw.frequency)
            existing.relevance = existing.frequency > 5 ? 'high' : existing.frequency > 2 ? 'medium' : 'low'
          } else {
            keywordMap.set(key, kw)
          }
        }
        
        // Keep only top 200 keywords by frequency
        const allKeywords = Array.from(keywordMap.values())
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 200)
        
        await chrome.storage.local.set({ localKeywords: allKeywords })
        console.log(`🔧 Background: Stored ${allKeywords.length} total keywords`)
      }
    }
  } catch (error) {
    console.log('🔧 Background: Keyword extraction failed:', error)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('ForgeRank extension installed')
  
  // Set default values
  chrome.storage.local.set({
    trackedUrls: [],
    isAuthenticated: false,
    isPro: false
  })
})

// Track badge state per tab
const tabBadgeState = new Map<number, { isTrackedPage: boolean, backlinkCount: number }>()

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  console.log(`🔧 Background: Received message type: ${message.type}`, {
    tabId: sender.tab?.id,
    url: sender.tab?.url,
    data: message.data
  })
  
  if (message.type === 'BACKLINKS_FOUND') {
    handleBacklinksFound(message.data, sender.tab)
  } else if (message.type === 'PAGE_SCAN_RESULT') {
    handlePageScanResult(message.data, sender.tab)
  }
})

async function handlePageScanResult(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  const { isTrackedPage, backlinkCount } = data
  
  // Update badge state for this tab
  tabBadgeState.set(tab.id, { isTrackedPage, backlinkCount })
  
  // Update badge if this is the active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id === tab.id) {
    await updateBadgeForTab(tab.id)
  }
}

async function updateBadgeForTab(tabId: number) {
  const state = tabBadgeState.get(tabId)
  
  if (state && (state.isTrackedPage || state.backlinkCount > 0)) {
    const badgeText = state.backlinkCount > 9 ? '9+' : state.backlinkCount.toString()
    await chrome.action.setBadgeText({ 
      text: state.isTrackedPage ? '●' : badgeText,
      tabId 
    })
    await chrome.action.setBadgeBackgroundColor({ 
      color: state.isTrackedPage ? '#10b981' : '#f97316',
      tabId 
    })
  } else {
    await chrome.action.setBadgeText({ text: '', tabId })
  }
}

async function handleBacklinksFound(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  console.log('🔧 Background: Processing backlinks found:', data)
  
  // Get current user data
  const storage = await chrome.storage.local.get(['userId', 'isAuthenticated', 'isPro'])
  
  if (!storage.isAuthenticated) {
    // Store locally for non-authenticated users
    const localBacklinks = await chrome.storage.local.get('localBacklinks') || {}
    const existingBacklinks = localBacklinks.localBacklinks || []
    
    // Transform and deduplicate links
    const timestamp = safeTimestamp()
    const newBacklinks = data.links.map((link: any) => ({
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source_url: data.pageUrl,
      source_domain: new URL(data.pageUrl).hostname,
      target_url: link.href,
      anchor_text: link.anchorText,
      context_type: link.contextType,
      is_broken: false,
      http_status: null,
      first_seen_at: timestamp,
      last_checked_at: timestamp,
      created_at: timestamp
    }))
    
    // Deduplicate backlinks: group by [source domain + target URL]
    const deduplicatedBacklinks = deduplicateBacklinks([...existingBacklinks, ...newBacklinks])
    const trimmedBacklinks = deduplicatedBacklinks.slice(-100)
    
    await chrome.storage.local.set({ localBacklinks: trimmedBacklinks })
    
    console.log(`🔧 Background: Stored ${newBacklinks.length} new local backlinks. Total: ${trimmedBacklinks.length}`)
    
    // Extract keywords from the source page
    await extractAndStoreKeywords(data.pageUrl, tab.id)
  } else {
    // For authenticated users, store as pending
    const authenticatedBacklinks = await chrome.storage.local.get('pendingBacklinks') || {}
    const pending = authenticatedBacklinks.pendingBacklinks || []
    
    data.links.forEach((link: any) => {
      pending.push({
        ...link,
        sourceUrl: data.pageUrl,
        sourceTitle: data.pageTitle,
        tabId: tab.id,
        userId: storage.userId
      })
    })
    
    await chrome.storage.local.set({ pendingBacklinks: pending })
    
    console.log(`🔧 Background: Stored ${data.links.length} pending backlinks for authenticated user`)
    
    // Extract keywords from the source page for authenticated users too
    await extractAndStoreKeywords(data.pageUrl, tab.id)
  }
  
  // Update badge state
  const currentState = tabBadgeState.get(tab.id) || { isTrackedPage: false, backlinkCount: 0 }
  currentState.backlinkCount = data.links.length
  tabBadgeState.set(tab.id, currentState)
  
  // Update badge for active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id === tab.id) {
    await updateBadgeForTab(tab.id)
  }
  
  // Notify UI about backlink updates
  try {
    chrome.runtime.sendMessage({ type: 'BACKLINKS_UPDATED' })
  } catch (error) {
    // Extension context may be invalid, this is expected
    console.log('Could not send BACKLINKS_UPDATED message to UI')
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // First try to open side panel
    if (chrome.sidePanel && chrome.sidePanel.open && tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId })
      console.log('Side panel opened successfully')
    } else {
      console.log('Side panel API not available or no windowId')
      // Fallback: Try to open in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
    }
  } catch (error) {
    console.error('Error opening side panel:', error)
    // Ultimate fallback: Open in new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
  }
})

// Monitor navigation events to trigger continuous scanning
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only trigger for main frame (not iframes)
  if (details.frameId === 0) {
    await triggerPageScan(details.tabId)
  }
})

// Monitor tab activation to update badges
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadgeForTab(activeInfo.tabId)
})

// Clean up badge state when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBadgeState.delete(tabId)
})

// Trigger page scan for a specific tab
async function triggerPageScan(tabId: number) {
  try {
    console.log(`🔧 Background: Triggering scan for tab ${tabId}`)
    
    // Get tracked URLs
    const storage = await chrome.storage.local.get('trackedUrls')
    const trackedUrls = storage.trackedUrls || []
    
    console.log(`🔧 Background: Found ${trackedUrls.length} tracked URLs:`, trackedUrls)
    
    if (trackedUrls.length === 0) {
      console.log(`🔧 Background: No tracked URLs - clearing badge for tab ${tabId}`)
      await chrome.action.setBadgeText({ text: '', tabId })
      return
    }

    // Inject script to trigger scan
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (urls: string[]) => {
        console.log('🔧 Background Script Injection: Updating scanner with URLs:', urls)
        
        // Update tracked URLs in content script and trigger scan
        if ((window as any).forgeRankScanner) {
          console.log('🔧 Background Script Injection: Found existing scanner - updating and scanning');
          (window as any).forgeRankScanner.trackedUrls = urls;
          
          // Use the new reloadTrackedUrls method if available
          if ((window as any).forgeRankScanner.reloadTrackedUrls) {
            (window as any).forgeRankScanner.reloadTrackedUrls();
          } else {
            (window as any).forgeRankScanner.performScan();
          }
        } else {
          console.log('🔧 Background Script Injection: Scanner not found - will be initialized by content script');
        }
      },
      args: [trackedUrls]
    })
    
    console.log(`🔧 Background: Scan injection completed for tab ${tabId}`)
    
  } catch (error) {
    console.warn(`🔧 Background: Could not inject scan script for tab ${tabId}:`, error)
    // This is expected for restricted pages like chrome://, extension pages, etc.
  }
}

// Periodic check for broken links (Pro feature)
if (chrome.alarms && chrome.alarms.create) {
  chrome.alarms.create('checkBrokenLinks', { periodInMinutes: 60 })

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkBrokenLinks') {
      checkBrokenLinks()
    }
  })
}

async function checkBrokenLinks() {
  const storage = await chrome.storage.local.get(['isPro', 'isAuthenticated'])
  
  if (!storage.isPro || !storage.isAuthenticated) {
    return
  }
  
  // This would check stored backlinks for 404s
  // Implementation depends on having server-side support or using fetch
  console.log('Checking for broken links...')
}

// Export for use in extension
export {}
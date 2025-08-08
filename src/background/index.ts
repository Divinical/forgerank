// Background script for handling extension events - optimized for performance

chrome.runtime.onInstalled.addListener(() => {
  // Set default values
  chrome.storage.local.set({
    trackedUrls: [],
    isAuthenticated: false,
    isPro: false
  })
})

// Simple badge state tracking
const tabBadgeState = new Map<number, number>()

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACKLINKS_FOUND') {
    handleBacklinksFound(message.data, sender.tab)
  } else if (message.type === 'PAGE_SCAN_RESULT') {
    handlePageScanResult(message.data, sender.tab)
  }
})

async function handlePageScanResult(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  const { isTrackedPage, backlinkCount } = data
  
  // Update badge with simple count
  if (backlinkCount > 0) {
    const badgeText = backlinkCount > 99 ? '99+' : backlinkCount.toString()
    await chrome.action.setBadgeText({ text: badgeText, tabId: tab.id })
    await chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId: tab.id })
  } else if (isTrackedPage) {
    await chrome.action.setBadgeText({ text: '●', tabId: tab.id })
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id })
  } else {
    await chrome.action.setBadgeText({ text: '', tabId: tab.id })
  }
  
  // Store count for tab
  tabBadgeState.set(tab.id, backlinkCount)
}

async function handleBacklinksFound(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  // Get current user data
  const storage = await chrome.storage.local.get(['userId', 'isAuthenticated', 'isPro'])
  
  const timestamp = new Date().toISOString()
  
  if (!storage.isAuthenticated) {
    // Store locally for non-authenticated users - just append, don't process
    const { localBacklinks = [] } = await chrome.storage.local.get('localBacklinks')
    
    // Transform links to backlink format
    const newBacklinks = data.links.map((link: any) => ({
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source_url: data.pageUrl,
      source_domain: new URL(data.pageUrl).hostname,
      target_url: link.href,
      anchor_text: link.anchorText || '',
      context_type: link.contextType || 'generic',
      is_broken: false,
      http_status: null,
      first_seen_at: timestamp,
      last_checked_at: timestamp,
      created_at: timestamp
    }))
    
    // Keep only last 100 backlinks for performance
    const allBacklinks = [...localBacklinks, ...newBacklinks].slice(-100)
    
    await chrome.storage.local.set({ localBacklinks: allBacklinks })
    
    // Extract keywords in idle time if on the same page
    if (tab.id && data.pageUrl) {
      // Store page content for later keyword extraction in UI
      const { localKeywordSources = {} } = await chrome.storage.local.get('localKeywordSources')
      localKeywordSources[data.pageUrl] = {
        url: data.pageUrl,
        title: data.pageTitle,
        timestamp
      }
      await chrome.storage.local.set({ localKeywordSources })
    }
  } else {
    // For authenticated users, store as pending for sync
    const { pendingBacklinks = [] } = await chrome.storage.local.get('pendingBacklinks')
    
    const newPending = data.links.map((link: any) => ({
      ...link,
      sourceUrl: data.pageUrl,
      sourceTitle: data.pageTitle,
      tabId: tab.id,
      userId: storage.userId,
      timestamp
    }))
    
    // Keep only last 50 pending for performance
    const allPending = [...pendingBacklinks, ...newPending].slice(-50)
    
    await chrome.storage.local.set({ pendingBacklinks: allPending })
  }
  
  // Update badge
  tabBadgeState.set(tab.id, data.links.length)
  const badgeText = data.links.length > 99 ? '99+' : data.links.length.toString()
  await chrome.action.setBadgeText({ text: badgeText, tabId: tab.id })
  await chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId: tab.id })
  
  // Notify UI about backlink updates
  try {
    chrome.runtime.sendMessage({ type: 'BACKLINKS_UPDATED' })
  } catch (error) {
    // Extension context may be invalid, this is expected
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Try to open side panel
    if (chrome.sidePanel && chrome.sidePanel.open && tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } else {
      // Fallback: Open in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
    }
  } catch (error) {
    // Ultimate fallback: Open in new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
  }
})

// Monitor navigation to trigger scanning
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only trigger for main frame
  if (details.frameId === 0) {
    await triggerPageScan(details.tabId)
  }
})

// Monitor tab activation to update badges
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const count = tabBadgeState.get(activeInfo.tabId) || 0
  if (count > 0) {
    const badgeText = count > 99 ? '99+' : count.toString()
    await chrome.action.setBadgeText({ text: badgeText, tabId: activeInfo.tabId })
    await chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId: activeInfo.tabId })
  } else {
    await chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId })
  }
})

// Clean up badge state when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBadgeState.delete(tabId)
})

// Trigger page scan for a specific tab
async function triggerPageScan(tabId: number) {
  try {
    // Get tracked URLs
    const storage = await chrome.storage.local.get('trackedUrls')
    const trackedUrls = storage.trackedUrls || []
    
    if (trackedUrls.length === 0) {
      await chrome.action.setBadgeText({ text: '', tabId })
      return
    }

    // Inject script to trigger scan
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (urls: string[]) => {
        // Update tracked URLs in content script and trigger scan
        if ((window as any).forgeRankScanner) {
          (window as any).forgeRankScanner.trackedUrls = urls;
          
          // Use the reloadTrackedUrls method if available
          if ((window as any).forgeRankScanner.reloadTrackedUrls) {
            (window as any).forgeRankScanner.reloadTrackedUrls();
          } else {
            (window as any).forgeRankScanner.performScan();
          }
        }
      },
      args: [trackedUrls]
    })
  } catch (error) {
    // This is expected for restricted pages like chrome://, extension pages, etc.
  }
}

// Periodic sync for pending backlinks (authenticated users)
chrome.alarms.create('syncPendingBacklinks', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncPendingBacklinks') {
    const { pendingBacklinks = [], isAuthenticated } = await chrome.storage.local.get(['pendingBacklinks', 'isAuthenticated'])
    
    if (isAuthenticated && pendingBacklinks.length > 0) {
      // Send message to UI to sync pending backlinks
      try {
        chrome.runtime.sendMessage({ type: 'SYNC_PENDING_BACKLINKS', data: pendingBacklinks })
        // Clear pending after sending
        await chrome.storage.local.set({ pendingBacklinks: [] })
      } catch (error) {
        // UI may not be open, keep pending for next sync
      }
    }
  }
})

// Export for use in extension
export {}
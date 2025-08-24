// Minimal background script - only message passing and storage
// All processing moved to UI thread

// Simple initialization
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    trackedUrls: [],
    localBacklinks: [],
    isAuthenticated: false
  })
})

// Badge tracking
const tabBadges = new Map<number, number>()

// Message handler - just store and notify
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab?.id) return
  
  switch(message.type) {
    case 'BACKLINKS_FOUND':
      handleBacklinksFound(message.data, sender.tab.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('BG: handleBacklinksFound failed:', error)
          sendResponse({ ok: false, error: error.message })
        })
      return true // Keep message port open for async response
    case 'PAGE_SCAN_RESULT':
      updateBadge(message.data, sender.tab.id)
      sendResponse({ ok: true })
      break
  }
})

async function handleBacklinksFound(data: any, tabId: number) {
  const { localBacklinks = [], localKeywordSources = {} } = await chrome.storage.local.get(['localBacklinks', 'localKeywordSources'])
  
  // Minimal dedupe using Set keyed by source_url|target_url
  const existingKeys = new Set(
    localBacklinks.map((bl: any) => 
      `${bl.source_url || bl.sourceUrl || ''}|${bl.target_url || bl.targetUrl || bl.href || ''}`
    )
  )
  
  // Filter incoming links against existing keys
  const uniqueIncomingLinks = data.links.filter((bl: any) => {
    const key = `${bl.source_url || bl.sourceUrl || ''}|${bl.target_url || bl.targetUrl || bl.href || ''}`
    return !existingKeys.has(key)
  })
  
  // Append unique links and cap at 500
  const newBacklinks = [...localBacklinks, ...uniqueIncomingLinks].slice(-500)
  await chrome.storage.local.set({ 
    localBacklinks: newBacklinks,
    lastBacklinkUpdate: Date.now() 
  })

  // Collect page content for keyword extraction if we have new backlinks
  if (uniqueIncomingLinks.length > 0) {
    try {
      // Get current tab info
      const tab = await chrome.tabs.get(tabId)
      const currentUrl = tab.url
      
      if (!currentUrl) return // Skip if no URL available
      
      // Only collect content if we don't already have it and it's not too old
      const existingContent = localKeywordSources[currentUrl]
      const isContentStale = !existingContent || (Date.now() - existingContent.timestamp > 24 * 60 * 60 * 1000) // 24 hours
      
      if (isContentStale) {
        // Request page content from content script
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' })
        if (response?.content) {
          localKeywordSources[currentUrl] = {
            content: response.content,
            timestamp: Date.now(),
            title: response.title || tab.title || ''
          }
          await chrome.storage.local.set({ localKeywordSources })
          console.log(`BG: Stored page content for ${currentUrl} (${response.content.length} chars)`)
          
          // Notify UI that new keyword sources are available
          chrome.runtime.sendMessage({ type: 'KEYWORD_SOURCES_UPDATED' }).catch(() => {
            // UI might not be open
          })
        }
      }
    } catch (error: any) {
      console.log('BG: Failed to collect page content:', error?.message || error)
      // Don't block backlink processing if content collection fails
    }
  }
  
  // Update badge
  const count = data.links.length
  if (count > 0) {
    tabBadges.set(tabId, (tabBadges.get(tabId) || 0) + count)
    const total = tabBadges.get(tabId) || 0
    chrome.action.setBadgeText({ 
      text: total > 99 ? '99+' : total.toString(), 
      tabId 
    })
    chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId })
  }
  
  // Notify UI to refresh
  chrome.runtime.sendMessage({ type: 'BACKLINKS_UPDATED' }).catch(() => {
    // UI might not be open
  })
}

function updateBadge(data: any, tabId: number) {
  const { isTrackedPage, backlinkCount } = data
  
  if (backlinkCount > 0) {
    tabBadges.set(tabId, backlinkCount)
    chrome.action.setBadgeText({ 
      text: backlinkCount > 99 ? '99+' : backlinkCount.toString(), 
      tabId 
    })
    chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId })
  } else if (isTrackedPage) {
    chrome.action.setBadgeText({ text: '●', tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId })
  } else {
    chrome.action.setBadgeText({ text: '', tabId })
  }
}

// Handle icon click - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId })
    } catch {
      chrome.tabs.create({ url: 'index.html' })
    }
  } else {
    chrome.tabs.create({ url: 'index.html' })
  }
})

// Re-inject scanner when navigating
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return
  
  const { trackedUrls = [] } = await chrome.storage.local.get('trackedUrls')
  if (trackedUrls.length === 0) return
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      func: (urls) => {
        if ((window as any).forgeRankScanner) {
          (window as any).forgeRankScanner.trackedUrls = urls;
          (window as any).forgeRankScanner.performScan();
        }
      },
      args: [trackedUrls]
    })
  } catch {
    // Expected for restricted pages
  }
})

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBadges.delete(tabId)
})

export {}
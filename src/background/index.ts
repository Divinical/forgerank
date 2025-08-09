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
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id) return
  
  switch(message.type) {
    case 'BACKLINKS_FOUND':
      handleBacklinksFound(message.data, sender.tab.id)
      break
    case 'PAGE_SCAN_RESULT':
      updateBadge(message.data, sender.tab.id)
      break
  }
})

async function handleBacklinksFound(data: any, tabId: number) {
  // Just store the raw data - no processing
  const { localBacklinks = [] } = await chrome.storage.local.get('localBacklinks')
  
  // Simple append with limit
  const newBacklinks = [...localBacklinks, ...data.links].slice(-500)
  await chrome.storage.local.set({ 
    localBacklinks: newBacklinks,
    lastBacklinkUpdate: Date.now() 
  })
  
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
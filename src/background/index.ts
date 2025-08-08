// src/background/index.ts - OPTIMIZED VERSION
// Background script - minimal processing, just message passing and storage

chrome.runtime.onInstalled.addListener(() => {
  // Set minimal defaults
  chrome.storage.local.set({
    trackedUrls: [],
    isAuthenticated: false
  })
})

// Simple badge tracking
const tabBadges = new Map<number, number>()

// Handle messages - just store, don't process
chrome.runtime.onMessage.addListener((message, sender) => {
  switch(message.type) {
    case 'BACKLINKS_FOUND':
      storeBacklinks(message.data, sender.tab)
      break
    case 'PAGE_SCAN_RESULT':
      updateBadge(message.data, sender.tab)
      break
  }
})

async function storeBacklinks(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  const timestamp = new Date().toISOString()
  const { localBacklinks = [] } = await chrome.storage.local.get('localBacklinks')
  
  // Just store raw data - let UI process it
  const newBacklinks = data.links.map((link: any) => ({
    ...link,
    source_url: data.pageUrl,
    source_domain: new URL(data.pageUrl).hostname,
    timestamp
  }))
  
  // Simple append with size limit
  const updated = [...localBacklinks, ...newBacklinks].slice(-100)
  await chrome.storage.local.set({ localBacklinks: updated })
  
  // Update badge
  updateBadgeCount(tab.id, data.links.length)
  
  // Notify UI
  try {
    chrome.runtime.sendMessage({ type: 'BACKLINKS_UPDATED' })
  } catch (e) {
    // UI might not be open
  }
}

async function updateBadge(data: any, tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id) return
  
  const { isTrackedPage, backlinkCount } = data
  
  if (backlinkCount > 0) {
    updateBadgeCount(tab.id, backlinkCount)
  } else if (isTrackedPage) {
    chrome.action.setBadgeText({ text: '●', tabId: tab.id })
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id })
  } else {
    chrome.action.setBadgeText({ text: '', tabId: tab.id })
  }
}

function updateBadgeCount(tabId: number, count: number) {
  tabBadges.set(tabId, count)
  const text = count > 99 ? '99+' : count.toString()
  chrome.action.setBadgeText({ text, tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#f97316', tabId })
}

// Handle icon click
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

// Simplified navigation listener
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) {
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
  }
})

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBadges.delete(tabId)
})

export {}
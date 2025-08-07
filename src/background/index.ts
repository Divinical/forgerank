// Background script for handling extension events

chrome.runtime.onInstalled.addListener(() => {
  console.log('ForgeRank extension installed')
  
  // Set default values
  chrome.storage.local.set({
    trackedUrls: [],
    isAuthenticated: false,
    isPro: false
  })
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BACKLINKS_FOUND') {
    handleBacklinksFound(message.data, sender.tab)
  }
})

async function handleBacklinksFound(data: any, tab: chrome.tabs.Tab | undefined) {
  // Get current user data
  const storage = await chrome.storage.local.get(['userId', 'isAuthenticated', 'isPro'])
  
  if (!storage.isAuthenticated) {
    // Store locally for non-authenticated users
    const localBacklinks = await chrome.storage.local.get('localBacklinks') || {}
    const backlinks = localBacklinks.localBacklinks || []
    
    // Add new backlinks
    data.links.forEach((link: any) => {
      backlinks.push({
        ...link,
        sourceUrl: data.pageUrl,
        sourceTitle: data.pageTitle,
        tabId: tab?.id
      })
    })
    
    // Keep only last 100 backlinks for free users
    const trimmedBacklinks = backlinks.slice(-100)
    
    await chrome.storage.local.set({ localBacklinks: trimmedBacklinks })
  } else {
    // For authenticated users, we'll sync with Supabase
    // This will be handled by the extension UI when it queries storage
    const authenticatedBacklinks = await chrome.storage.local.get('pendingBacklinks') || {}
    const pending = authenticatedBacklinks.pendingBacklinks || []
    
    data.links.forEach((link: any) => {
      pending.push({
        ...link,
        sourceUrl: data.pageUrl,
        sourceTitle: data.pageTitle,
        tabId: tab?.id,
        userId: storage.userId
      })
    })
    
    await chrome.storage.local.set({ pendingBacklinks: pending })
  }
  
  // Update badge to show new backlinks found
  if (data.links.length > 0) {
    chrome.action.setBadgeText({ text: data.links.length.toString() })
    chrome.action.setBadgeBackgroundColor({ color: '#f97316' })
    
    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' })
    }, 3000)
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open side panel
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// Monitor tab updates to trigger scans
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if we should scan this page
    chrome.storage.local.get('trackedUrls', (result) => {
      if (result.trackedUrls && result.trackedUrls.length > 0) {
        // Content script will automatically run due to manifest
        console.log('Page loaded, content script will scan:', tab.url)
      }
    })
  }
})

// Periodic check for broken links (Pro feature)
chrome.alarms.create('checkBrokenLinks', { periodInMinutes: 60 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkBrokenLinks') {
    checkBrokenLinks()
  }
})

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
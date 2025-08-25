// Minimal background script - only message passing and storage
// All processing moved to UI thread

// Utility for sending messages to tabs with retry logic
async function sendTabMessageWithRetry(tabId: number, message: any, maxRetries: number = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message)
      return true
    } catch (error) {
      if (attempt === maxRetries) {
        console.log(`BG: Failed to send message to tab ${tabId} after ${maxRetries} attempts`)
        return false
      }
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 50 * attempt))
    }
  }
  return false
}

// Enhanced initialization - fixes extension reload scanning
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    trackedUrls: [],
    localBacklinks: [],
    isAuthenticated: false
  })
})

// Re-inject content scripts into all existing tabs on startup (fixes extension reload)
chrome.runtime.onStartup.addListener(async () => {
  await reinjectContentScripts()
})

// Also run when extension is reloaded during development
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    // Add delay to let the extension UI initialize and sync storage
    setTimeout(async () => {
      await reinjectContentScripts()
    }, 2000) // Wait 2 seconds
  }
})

async function reinjectContentScripts() {
  try {
    console.log('BG: Re-injecting content scripts into existing tabs...')
    
    // Debug: check what's actually in storage
    const storageData = await chrome.storage.local.get(null)
    console.log('BG: ALL storage data:', storageData)
    
    const { trackedUrls = [] } = await chrome.storage.local.get('trackedUrls')
    console.log('BG: trackedUrls from storage:', trackedUrls)
    
    // Always inject content scripts, even if no URLs are tracked yet
    // This ensures scanners are ready when URLs are added during onboarding
    
    // Get all tabs
    const tabs = await chrome.tabs.query({})
    let injected = 0
    
    for (const tab of tabs) {
      if (!tab.id || !tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('moz-extension://') ||
          tab.url.startsWith('about:')) {
        continue
      }
      
      try {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        })
        
        // Initialize scanner with current tracked URLs
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (urls) => {
            console.log('CS: Re-injected into tab, initializing with', urls.length, 'tracked URLs')
            if ((window as any).forgeRankScanner) {
              (window as any).forgeRankScanner.trackedUrls = urls;
              (window as any).forgeRankScanner.performScan();
            }
          },
          args: [trackedUrls]
        })
        
        injected++
      } catch (error) {
        // Expected for restricted pages or already injected tabs
        console.log(`BG: Could not inject into tab ${tab.id} (${tab.url}) - this is normal`)
      }
    }
    
    console.log(`BG: Successfully re-injected content scripts into ${injected} tabs`)
    return injected
  } catch (error) {
    console.error('BG: Failed to re-inject content scripts:', error)
    return 0
  }
}

// Send reload messages to existing tabs without re-injection
async function reloadExistingScannersWithNewUrls(trackedUrls: string[]) {
  try {
    console.log('BG: Reloading existing scanners with new URLs...')
    
    const tabs = await chrome.tabs.query({})
    let reloaded = 0
    
    for (const tab of tabs) {
      if (!tab.id || !tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('moz-extension://') ||
          tab.url.startsWith('about:')) {
        continue
      }
      
      // Try to send reload message to existing scanner with retry
      const success = await sendTabMessageWithRetry(tab.id, {
        type: 'RELOAD_SCANNER_STATE',
        trackedUrls
      })
      
      if (success) {
        reloaded++
      } else {
        console.log(`BG: No scanner to reload in tab ${tab.id} - this is normal`)
      }
    }
    
    console.log(`BG: Successfully reloaded ${reloaded} existing scanners`)
    return reloaded
  } catch (error) {
    console.error('BG: Failed to reload existing scanners:', error)
    return 0
  }
}

// Badge tracking
const tabBadges = new Map<number, number>()

// Message handler - just store and notify
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch(message.type) {
    case 'BACKLINKS_FOUND':
      if (!sender.tab?.id) return
      handleBacklinksFound(message.data, sender.tab.id)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('BG: handleBacklinksFound failed:', error)
          sendResponse({ ok: false, error: error.message })
        })
      return true // Keep message port open for async response
    case 'PAGE_SCAN_RESULT':
      if (!sender.tab?.id) return
      updateBadge(message.data, sender.tab.id)
      sendResponse({ ok: true })
      break
    case 'TRACKED_URLS_UPDATED':
      // UI has updated tracked URLs - trigger content script injection AND immediate rescan
      console.log('BG: Received TRACKED_URLS_UPDATED with', message.trackedUrls.length, 'URLs')
      
      // Store the URLs for future content script injections
      chrome.storage.local.set({ trackedUrls: message.trackedUrls })
      
      Promise.all([
        reinjectContentScripts(),
        reloadExistingScannersWithNewUrls(message.trackedUrls)
      ])
        .then(([injectedCount, reloadedCount]) => {
          console.log(`BG: Successfully processed TRACKED_URLS_UPDATED: injected=${injectedCount}, reloaded=${reloadedCount}`)
          sendResponse({ 
            ok: true, 
            injected: injectedCount || 0, 
            reloaded: reloadedCount || 0 
          })
        })
        .catch((error) => {
          console.error('BG: Failed to update after URL change:', error)
          sendResponse({ ok: false, error: error.message })
        })
      return true // Keep message port open for async response
    case 'FORCE_REINJECT_CONTENT_SCRIPTS':
      console.log('BG: Received FORCE_REINJECT_CONTENT_SCRIPTS - attempting recovery')
      reinjectContentScripts()
        .then((injected) => {
          console.log(`BG: Recovery injection completed: ${injected} tabs`)
          sendResponse({ ok: true, injected })
        })
        .catch((error) => {
          console.error('BG: Recovery injection failed:', error)
          sendResponse({ ok: false, error: error.message })
        })
      return true
    case 'START_COMPETITOR_SCAN':
      handleCompetitorScan(message.siteId, message.url)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
          console.error('BG: Competitor scan failed:', error)
          sendResponse({ ok: false, error: error.message })
        })
      return true
    case 'PAUSE_COMPETITOR_SCAN':
      handlePauseCompetitorScan(message.siteId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }))
      return true
  }
})

async function handleBacklinksFound(data: any, tabId: number) {
  const { localBacklinks = [], localKeywordSources = {} } = await chrome.storage.local.get(['localBacklinks', 'localKeywordSources'])
  
  // Enhanced deduplication using normalized URLs and anchor text
  const existingKeys = new Set(
    localBacklinks.map((bl: any) => {
      const sourceUrl = normalizeUrl(bl.source_url || bl.sourceUrl || '')
      const targetUrl = normalizeUrl(bl.target_url || bl.targetUrl || bl.href || '')
      const anchorText = (bl.anchor_text || '').toLowerCase().trim()
      return `${sourceUrl}|${targetUrl}|${anchorText}`
    }).filter((key: string) => key !== '||') // Remove empty keys
  )
  
  // Filter incoming links against existing keys with normalized URLs
  const uniqueIncomingLinks = data.links.filter((bl: any) => {
    const sourceUrl = normalizeUrl(bl.source_url || bl.sourceUrl || '')
    const targetUrl = normalizeUrl(bl.target_url || bl.targetUrl || bl.href || '')
    const anchorText = (bl.anchor_text || '').toLowerCase().trim()
    const key = `${sourceUrl}|${targetUrl}|${anchorText}`
    
    // Skip if empty or already exists
    return key !== '||' && !existingKeys.has(key)
  }).map((bl: any) => {
    // Normalize URLs in the backlink object itself
    return {
      ...bl,
      source_url: normalizeUrl(bl.source_url || bl.sourceUrl || ''),
      target_url: normalizeUrl(bl.target_url || bl.targetUrl || bl.href || ''),
      target_domain: (() => {
        try {
          return new URL(normalizeUrl(bl.target_url || bl.targetUrl || bl.href || '')).hostname
        } catch {
          return bl.target_domain || ''
        }
      })()
    }
  })
  
  // Append unique links and cap based on user tier
  // TODO: Get user tier from storage to apply proper limits (50 for Starter, unlimited for Growth)
  // For now, cap at 500 to prevent storage bloat
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

// Enhanced navigation handling - fixes the core scanning bug
async function refreshScannerState(tabId: number, _url?: string) {
  const { trackedUrls = [] } = await chrome.storage.local.get('trackedUrls')
  if (trackedUrls.length === 0) return
  
  try {
    // First try to update existing scanner
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (urls) => {
        if ((window as any).forgeRankScanner) {
          (window as any).forgeRankScanner.trackedUrls = urls
          ;(window as any).forgeRankScanner.refreshState()
          return { updated: true }
        }
        return { updated: false }
      },
      args: [trackedUrls]
    })
  } catch (error) {
    // Scanner doesn't exist or page is restricted - this is expected
    console.log('BG: Scanner update failed for tab', tabId, '- this is normal')
  }
}

// Handle tab URL changes (main fix for navigation scanning)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL actually changes and page is complete
  if (changeInfo.status === 'complete' && changeInfo.url && tab.url) {
    await refreshScannerState(tabId, tab.url)
  }
})

// Re-inject scanner when navigating (keep existing for full page loads)
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return
  await refreshScannerState(details.tabId, details.url)
})

// Handle SPA navigation and hash changes
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  if (details.frameId !== 0) return
  await refreshScannerState(details.tabId, details.url)
})

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBadges.delete(tabId)
})

// Periodic scanner health check (fixes scanner state drift)
setInterval(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true })
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        await refreshScannerState(tab.id, tab.url)
      }
    }
  } catch (error) {
    // Silent fail - extension context may be invalidated
  }
}, 30000) // Every 30 seconds

// Smart Site Scanning - Zero-cost browser-based competitor intelligence
const activeScanners = new Map<string, { cancelled: boolean }>()

async function handleCompetitorScan(siteId: string, siteUrl: string) {
  console.log('BG: Starting competitor scan for', siteId, siteUrl)
  
  // Cancel any existing scan for this site
  const existing = activeScanners.get(siteId)
  if (existing) {
    existing.cancelled = true
  }
  
  // Create new scanner controller
  const scanController = { cancelled: false }
  activeScanners.set(siteId, scanController)
  
  // Update site status to scanning
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SCAN_STATUS',
    siteId,
    status: 'scanning',
    progress: 0
  })
  
  try {
    // Create new tab for scanning (invisible)
    const tab = await chrome.tabs.create({
      url: siteUrl,
      active: false
    })
    
    if (!tab.id) throw new Error('Failed to create tab')
    
    // Wait for page to load
    await waitForTabLoad(tab.id)
    
    if (scanController.cancelled) {
      chrome.tabs.remove(tab.id)
      return
    }
    
    // Start crawling process
    await crawlCompetitorSite(tab.id, siteId, siteUrl, scanController)
    
  } catch (error: any) {
    console.error('BG: Competitor scan error:', error)
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SCAN_STATUS',
      siteId,
      status: 'error',
      errorMessage: error.message || 'Scan failed'
    })
  } finally {
    activeScanners.delete(siteId)
  }
}

async function handlePauseCompetitorScan(siteId: string) {
  const scanner = activeScanners.get(siteId)
  if (scanner) {
    scanner.cancelled = true
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SCAN_STATUS',
      siteId,
      status: 'paused'
    })
  }
}

async function waitForTabLoad(tabId: number, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Tab load timeout'))
    }, timeout)
    
    const listener = (updatedTabId: number, changeInfo: any) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function crawlCompetitorSite(
  tabId: number, 
  siteId: string, 
  baseUrl: string, 
  controller: { cancelled: boolean }
) {
  console.log('BG: Starting competitor intelligence analysis of', baseUrl)
  
  try {
    // Extract comprehensive competitor intelligence
    const intelligenceData = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Extract meta keywords and description
        const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || ''
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
        const title = document.title || ''
        
        // Extract all external links for partnership/directory analysis
        const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
        const externalLinks = links
          .filter(link => {
            try {
              const linkUrl = new URL(link.href)
              const currentDomain = window.location.hostname
              return linkUrl.hostname !== currentDomain && 
                     !link.href.startsWith('javascript:') &&
                     !link.href.startsWith('#') &&
                     link.href.length > 10
            } catch {
              return false
            }
          })
          .map(link => ({
            href: link.href,
            text: link.textContent?.trim() || '',
            title: link.title || '',
            domain: (() => {
              try {
                return new URL(link.href).hostname
              } catch {
                return ''
              }
            })()
          }))
        
        // Extract social media profiles
        const socialProfiles = links
          .filter(link => {
            const href = link.href.toLowerCase()
            return href.includes('twitter.com') || 
                   href.includes('linkedin.com') ||
                   href.includes('facebook.com') ||
                   href.includes('instagram.com') ||
                   href.includes('youtube.com') ||
                   href.includes('github.com')
          })
          .map(link => ({
            platform: (() => {
              const href = link.href.toLowerCase()
              if (href.includes('twitter.com')) return 'Twitter'
              if (href.includes('linkedin.com')) return 'LinkedIn'
              if (href.includes('facebook.com')) return 'Facebook'
              if (href.includes('instagram.com')) return 'Instagram'
              if (href.includes('youtube.com')) return 'YouTube'
              if (href.includes('github.com')) return 'GitHub'
              return 'Other'
            })(),
            url: link.href,
            text: link.textContent?.trim() || ''
          }))
        
        // Extract directory/listing indicators
        const directoryLinks = externalLinks.filter(link => {
          const domain = link.domain.toLowerCase()
          const text = link.text.toLowerCase()
          return domain.includes('directory') ||
                 domain.includes('listing') ||
                 text.includes('directory') ||
                 text.includes('listing') ||
                 text.includes('featured in') ||
                 text.includes('as seen on')
        })
        
        // Extract content headings for keyword analysis
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map(h => h.textContent?.trim() || '')
          .filter(text => text.length > 0)
        
        // Extract key content phrases (potential target keywords)
        const content = document.body?.textContent || ''
        const sentences = content.split(/[.!?]+/).slice(0, 50) // First 50 sentences
        
        return {
          title,
          url: window.location.href,
          metaKeywords,
          metaDescription,
          externalLinks: externalLinks.slice(0, 100), // Limit for performance
          socialProfiles,
          directoryLinks,
          headings: headings.slice(0, 20),
          contentSample: sentences.join('. ').slice(0, 2000),
          linkCount: {
            total: links.length,
            external: externalLinks.length,
            social: socialProfiles.length,
            directory: directoryLinks.length
          }
        }
      }
    })
    
    if (!intelligenceData[0]?.result) {
      throw new Error('Failed to extract competitor intelligence')
    }
    
    const intelligence = intelligenceData[0].result
    console.log(`BG: Extracted intelligence from ${intelligence.url}:`, {
      totalLinks: intelligence.linkCount.total,
      externalLinks: intelligence.linkCount.external,
      socialProfiles: intelligence.linkCount.social,
      directories: intelligence.linkCount.directory
    })
    
    // Process and categorize the intelligence
    const competitorIntelligence = {
      id: siteId,
      url: intelligence.url,
      title: intelligence.title,
      scannedAt: new Date().toISOString(),
      
      // SEO Intelligence
      seo: {
        metaKeywords: intelligence.metaKeywords,
        metaDescription: intelligence.metaDescription,
        headings: intelligence.headings,
        targetKeywords: extractKeywords(intelligence.contentSample, intelligence.metaKeywords)
      },
      
      // Link Intelligence
      partnerships: categorizePartnerLinks(intelligence.externalLinks),
      directories: intelligence.directoryLinks,
      socialPresence: intelligence.socialProfiles,
      
      // Opportunity Analysis
      opportunities: analyzeOpportunities(intelligence),
      
      // Summary Stats
      stats: intelligence.linkCount
    }
    
    // Store intelligence data
    await chrome.runtime.sendMessage({
      type: 'COMPETITOR_INTELLIGENCE_FOUND',
      siteId,
      intelligence: competitorIntelligence
    })
    
    // Update progress - intelligence extracted
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SCAN_STATUS',
      siteId,
      status: 'scanning',
      progress: 80,
      foundIntelligence: true
    })
    
    // Find additional high-value pages for deeper intelligence gathering
    const additionalPagesData = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const links = Array.from(document.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>)
        return links
          .filter(link => {
            try {
              const linkUrl = new URL(link.href)
              return linkUrl.hostname === window.location.hostname &&
                     (link.href.includes('about') || 
                      link.href.includes('team') || 
                      link.href.includes('contact') ||
                      link.href.includes('partners') ||
                      (link.textContent || '').toLowerCase().includes('about') ||
                      (link.textContent || '').toLowerCase().includes('team'))
            } catch {
              return false
            }
          })
          .map(link => ({
            href: link.href,
            text: link.textContent?.trim() || ''
          }))
          .slice(0, 2) // Limit to 2 additional pages
      }
    })
    
    const internalPages = additionalPagesData[0]?.result || []
    
    // Quick scan of key internal pages for additional intelligence
    let pagesAnalyzed = 1
    for (const internalPage of internalPages) {
      if (controller.cancelled) break
      
      try {
        // Navigate to internal page
        await chrome.tabs.update(tabId, { url: internalPage.href })
        await waitForTabLoad(tabId, 5000)
        
        // Extract additional intelligence from this page
        const additionalData = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const content = document.body?.textContent || ''
            const title = document.title || ''
            
            // Look for team information
            const teamInfo = content.toLowerCase().includes('team') || 
                           content.toLowerCase().includes('founder') ||
                           content.toLowerCase().includes('ceo')
            
            // Look for company information
            const companyInfo = content.toLowerCase().includes('founded') ||
                              content.toLowerCase().includes('established') ||
                              content.toLowerCase().includes('since')
                              
            return {
              url: window.location.href,
              title,
              hasTeamInfo: teamInfo,
              hasCompanyInfo: companyInfo,
              contentLength: content.length
            }
          }
        })
        
        if (additionalData[0]?.result) {
          const pageData = additionalData[0].result
          
          // Enhance intelligence with additional page data
          if (pageData.hasTeamInfo) {
            competitorIntelligence.opportunities.push('Team page found - research key personnel')
          }
          
          if (pageData.hasCompanyInfo) {
            competitorIntelligence.opportunities.push('Company info page found - analyze founding story')
          }
        }
        
        pagesAnalyzed++
        const progress = Math.min(95, 80 + (pagesAnalyzed / (internalPages.length + 1)) * 15)
        
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SCAN_STATUS',
          siteId,
          status: 'scanning',
          progress: Math.round(progress)
        })
        
      } catch (error) {
        console.log('BG: Failed to analyze internal page:', internalPage.href, error)
      }
    }
    
    // Complete scan
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SCAN_STATUS',
      siteId,
      status: 'completed',
      progress: 100,
      intelligenceGathered: true,
      totalPages: pagesAnalyzed
    })
    
    console.log(`BG: Competitor intelligence scan completed. Analyzed ${pagesAnalyzed} pages and gathered comprehensive competitor intelligence`)
    
  } finally {
    // Clean up tab
    try {
      chrome.tabs.remove(tabId)
    } catch (error) {
      console.log('BG: Failed to clean up tab:', error)
    }
  }
}

// URL normalization function (matches content script)
function normalizeUrl(url: string, baseUrl?: string): string {
  if (!url) return ''
  
  try {
    const absoluteUrl = new URL(url, baseUrl)
    let normalized = absoluteUrl.href.toLowerCase()
    
    // Remove trailing slash (except root)
    if (normalized.endsWith('/') && normalized !== absoluteUrl.origin + '/') {
      normalized = normalized.slice(0, -1)
    }
    
    // Remove www. for consistency
    normalized = normalized.replace('://www.', '://')
    
    return normalized
  } catch {
    return ''
  }
}


// Helper functions for competitor intelligence processing
function extractKeywords(content: string, metaKeywords: string): string[] {
  const keywords = new Set<string>()
  
  // Add meta keywords
  if (metaKeywords) {
    metaKeywords.split(',').forEach(keyword => {
      const clean = keyword.trim().toLowerCase()
      if (clean.length > 2) keywords.add(clean)
    })
  }
  
  // Extract key phrases from content using simple pattern matching
  const phrases = content.toLowerCase()
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 20 && sentence.length < 100)
    .slice(0, 20)
  
  // Look for repeated important words/phrases
  const wordCount: Record<string, number> = {}
  phrases.forEach(phrase => {
    phrase.split(/\s+/).forEach(word => {
      const clean = word.replace(/[^\w]/g, '').toLowerCase()
      if (clean.length > 3 && clean.length < 20) {
        wordCount[clean] = (wordCount[clean] || 0) + 1
      }
    })
  })
  
  // Add frequently mentioned words as potential keywords
  Object.entries(wordCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([word]) => keywords.add(word))
  
  return Array.from(keywords).slice(0, 15)
}

function categorizePartnerLinks(externalLinks: any[]): any[] {
  return externalLinks.filter(link => {
    const domain = link.domain.toLowerCase()
    const text = link.text.toLowerCase()
    
    // Filter for potential partnerships/mentions
    return text.includes('partner') ||
           text.includes('sponsor') ||
           text.includes('client') ||
           text.includes('featured') ||
           text.includes('powered by') ||
           text.includes('built by') ||
           domain.includes('partner') ||
           domain.includes('client')
  }).map(link => ({
    ...link,
    category: (() => {
      const text = link.text.toLowerCase()
      if (text.includes('partner')) return 'Partnership'
      if (text.includes('sponsor')) return 'Sponsorship'
      if (text.includes('client')) return 'Client'
      if (text.includes('featured')) return 'Feature'
      return 'Other'
    })()
  }))
}

function analyzeOpportunities(intelligence: any): string[] {
  const opportunities = []
  
  if (intelligence.socialProfiles.length > 0) {
    opportunities.push(`Follow their social strategy: Found ${intelligence.socialProfiles.length} social profiles`)
  }
  
  if (intelligence.directoryLinks.length > 0) {
    opportunities.push(`Directory submissions: ${intelligence.directoryLinks.length} potential directories found`)
  }
  
  const blogLinks = intelligence.externalLinks.filter((link: any) => 
    link.domain.includes('blog') || link.text.toLowerCase().includes('blog')
  )
  if (blogLinks.length > 0) {
    opportunities.push(`Guest blogging: ${blogLinks.length} blog opportunities identified`)
  }
  
  const pressLinks = intelligence.externalLinks.filter((link: any) =>
    link.text.toLowerCase().includes('press') ||
    link.text.toLowerCase().includes('news') ||
    link.text.toLowerCase().includes('media')
  )
  if (pressLinks.length > 0) {
    opportunities.push(`Press coverage: ${pressLinks.length} media opportunities found`)
  }
  
  if (intelligence.metaKeywords) {
    opportunities.push(`SEO targeting: ${intelligence.metaKeywords.split(',').length} keywords to consider`)
  }
  
  return opportunities
}

export {}
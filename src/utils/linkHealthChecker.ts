// Link Health Checker - HTTP status monitoring for backlinks
// Uses fetch() with proper error handling, rate limiting, and timeout management

export interface HealthCheckResult {
  url: string
  status: 'success' | 'error' | 'timeout' | 'blocked'
  httpStatus?: number
  redirectUrl?: string
  responseTime?: number
  error?: string
  checkedAt: string
}

export interface HealthStats {
  total: number
  healthy: number
  broken: number
  redirected: number
  pending: number
  errorRate: number
}

export class LinkHealthChecker {
  private readonly MAX_CONCURRENT = 3 // Limit concurrent requests
  private readonly REQUEST_DELAY = 500 // Delay between requests (ms)
  private readonly TIMEOUT = 10000 // Request timeout (10 seconds)
  private readonly USER_AGENT = 'ForgeRank/1.0 (+https://forgerank.com/bot)'
  
  private activeRequests = 0

  // Check health of a single URL
  async checkUrl(url: string): Promise<HealthCheckResult> {
    const startTime = performance.now()
    
    try {
      // Validate URL format
      if (!this.isValidUrl(url)) {
        return {
          url,
          status: 'error',
          error: 'Invalid URL format',
          checkedAt: new Date().toISOString()
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT)

      try {
        // Use HEAD request for efficiency (no body download)
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': this.USER_AGENT,
            'Accept': '*/*',
            'Cache-Control': 'no-cache'
          },
          // Follow redirects automatically
          redirect: 'follow'
        })

        clearTimeout(timeoutId)
        const responseTime = performance.now() - startTime

        const result: HealthCheckResult = {
          url,
          status: 'success',
          httpStatus: response.status,
          responseTime: Math.round(responseTime),
          checkedAt: new Date().toISOString()
        }

        // Check if response was redirected
        if (response.redirected && response.url !== url) {
          result.redirectUrl = response.url
        }

        return result

      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          return {
            url,
            status: 'timeout',
            error: 'Request timed out',
            responseTime: this.TIMEOUT,
            checkedAt: new Date().toISOString()
          }
        }

        // Handle network errors
        return {
          url,
          status: 'error',
          error: fetchError.message || 'Network error',
          responseTime: Math.round(performance.now() - startTime),
          checkedAt: new Date().toISOString()
        }
      }

    } catch (error: any) {
      return {
        url,
        status: 'error',
        error: error.message || 'Unknown error',
        responseTime: Math.round(performance.now() - startTime),
        checkedAt: new Date().toISOString()
      }
    }
  }

  // Check health of multiple URLs with rate limiting
  async checkUrls(urls: string[], onProgress?: (progress: number, result: HealthCheckResult) => void): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = []
    const totalUrls = urls.length

    if (totalUrls === 0) return results

    console.log(`🔍 Starting health check for ${totalUrls} URLs`)

    // Process URLs with concurrency control
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      
      // Wait for available slot
      await this.waitForSlot()
      
      // Execute check
      this.activeRequests++
      const resultPromise = this.checkUrl(url)
        .then(result => {
          results.push(result)
          
          // Report progress
          if (onProgress) {
            const progress = Math.round(((i + 1) / totalUrls) * 100)
            onProgress(progress, result)
          }
          
          console.log(`✅ Checked ${url}: ${result.status} (${result.httpStatus || 'N/A'})`)
          return result
        })
        .finally(() => {
          this.activeRequests--
        })

      // Add delay to respect rate limits
      if (i < urls.length - 1) {
        setTimeout(() => {}, this.REQUEST_DELAY)
      }

      await resultPromise
    }

    console.log(`🏁 Health check completed: ${results.length} URLs processed`)
    return results
  }

  // Batch check with automatic retry for failed requests
  async checkUrlsBatch(urls: string[], options?: {
    retryFailed?: boolean
    maxRetries?: number
    onProgress?: (progress: number, result: HealthCheckResult) => void
  }): Promise<HealthCheckResult[]> {
    const { retryFailed = true, maxRetries = 2, onProgress } = options || {}
    
    let results = await this.checkUrls(urls, onProgress)
    
    if (retryFailed && maxRetries > 0) {
      // Find failed URLs (errors, timeouts, but not broken links)
      const failedUrls = results
        .filter(result => result.status === 'error' || result.status === 'timeout')
        .map(result => result.url)
      
      if (failedUrls.length > 0) {
        console.log(`🔄 Retrying ${failedUrls.length} failed URLs`)
        
        // Retry failed URLs
        const retryResults = await this.checkUrls(failedUrls)
        
        // Replace failed results with retry results
        retryResults.forEach(retryResult => {
          const index = results.findIndex(r => r.url === retryResult.url)
          if (index !== -1) {
            results[index] = retryResult
          }
        })
      }
    }
    
    return results
  }

  // Wait for available request slot
  private async waitForSlot(): Promise<void> {
    while (this.activeRequests >= this.MAX_CONCURRENT) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Validate URL format
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return ['http:', 'https:'].includes(urlObj.protocol)
    } catch {
      return false
    }
  }

  // Get health statistics from results
  getHealthStats(results: HealthCheckResult[]): HealthStats {
    const total = results.length
    const healthy = results.filter(r => r.status === 'success' && r.httpStatus && r.httpStatus >= 200 && r.httpStatus < 300).length
    const redirected = results.filter(r => r.status === 'success' && r.httpStatus && r.httpStatus >= 300 && r.httpStatus < 400).length
    const broken = results.filter(r => 
      (r.status === 'success' && r.httpStatus && r.httpStatus >= 400) ||
      r.status === 'error' ||
      r.status === 'timeout'
    ).length
    const pending = total - (healthy + redirected + broken)
    const errorRate = total > 0 ? Math.round((broken / total) * 100) : 0

    return {
      total,
      healthy,
      broken,
      redirected,
      pending,
      errorRate
    }
  }

  // Determine if URL is considered "broken"
  isBrokenLink(result: HealthCheckResult): boolean {
    if (result.status === 'error' || result.status === 'timeout') {
      return true
    }
    
    if (result.status === 'success' && result.httpStatus) {
      return result.httpStatus >= 400
    }
    
    return false
  }

  // Get status icon for UI display
  getStatusIcon(result: HealthCheckResult): string {
    if (result.status === 'success' && result.httpStatus) {
      if (result.httpStatus >= 200 && result.httpStatus < 300) {
        return '✅' // Healthy
      } else if (result.httpStatus >= 300 && result.httpStatus < 400) {
        return '⚠️' // Redirected
      } else if (result.httpStatus >= 400) {
        return '❌' // Broken
      }
    }
    
    if (result.status === 'timeout') {
      return '⏱️' // Timeout
    }
    
    if (result.status === 'error') {
      return '❌' // Error
    }
    
    return '🔄' // Pending/Unknown
  }

  // Get human-readable status text
  getStatusText(result: HealthCheckResult): string {
    if (result.status === 'success' && result.httpStatus) {
      if (result.httpStatus >= 200 && result.httpStatus < 300) {
        return `OK (${result.httpStatus})`
      } else if (result.httpStatus >= 300 && result.httpStatus < 400) {
        return `Redirected (${result.httpStatus})`
      } else if (result.httpStatus >= 400 && result.httpStatus < 500) {
        return `Not Found (${result.httpStatus})`
      } else if (result.httpStatus >= 500) {
        return `Server Error (${result.httpStatus})`
      }
    }
    
    if (result.status === 'timeout') {
      return 'Timeout'
    }
    
    if (result.status === 'error') {
      return result.error || 'Error'
    }
    
    return 'Checking...'
  }

  // Check if enough time has passed since last check (avoid spam)
  shouldRecheck(lastChecked: string, intervalHours: number = 24): boolean {
    try {
      const lastCheck = new Date(lastChecked)
      const now = new Date()
      const hoursSinceCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60)
      return hoursSinceCheck >= intervalHours
    } catch {
      return true // If invalid date, allow recheck
    }
  }

  // Extract unique domains from URLs for rate limiting considerations
  getDomainStats(urls: string[]): Map<string, number> {
    const domainCounts = new Map<string, number>()
    
    urls.forEach(url => {
      try {
        const domain = new URL(url).hostname
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
      } catch {
        // Skip invalid URLs
      }
    })
    
    return domainCounts
  }
}
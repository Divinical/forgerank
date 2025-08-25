// CSV Export Utility for ForgeRank data
// Handles backlinks, keywords, and combined exports with proper escaping

interface BacklinkCSVRow {
  source_url: string
  source_domain: string
  target_url: string
  target_domain: string
  anchor_text: string
  context_type: string
  parent_tag: string
  http_status?: number
  is_broken?: boolean
  first_seen: string
  last_checked?: string
  found_via: string
}

interface KeywordCSVRow {
  keyword: string
  frequency: number
  relevance: number
  niche?: string
  type?: string
  source_pages: number
  first_seen: string
}

interface CombinedCSVRow extends BacklinkCSVRow {
  related_keywords?: string
}

export class CSVExporter {
  // Escape CSV field content to handle commas, quotes, and newlines
  private escapeCSVField(field: any): string {
    if (field === null || field === undefined) {
      return ''
    }
    
    const str = String(field)
    
    // If the field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    
    return str
  }

  // Convert array of objects to CSV string
  private arrayToCSV<T extends Record<string, any>>(data: T[], headers: (keyof T)[]): string {
    if (data.length === 0) {
      return headers.join(',')
    }

    // Create header row
    const headerRow = headers.map(header => this.escapeCSVField(header)).join(',')
    
    // Create data rows
    const dataRows = data.map(row => {
      return headers.map(header => this.escapeCSVField(row[header])).join(',')
    })

    return [headerRow, ...dataRows].join('\n')
  }

  // Export backlinks to CSV
  exportBacklinks(backlinks: any[], filename?: string): void {
    const csvData = this.backlinksToCSV(backlinks)
    this.downloadCSV(csvData, filename || `forgerank-backlinks-${this.getDateString()}.csv`)
  }

  // Export keywords to CSV  
  exportKeywords(keywords: any[], filename?: string): void {
    const csvData = this.keywordsToCSV(keywords)
    this.downloadCSV(csvData, filename || `forgerank-keywords-${this.getDateString()}.csv`)
  }

  // Export combined backlinks + keywords
  exportCombined(backlinks: any[], keywords: any[], filename?: string): void {
    const csvData = this.combinedToCSV(backlinks, keywords)
    this.downloadCSV(csvData, filename || `forgerank-combined-${this.getDateString()}.csv`)
  }

  // Convert backlinks to CSV format
  private backlinksToCSV(backlinks: any[]): string {
    const headers: (keyof BacklinkCSVRow)[] = [
      'source_url',
      'source_domain', 
      'target_url',
      'target_domain',
      'anchor_text',
      'context_type',
      'parent_tag',
      'http_status',
      'is_broken',
      'first_seen',
      'last_checked',
      'found_via'
    ]

    const csvRows: BacklinkCSVRow[] = backlinks.map(bl => ({
      source_url: bl.source_url || '',
      source_domain: bl.source_domain || this.extractDomain(bl.source_url || ''),
      target_url: bl.target_url || bl.href || '',
      target_domain: bl.target_domain || this.extractDomain(bl.target_url || bl.href || ''),
      anchor_text: bl.anchor_text || bl.anchorText || '',
      context_type: bl.context_type || bl.contextType || 'generic',
      parent_tag: bl.parentTagName || bl.parent_tag || '',
      http_status: bl.http_status,
      is_broken: bl.is_broken,
      first_seen: bl.created_at || bl.timestamp || bl.first_seen_at || new Date().toISOString(),
      last_checked: bl.last_checked_at,
      found_via: bl.found_via || 'passive_scanning'
    }))

    return this.arrayToCSV(csvRows, headers)
  }

  // Convert keywords to CSV format
  private keywordsToCSV(keywords: any[]): string {
    const headers: (keyof KeywordCSVRow)[] = [
      'keyword',
      'frequency',
      'relevance', 
      'niche',
      'type',
      'source_pages',
      'first_seen'
    ]

    const csvRows: KeywordCSVRow[] = keywords.map(kw => ({
      keyword: kw.keyword || kw.term || '',
      frequency: kw.frequency || kw.count || 0,
      relevance: kw.relevance || kw.score || 0,
      niche: kw.niche || kw.category,
      type: kw.type,
      source_pages: kw.sourceCount || kw.source_pages || 1,
      first_seen: kw.first_seen || kw.created_at || new Date().toISOString()
    }))

    return this.arrayToCSV(csvRows, headers)
  }

  // Convert combined data to CSV format
  private combinedToCSV(backlinks: any[], keywords: any[]): string {
    const headers: (keyof CombinedCSVRow)[] = [
      'source_url',
      'source_domain',
      'target_url', 
      'target_domain',
      'anchor_text',
      'context_type',
      'parent_tag',
      'http_status',
      'is_broken',
      'first_seen',
      'last_checked',
      'found_via',
      'related_keywords'
    ]

    // Create keyword lookup by source URL for correlation
    const keywordsBySource = new Map<string, string[]>()
    keywords.forEach(kw => {
      if (kw.sources && Array.isArray(kw.sources)) {
        kw.sources.forEach((source: string) => {
          if (!keywordsBySource.has(source)) {
            keywordsBySource.set(source, [])
          }
          keywordsBySource.get(source)!.push(kw.keyword || kw.term)
        })
      }
    })

    const csvRows: CombinedCSVRow[] = backlinks.map(bl => {
      const sourceUrl = bl.source_url || ''
      const relatedKeywords = keywordsBySource.get(sourceUrl) || []
      
      return {
        source_url: sourceUrl,
        source_domain: bl.source_domain || this.extractDomain(sourceUrl),
        target_url: bl.target_url || bl.href || '',
        target_domain: bl.target_domain || this.extractDomain(bl.target_url || bl.href || ''),
        anchor_text: bl.anchor_text || bl.anchorText || '',
        context_type: bl.context_type || bl.contextType || 'generic',
        parent_tag: bl.parentTagName || bl.parent_tag || '',
        http_status: bl.http_status,
        is_broken: bl.is_broken,
        first_seen: bl.created_at || bl.timestamp || bl.first_seen_at || new Date().toISOString(),
        last_checked: bl.last_checked_at,
        found_via: bl.found_via || 'passive_scanning',
        related_keywords: relatedKeywords.length > 0 ? relatedKeywords.join('; ') : ''
      }
    })

    return this.arrayToCSV(csvRows, headers)
  }

  // Trigger CSV download in browser
  private downloadCSV(csvContent: string, filename: string): void {
    // Add UTF-8 BOM to ensure proper encoding in Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    })
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL object
    window.URL.revokeObjectURL(url)
  }

  // Extract domain from URL
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  // Get current date string for filenames
  private getDateString(): string {
    const now = new Date()
    return now.toISOString().split('T')[0] // YYYY-MM-DD format
  }

  // Get CSV preview (first 5 rows) for user confirmation
  getBacklinksPreview(backlinks: any[]): string {
    const csvContent = this.backlinksToCSV(backlinks.slice(0, 5))
    return csvContent
  }

  getKeywordsPreview(keywords: any[]): string {
    const csvContent = this.keywordsToCSV(keywords.slice(0, 5))
    return csvContent
  }

  // Get export statistics
  getExportStats(backlinks: any[], keywords: any[]): {
    totalBacklinks: number
    totalKeywords: number
    estimatedFileSize: string
    domains: number
    dateRange: { earliest: string, latest: string }
  } {
    const totalBacklinks = backlinks.length
    const totalKeywords = keywords.length
    
    // Rough estimate: ~100 bytes per backlink, ~50 bytes per keyword
    const estimatedBytes = (totalBacklinks * 100) + (totalKeywords * 50)
    const estimatedFileSize = estimatedBytes > 1024 * 1024 
      ? `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(estimatedBytes / 1024).toFixed(1)} KB`

    // Get unique domains
    const domains = new Set(backlinks.map(bl => 
      bl.source_domain || this.extractDomain(bl.source_url || '')
    )).size

    // Get date range
    const dates = backlinks
      .map(bl => bl.created_at || bl.timestamp || bl.first_seen_at)
      .filter(Boolean)
      .sort()
    
    const earliest = dates[0] || new Date().toISOString()
    const latest = dates[dates.length - 1] || new Date().toISOString()

    return {
      totalBacklinks,
      totalKeywords,
      estimatedFileSize,
      domains,
      dateRange: { earliest, latest }
    }
  }
}
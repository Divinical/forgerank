import { motion } from 'framer-motion'
import { Hash, Filter, Download } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'

export function Keywords() {
  const { keywords, isPro, isAuthenticated } = useStore()
  const [filterRelevance, setFilterRelevance] = useState<string>('all')
  
  // Group keywords by relevance
  const filteredKeywords = filterRelevance === 'all' 
    ? keywords 
    : keywords.filter(k => k.relevance === filterRelevance)
  
  const highRelevanceCount = keywords.filter(k => k.relevance === 'high').length
  const totalOccurrences = keywords.reduce((sum, k) => sum + k.frequency, 0)
  
  const getTagStyle = (relevance: string) => {
    switch (relevance) {
      case 'high':
        return 'bg-forge-orange/20 text-forge-orange border-forge-orange/30'
      case 'medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'low':
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }
  
  const getTagSize = (frequency: number) => {
    if (frequency > 30) return 'text-lg px-4 py-2'
    if (frequency > 20) return 'text-base px-3 py-1.5'
    return 'text-sm px-3 py-1'
  }
  
  const handleExport = () => {
    if (!isPro) return
    
    // Create CSV content
    const headers = ['Keyword', 'Frequency', 'Relevance']
    const rows = keywords.map(k => [k.keyword, k.frequency, k.relevance])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forgerank-keywords-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Keywords</h2>
          <p className="text-zinc-400">
            Top keywords extracted from pages containing your backlinks.
          </p>
        </div>
        
        {isPro && (
          <div className="flex gap-3">
            <select
              value={filterRelevance}
              onChange={(e) => setFilterRelevance(e.target.value)}
              className="btn-secondary flex items-center gap-2"
            >
              <option value="all">All Keywords</option>
              <option value="high">High Relevance</option>
              <option value="medium">Medium Relevance</option>
              <option value="low">Low Relevance</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
          </div>
        )}
      </div>
      
      <div className="bg-forge-light rounded-2xl p-8">
        {filteredKeywords.length === 0 ? (
          <div className="text-center py-12">
            <Hash className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">
              {filterRelevance !== 'all' 
                ? `No ${filterRelevance} relevance keywords found.`
                : 'No keywords extracted yet. Keywords will appear here after backlinks are discovered.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredKeywords.map((keyword, index) => (
              <motion.div
                key={keyword.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className={`
                  inline-flex items-center gap-2 rounded-full border
                  ${getTagStyle(keyword.relevance)}
                  ${getTagSize(keyword.frequency)}
                  cursor-pointer transition-all
                `}
              >
                <span className="font-medium">{keyword.keyword}</span>
                <span className="opacity-60">({keyword.frequency})</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {!isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-forge-orange/10 border border-forge-orange/30 rounded-xl p-4"
        >
          <p className="text-sm text-forge-orange">
            🔒 Upgrade to Pro for advanced keyword filtering and export functionality
          </p>
        </motion.div>
      )}
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">High Relevance</h3>
          <p className="text-3xl font-bold text-forge-orange">
            {highRelevanceCount}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Most important keywords</p>
        </div>
        
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Keywords</h3>
          <p className="text-3xl font-bold text-blue-400">
            {keywords.length}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Unique terms found</p>
        </div>
        
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Total Occurrences</h3>
          <p className="text-3xl font-bold text-green-400">
            {totalOccurrences}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Combined frequency</p>
        </div>
      </div>
    </motion.div>
  )
}
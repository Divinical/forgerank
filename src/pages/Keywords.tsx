import { motion } from 'framer-motion'
import { Hash, Download, RefreshCw, Target, Brain, Layers, TrendingUp } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState, useEffect } from 'react'
import { extractKeywordsFromBacklinks } from '../utils/keywordExtractor'
import { clusterKeywords } from '../utils/semanticClustering'
import type { Keyword } from '../types/keyword'

export function Keywords() {
  const { keywords, isPro, backlinks } = useStore()
  const [filterRelevance, setFilterRelevance] = useState<string>('all')
  const [filterNiche, setFilterNiche] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'cloud' | 'clusters' | 'list'>('cloud')
  const [isProcessing, setIsProcessing] = useState(false)
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>(keywords)
  const [semanticClusters, setSemanticClusters] = useState<any[]>([])
  
  useEffect(() => {
    setLocalKeywords(keywords)
    if (keywords.length > 0) {
      const clusters = clusterKeywords(keywords)
      setSemanticClusters(clusters)
    }
  }, [keywords])
  
  // Process keywords in idle time when component mounts if we have backlinks but no keywords
  useEffect(() => {
    if (backlinks.length > 0 && localKeywords.length === 0 && !isProcessing) {
      processKeywords()
    }
  }, [backlinks])
  
  const processKeywords = async () => {
    if (isProcessing || backlinks.length === 0) return
    
    setIsProcessing(true)
    try {
      const extractedKeywords = await extractKeywordsFromBacklinks(backlinks)
      setLocalKeywords(extractedKeywords)
      // Update store
      useStore.setState({ keywords: extractedKeywords })
    } catch (error) {
      // Silent fail
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Advanced filtering for Pro users
  const filteredKeywords = localKeywords.filter(k => {
    if (!isPro) return true // Free users see all
    
    const relevanceMatch = filterRelevance === 'all' || k.relevance === filterRelevance
    const nicheMatch = filterNiche === 'all' || k.niche === filterNiche
    const typeMatch = filterType === 'all' || k.keyword_type === filterType
    
    return relevanceMatch && nicheMatch && typeMatch
  })
  
  // Analytics for insights
  const highRelevanceCount = localKeywords.filter(k => k.relevance === 'high').length
  const avgLLMScore = localKeywords.length > 0 ? 
    localKeywords.reduce((sum, k) => sum + (k.llm_relevance_score || 0), 0) / localKeywords.length : 0
  const uniqueNiches = [...new Set(localKeywords.map(k => k.niche).filter(Boolean))]
  const entityCount = localKeywords.filter(k => k.keyword_type === 'entity').length
  const phraseCount = localKeywords.filter(k => k.keyword_type === 'phrase').length
  
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
    
    // Enhanced CSV with all new fields
    const headers = [
      'Keyword', 'Frequency', 'Relevance', 'Niche', 'Type', 
      'LLM Relevance Score', 'Semantic Cluster', 'Context Score'
    ]
    const rows = localKeywords.map(k => [
      k.keyword, 
      k.frequency, 
      k.relevance,
      k.niche || 'general',
      k.keyword_type || 'single-word',
      (k.llm_relevance_score || 0).toFixed(2),
      k.semantic_cluster || 'unclustered',
      (k.context_score || 1).toFixed(2)
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    // Download enhanced CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forgerank-keywords-advanced-${new Date().toISOString().split('T')[0]}.csv`
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
            Advanced keyword extraction with niche detection and LLM optimization.
          </p>
          {uniqueNiches.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Target className="w-4 h-4 text-forge-orange" />
              <span className="text-sm text-forge-orange font-medium">
                Detected niches: {uniqueNiches.join(', ')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-3">
          {backlinks.length > 0 && !isProcessing && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={processKeywords}
              className="btn-secondary flex items-center gap-2"
              title="Reprocess keywords from backlinks"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          )}
          
          {isPro ? (
            <>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
                className="btn-secondary"
              >
                <option value="cloud">Keyword Cloud</option>
                <option value="clusters">Semantic Clusters</option>
                <option value="list">Detailed List</option>
              </select>
              <select
                value={filterRelevance}
                onChange={(e) => setFilterRelevance(e.target.value)}
                className="btn-secondary"
              >
                <option value="all">All Relevance</option>
                <option value="high">High Relevance</option>
                <option value="medium">Medium Relevance</option>
                <option value="low">Low Relevance</option>
              </select>
              {uniqueNiches.length > 1 && (
                <select
                  value={filterNiche}
                  onChange={(e) => setFilterNiche(e.target.value)}
                  className="btn-secondary"
                >
                  <option value="all">All Niches</option>
                  {uniqueNiches.map(niche => (
                    <option key={niche} value={niche}>{niche}</option>
                  ))}
                </select>
              )}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="btn-secondary"
              >
                <option value="all">All Types</option>
                <option value="phrase">Phrases</option>
                <option value="entity">Entities</option>
                <option value="technical-term">Technical</option>
                <option value="single-word">Single Words</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExport}
                className="btn-primary flex items-center gap-2"
                disabled={localKeywords.length === 0}
              >
                <Download className="w-4 h-4" />
                Export
              </motion.button>
            </>
          ) : localKeywords.length > 0 && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <span>🔒 Advanced filtering & export with Pro</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-forge-light rounded-2xl p-8">
        {isProcessing ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forge-orange mx-auto mb-4"></div>
            <p className="text-zinc-400">Processing keywords with advanced AI analysis...</p>
          </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="text-center py-12">
            <Hash className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">
              {filterRelevance !== 'all' || filterNiche !== 'all' || filterType !== 'all'
                ? `No keywords match your current filters.`
                : backlinks.length === 0
                  ? 'No keywords extracted yet. Keywords will appear here after backlinks are discovered.'
                  : 'Click "Refresh" to extract keywords from your backlinks.'}
            </p>
          </div>
        ) : viewMode === 'cloud' ? (
          <div className="flex flex-wrap gap-3">
            {filteredKeywords.map((keyword, index) => (
              <motion.div
                key={keyword.id || `${keyword.keyword}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                whileHover={{ scale: 1.05 }}
                className={`
                  inline-flex items-center gap-2 rounded-full border
                  ${getTagStyle(keyword.relevance)}
                  ${getTagSize(keyword.frequency)}
                  cursor-pointer transition-all relative group
                `}
                title={isPro ? `Type: ${keyword.keyword_type}, LLM Score: ${(keyword.llm_relevance_score || 0).toFixed(2)}, Niche: ${keyword.niche || 'general'}` : undefined}
              >
                <span className="font-medium">{keyword.keyword}</span>
                <span className="opacity-60">({keyword.frequency})</span>
                {keyword.keyword_type === 'entity' && (
                  <div className="w-1.5 h-1.5 bg-forge-orange rounded-full"></div>
                )}
                {isPro && (keyword.llm_relevance_score || 0) > 0.8 && (
                  <Brain className="w-3 h-3 text-green-400" />
                )}
              </motion.div>
            ))}
          </div>
        ) : viewMode === 'clusters' ? (
          <div className="space-y-6">
            {semanticClusters.slice(0, 10).map((cluster, clusterIndex) => (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: clusterIndex * 0.1 }}
                className="bg-zinc-800/50 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    {cluster.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span>{cluster.keywords.length} terms</span>
                    {isPro && (
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">
                        LLM: {(cluster.llmRelevance * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cluster.keywords.map((kw: string) => {
                    const keyword = filteredKeywords.find(k => k.keyword === kw)
                    if (!keyword) return null
                    return (
                      <span
                        key={kw}
                        className={`
                          px-3 py-1 rounded-full text-sm border
                          ${getTagStyle(keyword.relevance)}
                        `}
                      >
                        {kw} ({keyword.frequency})
                      </span>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredKeywords.map((keyword, index) => (
              <motion.div
                key={keyword.id || `${keyword.keyword}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="bg-zinc-800/50 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white font-medium">{keyword.keyword}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${getTagStyle(keyword.relevance)}`}>
                      {keyword.relevance}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {keyword.keyword_type?.replace('-', ' ')}
                    </span>
                    {keyword.niche && (
                      <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                        {keyword.niche}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <span>Frequency: {keyword.frequency}</span>
                  {isPro && keyword.llm_relevance_score && (
                    <span className="flex items-center gap-1">
                      <Brain className="w-3 h-3" />
                      {(keyword.llm_relevance_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
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
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-forge-orange" />
            High Relevance
          </h3>
          <p className="text-3xl font-bold text-forge-orange">
            {highRelevanceCount}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Most important keywords</p>
        </div>
        
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Hash className="w-5 h-5 text-blue-400" />
            Entities
          </h3>
          <p className="text-3xl font-bold text-blue-400">
            {entityCount}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Named entities detected</p>
        </div>
        
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Phrases
          </h3>
          <p className="text-3xl font-bold text-purple-400">
            {phraseCount}
          </p>
          <p className="text-sm text-zinc-400 mt-1">Multi-word phrases</p>
        </div>
        
        <div className="bg-forge-light rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Brain className="w-5 h-5 text-green-400" />
            LLM Score
          </h3>
          <p className="text-3xl font-bold text-green-400">
            {(avgLLMScore * 100).toFixed(0)}%
          </p>
          <p className="text-sm text-zinc-400 mt-1">Average LLM relevance</p>
        </div>
      </div>
    </motion.div>
  )
}
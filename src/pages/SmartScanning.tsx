// Smart Site Scanning - Growth tier exclusive feature
// Allows users to queue competitor sites for intelligent backlink discovery

import { motion } from 'framer-motion'
import { Plus, Trash2, Play, Pause, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'

// QueuedSite type for TypeScript
type QueuedSite = {
  id: string
  url: string
  domain: string
  status: 'pending' | 'scanning' | 'completed' | 'error' | 'paused'
  progress: number
  foundBacklinks: number
  lastScanned?: string
  queuedAt: string
  errorMessage?: string
  totalPages?: number
  scannedPages?: number
}

export function SmartScanning() {
  const { 
    isPro, 
    isAuthenticated, 
    queuedSites, 
    addCompetitorSite, 
    removeCompetitorSite, 
    startSiteScanning, 
    pauseSiteScanning,
    fetchQueuedSites 
  } = useStore()
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const maxSites = 10 // Growth tier limit
  
  // Load queued sites on mount
  useEffect(() => {
    if (isPro) {
      fetchQueuedSites()
    }
  }, [isPro, fetchQueuedSites])
  
  const handleAddSite = async () => {
    setError('')
    setLoading(true)
    
    if (!newSiteUrl.trim()) {
      setError('Please enter a competitor URL')
      setLoading(false)
      return
    }
    
    // Add protocol if missing
    let urlToAdd = newSiteUrl.trim()
    if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
      urlToAdd = 'https://' + urlToAdd
    }
    
    try {
      await addCompetitorSite(urlToAdd)
      setNewSiteUrl('')
      console.log('✅ Successfully added competitor site to queue')
    } catch (err: any) {
      console.error('❌ Failed to add competitor site:', err)
      setError(err.message || 'Failed to add competitor site')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRemoveSite = async (siteId: string) => {
    try {
      await removeCompetitorSite(siteId)
      console.log('✅ Successfully removed competitor site from queue')
    } catch (err) {
      console.error('❌ Failed to remove competitor site:', err)
      setError('Failed to remove site from queue')
    }
  }
  
  const getStatusIcon = (status: QueuedSite['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'scanning':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }
  
  const getStatusText = (status: QueuedSite['status']) => {
    switch (status) {
      case 'pending': return 'Queued'
      case 'scanning': return 'Scanning...'
      case 'completed': return 'Complete'
      case 'error': return 'Error'
    }
  }

  // Growth tier check
  if (!isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-8"
      >
        <div className="text-center">
          <Search className="w-16 h-16 text-forge-orange mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Smart Site Scanning</h2>
          <p className="text-zinc-400 mb-8 max-w-2xl mx-auto">
            Queue competitor sites for intelligent backlink discovery. Our browser-based crawler 
            analyzes up to 50+ pages per site during idle time, finding backlink opportunities 
            your competitors don't want you to know about.
          </p>
          
          <div className="bg-forge-light rounded-2xl p-8 max-w-md mx-auto">
            <h3 className="text-xl font-semibold text-white mb-4">Growth Tier Feature</h3>
            <ul className="text-left text-zinc-300 space-y-2 mb-6">
              <li>• Queue up to 10 competitor sites</li>
              <li>• Smart page targeting (blogs, resources)</li>
              <li>• Background processing during idle time</li>
              <li>• Zero server costs - runs in your browser</li>
              <li>• Find fresh backlinks before enterprise tools</li>
            </ul>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full"
              onClick={() => useStore.getState().setUpgradeModalOpen(true)}
            >
              Upgrade to Growth - £9/month
            </motion.button>
          </div>
        </div>
      </motion.div>
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <h2 className="text-3xl font-bold text-white mb-2">Smart Site Scanning</h2>
      <p className="text-zinc-400 mb-8">
        Queue competitor sites for intelligent backlink discovery. 
        ({queuedSites.length}/{maxSites} sites queued)
      </p>
      
      <div className="bg-forge-light rounded-2xl p-6 mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={newSiteUrl}
            onChange={(e) => setNewSiteUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleAddSite()
              }
            }}
            placeholder="competitor.com"
            className="input-field flex-1"
            disabled={loading}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddSite}
            disabled={loading || queuedSites.length >= maxSites}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Queue Site
              </>
            )}
          </motion.button>
        </div>
        
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        {queuedSites.length >= maxSites && (
          <div className="mt-3 p-3 bg-forge-orange/10 border border-forge-orange/30 rounded-lg">
            <p className="text-sm text-forge-orange">
              🎯 Queue is full. Remove completed scans to add more sites.
            </p>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {queuedSites.length === 0 ? (
          <div className="bg-forge-light rounded-2xl p-12 text-center">
            <Search className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
            <p className="text-zinc-400 mb-2">
              No sites queued for scanning yet.
            </p>
            <p className="text-sm text-zinc-500">
              Add competitor URLs above to start discovering their backlink sources.
            </p>
          </div>
        ) : (
          queuedSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-forge-light rounded-xl p-4 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(site.status)}
                  <div className="min-w-0">
                    <span className="text-zinc-200 font-medium block truncate">{site.domain}</span>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span>{getStatusText(site.status)}</span>
                      {site.status === 'scanning' && (
                        <span>{site.progress}% complete</span>
                      )}
                      {site.status === 'completed' && (
                        <span className="text-green-400">Intelligence gathered</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {site.status === 'pending' && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => startSiteScanning(site.id)}
                      className="p-2 text-zinc-400 hover:text-blue-400 transition-colors"
                      title="Start scanning"
                    >
                      <Play className="w-4 h-4" />
                    </motion.button>
                  )}
                  {site.status === 'scanning' && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => pauseSiteScanning(site.id)}
                      className="p-2 text-zinc-400 hover:text-yellow-400 transition-colors"
                      title="Pause scanning"
                    >
                      <Pause className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleRemoveSite(site.id)}
                    className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
              
              {site.status === 'scanning' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Scanning progress</span>
                    <span>{site.progress}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <motion.div
                      className="bg-blue-500 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${site.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
      
      {isAuthenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <p className="text-sm text-blue-400">
            💡 <strong>Smart Scanning</strong> runs during browser idle time and focuses on high-value pages 
            like blog posts, resource pages, and guest posts where backlinks are most likely to be found.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
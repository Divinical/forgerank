import { motion } from 'framer-motion'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'

export function TrackedLinks() {
  const { trackedUrls, addTrackedUrl, removeTrackedUrl, isPro, isAuthenticated } = useStore()
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const maxUrls = isPro ? 20 : 3
  
  const handleAddUrl = async () => {
    setError('')
    setLoading(true)
    
    try {
      await addTrackedUrl(newUrl)
      setNewUrl('')
    } catch (err: any) {
      setError(err.message || 'Failed to add URL')
    } finally {
      setLoading(false)
    }
  }
  
  const handleRemoveUrl = async (url: string) => {
    try {
      await removeTrackedUrl(url)
    } catch (err) {
      console.error('Failed to remove URL:', err)
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <h2 className="text-3xl font-bold text-white mb-2">Tracked Links</h2>
      <p className="text-zinc-400 mb-8">
        Add domains or specific pages to monitor for backlinks. 
        ({trackedUrls.length}/{maxUrls} used)
      </p>
      
      <div className="bg-forge-light rounded-2xl p-6 mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            placeholder="https://example.com or https://example.com/page"
            className="input-field flex-1"
            disabled={loading}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddUrl}
            disabled={loading || trackedUrls.length >= maxUrls}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add URL
          </motion.button>
        </div>
        
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>
      
      <div className="space-y-3">
        {trackedUrls.length === 0 ? (
          <div className="bg-forge-light rounded-2xl p-12 text-center">
            <p className="text-zinc-400">
              No tracked links yet. Add your first URL above to start monitoring.
            </p>
          </div>
        ) : (
          trackedUrls.map((url, index) => (
            <motion.div
              key={url}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-forge-light rounded-xl p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <span className="text-zinc-200 truncate">{url}</span>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => window.open(url, '_blank')}
                  className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleRemoveUrl(url)}
                  className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          ))
        )}
      </div>
      
      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <p className="text-sm text-blue-400">
            💡 Sign in to sync your tracked URLs across devices and unlock Pro features
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
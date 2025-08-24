// src/pages/TrackedLinks.tsx - FIXED VERSION

import { motion } from 'framer-motion'
import { Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'

export function TrackedLinks() {
  const { trackedUrls, addTrackedUrl, removeTrackedUrl, isPro, isAuthenticated, user } = useStore()
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const maxUrls = isPro ? 20 : 3
  
  const handleAddUrl = async () => {
    setError('')
    
    // Validate URL format
    if (!newUrl.trim()) {
      setError('Please enter a URL')
      return
    }
    
    // Add protocol if missing
    let urlToAdd = newUrl.trim()
    if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
      urlToAdd = 'https://' + urlToAdd
    }
    
    setLoading(true)
    
    try {
      await addTrackedUrl(urlToAdd)
      setNewUrl('')
      setError('') // Clear any previous errors
    } catch (err: any) {
      console.error('Error adding URL:', err)
      // Provide more helpful error messages
      if (err.message?.includes('duplicate key')) {
        setError('This URL is already being tracked')
      } else if (err.message?.includes('Maximum')) {
        setError(err.message)
      } else if (err.message?.includes('Invalid URL')) {
        setError('Please enter a valid URL (e.g., https://example.com)')
      } else {
        setError(err.message || 'Failed to add URL. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }
  
  const handleRemoveUrl = async (url: string) => {
    try {
      await removeTrackedUrl(url)
    } catch (err) {
      console.error('Failed to remove URL:', err)
      setError('Failed to remove URL. Please try again.')
    }
  }
  
  // Debug info for development - always show for now to debug pro status
  const debugInfo = (
    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400 space-y-2">
      <p className="font-semibold">Debug Info:</p>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <p>User: {user?.email || 'None'}</p>
      <p>User ID: {user?.id || 'None'}</p>
      <p>Pro Status: {isPro ? 'Yes' : 'No'}</p>
      <p>Tracked URLs: {trackedUrls.length}/{maxUrls}</p>
      
      <div className="flex gap-2 pt-2 border-t border-blue-500/30">
        <button
          onClick={async () => {
            console.log('🔧 Manual cache clear requested')
            await chrome.storage.local.remove(['isPro'])
            console.log('🔧 Cleared isPro from Chrome storage')
            useStore.setState({ isPro: false })
            console.log('🔧 Reset isPro to false in React state')
          }}
          className="px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Clear Cache
        </button>
        
        <button
          onClick={() => {
            console.log('🔧 Manual loadUserData reload requested')
            useStore.getState().loadUserData()
          }}
          className="px-2 py-1 bg-green-500/20 border border-green-500/50 rounded text-green-400 hover:bg-green-500/30 transition-colors"
        >
          Reload User Data
        </button>
        
        <button
          onClick={async () => {
            console.log('🔧 Chrome storage contents:')
            const storage = await chrome.storage.local.get()
            console.log(storage)
          }}
          className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-yellow-400 hover:bg-yellow-500/30 transition-colors"
        >
          Log Storage
        </button>
      </div>
    </div>
  )
  
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
      
      {debugInfo}
      
      <div className="bg-forge-light rounded-2xl p-6 mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleAddUrl()
              }
            }}
            placeholder="https://example.com or example.com"
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
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add URL
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
        
        {trackedUrls.length >= maxUrls && !isPro && (
          <div className="mt-3 p-3 bg-forge-orange/10 border border-forge-orange/30 rounded-lg">
            <p className="text-sm text-forge-orange">
              🔒 You've reached the free tier limit. Upgrade to Pro to track up to 20 URLs.
            </p>
          </div>
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
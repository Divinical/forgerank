import { motion } from 'framer-motion'
import { Moon, Sun, Trash2, Download, RefreshCw, Bell, LogOut } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'

export function Settings() {
  const { isDarkMode, toggleDarkMode, isAuthenticated, user, signOut, backlinks, keywords } = useStore()
  const [loading, setLoading] = useState<string>('')
  
  const handleExportAllData = () => {
    if (!isAuthenticated) return
    
    setLoading('export')
    
    // Create JSON export
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user?.email,
        id: user?.id
      },
      backlinks: backlinks,
      keywords: keywords,
      trackedUrls: useStore.getState().trackedUrls
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forgerank-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    window.URL.revokeObjectURL(url)
    
    setTimeout(() => setLoading(''), 1000)
  }
  
  const handleClearCache = async () => {
    setLoading('cache')
    
    // Clear local storage except auth data
    const authData = await chrome.storage.local.get(['userId', 'isAuthenticated', 'isPro'])
    await chrome.storage.local.clear()
    await chrome.storage.local.set(authData)
    
    // Refresh data
    await useStore.getState().fetchBacklinks()
    await useStore.getState().fetchKeywords()
    
    setTimeout(() => setLoading(''), 1000)
  }
  
  const handleResetData = async () => {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      return
    }
    
    setLoading('reset')
    
    // Clear everything
    await chrome.storage.local.clear()
    
    // Sign out user
    await signOut()
    
    setTimeout(() => setLoading(''), 1000)
  }
  
  const handleSignOut = async () => {
    setLoading('signout')
    await signOut()
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
      <p className="text-zinc-400 mb-8">
        Customize ForgeRank to match your workflow.
      </p>
      
      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Appearance</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDarkMode ? (
                <Moon className="w-5 h-5 text-zinc-400" />
              ) : (
                <Sun className="w-5 h-5 text-zinc-400" />
              )}
              <div>
                <p className="text-zinc-200 font-medium">Dark Mode</p>
                <p className="text-sm text-zinc-500">Toggle between light and dark themes</p>
              </div>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${isDarkMode ? 'bg-forge-orange' : 'bg-zinc-600'}
              `}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full"
                animate={{ x: isDarkMode ? 24 : 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </button>
          </div>
        </div>
        
        {/* Notifications */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-zinc-400" />
                <div>
                  <p className="text-zinc-200 font-medium">New Backlinks</p>
                  <p className="text-sm text-zinc-500">Get notified when new backlinks are found</p>
                </div>
              </div>
              
              <button className="relative w-12 h-6 rounded-full bg-zinc-600">
                <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Data Management */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Data Management</h3>
          
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportAllData}
              disabled={!isAuthenticated || loading === 'export'}
              className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {loading === 'export' ? 'Exporting...' : 'Export All Data'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearCache}
              disabled={loading === 'cache'}
              className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              {loading === 'cache' ? 'Clearing...' : 'Clear Cache'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleResetData}
              disabled={loading === 'reset'}
              className="w-full bg-red-500/10 text-red-400 px-4 py-2 rounded-lg font-medium
                hover:bg-red-500/20 transition-colors duration-200 flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {loading === 'reset' ? 'Resetting...' : 'Reset All Data'}
            </motion.button>
          </div>
          
          {!isAuthenticated && (
            <p className="text-xs text-zinc-500 mt-4">
              Sign in to enable data export
            </p>
          )}
        </div>
        
        {/* Account */}
        {isAuthenticated && user && (
          <div className="bg-forge-light rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Account</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Email</p>
                <p className="text-zinc-200">{user.email}</p>
              </div>
              
              <div>
                <p className="text-zinc-400 text-sm mb-1">Plan</p>
                <p className="text-zinc-200">
                  {useStore.getState().isPro ? 'Pro' : 'Free'} Tier
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                disabled={loading === 'signout'}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
                {loading === 'signout' ? 'Signing out...' : 'Sign Out'}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
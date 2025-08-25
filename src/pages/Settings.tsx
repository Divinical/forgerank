import { motion } from 'framer-motion'
import { Moon, Sun, Trash2, Download, RefreshCw, Bell, LogOut, FileText, Hash, Database } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'
import { ResetConfirmModal } from '../components/ResetConfirmModal'
import { CSVExporter } from '../utils/csvExporter'

export function Settings() {
  const { isDarkMode, toggleDarkMode, notificationsEnabled, toggleNotifications, isAuthenticated, user, signOut, backlinks, keywords } = useStore()
  const [loading, setLoading] = useState<string>('')
  const [showResetModal, setShowResetModal] = useState(false)
  const csvExporter = new CSVExporter()
  
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

  const handleExportBacklinksCSV = () => {
    if (!isAuthenticated || backlinks.length === 0) return
    
    setLoading('csv-backlinks')
    try {
      csvExporter.exportBacklinks(backlinks)
      console.log('✅ Backlinks exported to CSV successfully')
    } catch (error) {
      console.error('❌ Failed to export backlinks CSV:', error)
    } finally {
      setTimeout(() => setLoading(''), 1000)
    }
  }

  const handleExportKeywordsCSV = () => {
    if (!isAuthenticated || keywords.length === 0) return
    
    setLoading('csv-keywords')
    try {
      csvExporter.exportKeywords(keywords)
      console.log('✅ Keywords exported to CSV successfully')
    } catch (error) {
      console.error('❌ Failed to export keywords CSV:', error)
    } finally {
      setTimeout(() => setLoading(''), 1000)
    }
  }

  const handleExportCombinedCSV = () => {
    if (!isAuthenticated || (backlinks.length === 0 && keywords.length === 0)) return
    
    setLoading('csv-combined')
    try {
      csvExporter.exportCombined(backlinks, keywords)
      console.log('✅ Combined data exported to CSV successfully')
    } catch (error) {
      console.error('❌ Failed to export combined CSV:', error)
    } finally {
      setTimeout(() => setLoading(''), 1000)
    }
  }
  
  const handleClearCache = async () => {
    setLoading('cache')
    
    // Clear local storage except auth data, tracked URLs, and UI settings
    const preserveData = await chrome.storage.local.get([
      'userId', 'userEmail', 'isAuthenticated', 'isPro', 'lastAuthCheck',
      'trackedUrls', 'isDarkMode', 'notificationsEnabled',
      'forgerank-auth' // Keep auth token
    ])
    await chrome.storage.local.clear()
    await chrome.storage.local.set(preserveData)
    
    // Clear UI state immediately
    useStore.setState({ backlinks: [], keywords: [] })
    
    // Refresh data
    await useStore.getState().fetchBacklinks()
    await useStore.getState().fetchKeywords()
    await useStore.getState().fetchTrackedUrls()
    
    // Notify all tabs to reload scanner state with preserved tracked URLs
    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'RELOAD_SCANNER_STATE',
            trackedUrls: preserveData.trackedUrls || []
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          })
        }
      }
    } catch (error) {
      // Could not notify tabs
    }
    
    setTimeout(() => setLoading(''), 1000)
  }
  
  const handleResetData = async () => {
    setLoading('reset')
    
    try {
      // Clear everything
      await chrome.storage.local.clear()
      
      // Sign out user
      await signOut()
    } catch (error) {
      // Error clearing data
    } finally {
      setShowResetModal(false)
      setTimeout(() => setLoading(''), 1000)
    }
  }
  
  const handleSignOut = async () => {
    setLoading('signout')
    await signOut()
    setLoading('')
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
              
              <button
                onClick={toggleNotifications}
                className={`
                  relative w-12 h-6 rounded-full transition-colors duration-200
                  ${notificationsEnabled ? 'bg-forge-orange' : 'bg-zinc-600'}
                `}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ x: notificationsEnabled ? 24 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </div>
        
        {/* Data Management */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Data Management</h3>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportBacklinksCSV}
                disabled={!isAuthenticated || backlinks.length === 0 || loading === 'csv-backlinks'}
                className="btn-secondary flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                {loading === 'csv-backlinks' ? 'Exporting...' : 'Backlinks CSV'}
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExportKeywordsCSV}
                disabled={!isAuthenticated || keywords.length === 0 || loading === 'csv-keywords'}
                className="btn-secondary flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Hash className="w-4 h-4" />
                {loading === 'csv-keywords' ? 'Exporting...' : 'Keywords CSV'}
              </motion.button>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportCombinedCSV}
              disabled={!isAuthenticated || (backlinks.length === 0 && keywords.length === 0) || loading === 'csv-combined'}
              className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Database className="w-4 h-4" />
              {loading === 'csv-combined' ? 'Exporting...' : 'Combined CSV Export'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExportAllData}
              disabled={!isAuthenticated || loading === 'export'}
              className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {loading === 'export' ? 'Exporting...' : 'JSON Backup'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearCache}
              disabled={loading === 'cache'}
              className="w-full btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              {loading === 'cache' ? 'Resetting...' : 'Reset Findings'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowResetModal(true)}
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
      
      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetData}
        isLoading={loading === 'reset'}
      />
    </motion.div>
  )
}
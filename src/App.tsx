import { useEffect } from 'react'
import { SidebarTabSwitcher } from './components/SidebarTabSwitcher'
import { LoginModal } from './components/LoginModal'
import { UpgradeModal } from './components/UpgradeModal'
import { Dashboard } from './pages/Dashboard'
import { TrackedLinks } from './pages/TrackedLinks'
import { Backlinks } from './pages/Backlinks'
import { Keywords } from './pages/Keywords'
import { Settings } from './pages/Settings'
import { Upgrade } from './pages/Upgrade'
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'

function App() {
  const { activeTab, isDarkMode, checkAuth, syncPendingBacklinks, fetchBacklinks, isLoading } = useStore()
  
  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])
  
  // Listen for backlink updates from background script
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'BACKLINKS_UPDATED') {
        console.log('🔄 App: Received backlinks update, refreshing data')
        fetchBacklinks()
        // Also refresh keywords since they're extracted from the same source
        useStore.getState().fetchKeywords()
      }
    }
    
    chrome.runtime.onMessage.addListener(messageListener)
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [fetchBacklinks])
  
  // Sync pending backlinks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      syncPendingBacklinks()
    }, 30000) // Every 30 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  // Apply dark mode class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])
  
  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'tracked-links':
        return <TrackedLinks />
      case 'backlinks':
        return <Backlinks />
      case 'keywords':
        return <Keywords />
      case 'settings':
        return <Settings />
      case 'upgrade':
        return <Upgrade />
      default:
        return <Dashboard />
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex h-screen bg-forge-dark items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forge-orange mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading ForgeRank...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex h-screen bg-forge-dark text-zinc-300 overflow-hidden">
      {/* Sidebar */}
      <SidebarTabSwitcher />
      
      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {renderTabContent()}
      </main>
      
      {/* Modals */}
      <LoginModal />
      <UpgradeModal />
    </div>
  )
}

export default App
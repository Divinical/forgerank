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
  const { activeTab, isDarkMode, checkAuth, loadUserData, fetchBacklinks, setUser, setIsAuthenticated } = useStore()
  
  // Check authentication on mount and listen for auth changes
  useEffect(() => {
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          setIsAuthenticated(true)
          loadUserData()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAuthenticated(false)
          useStore.setState({ 
            backlinks: [], 
            keywords: [],
            isPro: false
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
          setIsAuthenticated(true)
        }
      }
    )
    
    return () => subscription.unsubscribe()
  }, [])
  
  // Listen for backlink updates from background script
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'BACKLINKS_UPDATED') {
        fetchBacklinks()
        useStore.getState().fetchKeywords()
      }
    }
    
    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [fetchBacklinks])
  
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
  
  // No loading screen - render immediately
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
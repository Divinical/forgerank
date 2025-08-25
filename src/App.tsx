import { useEffect } from 'react'
import { SidebarTabSwitcher } from './components/SidebarTabSwitcher'
import { LoginModal } from './components/LoginModal'
import { UpgradeModal } from './components/UpgradeModal'
import { OnboardingFlow } from './components/OnboardingFlow'
import { Dashboard } from './pages/Dashboard'
import { TrackedLinks } from './pages/TrackedLinks'
import { Backlinks } from './pages/Backlinks'
import { Keywords } from './pages/Keywords'
import { SmartScanning } from './pages/SmartScanning'
import { Settings } from './pages/Settings'
import { Upgrade } from './pages/Upgrade'
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'

function App() {
  const { activeTab, isDarkMode, showOnboarding, setShowOnboarding, loadUserData, fetchBacklinks, setUser, setIsAuthenticated, initializeAuth } = useStore()
  
  // Initialize authentication on mount and listen for auth changes
  useEffect(() => {
    // Use the new initialization function instead of checkAuth
    initializeAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          setIsAuthenticated(true)
          // Load user data on fresh sign-in to get pro status
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
          // Only load user data on token refresh to sync latest data
          loadUserData()
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
      } else if (message.type === 'KEYWORD_SOURCES_UPDATED') {
        // New content sources available, trigger keyword extraction in background
        const { backlinks } = useStore.getState()
        if (backlinks.length > 0) {
          // Trigger async keyword extraction without blocking UI
          import('./utils/keywordExtractor').then(({ extractKeywordsFromBacklinks }) => {
            extractKeywordsFromBacklinks(backlinks).then((keywords: any) => {
              useStore.setState({ keywords })
              console.log(`🔍 Auto-extracted ${keywords.length} keywords from new content sources`)
            }).catch((error: any) => {
              console.error('🔍 Auto keyword extraction failed:', error)
            })
          })
        }
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
      case 'smart-scanning':
        return <SmartScanning />
      case 'settings':
        return <Settings />
      case 'upgrade':
        return <Upgrade />
      default:
        return <Dashboard />
    }
  }
  
  // Show onboarding for new users
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  }
  
  // Normal app interface
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
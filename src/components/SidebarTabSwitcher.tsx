// src/components/SidebarTabSwitcher.tsx - UPDATED VERSION

import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Link, 
  LinkIcon, 
  Hash,
  Search,
  Settings, 
  Sparkles,
  LogIn,
  User
} from 'lucide-react'
import { useStore } from '../store/useStore'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracked-links', label: 'Tracked Links', icon: Link },
  { id: 'backlinks', label: 'Backlinks', icon: LinkIcon },
  { id: 'keywords', label: 'Keywords', icon: Hash },
  { id: 'smart-scanning', label: 'Smart Scanning', icon: Search, growthOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'upgrade', label: 'Upgrade', icon: Sparkles },
] as const

export function SidebarTabSwitcher() {
  const { activeTab, setActiveTab, isAuthenticated, user, setLoginModalOpen, isPro } = useStore()
  
  return (
    <nav className="w-48 min-w-[12rem] max-w-xs bg-forge-darker p-3 flex flex-col gap-2 flex-shrink-0">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white truncate">ForgeRank</h1>
        <p className="text-xs text-zinc-500 mt-1 truncate">Backlink Intelligence</p>
      </div>
      
      {/* Auth Section */}
      <div className="mb-4 pb-4 border-b border-forge-light">
        {isAuthenticated ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <User className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-300 truncate">
                {user?.email}
              </span>
            </div>
            {isPro && (
              <div className="px-2">
                <span className="text-xs bg-forge-orange/20 text-forge-orange px-2 py-1 rounded-full">
                  GROWTH
                </span>
              </div>
            )}
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setLoginModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-forge-orange text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </motion.button>
        )}
      </div>
      
      {tabs
        .filter(tab => {
          // Hide upgrade tab for Growth users
          if (tab.id === 'upgrade' && isPro) return false
          // Show Growth-only tabs only if user has Growth tier
          if ((tab as any).growthOnly && !isPro) return false
          return true
        })
        .map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        
        return (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex items-center gap-2 w-full px-3 py-2 rounded-lg
              transition-all duration-200 relative text-sm
              ${isActive 
                ? 'text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-forge-light'
              }
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-forge-orange rounded-lg"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Icon className="w-4 h-4 relative z-10 flex-shrink-0" />
            <span className="font-medium relative z-10 truncate">{tab.label}</span>
            
            {tab.id === 'upgrade' && !isPro && (
              <span className="ml-auto text-xs bg-forge-orange/20 text-forge-orange px-1.5 py-0.5 rounded-full relative z-10 flex-shrink-0">
                £9/mo
              </span>
            )}
          </motion.button>
        )
      })}
    </nav>
  )
}
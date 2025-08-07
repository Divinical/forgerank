import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Link, 
  LinkIcon, 
  Hash, 
  Settings, 
  Sparkles 
} from 'lucide-react'
import { useStore } from '../store/useStore'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracked-links', label: 'Tracked Links', icon: Link },
  { id: 'backlinks', label: 'Backlinks', icon: LinkIcon },
  { id: 'keywords', label: 'Keywords', icon: Hash },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'upgrade', label: 'Upgrade', icon: Sparkles },
] as const

export function SidebarTabSwitcher() {
  const { activeTab, setActiveTab } = useStore()
  
  return (
    <nav className="w-64 bg-forge-darker p-4 flex flex-col gap-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">ForgeRank</h1>
        <p className="text-xs text-zinc-500 mt-1">Backlink Intelligence</p>
      </div>
      
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        
        return (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex items-center gap-3 w-full px-4 py-3 rounded-xl
              transition-all duration-200 relative
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
                className="absolute inset-0 bg-forge-orange rounded-xl"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Icon className="w-5 h-5 relative z-10" />
            <span className="font-medium relative z-10">{tab.label}</span>
            
            {tab.id === 'upgrade' && (
              <span className="ml-auto text-xs bg-forge-orange/20 text-forge-orange px-2 py-1 rounded-full relative z-10">
                PRO
              </span>
            )}
          </motion.button>
        )
      })}
    </nav>
  )
}
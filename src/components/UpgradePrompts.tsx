// Strategic upgrade prompts for Growth tier conversion
// Triggers at key limit moments to maximize Starter → Growth conversion

import { motion } from 'framer-motion'
import { AlertCircle, Sparkles, TrendingUp, Search, ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'

// Domain limit reached prompt (primary conversion trigger)
export function DomainLimitPrompt() {
  const { setUpgradeModalOpen, setActiveTab } = useStore()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-forge-orange/20 to-orange-600/20 rounded-xl p-4 border border-forge-orange/30"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-forge-orange flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">Domain Limit Reached</h4>
          <p className="text-sm text-zinc-300 mb-3">
            You've hit the Starter tier limit. Upgrade to Growth to track <strong>10 domains</strong> + 
            get Smart Site Scanning for competitor analysis.
          </p>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setUpgradeModalOpen(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Growth - £9/month
            </motion.button>
            <button
              onClick={() => setActiveTab('upgrade')}
              className="text-sm text-forge-orange hover:text-orange-400 transition-colors"
            >
              Compare plans →
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Backlinks limit approaching prompt (secondary conversion trigger)
export function BacklinksLimitPrompt({ currentCount, limit }: { currentCount: number, limit: number }) {
  const { setUpgradeModalOpen } = useStore()
  const percentage = (currentCount / limit) * 100
  
  if (percentage < 80) return null // Only show when approaching limit
  
  const isAtLimit = currentCount >= limit
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border ${
        isAtLimit 
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-forge-orange/10 border-forge-orange/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          isAtLimit ? 'text-red-400' : 'text-forge-orange'
        }`} />
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">
            {isAtLimit ? 'Backlink Storage Full' : 'Storage Almost Full'}
          </h4>
          <p className="text-sm text-zinc-300 mb-2">
            {isAtLimit 
              ? 'You\'ve reached the 50 backlink limit. New backlinks will replace old ones.'
              : `${currentCount}/${limit} backlinks stored (${Math.round(percentage)}% full)`
            }
          </p>
          <div className="w-full bg-zinc-700 rounded-full h-2 mb-3">
            <motion.div
              className={`h-2 rounded-full ${
                isAtLimit ? 'bg-red-500' : 'bg-forge-orange'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentage, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-sm text-zinc-400 mb-3">
            <strong>Growth tier</strong> offers unlimited backlink storage + 6-month history retention.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setUpgradeModalOpen(true)}
            className="btn-primary text-sm"
          >
            Get Unlimited Storage - £9/month
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// Smart Site Scanning teaser (Growth feature preview)
export function SmartScanningTeaser() {
  const { setUpgradeModalOpen, setActiveTab } = useStore()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-500/30"
    >
      <div className="text-center">
        <Search className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h4 className="text-xl font-semibold text-white mb-2">
          Missing Competitor Backlinks?
        </h4>
        <p className="text-zinc-300 mb-4">
          Growth tier includes <strong>Smart Site Scanning</strong> - automatically discover 
          where your competitors are getting their backlinks from.
        </p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6 text-left">
          <div className="bg-forge-dark/50 rounded-lg p-3">
            <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-sm text-zinc-300">
              <strong>Queue competitor sites</strong><br />
              <span className="text-zinc-400">Up to 10 sites for analysis</span>
            </p>
          </div>
          <div className="bg-forge-dark/50 rounded-lg p-3">
            <Search className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-sm text-zinc-300">
              <strong>Intelligent crawling</strong><br />
              <span className="text-zinc-400">Targets high-value pages automatically</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setUpgradeModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade for £9/month
          </motion.button>
          <button
            onClick={() => setActiveTab('smart-scanning')}
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            Preview Feature <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Comprehensive value prop prompt (for dashboard/general areas)
export function GrowthValuePrompt() {
  const { setUpgradeModalOpen, setActiveTab } = useStore()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-forge-orange/20 to-orange-600/20 rounded-xl p-6"
    >
      <div className="flex items-start gap-4">
        <div className="bg-forge-orange rounded-full p-3">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="text-xl font-semibold text-white mb-2">
            Ready to Scale Your Backlink Strategy?
          </h4>
          <p className="text-zinc-300 mb-4">
            Growth tier unlocks professional SEO tools at startup prices - still <strong>90% cheaper</strong> than 
            Ahrefs (£99+) and SEMrush (£130+).
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-forge-orange mb-1">10</div>
              <div className="text-sm text-zinc-400">Tracked Domains</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500 mb-1">∞</div>
              <div className="text-sm text-zinc-400">Backlink Storage</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500 mb-1">6mo</div>
              <div className="text-sm text-zinc-400">History Retention</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setUpgradeModalOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              Start Growth - £9/month
            </motion.button>
            <button
              onClick={() => setActiveTab('upgrade')}
              className="text-forge-orange hover:text-orange-400 transition-colors"
            >
              Compare all features →
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
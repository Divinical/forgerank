import { motion } from 'framer-motion'
import { Check, X, Sparkles, Zap } from 'lucide-react'
import { useStore } from '../store/useStore'

const features = [
  { feature: 'Real-time passive monitoring', starter: true, growth: true },
  { feature: 'Tracked domains', starter: '2 domains', growth: '10 domains' },
  { feature: 'Backlinks stored', starter: '50 backlinks', growth: 'Unlimited' },
  { feature: 'History retention', starter: '7 days', growth: '6 months' },
  { feature: 'Keyword extraction', starter: 'Basic algorithms', growth: 'Advanced + niche detection' },
  { feature: 'Smart Site Scanning', starter: false, growth: true },
  { feature: 'Competitor intelligence', starter: false, growth: true },
  { feature: 'Export formats', starter: false, growth: 'Enhanced CSV' },
  { feature: 'Browser notifications', starter: 'Essential', growth: 'Priority alerts' },
]

export function Upgrade() {
  const { isPro, isAuthenticated, setLoginModalOpen, setUpgradeModalOpen } = useStore()
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">
          Choose Your ForgeRank Plan
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          Professional SEO insights at startup prices - find hidden backlinks automatically
        </p>
      </div>
      
      {/* Two-Tier Pricing */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-8">
        
        {/* Starter Tier (Free) */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-forge-light rounded-2xl p-6 border border-zinc-700"
        >
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white mb-1">
              Starter
            </h3>
            <p className="text-zinc-400 text-sm">Perfect for testing the waters</p>
          </div>
          
          <div className="mb-6">
            <span className="text-3xl font-bold text-white">£0</span>
            <span className="text-zinc-400">/month</span>
            <p className="text-xs text-zinc-500 mt-1">Forever free</p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-secondary mb-6 text-sm py-2"
            disabled={!isPro} // Already on free tier
          >
            {!isPro ? 'Current Plan' : 'Downgrade'}
          </motion.button>
          
          <ul className="space-y-2">
            {features.map((item) => (
              <li key={`starter-${item.feature}`} className="flex items-start gap-2">
                {item.starter ? (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                )}
                <span className={`text-sm ${item.starter ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {item.feature}
                  {typeof item.starter === 'string' && (
                    <span className="text-zinc-400 text-xs ml-1">({item.starter})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Growth Tier */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-forge-light rounded-2xl p-6 border-2 border-forge-orange relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-forge-orange text-white px-3 py-1 rounded-bl-xl text-xs font-medium">
            RECOMMENDED
          </div>
          
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              Growth <Sparkles className="w-5 h-5 text-forge-orange" />
            </h3>
            <p className="text-zinc-400 text-sm">For serious growth</p>
          </div>
          
          <div className="mb-6">
            <span className="text-3xl font-bold text-white">£9</span>
            <span className="text-zinc-400">/month</span>
            <p className="text-xs text-zinc-500 mt-1">90% cheaper than Ahrefs (£99+)</p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-primary mb-6 flex items-center justify-center gap-2 text-sm py-2"
            onClick={() => {
              if (!isAuthenticated) {
                setLoginModalOpen(true)
              } else {
                setUpgradeModalOpen(true)
              }
            }}
          >
            <Zap className="w-4 h-4" />
            {isPro ? 'Current Plan' : 'Start Growth'}
          </motion.button>
          
          <ul className="space-y-2">
            {features.map((item) => (
              <li key={`growth-${item.feature}`} className="flex items-start gap-2">
                {item.growth ? (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                )}
                <span className={`text-sm ${item.growth ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {item.feature}
                  {typeof item.growth === 'string' && (
                    <span className="text-forge-orange text-xs ml-1">({item.growth})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
      
      {/* Value Proposition Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-r from-forge-orange/20 to-orange-600/20 rounded-2xl p-6 text-center"
      >
        <h3 className="text-xl font-bold text-white mb-3">
          {isPro ? 'Smart Discovery in Action' : isAuthenticated ? 'Ready to Scale Up?' : 'Start Finding Hidden Backlinks Today'}
        </h3>
        <p className="text-zinc-300 mb-6 max-w-xl mx-auto text-sm">
          {isPro 
            ? 'Your Growth tier is actively discovering backlinks as you browse. Check your dashboard for real-time insights.'
            : isAuthenticated 
              ? 'You\'re already on the Starter tier. Upgrade to Growth for Smart Site Scanning and competitor intelligence.'
              : 'Sign in to get started with the Starter tier (free forever) and discover backlinks automatically as you browse the web.'
          }
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {!isPro && isAuthenticated && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary px-6 py-2 text-sm"
              onClick={() => window.location.hash = '#/dashboard'}
            >
              View Your Dashboard
            </motion.button>
          )}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary px-6 py-2 text-sm"
            onClick={() => {
              if (!isAuthenticated) {
                setLoginModalOpen(true)
              } else if (!isPro) {
                setUpgradeModalOpen(true)
              } else {
                window.location.hash = '#/smart-scanning'
              }
            }}
          >
            {isPro ? 'Use Smart Scanning' : isAuthenticated ? 'Upgrade to Growth' : 'Get Started Free'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
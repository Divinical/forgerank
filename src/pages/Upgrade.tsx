import { motion } from 'framer-motion'
import { Check, X, Sparkles, Zap } from 'lucide-react'
import { useStore } from '../store/useStore'

const features = [
  { feature: 'Passive backlink scanning', free: true, pro: true },
  { feature: 'Track URLs', free: 'Up to 3', pro: 'Up to 20' },
  { feature: 'Backlink detection', free: true, pro: true },
  { feature: 'Keyword extraction', free: 'Basic', pro: 'Advanced filtering' },
  { feature: 'Export to CSV', free: false, pro: true },
  { feature: 'Broken link detection', free: false, pro: true },
  { feature: 'Source metadata', free: false, pro: true },
  { feature: 'Priority support', free: false, pro: true },
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
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          Unlock the Full Power of ForgeRank
        </h2>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
          Get advanced features and insights to supercharge your backlink monitoring
        </p>
      </div>
      
      {/* Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
        {/* Free Tier */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-forge-light rounded-2xl p-8 border border-forge-lighter"
        >
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
            <p className="text-zinc-400">Perfect for getting started</p>
          </div>
          
          <div className="mb-8">
            <span className="text-4xl font-bold text-white">£0</span>
            <span className="text-zinc-400">/month</span>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-secondary mb-8"
            disabled={!isPro}
          >
            {isPro ? 'Current Plan' : 'Get Started'}
          </motion.button>
          
          <ul className="space-y-3">
            {features.filter(f => f.free).map((item) => (
              <li key={item.feature} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-300">
                  {item.feature}
                  {typeof item.free === 'string' && (
                    <span className="text-zinc-500 text-sm ml-1">({item.free})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
        
        {/* Pro Tier */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-forge-light rounded-2xl p-8 border-2 border-forge-orange relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 bg-forge-orange text-white px-4 py-1 rounded-bl-xl text-sm font-medium">
            POPULAR
          </div>
          
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              Pro <Sparkles className="w-6 h-6 text-forge-orange" />
            </h3>
            <p className="text-zinc-400">For serious link builders</p>
          </div>
          
          <div className="mb-8">
            <span className="text-4xl font-bold text-white">£5</span>
            <span className="text-zinc-400">/month</span>
            <p className="text-sm text-zinc-500 mt-2">or £49/year (save £11)</p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full btn-primary mb-8 flex items-center justify-center gap-2"
            onClick={() => {
              if (!isAuthenticated) {
                setLoginModalOpen(true)
              } else {
                setUpgradeModalOpen(true)
              }
            }}
          >
            <Zap className="w-4 h-4" />
            {isPro ? 'Manage Subscription' : 'Start 7-Day Free Trial'}
          </motion.button>
          
          <ul className="space-y-3">
            {features.map((item) => (
              <li key={item.feature} className="flex items-start gap-3">
                {item.pro ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-0.5" />
                )}
                <span className={item.pro ? 'text-zinc-300' : 'text-zinc-600'}>
                  {item.feature}
                  {typeof item.pro === 'string' && (
                    <span className="text-forge-orange text-sm ml-1">({item.pro})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
      
      {/* Trial Banner */}
      {!isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-forge-orange/20 to-orange-600/20 rounded-2xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-3">
            Try Pro Free for 7 Days
          </h3>
          <p className="text-zinc-300 mb-6 max-w-xl mx-auto">
            No credit card required. Get instant access to all Pro features and see the difference.
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary text-lg px-8 py-3"
            onClick={() => {
              if (!isAuthenticated) {
                setLoginModalOpen(true)
              } else {
                setUpgradeModalOpen(true)
              }
            }}
          >
            Start Your Free Trial
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  )
}
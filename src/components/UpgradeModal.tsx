import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, CreditCard, Calendar } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'

export function UpgradeModal() {
  const { isUpgradeModalOpen, setUpgradeModalOpen, user } = useStore()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  
  const features = [
    'Track up to 20 URLs',
    'Export data to CSV',
    'Advanced keyword filtering',
    'Broken link detection',
    'Source metadata analysis',
    'Priority support',
  ]
  
  const handleUpgrade = () => {
    // Replace these with your actual Stripe payment links
    const stripeLinks = {
      monthly: import.meta.env.VITE_STRIPE_MONTHLY_LINK || 'https://buy.stripe.com/your-monthly-link',
      yearly: import.meta.env.VITE_STRIPE_YEARLY_LINK || 'https://buy.stripe.com/your-yearly-link'
    }
    
    // Prefill with user email if available
    const link = billingCycle === 'monthly' ? stripeLinks.monthly : stripeLinks.yearly
    const finalLink = user?.email ? `${link}?prefilled_email=${encodeURIComponent(user.email)}` : link
    
    window.open(finalLink, '_blank')
    setUpgradeModalOpen(false)
  }
  
  return (
    <AnimatePresence>
      {isUpgradeModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setUpgradeModalOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-forge-light rounded-2xl p-8 max-w-lg w-full relative">
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Upgrade to ForgeRank Pro</h2>
                <p className="text-zinc-400">Start your 7-day free trial today</p>
              </div>
              
              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    billingCycle === 'monthly' 
                      ? 'bg-forge-orange text-white' 
                      : 'bg-forge-lighter text-zinc-400'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    billingCycle === 'yearly' 
                      ? 'bg-forge-orange text-white' 
                      : 'bg-forge-lighter text-zinc-400'
                  }`}
                >
                  Yearly
                  <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Save £11
                  </span>
                </button>
              </div>
              
              {/* Pricing */}
              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-white">
                  {billingCycle === 'monthly' ? '£5' : '£49'}
                </div>
                <div className="text-zinc-400">
                  per {billingCycle === 'monthly' ? 'month' : 'year'}
                </div>
              </div>
              
              {/* Features */}
              <div className="bg-forge-darker rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Pro Features Include:</h3>
                <ul className="space-y-3">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Trial Info */}
              <div className="bg-forge-orange/10 border border-forge-orange/30 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-forge-orange" />
                  <p className="text-sm text-forge-orange">
                    Free for 7 days, then {billingCycle === 'monthly' ? '£5/month' : '£49/year'}
                  </p>
                </div>
              </div>
              
              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpgrade}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Start Free Trial
              </motion.button>
              
              <p className="text-xs text-zinc-500 text-center mt-4">
                Cancel anytime. No questions asked.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
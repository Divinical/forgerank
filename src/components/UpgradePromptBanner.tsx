import { motion } from 'framer-motion'
import { X, Sparkles, Zap } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'

interface UpgradePromptBannerProps {
  trigger: 'first_backlink' | 'time_based' | 'url_limit'
  onDismiss?: () => void
}

export function UpgradePromptBanner({ trigger, onDismiss }: UpgradePromptBannerProps) {
  const { isPro, isAuthenticated, setActiveTab, setLoginModalOpen } = useStore()
  const [isVisible, setIsVisible] = useState(true)

  // Don't show if user is already Pro
  if (isPro || !isVisible) return null

  const handleDismiss = () => {
    setIsVisible(false)
    // Store dismissal in localStorage with timestamp
    const dismissalKey = `upgrade_prompt_dismissed_${trigger}`
    localStorage.setItem(dismissalKey, Date.now().toString())
    onDismiss?.()
  }

  const handleUpgradeClick = () => {
    if (!isAuthenticated) {
      setLoginModalOpen(true)
    } else {
      setActiveTab('upgrade')
    }
  }

  const getPromptContent = () => {
    switch (trigger) {
      case 'first_backlink':
        return {
          title: '🎉 Great! You found your first backlink!',
          description: 'Ready to discover more? Growth tier adds Smart Site Scanning to analyze competitor backlinks automatically.',
          cta: 'Unlock Smart Scanning - £9/month'
        }
      case 'time_based':
        return {
          title: '👋 How\'s ForgeRank working for you?',
          description: 'After using ForgeRank, you\'re ready for Growth tier features like Smart Site Scanning and unlimited storage.',
          cta: 'Explore Growth Features - £9/month'
        }
      case 'url_limit':
        return {
          title: '🚀 Ready to track more domains?',
          description: 'You\'re at your 2-domain limit on Starter tier. Growth tier lets you track 10 domains with Smart Site Scanning.',
          cta: 'Upgrade to Growth - £9/month'
        }
      default:
        return {
          title: '🚀 Ready for more power?',
          description: 'Growth tier adds Smart Site Scanning and competitor intelligence for just £9/month.',
          cta: 'View Growth Features'
        }
    }
  }

  const { title, description, cta } = getPromptContent()

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-r from-forge-orange/20 to-orange-600/20 rounded-2xl p-4 mb-6 border border-forge-orange/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            {title}
            <Sparkles className="w-5 h-5 text-forge-orange" />
          </h3>
          <p className="text-zinc-300 text-sm mb-4">
            {description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUpgradeClick}
              className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
            >
              <Zap className="w-4 h-4" />
              {cta}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDismiss}
              className="btn-secondary text-sm px-4 py-2"
            >
              Maybe Later
            </motion.button>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDismiss}
          className="p-1 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  )
}

// Hook to check if upgrade prompt should be shown
export function useUpgradePromptTrigger() {
  const { backlinks, trackedUrls, isAuthenticated, isPro } = useStore()
  
  // Don't show prompts for Pro users
  if (isPro) return null

  // Simple synchronous check - store will handle the complexity
  const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true'
  if (!hasCompletedOnboarding) return null

  // Simple dismissal check using localStorage for now
  const isPromptDismissed = (trigger: string) => {
    const dismissalKey = `upgrade_prompt_dismissed_${trigger}`
    const dismissedAt = localStorage.getItem(dismissalKey)
    if (!dismissedAt) return false
    
    // Re-show prompts after 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    return parseInt(dismissedAt) > sevenDaysAgo
  }

  // Priority 1: First backlink celebration (highest conversion potential)
  if (backlinks.length === 1 && !isPromptDismissed('first_backlink')) {
    return 'first_backlink'
  }

  // Priority 2: URL limit reached (immediate need)
  if (trackedUrls.length >= 2 && !isPromptDismissed('url_limit')) {
    return 'url_limit'
  }

  // Priority 3: Time-based after value demonstration
  // Show after user has some experience (multiple backlinks found)
  if (isAuthenticated && backlinks.length >= 5 && !isPromptDismissed('time_based')) {
    // Check if user has been active for at least 24 hours
    const firstBacklinkTime = backlinks[backlinks.length - 1]?.created_at
    if (firstBacklinkTime) {
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000)
      const firstBacklinkTimestamp = new Date(firstBacklinkTime).getTime()
      if (firstBacklinkTimestamp < dayAgo) {
        return 'time_based'
      }
    }
  }

  return null
}
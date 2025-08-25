// Onboarding flow for new users - guides them to their first tracked URL
// Optimized for immediate value demonstration and Growth tier conversion

import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Search, CheckCircle, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'

interface OnboardingFlowProps {
  onComplete: () => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { trackedUrls, addTrackedUrl, isPro } = useStore()
  const [step, setStep] = useState(0)
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleAddUrl = async () => {
    setError('')
    setLoading(true)
    
    try {
      await addTrackedUrl(newUrl)
      setNewUrl('')
      setStep(step + 1)
    } catch (err: any) {
      setError(err.message || 'Failed to add URL')
    } finally {
      setLoading(false)
    }
  }
  
  const steps = [
    {
      title: "Welcome to ForgeRank! 🎯",
      subtitle: "The only real-time backlink discovery tool",
      content: (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div className="bg-forge-light p-4 rounded-xl">
              <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h4 className="font-semibold text-white mb-1">Real-time Discovery</h4>
              <p className="text-sm text-zinc-400">Find backlinks as you browse the web</p>
            </div>
            <div className="bg-forge-light p-4 rounded-xl">
              <Search className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h4 className="font-semibold text-white mb-1">Smart Detection</h4>
              <p className="text-sm text-zinc-400">No manual searching required</p>
            </div>
            <div className="bg-forge-light p-4 rounded-xl">
              <Sparkles className="w-8 h-8 text-forge-orange mx-auto mb-2" />
              <h4 className="font-semibold text-white mb-1">90% Cheaper</h4>
              <p className="text-sm text-zinc-400">vs Ahrefs £99+ & SEMrush £130+</p>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-zinc-300 mb-4">
              Let's get you set up! You'll start discovering backlinks in under 2 minutes.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep(1)}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      )
    },
    {
      title: "Add Your First Website",
      subtitle: "Start monitoring backlinks to your domain",
      content: (
        <div className="space-y-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-2">✨ Starter Tier (Free Forever)</h4>
            <ul className="text-sm text-blue-400 space-y-1">
              <li>• Monitor 2 domains</li>
              <li>• Store 50 backlinks</li>
              <li>• Real-time passive discovery</li>
              <li>• 7-day history</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300">
              Enter your website URL:
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleAddUrl()
                  }
                }}
                placeholder="yoursite.com"
                className="input-field flex-1"
                disabled={loading}
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault()
                  handleAddUrl()
                }}
                disabled={loading || !newUrl.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {loading ? 'Adding...' : 'Add Website'}
              </motion.button>
            </div>
            
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
          
          <div className="text-center text-sm text-zinc-400">
            <p>💡 <strong>Tip:</strong> Just enter your domain name (e.g., yoursite.com) - we'll automatically add https:// for you</p>
          </div>
        </div>
      )
    },
    {
      title: "Perfect! You're All Set! 🎉",
      subtitle: "ForgeRank is now monitoring for backlinks",
      content: (
        <div className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">Tracking Active!</h4>
            <p className="text-zinc-300">
              As you browse the web, ForgeRank will automatically detect when sites link to{' '}
              <span className="text-forge-orange font-medium">
                {trackedUrls[trackedUrls.length - 1] ? new URL(trackedUrls[trackedUrls.length - 1]).hostname : 'your site'}
              </span>
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-white">What happens next:</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-forge-orange rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">1</div>
                <div>
                  <p className="text-zinc-200 font-medium">Passive Discovery</p>
                  <p className="text-sm text-zinc-400">Browse the web normally - we'll find backlinks automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-forge-orange rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">2</div>
                <div>
                  <p className="text-zinc-200 font-medium">Real-time Alerts</p>
                  <p className="text-sm text-zinc-400">Get instant notifications when new backlinks are found</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-forge-orange rounded-full flex items-center justify-center text-white text-sm font-bold mt-0.5">3</div>
                <div>
                  <p className="text-zinc-200 font-medium">Dashboard Insights</p>
                  <p className="text-sm text-zinc-400">View all discovered backlinks in your dashboard</p>
                </div>
              </div>
            </div>
          </div>
          
          {!isPro && (
            <div className="bg-forge-orange/10 border border-forge-orange/30 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🚀 Want More Power?</h4>
              <p className="text-sm text-zinc-300 mb-3">
                Growth tier adds Smart Site Scanning to analyze competitor backlinks - still 90% cheaper than enterprise tools.
              </p>
              <p className="text-xs text-forge-orange font-medium">
                💡 After setup: Explore Growth features in the Upgrade tab for just £9/month
              </p>
            </div>
          )}
          
          <div className="text-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onComplete}
              className="btn-primary"
            >
              Go to Dashboard
            </motion.button>
          </div>
        </div>
      )
    }
  ]
  
  const currentStep = steps[step] || steps[steps.length - 1]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-forge-darker p-8 flex items-center justify-center"
    >
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Step {step + 1} of {steps.length}</span>
            <span className="text-sm text-zinc-400">{Math.round(((step + 1) / steps.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <motion.div
              className="bg-forge-orange h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        
        {/* Step content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-forge-light rounded-2xl p-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {currentStep.title}
            </h2>
            <p className="text-xl text-zinc-400">
              {currentStep.subtitle}
            </p>
          </div>
          
          {currentStep.content}
        </motion.div>
        
        {/* Skip option for later steps */}
        {step > 0 && step < steps.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={onComplete}
              className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              Skip onboarding
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
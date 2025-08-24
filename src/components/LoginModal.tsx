import { motion, AnimatePresence } from 'framer-motion'
import { X, Github, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useState } from 'react'

export function LoginModal() {
  const { isLoginModalOpen, setLoginModalOpen, signIn, resetPassword } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  
  const handleEmailAuth = async () => {
    setError('')
    setLoading(true)
    
    try {
      if (!email || !password) {
        throw new Error('Please enter email and password')
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      
      await signIn('email', email, password)
      // Success - modal will be closed by the signIn method
      setEmail('')
      setPassword('')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }
  
  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setError('')
    setLoading(true)
    
    try {
      await signIn(provider)
      // OAuth will redirect, so loading state may persist
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    setLoading(true)
    
    try {
      if (!email) {
        throw new Error('Please enter your email address first')
      }
      
      await resetPassword(email)
      setResetEmailSent(true)
      setShowForgotPassword(false)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }
  
  const handleClose = () => {
    setLoginModalOpen(false)
    setError('')
    setEmail('')
    setPassword('')
    setIsSignUp(false)
    setShowPassword(false)
    setShowForgotPassword(false)
    setResetEmailSent(false)
  }
  
  return (
    <AnimatePresence>
      {isLoginModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
            <div className="bg-forge-light rounded-2xl p-8 max-w-md w-full relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to ForgeRank</h2>
                <p className="text-zinc-400">Sign in to unlock Pro features</p>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-400">{error}</p>
                    {error.includes('Invalid email or password') && (
                      <p className="text-xs text-red-300 mt-1">
                        Double-check your credentials or use "Forgot your password?" below.
                      </p>
                    )}
                    {error.includes('No account found') && (
                      <p className="text-xs text-red-300 mt-1">
                        Contact support to create your Pro account.
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={loading}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-lg
                    font-medium transition-colors duration-200 flex items-center justify-center gap-3
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg
                    font-medium transition-colors duration-200 flex items-center justify-center gap-3
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </motion.button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-forge-lighter" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-forge-light text-zinc-500">or</span>
                  </div>
                </div>
                
                {/* Email/Password form */}
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="input-field"
                    disabled={loading}
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 characters)"
                      className={`input-field pr-12 ${password.length > 0 && password.length < 6 ? 'border-orange-500 focus:border-orange-500' : ''}`}
                      disabled={loading}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && handleEmailAuth()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEmailAuth}
                    disabled={loading}
                    className="w-full bg-forge-lighter hover:bg-zinc-700 text-white px-4 py-3 rounded-lg
                      font-medium transition-colors duration-200 flex items-center justify-center gap-3
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-5 h-5" />
                    {loading ? 'Processing...' : isSignUp ? 'Sign Up with Email' : 'Sign In with Email'}
                  </motion.button>

                  {/* Forgot Password Link */}
                  {!isSignUp && !resetEmailSent && (
                    <div className="text-center">
                      <button
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                        disabled={loading}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}

                  {/* Password Reset Success Message */}
                  {resetEmailSent && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-sm text-green-400 text-center">
                        Password reset email sent! Check your email for reset instructions.
                      </p>
                    </div>
                  )}

                  {/* Forgot Password Form */}
                  {showForgotPassword && (
                    <div className="p-4 bg-forge-lighter rounded-lg border border-zinc-600">
                      <h3 className="text-lg font-medium text-white mb-3">Reset Password</h3>
                      <p className="text-sm text-zinc-400 mb-3">
                        Enter your email address and we'll send you a reset link.
                      </p>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleForgotPassword}
                          disabled={loading || !email}
                          className="flex-1 bg-forge-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg
                            font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Sending...' : 'Send Reset Email'}
                        </motion.button>
                        <button
                          onClick={() => setShowForgotPassword(false)}
                          className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      setIsSignUp(!isSignUp)
                      setError('')
                      setShowForgotPassword(false)
                      setResetEmailSent(false)
                    }}
                    className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                    disabled={loading}
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </div>
              
              <p className="text-xs text-zinc-500 text-center mt-6">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
              
              <div className="mt-6 p-4 bg-forge-orange/10 rounded-lg">
                <p className="text-sm text-forge-orange text-center">
                  🎉 7-day free trial included with Pro upgrade
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
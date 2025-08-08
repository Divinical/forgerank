import { motion } from 'framer-motion'
import { LogIn, User } from 'lucide-react'
import { useStore } from '../store/useStore'

export function AuthButton() {
  const { isAuthenticated, user, setLoginModalOpen } = useStore()
  
  if (!isAuthenticated) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setLoginModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-forge-orange text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </motion.button>
    )
  }
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-forge-light rounded-lg">
      <User className="w-4 h-4 text-zinc-400" />
      <span className="text-sm text-zinc-300 truncate max-w-[150px]">
        {user?.email}
      </span>
    </div>
  )
}
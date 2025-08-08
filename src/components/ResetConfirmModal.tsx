import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'

interface ResetConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

export function ResetConfirmModal({ isOpen, onClose, onConfirm, isLoading }: ResetConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-forge-light rounded-2xl p-8 max-w-md w-full relative border border-red-500/20">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="text-center mb-8">
                <div className="bg-red-500/10 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Reset All Data</h2>
                <p className="text-zinc-400 leading-relaxed">
                  This will permanently delete all tracked links, backlinks, keywords, and preferences. 
                  This action cannot be undone. Are you sure?
                </p>
              </div>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-3 rounded-lg
                    font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg
                    font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Resetting...' : 'Reset Everything'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
import { motion } from 'framer-motion'
import { ExternalLink, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { format } from 'date-fns'

export function Backlinks() {
  const { backlinks, isPro, isAuthenticated } = useStore()
  
  const getStatusIcon = (backlink: any) => {
    if (!isPro) return null
    
    if (backlink.is_broken) {
      return <XCircle className="w-4 h-4 text-red-500" />
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }
  
  const getContextIcon = (contextType: string) => {
    switch (contextType) {
      case 'code':
        return '📦'
      case 'config':
        return '🧱'
      case 'comment':
        return '💬'
      default:
        return '🔗'
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <h2 className="text-3xl font-bold text-white mb-2">Backlinks</h2>
      <p className="text-zinc-400 mb-8">
        All backlinks discovered during your browsing sessions.
      </p>
      
      <div className="bg-forge-light rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-forge-lighter">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Source Page
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Anchor Text
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Discovered
                </th>
                {isPro && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-forge-lighter">
              {backlinks.length === 0 ? (
                <tr>
                  <td colSpan={isPro ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-12 h-12 text-zinc-600" />
                      <p className="text-zinc-400">
                        No backlinks discovered yet. Start browsing to find links to your tracked URLs.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                backlinks.map((backlink, index) => (
                  <motion.tr
                    key={backlink.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-forge-lighter/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-200 truncate max-w-xs" title={backlink.source_url}>
                          {backlink.source_domain}
                        </span>
                        <a
                          href={backlink.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-forge-orange transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-300">{backlink.anchor_text || 'No anchor text'}</span>
                      {isPro && backlink.context_type !== 'generic' && (
                        <span className="ml-2 text-xs bg-forge-orange/20 text-forge-orange px-2 py-1 rounded">
                          {getContextIcon(backlink.context_type)} {backlink.context_type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-zinc-400 text-sm truncate max-w-xs block" title={backlink.target_url}>
                        {backlink.target_url}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <Clock className="w-4 h-4" />
                        {format(new Date(backlink.first_seen_at), 'MMM dd, HH:mm')}
                      </div>
                    </td>
                    {isPro && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(backlink)}
                          <span className={`text-sm ${backlink.is_broken ? 'text-red-500' : 'text-green-500'}`}>
                            {backlink.is_broken ? 'Broken' : 'Active'}
                          </span>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {!isPro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-forge-orange/10 border border-forge-orange/30 rounded-xl p-4"
        >
          <p className="text-sm text-forge-orange">
            🔒 Upgrade to Pro to unlock broken link detection and source metadata
          </p>
        </motion.div>
      )}
      
      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <p className="text-sm text-blue-400">
            💡 Sign in to save unlimited backlinks and sync across devices
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
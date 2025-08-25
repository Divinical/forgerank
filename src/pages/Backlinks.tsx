import { motion } from 'framer-motion'
import { ExternalLink, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, FileText } from 'lucide-react'
import { useStore } from '../store/useStore'
import { format } from 'date-fns'
import { BacklinksLimitPrompt } from '../components/UpgradePrompts'
import { CSVExporter } from '../utils/csvExporter'

// Simple date formatting with fallback
function formatDate(dateValue: any, formatString: string, fallback: string = 'Unknown'): string {
  if (!dateValue) return fallback
  try {
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return fallback
    return format(date, formatString)
  } catch (error) {
    return fallback
  }
}

export function Backlinks() {
  const { backlinks, isPro, isAuthenticated, checkBacklinkHealth, isHealthCheckRunning, getDomainInsights } = useStore()
  const csvExporter = new CSVExporter()
  
  const getStatusIcon = (backlink: any) => {
    if (!isPro) return null
    
    // Show loading state during health check
    if (isHealthCheckRunning && (!backlink.last_checked_at || !backlink.http_status)) {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" 
             title="Checking link health..." />
      )
    }
    
    // Show status based on HTTP response
    if (backlink.http_status) {
      if (backlink.http_status >= 200 && backlink.http_status < 300) {
        return (
          <div title={`Healthy (${backlink.http_status})`}>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
        )
      } else if (backlink.http_status >= 300 && backlink.http_status < 400) {
        return (
          <div title={`Redirected (${backlink.http_status})`}>
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          </div>
        )
      } else if (backlink.http_status >= 400) {
        return (
          <div title={`Broken (${backlink.http_status})`}>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
        )
      }
    }
    
    // Fallback based on is_broken flag
    if (backlink.is_broken) {
      return (
        <div title="Link appears to be broken">
          <XCircle className="w-4 h-4 text-red-500" />
        </div>
      )
    }
    
    // Show neutral state for unchecked links
    if (backlink.last_checked_at) {
      return (
        <div title="Link checked and working">
          <CheckCircle className="w-4 h-4 text-green-500" />
        </div>
      )
    }
    
    // Default state - not checked yet
    return (
      <div title="Click 'Check Link Health' to verify this link">
        <Clock className="w-4 h-4 text-zinc-400" />
      </div>
    )
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
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Backlinks</h2>
          <p className="text-zinc-400">
            All backlinks discovered during your browsing sessions.
          </p>
        </div>
        
        {backlinks.length > 0 && (
          <div className="flex gap-3">
            {isAuthenticated && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => csvExporter.exportBacklinks(backlinks)}
                className="btn-secondary flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Export CSV
              </motion.button>
            )}
            
            {isPro && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => checkBacklinkHealth()}
                disabled={isHealthCheckRunning}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isHealthCheckRunning ? 'animate-spin' : ''}`} />
                {isHealthCheckRunning ? 'Checking...' : 'Check Health'}
              </motion.button>
            )}
          </div>
        )}
      </div>
      
      {!isPro && (
        <div className="mb-6">
          <BacklinksLimitPrompt currentCount={backlinks.length} limit={50} />
        </div>
      )}
      
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
                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                    className="hover:bg-forge-lighter/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="text-zinc-200 truncate max-w-xs block" title={backlink.source_url}>
                            {backlink.source_domain}
                          </span>
                          {isPro && (
                            <div className="text-xs text-zinc-400">
                              DA: {getDomainInsights(backlink.source_domain).authority}/100
                            </div>
                          )}
                        </div>
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
                        {formatDate(backlink.first_seen_at || backlink.created_at, 'MMM dd, HH:mm')}
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
      
      {!isPro && backlinks.length > 0 && (
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
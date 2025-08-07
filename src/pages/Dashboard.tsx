import { motion } from 'framer-motion'
import { TrendingUp, Link, Hash, Clock } from 'lucide-react'
import { useStore } from '../store/useStore'
import { format } from 'date-fns'

export function Dashboard() {
  const { trackedUrls, backlinks, keywords, isAuthenticated } = useStore()
  
  // Calculate stats
  const totalBacklinks = backlinks.length
  const totalKeywords = keywords.length
  const lastScan = backlinks.length > 0 
    ? format(new Date(backlinks[0].created_at), 'MMM dd, HH:mm')
    : 'Never'
  
  const recentBacklinks = backlinks.slice(0, 5)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8"
    >
      <h2 className="text-3xl font-bold text-white mb-2">Welcome to ForgeRank</h2>
      <p className="text-zinc-400 mb-8">
        Monitor backlinks and keywords in real-time as you browse.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          icon={Link}
          label="Tracked Links"
          value={trackedUrls.length.toString()}
          change={isAuthenticated ? "Synced" : "Local"}
          color="text-blue-500"
        />
        <StatsCard
          icon={TrendingUp}
          label="Total Backlinks"
          value={totalBacklinks.toString()}
          change={totalBacklinks > 0 ? `+${totalBacklinks} found` : "Start browsing"}
          color="text-green-500"
        />
        <StatsCard
          icon={Hash}
          label="Keywords Found"
          value={totalKeywords.toString()}
          change={totalKeywords > 0 ? "Extracted" : "No data yet"}
          color="text-purple-500"
        />
        <StatsCard
          icon={Clock}
          label="Last Scan"
          value={lastScan}
          change={backlinks.length > 0 ? "Active" : "Waiting"}
          color="text-orange-500"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Getting Started */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Getting Started</h3>
          <ol className="space-y-3 text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="bg-forge-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                1
              </span>
              <span>Add your domains or pages to track in the Tracked Links tab</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-forge-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                2
              </span>
              <span>Browse the web normally - ForgeRank automatically scans pages</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-forge-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                3
              </span>
              <span>View discovered backlinks and keywords in their respective tabs</span>
            </li>
          </ol>
        </div>
        
        {/* Recent Backlinks */}
        <div className="bg-forge-light rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Recent Backlinks</h3>
          {recentBacklinks.length === 0 ? (
            <p className="text-zinc-400">No backlinks found yet. Start browsing!</p>
          ) : (
            <div className="space-y-3">
              {recentBacklinks.map((backlink) => (
                <div key={backlink.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">
                      {backlink.anchor_text || 'No anchor text'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      from {backlink.source_domain}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {format(new Date(backlink.created_at), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {!isAuthenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-6 text-center"
        >
          <h3 className="text-xl font-semibold text-white mb-2">
            Unlock Your Full Potential
          </h3>
          <p className="text-zinc-300 mb-4">
            Sign in to sync across devices and access Pro features
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => useStore.getState().setLoginModalOpen(true)}
            className="btn-primary"
          >
            Get Started Free
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  )
}

function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  color 
}: { 
  icon: any
  label: string
  value: string
  change: string
  color: string
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-forge-light rounded-2xl p-6 border border-forge-lighter"
    >
      <div className="flex items-center justify-between mb-4">
        <Icon className={`w-8 h-8 ${color}`} />
        <span className="text-xs text-zinc-500">{change}</span>
      </div>
      <h4 className="text-2xl font-bold text-white">{value}</h4>
      <p className="text-sm text-zinc-400 mt-1">{label}</p>
    </motion.div>
  )
}
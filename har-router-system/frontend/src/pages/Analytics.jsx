import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts'
import { getSummary, getAccuracy, getAnalyticsLogs } from '../services/ApiService'

const COLORS = { WALKING: '#5b8dee', WALKING_UPSTAIRS: '#9b72e8', WALKING_DOWNSTAIRS: '#2aa8c4', SITTING: '#2d9e7a', STANDING: '#e0a020', LAYING: '#b06fd8' }

export default function Analytics() {
  const [summary,  setSummary]  = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [logs,     setLogs]     = useState([])
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    getSummary().then(setSummary).catch(() => setError('No prediction data yet.'))
    getAccuracy().then(setAccuracy).catch(() => {})
    getAnalyticsLogs(20).then(d => setLogs(d.logs || [])).catch(() => {})
  }, [])

  const barData = summary
    ? Object.entries(summary.activity_distribution).map(([name, value]) => ({
        name: name.replace(/_/g, ' '), value, fill: COLORS[name] || '#6b7280',
      }))
    : []

  const lineData = logs.map((l, i) => ({
    name: `#${logs.length - i}`,
    confidence: parseFloat((Math.max(...Object.values(l.probabilities)) * 100).toFixed(1))
  })).reverse()

  const filteredLogs = search.trim()
    ? logs.filter(l => l.predicted_activity.toLowerCase().includes(search.trim().toLowerCase()))
    : logs

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Model Routing Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Comprehensive analysis of activity clusters and routing efficiency.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5">
        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden">
          <p className="font-bold text-gray-900 mb-1">Activity Cluster Distribution</p>
          <p className="text-xs text-gray-500 mb-4">Frequency of classified activity categories</p>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[400px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {barData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden">
          <p className="font-bold text-gray-900 mb-1">Prediction Confidence Over Time</p>
          <p className="text-xs text-gray-500 mb-3">Recent prediction confidence scores</p>
          {accuracy && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                Baseline {(accuracy.baseline_accuracy * 100).toFixed(1)}%
              </span>
              <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                Routed {(accuracy.routed_accuracy * 100).toFixed(1)}%
              </span>
              <span className="bg-green-50 text-green-800 border border-green-200 text-xs font-semibold px-2.5 py-1 rounded-full">
                +{(accuracy.accuracy_uplift * 100).toFixed(1)}% uplift
              </span>
            </div>
          )}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[400px]">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Line type="monotone" dataKey="confidence" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Logs table */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Recent Routing Logs</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {search.trim()
                  ? `${filteredLogs.length} result${filteredLogs.length !== 1 ? 's' : ''} for "${search}"`
                  : 'Detailed history of prediction requests and system routing.'}
              </p>
            </div>
            {/* Activity search */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all md:w-64">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search activity..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto -mx-5">
            <div className="min-w-[500px] px-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Log ID</th>
                  <th className="px-5 py-3 text-left">Timestamp</th>
                  <th className="px-5 py-3 text-left">Activity Type</th>
                  <th className="px-5 py-3 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">
                      No logs found for "{search}"
                    </td>
                  </tr>
                ) : filteredLogs.map((log, i) => {
                  const conf  = (Math.max(...Object.values(log.probabilities)) * 100).toFixed(1)
                  const color = COLORS[log.predicted_activity] || '#6b7280'
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">LOG-{4821 - i}</td>
                      <td className="px-5 py-3 text-gray-600 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-gray-700 font-medium">{log.predicted_activity.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{conf}%</span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${conf}%`, background: color }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

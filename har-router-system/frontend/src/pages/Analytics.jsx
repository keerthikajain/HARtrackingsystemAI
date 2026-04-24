import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie, Legend
} from 'recharts'
import { getSummary, getAccuracy, getAnalyticsLogs, getClusters } from '../services/ApiService'

const ACT_COLORS = {
  WALKING: '#5b8dee', WALKING_UPSTAIRS: '#9b72e8', WALKING_DOWNSTAIRS: '#2aa8c4',
  SITTING: '#2d9e7a', STANDING: '#e0a020', LAYING: '#b06fd8',
}
const CLUSTER_COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#a855f7','#e11d48','#0d9488']

export default function Analytics() {
  const [summary,  setSummary]  = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [clusters, setClusters] = useState([])
  const [logs,     setLogs]     = useState([])
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    getSummary().then(setSummary).catch(() => setError('No prediction data yet.'))
    getAccuracy().then(setAccuracy).catch(() => {})
    getClusters().then(d => setClusters(d.clusters || [])).catch(() => {})
    getAnalyticsLogs(20).then(d => setLogs(d.logs || [])).catch(() => {})
  }, [])

  const activityBarData = summary
    ? Object.entries(summary.activity_distribution).map(([name, value]) => ({
        name: name.replace(/_/g, ' '), value, fill: ACT_COLORS[name] || '#6b7280',
      }))
    : []

  const clusterPieData = clusters
    .filter(c => c.sample_count > 0)
    .map((c, i) => ({
      name:  `Cluster ${c.cluster_id}`,
      value: c.sample_count,
      fill:  CLUSTER_COLORS[i % CLUSTER_COLORS.length],
    }))

  const clusterRoutingData = clusters
    .filter(c => c.routing_count > 0)
    .map((c, i) => ({
      name:  `C${c.cluster_id}`,
      value: c.routing_count,
      fill:  CLUSTER_COLORS[i % CLUSTER_COLORS.length],
    }))

  const lineData = logs.map((l, i) => ({
    name:       `#${logs.length - i}`,
    confidence: parseFloat((Math.max(...Object.values(l.probabilities)) * 100).toFixed(1)),
    cluster:    l.cluster,
  })).reverse()

  const filteredLogs = search.trim()
    ? logs.filter(l => l.predicted_activity.toLowerCase().includes(search.trim().toLowerCase()))
    : logs

  const MetricBadge = ({ label, value, color }) => (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl border ${color}`}>
      <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-xl font-extrabold mt-0.5">{value}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Model Routing Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Baseline vs routed model performance, cluster distribution, and routing logs.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {/* ── Accuracy comparison ── */}
      {accuracy && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="font-bold text-gray-900 mb-1">Baseline vs Routed Model</p>
          <p className="text-xs text-gray-500 mb-4">
            {accuracy.n_clusters
              ? `Trained with ${accuracy.n_clusters} clusters, ${accuracy.n_cluster_models} specialist models`
              : 'Train a model to see comparison'}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricBadge label="Baseline Acc"  value={`${(accuracy.baseline_accuracy * 100).toFixed(1)}%`}  color="bg-amber-50 border-amber-200 text-amber-800" />
            <MetricBadge label="Routed Acc"    value={`${(accuracy.routed_accuracy * 100).toFixed(1)}%`}    color="bg-blue-50 border-blue-200 text-blue-800" />
            <MetricBadge label="Uplift"        value={`${accuracy.accuracy_uplift >= 0 ? '+' : ''}${(accuracy.accuracy_uplift * 100).toFixed(1)}%`} color="bg-green-50 border-green-200 text-green-800" />
            <MetricBadge label="Routed F1"     value={accuracy.routed_f1 ? `${(accuracy.routed_f1 * 100).toFixed(1)}%` : '--'} color="bg-purple-50 border-purple-200 text-purple-800" />
          </div>

          {/* ROC-AUC + Silhouette Score */}
          <div className="flex flex-wrap gap-3 mb-4">
            {accuracy.baseline_roc_auc != null && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Baseline ROC-AUC</span>
                <span className="text-sm font-extrabold text-gray-900">{(accuracy.baseline_roc_auc * 100).toFixed(2)}%</span>
              </div>
            )}
            {accuracy.routed_roc_auc != null && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Routed ROC-AUC</span>
                <span className="text-sm font-extrabold text-gray-900">{(accuracy.routed_roc_auc * 100).toFixed(2)}%</span>
              </div>
            )}
            {accuracy.silhouette_score != null && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${accuracy.silhouette_score > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Silhouette Score</span>
                <span className={`text-sm font-extrabold ${accuracy.silhouette_score > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {accuracy.silhouette_score.toFixed(4)}
                  <span className="text-xs font-normal ml-1">{accuracy.silhouette_score > 0 ? '— meaningful clusters' : '— poor clustering'}</span>
                </span>
              </div>
            )}
          </div>

          {accuracy.baseline_f1 != null && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Metric</th>
                    <th className="px-4 py-2 text-right">Baseline</th>
                    <th className="px-4 py-2 text-right">Routed</th>
                    <th className="px-4 py-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label: 'Accuracy',  b: accuracy.baseline_accuracy,  r: accuracy.routed_accuracy  },
                    { label: 'F1 Score',  b: accuracy.baseline_f1,        r: accuracy.routed_f1        },
                    { label: 'Precision', b: accuracy.baseline_precision,  r: accuracy.routed_precision },
                    { label: 'Recall',    b: accuracy.baseline_recall,     r: accuracy.routed_recall    },
                    ...(accuracy.baseline_roc_auc != null ? [{ label: 'ROC-AUC', b: accuracy.baseline_roc_auc, r: accuracy.routed_roc_auc }] : []),
                  ].map(row => {
                    const diff = row.r - row.b
                    return (
                      <tr key={row.label} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-700">{row.label}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{(row.b * 100).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">{(row.r * 100).toFixed(2)}%</td>
                        <td className={`px-4 py-2 text-right font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(2)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Activity distribution bar chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden">
          <p className="font-bold text-gray-900 mb-1">Activity Distribution</p>
          <p className="text-xs text-gray-500 mb-4">Frequency of each predicted activity</p>
          <div className="overflow-x-auto">
            <div className="min-w-[300px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activityBarData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {activityBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Cluster training distribution pie */}
        {clusterPieData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden">
            <p className="font-bold text-gray-900 mb-1">Training Cluster Distribution</p>
            <p className="text-xs text-gray-500 mb-4">How training windows were split across k-means clusters</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={clusterPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {clusterPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cluster routing live stats */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="font-bold text-gray-900 mb-1">Cluster Routing Stats</p>
          <p className="text-xs text-gray-500 mb-4">Per-cluster training samples, live routing count, and accuracy</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Cluster</th>
                  <th className="px-4 py-2 text-right">Training Samples</th>
                  <th className="px-4 py-2 text-right">Live Predictions Routed</th>
                  <th className="px-4 py-2 text-right">Cluster Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clusters.map((c, i) => (
                  <tr key={c.cluster_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
                        <span className="font-medium text-gray-700">Cluster {c.cluster_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{c.sample_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{c.routing_count ?? 0}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      {c.cluster_accuracy != null ? `${(c.cluster_accuracy * 100).toFixed(1)}%` : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confidence over time line chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden">
        <p className="font-bold text-gray-900 mb-1">Prediction Confidence Over Time</p>
        <p className="text-xs text-gray-500 mb-3">Recent prediction confidence scores (colour = cluster)</p>
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="confidence" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
                  : 'Detailed history of prediction requests and cluster routing.'}
              </p>
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all md:w-64">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search activity..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Timestamp</th>
                  <th className="px-5 py-3 text-left">Activity</th>
                  <th className="px-5 py-3 text-left">Cluster</th>
                  <th className="px-5 py-3 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No logs found for "{search}"</td></tr>
                ) : filteredLogs.map((log, i) => {
                  const conf  = (Math.max(...Object.values(log.probabilities)) * 100).toFixed(1)
                  const color = ACT_COLORS[log.predicted_activity] || '#6b7280'
                  const clusterColor = CLUSTER_COLORS[(log.cluster || 0) % CLUSTER_COLORS.length]
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-gray-700 font-medium">{log.predicted_activity.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: clusterColor + '20', color: clusterColor }}>
                          C{log.cluster ?? 0}
                        </span>
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
      )}
    </div>
  )
}

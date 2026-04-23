import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAccuracy, getLogs } from '../services/ApiService'
import axios from 'axios'
import { BASE_URL } from '../config/apiConfig'
import { Upload, Zap, BarChart2, ArrowRight } from 'lucide-react'

const api = axios.create({ baseURL: BASE_URL })

const ACTIVITY_COLORS = {
  WALKING: '#2563eb',
  WALKING_UPSTAIRS: '#7c3aed',
  WALKING_DOWNSTAIRS: '#0891b2',
  SITTING: '#059669',
  STANDING: '#d97706',
  LAYING: '#a855f7',
}

const CARDS = [
  {
    to: '/upload',
    Icon: Upload,
    title: 'Upload & Train',
    desc: 'Train baseline and routed HAR models.',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    to: '/predict',
    Icon: Zap,
    title: 'Run Prediction',
    desc: 'Classify activity from live sensor data.',
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    to: '/analytics',
    Icon: BarChart2,
    title: 'View Analytics',
    desc: 'Compare baseline vs routed performance.',
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [accuracy, setAccuracy] = useState(null)
  const [logs, setLogs]         = useState([])
  const [calories, setCalories] = useState(null)

  useEffect(() => {
    getAccuracy().then(setAccuracy).catch(() => {})
    getLogs(5).then(d => setLogs(d.logs || [])).catch(() => {})
    api.get('/analytics/calories?weight=70').then(r => setCalories(r.data.data)).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back!</h2>
        <p className="text-sm text-gray-500 mt-1">Manage training, prediction, and performance of HAR models.</p>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CARDS.map(({ to, Icon, title, desc, bg, iconBg, iconColor }) => (
          <div key={to} className={`${bg} rounded-2xl p-5 flex flex-col gap-3 border border-white`}>
            <div className={`${iconBg} ${iconColor} w-10 h-10 rounded-xl flex items-center justify-center`}>
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
            </div>
            <button
              onClick={() => navigate(to)}
              className={`${iconColor} text-sm font-semibold hover:underline text-left flex items-center gap-1`}
            >
              Get Started <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      {/* Accuracy stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Baseline Accuracy', value: accuracy ? `${(accuracy.baseline_accuracy * 100).toFixed(1)}%` : '--', color: 'text-gray-900' },
          { label: 'Routed Accuracy',   value: accuracy ? `${(accuracy.routed_accuracy * 100).toFixed(1)}%`   : '--', color: 'text-green-600' },
          { label: 'Accuracy Uplift',   value: accuracy ? `+${(accuracy.accuracy_uplift * 100).toFixed(1)}%`  : '--', color: 'text-blue-600'  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Calorie estimate */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Calories Burned Today</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {calories
                ? `Estimated from last 24 hours · ${calories.hours_tracked}h tracked`
                : 'Run predictions to see calorie estimates'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-orange-500">
              {calories ? calories.total_calories : '--'}
            </p>
            <p className="text-xs text-gray-400">kcal</p>
          </div>
        </div>
        {calories && Object.keys(calories.by_activity).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(calories.by_activity).sort((a, b) => b[1] - a[1]).map(([act, cal]) => (
              <div key={act} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-500 truncate">{act.replace(/_/g, ' ')}</p>
                <p className="text-sm font-bold text-gray-800">{cal} kcal</p>
              </div>
            ))}
          </div>
        )}
        {!calories && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['Walking', 'Standing', 'Sitting'].map(a => (
              <div key={a} className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">{a}</p>
                <p className="text-sm font-bold text-gray-300">-- kcal</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-start p-5 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900">Recent Predictions</h3>
              <p className="text-sm text-gray-500 mt-0.5">Latest activity classifications</p>
            </div>
            <button onClick={() => navigate('/analytics')} className="text-sm text-blue-600 font-semibold hover:underline">
              View All
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {logs.map((log, i) => (
              <div key={i} className="flex justify-between items-center px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_COLORS[log.predicted_activity] || '#6b7280' }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{log.predicted_activity.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{(Math.max(...Object.values(log.probabilities)) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">confidence</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

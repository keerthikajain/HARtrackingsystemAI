import { useState } from 'react'
import { getLogs, trainModels } from '../services/ApiService'

const DEFAULTS = {
  predictionInterval: 4000, windowSize: 50, sensitivity: 'medium',
  smoothing: true, confidenceThreshold: 0.5,
  showRawPrediction: false, showConfidence: true, darkTheme: false,
  saveLogs: true, showSensorValues: false,
}

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('harSettings') || '{}') } }
  catch { return DEFAULTS }
}
function saveSettings(s) { localStorage.setItem('harSettings', JSON.stringify(s)) }

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  Sensor: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  ),
  Brain: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  Display: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  Cog: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Download: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function Row({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 gap-6">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {desc && <span className="text-xs text-gray-400">{desc}</span>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`}
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Settings() {
  const [s, setS]               = useState(loadSettings)
  const [saved, setSaved]       = useState(false)
  const [status, setStatus]     = useState('')
  const [retraining, setRetraining] = useState(false)

  const update = (key, val) => {
    const next = { ...s, [key]: val }
    setS(next); saveSettings(next); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    if (key === 'darkTheme') document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light')
  }

  const handleExportLogs = async () => {
    try {
      setStatus('Fetching logs...')
      const data = await getLogs(500)
      const logs = data.logs || []
      if (!logs.length) { setStatus('No logs to export.'); return }
      const headers = ['timestamp', 'predicted_activity', 'cluster', 'confidence']
      const rows = logs.map(l => [l.timestamp, l.predicted_activity, l.cluster, Math.max(...Object.values(l.probabilities)).toFixed(4)])
      const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = 'har_logs.csv'; a.click()
      URL.revokeObjectURL(url)
      setStatus(`Exported ${logs.length} records.`)
      setTimeout(() => setStatus(''), 2500)
    } catch { setStatus('Export failed.') }
  }

  const handleRetrain = async () => {
    setRetraining(true)
    try {
      await trainModels({ filename: 'har_raw.csv', n_pca_components: 50, n_clusters: 6 })
      setStatus('Model retrained successfully.')
    } catch (e) { setStatus(e.response?.data?.detail || 'Retrain failed.') }
    finally { setRetraining(false); setTimeout(() => setStatus(''), 3000) }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure system behaviour and preferences.</p>
        </div>
        {saved && (
          <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
            Changes saved
          </span>
        )}
      </div>

      {/* Sensor Configuration */}
      <Section title="Sensor Configuration" icon={<Icon.Sensor />}>
        <Row label="Prediction Interval" desc="Time between consecutive predictions">
          <Select value={s.predictionInterval} onChange={v => update('predictionInterval', Number(v))}
            options={[{value:1000,label:'1.0 s'},{value:1500,label:'1.5 s'},{value:2000,label:'2.0 s'},{value:3000,label:'3.0 s'},{value:4000,label:'4.0 s'}]} />
        </Row>
        <Row label="Window Size" desc="Number of sensor readings per prediction window">
          <Select value={s.windowSize} onChange={v => update('windowSize', Number(v))}
            options={[{value:30,label:'30 samples'},{value:50,label:'50 samples'},{value:70,label:'70 samples'}]} />
        </Row>
        <Row label="Sensitivity" desc="Motion detection sensitivity level">
          <Select value={s.sensitivity} onChange={v => update('sensitivity', v)}
            options={[{value:'low',label:'Low'},{value:'medium',label:'Medium'},{value:'high',label:'High'}]} />
        </Row>
      </Section>

      {/* Prediction Settings */}
      <Section title="Prediction" icon={<Icon.Brain />}>
        <Row label="Prediction Smoothing" desc="Apply majority vote over last 5 predictions to reduce noise">
          <Toggle checked={s.smoothing} onChange={v => update('smoothing', v)} />
        </Row>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Confidence Threshold</p>
              <p className="text-xs text-gray-400 mt-0.5">Minimum confidence required to display a prediction</p>
            </div>
            <span className="text-sm font-semibold text-blue-600 tabular-nums">{Math.round(s.confidenceThreshold * 100)}%</span>
          </div>
          <input type="range" min={0.3} max={0.9} step={0.05} value={s.confidenceThreshold}
            onChange={e => update('confidenceThreshold', Number(e.target.value))}
            className="w-full h-1.5 rounded-full accent-blue-600 cursor-pointer" />
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>30%</span><span>90%</span>
          </div>
        </div>
      </Section>

      {/* Display */}
      <Section title="Display" icon={<Icon.Display />}>
        <Row label="Show Raw Prediction" desc="Display unsmoothed result alongside the stable prediction">
          <Toggle checked={s.showRawPrediction} onChange={v => update('showRawPrediction', v)} />
        </Row>
        <Row label="Show Confidence Score" desc="Display confidence percentage on the prediction card">
          <Toggle checked={s.showConfidence} onChange={v => update('showConfidence', v)} />
        </Row>
        <Row label="Dark Theme" desc="Switch the interface to dark mode">
          <Toggle checked={s.darkTheme} onChange={v => update('darkTheme', v)} />
        </Row>
      </Section>

      {/* Data & Logs */}
      <Section title="Data & Logs" icon={<Icon.Database />}>
        <Row label="Save Prediction Logs" desc="Persist prediction history to the server log file">
          <Toggle checked={s.saveLogs} onChange={v => update('saveLogs', v)} />
        </Row>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <button onClick={() => setStatus('Logs cleared.')}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Icon.Trash />
              Clear Logs
            </button>
            <button onClick={handleExportLogs}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Icon.Download />
              Export as CSV
            </button>
          </div>
          {status && <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{status}</p>}
        </div>
      </Section>

      {/* Advanced */}
      <Section title="Advanced" icon={<Icon.Cog />}>
        <Row label="Show Live Sensor Values" desc="Display raw ax, ay, az, gx, gy, gz readings during prediction">
          <Toggle checked={s.showSensorValues} onChange={v => update('showSensorValues', v)} />
        </Row>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <button onClick={handleRetrain} disabled={retraining}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
              <Icon.Refresh />
              {retraining ? 'Retraining Model...' : 'Retrain Model'}
            </button>
            <p className="text-xs text-gray-400 mt-2">Retrains on har_raw.csv with n_clusters = 6. This may take several minutes.</p>
          </div>
        </div>
      </Section>

    </div>
  )
}

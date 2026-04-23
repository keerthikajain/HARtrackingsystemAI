import { useState, useRef, useEffect } from 'react'
import { SensorService } from '../services/SensorService'
import axios from 'axios'
import { BASE_URL } from '../config/apiConfig'
import { trainModels } from '../services/ApiService'

const ACTIVITIES = ['WALKING','STANDING','SITTING','LAYING','WALKING_UPSTAIRS','WALKING_DOWNSTAIRS']
const WINDOW_SIZE = 50
const COLLECT_INTERVAL_MS = 500
const MIN_READINGS = 500

const api = axios.create({ baseURL: BASE_URL })
const collectWindow = async (activity, sensorData) => (await api.post('/collect', { activity, sensor_data: sensorData })).data.data
const getStats      = async () => (await api.get('/collect/stats')).data.data
const exportData    = async (filename) => (await api.post(`/collect/export?filename=${filename}`)).data.data
const clearData     = async () => api.delete('/collect/clear')

export default function CollectData() {
  const [selectedActivity, setSelectedActivity] = useState('WALKING')
  const [recording, setRecording]               = useState(false)
  const [stats, setStats]                       = useState(null)
  const [status, setStatus]                     = useState('')
  const [error, setError]                       = useState('')
  const [training, setTraining]                 = useState(false)
  const [trainResult, setTrainResult]           = useState(null)
  const [windowCount, setWindowCount]           = useState(0)
  const sensorRef = useRef(null)

  useEffect(() => { getStats().then(setStats).catch(() => {}) }, [])

  const refreshStats = async () => { try { setStats(await getStats()) } catch {} }

  const startRecording = async () => {
    setError(''); setStatus('Requesting sensor permission...'); setWindowCount(0)
    const svc = new SensorService(async (readings) => {
      try { await collectWindow(selectedActivity, readings); setWindowCount(c => c+1); await refreshStats() }
      catch (e) { console.warn('[Collect]', e.message) }
    })
    svc._startInterval = function() {
      if (this.intervalId) return
      this.intervalId = setInterval(() => {
        if (!this.active || this.paused || this.isPredicting) return
        if (this.buffer.length < WINDOW_SIZE) return
        this.isPredicting = true
        Promise.resolve(this.onWindowReady([...this.buffer])).finally(() => { this.isPredicting = false })
      }, COLLECT_INTERVAL_MS)
    }
    sensorRef.current = svc
    try { await svc.start(); setRecording(true); setStatus(`Recording ${selectedActivity}... keep moving!`) }
    catch (e) { sensorRef.current = null; setError(e.message); setStatus('') }
  }

  const stopRecording = () => {
    if (sensorRef.current) { sensorRef.current.stop(); sensorRef.current = null }
    setRecording(false); setStatus(`Stopped. Windows collected: ${windowCount}`); refreshStats()
  }

  const handleTrain = async () => {
    setTraining(true); setError(''); setTrainResult(null)
    try {
      setStatus('Exporting collected data...')
      await exportData('phone_data.csv')
      setStatus('Training model on your phone data...')
      const result = await trainModels({ filename: 'phone_data.csv', n_pca_components: 50, n_clusters: 6 })
      setTrainResult(result); setStatus('Training complete!')
    } catch (e) { setError(e.response?.data?.detail || e.message); setStatus('') }
    finally { setTraining(false) }
  }

  const handleClear = async () => {
    if (!window.confirm('Clear all collected data?')) return
    await clearData(); setStats(null); setStatus('Data cleared.'); setWindowCount(0)
  }

  const readingsPerActivity = stats?.per_activity || {}
  const totalReadings = stats?.total_readings || 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Collect Training Data</h2>
        <p className="text-sm text-gray-500 mt-1">Record your own sensor data so the model learns YOUR phone's patterns.</p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-blue-800 mb-2">How to collect:</p>
        <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
          <li>Select an activity below</li>
          <li>Tap <strong>Start Recording</strong> and perform that activity</li>
          <li>Tap <strong>Stop</strong> after 30–60 seconds</li>
          <li>Repeat for all 6 activities</li>
          <li>When each has <strong>500+ readings</strong>, tap <strong>Train Model</strong></li>
        </ol>
      </div>

      {/* Activity selector */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Activity</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIVITIES.map(act => (
            <button
              key={act}
              onClick={() => setSelectedActivity(act)}
              disabled={recording}
              className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all disabled:opacity-50
                ${selectedActivity === act ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <span className="text-sm font-semibold text-gray-800">{act.replace(/_/g, ' ')}</span>
              <span className="text-xs text-gray-400">{readingsPerActivity[act] ? `${readingsPerActivity[act]} readings` : 'none yet'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Record button */}
      {!recording ? (
        <button onClick={startRecording} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg shadow-red-200">
          🔴 Start Recording — {selectedActivity.replace(/_/g, ' ')}
        </button>
      ) : (
        <button onClick={stopRecording} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-2xl text-base transition-all">
          ⏹ Stop Recording
        </button>
      )}

      {status && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">{status}</p>}
      {error  && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">⚠️ {error}</p>}

      {recording && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold text-red-700">Recording {selectedActivity.replace(/_/g, ' ')} — {windowCount} windows sent</span>
        </div>
      )}

      {/* Progress */}
      {totalReadings > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Collection Progress</p>
          {ACTIVITIES.map(act => {
            const count = readingsPerActivity[act] || 0
            const pct   = Math.min(100, Math.round(count / MIN_READINGS * 100))
            return (
              <div key={act} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 truncate">{act.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#3b82f6' }} />
                </div>
                <span className="text-xs font-bold text-gray-600 w-10 text-right">{count}</span>
              </div>
            )
          })}
          <p className="text-xs text-gray-400">Need {MIN_READINGS}+ readings per activity to train.</p>
        </div>
      )}

      {/* Train */}
      <button
        onClick={handleTrain}
        disabled={training || !stats?.ready_to_train}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-all shadow-lg shadow-green-200"
      >
        {training ? '⏳ Training...' : '🚀 Train Model on My Data'}
      </button>

      {trainResult && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="font-bold text-green-800 text-lg mb-1">✅ Training Complete!</p>
          <p className="text-sm text-green-700">Accuracy: <strong>{(trainResult.accuracy * 100).toFixed(1)}%</strong></p>
          <p className="text-sm text-green-700">Activities: {trainResult.classes?.join(', ')}</p>
          <p className="text-xs text-green-600 mt-2">Go to Run Prediction and test it now!</p>
        </div>
      )}

      {totalReadings > 0 && (
        <button onClick={handleClear} className="border border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium hover:bg-red-50 transition-colors">
          🗑 Clear All Collected Data
        </button>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import ActivityDisplay from '../components/ActivityDisplay'
import FeedbackPanel from '../components/FeedbackPanel'
import { SensorService } from '../services/SensorService'
import { predictActivity } from '../services/ApiService'
import { usePredictionSmoothing } from '../hooks/usePredictionSmoothing'
import { Play, Square, Loader2, Wifi, WifiOff, Settings2, Gauge, RotateCcw } from 'lucide-react'

const WINDOW_SIZE = 50
const DEFAULTS = { ax: '1.023', ay: '-0.450', az: '9.81', gx: '0.002', gy: '0.015', gz: '-0.003' }

export default function RunPrediction() {
  const [manual, setManual]             = useState(DEFAULTS)
  const [liveMode, setLiveMode]         = useState(false)
  const [sensorStatus, setSensorStatus] = useState('idle')
  const [liveResult, setLiveResult]     = useState(null)
  const [windowSize, setWindowSize]     = useState(0)
  const [sensorErr, setSensorErr]       = useState('')
  const sensorRef = useRef(null)

  const { stableResult, feed, reset } = usePredictionSmoothing()
  const liveDisplay = stableResult ?? liveResult

  const [manualResult, setManualResult] = useState(null)
  const [manualWindow, setManualWindow] = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  useEffect(() => {
    const handleTimeout = (e) => { setSensorErr(e.detail.message); setSensorStatus('error'); setLiveMode(false) }
    window.addEventListener('sensortimeout', handleTimeout)
    return () => window.removeEventListener('sensortimeout', handleTimeout)
  }, [])

  useEffect(() => {
    return () => { if (sensorRef.current) { sensorRef.current.stop(); sensorRef.current = null } }
  }, [])

  const handleLiveToggle = async () => {
    if (liveMode) {
      if (sensorRef.current) { sensorRef.current.stop(); sensorRef.current = null }
      setLiveMode(false); setLiveResult(null); setWindowSize(0)
      setSensorErr(''); setSensorStatus('idle'); reset(); return
    }
    setSensorErr(''); setSensorStatus('requesting'); setLiveResult(null); reset()
    const svc = new SensorService(async (readings) => {
      setWindowSize(readings.length); setSensorStatus('active')
      try {
        const data = await predictActivity(readings)
        setLiveResult(data); feed(data)
      } catch (e) { console.warn('[Live] API error:', e.message) }
    })
    sensorRef.current = svc
    try {
      await svc.start(); setLiveMode(true); setSensorStatus('active')
    } catch (e) {
      sensorRef.current = null; setSensorErr(e.message); setSensorStatus('error')
    }
  }

  const handleManualPredict = async () => {
    setLoading(true); setError(''); setShowFeedback(false); setManualResult(null)
    try {
      const reading = {
        ax: parseFloat(manual.ax) || 0, ay: parseFloat(manual.ay) || 0, az: parseFloat(manual.az) || 0,
        gx: parseFloat(manual.gx) || 0, gy: parseFloat(manual.gy) || 0, gz: parseFloat(manual.gz) || 0,
      }
      const win  = Array(WINDOW_SIZE).fill(reading)
      const data = await predictActivity(win)
      setManualResult(data); setManualWindow(win); setShowFeedback(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Prediction failed. Is the backend running?')
    } finally { setLoading(false) }
  }

  const handleClear = () => { setManual(DEFAULTS); setManualResult(null); setShowFeedback(false); setError('') }

  const displayResult = liveMode ? liveDisplay : manualResult
  const confidence    = displayResult
    ? (displayResult._smoothedConfidence != null
        ? displayResult._smoothedConfidence
        : (displayResult.confidence ?? Math.max(...Object.values(displayResult.probabilities))) * 100
      ).toFixed(1)
    : '--'

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Run Activity Prediction</h2>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            {liveMode
              ? <><Wifi size={14} className="text-green-500" /> Live sensor active — move your device to predict activity.</>
              : 'Enter sensor values manually or tap Live Sensor on your phone.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLiveToggle}
            disabled={sensorStatus === 'requesting'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all
              ${liveMode
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {sensorStatus === 'requesting'
              ? <Loader2 size={15} className="animate-spin" />
              : liveMode ? <Square size={15} /> : <Wifi size={15} />}
            {sensorStatus === 'requesting' ? 'Requesting...' : liveMode ? 'Stop Live' : 'Live Sensor'}
          </button>
          <button
            onClick={handleManualPredict}
            disabled={loading || liveMode}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Run Prediction
          </button>
        </div>
      </div>

      {/* Status banners */}
      {sensorErr && (
        <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <WifiOff size={15} /> {sensorErr}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}
      {liveMode && !sensorErr && (
        <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <Wifi size={15} />
          Collecting — {windowSize}/{WINDOW_SIZE} readings
          {windowSize >= WINDOW_SIZE ? ' — Predicting...' : ' (keep moving your phone...)'}
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Input panel */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col gap-5">
          <div className="flex gap-3 items-start pb-4 border-b border-gray-100">
            <Settings2 size={18} className="text-gray-400 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-bold text-gray-800">Input Parameters</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {liveMode ? 'Live sensor is active. Stop live mode to use manual input.' : 'Adjust sensor values manually to test specific edge cases.'}
              </p>
            </div>
          </div>

          {/* Accelerometer */}
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Gauge size={13} strokeWidth={2} /> Accelerometer (m/s²)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['ax', 'ay', 'az'].map((k, i) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">{['X-Axis', 'Y-Axis', 'Z-Axis'][i]}</label>
                  <input
                    type="number" step="0.001" value={manual[k]}
                    onChange={e => setManual(p => ({ ...p, [k]: e.target.value }))}
                    disabled={liveMode}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Gyroscope */}
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <RotateCcw size={13} strokeWidth={2} /> Gyroscope (deg/s)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['gx', 'gy', 'gz'].map((k, i) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500">{['Pitch', 'Roll', 'Yaw'][i]}</label>
                  <input
                    type="number" step="0.001" value={manual[k]}
                    onChange={e => setManual(p => ({ ...p, [k]: e.target.value }))}
                    disabled={liveMode}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {!liveMode && (
            <div className="pt-3 border-t border-gray-100">
              <button onClick={handleClear} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Result panel */}
        <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-3">
          <ActivityDisplay
            activity={displayResult?.predicted_activity}
            confidence={confidence}
            probabilities={displayResult?.probabilities}
            loading={loading}
            sensorStatus={sensorStatus}
          />
          {!liveMode && showFeedback && manualResult?.predicted_activity && (
            <FeedbackPanel
              predictedActivity={manualResult.predicted_activity}
              sensorWindow={manualWindow}
              onDone={() => setShowFeedback(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

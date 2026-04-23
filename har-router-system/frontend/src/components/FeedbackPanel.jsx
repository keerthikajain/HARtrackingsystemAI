import { useState } from 'react'
import { submitFeedback } from '../services/ApiService'

const ACTIVITIES = ['WALKING','WALKING_UPSTAIRS','WALKING_DOWNSTAIRS','SITTING','STANDING','LAYING']

export default function FeedbackPanel({ predictedActivity, sensorWindow, onDone }) {
  const [state, setState]           = useState('idle')
  const [actualActivity, setActual] = useState('')
  const [errorMsg, setErrorMsg]     = useState('')

  const handleCorrect = () => { setState('done'); onDone?.() }
  const handleWrong   = () => setState('wrong')

  const handleSubmit = async () => {
    if (!actualActivity) return
    setState('submitting')
    try {
      await submitFeedback(sensorWindow, predictedActivity, actualActivity)
      setState('done'); onDone?.()
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || 'Failed to submit feedback.')
      setState('error')
    }
  }

  if (state === 'done') {
    return <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-3 font-medium">✓ Thanks for your feedback!</p>
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-700">Was this prediction correct?</p>

      {state === 'idle' && (
        <div className="flex gap-2">
          <button onClick={handleCorrect} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-xl py-2.5 text-sm font-semibold transition-colors">
            ✓ Correct
          </button>
          <button onClick={handleWrong} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl py-2.5 text-sm font-semibold transition-colors">
            ✗ Wrong
          </button>
        </div>
      )}

      {state === 'wrong' && (
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What was the actual activity?</label>
          <select
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-gray-50"
            value={actualActivity}
            onChange={e => setActual(e.target.value)}
          >
            <option value="">— Select activity —</option>
            {ACTIVITIES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setState('idle')} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!actualActivity}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {state === 'submitting' && <p className="text-sm text-gray-500 text-center py-2">Submitting…</p>}
      {state === 'error' && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>}
    </div>
  )
}

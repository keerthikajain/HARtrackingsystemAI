import { Footprints, TrendingUp, TrendingDown, Armchair, PersonStanding, BedDouble, Radio } from 'lucide-react'

export const ACTIVITY_COLORS = {
  WALKING:            '#2563eb',
  WALKING_UPSTAIRS:   '#7c3aed',
  WALKING_DOWNSTAIRS: '#0891b2',
  SITTING:            '#059669',
  STANDING:           '#d97706',
  LAYING:             '#a855f7',
}

const ACTIVITY_ICONS = {
  WALKING:            Footprints,
  WALKING_UPSTAIRS:   TrendingUp,
  WALKING_DOWNSTAIRS: TrendingDown,
  SITTING:            Armchair,
  STANDING:           PersonStanding,
  LAYING:             BedDouble,
}

export default function ActivityDisplay({ activity, confidence, probabilities, loading, sensorStatus }) {
  const color   = ACTIVITY_COLORS[activity] || '#64748b'
  const label   = activity?.replace(/_/g, ' ') || 'Waiting...'
  const IconComp = ACTIVITY_ICONS[activity] || Radio
  const isLive  = sensorStatus === 'active'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow w-full">

      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Activity Prediction</p>
        {sensorStatus && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
            ${isLive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {isLive ? 'Live' : sensorStatus === 'requesting' ? 'Starting...' : 'Idle'}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-9 h-9 border-[3px] border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Detecting activity...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Activity display */}
          <div
            className="flex flex-col items-center gap-3 py-5 px-4 rounded-xl border-2 transition-all duration-300"
            style={{ background: color + '12', borderColor: color + '30' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: color + '20' }}>
              <IconComp size={26} strokeWidth={1.5} style={{ color }} />
            </div>
            <h2 className="text-2xl font-extrabold text-center tracking-tight transition-colors duration-300" style={{ color }}>
              {label}
            </h2>
          </div>

          {/* Confidence meter */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500">Confidence</span>
              <span className="text-sm font-bold transition-colors duration-300" style={{ color }}>{confidence}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${confidence}%`, background: color }}
              />
            </div>
          </div>

          {/* Probability breakdown */}
          {probabilities && Object.keys(probabilities).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">All Activities</p>
              {Object.entries(probabilities)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([act, prob]) => {
                  const RowIcon = ACTIVITY_ICONS[act] || Radio
                  return (
                    <div key={act} className="flex items-center gap-2">
                      <RowIcon size={14} strokeWidth={1.75} style={{ color: ACTIVITY_COLORS[act] || '#94a3b8', flexShrink: 0 }} />
                      <span className="text-xs text-gray-500 w-28 truncate">{act.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(prob * 100).toFixed(0)}%`, background: ACTIVITY_COLORS[act] || '#94a3b8' }}
                        />
                      </div>
                      <span className="text-xs font-bold w-10 text-right">{(prob * 100).toFixed(1)}%</span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

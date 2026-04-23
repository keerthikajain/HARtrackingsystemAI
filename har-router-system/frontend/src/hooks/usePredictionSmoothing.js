/**
 * usePredictionSmoothing.js
 *
 * Hybrid smoothing strategy:
 *
 *  1. Confidence gate  — ignore predictions below MIN_CONFIDENCE (0.35)
 *  2. Consecutive streak — update UI immediately if same activity appears
 *                          STREAK_REQUIRED times in a row (fast response)
 *  3. Majority vote    — also update if activity wins majority in the
 *                          rolling HISTORY_SIZE window (catches gradual changes)
 *  4. No hard lock     — stableResult always reflects the latest winning state;
 *                          a new streak or majority can always override it
 *
 * Tuning:
 *   MIN_CONFIDENCE   lower  → more predictions accepted, noisier
 *   STREAK_REQUIRED  lower  → faster response, less stable
 *   HISTORY_SIZE     higher → more stable, slower to change
 *   MIN_VOTES        lower  → easier majority, less stable
 */

import { useRef, useState } from 'react'

const MIN_CONFIDENCE  = 0.35   // ignore predictions below this confidence
const HISTORY_SIZE    = 5      // rolling window for majority vote
const MIN_VOTES       = 3      // votes needed for majority to trigger update
const STREAK_REQUIRED = 2      // consecutive identical predictions to trigger fast update

export function usePredictionSmoothing() {
  const historyRef    = useRef([])   // rolling window of accepted predictions
  const streakRef     = useRef({ activity: null, count: 0 })
  const [stableResult, setStableResult] = useState(null)

  /**
   * Feed a new raw prediction from the API.
   * Applies confidence gate, streak check, and majority vote.
   *
   * @param {object} raw — { predicted_activity, cluster, confidence, probabilities }
   */
  function feed(raw) {
    const conf     = raw.confidence ?? Math.max(...Object.values(raw.probabilities))
    const activity = raw.predicted_activity

    // ── 1. Confidence gate ────────────────────────────────────────────────
    if (conf < MIN_CONFIDENCE) {
      console.log(`[Smoother] Ignored low-confidence prediction: ${activity} (${(conf*100).toFixed(0)}%)`)
      return
    }

    // ── 2. Consecutive streak check ───────────────────────────────────────
    const streak = streakRef.current
    if (streak.activity === activity) {
      streak.count++
    } else {
      streak.activity = activity
      streak.count    = 1
    }

    if (streak.count >= STREAK_REQUIRED) {
      // Fast path — same activity N times in a row → update immediately
      _commit(raw, conf, 'streak')
    }

    // ── 3. Rolling majority vote ──────────────────────────────────────────
    historyRef.current.push({ activity, conf, probabilities: raw.probabilities, cluster: raw.cluster })
    if (historyRef.current.length > HISTORY_SIZE) historyRef.current.shift()

    const votes = {}
    for (const e of historyRef.current) {
      votes[e.activity] = (votes[e.activity] || 0) + 1
    }
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] >= MIN_VOTES) {
      // Majority path — activity dominates the window → update
      _commit(raw, conf, 'majority')
    }
  }

  function _commit(raw, conf, reason) {
    const history  = historyRef.current
    const activity = raw.predicted_activity

    // Average confidence across matching entries in history
    const matching    = history.filter(e => e.activity === activity)
    const avgConf     = matching.length > 0
      ? matching.reduce((s, e) => s + e.conf, 0) / matching.length
      : conf

    // Average probabilities across full history
    const avgProbs = {}
    for (const e of history) {
      for (const [lbl, p] of Object.entries(e.probabilities)) {
        avgProbs[lbl] = (avgProbs[lbl] || 0) + p
      }
    }
    const n = history.length || 1
    for (const lbl in avgProbs) {
      avgProbs[lbl] = parseFloat((avgProbs[lbl] / n).toFixed(4))
    }

    console.log(`[Smoother] ${reason.toUpperCase()} → ${activity} (avg conf ${(avgConf*100).toFixed(0)}%)`)

    setStableResult({
      predicted_activity:  activity,
      cluster:             raw.cluster,
      probabilities:       Object.keys(avgProbs).length > 0 ? avgProbs : raw.probabilities,
      _smoothedConfidence: parseFloat((avgConf * 100).toFixed(1)),
    })
  }

  function reset() {
    historyRef.current = []
    streakRef.current  = { activity: null, count: 0 }
    setStableResult(null)
  }

  return { stableResult, feed, reset }
}

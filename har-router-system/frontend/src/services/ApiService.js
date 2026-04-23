import axios from 'axios'
import { BASE_URL } from '../config/apiConfig'

const api = axios.create({ baseURL: BASE_URL })

console.log('[ApiService] Using base URL:', BASE_URL)

// ── Predict ───────────────────────────────────────────────────────────────────
// sensor_data: array of {ax, ay, az, gx, gy, gz} objects (sliding window)
export async function predictActivity(sensorWindow) {
  const res = await api.post('/predict', { sensor_data: sensorWindow })
  return res.data.data
}

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadDataset(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/upload', form)
  return res.data.data
}

export async function listFiles() {
  const res = await api.get('/upload/files')
  return res.data.data
}

// ── Train ─────────────────────────────────────────────────────────────────────
export async function trainModels(payload) {
  const res = await api.post('/train', payload)
  return res.data.data
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export async function getAccuracy() {
  const res = await api.get('/analytics/accuracy')
  return res.data.data
}

export async function getSummary() {
  const res = await api.get('/analytics/summary')
  return res.data.data
}

export async function getClusters() {
  const res = await api.get('/analytics/clusters')
  return res.data.data
}

export async function getAnalyticsLogs(n = 20) {
  const res = await api.get(`/analytics/logs?n=${n}`)
  return res.data.data
}

// ── Feedback ──────────────────────────────────────────────────────────────────
export async function submitFeedback(sensorData, predictedActivity, actualActivity) {
  const res = await api.post('/feedback', {
    sensor_data:        sensorData,
    predicted_activity: predictedActivity,
    actual_activity:    actualActivity,
  })
  return res.data.data
}
export async function getLogs(limit = 50) {
  const res = await api.get(`/logs?limit=${limit}`)
  return res.data.data
}

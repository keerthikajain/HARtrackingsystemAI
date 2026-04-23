/**
 * apiConfig.js — Dynamic backend URL resolution.
 *
 * Logic:
 *  1. If VITE_API_URL is set in .env → use it (highest priority)
 *  2. On phone/LAN (non-localhost) → use Vite proxy at /api to avoid mixed-content block
 *  3. On localhost → hit backend directly at port 8000
 *
 * The Vite proxy rewrites /api/* → http://localhost:8000/*
 * so HTTPS frontend → HTTPS proxy → HTTP backend works without mixed-content errors.
 */

const getDynamicBaseURL = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  const hostname = window.location.hostname
  // On LAN / phone: use the proxy path (same origin, no mixed-content)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.host}/api`
  }
  // Local dev: hit backend directly
  const port = import.meta.env.VITE_API_PORT || '8000'
  return `http://localhost:${port}`
}

export const BASE_URL = import.meta.env.VITE_API_URL || getDynamicBaseURL()

console.log('[ApiService] Backend URL:', BASE_URL)

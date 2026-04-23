/**
 * SensorService.js — Real-sensor-only, mobile-first implementation.
 *
 * Permission flow:
 *   iOS 13+  → DeviceMotionEvent.requestPermission() MUST be called from a
 *              user gesture (button click). Throws if called on page load.
 *   Android  → No permission API; events fire immediately after listener attach.
 *
 * Timeout behaviour:
 *   - 8 seconds to receive the first real event (generous for slow Android init)
 *   - If nothing arrives → fires 'sensortimeout' custom event with a helpful message
 *   - Timeout is cancelled the moment the first real event arrives
 */

const WINDOW_SIZE       = 50
const POLL_INTERVAL_MS  = 4000   // one prediction every 4 s
const SENSOR_TIMEOUT_MS = 8000   // 8 s — generous for Android cold-start

export class SensorService {
  constructor(onWindowReady) {
    this.onWindowReady  = onWindowReady
    this.buffer         = []
    this._handler       = null
    this._timeoutTimer  = null
    this._gotRealEvent  = false
    this.intervalId     = null
    this.isPredicting   = false
    this.paused         = false
    this.active         = false
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /** iOS 13+ requires an explicit permission request from a user gesture. */
  static requiresPermission() {
    return (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function'
    )
  }

  /** Returns false on desktop browsers that don't expose DeviceMotionEvent. */
  static isSupported() {
    return typeof DeviceMotionEvent !== 'undefined'
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * start() MUST be called from a user-gesture handler (button onClick).
   * Calling it on page load will silently fail on iOS.
   */
  async start() {
    if (this.active) {
      console.warn('[SensorService] Already running — ignoring duplicate start()')
      return
    }

    if (!SensorService.isSupported()) {
      throw new Error(
        'Motion sensor not available. Please use a mobile device with a real accelerometer.'
      )
    }

    // iOS 13+ permission — must be inside a user gesture
    if (SensorService.requiresPermission()) {
      console.log('[SensorService] Requesting iOS motion permission...')
      let perm
      try {
        perm = await DeviceMotionEvent.requestPermission()
      } catch (err) {
        throw new Error(
          'Could not request motion sensor permission. Make sure you are on HTTPS and tapped a button.'
        )
      }
      if (perm !== 'granted') {
        throw new Error(
          'Please allow motion sensor access in your browser settings and try again.'
        )
      }
      console.log('[SensorService] iOS permission granted ✓')
    }

    this.active        = true
    this.paused        = false
    this.buffer        = []
    this._gotRealEvent = false

    // Attach listener
    this._handler = (e) => this._handleMotion(e)
    window.addEventListener('devicemotion', this._handler, { passive: true })
    console.log('[SensorService] Listening for devicemotion events...')

    // Timeout — fires only if no real events arrive
    this._timeoutTimer = setTimeout(() => {
      if (this.active && !this._gotRealEvent) {
        console.warn('[SensorService] Timeout — no sensor events received')
        this.stop()
        window.dispatchEvent(new CustomEvent('sensortimeout', {
          detail: {
            message: 'Move your phone to start sensing motion. No sensor data received — make sure motion access is allowed.'
          }
        }))
      }
    }, SENSOR_TIMEOUT_MS)

    this._startInterval()
  }

  stop() {
    this.active = false
    this.paused = false
    this._stopInterval()
    if (this._timeoutTimer) { clearTimeout(this._timeoutTimer); this._timeoutTimer = null }
    if (this._handler)      { window.removeEventListener('devicemotion', this._handler); this._handler = null }
    this.buffer       = []
    this.isPredicting = false
    console.log('[SensorService] Stopped')
  }

  pause() {
    if (this.paused) return
    this.paused = true
    this._stopInterval()
    console.log('[SensorService] Paused')
  }

  resume() {
    if (!this.active || !this.paused) return
    this.paused       = false
    this.isPredicting = false
    this._startInterval()
    console.log('[SensorService] Resumed')
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _startInterval() {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      if (!this.active || this.paused || this.isPredicting) return
      if (this.buffer.length < WINDOW_SIZE) return
      this.isPredicting = true
      const snapshot    = [...this.buffer]
      console.log('[SensorService] Sending window of', snapshot.length, 'readings to API')
      Promise.resolve(this.onWindowReady(snapshot))
        .finally(() => { this.isPredicting = false })
    }, POLL_INTERVAL_MS)
  }

  _stopInterval() {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }

  _handleMotion(event) {
    if (!this.active) return

    if (!this._gotRealEvent) {
      this._gotRealEvent = true
      if (this._timeoutTimer) { clearTimeout(this._timeoutTimer); this._timeoutTimer = null }
      console.log('[SensorService] First real sensor event received ✓')
    }

    const acc  = event.accelerationIncludingGravity || {}
    const gyro = event.rotationRate || {}

    // rotationRate is in deg/s (not rad/s) per W3C DeviceMotionEvent spec
    this._push({
      ax: acc.x      ?? 0,
      ay: acc.y      ?? 0,
      az: acc.z      ?? 0,
      gx: gyro.alpha ?? 0,
      gy: gyro.beta  ?? 0,
      gz: gyro.gamma ?? 0,
    })

    if (!this._loggedFirst) {
      this._loggedFirst = true
      console.log('[SensorService] First reading — acc:', acc.x?.toFixed(2), acc.y?.toFixed(2), acc.z?.toFixed(2),
                  '| gyro(deg/s):', gyro.alpha?.toFixed(2), gyro.beta?.toFixed(2), gyro.gamma?.toFixed(2))
    }
  }

  _push(reading) {
    if (!this.active) return
    this.buffer.push(reading)
    if (this.buffer.length > WINDOW_SIZE) this.buffer.shift()
  }
}

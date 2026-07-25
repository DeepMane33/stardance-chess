export class EditTimeline {
  constructor(duration = 0.605, onUpdate = null, onComplete = null) {
    this.duration = duration
    this.progress = 0
    this.startTime = null
    this.isRunning = false
    this.isPaused = false
    this.pauseStartTime = 0
    this.totalPausedTime = 0

    this.onUpdate = onUpdate
    this.onComplete = onComplete

    this.easing = 'linear'
    this.timeScale = 1

    this.keyframes = new Map()
    this.tracks = new Map()
  }

  addTrack(name, keyframes) {
    this.tracks.set(name, { keyframes, currentValue: 0 })
  }

  removeTrack(name) {
    this.tracks.delete(name)
  }

  getTrack(name) {
    return this.tracks.get(name)
  }

  setTrackValue(name, value) {
    const track = this.tracks.get(name)
    if (track) track.currentValue = value
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.isPaused = false
    this.startTime = performance.now()
    this.totalPausedTime = 0
    this.progress = 0
  }

  pause() {
    if (!this.isRunning || this.isPaused) return
    this.isPaused = true
    this.pauseStartTime = performance.now()
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return
    this.isPaused = false
    this.totalPausedTime += performance.now() - this.pauseStartTime
  }

  stop() {
    this.isRunning = false
    this.isPaused = false
    this.progress = 0
    this.startTime = null
    this.totalPausedTime = 0
  }

  update() {
    if (!this.isRunning || this.isPaused) return false

    const now = performance.now()
    const elapsed = (now - this.startTime - this.totalPausedTime) / 1000
    const rawProgress = Math.min(elapsed / this.duration, 1)

    this.progress = this.applyEasing(rawProgress, this.easing)

    if (this.onUpdate) {
      this.onUpdate(this.progress, this)
    }

    this.updateTracks(this.progress)

    if (this.progress >= 1) {
      this.isRunning = false
      if (this.onComplete) {
        this.onComplete(this)
      }
      return true
    }
    return false
  }

  applyEasing(t, easing) {
    switch (easing) {
      case 'easeOutExpo':
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      case 'easeOutCubic':
        return 1 - Math.pow(1 - t, 3)
      case 'easeInCubic':
        return t * t * t
      case 'easeOutElastic':
        if (t === 0) return 0
        if (t === 1) return 1
        const p = 0.4
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / p) + 1
      case 'easeInOutCubic':
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      default:
        return t
    }
  }

  updateTracks(progress) {
    for (const [name, track] of this.tracks) {
      const keyframes = track.keyframes
      if (!keyframes || keyframes.length === 0) continue

      let prev = keyframes[0]
      let next = keyframes[keyframes.length - 1]

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
          prev = keyframes[i]
          next = keyframes[i + 1]
          break
        }
      }

      if (progress <= prev.time) {
        track.currentValue = prev.value
      } else if (progress >= next.time) {
        track.currentValue = next.value
      } else {
        const localT = (progress - prev.time) / (next.time - prev.time)
        const eased = this.applyEasing(localT, next.easing || 'linear')
        track.currentValue = this.lerp(prev.value, next.value, eased)
      }
    }
  }

  lerp(a, b, t) {
    if (typeof a === 'number' && typeof b === 'number') {
      return a + (b - a) * t
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.map((val, i) => val + (b[i] - val) * t)
    }
    if (a && typeof a === 'object' && b && typeof b === 'object') {
      const result = {}
      for (const key of Object.keys(a)) {
        result[key] = this.lerp(a[key], b[key], t)
      }
      return result
    }
    return t < 0.5 ? a : b
  }

  getTrackValue(name) {
    const track = this.tracks.get(name)
    return track ? track.currentValue : 0
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(0.01, Math.min(5, scale))
  }

  getDuration() {
    return this.duration
  }

  getElapsed() {
    if (!this.startTime) return 0
    return (performance.now() - this.startTime - this.totalPausedTime) / 1000
  }

  isFinished() {
    return this.progress >= 1 && !this.isRunning
  }
}
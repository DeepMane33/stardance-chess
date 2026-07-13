export class VelocityRamp {
  constructor(renderer, options = {}) {
    this.renderer = renderer
    this.freezeDuration = options.freezeDuration || 100
    this.rampDuration = options.rampDuration || 400
    this.maxTimeScale = options.maxTimeScale || 3
    this.minTimeScale = options.minTimeScale || 0.05
    this.active = false
    this.phase = 'freeze'
    this.startTime = 0
    this.timeScale = 1
    this.onTimeScaleChange = null
  }

  start() {
    this.active = true
    this.phase = 'freeze'
    this.startTime = performance.now()
    this.timeScale = this.minTimeScale
    if (this.onTimeScaleChange) this.onTimeScaleChange(this.timeScale)
    return new Promise(resolve => { this.onComplete = resolve })
  }

  update(dt) {
    if (!this.active) return

    const elapsed = performance.now() - this.startTime

    if (this.phase === 'freeze') {
      if (elapsed >= this.freezeDuration) {
        this.phase = 'ramp'
        this.startTime = performance.now()
      }
    } else if (this.phase === 'ramp') {
      const progress = Math.min(elapsed / this.rampDuration, 1)
      const eased = this.easeOutCubic(progress)
      this.timeScale = this.minTimeScale + (this.maxTimeScale - this.minTimeScale) * eased
      
      if (progress >= 1) {
        this.phase = 'recover'
        this.startTime = performance.now()
      }
    } else if (this.phase === 'recover') {
      const progress = Math.min(elapsed / 300, 1)
      const eased = this.easeOutCubic(progress)
      this.timeScale = this.maxTimeScale + (1 - this.maxTimeScale) * eased
      
      if (progress >= 1) {
        this.active = false
        this.timeScale = 1
        if (this.onComplete) this.onComplete()
      }
    }

    if (this.onTimeScaleChange) this.onTimeScaleChange(this.timeScale)
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3)
  }

  getTimeScale() {
    return this.timeScale
  }

  getProgress() {
    if (!this.active) return 1
    const elapsed = performance.now() - this.startTime
    if (this.phase === 'freeze') return elapsed / this.freezeDuration * 0.2
    if (this.phase === 'ramp') return 0.2 + (elapsed / this.rampDuration) * 0.6
    return 0.8 + (elapsed / 300) * 0.2
  }
}
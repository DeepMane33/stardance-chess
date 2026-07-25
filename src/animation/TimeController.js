export class TimeController {
  constructor() {
    this.globalTimeScale = 1
    this.targetTimeScale = 1
    this.timeScaleLerp = 0.15

    this.isFrozen = false
    this.freezeTimer = 0
    this.freezeDuration = 0
    this.onFreezeComplete = null

    this.hitPauseTimer = 0
    this.hitPauseDuration = 0
    this.hitPauseTimeScale = 0.001

    this.lastFrameTime = 0
    this.frameCount = 0
    this.fps = 60
    this.fpsUpdateTimer = 0
    this.frameTimes = []

    this._callbacks = {
      onTimeScaleChange: null,
      onFreezeStart: null,
      onFreezeEnd: null,
      onHitPauseStart: null,
      onHitPauseEnd: null
    }
  }

  setGlobalTimeScale(scale, duration = 0) {
    this.targetTimeScale = Math.max(0.01, Math.min(5, scale))
    if (duration > 0) {
      this._timeScaleTransition = { start: this.globalTimeScale, end: this.targetTimeScale, duration, elapsed: 0 }
    } else {
      this.globalTimeScale = this.targetTimeScale
    }
    if (this._callbacks.onTimeScaleChange) this._callbacks.onTimeScaleChange(this.globalTimeScale)
  }

  getTimeScale() {
    return this.globalTimeScale
  }

  getScaledDelta(rawDt) {
    return rawDt * this.globalTimeScale
  }

  freeze(duration, timeScale = 0) {
    if (this.isFrozen) return
    this.isFrozen = true
    this.freezeDuration = duration
    this.freezeTimer = duration
    this.targetTimeScale = timeScale
    this.globalTimeScale = timeScale
    if (this._callbacks.onFreezeStart) this._callbacks.onFreezeStart(duration)
  }

  hitPause(duration, timeScale = 0.001) {
    this.hitPauseDuration = duration
    this.hitPauseTimer = duration
    this.hitPauseTimeScale = timeScale
    this.globalTimeScale = timeScale
    if (this._callbacks.onHitPauseStart) this._callbacks.onHitPauseStart(duration)
  }

  slowMotion(factor, duration = 0) {
    this.setGlobalTimeScale(factor, duration)
  }

  speedRamp(from, to, duration, easing = 'easeOutCubic') {
    this._speedRamp = { from, to, duration, elapsed: 0, easing }
  }

  update(rawDt) {
    this.lastFrameTime = rawDt
    this.frameCount++
    this.fpsUpdateTimer += rawDt

    if (this.fpsUpdateTimer >= 1) {
      this.fps = Math.round(this.frameCount / this.fpsUpdateTimer)
      this.frameCount = 0
      this.fpsUpdateTimer = 0
    }

    if (this._timeScaleTransition) {
      this._timeScaleTransition.elapsed += rawDt
      const t = Math.min(this._timeScaleTransition.elapsed / this._timeScaleTransition.duration, 1)
      const eased = this._ease(t, 'easeOutCubic')
      this.globalTimeScale = this._timeScaleTransition.start + (this._timeScaleTransition.end - this._timeScaleTransition.start) * eased
      if (t >= 1) this._timeScaleTransition = null
    }

    if (this._speedRamp) {
      this._speedRamp.elapsed += rawDt
      const t = Math.min(this._speedRamp.elapsed / this._speedRamp.duration, 1)
      const eased = this._ease(t, this._speedRamp.easing)
      this.globalTimeScale = this._speedRamp.from + (this._speedRamp.to - this._speedRamp.from) * eased
      if (t >= 1) this._speedRamp = null
    }

    if (this.isFrozen) {
      this.freezeTimer -= rawDt
      if (this.freezeTimer <= 0) {
        this.isFrozen = false
        this.globalTimeScale = this.targetTimeScale
        if (this.onFreezeComplete) {
          this.onFreezeComplete()
          this.onFreezeComplete = null
        }
        if (this._callbacks.onFreezeEnd) this._callbacks.onFreezeEnd()
      }
    }

    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= rawDt
      if (this.hitPauseTimer <= 0) {
        this.globalTimeScale = this.targetTimeScale
        if (this._callbacks.onHitPauseEnd) this._callbacks.onHitPauseEnd()
      }
    }
  }

  _ease(t, name) {
    const easing = {
      easeOutCubic: t => 1 - Math.pow(1 - t, 3),
      easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
      easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
      easeOutQuint: t => 1 - Math.pow(1 - t, 5)
    }
    return easing[name] ? easing[name](t) : t
  }

  on(event, callback) {
    if (this._callbacks.hasOwnProperty(event)) {
      this._callbacks[event] = callback
    }
  }

  getFPS() {
    return this.fps
  }

  getFrameTime() {
    return this.lastFrameTime
  }
}
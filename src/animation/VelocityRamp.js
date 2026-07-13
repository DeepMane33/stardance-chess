import { MathUtils } from '../utils/MathUtils.js'

export class VelocityRamp {
  constructor() {
    this.timeScale = 1
    this.targetTimeScale = 1
    this.duration = 0
    this.elapsed = 0
    this.active = false
    this.easeFn = MathUtils.easeInOutCubic
    this.onComplete = null
  }

  rampTo(targetScale, duration = 300, easeFn = MathUtils.easeInOutCubic) {
    this.targetTimeScale = targetScale
    this.duration = duration
    this.elapsed = 0
    this.active = true
    this.easeFn = easeFn
  }

  freeze(duration = 100) {
    this.rampTo(0, 50)
    setTimeout(() => {
      this.rampTo(1, duration)
    }, duration)
  }

  speedBurst(scale = 3, duration = 200) {
    this.rampTo(scale, 50)
    setTimeout(() => {
      this.rampTo(1, duration)
    }, 100)
  }

  update(dt) {
    if (!this.active) return

    this.elapsed += dt
    const progress = Math.min(this.elapsed / this.duration, 1)
    const eased = this.easeFn(progress)
    
    this.timeScale = MathUtils.lerp(1, this.targetTimeScale, eased)

    if (progress >= 1) {
      this.active = false
      this.timeScale = this.targetTimeScale
      if (this.onComplete) this.onComplete()
    }
  }

  getTimeScale() {
    return this.timeScale
  }

  reset() {
    this.timeScale = 1
    this.targetTimeScale = 1
    this.active = false
  }
}
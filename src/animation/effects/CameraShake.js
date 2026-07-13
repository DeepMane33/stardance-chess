import { gsap } from 'gsap'

export class CameraShake {
  constructor(renderer, options = {}) {
    this.renderer = renderer
    this.intensity = options.intensity || 10
    this.duration = options.duration || 500
    this.active = false
    this.startTime = 0
    this.offsetX = 0
    this.offsetY = 0
    this.ease = options.ease || 'power2.out'
  }

  start() {
    this.active = true
    this.startTime = performance.now()
    return new Promise(resolve => {
      this.onComplete = resolve
    })
  }

  update(dt) {
    if (!this.active) return

    const elapsed = performance.now() - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)
    const easedProgress = gsap.parseEase(this.ease)(progress)

    const currentIntensity = this.intensity * (1 - easedProgress)
    this.offsetX = (Math.random() - 0.5) * 2 * currentIntensity
    this.offsetY = (Math.random() - 0.5) * 2 * currentIntensity

    if (progress >= 1) {
      this.active = false
      this.offsetX = 0
      this.offsetY = 0
      if (this.onComplete) this.onComplete()
    }
  }

  getOffset() {
    return { x: this.offsetX, y: this.offsetY }
  }

  applyToContext(ctx) {
    if (this.active) {
      ctx.translate(this.offsetX, this.offsetY)
    }
  }
}
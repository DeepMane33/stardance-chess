import { MathUtils } from '../utils/MathUtils.js'

export class CameraShake {
  constructor(intensity = 1, duration = 500) {
    this.intensity = intensity
    this.duration = duration
    this.elapsed = 0
    this.offsetX = 0
    this.offsetY = 0
    this.rotation = 0
    this.active = false
    this.trauma = 0
    this.traumaDecay = 0.002
  }

  trigger(trauma = 1) {
    this.trauma = Math.min(trauma, 1)
    this.active = true
  }

  update(dt) {
    if (!this.active) return

    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt)
    
    const shake = Math.pow(this.trauma, 2) * this.intensity
    this.offsetX = (MathUtils.random(-1, 1) * shake)
    this.offsetY = (MathUtils.random(-1, 1) * shake)
    this.rotation = (MathUtils.random(-1, 1) * shake * 0.01)

    if (this.trauma <= 0) {
      this.active = false
      this.offsetX = 0
      this.offsetY = 0
      this.rotation = 0
    }
  }

  applyTransform(ctx) {
    if (!this.active) return
    ctx.translate(this.offsetX, this.offsetY)
    ctx.rotate(this.rotation)
  }

  getTransform() {
    return {
      x: this.offsetX,
      y: this.offsetY,
      rotation: this.rotation
    }
  }
}
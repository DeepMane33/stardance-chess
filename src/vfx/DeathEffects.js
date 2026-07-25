/**
 * DeathEffects — Simplified for pawncap.mp4 style.
 * Just manages debris particles during capture.
 */
export class DeathEffects {
  constructor(renderer) {
    this.renderer = renderer
    this.particles = []
    this.active = false
    this.elapsed = 0
  }

  getDeathDuration(pieceType) {
    return 0.4
  }

  trigger(pieceType, x, y, intensity = 1) {
    this.active = true
    this.elapsed = 0
    this.particles = []

    // Sparse green + dark debris
    const count = Math.floor(12 * intensity)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 30 + Math.random() * 50
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 20,
        size: 1.5 + Math.random() * 2,
        alpha: 0.7 + Math.random() * 0.3,
        decay: 0.018 + Math.random() * 0.01,
        color: Math.random() > 0.5 ? '#00dc32' : '#555555',
        gravity: 120
      })
    }
  }

  update(dt) {
    if (!this.active) return
    this.elapsed += dt

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.alpha -= p.decay

      if (p.alpha <= 0) {
        this.particles.splice(i, 1)
      }
    }

    if (this.particles.length === 0 && this.elapsed > 0.1) {
      this.active = false
    }
  }

  render(ctx) {
    if (!this.active) return

    ctx.save()
    for (const p of this.particles) {
      if (p.alpha <= 0) continue
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.restore()
  }
}

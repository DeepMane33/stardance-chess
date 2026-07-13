import { MathUtils } from '../utils/MathUtils.js'
import { Colors } from '../utils/ColorPalette.js'

export class ParticleSystem {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.particles = []
    this.maxParticles = 200
    this.active = false
    this.emitterX = width / 2
    this.emitterY = height / 2
  }

  emit(x, y, options = {}) {
    this.emitterX = x
    this.emitterY = y
    this.active = true

    const count = options.count || 40
    const colors = options.colors || Colors.effects.capture
    const pieceType = options.pieceType || 'pawn'

    for (let i = 0; i < count; i++) {
      this.spawnParticle(colors, pieceType)
    }
  }

  spawnParticle(colorPalette, pieceType) {
    const angle = MathUtils.random(0, Math.PI * 2)
    const speed = MathUtils.random(100, 600)
    const life = MathUtils.random(400, 1000)
    const size = MathUtils.random(2, 8)
    
    const color = colorPalette[MathUtils.randomInt(0, colorPalette.length - 1)]
    
    const particle = {
      x: this.emitterX,
      y: this.emitterY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: life,
      maxLife: life,
      size: size,
      color: color,
      rotation: MathUtils.random(0, Math.PI * 2),
      rotationSpeed: MathUtils.random(-5, 5),
      type: MathUtils.randomInt(0, 3),
      gravity: pieceType === 'pawn' ? 100 : 50,
      trail: []
    }

    this.particles.push(particle)
    
    if (this.particles.length > this.maxParticles) {
      this.particles.shift()
    }
  }

  update(dt) {
    if (!this.active && this.particles.length === 0) return

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      
      p.trail.push({ x: p.x, y: p.y })
      if (p.trail.length > 8) p.trail.shift()

      p.vy += p.gravity * dt
      p.vx *= 0.99
      p.vy *= 0.99
      
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.rotationSpeed * dt
      p.life -= dt * 1000

      if (p.life <= 0 || p.y > this.height + 50) {
        this.particles.splice(i, 1)
      }
    }

    this.active = this.particles.length > 0
  }

  render(ctx) {
    this.particles.forEach(p => {
      const alpha = p.life / p.maxLife
      
      if (p.trail.length > 1) {
        ctx.save()
        ctx.globalAlpha = alpha * 0.3
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.size * 0.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.trail[0].x, p.trail[0].y)
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y)
        }
        ctx.stroke()
        ctx.restore()
      }

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      ctx.fillStyle = p.color
      
      switch (p.type) {
        case 0:
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.fill()
          break
        case 1:
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size)
          break
        case 2:
          ctx.beginPath()
          ctx.moveTo(0, -p.size)
          ctx.lineTo(p.size, p.size)
          ctx.lineTo(-p.size, p.size)
          ctx.closePath()
          ctx.fill()
          break
        case 3:
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
            const r = i % 2 === 0 ? p.size : p.size * 0.4
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
          }
          ctx.closePath()
          ctx.fill()
          break
      }
      ctx.restore()
    })
  }

  clear() {
    this.particles = []
    this.active = false
  }

  resize(width, height) {
    this.width = width
    this.height = height
  }
}
import { timeManager } from './TimeManager.js'

export class EffectsLayer {
  constructor(boardCanvas, centerX, centerY) {
    this.boardCanvas = boardCanvas
    this.centerX = centerX
    this.centerY = centerY
    
    this.canvas = document.createElement('canvas')
    this.canvas.width = boardCanvas.width
    this.canvas.height = boardCanvas.height
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '10'
    
    this.ctx = this.canvas.getContext('2d')
    this.width = boardCanvas.width
    this.height = boardCanvas.height
    this.dpr = window.devicePixelRatio || 1
    
    if (boardCanvas.parentElement) {
      boardCanvas.parentElement.appendChild(this.canvas)
    }
    
    this.particles = []
    this.particleProgress = 0
    this.alpha = 1
    this.comboIntensity = 1
    this.customParticleSets = []
    this._lastTime = 0
  }

  setComboIntensity(intensity) {
    this.comboIntensity = Math.max(1, intensity)
  }

  addCustomParticles(particles, duration) {
    this.customParticleSets.push({
      particles: particles.map(p => ({
        ...p,
        life: 1,
        maxLife: 1,
        age: 0,
        delay: p.delay || 0,
        originalVx: p.vx,
        originalVy: p.vy,
        trail: []
      })),
      duration,
      startTime: timeManager.getScaledTime(),
      elapsed: 0
    })
  }

  update(dt) {
    const scaledDt = timeManager.getScaledDelta()
    const now = timeManager.getScaledTime()
    
    for (let i = this.customParticleSets.length - 1; i >= 0; i--) {
      const set = this.customParticleSets[i]
      set.elapsed = now - set.startTime
      
      if (set.elapsed > set.duration) {
        this.customParticleSets.splice(i, 1)
        continue
      }
      
      const progress = set.elapsed / set.duration
      
      for (const p of set.particles) {
        if (p.delay > set.elapsed) continue
        
        p.age += scaledDt
        if (p.age >= p.maxLife) continue
        
        p.trail.push({ x: p.x, y: p.y })
        if (p.trail.length > (p.trailLength || 8)) {
          p.trail.shift()
        }
        
        p.vy += (p.gravity || 0) * scaledDt
        p.x += p.vx * scaledDt
        p.y += p.vy * scaledDt
        p.life = 1 - (p.age / p.maxLife)
      }
    }
  }

  render(ctx) {
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.ctx.globalAlpha = this.alpha
    
    for (const set of this.customParticleSets) {
      const progress = set.elapsed / set.duration
      if (progress > 1) continue
      
      for (const p of set.particles) {
        if (p.delay > set.elapsed) continue
        if (p.age >= p.maxLife) continue
        
        const alpha = p.life * this.alpha * this.comboIntensity
        
        if (p.trail.length > 1) {
          this.ctx.beginPath()
          this.ctx.moveTo(p.trail[0].x, p.trail[0].y)
          for (let i = 1; i < p.trail.length; i++) {
            this.ctx.lineTo(p.trail[i].x, p.trail[i].y)
          }
          this.ctx.strokeStyle = p.color.startsWith('rgba') ? p.color.replace(/[\d.]+\)$/, `${alpha * 0.3})`) : p.color
          this.ctx.lineWidth = Math.max(1, p.radius * 0.5)
          this.ctx.stroke()
        }
        
        this.ctx.globalAlpha = alpha
        this.drawParticleShape(p)
      }
    }
    
    this.ctx.globalAlpha = 1
    
    ctx.drawImage(this.canvas, 0, 0)
  }

  drawParticleShape(p) {
    const { x, y, radius, color, shape } = p
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    
    switch (shape) {
      case 'circle':
        this.ctx.arc(x, y, radius * this.comboIntensity, 0, Math.PI * 2)
        break
      case 'square':
        const hs = radius * this.comboIntensity
        this.ctx.rect(x - hs, y - hs, hs * 2, hs * 2)
        break
      case 'diamond':
        const ds = radius * this.comboIntensity
        this.ctx.moveTo(x, y - ds)
        this.ctx.lineTo(x + ds, y)
        this.ctx.lineTo(x, y + ds)
        this.ctx.lineTo(x - ds, y)
        this.ctx.closePath()
        break
      case 'star':
        this.drawStar(x, y, radius * this.comboIntensity, radius * this.comboIntensity * 0.5, 5)
        break
      case 'slash':
        const ss = radius * this.comboIntensity * 2
        this.ctx.moveTo(x - ss, y - ss)
        this.ctx.lineTo(x + ss, y + ss)
        this.ctx.lineWidth = 3
        this.ctx.strokeStyle = color
        this.ctx.stroke()
        return
      case 'crown':
        this.drawCrown(x, y, radius * this.comboIntensity)
        break
      default:
        this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    }
    
    this.ctx.fill()
  }

  drawStar(cx, cy, outerR, innerR, points) {
    this.ctx.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = (Math.PI * i) / points - Math.PI / 2
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) this.ctx.moveTo(x, y)
      else this.ctx.lineTo(x, y)
    }
    this.ctx.closePath()
  }

  drawCrown(cx, cy, size) {
    const spikes = 5
    const outerR = size
    const innerR = size * 0.4
    this.ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = (Math.PI * i) / spikes - Math.PI / 2
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (i === 0) this.ctx.moveTo(x, y)
      else this.ctx.lineTo(x, y)
    }
    this.ctx.closePath()
  }

  destroy() {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas)
    }
  }
}
import { Piece } from '../../core/ChessTypes.js'

export class PieceVFX {
  static createCaptureEffect(pieceType, targetPos, orientation, effectsLayer) {
    const { x, y } = targetPos
    const color = orientation === 1 ? '#00ffff' : '#ff00ff'

    switch (pieceType) {
      case Piece.PAWN:
        return this.createPawnDust(x, y, color, effectsLayer)
      case Piece.KNIGHT:
        return this.createKnightSlash(x, y, color, effectsLayer)
      case Piece.BISHOP:
        return this.createBishopRays(x, y, color, effectsLayer)
      case Piece.ROOK:
        return this.createRookShockwave(x, y, color, effectsLayer)
      case Piece.QUEEN:
        return this.createQueenNova(x, y, color, effectsLayer)
      case Piece.KING:
        return this.createKingSlowMo(x, y, color, effectsLayer)
      default:
        return this.createGenericBurst(x, y, color, effectsLayer)
    }
  }

  static createPawnDust(x, y, color, effectsLayer) {
    const particles = []
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const speed = 80 + Math.random() * 60
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        radius: 3 + Math.random() * 2,
        color: this.hexToRgba(color, 0.8),
        life: 1,
        decay: 0.02 + Math.random() * 0.015,
        gravity: 180,
        shape: 'circle'
      })
    }
    effectsLayer.addCustomParticles(particles, 0.6)
    return { duration: 0.6, type: 'pawn_dust' }
  }

  static createKnightSlash(x, y, color, effectsLayer) {
    const particles = []
    const slashCount = 3
    for (let s = 0; s < slashCount; s++) {
      const delay = s * 0.08
      const angle = -Math.PI / 2 + (s - 1) * 0.4
      const count = 15
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * 0.3
        const speed = 180 + Math.random() * 80
        particles.push({
          x: x + Math.cos(a) * 10,
          y: y + Math.sin(a) * 10,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          radius: 2 + Math.random() * 1.5,
          color: this.hexToRgba(color, 0.9),
          life: 1,
          decay: 0.025,
          gravity: 0,
          shape: 'slash',
          delay,
          trailLength: 8
        })
      }
    }
    effectsLayer.addCustomParticles(particles, 0.5)
    return { duration: 0.5, type: 'knight_slash' }
  }

  static createBishopRays(x, y, color, effectsLayer) {
    const particles = []
    const rays = 4
    const particlesPerRay = 10
    for (let r = 0; r < rays; r++) {
      const angle = (Math.PI * 2 * r) / rays + Math.PI / 4
      for (let i = 0; i < particlesPerRay; i++) {
        const dist = 20 + i * 15
        particles.push({
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          vx: Math.cos(angle) * (100 + Math.random() * 60),
          vy: Math.sin(angle) * (100 + Math.random() * 60),
          radius: 4 + Math.random() * 2,
          color: this.hexToRgba(color, 0.85),
          life: 1,
          decay: 0.018,
          gravity: -30,
          shape: 'diamond',
          delay: r * 0.03
        })
      }
    }
    effectsLayer.addCustomParticles(particles, 0.7)
    return { duration: 0.7, type: 'bishop_rays' }
  }

  static createRookShockwave(x, y, color, effectsLayer) {
    const particles = []
    const rings = 3
    const particlesPerRing = 20
    for (let ring = 0; ring < rings; ring++) {
      const delay = ring * 0.06
      const radius = 30 + ring * 25
      for (let i = 0; i < particlesPerRing; i++) {
        const angle = (Math.PI * 2 * i) / particlesPerRing
        particles.push({
          x: x + Math.cos(angle) * radius * 0.3,
          y: y + Math.sin(angle) * radius * 0.3,
          vx: Math.cos(angle) * (150 + ring * 50),
          vy: Math.sin(angle) * (150 + ring * 50),
          radius: 3 + Math.random() * 2,
          color: this.hexToRgba(color, 0.9 - ring * 0.1),
          life: 1,
          decay: 0.02 + ring * 0.005,
          gravity: 0,
          shape: 'square',
          delay
        })
      }
    }
    effectsLayer.addCustomParticles(particles, 0.8)
    return { duration: 0.8, type: 'rook_shockwave' }
  }

  static createQueenNova(x, y, color, effectsLayer) {
    const particles = []
    const rings = 4
    const particlesPerRing = 24
    for (let ring = 0; ring < rings; ring++) {
      const delay = ring * 0.04
      for (let i = 0; i < particlesPerRing; i++) {
        const angle = (Math.PI * 2 * i) / particlesPerRing + ring * 0.1
        const speed = 200 + ring * 40
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5 + Math.random() * 3,
          color: this.hexToRgba(color, 0.95 - ring * 0.1),
          life: 1,
          decay: 0.015 + ring * 0.003,
          gravity: -50,
          shape: 'star',
          delay,
          trailLength: 12
        })
      }
    }
    const coreParticles = []
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 50 + Math.random() * 100
      coreParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        radius: 6 + Math.random() * 4,
        color: this.hexToRgba('#ffffff', 1),
        life: 1,
        decay: 0.01,
        gravity: -80,
        shape: 'circle',
        delay: 0
      })
    }
    effectsLayer.addCustomParticles([...particles, ...coreParticles], 1.0)
    return { duration: 1.0, type: 'queen_nova' }
  }

  static createKingSlowMo(x, y, color, effectsLayer) {
    const particles = []
    const rings = 2
    const particlesPerRing = 16
    for (let ring = 0; ring < rings; ring++) {
      const delay = ring * 0.15
      for (let i = 0; i < particlesPerRing; i++) {
        const angle = (Math.PI * 2 * i) / particlesPerRing
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * (60 + ring * 20),
          vy: Math.sin(angle) * (60 + ring * 20) - 20,
          radius: 4 + Math.random() * 3,
          color: this.hexToRgba('#ffd700', 0.9),
          life: 1,
          decay: 0.008,
          gravity: -20,
          shape: 'crown',
          delay,
          trailLength: 15
        })
      }
    }
    effectsLayer.addCustomParticles(particles, 1.5)
    return { duration: 1.5, type: 'king_slowmo' }
  }

  static createGenericBurst(x, y, color, effectsLayer) {
    const particles = []
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 100 + Math.random() * 150
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 2,
        color: this.hexToRgba(color, 0.8),
        life: 1,
        decay: 0.02,
        gravity: 0,
        shape: 'circle'
      })
    }
    effectsLayer.addCustomParticles(particles, 0.5)
    return { duration: 0.5, type: 'generic' }
  }

  static hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
}
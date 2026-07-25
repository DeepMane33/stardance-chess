/**
 * PieceVFX — Simplified for pawncap.mp4 style.
 * Sparse debris particles during capture.
 */
export class PieceVFX {
  static createCaptureEffect(pieceType, targetPos, orientation, effectsLayer) {
    const { x, y } = targetPos
    return this.createDebris(x, y, effectsLayer)
  }

  static createDebris(x, y, effectsLayer) {
    const particles = []
    const squareSize = 60 // approximate

    // Sparse green debris particles
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 30 + Math.random() * 60
      particles.push({
        x: x + (Math.random() - 0.5) * squareSize * 0.4,
        y: y + (Math.random() - 0.5) * squareSize * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 20,
        radius: 1.5 + Math.random() * 2,
        color: Math.random() > 0.5 ? 'rgba(0, 220, 50, 0.8)' : 'rgba(85, 85, 85, 0.7)',
        life: 1,
        decay: 0.02 + Math.random() * 0.01,
        gravity: 120,
        shape: 'square'
      })
    }

    effectsLayer.addCustomParticles(particles, 0.5)
    return { duration: 0.5, type: 'debris' }
  }
}

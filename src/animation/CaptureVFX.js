import { Easing } from './Easing.js'

export class CaptureVFX {
  constructor(renderer, captureData, audioManager, comboSystem) {
    this.renderer = renderer
    this.data = captureData
    this.audioManager = audioManager
    this.comboSystem = comboSystem
    this.effects = {
      flashAlpha: 0,
      ringProgress: 0,
      chromaticAberration: 0,
      vignette: 0,
      boardDarken: 0,
      victimAlpha: 1,
      victimScale: 1,
      victimFragments: []
    }
    this.init()
  }

  init() {
    const { to } = this.data
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer.canvasRenderer
    const file = to % 8
    const rank = Math.floor(to / 8)
    const cx = boardOffsetX + (file + 0.5) * squareSize
    const cy = boardOffsetY + (7 - rank + 0.5) * squareSize

    this.centerX = cx
    this.centerY = cy
    this.pieceSize = squareSize * this.renderer.drawScale

    this.duration = 0.65
    this.victimFragmentsGenerated = false
  }

  start() {
    if (this.audioManager) {
      this.audioManager.playCapture?.(this.data)
      this.audioManager.playBassImpact?.()
    }
  }

  update(progress) {
    this.updateEffects(progress)
    this.updateFragments(1/60, progress)
  }

  updateFragments(dt, progress) {
    for (let i = this.effects.victimFragments.length - 1; i >= 0; i--) {
      const f = this.effects.victimFragments[i]
      f.vy += f.gravity * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.rotation += f.rotationSpeed * dt
      f.alpha = Math.max(0, 1 - progress)
      if (f.alpha <= 0) this.effects.victimFragments.splice(i, 1)
    }
  }

  updateEffects(progress) {
    const p = progress

    if (p < 0.08) {
      const phaseT = p / 0.08
      this.effects.boardDarken = Easing.easeOutCubic(phaseT) * 0.22
      this.effects.vignette = Easing.easeOutCubic(phaseT) * 0.28
    } else if (p < 0.12) {
      this.effects.boardDarken = 0.22
      this.effects.vignette = 0.28
    } else if (p < 0.25) {
      const phaseT = (p - 0.12) / 0.13
      this.effects.boardDarken = 0.22 * (1 - phaseT)
      this.effects.vignette = 0.28 * (1 - phaseT)
    }

    if (p >= 0.12 && p < 0.14) {
      this.effects.flashAlpha = 0.7
      this.effects.chromaticAberration = 0.55
      this.effects.vignette = Math.max(this.effects.vignette, 0.5)
    } else if (p >= 0.14 && p < 0.24) {
      const phaseT = (p - 0.14) / 0.1
      this.effects.flashAlpha = Easing.easeOutCubic(1 - phaseT) * 0.7
      this.effects.chromaticAberration = Easing.easeOutCubic(1 - phaseT) * 0.9
      this.effects.vignette = Math.max(this.effects.vignette, Easing.easeOutCubic(1 - phaseT) * 0.5)
    } else {
      this.effects.flashAlpha = 0
      this.effects.chromaticAberration = 0
    }

    if (p >= 0.14) {
      const phaseT = Math.min((p - 0.14) / 0.5, 1)
      this.effects.ringProgress = phaseT
    }

    if (p >= 0.23 && p < 0.32) {
      const phaseT = (p - 0.23) / 0.09
      this.effects.victimScale = 1 - Easing.easeInCubic(phaseT) * 0.75
      this.effects.victimAlpha = 1 - Easing.easeInCubic(phaseT)
    } else if (p >= 0.32) {
      this.effects.victimAlpha = 0
      this.effects.victimScale = 0.25

      if (!this.victimFragmentsGenerated) {
        this.generateVictimFragments()
        this.victimFragmentsGenerated = true
      }
    }

    if (p >= 0.14 && p < 0.29) {
      const phaseT = (p - 0.14) / 0.15
      this.effects.glowIntensity = Easing.easeOutCubic(phaseT)
    } else if (p >= 0.29 && p < 0.44) {
      const phaseT = (p - 0.29) / 0.15
      this.effects.glowIntensity = Easing.easeOutCubic(1 - phaseT)
    } else {
      this.effects.glowIntensity = 0
    }
  }

  generateVictimFragments() {
    const fragmentCount = 8 + Math.floor(Math.random() * 4)
    this.effects.victimFragments = []

    for (let i = 0; i < fragmentCount; i++) {
      const angle = (Math.PI * 2 * i) / fragmentCount + (Math.random() - 0.5) * 0.5
      const speed = 150 + Math.random() * 300
      const size = this.pieceSize * (0.15 + Math.random() * 0.15)

      this.effects.victimFragments.push({
        x: this.centerX,
        y: this.centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50 - Math.random() * 100,
        size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
        alpha: 1,
        gravity: 400 + Math.random() * 200,
        color: this.data.color === 1 ? '#ffffff' : '#333333',
        shape: ['square', 'diamond', 'triangle'][Math.floor(Math.random() * 3)]
      })
    }
  }

  getEffects() {
    return this.effects
  }

  cleanup() {
    this.effects = {
      flashAlpha: 0,
      ringProgress: 0,
      chromaticAberration: 0,
      vignette: 0,
      boardDarken: 0,
      victimAlpha: 0,
      victimScale: 0,
      victimFragments: []
    }
  }
}
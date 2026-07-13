import { gsap } from 'gsap'
import { CameraShake } from './effects/CameraShake.js'
import { GlitchEffect } from './effects/GlitchEffect.js'
import { VelocityRamp } from './effects/VelocityRamp.js'
import { EffectsLayer } from './EffectsLayer.js'
import { PieceVFX } from './effects/PieceVFX.js'
import { ComboSystem } from './ComboSystem.js'
import { Piece } from '../core/ChessTypes.js'

export class CaptureVFX {
  constructor(renderer, captureData, audioManager, comboSystem) {
    this.renderer = renderer
    this.data = captureData
    this.audioManager = audioManager
    this.comboSystem = comboSystem
    this.timeline = null
    this.effectsLayer = null
    this.pieceVFXResult = null
    this.init()
  }

  init() {
    const { to, piece, captured } = this.data
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer.canvasRenderer
    const file = to % 8
    const rank = Math.floor(to / 8)
    const cx = boardOffsetX + (file + 0.5) * squareSize
    const cy = boardOffsetY + (7 - rank + 0.5) * squareSize

    this.effectsLayer = new EffectsLayer(this.renderer.canvasRenderer.ctx.canvas, cx, cy)
    
    const intensity = this.comboSystem.getIntensityMultiplier()
    
    this.pieceVFXResult = PieceVFX.createCaptureEffect(
      captured, 
      { x: cx, y: cy }, 
      this.data.color || 1,
      this.effectsLayer
    )
    
    const baseDuration = this.pieceVFXResult.duration
    this.duration = baseDuration * (0.7 + intensity * 0.3)
    
    this.effects = {
      shake: new CameraShake(this.renderer, { 
        intensity: 10 * intensity, 
        duration: this.duration * 1000 
      }),
      glitch: new GlitchEffect(this.renderer, this.effectsLayer.ctx, { 
        duration: this.duration * 1000 
      }),
      velocity: new VelocityRamp(this.renderer, { 
        freezeDuration: Math.max(50, 100 / intensity), 
        rampDuration: this.duration * 400 
      })
    }
    
    this.effectsLayer.setComboIntensity(intensity)
  }

  runIntro() {
    return new Promise((resolve) => {
      this.timeline = gsap.timeline({ onComplete: resolve })
      
      const intensity = this.comboSystem.getIntensityMultiplier()
      
      this.timeline
        .to(this.effects.velocity, { progress: 1, duration: 0.08 / intensity, ease: 'power2.in' }, 0)
        .add(() => this.effects.shake.start(), 0)
        .add(() => this.effects.glitch.start(), 0.04)
        .to(this.effectsLayer, { particleProgress: 0.25, duration: 0.12, ease: 'power2.out' }, 0.08)
        .add(() => {
          if (this.audioManager) {
            this.audioManager.playCapture(this.data, this.getCapturedPieceType())
          }
        }, 0.05)
    })
  }

  getCapturedPieceType() {
    const piece = this.data.captured
    if (!piece) return 0
    return piece & 0x7
  }

  runMain() {
    return new Promise((resolve) => {
      this.timeline = gsap.timeline({ onComplete: resolve })
      
      const intensity = this.comboSystem.getIntensityMultiplier()
      const mainDuration = this.duration * 0.7
      
      this.timeline
        .to(this.effectsLayer, { particleProgress: 1, duration: mainDuration, ease: 'power2.out' }, 0)
        .to(this.effects.glitch, { intensity: 1 * intensity, duration: mainDuration * 0.4, ease: 'power3.in' }, 0)
        .to(this.effects.glitch, { intensity: 0, duration: mainDuration * 0.6, ease: 'power2.out' }, mainDuration * 0.4)
        .to(this.effects.shake, { intensity: 0, duration: mainDuration * 0.6, ease: 'power2.out' }, mainDuration * 0.4)
        .to(this.effects.velocity, { progress: 1, duration: mainDuration * 0.5, ease: 'power2.inOut' }, mainDuration * 0.2)
        .add(() => {
          if (this.audioManager) {
            this.audioManager.playGlitch()
          }
        }, mainDuration * 0.3)
    })
  }

  runOutro() {
    return new Promise((resolve) => {
      this.timeline = gsap.timeline({ onComplete: resolve })
      
      this.timeline
        .to(this.effectsLayer, { alpha: 0, duration: 0.25, ease: 'power2.in' }, 0)
        .add(() => {
          this.effectsLayer.destroy()
        })
    })
  }

  update(dt) {
    this.effectsLayer.update(dt)
    Object.values(this.effects).forEach(effect => {
      if (effect.update) effect.update(dt)
    })
  }

  render(ctx) {
    this.effectsLayer.render(ctx)
  }

  destroy() {
    if (this.timeline) this.timeline.kill()
    Object.values(this.effects).forEach(effect => {
      if (effect.destroy) effect.destroy()
    })
    if (this.effectsLayer) this.effectsLayer.destroy()
  }
}
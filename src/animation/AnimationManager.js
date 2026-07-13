import { AnimationStateMachine, AnimationPhase } from './AnimationStateMachine.js'
import { EffectsLayer } from './EffectsLayer.js'
import { CaptureVFX } from './CaptureVFX.js'
import { ComboSystem } from './ComboSystem.js'
import { CameraController } from './CameraController.js'
import { gsap } from 'gsap'
import { ParticleEngine } from './ParticleEngine.js'

export class AnimationManager {
  constructor(engine, renderer, audioManager, camera) {
    this.engine = engine
    this.renderer = renderer
    this.audioManager = audioManager
    this.camera = camera
    this.stateMachine = new AnimationStateMachine(engine, renderer)
    this.effectsLayer = null
    this.captureVFX = null
    this.comboSystem = new ComboSystem()
    this.lastTime = 0
    this.vfxProgress = 0
    this.currentCaptureData = null
    this.particleEngine = new ParticleEngine(renderer.canvasRenderer.ctx, renderer.canvasRenderer.ctx.canvas)
    
    if (audioManager) {
      audioManager.setComboSystem(this.comboSystem)
    }
    
    this.comboSystem.onComboChange = (state) => {
      if (this.effectsLayer) {
        this.effectsLayer.setComboIntensity(state.intensity)
      }
    }
    
    this.setupEffectsLayer()
    this.bindEngineEvents()
  }

  setupEffectsLayer() {
    const { width, height, squareSize, boardOffsetX, boardOffsetY } = this.renderer.canvasRenderer
    this.effectsLayer = new EffectsLayer(
      this.renderer.canvasRenderer.ctx.canvas,
      boardOffsetX + width / 2,
      boardOffsetY + height / 2
    )
  }

  bindEngineEvents() {
    this.engine.on('capture', (moveData) => this.onCapture(moveData))
  }

  onCapture(moveData) {
    if (this.stateMachine.isAnimating()) return
    
    const comboState = this.comboSystem.registerCapture()
    
    this.currentCaptureData = {
      from: moveData.from,
      to: moveData.to,
      piece: moveData.piece,
      captured: moveData.captured,
      san: moveData.san,
      timestamp: performance.now(),
      pieceType: this.getPieceType(moveData.piece),
      comboState
    }

    this.triggerCinematicCapture(this.currentCaptureData)
    
    this.stateMachine.triggerCapture(this.currentCaptureData).then(() => {
      this.vfxProgress = 1
      this.currentCaptureData = null
    })
  }

  triggerCinematicCapture(captureData) {
    if (!this.camera) return
    
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer.canvasRenderer
    const file = captureData.to % 8
    const rank = Math.floor(captureData.to / 8)
    const cx = boardOffsetX + (file + 0.5) * squareSize
    const cy = boardOffsetY + (7 - rank + 0.5) * squareSize
    
    this.camera.freeze.active = true
    this.camera.freeze.duration = 50
    this.camera.freeze.elapsed = 0
    this.camera.freeze.intensity = 1
    
    this.camera.shakeCamera(15, 600, { frequency: 30 })
    
    this.camera.setTimeScale(0.1, 100).then(() => {
      this.camera.setTimeScale(1, 300)
    })
    
    this.camera.cinematicMode = true
    this.camera.cinematicTarget = captureData.to
    this.camera.cinematicZoom = 1.8
    this.camera.cinematicDuration = 800
    this.camera.cinematicElapsed = 0
    
    this.spawnCaptureParticles(captureData, cx, cy)
  }

  spawnCaptureParticles(captureData, cx, cy) {
    const pieceType = captureData.captured
    const colors = this.getPieceColors(pieceType)
    
    this.particleEngine.emit('shockwave', cx, cy, { colors: ['rgba(255,215,0,0.8)', 'rgba(255,60,60,0.6)'] })
    this.particleEngine.emit('energyShards', cx, cy, { colors })
    this.particleEngine.emit('sparks', cx, cy, { colors: ['#ffd700', '#fff8dc', '#ffec8b'] })
    this.particleEngine.emit('embers', cx, cy, { colors: ['#ff6b35', '#ff8c00', '#ffa500'] })
    this.particleEngine.emit('lightFragments', cx, cy, { colors: ['#00ffff', '#7c4dff', '#ff4081', '#ffd700'] })
    
    const piecePresets = {
      1: 'pawn_dust',
      2: 'knight_slash',
      3: 'bishop_rays',
      4: 'rook_shockwave',
      5: 'queen_nova',
      6: 'king_slowmo'
    }
    
    if (piecePresets[pieceType]) {
      this.particleEngine.emit(piecePresets[pieceType], cx, cy)
    }
  }

  getPieceColors(pieceType) {
    const colorMap = {
      1: ['#ffffff', '#e8e8e8', '#d0d0d0'],
      2: ['#00ffff', '#7c4dff', '#ff4081'],
      3: ['#7c4dff', '#00ffff', '#ffd700'],
      4: ['#ffd700', '#ffec8b', '#fff8dc'],
      5: ['#ff4081', '#7c4dff', '#00ffff', '#ffd700'],
      6: ['#ffd700', '#fff8dc', '#ffec8b', '#ffffe0']
    }
    return colorMap[pieceType] || ['#ffd700', '#ff4081', '#00ffff']
  }

  getPieceType(piece) {
    const type = piece & 0x7
    return type
  }

  update(dt) {
    this.comboSystem.update(dt)
    this.stateMachine.update(dt)
    this.vfxProgress = this.stateMachine.getVFXProgress()
    this.particleEngine.update(dt)
    
    if (this.effectsLayer) {
      this.effectsLayer.update(dt)
    }
  }

  getState() { return this.stateMachine.getState() }
  isAnimating() { return this.stateMachine.isAnimating() }
  getVFXProgress() { return this.vfxProgress }
  getCaptureData() { return this.currentCaptureData }
  getComboState() { return this.comboSystem.getComboState() }

  render(ctx) {
    if (this.stateMachine.isAnimating() && this.stateMachine.getState() !== AnimationPhase.RESUME) {
      this.renderVFX(ctx)
    }
    
    if (this.effectsLayer) {
      this.effectsLayer.render(ctx)
    }
    
    this.particleEngine.render()
  }

  renderVFX(ctx) {
    const state = this.stateMachine.getState()
    const data = this.currentCaptureData
    if (!data) return

    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer.canvasRenderer
    const file = data.to % 8
    const rank = Math.floor(data.to / 8)
    const cx = boardOffsetX + (file + 0.5) * squareSize
    const cy = boardOffsetY + (7 - rank + 0.5) * squareSize

    ctx.save()
    
    const progress = this.vfxProgress
    
    if (state === AnimationPhase.VFX_SEQUENCE) {
      this.renderRadialBurst(ctx, cx, cy, progress)
      this.renderScreenFlash(ctx, progress)
      this.renderChromaticAberration(ctx, cx, cy, progress)
      this.renderLensFlare(ctx, cx, cy, progress)
    }

    ctx.restore()
  }

  renderRadialBurst(ctx, cx, cy, progress) {
    const maxRadius = this.renderer.canvasRenderer.squareSize * 5 * progress
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius)
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.9)')
    gradient.addColorStop(0.3, 'rgba(255, 60, 60, 0.5)')
    gradient.addColorStop(0.6, 'rgba(0, 255, 255, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 60, 60, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  renderScreenFlash(ctx, progress) {
    const alpha = 0.4 * (1 - progress)
    if (alpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillRect(0, 0, this.renderer.canvasRenderer.width, this.renderer.canvasRenderer.height)
    }
  }

  renderChromaticAberration(ctx, cx, cy, progress) {
    const intensity = progress * 8
    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(ctx.canvas, cx - intensity, cy, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(ctx.canvas, cx + intensity, cy, ctx.canvas.width, ctx.canvas.height)
  }

  renderLensFlare(ctx, cx, cy, progress) {
    if (progress > 0.5) return
    const flareProgress = progress / 0.5
    const alpha = (1 - flareProgress) * 0.6
    const size = this.renderer.canvasRenderer.squareSize * 2
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    gradient.addColorStop(0.3, `rgba(255, 215, 0, ${alpha * 0.5})`)
    gradient.addColorStop(0.6, `rgba(0, 255, 255, ${alpha * 0.3})`)
    gradient.addColorStop(1, 'rgba(255, 60, 60, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(cx, cy, size * flareProgress, 0, Math.PI * 2)
    ctx.fill()
  }

  resize(width, height) {
    if (this.effectsLayer) {
      this.effectsLayer.resize(width, height)
    }
    if (this.particleEngine) {
      this.particleEngine.canvas.width = width
      this.particleEngine.canvas.height = height
    }
  }

  dispose() {
    if (this.effectsLayer) {
      this.effectsLayer.destroy()
    }
    this.engine.off('capture')
    this.particleEngine.clear()
  }
}
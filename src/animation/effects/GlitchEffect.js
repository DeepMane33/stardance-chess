export class GlitchEffect {
  constructor(renderer, effectsCtx, options = {}) {
    this.renderer = renderer
    this.effectsCtx = effectsCtx
    this.duration = options.duration || 600
    this.intensity = options.intensity || 1
    this.active = false
    this.startTime = 0
    this.glitchBlocks = []
    this.rgbShift = { r: 0, g: 0, b: 0 }
    this.scanlinePhase = 0
  }

  start() {
    this.active = true
    this.startTime = performance.now()
    this.generateBlocks()
    return new Promise(resolve => { this.onComplete = resolve })
  }

  generateBlocks() {
    this.glitchBlocks = []
    const count = Math.floor(8 * this.intensity)
    for (let i = 0; i < count; i++) {
      this.glitchBlocks.push({
        y: Math.random() * this.renderer.canvasRenderer.height,
        height: 4 + Math.random() * 30,
        xOffset: (Math.random() - 0.5) * 60 * this.intensity,
        delay: Math.random() * 200,
        duration: 80 + Math.random() * 200
      })
    }
  }

  update(dt) {
    if (!this.active) return

    const elapsed = performance.now() - this.startTime
    const progress = Math.min(elapsed / this.duration, 1)

    if (progress >= 1) {
      this.active = false
      this.rgbShift = { r: 0, g: 0, b: 0 }
      if (this.onComplete) this.onComplete()
      return
    }

    const shakeIntensity = (1 - progress) * this.intensity * 2
    this.rgbShift.r = (Math.random() - 0.5) * 10 * shakeIntensity
    this.rgbShift.g = (Math.random() - 0.5) * 4 * shakeIntensity
    this.rgbShift.b = (Math.random() - 0.5) * 10 * shakeIntensity

    this.scanlinePhase += dt * 30 * shakeIntensity

    this.glitchBlocks = this.glitchBlocks.filter(block => {
      const blockElapsed = elapsed - block.delay
      return blockElapsed > 0 && blockElapsed < block.duration
    })
  }

  render(mainCtx) {
    if (!this.active && this.glitchBlocks.length === 0) return

    const w = this.renderer.canvasRenderer.width
    const h = this.renderer.canvasRenderer.height

    this.effectsCtx.clearRect(0, 0, w, h)
    
    this.effectsCtx.drawImage(mainCtx.canvas, 0, 0, w, h)

    this.glitchBlocks.forEach(block => {
      const blockElapsed = performance.now() - this.startTime - block.delay
      if (blockElapsed < 0 || blockElapsed > block.duration) return

      this.effectsCtx.drawImage(
        mainCtx.canvas,
        0, block.y, w, block.height,
        block.xOffset, block.y, w, block.height
      )
    })

    if (this.rgbShift.r !== 0 || this.rgbShift.g !== 0 || this.rgbShift.b !== 0) {
      this.effectsCtx.globalCompositeOperation = 'lighter'
      this.effectsCtx.globalAlpha = 0.25
      this.effectsCtx.drawImage(
        mainCtx.canvas,
        this.rgbShift.r, 0, w, h,
        0, 0, w, h
      )
      this.effectsCtx.globalAlpha = 1
      this.effectsCtx.globalCompositeOperation = 'source-over'
    }

    mainCtx.drawImage(this.effectsCtx.canvas, 0, 0)
    this.renderScanlines(mainCtx, w, h)
  }

  renderScanlines(ctx, w, h) {
    ctx.save()
    ctx.globalAlpha = 0.06 * this.intensity
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    
    const spacing = 4
    for (let y = -this.scanlinePhase; y < h; y += spacing) {
      ctx.beginPath()
      ctx.moveTo(0, Math.floor(y))
      ctx.lineTo(w, Math.floor(y))
      ctx.stroke()
    }
    ctx.restore()
  }

  getProgress() {
    if (!this.active) return 1
    return Math.min((performance.now() - this.startTime) / this.duration, 1)
  }
}
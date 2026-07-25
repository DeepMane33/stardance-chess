export const AnimationPhase = {
  IDLE: 'IDLE',
  CAPTURE_INTRO: 'CAPTURE_INTRO',
  VFX_SEQUENCE: 'VFX_SEQUENCE',
  CAPTURE_OUTRO: 'CAPTURE_OUTRO',
  RESUME: 'RESUME'
}

export class AnimationStateMachine {
  constructor(engine, renderer) {
    this.engine = engine
    this.renderer = renderer
    this.phase = AnimationPhase.IDLE
    this.captureData = null
    this.frozenFrame = null
    this.vfxTimeline = null
    this.onComplete = null
    this.timeScale = 1
    this.lastFrameTime = 0
  }

  getState() { return this.phase }
  getVFXProgress() {
    if (!this.vfxTimeline) return 1
    return this.vfxTimeline.progress()
  }

  isAnimating() { return this.phase !== AnimationPhase.IDLE }

  triggerCapture(captureData) {
    return new Promise((resolve) => {
      this.captureData = captureData
      this.onComplete = resolve
      this.freezeFrame()
      this.engine.setPaused(true)
      this.enterPhase(AnimationPhase.CAPTURE_INTRO)
    })
  }

  freezeFrame() {
    const ctx = this.renderer.canvasRenderer.ctx
    const { width, height } = this.renderer.canvasRenderer
    this.frozenFrame = ctx.getImageData(0, 0, width, height)
  }

  restoreFrozenFrame() {
    if (this.frozenFrame) {
      const ctx = this.renderer.canvasRenderer.ctx
      ctx.putImageData(this.frozenFrame, 0, 0)
    }
  }

  enterPhase(phase) {
    this.phase = phase
    switch (phase) {
      case AnimationPhase.CAPTURE_INTRO:
        this.runIntro()
        break
      case AnimationPhase.VFX_SEQUENCE:
        this.runVFX()
        break
      case AnimationPhase.CAPTURE_OUTRO:
        this.runOutro()
        break
      case AnimationPhase.RESUME:
        this.resume()
        break
    }
  }

  runIntro() {
    import('./CaptureVFX.js').then(({ CaptureVFX }) => {
      this.vfx = new CaptureVFX(this.renderer, this.captureData)
      this.vfx.runIntro().then(() => {
        this.enterPhase(AnimationPhase.VFX_SEQUENCE)
      })
    }).catch(err => {
      console.error('Failed to load CaptureVFX:', err)
      this.resume()
    })
  }

  runVFX() {
    this.vfx.runMain().then(() => {
      this.enterPhase(AnimationPhase.CAPTURE_OUTRO)
    })
  }

  runOutro() {
    this.vfx.runOutro().then(() => {
      this.enterPhase(AnimationPhase.RESUME)
    })
  }

  resume() {
    this.engine.setPaused(false)
    this.frozenFrame = null
    this.vfx = null
    this.vfxTimeline = null
    this.captureData = null
    this.phase = AnimationPhase.IDLE
    if (this.onComplete) {
      this.onComplete()
      this.onComplete = null
    }
  }

  update(dt) {
    if (this.vfx && this.vfx.update) {
      this.vfx.update(dt * this.timeScale)
    }
  }

  setTimeScale(scale) {
    this.timeScale = scale
    if (this.vfxTimeline) {
      this.vfxTimeline.timeScale(scale)
    }
  }

  getCaptureData() { return this.captureData }
}
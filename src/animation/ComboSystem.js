export class ComboSystem {
  constructor() {
    this.comboCount = 0
    this.comboTimer = 0
    this.comboWindow = 3.0
    this.maxCombo = 0
    this.lastCaptureTime = 0
    this.intensity = 1.0
    this.onComboChange = null
  }

  registerCapture() {
    const now = performance.now() / 1000

    if (now - this.lastCaptureTime <= this.comboWindow && this.lastCaptureTime > 0) {
      this.comboCount++
    } else {
      this.comboCount = 1
    }

    this.lastCaptureTime = now
    this.comboTimer = this.comboWindow
    this.maxCombo = Math.max(this.maxCombo, this.comboCount)
    this.intensity = Math.min(1 + (this.comboCount - 1) * 0.25, 3.0)

    if (this.onComboChange) {
      this.onComboChange(this.getComboState())
    }

    return this.getComboState()
  }

  update(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) {
        this.reset()
      }
    }
  }

  reset() {
    this.comboCount = 0
    this.comboTimer = 0
    this.intensity = 1.0
    if (this.onComboChange) {
      this.onComboChange(this.getComboState())
    }
  }

  getComboState() {
    return {
      count: this.comboCount,
      maxCombo: this.maxCombo,
      intensity: this.intensity,
      isActive: this.comboCount > 1,
      timeRemaining: Math.max(0, this.comboTimer)
    }
  }

  getIntensityMultiplier() {
    return this.intensity
  }

  getScreenShakeMultiplier() {
    return 1 + (this.comboCount - 1) * 0.4
  }

  getParticleMultiplier() {
    return 1 + (this.comboCount - 1) * 0.3
  }

  getAudioPitchShift() {
    return Math.min(1 + (this.comboCount - 1) * 0.08, 1.5)
  }

  getTimeDilationMultiplier() {
    return 1 + (this.comboCount - 1) * 0.15
  }
}
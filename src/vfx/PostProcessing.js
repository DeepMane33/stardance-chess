/**
 * PostProcessing — GPU-style post-processing effects for 2D Canvas.
 * Renders to an offscreen canvas then composites with effects applied.
 * Designed for 60 FPS — all operations are O(pixels) via ImageData.
 */
export class PostProcessing {
  constructor(width, height) {
    this.width = width
    this.height = height

    this.offscreen = document.createElement('canvas')
    this.offscreen.width = width
    this.offscreen.height = height
    this.offCtx = this.offscreen.getContext('2d', { willReadFrequently: true })

    this.effectCanvas = document.createElement('canvas')
    this.effectCanvas.width = width
    this.effectCanvas.height = height
    this.effectCtx = this.effectCanvas.getContext('2d')

    this.bloom = { intensity: 0, radius: 8, threshold: 0.6 }
    this.chromatic = { intensity: 0, angle: 0 }
    this.radialBlur = { intensity: 0, centerX: 0, centerY: 0 }
    this.lensDistortion = { intensity: 0 }
    this.vignette = { intensity: 0 }
    this.colorGrade = { brightness: 0, contrast: 0, saturation: 0 }
    this.heatDistortion = { intensity: 0, time: 0 }
    this.screenFlash = { color: [255, 255, 255], intensity: 0 }
    this.directionalBlur = { intensity: 0, angle: 0 }
    this.glitch = { intensity: 0, blockSize: 20, sliceCount: 5 }
    this._dirty = false
    this._lastActiveEffects = ''
  }

  _markDirty() { this._dirty = true }

  setBloom(intensity, radius = 8, threshold = 0.6) {
    this.bloom = { intensity, radius, threshold }
    this._markDirty()
  }
  setChromatic(intensity, angle = 0) {
    this.chromatic = { intensity, angle }
    this._markDirty()
  }
  setRadialBlur(intensity, centerX, centerY) {
    this.radialBlur = { intensity, centerX, centerY }
    this._markDirty()
  }
  setLensDistortion(intensity) {
    this.lensDistortion = { intensity }
    this._markDirty()
  }
  setVignette(intensity) {
    this.vignette = { intensity }
    this._markDirty()
  }
  setColorGrade(brightness = 0, contrast = 0, saturation = 0) {
    this.colorGrade = { brightness, contrast, saturation }
    this._markDirty()
  }
  setScreenFlash(color, intensity) {
    this.screenFlash = { color, intensity }
    this._markDirty()
  }
  setDirectionalBlur(intensity, angle) {
    this.directionalBlur = { intensity, angle }
    this._markDirty()
  }
  setGlitch(intensity, blockSize = 20, sliceCount = 5) {
    this.glitch = { intensity, blockSize, sliceCount }
    this._markDirty()
  }

  resize(w, h) {
    this.width = w
    this.height = h
    this.offscreen.width = w
    this.offscreen.height = h
    this.effectCanvas.width = w
    this.effectCanvas.height = h
  }

  /**
   * Main render entry. Call after all scene rendering.
   * @param {CanvasRenderingContext2D} ctx - the main canvas context
   */
  render(ctx) {
    if (this._destroyed || !this.offscreen) return
    // Quick check for any active effects
    const activeEffects = this._getActiveEffectsSignature()
    
    // If no active effects and not dirty, skip entirely
    if (!activeEffects && !this._dirty) return
    
    // If same active effects as last frame and not dirty, skip (cached)
    if (activeEffects === this._lastActiveEffects && !this._dirty) return
    
    this._lastActiveEffects = activeEffects
    this._dirty = false

    // If no effects are active, just clear stale state and skip compositing
    if (!activeEffects) {
      if (this.effectCtx) this.effectCtx.clearRect(0, 0, this.width, this.height)
      if (this.offCtx) this.offCtx.clearRect(0, 0, this.width, this.height)
      return
    }

    // Copy main canvas to offscreen
    this.offCtx.drawImage(ctx.canvas, 0, 0)

    // Apply effects in order
    if (this.bloom.intensity > 0.01) this.applyBloom()
    if (this.chromatic.intensity > 0.01) this.applyChromaticAberration()
    if (this.radialBlur.intensity > 0.01) this.applyRadialBlur()
    if (this.directionalBlur.intensity > 0.01) this.applyDirectionalBlur()
    if (this.lensDistortion.intensity > 0.01) this.applyLensDistortion()
    if (this.colorGrade.brightness !== 0 || this.colorGrade.contrast !== 0 || this.colorGrade.saturation !== 0) this.applyColorGrade()
    if (this.vignette.intensity > 0.01) this.applyVignette()
    if (this.screenFlash.intensity > 0.01) this.applyScreenFlash()
    if (this.glitch.intensity > 0.01) this.applyGlitch()

    // Composite back
    ctx.save()
    ctx.globalAlpha = 1
    ctx.drawImage(this.effectCanvas, 0, 0)
    ctx.restore()
  }

  _getActiveEffectsSignature() {
    const parts = []
    if (this.bloom.intensity > 0.01) parts.push(`b${this.bloom.intensity.toFixed(2)}`)
    if (this.chromatic.intensity > 0.01) parts.push(`c${this.chromatic.intensity.toFixed(2)}`)
    if (this.radialBlur.intensity > 0.01) parts.push(`r${this.radialBlur.intensity.toFixed(2)}`)
    if (this.lensDistortion.intensity > 0.01) parts.push(`l${this.lensDistortion.intensity.toFixed(2)}`)
    if (this.vignette.intensity > 0.01) parts.push(`v${this.vignette.intensity.toFixed(2)}`)
    if (this.screenFlash.intensity > 0.01) parts.push(`f${this.screenFlash.intensity.toFixed(2)}`)
    if (this.directionalBlur.intensity > 0.01) parts.push(`d${this.directionalBlur.intensity.toFixed(2)}`)
    if (this.glitch.intensity > 0.01) parts.push(`g${this.glitch.intensity.toFixed(2)}`)
    if (this.colorGrade.brightness !== 0 || this.colorGrade.contrast !== 0 || this.colorGrade.saturation !== 0) {
      parts.push(`cg${this.colorGrade.brightness.toFixed(2)}|${this.colorGrade.contrast.toFixed(2)}|${this.colorGrade.saturation.toFixed(2)}`)
    }
    return parts.join(',')
  }

  applyBloom() {
    const { intensity, radius } = this.bloom
    const ctx = this.effectCtx
    const w = this.width
    const h = this.height

    // Create bright-pass: extract pixels above threshold
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.offscreen, 0, 0)
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
      if (brightness > this.bloom.threshold) {
        const factor = (brightness - this.bloom.threshold) / (1 - this.bloom.threshold)
        data[i] = Math.floor(data[i] * factor)
        data[i + 1] = Math.floor(data[i + 1] * factor)
        data[i + 2] = Math.floor(data[i + 2] * factor)
      } else {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)

    // Blur the bright pass (stack box blur for speed)
    this.stackBlur(this.effectCtx, w, h, radius)

    // Composite bloom onto offscreen
    this.offCtx.save()
    this.offCtx.globalCompositeOperation = 'screen'
    this.offCtx.globalAlpha = intensity
    this.offCtx.drawImage(this.effectCanvas, 0, 0)
    this.offCtx.restore()
  }

  applyChromaticAberration() {
    const { intensity, angle } = this.chromatic
    const w = this.width
    const h = this.height
    const ctx = this.effectCtx
    const offCtx = this.offCtx

    const shift = Math.round(intensity * 4)
    if (shift < 1) return

    const dx = Math.cos(angle) * shift
    const dy = Math.sin(angle) * shift

    ctx.clearRect(0, 0, w, h)

    // Red channel shifted one way
    offCtx.save()
    offCtx.globalCompositeOperation = 'source-over'
    const srcData = offCtx.getImageData(0, 0, w, h)
    const redData = ctx.createImageData(w, h)
    for (let i = 0; i < srcData.data.length; i += 4) {
      const px = (i / 4) % w
      const py = Math.floor(i / 4 / w)
      const sx = Math.round(px + dx)
      const sy = Math.round(py + dy)
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const si = (sy * w + sx) * 4
        redData.data[i] = srcData.data[si]
      }
    }

    // Blue channel shifted other way
    const blueData = ctx.createImageData(w, h)
    for (let i = 0; i < srcData.data.length; i += 4) {
      const px = (i / 4) % w
      const py = Math.floor(i / 4 / w)
      const sx = Math.round(px - dx)
      const sy = Math.round(py - dy)
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const si = (sy * w + sx) * 4
        blueData.data[i + 2] = srcData.data[si + 2]
      }
    }
    offCtx.restore()

    ctx.clearRect(0, 0, w, h)
    ctx.putImageData(redData, 0, 0)
    offCtx.save()
    offCtx.globalCompositeOperation = 'screen'
    offCtx.globalAlpha = intensity * 0.7
    offCtx.drawImage(this.effectCanvas, 0, 0)
    offCtx.restore()

    ctx.clearRect(0, 0, w, h)
    ctx.putImageData(blueData, 0, 0)
    offCtx.save()
    offCtx.globalCompositeOperation = 'screen'
    offCtx.globalAlpha = intensity * 0.7
    offCtx.drawImage(this.effectCanvas, 0, 0)
    offCtx.restore()
  }

  applyRadialBlur() {
    const { intensity, centerX, centerY } = this.radialBlur
    const ctx = this.effectCtx
    const offCtx = this.offCtx

    ctx.clearRect(0, 0, this.width, this.height)

    const steps = 6
    const maxOffset = intensity * 12

    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const scale = 1 + t * intensity * 0.02
      const alpha = (1 - t) * 0.3

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(centerX, centerY)
      ctx.scale(scale, scale)
      ctx.translate(-centerX, -centerY)
      ctx.drawImage(this.offscreen, 0, 0)
      ctx.restore()
    }

    offCtx.save()
    offCtx.globalCompositeOperation = 'screen'
    offCtx.globalAlpha = intensity * 0.5
    offCtx.drawImage(this.effectCanvas, 0, 0)
    offCtx.restore()
  }

  applyDirectionalBlur() {
    const { intensity, angle } = this.directionalBlur
    if (intensity < 0.01) return

    const ctx = this.effectCtx
    const offCtx = this.offCtx
    const w = this.width
    const h = this.height

    ctx.clearRect(0, 0, w, h)

    const steps = 8
    const maxOffset = intensity * 15
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    for (let i = 0; i < steps; i++) {
      const t = (i / steps) - 0.5
      const ox = cos * t * maxOffset
      const oy = sin * t * maxOffset
      const alpha = (1 - Math.abs(t) * 2) * 0.25

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.drawImage(this.offscreen, ox, oy)
      ctx.restore()
    }

    offCtx.save()
    offCtx.globalCompositeOperation = 'screen'
    offCtx.globalAlpha = intensity * 0.6
    offCtx.drawImage(this.effectCanvas, 0, 0)
    offCtx.restore()
  }

  applyLensDistortion() {
    const { intensity } = this.lensDistortion
    const ctx = this.effectCtx
    const offCtx = this.offCtx

    ctx.clearRect(0, 0, this.width, this.height)

    const steps = 4
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const scale = 1 + t * intensity * 0.03
      const alpha = (1 - t) * 0.15

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(this.width / 2, this.height / 2)
      ctx.scale(scale, scale)
      ctx.translate(-this.width / 2, -this.height / 2)
      ctx.drawImage(this.offscreen, 0, 0)
      ctx.restore()
    }

    offCtx.save()
    offCtx.globalCompositeOperation = 'screen'
    offCtx.globalAlpha = intensity * 0.4
    offCtx.drawImage(this.effectCanvas, 0, 0)
    offCtx.restore()
  }

  applyVignette() {
    const ctx = this.effectCtx
    const w = this.width
    const h = this.height

    ctx.clearRect(0, 0, w, h)

    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${this.vignette.intensity})`)

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    this.offCtx.save()
    this.offCtx.globalCompositeOperation = 'multiply'
    this.offCtx.globalAlpha = 1
    this.offCtx.drawImage(this.effectCanvas, 0, 0)
    this.offCtx.restore()
  }

  applyColorGrade() {
    const { brightness, contrast, saturation } = this.colorGrade
    if (brightness === 0 && contrast === 0 && saturation === 0) return

    const ctx = this.effectCtx
    const w = this.width
    const h = this.height

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.offscreen, 0, 0)

    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    const brightnessFactor = 1 + brightness
    const contrastFactor = (1 + contrast) / (1 - Math.min(0.99, contrast) + 0.01)
    const satFactor = 1 + saturation

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255
      let g = data[i + 1] / 255
      let b = data[i + 2] / 255

      // Brightness
      r *= brightnessFactor
      g *= brightnessFactor
      b *= brightnessFactor

      // Contrast
      r = (r - 0.5) * contrastFactor + 0.5
      g = (g - 0.5) * contrastFactor + 0.5
      b = (b - 0.5) * contrastFactor + 0.5

      // Saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      r = gray + satFactor * (r - gray)
      g = gray + satFactor * (g - gray)
      b = gray + satFactor * (b - gray)

      data[i] = Math.max(0, Math.min(255, r * 255))
      data[i + 1] = Math.max(0, Math.min(255, g * 255))
      data[i + 2] = Math.max(0, Math.min(255, b * 255))
    }

    ctx.putImageData(imageData, 0, 0)
    this.offCtx.drawImage(this.effectCanvas, 0, 0)
  }

  applyScreenFlash() {
    const { color, intensity } = this.screenFlash
    this.offCtx.save()
    this.offCtx.globalCompositeOperation = 'screen'
    this.offCtx.globalAlpha = intensity
    this.offCtx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`
    this.offCtx.fillRect(0, 0, this.width, this.height)
    this.offCtx.restore()
  }

  applyGlitch() {
    const { intensity, blockSize, sliceCount } = this.glitch
    if (intensity < 0.01) return

    const ctx = this.effectCtx
    const w = this.width
    const h = this.height

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.offscreen, 0, 0)

    // Create random horizontal slices with color channel offset
    const sliceHeight = h / sliceCount
    for (let i = 0; i < sliceCount; i++) {
      if (Math.random() > intensity * 1.5) continue

      const y = i * sliceHeight
      const shift = (Math.random() - 0.5) * blockSize * intensity * 3

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, y, w, sliceHeight)
      ctx.clip()
      ctx.drawImage(this.offscreen, shift, 0)
      ctx.restore()
    }

    // Random color channel blocks
    const blockCount = Math.floor(intensity * 8)
    for (let i = 0; i < blockCount; i++) {
      const bx = Math.random() * w
      const by = Math.random() * h
      const bw = blockSize + Math.random() * blockSize * 2
      const bh = blockSize * 0.5 + Math.random() * blockSize

      ctx.save()
      ctx.globalAlpha = intensity * 0.3
      ctx.globalCompositeOperation = 'screen'
      const colors = ['rgba(255,0,0,0.4)', 'rgba(0,255,0,0.3)', 'rgba(0,0,255,0.4)']
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
      ctx.fillRect(bx, by, bw, bh)
      ctx.restore()
    }

    // Composite glitch onto offscreen
    this.offCtx.save()
    this.offCtx.globalAlpha = 1
    this.offCtx.drawImage(this.effectCanvas, 0, 0)
    this.offCtx.restore()
  }

  /**
   * Fast stack blur — O(n) per pixel, no convolution.
   */
  stackBlur(ctx, w, h, radius) {
    if (radius < 1) return
    const r = Math.round(radius)
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data

    // Horizontal pass
    const temp = new Uint8ClampedArray(data.length)
    const kernelSize = r * 2 + 1
    for (let y = 0; y < h; y++) {
      let rSum = 0, gSum = 0, bSum = 0
      for (let x = -r; x <= r; x++) {
        const idx = (y * w + Math.max(0, Math.min(w - 1, x))) * 4
        rSum += data[idx]
        gSum += data[idx + 1]
        bSum += data[idx + 2]
      }
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4
        temp[idx] = rSum / kernelSize
        temp[idx + 1] = gSum / kernelSize
        temp[idx + 2] = bSum / kernelSize

        const removeIdx = (y * w + Math.max(0, x - r)) * 4
        const addIdx = (y * w + Math.min(w - 1, x + r + 1)) * 4
        rSum += data[addIdx] - data[removeIdx]
        gSum += data[addIdx + 1] - data[removeIdx + 1]
        bSum += data[addIdx + 2] - data[removeIdx + 2]
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      let rSum = 0, gSum = 0, bSum = 0
      for (let y = -r; y <= r; y++) {
        const idx = (Math.max(0, Math.min(h - 1, y)) * w + x) * 4
        rSum += temp[idx]
        gSum += temp[idx + 1]
        bSum += temp[idx + 2]
      }
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4
        data[idx] = rSum / kernelSize
        data[idx + 1] = gSum / kernelSize
        data[idx + 2] = bSum / kernelSize

        const removeIdx = (Math.max(0, y - r) * w + x) * 4
        const addIdx = (Math.min(h - 1, y + r + 1) * w + x) * 4
        rSum += temp[addIdx] - temp[removeIdx]
        gSum += temp[addIdx + 1] - temp[removeIdx + 1]
        bSum += temp[addIdx + 2] - temp[removeIdx + 2]
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  reset() {
    this.bloom = { intensity: 0, radius: 8, threshold: 0.6 }
    this.chromatic = { intensity: 0, angle: 0 }
    this.radialBlur = { intensity: 0, centerX: 0, centerY: 0 }
    this.lensDistortion = { intensity: 0 }
    this.vignette = { intensity: 0 }
    this.colorGrade = { brightness: 0, contrast: 0, saturation: 0 }
    this.heatDistortion = { intensity: 0, time: 0 }
    this.screenFlash = { color: [255, 255, 255], intensity: 0 }
    this.directionalBlur = { intensity: 0, angle: 0 }
    this.glitch = { intensity: 0, blockSize: 20, sliceCount: 5 }
    this._lastActiveEffects = ''
    this._dirty = false
    if (this.effectCtx) {
      this.effectCtx.clearRect(0, 0, this.width, this.height)
    }
    if (this.offCtx) {
      this.offCtx.clearRect(0, 0, this.width, this.height)
    }
  }

  destroy() {
    this.offscreen = null
    this.offCtx = null
    this.effectCanvas = null
    this.effectCtx = null
    this._destroyed = true
  }
}

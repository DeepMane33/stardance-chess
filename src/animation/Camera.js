export class Camera {
  constructor(canvasRenderer) {
    this.canvasRenderer = canvasRenderer

    this.x = 0
    this.y = 0
    this.zoom = 1
    this.rotation = 0
    this.shakeOffset = { x: 0, y: 0 }
    this.shakeIntensity = 0
    this.shakeDuration = 0
    this.shakeTimer = 0
    this.shakeAngle = 0

    this.targetX = 0
    this.targetY = 0
    this.targetZoom = 1
    this.targetRotation = 0

    this.chromaticAberration = 0
    this.vignette = 0
    this.screenFlash = { color: [255, 255, 255], alpha: 0 }
    this.colorGrade = { contrast: 0, saturation: 0, brightness: 0 }

    this.positionLerpSpeed = 0.15
    this.zoomLerpSpeed = 0.15
    this.rotationLerpSpeed = 0.15
    this.viewportWidth = canvasRenderer.width
    this.viewportHeight = canvasRenderer.height

    this.boardCenterX = canvasRenderer.boardOffsetX + canvasRenderer.squareSize * 4
    this.boardCenterY = canvasRenderer.boardOffsetY + canvasRenderer.squareSize * 4

    this.x = this.boardCenterX
    this.y = this.boardCenterY
    this.targetX = this.boardCenterX
    this.targetY = this.boardCenterY

    this.isActive = false
  }

  setViewport(width, height) {
    this.viewportWidth = width
    this.viewportHeight = height
  }

  setBoardCenter(x, y) {
    this.boardCenterX = x
    this.boardCenterY = y
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
  }

  update(dt, rawDt = dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= rawDt
      const progress = 1 - this.shakeTimer / this.shakeDuration
      const currentIntensity = this.shakeIntensity * (1 - progress)

      const shakeX = Math.cos(this.shakeAngle + this.shakeTimer * 60) * currentIntensity
      const shakeY = Math.sin(this.shakeAngle + this.shakeTimer * 60) * currentIntensity * 0.5

      this.shakeOffset.x = shakeX
      this.shakeOffset.y = shakeY

      if (this.shakeTimer <= 0) {
        this.shakeOffset.x = 0
        this.shakeOffset.y = 0
      }
    }

    const dt60 = dt * 60
    this.x += (this.targetX - this.x) * this.positionLerpSpeed * dt60
    this.y += (this.targetY - this.y) * this.positionLerpSpeed * dt60
    this.zoom += (this.targetZoom - this.zoom) * this.zoomLerpSpeed * dt60
    this.rotation += (this.targetRotation - this.rotation) * this.rotationLerpSpeed * dt60

    if (Math.abs(this.targetX - this.x) < 0.01) this.x = this.targetX
    if (Math.abs(this.targetY - this.y) < 0.01) this.y = this.targetY
    if (Math.abs(this.targetZoom - this.zoom) < 0.001) this.zoom = this.targetZoom
    if (Math.abs(this.targetRotation - this.rotation) < 0.001) this.rotation = this.targetRotation

    this.isActive = this.shakeTimer > 0 ||
                    Math.abs(this.zoom - 1) > 0.001 ||
                    Math.abs(this.rotation) > 0.001 ||
                    Math.abs(this.x - this.boardCenterX) > 0.01 ||
                    Math.abs(this.y - this.boardCenterY) > 0.01 ||
                    this.chromaticAberration > 0.001 ||
                    this.vignette > 0.001 ||
                    this.screenFlash?.alpha > 0.001
  }

  panTo(x, y, duration = 0.3) {
    this.targetX = x
    this.targetY = y
    this.positionLerpSpeed = duration > 0 ? 1 / (duration * 60) : 1
  }

  zoomTo(zoom, duration = 0.3) {
    this.targetZoom = zoom
    this.zoomLerpSpeed = duration > 0 ? 1 / (duration * 60) : 1
  }

  rotateTo(rotation, duration = 0.3) {
    this.targetRotation = rotation
    this.rotationLerpSpeed = duration > 0 ? 1 / (duration * 60) : 1
  }

  shake(intensity, duration, angle = 0) {
    this.shakeIntensity = intensity
    this.shakeDuration = duration
    this.shakeTimer = duration
    this.shakeAngle = angle
  }

  directionalShake(intensity, angle, duration) {
    this.shake(intensity, duration, angle)
  }

  follow(targetX, targetY, smoothness = 0.15) {
    this.targetX = targetX
    this.targetY = targetY
    this.positionLerpSpeed = smoothness
  }

  lookAt(x, y) {
    this.targetX = x
    this.targetY = y
  }

  applyTransform(ctx) {
    const cx = this.viewportWidth / 2
    const cy = this.viewportHeight / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y)
    ctx.scale(this.zoom, this.zoom)
    ctx.rotate(this.rotation)
    ctx.translate(-cx - this.x, -cy - this.y)
  }

  restoreTransform(ctx) {
    ctx.restore()
  }

  getTransform() {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom,
      rotation: this.rotation,
      shakeOffset: { ...this.shakeOffset },
      chromaticAberration: this.chromaticAberration || 0,
      vignette: this.vignette || 0,
      screenFlash: this.screenFlash || { color: [255, 255, 255], alpha: 0 },
      colorGrade: this.colorGrade || { contrast: 0, saturation: 0, brightness: 0 }
    }
  }

  setTransform(transform) {
    this.x = transform.x
    this.y = transform.y
    this.zoom = transform.zoom
    this.rotation = transform.rotation
    this.shakeOffset = transform.shakeOffset
  }

  reset(instant = false) {
    this.x = this.boardCenterX
    this.y = this.boardCenterY
    this.zoom = 1
    this.rotation = 0
    this.shakeOffset = { x: 0, y: 0 }
    this.shakeIntensity = 0
    this.shakeTimer = 0
    this.targetX = this.boardCenterX
    this.targetY = this.boardCenterY
    this.targetZoom = 1
    this.targetRotation = 0
    this.chromaticAberration = 0
    this.vignette = 0
    this.screenFlash = { color: [255, 255, 255], alpha: 0 }
    this.colorGrade = { contrast: 0, saturation: 0, brightness: 0 }
    if (instant) {
      this.positionLerpSpeed = 1
      this.zoomLerpSpeed = 1
      this.rotationLerpSpeed = 1
    }
  }

  snapToBoardCenter() {
    this.x = this.boardCenterX
    this.y = this.boardCenterY
    this.targetX = this.boardCenterX
    this.targetY = this.boardCenterY
    this.zoom = 1
    this.targetZoom = 1
    this.rotation = 0
    this.targetRotation = 0
    this.shakeOffset = { x: 0, y: 0 }
    this.shakeTimer = 0
    this.chromaticAberration = 0
    this.vignette = 0
    this.screenFlash = { color: [255, 255, 255], alpha: 0 }
  }

  isShaking() {
    return this.shakeTimer > 0
  }

  isAnimating() {
    return Math.abs(this.x - this.targetX) > 0.1 ||
           Math.abs(this.y - this.targetY) > 0.1 ||
           Math.abs(this.zoom - this.targetZoom) > 0.01 ||
           Math.abs(this.rotation - this.targetRotation) > 0.01
  }

  screenToWorld(screenX, screenY) {
    const cx = this.viewportWidth / 2
    const cy = this.viewportHeight / 2

    let x = screenX - cx
    let y = screenY - cy

    x /= this.zoom
    y /= this.zoom

    const cos = Math.cos(-this.rotation)
    const sin = Math.sin(-this.rotation)
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos

    x = rx + this.x + cx - this.shakeOffset.x / this.zoom
    y = ry + this.y + cy - this.shakeOffset.y / this.zoom

    return { x, y }
  }

  worldToScreen(worldX, worldY) {
    const cx = this.viewportWidth / 2
    const cy = this.viewportHeight / 2

    let x = worldX - this.x - cx
    let y = worldY - this.y - cy

    const cos = Math.cos(this.rotation)
    const sin = Math.sin(this.rotation)
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos

    x = rx * this.zoom + cx + this.shakeOffset.x
    y = ry * this.zoom + cy + this.shakeOffset.y

    return { x, y }
  }

  setTimeScale(scale) {
    this.positionLerpSpeed = 0.15 * scale
    this.zoomLerpSpeed = 0.15 * scale
    this.rotationLerpSpeed = 0.15 * scale
  }
}
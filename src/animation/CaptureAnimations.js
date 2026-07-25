import { Piece, Color } from '../core/ChessTypes.js'
import { Easing } from './Easing.js'

/**
 * CaptureAnimations — Cinematic capture VFX system.
 *
 * Handles five tiers of capture effects:
 * 1. EDIT_DISSOLVE   — General capture: glitch + pixel-dissolve + scanlines
 * 2. PAWN_SPLIT      — Pawn capture: splits victim in two halves, no particles
 * 3. KNIGHT_DARKNESS — Knight captures Queen OR delivers checkmate:
 *                        board goes dark, knight moves in true L-shape,
 *                        slowly rotates 360°, lands with edit effect.
 *                        Duration: 2.0–4.0 seconds.
 * 4. EPIC_CLASH      — Big piece captures big piece (Q↔Q, R↔R, etc.):
 *                        higher-tier impact, stronger shake, more debris,
 *                        chromatic aberration, longer freeze frame.
 * 5. ROYAL_DECAP     — Any piece captures King (checkmate final blow):
 *                        crown shatter, extreme slow-motion, screen desaturation.
 */

export const CaptureTier = {
  EDIT_DISSOLVE: 'edit_dissolve',
  PAWN_SPLIT: 'pawn_split',
  KNIGHT_DARKNESS: 'knight_darkness',
  EPIC_CLASH: 'epic_clash',
  ROYAL_DECAP: 'royal_decap',
  QUEEN_SLASH: 'queen_slash',
  ROOK_PATH: 'rook_path'
}

const BIG_PIECES = new Set([Piece.QUEEN, Piece.ROOK, Piece.BISHOP, Piece.KNIGHT])
function isBigPiece(piece) {
  return BIG_PIECES.has(piece)
}

/**
 * Determine the capture animation tier based on attacker, victim, and game state.
 */
export function resolveCaptureTier(attackerPiece, victimPiece, isCheckmate = false, isKnightFork = false) {
  // Royal decap: capturing the king (checkmate situation)
  if (victimPiece === Piece.KING || isCheckmate) {
    return CaptureTier.ROYAL_DECAP
  }

  // Knight special: knight captures queen/rook OR delivers a fork
  if (attackerPiece === Piece.KNIGHT && (victimPiece === Piece.QUEEN || victimPiece === Piece.ROOK || isKnightFork)) {
    return CaptureTier.KNIGHT_DARKNESS
  }

  // Queen slash: queen captures anything except pawn
  if (attackerPiece === Piece.QUEEN && victimPiece !== Piece.PAWN) {
    return CaptureTier.QUEEN_SLASH
  }

  // Rook path: rook captures anything
  if (attackerPiece === Piece.ROOK) {
    return CaptureTier.ROOK_PATH
  }

  // Pawn split: pawn captures anything
  if (attackerPiece === Piece.PAWN) {
    return CaptureTier.PAWN_SPLIT
  }

  // Epic clash: big piece captures big piece
  if (isBigPiece(attackerPiece) && isBigPiece(victimPiece)) {
    return CaptureTier.EPIC_CLASH
  }

  // Default: edit dissolve
  return CaptureTier.EDIT_DISSOLVE
}

/* ================================================================
   EDIT DISSOLVE EFFECT
   ================================================================ */

export class EditDissolveEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 0.5
    this.finished = false

    this.flashAlpha = 0
    this.glitchIntensity = 0
    this.scanlineAlpha = 0
    this.pixelateSize = 1
    this.vignette = 0
    this.boardDarken = 0
    this.dissolveProgress = 0
    this.rgbSplit = 0
    this.ringProgress = 0
    this.glowIntensity = 0

    this.glitchBlocks = []
    this.scanlineOffset = 0
  }

  start() {
    this.generateGlitchBlocks()
  }

  generateGlitchBlocks() {
    this.glitchBlocks = []
    const count = 10
    for (let i = 0; i < count; i++) {
      this.glitchBlocks.push({
        y: this.cy - this.pieceSize * 0.5 + Math.random() * this.pieceSize,
        height: 2 + Math.random() * this.pieceSize * 0.25,
        xOffset: (Math.random() - 0.5) * this.pieceSize * 0.6,
        delay: Math.random() * 0.3,
        duration: 0.08 + Math.random() * 0.15
      })
    }
  }

  update(progress) {
    const p = progress

    // Phase 1: Anticipation (0–12%) — board darkens, vignette builds
    if (p < 0.12) {
      const t = p / 0.12
      this.boardDarken = Easing.easeOutCubic(t) * 0.25
      this.vignette = Easing.easeOutCubic(t) * 0.35
    } else if (p < 0.18) {
      this.boardDarken = 0.25
      this.vignette = 0.35
    } else if (p < 0.30) {
      const t = (p - 0.18) / 0.12
      this.boardDarken = 0.25 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.35 * (1 - Easing.easeOutCubic(t))
    } else {
      this.boardDarken = 0
      this.vignette = 0
    }

    // Phase 2: Flash + glitch (12–18%)
    if (p >= 0.12 && p < 0.18) {
      const t = (p - 0.12) / 0.06
      this.flashAlpha = Math.sin(t * Math.PI) * 0.8
      this.glitchIntensity = Math.sin(t * Math.PI) * 1.0
      this.rgbSplit = Math.sin(t * Math.PI) * 0.7
      this.scanlineAlpha = Math.sin(t * Math.PI) * 0.5
    } else if (p >= 0.18 && p < 0.30) {
      const t = (p - 0.18) / 0.12
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 0.8
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 1.0
      this.rgbSplit = Easing.easeOutCubic(1 - t) * 0.7
      this.scanlineAlpha = Easing.easeOutCubic(1 - t) * 0.5
    } else {
      this.flashAlpha = 0
      this.glitchIntensity = 0
      this.rgbSplit = 0
      this.scanlineAlpha = 0
    }

    // Phase 3: Dissolve (18–55%) — pixelate + alpha fade
    if (p >= 0.18 && p < 0.55) {
      const t = (p - 0.18) / 0.37
      this.dissolveProgress = t
      this.pixelateSize = 1 + Easing.easeInCubic(t) * 12
    } else if (p >= 0.55) {
      this.dissolveProgress = 1
      this.pixelateSize = 13
    }

    // Phase 4: Ring expansion (18–70%)
    if (p >= 0.18 && p < 0.70) {
      const t = (p - 0.18) / 0.52
      this.ringProgress = t
    } else if (p >= 0.70) {
      this.ringProgress = 1
    }

    // Phase 5: Glow (14–40%)
    if (p >= 0.14 && p < 0.40) {
      const t = (p - 0.14) / 0.26
      this.glowIntensity = Easing.easeOutCubic(t)
    } else if (p >= 0.40 && p < 0.55) {
      const t = (p - 0.40) / 0.15
      this.glowIntensity = Easing.easeOutCubic(1 - t)
    } else {
      this.glowIntensity = 0
    }

    this.scanlineOffset += 0.016 * 60 * this.glitchIntensity

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer

    // Board darken overlay
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.6})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.25
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 4)
      const ringW = this.pieceSize * 0.1 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.9
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Glitch blocks (rendered as horizontal displaced strips)
    if (this.glitchIntensity > 0.01) {
      for (const block of this.glitchBlocks) {
        if (this.dissolveProgress > block.delay / 0.3 + 0.5) continue
        const bx = this.cx - this.pieceSize * 0.5 + block.xOffset * this.glitchIntensity
        const by = block.y
        const bw = this.pieceSize * (0.8 + Math.random() * 0.4 * this.glitchIntensity)
        const bh = block.height
        ctx.save()
        ctx.globalAlpha = this.glitchIntensity * 0.6
        ctx.fillStyle = this.victimColor === Color.WHITE ? '#ffffff' : '#222222'
        ctx.fillRect(bx, by, bw, bh)
        ctx.restore()
      }
    }

    // Scanlines
    if (this.scanlineAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.scanlineAlpha * 0.08
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      const spacing = 3
      const offset = this.scanlineOffset % spacing
      for (let y = offset; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Chromatic aberration (RGB split)
    if (this.rgbSplit > 0.01) {
      const splitDist = this.pieceSize * 0.05 * this.rgbSplit
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.35 * this.rgbSplit
      // Red channel offset
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(-100deg)'
      ctx.drawImage(ctx.canvas, -splitDist, 0)
      // Blue channel offset
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(100deg)'
      ctx.drawImage(ctx.canvas, splitDist, 0)
      ctx.filter = 'none'
      ctx.restore()
    }
  }
}

/* ================================================================
   PAWN SPLIT EFFECT
   ================================================================ */

export class PawnSplitEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor, travelAngle) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.travelAngle = travelAngle
    this.duration = 0.6
    this.finished = false

    this.splitProgress = 0
    this.leftHalfOffset = 0
    this.rightHalfOffset = 0
    this.dissolveAlpha = 1
    this.glitchIntensity = 0
    this.scanlineAlpha = 0
    this.flashAlpha = 0
    this.boardDarken = 0
    this.vignette = 0
    this.ringProgress = 0

    this.scanlineOffset = 0
    this.glitchBlocks = []
  }

  start() {
    this.generateGlitchBlocks()
  }

  generateGlitchBlocks() {
    this.glitchBlocks = []
    for (let i = 0; i < 8; i++) {
      this.glitchBlocks.push({
        y: this.cy - this.pieceSize * 0.5 + Math.random() * this.pieceSize,
        height: 2 + Math.random() * this.pieceSize * 0.2,
        xOffset: (Math.random() - 0.5) * this.pieceSize * 0.5,
        delay: Math.random() * 0.25,
        duration: 0.06 + Math.random() * 0.12
      })
    }
  }

  update(progress) {
    const p = progress

    // Phase 1: Anticipation (0–10%)
    if (p < 0.10) {
      const t = p / 0.10
      this.boardDarken = Easing.easeOutCubic(t) * 0.15
      this.vignette = Easing.easeOutCubic(t) * 0.25
    } else if (p < 0.50) {
      const t = (p - 0.10) / 0.40
      this.boardDarken = 0.15 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.25 * (1 - Easing.easeOutCubic(t))
    } else {
      this.boardDarken = 0
      this.vignette = 0
    }

    // Phase 2: Flash + glitch (10–22%)
    if (p >= 0.10 && p < 0.22) {
      const t = (p - 0.10) / 0.12
      this.flashAlpha = Math.sin(t * Math.PI) * 0.7
      this.glitchIntensity = Math.sin(t * Math.PI) * 0.9
      this.scanlineAlpha = Math.sin(t * Math.PI) * 0.4
    } else if (p >= 0.22 && p < 0.35) {
      const t = (p - 0.22) / 0.13
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 0.7
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 0.9
      this.scanlineAlpha = Easing.easeOutCubic(1 - t) * 0.4
    } else {
      this.flashAlpha = 0
      this.glitchIntensity = 0
      this.scanlineAlpha = 0
    }

    // Phase 3: SPLIT (18–65%) — halves separate perpendicular to travel
    if (p >= 0.18 && p < 0.65) {
      const t = (p - 0.18) / 0.47
      const splitDir = this.travelAngle + Math.PI / 2
      const maxOffset = this.pieceSize * 0.6
      this.splitProgress = t
      this.leftHalfOffset = -Easing.easeInOutCubic(t) * maxOffset
      this.rightHalfOffset = Easing.easeInOutCubic(t) * maxOffset
    }

    // Phase 4: Dissolve (35–75%)
    if (p >= 0.35 && p < 0.75) {
      const t = (p - 0.35) / 0.40
      this.dissolveAlpha = 1 - Easing.easeInCubic(t)
    } else if (p >= 0.75) {
      this.dissolveAlpha = 0
    }

    // Phase 5: Ring (18–70%)
    if (p >= 0.18 && p < 0.70) {
      const t = (p - 0.18) / 0.52
      this.ringProgress = t
    } else if (p >= 0.70) {
      this.ringProgress = 1
    }

    this.scanlineOffset += 0.016 * 50 * this.glitchIntensity
    if (p >= 1) this.finished = true
  }

  render(ctx, victimImage) {
    const { width, height } = this.canvasRenderer

    // Board darken
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.55})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.22
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 3.5)
      const ringW = this.pieceSize * 0.08 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.85
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Glitch blocks
    if (this.glitchIntensity > 0.01) {
      for (const block of this.glitchBlocks) {
        if (this.splitProgress > block.delay / 0.25 + 0.5) continue
        ctx.save()
        ctx.globalAlpha = this.glitchIntensity * 0.5
        ctx.fillStyle = this.victimColor === Color.WHITE ? '#ffffff' : '#222222'
        ctx.fillRect(
          this.cx - this.pieceSize * 0.5 + block.xOffset * this.glitchIntensity,
          block.y,
          this.pieceSize * (0.7 + Math.random() * 0.3 * this.glitchIntensity),
          block.height
        )
        ctx.restore()
      }
    }

    // Scanlines
    if (this.scanlineAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.scanlineAlpha * 0.07
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      const spacing = 3
      for (let y = this.scanlineOffset % spacing; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  /**
   * Draw the split victim piece using clip regions.
   * Call this from the piece renderer when drawing the victim ghost.
   */
  drawSplitVictim(ctx, drawFn) {
    if (this.dissolveAlpha <= 0.01) return

    const halfW = this.pieceSize * 0.5
    const splitAngle = this.travelAngle + Math.PI / 2

    // Left half
    ctx.save()
    ctx.globalAlpha = this.dissolveAlpha
    ctx.beginPath()
    ctx.rect(this.cx - this.pieceSize * 0.5 + this.leftHalfOffset * Math.cos(splitAngle),
             this.cy - this.pieceSize * 0.5,
             halfW, this.pieceSize)
    ctx.clip()
    ctx.translate(this.leftHalfOffset * Math.cos(splitAngle), this.leftHalfOffset * Math.sin(splitAngle))
    drawFn()
    ctx.restore()

    // Right half
    ctx.save()
    ctx.globalAlpha = this.dissolveAlpha
    ctx.beginPath()
    ctx.rect(this.cx,
             this.cy - this.pieceSize * 0.5,
             halfW, this.pieceSize)
    ctx.clip()
    ctx.translate(this.rightHalfOffset * Math.cos(splitAngle), this.rightHalfOffset * Math.sin(splitAngle))
    drawFn()
    ctx.restore()
  }
}

/* ================================================================
   KNIGHT DARKNESS EFFECT
   ================================================================ */

export class KnightDarknessEffect {
  constructor(canvasRenderer, fromX, fromY, toX, toY, pieceSize, knightColor) {
    this.canvasRenderer = canvasRenderer
    this.fromX = fromX
    this.fromY = fromY
    this.toX = toX
    this.toY = toY
    this.pieceSize = pieceSize
    this.knightColor = knightColor
    this.duration = 1.5
    this.finished = false

    this.waypoint = this.computeLWaypoint(fromX, fromY, toX, toY)

    // Knight position during L-jump
    this.knightX = fromX
    this.knightY = fromY
    this.knightRotation = 0
    this.knightScale = 1
    this.trail = []

    // Camera zoom (chess edit zoom-in effect)
    this.zoom = 1
    this.zoomTarget = 1

    // Impact effects
    this.flashAlpha = 0
    this.ringProgress = 0
    this.ringProgress2 = 0

    // Speed lines along the L-path (anime style)
    this.speedLines = []
    this.speedLineAlpha = 0

    // Particle burst on impact
    this.particles = []

    // Crack lines from impact
    this.crackLines = []
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.3
      this.crackLines.push({
        angle,
        length: 0,
        maxLength: this.pieceSize * (2 + Math.random() * 3),
        width: 1.5 + Math.random() * 2,
        alpha: 0
      })
    }

    // Dust cloud
    this.dustCloud = []
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4
      this.dustCloud.push({
        angle,
        dist: 0,
        maxDist: this.pieceSize * (0.5 + Math.random() * 1.5),
        size: this.pieceSize * (0.06 + Math.random() * 0.1),
        alpha: 0
      })
    }

    // Direction of travel for speed lines
    const dx = toX - fromX
    const dy = toY - fromY
    this.travelAngle = Math.atan2(dy, dx)
  }

  computeLWaypoint(x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: x2, y: y1 }
    } else {
      return { x: x1, y: y2 }
    }
  }

  start() {
    // Generate speed lines along the L-path
    this.generateSpeedLines()
    // Generate impact particles
    this.generateParticles()
  }

  generateSpeedLines() {
    this.speedLines = []
    // Lines along first leg
    const dx1 = this.waypoint.x - this.fromX
    const dy1 = this.waypoint.y - this.fromY
    const angle1 = Math.atan2(dy1, dx1)
    for (let i = 0; i < 12; i++) {
      const t = Math.random()
      const baseX = this.fromX + dx1 * t
      const baseY = this.fromY + dy1 * t
      const perpAngle = angle1 + Math.PI / 2
      const offset = (Math.random() - 0.5) * this.pieceSize * 1.5
      this.speedLines.push({
        x: baseX + Math.cos(perpAngle) * offset,
        y: baseY + Math.sin(perpAngle) * offset,
        angle: angle1,
        length: this.pieceSize * (0.5 + Math.random() * 1.5),
        width: 1 + Math.random() * 2,
        alpha: 0,
        delay: t * 0.3
      })
    }
    // Lines along second leg
    const dx2 = this.toX - this.waypoint.x
    const dy2 = this.toY - this.waypoint.y
    const angle2 = Math.atan2(dy2, dx2)
    for (let i = 0; i < 12; i++) {
      const t = Math.random()
      const baseX = this.waypoint.x + dx2 * t
      const baseY = this.waypoint.y + dy2 * t
      const perpAngle = angle2 + Math.PI / 2
      const offset = (Math.random() - 0.5) * this.pieceSize * 1.5
      this.speedLines.push({
        x: baseX + Math.cos(perpAngle) * offset,
        y: baseY + Math.sin(perpAngle) * offset,
        angle: angle2,
        length: this.pieceSize * (0.5 + Math.random() * 1.5),
        width: 1 + Math.random() * 2,
        alpha: 0,
        delay: 0.3 + t * 0.3
      })
    }
  }

  generateParticles() {
    this.particles = []
    const cx = this.toX + this.pieceSize / 2
    const cy = this.toY + this.pieceSize / 2
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.5
      const speed = 80 + Math.random() * 250
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40 - Math.random() * 80,
        size: this.pieceSize * (0.03 + Math.random() * 0.06),
        alpha: 1,
        gravity: 300 + Math.random() * 200,
        color: ['#ffd700', '#ff6600', '#ffffff', '#ff4444'][Math.floor(Math.random() * 4)],
        shape: ['square', 'diamond'][Math.floor(Math.random() * 2)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15
      })
    }
  }

  update(progress) {
    const p = progress

    // Phase 1: L-shape jump (0–65%)
    if (p < 0.65) {
      const t = p / 0.65
      const legRatio = 0.55

      if (t < legRatio) {
        const lt = t / legRatio
        const eased = Easing.easeInOutCubic(lt)
        this.knightX = this.fromX + (this.waypoint.x - this.fromX) * eased
        this.knightY = this.fromY + (this.waypoint.y - this.fromY) * eased
      } else {
        const lt = (t - legRatio) / (1 - legRatio)
        const eased = Easing.easeInOutCubic(lt)
        this.knightX = this.waypoint.x + (this.toX - this.waypoint.x) * eased
        this.knightY = this.waypoint.y + (this.toY - this.waypoint.y) * eased
      }

      // Rotation during jump
      this.knightRotation = t * Math.PI * 2

      // Arc height (parabolic lift)
      const arcT = Math.sin(t * Math.PI)
      this.knightScale = 1 + arcT * 0.15

      // Trail
      this.trail.push({ x: this.knightX, y: this.knightY })
      if (this.trail.length > 15) this.trail.shift()

      // Speed lines appear during movement
      this.speedLineAlpha = Math.sin(t * Math.PI) * 0.6
      for (const line of this.speedLines) {
        if (p >= line.delay && p < line.delay + 0.4) {
          const lt = (p - line.delay) / 0.4
          line.alpha = Math.sin(lt * Math.PI) * 0.7
        } else {
          line.alpha = 0
        }
      }

      // Camera zoom in during jump
      this.zoom = 1 + arcT * 0.08
    } else if (p >= 0.65) {
      this.knightX = this.toX
      this.knightY = this.toY
      this.knightScale = 1
      this.speedLineAlpha = 0
      for (const line of this.speedLines) line.alpha = 0
    }

    // Phase 2: Impact slam (65–80%) — the "chess edit" moment
    if (p >= 0.65 && p < 0.72) {
      const t = (p - 0.65) / 0.07
      // Zoom slam: zoom in hard then snap back
      this.zoom = 1.08 + Math.sin(t * Math.PI) * 0.12
      this.flashAlpha = Math.sin(t * Math.PI) * 1.0
    } else if (p >= 0.72 && p < 0.85) {
      const t = (p - 0.72) / 0.13
      this.zoom = 1 + Easing.easeOutCubic(1 - t) * 0.08
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.0
    } else if (p >= 0.85) {
      this.zoom = 1
      this.flashAlpha = 0
    }

    // Phase 3: Ring expansion (67–95%)
    if (p >= 0.67 && p < 0.95) {
      this.ringProgress = (p - 0.67) / 0.28
    } else if (p >= 0.95) {
      this.ringProgress = 1
    }
    // Second ring (delayed)
    if (p >= 0.70 && p < 0.97) {
      this.ringProgress2 = (p - 0.70) / 0.27
    } else if (p >= 0.97) {
      this.ringProgress2 = 1
    }

    // Phase 4: Crack lines (66–85%)
    if (p >= 0.66 && p < 0.85) {
      const t = (p - 0.66) / 0.19
      for (const crack of this.crackLines) {
        crack.length = crack.maxLength * Easing.easeOutExpo(t)
        crack.alpha = (1 - t) * 0.9
      }
    } else if (p >= 0.85) {
      for (const crack of this.crackLines) crack.alpha = 0
    }

    // Phase 5: Dust cloud (65–82%)
    if (p >= 0.65 && p < 0.82) {
      const t = (p - 0.65) / 0.17
      for (const dust of this.dustCloud) {
        dust.dist = dust.maxDist * Easing.easeOutCubic(t)
        dust.alpha = (1 - t) * 0.45
      }
    } else if (p >= 0.82) {
      for (const dust of this.dustCloud) dust.alpha = 0
    }

    // Update particles
    for (const part of this.particles) {
      if (part.alpha <= 0) continue
      part.vy += part.gravity * 0.016
      part.x += part.vx * 0.016
      part.y += part.vy * 0.016
      part.rotation += part.rotationSpeed * 0.016
      if (p >= 0.70) {
        const fadeT = Math.min((p - 0.70) / 0.30, 1)
        part.alpha = 1 - fadeT
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const cx = this.knightX + this.pieceSize / 2
    const cy = this.knightY + this.pieceSize / 2

    // Apply local zoom around impact point (only during impact)
    if (this.zoom > 1.01) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(this.zoom, this.zoom)
      ctx.translate(-cx, -cy)
    }

    // Speed lines (anime-style along the L-path)
    if (this.speedLineAlpha > 0.01) {
      ctx.save()
      for (const line of this.speedLines) {
        if (line.alpha <= 0.01) continue
        ctx.globalAlpha = line.alpha * this.speedLineAlpha
        ctx.strokeStyle = this.knightColor === Color.WHITE ? '#ffffff' : '#aaaaaa'
        ctx.lineWidth = line.width
        ctx.lineCap = 'round'
        ctx.beginPath()
        const sx = line.x - Math.cos(line.angle) * line.length * 0.5
        const sy = line.y - Math.sin(line.angle) * line.length * 0.5
        const ex = line.x + Math.cos(line.angle) * line.length * 0.5
        const ey = line.y + Math.sin(line.angle) * line.length * 0.5
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Trail glow
    if (this.trail.length > 1) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      for (let i = 1; i < this.trail.length; i++) {
        const t = i / this.trail.length
        const prev = this.trail[i - 1]
        const curr = this.trail[i]
        ctx.globalAlpha = t * 0.2
        ctx.strokeStyle = this.knightColor === Color.WHITE ? '#ffffff' : '#888888'
        ctx.lineWidth = this.pieceSize * 0.08 * t
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(prev.x + this.pieceSize / 2, prev.y + this.pieceSize / 2)
        ctx.lineTo(curr.x + this.pieceSize / 2, curr.y + this.pieceSize / 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Impact flash (white overlay)
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.4
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Ring 1 (gold)
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 5)
      const ringW = this.pieceSize * 0.14 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.85
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Ring 2 (orange, delayed)
    if (this.ringProgress2 > 0.01 && this.ringProgress2 < 1) {
      const ringR = this.pieceSize * (0.3 + this.ringProgress2 * 6)
      const ringW = this.pieceSize * 0.10 * (1 - this.ringProgress2)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress2) * 0.6
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Crack lines
    for (const crack of this.crackLines) {
      if (crack.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = crack.alpha
      ctx.strokeStyle = '#ffaa00'
      ctx.lineWidth = crack.width
      ctx.shadowColor = '#ffaa00'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(
        cx + Math.cos(crack.angle) * crack.length,
        cy + Math.sin(crack.angle) * crack.length
      )
      ctx.stroke()
      ctx.restore()
    }

    // Dust cloud
    for (const dust of this.dustCloud) {
      if (dust.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = dust.alpha
      ctx.fillStyle = '#d2b48c'
      const dx = cx + Math.cos(dust.angle) * dust.dist
      const dy = cy + Math.sin(dust.angle) * dust.dist
      ctx.beginPath()
      ctx.arc(dx, dy, dust.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Particles (squares + diamonds flying outward)
    for (const part of this.particles) {
      if (part.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = part.alpha
      ctx.translate(part.x, part.y)
      ctx.rotate(part.rotation)
      ctx.fillStyle = part.color
      ctx.shadowColor = part.color
      ctx.shadowBlur = 6
      if (part.shape === 'square') {
        ctx.fillRect(-part.size / 2, -part.size / 2, part.size, part.size)
      } else {
        ctx.beginPath()
        ctx.moveTo(0, -part.size)
        ctx.lineTo(part.size, 0)
        ctx.lineTo(0, part.size)
        ctx.lineTo(-part.size, 0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Restore local zoom
    if (this.zoom > 1.01) {
      ctx.restore()
    }

    return { shakeX: 0, shakeY: 0 }
  }
}

/* ================================================================
   EPIC CLASH EFFECT
   ================================================================ */

export class EpicClashEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 0.8
    this.finished = false

    this.flashAlpha = 0
    this.glitchIntensity = 0
    this.rgbSplit = 0
    this.scanlineAlpha = 0
    this.boardDarken = 0
    this.vignette = 0
    this.dissolveProgress = 0
    this.pixelateSize = 1
    this.ringProgress = 0
    this.glowIntensity = 0
    this.shockwaveProgress = 0
    this.impactShake = 0

    this.scanlineOffset = 0
    this.glitchBlocks = []
    this.sparks = []
  }

  start() {
    this.generateGlitchBlocks()
    this.generateSparks()
  }

  generateGlitchBlocks() {
    this.glitchBlocks = []
    for (let i = 0; i < 16; i++) {
      this.glitchBlocks.push({
        y: this.cy - this.pieceSize * 0.6 + Math.random() * this.pieceSize * 1.2,
        height: 2 + Math.random() * this.pieceSize * 0.3,
        xOffset: (Math.random() - 0.5) * this.pieceSize * 0.8,
        delay: Math.random() * 0.35,
        duration: 0.06 + Math.random() * 0.18
      })
    }
  }

  generateSparks() {
    this.sparks = []
    const count = 20
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
      const speed = 80 + Math.random() * 250
      this.sparks.push({
        x: this.cx,
        y: this.cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30 - Math.random() * 80,
        size: this.pieceSize * (0.04 + Math.random() * 0.08),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20,
        alpha: 1,
        gravity: 300 + Math.random() * 200,
        color: Math.random() > 0.5 ? '#ffd700' : (this.victimColor === Color.WHITE ? '#ffffff' : '#ff4444'),
        shape: ['square', 'diamond', 'triangle'][Math.floor(Math.random() * 3)]
      })
    }
  }

  update(progress) {
    const p = progress

    // Phase 1: Heavy anticipation (0–12%) — stronger darkening
    if (p < 0.12) {
      const t = p / 0.12
      this.boardDarken = Easing.easeOutCubic(t) * 0.35
      this.vignette = Easing.easeOutCubic(t) * 0.45
    } else if (p < 0.20) {
      this.boardDarken = 0.35
      this.vignette = 0.45
    } else if (p < 0.35) {
      const t = (p - 0.20) / 0.15
      this.boardDarken = 0.35 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.45 * (1 - Easing.easeOutCubic(t))
    } else {
      this.boardDarken = 0
      this.vignette = 0
    }

    // Phase 2: Massive flash + extreme glitch (12–20%)
    if (p >= 0.12 && p < 0.20) {
      const t = (p - 0.12) / 0.08
      this.flashAlpha = Math.sin(t * Math.PI) * 1.0
      this.glitchIntensity = Math.sin(t * Math.PI) * 1.5
      this.rgbSplit = Math.sin(t * Math.PI) * 1.0
      this.scanlineAlpha = Math.sin(t * Math.PI) * 0.7
      this.impactShake = 0
    } else if (p >= 0.20 && p < 0.38) {
      const t = (p - 0.20) / 0.18
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.0
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 1.5
      this.rgbSplit = Easing.easeOutCubic(1 - t) * 1.0
      this.scanlineAlpha = Easing.easeOutCubic(1 - t) * 0.7
      this.impactShake = 0
    } else {
      this.flashAlpha = 0
      this.glitchIntensity = 0
      this.rgbSplit = 0
      this.scanlineAlpha = 0
      this.impactShake = 0
    }

    // Phase 3: Dissolve with pixelation (20–65%)
    if (p >= 0.20 && p < 0.65) {
      const t = (p - 0.20) / 0.45
      this.dissolveProgress = t
      this.pixelateSize = 1 + Easing.easeInCubic(t) * 16
    } else if (p >= 0.65) {
      this.dissolveProgress = 1
      this.pixelateSize = 17
    }

    // Phase 4: Shockwave (18–50%)
    if (p >= 0.18 && p < 0.50) {
      const t = (p - 0.18) / 0.32
      this.shockwaveProgress = t
    } else if (p >= 0.50) {
      this.shockwaveProgress = 1
    }

    // Phase 5: Ring (18–75%)
    if (p >= 0.18 && p < 0.75) {
      const t = (p - 0.18) / 0.57
      this.ringProgress = t
    } else if (p >= 0.75) {
      this.ringProgress = 1
    }

    // Phase 6: Glow (14–45%)
    if (p >= 0.14 && p < 0.45) {
      const t = (p - 0.14) / 0.31
      this.glowIntensity = Easing.easeOutCubic(t)
    } else if (p >= 0.45 && p < 0.60) {
      const t = (p - 0.45) / 0.15
      this.glowIntensity = Easing.easeOutCubic(1 - t)
    } else {
      this.glowIntensity = 0
    }

    // Update sparks
    for (const spark of this.sparks) {
      if (spark.alpha <= 0) continue
      spark.vy += spark.gravity * 0.016
      spark.x += spark.vx * 0.016
      spark.y += spark.vy * 0.016
      spark.rotation += spark.rotationSpeed * 0.016
      if (p >= 0.20) {
        const fadeT = Math.min((p - 0.20) / 0.50, 1)
        spark.alpha = 1 - fadeT
      }
    }

    this.scanlineOffset += 0.016 * 70 * this.glitchIntensity
    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer

    // Board darken
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.65})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.35
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Shockwave
    if (this.shockwaveProgress > 0.01 && this.shockwaveProgress < 1) {
      const swR = this.pieceSize * (0.3 + this.shockwaveProgress * 5)
      const swW = this.pieceSize * 0.15 * (1 - this.shockwaveProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.shockwaveProgress) * 0.6
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = swW
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, swR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 4)
      const ringW = this.pieceSize * 0.14 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.95
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Sparks
    for (const spark of this.sparks) {
      if (spark.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = spark.alpha
      ctx.translate(spark.x, spark.y)
      ctx.rotate(spark.rotation)
      ctx.fillStyle = spark.color
      ctx.shadowColor = spark.color
      ctx.shadowBlur = 8
      if (spark.shape === 'square') {
        ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size)
      } else if (spark.shape === 'diamond') {
        ctx.beginPath()
        ctx.moveTo(0, -spark.size)
        ctx.lineTo(spark.size, 0)
        ctx.lineTo(0, spark.size)
        ctx.lineTo(-spark.size, 0)
        ctx.closePath()
        ctx.fill()
      } else if (spark.shape === 'triangle') {
        ctx.beginPath()
        ctx.moveTo(0, -spark.size)
        ctx.lineTo(spark.size * 0.866, spark.size * 0.5)
        ctx.lineTo(-spark.size * 0.866, spark.size * 0.5)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Glitch blocks
    if (this.glitchIntensity > 0.01) {
      for (const block of this.glitchBlocks) {
        if (this.dissolveProgress > block.delay / 0.35 + 0.5) continue
        ctx.save()
        ctx.globalAlpha = this.glitchIntensity * 0.65
        ctx.fillStyle = this.victimColor === Color.WHITE ? '#ffffff' : '#222222'
        ctx.fillRect(
          this.cx - this.pieceSize * 0.5 + block.xOffset * this.glitchIntensity,
          block.y,
          this.pieceSize * (0.9 + Math.random() * 0.5 * this.glitchIntensity),
          block.height
        )
        ctx.restore()
      }
    }

    // Scanlines
    if (this.scanlineAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.scanlineAlpha * 0.1
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      const spacing = 2
      for (let y = this.scanlineOffset % spacing; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Chromatic aberration
    if (this.rgbSplit > 0.01) {
      const splitDist = this.pieceSize * 0.06 * this.rgbSplit
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.4 * this.rgbSplit
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(-100deg)'
      ctx.drawImage(ctx.canvas, -splitDist, 0)
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(100deg)'
      ctx.drawImage(ctx.canvas, splitDist, 0)
      ctx.filter = 'none'
      ctx.restore()
    }

    // Impact shake offset
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}

/* ================================================================
   ROYAL DECAP EFFECT (King capture / checkmate)
   ================================================================ */

export class RoyalDecapEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 1.2
    this.finished = false

    this.darknessAlpha = 0
    this.desaturation = 0
    this.flashAlpha = 0
    this.slowMotion = 0
    this.crownShatter = 0
    this.ringProgress = 0
    this.impactShake = 0
    this.glitchIntensity = 0
    this.vignette = 0

    this.crownFragments = []
    this.scanlineOffset = 0
  }

  start() {
    this.generateCrownFragments()
  }

  generateCrownFragments() {
    this.crownFragments = []
    const count = 24
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
      const speed = 60 + Math.random() * 200
      this.crownFragments.push({
        x: this.cx,
        y: this.cy - this.pieceSize * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40 - Math.random() * 120,
        size: this.pieceSize * (0.04 + Math.random() * 0.1),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 25,
        alpha: 1,
        gravity: 250 + Math.random() * 150,
        color: i % 3 === 0 ? '#ffd700' : (i % 3 === 1 ? '#ffaa00' : '#ffffff'),
        shape: i % 2 === 0 ? 'diamond' : 'triangle'
      })
    }
  }

  update(progress) {
    const p = progress

    // Phase 1: Slow-motion anticipation (0–20%) — everything slows, darkens, desaturates
    if (p < 0.20) {
      const t = p / 0.20
      this.darknessAlpha = Easing.easeInCubic(t) * 0.50
      this.desaturation = Easing.easeInCubic(t) * 0.8
      this.vignette = Easing.easeInCubic(t) * 0.6
      this.slowMotion = Easing.easeOutCubic(t)
    } else if (p < 0.30) {
      this.darknessAlpha = 0.50
      this.desaturation = 0.8
      this.vignette = 0.6
      this.slowMotion = 1
    } else if (p < 0.45) {
      const t = (p - 0.30) / 0.15
      this.darknessAlpha = 0.50 * (1 - Easing.easeOutCubic(t))
      this.desaturation = 0.8 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.6 * (1 - Easing.easeOutCubic(t))
      this.slowMotion = 1 - Easing.easeOutCubic(t)
    } else {
      this.darknessAlpha = 0
      this.desaturation = 0
      this.vignette = 0
      this.slowMotion = 0
    }

    // Phase 2: The blow (22–32%) — massive flash, crown shatters
    if (p >= 0.22 && p < 0.32) {
      const t = (p - 0.22) / 0.10
      this.flashAlpha = Math.sin(t * Math.PI) * 1.2
      this.crownShatter = Easing.easeInCubic(t)
      this.impactShake = 0
      this.glitchIntensity = Math.sin(t * Math.PI) * 1.8
    } else if (p >= 0.32 && p < 0.50) {
      const t = (p - 0.32) / 0.18
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.2
      this.impactShake = 0
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 1.8
      this.crownShatter = 1
    } else {
      this.flashAlpha = 0
      this.impactShake = 0
      this.glitchIntensity = 0
      if (p >= 0.50) this.crownShatter = 1
    }

    // Phase 3: Ring (25–70%)
    if (p >= 0.25 && p < 0.70) {
      const t = (p - 0.25) / 0.45
      this.ringProgress = t
    } else if (p >= 0.70) {
      this.ringProgress = 1
    }

    // Update crown fragments
    for (const frag of this.crownFragments) {
      if (frag.alpha <= 0) continue
      frag.vy += frag.gravity * 0.016
      frag.x += frag.vx * 0.016
      frag.y += frag.vy * 0.016
      frag.rotation += frag.rotationSpeed * 0.016
      if (p >= 0.25) {
        const fadeT = Math.min((p - 0.25) / 0.60, 1)
        frag.alpha = 1 - fadeT
      }
    }

    this.scanlineOffset += 0.016 * 80 * this.glitchIntensity
    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer

    // Darkness + desaturation overlay
    if (this.darknessAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.darknessAlpha
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.6
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.75})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.4
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 5)
      const ringW = this.pieceSize * 0.16 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.95
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Crown fragments (golden shards)
    for (const frag of this.crownFragments) {
      if (frag.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = frag.alpha
      ctx.translate(frag.x, frag.y)
      ctx.rotate(frag.rotation)
      ctx.fillStyle = frag.color
      ctx.shadowColor = frag.color
      ctx.shadowBlur = 10
      if (frag.shape === 'diamond') {
        ctx.beginPath()
        ctx.moveTo(0, -frag.size)
        ctx.lineTo(frag.size, 0)
        ctx.lineTo(0, frag.size)
        ctx.lineTo(-frag.size, 0)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(0, -frag.size)
        ctx.lineTo(frag.size * 0.866, frag.size * 0.5)
        ctx.lineTo(-frag.size * 0.866, frag.size * 0.5)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Scanlines
    if (this.glitchIntensity > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.glitchIntensity * 0.12
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      const spacing = 2
      for (let y = this.scanlineOffset % spacing; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Impact shake
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}


/* ================================================================
   QUEEN SLASH EFFECT
   ================================================================ */

export class QueenSlashEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 1.5
    this.finished = false

    this.darknessAlpha = 0
    this.flashAlpha = 0
    this.slashProgress = 0
    this.slashGlow = 0
    this.impactShake = 0
    this.vignette = 0
    this.boardDarken = 0
    this.rgbSplit = 0

    // Anime-style slash lines
    this.slashLines = []
    const slashCount = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < slashCount; i++) {
      const baseAngle = -Math.PI / 4 + (Math.random() - 0.5) * 0.3
      this.slashLines.push({
        angle: baseAngle + i * 0.15,
        progress: 0,
        width: pieceSize * (0.08 + Math.random() * 0.06),
        length: 0,
        alpha: 0,
        delay: i * 0.04
      })
    }

    // Screen split offset (anime cut effect)
    this.screenSplitX = 0
    this.screenSplitY = 0

    // Debris particles
    this.debris = []
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.6
      const speed = 100 + Math.random() * 300
      this.debris.push({
        x: this.cx,
        y: this.cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40 - Math.random() * 100,
        size: pieceSize * (0.03 + Math.random() * 0.08),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 25,
        alpha: 1,
        gravity: 250 + Math.random() * 200,
        color: ['#ffd700', '#ff4444', '#ffffff', '#ff6600'][Math.floor(Math.random() * 4)],
        shape: ['square', 'diamond', 'triangle'][Math.floor(Math.random() * 3)]
      })
    }

    this.scanlineOffset = 0
  }

  start() {
    // Nothing special needed
  }

  update(progress) {
    const p = progress

    // Phase 1: Darkness falls fast (0–10%)
    if (p < 0.10) {
      const t = p / 0.10
      this.darknessAlpha = Easing.easeInCubic(t) * 0.88
      this.vignette = Easing.easeOutCubic(t) * 0.5
    } else if (p < 0.85) {
      this.darknessAlpha = 0.88
      this.vignette = 0.5
    } else if (p < 0.95) {
      const t = (p - 0.85) / 0.10
      this.darknessAlpha = 0.88 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.5 * (1 - Easing.easeOutCubic(t))
    } else {
      this.darknessAlpha = 0
      this.vignette = 0
    }

    // Phase 2: White flash (8–18%)
    if (p >= 0.08 && p < 0.18) {
      const t = (p - 0.08) / 0.10
      this.flashAlpha = Math.sin(t * Math.PI) * 1.0
    } else if (p >= 0.18 && p < 0.28) {
      const t = (p - 0.18) / 0.10
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.0
    } else {
      this.flashAlpha = 0
    }

    // Phase 3: Slash lines cut across (15–45%)
    if (p >= 0.15 && p < 0.45) {
      const t = (p - 0.15) / 0.30
      this.slashProgress = t
      this.slashGlow = Math.sin(t * Math.PI) * 1.0
      for (const line of this.slashLines) {
        const lineT = Math.max(0, Math.min(1, (t - line.delay) / (1 - line.delay)))
        line.progress = lineT
        line.alpha = Math.sin(lineT * Math.PI)
        line.length = this.canvasRenderer.width * 1.4 * lineT
      }
    } else if (p >= 0.45) {
      this.slashProgress = 1
      this.slashGlow = 0
      for (const line of this.slashLines) {
        line.alpha = 0
      }
    }

    // Phase 4: Screen shake (20–60%)
    if (p >= 0.20 && p < 0.35) {
      const t = (p - 0.20) / 0.15
      this.impactShake = 0
      this.rgbSplit = Math.sin(t * Math.PI) * 1.2
    } else if (p >= 0.35 && p < 0.60) {
      const t = (p - 0.35) / 0.25
      this.impactShake = 0
      this.rgbSplit = Easing.easeOutCubic(1 - t) * 1.2
    } else {
      this.impactShake = 0
      this.rgbSplit = 0
    }

    // Phase 5: Board darken during slash (12–50%)
    if (p >= 0.12 && p < 0.25) {
      const t = (p - 0.12) / 0.13
      this.boardDarken = Easing.easeOutCubic(t) * 0.4
    } else if (p >= 0.25 && p < 0.50) {
      const t = (p - 0.25) / 0.25
      this.boardDarken = 0.4 * (1 - Easing.easeOutCubic(t))
    } else {
      this.boardDarken = 0
    }

    // Update debris
    for (const d of this.debris) {
      if (d.alpha <= 0) continue
      d.vy += d.gravity * 0.016
      d.x += d.vx * 0.016
      d.y += d.vy * 0.016
      d.rotation += d.rotationSpeed * 0.016
      if (p >= 0.25) {
        const fadeT = Math.min((p - 0.25) / 0.50, 1)
        d.alpha = 1 - fadeT
      }
    }

    this.scanlineOffset += 0.016 * 60
    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const cx = this.cx
    const cy = this.cy

    // Full-screen darkness
    if (this.darknessAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.darknessAlpha
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.65
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.7})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Board darken overlay
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.45
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Slash lines — anime-style cutting strokes
    for (const line of this.slashLines) {
      if (line.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = line.alpha

      // Core white slash
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = line.width
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 20
      ctx.beginPath()
      const sx = cx - Math.cos(line.angle) * line.length * 0.5
      const sy = cy - Math.sin(line.angle) * line.length * 0.5
      const ex = cx + Math.cos(line.angle) * line.length * 0.5
      const ey = cy + Math.sin(line.angle) * line.length * 0.5
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      // Outer glow
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = line.width * 2.5
      ctx.shadowColor = '#ff0000'
      ctx.shadowBlur = 30
      ctx.globalAlpha = line.alpha * 0.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      ctx.restore()
    }

    // Debris
    for (const d of this.debris) {
      if (d.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = d.alpha
      ctx.translate(d.x, d.y)
      ctx.rotate(d.rotation)
      ctx.fillStyle = d.color
      ctx.shadowColor = d.color
      ctx.shadowBlur = 8
      if (d.shape === 'square') {
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size)
      } else if (d.shape === 'diamond') {
        ctx.beginPath()
        ctx.moveTo(0, -d.size)
        ctx.lineTo(d.size, 0)
        ctx.lineTo(0, d.size)
        ctx.lineTo(-d.size, 0)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(0, -d.size)
        ctx.lineTo(d.size * 0.866, d.size * 0.5)
        ctx.lineTo(-d.size * 0.866, d.size * 0.5)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Chromatic aberration during slash
    if (this.rgbSplit > 0.01) {
      const splitDist = this.pieceSize * 0.08 * this.rgbSplit
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.4 * this.rgbSplit
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(-100deg)'
      ctx.drawImage(ctx.canvas, -splitDist, 0)
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(100deg)'
      ctx.drawImage(ctx.canvas, splitDist, 0)
      ctx.filter = 'none'
      ctx.restore()
    }

    // Scanlines during effect
    if (this.slashGlow > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.slashGlow * 0.08
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      const spacing = 4
      for (let y = this.scanlineOffset % spacing; y < height; y += spacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Impact shake
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}

/* ================================================================
   ROOK PATH EFFECT
   ================================================================ */

export class RookPathEffect {
  constructor(canvasRenderer, fromX, fromY, toX, toY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.fromX = fromX
    this.fromY = fromY
    this.toX = toX
    this.toY = toY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 1.0
    this.finished = false

    this.pathProgress = 0
    this.pathGlow = 0
    this.energyBallX = fromX
    this.energyBallY = fromY
    this.energyBallScale = 1
    this.impactFlash = 0
    this.impactShake = 0
    this.shockwaveProgress = 0
    this.ringProgress = 0
    this.boardDarken = 0
    this.vignette = 0

    // Path particles
    this.pathParticles = []
    for (let i = 0; i < 16; i++) {
      this.pathParticles.push({
        offset: i / 16,
        size: pieceSize * (0.04 + Math.random() * 0.06),
        alpha: 0.6 + Math.random() * 0.4,
        speed: 0.8 + Math.random() * 0.4
      })
    }

    // Impact debris
    this.debris = []
    for (let i = 0; i < 15; i++) {
      const angle = (Math.PI * 2 * i) / 15 + (Math.random() - 0.5) * 0.5
      const speed = 60 + Math.random() * 200
      this.debris.push({
        x: toX + pieceSize / 2,
        y: toY + pieceSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30 - Math.random() * 60,
        size: pieceSize * (0.04 + Math.random() * 0.08),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20,
        alpha: 1,
        gravity: 300 + Math.random() * 200,
        color: ['#ffd700', '#ff6600', '#ffffff', '#ff4444'][Math.floor(Math.random() * 4)],
        shape: ['square', 'diamond'][Math.floor(Math.random() * 2)]
      })
    }
  }

  start() {
    // Nothing special needed
  }

  update(progress) {
    const p = progress

    // Phase 1: Path glow builds (0–15%)
    if (p < 0.15) {
      const t = p / 0.15
      this.pathGlow = Easing.easeOutCubic(t)
      this.boardDarken = Easing.easeOutCubic(t) * 0.2
      this.vignette = Easing.easeOutCubic(t) * 0.3
    } else if (p < 0.75) {
      this.pathGlow = 1
      this.boardDarken = 0.2
      this.vignette = 0.3
    } else if (p < 0.90) {
      const t = (p - 0.75) / 0.15
      this.boardDarken = 0.2 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.3 * (1 - Easing.easeOutCubic(t))
    } else {
      this.pathGlow = 0
      this.boardDarken = 0
      this.vignette = 0
    }

    // Phase 2: Energy ball travels along path (15–55%)
    if (p >= 0.15 && p < 0.55) {
      const t = (p - 0.15) / 0.40
      const eased = Easing.easeInOutCubic(t)
      this.pathProgress = eased
      this.energyBallX = this.fromX + (this.toX - this.fromX) * eased
      this.energyBallY = this.fromY + (this.toY - this.fromY) * eased
      this.energyBallScale = 1 + Math.sin(t * Math.PI) * 0.3
    } else if (p >= 0.55) {
      this.pathProgress = 1
      this.energyBallX = this.toX
      this.energyBallY = this.toY
      this.energyBallScale = 1
    }

    // Phase 3: Impact (55–70%)
    if (p >= 0.55 && p < 0.65) {
      const t = (p - 0.55) / 0.10
      this.impactFlash = Math.sin(t * Math.PI) * 1.0
      this.impactShake = 0
    } else if (p >= 0.65 && p < 0.80) {
      const t = (p - 0.65) / 0.15
      this.impactFlash = Easing.easeOutCubic(1 - t) * 1.0
      this.impactShake = 0
    } else {
      this.impactFlash = 0
      this.impactShake = 0
    }

    // Phase 4: Shockwave (58–85%)
    if (p >= 0.58 && p < 0.85) {
      const t = (p - 0.58) / 0.27
      this.shockwaveProgress = t
    } else if (p >= 0.85) {
      this.shockwaveProgress = 1
    }

    // Phase 5: Ring (60–90%)
    if (p >= 0.60 && p < 0.90) {
      const t = (p - 0.60) / 0.30
      this.ringProgress = t
    } else if (p >= 0.90) {
      this.ringProgress = 1
    }

    // Update debris
    for (const d of this.debris) {
      if (d.alpha <= 0) continue
      d.vy += d.gravity * 0.016
      d.x += d.vx * 0.016
      d.y += d.vy * 0.016
      d.rotation += d.rotationSpeed * 0.016
      if (p >= 0.60) {
        const fadeT = Math.min((p - 0.60) / 0.40, 1)
        d.alpha = 1 - fadeT
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const tcx = this.toX + this.pieceSize / 2
    const tcy = this.toY + this.pieceSize / 2

    // Board darken
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.6})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Path line glow
    if (this.pathGlow > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.pathGlow * 0.7
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = this.pieceSize * 0.15
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 20
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(this.fromX + this.pieceSize / 2, this.fromY + this.pieceSize / 2)
      ctx.lineTo(this.toX + this.pieceSize / 2, this.toY + this.pieceSize / 2)
      ctx.stroke()
      ctx.restore()

      // Path particles along the line
      for (const part of this.pathParticles) {
        if (part.offset > this.pathProgress) continue
        const px = this.fromX + (this.toX - this.fromX) * part.offset + this.pieceSize / 2
        const py = this.fromY + (this.toY - this.fromY) * part.offset + this.pieceSize / 2
        ctx.save()
        ctx.globalAlpha = part.alpha * this.pathGlow * (1 - this.pathProgress * 0.5)
        ctx.fillStyle = '#ffd700'
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(px, py, part.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // Energy ball
    if (this.pathProgress < 1 || this.impactFlash > 0.01) {
      const bx = this.energyBallX + this.pieceSize / 2
      const by = this.energyBallY + this.pieceSize / 2
      const scale = this.energyBallScale

      ctx.save()
      ctx.globalAlpha = this.pathGlow * 0.8
      ctx.fillStyle = '#ff6600'
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.arc(bx, by, this.pieceSize * 0.25 * scale, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = this.pathGlow * 0.5
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.arc(bx, by, this.pieceSize * 0.12 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Impact flash
    if (this.impactFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.impactFlash * 0.4
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Shockwave
    if (this.shockwaveProgress > 0.01 && this.shockwaveProgress < 1) {
      const swR = this.pieceSize * (0.3 + this.shockwaveProgress * 5)
      const swW = this.pieceSize * 0.18 * (1 - this.shockwaveProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.shockwaveProgress) * 0.7
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = swW
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.arc(tcx, tcy, swR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.4 + this.ringProgress * 4)
      const ringW = this.pieceSize * 0.12 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.9
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(tcx, tcy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Debris
    for (const d of this.debris) {
      if (d.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = d.alpha
      ctx.translate(d.x, d.y)
      ctx.rotate(d.rotation)
      ctx.fillStyle = d.color
      ctx.shadowColor = d.color
      ctx.shadowBlur = 8
      if (d.shape === 'square') {
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size)
      } else {
        ctx.beginPath()
        ctx.moveTo(0, -d.size)
        ctx.lineTo(d.size, 0)
        ctx.lineTo(0, d.size)
        ctx.lineTo(-d.size, 0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Impact shake
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}

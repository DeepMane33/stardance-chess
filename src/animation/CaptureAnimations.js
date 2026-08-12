import { Piece, Color } from '../core/ChessTypes.js'
import { Easing } from './Easing.js'

/**
 * CaptureAnimations â€” Cinematic capture VFX system.
 *
 * Handles five tiers of capture effects:
 * 1. EDIT_DISSOLVE   â€” General capture: glitch + pixel-dissolve + scanlines
 * 2. PAWN_SPLIT      â€” Pawn capture: splits victim in two halves, no particles
 * 3. KNIGHT_DARKNESS â€” Knight captures Queen OR delivers checkmate:
 *                        board goes dark, knight moves in true L-shape,
 *                        slowly rotates 360Â°, lands with edit effect.
 *                        Duration: 2.0â€“4.0 seconds.
 * 4. EPIC_CLASH      â€” Big piece captures big piece (Qâ†”Q, Râ†”R, etc.):
 *                        higher-tier impact, stronger shake, more debris,
 *                        chromatic aberration, longer freeze frame.
 * 5. ROYAL_DECAP     â€” Any piece captures King (checkmate final blow):
 *                        crown shatter, extreme slow-motion, screen desaturation.
 */

export const CaptureTier = {
  EDIT_DISSOLVE: 'edit_dissolve',
  PAWN_SPLIT: 'pawn_split',
  KNIGHT_DARKNESS: 'knight_darkness',
  KNIGHT_CHAIN_CAPTURE: 'knight_chain_capture',
  KNIGHT_PUNCH: 'knight_punch',
  EPIC_CLASH: 'epic_clash',
  ROYAL_DECAP: 'royal_decap',
  QUEEN_SLASH: 'queen_slash',
  QUEEN_SONIDO: 'queen_sonido',
  ROOK_PATH: 'rook_path',
  BISHOP_CUT: 'bishop_cut',
  KING_TAKE: 'king_take',
};
const BIG_PIECES = new Set([Piece.ROOK, Piece.QUEEN])

function isBigPiece(piece) {
  return BIG_PIECES.has(piece)
}

/**
 * Determine the capture animation tier based on attacker, victim, and game state.
 */
export function resolveCaptureTier(attackerPiece, victimPiece, isCheckmate = false, isKnightFork = false, attackerSq = -1, victimSq = -1) {
  // Royal decap: capturing the king (checkmate situation)
  if (victimPiece === Piece.KING || isCheckmate) {
    return CaptureTier.ROYAL_DECAP
  }

  // Knight special: knight captures queen/rook - CINEMATIC CHAIN CAPTURE
  if (attackerPiece === Piece.KNIGHT && (victimPiece === Piece.QUEEN || victimPiece === Piece.ROOK)) {
    return CaptureTier.KNIGHT_CHAIN_CAPTURE
  }

  // Knight punch: knight captures bishop or knight - PUNCH OFF BOARD
  if (attackerPiece === Piece.KNIGHT && (victimPiece === Piece.BISHOP || victimPiece === Piece.KNIGHT)) {
    return CaptureTier.KNIGHT_PUNCH
  }

  // Knight fork: knight delivers a fork (knight darkness effect)
  if (attackerPiece === Piece.KNIGHT && isKnightFork) {
    return CaptureTier.KNIGHT_DARKNESS
  }

  // Queen slash (board-split): ONLY when the queen travels edge-to-edge across
// the entire board (start on one board end, land on the opposite end). Any other
// capture is the sonido teleport — the board itself should never be split for a
// short / in-between capture.
  if (attackerPiece === Piece.QUEEN) {
    const af = attackerSq % 8
    const ar = Math.floor(attackerSq / 8)
    const vf = victimSq % 8
    const vr = Math.floor(victimSq / 8)
    const fileSwap = (af === 0 && vf === 7) || (af === 7 && vf === 0)
    const rankSwap = (ar === 0 && vr === 7) || (ar === 7 && vr === 0)
    // A legal queen move either swings a full width (7 files, rank fixed),
    // a full height (7 ranks, file fixed), or a full-board diagonal. Check the
    // squared distance matches a whole-board span with opposite edges.
    const wholeBoard =
      (Math.abs(vf - af) === 7 && fileSwap) ||
      (Math.abs(vr - ar) === 7 && rankSwap)
    if (wholeBoard) {
      return CaptureTier.QUEEN_SLASH
    }
    return CaptureTier.QUEEN_SONIDO
  }

  // Rook path: rook captures anything
  if (attackerPiece === Piece.ROOK) {
    return CaptureTier.ROOK_PATH
  }

  // Bishop cut: bishop captures anything — a precise diagonal "edit" slice
  if (attackerPiece === Piece.BISHOP) {
    return CaptureTier.BISHOP_CUT
  }

  // King take: a king captures anything — royal aura + banishing shockwave
  if (attackerPiece === Piece.KING) {
    return CaptureTier.KING_TAKE
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

    // Phase 1: Anticipation (0â€“12%) â€” board darkens, vignette builds
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

    // Phase 2: Flash + glitch (12â€“18%)
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

    // Phase 3: Dissolve (18â€“55%) â€” pixelate + alpha fade
    if (p >= 0.18 && p < 0.55) {
      const t = (p - 0.18) / 0.37
      this.dissolveProgress = t
      this.pixelateSize = 1 + Easing.easeInCubic(t) * 12
    } else if (p >= 0.55) {
      this.dissolveProgress = 1
      this.pixelateSize = 13
    }

    // Phase 4: Ring expansion (18â€“70%)
    if (p >= 0.18 && p < 0.70) {
      const t = (p - 0.18) / 0.52
      this.ringProgress = t
    } else if (p >= 0.70) {
      this.ringProgress = 1
    }

    // Phase 5: Glow (14â€“40%)
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
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = ctx.canvas.width
      tempCanvas.height = ctx.canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      tempCtx.drawImage(ctx.canvas, 0, 0)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.35 * this.rgbSplit
      // Red channel offset
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(-100deg)'
      ctx.drawImage(tempCanvas, -splitDist, 0)
      // Blue channel offset
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(100deg)'
      ctx.drawImage(tempCanvas, splitDist, 0)
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

    // Phase 1: Anticipation (0â€“10%)
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

    // Phase 2: Flash + glitch (10â€“22%)
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

    // Phase 3: SPLIT (18â€“65%) â€” halves separate perpendicular to travel
    if (p >= 0.18 && p < 0.65) {
      const t = (p - 0.18) / 0.47
      const splitDir = this.travelAngle + Math.PI / 2
      const maxOffset = this.pieceSize * 0.6
      this.splitProgress = t
      this.leftHalfOffset = -Easing.easeInOutCubic(t) * maxOffset
      this.rightHalfOffset = Easing.easeInOutCubic(t) * maxOffset
    }

    // Phase 4: Dissolve (35â€“75%)
    if (p >= 0.35 && p < 0.75) {
      const t = (p - 0.35) / 0.40
      this.dissolveAlpha = 1 - Easing.easeInCubic(t)
    } else if (p >= 0.75) {
      this.dissolveAlpha = 0
    }

    // Phase 5: Ring (18â€“70%)
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

    // Phase 1: L-shape jump (0â€“65%)
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

    // Phase 2: Impact slam (65â€“80%) â€” the "chess edit" moment
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

    // Phase 3: Ring expansion (67â€“95%)
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

    // Phase 4: Crack lines (66â€“85%)
    if (p >= 0.66 && p < 0.85) {
      const t = (p - 0.66) / 0.19
      for (const crack of this.crackLines) {
        crack.length = crack.maxLength * Easing.easeOutExpo(t)
        crack.alpha = (1 - t) * 0.9
      }
    } else if (p >= 0.85) {
      for (const crack of this.crackLines) crack.alpha = 0
    }

    // Phase 5: Dust cloud (65â€“82%)
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
   KNIGHT CHAIN CAPTURE EFFECT — Cinematic Knight vs Queen/Rook
   ================================================================ */

export class KnightChainCaptureEffect {
  constructor(canvasRenderer, fromX, fromY, toX, toY, pieceSize, knightColor, victimColor, ghostPiece, victimGhostPiece) {
    this.canvasRenderer = canvasRenderer
    this.fromX = fromX
    this.fromY = fromY
    this.toX = toX
    this.toY = toY
    this.pieceSize = pieceSize
    this.knightColor = knightColor
    this.victimColor = victimColor
    this.duration = 2.5
    this.finished = false

    // Reference to the actual ghost pieces that the renderer draws
    this.gp = ghostPiece
    this.vgp = victimGhostPiece

    // Initialize ghost piece at start position
    if (this.gp) {
      this.gp.x = fromX
      this.gp.y = fromY
      this.gp.rotation = 0
      this.gp.scaleX = 1
      this.gp.scaleY = 1
      this.gp.alpha = 1
      this.gp.height = 0
      this.gp.shadowAlpha = 0.15
      this.gp.trail = []
    }

    // Initialize victim ghost piece at destination
    if (this.vgp) {
      this.vgp.x = toX
      this.vgp.y = toY
      this.vgp.rotation = 0
      this.vgp.scaleX = 1
      this.vgp.scaleY = 1
      this.vgp.alpha = 1
      this.vgp.height = 0
      this.vgp.shadowAlpha = 0.15
    }

    // Chain properties
    this.chainProgress = 0
    this.chainAlpha = 0
    this.chainLinks = []
    this.chainTension = 0
    this.chainImpact = 0

    // Board blackout
    this.blackoutAlpha = 0
    this.blackoutPhase = 0

    // Camera zoom
    this.zoom = 1
    this.zoomTarget = 1

    // Impact effects
    this.flashAlpha = 0
    this.ringProgress = 0
    this.ringProgress2 = 0

    // Crack/shatter effects
    this.crackLines = []
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.2
      this.crackLines.push({
        angle,
        length: 0,
        maxLength: this.pieceSize * (2.5 + Math.random() * 3),
        width: 2 + Math.random() * 2,
        alpha: 0
      })
    }

    // Gold particles from chain impact
    this.goldParticles = []
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 0.6
      const speed = 100 + Math.random() * 300
      this.goldParticles.push({
        x: toX + pieceSize / 2,
        y: toY + pieceSize / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50 - Math.random() * 100,
        size: pieceSize * (0.04 + Math.random() * 0.08),
        alpha: 1,
        gravity: 400 + Math.random() * 200,
        color: ['#ffd700', '#ffaa00', '#fff8dc', '#ffeb3b'][Math.floor(Math.random() * 4)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20
      })
    }

    // Victim shatter pieces (for additional debris)
    this.victimShards = []
    for (let i = 0; i < 8; i++) {
      this.victimShards.push({
        x: toX + pieceSize / 2,
        y: toY + pieceSize / 2,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 300 - 100,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 15,
        size: pieceSize * (0.12 + Math.random() * 0.1),
        alpha: 1,
        gravity: 500
      })
    }

    // Trail for knight
    this.trail = []

    // L-shape waypoint
    this.waypoint = this.computeLWaypoint(fromX, fromY, toX, toY)
    this.legPhase = 0
    this.jumpProgress = 0

    // Audio callbacks
    this._onJump = null
    this._onChainExtend = null
    this._onImpact = null
    this._jFired = false
    this._cFired = false
    this._iFired = false
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
    this.generateChainLinks()
  }

  generateChainLinks() {
    this.chainLinks = []
    const linkCount = 14
    for (let i = 0; i < linkCount; i++) {
      this.chainLinks.push({
        x: 0, y: 0,
        rotation: 0,
        scale: 1,
        alpha: 0,
        delay: i * 0.02
      })
    }
  }

  update(progress) {
    const p = progress
    const ss = this.pieceSize
    const cx = this.toX + ss / 2
    const cy = this.toY + ss / 2
    const gp = this.gp
    const vgp = this.vgp

    // Phase 1: BLACKOUT (0-15%) - Board goes completely black
    if (p < 0.15) {
      this.blackoutPhase = 1
      this.blackoutAlpha = Easing.easeInCubic(p / 0.15)
    } else if (p < 0.85) {
      this.blackoutPhase = 2
      this.blackoutAlpha = 1
    } else {
      this.blackoutPhase = 3
      this.blackoutAlpha = 1 - Easing.easeOutCubic((p - 0.85) / 0.15)
    }

    // Phase 2: KNIGHT L-SHAPE JUMP with SPIN (10-55%)
    const jumpStart = 0.10
    const jumpEnd = 0.55
    if (p >= jumpStart && p < jumpEnd) {
      const t = (p - jumpStart) / (jumpEnd - jumpStart)
      this.jumpProgress = t

      let knightX, knightY, knightRotation, knightScale

      if (t < 0.5) {
        // First leg of L
        this.legPhase = 0
        const lt = t / 0.5
        const eased = Easing.easeOutCubic(lt)
        knightX = this.fromX + (this.waypoint.x - this.fromX) * eased
        knightY = this.fromY + (this.waypoint.y - this.fromY) * eased
      } else {
        // Second leg of L
        this.legPhase = 1
        const lt = (t - 0.5) / 0.5
        const eased = Easing.easeInOutCubic(lt)
        knightX = this.waypoint.x + (this.toX - this.waypoint.x) * eased
        knightY = this.waypoint.y + (this.toY - this.waypoint.y) * eased
      }

      // SPIN: 2 full rotations during jump
      knightRotation = t * Math.PI * 4

      // Arc height - parabolic lift
      const arcT = Math.sin(t * Math.PI)
      knightScale = 1 + arcT * 0.2

      // Sync with actual ghost piece that renderer draws
      if (gp) {
        gp.x = knightX
        gp.y = knightY
        gp.rotation = knightRotation
        gp.scaleX = knightScale
        gp.scaleY = knightScale
        gp.alpha = 1
        gp.height = arcT * ss * 0.5
        gp.shadowAlpha = 0.10 + arcT * 0.10
      }

      // Trail
      this.trail.push({ x: knightX, y: knightY, rotation: knightRotation })
      if (this.trail.length > 20) this.trail.shift()

      // Camera zoom follows knight
      this.zoom = 1 + arcT * 0.15
    } else if (p >= jumpEnd) {
      // Landing - sync final position
      if (gp) {
        gp.x = this.toX
        gp.y = this.toY
        gp.rotation = 0
        gp.scaleX = 1
        gp.scaleY = 1
        gp.height = 0
        gp.shadowAlpha = 0.15
        gp.alpha = 1
      }
    }

    // Phase 3: CHAIN EXTENDS (35-60%)
    if (p >= 0.35 && p < 0.60) {
      const t = (p - 0.35) / 0.25
      this.chainProgress = Easing.easeOutCubic(t)
      this.chainAlpha = 1
      this.chainTension = Math.sin(t * Math.PI) * 0.5 + 0.5
    } else if (p >= 0.60 && p < 0.75) {
      this.chainProgress = 1
      this.chainAlpha = 1
      this.chainTension = 1
    } else if (p >= 0.75) {
      this.chainAlpha = Math.max(0, 1 - (p - 0.75) / 0.2)
    }

    if (p >= 0.38 && !this._cFired) { this._cFired = true; this._onChainExtend?.() }

    // Phase 4: CHAIN IMPACT & WRAP (55-70%)
    if (p >= 0.55 && p < 0.70) {
      const t = (p - 0.55) / 0.15
      this.chainImpact = Easing.easeInCubic(t)
      this.flashAlpha = Math.sin(t * Math.PI) * 1.2
    } else if (p >= 0.70 && p < 0.80) {
      this.chainImpact = 1
      this.flashAlpha = Math.max(0, 1 - (p - 0.70) / 0.1) * 1.2
    } else if (p >= 0.80) {
      this.flashAlpha = 0
    }

    if (p >= 0.58 && !this._iFired) { this._iFired = true; this._onImpact?.() }

    // Phase 5: VICTIM SHATTER (65-90%) - animate victim ghost piece
    if (p >= 0.65 && p < 0.90) {
      const t = (p - 0.65) / 0.25
      // Fade out victim ghost piece
      if (vgp) {
        vgp.alpha = 1 - t
        vgp.scaleX = 1 - t * 0.5
        vgp.scaleY = 1 - t * 0.5
        vgp.rotation = t * Math.PI * 0.5
      }
      for (const shard of this.victimShards) {
        if (shard.alpha <= 0) continue
        shard.vy += shard.gravity * 0.016
        shard.x += shard.vx * 0.016
        shard.y += shard.vy * 0.016
        shard.rotation += shard.rotationSpeed * 0.016
        shard.alpha = 1 - t
      }
    } else if (p >= 0.90) {
      if (vgp) vgp.alpha = 0
      for (const shard of this.victimShards) shard.alpha = 0
    }

    // Phase 6: CRACK LINES (60-85%)
    if (p >= 0.60 && p < 0.85) {
      const t = (p - 0.60) / 0.25
      for (const crack of this.crackLines) {
        crack.length = crack.maxLength * Easing.easeOutExpo(t)
        crack.alpha = (1 - t) * 0.95
      }
    } else if (p >= 0.85) {
      for (const crack of this.crackLines) crack.alpha = 0
    }

    // Phase 7: GOLD PARTICLES BURST (58-85%)
    if (p >= 0.58 && p < 0.85) {
      const fadeT = Math.min((p - 0.58) / 0.27, 1)
      for (const part of this.goldParticles) {
        if (part.alpha <= 0) continue
        part.vy += part.gravity * 0.016
        part.x += part.vx * 0.016
        part.y += part.vy * 0.016
        part.rotation += part.rotationSpeed * 0.016
        part.alpha = 1 - fadeT
      }
    } else if (p >= 0.85) {
      for (const part of this.goldParticles) part.alpha = 0
    }

    // Rings
    if (p >= 0.62 && p < 0.95) {
      this.ringProgress = (p - 0.62) / 0.33
    } else if (p >= 0.95) {
      this.ringProgress = 1
    }
    if (p >= 0.66 && p < 0.97) {
      this.ringProgress2 = (p - 0.66) / 0.31
    } else if (p >= 0.97) {
      this.ringProgress2 = 1
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const ss = this.pieceSize
    const gp = this.gp
    const knightCx = gp ? (gp.x + ss / 2) : (this.toX + ss / 2)
    const knightCy = gp ? (gp.y + ss / 2) : (this.toY + ss / 2)
    const victimCx = this.toX + ss / 2
    const victimCy = this.toY + ss / 2

    // BOARD BLACKOUT - Everything black except knight and victim
    if (this.blackoutAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.blackoutAlpha
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Apply camera zoom around knight during jump
    if (this.zoom > 1.01 && gp) {
      ctx.save()
      ctx.translate(knightCx, knightCy)
      ctx.scale(this.zoom, this.zoom)
      ctx.translate(-knightCx, -knightCy)
    }

    // KNIGHT TRAIL with rotation ghosting
    if (this.trail.length > 1) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      for (let i = 1; i < this.trail.length; i++) {
        const t = i / this.trail.length
        const prev = this.trail[i - 1]
        const curr = this.trail[i]
        ctx.globalAlpha = t * 0.15
        ctx.strokeStyle = this.knightColor === 1 ? '#ffffff' : '#cccccc'
        ctx.lineWidth = ss * 0.1 * t
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(prev.x + ss / 2, prev.y + ss / 2)
        ctx.lineTo(curr.x + ss / 2, curr.y + ss / 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // CHAIN RENDERING - Solid 2D chain with links
    if (this.chainAlpha > 0.01) {
      this.renderChain(ctx, knightCx, knightCy, victimCx, victimCy)
    }

    // CHAIN IMPACT RING at victim
    if (this.chainImpact > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const ringR = ss * (0.3 + this.chainImpact * 2)
      const ringW = ss * 0.12 * (1 - this.chainImpact)
      ctx.globalAlpha = this.chainImpact * (1 - this.chainImpact) * 0.8
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(victimCx, victimCy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // IMPACT FLASH
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.35
      ctx.fillStyle = '#fff8dc'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // CRACK LINES
    for (const crack of this.crackLines) {
      if (crack.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = crack.alpha
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = crack.width
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(victimCx, victimCy)
      ctx.lineTo(
        victimCx + Math.cos(crack.angle) * crack.length,
        victimCy + Math.sin(crack.angle) * crack.length
      )
      ctx.stroke()
      ctx.restore()
    }

    // GOLD PARTICLES
    for (const part of this.goldParticles) {
      if (part.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = part.alpha
      ctx.translate(part.x, part.y)
      ctx.rotate(part.rotation)
      ctx.fillStyle = part.color
      ctx.shadowColor = part.color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(0, 0, part.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // VICTIM SHARDS
    for (const shard of this.victimShards) {
      if (shard.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = shard.alpha
      ctx.translate(shard.x, shard.y)
      ctx.rotate(shard.rotation)
      ctx.fillStyle = this.victimColor === 1 ? '#ffffff' : '#333333'
      ctx.strokeStyle = this.victimColor === 1 ? '#cccccc' : '#111111'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, -shard.size)
      ctx.lineTo(shard.size * 0.866, shard.size * 0.5)
      ctx.lineTo(-shard.size * 0.866, shard.size * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // RING 1 (Gold)
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = ss * (0.4 + this.ringProgress * 5)
      const ringW = ss * 0.14 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (1 - this.ringProgress) * 0.9
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 22
      ctx.beginPath()
      ctx.arc(victimCx, victimCy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // RING 2 (Orange)
    if (this.ringProgress2 > 0.01 && this.ringProgress2 < 1) {
      const ringR = ss * (0.3 + this.ringProgress2 * 6)
      const ringW = ss * 0.10 * (1 - this.ringProgress2)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (1 - this.ringProgress2) * 0.6
      ctx.strokeStyle = '#ff8800'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ff8800'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(victimCx, victimCy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Restore zoom
    if (this.zoom > 1.01) {
      ctx.restore()
    }

    return { shakeX: 0, shakeY: 0 }
  }

  renderChain(ctx, fromX, fromY, toX, toY) {
    const ss = this.pieceSize
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)
    const linkCount = this.chainLinks.length
    const maxLinksVisible = Math.floor(linkCount * this.chainProgress)

    // Chain color based on knight color
    const chainColor = this.knightColor === 1 ? '#e8d080' : '#a09060'
    const chainDark = this.knightColor === 1 ? '#b8a050' : '#706040'
    const chainLight = this.knightColor === 1 ? '#fff8c0' : '#d0c080'

    // Draw chain links
    for (let i = 0; i < maxLinksVisible; i++) {
      const t = i / (linkCount - 1)
      const linkAlpha = this.chainLinks[i].alpha = this.chainAlpha * Math.min(1, (this.chainProgress - i * 0.02) * 5)

      if (linkAlpha <= 0.01) continue

      const linkX = fromX + dx * t
      const linkY = fromY + dy * t

      // Link wobble from tension
      const wobble = Math.sin(this.chainTension * Math.PI * 8 + t * Math.PI * 4) * 3 * (1 - this.chainProgress)
      const linkRot = angle + wobble * 0.02

      ctx.save()
      ctx.globalAlpha = linkAlpha
      ctx.translate(linkX, linkY)
      ctx.rotate(linkRot)

      // Link dimensions
      const linkW = ss * 0.22
      const linkH = ss * 0.12
      const innerW = linkW * 0.5
      const innerH = linkH * 0.5

      // Draw solid chain link (oval ring)
      ctx.beginPath()
      // Outer ellipse
      ctx.ellipse(0, 0, linkW, linkH, 0, 0, Math.PI * 2)
      // Inner ellipse (cutout)
      ctx.ellipse(0, 0, innerW, innerH, 0, 0, Math.PI * 2, true)
      ctx.fillStyle = chainColor
      ctx.fill('evenodd')

      // Highlight on top
      ctx.beginPath()
      ctx.ellipse(0, -linkH * 0.2, linkW * 0.7, linkH * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = chainLight
      ctx.globalAlpha = linkAlpha * 0.6
      ctx.fill()

      // Shadow on bottom
      ctx.beginPath()
      ctx.ellipse(0, linkH * 0.2, linkW * 0.7, linkH * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = chainDark
      ctx.globalAlpha = linkAlpha * 0.5
      ctx.fill()

      ctx.restore()
    }

    // Chain connection points (where it attaches to knight and victim)
    if (this.chainProgress > 0.3) {
      // At knight (attached to knight's "hand")
      const knightAttachAlpha = this.chainAlpha * Math.min(1, (this.chainProgress - 0.3) * 3)
      if (knightAttachAlpha > 0.01) {
        ctx.save()
        ctx.globalAlpha = knightAttachAlpha
        ctx.beginPath()
        ctx.arc(fromX + ss * 0.5, fromY + ss * 0.3, ss * 0.08, 0, Math.PI * 2)
        ctx.fillStyle = chainColor
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 10
        ctx.fill()
        ctx.restore()
      }

      // At victim (wrapped around)
      const victimAttachAlpha = this.chainAlpha * Math.min(1, (this.chainProgress - 0.5) * 4)
      if (victimAttachAlpha > 0.01) {
        ctx.save()
        ctx.globalAlpha = victimAttachAlpha
        // Chain wrapping around victim
        for (let w = 0; w < 3; w++) {
          const wrapAngle = angle + Math.PI / 2 + (w - 1) * 0.4
          const wrapX = toX + ss / 2 + Math.cos(wrapAngle) * ss * 0.4
          const wrapY = toY + ss / 2 + Math.sin(wrapAngle) * ss * 0.4
          ctx.beginPath()
          ctx.arc(wrapX, wrapY, ss * 0.06, 0, Math.PI * 2)
          ctx.fillStyle = chainColor
          ctx.shadowColor = '#ffd700'
          ctx.shadowBlur = 8
          ctx.fill()
        }
        ctx.restore()
      }
    }
  }
}

/* ================================================================
   KNIGHT PUNCH EFFECT — Knight punches bishop/knight off the board
   ================================================================ */

export class KnightPunchEffect {
  constructor(canvasRenderer, fromX, fromY, toX, toY, pieceSize, knightColor, victimColor, ghostPiece, victimGhostPiece) {
    this.canvasRenderer = canvasRenderer
    this.fromX = fromX
    this.fromY = fromY
    this.toX = toX
    this.toY = toY
    this.pieceSize = pieceSize
    this.knightColor = knightColor
    this.victimColor = victimColor
    this.duration = 1.0
    this.finished = false

    // Reference to the actual ghost pieces
    this.gp = ghostPiece
    this.vgp = victimGhostPiece

    // Initialize ghost pieces
    if (this.gp) {
      this.gp.x = fromX
      this.gp.y = fromY
      this.gp.rotation = 0
      this.gp.scaleX = 1
      this.gp.scaleY = 1
      this.gp.alpha = 1
      this.gp.height = 0
      this.gp.shadowAlpha = 0.15
      this.gp.trail = []
    }

    if (this.vgp) {
      this.vgp.x = toX
      this.vgp.y = toY
      this.vgp.rotation = 0
      this.vgp.scaleX = 1
      this.vgp.scaleY = 1
      this.vgp.alpha = 1
      this.vgp.height = 0
      this.vgp.shadowAlpha = 0.15
    }

    // Punch direction (from knight TO victim)
    const dx = toX - fromX
    const dy = toY - fromY
    this.punchAngle = Math.atan2(dy, dx)
    this.punchDist = Math.sqrt(dx * dx + dy * dy)

    // Fist properties
    this.fistX = fromX + pieceSize / 2
    this.fistY = fromY + pieceSize / 2
    this.fistScale = 0
    this.fistAlpha = 0
    this.fistRotation = this.punchAngle

    // Victim launch properties
    this.victimLaunched = false
    this.victimVX = 0
    this.victimVY = 0
    this.victimRotation = 0
    this.victimSpinSpeed = 0

    // Impact effects
    this.impactFlash = 0
    this.shockwaveProgress = 0
    this.impactParticles = []

    // Screen shake
    this.shakeIntensity = 0

    // Colors
    this.fistColor = knightColor === 1 ? '#ffffff' : '#222222'
    this.fistOutline = knightColor === 1 ? '#cccccc' : '#000000'
    this.fistGlow = knightColor === 1 ? '#ffeeaa' : '#ff6600'

    // Generate impact particles
    this.generateImpactParticles()
  }

  generateImpactParticles() {
    this.impactParticles = []
    const cx = this.toX + this.pieceSize / 2
    const cy = this.toY + this.pieceSize / 2
    for (let i = 0; i < 16; i++) {
      const angle = this.punchAngle + (Math.random() - 0.5) * Math.PI / 2
      const speed = 200 + Math.random() * 400
      this.impactParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50 - Math.random() * 100,
        size: this.pieceSize * (0.03 + Math.random() * 0.06),
        alpha: 1,
        gravity: 300 + Math.random() * 200,
        color: ['#ffaa00', '#ff8800', '#ffcc00', '#ffffff'][Math.floor(Math.random() * 4)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 20
      })
    }
  }

  start() {}

  update(progress) {
    const p = progress
    const ss = this.pieceSize
    const gp = this.gp
    const vgp = this.vgp
    const cx = this.toX + ss / 2
    const cy = this.toY + ss / 2

    // Phase 1: WIND UP (0-15%) - Knight leans back, fist appears
    if (p < 0.15) {
      const t = p / 0.15
      const eased = Easing.easeOutCubic(t)

      // Knight leans back (opposite to punch direction)
      const leanDist = ss * 0.15 * eased
      if (gp) {
        gp.x = this.fromX - Math.cos(this.punchAngle) * leanDist
        gp.y = this.fromY - Math.sin(this.punchAngle) * leanDist
        gp.rotation = -this.punchAngle * 0.1 * eased
        gp.scaleX = 1 + eased * 0.05
        gp.scaleY = 1 - eased * 0.03
      }

      // Fist grows at knight position
      this.fistScale = eased * 0.8
      this.fistAlpha = eased
      this.fistX = this.fromX + ss / 2 - Math.cos(this.punchAngle) * leanDist
      this.fistY = this.fromY + ss / 2 - Math.sin(this.punchAngle) * leanDist
    }

    // Phase 2: PUNCH FORWARD (15-45%) - Fist shoots toward victim
    if (p >= 0.15 && p < 0.45) {
      const t = (p - 0.15) / 0.30
      const eased = Easing.easeInCubic(t) // Fast acceleration

      // Fist travels to victim
      const travelDist = this.punchDist + ss * 0.5
      this.fistX = this.fromX + ss / 2 + Math.cos(this.punchAngle) * travelDist * eased
      this.fistY = this.fromY + ss / 2 + Math.sin(this.punchAngle) * travelDist * eased
      this.fistScale = 1.0 + Math.sin(t * Math.PI) * 0.2 // Slight squash on impact
      this.fistAlpha = 1

      // Knight follows through
      if (gp) {
        const followDist = ss * 0.3 * eased
        gp.x = this.fromX + Math.cos(this.punchAngle) * followDist
        gp.y = this.fromY + Math.sin(this.punchAngle) * followDist
        gp.rotation = this.punchAngle * 0.2 * eased
      }
    }

    // Phase 3: IMPACT (45-55%) - Fist hits victim, victim launches
    if (p >= 0.45 && p < 0.55) {
      const t = (p - 0.45) / 0.10
      const eased = Easing.easeOutCubic(t)

      // Fist at impact position
      this.fistX = cx + Math.cos(this.punchAngle) * ss * 0.3
      this.fistY = cy + Math.sin(this.punchAngle) * ss * 0.3
      this.fistScale = 1.2 * (1 - t) + 1.0 * t
      this.fistAlpha = 1 - t * 0.5

      // Impact flash
      this.impactFlash = Math.sin(t * Math.PI) * 1.5

      // Launch victim at exact impact moment (t=0.5)
      if (!this.victimLaunched && t >= 0.5) {
        this.victimLaunched = true
        const launchSpeed = 800 + Math.random() * 400
        this.victimVX = Math.cos(this.punchAngle) * launchSpeed
        this.victimVY = Math.sin(this.punchAngle) * launchSpeed - 200
        this.victimSpinSpeed = (Math.random() - 0.5) * 30

        // Shockwave
        this.shockwaveProgress = 0
      }

      // Screen shake
      this.shakeIntensity = Math.sin(t * Math.PI) * 15

      // Knight recoil
      if (gp) {
        gp.x = this.fromX + Math.cos(this.punchAngle) * ss * 0.3 * (1 - t)
        gp.y = this.fromY + Math.sin(this.punchAngle) * ss * 0.3 * (1 - t)
      }
    }

    // Phase 4: VICTIM FLIES OFF BOARD (55-100%)
    if (p >= 0.55) {
      // Fist fades
      this.fistAlpha = Math.max(0, 1 - (p - 0.55) / 0.15)
      this.fistScale = 1

      // Shockwave expands
      if (p < 0.75) {
        this.shockwaveProgress = (p - 0.55) / 0.20
      } else {
        this.shockwaveProgress = 1
      }

      // Screen shake decays
      this.shakeIntensity = Math.max(0, 15 * (1 - (p - 0.55) / 0.20))

      // Update victim position - flying off board with gravity
      if (vgp && this.victimLaunched) {
        const dt = 1/60
        this.victimVY += 800 * dt // Gravity
        vgp.x += this.victimVX * dt
        vgp.y += this.victimVY * dt
        this.victimRotation += this.victimSpinSpeed * dt
        vgp.rotation = this.victimRotation
        vgp.alpha = Math.max(0, 1 - (p - 0.55) / 0.45) // Fade out as it flies away
        vgp.scaleX = vgp.alpha
        vgp.scaleY = vgp.alpha
      }

      // Knight settles back
      if (gp) {
        gp.x = this.fromX + (this.toX - this.fromX) * Math.min(1, (p - 0.55) / 0.25)
        gp.y = this.fromY + (this.toY - this.fromY) * Math.min(1, (p - 0.55) / 0.25)
        gp.rotation = 0
        gp.scaleX = 1
        gp.scaleY = 1
      }
    }

    // Update impact particles
    for (const part of this.impactParticles) {
      if (part.alpha <= 0) continue
      part.vy += part.gravity * 0.016
      part.x += part.vx * 0.016
      part.y += part.vy * 0.016
      part.rotation += part.rotationSpeed * 0.016
      if (p >= 0.55) {
        const fadeT = Math.min((p - 0.55) / 0.30, 1)
        part.alpha = 1 - fadeT
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const ss = this.pieceSize
    const cx = this.toX + ss / 2
    const cy = this.toY + ss / 2

    // Impact flash
    if (this.impactFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.impactFlash * 0.3
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Shockwave ring at impact point
    if (this.shockwaveProgress > 0.01 && this.shockwaveProgress < 1) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const ringR = ss * (0.5 + this.shockwaveProgress * 4)
      const ringW = ss * 0.15 * (1 - this.shockwaveProgress)
      ctx.globalAlpha = (1 - this.shockwaveProgress) * 0.8
      ctx.strokeStyle = this.fistGlow
      ctx.lineWidth = ringW
      ctx.shadowColor = this.fistGlow
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // FIST - draw the punching fist
    if (this.fistAlpha > 0.01) {
      this.renderFist(ctx)
    }

    // Impact particles
    for (const part of this.impactParticles) {
      if (part.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = part.alpha
      ctx.translate(part.x, part.y)
      ctx.rotate(part.rotation)
      ctx.fillStyle = part.color
      ctx.shadowColor = part.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(0, 0, part.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    return { 
      shakeX: (Math.random() - 0.5) * this.shakeIntensity,
      shakeY: (Math.random() - 0.5) * this.shakeIntensity
    }
  }

  renderFist(ctx) {
    const ss = this.pieceSize
    const scale = this.fistScale
    const fistSize = ss * 0.5 * scale

    ctx.save()
    ctx.translate(this.fistX, this.fistY)
    ctx.rotate(this.fistRotation)
    ctx.globalAlpha = this.fistAlpha

    // Fist shadow (behind)
    ctx.save()
    ctx.translate(fistSize * 0.15, fistSize * 0.2)
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000000'
    this.drawFistShape(ctx, fistSize)
    ctx.restore()

    // Main fist
    ctx.fillStyle = this.fistColor
    ctx.strokeStyle = this.fistOutline
    ctx.lineWidth = 2 * scale
    this.drawFistShape(ctx, fistSize)
    ctx.fill()
    ctx.stroke()

    // Highlight on knuckles
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.fillStyle = this.fistGlow
    this.drawFistHighlight(ctx, fistSize)
    ctx.restore()

    // Wrist/cuff
    ctx.fillStyle = this.knightColor === 1 ? '#e0e0e0' : '#444444'
    ctx.beginPath()
    ctx.rect(-fistSize * 0.5, fistSize * 0.4, fistSize, fistSize * 0.3)
    ctx.fill()
    ctx.stroke()

    ctx.restore()
  }

  drawFistShape(ctx, size) {
    // Draw a cartoon-style clenched fist
    const w = size
    const h = size * 1.2

    ctx.beginPath()
    // Bottom of fist (curved)
    ctx.moveTo(-w * 0.4, h * 0.6)
    ctx.quadraticCurveTo(-w * 0.4, h * 0.8, 0, h * 0.8)
    ctx.quadraticCurveTo(w * 0.4, h * 0.8, w * 0.4, h * 0.6)

    // Knuckles (4 bumps)
    const knuckleW = w * 0.18
    const knuckleH = h * 0.15
    for (let i = 0; i < 4; i++) {
      const x = -w * 0.3 + i * knuckleW * 1.1
      ctx.quadraticCurveTo(x, h * 0.6, x + knuckleW * 0.5, h * 0.45)
      ctx.quadraticCurveTo(x + knuckleW, h * 0.6, x + knuckleW, h * 0.45)
    }
    ctx.lineTo(w * 0.4, h * 0.6)

    // Thumb side
    ctx.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.35, 0)
    ctx.quadraticCurveTo(w * 0.2, -h * 0.1, 0, -h * 0.1)
    ctx.quadraticCurveTo(-w * 0.2, -h * 0.1, -w * 0.35, 0)
    ctx.quadraticCurveTo(-w * 0.5, h * 0.3, -w * 0.4, h * 0.6)

    ctx.closePath()
  }

  drawFistHighlight(ctx, size) {
    // Highlight on top knuckles
    const w = size
    const h = size * 1.2

    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const x = -w * 0.3 + i * w * 0.18 * 1.1
      ctx.ellipse(x + w * 0.09, h * 0.45, w * 0.07, h * 0.05, 0, 0, Math.PI * 2)
    }
    ctx.fill()
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

    // Phase 1: Heavy anticipation (0â€“12%) â€” stronger darkening
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

    // Phase 2: Massive flash + extreme glitch (12â€“20%)
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

    // Phase 3: Dissolve with pixelation (20â€“65%)
    if (p >= 0.20 && p < 0.65) {
      const t = (p - 0.20) / 0.45
      this.dissolveProgress = t
      this.pixelateSize = 1 + Easing.easeInCubic(t) * 16
    } else if (p >= 0.65) {
      this.dissolveProgress = 1
      this.pixelateSize = 17
    }

    // Phase 4: Shockwave (18â€“50%)
    if (p >= 0.18 && p < 0.50) {
      const t = (p - 0.18) / 0.32
      this.shockwaveProgress = t
    } else if (p >= 0.50) {
      this.shockwaveProgress = 1
    }

    // Phase 5: Ring (18â€“75%)
    if (p >= 0.18 && p < 0.75) {
      const t = (p - 0.18) / 0.57
      this.ringProgress = t
    } else if (p >= 0.75) {
      this.ringProgress = 1
    }

    // Phase 6: Glow (14â€“45%)
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
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = ctx.canvas.width
      tempCanvas.height = ctx.canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      tempCtx.drawImage(ctx.canvas, 0, 0)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.4 * this.rgbSplit
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(-100deg)'
      ctx.drawImage(tempCanvas, -splitDist, 0)
      ctx.filter = 'sepia(1) saturate(10) hue-rotate(100deg)'
      ctx.drawImage(tempCanvas, splitDist, 0)
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

    // Phase 1: Slow-motion anticipation (0â€“20%) â€” everything slows, darkens, desaturates
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

    // Phase 2: The blow (22â€“32%) â€” massive flash, crown shatters
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

    // Phase 3: Ring (25â€“70%)
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
/* ================================================================
/* ================================================================
   QUEEN SONIDO — Bleach-style Glitch Teleport + Sword Execution
   ================================================================ */

/**
 * QueenSonidoEffect â€” Bleach-inspired Glitch Teleport + Sword Execution
 *
 * Inspired by the Bleach Arrancar "Sonido" technique: a high-speed movement
 * that distorts space, leaving a static-glich afterimage, with the figure
 * rematerializing at the destination through spatial distortion.
 *
 * Applied when a Queen captures from a non-edge square (internal board position).
 *
 * Timeline (~1.2s):
 *   0â€“15%   Queen glitches out at source (static flicker + horizontal displacement)
 *  15â€“45%   Dark spatial-distortion streak races from source to target
 *  45â€“60%   Queen glitch-rematerializes at target (sonido static burst)
 *  60â€“75%   Procedural sword slash animation at target
 *  75â€“90%   Victim cracks along cut, falls apart
 *  90â€“100%  Cleanup, board returns to normal
 */
/* ================================================================
   QUEEN SONIDO â€” Bleach-style Teleport + Sword Execution
   ================================================================ */

/**
 * QueenSonidoEffect â€” True Sonido teleport + visible sword execution.
 *
 * Phase timing (~1.5s total):
 *   0.00â€“0.10   Queen flickers + audio distortion at source
 *   0.10â€“0.20   Queen glitch-vanishes completely from source
 *   0.20â€“0.55   SILENCE â€” empty source, nothing on screen (teleport gap)
/* ================================================================
   QUEEN SONIDO — Fast Bleach-style Teleport + Heavy Sword Execution
   ================================================================ */

/**
 * QueenSonidoEffect â€” FAST Sonido Teleport + Heavy Sword Execution
 *
 * True teleport: Queen vanishes from source, reappears at target in a
 * Bleach-style Sonido static burst, then delivers a heavy visible sword
 * slash that tears the victim in two.
 *
 * Timeline (0.9s total â€” fast):
 *   0â€“12%     Queen flicker-vanishes at source (glitch blocks, fast)
 *  12â€“30%     SILENT GAP â€” nothing visible (true teleport)
 *  30â€“45%     SONIDO APPEAR â€” static burst ring + distortion + flash at target
 *  45â€“65%     SWORD SLASH â€” thick visible blade sweeps across victim
 *  65â€“85%     BRUTAL SPLIT â€” victim tears in half, halves fly apart, gold crack glow
 *  85â€“100%    Fade out + cleanup
 */
export class QueenSonidoEffect {

  /* â”€â”€ Sonido static noise pattern (shared, pre-generated) â”€â”€ */
  static _noiseCanvas = null
  static _noiseData = null
  static _initNoise() {
    if (QueenSonidoEffect._noiseCanvas) return
    const c = document.createElement('canvas')
    c.width = 128; c.height = 128
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(128, 128)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() > 0.5 ? 255 : 0
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255
    }
    ctx.putImageData(img, 0, 0)
    QueenSonidoEffect._noiseCanvas = c
    QueenSonidoEffect._noiseData = img.data
  }

  constructor(canvasRenderer, centerX, centerY, fromX, fromY, pieceSize, victimColor, attackAngle) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.fromX = fromX
    this.fromY = fromY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.attackAngle = attackAngle || -Math.PI / 4
    this.duration = 0.9
    this.finished = false

    // â”€â”€ Vanish â”€â”€
    this.vanishAlpha = 0
    this.vanishBlocks = []
    for (let i = 0; i < 10; i++) {
      this.vanishBlocks.push({
        yOff: (Math.random() - 0.5) * this.pieceSize * 1.3,
        h: 2 + Math.random() * this.pieceSize * 0.2,
        xSh: (Math.random() - 0.5) * this.pieceSize * 0.6,
        delay: Math.random() * 0.05
      })
    }

    // â”€â”€ Sonido Appear â”€â”€
    this.appearAlpha = 0
    this.ringRadius = 0
    this.ringAlpha = 0
    this.staticAlpha = 0
    this.appearFlash = 0
    this.distortBlocks = []
    for (let i = 0; i < 12; i++) {
      this.distortBlocks.push({
        yOff: (Math.random() - 0.5) * this.pieceSize * 1.3,
        h: 2 + Math.random() * this.pieceSize * 0.2,
        xSh: (Math.random() - 0.5) * this.pieceSize * 0.6,
        delay: Math.random() * 0.04
      })
    }

    // â”€â”€ Sword â”€â”€
    this.swordT = 0
    this.swordAlpha = 0

    // â”€â”€ Victim split â”€â”€
    this.splitGap = 0      // halves separate
    this.crackGlow = 0
    this.crackAlpha = 0
    this.victimAlpha = 1

    // â”€â”€ Debris â”€â”€
    this.chips = []
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.5
      this.chips.push({
        angle: a, dist: 0,
        maxDist: this.pieceSize * (0.35 + Math.random() * 0.9),
        size: this.pieceSize * (0.025 + Math.random() * 0.05),
        rot: Math.random() * Math.PI * 2, rSpeed: (Math.random() - 0.5) * 24,
        alpha: 0,
        color: Math.random() > 0.5 ? '#c8a860' : '#a08040'
      })
    }

    // Audio flags
    this._onVanish = null
    this._onAppear = null
    this._onSlash = null
    this._vFired = false
    this._aFired = false
    this._sFired = false

    // === SOLIDITY UPGRADES ===
    // When true, the Renderer draws the REAL victim piece torn in two along the
    // slash line; this effect only draws the garble rings, sword, crack glow and
    // debris (no fake silhouette).
    this._useRealPiece = true
    // Sonic-dash trail that shoots from source toward the target during vanish
    this.dashTrail = {
      x: fromX + pieceSize / 2, y: fromY + pieceSize / 2,
      tx: centerX, ty: centerY, p: 0, alpha: 0
    }
    // Appear scale pulse
    this.appearScale = 0

    QueenSonidoEffect._initNoise()
  }

  start() {}

  update(p) {
    const eio = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2
    const eo3 = t => 1 - Math.pow(1-t, 3)
    const ei3 = t => t*t*t

    // â”€â”€ VANISH (0â€“12%) â”€â”€
    if (p < 0.06) {
      this.vanishAlpha = (p / 0.06)
    } else if (p < 0.12) {
      this.vanishAlpha = 1 - eo3((p - 0.06) / 0.06)
    } else {
      this.vanishAlpha = 0
    }
    if (p >= 0.04 && !this._vFired) { this._vFired = true; this._onVanish?.() }

    // â”€â”€ GAP (12â€“30%) â€” sonic dash streaks from source to target â”€â”€
    if (p < 0.28) {
      this.dashTrail.p = p / 0.28
      this.dashTrail.alpha = Math.sin(Math.min(p / 0.28, 1) * Math.PI) * 1.0
    } else {
      this.dashTrail.p = 1
      this.dashTrail.alpha = Math.max(0, this.dashTrail.alpha - 0.06)
    }
    this.dashTrail.x = this.fromX + this.pieceSize / 2 + (this.cx - this.fromX - this.pieceSize / 2) * this.dashTrail.p
    this.dashTrail.y = this.fromY + this.pieceSize / 2 + (this.cy - this.fromY - this.pieceSize / 2) * this.dashTrail.p

    // â”€â”€ SONIDO APPEAR (30â€“45%) â”€â”€
    if (p >= 0.30 && p < 0.38) {
      const t = (p - 0.30) / 0.08
      this.appearAlpha = eo3(t)
      this.ringRadius = this.pieceSize * 1.0 * t
      this.ringAlpha = 1
      this.staticAlpha = Math.sin(t * Math.PI) * 0.5
      this.appearFlash = Math.sin(t * Math.PI) * 0.4
    } else if (p >= 0.38 && p < 0.45) {
      const t = (p - 0.38) / 0.07
      this.appearAlpha = 1
      this.ringRadius = this.pieceSize * (1.0 + t * 0.6)
      this.ringAlpha = 1 - t
      this.staticAlpha = (1 - t) * 0.5
      this.appearFlash = (1 - t) * 0.4
    } else if (p >= 0.45) {
      this.ringAlpha = 0
      this.staticAlpha = 0
      this.appearFlash = 0
      this.appearAlpha = 1
    }
    if (p >= 0.32 && !this._aFired) { this._aFired = true; this._onAppear?.() }

    this.appearScale = p < 0.30 ? 0.85 : (p < 0.46 ? 1 + Math.sin(((p - 0.30) / 0.16) * Math.PI) * 0.12 : 1)

    // â”€â”€ SWORD SLASH (45â€“65%) â”€â”€
    if (p >= 0.45 && p < 0.65) {
      this.swordT = (p - 0.45) / 0.20
      this.swordAlpha = 1
    } else if (p >= 0.65) {
      this.swordAlpha = Math.max(0, 1 - (p - 0.65) * 8)
      this.swordT = 1
    }
    if (p >= 0.58 && !this._sFired) { this._sFired = true; this._onSlash?.() }

    // â”€â”€ BRUTAL SPLIT (65â€“85%) â”€â”€
    if (p >= 0.65 && p < 0.78) {
      const t = (p - 0.65) / 0.13
      this.splitGap = this.pieceSize * 0.55 * eo3(t)
      this.crackGlow = Math.sin(t * Math.PI) * 0.7
      this.crackAlpha = 1
      this.victimAlpha = 1 - t * 0.35
    } else if (p >= 0.78 && p < 0.90) {
      const t = (p - 0.78) / 0.12
      this.splitGap = this.pieceSize * 0.55 + t * this.pieceSize * 0.25
      this.crackGlow = 0.7 * (1 - t)
      this.crackAlpha = 1 - t
      this.victimAlpha = 0.65 - t * 0.65
    } else if (p >= 0.90) {
      this.victimAlpha = 0
      this.crackGlow = 0
    }

    // Debris
    for (const chip of this.chips) {
      if (p >= 0.65 && p < 0.92) {
        const t = Math.min(1, (p - 0.65) / 0.27)
        chip.dist = chip.maxDist * eio(t)
        chip.alpha = Math.sin(t * Math.PI) * 0.7
        chip.rot += chip.rSpeed * 0.016
      } else if (p >= 0.92) {
        chip.alpha = Math.max(0, chip.alpha - 0.07)
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    if (this.vanishAlpha <= 0.01 && this.appearAlpha <= 0.01 &&
        this.swordAlpha <= 0.01 && this.victimAlpha <= 0.01) {
      return { shakeX: 0, shakeY: 0 }
    }

    const { width, height } = this.canvasRenderer
    const cx = this.cx, cy = this.cy
    const ss = this.pieceSize

    ctx.save()

    // â”€â”€ 1. VANISH GLITCH (at source) — Hollow sonido shatter â”€â”€
    if (this.vanishAlpha > 0.01) {
      const vx = this.fromX + ss / 2
      const vy = this.fromY + ss / 2

      // Shatter / static burst ring around the queen
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const burstR = ss * (1.4 - this.vanishAlpha * 0.9)
      const bg = ctx.createRadialGradient(vx, vy, 0, vx, vy, burstR)
      bg.addColorStop(0, `rgba(150,220,255,${0.55 * this.vanishAlpha})`)
      bg.addColorStop(0.5, `rgba(120,180,255,${0.25 * this.vanishAlpha})`)
      bg.addColorStop(1, 'rgba(120,180,255,0)')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.arc(vx, vy, burstR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Glitch displacement slices (cyan/white) over her body
      for (const b of this.vanishBlocks) {
        if (this.vanishAlpha < b.delay && this.vanishAlpha < 0.9) continue
        ctx.save()
        ctx.globalAlpha = this.vanishAlpha * 0.6
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(170,225,255,0.55)' : 'rgba(255,255,255,0.5)'
        ctx.fillRect(
          this.fromX - ss * 0.35 + b.xSh * this.vanishAlpha,
          this.fromY + b.yOff, ss * 0.8 + 6, b.h
        )
        ctx.restore()
      }

      // Cyan energy outline hugging her silhouette as she breaks apart
      ctx.save()
      ctx.globalAlpha = this.vanishAlpha * 0.5
      ctx.strokeStyle = '#9fdcff'
      ctx.lineWidth = 1.6
      ctx.shadowColor = '#59c4ff'
      ctx.shadowBlur = 10
      ctx.strokeRect(this.fromX + 1 - this.vanishAlpha * 2, this.fromY + 1 - this.vanishAlpha * 2, ss - 2, ss - 2)
      ctx.restore()
    }

    // â”€â”€ 1.5 SONIC DASH STREAK (source â†’ target) â”€â”€
    if (this.dashTrail.alpha > 0.02) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const grd = ctx.createRadialGradient(this.dashTrail.x, this.dashTrail.y, 0, this.dashTrail.x, this.dashTrail.y, ss * 0.5)
      grd.addColorStop(0, `rgba(215,205,255,${0.9 * this.dashTrail.alpha})`)
      grd.addColorStop(1, 'rgba(215,205,255,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(this.dashTrail.x, this.dashTrail.y, ss * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = this.dashTrail.alpha * 0.75
      ctx.strokeStyle = '#d8ccff'
      ctx.lineWidth = ss * 0.10
      ctx.lineCap = 'round'
      ctx.shadowColor = '#b4a4ff'
      ctx.shadowBlur = 20
      const ang = Math.atan2(this.cy - this.fromY, this.cx - this.fromX)
      const len = ss * (0.5 + this.dashTrail.p * 0.9)
      ctx.beginPath()
      ctx.moveTo(this.dashTrail.x - Math.cos(ang) * len, this.dashTrail.y - Math.sin(ang) * len)
      ctx.lineTo(this.dashTrail.x + Math.cos(ang) * len * 0.2, this.dashTrail.y + Math.sin(ang) * len * 0.2)
      ctx.stroke()
      ctx.restore()
    }

    // â”€â”€ 2. SONIDO APPEAR BURST (at target) â”€â”€
    if (this.ringAlpha > 0.01 && this.ringRadius > 0.5) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      // Filling static pop
      const pop = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.ringRadius * 1.3)
      pop.addColorStop(0, `rgba(230,250,255,${0.5 * this.appearAlpha})`)
      pop.addColorStop(0.5, `rgba(140,220,255,${0.3 * this.appearAlpha})`)
      pop.addColorStop(1, 'rgba(140,220,255,0)')
      ctx.fillStyle = pop
      ctx.beginPath()
      ctx.arc(cx, cy, this.ringRadius * 1.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = this.ringAlpha * 0.7
      ctx.strokeStyle = '#9fdcff'
      ctx.lineWidth = 4
      ctx.shadowColor = '#59c4ff'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(cx, cy, this.ringRadius, 0, Math.PI * 2)
      ctx.stroke()
      // Inner brighter ring
      ctx.globalAlpha = this.ringAlpha * 0.5
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(cx, cy, this.ringRadius * 0.8, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // â”€â”€ 3. SONIDO STATIC DISTORTION â”€â”€
    if (this.appearAlpha > 0.01) {
      // Distortion blocks
      for (const b of this.distortBlocks) {
        if (this.appearAlpha < b.delay && this.appearAlpha < 0.9) continue
        ctx.save()
        ctx.globalAlpha = this.appearAlpha * 0.5
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(170,225,255,0.45)' : 'rgba(255,255,255,0.4)'
        ctx.fillRect(
          cx - ss * 0.4 + b.xSh * this.appearAlpha,
          cy + b.yOff, ss * 0.8 + 4, b.h
        )
        ctx.restore()
      }

      // Static noise overlay at target
      if (this.staticAlpha > 0.01 && QueenSonidoEffect._noiseCanvas) {
        ctx.save()
        ctx.globalAlpha = this.staticAlpha * 0.28
        const nw = 128, nh = 128
        const sx = cx - ss * 0.6 * this.appearScale
        const sy = cy - ss * 0.6 * this.appearScale
        ctx.drawImage(QueenSonidoEffect._noiseCanvas, sx, sy, ss * 1.2 * this.appearScale, ss * 1.2 * this.appearScale)
        ctx.restore()
      }
    }

    // â”€â”€ 4. APPEAR FLASH â”€â”€
    if (this.appearFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.appearFlash
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ss * 0.9 * this.appearScale)
      grad.addColorStop(0, 'rgba(240,252,255,0.95)')
      grad.addColorStop(1, 'rgba(180,235,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, ss * 0.9 * this.appearScale, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // â”€â”€ 5. SWORD â”€â”€
    if (this.swordAlpha > 0.01) {
      this._renderSword(ctx, cx, cy)
    }

    // â”€â”€ 6. BRUTAL VICTIM SPLIT â”€â”€
    if (this.victimAlpha > 0.01 && this.splitGap > 0.5) {
      this._renderSplitVictim(ctx, cx, cy)
    }

    // â”€â”€ 7. DEBRIS â”€â”€
    for (const chip of this.chips) {
      if (chip.alpha <= 0.015) continue
      ctx.save()
      ctx.globalAlpha = chip.alpha
      ctx.translate(cx + Math.cos(chip.angle) * chip.dist, cy + Math.sin(chip.angle) * chip.dist)
      ctx.rotate(chip.rot)
      ctx.fillStyle = chip.color
      ctx.fillRect(-chip.size * 0.5, -chip.size * 0.6, chip.size, chip.size * 0.8)
      ctx.fillRect(-chip.size * 0.3, -chip.size * 0.4, chip.size * 0.4, chip.size * 0.5)
      ctx.restore()
    }

    ctx.restore()
    return { shakeX: 0, shakeY: 0 }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SWORD â€” heavy, visible, tapered blade with guard and handle
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  _renderSword(ctx, cx, cy) {
    const t = this.swordT
    const ss = this.pieceSize

    // Fast swing: from high-diagonal through center
    const totalArc = Math.PI * 0.6
    const baseA = this.attackAngle + Math.PI * 0.3
    const angle = baseA - totalArc * t

    const pivotX = cx - Math.cos(this.attackAngle) * ss * 0.05
    const pivotY = cy - Math.sin(this.attackAngle) * ss * 0.05

    const bladeLen = ss * 0.82
    const tipX = pivotX + Math.cos(angle) * bladeLen
    const tipY = pivotY + Math.sin(angle) * bladeLen

    const pX = -Math.sin(angle)
    const pY = Math.cos(angle)

    ctx.save()
    ctx.globalAlpha = this.swordAlpha

    // â”€â”€ Blade body (tapered polygon) â”€â”€
    const bwBase = 3.4  // width at base
    const bwMid  = 1.6  // width at midpoint
    const bwTip  = 0.3  // width at tip
    const midX = pivotX + Math.cos(angle) * bladeLen * 0.45
    const midY = pivotY + Math.sin(angle) * bladeLen * 0.45

    ctx.beginPath()
    ctx.moveTo(pivotX + pX * bwBase, pivotY + pY * bwBase)
    ctx.lineTo(pivotX - pX * bwBase, pivotY - pY * bwBase)
    ctx.lineTo(midX - pX * bwMid, midY - pY * bwMid)
    ctx.lineTo(tipX, tipY)
    ctx.lineTo(midX + pX * bwMid, midY + pY * bwMid)
    ctx.closePath()

    const bladeGrad = ctx.createLinearGradient(pivotX, pivotY, tipX, tipY)
    bladeGrad.addColorStop(0, '#d8d8e8')
    bladeGrad.addColorStop(0.4, '#f0f0fa')
    bladeGrad.addColorStop(0.8, '#f8f8ff')
    bladeGrad.addColorStop(1, '#ffffff')
    ctx.fillStyle = bladeGrad
    ctx.fill()

    ctx.strokeStyle = '#707088'
    ctx.lineWidth = 0.8
    ctx.stroke()

    // â”€â”€ Blade glow during swing â”€â”€
    if (t > 0.05 && t < 0.9) {
      ctx.save()
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = '#cfe0ff'
      ctx.lineWidth = ss * 0.15
      ctx.lineCap = 'round'
      ctx.shadowColor = '#a8c8ff'
      ctx.shadowBlur = 24
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      // Bright inner core
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = ss * 0.04
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()
      ctx.restore()
    }

    // â”€â”€ Center ridge â”€â”€
    ctx.globalAlpha = this.swordAlpha * 0.8
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(pivotX, pivotY)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()

    // â”€â”€ Handle â”€â”€
    const hLen = ss * 0.24
    const hx = pivotX - Math.cos(angle) * hLen
    const hy = pivotY - Math.sin(angle) * hLen

    ctx.strokeStyle = '#3a2a18'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pivotX, pivotY)
    ctx.lineTo(hx, hy)
    ctx.stroke()

    ctx.strokeStyle = '#6a5030'
    ctx.lineWidth = 4.0
    ctx.globalAlpha = this.swordAlpha * 0.85
    ctx.beginPath()
    ctx.moveTo(pivotX, pivotY)
    ctx.lineTo(hx, hy)
    ctx.stroke()

    // â”€â”€ Guard â”€â”€
    ctx.globalAlpha = this.swordAlpha * 0.9
    const gLen = ss * 0.14
    ctx.strokeStyle = '#a0a0a8'
    ctx.lineWidth = 3.0
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pivotX + pX * gLen, pivotY + pY * gLen)
    ctx.lineTo(pivotX - pX * gLen, pivotY - pY * gLen)
    ctx.stroke()

    // Pommel
    const pmX = hx - Math.cos(angle) * ss * 0.04
    const pmY = hy - Math.sin(angle) * ss * 0.04
    ctx.fillStyle = '#808088'
    ctx.beginPath()
    ctx.arc(pmX, pmY, 2, 0, Math.PI * 2)
    ctx.fill()

    // â”€â”€ Swing arc trail â”€â”€
    if (t > 0.08 && t < 0.92) {
      ctx.globalAlpha = this.swordAlpha * 0.18
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      const trailR = bladeLen * 0.5
      const sA = baseA - totalArc * Math.max(0, t - 0.1)
      const eA = angle
      for (let i = 0; i <= 8; i++) {
        const aa = sA + (eA - sA) * i / 8
        const ax = pivotX + Math.cos(aa) * trailR
        const ay = pivotY + Math.sin(aa) * trailR
        i === 0 ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay)
      }
      ctx.stroke()
    }

    ctx.restore()
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     BRUTAL SPLIT â€” victim tears in two heavy halves
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  _renderSplitVictim(ctx, cx, cy) {
    const ss = this.pieceSize
    const halfGap = this.splitGap
    const perpX = -Math.sin(this.attackAngle)
    const perpY = Math.cos(this.attackAngle)

    // â”€â”€ CRACK GLOW LINE â”€â”€
    if (this.crackGlow > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.crackGlow * 0.8
      const cutLen = ss * 0.55
      // Outer glow
      ctx.strokeStyle = '#ffb830'
      ctx.lineWidth = ss * 0.08
      ctx.shadowColor = '#ff9900'
      ctx.shadowBlur = 16
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(this.attackAngle) * cutLen, cy - Math.sin(this.attackAngle) * cutLen)
      ctx.lineTo(cx + Math.cos(this.attackAngle) * cutLen, cy + Math.sin(this.attackAngle) * cutLen)
      ctx.stroke()
      // Bright core
      ctx.strokeStyle = '#ffe0a0'
      ctx.lineWidth = 1.8
      ctx.shadowColor = '#ffd080'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(this.attackAngle) * cutLen, cy - Math.sin(this.attackAngle) * cutLen)
      ctx.lineTo(cx + Math.cos(this.attackAngle) * cutLen, cy + Math.sin(this.attackAngle) * cutLen)
      ctx.stroke()
      ctx.restore()
    }

    // â”€â”€ BRANCH CRACKS â”€â”€
    if (this.crackAlpha > 0.3 && this.splitGap > ss * 0.08) {
      ctx.save()
      ctx.globalAlpha = this.crackAlpha * 0.55
      ctx.strokeStyle = '#ffcc44'
      ctx.lineWidth = 1.3
      ctx.shadowColor = '#ffcc44'
      ctx.shadowBlur = 3
      const seed = Math.floor(cx + cy * 1000) % 500
      const rnd = (i) => { const x = Math.sin(seed + i * 12.9898) * 43758.5453; return x - Math.floor(x) }
      for (let i = 0; i < 4; i++) {
        const a = this.attackAngle + (rnd(i) - 0.5) * 0.8
        const len = ss * (0.18 + rnd(i + 10) * 0.25)
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
        ctx.stroke()
      }
      ctx.restore()
    }

    // â”€â”€ TOP HALF â”€â”€
    if (halfGap > 0.5) {
      if (!this._useRealPiece) {
        ctx.save()
        ctx.globalAlpha = this.victimAlpha
        ctx.translate(-perpX * halfGap, -perpY * halfGap)
        ctx.beginPath()
        // Clip everything on one side of the cut line
        ctx.moveTo(cx - Math.cos(this.attackAngle) * ss, cy - Math.sin(this.attackAngle) * ss)
        ctx.lineTo(cx + Math.cos(this.attackAngle) * ss, cy + Math.sin(this.attackAngle) * ss)
        ctx.lineTo(cx + Math.cos(this.attackAngle) * ss + perpX * ss * 2, cy + Math.sin(this.attackAngle) * ss + perpY * ss * 2)
        ctx.lineTo(cx - Math.cos(this.attackAngle) * ss + perpX * ss * 2, cy - Math.sin(this.attackAngle) * ss + perpY * ss * 2)
        ctx.closePath()
        ctx.clip()
        this._drawPieceSilhouette(ctx, cx, cy)
        ctx.restore()

        // â”€â”€ BOTTOM HALF â”€â”€
        ctx.save()
        ctx.globalAlpha = this.victimAlpha
        ctx.translate(perpX * halfGap, perpY * halfGap)
        ctx.beginPath()
        ctx.moveTo(cx - Math.cos(this.attackAngle) * ss, cy - Math.sin(this.attackAngle) * ss)
        ctx.lineTo(cx + Math.cos(this.attackAngle) * ss, cy + Math.sin(this.attackAngle) * ss)
        ctx.lineTo(cx + Math.cos(this.attackAngle) * ss - perpX * ss * 2, cy + Math.sin(this.attackAngle) * ss - perpY * ss * 2)
        ctx.lineTo(cx - Math.cos(this.attackAngle) * ss - perpX * ss * 2, cy - Math.sin(this.attackAngle) * ss - perpY * ss * 2)
        ctx.closePath()
        ctx.clip()
        this._drawPieceSilhouette(ctx, cx, cy)
        ctx.restore()
      }
    }
  }

  /* â”€â”€ Generic piece silhouette (used inside clip) â”€â”€ */
  _drawPieceSilhouette(ctx, cx, cy) {
    const r = this.pieceSize * 0.38
    const yOff = -this.pieceSize * 0.05
    const isW = this.victimColor === 1

    // Base circle
    ctx.beginPath()
    ctx.arc(cx, cy + yOff, r, 0, Math.PI * 2)
    ctx.fillStyle = isW ? '#e0d8c8' : '#3a3530'
    ctx.fill()
    ctx.strokeStyle = isW ? '#888070' : '#1a1510'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Crown points
    const pts = [
      [cx - r * 0.8, cy + yOff - r * 0.3],
      [cx - r * 0.5, cy + yOff - r - r * 0.3],
      [cx - r * 0.15, cy + yOff - r * 0.3],
      [cx + r * 0.15, cy + yOff - r - r * 0.4],
      [cx + r * 0.5, cy + yOff - r * 0.3],
      [cx + r * 0.8, cy + yOff - r - r * 0.2],
    ]
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.fillStyle = isW ? '#d0c8b8' : '#2a2520'
    ctx.fill()
    ctx.strokeStyle = isW ? '#888070' : '#1a1510'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Collar
    ctx.beginPath()
    ctx.arc(cx, cy + yOff - r * 0.35, r * 0.3, 0, Math.PI)
    ctx.fillStyle = isW ? '#f0e8d8' : '#4a4540'
    ctx.fill()
  }
}


/* ================================================================
   QUEEN REALITY SLASH — Cinematic Board-Splitting Capture
   ================================================================ */

/**
 * QueenRealitySlashEffect â€” Cinematic Board-Splitting Capture Animation
 *
 * Queen captures a piece by slashing reality itself. The board splits along 
 * the attack direction, revealing a dark void. The two board halves are offset,
 * metallic edge glow appears along the cut, shards fly outward, then the board
 * heals seamlessly within ~700ms.
 * 
 * Timeline (~700ms):
 *   0ms     Anticipation: darken, micro zoom-push, hit-stop freeze
 *  45ms     Board splits along slash line, edges glow, void appears
 * 120ms     Impact: flash, directional shake, chromatic aberration
 * 140ms     Shards/debris burst from cut line
 * 190ms     Board halves at max offset, void visible
 * 350ms     Board halves start sliding back, glow fades
 * 500ms     Board fully healed, lighting normalizes
 * 700ms     Complete â€” board visually identical to before
 *
 * No particles, no magic sparkles. Raw, heavy, cinematic.
 */
export class QueenRealitySlashEffect {
  constructor(canvasRenderer, centerX, centerY, pieceSize, victimColor, attackAngle = -Math.PI / 4) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.attackAngle = attackAngle
    this.duration = 1.35
    this.finished = false

    // State
    this.darknessAlpha = 0
    this.vignette = 0
    this.flashAlpha = 0

    // Board split: how much each half slides apart (in pixels, perpendicular to slash)
    this.splitOffset = 0
    this.maxSplitOffset = pieceSize * 0.42
    
    // Cut-line glow
    this.cutGlow = 0
    this.cutWidth = 0

    // Shards along the cut line
    this.shards = []
    this._initShards()

    // Hit-stop
    this.hitStop = 0
    
    // Chromatic aberration
    this.chromaticPulse = 0

    // Camera shake
    this.shakeIntensity = 0

    // Board color grading (subtle warmth shift during impact)
    this.warmthBoost = 0

    // Healing progress (0 = split, 1 = healed)
    this.healProgress = 1

    // Timing constants (normalized 0-1)
    this.T_ANTICIPATE = 0.04     // 0-6%: anticipation
    this.T_HIT_STOP_START = 0.04 // 6%: hit-stop begins
    this.T_HIT_STOP_END = 0.10   // 14%: hit-stop ends
    this.T_SPLIT_START = 0.07    // 10%: board starts splitting
    this.T_SPLIT_PEAK = 0.22     // 24%: board at max split
    this.T_IMPACT = 0.16         // 16%: impact flash + shake
    this.T_SHARDS_START = 0.16   // 16%: shard burst
    this.T_HEAL_START = 0.55     // 45%: board starts healing
    this.T_HEAL_END = 0.85       // 78%: board fully healed
    this.T_RECOVER_START = 0.60  // 55%: darkness fades
    this.T_RECOVER_END = 0.82    // 75%: all effects normalized
  }

  _initShards() {
    const count = 22
    for (let i = 0; i < count; i++) {
      const t = i / count // position along cut line
      const baseAngle = this.attackAngle
      const perpAngle = baseAngle + Math.PI / 2
      
      this.shards.push({
        t,
        x: this.cx,
        y: this.cy,
        offset: 0,
        angle: perpAngle + (Math.random() - 0.5) * 0.4,
        speed: 60 + Math.random() * 280,
        size: this.pieceSize * (0.025 + Math.random() * 0.06),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 18,
        alpha: 0,
        color: Math.random() > 0.5 ? '#e8c97a' : 
               (Math.random() > 0.5 ? '#c4a35a' : '#f5dda0'),
        shape: Math.random() > 0.5 ? 'splinter' : 'chip'
      })
    }
  }

  start() {
    // Nothing special
  }

  update(progress) {
    const p = progress
    const s = this.state
    const ae = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 // easeInOutQuad

    // â•â•â• ANTICIPATION (0-6%) â•â•â•
    if (p < this.T_ANTICIPATE) {
      const t = p / this.T_ANTICIPATE
      this.darknessAlpha = t * t * 0.22
      this.vignette = t * t * 0.30
    } else if (p < this.T_SPLIT_START) {
      this.darknessAlpha = 0.22
      this.vignette = 0.30
    }

    // â•â•â• HIT-STOP (6-14%) â•â•â•
    if (p >= this.T_HIT_STOP_START && p < this.T_HIT_STOP_END) {
      this.hitStop = 1
    } else {
      this.hitStop = 0
    }

    // â•â•â• BOARD SPLIT (10-24%) â•â•â•
    if (p >= this.T_SPLIT_START && p < this.T_SPLIT_PEAK) {
      const t = (p - this.T_SPLIT_START) / (this.T_SPLIT_PEAK - this.T_SPLIT_START)
      // Weighty ease: slow start, fast acceleration, hard stop
      const e = t < 0.3 ? (t / 0.3) * (t / 0.3) * 0.3 : 0.3 + (t - 0.3) * 0.7
      this.splitOffset = this.maxSplitOffset * e
      this.cutGlow = ae(Math.min(t * 2, 1))
      this.cutWidth = 2 + t * 6
    } else if (p >= this.T_SPLIT_PEAK && p < this.T_HEAL_START) {
      this.splitOffset = this.maxSplitOffset
      this.cutGlow = ae(Math.max(0, 1 - (p - this.T_SPLIT_PEAK) * 3))
    } else if (p >= this.T_HEAL_START && p < this.T_HEAL_END) {
      const t = (p - this.T_HEAL_START) / (this.T_HEAL_END - this.T_HEAL_START)
      // Gentle heal: slow start, smooth landing
      this.splitOffset = this.maxSplitOffset * (1 - t * t * (3 - 2 * t))
      this.cutGlow = 0.08 * (1 - t)
      this.cutWidth = Math.max(0, 2 * (1 - t))
    } else if (p >= this.T_HEAL_END) {
      this.splitOffset = 0
      this.cutGlow = 0
      this.cutWidth = 0
    }

    // â•â•â• IMPACT FLASH (16-26%) â•â•â•
    if (p >= 0.12 && p < 0.18) {
      const t = (p - 0.16) / 0.04
      this.flashAlpha = Math.sin(t * Math.PI) * 0.65
    } else if (p >= 0.18 && p < 0.30) {
      const t = (p - 0.20) / 0.08
      this.flashAlpha = (1 - t * t) * 0.65
    } else {
      this.flashAlpha = 0
    }

    // â•â•â• CHROMATIC PULSE (14-32%) â•â•â•
    if (p >= 0.10 && p < 0.15) {
      const t = (p - 0.14) / 0.04
      this.chromaticPulse = Math.sin(t * Math.PI) * 0.55
    } else if (p >= 0.15 && p < 0.38) {
      const t = (p - 0.18) / 0.14
      this.chromaticPulse = (1 - t) * 0.55
    } else {
      this.chromaticPulse = 0
    }


    // â•â•â• WARMTH BOOST (14-35%) â•â•â•
    if (p >= 0.10 && p < 0.22) {
      const t = (p - 0.14) / 0.10
      this.warmthBoost = Math.sin(t * Math.PI) * 0.08
    } else if (p >= 0.22 && p < 0.42) {
      const t = (p - 0.24) / 0.11
      this.warmthBoost = (1 - t) * 0.08
    } else {
      this.warmthBoost = 0
    }

    // â•â•â• SHARDS (16-55%) â•â•â•
    for (const shard of this.shards) {
      if (p >= this.T_SHARDS_START && p < 0.60) {
        const t = (p - this.T_SHARDS_START) / (0.50 - this.T_SHARDS_START)
        // Position along cut line
        const cutLen = this.canvasRenderer.width * 1.5
        shard.x = this.cx + Math.cos(this.attackAngle) * (shard.t - 0.5) * cutLen
        shard.y = this.cy + Math.sin(this.attackAngle) * (shard.t - 0.5) * cutLen
        // Fly outward perpendicular to cut
        shard.offset = shard.speed * t * (1 + Math.sin(shard.t * Math.PI) * 0.3)
        shard.alpha = Math.sin(t * Math.PI) * 0.85
        shard.rotation += shard.rotSpeed * 0.016
        // Gravity
        shard.speed -= 120 * 0.016
      } else if (p >= 0.60 && shard.alpha > 0) {
        shard.alpha = Math.max(0, shard.alpha - 0.05)
        shard.offset += shard.speed * 0.016
        shard.rotation += shard.rotSpeed * 0.016
      }
    }

    // â•â•â• RECOVERY (55-75%) â•â•â•
    if (p >= this.T_RECOVER_START && p < this.T_RECOVER_END) {
      const t = (p - this.T_RECOVER_START) / (this.T_RECOVER_END - this.T_RECOVER_START)
      this.darknessAlpha = 0.22 * (1 - t * t)
      this.vignette = 0.30 * (1 - t * t)
    } else if (p >= this.T_RECOVER_END) {
      this.darknessAlpha = 0
      this.vignette = 0
    }

    if (p >= 1) this.finished = true
  }
  render(ctx) {
    // Camera shake disabled — cut remains visible
    ctx.save()

    if (this.splitOffset <= 0.01 && this.flashAlpha <= 0.01 && 
        this.darknessAlpha <= 0.01 && !this._hasActiveShards()) {
      ctx.restore()
      return { shakeX: 0, shakeY: 0 }
    }

    const { width, height } = this.canvasRenderer

    // Perpendicular direction to slash
    const perpAngle = this.attackAngle + Math.PI / 2
    const perpX = Math.cos(perpAngle)
    const perpY = Math.sin(perpAngle)

    // === SNAPSHOT CURRENT CANVAS ===
    const snapshot = document.createElement('canvas')
    snapshot.width = ctx.canvas.width
    snapshot.height = ctx.canvas.height
    const snapCtx = snapshot.getContext('2d')
    snapCtx.drawImage(ctx.canvas, 0, 0)

    // 1. Full-screen darkness overlay
    if (this.darknessAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.darknessAlpha
      ctx.fillStyle = '#050508'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // 2. Vignette
    if (this.vignette > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.vignette
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, width * 0.15,
        width / 2, height / 2, Math.max(width, height) * 0.65
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.7)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // 3. BOARD SPLIT â€” THE CORE EFFECT
    if (this.splitOffset > 0.1) {
      const halfOff = this.splitOffset
      const voidWidth = Math.max(2, this.cutWidth)

      const lineLen = Math.sqrt(width * width + height * height) * 1.2
      const sx = this.cx - Math.cos(this.attackAngle) * lineLen
      const sy = this.cy - Math.sin(this.attackAngle) * lineLen
      const ex = this.cx + Math.cos(this.attackAngle) * lineLen
      const ey = this.cy + Math.sin(this.attackAngle) * lineLen

      // Dark void along slash line
      ctx.save()
      ctx.globalAlpha = 0.92
      ctx.lineWidth = voidWidth + this.splitOffset * 0.5
      ctx.strokeStyle = '#010103'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.restore()

      // Metallic edge glow
      if (this.cutGlow > 0.01) {
        ctx.save()
        ctx.globalAlpha = this.cutGlow * 0.7
        ctx.strokeStyle = '#ffe8c0'
        ctx.lineWidth = voidWidth * 0.6
        ctx.shadowColor = '#ffd080'
        ctx.shadowBlur = voidWidth * 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        
        // Inner brighter core
        ctx.globalAlpha = this.cutGlow * 0.9
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.restore()
      }

      // Draw two board halves from snapshot with clipping
      // Helper to create a clip region covering one side of the cut line
      const clipSide = (ctx, sign) => {
        const farSide = this.cx + perpX * sign * Math.max(width, height) * 2
        const farSideY = this.cy + perpY * sign * Math.max(width, height) * 2
        const alongAngle = this.attackAngle
        const extendLen = Math.max(width, height) * 4
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.lineTo(
          farSide + Math.cos(alongAngle) * extendLen,
          farSideY + Math.sin(alongAngle) * extendLen
        )
        ctx.lineTo(
          farSide + Math.cos(alongAngle) * -extendLen,
          farSideY + Math.sin(alongAngle) * -extendLen
        )
        ctx.closePath()
      }

      // NEGATIVE SIDE
      ctx.save()
      clipSide(ctx, -1)
      ctx.clip()
      ctx.translate(-perpX * halfOff, -perpY * halfOff)
      ctx.drawImage(snapshot, 0, 0)
      ctx.restore()

      // POSITIVE SIDE
      ctx.save()
      clipSide(ctx, 1)
      ctx.clip()
      ctx.translate(perpX * halfOff, perpY * halfOff)
      ctx.drawImage(snapshot, 0, 0)
      ctx.restore()
    }

    // 4. IMPACT FLASH
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha * 0.35
      ctx.fillStyle = '#ffeedd'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // 5. Chromatic aberration
    if (this.chromaticPulse > 0.01) {
      const splitDist = this.pieceSize * 0.06 * this.chromaticPulse
      const caSnapshot = document.createElement('canvas')
      caSnapshot.width = ctx.canvas.width
      caSnapshot.height = ctx.canvas.height
      const caCtx = caSnapshot.getContext('2d')
      caCtx.drawImage(ctx.canvas, 0, 0)
      
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.38 * this.chromaticPulse
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(-100deg)'
      ctx.drawImage(caSnapshot, -splitDist, 0)
      ctx.filter = 'sepia(1) saturate(8) hue-rotate(100deg)'
      ctx.drawImage(caSnapshot, splitDist, 0)
      ctx.filter = 'none'
      ctx.restore()
    }

    // 6. SHARD DEBRIS
    for (const shard of this.shards) {
      if (shard.alpha <= 0.015) continue
      const sx2 = shard.x + Math.cos(shard.angle) * shard.offset
      const sy2 = shard.y + Math.sin(shard.angle) * shard.offset
      
      ctx.save()
      ctx.globalAlpha = shard.alpha
      ctx.translate(sx2, sy2)
      ctx.rotate(shard.rotation)
      ctx.fillStyle = shard.color
      ctx.shadowColor = 'rgba(255,220,160,0.4)'
      ctx.shadowBlur = 3
      
      if (shard.shape === 'splinter') {
        const hw = shard.size * 0.3
        const hh = shard.size * 1.2
        ctx.beginPath()
        ctx.moveTo(0, -hh)
        ctx.lineTo(hw, hh * 0.3)
        ctx.lineTo(hw * 0.4, hh)
        ctx.lineTo(-hw * 0.4, hh)
        ctx.lineTo(-hw, hh * 0.3)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.fillRect(-shard.size * 0.6, -shard.size * 0.7, shard.size * 0.8, shard.size * 0.9)
        ctx.fillRect(-shard.size * 0.3, -shard.size * 1.0, shard.size * 0.5, shard.size * 0.5)
      }
      
      ctx.restore()
    }

    // 7. Warmth color overlay
    if (this.warmthBoost > 0.001) {
      ctx.save()
      ctx.globalAlpha = this.warmthBoost
      ctx.fillStyle = '#ffcc66'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    ctx.restore()
    return { shakeX: 0, shakeY: 0 }
  }


  _hasActiveShards() {
    for (const s of this.shards) {
      if (s.alpha > 0.015) return true
    }
    return false
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
    this.duration = 1.15
    this.finished = false

    // Chidori state
    this.pathProgress = 0      // 0-1 lightning channel forming
    this.rushProgress = 0      // 0-1 chidori drill rushing to target
    this.drillX = fromX
    this.drillY = fromY
    this.drillScale = 1
    this.impactFlash = 0
    this.impactShake = 0
    this.victBurn = 0          // 0-1 victim electrocuted to dust (drives renderer fade)
    this.boardDarken = 0
    this.vignette = 0
    this.time = 0

    // Jagged lightning channel from source to target
    this.lightning = this._generateLightning()

    // Ambient crackle arcs hugging the path (seeded)
    this.arcs = []
    for (let i = 0; i < 7; i++) {
      this.arcs.push({
        seed: Math.random() * 10
      })
    }

    // Charging sparks
    this.sparks = []

    // Electric cage arcs around the victim during electrocution
    this.cage = []
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.7
      this.cage.push({
        angle: a,
        dist: pieceSize * (0.45 + Math.random() * 0.2),
        len: pieceSize * (0.3 + Math.random() * 0.5)
      })
    }

    // Ash / dust ejected when the victim is burned to dust
    const cxs = toX + pieceSize / 2
    const cys = toY + pieceSize / 2
    this.dust = []
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.9
      const spd = 20 + Math.random() * 95
      const life = 0.45 + Math.random() * 0.65
      this.dust.push({
        x: cxs + (Math.random() - 0.5) * pieceSize * 0.5,
        y: cys + (Math.random() - 0.5) * pieceSize * 0.5,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 18,
        size: pieceSize * (0.018 + Math.random() * 0.05),
        life,
        maxLife: life,
        alpha: 0,
        grav: 55 + Math.random() * 85,
        color: Math.random() > 0.4 ? '#cfd6e6' : '#6a7488'
      })
    }
  }

  _generateLightning() {
    const pts = []
    const sx = this.fromX + this.pieceSize / 2
    const sy = this.fromY + this.pieceSize / 2
    const ex = this.toX + this.pieceSize / 2
    const ey = this.toY + this.pieceSize / 2
    const dx = ex - sx
    const dy = ey - sy
    const len = Math.hypot(dx, dy) || 1
    const px = -dy / len
    const py = dx / len
    const segs = 12
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      let x = sx + dx * t
      let y = sy + dy * t
      if (i > 0 && i < segs) {
        const off = (Math.random() - 0.5) * this.pieceSize * 0.55
        x += px * off
        y += py * off
      }
      pts.push({ x, y })
    }
    return pts
  }

  start() {}

  update(progress) {
    const p = progress
    this.time += 0.016

    // Board darken + vignette: rise during charge, fall after strike
    if (p < 0.13) {
      const t = p / 0.13
      this.boardDarken = Easing.easeOutCubic(t) * 0.22
      this.vignette = Easing.easeOutCubic(t) * 0.32
    } else if (p < 0.72) {
      this.boardDarken = 0.22
      this.vignette = 0.32
    } else if (p < 0.90) {
      const t = (p - 0.72) / 0.18
      this.boardDarken = 0.22 * (1 - Easing.easeOutCubic(t))
      this.vignette = 0.32 * (1 - Easing.easeOutCubic(t))
    } else {
      this.boardDarken = 0
      this.vignette = 0
    }

    // Phase A: charge-up, lightning channel forms (0-16%)
    if (p < 0.16) {
      this.pathProgress = Easing.easeOutCubic(p / 0.16)
    } else {
      this.pathProgress = 1
    }

    // Phase B: Chidori rush along the jagged line (16-60%)
    if (p >= 0.16 && p < 0.60) {
      const t = (p - 0.16) / 0.44
      this.rushProgress = t
      const seg = t * (this.lightning.length - 1)
      const i0 = Math.min(this.lightning.length - 1, Math.floor(seg))
      const i1 = Math.min(this.lightning.length - 1, i0 + 1)
      const f = seg - Math.floor(seg)
      const a = this.lightning[i0]
      const b = this.lightning[i1]
      this.drillX = a.x + (b.x - a.x) * f - this.pieceSize / 2
      this.drillY = a.y + (b.y - a.y) * f - this.pieceSize / 2
      this.drillScale = 1 + Math.sin(t * Math.PI) * 0.4
      if (Math.random() < 0.4) {
        const ang = Math.random() * Math.PI * 2
        const spd = 60 + Math.random() * 170
        const life = 0.10 + Math.random() * 0.22
        this.sparks.push({
          x: this.drillX + this.pieceSize / 2,
          y: this.drillY + this.pieceSize / 2,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: this.pieceSize * (0.02 + Math.random() * 0.035),
          life,
          maxLife: life,
          alpha: 1,
          color: Math.random() > 0.5 ? '#b8e4ff' : '#ffffff'
        })
      }
    } else if (p >= 0.60) {
      this.rushProgress = 1
      this.drillX = this.toX
      this.drillY = this.toY
      this.drillScale = 1
    }

    // Phase C: strike flash (58-72%)
    if (p >= 0.58 && p < 0.66) {
      const t = (p - 0.58) / 0.08
      this.impactFlash = Math.sin(t * Math.PI)
      this.impactShake = 6 * this.pieceSize * 0.04 * Math.sin(t * Math.PI)
    } else if (p >= 0.66 && p < 0.82) {
      const t = (p - 0.66) / 0.16
      this.impactFlash = Easing.easeOutCubic(1 - t)
      this.impactShake = 0
    } else {
      this.impactFlash = 0
      this.impactShake = 0
    }

    // Phase D: electrocute to dust (58-92%)
    if (p >= 0.58 && p < 0.92) {
      this.victBurn = Easing.easeInCubic((p - 0.58) / 0.34)
    } else if (p >= 0.92) {
      this.victBurn = 1
    }

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= 0.016
      if (s.life <= 0) { this.sparks.splice(i, 1); continue }
      s.alpha = Math.max(0, s.life / s.maxLife)
      s.x += s.vx * 0.016
      s.y += s.vy * 0.016
      s.vy += 45 * 0.016
    }

    // Ignite + update dust during burn
    if (p >= 0.6) {
      const ignite = (p - 0.6) / 0.3
      const count = Math.min(this.dust.length, Math.floor(ignite * this.dust.length))
      for (let i = 0; i < count; i++) {
        if (this.dust[i].alpha <= 0.001) this.dust[i].alpha = 0.9
      }
      for (const d of this.dust) {
        if (d.alpha <= 0.001) continue
        d.life -= 0.016
        if (d.life <= 0) { d.alpha = 0; continue }
        d.vx *= 0.98
        d.vy += d.grav * 0.016
        d.x += d.vx * 0.016
        d.y += d.vy * 0.016
        d.alpha *= 0.99
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const ss = this.pieceSize
    const cxs = this.toX + ss / 2
    const cys = this.toY + ss / 2

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
      const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(0,0,0,${this.vignette * 0.62})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // === 1. Lightning channel (jagged blue-white, forms with pathProgress) ===
    if (this.pathProgress > 0.01) {
      const n = this.lightning.length
      const drawLen = this.pathProgress * n
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      // soft glow pass
      for (let i = 1; i < n; i++) {
        if (i > drawLen) break
        const a = this.lightning[i - 1], b = this.lightning[i]
        ctx.globalAlpha = 0.7 * (1 - (i / n) * 0.35)
        ctx.strokeStyle = '#6fc9ff'
        ctx.lineWidth = ss * 0.11
        ctx.shadowColor = '#46a7ff'
        ctx.shadowBlur = 24
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      // bright core
      for (let i = 1; i < n; i++) {
        if (i > drawLen) break
        const a = this.lightning[i - 1], b = this.lightning[i]
        ctx.globalAlpha = 0.95
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = ss * 0.03
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      // crackling off-shoots before impact
      if (this.rushProgress < 1) {
        for (let i = 1; i < n; i++) {
          if (i > drawLen) break
          const seed = this.arcs[i % this.arcs.length].seed
          if (Math.sin(this.time * 0.6 + seed * 40) > 0.2) {
            const a = this.lightning[i]
            const ang = Math.random() * Math.PI * 2
            const len = ss * (0.12 + Math.random() * 0.22)
            ctx.globalAlpha = 0.45
            ctx.strokeStyle = '#bfe6ff'
            ctx.lineWidth = ss * 0.02
            ctx.shadowBlur = 6
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(a.x + Math.cos(ang) * len, a.y + Math.sin(ang) * len)
            ctx.stroke()
          }
        }
      }
      ctx.restore()
    }

    // === 2. Chidori drill (crackling electric charge at rush position) ===
    if (this.rushProgress < 1 || this.impactFlash > 0.01) {
      const bx = this.drillX + ss / 2
      const by = this.drillY + ss / 2
      const R = ss * 0.32 * this.drillScale
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, R * 2.2)
      grad.addColorStop(0, 'rgba(255,255,255,0.95)')
      grad.addColorStop(0.4, 'rgba(160,225,255,0.8)')
      grad.addColorStop(1, 'rgba(70,150,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(bx, by, R * 2.2, 0, Math.PI * 2); ctx.fill()

      // chidori crackling arcs circling the drill
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI * 2 * k) / 6 + Math.random() * 0.5 + this.time * 3
        const inner = R * 0.55
        const outer = R * (1.7 + Math.random() * 0.5)
        ctx.globalAlpha = 0.75
        ctx.strokeStyle = '#cfeaff'
        ctx.lineWidth = ss * 0.02
        ctx.shadowColor = '#6fc9ff'
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(a) * inner, by + Math.sin(a) * inner)
        for (let s = 1; s <= 4; s++) {
          const tt = s / 4
          const rr = inner + (outer - inner) * tt
          const aa = a + (Math.random() - 0.5) * 1.0
          ctx.lineTo(bx + Math.cos(aa) * rr, by + Math.sin(aa) * rr)
        }
        ctx.stroke()
      }
      ctx.restore()
    }

    // === 3. Spark charges ===
    for (const s of this.sparks) {
      if (s.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = s.alpha
      ctx.fillStyle = s.color
      ctx.shadowColor = s.color
      ctx.shadowBlur = 6
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // === 4. Strike flash ===
    if (this.impactFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.impactFlash * 0.35
      ctx.fillStyle = '#dff2ff'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // === 5. Electrocution web around victim (crackling cage + white hot core) ===
    const cageAlpha = Math.sin((1 - this.victBurn) * Math.PI)
    if (cageAlpha > 0.02) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      for (const c of this.cage) {
        const ax = cxs + Math.cos(c.angle) * c.dist
        const ay = cys + Math.sin(c.angle) * c.dist
        const a2 = c.angle + 0.9
        const ex = ax + Math.cos(a2) * c.len
        const ey = ay + Math.sin(a2) * c.len
        const mx = ax + (ex - ax) * 0.5 + (Math.random() - 0.5) * ss * 0.12
        const my = ay + (ey - ay) * 0.5 + (Math.random() - 0.5) * ss * 0.12
        ctx.globalAlpha = cageAlpha * 0.65
        ctx.strokeStyle = '#bfe6ff'
        ctx.lineWidth = ss * 0.025
        ctx.shadowColor = '#5db4ff'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(ax, ay); ctx.lineTo(mx, my); ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      for (let k = 0; k < 7; k++) {
        const a = (Math.PI * 2 * k) / 7 + Math.random() * 0.6
        const r = ss * (0.2 + Math.random() * 0.5)
        ctx.globalAlpha = cageAlpha * 0.5
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = ss * 0.015
        ctx.beginPath()
        ctx.moveTo(cxs, cys)
        ctx.lineTo(cxs + Math.cos(a) * r * 0.5 + (Math.random() - 0.5) * ss * 0.08,
                   cys + Math.sin(a) * r * 0.5 + (Math.random() - 0.5) * ss * 0.08)
        ctx.lineTo(cxs + Math.cos(a) * r, cys + Math.sin(a) * r)
        ctx.stroke()
      }
      ctx.restore()
    }

    // === 6. Burned-to-dust ash ===
    for (const d of this.dust) {
      if (d.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = Math.min(1, d.alpha) * 0.85
      ctx.fillStyle = d.color
      ctx.shadowColor = '#9fb8e6'
      ctx.shadowBlur = 4
      ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}

/* ================================================================
   BISHOP CUT EFFECT — "an edit being started"
   A precise, smooth diagonal slice. A timeline-style scrub cue sweeps
   in, a golden slash-beam draws from bishop to victim, then an editor's
   blade slides through the victim and the two halves glide apart and
   dissolve with luminous glints. Elegant — no sloppy debris.
   ================================================================ */

export class BishopCutEffect {
  constructor(canvasRenderer, centerX, centerY, fromX, fromY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.fromX = fromX
    this.fromY = fromY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 1.05
    this.finished = false

    const ax = fromX + pieceSize / 2
    const ay = fromY + pieceSize / 2
    this.slashAngle = Math.atan2(centerY - ay, centerX - ax)

    // Drives Renderer.renderBishopSplit
    this.splitGap = 0
    this.fadeAlpha = 1

    this.engageProgress = 0
    this.beamProgress = 0
    this.cutProgress = 0
    this.flashAlpha = 0
    this.boardDarken = 0
    this.time = 0

    // Luminous glints at the seam
    this.glints = []
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.8
      const spd = 10 + Math.random() * 70
      const life = 0.3 + Math.random() * 0.5
      this.glints.push({
        x: centerX + (Math.random() - 0.5) * pieceSize,
        y: centerY + (Math.random() - 0.5) * pieceSize,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: pieceSize * (0.02 + Math.random() * 0.04),
        life,
        maxLife: life,
        alpha: 0,
        color: Math.random() > 0.4 ? '#ffe9a8' : '#ffffff'
      })
    }
  }

  start() {}

  update(progress) {
    const p = progress
    this.time += 0.016

    // Board darken rises during engage, falls after the cut
    if (p < 0.15) {
      this.boardDarken = Easing.easeOutCubic(p / 0.15) * 0.16
    } else if (p < 0.55) {
      this.boardDarken = 0.16
    } else if (p < 0.90) {
      this.boardDarken = 0.16 * (1 - Easing.easeOutCubic((p - 0.55) / 0.35))
    } else {
      this.boardDarken = 0
    }

    // Phase 0: edit engage (0-16%)
    if (p < 0.16) this.engageProgress = Easing.easeOutCubic(p / 0.16)
    else this.engageProgress = 1

    // Phase 1: slash beam (16-50%)
    if (p < 0.16) this.beamProgress = 0
    else if (p < 0.50) this.beamProgress = Easing.easeOutCubic((p - 0.16) / 0.34)
    else this.beamProgress = 1

    // Phase 2: the blade cut (50-62%)
    if (p >= 0.50 && p < 0.62) this.cutProgress = Easing.easeInOutCubic((p - 0.50) / 0.12)
    else if (p >= 0.62) this.cutProgress = 1

    // Split gap + fade (50-92%)
    if (p >= 0.50 && p < 0.75) {
      const t = (p - 0.50) / 0.25
      this.splitGap = Easing.easeOutCubic(t) * this.pieceSize * 0.9
    } else if (p >= 0.75 && p < 0.92) {
      const t = (p - 0.75) / 0.17
      this.splitGap = this.pieceSize * 0.9 + Easing.easeOutQuad(t) * this.pieceSize * 0.6
      this.fadeAlpha = 1 - t
    } else if (p >= 0.92) {
      this.splitGap = this.pieceSize * 1.5
      this.fadeAlpha = 0
    }

    // Cut flash (50-62%)
    if (p >= 0.50 && p < 0.62) {
      this.flashAlpha = Math.sin(((p - 0.50) / 0.12) * Math.PI) * 0.5
    } else {
      this.flashAlpha = 0
    }

    // Ignite + update glints during the split
    if (p >= 0.50) {
      const ignite = (p - 0.50) / 0.25
      for (let i = 0; i < this.glints.length; i++) {
        if (ignite > i * 0.03 && this.glints[i].alpha <= 0.001) this.glints[i].alpha = 1
      }
      for (const g of this.glints) {
        if (g.alpha <= 0.001) continue
        g.life -= 0.016
        if (g.life <= 0) { g.alpha = 0; continue }
        g.x += g.vx * 0.016
        g.y += g.vy * 0.016
        g.alpha *= 0.98
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const ss = this.pieceSize
    const ax = this.fromX + ss / 2
    const ay = this.fromY + ss / 2

    // Board darken
    if (this.boardDarken > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.boardDarken
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Timeline scrub cue sweeping toward the victim (the "edit being started")
    if (this.engageProgress > 0.01 && this.engageProgress < 1) {
      const ex = ax + (this.cx - ax) * this.engageProgress
      const ey = ay + (this.cy - ay) * this.engageProgress
      const ang = Math.atan2(this.cy - ay, this.cx - ax)
      const px = -Math.sin(ang)
      const py = Math.cos(ang)
      const len = ss * 3
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (1 - this.engageProgress) * 0.5
      ctx.strokeStyle = '#ffd76a'
      ctx.lineWidth = ss * 0.03
      ctx.shadowColor = '#ffd76a'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(ex + px * len, ey + py * len)
      ctx.lineTo(ex - px * len, ey - py * len)
      ctx.stroke()
      ctx.restore()
    }

    // Diagonal slash beam (bishop's signature line)
    if (this.beamProgress > 0.01) {
      const ex = ax + (this.cx - ax) * this.beamProgress
      const ey = ay + (this.cy - ay) * this.beamProgress
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.6
      ctx.strokeStyle = '#ffe7a0'
      ctx.lineWidth = ss * 0.10
      ctx.shadowColor = '#ffc14d'
      ctx.shadowBlur = 26
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.globalAlpha = 0.95
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = ss * 0.03
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.restore()
    }

    // Editor blade sliding through the victim along the slash line
    if (this.cutProgress > 0.01) {
      const along = this.cutProgress * ss * 1.4 - ss * 0.2
      const ang = this.slashAngle
      const px = -Math.sin(ang)
      const py = Math.cos(ang)
      const bx = this.cx - Math.cos(ang) * along
      const by = this.cy - Math.sin(ang) * along
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.9 * (1 - this.cutProgress * 0.3)
      ctx.strokeStyle = '#fff3cf'
      ctx.lineWidth = ss * 0.05
      ctx.shadowColor = '#ffcf6a'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.moveTo(bx + px * ss * 0.7, by + py * ss * 0.7)
      ctx.lineTo(bx - px * ss * 0.7, by - py * ss * 0.7)
      ctx.stroke()
      ctx.restore()
    }

    // Cut flash
    if (this.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flashAlpha
      ctx.fillStyle = '#fff7dd'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Seam glow between the separating halves
    if (this.splitGap > 0.01 && this.fadeAlpha > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = Math.min(0.8, this.fadeAlpha) * Math.min(1, this.splitGap / (ss * 0.4))
      const grad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, ss * 0.9)
      grad.addColorStop(0, 'rgba(255,235,180,0.9)')
      grad.addColorStop(1, 'rgba(255,235,180,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, ss * 0.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Luminous glints
    for (const g of this.glints) {
      if (g.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = g.alpha
      ctx.fillStyle = g.color
      ctx.shadowColor = g.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    return { shakeX: 0, shakeY: 0 }
  }
}

/* ================================================================
   KING TAKE EFFECT — the monarch's decree
   The king blazes with a golden royal aura, then a radiant shockwave
   rings out as the victim is "banished": lifted and dissolved upward
   into a stream of rising light motes. Smooth and imposing.
   ================================================================ */

export class KingMightEffect {
  constructor(canvasRenderer, centerX, centerY, fromX, fromY, pieceSize, victimColor) {
    this.canvasRenderer = canvasRenderer
    this.cx = centerX
    this.cy = centerY
    this.fromX = fromX
    this.fromY = fromY
    this.pieceSize = pieceSize
    this.victimColor = victimColor
    this.duration = 1.1
    this.finished = false

    this.auraAlpha = 0
    this.ringProgress = 0
    this.burnProgress = 0
    this.impactFlash = 0
    this.impactShake = 0
    this.time = 0

    // Rising light motes at the victim
    this.motes = []
    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * 2 * i) / 20 + (Math.random() - 0.5) * 1.2
      const spd = 15 + Math.random() * 60
      const life = 0.4 + Math.random() * 0.6
      this.motes.push({
        x: centerX + (Math.random() - 0.5) * pieceSize * 0.7,
        y: centerY + (Math.random() - 0.5) * pieceSize * 0.7,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30 - Math.random() * 60,
        size: pieceSize * (0.02 + Math.random() * 0.04),
        life,
        maxLife: life,
        alpha: 0,
        color: Math.random() > 0.4 ? '#ffd76a' : '#fff6dc'
      })
    }
  }

  start() {}

  update(progress) {
    const p = progress
    this.time += 0.016

    // Royal aura charge (0-55%), then decay
    if (p < 0.30) {
      this.auraAlpha = Easing.easeOutCubic(p / 0.30)
    } else if (p < 0.55) {
      this.auraAlpha = 1
    } else {
      this.auraAlpha = Math.max(0, 1 - (p - 0.55) / 0.20)
    }

    // Shockwave ring (50-80%)
    if (p >= 0.50 && p < 0.80) {
      this.ringProgress = (p - 0.50) / 0.30
    } else if (p >= 0.80) {
      this.ringProgress = 1
    }

    // Victim banished upward (52-88%)
    if (p >= 0.52 && p < 0.88) {
      this.burnProgress = Easing.easeInCubic((p - 0.52) / 0.36)
    } else if (p >= 0.88) {
      this.burnProgress = 1
    }

    // Impact flash + shake (50-60%)
    if (p >= 0.50 && p < 0.60) {
      const t = (p - 0.50) / 0.10
      this.impactFlash = Math.sin(t * Math.PI)
      this.impactShake = 5 * this.pieceSize * 0.03 * Math.sin(t * Math.PI)
    } else if (p >= 0.60 && p < 0.78) {
      this.impactFlash = 1 - (p - 0.60) / 0.18
      this.impactShake = 0
    } else {
      this.impactFlash = 0
      this.impactShake = 0
    }

    // Ignite + update motes during banishing
    if (p >= 0.52) {
      const ignite = (p - 0.52) / 0.30
      for (let i = 0; i < this.motes.length; i++) {
        if (ignite > i * 0.02 && this.motes[i].alpha <= 0.001) this.motes[i].alpha = 1
      }
      for (const m of this.motes) {
        if (m.alpha <= 0.001) continue
        m.life -= 0.016
        if (m.life <= 0) { m.alpha = 0; continue }
        m.vx *= 0.99
        m.vy -= 20 * 0.016
        m.x += m.vx * 0.016
        m.y += m.vy * 0.016
        m.alpha *= 0.985
      }
    }

    if (p >= 1) this.finished = true
  }

  render(ctx) {
    const { width, height } = this.canvasRenderer
    const ss = this.pieceSize
    const kx = this.fromX + ss / 2
    const ky = this.fromY + ss / 2

    // Royal aura at the king
    if (this.auraAlpha > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const R = ss * (0.5 + Math.sin(this.time * 6) * 0.04) * this.auraAlpha
      const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, R * 2.4)
      grad.addColorStop(0, `rgba(255,235,170,${0.5 * this.auraAlpha})`)
      grad.addColorStop(0.45, `rgba(255,205,110,${0.25 * this.auraAlpha})`)
      grad.addColorStop(1, 'rgba(255,190,90,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(kx, ky, R * 2.4, 0, Math.PI * 2)
      ctx.fill()
      // Light rays
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + this.time * 0.8
        const r0 = R
        const r1 = R * (2.2 + Math.sin(this.time * 5 + i) * 0.2)
        ctx.globalAlpha = 0.22 * this.auraAlpha
        ctx.strokeStyle = '#ffe9ad'
        ctx.lineWidth = ss * 0.02
        ctx.beginPath()
        ctx.moveTo(kx + Math.cos(a) * r0, ky + Math.sin(a) * r0)
        ctx.lineTo(kx + Math.cos(a) * r1, ky + Math.sin(a) * r1)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Impact flash
    if (this.impactFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.impactFlash * 0.3
      ctx.fillStyle = '#fff6dc'
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Shockwave ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const r = ss * (0.4 + this.ringProgress * 3.5)
      const w = ss * 0.16 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = (1 - this.ringProgress) * 0.75
      ctx.strokeStyle = '#ffd76a'
      ctx.lineWidth = w
      ctx.shadowColor = '#ffb347'
      ctx.shadowBlur = 22
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Rising light motes (banished victim)
    for (const m of this.motes) {
      if (m.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = m.alpha
      ctx.fillStyle = m.color
      ctx.shadowColor = m.color
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }
  }
}

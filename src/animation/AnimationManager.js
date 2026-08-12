import { Piece, Color } from '../core/ChessTypes.js'
import { GhostPiece } from './GhostPiece.js'
import { Camera } from './Camera.js'
import {
  resolveCaptureTier,
  CaptureTier,
  EditDissolveEffect,
  PawnSplitEffect,
  KnightDarknessEffect,
  KnightChainCaptureEffect,
  KnightPunchEffect,
  EpicClashEffect,
  RoyalDecapEffect,
  QueenRealitySlashEffect,
  RookPathEffect,
  QueenSonidoEffect,
  BishopCutEffect,
  KingMightEffect
} from './CaptureAnimations.js'

export class AnimationManager {
  constructor(canvasRenderer, pieceRenderer, engine, audioManager, timeController, eventBus) {
    this.canvasRenderer = canvasRenderer
    this.pieceRenderer = pieceRenderer
    this.engine = engine
    this.audioManager = audioManager
    this.timeController = timeController
    this.eventBus = eventBus
    this.camera = new Camera(canvasRenderer)
    this.camera.isActive = false // managed by Camera.update() dynamically

    this.ghostPieces = []
    this.trails = []
    this.captureEffects = null
    this.movePromise = null
    this.capturePromise = null
    this.moveTimeline = null
    this.captureTimeline = null
    this.captureEffect = null
    this.captureTier = null
    // Guards overlapping animation loops: whenever a *newer* animation starts it
    // bumps this counter, so a stale (older) loop can no longer clear shared
    // render state (ghost pieces / moveAnim) that the newer animation owns.
    this.animSeq = 0
  }

  // Hard-reset all transient animation state. Safe to call at any time
  // (resign, menu exit, replay/state switch) to guarantee no piece is ever
  // left hidden by a stale or interrupted animation.
  cancelAll() {
    this.animSeq++
    this.ghostPieces = []
    this.trails = []
    this.pieceRenderer.ghostPiece = null
    this.pieceRenderer.victimGhostPiece = null
    this.pieceRenderer.moveAnim = null
    this.captureEffect = null
    this.captureTier = null
  }

  getCamera() { return this.camera }
  getGhostPieces() { return this.ghostPieces }
  getTrails() { return this.trails }

  getCaptureEffects() {
    if (!this.captureEffect) return null
    return {
      tier: this.captureTier,
      effect: this.captureEffect,
      progress: this.captureEffect.finished ? 1 : 0
    }
  }

  setTimeScale(scale) {
    if (this.timeController) this.timeController.setGlobalTimeScale(scale)
  }

  squareToPixel(sq, orientation) {
    const { squareSize, boardOffsetX, boardOffsetY } = this.canvasRenderer
    const file = sq % 8
    const rank = Math.floor(sq / 8)
    const drawRank = orientation === 1 ? 7 - rank : rank
    const drawFile = orientation === 1 ? file : 7 - file
    const pieceSize = squareSize * 0.92
    const offset = (squareSize - pieceSize) / 2
    return {
      x: boardOffsetX + drawFile * squareSize + offset,
      y: boardOffsetY + drawRank * squareSize + offset,
      size: pieceSize
    }
  }

  animateMove({ from, to, piece, color, orientation, duration }) {
    return new Promise((resolve) => {
      const fromP = this.squareToPixel(from, orientation || 1)
      const toP = this.squareToPixel(to, orientation || 1)
      const dur = (duration || 0.28) * 1000

      this.ghostPieces = []
      this.pieceRenderer.ghostPiece = null
      this.pieceRenderer.victimGhostPiece = null

      const gp = new GhostPiece(this.pieceRenderer, piece, color, fromP.x, fromP.y, fromP.size)
      gp.targetX = toP.x
      gp.targetY = toP.y
      gp.startTime = performance.now()
      gp.duration = dur
      gp.isMoving = true

      // Arc and lean pre-calculation
      const dx = toP.x - fromP.x
      const dy = toP.y - fromP.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      gp.travelAngle = Math.atan2(dy, dx)

      this.ghostPieces = [gp]
      this.pieceRenderer.ghostPiece = gp

      this.pieceRenderer.moveAnim = { fromSq: from, toSq: to, isCapture: false }
      const seq = ++this.animSeq
      const animate = (now) => {
        const elapsed = now - gp.startTime
        const t = Math.min(elapsed / gp.duration, 1)

        // SmoothStep ease-in-out: quick launch, gentle deceleration
        const smooth = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

        try {
          gp.x = fromP.x + (toP.x - fromP.x) * smooth
          gp.y = fromP.y + (toP.y - fromP.y) * smooth

          // Parabolic arc for physical weight feel
          const arcHeight = Math.min(fromP.size * 1.6, dist * 0.16 + fromP.size * 0.08)
          gp.height = arcHeight * Math.sin(t * Math.PI)
          gp.y -= arcHeight * Math.sin(t * Math.PI)

          // Anticipatory lean + settle
          const leanBase = 0.025
          gp.rotation = Math.sin(t * Math.PI * 2) * leanBase * Math.cos(gp.travelAngle)
            + (1 - t) * leanBase * 0.3 * Math.cos(gp.travelAngle)

          // Squash-and-stretch
          const velocity = smooth * (1 - smooth) * 4
          gp.scaleX = 1 - velocity * 0.03
          gp.scaleY = 1 + velocity * 0.05

          // Shadow: deepens as piece lifts
          gp.shadowAlpha = 0.10 + Math.sin(t * Math.PI) * 0.10

          // Dust particles trail for all pieces
          if (Math.random() < 0.08 && t < 0.92) {
            const life = 0.15 + Math.random() * 0.25
            gp.dustParticles.push({
              x: gp.x + gp.size / 2 + (Math.random()-0.5) * gp.size * 0.35,
              y: gp.y + gp.size * 0.8,
              size: 0.5 + Math.random() * 1.8,
              color: 'rgba(200,200,180,0.28)',
              vx: (Math.random()-0.5) * 8, vy: -Math.random() * 6 - 1,
              life, maxLife: life, alpha: 0.28
            })
          }
          if (gp.updateDust) gp.updateDust(1/60)

          // Motion trail for longer moves
          if (dist > gp.size * 1.5 && t > 0.03 && t < 0.95) {
            gp.trail.push({ x: gp.x + gp.size/2, y: gp.y + gp.size/2 })
            if (gp.trail.length > 5) gp.trail.shift()
          }
        } catch (e) {
          // Never let a tick error stop the animation / leave pieces hidden
          console.warn('Move animation tick error:', e)
        }

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          gp.x = toP.x; gp.y = toP.y
          gp.height = 0; gp.rotation = 0
          gp.scaleX = 1; gp.scaleY = 1
          gp.shadowAlpha = 0.15
          gp.trail = []

          // This is still the current animation — nothing newer has taken over.
          if (this.animSeq === seq) {
            // 40ms fade-out settle before cleanup
            let settleDone = false
            const settleStart = performance.now()
            const settleAnim = (settleNow) => {
              const st = Math.min((settleNow - settleStart) / 40, 1)
              const se = 1 - Math.pow(1 - st, 3)
              gp.alpha = 1 - se
              gp.shadowAlpha = 0.15 * (1 - se)
              gp.trail = []
              if (st < 1 && !settleDone) {
                requestAnimationFrame(settleAnim)
              } else if (!settleDone) {
                settleDone = true
                gp.alpha = 0; gp.isMoving = false
                if (this.animSeq === seq) {
                  this.ghostPieces = []
                  this.pieceRenderer.moveAnim = null
                  this.pieceRenderer.ghostPiece = null
                }
                resolve()
              }
            }
            requestAnimationFrame(settleAnim)
          } else {
            // A newer animation owns the shared state; just resolve quietly.
            gp.alpha = 0; gp.isMoving = false
            resolve()
          }
        }
      }
      requestAnimationFrame(animate)
    })
  }

  animateCapture({ from, to, piece, color, orientation, victimPiece: vp, victimColor: vc }) {
    return new Promise((resolve) => {
      const fromP = this.squareToPixel(from, orientation || 1)
      const toP = this.squareToPixel(to, orientation || 1)
      const { squareSize, boardOffsetX, boardOffsetY } = this.canvasRenderer

      // Use pre-captured victim info (passed from InputManager before engine move)
      const victimPiece = vp || 0
      const victimColor = vc || 0

      // Clear any leftover ghost pieces from previous animations
      this.ghostPieces = []
      this.pieceRenderer.ghostPiece = null
      this.pieceRenderer.victimGhostPiece = null

      const gp = new GhostPiece(this.pieceRenderer, piece, color, fromP.x, fromP.y, fromP.size)
      gp.targetX = toP.x
      gp.targetY = toP.y
      gp.isCapture = true
      this.ghostPieces = [gp]
      this.pieceRenderer.ghostPiece = gp

      this.pieceRenderer.moveAnim = { fromSq: from, toSq: to, isCapture: true }
      if (victimPiece !== 0) {
        const vgp = new GhostPiece(this.pieceRenderer, victimPiece, victimColor, toP.x, toP.y, toP.size)
        vgp.alpha = 1
        vgp.isCapture = true
        this.pieceRenderer.victimGhostPiece = vgp
      }

      const isKnightFork = piece === Piece.KNIGHT ? this.detectKnightFork(to, color) : false
      const tier = resolveCaptureTier(piece, victimPiece, false, isKnightFork, from, to)
      this.captureTier = tier

      const file = to % 8
      const rank = Math.floor(to / 8)
      const drawRank = orientation === 1 ? 7 - rank : rank
      const cx = boardOffsetX + (file + 0.5) * squareSize
      const cy = boardOffsetY + (drawRank + 0.5) * squareSize

      switch (tier) {
        case CaptureTier.KNIGHT_DARKNESS:
          this.captureEffect = new KnightDarknessEffect(
            this.canvasRenderer, fromP.x, fromP.y, toP.x, toP.y, fromP.size, color
          )
          break
        case CaptureTier.KNIGHT_CHAIN_CAPTURE:
          this.captureEffect = new KnightChainCaptureEffect(
            this.canvasRenderer, fromP.x, fromP.y, toP.x, toP.y, fromP.size, color, victimColor,
            gp, this.pieceRenderer.victimGhostPiece
          )
          break
        case CaptureTier.KNIGHT_PUNCH:
          this.captureEffect = new KnightPunchEffect(
            this.canvasRenderer, fromP.x, fromP.y, toP.x, toP.y, fromP.size, color, victimColor,
            gp, this.pieceRenderer.victimGhostPiece
          )
          break
        case CaptureTier.QUEEN_SLASH:
          // Compute attack angle from attacker center to victim center
          const dx = toP.x - fromP.x
          const dy = toP.y - fromP.y
          const attackAngle = Math.atan2(dy, dx)
          this.captureEffect = new QueenRealitySlashEffect(
            this.canvasRenderer, cx, cy, fromP.size, victimColor, attackAngle
          )
          break
        case CaptureTier.QUEEN_SONIDO:
          this.captureEffect = new QueenSonidoEffect(
            this.canvasRenderer, cx, cy, fromP.x, fromP.y, fromP.size, victimColor
          )
          break
        case CaptureTier.ROOK_PATH:
          this.captureEffect = new RookPathEffect(
            this.canvasRenderer, fromP.x, fromP.y, toP.x, toP.y, fromP.size, victimColor
          )
          break
        case CaptureTier.BISHOP_CUT:
          this.captureEffect = new BishopCutEffect(
            this.canvasRenderer, cx, cy, fromP.x, fromP.y, fromP.size, victimColor
          )
          break
        case CaptureTier.KING_TAKE:
          this.captureEffect = new KingMightEffect(
            this.canvasRenderer, cx, cy, fromP.x, fromP.y, fromP.size, victimColor
          )
          break
        case CaptureTier.PAWN_SPLIT:
          this.captureEffect = new PawnSplitEffect(
            this.canvasRenderer, cx, cy, fromP.size, victimColor
          )
          break
        case CaptureTier.ROYAL_DECAP:
          this.captureEffect = new RoyalDecapEffect(
            this.canvasRenderer, cx, cy, fromP.size, victimColor
          )
          break
        case CaptureTier.EPIC_CLASH:
          this.captureEffect = new EpicClashEffect(
            this.canvasRenderer, cx, cy, fromP.size, victimColor
          )
          break
        default:
          this.captureEffect = new EditDissolveEffect(
            this.canvasRenderer, cx, cy, fromP.size, victimColor
          )
      }

      if (this.captureEffect && this.captureEffect.start) {
        this.captureEffect.start()
      }

      this._impactTriggered = false
      const effectDuration = (this.captureEffect.duration || 1.0) * 1000
      const startTime = performance.now()

      const seq = ++this.animSeq
      const animate = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / effectDuration, 1)

        try {
          if (tier === CaptureTier.QUEEN_SONIDO) {
            this._tickSonidoGhost(gp, progress, fromP, toP)
          } else {
            gp.x = fromP.x + (toP.x - fromP.x) * progress
            gp.y = fromP.y + (toP.y - fromP.y) * progress
          }

          // Electrocution victim: the Chidori burns its target to dust
          if (tier === CaptureTier.ROOK_PATH && this.captureEffect) {
            const burn = this.captureEffect.victBurn || 0
            const vgp = this.pieceRenderer.victimGhostPiece
            if (vgp) {
              vgp.alpha = Math.max(0.001, 1 - burn)
              vgp.rotation = (Math.random() - 0.5) * 0.6 * burn
              vgp.scaleX = 1 + burn * 0.18
              vgp.scaleY = 1 - burn * 0.6
            }
          }

          // King decree: the victim is banished — lifted and dissolved upward
          if (tier === CaptureTier.KING_TAKE && this.captureEffect) {
            const burn = this.captureEffect.burnProgress || 0
            const vgp = this.pieceRenderer.victimGhostPiece
            if (vgp) {
              vgp.alpha = Math.max(0.001, 1 - burn)
              vgp.y = toP.y - burn * fromP.size * 0.5
              vgp.scaleX = 1 - burn * 0.15
              vgp.scaleY = 1 - burn * 0.15
              vgp.rotation = burn * 0.08
            }
          }

          // === UPGRADE 2: PARTICLE BURST ===
        // Particle burst at the impact moment for each tier
        let impactAt = 0.15
        if (tier === CaptureTier.QUEEN_SONIDO) impactAt = 0.5
        if (tier === CaptureTier.QUEEN_SLASH) impactAt = 0.18
        if (!this._impactTriggered && progress >= impactAt) {
          this._impactTriggered = true
          this.spawnImpactParticles(toP.x + fromP.size/2, toP.y + fromP.size/2, fromP.size)
        }

        if (this.captureEffect && this.captureEffect.update) {
            this.captureEffect.update(progress)
          }
          if (this.captureEffect) {
            this.captureEffect.finished = progress >= 1
          }
        } catch (e) {
          // Never let a tick error kill the animation and leave pieces hidden
          console.warn('Capture animation tick error:', e)
        }

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          // Only the current animation is allowed to clear the shared render state
          if (this.animSeq === seq) {
            gp.alpha = 0
            this.ghostPieces = []
            this.pieceRenderer.moveAnim = null
            this.pieceRenderer.ghostPiece = null
            this.pieceRenderer.victimGhostPiece = null
            this.captureEffect = null
            this.captureTier = null
          }
          resolve()
        }
      }
      requestAnimationFrame(animate)
    })
  }

  // === UPGRADE 3: CHECK / CHECKMATE DRAMA ===
  zoomToKing(kingSquare, orientation, intensity = 1) {
    const p = this.squareToPixel(kingSquare, orientation || 1)
    const ctx = this.canvasRenderer.ctx
    // Center camera on the king square with 1.2x zoom
    this.camera.panTo(
      this.canvasRenderer.boardOffsetX + this.canvasRenderer.squareSize * (orientation === 1 ? kingSquare % 8 : 7 - kingSquare % 8) + this.canvasRenderer.squareSize / 2,
      this.canvasRenderer.boardOffsetY + this.canvasRenderer.squareSize * (orientation === 1 ? 7 - Math.floor(kingSquare / 8) : Math.floor(kingSquare / 8)) + this.canvasRenderer.squareSize / 2,
      0.45
    )
    this.camera.zoomTo(1.2 * intensity, 0.4)
    // Red vignette + flash
    this.camera.vignette = 0.4 * intensity
    this.camera.screenFlash = { color: [220, 30, 30], alpha: 0.4 * intensity }
    // Camera shake removed — caused screen drift issue
  }

  resetCameraView() {
    this.camera.panTo(this.camera.boardCenterX, this.camera.boardCenterY, 0.35)
    this.camera.zoomTo(1, 0.3)
    this.camera.vignette = 0
    this.camera.chromaticAberration = 0
    this.camera.screenFlash = { color: [255,255,255], alpha: 0 }
  }

  // Spawn particle burst for capture impact
  spawnImpactParticles(cx, cy, pieceSize) {
    const count = 12 + Math.floor(Math.random() * 10)
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
      const speed = 60 + Math.random() * 180
      const life = 0.3 + Math.random() * 0.4
      this.ghostPieces.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20 - Math.random() * 60,
        size: pieceSize * (0.03 + Math.random() * 0.08),
        alpha: 1, rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 15,
        life, maxLife: life,
        color: ['#ffd700','#ff6600','#ffffff','#ffaa00'][Math.floor(Math.random()*4)],
        isParticle: true,
        drawShadow() {}, drawTrail() {}, drawDust() {}, shadows: [],
        alpha: 1.0,      // populated below per-instance
        pieceRenderer: { drawPiece() {} },
        piece: 0, color: 0, size: 1, scaleX: 1, scaleY: 1, rotation: 0,
        height: 0, shadowAlpha: 0, trail: [], config: null, travelAngle: 0,
        draw(ctx) {
          if (this.alpha <= 0.01) return
          ctx.save(); ctx.globalAlpha = this.alpha
          ctx.translate(this.x, this.y); ctx.rotate(this.rotation)
          ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 6
          ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill()
          ctx.restore()
        },
        updateDust() {}
      })
    }
  }

  // Update camera + ghost pieces (particles and dust)
  update(dt) {
    this.camera.update(dt)
    for (let i = this.ghostPieces.length - 1; i >= 0; i--) {
      const gp = this.ghostPieces[i]
      if (gp.isParticle) {
        gp.life -= dt
        gp.alpha = Math.max(0, gp.life / gp.maxLife)
        gp.x += gp.vx * dt
        gp.y += gp.vy * dt
        gp.vy += 400 * dt // gravity
        gp.rotation += gp.rotSpeed * dt
        if (gp.life <= 0) this.ghostPieces.splice(i, 1)
      } else if (gp.updateDust) {
        gp.updateDust(dt)
      }
    }
  }

  _tickSonidoGhost(gp, progress, fromP, toP) {
    const p = progress
    // Vanish (0-0.14): queen still at source, shakes apart and fades with a
    // static flicker — Hollow sonido "shatter" look.
    if (p < 0.14) {
      const t = p / 0.14
      const jitter = (Math.random() - 0.5) * 4
      gp.x = fromP.x + jitter
      gp.y = fromP.y
      gp.alpha = Math.max(0, (1 - t) * (0.6 + Math.random() * 0.4))
      gp.scaleX = 1 - t * 0.2 + (Math.random() - 0.5) * 0.08
      gp.scaleY = 1 + t * 0.25
      gp.rotation = -t * 0.5 + (Math.random() - 0.5) * 0.15
    } else if (p < 0.30) {
      // Silent gap: nothing visible (true teleport).
      gp.x = fromP.x
      gp.y = fromP.y
      gp.alpha = 0
    } else if (p < 0.44) {
      // Sonido materialise: queen appears at the target, scaling in.
      const t = (p - 0.30) / 0.14
      gp.x = toP.x
      gp.y = toP.y
      gp.alpha = Math.min(1, t * 1.4)
      gp.scaleX = 0.6 + t * 0.4
      gp.scaleY = 0.6 + t * 0.4
      gp.rotation = (1 - t) * 0.4
    } else {
      // Sword strike + split: queen locked onto the victim.
      gp.x = toP.x
      gp.y = toP.y
      gp.alpha = 1
      gp.scaleX = 1
      gp.scaleY = 1
      gp.rotation = 0
    }
    gp.height = 0
    gp.shadowAlpha = gp.alpha > 0.01 ? 0.15 : 0
  }

  detectKnightFork(knightSq, knightColor) {
    const offsets = [
      [-1, -2], [1, -2], [-2, -1], [2, -1],
      [-2, 1], [2, 1], [-1, 2], [1, 2]
    ]
    const file = knightSq % 8
    const rank = Math.floor(knightSq / 8)
    let attackedCount = 0
    const position = this.engine.getPosition()
    for (const [df, dr] of offsets) {
      const nf = file + df
      const nr = rank + dr
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue
      const sq = nr * 8 + nf
      const targetPiece = position.board[sq]
      const targetColor = position.colors[sq]
      if (targetPiece !== 0 && targetColor !== knightColor && targetPiece !== Piece.PAWN) {
        attackedCount++
      }
    }
    return attackedCount >= 2
  }

  resize(width, height) {
    this.canvasRenderer.resize(width, height)
    this.camera.setViewport(width, height)
    const boardCenterX = this.canvasRenderer.boardOffsetX + this.canvasRenderer.squareSize * 4
    const boardCenterY = this.canvasRenderer.boardOffsetY + this.canvasRenderer.squareSize * 4
    this.camera.setBoardCenter(boardCenterX, boardCenterY)
  }
}

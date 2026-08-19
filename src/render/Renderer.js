import { ParticleSystem, ParticlePalettes } from '../animation/ParticleSystem.js'
import { CaptureTier } from '../animation/CaptureAnimations.js'

export class Renderer {
  constructor(canvasRenderer, pieceRenderer, boardRenderer) {
    this.canvasRenderer = canvasRenderer
    this.pieceRenderer = pieceRenderer
    this.boardRenderer = boardRenderer

    this.ctx = canvasRenderer.ctx
    this.width = canvasRenderer.width
    this.height = canvasRenderer.height

    this.particleSystem = new ParticleSystem()
  }

  resize(width, height) {
    this.width = width
    this.height = height
    this.canvasRenderer.resize(width, height)
  }

  render(engine, camera, ghostPieces = [], trails = [], captureEffects = null) {
    const { ctx, width, height } = this

    this.clear()

    const cameraActive = camera && camera.isActive
    if (cameraActive) camera.applyTransform(ctx)

    try {
      this.renderBackground(ctx, width, height)

      this.boardRenderer.render(ctx)

      if (engine) {
        this.renderStaticPieces(engine, captureEffects)
      }

      this.renderGhostPieces(ctx, ghostPieces, captureEffects)

      for (const trail of trails) {
        if (trail && trail.length > 1) {
          this.renderTrail(ctx, trail)
        }
      }
    } finally {
      if (cameraActive) camera.restoreTransform(ctx)
    }

    if (captureEffects) {
      this.renderCaptureEffects(ctx, captureEffects)
    }
  }

  clear() {
    const { ctx, width, height } = this
    ctx.clearRect(0, 0, width, height)
  }

  renderBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(0.5, '#16213e')
    gradient.addColorStop(1, '#0f0f23')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  renderStaticPieces(engine, captureEffects) {
    const position = engine.getPosition()
    const { board, colors } = position
    const { squareSize, boardOffsetX, boardOffsetY } = this.canvasRenderer
    const pieceSize = squareSize * this.pieceRenderer.drawScale
    const offset = (squareSize - pieceSize) / 2

    const pr = this.pieceRenderer

    // SAFETY NET: Detect and recover from corrupted animation state
    // If moveAnim exists but ghostPiece is missing or invisible, or vice versa,
    // the state is corrupted - clear it and draw all pieces normally.
    // Use Boolean() coercion so that null/undefined/0 falsey values compare as equal
    // (the original `hasMoveAnim !== hasGhost` falsely fired whenever ghostPiece
    // was null and moveAnim was false, both "no animation" states, spamming "corrupted"
    // warnings and clearing valid state).
    const hasGhost = !!(pr.ghostPiece && pr.ghostPiece.alpha > 0.01)
    const hasMoveAnim = !!pr.moveAnim
    if (hasMoveAnim !== hasGhost) {
      // Corrupted state: one exists without the other
      console.warn('[Renderer] Corrupted animation state detected, recovering:', {
        hasGhost,
        hasMoveAnim,
        ghostAlpha: pr.ghostPiece?.alpha,
        moveAnim: pr.moveAnim
      })
      pr.ghostPiece = null
      pr.victimGhostPiece = null
      pr.moveAnim = null
    }

    // During animations, skip the source square (ghost covers it)
    // For captures, also skip destination (both pieces hidden, ghost handles visuals)
    // SAFETY: Only hide squares if there's an ACTIVE ghost piece rendering them.
    // This prevents pieces from permanently vanishing if animation state gets corrupted.
    const ghostActive = pr.ghostPiece && pr.ghostPiece.alpha > 0.01 && pr.moveAnim

    // Special handling for QUEEN_SONIDO: during the "silent gap" the ghost is invisible
    // at the source, but the queen is already at the destination in the engine.
    // Don't hide the destination square so the queen doesn't vanish.
    const isQueenSonido = captureEffects?.tier === CaptureTier.QUEEN_SONIDO

    // Special handling for KNIGHT_CHAIN_CAPTURE: during blackout, hide ALL static pieces
    // Only the knight ghost and victim ghost should be visible.
    // SAFETY: only trust blackoutAlpha if the effect is STILL animating. A stale
    // reference to a finished/interrupted effect could freeze blackoutAlpha at 1
    // and permanently vanish every piece on the board.
    const isKnightChainCapture = captureEffects?.tier === CaptureTier.KNIGHT_CHAIN_CAPTURE
    const effectFinished = !!captureEffects?.effect?.finished
    const knightChainBlackout = isKnightChainCapture
      && !effectFinished
      && captureEffects?.effect?.blackoutAlpha > 0.01

    for (let sq = 0; sq < 64; sq++) {
      const piece = board[sq]
      const color = colors[sq]
      if (piece === 0) continue

      // KNIGHT_CHAIN_CAPTURE: During blackout, hide ALL static pieces
      // Only the animated knight ghost and victim ghost will be drawn
      if (knightChainBlackout) continue

      // Hide engine pieces at from/to only when a ghost is actively animating them
      if (ghostActive && pr.moveAnim) {
        if (sq === pr.moveAnim.fromSq) continue
        // For QUEEN_SONIDO, don't hide destination - queen is already there
        if (!isQueenSonido && sq === pr.moveAnim.toSq) continue
      }

      const { file, rank } = this.canvasRenderer.squareToCoord(sq, this.boardRenderer.boardAppearance.orientation)
      const x = boardOffsetX + file * squareSize + offset
      const y = boardOffsetY + rank * squareSize + offset

      this.pieceRenderer.drawPiece(this.ctx, piece, color, x, y, pieceSize)
    }
  }

  renderGhostPieces(ctx, ghostPieces, captureEffects) {
    // Draw shadows for ALL ghost pieces first (including particles)
    for (const ghost of ghostPieces) {
      if (ghost && ghost.alpha > 0.01) {
        ghost.drawShadow(ctx)
        if (ghost.drawDust) ghost.drawDust(ctx)
      }
    }

    // Draw victim ghost (UNDER) – disappears before attacker lands
    const victimGhost = this.pieceRenderer.victimGhostPiece
    if (victimGhost && victimGhost.alpha > 0.01) {
      if (captureEffects?.tier === CaptureTier.PAWN_SPLIT && captureEffects?.effect) {
        this.renderSplitVictim(ctx, victimGhost, captureEffects.effect)
      } else if (captureEffects?.tier === CaptureTier.QUEEN_SONIDO && captureEffects?.effect) {
        this.renderSonidoSplit(ctx, victimGhost, captureEffects.effect)
      } else if (captureEffects?.tier === CaptureTier.BISHOP_CUT && captureEffects?.effect) {
        this.renderBishopSplit(ctx, victimGhost, captureEffects.effect)
      } else {
        victimGhost.draw(ctx)
      }
    }

    // Draw additional ghost particles from array (NOT attacker or victim)
    // These are impact debris / particles that should render UNDER the attacker
    for (const ghost of ghostPieces) {
      if (ghost && ghost.alpha > 0.01 && ghost.isParticle) {
        ghost.draw(ctx)
      }
    }

    // Draw attacker ghost (ON TOP) – the attacking queen
    const attackerGhost = this.pieceRenderer.ghostPiece
    if (attackerGhost && attackerGhost.alpha > 0.01) {
      attackerGhost.drawTrail(ctx, attackerGhost.color)
      if (attackerGhost.drawDust) attackerGhost.drawDust(ctx)
      attackerGhost.draw(ctx)
    }
  }

  renderSplitVictim(ctx, victimGhost, effect) {
    // Draw the victim piece split into two halves
    // Each half is clipped and offset in opposite directions perpendicular to travel
    if (effect.dissolveAlpha <= 0.01) return

    const halfW = effect.pieceSize * 0.5
    const splitAngle = effect.travelAngle + Math.PI / 2
    const cx = effect.cx
    const cy = effect.cy
    const pieceSize = effect.pieceSize

    // Left half
    ctx.save()
    ctx.globalAlpha = effect.dissolveAlpha
    const leftOffsetX = effect.leftHalfOffset * Math.cos(splitAngle)
    const leftOffsetY = effect.leftHalfOffset * Math.sin(splitAngle)
    ctx.beginPath()
    ctx.rect(cx - pieceSize * 0.5 + leftOffsetX, cy - pieceSize * 0.5, halfW, pieceSize)
    ctx.clip()
    ctx.translate(leftOffsetX, leftOffsetY)
    victimGhost.draw(ctx)
    ctx.restore()

    // Right half
    ctx.save()
    ctx.globalAlpha = effect.dissolveAlpha
    const rightOffsetX = effect.rightHalfOffset * Math.cos(splitAngle)
    const rightOffsetY = effect.rightHalfOffset * Math.sin(splitAngle)
    ctx.beginPath()
    ctx.rect(cx, cy - pieceSize * 0.5, halfW, pieceSize)
    ctx.clip()
    ctx.translate(rightOffsetX, rightOffsetY)
    victimGhost.draw(ctx)
    ctx.restore()
  }

  renderBishopSplit(ctx, victimGhost, effect) {
    // Draw the victim split cleanly along the bishop's diagonal slash line.
    // The two halves glide perpendicular to the slash as they separate, keeping
    // a smooth editorial "cut" — no debris, just a clean geometric slice.
    if (effect.fadeAlpha <= 0.01) return

    const ss = effect.pieceSize
    const half = ss * 0.62
    const cx = effect.cx
    const cy = effect.cy
    const gap = effect.splitGap

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(effect.slashAngle)
    ctx.globalAlpha = effect.fadeAlpha

    // Upper half, shifted perpendicular by -gap
    ctx.save()
    ctx.translate(0, -gap)
    ctx.beginPath()
    ctx.rect(-half, -half, half * 2, half)
    ctx.clip()
    ctx.rotate(-effect.slashAngle)
    ctx.translate(-cx, -cy)
    victimGhost.draw(ctx)
    ctx.restore()

    // Lower half, shifted perpendicular by +gap
    ctx.save()
    ctx.translate(0, gap)
    ctx.beginPath()
    ctx.rect(-half, 0, half * 2, half)
    ctx.clip()
    ctx.rotate(-effect.slashAngle)
    ctx.translate(-cx, -cy)
    victimGhost.draw(ctx)
    ctx.restore()

    ctx.restore()
  }

  renderSonidoSplit(ctx, victimGhost, effect) {
    // Draw the real victim piece torn along the slash line (Bleach sonido).
    // Offsets perpendicular to the attack angle so the two halves fly apart.
    if (effect.victimAlpha <= 0.01 || effect.splitGap <= 0.5) return

    const ss = effect.pieceSize
    const perpX = -Math.sin(effect.attackAngle)
    const perpY = Math.cos(effect.attackAngle)
    const cx = effect.cx
    const cy = effect.cy

    // Half 1 (negative perpendicular side)
    ctx.save()
    ctx.globalAlpha = effect.victimAlpha
    ctx.translate(-perpX * effect.splitGap, -perpY * effect.splitGap)
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(effect.attackAngle) * ss, cy - Math.sin(effect.attackAngle) * ss)
    ctx.lineTo(cx + Math.cos(effect.attackAngle) * ss, cy + Math.sin(effect.attackAngle) * ss)
    ctx.lineTo(cx + Math.cos(effect.attackAngle) * ss + perpX * ss * 2, cy + Math.sin(effect.attackAngle) * ss + perpY * ss * 2)
    ctx.lineTo(cx - Math.cos(effect.attackAngle) * ss + perpX * ss * 2, cy - Math.sin(effect.attackAngle) * ss + perpY * ss * 2)
    ctx.closePath()
    ctx.clip()
    victimGhost.draw(ctx)
    ctx.restore()

    // Half 2 (positive perpendicular side)
    ctx.save()
    ctx.globalAlpha = effect.victimAlpha
    ctx.translate(perpX * effect.splitGap, perpY * effect.splitGap)
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(effect.attackAngle) * ss, cy - Math.sin(effect.attackAngle) * ss)
    ctx.lineTo(cx + Math.cos(effect.attackAngle) * ss, cy + Math.sin(effect.attackAngle) * ss)
    ctx.lineTo(cx + Math.cos(effect.attackAngle) * ss - perpX * ss * 2, cy + Math.sin(effect.attackAngle) * ss - perpY * ss * 2)
    ctx.lineTo(cx - Math.cos(effect.attackAngle) * ss - perpX * ss * 2, cy - Math.sin(effect.attackAngle) * ss - perpY * ss * 2)
    ctx.closePath()
    ctx.clip()
    victimGhost.draw(ctx)
    ctx.restore()
  }

  renderTrail(ctx, trail) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length
      const prev = trail[i - 1]
      const curr = trail[i]
      const alpha = t * 0.12

      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 4 * t
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(curr.x, curr.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  renderCaptureEffects(ctx, effects) {
    if (!effects) return

    // NEW: If we have a tiered capture effect object, delegate to its render method
    if (effects.effect && typeof effects.effect.render === 'function') {
      const shake = effects.effect.render(ctx)
      // Apply shake offset if returned
      if (shake && (shake.shakeX || shake.shakeY)) {
        ctx.save()
        ctx.translate(shake.shakeX || 0, shake.shakeY || 0)
        // Note: the shake is already applied inside the effect render
        ctx.restore()
      }
      return
    }

    // LEGACY: Render old-style capture effects
    const pieceSize = effects.pieceSize || 64
    const cx = effects.centerX || 0
    const cy = effects.centerY || 0

    if (effects.flashAlpha > 0.01) {
      ctx.save()
      ctx.globalAlpha = effects.flashAlpha * 0.2
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, this.width, this.height)
      ctx.restore()
    }

    if (effects.ringProgress > 0.01) {
      const ringR = pieceSize * (0.5 + effects.ringProgress * 3)
      const ringWidth = pieceSize * 0.12 * (1 - effects.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - effects.ringProgress) * 0.8
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringWidth
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    if (effects.victimFragments && effects.victimFragments.length > 0) {
      for (const f of effects.victimFragments) {
        if (f.alpha <= 0) continue
        ctx.save()
        ctx.globalAlpha = f.alpha
        ctx.translate(f.x, f.y)
        ctx.rotate(f.rotation)
        ctx.fillStyle = f.color
        ctx.shadowColor = f.color
        ctx.shadowBlur = 6
        if (f.shape === 'square') {
          ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size)
        } else if (f.shape === 'diamond') {
          ctx.beginPath()
          ctx.moveTo(0, -f.size)
          ctx.lineTo(f.size, 0)
          ctx.lineTo(0, f.size)
          ctx.lineTo(-f.size, 0)
          ctx.closePath()
          ctx.fill()
        } else if (f.shape === 'triangle') {
          ctx.beginPath()
          ctx.moveTo(0, -f.size)
          ctx.lineTo(f.size * 0.866, f.size * 0.5)
          ctx.lineTo(-f.size * 0.866, f.size * 0.5)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
    }

    if (effects.chromaticAberration > 0.01) {
      const splitDist = pieceSize * 0.04 * effects.chromaticAberration
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = ctx.canvas.width
      tempCanvas.height = ctx.canvas.height
      const tempCtx = tempCanvas.getContext('2d')
      tempCtx.drawImage(ctx.canvas, 0, 0)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.4 * effects.chromaticAberration
      ctx.filter = 'sepia(1) saturate(5) hue-rotate(-120deg)'
      ctx.drawImage(tempCanvas, -splitDist, 0)
      ctx.filter = 'sepia(1) saturate(5) hue-rotate(120deg)'
      ctx.drawImage(tempCanvas, splitDist, 0)
      ctx.filter = 'none'
      ctx.restore()
    }

    if (effects.vignette > 0.01) {
      ctx.save()
      const gradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 0,
        this.width / 2, this.height / 2, Math.max(this.width, this.height)
      )
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, `rgba(0,0,0,${effects.vignette * 0.5})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, this.width, this.height)
      ctx.restore()
    }
  }

  renderDebugInfo(ctx, ghostPieces, trails) {
    if (!this.debug) return

    ctx.save()
    ctx.font = '12px monospace'
    ctx.fillStyle = '#0f0'
    ctx.fillText(`Ghost pieces: ${ghostPieces.filter(g => g?.visible).length}`, 10, 20)
    ctx.fillText(`Trails: ${trails.length}`, 10, 35)
    ctx.restore()
  }
}
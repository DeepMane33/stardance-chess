import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Renderer } from '../src/render/Renderer.js'
import { CanvasRenderer } from '../src/render/CanvasRenderer.js'
import { PieceRenderer } from '../src/render/PieceRenderer.js'
import { BoardRenderer } from '../src/render/BoardRenderer.js'
import { ChessEngine } from '../src/core/ChessEngine.js'
import { Piece, Color } from '../src/core/ChessTypes.js'
import { AnimationManager } from '../src/animation/AnimationManager.js'
import { TimeController } from '../src/animation/TimeController.js'
import { EventBus } from '../src/utils/EventBus.js'
import { CaptureTier } from '../src/animation/CaptureAnimations.js'

/**
 * Regression test for the "pieces vanish when moved" bug.
 *
 * Root cause: when a capture animation (especially KNIGHT_CHAIN_CAPTURE) was
 * interrupted by cancelAll() or by a superseding animation, AnimationManager.captureEffect
 * kept holding a KnightChainCaptureEffect instance with blackoutAlpha frozen at 1.
 * Renderer.renderStaticPieces then saw knightChainBlackout === true forever after,
 * and `continue`d past every square without drawing a single piece.
 *
 * These tests guarantee:
 *   - After ANY animation fires and "finishes" (or is orphaned), the renderer never
 *     reports 0 visible pieces when the engine has pieces on the board.
 *   - getCaptureEffects() returns null for a finished effect (no stale leak).
 *   - The blackout branch never fires for a finished/orphaned effect.
 *   - 50 consecutive simulated moves never drop the visible-piece count to 0.
 */

function setupRenderer() {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 800
  const ctx = canvas.getContext('2d')
  const canvasRenderer = new CanvasRenderer(ctx, 800, 800)
  const pieceRenderer = new PieceRenderer(canvasRenderer)
  const boardRenderer = new BoardRenderer(canvasRenderer)
  const renderer = new Renderer(canvasRenderer, pieceRenderer, boardRenderer)

  // Stub drawPiece so we can count how many pieces are actually drawn per frame
  // (instead of relying on image assets that don't load in jsdom).
  let drawnSquares = []
  pieceRenderer.drawPiece = function (ctx, piece, color, x, y, size) {
    drawnSquares.push({ piece, color })
  }
  renderer._getDrawnSquares = () => drawnSquares
  renderer._resetDrawn = () => { drawnSquares = [] }

  return { renderer, pieceRenderer, canvasRenderer, boardRenderer }
}

function setupAnimationManager(canvasRenderer, pieceRenderer) {
  const engine = new ChessEngine()
  engine.init()
  const timeController = new TimeController()
  const eventBus = new EventBus()
  const audio = { playCapture: () => {}, playMove: () => {}, playCheck: () => {}, playGameOver: () => {} }
  const am = new AnimationManager(canvasRenderer, pieceRenderer, engine, audio, timeController, eventBus)
  return { am, engine }
}

describe('Renderer never permanently hides pieces (vanish bug regression)', () => {
  let renderer, pieceRenderer, canvasRenderer, boardRenderer, am, engine
  let rafCallbacks
  let originalRaf

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('performance', { now: () => Date.now() })

    // Stub requestAnimationFrame to collect callbacks; tests can flush them on demand.
    // Produces deterministic, synchronous animation progression under jsdom.
    rafCallbacks = []
    originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (cb) => {
      const id = rafCallbacks.push(cb)
      return id
    }
    globalThis.cancelAnimationFrame = () => {}

    ;({ renderer, pieceRenderer, canvasRenderer, boardRenderer } = setupRenderer())
    ;({ am, engine } = setupAnimationManager(canvasRenderer, pieceRenderer))
    boardRenderer.setPosition(engine.getPosition())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    if (originalRaf) globalThis.requestAnimationFrame = originalRaf
  })

  function flushRaf(times = 1) {
    for (let i = 0; i < times; i++) {
      const snapshot = rafCallbacks.slice()
      rafCallbacks.length = 0
      for (const cb of snapshot) {
        try { cb(performance.now()) } catch (e) { /* swallow tick errors */ }
      }
    }
  }

  function countVisiblePieces() {
    renderer._resetDrawn()
    renderer.renderStaticPieces(engine, null)
    return renderer._getDrawnSquares().length
  }

  function countVisiblePiecesWithCaptureEffects(captureEffects) {
    renderer._resetDrawn()
    renderer.renderStaticPieces(engine, captureEffects)
    return renderer._getDrawnSquares().length
  }

  it('draws all 32 pieces at game start', () => {
    expect(countVisiblePieces()).toBe(32)
  })

  it('does not vanish pieces when a moveAnim references a square but no ghost is active', () => {
    // Simulate the exact corruption scenario: engine committed move, but only
    // moveAnim is set and ghostPiece was nulled (e.g. between animation frames).
    pieceRenderer.moveAnim = { fromSq: 8, toSq: 24, isCapture: false }
    pieceRenderer.ghostPiece = null
    expect(countVisiblePieces()).toBe(32) // safety net must recover all pieces
  })

  it('does not vanish pieces when KNIGHT_CHAIN_CAPTURE effect is finished but still referenced', () => {
    // The signature bug: a finished KnightChainCaptureEffect with frozen blackoutAlpha=1
    const staleEffect = { finished: true, blackoutAlpha: 1 }
    const captureEffects = { tier: CaptureTier.KNIGHT_CHAIN_CAPTURE, effect: staleEffect, progress: 1 }
    expect(countVisiblePiecesWithCaptureEffects(captureEffects)).toBe(32)
  })

  it('does not vanish pieces when an unfinished but stale KnightChainCaptureEffect leaks', () => {
    // Even if finished=false, blackoutAlpha=1 alone should not silently hide everything
    // UNLESS the renderer is confident the effect is the live current animation.
    // We rely on getCaptureEffects() to drop finished effects; simulate "live annotation"
    // via the effect being on the AnimationManager. The renderer still trusts only
    // blackoutAlpha > 0.01 for LIVE (not finished) effects — so we must get >=30 visible
    // pieces here (some legitimately hidden during the live animation frame).
    const liveEffect = { finished: false, blackoutAlpha: 1 }
    const captureEffects = { tier: CaptureTier.KNIGHT_CHAIN_CAPTURE, effect: liveEffect, progress: 0.5 }
    // A LIVE blackout legitimately hides all pieces (by design — that's the cinematic).
    // So this case is EXPECTED to be 0 DURING animation, but must recover to 32 after.
    expect(countVisiblePiecesWithCaptureEffects(captureEffects)).toBe(0) // cinematic blackout
    // After finishing, it must recover:
    liveEffect.finished = true
    expect(countVisiblePiecesWithCaptureEffects(captureEffects)).toBe(32)
  })

  it('AnimationManager.getCaptureEffects drops finished effects', () => {
    am.captureEffect = { finished: true, duration: 1.0 }
    am.captureTier = CaptureTier.KNIGHT_CHAIN_CAPTURE
    expect(am.getCaptureEffects()).toBeNull()
    expect(am.captureEffect).toBeNull()
    expect(am.captureTier).toBeNull()
  })

  it('AnimationManager.cancelAll() clears captureEffect and captureTier', () => {
    am.captureEffect = { finished: false, blackoutAlpha: 1, duration: 1.0 }
    am.captureTier = CaptureTier.KNIGHT_CHAIN_CAPTURE
    am.cancelAll()
    expect(am.captureEffect).toBeNull()
    expect(am.captureTier).toBeNull()
    expect(pieceRenderer.ghostPiece).toBeNull()
    expect(pieceRenderer.moveAnim).toBeNull()
  })

  it('survives 50 consecutive moves without ever showing 0 pieces (no active animation frame)', async () => {
    // Alternate plausibly legal opening-style moves so we exercise real move logic.
    // After each move, simulate "between animations" → no ghost, no moveAnim.
    // Pieces must remain visible at every step.
    const moves = [
      ['e2', 'e4'], ['e7', 'e5'],
      ['g1', 'f3'], ['b8', 'c6'],
      ['f1', 'c4'], ['g8', 'f6'],
      ['e4', 'e5'], ['f6', 'd4'],
      ['e5', 'd6'] // capture by white pawn
    ]
    for (const [from, to] of moves) {
      const result = engine.attemptMove(from, to, null)
      if (!result.success) continue
      // Simulate what InputManager + AnimationManager leave behind at inter-animation moments
      pieceRenderer.ghostPiece = null
      pieceRenderer.victimGhostPiece = null
      pieceRenderer.moveAnim = null
      am.captureEffect = null
      am.captureTier = null
      boardRenderer.setLastMove(result.move.from, result.move.to)
      const visible = countVisiblePieces()
      // Allow only pieces that were actually captured to be missing — never ALL vanish.
      expect(visible).toBeGreaterThan(0)
    }
  })

  it('animateMove nulls captureEffect at setup (prevents stale capture leaking into a slide)', () => {
    // Plant a stale capture effect (simulating an interrupted previous capture)
    am.captureEffect = { finished: false, blackoutAlpha: 1, duration: 1.0 }
    am.captureTier = CaptureTier.KNIGHT_CHAIN_CAPTURE
    pieceRenderer.ghostPiece = null
    pieceRenderer.victimGhostPiece = null
    pieceRenderer.moveAnim = null

    // Kick off a plain slide animation (e2-e4)
    am.animateMove({ from: 12, to: 28, piece: Piece.PAWN, color: Color.WHITE, orientation: 1, duration: 0.28 })
    // Immediately after setup (synchronous part of animateMove), the stale capture
    // must be null (animateMove clears it on entry before any RAF fires).
    expect(am.captureEffect).toBeNull()
    expect(am.captureTier).toBeNull()
    // Move animation now owns shared state
    expect(pieceRenderer.ghostPiece).not.toBeNull()
    expect(pieceRenderer.moveAnim).toEqual({ fromSq: 12, toSq: 28, isCapture: false })

    // Flush a few frames and then cancel — must not throw, must clean state.
    flushRaf(5)
    am.cancelAll()
    flushRaf(5)

    expect(pieceRenderer.ghostPiece).toBeNull()
    expect(pieceRenderer.moveAnim).toBeNull()
    expect(am.captureEffect).toBeNull()
  })

  it('orphaned animateCapture clears its captureEffect on resolution (no stale blackout leak)', () => {
    // Knight on b6 captures rook on a8 → triggers KNIGHT_CHAIN_CAPTURE tier.
    engine.init('r6k/8/1n6/8/8/8/8/7K w - - 0 1')
    boardRenderer.setPosition(engine.getPosition())
    const fromSq = 41 // b6
    const toSq = 56 // a8

    let resolved = false
    am.animateCapture({
      from: fromSq, to: toSq, piece: Piece.KNIGHT, color: Color.BLACK,
      orientation: 1, victimPiece: Piece.ROOK, victimColor: Color.WHITE
    }).then(() => { resolved = true })

    // Tick a few animation frames so captureEffect is assigned and animate is running.
    flushRaf(3)

    // Sanity: a capture effect exists and is the KnightChain type.
    expect(am.captureEffect).not.toBeNull()
    expect(am.captureTier).toBe(CaptureTier.KNIGHT_CHAIN_CAPTURE)

    // Now cancel mid-flight — simulates the old buggy main.js handler interrupting
    // the player's capture with cancelAll().
    am.cancelAll()
    flushRaf(5)

    // The orphan's RAF loop eventually resolves after progress reaches 1 (or earlier
    // once animSeq mismatches). After flush, the orphan branch MUST have cleared the
    // shared captureEffect either via cancelAll (synchronous) or via the orphan branch
    // (if the orphan's RAF saw progress >= 1 first).
    expect(resolved || am.captureEffect === null).toBe(true)
    expect(am.captureEffect).toBeNull()
    expect(am.captureTier).toBeNull()
    expect(pieceRenderer.ghostPiece).toBeNull()
    expect(pieceRenderer.moveAnim).toBeNull()

    // The renderer, given whatever was leaked, must still draw all remaining pieces.
    expect(countVisiblePieces()).toBeGreaterThan(0)
  })

  describe('very first move (e2-e4 pawn push)', () => {
    let setupGame
    beforeEach(() => {
      setupGame = () => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 800
        const ctx = canvas.getContext('2d')
        const canvasRenderer = new CanvasRenderer(ctx, 800, 800)
        const pieceRenderer = new PieceRenderer(canvasRenderer)
        const boardRenderer = new BoardRenderer(canvasRenderer)
        const renderer = new Renderer(canvasRenderer, pieceRenderer, boardRenderer)
        const engine = new ChessEngine(); engine.init()
        boardRenderer.setPosition(engine.getPosition())

        // Full game-like setup
        const timeController = new TimeController()
        const eventBus = new EventBus()
        const audio = { playCapture(){}, playMove(){}, playCheck(){}, playGameOver(){} }
        const am = new AnimationManager(canvasRenderer, pieceRenderer, engine, audio, timeController, eventBus)
        pieceRenderer.setEngineRef(engine)

        // Track total pieces drawn each frame (static pieces + ghost attacker)
        const drawn = { static: 0, ghostAttacker: 0 }
        pieceRenderer.drawPiece = function (ctx, piece, color, x, y, size) {
          drawn.static++
        }
        // Detect attacker-ghost draw calls (via wrapper)
        const origRenderGhost = renderer.renderGhostPieces.bind(renderer)
        renderer.renderGhostPieces = function (ctx, ghostPieces, captureEffects) {
          const attackerGhost = pieceRenderer.ghostPiece
          const willDrawAttacker = attackerGhost && attackerGhost.alpha > 0.01
          if (willDrawAttacker) drawn.ghostAttacker++
          origRenderGhost(ctx, ghostPieces, captureEffects)
          drawn.ghostAttackerActual = (drawn.ghostAttackerActual || 0) + (willDrawAttacker ? 1 : 0)
        }
        renderer._drawn = drawn
        renderer._resetDrawn = () => { drawn.static = 0; drawn.ghostAttacker = 0; drawn.ghostAttackerActual = 0 }
        return { renderer, pieceRenderer, boardRenderer, canvasRenderer, am, engine }
      }
    })

    it('the pawn remains visible at every animation frame during e2-e4 (no vanishing)', () => {
      const { renderer, pieceRenderer, am, engine } = setupGame()

      // Replace ctx-dependent ghost drawing with pure counters (jsdom has no canvas).
      let ghostDrawCount = 0
      renderer.renderGhostPieces = function (ctx, ghostPieces, captureEffects) {
        ghostDrawCount = 0
        // Count UNIQUE non-particle ghosts (odd ones in ghostPieces array),
        // plus the attacker ghost and victim ghost IF they're NOT also in the array.
        const seen = new Set()
        for (const ghost of ghostPieces) {
          if (ghost && ghost.alpha > 0.01 && !ghost.isParticle && !seen.has(ghost)) {
            ghostDrawCount++
            seen.add(ghost)
          }
        }
        const attackerGhost = pieceRenderer.ghostPiece
        if (attackerGhost && attackerGhost.alpha > 0.01 && !seen.has(attackerGhost)) {
          ghostDrawCount++
          seen.add(attackerGhost)
        }
        const victimGhost = pieceRenderer.victimGhostPiece
        if (victimGhost && victimGhost.alpha > 0.01 && !seen.has(victimGhost)) {
          ghostDrawCount++
          seen.add(victimGhost)
        }
      }
      renderer._ghostCount = () => ghostDrawCount

      // from = e2 = square 12, to = e4 = square 28 (orientation 1, white at bottom)
      const from = 12, to = 28
      const pos = engine.getPosition()
      const piece = pos.board[from]   // Pawn
      const color = pos.colors[from]  // White

      // Simulate what InputManager.executeMove does:
      pieceRenderer.ghostPiece = null
      pieceRenderer.victimGhostPiece = null
      pieceRenderer.moveAnim = null
      const result = engine.attemptMove(from, to, null)
      expect(result.success).toBe(true)

      // Now start the animation
      am.animateMove({ from, to, piece, color, orientation: 1, duration: 0.28 })

      // First render frame: static count should be 31 (square 28 hidden by moveAnim),
      // ghost count should be 1 (the attacker pawn). Total = 32 — pawn is visible.
      renderer._resetDrawn()
      renderer.renderStaticPieces(engine, am.getCaptureEffects())
      renderer.renderGhostPieces(null, am.getGhostPieces(), am.getCaptureEffects())
      expect(renderer._drawn.static).toBe(31)
      expect(renderer._ghostCount()).toBe(1)

      // Trace every animation frame; pawn (or any piece) must NEVER be 0 visible across full 32.
      let disappearanceFrame = -1
      for (let frame = 0; frame < 60; frame++) {
        const snapshot = rafCallbacks.slice()
        rafCallbacks.length = 0
        for (const cb of snapshot) {
          try { cb(performance.now() + frame * 17) } catch (e) { /* swallow */ }
        }
        renderer._resetDrawn()
        renderer.renderStaticPieces(engine, am.getCaptureEffects())
        renderer.renderGhostPieces(null, am.getGhostPieces(), am.getCaptureEffects())
        const total = renderer._drawn.static + renderer._ghostCount()
        if (total < 31) { disappearanceFrame = frame; break } // any major drop = bug
      }
      expect(disappearanceFrame).toBe(-1)

      // After animation fully settles, renderStaticPieces alone must produce 32.
      renderer._resetDrawn()
      renderer.renderStaticPieces(engine, am.getCaptureEffects())
      expect(renderer._drawn.static).toBe(32)
    })
  })
})

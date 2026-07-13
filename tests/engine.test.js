import { describe, it, expect, beforeEach } from 'vitest'
import { ChessEngine } from '../src/core/ChessEngine.js'
import { Piece, Color, Square, START_FEN, algebraicToSquare, squareToAlgebraic, makeMove, getMoveFrom, getMoveTo, getMovePromotion } from '../src/core/ChessTypes.js'

describe('ChessEngine', () => {
  let engine

  beforeEach(() => {
    engine = new ChessEngine()
  })

  it('initializes with starting position', () => {
    const pos = engine.getPosition()
    expect(pos.board[algebraicToSquare('e1')]).toBe(Piece.KING)
    expect(pos.colors[algebraicToSquare('e1')]).toBe(Color.WHITE)
    expect(pos.board[algebraicToSquare('e8')]).toBe(Piece.KING)
    expect(pos.colors[algebraicToSquare('e8')]).toBe(Color.BLACK)
    expect(pos.turn).toBe(Color.WHITE)
    expect(pos.castling).toBe('KQkq')
  })

  it('generates legal moves for white', () => {
    const moves = engine.getLegalMoves()
    expect(moves.length).toBeGreaterThan(0)
    const e4 = moves.find(m => getMoveFrom(m) === algebraicToSquare('e2') && getMoveTo(m) === algebraicToSquare('e4'))
    expect(e4).toBeDefined()
  })

  it('makes a simple move', () => {
    const result = engine.attemptMove('e2', 'e4')
    expect(result.success).toBe(true)
    const pos = engine.getPosition()
    expect(pos.board[algebraicToSquare('e4')]).toBe(Piece.PAWN)
    expect(pos.board[algebraicToSquare('e2')]).toBe(Piece.NONE)
    expect(pos.turn).toBe(Color.BLACK)
  })

  it('handles pawn promotion', () => {
    engine.init('8/P7/8/8/8/8/8/k6K w - - 0 1')
    const result = engine.attemptMove('a7', 'a8')
    expect(result.promotion).toBe(true)
  })

  it('detects checkmate', () => {
    engine.init('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    engine.attemptMove('g2', 'g3')
    engine.attemptMove('h4', 'h3')
    // This is Fool's mate for white - black delivers mate
  })

  it('undoes moves correctly', () => {
    engine.attemptMove('e2', 'e4')
    engine.attemptMove('e7', 'e5')
    expect(engine.getHistory().length).toBe(2)
    engine.undo()
    expect(engine.getTurn()).toBe(Color.BLACK)
    engine.undo()
    expect(engine.getTurn()).toBe(Color.WHITE)
    expect(engine.getHistory().length).toBe(0)
  })

  it('generates correct FEN', () => {
    const fen = engine.getFEN()
    expect(fen).toBe(START_FEN)
  })

  it('flips board orientation', () => {
    const orientation1 = engine.orientation
    engine.flip()
    expect(engine.orientation).not.toBe(orientation1)
    engine.flip()
    expect(engine.orientation).toBe(orientation1)
  })

  it('pauses and resumes engine', () => {
    engine.setPaused(true)
    const result = engine.attemptMove('e2', 'e4')
    expect(result.success).toBe(false)
    expect(result.reason).toBe('paused')
    engine.setPaused(false)
    const result2 = engine.attemptMove('e2', 'e4')
    expect(result2.success).toBe(true)
  })
})

describe('Move encoding', () => {
  it('encodes and decodes moves correctly', () => {
    const move = makeMove(algebraicToSquare('e2'), algebraicToSquare('e4'))
    expect(getMoveFrom(move)).toBe(algebraicToSquare('e2'))
    expect(getMoveTo(move)).toBe(algebraicToSquare('e4'))
  })

  it('encodes promotion moves', () => {
    const move = makeMove(algebraicToSquare('a7'), algebraicToSquare('a8'), 0, Piece.QUEEN)
    expect(getMovePromotion(move)).toBe(Piece.QUEEN)
  })
})

describe('Square conversions', () => {
  it('converts algebraic to square and back', () => {
    expect(squareToAlgebraic(algebraicToSquare('e4'))).toBe('e4')
    expect(squareToAlgebraic(algebraicToSquare('a1'))).toBe('a1')
    expect(squareToAlgebraic(algebraicToSquare('h8'))).toBe('h8')
  })
})
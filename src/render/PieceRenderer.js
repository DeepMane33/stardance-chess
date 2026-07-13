import { Piece, Color } from '../core/ChessTypes.js'

const PIECE_SYMBOLS = {
  [Piece.KING]: 'k',
  [Piece.QUEEN]: 'q',
  [Piece.ROOK]: 'r',
  [Piece.BISHOP]: 'b',
  [Piece.KNIGHT]: 'n',
  [Piece.PAWN]: 'p'
}

export class PieceRenderer {
  constructor(canvasRenderer) {
    this.canvasRenderer = canvasRenderer
    this.pieceImages = new Map()
    this.drawScale = 0.92
    this.selectedSquare = null
    this.legalMoves = []
    this.lastMoveSquares = []
    this.checkSquare = null
    this.hoverSquare = null
    this.loadAllPieces()
  }

  loadAllPieces() {
    const pieceTypes = ['k', 'q', 'r', 'b', 'n', 'p']
    const colors = ['w', 'b']

    for (const color of colors) {
      for (const type of pieceTypes) {
        const key = `${color}${type}`
        const img = new Image()
        img.src = `/assets/pieces/${key}.png`
        this.pieceImages.set(key, img)
      }
    }
  }

  setSelectedSquare(sq) { this.selectedSquare = sq }
  setLegalMoves(moves) { this.legalMoves = moves }
  setLastMove(from, to) { this.lastMoveSquares = [from, to] }
  setCheck(sq) { this.checkSquare = sq }
  setHover(sq) { this.hoverSquare = sq }

  render(engine, orientation = 1) {
    const position = engine.getPosition()
    const { board, colors } = position
    const { ctx, squareSize, boardOffsetX, boardOffsetY } = this.canvasRenderer

    const pieceSize = squareSize * this.drawScale
    const offset = (squareSize - pieceSize) / 2

    for (let sq = 0; sq < 64; sq++) {
      const piece = board[sq]
      const color = colors[sq]
      if (piece === Piece.NONE) continue

      const { file, rank } = this.canvasRenderer.squareToCoord(sq, orientation)
      const x = boardOffsetX + file * squareSize + offset
      const y = boardOffsetY + rank * squareSize + offset

      this.drawPiece(ctx, piece, color, x, y, pieceSize)
    }
  }

  drawPiece(ctx, piece, color, x, y, size) {
    const symbol = PIECE_SYMBOLS[piece]
    if (!symbol) return

    const colorPrefix = color === Color.WHITE ? 'w' : 'b'
    const key = `${colorPrefix}${symbol}`
    const img = this.pieceImages.get(key)

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, size, size)
    } else {
      this.drawFallbackPiece(ctx, piece, color, x, y, size)
    }
  }

  drawFallbackPiece(ctx, piece, color, x, y, size) {
    const cx = x + size / 2
    const cy = y + size / 2
    const isWhite = color === Color.WHITE

    ctx.beginPath()
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = isWhite ? '#ffffff' : '#333333'
    ctx.fill()
    ctx.strokeStyle = isWhite ? '#333333' : '#000000'
    ctx.lineWidth = size * 0.03
    ctx.stroke()

    ctx.font = `bold ${size * 0.55}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isWhite ? '#333333' : '#ffffff'

    const symbols = {
      [Piece.KING]: 'K',
      [Piece.QUEEN]: 'Q',
      [Piece.ROOK]: 'R',
      [Piece.BISHOP]: 'B',
      [Piece.KNIGHT]: 'N',
      [Piece.PAWN]: 'P'
    }

    ctx.fillText(symbols[piece] || '?', cx, cy + size * 0.02)
  }
}

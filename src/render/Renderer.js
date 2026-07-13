import { CanvasRenderer } from './CanvasRenderer.js'
import { BoardRenderer } from './BoardRenderer.js'
import { PieceRenderer } from './PieceRenderer.js'

export class Renderer {
  constructor(ctx, width, height) {
    this.canvasRenderer = new CanvasRenderer(ctx, width, height)
    this.boardRenderer = new BoardRenderer(this.canvasRenderer)
    this.pieceRenderer = new PieceRenderer(this.canvasRenderer)
  }

  resize(width, height) {
    this.canvasRenderer.resize(width, height)
  }

  render(engine) {
    const ctx = this.canvasRenderer.ctx
    this.canvasRenderer.clear()
    this.boardRenderer.render(ctx)
    this.pieceRenderer.render(engine, this.boardRenderer.boardAppearance.orientation)
  }

  getSquareFromPoint(x, y) {
    const { boardOffsetX, boardOffsetY, squareSize } = this.canvasRenderer
    if (x < boardOffsetX || x > boardOffsetX + 8 * squareSize ||
        y < boardOffsetY || y > boardOffsetY + 8 * squareSize) return -1
    const file = Math.floor((x - boardOffsetX) / squareSize)
    const rank = Math.floor((y - boardOffsetY) / squareSize)
    return this.canvasRenderer.coordToSquare(file, rank, this.boardRenderer.boardAppearance.orientation)
  }

  flip() {
    this.boardRenderer.flip()
  }
}

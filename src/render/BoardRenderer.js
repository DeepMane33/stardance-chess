export class BoardRenderer {
  constructor(canvasRenderer) {
    this.renderer = canvasRenderer
    this.boardAppearance = {
      orientation: 1
    }
    this.lightColor = '#f0d9b5'
    this.darkColor = '#b58863'
    this.lastMoveFrom = -1
    this.lastMoveTo = -1
    this.selectedSquare = -1
    this.legalMoves = []
    this.checkSquare = -1
    this.hoverSquare = -1
    this.captureHighlight = { from: -1, to: -1, fromAlpha: 0, toAlpha: 0, active: false }
  }

  setLastMove(from, to) {
    this.lastMoveFrom = from
    this.lastMoveTo = to
  }

  triggerCaptureHighlight(from, to) {
    this.captureHighlight = { from, to, fromAlpha: 1, toAlpha: 1, active: true }
  }

  updateCaptureHighlight(fromAlpha, toAlpha) {
    this.captureHighlight.fromAlpha = fromAlpha
    this.captureHighlight.toAlpha = toAlpha
  }

  clearCaptureHighlight() {
    this.captureHighlight.active = false
    this.captureHighlight.fromAlpha = 0
    this.captureHighlight.toAlpha = 0
  }

  setSelected(sq) { this.selectedSquare = sq }
  setLegalMoves(moves) { this.legalMoves = moves }
  setCheck(sq) { this.checkSquare = sq }
  setHover(sq) { this.hoverSquare = sq }

  render(ctx) {
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer
    const orientation = this.boardAppearance.orientation

    // Draw board background
    ctx.fillStyle = '#262522'
    ctx.fillRect(0, 0, this.renderer.width, this.renderer.height)

    // Draw squares
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (file + rank) % 2 === 0
        const x = boardOffsetX + file * squareSize
        const y = boardOffsetY + rank * squareSize

        ctx.fillStyle = isLight ? this.lightColor : this.darkColor
        ctx.fillRect(x, y, squareSize, squareSize)
      }
    }

    // Draw capture highlight (SOLID GREEN RECTANGLES) - takes priority
    if (this.captureHighlight.active && (this.captureHighlight.fromAlpha > 0 || this.captureHighlight.toAlpha > 0)) {
      this.drawSolidGreenSquare(ctx, this.captureHighlight.from, this.captureHighlight.fromAlpha, orientation)
      this.drawSolidGreenSquare(ctx, this.captureHighlight.to, this.captureHighlight.toAlpha, orientation)
    } else {
      // Draw last move highlight (yellow)
      this.drawSquareHighlight(ctx, this.lastMoveFrom, 'rgba(255, 255, 0, 0.4)', orientation)
      this.drawSquareHighlight(ctx, this.lastMoveTo, 'rgba(255, 255, 0, 0.4)', orientation)
    }

    // Draw selected square highlight
    if (this.selectedSquare >= 0) {
      this.drawSquareHighlight(ctx, this.selectedSquare, 'rgba(20, 85, 30, 0.5)', orientation)
    }

    // Draw hover highlight
    if (this.hoverSquare >= 0 && this.hoverSquare !== this.selectedSquare) {
      this.drawSquareHighlight(ctx, this.hoverSquare, 'rgba(0, 0, 0, 0.08)', orientation)
    }

    // Draw check highlight
    if (this.checkSquare >= 0) {
      this.drawCheckHighlight(ctx, this.checkSquare, orientation)
    }

    // Draw legal move indicators
    for (const move of this.legalMoves) {
      this.drawLegalMoveIndicator(ctx, move.to, orientation)
    }

    // Draw coordinates
    this.drawCoordinates(ctx, orientation)
  }

  drawSolidGreenSquare(ctx, square, alpha, orientation) {
    if (square < 0) return
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer
    const { file, rank } = this.renderer.squareToCoord(square, orientation)

    // Solid bright green rectangle covering the full square
    ctx.fillStyle = `rgba(0, 220, 50, ${alpha * 0.65})`
    ctx.fillRect(
      boardOffsetX + file * squareSize,
      boardOffsetY + rank * squareSize,
      squareSize,
      squareSize
    )
  }

  drawSquareHighlight(ctx, square, color, orientation) {
    if (square < 0) return
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer
    const { file, rank } = this.renderer.squareToCoord(square, orientation)

    ctx.fillStyle = color
    ctx.fillRect(
      boardOffsetX + file * squareSize,
      boardOffsetY + rank * squareSize,
      squareSize,
      squareSize
    )
  }

  drawCheckHighlight(ctx, square, orientation) {
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer
    const { file, rank } = this.renderer.squareToCoord(square, orientation)
    const x = boardOffsetX + file * squareSize
    const y = boardOffsetY + rank * squareSize

    const gradient = ctx.createRadialGradient(
      x + squareSize / 2, y + squareSize / 2, 0,
      x + squareSize / 2, y + squareSize / 2, squareSize * 0.7
    )
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(x, y, squareSize, squareSize)
  }

  drawLegalMoveIndicator(ctx, square, orientation) {
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer
    const { file, rank } = this.renderer.squareToCoord(square, orientation)
    const cx = boardOffsetX + file * squareSize + squareSize / 2
    const cy = boardOffsetY + rank * squareSize + squareSize / 2

    const isCapture = this.isSquareOccupied(square)

    if (isCapture) {
      const cornerSize = squareSize * 0.25
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'

      ctx.beginPath()
      ctx.moveTo(boardOffsetX + file * squareSize, boardOffsetY + rank * squareSize)
      ctx.lineTo(boardOffsetX + file * squareSize + cornerSize, boardOffsetY + rank * squareSize)
      ctx.lineTo(boardOffsetX + file * squareSize, boardOffsetY + rank * squareSize + cornerSize)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(boardOffsetX + (file + 1) * squareSize, boardOffsetY + rank * squareSize)
      ctx.lineTo(boardOffsetX + (file + 1) * squareSize - cornerSize, boardOffsetY + rank * squareSize)
      ctx.lineTo(boardOffsetX + (file + 1) * squareSize, boardOffsetY + rank * squareSize + cornerSize)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(boardOffsetX + file * squareSize, boardOffsetY + (rank + 1) * squareSize)
      ctx.lineTo(boardOffsetX + file * squareSize + cornerSize, boardOffsetY + (rank + 1) * squareSize)
      ctx.lineTo(boardOffsetX + file * squareSize, boardOffsetY + (rank + 1) * squareSize - cornerSize)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(boardOffsetX + (file + 1) * squareSize, boardOffsetY + (rank + 1) * squareSize)
      ctx.lineTo(boardOffsetX + (file + 1) * squareSize - cornerSize, boardOffsetY + (rank + 1) * squareSize)
      ctx.lineTo(boardOffsetX + (file + 1) * squareSize, boardOffsetY + (rank + 1) * squareSize - cornerSize)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.beginPath()
      ctx.arc(cx, cy, squareSize * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  isSquareOccupied(square) {
    if (!this._position) return false
    return this._position.board[square] !== 0
  }

  setPosition(position) {
    this._position = position
  }

  drawCoordinates(ctx, orientation) {
    const { squareSize, boardOffsetX, boardOffsetY } = this.renderer

    ctx.font = `bold ${squareSize * 0.18}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < 8; i++) {
      const fileChar = String.fromCharCode(97 + i)
      const rankChar = String(8 - i)

      const fileX = boardOffsetX + i * squareSize + squareSize * 0.88
      const fileY = boardOffsetY + 8 * squareSize - squareSize * 0.12
      ctx.fillStyle = (i % 2 === 0) ? this.darkColor : this.lightColor
      ctx.fillText(orientation === -1 ? String.fromCharCode(104 - i) : fileChar, fileX, fileY)

      const rankX = boardOffsetX + squareSize * 0.12
      const rankY = boardOffsetY + i * squareSize + squareSize * 0.12
      ctx.fillStyle = (i % 2 === 0) ? this.lightColor : this.darkColor
      ctx.fillText(orientation === -1 ? String(i + 1) : rankChar, rankX, rankY)
    }
  }

  flip() {
    this.boardAppearance.orientation = this.boardAppearance.orientation === 1 ? -1 : 1
  }
}

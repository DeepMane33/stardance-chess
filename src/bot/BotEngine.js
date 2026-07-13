const PIECE_VALUES = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
}

const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ],
  k_end: [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50
  ]
}

const DIFFICULTY_CONFIG = {
  beginner:     { depth: 1, randomFactor: 0.3, name: 'Beginner' },
  intermediate: { depth: 2, randomFactor: 0.1, name: 'Intermediate' },
  advanced:     { depth: 3, randomFactor: 0.05, name: 'Advanced' },
  expert:       { depth: 4, randomFactor: 0, name: 'Expert' }
}

function isEndgame(chess) {
  let queens = 0, minorPieces = 0
  const board = chess.board()
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue
      if (cell.type === 'q') queens++
      if (cell.type === 'n' || cell.type === 'b') minorPieces++
    }
  }
  return queens === 0 || (queens <= 2 && minorPieces <= 2)
}

function evaluateBoard(chess) {
  const board = chess.board()
  let score = 0
  const endgame = isEndgame(chess)

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const cell = board[rank][file]
      if (!cell) continue

      const piece = cell.type
      const color = cell.color
      const sign = color === 'w' ? 1 : -1
      const pstIndex = color === 'w' ? (7 - rank) * 8 + file : rank * 8 + file

      let value = PIECE_VALUES[piece]
      if (piece === 'k' && endgame) {
        value = PIECE_VALUES.k
        score += sign * (value + PST.k_end[pstIndex])
      } else {
        score += sign * (value + (PST[piece]?.[pstIndex] || 0))
      }
    }
  }

  if (chess.turn() === 'w') return score
  return -score
}

function orderMoves(chess) {
  const moves = chess.moves({ verbose: true })
  return moves.sort((a, b) => {
    let scoreA = 0, scoreB = 0
    if (a.captured) scoreA += PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] / 10
    if (b.captured) scoreB += PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] / 10
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion]
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion]
    if (a.san.includes('+')) scoreA += 50
    if (b.san.includes('+')) scoreB += 50
    return scoreB - scoreA
  })
}

function minimax(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.isGameOver()) {
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return maximizing ? -100000 + (4 - depth) * 100 : 100000 - (4 - depth) * 100
      return 0
    }
    return evaluateBoard(chess)
  }

  const moves = orderMoves(chess)

  if (maximizing) {
    let maxEval = -Infinity
    for (const move of moves) {
      chess.move(move)
      const eval_ = minimax(chess, depth - 1, alpha, beta, false)
      chess.undo()
      maxEval = Math.max(maxEval, eval_)
      alpha = Math.max(alpha, eval_)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of moves) {
      chess.move(move)
      const eval_ = minimax(chess, depth - 1, alpha, beta, true)
      chess.undo()
      minEval = Math.min(minEval, eval_)
      beta = Math.min(beta, eval_)
      if (beta <= alpha) break
    }
    return minEval
  }
}

export class BotEngine {
  constructor(difficulty = 'intermediate') {
    this.setDifficulty(difficulty)
    this.thinking = false
  }

  setDifficulty(difficulty) {
    this.config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.intermediate
    this.difficulty = difficulty
  }

  getBestMove(chess) {
    const moves = chess.moves({ verbose: true })
    if (moves.length === 0) return null

    const maximizing = chess.turn() === 'w'
    const scoredMoves = []

    for (const move of moves) {
      chess.move(move)
      let score = minimax(chess, this.config.depth - 1, -Infinity, Infinity, !maximizing)
      chess.undo()

      if (this.config.randomFactor > 0) {
        score += (Math.random() - 0.5) * this.config.randomFactor * 200
      }

      scoredMoves.push({ move, score })
    }

    scoredMoves.sort((a, b) => maximizing ? b.score - a.score : a.score - b.score)
    return scoredMoves[0].move
  }

  async getBestMoveAsync(chess) {
    this.thinking = true
    const result = await new Promise(resolve => {
      setTimeout(() => {
        const move = this.getBestMove(chess)
        resolve(move)
      }, 50)
    })
    this.thinking = false
    return result
  }
}

export { DIFFICULTY_CONFIG }

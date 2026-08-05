import { Chess } from 'chess.js'

export class FallbackBot {
  constructor() {
    this.chess = null
  }

  async init() {
    this.chess = new Chess()
    return Promise.resolve()
  }

  sendCommand() {}

  setSkillLevel(elo) {
    return { skill: Math.min(20, Math.max(0, Math.floor(elo / 100))) }
  }

  async getBestMove(fen, elo = 800) {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          this.chess.load(fen)
          const moves = this.chess.moves({ verbose: true })
          if (moves.length === 0) {
            resolve(null)
            return
          }

          const move = moves[Math.floor(Math.random() * moves.length)]
          resolve(move.from + move.to + (move.promotion || ''))
        } catch (e) {
          console.error('[FallbackBot] Error generating move:', e)
          resolve(null)
        }
      }, 200 + Math.random() * 300)
    })
  }

  stop() {}
  destroy() {}
}

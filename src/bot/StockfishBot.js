const ELO_TO_SKILL = [
  { minElo: 0,    skill: 0,  depth: 1,  movetime: 800  },
  { minElo: 200,  skill: 1,  depth: 1,  movetime: 900  },
  { minElo: 400,  skill: 2,  depth: 2,  movetime: 1000 },
  { minElo: 500,  skill: 3,  depth: 2,  movetime: 1000 },
  { minElo: 600,  skill: 4,  depth: 3,  movetime: 1100 },
  { minElo: 700,  skill: 5,  depth: 3,  movetime: 1100 },
  { minElo: 800,  skill: 6,  depth: 4,  movetime: 1200 },
  { minElo: 900,  skill: 7,  depth: 4,  movetime: 1200 },
  { minElo: 1000, skill: 8,  depth: 5,  movetime: 1300 },
  { minElo: 1100, skill: 9,  depth: 5,  movetime: 1300 },
  { minElo: 1200, skill: 10, depth: 6,  movetime: 1400 },
  { minElo: 1300, skill: 11, depth: 6,  movetime: 1400 },
  { minElo: 1400, skill: 12, depth: 7,  movetime: 1500 },
  { minElo: 1500, skill: 13, depth: 8,  movetime: 1600 },
  { minElo: 1600, skill: 14, depth: 9,  movetime: 1700 },
  { minElo: 1700, skill: 15, depth: 10, movetime: 1800 },
  { minElo: 1800, skill: 16, depth: 11, movetime: 1900 },
  { minElo: 1900, skill: 17, depth: 12, movetime: 2000 },
  { minElo: 2000, skill: 18, depth: 14, movetime: 2200 },
  { minElo: 2100, skill: 19, depth: 16, movetime: 2400 },
  { minElo: 2200, skill: 20, depth: 18, movetime: 2600 },
  { minElo: 2400, skill: 20, depth: 20, movetime: 3000 }
]

function getSkillConfig(elo) {
  let config = ELO_TO_SKILL[0]
  for (const level of ELO_TO_SKILL) {
    if (elo >= level.minElo) config = level
  }
  return config
}

export class StockfishBot {
  constructor() {
    this.worker = null
    this.ready = false
    this.readyPromise = null
    this.pendingResolve = null
  }

  async init() {
    this.worker = new Worker('/stockfish.js')

    this.readyPromise = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        const msg = typeof e.data === 'string' ? e.data : ''
        if (msg === 'uciok') {
          this.ready = true
          resolve()
        }
        if (this.pendingResolve && msg.startsWith('bestmove')) {
          const moveStr = msg.split(' ')[1]
          this.pendingResolve(moveStr)
          this.pendingResolve = null
        }
      }
    })

    this.worker.postMessage('uci')
    await this.readyPromise
    this.worker.postMessage('isready')
  }

  setSkillLevel(elo) {
    const config = getSkillConfig(elo)
    this.worker.postMessage(`setoption name Skill Level value ${config.skill}`)
    return config
  }

  async getBestMove(fen, elo = 1200) {
    if (!this.ready) await this.readyPromise

    const config = this.setSkillLevel(elo)
    const jitter = Math.floor((Math.random() - 0.5) * 400)
    const movetime = Math.max(500, config.movetime + jitter)

    return new Promise((resolve) => {
      this.pendingResolve = resolve
      this.worker.postMessage(`position fen ${fen}`)
      this.worker.postMessage(`go movetime ${movetime}`)
    })
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage('stop')
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.postMessage('quit')
      this.worker.terminate()
      this.worker = null
    }
  }
}

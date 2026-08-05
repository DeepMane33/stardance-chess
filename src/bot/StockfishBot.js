const ELO_TO_SKILL = [
  { minElo: 0,    skill: 0,  depth: 1,  movetime: 500  },
  { minElo: 200,  skill: 1,  depth: 1,  movetime: 600  },
  { minElo: 400,  skill: 2,  depth: 2,  movetime: 700  },
  { minElo: 500,  skill: 3,  depth: 2,  movetime: 700  },
  { minElo: 600,  skill: 4,  depth: 3,  movetime: 800  },
  { minElo: 700,  skill: 5,  depth: 3,  movetime: 800  },
  { minElo: 800,  skill: 6,  depth: 4,  movetime: 900  },
  { minElo: 900,  skill: 7,  depth: 4,  movetime: 900  },
  { minElo: 1000, skill: 8,  depth: 5,  movetime: 1000 },
  { minElo: 1100, skill: 9,  depth: 5,  movetime: 1000 },
  { minElo: 1200, skill: 10, depth: 6,  movetime: 1100 },
  { minElo: 1300, skill: 11, depth: 6,  movetime: 1100 },
  { minElo: 1400, skill: 12, depth: 7,  movetime: 1200 },
  { minElo: 1500, skill: 13, depth: 8,  movetime: 1300 },
  { minElo: 1600, skill: 14, depth: 9,  movetime: 1400 },
  { minElo: 1700, skill: 15, depth: 10, movetime: 1500 },
  { minElo: 1800, skill: 16, depth: 11, movetime: 1600 },
  { minElo: 1900, skill: 17, depth: 12, movetime: 1700 },
  { minElo: 2000, skill: 18, depth: 14, movetime: 1800 },
  { minElo: 2100, skill: 19, depth: 16, movetime: 2000 },
  { minElo: 2200, skill: 20, depth: 18, movetime: 2200 },
  { minElo: 2400, skill: 20, depth: 20, movetime: 2500 }
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
    this.pendingResolve = null
    this.onMessageHandler = null
    this.commandQueue = []
    this.moveRequestId = 0
    this.initPromise = null
    this.workerError = null
  }

  async init() {
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      this.worker = new Worker('/stockfish-worker.js')

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.workerError = new Error('Stockfish worker init timeout (10s)')
          reject(this.workerError)
        }, 10000)

        let gotUciOk = false

        this.worker.onmessage = (e) => {
          const msg = e.data
          if (typeof msg !== 'string') return
          if (msg === 'uciok') {
            gotUciOk = true
            this.worker.postMessage('isready')
          } else if (msg === 'readyok' && gotUciOk) {
            clearTimeout(timeout)
            this.ready = true
            this.workerError = null
            // Process queued commands
            this.commandQueue.forEach(cmd => this.worker.postMessage(cmd))
            this.commandQueue = []
            console.log('[Stockfish] Initialized successfully')
            resolve()
          } else if (msg.startsWith('bestmove')) {
            if (this.pendingResolve) {
              const moveStr = msg.split(' ')[1]
              this.pendingResolve(moveStr)
              this.pendingResolve = null
            }
          } else if (this.onMessageHandler) {
            this.onMessageHandler(msg)
          }
        }

        this.worker.onerror = (err) => {
          clearTimeout(timeout)
          this.workerError = err
          this.ready = false
          console.error('[Stockfish] Worker error:', err)
          reject(err)
        }

        this.worker.postMessage('uci')
      })
    })()

    return this.initPromise
  }

  sendCommand(cmd) {
    if (this.workerError) {
      console.warn('[Stockfish] Worker has error, cannot send command:', cmd)
      return
    }
    if (this.ready) {
      this.worker.postMessage(cmd)
    } else {
      this.commandQueue.push(cmd)
    }
  }

  setSkillLevel(elo) {
    const config = getSkillConfig(elo)
    this.sendCommand(`setoption name Skill Level value ${config.skill}`)
    return config
  }

  async getBestMove(fen, elo = 1200) {
    // Check if worker is healthy
    if (this.workerError || !this.worker) {
      console.error('[Stockfish] Worker not available, attempting re-init...')
      try {
        this.workerError = null
        await this.init()
      } catch (e) {
        console.error('[Stockfish] Re-init failed:', e)
        return null
      }
    }

    if (!this.ready) {
      try {
        await this.init()
      } catch (e) {
        console.error('[Stockfish] Init failed:', e)
        return null
      }
    }

    const config = this.setSkillLevel(elo)
    const jitter = Math.floor((Math.random() - 0.5) * 200)
    const movetime = Math.max(300, config.movetime + jitter)

    return new Promise((resolve) => {
      const requestId = ++this.moveRequestId
      let resolved = false

      this.pendingResolve = (val) => {
        if (resolved) return
        if (requestId === this.moveRequestId) {
          resolved = true
          this.pendingResolve = null
          resolve(val)
        }
      }

      this.sendCommand(`position fen ${fen}`)
      this.sendCommand(`go movetime ${movetime}`)

      // Shorter timeout with fallback
      const timeout = setTimeout(() => {
        if (!resolved && this.pendingResolve && requestId === this.moveRequestId) {
          console.warn('[Stockfish] Move timeout, stopping and returning null')
          this.stop()
          this.pendingResolve = null
          resolved = true
          resolve(null)
        }
      }, Math.max(2000, movetime + 1500))
    })
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage('stop')
    }
  }

  destroy() {
    if (this.pendingResolve) {
      this.pendingResolve(null)
      this.pendingResolve = null
    }
    if (this.worker) {
      this.worker.postMessage('quit')
      this.worker.terminate()
      this.worker = null
    }
    this.ready = false
    this.initPromise = null
  }
}
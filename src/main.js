import { ChessEngine } from './core/ChessEngine.js'
import { Renderer } from './render/Renderer.js'
import { InputManager } from './input/InputManager.js'
import { AudioManager } from './audio/AudioManager.js'
import { UIManager } from './ui/UIManager.js'
import { StockfishBot } from './bot/StockfishBot.js'
import { EloSystem } from './core/EloSystem.js'
import { MatchHistory } from './core/MatchHistory.js'
import { ChessClock } from './core/ChessClock.js'

const DIFFICULTY_NAMES = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert'
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas')
    if (!this.canvas) throw new Error('Canvas element not found!')
    this.ctx = this.canvas.getContext('2d', { alpha: false })
    this.running = false
    this.engine = null
    this.renderer = null
    this.input = null
    this.audio = null
    this.ui = null
    this.bot = null
    this.elo = null
    this.matchHistory = null
    this.clock = null
    this.timeControl = 0
    this.selectedTimeControl = 0
    this.pendingDifficulty = null

    this.gameMode = null
    this.botDifficulty = null
    this.playerColor = 1
    this.botThinking = false
    this.gameActive = false
  }

  async init() {
    this.ui = new UIManager()
    this.elo = new EloSystem()
    this.matchHistory = new MatchHistory()
    this.clock = new ChessClock()
    this.audio = new AudioManager()
    this.bot = new StockfishBot()

    this.resize()
    window.addEventListener('resize', () => this.resize())

    this.engine = new ChessEngine()
    this.renderer = new Renderer(this.ctx, window.innerWidth, window.innerHeight)
    this.input = new InputManager(this.canvas, this.engine, this.renderer)

    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)

    this.engine.on('position', (pos) => {
      this.renderer.boardRenderer.setPosition(pos)
    })

    this.engine.on('move', () => this.audio.playMove())
    this.engine.on('capture', () => {
      this.audio.playCapture()
      this.flashCapture()
    })
    this.engine.on('check', () => this.audio.playCheck())
    this.engine.on('gameover', () => this.audio.playGameOver())

    const initAudioOnClick = async () => {
      await this.audio.init()
      this.canvas.removeEventListener('click', initAudioOnClick)
    }
    this.canvas.addEventListener('click', initAudioOnClick, { once: true })

    this.ui.showLoading(30, 'Loading Stockfish...')
    await this.bot.init()

    this.setupUIEvents()
    this.setupInputEvents()
    this.checkUrlParams()

    this.ui.showLoading(100, 'Ready!')
    await new Promise(r => setTimeout(r, 300))
    this.ui.hideLoading()

    this.updateMenuElo()
    this.ui.showScreen('mainMenu')

    this.running = true
    requestAnimationFrame((t) => this.loop(t))
  }

  setupUIEvents() {
    this.ui.on('play', () => this.ui.showScreen('modeSelect'))
    this.ui.on('back-to-menu', () => this.ui.showScreen('mainMenu'))
    this.ui.on('back-to-mode-select', () => this.ui.showScreen('modeSelect'))

    this.ui.on('select-bot', () => this.ui.showScreen('botDifficulty'))
    this.ui.on('select-friend', () => {
      this.pendingDifficulty = null
      this.ui.showScreen('timeControl')
    })

    this.ui.on('open-history', () => {
      this.showHistory()
      this.ui.showScreen('history')
    })
    this.ui.on('close-history', () => this.ui.showScreen('mainMenu'))

    this.ui.on('open-history', () => {
      this.showHistory()
      this.ui.showScreen('history')
    })
    this.ui.on('close-history', () => this.ui.showScreen('mainMenu'))

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const filter = btn.dataset.filter
        this.showHistory(filter === 'all' ? null : filter)
      })
    })

    document.getElementById('history-list')?.addEventListener('click', (e) => {
      const replayBtn = e.target.closest('[data-replay-id]')
      if (replayBtn) {
        const match = this.matchHistory.getMatch(replayBtn.dataset.replayId)
        if (match && match.moves && match.moves.length > 0) {
          this.startReplay(match)
        }
      }
    })

    this.ui.on('replay-start', () => this.replayGoStart())
    this.ui.on('replay-back', () => this.replayStep(-1))
    this.ui.on('replay-play', () => this.replayTogglePlay())
    this.ui.on('replay-forward', () => this.replayStep(1))
    this.ui.on('replay-end', () => this.replayGoEnd())
    this.ui.on('replay-exit', () => this.exitReplay())

    this.ui.on('select-difficulty', (el) => {
      this.pendingDifficulty = el.dataset.difficulty
      this.ui.showScreen('timeControl')
    })

    this.ui.on('select-time', (el) => {
      const seconds = parseInt(el.dataset.time)
      this.timeControl = seconds
      this.startGame(this.pendingDifficulty !== null ? 'bot' : 'friend', this.pendingDifficulty, seconds)
    })

    this.ui.on('back-to-time-control', () => this.ui.showScreen('timeControl'))

    this.ui.on('toggle-sound', () => {
      const enabled = !this.audio.enabled
      this.audio.setEnabled(enabled)
      const btn = document.querySelector('[data-action="toggle-sound"]')
      if (btn) btn.style.opacity = enabled ? '1' : '0.4'
    })

    this.ui.on('flip-board', () => {
      this.renderer.flip()
      this.engine.flip()
    })

    this.ui.on('undo-move', () => {
      if (this.botThinking) return
      if (this.gameMode === 'bot' && this.engine.getHistory().length < 2) return

      if (this.gameMode === 'bot') {
        this.engine.undo()
        this.engine.undo()
      } else {
        this.engine.undo()
      }

      const pos = this.engine.getPosition()
      this.renderer.boardRenderer.setPosition(pos)
      this.renderer.boardRenderer.setLastMove(-1, -1)
      this.renderer.pieceRenderer.setLastMove(-1, -1)
      this.renderer.boardRenderer.setCheck(-1)
      this.renderer.pieceRenderer.setCheck(null)
      this.input.clearSelection()
      this.updateHUD()
    })

    this.ui.on('toggle-moves', () => {
      const panel = document.querySelector('.move-list-panel')
      if (panel) panel.classList.toggle('visible')
    })

    this.ui.on('share-game', () => {
      const fen = this.engine.getFEN()
      this.ui.showShare(fen)
    })

    this.ui.on('copy-share-url', () => {
      const input = document.querySelector('.share-url')
      if (input) {
        navigator.clipboard.writeText(input.value).then(() => {
          this.ui.showCopied()
        }).catch(() => {
          input.select()
          document.execCommand('copy')
          this.ui.showCopied()
        })
      }
    })

    this.ui.on('close-share', () => this.ui.hideShare())

    this.ui.on('resign-game', () => {
      if (!this.gameActive) return
      const winner = this.playerColor === 1 ? 'black' : 'white'
      this.endGame({ result: 'resignation', winner })
    })

    this.ui.on('back-to-menu-game', () => {
      if (this.replayState) {
        this.exitReplay()
        return
      }
      this.clock.stop()
      this.gameActive = false
      this.input.setInputEnabled(false)
      this.ui.hideScreen('gameHud')
      this.ui.showScreen('mainMenu')
    })

    this.ui.on('back-to-menu-gameover', () => {
      this.clock.stop()
      this.ui.hideGameOver()
      this.ui.hideScreen('gameHud')
      this.ui.showScreen('mainMenu')
      this.updateMenuElo()
    })

    this.ui.on('rematch', () => {
      this.ui.hideGameOver()
      this.startGame(this.gameMode, this.botDifficulty, this.timeControl)
    })
  }

  setupInputEvents() {
    this.input.on('move', () => {
      this.updateHUD()
      this.updateMoveList()

      if (this.timeControl > 0) {
        const side = this.engine.getTurn() === 1 ? 'white' : 'black'
        this.clock.switchSide(side)
        this.updateClockDisplay(side)
      }

      if (this.engine.getGameOver()) {
        this.clock.stop()
        this.endGame(this.engine.getGameOver())
        return
      }

      if (this.gameMode === 'bot' && this.engine.getTurn() !== this.playerColor) {
        this.makeBotMove()
      }
    })

    this.input.on('promotion', () => {
      const color = this.engine.getTurn()
      const prefix = color === 1 ? 'w' : 'b'

      const modal = document.getElementById('promotion-modal')
      if (modal) {
        modal.querySelectorAll('.promotion-piece').forEach(el => {
          const piece = el.dataset.piece
          el.querySelector('img').src = `/assets/pieces/${prefix}${piece}.png`
        })
      }

      this.ui.showPromotion((pieceChar) => {
        this.input.resolvePromotion(pieceChar)
      })
    })
  }

  startGame(mode, difficulty = null, timeSeconds = 0) {
    this.gameMode = mode
    this.botDifficulty = difficulty
    this.gameActive = true
    this.botThinking = false
    this.timeControl = timeSeconds

    this.engine.init()
    this.input.clearSelection()

    this.clock.dispose()
    this.clock.configure(timeSeconds)
    this.clock.onTick = (display) => this.updateClocks(display)
    this.clock.onFlag = (side) => this.onFlagFall(side)

    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)
    this.renderer.boardRenderer.setLastMove(-1, -1)
    this.renderer.pieceRenderer.setLastMove(-1, -1)
    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)

    if (mode === 'bot') {
      this.playerColor = Math.random() < 0.5 ? 1 : 2
      this.input.setBotMode(true, this.playerColor)

      const playerName = 'You'
      const botName = DIFFICULTY_NAMES[difficulty] || 'Bot'
      const playerRating = this.elo.getRating('bot')

      if (this.playerColor === 1) {
        this.ui.updatePlayerBar('bottom', playerName, playerRating, true)
        this.ui.updatePlayerBar('top', botName, 1200, false)
      } else {
        this.ui.updatePlayerBar('top', playerName, playerRating, true)
        this.ui.updatePlayerBar('bottom', botName, 1200, false)
      }
    } else {
      this.input.setBotMode(false)
      const playerRating = this.elo.getRating('friend')

      this.ui.updatePlayerBar('bottom', 'White', playerRating, true)
      this.ui.updatePlayerBar('top', 'Black', playerRating, false)
    }

    this.ui.showScreen('gameHud')
    this.ui.hideScreen('mainMenu')
    this.ui.hideScreen('modeSelect')
    this.ui.hideScreen('botDifficulty')
    this.ui.hideScreen('timeControl')
    this.ui.clearMoveList()

    this.updateClockDisplay(timeSeconds > 0 ? this.engine.getTurn() === 1 ? 'white' : 'black' : null)
    this.input.setInputEnabled(true)

    if (mode === 'bot' && this.playerColor === 2) {
      this.clock.start('black')
      this.makeBotMove()
    } else if (timeSeconds > 0) {
      this.clock.start(this.engine.getTurn() === 1 ? 'white' : 'black')
    }

    this.resize()
  }

  async makeBotMove() {
    if (this.botThinking || !this.gameActive) return
    if (this.engine.getGameOver()) return

    this.botThinking = true
    this.input.setInputEnabled(false)

    const botPosition = this.playerColor === 1 ? 'top' : 'bottom'
    this.ui.showThinking(botPosition, true)

    try {
      const fen = this.engine.getFEN()
      const elo = this.elo.getRating('bot')
      const moveStr = await this.bot.getBestMove(fen, elo)

      if (!moveStr || moveStr === '(none)' || moveStr === 'none') {
        this.botThinking = false
        this.input.setInputEnabled(true)
        this.ui.showThinking(botPosition, false)
        return
      }

      const from = moveStr.substring(0, 2)
      const to = moveStr.substring(2, 4)
      const promotion = moveStr.length > 4 ? moveStr[4] : null

      const pieceMap = { q: 5, r: 4, b: 3, n: 2 }
      const promoPiece = promotion ? (pieceMap[promotion] || 5) : null

      const result = this.engine.attemptMove(from, to, promoPiece)

      if (result.success) {
        this.input.clearSelection()

        if (result.move) {
          this.renderer.boardRenderer.setLastMove(result.move.from, result.move.to)
          this.renderer.pieceRenderer.setLastMove(result.move.from, result.move.to)

          if (this.engine.isInCheck()) {
            const pos = this.engine.getPosition()
            const kingSq = this.input.findKing(pos, this.engine.getTurn())
            this.renderer.boardRenderer.setCheck(kingSq)
            this.renderer.pieceRenderer.setCheck(kingSq)
          } else {
            this.renderer.boardRenderer.setCheck(-1)
            this.renderer.pieceRenderer.setCheck(null)
          }
        }

        this.updateHUD()
        this.updateMoveList()

        if (this.engine.getGameOver()) {
          this.endGame(this.engine.getGameOver())
        }
      }
    } catch (err) {
      console.error('Bot move error:', err)
    }

    this.ui.showThinking(botPosition, false)
    this.botThinking = false
    this.input.setInputEnabled(true)
  }

  endGame(gameOver) {
    this.gameActive = false
    this.input.setInputEnabled(false)

    let result, winner, title, detail

    if (gameOver.result === 'checkmate') {
      winner = gameOver.winner
      const winnerName = winner === 'white' ? 'White' : 'Black'
      title = 'Checkmate!'
      detail = `${winnerName} wins!`

      if (this.gameMode === 'bot') {
        const playerWon = (winner === 'white' && this.playerColor === 1) ||
                          (winner === 'black' && this.playerColor === 2)
        result = playerWon ? 'win' : 'loss'
      } else {
        result = winner === 'white' ? 'white-win' : 'black-win'
      }
    } else if (gameOver.result === 'resignation') {
      winner = gameOver.winner
      const winnerName = winner === 'white' ? 'White' : 'Black'
      title = 'Resignation'
      detail = `${winnerName} wins by resignation`

      if (this.gameMode === 'bot') {
        const playerWon = (winner === 'white' && this.playerColor === 1) ||
                          (winner === 'black' && this.playerColor === 2)
        result = playerWon ? 'win' : 'loss'
      } else {
        result = winner === 'white' ? 'white-win' : 'black-win'
      }
    } else if (gameOver.result === 'timeout') {
      winner = gameOver.winner
      const winnerName = winner === 'white' ? 'White' : 'Black'
      title = 'Time Out!'
      detail = `${winnerName} wins on time`

      if (this.gameMode === 'bot') {
        const playerWon = (winner === 'white' && this.playerColor === 1) ||
                          (winner === 'black' && this.playerColor === 2)
        result = playerWon ? 'win' : 'loss'
      } else {
        result = winner === 'white' ? 'white-win' : 'black-win'
      }
    } else {
      title = 'Draw'
      detail = gameOver.result === 'stalemate' ? 'Stalemate' :
               gameOver.result === 'repetition' ? 'Threefold Repetition' :
               gameOver.result === 'insufficient-material' ? 'Insufficient Material' : 'Draw'
      result = 'draw'
    }

    let ratingChange = 0
    let newRating = 0

    if (this.gameMode === 'bot') {
      const eloResult = this.elo.updateRatings('bot', result)
      ratingChange = eloResult.change
      newRating = eloResult.newRating
    } else {
      newRating = this.elo.getRating('friend')
    }

    const moves = this.engine.getHistory().map(h => h.move.san)

    this.matchHistory.addMatch({
      mode: this.gameMode,
      difficulty: this.botDifficulty,
      playerColor: this.playerColor,
      result,
      winner: winner || null,
      moves,
      fen: this.engine.getFEN(),
      playerElo: this.elo.getRating(this.gameMode === 'bot' ? 'bot' : 'friend'),
      ratingChange,
      newRating
    })

    setTimeout(() => {
      this.ui.showGameOver({ title, detail }, ratingChange, newRating)
    }, 800)
  }

  showHistory(filter = null) {
    const matches = this.matchHistory.getMatches(filter === 'win' || filter === 'loss' ? null : { mode: filter })
    const filtered = filter === 'win' || filter === 'loss'
      ? matches.filter(m => m.result === filter)
      : matches
    const stats = this.matchHistory.getStats()
    this.ui.renderHistory(filtered, stats)
  }

  updateHUD() {
    const turn = this.engine.getTurn()

    if (this.gameMode === 'bot') {
      const playerName = 'You'
      const botName = DIFFICULTY_NAMES[this.botDifficulty] || 'Bot'
      const playerRating = this.elo.getRating('bot')

      if (this.playerColor === 1) {
        this.ui.updatePlayerBar('bottom', playerName, playerRating, turn === 1)
        this.ui.updatePlayerBar('top', botName, 1200, turn === 2)
      } else {
        this.ui.updatePlayerBar('top', playerName, playerRating, turn === 2)
        this.ui.updatePlayerBar('bottom', botName, 1200, turn === 1)
      }
    } else {
      this.ui.updatePlayerBar('bottom', 'White', this.elo.getRating('friend'), turn === 1)
      this.ui.updatePlayerBar('top', 'Black', this.elo.getRating('friend'), turn === 2)
    }
  }

  updateMoveList() {
    const history = this.engine.getHistory()
    const moves = history.map(h => h.move.san)
    this.ui.updateMoveList(moves)
  }

  updateClocks(display) {
    if (!display.enabled) return
    const topEl = document.getElementById('clock-top')
    const botEl = document.getElementById('clock-bottom')
    if (!topEl || !botEl) return

    const isFlipped = this.renderer.boardRenderer.boardAppearance.orientation === -1
    const topSide = isFlipped ? 'white' : 'black'
    const botSide = isFlipped ? 'black' : 'white'

    topEl.textContent = display[topSide]
    botEl.textContent = display[botSide]

    topEl.classList.toggle('low-time', this.clock.isLowTime(topSide))
    botEl.classList.toggle('low-time', this.clock.isLowTime(botSide))
    topEl.classList.toggle('active-turn', display.activeSide === topSide)
    botEl.classList.toggle('active-turn', display.activeSide === botSide)
  }

  updateClockDisplay(activeSide) {
    const display = this.clock.getDisplay()
    this.updateClocks(display)
  }

  onFlagFall(side) {
    if (!this.gameActive) return
    const winner = side === 'white' ? 'black' : 'white'
    this.endGame({ result: 'timeout', winner })
  }

  updateMenuElo() {
    const eloEl = document.getElementById('menu-elo')
    if (eloEl) eloEl.textContent = this.elo.getRating('bot')
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search)
    const fen = params.get('fen')
    if (fen) {
      try {
        this.startGame('friend')
        this.engine.init(decodeURIComponent(fen))
        const pos = this.engine.getPosition()
        this.renderer.boardRenderer.setPosition(pos)
        this.updateMoveList()
        window.history.replaceState({}, '', window.location.pathname)
      } catch (e) {
        console.warn('Invalid FEN in URL:', e)
      }
    }
  }

  flashCapture() {
    const overlay = document.getElementById('capture-flash')
    if (overlay) {
      overlay.classList.remove('active')
      void overlay.offsetWidth
      overlay.classList.add('active')
      setTimeout(() => overlay.classList.remove('active'), 300)
    }
  }

  startReplay(match) {
    if (!match || !match.moves || match.moves.length === 0) return

    this.replayState = {
      match,
      moves: match.moves,
      currentMove: 0,
      playing: false,
      timer: null
    }

    this.engine.init()
    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)
    this.renderer.boardRenderer.setLastMove(-1, -1)
    this.renderer.pieceRenderer.setLastMove(-1, -1)
    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)

    this.ui.showScreen('gameHud')
    this.ui.hideScreen('history')
    this.input.setInputEnabled(false)

    const replayControls = document.getElementById('replay-controls')
    if (replayControls) replayControls.classList.add('visible')
    const hudTools = document.querySelector('.hud-tools')
    if (hudTools) hudTools.style.display = 'none'
    const panel = document.querySelector('.move-list-panel')
    if (panel) panel.classList.add('visible')

    this.updateReplayHUD()
    this.renderReplayMoveList()
  }

  replayStep(delta) {
    if (!this.replayState) return
    const rs = this.replayState
    const newMove = rs.currentMove + delta
    if (newMove < 0 || newMove > rs.moves.length) return

    if (delta > 0) {
      const moveSan = rs.moves[rs.currentMove]
      this.engine.attemptMove(this.findMoveFromSan(moveSan), this.findMoveToSan(moveSan))
    } else {
      this.engine.undo()
    }

    rs.currentMove = newMove

    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)

    if (rs.currentMove > 0 && rs.currentMove <= rs.moves.length) {
      const history = this.engine.getHistory()
      const lastMove = history[history.length - 1]
      if (lastMove) {
        this.renderer.boardRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
        this.renderer.pieceRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
      }
    } else {
      this.renderer.boardRenderer.setLastMove(-1, -1)
      this.renderer.pieceRenderer.setLastMove(-1, -1)
    }

    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)

    this.updateReplayHUD()
    this.highlightReplayMove()
  }

  findMoveFromSan(san) {
    const history = this.engine.getHistory()
    const moves = this.engine.chess.moves({ verbose: true })
    const cleanSan = san.replace(/[+#!?]/g, '')
    for (const m of moves) {
      if (m.san.replace(/[+#!?]/g, '') === cleanSan) return m.from
    }
    return null
  }

  findMoveToSan(san) {
    const moves = this.engine.chess.moves({ verbose: true })
    const cleanSan = san.replace(/[+#!?]/g, '')
    for (const m of moves) {
      if (m.san.replace(/[+#!?]/g, '') === cleanSan) return m.to
    }
    return null
  }

  replayTogglePlay() {
    if (!this.replayState) return
    const rs = this.replayState

    if (rs.playing) {
      clearInterval(rs.timer)
      rs.playing = false
      this.updateReplayPlayButton(false)
    } else {
      rs.playing = true
      this.updateReplayPlayButton(true)
      rs.timer = setInterval(() => {
        if (rs.currentMove >= rs.moves.length) {
          clearInterval(rs.timer)
          rs.playing = false
          this.updateReplayPlayButton(false)
          return
        }
        this.replayStep(1)
      }, 800)
    }
  }

  replayGoStart() {
    if (!this.replayState) return
    if (this.replayState.playing) {
      clearInterval(this.replayState.timer)
      this.replayState.playing = false
    }
    while (this.replayState.currentMove > 0) {
      this.engine.undo()
      this.replayState.currentMove--
    }
    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)
    this.renderer.boardRenderer.setLastMove(-1, -1)
    this.renderer.pieceRenderer.setLastMove(-1, -1)
    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)
    this.updateReplayHUD()
    this.highlightReplayMove()
    this.updateReplayPlayButton(false)
  }

  replayGoEnd() {
    if (!this.replayState) return
    if (this.replayState.playing) {
      clearInterval(this.replayState.timer)
      this.replayState.playing = false
    }
    while (this.replayState.currentMove < this.replayState.moves.length) {
      const moveSan = this.replayState.moves[this.replayState.currentMove]
      this.engine.attemptMove(this.findMoveFromSan(moveSan), this.findMoveToSan(moveSan))
      this.replayState.currentMove++
    }
    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)
    const history = this.engine.getHistory()
    const lastMove = history[history.length - 1]
    if (lastMove) {
      this.renderer.boardRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
      this.renderer.pieceRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
    }
    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)
    this.updateReplayHUD()
    this.highlightReplayMove()
    this.updateReplayPlayButton(false)
  }

  replayGoToMove(targetIndex) {
    if (!this.replayState) return
    const rs = this.replayState
    if (rs.playing) {
      clearInterval(rs.timer)
      rs.playing = false
      this.updateReplayPlayButton(false)
    }

    this.engine.init()
    for (let i = 0; i < targetIndex; i++) {
      const moveSan = rs.moves[i]
      this.engine.attemptMove(this.findMoveFromSan(moveSan), this.findMoveToSan(moveSan))
    }
    rs.currentMove = targetIndex

    const pos = this.engine.getPosition()
    this.renderer.boardRenderer.setPosition(pos)

    if (targetIndex > 0) {
      const history = this.engine.getHistory()
      const lastMove = history[history.length - 1]
      if (lastMove) {
        this.renderer.boardRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
        this.renderer.pieceRenderer.setLastMove(lastMove.move.from, lastMove.move.to)
      }
    } else {
      this.renderer.boardRenderer.setLastMove(-1, -1)
      this.renderer.pieceRenderer.setLastMove(-1, -1)
    }
    this.renderer.boardRenderer.setCheck(-1)
    this.renderer.pieceRenderer.setCheck(null)
    this.updateReplayHUD()
    this.highlightReplayMove()
  }

  updateReplayHUD() {
    if (!this.replayState) return
    const rs = this.replayState
    const total = rs.moves.length
    const current = rs.currentMove
    const moveNum = Math.ceil(current / 2)
    const turn = current % 2 === 0 ? 'White' : 'Black'

    const nameEl = document.querySelector('.player-bar.bottom .player-name')
    if (nameEl) nameEl.textContent = `Move ${current} / ${total}`

    const topName = document.querySelector('.player-bar.top .player-name')
    if (topName) topName.textContent = rs.match.mode === 'bot' ? `vs ${rs.match.difficulty || 'Bot'}` : 'vs Friend'
  }

  updateReplayPlayButton(playing) {
    const btn = document.querySelector('[data-action="replay-play"]')
    if (btn) btn.textContent = playing ? '⏸' : '▶'
  }

  highlightReplayMove() {
    if (!this.replayState) return
    const rs = this.replayState
    document.querySelectorAll('.move-row').forEach((row, i) => {
      const moveIndex = i * 2
      row.classList.toggle('move-current', moveIndex === rs.currentMove - 1 || moveIndex + 1 === rs.currentMove - 1)
    })
    const active = document.querySelector('.move-current')
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  renderReplayMoveList() {
    if (!this.replayState) return
    const rs = this.replayState
    const body = document.querySelector('.move-list-body')
    if (!body) return

    let html = ''
    for (let i = 0; i < rs.moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1
      const white = rs.moves[i] || ''
      const black = rs.moves[i + 1] || ''
      html += `<div class="move-row" data-move-index="${i}">
        <span class="move-num">${moveNum}.</span>
        <span class="move-white" data-move-index="${i}">${white}</span>
        <span class="move-black" data-move-index="${i + 1}">${black}</span>
      </div>`
    }
    body.innerHTML = html

    body.querySelectorAll('[data-move-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.moveIndex) + 1
        this.replayGoToMove(idx)
      })
    })
  }

  exitReplay() {
    if (this.replayState?.playing) {
      clearInterval(this.replayState.timer)
    }
    this.replayState = null
    this.input.setInputEnabled(false)

    const replayControls = document.getElementById('replay-controls')
    if (replayControls) replayControls.classList.remove('visible')
    const hudTools = document.querySelector('.hud-tools')
    if (hudTools) hudTools.style.display = ''
    const panel = document.querySelector('.move-list-panel')
    if (panel) panel.classList.remove('visible')

    this.ui.hideScreen('gameHud')
    this.ui.showScreen('history')
    this.showHistory()
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = window.innerWidth * dpr
    this.canvas.height = window.innerHeight * dpr
    this.canvas.style.width = window.innerWidth + 'px'
    this.canvas.style.height = window.innerHeight + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.renderer?.resize(window.innerWidth, window.innerHeight)
  }

  loop(time) {
    if (!this.running) return
    this.renderer.render(this.engine)
    requestAnimationFrame((t) => this.loop(t))
  }
}

const game = new Game()
game.init().catch(console.error)

export { game }

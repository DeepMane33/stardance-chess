const STORAGE_KEY = 'stardance-chess-history'
const MAX_MATCHES = 100

export class MatchHistory {
  constructor() {
    this.matches = this.load()
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch (e) {
      return []
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.matches))
    } catch (e) {
      console.warn('Failed to save match history:', e)
    }
  }

  addMatch(match) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      mode: match.mode,
      difficulty: match.difficulty || null,
      playerColor: match.playerColor,
      result: match.result,
      winner: match.winner || null,
      pgn: match.pgn || '',
      fen: match.fen || '',
      moves: match.moves || [],
      playerElo: match.playerElo || 1500,
      ratingChange: match.ratingChange || 0,
      newRating: match.newRating || 1500
    }

    this.matches.unshift(entry)
    if (this.matches.length > MAX_MATCHES) {
      this.matches = this.matches.slice(0, MAX_MATCHES)
    }
    this.save()
    return entry
  }

  getMatches(filter = null) {
    if (!filter) return this.matches
    if (typeof filter === 'string') {
      return this.matches.filter(m => {
        if (filter === 'bot' || filter === 'friend') return m.mode === filter
        if (filter === 'win') return m.result === 'win'
        if (filter === 'loss') return m.result === 'loss'
        return true
      })
    }
    return this.matches.filter(m => {
      if (filter.mode && m.mode !== filter.mode) return false
      if (filter.result && m.result !== filter.result) return false
      return true
    })
  }

  getMatch(id) {
    return this.matches.find(m => m.id === id)
  }

  getStats() {
    const total = this.matches.length
    const wins = this.matches.filter(m => m.result === 'win').length
    const losses = this.matches.filter(m => m.result === 'loss').length
    const draws = this.matches.filter(m => m.result === 'draw').length
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

    return { total, wins, losses, draws, winRate }
  }

  clear() {
    this.matches = []
    this.save()
  }
}

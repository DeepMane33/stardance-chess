const STORAGE_KEY = 'stardance-chess-elo'
const K_FACTOR = 32

const DEFAULT_RATINGS = {
  bot: 1200,
  friend: 1500
}

export class EloSystem {
  constructor() {
    this.ratings = this.load()
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        return { ...DEFAULT_RATINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load ELO ratings:', e)
    }
    return { ...DEFAULT_RATINGS }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ratings))
    } catch (e) {
      console.warn('Failed to save ELO ratings:', e)
    }
  }

  getRating(mode) {
    return this.ratings[mode] ?? 1500
  }

  calculate(playerElo, opponentElo, result) {
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
    let actual
    if (result === 'win') actual = 1
    else if (result === 'loss') actual = 0
    else actual = 0.5

    const change = Math.round(K_FACTOR * (actual - expected))
    return change
  }

  updateRatings(mode, playerResult) {
    const playerElo = this.ratings[mode]
    const opponentElo = mode === 'bot' ? 1200 : this.ratings.player

    const change = this.calculate(playerElo, opponentElo, playerResult)
    this.ratings[mode] = Math.max(100, playerElo + change)
    this.save()

    return { change, newRating: this.ratings[mode] }
  }

  reset() {
    this.ratings = { ...DEFAULT_RATINGS }
    this.save()
  }
}

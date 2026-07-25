import * as Tone from 'tone'

export class AudioManager {
  constructor() {
    this.enabled = true
    this.initialized = false
    this.masterGain = null
    this.synths = {}
  }

  async init() {
    if (this.initialized) return
    try {
      await Tone.start()
      this.masterGain = new Tone.Gain(0.5).toDestination()

      // Move: soft wooden click — piece placed on board
      this.synths.move = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 }
      }).connect(this.masterGain)

      // Capture: layered retro chess sounds — wooden thud + clack + subtle scrape
      // Layer 1: Low wooden thud (piece hitting board)
      this.synths.captureThud = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 }
      }).connect(this.masterGain)

      // Layer 2: Wooden clack (piece-on-piece impact)
      this.synths.captureClack = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 }
      }).connect(this.masterGain)

      // Layer 3: Noise burst (the crisp "tok" sound)
      this.synths.captureNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }
      }).connect(this.masterGain)

      // Layer 4: Sub-bass thump (the weight of the capture)
      this.synths.captureSub = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 6,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
      }).connect(this.masterGain)

      // Check: sharp alert tone
      this.synths.check = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
      }).connect(this.masterGain)

      // Game over: descending tones
      this.synths.gameOver = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 }
      }).connect(this.masterGain)

      this.initialized = true
    } catch (e) {
      console.warn('Audio init failed:', e)
    }
  }

  playMove() {
    if (!this.enabled || !this.initialized) return
    try {
      // Soft wooden tap — piece placed gently
      this.synths.move.triggerAttackRelease('E5', '32n', Tone.now(), 0.3)
    } catch (e) {}
  }

  playCapture() {
    if (!this.enabled || !this.initialized) return
    try {
      const now = Tone.now()

      // Layer 1: Low wooden thud — the weight
      this.synths.captureThud.triggerAttackRelease('C2', '16n', now, 0.6)

      // Layer 2: Wooden clack — piece hitting piece
      this.synths.captureClack.triggerAttackRelease('A4', '32n', now + 0.005, 0.4)

      // Layer 3: Crisp noise burst — the "tok"
      this.synths.captureNoise.triggerAttackRelease('32n', now + 0.003, 0.35)

      // Layer 4: Sub bass thump — the impact weight
      this.synths.captureSub.triggerAttackRelease('E1', '16n', now + 0.01, 0.5)
    } catch (e) {}
  }

  playCheck() {
    if (!this.enabled || !this.initialized) return
    try {
      const now = Tone.now()
      this.synths.check.triggerAttackRelease('C6', '16n', now, 0.4)
      setTimeout(() => {
        this.synths.check.triggerAttackRelease('E6', '16n', Tone.now(), 0.3)
      }, 80)
    } catch (e) {}
  }

  playGameOver() {
    if (!this.enabled || !this.initialized) return
    try {
      this.synths.gameOver.triggerAttackRelease('C4', '4n', Tone.now(), 0.3)
      setTimeout(() => this.synths.gameOver.triggerAttackRelease('G3', '4n', Tone.now(), 0.25), 200)
      setTimeout(() => this.synths.gameOver.triggerAttackRelease('E3', '2n', Tone.now(), 0.2), 400)
    } catch (e) {}
  }

  // Legacy aliases — map to retro chess sounds
  playHit() { this.playCapture() }
  playWhoosh() { this.playMove() }
  playBassImpact() { this.playCapture() }
  playExplosion() { this.playCapture() }
  playSlowMoWhoosh() { this.playMove() }

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.rampTo(Math.max(0, Math.min(1, v)), 0.1)
  }

  setEnabled(enabled) {
    this.enabled = enabled
  }

  dispose() {
    Object.values(this.synths).forEach(s => { try { s.dispose() } catch (e) {} })
    if (this.masterGain) try { this.masterGain.dispose() } catch (e) {}
    this.initialized = false
  }
}

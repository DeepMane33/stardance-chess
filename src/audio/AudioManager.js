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

      this.synths.move = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
      }).connect(this.masterGain)

      this.synths.capture = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.2 }
      }).connect(this.masterGain)

      this.synths.check = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.3 }
      }).connect(this.masterGain)

      this.synths.gameOver = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 }
      }).connect(this.masterGain)

      this.noiseCapture = new Tone.NoiseSynth({
        noise: { type: 'brown' },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0 }
      }).connect(this.masterGain)

      this.initialized = true
    } catch (e) {
      console.warn('Audio init failed:', e)
    }
  }

  playMove() {
    if (!this.enabled || !this.initialized) return
    try {
      this.synths.move.triggerAttackRelease('E5', '32n', Tone.now(), 0.3)
    } catch (e) {}
  }

  playCapture() {
    if (!this.enabled || !this.initialized) return
    try {
      this.synths.capture.triggerAttackRelease('A3', '16n', Tone.now(), 0.5)
      this.noiseCapture.triggerAttackRelease('16n', Tone.now(), 0.3)
    } catch (e) {}
  }

  playCheck() {
    if (!this.enabled || !this.initialized) return
    try {
      this.synths.check.triggerAttackRelease('C6', '16n', Tone.now(), 0.4)
      setTimeout(() => {
        this.synths.check.triggerAttackRelease('E6', '16n', Tone.now(), 0.3)
      }, 100)
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

  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.rampTo(Math.max(0, Math.min(1, v)), 0.1)
  }

  setEnabled(enabled) {
    this.enabled = enabled
  }

  dispose() {
    Object.values(this.synths).forEach(s => { try { s.dispose() } catch (e) {} })
    if (this.noiseCapture) try { this.noiseCapture.dispose() } catch (e) {}
    if (this.masterGain) try { this.masterGain.dispose() } catch (e) {}
    this.initialized = false
  }
}

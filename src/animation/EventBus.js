export class EventBus {
  constructor() {
    this._events = new Map()
    this._onceEvents = new Map()
    this._wildcardListeners = []
  }

  on(event, listener) {
    if (!this._events.has(event)) {
      this._events.set(event, [])
    }
    this._events.get(event).push(listener)
    return () => this.off(event, listener)
  }

  once(event, listener) {
    if (!this._onceEvents.has(event)) {
      this._onceEvents.set(event, [])
    }
    this._onceEvents.get(event).push(listener)
    return () => this.offOnce(event, listener)
  }

  off(event, listener) {
    if (!this._events.has(event)) return
    const listeners = this._events.get(event)
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  offOnce(event, listener) {
    if (!this._onceEvents.has(event)) return
    const listeners = this._onceEvents.get(event)
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  emit(event, data) {
    if (this._events.has(event)) {
      const listeners = this._events.get(event)
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e)
        }
      }
    }

    if (this._onceEvents.has(event)) {
      const listeners = this._onceEvents.get(event)
      this._onceEvents.set(event, [])
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (e) {
          console.error(`Error in once listener for ${event}:`, e)
        }
      }
    }

    for (const { pattern, listener } of this._wildcardListeners) {
      if (this._matchPattern(pattern, event)) {
        try {
          listener(event, data)
        } catch (e) {
          console.error(`Error in wildcard listener for ${pattern}:`, e)
        }
      }
    }
  }

  onAny(pattern, listener) {
    this._wildcardListeners.push({ pattern, listener })
    return () => {
      const index = this._wildcardListeners.findIndex(w => w.listener === listener && w.pattern === pattern)
      if (index !== -1) this._wildcardListeners.splice(index, 1)
    }
  }

  _matchPattern(pattern, event) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return regex.test(event)
  }

  removeAllListeners(event) {
    if (event) {
      this._events.delete(event)
      this._onceEvents.delete(event)
    } else {
      this._events.clear()
      this._onceEvents.clear()
      this._wildcardListeners.length = 0
    }
  }

  listenerCount(event) {
    let count = 0
    if (this._events.has(event)) count += this._events.get(event).length
    if (this._onceEvents.has(event)) count += this._onceEvents.get(event).length
    return count
  }
}

export const globalEventBus = new EventBus()

export const GameEvents = {
  MOVE: 'game:move',
  CAPTURE: 'game:capture',
  CHECK: 'game:check',
  CHECKMATE: 'game:checkmate',
  STALEMATE: 'game:stalemate',
  PROMOTION: 'game:promotion',
  CASTLE: 'game:castle',
  EN_PASSANT: 'game:en_passant',
  TURN_CHANGE: 'game:turn_change',
  GAME_OVER: 'game:game_over',
  GAME_START: 'game:game_start'
}

export const EditEvents = {
  CAPTURE_START: 'edit:capture_start',
  CAPTURE_PHASE: 'edit:capture_phase',
  CAPTURE_END: 'edit:capture_end',
  MOVE_START: 'edit:move_start',
  MOVE_END: 'edit:move_end',
  CAMERA_SHAKE: 'edit:camera_shake',
  CAMERA_ZOOM: 'edit:camera_zoom',
  CAMERA_PAN: 'edit:camera_pan',
  HIT_PAUSE: 'edit:hit_pause',
  SLOW_MOTION: 'edit:slow_motion',
  FLASH: 'edit:flash',
  CHROMATIC_ABERRATION: 'edit:chromatic_aberration',
  VIGNETTE: 'edit:vignette',
  SCREEN_FLASH: 'edit:screen_flash'
}

export const AudioEvents = {
  PLAY_MOVE: 'audio:play_move',
  PLAY_CAPTURE: 'audio:play_capture',
  PLAY_CHECK: 'audio:play_check',
  PLAY_GAME_OVER: 'audio:play_game_over',
  PLAY_WHOOSH: 'audio:play_whoosh',
  PLAY_BASS_IMPACT: 'audio:play_bass_impact',
  PLAY_COMBO: 'audio:play_combo'
}

export const UIEvents = {
  SHOW_PROMOTION: 'ui:show_promotion',
  HIDE_PROMOTION: 'ui:hide_promotion',
  UPDATE_CLOCK: 'ui:update_clock',
  SHOW_GAME_OVER: 'ui:show_game_over',
  UPDATE_ELO: 'ui:update_elo',
  SHOW_HISTORY: 'ui:show_history'
}

export const ParticleEvents = {
  EMIT: 'particle:emit',
  EMIT_BURST: 'particle:emit_burst',
  CLEAR: 'particle:clear'
}
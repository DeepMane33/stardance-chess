export class EventBus {
  constructor() {
    this.events = new Map()
  }

  on(event, callback) {
    if (!this.events.has(event)) this.events.set(event, [])
    this.events.get(event).push(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    const callbacks = this.events.get(event)
    if (!callbacks) return
    const idx = callbacks.indexOf(callback)
    if (idx !== -1) callbacks.splice(idx, 1)
  }

  emit(event, payload) {
    const callbacks = this.events.get(event)
    if (!callbacks) return
    const copy = callbacks.slice()
    copy.forEach(cb => {
      try { cb(payload) } catch (e) { console.error(`Event error [${event}]:`, e) }
    })
  }

  once(event, callback) {
    const wrapper = (payload) => {
      this.off(event, wrapper)
      callback(payload)
    }
    this.on(event, wrapper)
  }

  clear() {
    this.events.clear()
  }
}

export const eventBus = new EventBus()
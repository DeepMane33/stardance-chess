import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChessClock } from '../src/core/ChessClock.js'

describe('ChessClock', () => {
  let clock
  let mockNow
  let nowValue

  beforeEach(() => {
    vi.useFakeTimers()
    nowValue = 0
    mockNow = vi.fn(() => nowValue)
    vi.stubGlobal('performance', { now: mockNow })
    clock = new ChessClock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    clock.dispose()
  })

  it('initializes with zero time', () => {
    const display = clock.getDisplay()
    expect(display.whiteRaw).toBe(0)
    expect(display.blackRaw).toBe(0)
    expect(display.enabled).toBe(false)
  })

  it('configures time control', () => {
    clock.configure(300)
    const display = clock.getDisplay()
    expect(display.whiteRaw).toBe(300)
    expect(display.blackRaw).toBe(300)
    expect(display.enabled).toBe(true)
    expect(display.activeSide).toBeNull()
  })

  it('starts ticking for the correct side', () => {
    clock.configure(60)
    clock.onTick = vi.fn()
    clock.start('white')

    expect(clock.getDisplay().activeSide).toBe('white')

    nowValue = 1000
    vi.advanceTimersByTime(1000)
    const display = clock.getDisplay()
    expect(display.whiteRaw).toBeLessThan(60)
    expect(display.whiteRaw).toBeCloseTo(59, 0)
    expect(display.blackRaw).toBe(60)
    expect(display.activeSide).toBe('white')
  })

  it('switches side and ticks the other player', () => {
    clock.configure(60)
    clock.onTick = vi.fn()
    clock.start('white')

    nowValue = 2000
    vi.advanceTimersByTime(2000)
    expect(clock.getDisplay().whiteRaw).toBeCloseTo(58, 0)

    clock.switchSide('black')
    expect(clock.getDisplay().activeSide).toBe('black')

    nowValue = 3000
    vi.advanceTimersByTime(1000)
    const display = clock.getDisplay()
    expect(display.whiteRaw).toBeCloseTo(58, 0)
    expect(display.blackRaw).toBeCloseTo(59, 0)
  })

  it('stops ticking when stopped', () => {
    clock.configure(60)
    clock.onTick = vi.fn()
    clock.start('white')

    nowValue = 1000
    vi.advanceTimersByTime(1000)
    const timeAfterStart = clock.getDisplay().whiteRaw

    clock.stop()
    nowValue = 6000
    vi.advanceTimersByTime(5000)
    expect(clock.getDisplay().whiteRaw).toBe(timeAfterStart)
  })

  it('does not tick with zero time control', () => {
    clock.configure(0)
    clock.onTick = vi.fn()
    clock.start('white')

    nowValue = 5000
    vi.advanceTimersByTime(5000)
    expect(clock.onTick).not.toHaveBeenCalled()
  })

  it('fires onFlag when time runs out', () => {
    clock.configure(3)
    clock.onTick = vi.fn()
    clock.onFlag = vi.fn()
    clock.start('white')

    nowValue = 3100
    vi.advanceTimersByTime(3100)
    expect(clock.onFlag).toHaveBeenCalledWith('white')
    expect(clock.getDisplay().whiteRaw).toBe(0)
    expect(clock.running).toBe(false)
  })

  it('does not fire onFlag for the non-active side', () => {
    clock.configure(3)
    clock.onTick = vi.fn()
    clock.onFlag = vi.fn()
    clock.start('white')

    nowValue = 3100
    vi.advanceTimersByTime(3100)
    expect(clock.onFlag).toHaveBeenCalledTimes(1)
    expect(clock.onFlag).toHaveBeenCalledWith('white')
    expect(clock.getDisplay().blackRaw).toBe(3)
  })

  it('fires onFlag for black when black runs out', () => {
    clock.configure(2)
    clock.onTick = vi.fn()
    clock.onFlag = vi.fn()
    clock.start('black')

    nowValue = 2100
    vi.advanceTimersByTime(2100)
    expect(clock.onFlag).toHaveBeenCalledWith('black')
    expect(clock.getDisplay().blackRaw).toBe(0)
  })

  it('resets both sides to initial time', () => {
    clock.configure(60)
    clock.start('white')
    nowValue = 10000
    vi.advanceTimersByTime(10000)

    clock.reset()
    const display = clock.getDisplay()
    expect(display.whiteRaw).toBe(60)
    expect(display.blackRaw).toBe(60)
    expect(display.activeSide).toBeNull()
    expect(display.enabled).toBe(true)
  })

  it('formats time correctly for minutes', () => {
    clock.configure(125)
    expect(clock.formatTime(125)).toBe('2:05')
    expect(clock.formatTime(61)).toBe('1:01')
  })

  it('formats time correctly for seconds', () => {
    clock.configure(30)
    expect(clock.formatTime(30)).toBe('30.0')
    expect(clock.formatTime(5.5)).toBe('6.5')
    expect(clock.formatTime(0.05)).toBe('1.0')
  })

  it('reports low time correctly', () => {
    clock.configure(60)
    expect(clock.isLowTime('white')).toBe(false)

    clock.start('white')
    nowValue = 50001
    vi.advanceTimersByTime(50001)
    expect(clock.isLowTime('white')).toBe(true)
    expect(clock.isLowTime('black')).toBe(false)
  })

  it('hasFlagFallen returns false when time remains', () => {
    clock.configure(60)
    clock.start('white')
    nowValue = 1000
    vi.advanceTimersByTime(1000)
    expect(clock.hasFlagFallen()).toBe(false)
  })

  it('hasFlagFallen returns true when time runs out', () => {
    clock.configure(1)
    clock.start('white')
    nowValue = 1100
    vi.advanceTimersByTime(1100)
    expect(clock.hasFlagFallen()).toBe(true)
  })

  describe('full game simulation', () => {
    it('alternates clock between white and black correctly', () => {
      clock.configure(10)
      clock.onTick = vi.fn()
      clock.onFlag = vi.fn()

      // White's turn: 2 seconds
      clock.start('white')
      nowValue = 2000
      vi.advanceTimersByTime(2000)
      expect(clock.getDisplay().activeSide).toBe('white')
      expect(clock.getDisplay().whiteRaw).toBeCloseTo(8, 0)
      expect(clock.getDisplay().blackRaw).toBe(10)

      // Switch to black's turn: 3 seconds
      clock.switchSide('black')
      nowValue = 5000
      vi.advanceTimersByTime(3000)
      expect(clock.getDisplay().activeSide).toBe('black')
      expect(clock.getDisplay().whiteRaw).toBeCloseTo(8, 0)
      expect(clock.getDisplay().blackRaw).toBeCloseTo(7, 0)

      // Switch back to white's turn: 1.5 seconds
      clock.switchSide('white')
      nowValue = 6500
      vi.advanceTimersByTime(1500)
      expect(clock.getDisplay().activeSide).toBe('white')
      expect(clock.getDisplay().whiteRaw).toBeCloseTo(6.5, 0)
      expect(clock.getDisplay().blackRaw).toBeCloseTo(7, 0)

      expect(clock.onFlag).not.toHaveBeenCalled()
    })

    it('only the active side loses time across many switches', () => {
      clock.configure(5)
      clock.onTick = vi.fn()
      clock.onFlag = vi.fn()

      clock.start('white')
      let t = 0
      for (let i = 0; i < 10; i++) {
        const side = i % 2 === 0 ? 'white' : 'black'
        clock.switchSide(side)
        t += 400
        nowValue = t
        vi.advanceTimersByTime(400)
      }

      const display = clock.getDisplay()
      // Each side had 5 switches of 400ms = 2000ms total
      expect(display.whiteRaw).toBeCloseTo(3, 0)
      expect(display.blackRaw).toBeCloseTo(3, 0)
      expect(clock.onFlag).not.toHaveBeenCalled()
    })
  })
})

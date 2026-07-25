export class TimeManager {
  constructor() {
    this.globalScale = 1;
    this.targetScale = 1;
    this.lerpSpeed = 12;
    
    this.hitStopActive = false;
    this.hitStopTimer = 0;
    this.hitStopScale = 0.01;
    
    this.timeScale = 1;
    this.unscaledTime = 0;
    this.scaledTime = 0;
    this.rawDelta = 0;
    this.scaledDelta = 0;
    
    this._listeners = new Set();
  }
  
  addListener(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
  
  _notify() {
    for (const fn of this._listeners) fn(this.timeScale);
  }
  
  setGlobalScale(scale, lerpSpeed = 12) {
    this.targetScale = Math.max(0.01, Math.min(3, scale));
    this.lerpSpeed = lerpSpeed;
  }
  
  setTimeScaleImmediate(scale) {
    this.globalScale = this.targetScale = Math.max(0.01, Math.min(3, scale));
    this._notify();
  }
  
  hitStop(durationMs = 60, scale = 0.01) {
    this.hitStopActive = true;
    this.hitStopTimer = durationMs;
    this.hitStopScale = scale;
    this.targetScale = scale;
    this.lerpSpeed = 50;
  }
  
  update(rawDt) {
    this.rawDelta = Math.min(rawDt, 0.05);
    this.unscaledTime += this.rawDelta;
    
    if (this.hitStopActive) {
      this.hitStopTimer -= this.rawDelta * 1000;
      if (this.hitStopTimer <= 0) {
        this.hitStopActive = false;
        this.targetScale = this.globalScale;
        this.lerpSpeed = 12;
      }
    }
    
    const diff = this.targetScale - this.globalScale;
    if (Math.abs(diff) > 0.0005) {
      this.globalScale += diff * Math.min(1, this.lerpSpeed * this.rawDelta);
    } else {
      this.globalScale = this.targetScale;
    }
    
    this.timeScale = this.hitStopActive ? this.hitStopScale : this.globalScale;
    this.scaledDelta = this.rawDelta * this.timeScale;
    this.scaledTime += this.scaledDelta;
    
    this._notify();
    
    return { scaledDt: this.scaledDelta, timeScale: this.timeScale };
  }
  
  getScaledDelta() { return this.scaledDelta; }
  getRawDelta() { return this.rawDelta; }
  getTimeScale() { return this.timeScale; }
  getGlobalScale() { return this.globalScale; }
  getUnscaledTime() { return this.unscaledTime; }
  getScaledTime() { return this.scaledTime; }
  
  isHitStopped() { return this.hitStopActive; }
}

export const timeManager = new TimeManager();
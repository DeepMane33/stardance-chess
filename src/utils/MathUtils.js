export const Easing = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  easeInQuint: t => t * t * t * t * t,
  easeOutQuint: t => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  easeInSine: t => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: t => Math.sin(t * Math.PI / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 
    ? Math.pow(2, 20 * t - 10) / 2 
    : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInCirc: t => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: t => t < 0.5 
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  easeInBack: t => 2.70158 * t * t * t - 1.70158 * t * t,
  easeOutBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  easeInOutBack: t => t < 0.5
    ? (Math.pow(2 * t, 2) * (3.5949095 * 2 * t - 2.5949095)) / 2
    : (Math.pow(2 * t - 2, 2) * (3.5949095 * (2 * t - 2) + 2.5949095) + 2) / 2,
  easeOutElastic: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  easeOutBounce: t => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  spring: (t, stiffness = 180, damping = 12) => {
    const w = Math.sqrt(stiffness);
    return 1 - Math.exp(-damping * t) * (Math.cos(w * t) + (damping / w) * Math.sin(w * t));
  }
};

export const MathUtils = {
  clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  lerpAngle: (a, b, t) => {
    const diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + diff * t;
  },
  map: (v, inMin, inMax, outMin, outMax) => 
    outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin),
  random: (min, max) => min + Math.random() * (max - min),
  randomInt: (min, max) => Math.floor(MathUtils.random(min, max + 1)),
  degToRad: d => d * Math.PI / 180,
  radToDeg: r => r * 180 / Math.PI,
  distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1)
};

export class Interpolator {
  constructor() {
    this.values = new Map();
  }

  set(key, value) {
    this.values.set(key, { current: value, target: value, velocity: 0 });
  }

  to(key, target, options = {}) {
    const { duration = 300, easing = 'easeOutCubic', onComplete } = options;
    const entry = this.values.get(key) || { current: target, target, velocity: 0, startTime: 0 };
    entry.target = target;
    entry.startTime = performance.now();
    entry.duration = duration;
    entry.easing = typeof easing === 'string' ? Easing[easing] : easing;
    entry.onComplete = onComplete;
    this.values.set(key, entry);
    return this;
  }

  update() {
    const now = performance.now();
    for (const [key, entry] of this.values) {
      if (entry.current === entry.target && !entry.velocity) continue;
      
      if (entry.duration) {
        const elapsed = now - entry.startTime;
        const progress = Math.min(elapsed / entry.duration, 1);
        const eased = entry.easing(progress);
        entry.current = entry.target * eased + entry.current * (1 - eased);
        
        if (progress >= 1) {
          entry.current = entry.target;
          entry.duration = 0;
          if (entry.onComplete) entry.onComplete();
        }
      } else if (entry.velocity !== undefined) {
        const dt = 1 / 60;
        const stiffness = 180;
        const damping = 12;
        const force = (entry.target - entry.current) * stiffness;
        entry.velocity = (entry.velocity + force * dt) * (1 - damping * dt);
        entry.current += entry.velocity * dt;
        if (Math.abs(entry.target - entry.current) < 0.001 && Math.abs(entry.velocity) < 0.001) {
          entry.current = entry.target;
          entry.velocity = 0;
        }
      }
    }
  }

  get(key) {
    return this.values.get(key)?.current ?? 0;
  }

  isAnimating(key) {
    const entry = this.values.get(key);
    return entry ? entry.current !== entry.target || (entry.velocity && Math.abs(entry.velocity) > 0.001) : false;
  }

  getAll() {
    const result = {};
    for (const [key, entry] of this.values) {
      result[key] = entry.current;
    }
    return result;
  }
}
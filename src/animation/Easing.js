export const Easing = {
  linear: t => t,

  easeInSine: t => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: t => Math.sin((t * Math.PI) / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,

  easeInQuad: t => t * t,
  easeOutQuad: t => 1 - (1 - t) * (1 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  easeInCubic: t => t * t * t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

  easeInQuint: t => t * t * t * t * t,
  easeOutQuint: t => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,

  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2,

  easeInCirc: t => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: t => t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,

  easeInBack: t => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeOutBack: t => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInOutBack: t => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },

  easeInElastic: t => {
    if (t === 0) return 0
    if (t === 1) return 1
    const c4 = (2 * Math.PI) / 3
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)
  },
  easeOutElastic: t => {
    if (t === 0) return 0
    if (t === 1) return 1
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
  easeInOutElastic: t => {
    if (t === 0) return 0
    if (t === 1) return 1
    const c5 = (2 * Math.PI) / 4.5
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1
  },

  easeInBounce: t => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: t => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
  easeInOutBounce: t => t < 0.5
    ? (1 - Easing.easeOutBounce(1 - 2 * t)) / 2
    : (1 + Easing.easeOutBounce(2 * t - 1)) / 2,

  easeOutQuartBack: t => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 - Math.pow(1 - t, 4) + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },

  // Premium cinematic easings
  easeOutQuint: t => 1 - Math.pow(1 - t, 5),
  easeOutQuintStrong: t => 1 - Math.pow(1 - t, 6),

  // "Butter" - silky smooth with micro-anticipation
  butter: t => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const smooth = t * t * (3 - 2 * t)
    const microAnticipation = Math.sin(t * Math.PI) * 0.02
    return smooth + microAnticipation
  },

  // "Glide" - constant velocity with smooth ends, cinematic feel
  glide: t => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const accelZone = 0.12
    const decelZone = 0.82
    if (t < accelZone) return 0.5 * Math.pow(t / accelZone, 2.8)
    if (t > decelZone) return 1 - 0.5 * Math.pow((1 - t) / (1 - decelZone), 2.2)
    return (t - accelZone) / (decelZone - accelZone) * (1 - accelZone * 0.5) + 0.5 * accelZone
  },

  // Arc height easing - for parabolic lift
  arcAsymmetric: (t, peak = 0.35) => {
    if (t <= 0) return 0
    if (t >= 1) return 0
    if (t < peak) return Math.pow(t / peak, 0.65)
    return Math.pow((1 - t) / (1 - peak), 1.85)
  },

  // "Heavy" - weighty start, authoritative arrival
  heavy: t => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return t * t * (3 - 2 * t) + Math.sin(t * Math.PI) * 0.015
  },

  // "Settle" - damped spring settle
  settle: t => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return 1 - Math.pow(2, -8 * t) * Math.cos(t * Math.PI * 2.5)
  },

  // Micro-ease for subtle secondary motion
  micro: t => t * t * (3 - 2 * t) + Math.sin(t * Math.PI * 2) * 0.008,

  // Arc height easing - for parabolic lift (alias for arcAsymmetric with different defaults)
  AnimationArc: (t, peak = 0.35) => {
    if (t <= 0) return 0
    if (t >= 1) return 0
    if (t < peak) return Math.pow(t / peak, 0.75)
    return Math.pow((1 - t) / (1 - peak), 1.8)
  },

  // Alias for glide
  AnimationGlide: (t) => Easing.glide(t)
}

export const Ease = {
  linear: Easing.linear,
  sine: { in: Easing.easeInSine, out: Easing.easeOutSine, inOut: Easing.easeInOutSine },
  quad: { in: Easing.easeInQuad, out: Easing.easeOutQuad, inOut: Easing.easeInOutQuad },
  cubic: { in: Easing.easeInCubic, out: Easing.easeOutCubic, inOut: Easing.easeInOutCubic },
  quart: { in: Easing.easeInQuart, out: Easing.easeOutQuart, inOut: Easing.easeInOutQuart },
  quint: { in: Easing.easeInQuint, out: Easing.easeOutQuint, inOut: Easing.easeInOutQuint },
  expo: { in: Easing.easeInExpo, out: Easing.easeOutExpo, inOut: Easing.easeInOutExpo },
  circ: { in: Easing.easeInCirc, out: Easing.easeOutCirc, inOut: Easing.easeInOutCirc },
  back: { in: Easing.easeInBack, out: Easing.easeOutBack, inOut: Easing.easeInOutBack },
  elastic: { in: Easing.easeInElastic, out: Easing.easeOutElastic, inOut: Easing.easeInOutElastic },
  bounce: { in: Easing.easeInBounce, out: Easing.easeOutBounce, inOut: Easing.easeInOutBounce },
  butter: Easing.butter,
  glide: Easing.glide,
  heavy: Easing.heavy,
  settle: Easing.settle,
  arcAsymmetric: Easing.arcAsymmetric,
  micro: Easing.micro,
  AnimationArc: Easing.AnimationArc,
  AnimationGlide: Easing.AnimationGlide
}

export function getEasing(name) {
  const parts = name.split('.')
  let fn = Easing
  for (const part of parts) {
    fn = fn[part]
    if (!fn) throw new Error(`Easing not found: ${name}`)
  }
  return fn
}
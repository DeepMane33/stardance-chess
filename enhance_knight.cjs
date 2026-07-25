const fs = require('fs');
const f = 'src/animation/CaptureAnimations.js';
let s = fs.readFileSync(f, 'utf8');

// 1. Enhance KnightDarknessEffect constructor: add crack, dust, secondary ring properties
const knightCtorEnd = `    this.impactFired = false
  }`;
const knightCtorReplacement = `    this.impactFired = false

    // Heavy impact enhancements
    this.crackLines = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.4
      this.crackLines.push({
        angle,
        length: 0,
        maxLength: this.pieceSize * (1.5 + Math.random() * 2.5),
        width: 1 + Math.random() * 2,
        alpha: 0
      })
    }
    this.dustCloud = []
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.3
      this.dustCloud.push({
        angle,
        dist: 0,
        maxDist: this.pieceSize * (0.3 + Math.random() * 1.2),
        size: this.pieceSize * (0.08 + Math.random() * 0.12),
        alpha: 0
      })
    }
    this.secondaryRingProgress = 0
    this.tertiaryRingProgress = 0
  }`;

if (s.includes(knightCtorEnd)) {
  s = s.replace(knightCtorEnd, knightCtorReplacement);
  console.log('Enhanced KnightDarknessEffect constructor');
} else {
  console.log('WARNING: could not find knight ctor end');
}

// 2. Enhance KnightDarknessEffect update: stronger shake, crack/dust animation
const knightUpdateOld = `    // Phase 3: Impact / Edit effect (75–100%)
    if (p >= 0.75 && p < 0.82) {
      const t = (p - 0.75) / 0.07
      this.flashAlpha = Math.sin(t * Math.PI) * 1.0
      this.glitchIntensity = Math.sin(t * Math.PI) * 1.2
      this.impactShake = Math.sin(t * Math.PI) * 8
    } else if (p >= 0.82 && p < 0.95) {
      const t = (p - 0.82) / 0.13
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.0
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 1.2
      this.impactShake = Easing.easeOutCubic(1 - t) * 8
    } else {
      this.flashAlpha = 0
      this.glitchIntensity = 0
      this.impactShake = 0
    }

    // Ring after impact
    if (p >= 0.78 && p < 0.95) {
      const t = (p - 0.78) / 0.17
      this.ringProgress = t
    } else if (p >= 0.95) {
      this.ringProgress = 1
    }`;

const knightUpdateNew = `    // Phase 3: Impact / Edit effect (75–100%) — HEAVY landing
    if (p >= 0.75 && p < 0.82) {
      const t = (p - 0.75) / 0.07
      this.flashAlpha = Math.sin(t * Math.PI) * 1.0
      this.glitchIntensity = Math.sin(t * Math.PI) * 1.2
      this.impactShake = Math.sin(t * Math.PI) * 18
    } else if (p >= 0.82 && p < 0.95) {
      const t = (p - 0.82) / 0.13
      this.flashAlpha = Easing.easeOutCubic(1 - t) * 1.0
      this.glitchIntensity = Easing.easeOutCubic(1 - t) * 1.2
      this.impactShake = Easing.easeOutCubic(1 - t) * 18
    } else {
      this.flashAlpha = 0
      this.glitchIntensity = 0
      this.impactShake = 0
    }

    // Primary ring after impact
    if (p >= 0.78 && p < 0.95) {
      const t = (p - 0.78) / 0.17
      this.ringProgress = t
    } else if (p >= 0.95) {
      this.ringProgress = 1
    }

    // Secondary & tertiary rings for heavy impact feel
    if (p >= 0.80 && p < 0.96) {
      const t = (p - 0.80) / 0.16
      this.secondaryRingProgress = t
    } else if (p >= 0.96) {
      this.secondaryRingProgress = 1
    }
    if (p >= 0.83 && p < 0.98) {
      const t = (p - 0.83) / 0.15
      this.tertiaryRingProgress = t
    } else if (p >= 0.98) {
      this.tertiaryRingProgress = 1
    }

    // Crack lines spread from impact
    if (p >= 0.76 && p < 0.92) {
      const t = (p - 0.76) / 0.16
      for (const crack of this.crackLines) {
        crack.length = crack.maxLength * Easing.easeOutExpo(t)
        crack.alpha = 1 - Easing.easeInCubic(t)
      }
    } else if (p >= 0.92) {
      for (const crack of this.crackLines) {
        crack.length = crack.maxLength
        crack.alpha = 0
      }
    }

    // Dust cloud expansion
    if (p >= 0.75 && p < 0.90) {
      const t = (p - 0.75) / 0.15
      for (const dust of this.dustCloud) {
        dust.dist = dust.maxDist * Easing.easeOutCubic(t)
        dust.alpha = (1 - t) * 0.5
      }
    } else if (p >= 0.90) {
      for (const dust of this.dustCloud) {
        dust.dist = dust.maxDist
        dust.alpha = 0
      }
    }`;

if (s.includes(knightUpdateOld)) {
  s = s.replace(knightUpdateOld, knightUpdateNew);
  console.log('Enhanced KnightDarknessEffect update');
} else {
  console.log('WARNING: could not find knight update block');
}

// 3. Enhance KnightDarknessEffect render: draw cracks, dust, secondary rings
const knightRenderOld = `    // Impact ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.5 + this.ringProgress * 4)
      const ringW = this.pieceSize * 0.12 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.9
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Impact shake offset (applied to everything after this)
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }`;

const knightRenderNew = `    // Impact ring
    if (this.ringProgress > 0.01 && this.ringProgress < 1) {
      const ringR = this.pieceSize * (0.5 + this.ringProgress * 4)
      const ringW = this.pieceSize * 0.12 * (1 - this.ringProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.ringProgress) * 0.9
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Secondary ring
    if (this.secondaryRingProgress > 0.01 && this.secondaryRingProgress < 1) {
      const ringR = this.pieceSize * (0.3 + this.secondaryRingProgress * 5)
      const ringW = this.pieceSize * 0.08 * (1 - this.secondaryRingProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.secondaryRingProgress) * 0.6
      ctx.strokeStyle = '#ff6600'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ff6600'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Tertiary ring
    if (this.tertiaryRingProgress > 0.01 && this.tertiaryRingProgress < 1) {
      const ringR = this.pieceSize * (0.2 + this.tertiaryRingProgress * 6)
      const ringW = this.pieceSize * 0.06 * (1 - this.tertiaryRingProgress)
      ctx.save()
      ctx.globalAlpha = (1 - this.tertiaryRingProgress) * 0.4
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = ringW
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Crack lines
    for (const crack of this.crackLines) {
      if (crack.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = crack.alpha
      ctx.strokeStyle = '#ffaa00'
      ctx.lineWidth = crack.width
      ctx.shadowColor = '#ffaa00'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(
        cx + Math.cos(crack.angle) * crack.length,
        cy + Math.sin(crack.angle) * crack.length
      )
      ctx.stroke()
      ctx.restore()
    }

    // Dust cloud
    for (const dust of this.dustCloud) {
      if (dust.alpha <= 0.01) continue
      ctx.save()
      ctx.globalAlpha = dust.alpha
      ctx.fillStyle = '#d2b48c'
      const dx = cx + Math.cos(dust.angle) * dust.dist
      const dy = cy + Math.sin(dust.angle) * dust.dist
      ctx.beginPath()
      ctx.arc(dx, dy, dust.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Impact shake offset (applied to everything after this)
    return {
      shakeX: (Math.random() - 0.5) * this.impactShake,
      shakeY: (Math.random() - 0.5) * this.impactShake
    }`;

if (s.includes(knightRenderOld)) {
  s = s.replace(knightRenderOld, knightRenderNew);
  console.log('Enhanced KnightDarknessEffect render');
} else {
  console.log('WARNING: could not find knight render block');
}

fs.writeFileSync(f, s, 'utf8');
console.log('KnightDarknessEffect enhancement complete');

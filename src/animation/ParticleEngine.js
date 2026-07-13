import { MathUtils } from '../utils/MathUtils.js';

export const ParticlePresets = {
  sparks: {
    count: 30,
    colors: ['#ffd700', '#fff8dc', '#ffec8b', '#ffffe0'],
    size: { min: 1.5, max: 4 },
    speed: { min: 200, max: 600 },
    gravity: 300,
    life: { min: 0.3, max: 0.8 },
    shapes: ['circle', 'line'],
    spread: Math.PI * 2,
    angleOffset: -Math.PI / 2
  },
  
  embers: {
    count: 25,
    colors: ['#ff6b35', '#ff8c00', '#ffa500', '#ffd700', '#ffffff'],
    size: { min: 2, max: 5 },
    speed: { min: 50, max: 250 },
    gravity: 150,
    life: { min: 0.5, max: 1.2 },
    shapes: ['circle', 'diamond'],
    spread: Math.PI * 1.5,
    angleOffset: -Math.PI / 2,
    fade: true
  },

  dust: {
    count: 40,
    colors: ['#8b7d6b', '#a89f91', '#c5bdb3', '#ddd5cc'],
    size: { min: 1, max: 3 },
    speed: { min: 30, max: 120 },
    gravity: 50,
    life: { min: 0.8, max: 1.5 },
    shapes: ['circle'],
    spread: Math.PI * 2,
    angleOffset: 0
  },

  smoke: {
    count: 20,
    colors: ['rgba(20,20,30,0.6)', 'rgba(40,40,50,0.4)', 'rgba(60,60,70,0.3)', 'rgba(80,80,90,0.2)'],
    size: { min: 8, max: 20 },
    speed: { min: 20, max: 80 },
    gravity: -20,
    life: { min: 1.0, max: 2.0 },
    shapes: ['circle'],
    spread: Math.PI * 0.8,
    angleOffset: -Math.PI / 2,
    expansion: 1.5
  },

  lightFragments: {
    count: 35,
    colors: ['#00ffff', '#7c4dff', '#ff4081', '#ffd700', '#ffffff'],
    size: { min: 1, max: 3 },
    speed: { min: 150, max: 500 },
    gravity: 100,
    life: { min: 0.4, max: 0.9 },
    shapes: ['diamond', 'star', 'circle'],
    spread: Math.PI * 2,
    angleOffset: 0,
    glow: true
  },

  energyShards: {
    count: 20,
    colors: ['#00ffff', '#7c4dff', '#ff4081', '#ffffff'],
    size: { min: 3, max: 8 },
    speed: { min: 200, max: 800 },
    gravity: 200,
    life: { min: 0.3, max: 0.7 },
    shapes: ['diamond', 'slash'],
    spread: Math.PI * 1.2,
    angleOffset: -Math.PI / 4,
    rotationSpeed: { min: -20, max: 20 }
  },

  shockwave: {
    count: 1,
    colors: ['rgba(255,215,0,0.8)', 'rgba(255,60,60,0.6)', 'rgba(0,255,255,0.5)'],
    size: { min: 5, max: 5 },
    speed: { min: 0, max: 0 },
    gravity: 0,
    life: { min: 0.6, max: 0.6 },
    shapes: ['ring'],
    spread: 0,
    angleOffset: 0,
    expansion: 1200
  },

  slashLines: {
    count: 8,
    colors: ['#ffffff', '#00ffff', '#ff4081'],
    size: { min: 60, max: 120 },
    speed: { min: 0, max: 0 },
    gravity: 0,
    life: { min: 0.15, max: 0.25 },
    shapes: ['slash'],
    spread: Math.PI * 0.3,
    angleOffset: -Math.PI / 2,
    rotationSpeed: { min: -5, max: 5 }
  },

  crownBurst: {
    count: 24,
    colors: ['#ffd700', '#fff8dc', '#ffec8b', '#ffffe0', '#ffffff'],
    size: { min: 4, max: 8 },
    speed: { min: 200, max: 500 },
    gravity: 250,
    life: { min: 0.6, max: 1.0 },
    shapes: ['crown', 'star', 'diamond'],
    spread: Math.PI * 2,
    angleOffset: -Math.PI / 2,
    rotationSpeed: { min: -10, max: 10 }
  },

  pieceDisintegration: {
    count: 50,
    colors: ['#ffffff', '#e8e8e8', '#d0d0d0', '#b8b8b8'],
    size: { min: 2, max: 6 },
    speed: { min: 100, max: 400 },
    gravity: 200,
    life: { min: 0.5, max: 1.2 },
    shapes: ['square', 'diamond', 'slash'],
    spread: Math.PI * 2,
    angleOffset: 0,
    rotationSpeed: { min: -15, max: 15 }
  }
};

class Particle {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx;
    this.vy = config.vy;
    this.radius = config.radius;
    this.color = config.color;
    this.shape = config.shape;
    this.life = 1;
    this.maxLife = config.maxLife;
    this.age = 0;
    this.gravity = config.gravity || 0;
    this.rotation = config.rotation || 0;
    this.rotationSpeed = config.rotationSpeed || 0;
    this.expansion = config.expansion || 0;
    this.glow = config.glow || false;
    this.alpha = 1;
    this.trail = [];
    this.trailLength = config.trailLength || 0;
    this.customDraw = config.customDraw || null;
  }

  update(dt) {
    this.age += dt;
    this.life = 1 - (this.age / this.maxLife);
    
    if (this.life <= 0) return false;
    
    if (this.trailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.trailLength) this.trail.shift();
    }
    
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotationSpeed * dt;
    
    if (this.expansion) {
      this.radius += this.expansion * dt;
    }
    
    return true;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha * this.life;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    if (this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x - this.x, this.trail[0].y - this.y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x - this.x, this.trail[i].y - this.y);
      }
      ctx.strokeStyle = this.color.replace(/[\d.]+\)$/, `${this.alpha * this.life * 0.3})`);
      ctx.lineWidth = Math.max(1, this.radius * 0.4);
      ctx.stroke();
    }
    
    if (this.customDraw) {
      this.customDraw(ctx, this);
    } else {
      this.drawShape(ctx);
    }
    
    if (this.glow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.radius * 3;
      this.drawShape(ctx);
    }
    
    ctx.restore();
  }

  drawShape(ctx) {
    const r = this.radius;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    
    switch (this.shape) {
      case 'circle':
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(-r, -r, r * 2, r * 2);
        break;
      case 'diamond':
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        break;
      case 'star':
        this.drawStar(ctx, 0, 0, r, r * 0.5, 5);
        break;
      case 'slash':
        ctx.moveTo(-r * 1.5, -r * 1.5);
        ctx.lineTo(r * 1.5, r * 1.5);
        ctx.lineWidth = Math.max(1, r * 0.3);
        ctx.strokeStyle = this.color;
        ctx.stroke();
        return;
      case 'crown':
        this.drawCrown(ctx, 0, 0, r);
        break;
      case 'ring':
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, r * 0.15);
        ctx.strokeStyle = this.color;
        ctx.stroke();
        return;
      default:
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    
    ctx.fill();
  }

  drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  drawCrown(ctx, cx, cy, size) {
    const spikes = 5;
    const outerR = size;
    const innerR = size * 0.4;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

export class ParticleEngine {
  constructor(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;
    this.particles = [];
    this.emitters = [];
    this.layers = new Map();
    this.defaultLayer = 'default';
    this.layerOrder = ['background', 'default', 'foreground', 'ui'];
    this.time = 0;
    this.paused = false;
    this.maxParticles = 5000;
    this.objectPool = [];
    this.poolSize = 1000;
  }

  createLayer(name, options = {}) {
    this.layers.set(name, {
      particles: [],
      emitters: [],
      blendMode: options.blendMode || 'source-over',
      alpha: options.alpha || 1,
      visible: true,
      ...options
    });
    if (!this.layerOrder.includes(name)) {
      this.layerOrder.push(name);
    }
  }

  setLayerOrder(order) {
    this.layerOrder = order;
  }

  emit(presetName, x, y, overrides = {}, layer = 'default') {
    const preset = ParticlePresets[presetName];
    if (!preset) {
      console.warn(`Particle preset "${presetName}" not found`);
      return;
    }

    const config = { ...preset, ...overrides };
    const count = Math.floor(MathUtils.random(config.count * 0.8, config.count * 1.2));
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const spread = config.spread || Math.PI * 2;
      const baseAngle = config.angleOffset || 0;
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = MathUtils.random(config.speed.min, config.speed.max);
      const size = MathUtils.random(config.size.min, config.size.max);
      const life = MathUtils.random(config.life.min, config.life.max);
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];
      const shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];
      const rotationSpeed = config.rotationSpeed 
        ? MathUtils.random(config.rotationSpeed.min, config.rotationSpeed.max)
        : MathUtils.random(-5, 5);
      
      const particle = this.getPooledParticle({
        x: x + (config.offsetX || 0),
        y: y + (config.offsetY || 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + (config.initialVy || 0),
        radius: size,
        color,
        shape,
        maxLife: life,
        gravity: config.gravity || 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed,
        expansion: config.expansion || 0,
        glow: config.glow || false,
        trailLength: config.trailLength || 0,
        alpha: config.alpha || 1
      });
      
      this.addToLayer(particle, layer);
    }
  }

  emitCustom(particles, layer = 'default') {
    for (const p of particles) {
      if (this.particles.length >= this.maxParticles) break;
      const particle = this.getPooledParticle(p);
      this.addToLayer(particle, layer);
    }
  }

  getPooledParticle(config) {
    if (this.objectPool.length > 0) {
      const p = this.objectPool.pop();
      Object.assign(p, config);
      return p;
    }
    return new Particle(config);
  }

  returnToPool(particle) {
    if (this.objectPool.length < this.poolSize) {
      this.objectPool.push(particle);
    }
  }

  addToLayer(particle, layerName) {
    const layer = this.layers.get(layerName) || this.layers.get(this.defaultLayer);
    if (layer) {
      layer.particles.push(particle);
      this.particles.push(particle);
    }
  }

  createEmitter(config) {
    const emitter = {
      ...config,
      active: true,
      timer: 0,
      particlesPerSecond: config.rate || 60,
      burstCount: config.burst || 0,
      burstInterval: config.burstInterval || 0,
      lastBurst: 0,
      duration: config.duration || Infinity,
      startTime: this.time,
      layer: config.layer || 'default',
      preset: config.preset || 'sparks',
      overrides: config.overrides || {},
      position: { x: config.x || 0, y: config.y || 0 },
      followTarget: config.follow || null
    };
    
    const layer = this.layers.get(this.defaultLayer);
    if (layer) layer.emitters.push(emitter);
    this.emitters.push(emitter);
    return emitter;
  }

  destroyEmitter(emitter) {
    emitter.active = false;
    const idx = this.emitters.indexOf(emitter);
    if (idx !== -1) this.emitters.splice(idx, 1);
    for (const layer of this.layers.values()) {
      const eIdx = layer.emitters.indexOf(emitter);
      if (eIdx !== -1) layer.emitters.splice(eIdx, 1);
    }
  }

  update(dt) {
    if (this.paused) return;
    this.time += dt;

    for (const emitter of this.emitters) {
      if (!emitter.active) continue;
      if (this.time - emitter.startTime > emitter.duration) {
        this.destroyEmitter(emitter);
        continue;
      }

      if (emitter.followTarget) {
        emitter.position.x = emitter.followTarget.x;
        emitter.position.y = emitter.followTarget.y;
      }

      if (emitter.burstCount > 0 && emitter.burstInterval > 0) {
        if (this.time - emitter.lastBurst >= emitter.burstInterval) {
          for (let i = 0; i < emitter.burstCount; i++) {
            this.emit(emitter.preset, emitter.position.x, emitter.position.y, emitter.overrides, emitter.layer);
          }
          emitter.lastBurst = this.time;
        }
      } else {
        const interval = 1 / emitter.particlesPerSecond;
        emitter.timer += dt;
        while (emitter.timer >= interval) {
          this.emit(emitter.preset, emitter.position.x, emitter.position.y, emitter.overrides, emitter.layer);
          emitter.timer -= interval;
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.update(dt)) {
        this.returnToPool(p);
        this.particles.splice(i, 1);
        for (const layer of this.layers.values()) {
          const idx = layer.particles.indexOf(p);
          if (idx !== -1) layer.particles.splice(idx, 1);
        }
      }
    }
  }

  render() {
    for (const layerName of this.layerOrder) {
      const layer = this.layers.get(layerName);
      if (!layer || !layer.visible) continue;
      
      this.ctx.save();
      this.ctx.globalAlpha = layer.alpha;
      this.ctx.globalCompositeOperation = layer.blendMode;
      
      for (const p of layer.particles) {
        p.draw(this.ctx);
      }
      
      this.ctx.restore();
    }
  }

  clear() {
    for (const p of this.particles) {
      this.returnToPool(p);
    }
    this.particles = [];
    for (const layer of this.layers.values()) {
      layer.particles = [];
      layer.emitters = [];
    }
    this.emitters = [];
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }
  setPaused(p) { this.paused = p; }

  getParticleCount() { return this.particles.length; }
  getEmitterCount() { return this.emitters.length; }
}
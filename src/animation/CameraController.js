import { Easing } from '../utils/MathUtils.js';

export class CameraController {
  constructor(canvasRenderer) {
    this.canvasRenderer = canvasRenderer;
    this.canvas = canvasRenderer.ctx.canvas;
    
    this.position = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.zoom = 1;
    this.targetZoom = 1;
    this.rotation = 0;
    this.targetRotation = 0;
    this.timeScale = 1;
    
    this.shake = {
      intensity: 0,
      duration: 0,
      elapsed: 0,
      frequency: 60,
      decay: 0.95,
      offset: { x: 0, y: 0 },
      rotation: 0,
      trauma: 0
    };
    
    this.freeze = {
      active: false,
      duration: 0,
      elapsed: 0,
      intensity: 0
    };
    
    this.zoomConstraints = { min: 0.5, max: 3.0 };
    this.smoothness = 0.15;
    this.zoomSmoothness = 0.1;
    this.rotationSmoothness = 0.1;
    
    this.cinematicMode = false;
    this.cinematicTarget = null;
    this.cinematicZoom = 1.5;
    this.cinematicDuration = 0;
    this.cinematicElapsed = 0;
    
    this.focusTracking = false;
    this.focusTarget = null;
    this.focusSmoothness = 0.08;
    
    this.viewportWidth = canvasRenderer.width;
    this.viewportHeight = canvasRenderer.height;
    
    this.onShakeComplete = null;
    this.onFreezeComplete = null;
    this.onCinematicComplete = null;
  }

  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  update(dt) {
    const scaledDt = dt * this.timeScale;
    
    this.position.x += (this.targetPosition.x - this.position.x) * this.smoothness;
    this.position.y += (this.targetPosition.y - this.position.y) * this.smoothness;
    
    this.zoom += (this.targetZoom - this.zoom) * this.zoomSmoothness;
    this.rotation += (this.targetRotation - this.rotation) * this.rotationSmoothness;
    
    this.zoom = Math.max(this.zoomConstraints.min, Math.min(this.zoomConstraints.max, this.zoom));
    
    if (this.shake.intensity > 0) {
      this.shake.elapsed += scaledDt * 1000;
      const progress = this.shake.elapsed / this.shake.duration;
      
      if (progress >= 1) {
        this.shake.intensity = 0;
        this.shake.offset = { x: 0, y: 0 };
        this.shake.rotation = 0;
        if (this.onShakeComplete) {
          this.onShakeComplete();
          this.onShakeComplete = null;
        }
      } else {
        const decay = Math.pow(this.shake.decay, progress * 10);
        const currentIntensity = this.shake.intensity * decay;
        
        const angle1 = this.shake.elapsed * this.shake.frequency * 0.01;
        const angle2 = this.shake.elapsed * this.shake.frequency * 0.013;
        const angle3 = this.shake.elapsed * this.shake.frequency * 0.007;
        
        this.shake.offset.x = (Math.sin(angle1) * 0.7 + Math.sin(angle2) * 0.3) * currentIntensity;
        this.shake.offset.y = (Math.cos(angle1) * 0.5 + Math.cos(angle3) * 0.5) * currentIntensity;
        this.shake.rotation = (Math.sin(angle2) * 0.3) * currentIntensity * 0.001;
      }
    }
    
    if (this.freeze.active) {
      this.freeze.elapsed += scaledDt * 1000;
      if (this.freeze.elapsed >= this.freeze.duration) {
        this.freeze.active = false;
        if (this.onFreezeComplete) {
          this.onFreezeComplete();
          this.onFreezeComplete = null;
        }
      }
    }
    
    if (this.cinematicMode && this.cinematicDuration > 0) {
      this.cinematicElapsed += scaledDt * 1000;
      const progress = Math.min(this.cinematicElapsed / this.cinematicDuration, 1);
      const eased = Easing.easeInOutCubic(progress);
      
      if (this.cinematicTarget) {
        const targetPos = this.getSquareCenter(this.cinematicTarget);
        this.targetPosition.x = targetPos.x * (1 - eased) + this.position.x * eased;
        this.targetPosition.y = targetPos.y * (1 - eased) + this.position.y * eased;
        this.targetZoom = 1 + (this.cinematicZoom - 1) * (1 - eased);
      }
      
      if (progress >= 1) {
        this.cinematicMode = false;
        this.cinematicDuration = 0;
        this.cinematicElapsed = 0;
        this.cinematicTarget = null;
        this.position = { x: 0, y: 0 };
        this.targetPosition = { x: 0, y: 0 };
        this.zoom = 1;
        this.targetZoom = 1;
        this.rotation = 0;
        this.targetRotation = 0;
        if (this.onCinematicComplete) {
          this.onCinematicComplete();
          this.onCinematicComplete = null;
        }
      }
    }
    
    if (this.focusTracking && this.focusTarget) {
      const targetPos = this.getSquareCenter(this.focusTarget);
      this.targetPosition.x += (targetPos.x - this.targetPosition.x) * this.focusSmoothness;
      this.targetPosition.y += (targetPos.y - this.targetPosition.y) * this.focusSmoothness;
    }
  }

  getSquareCenter(square) {
    const { file, rank } = this.canvasRenderer.squareToCoord(square, 1);
    const { squareSize, boardOffsetX, boardOffsetY } = this.canvasRenderer;
    
    return {
      x: boardOffsetX + (file + 0.5) * squareSize,
      y: boardOffsetY + (rank + 0.5) * squareSize
    };
  }

  applyTransform(ctx) {
    const { width, height } = this.canvasRenderer;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.save();
    
    ctx.translate(centerX, centerY);
    ctx.scale(this.zoom, this.zoom);
    ctx.rotate(this.rotation + this.shake.rotation);
    ctx.translate(-centerX + this.shake.offset.x, -centerY + this.shake.offset.y);
    ctx.translate(-this.position.x, -this.position.y);
  }

  restoreTransform(ctx) {
    ctx.restore();
  }

  shakeCamera(intensity, duration = 500, options = {}) {
    this.shake.intensity = intensity;
    this.shake.duration = duration;
    this.shake.elapsed = 0;
    this.shake.frequency = options.frequency || 60;
    this.shake.decay = options.decay || 0.95;
    this.shake.trauma = options.trauma || 0;
    return new Promise(resolve => { this.onShakeComplete = resolve; });
  }

  freezeFrame(duration = 50, intensity = 1) {
    this.freeze.active = true;
    this.freeze.duration = duration;
    this.freeze.elapsed = 0;
    this.freeze.intensity = intensity;
    return new Promise(resolve => { this.onFreezeComplete = resolve; });
  }

  cinematicFocus(square, zoom = 1.8, duration = 800) {
    this.cinematicMode = true;
    this.cinematicTarget = square;
    this.cinematicZoom = zoom;
    this.cinematicDuration = duration;
    this.cinematicElapsed = 0;
    return new Promise(resolve => { this.onCinematicComplete = resolve; });
  }

  resetCinematic(duration = 600) {
    this.cinematicMode = true;
    this.cinematicTarget = null;
    this.cinematicZoom = 1;
    this.cinematicDuration = duration;
    this.cinematicElapsed = 0;
    return new Promise(resolve => { this.onCinematicComplete = resolve; });
  }

  enableFocusTracking(square) {
    this.focusTracking = true;
    this.focusTarget = square;
  }

  disableFocusTracking() {
    this.focusTracking = false;
    this.focusTarget = null;
  }

  panTo(square, duration = 400) {
    const targetPos = this.getSquareCenter(square);
    this.animatePosition(targetPos.x, targetPos.y, duration);
    return new Promise(resolve => {
      const check = () => {
        if (Math.abs(this.position.x - targetPos.x) < 1 && Math.abs(this.position.y - targetPos.y) < 1) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }

  animatePosition(x, y, duration = 400) {
    this.targetPosition.x = x;
    this.targetPosition.y = y;
  }

  setZoom(zoom, duration = 300) {
    this.targetZoom = Math.max(this.zoomConstraints.min, Math.min(this.zoomConstraints.max, zoom));
  }

  setRotation(rotation, duration = 300) {
    this.targetRotation = rotation;
  }

  setTimeScale(scale, duration = 0) {
    this.timeScale = Math.max(0.01, Math.min(2, scale));
    if (duration > 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, duration);
      });
    }
  }

  getTransform() {
    return {
      position: { ...this.position },
      zoom: this.zoom,
      rotation: this.rotation,
      shake: { ...this.shake.offset, rotation: this.shake.rotation }
    };
  }

  isShaking() { return this.shake.intensity > 0; }
  isFrozen() { return this.freeze.active; }
  isCinematic() { return this.cinematicMode; }

  reset() {
    this.position = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.zoom = 1;
    this.targetZoom = 1;
    this.rotation = 0;
    this.targetRotation = 0;
    this.shake = { intensity: 0, duration: 0, elapsed: 0, frequency: 60, decay: 0.95, offset: { x: 0, y: 0 }, rotation: 0, trauma: 0 };
    this.freeze = { active: false, duration: 0, elapsed: 0, intensity: 0 };
    this.cinematicMode = false;
    this.focusTracking = false;
    this.focusTarget = null;
  }
}
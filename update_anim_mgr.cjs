const fs = require('fs');
const f = 'src/animation/AnimationManager.js';
let s = fs.readFileSync(f, 'utf8');

// 1. Replace import block
const oldImport = `import {
  resolveCaptureTier,
  CaptureTier,
  EditDissolveEffect,
  PawnSplitEffect,
  KnightDarknessEffect,
  EpicClashEffect,
  RoyalDecapEffect
} from './CaptureAnimations.js'`;

const newImport = `import {
  resolveCaptureTier,
  CaptureTier,
  EditDissolveEffect,
  PawnSplitEffect,
  KnightDarknessEffect,
  EpicClashEffect,
  RoyalDecapEffect,
  QueenSlashEffect,
  RookPathEffect
} from './CaptureAnimations.js'`;

if (s.includes(oldImport)) {
  s = s.replace(oldImport, newImport);
  console.log('Updated imports');
} else {
  console.log('WARNING: could not find import block');
}

// 2. Replace resolveCaptureTier call to include isKnightFork
const oldTierCall = `        // Determine capture tier
        const tier = resolveCaptureTier(piece, victimPiece, false)
        this.captureTier = tier`;

const newTierCall = `        // Determine capture tier
        const isKnightFork = piece === Piece.KNIGHT ? this.detectKnightFork(to, color) : false
        const tier = resolveCaptureTier(piece, victimPiece, false, isKnightFork)
        this.captureTier = tier`;

if (s.includes(oldTierCall)) {
  s = s.replace(oldTierCall, newTierCall);
  console.log('Updated tier resolution');
} else {
  console.log('WARNING: could not find tier call');
}

// 3. Add switch cases for QUEEN_SLASH and ROOK_PATH
const oldSwitch = `        switch (tier) {
          case CaptureTier.KNIGHT_DARKNESS:
            this.captureEffect = new KnightDarknessEffect(
              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, color
            )
            break
          case CaptureTier.PAWN_SPLIT:
            this.captureEffect = new PawnSplitEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor, travelAngle
            )
            break
          case CaptureTier.EPIC_CLASH:
            this.captureEffect = new EpicClashEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
          case CaptureTier.ROYAL_DECAP:
            this.captureEffect = new RoyalDecapEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
          case CaptureTier.EDIT_DISSOLVE:
          default:
            this.captureEffect = new EditDissolveEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
        }`;

const newSwitch = `        switch (tier) {
          case CaptureTier.KNIGHT_DARKNESS:
            this.captureEffect = new KnightDarknessEffect(
              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, color
            )
            break
          case CaptureTier.QUEEN_SLASH:
            this.captureEffect = new QueenSlashEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
          case CaptureTier.ROOK_PATH:
            this.captureEffect = new RookPathEffect(
              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, victimColor
            )
            break
          case CaptureTier.PAWN_SPLIT:
            this.captureEffect = new PawnSplitEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor, travelAngle
            )
            break
          case CaptureTier.EPIC_CLASH:
            this.captureEffect = new EpicClashEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
          case CaptureTier.ROYAL_DECAP:
            this.captureEffect = new RoyalDecapEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
          case CaptureTier.EDIT_DISSOLVE:
          default:
            this.captureEffect = new EditDissolveEffect(
              this.canvasRenderer, cx, cy, pieceSize, victimColor
            )
            break
        }`;

if (s.includes(oldSwitch)) {
  s = s.replace(oldSwitch, newSwitch);
  console.log('Updated switch cases');
} else {
  console.log('WARNING: could not find switch block');
}

// 4. Add detectKnightFork method before getCamera
const oldGetCamera = `  getCamera() {
    return this.camera
  }`;

const newGetCamera = `  detectKnightFork(knightSq, knightColor) {
    // Knight attacks in L-shape: (±1,±2) and (±2,±1)
    const offsets = [
      [-1, -2], [1, -2], [-2, -1], [2, -1],
      [-2, 1], [2, 1], [-1, 2], [1, 2]
    ]
    const file = knightSq % 8
    const rank = Math.floor(knightSq / 8)
    let attackedCount = 0
    const position = this.engine.getPosition()
    for (const [df, dr] of offsets) {
      const nf = file + df
      const nr = rank + dr
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue
      const sq = nr * 8 + nf
      const targetPiece = position.board[sq]
      const targetColor = position.colors[sq]
      if (targetPiece !== 0 && targetColor !== knightColor && targetPiece !== Piece.PAWN) {
        attackedCount++
      }
    }
    return attackedCount >= 2
  }

  getCamera() {
    return this.camera
  }`;

if (s.includes(oldGetCamera)) {
  s = s.replace(oldGetCamera, newGetCamera);
  console.log('Added detectKnightFork');
} else {
  console.log('WARNING: could not find getCamera');
}

fs.writeFileSync(f, s, 'utf8');
console.log('AnimationManager.js updated');

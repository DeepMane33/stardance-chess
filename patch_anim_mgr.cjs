const fs = require('fs');
const f = 'src/animation/AnimationManager.js';
let s = fs.readFileSync(f, 'utf8');

// 1. Replace import block — use exact lines from the file
s = s.replace(
  `import {
  resolveCaptureTier,
  CaptureTier,
  EditDissolveEffect,
  PawnSplitEffect,
  KnightDarknessEffect,
  EpicClashEffect,
  RoyalDecapEffect
} from './CaptureAnimations.js'`,
  `import {
  resolveCaptureTier,
  CaptureTier,
  EditDissolveEffect,
  PawnSplitEffect,
  KnightDarknessEffect,
  EpicClashEffect,
  RoyalDecapEffect,
  QueenSlashEffect,
  RookPathEffect
} from './CaptureAnimations.js'`
);

// 2. Replace tier resolution to include fork detection
s = s.replace(
  `        // Determine capture tier\n        const tier = resolveCaptureTier(piece, victimPiece, false)\n        this.captureTier = tier`,
  `        // Determine capture tier\n        const isKnightFork = piece === Piece.KNIGHT ? this.detectKnightFork(to, color) : false\n        const tier = resolveCaptureTier(piece, victimPiece, false, isKnightFork)\n        this.captureTier = tier`
);

// 3. Add QUEEN_SLASH and ROOK_PATH to switch
s = s.replace(
  `          case CaptureTier.KNIGHT_DARKNESS:\n            this.captureEffect = new KnightDarknessEffect(\n              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, color\n            )\n            break\n          case CaptureTier.PAWN_SPLIT:`,
  `          case CaptureTier.KNIGHT_DARKNESS:\n            this.captureEffect = new KnightDarknessEffect(\n              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, color\n            )\n            break\n          case CaptureTier.QUEEN_SLASH:\n            this.captureEffect = new QueenSlashEffect(\n              this.canvasRenderer, cx, cy, pieceSize, victimColor\n            )\n            break\n          case CaptureTier.ROOK_PATH:\n            this.captureEffect = new RookPathEffect(\n              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, victimColor\n            )\n            break\n          case CaptureTier.PAWN_SPLIT:`
);

// 4. Add detectKnightFork before getCamera
s = s.replace(
  `  getCamera() {\n    return this.camera\n  }`,
  `  detectKnightFork(knightSq, knightColor) {\n    const offsets = [\n      [-1, -2], [1, -2], [-2, -1], [2, -1],\n      [-2, 1], [2, 1], [-1, 2], [1, 2]\n    ]\n    const file = knightSq % 8\n    const rank = Math.floor(knightSq / 8)\n    let attackedCount = 0\n    const position = this.engine.getPosition()\n    for (const [df, dr] of offsets) {\n      const nf = file + df\n      const nr = rank + dr\n      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue\n      const sq = nr * 8 + nf\n      const targetPiece = position.board[sq]\n      const targetColor = position.colors[sq]\n      if (targetPiece !== 0 && targetColor !== knightColor && targetPiece !== Piece.PAWN) {\n        attackedCount++\n      }\n    }\n    return attackedCount >= 2\n  }\n\n  getCamera() {\n    return this.camera\n  }`
);

fs.writeFileSync(f, s, 'utf8');
console.log('AnimationManager.js updated successfully');

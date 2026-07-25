const fs = require('fs');
const f = 'src/animation/AnimationManager.js';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);

// 1. Insert imports after line 13 (RoyalDecapEffect) — 0-indexed line 12
lines.splice(13, 0, '  QueenSlashEffect,', '  RookPathEffect');

// 2. After splice, line numbers shift by 2. Find tier resolution call.
// Look for: const tier = resolveCaptureTier(piece, victimPiece, false)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const tier = resolveCaptureTier(piece, victimPiece, false)')) {
    // Replace with fork detection + tier resolution
    lines[i] = `        const isKnightFork = piece === Piece.KNIGHT ? this.detectKnightFork(to, color) : false`;
    lines.splice(i + 1, 0, `        const tier = resolveCaptureTier(piece, victimPiece, false, isKnightFork)`);
    break;
  }
}

// 3. Find switch (CaptureTier.KNIGHT_DARKNESS) and insert new cases before PAWN_SPLIT
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'case CaptureTier.PAWN_SPLIT:') {
    lines.splice(i, 0,
      '          case CaptureTier.QUEEN_SLASH:',
      '            this.captureEffect = new QueenSlashEffect(',
      '              this.canvasRenderer, cx, cy, pieceSize, victimColor',
      '            )',
      '            break',
      '          case CaptureTier.ROOK_PATH:',
      '            this.captureEffect = new RookPathEffect(',
      '              this.canvasRenderer, fromX, fromY, toX, toY, pieceSize, victimColor',
      '            )',
      '            break'
    );
    break;
  }
}

// 4. Find getCamera() and insert detectKnightFork before it
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'getCamera() {' && lines[i + 1]?.trim() === 'return this.camera') {
    lines.splice(i, 0,
      '  detectKnightFork(knightSq, knightColor) {',
      '    const offsets = [',
      '      [-1, -2], [1, -2], [-2, -1], [2, -1],',
      '      [-2, 1], [2, 1], [-1, 2], [1, 2]',
      '    ]',
      '    const file = knightSq % 8',
      '    const rank = Math.floor(knightSq / 8)',
      '    let attackedCount = 0',
      '    const position = this.engine.getPosition()',
      '    for (const [df, dr] of offsets) {',
      '      const nf = file + df',
      '      const nr = rank + dr',
      '      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue',
      '      const sq = nr * 8 + nf',
      '      const targetPiece = position.board[sq]',
      '      const targetColor = position.colors[sq]',
      '      if (targetPiece !== 0 && targetColor !== knightColor && targetPiece !== Piece.PAWN) {',
      '        attackedCount++',
      '      }',
      '    }',
      '    return attackedCount >= 2',
      '  }',
      ''
    );
    break;
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('AnimationManager.js patched successfully');

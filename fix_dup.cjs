const fs = require('fs');
const f = 'src/animation/CaptureAnimations.js';
let s = fs.readFileSync(f, 'utf8');
const lines = s.split(/\r?\n/);
const target = 'const BIG_PIECES = new Set([Piece.QUEEN, Piece.ROOK, Piece.BISHOP, Piece.KNIGHT])';
let firstIdx = -1;
let secondIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === target) {
    if (firstIdx === -1) firstIdx = i;
    else if (secondIdx === -1) { secondIdx = i; break; }
  }
}
if (secondIdx !== -1) {
  // Find the line after the duplicate block that starts with "function isBigPiece"
  let resumeIdx = -1;
  for (let i = secondIdx; i < lines.length; i++) {
    if (lines[i].trim().startsWith('function isBigPiece')) {
      resumeIdx = i;
      break;
    }
  }
  if (resumeIdx === -1) resumeIdx = secondIdx + 3;
  const keep = lines.slice(0, firstIdx + 1).concat(lines.slice(resumeIdx));
  fs.writeFileSync(f, keep.join('\n'), 'utf8');
  console.log('Cleaned duplicates, now ' + keep.length + ' lines');
} else {
  console.log('No duplicates found');
}

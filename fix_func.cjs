const fs = require('fs');
const f = 'src/animation/CaptureAnimations.js';
let s = fs.readFileSync(f, 'utf8');

// The broken function body starts after "Determine the capture animation tier" comment
// and ends at the first standalone `}` before "EDIT DISSOLVE EFFECT"
const startMarker = `/**
 * Determine the capture animation tier based on attacker, victim, and game state.
 */`;
const endMarker = `/* ================================================================
   EDIT DISSOLVE EFFECT
   ================================================================ */`;

const startIdx = s.indexOf(startMarker);
const endIdx = s.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = `/**
 * Determine the capture animation tier based on attacker, victim, and game state.
 */
export function resolveCaptureTier(attackerPiece, victimPiece, isCheckmate = false, isKnightFork = false) {
  // Royal decap: capturing the king (checkmate situation)
  if (victimPiece === Piece.KING || isCheckmate) {
    return CaptureTier.ROYAL_DECAP
  }

  // Knight special: knight captures queen/rook OR delivers a fork
  if (attackerPiece === Piece.KNIGHT && (victimPiece === Piece.QUEEN || victimPiece === Piece.ROOK || isKnightFork)) {
    return CaptureTier.KNIGHT_DARKNESS
  }

  // Queen slash: queen captures anything except pawn
  if (attackerPiece === Piece.QUEEN && victimPiece !== Piece.PAWN) {
    return CaptureTier.QUEEN_SLASH
  }

  // Rook path: rook captures anything
  if (attackerPiece === Piece.ROOK) {
    return CaptureTier.ROOK_PATH
  }

  // Pawn split: pawn captures anything
  if (attackerPiece === Piece.PAWN) {
    return CaptureTier.PAWN_SPLIT
  }

  // Epic clash: big piece captures big piece
  if (isBigPiece(attackerPiece) && isBigPiece(victimPiece)) {
    return CaptureTier.EPIC_CLASH
  }

  // Default: edit dissolve
  return CaptureTier.EDIT_DISSOLVE
}

`;
  const before = s.slice(0, startIdx);
  const after = s.slice(endIdx);
  fs.writeFileSync(f, before + newFunc + after, 'utf8');
  console.log('Fixed resolveCaptureTier');
} else {
  console.log('Markers not found', startIdx, endIdx);
}

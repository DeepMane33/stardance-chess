export const Piece = {
  NONE: 0,
  PAWN: 1,
  KNIGHT: 2,
  BISHOP: 3,
  ROOK: 4,
  QUEEN: 5,
  KING: 6
}

export const Color = {
  NONE: 0,
  WHITE: 1,
  BLACK: 2
}

export const Square = {
  NONE: -1,
  A1: 0, B1: 1, C1: 2, D1: 3, E1: 4, F1: 5, G1: 6, H1: 7,
  A2: 8, B2: 9, C2: 10, D2: 11, E2: 12, F2: 13, G2: 14, H2: 15,
  A3: 16, B3: 17, C3: 18, D3: 19, E3: 20, F3: 21, G3: 22, H3: 23,
  A4: 24, B4: 25, C4: 26, D4: 27, E4: 28, F4: 29, G4: 30, H4: 31,
  A5: 32, B5: 33, C5: 34, D5: 35, E5: 36, F5: 37, G5: 38, H5: 39,
  A6: 40, B6: 41, C6: 42, D6: 43, E6: 44, F6: 45, G6: 46, H6: 47,
  A7: 48, B7: 49, C7: 50, D7: 51, E7: 52, F7: 53, G7: 54, H7: 55,
  A8: 56, B8: 57, C8: 58, D8: 59, E8: 60, F8: 61, G8: 62, H8: 63
}

export const MoveFlag = {
  QUIET: 0,
  CAPTURE: 1,
  DOUBLE_PAWN: 2,
  EN_PASSANT: 3,
  CASTLE_KING: 4,
  CASTLE_QUEEN: 5,
  PROMOTION: 6,
  PROMO_CAPTURE: 7
}

const FILES = 'abcdefgh'
const RANKS = '12345678'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function algebraicToSquare(alg) {
  const file = FILES.indexOf(alg[0])
  const rank = RANKS.indexOf(alg[1])
  return rank * 8 + file
}

export function squareToAlgebraic(sq) {
  if (sq < 0 || sq > 63) return '-'
  return FILES[sq % 8] + RANKS[Math.floor(sq / 8)]
}

export function makeMove(from, to, flags = 0, promotion = 0) {
  return from | (to << 6) | (flags << 12) | (promotion << 16)
}

export function getMoveFrom(move) { return move & 0x3F }
export function getMoveTo(move) { return (move >> 6) & 0x3F }
export function getMoveFlags(move) { return (move >> 12) & 0xF }
export function getMovePromotion(move) { return (move >> 16) & 0x7 }

export function parseFEN(fen) {
  const parts = fen.trim().split(' ')
  const board = new Array(64).fill(Piece.NONE)
  const colors = new Array(64).fill(Color.NONE)
  
  let rank = 7
  let file = 0
  for (const ch of parts[0]) {
    if (ch === '/') {
      rank--
      file = 0
      continue
    }
    if (ch >= '1' && ch <= '8') {
      file += parseInt(ch)
      continue
    }
    const color = ch === ch.toUpperCase() ? Color.WHITE : Color.BLACK
    const pieceChar = ch.toLowerCase()
    let piece
    switch (pieceChar) {
      case 'p': piece = Piece.PAWN; break
      case 'n': piece = Piece.KNIGHT; break
      case 'b': piece = Piece.BISHOP; break
      case 'r': piece = Piece.ROOK; break
      case 'q': piece = Piece.QUEEN; break
      case 'k': piece = Piece.KING; break
      default: piece = Piece.NONE; break
    }
    const sq = rank * 8 + file
    board[sq] = piece
    colors[sq] = color
    file++
  }

  return {
    board,
    colors,
    turn: parts[1] === 'w' ? Color.WHITE : Color.BLACK,
    castling: parts[2] || '-',
    enPassant: parts[3] === '-' ? Square.NONE : algebraicToSquare(parts[3]),
    halfmove: parseInt(parts[4]) || 0,
    fullmove: parseInt(parts[5]) || 1,
    pinned: new Uint8Array(64)
  }
}

export function generateFEN(position) {
  let fen = ''
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const sq = rank * 8 + file
      const piece = position.board[sq]
      if (piece === Piece.NONE) {
        empty++
      } else {
        if (empty > 0) { fen += empty; empty = 0 }
        const color = position.colors[sq]
        let ch = ''
        switch (piece) {
          case Piece.PAWN: ch = 'p'; break
          case Piece.KNIGHT: ch = 'n'; break
          case Piece.BISHOP: ch = 'b'; break
          case Piece.ROOK: ch = 'r'; break
          case Piece.QUEEN: ch = 'q'; break
          case Piece.KING: ch = 'k'; break
        }
        fen += color === Color.WHITE ? ch.toUpperCase() : ch
      }
    }
    if (empty > 0) fen += empty
    if (rank > 0) fen += '/'
  }
  
  fen += ' ' + (position.turn === Color.WHITE ? 'w' : 'b')
  fen += ' ' + (position.castling || '-')
  fen += ' ' + (position.enPassant === Square.NONE ? '-' : squareToAlgebraic(position.enPassant))
  fen += ' ' + position.halfmove
  fen += ' ' + position.fullmove
  return fen
}

export function isValidSquare(sq) { return sq >= 0 && sq < 64 }
export function sameFile(a, b) { return a % 8 === b % 8 }
export function sameRank(a, b) { return Math.floor(a / 8) === Math.floor(b / 8) }

export function squareToCoord(sq, orientation = 1) {
  const file = sq % 8
  const rank = Math.floor(sq / 8)
  if (orientation === 1) {
    return { file, rank: 7 - rank }
  } else {
    return { file: 7 - file, rank }
  }
}

export function coordToSquare(file, rank, orientation = 1) {
  if (orientation === 1) {
    return (7 - rank) * 8 + file
  } else {
    return rank * 8 + (7 - file)
  }
}

export const KNIGHT_OFFSETS = [-17, -15, -10, -6, 6, 10, 15, 17]
export const KING_OFFSETS = [-9, -8, -7, -1, 1, 7, 8, 9]
export const PAWN_ATTACKS = {
  [Color.WHITE]: [7, 9],
  [Color.BLACK]: [-7, -9]
}
export const BISHOP_DIRS = [-9, -7, 7, 9]
export const ROOK_DIRS = [-8, -1, 1, 8]
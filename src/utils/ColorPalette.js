export const Colors = {
  background: '#0a0a0f',
  board: {
    light: '#e8dcc8',
    dark: '#7d6b5a',
    lightHighlight: '#f5f0e1',
    darkHighlight: '#5d4e3d'
  },
  highlight: {
    move: 'rgba(255, 215, 0, 0.35)',
    capture: 'rgba(255, 60, 60, 0.45)',
    check: 'rgba(255, 50, 50, 0.6)',
    lastMove: 'rgba(255, 255, 100, 0.3)',
    selected: 'rgba(100, 200, 255, 0.4)',
    premove: 'rgba(100, 255, 100, 0.3)'
  },
  piece: {
    whiteStroke: '#1a1a2e',
    blackStroke: '#0a0a0f',
    whiteGlow: 'rgba(255, 255, 255, 0.6)',
    blackGlow: 'rgba(20, 20, 40, 0.8)'
  },
  ui: {
    primary: '#ffd700',
    secondary: '#00d4ff',
    danger: '#ff3c3c',
    success: '#4ade80',
    text: '#f0eae0',
    textDim: '#8b7d6b',
    panel: 'rgba(15, 15, 25, 0.92)',
    border: 'rgba(255, 215, 0, 0.2)'
  },
  effects: {
    sparkle: ['#ffd700', '#fff8dc', '#ffec8b', '#ffffe0'],
    capture: ['#ff3c3c', '#ff6b6b', '#ff9999', '#ffcccc'],
    magic: ['#00d4ff', '#7c4dff', '#ff4081', '#ffd700']
  },
  square: (file, rank) => (file + rank) % 2 === 0 ? Colors.board.light : Colors.board.dark
}
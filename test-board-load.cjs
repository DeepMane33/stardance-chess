const { chromium } = require('playwright');

async function testBoardLoad() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type()) || msg.text().includes('TEST')) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => console.log('[PAGE ERROR]', error.message));
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('[NAVIGATED] Page loaded');
  
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Check initial board state
  const boardState = await page.evaluate(() => {
    const game = window.game;
    if (!game || !game.engine) return { error: 'No game' };
    const pos = game.engine.getPosition();
    return {
      board: pos.board,
      colors: pos.colors,
      turn: game.engine.getTurn(),
      pieceCount: pos.board.filter(p => p !== 0).length
    };
  });
  
  console.log('[BOARD STATE]', boardState);
  
  await page.screenshot({ path: 'board-load-test.png', fullPage: true });
  console.log('[SCREENSHOT] Saved');
  
  await page.waitForTimeout(2000);
  await browser.close();
}

testBoardLoad().catch(console.error);
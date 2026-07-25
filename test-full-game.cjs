const { chromium } = require('playwright');

async function testFullGame() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type()) || msg.text().includes('TEST')) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => console.log('[PAGE ERROR]', error.message, error.stack));
  
  let loaded = false;
  for (const port of [3000, 3001, 3002]) {
    try {
      await page.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      loaded = true;
      console.log(`[NAVIGATED] Port ${port}`);
      break;
    } catch (e) {}
  }
  if (!loaded) { console.log('[ERROR] No server'); await browser.close(); return; }
  
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  await page.click('[data-action="play"]'); await page.waitForTimeout(500);
  await page.click('[data-action="select-bot"]'); await page.waitForTimeout(500);
  await page.click('[data-difficulty="beginner"]'); await page.waitForTimeout(500);
  await page.click('[data-time="0"]'); await page.waitForTimeout(3000);
  
  console.log('--- PLAYING 20 MOVES WITH CAPTURES ---');
  
  const result = await page.evaluate(async () => {
    const game = window.game;
    if (!game || !game.engine) return { success: false };
    
    const chess = game.engine.chess;
    const captures = [];
    let movesPlayed = 0;
    
    while (movesPlayed < 20 && !game.engine.getGameOver()) {
      // White move
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) break;
      
      // Prefer captures
      const capMoves = moves.filter(m => m.captured);
      const move = capMoves.length > 0 ? capMoves[0] : moves[0];
      
      console.log(`[TEST] White plays ${move.san}${move.captured ? ` (captures ${move.captured})` : ''}`);
      const result = game.engine.attemptMove(move.from, move.to);
      if (move.captured) captures.push({ move: move.san, side: 'white', result });
      movesPlayed++;
      await new Promise(r => setTimeout(r, 1200));
      
      if (game.engine.getGameOver()) break;
      
      // Black (bot) move
      const botMoves = chess.moves({ verbose: true });
      if (botMoves.length === 0) break;
      
      const botCapMoves = botMoves.filter(m => m.captured);
      const botMove = botCapMoves.length > 0 ? botCapMoves[0] : botMoves[0];
      
      console.log(`[TEST] Bot plays ${botMove.san}${botMove.captured ? ` (captures ${botMove.captured})` : ''}`);
      game.engine.attemptMove(botMove.from, botMove.to);
      if (botMove.captured) captures.push({ move: botMove.san, side: 'black', result: 'bot' });
      movesPlayed++;
      await new Promise(r => setTimeout(r, 1200));
    }
    
    return { success: true, captures, movesPlayed };
  });
  
  console.log('[RESULT]', result);
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'full-game-test.png', fullPage: true });
  console.log('[SCREENSHOT] Saved');
  
  await page.waitForTimeout(2000);
  await browser.close();
}

testFullGame().catch(console.error);
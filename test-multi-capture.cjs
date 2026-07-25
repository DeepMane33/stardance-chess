const { chromium } = require('playwright');

async function testMultipleCaptures() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'pageerror' || msg.text().includes('TEST') || msg.text().includes('RESULT') || msg.text().includes('Capture')) {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });
  
  let loaded = false;
  for (const port of [3000, 3001, 3002]) {
    try {
      await page.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      loaded = true;
      console.log(`[NAVIGATED] Page loaded on port ${port}`);
      break;
    } catch (e) {
      console.log(`[NAVIGATE] Failed on port ${port}`);
    }
  }
  
  if (!loaded) {
    console.log('[ERROR] Could not load game');
    await browser.close();
    return;
  }
  
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  await page.click('[data-action="play"]');
  await page.waitForTimeout(500);
  await page.click('[data-action="select-bot"]');
  await page.waitForTimeout(500);
  await page.click('[data-difficulty="beginner"]');
  await page.waitForTimeout(500);
  await page.click('[data-time="0"]');
  await page.waitForTimeout(3000);
  
  console.log('--- TESTING MULTIPLE CAPTURES ---');
  
  // Play several moves with captures
  const result = await page.evaluate(async () => {
    const game = window.game;
    if (!game || !game.engine) return { success: false, error: 'No game' };
    
    const chess = game.engine.chess;
    const captures = [];
    
    // Play a sequence that leads to multiple captures
    // White: d4, e4, d5, e5, Nc3 (captures)
    const whiteMoves = ['d4', 'e4', 'd5', 'e5', 'Nc3', 'Nxe5'];
    
    for (let i = 0; i < whiteMoves.length; i++) {
      const move = whiteMoves[i];
      const moves = chess.moves({ verbose: true });
      const m = moves.find(m => m.san === move);
      
      if (m) {
        console.log(`[TEST] White plays ${move}`);
        const result = game.engine.attemptMove(m.from, m.to);
        console.log(`[TEST] Result:`, result);
        captures.push({ move, isCapture: m.captured });
        await new Promise(r => setTimeout(r, 1000));
        
        // Bot move
        if (!game.engine.getGameOver()) {
          const botMoves = chess.moves({ verbose: true });
          if (botMoves.length > 0) {
            const botMove = botMoves[Math.floor(Math.random() * botMoves.length)];
            console.log(`[TEST] Bot plays ${botMove.san}`);
            game.engine.attemptMove(botMove.from, botMove.to);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }
    
    return { success: true, captures };
  });
  
  console.log('[RESULT]', result);
  
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'multi-capture-test.png', fullPage: true });
  console.log('[SCREENSHOT] Saved');
  
  await page.waitForTimeout(2000);
  await browser.close();
}

testMultipleCaptures().catch(console.error);
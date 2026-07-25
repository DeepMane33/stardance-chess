const { chromium } = require('playwright');

async function testCapture() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
    console.log('[STACK]', error.stack);
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('[NAVIGATED] Page loaded');
  
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
  
  console.log('--- GAME STARTED, FORCING CAPTURE SCENARIO ---');
  
  const result = await page.evaluate(async () => {
    const game = window.game;
    if (!game || !game.engine) return { error: 'No game' };
    
    const chess = game.engine.chess;
    let result;
    
    // White: d4 (pawn d2-d4)
    console.log('[TEST] White plays d4');
    result = game.engine.attemptMove('d2', 'd4');
    console.log('[TEST] d4 result:', result);
    await new Promise(r => setTimeout(r, 500));
    
    // Bot moves
    let moves = chess.moves({ verbose: true });
    console.log('[TEST] Bot moves:', moves.map(m => m.san));
    if (moves.length > 0) {
      const botMove = moves[0];
      result = game.engine.attemptMove(botMove.from, botMove.to);
      console.log('[TEST] Bot plays:', botMove.san, result);
      await new Promise(r => setTimeout(r, 500));
    }
    
    // White: e4 (pawn e2-e4) - now we have two center pawns
    console.log('[TEST] White plays e4');
    result = game.engine.attemptMove('e2', 'e4');
    console.log('[TEST] e4 result:', result);
    await new Promise(r => setTimeout(r, 500));
    
    // Bot moves
    moves = chess.moves({ verbose: true });
    console.log('[TEST] Bot moves:', moves.map(m => m.san));
    if (moves.length > 0) {
      const botMove = moves[0];
      result = game.engine.attemptMove(botMove.from, botMove.to);
      console.log('[TEST] Bot plays:', botMove.san, result);
      await new Promise(r => setTimeout(r, 500));
    }
    
    // White: d5 (pawn d4-d5) - attacks e6
    console.log('[TEST] White plays d5');
    result = game.engine.attemptMove('d4', 'd5');
    console.log('[TEST] d5 result:', result);
    await new Promise(r => setTimeout(r, 500));
    
    // Bot moves
    moves = chess.moves({ verbose: true });
    console.log('[TEST] Bot moves:', moves.map(m => m.san));
    if (moves.length > 0) {
      const botMove = moves[0];
      result = game.engine.attemptMove(botMove.from, botMove.to);
      console.log('[TEST] Bot plays:', botMove.san, result);
      await new Promise(r => setTimeout(r, 500));
    }
    
    // White: e5 (pawn e4-e5)
    console.log('[TEST] White plays e5');
    result = game.engine.attemptMove('e4', 'e5');
    console.log('[TEST] e5 result:', result);
    await new Promise(r => setTimeout(r, 500));
    
    // Now check for captures
    moves = chess.moves({ verbose: true });
    console.log('[TEST] Our moves:', moves.map(m => m.san));
    const captures = moves.filter(m => m.captured);
    console.log('[TEST] Capture moves:', captures.map(m => m.san));
    
    if (captures.length > 0) {
      const cap = captures[0];
      console.log('[TEST] Making capture:', cap.san);
      result = game.engine.attemptMove(cap.from, cap.to);
      console.log('[TEST] Capture result:', result);
      return { success: true, move: cap.san };
    }
    
    return { success: false, moves: moves.map(m => m.san) };
  });
  
  console.log('[RESULT]', result);
  
  if (result.success) {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'capture-test.png', fullPage: true });
    console.log('[SCREENSHOT] Saved');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
}

testCapture().catch(console.error);
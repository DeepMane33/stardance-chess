const { chromium } = require('playwright');

async function testCapture() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });
  
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait for game to load
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Click Play
  await page.click('[data-action="play"]');
  await page.waitForTimeout(500);
  
  // Click Play vs Bot
  await page.click('[data-action="select-bot"]');
  await page.waitForTimeout(500);
  
  // Select Beginner
  await page.click('[data-difficulty="beginner"]');
  await page.waitForTimeout(500);
  
  // Select time control (no time)
  await page.click('[data-time="0"]');
  await page.waitForTimeout(3000);
  
  console.log('--- GAME STARTED, NOW MAKING CAPTURE ---');
  
  // Now make a capture move
  const captureMade = await page.evaluate(async () => {
    const game = window.game;
    if (!game || !game.engine) return { success: false, error: 'No game' };
    
    // Try to make a capture move
    const chess = game.engine.chess;
    const moves = chess.moves({ verbose: true });
    const captureMoves = moves.filter(m => m.captured);
    
    console.log('All moves:', moves.map(m => m.san));
    console.log('Capture moves:', captureMoves.map(m => m.san));
    
    if (captureMoves.length > 0) {
      const move = captureMoves[0];
      console.log('Making capture:', move.san);
      const result = game.engine.attemptMove(move.from, move.to);
      console.log('Move result:', result);
      return { success: true, move: move.san };
    }
    
    return { success: false, error: 'No capture moves available' };
  });
  
  console.log('Capture result:', captureMade);
  
  if (captureMade.success) {
    // Wait for animation to complete
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'capture-test.png', fullPage: true });
    console.log('Screenshot saved');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
}

testCapture().catch(console.error);
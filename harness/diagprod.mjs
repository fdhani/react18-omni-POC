import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const srv = spawn('npx', ['vite', 'preview', '--port', '4399', '--strictPort'], { cwd: path.join(root, 'app18'), stdio: 'ignore' });
process.on('exit', () => srv.kill());
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4399/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
const browser = await chromium.launch();
for (const cell of ['2', '3', '4']) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(`http://localhost:4399/?cell=${cell}&pathB=1&duration=0&cards=6`);
  await page.waitForTimeout(2500);
  const i = await page.evaluate(() => ({
    cards: document.querySelectorAll('[data-card]').length,
    gridHeight: getComputedStyle(document.querySelector('.the-grid')).height,
    erd: document.querySelectorAll('.erd_scroll_detection_container').length,
    marks: window.__probe.marks.map(m => m.label),
  }));
  console.log(`PROD cell ${cell}: cards=${i.cards} gridHeight=${i.gridHeight} erdContainers=${i.erd} marks=${JSON.stringify(i.marks)}`);
  await page.close();
}
await browser.close(); srv.kill();

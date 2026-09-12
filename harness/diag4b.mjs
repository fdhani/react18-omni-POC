import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const srv = spawn('npx', ['vite', '--port', '5399', '--strictPort'], { cwd: path.join(root, 'app18'), stdio: 'ignore' });
process.on('exit', () => srv.kill());
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:5399/')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
const browser = await chromium.launch();
for (const cell of ['3', '4']) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.goto(`http://localhost:5399/?cell=${cell}&pathB=1&duration=0&cards=6`);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const root = document.getElementById('root');
    // element-resize-detector's scroll strategy injects a known marker element.
    const erd = document.querySelectorAll('.erd_scroll_detection_container');
    return {
      html: root.innerHTML.replace(/\s+/g, ' ').slice(0, 700),
      erdContainers: erd.length,
      erdParents: Array.from(erd).map(e => e.parentElement?.className || e.parentElement?.tagName),
    };
  });
  console.log(`\n===== cell ${cell} =====`);
  console.log('erd detector containers installed:', info.erdContainers, info.erdParents);
  console.log('DOM:', info.html);
  await page.close();
}
await browser.close(); srv.kill();

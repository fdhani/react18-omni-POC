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
  const logs = [];
  page.on('console', m => logs.push(m.text().slice(0, 160)));
  page.on('pageerror', e => logs.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.goto(`http://localhost:5399/?cell=${cell}&pathB=1&duration=0&cards=6`);
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => {
    const grid = document.querySelector('.the-grid');
    const kids = grid ? Array.from(grid.children) : [];
    return {
      marks: window.__probe.marks.map(m => m.label),
      gridChildren: kids.length,
      gridHeight: grid ? getComputedStyle(grid).height : null,
      cardTexts: Array.from(document.querySelectorAll('[data-card]')).map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)),
      cardHeights: Array.from(document.querySelectorAll('[data-card]')).map(c => c.offsetHeight),
      transforms: kids.map(k => getComputedStyle(k).transform),
    };
  });
  console.log(`\n===== cell ${cell} =====`);
  console.log(JSON.stringify(info, null, 2));
  console.log('logs with strictmode/loop hints:', logs.filter(l => /Strict|unmount|loop|Maximum|findDOMNode/i.test(l)).length);
  await page.close();
}
await browser.close();
srv.kill();

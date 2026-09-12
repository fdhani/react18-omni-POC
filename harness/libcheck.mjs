import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Drives the dependency-stack smoke test (?libs=1) through the same cell
 * matrix as the stack-grid repro (legacy root / createRoot / createRoot +
 * StrictMode), in both `vite dev` (to see React's dev warnings) and a
 * production build (to see what actually reaches real users), and reports
 * per-library: did it mount, did it throw, and any notes each demo recorded
 * (e.g. the redux tearing-probe counts, or the react-virtualized/Vite finding).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const MODE = process.argv[2] ?? 'prod'; // prod | dev
const PORT = MODE === 'dev' ? 5197 : 4197;
const OUT = path.join(root, 'results');
fs.mkdirSync(OUT, { recursive: true });

async function portFree(p) {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.once('error', () => res(false));
    srv.once('listening', () => srv.close(() => res(true)));
    srv.listen(p, '127.0.0.1');
  });
}
for (let i = 0; i < 60 && !(await portFree(PORT)); i++) await new Promise((r) => setTimeout(r, 500));

const bin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const args =
  MODE === 'dev'
    ? [bin, '--port', String(PORT), '--strictPort']
    : [bin, 'preview', '--port', String(PORT), '--strictPort'];
const srv = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], detached: true });
const shutdown = () => {
  try {
    process.kill(-srv.pid, 'SIGKILL');
  } catch {}
};
process.on('exit', shutdown);

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const CELLS = ['2', '3', '4'];
const all = {};

for (const cell of CELLS) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const consoleMsgs = [];
  const pageErrors = [];
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`.slice(0, 400)));
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 500)));
  await page.goto(`http://localhost:${PORT}/?cell=${cell}&libs=1`, { waitUntil: 'load' });
  await page.waitForTimeout(3000); // let the redux tear-probe and effects settle

  const results = await page.evaluate(() => window.__libResults ?? {});
  const mode = await page.evaluate(() => window.__MODE__ ?? '?');
  const reactVersion = await page.evaluate(() => window.__REACT_VERSION__ ?? '?');
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));

  all[cell] = {
    cell,
    mode,
    reactVersion,
    results,
    consoleErrorCount: consoleMsgs.filter((m) => m.startsWith('error')).length,
    consoleWarningCount: consoleMsgs.filter((m) => m.startsWith('warning')).length,
    pageErrors,
    consoleErrors: consoleMsgs.filter((m) => m.startsWith('error')),
    consoleWarnings: consoleMsgs.filter((m) => m.startsWith('warning')),
    bodyTextSample: bodyText,
  };

  console.log(`\n=== cell ${cell} (${mode}) [${MODE}] ===`);
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name}: ${r.status}  mounts=${r.mounts} unmounts=${r.unmounts}${r.error ? '  ERROR: ' + r.error.split('\n')[0] : ''}`);
    for (const n of r.notes ?? []) console.log(`    note: ${n}`);
  }
  console.log(`  console errors: ${all[cell].consoleErrorCount}, warnings: ${all[cell].consoleWarningCount}, pageErrors: ${pageErrors.length}`);
  if (pageErrors.length) pageErrors.forEach((e) => console.log(`    pageerror: ${e}`));

  await page.close();
}

await browser.close();
shutdown();
fs.writeFileSync(path.join(OUT, `libcheck-${MODE}.json`), JSON.stringify(all, null, 2));
console.log(`\nwrote results/libcheck-${MODE}.json`);
process.exit(0);

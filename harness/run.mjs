import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const MODE = process.argv[2] ?? 'prod'; // prod | dev
const DURATION = process.argv[3] ?? '0'; // react-stack-grid `duration` prop
const CARDS = process.argv[4] ?? '6';
const OUT = path.join(root, 'results');
fs.mkdirSync(OUT, { recursive: true });

const PORTS = { app18: MODE === 'dev' ? 5318 : 4318 };

function startServer(app) {
  const port = PORTS[app];
  // Spawn vite's binary directly (not via npx) in its own process group, so it
  // can actually be killed. An npx grandchild survives and keeps the port.
  const bin = path.join(root, app, 'node_modules', 'vite', 'bin', 'vite.js');
  const args = MODE === 'dev'
    ? [bin, '--port', String(port), '--strictPort']
    : [bin, 'preview', '--port', String(port), '--strictPort'];
  const p = spawn(process.execPath, args, {
    cwd: path.join(root, app),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  p.stdout.on('data', () => {});
  p.stderr.on('data', (d) => process.stderr.write(`[${app}] ${d}`));
  return p;
}

import net from 'node:net';

async function waitPortFree(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const free = await new Promise((res) => {
      const srv = net.createServer();
      srv.once('error', () => res(false));
      srv.once('listening', () => srv.close(() => res(true)));
      srv.listen(port, '127.0.0.1');
    });
    if (free) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`port ${port} never freed`);
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server never came up: ${url}`);
}

// Viewport widths driving Path A. Container is max-width 994 with 32px of body
// padding, so every step below 1026 actually changes the container width.
const WIDTHS = [1000, 960, 920, 880, 840, 800, 760, 720, 680, 640, 600, 640, 700, 760, 820, 880, 940, 1000];

async function runCell({ browser, cell, url, path: pathName, video }) {
  const ctx = await browser.newContext({
    viewport: { width: 1000, height: 900 },
    ...(video ? { recordVideo: { dir: path.join(OUT, `video-${MODE}-d${DURATION}-c${CARDS}`), size: { width: 1000, height: 900 } } } : {}),
  });
  const page = await ctx.newPage();
  const console_ = [];
  page.on('console', (m) => console_.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  page.on('pageerror', (e) => console_.push(`pageerror: ${String(e).slice(0, 300)}`));

  await page.goto(url, { waitUntil: 'load' });
  // Let mount + initial layout + (for pathB) the 800ms fetch fully settle.
  await page.waitForTimeout(pathName === 'B' ? 0 : 2000);

  if (pathName === 'A') {
    await page.evaluate(() => window.__probe.mark('A:resize-start'));
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.__probe.mark('A:resize-end'));
    await page.waitForTimeout(500);
  } else {
    // Path B: the async card resolves at ~800ms and calls updateLayout().
    await page.waitForTimeout(2500);
  }

  const res = await page.evaluate(() => {
    window.__probe.stop();
    return {
      ...window.__probe.result(true),
      reactVersion: window.__REACT_VERSION__,
      modeLabel: window.__MODE__,
    };
  });
  res.cell = cell;
  res.trigger = pathName;
  res.console = console_.slice(0, 40);
  res.consoleCount = console_.length;

  const vid = page.video();
  const vPath = vid ? await vid.path() : null;
  await page.close();
  await ctx.close();
  if (vPath) {
    const dest = path.join(path.dirname(vPath), `cell${cell}-path${pathName}.webm`);
    try { fs.renameSync(vPath, dest); res.video = dest; } catch {}
  }
  return res;
}

await waitPortFree(PORTS.app18);
const servers = [startServer('app18')];
process.on('exit', () => { for (const s of servers) { try { process.kill(-s.pid, 'SIGKILL'); } catch {} } });

try {
  await waitFor(`http://localhost:${PORTS.app18}/`);

  const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
  const q = (cell, pathName) =>
    `cell=${cell}&pathB=${pathName === 'B' ? 1 : 0}&duration=${DURATION}&cards=${CARDS}`;

  const cells = [
    { cell: '2', base: `http://localhost:${PORTS.app18}/` },
    { cell: '3', base: `http://localhost:${PORTS.app18}/` },
    { cell: '4', base: `http://localhost:${PORTS.app18}/` },
  ];

  const all = [];
  for (const { cell, base } of cells) {
    for (const pathName of ['A', 'B']) {
      const video = pathName === 'A' && (cell === '2' || cell === '3');
      const r = await runCell({ browser, cell, url: `${base}?${q(cell, pathName)}`, path: pathName, video });
      all.push(r);
      console.log(
        `cell ${cell} path ${pathName}  react=${r.reactVersion}  frames=${r.frames}  ` +
        `wChanges=${r.widthChangeFrames} tornW=${r.tornFramesWidth}  ` +
        `hChanges=${r.heightChangeFrames} tornH=${r.tornFramesHeight}  ` +
        `overlap=${r.overlapFrames} overflow=${r.overflowFrames}  console=${r.consoleCount}`,
      );
    }
  }
  await browser.close();
  const file = path.join(OUT, `results-${MODE}-duration${DURATION}-cards${CARDS}.json`);
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
  console.log('wrote', file);
} finally {
  for (const s of servers) { try { process.kill(-s.pid, 'SIGKILL'); } catch { try { s.kill('SIGKILL'); } catch {} } }
  setTimeout(() => process.exit(0), 500).unref();
  process.exit(0);
}

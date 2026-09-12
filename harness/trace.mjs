import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Records a DevTools performance trace while driving Path A, then reports
 * whether Paint events actually occur between the TEAR mark (container resized,
 * transforms stale) and the SETTLE mark (transforms caught up).
 *
 * rAF-based measurement says "a frame was scheduled with stale transforms";
 * this says "the compositor actually painted it".
 */
const [, , cellArg] = process.argv;
const cell = cellArg ?? '3';
const app = cell === '1' ? 'app17' : 'app18';
const port = cell === '1' ? 4517 : 4518;
const OUT = path.resolve(import.meta.dirname, '..', 'results');
const root = path.resolve(import.meta.dirname, '..');

async function portFree(p) {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.once('error', () => res(false));
    srv.once('listening', () => srv.close(() => res(true)));
    srv.listen(p, '127.0.0.1');
  });
}
for (let i = 0; i < 60 && !(await portFree(port)); i++) await new Promise((r) => setTimeout(r, 500));

const srv = spawn(process.execPath,
  [path.join(root, app, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(port), '--strictPort'],
  { cwd: path.join(root, app), stdio: ['ignore', 'ignore', 'inherit'], detached: true });
const shutdown = () => { try { process.kill(-srv.pid, 'SIGKILL'); } catch {} };
process.on('exit', shutdown);
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
const page = await ctx.newPage();
const client = await ctx.newCDPSession(page);

await client.send('Tracing.start', {
  traceConfig: {
    includedCategories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'blink.user_timing',
      'latencyInfo',
    ],
  },
  transferMode: 'ReturnAsStream',
});

await page.goto(`http://localhost:${port}/?cell=${cell}&pathB=0&duration=0&cards=6`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
for (const w of [960, 900, 840, 780, 720, 660, 600, 700, 800, 900, 1000]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);

const { stream } = await client.send('Tracing.end').then(
  () => new Promise((res) => client.once('Tracing.tracingComplete', res)),
);
let data = '';
for (;;) {
  const r = await client.send('IO.read', { handle: stream, size: 1 << 20 });
  data += r.base64Encoded ? Buffer.from(r.data, 'base64').toString() : r.data;
  if (r.eof) break;
}
await client.send('IO.close', { handle: stream });
const file = path.join(OUT, `trace-cell${cell}.json`);
fs.writeFileSync(file, data);

const events = JSON.parse(data).traceEvents ?? JSON.parse(data);
const marks = events.filter((e) => e.name === 'TEAR' || e.name === 'SETTLE').sort((a, b) => a.ts - b.ts);
const paints = events.filter((e) => e.name === 'Paint' || e.name === 'CompositeLayers' || e.name === 'RasterTask').sort((a, b) => a.ts - b.ts);
const frames = events.filter((e) => e.name === 'DrawFrame' || e.name === 'Commit').sort((a, b) => a.ts - b.ts);

let windows = 0, withPaint = 0, totalPaints = 0, totalFrames = 0;
for (let i = 0; i < marks.length - 1; i++) {
  if (marks[i].name !== 'TEAR' || marks[i + 1].name !== 'SETTLE') continue;
  const a = marks[i].ts, b = marks[i + 1].ts;
  windows++;
  const p = paints.filter((e) => e.ts >= a && e.ts <= b).length;
  const f = frames.filter((e) => e.ts >= a && e.ts <= b).length;
  totalPaints += p; totalFrames += f;
  if (p > 0 || f > 0) withPaint++;
}
console.log(JSON.stringify({
  cell, traceFile: file, traceEvents: events.length,
  tearWindows: windows, windowsContainingPaintOrFrame: withPaint,
  totalPaintEvents: totalPaints, totalDrawFrameOrCommit: totalFrames,
}, null, 2));

await browser.close();
shutdown();
process.exit(0);

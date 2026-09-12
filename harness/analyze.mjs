import fs from 'node:fs';

/**
 * For each frame where the container width changed, measure how long the
 * children's transforms stayed stale: how many subsequent frames were painted
 * before the transforms caught up, how many milliseconds that lasted, and how
 * far the cards were visually displaced when they finally jumped.
 *
 * "One torn frame" is the floor for any async measure-then-setState design.
 * A *concurrent-scheduling* regression should show up as a longer tail.
 */
function analyze(run) {
  const f = run.raw ?? [];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const events = [];

  for (let i = 1; i < f.length; i++) {
    if (f[i].w === f[i - 1].w) continue;
    const stale = f[i - 1].transforms;
    let j = i;
    while (j < f.length && same(f[j].transforms, stale)) j++;
    if (j >= f.length) {
      events.push({ lagFrames: f.length - i, lagMs: f[f.length - 1].t - f[i].t, jumpPx: null, unresolved: true });
      continue;
    }
    let jump = 0;
    for (let k = 0; k < f[j].tx.length; k++) {
      jump = Math.max(jump, Math.abs((f[j].tx[k] ?? 0) - (f[i].tx[k] ?? 0)), Math.abs((f[j].ty[k] ?? 0) - (f[i].ty[k] ?? 0)));
    }
    events.push({ lagFrames: j - i, lagMs: f[j].t - f[i].t, jumpPx: Math.round(jump), unresolved: false });
  }

  const lagF = events.map((e) => e.lagFrames).sort((a, b) => a - b);
  const lagMs = events.map((e) => e.lagMs).sort((a, b) => a - b);
  const jumps = events.filter((e) => e.jumpPx != null).map((e) => e.jumpPx).sort((a, b) => a - b);
  const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : 0);
  const hist = {};
  for (const e of events) hist[e.lagFrames] = (hist[e.lagFrames] ?? 0) + 1;

  return {
    cell: run.cell,
    trigger: run.trigger,
    react: run.reactVersion,
    mode: run.modeLabel,
    frames: run.frames,
    widthChanges: events.length,
    lagFramesMedian: pct(lagF, 0.5),
    lagFramesMax: lagF[lagF.length - 1] ?? 0,
    lagMsMedian: Math.round(pct(lagMs, 0.5)),
    lagMsMax: Math.round(lagMs[lagMs.length - 1] ?? 0),
    jumpPxMedian: pct(jumps, 0.5),
    jumpPxMax: jumps[jumps.length - 1] ?? 0,
    lagHistogram: hist,
    tornFramesWidth: run.tornFramesWidth,
    overlapFrames: run.overlapFrames,
    consoleCount: run.consoleCount,
  };
}

const file = process.argv[2];
const runs = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = runs.map(analyze);
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n=== ${file} ===`);
console.log(pad('cell', 5) + pad('path', 5) + pad('react', 8) + pad('wChg', 6) + pad('lagFrames med/max', 19) + pad('lagMs med/max', 15) + pad('jumpPx med/max', 16) + pad('overlap', 8) + 'lagHistogram');
for (const r of rows) {
  console.log(
    pad(r.cell, 5) + pad(r.trigger, 5) + pad(r.react, 8) + pad(r.widthChanges, 6) +
    pad(`${r.lagFramesMedian} / ${r.lagFramesMax}`, 19) +
    pad(`${r.lagMsMedian} / ${r.lagMsMax}`, 15) +
    pad(`${r.jumpPxMedian} / ${r.jumpPxMax}`, 16) +
    pad(r.overlapFrames, 8) +
    JSON.stringify(r.lagHistogram),
  );
}
fs.writeFileSync(file.replace(/\.json$/, '-analysis.json'), JSON.stringify(rows, null, 2));

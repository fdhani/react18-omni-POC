import fs from 'node:fs';

/**
 * Path B: the async card grows its own height, then a passive effect calls
 * updateLayout(). Measure the window between the card's box actually growing
 * and the grid's transforms catching up, plus the worst overlap painted in it.
 */
function analyze(run) {
  const f = run.raw ?? [];
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  let grow = -1;
  for (let i = 1; i < f.length; i++) {
    if (f[i].ch.some((h, k) => h !== (f[i - 1].ch[k] ?? h))) { grow = i; break; }
  }
  if (grow < 0) return { cell: run.cell, trigger: run.trigger, react: run.reactVersion, found: false };

  const stale = f[grow - 1].transforms;
  let j = grow;
  while (j < f.length && same(f[j].transforms, stale)) j++;

  let worstOverlap = 0;
  let containerShort = 0;
  for (let i = grow; i < Math.min(j + 1, f.length); i++) {
    const fr = f[i];
    for (let a = 0; a < fr.tx.length; a++) {
      for (let b = a + 1; b < fr.tx.length; b++) {
        const ox = Math.min(fr.tx[a] + fr.cw[a], fr.tx[b] + fr.cw[b]) - Math.max(fr.tx[a], fr.tx[b]);
        const oy = Math.min(fr.ty[a] + fr.ch[a], fr.ty[b] + fr.ch[b]) - Math.max(fr.ty[a], fr.ty[b]);
        if (ox > 1 && oy > 1) worstOverlap = Math.max(worstOverlap, Math.round(oy));
      }
      containerShort = Math.max(containerShort, Math.round(fr.ty[a] + fr.ch[a] - fr.h));
    }
  }
  return {
    cell: run.cell, trigger: run.trigger, react: run.reactVersion, found: true,
    staleFrames: j - grow,
    staleMs: Math.round((f[Math.min(j, f.length - 1)].t - f[grow].t)),
    worstOverlapPx: worstOverlap,
    containerOverflowPx: Math.max(0, containerShort),
    marks: run.marks?.map((m) => m.label) ?? [],
  };
}

const runs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((r) => r.trigger === 'B');
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n=== Path B — ${process.argv[2]} ===`);
console.log(pad('cell', 5) + pad('react', 8) + pad('staleFrames', 13) + pad('staleMs', 9) + pad('worstOverlapPx', 16) + 'containerOverflowPx');
for (const r of runs.map(analyze)) {
  if (!r.found) { console.log(pad(r.cell, 5) + pad(r.react, 8) + 'no growth detected'); continue; }
  console.log(pad(r.cell, 5) + pad(r.react, 8) + pad(r.staleFrames, 13) + pad(r.staleMs, 9) + pad(r.worstOverlapPx, 16) + r.containerOverflowPx);
}

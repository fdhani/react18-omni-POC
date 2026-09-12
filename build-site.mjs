// Combines the two app builds into one static site for Vercel.
//   /r18/  -> React 18 bundle (cells 2, 3, 4 via ?cell=)
//   /r17/  -> React 17 bundle (cell 1)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname;
const dist = path.join(root, 'dist');

for (const app of ['app18', 'app17']) {
  console.log(`building ${app}…`);
  execSync('npx vite build', { cwd: path.join(root, app), stdio: 'inherit' });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(root, 'app18', 'dist'), path.join(dist, 'r18'), { recursive: true });
fs.cpSync(path.join(root, 'app17', 'dist'), path.join(dist, 'r17'), { recursive: true });

const cells = [
  ['1', 'r17', 'React 17.0.2 · ReactDOM.render', 'Baseline control'],
  ['2', 'r18', 'React 18.3.1 · ReactDOM.render (legacy root)', 'Isolates "React 18" from "concurrent root"'],
  ['3', 'r18', 'React 18.3.1 · createRoot', 'The hypothesis'],
  ['4', 'r18', 'React 18.3.1 · createRoot + StrictMode', 'Double-invoked effects'],
];

const link = (c, dir, extra = '') => `/${dir}/index.html?cell=${c}${extra}`;

fs.writeFileSync(
  path.join(dist, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>react-stack-grid 0.7.1 × React 18 — repro matrix</title>
<style>
 body{font:15px/1.6 system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#111}
 h1{font-size:22px} table{border-collapse:collapse;width:100%;margin:20px 0}
 th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top}
 th{background:#f5f5f5} code{background:#f0f0f0;padding:1px 4px;border-radius:3px}
 a{color:#0645ad}
</style></head><body>
<h1>react-stack-grid 0.7.1 × React 18 — reflow tear repro</h1>
<p>Each cell renders the same grid from the same source. Resize the window (Path A) or
watch card 3 load after 800 ms (Path B). Per-frame instrumentation is on
<code>window.__probe</code>; call <code>__probe.result()</code> in the console.</p>
<p>Query params: <code>?cell=</code> <code>&amp;pathB=0|1</code>
<code>&amp;duration=</code> (react-stack-grid transition ms, default 0 here)
<code>&amp;cards=</code> (default 6).</p>
<table><tr><th>Cell</th><th>Configuration</th><th>Purpose</th><th>Links</th></tr>
${cells
  .map(
    ([c, dir, cfg, purpose]) =>
      `<tr><td><b>${c}</b></td><td>${cfg}</td><td>${purpose}</td><td>` +
      `<a href="${link(c, dir, '&pathB=0')}">Path A (resize)</a><br>` +
      `<a href="${link(c, dir, '&pathB=1')}">Path B (async grow)</a><br>` +
      `<a href="${link(c, dir, '&pathB=0&duration=480')}">Path A, duration=480 (library default)</a></td></tr>`,
  )
  .join('\n')}
</table>
<p>This is a production build (<code>vite build</code>), so React's development
warnings are compiled out. Run the repo locally with <code>npm run dev</code> to see them.</p>
</body></html>`,
);

console.log('site ->', dist);

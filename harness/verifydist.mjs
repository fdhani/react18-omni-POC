import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn(process.execPath, ['-e', `
  const http=require('http'),fs=require('fs'),p=require('path');
  const root='/home/user/react18-omni-POC/dist';
  const types={'.html':'text/html','.js':'text/javascript','.map':'application/json'};
  http.createServer((q,r)=>{let f=p.join(root,decodeURIComponent(q.url.split('?')[0]));
    if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=p.join(f,'index.html');
    if(!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}
    r.writeHead(200,{'content-type':types[p.extname(f)]||'application/octet-stream'});
    fs.createReadStream(f).pipe(r);}).listen(4600);
`], { stdio: 'inherit', detached: true });
process.on('exit', () => { try { process.kill(-srv.pid, 'SIGKILL'); } catch {} });
for (let i=0;i<40;i++){try{if((await fetch('http://localhost:4600/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));}

const browser = await chromium.launch();
const urls = [
  ['2', 'http://localhost:4600/r18/index.html?cell=2&pathB=1'],
  ['3', 'http://localhost:4600/r18/index.html?cell=3&pathB=1'],
  ['4', 'http://localhost:4600/r18/index.html?cell=4&pathB=1'],
];
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0,120)));
for (const [cell, url] of urls) {
  await page.goto(url); await page.waitForTimeout(2200);
  const i = await page.evaluate(() => ({
    react: window.__REACT_VERSION__, mode: window.__MODE__,
    cards: document.querySelectorAll('[data-card]').length,
    h: getComputedStyle(document.querySelector('.the-grid')).height,
    dev: !!(window.__probe && document.querySelector('.the-grid')),
  }));
  console.log(`cell ${cell}: react=${i.react} cards=${i.cards} gridHeight=${i.h}  mode="${i.mode}"`);
}
// Landing page links
await page.goto('http://localhost:4600/');
const links = await page.$$eval('a', as => as.map(a => a.getAttribute('href')));
console.log('landing links:', links.length);
console.log('pageerrors:', errs.length ? errs : 'none');
await browser.close(); try { process.kill(-srv.pid, 'SIGKILL'); } catch {} process.exit(0);

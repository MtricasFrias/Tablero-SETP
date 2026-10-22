/* Convierte manual/manual.html en PDF con Edge sin ventana (CDP, con numeración de páginas).   node manual/crear-pdf.js → manual/Manual-de-usuario-Tablero-SETP.pdf */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', PORT = 9334;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const src = 'file:///' + path.join(__dirname, 'manual.html').replace(/\\/g, '/');
const dest = path.join(__dirname, 'Manual-de-usuario-Tablero-SETP.pdf');
let ws, id = 0; const pend = new Map();
const cdp = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setp-pdf-'));
  const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + tmp, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
  try {
    let v; for (let i = 0; i < 50 && !v; i++) { try { v = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); } catch (e) { await sleep(300); } }
    ws = new WebSocket(v.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } });
    await cdp('Page.enable'); await cdp('Page.navigate', { url: src }); await sleep(2500);
    for (let i = 0; i < 40; i++) { const r = await cdp('Runtime.evaluate', { expression: '[document.readyState, [...document.images].every(i=>i.complete)].join()', returnByValue: true }); if (r.result.value === 'complete,true') break; await sleep(300); }
    const footer = '<div style="font:8px Segoe UI,Arial,sans-serif;color:#667;width:100%;text-align:center;padding:0 15mm">Manual de usuario · Tablero de seguimiento SETP Ibagué · Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>';
    const r = await cdp('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer });
    fs.writeFileSync(dest, Buffer.from(r.data, 'base64')); console.log('PDF:', dest, (fs.statSync(dest).size / 1048576).toFixed(1) + ' MB');
  } finally { try { ws.close(); } catch (e) {} edge.kill(); await sleep(500); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });

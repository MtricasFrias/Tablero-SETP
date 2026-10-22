/* Toma las capturas del manual con Edge sin ventana (CDP) contra el servidor local de pruebas (datos de mentira, en memoria).
   1) node tools/devserver.js 8770      2) node manual/capturar.js      → manual/capturas/*.jpg       (Node 24, Windows + Edge) */
'use strict';
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', BASE = 'http://localhost:8770', PORT = 9333;
const USER = 'UsuarioDePrueba', PASS = 'ClaveDePrueba_Local1';
const out = path.join(__dirname, 'capturas'); fs.mkdirSync(out, { recursive: true });
const ej = f => path.join(__dirname, '..', 'admin', 'ejemplos', f).replace(/\//g, '\\');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, id = 0; const pend = new Map();
const cdp = (method, params) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
async function ev(expr) { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text) + ' en ' + expr.slice(0, 120)); return r.result.value; }
async function go(url, ms) { await cdp('Page.navigate', { url }); await sleep(600); for (let i = 0; i < 60 && (await ev('document.readyState')) !== 'complete'; i++) await sleep(200); await sleep(ms || 900); }
async function size(w, h, mobile) { await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1.5, mobile: !!mobile }); await sleep(300); }
const waitFor = async (sel, ms) => { for (let i = 0; i < (ms || 8000) / 150; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await sleep(150); } throw new Error('no apareció ' + sel); };
const click = async sel => { await waitFor(sel); await ev(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(350); };
const clickText = async (tag, txt) => { await ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(tag)})].find(x=>x.textContent.includes(${JSON.stringify(txt)})); if(!b) throw new Error('sin botón ${txt}'); b.click();})()`); await sleep(400); };
const fill = async (sel, v) => { await waitFor(sel); await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(v)}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));})()`); };
async function setFiles(sel, files) { const d = await cdp('DOM.getDocument', { depth: 1 }); const n = await cdp('DOM.querySelector', { nodeId: d.root.nodeId, selector: sel }); await cdp('DOM.setFileInputFiles', { files, nodeId: n.nodeId }); await sleep(1500); }
async function mouse(x, y) { for (const t of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type: t, x, y, button: 'left', clickCount: 1 }); await sleep(500); }

/* marcas numeradas sobre la captura */
async function marcas(lista) {
  await ev(`(()=>{ document.querySelectorAll('.mk').forEach(e=>e.remove()); const L=${JSON.stringify(lista)};
    L.forEach(([sel,n,pos])=>{ const el=document.querySelector(sel); if(!el) return; const r=el.getBoundingClientRect(); const m=document.createElement('div'); m.className='mk'; m.textContent=n;
      const p=pos||'tl'; const x=(p.includes('r')?r.right-6:r.left-12)+scrollX, y=(p.includes('b')?r.bottom-8:r.top-12)+scrollY;
      m.style.cssText='position:absolute;z-index:99999;left:'+x+'px;top:'+y+'px;width:30px;height:30px;border-radius:50%;background:#E11D48;color:#fff;font:800 16px/30px system-ui;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid #fff;pointer-events:none'; document.body.appendChild(m); }); })()`);
}
const sinMarcas = () => ev(`document.querySelectorAll('.mk').forEach(e=>e.remove())`);
async function shot(name, o) {
  o = o || {}; let clip;
  await ev(`(()=>{const t=document.querySelector('.toasts'); if(t) t.style.display='none'; const b=document.querySelector('.barra'); if(b) b.style.position=${JSON.stringify(o.sel ? 'static' : '')};})()`);
  if (o.sel) { const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(o.sel)}); if(!e) return null; e.scrollIntoView({block:${JSON.stringify(o.align || 'start')}}); const b=e.getBoundingClientRect(); return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height};})()`); if (!r) throw new Error('sin ' + o.sel); await sleep(300); const p = o.pad === undefined ? 14 : o.pad; clip = { x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.w + 2 * p, height: Math.min(r.h, o.max || 1400) + 2 * p, scale: 1 }; }
  const r = await cdp('Page.captureScreenshot', Object.assign({ format: 'jpeg', quality: 86, captureBeyondViewport: !!clip }, clip ? { clip } : {}));
  fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(r.data, 'base64')); console.log('  ✓', name);
}
const scrollTo = async sel => { await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'start'})`); await sleep(500); await ev('window.scrollBy(0,-90)'); await sleep(300); };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setp-manual-'));
  const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + tmp, '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
  try {
    let v; for (let i = 0; i < 50 && !v; i++) { try { v = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); } catch (e) { await sleep(300); } }
    const page = v.find(t => t.type === 'page'); ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('DOM.enable');

    /* ================= PÚBLICO ================= */
    console.log('Sitio público');
    await size(1366, 820); await go(BASE + '/', 4500);
    await shot('p01-portada-aviso-cookies');
    await ev(`document.querySelector('.ck [data-a=ok]') && document.querySelector('.ck [data-a=ok]').click()`); await sleep(600);
    await ev(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Entendido').forEach(b=>b.click())`); await sleep(700);
    await shot('p02-portada');
    await go(BASE + '/#/p/cra5-fase2', 3000); await ev('window.scrollTo(0,0)'); await sleep(500);
    await shot('p03-proyecto-inicio');
    const sec = async (re, name, extra) => { const idb = await ev(`(()=>{const s=[...document.querySelectorAll('.page.active section')].find(x=>${re}.test((x.querySelector('h3')||{}).textContent||'')); return s?s.id:null})()`); if (!idb) { console.log('  · sin sección para', name); return; } await scrollTo('#' + idb); await sleep(extra || 1800); await shot(name, { sel: '#' + idb, pad: 6, max: 900 }); };
    await sec('/mapa|tramo/i', 'p04-proyecto-mapa', 3500);
    await sec('/recursos|financ/i', 'p05-proyecto-recursos');
    await sec('/cronograma/i', 'p06-proyecto-cronograma');
    await ev(`window.scrollTo(0, document.body.scrollHeight)`); await sleep(900); await shot('p07-pie-legal', { sel: 'footer', pad: 8 });
    await size(390, 800, true); await go(BASE + '/#/p/cra5-fase2', 3000); await shot('p08-celular');
    await size(1366, 820);

    /* ================= ADMIN ================= */
    console.log('Panel de administración');
    await size(1366, 860); await go(BASE + '/admin/', 1200);
    await marcas([['#lg-usuario', 1, 'tl'], ['#lg-clave', 2, 'tl'], ['.consent', 3, 'tl'], ['.login-card .btn.pri', 4, 'tl']]);
    await shot('a01-ingreso', { sel: '.login-card', pad: 26 }); await sinMarcas();
    await fill('#lg-usuario', USER); await fill('#lg-clave', PASS); await click('#lg-t'); await click('#lg-p'); await click('.login-card .btn.pri'); await waitFor('.acciones', 8000); await sleep(800);
    await marcas([['.nav', 1, 'tl'], ['.barra-btn .btn.pri', 2, 'tl'], ['.acciones', 3, 'tl']]); await shot('a02-inicio'); await sinMarcas();

    await go(BASE + '/admin/#/proyectos', 1800);
    await marcas([['.proy .sw', 1, 'tl'], ['.proy .btn.pri', 2, 'tl'], ['.proy .btn:not(.pri)', 3, 'tl'], ['.vh + p .btn', 4, 'tl']]); await shot('a03-proyectos'); await sinMarcas();

    /* asistente */
    await go(BASE + '/admin/#/nuevo', 1000);
    await fill('.asist input[type=text]', 'Proyecto de ejemplo');
    await ev(`(()=>{const t=document.querySelectorAll('.asist input[type=text]'); t[1].value='Fase I'; t[1].dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('.asist .cat'); await marcas([['.asist input[type=text]', 1, 'tl'], ['.asist .cats', 2, 'tl'], ['.btnrow .btn.pri', 3, 'tl']]); await shot('a04-nuevo-paso1', { sel: '.asist' }); await sinMarcas();
    await clickText('button', 'Siguiente');
    await ev(`(()=>{const c=[...document.querySelectorAll('.compra input')]; [0,1,4].forEach(i=>c[i].click());})()`); await sleep(400);
    await marcas([['.compra', 1, 'tl'], ['.compra.on', 2, 'tr']]); await shot('a05-nuevo-paso2', { sel: '.asist', max: 1100 }); await sinMarcas();
    await clickText('button', 'Siguiente'); await sleep(500); await shot('a06-nuevo-paso3', { sel: '.asist' });
    await clickText('button', 'Crear proyecto'); await waitFor('.ed-bar', 8000); await sleep(3500);

    /* editor */
    await ev('window.scrollTo(0,0)'); await sleep(400);
    await marcas([['.ed-bar .sw', 1, 'tl'], ['#s-datos', 2, 'tl'], ['.prev', 3, 'tl']]); await shot('a07-editor'); await sinMarcas();
    await scrollTo('#s-secciones'); await sleep(500);
    await ev(`(()=>{const h=[...document.querySelectorAll('.bloque .item-head')].find(x=>x.textContent.includes('Recursos financieros')); h.click();})()`); await sleep(900);
    await marcas([['.bloque .help-box', 1, 'tl'], ['.bloque-body .form', 2, 'tl'], ['.bloque .lista .add', 3, 'tl']]); await shot('a08-seccion-abierta'); await sinMarcas();
    await click('#s-secciones .btnrow .btn.pri'); await sleep(600); await shot('a09-agregar-seccion'); await ev(`document.querySelector('.modal-head .icon-btn').click()`); await sleep(400);

    /* mapa (sin el panel de vista previa, para que se vea más ancho) */
    await ev(`(()=>{const s=document.createElement('style'); s.id='nopv'; s.textContent='.prev{display:none!important}.ed{grid-template-columns:minmax(0,1fr)!important}'; document.head.appendChild(s);})()`);
    await ev(`(()=>{const h=[...document.querySelectorAll('.bloque .item-head')].find(x=>x.textContent.includes('Mapa con puntos')); h.scrollIntoView({block:'start'}); h.click();})()`); await sleep(2800);
    await ev('window.scrollBy(0,-80)'); await sleep(400);
    await marcas([['.me-capas', 1, 'tl'], ['.me-ajustes', 2, 'tl'], ['.me-tools .btn', 3, 'tl'], ['.me-map', 4, 'tl']]); await shot('a10-mapa-editor'); await sinMarcas();
    await clickText('.me-tools button', 'Agregar un punto'); await sleep(500);
    const rect = await ev(`(()=>{document.querySelector('.me-map').scrollIntoView({block:'center'}); const r=document.querySelector('.me-map').getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2};})()`);
    await mouse(rect.x, rect.y); await sleep(500);
    await ev(`(()=>{const i=document.querySelector('.me-sel input[type=text]'); i.value='Paradero de ejemplo'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(500);
    await marcas([['.me-map', 1, 'tl'], ['.me-sel', 2, 'tl']]); await shot('a11-mapa-punto', { sel: '.mapedit', max: 1100 }); await sinMarcas();

    /* importar */
    await clickText('.me-tools button', 'Subir archivos'); await sleep(700);
    await marcas([['.dropzone', 1, 'tl'], ['.imp table.fmt', 2, 'tl']]); await shot('a12-importar'); await sinMarcas();
    await setFiles('.dropzone input[type=file]', [ej('ejemplo-puntos.xlsx'), ej('ejemplo-tramos.xlsx')]); await waitFor('.imp-resumen', 8000); await sleep(600);
    await shot('a13-importar-resultado');
    await clickText('.modal-acts button', 'Agregar'); await sleep(1800);
    await ev('window.scrollBy(0,0)'); await shot('a14-mapa-importado', { sel: '.mapedit', max: 1200 });

    /* fotos */
    await ev(`document.querySelector('#s-secciones').scrollIntoView()`); await click('#s-secciones .btnrow .btn.pri'); await sleep(500);
    await ev(`(()=>{const o=[...document.querySelectorAll('.opc')].find(x=>x.textContent.includes('Fotos del proyecto')); o.querySelector('.btn').click();})()`); await sleep(1200);
    await ev(`(()=>{const b=[...document.querySelectorAll('.bloque')].pop(); b.scrollIntoView({block:'start'});})()`); await sleep(500);
    await setFiles('.bloque:last-of-type input[type=file]', [path.join(__dirname, '..', 'img', 'glorieta-ambala.jpg').replace(/\//g, '\\')]); await sleep(2500);
    await ev(`(()=>{const b=[...document.querySelectorAll('.bloque')].pop(); const x=b.querySelector('.imgw'); if(x) x.scrollIntoView({block:'center'});})()`); await sleep(600);
    await marcas([['.bloque:last-of-type .imgw-top', 1, 'tl'], ['.bloque:last-of-type .check.rights', 2, 'tl']]); await shot('a15-fotos', { sel: '.bloque:last-of-type .item-body, .bloque:last-of-type .bloque-body', max: 1300 }); await sinMarcas();

    /* publicar */
    await ev(`document.getElementById('nopv').remove()`);
    await ev('window.scrollTo(0,0)'); await sleep(300); await click('.barra-btn .btn.pri'); await sleep(1500);
    await marcas([['.difs', 1, 'tl'], ['.modal .campo', 2, 'tl'], ['.modal-acts .btn.pri', 3, 'tl']]); await shot('a16-publicar'); await sinMarcas();
    await ev(`(()=>{const m=document.querySelector('.modal .campo input'); m.value='Agregué el proyecto de ejemplo'; m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await ev(`document.querySelector('.modal-acts .btn.pri') && document.querySelector('.modal-acts .btn.pri').click()`); await sleep(2500);
    await go(BASE + '/admin/#/historial', 2000); await marcas([['.proy .btn', 1, 'tl']]); await shot('a17-versiones', { sel: '#vista', pad: 10, max: 800 }); await sinMarcas();
    await go(BASE + '/admin/#/proyectos', 2200); await shot('a18-proyectos-despues');
    await go(BASE + '/admin/#/ayuda', 1000); await shot('a19-ayuda', { sel: '#vista', pad: 10, max: 900 });
    await click('.top-u .btn:not(:last-child)'); await sleep(700); await shot('a20-cambiar-clave');

    /* vista previa del borrador en el sitio público */
    await ev(`document.querySelector('.modal-head .icon-btn').click()`);
    await go(BASE + '/?vista=borrador#/p/cra5-fase2', 3500); await ev('window.scrollTo(0,0)'); await sleep(500); await shot('p09-vista-borrador');
    console.log('Listo →', out);
  } finally { try { ws && ws.close(); } catch (e) {} edge.kill(); await sleep(500); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });

/* Servidor de desarrollo y pruebas: sirve el sitio y ejecuta api/*.js con un Redis simulado en memoria.
   node tools/devserver.js [puerto]      (por defecto 8770)   — credenciales de PRUEBA, solo en este equipo. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

process.env.UPSTASH_REDIS_REST_URL = 'http://mock-redis.local';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock';
process.env.ADMIN_USER = process.env.ADMIN_USER || 'UsuarioDePrueba';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ClaveDePrueba_Local1';
process.env.SETP_PBKDF2_ITER = process.env.SETP_PBKDF2_ITER || '2000';

/* ---- Redis simulado (subconjunto usado por la API) ---- */
const store = new Map(), exp = new Map();
const alive = k => { const e = exp.get(k); if (e && e < Date.now()) { store.delete(k); exp.delete(k); } return store.has(k); };
function cmd(c) {
  const [op, k, ...r] = c; const O = String(op).toUpperCase();
  switch (O) {
    case 'GET': return alive(k) ? store.get(k) : null;
    case 'SET': { const nx = r.includes('NX'); if (nx && alive(k)) return null; store.set(k, String(r[0])); exp.delete(k); const i = r.indexOf('EX'); if (i >= 0) exp.set(k, Date.now() + Number(r[i + 1]) * 1000); return 'OK'; }
    case 'DEL': { const had = alive(k); store.delete(k); exp.delete(k); return had ? 1 : 0; }
    case 'INCR': { const v = (alive(k) ? parseInt(store.get(k), 10) : 0) + 1; store.set(k, String(v)); return v; }
    case 'EXPIRE': exp.set(k, Date.now() + Number(r[0]) * 1000); return 1;
    case 'LPUSH': { const a = alive(k) ? JSON.parse(store.get(k)) : []; r.forEach(x => a.unshift(x)); store.set(k, JSON.stringify(a)); return a.length; }
    case 'LRANGE': { const a = alive(k) ? JSON.parse(store.get(k)) : []; let s = Number(r[0]), e = Number(r[1]); if (e < 0) e = a.length + e; return a.slice(s, e + 1); }
    case 'LTRIM': { const a = alive(k) ? JSON.parse(store.get(k)) : []; let s = Number(r[0]), e = Number(r[1]); if (e < 0) e = a.length + e; store.set(k, JSON.stringify(a.slice(s, e + 1))); return 'OK'; }
    default: throw new Error('comando no soportado: ' + op);
  }
}
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (!String(url).startsWith('http://mock-redis.local')) return realFetch(url, opts);
  const body = JSON.parse(opts.body), path_ = String(url).replace('http://mock-redis.local', '');
  try {
    const out = path_ === '/pipeline' ? body.map(c => { try { return { result: cmd(c) }; } catch (e) { return { error: e.message }; } }) : { result: cmd(body) };
    return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 400 }); }
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };

function start(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost'); let p = decodeURIComponent(u.pathname);
      const m = /^\/api\/([a-z]+)$/.exec(p);
      if (m) { const f = path.join(root, 'api', m[1] + '.js'); if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('{}'); } return await require(f)(req, res); }
      if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(root, p));
      if (!file.startsWith(root) || /[\\/](tools|tests|api|\.git)[\\/]/.test(file + path.sep) && !/[\\/]assets[\\/]/.test(file)) { res.statusCode = 404; return res.end('no'); }
      fs.readFile(file, (e, b) => { if (e) { res.statusCode = 404; return res.end('no encontrado'); } res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store'); res.end(b); });
    } catch (e) { res.statusCode = 500; res.end(String(e && e.stack || e)); }
  });
  return new Promise(r => server.listen(port, () => r(server)));
}
module.exports = { start, store };
if (require.main === module) start(parseInt(process.argv[2], 10) || 8770).then(s => console.log('SETP dev en http://localhost:' + s.address().port));

/* Librería común del servidor (Vercel Functions, Node 18+). Sin dependencias.
   Almacenamiento: Upstash Redis por REST (se conecta desde el panel de Vercel: Storage → Upstash → Connect Project).
   Credenciales iniciales: variables de entorno ADMIN_USER y ADMIN_PASSWORD (nunca en el repositorio, que es público).
   Después de cambiar la clave desde el panel se guarda solo su hash (PBKDF2) en Redis y la variable deja de usarse. */
'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const pbkdf2 = promisify(crypto.pbkdf2);

const env = k => String(process.env[k] || '').trim();
const redisUrl = () => (env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL')).replace(/\/$/, '');
const redisToken = () => env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
const hasStorage = () => !!(redisUrl() && redisToken());
const ITER = () => parseInt(env('SETP_PBKDF2_ITER'), 10) || 600000;
const SESSION_HOURS = 8;

/* ---------------- Redis (REST) ---------------- */
async function post(path, body) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(redisUrl() + path, { method: 'POST', headers: { Authorization: 'Bearer ' + redisToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json();
    if (!r.ok || (j && j.error)) throw new Error('redis: ' + ((j && j.error) || r.status));
    return j;
  } finally { clearTimeout(t); }
}
const redis = async cmd => (await post('', cmd)).result;
const pipeline = async cmds => (await post('/pipeline', cmds)).map(x => { if (x.error) throw new Error('redis: ' + x.error); return x.result; });
const getJSON = async k => { const v = await redis(['GET', k]); return v ? JSON.parse(v) : null; };
const setJSON = (k, o) => redis(['SET', k, JSON.stringify(o)]);

/* ---------------- utilidades HTTP ---------------- */
function send(res, status, body, headers) {
  res.statusCode = status;
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers || {});
  Object.keys(h).forEach(k => res.setHeader(k, h[k]));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const query = req => { try { return Object.fromEntries(new URL(req.url, 'http://x').searchParams); } catch (e) { return {}; } };
async function readBody(req, max) {
  max = max || 6 * 1024 * 1024;
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    return req.body;
  }
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw Object.assign(new Error('grande'), { status: 413 }); chunks.push(c); }
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'desconocida';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- seguridad ---------------- */
const b64u = b => Buffer.from(b).toString('base64url');
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const safeEqStr = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
function parseCookies(req) {
  const o = {}; String(req.headers.cookie || '').split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return o;
}
const cookie = (name, val, maxAge) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

let _secret = null;
async function secret() {
  if (env('SESSION_SECRET')) return env('SESSION_SECRET');
  if (_secret) return _secret;
  let s = await redis(['GET', 'setp:secret']);
  if (!s) { await redis(['SET', 'setp:secret', crypto.randomBytes(32).toString('hex'), 'NX']); s = await redis(['GET', 'setp:secret']); }
  return (_secret = s);
}
async function sessionVersion() { return String((await redis(['GET', 'setp:sessv'])) || '0'); }
async function signSession(user) {
  const p = { u: user, exp: Date.now() + SESSION_HOURS * 3600e3, v: await sessionVersion(), n: crypto.randomBytes(6).toString('hex') };
  const b = b64u(JSON.stringify(p));
  return b + '.' + hmac(await secret(), b);
}
async function readSession(req) {
  try {
    const c = parseCookies(req).setp_admin; if (!c) return null;
    const [b, sig] = c.split('.'); if (!b || !sig) return null;
    if (!safeEqStr(sig, hmac(await secret(), b))) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (!p || p.exp < Date.now() || p.v !== await sessionVersion()) return null;
    return p;
  } catch (e) { return null; }
}
/* Las operaciones que modifican datos exigen cabecera propia (un sitio externo no puede enviarla) y, si hay Origin, que sea el mismo sitio */
function csrfOk(req) {
  if (req.headers['x-setp'] !== '1') return false;
  const o = req.headers.origin; if (!o) return true;
  try { const h = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase(); return new URL(o).host.toLowerCase() === h; } catch (e) { return false; }
}
async function requireAdmin(req, res) {
  if (!hasStorage()) { send(res, 503, { error: 'sin_almacenamiento', mensaje: 'Falta conectar el almacenamiento (Upstash Redis) en Vercel.' }); return null; }
  const s = await readSession(req);
  if (!s) { send(res, 401, { error: 'no_autenticado', mensaje: 'Tu sesión terminó. Ingresa de nuevo.' }); return null; }
  if (req.method !== 'GET' && !csrfOk(req)) { send(res, 403, { error: 'origen_invalido', mensaje: 'Solicitud no permitida.' }); return null; }
  return s;
}

/* credenciales: Redis (clave cambiada desde el panel) o variables de entorno (inicial) */
async function checkCredentials(user, pass) {
  user = String(user || ''); pass = String(pass || '');
  const st = await getJSON('setp:cred');
  if (st) {
    const h = (await pbkdf2(pass, Buffer.from(st.salt, 'hex'), st.iter, 32, 'sha256')).toString('hex');
    const a = safeEqStr(user, st.user), b = safeEqStr(h, st.hash);
    return a && b;
  }
  const U = env('ADMIN_USER'), P = env('ADMIN_PASSWORD'); if (!U || !P) return false;
  const a = safeEqStr(user, U), b = safeEqStr(pass, P);
  return a && b;
}
async function hasCredentials() { return !!(env('ADMIN_USER') && env('ADMIN_PASSWORD')) || !!(await getJSON('setp:cred')); }
async function storeCredentials(user, pass) {
  const salt = crypto.randomBytes(16), iter = ITER();
  const hash = (await pbkdf2(pass, salt, iter, 32, 'sha256')).toString('hex');
  await setJSON('setp:cred', { user, salt: salt.toString('hex'), hash, iter, ts: Date.now() });
  await redis(['INCR', 'setp:sessv']);
}
const passwordOk = p => typeof p === 'string' && p.length >= 10 && p.length <= 100 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

/* límite de intentos de ingreso: 8 fallos por IP cada 15 minutos */
async function failHit(ip) { const k = 'setp:rl:' + ip; const n = await redis(['INCR', k]); if (n === 1) await redis(['EXPIRE', k, 900]); return n; }
async function failCount(ip) { return parseInt(await redis(['GET', 'setp:rl:' + ip]), 10) || 0; }
const failClear = ip => redis(['DEL', 'setp:rl:' + ip]);

/* semilla: contenido inicial incluido en el despliegue (data/seed.json, ver includeFiles en vercel.json); se lee del disco, no de la red */
async function loadSeed() {
  return JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'data', 'seed.json'), 'utf8'));
}

module.exports = { env, hasStorage, redis, pipeline, getJSON, setJSON, send, query, readBody, clientIp, sleep, cookie, parseCookies, signSession, readSession, requireAdmin, csrfOk,
  checkCredentials, hasCredentials, storeCredentials, passwordOk, failHit, failCount, failClear, loadSeed, SESSION_HOURS };

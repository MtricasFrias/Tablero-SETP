/* Pruebas de la API del panel:  node --test tests/    (usa el servidor de desarrollo con Redis simulado) */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { start, store } = require('../tools/devserver');

let base, server, cookie = '';
const USER = 'UsuarioDePrueba', PASS = 'ClaveDePrueba_Local1';
const ACEPTA = { terminos: true, privacidad: true };

async function call(path, o) {
  o = o || {};
  const h = Object.assign({ 'content-type': 'application/json', 'x-forwarded-for': o.ip || '10.0.0.1' }, o.headers || {});
  if (o.auth !== false && cookie) h.cookie = cookie;
  if (o.csrf !== false && (o.method || 'GET') !== 'GET') h['x-setp'] = '1';
  const r = await fetch(base + path, { method: o.method || 'GET', headers: h, body: o.body === undefined ? undefined : (typeof o.body === 'string' ? o.body : JSON.stringify(o.body)) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, json: j, text: t, headers: r.headers, buf: null };
}
const login = (ip, clave) => call('/api/auth?a=login', { method: 'POST', ip, body: { usuario: USER, clave: clave || PASS, acepta: ACEPTA } });

test.before(async () => { server = await start(0); base = 'http://localhost:' + server.address().port; });
test.after(() => server.close());

test('sin sesión: estado, y todo lo de admin está cerrado', async () => {
  const s = await call('/api/auth?a=session'); assert.equal(s.status, 200); assert.equal(s.json.autenticado, false); assert.equal(s.json.configurado.almacenamiento, true);
  for (const p of ['/api/admin?a=draft', '/api/admin?a=history', '/api/admin?a=export']) assert.equal((await call(p)).status, 401, p);
  assert.equal((await call('/api/admin?a=publish', { method: 'POST', body: {} })).status, 401);
});

test('ingreso: exige las DOS casillas, rechaza claves malas y bloquea por intentos', async () => {
  assert.equal((await call('/api/auth?a=login', { method: 'POST', body: { usuario: USER, clave: PASS, acepta: { terminos: true } } })).status, 400);
  assert.equal((await call('/api/auth?a=login', { method: 'POST', body: { usuario: USER, clave: PASS, acepta: { terminos: false, privacidad: true } } })).status, 400);
  assert.equal((await call('/api/auth?a=login', { method: 'POST', csrf: false, body: { usuario: USER, clave: PASS, acepta: ACEPTA } })).status, 403);
  for (let i = 0; i < 8; i++) assert.equal((await login('10.9.9.9', 'mala' + i)).status, 401);
  const blocked = await login('10.9.9.9'); assert.equal(blocked.status, 429, 'al noveno intento queda bloqueada la IP, incluso con la clave correcta');
});

test('ingreso correcto: cookie HttpOnly + SameSite, y la sesión se reconoce', async () => {
  const r = await login('10.0.0.2'); assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie'); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/);
  const s = await call('/api/auth?a=session'); assert.equal(s.json.autenticado, true); assert.equal(s.json.usuario, USER);
  assert.ok(JSON.parse(store.get('setp:acept:' + USER)).privacidad, 'queda constancia de la aceptación');
});

test('borrador: se crea desde la semilla, exige cabecera anti-CSRF y control de versión', async () => {
  const d = await call('/api/admin?a=draft'); assert.equal(d.status, 200); assert.equal(d.json.datos.proyectos.length, 10); assert.equal(d.json.hayCambios, false); assert.equal(d.json.rev, 1);
  const datos = d.json.datos; datos.proyectos[0].nombre = 'Av. Ferrocarril (editado)';
  assert.equal((await call('/api/admin?a=draft', { method: 'PUT', csrf: false, body: { rev: 1, datos } })).status, 403);
  const ok = await call('/api/admin?a=draft', { method: 'PUT', body: { rev: 1, datos } }); assert.equal(ok.status, 200); assert.equal(ok.json.rev, 2); assert.equal(ok.json.hayCambios, true);
  const old = await call('/api/admin?a=draft', { method: 'PUT', body: { rev: 1, datos } }); assert.equal(old.status, 409);
  assert.equal((await call('/api/data', { auth: false })).status, 404, 'lo editado NO es público hasta publicar');
});

test('validación: rechaza datos peligrosos o mal formados y limpia lo demás', async () => {
  const d = (await call('/api/admin?a=draft')).json; const rev = d.rev; const datos = JSON.parse(JSON.stringify(d.datos));
  const bad = JSON.parse(JSON.stringify(datos)); bad.proyectos[0].categoria = 'otra';
  assert.equal((await call('/api/admin?a=draft', { method: 'PUT', body: { rev, datos: bad } })).status, 400);
  const dup = JSON.parse(JSON.stringify(datos)); dup.proyectos[1].id = dup.proyectos[0].id;
  assert.equal((await call('/api/admin?a=draft', { method: 'PUT', body: { rev, datos: dup } })).status, 400);
  const evil = JSON.parse(JSON.stringify(datos)); const p = evil.proyectos.find(x => x.id === 'cra5-fase2');
  p.bloques.push({ tipo: 'documentos', titulo: '<img src=x onerror=alert(1)>', items: [{ nombre: 'malo', url: 'javascript:alert(1)' }, { nombre: 'bueno', url: 'https://secop.gov.co/x' }] });
  p.bloques.push({ tipo: 'mapa', titulo: 'm', capas: [{ nombre: 'c', tipo: 'puntos', elementos: [{ nombre: 'fuera', lat: 999, lon: 0 }, { nombre: 'ok', lat: 4.44, lon: -75.2 }] }] });
  const r = await call('/api/admin?a=draft', { method: 'PUT', body: { rev, datos: evil } }); assert.equal(r.status, 200);
  const g = (await call('/api/admin?a=draft')).json.datos.proyectos.find(x => x.id === 'cra5-fase2');
  const docs = g.bloques.find(b => b.tipo === 'documentos'); assert.equal(docs.items.length, 1); assert.equal(docs.items[0].nombre, 'bueno');
  assert.equal(docs.titulo, '<img src=x onerror=alert(1)>', 'el texto se guarda como texto (la página lo escapa al mostrarlo)');
  assert.equal(g.bloques.filter(b => b.tipo === 'mapa').pop().capas[0].elementos.length, 1, 'coordenadas imposibles se descartan');
  const keys = JSON.parse(JSON.stringify(datos)); keys.proyectos[0]['<script>'] = 1;
  assert.equal((await call('/api/admin?a=draft', { method: 'PUT', body: { rev: (await call('/api/admin?a=draft')).json.rev, datos: keys } })).status, 400, 'campos con nombres raros se rechazan');
});

test('publicar, ocultar y mostrar: el público ve el cambio', async () => {
  const pu = await call('/api/admin?a=publish', { method: 'POST', body: { nota: 'prueba' } }); assert.equal(pu.status, 200); assert.equal(pu.json.hayCambios, false);
  const pub = await call('/api/data', { auth: false }); assert.equal(pub.status, 200); assert.ok(pub.json.proyectos.find(p => p.id === 'cra5-fase2'));
  assert.match(pub.headers.get('cache-control'), /s-maxage/);
  const hide = await call('/api/admin?a=visibility', { method: 'POST', body: { id: 'cra5-fase2', visible: false } }); assert.equal(hide.status, 200); assert.equal(hide.json.visible, false);
  assert.equal((await call('/api/data', { auth: false })).json.proyectos.find(p => p.id === 'cra5-fase2').visible, false, 'ocultar es inmediato para el público');
  assert.equal((await call('/api/admin?a=draft')).json.datos.proyectos.find(p => p.id === 'cra5-fase2').visible, false);
  await call('/api/admin?a=visibility', { method: 'POST', body: { id: 'cra5-fase2', visible: true } });
  assert.equal((await call('/api/admin?a=visibility', { method: 'POST', body: { id: 'no-existe', visible: true } })).status, 404);
});

test('comparar: borrador frente a lo público (o a la semilla si aún no se publicó)', async () => {
  const c = await call('/api/admin?a=compare'); assert.equal(c.status, 200); assert.equal(c.json.pub.proyectos.length, 10); assert.ok(c.json.draft.proyectos.length >= 10);
  assert.equal((await call('/api/admin?a=compare', { auth: false })).status, 401);
});

test('imágenes: se validan por contenido y se sirven en público', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const r = await call('/api/admin?a=img', { method: 'POST', body: { mime: 'image/png', base64: png.toString('base64') } }); assert.equal(r.status, 200); assert.match(r.json.id, /^[A-Za-z0-9_-]{6,40}$/);
  const g = await fetch(base + '/api/img?id=' + r.json.id); assert.equal(g.status, 200); assert.equal(g.headers.get('content-type'), 'image/png'); assert.equal(Buffer.from(await g.arrayBuffer()).length, png.length);
  assert.equal((await call('/api/admin?a=img', { method: 'POST', body: { mime: 'image/png', base64: Buffer.from('<svg onload=alert(1)>').toString('base64') } })).status, 400);
  assert.equal((await call('/api/admin?a=img', { method: 'POST', body: { mime: 'image/svg+xml', base64: 'PHN2Zz4=' } })).status, 400);
  assert.equal((await fetch(base + '/api/img?id=../../etc')).status, 404);
});

test('historial y restauración', async () => {
  const h = await call('/api/admin?a=history'); assert.ok(h.json.versiones.length >= 1);
  const id = h.json.versiones[0].id; const r = await call('/api/admin?a=restore', { method: 'POST', body: { id } }); assert.equal(r.status, 200); assert.equal(r.json.hayCambios, true);
  assert.equal((await call('/api/admin?a=restore', { method: 'POST', body: { id: 'zzzzzzzz' } })).status, 404);
  const x = await call('/api/admin?a=export'); assert.equal(x.status, 200); assert.match(x.headers.get('content-disposition'), /attachment/);
});

test('cambio de contraseña: política, clave actual y cierre de otras sesiones', async () => {
  assert.equal((await call('/api/auth?a=password', { method: 'POST', body: { actual: 'incorrecta', nueva: 'NuevaClave2026x' } })).status, 400);
  assert.equal((await call('/api/auth?a=password', { method: 'POST', body: { actual: PASS, nueva: 'corta' } })).status, 400);
  assert.equal((await call('/api/auth?a=password', { method: 'POST', body: { actual: PASS, nueva: 'todominusculas123' } })).status, 400);
  const viejaSesion = cookie;
  const ok = await call('/api/auth?a=password', { method: 'POST', body: { actual: PASS, nueva: 'NuevaClave2026x' } }); assert.equal(ok.status, 200);
  const nueva = cookie;
  assert.equal((await call('/api/admin?a=draft', { headers: { cookie: viejaSesion }, auth: false })).status, 401, 'la sesión anterior queda cerrada');
  assert.equal((await call('/api/admin?a=draft', { headers: { cookie: nueva }, auth: false })).status, 200);
  assert.equal((await login('10.0.0.50', PASS)).status, 401, 'la clave inicial ya no sirve');
  assert.equal((await login('10.0.0.51', 'NuevaClave2026x')).status, 200);
});

test('cierre de sesión', async () => {
  assert.equal((await call('/api/auth?a=logout', { method: 'POST' })).status, 200);
  cookie = ''; assert.equal((await call('/api/admin?a=draft')).status, 401);
});

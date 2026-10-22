/* Pruebas de los lectores de archivos geográficos (la parte que no necesita navegador):  node --test tests/geo.test.js
   KML, GPX, Excel y ODS usan DOMParser y se prueban en el navegador (tests/geo-browser.js). */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), zlib = require('node:zlib');
const G = require('../admin/js/geo.js');

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-6), a + ' ≉ ' + b);
const file = (name, buf) => ({ name, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });

/* Mercator transversa directa (para ida y vuelta) */
function fwd(lat, lon, P) {
  const a = 6378137, f = 1 / 298.257222101, e2 = 2 * f - f * f, ep2 = e2 / (1 - e2), r = Math.PI / 180;
  const M = p => a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const p = lat * r, N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2), T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = (lon - P.lon0) * r * Math.cos(p);
  const E = P.fe + P.k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const Nn = P.fn + P.k0 * (M(p) - M(P.lat0 * r) + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [E, Nn];
}

test('números: comas decimales, miles y basura', () => {
  assert.equal(G.num('4,437179'), 4.437179); assert.equal(G.num('-75.228861'), -75.228861); assert.equal(G.num(' 1.234,5 '), 1234.5);
  assert.equal(G.num('1,234.5'), 1234.5); assert.equal(G.num('1.000.000'), 1000000); assert.equal(G.num('abc'), null); assert.equal(G.num(''), null); assert.equal(G.num(7), 7);
});

test('proyecciones: ida y vuelta con los cinco sistemas colombianos', () => {
  const origen = G.PROJ[0]; const o = G.tmInv(1e6, 1e6, origen); near(o[0], 4.596200417, 1e-7); near(o[1], -74.07750792, 1e-7);
  const u = G.tmInv(5e5, 0, G.PROJ[2]); near(u[0], 0, 1e-9); near(u[1], -75, 1e-9);
  [[4.4389, -75.2322], [4.45, -75.15], [4.40, -75.30]].forEach(([la, lo]) => G.PROJ.forEach(P => { const [E, N] = fwd(la, lo, P), b = G.tmInv(E, N, P); near(b[0], la, 2e-7); near(b[1], lo, 2e-7); }));
  const [E, N] = fwd(4.4389, -75.2322, G.PROJ[0]); assert.ok(E > 8e5 && E < 9e5 && N > 9e5 && N < 1.1e6, 'Ibagué en Bogotá ≈ 875 000, 983 000: ' + E + ',' + N);
});

test('tabla CSV: encabezados, punto y coma, coma decimal, columnas en cualquier orden', () => {
  const r = G.parseText('lon;lat;Nombre;detalle\r\n-75,228861;4,437179;Semáforo 29;Cra 4 con Cl 25\r\n-75,229253;4,440645;Semáforo 30;\r\n;;sin coordenadas;\r\n');
  G.finalizar(r); assert.equal(r.puntos.length, 2); assert.equal(r.puntos[0].nombre, 'Semáforo 29'); assert.equal(r.puntos[0].lat, 4.437179); assert.equal(r.puntos[0].lon, -75.228861); assert.equal(r.puntos[0].detalle, 'Cra 4 con Cl 25');
  assert.match(r.aviso.join(' '), /1 fila/);
});

test('tabla con columna «tramo»: las filas forman líneas, en el orden indicado, con su estado', () => {
  const r = G.parseText('tramo,orden,lat,lon,estado\nT1,2,4.4408,-75.2311,ejecutado\nT1,1,4.4401,-75.2300,ejecutado\nT1,3,4.4415,-75.2322,ejecutado\nT2,1,4.45,-75.23,en curso\n');
  G.finalizar(r); assert.equal(r.lineas.length, 1, 'T2 tiene un solo vértice → es un punto'); assert.equal(r.puntos.length, 1);
  assert.deepEqual(r.lineas[0].coords[0], [4.4401, -75.23]); assert.equal(r.lineas[0].nombre, 'T1'); assert.equal(r.lineas[0].estado, 'ejecutado');
});

test('sin encabezados, líneas pegadas, grados-minutos-segundos y orden invertido', () => {
  let r = G.parsePegado('Semáforo 1; 4.437179; -75.228861\nSemáforo 2, 4.440645, -75.229253\n4.441289, -75.231341');
  assert.equal(r.puntos.length, 3); assert.equal(r.puntos[0].nombre, 'Semáforo 1'); assert.equal(r.puntos[2].nombre, '');
  r = G.parsePegado('4°26\'20"N 75°13\'56"W'); near(r.puntos[0].lat, 4.438889, 1e-5); near(r.puntos[0].lon, -75.232222, 1e-5);
  r = G.parsePegado('Punto A; -75.2322; 4.4389'); assert.equal(r.puntos[0].lat, 4.4389); assert.match(r.aviso.join(' '), /invertidas/);
});

test('WKT, GeoJSON y lista JSON', () => {
  let r = G.parsePegado('POINT(-75.2322 4.4389)\nLINESTRING(-75.2300 4.4401, -75.2311 4.4408, -75.2322 4.4415)');
  assert.equal(r.puntos.length, 1); assert.equal(r.lineas.length, 1); assert.deepEqual(r.puntos[0].lat, 4.4389);
  r = G.parsePegado(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Point', coordinates: [-75.2, 4.4] } }, { type: 'Feature', properties: { nombre: 'B', estado: 'terminado' }, geometry: { type: 'LineString', coordinates: [[-75.2, 4.4], [-75.21, 4.41]] } }] }));
  assert.equal(r.puntos[0].nombre, 'A'); assert.equal(r.lineas[0].estado, 'ejecutado');
  r = G.parsePegado(JSON.stringify([{ nombre: 'X', latitud: 4.4, longitud: -75.2 }, { nombre: 'Y', latitud: 4.41, longitud: -75.21 }])); assert.equal(r.puntos.length, 2);
  assert.throws(() => G.parsePegado('hola mundo'), /columnas|coordenadas/i); assert.throws(() => G.parsePegado('{"a":1}'), /GeoJSON/);
});

test('coordenadas planas MAGNA-SIRGAS: se convierten solas a grados (también con ejes cambiados)', () => {
  const [E, N] = fwd(4.4389, -75.2322, G.PROJ[0]), [E2, N2] = fwd(4.45, -75.22, G.PROJ[0]);
  let r = G.parsePegado('nombre;norte;este\nA;' + N.toFixed(2) + ';' + E.toFixed(2) + '\nB;' + N2.toFixed(2) + ';' + E2.toFixed(2));
  near(r.puntos[0].lat, 4.4389, 1e-5); near(r.puntos[0].lon, -75.2322, 1e-5); assert.match(r.aviso.join(' '), /Bogotá/);
  r = G.parsePegado('nombre,x,y\nA,' + E.toFixed(2) + ',' + N.toFixed(2)); near(r.puntos[0].lat, 4.4389, 1e-5);
  const [Ec, Nc] = fwd(4.4389, -75.2322, G.PROJ[1]); r = G.parsePegado('lat,lon\n' + Nc.toFixed(2) + ',' + Ec.toFixed(2)); near(r.puntos[0].lon, -75.2322, 1e-5); assert.match(r.aviso.join(' '), /CTM12/);
  const [Eu, Nu] = fwd(4.4389, -75.2322, G.PROJ[2]); r = G.parsePegado('lat,lon\n' + Nu.toFixed(2) + ',' + Eu.toFixed(2)); near(r.puntos[0].lat, 4.4389, 1e-5); assert.match(r.aviso.join(' '), /UTM/);
  assert.throws(() => G.parsePegado('lat,lon\n12345678,98765432'), /no están en grados/);
});

test('trazos largos se simplifican sin perder la forma', () => {
  const cs = []; for (let i = 0; i <= 2000; i++) cs.push([4.44 + i * 0.00001, -75.23 + 0.00002 * Math.sin(i / 50)]);
  const r = G.finalizar({ puntos: [], lineas: [{ nombre: 'L', detalle: '', estado: 'pendiente', coords: cs }], aviso: [] });
  assert.ok(r.lineas[0].coords.length < 300, 'vértices: ' + r.lineas[0].coords.length); assert.deepEqual(r.lineas[0].coords[0], [4.44, -75.23]); assert.match(r.aviso.join(' '), /Simplifiqué/);
});

/* ---- construcción de shapefile y zip en memoria ---- */
function shp(registros) { /* registros: {tipo:1,x,y} | {tipo:3,partes:[[[x,y]…]]} */
  const bufs = registros.map((g, i) => {
    let c; if (g.tipo === 1) { c = Buffer.alloc(20); c.writeInt32LE(1, 0); c.writeDoubleLE(g.x, 4); c.writeDoubleLE(g.y, 12); }
    else { const pts = g.partes.flat(), np = g.partes.length; c = Buffer.alloc(44 + 4 * np + 16 * pts.length); c.writeInt32LE(3, 0); c.writeInt32LE(np, 36); c.writeInt32LE(pts.length, 40); let k = 0; g.partes.forEach((p, j) => { c.writeInt32LE(k, 44 + 4 * j); k += p.length; }); pts.forEach((p, j) => { c.writeDoubleLE(p[0], 44 + 4 * np + 16 * j); c.writeDoubleLE(p[1], 52 + 4 * np + 16 * j); }); }
    const h = Buffer.alloc(8); h.writeInt32BE(i + 1, 0); h.writeInt32BE(c.length / 2, 4); return Buffer.concat([h, c]);
  });
  const head = Buffer.alloc(100); head.writeInt32BE(9994, 0); head.writeInt32LE(1000, 28);
  return Buffer.concat([head].concat(bufs));
}
function dbf(campos, filas) {
  const hl = 32 + 32 * campos.length + 1, rl = 1 + campos.reduce((a, c) => a + c[1], 0), b = Buffer.alloc(hl + rl * filas.length + 1);
  b.writeUInt32LE(filas.length, 4); b.writeUInt16LE(hl, 8); b.writeUInt16LE(rl, 10);
  campos.forEach((c, i) => { b.write(c[0], 32 + 32 * i, 'latin1'); b[32 + 32 * i + 11] = 67; b[32 + 32 * i + 16] = c[1]; }); b[32 + 32 * campos.length] = 0x0D;
  filas.forEach((f, i) => { let o = hl + rl * i; b[o++] = 0x20; campos.forEach((c, j) => { Buffer.from(String(f[j]).padEnd(c[1], ' '), 'latin1').copy(b, o); o += c[1]; }); });
  return b;
}
function zip(entradas, deflate) {
  const partes = [], central = []; let off = 0;
  entradas.forEach(([name, data]) => {
    const raw = Buffer.from(data), comp = deflate ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    partes.push(lh, nm, comp); central.push(ch, nm); off += 30 + nm.length + comp.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entradas.length, 8); end.writeUInt16LE(entradas.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(partes.concat([cd, end]));
}

test('shapefile: puntos y líneas con nombres del .dbf, en grados', () => {
  const s = shp([{ tipo: 1, x: -75.2322, y: 4.4389 }, { tipo: 1, x: -75.22, y: 4.45 }, { tipo: 3, partes: [[[-75.23, 4.44], [-75.231, 4.441], [-75.232, 4.442]]] }]);
  const d = dbf([['NOMBRE', 20], ['ESTADO', 12]], [['Paradero Ñandú', 'x'], ['Paradero 2', 'x'], ['Tramo Cra 5', 'en obra']]);
  const r = G.parseSHP(new Uint8Array(s), new Uint8Array(d)); G.finalizar(r);
  assert.equal(r.puntos.length, 2); assert.equal(r.puntos[0].nombre, 'Paradero Ñandú'); assert.equal(r.puntos[0].lat, 4.4389); assert.equal(r.lineas.length, 1); assert.equal(r.lineas[0].nombre, 'Tramo Cra 5'); assert.equal(r.lineas[0].estado, 'en curso'); assert.deepEqual(r.lineas[0].coords[2], [4.442, -75.232]);
});

test('subir varios archivos: zip con shapefile en MAGNA Bogotá, csv suelto, y un .xls que falla sin frenar a los demás', async () => {
  const [E, N] = fwd(4.4389, -75.2322, G.PROJ[0]);
  const z = zip([['capa/vias.shp', shp([{ tipo: 1, x: E, y: N }])], ['capa/vias.dbf', dbf([['nombre', 12]], [['Punto zip']])], ['__MACOSX/._vias.shp', 'basura']], true);
  const out = await G.parseFiles([file('vias.zip', z), file('puntos.csv', Buffer.from('nombre;lat;lon\nCSV 1;4,44;-75,23\n', 'latin1')), file('viejo.xls', Buffer.from('x')), file('plano.pdf', Buffer.from('%PDF'))]);
  assert.equal(out.res.puntos.length, 2); assert.equal(out.informe.length, 4);
  near(out.res.puntos[0].lat, 4.4389, 1e-5); assert.equal(out.res.puntos[0].nombre, 'Punto zip'); assert.match(out.informe[0].aviso.join(' '), /Bogotá/);
  assert.match(out.informe[2].error, /\.xlsx/); assert.match(out.informe[3].error, /no trae coordenadas/);
  const sinDeflate = zip([['a.csv', 'lat,lon\n4.4,-75.2\n']], false); assert.equal((await G.parseFiles([file('a.zip', sinDeflate)])).res.puntos.length, 1);
  assert.match((await G.parseFiles([file('vacio.zip', zip([['readme.txt', 'hola']], false))])).informe[0].error, /no contiene archivos/);
  assert.match((await G.parseFiles([file('roto.zip', Buffer.from('no soy un zip'))])).informe[0].error, /no es válido/);
  assert.match((await G.parseFiles([file('datos.dbf', dbf([['a', 3]], [['x']]))])).informe[0].error, /\.shp/);
});

test('shp + dbf seleccionados juntos', async () => {
  const s = shp([{ tipo: 1, x: -75.2322, y: 4.4389 }]), d = dbf([['name', 10]], [['Uno']]);
  const out = await G.parseFiles([file('capa.shp', s), file('capa.dbf', d), file('capa.prj', Buffer.from('GEOGCS'))]);
  assert.equal(out.informe.length, 1); assert.equal(out.res.puntos[0].nombre, 'Uno');
});

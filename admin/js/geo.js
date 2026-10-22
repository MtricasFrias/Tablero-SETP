/* Lectores de archivos geográficos del panel. Entran muchos formatos, sale siempre lo mismo:
   { puntos: [{nombre, detalle, lat, lon}], lineas: [{nombre, detalle, estado, coords: [[lat, lon], …]}], aviso: [texto] }
   Formatos: KMZ, KML, GPX, GeoJSON/JSON, Shapefile (.zip o .shp + .dbf), Excel (.xlsx/.xlsm), LibreOffice (.ods), CSV/TXT/TSV, WKT y texto pegado.
   Coordenadas en grados o en los sistemas planos colombianos (MAGNA-SIRGAS, CTM12, UTM 18N): se convierten solas a grados. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); };
  var plain = function (t) { return String(t || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); };
  var txt = function (v, max) { return plain(v).slice(0, max); };
  function num(s) {
    if (typeof s === 'number') return isFinite(s) ? s : null;
    s = String(s == null ? '' : s).trim().replace(/\s/g, ''); if (!s) return null;
    var c = s.indexOf(','), p = s.indexOf('.');
    if (c >= 0 && p >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c >= 0) s = s.replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    var n = Number(s); return isFinite(n) ? n : null;
  }
  function vacio() { return { puntos: [], lineas: [], aviso: [] }; }
  /* coordenadas "crudas": lat = latitud o NORTE, lon = longitud o ESTE; después se normalizan */
  function pt(r, nombre, detalle, a, b) { if (a === null || b === null) return; r.puntos.push({ nombre: txt(nombre, 160), detalle: txt(detalle, 300), lat: a, lon: b }); }
  function ln(r, nombre, detalle, coords, estado) {
    var cs = coords.filter(function (c) { return c[0] !== null && c[1] !== null; });
    if (cs.length >= 2) r.lineas.push({ nombre: txt(nombre, 160), detalle: txt(detalle, 300), estado: estado || 'pendiente', coords: cs });
  }
  function estadoDe(v) {
    var s = norm(v); if (!s) return 'pendiente';
    if (/curso|proceso|ejecucion|obra|iniciad|avanz/.test(s)) return 'en curso';
    if (/ejecutad|termin|hech|complet|finaliz|entregad/.test(s)) return 'ejecutado';
    return 'pendiente';
  }
  var tags = function (el, n) { return Array.prototype.slice.call(el.getElementsByTagNameNS('*', n)); };
  var first = function (el, n) { var a = tags(el, n)[0]; return a ? a.textContent : ''; };
  function xml(t) { var d = new DOMParser().parseFromString(t, 'application/xml'); if (d.getElementsByTagName('parsererror').length) throw new Error('El archivo XML no se pudo leer (está dañado o incompleto).'); return d; }
  function decodeText(u8) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
    catch (e) { return new TextDecoder('windows-1252').decode(u8); }
  }

  /* ---------- ZIP (KMZ, XLSX, ODS, shapefile .zip) ---------- */
  function zipList(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), e = u8.length - 22, min = Math.max(0, u8.length - 65557);
    while (e >= min && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < min) throw new Error('El archivo comprimido no es válido o está dañado.');
    var total = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), out = [];
    for (var i = 0; i < total; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (!/\/$/.test(name)) out.push({ name: name, method: dv.getUint16(p + 10, true), cs: dv.getUint32(p + 20, true), us: dv.getUint32(p + 24, true), lho: dv.getUint32(p + 42, true) });
      p += 46 + nl + el + cl;
    }
    return out;
  }
  async function zipRead(u8, f) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (f.us > 150e6) throw new Error('Un archivo dentro del .zip es demasiado grande.');
    var s = f.lho + 30 + dv.getUint16(f.lho + 26, true) + dv.getUint16(f.lho + 28, true), data = u8.subarray(s, s + f.cs);
    if (f.method === 0) return data;
    if (f.method !== 8) throw new Error('El .zip usa una compresión que no puedo abrir. Vuelve a comprimirlo con el formato ZIP normal.');
    if (typeof DecompressionStream === 'undefined') throw new Error('Tu navegador es muy antiguo para abrir este archivo. Usa Chrome, Edge o Firefox actualizados.');
    return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }

  /* ---------- KML / GPX / GeoJSON / WKT ---------- */
  function parseKML(text) {
    var doc = xml(text), r = vacio();
    tags(doc, 'Placemark').forEach(function (pm) {
      var nombre = first(pm, 'name'), det = plain(first(pm, 'description'));
      tags(pm, 'Point').forEach(function (p) { var c = first(p, 'coordinates').trim().split(',').map(num); pt(r, nombre, det, c[1], c[0]); });
      tags(pm, 'LineString').concat(tags(pm, 'LinearRing')).forEach(function (l) { ln(r, nombre, det, first(l, 'coordinates').trim().split(/\s+/).map(function (t) { var c = t.split(',').map(num); return [c[1], c[0]]; })); });
    });
    return r;
  }
  function parseGPX(text) {
    var doc = xml(text), r = vacio(), at = function (e, k) { return num(e.getAttribute(k)); };
    var pts = function (arr) { return arr.map(function (e) { return [at(e, 'lat'), at(e, 'lon')]; }); };
    tags(doc, 'wpt').forEach(function (w) { pt(r, first(w, 'name'), first(w, 'desc') || first(w, 'cmt'), at(w, 'lat'), at(w, 'lon')); });
    tags(doc, 'trk').forEach(function (t) { var segs = tags(t, 'trkseg'), nom = first(t, 'name'); segs.forEach(function (s, i) { ln(r, nom + (segs.length > 1 ? ' (' + (i + 1) + ')' : ''), first(t, 'desc'), pts(tags(s, 'trkpt'))); }); });
    tags(doc, 'rte').forEach(function (t) { ln(r, first(t, 'name'), first(t, 'desc'), pts(tags(t, 'rtept'))); });
    return r;
  }
  function fromGeoJSON(g) {
    var r = vacio(), P = function (p) { return [p[1], p[0]]; };
    var nom = function (p) { p = p || {}; for (var k in p) if (/^(name|nombre|title|titulo|label|etiqueta)$/i.test(k) && p[k]) return p[k]; return ''; };
    var det = function (p) { p = p || {}; for (var k in p) if (/^(description|descripcion|detalle|observacion|direccion)$/i.test(k) && p[k]) return p[k]; return ''; };
    var est = function (p) { p = p || {}; for (var k in p) if (/^(estado|status)$/i.test(k)) return estadoDe(p[k]); return 'pendiente'; };
    (function walk(o, nombre, detalle, estado) {
      if (!o) return;
      if (o.type === 'FeatureCollection') return (o.features || []).forEach(function (f) { walk(f); });
      if (o.type === 'Feature') return walk(o.geometry, nom(o.properties), det(o.properties), est(o.properties));
      var c = o.coordinates;
      if (o.type === 'Point') pt(r, nombre, detalle, num(c[1]), num(c[0]));
      else if (o.type === 'MultiPoint') c.forEach(function (p) { pt(r, nombre, detalle, num(p[1]), num(p[0])); });
      else if (o.type === 'LineString') ln(r, nombre, detalle, c.map(P), estado);
      else if (o.type === 'MultiLineString') c.forEach(function (l) { ln(r, nombre, detalle, l.map(P), estado); });
      else if (o.type === 'Polygon') c.forEach(function (ring) { ln(r, nombre, detalle, ring.map(P), estado); });
      else if (o.type === 'MultiPolygon') c.forEach(function (pg) { pg.forEach(function (ring) { ln(r, nombre, detalle, ring.map(P), estado); }); });
      else if (o.type === 'GeometryCollection') (o.geometries || []).forEach(function (x) { walk(x, nombre, detalle, estado); });
    })(g);
    return r;
  }
  function fromJSON(j) {
    if (j && typeof j === 'object' && j.type) return fromGeoJSON(j);
    if (Array.isArray(j) && j.length && typeof j[0] === 'object' && !Array.isArray(j[0])) { /* lista de objetos {nombre, lat, lon} */
      var keys = []; j.forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
      return fromTable([keys].concat(j.map(function (o) { return keys.map(function (k) { return o[k]; }); })));
    }
    throw new Error('El archivo JSON no es GeoJSON ni una lista de objetos con latitud y longitud.');
  }
  function wktInto(r, text, nombre, detalle) {
    var nums = function (s) { return s.split(',').map(function (q) { var n = q.trim().split(/\s+/); return [num(n[1]), num(n[0])]; }); };
    var re = /(MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|POINT|LINESTRING|POLYGON)\s*(?:ZM|Z|M)?\s*(\((?:[^()]|\((?:[^()]|\((?:[^()])*\))*\))*\))/gi, m, n = 0;
    while ((m = re.exec(text))) {
      n++; var T = m[1].toUpperCase(), body = m[2];
      if (T === 'POINT') { var q = nums(body.replace(/[()]/g, ''))[0]; pt(r, nombre, detalle, q[0], q[1]); }
      else if (T === 'MULTIPOINT') nums(body.replace(/[()]/g, '')).forEach(function (q) { pt(r, nombre, detalle, q[0], q[1]); });
      else (body.match(/\(([^()]*)\)/g) || []).forEach(function (g) { ln(r, nombre, detalle, nums(g.replace(/[()]/g, ''))); });
    }
    return n;
  }
  function parseWKT(text) { var r = vacio(); if (!wktInto(r, text, '', '')) throw new Error('No encontré geometrías WKT (POINT, LINESTRING…).'); return r; }

  /* ---------- tablas: Excel, ODS, CSV, texto ---------- */
  var RE = {
    lat: /^(lat|latitud|latitude|norte|north|northing|y|coordy|coordenaday|ycoord|ycoordenada)$/,
    lon: /^(lon|lng|long|longitud|longitude|este|east|easting|x|coordx|coordenadax|xcoord|xcoordenada)$/,
    uno: /^(coordenadas|coordenada|coords|coordinates|latlon|latlng|geom|geometry|geometria|wkt|thegeom)$/,
    grupo: /^(tramo|tramos|linea|lineas|ruta|segmento|recorrido|trazo|idtramo|idlinea)$/,
    nombre: /^(nombre|name|titulo|punto|paradero|semaforo|etiqueta|label|id|codigo|cod|numero|no|item|sitio|lugar)$/,
    detalle: /^(detalle|detalles|descripcion|description|observacion|observaciones|referencia|direccion|nota|notas|comentario|comentarios|interseccion|ubicacion)$/,
    estado: /^(estado|status|avance|situacion)$/,
    orden: /^(orden|seq|secuencia|vertice|indice|idx|pos)$/
  };
  function cabecera(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var h = (rows[i] || []).map(norm), f = function (re) { return h.findIndex(function (x) { return re.test(x); }); };
      var c = { i: i, la: f(RE.lat), lo: f(RE.lon), uno: f(RE.uno), gr: f(RE.grupo), no: f(RE.nombre), de: f(RE.detalle), es: f(RE.estado), or: f(RE.orden) };
      if ((c.la >= 0 && c.lo >= 0) || c.uno >= 0) return c;
    }
    return null;
  }
  var cel = function (row, i) { return i >= 0 && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''; };
  function fromTable(rows) {
    var r = vacio(), c = cabecera(rows), omitidas = 0, ini;
    if (c) ini = c.i + 1;
    else { /* sin encabezados: las dos últimas columnas numéricas son las coordenadas */
      ini = rows.findIndex(function (row) { return row && row.length >= 2 && num(row[row.length - 1]) !== null && num(row[row.length - 2]) !== null; });
      if (ini < 0) throw new Error('No encontré las columnas de latitud y longitud. Ponles encabezado «lat» y «lon» (o usa la plantilla), o pega líneas «nombre; lat; lon».');
      c = { la: rows[ini].length - 2, lo: rows[ini].length - 1, uno: -1, gr: -1, no: rows[ini].length > 2 ? 0 : -1, de: -1, es: -1, or: -1 };
    }
    var grupos = [], idx = {};
    for (var k = ini; k < rows.length; k++) {
      var row = rows[k] || []; if (!row.some(function (x) { return String(x == null ? '' : x).trim(); })) continue;
      var nombre = cel(row, c.no), detalle = cel(row, c.de), gr = cel(row, c.gr);
      if (c.uno >= 0) {
        var cell = cel(row, c.uno);
        if (!wktInto(r, cell, nombre, detalle)) { var m = /(-?\d+[.,]\d+)\s*[;,\s]+\s*(-?\d+[.,]\d+)/.exec(cell); if (m) pt(r, nombre, detalle, num(m[1]), num(m[2])); else omitidas++; }
        continue;
      }
      var a = num(row[c.la]), b = num(row[c.lo]);
      if (a === null || b === null) { omitidas++; continue; }
      if (c.gr >= 0 && gr) {
        var g = idx[gr]; if (!g) { g = idx[gr] = { nombre: nombre || gr, detalle: detalle, estado: estadoDe(cel(row, c.es)), v: [] }; grupos.push(g); }
        g.v.push({ o: c.or >= 0 ? num(row[c.or]) : null, p: [a, b], n: g.v.length });
      } else pt(r, nombre, detalle, a, b);
    }
    grupos.forEach(function (g) {
      if (g.v.some(function (x) { return x.o !== null; })) g.v.sort(function (x, y) { return (x.o === null ? 1e9 : x.o) - (y.o === null ? 1e9 : y.o) || x.n - y.n; });
      if (g.v.length === 1) pt(r, g.nombre, g.detalle, g.v[0].p[0], g.v[0].p[1]); else ln(r, g.nombre, g.detalle, g.v.map(function (x) { return x.p; }), g.estado);
    });
    if (omitidas) r.aviso.push(omitidas + ' fila(s) sin coordenadas válidas se omitieron.');
    if (!r.puntos.length && !r.lineas.length) throw new Error('Encontré las columnas, pero ninguna fila con coordenadas.');
    return r;
  }
  function splitLine(l, d) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < l.length; i++) {
      var ch = l[i];
      if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === d) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out.map(function (x) { return x.trim(); });
  }
  function delimitador(lines) {
    var sample = lines.slice(0, 6), cnt = function (l, d) { return l.split(d).length - 1; };
    var ds = [';', '\t', ','];
    for (var i = 0; i < ds.length; i++) { var c0 = cnt(sample[0], ds[i]); if (c0 > 0 && sample.every(function (l) { return cnt(l, ds[i]) === c0; })) return ds[i]; }
    return ds.map(function (d) { return [d, cnt(sample[0], d)]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
  }
  /* grados-minutos-segundos (4°26'18"N 75°13'56"W) → decimales */
  function dms(t) {
    return t.replace(/(-?)(\d{1,3})\s*[°º]\s*(?:(\d{1,2})\s*['’′]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:"|”|″|''|’’)\s*)?([NSEWO])?/gi, function (all, neg, d, m, s, h) {
      var v = Number(d) + (m ? Number(m) / 60 : 0) + (s ? Number(String(s).replace(',', '.')) / 3600 : 0);
      if (neg || (h && /[SWO]/i.test(h))) v = -v; return (Math.round(v * 1e6) / 1e6).toString();
    });
  }
  function parseText(text) {
    var t = String(text || '').replace(/^﻿/, '').trim(), c = t.charAt(0);
    if (!t) throw new Error('El archivo o el texto está vacío.');
    if (c === '{' || c === '[') { var j; try { j = JSON.parse(t); } catch (e) { throw new Error('El JSON no es válido (revisa comas y llaves).'); } return fromJSON(j); }
    if (c === '<') {
      if (/<gpx[\s>]/i.test(t.slice(0, 3000))) return parseGPX(t);
      if (/<kml[\s>]|<Placemark/i.test(t)) return parseKML(t);
      throw new Error('Es un archivo XML, pero no es KML ni GPX.');
    }
    var lines = t.split(/\r?\n/).filter(function (l) { return l.trim(); }), d = delimitador(lines);
    var rows = lines.map(function (l) { return splitLine(l, d); });
    if (cabecera(rows)) return fromTable(rows);
    if (/(POINT|LINESTRING|POLYGON)\s*(?:ZM|Z|M)?\s*\(/i.test(t)) return parseWKT(t);
    var r = vacio(), re = /(-?\d+[.,]\d+|-?\d{5,})\s*[;,\t ]+\s*(-?\d+[.,]\d+|-?\d{5,})\s*$/, buenas = 0;
    dms(t).split(/\r?\n/).forEach(function (l) {
      l = l.trim(); var m = l && re.exec(l); if (!m) return; buenas++;
      pt(r, l.slice(0, m.index).replace(/[;,\t ]+$/, '').replace(/^"|"$/g, ''), '', num(m[1]), num(m[2]));
    });
    if (buenas) return r;
    return fromTable(rows);
  }

  async function readXLSX(u8) {
    var list = zipList(u8), by = {}; list.forEach(function (f) { by[f.name.toLowerCase()] = f; });
    var ss = []; if (by['xl/sharedstrings.xml']) ss = tags(xml(decodeText(await zipRead(u8, by['xl/sharedstrings.xml']))), 'si').map(function (si) { return tags(si, 't').map(function (x) { return x.textContent; }).join(''); });
    var hojas = list.filter(function (f) { return /^xl\/worksheets\/[^/]+\.xml$/i.test(f.name); }).sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { numeric: true }); });
    if (!hojas.length) throw new Error('El libro de Excel no tiene hojas con datos.');
    var ultimo = null;
    for (var h = 0; h < hojas.length; h++) {
      var rows = [], filas = tags(xml(decodeText(await zipRead(u8, hojas[h]))), 'row').slice(0, 60000);
      filas.forEach(function (rw) {
        var cells = [];
        tags(rw, 'c').forEach(function (cc) {
          var ref = /^([A-Z]+)/.exec(cc.getAttribute('r') || ''), col = ref ? ref[1].split('').reduce(function (a, ch) { return a * 26 + ch.charCodeAt(0) - 64; }, 0) - 1 : cells.length;
          var t = cc.getAttribute('t'), v = first(cc, 'v'), val;
          if (t === 's') val = ss[Number(v)]; else if (t === 'inlineStr') val = tags(cc, 't').map(function (x) { return x.textContent; }).join(''); else if (t === 'str' || t === 'b') val = v; else if (t === 'e') val = ''; else val = v === '' ? '' : Number(v);
          while (cells.length < col) cells.push(''); cells[col] = val === undefined ? '' : val;
        });
        rows.push(cells);
      });
      try { return fromTable(rows); } catch (e) { ultimo = e; }
    }
    throw ultimo;
  }
  async function readODS(u8) {
    var f = zipList(u8).filter(function (x) { return x.name === 'content.xml'; })[0]; if (!f) throw new Error('El archivo .ods no tiene contenido.');
    var doc = xml(decodeText(await zipRead(u8, f))), ultimo = null;
    var hojas = tags(doc, 'table').filter(function (x) { return x.localName === 'table'; });
    for (var h = 0; h < hojas.length; h++) {
      var rows = [];
      tags(hojas[h], 'table-row').slice(0, 60000).forEach(function (rw) {
        var rep = Number(rw.getAttribute('table:number-rows-repeated') || 1), cells = [];
        Array.prototype.forEach.call(rw.children, function (cc) {
          var n = Math.min(Number(cc.getAttribute('table:number-columns-repeated') || 1), 60), tp = cc.getAttribute('office:value-type'), v;
          if (tp === 'float' || tp === 'percentage' || tp === 'currency') v = Number(cc.getAttribute('office:value')); else v = cc.textContent;
          for (var i = 0; i < n; i++) cells.push(v);
        });
        for (var j = 0; j < Math.min(rep, 3); j++) rows.push(cells);
      });
      try { return fromTable(rows); } catch (e) { ultimo = e; }
    }
    throw ultimo || new Error('El archivo .ods no tiene hojas.');
  }

  /* ---------- Shapefile ---------- */
  function parseDBF(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true), fields = [], p = 32;
    while (p < hl - 1 && u8[p] !== 0x0D) { fields.push({ n: new TextDecoder().decode(u8.subarray(p, p + 11)).replace(/\0[\s\S]*$/, ''), len: u8[p + 16] }); p += 32; }
    var dec; try { var tdu = new TextDecoder('utf-8', { fatal: true }); tdu.decode(u8.subarray(hl)); dec = function (b) { return tdu.decode(b); }; } catch (e) { var tdw = new TextDecoder('windows-1252'); dec = function (b) { return tdw.decode(b); }; }
    var rows = [];
    for (var i = 0; i < n; i++) {
      var o = hl + i * rl; if (o + rl > u8.length) break; if (u8[o] === 0x2A) { rows.push(null); continue; }
      var q = o + 1, rec = {}; fields.forEach(function (f) { rec[f.n] = dec(u8.subarray(q, q + f.len)).replace(/\0/g, '').trim(); q += f.len; }); rows.push(rec);
    }
    return rows;
  }
  function attrs(rec) {
    var o = { nombre: '', detalle: '', estado: 'pendiente' }; if (!rec) return o;
    var keys = Object.keys(rec), pick = function (re) { var k = keys.filter(function (x) { return re.test(norm(x)) && rec[x]; })[0]; return k ? rec[k] : ''; };
    o.nombre = pick(RE.nombre) || pick(/^(nom.*|name.*|nomb.*)$/); o.detalle = pick(RE.detalle); o.estado = estadoDe(pick(RE.estado));
    if (!o.nombre) { var k = keys.filter(function (x) { return rec[x] && isNaN(Number(rec[x])); })[0]; if (k) o.nombre = rec[k]; }
    return o;
  }
  function parseSHP(u8, dbf) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), r = vacio();
    if (u8.length < 100 || dv.getInt32(0, false) !== 9994) throw new Error('El archivo .shp no es un shapefile válido.');
    var rows = dbf ? parseDBF(dbf) : [], p = 100, i = 0;
    while (p + 12 <= u8.length) {
      var s = p + 8, len = dv.getInt32(p + 4, false) * 2, t = dv.getInt32(s, true), a = attrs(rows[i++]);
      if (t === 1 || t === 11 || t === 21) pt(r, a.nombre, a.detalle, dv.getFloat64(s + 12, true), dv.getFloat64(s + 4, true));
      else if (t === 8 || t === 18 || t === 28) { var np = dv.getInt32(s + 36, true); for (var k = 0; k < np; k++) pt(r, a.nombre, a.detalle, dv.getFloat64(s + 48 + k * 16, true), dv.getFloat64(s + 40 + k * 16, true)); }
      else if (t === 3 || t === 13 || t === 23 || t === 5 || t === 15 || t === 25) {
        var nparts = dv.getInt32(s + 36, true), npts = dv.getInt32(s + 40, true), po = s + 44 + 4 * nparts;
        for (var q = 0; q < nparts; q++) {
          var from = dv.getInt32(s + 44 + 4 * q, true), to = q + 1 < nparts ? dv.getInt32(s + 44 + 4 * (q + 1), true) : npts, cs = [];
          for (var m = from; m < to; m++) cs.push([dv.getFloat64(po + m * 16 + 8, true), dv.getFloat64(po + m * 16, true)]);
          ln(r, a.nombre, a.detalle, cs, a.estado);
        }
      }
      p = s + len;
    }
    if (!r.puntos.length && !r.lineas.length) throw new Error('El shapefile no tiene puntos ni líneas (¿es de polígonos vacíos o de otro tipo?).');
    return r;
  }

  /* ---------- sistemas de coordenadas ---------- */
  var PROJ = [
    { nombre: 'MAGNA-SIRGAS Colombia Bogotá', lat0: 4.596200417, lon0: -74.07750792, k0: 1, fe: 1e6, fn: 1e6 },
    { nombre: 'MAGNA-SIRGAS Origen Nacional (CTM12)', lat0: 4, lon0: -73, k0: 0.9992, fe: 5e6, fn: 2e6 },
    { nombre: 'UTM zona 18 Norte', lat0: 0, lon0: -75, k0: 0.9996, fe: 5e5, fn: 0 },
    { nombre: 'MAGNA-SIRGAS Colombia Oeste', lat0: 4.596200417, lon0: -77.07750792, k0: 1, fe: 1e6, fn: 1e6 },
    { nombre: 'MAGNA-SIRGAS Colombia Este Central', lat0: 4.596200417, lon0: -72.07750792, k0: 1, fe: 1e6, fn: 1e6 }
  ];
  var A = 6378137, F = 1 / 298.257222101, E2 = 2 * F - F * F, EP2 = E2 / (1 - E2);
  function arco(phi) { return A * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * Math.pow(E2, 3) / 256) * phi - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * Math.pow(E2, 3) / 1024) * Math.sin(2 * phi) + (15 * E2 * E2 / 256 + 45 * Math.pow(E2, 3) / 1024) * Math.sin(4 * phi) - (35 * Math.pow(E2, 3) / 3072) * Math.sin(6 * phi)); }
  /* Mercator transversa inversa (Snyder): este/norte planos → [lat, lon] en grados */
  function tmInv(E, N, P) {
    var d2r = Math.PI / 180, M = arco(P.lat0 * d2r) + (N - P.fn) / P.k0, e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    var mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * Math.pow(E2, 3) / 256));
    var p1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    var s = Math.sin(p1), c = Math.cos(p1), tn = Math.tan(p1), C1 = EP2 * c * c, T1 = tn * tn, N1 = A / Math.sqrt(1 - E2 * s * s), R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5), D = (E - P.fe) / (N1 * P.k0);
    var lat = p1 - (N1 * tn / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
    var lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / c;
    return [lat / d2r, P.lon0 + lon / d2r];
  }
  var enColombia = function (la, lo) { return la >= -5 && la <= 14 && lo >= -82 && lo <= -66; };
  var enIbague = function (la, lo) { return la >= 4.2 && la <= 4.7 && lo >= -75.5 && lo <= -75.0; };

  function pares(r, fn) { r.puntos.forEach(function (p) { var q = fn([p.lat, p.lon]); p.lat = q[0]; p.lon = q[1]; }); r.lineas.forEach(function (l) { l.coords = l.coords.map(fn); }); }
  function normalizar(r) {
    var m = []; r.puntos.forEach(function (p) { if (m.length < 400) m.push([p.lat, p.lon]); }); r.lineas.forEach(function (l) { l.coords.forEach(function (q) { if (m.length < 400) m.push(q); }); });
    if (!m.length) return;
    var grados = m.every(function (q) { return Math.abs(q[0]) <= 90 && Math.abs(q[1]) <= 180; });
    if (grados) {
      var n1 = m.filter(function (q) { return enColombia(q[0], q[1]); }).length, n2 = m.filter(function (q) { return enColombia(q[1], q[0]); }).length;
      if (n2 > n1) { pares(r, function (q) { return [q[1], q[0]]; }); r.aviso.push('Latitud y longitud venían invertidas; las puse en su orden.'); }
      return;
    }
    var mejor = null;
    PROJ.forEach(function (P) { [false, true].forEach(function (inv) {
      var okI = 0, okC = 0; m.forEach(function (q) { var g = inv ? tmInv(q[0], q[1], P) : tmInv(q[1], q[0], P); if (enIbague(g[0], g[1])) okI++; if (enColombia(g[0], g[1])) okC++; });
      if ((okI >= m.length / 2 || okC >= m.length / 2) && (!mejor || okI > mejor.okI || (okI === mejor.okI && okC > mejor.okC))) mejor = { P: P, inv: inv, okI: okI, okC: okC };
    }); });
    if (!mejor) throw new Error('Las coordenadas no están en grados ni en un sistema colombiano que reconozca (MAGNA-SIRGAS Bogotá, Oeste, Este Central, Origen Nacional CTM12 o UTM 18N). Conviértelas a grados (WGS84) en QGIS o Google Earth y vuelve a subir el archivo.');
    pares(r, function (q) { return mejor.inv ? tmInv(q[0], q[1], mejor.P) : tmInv(q[1], q[0], mejor.P); });
    r.aviso.push('Las coordenadas venían en «' + mejor.P.nombre + '»; las convertí a grados (WGS84).');
  }
  /* Douglas-Peucker en metros: quita vértices que no cambian la forma */
  function simplificar(cs, tol) {
    var n = cs.length; if (n < 3) return cs;
    var kx = 111320 * Math.cos(cs[0][0] * Math.PI / 180), ky = 110540, P = cs.map(function (c) { return [c[1] * kx, c[0] * ky]; }), keep = new Uint8Array(n), st = [[0, n - 1]];
    keep[0] = keep[n - 1] = 1;
    while (st.length) {
      var s = st.pop(), a = s[0], b = s[1], md = 0, mi = -1, ax = P[a][0], ay = P[a][1], dx = P[b][0] - ax, dy = P[b][1] - ay, L = dx * dx + dy * dy;
      for (var i = a + 1; i < b; i++) { var t = L === 0 ? 0 : Math.max(0, Math.min(1, ((P[i][0] - ax) * dx + (P[i][1] - ay) * dy) / L)), d = Math.hypot(P[i][0] - ax - t * dx, P[i][1] - ay - t * dy); if (d > md) { md = d; mi = i; } }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return cs.filter(function (c, i) { return keep[i]; });
  }
  var r6 = function (n) { return Math.round(n * 1e6) / 1e6; };
  function finalizar(r) {
    if (r._final) return r;
    normalizar(r);
    var antes = 0, despues = 0;
    r.puntos.forEach(function (p) { p.lat = r6(p.lat); p.lon = r6(p.lon); });
    r.lineas.forEach(function (l) {
      var cs = l.coords.map(function (q) { return [r6(q[0]), r6(q[1])]; }).filter(function (q, i, a) { return i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]; });
      antes += l.coords.length;
      if (cs.length > 150) { var tol = 1.5, s = simplificar(cs, tol); while (s.length > 1500 && tol < 60) { tol *= 2; s = simplificar(cs, tol); } cs = s; }
      l.coords = cs; despues += cs.length;
    });
    r.lineas = r.lineas.filter(function (l) { return l.coords.length >= 2; });
    if (antes > despues * 1.2 && antes - despues > 50) r.aviso.push('Simplifiqué el dibujo de los tramos (de ' + antes.toLocaleString('es-CO') + ' a ' + despues.toLocaleString('es-CO') + ' vértices) sin perder la forma de la vía, para que la página cargue rápido.');
    if (r.puntos.length > 5000) { r.aviso.push('Una capa admite hasta 5.000 puntos; agregué los primeros 5.000.'); r.puntos.length = 5000; }
    if (r.lineas.length > 5000) { r.aviso.push('Una capa admite hasta 5.000 tramos; agregué los primeros 5.000.'); r.lineas.length = 5000; }
    r._final = true; return r;
  }
  function unir(a, b) { b.puntos.forEach(function (p) { a.puntos.push(p); }); b.lineas.forEach(function (l) { a.lineas.push(l); }); return a; }

  /* ---------- entrada de archivos ---------- */
  var EXT_TEXTO = /^(kml|gpx|geojson|json|csv|txt|tsv|wkt|tab|xml)$/;
  async function crudo(nombre, u8, comp) {
    var ext = ((/\.([a-z0-9]+)$/i.exec(nombre) || [])[1] || '').toLowerCase();
    if (ext === 'kmz') {
      var l = zipList(u8).filter(function (f) { return /\.kml$/i.test(f.name); }).sort(function (a, b) { return /(^|\/)doc\.kml$/i.test(b.name) - /(^|\/)doc\.kml$/i.test(a.name); });
      if (!l.length) throw new Error('El KMZ no contiene un archivo KML.');
      return parseKML(decodeText(await zipRead(u8, l[0])));
    }
    if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xltx') return readXLSX(u8);
    if (ext === 'ods') return readODS(u8);
    if (ext === 'zip') return crudoZip(u8);
    if (ext === 'shp') return parseSHP(u8, comp && comp.dbf);
    if (ext === 'xls') throw new Error('Los archivos Excel antiguos (.xls) no se pueden leer. Ábrelo en Excel → Archivo → Guardar como → «Libro de Excel (.xlsx)» y súbelo de nuevo.');
    if (ext === 'dbf') throw new Error('El .dbf solo trae la tabla de datos. Selecciónalo junto con el .shp (o sube el .zip completo del shapefile).');
    if (/^(dwg|dxf|pdf|doc|docx|png|jpg|jpeg|gif|tif|tiff|mp4)$/.test(ext)) throw new Error('Este formato (.' + ext + ') no trae coordenadas que pueda leer. Exporta los puntos a KML, GeoJSON, Excel o CSV desde el programa donde los tienes.');
    if (EXT_TEXTO.test(ext) || (u8.subarray(0, 2000).indexOf(0) < 0)) return parseText(decodeText(u8));
    throw new Error('No reconozco el formato de «' + nombre + '».');
  }
  async function crudoZip(u8) {
    var list = zipList(u8).filter(function (f) { return !/(^|\/)(__MACOSX|\.)/.test(f.name); }), total = vacio(), hallado = 0;
    var base = function (n) { return n.replace(/\.[^.]+$/, '').toLowerCase(); };
    var dbfs = {}; list.forEach(function (f) { if (/\.dbf$/i.test(f.name)) dbfs[base(f.name)] = f; });
    for (var i = 0; i < list.length; i++) {
      var f = list[i], ext = ((/\.([a-z0-9]+)$/i.exec(f.name) || [])[1] || '').toLowerCase();
      if (!/^(shp|kml|kmz|gpx|geojson|json|csv|tsv|xlsx|xlsm|ods)$/.test(ext)) continue;
      var comp = null; if (ext === 'shp' && dbfs[base(f.name)]) comp = { dbf: await zipRead(u8, dbfs[base(f.name)]) };
      var sub = finalizar(await crudo(f.name, await zipRead(u8, f), comp)); sub.aviso.forEach(function (a) { total.aviso.push(a); }); unir(total, sub); hallado++;
    }
    if (!hallado) throw new Error('El .zip no contiene archivos que pueda leer (busco .shp, .kml, .kmz, .gpx, .geojson, .csv, .xlsx u .ods).');
    total._final = true; return total;
  }
  /* Lee varios archivos a la vez. Devuelve el conjunto unido y un informe por archivo (los que fallan no frenan a los demás). */
  async function parseFiles(files) {
    files = Array.prototype.slice.call(files); var total = vacio(), informe = [], dbfs = {};
    var base = function (n) { return n.replace(/\.[^.]+$/, '').toLowerCase(); };
    files.forEach(function (f) { if (/\.dbf$/i.test(f.name)) dbfs[base(f.name)] = f; });
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.(prj|cpg|shx|sbn|sbx|qix|qpj|aux|xml)$/i.test(f.name) && files.length > 1) continue;
      if (/\.dbf$/i.test(f.name) && files.some(function (x) { return /\.shp$/i.test(x.name) && base(x.name) === base(f.name); })) continue;
      try {
        if (f.size > 40 * 1024 * 1024) throw new Error('El archivo pesa más de 40 MB. Reduce su tamaño o divídelo.');
        var comp = null; if (/\.shp$/i.test(f.name) && dbfs[base(f.name)]) comp = { dbf: new Uint8Array(await dbfs[base(f.name)].arrayBuffer()) };
        var r = finalizar(await crudo(f.name, new Uint8Array(await f.arrayBuffer()), comp));
        informe.push({ archivo: f.name, puntos: r.puntos.length, lineas: r.lineas.length, aviso: r.aviso.slice() }); unir(total, r);
      } catch (e) { informe.push({ archivo: f.name, error: e && e.message ? e.message : String(e) }); }
    }
    return { res: total, informe: informe };
  }
  function parsePegado(text) { return finalizar(parseText(text)); }

  /* Largo aproximado de un trazo, en metros */
  function largoM(c) { var t = 0, k = Math.PI / 180; for (var i = 1; i < c.length; i++) { var dl = (c[i][0] - c[i - 1][0]) * k, dn = (c[i][1] - c[i - 1][1]) * k, a = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(c[i - 1][0] * k) * Math.cos(c[i][0] * k) * Math.sin(dn / 2) * Math.sin(dn / 2); t += 2 * 6371000 * Math.asin(Math.sqrt(a)); } return t; }

  var G = { parseFiles: parseFiles, parsePegado: parsePegado, parseText: parseText, parseKML: parseKML, parseGPX: parseGPX, parseWKT: parseWKT, fromTable: fromTable, parseSHP: parseSHP, parseDBF: parseDBF, readXLSX: readXLSX, readODS: readODS, finalizar: finalizar, normalizar: normalizar, tmInv: tmInv, PROJ: PROJ, num: num, dms: dms, simplificar: simplificar, zipList: zipList, zipRead: zipRead, enIbague: enIbague, enColombia: enColombia, largoM: largoM };
  if (typeof window !== 'undefined') window.SETPGeo = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();

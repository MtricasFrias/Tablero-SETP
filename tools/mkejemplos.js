/* Genera los archivos de EJEMPLO que se descargan desde el panel (admin/ejemplos/) para mostrar cómo deben verse los archivos de mapa.
   Los datos son ficticios ("Punto de ejemplo"), solo en el centro de Ibagué.   node tools/mkejemplos.js */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('node:zlib');
const out = path.join(__dirname, '..', 'admin', 'ejemplos'); fs.mkdirSync(out, { recursive: true });

function zip(entradas) {
  const partes = [], central = []; let off = 0;
  entradas.forEach(([name, data]) => {
    const raw = Buffer.from(data), comp = zlib.deflateRawSync(raw), nm = Buffer.from(name), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    partes.push(lh, nm, comp); central.push(ch, nm); off += 30 + nm.length + comp.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entradas.length, 8); end.writeUInt16LE(entradas.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(partes.concat([cd, end]));
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PUNTOS = [['Punto de ejemplo 1', 'Parque Murillo Toro', 4.4389, -75.2322], ['Punto de ejemplo 2', 'Carrera 5 con Calle 10', 4.4412, -75.2301], ['Punto de ejemplo 3', 'Calle 60 con Carrera 5', 4.4501, -75.2214], ['Punto de ejemplo 4', 'Avenida Ambalá', 4.4287, -75.2105]];
const TRAMO = [[4.4401, -75.2300], [4.4408, -75.2311], [4.4415, -75.2322], [4.4422, -75.2330], [4.4430, -75.2339]];
const TRAMOS_FILAS = TRAMO.map((q, i) => ['Tramo de ejemplo 1', i + 1, q[0], q[1], 'ejecutado']).concat([[ 'Tramo de ejemplo 2', 1, 4.4430, -75.2339, 'en curso'], ['Tramo de ejemplo 2', 2, 4.4441, -75.2351, 'en curso'], ['Tramo de ejemplo 2', 3, 4.4452, -75.2362, 'en curso']]);

/* ---- XLSX ---- */
function xlsx(cabecera, filas) {
  const ss = [], idx = {}; const S = t => { if (!(t in idx)) { idx[t] = ss.length; ss.push(t); } return idx[t]; };
  const col = n => String.fromCharCode(65 + n);
  const celda = (v, r, c) => typeof v === 'number' ? `<c r="${col(c)}${r}"><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="s"><v>${S(v)}</v></c>`;
  const rows = [cabecera].concat(filas).map((f, i) => `<row r="${i + 1}">${f.map((v, c) => celda(v, i + 1, c)).join('')}</row>`).join('');
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return zip([
    ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'],
    ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', X + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`],
    ['xl/sharedStrings.xml', X + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ss.length}" uniqueCount="${ss.length}">${ss.map(t => `<si><t>${esc(t)}</t></si>`).join('')}</sst>`]
  ]);
}
/* ---- ODS ---- */
function ods(cabecera, filas) {
  const c = v => typeof v === 'number' ? `<table:table-cell office:value-type="float" office:value="${v}"><text:p>${v}</text:p></table:table-cell>` : `<table:table-cell office:value-type="string"><text:p>${esc(v)}</text:p></table:table-cell>`;
  const rows = [cabecera].concat(filas).map(f => `<table:table-row>${f.map(c).join('')}</table:table-row>`).join('');
  return zip([['mimetype', 'application/vnd.oasis.opendocument.spreadsheet'], ['META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>'],
    ['content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:spreadsheet><table:table table:name="Hoja1">${rows}</table:table></office:spreadsheet></office:body></office:document-content>`]]);
}
/* ---- KML / GPX / GeoJSON / CSV ---- */
const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Ejemplo SETP</name>\n` +
  PUNTOS.map(p => `<Placemark><name>${esc(p[0])}</name><description>${esc(p[1])}</description><Point><coordinates>${p[3]},${p[2]},0</coordinates></Point></Placemark>`).join('\n') + '\n' +
  `<Placemark><name>Tramo de ejemplo 1</name><description>Recorrido de ejemplo</description><LineString><coordinates>${TRAMO.map(q => q[1] + ',' + q[0] + ',0').join(' ')}</coordinates></LineString></Placemark></Document></kml>\n`;
const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="SETP" xmlns="http://www.topografix.com/GPX/1/1">\n` + PUNTOS.map(p => `<wpt lat="${p[2]}" lon="${p[3]}"><name>${esc(p[0])}</name><desc>${esc(p[1])}</desc></wpt>`).join('\n') +
  `\n<trk><name>Tramo de ejemplo 1</name><trkseg>${TRAMO.map(q => `<trkpt lat="${q[0]}" lon="${q[1]}"/>`).join('')}</trkseg></trk></gpx>\n`;
const geojson = JSON.stringify({ type: 'FeatureCollection', features: PUNTOS.map(p => ({ type: 'Feature', properties: { nombre: p[0], descripcion: p[1] }, geometry: { type: 'Point', coordinates: [p[3], p[2]] } })).concat([{ type: 'Feature', properties: { nombre: 'Tramo de ejemplo 1', estado: 'ejecutado' }, geometry: { type: 'LineString', coordinates: TRAMO.map(q => [q[1], q[0]]) } }]) }, null, 1);
const csvPuntos = 'nombre;detalle;lat;lon\r\n' + PUNTOS.map(p => `${p[0]};${p[1]};${String(p[2]).replace('.', ',')};${String(p[3]).replace('.', ',')}`).join('\r\n') + '\r\n';
const csvTramos = 'tramo;orden;lat;lon;estado\r\n' + TRAMOS_FILAS.map(f => `${f[0]};${f[1]};${String(f[2]).replace('.', ',')};${String(f[3]).replace('.', ',')};${f[4]}`).join('\r\n') + '\r\n';

const w = (n, d) => fs.writeFileSync(path.join(out, n), typeof d === 'string' && /\.(csv)$/.test(n) ? '﻿' + d : d);
w('ejemplo-puntos.xlsx', xlsx(['nombre', 'detalle', 'lat', 'lon'], PUNTOS));
w('ejemplo-tramos.xlsx', xlsx(['tramo', 'orden', 'lat', 'lon', 'estado'], TRAMOS_FILAS));
w('ejemplo-puntos.ods', ods(['nombre', 'detalle', 'lat', 'lon'], PUNTOS));
w('ejemplo-puntos.csv', csvPuntos); w('ejemplo-tramos.csv', csvTramos);
w('ejemplo.kml', kml); w('ejemplo.kmz', zip([['doc.kml', kml]])); w('ejemplo.gpx', gpx); w('ejemplo.geojson', geojson);
console.log(fs.readdirSync(out).map(f => f + ' (' + fs.statSync(path.join(out, f)).size + ' B)').join('\n'));

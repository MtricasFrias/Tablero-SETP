/* Operaciones del panel de administración (todas exigen sesión). Se elige con ?a=
   draft (GET/PUT) · compare · publish · discard · visibility · img · history · restore · seed · export */
'use strict';
const crypto = require('node:crypto');
const L = require('./_lib');
const { sanitizeDoc } = require('./_schema');

const clone = o => JSON.parse(JSON.stringify(o));

async function meta() { return (await L.getJSON('setp:pubmeta')) || null; }
async function ensureDraft(req, by) {
  let d = await L.getJSON('setp:draft');
  if (d) return d;
  const pub = await L.getJSON('setp:pub');
  const datos = sanitizeDoc(pub || await L.loadSeed(req));
  d = { rev: 1, datos, ts: Date.now(), by: by || 'sistema' };
  await L.setJSON('setp:draft', d);
  if (!(await meta())) await L.setJSON('setp:pubmeta', { rev: 1, ts: Date.now(), by: 'inicial', nota: pub ? 'Versión publicada' : 'Contenido inicial del tablero' });
  return d;
}
const estado = (d, m) => ({ rev: d.rev, hayCambios: !m || m.rev !== d.rev, publicado: m });

module.exports = async function handler(req, res) {
  try {
    const a = L.query(req).a;
    const ses = await L.requireAdmin(req, res); if (!ses) return;
    const by = ses.u;

    if (a === 'draft' && req.method === 'GET') {
      const d = await ensureDraft(req, by), m = await meta();
      return L.send(res, 200, Object.assign({ datos: d.datos }, estado(d, m)));
    }
    if (a === 'compare' && req.method === 'GET') { /* borrador y lo que ve hoy el público, ambos ya validados, para mostrar qué cambiaría al publicar */
      const d = await ensureDraft(req, by), m = await meta();
      const pub = (await L.getJSON('setp:pub')) || sanitizeDoc(await L.loadSeed(req));
      return L.send(res, 200, Object.assign({ draft: d.datos, pub }, estado(d, m)));
    }
    if (a === 'draft' && req.method === 'PUT') {
      const body = await L.readBody(req);
      const cur = await ensureDraft(req, by), m = await meta();
      if (Number(body.rev) !== cur.rev) return L.send(res, 409, { error: 'conflicto', rev: cur.rev, mensaje: 'Otra persona guardó cambios mientras editabas. Recarga el panel para ver la versión más reciente.' });
      const datos = sanitizeDoc(body.datos);
      const nd = { rev: cur.rev + 1, datos, ts: Date.now(), by };
      await L.setJSON('setp:draft', nd);
      return L.send(res, 200, estado(nd, m));
    }

    if (req.method !== 'POST' && a !== 'history' && a !== 'export') return L.send(res, 405, { error: 'metodo' });

    if (a === 'publish') {
      const body = await L.readBody(req, 20000);
      const d = await ensureDraft(req, by);
      const doc = sanitizeDoc(d.datos);
      const m = { rev: d.rev, ts: Date.now(), by, nota: String(body.nota || '').slice(0, 200) };
      const hid = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
      const old = await L.redis(['LRANGE', 'setp:hist', 14, -1]);
      await L.pipeline([['SET', 'setp:pub', JSON.stringify(doc)], ['SET', 'setp:pubmeta', JSON.stringify(m)], ['SET', 'setp:h:' + hid, JSON.stringify(doc)],
        ['LPUSH', 'setp:hist', JSON.stringify({ id: hid, ts: m.ts, by, nota: m.nota, proyectos: doc.proyectos.length, visibles: doc.proyectos.filter(p => p.visible).length })], ['LTRIM', 'setp:hist', 0, 14]]);
      for (const x of (old || [])) { try { await L.redis(['DEL', 'setp:h:' + JSON.parse(x).id]); } catch (e) {} }
      return L.send(res, 200, estado(d, m));
    }

    if (a === 'discard') {
      const d = await ensureDraft(req, by), m = await meta();
      const pub = await L.getJSON('setp:pub');
      const datos = sanitizeDoc(pub || await L.loadSeed(req));
      const nd = { rev: d.rev + 1, datos, ts: Date.now(), by };
      await L.setJSON('setp:draft', nd);
      await L.setJSON('setp:pubmeta', Object.assign({}, m, { rev: nd.rev }));
      return L.send(res, 200, Object.assign({ datos }, estado(nd, Object.assign({}, m, { rev: nd.rev }))));
    }

    if (a === 'visibility') {
      const body = await L.readBody(req, 5000);
      const id = String(body.id || ''), vis = body.visible === true;
      const d = await ensureDraft(req, by); let m = await meta();
      const pend = !m || m.rev !== d.rev;
      let pub = await L.getJSON('setp:pub');
      if (!pub) pub = sanitizeDoc(await L.loadSeed(req));
      const pd = d.datos.proyectos.find(p => p.id === id), pp = pub.proyectos.find(p => p.id === id);
      if (!pd) return L.send(res, 404, { error: 'no_existe', mensaje: 'No se encontró ese proyecto.' });
      pd.visible = vis; if (pp) pp.visible = vis;
      pub.actualizado = new Date().toISOString();
      const nd = { rev: d.rev + 1, datos: d.datos, ts: Date.now(), by };
      m = Object.assign({}, m || {}, { rev: pend ? (m ? m.rev : 0) : nd.rev, ts: pend ? (m ? m.ts : Date.now()) : Date.now(), by });
      await L.pipeline([['SET', 'setp:draft', JSON.stringify(nd)], ['SET', 'setp:pub', JSON.stringify(pub)], ['SET', 'setp:pubmeta', JSON.stringify(m)]]);
      return L.send(res, 200, Object.assign({ ok: true, visible: vis }, estado(nd, m)));
    }

    if (a === 'img') {
      const body = await L.readBody(req, 1400000);
      const mime = String(body.mime || ''); if (!/^image\/(jpeg|png|webp)$/.test(mime)) return L.send(res, 400, { error: 'tipo', mensaje: 'Solo se aceptan imágenes JPG, PNG o WEBP.' });
      const buf = Buffer.from(String(body.base64 || ''), 'base64');
      if (!buf.length || buf.length > 800 * 1024) return L.send(res, 400, { error: 'tamano', mensaje: 'La imagen supera 800 KB. Se reduce automáticamente al subirla desde el panel.' });
      const ok = (mime === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8) || (mime === 'image/png' && buf.slice(0, 4).toString('hex') === '89504e47') || (mime === 'image/webp' && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
      if (!ok) return L.send(res, 400, { error: 'contenido', mensaje: 'El archivo no parece una imagen válida.' });
      const id = crypto.randomBytes(9).toString('base64url');
      await L.setJSON('setp:img:' + id, { m: mime, b: buf.toString('base64'), ts: Date.now(), by });
      return L.send(res, 200, { id });
    }

    if (a === 'history') {
      const l = (await L.redis(['LRANGE', 'setp:hist', 0, 14])) || [];
      return L.send(res, 200, { versiones: l.map(x => JSON.parse(x)) });
    }
    if (a === 'restore') {
      const body = await L.readBody(req, 5000); const hid = String(body.id || '');
      if (!/^[a-z0-9]{6,30}$/.test(hid)) return L.send(res, 400, { error: 'id' });
      const doc = await L.getJSON('setp:h:' + hid); if (!doc) return L.send(res, 404, { error: 'no_existe', mensaje: 'Esa versión ya no está disponible.' });
      const d = await ensureDraft(req, by), m = await meta();
      const nd = { rev: d.rev + 1, datos: sanitizeDoc(doc), ts: Date.now(), by }; await L.setJSON('setp:draft', nd);
      return L.send(res, 200, Object.assign({ datos: nd.datos }, estado(nd, m)));
    }
    if (a === 'seed') {
      const d = await ensureDraft(req, by), m = await meta();
      const nd = { rev: d.rev + 1, datos: sanitizeDoc(await L.loadSeed(req)), ts: Date.now(), by }; await L.setJSON('setp:draft', nd);
      return L.send(res, 200, Object.assign({ datos: nd.datos }, estado(nd, m)));
    }
    if (a === 'export') {
      const d = await ensureDraft(req, by);
      return L.send(res, 200, JSON.stringify(d.datos, null, 1), { 'Content-Disposition': 'attachment; filename="tablero-setp-respaldo.json"' });
    }
    return L.send(res, 404, { error: 'no_existe' });
  } catch (e) {
    const st = e && e.status ? e.status : 500;
    return L.send(res, st, { error: st === 400 ? 'datos_invalidos' : 'error', mensaje: st === 400 || st === 413 ? e.message : 'Ocurrió un error. Inténtalo de nuevo.' });
  }
};

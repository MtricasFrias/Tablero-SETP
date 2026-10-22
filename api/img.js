/* Imágenes subidas desde el panel (se guardan ya comprimidas). GET /api/img?id=<id> */
'use strict';
const L = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    const id = String(L.query(req).id || '');
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(id) || !L.hasStorage()) return L.send(res, 404, { error: 'no_existe' });
    const v = await L.getJSON('setp:img:' + id);
    if (!v || !/^image\/(jpeg|png|webp)$/.test(v.m)) return L.send(res, 404, { error: 'no_existe' });
    return L.send(res, 200, Buffer.from(v.b, 'base64'), { 'Content-Type': v.m, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; img-src 'self'" });
  } catch (e) { return L.send(res, 502, { error: 'error' }); }
};

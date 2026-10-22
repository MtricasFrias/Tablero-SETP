/* Datos que ve el público: la última versión PUBLICADA. Si aún no se ha publicado nada (o no hay almacenamiento), responde 404 y el sitio usa data/seed.json. */
'use strict';
const L = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return L.send(res, 405, { error: 'metodo' });
    if (!L.hasStorage()) return L.send(res, 404, { error: 'sin_datos' });
    const d = await L.getJSON('setp:pub');
    if (!d) return L.send(res, 404, { error: 'sin_datos' });
    return L.send(res, 200, d, { 'Cache-Control': 'public, max-age=0, s-maxage=20, stale-while-revalidate=120' });
  } catch (e) { return L.send(res, 502, { error: 'error' }); }
};

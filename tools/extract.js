/* Herramienta de migración (se ejecuta una sola vez): separa el index.html monolítico en archivos.
   node tools/extract.js   → assets/css/app.css, tools/partials/scene.html, img/alcaldia.png, tools/partials/data-arrays.json */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const L = html.split('\n');
const idx = (re, from = 0) => { for (let i = from; i < L.length; i++) if (re.test(L[i])) return i; return -1; };
const mk = p => fs.mkdirSync(path.dirname(p), { recursive: true });

/* 1) CSS */
const s0 = idx(/^<style>/), s1 = idx(/^<\/style>/, s0);
const css = L.slice(s0 + 1, s1).join('\n');
let out = path.join(root, 'assets/css/app.css'); mk(out); fs.writeFileSync(out, css);
console.log('css', css.length, 'bytes');

/* 2) Escena de entrada (página de inicio + velo de transición) */
const h0 = idx(/<div id="page-inicio" class="page active">/);
const h1 = idx(/<div class="warp" id="homeWarp"/, h0);
const scene = L.slice(h0, h1 + 1).join('\n');
out = path.join(root, 'tools/partials/scene.html'); mk(out); fs.writeFileSync(out, scene);
console.log('escena', scene.length, 'bytes');

/* 3) Escudo de la Alcaldía (data URI → archivo) */
const m = html.match(/class="logo alc" src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
if (m) { out = path.join(root, 'img/alcaldia.png'); mk(out); fs.writeFileSync(out, Buffer.from(m[1], 'base64')); console.log('alcaldia.png', Buffer.from(m[1], 'base64').length, 'bytes'); }

/* 4) Arreglos de datos geográficos incrustados en el script */
const grab = (re, name) => { const mm = html.match(re); if (!mm) throw new Error('no encontré ' + name); return Function('"use strict";return (' + mm[1] + ')')(); };
const data = {
  paraderos: grab(/const puntosParaderos = (\[\[[\s\S]*?\]\]);/, 'puntosParaderos'),
  semFaseI: grab(/const semFaseI = (\[[\s\S]*?\]);\s*const semFaseII/, 'semFaseI'),
  semFaseII: grab(/const semFaseII = (\[[\s\S]*?\]);\s*\/\*|const semFaseII = (\[[\s\S]*?\]);/, 'semFaseII'),
  frentesKML: grab(/const frentesKML = (\[[\s\S]*?\]);\s*function dividirEnSecciones/, 'frentesKML'),
  frentesCra5: grab(/const frentesCra5 = (\[[\s\S]*?\]);\s*\n/, 'frentesCra5')
};
out = path.join(root, 'tools/partials/data-arrays.json'); mk(out); fs.writeFileSync(out, JSON.stringify(data));
console.log('arreglos:', Object.entries(data).map(([k, v]) => k + '=' + v.length).join(', '));

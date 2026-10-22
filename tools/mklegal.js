/* USO ÚNICO (ya se aplicó): las páginas legales ahora se editan directamente en cada .html. Reconstruye terminos.html, privacidad.html y cookies.html con la marca SETP a partir del texto de cada documento (h1, versión, resumen y secciones h2).
   El contenido legal se edita en los propios .html; este script solo vuelve a envolverlo.   node tools/mklegal.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const DOCS = [['terminos.html', 'Términos y condiciones'], ['privacidad.html', 'Política de privacidad'], ['cookies.html', 'Política de cookies']];

function extraer(html) {
  const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html);
  if (!main) throw new Error('sin <main>');
  let m = main[1];
  const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(m)[1], meta = (/<p class="meta">([\s\S]*?)<\/p>/.exec(m) || [, ''])[1];
  const resumen = (/<div class="resumen">([\s\S]*?)<\/div>/.exec(m) || [, ''])[1];
  m = m.replace(/<h1>[\s\S]*?<\/h1>/, '').replace(/<p class="meta">[\s\S]*?<\/p>/, '').replace(/<div class="resumen">[\s\S]*?<\/div>/, '').replace(/<nav class="toc"[\s\S]*?<\/nav>/, '');
  const toc = []; m.replace(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g, (_, id, t) => { toc.push([id, t.replace(/<[^>]+>/g, '')]); return ''; });
  return { h1, meta, resumen, toc, cuerpo: m.trim() };
}

const pagina = (d, actual, titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} — Tablero de seguimiento SETP Ibagué</title>
<meta name="description" content="${titulo} del Tablero de seguimiento de proyectos del SETP Ibagué.">
<meta name="theme-color" content="#0A1F5C">
<link rel="icon" type="image/png" href="img/setp-logo-color.png">
<link rel="stylesheet" href="assets/css/marca.css">
<link rel="stylesheet" href="assets/css/legal.css">
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="topbar"><div class="topbar-in">
  <img class="logo" src="img/setp-logo-color.png" alt="TransMusical SETP">
  <div class="brand"><div class="kicker">Sistema Estratégico de Transporte Público · Ibagué</div><b>Información legal</b><span class="sub">Tablero de seguimiento de proyectos</span></div>
  <img class="logo alc" src="img/alcaldia.png" alt="Alcaldía de Ibagué">
</div></header>
<nav class="tabs" aria-label="Documentos legales"><div class="tabs-in">
${DOCS.map(([f, t]) => `  <a class="tab" href="${f}"${f === actual ? ' aria-current="page"' : ''}>${t}</a>`).join('\n')}
  <span class="sp"></span>
  <a class="tab" href="./">Volver al tablero</a>
</div></nav>
<div class="doc-hero"><img src="img/escena-setp.svg" alt="" aria-hidden="true"><div class="doc-hero-in"><h1>${d.h1}</h1><p>${d.meta}</p></div></div>
<div class="doc">
  <aside class="doc-toc"><nav aria-label="En este documento"><details open><summary>En este documento</summary><ol>
${d.toc.map(([id, t]) => `    <li><a href="#${id}">${t}</a></li>`).join('\n')}
  </ol></details></nav></aside>
  <main id="contenido" class="doc-main" tabindex="-1">
${d.resumen ? `    <div class="resumen">${d.resumen}</div>\n` : ''}${d.cuerpo.split('\n').map(l => '    ' + l).join('\n')}
  </main>
</div>
<footer class="doc-pie">
  <div class="doc-pie-in">
    <div class="logos"><img src="img/setp-logo-color.png" alt="TransMusical SETP"><img src="img/alcaldia.png" alt="Alcaldía de Ibagué"></div>
    <p><b>SETP Ibagué S.A.S.</b><br>Calle 60 #8-37, C.C. Acqua, Oficinas 1201 y 1208 · Ibagué, Tolima<br><a href="https://transmusical.gov.co" rel="noopener noreferrer">transmusical.gov.co</a></p>
    <nav aria-label="Más información">${DOCS.filter(([f]) => f !== actual).map(([f, t]) => `<a href="${f}">${t}</a>`).join('')}<button type="button" data-open-cookies>Preferencias de cookies</button></nav>
  </div>
</footer>
<script src="assets/js/consent.js"></script>
<script src="assets/js/legal.js"></script>
</body>
</html>
`;

DOCS.forEach(([f, t]) => { const d = extraer(fs.readFileSync(path.join(root, f), 'utf8')); fs.writeFileSync(path.join(root, f), pagina(d, f, t)); console.log(f, 'secciones:', d.toc.length); });

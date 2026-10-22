/* Ensambla el index.html público (sitio de solo lectura) con la escena de entrada existente. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const scene = fs.readFileSync(path.join(root, 'tools/partials/scene.html'), 'utf8');
const oldHtml = cp.execSync('git show main:index.html', { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\n');
const rl = oldHtml.find(l => l.startsWith('<div class="rotate-lock"')) || '';

/* La escena trae el velo de transición al final (div.warp); lo separamos para colocarlo fuera de <main> */
const wi = scene.indexOf('<div class="warp"');
const sceneHtml = scene.slice(0, wi).trim(), warpHtml = scene.slice(wi).trim();

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tablero de seguimiento de proyectos — SETP Ibagué</title>
<meta name="description" content="Seguimiento público a los proyectos del Sistema Estratégico de Transporte Público de Ibagué (SETP): vías, semaforización y paraderos.">
<meta name="theme-color" content="#0A1F5C">
<meta property="og:title" content="Tablero de seguimiento de proyectos — SETP Ibagué">
<meta property="og:description" content="Estado, avance, ubicación y recursos de los proyectos del SETP Ibagué.">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<link rel="icon" type="image/png" href="img/setp-logo-color.png">
<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">
<link rel="stylesheet" href="assets/css/app.css">
<link rel="stylesheet" href="assets/css/extra.css">
</head>
<body class="on-home" data-cat="">
<a class="skip" href="#main">Saltar al contenido</a>
<div id="live" class="sr-only" aria-live="polite" role="status"></div>
<div id="previewBar" class="preview-bar" hidden>Vista previa del borrador: así se verá cuando publiques los cambios. <a href="admin/">Volver al panel</a></div>

<header class="topbar">
  <div class="wrap topbar-inner">
    <img class="logo setp logo-day nocut" src="img/setp-logo-color.png" alt="TransMusical SETP"><img class="logo setp logo-night nocut" src="img/setp-logo-blanco.png" alt="" aria-hidden="true">
    <div class="brand">
      <div class="kicker">Sistema Estratégico de Transporte Público · Ibagué</div>
      <h1>Tablero de Seguimiento de Proyectos</h1>
      <div class="sub">Gestión, avance y control de la infraestructura del SETP</div>
    </div>
    <img class="logo alc" src="img/alcaldia.png" alt="Alcaldía de Ibagué">
  </div>
</header>
<nav class="tabs" aria-label="Proyectos"><div class="tabs-inner" id="tabsInner"></div></nav>

<main id="main" tabindex="-1">
${sceneHtml}
<div id="projects"></div>
<noscript><p class="wrap" style="padding:40px 20px">Este tablero necesita JavaScript para mostrar los proyectos. Actívalo en tu navegador o visita <a href="https://transmusical.gov.co">transmusical.gov.co</a>.</p></noscript>
</main>
${warpHtml}

<footer>
  <div class="wrap foot-inner">
    <div class="logos">
      <img class="logo-day nocut" src="img/setp-logo-color.png" alt="TransMusical SETP"><img class="logo-night nocut" src="img/setp-logo-blanco.png" alt="" aria-hidden="true">
      <img src="img/alcaldia.png" alt="Alcaldía de Ibagué">
    </div>
    <div class="foot-note"><b>Tablero de seguimiento · SETP Ibagué S.A.S.</b><span>Sistema Estratégico de Transporte Público</span></div>
    <nav class="foot-go" aria-label="Ir a un tipo de proyecto"><span>Ir a</span>
      <button type="button" data-go="vias" style="--spc:#1D4ED8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3h7L20 21H4z"/><path d="M12 6.5v3M12 12v3M12 17.5v2"/></svg>Vías</button>
      <button type="button" data-go="semaforos" style="--spc:#00913A"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="20" rx="3"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>Semáforos</button>
      <button type="button" data-go="paraderos" style="--spc:#D98F00"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.7 7-12a7 7 0 1 0-14 0c0 5.3 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>Paraderos</button>
    </nav>
    <nav class="foot-legal" aria-label="Información legal">
      <a href="terminos.html">Términos y condiciones</a>
      <a href="privacidad.html">Política de privacidad</a>
      <a href="cookies.html">Política de cookies</a>
      <button type="button" data-open-cookies>Preferencias de cookies</button>
      <a href="https://transmusical.gov.co" target="_blank" rel="noopener noreferrer">transmusical.gov.co</a>
    </nav>
  </div>
</footer>

${rl}
<script src="assets/vendor/leaflet/leaflet.js"></script>
<script src="assets/js/render.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/home.js"></script>
<script src="assets/js/consent.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', html.length, 'bytes');

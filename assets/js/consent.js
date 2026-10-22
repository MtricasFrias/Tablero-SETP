/* Consentimiento: aviso de cookies/almacenamiento y casillas separadas de Términos y Política de privacidad. */
(function () {
  'use strict';
  var KEY = 'setp-consent', VERSION = 1;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var base = (document.currentScript && document.currentScript.getAttribute('data-base')) || '';

  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.v === VERSION ? v : null; } catch (e) { return null; } }
  function write(o) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: VERSION, ts: new Date().toISOString(), necesarias: true }, o))); } catch (e) {} }

  /* Categorías opcionales: hoy el sitio NO usa ninguna (ni analítica ni publicidad). Si algún día se agregan,
     deben cargarse solo después de que SETPConsent.allowed('analitica') sea verdadero. */
  var C = window.SETPConsent = {
    get: read,
    allowed: function (cat) { var c = read(); return cat === 'necesarias' ? true : !!(c && c[cat]); },
    open: openPrefs
  };

  function banner() {
    var d = document.createElement('div');
    d.className = 'ck'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Aviso de cookies y almacenamiento');
    d.innerHTML = '<h2>Tu privacidad</h2>' +
      '<p>Este sitio guarda en tu navegador únicamente lo necesario para funcionar y recordar tu preferencia de modo día/noche. ' +
      '<b>No usamos cookies de publicidad ni de seguimiento.</b> Las imágenes del mapa las entrega un tercero (Esri), que puede ver tu dirección IP. ' +
      'Más información en la <a href="' + base + 'cookies.html">Política de cookies</a> y la <a href="' + base + 'privacidad.html">Política de privacidad</a>.</p>' +
      '<div class="ck-acts"><button type="button" class="pri" data-a="ok">Entendido</button><button type="button" data-a="prefs">Ver preferencias</button></div>';
    d.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'ok') { write({ analitica: false, publicidad: false }); d.remove(); }
      if (a === 'prefs') { d.remove(); openPrefs(); }
    });
    document.body.appendChild(d);
  }

  function openPrefs() {
    var c = read() || {}, old = $('.ck'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'ck'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Preferencias de cookies');
    d.innerHTML = '<h2>Preferencias de cookies y almacenamiento</h2>' +
      '<div class="ck-opts">' +
      '<div class="ck-opt"><input type="checkbox" checked disabled aria-label="Necesarias, siempre activas"><div><b>Necesarias (siempre activas)</b><small>Guardan tu preferencia de modo día/noche y tu decisión sobre este aviso en el almacenamiento local del navegador. No contienen datos que te identifiquen y no se envían a ningún servidor.</small></div></div>' +
      '<div class="ck-opt"><input type="checkbox" id="ck-an" ' + (c.analitica ? 'checked' : '') + ' disabled aria-label="Analítica, no se usa"><div><b>Analítica (hoy no se usa)</b><small>El sitio no mide visitas. Si el SETP la activa en el futuro, se pedirá tu autorización antes de cargarla.</small></div></div>' +
      '<div class="ck-opt"><input type="checkbox" id="ck-pu" disabled aria-label="Publicidad, no se usa"><div><b>Publicidad (no se usa)</b><small>Este sitio no muestra publicidad ni rastrea tu navegación.</small></div></div></div>' +
      '<div class="ck-acts"><button type="button" class="pri" data-a="save">Guardar y cerrar</button><a href="' + base + 'cookies.html" class="btn" style="text-decoration:none">Leer la política</a></div>';
    d.addEventListener('click', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-a') === 'save') { write({ analitica: false, publicidad: false }); d.remove(); } });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.remove(); });
    document.body.appendChild(d); var b = $('button', d); if (b) b.focus();
  }

  /* Casillas de consentimiento: DOS casillas independientes y desmarcadas (términos / privacidad), cada una con su enlace.
     Uso: var ck = SETPConsent.checkboxes(contenedor); ... if (!ck.valid()) return; */
  C.checkboxes = function (host, opts) {
    opts = opts || {}; var id = opts.id || 'f' + Math.random().toString(36).slice(2, 7);
    var b = opts.base !== undefined ? opts.base : base;
    host.innerHTML = '<div class="consent" role="group" aria-label="Autorizaciones">' +
      '<label><input type="checkbox" id="' + id + '-t" required> <span>He leído y acepto los <a href="' + b + 'terminos.html" target="_blank" rel="noopener">Términos y Condiciones</a>.</span></label>' +
      '<label><input type="checkbox" id="' + id + '-p" required> <span>He leído la <a href="' + b + 'privacidad.html" target="_blank" rel="noopener">Política de Privacidad</a> y autorizo el tratamiento de mis datos personales para las finalidades allí descritas.</span></label></div>' +
      '<p class="consent-err" id="' + id + '-e" role="alert" hidden style="color:#B42318;font-size:13px;font-weight:700"></p>';
    var t = host.querySelector('#' + id + '-t'), p = host.querySelector('#' + id + '-p'), er = host.querySelector('#' + id + '-e');
    return {
      valid: function () {
        var falta = [];
        if (!t.checked) falta.push('los Términos y Condiciones'); if (!p.checked) falta.push('la Política de Privacidad');
        er.hidden = !falta.length; er.textContent = falta.length ? 'Para continuar debes aceptar ' + falta.join(' y ') + ' (son dos autorizaciones separadas).' : '';
        return !falta.length;
      },
      value: function () { return { terminos: t.checked, privacidad: p.checked, fecha: new Date().toISOString() }; }
    };
  };

  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-open-cookies]'); if (b) { e.preventDefault(); openPrefs(); } });
  function init() { if (!read() && !$('[data-no-consent-banner]')) banner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

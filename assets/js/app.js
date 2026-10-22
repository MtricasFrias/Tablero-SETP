/* Sitio público del tablero: carga los datos publicados, arma pestañas, rutas (#/p/<proyecto>) y páginas de proyecto. */
(function () {
  'use strict';
  var R = window.SETPRender, esc = R.esc;
  var S = window.SETP = window.SETP || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var CAT = {
    vias: { nombre: 'Vías', color: '#1D4ED8', icon: '<path d="M8.5 3h7L20 21H4z"/><path d="M12 6.5v3M12 12v3M12 17.5v2"/>' },
    semaforos: { nombre: 'Semáforos', color: '#00913A', icon: '<rect x="8" y="2" width="8" height="20" rx="3"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/>' },
    paraderos: { nombre: 'Paraderos', color: '#D98F00', icon: '<path d="M12 21s7-6.7 7-12a7 7 0 1 0-14 0c0 5.3 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>' }
  };
  var svg = function (p) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var preview = new URLSearchParams(location.search).get('vista') === 'borrador';
  var pages = {}, state = { data: null };

  /* ---------- datos ---------- */
  function getJSON(url, opts) { return fetch(url, opts || { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function load() {
    var primero = preview ? getJSON('api/admin?a=draft', { credentials: 'same-origin', cache: 'no-store' }).then(function (j) { S.isPreview = true; return j.datos || j; }) : getJSON('api/data');
    return primero.catch(function () { S.isPreview = false; return null; }).then(function (d) {
      if (d && d.proyectos) return d;
      return getJSON('data/seed.json', { cache: 'no-cache' });
    });
  }
  var visibles = function () { return (state.data.proyectos || []).filter(function (p) { return S.isPreview || p.visible !== false; }); };
  S.find = function (id) { return visibles().filter(function (p) { return p.id === id; })[0] || null; };
  S.projects = function (cat) {
    if (!state.data) return [];
    return visibles().filter(function (p) { return p.categoria === cat; }).map(function (p) {
      return { id: p.id, nombre: p.nombre, fase: p.fase || '', estado: p.estado || '', bloqueado: !!p.proximo };
    });
  };

  /* ---------- navegación ---------- */
  function buildTabs() {
    var h = '<button class="tab tab-home" data-home="1" title="Volver a la calle del SETP">' + svg('<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5"/>') + 'Inicio</button>';
    Object.keys(CAT).forEach(function (c) {
      h += '<button class="tab crumb" data-cat="' + c + '" data-go="' + c + '" style="--spc:' + CAT[c].color + '" title="Ver todos los proyectos de ' + CAT[c].nombre + '"><span class="cchip">' + svg(CAT[c].icon) + CAT[c].nombre + '</span></button>';
    });
    visibles().forEach(function (p) {
      var et = esc(p.pestana || (p.nombre + (p.fase ? ' · ' + p.fase : '')));
      if (p.proximo) h += '<button class="tab locked" data-cat="' + esc(p.categoria) + '" aria-disabled="true" title="' + esc(p.nombre + ' ' + (p.fase || '')) + ' · por incluir en el tablero"><svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> ' + et + '</button>';
      else h += '<button class="tab" data-cat="' + esc(p.categoria) + '" data-id="' + esc(p.id) + '">' + svg((CAT[p.categoria] || CAT.vias).icon) + et + (p.estado ? ' <span class="badge">' + esc(p.estado) + '</span>' : '') + '</button>';
    });
    h += '<span class="tabs-sp"></span><div class="cat-switch" role="group" aria-label="Cambiar de tipo de proyecto">';
    Object.keys(CAT).forEach(function (c) { h += '<button type="button" data-go="' + c + '" title="Cambiar a ' + CAT[c].nombre + '" aria-label="Cambiar a ' + CAT[c].nombre + '" style="--spc:' + CAT[c].color + '">' + svg(CAT[c].icon) + '</button>'; });
    h += '</div>';
    $('#tabsInner').innerHTML = h;
  }
  function setActive(id) {
    $$('.tab[data-id], .tab[data-home]').forEach(function (t) { t.classList.toggle('active', id ? t.getAttribute('data-id') === id : t.hasAttribute('data-home')); });
  }
  function announce(t) { var l = $('#live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = t; }, 40); } }

  function mount(p) {
    if (!pages[p.id]) {
      var tmp = document.createElement('div'); tmp.innerHTML = R.page(p);
      var el = tmp.firstElementChild; $('#projects').appendChild(el); pages[p.id] = el;
    }
    return pages[p.id];
  }
  S.open = function (id, silent) {
    var p = S.find(id); if (!p || p.proximo) return S.home();
    var el = mount(p);
    $$('.page.active').forEach(function (x) { x.classList.remove('active'); });
    el.classList.add('active');
    document.body.classList.remove('on-home'); document.body.dataset.cat = p.categoria;
    setActive(id);
    document.title = p.nombre + (p.fase ? ' · ' + p.fase : '') + ' — Tablero de seguimiento SETP Ibagué';
    if (!silent && location.hash !== '#/p/' + id) history.pushState(null, '', '#/p/' + id + (preview ? '' : ''));
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    R.hydrate(el, p);
    var h2 = $('h2', el); if (h2) { h2.setAttribute('tabindex', '-1'); }
    announce('Proyecto abierto: ' + p.nombre + (p.fase ? ', ' + p.fase : ''));
    document.dispatchEvent(new CustomEvent('setp:open', { detail: { id: id } }));
  };
  S.home = function (silent) {
    $$('.page.active').forEach(function (x) { x.classList.remove('active'); });
    $('#page-inicio').classList.add('active');
    document.body.classList.add('on-home'); delete document.body.dataset.cat;
    setActive(null);
    document.title = 'Tablero de seguimiento de proyectos — SETP Ibagué';
    if (!silent && location.hash) history.pushState(null, '', location.pathname + location.search);
    document.dispatchEvent(new CustomEvent('setp:home'));
  };
  function route() {
    var m = /^#\/p\/([\w-]+)$/.exec(location.hash);
    if (m && S.find(m[1])) S.open(m[1], true); else S.home(true);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tab');
    if (!t) return;
    if (t.hasAttribute('data-home')) { S.home(); return; }
    if (t.getAttribute('data-id')) S.open(t.getAttribute('data-id'));
  });
  window.addEventListener('popstate', route);

  /* ---------- arranque ---------- */
  function start() {
    load().then(function (d) {
      state.data = d; S.data = d;
      buildTabs();
      document.dispatchEvent(new Event('setp:data'));
      if (S.isPreview) { var b = $('#previewBar'); if (b) b.hidden = false; }
      route();
    }).catch(function () {
      var m = $('#main'); if (m) m.insertAdjacentHTML('afterbegin', '<p class="wrap" style="padding:40px 20px">No se pudo cargar la información del tablero. Recarga la página en unos segundos.</p>');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

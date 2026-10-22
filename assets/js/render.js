/* Motor de páginas de proyecto: convierte los datos (JSON) en HTML con el diseño del tablero.
   Lo usan el sitio público y la vista previa del panel de administración.
   Seguridad: TODO texto que viene de los datos pasa por esc() (nunca se inserta HTML crudo). */
(function (root) {
  'use strict';

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var num = function (v, d) { if (v === '' || v === null || v === undefined) return d === undefined ? null : d; var n = Number(v); return isFinite(n) ? n : (d === undefined ? null : d); };
  var fmtM = function (n) { return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' M'; };
  var fmtFecha = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? (+m[3]) + '-' + MESES[+m[2] - 1] + '-' + m[1] : esc(iso || ''); };
  var safeUrl = function (u) { return /^(https?:\/\/|mailto:)/i.test(u || '') ? u : '#'; };
  var paras = function (t) { return String(t || '').split(/\n{2,}|\r\n\r\n/).map(function (s) { return s.trim(); }).filter(Boolean); };
  var has = function (v) { return v !== '' && v !== null && v !== undefined; };

  /* Colores de acento (nombres sencillos para el panel de administración) */
  var ACENTO = { azul: 'var(--royal)', marino: 'var(--navy)', ambar: 'var(--gold)', verde: 'var(--green)', gris: 'var(--pending)', pino: '#166534' };
  var ACENTOS = ['marino', 'azul', 'ambar', 'verde', 'pino', 'gris'];
  var HEX = { marino: '#0A1F5C', azul: '#1D4ED8', ambar: '#F0A800', verde: '#00A830', pino: '#166534', gris: '#94A3B8' };
  var ESTADO_LINEA = { ejecutado: '#00A830', 'en curso': '#1D4ED8', pendiente: '#94A3B8' };

  /* Iconos de los encabezados de sección (trazos simples, mismo estilo que el resto del tablero) */
  var ICON = {
    kpis: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    progreso: '<path d="M4 6h16M4 12h10M4 18h13"/>',
    datos: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>',
    mapa: '<path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
    torta: '<path d="M12 3v9h9"/><path d="M20.5 15A9 9 0 1 1 9 3.5"/>',
    cronograma: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    cifras: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.2 5 2.4 5 5.8"/>',
    texto: '<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>',
    tarjetas: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="8" height="6" rx="1.5"/><rect x="13" y="14" width="8" height="6" rx="1.5"/>',
    destacado: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    galeria: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    documentos: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'
  };
  var icon = function (t) { return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[t] || ICON.texto) + '</svg>'; };

  /* ---------- imágenes (con crédito visible: derechos de autor) ---------- */
  function imgUrl(im) {
    if (!im) return '';
    if (im.id && /^[A-Za-z0-9_-]{6,40}$/.test(im.id)) return 'api/img?id=' + encodeURIComponent(im.id);
    if (im.src && /^(img|assets)\/[\w./-]+$/.test(im.src)) return im.src;
    return '';
  }
  function credito(im) {
    if (!im) return '';
    var t = [];
    if (im.credito) t.push(esc(im.credito));
    if (im.licencia) t.push(im.enlace ? '<a href="' + esc(safeUrl(im.enlace)) + '" target="_blank" rel="noopener noreferrer">' + esc(im.licencia) + '</a>' : esc(im.licencia));
    return t.length ? '<span class="img-credit">Foto: ' + t.join(' · ') + '</span>' : '';
  }
  function figure(im, cls) {
    var u = imgUrl(im); if (!u) return '';
    return '<figure class="fig ' + (cls || '') + '"><img src="' + esc(u) + '" alt="' + esc(im.alt || '') + '" loading="lazy" decoding="async">' +
      ((im.pie || im.credito || im.licencia) ? '<figcaption>' + (im.pie ? esc(im.pie) + ' ' : '') + credito(im) + '</figcaption>' : '') + '</figure>';
  }

  /* ---------- portada del proyecto ---------- */
  function gauge(i, idx) {
    var v = num(i.valor); if (v === null) return '';
    v = Math.max(0, Math.min(100, v));
    var col = v > 0 ? 'var(--green)' : 'var(--pending)';
    return '<div class="g-item"><div class="gauge-wrap gauge-sm" aria-label="' + esc(i.nombre) + ': ' + v + '%">' +
      '<div class="ring" data-p="' + v + '" style="--p:0;--c:' + col + '"></div>' +
      '<div class="gauge-center"><div class="pct" style="font-size:18px;color:' + (v > 0 ? 'var(--green)' : 'var(--pending)') + '">' + String(v).replace('.', ',') + '%</div></div></div>' +
      '<div class="g-name">' + esc(i.nombre) + '</div>' + (i.texto ? '<div class="g-cap">' + esc(i.texto) + '</div>' : '') + '</div>';
  }
  function hero(p) {
    var h = p.portada || {};
    var chips = (h.chips || []).filter(function (c) { return c && c.texto; }).map(function (c) {
      var cls = { oscuro: 'code', azul: 'obra', verde: 't-verde', ambar: 't-ambar', gris: 't-gris' }[c.tono] || 'code';
      return '<span class="chip ' + cls + '">' + esc(c.texto) + '</span>';
    }).join('');
    var meta = (h.datos || []).filter(function (d) { return d && d.etiqueta && has(d.valor); }).map(function (d) {
      return '<div class="m"><div class="lbl">' + esc(d.etiqueta) + '</div><div class="val">' + esc(d.valor) + '</div></div>';
    }).join('');
    var v = h.valores || {}, et = v.etiquetas || {}, ob = num(v.obra), it = num(v.interventoria), eq = '';
    if (ob !== null || it !== null) {
      var parts = [];
      if (ob !== null) parts.push('<div class="m"><div class="lbl">' + esc(et.obra || 'Contrato de obra') + '</div><div class="val">' + fmtM(ob) + '</div></div>');
      if (it !== null) parts.push('<div class="m"><div class="lbl">' + esc(et.interventoria || 'Contrato de interventoría') + '</div><div class="val">' + fmtM(it) + '</div></div>');
      if (ob !== null && it !== null) {
        parts = [parts[0], '<div class="op">+</div>', parts[1], '<div class="op">=</div>',
          '<div class="m"><div class="lbl">' + esc(et.total || 'Valor del proyecto') + '</div><div class="val" style="color:var(--navy)">' + fmtM(Math.round((ob + it) * 10) / 10) + '</div></div>'];
      }
      eq = '<div class="hero-meta hero-eq">' + parts.join('') + '</div>' + (v.nota ? '<p class="map-note" style="max-width:640px">' + esc(v.nota) + '</p>' : '');
    }
    var ind = (h.indicadores || []).map(gauge).join('');
    var side = ind ? '<div class="gauge-card"><div class="g-row">' + ind + '</div>' +
      '<div class="gauge-legend"><span><i style="background:var(--green)"></i> Ejecutado</span><span><i style="background:var(--pending)"></i> Pendiente</span></div></div>' : '';
    var desc = paras(h.descripcion).map(function (t) { return '<p class="desc">' + esc(t) + '</p>'; }).join('');
    return '<section class="hero"><div class="wrap hero-grid"' + (side ? '' : ' style="grid-template-columns:1fr"') + '><div class="hero-left">' +
      (chips ? '<div class="eyebrow">' + chips + '</div>' : '') +
      '<h2>' + esc(h.titulo || (p.nombre + (p.fase ? ' — ' + p.fase : ''))) + '</h2>' + desc +
      (meta ? '<div class="hero-meta">' + meta + '</div>' : '') + eq + '</div>' + side + '</div></section>';
  }

  /* ---------- bloques ---------- */
  var big = function (t) { var l = String(t).length; return l > 11 ? ' style="font-size:19px"' : l > 7 ? ' style="font-size:24px"' : ''; };
  function head(b, t) {
    return '<div class="block-head"><div class="block-num">' + icon(t) + '</div><div><h3>' + esc(b.titulo || '') + '</h3>' +
      (b.subtitulo ? '<div class="tag">' + esc(b.subtitulo) + '</div>' : '') + '</div><div class="spacer"></div></div>';
  }
  var note = function (t) { return t ? '<p class="map-note">' + esc(t) + '</p>' : ''; };

  var R = {};
  R.kpis = function (b) {
    var t = (b.tarjetas || []).filter(function (c) { return c && c.titulo; });
    if (!t.length) return '';
    var cols = t.length <= 3 ? 'g3' : t.length === 4 ? 'g4' : t.length === 5 ? 'g5' : (t.length % 4 === 0 ? 'g4' : 'g3');
    return '<div class="cards ' + cols + '">' + t.map(function (c) {
      var v = (c.valor === undefined || c.valor === null) ? '' : String(c.valor);
      return '<div class="card kpi"><div class="accent" style="background:' + (ACENTO[c.color] || ACENTO.marino) + '"></div><h4>' + esc(c.titulo) + '</h4>' +
        (v ? '<div class="big"' + big(v) + '>' + esc(v) + (c.unidad ? '<span class="unit"> ' + esc(c.unidad) + '</span>' : '') + '</div>' : '') +
        (c.nota ? '<div class="foot">' + esc(c.nota) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + note(b.nota);
  };
  R.progreso = function (b) {
    var f = (b.filas || []).filter(function (r) { return r && r.nombre; });
    if (!f.length) return '';
    return '<div class="card">' + f.map(function (r) {
      var p = num(r.porcentaje), pp = p === null ? null : Math.max(0, Math.min(100, p));
      return '<div class="progress-row"><div class="top"><span class="name">' + esc(r.nombre) + '</span><span class="figs">' +
        (pp !== null ? '<b>' + String(pp).replace('.', ',') + '%</b> ' : '') + esc(r.texto || '') + '</span></div>' +
        (pp !== null ? '<div class="bar blue"><span data-w="' + pp + '" style="width:0"></span></div>' : '') + '</div>';
    }).join('') + note(b.nota) + '</div>';
  };
  R.datos = function (b) {
    var t = (b.tarjetas || []).filter(function (c) { return c && ((c.filas || []).length || c.titulo); });
    if (!t.length) return '';
    var cols = t.length === 1 ? '' : t.length === 3 ? ' g3' : ' g2';
    return '<div class="cards' + cols + '">' + t.map(function (c) {
      return '<div class="card">' + (c.titulo ? '<h4>' + esc(c.titulo) + '</h4>' : '') +
        (c.filas || []).filter(function (r) { return r && r.etiqueta && has(r.valor); }).map(function (r) {
          return '<div class="progress-row"><div class="top"><span class="name">' + esc(r.etiqueta) + '</span><span class="figs">' + esc(r.valor) + '</span></div></div>';
        }).join('') + note(c.nota) + '</div>';
    }).join('') + '</div>' + note(b.nota);
  };
  R.torta = function (b) {
    var parts = (b.partes || []).map(function (x) { return { e: x.etiqueta, v: num(x.valor, 0) }; }).filter(function (x) { return x.e && x.v > 0; });
    if (!parts.length) return '';
    var tot = parts.reduce(function (a, x) { return a + x.v; }, 0), acc = 0, stops = [];
    var pal = ['#1D4ED8', '#0A1F5C', '#F0A800', '#00A830', '#94A3B8', '#166534', '#D98F00', '#5B8DEF'];
    parts.forEach(function (x, i) { var a = acc / tot * 100; acc += x.v; stops.push(pal[i % pal.length] + ' ' + a.toFixed(2) + '% ' + (acc / tot * 100).toFixed(2) + '%'); });
    return '<div class="card"><div class="donut-row"><div class="donut" role="img" aria-label="Distribución" style="background:conic-gradient(' + stops.join(',') + ')"></div><ul class="donut-leg">' +
      parts.map(function (x, i) { return '<li><i style="background:' + pal[i % pal.length] + '"></i><span>' + esc(x.e) + '</span><b>' + (x.v / tot * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + '%</b></li>'; }).join('') +
      '</ul></div>' + note(b.nota) + '</div>';
  };
  R.cronograma = function (b) {
    var rows = (b.fases || []).map(function (f) { return { n: f.nombre, d: f.detalle, a: Date.parse(f.inicio), z: Date.parse(f.fin), s: f.estado, i: f.inicio, f: f.fin }; })
      .filter(function (f) { return f.n && isFinite(f.a) && isFinite(f.z) && f.z >= f.a; });
    if (!rows.length) return '';
    var min = Math.min.apply(null, rows.map(function (r) { return r.a; })), max = Math.max.apply(null, rows.map(function (r) { return r.z; })), span = Math.max(max - min, 864e5);
    var labs = [], d = new Date(min); d.setUTCDate(1);
    for (var k = 0; k < 40 && d.getTime() <= max; k++) { labs.push(MESES[d.getUTCMonth()].charAt(0).toUpperCase() + MESES[d.getUTCMonth()].slice(1)); d.setUTCMonth(d.getUTCMonth() + 1); }
    var cls = { hecho: 'gf-hecho', 'en curso': 'gf-curso', pendiente: 'gf-pend' };
    return '<div class="card"><div class="gantt-months"><div></div><div class="gantt-scale">' + labs.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div></div><div class="gantt">' +
      rows.map(function (r) {
        var l = (r.a - min) / span * 100, w = Math.max((r.z - r.a) / span * 100, 6);
        return '<div class="gantt-row"><div class="lab">' + esc(r.n) + (r.d ? '<small>' + esc(r.d) + '</small>' : '') + '</div><div class="gantt-track"><div class="gantt-fill ' + (cls[r.s] || 'gf-pend') + '" style="left:' + l.toFixed(2) + '%;width:' + Math.min(w, 100 - l).toFixed(2) + '%">' +
          fmtFecha(r.i) + ' → ' + fmtFecha(r.f) + (r.s === 'hecho' ? ' ✓' : '') + '</div></div></div>';
      }).join('') + '</div>' + note(b.nota) + '</div>';
  };
  R.cifras = function (b) {
    var t = (b.tarjetas || []).filter(function (c) { return c && has(c.valor); });
    if (!t.length) return '';
    return '<div class="social-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">' + t.map(function (c) {
      var u = imgUrl(c.imagen);
      return '<div class="social-tile">' + (u ? '<div class="ico photo"><img src="' + esc(u) + '" alt="' + esc((c.imagen && c.imagen.alt) || '') + '" loading="lazy"></div>' :
        '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="#00A830" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>') +
        '<div class="n">' + esc(c.valor) + '</div><div class="l">' + esc(c.etiqueta || '') + '</div>' +
        (c.imagen && (c.imagen.credito || c.imagen.licencia) ? '<div class="l">' + (c.imagen.pie ? esc(c.imagen.pie) + ' · ' : '') + credito(c.imagen) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + note(b.nota);
  };
  R.texto = function (b) {
    var ps = paras(b.texto), fg = figure(b.imagen, 'fig-wide');
    if (!ps.length && !fg) return '';
    return '<div class="card">' + fg + (ps.length ? '<div class="txt-cols">' + ps.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' : '') + note(b.nota) + '</div>';
  };
  R.tarjetas = function (b) {
    var it = (b.items || []).filter(function (c) { return c && c.titulo; });
    if (!it.length) return '';
    return '<div class="np-grid">' + it.map(function (c, i) {
      return '<div class="np-item' + (c.destacado ? ' star' : '') + '" style="--i:' + i + '">' + (c.etiqueta ? '<span class="np-n">' + esc(c.etiqueta) + '</span>' : '') +
        '<h4 class="np-t">' + esc(c.titulo) + '</h4>' + (c.texto ? '<div class="np-why">' + esc(c.texto) + '</div>' : '') +
        ((c.dato || c.dato_nota) ? '<div class="np-q"><b>' + esc(c.dato || '') + '</b><small>' + esc(c.dato_nota || '') + '</small></div>' : '') + '</div>';
    }).join('') + '</div>' + note(b.nota);
  };
  R.destacado = function (b) {
    var st = (b.cifras || []).filter(function (c) { return c && c.valor; });
    return '<div class="recycle-xl"><div class="rx-top"><div class="rx-ico"><svg viewBox="0 0 46 46" aria-hidden="true"><g class="spin" fill="none" stroke="#8CF0A8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 9 a14 14 0 0 1 12.1 7"/><path d="M35.1 16 l0.4 -5.6 M35.1 16 l-5.4 -1.4"/><path d="M37 26 a14 14 0 0 1 -12 10"/><path d="M25 36 l-4.2 3.8 M25 36 l-1.6 -5.4"/><path d="M13 32 a14 14 0 0 1 -1.2 -14"/><path d="M11.8 18 l-3.6 -4.2 M11.8 18 l5.6 -0.4"/></g></svg></div><div>' +
      (b.etiqueta ? '<div class="rx-kick">' + esc(b.etiqueta) + '</div>' : '') + '<h4 class="rx-title">' + esc(b.destacado_titulo || b.titulo || '') + '</h4></div></div>' +
      (b.texto ? '<p class="rx-text">' + esc(b.texto) + '</p>' : '') +
      (st.length ? '<div class="rx-stats">' + st.map(function (c) { return '<div class="rx-stat"><b>' + esc(c.valor) + '</b><span>' + esc(c.texto || '') + '</span></div>'; }).join('') + '</div>' : '') +
      ((b.etiquetas || []).length ? '<div class="rx-tags">' + b.etiquetas.filter(Boolean).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      (b.fuente ? '<small class="rx-src">' + esc(b.fuente) + '</small>' : '') + '</div>';
  };
  R.galeria = function (b) {
    var g = (b.imagenes || []).filter(function (i) { return imgUrl(i); });
    if (!g.length) return '';
    return '<div class="gal">' + g.map(function (i) { return figure(i, 'fig-gal'); }).join('') + '</div>' + note(b.nota);
  };
  R.documentos = function (b) {
    var d = (b.items || []).filter(function (x) { return x && x.nombre && /^https?:\/\//i.test(x.url || ''); });
    if (!d.length) return '';
    return '<div class="card"><ul class="docs">' + d.map(function (x) {
      return '<li><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener noreferrer"><span class="doc-n">' + esc(x.nombre) + '</span>' + (x.detalle ? '<small>' + esc(x.detalle) + '</small>' : '') + '</a></li>';
    }).join('') + '</ul></div>';
  };
  R.mapa = function (b) {
    var capas = (b.capas || []).filter(function (c) { return c && (c.elementos || []).length; });
    if (!capas.length) return '';
    var leg = capas.map(function (c, i) {
      var sw = c.tipo === 'lineas' ? Object.keys(ESTADO_LINEA).map(function (k) { return '<i title="' + k + '" style="background:' + ESTADO_LINEA[k] + '"></i>'; }).join('') : '<i style="background:' + (HEX[c.color] || HEX.azul) + '"></i>';
      return '<label class="lay"><input type="checkbox" data-capa="' + i + '" checked> ' + sw + ' ' + esc(c.nombre || 'Capa') + ' <span class="cnt">(' + c.elementos.length.toLocaleString('es-CO') + ')</span></label>';
    }).join('');
    return '<div class="card"><div class="map-legend">' + leg + '</div><div class="map-el" role="region" aria-label="' + esc(b.titulo || 'Mapa') + '"></div>' +
      note(b.nota || 'Mapa interactivo: se puede desplazar y acercar. Toca un elemento para ver su nombre y detalle.') + '</div>';
  };

  function section(b, last) {
    var f = R[b.tipo]; if (!f) return '';
    var body = f(b); if (!body) return '';
    var showHead = b.tipo !== 'destacado' && (b.titulo || b.subtitulo);
    return '<section class="block" id="b-' + esc(b.id || '') + '" data-tipo="' + esc(b.tipo) + '"' + (last ? ' style="border-bottom:none"' : '') + '><div class="wrap">' +
      (showHead ? head(b, b.tipo) : '') + body + '</div></section>';
  }

  /* Página completa de un proyecto */
  function page(p) {
    var blocks = (p.bloques || []).map(function (b) { return { b: b, h: section(b, false) }; }).filter(function (x) { return x.h; });
    if (blocks.length) blocks[blocks.length - 1].h = section(blocks[blocks.length - 1].b, true);
    return '<div class="page proyecto" id="p-' + esc(p.id) + '" data-id="' + esc(p.id) + '">' + hero(p) + blocks.map(function (x) { return x.h; }).join('') + '</div>';
  }

  /* ---------- mapas (Leaflet) ---------- */
  var TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  function buildMap(el, b) {
    var L = root.L; if (!L || el._built) return; el._built = true;
    var map = L.map(el, { scrollWheelZoom: false, preferCanvas: true });
    L.tileLayer(TILES, { attribution: 'Imágenes © Esri', maxZoom: 19 }).addTo(map);
    var groups = [], all = [];
    (b.capas || []).filter(function (c) { return c && (c.elementos || []).length; }).forEach(function (c) {
      var g = L.layerGroup(), col = HEX[c.color] || HEX.azul;
      c.elementos.forEach(function (e) {
        var pop = '<b>' + esc(e.nombre || '') + '</b>' + (e.detalle ? '<br>' + esc(e.detalle) : '') + (c.tipo === 'lineas' && e.estado ? '<br>' + esc(e.estado.charAt(0).toUpperCase() + e.estado.slice(1)) : '');
        if (c.tipo === 'lineas') {
          var cs = (e.coords || []).filter(function (q) { return isFinite(q[0]) && isFinite(q[1]); }); if (cs.length < 2) return;
          L.polyline(cs, { color: ESTADO_LINEA[e.estado] || ESTADO_LINEA.pendiente, weight: 5, opacity: .95 }).bindPopup(pop).addTo(g); cs.forEach(function (q) { all.push(q); });
        } else {
          var la = num(e.lat), lo = num(e.lon); if (la === null || lo === null) return;
          L.circleMarker([la, lo], { radius: c.elementos.length > 300 ? 4 : 7, color: '#fff', weight: c.elementos.length > 300 ? 1 : 2, fillColor: col, fillOpacity: .95 }).bindPopup(pop).addTo(g); all.push([la, lo]);
        }
      });
      g.addTo(map); groups.push(g);
    });
    var capas = (b.capas || []).filter(function (c) { return c && (c.elementos || []).length; });
    var card = el.closest('.card');
    if (card) Array.prototype.forEach.call(card.querySelectorAll('input[data-capa]'), function (chk) {
      chk.addEventListener('change', function () { var g = groups[+chk.getAttribute('data-capa')]; if (g) { chk.checked ? g.addTo(map) : map.removeLayer(g); } });
    });
    if (all.length) map.fitBounds(all, { padding: [24, 24], maxZoom: 17 }); else map.setView([4.4389, -75.2322], 12);
    el._map = map; el._all = all;
  }

  /* Activa lo que necesita el navegador una vez que la página está en pantalla */
  function hydrate(pageEl, p) {
    Array.prototype.forEach.call(pageEl.querySelectorAll('.map-el'), function (el) {
      var sec = el.closest('section'); var id = sec && sec.id.replace(/^b-/, '');
      var b = (p.bloques || []).filter(function (x) { return (x.id || '') === id && x.tipo === 'mapa'; })[0];
      if (b) { if (el._built) { setTimeout(function () { el._map && el._map.invalidateSize(); if (el._all && el._all.length) el._map.fitBounds(el._all, { padding: [24, 24], maxZoom: 17 }); }, 30); } else buildMap(el, b); }
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      Array.prototype.forEach.call(pageEl.querySelectorAll('.ring[data-p]'), function (r) { r.style.setProperty('--p', r.getAttribute('data-p')); });
      Array.prototype.forEach.call(pageEl.querySelectorAll('.bar span[data-w]'), function (s) { s.style.width = s.getAttribute('data-w') + '%'; });
    }); });
  }

  root.SETPRender = { esc: esc, num: num, fmtM: fmtM, fmtFecha: fmtFecha, safeUrl: safeUrl, imgUrl: imgUrl, page: page, hero: hero, hydrate: hydrate, buildMap: buildMap, ACENTOS: ACENTOS, HEX: HEX, ESTADO_LINEA: ESTADO_LINEA, icon: icon, MESES: MESES };
})(window);

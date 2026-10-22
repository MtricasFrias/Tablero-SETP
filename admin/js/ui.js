/* Utilidades de interfaz del panel: crear elementos, avisos, ventanas y confirmaciones (sin dependencias). */
(function () {
  'use strict';
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === undefined || v === null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'on') Object.keys(v).forEach(function (e) { el.addEventListener(e, v[e]); });
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c === null || c === undefined || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }); else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }
  var toastBox;
  function toast(msg, tipo) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var t = h('div', { class: 'toast ' + (tipo || 'ok'), text: msg }); toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, tipo === 'err' ? 7000 : 3800);
  }
  var stack = [], uid = 0;
  function modal(o) {
    var back = h('div', { class: 'modal-back' }), tid = 'mt' + (++uid), previo = document.activeElement, box = h('div', { class: 'modal ' + (o.ancho || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': tid });
    var head = h('div', { class: 'modal-head' }, h('h2', { id: tid, text: o.titulo }), o.sinCerrar ? null : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', on: { click: close } }, window.Ico ? Ico.el('cerrar') : '✕'));
    var acts = h('div', { class: 'modal-acts' });
    (o.acciones || []).forEach(function (a) { acts.appendChild(h('button', { class: 'btn ' + (a.clase || ''), type: 'button', text: a.texto, on: { click: function () { var r = a.onClick ? a.onClick(close) : null; if (a.cerrar !== false && r !== false) close(); } } })); });
    box.appendChild(head); box.appendChild(h('div', { class: 'modal-body' }, o.cuerpo)); if ((o.acciones || []).length) box.appendChild(acts);
    back.appendChild(box); document.body.appendChild(back); document.body.classList.add('modal-open'); stack.push(back);
    function close() { back.remove(); stack = stack.filter(function (x) { return x !== back; }); if (!stack.length) document.body.classList.remove('modal-open'); if (previo && previo.focus && document.contains(previo)) { try { previo.focus(); } catch (e) {} } if (o.onClose) o.onClose(); }
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !o.sinCerrar) { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return; /* el foco no sale de la ventana */
      var f = [].slice.call(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return; var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !box.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !box.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    });
    back.addEventListener('mousedown', function (e) { if (e.target === back && !o.sinCerrar) close(); });
    var f = box.querySelector('input,textarea,select,button.pri,button'); if (f) setTimeout(function () { f.focus(); }, 30);
    return { close: close, box: box };
  }
  function confirmar(texto, o) {
    o = o || {};
    return new Promise(function (res) {
      modal({ titulo: o.titulo || '¿Seguro?', cuerpo: h('p', { class: 'conf-text', text: texto }), onClose: function () { res(false); },
        acciones: [{ texto: o.no || 'Cancelar', onClick: function () { res(false); } }, { texto: o.si || 'Sí, continuar', clase: o.peligro ? 'danger' : 'pri', onClick: function () { res(true); return true; } }] });
    }).then(function (v) { return v; });
  }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var slug = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
  window.UI = { h: h, toast: toast, modal: modal, confirmar: confirmar, esc: esc, slug: slug, debounce: debounce };
})();

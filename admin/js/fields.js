/* Formularios del panel: construye cada campo según SCHEMAS (texto, número, fecha, color, listas, fotos, mapa…). */
(function () {
  'use strict';
  var h = UI.h, R = SETPRender, uid = 0;
  var COLORES = [['marino', 'Azul oscuro'], ['azul', 'Azul'], ['ambar', 'Ámbar'], ['verde', 'Verde'], ['pino', 'Verde oscuro'], ['gris', 'Gris']];
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var vacioV = function (v) { return v === null || v === undefined || v === ''; };

  function ayuda(fd) { return fd.ayuda ? h('small', { class: 'ayuda', text: fd.ayuda }) : null; }
  function etiqueta(fd) { return h('span', { class: 'lbl' }, fd.label, fd.req ? h('b', { class: 'req', title: 'Obligatorio', text: ' *' }) : null); }

  /* ----- fotos: se reducen en el navegador (≤1600 px, sin datos de ubicación) y se suben al servidor ----- */
  function comprimir(file) {
    return new Promise(function (ok, fail) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail(new Error('Solo se aceptan fotos JPG, PNG o WEBP.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('No se pudo abrir la foto. ¿Está dañada?')); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var lado = 1600, q = 0.82, intento = 0;
        (function probar() {
          var k = Math.min(1, lado / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) {
            if (!b) return fail(new Error('No se pudo reducir la foto.'));
            if (b.size > 780 * 1024 && intento < 5) { intento++; if (q > 0.62) q -= 0.1; else lado = Math.round(lado * 0.8); return probar(); }
            if (b.size > 780 * 1024) return fail(new Error('La foto es demasiado pesada incluso reducida.'));
            ok(b);
          }, 'image/jpeg', q);
        })();
      };
      img.src = url;
    });
  }
  async function subirFoto(file) {
    var blob = await comprimir(file), buf = new Uint8Array(await blob.arrayBuffer()), bin = '';
    for (var i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    var r = await window.AdminAPI('admin?a=img', { method: 'POST', body: { mime: 'image/jpeg', base64: btoa(bin) } });
    return r.id;
  }
  var urlAdmin = function (im) { var u = R.imgUrl(im); return u ? '../' + u : ''; };
  var LICENCIAS = ['Foto propia del SETP', 'Autorizada por su autor', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC0 / dominio público'];

  function imagenWidget(fd, im, set, change, whole) {
    var box = h('div', { class: 'imgw' });
    function draw() {
      box.innerHTML = ''; var tiene = im && (im.id || im.src);
      var prev = h('div', { class: 'imgw-prev' }, tiene ? h('img', { src: urlAdmin(im), alt: im.alt || 'Vista previa de la foto' }) : h('span', { class: 'muted', text: 'Sin foto' }));
      var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', 'aria-label': 'Elegir foto' });
      var btn = h('button', { type: 'button', class: 'btn small pri', on: { click: function () { file.click(); } } }, Ico.el('camara'), tiene ? 'Cambiar foto' : 'Subir foto');
      file.addEventListener('change', async function () {
        var f = this.files[0]; if (!f) return; btn.disabled = true; btn.textContent = 'Subiendo…';
        try { var id = await subirFoto(f); im = im || {}; im.id = id; delete im.src; if (whole) { /* el objeto es la foto misma */ } else set(im); im.confirmado = false; change(); UI.toast('Foto subida. Completa el autor y confirma el permiso de uso.', 'ok'); }
        catch (e) { UI.toast(e.message || 'No se pudo subir la foto.', 'err'); }
        draw();
      });
      var acts = h('div', { class: 'btnrow' }, btn, file, tiene && !whole ? h('button', { type: 'button', class: 'btn small danger', on: { click: function () { im = null; set(null); change(); draw(); } } }, Ico.el('papelera'), 'Quitar foto') : null);
      box.appendChild(h('div', { class: 'imgw-top' }, prev, h('div', {}, acts, h('small', { class: 'ayuda', text: 'JPG, PNG o WEBP. Se reduce sola y se le borran los datos de ubicación de la cámara.' }))));
      if (!tiene) return;
      var t = function (k, label, o) { o = o || {}; return h('label', { class: 'campo' }, h('span', { class: 'lbl' }, label, o.req ? h('b', { class: 'req', text: ' *' }) : null), h('input', { type: 'text', value: im[k] || '', maxlength: o.max || 200, placeholder: o.ph || '', list: o.list, on: { input: function () { im[k] = this.value; change(); } } }), o.ayuda ? h('small', { class: 'ayuda', text: o.ayuda }) : null); };
      var dl = h('datalist', { id: 'lic-' + (++uid) }, LICENCIAS.map(function (x) { return h('option', { value: x }); }));
      box.appendChild(t('alt', 'Qué se ve en la foto', { req: true, ayuda: 'Para personas que no pueden verla (lector de pantalla). Ej.: Cuadrilla instalando un paradero en la Carrera 5.' }));
      box.appendChild(t('pie', 'Pie de foto (opcional)', { max: 300 }));
      box.appendChild(t('credito', 'Autor o fuente', { req: true, ph: 'Ej.: Archivo SETP Ibagué', ayuda: 'Quién tomó la foto o de dónde viene. Se muestra debajo de la foto.' }));
      box.appendChild(h('div', {}, t('licencia', 'Licencia o permiso', { req: true, list: dl.id, ayuda: 'Elige una opción o escribe la tuya.' }), dl));
      box.appendChild(t('enlace', 'Enlace a la fuente (opcional)', { max: 600, ph: 'https://…' }));
      box.appendChild(h('label', { class: 'check rights' }, h('input', { type: 'checkbox', checked: !!im.confirmado, on: { change: function () { im.confirmado = this.checked; change(); } } }), h('span', { text: 'Confirmo que el SETP tiene derecho a publicar esta foto: la tomó el SETP, tiene autorización escrita de su autor o tiene licencia libre. (Ley 23 de 1982)' })));
    }
    draw(); return box;
  }

  /* ----- un campo cualquiera ----- */
  function campo(fd, obj, change, ctx) {
    var t = fd.t, k = fd.k, ph = fd.ej ? 'Ej.: ' + fd.ej : '';
    if (t === 'text') return h('label', { class: 'campo' }, etiqueta(fd), h('input', { type: 'text', value: obj[k] == null ? '' : obj[k], maxlength: fd.max || 300, placeholder: ph, on: { input: function () { obj[k] = this.value; change(); } } }), ayuda(fd));
    if (t === 'area') return h('label', { class: 'campo' }, etiqueta(fd), h('textarea', { rows: fd.rows || 3, maxlength: fd.max || 2500, placeholder: ph, text: obj[k] == null ? '' : obj[k], on: { input: function () { obj[k] = this.value; change(); } } }), ayuda(fd));
    if (t === 'num') return h('label', { class: 'campo' }, etiqueta(fd), h('input', { type: 'number', inputmode: 'decimal', value: vacioV(obj[k]) ? '' : obj[k], min: fd.min, max: fd.max, step: fd.step || 'any', placeholder: ph, on: { input: function () { obj[k] = this.value === '' ? null : Number(this.value); change(); } } }), ayuda(fd));
    if (t === 'fecha') return h('label', { class: 'campo' }, etiqueta(fd), h('input', { type: 'date', value: obj[k] || '', on: { input: function () { obj[k] = this.value; change(); } } }), ayuda(fd));
    if (t === 'sel') return h('label', { class: 'campo' }, etiqueta(fd), h('select', { on: { change: function () { obj[k] = this.value; change(); } } }, fd.opts.map(function (o) { return h('option', { value: o[0], text: o[1], selected: (obj[k] || fd.opts[0][0]) === o[0] }); })), ayuda(fd));
    if (t === 'bool') return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[k], on: { change: function () { obj[k] = this.checked; change(); } } }), h('span', { text: fd.label }));
    if (t === 'estado') { var dl = h('datalist', { id: 'est-' + (++uid) }, SCHEMAS.ESTADOS.map(function (x) { return h('option', { value: x }); })); return h('label', { class: 'campo' }, etiqueta(fd), h('input', { type: 'text', list: dl.id, value: obj[k] || '', maxlength: 40, placeholder: 'Ej.: En obra', on: { input: function () { obj[k] = this.value; change(); } } }), dl, ayuda(fd)); }
    if (t === 'color') {
      var g = h('div', { class: 'colores', role: 'radiogroup', 'aria-label': fd.label });
      COLORES.forEach(function (c) { var b = h('button', { type: 'button', class: 'swatch' + ((obj[k] || 'marino') === c[0] ? ' on' : ''), role: 'radio', 'aria-checked': (obj[k] || 'marino') === c[0] ? 'true' : 'false', title: c[1], 'aria-label': c[1], style: { background: R.HEX[c[0]] }, on: { click: function () { obj[k] = c[0]; Array.prototype.forEach.call(g.children, function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('on'); b.setAttribute('aria-checked', 'true'); change(); } } }); g.appendChild(b); });
      return h('div', { class: 'campo' }, etiqueta(fd), g, ayuda(fd));
    }
    if (t === 'cat') {
      var cg = h('div', { class: 'cats', role: 'radiogroup', 'aria-label': fd.label });
      SCHEMAS.CATEGORIAS.forEach(function (c) { var b = h('button', { type: 'button', class: 'cat' + (obj[k] === c.id ? ' on' : ''), role: 'radio', 'aria-checked': obj[k] === c.id ? 'true' : 'false', on: { click: function () { obj[k] = c.id; Array.prototype.forEach.call(cg.children, function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('on'); b.setAttribute('aria-checked', 'true'); change(); } } }, (function () { var cc = h('span', { class: 'cc', style: { background: 'var(--c-' + c.id + ')' } }); cc.appendChild(Ico.el(c.id)); return cc; })(), h('b', { text: c.nombre }), h('small', { text: c.ayuda })); cg.appendChild(b); });
      return h('div', { class: 'campo' }, etiqueta(fd), cg, ayuda(fd));
    }
    if (t === 'textos') {
      var cont = h('div', { class: 'campo' }); (function draw() {
        cont.innerHTML = ''; var arr = obj[k] = obj[k] || []; cont.appendChild(etiqueta(fd));
        arr.forEach(function (v, i) { cont.appendChild(h('div', { class: 'fila' }, h('input', { type: 'text', value: v, maxlength: 80, placeholder: ph, 'aria-label': fd.label + ' ' + (i + 1), on: { input: function () { arr[i] = this.value; change(); } } }), h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Quitar', on: { click: function () { arr.splice(i, 1); change(); draw(); } } }, Ico.el('papelera')))); });
        if (arr.length < (fd.max || 8)) cont.appendChild(h('button', { type: 'button', class: 'btn small', on: { click: function () { arr.push(''); change(); draw(); } } }, Ico.el('mas'), 'Agregar'));
      })(); return cont;
    }
    if (t === 'imagen') {
      if (fd.whole) return imagenWidget(fd, obj, function () {}, change, true);
      return h('div', { class: 'campo' }, etiqueta(fd), imagenWidget(fd, obj[k], function (v) { obj[k] = v; }, change, false));
    }
    if (t === 'valores') return valores(fd, obj, change);
    if (t === 'lista') return lista(fd, obj, change, ctx);
    if (t === 'mapa') { var host = h('div', { class: 'campo' }, etiqueta(fd)); ctx.mapHosts.push({ host: host, block: obj }); return host; }
    return h('div');
  }

  function valores(fd, obj, change) {
    var v = obj[fd.k] = obj[fd.k] || {}; v.etiquetas = v.etiquetas || {};
    var n = function (k, label, ayu) { return h('label', { class: 'campo' }, h('span', { class: 'lbl', text: label }), h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: 0, value: vacioV(v[k]) ? '' : v[k], on: { input: function () { v[k] = this.value === '' ? null : Number(this.value); change(); } } }), h('small', { class: 'ayuda', text: ayu })); };
    var t = function (o, k, label, ph) { return h('label', { class: 'campo' }, h('span', { class: 'lbl', text: label }), h('input', { type: 'text', maxlength: 60, value: v.etiquetas[k] || '', placeholder: ph, on: { input: function () { v.etiquetas[k] = this.value; change(); } } })); };
    return h('fieldset', { class: 'grupo' }, h('legend', { text: 'Valor del proyecto' }),
      h('p', { class: 'ayuda', text: 'Se muestra como «obra + interventoría = total». Escribe los valores en millones de pesos (ej. 35399.9). Si no tienes alguno, déjalo vacío.' }),
      h('div', { class: 'dos' }, n('obra', 'Contrato de obra (millones $)', 'Ej.: 35399.9'), n('interventoria', 'Contrato de interventoría (millones $)', 'Ej.: 3129.2')),
      h('div', { class: 'tres' }, t(0, 'obra', 'Texto para «obra» (opcional)', 'Contrato de obra'), t(0, 'interventoria', 'Texto para «interventoría» (opcional)', 'Contrato de interventoría'), t(0, 'total', 'Texto para el total (opcional)', 'Valor del proyecto')),
      h('label', { class: 'campo' }, h('span', { class: 'lbl', text: 'Nota sobre el valor (opcional)' }), h('textarea', { rows: 2, maxlength: 400, text: v.nota || '', on: { input: function () { v.nota = this.value; change(); } } })));
  }

  /* ----- listas con elementos que se agregan, ordenan y quitan ----- */
  function lista(fd, obj, change, ctx) {
    var arr = obj[fd.k] = obj[fd.k] || [], abiertos = new Set(), box = h('div', { class: 'lista' + (fd.compacta ? ' compacta' : '') }), suma;
    function pintarSuma() { if (!fd.suma || !suma) return; var s = arr.reduce(function (a, x) { return a + (Number(x.valor) || 0); }, 0); s = Math.round(s * 10) / 10; suma.textContent = 'Las partes suman ' + String(s).replace('.', ',') + '%' + (Math.abs(s - 100) > 0.5 ? ' (deberían sumar 100)' : ''); suma.className = 'suma' + (Math.abs(s - 100) > 0.5 ? ' aviso' : ''); }
    function mover(i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; change(); draw(); }
    function agregar(extra) { var it = clone(fd.vacia); if (extra) Object.assign(it, extra); arr.push(it); abiertos.add(it); change(); draw(); var n = box.querySelector('.item:last-of-type input,.item:last-of-type textarea'); if (n && !fd.compacta) n.focus(); }
    function draw() {
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'lista-head' }, h('strong', { text: fd.label }), h('span', { class: 'muted', text: arr.length + (fd.max ? ' de ' + fd.max : '') })));
      if (fd.ayuda) box.appendChild(h('p', { class: 'ayuda', text: fd.ayuda }));
      if (!arr.length) box.appendChild(h('p', { class: 'vacio', text: 'Aún no hay ' + fd.item.toLowerCase() + 's. Usa el botón de abajo para agregar la primera.' }));
      arr.forEach(function (it, i) {
        var res = h('span', { class: 'res', text: fd.resumen ? fd.resumen(it) : fd.item + ' ' + (i + 1) });
        var onItem = function () { res.textContent = fd.resumen ? fd.resumen(it) : fd.item + ' ' + (i + 1); pintarSuma(); change(); };
        var tools = h('span', { class: 'tools' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Subir', title: 'Subir', disabled: i === 0, on: { click: function () { mover(i, -1); } } }, Ico.el('arriba')), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bajar', title: 'Bajar', disabled: i === arr.length - 1, on: { click: function () { mover(i, 1); } } }, Ico.el('abajo')),
          h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Quitar ' + fd.item.toLowerCase(), title: 'Quitar', on: { click: async function () { if (await UI.confirmar('¿Quitar «' + (fd.resumen ? fd.resumen(it) : fd.item) + '»?', { titulo: 'Quitar ' + fd.item.toLowerCase(), si: 'Sí, quitar', peligro: true })) { arr.splice(i, 1); change(); draw(); } } } }, Ico.el('papelera')));
        if (fd.compacta) { box.appendChild(h('div', { class: 'item fila-c' }, form(fd.fields, it, onItem, ctx), tools)); return; }
        var cuerpo = h('div', { class: 'item-body' }); cuerpo.hidden = !abiertos.has(it); var lleno = false;
        var cab = h('button', { type: 'button', class: 'item-head', 'aria-expanded': abiertos.has(it) ? 'true' : 'false', on: { click: function () { var o = cuerpo.hidden; cuerpo.hidden = !o; cab.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) abiertos.add(it); else abiertos.delete(it); if (o && !lleno) llenar(); } } }, h('span', { class: 'chev' }, Ico.el('chevron')), h('span', { class: 'n', text: String(i + 1) }), res);
        function llenar() { lleno = true; cuerpo.appendChild(form(fd.fields, it, onItem, ctx)); }
        if (abiertos.has(it)) llenar();
        box.appendChild(h('div', { class: 'item' }, h('div', { class: 'item-bar' }, cab, tools), cuerpo));
      });
      if (fd.suma) { suma = h('div', { class: 'suma' }); box.appendChild(suma); pintarSuma(); }
      if (fd.imagenes) {
        var multi = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr-only', 'aria-label': 'Elegir fotos', on: { change: async function () {
          var fs = Array.prototype.slice.call(this.files).slice(0, Math.max(0, (fd.max || 30) - arr.length)); this.value = ''; if (!fs.length) return;
          var ok = 0; for (var i = 0; i < fs.length; i++) { try { var id = await subirFoto(fs[i]); var it = clone(fd.vacia); it.id = id; arr.push(it); abiertos.add(it); ok++; } catch (e) { UI.toast(fs[i].name + ': ' + (e.message || 'no se pudo subir.'), 'err'); } }
          if (ok) { change(); draw(); UI.toast(ok + ' foto(s) subida(s). Completa el autor y confirma el permiso de cada una.', 'ok'); }
        } } });
        box.appendChild(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn pri small', disabled: arr.length >= (fd.max || 30), on: { click: function () { multi.click(); } } }, Ico.el('camara'), 'Subir fotos (puedes elegir varias)'), multi));
      } else box.appendChild(h('button', { type: 'button', class: 'btn small add', disabled: fd.max && arr.length >= fd.max, on: { click: function () { agregar(); } } }, Ico.el('mas'), 'Agregar ' + fd.item.toLowerCase()));
    }
    draw(); return box;
  }

  function form(fields, obj, change, ctx) { var f = h('div', { class: 'form' }); fields.forEach(function (fd) { f.appendChild(campo(fd, obj, change, ctx)); }); return f; }

  /* ----- revisión antes de publicar: avisa de lo que el servidor descartaría o de lo que falta ----- */
  function faltantes(fields, obj, ruta, out) {
    fields.forEach(function (fd) {
      if (fd.t === 'lista') (obj[fd.k] || []).forEach(function (it, i) { faltantes(fd.fields, it, ruta + ' › ' + fd.item + ' ' + (i + 1), out); });
      else if (fd.t === 'imagen') { var im = fd.whole ? obj : obj[fd.k]; if (im && im.id && !im.confirmado) out.push({ t: ruta + ': falta confirmar el permiso de uso de una foto', b: true }); if (im && im.id && (!im.credito || !im.licencia || !im.alt)) out.push({ t: ruta + ': a una foto le falta descripción, autor o licencia', b: true }); }
      else if (fd.req && !String(obj[fd.k] == null ? '' : obj[fd.k]).trim()) out.push({ t: ruta + ': falta «' + fd.label + '»' });
      else if (fd.k === 'url' && obj.url && !/^https:\/\//i.test(obj.url)) out.push({ t: ruta + ': el enlace debe empezar por https://' });
    });
  }
  function revisar(p) {
    var out = [];
    SCHEMAS.PROYECTO.forEach(function (fd) { if (fd.req && !String(p[fd.k] || '').trim()) out.push({ t: 'Proyecto: falta «' + fd.label + '»' }); });
    if (!p.proximo) (p.bloques || []).forEach(function (b, i) { var T = SCHEMAS.TIPOS[b.tipo]; if (T) faltantes(T.fields, b, '«' + (b.titulo || T.nombre) + '»', out); });
    return out;
  }

  window.Fields = { form: form, campo: campo, revisar: revisar, clone: clone };
})();

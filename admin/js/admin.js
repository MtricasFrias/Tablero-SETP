/* Panel de administración del Tablero SETP: ingreso, inicio, proyectos, asistente de proyecto nuevo, editor con vista previa, publicación, versiones y ayuda. */
(function () {
  'use strict';
  var h = UI.h, toast = UI.toast, app = document.getElementById('app'), clone = Fields.clone, I = Ico.el;
  var S = { user: null, datos: null, rev: 0, hayCambios: false, dirty: false, saving: false, timer: null, estadoGuardado: 'ok', conf: null, main: null, barra: null, pubMeta: null };
  var CAT = {}; SCHEMAS.CATEGORIAS.forEach(function (c) { CAT[c.id] = c; });
  var CCOL = { vias: 'var(--c-vias)', semaforos: 'var(--c-semaforos)', paraderos: 'var(--c-paraderos)' };
  var fecha = function (ts) { return new Date(ts).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); };
  var nid = function () { return 'b' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5); };
  var btn = function (icon, text, cls, fn, at) { var b = h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), on: { click: fn } }, at || {})); if (icon) b.appendChild(I(icon)); b.appendChild(document.createTextNode(text)); return b; };
  var lnk = function (icon, text, href, cls, ext) { var a = h('a', { class: 'btn ' + (cls || ''), href: href, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }); if (icon) a.appendChild(I(icon)); a.appendChild(document.createTextNode(text)); return a; };
  var catIco = function (id) { var s = h('span', { class: 'cc', style: { background: CCOL[id] } }); s.appendChild(I(id)); return s; };
  var cardH = function (icon, titulo, tag, extra) { return h('div', { class: 'card-h' }, h('span', { class: 'ib' }, I(icon)), h('div', {}, h('h2', { text: titulo }), tag ? h('div', { class: 'tag', text: tag }) : null), h('span', { class: 'sp' }), extra || null); };
  var pagehead = function (titulo, lead, acciones) { setTitle(titulo); return h('div', { class: 'pagehead' }, h('div', {}, h('h1', { text: titulo }), lead ? h('p', { class: 'lead', text: lead }) : null), acciones || null); };

  /* ================== comunicación con el servidor ================== */
  async function API(path, o) {
    o = o || {}; var r;
    try { r = await fetch('../api/' + path, { method: o.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-setp': '1' }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }); }
    catch (e) { var er = new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'); er.red = true; throw er; }
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((j && j.mensaje) || 'Ocurrió un error (' + r.status + ').'); err.status = r.status; err.data = j; if (r.status === 401 && !o.sinSesion) sesionTerminada(); throw err; }
    return j;
  }
  window.AdminAPI = API;
  var falla = function (e) { if (e && e.status === 401) return; toast(e && e.message ? e.message : 'Ocurrió un error.', 'err'); };

  /* ================== guardado automático del borrador ================== */
  function marcar() { S.dirty = true; S.estadoGuardado = 'pend'; pintarBarra(); clearTimeout(S.timer); S.timer = setTimeout(guardar, 1200); }
  async function guardar() {
    clearTimeout(S.timer);
    while (S.saving) await new Promise(function (r) { setTimeout(r, 80); });
    if (!S.dirty) return S.estadoGuardado !== 'error';
    S.saving = true; S.estadoGuardado = 'guardando'; pintarBarra();
    try {
      var snap = JSON.stringify(S.datos), r = await API('admin?a=draft', { method: 'PUT', body: { rev: S.rev, datos: S.datos } });
      S.rev = r.rev; S.hayCambios = r.hayCambios; S.dirty = JSON.stringify(S.datos) !== snap; S.estadoGuardado = S.dirty ? 'pend' : 'ok';
    } catch (e) {
      S.estadoGuardado = 'error';
      if (e.status === 409) { UI.modal({ titulo: 'Alguien más guardó cambios', sinCerrar: true, cuerpo: h('p', { text: e.message }), acciones: [{ texto: 'Recargar el panel', clase: 'pri', onClick: function () { S.dirty = false; location.reload(); return false; } }] }); }
      else if (e.status !== 401) toast(e.message + (e.red ? '' : ' Tus cambios siguen en pantalla; corrige y se intentará guardar de nuevo.'), 'err');
      if (e.status !== 409 && e.status !== 401 && !e.red) S.dirty = true;
    }
    S.saving = false; pintarBarra();
    if (S.dirty && S.estadoGuardado === 'pend') S.timer = setTimeout(guardar, 300);
    return S.estadoGuardado === 'ok' || S.estadoGuardado === 'pend';
  }
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function cargarBorrador() { var r = await API('admin?a=draft'); S.datos = r.datos; S.rev = r.rev; S.hayCambios = r.hayCambios; S.pubMeta = r.publicado; S.dirty = false; S.estadoGuardado = 'ok'; }
  async function comparar() { /* borrador y publicado tal como los guarda el servidor, para comparar manzanas con manzanas */
    await guardar();
    var d = await API('admin?a=compare');
    S.rev = d.rev; S.hayCambios = d.hayCambios; S.pubMeta = d.publicado; pintarBarra(); return { draft: d.draft, pub: d.pub };
  }
  function difDocs(draft, pub) {
    var pm = {}, out = []; ((pub && pub.proyectos) || []).forEach(function (p) { pm[p.id] = p; });
    var diff = function (a, b) { return JSON.stringify(a) !== JSON.stringify(b); };
    draft.proyectos.forEach(function (p) {
      var q = pm[p.id]; delete pm[p.id];
      if (!q) return out.push({ t: 'nuevo', p: p });
      var c = []; if (p.visible !== q.visible) c.push(p.visible ? 'ahora visible' : 'ahora oculto');
      if (['nombre', 'fase', 'estado', 'categoria', 'pestana', 'proximo'].some(function (k) { return p[k] !== q[k]; })) c.push('datos del proyecto');
      if (diff(p.portada, q.portada)) c.push('portada'); if (diff(p.bloques, q.bloques)) c.push('secciones');
      if (c.length) out.push({ t: 'cambio', p: p, c: c });
    });
    Object.keys(pm).forEach(function (id) { out.push({ t: 'quitado', p: pm[id] }); });
    return out;
  }

  /* ================== estructura general ================== */
  function sesionTerminada() { if (S.user === null) return; S.user = null; vistaLogin('Tu sesión terminó por seguridad. Ingresa de nuevo para seguir (tus cambios sin guardar siguen en pantalla).'); }
  var logoSetp = function (cls) { return h('img', { src: '../img/setp-logo-color.png', alt: 'TransMusical SETP', class: 'logo ' + (cls || '') }); };
  var logoAlc = function (cls) { return h('img', { src: '../img/alcaldia.png', alt: 'Alcaldía de Ibagué', class: 'logo alc ' + (cls || '') }); };
  function setTitle(t) { document.title = t + ' — Panel del Tablero SETP'; }

  function shell() {
    app.innerHTML = ''; S.barra = h('div', { class: 'estado-bar', role: 'region', 'aria-label': 'Estado de los cambios', style: { display: 'flex', alignItems: 'center', gap: '8px' } }); S.main = h('main', { id: 'vista', tabindex: '-1' });
    var T = [['#/', 'Inicio', 'inicio'], ['#/proyectos', 'Proyectos', 'proyectos'], ['#/nuevo', 'Agregar proyecto', 'mas'], ['#/historial', 'Versiones', 'versiones'], ['#/ayuda', 'Ayuda', 'ayuda']];
    app.appendChild(h('header', { class: 'topbar' }, h('div', { class: 'topbar-in' }, logoSetp(),
      h('div', { class: 'brand' }, h('div', { class: 'kicker', text: 'Sistema Estratégico de Transporte Público · Ibagué' }), h('b', { text: 'Panel de administración' }), h('span', { class: 'sub', text: 'Tablero de seguimiento de proyectos' })),
      h('div', { class: 'cuenta' }, h('span', { class: 'quien' }, I('usuario'), S.user), btn('llave', 'Cambiar contraseña', 'small', cambiarClave), btn('salir', 'Salir', 'small', salir)), logoAlc())));
    app.appendChild(h('nav', { class: 'tabs', 'aria-label': 'Secciones del panel' }, h('div', { class: 'tabs-in' }, T.map(function (t) { var a = h('a', { class: 'tab', href: t[0], 'data-r': t[0] }); a.appendChild(I(t[2])); a.appendChild(document.createTextNode(t[1])); return a; }), h('span', { class: 'sp' }), S.barra)));
    app.appendChild(S.main);
    app.appendChild(h('footer', { class: 'pie' }, logoSetp(), logoAlc(), h('span', { text: 'SETP Ibagué S.A.S. · Panel de uso interno' }), h('span', { class: 'sp' }), h('a', { href: '../terminos.html', target: '_blank', rel: 'noopener', text: 'Términos y condiciones' }), h('a', { href: '../privacidad.html', target: '_blank', rel: 'noopener', text: 'Política de privacidad' }), h('a', { href: '../cookies.html', target: '_blank', rel: 'noopener', text: 'Cookies' })));
    pintarBarra();
  }
  function pintarBarra() {
    if (!S.barra) return; S.barra.innerHTML = '';
    var g = { ok: [S.hayCambios ? 'Guardado · sin publicar' : 'Todo publicado', S.hayCambios ? 'pend' : ''], pend: ['Guardando…', 'pend'], guardando: ['Guardando…', 'pend'], error: ['No se pudo guardar', 'err'] }[S.estadoGuardado];
    S.barra.appendChild(h('span', { class: 'estado-g ' + g[1], role: 'status' }, h('i'), g[0]));
    S.barra.appendChild(lnk('externo', 'Ver sitio', '../', 'ghost small', true));
    S.barra.appendChild(btn('publicar', 'Publicar cambios', 'oro small', publicar, { disabled: !S.hayCambios && !S.dirty }));
  }

  /* ================== ingreso ================== */
  function vistaLogin(aviso) {
    S.main = null; S.barra = null; setTitle('Ingreso'); app.innerHTML = '';
    var u = h('input', { type: 'text', id: 'lg-usuario', autocomplete: 'username', required: true, autocapitalize: 'off', spellcheck: 'false' }), p = h('input', { type: 'password', id: 'lg-clave', autocomplete: 'current-password', required: true });
    var consHost = h('div'), ck = SETPConsent.checkboxes(consHost, { id: 'lg', base: '../' }), err = h('p', { class: 'err', role: 'alert', hidden: true }), btnI = h('button', { type: 'submit', class: 'btn pri big', text: 'Ingresar' });
    var f = h('form', { class: 'login-card', novalidate: true, on: { submit: async function (e) {
      e.preventDefault(); err.hidden = true; if (!u.value.trim() || !p.value) { err.textContent = 'Escribe el usuario y la contraseña.'; err.hidden = false; return; }
      if (!ck.valid()) return; btnI.disabled = true; btnI.textContent = 'Ingresando…';
      try { await API('auth?a=login', { method: 'POST', sinSesion: true, body: { usuario: u.value.trim(), clave: p.value, acepta: ck.value() } }); S.user = u.value.trim(); p.value = '';
        if (S.datos) { shell(); ruta(); if (S.dirty) guardar(); } else { await arrancar(); } }
      catch (er) { err.textContent = er.message; err.hidden = false; btnI.disabled = false; btnI.textContent = 'Ingresar'; p.value = ''; p.focus(); }
    } } },
      h('h1', { text: 'Ingresa al panel' }), h('p', { text: 'Acceso para el personal autorizado del SETP.' }),
      aviso ? h('p', { class: 'aviso', role: 'status', text: aviso }) : null,
      h('label', { class: 'campo', for: 'lg-usuario' }, h('span', { class: 'lbl', text: 'Usuario' }), u), h('label', { class: 'campo', for: 'lg-clave' }, h('span', { class: 'lbl', text: 'Contraseña' }), p), consHost, err, btnI,
      h('p', { class: 'muted peq', text: 'Esta página no aparece en el sitio público. Usa una cookie de sesión estrictamente necesaria.' }));
    app.appendChild(h('div', { class: 'login' },
      h('div', { class: 'login-art' }, h('div', { class: 'marca' }, logoSetp(), h('h2', { text: 'Moviendo a Ibagué, proyecto a proyecto' }), h('p', { text: 'Aquí se actualiza y se publica la información del Tablero de seguimiento de proyectos del SETP.' })), logoAlc(), h('img', { class: 'escena', src: '../img/escena-setp.svg', alt: '' })),
      h('div', { class: 'login-form' }, f)));
    u.focus();
  }
  function vistaConfig(c) {
    setTitle('Configuración pendiente'); app.innerHTML = '';
    var ok = function (v, t) { return h('li', { class: v ? 'ok' : 'no' }, (v ? 'Listo: ' : 'Falta: ') + t); };
    app.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-art' }, h('div', { class: 'marca' }, logoSetp(), h('h2', { text: 'Falta terminar la instalación' })), logoAlc(), h('img', { class: 'escena', src: '../img/escena-setp.svg', alt: '' })),
      h('div', { class: 'login-form' }, h('div', { class: 'login-card' }, h('h1', { text: 'Dos pasos en Vercel' }),
        h('p', { text: 'Lo hace quien administra el proyecto en Vercel; es un paso único.' }),
        h('ul', { class: 'chk' }, ok(c.almacenamiento, 'almacenamiento conectado (Upstash Redis)'), ok(c.credenciales, 'usuario y contraseña (variables ADMIN_USER y ADMIN_PASSWORD)')),
        h('ol', { class: 'pasos' },
          h('li', {}, h('b', { text: 'Almacenamiento: ' }), 'proyecto → «Storage» → «Create Database» → «Upstash for Redis» (plan Free) → «Connect Project».'),
          h('li', {}, h('b', { text: 'Acceso: ' }), 'proyecto → «Settings» → «Environment Variables» → ', h('code', { text: 'ADMIN_USER' }), ' y ', h('code', { text: 'ADMIN_PASSWORD' }), '.'),
          h('li', {}, h('b', { text: 'Redeploy: ' }), '«Deployments» → los tres puntos del último → «Redeploy».'),
          h('li', {}, h('b', { text: 'Ingresar: ' }), 'entra con ese usuario y cambia la contraseña desde «Cambiar contraseña».')),
        btn('', 'Volver a comprobar', 'pri', arrancar)))));
  }

  async function salir() {
    if (S.dirty && !(await guardar())) { if (!(await UI.confirmar('Hay cambios que no se pudieron guardar. Si sales ahora se perderán.', { titulo: '¿Salir sin guardar?', si: 'Salir de todos modos', peligro: true }))) return; }
    try { await API('auth?a=logout', { method: 'POST', sinSesion: true }); } catch (e) {}
    S.user = null; S.datos = null; S.dirty = false; vistaLogin('Cerraste la sesión. Hasta pronto.');
  }
  function cambiarClave() {
    var a = h('input', { type: 'password', autocomplete: 'current-password' }), n = h('input', { type: 'password', autocomplete: 'new-password' }), r = h('input', { type: 'password', autocomplete: 'new-password' });
    var f = function (l, i, ay) { return h('label', { class: 'campo' }, h('span', { class: 'lbl', text: l }), i, ay ? h('small', { class: 'ayuda', text: ay }) : null); };
    UI.modal({ titulo: 'Cambiar contraseña', cuerpo: h('div', { class: 'form' }, f('Contraseña actual', a), f('Contraseña nueva', n, 'Mínimo 10 caracteres, con mayúscula, minúscula y número.'), f('Repite la contraseña nueva', r), h('p', { class: 'muted', text: 'Al cambiarla se cierran las demás sesiones abiertas. Anótala en un lugar seguro: no se puede recuperar, solo reemplazar desde Vercel.' })),
      acciones: [{ texto: 'Cancelar' }, { texto: 'Cambiar contraseña', clase: 'pri', onClick: function (close) {
        if (n.value !== r.value) { toast('Las dos contraseñas nuevas no coinciden.', 'err'); return false; }
        API('auth?a=password', { method: 'POST', body: { actual: a.value, nueva: n.value } }).then(function () { toast('Contraseña cambiada.', 'ok'); close(); }).catch(falla); return false; } }] });
  }

  /* ================== rutas ================== */
  function ruta() {
    if (!S.main) return; var hash = location.hash || '#/', m = /^#\/p\/([\w-]+)$/.exec(hash);
    S.main.className = ''; S.main.innerHTML = ''; window.scrollTo(0, 0);
    Array.prototype.forEach.call(document.querySelectorAll('.tabs .tab'), function (a) { var r = a.getAttribute('data-r'), on = r === hash || (r === '#/proyectos' && !!m); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (editorActual) { editorActual.destroy(); editorActual = null; }
    if (m) vistaEditor(m[1]); else if (hash === '#/proyectos') vistaProyectos(); else if (hash === '#/nuevo') vistaNuevo(); else if (hash === '#/historial') vistaHistorial(); else if (hash === '#/ayuda') vistaAyuda(); else vistaInicio();
    var t = S.main.querySelector('h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', ruta);
  var editorActual = null;

  /* ================== inicio: lo que hay que hacer hoy ================== */
  function vistaInicio() {
    var ps = S.datos.proyectos, vis = ps.filter(function (p) { return p.visible; }), ocultos = ps.filter(function (p) { return !p.visible; });
    S.main.appendChild(pagehead('Panel de trabajo', 'Hola, ' + S.user + '. Esto es lo que hay pendiente hoy.', btn('mas', 'Agregar un proyecto', 'pri', function () { location.hash = '#/nuevo'; })));
    var lista = h('ul', { class: 'pend' });
    var item = function (cls, icono, titulo, detalle, accion) { return h('li', {}, h('span', { class: 'pi ' + cls }, I(icono)), h('div', { class: 'pt' }, h('b', { text: titulo }), h('span', { text: detalle })), accion || null); };
    var pubLi = item(S.hayCambios ? 'oro' : 'ok', S.hayCambios ? 'publicar' : 'check', S.hayCambios ? 'Hay cambios sin publicar' : 'Todo lo publicado está al día', S.hayCambios ? 'Calculando qué cambió…' : 'El público ve lo mismo que hay en el borrador.', S.hayCambios ? btn('publicar', 'Revisar y publicar', 'oro small', publicar) : null);
    lista.appendChild(pubLi);
    var incompletos = vis.filter(function (p) { return !p.proximo && Fields.revisar(p).length; });
    if (incompletos.length) lista.appendChild(item('rojo', 'alerta', incompletos.length + (incompletos.length === 1 ? ' proyecto visible con datos por completar' : ' proyectos visibles con datos por completar'), incompletos.map(function (p) { return p.nombre; }).join(' · '), btn('lapiz', 'Completar', 'small', function () { location.hash = '#/p/' + incompletos[0].id; })));
    if (ocultos.length) lista.appendChild(item('', 'ojoOff', ocultos.length + (ocultos.length === 1 ? ' proyecto oculto al público' : ' proyectos ocultos al público'), ocultos.map(function (p) { return p.nombre; }).join(' · '), btn('ojo', 'Ver lista', 'small', function () { location.hash = '#/proyectos'; })));
    var cuenta = function (c) { return ps.filter(function (p) { return p.categoria === c; }).length; };
    var meta = S.pubMeta;
    var dl = h('dl', { class: 'resumen' }, h('dt', { text: 'Visibles en el sitio' }), h('dd', { text: vis.length + ' de ' + ps.length }), h('dt', { text: 'Vías' }), h('dd', { text: String(cuenta('vias')) }), h('dt', { text: 'Semáforos' }), h('dd', { text: String(cuenta('semaforos')) }), h('dt', { text: 'Paraderos' }), h('dd', { text: String(cuenta('paraderos')) }),
      h('dt', { text: 'Última publicación' }), h('dd', { text: meta && meta.ts ? fecha(meta.ts) + (meta.by ? ' · ' + meta.by : '') : 'Aún no se ha publicado' }));
    S.main.appendChild(h('div', { class: 'grid2' }, h('section', { class: 'card' }, cardH('publicar', 'Lo que sigue', 'Cambios y tareas'), lista), h('section', { class: 'card' }, cardH('proyectos', 'Resumen', 'Estado del tablero'), dl)));
    S.main.appendChild(h('section', { class: 'card' }, cardH('ayuda', 'Cómo se trabaja aquí', 'Siempre en este orden'),
      h('div', { class: 'pasos-h' }, h('div', {}, h('b', {}, h('i', { text: '1' }), 'Edita'), h('span', { text: 'Todo se guarda solo como borrador. Nadie más lo ve.' })), h('div', {}, h('b', {}, h('i', { text: '2' }), 'Revisa'), h('span', { text: 'La vista previa muestra la página como la verá el público.' })), h('div', {}, h('b', {}, h('i', { text: '3' }), 'Publica'), h('span', { text: 'Con «Publicar cambios» el público ve la nueva versión.' }))),
      h('p', { class: 'muted peq', style: { marginTop: '12px' }, text: 'Excepción: el interruptor «Visible» de cada proyecto actúa al instante, sin esperar a publicar.' }),
      h('div', { class: 'atajos', style: { marginTop: '14px' } }, btn('versiones', 'Versiones y respaldo', 'ghost small', function () { location.hash = '#/historial'; }), btn('ayuda', 'Guía de uso', 'ghost small', function () { location.hash = '#/ayuda'; }), lnk('externo', 'Abrir el sitio público', '../', 'ghost small', true), lnk('externo', 'Ver el sitio con el borrador', '../?vista=borrador', 'ghost small', true))));
    if (S.hayCambios) comparar().then(function (c) {
      var d = difDocs(c.draft, c.pub), n = d.filter(function (x) { return x.t === 'nuevo'; }).length, m = d.filter(function (x) { return x.t === 'cambio'; }).length, q = d.filter(function (x) { return x.t === 'quitado'; }).length, t = [];
      if (n) t.push(n + (n === 1 ? ' proyecto nuevo' : ' proyectos nuevos')); if (m) t.push(m + (m === 1 ? ' modificado' : ' modificados')); if (q) t.push(q + ' por quitar');
      var s = pubLi.querySelector('.pt span'); if (s && document.body.contains(s)) s.textContent = t.length ? t.join(' · ') : 'Hay diferencias menores con lo publicado.';
    }).catch(function () {});
  }

  /* ================== lista de proyectos ================== */
  async function vistaProyectos() {
    S.main.appendChild(pagehead('Proyectos', 'Cada proyecto tiene un interruptor para mostrarlo u ocultarlo en el sitio público.', btn('mas', 'Agregar un proyecto', 'pri', function () { location.hash = '#/nuevo'; })));
    var cont = h('div'); S.main.appendChild(cont); var cambios = {};
    function pintar() {
      cont.innerHTML = '';
      SCHEMAS.CATEGORIAS.forEach(function (c) {
        var ps = S.datos.proyectos.filter(function (p) { return p.categoria === c.id; }); if (!ps.length) return;
        var g = h('section', { class: 'card grupo-p' }, h('header', {}, catIco(c.id), h('h2', { text: c.nombre }), h('span', { text: ps.length + (ps.length === 1 ? ' proyecto' : ' proyectos') })));
        ps.forEach(function (p) { g.appendChild(fila(p)); }); cont.appendChild(g);
      });
    }
    function fila(p) {
      var sw = h('button', { type: 'button', class: 'sw' + (p.visible ? ' on' : ''), role: 'switch', 'aria-checked': p.visible ? 'true' : 'false', 'aria-label': 'Visible en el sitio público: ' + p.nombre, on: { click: function () { alternar(p, sw, etq); } } }, h('span', { class: 'sw-k' }));
      var etq = h('span', { class: 'sw-t', text: p.visible ? 'Visible' : 'Oculto' }), pend = cambios[p.id];
      return h('div', { class: 'proy' + (p.visible ? '' : ' oculto') },
        h('div', { class: 'pn' }, h('b', { text: p.nombre }), h('small', { text: p.fase || '' }),
          h('div', { class: 'chips' }, h('span', { class: 'chip', text: p.estado || 'Sin estado' }), p.proximo ? h('span', { class: 'chip gris', text: 'Próximamente' }) : null, pend ? h('span', { class: 'chip oro', text: pend === 'nuevo' ? 'Nuevo, sin publicar' : 'Cambios sin publicar' }) : null)),
        h('div', { class: 'proy-a' }, h('label', { class: 'swl' }, sw, etq), lnk('lapiz', 'Editar', '#/p/' + p.id, 'pri small'), lnk('externo', 'Ver', '../?vista=borrador#/p/' + p.id, 'ghost small', true)));
    }
    async function alternar(p, sw, etq) {
      var nuevo = !p.visible;
      if (nuevo && !(await UI.confirmar('«' + p.nombre + '» se mostrará al público ahora mismo (si el proyecto tiene cambios sin publicar, se verán al publicar). ¿Estás seguro de que la información es correcta?', { titulo: '¿Mostrar este proyecto?', si: 'Sí, mostrarlo' }))) return;
      sw.disabled = true;
      try { await guardar(); var r = await API('admin?a=visibility', { method: 'POST', body: { id: p.id, visible: nuevo } }); p.visible = r.visible; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); pintar(); toast(nuevo ? '«' + p.nombre + '» ahora es visible para el público.' : '«' + p.nombre + '» quedó oculto: el público ya no lo ve.', 'ok'); }
      catch (e) { sw.disabled = false; falla(e); }
    }
    pintar();
    if (S.hayCambios) { try { var c = await comparar(); difDocs(c.draft, c.pub).forEach(function (d) { cambios[d.p.id] = d.t; }); if (S.main && S.main.contains(cont)) pintar(); } catch (e) {} }
  }

  /* ================== asistente: proyecto nuevo ================== */
  function slugUnico(nombre) { var b = UI.slug(nombre) || 'proyecto', id = b, i = 2; while (S.datos.proyectos.some(function (p) { return p.id === id; }) || id.length < 2) id = b.slice(0, 54) + '-' + (i++); return id; }
  function vistaNuevo() {
    var w = { paso: 1, d: { nombre: '', fase: '', categoria: '', estado: 'Por incluir' }, sel: {} };
    S.main.appendChild(pagehead('Agregar un proyecto nuevo', 'Te hacemos unas preguntas y armamos la página con lo que tengas. Se crea oculto: el público no lo ve hasta que tú lo actives.'));
    var cont = h('div', { class: 'asist' }); S.main.appendChild(cont);
    function pasos() { return h('ol', { class: 'stepper', 'aria-label': 'Pasos' }, ['Datos básicos', '¿Qué información tienes?', 'Revisar y crear'].map(function (t, i) { return h('li', { class: i + 1 === w.paso ? 'on' : (i + 1 < w.paso ? 'hecho' : ''), 'aria-current': i + 1 === w.paso ? 'step' : null }, h('i', { text: String(i + 1) }), t); })); }
    function pintar() {
      cont.innerHTML = ''; cont.appendChild(pasos());
      var card = h('section', { class: 'card' }); cont.appendChild(card);
      if (w.paso === 1) {
        card.appendChild(cardH('proyectos', '¿Qué proyecto es?', 'Nombre, tipo y estado'));
        card.appendChild(Fields.form(SCHEMAS.PROYECTO.filter(function (f) { return f.k !== 'pestana'; }), w.d, function () {}, { mapHosts: [] }));
        card.appendChild(h('div', { class: 'fin' }, h('span'), btn('chevron', 'Siguiente', 'pri', function () {
          if (!w.d.nombre.trim()) return toast('Escribe el nombre del proyecto.', 'err'); if (!w.d.categoria) return toast('Elige el tipo de proyecto: vía, semáforo o paradero.', 'err');
          w.paso = 2; pintar(); window.scrollTo(0, 0); })));
      } else if (w.paso === 2) {
        card.appendChild(cardH('portapapeles', '¿Qué información tienes hoy?', 'La lista de compras'));
        card.appendChild(h('p', { class: 'muted', text: 'Marca lo que ya tienes para empezar. No hace falta que esté todo; después podrás agregar más secciones. Si dudas de un dato, déjalo para después: nada se publica hasta que tú lo decidas.' }));
        var g = h('div', { class: 'compras' });
        SCHEMAS.PRESETS.forEach(function (ps) {
          var on = !!w.sel[ps.id];
          var cb = h('input', { type: 'checkbox', checked: on, 'aria-label': ps.nombre, on: { change: function () { w.sel[ps.id] = this.checked; this.parentNode.classList.toggle('on', this.checked); } } });
          g.appendChild(h('label', { class: 'compra' + (on ? ' on' : '') }, cb, h('span', { class: 'ib' }, I(ps.tipo)), h('div', {}, h('b', { text: ps.nombre }), h('p', { class: 'q', text: ps.pregunta }), h('div', { class: 'nec' }, 'Vas a necesitar:', h('ul', {}, ps.necesitas.map(function (n) { return h('li', { text: n }); }))))));
        });
        card.appendChild(g);
        card.appendChild(h('div', { class: 'fin' }, btn('', 'Atrás', 'ghost', function () { w.paso = 1; pintar(); }), btn('chevron', 'Siguiente', 'pri', function () { w.paso = 3; pintar(); window.scrollTo(0, 0); })));
      } else {
        var elegidas = SCHEMAS.PRESETS.filter(function (ps) { return w.sel[ps.id]; });
        card.appendChild(cardH('check', 'Revisa y crea', 'Último paso'));
        card.appendChild(h('dl', { class: 'resu' }, h('dt', { text: 'Proyecto' }), h('dd', { text: w.d.nombre + (w.d.fase ? ' · ' + w.d.fase : '') }), h('dt', { text: 'Tipo' }), h('dd', { text: CAT[w.d.categoria].nombre }), h('dt', { text: 'Estado' }), h('dd', { text: w.d.estado || 'Por incluir' }),
          h('dt', { text: 'Secciones' }), h('dd', { text: elegidas.length ? elegidas.map(function (x) { return x.nombre; }).join(' · ') : 'Ninguna por ahora (solo la portada). Podrás agregar secciones después.' })));
        card.appendChild(h('p', { class: 'aviso', style: { marginTop: '16px' }, text: 'El proyecto se crea OCULTO. Llena la información, míralo en la vista previa y, cuando esté listo, actívalo con «Visible» y publica.' }));
        card.appendChild(h('div', { class: 'fin' }, btn('', 'Atrás', 'ghost', function () { w.paso = 2; pintar(); }), btn('check', 'Crear proyecto y empezar a llenarlo', 'pri big', async function () {
          var id = slugUnico(w.d.nombre), p = { id: id, visible: false, categoria: w.d.categoria, nombre: w.d.nombre.trim(), fase: (w.d.fase || '').trim(), pestana: '', estado: w.d.estado || 'Por incluir', proximo: false,
            portada: { titulo: w.d.nombre.trim() + (w.d.fase ? ' — ' + w.d.fase.trim() : ''), descripcion: '', chips: [], datos: [], valores: { obra: null, interventoria: null, nota: '', etiquetas: {} }, indicadores: [] },
            bloques: elegidas.map(function (ps) { var b = clone(ps.plantilla); b.id = nid(); b.tipo = ps.tipo; return b; }) };
          S.datos.proyectos.push(p); marcar(); if (!(await guardar())) { S.datos.proyectos.pop(); return; } toast('Proyecto creado. Ahora llena la información.', 'ok'); location.hash = '#/p/' + id; })));
      }
    }
    pintar();
  }

  /* ================== editor de proyecto ================== */
  var abiertoB = new Set(), nuevosB = new Set();
  function elegirSeccion(cb) {
    var m;
    var listo = function (fn) { return function () { m.close(); fn(); }; };
    var tarjetaP = function (ps) { return h('div', { class: 'opc' }, h('span', { class: 'ib' }, I(ps.tipo)), h('div', {}, h('b', { text: ps.nombre }), h('p', { class: 'muted', text: ps.pregunta }), h('small', { class: 'muted', text: 'Vas a necesitar: ' + ps.necesitas.join(' · ') })), btn('mas', 'Agregar', 'pri small', listo(function () { var b = clone(ps.plantilla); b.id = nid(); b.tipo = ps.tipo; cb(b); }))); };
    var tarjetaT = function (k) { var T = SCHEMAS.TIPOS[k]; return h('div', { class: 'opc' }, h('span', { class: 'ib' }, I(k)), h('div', {}, h('b', { text: T.nombre }), h('p', { class: 'muted', text: T.desc }), h('small', { class: 'muted', text: 'Ejemplo: ' + T.ejemplo })), btn('mas', 'En blanco', 'small', listo(function () { cb(bloqueVacio(k)); }))); };
    m = UI.modal({ titulo: 'Agregar una sección', ancho: 'wide', cuerpo: h('div', { class: 'opciones' },
      h('h3', { text: 'Sugeridas: la lista de compras' }), h('p', { class: 'muted', text: 'Ya vienen con los títulos y datos que se han usado en otros proyectos. Solo llena los valores.' }), SCHEMAS.PRESETS.map(tarjetaP),
      h('h3', { text: 'Otros tipos, en blanco' }), Object.keys(SCHEMAS.TIPOS).map(tarjetaT)), acciones: [{ texto: 'Cerrar' }] });
  }
  function bloqueVacio(tipo) {
    var T = SCHEMAS.TIPOS[tipo], b = { id: nid(), tipo: tipo, titulo: tipo === 'destacado' ? '' : T.nombre, subtitulo: '', nota: '' };
    T.fields.forEach(function (f) { if (f.t === 'lista' || f.t === 'textos') b[f.k] = []; else if (f.t === 'imagen') b[f.k] = null; });
    if (tipo === 'mapa') b.capas = [{ nombre: 'Ubicaciones', tipo: 'puntos', color: 'verde', elementos: [] }];
    return b;
  }

  function vistaEditor(id) {
    var p = S.datos.proyectos.find(function (x) { return x.id === id; });
    if (!p) { S.main.appendChild(pagehead('Proyecto no encontrado', 'Puede que se haya eliminado.', lnk('', 'Volver a Proyectos', '#/proyectos', 'pri'))); return; }
    S.main.className = 'ancho'; var mapas = [], frame, listoPrev = false, tPrev;
    function enviarPrev() { if (!frame || !listoPrev) return; try { frame.contentWindow.postMessage({ tipo: 'proyecto', p: p }, location.origin); } catch (e) {} }
    function cambio() { marcar(); clearTimeout(tPrev); tPrev = setTimeout(enviarPrev, 450); }
    var onMsg = function (e) { if (e.origin !== location.origin) return; if (e.data && e.data.tipo === 'listo') { listoPrev = true; enviarPrev(); } };
    window.addEventListener('message', onMsg);
    editorActual = { destroy: function () { window.removeEventListener('message', onMsg); clearTimeout(tPrev); mapas.forEach(function (m) { try { m.destroy(); } catch (e) {} }); } };

    var swBtn = h('button', { type: 'button', class: 'sw' + (p.visible ? ' on' : ''), role: 'switch', 'aria-checked': p.visible ? 'true' : 'false', 'aria-label': 'Visible en el sitio público' }, h('span', { class: 'sw-k' })), swT = h('span', { class: 'sw-t', text: p.visible ? 'Visible en el sitio' : 'Oculto al público' });
    swBtn.addEventListener('click', async function () {
      var nuevo = !p.visible; if (nuevo && !(await UI.confirmar('«' + p.nombre + '» se mostrará al público (los cambios sin publicar se verán al publicar). ¿La información ya es correcta?', { titulo: '¿Mostrar este proyecto?', si: 'Sí, mostrarlo' }))) return;
      swBtn.disabled = true; try { await guardar(); var r = await API('admin?a=visibility', { method: 'POST', body: { id: p.id, visible: nuevo } }); p.visible = r.visible; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); swBtn.classList.toggle('on', p.visible); swBtn.setAttribute('aria-checked', p.visible ? 'true' : 'false'); swT.textContent = p.visible ? 'Visible en el sitio' : 'Oculto al público'; toast(p.visible ? 'Ahora es visible para el público.' : 'Quedó oculto al público.', 'ok'); enviarPrev(); }
      catch (e) { falla(e); } swBtn.disabled = false;
    });
    var prevAside = h('aside', { class: 'prev', 'aria-label': 'Vista previa' });
    frame = h('iframe', { src: 'preview.html', title: 'Vista previa de la página del proyecto', class: 'prev-frame' });
    prevAside.appendChild(h('div', { class: 'prev-h' }, h('b', { text: 'Así se ve en el sitio público' }), h('button', { type: 'button', class: 'icon-btn cerrar-prev', 'aria-label': 'Cerrar vista previa', on: { click: function () { prevAside.classList.remove('abierto'); } } }, I('cerrar'))));
    prevAside.appendChild(frame);
    setTitle(p.nombre);
    var volver = h('a', { class: 'volver', href: '#/proyectos' }, I('chevron'), 'Proyectos');
    S.main.appendChild(h('div', { class: 'ed-bar' }, volver, h('h1', { text: p.nombre || 'Proyecto' }), h('label', { class: 'swl' }, swBtn, swT),
      btn('ojo', 'Ver cómo queda', 'ghost small ver-prev', function () { prevAside.classList.toggle('abierto'); }), lnk('externo', 'Abrir borrador', '../?vista=borrador#/p/' + p.id, 'ghost small', true)));
    var ed = h('div', { class: 'ed' }), col = h('div', { class: 'ed-main' }); ed.appendChild(col); ed.appendChild(prevAside); S.main.appendChild(ed);

    var s1 = h('section', { class: 'card', id: 's-datos' }, cardH('proyectos', 'Datos del proyecto', 'Nombre, tipo y estado: lo que se ve en el menú del sitio'));
    s1.appendChild(Fields.form(SCHEMAS.PROYECTO, p, function () { var t = S.main.querySelector('.ed-bar h1'); if (t) t.textContent = p.nombre || 'Proyecto'; cambio(); }, { mapHosts: [] }));
    s1.appendChild(h('label', { class: 'check', style: { marginTop: '16px' } }, h('input', { type: 'checkbox', checked: !!p.proximo, on: { change: function () { p.proximo = this.checked; cambio(); } } }), h('span', { text: 'Este proyecto aún no tiene información: mostrarlo como «próximamente» (no se puede abrir). Mientras esté marcado, las secciones no se publican.' })));
    col.appendChild(s1);
    var s2 = h('section', { class: 'card', id: 's-portada' }, cardH('texto', 'Portada de la página', 'Título, descripción, datos clave y círculos de avance'));
    s2.appendChild(Fields.form(SCHEMAS.PORTADA, p.portada = p.portada || {}, cambio, { mapHosts: [] })); col.appendChild(s2);
    var s3 = h('section', { class: 'card', id: 's-secciones' }, cardH('kpis', 'Secciones', 'Cada una es un bloque de la página; ábrela para llenarla y reordénalas con las flechas'));
    var lista = h('div', { class: 'bloques' }); s3.appendChild(lista);
    s3.appendChild(h('div', { class: 'btnrow' }, btn('mas', 'Agregar una sección', 'pri', function () { elegirSeccion(function (b) { p.bloques.push(b); abiertoB.add(b.id); nuevosB.add(b.id); cambio(); pintarBloques(); var u = lista.lastElementChild; if (u) u.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); })));
    col.appendChild(s3); p.bloques = p.bloques || [];

    function pintarBloques() {
      mapas.forEach(function (m) { try { m.destroy(); } catch (e) {} }); mapas = []; lista.innerHTML = '';
      if (!p.bloques.length) lista.appendChild(h('p', { class: 'vacio', text: 'Este proyecto no tiene secciones todavía. Pulsa «Agregar una sección» para empezar con la lista de compras.' }));
      p.bloques.forEach(function (b, i) {
        var T = SCHEMAS.TIPOS[b.tipo]; if (!T) return;
        var tit = h('span', { class: 'bt', text: b.titulo || b.destacado_titulo || T.nombre });
        var cuerpo = h('div', { class: 'bloque-body' }), abierto = abiertoB.has(b.id), lleno = false;
        function llenar() {
          lleno = true; var c = { mapHosts: [] };
          cuerpo.appendChild(h('details', { class: 'help-box', open: nuevosB.has(b.id) }, h('summary', { text: '¿Qué es esta sección y qué necesito?' }), h('p', { text: T.desc }), h('b', { text: 'Vas a necesitar:' }), h('ul', {}, T.necesitas.map(function (n) { return h('li', { text: n }); })), h('p', { class: 'muted', text: 'Ejemplo: ' + T.ejemplo })));
          cuerpo.appendChild(Fields.form(T.fields, b, function () { tit.textContent = b.titulo || b.destacado_titulo || T.nombre; cambio(); }, c));
          c.mapHosts.forEach(function (mh) { var host = h('div'); mh.host.appendChild(host); var me = SETPMap.edit(host, mh.block, cambio); mapas.push(me); setTimeout(function () { me.refresh(); }, 80); });
        }
        cuerpo.hidden = !abierto; if (abierto) llenar();
        var cab = h('button', { type: 'button', class: 'item-head', 'aria-expanded': abierto ? 'true' : 'false', on: { click: function () {
          var o = cuerpo.hidden; cuerpo.hidden = !o; cab.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) { abiertoB.add(b.id); if (!lleno) llenar(); else mapas.forEach(function (m) { m.refresh(); }); if (listoPrev && frame.contentWindow) frame.contentWindow.postMessage({ tipo: 'ir', id: b.id }, location.origin); } else abiertoB.delete(b.id); } } },
          h('span', { class: 'chev' }, I('chevron')), h('span', { class: 'ib' }, I(b.tipo)), tit, h('span', { class: 'tipo', text: T.nombre }));
        var mv = function (d) { var j = i + d; if (j < 0 || j >= p.bloques.length) return; var x = p.bloques[i]; p.bloques[i] = p.bloques[j]; p.bloques[j] = x; cambio(); pintarBloques(); };
        var tools = h('span', { class: 'tools' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Subir sección', title: 'Subir', disabled: i === 0, on: { click: function () { mv(-1); } } }, I('arriba')), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bajar sección', title: 'Bajar', disabled: i === p.bloques.length - 1, on: { click: function () { mv(1); } } }, I('abajo')),
          h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Quitar sección', title: 'Quitar sección', on: { click: async function () { if (await UI.confirmar('Se quitará la sección «' + (b.titulo || T.nombre) + '» con todo su contenido.', { titulo: '¿Quitar la sección?', si: 'Sí, quitar', peligro: true })) { p.bloques.splice(i, 1); abiertoB.delete(b.id); cambio(); pintarBloques(); } } } }, I('papelera')));
        lista.appendChild(h('div', { class: 'item bloque', id: 'bl-' + b.id }, h('div', { class: 'item-bar' }, cab, tools), cuerpo));
      });
    }
    pintarBloques();

    col.appendChild(h('section', { class: 'card peligro-z' }, cardH('alerta', 'Zona de cuidado', 'Eliminar es para proyectos creados por error'), h('p', { class: 'muted', text: 'Si solo quieres que el público deje de ver el proyecto, usa el interruptor de arriba («Oculto»).' }),
      btn('papelera', 'Eliminar este proyecto', 'danger', async function () {
        if (!(await UI.confirmar('Se eliminará «' + p.nombre + '» del borrador, con todas sus secciones. El público lo seguirá viendo hasta que publiques. Esta acción no se puede deshacer, salvo restaurando una versión anterior.', { titulo: '¿Eliminar el proyecto?', si: 'Sí, eliminar', peligro: true }))) return;
        S.datos.proyectos = S.datos.proyectos.filter(function (x) { return x.id !== p.id; }); marcar(); await guardar(); location.hash = '#/proyectos'; })));
  }

  /* ================== publicar ================== */
  async function publicar() {
    var c; try { c = await comparar(); } catch (e) { return falla(e); }
    var cambios = difDocs(c.draft, c.pub), avisos = [], bloqueos = [];
    c.draft.proyectos.filter(function (p) { return p.visible && !p.proximo; }).forEach(function (p) { Fields.revisar(p).forEach(function (a) { (a.b ? bloqueos : avisos).push('«' + p.nombre + '» · ' + a.t); }); });
    var lista = cambios.length ? h('ul', { class: 'difs' }, cambios.map(function (d) { return h('li', {}, h('b', { text: d.p.nombre }), d.t === 'nuevo' ? ' — proyecto nuevo' + (d.p.visible ? '' : ' (oculto)') : d.t === 'quitado' ? ' — se quita del sitio' : ' — cambió: ' + d.c.join(', ')); })) : h('p', { class: 'muted', text: 'No encuentro diferencias con lo publicado. Puedes publicar de todos modos.' });
    var nota = h('input', { type: 'text', maxlength: 200, placeholder: 'Ej.: Actualicé el avance de la Carrera 5', 'aria-label': 'Nota sobre este cambio' });
    var cuerpo = h('div', {}, h('p', { text: 'Al publicar, TODO el público verá estos cambios en el sitio.' }), h('h3', { style: { margin: '14px 0 4px' }, text: 'Qué va a cambiar' }), lista,
      bloqueos.length ? h('div', { class: 'warn-box' }, h('b', { text: 'Antes de publicar corrige:' }), h('ul', {}, bloqueos.map(function (x) { return h('li', { text: x }); }))) : null,
      avisos.length ? h('div', { class: 'warn-box suave' }, h('b', { text: 'Revisa (no impide publicar; lo incompleto no se mostrará):' }), h('ul', {}, avisos.slice(0, 12).map(function (x) { return h('li', { text: x }); }), avisos.length > 12 ? h('li', { text: '… y ' + (avisos.length - 12) + ' más' }) : null)) : null,
      h('label', { class: 'campo', style: { marginTop: '14px' } }, h('span', { class: 'lbl', text: '¿Qué cambió? (opcional, queda en el historial)' }), nota));
    UI.modal({ titulo: 'Publicar los cambios', ancho: 'wide', cuerpo: cuerpo, acciones: [{ texto: 'Cancelar' }, { texto: bloqueos.length ? 'Corrige primero' : 'Publicar ahora', clase: 'oro', onClick: function (close) {
      if (bloqueos.length) return false;
      API('admin?a=publish', { method: 'POST', body: { nota: nota.value } }).then(function (r) { S.hayCambios = r.hayCambios; S.pubMeta = r.publicado; pintarBarra(); toast('¡Publicado! El público ya ve la nueva versión (puede tardar un minuto en actualizarse).', 'ok'); close(); if ((location.hash || '#/') === '#/' || location.hash === '#/proyectos') ruta(); }).catch(falla); return false; } }] });
  }

  /* ================== versiones y respaldo ================== */
  async function vistaHistorial() {
    S.main.appendChild(pagehead('Versiones anteriores', 'Cada vez que publicas se guarda una copia. Puedes volver a cualquiera de las últimas 15.'));
    var cont = h('section', { class: 'card grupo-p' }, h('header', {}, h('span', { class: 'cc', style: { background: 'var(--navy)' } }, I('versiones')), h('h2', { text: 'Publicaciones' }))); S.main.appendChild(cont);
    var cargando = h('p', { class: 'muted', style: { padding: '18px 20px' }, text: 'Cargando…' }); cont.appendChild(cargando);
    S.main.appendChild(h('section', { class: 'card' }, cardH('descargar', 'Respaldo y otras opciones', 'Para guardar una copia o deshacer cambios'),
      h('div', { class: 'btnrow' }, lnk('descargar', 'Descargar respaldo (JSON)', '../api/admin?a=export', 'ghost'),
        btn('deshacer', 'Descartar cambios sin publicar', 'ghost', async function () {
          if (!(await UI.confirmar('Se borrarán todos los cambios del borrador que aún no has publicado y se volverá a lo que ve el público ahora.', { titulo: '¿Descartar los cambios sin publicar?', si: 'Sí, descartar', peligro: true }))) return;
          try { var r = await API('admin?a=discard', { method: 'POST', body: {} }); S.datos = r.datos; S.rev = r.rev; S.hayCambios = r.hayCambios; S.dirty = false; S.estadoGuardado = 'ok'; pintarBarra(); toast('Listo: el borrador volvió a lo publicado.', 'ok'); } catch (e) { falla(e); } }),
        btn('alerta', 'Volver al contenido inicial del tablero', 'danger', async function () {
          if (!(await UI.confirmar('Se reemplazará el borrador por los 10 proyectos con los que se entregó el tablero. Lo publicado no cambia hasta que publiques. Si vas a perder trabajo, descarga antes un respaldo.', { titulo: '¿Volver al contenido inicial?', si: 'Sí, reemplazar el borrador', peligro: true }))) return;
          try { var r = await API('admin?a=seed', { method: 'POST', body: {} }); S.datos = r.datos; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); toast('El borrador volvió al contenido inicial.', 'ok'); } catch (e) { falla(e); } }))));
    try {
      var r = await API('admin?a=history'); cargando.remove();
      if (!r.versiones.length) { cont.appendChild(h('p', { class: 'vacio', style: { margin: '16px 20px' }, text: 'Todavía no has publicado ninguna versión. Aparecerán aquí cuando publiques.' })); return; }
      r.versiones.forEach(function (v, i) { cont.appendChild(h('div', { class: 'proy' }, h('div', { class: 'pn' }, h('b', { text: fecha(v.ts) + (i === 0 ? ' · la más reciente' : '') }), h('small', { text: 'Por ' + v.by + ' · ' + v.proyectos + ' proyectos (' + v.visibles + ' visibles)' + (v.nota ? ' · «' + v.nota + '»' : '') })),
        h('div', { class: 'proy-a' }, btn('deshacer', 'Cargar en el borrador', 'small', async function () {
          if (!(await UI.confirmar('El borrador se reemplazará por esta versión. El público no verá nada nuevo hasta que publiques.', { titulo: '¿Cargar esta versión?', si: 'Sí, cargarla' }))) return;
          try { var x = await API('admin?a=restore', { method: 'POST', body: { id: v.id } }); S.datos = x.datos; S.rev = x.rev; S.hayCambios = x.hayCambios; S.dirty = false; pintarBarra(); toast('Versión cargada en el borrador. Revísala y publica si todo está bien.', 'ok'); location.hash = '#/proyectos'; } catch (e) { falla(e); } })))); });
    } catch (e) { cargando.remove(); falla(e); }
  }

  /* ================== ayuda ================== */
  function vistaAyuda() {
    S.main.appendChild(pagehead('Ayuda y guía rápida', 'Si es la primera vez, empieza por «Agregar proyecto» o abre un proyecto existente.'));
    var sec = function (t, c) { return h('details', { class: 'ay', open: true }, h('summary', { text: t }), c); };
    var li = function (a) { return h('ul', {}, a.map(function (x) { return h('li', { text: x }); })); };
    S.main.appendChild(sec('¿Qué hace cada cosa?', li(['Borrador: lo que editas aquí. Se guarda solo y el público no lo ve.', 'Publicar: envía el borrador al sitio público. Hasta ese momento nada cambia para el público.', 'Visible / Oculto: apaga un proyecto completo del sitio público al instante. Útil si encuentras un dato dudoso.', 'Versiones: copias de lo que se publicó; sirven para volver atrás si algo sale mal.'])));
    S.main.appendChild(sec('Cómo agregar puntos al mapa', li(['Abre el proyecto → sección «Mapa» (o agrégala).', '«Agregar un punto» y haz clic en el mapa donde está. Ponle nombre en el recuadro de abajo.', 'Para muchos puntos: «Subir archivos» y elige tu Excel, KMZ, GPX, GeoJSON, Shapefile o CSV; o «Pegar coordenadas».', 'Para recorridos de vía: «Dibujar un tramo», haz clic punto por punto y pulsa «Terminar tramo»; o sube el KMZ del recorrido.'])));
    S.main.appendChild(sec('Archivos que se aceptan para el mapa', li(['KMZ y KML (Google Earth, Google My Maps, QGIS)', 'GPX (GPS y aplicaciones)', 'GeoJSON y JSON', 'Shapefile: un .zip con todos sus archivos, o el .shp junto con el .dbf', 'Excel (.xlsx, .xlsm), LibreOffice (.ods), CSV, TXT y TSV: una fila por punto con columnas «nombre», «lat», «lon»; para tramos, la columna «tramo»', 'Texto pegado: «lat, lon», grados-minutos-segundos o WKT', 'Coordenadas en grados, MAGNA-SIRGAS o UTM 18N: se convierten solas', 'No se pueden leer: Excel antiguo (.xls), AutoCAD (.dwg/.dxf), PDF e imágenes'])));
    S.main.appendChild(sec('Fotos y derechos de autor', li(['Sube solo fotos que el SETP pueda publicar: propias, con autorización escrita del autor o con licencia libre.', 'Cada foto pide quién la tomó, la licencia y una casilla de confirmación. Sin ella no se puede publicar.', 'Las fotos se reducen solas y se les borra la ubicación de la cámara.'])));
    S.main.appendChild(sec('Si algo no sale bien', li(['«Alguien más guardó cambios»: recarga el panel; dos personas editaron a la vez.', 'La sesión dura 8 horas por seguridad; al terminar te pide ingresar de nuevo y tus cambios no se pierden.', 'Para volver atrás: Versiones → «Cargar en el borrador» → Publicar.', 'Contraseña olvidada: quien administra Vercel puede definir una nueva en las variables ADMIN_USER y ADMIN_PASSWORD.'])));
    S.main.appendChild(sec('Datos personales', h('p', { text: 'No subas datos personales de la ciudadanía (nombres, cédulas, teléfonos o fotos donde se pueda identificar a una persona sin su autorización). El sitio público no recopila datos de quienes lo visitan.' })));
  }

  /* ================== arranque ================== */
  async function arrancar() {
    app.innerHTML = ''; app.appendChild(h('p', { class: 'cargando', role: 'status', text: 'Cargando el panel…' }));
    var s; try { s = await API('auth?a=session', { sinSesion: true }); } catch (e) { app.innerHTML = ''; return app.appendChild(h('div', { class: 'login-form', style: { minHeight: '100vh' } }, h('div', { class: 'login-card' }, h('h1', { text: 'No se pudo cargar' }), h('p', { text: e.message }), btn('', 'Reintentar', 'pri', arrancar)))); }
    S.conf = s.configurado; if (!s.configurado.almacenamiento || !s.configurado.credenciales) return vistaConfig(s.configurado);
    if (!s.autenticado) { S.user = null; return vistaLogin(); }
    S.user = s.usuario;
    try { await cargarBorrador(); } catch (e) { return falla(e); }
    shell(); ruta();
  }
  arrancar();
})();

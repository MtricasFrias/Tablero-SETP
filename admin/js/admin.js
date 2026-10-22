/* Panel de administración del Tablero SETP: ingreso, inicio, proyectos, asistente de proyecto nuevo, editor con vista previa, publicación, versiones y ayuda. */
(function () {
  'use strict';
  var h = UI.h, toast = UI.toast, app = document.getElementById('app'), clone = Fields.clone;
  var S = { user: null, datos: null, rev: 0, hayCambios: false, dirty: false, saving: false, timer: null, estadoGuardado: 'ok', conf: null, main: null, barra: null };
  var CAT = {}; SCHEMAS.CATEGORIAS.forEach(function (c) { CAT[c.id] = c; });
  var fecha = function (ts) { return new Date(ts).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }); };
  var nid = function () { return 'b' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5); };

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
    S.rev = d.rev; S.hayCambios = d.hayCambios; pintarBarra(); return { draft: d.draft, pub: d.pub };
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
  function logo() { return h('img', { src: '../img/setp-logo-color.png', alt: 'TransMusical SETP', class: 'logo' }); }
  function setTitle(t) { document.title = t + ' — Panel del Tablero SETP'; }

  function shell() {
    app.innerHTML = ''; S.barra = h('div', { class: 'barra', role: 'region', 'aria-label': 'Estado de los cambios' }); S.main = h('main', { id: 'vista', tabindex: '-1' });
    var nav = h('nav', { class: 'nav', 'aria-label': 'Secciones del panel' }, [['#/', 'Inicio'], ['#/proyectos', 'Proyectos'], ['#/nuevo', 'Agregar proyecto'], ['#/historial', 'Versiones'], ['#/ayuda', 'Ayuda']].map(function (l) { return h('a', { href: l[0], 'data-r': l[0], text: l[1] }); }));
    app.appendChild(h('header', { class: 'top' }, h('div', { class: 'top-in' }, logo(), h('div', { class: 'top-t' }, h('b', { text: 'Panel de administración' }), h('small', { text: 'Tablero de seguimiento · SETP Ibagué' })), nav,
      h('div', { class: 'top-u' }, h('span', { class: 'user', text: '👤 ' + S.user }), h('button', { type: 'button', class: 'btn small', text: 'Cambiar contraseña', on: { click: cambiarClave } }), h('button', { type: 'button', class: 'btn small', text: 'Salir', on: { click: salir } })))));
    app.appendChild(S.barra); app.appendChild(S.main);
    app.appendChild(h('footer', { class: 'pie' }, h('a', { href: '../terminos.html', target: '_blank', rel: 'noopener', text: 'Términos y Condiciones' }), ' · ', h('a', { href: '../privacidad.html', target: '_blank', rel: 'noopener', text: 'Política de Privacidad' }), ' · ', h('a', { href: '../cookies.html', target: '_blank', rel: 'noopener', text: 'Cookies' }), h('span', { text: ' · Esta página usa solo una cookie de sesión necesaria para mantenerte conectado.' })));
    pintarBarra();
  }
  function pintarBarra() {
    if (!S.barra) return; S.barra.innerHTML = '';
    var g = { ok: ['✔ Guardado', 'ok'], pend: ['Guardando en un momento…', 'pend'], guardando: ['Guardando…', 'pend'], error: ['⚠ No se pudo guardar', 'err'] }[S.estadoGuardado];
    S.barra.appendChild(h('div', { class: 'barra-in' }, h('span', { class: 'estado ' + g[1], text: g[0] }),
      h('span', { class: 'pub ' + (S.hayCambios ? 'hay' : 'nohay'), text: S.hayCambios ? '● Hay cambios que el público aún no ve' : '✔ El público ya ve todo lo que hay aquí' }),
      h('span', { class: 'barra-btn' }, h('a', { class: 'btn small', href: '../', target: '_blank', rel: 'noopener', text: 'Ver sitio público' }),
        h('button', { type: 'button', class: 'btn pri', text: '🚀 Publicar cambios', disabled: !S.hayCambios && !S.dirty, on: { click: publicar } }))));
  }

  /* ================== ingreso ================== */
  function vistaLogin(aviso) {
    S.main = null; S.barra = null; setTitle('Ingreso'); app.innerHTML = '';
    var u = h('input', { type: 'text', id: 'lg-usuario', autocomplete: 'username', required: true, autocapitalize: 'off', spellcheck: 'false' }), p = h('input', { type: 'password', id: 'lg-clave', autocomplete: 'current-password', required: true });
    var consHost = h('div'), ck = SETPConsent.checkboxes(consHost, { id: 'lg', base: '../' }), err = h('p', { class: 'err', role: 'alert', hidden: true }), btn = h('button', { type: 'submit', class: 'btn pri big', text: 'Ingresar' });
    var f = h('form', { class: 'login-card', novalidate: true, on: { submit: async function (e) {
      e.preventDefault(); err.hidden = true; if (!u.value.trim() || !p.value) { err.textContent = 'Escribe el usuario y la contraseña.'; err.hidden = false; return; }
      if (!ck.valid()) return; btn.disabled = true; btn.textContent = 'Ingresando…';
      try { await API('auth?a=login', { method: 'POST', sinSesion: true, body: { usuario: u.value.trim(), clave: p.value, acepta: ck.value() } }); S.user = u.value.trim(); p.value = '';
        if (S.datos) { shell(); ruta(); if (S.dirty) guardar(); } else { await arrancar(); } }
      catch (er) { err.textContent = er.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Ingresar'; p.value = ''; p.focus(); }
    } } },
      h('div', { class: 'login-logo' }, logo()), h('h1', { text: 'Panel de administración' }), h('p', { class: 'muted', text: 'Tablero de seguimiento de proyectos · SETP Ibagué' }),
      aviso ? h('p', { class: 'aviso', role: 'status', text: aviso }) : null,
      h('label', { class: 'campo', for: 'lg-usuario' }, h('span', { class: 'lbl', text: 'Usuario' }), u), h('label', { class: 'campo', for: 'lg-clave' }, h('span', { class: 'lbl', text: 'Contraseña' }), p), consHost, err, btn,
      h('p', { class: 'muted peq', text: 'Acceso solo para personal autorizado del SETP. Esta página no aparece en el sitio público. Usa una cookie de sesión estrictamente necesaria.' }));
    app.appendChild(h('div', { class: 'login' }, f)); u.focus();
  }
  function vistaConfig(c) {
    setTitle('Configuración pendiente'); app.innerHTML = '';
    var ok = function (v, t) { return h('li', { class: v ? 'ok' : 'no' }, (v ? '✔ ' : '✘ ') + t); };
    app.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-card ancho' }, h('div', { class: 'login-logo' }, logo()), h('h1', { text: 'Falta terminar la instalación' }),
      h('p', { text: 'El panel necesita dos cosas en Vercel antes de funcionar. Es un paso único y lo hace quien administra el proyecto en Vercel.' }),
      h('ul', { class: 'chk' }, ok(c.almacenamiento, 'Almacenamiento conectado (Upstash Redis)'), ok(c.credenciales, 'Usuario y contraseña de acceso (variables ADMIN_USER y ADMIN_PASSWORD)')),
      h('ol', { class: 'pasos' },
        h('li', { html: null }, h('b', { text: 'Conectar el almacenamiento: ' }), 'en Vercel entra al proyecto → pestaña «Storage» → «Create Database» → elige «Upstash for Redis» (plan gratuito) → «Connect Project». Vercel crea solo las variables necesarias.'),
        h('li', {}, h('b', { text: 'Crear el acceso: ' }), 'proyecto → «Settings» → «Environment Variables» → agrega ', h('code', { text: 'ADMIN_USER' }), ' (el usuario) y ', h('code', { text: 'ADMIN_PASSWORD' }), ' (la contraseña inicial) para Production.'),
        h('li', {}, h('b', { text: 'Publicar de nuevo: ' }), 'pestaña «Deployments» → los tres puntos del último despliegue → «Redeploy».'),
        h('li', {}, h('b', { text: 'Ingresar y cambiar la contraseña: ' }), 'entra aquí con ese usuario y, ya dentro, usa «Cambiar contraseña» para poner una propia que solo conozca el SETP.')),
      h('button', { type: 'button', class: 'btn pri', text: 'Volver a comprobar', on: { click: arrancar } }))));
  }

  async function salir() {
    if (S.dirty && !(await guardar())) { if (!(await UI.confirmar('Hay cambios que no se pudieron guardar. Si sales ahora se perderán.', { titulo: '¿Salir sin guardar?', si: 'Salir de todos modos', peligro: true }))) return; }
    try { await API('auth?a=logout', { method: 'POST', sinSesion: true }); } catch (e) {}
    S.user = null; S.datos = null; S.dirty = false; vistaLogin('Cerraste la sesión. Hasta pronto.');
  }
  function cambiarClave() {
    var a = h('input', { type: 'password', autocomplete: 'current-password' }), n = h('input', { type: 'password', autocomplete: 'new-password' }), r = h('input', { type: 'password', autocomplete: 'new-password' });
    var f = function (l, i, ay) { return h('label', { class: 'campo' }, h('span', { class: 'lbl', text: l }), i, ay ? h('small', { class: 'ayuda', text: ay }) : null); };
    UI.modal({ titulo: 'Cambiar contraseña', cuerpo: h('div', {}, f('Contraseña actual', a), f('Contraseña nueva', n, 'Mínimo 10 caracteres, con mayúscula, minúscula y número.'), f('Repite la contraseña nueva', r), h('p', { class: 'muted', text: 'Al cambiarla se cierran las demás sesiones abiertas. Anótala en un lugar seguro: no se puede recuperar, solo reemplazar desde Vercel.' })),
      acciones: [{ texto: 'Cancelar' }, { texto: 'Cambiar contraseña', clase: 'pri', onClick: function (close) {
        if (n.value !== r.value) { toast('Las dos contraseñas nuevas no coinciden.', 'err'); return false; }
        API('auth?a=password', { method: 'POST', body: { actual: a.value, nueva: n.value } }).then(function () { toast('Contraseña cambiada.', 'ok'); close(); }).catch(falla); return false; } }] });
  }

  /* ================== rutas ================== */
  function ruta() {
    if (!S.main) return; var hash = location.hash || '#/', m = /^#\/p\/([\w-]+)$/.exec(hash), v = 'inicio';
    S.main.className = ''; S.main.innerHTML = ''; window.scrollTo(0, 0);
    Array.prototype.forEach.call(document.querySelectorAll('.nav a'), function (a) { var r = a.getAttribute('data-r'); a.classList.toggle('on', r === hash || (r === '#/proyectos' && !!m)); a.removeAttribute('aria-current'); if (r === hash || (r === '#/proyectos' && !!m)) a.setAttribute('aria-current', 'page'); });
    if (editorActual) { editorActual.destroy(); editorActual = null; }
    if (m) vistaEditor(m[1]); else if (hash === '#/proyectos') vistaProyectos(); else if (hash === '#/nuevo') vistaNuevo(); else if (hash === '#/historial') vistaHistorial(); else if (hash === '#/ayuda') vistaAyuda(); else vistaInicio();
    var t = S.main.querySelector('h1'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', ruta);
  var editorActual = null;
  var titulo = function (txt, sub) { setTitle(txt); return h('div', { class: 'vh' }, h('h1', { text: txt }), sub ? h('p', { class: 'muted', text: sub }) : null); };

  /* ================== inicio ================== */
  function vistaInicio() {
    var vis = S.datos.proyectos.filter(function (p) { return p.visible; }).length, tot = S.datos.proyectos.length;
    var tarjeta = function (ico, t, d, fn, cls) { return h('button', { type: 'button', class: 'accion ' + (cls || ''), on: { click: fn } }, h('span', { class: 'ico', text: ico }), h('b', { text: t }), h('small', { text: d })); };
    S.main.appendChild(titulo('¿Qué quieres hacer?', 'Hola, ' + S.user + '. Elige una opción; todo lo que hagas aquí se guarda solo.'));
    S.main.appendChild(h('div', { class: 'acciones' },
      tarjeta('✏️', 'Actualizar un proyecto', 'Cambiar cifras, textos, fotos, mapas y documentos de un proyecto que ya existe.', function () { location.hash = '#/proyectos'; }),
      tarjeta('➕', 'Agregar un proyecto nuevo', 'Un asistente te pregunta qué información tienes y arma el proyecto paso a paso.', function () { location.hash = '#/nuevo'; }),
      tarjeta('👁️', 'Mostrar u ocultar proyectos', 'Si hay información dudosa, apaga el proyecto: el público deja de verlo al instante.', function () { location.hash = '#/proyectos'; }),
      tarjeta('🚀', 'Publicar los cambios', S.hayCambios ? 'Hay cambios guardados que el público aún no ve.' : 'Todo está publicado. Aquí se envía lo nuevo al sitio.', publicar, S.hayCambios ? 'resalta' : ''),
      tarjeta('🕘', 'Versiones anteriores', 'Volver a una versión publicada antes o descargar un respaldo.', function () { location.hash = '#/historial'; }),
      tarjeta('❓', 'Ayuda y guía', 'Cómo subir puntos al mapa, qué archivos se aceptan y qué significa cada sección.', function () { location.hash = '#/ayuda'; })));
    S.main.appendChild(h('section', { class: 'caja' }, h('h2', { text: 'Cómo funciona, en 3 pasos' }),
      h('ol', { class: 'tres-pasos' },
        h('li', {}, h('b', { text: '1 · Edita. ' }), 'Tus cambios se guardan solos como borrador. Nadie los ve todavía.'),
        h('li', {}, h('b', { text: '2 · Revisa. ' }), 'En el editor, el panel de la derecha muestra cómo queda la página tal como la verá el público.'),
        h('li', {}, h('b', { text: '3 · Publica. ' }), 'Con «Publicar cambios» el público ve la nueva versión. Si algo sale mal, puedes volver a una versión anterior.')),
      h('p', { class: 'muted', text: 'Una excepción: el interruptor «Visible en el sitio público» de cada proyecto actúa al instante, sin esperar a publicar.' })));
    S.main.appendChild(h('p', { class: 'resumen', text: 'Hay ' + tot + ' proyectos: ' + vis + ' visibles para el público y ' + (tot - vis) + ' ocultos.' }));
    S.main.appendChild(h('p', { class: 'enlaces' }, h('a', { href: '../', target: '_blank', rel: 'noopener', text: 'Abrir el sitio público ↗' }), ' · ', h('a', { href: '../?vista=borrador', target: '_blank', rel: 'noopener', text: 'Ver el sitio con el borrador ↗' })));
  }

  /* ================== lista de proyectos ================== */
  async function vistaProyectos() {
    S.main.appendChild(titulo('Proyectos', 'Cada proyecto tiene un interruptor para mostrarlo u ocultarlo en el sitio público.'));
    S.main.appendChild(h('p', {}, h('a', { class: 'btn pri', href: '#/nuevo', text: '➕ Agregar un proyecto nuevo' })));
    var cont = h('div'); S.main.appendChild(cont); var cambios = {};
    function pintar() {
      cont.innerHTML = '';
      SCHEMAS.CATEGORIAS.forEach(function (c) {
        var ps = S.datos.proyectos.filter(function (p) { return p.categoria === c.id; }); if (!ps.length) return;
        cont.appendChild(h('h2', { class: 'cat-t' }, c.icono + ' ' + c.nombre, h('small', { text: ' · ' + ps.length })));
        ps.forEach(function (p) { cont.appendChild(fila(p)); });
      });
    }
    function fila(p) {
      var sw = h('button', { type: 'button', class: 'sw' + (p.visible ? ' on' : ''), role: 'switch', 'aria-checked': p.visible ? 'true' : 'false', 'aria-label': 'Visible en el sitio público: ' + p.nombre, on: { click: function () { alternar(p, sw, etq); } } }, h('span', { class: 'sw-k' }));
      var etq = h('span', { class: 'sw-t', text: p.visible ? 'Visible' : 'Oculto' });
      var pend = cambios[p.id];
      return h('div', { class: 'proy' + (p.visible ? '' : ' oculto') },
        h('div', { class: 'proy-i' }, h('b', { text: p.nombre }), h('span', { class: 'muted', text: (p.fase || '') }),
          h('span', { class: 'chips' }, h('span', { class: 'chip', text: p.estado || 'Sin estado' }), p.proximo ? h('span', { class: 'chip gris', text: 'Próximamente' }) : null, pend ? h('span', { class: 'chip amb', text: pend === 'nuevo' ? 'Nuevo, sin publicar' : 'Cambios sin publicar' }) : null)),
        h('div', { class: 'proy-a' }, h('label', { class: 'swl' }, sw, etq), h('a', { class: 'btn small pri', href: '#/p/' + p.id, text: 'Editar' }), h('a', { class: 'btn small', href: '../?vista=borrador#/p/' + p.id, target: '_blank', rel: 'noopener', title: 'Abre el sitio con el borrador', text: 'Ver ↗' })));
    }
    async function alternar(p, sw, etq) {
      var nuevo = !p.visible;
      if (nuevo && !(await UI.confirmar('«' + p.nombre + '» se mostrará al público ahora mismo (si el proyecto tiene cambios sin publicar, se verán al publicar). ¿Estás seguro de que la información es correcta?', { titulo: '¿Mostrar este proyecto?', si: 'Sí, mostrarlo' }))) return;
      sw.disabled = true;
      try { await guardar(); var r = await API('admin?a=visibility', { method: 'POST', body: { id: p.id, visible: nuevo } }); p.visible = r.visible; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); pintar(); toast(nuevo ? 'Ahora «' + p.nombre + '» es visible para el público.' : '«' + p.nombre + '» quedó oculto: el público ya no lo ve.', 'ok'); }
      catch (e) { sw.disabled = false; falla(e); }
    }
    pintar();
    if (S.hayCambios) { try { var c = await comparar(); difDocs(c.draft, c.pub).forEach(function (d) { cambios[d.p.id] = d.t; }); if (S.main && S.main.contains(cont)) pintar(); } catch (e) {} }
  }

  /* ================== asistente: proyecto nuevo ================== */
  function slugUnico(nombre) { var b = UI.slug(nombre) || 'proyecto', id = b, i = 2; while (S.datos.proyectos.some(function (p) { return p.id === id; }) || id.length < 2) id = b.slice(0, 54) + '-' + (i++); return id; }
  function vistaNuevo() {
    var w = { paso: 1, d: { nombre: '', fase: '', categoria: '', estado: 'Por incluir' }, sel: {} };
    S.main.appendChild(titulo('Agregar un proyecto nuevo', 'Te hacemos unas preguntas y armamos la página con lo que tengas. El proyecto se crea oculto: el público no lo ve hasta que tú lo actives.'));
    var cont = h('div', { class: 'asist' }); S.main.appendChild(cont);
    function pasos() { return h('ol', { class: 'pasos-ind', 'aria-label': 'Pasos' }, ['Datos básicos', '¿Qué información tienes?', 'Revisar y crear'].map(function (t, i) { return h('li', { class: i + 1 === w.paso ? 'on' : (i + 1 < w.paso ? 'hecho' : ''), 'aria-current': i + 1 === w.paso ? 'step' : null }, h('span', { text: String(i + 1) }), t); })); }
    function pintar() {
      cont.innerHTML = ''; cont.appendChild(pasos());
      var card = h('section', { class: 'caja' }); cont.appendChild(card);
      if (w.paso === 1) {
        card.appendChild(h('h2', { text: '1. ¿Qué proyecto es?' }));
        card.appendChild(Fields.form(SCHEMAS.PROYECTO.filter(function (f) { return f.k !== 'pestana'; }), w.d, function () {}, { mapHosts: [] }));
        card.appendChild(h('div', { class: 'btnrow fin' }, h('button', { type: 'button', class: 'btn pri', text: 'Siguiente →', on: { click: function () {
          if (!w.d.nombre.trim()) return toast('Escribe el nombre del proyecto.', 'err'); if (!w.d.categoria) return toast('Elige el tipo de proyecto: vía, semáforo o paradero.', 'err');
          w.paso = 2; pintar(); window.scrollTo(0, 0); } } })));
      } else if (w.paso === 2) {
        card.appendChild(h('h2', { text: '2. ¿Qué información tienes hoy?' }));
        card.appendChild(h('p', { class: 'muted', text: 'Es como una lista de compras: marca lo que ya tienes para empezar. No hace falta que esté todo; después podrás agregar más secciones en cualquier momento. Si dudas de un dato, déjalo para después: nada se publica hasta que tú lo decidas.' }));
        var g = h('div', { class: 'compras' });
        SCHEMAS.PRESETS.forEach(function (ps) {
          var on = !!w.sel[ps.id], T = SCHEMAS.TIPOS[ps.tipo];
          var cb = h('input', { type: 'checkbox', checked: on, 'aria-label': ps.nombre, on: { change: function () { w.sel[ps.id] = this.checked; this.parentNode.classList.toggle('on', this.checked); } } });
          g.appendChild(h('label', { class: 'compra' + (on ? ' on' : '') }, cb, h('span', { class: 'ico', text: T.icono }), h('div', {}, h('b', { text: ps.nombre }), h('p', { class: 'q', text: ps.pregunta }), h('div', { class: 'nec' }, h('small', { text: 'Vas a necesitar:' }), h('ul', {}, ps.necesitas.map(function (n) { return h('li', { text: n }); }))))));
        });
        card.appendChild(g);
        card.appendChild(h('div', { class: 'btnrow fin' }, h('button', { type: 'button', class: 'btn', text: '← Atrás', on: { click: function () { w.paso = 1; pintar(); } } }), h('button', { type: 'button', class: 'btn pri', text: 'Siguiente →', on: { click: function () { w.paso = 3; pintar(); window.scrollTo(0, 0); } } })));
      } else {
        var elegidas = SCHEMAS.PRESETS.filter(function (ps) { return w.sel[ps.id]; });
        card.appendChild(h('h2', { text: '3. Revisa y crea' }));
        card.appendChild(h('dl', { class: 'resu' }, h('dt', { text: 'Proyecto' }), h('dd', { text: w.d.nombre + (w.d.fase ? ' · ' + w.d.fase : '') }), h('dt', { text: 'Tipo' }), h('dd', { text: CAT[w.d.categoria].icono + ' ' + CAT[w.d.categoria].nombre }), h('dt', { text: 'Estado' }), h('dd', { text: w.d.estado || 'Por incluir' }),
          h('dt', { text: 'Secciones' }), h('dd', { text: elegidas.length ? elegidas.map(function (x) { return x.nombre; }).join(' · ') : 'Ninguna por ahora (solo la portada). Podrás agregar secciones después.' })));
        card.appendChild(h('p', { class: 'aviso', text: 'El proyecto se crea OCULTO. Llena la información, míralo en la vista previa y cuando esté listo actívalo con «Visible en el sitio público» y publica.' }));
        card.appendChild(h('div', { class: 'btnrow fin' }, h('button', { type: 'button', class: 'btn', text: '← Atrás', on: { click: function () { w.paso = 2; pintar(); } } }), h('button', { type: 'button', class: 'btn pri big', text: 'Crear proyecto y empezar a llenarlo', on: { click: async function () {
          var id = slugUnico(w.d.nombre), p = { id: id, visible: false, categoria: w.d.categoria, nombre: w.d.nombre.trim(), fase: (w.d.fase || '').trim(), pestana: '', estado: w.d.estado || 'Por incluir', proximo: false,
            portada: { titulo: w.d.nombre.trim() + (w.d.fase ? ' — ' + w.d.fase.trim() : ''), descripcion: '', chips: [], datos: [], valores: { obra: null, interventoria: null, nota: '', etiquetas: {} }, indicadores: [] },
            bloques: elegidas.map(function (ps) { var b = clone(ps.plantilla); b.id = nid(); b.tipo = ps.tipo; return b; }) };
          S.datos.proyectos.push(p); marcar(); if (!(await guardar())) { S.datos.proyectos.pop(); return; } toast('Proyecto creado. Ahora llena la información.', 'ok'); location.hash = '#/p/' + id; } } })));
      }
    }
    pintar();
  }

  /* ================== editor de proyecto ================== */
  var abiertoB = new Set(), nuevosB = new Set();
  function elegirSeccion(cb) {
    var m;
    var listo = function (fn) { return function () { m.close(); fn(); }; };
    var tarjetaP = function (ps) { var T = SCHEMAS.TIPOS[ps.tipo]; return h('div', { class: 'opc' }, h('span', { class: 'ico', text: T.icono }), h('div', {}, h('b', { text: ps.nombre }), h('p', { class: 'q', text: ps.pregunta }), h('small', { text: 'Vas a necesitar: ' + ps.necesitas.join(' · ') })), h('button', { type: 'button', class: 'btn small pri', text: 'Agregar', on: { click: listo(function () { var b = clone(ps.plantilla); b.id = nid(); b.tipo = ps.tipo; cb(b); }) } })); };
    var tarjetaT = function (k) { var T = SCHEMAS.TIPOS[k]; return h('div', { class: 'opc' }, h('span', { class: 'ico', text: T.icono }), h('div', {}, h('b', { text: T.nombre }), h('p', { class: 'q', text: T.desc }), h('small', { text: 'Ejemplo: ' + T.ejemplo })), h('button', { type: 'button', class: 'btn small', text: 'Agregar en blanco', on: { click: listo(function () { cb(bloqueVacio(k)); }) } })); };
    m = UI.modal({ titulo: 'Agregar una sección', ancho: 'wide', cuerpo: h('div', { class: 'opciones' },
      h('h3', { text: 'Lista de compras: secciones sugeridas' }), h('p', { class: 'muted', text: 'Ya vienen con los títulos y datos que se han usado en otros proyectos. Solo llena los valores.' }), SCHEMAS.PRESETS.map(tarjetaP),
      h('h3', { text: 'Otros tipos de sección, en blanco' }), Object.keys(SCHEMAS.TIPOS).map(tarjetaT)), acciones: [{ texto: 'Cerrar' }] });
  }
  function bloqueVacio(tipo) {
    var T = SCHEMAS.TIPOS[tipo], b = { id: nid(), tipo: tipo, titulo: tipo === 'destacado' ? '' : T.nombre, subtitulo: '', nota: '' };
    T.fields.forEach(function (f) { if (f.t === 'lista' || f.t === 'textos') b[f.k] = []; else if (f.t === 'imagen') b[f.k] = null; });
    if (tipo === 'mapa') b.capas = [{ nombre: 'Ubicaciones', tipo: 'puntos', color: 'verde', elementos: [] }];
    return b;
  }

  function vistaEditor(id) {
    var p = S.datos.proyectos.find(function (x) { return x.id === id; });
    if (!p) { S.main.appendChild(titulo('Proyecto no encontrado')); S.main.appendChild(h('p', {}, h('a', { class: 'btn', href: '#/proyectos', text: '← Volver a Proyectos' }))); return; }
    S.main.className = 'ancho'; var mapas = [], frame, listoPrev = false, tPrev;
    var ctx = { mapHosts: [] };
    function enviarPrev() { if (!frame || !listoPrev) return; try { frame.contentWindow.postMessage({ tipo: 'proyecto', p: p }, location.origin); } catch (e) {} }
    function cambio() { marcar(); clearTimeout(tPrev); tPrev = setTimeout(enviarPrev, 450); }
    var onMsg = function (e) { if (e.origin !== location.origin) return; if (e.data && e.data.tipo === 'listo') { listoPrev = true; enviarPrev(); } };
    window.addEventListener('message', onMsg);
    editorActual = { destroy: function () { window.removeEventListener('message', onMsg); clearTimeout(tPrev); mapas.forEach(function (m) { try { m.destroy(); } catch (e) {} }); } };

    var swBtn = h('button', { type: 'button', class: 'sw' + (p.visible ? ' on' : ''), role: 'switch', 'aria-checked': p.visible ? 'true' : 'false', 'aria-label': 'Visible en el sitio público' }, h('span', { class: 'sw-k' })), swT = h('span', { class: 'sw-t', text: p.visible ? 'Visible en el sitio público' : 'Oculto al público' });
    swBtn.addEventListener('click', async function () {
      var nuevo = !p.visible; if (nuevo && !(await UI.confirmar('«' + p.nombre + '» se mostrará al público (los cambios sin publicar se verán al publicar). ¿La información ya es correcta?', { titulo: '¿Mostrar este proyecto?', si: 'Sí, mostrarlo' }))) return;
      swBtn.disabled = true; try { await guardar(); var r = await API('admin?a=visibility', { method: 'POST', body: { id: p.id, visible: nuevo } }); p.visible = r.visible; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); swBtn.classList.toggle('on', p.visible); swBtn.setAttribute('aria-checked', p.visible ? 'true' : 'false'); swT.textContent = p.visible ? 'Visible en el sitio público' : 'Oculto al público'; toast(p.visible ? 'Ahora es visible para el público.' : 'Quedó oculto al público.', 'ok'); enviarPrev(); }
      catch (e) { falla(e); } swBtn.disabled = false;
    });
    var prevAside = h('aside', { class: 'prev', 'aria-label': 'Vista previa' });
    frame = h('iframe', { src: 'preview.html', title: 'Vista previa de la página del proyecto', class: 'prev-frame' });
    prevAside.appendChild(h('div', { class: 'prev-h' }, h('b', { text: 'Así se ve en el sitio' }), h('button', { type: 'button', class: 'icon-btn cerrar-prev', 'aria-label': 'Cerrar vista previa', text: '✕', on: { click: function () { prevAside.classList.remove('abierto'); } } })));
    prevAside.appendChild(frame);

    S.main.appendChild(h('div', { class: 'ed-bar' }, h('a', { class: 'volver', href: '#/proyectos', text: '← Proyectos' }), h('h1', { text: p.nombre || 'Proyecto' }), h('label', { class: 'swl' }, swBtn, swT),
      h('button', { type: 'button', class: 'btn small ver-prev', text: '👁 Ver cómo queda', on: { click: function () { prevAside.classList.toggle('abierto'); } } }), h('a', { class: 'btn small', href: '../?vista=borrador#/p/' + p.id, target: '_blank', rel: 'noopener', text: 'Abrir borrador ↗' })));
    var ed = h('div', { class: 'ed' }), col = h('div', { class: 'ed-main' }); ed.appendChild(col); ed.appendChild(prevAside); S.main.appendChild(ed);

    /* 1. datos del proyecto */
    var s1 = h('section', { class: 'caja', id: 's-datos' }, h('h2', { text: '1 · Datos del proyecto' }), h('p', { class: 'muted', text: 'Nombre, tipo y estado: lo que se ve en el menú del sitio.' }));
    s1.appendChild(Fields.form(SCHEMAS.PROYECTO, p, function () { var t = S.main.querySelector('.ed-bar h1'); if (t) t.textContent = p.nombre || 'Proyecto'; cambio(); }, ctx));
    s1.appendChild(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!p.proximo, on: { change: function () { p.proximo = this.checked; cambio(); } } }), h('span', { text: 'Este proyecto aún no tiene información: mostrarlo como «próximamente» (no se puede abrir). Mientras esté marcado, las secciones no se publican.' })));
    col.appendChild(s1);
    /* 2. portada */
    var s2 = h('section', { class: 'caja', id: 's-portada' }, h('h2', { text: '2 · Portada de la página' }), h('p', { class: 'muted', text: 'Lo primero que ve el público: título, descripción, datos clave y los círculos de avance.' }));
    s2.appendChild(Fields.form(SCHEMAS.PORTADA, p.portada = p.portada || {}, cambio, ctx)); col.appendChild(s2);
    /* 3. secciones */
    var s3 = h('section', { class: 'caja', id: 's-secciones' }, h('h2', { text: '3 · Secciones' }), h('p', { class: 'muted', text: 'Cada sección es un bloque de la página: cifras, mapa, fotos, documentos… Ábrela para llenarla. Puedes reordenarlas con las flechas.' }));
    var lista = h('div', { class: 'bloques' }); s3.appendChild(lista);
    s3.appendChild(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn pri', text: '＋ Agregar una sección', on: { click: function () { elegirSeccion(function (b) { p.bloques.push(b); abiertoB.add(b.id); nuevosB.add(b.id); cambio(); pintarBloques(); var u = lista.lastElementChild; if (u) u.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); } } })));
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
          h('span', { class: 'chev', text: '▸' }), h('span', { class: 'ico', text: T.icono }), tit, h('span', { class: 'tipo', text: T.nombre }));
        var mv = function (d) { var j = i + d; if (j < 0 || j >= p.bloques.length) return; var x = p.bloques[i]; p.bloques[i] = p.bloques[j]; p.bloques[j] = x; cambio(); pintarBloques(); };
        var tools = h('span', { class: 'tools' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Subir sección', title: 'Subir', text: '▲', disabled: i === 0, on: { click: function () { mv(-1); } } }), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bajar sección', title: 'Bajar', text: '▼', disabled: i === p.bloques.length - 1, on: { click: function () { mv(1); } } }),
          h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Quitar sección', title: 'Quitar sección', text: '🗑', on: { click: async function () { if (await UI.confirmar('Se quitará la sección «' + (b.titulo || T.nombre) + '» con todo su contenido.', { titulo: '¿Quitar la sección?', si: 'Sí, quitar', peligro: true })) { p.bloques.splice(i, 1); abiertoB.delete(b.id); cambio(); pintarBloques(); } } } }));
        lista.appendChild(h('div', { class: 'item bloque', id: 'bl-' + b.id }, h('div', { class: 'item-bar' }, cab, tools), cuerpo));
      });
    }
    pintarBloques();

    /* zona de cuidado */
    col.appendChild(h('section', { class: 'caja peligro' }, h('h2', { text: 'Zona de cuidado' }), h('p', { class: 'muted', text: 'Si solo quieres que el público deje de ver el proyecto, usa el interruptor de arriba («Oculto»). Eliminar es para proyectos creados por error.' }),
      h('button', { type: 'button', class: 'btn danger', text: 'Eliminar este proyecto', on: { click: async function () {
        if (!(await UI.confirmar('Se eliminará «' + p.nombre + '» del borrador, con todas sus secciones. El público lo seguirá viendo hasta que publiques. Esta acción no se puede deshacer, salvo restaurando una versión anterior.', { titulo: '¿Eliminar el proyecto?', si: 'Sí, eliminar', peligro: true }))) return;
        S.datos.proyectos = S.datos.proyectos.filter(function (x) { return x.id !== p.id; }); marcar(); await guardar(); location.hash = '#/proyectos'; } } })));
    setTitle(p.nombre);
  }

  /* ================== publicar ================== */
  async function publicar() {
    var c; try { c = await comparar(); } catch (e) { return falla(e); }
    var cambios = difDocs(c.draft, c.pub), avisos = [], bloqueos = [];
    c.draft.proyectos.filter(function (p) { return p.visible && !p.proximo; }).forEach(function (p) { Fields.revisar(p).forEach(function (a) { (a.b ? bloqueos : avisos).push('«' + p.nombre + '» · ' + a.t); }); });
    var lista = cambios.length ? h('ul', { class: 'difs' }, cambios.map(function (d) { return h('li', {}, h('b', { text: d.p.nombre }), d.t === 'nuevo' ? ' — proyecto nuevo' + (d.p.visible ? '' : ' (oculto)') : d.t === 'quitado' ? ' — se quita del sitio' : ' — cambió: ' + d.c.join(', ')); })) : h('p', { class: 'muted', text: 'No encuentro diferencias con lo publicado. Puedes publicar de todos modos.' });
    var nota = h('input', { type: 'text', maxlength: 200, placeholder: 'Ej.: Actualicé el avance de la Carrera 5', 'aria-label': 'Nota sobre este cambio' });
    var cuerpo = h('div', {}, h('p', { text: 'Al publicar, TODO el público verá estos cambios en el sitio.' }), h('h3', { text: 'Qué va a cambiar' }), lista,
      bloqueos.length ? h('div', { class: 'warn-box' }, h('b', { text: '⛔ Antes de publicar corrige:' }), h('ul', {}, bloqueos.map(function (x) { return h('li', { text: x }); }))) : null,
      avisos.length ? h('div', { class: 'warn-box suave' }, h('b', { text: '⚠ Revisa (no impide publicar; lo incompleto no se mostrará):' }), h('ul', {}, avisos.slice(0, 12).map(function (x) { return h('li', { text: x }); }), avisos.length > 12 ? h('li', { text: '… y ' + (avisos.length - 12) + ' más' }) : null)) : null,
      h('label', { class: 'campo' }, h('span', { class: 'lbl', text: '¿Qué cambió? (opcional, queda en el historial)' }), nota));
    UI.modal({ titulo: 'Publicar los cambios', ancho: 'wide', cuerpo: cuerpo, acciones: [{ texto: 'Cancelar' }, { texto: bloqueos.length ? 'Corrige primero' : '🚀 Publicar ahora', clase: 'pri', onClick: function (close) {
      if (bloqueos.length) return false;
      API('admin?a=publish', { method: 'POST', body: { nota: nota.value } }).then(function (r) { S.hayCambios = r.hayCambios; S.pubMeta = r.publicado; pintarBarra(); toast('¡Publicado! El público ya ve la nueva versión (puede tardar un minuto en actualizarse).', 'ok'); close(); if ((location.hash || '#/') === '#/' || location.hash === '#/proyectos') ruta(); }).catch(falla); return false; } }] });
  }

  /* ================== versiones y respaldo ================== */
  async function vistaHistorial() {
    S.main.appendChild(titulo('Versiones anteriores', 'Cada vez que publicas se guarda una copia. Puedes volver a cualquiera de las últimas 15.'));
    var cont = h('div'); S.main.appendChild(cont); cont.appendChild(h('p', { class: 'muted', text: 'Cargando…' }));
    S.main.appendChild(h('section', { class: 'caja' }, h('h2', { text: 'Respaldo y otras opciones' }),
      h('div', { class: 'btnrow' }, h('a', { class: 'btn', href: '../api/admin?a=export', download: 'tablero-setp-respaldo.json', text: '⬇ Descargar respaldo (JSON)' }),
        h('button', { type: 'button', class: 'btn', text: 'Descartar cambios sin publicar', on: { click: async function () {
          if (!(await UI.confirmar('Se borrarán todos los cambios del borrador que aún no has publicado y se volverá a lo que ve el público ahora.', { titulo: '¿Descartar los cambios sin publicar?', si: 'Sí, descartar', peligro: true }))) return;
          try { var r = await API('admin?a=discard', { method: 'POST', body: {} }); S.datos = r.datos; S.rev = r.rev; S.hayCambios = r.hayCambios; S.dirty = false; S.estadoGuardado = 'ok'; pintarBarra(); toast('Listo: el borrador volvió a lo publicado.', 'ok'); } catch (e) { falla(e); } } } }),
        h('button', { type: 'button', class: 'btn danger', text: 'Volver al contenido inicial del tablero', on: { click: async function () {
          if (!(await UI.confirmar('Se reemplazará el borrador por los 10 proyectos con los que se entregó el tablero. Lo publicado no cambia hasta que publiques. Si vas a perder trabajo, descarga antes un respaldo.', { titulo: '¿Volver al contenido inicial?', si: 'Sí, reemplazar el borrador', peligro: true }))) return;
          try { var r = await API('admin?a=seed', { method: 'POST', body: {} }); S.datos = r.datos; S.rev = r.rev; S.hayCambios = r.hayCambios; pintarBarra(); toast('El borrador volvió al contenido inicial.', 'ok'); } catch (e) { falla(e); } } } }))));
    try {
      var r = await API('admin?a=history'); cont.innerHTML = '';
      if (!r.versiones.length) { cont.appendChild(h('p', { class: 'vacio', text: 'Todavía no has publicado ninguna versión. Aparecerán aquí cuando publiques.' })); return; }
      r.versiones.forEach(function (v, i) { cont.appendChild(h('div', { class: 'proy' }, h('div', { class: 'proy-i' }, h('b', { text: fecha(v.ts) + (i === 0 ? ' · la más reciente' : '') }), h('span', { class: 'muted', text: 'Por ' + v.by + ' · ' + v.proyectos + ' proyectos (' + v.visibles + ' visibles)' + (v.nota ? ' · «' + v.nota + '»' : '') })),
        h('div', { class: 'proy-a' }, h('button', { type: 'button', class: 'btn small', text: 'Cargar en el borrador', on: { click: async function () {
          if (!(await UI.confirmar('El borrador se reemplazará por esta versión. El público no verá nada nuevo hasta que publiques.', { titulo: '¿Cargar esta versión?', si: 'Sí, cargarla' }))) return;
          try { var x = await API('admin?a=restore', { method: 'POST', body: { id: v.id } }); S.datos = x.datos; S.rev = x.rev; S.hayCambios = x.hayCambios; S.dirty = false; pintarBarra(); toast('Versión cargada en el borrador. Revísala y publica si todo está bien.', 'ok'); location.hash = '#/proyectos'; } catch (e) { falla(e); } } } })))); });
    } catch (e) { cont.innerHTML = ''; falla(e); }
  }

  /* ================== ayuda ================== */
  function vistaAyuda() {
    S.main.appendChild(titulo('Ayuda y guía rápida', 'Si es la primera vez, empieza por «Agregar un proyecto nuevo» o abre un proyecto existente.'));
    var sec = function (t, c) { return h('details', { class: 'ay', open: true }, h('summary', { text: t }), c); };
    var li = function (a) { return h('ul', {}, a.map(function (x) { return h('li', { text: x }); })); };
    S.main.appendChild(sec('¿Qué hace cada cosa?', li(['Borrador: lo que editas aquí. Se guarda solo y el público no lo ve.', 'Publicar: envía el borrador al sitio público. Hasta ese momento nada cambia para el público.', 'Visible / Oculto: apaga un proyecto completo del sitio público al instante. Útil si encuentras un dato dudoso.', 'Versiones: copias de lo que se publicó; sirven para volver atrás si algo sale mal.'])));
    S.main.appendChild(sec('Cómo agregar puntos al mapa', li(['Abre el proyecto → sección «Mapa» (o agrégala).', '«📍 Agregar un punto» y haz clic en el mapa donde está. Ponle nombre en el recuadro de abajo.', 'Para muchos puntos: «📂 Subir archivos» y elige tu Excel, KMZ, GPX, GeoJSON, Shapefile o CSV; o «📋 Pegar coordenadas».', 'Para recorridos de vía: «✏️ Dibujar un tramo», haz clic punto por punto y pulsa «Terminar tramo»; o sube el KMZ del recorrido.'])));
    S.main.appendChild(sec('Archivos que se aceptan para el mapa', li(['KMZ y KML (Google Earth, Google My Maps, QGIS)', 'GPX (GPS y aplicaciones)', 'GeoJSON y JSON', 'Shapefile: un .zip con todos sus archivos, o el .shp junto con el .dbf', 'Excel (.xlsx, .xlsm), LibreOffice (.ods), CSV, TXT y TSV: una fila por punto con columnas «nombre», «lat», «lon»; para tramos, la columna «tramo»', 'Texto pegado: «lat, lon», grados-minutos-segundos o WKT', 'Coordenadas en grados, MAGNA-SIRGAS o UTM 18N: se convierten solas', 'No se pueden leer: Excel antiguo (.xls), AutoCAD (.dwg/.dxf), PDF e imágenes'])));
    S.main.appendChild(sec('Fotos y derechos de autor', li(['Sube solo fotos que el SETP pueda publicar: propias, con autorización escrita del autor o con licencia libre.', 'Cada foto pide quién la tomó, la licencia y una casilla de confirmación. Sin ella no se puede publicar.', 'Las fotos se reducen solas y se les borra la ubicación de la cámara.'])));
    S.main.appendChild(sec('Si algo no sale bien', li(['«Alguien más guardó cambios»: recarga el panel; dos personas editaron a la vez.', 'La sesión dura 8 horas por seguridad; al terminar te pide ingresar de nuevo y tus cambios no se pierden.', 'Para volver atrás: Versiones → «Cargar en el borrador» → Publicar.', 'Contraseña olvidada: quien administra Vercel puede definir una nueva en las variables ADMIN_USER y ADMIN_PASSWORD.'])));
    S.main.appendChild(sec('Datos personales', h('p', { text: 'No subas datos personales de la ciudadanía (nombres, cédulas, teléfonos o fotos donde se pueda identificar a una persona sin su autorización). El sitio público no recopila datos de quienes lo visitan.' })));
  }

  /* ================== arranque ================== */
  async function arrancar() {
    app.innerHTML = ''; app.appendChild(h('p', { class: 'cargando', role: 'status', text: 'Cargando el panel…' }));
    var s; try { s = await API('auth?a=session', { sinSesion: true }); } catch (e) { app.innerHTML = ''; return app.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-card' }, h('h1', { text: 'No se pudo cargar' }), h('p', { text: e.message }), h('button', { type: 'button', class: 'btn pri', text: 'Reintentar', on: { click: arrancar } })))); }
    S.conf = s.configurado; if (!s.configurado.almacenamiento || !s.configurado.credenciales) return vistaConfig(s.configurado);
    if (!s.autenticado) { S.user = null; return vistaLogin(); }
    S.user = s.usuario;
    try { await cargarBorrador(); } catch (e) { return falla(e); }
    shell(); ruta();
  }
  arrancar();
})();

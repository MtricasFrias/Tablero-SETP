/* Editor de mapa del panel: marcar puntos y tramos con clic, subir archivos (muchos formatos) o pegar coordenadas. Los lectores están en geo.js. */
(function () {
  'use strict';
  var h = UI.h, toast = UI.toast, G = SETPGeo, inIbague = G.enIbague, largoM = G.largoM;

  /* ================== editor de mapa ================== */
  var HEX = SETPRender.HEX, LC = SETPRender.ESTADO_LINEA;
  var COLORS = [['verde', 'Verde'], ['azul', 'Azul'], ['ambar', 'Ámbar'], ['marino', 'Azul oscuro'], ['pino', 'Verde oscuro'], ['gris', 'Gris']];
  var TILES = { sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Satélite'], calles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', 'Calles'] };
  var PAGE = 25;

  function edit(host, block, onChange) {
    block.capas = block.capas || [];
    var st = { capa: 0, modo: '', sel: -1, vertices: [], q: '', pag: 0, base: 'sat' };
    var map, baseLayer, grupos = [], temp = null, tempPts = null;
    var root = h('div', { class: 'mapedit' }); host.appendChild(root);

    var capaBar = h('div', { class: 'me-capas' }), ajustes = h('div', { class: 'me-ajustes' }), tools = h('div', { class: 'me-tools' }), ayuda = h('div', { class: 'me-ayuda', role: 'status' }), mapEl = h('div', { class: 'me-map' }), panelSel = h('div', { class: 'me-sel' }), lista = h('div', { class: 'me-lista' });
    root.appendChild(capaBar); root.appendChild(ajustes); root.appendChild(tools); root.appendChild(ayuda); root.appendChild(mapEl); root.appendChild(panelSel); root.appendChild(lista);

    var cur = function () { return block.capas[st.capa]; };
    var change = function () { onChange(); };

    function ensureMap() {
      if (map) return; map = L.map(mapEl, { scrollWheelZoom: true, preferCanvas: true, doubleClickZoom: false });
      baseLayer = L.tileLayer(TILES.sat[0], { maxZoom: 19, attribution: 'Imágenes © Esri' }).addTo(map);
      map.setView([4.4389, -75.2322], 13);
      map.on('click', onMapClick); map.on('dblclick', function () { if (st.modo === 'linea') terminarLinea(); });
      L.control.layers({ 'Satélite': baseLayer }, null, { position: 'topright' });
      setTimeout(function () { map.invalidateSize(); drawAll(true); }, 60);
    }
    function setBase(b) { st.base = b; if (baseLayer) map.removeLayer(baseLayer); baseLayer = L.tileLayer(TILES[b][0], { maxZoom: 19, attribution: 'Imágenes © Esri' }).addTo(map); baseLayer.bringToBack(); }

    /* ----- dibujo de capas ----- */
    function drawAll(fit) {
      if (!map) return; grupos.forEach(function (g) { map.removeLayer(g); }); grupos = []; var all = [];
      block.capas.forEach(function (c, ci) {
        var g = L.layerGroup(), act = ci === st.capa, op = act ? 1 : 0.45;
        (c.elementos || []).forEach(function (e, ei) {
          var sel = act && ei === st.sel, pop = '<b>' + UI.esc(e.nombre || '(sin nombre)') + '</b>';
          if (c.tipo === 'lineas') { var cs = e.coords || []; if (cs.length < 2) return; var pl = L.polyline(cs, { color: sel ? '#fff' : (LC[e.estado] || LC.pendiente), weight: sel ? 8 : 5, opacity: op }).addTo(g); if (sel) L.polyline(cs, { color: LC[e.estado] || LC.pendiente, weight: 4 }).addTo(g); pl.on('click', function (ev) { if (!act || st.modo) return; L.DomEvent.stopPropagation(ev); seleccionar(ei); }); cs.forEach(function (q) { all.push(q); }); }
          else { var m = L.circleMarker([e.lat, e.lon], { radius: sel ? 10 : (c.elementos.length > 300 ? 4 : 7), color: sel ? '#0A1F5C' : '#fff', weight: sel ? 3 : (c.elementos.length > 300 ? 1 : 2), fillColor: HEX[c.color] || HEX.azul, fillOpacity: op * .95 }).addTo(g); m.on('click', function (ev) { if (!act || st.modo) return; L.DomEvent.stopPropagation(ev); seleccionar(ei); }); all.push([e.lat, e.lon]); }
        });
        g.addTo(map); grupos.push(g);
      });
      if (fit && all.length) map.fitBounds(all, { padding: [30, 30], maxZoom: 17 });
      dibujarTemp();
    }
    function dibujarTemp() { if (temp) { map.removeLayer(temp); temp = null; } if (tempPts) { map.removeLayer(tempPts); tempPts = null; } if (st.modo === 'linea' && st.vertices.length) { temp = L.polyline(st.vertices, { color: '#F0A800', weight: 5, dashArray: '8 6' }).addTo(map); tempPts = L.layerGroup(st.vertices.map(function (v) { return L.circleMarker(v, { radius: 5, color: '#fff', weight: 2, fillColor: '#F0A800', fillOpacity: 1 }); })).addTo(map); } }

    /* ----- interacción ----- */
    function modo(m) {
      st.modo = st.modo === m ? '' : m; st.vertices = []; if (map) { map.getContainer().style.cursor = st.modo ? 'crosshair' : ''; if (st.modo === 'linea') map.doubleClickZoom.disable(); }
      pintarTools(); pintarAyuda(); drawAll(false);
    }
    function onMapClick(ev) {
      var c = cur(); if (!c) return; var la = Math.round(ev.latlng.lat * 1e6) / 1e6, lo = Math.round(ev.latlng.lng * 1e6) / 1e6;
      if (st.modo === 'punto' && c.tipo === 'puntos') { c.elementos.push({ nombre: '', detalle: '', lat: la, lon: lo }); st.sel = c.elementos.length - 1; st.modo = ''; map.getContainer().style.cursor = ''; change(); pintarTodo(); toast('Punto agregado. Escríbele un nombre abajo.', 'ok'); }
      else if (st.modo === 'mover' && st.sel >= 0 && c.tipo === 'puntos') { c.elementos[st.sel].lat = la; c.elementos[st.sel].lon = lo; st.modo = ''; map.getContainer().style.cursor = ''; change(); pintarTodo(); }
      else if (st.modo === 'linea') { st.vertices.push([la, lo]); dibujarTemp(); pintarAyuda(); }
    }
    function terminarLinea() {
      var c = cur(); if (!c || c.tipo !== 'lineas') return;
      if (st.vertices.length < 2) { toast('Marca al menos 2 puntos para formar el tramo.', 'err'); return; }
      c.elementos.push({ nombre: '', detalle: '', estado: 'pendiente', coords: st.vertices.slice() }); st.sel = c.elementos.length - 1; st.vertices = []; st.modo = ''; map.getContainer().style.cursor = ''; change(); pintarTodo(); toast('Tramo creado. Ponle nombre y estado abajo.', 'ok');
    }
    function seleccionar(i) { st.sel = i; var c = cur(); pintarSel(); pintarLista(); drawAll(false); if (c && c.elementos[i] && map) { var e = c.elementos[i]; if (c.tipo === 'puntos') map.panTo([e.lat, e.lon]); else if (e.coords && e.coords.length) map.fitBounds(e.coords, { padding: [40, 40], maxZoom: 17 }); } }

    /* ----- partes de la interfaz ----- */
    function pintarCapas() {
      capaBar.innerHTML = ''; capaBar.appendChild(h('span', { class: 'me-lbl', text: 'Capas del mapa:' }));
      block.capas.forEach(function (c, i) { capaBar.appendChild(h('button', { type: 'button', class: 'chipbtn' + (i === st.capa ? ' on' : ''), on: { click: function () { st.capa = i; st.sel = -1; st.pag = 0; st.q = ''; st.modo = ''; st.vertices = []; pintarTodo(); } } }, h('i', { style: { background: HEX[c.color] || HEX.azul } }), (c.nombre || 'Capa ' + (i + 1)) + ' (' + (c.elementos || []).length + ')')); });
      capaBar.appendChild(h('button', { type: 'button', class: 'btn small', 'data-ico': 'mas', text: 'Nueva capa', on: { click: function () { block.capas.push({ nombre: 'Nueva capa', tipo: 'puntos', color: 'azul', elementos: [] }); st.capa = block.capas.length - 1; st.sel = -1; change(); pintarTodo(); } } }));
    }
    function pintarAjustes() {
      ajustes.innerHTML = ''; var c = cur(); if (!c) { ajustes.appendChild(h('p', { class: 'muted', text: 'Este mapa aún no tiene capas. Pulsa «Nueva capa» para empezar.' })); return; }
      var nombre = h('input', { type: 'text', value: c.nombre || '', maxlength: 120, 'aria-label': 'Nombre de la capa', on: { input: function () { c.nombre = this.value; change(); } } });
      nombre.addEventListener('change', pintarCapas);
      var tipo = h('select', { 'aria-label': 'Tipo de capa', disabled: (c.elementos || []).length > 0, title: (c.elementos || []).length ? 'Para cambiar el tipo, la capa debe estar vacía' : '', on: { change: function () { c.tipo = this.value; change(); pintarTodo(); } } }, h('option', { value: 'puntos', text: 'Puntos (paraderos, semáforos…)', selected: c.tipo !== 'lineas' }), h('option', { value: 'lineas', text: 'Tramos (recorridos de vía)', selected: c.tipo === 'lineas' }));
      var color = h('select', { 'aria-label': 'Color de los puntos', on: { change: function () { c.color = this.value; change(); pintarCapas(); drawAll(false); } } }, COLORS.map(function (x) { return h('option', { value: x[0], text: x[1], selected: c.color === x[0] }); }));
      ajustes.appendChild(h('label', {}, h('span', { text: 'Nombre de la capa' }), nombre)); ajustes.appendChild(h('label', {}, h('span', { text: 'Qué se marca' }), tipo));
      if (c.tipo !== 'lineas') ajustes.appendChild(h('label', {}, h('span', { text: 'Color' }), color));
      ajustes.appendChild(h('button', { type: 'button', class: 'btn small danger', text: 'Quitar esta capa', on: { click: async function () { if (await UI.confirmar('Se borrará la capa «' + (c.nombre || '') + '» con sus ' + (c.elementos || []).length + ' elementos. Podrás volver atrás descartando los cambios sin guardar.', { titulo: '¿Quitar la capa?', si: 'Sí, quitar', peligro: true })) { block.capas.splice(st.capa, 1); st.capa = Math.max(0, st.capa - 1); st.sel = -1; change(); pintarTodo(); } } } }));
    }
    function pintarTools() {
      tools.innerHTML = ''; var c = cur(); if (!c) return; var pts = c.tipo !== 'lineas';
      var b = function (t, cls, fn, on, ico) { var x = h('button', { type: 'button', class: 'btn ' + (cls || '') + (on ? ' on' : ''), on: { click: fn } }); if (ico) x.appendChild(Ico.el(ico)); x.appendChild(document.createTextNode(t)); return x; };
      if (pts) tools.appendChild(b('Agregar un punto (clic en el mapa)', 'pri', function () { modo('punto'); }, st.modo === 'punto', 'pin'));
      else { tools.appendChild(b('Dibujar un tramo', 'pri', function () { modo('linea'); }, st.modo === 'linea', 'ruta')); if (st.modo === 'linea') { tools.appendChild(b('Terminar tramo', 'oro', terminarLinea, false, 'check')); tools.appendChild(b('Deshacer último punto', 'ghost', function () { st.vertices.pop(); dibujarTemp(); pintarAyuda(); }, false, 'deshacer')); } }
      tools.appendChild(b('Subir archivos (Excel, KMZ, GPX, CSV…)', 'ghost', subirArchivo, false, 'publicar')); tools.appendChild(b('Pegar coordenadas', 'ghost', pegar, false, 'portapapeles'));
      tools.appendChild(b(st.base === 'sat' ? 'Ver calles' : 'Ver satélite', 'ghost', function () { setBase(st.base === 'sat' ? 'calles' : 'sat'); pintarTools(); }, false, 'mapa'));
      tools.appendChild(b('Centrar', 'ghost', function () { drawAll(true); }, false, 'centrar'));
    }
    function pintarAyuda() {
      var c = cur(); var t = '';
      if (!c) t = '';
      else if (st.modo === 'punto') t = 'Haz clic en el mapa en el lugar exacto del punto. Después le pones nombre abajo.';
      else if (st.modo === 'mover') t = 'Haz clic en el mapa en el nuevo lugar del punto seleccionado.';
      else if (st.modo === 'linea') t = 'Haz clic para marcar el recorrido, punto por punto (llevas ' + st.vertices.length + '). Cuando termines, pulsa «Terminar tramo» o haz doble clic.';
      else if (!(c.elementos || []).length) t = c.tipo === 'lineas' ? 'Esta capa está vacía. Dibuja un tramo con clic en el mapa, o sube el archivo KMZ del recorrido.' : 'Esta capa está vacía. Agrega puntos con clic en el mapa, sube un archivo o pega coordenadas.';
      else t = 'Toca un elemento del mapa o de la lista para editarlo. Con ' + (c.tipo === 'lineas' ? 'tramos' : 'puntos') + ' ya cargados puedes seguir agregando más.';
      ayuda.textContent = t; ayuda.hidden = !t;
    }
    function pintarSel() {
      panelSel.innerHTML = ''; var c = cur(); if (!c || st.sel < 0 || !c.elementos[st.sel]) { return; } var e = c.elementos[st.sel];
      var pts = c.tipo !== 'lineas';
      var inp = function (lbl, key, type, o) { o = o || {}; return h('label', {}, h('span', { text: lbl }), h('input', { type: type || 'text', value: e[key] === undefined ? '' : e[key], step: o.step, maxlength: o.max, on: { input: function () { e[key] = type === 'number' ? (this.value === '' ? null : Number(this.value)) : this.value; change(); }, change: function () { pintarLista(); drawAll(false); } } })); };
      panelSel.appendChild(h('h4', { text: pts ? 'Punto seleccionado' : 'Tramo seleccionado' }));
      var row = h('div', { class: 'me-sel-row' }, inp(pts ? 'Nombre del punto' : 'Nombre del tramo', 'nombre', 'text', { max: 160 }), inp('Detalle (opcional)', 'detalle', 'text', { max: 300 }));
      if (pts) { row.appendChild(inp('Latitud', 'lat', 'number', { step: 'any' })); row.appendChild(inp('Longitud', 'lon', 'number', { step: 'any' })); }
      else row.appendChild(h('label', {}, h('span', { text: 'Estado del tramo' }), h('select', { on: { change: function () { e.estado = this.value; change(); drawAll(false); pintarLista(); } } }, [['pendiente', 'Pendiente (gris)'], ['en curso', 'En curso (azul)'], ['ejecutado', 'Ejecutado (verde)']].map(function (o) { return h('option', { value: o[0], text: o[1], selected: e.estado === o[0] }); }))));
      panelSel.appendChild(row);
      if (pts && e.lat !== null && !inIbague(e.lat, e.lon)) panelSel.appendChild(h('p', { class: 'warn', text: 'Atención: este punto queda fuera de Ibagué. Revisa que latitud y longitud no estén al revés (en Ibagué la latitud es ≈ 4,4 y la longitud ≈ -75,2).' }));
      if (!pts) panelSel.appendChild(h('p', { class: 'muted', text: 'Longitud del trazo: ≈ ' + Math.round(largoM(e.coords || [])).toLocaleString('es-CO') + ' m · ' + (e.coords || []).length + ' vértices.' }));
      var acts = h('div', { class: 'me-sel-acts' });
      if (pts) acts.appendChild(h('button', { type: 'button', class: 'btn small', text: 'Mover en el mapa', on: { click: function () { modo('mover'); } } }));
      acts.appendChild(h('button', { type: 'button', class: 'btn small danger', text: 'Eliminar', on: { click: function () { c.elementos.splice(st.sel, 1); st.sel = -1; change(); pintarTodo(); } } }));
      acts.appendChild(h('button', { type: 'button', class: 'btn small', text: 'Listo', on: { click: function () { st.sel = -1; pintarTodo(); } } }));
      panelSel.appendChild(acts);
    }
    function pintarLista() {
      lista.innerHTML = ''; var c = cur(); if (!c || !(c.elementos || []).length) return;
      var q = UI.slug(st.q), items = c.elementos.map(function (e, i) { return { e: e, i: i }; }).filter(function (x) { return !q || UI.slug(x.e.nombre + ' ' + (x.e.detalle || '')).indexOf(q) >= 0; });
      var pages = Math.max(1, Math.ceil(items.length / PAGE)); if (st.pag >= pages) st.pag = pages - 1;
      var buscar = h('input', { type: 'search', placeholder: 'Buscar por nombre…', value: st.q, 'aria-label': 'Buscar en la lista', on: { input: UI.debounce(function () { st.q = this.value; st.pag = 0; pintarLista(); }, 250) } });
      lista.appendChild(h('div', { class: 'me-lista-head' }, h('strong', { text: (c.tipo === 'lineas' ? 'Tramos' : 'Puntos') + ' de esta capa: ' + c.elementos.length.toLocaleString('es-CO') }), buscar,
        h('button', { type: 'button', class: 'btn small danger', text: 'Vaciar capa', on: { click: async function () { if (await UI.confirmar('Se quitarán los ' + c.elementos.length + ' elementos de esta capa.', { titulo: '¿Vaciar la capa?', si: 'Sí, vaciar', peligro: true })) { c.elementos = []; st.sel = -1; change(); pintarTodo(); } } } })));
      var tb = h('table', { class: 'me-tabla' }, h('thead', {}, h('tr', {}, h('th', { text: '#' }), h('th', { text: 'Nombre' }), h('th', { text: c.tipo === 'lineas' ? 'Estado' : 'Ubicación' }), h('th', {}))));
      var body = h('tbody'); items.slice(st.pag * PAGE, st.pag * PAGE + PAGE).forEach(function (x) {
        body.appendChild(h('tr', { class: x.i === st.sel ? 'sel' : '' }, h('td', { text: String(x.i + 1) }), h('td', { text: x.e.nombre || '(sin nombre)' }), h('td', { class: 'muted', text: c.tipo === 'lineas' ? (x.e.estado || '') : (x.e.lat + ', ' + x.e.lon) }), h('td', {}, h('button', { type: 'button', class: 'btn small', text: 'Editar', on: { click: function () { seleccionar(x.i); mapEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } } }))));
      }); tb.appendChild(body); lista.appendChild(h('div', { class: 'me-scroll' }, tb));
      if (pages > 1) lista.appendChild(h('div', { class: 'me-pag' }, h('button', { type: 'button', class: 'btn small', text: '‹ Anterior', disabled: st.pag === 0, on: { click: function () { st.pag--; pintarLista(); } } }), h('span', { text: 'Página ' + (st.pag + 1) + ' de ' + pages }), h('button', { type: 'button', class: 'btn small', text: 'Siguiente ›', disabled: st.pag >= pages - 1, on: { click: function () { st.pag++; pintarLista(); } } })));
    }
    function pintarTodo() { pintarCapas(); pintarAjustes(); pintarTools(); pintarAyuda(); pintarSel(); pintarLista(); drawAll(false); }

    /* ----- importar ----- */
    var FORMATOS = [
      ['KMZ · KML', 'Google Earth, Google My Maps, QGIS', 'Puntos y recorridos', 'En Google Earth: clic derecho en la carpeta o el lugar → «Guardar lugar como…» → KMZ.'],
      ['GPX', 'GPS de mano y apps (Garmin, Strava…)', 'Puntos y recorridos', 'Se exporta directo desde la app o el aparato.'],
      ['GeoJSON · JSON', 'QGIS, ArcGIS, geojson.io', 'Puntos y tramos', 'En QGIS: clic derecho en la capa → Exportar → «GeoJSON».'],
      ['Shapefile (.zip, o .shp + .dbf)', 'ArcGIS, QGIS, IGAC', 'Puntos y tramos', 'Comprime en un .zip todos los archivos del shapefile (.shp, .dbf, .prj…) o selecciónalos juntos al subir.'],
      ['Excel (.xlsx, .xlsm) · LibreOffice (.ods)', 'Tu propia tabla', 'Puntos y tramos', 'Una fila por punto, con columnas «nombre», «lat» y «lon». Para tramos agrega la columna «tramo»: las filas con el mismo tramo forman una línea.'],
      ['CSV · TXT · TSV', 'Excel guardado como CSV, bloc de notas', 'Puntos y tramos', 'Igual que Excel. Acepta «;» «,» o tabulador y comas decimales (4,4389).'],
      ['Texto pegado', 'WKT, «lat, lon», grados-minutos-segundos', 'Puntos y tramos', 'Usa el botón «Pegar coordenadas».']
    ];
    function descargar(nombre, texto) {
      var url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' })), a = h('a', { href: url, download: nombre });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    }
    function destino(tipo, n, nombreDef) {
      var sel = h('select', { 'aria-label': 'Capa de destino de los ' + (tipo === 'puntos' ? 'puntos' : 'tramos') }), nom = h('input', { type: 'text', value: nombreDef, maxlength: 120, 'aria-label': 'Nombre de la capa nueva' });
      var caps = block.capas.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return x.c.tipo === tipo; });
      var def = cur() && cur().tipo === tipo ? st.capa : (caps[0] ? caps[0].i : -1);
      caps.forEach(function (x) { sel.appendChild(h('option', { value: String(x.i), text: 'En la capa «' + (x.c.nombre || 'sin nombre') + '» (ya tiene ' + (x.c.elementos || []).length + ')', selected: x.i === def })); });
      sel.appendChild(h('option', { value: 'nueva', text: 'En una capa nueva', selected: def < 0 }));
      var fila = h('div', { class: 'dest' }, h('label', {}, h('span', { text: (tipo === 'puntos' ? n.toLocaleString('es-CO') + ' punto(s) van…' : n.toLocaleString('es-CO') + ' tramo(s) van…') }), sel), h('label', { class: 'dest-nom' }, h('span', { text: 'Nombre de la capa nueva' }), nom));
      var sync = function () { fila.querySelector('.dest-nom').hidden = sel.value !== 'nueva'; }; sel.addEventListener('change', sync); sync();
      return { fila: fila, nueva: function () { return sel.value === 'nueva'; }, aplicar: function (items) {
        var cc; if (sel.value === 'nueva') { cc = { nombre: nom.value.trim() || nombreDef, tipo: tipo, color: COLORS[block.capas.length % COLORS.length][0], elementos: [] }; block.capas.push(cc); } else cc = block.capas[Number(sel.value)];
        items.forEach(function (x) { cc.elementos.push(x); }); return cc; } };
    }
    function recibir(r) {
      var res = r.res, np = res.puntos.length, nl = res.lineas.length;
      var fuera = res.puntos.filter(function (p) { return !inIbague(p.lat, p.lon); }).length + res.lineas.filter(function (l) { return !inIbague(l.coords[0][0], l.coords[0][1]); }).length;
      var unico = r.informe.length === 1 ? r.informe[0].archivo.replace(/\.[^.]+$/, '') : '';
      var dP = np ? destino('puntos', np, unico || 'Puntos importados') : null, dL = nl ? destino('lineas', nl, unico || 'Tramos importados') : null;
      var lista = h('ul', { class: 'imp-informe' }, r.informe.map(function (i) {
        return h('li', { class: i.error ? 'err' : 'ok' }, h('b', { text: (i.error ? 'No se pudo: ' : 'Leído: ') + i.archivo }), i.error ? ' — ' + i.error : ' — ' + i.puntos.toLocaleString('es-CO') + ' punto(s), ' + i.lineas.toLocaleString('es-CO') + ' tramo(s)', (i.aviso || []).map(function (a) { return h('div', { class: 'muted', text: a }); }));
      }));
      var cuerpo = h('div', {}, h('p', { class: 'imp-resumen', text: 'Encontré ' + np.toLocaleString('es-CO') + ' punto(s) y ' + nl.toLocaleString('es-CO') + ' tramo(s).' }), lista,
        fuera ? h('p', { class: 'warn', text: 'Atención: ' + fuera.toLocaleString('es-CO') + ' elemento(s) quedan fuera de Ibagué. Si no es lo esperado, revisa que el archivo sea del lugar correcto.' }) : null,
        dP ? dP.fila : null, dL ? dL.fila : null,
        h('p', { class: 'muted', text: 'Después podrás corregir nombres, mover puntos o borrar los que no sirvan.' }));
      UI.modal({ titulo: 'Agregar al mapa', ancho: 'wide', cuerpo: cuerpo, acciones: [{ texto: 'Cancelar' }, { texto: 'Agregar ' + (np + nl).toLocaleString('es-CO') + ' elemento(s)', clase: 'pri', onClick: function () {
        var nuevas = (dP && dP.nueva() ? 1 : 0) + (dL && dL.nueva() ? 1 : 0);
        if (block.capas.length + nuevas > 8) { toast('Un mapa admite hasta 8 capas. Agrega a una capa existente o quita alguna.', 'err'); return false; }
        if (dP) st.capa = block.capas.indexOf(dP.aplicar(res.puntos));
        if (dL) st.capa = block.capas.indexOf(dL.aplicar(res.lineas));
        st.sel = -1; st.pag = 0; st.q = ''; change(); pintarTodo(); drawAll(true); toast('Listo: ' + (np + nl).toLocaleString('es-CO') + ' elemento(s) agregado(s).', 'ok');
      } }] });
    }
    function subirArchivo() {
      var out = h('div', { class: 'imp-out', role: 'status' }), m;
      async function leer(files) {
        if (!files || !files.length) return; out.innerHTML = ''; out.appendChild(h('p', { class: 'muted', text: 'Leyendo los archivos…' }));
        var r = await G.parseFiles(files);
        if (!r.res.puntos.length && !r.res.lineas.length) { out.innerHTML = ''; r.informe.forEach(function (i) { out.appendChild(h('p', { class: 'warn', text: 'Atención: «' + i.archivo + '»: ' + (i.error || 'no encontré puntos ni tramos.') })); }); return; }
        m.close(); recibir(r);
      }
      var inp = h('input', { type: 'file', multiple: true, accept: '.kmz,.kml,.gpx,.geojson,.json,.zip,.shp,.dbf,.prj,.xlsx,.xlsm,.ods,.csv,.tsv,.txt', 'aria-label': 'Archivos con ubicaciones', on: { change: function () { leer(Array.prototype.slice.call(this.files)); this.value = ''; } } });
      var zona = h('label', { class: 'dropzone' }, Ico.el('publicar'), h('b', { text: 'Arrastra aquí tus archivos' }), h('span', { text: 'o haz clic para elegirlos (puedes elegir varios a la vez)' }), inp);
      ['dragenter', 'dragover'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('over'); }); });
      zona.addEventListener('drop', function (e) { leer(Array.prototype.slice.call(e.dataTransfer.files)); });
      var filas = FORMATOS.map(function (f) { return h('tr', {}, h('th', { scope: 'row', text: f[0] }), h('td', { text: f[1] }), h('td', { text: f[2] }), h('td', { text: f[3] })); });
      var tabla = h('div', { class: 'me-scroll' }, h('table', { class: 'me-tabla fmt' }, h('thead', {}, h('tr', {}, h('th', { text: 'Formato' }), h('th', { text: 'De dónde sale' }), h('th', { text: 'Trae' }), h('th', { text: 'Cómo prepararlo' }))), h('tbody', {}, filas)));
      var ejemplo = h('div', { class: 'me-scroll' }, h('table', { class: 'me-tabla fmt' }, h('thead', {}, h('tr', {}, ['nombre', 'detalle', 'lat', 'lon'].map(function (x) { return h('th', { text: x }); }))), h('tbody', {}, h('tr', {}, h('td', { text: 'Semáforo N.° 29' }), h('td', { text: 'Carrera 4 con Calle 25' }), h('td', { text: '4,437179' }), h('td', { text: '-75,228861' })))));
      var ejemploT = h('div', { class: 'me-scroll' }, h('table', { class: 'me-tabla fmt' }, h('thead', {}, h('tr', {}, ['tramo', 'orden', 'lat', 'lon', 'estado'].map(function (x) { return h('th', { text: x }); }))), h('tbody', {}, [['Tramo 1', '1', '4,4401', '-75,2300', 'ejecutado'], ['Tramo 1', '2', '4,4408', '-75,2311', 'ejecutado'], ['Tramo 1', '3', '4,4415', '-75,2322', 'ejecutado']].map(function (f) { return h('tr', {}, f.map(function (x) { return h('td', { text: x }); })); }))));
      var cuerpo = h('div', { class: 'imp' }, zona, out,
        h('details', { open: true }, h('summary', { text: 'Formatos que se pueden subir' }), tabla,
          h('p', { class: 'muted', text: 'Coordenadas: en grados (como las muestra Google Earth) o en MAGNA-SIRGAS (Bogotá, Oeste, Este Central, Origen Nacional/CTM12) y UTM 18N: estas últimas se convierten solas a grados.' }),
          h('p', { class: 'muted', text: 'No se pueden leer: Excel antiguo (.xls: guárdalo como .xlsx), AutoCAD (.dwg/.dxf: exporta a KML o GeoJSON), PDF e imágenes (no traen coordenadas).' })),
        h('details', {}, h('summary', { text: 'Cómo armar la tabla en Excel o CSV' }),
          h('p', { text: 'Para PUNTOS: una fila por punto. Solo «lat» y «lon» son obligatorias; el orden de las columnas no importa.' }), ejemplo,
          h('p', { text: 'Para TRAMOS: una fila por vértice del recorrido. Las filas con el mismo «tramo» forman una línea, en el orden de la columna «orden». «estado» puede ser ejecutado, en curso o pendiente.' }), ejemploT,
          h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn small', text: '⬇ Plantilla de puntos (CSV)', on: { click: function () { descargar('plantilla-puntos.csv', 'nombre;detalle;lat;lon\r\n'); } } }), h('button', { type: 'button', class: 'btn small', text: '⬇ Plantilla de tramos (CSV)', on: { click: function () { descargar('plantilla-tramos.csv', 'tramo;orden;lat;lon;estado;detalle\r\n'); } } }))));
      var EJ = [['ejemplo-puntos.xlsx', 'Excel con puntos'], ['ejemplo-tramos.xlsx', 'Excel con tramos'], ['ejemplo-puntos.ods', 'LibreOffice con puntos'], ['ejemplo-puntos.csv', 'CSV con puntos'], ['ejemplo-tramos.csv', 'CSV con tramos'], ['ejemplo.kmz', 'KMZ (Google Earth)'], ['ejemplo.kml', 'KML'], ['ejemplo.gpx', 'GPX'], ['ejemplo.geojson', 'GeoJSON']];
      cuerpo.appendChild(h('details', {}, h('summary', { text: 'Archivos de ejemplo para descargar' }), h('p', { class: 'muted', text: 'Ábrelos para ver cómo se arma cada formato y úsalos de molde para los tuyos. Sus datos son de mentira.' }), h('ul', { class: 'ejemplos' }, EJ.map(function (e) { return h('li', {}, h('a', { href: 'ejemplos/' + e[0], download: e[0], text: '⬇ ' + e[1] + ' (' + e[0] + ')' })); }))));
      m = UI.modal({ titulo: 'Subir archivos con ubicaciones', ancho: 'wide', cuerpo: cuerpo, acciones: [{ texto: 'Cerrar' }] });
    }
    function pegar() {
      var ta = h('textarea', { rows: 8, placeholder: 'Semáforo 1; 4.437179; -75.228861\nSemáforo 2, 4.440645, -75.229253\n4.441289, -75.231341\nLINESTRING(-75.2300 4.4401, -75.2311 4.4408)', 'aria-label': 'Coordenadas pegadas' });
      UI.modal({ titulo: 'Pegar coordenadas', ancho: 'wide', cuerpo: h('div', {}, h('div', { class: 'help-box' }, h('b', { text: 'Qué puedes pegar' }), h('ul', {},
        h('li', { text: 'Una ubicación por línea: «Nombre; latitud; longitud» (con o sin nombre; separadas por punto y coma, coma o tabulador).' }),
        h('li', { text: 'Coordenadas copiadas de Google Maps o Google Earth: 4.4389, -75.2322' }),
        h('li', { text: 'Grados, minutos y segundos: 4°26\'20"N 75°13\'56"W' }),
        h('li', { text: 'WKT (de QGIS): POINT(-75.23 4.44) o LINESTRING(…)' }),
        h('li', { text: 'Contenido completo de un archivo GeoJSON, KML, GPX o CSV.' }))), ta),
        acciones: [{ texto: 'Cancelar' }, { texto: 'Revisar', clase: 'pri', onClick: function () {
          var r; try { r = G.parsePegado(ta.value); } catch (e) { toast(e.message || 'No reconocí coordenadas. Revisa los ejemplos.', 'err'); return false; }
          if (!r.puntos.length && !r.lineas.length) { toast('No reconocí coordenadas. Revisa los ejemplos.', 'err'); return false; }
          setTimeout(function () { recibir({ res: r, informe: [{ archivo: 'Texto pegado', puntos: r.puntos.length, lineas: r.lineas.length, aviso: r.aviso.slice() }] }); }, 0);
        } }] });
    }

    pintarTodo(); ensureMap();
    return { refresh: function () { if (map) { map.invalidateSize(); drawAll(true); } }, destroy: function () { if (map) { map.remove(); map = null; } } };
  }
  window.SETPMap = { edit: edit };
})();

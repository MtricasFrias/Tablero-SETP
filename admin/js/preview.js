/* Recibe el proyecto desde el panel (misma página de origen) y lo dibuja igual que el sitio público. */
(function () {
  var host = document.getElementById('projects');
  function show(p) {
    var y = window.scrollY; document.body.dataset.cat = p.categoria || 'vias';
    var t = document.createElement('div'); t.innerHTML = SETPRender.page(p); var n = t.firstElementChild; n.classList.add('active');
    host.innerHTML = ''; host.appendChild(n); SETPRender.hydrate(n, p); window.scrollTo(0, y);
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return; var d = e.data || {};
    if (d.tipo === 'proyecto' && d.p) show(d.p);
    else if (d.tipo === 'ir' && /^[\w-]+$/.test(d.id || '')) { var s = document.getElementById('b-' + d.id); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  if (window.parent !== window) window.parent.postMessage({ tipo: 'listo' }, location.origin);
})();

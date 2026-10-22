/* Páginas legales: marca en el índice lateral la sección que se está leyendo. */
(function () {
  'use strict';
  var det = document.querySelector('.doc-toc details'); if (det && window.matchMedia('(max-width:900px)').matches) det.open = false;
  if (det) det.querySelector('summary').addEventListener('click', function (e) { if (window.matchMedia('(min-width:901px)').matches) e.preventDefault(); }); /* en escritorio el índice siempre está abierto */
  var links = [].slice.call(document.querySelectorAll('.doc-toc a')), hs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
  if (!hs.length || !('IntersectionObserver' in window)) return;
  function marca(id) { links.forEach(function (a) { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
  var visibles = {};
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { visibles[e.target.id] = e.isIntersecting; });
    for (var i = 0; i < hs.length; i++) if (visibles[hs[i].id]) { marca(hs[i].id); return; }
  }, { rootMargin: '-72px 0px -62% 0px' });
  hs.forEach(function (h) { io.observe(h); });
  marca(hs[0].id);
})();

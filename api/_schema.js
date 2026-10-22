/* Validación y limpieza de los datos del tablero (el servidor es la autoridad: nada llega al público sin pasar por aquí). */
'use strict';

const CATEGORIAS = ['vias', 'semaforos', 'paraderos'];
const TIPOS = ['kpis', 'progreso', 'datos', 'mapa', 'torta', 'cronograma', 'cifras', 'texto', 'tarjetas', 'destacado', 'galeria', 'documentos'];
const COLORES = ['marino', 'azul', 'ambar', 'verde', 'pino', 'gris'];
const MAX_JSON = 900000;      /* el almacenamiento admite ~1 MB por valor */
const MAX_NODOS = 250000;

const re = { slug: /^[a-z0-9][a-z0-9-]{1,60}$/, bid: /^[A-Za-z0-9_-]{1,24}$/, img: /^[A-Za-z0-9_-]{6,40}$/, src: /^(img|assets)\/[\w./-]+$/, key: /^[A-Za-z_][A-Za-z0-9_]{0,40}$/ };
const ctrl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

class Err extends Error { constructor(m) { super(m); this.status = 400; } }

function walk(v, depth, ctx) {
  if (++ctx.n > MAX_NODOS) throw new Err('El contenido es demasiado grande.');
  if (depth > 14) throw new Err('Estructura demasiado profunda.');
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!isFinite(v)) return null; return v; }
  if (typeof v === 'string') return v.replace(ctrl, '').slice(0, 20000);
  if (Array.isArray(v)) { if (v.length > 6000) throw new Err('Una lista tiene demasiados elementos.'); return v.map(x => walk(x, depth + 1, ctx)); }
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(k => { if (k === '__proto__' || k === 'constructor' || k === 'prototype') return; if (!re.key.test(k)) throw new Err('Campo no permitido: ' + k.slice(0, 30)); o[k] = walk(v[k], depth + 1, ctx); });
    return o;
  }
  return undefined;
}
const s = (v, max) => String(v == null ? '' : v).slice(0, max || 300);
const url = v => (/^https?:\/\/[^\s]+$/i.test(String(v || '')) ? String(v).slice(0, 600) : '');
const nz = v => (v === '' || v === null || v === undefined ? null : (isFinite(Number(v)) ? Number(v) : null));
const r6 = n => Math.round(n * 1e6) / 1e6;

function cleanImagen(im) {
  if (!im || typeof im !== 'object') return null;
  const o = { alt: s(im.alt, 200), pie: s(im.pie, 300), credito: s(im.credito, 200), licencia: s(im.licencia, 120), enlace: url(im.enlace), confirmado: im.confirmado === true };
  if (im.id && re.img.test(String(im.id))) o.id = String(im.id);
  else if (im.src && re.src.test(String(im.src))) o.src = String(im.src);
  else return null;
  return o;
}
const rowsOf = (a, k1, k2) => (Array.isArray(a) ? a : []).map(r => ({ [k1]: s(r && r[k1], 160), [k2]: s(r && r[k2], 600) })).filter(r => r[k1]);

function cleanBlock(b, i) {
  if (!b || typeof b !== 'object' || !TIPOS.includes(b.tipo)) throw new Err('Una sección tiene un tipo no válido.');
  const o = { id: re.bid.test(String(b.id || '')) ? String(b.id) : 'b' + (i + 1) + Math.random().toString(36).slice(2, 5), tipo: b.tipo, titulo: s(b.titulo, 160), subtitulo: s(b.subtitulo, 220), nota: s(b.nota, 2500) };
  switch (b.tipo) {
    case 'kpis': o.tarjetas = (b.tarjetas || []).slice(0, 40).map(c => ({ titulo: s(c.titulo, 120), valor: s(c.valor, 60), unidad: s(c.unidad, 30), nota: s(c.nota, 400), color: COLORES.includes(c.color) ? c.color : 'marino' })).filter(c => c.titulo); break;
    case 'progreso': o.filas = (b.filas || []).slice(0, 60).map(r => ({ nombre: s(r.nombre, 200), porcentaje: nz(r.porcentaje) === null ? null : Math.max(0, Math.min(100, nz(r.porcentaje))), texto: s(r.texto, 120) })).filter(r => r.nombre); break;
    case 'datos': o.tarjetas = (b.tarjetas || []).slice(0, 12).map(c => ({ titulo: s(c.titulo, 120), filas: rowsOf(c.filas, 'etiqueta', 'valor').slice(0, 60), nota: s(c.nota, 1500) })); break;
    case 'torta': o.partes = (b.partes || []).slice(0, 14).map(p => ({ etiqueta: s(p.etiqueta, 120), valor: Math.max(0, nz(p.valor) || 0) })).filter(p => p.etiqueta); break;
    case 'cronograma': o.fases = (b.fases || []).slice(0, 40).map(f => ({ nombre: s(f.nombre, 120), detalle: s(f.detalle, 160), inicio: /^\d{4}-\d{2}-\d{2}$/.test(f.inicio) ? f.inicio : '', fin: /^\d{4}-\d{2}-\d{2}$/.test(f.fin) ? f.fin : '', estado: ['hecho', 'en curso', 'pendiente'].includes(f.estado) ? f.estado : 'pendiente' })).filter(f => f.nombre); break;
    case 'cifras': o.tarjetas = (b.tarjetas || []).slice(0, 24).map(c => ({ valor: s(c.valor, 40), etiqueta: s(c.etiqueta, 200), imagen: cleanImagen(c.imagen) })).filter(c => c.valor); break;
    case 'texto': o.texto = s(b.texto, 12000); o.imagen = cleanImagen(b.imagen); break;
    case 'tarjetas': o.items = (b.items || []).slice(0, 60).map(c => ({ etiqueta: s(c.etiqueta, 40), titulo: s(c.titulo, 160), texto: s(c.texto, 500), dato: s(c.dato, 60), dato_nota: s(c.dato_nota, 80), destacado: !!c.destacado })).filter(c => c.titulo); break;
    case 'destacado': o.etiqueta = s(b.etiqueta, 80); o.destacado_titulo = s(b.destacado_titulo || b.titulo, 160); o.texto = s(b.texto, 1500);
      o.cifras = (b.cifras || []).slice(0, 6).map(c => ({ valor: s(c.valor, 50), texto: s(c.texto, 160) })).filter(c => c.valor);
      o.etiquetas = (b.etiquetas || []).slice(0, 8).map(t => s(t, 80)).filter(Boolean); o.fuente = s(b.fuente, 300); break;
    case 'galeria': o.imagenes = (b.imagenes || []).slice(0, 30).map(cleanImagen).filter(Boolean); break;
    case 'documentos': o.items = (b.items || []).slice(0, 40).map(d => ({ nombre: s(d.nombre, 160), url: url(d.url), detalle: s(d.detalle, 200) })).filter(d => d.nombre && d.url); break;
    case 'mapa': o.capas = (b.capas || []).slice(0, 8).map(c => {
      const tipo = c.tipo === 'lineas' ? 'lineas' : 'puntos';
      const capa = { nombre: s(c.nombre, 120), tipo, color: COLORES.includes(c.color) ? c.color : 'azul', elementos: [] };
      (Array.isArray(c.elementos) ? c.elementos : []).slice(0, 5000).forEach(e => {
        if (!e) return;
        const base = { nombre: s(e.nombre, 160), detalle: s(e.detalle, 300) };
        if (tipo === 'lineas') {
          const cs = (Array.isArray(e.coords) ? e.coords : []).slice(0, 5000).map(q => [nz(q && q[0]), nz(q && q[1])]).filter(q => q[0] !== null && q[1] !== null && Math.abs(q[0]) <= 90 && Math.abs(q[1]) <= 180).map(q => [r6(q[0]), r6(q[1])]);
          if (cs.length >= 2) capa.elementos.push(Object.assign(base, { estado: ['ejecutado', 'en curso', 'pendiente'].includes(e.estado) ? e.estado : 'pendiente', coords: cs }));
        } else {
          const la = nz(e.lat), lo = nz(e.lon);
          if (la !== null && lo !== null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) capa.elementos.push(Object.assign(base, { lat: r6(la), lon: r6(lo) }));
        }
      });
      return capa;
    }).filter(c => c.nombre || c.elementos.length); break;
  }
  return o;
}

function cleanPortada(p) {
  p = p && typeof p === 'object' ? p : {};
  const v = p.valores && typeof p.valores === 'object' ? p.valores : {};
  const et = v.etiquetas && typeof v.etiquetas === 'object' ? v.etiquetas : {};
  return {
    titulo: s(p.titulo, 200), descripcion: s(p.descripcion, 4000),
    chips: (p.chips || []).slice(0, 5).map(c => ({ texto: s(c.texto, 80), tono: ['oscuro', 'azul', 'verde', 'ambar', 'gris'].includes(c.tono) ? c.tono : 'oscuro' })).filter(c => c.texto),
    datos: rowsOf(p.datos, 'etiqueta', 'valor').slice(0, 8),
    valores: { obra: nz(v.obra), interventoria: nz(v.interventoria), nota: s(v.nota, 400), etiquetas: { obra: s(et.obra, 60), interventoria: s(et.interventoria, 60), total: s(et.total, 60) } },
    indicadores: (p.indicadores || []).slice(0, 3).map(i => ({ nombre: s(i.nombre, 40), valor: nz(i.valor) === null ? null : Math.max(0, Math.min(100, nz(i.valor))), texto: s(i.texto, 60) })).filter(i => i.nombre)
  };
}

/* Valida y devuelve una copia limpia del documento completo, o lanza Err con un mensaje comprensible. */
function sanitizeDoc(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.proyectos)) throw new Err('El documento no tiene la forma esperada.');
  if (doc.proyectos.length > 60) throw new Err('Hay demasiados proyectos (máximo 60).');
  const ctx = { n: 0 }; const raw = walk(doc, 0, ctx);
  const ids = new Set();
  const proyectos = raw.proyectos.map(p => {
    if (!re.slug.test(String(p.id || ''))) throw new Err('Un proyecto tiene un identificador no válido.');
    if (ids.has(p.id)) throw new Err('Hay dos proyectos con el mismo identificador: ' + p.id);
    ids.add(p.id);
    if (!CATEGORIAS.includes(p.categoria)) throw new Err('Un proyecto tiene una categoría no válida.');
    const nombre = s(p.nombre, 120).trim(); if (!nombre) throw new Err('Todos los proyectos deben tener nombre.');
    const o = { id: p.id, visible: p.visible !== false, categoria: p.categoria, nombre, fase: s(p.fase, 120), pestana: s(p.pestana, 40), estado: s(p.estado, 40) || 'Por incluir', proximo: !!p.proximo, portada: cleanPortada(p.portada), bloques: [] };
    if (!o.proximo) { if ((p.bloques || []).length > 60) throw new Err('Un proyecto tiene demasiadas secciones (máximo 60).'); o.bloques = (p.bloques || []).map(cleanBlock); }
    return o;
  });
  const out = { version: 1, actualizado: new Date().toISOString(), proyectos };
  if (JSON.stringify(out).length > MAX_JSON) throw new Err('El archivo de datos es demasiado grande. Reduce la cantidad de puntos del mapa o de secciones.');
  return out;
}

module.exports = { sanitizeDoc, cleanImagen, CATEGORIAS, TIPOS, COLORES, Err, MAX_JSON };

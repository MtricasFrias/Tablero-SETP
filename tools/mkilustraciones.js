/* Ilustraciones vectoriales ORIGINALES (sin derechos de terceros) para el componente social.   node tools/mkilustraciones.js → img/ilustracion-*.svg
   Reemplazan imágenes generadas con IA que se mostraban como si fueran fotos reales de la obra. */
'use strict';
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'img');

const fondo = (id, titulo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 60 280 280" role="img" aria-label="${titulo}">
<title>${titulo}</title>
<defs><linearGradient id="cielo${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FB8F0"/><stop offset="1" stop-color="#EAF5FF"/></linearGradient></defs>
<rect width="340" height="340" fill="url(#cielo${id})"/>
<circle cx="272" cy="72" r="28" fill="#FFD76A"/>
<path d="M0 196 C40 150 84 158 130 182 S230 140 340 188 V340 H0Z" fill="#8CC29A"/>
<path d="M0 236 C70 190 140 226 200 212 S300 186 340 230 V340 H0Z" fill="#4E9A62"/>`;

function persona({ id, titulo, piel, pelo, casco, estilo }) {
  const cabello = {
    corto: `<path d="M132 190 C128 160 212 160 208 190 C204 176 196 172 170 172 C144 172 136 176 132 190Z" fill="${pelo}"/>`,
    cola: `<path d="M206 186 C246 190 252 250 226 276 C238 238 222 214 204 206Z" fill="${pelo}"/><path d="M132 192 C130 160 210 160 208 192 C202 178 194 172 170 172 C146 172 138 178 132 192Z" fill="${pelo}"/>`,
    moño: `<circle cx="216" cy="228" r="13" fill="${pelo}"/><path d="M132 192 C130 160 210 160 208 192 C202 178 194 172 170 172 C146 172 138 178 132 192Z" fill="${pelo}"/>`
  }[estilo];
  return fondo(id, titulo) + `
<path d="M62 340 C62 282 108 256 170 256 S278 282 278 340Z" fill="#5C7FA8"/>
<path d="M120 266 L150 340 H92 C92 304 102 280 120 266Z" fill="#F26B21"/><path d="M220 266 L190 340 H248 C248 304 238 280 220 266Z" fill="#F26B21"/>
<path d="M112 290 L140 290 L144 304 L108 304Z" fill="#E8F25A"/><path d="M228 290 L200 290 L196 304 L232 304Z" fill="#E8F25A"/>
<rect x="154" y="226" width="32" height="38" rx="10" fill="${piel}"/>
<ellipse cx="170" cy="204" rx="38" ry="44" fill="${piel}"/>
${cabello}
<path d="M124 190 C124 148 216 148 216 190Z" fill="${casco}"/><rect x="114" y="186" width="112" height="12" rx="6" fill="${casco}"/>
<path d="M146 152 C150 144 190 144 194 152" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
<rect x="124" y="170" width="92" height="7" fill="#FCD116"/><rect x="124" y="177" width="92" height="4" fill="#003893"/><rect x="124" y="181" width="92" height="4" fill="#CE1126"/>
<circle cx="155" cy="212" r="3.4" fill="#2b1d12"/><circle cx="185" cy="212" r="3.4" fill="#2b1d12"/>
<path d="M158 230 C165 237 175 237 182 230" fill="none" stroke="#7a3b22" stroke-width="3.2" stroke-linecap="round"/>
</svg>
`;
}

function inclusion() {
  const fig = (x, piel, ropa) => `<circle cx="${x}" cy="200" r="22" fill="${piel}"/><path d="M${x - 36} 300 C${x - 36} 248 ${x - 18} 228 ${x} 228 S${x + 36} 248 ${x + 36} 300Z" fill="${ropa}"/>`;
  return fondo('i', 'Ilustración: comunidad diversa y unida') + `
${fig(96, '#A9683B', '#2D6CDF')}${fig(244, '#E0AC82', '#00A830')}${fig(170, '#C68B59', '#F0A800')}
<path d="M170 148 C150 128 126 112 126 90 C126 70 156 64 170 84 C184 64 214 70 214 90 C214 112 190 128 170 148Z" fill="#CE1126"/>
</svg>
`;
}

const f = (n, s) => { fs.writeFileSync(path.join(out, n), s); console.log(n, s.length + ' B'); };
f('ilustracion-mano-obra.svg', persona({ id: 'a', titulo: 'Ilustración: trabajador de la región con casco y chaleco', piel: '#C68B59', pelo: '#2b1d12', casco: '#FFC20E', estilo: 'corto' }));
f('ilustracion-mujeres.svg', persona({ id: 'b', titulo: 'Ilustración: mujer trabajadora con casco y chaleco', piel: '#E0AC82', pelo: '#3a2416', casco: '#FFC20E', estilo: 'cola' }));
f('ilustracion-jovenes.svg', persona({ id: 'c', titulo: 'Ilustración: joven trabajador con casco y chaleco', piel: '#A9683B', pelo: '#1d140d', casco: '#F58A1F', estilo: 'moño' }));
f('ilustracion-inclusion.svg', inclusion());

/* Migración: arma data/seed.json (datos iniciales del tablero) con el contenido de las páginas escritas a mano.
   node tools/build-seed.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const geo = JSON.parse(fs.readFileSync(path.join(root, 'tools/partials/data-arrays.json'), 'utf8'));

let _n = 0; const bid = () => 'b' + (++_n);
const kpi = (titulo, valor, unidad, nota, color) => ({ titulo, valor, unidad: unidad || '', nota: nota || '', color: color || 'marino' });
const rows = a => a.map(([etiqueta, valor]) => ({ etiqueta, valor }));
const card = (titulo, filas, nota) => ({ titulo, filas: rows(filas), nota: nota || '' });
const B = {
  kpis: (titulo, subtitulo, tarjetas, nota) => ({ id: bid(), tipo: 'kpis', titulo, subtitulo: subtitulo || '', tarjetas, nota: nota || '' }),
  progreso: (titulo, subtitulo, filas, nota) => ({ id: bid(), tipo: 'progreso', titulo, subtitulo: subtitulo || '', filas: filas.map(([nombre, porcentaje, texto]) => ({ nombre, porcentaje, texto: texto || '' })), nota: nota || '' }),
  datos: (titulo, subtitulo, tarjetas, nota) => ({ id: bid(), tipo: 'datos', titulo, subtitulo: subtitulo || '', tarjetas, nota: nota || '' }),
  torta: (titulo, subtitulo, partes, nota) => ({ id: bid(), tipo: 'torta', titulo, subtitulo: subtitulo || '', partes: partes.map(([etiqueta, valor]) => ({ etiqueta, valor })), nota: nota || '' }),
  cron: (titulo, subtitulo, fases, nota) => ({ id: bid(), tipo: 'cronograma', titulo, subtitulo: subtitulo || '', fases: fases.map(([nombre, detalle, inicio, fin, estado]) => ({ nombre, detalle, inicio, fin, estado })), nota: nota || '' }),
  cifras: (titulo, subtitulo, tarjetas, nota) => ({ id: bid(), tipo: 'cifras', titulo, subtitulo: subtitulo || '', tarjetas, nota: nota || '' }),
  texto: (titulo, subtitulo, texto, imagen, nota) => ({ id: bid(), tipo: 'texto', titulo, subtitulo: subtitulo || '', texto, imagen: imagen || null, nota: nota || '' }),
  tarjetas: (titulo, subtitulo, items, nota) => ({ id: bid(), tipo: 'tarjetas', titulo, subtitulo: subtitulo || '', items, nota: nota || '' }),
  dest: (etiqueta, titulo, texto, cifras, etiquetas, fuente) => ({ id: bid(), tipo: 'destacado', etiqueta, destacado_titulo: titulo, titulo, texto, cifras, etiquetas, fuente }),
  mapa: (titulo, subtitulo, capas, nota) => ({ id: bid(), tipo: 'mapa', titulo, subtitulo: subtitulo || '', capas, nota: nota || '' })
};
const img = (src, alt, extra) => Object.assign({ src, alt, credito: '', licencia: '', enlace: '' }, extra || {});

/* ---- líneas de mapa: se parten en secciones como lo hacía el tablero (el avance se actualiza cambiando el estado) ---- */
const rad = Math.PI / 180;
const largo = c => { let t = 0; for (let i = 1; i < c.length; i++) { const [a1, o1] = c[i - 1], [a2, o2] = c[i], dl = (a2 - a1) * rad, dn = (o2 - o1) * rad; const a = Math.sin(dl / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin(dn / 2) ** 2; t += 2 * 6371000 * Math.asin(Math.sqrt(a)); } return t; };
const partir = (c, n) => { if (n <= 1) return [c]; const p = (c.length - 1) / n, o = []; for (let i = 0; i < n; i++) o.push(c.slice(Math.round(i * p), Math.round((i + 1) * p) + 1)); return o; };
const r5 = c => c.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
const secciones = (f, estados, etiquetaLongitud) => partir(f.coords, f.secciones).map((seg, i) => {
  const m = Math.round(largo(seg) * (f.factor || 1)).toLocaleString('es-CO');
  return { nombre: f.secciones > 1 ? `${f.frente} · Sección ${i + 1} de ${f.secciones}` : f.frente, detalle: `${etiquetaLongitud(f)}: ≈${m} m`, estado: estados[i], coords: r5(seg) };
});

const proyectos = [];

/* =========================== PRÓXIMOS (aún sin página) =========================== */
const proximo = (id, categoria, nombre, fase, pestana) => ({ id, visible: true, categoria, nombre, fase, pestana, estado: 'Por incluir', proximo: true, portada: {}, bloques: [] });
proyectos.push(proximo('av-ferrocarril-disenos', 'vias', 'Av. Ferrocarril', 'Etapa de diseños', 'Av. Ferrocarril'));
proyectos.push(proximo('cra5-fase1', 'vias', 'Carrera Quinta', 'Fase I', 'Cra 5 · Fase I'));

/* =========================== CARRERA QUINTA · FASE II =========================== */
const FR5 = geo.frentesCra5[0]; FR5.factor = 10160 / largo(FR5.coords);
proyectos.push({
  id: 'cra5-fase2', visible: true, categoria: 'vias', nombre: 'Carrera Quinta', fase: 'Fase II · Cl 10 a Cl 58', pestana: 'Cra 5 · Fase II', estado: 'En liquidación',
  portada: {
    titulo: 'Rehabilitación de la Malla Vial de la Carrera Quinta — Fase II',
    descripcion: 'Mejoramiento y rehabilitación de la malla vial de la Carrera Quinta desde la Calle 10 hasta la Calle 58, para la optimización de la infraestructura vial del SETP de Ibagué S.A.S., la cual incluye obras complementarias, diagnóstico y estudios y diseños.',
    chips: [{ texto: 'Contrato de Obra N° 046 · 2025', tono: 'oscuro' }, { texto: '● Terminado · en liquidación', tono: 'verde' }],
    datos: rows([['Longitud intervenida', '10.160 m'], ['Acta de inicio', '10-abr-2025'], ['Fecha de finalización', '18-feb-2026'], ['Ejecución financiera', '$35.399,9 M (100%)']]),
    valores: { obra: 35399.9, interventoria: 2178.6, nota: 'Interventoría: Contrato N.° 042 de 2025 · Consorcio Vías La Quinta (SECOP II). Valor del proyecto = obra + interventoría.' },
    indicadores: [{ nombre: 'EyD', valor: 100, texto: 'Completada' }, { nombre: 'Físico', valor: 100, texto: 'Completado' }, { nombre: 'Financiero', valor: 100, texto: 'Completado' }]
  },
  bloques: [
    B.kpis('Infraestructura', 'Alcance físico · tramos intervenidos · avance por sector', [
      kpi('Corredor intervenido', 'Cl 10 → Cl 58', '', 'Ambos sentidos · 10.160 m de localización y replanteo', 'marino'),
      kpi('Fresado de pavimento', '78.020', 'm²', 'Espesor 15 cm', 'azul'),
      kpi('Bordillo en concreto', '5.628', 'm', 'Vaciado in situ', 'ambar')]),
    B.progreso('Actividades principales de obra', 'Meta física del contrato según el Acta de Terminación de Obra (18-feb-2026)', [
      ['Fresado de la carpeta asfáltica'], ['Reciclado y estabilizado de materiales granulares con emulsión asfáltica y cemento'],
      ['Geomalla biaxial RT100 e imprimación con emulsiones catiónicas (CRL-1 y CRR-1)'], ['Mezclas asfálticas MDC-19 con aditivos mejoradores (AC-30 y PG 76H-22)'],
      ['Renivelación de sumideros y pozos de alcantarillado'], ['Obras complementarias: andenes, isletas y rampas de accesibilidad universal'], ['Señalización y demarcación vial']].map(r => [r[0], null, ''])),
    B.dest('Innovación ingenieril en Ibagué', 'Reciclaje de la estructura existente',
      'En el tramo inicial, de la Calle 10 a la Calle 20, en lugar de demoler y reemplazar todo el pavimento, el material de la vía existente se recicló con maquinaria especializada: se estabilizó con emulsión asfáltica y cemento para construir una base nueva sin excavar, con menos escombros.',
      [{ valor: '3.638 m³', texto: 'de material reciclado · cantidad aprobada' }, { valor: 'Cl 10 – Cl 20', texto: 'Km 0+000 a Km 1+250 (calzada izq.) y a Km 1+000 (calzada der.)' }, { valor: 'Emulsión + cemento', texto: 'mejoran las condiciones mecánicas de la base' }],
      ['Menos excavación y escombros', 'Menor impacto ambiental y social', 'Menos tiempo de obra en el sector'],
      'Fuente: Acta No. 2 de aprobación de ítems no previstos (ítem Np.4), 15 de julio de 2025.'),
    B.tarjetas('Ítems de obra no prevista', 'Acta No. 2 · 15 de julio de 2025. Ocho precios unitarios aprobados por la interventoría y la supervisión, sin adición de valor al contrato (solo prórroga de plazo).', [
      { etiqueta: 'Np.1', titulo: 'Corte de pavimento flexible', texto: 'Juntas perpendiculares entre la estructura nueva y la existente.', dato: '960 ml', dato_nota: '$10.029 / ml' },
      { etiqueta: 'Np.2', titulo: 'Mezcla MDC-19 con asfalto AC-30', texto: 'Ecopetrol dejó de producir el asfalto 60-70.', dato: '6.005 m³', dato_nota: '$1.707.009 / m³' },
      { etiqueta: 'Np.3', titulo: 'Material granular estabilizado MGEA con AC-30', texto: 'Zonas con daño estructural puntual, tipo bacheo en media calzada.', dato: '200 m³', dato_nota: '$1.419.087 / m³' },
      { etiqueta: 'Np.4', titulo: 'Reciclado de material existente con emulsión y cemento', texto: 'Tramo Cl 10 – Cl 20: evita reemplazar toda la estructura.', dato: '3.638 m³', dato_nota: '$865.221 / m³', destacado: true },
      { etiqueta: 'Np.5', titulo: 'Fresado de mezcla asfáltica (incluye transporte hasta 14 km)', texto: 'Se mide por volumen: el espesor cambia según el sector de diseño.', dato: '8.984 m³', dato_nota: '$160.020 / m³' },
      { etiqueta: 'Np.6', titulo: 'Geomalla de fibra de vidrio RT100', texto: 'Mitiga las fisuras reflejadas; recomendada por el especialista en pavimentos.', dato: '94.860 m²', dato_nota: '$26.885 / m²' },
      { etiqueta: 'Np.7', titulo: 'Mezcla MDC-19 modificada con PG 76H-22', texto: 'Mejor comportamiento ante el ahuellamiento y el tráfico pesado.', dato: '5.409 m³', dato_nota: '$1.825.551 / m³' },
      { etiqueta: 'Np.8', titulo: 'Losa de concreto MR42 acelerado a 3 días', texto: 'Nivelación de pozos de alcantarillado.', dato: '36 m³', dato_nota: '$1.444.792 / m³' }]),
    B.progreso('Avance por componente', 'Estado de cada componente de la obra', [
      ['Excavación y movimiento de tierras', 100, 'terminado'], ['Pavimentación', 100, 'terminado'], ['Obras complementarias', 100, 'terminado'], ['Señalización vial', 100, 'terminado']],
      'Acta de Terminación de Obra (18-feb-2026): obra terminada, con 100% de ejecución física y de recursos. Quedaron observaciones técnicas menores por subsanar (microparcheos, juntas, demarcación y remates), que el contratista debía atender en 30 días; el Acta de Recibo Final, con las cantidades definitivas, se firma cuando la interventoría las reciba a satisfacción.'),
    B.mapa('Mapa de avance por tramo', 'Ejecución por secciones del corredor', [
      { nombre: 'Carrera 5 · Cl 10 → Cl 58', tipo: 'lineas', color: 'verde', elementos: secciones(FR5, ['ejecutado', 'ejecutado', 'ejecutado', 'ejecutado'], () => 'Distancia intervención') }],
      'Mapa satelital interactivo (desplazable y con zoom). Haz clic en una sección para ver su nombre, estado de ejecución y longitud.'),
    B.kpis('Plan de Manejo Ambiental', 'Programas por componente · Guía Ambiental UMUS', [
      kpi('A · Gestión socioambiental', '3', 'programas', 'Gestión socioambiental, PIPMA, Plan de Seguimiento', 'marino'),
      kpi('B · Gestión social en obra', '6', 'programas', 'Divulgación, restitución de bienes, atención ciudadana, pedagogía, mano de obra local, equidad de género', 'azul'),
      kpi('C · Manejo silvicultural y paisajismo', '4', 'programas', 'Poda/eliminación y reubicación de árboles, compensación forestal, protección de árboles de permanencia', 'ambar'),
      kpi('D · Gestión ambiental en construcción', '11', 'programas', 'Residuos, materiales, campamentos, maquinaria, aguas, excavaciones, emisiones y ruido, redes, patrimonio cultural', 'pino'),
      kpi('E · Seguridad y salud en el trabajo', '2', 'programas', 'SST y plan de emergencias y contingencias', 'azul'),
      kpi('F · Señalización y manejo de tránsito', '1', 'programa', 'Señalización y manejo de tránsito en obra', 'marino')],
      'Estructura definida conforme a la Guía Ambiental para la Construcción de Infraestructura del Ministerio de Transporte (UMUS). Total: 27 programas en 6 componentes. Incluyó además $487,4 M en obras de mitigación y compensación ambiental, dentro del presupuesto oficial del proyecto.'),
    B.kpis('Recursos financieros', 'Inversión · distribución del presupuesto · garantías', [
      kpi('Presupuesto oficial estimado', '$39.115,9', 'M', 'Techo del proceso licitatorio, antes de la oferta', 'gris'),
      kpi('Contrato de obra', '$35.399,9', 'M', 'N.° 046 · sin adiciones de valor', 'marino'),
      kpi('Contrato de interventoría', '$2.178,6', 'M', 'N.° 042 de 2025 · Consorcio Vías La Quinta', 'azul'),
      kpi('Valor del proyecto', '$37.578,5', 'M', 'Obra + interventoría', 'marino'),
      kpi('Ejecución financiera', '100', '%', 'Según Acta de Terminación', 'verde')],
      'El presupuesto oficial estimado ($39.115,9 M) fue el techo del proceso licitatorio; el contrato de obra se adjudicó por $35.399,9 M y se ejecutó y liquidó sin adiciones de valor. El valor del proyecto suma el contrato de interventoría ($2.178,6 M). Fuente de los recursos: recursos propios del municipio (SECOP II).'),
    B.torta('Distribución del presupuesto', '', [['Pavimentación', 64.3], ['AIU', 22.5], ['Preliminares', 5], ['Obras complementarias y señalización', 4], ['Ambiental + PMT + Diseños', 4.2]],
      'AIU: Administración, Imprevistos y Utilidad (30,7%). PMT: Plan de Manejo de Tránsito.'),
    B.datos('Datos del contrato', 'Partes · presupuesto · garantías', [
      card('Datos del contrato', [['Contratista', 'Consorcio Vías JCSR · NIT 901.904.020-6'], ['Representante legal', 'Juan Camilo Silva Rodríguez'], ['Interventor', 'Consorcio Vías La Quinta'], ['Representante legal interventor', 'Liseth Maryori Nieves Herrera'], ['Supervisor', 'Ximena Alexandra García Castillo'], ['Entidad contratante', 'SETP Ibagué S.A.S.'], ['Integrantes del consorcio', 'Juan Camilo Silva Rodríguez (40%) · Fundante Constructores S.A.S. (60%)'], ['Ordenador del gasto', 'Rocío Lozano Delgado'], ['Contrato de interventoría', 'N.° 042 de 2025 · 18-feb-2025 · 315 días'], ['Fecha del contrato', '19-feb-2025 · firmado en SECOP II el 28-feb-2025']]),
      card('Presupuesto', [['CDP', 'CD5-86 · 14-feb-2025'], ['Registro presupuestal', 'RP4-86 · 6-mar-2025'], ['Proceso SECOP II', 'SETP-LOP-174-2024']]),
      card('Garantías', [['Cumplimiento, salarios, estabilidad y calidad', '$33.629,9 M · Seguros Mundial'], ['Responsabilidad civil extracontractual', '$1.770,0 M · Seguros Mundial']])]),
    B.cron('Cronograma', 'Ejecución completa del contrato', [
      ['Plazo inicial', '255 días calendario', '2025-04-10', '2025-12-21', 'hecho'], ['Prórroga N.° 1', '60 días calendario', '2025-12-21', '2026-02-18', 'hecho']],
      'Acta de inicio: 10-abr-2025. Acta de Terminación de Obra: 18-feb-2026 (315 días calendario en total, incluida la prórroga). Ejecución física y de recursos: 100%. Estado actual: en proceso de liquidación, con el Acta de Recibo Final pendiente.'),
    B.cifras('Componente social', 'Impacto en la comunidad · vinculación de personal', [
      { valor: '529.637', etiqueta: 'Habitantes de Ibagué beneficiados', imagen: img('img/panoramica-ibague.jpg', 'Vista panorámica de Ibagué desde el oriente, con cafetales en primer plano', { credito: 'Duvanlopupa, Wikimedia Commons', licencia: 'CC BY-SA 4.0', enlace: 'https://commons.wikimedia.org/wiki/File:Panorama_Ibague.JPG' }) },
      { valor: '5%', etiqueta: 'Mujeres cabeza de familia / víctimas del conflicto (mín.)', imagen: img('img/ilustracion-mujeres.svg', 'Ilustración: mujer trabajadora con casco y chaleco') },
      { valor: '100%', etiqueta: 'Obligaciones sociales cumplidas', imagen: img('img/ilustracion-inclusion.svg', 'Ilustración: comunidad diversa y unida') }]),
    B.datos('Gestión con la comunidad', '', [card('Gestión con la comunidad', [['Promoción de empleo local', 'Obligación contractual del contratista'], ['Trabajo nocturno programado', 'Para reducir el impacto en la movilidad diurna'], ['Reciclaje de materiales de la vía existente', 'Reduce escombros y reutiliza recursos'],],
      'El contratista informó de manera anticipada a la comunidad sobre los frentes de trabajo y los horarios nocturnos de algunas actividades, y empleó maquinaria que recicla el material de la vía existente para reducir residuos de construcción.')]),
    B.texto('Importancia del corredor', 'Historia · identidad · movilidad de Ibagué',
      'La Carrera Quinta —cuyo nombre oficial es Avenida Campo Serrano, en honor al expresidente José María Campo Serrano— es el eje vial más importante de Ibagué y, según los Estudios Previos del proyecto, el corredor más relevante para el Transporte Público Colectivo de la ciudad.\n\nEs también el hogar de una de las postales más reconocidas del Tolima: sus ocobos (Tabebuia rosea), sembrados desde 1940 y declarados símbolo de Ibagué en el año 2000, que florecen dos veces al año pintando de rosa la ciudad.',
      img('img/ocobos-ibague.jpg', 'Ocobos floreciendo en el centro de Ibagué', { credito: 'Edgar Jiménez', licencia: 'CC BY-SA 2.0', enlace: 'https://commons.wikimedia.org/' }))
  ]
});

/* =========================== AV. AMBALÁ · FASE III =========================== */
const fAm = geo.frentesKML;
proyectos.push({
  id: 'ambala-fase3', visible: true, categoria: 'vias', nombre: 'Av. Ambalá', fase: 'Fase III', pestana: 'Av. Ambalá · Fase III', estado: 'En obra',
  portada: {
    titulo: 'Rehabilitación de la Avenida Ambalá',
    descripcion: 'Mejoramiento y rehabilitación de la malla vial del corredor Ambalá, incluyendo diagnóstico, estudios y diseños, obras complementarias y la optimización de la infraestructura para el transporte público del SETP.',
    chips: [{ texto: 'Contrato de Obra N° 042 · 2026', tono: 'oscuro' }, { texto: '● En ejecución', tono: 'azul' }],
    datos: rows([['Longitud intervenida', '5.007 m'], ['Acta de inicio', '15-abr-2026'], ['Finalización estimada', '26-nov-2026'], ['Ejecución financiera', '$0 (0%)']]),
    valores: { obra: 24408, interventoria: 1570, etiquetas: { total: 'Inversión total' } },
    indicadores: [{ nombre: 'EyD', valor: 100, texto: 'Completada' }, { nombre: 'Físico', valor: 0, texto: 'Por iniciar' }, { nombre: 'Financiero', valor: 0, texto: 'Sin pagos radicados' }]
  },
  bloques: [
    B.kpis('Infraestructura', 'Alcance físico · tramos intervenidos · avance por sector', [
      kpi('Tramo 1 · doble calzada', 'Cra 5 → Cl 37', '', 'Tramo intervenido: 3.526 m (ambas calzadas)', 'marino'),
      kpi('Tramo 2 · calzada ascendente', 'Cl 77 → Cl 63', '', 'Tramo intervenido: 1.481 m (sentido este–oeste)', 'azul'),
      kpi('Fase actual', 'Fase II', '', 'Obra · ✓ Fase I realizada', 'ambar'),
      kpi('Plan de Manejo Ambiental', '27', 'programas', '6 componentes · vigente desde la firma del contrato', 'pino')]),
    B.kpis('Cantidades de intervención', 'Fuente: Formulario 1, Presupuesto Oficial y Propuesta Económica', [
      kpi('Vía a intervenir', '5.007', 'm', 'Longitud total de localización y replanteo', 'marino'),
      kpi('Área a intervenir', '43.939', 'm²', 'Área total de calzada a conformar en ambos tramos', 'azul'),
      kpi('Reposición de redes (estudio)', '≈2.100', 'm', '8 tramos de alcantarillado · Fase I', 'azul')],
      'Las longitudes por tramo se calculan proporcionalmente sobre el trazado georreferenciado del proyecto, ajustadas para sumar la cantidad total contratada. Durante las inspecciones de sumideros y puntos de captación de aguas lluvias realizadas en la Fase I, en trabajo conjunto con IBAL (Empresa Ibaguereña de Acueducto y Alcantarillado — IBAL S.A. E.S.P. Oficial), se identificaron afectaciones importantes en la batea de las tuberías del corredor —asociadas a procesos erosivos y desplazamientos de algunos tramos—, que representan un riesgo para la estabilidad y el comportamiento del pavimento. Se elabora un presupuesto adicional para la reposición de las redes comprometidas, con un valor estimado de $3.449,99 M sobre los 8 tramos identificados.'),
    B.progreso('Avance por componente', '', [['Estudios y diseños (Fase I)', 100, 'completada'], ['Reposición de redes', 0, 'pendiente'], ['Pavimentación', 0, 'pendiente'], ['Andenes y espacio público', 0, 'pendiente']],
      'Estos porcentajes se actualizarán conforme se reciban los reportes de avance de obra y sean aprobados por la interventoría. Fase I entregada (Presentación de gerencia, 21-sep-2026): levantamiento topográfico, diseño geométrico, estudio de suelos para pavimentos, análisis de tránsito, diseño de la estructura de pavimento (rehabilitación), análisis hidrológico e hidráulico, diseño de estructuras de urbanismo (pasos peatonales), cronograma y presupuesto. El 100% de los indicadores corresponde solo a esta fase, que pesa ≈2,4% del contrato ($573,8 M de $24.408 M); todavía no hay pagos radicados.'),
    B.mapa('Mapa de avance por tramo', 'Tramo 1 · Cra 5 → Cl 37 · Tramo 2 · Cl 77 → Cl 63 · Glorietas', [
      { nombre: 'Tramos y glorieta', tipo: 'lineas', color: 'azul', elementos: [].concat(...fAm.map(f => secciones(f, f.estados.map(e => e === 'completado' ? 'ejecutado' : 'pendiente'), x => x.factor ? 'Distancia intervención' : 'Perímetro'))) }],
      'Cada tramo está dividido en 3 secciones de ejecución progresiva. Mapa satelital interactivo (desplazable y con zoom): haz clic en una sección para ver su nombre, estado de ejecución y longitud.'),
    B.kpis('Plan de Manejo Ambiental (PMA) · programas por componente', 'Guía Ambiental UMUS', [
      kpi('A · Gestión socioambiental', '3', 'programas', 'Gestión socioambiental, PIPMA, Plan de Seguimiento', 'marino'),
      kpi('B · Gestión social en obra', '6', 'programas', 'Divulgación, restitución de bienes, atención ciudadana, pedagogía, mano de obra local, equidad de género', 'azul'),
      kpi('C · Manejo silvicultural y paisajismo', '4', 'programas', 'Poda/eliminación y reubicación de árboles, compensación forestal, protección de árboles de permanencia', 'ambar'),
      kpi('D · Gestión ambiental en construcción', '11', 'programas', 'Residuos, materiales, campamentos, maquinaria, aguas, excavaciones, emisiones y ruido, redes, patrimonio cultural', 'pino'),
      kpi('E · Seguridad y salud en el trabajo', '2', 'programas', 'SST y plan de emergencias y contingencias', 'azul'),
      kpi('F · Señalización y manejo de tránsito', '1', 'programa', 'Señalización y manejo de tránsito en obra', 'marino')],
      'Estructura definida conforme a la Guía Ambiental para la Construcción de Infraestructura del Ministerio de Transporte (UMUS). Total: 27 programas en 6 componentes, conforme al Plan Básico de Manejo Ambiental del proyecto. La selección definitiva de los programas aplicables está a cargo del contratista y se aprueba junto con la interventoría en la Fase I.'),
    B.kpis('Recursos financieros', 'Inversión · distribución del presupuesto · ejecución', [
      kpi('Contrato de obra', '$24.408', 'M', '13.940 SMMLV (2025)', 'marino'), kpi('Contrato de interventoría', '$1.570', 'M', 'Consorcio Interambalá', 'ambar'),
      kpi('Inversión total', '$25.978', 'M', 'Obra + interventoría', 'marino'), kpi('Fase I · EyD (obra)', '$573,8', 'M', 'Pago único al aprobar', 'azul'),
      kpi('Fase I · EyD (interventoría)', '$562,1', 'M', 'Etapa I del contrato · 35,8% de la interventoría', 'azul'), kpi('Ejecutado financiero', '0', '%', '', 'verde')]),
    B.torta('Distribución del presupuesto', '', [['Estructura de pavimento', 88.1], ['Diseños', 3.3], ['Ambiental + PMT', 3.2], ['Preliminares, andenes y señalización', 5.4]], 'PMT: Plan de Manejo de Tránsito durante la obra. Ambiental: incluye el Plan de Manejo Ambiental (PMA).'),
    B.datos('Estructura de pagos del contrato', '', [card('Estructura de pagos del contrato', [['Fase I · pago único al aprobar diseños', '2,4%'], ['Fase II · actas parciales de obra', '92,6%'], ['Liquidación del contrato · saldo final', '5%']],
      'Estos porcentajes corresponden a la evidencia contractual (cláusula de forma de pago, Contrato de Obra N.° 042 de 2026). Pagado a la fecha: $0 (0%).')]),
    B.datos('Datos del contrato', 'Partes · presupuesto y garantías', [
      card('Datos del contrato', [['Contratista', 'Consorcio Malla Vial Ambalá · NIT 902.022.680-5'], ['Representante legal', 'Juan Camilo Silva Rodríguez'], ['Interventor', 'Consorcio Interambalá'], ['Representante legal interventor', 'Carlos Andrés González Clavijo'], ['Supervisor', 'Carlos Fernando Gutiérrez Gamboa · Director Operativo'], ['Entidad contratante', 'SETP Ibagué S.A.S.'], ['Fecha del contrato', '21-ene-2026 · firmado en SECOP II el 27-ene-2026'], ['Contrato de interventoría', 'N.° 043 de 2026 · $1.570,4 M · 255 días (hasta 25-dic-2026)'], ['Ordenador del gasto (interventoría)', 'Rocío Lozano Delgado'], ['Procesos SECOP II', 'Obra CO1.BDOS.9074594 · Interventoría CO1.BDOS.9101057'], ['Acta de inicio', '15-abr-2026']]),
      card('Presupuesto y garantías', [['CDP', 'CD6-000000076'], ['Registro presupuestal', 'RP5-94 · 13-feb-2026'], ['Póliza de cumplimiento', 'No. 101858-0 · Berkley Internacional Seguros'], ['Póliza resp. civil extracontractual', 'No. 29502-0 · Berkley Internacional Seguros'], ['Garantías expedidas', '29-ene-2026'], ['Garantías aprobadas', '23-feb-2026']])]),
    B.cron('Cronograma', 'Fases del contrato · línea de tiempo · hitos', [
      ['Fase I — Estudios y diseños', '90 días calendario', '2026-04-15', '2026-07-14', 'hecho'], ['Fase II — Ejecución de obra', '135 días · por tramos', '2026-07-14', '2026-11-26', 'en curso']], 'Tiempo pactado: 225 días calendario.'),
    B.cifras('Componente social', 'Empleo local · inclusión · comunidad', [
      { valor: '10%', etiqueta: 'Mano de obra regional (mín.)', imagen: img('img/obra-via-colombia.jpg', 'Trabajador abriendo concreto con martillo demoledor en una obra de andén en Colombia', { pie: 'Imagen ilustrativa', credito: 'Hk6rsf, Wikimedia Commons', licencia: 'Dominio público', enlace: 'https://commons.wikimedia.org/wiki/File:Colombia_Jackhammer_01.jpg' }) },
      { valor: '5%', etiqueta: 'Mujeres (de mano de obra)', imagen: img('img/ilustracion-mujeres.svg', 'Ilustración: mujer trabajadora con casco y chaleco') },
      { valor: '5%', etiqueta: 'Población especial protección', imagen: img('img/ilustracion-inclusion.svg', 'Ilustración: comunidad diversa y unida') },
      { valor: '8%', etiqueta: 'Jóvenes 18–28 años', imagen: img('img/ilustracion-jovenes.svg', 'Ilustración: joven trabajador con casco y chaleco') }], 'Obligaciones contractuales de vinculación de personal. Vinculación de personal, meta vs. reportado: mano de obra no calificada de la región, mujeres y sujetos de especial protección — personal aún sin vincular.'),
    B.texto('Importancia del corredor', 'Movilidad · conectividad de Ibagué',
      'El Sistema Estratégico de Transporte Público (SETP) de Ibagué se apoya en los corredores viales más importantes de la ciudad para conectar barrios y sectores con el centro. La Avenida Ambalá es uno de esos corredores estructurantes: conecta barrios del norte y el sector de El Salado con el centro de la ciudad, articulando zonas residenciales, comerciales e institucionales a lo largo de su trazado.\n\nSu ampliación en 1991, entre el puente de Progal y San Carlos, redujo el tiempo de viaje entre El Salado y el centro de 16 a cerca de 10–12 minutos. Hoy, rehabilitar su infraestructura y redes para el SETP busca modernizar ese mismo corredor y sostener la movilidad de la ciudad en las próximas décadas.',
      img('img/glorieta-ambala.jpg', 'Glorieta de la Avenida Ambalá, Ibagué'))
  ]
});

/* =========================== SEMAFORIZACIÓN =========================== */
const ptsI = geo.semFaseI.map(([n, nombre, lat, lon]) => ({ nombre: `N.° ${n} · ${nombre}`, detalle: 'Fase I · finalizada', lat, lon }));
const ptsII = geo.semFaseII.map(([n, nombre, lat, lon, ref]) => ({ nombre: `N.° ${n} · ${nombre}`, detalle: (ref ? ref + ' · ' : '') + 'Fase II · en estructuración', lat, lon }));
proyectos.push({
  id: 'semaforos-fase1', visible: true, categoria: 'semaforos', nombre: 'Semaforización', fase: 'Fase I', pestana: 'Semaforización · Fase I', estado: 'Finalizado',
  portada: {
    titulo: 'Modernización de la Red Semafórica de Ibagué — Fase I',
    descripcion: 'Suministro, obra e instalación para la puesta en funcionamiento de la Fase I de la red semafórica del municipio de Ibagué, la cual incluye obras civiles de subterranización.',
    chips: [{ texto: 'Contrato de Obra N° 117 · 2024', tono: 'oscuro' }, { texto: '● Finalizado', tono: 'verde' }],
    datos: rows([['Cobertura de la red semafórica', '36%'], ['Intersecciones', '34'], ['Acta de inicio', '20-feb-2025'], ['Finalización', '29-sep-2026'], ['Ejecución financiera', '$0 (0%)']]),
    valores: { obra: 8946.6, interventoria: 832.1 },
    indicadores: [{ nombre: 'EyD', valor: 100, texto: 'Completada' }, { nombre: 'Físico', valor: 100, texto: 'Completado' }, { nombre: 'Financiero', valor: 0, texto: 'Sin pagos radicados' }]
  },
  bloques: [
    B.kpis('Alcance técnico', 'Semáforos · cámaras · controladores · subterranización', [
      kpi('Semáforos', '603', '/ 603', 'Instalados / proyectados. Incluye semáforos vehiculares, peatonales y para bicicletas.', 'marino'),
      kpi('Cámaras de tráfico', '26', '/ 26', 'Instaladas / proyectadas. Cámaras de detección de tráfico semiactuado (vehículos y peatones).', 'azul'),
      kpi('Controladores', '28', '/ 28', 'Instalados / proyectados', 'ambar')],
      'El 36% de cobertura corresponde a las 34 intersecciones de esta Fase I frente al total de la red semafórica de la ciudad de Ibagué (no solo las rutas del SETP). Las dos fases restantes cubrirán el 64% de intersecciones faltante.'),
    B.kpis('Estado de las intersecciones', '', [
      kpi('Intersecciones en funcionamiento', '34', '/ 34', 'Con puesta en servicio y seguimiento · 28 controladores manejan las 34 intersecciones', 'verde'),
      kpi('Pendientes de puesta en servicio', '0', '', 'Las 34 intersecciones ya están en funcionamiento', 'verde')]),
    B.progreso('Avance por componente', '', [['Semáforos instalados', 100, '· 603/603'], ['Cámaras de tráfico instaladas', 100, '· 26/26'], ['Controladores instalados', 100, '· 28/28'], ['Postes instalados', 100, '· 254/254']],
      'Proyecto finalizado según la Dirección Operativa del SETP (26-sep-2026): todos los componentes están al 100% y el avance físico es del 100%. El dispositivo sonoro se reemplazó por la meta de push button. El avance financiero (pagos radicados) es 0% según la Presentación de gerencia del 21 de septiembre de 2026. Seguimiento de la Dirección Operativa (25-sep-2026): al corte del 6 de septiembre el avance era 92,97% frente a 92,26% programado; al 20 de septiembre, 93,62% frente a 96,13% (−2,51 puntos), con 30 de las 34 intersecciones en servicio y seguimiento. Para el cierre contractual y la liquidación se hace seguimiento a los informes mensuales del Plan de Manejo Ambiental (componentes ambiental, social y SST) ante la interventoría.'),
    B.datos('Corredores e intersecciones semaforizadas', '', [card('Corredores e intersecciones semaforizadas', [['Carrera 5', 'Calle 21 a Calle 100 · 12 intersecciones'], ['Av. Ferrocarril', 'Calle 23 a Calle 42 · 7 intersecciones'], ['Av. Ambalá', 'Calle 25 a Calle 96 · 5 intersecciones'], ['Carrera 6', 'Calle 25 a Calle 42 · 4 intersecciones'], ['Av. Guabinal', 'Calle 29 a Calle 64 · 4 intersecciones'], ['Carrera 4 (Sector Estadio)', 'Calle 25 y Calle 42 · 2 intersecciones']],
      'Total: 34 intersecciones en 6 corredores, según listado oficial de localización de la Fase I.')]),
    B.kpis('Cantidades contratadas de obra civil (subterranización)', '', [
      kpi('Tubería eléctrica 3"', '8.843', 'm', 'PVC TDP', 'azul'), kpi('Canalización dirigida', '3.442', 'm', 'PVC TDP 3"', 'azul'),
      kpi('Cajas de inspección', '295', 'und', '90x90x80 cm', 'azul'), kpi('Andén reconstruido', '2.478', 'm²', 'Concreto 3000 PSI', 'azul')], 'Cantidades del Formulario 1 del presupuesto oficial del proceso.'),
    B.kpis('Localización de las intersecciones', 'KMZ oficiales · Fase I finalizada y Fase II en estructuración', [
      kpi('Fase I · Finalizada', '34', 'intersecciones', 'Contrato de obra N.° 117 de 2024 · obra $8.946,6 M + interventoría $832,1 M', 'verde'),
      kpi('Fase II · En estructuración', '40', 'intersecciones', 'Obra $11.525,1 M · interventoría $990,2 M · ubicación en el KMZ «Semáforos 2026.08»', 'gris'),
      kpi('Fase III · Presupuestada', 'Sin ubicación', '', 'Obra $8.509,9 M · interventoría $851,0 M · ejecución prevista en 2027', 'gris')]),
    B.mapa('Mapa de las intersecciones', '', [
      { nombre: 'Fase I · finalizada (33 georreferenciadas)', tipo: 'puntos', color: 'verde', elementos: ptsI },
      { nombre: 'Fase II · en estructuración', tipo: 'puntos', color: 'ambar', elementos: ptsII }],
      'Mapa satelital interactivo (desplazable y con zoom) con la ubicación de las intersecciones según los KMZ oficiales. Activa o desactiva cada fase con las casillas de arriba y haz clic en un punto para ver su número y su nombre. La Fase III todavía no tiene ubicación.'),
    B.kpis('Recursos financieros', 'Inversión · distribución del presupuesto · forma de pago', [
      kpi('Contrato de obra', '$8.946,6', 'M', 'Contrato de Obra N.° 117', 'marino'), kpi('Contrato de interventoría', '$832,1', 'M', 'Consorcio Inter Semafóricas Ibagué · N.° 188 · 2024', 'ambar'),
      kpi('Valor del proyecto', '$9.778,7', 'M', 'Obra + interventoría', 'marino'), kpi('Desembolsado a la fecha', '$0', '', 'Sin actas de pago radicadas', 'azul'), kpi('Ejecutado financiero', '0', '%', 'Sin actas de pago radicadas', 'verde')],
      'Presupuesto oficial del proceso (SECOP II): obra $9.459,8 M, contratada por $8.946,6 M; interventoría $631,8 M, con valor vigente de $832,1 M tras las modificaciones del contrato (+$200,3 M).'),
    B.torta('Distribución del presupuesto', '', [['Suministro de tecnología', 54.3], ['Obra civil (subterranización)', 40.7], ['Instalación de tecnología', 3.5], ['PMT', 0.8], ['PMA', 0.7]], 'Distribución del presupuesto oficial de $9.459,8 M (Formulario 1). PMT: Plan de Manejo de Tránsito. PMA: Plan de Manejo Ambiental.'),
    B.datos('Forma de pago', '', [card('Forma de pago', [['Pagos parciales por avance físico de obra', '$0 pagado (tope: 95%)'], ['Pago final al recibo y liquidación', '0% (aplica al terminar la obra)']],
      'Este contrato no contempló pago de anticipo. Se le paga al contratista a medida que entrega tramos de obra terminados y verificados por la interventoría, y de cada pago la Entidad retiene el 10% como garantía (9,5% acumulado), el cual se libera junto con el pago final del 5% al terminar y liquidar la obra. A la fecha no se han radicado actas de pago.')]),
    B.datos('Datos del contrato', 'Partes · presupuesto y garantías', [
      card('Datos del contrato', [['Contratista', 'Unión Temporal Ibagué Smart City · NIT 901.865.790-0'], ['Representante legal', 'Renzo Antonio Serrano Ojeda · Randley S.A.S.'], ['Interventor', 'Consorcio Inter Semafóricas Ibagué · Contrato N.° 188 · 2024'], ['Representante legal interventor', 'Luis Eduardo Gómez Segura'], ['Supervisor', 'Carlos Fernando Gutiérrez Gamboa · Director Operativo'], ['Entidad contratante', 'SETP Ibagué S.A.S.'], ['Ordenador del gasto', 'Aquileo Medina Arteaga'], ['Fecha del contrato', '11-sep-2024 · selección abreviada de menor cuantía (SETP-SAMC-061-2024)'], ['Plazo', '540 días + 347 días adicionados'], ['Contrato de interventoría', 'N.° 188 de 2024 · 31-dic-2024 · 540 días + 152 adicionados'], ['Procesos SECOP II', 'Obra CO1.BDOS.5948544 · Interventoría CO1.BDOS.6826399'], ['Plazo de liquidación', '30-sep-2026 a 29-mar-2027'], ['Acta de inicio', '20-feb-2025'], ['Finalización vigente', '29-sep-2026']]),
      card('Presupuesto y garantías', [['CDP', 'CD5-78 · 11-feb-2025'], ['Registro presupuestal', 'RP4-56 · 11-feb-2025'], ['Póliza de cumplimiento', 'No. 400-47-994000102518'], ['Póliza complementaria', 'No. 400-74-994000025977']])]),
    B.texto('¿Por qué son importantes los semáforos tecnológicos?', 'Seguridad vial · fluidez del tráfico',
      'Los sistemas de semaforización inteligente usan sensores y controladores que miden el tráfico en tiempo real y ajustan los tiempos de los semáforos según el flujo vehicular y peatonal, en lugar de tiempos fijos preestablecidos. Al coordinar semáforos contiguos se generan "olas verdes" que permiten recorrer varias cuadras sin detenerse, reduciendo tiempos de viaje y consumo de combustible.\n\nDiversos estudios internacionales de implementación de semaforización inteligente reportan reducciones de hasta el 30–50% en accidentes con víctimas en las intersecciones intervenidas, además de menores tiempos de viaje y una operación más eficiente de las vías. Modernizar la red semafórica de Ibagué busca ese mismo objetivo: intersecciones más seguras y una ciudad que se mueve mejor.',
      img('img/semaforo-real-ibague.jpg', 'Semáforo con conteo regresivo y señal peatonal, Ibagué'))
  ]
});

proyectos.push({
  id: 'semaforos-fase2', visible: true, categoria: 'semaforos', nombre: 'Semaforización', fase: 'Fase II', pestana: 'Semaforización · Fase II', estado: 'En estructuración',
  portada: {
    titulo: 'Modernización de la Red Semafórica de Ibagué — Fase II',
    descripcion: 'Segunda fase de la modernización de la red semafórica del municipio de Ibagué: 40 intersecciones, distintas de las 34 de la Fase I, ubicadas en el KMZ oficial «Semáforos 2026.08».',
    chips: [{ texto: '● En estructuración', tono: 'ambar' }],
    datos: rows([['Intersecciones', '40'], ['Ejecución financiera', 'Sin iniciar']]),
    valores: { obra: 11525.1, interventoria: 990.2, etiquetas: { obra: 'Presupuesto de obra', interventoria: 'Presupuesto de interventoría', total: 'Valor estimado' } },
    indicadores: [{ nombre: 'Físico', valor: 0, texto: 'No iniciado' }, { nombre: 'Financiero', valor: 0, texto: 'Sin pagos radicados' }]
  },
  bloques: [
    B.datos('Datos del contrato', 'Partes · fechas · presupuesto', [
      card('Datos del contrato', [['Estado', 'En estructuración · corte 29 de septiembre de 2026'], ['Entidad contratante', 'SETP Ibagué S.A.S.'], ['Proceso en SECOP II', 'Aún no publicado (consulta del 20-oct-2026)']]),
      card('Recursos financieros', [['Presupuesto de obra', '$11.525,1 M'], ['Presupuesto de interventoría', '$990,2 M'], ['Valor estimado del proyecto', '$12.515,3 M'], ['Pagos radicados', '$0 · 0%']], 'Fuente: Presentación de proyectos del SETP. Son presupuestos, no valores contratados: la Fase II aún no tiene contrato de obra.')]),
    B.mapa('Localización de las 40 intersecciones', 'KMZ oficial «Semáforos 2026.08»', [
      { nombre: 'Fase II · en estructuración', tipo: 'puntos', color: 'ambar', elementos: ptsII },
      { nombre: 'Fase I · finalizada (de referencia)', tipo: 'puntos', color: 'verde', elementos: ptsI }],
      'Mapa satelital interactivo (desplazable y con zoom). Haz clic en un punto para ver su número y su nombre; los sitios de referencia (Mercacentro Ricaurte, Fiscalía, Surtiplaza, entre otros) aparecen en el popup.')
  ]
});
proyectos.push(proximo('semaforos-fase3', 'semaforos', 'Semaforización', 'Fase III', 'Fase III'));

/* =========================== PARADEROS =========================== */
proyectos.push(proximo('paraderos-tipo1', 'paraderos', 'Paraderos Tipo I', 'Cubierto, con informador electrónico', 'Paraderos Tipo I'));
proyectos.push(proximo('paraderos-tipo2', 'paraderos', 'Paraderos Tipo II', 'Cubierto, con mobiliario y bandera', 'Paraderos Tipo II'));
proyectos.push({
  id: 'paraderos-tipo3', visible: true, categoria: 'paraderos', nombre: 'Paraderos Tipo III', fase: 'Bandera informativa · 1.150 señales', pestana: 'Paraderos Tipo III', estado: 'En liquidación',
  portada: {
    titulo: 'Suministro e Instalación de Paraderos Tipo III',
    descripcion: 'Suministro e instalación de 1.150 señales verticales tipo banderín (paraderos tipo III) del Sistema Estratégico de Transporte Público de Ibagué, en corredores principales y barrios de la ciudad, incluidas obras de mejoramiento de andenes.',
    chips: [{ texto: 'Contrato de Obra N° 037 · 2025', tono: 'oscuro' }, { texto: '● Obra terminada — falta liquidar', tono: 'verde' }],
    datos: rows([['Paraderos instalados', '1.150 / 1.150'], ['Acta de inicio', '7-may-2025'], ['Fecha de finalización', '28-feb-2026'], ['Ejecución financiera', '≈$7.810,5 M (95%)']]),
    valores: { obra: 8221.6, interventoria: 1119.9, etiquetas: { total: 'Inversión total' } },
    indicadores: [{ nombre: 'EyD', valor: 100, texto: 'Completada' }, { nombre: 'Físico', valor: 100, texto: 'Completado' }, { nombre: 'Financiero', valor: 95, texto: 'En liquidación' }]
  },
  bloques: [
    B.kpis('Alcance técnico', 'Señal vertical tipo banderín · andenes · accesibilidad', [
      kpi('Señales instaladas', '1.150', '/ 1.150', '100% · 1.106 instaladas durante la ejecución; las 44 restantes se completaron antes del cierre del contrato', 'verde'),
      kpi('Tipologías de señal', '889 + 261', '', 'Tipo 1 (1-5 rutas) + Tipo 2 (6-14 rutas)', 'azul'),
      kpi('Andenes (cantidad contratada)', '8.940', 'm²', 'Concreto 3000 PSI · espesor 10 cm', 'ambar')],
      'Estructura metálica sobre pedestal en concreto, con módulo braille y lámina reflectiva certificada. Vida útil mínima: 15 años. Cobertura: las 13 comunas de Ibagué, en corredores como Av. Ambalá, Carrera Quinta, Av. Ferrocarril y Av. Guabinal.'),
    B.progreso('Avance por componente', '', [['Fabricación y suministro de señalización', 100, '· 1.150/1.150'], ['Instalación en sitio', 100, '· 1.150/1.150'], ['Obras civiles de andenes y bordillos', 100, 'cumplimiento contractual']],
      'Proyecto en proceso de liquidación, con 100% de ejecución según las actividades, cantidades y obligaciones contempladas en el contrato.'),
    B.mapa('Mapa de paraderos instalados', 'Georreferenciación oficial · un punto por paradero', [
      { nombre: 'Paraderos georreferenciados', tipo: 'puntos', color: 'verde', elementos: geo.paraderos.map(([id, lat, lon]) => ({ nombre: 'Paradero ' + id, lat, lon })) }],
      'Mapa satelital interactivo (desplazable y con zoom) con la ubicación de 1.063 de los 1.150 paraderos, según el archivo de georreferenciación entregado por el contratista. Haz clic en un punto para ver su número de paradero. Los puntos restantes se incorporarán cuando se reciba su georreferenciación.'),
    B.kpis('Mantenimiento y garantía', 'Seguimiento posterior a la instalación · garantía de estabilidad 5 años', [
      kpi('Paraderos con mantenimiento', '940', '/ 1.150', 'Arreglos y recuperación de estructura', 'azul'), kpi('Refuerzo de soldaduras', '33', '', 'Estructuras con trabajos de mayor profundidad', 'ambar'),
      kpi('Afectaciones por golpes/daños', '18', '', 'En seguimiento y evaluación', 'marino'), kpi('Sustracción reportada', '1', '', 'Registrada como condición externa a la obra', 'gris')],
      'Entre el 28 de mayo y el 18 de agosto de 2026 se ejecutaron labores de mejoramiento, mantenimiento y recuperación sobre los paraderos Tipo III instalados: protección de elementos metálicos frente a la humedad (tratamiento de juntas, uniones, soldaduras y puntos de fijación para reducir oxidación y corrosión), nivelación y adecuación de apoyos y bases, extracción de agua acumulada, y limpieza general de estructuras. El contratista responde por la estabilidad de la obra durante 5 años contados desde el acta de recibo final.'),
    B.kpis('Plan de Manejo Ambiental y de Tránsito', 'Programas por componente · PMA + PMT', [
      kpi('A · Gestión socioambiental', '3', 'programas', 'Gestión socioambiental, PIPMA, seguimiento', 'marino'),
      kpi('B · Gestión social en obra', '6', 'programas', 'Divulgación, restitución de bienes, atención ciudadana, pedagogía ambiental, mano de obra, equidad de género', 'azul'),
      kpi('D · Gestión ambiental en construcción', '5', 'programas', 'Demoliciones/escombros, materiales, maquinaria, aseo y estructuras, emisiones y ruido', 'pino'),
      kpi('E · Seguridad y salud en el trabajo', '2', 'programas', 'SST y plan de emergencias y contingencias', 'azul'),
      kpi('F · Señalización y accesos viales', '1', 'programa', 'Señalización y manejo de accesos en obra', 'marino'),
      kpi('Plan de Manejo de Tránsito', 'Categoría I', '', 'Interferencias mínimas · sin cierres totales ni desvíos', 'ambar')],
      'Estructura definida conforme a la Guía Ambiental para la Construcción de Infraestructura del Ministerio de Transporte. Al ser una obra de señalización puntual (sin remoción de cobertura vegetal ni afectación a arbolado), no aplica el componente de manejo silvicultural. Total: 17 programas en 5 componentes. En la matriz de impactos, el efecto positivo más alto identificado fue el cambio en las dinámicas de uso del transporte público (muy importante); los impactos negativos más relevantes correspondieron al manejo y disposición de residuos de demolición y de residuos peligrosos, mitigados mediante gestión de escombros en escombrera autorizada por Cortolima.'),
    B.kpis('Recursos financieros', 'Inversión · distribución del presupuesto · garantías', [
      kpi('Presupuesto oficial estimado', '$9.119,0', 'M', 'Techo del proceso licitatorio', 'gris'), kpi('Valor adjudicado (obra)', '$8.221,6', 'M', 'Contrato de Obra N.° 037', 'marino'),
      kpi('Contrato de interventoría', '$1.119,9', 'M', 'N.° 038 · 2025 · Velnec S.A.', 'azul'), kpi('Avance financiero', '95', '%', 'Sobre el contrato de obra', 'verde')]),
    B.torta('Distribución del presupuesto (obra)', '', [['Fabricación e instalación de señalización', 56.8], ['Obra pública (andenes, bordillos y cimentación)', 43.2]],
      'Componente de obra pública (demolición, andenes, bordillos y cimentación) sin IVA, según lo dispuesto en el artículo 100 de la Ley 21 de 1992. Componente de señalización, con IVA incluido.'),
    B.datos('Datos del contrato', 'Partes · forma de pago · garantías', [
      card('Datos del contrato', [['Contratista', 'Consorcio Paraderos 25 · NIT 901.904.171-1'], ['Representante legal', 'Juan Carlos Ramírez Ospina'], ['Interventor', 'Velnec S.A. · Contrato N.° 038 · 2025'], ['Supervisor', 'Freddy Mauricio Peralta Delgado · Director Operativo'], ['Ordenador del gasto', 'Aquileo Medina Arteaga'], ['Entidad contratante', 'SETP Ibagué S.A.S.'], ['Fecha del contrato', '13-feb-2025'], ['Proceso SECOP II', 'SETP-LOP-172-2024 · CO1.BDOS.7068723 · firmado el 28-feb-2025'], ['Representante legal interventor', 'Paula Andrea Martínez Mora'], ['Supervisor (contrato de interventoría)', 'Diana Patricia Buenaventura Jiménez']]),
      card('Forma de pago', [['Pagado', '95%'], ['Pendiente (contra liquidación)', '5%'], ['Pagos parciales mensuales por avance de obra', 'Tope: 95% del valor del contrato'], ['Pago final', '5% restante, contra liquidación']], 'Este contrato no contempló pago de anticipo. Estampillas descontadas del primer pago: 1,5% Pro-Cultura + 2% Pro-Bienestar del Adulto Mayor + 0,5% Pro-Universidad del Tolima (antes de IVA).'),
      card('Garantías', [['Cumplimiento general', '20% del valor del contrato'], ['Salarios y prestaciones sociales', '5% del valor del contrato'], ['Estabilidad y calidad de la obra', '20% · vigencia 5 años'], ['Calidad del servicio y de los bienes', '20% cada una · vigencia 2 y 5 años'], ['Responsabilidad civil extracontractual', '5% · vigencia del contrato']])]),
    B.cron('Cronograma', 'Ejecución completa del contrato', [['Preconstrucción', 'máx. 15 días calendario', '2025-05-07', '2025-05-22', 'hecho'], ['Construcción y entrega', '299 días calendario', '2025-05-07', '2026-02-28', 'hecho']], 'Duración total: 299 días calendario (7-may-2025 → 28-feb-2026).'),
    B.cifras('Vinculación de mano de obra y gestión social', 'Empleo local · equidad de género · atención al usuario', [
      { valor: '50%', etiqueta: 'Mano de obra no calificada de la región (mínimo)' }, { valor: '10%', etiqueta: 'Mujeres, del total de mano de obra (mínimo)' }, { valor: '5%', etiqueta: 'Madres cabeza de hogar, de las mujeres vinculadas (mínimo)' },
      { valor: '10%', etiqueta: 'Reserva de puestos para mujeres y grupos minoritarios (cuota)' }, { valor: '40%', etiqueta: 'Personal colombiano (mínimo)' }], 'Cuotas de vinculación laboral — obligaciones contractuales.'),
    B.texto('Importancia de los paraderos', 'Ascenso y descenso ordenado · accesibilidad · flujo vehicular',
      'Antes de este proyecto, el Sistema Público Colectivo de Ibagué carecía de puntos de parada ordenados: los usuarios abordaban y descendían en cualquier lugar de la vía, generando maniobras inseguras y afectando el flujo vehicular. Los 1.150 paraderos Tipo III definen puntos fijos de ascenso y descenso, adaptados a las condiciones de personas con movilidad reducida o discapacidad, en los corredores por donde transita el sistema.\n\nSegún el estudio de referencia del proyecto (Findeter, 2018), organizar las paradas de esta manera reduce en 78% los tiempos de espera de los usuarios, aumenta en 71% la velocidad de los corredores y reduce en 21% la longitud de las colas de buses en vía, en beneficio de cerca de 541.000 habitantes y 225.000 viajes diarios en la ciudad.',
      img('img/paradero-carrera5-vertical.jpg', 'Paradero ID 1018, Carrera 5 con Calle 30, Ibagué'))
  ]
});

/* ---- orden por categoría: vías · semáforos · paraderos (el orden dentro de cada una es el de este arreglo) ---- */
const doc = { version: 1, actualizado: new Date().toISOString(), proyectos };
const orden = { vias: 0, semaforos: 1, paraderos: 2 };
doc.proyectos = proyectos.map((p, i) => [p, i]).sort((a, b) => orden[a[0].categoria] - orden[b[0].categoria] || a[1] - b[1]).map(x => x[0]);
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/seed.json'), JSON.stringify(doc));
console.log('seed.json', JSON.stringify(doc).length, 'bytes;', doc.proyectos.length, 'proyectos;', doc.proyectos.map(p => p.id + ':' + (p.bloques || []).length).join(' '));

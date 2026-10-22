/* Genera assets/js/home.js a partir del script de la escena del index.html original (rama main), aplicando los cambios del rework. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const old = cp.execSync('git show main:index.html', { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\n');
const a = old.findIndex(l => l.startsWith('/* ==== INICIO: la calle del SETP'));
const b = old.findIndex((l, i) => i > a && l.startsWith('</script>'));
let src = old.slice(a, b).join('\n');
const rep = (from, to, all) => { const i = src.indexOf(from); if (i < 0) throw new Error('no encontré: ' + from.slice(0, 70)); src = all ? src.split(from).join(to) : src.replace(from, () => to); };

/* 1) CATS: solo la geometría de cámara; los proyectos vienen de los datos */
const c0 = src.indexOf('  const CATS={'), c1 = src.indexOf('  let cur=\'\'');
src = src.slice(0, c0) + `  /* Cámara: cada categoría enfoca su elemento de la escena (unidades del dibujo 1440×730). Los proyectos de cada una vienen de los datos (SETP.projects). */
  const CATS={
    vias:{name:'Vías',sub:'Rehabilitación de la malla vial',pc:'#1D4ED8',side:'left',cam:{tx:-864,ty:-468,k:1.6}},
    semaforos:{name:'Semáforos',sub:'Modernización de la red semafórica',pc:'#00913A',side:'right',cam:{tx:-1000,ty:-470,k:2}},
    paraderos:{name:'Paraderos',sub:'Suministro e instalación de paraderos',pc:'#D98F00',side:'right',cam:{tx:-210,ty:-524,k:2.1}}
  };
` + src.slice(c1);

/* 2) openCat con proyectos desde los datos */
rep(`    pane.classList.toggle('dense',c.projects.length>3);
    c.projects.forEach((p,i)=>{
      const b=document.createElement('button');
      b.type='button'; b.className='sign sign-'+id+(p.page?'':' locked');
      b.style.setProperty('--dl',(0.3+i*0.09)+'s');
      b.innerHTML='<span class="s-ic">'+(ST[p.badge]||IC[id])+'</span><span class="s-t"><span class="s-n">'+p.name+'</span><span class="s-f">'+p.phase+'</span></span><span class="s-b">'+p.badge+'</span>';
      if(p.page){ b.setAttribute('aria-label','Ir a '+p.name+' ('+p.phase+', '+p.badge+')'); b.addEventListener('click',()=>goTo(p.page,p.name,c.pc,b)); }
      else { b.setAttribute('aria-disabled','true'); b.title='Aún no está en el tablero'; }
      list.appendChild(b);
    });`,
`    const projs=(window.SETP&&SETP.projects)?SETP.projects(id):[];
    pane.classList.toggle('dense',projs.length>3);
    const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    projs.forEach((p,i)=>{
      const b=document.createElement('button');
      b.type='button'; b.className='sign sign-'+id+(p.bloqueado?' locked':'');
      b.style.setProperty('--dl',(0.12+i*0.06)+'s');
      b.innerHTML='<span class="s-ic">'+(ST[p.estado]||IC[id])+'</span><span class="s-t"><span class="s-n">'+esc(p.nombre)+'</span><span class="s-f">'+esc(p.fase)+'</span></span><span class="s-b">'+esc(p.estado)+'</span>';
      if(!p.bloqueado){ b.setAttribute('aria-label','Ir a '+p.nombre+' ('+p.fase+', '+p.estado+')'); b.addEventListener('click',()=>goTo(p.id,p.nombre,c.pc,b)); }
      else { b.setAttribute('aria-disabled','true'); b.title='Aún no está en el tablero'; }
      list.appendChild(b);
    });
    if(!projs.length){ const e=document.createElement('p'); e.className='pane-empty'; e.textContent='Pronto habrá proyectos en esta categoría.'; list.appendChild(e); }`);

/* 3) Rendimiento: tras el zoom se vuelve a rasterizar a la escala final (nitidez) sin tirones durante el movimiento */
rep(`  let rzT=0;`, `  cam.addEventListener('transitionend',e=>{ if(e.target!==cam||e.propertyName!=='transform') return; cam.style.willChange='auto'; requestAnimationFrame(()=>requestAnimationFrame(()=>{ cam.style.willChange=''; })); });
  let rzT=0;`);

/* 4) Pie de página y navegación: la gestiona app.js */
const f0 = src.indexOf('  /* Pie de página: la franja de obra'), f1 = src.indexOf('  /* Transición: un círculo de color');
src = src.slice(0, f0) + `  /* Accesos por categoría (pie, migas y conmutador): vuelven a la calle con el zoom ya abierto */
  window.SETPHome={ openCat, closeCat, flagZoom };
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-go]'); if(!b) return;
    const id=b.dataset.go; if(!CATS[id]) return;
    SETP.home(); window.scrollTo({top:0,left:0,behavior:'instant'});
    setTimeout(()=>openCat(id),300);
  });
  document.addEventListener('setp:home',()=>setTimeout(closeCat,60));
  /* Conteo de proyectos por categoría (rótulos de la escena y botones del teléfono) */
  function updateCounts(){
    Object.keys(CATS).forEach(id=>{
      const n=SETP.projects(id).length, t=n===1?'1 proyecto':n+' proyectos';
      document.querySelectorAll('.spot[data-cat="'+id+'"]').forEach(s=>{ s.setAttribute('aria-label',CATS[id].name+': '+t+'. Toca para acercarte.'); const sm=s.querySelector('.spot-tag small'); if(sm) sm.textContent='· '+t; });
      document.querySelectorAll('.cat-btn[data-cat="'+id+'"] small').forEach(sm=>{ sm.textContent=t; });
    });
  }
  document.addEventListener('setp:data',updateCounts);
  if(window.SETP&&SETP.data) updateCounts();

` + src.slice(f1);

/* 5) Transición al proyecto: círculo por transform; la página se prepara bajo el velo */
const g0 = src.indexOf('  function goTo(page,name,color,el){');
src = src.slice(0, g0) + `  function goTo(id,name,color,el){
    if(busy) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ SETP.open(id); window.scrollTo({top:0,left:0,behavior:'instant'}); return; }
    busy=true;
    const r=el.getBoundingClientRect();
    warp.style.setProperty('--x',(r.left+r.width/2)+'px'); warp.style.setProperty('--y',(r.top+r.height/2)+'px');
    warp.style.setProperty('--wc',color); warp.style.setProperty('--ws',Math.ceil(Math.hypot(innerWidth,innerHeight)*2/100)+2); warpName.textContent=name;
    warp.classList.remove('out'); warp.classList.add('go');
    /* el trabajo pesado (armar la página y los mapas) ocurre cuando el velo ya tapa la pantalla; el desvanecido empieza después */
    setTimeout(()=>{ SETP.open(id); window.scrollTo({top:0,left:0,behavior:'instant'}); requestAnimationFrame(()=>requestAnimationFrame(()=>warp.classList.add('out'))); },440);
    setTimeout(()=>{ warp.style.transition='none'; warp.classList.remove('go','out'); void warp.offsetWidth; warp.style.transition=''; busy=false; },860);
  }
})();
`;

/* 6) Escudo de la Alcaldía: un solo archivo para entrada, encabezado y pie */
rep(`const hAlc=document.getElementById('homeAlc'), tAlc=document.querySelector('.topbar .logo.alc');
  if(hAlc&&tAlc) hAlc.src=tAlc.getAttribute('src'); /* mismo escudo de la Alcaldía para la entrada */`,
  `const hAlc=document.getElementById('homeAlc'); if(hAlc) hAlc.src='img/alcaldia.png';`);

const header = '/* Escena de entrada: la calle del SETP (paradero · semáforo · vía), cámara que se acerca, día/noche y transición al proyecto.\n   Generado desde el original con tools/mkhome.js y adaptado al motor de datos (SETP.projects / SETP.open). */\n';
fs.mkdirSync(path.join(root, 'assets/js'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/js/home.js'), header + src + '\n');
console.log('home.js', src.length, 'bytes');

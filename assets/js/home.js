/* Escena de entrada: la calle del SETP (paradero · semáforo · vía), cámara que se acerca, día/noche y transición al proyecto.
   Generado desde el original con tools/mkhome.js y adaptado al motor de datos (SETP.projects / SETP.open). */
/* ==== INICIO: la calle del SETP. Paradero / semáforo / vía → cámara que se acerca → letreros de proyectos. Modo día / noche ==== */
/* Logos institucionales: se les quita el fondo blanco (solo el que toca los bordes, el blanco interno se conserva) y se recorta el margen,
   para que se integren al encabezado y al pie en vez de verse como una calcomanía. */
(function(){
  function cutout(img){
    try{
      const w=img.naturalWidth,h=img.naturalHeight; if(!w||!h||img.dataset.cut) return;
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0);
      const d=x.getImageData(0,0,w,h), p=d.data, seen=new Uint8Array(w*h), q=[];
      const near=i=>Math.min(p[i*4],p[i*4+1],p[i*4+2])>=232;
      const push=i=>{ if(!seen[i]&&near(i)){ seen[i]=1; q.push(i); } };
      for(let i=0;i<w;i++){ push(i); push((h-1)*w+i); } for(let j=0;j<h;j++){ push(j*w); push(j*w+w-1); }
      while(q.length){ const i=q.pop(), px=i%w, py=(i-px)/w; if(px>0) push(i-1); if(px<w-1) push(i+1); if(py>0) push(i-w); if(py<h-1) push(i+w); }
      let x0=w,y0=h,x1=0,y1=0;
      for(let i=0;i<w*h;i++){
        const k=i*4;
        if(seen[i]){
          const m=Math.min(p[k],p[k+1],p[k+2]);
          if(m>=248) p[k+3]=0;
          else { const a=(248-m)/16; p[k+3]=Math.round(255*Math.max(0,Math.min(1,a))); }
        }
        if(p[k+3]>40){ const px=i%w, py=(i-px)/w; if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py; }
      }
      if(x1<=x0||y1<=y0) return;
      x.putImageData(d,0,0);
      const pad=3, cw=x1-x0+1+pad*2, ch=y1-y0+1+pad*2, o=document.createElement('canvas'); o.width=cw; o.height=ch;
      o.getContext('2d').drawImage(c,x0-pad,y0-pad,cw,ch,0,0,cw,ch);
      img.dataset.cut='1'; img.src=o.toDataURL('image/png');
    }catch(e){}
  }
  const hAlc=document.getElementById('homeAlc'); if(hAlc) hAlc.src='img/alcaldia.png';
  document.querySelectorAll('.topbar .logo:not(.nocut), footer .logos img:not(.nocut), #homeAlc').forEach(img=>{
    if(img.complete&&img.naturalWidth) cutout(img); else img.addEventListener('load',()=>cutout(img),{once:true});
  });
})();
(function(){
  const home=document.getElementById('home'); if(!home) return;
  const cam=document.getElementById('cam'), scene=document.getElementById('scene'), layers=[...document.querySelectorAll('#cam .layer')];
  const pane=document.getElementById('pane'), paneT=document.getElementById('paneT'), paneS=document.getElementById('paneS');
  const list=document.getElementById('signList'), back=document.getElementById('sceneBack');
  const warp=document.getElementById('homeWarp'), warpName=document.getElementById('homeWarpName');
  const spots=[...home.querySelectorAll('.spot')], catBtns=[...home.querySelectorAll('.cat-btn')];
  const mq=window.matchMedia('(max-width:700px)');
  /* Teléfonos: se intenta fijar la orientación vertical (solo algunos navegadores lo permiten, p. ej. instalada como app); si no, el aviso "Gira tu teléfono" cubre la vista horizontal */
  try{ if(screen.orientation&&screen.orientation.lock&&window.matchMedia('(pointer:coarse)').matches&&mq.matches) screen.orientation.lock('portrait').catch(()=>{}); }catch(e){}
  const svgA='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const IC={
    vias:svgA+'<path d="M23 8h18l17 48H6z"/><path d="M32 15v7M32 30v9M32 47v7"/></svg>',
    semaforos:svgA+'<rect x="19" y="5" width="26" height="54" rx="10"/><circle cx="32" cy="19" r="4.5" fill="currentColor" stroke="none"/><circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none"/><circle cx="32" cy="45" r="4.5" fill="currentColor" stroke="none"/></svg>',
    paraderos:svgA+'<path d="M32 59S51 40 51 25a19 19 0 1 0-38 0c0 15 19 34 19 34z"/><circle cx="32" cy="25" r="7"/></svg>'
  };
  const ST={ /* ícono por estado del proyecto */
    'Terminado':svgA+'<circle cx="32" cy="32" r="24"/><path d="M20 33l8 8 17-19"/></svg>',
    'Finalizado':svgA+'<circle cx="32" cy="32" r="24"/><path d="M20 33l8 8 17-19"/></svg>',
    'En obra':svgA+'<path d="M32 8l15 46H17z"/><path d="M26 27h12M22 40h20M10 56h44"/></svg>',
    'En liquidación':svgA+'<rect x="15" y="7" width="34" height="50" rx="5"/><path d="M23 20h18M23 30h18M23 40h9"/></svg>',
    'En estructuración':svgA+'<path d="M12 52l4-14 30-30 10 10-30 30z"/><path d="M40 14l10 10"/></svg>',
    'Por incluir':svgA+'<rect x="14" y="28" width="36" height="28" rx="6"/><path d="M22 28v-7a10 10 0 0 1 20 0v7"/></svg>'
  };
  /* Cámara: cada categoría enfoca su elemento de la escena. Valores en unidades del dibujo (1440×730); page:null = proyecto "apagado" */
  /* Cámara: cada categoría enfoca su elemento de la escena (unidades del dibujo 1440×730). Los proyectos de cada una vienen de los datos (SETP.projects). */
  const CATS={
    vias:{name:'Vías',sub:'Rehabilitación de la malla vial',pc:'#1D4ED8',side:'left',cam:{tx:-864,ty:-468,k:1.6}},
    semaforos:{name:'Semáforos',sub:'Modernización de la red semafórica',pc:'#00913A',side:'right',cam:{tx:-1000,ty:-470,k:2}},
    paraderos:{name:'Paraderos',sub:'Suministro e instalación de paraderos',pc:'#D98F00',side:'right',cam:{tx:-210,ty:-524,k:2.1}}
  };
  let cur='',busy=false,zoomT=0;
  /* La cámara es una transformación CSS del contenedor (compuesta por GPU): unidades del dibujo → píxeles */
  const camCss=c=>{ const s=scene.clientWidth/1440; return 'translate('+(c.tx*s).toFixed(1)+'px,'+(c.ty*s).toFixed(1)+'px) scale('+c.k+')'; };
  function flagZoom(){ home.classList.add('zooming'); clearTimeout(zoomT); zoomT=setTimeout(()=>home.classList.remove('zooming'),1050); }

  /* Ciudad de fondo y estrellas (semilla fija: siempre es la misma ciudad y el mismo cielo) */
  (function(){
    let s=11; const rnd=()=>{ s=(s*16807)%2147483647; return (s-1)/2147483646; };
    const g=document.getElementById('skyline'), nw=document.getElementById('nightWin');
    if(g){
      let x=-10,b='',w='',l='';
      while(x<1450){
        const bw=38+rnd()*52, bh=60+rnd()*150, y=500-bh;
        b+='<rect x="'+x.toFixed(0)+'" y="'+y.toFixed(0)+'" width="'+bw.toFixed(0)+'" height="'+bh.toFixed(0)+'" rx="3"/>';
        for(let wy=y+12; wy<486; wy+=17) for(let wx=x+8; wx<x+bw-10; wx+=13) if(rnd()<.3){
          const r='<rect x="'+wx.toFixed(0)+'" y="'+wy.toFixed(0)+'" width="6" height="8" rx="1"/>'; w+=r; l+=r;
        }
        x+=bw+rnd()*8;
      }
      g.innerHTML='<g fill="#9FAECF" opacity=".5">'+b+'</g><g fill="#FFF3C4" opacity=".7">'+w+'</g>';
      if(nw) nw.innerHTML=l;
    }
    const st=document.getElementById('stars');
    if(st){
      let h='';
      for(let i=0;i<100;i++){
        const r=(.7+rnd()*1.5).toFixed(1), tw=rnd()<.14;
        h+='<circle cx="'+(rnd()*1440).toFixed(0)+'" cy="'+(rnd()*350).toFixed(0)+'" r="'+r+'" fill="#fff"'+(tw?' class="star" style="--d:'+(-rnd()*4).toFixed(1)+'s"':' opacity=".75"')+'/>';
      }
      st.innerHTML=h;
    }
  })();

  function applyMode(){
    layers.forEach(l=>l.setAttribute('preserveAspectRatio',mq.matches?'xMidYMax slice':'xMidYMid meet'));
    cam.style.transform=(!mq.matches&&cur)?camCss(CATS[cur].cam):'';
    if(cur) pane.dataset.side=mq.matches?'':CATS[cur].side;
  }
  cam.addEventListener('transitionend',e=>{ if(e.target!==cam||e.propertyName!=='transform') return; cam.style.willChange='auto'; requestAnimationFrame(()=>requestAnimationFrame(()=>{ cam.style.willChange=''; })); });
  let rzT=0; window.addEventListener('resize',()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ cam.style.transition='none'; applyMode(); void cam.offsetWidth; cam.style.transition=''; },120); });
  function openCat(id){
    const c=CATS[id]; if(!c) return;
    cur=id; home.dataset.open=id;
    paneT.textContent=c.name; paneS.textContent=c.sub;
    pane.dataset.side=mq.matches?'':c.side;
    pane.classList.remove('show'); list.innerHTML='';
    const projs=(window.SETP&&SETP.projects)?SETP.projects(id):[];
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
    if(!projs.length){ const e=document.createElement('p'); e.className='pane-empty'; e.textContent='Pronto habrá proyectos en esta categoría.'; list.appendChild(e); }
    if(!mq.matches){ flagZoom(); cam.style.transform=camCss(c.cam); }
    void pane.offsetWidth; pane.classList.add('show');
    catBtns.forEach(b=>b.setAttribute('aria-pressed',b.dataset.cat===id?'true':'false'));
    if(mq.matches) setTimeout(()=>pane.scrollIntoView({behavior:'smooth',block:'nearest'}),80);
  }
  function closeCat(){
    cur=''; home.dataset.open=''; if(!mq.matches) flagZoom(); cam.style.transform=''; pane.classList.remove('show');
    catBtns.forEach(b=>b.setAttribute('aria-pressed','false'));
  }
  spots.forEach(s=>s.addEventListener('click',()=>openCat(s.dataset.cat)));
  catBtns.forEach(b=>b.addEventListener('click',()=>cur===b.dataset.cat?closeCat():openCat(b.dataset.cat)));
  back.addEventListener('click',closeCat);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&cur&&document.getElementById('page-inicio').classList.contains('active')) closeCat(); });
  mq.addEventListener?mq.addEventListener('change',applyMode):mq.addListener(applyMode);
  applyMode();

  /* ---- Modo día / noche: detecta el tema del computador, lo recomienda y se cambia moviendo el sol o la luna ---- */
  const sw=document.getElementById('dnSwitch'), tip=document.getElementById('dnTip'), tipT=document.getElementById('dnTipT'), tipS=document.getElementById('dnTipS'), tipOk=document.getElementById('dnOk');
  const sys=window.matchMedia('(prefers-color-scheme: dark)');
  let saved=null, tipTimer=0;
  try{ saved=localStorage.getItem('setp-modo'); }catch(e){}
  if(saved!=='day'&&saved!=='night') saved=null;
  /* las luces del bus nocturno viven en otra capa: se alinean con el bus real al cambiar de modo */
  function syncBus(){
    const a=document.getAnimations().filter(x=>x.animationName==='busRoute');
    const fg=a.find(x=>x.effect&&x.effect.target&&x.effect.target.closest('#busSvg')), nf=a.find(x=>x.effect&&x.effect.target&&x.effect.target.closest('#nfSvg'));
    if(fg&&nf&&fg.currentTime!=null) nf.currentTime=fg.currentTime;
  }
  function setMode(m){
    syncBus();
    home.dataset.mode=m; document.body.classList.toggle('night',m==='night');
    sw.setAttribute('aria-checked',m==='night'?'true':'false'); sw.style.setProperty('--kx',m==='night'?0:1);
  }
  function hideTip(){ clearTimeout(tipTimer); tip.classList.remove('show'); }
  function showTip(m){
    tipT.textContent=m==='night'?'Tu computador está en modo oscuro':'Tu computador está en modo claro';
    tipS.textContent=m==='night'?'Por eso te mostramos la calle de noche, con otro frente de trabajo. Cámbiala cuando quieras moviendo el sol o la luna.':'Por eso te mostramos la calle de día. Cámbiala cuando quieras moviendo el sol o la luna.';
    tip.classList.add('show'); clearTimeout(tipTimer); tipTimer=setTimeout(hideTip,12000);
  }
  function choose(m){
    setMode(m); saved=m; hideTip();
    try{ localStorage.setItem('setp-modo',m); }catch(e){}
  }
  const first=saved||(sys.matches?'night':'day');
  setMode(first);
  if(!saved) setTimeout(()=>showTip(first),1500);
  const onSys=e=>{ if(!saved){ const m=e.matches?'night':'day'; setMode(m); showTip(m); } };
  sys.addEventListener?sys.addEventListener('change',onSys):sys.addListener(onSys);
  tipOk.addEventListener('click',hideTip);
  /* arrastrar (o tocar) el sol / la luna: el cuerpo celeste viaja de un lado al otro con animación */
  const track=sw.querySelector('.dn-track'); let drag=false,moved=false,x0=0;
  const posOf=e=>{ const r=track.getBoundingClientRect(); return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); };
  sw.addEventListener('pointerdown',e=>{ drag=true; moved=false; x0=e.clientX; sw.classList.add('drag'); try{sw.setPointerCapture(e.pointerId);}catch(_){} });
  sw.addEventListener('pointermove',e=>{ if(!drag) return; if(Math.abs(e.clientX-x0)>4) moved=true; if(moved) sw.style.setProperty('--kx',posOf(e)); });
  sw.addEventListener('pointerup',e=>{
    if(!drag) return; drag=false; sw.classList.remove('drag');
    const next=moved?(posOf(e)<.5?'night':'day'):(home.dataset.mode==='night'?'day':'night');
    choose(next);
  });
  sw.addEventListener('pointercancel',()=>{ drag=false; sw.classList.remove('drag'); setMode(home.dataset.mode); });
  sw.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(home.dataset.mode==='night'?'day':'night'); } else if(e.key==='ArrowLeft'){ choose('night'); } else if(e.key==='ArrowRight'){ choose('day'); } });

  /* Accesos por categoría (pie, migas y conmutador): vuelven a la calle con el zoom ya abierto */
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

  /* Transición: un círculo de color crece desde el letrero y abre el proyecto */
  function goTo(id,name,color,el){
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


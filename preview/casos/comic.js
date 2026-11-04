// v105 — lector de cómics en librito (rescatado del prototipo del portafolio).
// Escritorio: doble página con la tapa sola. Celular: de a una página, con gesto de deslizar.
// Flechas del teclado, Escape para cerrar, foco dentro del diálogo y sin animación con movimiento reducido.
(()=>{
  const R='../assets/comics/';
  const seq=(p,from,n)=>Array.from({length:n},(_,i)=>`${R}${p}_${String(from+i).padStart(2,'0')}.webp`);
  const BEH_J='https://www.behance.net/gallery/184029139/Jasypa';
  const BOOKS={
    'jasypa-1':{title:'Jasypa · Entrega 1',pages:seq('jasypa',1,10),ar:.8,url:BEH_J},
    'jasypa-2':{title:'Jasypa · Entrega 2',pages:seq('jasypa',11,10),ar:.8,url:BEH_J},
    'jasypa-3':{title:'Jasypa · Entrega 3',pages:seq('jasypa',21,10),ar:.8,url:BEH_J},
    'jasypa-4':{title:'Jasypa · Entrega 4',pages:seq('jasypa',31,10),ar:.8,url:BEH_J},
    '1pct':{title:'1% · Cómic de Halloween para Player',pages:seq('unopct',1,8),ar:1.046},
    'luison':{title:'La noche del Luisón',pages:seq('luison',1,28),ar:.707}
  };
  const triggers=[...document.querySelectorAll('[data-comic]')];
  if(!triggers.length)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  // De a una página en celular y en tablet vertical (a doble página, las viñetas quedan demasiado chicas)
  const narrow=matchMedia('(max-width:760px), (orientation:portrait) and (max-width:1100px)');

  const dlg=document.createElement('dialog');
  dlg.className='cr';
  dlg.setAttribute('aria-labelledby','cr-title');
  dlg.innerHTML=`<div class="cr-bar"><p class="cr-title" id="cr-title"></p><span class="cr-count" aria-live="polite"></span><button class="cr-close" type="button" aria-label="Cerrar">✕</button></div>
  <div class="cr-stage"><button class="cr-nav cr-prev" type="button" aria-label="Página anterior">←</button><div class="cr-book"></div><button class="cr-nav cr-next" type="button" aria-label="Página siguiente">→</button></div>`;
  document.body.appendChild(dlg);
  const $=s=>dlg.querySelector(s);
  const book=$('.cr-book'),count=$('.cr-count'),title=$('.cr-title'),prev=$('.cr-prev'),next=$('.cr-next');
  let B=null,spreads=[],k=0,opener=null;

  const build=()=>{
    const n=B.pages.length;
    spreads=narrow.matches?B.pages.map((_,i)=>[i]):[[0]];
    if(!narrow.matches)for(let i=1;i<n;i+=2)spreads.push(i+1<n?[i,i+1]:[i]);
  };
  const preload=i=>{(spreads[i]||[]).forEach(p=>{const im=new Image();im.src=B.pages[p]})};
  const draw=dir=>{
    const c=spreads[k],n=B.pages.length;
    book.style.setProperty('--ar',B.ar);
    book.classList.toggle('is-spread',c.length===2);
    book.innerHTML=c.map(p=>`<img src="${B.pages[p]}" alt="${B.title}, página ${p+1} de ${n}" width="1000" height="${Math.round(1000/B.ar)}">`).join('');
    count.textContent=k===0?'Tapa':c.length===2?`${c[0]+1}–${c[1]+1} / ${n}`:`${c[0]+1} / ${n}`;
    prev.disabled=k===0;next.disabled=k===spreads.length-1;
    if(dir&&!reduce.matches){book.classList.remove('turn-l','turn-r');void book.offsetWidth;book.classList.add(dir>0?'turn-r':'turn-l')}
    preload(k+1);preload(k-1);
  };
  const go=d=>{const t=k+d;if(t<0||t>=spreads.length)return;k=t;draw(d)};
  const open=(id,el)=>{
    B=BOOKS[id];if(!B)return;
    opener=el;k=0;build();
    title.textContent=B.title;
    $('.cr-link')?.remove();
    if(B.url)$('.cr-bar').insertAdjacentHTML('beforeend',`<a class="cr-link" href="${B.url}" target="_blank" rel="noreferrer">Behance ↗</a>`);
    draw(0);
    dlg.showModal();document.documentElement.classList.add('cr-open');
    next.disabled?$('.cr-close').focus():next.focus();
  };
  const close=()=>dlg.open&&dlg.close();
  dlg.addEventListener('close',()=>{document.documentElement.classList.remove('cr-open');book.innerHTML='';opener?.focus()});
  prev.onclick=()=>go(-1);next.onclick=()=>go(1);$('.cr-close').onclick=close;
  dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.classList.contains('cr-stage'))close()});
  book.addEventListener('click',e=>{const b=book.getBoundingClientRect();go(narrow.matches||e.clientX>b.left+b.width/2?1:-1)});
  dlg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();go(1)}if(e.key==='ArrowLeft'){e.preventDefault();go(-1)}});
  let tx=null,ty=null;
  book.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
  book.addEventListener('touchend',e=>{if(tx===null)return;const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;tx=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))go(dx<0?1:-1)},{passive:true});
  narrow.addEventListener('change',()=>{if(!dlg.open)return;const p=spreads[k][0];build();k=Math.max(0,spreads.findIndex(s=>s.includes(p)));draw(0)});
  triggers.forEach(el=>el.addEventListener('click',e=>{e.preventDefault();open(el.dataset.comic,el)}));
})();

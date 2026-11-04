// v80 — los casos siempre abren arriba (salvo que la dirección traiga un ancla): sin restaurar el scroll de otra visita
(()=>{
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  const top=()=>{if(!location.hash)window.scrollTo({top:0,left:0,behavior:'instant'});};
  top();window.addEventListener('load',top);window.addEventListener('pageshow',top);
})();
// Videos de las páginas de caso: los loops corren solo cuando se ven y se detienen con movimiento reducido.
(()=>{
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loops=[...document.querySelectorAll('video[data-loop]')];
  if(reduce){loops.forEach(v=>{v.removeAttribute('autoplay');v.pause();v.controls=true;});return;}
  if(!('IntersectionObserver' in window)){loops.forEach(v=>v.play().catch(()=>{}));return;}
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting)e.target.play().catch(()=>{});else e.target.pause();
  }),{threshold:.25});
  loops.forEach(v=>io.observe(v));
})();

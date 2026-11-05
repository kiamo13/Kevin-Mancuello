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
// v110 — mail: copia la dirección y avisa (en computadoras sin programa de correo el enlace no hace nada)
(()=>{
  const links=document.querySelectorAll('a[href^="mailto:"]');if(!links.length)return;
  const t=document.createElement('div');t.className='mail-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);let tm=0;
  links.forEach(a=>a.addEventListener('click',()=>{const m=a.getAttribute('href').slice(7).split('?')[0];const show=s=>{t.textContent=s;t.classList.add('is-on');clearTimeout(tm);tm=setTimeout(()=>t.classList.remove('is-on'),3200)};if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(m).then(()=>show('Mail copiado: '+m),()=>show(m));else show(m);}));
})();

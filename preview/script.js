(()=>{
  const root=document.documentElement;
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const connectionType=connection?.effectiveType||'';
  const weakNetwork=!!(connection&&(connection.saveData||/^(slow-2g|2g)$/.test(connectionType)||(Number.isFinite(connection.downlink)&&connection.downlink<1.2)));
  const lowMemory=Number.isFinite(navigator.deviceMemory)&&navigator.deviceMemory<=2;
  const lowCpu=Number.isFinite(navigator.hardwareConcurrency)&&navigator.hardwareConcurrency<=2;
  const systemReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let savedMode=null;
  try{savedMode=localStorage.getItem('km-site-mode');}catch(e){}
  const autoLite=weakNetwork||lowMemory||lowCpu||systemReducedMotion;
  let liteMode=savedMode==='lite'||(savedMode!=='full'&&autoLite);
  const liteToggle=document.getElementById('lite-toggle');
  function applyLiteMode(){
    root.classList.toggle('is-lite',liteMode);
    if(liteToggle){
      liteToggle.setAttribute('aria-pressed',String(liteMode));
      liteToggle.textContent=liteMode?'MODO COMPLETO':'MODO LITE';
      liteToggle.setAttribute('aria-label',liteMode?'Desactivar versión Lite':'Activar versión Lite');
    }
  }
  applyLiteMode();
  if(liteToggle)liteToggle.addEventListener('click',()=>{
    liteMode=!liteMode;
    try{localStorage.setItem('km-site-mode',liteMode?'lite':'full');}catch(e){}
    window.location.reload();
  });

  const stage=document.getElementById('avatar-stage');
  const mount=document.getElementById('avatar-mount');
  if(!stage||!mount)return;

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let svg,skull,peekShape,pupils=[];
  let smileTimer=0,blinkTimer=0,blinkEnd=0,pupilRaf=0,revealRaf=0,touchRevealTimer=0;
  let touchActive=false;
  let smileActive=false;
  let pupilCurrent=[{x:0,y:0},{x:0,y:0}];
  let pupilTarget=[{x:0,y:0},{x:0,y:0}];
  let revealCurrent={x:315,y:370};
  let revealTarget={x:315,y:370};
  let revealScale=0,revealScaleTarget=0,revealPhase=0;
  let revealVelocity={x:0,y:0};

  function svgElement(name,attrs={}){
    const el=document.createElementNS('http://www.w3.org/2000/svg',name);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  }

  function addRevealMask(){
    const defs=svgElement('defs');
    const gradient=svgElement('radialGradient',{
      id:'skullRevealGradient',
      gradientUnits:'objectBoundingBox',
      cx:'50%',cy:'50%',r:'71%'
    });
    [
      ['0%','#000000'],['54%','#000000'],['72%','#474747'],
      ['88%','#d1d1d1'],['100%','#ffffff']
    ].forEach(([offset,color])=>gradient.appendChild(svgElement('stop',{offset,'stop-color':color})));

    const mask=svgElement('mask',{
      id:'avatarFaceMask',
      maskUnits:'userSpaceOnUse',
      maskContentUnits:'userSpaceOnUse',
      x:'0',y:'0',width:'630.979',height:'739.979',
      'mask-type':'luminance'
    });
    mask.appendChild(svgElement('rect',{x:0,y:0,width:630.979,height:739.979,fill:'#fff'}));
    peekShape=svgElement('path',{
      id:'skull-peek-shape',
      fill:'url(#skullRevealGradient)',
      opacity:0,
      d:'M 315 303 C 342 303 363 330 363 365 C 363 400 342 427 315 427 C 288 427 267 400 267 365 C 267 330 288 303 315 303 Z'
    });
    mask.appendChild(peekShape);
    defs.append(gradient,mask);
    svg.insertBefore(defs,svg.firstChild);

    /* El cráneo aparece por debajo de los ojos, pero atraviesa piel,
       barba y cabello. Los ojos, pupilas y brillos quedan visibles sobre
       el cráneo para conservar la expresión del personaje. */
    [
      'cara_ojos_abiertos_neutro',
      'ojos_sonrientes',
      'cara_ojos_abiertos_neutro_copia',
      'BARBA',
      'cabello-silueta',
      'cabello-base',
      'cabello-parpadeo'
    ].forEach(id=>{
      const layer=svg.querySelector('#'+id);
      if(layer)layer.setAttribute('mask','url(#avatarFaceMask)');
    });
  }

  function loadAvatar(){
    fetch(new URL('assets/avatar.svg?v=20261103-31',document.baseURI),{cache:'no-store'})
      .then(response=>{
        if(!response.ok)throw new Error('No se pudo cargar el SVG del avatar.');
        return response.text();
      })
      .then(source=>{
        const parsed=new DOMParser().parseFromString(source,'image/svg+xml');
        if(parsed.querySelector('parsererror'))throw new Error('El SVG no se pudo interpretar.');
        svg=document.importNode(parsed.documentElement,true);
        svg.classList.add('avatar-svg');
        svg.setAttribute('aria-hidden','true');
        mount.replaceChildren(svg);

        addRevealMask();
        skull=svg.querySelector('#CRÁNEO');
        pupils=[svg.querySelector('#pupila_2'),svg.querySelector('#pupila_1')];
        if(!skull||!peekShape||pupils.some(p=>!p))throw new Error('Faltan capas necesarias del avatar.');

        pupils.forEach(p=>p.setAttribute('transform','translate(0 0)'));
        if(!liteMode)bindInteractions();
        stage.classList.add('avatar-ready');
      })
      .catch(error=>{
        console.error(error);
        mount.innerHTML='<p class="avatar-error">No se pudo cargar el avatar.</p>';
      });
  }

  function flashSmile(){
    clearTimeout(smileTimer);
    clearTimeout(blinkTimer);
    clearTimeout(blinkEnd);
    stage.classList.remove('is-blinking');
    smileActive=true;
    stage.classList.add('is-smiling');
    stage.setAttribute('aria-label','Retrato interactivo: sonrisa activada.');
    smileTimer=window.setTimeout(()=>{
      smileActive=false;
      stage.classList.remove('is-smiling');
      stage.setAttribute('aria-label','Retrato interactivo. Activar sonrisa.');
      scheduleBlink();
    },1050);
  }

  function animatePupils(){
    pupilRaf=0;
    const ease=reducedMotion?1:.24;
    pupilCurrent=pupilCurrent.map((p,i)=>({
      x:p.x+(pupilTarget[i].x-p.x)*ease,
      y:p.y+(pupilTarget[i].y-p.y)*ease
    }));
    pupils.forEach((el,i)=>{
      el.setAttribute('transform','translate('+pupilCurrent[i].x.toFixed(2)+' '+pupilCurrent[i].y.toFixed(2)+')');
    });
    if(pupilCurrent.some((p,i)=>Math.abs(p.x-pupilTarget[i].x)>.05||Math.abs(p.y-pupilTarget[i].y)>.05)){
      pupilRaf=requestAnimationFrame(animatePupils);
    }
  }

  function requestPupilFrame(){
    if(!pupilRaf)pupilRaf=requestAnimationFrame(animatePupils);
  }

  // Map the whole viewport onto the avatar coordinate system.
  function screenToFace(e){
    if(!svg)return null;
    const rect=svg.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const nx=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1);
    const ny=clamp((e.clientY-rect.top)/Math.max(1,rect.height),0,1);
    return {x:nx*vb.width,y:ny*vb.height,vb};
  }

  function trackEyes(e){
    const p=screenToFace(e);
    if(!p)return;
    const dx=clamp((p.x-p.vb.width*.5)/(p.vb.width*.40),-1,1);
    const dy=clamp((p.y-p.vb.height*.47)/(p.vb.height*.34),-1,1);
    pupilTarget=[{x:dx*14,y:dy*10},{x:dx*14,y:dy*10}];
    requestPupilFrame();
  }

  function organicRevealPath(cx,cy,phase,speed,scale){
    const count=24;
    const points=[];
    const intensity=clamp(speed/28,0,1);
    const faceRect=svg.getBoundingClientRect();
    const cursorRect=invertLayer?.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const rx=cursorRect&&faceRect.width
      ?(cursorRect.width*.5)*(116/120)*(vb.width/faceRect.width)*scale*(1+.28*intensity)
      :48*scale*(1+.28*intensity);
    const ry=cursorRect&&faceRect.height
      ?(cursorRect.height*.5)*(126/130)*(vb.height/faceRect.height)*scale*(1+.38*intensity)
      :62*scale*(1+.38*intensity);
    const direction=Math.atan2(revealVelocity.y,revealVelocity.x||.0001);
    // The long axis turns into the direction of travel, creating a soft liquid tail.
    const rotation=speed>.45?direction-Math.PI/2:0;
    const trail=Math.min(speed*.48,18)*intensity;
    const drawCx=cx-Math.cos(direction)*trail;
    const drawCy=cy-Math.sin(direction)*trail;
    const squash=1-.14*intensity;
    const stretch=1+.48*intensity;

    for(let i=0;i<count;i++){
      const a=(Math.PI*2*i)/count;
      const wobble=1+(.075+.055*intensity)*Math.sin(3*a+phase)+.045*Math.sin(5*a-phase*1.35)+.026*Math.sin(2*a+phase*.7);
      const x=Math.cos(a)*rx*wobble*squash;
      const y=Math.sin(a)*ry*wobble*stretch;
      points.push({
        x:drawCx+x*Math.cos(rotation)-y*Math.sin(rotation),
        y:drawCy+x*Math.sin(rotation)+y*Math.cos(rotation)
      });
    }
    const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const first=midpoint(points[points.length-1],points[0]);
    let d='M '+first.x.toFixed(2)+' '+first.y.toFixed(2);
    for(let i=0;i<count;i++){
      const next=midpoint(points[i],points[(i+1)%count]);
      d+=' Q '+points[i].x.toFixed(2)+' '+points[i].y.toFixed(2)+' '+next.x.toFixed(2)+' '+next.y.toFixed(2);
    }
    return d+' Z';
  }

  function renderReveal(){
    revealRaf=0;
    const dx=revealTarget.x-revealCurrent.x;
    const dy=revealTarget.y-revealCurrent.y;
    if(reducedMotion){
      revealCurrent={...revealTarget};
      revealVelocity={x:0,y:0};
    }else{
      // Damped spring: deliberately slower than direct tracking, with a small overshoot.
      const stiffness=.105;
      const damping=.76;
      revealVelocity.x=(revealVelocity.x+dx*stiffness)*damping;
      revealVelocity.y=(revealVelocity.y+dy*stiffness)*damping;
      const velocityLength=Math.hypot(revealVelocity.x,revealVelocity.y);
      if(velocityLength>42){
        const ratio=42/velocityLength;
        revealVelocity.x*=ratio;
        revealVelocity.y*=ratio;
      }
      revealCurrent.x+=revealVelocity.x;
      revealCurrent.y+=revealVelocity.y;
    }
    const speed=Math.hypot(revealVelocity.x,revealVelocity.y);
    revealScale+=(revealScaleTarget-revealScale)*(reducedMotion?1:.18);
    if(speed>.08)revealPhase+=Math.min(speed*.018,.18);
    peekShape.setAttribute('d',organicRevealPath(
      revealCurrent.x,revealCurrent.y,revealPhase,speed,Math.max(.001,revealScale)
    ));
    const remainingX=revealTarget.x-revealCurrent.x;
    const remainingY=revealTarget.y-revealCurrent.y;
    const moving=Math.abs(remainingX)>.22||Math.abs(remainingY)>.22||
      speed>.18||Math.abs(revealScaleTarget-revealScale)>.004;
    if(moving){
      revealRaf=requestAnimationFrame(renderReveal);
    }else{
      revealCurrent={...revealTarget};
      revealVelocity={x:0,y:0};
      if(revealScaleTarget===0)stage.classList.remove('is-closing');
    }
  }

  function requestRevealFrame(){
    if(!revealRaf)revealRaf=requestAnimationFrame(renderReveal);
  }

  function setRevealTarget(e){
    const p=screenToFace(e);
    if(!p)return;
    revealTarget={x:clamp(p.x,55,575),y:clamp(p.y,135,640)};
    requestRevealFrame();
  }

  function scheduleBlink(){
    clearTimeout(blinkTimer);
    if(reducedMotion)return;
    blinkTimer=window.setTimeout(()=>{
      if(!stage.classList.contains('is-hovering')&&!smileActive){
        stage.classList.add('is-blinking');
        blinkEnd=window.setTimeout(()=>{
          stage.classList.remove('is-blinking');
          scheduleBlink();
        },210);
      }else{
        scheduleBlink();
      }
    },2400+Math.random()*3000);
  }

  function activateReveal(e){
    if(!svg)return;
    clearTimeout(touchRevealTimer);
    setRevealTarget(e);
    if(!stage.classList.contains('is-hovering')){
      revealCurrent={...revealTarget};
      revealVelocity={x:0,y:0};
      revealScale=.04;
      revealScaleTarget=1;
      stage.classList.remove('is-blinking','is-closing');
      clearTimeout(blinkTimer);
      clearTimeout(blinkEnd);
      stage.classList.add('is-hovering');
      peekShape.setAttribute('d',organicRevealPath(revealCurrent.x,revealCurrent.y,revealPhase,0,revealScale));
    }
    requestRevealFrame();
  }

  function closeReveal(){
    stage.classList.remove('is-hovering');
    stage.classList.add('is-closing');
    revealScaleTarget=0;
    requestRevealFrame();
    scheduleBlink();
  }

  function pointInsideAvatar(e){
    const r=stage.getBoundingClientRect();
    return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  }

  const invertLayer=document.getElementById('color-invert');
  const invertShape=document.getElementById('color-invert-shape');
  let invertPhase=0,invertRaf=0,invertInitialized=false;
  let invertTarget={x:0,y:0},invertCurrent={x:0,y:0},invertVelocity={x:0,y:0};

  function inversionPath(cx,cy,phase,speed){
    const count=24,rx=116,ry=126,pts=[];
    const angle=Math.atan2(invertVelocity.y,invertVelocity.x||.0001);
    const intensity=clamp(speed/34,0,1);
    const stretch=.42*intensity;
    const trail=Math.min(speed*.2,12);
    const centerX=cx-Math.cos(angle)*trail;
    const centerY=cy-Math.sin(angle)*trail;
    for(let i=0;i<count;i++){
      const a=Math.PI*2*i/count;
      const wobble=1+.055*Math.sin(3*a+phase)+.035*Math.sin(5*a-phase*1.2)+.018*Math.sin(2*a+phase*.8);
      const radial=1+stretch*Math.cos(a-angle);
      const x=Math.cos(a)*rx*wobble*radial;
      const y=Math.sin(a)*ry*wobble*radial;
      pts.push({x:centerX+x,y:centerY+y});
    }
    const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    let d='M '+mid(pts[count-1],pts[0]).x+' '+mid(pts[count-1],pts[0]).y;
    for(let i=0;i<count;i++){const m=mid(pts[i],pts[(i+1)%count]);d+=' Q '+pts[i].x+' '+pts[i].y+' '+m.x+' '+m.y;}
    return d+' Z';
  }

  function animateInversion(){
    invertRaf=0;
    const dx=invertTarget.x-invertCurrent.x,dy=invertTarget.y-invertCurrent.y;
    if(reducedMotion){
      invertCurrent={...invertTarget};
      invertVelocity={x:0,y:0};
    }else{
      const stiffness=.115;
      const damping=.75;
      invertVelocity.x=(invertVelocity.x+dx*stiffness)*damping;
      invertVelocity.y=(invertVelocity.y+dy*stiffness)*damping;
      const velocityLength=Math.hypot(invertVelocity.x,invertVelocity.y);
      if(velocityLength>76){
        const ratio=76/velocityLength;
        invertVelocity.x*=ratio;
        invertVelocity.y*=ratio;
      }
      invertCurrent.x+=invertVelocity.x;
      invertCurrent.y+=invertVelocity.y;
    }
    const speed=Math.hypot(invertVelocity.x,invertVelocity.y);
    invertPhase+=Math.min(speed*.0025,.12);
    invertLayer.style.left=invertCurrent.x+'px';
    invertLayer.style.top=invertCurrent.y+'px';
    invertShape.setAttribute('d',inversionPath(120,130,invertPhase,speed));
    const remainingX=invertTarget.x-invertCurrent.x;
    const remainingY=invertTarget.y-invertCurrent.y;
    if(Math.abs(remainingX)>.35||Math.abs(remainingY)>.35||speed>.18){
      invertRaf=requestAnimationFrame(animateInversion);
    }else{
      invertCurrent={...invertTarget};
      invertVelocity={x:0,y:0};
      invertLayer.style.left=invertCurrent.x+'px';
      invertLayer.style.top=invertCurrent.y+'px';
    }
  }

  function moveInversion(e){
    if(!invertLayer)return;
    invertTarget={x:e.clientX,y:e.clientY};
    if(!invertInitialized){
      invertCurrent={...invertTarget};
      invertVelocity={x:0,y:0};
      invertInitialized=true;
      invertLayer.style.left=invertCurrent.x+'px';
      invertLayer.style.top=invertCurrent.y+'px';
      invertShape.setAttribute('d',inversionPath(120,130,invertPhase,0));
    }
    invertLayer.classList.add('is-visible');
    if(!invertRaf)invertRaf=requestAnimationFrame(animateInversion);
  }

  function hideInversion(){if(invertLayer)invertLayer.classList.remove('is-visible');}

  function handlePointer(e){
    if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
    trackEyes(e);
    /* El cursor mantiene el mismo efecto global sobre el avatar.
       El revelado del cráneo se suma sin sustituir la inversión cromática. */
    moveInversion(e);
    if(pointInsideAvatar(e)){
      activateReveal(e);
    }else if(stage.classList.contains('is-hovering')){
      closeReveal();
    }
  }

  function stopVisualEffects(){
    clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(touchRevealTimer);
    if(pupilRaf)cancelAnimationFrame(pupilRaf);
    if(revealRaf)cancelAnimationFrame(revealRaf);
    if(invertRaf)cancelAnimationFrame(invertRaf);
    if(invertLayer)invertLayer.classList.remove('is-visible');
    if(stage){stage.classList.remove('is-hovering','is-closing','is-blinking','is-smiling');}
    if(peekShape){peekShape.setAttribute('opacity','0');}
  }

  function bindInteractions(){
    stage.addEventListener('click',()=>{if(!liteMode)flashSmile();});
    const supportsHover=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if(supportsHover){
      window.addEventListener('pointermove',handlePointer,{passive:true});
      window.addEventListener('pointerout',e=>{
        if(!e.relatedTarget){hideInversion();closeReveal();}
      },{passive:true});
    }else{
      let touchActive=false;
      document.addEventListener('touchstart',e=>{
        if(!e.touches.length)return;
        const t=e.touches[0],point={clientX:t.clientX,clientY:t.clientY};
        touchActive=true;trackEyes(point);
        if(pointInsideAvatar(point)){hideInversion();activateReveal(point);}
        else{moveInversion(point);if(stage.classList.contains('is-hovering'))closeReveal();}
      },{passive:true});
      document.addEventListener('touchmove',e=>{
        if(!touchActive||!e.touches.length)return;
        const t=e.touches[0],point={clientX:t.clientX,clientY:t.clientY};
        trackEyes(point);
        if(pointInsideAvatar(point)){hideInversion();activateReveal(point);}
        else{moveInversion(point);setRevealTarget(point);if(stage.classList.contains('is-hovering'))closeReveal();}
      },{passive:true});
      const finishTouch=()=>{
        touchActive=false;
        hideInversion();
        clearTimeout(touchRevealTimer);
        touchRevealTimer=window.setTimeout(closeReveal,650);
      };
      document.addEventListener('touchend',finishTouch,{passive:true});
      document.addEventListener('touchcancel',finishTouch,{passive:true});
    }
    if(!reducedMotion)scheduleBlink();
  }

  loadAvatar();

  const menuButton=document.querySelector('.menu-toggle');
  const nav=document.querySelector('.main-nav');
  if(menuButton&&nav){
    const closeMenu=({restoreFocus=false}={})=>{
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded','false');
      menuButton.setAttribute('aria-label','Abrir menú');
      if(restoreFocus)menuButton.focus();
    };
    menuButton.addEventListener('click',()=>{
      const open=nav.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded',String(open));
      menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
      if(open&&window.matchMedia('(max-width: 680px)').matches){
        const firstLink=nav.querySelector('a');
        if(firstLink)firstLink.focus();
      }
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>closeMenu()));
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&nav.classList.contains('is-open'))closeMenu({restoreFocus:true});
    });
    document.addEventListener('pointerdown',e=>{
      if(nav.classList.contains('is-open')&&!nav.contains(e.target)&&!menuButton.contains(e.target))closeMenu();
    });
  }

  // Keep the current section visible to assistive technology and keyboard users.
  const sectionLinks=[...document.querySelectorAll('.main-nav a[href^="#"]')];
  const observedSections=sectionLinks
    .map(link=>document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if('IntersectionObserver' in window&&observedSections.length){
    const sectionObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting)
        .sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      sectionLinks.forEach(link=>{
        const active=link.getAttribute('href')==='#'+visible.target.id;
        if(active)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    },{rootMargin:'-18% 0px -62% 0px',threshold:[0,.15,.35,.6]});
    observedSections.forEach(section=>sectionObserver.observe(section));
  }

  window.addEventListener('pagehide',()=>{
    clearTimeout(smileTimer);clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(touchRevealTimer);if(invertRaf)cancelAnimationFrame(invertRaf);
    if(pupilRaf)cancelAnimationFrame(pupilRaf);
    if(revealRaf)cancelAnimationFrame(revealRaf);
  });
})();
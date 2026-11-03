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
  let revealIdleTimer=0,revealLastPointerTime=0;
  let revealLastPointerScreen={x:0,y:0};
  let previousReveal={x:315,y:370};
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
    fetch(new URL('assets/avatar.svg?v=20261103-50',document.baseURI),{cache:'no-store'})
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
    const count=18;
    const points=[];
    const intensity=clamp(speed/8,0,1);
    const faceRect=svg.getBoundingClientRect();
    const cursorRect=invertLayer?.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const rx=cursorRect&&faceRect.width
      ?(cursorRect.width*.5)*(116/120)*(vb.width/faceRect.width)*scale*(1+.16*intensity)
      :48*scale*(1+.16*intensity);
    const ry=cursorRect&&faceRect.height
      ?(cursorRect.height*.5)*(126/130)*(vb.height/faceRect.height)*scale*(1+.24*intensity)
      :62*scale*(1+.24*intensity);
    const direction=Math.atan2(revealVelocity.y,revealVelocity.x||.0001);
    const rotation=speed>.25?direction-Math.PI/2:0;
    const trail=Math.min(speed*.40,8)*intensity;
    const drawCx=cx-Math.cos(direction)*trail;
    const drawCy=cy-Math.sin(direction)*trail;

    for(let i=0;i<count;i++){
      const a=(Math.PI*2*i)/count;
      const wobble=1+.075*Math.sin(3*a+phase)+.038*Math.sin(5*a-phase*1.35)+.022*Math.sin(2*a+phase*.7);
      const x=Math.cos(a)*rx*wobble;
      const y=Math.sin(a)*ry*wobble;
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
    const ease=reducedMotion?1:.12;
    const dx=revealTarget.x-revealCurrent.x;
    const dy=revealTarget.y-revealCurrent.y;
    revealCurrent.x+=dx*ease;
    revealCurrent.y+=dy*ease;
    const vx=revealCurrent.x-previousReveal.x;
    const vy=revealCurrent.y-previousReveal.y;
    revealVelocity={x:vx,y:vy};
    const speed=Math.hypot(vx,vy);
    previousReveal={x:revealCurrent.x,y:revealCurrent.y};
    revealScale+=(revealScaleTarget-revealScale)*(reducedMotion?1:.12);
    if(speed>.08)revealPhase+=Math.min(speed*.012,.13);
    peekShape.setAttribute('d',organicRevealPath(
      revealCurrent.x,revealCurrent.y,revealPhase,speed,Math.max(.001,revealScale)
    ));
    const moving=Math.abs(dx)>.08||Math.abs(dy)>.08||Math.abs(revealScaleTarget-revealScale)>.006;
    if(moving){
      revealRaf=requestAnimationFrame(renderReveal);
    }else if(revealScaleTarget===0){
      stage.classList.remove('is-closing');
    }
  }
  function requestRevealFrame(){
    if(!revealRaf)revealRaf=requestAnimationFrame(renderReveal);
  }

  function setRevealTarget(e){
    const p=screenToFace(e);
    if(!p)return;

    const now=performance.now();
    const pointerX=e.clientX,pointerY=e.clientY;
    if(stage.classList.contains('is-hovering')&&revealLastPointerTime){
      const elapsed=Math.max(8,now-revealLastPointerTime);
      const dx=pointerX-revealLastPointerScreen.x;
      const dy=pointerY-revealLastPointerScreen.y;
      const distance=Math.hypot(dx,dy);
      const distanceFactor=clamp(distance/150,0,1);
      const speedFactor=clamp((distance/elapsed)/1.15,0,1);
      const movementIntensity=Math.max(distanceFactor,speedFactor);
      revealScaleTarget=1+movementIntensity*.24;
    }else{
      revealScaleTarget=1;
    }

    revealLastPointerScreen={x:pointerX,y:pointerY};
    revealLastPointerTime=now;
    clearTimeout(revealIdleTimer);
    revealIdleTimer=window.setTimeout(()=>{
      if(stage.classList.contains('is-hovering')){
        revealScaleTarget=1;
        requestRevealFrame();
      }
    },120);

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
      previousReveal={...revealCurrent};
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
    clearTimeout(revealIdleTimer);
    revealIdleTimer=0;
    revealLastPointerTime=0;
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
  const fluidCanvas=document.getElementById('fluid-cursor');
  const fluidCtx=fluidCanvas?.getContext('2d',{alpha:true,desynchronized:true});
  const fluidSource=document.createElement('canvas');
  const fluidSourceCtx=fluidSource.getContext('2d',{alpha:true,willReadFrequently:true});
  const fluidBlur=document.createElement('canvas');
  const fluidBlurCtx=fluidBlur.getContext('2d',{alpha:true,willReadFrequently:true});
  let fluidRaf=0,fluidActive=false,fluidInitialized=false,fluidScale=1,fluidLastFrame=0,fluidIdleTimer=0,fluidLastPointerTime=0;
  let fluidVisualScale=0,fluidScaleTarget=0;
  let fluidWidth=0,fluidHeight=0;
  let fluidParticles=[];
  let fluidTarget={x:0,y:0},fluidCurrent={x:0,y:0},fluidPrevious={x:0,y:0};

  function resizeFluidCanvas(){
    if(!fluidCanvas||!fluidCtx)return;
    const width=Math.max(1,window.innerWidth),height=Math.max(1,window.innerHeight);
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    fluidCanvas.width=Math.round(width*dpr);
    fluidCanvas.height=Math.round(height*dpr);
    fluidCanvas.style.width=width+'px';
    fluidCanvas.style.height=height+'px';
    fluidCtx.setTransform(dpr,0,0,dpr,0,0);
    fluidCtx.imageSmoothingEnabled=true;
    fluidScale=Math.min(1,960/Math.max(width,height));
    fluidWidth=Math.max(1,Math.ceil(width*fluidScale));
    fluidHeight=Math.max(1,Math.ceil(height*fluidScale));
    fluidSource.width=fluidWidth;fluidSource.height=fluidHeight;
    fluidBlur.width=fluidWidth;fluidBlur.height=fluidHeight;
    if((fluidActive||fluidParticles.length)&&!fluidRaf){
      fluidRaf=requestAnimationFrame(renderFluidCursor);
    }
  }

  function addFluidParticle(x,y,radius,life,vx=0,vy=0){
    fluidParticles.push({x,y,radius,life,maxLife:life,vx,vy});
    if(fluidParticles.length>190)fluidParticles.splice(0,fluidParticles.length-190);
  }

  function moveFluidCursor(e){
    if(!fluidCanvas||!fluidCtx||window.matchMedia('(max-width: 680px)').matches)return;
    const x=e.clientX,y=e.clientY;
    clearTimeout(fluidIdleTimer);
    fluidIdleTimer=window.setTimeout(hideFluidCursor,320);
    if(!fluidInitialized){
      fluidInitialized=true;
      fluidTarget={x,y};fluidCurrent={x,y};fluidPrevious={x,y};
      fluidLastPointerTime=performance.now();
      addFluidParticle(x,y,76,560);
    }else{
      const dx=x-fluidTarget.x,dy=y-fluidTarget.y;
      const distance=Math.hypot(dx,dy);
      const pointerNow=performance.now();
      const pointerDelta=Math.max(8,pointerNow-fluidLastPointerTime);
      const pointerSpeed=distance/pointerDelta;
      fluidLastPointerTime=pointerNow;
      const distanceFactor=clamp(distance/150,0,1);
      const speedFactor=clamp(pointerSpeed/1.15,0,1);
      const movementIntensity=Math.max(distanceFactor,speedFactor);
      fluidScaleTarget=1+movementIntensity*.24;
      if(distance>1.5){
        const steps=Math.min(24,Math.max(1,Math.ceil(distance/13)));
        const speed=Math.min(distance,90);
        for(let i=1;i<=steps;i++){
          const t=i/steps,px=fluidTarget.x+dx*t,py=fluidTarget.y+dy*t;
          addFluidParticle(px,py,clamp(50+speed*.10,50,68),560+Math.random()*260,dx/steps*.16,dy/steps*.16);
          if(distance>32&&i%3===0){
            const side=(Math.random()-.5)*2,length=Math.hypot(dx,dy)||1;
            const nx=-dy/length,ny=dx/length,offset=side*(17+Math.random()*20);
            addFluidParticle(px+nx*offset,py+ny*offset,13+Math.random()*12,
              320+Math.random()*150,dx/steps*.09+nx*side*.25,dy/steps*.09+ny*side*.25);
          }
        }
      }
      fluidTarget={x,y};
    }
    fluidActive=true;fluidCanvas.classList.add('is-active');
    invertLayer?.classList.add('is-visible');
    if(!fluidRaf){fluidLastFrame=performance.now();fluidRaf=requestAnimationFrame(renderFluidCursor);}
  }

  function renderFluidCursor(now){
    fluidRaf=0;
    if(!fluidCanvas||!fluidCtx||!fluidSourceCtx||!fluidBlurCtx)return;
    const elapsed=Math.min(34,Math.max(1,now-fluidLastFrame||16.67));
    const frameScale=elapsed/16.67;
    fluidLastFrame=now;
    if(fluidActive){
      fluidCurrent.x+=(fluidTarget.x-fluidCurrent.x)*.22;
      fluidCurrent.y+=(fluidTarget.y-fluidCurrent.y)*.22;
    }
    const scaleEase=fluidActive ? 0.018 : 0.012;
    fluidVisualScale+=(fluidScaleTarget-fluidVisualScale)*scaleEase;
    if(Math.abs(fluidScaleTarget-fluidVisualScale)<.002)fluidVisualScale=fluidScaleTarget;
    const vx=fluidCurrent.x-fluidPrevious.x,vy=fluidCurrent.y-fluidPrevious.y;
    const speed=Math.hypot(vx,vy),angle=Math.atan2(vy,vx||.0001);
    fluidPrevious={...fluidCurrent};
    fluidSourceCtx.clearRect(0,0,fluidWidth,fluidHeight);
    fluidSourceCtx.save();
    fluidSourceCtx.translate(fluidCurrent.x*fluidScale,fluidCurrent.y*fluidScale);
    fluidSourceCtx.scale(fluidVisualScale,fluidVisualScale);
    fluidSourceCtx.translate(-fluidCurrent.x*fluidScale,-fluidCurrent.y*fluidScale);
    fluidSourceCtx.fillStyle='#fff';
    fluidSourceCtx.globalCompositeOperation='source-over';
    for(let i=fluidParticles.length-1;i>=0;i--){
      const p=fluidParticles[i];
      p.life-=elapsed;
      if(p.life<=0){fluidParticles.splice(i,1);continue;}
      p.x+=p.vx*frameScale;p.y+=p.vy*frameScale;
      p.vx*=Math.pow(.935,frameScale);p.vy*=Math.pow(.935,frameScale);
      const life=clamp(p.life/p.maxLife,0,1);
      const radius=p.radius*(.22+.78*life);
      fluidSourceCtx.globalAlpha=Math.pow(life,1.15)*.9;
      fluidSourceCtx.beginPath();
      fluidSourceCtx.arc(p.x*fluidScale,p.y*fluidScale,radius*fluidScale,0,Math.PI*2);
      fluidSourceCtx.fill();
    }
    if(fluidActive){
      const stretch=1+Math.min(speed/85,.22),squash=1-Math.min(speed/85,.10);
      fluidSourceCtx.globalAlpha=.98;
      fluidSourceCtx.save();
      fluidSourceCtx.translate(fluidCurrent.x*fluidScale,fluidCurrent.y*fluidScale);
      if(speed>.35)fluidSourceCtx.rotate(angle);
      fluidSourceCtx.beginPath();
      fluidSourceCtx.ellipse(0,0,104*fluidScale*stretch,118*fluidScale*squash,0,0,Math.PI*2);
      fluidSourceCtx.fill();
      fluidSourceCtx.restore();
    }
    fluidSourceCtx.restore();

    fluidBlurCtx.clearRect(0,0,fluidWidth,fluidHeight);
    fluidBlurCtx.save();
    fluidBlurCtx.filter='blur(7px)';
    fluidBlurCtx.drawImage(fluidSource,0,0);
    fluidBlurCtx.restore();
    const pixels=fluidBlurCtx.getImageData(0,0,fluidWidth,fluidHeight);
    const data=pixels.data;
    for(let i=0;i<data.length;i+=4){
      const alpha=data[i+3]/255,t=clamp((alpha-.12)/.48,0,1),smooth=t*t*(3-2*t);
      data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=Math.round(smooth*255);
    }
    fluidBlurCtx.putImageData(pixels,0,0);
    fluidCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    fluidCtx.drawImage(fluidBlur,0,0,fluidWidth,fluidHeight,0,0,window.innerWidth,window.innerHeight);
    const pointerLag=fluidActive?Math.hypot(fluidTarget.x-fluidCurrent.x,fluidTarget.y-fluidCurrent.y):0;
    if(fluidParticles.length||pointerLag>.35||Math.abs(fluidScaleTarget-fluidVisualScale)>.002||fluidVisualScale>.002){
      fluidCanvas.classList.add('is-active');
      fluidRaf=requestAnimationFrame(renderFluidCursor);
    }else if(!fluidActive){
      fluidCanvas.classList.remove('is-active');
      fluidCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
      fluidInitialized=false;fluidLastFrame=0;fluidVisualScale=0;
    }
  }

  function hideFluidCursor(){
    clearTimeout(fluidIdleTimer);
    fluidIdleTimer=0;
    fluidActive=false;
    fluidScaleTarget=0;
    fluidLastPointerTime=0;
    invertLayer?.classList.remove('is-visible');
    if(!fluidRaf){fluidLastFrame=performance.now();fluidRaf=requestAnimationFrame(renderFluidCursor);}
  }
  resizeFluidCanvas();
  window.addEventListener('resize',resizeFluidCanvas,{passive:true});

  function handlePointer(e){
    if(e.pointerType!=='mouse'&&e.pointerType!=='pen')return;
    trackEyes(e);
    /* El cursor mantiene el mismo efecto global sobre el avatar.
       El revelado del cráneo se suma sin sustituir la inversión cromática. */
    moveFluidCursor(e);
    if(pointInsideAvatar(e)){
      activateReveal(e);
    }else if(stage.classList.contains('is-hovering')){
      closeReveal();
    }
  }

  function stopVisualEffects(){
    clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(touchRevealTimer);clearTimeout(revealIdleTimer);
    if(pupilRaf)cancelAnimationFrame(pupilRaf);
    if(revealRaf)cancelAnimationFrame(revealRaf);
    if(fluidRaf)cancelAnimationFrame(fluidRaf);
    if(invertLayer)invertLayer.classList.remove('is-visible');
    revealIdleTimer=0;revealLastPointerTime=0;
    if(stage){stage.classList.remove('is-hovering','is-closing','is-blinking','is-smiling');}
    if(peekShape){peekShape.setAttribute('opacity','0');}
  }

  function bindInteractions(){
    stage.addEventListener('click',()=>{if(!liteMode)flashSmile();});
    const supportsHover=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if(supportsHover){
      window.addEventListener('pointermove',handlePointer,{passive:true});
      window.addEventListener('pointerout',e=>{
        if(!e.relatedTarget){hideFluidCursor();closeReveal();}
      },{passive:true});
    }else{
      let touchActive=false;
      document.addEventListener('touchstart',e=>{
        if(!e.touches.length)return;
        const t=e.touches[0],point={clientX:t.clientX,clientY:t.clientY};
        touchActive=true;trackEyes(point);
        if(pointInsideAvatar(point)){hideFluidCursor();activateReveal(point);}
        else{moveFluidCursor(point);if(stage.classList.contains('is-hovering'))closeReveal();}
      },{passive:true});
      document.addEventListener('touchmove',e=>{
        if(!touchActive||!e.touches.length)return;
        const t=e.touches[0],point={clientX:t.clientX,clientY:t.clientY};
        trackEyes(point);
        if(pointInsideAvatar(point)){hideFluidCursor();activateReveal(point);}
        else{moveFluidCursor(point);setRevealTarget(point);if(stage.classList.contains('is-hovering'))closeReveal();}
      },{passive:true});
      const finishTouch=()=>{
        touchActive=false;
        hideFluidCursor();
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
    clearTimeout(smileTimer);clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(touchRevealTimer);if(fluidRaf)cancelAnimationFrame(fluidRaf);
    if(pupilRaf)cancelAnimationFrame(pupilRaf);
    if(revealRaf)cancelAnimationFrame(revealRaf);
  });
})();
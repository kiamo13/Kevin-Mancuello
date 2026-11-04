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
  let svg,skull,peekShape,revealPath,revealBlur,revealEllipseShape,revealParticleShapes=[],pupils=[];
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

  /* ------------------------------------------------------------------
     REVELADO DEL CRÁNEO — campo compartido (v62)
     En escritorio, piel, cabello y barba se componen en #avatar-face-canvas
     y se perforan con los MISMOS píxeles del campo del cursor (fluidBlur),
     en el mismo fotograma. Posición, tamaño, partículas, fusión, desenfoque,
     alpha y desaparición son idénticos por construcción, no por imitación.
     El SVG conserva cráneo, ojos, pupilas y brillos debajo del canvas.
     ------------------------------------------------------------------ */
  const FACE_LAYERS=['cara_ojos_abiertos_neutro','ojos_sonrientes','cara_ojos_abiertos_neutro_copia','cabello-silueta','cabello-base','cabello-parpadeo','BARBA'];
  let svgSource='',faceCanvas=null,faceCtx=null,faceBitmaps=new Map(),faceLayerEls=[];
  let faceRasterReady=false,faceRasterScale=0,faceRasterJob=0,faceRasterOn=false,revealFullHide=null;
  let faceState=[],faceStateTick=0,faceStateDirty=true;

  function svgElement(name,attrs={}){
    const el=document.createElementNS('http://www.w3.org/2000/svg',name);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  }

  function addRevealMask(){
    const defs=svgElement('defs');
    const blurFilter=svgElement('filter',{
      id:'skullRevealBlur',
      x:'-60%',y:'-60%',width:'220%',height:'220%'
    });
    revealBlur=svgElement('feGaussianBlur',{
      in:'SourceGraphic',
      stdDeviation:'7',
      result:'skullBlur'
    });
    const alphaTransfer=svgElement('feComponentTransfer',{in:'skullBlur'});
    alphaTransfer.appendChild(svgElement('feFuncA',{
      type:'table',
      tableValues:'0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00000 0.00392 0.00392 0.00392 0.00784 0.01176 0.01176 0.01569 0.01961 0.02353 0.02745 0.03137 0.03922 0.04314 0.05098 0.05490 0.06275 0.06667 0.07451 0.08235 0.08627 0.09412 0.10196 0.10980 0.11765 0.12941 0.13725 0.14510 0.15294 0.16471 0.17255 0.18431 0.19216 0.20392 0.21176 0.22353 0.23529 0.24314 0.25490 0.26667 0.27843 0.28627 0.29804 0.30980 0.32157 0.33333 0.34510 0.35686 0.36863 0.38039 0.39216 0.40392 0.41569 0.42745 0.44314 0.45490 0.46667 0.47843 0.49020 0.50196 0.51373 0.52549 0.53725 0.55294 0.56471 0.57647 0.58824 0.60000 0.61176 0.62353 0.63529 0.64706 0.65882 0.67059 0.68235 0.69412 0.70588 0.71765 0.72941 0.73725 0.74902 0.76078 0.77255 0.78039 0.79216 0.80000 0.81176 0.81961 0.83137 0.83922 0.85098 0.85882 0.86667 0.87451 0.88235 0.89020 0.89804 0.90588 0.91373 0.92157 0.92941 0.93333 0.94118 0.94902 0.95294 0.95686 0.96471 0.96863 0.97255 0.97647 0.98039 0.98431 0.98824 0.99216 0.99216 0.99608 0.99608 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000 1.00000'
    }));
    blurFilter.append(revealBlur,alphaTransfer);

    const mask=svgElement('mask',{
      id:'avatarFaceMask',
      maskUnits:'userSpaceOnUse',
      maskContentUnits:'userSpaceOnUse',
      x:'0',y:'0',width:'630.979',height:'739.979',
      'mask-type':'luminance'
    });
    mask.appendChild(svgElement('rect',{x:0,y:0,width:630.979,height:739.979,fill:'#fff'}));
    peekShape=svgElement('g',{
      id:'skull-peek-shape',
      fill:'#000',
      filter:'url(#skullRevealBlur)',
      opacity:0
    });
    revealPath=svgElement('path',{
      fill:'#000',
      d:'M 315 303 C 342 303 363 330 363 365 C 363 400 342 427 315 427 C 288 427 267 400 267 365 C 267 330 288 303 315 303 Z'
    });
    revealEllipseShape=svgElement('path',{fill:'#000',opacity:0});
    peekShape.append(revealPath,revealEllipseShape);
    mask.appendChild(peekShape);
    // Modo campo compartido: las capas del rostro del SVG se ocultan por completo
    // (el canvas las dibuja encima ya perforadas). Sin filtro para no difuminar el borde exterior.
    revealFullHide=svgElement('rect',{x:-40,y:-40,width:710.979,height:819.979,fill:'#000',display:'none'});
    mask.appendChild(revealFullHide);
    defs.append(blurFilter,mask);
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
        svgSource=source;
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
        if(!liteMode)setupFaceRaster();
        if(!liteMode)bindInteractions();
        stage.classList.add('avatar-ready');
      })
      .catch(error=>{
        console.error(error);
        mount.innerHTML='<p class="avatar-error">No se pudo cargar el avatar.</p>';
      });
  }

  /* --- coordenadas exactas pantalla ↔ SVG (respeta viewBox, preserveAspectRatio y transformaciones) --- */
  function clientToSvg(x,y){
    const m=svg&&svg.getScreenCTM();
    if(!m)return {x:0,y:0};
    return new DOMPoint(x,y).matrixTransform(m.inverse());
  }
  function svgUnitsPerCssPx(){
    const m=svg&&svg.getScreenCTM();
    return m?1/Math.max(.0001,Math.hypot(m.a,m.b)):1;
  }

  /* --- campo compartido: rasterizado por capa --- */
  function setupFaceRaster(){
    if(!fluidCanvas||!fluidCtx)return;
    faceCanvas=document.createElement('canvas');
    faceCanvas.className='avatar-face-canvas';
    faceCanvas.setAttribute('aria-hidden','true');
    mount.appendChild(faceCanvas);
    faceCtx=faceCanvas.getContext('2d',{alpha:true});
    faceLayerEls=FACE_LAYERS.map(id=>svg.querySelector('#'+id)).filter(Boolean);
    new MutationObserver(()=>{faceStateDirty=true;}).observe(stage,{attributes:true,attributeFilter:['class']});
    rasterizeFaceLayers();
    let t=0;
    window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(rasterizeFaceLayers,140);},{passive:true});
  }

  function rasterizeFaceLayers(){
    if(!faceCanvas||!svg||!svgSource)return;
    const r=faceCanvas.getBoundingClientRect();
    if(r.width<2||r.height<2)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    faceCanvas.width=Math.round(r.width*dpr);
    faceCanvas.height=Math.round(r.height*dpr);
    const m=svg.getScreenCTM();
    const s=m?Math.hypot(m.a,m.b):1;
    const vb=svg.viewBox.baseVal;
    const pw=Math.max(1,Math.round(vb.width*s*dpr)),ph=Math.max(1,Math.round(vb.height*s*dpr));
    if(faceRasterReady&&Math.abs(pw-faceRasterScale)<1)return;
    // Los bitmaps anteriores siguen en uso (escalados) hasta que los nuevos estén listos.
    const job=++faceRasterJob;
    const parser=new DOMParser(),serializer=new XMLSerializer();
    const loads=FACE_LAYERS.map(id=>new Promise(resolve=>{
      const doc=parser.parseFromString(svgSource,'image/svg+xml');
      const root=doc.documentElement;
      [...root.children].forEach(child=>{
        if(child.tagName.toLowerCase()!=='defs'&&child.getAttribute('id')!==id)child.remove();
      });
      root.setAttribute('width',pw);root.setAttribute('height',ph);
      const url=URL.createObjectURL(new Blob([serializer.serializeToString(root)],{type:'image/svg+xml'}));
      const img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve([id,img]);};
      img.onerror=()=>{URL.revokeObjectURL(url);resolve([id,null]);};
      img.src=url;
    }));
    Promise.all(loads).then(list=>{
      if(job!==faceRasterJob)return;
      if(list.some(([,img])=>!img)){console.warn('Revelado: no se pudo rasterizar una capa; se usa la máscara SVG.');return;}
      faceBitmaps=new Map(list);
      faceRasterScale=pw;
      faceRasterReady=true;
    });
  }

  function fieldNearAvatar(){
    const r=stage.getBoundingClientRect(),pad=260;
    const inside=(x,y)=>x>r.left-pad&&x<r.right+pad&&y>r.top-pad&&y<r.bottom+pad;
    if((fluidActive||fluidVisualScale>.002)&&inside(fluidCurrent.x,fluidCurrent.y))return true;
    for(let i=0;i<fluidParticles.length;i++){if(inside(fluidParticles[i].x,fluidParticles[i].y))return true;}
    return false;
  }

  function setFaceRasterMode(on){
    if(faceRasterOn===on)return;
    faceRasterOn=on;
    stage.classList.toggle('km-raster',on);
    if(revealFullHide)revealFullHide.setAttribute('display',on?'inline':'none');
    if(peekShape)peekShape.setAttribute('display',on?'none':'inline');
    if(!on&&faceCtx)faceCtx.clearRect(0,0,faceCanvas.width,faceCanvas.height);
  }

  // Se llama desde renderFluidCursor, después de procesar el campo: mismo fotograma, mismos píxeles.
  function composeFaceRaster(){
    if(!faceCtx||!faceRasterReady||!usesFluidCursorReveal()||!fieldNearAvatar()){
      if(faceRasterOn)setFaceRasterMode(false);
      return;
    }
    setFaceRasterMode(true);
    const r=faceCanvas.getBoundingClientRect();
    const m=svg.getScreenCTM();
    if(!m||r.width<2)return;
    const kx=faceCanvas.width/r.width,ky=faceCanvas.height/r.height;
    const vb=svg.viewBox.baseVal;
    const ox=(m.e-r.left)*kx,oy=(m.f-r.top)*ky;
    const w=vb.width*m.a*kx,h=vb.height*m.d*ky;
    faceCtx.setTransform(1,0,0,1,0,0);
    faceCtx.globalCompositeOperation='source-over';
    faceCtx.globalAlpha=1;
    faceCtx.clearRect(0,0,faceCanvas.width,faceCanvas.height);
    // Las capas se componen según su estado real en el DOM (sonrisa, parpadeo, cuadro del pelo).
    // El estado se relee al cambiar la clase del escenario y cada 2 fotogramas (el pelo cambia cada 200 ms).
    if(faceStateDirty||(++faceStateTick&1)===0||!faceState.length){
      faceStateDirty=false;
      faceState=faceLayerEls.map(el=>{
        const cs=getComputedStyle(el);
        const op=(cs.display==='none'||cs.visibility==='hidden')?0:parseFloat(cs.opacity);
        return {img:faceBitmaps.get(el.id),op:op>0?op:0};
      });
    }
    for(const s of faceState){
      if(!s.op||!s.img)continue;
      faceCtx.globalAlpha=s.op;
      faceCtx.drawImage(s.img,ox,oy,w,h);
    }
    // Perforación con el campo del cursor: la misma porción que el canvas global pinta en esa zona.
    const fx=fluidWidth/Math.max(1,window.innerWidth),fy=fluidHeight/Math.max(1,window.innerHeight);
    faceCtx.globalAlpha=1;
    faceCtx.globalCompositeOperation='destination-out';
    faceCtx.drawImage(fluidBlur,r.left*fx,r.top*fy,r.width*fx,r.height*fy,0,0,faceCanvas.width,faceCanvas.height);
    faceCtx.globalCompositeOperation='source-over';
    faceCtx.globalAlpha=1;
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
    const faceRect=svg.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const intensity=clamp(speed/85,0,1);
    // Coincide con la elipse del cursor: 104 x 118 px, incluido su squash/stretch.
    const u=svgUnitsPerCssPx();
    const rx=104*u*scale*(1+Math.min(speed/85,.22));
    const ry=118*u*scale*(1-Math.min(speed/85,.10));
    const direction=Math.atan2(revealVelocity.y,revealVelocity.x||.0001);
    const rotation=speed>.35?direction:0;

    for(let i=0;i<count;i++){
      const a=(Math.PI*2*i)/count;
      const wobble=1+.075*Math.sin(3*a+phase)+.038*Math.sin(5*a-phase*1.35)+.022*Math.sin(2*a+phase*.7);
      const x=Math.cos(a)*rx*wobble;
      const y=Math.sin(a)*ry*wobble;
      points.push({
        x:cx+x*Math.cos(rotation)-y*Math.sin(rotation),
        y:cy+x*Math.sin(rotation)+y*Math.cos(rotation)
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
  function sharedReveal(){return usesFluidCursorReveal()&&faceRasterReady&&!!faceCtx;}
  function usesFluidCursorReveal(){
    return !!(fluidCanvas&&fluidCtx)&&!reducedMotion;
  }

  function syncRevealBlur(){
    if(!revealBlur||!svg)return;
    const rect=svg.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const blurPixels=7/Math.max(.1,fluidScale);
    const sx=blurPixels*svgUnitsPerCssPx();
    const sy=sx;
    revealBlur.setAttribute('stdDeviation',sx.toFixed(2)+' '+sy.toFixed(2));
  }

  function renderReveal(){
    revealRaf=0;
    if(sharedReveal()){
      // El dibujo lo hace composeFaceRaster() dentro del fotograma del cursor.
      // Acá solo se cierra el estado cuando el campo terminó de desaparecer.
      if(!fluidActive&&fluidVisualScale===0&&!fluidParticles.length&&stage.classList.contains('is-hovering')){
        stage.classList.remove('is-hovering','is-closing');
        scheduleBlink();
      }
      return;
    }

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
    if(Math.abs(revealScaleTarget-revealScale)<.006)revealScale=revealScaleTarget;
    if(speed>.08)revealPhase+=Math.min(speed*.012,.13);
    if(revealPath.parentNode!==peekShape)peekShape.replaceChildren(revealPath);
    syncRevealBlur();
    revealPath.setAttribute('d',organicRevealPath(
      revealCurrent.x,revealCurrent.y,revealPhase,speed,revealScale
    ));
    const moving=Math.abs(dx)>.08||Math.abs(dy)>.08||Math.abs(revealScaleTarget-revealScale)>.006;
    if(moving){
      revealRaf=requestAnimationFrame(renderReveal);
    }else if(revealScaleTarget===0&&revealScale===0){
      stage.classList.remove('is-hovering','is-closing');
    }
  }
  function requestRevealFrame(){
    if(!revealRaf)revealRaf=requestAnimationFrame(renderReveal);
  }

  function setRevealTarget(e){
    if(!svg)return;
    const p=clientToSvg(e.clientX,e.clientY);
    revealTarget={x:clamp(p.x,55,575),y:clamp(p.y,135,640)};

    // En escritorio, escala y temporizador provienen directamente del cursor global.
    if(!sharedReveal()){
      const now=performance.now();
      const pointerX=e.clientX,pointerY=e.clientY;
      if(stage.classList.contains('is-hovering')&&revealLastPointerTime){
        const elapsed=Math.max(8,now-revealLastPointerTime);
        const dx=pointerX-revealLastPointerScreen.x;
        const dy=pointerY-revealLastPointerScreen.y;
        const distance=Math.hypot(dx,dy);
        const distanceFactor=clamp(distance/150,0,1);
        const speedFactor=clamp((distance/elapsed)/1.15,0,1);
        revealScaleTarget=1+Math.max(distanceFactor,speedFactor)*.24;
      }else{
        revealScaleTarget=1;
      }
      revealLastPointerScreen={x:pointerX,y:pointerY};
      revealLastPointerTime=now;
      clearTimeout(revealIdleTimer);
      revealIdleTimer=window.setTimeout(()=>{
        revealIdleTimer=0;
        if(stage.classList.contains('is-hovering')){
          revealScaleTarget=0;
          requestRevealFrame();
        }
      },320);
    }
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
      if(sharedReveal()){
        const rect=svg.getBoundingClientRect();
        const vb=svg.viewBox.baseVal;
        revealCurrent={
          x:clamp((fluidCurrent.x-rect.left)/Math.max(1,rect.width)*vb.width,55,575),
          y:clamp((fluidCurrent.y-rect.top)/Math.max(1,rect.height)*vb.height,135,640)
        };
        revealScale=fluidVisualScale;
      }else{
        revealCurrent={...revealTarget};
        revealScale=.04;
        revealScaleTarget=1;
      }
      previousReveal={...revealCurrent};
      revealVelocity={x:0,y:0};
      stage.classList.remove('is-blinking','is-closing');
      clearTimeout(blinkTimer);
      clearTimeout(blinkEnd);
      stage.classList.add('is-hovering');
      if(revealPath.parentNode!==peekShape)peekShape.replaceChildren(revealPath);
      syncRevealBlur();
      revealPath.setAttribute('d',organicRevealPath(
        revealCurrent.x,revealCurrent.y,revealPhase,0,revealScale
      ));
    }
    requestRevealFrame();
  }

  function closeReveal(){
    clearTimeout(revealIdleTimer);
    revealIdleTimer=0;
    revealLastPointerTime=0;
    stage.classList.remove('is-hovering','is-closing');
    if(!sharedReveal()){
      revealScaleTarget=0;
      requestRevealFrame();
    }
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
  let fluidVisualScale=0,fluidScaleTarget=0,fluidCursorSpeed=0,fluidCursorAngle=0;
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
    if(!fluidCanvas||!fluidCtx||reducedMotion)return;
    const x=e.clientX,y=e.clientY;
    clearTimeout(fluidIdleTimer);
    fluidIdleTimer=window.setTimeout(hideFluidCursor,320);
    if(!fluidInitialized){
      fluidInitialized=true;
      fluidTarget={x,y};fluidCurrent={x,y};fluidPrevious={x,y};
      fluidLastPointerTime=performance.now();
      fluidScaleTarget=1;
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
    fluidCursorSpeed=speed;
    fluidCursorAngle=angle;
    if(stage.classList.contains('is-hovering'))requestRevealFrame();
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
    composeFaceRaster();
    const pointerLag=fluidActive?Math.hypot(fluidTarget.x-fluidCurrent.x,fluidTarget.y-fluidCurrent.y):0;
    if(fluidParticles.length||pointerLag>.35||Math.abs(fluidScaleTarget-fluidVisualScale)>.002||fluidVisualScale>.002){
      fluidCanvas.classList.add('is-active');
      fluidRaf=requestAnimationFrame(renderFluidCursor);
    }else if(!fluidActive){
      fluidCanvas.classList.remove('is-active');
      fluidCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
      fluidInitialized=false;fluidLastFrame=0;fluidVisualScale=0;
      composeFaceRaster();
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
        if(pointInsideAvatar(point)){moveFluidCursor(point);activateReveal(point);}
        else{moveFluidCursor(point);if(stage.classList.contains('is-hovering'))closeReveal();}
      },{passive:true});
      document.addEventListener('touchmove',e=>{
        if(!touchActive||!e.touches.length)return;
        const t=e.touches[0],point={clientX:t.clientX,clientY:t.clientY};
        trackEyes(point);
        if(pointInsideAvatar(point)){moveFluidCursor(point);activateReveal(point);}
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
// Loops de las tarjetas de proyecto: corren solo cuando se ven; nunca en modo Lite ni con movimiento reducido.
(()=>{
  const loops=[...document.querySelectorAll('video[data-loop]')];
  if(!loops.length)return;
  const still=document.documentElement.classList.contains('is-lite')||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(still||!('IntersectionObserver' in window))return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.play().catch(()=>{});else e.target.pause();}),{threshold:.3});
  loops.forEach(v=>io.observe(v));
})();

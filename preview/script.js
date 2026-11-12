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
  // v118 — sin botón: la versión liviana solo se activa sola en equipos o conexiones limitadas
  try{localStorage.removeItem('km-site-mode');}catch(e){}
  let liteMode=autoLite;
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
  const FACE_LAYERS=['cara_ojos_abiertos_neutro','ojos_sonrientes','cara_ojos_abiertos_neutro_copia','cabello-silueta','cabello-base','cabello-parpadeo','cabello-frame3','BARBA'];
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
      'cabello-parpadeo',
      'cabello-frame3'
    ].forEach(id=>{
      const layer=svg.querySelector('#'+id);
      if(layer)layer.setAttribute('mask','url(#avatarFaceMask)');
    });
  }

  function loadAvatar(){
    fetch(new URL('assets/avatar.svg?v=20261111-2',document.baseURI),{cache:'no-store'})
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
    if(!fluidOn)return;
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
    if(fluidAlive&&fluidBox.x1>r.left-pad&&fluidBox.x0<r.right+pad&&fluidBox.y1>r.top-pad&&fluidBox.y0<r.bottom+pad)return true;
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
    // con WebGL la fuente es el propio lienzo del fluido (se lee en el mismo fotograma en que se dibujó)
    const src=fluidGL?fluidCanvas:fluidBlur;
    const fx=(fluidGL?fluidCanvas.width:fluidWidth)/Math.max(1,window.innerWidth),fy=(fluidGL?fluidCanvas.height:fluidHeight)/Math.max(1,window.innerHeight);
    faceCtx.globalAlpha=1;
    faceCtx.globalCompositeOperation='destination-out';
    faceCtx.drawImage(src,r.left*fx,r.top*fy,r.width*fx,r.height*fy,0,0,faceCanvas.width,faceCanvas.height);
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
    smileTimer=window.setTimeout(()=>{
      smileActive=false;
      stage.classList.remove('is-smiling');
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
    return fluidOn&&!reducedMotion;
  }

  function syncRevealBlur(){
    if(!revealBlur||!svg)return;
    const rect=svg.getBoundingClientRect();
    const vb=svg.viewBox.baseVal;
    const blurPixels=12;   // mismo desenfoque (en px de pantalla) que el campo del fluido
    const sx=blurPixels*svgUnitsPerCssPx();
    const sy=sx;
    revealBlur.setAttribute('stdDeviation',sx.toFixed(2)+' '+sy.toFixed(2));
  }

  function renderReveal(){
    revealRaf=0;
    if(sharedReveal()){
      // El dibujo lo hace composeFaceRaster() dentro del fotograma del cursor.
      // Acá solo se cierra el estado cuando el campo terminó de desaparecer.
      if(!fluidActive&&fluidVisualScale===0&&!fluidAlive&&stage.classList.contains('is-hovering')){
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
        },300);
      }else{
        scheduleBlink();
      }
    },1600+Math.random()*2200);
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
  /* v79 — el campo se dibuja en la placa de video (WebGL): la grilla sube como una textura chica y un
     sombreador la suaviza (bicúbica) y recorta el borde. En celular el camino 2D (desenfoque + getImageData
     por píxel) costaba 30–45 ms por cuadro y el fluido iba a tirones. Sin WebGL queda el camino 2D. */
  const fluidGL=fluidCanvas?.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'})||null;
  const fluidCtx=fluidCanvas&&!fluidGL?fluidCanvas.getContext('2d',{alpha:true,desynchronized:true}):null;
  const fluidOn=!!(fluidGL||fluidCtx);
  const fluidSource=document.createElement('canvas');
  const fluidSourceCtx=fluidSource.getContext('2d',{alpha:true,willReadFrequently:true});
  const fluidBlur=document.createElement('canvas');
  const fluidBlurCtx=fluidBlur.getContext('2d',{alpha:true,willReadFrequently:true});
  let fluidRaf=0,fluidActive=false,fluidInitialized=false,fluidScale=1,fluidLastFrame=0,fluidIdleTimer=0,fluidLastPointerTime=0;
  let fluidVisualScale=0,fluidScaleTarget=0,fluidCursorSpeed=0,fluidCursorAngle=0;
  let fluidWidth=0,fluidHeight=0;
  let fluidTarget={x:0,y:0},fluidCurrent={x:0,y:0},fluidPrevious={x:0,y:0};
  /* v68 — fluido tipo Buttermax: una grilla chica de velocidad y densidad (fluido estable:
     advección semilagrangiana + proyección + confinamiento de vorticidad). El cursor empuja
     el fluido y le suma tinta; la estela se curva, se estira y se disuelve como humo.
     La densidad es el mismo campo (fluidBlur) que invierte la página y perfora el cráneo. */
  const fluidGrid=document.createElement('canvas');
  const fluidGridCtx=fluidGrid.getContext('2d',{alpha:true,willReadFrequently:true});
  let GW=0,GH=0,gU,gV,gU0,gV0,gD,gD0,gP,gDiv,gCurl,gImg=null;
  let fluidAlive=false,fluidBox={x0:0,y0:0,x1:0,y1:0};
  let fluidPendingSplats=[];
  // v77 — cada zona de la página elige cómo se comporta el fluido (atributos data-fluid y data-fluid-color)
  let fluidMode={m:'negativo',c:'#FFFFFF',r:255,g:255,b:255};
  const FLUID_BLEND={negativo:'difference',tinta:'multiply',contorno:'normal'};
  function setFluidMode(x,y){
    const el=document.elementFromPoint(x,y),z=el&&el.closest('[data-fluid]');
    const m=z?z.dataset.fluid:'negativo',c=(z&&z.dataset.fluidColor)||'#FFFFFF';
    if(m===fluidMode.m&&c===fluidMode.c)return;
    const n=parseInt(c.slice(1),16);
    fluidMode={m,c,r:n>>16&255,g:n>>8&255,b:n&255};
    if(fluidCanvas)fluidCanvas.style.mixBlendMode=FLUID_BLEND[m]||'difference';
  }

  // v79 — WebGL: un triángulo que cubre la pantalla; el sombreador lee la densidad de la grilla con
  // interpolación bicúbica (4 lecturas) y aplica el mismo recorte de borde que antes (0,26–0,34; anillo 0,42–0,50).
  let glProg=null,glTex=null,glU=null,glTexW=0,glTexH=0,gTex=null,gBA=null,gBB=null,gKer=null;
  let fluidCoarse=false,fluidModeAt=-1e9;
  function initFluidGL(){
    const gl=fluidGL;if(!gl)return;
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;};
    const vs=sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}');
    const fs=sh(gl.FRAGMENT_SHADER,`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D t;uniform vec2 res;uniform vec3 col;uniform float ring;varying vec2 uv;
vec4 cub(float v){vec4 n=vec4(1.,2.,3.,4.)-v;vec4 s=n*n*n;float x=s.x;float y=s.y-4.*s.x;float z=s.z-4.*s.y+6.*s.x;return vec4(x,y,z,6.-x-y-z)/6.;}
float bic(vec2 c){c=c*res-.5;vec2 f=fract(c);c-=f;vec4 xc=cub(f.x);vec4 yc=cub(f.y);
vec4 o=c.xxyy+vec2(-.5,1.5).xyxy;vec4 s=vec4(xc.xz+xc.yw,yc.xz+yc.yw);o=(o+vec4(xc.yw,yc.yw)/s)/res.xxyy;
float a0=texture2D(t,o.xz).r;float a1=texture2D(t,o.yz).r;float a2=texture2D(t,o.xw).r;float a3=texture2D(t,o.yw).r;
float sx=s.x/(s.x+s.y);float sy=s.z/(s.z+s.w);return mix(mix(a3,a2,sx),mix(a1,a0,sx),sy);}
void main(){float a=bic(uv);float k=smoothstep(.26,.34,a);k=max(0.,k-ring*smoothstep(.42,.5,a));gl_FragColor=vec4(col*k,k);}`);
    const pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){console.warn('Fluido: no compiló el sombreador',gl.getShaderInfoLog(fs));glProg=null;return;}
    glProg=pr;gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    glTex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,glTex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.uniform1i(gl.getUniformLocation(pr,'t'),0);
    glU={res:gl.getUniformLocation(pr,'res'),col:gl.getUniformLocation(pr,'col'),ring:gl.getUniformLocation(pr,'ring')};
    gl.clearColor(0,0,0,0);glTexW=glTexH=0;
  }
  if(fluidGL){
    initFluidGL();
    fluidCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();glProg=null;},false);
    fluidCanvas.addEventListener('webglcontextrestored',()=>{initFluidGL();},false);
  }
  // el desenfoque de 12 px de antes, hecho sobre la grilla (separable, pocas celdas) antes de subirla
  function fluidBlurKernel(cp){
    const s=Math.sqrt(Math.max(.05,(12/cp)*(12/cp)-1/3)),R=Math.max(1,Math.ceil(s*2.5));
    gKer=new Float32Array(2*R+1);let sum=0;
    for(let k=-R;k<=R;k++){const w=Math.exp(-k*k/(2*s*s));gKer[k+R]=w;sum+=w;}
    for(let k=0;k<gKer.length;k++)gKer[k]/=sum;
  }
  function drawFluidGL(any){
    const gl=fluidGL;
    gl.viewport(0,0,fluidCanvas.width,fluidCanvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if(!any||!glProg)return;
    const R=(gKer.length-1)>>1,n=GW*GH;
    for(let id=0;id<n;id++){const v=gD[id];gBA[id]=v>1?1:v;}
    for(let j=0;j<GH;j++){const row=j*GW;for(let i=0;i<GW;i++){let acc=0;for(let k=-R;k<=R;k++){const x=i+k;acc+=gKer[k+R]*gBA[row+(x<0?0:x>=GW?GW-1:x)];}gBB[row+i]=acc;}}
    for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){let acc=0;for(let k=-R;k<=R;k++){const y=j+k;acc+=gKer[k+R]*gBB[(y<0?0:y>=GH?GH-1:y)*GW+i];}gTex[j*GW+i]=acc*255+.5;}
    gl.bindTexture(gl.TEXTURE_2D,glTex);
    if(glTexW!==GW||glTexH!==GH){gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,GW,GH,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,gTex);glTexW=GW;glTexH=GH;}
    else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,GW,GH,gl.LUMINANCE,gl.UNSIGNED_BYTE,gTex);
    const fm=fluidMode;
    gl.uniform2f(glU.res,GW,GH);gl.uniform3f(glU.col,fm.r/255,fm.g/255,fm.b/255);gl.uniform1f(glU.ring,fm.m==='contorno'?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }

  function resizeFluidCanvas(){
    if(!fluidOn)return;
    const width=Math.max(1,window.innerWidth),height=Math.max(1,window.innerHeight);
    // en celular y pantallas táctiles el campo se procesa a menor resolución (menos trabajo por cuadro)
    const coarse=window.matchMedia("(pointer: coarse)").matches||width<680;
    fluidCoarse=coarse;
    const dpr=Math.min(window.devicePixelRatio||1,coarse?1.25:1.5);
    fluidCanvas.width=Math.round(width*dpr);
    fluidCanvas.height=Math.round(height*dpr);
    fluidCanvas.style.width=width+'px';
    fluidCanvas.style.height=height+'px';
    if(fluidCtx){fluidCtx.setTransform(dpr,0,0,dpr,0,0);fluidCtx.imageSmoothingEnabled=true;}
    fluidScale=Math.min(1,(coarse?400:640)/Math.max(width,height));   // v78: campo más chico = menos trabajo por cuadro (sin lag)
    fluidWidth=Math.max(1,Math.ceil(width*fluidScale));
    fluidHeight=Math.max(1,Math.ceil(height*fluidScale));
    fluidSource.width=fluidWidth;fluidSource.height=fluidHeight;
    fluidBlur.width=fluidWidth;fluidBlur.height=fluidHeight;
    // la grilla: ~150 celdas en el lado largo (en celular, ~1 celda cada 3 px; en escritorio, cada 10 px)
    const long=Math.max(width,height),cells=coarse?110:150;
    const nw=Math.max(16,Math.round(width/long*cells)),nh=Math.max(16,Math.round(height/long*cells));
    if(nw!==GW||nh!==GH){
      GW=nw;GH=nh;const n=GW*GH;
      gU=new Float32Array(n);gV=new Float32Array(n);gU0=new Float32Array(n);gV0=new Float32Array(n);
      gD=new Float32Array(n);gD0=new Float32Array(n);gP=new Float32Array(n);gDiv=new Float32Array(n);gCurl=new Float32Array(n);
      fluidGrid.width=GW;fluidGrid.height=GH;gImg=fluidGridCtx.createImageData(GW,GH);
      gTex=new Uint8Array(n);gBA=new Float32Array(n);gBB=new Float32Array(n);
    }
    fluidBlurKernel(width/GW);
    if((fluidActive||fluidAlive)&&!fluidRaf){
      fluidRaf=requestAnimationFrame(renderFluidCursor);
    }
  }

  const cellPx=()=>window.innerWidth/GW;   // celdas cuadradas: mismo tamaño en x e y

  function moveFluidCursor(e){
    if(!fluidOn||reducedMotion)return;
    const x=e.clientX,y=e.clientY;
    const pointerNow=performance.now();
    // elementFromPoint fuerza el cálculo de la página: con leerlo cada 100 ms alcanza para saber la zona
    if(pointerNow-fluidModeAt>100){fluidModeAt=pointerNow;setFluidMode(x,y);}
    clearTimeout(fluidIdleTimer);
    fluidIdleTimer=window.setTimeout(hideFluidCursor,320);
    if(!fluidInitialized){
      fluidInitialized=true;
      fluidTarget={x,y};fluidCurrent={x,y};fluidPrevious={x,y};
      fluidScaleTarget=1;
      fluidPendingSplats.push({x,y,dx:0,dy:0,ink:1});
    }else{
      const dx=x-fluidTarget.x,dy=y-fluidTarget.y;
      const distance=Math.hypot(dx,dy);
      const pointerSpeed=distance/Math.max(8,pointerNow-fluidLastPointerTime);
      fluidScaleTarget=1+Math.max(clamp(distance/150,0,1),clamp(pointerSpeed/1.15,0,1))*.24;
      if(distance>.5)fluidPendingSplats.push({x,y,dx,dy,ink:1});
      fluidTarget={x,y};
    }
    fluidLastPointerTime=pointerNow;
    fluidActive=true;fluidCanvas.classList.add('is-active');
    invertLayer?.classList.add('is-visible');
    if(!fluidRaf){fluidLastFrame=performance.now();fluidRaf=requestAnimationFrame(renderFluidCursor);}
  }

  // tinta y empuje con caída gaussiana alrededor de (cx,cy), en celdas
  function fluidSplat(cx,cy,fx,fy,ink,r){
    const R=Math.ceil(r*2.2),i0=Math.max(1,Math.floor(cx-R)),i1=Math.min(GW-2,Math.ceil(cx+R));
    const j0=Math.max(1,Math.floor(cy-R)),j1=Math.min(GH-2,Math.ceil(cy+R)),k=1/(r*r);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const d2=(i-cx)*(i-cx)+(j-cy)*(j-cy),g=Math.exp(-d2*k);
      if(g<.01)continue;
      const id=i+j*GW;
      gU[id]+=fx*g;gV[id]+=fy*g;
      gD[id]=Math.min(1.6,gD[id]+ink*g);
    }
  }
  function fluidAdvect(dst,src,dt){
    for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){
      const id=i+j*GW;
      let x=i-dt*gU[id],y=j-dt*gV[id];
      x=x<.5?.5:x>GW-1.5?GW-1.5:x;y=y<.5?.5:y>GH-1.5?GH-1.5:y;
      const i0=x|0,j0=y|0,s=x-i0,t=y-j0,a=i0+j0*GW;
      dst[id]=(1-t)*((1-s)*src[a]+s*src[a+1])+t*((1-s)*src[a+GW]+s*src[a+GW+1]);
    }
  }
  function fluidStep(dt){
    const n=GW*GH;
    // confinamiento de vorticidad: devuelve los remolinos que la grilla gruesa aplana
    for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const id=i+j*GW;gCurl[id]=(gV[id+1]-gV[id-1]-gU[id+GW]+gU[id-GW])*.5;}
    const eps=.02*dt;
    for(let j=2;j<GH-2;j++)for(let i=2;i<GW-2;i++){
      const id=i+j*GW;
      const nx=(Math.abs(gCurl[id+1])-Math.abs(gCurl[id-1]))*.5,ny=(Math.abs(gCurl[id+GW])-Math.abs(gCurl[id-GW]))*.5;
      const l=Math.sqrt(nx*nx+ny*ny)+1e-5,c=gCurl[id];
      gU[id]+=eps*(ny/l)*c;gV[id]-=eps*(nx/l)*c;
    }
    // proyección: el fluido no se comprime, así que el empuje se reparte en remolinos
    for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const id=i+j*GW;gDiv[id]=-.5*(gU[id+1]-gU[id-1]+gV[id+GW]-gV[id-GW]);gP[id]=0;}
    const iters=fluidCoarse?10:14;
    for(let k=0;k<iters;k++)for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const id=i+j*GW;gP[id]=(gDiv[id]+gP[id-1]+gP[id+1]+gP[id-GW]+gP[id+GW])*.25;}
    for(let j=1;j<GH-1;j++)for(let i=1;i<GW-1;i++){const id=i+j*GW;gU[id]-=.5*(gP[id+1]-gP[id-1]);gV[id]-=.5*(gP[id+GW]-gP[id-GW]);}
    gU0.set(gU);gV0.set(gV);fluidAdvect(gU,gU0,dt);fluidAdvect(gV,gV0,dt);
    gD0.set(gD);fluidAdvect(gD,gD0,dt);
    const vd=Math.pow(.84,dt),dd=Math.pow(.945,dt);   // v77: más viscoso (rígido) y estela más corta
    for(let id=0;id<n;id++){gU[id]*=vd;gV[id]*=vd;gD[id]*=dd;if(gD[id]<.004)gD[id]=0;}
  }

  function renderFluidCursor(now){
    fluidRaf=0;
    if(!fluidOn||!GW)return;
    const elapsed=Math.min(34,Math.max(1,now-fluidLastFrame||16.67));
    const dt=elapsed/16.67;
    fluidLastFrame=now;
    if(fluidActive){
      fluidCurrent.x+=(fluidTarget.x-fluidCurrent.x)*.35;
      fluidCurrent.y+=(fluidTarget.y-fluidCurrent.y)*.35;
    }
    fluidVisualScale+=(fluidScaleTarget-fluidVisualScale)*(fluidActive?.022:.05);   // v78: crece despacio hasta su tamaño
    if(Math.abs(fluidScaleTarget-fluidVisualScale)<.002)fluidVisualScale=fluidScaleTarget;
    const vx=fluidCurrent.x-fluidPrevious.x,vy=fluidCurrent.y-fluidPrevious.y;
    fluidCursorSpeed=Math.hypot(vx,vy);fluidCursorAngle=Math.atan2(vy,vx||.0001);
    if(stage.classList.contains('is-hovering'))requestRevealFrame();
    fluidPrevious={...fluidCurrent};

    // empuje del cursor: cada tramo del recorrido inyecta velocidad y tinta a lo largo del camino
    const cp=cellPx(),rCells=clamp(40/cp,3,12);
    for(const s of fluidPendingSplats){
      const len=Math.hypot(s.dx,s.dy),steps=Math.max(1,Math.min(16,Math.ceil(len/(cp*1.5))));
      const fx=s.dx/cp*.22/steps,fy=s.dy/cp*.22/steps;
      for(let k=1;k<=steps;k++){
        const t=k/steps,px=(s.x-s.dx*(1-t))/cp,py=(s.y-s.dy*(1-t))/cp;
        fluidSplat(px,py,clamp(fx,-2.5,2.5),clamp(fy,-2.5,2.5),(.75/steps+.16)*(.35+.65*fluidVisualScale),rCells*(.9+.2*Math.min(1,len/160))*(.45+.55*fluidVisualScale));
      }
    }
    fluidPendingSplats=[];
    // mientras el cursor está quieto sobre la página, la mancha bajo el puntero se sostiene
    if(fluidActive)fluidSplat(fluidCurrent.x/cp,fluidCurrent.y/cp,0,0,.16*dt*fluidVisualScale,rCells*1.1*fluidVisualScale);
    fluidStep(dt);

    // caja de la zona con tinta (para saber si toca al avatar)
    let any=false,x0=GW,y0=GH,x1=0,y1=0;
    for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){
      if(gD[i+j*GW]>.032){any=true;if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j;}
    }
    fluidAlive=any;
    fluidBox={x0:x0*cp,y0:y0*cp,x1:(x1+1)*cp,y1:(y1+1)*cp};
    if(fluidGL){drawFluidGL(any);fluidFrameEnd();return;}

    // camino 2D (sin WebGL): densidad → alfa
    const d=gImg.data;
    for(let id=0,n=GW*GH;id<n;id++){const v=gD[id],o=id*4;d[o]=255;d[o+1]=255;d[o+2]=255;d[o+3]=v>1?255:(v*255)|0;}
    fluidGridCtx.putImageData(gImg,0,0);

    // de la grilla al campo compartido: se agranda con suavizado, se desenfoca y se recorta con
    // una curva suave para que el borde sea líquido y nítido a la vez
    fluidBlurCtx.clearRect(0,0,fluidWidth,fluidHeight);
    fluidBlurCtx.save();
    fluidBlurCtx.imageSmoothingEnabled=true;
    fluidBlurCtx.filter='blur('+(12*fluidScale).toFixed(1)+'px)';
    fluidBlurCtx.drawImage(fluidGrid,0,0,GW,GH,0,0,fluidWidth,fluidHeight);
    fluidBlurCtx.restore();
    const pixels=fluidBlurCtx.getImageData(0,0,fluidWidth,fluidHeight);
    const data=pixels.data;
    // v77 — el modo depende de la zona: negativo (relleno blanco + difference), tinta (relleno de color + multiply)
    // o contorno (solo el borde del fluido, en color). El borde es más duro para que se sienta como un gel.
    const fm=fluidMode,ring=fm.m==='contorno';
    for(let i=0;i<data.length;i+=4){
      const a=data[i+3]/255;
      let t=clamp((a-.26)/.08,0,1);t=t*t*(3-2*t);
      if(ring){let u=clamp((a-.42)/.08,0,1);u=u*u*(3-2*u);t=Math.max(0,t-u);}
      data[i]=fm.r;data[i+1]=fm.g;data[i+2]=fm.b;data[i+3]=Math.round(t*255);
    }
    fluidBlurCtx.putImageData(pixels,0,0);
    fluidCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    fluidCtx.drawImage(fluidBlur,0,0,fluidWidth,fluidHeight,0,0,window.innerWidth,window.innerHeight);
    fluidFrameEnd();
  }
  function fluidFrameEnd(){
    composeFaceRaster();
    if(fluidAlive||fluidActive){
      fluidCanvas.classList.add('is-active');
      fluidRaf=requestAnimationFrame(renderFluidCursor);
    }else{
      fluidCanvas.classList.remove('is-active');
      if(fluidGL)fluidGL.clear(fluidGL.COLOR_BUFFER_BIT);else fluidCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
      gU.fill(0);gV.fill(0);
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
// v71 — al empezar a deslizar, el hero se queda quieto un tramo (45 % de la pantalla) para jugar con la cara
// y el rayo X antes de que la página siga. Va en un contenedor más alto con el hero en position:sticky.
(()=>{
  const hero=document.querySelector('.hero');
  if(!hero)return;
  const pin=document.createElement('div');
  pin.className='hero-pin';
  hero.parentNode.insertBefore(pin,hero);pin.appendChild(hero);
  const fit=()=>{
    const h=hero.offsetHeight,vh=window.innerHeight;
    pin.style.height=Math.round(h+vh*.45)+'px';
    hero.style.top=Math.min(0,vh-h)+'px';          // si el hero es más alto que la pantalla, se fija mostrando su borde inferior
  };
  // mientras el hero está fijo, KEVIN y MANCUELLO se abren hacia sus lados (hasta 10 vw)
  let hdRaf=0;
  const drift=()=>{hdRaf=0;const run=Math.max(1,pin.offsetHeight-hero.offsetHeight);hero.style.setProperty('--hd',(Math.min(1.4,Math.max(0,window.scrollY/run))*10).toFixed(2));};
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)window.addEventListener('scroll',()=>{if(!hdRaf)hdRaf=requestAnimationFrame(drift)},{passive:true});
  window.addEventListener('resize',fit,{passive:true});
  fit();
})();
/* v80 — enlace real que cubre cada tarjeta de proyecto (el overlay con ::after fallaba con clic del medio / menú contextual) */
(()=>{
  document.querySelectorAll('.project-item').forEach(it=>{
    const l=it.querySelector('.project-link');if(!l||it.querySelector('.project-cover'))return;
    const c=document.createElement('a');c.className='project-cover';c.href=l.getAttribute('href');c.tabIndex=-1;c.setAttribute('aria-hidden','true');c.textContent=l.getAttribute('aria-label')||'';
    it.appendChild(c);it.classList.add('has-cover');
  });
})();

// v108 — mail: si la computadora no tiene un programa de correo configurado, el enlace "mailto" no hace nada.
// Al hacer clic, además de intentar abrirlo, se copia la dirección y se avisa.
(()=>{
  const links=document.querySelectorAll('a[href^="mailto:"]');
  if(!links.length)return;
  const toast=document.createElement('div');
  toast.className='mail-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  document.body.appendChild(toast);
  let t=0;
  links.forEach(a=>a.addEventListener('click',()=>{
    const mail=a.getAttribute('href').replace(/^mailto:/,'').split('?')[0];
    const show=msg=>{toast.textContent=msg;toast.classList.add('is-on');clearTimeout(t);t=setTimeout(()=>toast.classList.remove('is-on'),3200);};
    if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(mail).then(()=>show('Mail copiado: '+mail),()=>show(mail));}
    else show(mail);
  }));
})();

// v123 — pausa de la cinta de clientes con toque o teclado
(()=>{const c=document.querySelector('.clients');if(!c)return;const t=()=>c.classList.toggle('is-paused');c.addEventListener('click',t);c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();t();}});})();

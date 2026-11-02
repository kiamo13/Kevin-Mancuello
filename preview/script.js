(()=>{
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
      ['0%','#000000'],['54%','#000000'],['68%','#202020'],
      ['84%','#929292'],['100%','#ffffff']
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

    ['cara_ojos_abiertos_neutro','ojos_sonrientes','cara_ojos_abiertos_neutro_copia','BARBA']
      .forEach(id=>{
        const layer=svg.querySelector('#'+id);
        if(layer)layer.setAttribute('mask','url(#avatarFaceMask)');
      });
  }

  function loadAvatar(){
    fetch('assets/avatar.svg')
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
        bindInteractions();
        stage.classList.add('avatar-ready');
      })
      .catch(error=>{
        console.error(error);
        mount.innerHTML='<p class="avatar-error">No se pudo cargar el avatar.</p>';
      });
  }

  function flashSmile(){
    clearTimeout(smileTimer);
    smileActive=true;
    stage.classList.add('is-smiling');
    smileTimer=window.setTimeout(()=>{
      smileActive=false;
      stage.classList.remove('is-smiling');
    },950);
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

  function trackEyes(e){
    if(!svg)return;
    if(e.pointerType==='touch'&&!stage.contains(e.target))return;
    const matrix=svg.getScreenCTM();
    if(!matrix)return;
    const pt=svg.createSVGPoint();
    pt.x=e.clientX;pt.y=e.clientY;
    const p=pt.matrixTransform(matrix.inverse());
    const vb=svg.viewBox.baseVal;
    const dx=clamp((p.x-vb.width*.5)/(vb.width*.40),-1,1);
    const dy=clamp((p.y-vb.height*.47)/(vb.height*.34),-1,1);
    pupilTarget=[{x:dx*14,y:dy*10},{x:dx*14,y:dy*10}];
    requestPupilFrame();
  }

  function organicRevealPath(cx,cy,phase,speed,scale){
    const count=18;
    const points=[];
    const intensity=clamp(speed/8,0,1);
    const rx=48*scale*(1+.16*intensity);
    const ry=62*scale*(1+.24*intensity);
    const direction=Math.atan2(revealVelocity.y,revealVelocity.x||.0001);
    const rotation=speed>.25?direction-Math.PI/2:0;
    const trail=Math.min(speed*.28,5.5)*intensity;
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
    const ease=reducedMotion?1:.13;
    const dx=revealTarget.x-revealCurrent.x;
    const dy=revealTarget.y-revealCurrent.y;
    revealCurrent.x+=dx*ease;
    revealCurrent.y+=dy*ease;
    const vx=revealCurrent.x-previousReveal.x;
    const vy=revealCurrent.y-previousReveal.y;
    revealVelocity={x:vx,y:vy};
    const speed=Math.hypot(vx,vy);
    previousReveal={x:revealCurrent.x,y:revealCurrent.y};
    revealScale+=(revealScaleTarget-revealScale)*(reducedMotion?1:.22);
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
    if(!svg)return;
    const matrix=svg.getScreenCTM();
    if(!matrix)return;
    const pt=svg.createSVGPoint();
    pt.x=e.clientX;pt.y=e.clientY;
    const p=pt.matrixTransform(matrix.inverse());
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
        },135);
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

  function bindInteractions(){
    stage.addEventListener('click',flashSmile);
    window.addEventListener('pointermove',trackEyes,{passive:true});
    const supportsHover=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if(supportsHover){
      stage.addEventListener('pointerenter',activateReveal);
      stage.addEventListener('pointermove',setRevealTarget,{passive:true});
      stage.addEventListener('pointerleave',closeReveal);
    }else{
      stage.addEventListener('pointerdown',e=>{
        if(e.pointerType!=='touch')return;
        touchActive=true;
        if(stage.setPointerCapture)stage.setPointerCapture(e.pointerId);
        activateReveal(e);
        trackEyes(e);
      });
      stage.addEventListener('pointermove',e=>{
        if(e.pointerType!=='touch'||!touchActive)return;
        setRevealTarget(e);
        trackEyes(e);
      },{passive:true});
      const finishTouch=e=>{
        if(e.pointerType!=='touch')return;
        touchActive=false;
        clearTimeout(touchRevealTimer);
        touchRevealTimer=window.setTimeout(closeReveal,1500);
      };
      stage.addEventListener('pointerup',finishTouch);
      stage.addEventListener('pointercancel',finishTouch);
    }
    if(!reducedMotion)scheduleBlink();
  }

  loadAvatar();

  const menuButton=document.querySelector('.menu-toggle');
  const nav=document.querySelector('.main-nav');
  if(menuButton&&nav){
    menuButton.addEventListener('click',()=>{
      const open=nav.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded',String(open));
      menuButton.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
    });
    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
      nav.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded','false');
      menuButton.setAttribute('aria-label','Abrir menú');
    }));
  }

  window.addEventListener('pagehide',()=>{
    clearTimeout(smileTimer);clearTimeout(blinkTimer);clearTimeout(blinkEnd);clearTimeout(touchRevealTimer);
    if(pupilRaf)cancelAnimationFrame(pupilRaf);
    if(revealRaf)cancelAnimationFrame(revealRaf);
  });
})();
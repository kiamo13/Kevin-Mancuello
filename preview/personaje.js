/* Personaje del sitio (v68, provisorio): menú de 3 manos y caminante de Sobre mí.
   Vectores del portfolio interactivo: rig de manos (web/rig.js) e ilustraciones (web/illus.js). */
(()=>{
'use strict';
/* Rig de mano 2D con proporciones anatómicas.
   Muñeca en (0,0), dedos hacia -y. Mano derecha vista dorsal: pulgar a la izquierda.
   Reglas: dedo medio = largo de palma · índice≈anular (≈0,93) · meñique llega a la última articulación del anular (≈0,76)
   · falanges 45/30/25 % · nudillos en arco con pico en el medio · pulgar 2 falanges desde cuña tenar a ~45°, punta a la altura de la base del índice. */
function handRig(o){
 o=Object.assign({P:120,W:112,side:'dorsal',flex:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],fore:[1,1,1,1],spread:[-7,-2,3,10],thumb:[-32,6,6],thumbFore:1,id:'h',only:[0,1,2,3],palm:true,thumbOn:true},o);
 const {P,W}=o, K=[-.37,-.12,.13,.37], ARC=[.06,.10,.07,0], LEN=[.93,1,.95,.76], WID=[.245,.255,.24,.205], PH=[.45,.30,.25];
 const sk=C.skin, skD=C.skinD, nail=C.nail;
 let out='';
 // dedos (detrás de la palma en vista palmar, encima en dorsal)
 const fingers=K.map((k,i)=>{ if(!o.only.includes(i))return '';
   const L=LEN[i]*P*o.fore[i], w=WID[i]*W, x=k*W, y=-P*(.92+ARC[i]);
   const chain=(col,ww,detail)=>{
     let s='',close='';
     PH.forEach((r,j)=>{
       const l=r*L;
       s+=`<g class="${o.id}f${i}j${j}" transform="rotate(${o.flex[i][j]})">`+
          `<path d="M0,0 L0,${-l}" stroke="${col}" stroke-width="${ww}" stroke-linecap="round"/>`;
       if(detail&&j==1&&o.side=='dorsal') s+=`<path d="M${-ww*.18},${2} q${ww*.18},${3} ${ww*.36},0" stroke="${skD}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>`;
       if(detail&&j==2&&o.side=='dorsal') s+=`<rect x="${-ww*.28}" y="${-l-ww*.32}" width="${ww*.56}" height="${l*.62}" rx="${ww*.26}" fill="${nail}"/>`;
       s+=`<g transform="translate(0 ${-l})">`; close+='</g></g>';
     });
     return s+close;
   };
   return `<g class="${o.id}f${i}" transform="translate(${x} ${y}) rotate(${o.spread[i]})">`+chain(C.skinD,w+3,false)+chain(sk,w,true)+'</g>';
 });
 // palma: trapecio redondeado (ancho en nudillos, más angosto en la muñeca)
 const palm=`<path d="M${-.5*W},${-.86*P} C${-.5*W},${-1.02*P} ${.5*W},${-1.04*P} ${.5*W},${-.88*P} L${.44*W},${-.18*P} C${.38*W},${.04*P} ${-.32*W},${.06*P} ${-.4*W},${-.16*P} Z" fill="${sk}"/>`+
   `<path d="M${.5*W},${-.88*P} L${.44*W},${-.18*P} C${.4*W},${-.04*P} ${.2*W},${.04*P} ${.1*W},${.04*P} C${.3*W},${-.1*P} ${.36*W},${-.5*P} ${.34*W},${-.92*P} Z" fill="${skD}" opacity=".5"/>`;
 const det=o.side=='dorsal'
   ? K.map((k,i)=>`<ellipse cx="${k*W}" cy="${-P*(.9+ARC[i])}" rx="${W*.07}" ry="${W*.035}" fill="${skD}" opacity=".35"/>`).join('')
   : `<path d="M${-.3*W},${-.66*P} C${-.05*W},${-.6*P} ${.2*W},${-.68*P} ${.42*W},${-.76*P} M${-.22*W},${-.14*P} C${-.24*W},${-.32*P} ${-.18*W},${-.5*P} ${-.04*W},${-.62*P}" stroke="${skD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`;
 // pulgar: masa tenar unida a la palma + 2 falanges
 const tw=W*.28, tl=[.34*P*o.thumbFore,.28*P*o.thumbFore];
 const thenar=`<ellipse cx="${-.3*W}" cy="${-.3*P}" rx="${.24*W}" ry="${.3*P}" fill="${sk}" transform="rotate(${o.thumb[0]*.4} ${-.3*W} ${-.3*P})"/>`;
 const thumb=thenar+`<g class="${o.id}t" transform="translate(${-.42*W} ${-.42*P}) rotate(${o.thumb[0]})">`+
   `<rect x="${-tw*.55}" y="${-tw*1.1}" width="${tw*1.1}" height="${tw*1.6}" rx="${tw*.55}" fill="${sk}"/>`+
   `<g class="${o.id}tj0" transform="translate(0 ${-tw*.9}) rotate(${o.thumb[1]})"><path d="M0,0 L0,${-tl[0]}" stroke="${sk}" stroke-width="${tw}" stroke-linecap="round"/>`+
   `<g class="${o.id}tj1" transform="translate(0 ${-tl[0]}) rotate(${o.thumb[2]})"><path d="M0,0 L0,${-tl[1]+tw*.2}" stroke="${sk}" stroke-width="${tw*.94}" stroke-linecap="round"/>`+
   (o.side=='dorsal'?`<rect x="${-tw*.3}" y="${-tl[1]*.96}" width="${tw*.6}" height="${tl[1]*.5}" rx="${tw*.28}" fill="${nail}"/>`:'')+
   `</g></g></g>`;
 const PL=o.palm?palm+det:'', TH=o.thumbOn?thumb:'';
 if(o.side=='dorsal') out=PL+fingers.join('')+TH;
 else out=fingers.join('')+PL+TH;
 return `<g class="${o.id}">${out}</g>`;
}
/* antebrazo + puño de remera desde la muñeca (0,0) hacia ángulo a (grados, 90 = hacia abajo) */
function forearm(a,len,w){
 const r=a*Math.PI/180, x=Math.cos(r)*len, y=Math.sin(r)*len;
 return `<path d="M0,0 L${x},${y}" stroke="${C.skinD}" stroke-width="${w*1.12}" stroke-linecap="round"/>`+
  `<path d="M${-w*.06},${-w*.04} L${x-w*.06},${y}" stroke="${C.skin}" stroke-width="${w*.92}" stroke-linecap="round"/>`+
  cuff(x*.72,y*.72,x*1.4,y*1.4,w*1.5);
}

/* posición de la punta del pulgar (coords locales de la mano) */
function thumbTip(o){
 const P=o.P||120,W=o.W||112,th=o.thumb||[-32,6,6],tf=o.thumbFore||1,tw=W*.28,tl0=.34*P*tf,tl1=.28*P*tf;
 const d=a=>[Math.sin(a*Math.PI/180),-Math.cos(a*Math.PI/180)];
 let x=-.42*W,y=-.42*P; const a0=th[0],a1=a0+th[1],a2=a1+th[2];
 [[a0,tw*.9],[a1,tl0],[a2,tl1*.78]].forEach(([a,l])=>{const v=d(a);x+=v[0]*l;y+=v[1]*l});
 return [x,y];
}
/* dedos flexionados vistos desde el dorso: masa de nudillos + falanges plegadas */
function curledFingers(P,W){
 return `<path d="M${-.2*W},${-.98*P} C${-.24*W},${-1.16*P} ${.5*W},${-1.14*P} ${.5*W},${-.94*P} C${.5*W},${-.82*P} ${-.16*W},${-.8*P} ${-.2*W},${-.98*P} Z" fill="${C.skinD}"/>`+
  [-.02,.2,.38].map(k=>`<ellipse cx="${k*W}" cy="${-1.02*P}" rx="${.11*W}" ry="${.07*P}" fill="${C.skin}"/>`).join('');
}

/* Ilustraciones vectoriales 2D v2 (placeholders) — estilo plano con sombra, paleta del avatar */
const C={skin:'#F7A880',skinD:'#E58C64',skinDD:'#C96E4B',skinL:'#FFC6A6',nail:'#FFD9C6',hair:'#3F1A55',hairL:'#5B2C78',hairD:'#2C1040',
 beard:'#4B2563',beardL:'#64367F',white:'#FFFFFF',whiteD:'#E4DFF5',trim:'#6B4BFF',deep:'#2E2266',elec:'#6B4BFF',lime:'#C6F432',limeD:'#A4D11A',
 wood:'#F2C79B',woodD:'#DDA972',coral:'#FF5B4F',coralD:'#E2433A',jeans:'#4639A8',jeansD:'#332A86',jeansL:'#5A4DC0',
 mint:'#BFE6DD',mintD:'#8ED3C5',mintDD:'#5CC2AE',teal:'#2E9C86',ferr:'#CFC9EA',ferrD:'#ABA3D6',eye:'#2B1B3A',blush:'#F48C7A'};

/* manga ringer: puño blanco con vivo violeta. (x1,y1)->(x2,y2) eje del brazo, w ancho */
function cuff(x1,y1,x2,y2,w){
 const a=Math.atan2(y2-y1,x2-x1)*180/Math.PI, L=Math.hypot(x2-x1,y2-y1);
 return `<g transform="translate(${x1} ${y1}) rotate(${a})">
  <rect x="0" y="${-w/2}" width="${L}" height="${w}" rx="8" fill="${C.white}"/>
  <rect x="${L*.55}" y="${-w/2}" width="${L*.45}" height="${w*.28}" rx="6" fill="${C.whiteD}"/>
  <path d="M${L*.35},${-w/2+6} q8,${w*.4} 0,${w-12}" stroke="${C.whiteD}" stroke-width="3" fill="none"/>
  <rect x="0" y="${-w/2-2}" width="12" height="${w+4}" rx="5" fill="${C.trim}"/></g>`;
}

/* ---------- MANO CON LÁPIZ (punta en 0,0, lápiz hacia -y) ---------- */
function svgPencilHand(){
 /* agarre en pinza visto desde el dorso: índice sobre el lápiz, pulgar del lado opuesto, medio/anular/meñique plegados bajo la palma */
 const P=120,W=112, base={P,W,id:'ph',fore:[1,1,1,1],spread:[-10,0,0,0],flex:[[0,6,8],[0,0,0],[0,0,0],[0,0,0]],thumb:[-4,-6,-6]};
 const pencil=`<g transform="translate(-50 -70) rotate(-5)">
  <path d="M0,-226 L-5,-211 L5,-211 Z" fill="${C.deep}"/>
  <path d="M-5,-211 L-12,-182 L12,-182 L5,-211 Z" fill="${C.wood}"/><path d="M1,-211 L5,-211 L12,-182 L4,-182 Z" fill="${C.woodD}"/>
  <path d="M-12,-182 l4,6 l4,-6 l4,6 l4,-6 l4,6 l4,-6 V0 H-12 Z" fill="${C.lime}"/><rect x="4" y="-176" width="8" height="176" fill="${C.limeD}"/>
  <rect x="-13" y="0" width="26" height="18" rx="2" fill="${C.ferr}"/><path d="M-13,6 H13 M-13,12 H13" stroke="${C.ferrD}" stroke-width="2"/>
  <rect x="-13" y="16" width="26" height="24" rx="7" fill="${C.coral}"/><rect x="5" y="16" width="8" height="24" rx="4" fill="${C.coralD}"/></g>`;
 const back=handRig(Object.assign({},base,{only:[],thumbOn:true}));
 const front=handRig(Object.assign({},base,{id:'pi',only:[0],palm:false,thumbOn:false}));
 const a=-5*Math.PI/180, tx=-50+226*Math.sin(a), ty=-70-226*Math.cos(a);
 return `<g transform="rotate(205) translate(${-tx} ${-ty})">${forearm(122,190,72)}${back}${curledFingers(P,W)}${pencil}${front}</g>`;
}

/* ---------- ABANICO DE MUESTRAS (pivote en 0,0) ---------- */
const FAN=[{c:'#2E2266',n:'2E2266'},{c:'#6B4BFF',n:'6B4BFF'},{c:'#C6F432',n:'C6F432'},{c:'#FF5B4F',n:'FF5B4F'},{c:'#BFE6DD',n:'BFE6DD'}];
function svgFan(){
 return FAN.map((f,i)=>`<g class="card c${i}">
  <rect x="-26" y="-214" width="52" height="226" rx="10" fill="${C.white}"/>
  <rect x="-26" y="-214" width="52" height="130" rx="10" fill="${f.c}"/>
  <rect x="-26" y="-100" width="52" height="16" fill="${f.c}"/>
  <rect x="-18" y="-72" width="30" height="5" rx="2.5" fill="${C.deep}" opacity=".7"/>
  <rect x="-18" y="-60" width="22" height="4" rx="2" fill="${C.deep}" opacity=".35"/>
  <rect x="-18" y="-50" width="26" height="4" rx="2" fill="${C.deep}" opacity=".35"/>
  <rect x="-26" y="-214" width="52" height="226" rx="10" fill="none" stroke="${C.deep}" stroke-opacity=".12" stroke-width="2"/>
 </g>`).join('')+`<circle cx="0" cy="0" r="9" fill="${C.ferr}"/><circle cx="0" cy="0" r="4" fill="${C.ferrD}"/>`;
}
const FANHAND={P:110,W:104,side:'palm',fore:[.5,.5,.48,.42],spread:[-6,-2,2,6],flex:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],thumb:[-18,8,8]};
function fanHandXform(){const r=-28, t=thumbTip(FANHAND), c=Math.cos(r*Math.PI/180), s=Math.sin(r*Math.PI/180);
 return `translate(${-(c*t[0]-s*t[1])} ${-(s*t[0]+c*t[1])}) rotate(${r})`;}
function svgFanHandBack(){ return `<g transform="${fanHandXform()}">${handRig(Object.assign({},FANHAND,{id:'fb',palm:false,thumbOn:false}))}</g>`; }
function svgFanHand(){ return `<g transform="${fanHandXform()}">${forearm(90,190,70)}${handRig(Object.assign({},FANHAND,{id:'fh',only:[]}))}</g>`; }

/* ---------- MOUSE + MANO, vista superior (base del mouse en 0,0) ---------- */
function svgMouse(){
 return `
 <path d="M0,-236 C0,-270 -50,-276 -70,-330" stroke="${C.deep}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".45"/>
 <ellipse cx="8" cy="-110" rx="80" ry="132" fill="${C.deep}" opacity=".10"/>
 <g transform="translate(0 12) scale(1.08 1.24)"><path d="M0,-200 C50,-200 66,-150 66,-100 C66,-30 40,0 0,0 C-40,0 -66,-30 -66,-100 C-66,-150 -50,-200 0,-200 Z" fill="${C.white}"/>
 <path d="M44,-180 C62,-150 66,-110 64,-80 C62,-30 40,-4 10,0 C40,-10 54,-40 56,-90 C58,-130 54,-160 44,-180 Z" fill="${C.whiteD}"/>
 <path class="led" d="M-2,-198 C-40,-196 -62,-160 -64,-128 C-40,-122 -20,-121 -2,-121 Z" fill="${C.elec}" opacity="0"/>
 <path d="M0,-200 V-122 M-64,-128 C-30,-120 30,-120 64,-128" stroke="${C.whiteD}" stroke-width="4" fill="none" stroke-linecap="round"/>
 <rect x="-7" y="-182" width="14" height="32" rx="7" fill="${C.lime}"/><rect x="-7" y="-172" width="14" height="4" fill="${C.limeD}"/></g>`;
}
function svgMouseHand(){
 /* vista superior: palma sobre el lomo del mouse, índice y medio sobre los botones */
 return `<g class="handM" transform="translate(4 34)">${forearm(100,170,78)}${handRig({P:116,W:116,id:'mh',fore:[1,1,.86,.76],spread:[-3,0,6,12],thumb:[-24,4,2]})}</g>`;
}

/* ---------- ROSTRO (centro 0,0) ---------- */
function svgFace(){
 return `
 <!-- cuello + cuello ringer -->
 <path d="M-56,150 L-50,230 L60,230 L64,150 Z" fill="${C.skinD}"/>
 <path d="M-120,262 C-110,214 -60,200 0,206 C60,200 116,214 126,262 Z" fill="${C.white}"/>
 <path d="M-62,214 C-30,232 34,232 66,214" stroke="${C.trim}" stroke-width="12" fill="none" stroke-linecap="round"/>
 <g class="headbase">
  <!-- orejas -->
  <path d="M-136,-52 C-180,-62 -184,44 -134,46 Z" fill="${C.skinD}"/>
  <path d="M-142,-30 C-164,-26 -164,22 -142,26" stroke="${C.skinDD}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M136,-52 C180,-62 184,44 134,46 Z" fill="${C.mintDD}"/>
  <circle cx="158" cy="-4" r="9" fill="${C.teal}"/>
  <!-- cara humana -->
  <path d="M-140,-60 C-140,-170 140,-170 140,-60 L140,60 C140,150 70,190 0,190 C-70,190 -140,150 -140,60 Z" fill="${C.skin}"/>
  <path d="M-140,-10 C-138,80 -110,150 -50,182 C-110,170 -142,110 -140,-10 Z" fill="${C.skinD}" opacity=".55"/>
  <!-- mitad robot -->
  <path d="M8,-150 C80,-150 140,-120 140,-60 L140,60 C140,150 80,186 18,190 C30,170 4,160 18,140 C30,120 2,110 16,92 C30,74 2,62 14,44 C28,26 0,14 12,-4 C24,-22 -2,-34 10,-52 C22,-70 -4,-84 8,-100 C18,-116 -2,-130 8,-150 Z" fill="${C.mint}"/>
  <path d="M100,-120 C130,-90 140,-40 140,20 L140,60 C140,120 110,160 70,180 C110,140 124,90 124,30 C124,-30 118,-80 100,-120 Z" fill="${C.mintD}"/>
  <path d="M70,-140 L52,-70 L92,-34 L72,62 L100,146" stroke="${C.mintDD}" stroke-width="8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <g fill="${C.teal}"><circle cx="40" cy="-110" r="5"/><circle cx="118" cy="100" r="5"/><circle cx="44" cy="150" r="5"/></g>
 </g>
 <!-- rubor -->
 <ellipse cx="-92" cy="34" rx="22" ry="12" fill="${C.blush}" opacity=".35"/>
 <!-- barba -->
 <path class="beard" d="M-136,30 C-134,150 -64,198 6,198 L14,190 C4,170 20,150 8,128 C-30,150 -76,130 -96,96 C-112,70 -122,48 -136,30 Z" fill="${C.beard}"/>
 <path d="M-120,70 l6,10 M-104,110 l6,10 M-80,142 l4,12 M-50,162 l2,12 M-20,170 l0,12 M-128,40 l4,10" stroke="${C.beardL}" stroke-width="4" stroke-linecap="round"/>
 <ellipse cx="-12" cy="102" rx="58" ry="30" fill="${C.skin}"/>
 <path d="M-64,82 C-42,62 -14,70 -6,78 C2,70 26,64 42,80 C20,90 -40,92 -64,82 Z" fill="${C.beard}"/>
 <path d="M-46,80 l-4,6 M-28,76 l-2,7 M18,76 l2,7 M32,79 l4,6" stroke="${C.beardL}" stroke-width="3" stroke-linecap="round"/>
 <!-- pelo -->
 <path d="M-150,-30 C-176,-150 -90,-214 6,-200 C56,-236 126,-210 116,-164 C160,-176 178,-120 146,-92 C120,-132 60,-150 0,-142 C-50,-136 -96,-120 -122,-70 C-130,-50 -136,-36 -150,-30 Z" fill="${C.hair}"/>
 <path d="M-46,-198 C-30,-246 30,-244 34,-204 Z M44,-210 C76,-258 130,-238 106,-196 Z M-110,-170 C-130,-206 -80,-220 -70,-196 Z" fill="${C.hair}"/>
 <path d="M-100,-150 C-70,-176 -20,-182 20,-172 M-30,-196 C-14,-214 10,-216 22,-206 M54,-200 C70,-220 96,-222 104,-206" stroke="${C.hairL}" stroke-width="7" fill="none" stroke-linecap="round"/>
 <path d="M-150,-30 C-150,-60 -140,-80 -126,-96 C-132,-70 -134,-50 -130,-30 Z" fill="${C.hairD}"/>
 <!-- cables -->
 <g stroke-width="11" fill="none" stroke-linecap="round">
  <path d="M118,-112 C150,-142 170,-132 188,-154" stroke="#3BA9E0"/><path d="M130,-86 C164,-102 182,-88 206,-106" stroke="#F39A2B"/>
  <path d="M138,-60 C168,-68 184,-52 208,-64" stroke="${C.coral}"/><path d="M110,-130 C120,-160 140,-168 150,-186" stroke="#fff"/>
 </g>
 <!-- cejas -->
 <path class="browL" d="M-114,-58 C-92,-80 -54,-78 -32,-60" stroke="${C.hair}" stroke-width="16" fill="none" stroke-linecap="round"/>
 <path class="browR" d="M36,-62 C56,-74 88,-72 106,-58" stroke="${C.teal}" stroke-width="10" fill="none" stroke-linecap="round"/>
 <!-- ojos -->
 <g class="eyeL"><ellipse cx="-72" cy="-24" rx="24" ry="22" fill="${C.white}"/><circle class="pupL" cx="-70" cy="-22" r="12" fill="${C.eye}"/><circle cx="-65" cy="-28" r="4.5" fill="#fff"/>
  <path d="M-98,-36 C-84,-50 -58,-50 -46,-36" stroke="${C.skinDD}" stroke-width="4" fill="none" stroke-linecap="round"/></g>
 <g class="eyeR"><circle cx="72" cy="-24" r="34" fill="${C.deep}"/><circle cx="72" cy="-24" r="28" fill="none" stroke="${C.elec}" stroke-width="4" stroke-dasharray="4 5"/>
  <circle cx="72" cy="-24" r="21" fill="${C.white}"/><circle class="pupR" cx="72" cy="-24" r="12" fill="${C.eye}"/><circle cx="77" cy="-29" r="4" fill="#fff"/></g>
 <!-- nariz -->
 <path d="M-4,-14 C-12,24 -26,40 -10,50 C-2,54 8,50 12,46" stroke="${C.skinDD}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
 <!-- bocas (gestos) -->
 <path class="m m0" d="M-44,104 C-24,112 8,112 28,102" stroke="${C.deep}" stroke-width="9" fill="none" stroke-linecap="round"/>
 <path class="m m1" d="M-48,96 C-30,128 12,128 34,94 C6,102 -22,102 -48,96 Z" fill="${C.deep}"/>
 <path class="m m1" d="M-40,98 C-20,104 6,104 26,97 L24,103 C4,108 -20,108 -38,103 Z" fill="#fff"/>
 <path class="m m1" d="M-20,118 C-10,124 4,124 12,118 C4,112 -12,112 -20,118 Z" fill="${C.coral}"/>
 <ellipse class="m m2" cx="-8" cy="106" rx="16" ry="20" fill="${C.deep}"/>
 <ellipse class="m m2" cx="-8" cy="116" rx="10" ry="7" fill="${C.coral}"/>
 <path class="m m3" d="M-40,108 C-20,106 4,100 30,92" stroke="${C.deep}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
}

/* ---------- PERSONA CAMINANDO (cadera en 0,0, mira a la derecha) ---------- */
function svgWalker(){
 const leg=(id,col,colD)=>`<g class="${id}">
   <path d="M0,0 L0,120" stroke="${col}" stroke-width="46" stroke-linecap="round"/>
   <path d="M-14,10 L-14,110" stroke="${colD}" stroke-width="12" stroke-linecap="round" opacity=".6"/>
   <g class="${id}k" transform="translate(0,120)">
    <path d="M0,0 L0,112" stroke="${col}" stroke-width="42" stroke-linecap="round"/>
    <rect x="-23" y="96" width="46" height="16" rx="6" fill="${colD}"/>
    <g transform="translate(0,122)">
     <path d="M-26,-16 C-26,-38 22,-40 46,-12 C52,-4 50,6 44,8 L-26,8 Z" fill="${C.coral}"/>
     <path d="M-6,-30 l10,8 M6,-32 l10,8" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
     <rect x="-28" y="4" width="78" height="11" rx="5" fill="#fff"/><rect x="-28" y="12" width="78" height="4" rx="2" fill="${C.whiteD}"/>
    </g></g></g>`;
 const arm=(id)=>`<g class="${id}">
   <path d="M0,0 L0,92" stroke="${C.skin}" stroke-width="30" stroke-linecap="round"/>
   <path d="M-8,-6 L-8,40 C-8,52 24,52 24,40 L24,-6 Z" fill="${C.white}" transform="translate(-8 0)"/>
   <rect x="-16" y="36" width="32" height="9" rx="4" fill="${C.trim}"/>
   <g class="${id}e" transform="translate(0,92)">
    <path d="M0,0 L0,74" stroke="${C.skin}" stroke-width="27" stroke-linecap="round"/>
    <path d="M-14,70 C-16,96 18,100 18,78 C18,66 8,62 0,64 Z" fill="${C.skin}"/>
    <path d="M10,72 C20,74 22,86 14,90" stroke="${C.skinD}" stroke-width="4" fill="none" stroke-linecap="round"/>
   </g></g>`;
 return `
 <g class="armB" transform="translate(4,-192)" opacity=".92"><g style="filter:brightness(.88)">${arm('aB')}</g></g>
 <g class="legB">${leg('lB',C.jeansD,'#241E66')}</g>
 <g class="torso">
  <path d="M-48,-216 C-54,-130 -44,-36 -38,0 L42,0 C48,-40 54,-130 46,-216 C22,-234 -26,-234 -48,-216 Z" fill="${C.white}"/>
  <path d="M20,-200 C30,-140 30,-60 26,-6 L42,-6 C46,-60 50,-140 46,-210 Z" fill="${C.whiteD}"/>
  <path d="M-14,-228 C-2,-216 14,-216 26,-228" stroke="${C.trim}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <path d="M-42,-8 L44,-8" stroke="${C.jeans}" stroke-width="24" stroke-linecap="round"/>
  <rect x="-6" y="-16" width="16" height="14" rx="3" fill="${C.ferr}"/>
 </g>
 <g class="head" transform="translate(6,-240)">
  <path d="M-16,4 L-16,-24 L20,-24 L20,4 Z" fill="${C.skinD}"/>
  <path d="M-52,-100 C-54,-160 54,-162 56,-100 L58,-62 C76,-62 76,-28 56,-26 C48,2 12,10 -14,4 C-42,-4 -54,-42 -52,-100 Z" fill="${C.skin}"/>
  <path d="M-14,4 C12,10 48,2 56,-26 C60,-42 50,-50 42,-42 C32,-32 10,-34 -4,-46 C-18,-56 -32,-52 -44,-40 C-48,-18 -36,-2 -14,4 Z" fill="${C.beard}"/>
  <path d="M-30,-20 l4,8 M-12,-8 l2,8 M10,-6 l0,8 M30,-14 l-2,8" stroke="${C.beardL}" stroke-width="3" stroke-linecap="round"/>
  <path d="M30,-46 C40,-52 52,-52 56,-44 C48,-40 38,-40 30,-46 Z" fill="${C.beard}"/>
  <path d="M-62,-84 C-78,-160 0,-188 44,-158 C76,-180 98,-136 64,-122 C44,-134 12,-130 -8,-114 C-18,-96 -28,-84 -38,-64 C-50,-62 -60,-72 -62,-84 Z" fill="${C.hair}"/>
  <path d="M-40,-150 C-20,-168 14,-170 34,-158 M48,-160 C62,-170 78,-164 82,-150" stroke="${C.hairL}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M-30,-86 C-46,-92 -48,-56 -30,-52 C-20,-52 -18,-84 -30,-86 Z" fill="${C.skinD}"/>
  <ellipse cx="34" cy="-84" rx="6" ry="7" fill="${C.eye}"/><circle cx="36" cy="-86" r="2" fill="#fff"/>
  <path d="M20,-102 C30,-110 44,-110 50,-102" stroke="${C.hair}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M54,-76 C68,-60 64,-50 52,-50" stroke="${C.skinDD}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <ellipse cx="18" cy="-60" rx="10" ry="6" fill="${C.blush}" opacity=".4"/>
 </g>
 <g class="legF">${leg('lF',C.jeans,C.jeansD)}</g>
 <g class="armF" transform="translate(-6,-192)">${arm('aF')}</g>`;
}

/* ---------- MANO QUE ALCANZA (muñeca en 0,0, palma hacia el frente) ---------- */
function svgReachHand(){
 return `${forearm(90,200,76)}${handRig({P:130,W:122,id:'rh',side:'palm',spread:[-12,-4,5,14],thumb:[-40,14,10]})}`;
}

/* ---------- BOTÓN + MANO QUE LO OPRIME (centro de la tapa del botón en 0,0) ---------- */
function svgButton(){
 /* botón arcade en 3/4: base, cilindro y tapa (.btnCap se comprime al presionar) */
 return `<ellipse cx="0" cy="58" rx="124" ry="22" fill="${C.deep}" opacity=".12"/>
 <path d="M-118,22 V40 C-118,62 118,62 118,40 V22 Z" fill="${C.deep}"/>
 <ellipse cx="0" cy="22" rx="118" ry="30" fill="#45379A"/>
 <g class="btnCap"><path d="M-76,0 V20 C-76,36 76,36 76,20 V0 Z" fill="${C.coralD}"/>
 <ellipse cx="0" cy="0" rx="76" ry="20" fill="${C.coral}"/>
 <ellipse class="btnGlow" cx="0" cy="0" rx="76" ry="20" fill="${C.lime}" opacity="0"/>
 <ellipse cx="-24" cy="-6" rx="26" ry="6" fill="${C.white}" opacity=".35"/></g>`;
}
function svgButtonHand(){
 /* dorso visto desde arriba: índice estirado hacia abajo, resto de los dedos plegados */
 const P=112,W=106;
 return `<g class="handB">${forearm(90,190,72)}${handRig({P,W,id:'bh',only:[0],spread:[4,0,0,0],thumb:[-6,48,44],thumbFore:.78})}${curledFingers(P,W)}</g>`;
}

/* ================= v68 — lo propio del sitio (lo de arriba es web/rig.js + web/illus.js, sin cambios) ================= */
/* manos sin antebrazo y mouse sin cable, como en el portfolio interactivo */
const _stub=(a,l,w)=>{const r=a*Math.PI/180,x=Math.cos(r)*26,y=Math.sin(r)*26;
 return `<path d="M0,0 L${x},${y}" stroke="${C.skinD}" stroke-width="${w*1.12}" stroke-linecap="round"/><path d="M${-w*.06},${-w*.04} L${x-w*.06},${y}" stroke="${C.skin}" stroke-width="${w*.92}" stroke-linecap="round"/>`};
forearm=_stub;
const _sm=svgMouse;svgMouse=()=>_sm().replace(/<path d="M0,-236[^>]*\/>/,'');

const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e};
const allT=(els,v)=>els.forEach(e=>e.setAttribute('transform',v));
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- escenas de las 3 manos: 3 cuadros cada una ---------- */
function sceneIlu(S){                               // la mano dibuja un trazo
 const path=el('path',{d:'M90,236 C130,196 170,262 214,222 S268,214 306,232',fill:'none',stroke:'#C6F432','stroke-width':6,'stroke-linecap':'round'},S);
 const L=path.getTotalLength();path.setAttribute('stroke-dasharray',L);
 const hand=el('g',{},S);hand.innerHTML=svgPencilHand();
 const U=[.3,.66,1];
 return i=>{const u=U[i],q=path.getPointAtLength(L*u);
  path.setAttribute('stroke-dashoffset',L*(1-u));
  hand.setAttribute('transform',`translate(${q.x} ${q.y}) rotate(${[-3,3,0][i]}) scale(.56)`)};
}
function sceneClick(S){                             // la mano hace clic en el mouse
 const g=el('g',{transform:'translate(200 206) scale(.8)'},S);g.innerHTML=svgMouse()+svgMouseHand();
 const hand=g.querySelector('.handM'),j2=[...g.querySelectorAll('.mhf0j2')],led=g.querySelector('.led');
 const F=[-8,14,0];
 return i=>{const f=F[i];
  allT(j2,`scale(1 ${1-Math.max(0,f)/120})`);
  if(led)led.setAttribute('opacity',i===1?'.9':'0');
  hand.setAttribute('transform',`translate(4 ${34+Math.max(0,f)*.12})`)};
}
function sceneBtn(S){                               // la mano oprime el botón (play)
 const BX=200,BY=236,bs=.9;
 const bg=el('g',{transform:`translate(${BX} ${BY}) scale(${bs})`},S);bg.innerHTML=svgButton();
 const cap=bg.querySelector('.btnCap'),glow=bg.querySelector('.btnGlow');
 const hs=.56,ROT=172,hg=el('g',{},S);hg.innerHTML=svgButtonHand();
 const P=112,W=106,tl=[-.37*W,-P*.98-.93*P-W*.12],a=ROT*Math.PI/180;
 const tip=[(tl[0]*Math.cos(a)-tl[1]*Math.sin(a))*hs,(tl[0]*Math.sin(a)+tl[1]*Math.cos(a))*hs];
 const j=[0,1,2].map(k=>[...hg.querySelectorAll(`.bhf0j${k}`)]);
 const Y=[-46,10,-46];
 return i=>{const y=Y[i],press=i===1;
  cap.setAttribute('transform',`translate(0 ${Math.max(0,y)/bs})`);
  if(glow)glow.setAttribute('opacity',press?'.85':'0');
  allT(j[1],`rotate(${press?-8:0})`);allT(j[2],`rotate(${press?-10:0})`);
  hg.setAttribute('transform',`translate(${BX-tip[0]} ${BY+y-tip[1]}) rotate(${ROT}) scale(${hs})`)};
}

/* ---------- menú: clic en la cara → se despliegan las 3 manos, cada una lleva a su área ---------- */
(()=>{
 const hero=document.querySelector('.hero'),stage=document.getElementById('avatar-stage');
 if(!hero||!stage)return;
 const AREAS=[
  {k:'ilu',href:'#illustration-projects',label:'Ilustración',scene:sceneIlu},
  {k:'brand',href:'#branding-projects',label:'Branding y diseño',scene:sceneClick},
  {k:'motion',href:'#motion-projects',label:'Motion',scene:sceneBtn}];
 const nav=document.createElement('nav');
 nav.className='hands-menu';nav.id='hands-menu';nav.setAttribute('aria-label','Áreas de trabajo');
 const poses=AREAS.map((a,i)=>{
  const link=document.createElement('a');
  link.className=`hand hand-${a.k}`;link.href=a.href;link.style.setProperty('--i',i);link.tabIndex=-1;
  link.innerHTML=`<svg viewBox="0 0 400 300" aria-hidden="true"></svg><span>${a.label}</span>`;
  nav.appendChild(link);
  return a.scene(link.querySelector('svg'));
 });
 hero.appendChild(nav);
 stage.setAttribute('aria-controls','hands-menu');stage.setAttribute('aria-expanded','false');
 stage.setAttribute('aria-label','Retrato interactivo. Muestra mis tres áreas de trabajo.');
 const hint=document.getElementById('avatar-hint');if(hint)hint.textContent='HACÉ CLIC PARA VER MIS ÁREAS';
 let frame=0,timer=0,open=false;
 const draw=f=>poses.forEach(p=>p(f));
 draw(reduced?2:0);
 const set=v=>{
  open=v;hero.classList.toggle('hands-open',v);stage.setAttribute('aria-expanded',String(v));
  nav.querySelectorAll('a,button').forEach(a=>a.tabIndex=v?0:-1);
  clearInterval(timer);
  if(v&&!reduced){frame=0;draw(0);timer=setInterval(()=>{frame=(frame+1)%3;draw(frame)},230);}
 };
 stage.addEventListener('click',()=>set(!open));
 nav.addEventListener('click',e=>{if(e.target.closest('a'))set(false)});
 document.addEventListener('click',e=>{if(open&&!e.target.closest('#hands-menu')&&!e.target.closest('#avatar-stage'))set(false)});
 document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){set(false);stage.focus()}});
 // botón «Cerrar» dentro del menú
 const close=document.createElement('button');close.type='button';close.className='hands-close';close.textContent='CERRAR ✕';close.tabIndex=-1;
 close.addEventListener('click',e=>{e.stopPropagation();set(false);stage.focus()});
 nav.appendChild(close);
 // si se desliza lejos del hero con el menú abierto, se cierra solo
 window.addEventListener('scroll',()=>{if(open&&window.scrollY>hero.offsetHeight*.35)set(false)},{passive:true});
 // cara chica flotante: aparece cuando el hero sale de la vista y abre el mismo menú desde cualquier parte
 const mini=document.createElement('button');
 mini.type='button';mini.className='avatar-mini';mini.setAttribute('aria-label','Abrir el menú de mis áreas de trabajo');
 mini.innerHTML='<img src="assets/avatar-mini.jpg" alt="" width="96" height="96"><span>MENÚ</span>';
 document.body.appendChild(mini);
 // sobre el contacto, la cara flotante se esconde para no tapar los enlaces
 const foot=document.getElementById('contact');
 if(foot&&'IntersectionObserver' in window)new IntersectionObserver(([e])=>mini.classList.toggle('is-hidden',e.isIntersecting)).observe(foot);
 if('IntersectionObserver' in window){
  new IntersectionObserver(([e])=>mini.classList.toggle('is-on',!e.isIntersecting),{rootMargin:'0px 0px -55% 0px'}).observe(hero);
 }
 mini.addEventListener('click',e=>{
  e.stopPropagation();
  const go=()=>{if(window.scrollY<4){set(true);stage.focus({preventScroll:true});return}requestAnimationFrame(go)};
  window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});requestAnimationFrame(go);
 });
})();

/* ---------- Sobre mí: el personaje camina mientras deslizás y pasa de joven a viejo ---------- */
function walkerAge(age){
 let s=svgWalker();
 if(age===0){                                    // 2015: sin barba ni bigote
  s=s.replace(new RegExp(`<path [^>]*fill="${C.beard}"/>`,'g'),'').replace(new RegExp(`<path [^>]*stroke="${C.beardL}"[^>]*/>`,'g'),'');
 }
 if(age===2){                                    // más adelante: canas, anteojos y un poco encorvado
  s=s.split(C.hairL).join('#F1EEF6').split(C.hair).join('#D8D3E3').split(C.beardL).join('#E7E3EF').split(C.beard).join('#C4BED2');
  s=s.replace(/(<ellipse cx="18" cy="-60"[^>]*\/>)/,`$1<circle cx="34" cy="-84" r="15" fill="rgba(255,255,255,.18)" stroke="${C.deep}" stroke-width="4"/><path d="M49,-86 L58,-88 M19,-86 L-8,-92" stroke="${C.deep}" stroke-width="4" stroke-linecap="round"/>`);
  const iLB=s.indexOf('<g class="legB">'),iT=s.indexOf('<g class="torso">'),iLF=s.indexOf('<g class="legF">'),iAF=s.indexOf('<g class="armF"');
  const lean=x=>`<g transform="rotate(7)">${x}</g>`;
  s=lean(s.slice(0,iLB))+s.slice(iLB,iT)+lean(s.slice(iT,iLF))+s.slice(iLF,iAF)+lean(s.slice(iAF));
 }
 return s;
}
(()=>{
 /* «Mi recorrido»: escena fija mientras se desliza. El personaje camina de izquierda a derecha sobre una
    línea con 6 hitos; arriba, el título grande del hito; abajo, su descripción. La edad sale del hito. */
 const sec=document.getElementById('recorrido');
 if(!sec)return;
 const steps=[...sec.querySelectorAll('.journey-steps li')],marks=[...sec.querySelectorAll('.journey-line i')];
 const walker=sec.querySelector('.journey-walker'),wk=sec.querySelector('.wk'),road=sec.querySelector('.journey-road'),count=sec.querySelector('.journey-count b');
 const WP=[{lF:24,lB:-24,kF:4,kB:30,aF:-26,aB:26,y:0},{lF:0,lB:0,kF:0,kB:0,aF:0,aB:0,y:-10},{lF:-24,lB:24,kF:30,kB:4,aF:26,aB:-26,y:0}];
 const CYCLE=[0,1,2,1],N=steps.length;
 let age=-1,cur=-1,raf=0;
 const pose=f=>{const P=WP[f],q=c=>wk.querySelector(c);if(!q('.legF'))return;
  q('.legF').setAttribute('transform',`rotate(${P.lF})`);q('.legB').setAttribute('transform',`rotate(${P.lB})`);
  q('.lFk').setAttribute('transform',`translate(0,120) rotate(${-P.kF})`);q('.lBk').setAttribute('transform',`translate(0,120) rotate(${-P.kB})`);
  q('.armF').setAttribute('transform',`translate(-6,-192) rotate(${P.aF})`);q('.armB').setAttribute('transform',`translate(4,-192) rotate(${P.aB})`);
  wk.setAttribute('transform',`translate(0 ${P.y})`)};
 const update=()=>{
  raf=0;
  const r=sec.getBoundingClientRect(),run=Math.max(1,r.height-window.innerHeight);
  const p=Math.min(1,Math.max(0,-r.top/run));
  const i=Math.min(N-1,Math.floor(p*N*.999));
  if(i!==cur){
   cur=i;steps.forEach((s,k)=>s.classList.toggle('is-on',k===i));marks.forEach((m,k)=>m.classList.toggle('is-on',k<=i));
   if(count)count.textContent=String(i+1).padStart(2,'0');
   const a=+steps[i].dataset.age;
   if(a!==age){age=a;wk.innerHTML=walkerAge(a);}
  }
  const track=road.clientWidth-walker.offsetWidth;
  walker.style.transform=`translateX(${(p*Math.max(0,track)).toFixed(1)}px)`;
  pose(reduced?1:CYCLE[Math.floor(window.scrollY/(age===2?90:60))%4]);
 };
 const req=()=>{if(!raf)raf=requestAnimationFrame(update)};
 window.addEventListener('scroll',req,{passive:true});
 window.addEventListener('resize',req,{passive:true});
 update();
})();
(()=>{
 /* títulos grandes que se deslizan de costado según su paso por la pantalla (alternando el sentido) */
 if(reduced)return;
 const els=[...document.querySelectorAll('.works-heading h2,.discipline-main h3,.services h2,.footer-email')];
 if(!els.length)return;
 let raf=0;
 const update=()=>{
  raf=0;const vh=window.innerHeight,vw=window.innerWidth;
  els.forEach((el,k)=>{
   const r=el.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;
   const p=(vh-r.top)/(vh+r.height);                 // 0 entrando por abajo → 1 saliendo por arriba
   el.style.translate=`${((.5-p)*(k%2?-1:1)*vw*.12).toFixed(1)}px 0`;
  });
 };
 const req=()=>{if(!raf)raf=requestAnimationFrame(update)};
 window.addEventListener('scroll',req,{passive:true});window.addEventListener('resize',req,{passive:true});
 update();
})();
})();

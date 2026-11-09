
const $=id=>document.getElementById(id);
const COLORS=['#111612','#FFFFFF','#E7FF73','#9CDBB0','#B98B5E','#44664D'];
const ICONS={models:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',artwork:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',material:'<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',export:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'};
const NAMES={models:'Models',artwork:'Artwork',material:'Material',export:'Dieline'};
const PRESETS=FOLIO_TEMPLATES.map(t=>({id:t.id,n:t.name,board:t.board||'Studio presets',d:['L','W','H'].map(k=>t.dimensions_mm[k])}));
let dielineMode=false, lastCustomModel=null, pendingModelKey='', modelTimer;
const S={template:'mailer',L:220,W:150,H:60,color:'#FFFFFF',mat:'kraft',fin:'matte',qty:500,mode:'wrap',pat:.25,img:null,u:'mm',open:false,sel:null,E:[{id:1,face:'lid',text:'YOUR BRAND',x:.5,y:.5,sz:.9,color:''}]};
let nid=2,caretOn=true,dirty=false;
const KEYS=['foldProgress','openAmount','open','template','L','W','H','color','mat','fin','qty','mode','pat','img'];
let hist=[],hi=-1;
const snap=()=>{const o=Object.fromEntries(KEYS.map(k=>[k,S[k]]));o.E=S.E.map(e=>({...e}));return o};
function commit(){hist=hist.slice(0,hi+1);hist.push(snap());hi++;ub()}
function ub(){$('undo').disabled=hi<=0;$('redo').disabled=hi>=hist.length-1}
function go(d){const n=hi+d;if(n<0||n>=hist.length)return;hi=n;Object.assign(S,hist[hi]);S.E=hist[hi].E.map(e=>({...e}));S.sel=null;refresh();ub()}
$('undo').onclick=()=>go(-1);$('redo').onclick=()=>go(1);

/* panels */
const rail=$('rail');
Object.keys(NAMES).forEach((k,i)=>{const b=document.createElement('button');b.setAttribute('role','tab');b.dataset.p=k;b.innerHTML='<svg viewBox="0 0 24 24">'+ICONS[k]+'</svg>'+NAMES[k];b.onclick=()=>showP(k);rail.appendChild(b)});
function showP(k){rail.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.p===k));document.querySelectorAll('.pane').forEach(p=>p.hidden=p.dataset.p!==k)}
showP('models');
PRESETS.forEach((p,i)=>{const b=document.createElement('button');b.className='card';b.innerHTML='<b>'+p.n+'</b><small>'+p.d.join(' × ')+' mm</small>';b.onclick=()=>{S.template=p.id;[S.L,S.W,S.H]=p.d;refresh();commit()};b.dataset.i=i;$('models').appendChild(b)});
COLORS.forEach(c=>{const b=document.createElement('button');b.style.background=c;b.dataset.c=c;b.setAttribute('aria-label','Colour '+c);b.onclick=()=>{S.color=c;refresh();commit()};$('sw').appendChild(b)});

/* controls */
['L','W','H'].forEach(k=>{$(k).oninput=e=>{S[k]=+e.target.value;refresh()};$(k).onchange=commit});
$('pat').oninput=e=>{S.pat=+e.target.value;refresh()};$('pat').onchange=commit;

['mat','fin','qty'].forEach(k=>$(k).onchange=e=>{S[k]=k==='qty'?+e.target.value:e.target.value;refresh();commit()});
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>{S.mode=b.dataset.v;refresh();commit()});
document.querySelectorAll('#unit button').forEach(b=>b.onclick=()=>{S.u=b.dataset.v;refresh()});
$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{S.img=im;refresh();commit()};im.src=URL.createObjectURL(f);e.target.value=''};
$('clear').onclick=()=>{S.img=null;refresh();commit()};
$('open').onclick=()=>{S.open=!S.open;tx=S.open?.85:.3;$('open').setAttribute('aria-pressed',S.open)};
$('quote').onclick=()=>{$('msg').textContent='';alert('Quote requested for '+S.qty+' boxes. In the full platform this sends your design to our team.')};
const fmt=v=>S.u==='in'?(v/25.4).toFixed(2)+' in':v+' mm';
function price(){return {u:null,t:null,quoteRequired:true}}
function refresh(){
 ['L','W','H'].forEach(k=>{$(k).value=S[k];$('v'+k).textContent=fmt(S[k])});
 $('vpat').textContent=Math.round(S.pat*100)+'%';$('pat').value=S.pat;$('mat').value=S.mat;$('fin').value=S.fin;$('qty').value=S.qty;
 document.querySelectorAll('#mode button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.mode));
 document.querySelectorAll('#unit button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===S.u));
 $('sw').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===S.color));
 $('models').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',PRESETS[b.dataset.i].id===S.template));
 const p=price();$('price').textContent='Custom quote';$('total').textContent=S.qty+' boxes · Final price after specification review';
 build();
}

/* 3D */
const cv=$('cv'),renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(32,1,.1,100);
scene.add(new THREE.HemisphereLight(0xffffff,0xc2bfd0,.75));const fillLight=new THREE.DirectionalLight(0xffeaf3,.45);fillLight.position.set(-4,2,2);scene.add(fillLight);
const dl=new THREE.DirectionalLight(0xffffff,.8);dl.position.set(3,5,4);scene.add(dl);
const group=new THREE.Group();scene.add(group);group.rotation.set(.3,-.6,0);
let box=null,pivot=null,folding=null,faces={},tx=.3,zoom=1,dist=5,auto=true;
const dark=h=>{const n=parseInt(h.slice(1),16);return 'rgb('+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v*.82)).join(',')+')'};
const lum=h=>{const n=parseInt(h.slice(1),16);return((n>>16)*299+((n>>8)&255)*587+(n&255)*114)/1000};
function paint(f){
 const F=faces[f],x=F.x,cw=F.cw,ch=F.ch;
 x.setLineDash([]);x.globalAlpha=1;x.fillStyle=f==='inside'?dark(S.color):S.color;x.fillRect(0,0,cw,ch);
 if(S.mat==='kraft'){x.fillStyle='rgba(0,0,0,.012)';for(let i=0;i<cw;i+=7)x.fillRect(i,0,2,ch)}
 const im=S.img;
 if(im&&f!=='inside'){
  if(S.mode==='wrap'){const s=Math.min(cw*.8/im.width,ch*.8/im.height);x.drawImage(im,(cw-im.width*s)/2,(ch-im.height*s)/2,im.width*s,im.height*s)}
  else{const w=S.pat*Math.min(cw,ch)*1.6,h=w*im.height/im.width,gx=w*1.5,gy=h*1.6;x.save();x.globalAlpha=.9;
   for(let r=0,y=gy/2;y<ch+gy;r++,y+=gy)for(let c=-1,xx=(r%2)*gx/2;xx<cw+gx;c++,xx+=gx)x.drawImage(im,xx-w/2,y-h/2,w,h);x.restore()}
 }
 S.E.filter(e=>e.face===f).forEach(e=>{if(e.type==='img'){const L=LIB.find(l=>l.id===e.lib);if(!L)return;const w=e.sz*cw*.3,h=w*L.img.height/L.img.width;x.drawImage(L.img,e.x*cw-w/2,e.y*ch-h/2,w,h);e.bw=w;e.bh=h;if(e.id===S.sel){x.save();x.strokeStyle='#397f52';x.lineWidth=3;x.setLineDash([10,7]);x.strokeRect(e.x*cw-w/2-6,e.y*ch-h/2-6,w+12,h+12);x.setLineDash([]);x.fillStyle='#E7FF73';x.fillRect(e.x*cw+w/2-9,e.y*ch+h/2-9,18,18);x.restore()}return}const fs=e.sz*cw*.1;x.font='700 '+fs+'px "Bricolage Grotesque",sans-serif';x.textAlign='center';x.textBaseline='middle';const col=e.color||(lum(S.color)>150?'#0F2133':'#F7F7F5'),tw=x.measureText(e.text).width;x.fillStyle=col;e.bw=Math.max(tw,fs);e.bh=fs*1.3;x.fillText(e.text,e.x*cw,e.y*ch);
  if(e.id===S.sel){x.save();x.strokeStyle='#397f52';x.lineWidth=3;x.setLineDash([10,7]);x.strokeRect(e.x*cw-e.bw/2-10,e.y*ch-e.bh/2,e.bw+20,e.bh);x.setLineDash([]);x.fillStyle='#E7FF73';x.fillRect(e.x*cw+e.bw/2-9,e.y*ch+e.bh/2-9,18,18);if(caretOn){x.fillStyle=col;x.fillRect(e.x*cw+tw/2+4,e.y*ch-fs*.55,3,fs*1.1)}x.restore()}});
 F.tex.needsUpdate=true;
}
const paintAll=()=>Object.keys(faces).forEach(paint);
function mkFace(f,w,h){const k=900/Math.max(w,h),c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);const t=new THREE.CanvasTexture(c);t.anisotropy=renderer.capabilities.getMaxAnisotropy();t.encoding=THREE.sRGBEncoding;faces[f]={x:c.getContext('2d'),cw:c.width,ch:c.height,tex:t};return t}
function build(){
 if(folding){folding.dispose();folding=null}if(box){group.remove(box);box.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material)[].concat(n.material).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})})}
 faces={};box=new THREE.Group();pivot=null;
 const model=currentModel();
 const edge=new THREE.MeshStandardMaterial({color:S.mat==='kraft'?0xbca681:S.color,roughness:.95});
 folding=FolioFolding.mount(THREE,model,{materials:p=>{
  const inner=new THREE.MeshStandardMaterial({color:S.mat==='kraft'?0xd1b68a:0xf5f0eb,roughness:.93});
  const outer=new THREE.MeshStandardMaterial({color:S.color,roughness:S.fin==='gloss'?.27:.8});
  if(p.face){const texture=mkFace(p.face,p.width,p.height);const printed=new THREE.MeshStandardMaterial({map:texture,roughness:S.fin==='gloss'?.27:.8});return[edge,edge,edge,edge,p.face==='inside'?printed:inner,p.face==='inside'?outer:printed]}
  return[edge,edge,edge,edge,inner,outer];
 }});
 folding.setGuides(dielineMode);folding.group.position.y=-S.H*.005;box.add(folding.group);folding.setProgress(S.foldProgress||0);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const x=shadowCanvas.getContext('2d'),gradient=x.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(25,30,40,.25)');gradient.addColorStop(1,'rgba(25,30,40,0)');x.fillStyle=gradient;x.fillRect(0,0,128,128);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(S.L*.025,S.W*.03),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-S.H*.005-.02;shadow.visible=!dielineMode && !model.upright;box.add(shadow);
 group.add(box);dist=Math.max(S.L,S.W,S.H)*.028+1.6;paintAll();
}
function currentModel() {
  const preset=FOLIO_MODELS[S.template] || FOLIO_MODELS.mailer;
  const dimensions={L:S.L,W:S.W,H:S.H};
  const key=JSON.stringify([S.template,dimensions]);
  if (lastCustomModel?.key===key) return lastCustomModel.model;
  if (Object.keys(dimensions).every(k=>dimensions[k]===preset.dimensions[k])) return preset;
  if (key!==pendingModelKey) {
    clearTimeout(modelTimer);
    pendingModelKey=key;
    modelTimer=setTimeout(async () => {
      try {
        const response=await fetch('/api/v1/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({template_id:S.template,dimensions})});
        if(!response.ok) throw Error('Could not update box dimensions.');
        const model=await response.json();
        if(key!==JSON.stringify([S.template,{L:S.L,W:S.W,H:S.H}])) return;
        lastCustomModel={key,model};
        refresh();
      } catch(error) { if(key===pendingModelKey) toast(error.message); }
      finally { if(key===pendingModelKey) pendingModelKey=''; }
    },80);
  }
  return preset;
}
function resize(){const r=cv.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);cam.aspect=r.width/r.height;cam.updateProjectionMatrix()}
new ResizeObserver(resize).observe(cv);
let drag=null;
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let mv=null,moved=false,lastTap=0;
const selEl=()=>S.E.find(e=>e.id===S.sel);
function hit(e){const r=cv.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ptr,cam);group.updateMatrixWorld(true);
 if(dielineMode)return null;const h=ray.intersectObjects(folding.meshes,false)[0];if(!h||!h.face||!h.object.userData.face||h.face.materialIndex!==h.object.userData.idx)return null;
 const f=h.object.userData.face,F=faces[f];return{f,F,px:h.uv.x*F.cw,py:(1-h.uv.y)*F.ch}}
function elAt(f,px,py){for(let i=S.E.length-1;i>=0;i--){const e=S.E[i],F=faces[f];if(e.face!==f||!e.bw)continue;if(Math.abs(px-e.x*F.cw)<e.bw/2+14&&Math.abs(py-e.y*F.ch)<e.bh/2+10)return e}return null}
function select(id,all){const o=selEl();S.sel=id;const e=selEl();caretOn=true;
 if(e){$('tsz').value=e.sz;$('vsz').textContent=Math.round(e.sz*100)+'%';if(e.type==='img')$('kb').blur();else{$('kb').value=e.text;$('kb').focus({preventScroll:true});all?$('kb').select():$('kb').setSelectionRange(e.text.length,e.text.length);$('tcol').value=e.color||(lum(S.color)>150?'#0F2133':'#F7F7F5')}}else $('kb').blur();
 if(o)paint(o.face);if(e)paint(e.face)}
function addText(f,x,y){const e={id:nid++,face:f,text:'New text',x:Math.min(.9,Math.max(.1,x)),y:Math.min(.9,Math.max(.1,y)),sz:.8,color:''};S.E.push(e);commit();select(e.id,true);paint(f)}
$('kb').oninput=()=>{const e=selEl();if(!e)return;e.text=$('kb').value.replace(/\n/g,' ');caretOn=true;dirty=true;paint(e.face)};
$('kb').onkeydown=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();select(null)}};
$('kb').onblur=()=>{if(dirty){dirty=false;commit()}};
$('addT').onclick=()=>addText('front',.5,.3);
$('delT').onclick=()=>{const e=selEl();if(!e)return;S.E=S.E.filter(x=>x.id!==e.id);S.sel=null;$('kb').blur();commit();paint(e.face)};
$('tsz').oninput=ev=>{const e=selEl();if(!e)return;e.sz=+ev.target.value;$('vsz').textContent=Math.round(e.sz*100)+'%';paint(e.face)};$('tsz').onchange=commit;
$('tcol').oninput=ev=>{const e=selEl();if(!e)return;e.color=ev.target.value;paint(e.face)};$('tcol').onchange=commit;
const LIB=[];let lidn=1;
function renderLib(){const t=$('lib');t.innerHTML='';LIB.forEach(L=>{const i=document.createElement('img');i.src=L.url;i.alt='Photo '+L.id;i.className='thumb';i.draggable=true;i.title='Drag onto the box';i.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','folio:img:'+L.id);ev.dataTransfer.effectAllowed='copy'};i.onclick=()=>addImg(L.id,'front',.5,.5);t.appendChild(i)})}
function loadPhoto(file,cb){const im=new Image();im.onload=()=>{const L={id:lidn++,img:im,url:im.src};LIB.push(L);renderLib();if(cb)cb(L)};im.src=URL.createObjectURL(file)}
function addImg(lib,f,x,y){const e={id:nid++,type:'img',lib,face:f,x:Math.min(.95,Math.max(.05,x)),y:Math.min(.95,Math.max(.05,y)),sz:1,color:''};S.E.push(e);commit();select(e.id);paint(f)}
$('photos').onchange=ev=>{[...ev.target.files].forEach(f=>loadPhoto(f));ev.target.value=''};
$('chipT').ondragstart=ev=>{ev.dataTransfer.setData('text/plain','folio:text');ev.dataTransfer.effectAllowed='copy'};
$('chipT').onclick=()=>addText('front',.5,.3);
const stage=document.querySelector('.stage');
cv.addEventListener('dragover',ev=>{ev.preventDefault();ev.dataTransfer.dropEffect='copy';stage.classList.add('over')});
['dragleave','dragend'].forEach(t=>cv.addEventListener(t,()=>stage.classList.remove('over')));
cv.addEventListener('drop',ev=>{ev.preventDefault();stage.classList.remove('over');const h=hit(ev);if(!h)return;
 const files=[...ev.dataTransfer.files].filter(f=>f.type.startsWith('image/')),d=ev.dataTransfer.getData('text/plain')||'',px=h.px/h.F.cw,py=h.py/h.F.ch;
 if(files.length)files.forEach((f,i)=>loadPhoto(f,L=>addImg(L.id,h.f,px+i*.1,py)));
 else if(d==='folio:text')addText(h.f,px,py);
 else if(d.startsWith('folio:img:'))addImg(+d.slice(10),h.f,px,py)});
setInterval(()=>{const e=selEl();if(e&&document.activeElement===$('kb')){caretOn=!caretOn;paint(e.face)}},530);
cv.addEventListener('mousedown',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{auto=false;cv.setPointerCapture(e.pointerId);moved=false;const h=hit(e),el=h&&elAt(h.f,h.px,h.py);
 if(el){select(el.id);mv={resize:Math.abs(h.px-(el.x*h.F.cw+el.bw/2))<24&&Math.abs(h.py-(el.y*h.F.ch+el.bh/2))<24,startX:e.clientX,startY:e.clientY,startSize:el.sz,e:el,dx:h.px-el.x*h.F.cw,dy:h.py-el.y*h.F.ch,f:h.f};cv.style.cursor='move'}
 else{select(null);const now=Date.now();if(h&&now-lastTap<350){addText(h.f,h.px/h.F.cw,h.py/h.F.ch)}lastTap=now;drag=[e.clientX,e.clientY];cv.style.cursor='grabbing'}});
cv.addEventListener('pointermove',e=>{
 if(mv&&mv.resize){mv.e.sz=Math.max(.1,Math.min(5,mv.startSize+(e.clientX-mv.startX+e.clientY-mv.startY)*.008));moved=true;paint(mv.f);syncElementControls();return} if(mv){const h=hit(e);if(h){if(h.f!==mv.f){const of=mv.f;mv.e.face=h.f;mv.f=h.f;mv.dx=0;mv.dy=0;paint(of)}mv.e.x=Math.max(.05,Math.min(.95,(h.px-mv.dx)/h.F.cw));mv.e.y=Math.max(.05,Math.min(.95,(h.py-mv.dy)/h.F.ch));moved=true;paint(mv.f);syncElementControls()}return}
 if(!drag)return;group.rotation.y+=(e.clientX-drag[0])*.01;group.rotation.x=Math.max(-.2,Math.min(1.2,group.rotation.x+(e.clientY-drag[1])*.006));tx=group.rotation.x;drag=[e.clientX,e.clientY]});
['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{if(mv&&moved)commit();drag=null;mv=null;cv.style.cursor='grab';if(selEl()&&selEl().type!=='img')$('kb').focus({preventScroll:true})}));
cv.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(2,zoom*(1+e.deltaY*.001)))},{passive:false});
const still=matchMedia('(prefers-reduced-motion:reduce)').matches;let o=0;auto=false;
(function loop(){if(document.body.dataset.view && document.body.dataset.view!=='editor'){requestAnimationFrame(loop);return}o+=(((S.openAmount ?? (S.open?1:0)))-o)*(still?1:.08);if(folding)folding.setProgress(o);
 if(dielineMode){
    o=S.openAmount ?? 1;
    if(folding) folding.setProgress(o);
    group.rotation.set(.38+(Math.PI/2-Math.atan(.18)-.38)*o,-.62*(1-o),0);
 } else if(!drag&&Math.abs(tx-group.rotation.x)>.002)group.rotation.x+=(tx-group.rotation.x)*.07;
 if(auto&&!still&&!S.open)group.rotation.y+=.004;
 if(!folding){requestAnimationFrame(loop);return}group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(folding.group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const fov=cam.fov*Math.PI/360;const fit=Math.max(size.y,size.x/cam.aspect)*.5/Math.tan(fov)+size.z*.5;const d=Math.max(3,fit*1.25)*zoom;cam.position.set(center.x,center.y+d*.18,center.z+d);cam.lookAt(center);renderer.render(scene,cam);requestAnimationFrame(loop)})();

function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
let saveDie;
resize();refresh();commit();
(document.fonts?document.fonts.ready:Promise.resolve()).then(paintAll);

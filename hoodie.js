// Original cloth meshes share body and sleeve UVs with the live artwork editor.
const $ = id => document.getElementById(id);
const canvas = $('garment');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const garment = new THREE.Group();
const camera = new THREE.PerspectiveCamera(32, 1, .01, 30);
scene.add(garment, new THREE.HemisphereLight(0xf4f5f7, 0x34353a, .5));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(-4, 4.5, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -2.2;
key.shadow.camera.right = key.shadow.camera.top = 2.2;
key.shadow.normalBias = .008;
key.shadow.bias = -.0003;
scene.add(key);
const fill = new THREE.DirectionalLight(0xe8edf8, .24);
fill.position.set(3, .5, 2);
scene.add(fill);
const rimLight = new THREE.DirectionalLight(0xffffff, .7);
rimLight.position.set(2, 3, -3);
scene.add(rimLight);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .25 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.15;
floor.receiveShadow = true;
scene.add(floor);
const cloth = new THREE.MeshStandardMaterial({ color: 0x243049, roughness: .94, side: THREE.DoubleSide });
const dark = new THREE.MeshStandardMaterial({ color: 0x151c2b, roughness: .96, side: THREE.DoubleSide });
const hoodLining = new THREE.MeshStandardMaterial({color:0x0a110b,roughness:1,side:THREE.DoubleSide});
const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x323b35, roughness: 1 });
const maps = {}, prints = [], targets = [];
const garmentOptions = {
  hoodie: { title: 'Pullover hoodie', subtitle: 'RELAXED FIT · PULLOVER', color: '#f1f1ed', short: false },
  'tshirt-short': { title: 'Half Sleeved Shirts', subtitle: 'CREW NECK · SHORT SLEEVES', color: '#e0e3cf', short: true },
  'tshirt-long': { title: 'Full Sleeved Shirts', subtitle: 'CREW NECK · LONG SLEEVES', color: '#26352b', short: false }
};
let garmentType = 'hoodie';
const savedGarments = {};

function knitTexture(ribbed) {
  const size = 256, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const stitch = Math.cos(2 * Math.PI * (x / 4 + .2 * Math.cos(y * Math.PI / 3)));
    const rib = Math.cos(x * Math.PI / 7);
    const grain = Math.sin(x * 83.17 + y * 19.91) * Math.sin(y * 29.13 - x * 3.71);
    const height = Math.round(128 + 19 * stitch + 10 * Math.cos(y * Math.PI / 3) + 8 * grain + (ribbed ? 42 * rib : 0));
    data.set([height, height, height, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 8);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
const fleece = knitTexture(false), rib = knitTexture(true);
cloth.bumpMap = fleece;
cloth.bumpScale = .0012;
dark.bumpMap = rib;
dark.bumpScale = .0019;

function printMaterial(zone) {
  const paper = document.createElement('canvas');
  paper.width = 2048;
  paper.height = 1024;
  const texture = new THREE.CanvasTexture(paper);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  maps[zone] = { paper, texture };
  return new THREE.MeshStandardMaterial({ map: texture, bumpMap: fleece, bumpScale: .0012, roughness: .94, side: THREE.DoubleSide });
}

function buildGarment() {
  for (const mesh of garment.children.slice()) {
    garment.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material && ![cloth, dark, hoodLining, seamMaterial].includes(mesh.material)) mesh.material.dispose();
  }
  for (const map of Object.values(maps)) map.texture.dispose();
  Object.keys(maps).forEach(zone => delete maps[zone]);
  targets.length = 0;
  const model = window.FolioGarmentModel.create({
    kind: garmentType,
    materials: { cloth, dark, hoodLining, seamMaterial },
    printMaterial
  });
  for (const mesh of model.group.children.slice()) garment.add(mesh);
  targets.push(...model.targets);
  canvas.setAttribute('aria-label', '3D ' + garmentOptions[garmentType].title + ' with live editable text and artwork');
  $('garmentTitle').textContent = $('sidebarTitle').textContent = garmentOptions[garmentType].title;
  $('garmentDetails').textContent = garmentOptions[garmentType].subtitle;
  $('garmentType').value = garmentType;
}
const spots={'Center chest':['body',.25,.69,0],'Left chest':['body',.32,.69,0],'Upper back':['body',.75,.69,Math.PI],'Back neck':['body',.75,.82,Math.PI],'Left sleeve':['left',.50,.56,-Math.PI/2],'Right sleeve':['right',0,.56,Math.PI/2]};
let selected=null;
function paint(onlyZone){
  for(const print of prints){
    if(print.autoInk){
      print.ink=defaultInk();
      if(print===selected)$('ink').value=print.ink;
    }
  }
  document.querySelectorAll('[data-fabric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fabric.toLowerCase()===$('fabric').value.toLowerCase())));
  cloth.color.set($('fabric').value).convertSRGBToLinear();
  dark.color.copy(cloth.color).multiplyScalar(garmentType === 'hoodie' ? .91 : .88);
  seamMaterial.color.copy(cloth.color).multiplyScalar(.78);
  hoodLining.color.copy(cloth.color).multiplyScalar(.13);
  for(const [zone,{paper,texture}] of Object.entries(maps)){
    if(typeof onlyZone==='string' && zone!==onlyZone)continue;
    const ctx=paper.getContext('2d');
    ctx.fillStyle=$('fabric').value;
    ctx.fillRect(0,0,paper.width,paper.height);
    const shading=ctx.createLinearGradient(0,0,paper.width,0);
    for(const [stop,opacity] of [[0,.11],[.12,.025],[.25,0],[.38,.025],[.5,.11],[.62,.025],[.75,0],[.88,.025],[1,.11]]) shading.addColorStop(stop,'rgba(0,0,0,'+opacity+')');
    ctx.fillStyle=shading;
    ctx.fillRect(0,0,paper.width,paper.height);
    for(const p of prints.filter(p=>p.zone===zone)){
      const w=p.size/100*paper.width;
      for(const shift of [-1,0,1]){
        ctx.save();ctx.translate((p.u+shift)*paper.width,(1-p.v)*paper.height);ctx.rotate(p.angle*Math.PI/180);
        if(p.image){
          p.height=w*p.image.height/p.image.width; p.width=w;
          ctx.drawImage(p.image,-w/2,-p.height/2,w,p.height);
        } else {
          ctx.font='700 100px '+p.font;const ratio=w/Math.max(1,ctx.measureText(p.words).width);
          p.height=Math.min(140,100*ratio);ctx.font='700 '+p.height+'px '+p.font;
          p.width=Math.min(w,ctx.measureText(p.words||' ').width);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=p.ink;ctx.fillText(p.words,0,0,w);
        }
        ctx.restore();
      }
    }
    texture.needsUpdate=true;
  }
}
function sync(){
  $('layers').replaceChildren(...prints.map((p,i)=>new Option(p.image?'Artwork '+(i+1):p.words||'Empty text',i)));
  $('controls').hidden=!selected;
  if(selected){
    $('layers').value=prints.indexOf(selected);$('place').value=selected.spot;
    $('words').value=selected.words;$('font').value=selected.font;$('ink').value=selected.ink;
    $('scale').value=selected.size;$('angle').value=selected.angle;$('textControls').hidden=!!selected.image;
  }
  $('printSize').textContent = selected ? Math.round(selected.size * 10) / 10 + '%' : '';
  $('printAngle').textContent = selected ? Math.round(selected.angle) + '°' : '';
  paint();
  persistGarments();
}
function place(p,name){
  const [zone,u,v,yaw]=spots[name];
  Object.assign(p,{spot:name,zone,u,v});garment.rotation.y=yaw;
}
function defaultInk(){
  const channels=$('fabric').value.slice(1).match(/../g).map(channel=>{
    const value=parseInt(channel,16)/255;
    return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
  });
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return luminance>.42?'#142419':'#ffffff';
}
function add(image=null){
  selected={words:'YOUR BRAND',font:'Arial',ink:defaultInk(),autoInk:true,size:14,angle:0,image};
  place(selected,'Center chest');prints.push(selected);sync();
}
Object.keys(spots).forEach(name=>$('place').append(new Option(name,name)));
Object.entries({'Front':0,'¾ right':-.7,'Right':-Math.PI/2,'Back':Math.PI,'Left':Math.PI/2,'¾ left':.7}).forEach(([name,yaw])=>{
  const button=document.createElement('button');button.textContent=name;button.onclick=()=>garment.rotation.y=yaw;$('views').append(button);
});
$('layers').onchange=()=>{selected=prints[+$('layers').value];garment.rotation.y=spots[selected.spot][3];sync()};
$('place').onchange=()=>{place(selected,$('place').value);sync()};
$('add').onclick=()=>add();$('fabric').oninput=()=>{paint();persistGarments()};
document.querySelectorAll('[data-fabric]').forEach(button=>{
  button.onclick=()=>{$('fabric').value=button.dataset.fabric;paint();persistGarments()};
});
for(const [id,prop] of [['words','words'],['font','font'],['ink','ink'],['scale','size'],['angle','angle']]){
  $(id).oninput=()=>{selected[prop]=$(id).type==='range'?+$(id).value:$(id).value;if(id==='ink')selected.autoInk=false;paint();$('printSize').textContent=selected.size+'%';$('printAngle').textContent=selected.angle+'°';persistGarments();if(id==='words')$('layers').selectedOptions[0].textContent=selected.words||'Empty text'};
}
$('duplicate').onclick=()=>{selected={...selected,v:Math.min(.93,selected.v+.06)};prints.push(selected);sync()};
$('remove').onclick=()=>{prints.splice(prints.indexOf(selected),1);selected=prints.at(-1);sync()};
$('upload').onclick=()=>$('file').click();
function importArt(file,placement=null){
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>15e6){$('status').textContent='Choose a PNG, JPEG or WebP under 15 MB.';return}
  const image=new Image(),url=URL.createObjectURL(file);
  image.onload=()=>{
    URL.revokeObjectURL(url);
    const backup=document.createElement('canvas'),ratio=Math.min(1,1400/Math.max(image.width,image.height));
    backup.width=Math.max(1,Math.round(image.width*ratio));backup.height=Math.max(1,Math.round(image.height*ratio));
    backup.getContext('2d').drawImage(image,0,0,backup.width,backup.height);
    const yaw=garment.rotation.y;add(image);selected.imageData=backup.toDataURL('image/png');if(placement){Object.assign(selected,placement);garment.rotation.y=yaw;sync()}
    const saved=persistGarments();
    $('status').textContent=saved?'Artwork placed. Drag it or use its handles.':'Artwork placed for this session. Browser storage is full. Export a PNG to keep it.';
    if(matchMedia('(max-width:740px)').matches)canvas.scrollIntoView({block:'center'})};
  image.onerror=()=>{URL.revokeObjectURL(url);$('status').textContent='The image could not be opened.'};image.src=url;
}
$('file').onchange=()=>{importArt($('file').files[0]);$('file').value=''};
canvas.ondragover=e=>e.preventDefault();canvas.ondrop=e=>{e.preventDefault();const h=hit(e);let placement=null;if(h){const zone=h.object.userData.zone,u=h.uv.x,v=h.uv.y;const spot=Object.keys(spots).filter(name=>spots[name][0]===zone).sort((a,b)=>Math.abs(deltaU(u,spots[a][1]))-Math.abs(deltaU(u,spots[b][1])))[0];placement={zone,u,v,spot}}importArt(e.dataTransfer.files[0],placement)};
const ray=new THREE.Raycaster();
function hit(e){
  const r=canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)*2/r.width-1,1-(e.clientY-r.top)*2/r.height),camera);
  return ray.intersectObjects(targets)[0];
}
function deltaU(a,b){return ((a-b+1.5)%1)-.5}
const frame=$('printFrame'),inlineText=$('onShirt');
let drag=null, handles=null;
function localOffset(p,u,v){
  const x=deltaU(u,p.u)*2048,y=(p.v-v)*1024,a=p.angle*Math.PI/180;
  return [x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)];
}
function printAt(hit){
  if(!hit)return null;
  return [...prints].reverse().find(p=>{
    if(p.zone!==hit.object.userData.zone)return false;
    const [x,y]=localOffset(p,hit.uv.x,hit.uv.y);
    return Math.abs(x)<=Math.max(14,p.width/2+3) && Math.abs(y)<=Math.max(14,p.height/2+3);
  });
}
// Project the same UV triangles that carry the ink, including the sleeve seam.
function surfacePoint(mesh,u,v){
  const {rings,columns}=mesh.userData;
  v=THREE.MathUtils.clamp(v,0,1);
  const upper=rings.findIndex(n=>n>=v);
  const row=Math.max(0,upper-1), fy=(v-rings[row])/(rings[row+1]-rings[row]);
  const col=(((u%1)+1)%1)*columns, base=row*(columns+1)+Math.floor(col),fx=col%1;
  const positions=mesh.geometry.attributes.position;
  const ids=fx+fy<=1?[base,base+1,base+columns+1]:[base+columns+2,base+columns+1,base+1];
  const weights=fx+fy<=1?[1-fx-fy,fx,fy]:[fx+fy-1,1-fx,1-fy];
  const point=new THREE.Vector3();
  ids.forEach((id,i)=>point.addScaledVector(new THREE.Vector3().fromBufferAttribute(positions,id),weights[i]));
  return mesh.localToWorld(point);
}
function screen(world){
  const projected=world.clone().project(camera);
  return {x:(1+projected.x)*canvas.clientWidth/2,y:(1-projected.y)*canvas.clientHeight/2};
}
function positionHandle(button,p){button.style.left=p.x+'px';button.style.top=p.y+'px'}
let lastFrameKey='';
function drawHandles(){
  const key=[prints.indexOf(selected),selected?.zone,selected?.u,selected?.v,selected?.angle,selected?.width,selected?.height,garment.rotation.y,canvas.clientWidth,canvas.clientHeight].join('/');
  if(key===lastFrameKey)return;
  lastFrameKey=key;
  handles=null;frame.hidden=true;
  if(!selected)return;
  const p=selected,mesh=targets.find(m=>m.userData.zone===p.zone);
  const centerWorld=surfacePoint(mesh,p.u,p.v);
  const eye=camera.position.clone().sub(centerWorld);
  ray.set(camera.position,eye.clone().negate().normalize());
  const nearest=ray.intersectObjects(garment.children)[0];
  if(nearest && nearest.distance<eye.length()-.024)return;
  const a=p.angle*Math.PI/180;
  function point(x,y){
    return screen(surfacePoint(mesh,p.u+(x*Math.cos(a)-y*Math.sin(a))/2048,p.v-(x*Math.sin(a)+y*Math.cos(a))/1024));
  }
  const w=Math.max(15,p.width/2+6),h=Math.max(13,p.height/2+5);
  const corners=[[-w,-h],[w,-h],[w,h],[-w,h]],outline=[];
  corners.forEach(([x,y],i)=>{
    const [nx,ny]=corners[(i+1)%4];
    for(let k=0;k<8;k++)outline.push(point(x+(nx-x)*k/8,y+(ny-y)*k/8));
  });
  const center=screen(centerWorld),top=point(0,-h);
  const len=Math.max(1,Math.hypot(top.x-center.x,top.y-center.y));
  const knob={x:top.x+(top.x-center.x)*28/len,y:top.y+(top.y-center.y)*28/len};
  const xy=q=>q.x.toFixed(2)+' '+q.y.toFixed(2);
  frame.querySelector('path').setAttribute('d','M'+outline.map(xy).join(' L')+' Z M'+xy(top)+' L'+xy(knob));
  positionHandle(frame.querySelector('[data-action=size]'),point(w,h));
  positionHandle(frame.querySelector('[data-action=angle]'),knob);
  handles={center};frame.hidden=false;
}
function gesturePoint(e,center){
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left-center.x,y=e.clientY-r.top-center.y;
  return {distance:Math.max(1,Math.hypot(x,y)),angle:Math.atan2(y,x)*180/Math.PI};
}
frame.querySelectorAll('button').forEach(button=>{
  button.onpointerdown=e=>{
    if(!handles)return;
    const center=handles.center,start=gesturePoint(e,center);
    drag={mode:button.dataset.action,center,start,p:selected,size:selected.size,angle:selected.angle};
    button.setPointerCapture(e.pointerId);e.preventDefault();
  };
  button.onpointermove=e=>{
    if(!drag || drag.mode!==button.dataset.action)return;
    const now=gesturePoint(e,drag.center);
    if(drag.mode==='size'){
      selected.size=Math.max(2,Math.min(32,drag.size*now.distance/drag.start.distance));$('scale').value=selected.size;
    } else {
      selected.angle=((drag.angle+now.angle-drag.start.angle+540)%360)-180;$('angle').value=selected.angle;
    }
    $('printSize').textContent=Math.round(selected.size*10)/10+'%';$('printAngle').textContent=Math.round(selected.angle)+'°';paint(selected.zone);
  };
  button.onpointerup=button.onlostpointercapture=()=>{drag=null;persistGarments()};
});
function editOnShirt(p){
  if(!p || p.image)return;
  selected=p;sync();drawHandles();if(!handles)return;
  positionHandle(inlineText,{x:Math.max(115,Math.min(canvas.clientWidth-115,handles.center.x)),y:Math.min(canvas.clientHeight-45,handles.center.y+28)});
  inlineText.hidden=false;inlineText.value=p.words;inlineText.focus();inlineText.select();
}
inlineText.oninput=()=>{selected.words=inlineText.value;sync()};
inlineText.onblur=()=>inlineText.hidden=true;
inlineText.onkeydown=e=>{if(e.key==='Enter' || e.key==='Escape')inlineText.blur()};
canvas.ondblclick=e=>editOnShirt(printAt(hit(e)));
canvas.onpointerdown=e=>{
  const h=hit(e),p=printAt(h);
  drag=p?{p,du:deltaU(p.u,h.uv.x),dv:p.v-h.uv.y}:{x:e.clientX};
  if(p){selected=p;sync()}canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
  if(!drag){canvas.style.cursor=printAt(hit(e))?'move':'grab';return}
  if(!drag.p){garment.rotation.y+=(e.clientX-drag.x)*.011;drag.x=e.clientX;return}
  const h=hit(e);if(!h || h.object.userData.zone!==drag.p.zone)return;
  drag.p.u=(h.uv.x+drag.du+1)%1;drag.p.v=Math.max(.03,Math.min(.98,h.uv.y+drag.dv));paint(drag.p.zone);
};
canvas.onpointerup=canvas.onlostpointercapture=()=>{drag=null;persistGarments()};
$('export').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='folio-'+garmentType+'.png';a.click()};
function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w || !h)return;renderer.setSize(w,h,false);camera.aspect=w/h;
  camera.position.set(0,.5,Math.max(5.25,4.8/camera.aspect));camera.lookAt(0,0,0);camera.updateProjectionMatrix();
}
let ready=false;
let requestedGarment=new URLSearchParams(location.search).get('garment') || 'hoodie';
function snapshotGarment(){
  savedGarments[garmentType]={prints:prints.slice(),selected:prints.indexOf(selected),color:$('fabric').value};
}
function persistGarments(){
  if(!ready)return;
  snapshotGarment();
  const data={};
  for(const [kind,state] of Object.entries(savedGarments)){
    data[kind]={...state,prints:state.prints.map(({image,...print})=>print)};
  }
  try{
    localStorage.setItem('folio.apparel.v1',JSON.stringify(data));
    return true;
  }catch{
    $('status').textContent='Browser storage is unavailable or full. Export a PNG to keep this design.';
    return false;
  }
}
function switchGarment(kind){
  if(!garmentOptions[kind])kind='hoodie';
  requestedGarment=kind;
  if(!ready)return;
  if(targets.length)snapshotGarment();
  inlineText.hidden=true;drag=null;lastFrameKey='';
  garmentType=kind;
  const state=savedGarments[kind];
  prints.splice(0,prints.length,...(state?.prints || []));
  selected=prints[state?.selected] || prints.at(-1) || null;
  $('fabric').value=state?.color || garmentOptions[kind].color;
  garment.rotation.y=0;
  buildGarment();
  if(!prints.length)add();else sync();
  $('status').textContent='Your prints are saved in this browser. Drag one directly on the garment.';
  persistGarments();
}
async function restoreGarments(){
  let cache;
  try{cache=JSON.parse(localStorage.getItem('folio.apparel.v1') || '{}')}catch{return}
  await Promise.all(Object.entries(cache).filter(([kind])=>garmentOptions[kind]).map(async([kind,state])=>{
    if(!Array.isArray(state.prints) || !/^#[0-9a-f]{6}$/i.test(state.color))return;
    const restored=await Promise.all(state.prints.slice(0,40).map(async p=>{
      if(!['body','left','right'].includes(p.zone) || !Number.isFinite(p.u) || !Number.isFinite(p.v))return null;
      const print={...p,size:THREE.MathUtils.clamp(+p.size || 14,2,32),angle:THREE.MathUtils.clamp(+p.angle || 0,-180,180),image:null};
      if(typeof p.imageData==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.imageData)){
        print.image=await new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=p.imageData});
        if(!print.image)return null;
      }
      return print;
    }));
    savedGarments[kind]={...state,prints:restored.filter(Boolean)};
  }));
}
$('garmentType').onchange=()=>switchGarment($('garmentType').value);
window.addEventListener('message',event=>{
  if(event.origin!==location.origin || event.data?.type!=='folio:garment')return;
  switchGarment(event.data.garment);
});
window.addEventListener('pagehide',persistGarments);
new ResizeObserver(resize).observe(canvas);
resize();
restoreGarments().finally(()=>{ready=true;switchGarment(requestedGarment)});
renderer.setAnimationLoop(()=>{
  if(document.hidden || window.frameElement?.closest('[hidden]'))return;
  renderer.render(scene,camera);
  if(targets.length)drawHandles();
});

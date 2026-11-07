const storeKey='folio.projects.v1', quoteKey='folio.quotes.v1';
let currentId=null;
function readStore(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4200)}
function persist(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{toast('Browser storage is full or unavailable. Download a backup instead.');return false}}
const workspaceViews=['home','library','editor','hoodie','templates','projects'];
function view(name){
  const previous=document.body.dataset.view;
  for(const id of workspaceViews) $(id).hidden=id!==name;
  for(const button of document.querySelectorAll('nav [data-view]')){
    const active=button.dataset.view===name;
    button.classList.toggle('active',active);
    if(active) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  document.body.dataset.view=name;
  document.querySelector('.projectbar').hidden=name!=='editor';
  $('saveProject').hidden=name!=='editor';
  if(name==='hoodie' && !$('hoodieEditor').hasAttribute('src')) $('hoodieEditor').src='/hoodie';
  if(name==='projects') renderProjects();
  if(name==='templates') renderTemplates();
  if(name==='editor') requestAnimationFrame(resize);
  if(previous && previous!==name) window.scrollTo(0,0);
  if(location.hash.slice(1)!==name) location.hash=name;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.querySelector('.brand').onclick=e=>{e.preventDefault();view('home')};
function imageData(im){if(!im)return null;const c=document.createElement('canvas');const scale=Math.min(1,1400/Math.max(im.width,im.height));c.width=Math.max(1,im.width*scale);c.height=Math.max(1,im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/png')}
function serialize(){return {version:1,id:currentId||crypto.randomUUID(),name:$('projectName').value.trim()||'Untitled packaging',updated:new Date().toISOString(),state:{...snap(),img:imageData(S.img)},library:LIB.map(l=>({id:l.id,data:imageData(l.img)}))}}
function saveProject(){const p=serialize(),rows=readStore(storeKey);const i=rows.findIndex(x=>x.id===p.id);if(i>=0)rows[i]=p;else rows.unshift(p);if(persist(storeKey,rows)){currentId=p.id;$('saveStatus').textContent='Saved in this browser';toast('Project saved in this browser')}return p}
$('saveProject').onclick=saveProject;
const oldCommit=commit;commit=function(){oldCommit();$('saveStatus').textContent='Changes are unsaved';renderLayers()};
$('projectName').oninput=()=>$('saveStatus').textContent='Changes are unsaved';
function loadImage(src){return new Promise((resolve,reject)=>{if(!src)return resolve(null);if(typeof src!=='string'||!src.startsWith('data:image/'))return reject(Error('Invalid image'));const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Image could not load'));im.src=src})}
function validate(p){const t=p?.state;if(p?.version!==1||!t||!Array.isArray(t.E)||!Array.isArray(p.library))throw Error('Invalid project file');for(const [k,min,max] of [['L',100,400],['W',80,300],['H',30,200]])if(!Number.isFinite(t[k])||t[k]<min||t[k]>max)throw Error('Invalid dimensions');if(!['kraft','sbs','rigid'].includes(t.mat)||!['matte','gloss','soft'].includes(t.fin)||![100,250,500,1000,2500,5000].includes(t.qty)||!/^#[a-f0-9]{6}$/i.test(t.color))throw Error('Invalid materials');if(t.E.length>100||p.library.length>50)throw Error('Project is too large');for(const e of t.E){if(!['front','back','left','right','lid','inside'].includes(e.face)||![e.x,e.y,e.sz,e.id].every(Number.isFinite)||e.sz<.1||e.sz>10)throw Error('Invalid artwork');if(e.type!=='img'&&typeof e.text!=='string')throw Error('Invalid text')};return p}
async function openProject(p){try{validate(p);const cover=await loadImage(p.state.img);const library=await Promise.all(p.library.map(async l=>({id:l.id,img:await loadImage(l.data),url:l.data})));LIB.splice(0,LIB.length,...library);lidn=Math.max(0,...LIB.map(l=>l.id))+1;Object.assign(S,p.state,{img:cover,E:p.state.E.map(e=>({...e})),sel:null});nid=Math.max(0,...S.E.map(e=>e.id))+1;currentId=p.id;$('projectName').value=p.name;hist=[];hi=-1;refresh();commit();renderLib();view('editor');$('saveStatus').textContent='Loaded from browser or backup'}catch(e){toast('Could not open project: '+e.message)}}
function row(title,sub,actions){const r=document.createElement('div');r.className='project-row';const d=document.createElement('div');d.className='details';const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=sub;d.append(strong,small);r.append(d);actions.forEach(([label,fn])=>{const b=document.createElement('button');b.className='btn';b.textContent=label;b.onclick=fn;r.append(b)});return r}
function empty(el,message){el.innerHTML='';const p=document.createElement('div');p.className='empty';p.textContent=message;el.append(p)}
function renderProjects(){const rows=readStore(storeKey);empty($('projectList'),'Your first packaging project starts here. Save a design from the studio.');if(rows.length){$('projectList').innerHTML='';rows.forEach(p=>$('projectList').append(row(p.name,`${p.state.L} × ${p.state.W} × ${p.state.H} mm · ${p.state.qty} units · ${new Date(p.updated).toLocaleDateString()}`,[['Open design',()=>openProject(p)],['Download',()=>download('folio-project.json',JSON.stringify(p,null,2),'application/json')]])))}const quotes=readStore(quoteKey);empty($('quoteList'),'No quote briefs yet. Prepare one when your design is ready.');if(quotes.length){$('quoteList').innerHTML='';quotes.forEach(q=>$('quoteList').append(row(q.projectName,'Saved locally · Not sent to a supplier',[['Download brief',()=>download('folio-quote.txt',q.text,'text/plain')]])))}}
$('backup').onclick=()=>download('folio-project.json',JSON.stringify(serialize(),null,2),'application/json');$('restore').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>20e6){toast('Choose a project smaller than 20 MB');return}try{await openProject(JSON.parse(await f.text()))}catch{toast('This is not a valid Folio project')}e.target.value=''};
$('newProject').onclick=()=>{currentId=null;S.E=[];S.img=null;[S.L,S.W,S.H]=PRESETS[0].d;$('projectName').value='Untitled packaging';refresh();commit();view('editor')};
const previews=[];
function makePreviews(){
  for(const preset of PRESETS){
    const model=FOLIO_MODELS[preset.id], origins={}, points=[], cuts=[], creases=[];
    for(const panel of model.panels){
      const [px,py]=origins[panel.parent]||[0,0];
      const x=px+panel.hinge[0], y=py+panel.hinge[1];
      origins[panel.id]=[x,y];
      points.push(...panel.outline.map(([u,v])=>[x+u,-y-v]));
      function path([[u,v],[a,b]]){return 'M'+(x+u)+' '+(-y-v)+'L'+(x+a)+' '+(-y-b);}
      cuts.push(...panel.cuts.map(path));
      if(panel.crease) creases.push(path(panel.crease));
      creases.push(...(panel.scores||[]).map(path));
    }
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const left=Math.min(...xs)-14,top=Math.min(...ys)-14;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[left,top,Math.max(...xs)-left+14,Math.max(...ys)-top+14].join(' ')+'"><g fill="none" stroke-width="2"><path stroke="#b34a64" d="'+cuts.join(' ')+'"/><path stroke="#238265" stroke-dasharray="5 2" d="'+creases.join(' ')+'"/></g></svg>';
    previews.push('data:image/svg+xml,'+encodeURIComponent(svg).replace(/"/g,'%22'));
  }
}
function renderTemplates(){if(!previews.length)makePreviews();$('templateGrid').innerHTML='';PRESETS.forEach((p,i)=>{if(!(p.board+' '+p.n).toLowerCase().includes($('searchTemplates').value.toLowerCase()))return;const b=document.createElement('button');b.className='template';b.innerHTML=`<img alt="${p.n} dieline" src="${previews[i]}"><div class="info"><span class="arrow">↗</span><strong>${p.n}</strong><small>${p.board} · ${p.d.join(' × ')} mm · Customizable</small></div>`;b.onclick=()=>{S.template=p.id;[S.L,S.W,S.H]=p.d;refresh();commit();view('editor')};$('templateGrid').append(b)});if(!$('templateGrid').children.length)empty($('templateGrid'),'No matching templates. Try “mailer”, “gift”, or “flat”.')}
$('searchTemplates').oninput=renderTemplates;
function quote(){const p=price();$('quoteSpecs').textContent=`${$('projectName').value} · ${S.L} × ${S.W} × ${S.H} mm · ${$('mat').selectedOptions[0].text} · ${$('fin').selectedOptions[0].text} · ${S.qty} units. Illustrative estimate: $${p.t.toFixed(2)} USD. Supplier pricing, shipping and taxes are unconfirmed.`;$('quoteDialog').showModal()}
$('quote').onclick=quote;$('topQuote').onclick=quote;document.querySelector('.close').onclick=()=>$('quoteDialog').close();$('quoteForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),text=['FOLIO STUDIO — QUOTE BRIEF','NOT SUBMITTED · Supplier review required','', $('quoteSpecs').textContent,'',...Object.entries(f).map(([k,v])=>k+': '+v),'','Artwork is included in the separate project backup. Dieline is for review only.'].join('\n');const q={id:crypto.randomUUID(),projectName:$('projectName').value,text};persist(quoteKey,[q,...readStore(quoteKey)]);download('folio-quote-brief.txt',text,'text/plain');$('quoteDialog').close();toast('Brief downloaded. Share it with your supplier.');};
const dims=document.createElement('div');dims.className='dimension-inputs';['L','W','H'].forEach((k,i)=>{const label=document.createElement('label');label.textContent=['Length (mm)','Width (mm)','Height (mm)'][i];const n=document.createElement('input');n.type='number';n.min=$(k).min;n.max=$(k).max;n.step='0.1';n.value=S[k];n.onchange=()=>{if(!n.checkValidity()){n.reportValidity();return}S[k]=+n.value;refresh();commit()};label.append(n);dims.append(label);$(k).addEventListener('input',()=>n.value=S[k])});document.querySelector('.pane[data-p="material"]').append(dims);
const layers=document.createElement('div');layers.innerHTML='<div class="lbl">Artwork layers</div><div id="layers"></div>';document.querySelector('.pane[data-p="artwork"]').append(layers);
function renderLayers(){if(!$('layers'))return;$('layers').innerHTML='';S.E.forEach(e=>{const r=document.createElement('div');r.className='layer-row';const b=document.createElement('button');b.textContent=e.type==='img'?'Image '+e.lib:e.text||'Empty text';b.onclick=()=>select(e.id,true);const face=document.createElement('select');face.setAttribute('aria-label','Artwork face');['front','back','left','right','lid','inside'].forEach(f=>face.add(new Option(f,f)));face.value=e.face;face.onchange=()=>{e.face=face.value;paintAll();commit()};r.append(b,face);$('layers').append(r)})}
const label=document.createElement('div');label.className='estimate-label';label.textContent='ILLUSTRATIVE ESTIMATE · USD';$('price').before(label);renderLayers();
window.addEventListener('hashchange',()=>{const n=location.hash.slice(1);view(workspaceViews.includes(n)?n:'home')});view(workspaceViews.includes(location.hash.slice(1))?location.hash.slice(1):'home');

const baseRefresh=refresh;refresh=function(){baseRefresh();document.querySelectorAll('.dimension-inputs input').forEach((n,i)=>n.value=S[['L','W','H'][i]])};
// Selected artwork inspector: same state as direct manipulation on the 3D model.
const inspector=document.createElement('section');inspector.className='element-controls';inspector.innerHTML='<h2>Selected element</h2><p id="elementHint">Select an element on the box or in the layer list.</p><div id="elementFields" hidden><label class="lbl" for="elementText">Text</label><input id="elementText" type="text" maxlength="80"><label class="lbl" for="elementSize">Size <span id="elementSizeValue"></span></label><input id="elementSize" type="range" min="10" max="500" step="1"><label class="lbl" for="elementX">Horizontal position <span id="elementXValue"></span></label><input id="elementX" type="range" min="5" max="95"><label class="lbl" for="elementY">Vertical position <span id="elementYValue"></span></label><input id="elementY" type="range" min="5" max="95"><div class="btns"><button class="btn" id="centerElement">Center</button><button class="btn" id="duplicateElement">Duplicate</button><button class="btn" id="removeElement">Remove</button></div></div>';
document.querySelector('.pane[data-p="artwork"]').append(inspector);
function syncElementControls(){const e=selEl();$('elementFields').hidden=!e;$('elementHint').textContent=e?(e.type==='img'?'Image':'Text')+' · '+e.face+' face. Drag the pink corner to resize.':'Select an element on the box or in the layer list.';if(!e)return;$('elementText').hidden=e.type==='img';document.querySelector('label[for="elementText"]').hidden=e.type==='img';if(document.activeElement!==$('elementText'))$('elementText').value=e.text||'';[['Size',e.sz],['X',e.x],['Y',e.y]].forEach(([k,v])=>{$('element'+k).value=Math.round(v*100);$('element'+k+'Value').textContent=Math.round(v*100)+'%'});$('tsz').value=e.sz;$('vsz').textContent=Math.round(e.sz*100)+'%'}
const baseSelect=select;select=function(id,all){baseSelect(id,all);if(id!==null)showP('artwork');syncElementControls()};
[['Size','sz'],['X','x'],['Y','y']].forEach(([name,key])=>{$('element'+name).oninput=ev=>{const e=selEl();if(!e)return;e[key]=+ev.target.value/100;paint(e.face);syncElementControls()};$('element'+name).onchange=commit});
$('elementText').oninput=ev=>{const e=selEl();if(!e||e.type==='img')return;e.text=ev.target.value;$('kb').value=e.text;paint(e.face)};$('elementText').onchange=commit;
$('centerElement').onclick=()=>{const e=selEl();if(e){e.x=e.y=.5;paint(e.face);commit();syncElementControls()}};
$('duplicateElement').onclick=()=>{const e=selEl();if(!e)return;const copy={...e,id:nid++,x:Math.min(.95,e.x+.08),y:Math.min(.95,e.y+.08)};S.E.push(copy);paint(copy.face);commit();select(copy.id)};
$('removeElement').onclick=()=>{$('delT').click();syncElementControls()};
$('tsz').addEventListener('input',syncElementControls);const inspectorCommit=commit;commit=function(){inspectorCommit();syncElementControls()};
// Convenient camera angles make placing artwork on hidden faces accessible.
const cameras=document.createElement('div');cameras.className='face-buttons';[['Front',0,0],['Back',0,Math.PI],['Left',0,Math.PI/2],['Right',0,-Math.PI/2],['Top',1.2,0],['Perspective',.3,-.6]].forEach(([name,x,y])=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>{auto=false;tx=x;group.rotation.set(x,y,0)};cameras.append(b)});document.querySelector('.pane[data-p="artwork"]').prepend(cameras);
syncElementControls();

// Surface editing tools beside the selected artwork.
document.querySelector('.pane[data-p="artwork"] h2').after(inspector);

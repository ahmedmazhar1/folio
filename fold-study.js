/* Inspect the same panel graph in two dimensions and as a folding assembly. */
(function(){
 const T=THREE;
 const stages=[
  {name:'Flat sheet',at:0,color:'#ead7a6',ids:['base'],note:'One continuous sheet. Blue edges are cuts; red dashed lines are the hinges.'},
  {name:'Side walls',at:27,color:'#aac8e1',ids:['left','right'],note:'Raise the two side walls from the base. The front and back stay flat at first.'},
  {name:'Corner locks',at:52,color:'#f0c79a',ids:['front','back','left-front-lock','right-front-lock','left-back-lock','right-back-lock'],note:'Fold the four corner tabs inward as the front and back walls rise. The tabs sit against the side walls.'},
  {name:'Double walls',at:71,color:'#c6d4a5',ids:['left-liner','right-liner'],note:'Turn each side liner through 180°. It returns down the inside, enclosing the corner tabs between two layers.'},
  {name:'Lid & wings',at:87,color:'#c9b8dd',ids:['lid','lid-wing-left','lid-wing-right'],note:'The lid turns on the back-wall hinge. Its two wings fold down inside the side walls.'},
  {name:'Front tuck',at:100,color:'#d8b3ae',ids:['tuck'],note:'The front closure folds down last. Keep dragging backwards to see where each flap came from.'}
 ];
 const names={base:'Base',front:'Front wall',back:'Back wall',left:'Left side wall',right:'Right side wall','left-liner':'Left return liner','right-liner':'Right return liner','left-front-lock':'Left front corner tab','right-front-lock':'Right front corner tab','left-back-lock':'Left back corner tab','right-back-lock':'Right back corner tab',lid:'Window lid','lid-wing-left':'Left lid wing','lid-wing-right':'Right lid wing',tuck:'Front closure'};
 const isReference=()=>['board-window-cake','board-self-locking-tuck'].includes(S.template);
 let chosen=null,active=-1,meshMaterials=[],grain;
 const start=document.createElement('button');start.className='fold-inspect-button';start.textContent='Inspect how this box folds ↗';modelPane.querySelector('h2').after(start);
 const study=document.createElement('section');study.className='fold-study-panel';study.hidden=true;
 study.innerHTML='<div class="fold-study-title"><strong>Follow the folds</strong><button type="button" aria-label="Exit fold inspection">×</button></div><p>Click a flap on the net to find the same piece in 3D.</p><div class="fold-study-net"></div><div class="fold-study-part" aria-live="polite">All panels stay connected at their crease lines.</div><div class="fold-study-steps"></div>';
 start.after(study);
 const net=study.querySelector('.fold-study-net'),partLabel=study.querySelector('.fold-study-part'),steps=study.querySelector('.fold-study-steps');
 const status=document.createElement('div');status.className='fold-study-status';status.hidden=true;status.setAttribute('role','status');document.querySelector('.stage').append(status);
 function stageAt(p){const index=p<.08?0:p<.31?1:p<.55?2:p<.73?3:p<.94?4:5;return index===3&&S.template!=='board-window-cake'?4:index;}
 function currentSteps(){return S.template==='board-window-cake'?stages:stages.filter(s=>s.name!=='Double walls');}
 function colorFor(id){return stages.find(s=>s.ids.includes(id))?.color||'#eee9df';}
 function highlight(){
  if(!S.foldStudy||!isReference()||!folding)return;
  const step=stages[active]||stages[0],ids=chosen?[chosen]:step.ids;
  for(const [m,mats] of meshMaterials){const id=m.userData.panelId;const color=chosen?(ids.includes(id)?colorFor(id):'#eeeadf'):(active===0?colorFor(id):(ids.includes(id)?step.color:'#eeeadf'));mats[4].color.set(color).convertSRGBToLinear();mats[5].color.set(color).convertSRGBToLinear();}
  net.querySelectorAll('[data-panel]').forEach(path=>{const id=path.dataset.panel;path.setAttribute('fill',chosen?(id===chosen?colorFor(id):'#eeeadf'):active===0?colorFor(id):step.ids.includes(id)?step.color:'#eeeadf');path.classList.toggle('picked',chosen===id);});
  steps.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.step)===active));
  status.innerHTML='<strong>'+step.name+'</strong><span>'+step.note+'</span>';
  partLabel.textContent=chosen?names[chosen]+' · highlighted on the net and in 3D':step.note;
 }
 function makeNet(){
  const model=currentModel(),origins={},all=[],paths=[];
  for(const panel of model.panels){
   const parent=origins[panel.parent]||[0,0],origin=[parent[0]+panel.hinge[0],parent[1]+panel.hinge[1]];origins[panel.id]=origin;
   const point=([x,y])=>[x+origin[0],-y-origin[1]];
   const ring=points=>'M'+points.map(point).map(p=>p.join(',')).join('L')+'Z';
   all.push(...panel.outline.map(point));
   const cuts=panel.cuts.map(seg=>'M'+seg.map(point).map(p=>p.join(',')).join('L')).join('');
   const crease=panel.crease?'M'+panel.crease.map(point).map(p=>p.join(',')).join('L'):'';
   paths.push('<g><path class="net-piece" role="button" tabindex="0" aria-label="'+names[panel.id]+'" data-panel="'+panel.id+'" fill="'+colorFor(panel.id)+'" fill-rule="evenodd" d="'+[ring(panel.outline),...(panel.holes||[]).map(ring)].join('')+'"/><path class="net-cuts" d="'+cuts+'"/><path class="net-crease" d="'+crease+'"/></g>');
  }
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),x=Math.min(...xs)-12,y=Math.min(...ys)-12;
  net.innerHTML='<svg aria-label="Interactive flat dieline" viewBox="'+[x,y,Math.max(...xs)-x+12,Math.max(...ys)-y+12].join(' ')+'">'+paths.join('')+'</svg><div class="net-key"><span>— Cut</span><span>┄ Crease</span></div>';
  net.querySelectorAll('[data-panel]').forEach(path=>{const pick=()=>{chosen=path.dataset.panel;highlight()};path.onclick=pick;path.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}};});
  steps.innerHTML='';for(const step of currentSteps()){const index=stages.indexOf(step),b=document.createElement('button');b.type='button';b.dataset.step=index;b.innerHTML='<i style="background:'+step.color+'"></i><span>'+step.name+'</span><small>'+step.at+'%</small>';b.onclick=()=>{chosen=null;setOpening(step.at)};steps.append(b);}
 }
 function setStudy(enabled){
  S.foldStudy=enabled;chosen=null;showP('models');refresh();setOpening(enabled?0:100);commit();
 }
 start.onclick=()=>setStudy(true);study.querySelector('button').onclick=()=>setStudy(false);
 // Gentle, real surface detail; no artwork is added by the inspection view.
 const noiseCanvas=document.createElement('canvas');noiseCanvas.width=noiseCanvas.height=128;const ctx=noiseCanvas.getContext('2d'),image=ctx.createImageData(128,128);let seed=73;
 for(let i=0;i<image.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=190+(seed/4294967296)*60;image.data[i]=image.data[i+1]=image.data[i+2]=n;image.data[i+3]=255;}ctx.putImageData(image,0,0);grain=new T.CanvasTexture(noiseCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;dl.castShadow=true;dl.position.set(-3,6,4);dl.shadow.mapSize.set(2048,2048);Object.assign(dl.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:25});dl.shadow.bias=-.0001;dl.shadow.normalBias=.003;dl.shadow.radius=3;
 const originalBuild=build;build=function(){
  originalBuild();meshMaterials=[];
  if(!isReference())return;
  for(const mesh of folding.meshes)for(const mat of [].concat(mesh.material)){mat.bumpMap=grain;mat.bumpScale=.001;mat.needsUpdate=true;}
  if(!S.foldStudy)return;
  folding.setGuides(true);
  for(const mesh of folding.meshes){const mats=[].concat(mesh.userData.originalMaterial).map((m,i)=>{const material=new T.MeshStandardMaterial({color:i<4?'#b9ad94':'#eeeadf',roughness:.94,bumpMap:grain,bumpScale:.001});material.color.convertSRGBToLinear();return material;});mesh.material=mats;meshMaterials.push([mesh,mats]);}
  const dispose=folding.dispose;folding.dispose=function(){for(const [,mats] of meshMaterials)for(const mat of mats)mat.dispose();dispose()};
  const setProgress=folding.setProgress;folding.setProgress=function(value){setProgress(value);const next=stageAt(1-value);if(next!==active){active=next;highlight()}};
  active=stageAt(1-(S.openAmount||0));makeNet();highlight();
 };
 const originalRefresh=refresh;refresh=function(){originalRefresh();const enabled=!!S.foldStudy&&isReference();document.querySelector('#editor').classList.toggle('fold-study-active',enabled);start.hidden=!isReference()||enabled;study.hidden=!enabled;status.hidden=!enabled;requestAnimationFrame(resize);};
 const originalOpening=setOpening;setOpening=function(value){chosen=null;originalOpening(value);if(S.foldStudy&&isReference()){const p=1-value/100,flat=Math.max(0,(p-.6)/.4);group.rotation.set(.38+flat*1.02,-.62*(1-flat),0);tx=group.rotation.x;active=stageAt(value/100);highlight();}};
 const css=document.createElement('style');css.textContent=`
 .fold-inspect-button{width:100%;text-align:left;border:1px solid #8ca77b;border-radius:12px;padding:13px;margin:0 0 15px;background:#dcedbf;color:#263b2b;font-weight:600;cursor:pointer}
 .fold-study-panel{margin-bottom:18px}.fold-study-title{display:flex;align-items:center;justify-content:space-between}.fold-study-title strong{font-size:15px}.fold-study-title button{border:0;background:none;color:inherit;font-size:24px;cursor:pointer}.fold-study-panel>p{font-size:11px;line-height:1.5;color:#b9c9ae}.fold-study-net{background:#f4f1e8;padding:10px;border-radius:10px;margin:12px 0}.fold-study-net svg{display:block;width:100%;max-height:235px}.net-piece{stroke:none;cursor:pointer;transition:fill .15s}.net-piece:hover,.net-piece.picked{stroke:#1b5639;stroke-width:3}.net-piece:focus-visible{outline:none;stroke:#1b5639;stroke-width:5}.net-cuts{fill:none;stroke:#29269c;stroke-width:1.3;pointer-events:none}.net-crease{fill:none;stroke:#df3c36;stroke-width:1.2;stroke-dasharray:4 2;pointer-events:none}.net-key{display:flex;gap:16px;font-size:9px;color:#29269c;margin:7px 0 0}.net-key span+span{color:#d23a38}.fold-study-part{font-size:11px;line-height:1.5;min-height:48px;padding-bottom:9px;color:#d6e4ca}.fold-study-steps{display:grid;gap:5px}.fold-study-steps button{display:flex;gap:9px;align-items:center;padding:10px;border:1px solid #46523e;border-radius:8px;background:transparent;color:inherit;text-align:left;font-size:11px;cursor:pointer}.fold-study-steps i{width:9px;height:9px;border-radius:50%}.fold-study-steps small{margin-left:auto;opacity:.6}.fold-study-steps button[aria-pressed=true]{background:#36472f;border-color:#bcd69e}.fold-study-active #models,.fold-study-active .recommend-button,.fold-study-active .quick-finishes,.fold-study-active #modelReferenceNote,.fold-study-active .artboard-pane{display:none}.fold-study-status{position:absolute;top:105px;left:24px;right:24px;pointer-events:none;max-width:330px}.fold-study-status strong{display:block;font-size:20px;color:#e9eddf;margin-bottom:5px}.fold-study-status span{font-size:12px;line-height:1.5;color:#c0cdb8}.fold-study-panel[hidden],.fold-inspect-button[hidden],.fold-study-status[hidden]{display:none}
 @media(min-width:901px){#editor.fold-study-active{grid-template-columns:64px 248px minmax(280px,1fr)}}
 @media(max-width:900px){.fold-study-status{top:90px;left:16px;right:16px}.fold-study-status strong{font-size:16px}.fold-study-status span{font-size:10px}.fold-study-active .stage{height:70vh;min-height:470px}.fold-study-active .panel{grid-column:2}.fold-study-net svg{max-height:310px}}
 @media(min-width:600px) and (max-width:900px){#editor.fold-study-active{grid-template-columns:48px 190px minmax(280px,1fr);height:calc(100dvh - 200px);min-height:470px}.fold-study-active .rail,.fold-study-active .panel,.fold-study-active .stage{grid-row:1}.fold-study-active .stage{grid-column:3;height:100%;min-height:470px}.fold-study-active .panel{overflow-y:auto;padding:12px}.fold-study-active .rail{padding:6px 2px}.fold-study-active .rail button{font-size:8px}.fold-study-active .fold-study-net svg{max-height:170px}.fold-study-active .fold-study-steps button{padding:7px;font-size:10px}.fold-study-active .scene-tools{bottom:24px!important;left:7px;right:7px;gap:4px;padding:7px}.fold-study-active .scene-tools .btn{font-size:9px;padding:7px}.fold-study-active #resetView,.fold-study-active #exportMockup{display:none}.fold-study-active .opening-control{gap:3px}.fold-study-active .opening-control input{width:65px}.fold-study-active .opening-control button{font-size:9px}.fold-study-active .opening-control output{display:none}.fold-study-active .view-presets{left:16px;top:44px}.fold-study-active .view-presets button{font-size:9px;padding:5px 8px}}
 `;document.head.append(css);
 if(new URLSearchParams(location.search).get('study')==='1'&&isReference()){setStudy(true);const at=Number(new URLSearchParams(location.search).get('fold'));if(Number.isFinite(at)&&at>0&&at<=100)setOpening(at);}else refresh();
})();

/* Same deterministic panel graph as packaging.py; portable Worker runtime. */
const PI=Math.PI,turn=PI/2;
function outline(p){
 if(p.outline_points)return p.outline_points;
 const w=p.width,h=p.height,[cx,cy]=p.center;
 const shapes={dust:[[-.5,0],[.5,0],[.38,.18],[.25,1],[-.38,.92]],lock:[[-.5,0],[.5,0],[.5,.68],[.23,.68],[.17,1],[-.23,1],[-.25,.78]],tuck:[[-.5,0],[.5,0],[.5,.66],[.485,.84],[.455,.96],[.42,1],[-.42,1],[-.455,.96],[-.485,.84],[-.5,.66]],tab:[[-.5,0],[.5,0],[.43,.82],[.32,1],[-.32,1],[-.43,.82]]};
 const points=shapes[p.shape];if(!points)return [[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]];
 return points.map(([a,b])=>p.axis==='x'?[cx+a*w,(cy<0?-h:h)*b]:[(cx<0?-w:w)*b,cy+a*h]);
}
function linework(panels){
 const creases=Object.fromEntries(panels.map(p=>[p.id,[]]));
 for(const p of panels){if(p.parent===null)continue;const [cx,cy]=p.center;
  const [a,b]=p.axis==='x'?[[cx-p.width/2,0],[cx+p.width/2,0]]:[[0,cy-p.height/2],[0,cy+p.height/2]];
  p.crease=[a,b];creases[p.id].push([a,b]);creases[p.parent].push([a,b].map(([x,y])=>[x+p.hinge[0],y+p.hinge[1]]));
 }
 for(const p of panels){const polygon=p.outline=outline(p);p.cuts=[];
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;if(length<1e-16)continue;const spans=[];
   for(const [c,e]of creases[p.id]){if([c,e].some(q=>Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))>1e-6))continue;const vals=[c,e].map(q=>((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length).sort((x,y)=>x-y);spans.push([Math.max(0,vals[0]),Math.min(1,vals[1])]);}
   let cursor=0;const point=t=>[a[0]+t*dx,a[1]+t*dy];for(const [start,end]of spans.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){if(end<=cursor||start>=1)continue;if(start>cursor)p.cuts.push([point(cursor),point(start)]);cursor=Math.max(cursor,end);}if(cursor<1)p.cuts.push([point(cursor),b]);
  }
  for(const hole of p.holes||[])for(let i=0;i<hole.length;i++)p.cuts.push([hole[i],hole[(i+1)%hole.length]]);p.cuts.push(...(p.slits||[]));
 }
}
function roundedRectangle(x0,y0,x1,y1,r,steps=7){r=Math.min(r,(x1-x0)/2,(y1-y0)/2);const points=[];for(const[cx,cy,start]of [[x1-r,y1-r,0],[x0+r,y1-r,PI/2],[x0+r,y0+r,PI],[x1-r,y0+r,3*PI/2]])for(let i=0;i<=steps;i++){const angle=start+PI/2*i/steps;points.push([cx+r*Math.cos(angle),cy+r*Math.sin(angle)]);}return points;}
function referenceBox(kind,d){
 const {L:l,W:w,H:h}=d,window=kind==='board-window-cake',thickness=(window?.0197:.013)*25.4,panels=[];
 const add=(id,parent,width,height,hinge,center,axis,angle,phase,face=null,points=null,extra={})=>{const p={id,parent,width,height,hinge:[...hinge,0],center:[...center,0],axis,closed_angle:angle,phase,face,shape:'rect',...extra};if(points)p.outline_points=points;panels.push(p);return p;};
 add('base',null,l,w,[0,0],[0,0],'x',0,[0,1],'inside');
 let r=Math.min(l*.065,h*.14),front=[[-l/2,0],[l/2,0],[l/2,-h],[r,-h]];
 if(window){for(let i=1;i<=12;i++){const t=PI*i/12;front.push([r*Math.cos(t),-h+r*Math.sin(t)]);}}
 else{r=Math.min(l*.10,h*.34);front=[[-l/2,0],[l/2,0],[l/2,-h],[r,-h],[r,-h+r]];for(let i=1;i<=16;i++){const t=PI*i/16;front.push([r*Math.cos(t),-h+r-r*Math.sin(t)]);}front.push([-r,-h]);}front.push([-l/2,-h]);
 add('front','base',l,h,[0,-w/2],[0,-h/2],'x',-turn,[.47,.70],window?null:'front',front);
 add('back','base',l,h,[0,w/2],[0,h/2],'x',turn,[.47,.70],'back');
 for(const[side,sign]of [['left',-1],['right',1]]){
  const wall=add(side,'base',h,w,[sign*l/2,0],[sign*h/2,0],'y',-sign*turn,[.72,.97],side);
  if(!window){const x=sign*h*.48,slot=Math.max(thickness*1.6,.5);wall.holes=[roundedRectangle(x-slot/2,-w*.27,x+slot/2,w*.27,slot/2,3)];}
  if(window){const liner=add(side+'-liner',side,h,w,[sign*h,0],[sign*h/2,0],'y',-sign*PI,[.30,.45],null,null,{fold_offset:[0,0,thickness*2.2]});const edge=sign*h,n=thickness*1.5;liner.outline_points=[[0,-w/2],[edge,-w/2],[edge,-w*.30],[edge+sign*n,-w*.30],[edge+sign*n,-w*.10],[edge,-w*.10],[edge,w*.10],[edge+sign*n,w*.10],[edge+sign*n,w*.30],[edge,w*.30],[edge,w/2],[0,w/2]];}
 }
 for(const[end,edge]of [['front',-1],['back',1]])for(const[side,sign]of [['left',-1],['right',1]]){
  const shape=window?[[0,0],[1.36,0],[1.44,.025],[1.49,.08],[1.50,.14],[1.50,.78],[1.48,.87],[1.43,.95],[1.35,1],[1.27,.97],[1.19,.90],[1.15,.81],[1.15,.48],[.82,1],[0,1]]:[[0,0],[.20,0],[.52,.50],[.90,.30],[.96,.31],[1,.37],[1,1],[0,1]],width=window?h*1.5:h;
  add(side+'-'+end+'-lock',end,width,h,[sign*l/2,0],[sign*width/2,edge*h/2],'y',-sign*turn,[.69,.90],null,shape.map(([x,y])=>[sign*h*x,edge*h*y]),{fold_offset:[-sign*thickness*(end==='front'?.65:1.35),0,0]});
 }
 const lid=add('lid','back',l,w,[0,h],[0,w/2],'x',turn,[.06,.27],'lid');if(window){lid.holes=[roundedRectangle(-l*.405,w*.14,l*.405,w*.90,Math.min(l,w)*.075)];lid.window_film=true;}
 const depth=window?h:h*.72;
 for(const[side,sign]of [['left',-1],['right',1]])add('lid-wing-'+side,'lid',depth,w,[sign*l/2,w/2],[sign*depth/2,0],'y',-sign*turn,[.16,.36],null,[[0,-.5],[.84,-.35],[.96,-.31],[1,-.26],[1,.26],[.96,.31],[.84,.35],[0,.5]].map(([x,y])=>[sign*depth*x,w*y]),{fold_offset:[-sign*thickness*3.6,0,0]});
 const th=window?h:h*.34,cap=window?[[-l/2,0],[l/2,0],[l*.40,th*.81],[l*.38,th*.90],[l*.34,th*.97],[l*.29,th],[-l*.29,th],[-l*.34,th*.97],[-l*.38,th*.90],[-l*.40,th*.81]]:[[-l/2,0],[l/2,0],[l*.49,th*.64],[l*.48,th*.84],[l*.45,th*.97],[l*.42,th],[-l*.42,th],[-l*.45,th*.97],[-l*.48,th*.84],[-l*.49,th*.64]];
 const tuck=add('tuck','lid',l,th,[0,w],[0,th/2],'x',turn,[0,.12],window?'front':null,cap,{fold_offset:[0,thickness*1.5,0]});if(window)tuck.uv_rotation=180;
 const sw=Math.min(l*.13,h*.3);tuck.slits=window?[[[-sw/2,th*.25],[-sw/2,th*.12]],[[-sw/2,th*.12],[sw/2,th*.12]],[[sw/2,th*.12],[sw/2,th*.25]]]:[[[-sw/2,th*.5],[sw/2,th*.5]]];linework(panels);
 return{schema_version:'1.2',template_id:kind,units:'mm',dimensions:d,panels,upright:false,thickness_mm:thickness,production_ready:false,reference_kind:'user-supplied screenshot',reference_dimensions_in:window?{L:8.5,W:8.5,H:4}:{L:10,W:6,H:3},material_label:window?'350 gsm white paperboard':'250 gsm kraft paperboard',detail_dimensions_estimated:true,line_colors:{cut:'#2523bc',crease:'#ef4144'},notice:'Reconstructed from the supplied screenshot. Overall dimensions are supplied; tab profiles, slots, window size and folding clearances are estimated. Validate against the original vector dieline and a physical sample.'};
}
export function manifest(kind,d){
 if(['board-window-cake','board-self-locking-tuck'].includes(kind))return referenceBox(kind,d);
 const {L:l,W:w,H:h}=d,panels=[],family=kind.replace(/^board-/,'').replace(/^corr-/,''),tube=['tuck-carton','tuck-end','auto-bottom','flap-box','paper-bag'].includes(family);
 const panel=(id,parent,width,height,hinge,center,axis,angle,phase,face=null,shape='rect')=>panels.push({id,parent,width,height,hinge:[...hinge,0],center:[...center,0],axis,closed_angle:angle,phase,face,shape});
 if(tube){
  panel('front',null,l,h,[0,0],[0,0],'y',0,[0,1],'front');panel('right','front',w,h,[l/2,0],[w/2,0],'y',-turn,[.56,1],'right');panel('back','right',l,h,[w,0],[l/2,0],'y',-turn,[.56,1],'back');panel('left','back',w,h,[l,0],[w/2,0],'y',-turn,[.56,1],'left');const glue=Math.min(18,w*.2);panel('glue','front',glue,h,[-l/2,0],[-glue/2,0],'y',turn,[.54,.94],null,'tab');
  const widths={front:[l,0],right:[w,w/2],back:[l,l/2],left:[w,w/2]};
  if(family==='flap-box'){for(const[name,[width,x]]of Object.entries(widths))for(const[sign,end]of [[1,'top'],[-1,'bottom']]){const depth=w/2;panel(end+'-'+name,name,width,depth,[x,sign*h/2],[0,sign*depth/2],'x',sign*turn,['left','right'].includes(name)?[.1,.48]:[0,.30],end==='top'&&name==='front'?'lid':end==='bottom'&&name==='front'?'inside':null);}}
  else{let tuck;
   if(family!=='paper-bag'){panel('lid','front',l,w,[0,h/2],[0,w/2],'x',turn,[.05,.32],'lid');tuck=Math.min(w*.28,h*.2);panel('tuck','lid',l*.96,tuck,[0,w],[0,tuck/2],'x',turn,[0,.16],null,'tuck');for(const side of ['left','right'])panel('dust-'+side,side,w,l*.42,[w/2,h/2],[0,l*.21],'x',turn,[.30,.52],null,'dust');}
   if(['tuck-end','tuck-carton'].includes(family)){panel('base-flap','back',l,w,[l/2,-h/2],[0,-w/2],'x',-turn,[.16,.42],'inside');panel('base-tuck','base-flap',l*.96,tuck,[0,-w],[0,-tuck/2],'x',-turn,[.04,.20],null,'tuck');for(const side of ['left','right'])panel('foot-'+side,side,w,l*.42,[w/2,-h/2],[0,-l*.21],'x',-turn,[.38,.55],null,'dust');}
   else{for(const[name,[width,x]]of Object.entries(widths)){const depth=['front','back'].includes(name)?w*.56:l*.43;panel('bottom-'+name,name,width,depth,[x,-h/2],[0,-depth/2],'x',-turn,['front','back'].includes(name)?[.17,.42]:[.38,.55],name==='front'?'inside':null,family==='paper-bag'?'tab':'lock');}if(family==='paper-bag')for(const side of ['left','right'])panels.find(p=>p.id===side).scores=[[[w/2,-h/2],[w/2,h/2]],[[0,-h/2],[w/2,-h/2+Math.min(h/3,w/2)]],[[w,-h/2],[w/2,-h/2+Math.min(h/3,w/2)]]];}
  }
 }else{
  panel('base',null,l,w,[0,0],[0,0],'x',0,[0,1],'inside');panel('front','base',l,h,[0,-w/2],[0,-h/2],'x',-turn,[.55,.9],'front');panel('back','base',l,h,[0,w/2],[0,h/2],'x',turn,[.65,1],'back');panel('left','base',h,w,[-l/2,0],[-h/2,0],'y',turn,[.45,.85],'left');panel('right','base',h,w,[l/2,0],[h/2,0],'y',-turn,[.45,.85],'right');let tab;
  if(!['simple-tray','frame-tray'].includes(family)){panel('lid','back',l,w,[0,h],[0,w/2],'x',turn,[.05,.45],'lid');tab=Math.min(h*.65,w*.22);panel('tuck','lid',l*.94,tab,[0,w],[0,tab/2],'x',turn,[0,.18],null,'tuck');for(const[side,sign]of [['left',-1],['right',1]])panel('ear-'+side,'lid',tab,w*.78,[sign*l/2,w*.5],[sign*tab/2,0],'y',-sign*turn,[0,.25],null,'tab');}
  if(['roll-end','roll-end-wing','frame-tray','simple-tray'].includes(family)){
   for(const[side,sign]of [['left',-1],['right',1]]){for(const[end,edge]of [['front',-1],['back',1]]){const depth=Math.min(h*.75,w*.36);panel(side+'-'+end,side,h,depth,[sign*h/2,edge*w/2],[0,edge*depth/2],'x',edge*turn,[.54,.84],null,'tab');}if(family!=='simple-tray'){const rim=family!=='frame-tray'?Math.min(8,h*.18):Math.min(18,l*.09);panel(side+'-rim',side,rim,w,[sign*h,0],[sign*rim/2,0],'y',-sign*turn,[.35,.65]);panel(side+'-liner',side+'-rim',h,w,[sign*rim,0],[sign*h/2,0],'y',-sign*turn,[.22,.55]);}}
   if(family==='roll-end-wing')for(const[side,sign]of [['left',-1],['right',1]])panel('wing-'+side,'tuck',tab*.65,tab,[sign*l*.47,tab/2],[sign*tab*.325,0],'y',-sign*turn,[.01,.18],null,'tab');
   if(family==='frame-tray'){const rim=Math.min(18,w*.09);for(const[name,sign]of [['front',-1],['back',1]]){panel(name+'-rim',name,l,rim,[0,sign*h],[0,sign*rim/2],'x',sign*turn,[.35,.65]);panel(name+'-liner',name+'-rim',l,h,[0,sign*rim],[0,sign*h/2],'x',sign*turn,[.22,.55]);}}
  }
 }
 linework(panels);return{schema_version:'1.1',template_id:kind,units:'mm',dimensions:d,panels,upright:tube,thickness_mm:kind.startsWith('board-')||kind==='tuck-carton'?.5:1.4,production_ready:false,notice:'Visual assembly study. A packaging engineer must verify locking details and manufacturing allowances.'};
}
export function pose(model,progress){return{progress,panels:model.panels.map(p=>{const[a,b]=p.phase,t=Math.max(0,Math.min(1,(progress-a)/(b-a)));return{id:p.id,axis:p.axis,angle:p.closed_angle*(1-t*t*(3-2*t)),position:p.hinge.map((v,i)=>v+(p.fold_offset||[0,0,0])[i]*(1-progress))};})};}
export function recommendProduct(text,dimensions=null){
 const words=new Set(text.toLowerCase().match(/[a-z]+/g)||[]),has=list=>list.some(x=>words.has(x)),fragile=has(['glass','ceramic','fragile','bottle','bottles','mug','candle','candles']),cosmetic=has(['cosmetic','cosmetics','serum','cream','perfume','soap','skincare']),apparel=has(['shirt','shirts','clothing','apparel','hoodie','scarf','socks','jewelry']),food=has(['food','cake','cookies','chocolate','tea','coffee','bakery']);
 const template_id=cosmetic?'tuck-carton':fragile?'deep-gift':apparel?'slim-flat':'mailer',reason=cosmetic?'A folding carton suits a small retail product. Use an outer shipping box for delivery.':fragile?'A deeper box leaves room for a protective insert. Fragile products need cushioning and transit testing.':apparel?'A shallow mailer suits lightweight, folded products without excess empty space.':'A hinged mailer is a useful starting point for packing and opening a small shipped product.';
 let questions=['What are the packed product dimensions, including any insert?','What is the packed weight and will this be shipped or sold in store?'];const cautions=['This is a starting recommendation, not a fit or protection guarantee.'];if(food)cautions.push('Confirm food-contact suitability and any liner or barrier with the packaging supplier.');if(fragile)cautions.push('Specify a protective insert before choosing final internal dimensions.');if(dimensions)questions=questions.slice(1);return{template_id,reason,target_internal_mm:dimensions?Object.fromEntries(Object.entries(dimensions).map(([k,v])=>[k,Math.round((v+4)*100)/100])):null,questions,cautions,engine:'local-rules-v1',ai_generated:false,description:text};
}
export function dieline(model){
 const origins={},paths={cut:[],crease:[]},points=[];for(const p of model.panels){const parent=origins[p.parent]||[0,0],x=parent[0]+p.hinge[0],y=parent[1]+p.hinge[1];origins[p.id]=[x,y];points.push(...p.outline.map(([a,b])=>[x+a,-y-b]));for(const[kind,segments]of [['cut',p.cuts],['crease',[...(p.crease?[p.crease]:[]),...(p.scores||[])] ]])for(const[[a,b],[e,f]]of segments)paths[kind].push(`M${x+a},${-y-b} L${x+e},${-y-f}`);}
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs)-8,top=Math.min(...ys)-8,width=Math.max(...xs)-left+8,height=Math.max(...ys)-top+8;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="${left} ${top} ${width} ${height}"><title>EcoPak review dieline</title><desc>Nominal dimensions; supplier validation required.</desc><path d="${paths.cut.join(' ')}" fill="none" stroke="${model.line_colors?.cut||'#cc4158'}" stroke-width=".35"/><path d="${paths.crease.join(' ')}" fill="none" stroke="${model.line_colors?.crease||'#178258'}" stroke-width=".35" stroke-dasharray="2 1"/></svg>`;
}

/* Local, parametric product geometry. Coordinates are millimetres; root scale is .01. */
(function(root){
 'use strict';
 function create(T,spec={},options={}){
  const d=spec.previewDimensionsMm||spec.dimensionsMm||{},f=spec.features||{},name=String(spec.name||'').toLowerCase();
  const positive=(...values)=>{for(const v of values){const n=Number(v);if(Number.isFinite(n)&&n>0)return Math.min(3000,n);}return 1;};
  const L=positive(d.L,d.length,d.width,180),W=positive(d.W,d.width,d.depth,130),H=positive(d.H,d.height,55);
  const diameter=positive(d.diameter,d.topDiameter,d.topDiameterMm,d.D,Math.min(L,W));
  const group=new T.Group(),artworkMeshes=[],ownedTextures=new Set(),materials=new Set(),type=spec.geometryType||'folding-box';let opener,artworkAspectRatio=1;
  group.scale.setScalar(.01);group.userData={geometryType:type,units:'mm',previewDimensionsMm:{...d},sourceDimensionsMm:spec.dimensionsMm||null};
  const tint=value=>new T.Color(value).convertSRGBToLinear();
  const grainData=new Uint8Array(64*64*4);let seed=971;
  for(let i=0;i<grainData.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=190+(seed/4294967296)*60;grainData[i]=grainData[i+1]=grainData[i+2]=v;grainData[i+3]=255;}
  const grain=new T.DataTexture(grainData,64,64,T.RGBAFormat);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(4,4);grain.needsUpdate=true;ownedTextures.add(grain);
  const kraft=/kraft|brown|wood|bamboo|palm/.test(name),baseColor=options.color||(kraft?'#b88d60':'#f2efe6');
  function material(color=baseColor,extra={}){const m=new T.MeshStandardMaterial({color:tint(color),roughness:.86,bumpMap:grain,bumpScale:.12,envMapIntensity:.25,...extra});materials.add(m);return m;}
  const paper=material(),inside=material(kraft?'#c6a779':'#f7f3e9'),edge=material(kraft?'#aa8157':'#d9d2c4');
  const clear=()=>{const m=new T.MeshPhysicalMaterial({color:tint('#eaf1ef'),roughness:.13,metalness:.02,transparent:true,opacity:.21,side:T.DoubleSide,depthWrite:false,clearcoat:.7,clearcoatRoughness:.08,envMapIntensity:.75});materials.add(m);return m;};
  function mesh(geometry,mat=paper,parent=group){const m=new T.Mesh(geometry,mat);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  function box(w,h,z,x=0,y=h/2,depth=0,mat=paper,parent=group){const m=mesh(new T.BoxGeometry(Math.max(.08,w),Math.max(.08,h),Math.max(.08,z)),mat,parent);m.position.set(x,y,depth);return m;}
  function printedMaterial(){return options.artworkTexture?material('#ffffff',{map:options.artworkTexture,bumpScale:.05}):paper;}
  function addArtwork(m,aspect=1){if(options.artworkTexture){m.userData.artworkAspectRatio=positive(aspect);if(!artworkMeshes.length)artworkAspectRatio=m.userData.artworkAspectRatio;artworkMeshes.push(m);}return m;}
  function planeUV(geometry,w,h,xOffset=0,yOffset=0){const p=geometry.attributes.position,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-xOffset)/w+.5,(p.getY(i)-yOffset)/h);uv.needsUpdate=true;return geometry;}
  function printedShape(shape,w,h){return planeUV(new T.ShapeGeometry(shape),w,h,0,-h/2);}
  function handleArtwork(length,width,t,parent=group,z=0){
   if(!options.artworkTexture)return;
   const art=mesh(new T.PlaneGeometry(length,width),printedMaterial(),parent);art.rotation.set(-Math.PI/2,0,Math.PI/2);art.position.set(0,t+.04,z);addArtwork(art,length/width);
  }
  function roundedPoints(w,z,r,steps=7){r=Math.max(.1,Math.min(r,w/2-.01,z/2-.01));const points=[];for(const [x,y,start] of [[w/2-r,z/2-r,0],[-w/2+r,z/2-r,Math.PI/2],[-w/2+r,-z/2+r,Math.PI],[w/2-r,-z/2+r,3*Math.PI/2]])for(let i=0;i<=steps;i++){const a=start+i*Math.PI/(2*steps);points.push(new T.Vector2(x+r*Math.cos(a),y+r*Math.sin(a)));}return points;}
  function shapeOf(points){const s=new T.Shape();s.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))s.lineTo(p.x,p.y);s.closePath();return s;}
  function flatShape(points,t,mat=paper,parent=group){const m=mesh(new T.ExtrudeGeometry(shapeOf(points),{depth:t,bevelEnabled:false,steps:1}),mat,parent);m.rotation.x=-Math.PI/2;return m;}
  function line(points,mat,parent=group,closed=false,radius=1){const curve=new T.CatmullRomCurve3(points,closed,'centripetal');return mesh(new T.TubeGeometry(curve,Math.max(16,points.length*3),radius,6,closed),mat,parent);}
  function rim(points,y,radius,mat,parent){return line(points.map(p=>new T.Vector3(p.x,y,-p.y)),mat,parent,true,radius);}
  function roundVessel(rb,rt,h,t,mat=paper,parent=group){
   rb=Math.max(2,rb);rt=Math.max(t*3,rt);t=Math.min(t,rb/5,rt/5,h/5);
   const points=[[0,0],[rb-t*.5,0],[rb,t],[rt,h-t],[rt-t*.25,h],[rt-t,h],[rt-t*1.5,h-t],[rb-t,t*1.8],[0,t*1.8]].map(p=>new T.Vector2(...p));
   const body=mesh(new T.LatheGeometry(points,72),mat,parent);
   const lip=mesh(new T.TorusGeometry(rt-t*.55,t*.65,8,72),mat,parent);lip.rotation.x=Math.PI/2;lip.position.y=h-t*.2;
   if(options.artworkTexture){const print=mesh(new T.CylinderGeometry(rt+.04,rb+.04,h-t*2,72,1,true,Math.PI,Math.PI*2),printedMaterial(),parent);print.position.y=h/2;addArtwork(print,Math.PI*(rt+rb)/(h-t*2));}
   return body;
  }
  function roundLid(radius,y,transparent,parent=group){
   const lid=new T.Group();lid.position.y=y;parent.add(lid);const t=transparent?.5:.85,height=transparent?Math.max(5,radius*.09):3.5;
   const profile=[[radius+1,0],[radius+1,2],[radius-1.5,3],[radius-2,height],[0,height],[0,height-t],[radius-3,height-t],[radius-2,1],[radius-1,0]].map(p=>new T.Vector2(...p));
   mesh(new T.LatheGeometry(profile,72),transparent?clear():paper,lid);
   return lid;
  }
  function rectangularTray(w,z,h,t=1.1,mat=paper,parent=group,flare=.06,branding=true){
   const r=Math.min(w,z)*.12,top=roundedPoints(w,z,r),bottom=roundedPoints(w*(1-flare),z*(1-flare),r*.82),vertices=[];
   function triangle(a,b,c){vertices.push(...a,...b,...c);}
   function quad(a,b,c,e){triangle(a,b,c);triangle(a,c,e);}
   for(let i=0;i<top.length;i++){
    const j=(i+1)%top.length,a=top[i],b=top[j],c=bottom[i],e=bottom[j];
    const inner=p=>[p.x*(1-t*2/w),p.y*(1-t*2/z)];const ai=inner(a),bi=inner(b),ci=inner(c),ei=inner(e);
    quad([c.x,0,-c.y],[e.x,0,-e.y],[b.x,h,-b.y],[a.x,h,-a.y]);
    quad([ai[0],h,-ai[1]],[bi[0],h,-bi[1]],[ei[0],t,-ei[1]],[ci[0],t,-ci[1]]);
    quad([a.x,h,-a.y],[b.x,h,-b.y],[bi[0],h,-bi[1]],[ai[0],h,-ai[1]]);
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===0?[v/w+.5,vertices[i+1]/h]:[]),2));geometry.computeVertexNormals();
   mesh(geometry,mat,parent);const floor=flatShape(bottom,t,inside,parent);floor.position.y=.02;
   rim(top,h,Math.max(.45,t*.55),mat,parent);
   if(options.artworkTexture&&branding){const art=mesh(new T.PlaneGeometry(w*.8,h*.8),printedMaterial(),parent);art.position.set(0,h/2,z/2+.1);addArtwork(art,w/h);}
   return {top,bottom};
  }
  function trayLid(w,z,y,transparent,parent=group){const g=new T.Group();g.position.y=y;parent.add(g);const mat=transparent?clear():paper;flatShape(roundedPoints(w+2,z+2,Math.min(w,z)*.13),transparent?.6:1,mat,g);rim(roundedPoints(w+3,z+3,Math.min(w,z)*.13),0,.7,mat,g);return g;}
  function articulatedLid(lid,closedY,raise=H){opener=value=>{lid.position.y=closedY+Math.max(0,Math.min(1,Number(value)||0))*raise;};}
  function paperBag(){
   const t=.55,gusset=Math.min(W*.27,L*.12),outline=[[-L/2,-W/2],[L/2,-W/2],[L/2-gusset,0],[L/2,W/2],[-L/2,W/2],[-L/2+gusset,0]];
   flatShape(outline.map(p=>new T.Vector2(p[0],-p[1])),t,inside);
   for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length],isFront=i===3,isBack=i===0;
    if(isFront||isBack){
     const shape=shapeOf([new T.Vector2(-L/2,0),new T.Vector2(L/2,0),new T.Vector2(L/2,H),new T.Vector2(-L/2,H)]);
     if(isFront&&f.window){shape.holes.push(shapeOf(roundedPoints(L*.55,H*.46,Math.min(L,H)*.04).map(p=>new T.Vector2(p.x,p.y+H*.49))));const film=mesh(new T.PlaneGeometry(L*.55,H*.46),clear());film.position.set(0,H*.49,W/2-.1);}
     const geometry=planeUV(new T.ShapeGeometry(shape),L,H),front=mesh(geometry,isFront?printedMaterial():paper);front.material.side=T.DoubleSide;front.position.z=isFront?W/2:-W/2;if(!isFront)front.rotation.y=Math.PI;if(isFront)addArtwork(front,L/H);
     box(L,Math.max(3,H*.025),t,0,H-1.5,isFront?W/2:-W/2,edge);
    }else{
     const width=Math.hypot(b[0]-a[0],b[1]-a[1]);const side=box(width,H,t,(a[0]+b[0])/2,H/2,(a[1]+b[1])/2,paper);side.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    }
   }
   if(f.handles!==false){
    const rope=material(kraft?'#80694e':'#c9c4b8'),spread=L*.27,rise=Math.min(H*.23,L*.30),tube=Math.max(.9,Math.min(2,L*.007));
    for(const z of [-W/2,W/2])line([new T.Vector3(-spread,H-8,z),new T.Vector3(-spread,H+rise*.58,z),new T.Vector3(0,H+rise,z),new T.Vector3(spread,H+rise*.58,z),new T.Vector3(spread,H-8,z)],rope,group,false,tube);
   }
  }
  function vessel(kind){
   const top=positive(d.topDiameter,d.topDiameterMm,d.diameter,d.D,diameter),bottom=positive(d.bottomDiameter,d.bottomDiameterMm,top*(kind==='cup'?.70:.78));
   const h=positive(d.H,d.height,kind==='cup'?105:65),transparent=/\bpet\b|clear plastic|transparent/.test(name)&&!/paper/.test(name);
   roundVessel(bottom/2,top/2,h,transparent?.65:.85,transparent?clear():paper);
   if(f.lid){const lid=roundLid(top/2,h,/\bpet\b|plastic|clear|transparent/.test(String(f.lid)+' '+name));articulatedLid(lid,h,h*.7);}
  }
  function clamshell(){
   const bottomH=H*.58,lidH=H-bottomH,t=Math.max(.9,Math.min(2,H*.025)),mat=material(baseColor);
   rectangularTray(L,W,bottomH,t,mat,group,.06,false);
   const hinge=new T.Group();hinge.position.set(0,bottomH,-W/2);group.add(hinge);
   const hood=new T.Group();hood.position.set(0,lidH,W/2);hood.rotation.z=Math.PI;hinge.add(hood);rectangularTray(L,W,lidH,t,mat,hood,.035,false);
   if(options.artworkTexture){const art=mesh(printedShape(shapeOf(roundedPoints(L*(1-.035),W*(1-.035),Math.min(L,W)*.10)),L,W),printedMaterial(),hood);art.rotation.x=Math.PI/2;art.position.y=-.04;addArtwork(art,L/W);}
   box(L*.50,t*1.5,5,0,bottomH,-W/2,mat);
   box(L*.17,2.4,7,0,bottomH,W/2+1,mat);
   box(L*.13,2.4,7,0,lidH-.5,W/2+1,mat,hood);
   opener=value=>{hinge.rotation.x=-Math.max(0,Math.min(1,Number(value)||0))*Math.PI*.62;};
  }
  function foilTray(){
   const mat=material('#c1c5c7',{metalness:.83,roughness:.36,bumpScale:.14}),tray=rectangularTray(L,W,H,.55,mat,group,.10);
   const points=[];for(let i=0;i<tray.top.length;i++){const p=tray.top[i],q=tray.bottom[i];points.push(q.x,2,-q.y,p.x,H-1,-p.y);}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));const lineMat=new T.LineBasicMaterial({color:tint('#777f82'),transparent:true,opacity:.22});materials.add(lineMat);group.add(new T.LineSegments(geo,lineMat));
   if(f.lid){const lid=trayLid(L,W,H,/clear|pet|plastic/.test(String(f.lid)+' '+name));articulatedLid(lid,H,H*.8);}
  }
  function carrier(){
   const t=2.5,w=L,z=W,h=Math.min(H,65),shape=shapeOf(roundedPoints(w,z,Math.min(w,z)*.10));
   const slots=[1,2,4].includes(Number(f.carrierSlots))?Number(f.carrierSlots):(w/z>1.35?2:4);
   const positions=slots===1?[[0,0]]:slots===2?[[-w*.25,0],[w*.25,0]]:[[-w*.25,-z*.25],[w*.25,-z*.25],[-w*.25,z*.25],[w*.25,z*.25]];
   const r=Math.min(positive(d.holeDiameter,Math.min(w*.38,z*.50))/2,w*(slots===1?.46:.23),z*(slots===4?.23:.46));
   group.userData.carrierSlots=slots;
   for(const [x,y] of positions){const hole=new T.Path();hole.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(hole);}
   const top=mesh(new T.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false}),paper);top.rotation.x=-Math.PI/2;top.position.y=h;
   // Keep the default print on the uncut front wall: a centred graphic on
   // the perforated deck would disappear into a single carrier's cup hole.
   rectangularTray(w*.98,z*.98,h,t,paper,group,.04,true);
   for(const [x,z] of positions){const lip=mesh(new T.TorusGeometry(r,.8,6,40),edge);lip.rotation.x=Math.PI/2;lip.position.set(x,h+t,-z);}
  }
  function flatItem(sticker=false){
   const t=Math.max(.15,Math.min(2,positive(d.thickness,d.H,sticker?.5:.2)));
   const round=!!f.round||/round|circle|circular|\bdisc\b/.test(name)||(Number(d.diameter)>0&&!/square|rectang|sheet/.test(name))||(sticker&&!/sheet|roll|rectangle|square/.test(name));
   if(sticker&&/roll/.test(name)){
    const radius=positive(d.diameter,70)/2,width=positive(d.width,d.W,35),core=radius*.35;
    const profile=[[core,-width/2],[radius,-width/2],[radius,width/2],[core,width/2],[core,-width/2]].map(p=>new T.Vector2(...p));const roll=mesh(new T.LatheGeometry(profile,72),printedMaterial());roll.rotation.z=Math.PI/2;roll.position.y=radius;addArtwork(roll,Math.PI*2*radius/width);return;
   }
   const points=round?Array.from({length:64},(_,i)=>new T.Vector2(Math.cos(i/64*Math.PI*2)*diameter/2,Math.sin(i/64*Math.PI*2)*diameter/2)):roundedPoints(L,W,sticker?Math.min(L,W)*.045:1);
   flatShape(points,t,paper);
   const surface=mesh(printedShape(shapeOf(points),round?diameter:L,round?diameter:W),printedMaterial());surface.rotation.x=-Math.PI/2;surface.position.y=t+.03;addArtwork(surface,round?1:L/W);
   if(sticker&&/sheet/.test(name)&&!options.artworkTexture){for(let r=0;r<3;r++)for(let c=0;c<3;c++){const label=mesh(new T.CircleGeometry(Math.min(L,W)*.115,40),inside);label.rotation.x=-Math.PI/2;label.position.set((c-1)*L*.29,t+.06,(r-1)*W*.29);}}
  }
  function straw(){
   const length=positive(d.length,Math.max(Number(d.L)||0,Number(d.H)||0),200),r=Math.min(10,positive(d.diameter,d.W,6)/2),t=Math.min(.65,r*.22),mat=options.artworkTexture?printedMaterial():paper;
   if(/bend/.test(name)||f.bend){
    const points=[new T.Vector3(0,0,0),new T.Vector3(0,length*.72,0),new T.Vector3(length*.04,length*.82,0),new T.Vector3(length*.20,length*.90,0)],curve=new T.CatmullRomCurve3(points);
    const outerGeo=new T.TubeGeometry(curve,48,r,16,false),uv=outerGeo.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i);uv.setXY(i,uv.getY(i),u);}uv.needsUpdate=true;addArtwork(mesh(outerGeo,mat),Math.PI*2*r/length);const inner=material(kraft?'#8c704e':'#c4c0b5',{side:T.BackSide});mesh(new T.TubeGeometry(curve,48,r-t,16,false),inner);
    for(const end of [0,1]){const cap=mesh(new T.RingGeometry(r-t,r,24),edge);cap.position.copy(curve.getPoint(end));cap.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),curve.getTangent(end));}
   }else{
    const out=mesh(new T.CylinderGeometry(r,r,length,24,1,true,Math.PI,Math.PI*2),mat);out.position.y=length/2;addArtwork(out,Math.PI*2*r/length);
    const inner=mesh(new T.CylinderGeometry(r-t,r-t,length,24,1,true),material(kraft?'#8c704e':'#c4c0b5',{side:T.BackSide}));inner.position.y=length/2;
    for(const y of [0,length]){const cap=mesh(new T.RingGeometry(r-t,r,24),edge);cap.rotation.x=y?-Math.PI/2:Math.PI/2;cap.position.y=y;}
   }
  }
  function flutedCup(){
   const r=diameter/2,h=positive(d.H,d.height,35),rb=positive(d.bottomDiameter,diameter*.66)/2,t=.4,segments=192,vertices=[],groups=[];
   const point=(i,y,inner)=>{const angle=i/segments*Math.PI*2,level=y/h,rad=rb+(r-rb)*level+Math.sin(angle*48)*Math.min(1.7,r*.035)*level-(inner?t:0);return [Math.cos(angle)*rad,y,Math.sin(angle)*rad];};
   const tri=(a,b,c)=>vertices.push(...a,...b,...c);
   for(let i=0;i<segments;i++)for(const insideWall of [false,true]){const a=point(i,insideWall?t:0,insideWall),b=point(i+1,insideWall?t:0,insideWall),c=point(i+1,h,insideWall),e=point(i,h,insideWall),start=vertices.length/3;if(insideWall){tri(a,b,c);tri(a,c,e);}else{tri(a,c,b);tri(a,e,c);}groups.push([start,6,options.artworkTexture&&!insideWall?1:0]);}
   const rimStart=vertices.length/3;
   for(let i=0;i<segments;i++){const a=point(i,h,false),b=point(i+1,h,false),c=point(i+1,h,true),e=point(i,h,true);tri(a,b,c);tri(a,c,e);}
   groups.push([rimStart,vertices.length/3-rimStart,0]);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===0?[Math.atan2(v,vertices[i+2])/(Math.PI*2)+.5,vertices[i+1]/h]:[]),2));geo.computeVertexNormals();for(const entry of groups)geo.addGroup(...entry);const cup=mesh(geo,options.artworkTexture?[paper,printedMaterial()]:paper);addArtwork(cup,Math.PI*(r+rb)/h);
   const floor=mesh(new T.CircleGeometry(rb-.2,64),inside);floor.rotation.x=-Math.PI/2;floor.position.y=t;
   if(f.domeLid){
    const lid=new T.Group(),domeHeight=r*.84,thickness=.5,points=[[r+1,0],[r+1,1],[r,2]];
    lid.position.y=h;group.add(lid);
    for(let i=1;i<=24;i++){const angle=i/24*Math.PI/2;points.push([r*Math.cos(angle),2+domeHeight*Math.sin(angle)]);}
    for(let i=24;i>=0;i--){const angle=i/24*Math.PI/2;points.push([(r-thickness)*Math.cos(angle),2+(domeHeight-thickness)*Math.sin(angle)]);}
    points.push([r,1],[r,0]);
    const mat=clear();mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),72),mat,lid);
    const lip=mesh(new T.TorusGeometry(r+.3,.65,8,72),mat,lid);lip.rotation.x=Math.PI/2;lip.position.y=1;
    group.userData.domeLid=true;articulatedLid(lid,h,h*.8+domeHeight*.4);
   }
  }
  function cone(){const h=positive(d.H,d.height,d.length,150),rt=diameter/2;roundVessel(1.6,rt,h,.65);const seam=mesh(new T.CylinderGeometry(rt+.12,1.7,h,1,1,true,.01,.017),edge);seam.position.y=h/2;}
  function sliceBox(){
   const points=[new T.Vector2(-L/2,-W/2),new T.Vector2(L/2,-W/2),new T.Vector2(0,W/2)],t=.6;flatShape(points,t,inside);
   for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3],length=a.distanceTo(b),wall=box(length,H,t,(a.x+b.x)/2,H/2,-(a.y+b.y)/2);wall.rotation.y=Math.atan2(b.y-a.y,b.x-a.x);}
   const shape=shapeOf(points);if(f.window){const hole=shapeOf(points.map(p=>p.clone().multiplyScalar(.72)));shape.holes.push(hole);const film=mesh(new T.ShapeGeometry(hole),clear());film.rotation.x=-Math.PI/2;film.position.y=H+.02;}
   const lid=mesh(printedShape(shape,L,W),f.window?paper:printedMaterial());lid.rotation.x=-Math.PI/2;lid.position.y=H;if(!f.window)addArtwork(lid,L/W);group.userData.staticStructure=true;
   if(options.artworkTexture&&f.window){const a=points[0],b=points[1],wall=mesh(new T.PlaneGeometry(a.distanceTo(b)*.90,H*.82),printedMaterial());wall.position.set(0,H/2,W/2+.04);addArtwork(wall,L*.90/(H*.82));}
  }
  function cutleryItem(kind,parent=group){
   const length=positive(d.length,d.L,160),width=positive(d.width,d.W,kind==='spoon'?34:24),t=positive(d.thickness,d.H,3),wood=material(baseColor,{roughness:.78,bumpScale:.10});
   function plate(points,y=0){const m=flatShape(points.map(p=>new T.Vector2(...p)),t,wood,parent);m.position.set(0,y,length/2);return m;}
   const hw=width*.25,neck=length*.70;
   plate([[-hw,0],[hw,0],[hw*.85,neck],[hw*.50,neck+9],[-hw*.50,neck+9],[-hw*.85,neck]]);
   handleArtwork(length*.46,width*.40,t,parent,length*.17);
   const cx=0,cz=-length*.35;
   if(kind==='spoon'||kind==='spork'){
    const radius=width*.52,depth=width*.17,profile=[[0,-depth],[radius*.62,-depth*.68],[radius,0],[radius-.7,0],[radius*.60,-depth*.68+.7],[0,-depth+.7]].map(p=>new T.Vector2(...p));const bowl=mesh(new T.LatheGeometry(profile,40),wood,parent);bowl.position.set(cx,depth+t,cz);bowl.scale.z=1.45;
   }
   if(kind==='fork'||kind==='fruit-fork'||kind==='spork'){
    const y=length*(kind==='spork'?.86:.72),count=kind==='fruit-fork'?2:4;if(kind!=='spork')plate([[-width*.46,y],[width*.46,y],[width*.46,y+length*.07],[-width*.46,y+length*.07]]);
    for(let i=0;i<count;i++){const x=(i-(count-1)/2)*width*.235,tw=width*.13;plate([[x-tw/2,y+length*.06],[x+tw/2,y+length*.06],[x+tw*.35,length],[x-tw*.35,length]]);}
   }else if(kind!=='spoon'){plate([[-width*.14,length*.64],[width*.22,length*.64],[width*.5,length*.80],[width*.46,length*.97],[width*.2,length],[ -width*.14,length]]);}
  }
  function cutlery(){
   const rodKind=f.cutleryType||(/chopstick/.test(name)?'chopsticks':/skewer/.test(name)?'skewer':/stirrer/.test(name)?'stirrer':null);
   if(['chopsticks','skewer','stirrer'].includes(rodKind)){
    const length=positive(d.length,d.L,160),width=positive(d.width,d.W,5),t=positive(d.thickness,d.H,2),wood=material(baseColor,{roughness:.78,bumpScale:.10}),count=rodKind==='chopsticks'?2:1;
    group.userData.cutleryType=rodKind;
    for(let i=0;i<count;i++){const piece=new T.Group();piece.position.x=(i-(count-1)/2)*width*1.8;group.add(piece);const w=rodKind==='skewer'?width*.40:width;
     const points=rodKind==='stirrer'?roundedPoints(w,length,Math.min(w*.45,3)):new Array(4).fill(null).map((_,j)=>new T.Vector2(...[[-w*.5,-length/2],[w*.5,-length/2],[w*.18,length/2],[-w*.18,length/2]][j]));flatShape(points,t,wood,piece);handleArtwork(length*.46,w*.34,t,piece,-length*.18);
     if(rodKind==='skewer'&&/knott|knot/.test(name)){const r=width*.72;line([new T.Vector3(0,t,-length*.43),new T.Vector3(r,t,-length*.43-r),new T.Vector3(0,t,-length*.43-r*2),new T.Vector3(-r,t,-length*.43-r),new T.Vector3(0,t,-length*.43)],wood,piece,false,Math.max(.3,w*.20));}
    }return;
   }
   const kinds=/set|cutlery|assorted/.test(name)?['fork','spoon','knife']:[f.cutleryType||(/fork/.test(name)?'fork':/knife/.test(name)?'knife':'spoon')];group.userData.cutleryType=kinds.join(',');
   kinds.forEach((kind,i)=>{const piece=new T.Group();piece.position.x=(i-(kinds.length-1)/2)*positive(d.width,d.W,26)*1.25;group.add(piece);cutleryItem(kind,piece);});
  }
  function staticBox(){
   rectangularTray(L,W,H,.8,paper,group,0);const lid=trayLid(L,W,H,false);group.userData.staticStructure=true;group.userData.foldingGraphRequired=true;
   if(options.artworkTexture){const m=mesh(new T.PlaneGeometry(L*.94,H*.92),printedMaterial());m.position.set(0,H/2,W/2+.5);addArtwork(m,L*.94/(H*.92));}
   return lid;
  }
  switch(type){
   case 'paper-bag':paperBag();break;
   case 'food-tray':rectangularTray(L,W,H,1.1);if(f.lid){const lid=trayLid(L,W,H,/pet|plastic|clear/.test(String(f.lid)+' '+name));articulatedLid(lid,H);}break;
   case 'bowl':vessel('bowl');break;
   case 'cup':vessel('cup');break;
   case 'cup-carrier':carrier();break;
   case 'cutlery':cutlery();break;
   case 'straw':straw();break;
   case 'sheet':flatItem(false);break;
   case 'sticker':flatItem(true);break;
   case 'moulded-clamshell':clamshell();break;
   case 'aluminium-tray':foilTray();break;
   case 'paper-baking-cup':flutedCup();break;
   case 'cake-slice-box':sliceBox();break;
   case 'food-cone':cone();break;
   case 'bundle':case 'sample-pack':rectangularTray(L,W,Math.min(H,30),1.2,paper,group,.025);group.userData.requiresComposition=true;break;
   case 'folding-box':staticBox();break;
   default:staticBox();group.userData.unsupportedGeometryType=true;
  }
  group.updateMatrixWorld(true);
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;const geometries=new Set();group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});for(const geometry of geometries)geometry.dispose();for(const mat of materials)mat.dispose();for(const texture of ownedTextures)texture.dispose();group.clear();}
  return {group,artworkMeshes,artworkAspectRatio,dispose,...(opener?{setOpen:opener}:{})};
 }
 root.EcoPakGeometry={create,version:'1.0.0'};
})(typeof window==='undefined'?globalThis:window);

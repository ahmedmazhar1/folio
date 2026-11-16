/* Render each sheet panel in its own hinge frame. Units in the manifest are mm. */
(function (root) {
  const clamp = value => Math.max(0, Math.min(1, value));
  function angleAt(panel, progress) {
    const [start, end] = panel.phase;
    const t = clamp((progress - start) / (end - start));
    return panel.closed_angle * (1 - t * t * (3 - 2 * t));
  }

  function panelGeometry(T, panel, scale, thickness, softenEdges) {
    const contours=[panel.outline,...(panel.holes||[])].map((points,index)=>{
      const ring=points.map(([x,y])=>new T.Vector2(x*scale,y*scale));
      if(T.ShapeUtils.isClockWise(ring)!==(index>0))ring.reverse();
      return ring;
    });
    // A small paper-edge chamfer catches light without changing the cut outline.
    const bevel=softenEdges?thickness*scale*.16:0;
    const caps=bevel?contours.map(ring=>ring.map((point,i)=>{
      const prev=ring[(i+ring.length-1)%ring.length],next=ring[(i+1)%ring.length];
      const a=new T.Vector2(-(point.y-prev.y),point.x-prev.x).normalize();
      const b=new T.Vector2(-(next.y-point.y),next.x-point.x).normalize();
      const distance=bevel/Math.max(.25,1+a.dot(b));
      return point.clone().add(a.add(b).multiplyScalar(distance));
    })):contours;
    const vertices=caps.flat();
    const triangles=T.ShapeUtils.triangulateShape(caps[0],caps.slice(1));
    const geometry = new T.BufferGeometry(), positions = [], uv = [];
    const half = thickness * scale / 2;
    function vertex(point, z, back) {
      positions.push(point.x, point.y, z);
      let u = (point.x / scale - panel.center[0]) / panel.width + .5;
      let v = (point.y / scale - panel.center[1]) / panel.height + .5;
      if (back && panel.id !== 'lid') u = 1 - u;
      if (back && panel.id === 'lid') v = 1 - v;
      // A lid-mounted front flap reverses direction when it closes.
      if (panel.uv_rotation === 180) { u = 1 - u; v = 1 - v; }
      uv.push(u, v);
    }
    for(let ringIndex=0;ringIndex<contours.length;ringIndex++){const polygon=contours[ringIndex];for(let i=0;i<polygon.length;i++){
      const lo=polygon[i],hi=polygon[(i+1)%polygon.length];
      const inLo=caps[ringIndex][i],inHi=caps[ringIndex][(i+1)%polygon.length];
      const strips=bevel?[[inLo,inHi,-half,lo,hi,-half+bevel],[lo,hi,-half+bevel,lo,hi,half-bevel],[lo,hi,half-bevel,inLo,inHi,half]]:[[lo,hi,-half,lo,hi,half]];
      for(const [a,b,z,c,d,w] of strips)for (const [point,height] of [[a,z],[b,z],[d,w],[a,z],[d,w],[c,w]]) vertex(point,height,false);
    }}
    geometry.addGroup(0, positions.length / 3, 0);
    for (const back of [false, true]) {
      const first = positions.length / 3;
      for (const indices of triangles) {
        for (const index of back ? indices.slice().reverse() : indices) vertex(vertices[index], back ? -half : half, back);
      }
      geometry.addGroup(first, positions.length / 3 - first, back ? 5 : 4);
    }
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv,2));
    geometry.computeVertexNormals();
    return geometry;
  }

  function mount(T, model, options = {}) {
    const scale = options.scale || .01, rootGroup = new T.Group();
    const nodes = new Map(), meshes = [], guides = [], films = [];
    const paper = new T.MeshStandardMaterial({color:0xffffff, roughness:1});
    for (const panel of model.panels) {
      const pivot = new T.Group();
      pivot.position.fromArray(panel.hinge.map(v => v * scale));
      (panel.parent ? nodes.get(panel.parent) : rootGroup).add(pivot);
      nodes.set(panel.id, pivot);
      const supplied = options.materials?.(panel) || paper;
      const mesh = new T.Mesh(panelGeometry(T,panel,scale,model.thickness_mm,model.template_id==='board-window-cake'), supplied);
      mesh.userData = {face:panel.face, idx:panel.face === 'inside' ? 4 : 5, panelId:panel.id};
      mesh.castShadow = mesh.receiveShadow = true;
      pivot.add(mesh);
      meshes.push(mesh);
      if(panel.window_film){
        for(const hole of panel.holes||[]){
          const shape=new T.Shape(hole.map(([x,y])=>new T.Vector2(x*scale,y*scale)));
          const film=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshPhysicalMaterial({color:0xe5f2ee,transparent:true,opacity:.14,roughness:.18,metalness:0,side:T.DoubleSide,depthWrite:false}));
          film.position.z=model.thickness_mm*scale*.6;film.userData={windowFilm:true};pivot.add(film);films.push(film);
        }
      }
      const scores = (panel.crease ? [panel.crease] : []).concat(panel.scores || []);
      for (const [segments,color,dashed] of [[panel.cuts,model.line_colors?.cut||0xcd4158,false],[scores,model.line_colors?.crease||0x188157,true]]) {
        if (!segments.length) continue;
        const vertices = [];
        for (const sign of [-1, 1]) {
          for (const segment of segments) for (const [x,y] of segment) vertices.push(x*scale,y*scale,sign*(model.thickness_mm/2+.08)*scale);
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
        const material = dashed ? new T.LineDashedMaterial({color,toneMapped:false,dashSize:3*scale,gapSize:1.5*scale}) : new T.LineBasicMaterial({color,toneMapped:false});
        material.color.convertSRGBToLinear();
        const line = new T.LineSegments(geometry,material);
        if (dashed) line.computeLineDistances();
        line.visible = false;
        pivot.add(line);
        guides.push(line);
      }
      mesh.userData.originalMaterial = supplied;
    }
    let progress = 0;
    function setProgress(value) {
      progress = clamp(value);
      rootGroup.rotation.x = -Math.PI/2 * (model.upright ? progress : 1);
      for (const panel of model.panels){
        const node=nodes.get(panel.id);node.rotation[panel.axis]=angleAt(panel,progress);
        if(panel.fold_offset)node.position.fromArray(panel.hinge.map((v,i)=>(v+panel.fold_offset[i]*(1-progress))*scale));
      }
    }
    function setGuides(visible) {
      for (const line of guides) line.visible = visible;
      for (const film of films)film.visible=!visible;
      for (const mesh of meshes) mesh.material = visible ? paper : mesh.userData.originalMaterial;
    }
    function dispose() {
      setGuides(false);
      const materials = new Set([paper]);
      rootGroup.traverse(node => {
        node.geometry?.dispose();
        if (node.material) for (const material of [].concat(node.material)) materials.add(material);
      });
      for (const material of materials) material.dispose();
    }
    setProgress(0);
    return {group:rootGroup,nodes,meshes,films,setProgress,setGuides,dispose,get progress(){return progress}};
  }
  root.FolioFolding = {mount,angleAt,version:'1.1.0'};
})(typeof window === 'undefined' ? globalThis : window);

/* Render each sheet panel in its own hinge frame. Units in the manifest are mm. */
(function (root) {
  const clamp = value => Math.max(0, Math.min(1, value));
  function angleAt(panel, progress) {
    const [start, end] = panel.phase;
    const t = clamp((progress - start) / (end - start));
    return panel.closed_angle * (1 - t * t * (3 - 2 * t));
  }

  function panelGeometry(T, panel, scale, thickness) {
    const polygon = panel.outline.map(([x, y]) => new T.Vector2(x * scale, y * scale));
    const triangles = T.ShapeUtils.triangulateShape(polygon, []);
    const geometry = new T.BufferGeometry(), positions = [], uv = [];
    const half = thickness * scale / 2;
    function vertex(point, z, back) {
      positions.push(point.x, point.y, z);
      let u = (point.x / scale - panel.center[0]) / panel.width + .5;
      let v = (point.y / scale - panel.center[1]) / panel.height + .5;
      if (back && panel.id !== 'lid') u = 1 - u;
      if (back && panel.id === 'lid') v = 1 - v;
      uv.push(u, v);
    }
    const ccw = !T.ShapeUtils.isClockWise(polygon);
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const [lo, hi] = ccw ? [a,b] : [b,a];
      for (const [point,z] of [[lo,-half],[hi,-half],[hi,half],[lo,-half],[hi,half],[lo,half]]) vertex(point,z,false);
    }
    geometry.addGroup(0, positions.length / 3, 0);
    for (const back of [false, true]) {
      const first = positions.length / 3;
      for (const indices of triangles) {
        for (const index of back ? indices.slice().reverse() : indices) vertex(polygon[index], back ? -half : half, back);
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
    const nodes = new Map(), meshes = [], guides = [];
    const paper = new T.MeshStandardMaterial({color:0xffffff, roughness:1});
    for (const panel of model.panels) {
      const pivot = new T.Group();
      pivot.position.fromArray(panel.hinge.map(v => v * scale));
      (panel.parent ? nodes.get(panel.parent) : rootGroup).add(pivot);
      nodes.set(panel.id, pivot);
      const supplied = options.materials?.(panel) || paper;
      const mesh = new T.Mesh(panelGeometry(T,panel,scale,model.thickness_mm), supplied);
      mesh.userData = {face:panel.face, idx:panel.face === 'inside' ? 4 : 5, panelId:panel.id};
      mesh.castShadow = mesh.receiveShadow = true;
      pivot.add(mesh);
      meshes.push(mesh);
      const scores = (panel.crease ? [panel.crease] : []).concat(panel.scores || []);
      for (const [segments,color,dashed] of [[panel.cuts,0xcd4158,false],[scores,0x188157,true]]) {
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
      for (const panel of model.panels) nodes.get(panel.id).rotation[panel.axis] = angleAt(panel,progress);
    }
    function setGuides(visible) {
      for (const line of guides) line.visible = visible;
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
    return {group:rootGroup,nodes,meshes,setProgress,setGuides,dispose,get progress(){return progress}};
  }
  root.FolioFolding = {mount,angleAt,version:'1.1.0'};
})(typeof window === 'undefined' ? globalThis : window);

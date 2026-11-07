/* An original, scroll-controlled packaging journey. Three.js is provided locally. */
(() => {
  'use strict';
  const T = window.THREE;
  const clamp = value => Math.max(0, Math.min(1, value));
  const phase = (value, start, end) => clamp((value - start) / (end - start));
  const smooth = value => value * value * (3 - 2 * value);
  const blend = (a, b, amount) => a + (b - a) * amount;
  const ink = 0x121b16;
  const acid = 0xe6ff58;
  const mint = 0x87cda5;
  const paper = 0xecebdc;

  class FolioStoryScene {
    constructor(canvas) {
      this.canvas = canvas;
      this.progress = 0;
      this.artMaterials = [];
      this.guideMaterials = [];
      this.roadMaterials = [];
      this.storeMaterials = [];
      this.truckMaterials = [];
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.95;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
      this.camera.position.set(7, 8, 10);
      this.scene.add(new T.HemisphereLight(0xf6ffe9, 0x607664, 0.85));
      const key = new T.DirectionalLight(0xfff9df, 1.6);
      key.position.set(-4, 9, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 30 });
      key.shadow.bias = -0.0006;
      key.shadow.normalBias = 0.025;
      key.shadow.radius = 4;
      this.scene.add(key);
      const rim = new T.DirectionalLight(0xa5ffd1, 0.65);
      rim.position.set(7, 4, -5);
      this.scene.add(rim);
      const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: 0.24 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.23;
      floor.receiveShadow = true;
      this.scene.add(floor);
      this.makePackage();
      this.makeApparel();
      this.makePaperBag();
      this.products = [this.package, ...this.apparel, this.bag];
      this.makeRoad();
      this.makeTruck();
      this.makeStore();
      this.resize();
      this.setProgress(0);
    }

    material(color, collection, extra = {}) {
      const material = new T.MeshStandardMaterial({ color, roughness: 0.77, metalness: 0.02, ...extra });
      material.color.convertSRGBToLinear();
      if (collection) {
        material.transparent = true;
        collection.push(material);
      }
      return material;
    }

    block(parent, size, position, color, collection, extra) {
      const mesh = new T.Mesh(new T.BoxGeometry(...size), this.material(color, collection, extra));
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    labelTexture(text, background = '#e6ff58', foreground = '#121b16', width = 768, height = 256) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = foreground;
      let fontSize = Math.round(height * 0.48);
      ctx.font = '800 ' + fontSize + 'px Arial, sans-serif';
      if (ctx.measureText(text).width > width * 0.86) {
        fontSize *= width * 0.86 / ctx.measureText(text).width;
        ctx.font = '800 ' + Math.floor(fontSize) + 'px Arial, sans-serif';
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height * 0.53);
      const texture = new T.CanvasTexture(canvas);
      texture.encoding = T.sRGBEncoding;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    artworkTexture(kind) {
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = kind === 'lid' ? 1024 : 512;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = '#e6ff58';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#86cda5';
      ctx.beginPath();
      ctx.moveTo(w * 0.69, -h * 0.1);
      ctx.bezierCurveTo(w * 0.25, h * 0.24, w * 1.14, h * 0.26, w * 0.59, h * 0.62);
      ctx.bezierCurveTo(w * 0.25, h * 0.9, w * 1.14, h * 0.76, w * 0.63, h * 1.12);
      ctx.lineTo(w * 1.1, h * 1.12);
      ctx.lineTo(w * 1.1, -h * 0.1);
      ctx.fill();
      ctx.strokeStyle = '#14271c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.87, -20);
      ctx.bezierCurveTo(w * 0.44, h * 0.18, w * 1.18, h * 0.48, w * 0.67, h * 0.73);
      ctx.bezierCurveTo(w * 0.4, h * 0.91, w * 0.96, h * 0.88, w * 0.78, h * 1.05);
      ctx.stroke();
      ctx.fillStyle = '#121b16';
      ctx.textAlign = 'left';
      if (kind === 'lid') {
        ctx.font = '700 38px Arial, sans-serif';
        ctx.fillText('FOLIO / THE GOOD STUFF', 98, 128);
        ctx.font = '900 272px Arial, sans-serif';
        ctx.fillText('good', 78, 414);
        ctx.fillText('things.', 78, 664);
        ctx.font = '600 39px Arial, sans-serif';
        ctx.fillText('OPEN FOR SOMETHING GOOD.', 100, 904);
        ctx.beginPath();
        ctx.arc(1306, 820, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e6ff58';
        ctx.font = '900 104px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('f.', 1306, 852);
      } else {
        ctx.font = '900 156px Arial, sans-serif';
        ctx.fillText('GOOD THINGS', 84, 215);
        ctx.fillText('INSIDE ↗', 84, 380);
      }
      const texture = new T.CanvasTexture(canvas);
      texture.encoding = T.sRGBEncoding;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    panel(parent, outline, kind = 'side') {
      const top = [], bottom = [], indices = [], uv = [];
      const shape = new T.Shape(outline.map(([x, z]) => new T.Vector2(x, z)));
      const triangles = T.ShapeUtils.triangulateShape(shape.getPoints(), []);
      const xs = outline.map(point => point[0]), zs = outline.map(point => point[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      outline.forEach(([x, z]) => {
        top.push(x, 0.018, z);
        bottom.push(x, -0.018, z);
        uv.push((x - minX) / (maxX - minX), (z - minZ) / (maxZ - minZ));
      });
      triangles.forEach(triangle => indices.push(...triangle));
      const faceGeometry = positions => {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
      };
      const inner = new T.Mesh(faceGeometry(top), this.material(paper, null, { side: T.DoubleSide }));
      const outer = new T.Mesh(faceGeometry(bottom), this.material(paper, null, { side: T.DoubleSide }));
      inner.castShadow = true;
      inner.receiveShadow = true;
      outer.castShadow = true;
      outer.receiveShadow = true;
      parent.add(inner, outer);
      const printPositions = bottom.map((value, index) => index % 3 === 1 ? value - 0.003 : value);
      if (kind !== 'internal') {
        const artwork = new T.Mesh(faceGeometry(printPositions), this.material(0xb0b0b0, this.artMaterials, {
          map: kind === 'lid' ? this.lidTexture : this.sideTexture,
          alphaMap: this.printMask,
          side: T.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          depthWrite: false
        }));
        artwork.receiveShadow = true;
        parent.add(artwork);
      }
      const edgePositions = [];
      outline.forEach(([x, z], i) => {
        const next = outline[(i + 1) % outline.length];
        edgePositions.push(x, -0.018, z, next[0], -0.018, next[1], x, 0.018, z, next[0], 0.018, next[1]);
      });
      const edges = new T.BufferGeometry();
      edges.setAttribute('position', new T.Float32BufferAttribute(edgePositions, 3));
      const edgeMaterial = new T.LineBasicMaterial({ color: 0x476a4e, transparent: true, opacity: 0.67 });
      this.guideMaterials.push(edgeMaterial);
      parent.add(new T.LineSegments(edges, edgeMaterial));
      return inner;
    }

    crease(parent, a, b) {
      const geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(a[0], 0.026, a[1]), new T.Vector3(b[0], 0.026, b[1])]);
      const material = new T.LineDashedMaterial({ color: 0x188345, dashSize: 0.07, gapSize: 0.045, transparent: true });
      this.guideMaterials.push(material);
      const line = new T.Line(geometry, material);
      line.computeLineDistances();
      parent.add(line);
    }

    makePackage() {
      this.printCanvas = document.createElement('canvas');
      this.printCanvas.width = 512;
      this.printCanvas.height = 16;
      this.printMask = new T.CanvasTexture(this.printCanvas);
      this.lastPrint = -1;
      this.lidTexture = this.artworkTexture('lid');
      this.sideTexture = this.artworkTexture('side');
      this.package = new T.Group();
      this.scene.add(this.package);
      this.panel(this.package, [[-1.5, -1], [1.5, -1], [1.5, 1], [-1.5, 1]]);
      const hinge = (parent, x, z, outline, kind) => {
        const group = new T.Group();
        group.position.set(x, 0, z);
        parent.add(group);
        this.panel(group, outline, kind);
        return group;
      };
      this.front = hinge(this.package, 0, 1, [[-1.5, 0], [1.5, 0], [1.5, 0.78], [1.4, 0.84], [-1.4, 0.84], [-1.5, 0.78]]);
      this.back = hinge(this.package, 0, -1, [[-1.5, 0], [1.5, 0], [1.5, -0.84], [-1.5, -0.84]]);
      this.left = hinge(this.package, -1.5, 0, [[0, -1], [0, 1], [-0.79, 1], [-0.84, 0.93], [-0.84, -0.93], [-0.79, -1]]);
      this.right = hinge(this.package, 1.5, 0, [[0, -1], [0, 1], [0.79, 1], [0.84, 0.93], [0.84, -0.93], [0.79, -1]]);
      this.lid = hinge(this.back, 0, -0.84, [[-1.5, 0], [1.5, 0], [1.5, -1.92], [1.42, -2], [-1.42, -2], [-1.5, -1.92]], 'lid');
      this.tuck = hinge(this.lid, 0, -1.95, [[-1.42, 0], [1.42, 0], [1.36, -0.32], [1.23, -0.4], [-1.23, -0.4], [-1.36, -0.32]], 'internal');
      this.lidLeft = hinge(this.lid, -1.46, 0, [[0, -0.1], [0, -1.82], [-0.33, -1.67], [-0.38, -0.23]], 'internal');
      this.lidRight = hinge(this.lid, 1.46, 0, [[0, -0.1], [0, -1.82], [0.33, -1.67], [0.38, -0.23]], 'internal');
      this.crease(this.package, [-1.5, -1], [1.5, -1]);
      this.crease(this.package, [-1.5, 1], [1.5, 1]);
      this.crease(this.package, [-1.5, -1], [-1.5, 1]);
      this.crease(this.package, [1.5, -1], [1.5, 1]);
      this.crease(this.lid, [-1.5, 0], [1.5, 0]);
      this.crease(this.lid, [-1.42, -2], [1.42, -2]);
      this.crease(this.lid, [-1.5, -0.1], [-1.5, -1.82]);
      this.crease(this.lid, [1.5, -0.1], [1.5, -1.82]);
    }

    fabricTexture() {
      const size = 128;
      const pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const stitch = 128 + 22 * Math.cos(x * Math.PI / 2 + 0.4 * Math.sin(y * Math.PI / 3));
          const value = Math.round(stitch + 8 * Math.sin(y * Math.PI / 3));
          pixels.set([value, value, value, 255], (y * size + x) * 4);
        }
      }
      const texture = new T.DataTexture(pixels, size, size);
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.repeat.set(12, 8);
      texture.needsUpdate = true;
      return texture;
    }

    apparelTexture(zone, background, foreground, accent) {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 2048, 1024);
      if (zone === 'body') {
        // The shared garment's front chest is u=.25, v=.69.
        ctx.fillStyle = foreground;
        ctx.font = '700 19px Arial, sans-serif';
        ctx.fillText('FOLIO / WEAR THE GOOD STUFF', 357, 206);
        ctx.font = '900 106px Arial, sans-serif';
        ctx.fillText('good', 347, 316);
        ctx.fillText('things.', 347, 411);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(711, 228);
        ctx.bezierCurveTo(600, 284, 792, 309, 692, 368);
        ctx.bezierCurveTo(625, 409, 746, 421, 703, 461);
        ctx.stroke();
        ctx.fillStyle = foreground;
        ctx.font = '700 16px Arial, sans-serif';
        ctx.fillText('MADE TO GO GOOD PLACES.', 357, 459);
        // A small brand mark on the back remains visible as the collection turns.
        ctx.textAlign = 'center';
        ctx.font = '900 60px Arial, sans-serif';
        ctx.fillText('f.', 1536, 260);
      } else {
        ctx.fillStyle = foreground;
        const center = zone === 'left' ? 1024 : 0;
        ctx.font = '700 30px Arial, sans-serif';
        ctx.textAlign = 'center';
        for (const offset of [-2048, 0, 2048]) ctx.fillText('GOOD THINGS ↗', center + offset, 480);
      }
      const texture = new T.CanvasTexture(canvas);
      texture.encoding = T.sRGBEncoding;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    }

    makeApparel() {
      const fabric = this.fabricTexture();
      const colorways = [
        ['hoodie', '#2d4638', '#e6ff58', '#91d8b1'],
        ['tshirt-short', '#e6ff58', '#14271c', '#4f9e76'],
        ['tshirt-long', '#eaece0', '#14271c', '#78c59c']
      ];
      this.apparel = colorways.map(([kind, background, foreground, accent]) => {
        const cloth = this.material(background, null, { bumpMap: fabric, bumpScale: 0.0012, side: T.DoubleSide, roughness: 0.96 });
        const dark = cloth.clone();
        dark.color.multiplyScalar(0.84);
        const hoodLining = cloth.clone();
        hoodLining.color.multiplyScalar(0.34);
        const seamMaterial = cloth.clone();
        seamMaterial.color.multiplyScalar(0.72);
        const model = window.FolioGarmentModel.create({
          kind,
          materials: { cloth, dark, hoodLining, seamMaterial },
          printMaterial: zone => this.material(0xffffff, null, {
            map: this.apparelTexture(zone, background, foreground, accent),
            bumpMap: fabric,
            bumpScale: 0.0012,
            side: T.DoubleSide,
            roughness: 0.96
          })
        });
        this.scene.add(model.group);
        return model.group;
      });
    }

    makePaperBag() {
      const bag = this.bag = new T.Group();
      this.scene.add(bag);
      const body = this.material(acid);
      const side = this.material(0xb2cb48);
      const front = this.material(0xffffff, null, { map: this.artworkTexture('lid') });
      const mesh = new T.Mesh(new T.BoxGeometry(1.45, 1.78, 0.52), [side, side, body, side, front, front]);
      mesh.castShadow = mesh.receiveShadow = true;
      bag.add(mesh);
      // A dark inset and folded paper lip make the opening read as hollow.
      this.block(bag, [1.37, 0.016, 0.44], [0, 0.895, 0], ink);
      for (const sign of [-1, 1]) {
        this.block(bag, [1.45, 0.065, 0.022], [0, 0.90, sign * 0.263], acid);
        const curve = new T.CatmullRomCurve3([
          new T.Vector3(-0.40, 0.67, sign * 0.283),
          new T.Vector3(-0.42, 1.20, sign * 0.29),
          new T.Vector3(0, 1.49, sign * 0.29),
          new T.Vector3(0.42, 1.20, sign * 0.29),
          new T.Vector3(0.40, 0.67, sign * 0.283)
        ]);
        const handle = new T.Mesh(new T.TubeGeometry(curve, 48, 0.032, 8, false), this.material(ink));
        handle.castShadow = true;
        bag.add(handle);
        for (const x of [-0.40, 0.40]) {
          this.block(bag, [0.10, 0.13, 0.018], [x, 0.66, sign * 0.278], mint);
        }
      }
      const seamGeometry = new T.BufferGeometry().setFromPoints([
        new T.Vector3(-0.727, -0.85, 0.20), new T.Vector3(-0.727, 0.84, 0),
        new T.Vector3(-0.727, -0.85, -0.20)
      ]);
      bag.add(new T.Line(seamGeometry, new T.LineBasicMaterial({ color: 0x718b37 })));
    }

    makeRoad() {
      this.road = new T.Group();
      this.scene.add(this.road);
      this.route = new T.CatmullRomCurve3([
        new T.Vector3(-6, -0.16, 1.1), new T.Vector3(-3.8, -0.16, 1.1),
        new T.Vector3(-1, -0.16, 0.25), new T.Vector3(1.8, -0.16, -0.25),
        new T.Vector3(5.8, -0.16, 0.3)
      ]);
      const positions = [], indices = [], divisions = 120;
      for (let i = 0; i <= divisions; i++) {
        const t = i / divisions, point = this.route.getPoint(t), tangent = this.route.getTangent(t);
        const normal = new T.Vector3(-tangent.z, 0, tangent.x).normalize();
        for (const side of [-1, 1]) {
          const vertex = point.clone().addScaledVector(normal, side * 1.05);
          positions.push(vertex.x, vertex.y, vertex.z);
        }
        if (i < divisions) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const road = new T.Mesh(geometry, this.material(0x263c30, this.roadMaterials, { side: T.DoubleSide }));
      road.receiveShadow = true;
      this.road.add(road);
      const lineGeometry = new T.BufferGeometry().setFromPoints(this.route.getPoints(160).map(v => new T.Vector3(v.x, v.y + 0.015, v.z)));
      const lineMaterial = new T.LineDashedMaterial({ color: acid, dashSize: 0.25, gapSize: 0.23, transparent: true });
      this.roadMaterials.push(lineMaterial);
      const line = new T.Line(lineGeometry, lineMaterial);
      line.computeLineDistances();
      this.road.add(line);
      for (const [x, z, scale] of [[-4, -1.1, 0.8], [-2.6, 2.4, 0.62], [0.8, -2.3, 0.7], [3.8, 2, 0.5]]) {
        const tree = new T.Group();
        tree.position.set(x, -0.18, z);
        tree.scale.setScalar(scale);
        this.road.add(tree);
        this.block(tree, [0.09, 0.8, 0.09], [0, 0.4, 0], 0x6c8669, this.roadMaterials);
        const crown = new T.Mesh(new T.SphereGeometry(0.47, 20, 16), this.material(mint, this.roadMaterials));
        crown.position.y = 1.05;
        crown.scale.set(0.8, 1.2, 0.8);
        crown.castShadow = true;
        tree.add(crown);
      }
    }

    makeTruck() {
      const truck = this.truck = new T.Group();
      this.scene.add(truck);
      const materials = this.truckMaterials;
      this.block(truck, [3.8, 0.18, 1.65], [-0.25, 0.52, 0], ink, materials);
      this.block(truck, [2.45, 0.22, 1.7], [-0.9, 0.73, 0], acid, materials);
      this.block(truck, [1.18, 0.95, 1.54], [1.1, 1.05, 0], mint, materials);
      this.block(truck, [0.64, 0.43, 1.52], [1.68, 0.82, 0], acid, materials);
      this.block(truck, [1.26, 0.1, 1.62], [1.1, 1.56, 0], acid, materials);
      this.block(truck, [0.028, 0.49, 1.3], [1.705, 1.2, 0], ink, materials, { roughness: 0.16, metalness: 0.25 });
      for (const side of [-1, 1]) {
        this.block(truck, [0.77, 0.48, 0.028], [1.12, 1.23, side * 0.782], ink, materials, { roughness: 0.18 });
        this.block(truck, [0.15, 0.045, 0.04], [0.92, 0.87, side * 0.81], ink, materials);
        this.block(truck, [0.16, 0.2, 0.12], [1.72, 1.25, side * 0.88], ink, materials);
        this.block(truck, [0.045, 0.13, 0.32], [2.015, 0.78, side * 0.48], paper, materials, { emissive: 0xa4b24d, emissiveIntensity: 0.25 });
      }
      this.block(truck, [0.09, 0.17, 1.62], [2.02, 0.55, 0], ink, materials);
      this.wheels = [];
      for (const x of [-1.2, 1.32]) {
        for (const z of [-0.85, 0.85]) {
          const wheel = new T.Group();
          wheel.position.set(x, 0.31, z);
          truck.add(wheel);
          const tyre = new T.Mesh(new T.CylinderGeometry(0.39, 0.39, 0.22, 32), this.material(0x101712, materials));
          tyre.rotation.x = Math.PI / 2;
          tyre.castShadow = true;
          wheel.add(tyre);
          const hub = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.24, 20), this.material(0xb6c8a5, materials, { metalness: 0.45, roughness: 0.3 }));
          hub.rotation.x = Math.PI / 2;
          wheel.add(hub);
          this.wheels.push(wheel);
        }
      }
      const brandMaterial = this.material(0xffffff, materials, { map: this.labelTexture('folio delivery', '#e6ff58', '#121b16'), side: T.DoubleSide });
      for (const side of [-1, 1]) {
        const sign = new T.Mesh(new T.PlaneGeometry(2.15, 0.34), brandMaterial);
        sign.position.set(-0.9, 0.76, side * 0.86);
        if (side < 0) sign.rotation.y = Math.PI;
        truck.add(sign);
      }
      // Open cargo keeps the five finished products visible on their journey.
      for (const x of [-1.96, 0.25]) {
        this.block(truck, [0.045, 1.48, 0.045], [x, 1.52, -0.65], ink, materials);
      }
      this.block(truck, [2.26, 0.045, 0.045], [-0.85, 2.24, -0.65], ink, materials);
    }

    makeStore() {
      this.store = new T.Group();
      this.store.position.set(4.1, -0.18, -1.85);
      this.store.rotation.y = -0.10;
      this.scene.add(this.store);
      const store = this.store, materials = this.storeMaterials;
      this.block(store, [3.6, 0.18, 2.1], [0, 0, 0.28], 0x8caa85, materials);
      this.block(store, [3.2, 2.8, 1.2], [0, 1.4, -0.35], paper, materials);
      this.block(store, [3.38, 0.2, 1.4], [0, 2.84, -0.35], mint, materials);
      this.block(store, [2.8, 0.42, 0.12], [0, 2.39, 0.31], acid, materials);
      const title = new T.Mesh(new T.PlaneGeometry(2.48, 0.34), this.material(0xffffff, materials, { map: this.labelTexture('THE GOOD STORE', '#e6ff58', '#121b16'), side: T.DoubleSide }));
      title.position.set(0, 2.4, 0.38);
      store.add(title);
      this.block(store, [1.38, 1.63, 0.07], [-0.64, 1.02, 0.29], 0x345d4a, materials, { roughness: 0.2, metalness: 0.13 });
      this.block(store, [0.88, 1.94, 0.1], [0.83, 0.99, 0.29], ink, materials);
      this.block(store, [0.66, 1.42, 0.025], [0.83, 1.19, 0.35], 0x4f7961, materials, { roughness: 0.19 });
      this.block(store, [0.05, 0.3, 0.08], [1.05, 0.94, 0.4], acid, materials);
      this.block(store, [0.05, 1.63, 0.12], [-0.64, 1.02, 0.36], paper, materials);
      this.block(store, [1.48, 0.08, 0.15], [-0.64, 1.02, 0.37], paper, materials);
      const awning = new T.Group();
      awning.position.set(0, 2.14, 0.4);
      awning.rotation.x = -0.17;
      store.add(awning);
      for (let i = 0; i < 10; i++) {
        const x = -1.5 + i * 0.333;
        this.block(awning, [0.334, 0.075, 0.75], [x, 0, 0.3], i % 2 ? mint : acid, materials);
        this.block(awning, [0.334, 0.19, 0.05], [x, -0.1, 0.68], i % 2 ? mint : acid, materials);
      }
      const plant = new T.Mesh(new T.CylinderGeometry(0.23, 0.17, 0.36, 24), this.material(acid, materials));
      plant.position.set(-1.5, 0.21, 0.99);
      plant.castShadow = true;
      store.add(plant);
      for (const [x, height] of [[-0.12, 0.37], [0.08, 0.5], [0.19, 0.3]]) {
        const leaf = new T.Mesh(new T.SphereGeometry(0.14, 16, 16), this.material(mint, materials));
        leaf.position.set(-1.5 + x, 0.5 + height * 0.4, 1.0);
        leaf.scale.set(0.8, height / 0.14, 0.55);
        leaf.rotation.z = -x * 2;
        leaf.castShadow = true;
        store.add(leaf);
      }
      this.block(store, [1.08, 0.035, 0.44], [0.83, 0.12, 0.76], ink, materials);
      const rack = new T.Group();
      rack.position.set(0.27, 0.09, 1.27);
      store.add(rack);
      for (const x of [-1.18, 1.18]) {
        this.block(rack, [0.035, 1.58, 0.035], [x, 0.79, 0], ink, materials);
        this.block(rack, [0.34, 0.035, 0.36], [x, 0.025, 0], ink, materials);
      }
      this.block(rack, [2.4, 0.035, 0.035], [0, 1.58, 0], ink, materials);
    }

    opacity(materials, opacity) {
      for (const material of materials) material.opacity = opacity;
    }

    revealArtwork(amount) {
      if (amount === this.lastPrint) return;
      this.lastPrint = amount;
      const ctx = this.printCanvas.getContext('2d');
      const width = this.printCanvas.width;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, 16);
      if (amount === 1) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, 16);
      } else if (amount > 0) {
        const edge = amount * (width + 40);
        const gradient = ctx.createLinearGradient(Math.max(0, edge - 40), 0, edge, 0);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, Math.max(0, edge - 40), 16);
        ctx.fillStyle = gradient;
        ctx.fillRect(Math.max(0, edge - 40), 0, 40, 16);
      }
      this.printMask.needsUpdate = true;
    }

    setProgress(value) {
      const p = this.progress = clamp(value);
      const walls = smooth(phase(p, 0.10, 0.205));
      const lid = smooth(phase(p, 0.18, 0.26));
      this.front.rotation.x = -walls * Math.PI / 2;
      this.back.rotation.x = walls * Math.PI / 2;
      this.left.rotation.z = -walls * Math.PI / 2;
      this.right.rotation.z = walls * Math.PI / 2;
      this.lid.rotation.x = lid * Math.PI / 2;
      this.tuck.rotation.x = smooth(phase(p, 0.225, 0.26)) * Math.PI / 2;
      this.lidLeft.rotation.z = -smooth(phase(p, 0.195, 0.25)) * Math.PI / 2;
      this.lidRight.rotation.z = smooth(phase(p, 0.195, 0.25)) * Math.PI / 2;
      const print = smooth(phase(p, 0.26, 0.35));
      this.revealArtwork(print);
      this.guideMaterials.forEach(material => material.opacity = blend(0.76, 0.12, print));

      const transport = smooth(phase(p, 0.60, 0.70));
      const drive = smooth(phase(p, 0.70, 0.88));
      const roadOpacity = smooth(phase(p, 0.60, 0.66));
      this.road.visible = p > 0.60;
      this.opacity(this.roadMaterials, roadOpacity);
      this.truck.visible = p > 0.60;
      this.opacity(this.truckMaterials, smooth(phase(p, 0.60, 0.65)));
      const routePosition = this.route.getPoint(blend(0.13, 0.71, drive));
      const tangent = this.route.getTangent(blend(0.13, 0.71, drive));
      this.truck.position.set(routePosition.x, routePosition.y + 0.1, routePosition.z);
      this.truck.rotation.y = -Math.atan2(tangent.z, tangent.x);
      this.wheels.forEach(wheel => { wheel.rotation.z = -drive * 28; });
      this.store.visible = p > 0.80;
      this.opacity(this.storeMaterials, smooth(phase(p, 0.80, 0.88)));
      const deliver = smooth(phase(p, 0.88, 0.98));
      this.scene.updateMatrixWorld(true);

      const collection = smooth(phase(p, 0.49, 0.55));
      const boxAside = smooth(phase(p, 0.345, 0.375));
      const hoodieIn = smooth(phase(p, 0.365, 0.39));
      const hoodieAside = smooth(phase(p, 0.397, 0.425));
      const shortIn = smooth(phase(p, 0.425, 0.445));
      const shortAside = smooth(phase(p, 0.445, 0.475));
      const longIn = smooth(phase(p, 0.475, 0.495));

      // Each garment takes the stage at full size before joining the collection.
      const heroPoses = [
        { x: blend(0, -2.45, boxAside), y: blend(0.16, -0.95, boxAside), z: blend(1.35, 0, smooth(phase(p, 0.10, 0.26))), scale: blend(1.22, 0.42, boxAside), rotation: -0.12 },
        { x: blend(0.2, -2.0, hoodieAside), y: blend(0.50, 0.54, hoodieAside), z: 0.25, scale: hoodieIn * blend(1.65, 0.68, hoodieAside), rotation: blend(-0.10, 0.20, hoodieAside) },
        { x: blend(0.50, -0.90, shortAside), y: blend(0.50, -0.20, shortAside), z: blend(0.50, 1.0, shortAside), scale: shortIn * blend(1.65, 0.45, shortAside), rotation: blend(-0.08, -0.15, shortAside) },
        { x: 1.20, y: 0.50, z: 0.50, scale: longIn * 1.50, rotation: -0.12 },
        { x: 3.20, y: 0.86, z: 0.30, scale: 0, rotation: -0.20 }
      ];
      const collectionPoses = [
        { x: -2.9, y: 0.06, z: 0.75, scale: 0.46, rotation: -0.18 },
        { x: -1.50, y: 0.92, z: -0.08, scale: 0.89, rotation: 0.16 },
        { x: 0.12, y: 0.85, z: 0.30, scale: 0.88, rotation: -0.06 },
        { x: 1.72, y: 0.89, z: 0.10, scale: 0.87, rotation: -0.16 },
        { x: 3.20, y: 0.64, z: 0.30, scale: 0.66, rotation: -0.30 }
      ];
      const cargoPoses = [
        { x: -1.55, y: 0.87, z: -0.31, scale: 0.25 },
        { x: -1.54, y: 1.34, z: 0.36, scale: 0.43 },
        { x: -0.70, y: 1.30, z: 0.40, scale: 0.43 },
        { x: 0.10, y: 1.32, z: 0.37, scale: 0.42 },
        { x: -0.65, y: 1.18, z: -0.43, scale: 0.37 }
      ];
      const deliveredPoses = [
        { x: -0.75, y: 0.19, z: 1.72, scale: 0.24 },
        { x: -0.59, y: 1.03, z: 1.25, scale: 0.43 },
        { x: 0.23, y: 1.06, z: 1.25, scale: 0.43 },
        { x: 1.05, y: 1.06, z: 1.25, scale: 0.43 },
        { x: -1.38, y: 0.44, z: 1.32, scale: 0.37 }
      ];

      this.products.forEach((product, index) => {
        const hero = heroPoses[index];
        const display = collectionPoses[index];
        const cargo = cargoPoses[index];
        const arrival = deliveredPoses[index];
        const position = new T.Vector3(blend(hero.x, display.x, collection), blend(hero.y, display.y, collection), blend(hero.z, display.z, collection));
        const cargoPosition = this.truck.localToWorld(new T.Vector3(cargo.x, cargo.y, cargo.z));
        const landing = this.store.localToWorld(new T.Vector3(arrival.x, arrival.y, arrival.z));
        position.lerp(cargoPosition, transport);
        position.y += Math.sin(transport * Math.PI) * (0.72 + index * 0.05);
        position.lerp(landing, deliver);
        position.y += Math.sin(deliver * Math.PI) * (0.50 + index * 0.04);
        product.position.copy(position);
        const displayScale = blend(hero.scale, display.scale, collection);
        const loadedScale = blend(displayScale, cargo.scale, transport);
        product.scale.setScalar(Math.max(0.0001, blend(loadedScale, arrival.scale, deliver)));
        const displayRotation = blend(hero.rotation, display.rotation, collection);
        product.rotation.set(0, blend(blend(displayRotation, this.truck.rotation.y, transport), this.store.rotation.y, deliver), 0);
        product.visible = index === 0 || product.scale.x > 0.002;
      });

      const focusBox = smooth(phase(p, 0.11, 0.27));
      const apparelFocus = smooth(phase(p, 0.35, 0.385));
      const collectionFocus = smooth(phase(p, 0.48, 0.55));
      const journeyFocus = smooth(phase(p, 0.60, 0.70));
      const endFocus = smooth(phase(p, 0.88, 0.99));
      let distance = blend(14.3, 10.6, focusBox);
      distance = blend(distance, 10.6, apparelFocus);
      distance = blend(distance, this.camera.aspect > 1.1 ? 13.5 : 15.7, collectionFocus);
      distance = blend(distance, 17.7, journeyFocus);
      distance = blend(distance, 13.1, endFocus);
      const targetX = blend(blend(0, 0.10, collectionFocus), blend(-1.05, 1.95, drive), journeyFocus);
      const target = new T.Vector3(blend(targetX, 3.70, endFocus), blend(blend(0.20, 0.48, apparelFocus), 0.95, endFocus), 0);
      const nearFront = apparelFocus * (1 - journeyFocus);
      const direction = new T.Vector3(blend(0.40, 0.12, nearFront), blend(0.53, 0.13, nearFront), blend(0.75, 0.99, nearFront)).normalize();
      const fitWidth = Math.max(1, 0.88 / this.camera.aspect);
      this.camera.position.copy(target).add(direction.multiplyScalar(distance * fitWidth));
      this.camera.lookAt(target);
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.fov = width / height < 1.2 ? 44 : 34;
      this.camera.updateProjectionMatrix();
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      const geometries = new Set(), materials = new Set(), textures = new Set();
      this.scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of objectMaterials) {
          if (!material) continue;
          materials.add(material);
          if (material.map) textures.add(material.map);
          if (material.alphaMap) textures.add(material.alphaMap);
          if (material.bumpMap) textures.add(material.bumpMap);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      this.renderer.dispose();
    }
  }
  window.FolioStoryScene = FolioStoryScene;
})();

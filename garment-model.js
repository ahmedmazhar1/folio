// Shared original garment geometry for the editor and scroll story.
// The caller supplies materials and print surfaces. This builder does not own their lifecycle.
(() => {
  'use strict';
  window.FolioGarmentModel = {
    create({ kind = 'hoodie', materials, printMaterial }) {
      const THREE = window.THREE;
      const garmentType = ['hoodie', 'tshirt-short', 'tshirt-long'].includes(kind) ? kind : 'hoodie';
      const { cloth, dark, hoodLining, seamMaterial } = materials;
      const garment = new THREE.Group();
      const targets = [];

      function interpolateProfile(profile) {
        const dense = [];
        for (let j = 0; j < profile.length - 1; j++) for (let k = 0; k < 7; k++) {
          const f = k / 7;
          const a = profile[Math.max(0, j - 1)], b = profile[j];
          const c = profile[j + 1], d = profile[Math.min(profile.length - 1, j + 2)];
          dense.push(b.map((value, col) => col === 0 ? value + f * (c[col] - value) :
            .5 * (2 * value + (-a[col] + c[col]) * f + (2 * a[col] - 5 * value + 4 * c[col] - d[col]) * f * f + (-a[col] + 3 * value - 3 * c[col] + d[col]) * f * f * f)));
        }
        return dense.concat([profile.at(-1)]);
      }

      function clothPoint(row, angle, zone, hood) {
        const [y, cx, cz, rx, rz] = row;
        const sine = Math.sin(angle), cosine = Math.cos(angle);
        // Superelliptic sections give the chest a broad fabric plane and soft side seams.
        const power = zone === 'body' || (!zone && Math.abs(cx) < .01 && y < -.9) ? .68 : .88;
        let x = cx + rx * Math.sign(sine) * Math.pow(Math.abs(sine), power);
        let z = cz + rz * Math.sign(cosine) * Math.pow(Math.abs(cosine), power);
        let height = y;
        function crease(distance, width, depth) {
          return depth * (Math.exp(-Math.pow(distance / width, 2)) - .48 * Math.exp(-Math.pow((distance + width * 1.45) / (width * .8), 2)));
        }
        if (zone === 'body') {
          const front = Math.pow(Math.max(0, cosine), 3), rear = Math.pow(Math.max(0, -cosine), 3);
          const side = Math.pow(Math.abs(sine), 5), sideX = Math.abs(x);
          const seamFade = Math.min(1, Math.max(0, (y + 1.015) / .14));
          const underarm = Math.exp(-Math.pow((sideX - .51) / .16, 2) - Math.pow((y - .14) / .26, 2));
          const lowSide = Math.exp(-Math.pow((sideX - .43) / .17, 2)) * Math.exp(-Math.pow((y + .72) / .29, 2));
          const diagonal = crease(y - .13 + (sideX - .51) * 1.1, .035, .019) * underarm;
          const hip = (crease(y + .68 + (sideX - .42) * .56, .037, .014) + crease(y + .86 - (sideX - .43) * .32, .027, .008)) * lowSide;
          const drape = crease(sideX - .47 + .015 * Math.sin(y * 2), .036, .008) * Math.exp(-Math.pow((y + .38) / .65, 2));
          z += (front - rear) * (diagonal + hip + drape) * seamFade;
          x += Math.sign(sine) * side * .003 * Math.sin(y * 4 + angle) * seamFade;
          height -= .008 * Math.pow(Math.abs(sine), 4) * seamFade;
        } else if (zone) {
          const seamFade = Math.min(1, Math.max(0, (y + .96) / .12));
          const elbow = Math.exp(-Math.pow((y + .38) / .25, 2));
          const lower = Math.exp(-Math.pow((y + .78) / .15, 2));
          const fold = (crease(y + .37 + .075 * cosine, .045, .013) * elbow + crease(y + .79 - .035 * sine, .035, .009) * lower) * seamFade;
          x += sine * fold;
          z += cosine * fold;
        }
        if (garmentType !== 'hoodie' && y > .56 && (zone === 'body' || !zone)) {
          height -= .075 * Math.max(0, cosine) * Math.min(1, (y - .56) / .15);
        }
        return [x, height, z];
      }

      function shell(profile, material, zone, hood = false) {
        const rows = interpolateProfile(profile), positions = [], uv = [], indices = [], columns = 112;
        for (let j = 0; j < rows.length; j++) for (let i = 0; i <= columns; i++) {
          const u = i / columns, angle = (u - .25) * Math.PI * 2;
          positions.push(...clothPoint(rows[j], angle, zone, hood));
          uv.push(u, (rows[j][0] - rows[0][0]) / (rows.at(-1)[0] - rows[0][0]));
          if (i < columns && j < rows.length - 1) {
            const a = j * (columns + 1) + i, b = a + columns + 1;
            indices.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        garment.add(mesh);
        if (zone) {
          mesh.userData.zone = zone;
          mesh.userData.rings = rows.map(row => (row[0] - rows[0][0]) / (rows.at(-1)[0] - rows[0][0]));
          mesh.userData.columns = columns;
          targets.push(mesh);
        }
        return mesh;
      }

      function cord(points, radius, material, closed = false) {
        const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed);
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 3), radius, 6, closed), material);
        mesh.castShadow = true;
        garment.add(mesh);
        return mesh;
      }

      function ringSeam(mesh, row, radius = .0023) {
        const positions = mesh.geometry.attributes.position, columns = 112, points = [];
        const offset = row * (columns + 1);
        for (let i = 0; i < columns; i += 2) points.push([positions.getX(offset + i), positions.getY(offset + i), positions.getZ(offset + i)]);
        return cord(points, radius, seamMaterial, true);
      }

      function makePocket(torso) {
        const positions = [], indices = [], ray = new THREE.Raycaster();
        for (let j = 0; j <= 12; j++) {
          const f = j / 12, y = -.71 + .35 * f;
          const width = .39 - .035 * f - .105 * Math.max(0, (f - .35) / .65);
          for (let i = 0; i <= 40; i++) {
            const x = width * (i / 20 - 1);
            ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
            const contact = ray.intersectObject(torso)[0];
            positions.push(x, y, (contact ? contact.point.z : .22) + .012 + .009 * Math.sin(i * Math.PI / 40));
            const n = j * 41 + i;
            if (i < 40 && j < 12) indices.push(n, n + 1, n + 41, n + 1, n + 42, n + 41);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const pocket = new THREE.Mesh(geometry, cloth);
        pocket.castShadow = pocket.receiveShadow = true;
        garment.add(pocket);
        for (const edge of [0, 40]) {
          const points = [];
          for (let j = 0; j <= 12; j++) {
            const n = (j * 41 + edge) * 3;
            points.push([positions[n], positions[n + 1], positions[n + 2] + .004]);
          }
          cord(points, .0034, dark);
        }
        const hem = [];
        for (let i = 0; i <= 40; i++) hem.push([positions[i * 3], positions[i * 3 + 1] + .012, positions[i * 3 + 2] + .005]);
        cord(hem, .002, seamMaterial);
      }

      const hoodie = garmentType === 'hoodie', short = garmentType === 'tshirt-short';
      const bodyProfile = [
        [-1.015, 0, 0, .565, .196], [-.92, 0, .002, .575, .205], [-.72, 0, .003, .585, .212],
        [-.40, 0, 0, .595, .216], [-.08, 0, 0, .604, .22], [.22, 0, 0, .614, .224],
        [.43, 0, -.004, .625, .218], [.54, 0, -.012, .605, .205], [.63, 0, -.018, .465, .182],
        [.69, 0, -.018, .29, .155], [hoodie ? .725 : .715, 0, -.015, hoodie ? .215 : .245, hoodie ? .141 : .165]
      ];
      const torso = shell(bodyProfile, printMaterial('body'), 'body');
      const hem = shell([[-1.075, 0, 0, .558, .194], [-1.015, 0, 0, .565, .196], [-1.014, 0, 0, .566, .197]], hoodie ? dark : cloth);
      ringSeam(hem, 2);
      ringSeam(hem, 11, .0018);
      for (const sign of [-1, 1]) {
        const zone = sign === 1 ? 'left' : 'right';
        const rows = short ? [
          [.055, .83 * sign, -.006, .15, .15], [.16, .81 * sign, -.006, .16, .16],
          [.32, .74 * sign, -.008, .178, .166], [.46, .65 * sign, -.011, .195, .174],
          [.55, .57 * sign, -.018, .17, .155], [.605, .50 * sign, -.02, .095, .10], [.63, .46 * sign, -.023, .015, .025]
        ] : [
          [-.96, .878 * sign, .022, .10, .103], [-.83, .88 * sign, .018, .126, .13],
          [-.63, .874 * sign, .014, .135, .14], [-.40, .859 * sign, .012, .144, .149],
          [-.18, .836 * sign, .008, .151, .155], [.04, .8 * sign, .004, .16, .164],
          [.24, .748 * sign, -.002, .174, .173], [.43, .665 * sign, -.01, .178, .173],
          [.535, .583 * sign, -.017, .159, .153], [.59, .503 * sign, -.02, .085, .09], [.612, .46 * sign, -.023, .014, .021]
        ];
        const sleeve = shell(rows, printMaterial(zone), zone);
        ringSeam(sleeve, short ? 2 : 5, .0017);
        if (!short) {
          const cuff = shell([[-1.075, sign * .885, .025, .095, .099], [-1.01, sign * .882, .024, .098, .101], [-.959, sign * .878, .022, .102, .105]], hoodie ? dark : cloth);
          ringSeam(cuff, 3);
        }
      }
      if (hoodie) {
        // The empty hood is a flattened fabric bag draped down the upper back.
        const hood = shell([[.255, 0, -.235, .025, .014], [.34, 0, -.24, .13, .025], [.47, 0, -.25, .25, .037], [.625, 0, -.22, .327, .052], [.75, 0, -.19, .33, .058], [.80, 0, -.143, .28, .041]], cloth);
        const centerSeam = [];
        for (let i = 0; i <= 35; i++) {
          const positions = hood.geometry.attributes.position, index = i * 113 + 84;
          centerSeam.push([positions.getX(index), positions.getY(index), positions.getZ(index) - .002]);
        }
        cord(centerSeam, .0018, seamMaterial);
        const collarPositions=[],collarUV=[],collarIndices=[],columns=112,rings=5;
        for(let j=0;j<rings;j++){
          const f=j/(rings-1),rx=.264+(.211-.264)*f,rz=.174+(.137-.174)*f;
          for(let i=0;i<=columns;i++){
            const angle=(i/columns-.25)*Math.PI*2;
            const y=.73-.034*Math.cos(angle)+.009*Math.sin(Math.PI*f);
            collarPositions.push(rx*Math.sin(angle),y,-.015+rz*Math.cos(angle));
            collarUV.push(i/columns,f);
            if(i<columns && j<rings-1){const n=j*113+i;collarIndices.push(n,n+1,n+113,n+1,n+114,n+113)}
          }
        }
        const collarGeometry=new THREE.BufferGeometry();
        collarGeometry.setAttribute('position',new THREE.Float32BufferAttribute(collarPositions,3));
        collarGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(collarUV,2));
        collarGeometry.setIndex(collarIndices);collarGeometry.computeVertexNormals();
        const neckline=new THREE.Mesh(collarGeometry,cloth);neckline.castShadow=neckline.receiveShadow=true;garment.add(neckline);
        ringSeam(neckline,4,.004);
        const neckShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), hoodLining);
        neckShadow.rotation.x = -Math.PI / 2;
        neckShadow.scale.set(.213, .139, 1);
        neckShadow.position.set(0, .653, -.015);
        garment.add(neckShadow);
        makePocket(torso);
        const metal = new THREE.MeshStandardMaterial({ color: 0x59625b, metalness: .72, roughness: .34 });
        for (const sign of [-1, 1]) {
          cord([[sign * .12, .705, .17], [sign * .105, .60, .205], [sign * .12, .42, .23], [sign * .14, .27, .235]], .0085, dark);
          const eyelet = new THREE.Mesh(new THREE.TorusGeometry(.016, .0035, 8, 18), metal);
          eyelet.position.set(sign * .12, .705, .171);
          garment.add(eyelet);
          cord([[sign * .14, .29, .236], [sign * .14, .25, .237]], .009, metal);
        }
      } else {
        // A broad, shallow rib band surrounds the open, front-dipped crew neckline.
        const collarPositions=[],collarUV=[],collarIndices=[],columns=112,rings=6;
        for(let j=0;j<rings;j++){
          const f=j/(rings-1),rx=.285+(.233-.285)*f,rz=.185+(.145-.185)*f;
          for(let i=0;i<=columns;i++){
            const u=i/columns,angle=(u-.25)*Math.PI*2;
            const front=Math.max(0,Math.cos(angle));
            const y=.719-.075*Math.pow(front,1.15)+.006*Math.sin(Math.PI*f);
            collarPositions.push(rx*Math.sin(angle),y,-.016+rz*Math.cos(angle));
            collarUV.push(u,f);
            if(i<columns && j<rings-1){
              const n=j*(columns+1)+i;
              collarIndices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);
            }
          }
        }
        const collarGeometry=new THREE.BufferGeometry();
        collarGeometry.setAttribute('position',new THREE.Float32BufferAttribute(collarPositions,3));
        collarGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(collarUV,2));
        collarGeometry.setIndex(collarIndices);collarGeometry.computeVertexNormals();
        const collar=new THREE.Mesh(collarGeometry,dark);
        collar.castShadow=collar.receiveShadow=true;garment.add(collar);
        ringSeam(collar,0,.0018);ringSeam(collar,5,.0018);
        const opening=new THREE.Mesh(new THREE.CircleGeometry(1,64),hoodLining);
        opening.rotation.x=-Math.PI/2;opening.scale.set(.235,.148,1);
        opening.position.set(0,.608,-.016);garment.add(opening);
        const insidePositions=[],insideIndices=[];
        for(let i=0;i<=columns;i++){
          const angle=(i/columns-.25)*Math.PI*2;
          const x=.233*Math.sin(angle),z=-.016+.145*Math.cos(angle);
          const y=.719-.075*Math.pow(Math.max(0,Math.cos(angle)),1.15);
          insidePositions.push(x,y,z,x*.99,.608,z);
          if(i<columns){const n=i*2;insideIndices.push(n,n+1,n+2,n+1,n+3,n+2)}
        }
        const insideGeometry=new THREE.BufferGeometry();
        insideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(insidePositions,3));
        insideGeometry.setIndex(insideIndices);insideGeometry.computeVertexNormals();
        garment.add(new THREE.Mesh(insideGeometry,hoodLining));
      }
      return { group: garment, targets };
    }
  };
})();

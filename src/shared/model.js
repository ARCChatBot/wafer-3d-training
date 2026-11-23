// The geometry, built from code in each level's own real unit: the wafer and die in millimetres, the wiring in
// micrometres, the transistor and the crystal in nanometres. update(d, t) places every level so the point the camera
// looks at sits at the origin and one world unit is the same real length for every level on screen, then fades the
// level being left and the level arriving. Nothing is keyframed: it all follows journey(d) in kin.js.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DIES, FET, GAP, journey, LAYERS, LIFT, METAL, NSTOP, SEL, SEL_C, SI, stackAt, STOPS, W, WIRE_BLOCK} from './kin.js';

const V3 = THREE.Vector3;
export const VIEWH = 2.0; // world units the field of view spans vertically at the target
export const ACCENT = '#FF6700'; // MI-CHIPS C04 Precision Orange: the part that is working
const UNIT = {macro: 1e-3, wiring: 1e-6, fet: 1e-9, crystal: 1e-9, atom: 1e-9};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

// ------------------------------------------------------------ materials
const mats = [];
const mat = (o, Kind = THREE.MeshStandardMaterial) => {
  const m = new Kind({alphaHash: true, envMapIntensity: 0.5, ...o});
  mats.push(m);
  return m;
};
const INK = new THREE.LineBasicMaterial({color: '#3a3d45', transparent: true, opacity: 0.55});
const outline = (geo) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), INK.clone());

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// One die's floor plan, drawn once: eight cores, a cache, an I/O ring and the scribe frame. Greys only: the colour on
// the wafer comes from the iridescence, like the real thing.
function drawFloorplan(g, n) {
  const r = rng(7);
  const s = n / W.pitch; // px per mm
  g.fillStyle = '#5d626d';
  g.fillRect(0, 0, n, n);
  const die = W.die * s;
  g.fillStyle = '#a9aebb';
  g.fillRect(0, 0, die, die);
  const block = (x, y, w, h, base, lines) => {
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(30,32,38,.35)';
    g.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      const yy = y + (h * (i + 0.5)) / lines;
      g.beginPath();
      g.moveTo(x + 2, yy);
      g.lineTo(x + w - 2, yy);
      g.stroke();
    }
  };
  const m = die * 0.06;
  // eight cores in two rows
  const cw = (die - 2 * m - 3 * m * 0.4) / 4;
  const ch = die * 0.27;
  for (let row = 0; row < 2; row++)
    for (let c = 0; c < 4; c++) {
      const x = m + c * (cw + m * 0.4);
      const y = row === 0 ? m : die - m - ch;
      block(x, y, cw, ch, '#bfc4cf', 0);
      for (let q = 0; q < 6; q++) block(x + 3 + r() * (cw - 30), y + 3 + r() * (ch - 26), 12 + r() * 18, 8 + r() * 14, ['#cdd2dc', '#8f94a1', '#d8dce4'][q % 3], 3);
      block(x + 4, y + ch - 18, cw - 8, 14, '#686d79', 6);
    }
  // the shared cache in the middle: a regular grid
  const cy = m + ch + m * 0.6;
  const chh = die - 2 * (m + ch + m * 0.6);
  g.fillStyle = '#9ca1ad';
  g.fillRect(m, cy, die - 2 * m, chh);
  g.strokeStyle = 'rgba(205,210,220,.35)';
  for (let x = m; x < die - m; x += 6) {
    g.beginPath();
    g.moveTo(x, cy);
    g.lineTo(x, cy + chh);
    g.stroke();
  }
  for (let y = cy; y < cy + chh; y += 9) {
    g.beginPath();
    g.moveTo(m, y);
    g.lineTo(die - m, y);
    g.stroke();
  }
  // I/O pads around the edge
  g.fillStyle = '#b4b8c2';
  for (let i = 0; i < 26; i++) {
    const p = m * 0.25 + (i * (die - m * 0.5)) / 26;
    g.fillRect(p, m * 0.2, 5, 5);
    g.fillRect(p, die - m * 0.2 - 5, 5, 5);
    g.fillRect(m * 0.2, p, 5, 5);
    g.fillRect(die - m * 0.2 - 5, p, 5, 5);
  }
}

// The interference colour of the reference photo: orange at one side through yellow and green to violet, swept
// diagonally across the wafer.
export function rainbow(x, z, out) {
  const u = clamp((x * 0.8 - z * 0.6) / (1.5 * W.r) + 0.5, 0, 1);
  return out.setHSL(0.6 - 0.04 * u, 0.1, 0.7 + 0.06 * u);
}

// ------------------------------------------------------------ level 0..2: wafer, die, exploded stack (mm)
function buildMacro() {
  const root = new THREE.Group();
  const reflective = [];
  const plan = canvasTex(512, 512, drawFloorplan);
  plan.wrapS = plan.wrapT = THREE.RepeatWrapping;
  // the rainbow: film thickness swept across the wafer, so the interference colour drifts as in the photo
  const thick = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, w, 0);
    gr.addColorStop(0, '#202020');
    gr.addColorStop(0.5, '#909090');
    gr.addColorStop(1, '#f0f0f0');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, false);
  const nCell = W.d / W.pitch;
  thick.repeat.set(1 / nCell, 1 / nCell);
  thick.offset.set(0.5, 0.5);
  const waferTop = mat(
    {map: plan, color: '#7d828d', vertexColors: true, roughness: 0.06, metalness: 0.6, iridescence: 0.35, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 720], iridescenceThicknessMap: thick, clearcoat: 1, clearcoatRoughness: 0.03},
    THREE.MeshPhysicalMaterial,
  );
  const silicon = mat({color: '#b4b9c3', roughness: 0.12, metalness: 0.85});
  const siliconDark = mat({color: '#6d727c', roughness: 0.5, metalness: 0.5});

  const top = new THREE.RingGeometry(0.01, W.r, 256, 48);
  top.rotateX(-Math.PI / 2);
  const p = top.attributes.position;
  const uv = top.attributes.uv;
  const cols = new Float32Array(p.count * 3);
  const cc = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i) / W.pitch, -p.getZ(i) / W.pitch);
    rainbow(p.getX(i), p.getZ(i), cc);
    cols.set([cc.r, cc.g, cc.b], i * 3);
  }
  top.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const waferTopMesh = new THREE.Mesh(top, waferTop);
  waferTopMesh.position.y = W.t;
  waferTopMesh.receiveShadow = true;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(W.r, W.r, W.t, 256, 1, true), silicon);
  side.position.y = W.t / 2;
  const bot = new THREE.Mesh(new THREE.CircleGeometry(W.r, 128).rotateX(Math.PI / 2), siliconDark);
  // the bare rim: the edge exclusion
  // the bare rim is polished silicon: a mirror band around the patterned area
  const rimMat = mat({color: '#c6cbd4', roughness: 0.06, metalness: 0.92});
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(W.r - W.edge, W.r, 256).rotateX(-Math.PI / 2),
    rimMat,
  );
  ring.position.y = W.t + 0.02;
  ring.receiveShadow = true;
  const wafer = new THREE.Group();
  wafer.add(waferTopMesh, side, bot, ring);
  // the top only receives: a surface that also casts onto itself shows acne under the lifted die
  for (const m of [side, bot]) m.castShadow = true;
  root.add(wafer);

  // Every complete die as its own tile: the real die photo under a glossy clear coat that catches the studio, with
  // angle-dependent interference colour, and the metal seal ring that frames every real die.
  const photo = new THREE.Texture();
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.anisotropy = 16;
  const tileTop = mat({map: photo, roughness: 0.06, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.35, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 650]}, THREE.MeshPhysicalMaterial);
  const tileSide = mat({color: '#3a3f48', roughness: 0.45, metalness: 0.5});
  reflective.push(waferTop, silicon, rimMat, tileTop);
  const sealMat = mat({color: '#c7a46c', roughness: 0.45, metalness: 1});
  const TH = 0.03; // tile relief, exaggerated from the real few micrometres so each edge catches the light
  const tileGeo = new THREE.BoxGeometry(W.die, TH, W.die).translate(0, TH / 2, 0);
  const SR = 0.14;
  const SH = 0.05;
  const sealGeo = mergeGeometries(
    [[W.die, SR, 0, W.die / 2 - SR / 2], [W.die, SR, 0, -W.die / 2 + SR / 2], [SR, W.die, W.die / 2 - SR / 2, 0], [SR, W.die, -W.die / 2 + SR / 2, 0]].map(([w, d, x, z]) => new THREE.BoxGeometry(w, SH, d).translate(x, SH / 2, z)),
  );
  const tileList = DIES.full.filter(([i, j]) => !(i === SEL[0] && j === SEL[1]));
  const tiles = new THREE.InstancedMesh(tileGeo, [tileSide, tileSide, tileTop, tileSide, tileSide, tileSide], tileList.length);
  const seals = new THREE.InstancedMesh(sealGeo, sealMat, tileList.length);
  {
    const o = new THREE.Object3D();
    const tc = new THREE.Color();
    const white = new THREE.Color(1, 1, 1);
    tileList.forEach(([i, j], n) => {
      const cx = i * W.pitch + W.die / 2;
      const cz = -(j * W.pitch + W.die / 2);
      o.position.set(cx, W.t, cz);
      o.updateMatrix();
      tiles.setMatrixAt(n, o.matrix);
      seals.setMatrixAt(n, o.matrix.clone().setPosition(cx, W.t + TH, cz));
      tiles.setColorAt(n, rainbow(cx, cz, tc).lerp(white, 0.25));
    });
  }
  tiles.receiveShadow = true;
  seals.receiveShadow = true;
  wafer.add(tiles, seals);

  // where the die sat, once it lifts
  const socket = new THREE.Mesh(
    new THREE.PlaneGeometry(W.die, W.die).rotateX(-Math.PI / 2),
    mat({color: '#2c2f36', roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  socket.position.set(SEL_C[0], W.t + 0.03, -SEL_C[1]);
  socket.receiveShadow = true;
  root.add(socket);

  // the die: the substrate plus five plates that rise off its top as it explodes
  const die = new THREE.Group();
  die.position.set(SEL_C[0], 0, -SEL_C[1]);
  root.add(die);
  const planDie = plan.clone();
  planDie.wrapS = planDie.wrapT = THREE.ClampToEdgeWrapping;
  planDie.repeat.set(W.die / W.pitch, W.die / W.pitch);
  planDie.offset.set(0, 1 - W.die / W.pitch);
  planDie.needsUpdate = true;
  const ready = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      // The 3D copy is colour-graded: the photo was shot in polarised light and reads acid green, while silicon under
      // studio light reads neutral and metallic. Desaturate, lift contrast, warm it slightly; the panel keeps the original.
      const im = document.createElement('canvas');
      im.width = img.naturalWidth;
      im.height = img.naturalHeight;
      const g = im.getContext('2d');
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, im.width, im.height);
      const d = px.data;
      const tint = [0.96, 0.99, 1.06];
      for (let q = 0; q < d.length; q += 4) {
        const l = 0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2];
        for (let k = 0; k < 3; k++) {
          const v = d[q + k] + (l - d[q + k]) * 0.96;
          d[q + k] = Math.max(0, Math.min(255, ((v - 128) * 1.45 + 132) * tint[k]));
        }
      }
      g.putImageData(px, 0, 0);
      // three.js allocates fixed-size storage per texture: a bigger image needs the old one released first
      photo.image = im;
      photo.needsUpdate = true;
      for (const t of [plan, planDie]) {
        t.dispose();
        t.image = im;
        t.needsUpdate = true;
      }
      planDie.repeat.set(1, 1);
      planDie.offset.set(0, 0);
      res();
    };
    img.onerror = () => res();
    img.src = 'micro/dieshot.jpg';
  });
  const topMetal = new THREE.Texture();
  topMetal.colorSpace = THREE.SRGBColorSpace;
  topMetal.anisotropy = 16;
  const readyTop = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      topMetal.image = img;
      topMetal.needsUpdate = true;
      res();
    };
    img.onerror = () => res();
    img.src = 'micro/topmetal.jpg';
  });
  const layerTex = {
    fet: canvasTex(512, 512, (g, n) => {
      g.fillStyle = '#80868f';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#6a7079';
      for (let x = 0; x < n; x += 6) g.fillRect(x, 0, 2, n);
      g.fillStyle = '#4e535c';
      for (let y = 0; y < n; y += 16) g.fillRect(0, y, n, 3);
    }),
    ct: canvasTex(512, 512, (g, n) => {
      g.fillStyle = '#d9dde4';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#7d838d';
      for (let y = 4; y < n; y += 12) for (let x = 4; x < n; x += 12) g.fillRect(x, y, 4, 4);
    }),
    lm: canvasTex(512, 512, (g, n) => {
      g.fillStyle = '#dde1e7';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#c4773f';
      const r = rng(3);
      for (let x = 0; x < n; x += 8) {
        let y = 0;
        while (y < n) {
          const l = 30 + r() * 120;
          g.fillRect(x + 1, y, 4, l);
          y += l + 6 + r() * 24;
        }
      }
    }),
    um: canvasTex(512, 512, (g, n) => {
      g.fillStyle = '#dde1e7';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#c4773f';
      for (let y = 6; y < n; y += 32) g.fillRect(0, y, n, 18);
    }),
  };
  const metalMaps = {
    lm: canvasTex(512, 512, (g, n) => {
      g.drawImage(layerTex.lm.image, 0, 0);
      const d = g.getImageData(0, 0, n, n);
      for (let i = 0; i < d.data.length; i += 4) {
        const cu = d.data[i] - d.data[i + 2] > 60 ? 255 : 0;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = cu;
      }
      g.putImageData(d, 0, 0);
    }, false),
    um: canvasTex(512, 512, (g, n) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, n, n);
      g.fillStyle = '#fff';
      for (let y = 6; y < n; y += 32) g.fillRect(0, y, n, 18);
    }, false),
  };
  const sideMat = {
    si: silicon,
    fet: mat({color: '#868c96', roughness: 0.5, metalness: 0.4}),
    ct: mat({color: '#cfd3db', roughness: 0.55, metalness: 0.1}),
    lm: mat({color: '#d7dbe2', roughness: 0.5, metalness: 0.1}),
    um: mat({color: '#d7dbe2', roughness: 0.5, metalness: 0.1}),
    // the passivation as real glass: it refracts the plates beneath
    pa: mat({color: '#eef6f4', roughness: 0.12, metalness: 0, transmission: 1, thickness: 0.6, ior: 1.5, specularIntensity: 1}, THREE.MeshPhysicalMaterial),
  };
  const topMat = {
    si: silicon,
    // real imagery where it exists: the die photographed with its metal stripped off is the transistor layer, and the
    // top-metal photograph is the upper metal; the two layers no photograph shows get relief so their lines catch light
    fet: mat({map: photo, roughness: 0.45, metalness: 0.35}),
    ct: mat({map: layerTex.ct, bumpMap: layerTex.ct, bumpScale: 1.6, roughness: 0.5, metalness: 0.2}),
    lm: mat({map: layerTex.lm, bumpMap: metalMaps.lm, bumpScale: 2.2, roughness: 0.45, metalness: 1, metalnessMap: metalMaps.lm}),
    um: mat({map: topMetal, roughness: 0.45, metalness: 0.55}),
    pa: sideMat.pa,
  };
  const plates = LAYERS.map((L) => {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(W.die, 1, W.die);
    box.translate(0, 0.5, 0);
    const m = new THREE.Mesh(box, [sideMat[L.key], sideMat[L.key], topMat[L.key], sideMat[L.key], sideMat[L.key], sideMat[L.key]]);
    m.castShadow = L.key !== 'pa';
    m.receiveShadow = true;
    const ol = outline(box);
    g.add(m, ol);
    die.add(g);
    return {key: L.key, g, mesh: m, ol, side: sideMat[L.key]};
  });
  // the floor plan as it looks from above, on top of the closed die; fades as the die opens
  const decalMat = tileTop.clone();
  reflective.push(decalMat);
  decalMat.color = rainbow(SEL_C[0], -SEL_C[1], new THREE.Color()).lerp(new THREE.Color(1, 1, 1), 0.25);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(W.die, W.die).rotateX(-Math.PI / 2), decalMat);
  const decalSeal = new THREE.Mesh(sealGeo, sealMat.clone());
  decal.add(decalSeal);
  die.add(decal);

  const accent = new THREE.Color(ACCENT);
  const black = new THREE.Color(0);
  const C0 = new V3(0, 0, 0);
  // mid-stack and the dive point (in the gap above the lower metal) in macro coordinates
  const dieCentre = (lift) => new V3(SEL_C[0], W.t / 2 + LIFT * lift, -SEL_C[1]);
  const stackMid = (e, lift) => {
    const s = stackAt(e);
    const topY = s[5].y + s[5].th;
    return new V3(SEL_C[0], LIFT * lift + topY * 0.5, -SEL_C[1]);
  };
  const diveAt = () => {
    const s = stackAt(1);
    return new V3(SEL_C[0], LIFT + s[3].y + s[3].th + 0.35, -SEL_C[1]);
  };
  return {
    root,
    ready: Promise.all([ready, readyTop]),
    reflective,
    unit: UNIT.macro,
    plates,
    centre(J) {
      // the native point the camera looks at for this depth, when this is the current level
      if (J.d <= 1) return C0.clone().lerp(dieCentre(J.lift), smooth(J.d / 0.55));
      return stackMid(J.explode, 1);
    },
    anchor: diveAt,
    floorY: -4, // a little under the wafer, so the floor never meets its bottom face
    update(J, t) {
      const e = J.explode;
      die.position.y = LIFT * J.lift;
      socket.visible = J.lift > 0.002;
      const st = stackAt(e);
      plates.forEach((P, n) => {
        P.g.position.y = st[n].y;
        P.g.scale.y = st[n].th;
        P.ol.visible = e > 0.02 || n === 0;
        P.ol.material.opacity = 0.5 * (n === 0 ? 1 : smooth(e / 0.3));
      });
      const s = st[5];
      decal.position.y = s.y + s.th + 0.012;
      decal.material.opacity = 1 - smooth(e / 0.35);
      decal.visible = decal.material.opacity > 0.01;
      decalSeal.material.opacity = decal.material.opacity;
      // the working part: at the layer stop the accent walks the stack; on the dive it holds on the lower metal
      const act = activeLayer(J, t);
      plates.forEach((P, n) => {
        const on = n === act ? 1 : 0;
        const m = P.mesh.material[0];
        if (m.emissive) {
          m.emissive.copy(black).lerp(accent, 0.55 * on);
          m.emissiveIntensity = 1;
        }
        P.ol.material.color.set(on ? ACCENT : '#3a3d45');
        P.ol.material.opacity = on ? 0.95 : P.ol.material.opacity;
      });
    },
  };
}
/** Which plate carries the accent: -1 for none. */
export function activeLayer(J, t) {
  if (J.d < 1.6) return -1;
  if (J.d > 2.05) return 3;
  return Math.floor(t / 1.7) % LAYERS.length;
}

// ------------------------------------------------------------ level 3: wiring (um)
function buildWiring() {
  const root = new THREE.Group();
  const r = rng(11);
  // copper as a metal: warm base colour, roughness that varies across the surface like electroplated, polished copper
  const rough = canvasTex(256, 256, (g, n) => {
    const r2 = rng(5);
    const im = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = 150 + r2() * 70 + (Math.sin(i * 0.05) * 10);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, false);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  const copper = mat({color: '#e0956a', roughness: 0.55, roughnessMap: rough, metalness: 1, envMapIntensity: 0.8}, THREE.MeshPhysicalMaterial);
  const via = mat({color: '#d68b60', roughness: 0.5, roughnessMap: rough, metalness: 1, envMapIntensity: 0.8});
  const tungsten = mat({color: '#a3a9b2', roughness: 0.45, metalness: 0.95});
  const siMat = mat({color: '#9aa0ab', roughness: 0.5, metalness: 0.5});
  const B = WIRE_BLOCK;
  const boxes = {cu: [], via: [], w: []};
  const lines = [];
  METAL.forEach((L, li) => {
    const n = Math.floor(B / L.p);
    const segs = [];
    for (let k = 0; k < n; k++) {
      const c = -B / 2 + (k + 0.5) * L.p;
      let s = -B / 2;
      while (s < B / 2 - 0.05) {
        const len = Math.min(B / 2 - s, (0.25 + r() * 0.75) * B * (li < 2 ? 0.45 : li === 2 ? 0.7 : 0.5));
        segs.push({c, s, e: s + len});
        s += len + L.p * (0.6 + r() * 1.2);
      }
    }
    for (const g of segs) {
      const mid = (g.s + g.e) / 2;
      const len = g.e - g.s;
      const box = L.dir === 'x' ? [len, L.h, L.w, mid, L.y0 + L.h / 2, g.c] : [L.w, L.h, len, g.c, L.y0 + L.h / 2, mid];
      boxes.cu.push(box);
    }
    lines.push(segs);
  });
  // vias where a line crosses the line above it, a seeded share of the crossings
  for (let li = 0; li < METAL.length - 1; li++) {
    const A = METAL[li];
    const U = METAL[li + 1];
    for (const a of lines[li])
      for (const u of lines[li + 1]) {
        const x = A.dir === 'x' ? u.c : a.c;
        const z = A.dir === 'x' ? a.c : u.c;
        const along = (seg, v) => v > seg.s + 0.04 && v < seg.e - 0.04;
        if (along(a, A.dir === 'x' ? x : z) && along(u, U.dir === 'x' ? x : z) && r() < 0.22) {
          const s = A.w * 0.9;
          const y0 = A.y0 + A.h;
          boxes.via.push([s, U.y0 - y0, s, x, (y0 + U.y0) / 2, z]);
        }
      }
  }
  // contacts from the lowest metal down to the transistors
  for (const a of lines[0])
    for (let q = 0; q < 3; q++) {
      const v = a.s + 0.05 + r() * (a.e - a.s - 0.1);
      if (v < a.e) boxes.w.push([0.05, METAL[0].y0, 0.05, v, METAL[0].y0 / 2, a.c]);
    }
  // the one contact the camera follows down, at the block centre, in front
  const DIVE = new V3(0.05, 0.02, 0.35);
  boxes.w.push([0.06, METAL[0].y0, 0.06, DIVE.x, METAL[0].y0 / 2, DIVE.z]);
  // rounded edges: real lines are never knife-sharp, and the rounding is what catches a highlight along each wire
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.05);
  const inst = (list, m) => {
    const geo = unitBox;
    const im = new THREE.InstancedMesh(geo, m, list.length);
    const o = new THREE.Object3D();
    list.forEach((b, i) => {
      o.position.set(b[3], b[4], b[5]);
      o.scale.set(b[0], b[1], b[2]);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    root.add(im);
    return im;
  };
  inst(boxes.cu, copper);
  inst(boxes.via, via);
  inst(boxes.w, tungsten);
  const base = new THREE.Mesh(new THREE.BoxGeometry(B, 0.25, B), siMat);
  base.position.y = -0.125;
  base.receiveShadow = true;
  root.add(base, outline(base.geometry).translateY(-0.125));
  return {root, unit: UNIT.wiring, lines, vias: boxes.via, DIVE, centre: () => new V3(0, 1.85, 0), anchor: () => DIVE.clone().setY(0.04), floorY: -0.25, update() {}};
}

// ------------------------------------------------------------ level 4: FinFET (nm)
function buildFet() {
  const root = new THREE.Group();
  const F = FET;
  // silicon a grey semi-metal; the isolation oxide and the nitride spacers as glass you can see the fins through;
  // gates in the gold of titanium nitride, the metal that sets a modern transistor's switching voltage
  const siMat = mat({color: '#8f96a1', roughness: 0.45, metalness: 0.55});
  const oxide = mat({color: '#f2f5f8', roughness: 0.18, metalness: 0, transmission: 1, thickness: 30, ior: 1.46}, THREE.MeshPhysicalMaterial);
  const gateMat = mat({color: '#c3a465', roughness: 0.45, metalness: 1});
  const gateOn = mat({color: '#c3a465', roughness: 0.45, metalness: 1, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0});
  const spacer = mat({color: '#e4e9f0', roughness: 0.25, metalness: 0, transmission: 0.85, thickness: 6, ior: 2.0}, THREE.MeshPhysicalMaterial);
  const epi = mat({color: '#aeb3bd', roughness: 0.45, metalness: 0.5});
  const wMat = mat({color: '#a3a9b2', roughness: 0.45, metalness: 0.95});
  const eMat = mat({color: ACCENT, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0.6, roughness: 0.5});
  const LX = F.gates * F.gatePitch + 20;
  const LZ = F.fins * F.finPitch + 24;
  const add = (geo, m, x, y, z, shadow = true) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    root.add(o);
    return o;
  };
  // substrate and isolation oxide
  add(new THREE.BoxGeometry(LX, 30, LZ), siMat, 0, -F.sti - 15, 0);
  const sti = add(new THREE.BoxGeometry(LX, F.sti, LZ), oxide, 0, -F.sti / 2, 0);
  root.add(outline(sti.geometry).translateY(-F.sti / 2));
  const finZ = [...Array(F.fins)].map((_, i) => (i - (F.fins - 1) / 2) * F.finPitch);
  const gateX = [...Array(F.gates)].map((_, i) => (i - (F.gates - 1) / 2) * F.gatePitch);
  // fins: rounded tops, running along x
  const finGeo = new RoundedBoxGeometry(LX - 6, F.finH + F.sti, F.finW, 3, 3);
  for (const z of finZ) add(finGeo, siMat, 0, (F.finH - F.sti) / 2, z);
  // gates across the fins; the middle one is the switch we watch
  const gTop = F.finH + F.gateH;
  const gates = gateX.map((x, gi) => add(new RoundedBoxGeometry(F.gateL, gTop, LZ - 10, 3, 3), gi === 1 ? gateOn : gateMat, x, gTop / 2, 0));
  for (const x of gateX)
    for (const s of [-1, 1]) {
      const sp = add(new THREE.BoxGeometry(5, gTop, LZ - 10), spacer, x + s * (F.gateL / 2 + 2.5), gTop / 2, 0);
      sp.renderOrder = 1;
    }
  // raised source and drain between the gates: a faceted epitaxial diamond on each fin
  const sdCentres = [];
  for (let i = 0; i < F.gates - 1; i++) sdCentres.push((gateX[i] + gateX[i + 1]) / 2);
  sdCentres.unshift(gateX[0] - F.gatePitch / 2);
  sdCentres.push(gateX[F.gates - 1] + F.gatePitch / 2);
  const diamond = new THREE.OctahedronGeometry(1, 0);
  for (const x of sdCentres)
    for (const z of finZ) {
      const o = add(diamond, epi, x, F.finH - 2, z);
      o.scale.set(14, 16, 13);
    }
  // trench contacts over each source and drain, and the gate contact on the middle gate
  // contacts on the outer source and drain only, so the channel stays in view
  for (const x of [sdCentres[0], sdCentres[sdCentres.length - 1]]) add(new RoundedBoxGeometry(14, 30, LZ - 18, 3, 3), wMat, x, F.finH + 12 + 15, 0);
  add(new RoundedBoxGeometry(12, 30, 12, 3, 3), wMat, gateX[1], gTop + 15, finZ[0] - 2);
  // electrons in the channel under the middle gate (instanced; positions set per frame)
  const NE = 18;
  const elec = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 12, 8), eMat, NE);
  root.add(elec);
  const o = new THREE.Object3D();
  return {
    root,
    unit: UNIT.fet,
    gateX,
    finZ,
    sdCentres,
    centre: () => new V3(0, 42, 0),
    // the dive: the fin's exposed top, just outside the spacer of the middle gate
    anchor: () => new V3(gateX[1] - F.gateL / 2 - 12, F.finH + 0.8, finZ[F.fins - 1]),
    LX,
    LZ,
    gTop,
    floorY: -F.sti - 30,
    update(J, t) {
      const on = gateAt(t);
      gateOn.emissiveIntensity = 0.55 * on;
      // electrons drift source to drain along the fin tops, through the channel, while the gate is on
      for (let i = 0; i < NE; i++) {
        const fin = i % F.fins;
        const ph = ((t * 0.55 + i / NE + fin * 0.13) % 1 + 1) % 1;
        const x = sdCentres[1] + (sdCentres[2] - sdCentres[1]) * ph;
        o.position.set(x, F.finH + 1.8, finZ[fin]);
        o.scale.setScalar(on * smooth(Math.min(ph, 1 - ph) / 0.12));
        o.updateMatrix();
        elec.setMatrixAt(i, o.matrix);
      }
      elec.instanceMatrix.needsUpdate = true;
      void gates;
    },
  };
}
/** Gate drive, 0..1: on for 1.9 s, off for 1.3 s, with soft edges. A pure function of time. */
export const gateAt = (t) => {
  const u = ((t % 3.2) + 3.2) % 3.2;
  return smooth(u / 0.25) * (1 - smooth((u - 1.9) / 0.25));
};

// ------------------------------------------------------------ the electron cloud (nm), shared by the crystal and the atom
// A volume, ray-marched per pixel: a dense core for silicon's ten inner electrons, and four lobes for its four outer
// electrons, pointing along the tetrahedral bond directions (the sp3 shape they take in the crystal). Where the lobes
// of two neighbours meet, the bond appears on its own, as in a real electron-density map. Drawn, not measured: the
// widths are chosen to look like computed densities, and the nucleus is shown far larger than its true size.
const VOL_VERT = /* glsl */ `
uniform vec3 uLobe;
varying vec3 vRo;
varying vec3 vP;
varying vec3 vCol;
varying vec4 vM0;
varying vec4 vM1;
varying vec4 vM2;
varying vec4 vM3;
void main(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
  m = m * instanceMatrix;
  #endif
  vRo = (inverse(m) * vec4(cameraPosition, 1.0)).xyz;
  vP = position;
  vM0 = m[0];
  vM1 = m[1];
  vM2 = m[2];
  vM3 = m[3];
  #ifdef USE_INSTANCING_COLOR
  vCol = instanceColor;
  #else
  vCol = uLobe;
  #endif
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}`;
const VOL_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform float uA;
uniform float uInv;
uniform float uT;
uniform float uR;
uniform float uK;
uniform float uNuc;
uniform mat4 projectionMatrix;
varying vec3 vRo;
varying vec3 vP;
varying vec3 vCol;
varying vec4 vM0;
varying vec4 vM1;
varying vec4 vM2;
varying vec4 vM3;
const vec3 D0 = vec3(0.57735, 0.57735, 0.57735);
const vec3 D1 = vec3(0.57735, -0.57735, -0.57735);
const vec3 D2 = vec3(-0.57735, 0.57735, -0.57735);
const vec3 D3 = vec3(-0.57735, -0.57735, 0.57735);
const float ISO = 0.62;
float lobe(vec3 p, vec3 d){
  float a = dot(p, d);
  vec3 q = p - a * d;
  float u = (a - 0.086) / 0.044;
  return exp(-u * u - dot(q, q) / (0.03 * 0.03));
}
float coreF(vec3 p){
  float r2 = dot(p, p);
  return 7.0 * exp(-r2 / (0.026 * 0.026)) + 1.5 * exp(-r2 / (0.056 * 0.056));
}
float lobeF(vec3 p){
  return 1.35 * (lobe(p, D0) + lobe(p, D1) + lobe(p, D2) + lobe(p, D3));
}
float field(vec3 p){ return coreF(p) + lobeF(p); }
void main(){
  // fades are a fixed per-pixel dither, so a surface that fades out and one that fades in at the same place
  // (the crystal's centre atom handing over to the atom stop) cover exactly complementary pixels: never both, never neither
  float hsh = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (uInv < 0.5 ? hsh >= uA : hsh < 1.0 - uA) discard;
  vec3 rd = normalize(vP - vRo);
  float b = dot(vRo, rd);
  float c = dot(vRo, vRo) - uR * uR;
  float h = b * b - c;
  if (h < 0.0) discard;
  h = sqrt(h);
  float t0 = max(-b - h, 0.0);
  float t1 = -b + h;
  if (t1 <= 0.0) discard;
  // march to the first crossing of the density surface
  const int N = 72;
  float dt = (t1 - t0) / float(N);
  float t = t0;
  float prev = field(vRo + rd * t);
  bool hit = false;
  vec3 ph = vec3(0.0);
  for (int i = 0; i < N; i++){
    float tn = t + dt;
    vec3 p = vRo + rd * tn;
    float f = field(p);
    if (f > ISO){
      float k = clamp((ISO - prev) / max(f - prev, 1e-4), 0.0, 1.0);
      ph = vRo + rd * (t + dt * k);
      hit = true;
      break;
    }
    prev = f;
    t = tn;
  }
  if (!hit) discard;
  // a lit surface: normal from the density gradient, a soft key light from above and a small specular highlight
  float e = 0.0025;
  vec3 n = -normalize(vec3(
    field(ph + vec3(e, 0.0, 0.0)) - field(ph - vec3(e, 0.0, 0.0)),
    field(ph + vec3(0.0, e, 0.0)) - field(ph - vec3(0.0, e, 0.0)),
    field(ph + vec3(0.0, 0.0, e)) - field(ph - vec3(0.0, 0.0, e))));
  vec3 L = normalize(vec3(-0.4, 0.85, 0.35));
  float diff = 0.38 + 0.62 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 36.0) * 0.45;
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.25;
  float lb = lobeF(ph);
  float cr = coreF(ph);
  vec3 base = mix(uCore, vCol, smoothstep(0.25, 0.75, lb / max(lb + cr, 1e-4)));
  float nuc = uNuc * exp(-dot(ph, ph) / (0.03 * 0.03));
  gl_FragColor = vec4(base * diff + vec3(spec) + vec3(rim) + nuc * vec3(1.0, 0.45, 0.3), 1.0);
  // the true depth of the surface, so overlapping atoms hide each other correctly whatever order they are drawn in
  mat4 m = mat4(vM0, vM1, vM2, vM3);
  vec4 clip = projectionMatrix * viewMatrix * m * vec4(ph, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
}`;
const CLOUD_R = 0.2; // nm: the drawn extent of one atom's cloud
function cloudMaterial({core, lobe, k = 9, nuc = 0}) {
  return new THREE.ShaderMaterial({
    vertexShader: VOL_VERT,
    fragmentShader: VOL_FRAG,
    uniforms: {uCore: {value: new THREE.Color(core)}, uLobe: {value: new THREE.Color(lobe)}, uA: {value: 1}, uInv: {value: 0}, uT: {value: 0}, uR: {value: CLOUD_R}, uK: {value: k}, uNuc: {value: nuc}},
    transparent: false,
    depthWrite: true,
    side: THREE.BackSide,
  });
}
const cloudGeo = new THREE.SphereGeometry(CLOUD_R, 24, 16);
// invisible stand-ins that only cast the shadow on the floor
const casterMat = new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false});

// ------------------------------------------------------------ level 5: silicon crystal (nm)
function buildCrystal() {
  const root = new THREE.Group();
  const a = SI.a;
  const n = SI.cells;
  const basis = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
  const pts = [];
  const sub = [];
  const seen = new Set();
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      for (let k = 0; k <= n; k++)
        for (const b of basis)
          for (const off of [0, 0.25]) {
            const q = [i + b[0] + off, j + b[1] + off, k + b[2] + off];
            if (q.some((v) => v > n + 1e-6)) continue;
            const key = q.map((v) => v.toFixed(3)).join(',');
            if (seen.has(key)) continue;
            seen.add(key);
            pts.push(new V3(q[0] * a, q[1] * a, q[2] * a));
            sub.push(off > 0 ? 1 : 0);
          }
  const bonds = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.abs(pts[i].distanceTo(pts[j]) - SI.bond) < 0.004) bonds.push([i, j]);
  const centre = new V3(a, a, a); // an fcc site, the middle of the 2 x 2 x 2 block
  // every atom as a solid electron-density surface; the second sublattice's lobes point the other way (a quarter turn
  // about z). The centre atom is its own mesh, its outer electrons in the accent: it is the atom the journey enters.
  const hotIdx = pts.findIndex((p) => p.distanceTo(centre) < 1e-3);
  const others = pts.map((_, i) => i).filter((i) => i !== hotIdx);
  const cloudMat = cloudMaterial({core: '#56688c', lobe: '#9fb1cf'});
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, others.length);
  const casters = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), casterMat, pts.length);
  const o = new THREE.Object3D();
  const grey = new THREE.Color('#9fb1cf');
  pts.forEach((p, i) => {
    o.position.copy(p);
    o.rotation.set(0, 0, sub[i] ? Math.PI / 2 : 0);
    o.updateMatrix();
    casters.setMatrixAt(i, o.matrix);
  });
  others.forEach((i, q) => {
    o.position.copy(pts[i]);
    o.rotation.set(0, 0, sub[i] ? Math.PI / 2 : 0);
    o.updateMatrix();
    clouds.setMatrixAt(q, o.matrix);
    clouds.setColorAt(q, grey);
  });
  const hotMat = cloudMaterial({core: '#56688c', lobe: ACCENT});
  const hot = new THREE.Mesh(cloudGeo, hotMat);
  hot.position.copy(centre);
  hot.userData.noAO = true;
  clouds.userData.noAO = true;
  casters.castShadow = true;
  root.add(clouds, casters, hot);
  // the unit cell edges, a thin ink cube
  const cell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(a, a, a)), new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.7}));
  cell.position.set(a * 1.5, a * 0.5, a * 1.5);
  root.add(cell);
  return {root, unit: UNIT.crystal, cell, centreAtom: centre, centre: () => centre.clone(), anchor: () => centre.clone(), floorY: -0.16, update(J, t) {
    cloudMat.uniforms.uT.value = t;
    hotMat.uniforms.uT.value = t;
    // the centre atom hands over to the atom stop's surface, which sits exactly on it: the same dither, inverted, so
    // each pixel shows one or the other (the atom stop fades in over z 0.1 to 0.45 on this step)
    if (J.i === 5) {
      hotMat.uniforms.uInv.value = 1;
      hotMat.uniforms.uA.value = 1 - smooth((J.z - 0.1) / 0.35);
    } else hotMat.uniforms.uInv.value = 0;
  }, atoms: pts, bonds};
}

// ------------------------------------------------------------ level 6: one silicon atom (nm)
function buildAtom() {
  const root = new THREE.Group();
  const mat6 = cloudMaterial({core: '#56688c', lobe: ACCENT, k: 15, nuc: 1});
  const cloud = new THREE.Mesh(cloudGeo, mat6);
  cloud.userData.noAO = true;
  cloud.renderOrder = 6;
  root.add(cloud);
  const caster = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), casterMat);
  caster.castShadow = true;
  root.add(caster);
  const DIRS = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => new V3(...v).normalize());
  return {
    root,
    unit: UNIT.atom,
    cloud,
    DIRS,
    centre: () => new V3(0, 0, 0),
    anchor: () => new V3(0, 0, 0),
    floorY: -0.24,
    update(J, t) {
      mat6.uniforms.uT.value = t;
    },
  };
}

// ------------------------------------------------------------ the whole journey
export function buildModel() {
  const levels = [buildMacro(), buildWiring(), buildFet(), buildCrystal(), buildAtom()];
  // stop index -> level index: stops 0..2 share the macro level
  const LV = [0, 0, 0, 1, 2, 3, 4];
  const root = new THREE.Group();
  for (const L of levels) root.add(L.root);
  const setOpacity = (L, a) => {
    L.root.visible = a > 0.01;
    L.root.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (m.userData.base === undefined) m.userData.base = m.opacity;
        m.opacity = m.userData.base * a;
        if (m.uniforms?.uA) m.uniforms.uA.value = a;
      }
    });
  };
  // per-level placement for depth d: world = (native - target) * s
  const place = (J) => {
    const out = levels.map(() => ({a: 0}));
    const sOf = (L) => (VIEWH / J.fov) * L.unit;
    const cur = LV[J.i];
    const nxt = LV[J.i + 1];
    if (cur === nxt) {
      // wafer -> die -> layers: one level, the camera target moves with the die
      const L = levels[cur];
      out[cur] = {a: 1, s: sOf(L), T: L.centre(J)};
      return out;
    }
    const A = levels[cur];
    const B = levels[nxt];
    // the level we leave: pan from its centre to the dive point, then zoom about the dive point
    const restC = cur === 0 ? A.centre({...J, d: 2, explode: 1, lift: 1}) : A.centre(J);
    const TA = restC.clone().lerp(A.anchor(), J.pan);
    const late = J.i < 5;
    const fadeA = late ? 1 - smooth((J.z - 0.7) / 0.22) : 1 - smooth((J.z - 0.3) / 0.35);
    const fadeB = late ? smooth((J.z - 0.5) / 0.26) : smooth((J.z - 0.1) / 0.35);
    out[cur] = {a: fadeA, s: sOf(A), T: TA};
    // the level we arrive at: its centre sits on the dive point, so its target is its centre... offset by the pan
    // residue, mapped into its own units
    const off = restC.clone().sub(A.anchor()).multiplyScalar((1 - J.pan) * (A.unit / B.unit));
    out[nxt] = {a: fadeB, s: sOf(B), T: B.centre(J).add(off)};
    return out;
  };
  return {
    root,
    levels,
    ready: levels[0].ready,
    LV,
    place,
    /** Poses every level for depth d at time t; returns the placements (for labels and the floor). */
    update(d, t) {
      const J = journey(d);
      const P = place(J);
      levels.forEach((L, li) => {
        const p = P[li];
        setOpacity(L, p.a);
        if (p.a <= 0.01) return;
        L.update(J, t);
        L.root.scale.setScalar(p.s);
        L.root.position.copy(p.T).multiplyScalar(-p.s);
      });
      return {J, P};
    },
    /** native point of level li -> world */
    toWorld(li, P, v) {
      const p = P[li];
      return v.clone().sub(p.T).multiplyScalar(p.s);
    },
  };
}
void mergeGeometries;
void NSTOP;
void STOPS;
void DIES;
void SEL;
void GAP;

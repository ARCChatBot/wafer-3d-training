// The studio: a pale cool backdrop, one soft key light with shadows on an invisible floor, a light-box environment
// for the metal, fog so a level we zoom through dissolves into the backdrop, and ground-truth ambient occlusion so
// parts darken where they meet (the cue that makes dense wiring read as real). frame(state, cam) poses the model for
// the depth and draws one frame. The live page drops the occlusion on built-in graphics when frames run long.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildModel, VIEWH} from './model.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#FAFBFD', floor: '#E0E5EC', shadow: '#53617A'}; // MI-CHIPS C08 Soft White, C09, C07
export const FOV_DEG = 28;
// camera distance so the field of view spans VIEWH world units at the target
export const CAM_D = VIEWH / 2 / Math.tan((FOV_DEG * Math.PI) / 360);

export function createStage({canvas, capture = false}) {
  // a standard depth buffer (the occlusion pass reads it); every level is normalised to the same world size, so a
  // near plane of 0.05 keeps enough precision at any depth of the journey
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: capture, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, CAM_D * 2.2, CAM_D * 9);
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 16 / 9, 0.05, 400);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({radius: 0.09, distanceExponent: 1.5, thickness: 0.5, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12});
  // the shadow-only floor stays out of the occlusion pass, or it would darken the backdrop around every part
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  let floorOn = true;
  const noAO = [];
  composer.addPass(new Toggle(() => {
    shade.visible = false;
    for (const o of noAO) {
      o.userData.vis = o.visible;
      o.visible = false;
    }
  }));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => {
    shade.visible = floorOn;
    for (const o of noAO) o.visible = o.userData.vis;
  }));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#8e95a2');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.98, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 3.2);
    box(3, 14, new V3(-12, 4, 6), 3.6);
    box(3, 14, new V3(12, 4, -4), 2.6);
    box(18, 2, new V3(0, 2, 14), 2.2);
    // a warm strip low on one side, so copper and silicon get a second tone
    box(10, 1.4, new V3(-10, 0.5, -10), 1.6);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9ced8', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.4, 0.85, 0.35).normalize();
  const sun = new THREE.DirectionalLight('#fffaf3', 1.7);
  sun.castShadow = true;
  const EXT = 2.6;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.1, far: 30});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  sun.position.copy(SUN_DIR).multiplyScalar(12);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c7ccd6', 1.0));

  // the invisible floor: shadow only
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const model = buildModel();
  scene.add(model.root);
  // The wafer reflects its own studio: dark walls with bright softboxes and strip lights, so its mirror surface shows
  // distinct bars of light that slide across the dies as the view turns, as a polished wafer does under fab lighting.
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#9aa3b0');
    const panel = (w, h, pos, col, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(9, 3.2, new V3(0, 12, -3), '#ffffff', 2.6); // the big overhead softbox
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      panel(1.1, 9, new V3(Math.cos(a) * 11, 6, Math.sin(a) * 11), i % 2 ? '#dfe9ff' : '#fff1de', 6); // a ring of tall strip lights
    }
    panel(14, 0.7, new V3(0, 4, 12), '#ffffff', 3.5); // a long low strip behind the camera
    // the strip the camera sees mirrored in the wafer (opposite its azimuth, at its elevation): a band of light across the dies
    {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      [['#5a3cff', 0], ['#a46bff', 0.22], ['#7fa6ff', 0.45], ['#38d6ff', 0.68], ['#2ff0e0', 0.85], ['#1aa6c8', 1]].forEach(([col, k]) => gr.addColorStop(k, col));
      g.fillStyle = gr;
      g.fillRect(0, 0, 16, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 18), new THREE.MeshBasicMaterial({map: t, color: new THREE.Color(1, 1, 1).multiplyScalar(4.2), side: THREE.DoubleSide}));
      m.position.set(-5.4, 7.6, -9.6);
      m.lookAt(0, 0, 0);
      m.rotateZ(-0.75);
      env.add(m);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#7d8796', side: THREE.DoubleSide}));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    env.add(floor);
    const pm = new THREE.PMREMGenerator(renderer);
    const refl = pm.fromScene(env, 0.01).texture;
    pm.dispose();
    for (const m of model.levels[0].reflective) {
      m.envMap = refl;
      m.envMapIntensity = 1.15;
      m.needsUpdate = true;
    }
  }
  model.root.traverse((o) => o.userData.noAO && noAO.push(o));

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  let last = null;
  // st: {d (depth), t (seconds, for things that move on their own)}
  // cam: {az, el (radians), k (distance factor), sx, sy (px view offset)}
  const frame = (st, cam) => {
    last = model.update(st.d, st.t);
    const {J, P} = last;
    // the floor under whichever level is in front; it dips out while the levels swap
    const li = model.LV[J.i];
    const ln = model.LV[J.i + 1];
    const useNext = li !== ln && J.z > 0.62;
    const L = useNext ? ln : li;
    const p = P[L];
    const fy = (model.levels[L].floorY - p.T.y) * p.s;
    shade.position.y = fy;
    const swap = li !== ln ? smoothAbs(J.z - 0.62, 0.16) : 1;
    shade.material.opacity = 0.22 * swap * Math.min(1, Math.max(0, (2.6 + fy) / 1.2));
    const d = CAM_D * (cam.k ?? 1);
    camera.position.set(d * Math.cos(cam.el) * Math.sin(cam.az), d * Math.sin(cam.el), d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    // blended volumes draw back to front: re-sort any level that asks, in its own coordinates
    for (const lv of model.levels)
      if (lv.sort && lv.root.visible) {
        lv.root.updateMatrixWorld(true);
        lv.sort(lv.root.worldToLocal(camera.position.clone()));
      }
    composer.render();
    return last;
  };
  const pv = new V3();
  const project = (v) => {
    pv.copy(v).project(camera);
    if (pv.z > 1 || pv.z < -1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({shadow, ao, samples}) => {
    if (ao !== undefined) gtao.enabled = ao;
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  void floorOn;
  return {renderer, scene, camera, composer, gtao, model, resize, frame, project, size, setQuality, sun, get last() {
    return last;
  }};
}
function smoothAbs(x, w) {
  const u = Math.min(1, Math.abs(x) / w);
  return u * u * (3 - 2 * u);
}

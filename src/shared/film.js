// The wafer journey as a film: the operator walks the seven stops from the whole wafer to one atom, turns the labels
// on, and orbits the atom before diving back out. render(t) is a pure function of t; live.js plays the same SCRIPT
// as its auto tour.
import * as THREE from 'three';
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole, DISPLAY} from './console.js';
import {DIES, FET, journey, LAYERS, LIFT, METAL, NSTOP, SEL_C, SI, stackAt, W} from './kin.js';
import {activeLayer, gateAt} from './model.js';
import {createStage} from './stage.js';

const V3 = THREE.Vector3;
export const SCRIPT = [
  {t: 0, go: 0},
  {t: 1.4, display: 'labels'},
  {t: 4.6, go: 1},
  {t: 8.6, go: 2},
  {t: 14.2, go: 3},
  {t: 19.4, go: 4},
  {t: 24.6, go: 5},
  {t: 29.2, go: 6},
  {t: 32.2, display: 'orbit'},
  {t: 36.6, display: 'orbit'},
  {t: 37.0, go: 0},
];
export const DURATION = 43;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'wafer', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const easeIO = (x) => {
  const k = clamp(x, 0, 1);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

// ------------------------------------------------------------ depth along the film
/** seconds a move of |dd| stops takes; the long return is quicker per stop */
export const moveDur = (dd) => (Math.abs(dd) > 1.5 ? 1.2 + 0.75 * Math.abs(dd) : 3.0 * Math.abs(dd));
const GOES = SCRIPT.filter((e) => e.go !== undefined);
export const depthAt = (t) => {
  let d = GOES[0].go;
  for (let i = 1; i < GOES.length; i++) {
    const e = GOES[i];
    if (t < e.t) break;
    const from = d;
    d = from + (e.go - from) * easeIO((t - e.t) / moveDur(e.go - from));
  }
  return d;
};
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  out.micro = 1;
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.6) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};

// ------------------------------------------------------------ the camera: a 3/4 view per stop, blended by depth
// [azimuth, elevation] in degrees, sy = vertical view offset in px
export const VIEWS = [[28, 36], [36, 32], [44, 15], [38, 26], [24, 50], [34, 20], [12, 14]];
export const camAt = (d, t, orbitT = 0) => {
  const J = journey(d);
  const a = VIEWS[J.i];
  const b = VIEWS[J.i + 1];
  const k = smoother(J.k);
  const az = a[0] + (b[0] - a[0]) * k + 5 * Math.sin((t * Math.PI * 2) / 36) + orbitT * 22;
  const el = a[1] + (b[1] - a[1]) * k;
  return {az, el, k: 1, sx: 0, sy: -22};
};

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 470], [760, 420], [940, 520], [820, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: e.go !== undefined ? ui.spots[`s${e.go}`] : ui.spots[e.display]}));
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.5, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ labels: native points of each level, per stop
export function makeLabels(st) {
  const [macro, wiring, fet, crystal, atom] = st.model.levels;
  const sx = SEL_C[0];
  const sz = -SEL_C[1];
  // a partial die toward the front of the wafer, and an ordinary die left of centre
  const front = DIES.partial
    .map(([i, j]) => [(i + 0.5) * W.pitch, -(j + 0.5) * W.pitch])
    .filter(([x, z]) => Math.hypot(x, z) < W.r - 4)
    .sort((A, B) => B[1] + B[0] * 0.3 - (A[1] + A[0] * 0.3))[0];
  const rim = (deg, r = W.r) => new V3(r * Math.cos(deg * D2R), W.t, r * Math.sin(deg * D2R));
  const plate = (n) => (J) => {
    const s = stackAt(J.explode)[n];
    return new V3(sx + W.die / 2, LIFT * J.lift + s.y + s.th / 2, sz + W.die / 2);
  };
  const lineAt = (li, pick) => {
    const L = METAL[li];
    const segs = wiring.lines[li];
    const seg = pick(segs);
    const mid = (seg.s + seg.e) / 2;
    return L.dir === 'x' ? new V3(mid, L.y0 + L.h, seg.c) : new V3(seg.c, L.y0 + L.h, mid);
  };
  const frontmost = (segs) => segs.reduce((a, b) => (b.c > a.c || (b.c === a.c && b.e - b.s > a.e - a.s) ? b : a));
  const rightmost = (segs) => segs.filter((s) => s.e > 0.8).reduce((a, b) => (b.c > a.c ? b : a));
  const P = [
    // stop 0
    {stop: 0, L: macro, name: 'SILICON WAFER', sub: '300 MM · 0.775 MM THICK', at: () => rim(165)},
    {stop: 0, L: macro, name: 'THE DIE WE OPEN', sub: '18.4 MM SQUARE', at: () => new V3(sx, W.t, sz)},
    {stop: 0, L: macro, name: 'SCRIBE LANE', sub: '0.1 MM · CUT LINE', at: () => new V3(-2 * W.pitch, W.t, 1.5 * W.pitch)},
    {stop: 0, L: macro, name: 'EDGE EXCLUSION', sub: '3 MM BARE RIM', at: () => rim(52, W.r - 1.5)},
    {stop: 0, L: macro, name: 'PARTIAL DIE', sub: 'CROSSES THE RIM · SCRAPPED', at: () => new V3(front[0], W.t, front[1])},
    // stop 1
    {stop: 1, L: macro, name: 'DIE', sub: '18.4 × 18.4 MM', at: (J) => new V3(sx - 3, LIFT * J.lift + W.t, sz - 3)},
    {stop: 1, L: macro, name: 'SILICON BODY', sub: '0.775 MM THICK', at: (J) => new V3(sx + W.die / 2, LIFT * J.lift + W.t / 2, sz + 2)},
    {stop: 1, L: macro, name: 'WHERE IT WAS PRINTED', sub: 'THE WAFER STAYS WHOLE UNTIL DICING', at: () => new V3(sx - 4, W.t, sz + 6)},
    // stop 2: the six layers
    ...LAYERS.map((Ly, n) => ({stop: 2, L: macro, name: Ly.name, sub: Ly.sub, layer: n, at: plate(n)})),
    // stop 3
    ...METAL.map((Ly, li) => ({stop: 3, L: wiring, name: Ly.name, sub: `${Ly.w} µM WIDE · ${Ly.h} µM THICK`, at: () => lineAt(li, Ly.dir === 'x' ? frontmost : rightmost)})),
    {stop: 3, L: wiring, name: 'VIA', sub: 'JOINS ONE LEVEL TO THE NEXT', at: () => {
      const v = wiring.vias.reduce((a, b) => (b[5] + b[3] > a[5] + a[3] ? b : a));
      return new V3(v[3], v[4], v[5]);
    }},
    {stop: 3, L: wiring, name: 'CONTACT', sub: 'DOWN TO A TRANSISTOR', at: () => wiring.DIVE.clone().setY(0.12)},
    // stop 4
    {stop: 4, L: fet, name: 'GATE', sub: `${FET.gateL} NM LONG · THE SWITCH`, gate: true, at: () => new V3(fet.gateX[1], fet.gTop, fet.LZ / 2 - 8)},
    {stop: 4, L: fet, name: 'FIN', sub: `${FET.finW} NM WIDE · ${FET.finH} NM TALL`, at: () => new V3(-fet.LX / 2 + 6, FET.finH * 0.6, fet.finZ[FET.fins - 1])},
    {stop: 4, L: fet, name: 'SOURCE', sub: 'ELECTRONS ENTER', at: () => new V3(fet.sdCentres[1], FET.finH + 8, fet.finZ[FET.fins - 1] + 6)},
    {stop: 4, L: fet, name: 'DRAIN', sub: 'ELECTRONS LEAVE', at: () => new V3(fet.sdCentres[2], FET.finH + 8, fet.finZ[FET.fins - 1] + 6)},
    {stop: 4, L: fet, name: 'CONTACT', sub: 'TUNGSTEN', at: () => new V3(fet.sdCentres[3], FET.finH + 64, fet.LZ / 2 - 9)},
    {stop: 4, L: fet, name: 'ISOLATION OXIDE', sub: 'KEEPS FINS APART', at: () => new V3(fet.LX / 2 - 12, -4, fet.LZ / 2)},
    // stop 5
    {stop: 5, L: crystal, name: 'ONE SILICON ATOM', sub: 'ITS ELECTRON CLOUD, BONDED TO FOUR', hot: true, at: () => crystal.centreAtom.clone().add(new V3(0, 0.08, 0))},
    {stop: 5, L: crystal, name: 'COVALENT BOND', sub: `SHARED ELECTRONS · ${SI.bond.toFixed(3)} NM`, at: () => crystal.centreAtom.clone().addScalar(SI.a * 0.125)},
    {stop: 5, L: crystal, name: 'UNIT CELL', sub: `${SI.a} NM CUBE`, at: () => new V3(2 * SI.a, SI.a, 2 * SI.a)},
    // stop 6
    {stop: 6, L: atom, name: 'NUCLEUS', sub: '14 PROTONS · 14 NEUTRONS', at: () => new V3(0, 0.012, 0)},
    {stop: 6, L: atom, name: 'INNER ELECTRONS', sub: '10 · PACKED CLOSE TO THE NUCLEUS', at: () => new V3(-0.045, -0.02, 0.03)},
    {stop: 6, L: atom, name: 'OUTER ELECTRONS', sub: '4 · LOBES THAT REACH THE NEIGHBOURS', hot: true, at: () => atom.DIRS[0].clone().multiplyScalar(0.1)},
    {stop: 6, L: atom, name: 'BOND TO A NEIGHBOUR', sub: 'ONE OF FOUR, 0.235 NM AWAY', at: () => atom.DIRS[2].clone().multiplyScalar(0.12)},
  ];
  const sideOf = new Map();
  return (J, t, o) => {
    if (o < 0.02) return [];
    const near = J.near;
    const k = 1 - ss(0.04, 0.16, Math.abs(J.d - near));
    if (k <= 0.01) return [];
    const act = activeLayer(J, t);
    const pts = P.filter((p) => p.stop === near)
      .map((p) => {
        const obj = p.obj ? p.obj() : p.L.root;
        const w = obj.localToWorld(p.at(J));
        const at = st.project(w);
        const on = (p.layer !== undefined && p.layer === act) || (p.gate && gateAt(t) > 0.5) || !!p.hot;
        return {p, at, on};
      })
      .filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1270 && x.at[1] > 110 && x.at[1] < 740);
    // a label changes column only once its part is well past the middle, so labels near the centre do not flicker
    for (const x of pts) {
      const k = x.p.name + x.p.stop;
      const was = sideOf.get(k);
      const side = x.at[0] < 740 ? 'L' : x.at[0] > 860 ? 'R' : was || (x.at[0] < 800 ? 'L' : 'R');
      sideOf.set(k, side);
      x.side = side;
    }
    const L = pts.filter((x) => x.side === 'L').sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.side === 'R').sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 130;
      for (const c of col) {
        y = Math.max(y, Math.min(706, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o: o * k, on: c.on});
        y += 38;
      }
    };
    stack(L, 340, 190);
    stack(R, 1080, 190);
    return out;
  };
}

export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (t, s) => {
    ui.update({J: s.J, display: s.display, paused: s.paused ?? false, speed: s.speed ?? 1, speedK: s.speedK ?? 0.5, callouts: labels(s.J, t, s.labels), cursor: s.cursor, locked: s.locked ?? null});
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas, capture});
    await st.model.ready;
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.WS = st;
    return {
      resize,
      render(t) {
        const d = depthAt(t);
        const disp = displayAt(t);
        const orbitT = disp.orbit ? Math.max(0, t - lastFlip('orbit', t)) : 0;
        const cam = camAt(d, t, orbitT);
        const {J} = st.frame({d, t}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        frame(t, {J, display: disp, labels: easedDisplay('labels', t, 0.5), cursor: cursorAt(t)});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
void NSTOP;

// The numbers. Real dimensions in real units and one input, the depth d (0 = the whole wafer, 6 = one atom).
// Every pose, every scale and every readout on the console is a function of d, so nothing on screen can disagree.
// No three.js in here.

// ------------------------------------------------------------ the wafer (millimetres)
export const W = {
  d: 300, // SEMI standard 300 mm wafer
  t: 0.775, // SEMI M1 thickness for 300 mm
  edge: 3, // edge exclusion: the outer rim no chip may use
  die: 18.4, // square die, matching the ~18.5 mm pitch measured from the reference photo
  scribe: 0.1, // scribe lane between dies
};
W.r = W.d / 2;
W.pitch = W.die + W.scribe; // 18.5 mm

// Die grid: die (i, j) spans x in [i, i+1] * pitch, z likewise, so the wafer centre sits on a lane crossing.
export function dieMap() {
  const full = [];
  const partial = [];
  const n = Math.ceil(W.r / W.pitch) + 1;
  const rIn = W.r - W.edge;
  for (let i = -n; i < n; i++)
    for (let j = -n; j < n; j++) {
      const xs = [i * W.pitch, i * W.pitch + W.die];
      const zs = [j * W.pitch, j * W.pitch + W.die];
      const corners = xs.flatMap((x) => zs.map((z) => Math.hypot(x, z)));
      const far = Math.max(...corners);
      // nearest point of the die square to the centre
      const nx = Math.max(xs[0], Math.min(0, xs[1]));
      const nz = Math.max(zs[0], Math.min(0, zs[1]));
      const near = Math.hypot(nx, nz);
      if (far <= rIn) full.push([i, j]);
      else if (near < W.r) partial.push([i, j]);
    }
  return {full, partial};
}
export const DIES = dieMap();
// The die we take apart: one column right of centre, just above the middle row.
export const SEL = [1, 0];
export const SEL_C = [(SEL[0] + 0.5) * W.pitch - W.scribe / 2, (SEL[1] + 0.5) * W.pitch - W.scribe / 2];
export const LIFT = 10; // mm the die rises out of the wafer

// The exploded die. Display thicknesses are exaggerated (the real stack above the silicon is about 10 um in all);
// REAL holds the true thickness each label quotes.
export const LAYERS = [
  {key: 'si', name: 'SILICON SUBSTRATE', sub: '775 µM OF SINGLE CRYSTAL', show: W.t},
  {key: 'fet', name: 'TRANSISTORS', sub: 'BUILT INTO THE TOP 0.1 µM', show: 0.34},
  {key: 'ct', name: 'CONTACTS', sub: 'TUNGSTEN PLUGS', show: 0.3},
  {key: 'lm', name: 'LOWER METAL', sub: 'FINE COPPER · LOGIC WIRING', show: 0.34},
  {key: 'um', name: 'UPPER METAL', sub: 'THICK COPPER · POWER, CLOCK', show: 0.5},
  {key: 'pa', name: 'PASSIVATION', sub: 'NITRIDE + OXIDE SEAL · ~1 µM', show: 0.3},
];
export const GAP = 2.4; // mm between plates when fully exploded

/** Bottom y (mm, die-local, substrate bottom = 0) and thickness of each layer at explode e (0..1). */
export function stackAt(e) {
  const out = [];
  let y = 0;
  LAYERS.forEach((L, n) => {
    const th = n === 0 ? L.show : 0.004 + (L.show - 0.004) * e;
    if (n > 0) y += GAP * e;
    out.push({y, th});
    y += th;
  });
  return out;
}

// ------------------------------------------------------------ the deep levels
// Wiring, typical intermediate-to-upper copper levels (micrometres). w = line width, p = pitch, h = thickness,
// y0 = bottom; the direction alternates layer to layer.
export const METAL = [
  {name: 'METAL 4', w: 0.1, p: 0.2, h: 0.2, y0: 0.3, dir: 'x'},
  {name: 'METAL 5', w: 0.2, p: 0.4, h: 0.36, y0: 0.72, dir: 'z'},
  {name: 'METAL 6', w: 0.4, p: 0.8, h: 0.7, y0: 1.38, dir: 'x'},
  {name: 'METAL 7', w: 0.8, p: 1.6, h: 1.2, y0: 2.5, dir: 'z'},
];
export const WIRE_BLOCK = 4; // um square block

// FinFET, typical 7 nm-class dimensions (nanometres). Representative published values, not one product.
export const FET = {
  finPitch: 30,
  finW: 7,
  finH: 45, // above the isolation oxide
  gatePitch: 57, // contacted poly pitch
  gateL: 20,
  gateH: 50, // above the fin top
  sti: 30, // isolation oxide depth shown
  fins: 3,
  gates: 3,
};

// Silicon, diamond cubic (nanometres). a from CODATA; bond = a*sqrt(3)/4.
export const SI = {a: 0.5431, bond: (0.5431 * Math.sqrt(3)) / 4, cells: 2, Z: 14, shells: [2, 8, 4]};

// ------------------------------------------------------------ the journey
// fov: the real height of the field of view at each stop, metres. Between stops the zoom is exponential, so the
// scale bar moves at a constant rate in powers of ten.
export const STOPS = [
  {key: 'wafer', name: 'WAFER', fov: 0.3},
  {key: 'die', name: 'DIE', fov: 0.03},
  {key: 'layers', name: 'LAYERS', fov: 0.036},
  {key: 'wiring', name: 'WIRING', fov: 7.4e-6},
  {key: 'fet', name: 'TRANSISTOR', fov: 3.0e-7},
  {key: 'crystal', name: 'CRYSTAL', fov: 2.3e-9},
  {key: 'atom', name: 'ATOM', fov: 5.4e-10},
];
export const NSTOP = STOPS.length;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

/**
 * Everything the frame needs from the depth d: which levels are on screen, how far through the step we are,
 * the zoom progress, the real field of view, the die lift and the explode.
 */
export function journey(d) {
  const D = clamp(d, 0, NSTOP - 1);
  const i = Math.min(NSTOP - 2, Math.floor(D));
  const k = D - i;
  // pan first (to the point we dive into), zoom after, so the dive never whips sideways
  const pan = smooth(k / 0.32);
  const z = clamp((k - 0.14) / 0.86, 0, 1);
  const lnF = Math.log(STOPS[i].fov) + (Math.log(STOPS[i + 1].fov) - Math.log(STOPS[i].fov)) * (i === 1 ? k : i === 0 ? smooth((k - 0.05) / 0.95) : z);
  const fov = Math.exp(lnF);
  const lift = D >= 1 ? 1 : smooth(D / 0.6);
  const explode = D <= 1 ? 0 : D >= 2 ? 1 : smooth((D - 1) / 0.9);
  return {d: D, i, k, pan, z: i === 0 ? smooth((k - 0.05) / 0.95) : i === 1 ? k : z, fov, lift, explode, mag: STOPS[0].fov / fov, near: Math.round(D)};
}

// ------------------------------------------------------------ hand checks (shown on the console)
export const CHECK = {
  // dies per wafer, the textbook estimate pi r^2 / A - pi d / sqrt(2A), against the count from the grid above
  estimate: Math.round((Math.PI * W.r * W.r) / (W.pitch * W.pitch) - (Math.PI * W.d) / Math.sqrt(2 * W.pitch * W.pitch)),
  full: DIES.full.length,
  partial: DIES.partial.length,
  // atoms across the wafer along a cube edge: one every a/2
  across: W.d * 1e-3 / ((SI.a / 2) * 1e-9),
  // silicon atom density, 8 atoms per cubic cell: 5.0e22 per cm3 is the handbook value
  density: 8 / Math.pow(SI.a * 1e-7, 3),
};

/** A length in metres as a readable string with the right unit. */
export function fmtLen(m) {
  const units = [[1, 'm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm']];
  for (const [u, s] of units) {
    if (m >= u * 0.999) {
      const v = m / u;
      return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${s}`;
    }
  }
  return `${(m / 1e-9).toFixed(2)} nm`;
}

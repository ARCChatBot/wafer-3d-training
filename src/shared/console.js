// The console, laid out at 1600 x 900: the Si badge and title, the live scale (field of view, magnification, a ruler
// from one metre to a tenth of a nanometre), the stop panel, the seven stops, the display toggles, the real
// micrograph for the stop, the journey timeline and the labels with leaders into the model. update(s) redraws
// every live part from the frame's state.
import {LESSON} from './edu.js';
import {CHECK, fmtLen, NSTOP, STOPS} from './kin.js';

// MI-CHIPS palette: C01 ink, C07 label slate, C09 dividers, C03 Trojan Blue for headings and controls, C04 orange as a small accent
export const C = {ink: '#0B0F19', mute: '#53617A', faint: '#E0E5EC', line: '#E0E5EC', panel: 'rgba(255,255,255,.96)', or: '#FF6700', blue: '#00358E', frost: '#E3EDFC', green: '#2f9e6b'};
export const DISPLAY = ['labels', 'orbit', 'micro'];
export const DISPLAY_LABEL = {labels: 'LABELS', orbit: 'ORBIT', micro: 'MICROGRAPH'};

export const INFO = [
  {title: '300 mm silicon wafer', text: 'A slice of one flawless silicon crystal, polished to a mirror. Every square is a complete chip, printed hundreds at a time. The rainbow is light interfering in films a few hundred nanometres thick.', stats: [['300 mm', 'DIAMETER'], ['0.775 mm', 'THICK'], [String(CHECK.full), 'FULL DIES']]},
  {title: 'One die', text: 'Each die is one chip. In the fab it is cut free only after every die on the wafer has been tested; here it is lifted out to show it. The dark square is where it was printed.', stats: [['18.4 mm', 'SIDE'], ['339 mm²', 'AREA'], ['0.1 mm', 'SCRIBE LANE']]},
  {title: 'The stack', text: 'A chip is built upward: transistors in the silicon surface, tungsten contacts, then ten or more copper layers, sealed under glass. Here each layer is stretched hundreds of times so you can see it.', stats: [['~10 µm', 'ABOVE THE SI'], ['775 µm', 'SILICON'], ['10+', 'METAL LAYERS']]},
  {title: 'Copper wiring', text: 'Four of the copper levels. Each runs at right angles to the one below and is joined to it by vias. The lower the level, the finer the wire: 0.1 µm wide at the bottom here, 0.8 µm at the top.', stats: [['0.1 µm', 'FINEST HERE'], ['0.8 µm', 'WIDEST HERE'], ['4', 'LEVELS SHOWN']]},
  {title: 'A transistor is a switch', text: 'Three silicon fins run under three gates. Voltage on the middle gate lets electrons cross the channel from source to drain; remove it and they stop. Typical 7 nm-class dimensions.', stats: [['20 nm', 'GATE LENGTH'], ['7 nm', 'FIN WIDTH'], ['57 nm', 'GATE PITCH']]},
  {title: 'The silicon crystal', text: 'Each atom is drawn as its electron cloud. Every atom bonds to four neighbours, the pattern of diamond, and the bonds show where the clouds of neighbours meet. The orange cube is one unit cell; it repeats unbroken across the whole wafer.', stats: [['0.543 nm', 'UNIT CELL'], ['0.235 nm', 'BOND'], ['5.0×10²²', 'ATOMS / CM³']]},
  {title: 'One silicon atom', text: 'Its 14 electrons as a cloud: 10 packed tight around the nucleus, and 4 outer electrons in lobes aimed at the four neighbours they bond with. A computed-style picture, not a photograph; the nucleus at the centre is drawn thousands of times too big.', stats: [['14', 'PROTONS'], ['2 · 8 · 4', 'ELECTRONS'], ['1.1×10⁹', 'ATOMS ACROSS']]},
];
// real images for some stops: the visitor's reference photo and three Wikimedia Commons micrographs
export const MICRO = [
  {src: 'wafer.jpg', kind: 'PHOTO', cap: 'THE REFERENCE PHOTO THIS MODEL WAS BUILT FROM. THE DIES ON THE MODEL USE THE REAL DIE PHOTO AT STOP 02'},
  {src: 'micro/dieshot.jpg', kind: 'MICROSCOPE', cap: 'RYZEN 5 9600X COMPUTE DIE, METAL REMOVED: 8 CORES AND THE CACHE BETWEEN · FRITZCHENS FRITZ · CC0'},
  {src: 'micro/topmetal.jpg', kind: 'MICROSCOPE 50×', cap: 'TOP METAL LAYER OF THE SAME DIE: THICK POWER WIRING AND PADS · FRITZCHENS FRITZ · CC0'},
  {src: 'micro/wiring.jpg', kind: 'SEM ×10,000', cap: 'COPPER WIRE, ELECTROMIGRATION VOIDS · P.-E. ZÖRNER · CC BY-SA 3.0'},
  {src: 'micro/transistors.jpg', kind: 'SEM', cap: 'MEMORY CELLS ON AN STM32 CHIP, EACH SIX 180 NM TRANSISTORS · ZEPTOBARS · CC BY 3.0'},
  {src: 'micro/crystal.png', kind: 'STEM', cap: 'NiSi₂ ON SILICON, ATOM COLUMNS · UFALKE / SUPERSTEM · CC BY-SA 3.0'},
  {src: 'micro/atoms.png', kind: 'STM', cap: 'SILICON ATOMS ON SiC · G. BAFFOU · CC BY-SA 3.0'},
];

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(11,15,25,.06)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:23px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;box-sizing:border-box}
.call{position:absolute;white-space:nowrap;background:rgba(250,251,253,.92);padding:4px 7px;border-radius:3px;margin:-4px -7px;pointer-events:auto;cursor:pointer;border:1px solid transparent}
.call:hover{border-color:${C.blue};background:#fff}
.call b em{font-style:normal;display:inline-grid;place-items:center;width:12px;height:12px;border-radius:50%;border:1px solid currentColor;font-size:8px;margin-left:2px}
.learn{position:absolute;width:300px;background:#fff;border:1px solid ${C.line};border-left:3px solid ${C.or};border-radius:6px;box-shadow:0 10px 30px rgba(11,15,25,.16);padding:14px 16px;pointer-events:auto;z-index:40;box-sizing:border-box}
.learn[hidden]{display:none}
.learn h4{margin:0 0 6px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:${C.blue}}
.learn p{margin:0;font-size:13px;line-height:1.5;color:#0B0F19}
.learn button{position:absolute;right:8px;top:6px;border:0;background:none;font-size:16px;line-height:1;color:${C.mute};cursor:pointer;padding:4px}
.learn button:focus-visible{outline:2px solid ${C.blue}}
.call b{display:flex;align-items:center;gap:6px;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};text-shadow:0 0 3px #FAFBFD,0 0 6px #FAFBFD}
.call b i{display:block;width:6px;height:6px;background:${C.ink}}
.call.on b i{background:${C.or}}
.call.on b{color:${C.or}}
.call span{display:block;font:500 8.4px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.mute};margin-top:2px;text-shadow:0 0 3px #FAFBFD,0 0 6px #FAFBFD}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
.mic{position:absolute;left:1304px;top:398px;width:254px;height:254px;border-radius:4px;background:#14161b;overflow:hidden}
.mic img{width:100%;height:100%;object-fit:contain;display:block}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:118px;height:92px;background:${C.blue}"></div>`);
  add(`<div style="position:absolute;left:0;top:92px;width:118px;height:4px;background:${C.or}"></div>`);
  add(`<div class="mo" style="position:absolute;left:14px;top:12px;color:#fff;font-size:11px;font-weight:600">14</div>`);
  add(`<div style="position:absolute;left:30px;top:20px;color:#fff;font-size:44px;font-weight:700;letter-spacing:-1px;line-height:1">Si</div>`);
  add(`<div class="mo" style="position:absolute;left:31px;top:70px;color:#fff;font-size:8.5px;letter-spacing:1.4px;opacity:.9">28.085</div>`);
  add(`<div class="sm" style="position:absolute;left:140px;top:20px;letter-spacing:2.4px;color:${C.blue};font-weight:700">OPERATION SEMI / MI-CHIPS</div>`);
  add(`<div style="position:absolute;left:139px;top:35px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Silicon wafer <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:140px;top:75px;font-size:11px;letter-spacing:2.2px;color:#53617A">FROM 300 MM DOWN TO ONE ATOM</div>`);
  const hdrStop = add(`<div style="position:absolute;right:28px;top:26px;font-size:38px;font-weight:700;letter-spacing:-.8px;line-height:1;color:${C.blue};text-align:right"></div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:70px;letter-spacing:2.2px">STOP</div>`);
  const hdrName = add(`<div class="mo" style="position:absolute;right:200px;top:44px;font-size:12px;font-weight:700;letter-spacing:2.4px;text-align:right"></div>`);
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) h += `<path d="M${c * 24 + 4} ${r * 22}v8M${c * 24} ${r * 22 + 4}h8" stroke="${C.blue}" stroke-width="1.1" opacity=".22"/>`;
    add(`<svg style="position:absolute;left:700px;top:40px" width="240" height="34">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 scale
  panel(28, 118, 282, 322, 'SCALE', '01');
  const fovBig = add(`<div style="position:absolute;left:42px;top:150px;font-size:36px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:43px;top:192px">FIELD OF VIEW, TOP TO BOTTOM</div>`);
  add(`<div style="position:absolute;left:42px;top:212px;width:254px;height:1px;background:${C.line}"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:224px">MAGNIFICATION VS WAFER</div>`);
  const magV = add(`<div class="mo" style="position:absolute;right:${1600 - 296}px;top:220px;font-size:13px;font-weight:700"></div>`);
  const ruler = add(`<svg style="position:absolute;left:42px;top:250px" width="254" height="118"></svg>`);
  // the size comparison: whatever everyday object is closest to the field of view, with a small drawing of it
  add(`<div style="position:absolute;left:42px;top:374px;width:254px;height:1px;background:${C.line}"></div>`);
  const cmpIcon = add(`<svg style="position:absolute;left:42px;top:386px" width="44" height="44" viewBox="0 0 44 44"></svg>`);
  add(`<div class="sm" style="position:absolute;left:96px;top:386px;font-size:8.4px">SIZE COMPARISON</div>`);
  const cmpMain = add(`<div style="position:absolute;left:96px;top:398px;width:200px;font-size:12.5px;font-weight:700;line-height:1.2;color:${C.ink}"></div>`);
  const cmpSub = add(`<div style="position:absolute;left:96px;top:416px;width:200px;font-size:10px;line-height:1.25;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ 02 the stop
  panel(28, 454, 282, 406, 'AT THIS STOP', '02');
  const stTitle = add(`<div style="position:absolute;left:42px;top:490px;width:254px;font-size:17px;font-weight:700;letter-spacing:-.2px"></div>`);
  const stText = add(`<div style="position:absolute;left:42px;top:518px;width:254px;font-size:12.5px;line-height:1.55;color:#0B0F19"></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:690px;font-size:8.4px;color:${C.blue}">TAP THE LABELS TO LEARN MORE </div>`);
  add(`<div style="position:absolute;left:42px;top:770px;width:254px;height:1px;background:${C.line}"></div>`);
  const stats = [0, 1, 2].map((i) => {
    const x = 42 + i * 88;
    if (i) add(`<div style="position:absolute;left:${x - 8}px;top:780px;width:1px;height:46px;background:${C.line}"></div>`);
    const v = add(`<div style="position:absolute;left:${x}px;top:782px;font-size:15px;font-weight:700;white-space:nowrap"></div>`);
    const n = add(`<div class="sm" style="position:absolute;left:${x}px;top:806px;font-size:8.2px;letter-spacing:1.2px"></div>`);
    return {v, n};
  });

  // ------------------------------------------------------------ 03 stops, 04 display, 05 micrograph
  const btn = {};
  panel(1290, 118, 282, 128, 'STOPS', '03');
  STOPS.forEach((s, i) => {
    const row = i < 4 ? 0 : 1;
    const col = i < 4 ? i : i - 4;
    const w = row === 0 ? 60 : 82;
    const x = 1304 + col * (w + (row === 0 ? 4.6 : 4));
    btn[`s${i}`] = add(`<div class="bt" style="left:${x}px;top:${156 + row * 31}px;width:${w}px">${s.name}</div>`);
  });
  add(`<div class="sm" style="position:absolute;left:1304px;top:222px;font-size:8px">KEYS 0–6 · ← → · SCROLL TO DIVE</div>`);
  panel(1290, 260, 282, 84, 'DISPLAY', '04');
  DISPLAY.forEach((k, i) => {
    const w = [70, 66, 100][i];
    const x = 1304 + [0, 74, 144][i];
    btn[k] = add(`<div class="bt" style="left:${x}px;top:298px;width:${w}px">${DISPLAY_LABEL[k]}</div>`);
  });
  panel(1290, 358, 282, 372, 'REAL IMAGE', '05');
  const micBox = add(`<div class="mic"><img alt=""></div>`);
  const micImg = micBox.querySelector('img');
  // an image this copy does not ship (the public repository leaves out the reference photo): say so instead of a broken icon
  micImg.addEventListener('error', () => {
    micBox.style.visibility = 'hidden';
    micKind.style.visibility = 'hidden';
    micCap.textContent = 'THIS IMAGE IS NOT INCLUDED IN THIS COPY OF THE PAGE.';
  });
  micImg.addEventListener('load', () => {
    micBox.style.visibility = '';
    micKind.style.visibility = '';
  });
  const micNone = add(`<div class="mo" style="position:absolute;left:1316px;top:500px;width:230px;text-align:center;font-size:9.5px;line-height:1.7;letter-spacing:1.3px;color:#53617A"></div>`);
  const micKind = add(`<div class="mo" style="position:absolute;left:1312px;top:404px;padding:2px 6px;border-radius:3px;background:${C.blue};color:#fff;font-size:9px;font-weight:700;letter-spacing:1.4px"></div>`);
  const micCap = add(`<div class="mo" style="position:absolute;left:1304px;top:662px;width:254px;font-size:8.6px;line-height:1.6;letter-spacing:1px;color:#53617A;white-space:normal"></div>`);

  // ------------------------------------------------------------ 06 the journey
  panel(360, 752, 880, 108, 'JOURNEY · DEPTH', '06');
  btn.play = add(`<div class="bt" style="left:376px;top:793px;width:44px;height:44px;border-radius:50%;border:none;background:${C.blue};color:#fff;font-size:15px"></div>`);
  const TL = {x: 448, w: 640};
  add(`<div style="position:absolute;left:${TL.x}px;top:806px;width:${TL.w}px;height:3px;background:#E0E5EC;border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:806px;height:3px;background:${C.blue};border-radius:2px"></div>`);
  const ticks = STOPS.map((s, i) => {
    const x = TL.x + (i / (NSTOP - 1)) * TL.w;
    add(`<div style="position:absolute;left:${x - 1}px;top:801px;width:2px;height:13px;background:${C.faint}"></div>`);
    return add(`<div class="sm" style="position:absolute;left:${x}px;top:822px;transform:translateX(-50%);font-size:8.4px;letter-spacing:1.2px">${s.name}</div>`);
  });
  const tlKnob = add(`<div style="position:absolute;top:800px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.blue};box-sizing:border-box"></div>`);
  add(`<div class="sm" style="position:absolute;left:1118px;top:794px">SPEED</div>`);
  const SP = {x: 1118, w: 92};
  add(`<div style="position:absolute;left:${SP.x}px;top:816px;width:${SP.w}px;height:3px;background:#E0E5EC;border-radius:2px"></div>`);
  const spFill = add(`<div style="position:absolute;left:${SP.x}px;top:816px;height:3px;background:${C.blue};border-radius:2px"></div>`);
  const spKnob = add(`<div style="position:absolute;top:810px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.blue};box-sizing:border-box"></div>`);
  const spVal = add(`<div class="mo" style="position:absolute;left:1118px;top:830px;font-size:10px;font-weight:700"></div>`);

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:27px;top:880px;letter-spacing:2px">PROCEDURAL MODEL · REAL DIMENSIONS · ONE INPUT: DEPTH · CHECK: ${CHECK.full} FULL DIES VS ${CHECK.estimate} BY FORMULA, BEFORE THE 3 MM EDGE</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:880px;letter-spacing:2px">REAL IMAGES: WIKIMEDIA COMMONS · CC0, CC BY 3.0, CC BY-SA 3.0 <span style="color:${C.or}">//////</span></div>`);

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const learn = add(`<div class="learn" role="dialog" aria-live="polite" hidden><button type="button" aria-label="Close">×</button><h4></h4><p></p></div>`);
  learn.querySelector('button').addEventListener('click', () => (learn.hidden = true));
  let learnStop = -1;
  callG.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.call');
    if (!c) return;
    const name = c.dataset.n;
    const note = LESSON[lastStop]?.parts[name];
    if (!note) return;
    learn.querySelector('h4').textContent = name;
    learn.querySelector('p').textContent = note;
    learnStop = lastStop;
    const x = Math.min(1270 - 300, Math.max(330, parseFloat(c.style.left) - 10));
    const y = Math.min(740 - 160, Math.max(110, parseFloat(c.style.top) + 40));
    learn.style.left = x + 'px';
    learn.style.top = y + 'px';
    learn.hidden = false;
  });
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const l = parseFloat(n.style.left);
    const t = parseFloat(n.style.top);
    const w = parseFloat(n.style.width) || 60;
    const h = parseFloat(n.style.height) || 23;
    return [l + w / 2, t + h / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // the ruler: one metre down to 0.1 nm, a tick per decade, everyday references, the current field of view
  const RL = {x0: 6, x1: 248};
  const lx = (m) => RL.x0 + ((0 - Math.log10(m)) / 10) * (RL.x1 - RL.x0);
  const REFS = [[0.3, 'WAFER'], [7e-5, 'HAIR'], [8e-6, 'BLOOD CELL'], [1e-7, 'VIRUS'], [2e-9, 'DNA']];
  let rulerBase = `<line x1="${RL.x0}" x2="${RL.x1}" y1="40" y2="40" stroke="${C.ink}" stroke-width="1"/>`;
  for (let e = 0; e <= 10; e++) {
    const x = lx(Math.pow(10, -e));
    rulerBase += `<line x1="${x}" x2="${x}" y1="${e % 3 === 0 ? 33 : 36}" y2="44" stroke="${C.ink}" stroke-width="1"/>`;
  }
  [['1 m', 0], ['1 mm', -3], ['1 µm', -6], ['1 nm', -9]].forEach(([s, e]) => {
    rulerBase += `<text x="${lx(Math.pow(10, e))}" y="26" font-size="8.4" text-anchor="${e === 0 ? 'start' : 'middle'}" fill="${C.mute}" font-family="JetBrains Mono">${s}</text>`;
  });
  REFS.forEach(([m, n], i) => {
    const x = lx(m);
    const y = 58 + (i % 2) * 22;
    rulerBase += `<line x1="${x}" x2="${x}" y1="44" y2="${y - 7}" stroke="${C.faint}" stroke-width="1"/><circle cx="${x}" cy="44" r="1.8" fill="${C.mute}"/><text x="${x}" y="${y}" font-size="7.6" text-anchor="${i === 0 ? 'start' : 'middle'}" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing=".8">${n}</text>`;
  });

  const ink = C.ink;
  const or = C.or;
  const ICON = {
    plate: `<circle cx="22" cy="22" r="19" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="22" cy="22" r="12" fill="none" stroke="${ink}" stroke-width="1"/>`,
    card: `<rect x="4" y="11" width="36" height="23" rx="3" fill="#fff" stroke="${ink}" stroke-width="1.6"/><rect x="8" y="16" width="7" height="5" rx="1" fill="${or}"/><path d="M8 28h18" stroke="${ink}" stroke-width="1.4"/>`,
    stamp: `<rect x="9" y="6" width="26" height="32" fill="#fff" stroke="${ink}" stroke-width="1.6" stroke-dasharray="2 2"/><rect x="13" y="10" width="18" height="18" fill="${or}" opacity=".85"/>`,
    rice: `<ellipse cx="22" cy="22" rx="7" ry="16" transform="rotate(35 22 22)" fill="#fffaf0" stroke="${ink}" stroke-width="1.6"/>`,
    sand: `<path d="M12 26l5-12 12-3 7 9-3 12-13 3z" fill="#e9cf98" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
    hair: `<path d="M4 30c8-14 14 4 22-10s12-4 14-8" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,
    cell: `<ellipse cx="22" cy="22" rx="18" ry="15" fill="#e8584a" stroke="${ink}" stroke-width="1.4"/><ellipse cx="22" cy="22" rx="8" ry="6" fill="#c63d31"/>`,
    bacterium: `<rect x="6" y="15" width="32" height="14" rx="7" fill="#9bd47a" stroke="${ink}" stroke-width="1.6"/><path d="M38 22c3 0 3 6 6 6" fill="none" stroke="${ink}" stroke-width="1.2"/>`,
    virus: `<circle cx="22" cy="22" r="11" fill="#7fb4e8" stroke="${ink}" stroke-width="1.6"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<g transform="rotate(${a} 22 22)"><path d="M22 11V5" stroke="${ink}" stroke-width="1.4"/><circle cx="22" cy="4.5" r="2" fill="${or}"/></g>`).join(''),
    dna: `<path d="M14 4c16 9 0 27 16 36M30 4c-16 9 0 27-16 36" fill="none" stroke="${ink}" stroke-width="1.8"/><path d="M17 12h10M15 22h14M17 32h10" stroke="${or}" stroke-width="1.6"/>`,
    water: `<circle cx="22" cy="24" r="10" fill="#e8584a" stroke="${ink}" stroke-width="1.4"/><circle cx="10" cy="14" r="6" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="34" cy="14" r="6" fill="#fff" stroke="${ink}" stroke-width="1.4"/>`,
  };
  // [size in metres, icon, singular, plural, "a/an" form, what the size means]
  const CMP = [
    [0.27, 'plate', 'dinner plate', 'dinner plates', 'a dinner plate', 'A dinner plate is about 27 cm across.'],
    [0.0856, 'card', 'credit card', 'credit cards', 'a credit card', 'A credit card is 8.6 cm long.'],
    [0.025, 'stamp', 'postage stamp', 'postage stamps', 'a postage stamp', 'A postage stamp is about 2.5 cm tall.'],
    [0.006, 'rice', 'grain of rice', 'grains of rice', 'a grain of rice', 'A grain of rice is about 6 mm long.'],
    [0.0005, 'sand', 'grain of sand', 'grains of sand', 'a grain of sand', 'A grain of sand is about 0.5 mm across.'],
    [80e-6, 'hair', 'human hair', 'human hairs', 'a human hair', 'A human hair is about 80 µm wide.'],
    [8e-6, 'cell', 'red blood cell', 'red blood cells', 'a red blood cell', 'A red blood cell is about 8 µm across.'],
    [2e-6, 'bacterium', 'bacterium', 'bacteria', 'a bacterium', 'An E. coli bacterium is about 2 µm long.'],
    [100e-9, 'virus', 'virus', 'viruses', 'a flu virus', 'A flu virus is about 100 nm across.'],
    [2e-9, 'dna', 'DNA strand', 'DNA strands', 'a DNA strand', 'A DNA strand is about 2 nm wide.'],
    [0.28e-9, 'water', 'water molecule', 'water molecules', 'a water molecule', 'A water molecule is about 0.28 nm across.'],
  ];
  let cmpKey = '';
  const drawCompare = (fov) => {
    let best = CMP[0];
    for (const r of CMP) if (Math.abs(Math.log(fov / r[0])) < Math.abs(Math.log(fov / best[0]))) best = r;
    const k = fov / best[0];
    let main;
    if (k >= 0.8 && k <= 1.25) main = `Size of ${best[4]}`;
    else if (k > 1.25) {
      const n = k < 10 ? Math.round(k * 2) / 2 : Math.round(k);
      main = `${n} ${n === 1 ? best[2] : best[3]} across`;
    } else main = `1/${Math.round(1 / k)} of ${best[4]}`;
    const key = best[1] + main;
    if (key === cmpKey) return;
    cmpKey = key;
    cmpIcon.innerHTML = ICON[best[1]];
    cmpMain.textContent = main;
    cmpSub.textContent = best[5];
    cmpSub.style.top = `${398 + cmpMain.offsetHeight + 2}px`;
  };
  let lastStop = -1;
  return {
    spots,
    btn,
    root: ui,
    TL,
    SP,
    timeline: (k) => [TL.x + k * TL.w, 807],
    update(s) {
      const J = s.J;
      const near = J.near;
      // scale
      fovBig.textContent = fmtLen(J.fov);
      drawCompare(J.fov);
      magV.textContent = `×${J.mag < 1000 ? J.mag.toFixed(J.mag < 10 ? 1 : 0) : J.mag.toExponential(1).replace('e+', '×10^')}`;
      if (J.mag >= 1000) {
        const [a, b] = J.mag.toExponential(1).split('e+');
        magV.innerHTML = `×${a}×10<sup style="font-size:8px">${b}</sup>`;
      }
      const x = lx(J.fov);
      ruler.innerHTML = rulerBase + `<line x1="${RL.x0}" x2="${x.toFixed(1)}" y1="40" y2="40" stroke="${C.or}" stroke-width="2.5"/><path d="M${x.toFixed(1)} 30 l-5 -8 h10 z" fill="${C.or}"/><text x="${Math.min(200, Math.max(30, x)).toFixed(1)}" y="112" font-size="8.4" text-anchor="middle" fill="${C.or}" font-family="JetBrains Mono" font-weight="700" letter-spacing="1">YOU ARE HERE</text><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="44" y2="100" stroke="${C.or}" stroke-width="1" stroke-dasharray="2 2"/>`;
      // the stop text, the header, the micrograph
      if (near !== lastStop) {
        lastStop = near;
        const I = INFO[near];
        stTitle.textContent = LESSON[near].title;
        stText.textContent = LESSON[near].text;
        if (learnStop !== near) learn.hidden = true;
        I.stats.forEach(([v, n], i) => {
          stats[i].v.textContent = v;
          stats[i].n.textContent = n;
        });
        hdrStop.textContent = `0${near + 1}/0${NSTOP}`;
        hdrName.textContent = STOPS[near].name;
        const M = MICRO[near];
        if (M) {
          if (!micImg.src.endsWith(M.src)) micImg.src = M.src;
          micKind.textContent = M.kind;
          micCap.textContent = M.cap;
          micNone.textContent = '';
        } else {
          micCap.textContent = '';
          micKind.textContent = '';
          micNone.innerHTML = near === 4 ? 'NO FREELY LICENSED MICROGRAPH<br>OF A MODERN TRANSISTOR EXISTS.<br>THE MODEL USES TYPICAL<br>PUBLISHED DIMENSIONS.' : 'NO REAL IMAGE FOR THIS STOP.<br>THE MODEL IS BUILT TO SCALE<br>FROM THE NUMBERS IN PANEL 02.';
        }
      }
      const M = MICRO[near];
      const showMic = !!(s.display.micro && M);
      micBox.style.display = showMic ? 'block' : 'none';
      micKind.style.display = showMic ? 'block' : 'none';
      micCap.style.display = showMic ? 'block' : 'none';
      micNone.style.display = showMic || M ? 'none' : 'block';
      if (!showMic && M) {
        micNone.style.display = 'block';
        micNone.innerHTML = 'MICROGRAPH HIDDEN.<br>TURN ON MICROGRAPH IN PANEL 04.';
      }
      // buttons
      const onBtn = (k, on) => {
        btn[k].style.background = on ? C.blue : '#fff';
        btn[k].style.color = on ? '#fff' : C.ink;
        btn[k].style.borderColor = on ? C.blue : C.faint;
      };
      STOPS.forEach((_, i) => {
        onBtn(`s${i}`, near === i && Math.abs(J.d - i) < 0.5);
        const lk = s.locked != null && i > s.locked;
        btn[`s${i}`].style.opacity = lk ? '0.38' : '';
        btn[`s${i}`].style.cursor = lk ? 'not-allowed' : '';
        btn[`s${i}`].title = lk ? 'Locked: answer the question at the current stop first' : '';
      });
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      // the journey
      const k = J.d / (NSTOP - 1);
      tlFill.style.width = `${(k * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${(TL.x + k * TL.w).toFixed(1)}px`;
      ticks.forEach((t, i) => {
        t.style.color = i === near ? C.blue : C.mute;
        t.style.opacity = s.locked != null && i > s.locked ? '0.4' : '';
      });
      const sk = s.speedK ?? 0.5;
      spFill.style.width = `${(sk * SP.w).toFixed(1)}px`;
      spKnob.style.left = `${(SP.x + sk * SP.w).toFixed(1)}px`;
      spVal.textContent = `${(s.speed ?? 1).toFixed(1)}×`;
      // labels
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx2, ly] = c.label;
        const right = lx2 > ax;
        const ex = right ? lx2 - 6 : lx2 + c.w + 6;
        const col = c.on ? C.or : C.ink;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${col}" stroke-width=".9" opacity="${(c.o * 0.8).toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${col}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call${c.on ? ' on' : ''}" data-n="${c.name}" style="left:${lx2.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)};${right ? '' : `width:${c.w}px;text-align:right`}"><b style="${right ? '' : 'justify-content:flex-end'}"><i></i>${c.name} <em>i</em></b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}

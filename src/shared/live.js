// The wafer journey as a page you drive. The seven stop buttons, the keys 0-6 and the arrows move the depth; the
// timeline scrubs it; the wheel dives in and out; drag to orbit; the play button walks the stops on its own at the
// SPEED set. Left alone it plays the film's SCRIPT as an auto tour with the operator's cursor; any click, drag,
// wheel or key hands control over, and 25 s of quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY} from './console.js';
import {camAt, depthAt, displayAt, DURATION, makeConsoleFrame, makeCursor, SCRIPT} from './film.js';
import {NSTOP} from './kin.js';
import {createStage} from './stage.js';
import {createTrainee} from './trainee.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const SPEED = [0.25, 2.5];
const speedK = (v) => (v - SPEED[0]) / (SPEED[1] - SPEED[0]);
const HOLD = 3.2; // seconds the play button rests at each stop, at 1x

const CSS = `
html,body{margin:0;height:100%;background:#eceef2;overflow:hidden;color-scheme:light}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab;position:absolute;left:0;top:0;width:${W}px!important;height:${H}px!important}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.97)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:104px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #e1e4ea;border-radius:4px;background:rgba(250,251,252,.95);color:#1f2229;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e4572e}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
@media (prefers-reduced-motion: reduce){.tourchip.on i{animation:none}}
.turn{position:fixed;left:0;right:0;bottom:14px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#7d8391;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st);
  const trainee = createTrainee(ui.root);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {shadow: 2048, pr: 2, ao: true, samples: 4},
    {shadow: 1024, pr: 1.5, ao: false, samples: 4},
    {shadow: 512, pr: 1, ao: false, samples: 2},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 1 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    void pr;
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state
  let T = 0;
  let D = 0; // the one input: depth, 0 = wafer, 6 = atom
  let Dt = 0;
  let speed = 1;
  let playing = false;
  let hold = 0;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: k === 'micro' ? 1 : 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  let orbitAz = 0;
  const cam = {az: 28, el: 36, k: 1, sx: 0, sy: -22};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.5) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    // begin where the visitor left off when that matches a point in the film, else from the top
    AP.t0 = T;
    playing = false;
    speed = 1;
    Object.assign(off, {az: 0, el: 0, k: 1});
    orbitAz = 0;
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    // a learner who takes over sees the labels, which are the clickable parts
    if (!disp.labels.on) {
      disp.labels.on = 1;
      disp.labels.t = T;
    }
    Dt = clamp(Math.round(D), 0, NSTOP - 1);
    playing = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    // typing in the sign-in card leaves the tour running behind it
    if (e.target !== tourChip && !trainee.busy) takeOver();
  });
  const syncDisplay = (cyc) => {
    const want = displayAt(cyc);
    for (const k of DISPLAY)
      if (disp[k].on !== want[k]) {
        disp[k].on = want[k];
        disp[k].t = T;
      }
  };

  // ------------------------------------------------------------ controls
  const go = (n) => {
    Dt = clamp(n, 0, NSTOP - 1);
    hold = 0;
  };
  for (let i = 0; i < NSTOP; i++)
    ui.btn[`s${i}`].addEventListener('click', () => {
      takeOver();
      pulse(`s${i}`);
      playing = false;
      go(i);
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    if (!playing && Math.round(D) >= NSTOP - 1) go(0);
    playing = !playing;
    hold = 0;
  });
  const slider = (x0, w, y, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${x0 - 10}px`, top: `${y - 13}px`, width: `${w + 20}px`, height: '26px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / w, 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.TL.x, ui.TL.w, 807, (k) => {
    D = Dt = k * (NSTOP - 1);
    playing = false;
  });
  slider(ui.SP.x, ui.SP.w, 817, (k) => (speed = SPEED[0] + k * (SPEED[1] - SPEED[0])));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || trainee.busy) return;
    const key = e.key.toLowerCase();
    if (/^[0-6]$/.test(key)) ui.btn[`s${key}`].click();
    else if (key === 'arrowright' || key === 'arrowdown') {
      takeOver();
      playing = false;
      go(Math.floor(Dt + 1e-3) + 1);
    } else if (key === 'arrowleft' || key === 'arrowup') {
      takeOver();
      playing = false;
      go(Math.ceil(Dt - 1e-3) - 1);
    } else if (key === ' ') ui.btn.play.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'o') ui.btn.orbit.click();
    else if (key === 'm') ui.btn.micro.click();
    else if (key === 't') {
      lastInput = T;
      if (AP.on) takeOver();
      else startTour();
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -10, 50);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  // the wheel dives: down goes deeper, up comes back out
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      playing = false;
      Dt = clamp(Dt + e.deltaY * 0.0018, 0, NSTOP - 1);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    // drop a quality tier when frames run long (built-in graphics)
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let tgt;
    let cursor;
    let labelsK;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      D = depthAt(cyc);
      Dt = D;
      syncDisplay(cyc);
      const flip = SCRIPT.filter((e) => e.display === 'orbit' && e.t <= cyc).pop()?.t ?? -9;
      tgt = camAt(D, T, displayAt(cyc).orbit ? Math.max(0, cyc - flip) : 0);
      cursor = tourCursor(cyc);
      labelsK = eased('labels');
    } else {
      if (T - lastInput > IDLE) startTour();
      if (playing && Math.abs(Dt - D) < 0.004) {
        hold += dt * speed;
        if (hold > HOLD) {
          if (Math.round(D) >= NSTOP - 1) playing = false;
          else go(Math.round(D) + 1);
        }
      }
      // move toward the target at a steady pace that eases into the stop
      const gap = Dt - D;
      const rate = 0.42 * speed * Math.min(1, Math.abs(gap) * 2.2 + 0.18);
      D += Math.sign(gap) * Math.min(Math.abs(gap), rate * dt);
      if (disp.orbit.on) orbitAz += 22 * dt;
      tgt = camAt(D, T, 0);
      tgt.az += off.az + orbitAz;
      tgt.el = clamp(tgt.el + off.el, -5, 80);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      labelsK = eased('labels');
    }
    const k = 1 - Math.exp(-dt / 0.25);
    cam.az += (tgt.az - cam.az) * k;
    cam.el += (tgt.el - cam.el) * k;
    trainee.update(D, dt, AP.on);
    const {J} = st.frame({d: D, t: T}, {...cam, az: cam.az * D2R, el: cam.el * D2R, k: 1, sx: 0, sy: -22});
    const display = Object.fromEntries(DISPLAY.map((x) => [x, disp[x].on]));
    frameConsole(T, {J, display, labels: labelsK, cursor, paused: AP.on ? false : !playing, speed: AP.on ? 1 : speed, speedK: speedK(AP.on ? 1 : speed)});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK ANYWHERE TO TAKE OVER' : '▶ RESUME TOUR';
    }
    requestAnimationFrame(frame);
  };
  // every shader compiles at once before the first frame (kit/warm.js)
  st.frame({d: 0, t: 0}, {az: 28 * D2R, el: 36 * D2R, k: 1, sx: 0, sy: -22});
  warmComposer(st.renderer, st.composer, st.scene, st.camera).catch(() => {}).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, startTour, takeOver, get tier() {
    return tier;
  }, get D() {
    return D;
  }, get T() {
    return T;
  }, get tour() {
    return AP.on;
  }};
}

// Training: sign-in, one check-for-understanding question per stop, completion, and the record.
// The trainee signs in with name and V-number. Each stop has a "Check your understanding" button; a wrong answer can be
// retried, and the score counts answers right on the first try. When all seven are answered correctly, the completion
// card says the 2D/3D training is complete and the result is saved to the artifact's shared store under the trainee's
// own account (completions/<their id>), readable only by the owner and editors. Editors get a records view with a CSV
// download. Progress in this tab survives a reload (sessionStorage); nothing else is kept in the browser.
import {LESSON} from './edu.js';
import {NSTOP, STOPS} from './kin.js';

const KEY = 'wafer-training-v2';
// the viewer's capabilities; outside claude.ai (a local preview) there are none, and every feature degrades to absent
const use = (name) => (window.claude?.use ? window.claude.use(name) : Promise.resolve(null));
const CSS = `
.tr-veil{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(236,238,242,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Inter,system-ui,sans-serif;color:#1f2229;box-sizing:border-box}
.tr-veil[hidden]{display:none}
.tr-card{width:min(460px,100%);max-height:calc(100% - 8px);overflow:auto;background:#fff;border:1px solid #e1e4ea;border-radius:10px;box-shadow:0 18px 50px rgba(40,50,70,.18);padding:26px 26px 22px;box-sizing:border-box}
.tr-card.wide{width:min(820px,100%)}
.tr-eye{font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px;color:#e4572e;text-transform:uppercase;margin:0 0 8px}
.tr-card h2{margin:0 0 8px;font-size:22px;line-height:1.2;letter-spacing:-.3px;text-wrap:balance}
.tr-card p{margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b505b}
.tr-card label{display:block;font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:#5d6370;text-transform:uppercase;margin:0 0 6px}
.tr-card input{width:100%;box-sizing:border-box;height:42px;border:1px solid #d3d7df;border-radius:6px;padding:0 12px;font:500 15px Inter,system-ui,sans-serif;color:#1f2229;background:#fff;margin:0 0 6px}
.tr-card input:focus{outline:2px solid #e4572e;outline-offset:1px;border-color:#e4572e}
.tr-hint{font-size:12px;color:#7d8391;margin:0 0 14px}
.tr-err{font-size:12.5px;color:#b3261e;min-height:18px;margin:0 0 8px}
.tr-btn{width:100%;height:44px;border:0;border-radius:6px;background:#e4572e;color:#fff;font:700 12px 'JetBrains Mono',monospace;letter-spacing:1.6px;cursor:pointer}
.tr-btn.ghost{background:#fff;color:#1f2229;border:1px solid #d3d7df}
.tr-btn:focus-visible,.tr-opt:focus-visible{outline:2px solid #1f2229;outline-offset:2px}
.tr-row{display:flex;gap:10px}
.tr-row .tr-btn{flex:1}
.tr-opts{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}
.tr-opt{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;border:1px solid #d3d7df;border-radius:6px;background:#fff;padding:11px 12px;font:500 14px/1.4 Inter,system-ui,sans-serif;color:#1f2229;cursor:pointer}
.tr-opt b{flex:none;font:700 11px 'JetBrains Mono',monospace;color:#7d8391;padding-top:2px}
.tr-opt:hover:not(:disabled){border-color:#e4572e}
.tr-opt:disabled{cursor:default;opacity:.55}
.tr-opt.right{border-color:#2f9e6b;background:#eaf7f0;opacity:1}
.tr-opt.wrong{border-color:#b3261e;background:#fbeceb}
.tr-fb{font-size:14px;line-height:1.5;border-radius:6px;padding:10px 12px;margin:0 0 14px}
.tr-fb[hidden]{display:none}
.tr-fb.ok{background:#eaf7f0;color:#1d6b46}
.tr-fb.no{background:#fbeceb;color:#8c1d16}
.tr-done .tr-big{font-size:30px;font-weight:700;letter-spacing:-.6px;line-height:1.1;margin:0 0 14px}
.tr-rows{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 14px;font-size:14px}
.tr-rows dt{font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:#7d8391;text-transform:uppercase;padding-top:3px}
.tr-rows dd{margin:0;font-weight:600}
.tr-stops{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;padding:0;list-style:none}
.tr-stops li{font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:1.1px;padding:4px 8px;border-radius:4px;background:#e9f6ef;color:#1f7a50}
.tr-stops li.retry{background:#fdf1e6;color:#9a4b12}
.tr-rec{font-size:13px;line-height:1.45;padding:9px 12px;border-radius:6px;margin:0 0 16px;background:#f2f4f7;color:#4b505b}
.tr-rec.ok{background:#eaf7f0;color:#1d6b46}
.tr-rec.no{background:#fbeceb;color:#8c1d16}
.tr-table-wrap{overflow:auto;max-height:52vh;border:1px solid #e1e4ea;border-radius:6px;margin:0 0 14px}
.tr-table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.tr-table th{position:sticky;top:0;background:#f6f7f9;text-align:left;font:600 10px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:#5d6370;text-transform:uppercase;padding:9px 10px;border-bottom:1px solid #e1e4ea}
.tr-table td{padding:9px 10px;border-bottom:1px solid #eef0f3;white-space:nowrap}
.tr-chip{position:absolute;left:800px;top:12px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;height:22px;padding:0 11px;border:1px solid #e1e4ea;border-radius:4px;background:rgba(250,251,252,.95);font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:#1f2229;white-space:nowrap;pointer-events:none}
.tr-chip[hidden]{display:none}
.tr-chip b{color:#e4572e;font-weight:700}
.tr-quiz{position:absolute;left:42px;top:712px;width:254px;height:36px;border:0;border-radius:5px;background:#e4572e;color:#fff;font:700 10px 'JetBrains Mono',monospace;letter-spacing:1.4px;cursor:pointer;pointer-events:auto}
.tr-quiz.done{background:#eaf7f0;color:#1d6b46;border:1px solid #bfe3cf}
.tr-quiz.pulse{animation:trpulse 1.4s ease-in-out infinite}
@keyframes trpulse{50%{box-shadow:0 0 0 6px rgba(228,87,46,.25)}}
@media (prefers-reduced-motion: reduce){.tr-quiz.pulse{animation:none}}
.tr-recbtn{position:absolute;left:1290px;top:744px;width:282px;height:34px;border:1px solid #d3d7df;border-radius:5px;background:#fff;color:#1f2229;font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:1.3px;cursor:pointer;pointer-events:auto}
.tr-recbtn[hidden]{display:none}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const load = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
const save = (s) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: progress lives for this page view only */
  }
};
const fresh = (name = '', vnum = '') => ({name, vnum, quiz: {}, done: null, recorded: null});
const fmtTime = (iso) => new Date(iso).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'});

export function createTrainee(uiRoot) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  let st = load() || fresh();
  let near = 0;
  let touring = true;
  let rest = 0;

  // ------------------------------------------------------------ in-console controls
  const chip = el(`<div class="tr-chip" hidden></div>`);
  const quizBtn = el(`<button type="button" class="tr-quiz">CHECK YOUR UNDERSTANDING ▸</button>`);
  const recBtn = el(`<button type="button" class="tr-recbtn" hidden>COMPLETION RECORDS</button>`);
  uiRoot.append(chip, quizBtn, recBtn);

  // ------------------------------------------------------------ cards
  const signIn = el(`<div class="tr-veil" role="dialog" aria-modal="true" aria-labelledby="tr-title">
    <form class="tr-card" novalidate>
      <div class="tr-eye">Cleanroom training · Silicon wafer</div>
      <h2 id="tr-title">Sign in to start</h2>
      <p>Enter your name and V-number. At each of the seven stops, from the wafer down to one atom, tap the labels to learn, then answer one question. Answer all seven to complete the 2D/3D training.</p>
      <label for="tr-name">Full name</label>
      <input id="tr-name" name="name" autocomplete="name" required>
      <div class="tr-hint"></div>
      <label for="tr-vnum">V-number</label>
      <input id="tr-vnum" name="vnum" autocomplete="off" placeholder="V00123456" required>
      <div class="tr-hint">The letter V followed by your student number.</div>
      <div class="tr-err" role="alert"></div>
      <button type="submit" class="tr-btn">Start training</button>
    </form>
  </div>`);
  const quiz = el(`<div class="tr-veil" role="dialog" aria-modal="true" aria-labelledby="tr-q" hidden>
    <div class="tr-card">
      <div class="tr-eye"></div>
      <h2 id="tr-q"></h2>
      <div class="tr-opts"></div>
      <div class="tr-fb" role="status" hidden></div>
      <div class="tr-row"><button type="button" class="tr-btn ghost" data-act="close">Back to the model</button></div>
    </div>
  </div>`);
  const done = el(`<div class="tr-veil" role="dialog" aria-modal="true" aria-labelledby="tr-done-title" hidden>
    <div class="tr-card tr-done">
      <div class="tr-eye">Silicon wafer · All seven stops</div>
      <div class="tr-big" id="tr-done-title">2D/3D training is complete</div>
      <dl class="tr-rows"></dl>
      <ul class="tr-stops"></ul>
      <div class="tr-rec" role="status">Saving your result for your instructor…</div>
      <button type="button" class="tr-btn" data-act="close">Back to the model</button>
    </div>
  </div>`);
  const records = el(`<div class="tr-veil" role="dialog" aria-modal="true" aria-labelledby="tr-rec-title" hidden>
    <div class="tr-card wide">
      <div class="tr-eye">Instructor view · visible to the owner and editors only</div>
      <h2 id="tr-rec-title">Completion records</h2>
      <p class="tr-rec-note">Loading records…</p>
      <div class="tr-table-wrap"><table class="tr-table"><thead><tr><th>Name</th><th>V-number</th><th>Score</th><th>Completed</th><th>Times</th></tr></thead><tbody></tbody></table></div>
      <div class="tr-row"><button type="button" class="tr-btn" data-act="csv">Download CSV</button><button type="button" class="tr-btn ghost" data-act="close">Close</button></div>
    </div>
  </div>`);
  document.body.append(signIn, quiz, done, records);
  for (const v of [quiz, done, records]) v.querySelector('[data-act="close"]').addEventListener('click', () => (v.hidden = true));

  const answered = () => Object.values(st.quiz).filter((q) => q.done).length;
  const score = () => Object.values(st.quiz).filter((q) => q.done && q.first).length;
  const drawChip = () => {
    chip.hidden = !st.name;
    chip.textContent = '';
    const who = document.createElement('span');
    who.textContent = `${st.name.toUpperCase()} · ${st.vnum}`;
    const prog = document.createElement('span');
    prog.innerHTML = `QUESTIONS <b>${answered()}/${NSTOP}</b>${st.done ? ' · <b>COMPLETE</b>' : ''}`;
    chip.append(who, prog);
  };
  const drawQuizBtn = () => {
    const q = st.quiz[near];
    const ok = q?.done;
    quizBtn.classList.toggle('done', !!ok);
    quizBtn.textContent = ok ? `✓ ANSWERED · ${STOPS[near].name}` : 'CHECK YOUR UNDERSTANDING ▸';
    quizBtn.classList.toggle('pulse', !ok && !touring && rest > 3 && !!st.name);
  };

  // ------------------------------------------------------------ sign-in
  const form = signIn.querySelector('form');
  const nameIn = signIn.querySelector('#tr-name');
  const vIn = signIn.querySelector('#tr-vnum');
  const err = signIn.querySelector('.tr-err');
  nameIn.value = st.name;
  vIn.value = st.vnum;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameIn.value.trim().replace(/\s+/g, ' ');
    const vnum = vIn.value.trim().toUpperCase();
    if (name.length < 2) {
      err.textContent = 'Enter your full name.';
      nameIn.focus();
      return;
    }
    if (!/^V\d{6,9}$/.test(vnum)) {
      err.textContent = 'Enter your V-number: the letter V followed by your student number, for example V00123456.';
      vIn.focus();
      return;
    }
    err.textContent = '';
    st = name === st.name && vnum === st.vnum ? st : fresh(name, vnum);
    save(st);
    signIn.hidden = true;
    drawChip();
    drawQuizBtn();
  });
  if (st.name && st.vnum) signIn.hidden = true;
  else setTimeout(() => nameIn.focus(), 50);

  // ------------------------------------------------------------ the question for this stop
  const openQuiz = () => {
    if (!st.name) {
      signIn.hidden = false;
      nameIn.focus();
      return;
    }
    const L = LESSON[near];
    const stopAt = near;
    const rec = st.quiz[stopAt] || {first: null, tries: 0, done: false};
    quiz.querySelector('.tr-eye').textContent = `Stop ${stopAt + 1} of ${NSTOP} · ${STOPS[stopAt].name} · Check your understanding`;
    quiz.querySelector('h2').textContent = L.q.ask;
    const fb = quiz.querySelector('.tr-fb');
    fb.hidden = true;
    const box = quiz.querySelector('.tr-opts');
    box.textContent = '';
    const btns = L.q.options.map((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tr-opt';
      const k = document.createElement('b');
      k.textContent = 'ABCD'[i];
      const t = document.createElement('span');
      t.textContent = text;
      b.append(k, t);
      box.appendChild(b);
      return b;
    });
    const finish = () => {
      btns.forEach((b, i) => {
        b.disabled = true;
        if (i === L.q.correct) b.classList.add('right');
      });
      fb.className = 'tr-fb ok';
      fb.textContent = `Correct. ${L.q.why}`;
      fb.hidden = false;
    };
    if (rec.done) finish();
    btns.forEach((b, i) =>
      b.addEventListener('click', () => {
        const right = i === L.q.correct;
        rec.tries += 1;
        if (rec.first === null) rec.first = right;
        if (right) {
          rec.done = true;
          finish();
        } else {
          b.classList.add('wrong');
          b.disabled = true;
          fb.className = 'tr-fb no';
          fb.textContent = 'Not quite. Look at the model and tap its labels for clues, then try another answer.';
          fb.hidden = false;
        }
        st.quiz[stopAt] = rec;
        save(st);
        drawChip();
        drawQuizBtn();
        if (right && answered() === NSTOP && !st.done) {
          st.done = new Date().toISOString();
          save(st);
          setTimeout(() => {
            quiz.hidden = true;
            showDone();
            record();
          }, 1400);
        }
      }),
    );
    quiz.hidden = false;
    (rec.done ? quiz.querySelector('[data-act="close"]') : btns[0]).focus();
  };
  quizBtn.addEventListener('click', openQuiz);

  // ------------------------------------------------------------ completion
  const recNote = done.querySelector('.tr-rec');
  const showDone = () => {
    const rows = done.querySelector('.tr-rows');
    rows.textContent = '';
    for (const [k, v] of [['Name', st.name], ['V-number', st.vnum], ['Score', `${score()} of ${NSTOP} right on the first try`], ['Completed', fmtTime(st.done)]]) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      rows.append(dt, dd);
    }
    const list = done.querySelector('.tr-stops');
    list.textContent = '';
    STOPS.forEach((s, i) => {
      const li = document.createElement('li');
      const q = st.quiz[i];
      li.className = q?.first ? '' : 'retry';
      li.textContent = `${q?.first ? '✓' : '↻'} ${s.name}`;
      li.title = q?.first ? 'Right on the first try' : `Right after ${q?.tries ?? '?'} tries`;
      list.appendChild(li);
    });
    if (st.recorded) setRec('ok', 'Your result is saved for your instructor.');
    done.hidden = false;
    done.querySelector('[data-act="close"]').focus();
  };
  const setRec = (kind, text) => {
    recNote.className = `tr-rec ${kind}`;
    recNote.textContent = text;
  };
  let saving = false;
  const record = async () => {
    if (saving || st.recorded) return;
    saving = true;
    setRec('', 'Saving your result for your instructor…');
    const fail = (why) => setRec('no', `Your result could not be saved (${why}). Show this screen to your instructor as proof of completion.`);
    try {
      const [db, user] = await Promise.all([use('db'), use('user')]);
      const uid = user ? await user.id() : null;
      if (!db || !uid) {
        fail('you are not signed in to this page with an account that can save, or saving is not available here');
        return;
      }
      const ref = db.doc(`completions/${uid}`);
      const snap = await ref.get();
      const prior = snap.exists ? snap.data().records?.[st.vnum] : null;
      const rec = {
        name: st.name,
        vnum: st.vnum,
        score: score(),
        total: NSTOP,
        completedAt: st.done,
        times: (prior?.times || 0) + 1,
        answers: STOPS.map((s, i) => ({stop: s.name, firstTry: !!st.quiz[i]?.first, tries: st.quiz[i]?.tries || 0})),
      };
      if (snap.exists) await ref.update({records: {[st.vnum]: rec}});
      else await ref.set({records: {[st.vnum]: rec}});
      st.recorded = new Date().toISOString();
      save(st);
      setRec('ok', 'Your result is saved for your instructor.');
    } catch (e) {
      fail(e?.code === 'invalid_argument' ? 'this account can view the page but not save to it; ask your instructor for Contributor access' : 'the connection failed');
    } finally {
      saving = false;
    }
  };
  if (st.done && !st.recorded) record();

  // ------------------------------------------------------------ instructor: the records
  let rows = [];
  let unsub = null;
  const tbody = records.querySelector('tbody');
  const note = records.querySelector('.tr-rec-note');
  const drawRecords = () => {
    tbody.textContent = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      for (const v of [r.name, r.vnum, `${r.score}/${r.total}`, fmtTime(r.completedAt), String(r.times || 1)]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  };
  const openRecords = async () => {
    records.hidden = false;
    if (unsub) return;
    const db = await use('db');
    if (!db) {
      note.textContent = 'The records store is not available in this view.';
      return;
    }
    let timer = setTimeout(() => (note.textContent = 'The records cannot be reached yet. They will appear when the connection returns.'), 10000);
    unsub = db.collection('completions').onSnapshot(
      (snap) => {
        if (!snap.metadata.fromCache) {
          clearTimeout(timer);
          timer = null;
        }
        rows = snap.docs.flatMap((d) => Object.values(d.data()?.records || {})).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
        note.textContent = rows.length ? `${rows.length} completion${rows.length === 1 ? '' : 's'}, newest first. Score counts answers right on the first try.` : 'No completions yet. Records appear here as trainees finish.';
        drawRecords();
      },
      () => {
        clearTimeout(timer);
        note.textContent = 'The records could not be loaded.';
      },
    );
  };
  records.querySelector('[data-act="csv"]').addEventListener('click', async () => {
    const dl = await use('downloads');
    if (!dl) {
      note.textContent = 'Downloads are not available in this view.';
      return;
    }
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Name', 'V-number', 'Score', 'Out of', 'Completed', 'Times completed', ...STOPS.map((s) => `${s.name} first try`)];
    const lines = [head.map(q).join(',')].concat(rows.map((r) => [r.name, r.vnum, r.score, r.total, r.completedAt, r.times || 1, ...(r.answers || []).map((a) => (a.firstTry ? 'yes' : `no (${a.tries} tries)`))].map(q).join(',')));
    try {
      await dl.save({filename: 'wafer-training-completions.csv', data: lines.join('\n')});
    } catch (e) {
      if (e?.code !== 'declined') note.textContent = 'The CSV could not be saved here.';
    }
  });
  recBtn.addEventListener('click', openRecords);
  use('user').then(async (u) => {
    if (u && (await u.canEdit())) recBtn.hidden = false;
  });

  drawChip();
  drawQuizBtn();
  return {
    /** a card is open: the page's own keys stay out of the way */
    get busy() {
      return !signIn.hidden || !quiz.hidden || !done.hidden || !records.hidden;
    },
    /** every frame: the depth, frame time and whether the auto tour is driving */
    update(D, dt, isTouring) {
      const n = Math.round(D);
      const settled = Math.abs(D - n) < 0.04;
      rest = settled && n === near ? rest + dt : 0;
      if (n !== near || isTouring !== touring) {
        near = n;
        touring = isTouring;
        drawQuizBtn();
      } else if (rest > 3 && rest - dt <= 3) drawQuizBtn();
    },
  };
}

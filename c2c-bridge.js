// Connects this page to the C2C training record (saved in Airtable) without changing the built app.
// Needs c2c-connect.js from the C2C site, loaded before this file (see index.html).
//  - Sign-in: pre-fills the student shared across C2C sites, requires a V# (V00 + 6 numbers),
//    and logs the sign-in.
//  - Completion: when all seven questions are answered, sends the score to the C2C server.
(function () {
    'use strict';
    var SYSTEM = '3D Simulation';
    var TRACK = 'Wafer to Atom 2D/3D Training';
    var STATE_KEY = 'wafer-training-v2';   // where the app keeps progress (sessionStorage)
    var SENT_KEY = 'c2c-wafer-sent';       // completions already sent, so each is sent once
    var TOTAL = 7;
    var C = function () { return window.C2C || null; };
    var status = '';                      // our message for the completion card, once known

    function readJSON(storage, key) { try { return JSON.parse(storage.getItem(key) || 'null'); } catch (e) { return null; } }

    function toast(text, ok) {
        var t = document.createElement('div');
        t.setAttribute('role', 'status');
        t.textContent = text;
        t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:10px 16px;border-radius:10px;font:600 13px Inter,system-ui,sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);background:' + (ok ? '#00358E' : '#b45309');
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 6000);
    }

    // ---- sign-in
    function hookSignIn() {
        var v = document.getElementById('tr-vnum');
        var n = document.getElementById('tr-name');
        if (!v || !n || !v.form) return false;
        var form = v.form;
        var s = C() && C().student();
        if (s && !n.value && !v.value) { n.value = C().fullName(s); v.value = s.v; }
        // Capture phase on document runs before the app's own submit handler.
        document.addEventListener('submit', function (e) {
            if (e.target !== form || !C()) return;
            var id = C().normalizeV(v.value);
            if (!C().isValidV(id)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                var err = form.querySelector('.tr-err');
                if (err) err.textContent = C().V_HINT;
                v.focus();
                return;
            }
            v.value = id;
            var name = n.value.trim().replace(/\s+/g, ' ');
            if (name.length >= 2) { C().rememberStudent(id, name); C().recordSignIn(SYSTEM); }
        }, true);
        return true;
    }

    // ---- completion
    function showStatus() {
        var note = document.querySelector('.tr-rec');
        if (note && status && note.textContent !== status.text) {
            note.className = 'tr-rec ' + (status.ok ? 'ok' : '');
            note.textContent = status.text;
        }
    }

    function checkDone() {
        var st = readJSON(sessionStorage, STATE_KEY);
        if (!st || !st.done || !C() || !C().connected) return;
        var sent = readJSON(localStorage, SENT_KEY) || {};
        var key = st.vnum + '|' + st.done;
        if (sent[key]) return;
        sent[key] = true;
        try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch (e) {}
        var quiz = st.quiz || {};
        var right = Object.keys(quiz).filter(function (k) { return quiz[k] && quiz[k].done && quiz[k].first; }).length;
        C().saveResult({ system: SYSTEM, track: TRACK, score: Math.round(right / TOTAL * 100), studentId: st.vnum, fullName: st.name })
            .then(function (res) {
                if (res.ok) status = { ok: true, text: 'Your result is saved to your C2C training record.' };
                else if (res.queued) status = { ok: false, text: 'The training server did not answer; your result will be re-sent automatically. Keep this screen as proof of completion.' };
                else status = { ok: false, text: 'Your result could not be saved (' + (res.message || 'server error') + '). Show this screen to your instructor.' };
                showStatus();
                toast(status.text, status.ok);
            });
    }

    var tries = 0;
    var hooked = false;
    var timer = setInterval(function () {
        if (!hooked) hooked = hookSignIn();
        checkDone();
        showStatus(); // the app writes its own "could not be saved" note; keep ours on top
        if (++tries > 3600) clearInterval(timer); // stop after about two hours
    }, 2000);
})();

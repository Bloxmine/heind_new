/* Extras: floating windows, project windows, the photo reef, the flipdot display,
   desk accessories, Ship's Papers and the Flying Fish screensaver. */
(() => {
    'use strict';
    const S = window.SEA, O = S.ocean;
    const U = S.util;
    const { $, $$, esc, store, sfx, say, reduced } = U;
    const root = document.documentElement;
    const R = Math.random;

    /* =====================================================================
       floating Platinum windows (desk accessories, projects, photos)
       ===================================================================== */
    const floats = $('#floats');
    let zTop = 76;
    const chromeBottom = () => { const c = $('#chrome'); return c ? c.getBoundingClientRect().bottom : 90; };
    const front = (w) => {
        w.style.zIndex = ++zTop;
        $$('.float', floats).forEach((o) => o.classList.toggle('inactive', o !== w));
    };
    const clampPos = (w) => {
        const r = w.getBoundingClientRect();
        const x = Math.min(Math.max(4 - r.width + 60, r.left), window.innerWidth - 60);
        const y = Math.min(Math.max(chromeBottom() + 2, r.top), window.innerHeight - 30);
        w.style.left = x + 'px'; w.style.top = y + 'px';
    };

    S.float = {
        open({ id, title, html, width = 360, className = '', onClose, x, y }) {
            let w = floats.querySelector(`[data-fid="${id}"]`);
            if (w) { front(w); w.classList.remove('min'); return { win: w, fresh: false }; }
            w = document.createElement('section');
            w.className = `win float ${className}`;
            w.dataset.fid = id;
            w.setAttribute('role', 'dialog');
            w.setAttribute('aria-label', title);
            w.innerHTML = `<div class="mac-title">
                <button type="button" class="box box-close" data-f="close" aria-label="Close ${esc(title)}"></button>
                <span class="mt-name"><span class="f-title">${esc(title)}</span></span>
                <button type="button" class="box box-zoom" data-f="center" aria-label="Centre ${esc(title)}"></button>
                <button type="button" class="box box-shade" data-f="min" aria-label="Collapse ${esc(title)}"></button>
            </div><div class="win-body">${html}</div>`;
            const vw = window.innerWidth;
            const ww = Math.min(width, vw - 16);
            const n = floats.children.length;
            w.style.width = ww + 'px';
            const fx = x != null && vw > 700 ? (x < 0 ? vw + x - ww : x) : Math.round((vw - ww) / 2 + (n % 5) * 22 - 40);
            w.style.left = Math.max(8, Math.min(vw - ww - 8, fx)) + 'px';
            w.style.top = Math.round(chromeBottom() + (y != null && vw > 700 ? y : 24 + (n % 5) * 22)) + 'px';
            floats.append(w);
            front(w);

            const bar = $('.mac-title', w);
            let drag = null;
            bar.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button')) return;
                const r = w.getBoundingClientRect();
                drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
                bar.setPointerCapture(e.pointerId);
                w.classList.add('dragging');
            });
            bar.addEventListener('pointermove', (e) => {
                if (!drag) return;
                w.style.left = e.clientX - drag.dx + 'px';
                w.style.top = e.clientY - drag.dy + 'px';
            });
            const end = () => { if (drag) { drag = null; w.classList.remove('dragging'); clampPos(w); } };
            bar.addEventListener('pointerup', end);
            bar.addEventListener('pointercancel', end);
            bar.addEventListener('click', (e) => {
                const b = e.target.closest('[data-f]');
                if (!b) return;
                sfx('click');
                if (b.dataset.f === 'close') S.float.close(id);
                if (b.dataset.f === 'min') w.classList.toggle('min');
                if (b.dataset.f === 'center') {
                    w.classList.remove('min');
                    w.style.left = Math.max(8, (window.innerWidth - w.offsetWidth) / 2) + 'px';
                    w.style.top = chromeBottom() + 24 + 'px';
                }
            });
            w.addEventListener('pointerdown', () => front(w));
            w._onClose = onClose;
            sfx('pop');
            requestAnimationFrame(() => $('.box-close', w).focus({ preventScroll: true }));
            return { win: w, fresh: true };
        },
        close(id) {
            const w = floats.querySelector(`[data-fid="${id}"]`);
            if (!w) return;
            if (w._onClose) w._onClose();
            w.remove();
            const last = floats.lastElementChild;
            if (last) front(last);
        },
        setTitle(w, title) { $('.f-title', w).textContent = title; w.setAttribute('aria-label', title); }
    };
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || O.sub || !floats.children.length) return;
        if (document.querySelector('.mb-btn[aria-expanded="true"]')) return;
        const top = [...floats.children].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0];
        if (top) S.float.close(top.dataset.fid);
    });

    /* =====================================================================
       project windows: open a crate
       ===================================================================== */
    const order = [...S.PROJECTS].sort((a, b) => {
        if (!!b.pin !== !!a.pin) return b.pin ? 1 : -1;
        if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
        const ah = a.type === 'human', bh = b.type === 'human';
        if (ah !== bh) return ah ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });

    function projectHTML(p) {
        const demo = S.link(p.demo), src = S.link(p.source), st = S.STAMPS[p.type];
        const i = order.indexOf(p);
        const story = (p.story || [p.desc]).map((t) => `<p>${esc(t)}</p>`).join('');
        const learned = p.learned ? `<h4>What I learned</h4><ul class="bullets">${p.learned.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
        const post = p.post ? `<p class="pw-post"><a href="${esc(S.postLink(p.post))}" target="_blank" rel="noopener">read the full log entry &rarr;</a></p>` : '';
        return `<div class="pw">
            <div class="dither-box pw-shot" data-src="images/projects/${esc(p.img)}.jpg" data-w="320" data-alt="Screenshot of ${esc(p.title)}"></div>
            <div class="pw-side">
                <h3 class="pw-title">${esc(p.title)}</h3>
                ${st ? `<span class="b88 s-${p.type}" title="${esc(st.note)}">${st.label}</span>` : ''}
                <dl class="pw-facts">
                    <dt>Launched</dt><dd>${p.year}</dd>
                    <dt>Built with</dt><dd>${esc(p.tech.join(', '))}</dd>
                    ${st ? `<dt>How</dt><dd>${esc(st.note)}</dd>` : ''}
                </dl>
                <p class="pw-links">${demo ? `<a class="btn" href="${esc(demo)}" target="_blank" rel="noopener">&#9654; play</a>` : ''}${src ? `<a class="btn" href="${esc(src)}" target="_blank" rel="noopener">&lt;/&gt; code</a>` : ''}</p>
            </div>
            <div class="pw-story">${story}${learned}${post}</div>
        </div>
        <div class="pw-nav"><button type="button" class="btn" data-pn="-1">&#9664; prev crate</button><span>crate ${i + 1} of ${order.length}</span><button type="button" class="btn" data-pn="1">next crate &#9654;</button></div>`;
    }

    S.openProject = (id) => {
        const p = S.PROJECTS.find((q) => q.id === id);
        if (!p) return;
        const { win, fresh } = S.float.open({ id: 'project', title: p.title, html: '', width: 660, className: 'w-project' });
        S.float.setTitle(win, p.title);
        win.dataset.pid = p.id;
        $('.win-body', win).innerHTML = projectHTML(p);
        $('.win-body', win).scrollTop = 0;
        U.watchDither(win);
        sfx('clank');
        if (fresh) {
            win.addEventListener('click', (e) => {
                const b = e.target.closest('[data-pn]');
                if (!b) return;
                const cur = order.findIndex((q) => q.id === win.dataset.pid);
                const next = order[(cur + (+b.dataset.pn) + order.length) % order.length];
                S.openProject(next.id);
            });
        }
    };

    /* =====================================================================
       the photo reef
       ===================================================================== */
    function renderReef() {
        const ul = $('#reef-cards');
        ul.innerHTML = S.PHOTOS.map((ph, i) => {
            const r = S.rng(ph.id);
            return `<li class="reef-card" style="--r:${(r() * 8 - 4).toFixed(1)}deg;--lift:${Math.round(r() * 34)}px">
                <button type="button" class="postcard" data-photo="${i}" aria-label="Open photo: ${esc(ph.caption)}">
                    <span class="pin" aria-hidden="true"></span>
                    <span class="dither-box" data-src="images/photos/${esc(ph.id)}.jpg" data-w="180" data-alt="${esc(ph.caption)}"></span>
                    <span class="pc-cap">${esc(ph.caption)}</span>
                </button>
                <span class="rock" aria-hidden="true"><i class="weed w1"></i><i class="weed w2"></i></span>
            </li>`;
        }).join('');
        U.watchDither(ul);
        ul.addEventListener('click', (e) => {
            const b = e.target.closest('[data-photo]');
            if (b) openPhoto(+b.dataset.photo);
        });
    }

    function openPhoto(i) {
        const n = S.PHOTOS.length;
        i = (i + n) % n;
        const ph = S.PHOTOS[i];
        const { win, fresh } = S.float.open({ id: 'photo', title: ph.caption, html: '', width: 560, className: 'w-viewer' });
        S.float.setTitle(win, ph.caption + '.jpg');
        const body = $('.win-body', win);
        const color = win.dataset.color === '1';
        body.innerHTML = `<div class="pv">
            <div class="dither-box pv-img${color ? ' color' : ''}" data-src="images/photos/${esc(ph.id)}.jpg" data-w="440" data-alt="${esc(ph.caption)}"></div>
            <div class="pv-bar">
                <button type="button" class="btn" data-pv="-1" aria-label="Previous photo">&#9664;</button>
                <span>${esc(ph.caption)} &middot; ${i + 1} of ${n}</span>
                <label><input type="checkbox" data-pv-color${color ? ' checked' : ''}> full colour</label>
                <button type="button" class="btn" data-pv="1" aria-label="Next photo">&#9654;</button>
            </div>
        </div>`;
        win.dataset.i = i;
        U.watchDither(body);
        if (fresh) {
            win.addEventListener('click', (e) => {
                const b = e.target.closest('[data-pv]');
                if (b) { sfx('click'); openPhoto(+win.dataset.i + (+b.dataset.pv)); }
            });
            win.addEventListener('change', (e) => {
                if (!e.target.matches('[data-pv-color]')) return;
                win.dataset.color = e.target.checked ? '1' : '0';
                $('.pv-img', win).classList.toggle('color', e.target.checked);
            });
        }
    }

    /* =====================================================================
       the flipdot display: 84 x 28 discs, black on one side, yellow on the other
       ===================================================================== */
    function Flipdot(cv) {
        const COLS = 84, ROWS = 28, P = 8;
        cv.width = COLS * P; cv.height = ROWS * P;
        const c = cv.getContext('2d');
        const N = COLS * ROWS;
        const cur = new Uint8Array(N), anim = new Float32Array(N).fill(1);
        const next = new Uint8Array(N);
        const off = document.createElement('canvas');
        const oc = off.getContext('2d', { willReadFrequently: true });
        let mode = 'text', msgs = S.FLIPDOT_MSGS.slice(), mi = 0, custom = null, customLoops = 0;
        let bitmap = null, bw = 0, scroll = COLS, step = 0, life = null, lifeGen = 0, visible = false, last = 0, flipsQueued = 0;

        const textBitmap = (txt) => {
            const font = '700 16px Silkscreen, monospace';
            oc.font = font;
            const w = Math.ceil(oc.measureText(txt).width) + 2;
            off.width = Math.max(1, w); off.height = ROWS;
            oc.font = font;
            oc.fillStyle = '#000'; oc.fillRect(0, 0, off.width, ROWS);
            oc.fillStyle = '#fff'; oc.textBaseline = 'middle';
            oc.fillText(txt, 1, ROWS / 2 + 1);
            const d = oc.getImageData(0, 0, off.width, ROWS).data;
            const bm = new Uint8Array(off.width * ROWS);
            for (let i = 0; i < bm.length; i++) bm[i] = d[i * 4] > 110 ? 1 : 0;
            bw = off.width;
            return bm;
        };
        const loadText = (txt) => { bitmap = textBitmap(txt.toUpperCase()); scroll = reduced ? Math.max(0, Math.floor((COLS - bw) / 2)) : COLS; };
        const set = (x, y, v) => {
            const i = y * COLS + x;
            if (cur[i] !== v) { cur[i] = v; anim[i] = 0; flipsQueued++; }
        };

        const frameText = () => {
            if (!bitmap) loadText(msgs[mi]);
            for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                const bx = x - scroll;
                set(x, y, bx >= 0 && bx < bw ? bitmap[y * bw + bx] : 0);
            }
            if (reduced) return;
            scroll--;
            if (scroll < -bw) {
                if (custom && customLoops-- > 0) loadText(custom);
                else { custom = null; mi = (mi + 1) % msgs.length; loadText(msgs[mi]); }
            }
        };
        const frameClock = () => {
            const d = new Date();
            const s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            const bm = textBitmap(s);
            const ox = Math.floor((COLS - bw) / 2);
            for (let y = 0; y < ROWS - 3; y++) for (let x = 0; x < COLS; x++) {
                const bx = x - ox;
                set(x, y, bx >= 0 && bx < bw ? bm[y * bw + bx] : 0);
            }
            const sec = d.getSeconds();
            for (let x = 0; x < COLS; x++) { set(x, ROWS - 2, x < Math.round((sec / 59) * (COLS - 1)) ? 1 : 0); set(x, ROWS - 1, 0); set(x, ROWS - 3, 0); }
        };
        const seedLife = () => { life = new Uint8Array(N); for (let i = 0; i < N; i++) life[i] = R() < 0.28 ? 1 : 0; lifeGen = 0; };
        const frameLife = () => {
            if (!life) seedLife();
            let changed = 0;
            for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    n += life[((y + dy + ROWS) % ROWS) * COLS + ((x + dx + COLS) % COLS)];
                }
                const i = y * COLS + x, v = life[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
                next[i] = v;
                if (v !== life[i]) changed++;
            }
            life.set(next);
            for (let i = 0; i < N; i++) set(i % COLS, (i / COLS) | 0, life[i]);
            if (++lifeGen > 400 || changed < 4) seedLife();
        };

        const draw = (dt) => {
            c.fillStyle = '#141414';
            c.fillRect(0, 0, cv.width, cv.height);
            const r = P * 0.42;
            for (let i = 0; i < N; i++) {
                const x = (i % COLS) * P + P / 2, y = ((i / COLS) | 0) * P + P / 2;
                let a = anim[i];
                if (a < 1) anim[i] = a = Math.min(1, a + dt * 7);
                const showNew = a >= 0.5;
                const on = showNew ? cur[i] : 1 - cur[i];
                const sx = Math.max(0.12, Math.abs(Math.cos(a * Math.PI)));
                c.fillStyle = on ? '#ffd23f' : '#262626';
                c.beginPath(); c.ellipse(x, y, r * sx, r, 0, 0, Math.PI * 2); c.fill();
                if (on && sx > 0.6) { c.fillStyle = '#fff1a6'; c.fillRect(x - r * 0.45 * sx, y - r * 0.5, 1.5, 1.5); }
            }
        };

        const loop = (now) => {
            requestAnimationFrame(loop);
            if (!visible || document.hidden) { last = now; return; }
            const dt = Math.min(0.1, (now - last) / 1000 || 0);
            last = now;
            step += dt;
            const rate = mode === 'life' ? 0.14 : mode === 'clock' ? 0.25 : 0.055;
            if (step >= rate) {
                step = 0;
                if (mode === 'text') frameText(); else if (mode === 'clock') frameClock(); else frameLife();
                if (flipsQueued) { sfx('flip', flipsQueued); flipsQueued = 0; }
            }
            draw(dt);
        };
        new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { rootMargin: '100px' }).observe(cv);
        requestAnimationFrame(loop);

        return {
            say(txt) { custom = txt.slice(0, 60); customLoops = 2; mode = 'text'; loadText(custom); },
            mode(m) { mode = m; if (m === 'life') seedLife(); if (m === 'text') loadText(custom || msgs[mi]); },
            refont() { if (mode === 'text') loadText(custom || msgs[mi]); }
        };
    }

    function setupFlipdot() {
        const cv = $('#flipdot');
        if (!cv) return;
        const fd = Flipdot(cv);
        if (document.fonts) document.fonts.load('700 16px Silkscreen').then(() => fd.refont()).catch(() => {});
        $('#flip-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const v = $('#flip-text').value.trim();
            if (!v) return;
            fd.say(v);
            $$('[data-flip]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.flip === 'text')));
            $('#flip-text').value = '';
            if (!S.audio.on) say('flip flip flip! (turn the sound on in the Control Strip to hear the clicks.)');
        });
        $$('[data-flip]').forEach((b) => b.addEventListener('click', () => {
            fd.mode(b.dataset.flip);
            sfx('click');
            $$('[data-flip]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
        }));
        S.flipdot = fd;
    }

    /* =====================================================================
       desk accessories: Puzzle, Note Pad, Calculator
       ===================================================================== */
    async function openPuzzle() {
        const { win, fresh } = S.float.open({
            id: 'puzzle', title: 'Puzzle', width: 262, className: 'da', x: 40, y: 30,
            html: '<div class="pz" role="group" aria-label="Sliding puzzle"></div><p class="da-status">moves: <b class="pz-moves">0</b> &middot; <button type="button" class="linkish" data-pz="shuffle">shuffle</button></p>'
        });
        if (!fresh) return;
        const board = $('.pz', win);
        const img = await S.ditherImage('images/mug.jpeg', 112, { spread: 56 });
        const url = img ? img.toDataURL() : null;
        let arr, moves = 0, solved = false;
        const T = 56;
        const render = () => {
            board.innerHTML = arr.map((v, i) => {
                if (!v && !solved) return '<span class="pz-empty"></span>';
                const k = (v || 16) - 1, col = k % 4, row = (k / 4) | 0;
                const bg = url ? `background-image:url(${url});background-position:-${col * T}px -${row * T}px;` : '';
                return `<button type="button" class="pz-tile" data-i="${i}" style="${bg}" aria-label="tile ${v || 16}">${url ? '' : v}</button>`;
            }).join('');
            $('.pz-moves', win).textContent = moves;
        };
        const shuffle = () => {
            arr = [...Array(15)].map((_, i) => i + 1).concat(0);
            let e = 15, prev = -1;
            for (let n = 0; n < 160; n++) {
                const opts = [e - 4, e + 4, e % 4 ? e - 1 : -1, e % 4 < 3 ? e + 1 : -1].filter((q) => q >= 0 && q < 16 && q !== prev);
                const q = opts[(R() * opts.length) | 0];
                [arr[e], arr[q]] = [arr[q], arr[e]];
                prev = e; e = q;
            }
            moves = 0; solved = false;
            render();
        };
        board.addEventListener('click', (ev) => {
            const b = ev.target.closest('.pz-tile');
            if (!b || solved) return;
            const i = +b.dataset.i, e = arr.indexOf(0);
            const adj = (Math.abs(i - e) === 4) || (Math.abs(i - e) === 1 && ((i / 4) | 0) === ((e / 4) | 0));
            if (!adj) return;
            [arr[i], arr[e]] = [arr[e], arr[i]];
            moves++;
            sfx('click');
            if (arr.every((v, k) => v === (k === 15 ? 0 : k + 1))) {
                solved = true;
                sfx('chord');
                say(`you solved hein in ${moves} moves! he looks better in one piece.`);
            }
            render();
            const nb = board.querySelector(`[data-i="${e}"]`);
            if (nb) nb.focus({ preventScroll: true });
        });
        $('[data-pz]', win).addEventListener('click', () => { sfx('clank'); shuffle(); });
        shuffle();
    }

    function openNotepad() {
        const KEY = 'heind.notepad';
        const pages = store.get(KEY, Array(8).fill(''));
        let page = 0;
        const { win, fresh } = S.float.open({
            id: 'notepad', title: 'Note Pad', width: 300, className: 'da', x: 330, y: 60,
            html: `<div class="np">
                <textarea class="np-text" aria-label="Note Pad page 1" placeholder="dear diary,&#10;&#10;today i dove 10,935 metres.&#10;the fish were nice."></textarea>
                <button type="button" class="np-ear" aria-label="Next page"></button>
                <button type="button" class="np-prev" aria-label="Previous page">&#9664;</button>
                <span class="np-num">1</span>
            </div><p class="da-status">8 pages, saved in your browser.</p>`
        });
        if (!fresh) return;
        const ta = $('.np-text', win);
        const show = () => { ta.value = pages[page]; $('.np-num', win).textContent = page + 1; ta.setAttribute('aria-label', `Note Pad page ${page + 1}`); };
        ta.addEventListener('input', () => { pages[page] = ta.value.slice(0, 2000); store.set(KEY, pages); });
        $('.np-ear', win).addEventListener('click', () => { page = (page + 1) % 8; sfx('click'); show(); });
        $('.np-prev', win).addEventListener('click', () => { page = (page + 7) % 8; sfx('click'); show(); });
        show();
    }

    function openCalc() {
        const KEYS = [['C', 'clear'], ['⚓', 'atm'], ['÷', '/'], ['×', '*'], ['7'], ['8'], ['9'], ['−', '-'], ['4'], ['5'], ['6'], ['+', '+'], ['1'], ['2'], ['3'], ['=', '='], ['0'], ['.']];
        const { win, fresh } = S.float.open({
            id: 'calc', title: 'Calculator', width: 210, className: 'da', x: -170, y: 30,
            html: `<div class="calc"><output class="calc-lcd" aria-live="polite">0</output><p class="calc-sub">&nbsp;</p>
                <div class="calc-keys">${KEYS.map(([l, k]) => `<button type="button" class="btn${k === '=' ? ' k-eq' : ''}${l === '0' ? ' k-0' : ''}" data-k="${k || l}"${k === 'atm' ? ' title="depth in metres → water pressure"' : ''}>${l}</button>`).join('')}</div></div>`
        });
        if (!fresh) return;
        const lcd = $('.calc-lcd', win), sub = $('.calc-sub', win);
        let acc = null, op = null, cur = '0', fresh2 = true;
        const fmt = (n) => (Number.isFinite(n) ? String(+n.toPrecision(10)) : 'glub?');
        const show = () => { lcd.textContent = cur.length > 12 ? Number(cur).toExponential(5) : cur; };
        const calc = (a, b, o) => (o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : o === '/' ? a / b : b);
        const press = (k) => {
            sub.innerHTML = '&nbsp;';
            if (/^[0-9]$/.test(k)) { cur = fresh2 || cur === '0' ? k : cur + k; fresh2 = false; }
            else if (k === '.') { if (fresh2) { cur = '0.'; fresh2 = false; } else if (!cur.includes('.')) cur += '.'; }
            else if (k === 'clear') { acc = null; op = null; cur = '0'; fresh2 = true; }
            else if ('+-*/'.includes(k)) { if (op && !fresh2) cur = fmt(calc(acc, +cur, op)); acc = +cur; op = k; fresh2 = true; }
            else if (k === '=') {
                if (op) { cur = fmt(calc(acc, +cur, op)); acc = null; op = null; fresh2 = true; }
                if (cur === '7734') say('turn your screen upside down. hello to you too.');
            } else if (k === 'atm') {
                const m = Math.max(0, +cur);
                sub.textContent = `${fmt(m)} m deep ≈ ${(1 + m / 10.06).toFixed(1)} atm`;
                fresh2 = true;
            }
            show();
        };
        $('.calc-keys', win).addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { sfx('click'); press(b.dataset.k); } });
        win.addEventListener('keydown', (e) => {
            const map = { Enter: '=', '=': '=', Escape: null, Backspace: 'clear', c: 'clear', '*': '*', x: '*', '/': '/', '+': '+', '-': '-', '.': '.', ',': '.' };
            if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
            else if (map[e.key]) { press(map[e.key]); e.preventDefault(); }
        });
    }

    /* =====================================================================
       Ship's Papers (CV)
       ===================================================================== */
    function renderPapers() {
        const el = $('#papers');
        if (!el) return;
        const C = S.CV;
        const tags = [...S.TOOLS.map((t) => t.name), ...C.alsoHandy];
        el.innerHTML = `<div class="papers">
            <header class="pp-head">
                <span class="pp-crest" aria-hidden="true">&#9875;</span>
                <div><p class="pp-kicker">Seaman's Record Book</p><h3>${esc(C.name)}</h3><p class="pp-rank">${esc(C.rank)}</p></div>
                <span class="pp-stamp" aria-hidden="true">certified<br>seaworthy</span>
            </header>
            <dl class="pp-grid">
                <dt>Home port</dt><dd>${esc(C.homePort)}</dd>
                ${C.lookingFor ? `<dt>Looking for</dt><dd><b>${esc(C.lookingFor)}</b></dd>` : ''}
            </dl>
            <h4>Training</h4>
            <ul class="pp-list">${C.education.map((e) => `<li><time>${esc(e.when)}</time> &middot; <b>${esc(e.what)}</b>, ${esc(e.where)}</li>`).join('')}</ul>
            <h4>Voyages</h4>
            <ul class="pp-list">${C.voyages.map((v) => `<li><time>${esc(v.when)}</time> &middot; <b>${esc(v.what)}</b>, ${esc(v.where)}${v.notes ? `<br><span class="pp-notes">${esc(v.notes)}</span>` : ''}</li>`).join('')}
                <li><time>2024 – now</time> &middot; <b>${S.PROJECTS.length} side projects</b>, see the cargo hold</li></ul>
            <h4>Equipment</h4>
            <p class="pp-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
            <p class="pp-foot">
                ${C.cvUrl ? `<a class="btn" href="${esc(C.cvUrl)}" download>&#8595; download CV (PDF)</a>` : ''}
                <a class="btn" href="mailto:${esc(S.CONTACT.email)}">sign me on &rarr;</a>
                <a class="btn" href="${esc(S.CONTACT.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
            </p>
        </div>`;
    }

    /* =====================================================================
       Flying Fish screensaver
       ===================================================================== */
    const saver = { cv: $('#saver'), on: false, raf: 0, fish: [], stars: [], since: 0, t: 0 };
    const IDLE_MS = 60000;
    let lastInput = performance.now();
    const canSave = () => !document.hidden && !reduced && !root.classList.contains('lite') && !O.sub && !$('#dialogs').children.length;

    const drawFish = (c, x, y, f) => {
        const P = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
        P(9, -3, 2, 2, '#1f4a8f'); P(9, 1, 2, 2, '#1f4a8f'); P(8, -1, 2, 2, '#1f4a8f');
        P(1, -2, 6, 1, '#3b8fd4'); P(0, -1, 9, 2, '#3b8fd4'); P(1, 1, 7, 1, '#dff4ff'); P(-1, 0, 1, 1, '#3b8fd4');
        P(1, -1, 1, 1, '#000000');
        const W = [
            [[3, -3], [4, -4], [5, -5], [6, -6], [7, -7], [5, -4], [6, -5], [7, -6], [8, -6]],
            [[3, -2], [4, -2], [5, -3], [6, -3], [7, -3], [8, -4], [9, -4]],
            [[3, 1], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4]]
        ][f];
        W.forEach(([a, b]) => P(a, b, 1, 1, '#9fd8f5'));
    };

    function startSaver() {
        if (saver.on) return;
        const cv = saver.cv, sc = 4;
        cv.width = Math.ceil(window.innerWidth / sc); cv.height = Math.ceil(window.innerHeight / sc);
        cv.hidden = false;
        saver.on = true; saver.since = performance.now();
        const W = cv.width, H = cv.height;
        saver.fish = Array.from({ length: Math.round((W * H) / 3000) + 8 }, () => ({ x: R() * W * 1.5, y: R() * H - H * 0.5, v: 10 + R() * 14, ph: (R() * 3) | 0 }));
        saver.stars = Array.from({ length: 60 }, () => ({ x: R() * W, y: R() * H, ph: R() * 6 }));
        const c = cv.getContext('2d');
        let last = performance.now(), acc = 0;
        const loop = (now) => {
            saver.raf = requestAnimationFrame(loop);
            acc += (now - last) / 1000; last = now;
            if (acc < 1 / 12) return;
            const dt = acc; acc = 0; saver.t += dt;
            c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
            for (const s of saver.stars) { if (Math.sin(saver.t * 2 + s.ph) > -0.3) { c.fillStyle = '#6b6b80'; c.fillRect(s.x | 0, s.y | 0, 1, 1); } }
            for (const f of saver.fish) {
                f.x -= f.v * dt; f.y += f.v * 0.5 * dt;
                if (f.x < -14 || f.y > H + 10) { f.x = W + R() * W * 0.5; f.y = R() * H * 0.8 - H * 0.4; }
                drawFish(c, Math.round(f.x), Math.round(f.y), (Math.floor(saver.t * 8) + f.ph) % 3);
            }
            c.fillStyle = '#3b4660'; c.font = '8px monospace';
            c.fillText('flying fish', 3, H - 4);
        };
        saver.raf = requestAnimationFrame(loop);
    }
    function stopSaver() {
        if (!saver.on || performance.now() - saver.since < 700) return;
        saver.on = false;
        cancelAnimationFrame(saver.raf);
        saver.cv.hidden = true;
        say('welcome back! the flying fish were starting to worry.');
    }
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, () => {
        lastInput = performance.now();
        if (saver.on) stopSaver();
    }, { passive: true, capture: true }));
    setInterval(() => { if (!saver.on && performance.now() - lastInput > IDLE_MS && canSave()) startSaver(); }, 2000);

    /* =====================================================================
       rock texture, menu actions, go
       ===================================================================== */
    const rnd = S.rng('rocks');
    root.style.setProperty('--tex-rock', `url(${S.tile(32, 32, (x, w, h) => {
        x.fillStyle = '#3a3646'; x.fillRect(0, 0, w, h);
        for (let k = 0; k < 40; k++) { x.fillStyle = ['#2e2e3e', '#4a4658', '#3d2a1e', '#6b6b80'][k % 4]; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
    }, 30)})`);

    Object.assign(S.ACTS, {
        puzzle: openPuzzle,
        notepad: openNotepad,
        calc: openCalc,
        flipdot: () => {
            const w = document.querySelector('.w-flip');
            if (!w) return;
            w.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
            setTimeout(() => $('#flip-text').focus({ preventScroll: true }), 900);
        },
        saver: () => { lastInput = performance.now(); setTimeout(startSaver, 250); }
    });

    renderReef();
    renderPapers();
    setupFlipdot();
    requestAnimationFrame(() => O.relayout());
})();

/* Subshootica DX: a deep-sea shoot 'em up. 240x160 pixels, low-poly, dithered. */
(() => {
    'use strict';
    const S = window.SEA, GM = S.gm, A = S.ga;
    const W = 240, H = 160, TAU = Math.PI * 2;
    const $ = (q, r = document) => r.querySelector(q);
    const $$ = (q, r = document) => [...r.querySelectorAll(q)];
    const R = Math.random;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const rgb = S.hexToRgb;
    const mix = (h1, h2, k) => { const a = rgb(h1), b = rgb(h2); return `rgb(${lerp(a[0], b[0], k) | 0},${lerp(a[1], b[1], k) | 0},${lerp(a[2], b[2], k) | 0})`; };
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
    };
    const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    /* ---------- settings ---------- */
    const CFG = Object.assign({ pal: 'sea', diff: 'captain', sfx: true, music: true, crt: true, seenStory: false }, store.get('heind.subdx', {}));
    const saveCfg = () => store.set('heind.subdx', CFG);
    A.sfxOn = CFG.sfx; A.musicOn = CFG.music;
    const sfx = (n, a) => A.sfx(n, a);

    const PALS = {
        sea: { name: 'SeaOS Colour', pal: S.SEA_PAL, spread: 30, shot: '#fff1a6', shotCore: '#ffffff', rim: '#6e1a2c', core: '#ff4fd8', hot: '#ffffff', ink: '#04070f', text: '#ffffff', warn: '#e8562a' },
        dmg: { name: 'DMG Green', hexes: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], spread: 66, shot: '#9bbc0f', shotCore: '#9bbc0f', rim: '#0f380f', core: '#9bbc0f', hot: '#8bac0f', ink: '#0f380f', text: '#9bbc0f', warn: '#9bbc0f' },
        vsub: { name: 'Virtual Sub', hexes: ['#000000', '#550000', '#aa0000', '#ff0000'], spread: 66, shot: '#ff0000', shotCore: '#ff0000', rim: '#000000', core: '#ff0000', hot: '#aa0000', ink: '#000000', text: '#ff0000', warn: '#ff0000' }
    };
    Object.values(PALS).forEach((p) => { if (p.hexes) p.pal = S.makePalette(p.hexes); });
    const pal = () => PALS[CFG.pal] || PALS.sea;

    const DIFF = {
        rookie: { name: 'ROOKIE', bs: 0.8, fire: 0.65, hp: 0.8, lives: 4 },
        captain: { name: 'CAPTAIN', bs: 1, fire: 1, hp: 1, lives: 3 },
        kraken: { name: 'KRAKEN', bs: 1.2, fire: 1.4, hp: 1.2, lives: 2 }
    };
    const D = () => DIFF[CFG.diff] || DIFF.captain;

    /* ---------- canvas ---------- */
    const cv = $('#game');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const dk = document.createElement('canvas');
    dk.width = W; dk.height = H;
    const dg = dk.getContext('2d');
    const screen = $('#screen');

    /* ---------- models ---------- */
    const MK = {
        sub: GM.sub, clansub: GM.clansub, squid: () => GM.squid(), squidR: () => GM.squid('#e8562a', '#6e1a2c'),
        ball: () => GM.takoball(1), tako: GM.tako, jelly: GM.jelly, mine: GM.mine, eelHead: GM.eelHead, eelSeg: GM.eelSeg,
        crate: GM.crate, pearl: GM.pearl, bub: GM.bub, griddle: GM.griddle, ika: GM.ika, lure: GM.lure,
        king: () => GM.king(false), kingC: () => GM.king(true), crown: GM.crown, ship: GM.ship, pedestal: GM.pedestal,
        angler: () => S.models.angler(), fishA: () => GM.fish('#ff9a1f', '#fff1a6', '#e8562a'), fishB: () => GM.fish('#5ab4e8', '#dff4ff', '#1f4a8f'),
        fishC: () => GM.fish('#9bdc5a', '#fff1a6', '#3f9446')
    };
    const PUT = {
        P: { name: 'POWER UP', col: '#ff9a1f', col2: '#ffd23f' },
        H: { name: 'HOMING TORPEDOES', col: '#2bb5c9', col2: '#6fdde0' },
        B: { name: 'BUB BUDDY', col: '#ffd23f', col2: '#fff1a6' },
        S: { name: 'BUBBLE SHIELD', col: '#5ab4e8', col2: '#dff4ff' },
        D: { name: 'DEPTH CHARGE +1', col: '#6b6b80', col2: '#b4b4c4' },
        U: { name: '1UP!', col: '#3f9446', col2: '#9bdc5a' }
    };
    Object.entries(PUT).forEach(([k, v]) => { MK['cap' + k] = () => GM.capsule(v.col, v.col2); });
    const MESH = {};
    const mesh = (k) => MESH[k] || (MESH[k] = MK[k]());
    let T = 0;
    const AT = () => Math.floor(T * 15) / 15; // models animate at 15 fps, like they should
    const draw3 = (k, x, y, s, o) => S.drawMesh(g, mesh(k), Object.assign({ x, y, s, rx: 0.22, ry: 0, light: 1, amb: 0.42 }, o));
    const dSpin = (k, a) => { const st = mesh(k).propStart, c = Math.cos(a), s = Math.sin(a); return (p, i) => { if (i >= st) { const y = p[1], z = p[2]; p[1] = y * c - z * s; p[2] = y * s + z * c; } }; };
    const dWave = (start, amp, freq, ph, from) => (p, i) => { if (i >= start) { const k = Math.max(0, from - p[0]); p[1] += Math.sin(ph + p[0] * freq) * amp * k; } };

    /* ---------- tiny 3x5 font for in-world numbers and power-up letters ---------- */
    const F3 = {
        0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
        6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', P: '110101110100100', H: '101101111101101',
        B: '110101110101110', S: '011100010001110', D: '110101101101110', U: '101101101101111', '+': '000010111010000', x: '000101010101000'
    };
    const text3 = (str, x, y, col, out) => {
        str = String(str);
        const w = str.length * 4 - 1;
        x = Math.round(x - w / 2); y = Math.round(y);
        const plot = (dx, dy, c) => {
            [...str].forEach((ch, n) => {
                const gl = F3[ch]; if (!gl) return;
                for (let i = 0; i < 15; i++) if (gl[i] === '1') { g.fillStyle = c; g.fillRect(x + n * 4 + (i % 3) + dx, y + ((i / 3) | 0) + dy, 1, 1); }
            });
        };
        if (out) { plot(-1, 0, out); plot(1, 0, out); plot(0, -1, out); plot(0, 1, out); }
        plot(0, 0, col);
    };

    /* ---------- input ---------- */
    const keys = new Set(), hits = new Set(), pad = new Set();
    let padPrev = new Set();
    const KEYMAP = {
        ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
        KeyZ: 'fire', Space: 'fire', KeyJ: 'fire', KeyX: 'bomb', KeyK: 'bomb', ShiftLeft: 'bomb', ShiftRight: 'bomb',
        Enter: 'ok', NumpadEnter: 'ok', Escape: 'pause', KeyP: 'pause', Backspace: 'back'
    };
    const hitAction = (a) => {
        hits.add(a);
        if (a === 'fire') hits.add('ok');
        if (a === 'bomb') hits.add('back');
        unlockAudio();
    };
    const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
    addEventListener('keydown', (e) => {
        if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
        const a = KEYMAP[e.code];
        if (!a) { if (e.code === 'KeyF') toggleFull(); if (e.code === 'KeyN' && mode === 'title') startGame(); return; }
        e.preventDefault();
        if (!keys.has(a)) hitAction(a);
        keys.add(a);
    });
    addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) keys.delete(a); });
    addEventListener('blur', () => { keys.clear(); if (mode === 'game' && !paused && !frozen) setPause(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game' && !paused && !frozen) setPause(true); });
    const held = (a) => keys.has(a) || pad.has(a) || (a === 'fire' && touch.id != null && mode === 'game');
    const press = (a) => { if (hits.has(a)) { hits.delete(a); return true; } return false; };

    function pollPad() {
        pad.clear();
        const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
        if (gp) {
            const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            if (b(0) || b(2) || b(7)) pad.add('fire');
            if (b(1) || b(3) || b(6)) pad.add('bomb');
            if (b(9)) pad.add('pause');
            if (b(12) || ay < -0.5) pad.add('up');
            if (b(13) || ay > 0.5) pad.add('down');
            if (b(14) || ax < -0.5) pad.add('left');
            if (b(15) || ax > 0.5) pad.add('right');
            pad.forEach((a) => { if (!padPrev.has(a)) hitAction(a); });
        }
        padPrev = new Set(pad);
    }

    // touch: drag anywhere to steer (relative), hold to fire, tap to advance text
    const touch = { id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, dx: 0, dy: 0 };
    let scale = 3;
    screen.addEventListener('pointerdown', (e) => {
        unlockAudio();
        if (e.target.closest('button, input, a, form')) return;
        if (e.pointerType === 'mouse') { if (e.button === 0 && !menu) hitAction('ok'); return; }
        touch.id = e.pointerId; touch.x = touch.sx = e.clientX; touch.y = touch.sy = e.clientY; touch.t = performance.now();
        if (mode !== 'game' || talkOpen() || frozen) hitAction('ok');
        try { screen.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    });
    screen.addEventListener('pointermove', (e) => {
        if (e.pointerId !== touch.id) return;
        touch.dx += (e.clientX - touch.x) / scale; touch.dy += (e.clientY - touch.y) / scale;
        touch.x = e.clientX; touch.y = e.clientY;
        e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => { if (e.pointerId === touch.id) touch.id = null; };
    screen.addEventListener('pointerup', endTouch);
    screen.addEventListener('pointercancel', endTouch);
    $('#tb-bomb').addEventListener('pointerdown', (e) => { e.preventDefault(); hitAction('bomb'); });
    $('#tb-pause').addEventListener('click', () => hitAction('pause'));

    let audioReady = false, wantSong = '';
    function unlockAudio() {
        if (audioReady) return;
        audioReady = true;
        A.unlock();
        if (wantSong) A.music(wantSong);
    }
    const music = (n) => { wantSong = n; if (audioReady) A.music(n); };

    /* ---------- flow helpers: little promises that wait on game time ---------- */
    let clock = 0, flowTok = 0;
    const CANCEL = { cancel: true };
    const waiters = [];
    const until = (fn) => { const tok = flowTok; return new Promise((res, rej) => waiters.push({ fn, res, rej, tok })); };
    const wait = (s) => { const end = clock + s; return until(() => clock >= end); };
    function runWaiters() {
        for (let i = 0; i < waiters.length; i++) {
            const w = waiters[i];
            if (w.tok !== flowTok) { waiters.splice(i--, 1); w.rej(CANCEL); }
            else if (w.fn()) { waiters.splice(i--, 1); w.res(); }
        }
    }
    const newFlow = () => { flowTok++; runWaiters(); };
    const go = (fn) => fn().catch((e) => { if (e !== CANCEL) console.error(e); });

    /* ---------- UI bits ---------- */
    const show = (id, on = true) => { const el = $('#' + id); if (el) el.hidden = !on; };
    let menu = null;
    function setMenu(el) {
        if (!el) { menu = null; return; }
        const items = $$('button', el).filter((b) => !b.hidden);
        menu = { el, items, i: 0 };
        items.forEach((b, j) => { b.onpointerenter = () => { if (menu && menu.el === el) { menu.i = j; markSel(); } }; });
        markSel();
    }
    function markSel() { if (menu) menu.items.forEach((b, j) => b.classList.toggle('sel', j === menu.i)); }
    function menuInput() {
        if (!menu || menu.el.closest('[hidden]')) return;
        const n = menu.items.length;
        if (press('up')) { menu.i = (menu.i + n - 1) % n; markSel(); sfx('move'); }
        if (press('down')) { menu.i = (menu.i + 1) % n; markSel(); sfx('move'); }
        const b = menu.items[menu.i];
        if (b.dataset.cycle) {
            if (press('left')) cycle(b.dataset.cycle, -1);
            if (press('right')) cycle(b.dataset.cycle, 1);
        }
        if (press('ok')) b.click();
        if (press('back') && menu.el.dataset.back) $(`[data-act="${menu.el.dataset.back}"]`, menu.el)?.click();
    }

    let toastT = 0;
    const toast = (txt) => { const el = $('#toast'); el.textContent = txt; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); toastT = 1.6; };

    // Portraits: a dithered 40x40 render of whoever is talking.
    const SPEAKERS = {
        BUB: { name: 'BUB', mesh: 'bub', s: 12, ry: -0.7, bg: '#2a68b3' },
        AUGURK: { name: 'THE AUGURK', mesh: 'sub', s: 11, ry: -0.5, bg: '#1b8a99' },
        GRIDDLE: { name: 'THE GRIDDLE', mesh: 'griddle', s: 8.5, ry: 0.5, x: 18, y: 22, bg: '#6e1a2c' },
        IKA: { name: 'LADY IKA', mesh: 'ika', s: 6.5, ry: 0.4, x: 28, y: 22, bg: '#11214a' },
        LURE: { name: 'THE LURE', mesh: 'lure', s: 8, ry: 0.5, x: 24, y: 24, bg: '#04070f' },
        KING: { name: 'THE SQUID KING', mesh: 'kingC', s: 6.5, ry: 0.35, x: 26, y: 26, bg: '#3d2a1e' }
    };
    const faceCache = {};
    function portrait(who) {
        const sp = SPEAKERS[who];
        if (!sp) return null;
        const key = who + CFG.pal;
        if (faceCache[key]) return faceCache[key];
        const c = document.createElement('canvas');
        c.width = c.height = 40;
        const x = c.getContext('2d', { willReadFrequently: true });
        const gr = x.createLinearGradient(0, 0, 0, 40);
        gr.addColorStop(0, sp.bg); gr.addColorStop(1, '#04070f');
        x.fillStyle = gr; x.fillRect(0, 0, 40, 40);
        S.drawMesh(x, mesh(sp.mesh), { x: sp.x || 20, y: sp.y || 21, s: sp.s, rx: 0.25, ry: sp.ry, light: 1.1, amb: 0.45 });
        const id = x.getImageData(0, 0, 40, 40);
        S.dither(id, pal().pal, pal().spread);
        x.putImageData(id, 0, 0);
        return (faceCache[key] = c.toDataURL());
    }

    let talk = null;
    const talkOpen = () => !!talk;
    async function say(who, text) {
        const sp = SPEAKERS[who];
        $('#talk-who').textContent = sp ? sp.name : (who || '');
        $('#talk-who').hidden = !who;
        const face = $('#talk-face');
        const src = sp ? portrait(who) : null;
        face.hidden = !src;
        if (src) face.src = src;
        $('#talk-text').textContent = '';
        $('#talk').classList.toggle('narrator', !who);
        show('talk');
        talk = { text, n: 0, done: false, ok: false };
        try { await until(() => talk.ok); } finally { talk = null; show('talk', false); }
    }
    function updateTalk(dt) {
        if (!talk) return;
        const el = $('#talk-text');
        if (!talk.done) {
            const before = talk.n | 0;
            talk.n += dt * 48;
            if (press('ok')) talk.n = talk.text.length;
            if ((talk.n | 0) !== before && (talk.n | 0) % 2 === 0) sfx('type');
            if (talk.n >= talk.text.length) talk.done = true;
            el.textContent = talk.text.slice(0, talk.n | 0);
            $('#talk').classList.toggle('done', talk.done);
        } else if (press('ok')) { talk.ok = true; sfx('move'); }
    }

    /* ---------- world state ---------- */
    let mode = 'boot', paused = false, frozen = false;
    let G = null, ST = null, boss = null;
    let E = [], EB = [], PS = [], PU = [], PT = [], CL = [], TELE = [], DEC = [], POP = [], later = [];
    let shake = 0, flash = 0;
    const P = { x: 40, y: 80, alive: true, inv: 0, power: 1, homing: 0, opts: 0, shield: false, bombs: 2, fireCD: 0, homCD: 0, trail: [], ctrl: false, auto: null, deadT: 0, vy: 0 };

    const STAGES = [
        { name: 'SUNLIT SHALLOWS', depth: [0, 200], music: 'stage1', vis: 0, len: 64, boss: 'griddle',
          intro: "Bub here, your co-pilot! Shoot down a whole squid formation, or crack open a takeaway box, and you'll get a power-up.",
          waves: [[1, 'line', 50, 5], [3.5, 'line', 110, 5], [6.5, 'balls', 3], [9, 'crate', 70], [11, 'arc', 'top', 5], [13.5, 'arc', 'bot', 5], [16, 'dive', 4],
              [19, 'balls', 4], [21, 'line', 40, 6], [21.5, 'line', 120, 6], [25, 'crate', 110], [26, 'tako', 80], [30, 'arc', 'top', 6], [32, 'dive', 5],
              [34, 'balls', 5], [37, 'line', 80, 7, 'squidR'], [40, 'tako', 40], [40.5, 'tako', 120], [44, 'crate', 60], [45, 'arc', 'bot', 6], [47, 'dive', 6],
              [50, 'line', 30, 6], [50, 'line', 130, 6], [53, 'balls', 6], [56, 'tako', 80], [57, 'dive', 5], [60, 'line', 80, 8, 'squidR']] },
        { name: 'TWILIGHT REEF', depth: [200, 1000], music: 'stage2', vis: 1, len: 68, boss: 'ika',
          intro: 'The twilight zone. Jellies burst into stinging sparks and mines go BOOM. Pop a mine next to the clan for a chain reaction!',
          waves: [[1, 'jellies', 4], [4, 'line', 60, 6], [6, 'mines', 3], [9, 'tako', 50], [9, 'tako', 110], [12, 'jellies', 5], [14, 'crate', 80], [16, 'eel', 80],
              [20, 'arc', 'top', 6, 'squidR'], [22, 'mines', 4], [25, 'dive', 6], [27, 'jellies', 6], [30, 'balls', 5], [32, 'line', 40, 6, 'squidR'], [32, 'line', 120, 6, 'squidR'],
              [36, 'crate', 60], [37, 'eel', 50], [40, 'tako', 80], [41, 'mines', 5], [45, 'jellies', 6], [47, 'arc', 'bot', 7], [50, 'eel', 110], [52, 'crate', 100],
              [54, 'dive', 7], [57, 'mines', 4], [58, 'tako', 40], [58, 'tako', 120], [62, 'jellies', 7], [64, 'line', 80, 8, 'squidR']] },
        { name: 'MIDNIGHT TRENCH', depth: [1000, 4000], music: 'stage3', vis: 2, len: 68, boss: 'lure',
          intro: "The midnight zone. It's pitch black, so stay close to your headlamp. And if you see a pretty light down here... don't follow it.",
          waves: [[1, 'anglers', 2], [4, 'jellies', 4], [7, 'csub', 60], [9, 'line', 100, 6, 'squidR'], [12, 'anglers', 3], [14, 'crate', 80], [16, 'eel', 60],
              [19, 'mines', 4], [21, 'csub', 40], [21, 'csub', 120], [25, 'anglers', 4], [27, 'jellies', 6], [30, 'eel', 100], [33, 'dive', 7], [35, 'crate', 50],
              [37, 'csubBack', 30], [40, 'mines', 5], [42, 'anglers', 4], [45, 'tako', 80], [47, 'line', 40, 7, 'squidR'], [47, 'line', 120, 7, 'squidR'], [51, 'eel', 80],
              [53, 'csubBack', 130], [55, 'crate', 110], [57, 'anglers', 5], [60, 'csub', 80], [62, 'jellies', 7], [64, 'dive', 8]] },
        { name: 'THE HADAL THRONE', depth: [4000, 10935], music: 'stage4', vis: 3, len: 72, boss: 'king',
          intro: "The hadal zone, almost eleven kilometres down. The Squid King's throne is right ahead. I'm puffing up just thinking about it.",
          waves: [[1, 'line', 50, 7, 'squidR'], [1, 'line', 110, 7, 'squidR'], [4, 'tako', 80], [6, 'balls', 6], [9, 'csubBack', 40], [10, 'crate', 90], [12, 'eel', 70],
              [15, 'mines', 5], [17, 'arc', 'top', 7, 'squidR'], [19, 'arc', 'bot', 7, 'squidR'], [21, 'tako', 40], [21, 'tako', 120], [24, 'jellies', 7], [26, 'anglers', 4],
              [29, 'csub', 60], [29, 'csub', 100], [32, 'crate', 80], [33, 'dive', 8], [36, 'eel', 40], [36, 'eel', 120], [40, 'balls', 7], [42, 'csubBack', 80],
              [44, 'mines', 6], [46, 'tako', 80], [48, 'line', 30, 8, 'squidR'], [48, 'line', 130, 8, 'squidR'], [52, 'crate', 60], [53, 'anglers', 5], [56, 'jellies', 8],
              [58, 'tako', 50], [58, 'tako', 110], [62, 'dive', 9], [64, 'csub', 80], [66, 'crate', 100]] }
    ];

    const VIS = [
        { top: ['#5ab4e8', '#2a68b3'], bot: ['#1f4a8f', '#183268'], far: ['#2a68b3', '#1f4a8f'], floor: ['#d9bd84', '#7a4b2e'], kelp: '#3f9446', kelp2: '#9bdc5a', rays: true, surface: true, snow: '#dff4ff', fish: true },
        { top: ['#1f4a8f', '#11214a'], bot: ['#0e5f6e', '#0b1530'], far: ['#1b8a99', '#0e5f6e'], floor: ['#183268', '#11214a'], kelp: '#ff4fd8', kelp2: '#e8562a', coral: true, snow: '#b5f1e8', fish: true },
        { top: ['#070d1c', '#04070f'], bot: ['#0b1530', '#04070f'], far: ['#11214a', '#070d1c'], floor: ['#183268', '#0b1530'], ceiling: true, snow: '#6fdde0', dark: true },
        { top: ['#2e2e3e', '#04070f'], bot: ['#6e1a2c', '#3d2a1e'], far: ['#3d2a1e', '#2e2e3e'], floor: ['#2e2e3e', '#04070f'], vents: true, pillars: true, snow: '#ff9a1f' }
    ];

    /* ---------- enemies ---------- */
    const ET = {
        squid: { hp: 2, r: 8, pts: 100, mesh: 'squid', s: 7.5 },
        squidR: { hp: 3, r: 8, pts: 150, mesh: 'squidR', s: 7.5 },
        ball: { hp: 4, r: 8, pts: 120, mesh: 'ball', s: 7.5 },
        mini: { hp: 1, r: 5, pts: 40, mesh: 'ball', s: 4.2 },
        tako: { hp: 14, r: 11, pts: 400, mesh: 'tako', s: 8 },
        jelly: { hp: 4, r: 8, pts: 150, mesh: 'jelly', s: 7 },
        mine: { hp: 5, r: 9, pts: 200, mesh: 'mine', s: 7 },
        eel: { hp: 22, r: 9, pts: 800, mesh: 'eelHead', s: 8 },
        csub: { hp: 12, r: 11, pts: 500, mesh: 'clansub', s: 8.5 },
        crate: { hp: 5, r: 10, pts: 250, mesh: 'crate', s: 7.5 },
        angler: { hp: 6, r: 9, pts: 300, mesh: 'angler', s: 9 }
    };
    const spawn = (type, x, y, extra) => {
        const d = ET[type];
        const e = Object.assign({ type, x, y, y0: y, vx: 0, vy: 0, t: 0, hp: Math.ceil(d.hp * (type === 'mini' ? 1 : D().hp)), r: d.r, ph: R() * TAU, flash: 0, rot: 0, ly: y }, extra);
        E.push(e);
        return e;
    };
    const later1 = (dt, fn) => later.push({ at: ST.t + dt, fn });
    const form = (n) => ({ n, killed: 0 });
    const WAVES = {
        line(y, n, type = 'squid') { const f = form(n); for (let i = 0; i < n; i++) spawn(type, W + 14 + i * 17, y, { mv: 'sine', sp: 55, amp: 14, ph: i * 0.55, form: f }); },
        arc(side, n, type = 'squid') {
            const f = form(n), top = side === 'top';
            for (let i = 0; i < n; i++) later1(i * 0.3, () => spawn(type, W - 16, top ? -10 : H + 10, { mv: 'arc', sp: 52, vy: top ? 92 : -92, dir: top ? 1 : -1, form: f }));
        },
        dive(n) { for (let i = 0; i < n; i++) later1(i * 0.35, () => spawn('squid', W + 10, 20 + R() * (H - 40), { mv: 'dive' })); },
        balls(n) { for (let i = 0; i < n; i++) later1(i * 0.5, () => spawn('ball', W + 10, 20 + R() * (H - 50), { vx: -40 - R() * 20, vy: (R() < 0.5 ? -1 : 1) * (35 + R() * 30) })); },
        crate(y) { spawn('crate', W + 12, y); },
        tako(y) { spawn('tako', W + 14, y, { stop: 168 + R() * 34 }); },
        jellies(n) { for (let i = 0; i < n; i++) later1(i * 0.6, () => { const x = 80 + R() * 150; spawn('jelly', x, H + 14, { x0: x, vy: -17 - R() * 9 }); }); },
        mines(n) { for (let i = 0; i < n; i++) later1(i * 0.7, () => spawn('mine', W + 12, 22 + R() * (H - 44))); },
        eel(y) { spawn('eel', W + 16, y, { hist: [] }); },
        csub(y) { spawn('csub', W + 20, y, { stop: 180 + R() * 24 }); },
        csubBack(y) { spawn('csub', -26, y, { back: true }); toast('BEHIND YOU!'); sfx('sonar'); },
        anglers(n) { for (let i = 0; i < n; i++) later1(i * 0.8, () => spawn('angler', W + 12, 20 + R() * (H - 40))); }
    };

    const fire = (x, y, a, sp, kind = 'ink') => {
        sp *= D().bs;
        EB.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, t: 0, r: kind === 'big' || kind === 'blob' ? 3.5 : kind === 'torp' ? 2.5 : 2 });
    };
    const aimAt = (x, y) => Math.atan2(P.y - y, P.x - x);
    const aim = (x, y, sp, spreads = [0], kind) => { const a = aimAt(x, y); spreads.forEach((s) => fire(x, y, a + s, sp, kind)); };
    const ring = (x, y, n, sp, off = 0, kind) => { for (let i = 0; i < n; i++) fire(x, y, off + (i / n) * TAU, sp, kind); };
    const shooter = (e, dt, period, fn) => {
        if (e.cd == null) e.cd = period * (0.4 + R() * 0.8);
        e.cd -= dt * D().fire;
        if (e.cd <= 0 && e.x < W - 6 && e.x > 16 && P.alive) { e.cd = period; fn(); }
    };

    function updEnemy(e, dt) {
        e.t += dt; e.flash = Math.max(0, e.flash - dt);
        const py = e.y;
        switch (e.type) {
            case 'squid': case 'squidR':
                if (e.mv === 'sine') { e.x -= e.sp * dt; e.y = e.y0 + Math.sin(e.t * 2.6 + e.ph) * e.amp; }
                else if (e.mv === 'arc') { e.x -= e.sp * dt; e.y += e.vy * dt; e.vy -= e.dir * 62 * dt; }
                else if (e.mv === 'dive') {
                    if (e.t < 0.9) e.x -= 70 * dt;
                    else { if (!e.aimed) { e.aimed = true; const a = aimAt(e.x, e.y); e.vx = Math.cos(a) * 100; e.vy = Math.sin(a) * 100; } e.x += e.vx * dt; e.y += e.vy * dt; }
                }
                if (e.type === 'squidR') shooter(e, dt, 2.4, () => aim(e.x, e.y, 52));
                break;
            case 'ball': case 'mini':
                e.x += e.vx * dt; e.y += e.vy * dt;
                if ((e.y < 12 && e.vy < 0) || (e.y > H - 14 && e.vy > 0)) e.vy = -e.vy;
                e.rot += e.vx * dt * -0.12;
                break;
            case 'tako':
                if (e.x > e.stop && e.t < 8) e.x -= 50 * dt;
                e.y = e.y0 + Math.sin(e.t * 1.6) * 10;
                if (e.t > 8) { e.y0 += (e.y0 < H / 2 ? -40 : 40) * dt; e.x -= 25 * dt; }
                if (e.t < 8) shooter(e, dt, 1.9, () => { e.burst = 3; e.bt = 0; });
                if (e.burst > 0) { e.bt -= dt; if (e.bt <= 0) { e.bt = 0.13; e.burst--; aim(e.x - 6, e.y, 62, ST.i >= 2 ? [-0.2, 0, 0.2] : [0]); sfx('pop'); } }
                break;
            case 'jelly':
                e.y += e.vy * dt;
                e.x = e.x0 + Math.sin(e.t * 1.2 + e.ph) * 10 - e.t * 10;
                break;
            case 'mine':
                e.x -= 22 * dt; e.y = e.y0 + Math.sin(e.t * 1.5 + e.ph) * 3;
                break;
            case 'eel':
                e.x -= 38 * dt; e.y = e.y0 + Math.sin(e.t * 2.4) * 28;
                e.hist.unshift([e.x, e.y]); if (e.hist.length > 90) e.hist.pop();
                shooter(e, dt, 2.2, () => aim(e.x - 8, e.y, 55));
                break;
            case 'csub':
                if (e.back) { e.x += 58 * dt; e.y += clamp(P.y - e.y, -1, 1) * 18 * dt; shooter(e, dt, 1.5, () => aim(e.x + 8, e.y, 50, [-0.15, 0.15])); }
                else {
                    if (e.x > e.stop && e.t < 9) e.x -= 45 * dt;
                    else if (e.t < 9) e.y += clamp(P.y - e.y, -1, 1) * 22 * dt;
                    else e.x -= 70 * dt;
                    if (e.t < 9) shooter(e, dt, 2.1, () => { fire(e.x - 12, e.y - 3, Math.PI, 70, 'torp'); fire(e.x - 12, e.y + 3, Math.PI, 70, 'torp'); });
                }
                break;
            case 'crate':
                e.x -= 24 * dt; e.y = e.y0 + Math.sin(e.t * 2) * 4;
                break;
            case 'angler':
                e.x -= (e.lunge ? 95 : 32) * dt;
                if (!e.lunge && Math.abs(P.y - e.y) < 14 && e.x > P.x && e.x - P.x < 120) { e.lunge = true; sfx('chomp'); }
                e.y += clamp(P.y - e.y, -1, 1) * 14 * dt;
                break;
        }
        e.vyv = (e.y - py) / Math.max(dt, 1e-4);
        if (e.t > 2 && (e.x < -40 || e.x > W + 90 || e.y < -40 || e.y > H + 40)) e.gone = true;
    }

    function hurtEnemy(e, dmg) {
        if (e.dead) return;
        e.hp -= dmg; e.flash = 0.08;
        if (e.hp <= 0) killEnemy(e, true);
        else sfx('hit');
    }
    function killEnemy(e, byPlayer) {
        if (e.dead) return;
        e.dead = true;
        const d = ET[e.type];
        explode(e.x, e.y, e.r > 9 ? 1.6 : 1);
        sfx(e.r > 9 ? 'boom' : 'pop');
        if (!byPlayer) return;
        addScore(d.pts, e.x, e.y);
        ST.kills++;
        for (let i = 0, n = 1 + ((e.r / 6) | 0); i < n; i++) PU.push({ k: 'pearl', x: e.x, y: e.y, vx: (R() - 0.5) * 60, vy: (R() - 0.5) * 60, t: 0 });
        if (e.form && ++e.form.killed === e.form.n) dropPU(e.x, e.y);
        if (e.type === 'crate') dropPU(e.x, e.y);
        if (e.type === 'ball') for (const s of [-1, 1]) spawn('mini', e.x, e.y, { vx: -55, vy: s * 60 });
        if (e.type === 'jelly' && ST.i >= 1) ring(e.x, e.y, 6, 40, R());
        if (e.type === 'mine') {
            part(e.x, e.y, 0, 0, 0.5, 'ring', '#ffffff', 10);
            shake = Math.max(shake, 0.25);
            for (const o of E) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 34) setTimeout(() => hurtEnemy(o, 8), 90);
            if (ST.i >= 1 && CFG.diff !== 'rookie') ring(e.x, e.y, 8, 38, R());
        }
        if (e.type === 'eel') e.hist.slice(0, 40).forEach((h, i) => { if (i % 5 === 4) setTimeout(() => explode(h[0], h[1], 0.7), i * 12); });
    }

    function drawEnemy(e) {
        const d = ET[e.type], at = AT();
        const o = { ry: Math.PI - 0.35, rx: 0.25 };
        if (e.flash > 0) { o.fog = [255, 255, 255]; o.fogAmt = 0.8; }
        switch (e.type) {
            case 'squid': case 'squidR':
                o.rz = clamp(-(e.vyv || 0) * 0.008, -0.7, 0.7);
                o.deform = dWave(0, 0.35, 3, at * 10 + e.ph, -0.45);
                break;
            case 'ball': case 'mini': o.rz = e.rot; o.ry = e.rot * 0.4; break;
            case 'tako': { const st = mesh('tako').legStart; o.ry = Math.PI - 0.6; o.deform = (p, i) => { if (i >= st) p[0] += Math.sin(at * 7 + p[2] * 3) * 0.18 * (-p[1] - 0.2); }; break; }
            case 'jelly': { const k = 1 + Math.sin(at * 4 + e.ph) * 0.14; o.ry = at * 0.8; o.deform = (p) => { if (p[1] > -0.25) { p[0] *= k; p[2] *= k; } else { p[0] += Math.sin(at * 3 + p[1] * 2) * 0.1; } }; break; }
            case 'mine': o.ry = at * 1.2 + e.ph; o.rz = at * 0.6; break;
            case 'eel': {
                const hs = e.hist;
                for (let j = 7; j >= 0; j--) {
                    const h = hs[Math.min(hs.length - 1, (j + 1) * 5)];
                    if (h) draw3('eelSeg', h[0], h[1], 7 * (1 - j * 0.05), { ry: Math.PI - 0.35, rx: 0.25, fog: o.fog, fogAmt: o.fogAmt });
                }
                o.rz = clamp(-(e.vyv || 0) * 0.008, -0.6, 0.6);
                break;
            }
            case 'csub': o.ry = e.back ? -0.35 : Math.PI - 0.35; o.deform = dSpin('clansub', at * 20); break;
            case 'crate': o.ry = at * 1.4; o.rx = 0.45; break;
            case 'angler': o.ry = Math.PI - 0.3; o.rz = e.lunge ? Math.sin(at * 20) * 0.1 : 0; break;
        }
        draw3(d.mesh, e.x, e.y, d.s, o);
    }

    /* ---------- particles ---------- */
    const part = (x, y, vx, vy, life, kind, col, r) => PT.push({ x, y, vx, vy, life, max: life, kind, col, r });
    function explode(x, y, size = 1) {
        part(x, y, 0, 0, 0.3 + size * 0.1, 'ring', '#fff1a6', 3 * size);
        const n = (6 + size * 6) | 0;
        for (let i = 0; i < n; i++) { const a = R() * TAU, sp = (20 + R() * 55) * size; part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.25 + R() * 0.4, 'fire', null, (2 + R() * 3) * Math.sqrt(size)); }
        for (let i = 0; i < 2 * size; i++) part(x + (R() - 0.5) * 6, y, (R() - 0.5) * 16, -8 - R() * 14, 0.8 + R() * 0.8, 'smoke', null, 3 + R() * 3 * size);
        for (let i = 0; i < 3 * size; i++) part(x, y, (R() - 0.5) * 30, -15 - R() * 25, 1 + R(), 'bubble', null, 1 + R());
    }
    function updParts(dt) {
        for (let i = PT.length - 1; i >= 0; i--) {
            const p = PT[i];
            p.life -= dt;
            if (p.life <= 0) { PT.splice(i, 1); continue; }
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.kind === 'fire') { p.vx *= 0.9; p.vy *= 0.9; }
            if (p.kind === 'bubble') { p.vy -= 20 * dt; p.x += Math.sin(p.life * 9) * 0.3; }
            if (p.kind === 'smoke') { p.vy -= 4 * dt; }
        }
    }
    function drawParts() {
        for (const p of PT) {
            const k = p.life / p.max;
            if (p.kind === 'fire') {
                g.fillStyle = k > 0.75 ? '#ffffff' : k > 0.5 ? '#fff1a6' : k > 0.32 ? '#ffd23f' : k > 0.16 ? '#ff9a1f' : '#b52a2a';
                g.beginPath(); g.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, TAU); g.fill();
            } else if (p.kind === 'smoke') {
                g.globalAlpha = k * 0.55; g.fillStyle = '#6b6b80';
                g.beginPath(); g.arc(p.x, p.y, p.r * (1.4 - k * 0.5), 0, TAU); g.fill(); g.globalAlpha = 1;
            } else if (p.kind === 'bubble') {
                g.strokeStyle = '#dff4ff'; g.lineWidth = 1;
                g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
            } else if (p.kind === 'ring') {
                g.strokeStyle = p.col; g.lineWidth = 2 * k + 0.5;
                g.beginPath(); g.arc(p.x, p.y, p.r + (1 - k) * p.r * 4, 0, TAU); g.stroke();
            } else if (p.kind === 'spark') {
                g.fillStyle = p.col; g.fillRect(p.x | 0, p.y | 0, 1, 1);
            }
        }
    }

    /* ---------- score, pickups ---------- */
    const hiScore = () => Math.max(scores()[0][1], G ? G.score : 0);
    function addScore(n, x, y) {
        if (!G) return;
        G.score += n;
        if (x != null && n >= 100) POP.push({ x, y, txt: '' + n, t: 0.8 });
        if (G.score >= G.extendAt) { G.extendAt += 80000; G.lives++; toast('EXTRA SUB!'); sfx('oneup'); }
    }
    function choosePU() {
        const c = [];
        if (P.power < 4) c.push(['P', 5]);
        if (P.homing < 2) c.push(['H', 2]);
        if (P.opts < 2) c.push(['B', 2]);
        if (!P.shield) c.push(['S', 2]);
        if (P.bombs < 5) c.push(['D', 2]);
        c.push(['U', 0.35]);
        let r = R() * c.reduce((a, b) => a + b[1], 0);
        for (const [k, w] of c) { if ((r -= w) <= 0) return k; }
        return 'P';
    }
    const dropPU = (x, y, k) => PU.push({ k: k || choosePU(), x: clamp(x, 20, W - 20), y: clamp(y, 20, H - 20), vx: -16, vy: 0, t: 0 });
    function collect(p) {
        if (p.k === 'pearl') { addScore(10); ST.pearls++; sfx('pearl'); return; }
        if (p.k === 'great') { G.gotPearl = true; sfx('oneup'); flash = 1; return; }
        const t = PUT[p.k];
        sfx(p.k === 'U' ? 'oneup' : 'power');
        let name = t.name;
        if (p.k === 'P') { if (P.power < 4) P.power++; else { addScore(1000, p.x, p.y); name = 'MAX POWER +1000'; } }
        if (p.k === 'H') { if (P.homing < 2) P.homing++; else { addScore(1000, p.x, p.y); name = 'HOMING MAX +1000'; } }
        if (p.k === 'B') { if (P.opts < 2) P.opts++; else { addScore(1000, p.x, p.y); name = 'BUB +1000'; } }
        if (p.k === 'S') P.shield = true;
        if (p.k === 'D') P.bombs = Math.min(5, P.bombs + 1);
        if (p.k === 'U') G.lives++;
        toast(name);
    }

    /* ---------- player ---------- */
    function resetPlayer(full) {
        Object.assign(P, { x: -30, y: H / 2, alive: true, inv: 0, fireCD: 0, homCD: 0, trail: [], ctrl: false, auto: { x: 46 }, deadT: 0, vy: 0 });
        if (full) Object.assign(P, { power: 1, homing: 0, opts: 0, shield: false, bombs: 2 });
    }
    function playerHit() {
        if (!P.alive || P.inv > 0 || !G) return;
        if (P.shield) {
            P.shield = false; P.inv = 1.2; sfx('shield'); toast('SHIELD POPPED');
            for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; part(P.x, P.y, Math.cos(a) * 50, Math.sin(a) * 50, 0.6, 'bubble', null, 1.5); }
            return;
        }
        P.alive = false; P.deadT = 1.6;
        explode(P.x, P.y, 2.2); sfx('hurt'); sfx('bigboom');
        shake = 0.6; flash = 0.6;
        ST.noMiss = false;
        G.lives--;
        P.power = Math.max(1, P.power - 1); P.homing = Math.max(0, P.homing - 1); P.opts = Math.max(0, P.opts - 1);
        P.bombs = Math.max(P.bombs, 2);
        EB.length = 0;
    }
    function updPlayer(dt) {
        if (!P.alive) {
            P.deadT -= dt;
            if (P.deadT <= 0) {
                if (G.lives <= 0) { openContinue(); return; }
                resetPlayer(false); P.inv = 2.6;
                P.ctrl = !talkOpen();
            }
            return;
        }
        P.inv = Math.max(0, P.inv - dt);
        const ox = P.x, oy = P.y;
        if (P.auto) {
            P.x += (P.auto.x - P.x) * Math.min(1, dt * 3); P.y += (H / 2 - P.y) * Math.min(1, dt * 2);
            if (Math.abs(P.x - P.auto.x) < 1) P.auto = null;
        } else if (P.ctrl) {
            const sp = 96;
            let mx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0), my = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
            if (mx && my) { mx *= 0.7071; my *= 0.7071; }
            P.x += mx * sp * dt + touch.dx * 1.25; P.y += my * sp * dt + touch.dy * 1.25;
            P.x = clamp(P.x, 12, W - 16); P.y = clamp(P.y, 14, H - 10);
        }
        P.vy = (P.y - oy) / Math.max(dt, 1e-4);
        if (ox !== P.x || oy !== P.y) { P.trail.unshift([P.x, P.y]); if (P.trail.length > 40) P.trail.pop(); }
        if (R() < dt * 6) part(P.x - 16, P.y + (R() - 0.5) * 3, -20, -5, 0.8, 'bubble', null, 0.8 + R() * 0.6);
        if (!P.ctrl) return;
        P.fireCD -= dt; P.homCD -= dt;
        if (held('fire') && P.fireCD <= 0) {
            P.fireCD = 0.11;
            const x = P.x + 14, y = P.y + 1;
            const shot = (sx, sy, a) => PS.push({ x: sx, y: sy, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, dmg: 1, k: 't' });
            if (P.power === 1) shot(x, y, 0);
            else { shot(x, y - 3, 0); shot(x, y + 3, 0); }
            if (P.power >= 3) { shot(x - 3, y - 4, -0.16); shot(x - 3, y + 4, 0.16); }
            if (P.power >= 4) { shot(x - 5, y - 5, -0.36); shot(x - 5, y + 5, 0.36); }
            for (let i = 0; i < P.opts; i++) { const o = optPos(i); shot(o[0] + 5, o[1], 0); }
            sfx('shot');
        }
        if (P.homing && P.homCD <= 0 && held('fire')) {
            P.homCD = P.homing === 1 ? 0.6 : 0.34;
            for (const s of [-1, 1]) PS.push({ x: P.x, y: P.y + s * 4, vx: 40, vy: s * 70, dmg: 2, k: 'h', life: 2.2 });
            sfx('homing');
        }
        if (press('bomb') && P.bombs > 0) depthCharge();
    }
    const optPos = (i) => {
        const tr = P.trail, k = (i + 1) * 12;
        const p = tr[Math.min(tr.length - 1, k)] || [P.x - 18 * (i + 1), P.y];
        return [p[0] - 14 - i * 4, p[1] + (i ? 6 : -6)];
    };
    function depthCharge() {
        P.bombs--; P.inv = Math.max(P.inv, 1.6);
        sfx('bomb'); shake = 0.8; flash = 1;
        for (const b of EB) part(b.x, b.y, 0, -10, 0.4, 'bubble', null, 1.5);
        EB.length = 0;
        for (let i = 0; i < 4; i++) part(P.x + 20, P.y, 0, 0, 0.6 + i * 0.15, 'ring', '#ffffff', 10 + i * 8);
        for (const e of E) hurtEnemy(e, 14);
        if (boss && !boss.entering && !boss.beaten) hurtBoss(28);
    }

    /* ---------- bosses ---------- */
    const BOSS = {
        griddle: { name: 'THE GRIDDLE', title: "the clan's flying kitchen", hp: 300, mesh: 'griddle', s: 13, pts: 10000, who: 'GRIDDLE', home: 182,
            hi: "A pickle? In MY waters? I'll grill you golden brown!", bye: "Sizzle... you've beaten the kitchen, little pickle. But Lady Ika is waiting in the twilight!" },
        ika: { name: 'LADY IKA', title: 'ink queen of the twilight', hp: 430, mesh: 'ika', s: 10.5, pts: 15000, who: 'IKA', home: 186,
            hi: 'Ohoho! What a cute little sub. Let me give you a makeover... in INK!', bye: 'You got ink on my good tentacles! Go on then, sink. Nobody comes back up from the midnight zone.' },
        lure: { name: 'THE LURE', title: "a light you shouldn't follow", hp: 500, mesh: 'lure', s: 12, pts: 20000, who: 'LURE', home: 180,
            hi: '*bzzt* HELLO, LITTLE FISH. FOLLOW. THE. LIGHT.', bye: '*bzzt* LIGHT... FADING... THE KING... WILL... *bzzzt* ...tell my lightbulb I love her.' },
        king: { name: 'THE SQUID KING', title: 'ruler of the Takoyaki Clan', hp: 780, mesh: 'king', s: 11, pts: 50000, who: 'KING', home: 176,
            hi: "So YOU'RE the gherkin who's been sinking my clan. Kneel before your king! ...Oh, you can't kneel. You're a submarine.", bye: 'My pearl! My beautiful shiny pearl! ...Fine. Keep it. The sea was too green anyway.' }
    };
    function spawnBoss(k) {
        const d = BOSS[k];
        boss = { k, d, x: W + 80, y: H / 2, hp: d.hp * D().hp, max: d.hp * D().hp, t: 0, pt: 0, pat: 0, flash: 0, entering: true, talk: false, beaten: false, dying: 0, dead: false, jaw: 0, glow: 0, ang: 0, step: 0, cds: {}, o: null, crown: null, bornAt: clock };
        $('#boss-name').textContent = d.name;
        show('bossbar');
    }
    const every = (b, key, period, dt) => { b.cds[key] = (b.cds[key] == null ? 0 : b.cds[key]) - dt * D().fire; if (b.cds[key] <= 0) { b.cds[key] += period; return true; } return false; };
    const bossCircles = (b) => {
        const s = b.d.s, x = b.x, y = b.y;
        switch (b.k) {
            case 'griddle': return [[x - 1.1 * s, y, 0.6 * s], [x, y, 0.65 * s], [x + 1.1 * s, y, 0.6 * s]];
            case 'ika': return [[x + 1.2 * s, y, 0.85 * s], [x, y, 0.85 * s], [x - 1.6 * s, y, 0.6 * s], [x - 2.8 * s, y, 0.4 * s]];
            case 'lure': return [[x - 0.3 * s, y, 1.15 * s], [x + 1.3 * s, y, 0.6 * s]];
            case 'king': return [[x + 1.0 * s, y, 0.95 * s], [x, y, 0.95 * s], [x - 1.6 * s, y, 0.6 * s]];
        }
        return [];
    };
    function hurtBoss(dmg) {
        const b = boss;
        if (!b || b.entering || b.beaten || b.talk) return;
        b.hp -= dmg; b.flash = 0.06;
        if (b.hp <= 0) {
            b.hp = 0; b.beaten = true; b.beatAt = clock;
            sfx('bigboom'); shake = 0.6; flash = 0.8;
            EB.length = 0;
            for (const e of E) killEnemy(e, false);
            if (b.crown) { explode(b.crown.x, b.crown.y, 1.5); b.crown = null; }
        } else sfx('clank');
    }
    function updBoss(dt) {
        const b = boss;
        if (!b) return;
        b.t += dt; b.flash = Math.max(0, b.flash - dt);
        $('#boss-hp').style.width = (100 * b.hp / b.max) + '%';
        if (b.dying > 0) {
            b.dying -= dt;
            b.x += (R() - 0.5) * 2; b.y += 6 * dt;
            if (R() < dt * 14) { const c = bossCircles(b)[(R() * 3) | 0] || [b.x, b.y, 10]; explode(c[0] + (R() - 0.5) * c[2] * 2, c[1] + (R() - 0.5) * c[2] * 2, 1.2); sfx('boom'); }
            shake = Math.max(shake, 0.2);
            if (b.dying <= 0) {
                explode(b.x, b.y, 4); explode(b.x - 20, b.y, 3); sfx('bigboom'); flash = 1; shake = 1;
                addScore(b.d.pts, b.x, b.y);
                if (b.k === 'king') PU.push({ k: 'great', x: b.x, y: b.y, vx: 0, vy: 0, t: 0 });
                else { dropPU(b.x, b.y - 14); dropPU(b.x, b.y + 14); }
                b.dead = true; boss = null; show('bossbar', false);
            }
            return;
        }
        if (b.beaten) { b.x += (R() - 0.5) * 1.2; return; }
        const home = b.d.home;
        if (b.entering) {
            b.x -= 45 * dt; b.y += (H / 2 - b.y) * dt;
            if (b.x <= home) { b.x = home; b.entering = false; }
            return;
        }
        if (b.talk) return;
        BU[b.k](b, dt);
        if (b.crown) updCrown(b, dt);
    }
    const nextPat = (b, dur) => { if (b.pt > dur) { b.pt = 0; b.pat++; b.cds = {}; b.step = 0; return true; } return false; };
    const BU = {
        griddle(b, dt) {
            b.pt += dt;
            const p2 = b.hp < b.max * 0.5;
            const pats = p2 ? ['flakes', 'charge', 'balls', 'sauce', 'charge'] : ['flakes', 'balls', 'sauce'];
            const pat = pats[b.pat % pats.length];
            if (pat !== 'charge') { b.x += (b.d.home - b.x) * dt * 2; b.y += (H / 2 + Math.sin(b.t * 0.8) * 38 - b.y) * dt * 2; }
            if (pat === 'flakes') { if (every(b, 'f', p2 ? 0.55 : 0.75, dt)) { aim(b.x - 20, b.y, 58, [-0.5, -0.25, 0, 0.25, 0.5], 'flake'); sfx('pop'); } nextPat(b, 3.6); }
            else if (pat === 'balls') { if (every(b, 'b', 0.55, dt)) { spawn('mini', b.x - 8, b.y - 12, { vx: -55 - R() * 25, vy: -40 - R() * 30 }); sfx('pop'); } nextPat(b, 3); }
            else if (pat === 'sauce') { if (every(b, 's', 0.13, dt)) { EB.push({ x: b.x - 10, y: b.y - 8, vx: (-30 - R() * 60) * D().bs, vy: -60 - R() * 40, kind: 'sauce', t: 0, r: 2, grav: 75 }); } nextPat(b, 3); }
            else if (pat === 'charge') {
                if (b.pt < 0.05) { b.ty = P.y; sfx('charge'); TELE.push({ y: P.y, life: 0.9 }); }
                if (b.pt < 0.9) { b.y += (b.ty - b.y) * dt * 4; b.x = b.d.home + (R() - 0.5) * 3; }
                else if (b.pt < 1.8) b.x = Math.max(36, b.x - 280 * dt);
                else b.x += (b.d.home - b.x) * dt * 3;
                nextPat(b, 3);
            }
        },
        ika(b, dt) {
            b.pt += dt;
            const p2 = b.hp < b.max * 0.5, s = b.d.s;
            const pats = p2 ? ['spiral', 'dash', 'clouds', 'escort', 'dash'] : ['spiral', 'clouds', 'escort', 'dash'];
            const pat = pats[b.pat % pats.length];
            if (pat !== 'dash') { b.x += (b.d.home - b.x) * dt * 1.5; b.y += (H / 2 + Math.sin(b.t * 0.6) * 30 - b.y) * dt * 2; }
            if (pat === 'spiral') {
                if (every(b, 'sp', 0.085, dt)) { b.ang += 0.37; const arms = p2 ? 3 : 2; for (let i = 0; i < arms; i++) fire(b.x - s, b.y, b.ang + (i / arms) * TAU, 46); }
                nextPat(b, 3.6);
            } else if (pat === 'clouds') {
                if (every(b, 'c', 1, dt)) { aim(b.x - s * 1.5, b.y, 34, [0], 'blob'); sfx('chomp'); }
                nextPat(b, 3.5);
            } else if (pat === 'escort') {
                if (b.pt < 0.05) { WAVES.line(28, 4, 'squid'); WAVES.line(H - 28, 4, 'squid'); }
                if (every(b, 'a', 0.7, dt)) aim(b.x - s, b.y, 60, [-0.15, 0, 0.15]);
                nextPat(b, 2.6);
            } else if (pat === 'dash') {
                if (b.pt < 0.05) { b.ty = P.y; sfx('charge'); }
                if (b.pt < 1) { b.x += (W + 70 - b.x) * dt * 3; if (b.pt > 0.2 && !b.tele) { b.tele = true; TELE.push({ y: b.ty, life: 1.1 }); } }
                else if (b.pt < 1.1) { b.y = b.ty; b.x = W + 60; }
                else if (b.pt < 3) { b.x -= 240 * dt; if (every(b, 'dd', 0.12, dt)) { fire(b.x + s, b.y, -Math.PI / 2, 30); fire(b.x + s, b.y, Math.PI / 2, 30); } }
                else { if (b.x < -60) { b.x = W + 80; b.y = H / 2; } b.x += (b.d.home - b.x) * dt * 2; }
                if (nextPat(b, 4.6)) b.tele = false;
            }
        },
        lure(b, dt) {
            b.pt += dt;
            const p2 = b.hp < b.max * 0.5;
            const pats = p2 ? ['flash', 'chomp', 'stream', 'flash', 'spawn', 'chomp'] : ['flash', 'stream', 'chomp', 'spawn'];
            const pat = pats[b.pat % pats.length];
            b.glow += (0 - b.glow) * dt * 3;
            if (pat !== 'chomp') { b.x += (b.d.home - b.x) * dt * 1.5; b.y += (H / 2 + Math.sin(b.t * 0.5) * 32 - b.y) * dt * 1.5; b.jaw += (0.1 - b.jaw) * dt * 4; }
            const tip = b.tip || [b.x - 25, b.y - 18];
            if (pat === 'flash') {
                if (b.pt < 0.05) sfx('charge');
                if (b.pt < 0.9) b.glow = Math.min(1, b.pt / 0.9);
                if (b.step === 0 && b.pt >= 0.9) { b.step = 1; ring(tip[0], tip[1], p2 ? 20 : 16, 44); sfx('zap'); sfx('pop'); }
                if (b.step === 1 && b.pt >= 1.4) { b.step = 2; ring(tip[0], tip[1], p2 ? 20 : 16, 36, TAU / 32); }
                nextPat(b, 2.6);
            } else if (pat === 'stream') {
                if (every(b, 'st', 0.15, dt)) fire(b.x - 16, b.y + 4, aimAt(b.x - 16, b.y + 4) + Math.sin(b.t * 6) * 0.25, 62);
                nextPat(b, 2.4);
            } else if (pat === 'chomp') {
                if (b.pt < 0.05) { b.ty = P.y; sfx('charge'); }
                if (b.pt < 0.9) { b.y += (P.y - b.y) * dt * 3; b.jaw += (0.75 - b.jaw) * dt * 5; if (b.pt > 0.3 && !b.tele) { b.tele = true; TELE.push({ y: b.y, life: 0.6 }); } }
                else if (b.pt < 1.5) { b.x = Math.max(48, b.x - 300 * dt); if (b.x <= 60 && !b.bit) { b.bit = true; b.jaw = 0; sfx('chomp'); shake = 0.3; } }
                else b.x += (b.d.home - b.x) * dt * 2.4;
                if (nextPat(b, 2.9)) { b.tele = false; b.bit = false; }
            } else if (pat === 'spawn') {
                if (every(b, 'sw', 0.6, dt) && b.pt < 1.9) spawn('angler', b.x - 10, b.y + (R() - 0.5) * 30, { lunge: false });
                nextPat(b, 2.2);
            }
        },
        king(b, dt) {
            b.pt += dt;
            const k = b.hp / b.max, s = b.d.s;
            const phase = k > 0.6 ? 1 : k > 0.25 ? 2 : 3;
            if (phase >= 2 && !b.crownGone) {
                b.crownGone = true;
                b.crown = { x: b.x + 0.5 * s, y: b.y - 1.2 * s, hp: 90 * D().hp, a: 0, flash: 0, cd: 1.5 };
                toast('THE CROWN COMES ALIVE!'); sfx('warn');
                b.pat = 0; b.pt = 0;
            }
            if (phase === 3 && !b.rage) { b.rage = true; toast('THE KING IS FURIOUS!'); sfx('bigboom'); shake = 0.5; b.pat = 0; b.pt = 0; }
            const pats = phase === 1 ? ['jewels', 'spiral', 'balls'] : phase === 2 ? ['walls', 'aimed', 'spiral'] : ['flower', 'walls', 'flower', 'aimed'];
            const pat = pats[b.pat % pats.length];
            b.x += (b.d.home - b.x) * dt * 1.5;
            b.y += (H / 2 + Math.sin(b.t * (phase === 3 ? 0.9 : 0.6)) * 36 - b.y) * dt * 2;
            const cx = b.x + 0.5 * s, cy = b.y - 1.3 * s;
            if (pat === 'jewels') { if (every(b, 'j', 0.55, dt)) { aim(cx, cy, 56, [-0.4, -0.2, 0, 0.2, 0.4], 'big'); sfx('pop'); } nextPat(b, 3.3); }
            else if (pat === 'spiral') { if (every(b, 'sp', 0.1, dt)) { b.ang += 0.31; fire(b.x - s, b.y, b.ang, 46); fire(b.x - s, b.y, -b.ang + Math.PI, 46); } nextPat(b, 3.6); }
            else if (pat === 'balls') { if (every(b, 'b', 0.55, dt) && b.pt < 2.4) spawn('ball', b.x - 20, b.y + (R() - 0.5) * 40, { vx: -50, vy: (R() < 0.5 ? -1 : 1) * 50 }); nextPat(b, 3); }
            else if (pat === 'walls') {
                if (every(b, 'w', phase === 3 ? 0.75 : 0.95, dt)) {
                    const gap = 20 + ((Math.sin(b.t * 1.3) + 1) / 2) * (H - 50);
                    for (let y = 8; y < H - 4; y += 8) if (Math.abs(y - gap) > 15) EB.push({ x: b.x - 2 * s, y, vx: -52 * D().bs, vy: 0, kind: 'ink', t: 0, r: 2 });
                    sfx('pop');
                }
                nextPat(b, 4.2);
            } else if (pat === 'aimed') { if (every(b, 'a', 0.5, dt)) aim(b.x - s, b.y, 66, [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45]); nextPat(b, 2.6); }
            else if (pat === 'flower') { if (every(b, 'fl', 0.13, dt)) { b.ang += 0.19; ring(b.x - s, b.y, 6, 44, b.ang); } nextPat(b, 3.4); }
        }
    };
    function updCrown(b, dt) {
        const c = b.crown;
        c.a += dt * 1.1; c.flash = Math.max(0, c.flash - dt);
        c.x += (b.x - 40 + Math.cos(c.a) * 46 - c.x) * dt * 2;
        c.y += (H / 2 + Math.sin(c.a * 1.4) * 52 - c.y) * dt * 2;
        c.cd -= dt * D().fire;
        if (c.cd <= 0) { c.cd = 2.2; ring(c.x, c.y, 10, 38, c.a); sfx('pop'); }
    }
    function hurtCrown(dmg) {
        const c = boss && boss.crown;
        if (!c) return;
        c.hp -= dmg; c.flash = 0.06;
        if (c.hp <= 0) { explode(c.x, c.y, 2); sfx('boom'); addScore(5000, c.x, c.y); toast('CROWN SMASHED! +5000'); dropPU(c.x, c.y); boss.crown = null; }
    }
    function drawBoss() {
        const b = boss;
        if (!b) return;
        const at = AT(), s = b.d.s;
        const o = { x: b.x, y: b.y, s, rx: 0.2, ry: 0.32, light: 1, amb: 0.45 };
        if (b.beaten && Math.floor(T * 16) % 2) { o.fog = [255, 255, 255]; o.fogAmt = 0.7; }
        else if (b.flash > 0 && Math.floor(T * 30) % 2) { o.fog = [255, 255, 255]; o.fogAmt = 0.35; }
        if (b.k === 'king' && b.rage && !o.fog) { o.fog = [232, 86, 42]; o.fogAmt = 0.25 + Math.sin(T * 10) * 0.1; }
        if (b.k === 'griddle') {
            const st = mesh('griddle').flameStart;
            o.rz = b.pat % 5 === 1 && b.hp < b.max * 0.5 ? 0.1 : Math.sin(at * 1.5) * 0.04;
            o.deform = (p, i) => { if (i >= st && p[1] < -0.35) p[1] = -0.3 + (p[1] + 0.3) * (1 + Math.sin(at * 30 + i) * 0.3); };
        } else if (b.k === 'ika') {
            o.deform = dWave(mesh('ika').armStart, 0.3, 1.6, at * 5, -0.9);
            o.rz = Math.sin(at * 0.8) * 0.05;
        } else if (b.k === 'lure') {
            const m = mesh('lure'), j0 = m.jawStart, j1 = m.jawEnd, hx = GM.LURE_HINGE[0], hy = GM.LURE_HINGE[1], c = Math.cos(b.jaw), sn = Math.sin(b.jaw);
            o.deform = (p, i) => { if (i >= j0 && i < j1) { const dx = p[0] - hx, dy = p[1] - hy; p[0] = hx + dx * c - dy * sn; p[1] = hy + dx * sn + dy * c; } };
            o.rz = Math.sin(at * 0.7) * 0.05;
        } else if (b.k === 'king') {
            o.deform = dWave(mesh('king').armStart, 0.32, 1.5, at * (b.rage ? 9 : 5), -0.9);
        }
        b.o = o;
        draw3(b.d.mesh, b.x, b.y, s, o);
        if (b.k === 'lure') { const t = S.project(GM.LURE_TIP, o); b.tip = t; g.fillStyle = '#fff1a6'; g.beginPath(); g.arc(t[0], t[1], 3 + b.glow * 3, 0, TAU); g.fill(); }
        if (b.k === 'king' && !b.crownGone) {
            const c = S.project([0.5, 0.95, 0], o);
            draw3('crown', c[0], c[1], s, { rx: o.rx, ry: o.ry, fog: o.fog, fogAmt: o.fogAmt });
        }
        if (b.crown) draw3('crown', b.crown.x, b.crown.y, 9, { ry: T * 2, rx: 0.4, fog: b.crown.flash > 0 ? [255, 255, 255] : null, fogAmt: 0.8 });
    }

    /* ---------- shots and bullets ---------- */
    function updShots(dt) {
        for (let i = PS.length - 1; i >= 0; i--) {
            const s = PS[i];
            if (s.k === 'h') {
                s.life -= dt;
                let tgt = null, best = 1e9;
                for (const e of E) { if (e.dead || e.x > W) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < best) { best = d; tgt = e; } }
                if (boss && !boss.entering && !boss.beaten && !tgt) tgt = boss.crown || { x: boss.x - boss.d.s, y: boss.y };
                const sp = Math.min(220, Math.hypot(s.vx, s.vy) + 300 * dt);
                let a = Math.atan2(s.vy, s.vx);
                if (tgt) { const want = Math.atan2(tgt.y - s.y, tgt.x - s.x); let da = want - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; a += clamp(da, -6 * dt, 6 * dt); }
                s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
                if (R() < 0.5) part(s.x, s.y, 0, 0, 0.3, 'bubble', null, 0.6);
                if (s.life <= 0) { PS.splice(i, 1); continue; }
            }
            s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.x > W + 8 || s.x < -8 || s.y < -8 || s.y > H + 8) { PS.splice(i, 1); continue; }
            let hit = false;
            for (const e of E) {
                if (e.dead || e.x > W + 4) continue;
                if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 1.5) { hurtEnemy(e, s.dmg); hit = true; break; }
                if (e.type === 'eel') {
                    for (let j = 0; j < 8 && !hit; j++) { const h = e.hist[Math.min(e.hist.length - 1, (j + 1) * 5)]; if (h && Math.hypot(h[0] - s.x, h[1] - s.y) < 5) { hit = true; sfx('clank'); part(s.x, s.y, -20, 0, 0.2, 'spark', '#ffffff', 1); } }
                    if (hit) break;
                }
            }
            if (!hit && boss && boss.crown && Math.hypot(boss.crown.x - s.x, boss.crown.y - s.y) < 10) { hurtCrown(s.dmg); hit = true; }
            if (!hit && boss && !boss.entering && !boss.beaten) {
                for (const c of bossCircles(boss)) if (Math.hypot(c[0] - s.x, c[1] - s.y) < c[2]) { hurtBoss(s.dmg); hit = true; part(s.x, s.y, -30, (R() - 0.5) * 30, 0.15, 'fire', null, 1.5); break; }
            }
            if (hit) PS.splice(i, 1);
        }
    }
    function updBullets(dt) {
        const hx = P.x + 2, hy = P.y + 1;
        for (let i = EB.length - 1; i >= 0; i--) {
            const b = EB[i];
            b.t += dt;
            if (b.grav) b.vy += b.grav * dt;
            if (b.kind === 'torp') b.vx *= 1 + dt * 0.8;
            b.x += b.vx * dt;
            b.y += b.vy * dt + (b.kind === 'flake' ? Math.sin(b.t * 9) * 0.6 : 0);
            if (b.kind === 'blob' && b.t > 1.4) { CL.push({ x: b.x, y: b.y, r: 3, life: 4.5 }); ring(b.x, b.y, 7, 34, R()); sfx('pop'); EB.splice(i, 1); continue; }
            if (b.x < -10 || b.x > W + 10 || b.y < -14 || b.y > H + 10) { EB.splice(i, 1); continue; }
            if (P.alive && Math.hypot(b.x - hx, b.y - hy) < b.r + 1.6) { EB.splice(i, 1); playerHit(); }
        }
    }
    function updPickups(dt) {
        for (let i = PU.length - 1; i >= 0; i--) {
            const p = PU[i];
            p.t += dt;
            const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
            if (p.k === 'pearl') {
                p.vx *= 0.94; p.vy *= 0.94;
                if (P.alive && (d < 44 || p.t > 1.2)) { p.vx += (dx / (d || 1)) * 500 * dt; p.vy += (dy / (d || 1)) * 500 * dt; }
                else p.vx -= 10 * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
            } else if (p.k === 'great') {
                if (p.t < 3 || !P.alive) { p.y += (H / 2 - p.y) * dt; p.x += (150 - p.x) * dt; }
                else { p.x += dx * dt * 1.2; p.y += dy * dt * 1.2; }
                if (R() < dt * 10) part(p.x + (R() - 0.5) * 20, p.y + (R() - 0.5) * 20, 0, -10, 0.6, 'spark', '#ffffff', 1);
            } else {
                p.x += p.vx * dt; p.y += Math.sin(p.t * 2.5) * 10 * dt;
                if (P.alive && d < 30) { p.x += dx * dt * 4; p.y += dy * dt * 4; }
            }
            if (P.alive && d < (p.k === 'great' ? 16 : 10)) { collect(p); PU.splice(i, 1); continue; }
            if (p.x < -12 || p.t > 14) PU.splice(i, 1);
        }
    }

    /* ---------- stage loop ---------- */
    function setupStage(i) {
        const def = STAGES[i];
        E = []; EB = []; PS = []; PU = []; PT = []; CL = []; TELE = []; DEC = []; POP = []; later = [];
        boss = null; show('bossbar', false);
        ST = { i, def, t: 0, wi: 0, scroll: 0, speed: 26, run: false, noMiss: true, kills: 0, pearls: 0, prog: 0, fishT: 2 };
        resetPlayer(false);
    }
    function updatePlay(dt) {
        if (!ST || frozen) return;
        const def = ST.def;
        ST.scroll += ST.speed * dt;
        if (ST.run) {
            ST.t += dt;
            while (ST.wi < def.waves.length && def.waves[ST.wi][0] <= ST.t) { const [, fn, ...args] = def.waves[ST.wi++]; WAVES[fn](...args); }
            for (let i = later.length - 1; i >= 0; i--) if (later[i].at <= ST.t) { const l = later.splice(i, 1)[0]; l.fn(); }
        }
        ST.prog = clamp(ST.t / def.len, 0, 1);
        G.depth = lerp(def.depth[0], def.depth[1], boss || ST.bossDone ? 1 : ST.prog * 0.96);
        updPlayer(dt);
        if (frozen) return;
        for (const e of E) updEnemy(e, dt);
        updBoss(dt);
        updShots(dt); updBullets(dt); updPickups(dt); updParts(dt);
        // contact damage
        if (P.alive) {
            for (const e of E) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < e.r * 0.75 + 3) { if (e.type !== 'crate') hurtEnemy(e, 4); playerHit(); break; }
            if (boss && !boss.beaten && !boss.dying) for (const c of bossCircles(boss)) if (Math.hypot(c[0] - P.x, c[1] - P.y) < c[2] * 0.85 + 3) { playerHit(); break; }
            if (boss && boss.crown && Math.hypot(boss.crown.x - P.x, boss.crown.y - P.y) < 9) playerHit();
        }
        for (let i = E.length - 1; i >= 0; i--) if (E[i].dead || E[i].gone) E.splice(i, 1);
        for (let i = CL.length - 1; i >= 0; i--) { const c = CL[i]; c.life -= dt; c.r = Math.min(30, c.r + dt * 30); c.x -= 8 * dt; if (c.life <= 0) CL.splice(i, 1); }
        for (let i = TELE.length - 1; i >= 0; i--) if ((TELE[i].life -= dt) <= 0) TELE.splice(i, 1);
        for (let i = POP.length - 1; i >= 0; i--) { POP[i].t -= dt; POP[i].y -= 12 * dt; if (POP[i].t <= 0) POP.splice(i, 1); }
        // background fish
        if (VIS[def.vis].fish) {
            ST.fishT -= dt;
            if (ST.fishT <= 0) {
                ST.fishT = 5 + R() * 5;
                const y = 30 + R() * 80, dir = R() < 0.5 ? -1 : 1, key = ['fishA', 'fishB', 'fishC'][(R() * 3) | 0];
                for (let i = 0; i < 6; i++) DEC.push({ x: dir < 0 ? W + 10 + i * 9 : -10 - i * 9, y: y + (R() - 0.5) * 16, vx: dir * (22 + R() * 6), key, ph: R() * TAU });
            }
            for (let i = DEC.length - 1; i >= 0; i--) { const f = DEC[i]; f.x += f.vx * dt; if (f.x < -40 || f.x > W + 80) DEC.splice(i, 1); }
        }
    }

    /* ---------- background painting ---------- */
    function paintSea(v, scroll, k) {
        const top = mix(v.top[0], v.top[1], k), bot = mix(v.bot[0], v.bot[1], k);
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, top); gr.addColorStop(1, bot);
        g.fillStyle = gr; g.fillRect(-4, -4, W + 8, H + 8);
        if (v.rays) {
            g.globalAlpha = 0.13 * (1 - k * 0.7);
            g.fillStyle = '#dff4ff';
            for (let i = 0; i < 6; i++) {
                const x0 = ((i * 61 - scroll * 0.12 + Math.sin(T * 0.3 + i) * 6) % (W + 120) + W + 120) % (W + 120) - 40;
                g.beginPath(); g.moveTo(x0, -2); g.lineTo(x0 + 10 + (i % 3) * 4, -2); g.lineTo(x0 - 30 + (i % 2) * 8, H); g.lineTo(x0 - 58, H); g.fill();
            }
            g.globalAlpha = 1;
        }
        if (v.surface) {
            const sy = 7 - k * 90;
            if (sy > -6) {
                g.fillStyle = '#9fd8f5';
                g.beginPath(); g.moveTo(-4, -4);
                for (let x = -4; x <= W + 4; x += 3) g.lineTo(x, sy + Math.sin((x + scroll * 0.7) * 0.09 + T * 2) * 1.6);
                g.lineTo(W + 4, -4); g.fill();
                g.fillStyle = '#dff4ff';
                for (let x = 0; x < W; x += 9) { const y = sy + Math.sin((x + scroll * 0.7) * 0.09 + T * 2) * 1.6; if (Math.sin(x * 0.7 + T * 3) > 0.4) g.fillRect(x, y - 1, 3, 1); }
            }
        }
        // far rocks
        g.fillStyle = mix(v.far[0], v.far[1], k);
        g.beginPath(); g.moveTo(-4, H + 4);
        for (let x = -4; x <= W + 4; x += 4) g.lineTo(x, H - 26 - noise1((x + scroll * 0.35) * 0.025) * 34);
        g.lineTo(W + 4, H + 4); g.fill();
        if (v.ceiling) {
            g.beginPath(); g.moveTo(-4, -4);
            for (let x = -4; x <= W + 4; x += 4) g.lineTo(x, 4 + noise1((x + scroll * 0.35) * 0.03 + 50) * 20);
            g.lineTo(W + 4, -4); g.fill();
        }
        if (v.pillars) {
            g.fillStyle = '#2e2e3e';
            for (let i = 0; i < 4; i++) {
                const x = ((i * 90 - scroll * 0.25) % 360 + 360) % 360 - 40;
                g.fillRect(x, 10, 14, H); g.fillRect(x - 4, 10, 22, 6);
                g.fillStyle = '#3d2a1e'; g.fillRect(x + 3, 16, 3, H); g.fillStyle = '#2e2e3e';
            }
        }
        if (v.vents) {
            for (let i = 0; i < 3; i++) {
                const x = ((i * 130 - scroll * 0.6) % 390 + 390) % 390 - 50, y = H - 22;
                const gl = g.createRadialGradient(x, y, 1, x, y, 28);
                gl.addColorStop(0, 'rgba(255,154,31,0.75)'); gl.addColorStop(1, 'rgba(232,86,42,0)');
                g.fillStyle = gl; g.fillRect(x - 30, y - 30, 60, 60);
                g.fillStyle = '#04070f'; g.beginPath(); g.moveTo(x - 9, H); g.lineTo(x - 3, y - 6); g.lineTo(x + 3, y - 6); g.lineTo(x + 9, H); g.fill();
                g.fillStyle = 'rgba(107,107,128,0.35)';
                for (let j = 0; j < 5; j++) { const t = (T * 0.6 + j / 5) % 1; g.beginPath(); g.arc(x + Math.sin(t * 6 + j) * 4, y - 8 - t * 60, 3 + t * 8, 0, TAU); g.fill(); }
            }
        }
        // near floor
        const fl = mix(v.floor[0], v.floor[1], k);
        g.fillStyle = fl;
        g.beginPath(); g.moveTo(-4, H + 4);
        for (let x = -4; x <= W + 4; x += 3) g.lineTo(x, H - 8 - noise1((x + scroll) * 0.04) * 10);
        g.lineTo(W + 4, H + 4); g.fill();
        if (v.kelp || v.coral) {
            for (let n = Math.floor(scroll / 19) - 1; n < Math.floor((scroll + W) / 19) + 2; n++) {
                if (hash(n * 3.1) < 0.45) continue;
                const wx = n * 19 + hash(n) * 10, x = wx - scroll, base = H - 8 - noise1(wx * 0.04) * 10;
                const h = 16 + hash(n * 7.7) * 34;
                g.strokeStyle = hash(n * 2.3) < 0.5 ? v.kelp : v.kelp2; g.lineWidth = v.coral ? 2 : 2;
                g.beginPath(); g.moveTo(x, base + 2);
                for (let s = 1; s <= 6; s++) g.lineTo(x + Math.sin(T * 1.4 + n + s * 0.7) * s * 0.9, base - (h * s) / 6);
                g.stroke();
                if (v.coral) { g.beginPath(); g.moveTo(x, base - h * 0.5); g.lineTo(x + 6, base - h * 0.75); g.moveTo(x, base - h * 0.3); g.lineTo(x - 5, base - h * 0.55); g.stroke(); }
            }
        }
        // marine snow
        g.fillStyle = v.snow;
        g.globalAlpha = 0.7;
        for (let i = 0; i < 36; i++) {
            const x = ((hash(i) * W * 2 - scroll * (0.4 + hash(i + 9) * 0.5)) % W + W) % W;
            const y = ((hash(i + 3) * H + T * (3 + hash(i + 5) * 5)) % H);
            g.fillRect(x | 0, y | 0, 1, 1);
        }
        g.globalAlpha = 1;
    }

    /* ---------- render ---------- */
    let scene = null, sceneT = 0;
    function lightHole(x, y, r, a = 1) {
        const gr = dg.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        dg.fillStyle = gr; dg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function drawGameWorld() {
        const def = ST.def, v = VIS[def.vis];
        paintSea(v, ST.scroll, boss || ST.bossDone ? 1 : ST.prog);
        for (const f of DEC) draw3(f.key, f.x, f.y + Math.sin(T * 2 + f.ph) * 2, 3.2, { ry: f.vx < 0 ? Math.PI - 0.3 : 0.3, fog: rgb(v.top[0]), fogAmt: 0.45, deform: (p) => { p[2] += Math.sin(AT() * 12 + f.ph + p[0] * 2) * 0.15 * (0.6 - p[0]); } });
        for (const p of PU) {
            if (p.k === 'pearl') continue;
            if (p.k === 'great') {
                const gl = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, 40);
                gl.addColorStop(0, 'rgba(255,255,255,0.9)'); gl.addColorStop(1, 'rgba(223,244,255,0)');
                g.fillStyle = gl; g.fillRect(p.x - 40, p.y - 40, 80, 80);
                draw3('pearl', p.x, p.y, 8 + Math.sin(T * 3), { light: 1.2 });
                continue;
            }
            draw3('cap' + p.k, p.x, p.y, 5, { ry: T * 2.5, rx: 0.3, light: 1.1, amb: 0.6 });
        }
        drawBoss();
        for (const e of E) drawEnemy(e);
        drawPlayer();
        drawParts();
        for (const c of CL) { g.globalAlpha = Math.min(1, c.life) * 0.95; g.fillStyle = '#04070f'; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill(); g.globalAlpha = 1; }
        if (v.dark) {
            dg.globalCompositeOperation = 'source-over';
            dg.clearRect(0, 0, W, H);
            dg.fillStyle = 'rgba(1,2,6,0.93)'; dg.fillRect(0, 0, W, H);
            dg.globalCompositeOperation = 'destination-out';
            if (P.alive) { lightHole(P.x + 48, P.y + 2, 58, 0.95); lightHole(P.x, P.y, 26, 1); }
            for (const e of E) lightHole(e.x, e.y, e.type === 'angler' ? 22 : 14, 0.7);
            for (const p of PT) if (p.kind === 'fire') lightHole(p.x, p.y, 14, 0.5);
            for (const s of PS) lightHole(s.x, s.y, 7, 0.5);
            for (const p of PU) lightHole(p.x, p.y, p.k === 'great' ? 60 : 12, 0.8);
            if (boss) {
                if (boss.k === 'lure' && boss.tip) lightHole(boss.tip[0], boss.tip[1], 40 + boss.glow * 70, 1);
                else lightHole(boss.x, boss.y, 50, 0.6);
            }
            if (flash > 0) { dg.fillStyle = `rgba(0,0,0,${flash})`; dg.fillRect(0, 0, W, H); }
            g.drawImage(dk, 0, 0);
        }
    }
    function drawPlayer() {
        if (!P.alive || !G) return;
        if (P.inv > 0 && Math.floor(T * 14) % 2) return;
        for (let i = 0; i < P.opts; i++) {
            const o = optPos(i);
            draw3('bub', o[0], o[1] + Math.sin(T * 4 + i) * 1.5, 4.2, { ry: -0.5 + Math.sin(AT() * 2 + i) * 0.3, rx: 0.2 });
        }
        draw3('sub', P.x, P.y, 9.5, { ry: -0.38, rx: 0.25, rz: clamp(-P.vy * 0.003, -0.25, 0.25), deform: dSpin('sub', AT() * 24) });
        if (P.shield) {
            g.strokeStyle = '#dff4ff'; g.lineWidth = 1;
            g.globalAlpha = 0.8; g.beginPath(); g.ellipse(P.x, P.y, 18, 12, 0, 0, TAU); g.stroke();
            g.globalAlpha = 0.25; g.fillStyle = '#9fd8f5'; g.fill(); g.globalAlpha = 1;
        }
    }
    function drawPost() {
        const p = pal();
        for (const t of TELE) {
            if (Math.floor(t.life * 12) % 2) continue;
            g.fillStyle = p.warn;
            for (let x = 0; x < W; x += 6) g.fillRect(x, (t.y | 0), 3, 1);
        }
        for (const s of PS) {
            if (s.k === 'h') { g.fillStyle = p.rim; g.fillRect((s.x | 0) - 2, (s.y | 0) - 1, 4, 3); g.fillStyle = p.shot; g.fillRect((s.x | 0) - 1, (s.y | 0) - 1, 3, 2); }
            else { g.fillStyle = p.shot; g.fillRect((s.x | 0) - 4, (s.y | 0) - 1, 7, 2); g.fillStyle = p.shotCore; g.fillRect((s.x | 0) + 1, (s.y | 0) - 1, 2, 2); }
        }
        for (const q of PU) {
            const x = q.x | 0, y = q.y | 0;
            if (q.k === 'pearl') { g.fillStyle = p.ink; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = p.text; g.fillRect(x - 1, y - 1, 2, 2); }
            else if (q.k !== 'great') text3(q.k === 'U' ? '1' : q.k, x + 0.5, y - 2, p.text, p.ink);
        }
        for (const b of EB) {
            const x = b.x | 0, y = b.y | 0;
            g.fillStyle = p.rim;
            if (b.kind === 'torp') { g.fillRect(x - 4, y - 2, 9, 4); g.fillStyle = p.core; g.fillRect(x - 3, y - 1, 7, 2); g.fillStyle = p.hot; g.fillRect(x - 3, y - 1, 2, 2); continue; }
            if (b.kind === 'flake') { g.fillRect(x - 2, y - 1, 5, 3); g.fillStyle = p.hot; g.fillRect(x - 1, y, 3, 1); continue; }
            const r = b.kind === 'big' || b.kind === 'blob' ? 3 : 2;
            g.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); g.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
            g.fillStyle = b.kind === 'sauce' ? p.hot : p.core;
            g.fillRect(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2);
            if (r > 2) { g.fillStyle = p.hot; g.fillRect(x - 1, y - 1, 2, 2); }
        }
        for (const q of POP) text3(q.txt, q.x, q.y, p.text, p.ink);
    }
    function render() {
        g.setTransform(1, 0, 0, 1, 0, 0);
        const sx = shake > 0 ? Math.round((R() - 0.5) * shake * 6) : 0, sy = shake > 0 ? Math.round((R() - 0.5) * shake * 6) : 0;
        g.setTransform(1, 0, 0, 1, sx, sy);
        if ((mode === 'game' || mode === 'over') && ST) drawGameWorld();
        else if (scene) scene(sceneT);
        else { g.fillStyle = '#04070f'; g.fillRect(0, 0, W, H); }
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (flash > 0) { g.globalAlpha = Math.min(1, flash); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
        const id = g.getImageData(0, 0, W, H);
        S.dither(id, pal().pal, pal().spread, 0, 0);
        g.putImageData(id, 0, 0);
        g.setTransform(1, 0, 0, 1, sx, sy);
        if ((mode === 'game' || mode === 'over') && ST) drawPost();
        g.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* ---------- scenes for the title, story and ending ---------- */
    const SC = {
        title(t) {
            paintSea(VIS[0], t * 14, 0.15);
            for (let i = 0; i < 6; i++) { const x = ((W + 40) - (t * 18 + i * 12) % (W + 80)), y = 40 + Math.sin(i * 1.7) * 10; draw3('fishB', x, y + Math.sin(t * 2 + i) * 2, 3, { ry: Math.PI - 0.3, fog: rgb('#5ab4e8'), fogAmt: 0.5 }); }
            const ry = -0.5 + Math.sin(t * 0.5) * 0.7;
            draw3('sub', 166, 114 + Math.sin(t * 1.3) * 3, 20, { ry, rx: 0.25, rz: Math.sin(t * 0.9) * 0.06, deform: dSpin('sub', Math.floor(t * 15) * 1.6) });
            draw3('bub', 214 + Math.sin(t * 0.8) * 4, 86 + Math.sin(t * 1.7) * 4, 6, { ry: -0.8 + Math.sin(t) * 0.4 });
            if (R() < 0.3) part(140 + R() * 10, 118, 0, -20, 1.2, 'bubble', null, 1 + R());
            updParts(1 / 60); drawParts();
        },
        reef(t) {
            paintSea(VIS[0], t * 6, 0.2);
            const gl = g.createRadialGradient(120, 58, 2, 120, 58, 50 + Math.sin(t * 2) * 4);
            gl.addColorStop(0, 'rgba(255,255,255,0.9)'); gl.addColorStop(1, 'rgba(223,244,255,0)');
            g.fillStyle = gl; g.fillRect(60, 0, 120, 120);
            draw3('pedestal', 120, 82, 14, { rx: 0.3, ry: t * 0.2 });
            draw3('pearl', 120, 64, 7, { ry: t, light: 1.2 });
            for (let i = 0; i < 9; i++) {
                const a = t * 0.6 + (i / 9) * TAU, x = 120 + Math.cos(a) * 85, y = 52 + Math.sin(a * 2 + i) * 18;
                draw3(['fishA', 'fishB', 'fishC'][i % 3], x, y, 4, { ry: -Math.sin(a) > 0 ? 0.3 : Math.PI - 0.3 });
            }
        },
        clan(t) {
            paintSea(VIS[1], t * 8, 0.2);
            draw3('kingC', 196, 60 + Math.sin(t) * 4, 11, { ry: 0.35, fog: rgb('#0b1530'), fogAmt: 0.25, deform: dWave(mesh('kingC').armStart, 0.3, 1.5, AT() * 4, -0.9) });
            for (let i = 0; i < 10; i++) {
                const x = W + 20 - ((t * 26 + i * 30) % (W + 60)), y = 30 + (i % 3) * 32 + Math.sin(t * 3 + i) * 4;
                draw3(i % 3 === 0 ? 'tako' : 'squid', x, y, i % 3 === 0 ? 5.5 : 5, { ry: Math.PI - 0.4, rx: 0.25, deform: i % 3 ? dWave(0, 0.35, 3, AT() * 10 + i, -0.45) : null });
            }
            for (let i = 0; i < 6; i++) { const x = W + 20 - ((t * 40 + i * 44) % (W + 60)); draw3('ball', x, H - 18, 4.5, { rz: t * 5 + i, ry: 0.4 }); }
        },
        stolen(t) {
            const k = clamp(t / 7, 0, 1);
            paintSea(VIS[2], t * 4, 0.5);
            g.globalAlpha = 1 - k * 0.6;
            paintSea(VIS[1], t * 4, 0.8);
            g.globalAlpha = 1;
            const y = 40 + t * 7;
            const gl = g.createRadialGradient(100, y + 22, 2, 100, y + 22, 40 * (1 - k * 0.6));
            gl.addColorStop(0, 'rgba(255,255,255,0.85)'); gl.addColorStop(1, 'rgba(223,244,255,0)');
            g.fillStyle = gl; g.fillRect(40, y - 30, 120, 110);
            draw3('kingC', 130, y, 9, { ry: 0.45, deform: dWave(mesh('kingC').armStart, 0.3, 1.5, AT() * 4, -0.9) });
            draw3('pearl', 100, y + 22, 5, { ry: t });
        },
        launch(t) {
            const gr = g.createLinearGradient(0, 0, 0, 60);
            gr.addColorStop(0, '#5ab4e8'); gr.addColorStop(1, '#dff4ff');
            g.fillStyle = gr; g.fillRect(0, 0, W, 60);
            g.fillStyle = '#fff1a6'; g.beginPath(); g.arc(200, 20, 9, 0, TAU); g.fill();
            const sea = g.createLinearGradient(0, 56, 0, H); sea.addColorStop(0, '#3b8fd4'); sea.addColorStop(1, '#11214a');
            g.fillStyle = sea; g.fillRect(0, 56, W, H);
            const o = { ry: 0.25, rx: 0.12, rz: Math.sin(t * 1.4) * 0.04 };
            draw3('ship', 95, 50 + Math.sin(t * 1.4), 30, o);
            const hook = S.project(S.models.SHIP_HOOK, Object.assign({ x: 95, y: 50 + Math.sin(t * 1.4), s: 30 }, o));
            const sy = Math.min(130, 64 + t * 9);
            g.strokeStyle = '#2e2e3e'; g.lineWidth = 1; g.beginPath(); g.moveTo(hook[0], hook[1]); g.lineTo(hook[0], sy - 10); g.stroke();
            draw3('sub', hook[0], sy, 9, { ry: -0.4, rx: 0.2, deform: dSpin('sub', AT() * 20) });
            g.fillStyle = '#9fd8f5';
            g.beginPath(); g.moveTo(0, 60);
            for (let x = 0; x <= W; x += 3) g.lineTo(x, 57 + Math.sin(x * 0.12 + t * 2) * 1.5);
            g.lineTo(W, 62); g.lineTo(0, 62); g.fill();
            g.fillStyle = '#04070f';
            for (let i = 0; i < 2; i++) { const x = ((t * 20 + i * 70) % (W + 20)) - 10, y = 18 + i * 9 + Math.sin(t * 3 + i) * 2; g.fillRect(x, y, 2, 1); g.fillRect(x + 2, y + 1, 1, 1); g.fillRect(x - 2, y - 1, 2, 1); }
        },
        pilot(t) {
            paintSea(VIS[0], t * 30, 0.3);
            draw3('sub', 110, 84 + Math.sin(t * 1.5) * 2, 26, { ry: -0.6 + Math.sin(t * 0.4) * 0.3, rx: 0.25, deform: dSpin('sub', AT() * 24) });
            draw3('bub', 180, 60 + Math.sin(t * 2) * 4, 9, { ry: -0.7 + Math.sin(t) * 0.3 });
            if (R() < 0.4) part(60 + R() * 10, 86, -30, -10, 1.2, 'bubble', null, 1 + R());
            updParts(1 / 60); drawParts();
        },
        rise(t) {
            const k = clamp(t / 7, 0, 1);
            const vi = k < 0.33 ? 2 : k < 0.66 ? 1 : 0;
            paintSea(VIS[vi], t * 10, 1 - ((k * 3) % 1));
            const y = H - 20 - k * 90;
            const gl = g.createRadialGradient(120, y, 2, 120, y, 50 + k * 80);
            gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(1, 'rgba(223,244,255,0)');
            g.fillStyle = gl; g.fillRect(0, 0, W, H);
            draw3('pearl', 120, y, 7, { ry: t, light: 1.3 });
            draw3('sub', 80, y + 26, 10, { ry: -0.4, rx: 0.2, deform: dSpin('sub', AT() * 24) });
            draw3('bub', 160, y + 20 + Math.sin(t * 3) * 3, 4.5, { ry: -0.6 });
            for (let i = 0; i < 6; i++) { const a = t * 0.8 + i; draw3(['fishA', 'fishB', 'fishC'][i % 3], 120 + Math.cos(a) * 90, y + 10 + Math.sin(a * 1.3) * 30, 4, { ry: -Math.sin(a) > 0 ? 0.3 : Math.PI - 0.3 }); }
        },
        home(t) {
            const gr = g.createLinearGradient(0, 0, 0, 60);
            gr.addColorStop(0, '#ff9a1f'); gr.addColorStop(0.6, '#fff1a6'); gr.addColorStop(1, '#ffd23f');
            g.fillStyle = gr; g.fillRect(0, 0, W, 60);
            g.fillStyle = '#ffffff'; g.beginPath(); g.arc(120, 54, 16, Math.PI, TAU); g.fill();
            const sea = g.createLinearGradient(0, 56, 0, H); sea.addColorStop(0, '#2a68b3'); sea.addColorStop(1, '#0e5f6e');
            g.fillStyle = sea; g.fillRect(0, 56, W, H);
            draw3('ship', 80, 50 + Math.sin(t * 1.4), 26, { ry: 0.25, rx: 0.12, rz: Math.sin(t * 1.4) * 0.04 });
            const sy = Math.max(57, 90 - t * 6);
            draw3('sub', 170, sy, 10, { ry: -0.5, rx: 0.15, rz: Math.sin(t * 2) * 0.05 });
            const bj = Math.abs(Math.sin(t * 2.2)) * 18;
            draw3('bub', 200, 56 - bj, 4, { ry: -0.6, rz: t * 4 });
            g.fillStyle = '#9fd8f5';
            g.beginPath(); g.moveTo(0, 60);
            for (let x = 0; x <= W; x += 3) g.lineTo(x, 57 + Math.sin(x * 0.12 + t * 2) * 1.5);
            g.lineTo(W, 62); g.lineTo(0, 62); g.fill();
            g.fillStyle = '#04070f';
            for (let i = 0; i < 2; i++) { const x = 40 + i * 30 + Math.sin(t + i) * 20, y = 18 + i * 8 + Math.sin(t * 3 + i) * 2; g.fillRect(x, y, 2, 1); g.fillRect(x + 2, y + 1, 1, 1); g.fillRect(x - 2, y - 1, 2, 1); }
        }
    };
    const setScene = (name) => { scene = SC[name]; sceneT = 0; PT = []; };

    /* ---------- HUD ---------- */
    const hudCache = {};
    const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $('#' + id).innerHTML = v; } };
    function updateHUD() {
        if (mode !== 'game' || !G) return;
        setText('h-score', String(G.score).padStart(7, '0'));
        setText('h-hi', String(hiScore()).padStart(7, '0'));
        setText('h-depth', `${Math.round(G.depth || 0).toLocaleString('en')} m`);
        setText('h-lives', `<i class="hi-sub"></i>&times;${Math.max(0, G.lives)}`);
        setText('h-bombs', `<i class="hi-bomb"></i>&times;${P.bombs}`);
        setText('h-power', 'PWR ' + '<i class="pip on"></i>'.repeat(P.power) + '<i class="pip"></i>'.repeat(4 - P.power));
        setText('h-extra', (P.homing ? `<span>H${P.homing}</span>` : '') + (P.opts ? `<span>BUB&times;${P.opts}</span>` : '') + (P.shield ? '<span>SHIELD</span>' : ''));
    }

    /* ---------- screens ---------- */
    const OVERLAYS = ['title', 'card', 'warn', 'talk', 'tally', 'pause', 'cont', 'over', 'entry', 'scores', 'howto', 'credits', 'hud', 'bossbar', 'toast'];
    const hideAll = () => OVERLAYS.forEach((id) => show(id, false));
    function setMode(m) {
        mode = m;
        screen.dataset.mode = m;
        if (m !== 'game') { show('hud', false); show('bossbar', false); }
    }

    function scores() {
        const def = [['SQK', 60000], ['HDJ', 40000], ['BUB', 25000], ['IKA', 15000], ['GRD', 8000]];
        const s = store.get('heind.subdx.scores', def);
        return Array.isArray(s) && s.length ? s : def;
    }
    const qualifies = (n) => n > 0 && n > scores()[4][1];

    async function titleFlow(skipPress) {
        newFlow();
        hideAll(); setMode('title'); setScene('title'); paused = false; frozen = false;
        G = null; ST = null;
        music('title');
        show('title');
        const pressEl = $('#press'), menuEl = $('#title-menu');
        if (!skipPress) {
            pressEl.hidden = false; menuEl.hidden = true; setMenu(null);
            await until(() => press('ok'));
            sfx('select');
        }
        pressEl.hidden = true; menuEl.hidden = false;
        syncOptions();
        setMenu(menuEl);
    }
    const STORY = [
        ['reef', 'Far below the waves lies the Great Pearl. For a thousand years it has kept the sea bright, warm and very, very green.'],
        ['clan', 'Then the Takoyaki Clan rolled in: squids, octopuses and a thousand crispy takoyaki, led by the greedy SQUID KING.'],
        ['stolen', 'They stole the Great Pearl and dragged it down to the hadal zone, almost eleven kilometres deep. The sea is going dark, one zone at a time.'],
        ['launch', 'The navy laughed. The fishermen hid. But one sub was small enough, green enough and stubborn enough to go after them...'],
        ['pilot', "...the AUGURK! (That's Dutch for gherkin.) With Bub the pufferfish as co-pilot, it's time to dive. Bring back the pearl, captain."]
    ];
    async function storyFlow(thenPlay) {
        newFlow();
        hideAll(); setMode('story'); setMenu(null);
        music('title');
        const tok = flowTok;
        storySkip = () => { if (tok === flowTok) { CFG.seenStory = true; saveCfg(); thenPlay ? go(gameFlow) : go(() => titleFlow(true)); } };
        for (const [sc, txt] of STORY) { setScene(sc); await wait(0.4); await say(null, txt); }
        setScene('pilot');
        await say('BUB', "Ready when you are, captain! If anything goes wrong I'll puff up. That's basically my whole job.");
        CFG.seenStory = true; saveCfg();
        storySkip = null;
        if (thenPlay) go(gameFlow); else go(() => titleFlow(true));
    }
    let storySkip = null;

    function startGame() {
        unlockAudio();
        G = { score: 0, lives: D().lives, continues: 3, extendAt: 30000, stage: 0, depth: 0, gotPearl: false };
        resetPlayer(true);
        if (!CFG.seenStory) go(() => storyFlow(true)); else go(gameFlow);
    }

    async function gameFlow() {
        newFlow();
        hideAll(); setMenu(null); setMode('game'); scene = null; paused = false; frozen = false;
        if (!G) { G = { score: 0, lives: D().lives, continues: 3, extendAt: 30000, stage: 0, depth: 0 }; resetPlayer(true); }
        show('hud');
        for (let i = G.stage; i < STAGES.length; i++) { G.stage = i; await runStage(i); }
        await endingFlow();
    }

    async function runStage(i) {
        const def = STAGES[i];
        setupStage(i);
        G.stageScore = G.score;
        music(def.music);
        $('#card-n').textContent = `STAGE ${i + 1}`;
        $('#card-name').textContent = def.name;
        $('#card-depth').textContent = `${def.depth[0].toLocaleString('en')} – ${def.depth[1].toLocaleString('en')} m`;
        show('card'); sfx('sonar');
        await wait(2.8);
        show('card', false);
        P.ctrl = false;
        await say('BUB', def.intro);
        P.ctrl = true; ST.run = true;
        await until(() => ST.t >= def.len);
        await until(() => E.length === 0 || ST.t > def.len + 7);
        // the boss
        A.stopMusic(); wantSong = '';
        $('#warn-name').textContent = BOSS[def.boss].name;
        $('#warn-title').textContent = BOSS[def.boss].title;
        show('warn'); sfx('warn');
        await wait(3.4);
        show('warn', false);
        spawnBoss(def.boss);
        const b = boss;
        await until(() => !b.entering);
        b.talk = true; P.ctrl = false;
        await say(b.d.who, b.d.hi);
        b.talk = false; P.ctrl = true; b.bornAt = clock;
        music(def.boss === 'king' ? 'king' : 'boss');
        await until(() => b.beaten);
        const bossTime = clock - b.bornAt;
        A.stopMusic(); wantSong = '';
        P.ctrl = false;
        await wait(1);
        await say(b.d.who, b.d.bye);
        b.dying = 2.6;
        await until(() => b.dead);
        ST.bossDone = true;
        P.ctrl = true;
        if (def.boss === 'king') {
            toast('GRAB THE GREAT PEARL!');
            await until(() => G.gotPearl);
            P.ctrl = false;
        }
        await wait(1.2);
        P.ctrl = false;
        await tally(i, bossTime);
    }

    async function tally(i, bossTime) {
        music('clear');
        const time = Math.max(0, Math.round((100 - bossTime) * 100));
        const noMiss = ST.noMiss ? 10000 * (i + 1) : 0;
        const pearls = ST.pearls * 20;
        const rows = [['BOSS TIME BONUS', time], ['NO-MISS BONUS', noMiss], [`PEARLS &times;${ST.pearls}`, pearls]];
        const el = $('#tally');
        el.innerHTML = `<h2>STAGE ${i + 1} CLEAR!</h2><dl></dl><p class="t-total">TOTAL <b>+0</b></p><p class="t-next blink">PRESS FIRE</p>`;
        show('tally');
        const dl = $('dl', el);
        let sum = 0;
        for (const [k, v] of rows) {
            await wait(0.45);
            dl.insertAdjacentHTML('beforeend', `<dt>${k}</dt><dd>${v ? '+' + v.toLocaleString('en') : '---'}</dd>`);
            sum += v; sfx('select');
            $('.t-total b', el).textContent = '+' + sum.toLocaleString('en');
        }
        addScore(sum);
        hits.clear();
        await Promise.race([until(() => press('ok')), wait(6)]);
        show('tally', false);
        sfx('select');
    }

    function openContinue() {
        if (G.continues <= 0) { frozen = true; go(gameOverFlow); return; }
        frozen = true; P.ctrl = false;
        A.stopMusic(); wantSong = '';
        contT = 9.99;
        $('#cont-left').textContent = `${G.continues} continue${G.continues === 1 ? '' : 's'} left`;
        show('cont');
        setMenu($('#cont .menu'));
    }
    let contT = 0;
    function updateContinue(dt) {
        if ($('#cont').hidden) return;
        contT -= dt;
        $('#cont-n').textContent = Math.max(0, Math.ceil(contT - 1));
        if (contT <= 0) go(gameOverFlow);
    }
    function doContinue() {
        G.continues--; G.lives = D().lives;
        show('cont', false); setMenu(null);
        frozen = false;
        resetPlayer(false); P.inv = 2.6; P.ctrl = !talkOpen();
        music(boss ? (boss.k === 'king' ? 'king' : 'boss') : ST.def.music);
        sfx('oneup');
    }
    async function gameOverFlow() {
        newFlow();
        frozen = false; paused = false; hideAll(); setMenu(null); setMode('over');
        const score = G ? G.score : 0;
        music('gameover');
        $('#over-score').innerHTML = `SCORE <b>${score.toLocaleString('en')}</b>`;
        show('over');
        await wait(1);
        hits.clear();
        await Promise.race([until(() => press('ok')), wait(5)]);
        show('over', false);
        await finishRun(score);
    }
    async function finishRun(score) {
        if (qualifies(score)) await entryFlow(score);
        else go(() => titleFlow(true));
    }
    async function entryFlow(score) {
        hideAll(); setMode('entry'); setScene('title'); setMenu(null);
        $('#entry-score').innerHTML = `${score.toLocaleString('en')} points`;
        show('entry');
        const inp = $('#entry-in');
        inp.value = store.get('heind.subdx.name', '');
        setTimeout(() => inp.focus(), 50);
        let done = false;
        $('#entry-form').onsubmit = (e) => {
            e.preventDefault();
            const name = (inp.value || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, '.');
            store.set('heind.subdx.name', name);
            const list = scores().concat([[name, score, true]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
            store.set('heind.subdx.scores', list.map(([n, s]) => [n, s]));
            showScores(list.findIndex((r) => r[2]));
            sfx('oneup');
            done = true;
            inp.blur();
        };
        await until(() => done);
    }
    function showScores(mark = -1) {
        hideAll(); setMode('scores'); if (!scene) setScene('title');
        $('#score-list').innerHTML = scores().map(([n, s], i) => `<li class="${i === mark ? 'new' : ''}"><span>${i + 1}.</span><b>${esc(n)}</b><i>${s.toLocaleString('en')}</i></li>`).join('');
        show('scores');
        setMenu($('#scores .menu'));
    }

    async function endingFlow() {
        newFlow();
        hideAll(); setMode('ending'); setMenu(null);
        music('ending');
        const tok = flowTok;
        const finalScore = G.score;
        storySkip = () => { if (tok === flowTok) { storySkip = null; newFlow(); hideAll(); go(() => finishRun(finalScore)); } };
        setScene('rise');
        await wait(1.5);
        await say(null, 'The Great Pearl rises, and the sea lights up again: midnight, twilight, sunlit. Green, as far as the eye can see.');
        await until(() => sceneT > 7.5);
        setScene('home');
        await wait(1);
        await say(null, 'The Takoyaki Clan went home to do what they do best: being delicious. The AUGURK surfaced to a hero\'s welcome (one ship, two seagulls).');
        await say('BUB', 'We did it, captain! Same time next week?');
        $('#roll-score').textContent = finalScore.toLocaleString('en');
        $('#roll-diff').textContent = D().name;
        show('credits');
        const roll = $('#roll');
        roll.classList.remove('go'); void roll.offsetWidth; roll.classList.add('go');
        await wait(26);
        hits.clear();
        await Promise.race([until(() => press('ok')), wait(8)]);
        show('credits', false);
        storySkip = null;
        await finishRun(finalScore);
    }

    function setPause(on) {
        if (mode !== 'game' || frozen) return;
        paused = on;
        show('pause', on);
        if (on) { setMenu($('#pause .menu')); sfx('pause'); A.duck(true); }
        else { setMenu(null); A.duck(false); }
    }

    /* ---------- options ---------- */
    function cycle(what, dir) {
        if (what === 'diff') { const k = Object.keys(DIFF); CFG.diff = k[(k.indexOf(CFG.diff) + dir + k.length) % k.length]; }
        if (what === 'pal') { const k = Object.keys(PALS); CFG.pal = k[(k.indexOf(CFG.pal) + dir + k.length) % k.length]; }
        if (what === 'sound') { CFG.sfx = !CFG.sfx; A.sfxOn = CFG.sfx; }
        if (what === 'music') { CFG.music = !CFG.music; A.setMusic(CFG.music); }
        if (what === 'crt') CFG.crt = !CFG.crt;
        saveCfg(); syncOptions(); sfx('move');
    }
    function syncOptions() {
        $$('[data-cycle="diff"] b').forEach((b) => { b.textContent = D().name; });
        $$('[data-cycle="pal"] b').forEach((b) => { b.textContent = pal().name.toUpperCase(); });
        $$('[data-cycle="sound"] b').forEach((b) => { b.textContent = CFG.sfx ? 'ON' : 'OFF'; });
        $$('[data-cycle="music"] b').forEach((b) => { b.textContent = CFG.music ? 'ON' : 'OFF'; });
        screen.classList.toggle('crt', CFG.crt);
        $$('.mb-drop [data-opt]').forEach((b) => {
            const [k, v] = b.dataset.opt.split(':');
            const on = v ? CFG[k] === v : !!CFG[k];
            b.parentElement.classList.toggle('on', on);
        });
        document.documentElement.dataset.pal = CFG.pal;
    }

    /* ---------- buttons, menu bar, window ---------- */
    const ACTS = {
        new: () => { sfx('select'); startGame(); },
        story: () => { sfx('select'); go(() => storyFlow(false)); },
        scores: () => { sfx('select'); if (mode === 'game') return; showScores(); },
        howto: () => { sfx('select'); if (mode === 'game') { setPause(true); return; } hideAll(); setMode('howto'); show('howto'); setMenu($('#howto .menu')); },
        back: () => { sfx('back'); go(() => titleFlow(true)); },
        resume: () => { sfx('select'); setPause(false); },
        restart: () => { sfx('select'); paused = false; show('pause', false); A.duck(false); G.score = G.stageScore ?? G.score; go(gameFlow); },
        quit: () => { sfx('back'); paused = false; A.duck(false); go(() => titleFlow(true)); },
        cont: () => doContinue(),
        giveup: () => { sfx('back'); go(gameOverFlow); },
        pause: () => { if (mode === 'game') setPause(!paused); },
        about: () => alertBox('About Subshootica DX', '<p><b>Subshootica DX</b> &middot; the deep sea edition</p><p>A remix of <i>Subshootica</i> (2024), my GameBoy-style shoot \'em up, rebuilt with low-poly models, dithering and four bosses from the Takoyaki Clan.</p><p>Everything you see and hear is generated in code: a tiny 3D renderer, a Bayer dither and a WebAudio chiptune tracker.</p>'),
        home: () => { location.href = 'index.html'; },
        zoom: () => toggleZoom(),
        full: () => toggleFull()
    };
    document.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cycle]');
        if (c && !c.closest('.mb-drop')) { cycle(c.dataset.cycle, 1); return; }
        const opt = e.target.closest('[data-opt]');
        if (opt) {
            const [k, v] = opt.dataset.opt.split(':');
            if (v) { CFG[k] = v; saveCfg(); syncOptions(); sfx('move'); }
            else cycle(k === 'sfx' ? 'sound' : k, 1);
            closeMenus();
            return;
        }
        const a = e.target.closest('[data-act]');
        if (a && ACTS[a.dataset.act]) { closeMenus(); ACTS[a.dataset.act](); }
    });

    // Mac menu bar
    let openBtn = null;
    const closeMenus = () => { $$('.mb-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false')); openBtn = null; };
    $$('.mb-btn').forEach((b) => {
        b.addEventListener('click', (e) => { e.stopPropagation(); const was = b.getAttribute('aria-expanded') === 'true'; closeMenus(); if (!was) { b.setAttribute('aria-expanded', 'true'); openBtn = b; if (mode === 'game' && !paused) setPause(true); } });
        b.addEventListener('pointerenter', () => { if (openBtn && openBtn !== b) { closeMenus(); b.setAttribute('aria-expanded', 'true'); openBtn = b; } });
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.mb-item')) closeMenus(); });
    const tickClock = () => { const d = new Date(); $('#clock').textContent = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
    tickClock(); setInterval(tickClock, 15000);

    function alertBox(title, html) {
        const wasPaused = paused;
        if (mode === 'game' && !paused) setPause(true);
        const box = document.createElement('div');
        box.className = 'dlg-back';
        box.innerHTML = `<div class="dlg" role="alertdialog" aria-label="${esc(title)}"><div class="mac-title"><span class="mt-name"><span>${esc(title)}</span></span></div><div class="dlg-body"><i class="dlg-ico"></i><div>${html}</div></div><div class="dlg-btns"><button class="btn default" type="button">OK</button></div></div>`;
        $('#dialogs').appendChild(box);
        const close = () => { box.remove(); if (!wasPaused && mode === 'game') setPause(false); };
        $('button', box).addEventListener('click', close);
        $('button', box).focus();
    }

    $('.box-close').addEventListener('click', () => {
        if (mode === 'game' && !paused) setPause(true);
        const box = document.createElement('div');
        box.className = 'dlg-back';
        box.innerHTML = '<div class="dlg" role="alertdialog" aria-label="Quit"><div class="mac-title"><span class="mt-name"><span>Quit Subshootica?</span></span></div><div class="dlg-body"><i class="dlg-ico caution"></i><div><p><b>Surface and go back to heind.nl?</b></p><p>Your sub will be left where it is. Bub will look after it.</p></div></div><div class="dlg-btns"><button class="btn" type="button" data-x="stay">Keep diving</button><button class="btn default" type="button" data-x="go">Surface</button></div></div>';
        $('#dialogs').appendChild(box);
        box.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'go') location.href = 'index.html'; box.remove(); });
    });
    $('.box-zoom').addEventListener('click', () => toggleZoom());
    $('.box-shade').addEventListener('click', () => { $('#gamewin').classList.toggle('min'); if (mode === 'game' && !paused) setPause(true); });

    let zoomed = false;
    function toggleZoom() { zoomed = !zoomed; document.body.classList.toggle('zoomed', zoomed); fit(); }

    // Full screen = the game fills the whole browser window (no OS full-screen takeover).
    const isFull = () => document.body.classList.contains('fakefs');
    function toggleFull(force) {
        unlockAudio();
        const want = force == null ? !isFull() : force;
        document.body.classList.toggle('fakefs', want);
        fit(); syncFull();
        sfx('move');
    }
    const syncFull = () => {
        const on = isFull();
        document.body.classList.toggle('full', on);
        $$('[data-act="full"]').forEach((b) => { const li = b.closest('li'); if (li) li.classList.toggle('on', on); });
        $$('[data-act="full"] b').forEach((b) => { b.textContent = on ? 'ON' : 'OFF'; });
    };
    function fit() {
        const coarse = matchMedia('(pointer: coarse)').matches;
        document.body.classList.toggle('touch', coarse);
        const vw = document.documentElement.clientWidth, vh = innerHeight;
        const full = isFull();
        const chromeH = full ? 0 : zoomed ? 70 : 22 + 24 + 22 + 48;
        const aw = full ? innerWidth : vw - (vw < 600 ? 22 : 60), ah = vh - chromeH - (coarse ? 64 : 0);
        let s = Math.min(aw / W, ah / H);
        // whole pixels look best; in full screen only snap down when that barely shrinks the picture
        if (s >= 2 && !coarse && (!full || Math.floor(s) / s > 0.85)) s = Math.floor(s);
        s = Math.max(1, s);
        scale = s;
        cv.style.width = Math.round(W * s) + 'px';
        cv.style.height = Math.round(H * s) + 'px';
        screen.style.width = Math.round(W * s) + 'px';
        screen.style.height = Math.round(H * s) + 'px';
        screen.style.setProperty('--px', s + 'px');
    }
    addEventListener('resize', fit);

    /* ---------- main loop ---------- */
    let lastNow = performance.now(), toastLeft = 0;
    function loop(now) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - lastNow) / 1000);
        lastNow = now;
        if (document.hidden) return;
        pollPad();
        if (press('pause')) {
            if (mode === 'game' && !frozen && !$('#dialogs').children.length) setPause(!paused);
            else if ((mode === 'story' || mode === 'ending') && storySkip) storySkip();
            else if (mode === 'scores' || mode === 'howto') ACTS.back();
        }
        menuInput();
        if (!paused) {
            T += dt;
            if (!frozen) { clock += dt; sceneT += dt; }
            if (mode === 'game') updatePlay(dt);
            updateTalk(dt);
            updateContinue(dt);
            shake = Math.max(0, shake - dt * 2);
            flash = Math.max(0, flash - dt * 2.5);
            if (toastT > 0 && (toastT -= dt) <= 0) show('toast', false);
        }
        runWaiters();
        render();
        updateHUD();
        hits.clear();
        touch.dx = touch.dy = 0;
    }

    /* ---------- boot ---------- */
    fit();
    syncOptions();
    // Pixel icons for the HUD and menu bar.
    const pix = (rows, map, sc = 1) => {
        const c = document.createElement('canvas'); c.width = rows[0].length * sc; c.height = rows.length * sc;
        const x = c.getContext('2d');
        rows.forEach((r, y) => [...r].forEach((ch, i) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(i * sc, y * sc, sc, sc); } }));
        return `url(${c.toDataURL()})`;
    };
    const SUBI = ['....KK......', '...KGGK.....', '.KKKGGKKKK..', 'KGGGGGGGGGK.', 'KGYGYGYGGGGK', 'KGGGGGGGGGK.', '.KKKKKKKKK..'];
    const BOMBI = ['..K...', '.KKK..', 'KWKKK.', 'KKKKK.', 'KKKKK.', '.KKK..'];
    const ANCHOR = ['.....KK.....', '....K..K....', '.....KK.....', '..KKKKKKKK..', '.....KK.....', '.....KK.....', 'K....KK....K', 'KK...KK...KK', '.KKK.KK.KKK.', '...KKKKKK...', '.....KK.....'];
    const root = document.documentElement.style;
    root.setProperty('--i-sub', pix(SUBI, { K: '#0f380f', G: '#9bdc5a', Y: '#ffd23f' }));
    root.setProperty('--i-bomb', pix(BOMBI, { K: '#2e2e3e', W: '#ffffff' }));
    root.setProperty('--i-anchor', pix(ANCHOR, { K: '#1f4a8f' }));
    root.setProperty('--i-subbig', pix(SUBI, { K: '#000000', G: '#3f9446', Y: '#ffd23f' }, 2));
    const ARROW = ['B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB', 'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB'];
    const pad2 = (r) => r.map((s) => s.padEnd(11, ' '));
    root.setProperty('--cur-arrow', `${pix(pad2(ARROW), { B: '#000000', W: '#ffffff' }, 2)} 0 0, auto`);

    const logo = $('.logo-word');
    if (logo) logo.innerHTML = [...'SUBSHOOTICA'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');

    const ready = () => { $('#loading')?.remove(); go(() => titleFlow(false)); requestAnimationFrame(loop); };
    const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fonts.then(ready);

    // for testing in the console
    S.game = { get G() { return G; }, get ST() { return ST; }, get boss() { return boss; }, get E() { return E; }, P, startGame, ending: () => { G = G || { score: 12345, lives: 3, continues: 3, extendAt: 1e9, stage: 3, depth: 0 }; go(endingFlow); }, clearE: () => { E.length = 0; }, spawnBoss: (k) => spawnBoss(k), jump: (i) => { G = { score: 0, lives: D().lives, continues: 3, extendAt: 30000, stage: i, depth: 0 }; resetPlayer(true); go(gameFlow); }, skipTo: (t) => { if (ST) { ST.t = t; ST.wi = ST.def.waves.findIndex((w) => w[0] >= t); if (ST.wi < 0) ST.wi = ST.def.waves.length; } }, hit: hitAction, state: () => ({ mode, paused, frozen, talk: !!talk, E: E.length, EB: EB.length, boss: boss && { k: boss.k, hp: boss.hp } }) };
})();

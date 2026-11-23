/* The page around the ocean: windows, HUD, Bub, dialogs, menu bar, and the easter eggs. */
(() => {
    'use strict';
    const S = window.SEA, O = S.ocean, A = S.audio;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sfx = (n, a) => S.sfx && S.sfx(n, a);
    const ZONE_ORDER = ['surface', 'sunlit', 'twilight', 'midnight', 'abyss', 'hadal'];
    const root = document.documentElement;

    /* =====================================================================
       pixel art: cursors, icons, Bub, textures (all generated, no files)
       ===================================================================== */
    const pixels = (rows, pal, scale = 1) => {
        const h = rows.length, w = Math.max(...rows.map((r) => r.length));
        const c = document.createElement('canvas');
        c.width = w * scale; c.height = h * scale;
        const x = c.getContext('2d');
        rows.forEach((row, y) => [...row].forEach((ch, i) => {
            if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale); }
        }));
        return c.toDataURL('image/png');
    };

    const ARROW = [
        'B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB',
        'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB'
    ];
    const ANCHOR = [
        '................', '.......YY.......', '......Y..Y......', '.......YY.......', '.......YY.......',
        '....YYYYYYYY....', '.......YY.......', '.......YY.......', '.......YY.......', '.Y.....YY.....Y.',
        '.YY....YY....YY.', '..YY...YY...YY..', '...YYY.YY.YYY...', '.....YYYYYY.....', '.......YY.......', '................'
    ];
    const GLOBE = [
        '.....KKKKKK.....', '...KKBBBGGBBKK..', '..KBBBGGGGBBBK..', '.KBBBBGGGBBBBBK.', '.KBGGBBGBBBBBBK.',
        'KBGGGGBBBBBGGBBK', 'KBGGGGGBBBGGGGBK', 'KBBGGGBBBBBGGGBK', 'KBBBGBBBBBBBGBBK', 'KBBBBBBBGGBBBBBK',
        '.KBBBBBGGGGBBBK.', '.KBBBBBBGGBBBBK.', '..KBBBBBBBBBBK..', '...KKBBBBBBKK...', '.....KKKKKK.....', '................'
    ];
    const PAGE = [
        '..KKKKKKKK......', '..KWWWWWWKK.....', '..KWWWWWWKWK....', '..KWWWWWWKKKK...', '..KWBBBBWWWWK...',
        '..KWWWWWWWWWK...', '..KWBBBBBBBWK...', '..KWWWWWWWWWK...', '..KWBBBBBBBWK...', '..KWWWWWWWWWK...',
        '..KWBBBBBWWWK...', '..KWWWWWWWWWK...', '..KWWWWWWWWWK...', '..KKKKKKKKKKK...', '................', '................'
    ];

    const HAND = [
        '     BB', '    BWWB', '    BWWB', '    BWWB', '    BWWBBB', '    BWWBWWBBB', '    BWWBWWBWWBB', ' BB BWWBWWBWWBWB',
        'BWWBBWWWWWWWWWWB', 'BWWWBWWWWWWWWWWB', ' BWWBWWWWWWWWWWB', '  BWWWWWWWWWWWWB', '  BWWWWWWWWWWWB', '   BWWWWWWWWWWB',
        '    BWWWWWWWWB', '    BWWWWWWWWB', '    BBBBBBBBBB'
    ];
    const SPEAKER = [
        '................', '......K.........', '.....KK.....K...', '....KWK...K..K..', 'KKKKWWK....K..K.', 'KWWWWWK..K..K.K.',
        'KWWWWWK...K.K.K.', 'KWWWWWK...K.K.K.', 'KWWWWWK..K..K.K.', 'KKKKWWK....K..K.', '....KWK...K..K..', '.....KK.....K...', '......K.........'
    ];
    const NOTE = [
        '................', '.....KKKKKKKKK..', '.....KKKKKKKKK..', '.....K.......K..', '.....K.......K..', '.....K.......K..',
        '.....K.......K..', '.....K.......K..', '..KKKK....KKKK..', '.KKKKK...KKKKK..', '.KKKKK...KKKKK..', '..KKK.....KKK...'
    ];
    const BOLT = [
        '.........KKK....', '........KYYK....', '.......KYYK.....', '......KYYK......', '.....KYYKKKK....', '....KYYYYYYK....',
        '....KKKKYYK.....', '.......KYYK.....', '......KYYK......', '.....KYYK.......', '.....KYK........', '.....KK.........'
    ];
    const MOON = [
        '.....KKKK.......', '...KKYYYK.......', '..KYYYYK........', '.KYYYYK.........', '.KYYYK..........', 'KYYYYK..........',
        'KYYYYK..........', 'KYYYYK..........', '.KYYYYK.......K.', '.KYYYYYKK...KK..', '..KYYYYYYKKKYK..', '...KKYYYYYYYK...', '.....KKKKKKK....'
    ];
    const UP = [
        '.......KK.......', '......KYYK......', '.....KYYYYK.....', '....KYYYYYYK....', '...KYYYYYYYYK...', '..KKKKYYYYKKKK..',
        '.....KYYYYK.....', '.....KYYYYK.....', '.....KYYYYK.....', '.....KYYYYK.....', '.....KYYYYK.....', '.....KKKKKK.....'
    ];
    const HOME = [
        '.......KK.......', '......KRRK..KK..', '.....KRRRRK.KK..', '....KRRRRRRKKK..', '...KRRRRRRRRK...', '..KRRRRRRRRRRK..',
        '.KKKKKKKKKKKKKK.', '..KWWWWWWWWWWK..', '..KWWKKWWBBBWK..', '..KWWKYKWBBBWK..', '..KWWKYKWWWWWK..', '..KWWKYKWWWWWK..', '..KKKKKKKKKKKK..'
    ];
    const RELOAD = [
        '.....KKKKK......', '...KKGGGGGKK.K..', '..KGGKKKKKGGKGK.', '.KGGK.....KGGGK.', '.KGK.....KGGGGK.', 'KGGK.....KKKKKK.',
        'KGK.............', 'KGK.............', 'KGGK.......KK...', '.KGK......KGGK..', '.KGGK....KGGK...', '..KGGKKKKGGK....', '...KKGGGGGKK....', '.....KKKKK......'
    ];
    const EXT_ICONS = [];

    // Platinum alert icons, drawn pixel by pixel at 32x32.
    function alertIcons() {
        const make = (fn) => {
            const c = document.createElement('canvas');
            c.width = c.height = 32;
            const x = c.getContext('2d');
            const P = (X, Y, col) => { x.fillStyle = col; x.fillRect(X, Y, 1, 1); };
            fn(x, P);
            return c.toDataURL('image/png');
        };
        const shape = (inside, fill, P) => {
            for (let y = 0; y < 32; y++) for (let X = 0; X < 32; X++) {
                if (!inside(X + 0.5, y + 0.5, 0)) continue;
                P(X, y, inside(X + 0.5, y + 0.5, 1.6) ? fill : '#000000');
            }
        };
        const bang = (P, col, top, bot) => {
            for (let y = top; y < bot; y++) for (let X = 14; X < 18; X++) P(X, y, col);
            for (let y = bot + 3; y < bot + 6; y++) for (let X = 14; X < 18; X++) P(X, y, col);
        };
        return {
            stop: make((x, P) => {
                shape((X, Y, d) => { const a = Math.abs(X - 16), b = Math.abs(Y - 16); return a <= 14.5 - d && b <= 14.5 - d && a + b <= 20.5 - d * 1.4; }, '#e8562a', P);
                bang(P, '#ffffff', 7, 19);
            }),
            caution: make((x, P) => {
                shape((X, Y, d) => Y >= 3 + d * 1.6 && Y <= 29 - d && Math.abs(X - 16) <= (Y - 2) * 0.56 - d, '#ffd23f', P);
                bang(P, '#000000', 11, 21);
            }),
            bomb: make((x, P) => {
                shape((X, Y, d) => Math.hypot(X - 14, Y - 19) <= 11 - d, '#2e2e3e', P);
                [[9, 14], [10, 13], [11, 13], [9, 15], [10, 14]].forEach(([a, b]) => P(a, b, '#ffffff'));
                for (let X = 19; X < 24; X++) for (let Y = 7; Y < 11; Y++) P(X, Y, '#6b6b80');
                [[24, 6], [25, 5], [25, 4], [26, 3]].forEach(([a, b]) => P(a, b, '#c98a64'));
                [[27, 1], [27, 2], [28, 2], [26, 2], [27, 3], [29, 1], [25, 1], [29, 3], [25, 3]].forEach(([a, b], i) => P(a, b, i < 5 ? '#ffd23f' : '#e8562a'));
            }),
            gold: make((x) => {
                x.fillStyle = '#ffd23f'; x.strokeStyle = '#7a4b2e'; x.lineWidth = 1.5;
                x.beginPath();
                for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = -Math.PI / 2 + (i / 10) * Math.PI * 2; x.lineTo(16 + Math.cos(a) * r, 17 + Math.sin(a) * r); }
                x.closePath(); x.fill(); x.stroke();
            }),
            sub: make((x, P) => {
                shape((X, Y, d) => Math.pow((X - 15) / 13, 2) + Math.pow((Y - 19) / 6, 2) <= 1 - d * 0.14, '#3f9446', P);
                for (let X = 12; X < 19; X++) for (let Y = 9; Y < 14; Y++) P(X, Y, X === 12 || X === 18 || Y === 9 ? '#000000' : '#9bdc5a');
                for (const cx of [9, 15, 21]) for (let X = cx; X < cx + 3; X++) for (let Y = 18; Y < 21; Y++) P(X, Y, '#ffd23f');
                for (let Y = 4; Y < 9; Y++) P(15, Y, '#000000');
                P(16, 4, '#000000'); P(17, 4, '#000000');
            })
        };
    }


    function puffer(puffed) {
        const N = 32, c = document.createElement('canvas');
        c.width = c.height = N;
        const x = c.getContext('2d');
        const P = (X, Y, col) => { x.fillStyle = col; x.fillRect(X, Y, 1, 1); };
        const cx = 16, cy = 17, rx = puffed ? 11 : 9, ry = puffed ? 11 : 7;
        for (let X = cx - rx - 5; X <= cx - rx + 1; X++) {
            const k = cx - rx + 1 - X;
            for (let Y = cy - k; Y <= cy + k; Y++) P(X, Y, Math.abs(Y - cy) === k || X === cx - rx - 5 ? '#7a4b2e' : '#ff9a1f');
        }
        for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) {
            const dx = (X + 0.5 - cx) / rx, dy = (Y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
            if (d > 1) continue;
            const edge = d > 1 - 2.2 / Math.min(rx, ry);
            let col = Y > cy + ry * 0.15 ? '#fff1a6' : '#ffd23f';
            if (!edge && Y < cy && (X * 7 + Y * 13) % 11 === 0) col = '#ff9a1f';
            P(X, Y, edge ? '#7a4b2e' : col);
        }
        const nsp = puffed ? 16 : 7;
        for (let i = 0; i < nsp; i++) {
            const a = (i / nsp) * Math.PI * 2 + 0.2;
            for (let k = 1; k <= (puffed ? 2 : 1); k++) P(Math.round(cx + Math.cos(a) * (rx + k)), Math.round(cy + Math.sin(a) * (ry + k)), '#7a4b2e');
        }
        const ex = Math.round(cx + rx * 0.4), ey = Math.round(cy - ry * 0.35);
        [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1]].forEach(([a, b]) => P(ex + a, ey + b, '#ffffff'));
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b]) => P(ex + a, ey + b, '#000000'));
        P(cx + rx - 2, cy + 2, '#6e1a2c'); P(cx + rx - 1, cy + 2, '#6e1a2c');
        P(ex - 1, ey + 3, '#e8562a'); P(ex, ey + 3, '#e8562a');
        [[-1, 1], [0, 2], [-2, 2], [-1, 2], [-2, 3]].forEach(([a, b]) => P(cx + a, cy + b, '#ff9a1f'));
        return c.toDataURL('image/png');
    }

    function makeArt() {
        root.style.setProperty('--cur-arrow', `url(${pixels(ARROW, { B: '#ffffff', W: '#000000' }, 2)}) 0 0, auto`);
        root.style.setProperty('--cur-point', `url(${pixels(HAND, { B: '#000000', W: '#ffffff' }, 2)}) 10 0, pointer`);
        root.style.setProperty('--ico-anchor', `url(${pixels(ANCHOR, { Y: '#1f4a8f' })})`);
        root.style.setProperty('--throb', `url(${pixels(ANCHOR, { Y: '#ffd23f' })})`);
        root.style.setProperty('--ico-globe', `url(${pixels(GLOBE, { K: '#0b1530', B: '#2a68b3', G: '#3f9446' })})`);
        root.style.setProperty('--ico-page', `url(${pixels(PAGE, { K: '#0b1530', W: '#ffffff', B: '#6b6b80' })})`);
        const strip = {
            snd: pixels(SPEAKER, { K: '#000000', W: '#ffffff' }),
            midi: pixels(NOTE, { K: '#1f4a8f' }),
            turbo: pixels(BOLT, { K: '#000000', Y: '#ffd23f' }),
            night: pixels(MOON, { K: '#000000', Y: '#fff1a6' })
        };
        Object.entries(strip).forEach(([k, v]) => root.style.setProperty('--ico-' + k, `url(${v})`));
        root.style.setProperty('--ti-up', `url(${pixels(UP, { K: '#000000', Y: '#3b8fd4' })})`);
        root.style.setProperty('--ti-down', `url(${pixels([...UP].reverse(), { K: '#000000', Y: '#3b8fd4' })})`);
        root.style.setProperty('--ti-home', `url(${pixels(HOME, { K: '#000000', R: '#e8562a', W: '#fff1a6', B: '#5ab4e8', Y: '#7a4b2e' })})`);
        root.style.setProperty('--ti-reload', `url(${pixels(RELOAD, { K: '#000000', G: '#3f9446' })})`);
        const bubA = puffer(false);
        root.style.setProperty('--bub-a', `url(${bubA})`);
        root.style.setProperty('--bub-b', `url(${puffer(true)})`);
        const alerts = alertIcons();
        Object.entries(alerts).forEach(([k, v]) => root.style.setProperty('--ai-' + k, `url(${v})`));
        EXT_ICONS.push(pixels(ANCHOR, { Y: '#1f4a8f' }, 2), pixels(GLOBE, { K: '#0b1530', B: '#2a68b3', G: '#3f9446' }, 2), pixels(SPEAKER, { K: '#000', W: '#fff' }, 2),
            alerts.sub, pixels(NOTE, { K: '#1f4a8f' }, 2), pixels(PAGE, { K: '#0b1530', W: '#ffffff', B: '#6b6b80' }, 2), pixels(BOLT, { K: '#000', Y: '#ffd23f' }, 2),
            bubA, pixels(MOON, { K: '#000', Y: '#fff1a6' }, 2), alerts.gold, pixels(RELOAD, { K: '#000', G: '#3f9446' }, 2), pixels(HOME, { K: '#000', R: '#e8562a', W: '#fff1a6', B: '#5ab4e8', Y: '#7a4b2e' }, 2));

        const rnd = S.rng('textures');
        const tex = {
            bubbles: S.tile(64, 64, (x, w, h) => {
                x.fillStyle = '#dff4ff'; x.fillRect(0, 0, w, h);
                for (let i = 0; i < 14; i++) {
                    const bx = rnd() * w, by = rnd() * h, r = 1.5 + rnd() * 5;
                    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
                        x.strokeStyle = '#6fdde0'; x.lineWidth = 1;
                        x.beginPath(); x.arc(bx + ox, by + oy, r, 0, Math.PI * 2); x.stroke();
                        x.fillStyle = '#ffffff'; x.fillRect(bx + ox - r * 0.4, by + oy - r * 0.5, 1, 1);
                    }
                }
            }, 24),
            planks: S.tile(64, 64, (x, w, h) => {
                for (let i = 0; i < 4; i++) {
                    x.fillStyle = ['#7a4b2e', '#6a4128', '#7a4b2e', '#5a3a26'][i];
                    x.fillRect(0, i * 16, w, 16);
                    x.fillStyle = '#3d2a1e'; x.fillRect(0, i * 16 + 15, w, 1);
                    x.fillRect(((i * 37) % 48) + 8, i * 16, 1, 15);
                    x.fillStyle = '#c98a64'; x.fillRect(((i * 37) % 48) + 12, i * 16 + 4, 1, 1); x.fillRect(((i * 37) % 48) + 4, i * 16 + 4, 1, 1);
                    x.fillStyle = 'rgba(201,138,100,0.25)';
                    for (let k = 0; k < 6; k++) x.fillRect(rnd() * w, i * 16 + 2 + rnd() * 12, 6 + rnd() * 14, 1);
                }
            }, 20),
            crate: S.tile(32, 32, (x, w, h) => {
                x.fillStyle = '#f2c6a0'; x.fillRect(0, 0, w, h);
                x.fillStyle = 'rgba(201,138,100,0.35)';
                for (let k = 0; k < 10; k++) x.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 10, 1);
            }, 10),
            paper: S.tile(64, 64, (x, w, h) => {
                x.fillStyle = '#fff1a6'; x.fillRect(0, 0, w, h);
                x.fillStyle = 'rgba(217,189,132,0.35)';
                for (let k = 0; k < 60; k++) x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1);
            }, 18),
            stars: S.tile(64, 64, (x, w, h) => {
                x.fillStyle = '#11214a'; x.fillRect(0, 0, w, h);
                for (let k = 0; k < 18; k++) {
                    x.fillStyle = ['#ffffff', '#ffd23f', '#ff4fd8', '#6fdde0'][k % 4];
                    const sx = (rnd() * w) | 0, sy = (rnd() * h) | 0;
                    x.fillRect(sx, sy, 1, 1);
                    if (k % 5 === 0) { x.fillRect(sx - 1, sy, 3, 1); x.fillRect(sx, sy - 1, 1, 3); }
                }
            }, 0),
            scan: S.tile(4, 4, (x) => { x.fillStyle = '#020a06'; x.fillRect(0, 0, 4, 4); x.fillStyle = '#05170c'; x.fillRect(0, 0, 4, 2); }, 0)
        };
        Object.entries(tex).forEach(([k, v]) => root.style.setProperty('--tex-' + k, `url(${v})`));
    }

    /* =====================================================================
       Bub, dialogs
       ===================================================================== */
    const bub = { box: $('#bub-say'), text: $('#bub-text'), sprite: $('#bub-sprite'), timer: 0, typer: 0, hint: 0, clicks: 0, live: null };
    bub.box.removeAttribute('role'); bub.box.removeAttribute('aria-live');
    bub.live = Object.assign(document.createElement('div'), { className: 'sr-only' });
    bub.live.setAttribute('aria-live', 'polite');
    bub.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
    document.body.append(bub.live);
    const hints = [...S.BUB_HINTS].sort(() => Math.random() - 0.5);

    S.say = (msg) => {
        clearTimeout(bub.timer); clearInterval(bub.typer);
        bub.box.hidden = false;
        bub.live.textContent = msg;
        const chars = [...msg];
        if (reduced) bub.text.textContent = msg;
        else {
            let i = 0;
            bub.text.textContent = '';
            bub.typer = setInterval(() => {
                bub.text.textContent += chars.slice(i, i + 2).join('');
                i += 2;
                if (i % 4 === 0) sfx('type');
                if (i >= chars.length) clearInterval(bub.typer);
            }, 30);
        }
        bub.timer = setTimeout(() => { bub.box.hidden = true; }, 5000 + msg.length * 55);
    };
    const say = S.say;
    const puff = () => {
        bub.sprite.classList.add('puffed');
        clearTimeout(bub.pt);
        bub.pt = setTimeout(() => bub.sprite.classList.remove('puffed'), 1100);
    };
    bub.sprite.addEventListener('click', () => {
        puff(); sfx('bloop');
        bub.clicks++;
        if (bub.clicks === 12) { say("ok ok! i'm fully inflated! stop poking!"); return; }
        say(hints[bub.hint++ % hints.length]);
    });
    $('.bub-x').addEventListener('click', () => { bub.box.hidden = true; });

    let dlgN = 0;
    const ICON_ALIAS = { err: 'stop', warn: 'caution', info: 'note' };
    S.dialog = ({ title, icon = 'note', html, buttons = [{ label: 'OK' }] }) => new Promise((resolve) => {
        icon = ICON_ALIAS[icon] || icon;
        const id = 'dlg-t' + (++dlgN);
        const prev = document.activeElement;
        const back = document.createElement('div');
        back.className = 'dlg-back';
        back.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="${id}">
            <div class="mac-title"><span class="mt-name"><span id="${id}">${esc(title)}</span></span></div>
            <div class="dlg-body"><div class="dlg-ico ${icon}" aria-hidden="true"></div><div>${html}</div></div>
            <div class="dlg-btns"></div></div>`;
        const close = (i) => { back.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus({ preventScroll: true }); resolve(i); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(-1); } };
        const btns = $('.dlg-btns', back);
        let def = null;
        // Mac order: the default (first) button sits on the right, with the thick ring.
        buttons.map((b, i) => [b, i]).reverse().forEach(([b, i]) => {
            const el = document.createElement(b.href ? 'a' : 'button');
            el.className = 'btn' + (i === 0 ? ' default' : '');
            el.textContent = b.label;
            if (b.href) { el.href = b.href; el.target = '_blank'; el.rel = 'noopener'; } else el.type = 'button';
            el.addEventListener('click', () => { close(i); if (b.action) b.action(); });
            btns.append(el);
            if (i === 0) def = el;
        });
        document.addEventListener('keydown', onKey, true);
        $('#dialogs').append(back);
        (def || back).focus();
        sfx(icon === 'stop' || icon === 'caution' || icon === 'bomb' ? 'error' : 'pop');
    });

    const dialog = S.dialog;

    /* =====================================================================
       content
       ===================================================================== */
    function renderSkills() {
        const ul = $('#skills');
        ul.innerHTML = S.TOOLS.map((t) => `<li><span>${esc(t.name)}</span><span class="bar" role="progressbar" aria-label="${esc(t.name)}" aria-valuenow="${t.p}" aria-valuemin="0" aria-valuemax="100">${'<i></i>'.repeat(20)}</span><span class="pct">0%</span></li>`).join('');
        const io = new IntersectionObserver((ents) => ents.forEach((en) => {
            if (!en.isIntersecting) return;
            io.disconnect();
            $$('li', ul).forEach((li, k) => {
                const target = S.TOOLS[k].p, blocks = $$('.bar i', li), pct = $('.pct', li);
                let v = 0;
                const iv = setInterval(() => {
                    v = Math.min(target, v + 5);
                    blocks.forEach((b, j) => b.classList.toggle('on', j < Math.round(v / 5)));
                    pct.textContent = v + '%';
                    if (v >= target) clearInterval(iv);
                }, reduced ? 1 : 70 + k * 10);
            });
        }), { threshold: 0.4 });
        io.observe(ul);
    }

    const ditherIO = new IntersectionObserver((ents) => ents.forEach((en) => {
        if (!en.isIntersecting) return;
        ditherIO.unobserve(en.target);
        fillDither(en.target);
    }), { rootMargin: '600px 0px' });

    async function fillDither(box) {
        const src = box.dataset.src, w = +box.dataset.w || 160;
        const img = new Image();
        img.src = src;
        img.alt = box.dataset.alt || '';
        img.decoding = 'async';
        box.append(img);
        const c = await S.ditherImage(src, w);
        if (c) {
            c.setAttribute('role', 'img');
            c.setAttribute('aria-label', box.dataset.alt || '');
            img.alt = '';
            img.setAttribute('aria-hidden', 'true');
            box.insertBefore(c, img);
        } else box.classList.add('fallback');
    }
    const watchDither = (scope = document) => $$('.dither-box[data-src]:not([data-w-done])', scope).forEach((b) => { b.dataset.wDone = '1'; ditherIO.observe(b); });

    const cargo = { filter: 'all', expanded: false };
    const INITIAL = 9;
    const sorted = [...S.PROJECTS].sort((a, b) => {
        if (!!b.pin !== !!a.pin) return b.pin ? 1 : -1;
        if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
        const ah = a.type === 'human', bh = b.type === 'human';
        if (ah !== bh) return ah ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
    });
    const mainLink = (p) => S.link(p.demo) || S.link(p.source) || S.HOME;

    function crateHTML(p) {
        const r = S.rng(p.id);
        const rot = (r() * 3 - 1.5).toFixed(2), sr = (-3 - r() * 9).toFixed(1);
        const demo = S.link(p.demo), src = S.link(p.source), main = mainLink(p);
        const st = S.STAMPS[p.type];
        return `<li class="crate" data-id="${esc(p.id)}" style="--r:${rot}deg">
            <a class="dither-box" href="${esc(main)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true" data-src="images/projects/${esc(p.img)}.jpg" data-w="200"></a>
            ${st ? `<span class="b88 stamp s-${p.type}" style="--sr:${sr}deg" title="${esc(st.note)}">${st.label}</span>` : ''}
            <h3><a href="${esc(main)}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
            <p>${esc(p.desc)}</p>
            <p class="crate-meta">${p.year} &middot; ${esc(p.tech.slice(0, 2).join(', '))}</p>
            <p class="crate-links">${demo ? `<a class="btn" href="${esc(demo)}" target="_blank" rel="noopener">&#9654; play</a>` : ''}${src ? `<a class="btn" href="${esc(src)}" target="_blank" rel="noopener">&lt;/&gt; code</a>` : ''}</p>
        </li>`;
    }

    function renderCargo() {
        const list = sorted.filter((p) => cargo.filter === 'all' || p.type === cargo.filter);
        const shown = cargo.filter === 'all' && !cargo.expanded ? list.slice(0, INITIAL) : list;
        $('#crates').innerHTML = shown.map(crateHTML).join('');
        watchDither($('#crates'));
        const more = $('#more');
        more.hidden = !(cargo.filter === 'all' && sorted.length > INITIAL);
        more.textContent = cargo.expanded ? 'stow some cargo' : `haul up more cargo (${sorted.length - INITIAL} crates)`;
        $$('#filters .b88').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === cargo.filter)));
    }

    function renderFilters() {
        const defs = [['all', 'ALL CARGO'], ['human', S.STAMPS.human.label], ['partial-ai', S.STAMPS['partial-ai'].label], ['full-ai', S.STAMPS['full-ai'].label]];
        $('#filters').innerHTML = defs.map(([f, label]) => {
            const n = f === 'all' ? sorted.length : sorted.filter((p) => p.type === f).length;
            return n ? `<button type="button" class="b88 s-${f}" data-f="${f}" aria-pressed="false" title="${esc(f === 'all' ? 'everything' : S.STAMPS[f].note)}">${label}<small>${n} crate${n === 1 ? '' : 's'}</small></button>` : '';
        }).join('');
        $('#filters').addEventListener('click', (e) => {
            const b = e.target.closest('[data-f]');
            if (!b) return;
            cargo.filter = b.dataset.f; cargo.expanded = false;
            sfx('click');
            renderCargo();
        });
        $('#crates').addEventListener('click', (e) => {
            const a = e.target.closest('h3 a, a.dither-box');
            if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1 || !S.openProject) return;
            e.preventDefault();
            S.openProject(a.closest('.crate').dataset.id);
        });
        $('#more').addEventListener('click', () => {
            cargo.expanded = !cargo.expanded;
            sfx('clank');
            renderCargo();
            if (!cargo.expanded) $('.w-cargo').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
        });
    }

    function renderLog() {
        $('#log').innerHTML = S.POSTS.map((p) => `<li>
            <time datetime="${p.date}">LOG ENTRY ${p.date.replace(/-/g, '.')}</time>
            <h4><a href="${esc(S.postLink(p.id))}" target="_blank" rel="noopener">${esc(p.title)}</a></h4>
            <p>${esc(p.excerpt)} <a href="${esc(S.postLink(p.id))}" target="_blank" rel="noopener">read entry&nbsp;&rarr;</a></p>
        </li>`).join('');
    }

    const GB = 'heind.logbook';
    const gb = { shared: false, remote: [] };
    function renderGuestbook() {
        const mine = gb.shared ? gb.remote : store.get(GB, []).slice().reverse();
        const all = [...mine, ...S.GUESTBOOK_SEED];
        $('#guest-list').innerHTML = all.map((g) => `<li><time>${esc(g.date)}</time><b>${esc(g.name)}</b> wrote:<br>${esc(g.msg)}</li>`).join('');
    }
    async function loadGuestbook() {
        if (!S.GUESTBOOK_API || location.protocol === 'file:') return;
        try {
            const r = await fetch(S.GUESTBOOK_API, { headers: { Accept: 'application/json' } });
            if (!r.ok) return;
            const d = await r.json();
            if (!d || !Array.isArray(d.entries)) return;
            gb.shared = true;
            gb.remote = d.entries;
            $('#guest-note').innerHTML = 'Entries are stored in a bottle on my server, so everyone can read them. Be nice!';
            renderGuestbook();
        } catch (e) { /* no PHP here: stay local */ }
    }
    $('#guest-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target, fd = new FormData(form);
        const name = String(fd.get('name') || '').trim().slice(0, 24), msg = String(fd.get('msg') || '').trim().slice(0, 140);
        if (!name || !msg) return;
        if (fd.get('website')) return; // bots fill in the hidden field
        const btn = $('button[type=submit]', form);
        if (gb.shared) {
            btn.disabled = true;
            try {
                const r = await fetch(S.GUESTBOOK_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, msg, website: '' }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) { say(d.error || 'the bottle bounced back. try again in a bit.'); btn.disabled = false; return; }
                gb.remote = d.entries || gb.remote;
            } catch (err) { say('the bottle bounced back. try again in a bit.'); btn.disabled = false; return; }
            btn.disabled = false;
            say("thanks for signing! it's in the logbook for everyone to read. ♥");
        } else {
            const mine = store.get(GB, []);
            mine.push({ name, msg, date: new Date().toISOString().slice(0, 10) });
            store.set(GB, mine.slice(-30));
            say("thanks for signing! it's safe in a bottle in your browser. hein will never know. ♥");
        }
        form.reset();
        renderGuestbook();
        sfx('chord');
    });

    function render88() {
        const B = [
            ['SEANET', 'navigator 2.0', 'linear-gradient(#2a68b3,#0b1530)'],
            ['BUBBLE', 'powered', 'radial-gradient(circle at 30% 30%,#b5f1e8,#1b8a99)'],
            ['BEST VIEWED', 'at 800×600', 'linear-gradient(90deg,#3d2a1e,#7a4b2e)'],
            ['NO TABLES', 'were harmed', '#6e1a2c'],
            ['♥ THE SEA', 'since 1998', 'linear-gradient(#ff4fd8,#8a3cff)'],
            ['HANDMADE', '-ish', 'repeating-linear-gradient(45deg,#3f9446 0 4px,#1e5234 4px 8px)'],
            ['WEBRING', 'member', 'linear-gradient(90deg,#0b1530,#183268)'],
            ['GET SEANET', 'free!!', 'linear-gradient(#ffd23f,#ff9a1f)']
        ];
        $('#buttons88').innerHTML = B.map(([a, b, bg], i) => `<span class="b88" style="background:${bg};${i === 7 ? 'color:#0b1530' : ''}">${a}<small${i === 7 ? ' class="blink"' : ''}>${b}</small></span>`).join('');
    }

    /* =====================================================================
       windows: title bars, dragging, buttons
       ===================================================================== */
    function setupWindows() {
        $$('.win[data-title]').forEach((win) => {
            const title = win.dataset.title;
            const bar = document.createElement('div');
            bar.className = 'mac-title';
            bar.innerHTML = `<button type="button" class="box box-close" data-w="close" aria-label="Close ${esc(title)}"></button>
                <span class="mt-name"><span>${esc(title)}</span></span>
                <button type="button" class="box box-zoom" data-w="reset" aria-label="Put ${esc(title)} back"></button>
                <button type="button" class="box box-shade" data-w="min" aria-label="Collapse ${esc(title)}"></button>`;
            win.prepend(bar);
            const zone = win.closest('.zone');
            const status = document.createElement('div');
            status.className = 'win-status';
            status.innerHTML = `<span>Document: Done.</span><span>${S.ZONES[zone.id] ? S.ZONES[zone.id].name : ''}</span><i class="grow" aria-hidden="true"></i>`;
            win.append(status);

            let drag = null;
            const pos = { x: 0, y: 0 };
            const apply = () => { win.style.transform = pos.x || pos.y ? `translate(${pos.x}px, ${pos.y}px)` : ''; };
            bar.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button')) return;
                drag = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
                bar.setPointerCapture(e.pointerId);
                win.classList.add('dragging');
            });
            bar.addEventListener('pointermove', (e) => {
                if (!drag) return;
                pos.x = e.clientX - drag.sx; pos.y = e.clientY - drag.sy;
                apply();
            });
            const end = () => { if (drag) { drag = null; win.classList.remove('dragging'); } };
            bar.addEventListener('pointerup', end);
            bar.addEventListener('pointercancel', end);
            bar.addEventListener('dblclick', () => { pos.x = pos.y = 0; apply(); });

            bar.addEventListener('click', (e) => {
                const b = e.target.closest('[data-w]');
                if (!b) return;
                sfx('click');
                if (b.dataset.w === 'min') win.classList.toggle('min');
                if (b.dataset.w === 'reset') { pos.x = pos.y = 0; apply(); win.classList.remove('min'); }
                if (b.dataset.w === 'close') {
                    win.dataset.closes = (+win.dataset.closes || 0) + 1;
                    if (+win.dataset.closes >= 3) {
                        dialog({ title: title, icon: 'caution', html: `<p><b>Fine.</b></p><p>“${esc(title)}” has been windowshaded instead. It's sulking.</p>`, buttons: [{ label: 'Sorry' }] });
                        win.classList.add('min');
                    } else {
                        dialog({ title: 'Error', icon: 'stop', html: `<p><b>The window “${esc(title)}” could not be closed because it is waterlogged.</b></p><p>Please try again when it's dry.</p>`, buttons: [{ label: 'OK' }] });
                    }
                }
            });
        });
        document.addEventListener('pointerdown', (e) => {
            const w = e.target.closest('main .win');
            if (!w) return;
            $$('main .win').forEach((o) => { o.classList.toggle('raised', o === w); o.classList.toggle('inactive', o !== w); });
        });
    }

    /* =====================================================================
       navigation, HUD
       ===================================================================== */
    const curZone = () => O.zoneAt(window.scrollY + window.innerHeight * 0.5);
    const goZone = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'surface') window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    };
    const resurface = () => {
        goZone('surface');
        sfx('bloop');
        for (let i = 0; i < 40; i++) setTimeout(() => O.burst(Math.random() * window.innerWidth, window.innerHeight * (0.4 + Math.random() * 0.6), 2), i * 25);
    };

    let curM = 0, lastZone = null;
    const seenZones = new Set();

    function hud() {
        const y = window.scrollY + window.innerHeight * 0.5;
        const m = Math.max(0, O.metersAt(y));
        curM = m;
        A.setDepth(m);
        const z = curZone();
        if (z !== lastZone) {
            lastZone = z;
            const info = S.ZONES[z];
            const addr = $('#addr');
            if (document.activeElement !== addr) addr.value = 'seanet://heind.nl/~hein/' + info.file;
            $('#win-name').textContent = 'SeaNet Navigator — ' + info.file.split('/').pop();
            if (booted && !seenZones.has(z)) { seenZones.add(z); say(S.BUB_ZONE[z]); }
        }
    }

    let hudQueued = false, busyT = 0;
    window.addEventListener('scroll', () => {
        if (!hudQueued) { hudQueued = true; requestAnimationFrame(() => { hudQueued = false; hud(); }); }
        document.body.classList.add('busy');
        clearTimeout(busyT);
        busyT = setTimeout(() => document.body.classList.remove('busy'), 350);
    }, { passive: true });


    /* O2: runs out after ~4 minutes underwater, then the system bombs. */
    const o2 = { v: 100, warned: false, dead: false, gills: store.get('heind.gills', false) };
    setInterval(() => {
        if (document.hidden || $('#dialogs').children.length) return;
        if (curM > 3 && !o2.gills && !O.sub) o2.v = Math.max(0, o2.v - (100 / 240) * 0.5);
        else o2.v = Math.min(100, o2.v + 15);
        if (o2.v > 90) { o2.warned = false; o2.dead = false; }
        if (o2.v < 25 && !o2.warned) { o2.warned = true; say('psst. you\'ve been underwater a while. your O₂ is getting low. resurface, or... just hold your breath?'); }
        if (o2.v <= 0 && !o2.dead) {
            o2.dead = true;
            dialog({
                title: 'System Error', icon: 'bomb',
                html: '<p><b>Sorry, a system error occurred.</b></p><p>“Lungs”</p><p class="mono">unimplemented trap: out of oxygen (error 25)</p>',
                buttons: [{ label: 'Resurface', action: resurface }, { label: 'Hold Breath', action: () => { o2.gills = true; store.set('heind.gills', true); o2.v = 100; say('Gills extension loaded. you can breathe underwater now. don\'t ask how.'); } }]
            });
        }
    }, 500);


    /* =====================================================================
       menu bar, Control Strip, browser window, toggles
       ===================================================================== */
    let subUnlocked = store.get('heind.sub', false);
    const setTurbo = (on) => {
        O.turbo = on;
        sfx('switch');
        say(on ? 'TURBO ON. 60 frames per second. your 486 is sweating.' : 'turbo off. back to a cinematic 12 fps.');
        sync();
    };
    const setNight = (on) => {
        O.night = on; O.dirty = true;
        root.classList.toggle('night', on);
        sfx('switch');
        say(on ? 'lights off. the fish are sleeping now. shhh.' : 'good morning!');
        sync();
    };
    S.toggleNight = () => setNight(!O.night);
    const unlockSub = () => { subUnlocked = true; store.set('heind.sub', true); sync(); };
    const setSub = (on, quiet) => {
        if (on && root.classList.contains('lite')) setLite(false, true);
        O.subMode(on);
        document.body.classList.toggle('sub-mode', on);
        $('#subhud').hidden = !on;
        $('#score').textContent = '0';
        $('#lives').textContent = '♥♥♥';
        if (!quiet) say(on ? 'SUBSHOOTICA MODE! the Takoyaki Clan is invading. click to fire torpedoes, ESC to quit.' : `back to normal. final score: ${O.score}.`);
        sync();
    };

    /* lite mode: no canvas, no effects, just the pages */
    const LITE = 'heind.lite';
    const setLite = (on, quiet) => {
        root.classList.toggle('lite', on);
        O.pause(on);
        if (!quiet || on === false) store.set(LITE, on);
        if (on && O.sub) setSub(false, true);
        if (!quiet) say(on ? 'dive skipped. everything is plain and fast now. (View > Skip the Dive to switch back.)' : 'welcome back to the ocean!');
        sync();
        requestAnimationFrame(() => { O.relayout(); hud(); });
    };
    S.setLite = setLite;
    $$('[data-lite]').forEach((b) => b.addEventListener('click', () => setLite(true)));
    const HI = 'heind.hiscore';
    $('#hiscore').textContent = store.get(HI, 0);
    S.onScore = (score, lives) => {
        $('#score').textContent = score;
        if (lives != null) $('#lives').textContent = '♥'.repeat(Math.max(0, lives)) || '–';
        if (score >= 500 && !S._sc2) { S._sc2 = 1; say('500 points! the Takoyaki Clan trembles.'); }
    };
    S.onBoss = () => say("uh oh. that's the SQUID KING. aim for the face.");
    S.onGameOver = (score) => {
        setSub(false, true);
        const hi = store.get(HI, 0), best = score > hi;
        if (best) store.set(HI, score);
        $('#hiscore').textContent = Math.max(hi, score);
        dialog({
            title: 'GAME OVER', icon: 'sub',
            html: `<p><b>${best ? 'New high score!' : 'Game over, sailor.'}</b></p><p>You scored <b>${score}</b> points${best ? '' : ` (best: ${hi})`}. The real Subshootica has proper levels, power-ups and bosses.</p>`,
            buttons: [{ label: 'Play Subshootica', href: S.link('subshootica-dx.html') }, { label: 'Again!', action: () => setSub(true) }, { label: 'Done' }]
        });
    };

    const toggles = {
        snd: () => { A.toggle(); sync(); if (A.on) say('sound on! the ocean is mostly whooshing. click things.'); },
        midi: () => { A.toggleMidi(); sync(); if (A.midiOn) say('now playing: drunken_sailor.mid. a traditional banger.'); },
        turbo: () => setTurbo(!O.turbo),
        night: () => setNight(!O.night),
        lite: () => setLite(!root.classList.contains('lite')),
        sub: () => {
            if (subUnlocked) { setSub(!O.sub); return; }
            dialog({
                title: '???', icon: 'caution',
                html: '<p><b>This application needs a cheat code.</b></p><p style="font:22px var(--f-term)">↑ ↑ ↓ ↓ ← → ← → B A</p>',
                buttons: [{ label: 'OK' }, { label: "I don't have a keyboard", action: () => { unlockSub(); setSub(true); } }]
            });
        }
    };
    function sync() {
        const st = { snd: A.on, midi: A.midiOn, turbo: O.turbo, night: O.night, sub: O.sub, lite: root.classList.contains('lite') };
        $('#t-snd').setAttribute('aria-pressed', String(A.on));
        $('#t-midi').setAttribute('aria-pressed', String(A.midiOn));
        $('#t-turbo').setAttribute('aria-pressed', String(O.turbo));
        $('#t-night').setAttribute('aria-pressed', String(O.night));
        $$('.mb-drop [data-toggle]').forEach((b) => b.parentElement.classList.toggle('on', !!st[b.dataset.toggle]));
        $('#nowplaying').hidden = !A.midiOn;
        $('#sub-label').textContent = subUnlocked ? 'Subshootica Mode' : '???';
    }

    $('#t-snd').addEventListener('click', toggles.snd);
    $('#t-midi').addEventListener('click', toggles.midi);
    $('#t-turbo').addEventListener('click', toggles.turbo);
    $('#t-night').addEventListener('click', toggles.night);
    $('#cs-tab').addEventListener('click', () => {
        const c = $('#cstrip').classList.toggle('collapsed');
        $('#cs-tab').setAttribute('aria-expanded', String(!c));
        sfx('click');
    });

    const nav = (k) => {
        const i = ZONE_ORDER.indexOf(curZone());
        if (k === 'back') goZone(ZONE_ORDER[Math.max(0, i - 1)]);
        if (k === 'fwd') goZone(ZONE_ORDER[Math.min(ZONE_ORDER.length - 1, i + 1)]);
        if (k === 'home') resurface();
        if (k === 'reload') { O.relayout(); say('reloading the ocean... done. (it was the same ocean.)'); }
    };
    $$('[data-nav]').forEach((b) => b.addEventListener('click', () => { sfx('click'); nav(b.dataset.nav); }));

    const leave = () => dialog({
        title: 'SeaNet Navigator', icon: 'caution',
        html: '<p><b>Are you sure you want to leave the ocean?</b></p><p>Any unsaved fish will be lost.</p>',
        buttons: [{ label: 'Keep Diving' }, { label: 'Leave', action: () => say(`you can't leave, you're ${Math.round(curM)} m deep. (cmd+w works though.)`) }]
    });
    $$('[data-chrome]').forEach((b) => b.addEventListener('click', () => {
        sfx('click');
        const k = b.dataset.chrome;
        if (k === 'min') say("you can't windowshade the ocean.");
        if (k === 'max') {
            try {
                if (document.fullscreenElement) document.exitFullscreen();
                else root.requestFullscreen().catch(() => say('your browser said no to fullscreen. rude.'));
            } catch (e) { say('your browser said no to fullscreen. rude.'); }
        }
        if (k === 'close') leave();
    }));

    /* the menu bar: click to open, slide across to switch, like the real thing */
    let openBtn = null;
    const closeMenus = () => { if (openBtn) { openBtn.setAttribute('aria-expanded', 'false'); openBtn = null; } };
    const openMenu = (btn) => { closeMenus(); btn.setAttribute('aria-expanded', 'true'); openBtn = btn; sync(); sfx('click'); };
    $$('.mb-btn').forEach((b) => {
        b.addEventListener('click', (e) => { e.stopPropagation(); if (openBtn === b) closeMenus(); else openMenu(b); });
        b.addEventListener('pointerenter', () => { if (openBtn && openBtn !== b) openMenu(b); });
    });
    document.addEventListener('click', (e) => { if (openBtn && !e.target.closest('.mb-drop')) closeMenus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openBtn) { const b = openBtn; closeMenus(); b.focus(); } });
    const ACTS = S.ACTS = {
        about: () => dialog({ title: 'About This Ocean', icon: 'note', html: '<p><b>SeaOS 8.6</b></p><p>Built-in memory: 1 bathysphere<br>Largest unused block: the Pacific<br>Total depth: 10,935 m</p><p class="mono">© 2026 heind_ · no frameworks were harmed</p>' }),
        aboutnet: () => dialog({ title: 'About SeaNet Navigator', icon: 'note', html: '<p><b>SeaNet Navigator 2.0</b></p><p>A web browser for the bottom of the sea. Includes one (1) bathysphere and one (1) helpful pufferfish.</p>' }),
        resurface,
        save: () => dialog({ title: 'Save As…', icon: 'caution', html: '<p><b>The ocean could not be saved.</b></p><p>It is too big to fit on a floppy disk.</p>' }),
        print: () => dialog({ title: 'Print', icon: 'stop', html: '<p><b>Your printer is out of ocean.</b></p><p>Please insert more ocean and try again.</p>' }),
        close: leave,
        undo: () => say("you can't undo a dive. you can only resurface."),
        up: () => nav('back'),
        down: () => nav('fwd'),
        trash: () => dialog({
            title: 'Empty Trash', icon: 'caution',
            html: '<p><b>The Trash contains 1 item (a sunken ship, 4,000 tons).</b></p><p>Are you sure you want to permanently remove it?</p>',
            buttons: [{ label: 'OK', action: () => { sfx('clank'); say('the trash is too heavy. it sank again.'); } }, { label: 'Cancel' }]
        }),
        sleep: () => setNight(!O.night),
        balloons: () => { puff(); say(hints[bub.hint++ % hints.length]); }
    };
    $$('.mb-drop').forEach((d) => d.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        e.stopPropagation();
        closeMenus();
        if (b.dataset.toggle) toggles[b.dataset.toggle]();
        else if (b.dataset.go) goZone(b.dataset.go);
        else if (b.dataset.act && ACTS[b.dataset.act]) ACTS[b.dataset.act]();
    }));

    /* the address bar: zone names work, and a couple of secret places */
    const ALIASES = {
        surface: ['surface', 'home', 'index', 'top'],
        sunlit: ['sunlit', 'about', 'me', 'about_me', 'hein'],
        twilight: ['twilight', 'projects', 'work', 'cargo', 'cargo_hold', 'portfolio'],
        midnight: ['midnight', 'blog', 'log', 'writing', 'captains_log', 'photos'],
        abyss: ['abyss', 'contact', 'email', 'signal', 'send_a_signal', 'guestbook', 'logbook'],
        hadal: ['hadal', 'bottom', 'footer', 'the_bottom']
    };
    const atlantis = () => {
        O.flash([255, 210, 63], 400);
        sfx('chord');
        dialog({ title: 'ATLANTIS.HTM', icon: 'gold', html: '<p><b>You found the lost city of Atlantis!</b></p><p>Population: 0. Wi-Fi: surprisingly good. There\'s just a sign that says <i>"under construction since 9600 BC"</i>.</p>', buttons: [{ label: 'neat' }] });
    };
    $('#address').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $('#addr');
        const raw = input.value.trim().toLowerCase();
        const v = raw.replace(/^seanet:\/\/heind\.nl\/~hein\/?/, '').replace(/\.html?$/, '');
        const segs = v.split(/[/?#]/).filter(Boolean);
        input.blur();
        sfx('click');
        if (segs.includes('atlantis')) return atlantis();
        if (segs.includes('kraken')) { lastZone = null; hud(); return O.kraken(); }
        if (segs.includes('hypnospace')) { lastZone = null; hud(); return say('wrong ocean, friend.'); }
        const zone = Object.keys(ALIASES).find((z) => segs.some((s) => ALIASES[z].includes(s)));
        if (!segs.length || zone) { goZone(zone || 'surface'); lastZone = null; return; }
        if (/[.:]/.test(v)) {
            dialog({ title: 'SeaNet Navigator', icon: 'err', html: `<p>SeaNet can't reach the dry web from down here.</p><p>Try again at the surface. (Or just open a new tab.)</p>` });
        } else {
            dialog({ title: '404.htm', icon: 'err', html: `<p><b>Error 404:</b> <code>${esc(segs.join('/'))}</code></p><p>This part of the ocean hasn't been mapped yet.</p>` });
        }
        lastZone = null; hud();
    });

    const tickClock = () => { const d = new Date(); $('#clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

    /* webring: prev/next go to a random project */
    $$('[data-ring]').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const p = S.PROJECTS[(Math.random() * S.PROJECTS.length) | 0];
        window.open(mainLink(p), '_blank', 'noopener');
    }));

    $('[data-ping]').addEventListener('click', () => sfx('sonar'));

    /* =====================================================================
       clicking the ocean, hover cursor, sub mode clicks
       ===================================================================== */
    const UI = 'a,button,input,textarea,select,label,.win,.browser,.menubar,.cstrip,.bub,.dlg-back,#floats,.reef-head,.reef-card,.reef-foot,.hero-lite,.skip,.zone-sign,.wordart,.marquee,.hero-tag,.hero-pre,.counter,.bottom p,.webring,.buttons88,.subhud';
    document.addEventListener('click', (e) => {
        if (O.sub) {
            if (e.target.closest('.browser,.menubar,.cstrip,.bub,.dlg-back,.subhud,#floats')) return;
            e.preventDefault();
            O.fire();
            return;
        }
        if (e.target.closest(UI)) return;
        O.hit(e.clientX, e.clientY);
    });
    let hoverQ = false, hx = 0, hy = 0, htarget = null;
    window.addEventListener('pointermove', (e) => {
        hx = e.clientX; hy = e.clientY; htarget = e.target;
        if (hoverQ) return;
        hoverQ = true;
        requestAnimationFrame(() => {
            hoverQ = false;
            const over = !O.sub && htarget && htarget.closest && !htarget.closest(UI) && O.hover(hx, hy);
            document.body.classList.toggle('cur-point', !!over);
        });
    }, { passive: true });

    /* =====================================================================
       keyboard eggs: konami, typed words
       ===================================================================== */
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let kpos = 0, typed = '';
    const sos = () => {
        const U = 110, seq = [1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1];
        let at = 0;
        seq.forEach((s) => {
            if (!s) { at += U * 2; return; }
            setTimeout(() => { O.flash([255, 255, 255], s * U); sfx('beep', (s * U) / 1000); $('#menubar').style.background = '#ffd23f'; }, at);
            setTimeout(() => { $('#menubar').style.background = ''; }, at + s * U);
            at += s * U + U;
        });
        setTimeout(() => say("··· ––– ··· message sent. a passing whale says she'll pass it on."), at + 200);
    };
    const WORDS = {
        kraken: () => { O.kraken(); say("RELEASE THE KRAKEN! (it's mostly harmless.)"); },
        duck: () => { O.duck(); say('a rubber duck has been deployed at the surface. ↑'); },
        sos,
        hein: () => { puff(); say("that's him! the guy who made all this. i'm just the fish."); for (let i = 0; i < 30; i++) O.burst(Math.random() * window.innerWidth, Math.random() * window.innerHeight, 2); },
        turbo: () => setTurbo(!O.turbo),
        bub: () => { puff(); sfx('bloop'); say('you rang?'); },
        atlantis
    };
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && O.sub) { setSub(false); return; }
        if (e.target.closest && e.target.closest('input,textarea')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        kpos = k === KONAMI[kpos] ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
        if (kpos === KONAMI.length) {
            kpos = 0;
            const first = !subUnlocked;
            unlockSub();
            sfx('chord');
            if (first) O.flash([155, 220, 90], 300);
            setSub(!O.sub);
            return;
        }
        if (e.key.length === 1) {
            typed = (typed + k).slice(-12);
            for (const w of Object.keys(WORDS)) if (typed.endsWith(w)) { typed = ''; WORDS[w](); break; }
        }
    });

    /* =====================================================================
       little things: wordart, mood, counter
       ===================================================================== */
    function wordart() {
        let i = 0;
        $$('#wordart .wa-line').forEach((line) => {
            line.innerHTML = [...line.textContent].map((ch) => `<span class="wa-l" style="--i:${i++}" aria-hidden="true">${esc(ch)}</span>`).join('');
        });
    }
    function moods() {
        const el = $('#mood');
        let i = 0;
        setInterval(() => {
            i = (i + 1) % S.MOODS.length;
            const m = S.MOODS[i];
            if (reduced) { el.textContent = m; return; }
            let n = 0;
            el.textContent = '';
            const iv = setInterval(() => { el.textContent = m.slice(0, ++n); if (n >= m.length) clearInterval(iv); }, 45);
        }, 2800);
    }
    function counter() {
        const n = store.get('heind.visits', 0) + 1;
        store.set('heind.visits', n);
        $('#counter').innerHTML = [...String(n).padStart(6, '0')].map((d) => `<b>${d}</b>`).join('');
    }

    /* =====================================================================
       boot
       ===================================================================== */
    let booted = false;
    function boot() {
        const el = $('#boot'), fill = $('#boot-fill'), status = $('#boot-status'), ext = $('#boot-ext');
        const finish = () => {
            if (booted) return;
            booted = true;
            el.classList.add('out');
            setTimeout(() => el.remove(), 400);
            document.removeEventListener('keydown', finish);
            el.removeEventListener('click', finish);
            seenZones.add('surface');
            lastZone = null; hud();
            const z = curZone();
            setTimeout(() => { seenZones.add(z); say(S.BUB_ZONE[z]); }, 700);
        };
        let seen = false;
        try { seen = sessionStorage.getItem('heind.booted'); sessionStorage.setItem('heind.booted', '1'); } catch (e) { /* ignore */ }
        if (reduced || seen || root.classList.contains('lite')) { finish(); return; }
        const STEPS = ['Starting Up…', 'Inflating ballast tanks…', 'Pressurising hull…', 'Untangling anchor chain…', `Counting fish (${S.PROJECTS.length * 3 + 2})…`, 'Loading Hein…'];
        let i = 0;
        const iv = setInterval(() => {
            i++;
            fill.style.width = Math.min(100, (i / EXT_ICONS.length) * 100) + '%';
            status.textContent = STEPS[Math.min(STEPS.length - 1, Math.floor((i / EXT_ICONS.length) * STEPS.length))];
            if (EXT_ICONS[i - 1]) { const ic = document.createElement('i'); ic.style.backgroundImage = `url(${EXT_ICONS[i - 1]})`; ext.append(ic); }
            if (i >= EXT_ICONS.length) { clearInterval(iv); setTimeout(finish, 350); }
        }, 150);
        document.addEventListener('keydown', finish);
        el.addEventListener('click', finish);
    }

    /* =====================================================================
       go
       ===================================================================== */
    makeArt();
    wordart();
    setupWindows();
    renderSkills();
    renderFilters();
    renderCargo();
    renderLog();
    renderGuestbook();
    render88();
    counter();
    moods();
    watchDither();
    sync();
    tickClock(); setInterval(tickClock, 10000);

    O.init();
    {
        const saved = store.get(LITE, null);
        const slow = (navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
        if (saved === true || (saved === null && (reduced || slow))) setLite(true, true);
    }
    loadGuestbook();
    S.util = { $, $$, esc, store, sfx, say, dialog, watchDither, fillDither, puff, resurface, goZone, sync, reduced, hints, bub };
    let rl;
    new ResizeObserver(() => { clearTimeout(rl); rl = setTimeout(() => { O.relayout(); hud(); }, 120); }).observe($('main'));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { O.relayout(); hud(); });
    hud();
    boot();

    console.log('%c ><(((º>  hi there, source diver! ', 'font: 16px monospace; color: #6fdde0; background: #0b1530; padding: 6px;');
    console.log('things to try: the konami code · type "kraken", "duck", "sos" · the address bar knows a lost city · sit still at the bottom.');
})();

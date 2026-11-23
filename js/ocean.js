/* The ocean: one low-res canvas behind the page, drawn in stop-motion and dithered every frame. */
(() => {
    'use strict';
    const S = window.SEA, M = S.models;
    const rgb = S.hexToRgb;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const css = (c, a = 1) => (a >= 1
        ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
        : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
    const TAU = Math.PI * 2;
    const R = Math.random;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sfx = (n) => S.sfx && S.sfx(n);
    const say = (m) => S.say && S.say(m);

    const WATER = [
        [0, '#34c3d2'], [25, '#26a3c4'], [200, '#1b63a6'], [600, '#143f80'], [1000, '#0d2756'],
        [2500, '#08173a'], [4000, '#050d22'], [6000, '#03060f'], [9000, '#010205'], [11000, '#000000']
    ].map(([m, h]) => [m, rgb(h)]);
    const SKY = {
        day: ['#2a68b3', '#5ab4e8', '#dff4ff'].map(rgb),
        night: ['#04070f', '#0b1530', '#22346a'].map(rgb)
    };

    const O = S.ocean = { night: false, turbo: false, sub: false, score: 0 };
    const GB_PAL = S.makePalette(['#0f380f', '#306230', '#8bac0f', '#9bbc0f']);
    const GB = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    let paused = false, game = null;

    let cv, ctx, buf, bx, dk, dx;
    let W = 0, H = 0, SC = 3, camRow = 0, scrollYNow = 0;
    let surfW = 100, floorW = 1000, rayBottomW = 300, anchors = [], zones = [];
    let t = 0;
    let ents = [], bubbles = [], puffs = [], snow = [], bio = [], stars = [], torps = [];
    let ship = null, sphere = null, eye = null, kraken = null, player = null;
    let flashUntil = 0, flashCol = [255, 255, 255];
    const ducks = [];
    const mouse = { cx: 0, cy: 0, wx: -9999, wy: -9999, inside: false, moved: 0 };
    let lastPoke = performance.now();

    /* ---------- depth mapping ---------- */
    const metersAtW = (wy) => {
        if (wy < surfW) return (wy - surfW) * SC * 0.05;
        for (let i = 0; i < anchors.length - 1; i++) {
            const [y0, m0] = anchors[i], [y1, m1] = anchors[i + 1];
            if (wy < y1) return m0 + (m1 - m0) * ((wy - y0) / Math.max(1e-6, y1 - y0));
        }
        return anchors.length ? anchors[anchors.length - 1][1] : 0;
    };
    const worldYForMeters = (m) => {
        for (let i = 0; i < anchors.length - 1; i++) {
            const [y0, m0] = anchors[i], [y1, m1] = anchors[i + 1];
            if (m <= m1) return y0 + (y1 - y0) * ((m - m0) / Math.max(1e-6, m1 - m0));
        }
        return floorW;
    };
    const waterAt = (m) => {
        let c = WATER[WATER.length - 1][1];
        if (m <= 0) c = WATER[0][1];
        else for (let i = 0; i < WATER.length - 1; i++) {
            if (m < WATER[i + 1][0]) {
                const k = (m - WATER[i][0]) / (WATER[i + 1][0] - WATER[i][0]);
                const a = WATER[i][1], b = WATER[i + 1][1];
                c = [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
                break;
            }
        }
        if (O.night) {
            const f = lerp(0.4, 1, clamp(m / 1500, 0, 1));
            c = [c[0] * f, c[1] * f, c[2] * f * 1.05];
        }
        return c;
    };
    const skyAt = (wy) => {
        const s = O.night ? SKY.night : SKY.day;
        const k = clamp(wy / Math.max(1, surfW), 0, 1);
        if (k < 0.65) { const q = k / 0.65; return [lerp(s[0][0], s[1][0], q), lerp(s[0][1], s[1][1], q), lerp(s[0][2], s[1][2], q)]; }
        const q = (k - 0.65) / 0.35;
        return [lerp(s[1][0], s[2][0], q), lerp(s[1][1], s[2][1], q), lerp(s[1][2], s[2][2], q)];
    };
    const darkAt = (m) => {
        if (m < 700) return 0;
        if (m < 4000) return ((m - 700) / 3300) * 0.9;
        return clamp(0.9 + ((m - 4000) / 5000) * 0.08, 0, 0.98);
    };
    const env = (wy) => {
        const m = metersAtW(wy);
        return { m, fog: waterAt(Math.max(0, m)), fa: clamp(m / 900, 0, 0.6), light: m < 0 ? 1 : clamp(1 - m / 2500, 0.5, 1) * (O.night && m < 400 ? 0.6 : 1) };
    };
    const crest = (x) => surfW + Math.sin(x * 0.09 + t * 1.8) * 1.1 + Math.sin(x * 0.033 - t * 1.1) * 1.7;

    const bbWorld = (bb) => ({ x0: bb.x0, x1: bb.x1, y0: bb.y0 + camRow, y1: bb.y1 + camRow });
    const inBB = (bb, x, y, pad = 2) => bb && x >= bb.x0 - pad && x <= bb.x1 + pad && y >= bb.y0 - pad && y <= bb.y1 + pad;
    const onScreen = (wy, pad = 50) => wy - camRow > -pad && wy - camRow < H + pad;

    /* ---------- particles ---------- */
    const burst = (wx, wy, n = 6, spread = 4) => {
        for (let i = 0; i < n && bubbles.length < 420; i++) {
            bubbles.push({ x: wx + (R() - 0.5) * spread, y: wy + (R() - 0.5) * spread, vy: -(10 + R() * 20), r: R() < 0.3 ? 2 : 1, ph: R() * TAU, life: 5 });
        }
    };
    O.burst = (clientX, clientY, n) => burst(clientX / SC, (scrollYNow + clientY) / SC, n, 8);

    const drawBubble = (b) => {
        const x = Math.round(b.x), y = Math.round(b.y - camRow);
        if (y < -3 || y > H + 3) return;
        bx.fillStyle = '#b5f1e8';
        if (b.r === 1) { bx.fillRect(x, y, 1, 1); return; }
        bx.fillRect(x - 1, y - 2, 2, 1); bx.fillRect(x - 1, y + 1, 2, 1);
        bx.fillRect(x - 2, y - 1, 1, 2); bx.fillRect(x + 1, y - 1, 1, 2);
        bx.fillStyle = '#ffffff'; bx.fillRect(x - 1, y - 1, 1, 1);
    };

    const light = (c, x, y, r, a = 1) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.5, `rgba(0,0,0,${a * 0.65})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    };

    /* ---------- creatures and things ---------- */
    const FISH = {
        sardine: ['#b4b4c4', '#dff4ff', '#6b6b80', 3.2],
        orange:  ['#ff9a1f', '#fff1a6', '#e8562a', 3.8],
        tang:    ['#ffd23f', '#fff1a6', '#ff9a1f', 3.4],
        blue:    ['#3b8fd4', '#9fd8f5', '#1f4a8f', 3.6],
        lantern: ['#6b6b80', '#b4b4c4', '#2e2e3e', 3.0]
    };
    const meshCache = {};
    const mesh = (k, make) => meshCache[k] || (meshCache[k] = make());

    function School(y, n, kind, rnd) {
        const size = FISH[kind][3];
        const e = { layer: 'mid', kind, x: rnd() * W, y, dir: rnd() < 0.5 ? -1 : 1, sp: 5 + rnd() * 8, seed: rnd() * 100, fish: [] };
        for (let i = 0; i < n; i++) {
            e.fish.push({ ox: (rnd() - 0.5) * n * 4.4, oy: (rnd() - 0.5) * n * 2.4, ph: rnd() * TAU, s: size * (0.8 + rnd() * 0.4), dx: 0, dy: 0, vx: 0, vy: 0, dead: false, rs: 0, wx: -99, wy: -99 });
        }
        e.tick = (dt) => {
            e.x += e.dir * e.sp * dt;
            if (e.x > W + 60) e.x = -60;
            if (e.x < -60) e.x = W + 60;
            for (const f of e.fish) {
                if (f.dead) { if (t > f.rs) f.dead = false; else continue; }
                const bxp = e.x + f.ox + Math.sin(t * 1.3 + f.ph) * 2;
                const byp = e.y + f.oy + Math.sin(t * 0.6 + e.seed) * 4 + Math.cos(t * 1.1 + f.ph) * 1.2;
                const ddx = bxp + f.dx - mouse.wx, ddy = byp + f.dy - mouse.wy, d = Math.hypot(ddx, ddy);
                if (d < 26 && d > 0.01) { const k = ((26 - d) / 26) * 300 * dt; f.vx += (ddx / d) * k; f.vy += (ddy / d) * k; }
                f.dx += f.vx * dt; f.dy += f.vy * dt;
                f.vx *= 0.86; f.vy *= 0.86;
                f.dx *= 1 - dt * 0.8; f.dy *= 1 - dt * 0.8;
                f.wx = bxp + f.dx; f.wy = byp + f.dy;
            }
        };
        e.draw = () => {
            if (!onScreen(e.y, 60)) return;
            const en = env(e.y);
            const m = mesh('fish-' + kind, () => M.fish(...FISH[kind].slice(0, 3)));
            for (const f of e.fish) {
                if (f.dead) continue;
                const sx = f.wx, sy = f.wy - camRow;
                if (sx < -12 || sx > W + 12 || sy < -12 || sy > H + 12) continue;
                const face = f.vx * e.dir < -6 ? -e.dir : e.dir;
                const ph = f.ph;
                S.drawMesh(bx, m, {
                    x: sx, y: sy, s: f.s,
                    ry: (face > 0 ? 0 : Math.PI) + Math.sin(t * 2 + ph) * 0.45,
                    rz: clamp(-f.vy * 0.02, -0.5, 0.5) * face, rx: 0.25,
                    light: en.light, fog: en.fog, fogAmt: en.fa,
                    deform: (p) => { if (p[0] < 0.5) p[2] += Math.sin(t * 11 + ph - p[0] * 3) * 0.25 * (0.5 - p[0]); }
                });
                f.face = face;
            }
        };
        if (kind === 'lantern') {
            e.glow = () => {
                if (!onScreen(e.y, 40)) return;
                for (const f of e.fish) {
                    if (f.dead || Math.sin(t * 3 + f.ph) < -0.2) continue;
                    bx.fillStyle = '#6fdde0';
                    bx.fillRect(Math.round(f.wx + (f.face || 1) * f.s * 0.3), Math.round(f.wy - camRow + 1), 1, 1);
                    bx.fillRect(Math.round(f.wx - (f.face || 1) * f.s * 0.2), Math.round(f.wy - camRow + 1), 1, 1);
                }
            };
        }
        e.hit = (wx, wy) => e.fish.some((f) => !f.dead && Math.hypot(f.wx - wx, f.wy - wy) < f.s + 4);
        e.click = (wx, wy) => {
            e.fish.forEach((f) => {
                const ddx = f.wx - wx, ddy = f.wy - wy, d = Math.hypot(ddx, ddy) || 1;
                if (d < 40) { f.vx += (ddx / d) * 110; f.vy += (ddy / d) * 110; }
            });
            sfx('bloop');
            burst(wx, wy, 5);
            if (R() < 0.4) say(['blub.', 'the fish would like some personal space.', 'they say hi. well. they say blub.', 'fish fact: these ones are made of about 40 triangles.'][(R() * 4) | 0]);
        };
        return e;
    }

    function Ship() {
        const m = M.ship(false), flag = M.flag();
        const e = { layer: 'surface', x: 0, s: 30, honks: 0, jump: 0, hook: [0, 0], funnel: [0, 0], bb: null };
        e.place = () => { e.x = clamp(W * 0.17, 34, 260); e.s = clamp(W * 0.075, 20, 40); };
        e.opts = () => {
            const j = e.jump > 0 ? Math.sin((1 - e.jump / 0.8) * Math.PI) * 18 : 0;
            return { x: e.x, y: crest(e.x) - camRow - 1 + Math.sin(t * 1.6) * 0.6 - j, s: e.s, ry: -0.55, rx: 0.14, rz: Math.sin(t * 1.2) * 0.06 + (e.jump > 0 ? Math.sin(e.jump * 8) * 0.2 : 0) };
        };
        e.calc = () => {
            const o = e.opts();
            const h = S.project(M.SHIP_HOOK, o), f = S.project([-0.42, 0.78, 0], o);
            e.hook = [h[0], h[1] + camRow];
            e.funnel = [f[0], f[1] + camRow];
        };
        e.tick = (dt) => {
            e.jump = Math.max(0, e.jump - dt);
            if (R() < dt * 2.5) puffs.push({ x: e.funnel[0], y: e.funnel[1], r: 1, life: 1 });
        };
        e.draw = () => {
            const o = e.opts();
            if (o.y < -80 || o.y > H + 80) { e.bb = null; return; }
            const lt = O.night ? 0.55 : 1;
            e.bb = bbWorld(S.drawMesh(bx, m, { ...o, light: lt }));
            S.drawMesh(bx, flag, { ...o, light: lt, deform: (p) => { if (p[0] > 0.62) p[1] += Math.sin(t * 9 + p[0] * 8) * 0.05; } });
            if (O.night) { // little cabin light at night
                const w = S.project([0.34, 0.5, 0], o);
                bx.fillStyle = '#ffd23f'; bx.fillRect(Math.round(w[0]), Math.round(w[1]) - 1, 1, 2);
            }
        };
        e.hit = (x, y) => inBB(e.bb, x, y);
        e.click = () => {
            e.honks++;
            sfx('horn');
            if (e.honks === 1) say("that's the S.S. Heind_. she's not much, but she floats.");
            if (e.honks === 5) { e.jump = 0.8; say('the captain asks you to please stop honking.'); }
            if (e.honks === 10) { e.jump = 0.8; say('ok. you win. HONK.'); e.honks = 0; }
        };
        return e;
    }

    function Sphere() {
        const m = M.sphere();
        const e = { layer: 'front', x: 0, y: 0, r: 8, bb: null, ready: false };
        e.place = () => { e.r = clamp(W * 0.022, 6, 11); };
        e.update = (rdt) => {
            const target = Math.max(surfW + 14 + e.r, camRow + H * 0.52);
            if (!e.ready) { e.y = target; e.ready = true; }
            e.y += (target - e.y) * Math.min(1, rdt * 3.2);
            const depth = Math.max(0, e.y - surfW);
            e.x = ship.hook[0] + Math.sin(t * 0.5) * Math.min(3, depth * 0.01);
        };
        e.draw = () => {
            const sy = e.y - camRow;
            const en = env(e.y);
            const hy = Math.max(-2, ship.hook[1] - camRow);
            bx.strokeStyle = en.m > 1500 ? '#2e2e3e' : '#b4b4c4';
            bx.lineWidth = 1;
            bx.beginPath(); bx.moveTo(Math.round(ship.hook[0]) + 0.5, hy); bx.lineTo(Math.round(e.x) + 0.5, sy - e.r * 1.15); bx.stroke();
            if (sy < -20 || sy > H + 20) { e.bb = null; return; }
            e.bb = bbWorld(S.drawMesh(bx, m, { x: e.x, y: sy, s: e.r, ry: 0.35 + Math.sin(t * 0.4) * 0.15, rx: 0.2, light: Math.max(en.light, 0.75), fog: en.fog, fogAmt: en.fa * 0.4 }));
            bx.fillStyle = '#2e2e3e';
            bx.beginPath(); bx.arc(e.x + e.r * 0.5, sy - e.r * 0.05, e.r * 0.42, 0, TAU); bx.fill();
            bx.fillStyle = '#ffd23f';
            bx.beginPath(); bx.arc(e.x + e.r * 0.5, sy - e.r * 0.05, e.r * 0.3, 0, TAU); bx.fill();
        };
        e.cone = (c, a) => {
            const px = e.x + e.r * 0.6, py = e.y - camRow;
            const L = clamp(W * 0.28, 60, 130);
            const g = c.createLinearGradient(px, py, px + L, py);
            g.addColorStop(0, `rgba(${a},0.9)`); g.addColorStop(1, `rgba(${a},0)`);
            c.fillStyle = g;
            c.beginPath(); c.moveTo(px, py - 1); c.lineTo(px + L, py - L * 0.28); c.lineTo(px + L, py + L * 0.55); c.lineTo(px, py + 2); c.closePath(); c.fill();
        };
        e.dark = (c) => {
            if (env(e.y).m < 600) return;
            e.cone(c, '0,0,0');
            light(c, e.x + e.r * 0.5, e.y - camRow, e.r * 3.5, 0.9);
        };
        e.glow = () => {
            const m2 = env(e.y).m;
            if (m2 < 600) return;
            bx.save(); bx.globalAlpha = 0.12; e.cone(bx, '255,241,166'); bx.restore();
            bx.fillStyle = '#fff1a6';
            bx.beginPath(); bx.arc(e.x + e.r * 0.5, e.y - camRow - e.r * 0.05, e.r * 0.3, 0, TAU); bx.fill();
        };
        e.tick = (dt) => { if (e.y - surfW > 10 && R() < dt * 1.4) burst(e.x, e.y - e.r, 1, 2); };
        e.hit = (x, y) => Math.hypot(x - e.x, y - e.y) < e.r + 3;
        e.click = () => {
            sfx('clank');
            say(["that's you in there! the first bathysphere dove in 1930. this one has a modem.", 'knock knock. (the hull is 4 cm of steel, so nobody can hear you.)', 'your bathysphere. please keep your arms inside the sphere.'][(R() * 3) | 0]);
        };
        return e;
    }

    function Sun() {
        const e = { layer: 'sky', x: 0, y: 0, r: 12 };
        e.place = () => { e.x = W * (W < 400 ? 0.82 : 0.8); e.y = surfW * 0.28; e.r = clamp(W * 0.035, 9, 18); };
        e.draw = () => {
            const sy = e.y - camRow;
            if (sy > H + 40 || sy < -40) return;
            if (!O.night) {
                bx.fillStyle = 'rgba(255,241,166,0.35)';
                bx.beginPath(); bx.arc(e.x, sy, e.r * 1.7, 0, TAU); bx.fill();
                const a0 = Math.floor(t * 3) * 0.09;
                bx.fillStyle = '#ffd23f';
                for (let i = 0; i < 10; i++) {
                    const a = a0 + (i / 10) * TAU;
                    bx.beginPath();
                    bx.moveTo(e.x + Math.cos(a - 0.12) * e.r * 1.15, sy + Math.sin(a - 0.12) * e.r * 1.15);
                    bx.lineTo(e.x + Math.cos(a) * e.r * (i % 2 ? 1.7 : 2.1), sy + Math.sin(a) * e.r * (i % 2 ? 1.7 : 2.1));
                    bx.lineTo(e.x + Math.cos(a + 0.12) * e.r * 1.15, sy + Math.sin(a + 0.12) * e.r * 1.15);
                    bx.fill();
                }
                bx.fillStyle = '#fff1a6';
                bx.beginPath(); bx.arc(e.x, sy, e.r, 0, TAU); bx.fill();
            } else {
                bx.fillStyle = 'rgba(223,244,255,0.15)';
                bx.beginPath(); bx.arc(e.x, sy, e.r * 1.6, 0, TAU); bx.fill();
                bx.fillStyle = '#dff4ff';
                bx.beginPath(); bx.arc(e.x, sy, e.r * 0.8, 0, TAU); bx.fill();
                bx.fillStyle = '#b4b4c4';
                bx.beginPath(); bx.arc(e.x - e.r * 0.25, sy - e.r * 0.2, e.r * 0.18, 0, TAU); bx.fill();
                bx.beginPath(); bx.arc(e.x + e.r * 0.3, sy + e.r * 0.25, e.r * 0.12, 0, TAU); bx.fill();
                bx.beginPath(); bx.arc(e.x + e.r * 0.1, sy - e.r * 0.4, e.r * 0.08, 0, TAU); bx.fill();
            }
        };
        e.hit = (x, y) => Math.hypot(x - e.x, y - e.y) < e.r * 1.6;
        e.click = () => {
            if (S.toggleNight) { S.toggleNight(); return; }
            O.night = !O.night;
            document.documentElement.classList.toggle('night', O.night);
        };
        return e;
    }

    function Clouds(rnd) {
        const cl = [];
        const e = { layer: 'sky' };
        e.place = () => {
            cl.length = 0;
            for (let i = 0; i < 6; i++) {
                const w = 14 + rnd() * 26;
                const blobs = [];
                for (let j = 0; j < 5; j++) blobs.push([(rnd() - 0.5) * w, (rnd() - 0.5) * w * 0.18, w * (0.22 + rnd() * 0.18)]);
                cl.push({ x: rnd() * W, y: surfW * (0.1 + rnd() * 0.45), sp: 1.5 + rnd() * 3, blobs, w });
            }
        };
        e.tick = (dt) => cl.forEach((c) => { c.x += c.sp * dt; if (c.x - c.w > W) c.x = -c.w; });
        e.draw = () => {
            for (const c of cl) {
                const sy = c.y - camRow;
                if (sy < -30 || sy > H + 30) continue;
                const x0 = Math.round(c.x);
                bx.fillStyle = O.night ? '#183268' : '#9fd8f5';
                for (const b of c.blobs) { bx.beginPath(); bx.arc(x0 + b[0], sy + b[1] + 1.5, b[2], 0, TAU); bx.fill(); }
                bx.fillStyle = O.night ? '#2a3f78' : '#ffffff';
                for (const b of c.blobs) { bx.beginPath(); bx.arc(x0 + b[0], sy + b[1], b[2] * 0.92, 0, TAU); bx.fill(); }
            }
        };
        return e;
    }

    function Gulls(rnd) {
        const g = [];
        const e = { layer: 'sky' };
        e.place = () => { g.length = 0; for (let i = 0; i < 4; i++) g.push({ x: rnd() * W, y: surfW * (0.2 + rnd() * 0.5), sp: 8 + rnd() * 10, ph: rnd() * TAU }); };
        e.tick = (dt) => g.forEach((b) => { b.x += b.sp * dt; b.y += Math.sin(t + b.ph) * dt * 2; if (b.x > W + 10) b.x = -10; });
        e.draw = () => {
            if (O.night) return;
            bx.fillStyle = '#ffffff';
            for (const b of g) {
                const x = Math.round(b.x), y = Math.round(b.y - camRow);
                if (y < -5 || y > H + 5) continue;
                const up = Math.sin(t * 7 + b.ph) > 0;
                bx.fillRect(x, y, 1, 1);
                bx.fillRect(x - 1, y - (up ? 1 : 0), 1, 1); bx.fillRect(x + 1, y - (up ? 1 : 0), 1, 1);
                bx.fillRect(x - 2, y - (up ? 2 : -1), 1, 1); bx.fillRect(x + 2, y - (up ? 2 : -1), 1, 1);
                bx.fillStyle = '#6b6b80'; bx.fillRect(x - 3, y - (up ? 2 : -1), 1, 1); bx.fillRect(x + 3, y - (up ? 2 : -1), 1, 1);
                bx.fillStyle = '#ffffff';
            }
        };
        return e;
    }

    function Bottle() {
        const e = { layer: 'surface', x: 0 };
        e.place = () => { e.x = W * 0.66; };
        e.tick = (dt) => { e.x += Math.sin(t * 0.2) * dt * 1.5; };
        e.draw = () => {
            const y = crest(e.x) - camRow + 1;
            if (y < -10 || y > H + 10) return;
            bx.save();
            bx.translate(Math.round(e.x), Math.round(y));
            bx.rotate(Math.sin(t * 1.3) * 0.45 - 0.2);
            bx.fillStyle = '#1e5234'; bx.fillRect(-5, -2, 9, 4);
            bx.fillStyle = '#3f9446'; bx.fillRect(-5, -2, 9, 3);
            bx.fillRect(4, -1, 2, 2);
            bx.fillStyle = '#c98a64'; bx.fillRect(6, -1, 2, 2);
            bx.fillStyle = '#fff1a6'; bx.fillRect(-3, -1, 4, 2);
            bx.fillStyle = '#9bdc5a'; bx.fillRect(-4, -2, 6, 1);
            bx.restore();
        };
        e.hit = (x, y) => Math.hypot(x - e.x, y - crest(e.x)) < 8;
        e.click = () => {
            sfx('pop');
            const n = S.BOTTLE_NOTES[(R() * S.BOTTLE_NOTES.length) | 0];
            S.dialog && S.dialog({ title: 'message_in_a_bottle.txt', icon: 'note', html: `<p class="note-paper">${n}</p>`, buttons: [{ label: 'throw it back' }] });
        };
        return e;
    }

    function Duck(x) {
        const e = { layer: 'surface', x, vx: (R() - 0.5) * 6 };
        e.tick = (dt) => { e.x += e.vx * dt; if (e.x < 5 || e.x > W - 5) e.vx *= -1; };
        e.draw = () => {
            const y = Math.round(crest(e.x) - camRow);
            if (y < -10 || y > H + 10) return;
            const x = Math.round(e.x), f = e.vx >= 0 ? 1 : -1;
            bx.fillStyle = '#ffd23f';
            bx.beginPath(); bx.ellipse(x, y - 1, 4, 2.5, 0, 0, TAU); bx.fill();
            bx.beginPath(); bx.arc(x + f * 3, y - 4, 2, 0, TAU); bx.fill();
            bx.fillRect(x - f * 4 - (f < 0 ? 1 : 0), y - 3, 1, 1);
            bx.fillStyle = '#ff9a1f'; bx.fillRect(x + f * 5 - (f < 0 ? 1 : 0), y - 4, 2, 1);
            bx.fillStyle = '#000000'; bx.fillRect(x + f * 3, y - 5, 1, 1);
        };
        e.hit = (x2, y2) => Math.hypot(x2 - e.x, y2 - (crest(e.x) - 2)) < 7;
        e.click = () => { sfx('quack'); };
        return e;
    }

    function Whale(y, rnd) {
        const m = mesh('whale', M.whale);
        const e = { layer: 'far', x: rnd() * W, y, dir: rnd() < 0.5 ? -1 : 1, sp: 3.5, s: 20, bb: null };
        e.place = () => { e.s = clamp(W * 0.045, 14, 30); };
        e.tick = (dt) => {
            e.x += e.dir * e.sp * dt;
            const mg = e.s * 4;
            if (e.x > W + mg) e.x = -mg;
            if (e.x < -mg) e.x = W + mg;
        };
        e.draw = () => {
            if (!onScreen(e.y, 80)) { e.bb = null; return; }
            const en = env(e.y);
            e.bb = bbWorld(S.drawMesh(bx, m, {
                x: e.x, y: e.y - camRow + Math.sin(t * 0.3) * 3, s: e.s,
                ry: e.dir > 0 ? 0.3 : Math.PI - 0.3, rx: 0.18, rz: Math.sin(t * 0.4) * 0.05,
                light: en.light * 0.85, fog: en.fog, fogAmt: Math.min(0.72, en.fa + 0.32),
                deform: (p) => { if (p[0] < -1.2) p[1] += Math.sin(t * 1.4 - p[0] * 1.1) * 0.14 * (-1.2 - p[0]); }
            }));
        };
        e.hit = (x, y2) => inBB(e.bb, x, y2, 0);
        e.click = () => { sfx('whale'); say("that's a whale. she's a bit shy. (and about 90% polygons.)"); };
        return e;
    }

    function Sub(y) {
        const m = mesh('sub', M.sub), pr = mesh('prop', M.prop);
        const e = { layer: 'mid', x: -40, y, dir: 1, sp: 9, s: 12, bb: null, isSub: true };
        e.place = () => { e.s = clamp(W * 0.032, 9, 17); };
        e.tick = (dt) => {
            e.x += e.dir * e.sp * dt;
            if (e.x > W + e.s * 3) { e.dir = -1; }
            if (e.x < -e.s * 3) { e.dir = 1; }
            if (onScreen(e.y) && R() < dt * 4) burst(e.x - e.dir * e.s * 1.4, e.y + Math.sin(t * 0.9) * 1.5, 1, 2);
        };
        e.draw = () => {
            if (!onScreen(e.y, 40)) { e.bb = null; return; }
            const en = env(e.y);
            const o = { x: e.x, y: e.y - camRow + Math.sin(t * 0.9) * 1.5, s: e.s, ry: e.dir > 0 ? -0.35 : Math.PI + 0.35, rx: 0.15, light: Math.max(en.light, 0.8), fog: en.fog, fogAmt: en.fa * 0.5 };
            e.bb = bbWorld(S.drawMesh(bx, m, o));
            const pp = S.project([-1.38, 0, 0], o);
            const a = t * 14;
            S.drawMesh(bx, pr, { ...o, x: pp[0], y: pp[1], deform: (p) => { const y2 = p[1], z = p[2]; p[1] = y2 * Math.cos(a) - z * Math.sin(a); p[2] = y2 * Math.sin(a) + z * Math.cos(a); } });
        };
        e.dark = (c) => {
            if (!onScreen(e.y) || env(e.y).m < 600) return;
            light(c, e.x + e.dir * e.s * 1.6, e.y - camRow, e.s * 2, 0.8);
        };
        e.hit = (x, y2) => inBB(e.bb, x, y2);
        e.click = () => {
            sfx('sonar');
            S.dialog && S.dialog({
                title: 'Subshootica.exe', icon: 'sub',
                html: "<p>you found my submarine from <b>Subshootica</b>, a GameBoy-style shmup about defeating the evil Takoyaki Clan.</p><p>board the submarine? (opens the game)</p>",
                buttons: [{ label: 'board!', href: S.link('subshootica-dx.html') }, { label: 'stay dry' }]
            });
        };
        return e;
    }

    function Jelly(x, y, col, rnd) {
        const c = rgb(col);
        const e = { layer: 'mid', x, y0: y, y, ph: rnd() * TAU, sz: 3 + rnd() * 3.5, vx: (rnd() - 0.5) * 2, popped: 0 };
        e.tick = (dt) => {
            const p = Math.sin(t * 1.6 + e.ph);
            e.y -= Math.max(0, p) * 7 * dt;
            e.y += 2 * dt;
            e.x += e.vx * dt;
            if (e.y < e.y0 - 70) e.y = e.y0 + 40;
            if (e.y > e.y0 + 60) e.y = e.y0 - 40;
            if (e.x < -10) e.x = W + 10; if (e.x > W + 10) e.x = -10;
            if (e.popped > 0) e.popped -= dt;
        };
        e.glow = () => {
            if (e.popped > 0 || !onScreen(e.y, 30)) return;
            const sy = e.y - camRow;
            const pul = 1 + Math.sin(t * 1.6 + e.ph) * 0.18;
            const w = e.sz * pul, h = e.sz * 0.85 / pul;
            bx.strokeStyle = css(c, 0.55); bx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const tx = e.x - w * 0.6 + (i / 3) * w * 1.2;
                bx.beginPath(); bx.moveTo(tx, sy);
                for (let k = 1; k <= 4; k++) bx.lineTo(tx + Math.sin(t * 2.4 + e.ph + k + i) * 1.4, sy + k * e.sz * 0.75);
                bx.stroke();
            }
            bx.fillStyle = css(c, 0.55);
            bx.beginPath(); bx.ellipse(e.x, sy, w, h, 0, Math.PI, TAU); bx.closePath(); bx.fill();
            bx.fillStyle = css(c, 0.95);
            bx.fillRect(Math.round(e.x - w), Math.round(sy), Math.round(w * 2), 1);
            bx.fillStyle = 'rgba(255,255,255,0.7)';
            bx.fillRect(Math.round(e.x - w * 0.3), Math.round(sy - h * 0.6), 1, 1);
        };
        e.dark = (cx) => { if (e.popped <= 0 && onScreen(e.y)) light(cx, e.x, e.y - camRow, e.sz * 3.2, 0.5); };
        e.hit = (x2, y2) => e.popped <= 0 && Math.hypot(x2 - e.x, y2 - e.y) < e.sz + 3;
        e.click = () => { sfx('zap'); O.flash([255, 79, 216], 90); say(['zap! that one stings.', 'ow. jellyfish don\'t have brains, but this one has opinions.'][(R() * 2) | 0]); };
        e.isJelly = true;
        return e;
    }

    function Angler(x, y, rnd) {
        const m = mesh('angler', M.angler);
        const e = { layer: 'mid', x, y, dir: rnd() < 0.5 ? -1 : 1, sp: 2.5 + rnd() * 2, s: 9, ph: rnd() * TAU, lure: [0, 0], bb: null };
        e.place = () => { e.s = clamp(W * 0.024, 7, 13); };
        e.tick = (dt) => {
            e.x += e.dir * e.sp * dt;
            if (e.x > W + 30) e.x = -30; if (e.x < -30) e.x = W + 30;
        };
        e.draw = () => {
            if (!onScreen(e.y, 40)) { e.bb = null; return; }
            const en = env(e.y);
            const o = { x: e.x, y: e.y - camRow + Math.sin(t * 0.7 + e.ph) * 2, s: e.s, ry: e.dir > 0 ? -0.3 : Math.PI + 0.3, rx: 0.1, light: en.light, fog: en.fog, fogAmt: en.fa * 0.6 };
            e.bb = bbWorld(S.drawMesh(bx, m, o));
            const b = S.project(M.ANGLER_ROD, o);
            const lx = b[0] + e.dir * e.s * 1.0, ly = b[1] - e.s * 0.5 + Math.sin(t * 2 + e.ph) * 1.2;
            e.lure = [lx, ly + camRow];
            bx.strokeStyle = '#7a4b2e'; bx.lineWidth = 1;
            bx.beginPath(); bx.moveTo(b[0], b[1]); bx.quadraticCurveTo(b[0] + e.dir * e.s * 0.4, b[1] - e.s * 0.9, lx, ly); bx.stroke();
        };
        e.dark = (c) => { if (e.bb) light(c, e.lure[0], e.lure[1] - camRow, e.s * 2.2, 0.9); };
        e.glow = () => {
            if (!e.bb) return;
            const x = e.lure[0], y = e.lure[1] - camRow, p = 0.6 + Math.sin(t * 3 + e.ph) * 0.4;
            bx.fillStyle = `rgba(111,221,224,${0.25 * p})`; bx.beginPath(); bx.arc(x, y, 4, 0, TAU); bx.fill();
            bx.fillStyle = '#fff1a6'; bx.beginPath(); bx.arc(x, y, 1.4, 0, TAU); bx.fill();
        };
        e.hit = (x2, y2) => inBB(e.bb, x2, y2) || Math.hypot(x2 - e.lure[0], y2 - e.lure[1]) < 5;
        e.click = () => { sfx('chomp'); say(["don't touch the lure. trust me.", 'anglerfish fact: that light is made by bacteria. gross. cool.'][(R() * 2) | 0]); };
        return e;
    }

    function Dumbo(x, y, rnd) {
        const e = { layer: 'mid', x, y, ph: rnd() * TAU, s: 5 + rnd() * 2, vx: (rnd() - 0.5) * 3 };
        e.tick = (dt) => { e.x += e.vx * dt; e.y += Math.sin(t * 0.8 + e.ph) * 2 * dt; if (e.x < -10) e.x = W + 10; if (e.x > W + 10) e.x = -10; };
        e.draw = () => {
            if (!onScreen(e.y, 20)) return;
            const x = e.x, y = e.y - camRow, s = e.s, f = Math.sin(t * 5 + e.ph) * 0.6;
            bx.fillStyle = '#e8562a';
            bx.save(); bx.translate(x - s * 0.8, y - s * 0.4); bx.rotate(-0.4 + f); bx.beginPath(); bx.ellipse(-s * 0.4, 0, s * 0.5, s * 0.3, 0, 0, TAU); bx.fill(); bx.restore();
            bx.save(); bx.translate(x + s * 0.8, y - s * 0.4); bx.rotate(0.4 - f); bx.beginPath(); bx.ellipse(s * 0.4, 0, s * 0.5, s * 0.3, 0, 0, TAU); bx.fill(); bx.restore();
            bx.fillStyle = '#f2c6a0';
            bx.beginPath(); bx.ellipse(x, y - s * 0.3, s * 0.85, s, 0, Math.PI, TAU); bx.lineTo(x + s * 0.85, y + s * 0.4); bx.lineTo(x - s * 0.85, y + s * 0.4); bx.fill();
            for (let i = 0; i < 4; i++) bx.fillRect(Math.round(x - s * 0.8 + i * s * 0.5), Math.round(y + s * 0.4), 1, Math.round(s * 0.5 + Math.sin(t * 3 + i) * 1));
            bx.fillStyle = '#000000';
            bx.fillRect(Math.round(x - s * 0.35), Math.round(y - s * 0.3), 1, 1);
            bx.fillRect(Math.round(x + s * 0.3), Math.round(y - s * 0.3), 1, 1);
        };
        e.hit = (x2, y2) => Math.hypot(x2 - e.x, y2 - e.y) < e.s + 3;
        e.click = () => { sfx('bloop'); say("that's a dumbo octopus. they're real. look it up."); };
        return e;
    }

    function Snailfish(y, rnd) {
        const m = mesh('snail', M.snailfish);
        const e = { layer: 'mid', x: rnd() * W, y, dir: rnd() < 0.5 ? -1 : 1, s: 7, ph: rnd() * TAU, bb: null };
        e.tick = (dt) => { e.x += e.dir * 3 * dt; if (e.x > W + 20) e.x = -20; if (e.x < -20) e.x = W + 20; };
        e.draw = () => {
            if (!onScreen(e.y, 30)) { e.bb = null; return; }
            const ph = e.ph;
            e.bb = bbWorld(S.drawMesh(bx, m, {
                x: e.x, y: e.y - camRow + Math.sin(t * 0.6 + ph) * 2, s: e.s, ry: e.dir > 0 ? -0.2 : Math.PI + 0.2, rx: 0.3, light: 0.9, amb: 0.5,
                deform: (p) => { if (p[0] < 0.2) p[2] += Math.sin(t * 5 + ph - p[0] * 3) * 0.2 * (0.2 - p[0]); }
            }));
        };
        e.hit = (x2, y2) => inBB(e.bb, x2, y2);
        e.click = () => { sfx('bloop'); say('a snailfish! the deepest fish ever filmed lives around 8,300 m. squishy, translucent, unbothered.'); };
        return e;
    }

    function Floor(rnd) {
        const wreck = M.ship(true);
        const pts = [];
        const e = { layer: 'mid', wx: 0, s: 30, bb: null, worms: [] };
        e.place = () => {
            pts.length = 0;
            for (let x = -4; x <= W + 8; x += 4) pts.push([x, floorW - (Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13 + 1) * 2 + rnd() * 2)]);
            e.wx = W * 0.3; e.s = clamp(W * 0.09, 26, 56);
            e.worms = Array.from({ length: 7 }, (_, i) => ({ x: W * 0.6 + i * 3 + rnd() * 2, h: 5 + rnd() * 7, ph: rnd() * TAU }));
        };
        e.draw = () => {
            if (floorW - camRow > H + 80) { e.bb = null; return; }
            const fy = floorW - camRow;
            e.bb = bbWorld(S.drawMesh(bx, wreck, { x: e.wx, y: fy + e.s * 0.12, s: e.s, ry: 0.9, rz: -0.32, rx: 0.15, light: 0.75, amb: 0.45 }));
            for (const w of e.worms) {
                const top = fy - w.h;
                bx.fillStyle = '#b4b4c4'; bx.fillRect(Math.round(w.x), Math.round(top), 1, Math.round(w.h) + 2);
                bx.fillStyle = '#b52a2a'; bx.fillRect(Math.round(w.x + Math.sin(t * 2 + w.ph) * 0.8) - 1, Math.round(top) - 2, 3, 2);
            }
            bx.fillStyle = '#2e2e3e';
            bx.beginPath(); bx.moveTo(-4, H + 10);
            for (const p of pts) bx.lineTo(p[0], p[1] - camRow);
            bx.lineTo(W + 8, H + 10); bx.closePath(); bx.fill();
            bx.fillStyle = '#6b6b80';
            for (const p of pts) bx.fillRect(p[0], Math.round(p[1] - camRow), 4, 1);
            bx.fillStyle = '#3d2a1e';
            for (let i = 0; i < 10; i++) { const x = ((i * 53.7) % 1) * W + (i * 37) % W; bx.fillRect(Math.round(x % W), Math.round(fy + 4 + (i % 3) * 3), 3 + (i % 3), 2); }
        };
        e.dark = (c) => {
            const fy = floorW - camRow;
            if (fy > H + 60) return;
            const vx = W * 0.6 - 6, fl = 0.85 + Math.sin(t * 3) * 0.1;
            light(c, vx, fy - 8, clamp(W * 0.12, 34, 70), fl);
            light(c, e.wx, fy - e.s * 0.3, e.s * 1.1, 0.35);
        };
        e.glow = () => {
            const fy = floorW - camRow;
            if (fy > H + 60) return;
            for (let i = 0; i < pts.length; i += 1) if ((i * 7) % 5 === 0) { bx.fillStyle = '#11214a'; bx.fillRect(pts[i][0], Math.round(pts[i][1] - camRow), 4, 1); }
            const vx = Math.round(W * 0.6 - 6);
            bx.fillStyle = '#3d2a1e'; bx.fillRect(vx - 3, Math.round(fy - 9), 6, 10); bx.fillRect(vx - 2, Math.round(fy - 12), 4, 3);
            bx.fillStyle = '#ff9a1f'; bx.fillRect(vx - 1, Math.round(fy - 13), 2, 1);
            for (let k = 0; k < 7; k++) {
                const a = (t * 0.7 + k / 7) % 1;
                bx.fillStyle = a < 0.3 ? '#ffd23f' : a < 0.6 ? '#e8562a' : 'rgba(107,107,128,0.6)';
                bx.fillRect(Math.round(vx + Math.sin(t * 3 + k * 2) * (1 + a * 4)), Math.round(fy - 14 - a * 30), a < 0.5 ? 1 : 2, a < 0.5 ? 1 : 2);
            }
        };
        e.hit = (x, y) => inBB(e.bb, x, y, 0);
        e.click = () => { sfx('clank'); say('the S.S. Placeholder. sank in 1998 after hitting an iceberg made entirely of <table> tags.'); };
        return e;
    }

    function Eye() {
        const e = { layer: 'mid', x: 0, y: 0, rx: 20, ry: 9, open: 0, announced: false };
        e.place = () => { e.rx = clamp(W * 0.06, 14, 34); e.ry = e.rx * 0.45; e.x = W * (W < 420 ? 0.7 : 0.76); e.y = floorW - e.rx * 1.3 - 6; };
        e.tick = (dt) => {
            const idle = (performance.now() - lastPoke) / 1000;
            if (onScreen(e.y, -10) && idle > 8) {
                e.open = Math.min(1, e.open + dt * 0.35);
                if (e.open >= 1 && !e.announced) { e.announced = true; sfx('rumble'); say('...don\'t. move.'); }
            } else {
                if (e.open > 0.6 && e.announced) { say('phew. it went back to sleep.'); }
                e.open = Math.max(0, e.open - dt * 2.2);
                if (e.open < 0.1) e.announced = false;
            }
        };
        e.glow = () => {
            if (e.open < 0.02 || !onScreen(e.y)) return;
            const cx = e.x, cy = e.y - camRow, rx = e.rx, ry = e.ry * e.open;
            bx.fillStyle = `rgba(255,154,31,${0.12 * e.open})`;
            bx.beginPath(); bx.ellipse(cx, cy, rx * 1.6, rx * 0.9, 0, 0, TAU); bx.fill();
            bx.save();
            bx.beginPath();
            bx.moveTo(cx - rx, cy); bx.quadraticCurveTo(cx, cy - ry * 2, cx + rx, cy); bx.quadraticCurveTo(cx, cy + ry * 2, cx - rx, cy); bx.closePath();
            bx.fillStyle = '#d9bd84'; bx.fill();
            bx.clip();
            let lx = 0, ly = 0;
            if (mouse.inside) {
                const ddx = mouse.wx - cx, ddy = (mouse.wy - camRow) - cy, d = Math.hypot(ddx, ddy) || 1;
                lx = (ddx / d) * rx * 0.35; ly = (ddy / d) * e.ry * 0.3;
            }
            const ir = e.ry * 0.95;
            bx.fillStyle = '#e8562a'; bx.beginPath(); bx.arc(cx + lx, cy + ly, ir, 0, TAU); bx.fill();
            bx.fillStyle = '#ff9a1f'; bx.beginPath(); bx.arc(cx + lx, cy + ly, ir * 0.75, 0, TAU); bx.fill();
            bx.fillStyle = '#000000'; bx.beginPath(); bx.ellipse(cx + lx, cy + ly, ir * 0.22, ir * 0.85, 0, 0, TAU); bx.fill();
            bx.fillStyle = '#ffffff'; bx.fillRect(Math.round(cx + lx - ir * 0.4), Math.round(cy + ly - ir * 0.45), 1, 1);
            bx.restore();
            bx.strokeStyle = '#3d2a1e'; bx.lineWidth = 1;
            bx.beginPath(); bx.moveTo(cx - rx, cy); bx.quadraticCurveTo(cx, cy - ry * 2, cx + rx, cy); bx.quadraticCurveTo(cx, cy + ry * 2, cx - rx, cy); bx.stroke();
        };
        e.hit = (x, y) => e.open > 0.3 && Math.abs(x - e.x) < e.rx && Math.abs(y - e.y) < e.ry * 1.5;
        e.click = () => { sfx('rumble'); e.open = 0; lastPoke = performance.now(); say('it saw you. it definitely saw you.'); };
        return e;
    }

    /* ---------- layout & population ---------- */
    const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

    function layout() {
        const docH = document.documentElement.scrollHeight;
        const hero = document.getElementById('surface');
        surfW = (pageTop(hero) + hero.offsetHeight * 0.78) / SC;
        zones = [...document.querySelectorAll('.zone')].map((el) => {
            const top = pageTop(el);
            return { id: el.id, top, bottom: top + el.offsetHeight, from: +el.dataset.from, to: +el.dataset.to, el };
        });
        anchors = [[surfW, 0]];
        zones.forEach((z) => { if (z.id !== 'surface' && z.top / SC > anchors[anchors.length - 1][0]) anchors.push([z.top / SC, z.from]); });
        floorW = (docH - 120) / SC;
        anchors.push([floorW, 10935]);
        rayBottomW = worldYForMeters(240);
        O.zones = zones;
    }

    function populate() {
        const rnd = S.rng(20260);
        ents = [];
        const Z = (id) => { const z = zones.find((q) => q.id === id); return z ? { top: z.top / SC, bot: z.bottom / SC, h: (z.bottom - z.top) / SC } : null; };
        const add = (e) => { e.place && e.place(); ents.push(e); return e; };
        add(Sun()); add(Clouds(rnd)); add(Gulls(rnd));
        ship = add(Ship());
        add(Bottle());
        ducks.forEach((d) => ents.push(d));

        add(School(surfW + 22, 5, 'tang', rnd));
        const sl = Z('sunlit'), tw = Z('twilight'), mn = Z('midnight'), ab = Z('abyss'), hd = Z('hadal');
        if (sl) {
            ['orange', 'sardine', 'blue', 'orange', 'tang'].forEach((k, i) => add(School(sl.top + sl.h * (0.08 + i * 0.2), 5 + ((rnd() * 5) | 0), k, rnd)));
            add(Whale(sl.top + sl.h * 0.92, rnd));
        }
        if (tw) {
            add(Sub(tw.top + tw.h * 0.07));
            for (let i = 0; i < 5; i++) add(School(tw.top + tw.h * (0.18 + i * 0.17), 6 + ((rnd() * 4) | 0), i % 2 ? 'lantern' : 'sardine', rnd));
            add(Whale(tw.top + tw.h * 0.5, rnd));
            for (let i = 0; i < 5; i++) add(Jelly(rnd() * W, tw.top + tw.h * (0.55 + rnd() * 0.45), ['#ff4fd8', '#6fdde0', '#8a3cff'][i % 3], rnd));
        }
        if (mn) {
            for (let i = 0; i < 3; i++) add(Angler(rnd() * W, mn.top + mn.h * (0.2 + i * 0.3), rnd));
            for (let i = 0; i < 7; i++) add(Jelly(rnd() * W, mn.top + mn.h * rnd(), ['#6fdde0', '#ff4fd8', '#9bdc5a', '#8a3cff'][i % 4], rnd));
            add(School(mn.top + mn.h * 0.5, 7, 'lantern', rnd));
        }
        if (ab) {
            for (let i = 0; i < 2; i++) add(Dumbo(rnd() * W, ab.top + ab.h * (0.25 + i * 0.4), rnd));
            add(Angler(rnd() * W, ab.top + ab.h * 0.6, rnd));
            for (let i = 0; i < 3; i++) add(Jelly(rnd() * W, ab.top + ab.h * rnd(), ['#6fdde0', '#ff4fd8'][i % 2], rnd));
        }
        if (hd) {
            add(Snailfish(hd.top + hd.h * 0.2, rnd));
            add(Snailfish(hd.top + hd.h * 0.4, rnd));
        }
        add(Floor(rnd));
        eye = add(Eye());
        sphere = add(Sphere());

        stars = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * surfW * 0.85, ph: rnd() * TAU }));
        snow = Array.from({ length: 110 }, () => ({ x: rnd() * W, y: rnd() * H, v: 1.5 + rnd() * 4, d: 0.75 + rnd() * 0.2 }));
        const bioTop = tw ? tw.top + tw.h * 0.5 : surfW + 400;
        bio = Array.from({ length: 140 }, () => ({ x: rnd() * W, y: bioTop + rnd() * (floorW - bioTop), ph: rnd() * TAU, c: ['#6fdde0', '#ff4fd8', '#9bdc5a', '#5ab4e8'][(rnd() * 4) | 0] }));
    }

    function resize() {
        const vw = window.innerWidth, vh = window.innerHeight;
        SC = vw < 560 ? 2 : vw < 1200 ? 3 : 4;
        W = Math.ceil(vw / SC); H = Math.ceil(vh / SC) + 2;
        for (const c of [cv, buf, dk]) { c.width = W; c.height = H; }
        cv.style.width = W * SC + 'px';
        cv.style.height = H * SC + 'px';
        bx.imageSmoothingEnabled = false;
        layout();
        populate();
        O.dirty = true;
    }
    O.relayout = () => { if (!cv) return; layout(); populate(); O.dirty = true; };

    /* ---------- public helpers ---------- */
    O.metersAt = (pageY) => metersAtW(pageY / SC);
    O.zoneAt = (pageY) => { let id = 'surface'; for (const z of zones) if (pageY >= z.top) id = z.id; return id; };
    O.poke = () => { lastPoke = performance.now(); };
    O.flash = (col, ms) => { flashCol = col; flashUntil = performance.now() + ms; };
    O.duck = () => { const d = Duck(W * (0.2 + R() * 0.6)); ducks.push(d); ents.push(d); sfx('quack'); };
    O.kraken = () => {
        if (kraken) return;
        kraken = { t0: t, arms: [0.06, 0.24, 0.48, 0.7, 0.93].map((x, i) => ({ x, ph: i * 1.7, len: 0.55 + (i % 2) * 0.22 })) };
        sfx('rumble');
        if (!reduced) { document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 1700); }
    };
    O.subMode = (on) => {
        O.sub = on;
        player = on ? { x: W / 2, y: H / 2, dir: 1 } : null;
        torps.length = 0;
        game = on ? { lives: 3, inv: 2, enemies: [], ink: [], spawn: 1.2, boss: false, bossDone: false, over: false } : null;
        if (on) O.score = 0;
        O.dirty = true;
    };
    O.pause = (p) => { paused = p; if (cv) cv.style.display = p ? 'none' : ''; O.dirty = true; };
    O.fire = () => {
        if (!player || (game && game.over)) return;
        torps.push({ x: player.x + player.dir * 8, y: player.y + camRow, vx: player.dir * 110, life: 2 });
        sfx('pew');
    };
    const hitList = () => [...ents].reverse();
    O.hit = (clientX, clientY) => {
        const wx = clientX / SC, wy = (window.scrollY + clientY) / SC;
        for (const e of hitList()) if (e.hit && e.hit(wx, wy)) { e.click(wx, wy); O.dirty = true; return true; }
        return false;
    };
    O.hover = (clientX, clientY) => {
        const wx = clientX / SC, wy = (window.scrollY + clientY) / SC;
        return hitList().some((e) => e.hit && e.hit(wx, wy));
    };

    /* ---------- Subshootica teaser: the Takoyaki Clan invades ---------- */
    const SIZE = { squid: 5, ball: 4, tako: 7, king: 15 };
    const PTS = { squid: 50, ball: 30, tako: 150, king: 1000 };
    function hurt() {
        if (!game || game.over || game.inv > 0) return;
        game.lives--;
        game.inv = 2;
        burst(player.x, player.y + camRow, 14, 8);
        sfx('boom');
        O.flash([15, 56, 15], 140);
        S.onScore && S.onScore(O.score, game.lives);
        if (game.lives <= 0) {
            game.over = true;
            const sc = O.score;
            setTimeout(() => S.onGameOver && S.onGameOver(sc), 700);
        }
    }
    function gameTick(dt) {
        if (!game || !player || game.over) return;
        game.inv = Math.max(0, game.inv - dt);
        const lvl = 1 + Math.floor(O.score / 400);
        game.spawn -= dt;
        if (game.spawn <= 0 && !game.boss) {
            game.spawn = Math.max(0.45, 2.1 - lvl * 0.2) * (0.6 + R() * 0.8);
            const r = R(), sy = 14 + R() * (H - 28);
            const type = r < 0.12 * Math.min(lvl, 4) ? 'tako' : r < 0.6 ? 'squid' : 'ball';
            const sp = (type === 'ball' ? 24 : type === 'tako' ? 12 : 18) * (1 + lvl * 0.08);
            game.enemies.push({ type, x: W + 12, y: camRow + sy, vx: -sp, vy: type === 'ball' ? (R() < 0.5 ? -1 : 1) * 18 : 0, hp: type === 'tako' ? 3 : 1, ph: R() * TAU, shoot: 1 + R() * 2, hit: 0 });
        }
        if (!game.bossDone && !game.boss && O.score >= 1500) {
            game.boss = true;
            game.enemies.push({ type: 'king', x: W + 30, y: camRow + H / 2, vx: -14, vy: 0, hp: 30, ph: 0, shoot: 1.5, hit: 0 });
            S.onBoss && S.onBoss();
            sfx('rumble');
        }
        const py = player.y + camRow;
        for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            e.hit = Math.max(0, e.hit - dt);
            if (e.type === 'king') {
                if (e.x > W - 30) e.x += e.vx * dt;
                e.y = camRow + H / 2 + Math.sin(t * 0.9) * H * 0.3;
            } else {
                e.x += e.vx * dt;
                if (e.type === 'squid') e.y += Math.sin(t * 3 + e.ph) * 16 * dt;
                if (e.type === 'tako') e.y += Math.sin(t * 1.5 + e.ph) * 9 * dt;
                if (e.type === 'ball') { e.y += e.vy * dt; const sy = e.y - camRow; if (sy < 8 || sy > H - 8) e.vy = -e.vy; }
            }
            if (e.type !== 'ball') {
                e.shoot -= dt;
                if (e.shoot <= 0 && e.x < W - 4) {
                    e.shoot = e.type === 'king' ? 0.8 : 2.2 + R() * 2;
                    const ddx = player.x - e.x, ddy = py - e.y, d = Math.hypot(ddx, ddy) || 1, v = e.type === 'king' ? 38 : 32;
                    const spread = e.type === 'king' ? [-0.3, 0, 0.3] : [0];
                    for (const a of spread) {
                        const ang = Math.atan2(ddy, ddx) + a;
                        game.ink.push({ x: e.x, y: e.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 5 });
                    }
                }
            }
            if (e.x < -24 || Math.abs(e.y - (camRow + H / 2)) > H * 1.6) { game.enemies.splice(i, 1); continue; }
            if (Math.hypot(e.x - player.x, e.y - py) < SIZE[e.type] + 3) hurt();
        }
        for (let i = game.ink.length - 1; i >= 0; i--) {
            const k = game.ink[i];
            k.x += k.vx * dt; k.y += k.vy * dt; k.life -= dt;
            if (Math.hypot(k.x - player.x, k.y - py) < 4) { hurt(); game.ink.splice(i, 1); continue; }
            if (k.life <= 0 || k.x < -6 || k.x > W + 6) game.ink.splice(i, 1);
        }
    }
    function torpHitsEnemy(p) {
        if (!game) return false;
        for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            if (Math.hypot(e.x - p.x, e.y - p.y) > SIZE[e.type] + 2) continue;
            e.hp--; e.hit = 0.15;
            if (e.hp <= 0) {
                game.enemies.splice(i, 1);
                O.score += PTS[e.type];
                burst(e.x, e.y, e.type === 'king' ? 40 : 12, e.type === 'king' ? 24 : 8);
                if (e.type === 'king') { game.boss = false; game.bossDone = true; S.say && S.say('the Squid King has been defeated! +1000. hein would be proud.'); }
            }
            return true;
        }
        return false;
    }
    function drawGame() {
        if (!game) return;
        const px = (x, y, w, h, c) => { bx.fillStyle = c; bx.fillRect(Math.round(x), Math.round(y), w, h); };
        for (const e of game.enemies) {
            const x = e.x, y = e.y - camRow, flash = e.hit > 0;
            const dark = flash ? GB[3] : GB[0], mid = flash ? GB[3] : GB[1];
            if (e.type === 'squid' || e.type === 'king') {
                const k = e.type === 'king' ? 3 : 1;
                bx.fillStyle = dark;
                bx.beginPath(); bx.moveTo(x - 5 * k, y); bx.lineTo(x + 2 * k, y - 3 * k); bx.lineTo(x + 2 * k, y + 3 * k); bx.closePath(); bx.fill();
                for (let i = 0; i < 4; i++) {
                    const ty = y - 2 * k + i * (4 * k / 3);
                    bx.strokeStyle = mid; bx.lineWidth = k;
                    bx.beginPath(); bx.moveTo(x + 2 * k, ty); bx.lineTo(x + 5 * k, ty + Math.sin(t * 8 + i) * k); bx.lineTo(x + 8 * k, ty + Math.sin(t * 8 + i + 1) * 1.5 * k); bx.stroke();
                }
                px(x - 1 * k, y - 1 * k, k, k, GB[3]);
                if (e.type === 'king') {
                    bx.fillStyle = GB[2];
                    for (let i = 0; i < 3; i++) { bx.beginPath(); bx.moveTo(x - 6 + i * 5, y - 9); bx.lineTo(x - 4 + i * 5, y - 15); bx.lineTo(x - 2 + i * 5, y - 9); bx.fill(); }
                    px(x - 5, y + 1, 3, 1, GB[3]);
                }
            } else if (e.type === 'ball') {
                bx.fillStyle = dark; bx.beginPath(); bx.arc(x, y, 4, 0, TAU); bx.fill();
                bx.fillStyle = mid; bx.beginPath(); bx.arc(x, y, 3, 0, TAU); bx.fill();
                px(x - 2, y - 2, 3, 1, GB[3]); px(x, y - 1, 2, 1, GB[3]);
                px(x - 2, y, 1, 1, GB[0]); px(x + 1, y, 1, 1, GB[0]);
            } else {
                bx.fillStyle = dark; bx.beginPath(); bx.arc(x, y - 2, 5, Math.PI, TAU); bx.lineTo(x + 5, y + 1); bx.lineTo(x - 5, y + 1); bx.fill();
                for (let i = 0; i < 4; i++) { const tx = x - 4 + i * 2.7; bx.strokeStyle = mid; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(tx, y + 1); bx.lineTo(tx + Math.sin(t * 6 + i) * 1.5, y + 6); bx.stroke(); }
                px(x - 3, y - 3, 2, 1, GB[3]); px(x + 1, y - 3, 2, 1, GB[3]);
                px(x - 2, y - 5, 1, 1, GB[2]); px(x + 2, y - 6, 1, 1, GB[2]);
            }
        }
        for (const k of game.ink) { px(k.x - 1, k.y - camRow - 1, 3, 3, GB[1]); px(k.x, k.y - camRow, 1, 1, GB[0]); }
    }

    /* ---------- simulation ---------- */
    function tick(dt) {
        t += dt;
        for (const e of ents) e.tick && e.tick(dt);
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            b.y += b.vy * dt; b.x += Math.sin(t * 4 + b.ph) * 5 * dt; b.life -= dt;
            if (b.y < surfW + 1 || b.life <= 0) bubbles.splice(i, 1);
        }
        for (let i = puffs.length - 1; i >= 0; i--) {
            const p = puffs[i];
            p.y -= 7 * dt; p.x -= 4 * dt; p.r += 2.2 * dt; p.life -= dt * 0.45;
            if (p.life <= 0) puffs.splice(i, 1);
        }
        if (mouse.inside && performance.now() - mouse.moved < 160 && metersAtW(mouse.wy) > 3 && R() < 0.55) burst(mouse.wx, mouse.wy, 1, 2);
        gameTick(dt);
        for (let i = torps.length - 1; i >= 0; i--) {
            const p = torps[i];
            p.x += p.vx * dt; p.life -= dt;
            if (R() < 0.7) burst(p.x - Math.sign(p.vx) * 3, p.y, 1, 1);
            let hit = torpHitsEnemy(p);
            if (!hit) for (const e of ents) {
                if (e.fish) {
                    for (const f of e.fish) if (!f.dead && Math.hypot(f.wx - p.x, f.wy - p.y) < f.s + 2) { f.dead = true; f.rs = t + 12; hit = true; O.score += 10; burst(f.wx, f.wy, 10, 6); break; }
                } else if (e.isJelly && e.popped <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.sz + 2) { e.popped = 15; hit = true; O.score += 25; burst(e.x, e.y, 12, 8); }
                if (hit) break;
            }
            if (hit) { sfx('boom'); S.onScore && S.onScore(O.score, game ? game.lives : null); }
            if (hit || p.life <= 0) torps.splice(i, 1);
        }
    }

    /* ---------- rendering ---------- */
    function drawRays() {
        const sR = surfW - camRow, bot = rayBottomW - camRow;
        if (bot < 0 || sR > H) return;
        const it = O.night ? 0.3 : 1;
        for (let i = 0; i < 7; i++) {
            const x0 = ((i + 0.5) / 7) * W + Math.sin(t * 0.35 + i * 1.3) * 10;
            const w0 = 2 + (i % 3) * 3, x1 = x0 + 26 + i * 3, w1 = w0 * 3;
            const g = bx.createLinearGradient(0, sR, 0, bot);
            const a = 0.16 * it * (0.7 + 0.3 * Math.sin(Math.floor(t * 4) * 0.4 + i));
            g.addColorStop(0, `rgba(223,244,255,${a})`); g.addColorStop(1, 'rgba(223,244,255,0)');
            bx.fillStyle = g;
            bx.beginPath(); bx.moveTo(x0 - w0, sR); bx.lineTo(x0 + w0, sR); bx.lineTo(x1 + w1, bot); bx.lineTo(x1 - w1, bot); bx.closePath(); bx.fill();
        }
    }

    function drawKraken() {
        if (!kraken) return;
        const age = t - kraken.t0;
        if (age > 8) { kraken = null; return; }
        const p = age < 1.6 ? age / 1.6 : age < 6.4 ? 1 : 1 - (age - 6.4) / 1.6;
        const w0 = clamp(W * 0.035, 6, 18);
        bx.lineCap = 'round';
        for (const arm of kraken.arms) {
            let x = W * arm.x, y = H + 6;
            const n = 18, seg = (H * arm.len * p) / n;
            const pts = [[x, y]];
            for (let i = 0; i < n; i++) {
                const a = -Math.PI / 2 + Math.sin(t * 2 + arm.ph + i * 0.35) * 0.5 * (i / n) + (arm.x < 0.5 ? 1 : -1) * 0.025 * i;
                x += Math.cos(a) * seg; y += Math.sin(a) * seg;
                pts.push([x, y]);
            }
            for (let i = 0; i < n; i++) {
                const k = 1 - i / n;
                bx.strokeStyle = '#6e1a2c'; bx.lineWidth = w0 * k + 1;
                bx.beginPath(); bx.moveTo(pts[i][0], pts[i][1]); bx.lineTo(pts[i + 1][0], pts[i + 1][1]); bx.stroke();
                bx.strokeStyle = '#b52a2a'; bx.lineWidth = Math.max(1, w0 * k * 0.4);
                bx.beginPath(); bx.moveTo(pts[i][0] - w0 * k * 0.2, pts[i][1]); bx.lineTo(pts[i + 1][0] - w0 * k * 0.2, pts[i + 1][1]); bx.stroke();
                if (i % 2 === 0 && w0 * k > 3) { bx.fillStyle = '#f2c6a0'; bx.fillRect(Math.round(pts[i][0] + w0 * k * 0.3), Math.round(pts[i][1]), 2, 2); }
            }
        }
    }

    function render(scrollY, rdt) {
        scrollYNow = scrollY;
        camRow = Math.floor(scrollY / SC);
        cv.style.transform = `translate3d(0,${-(scrollY - camRow * SC)}px,0)`;
        if (mouse.inside) { mouse.wx = mouse.cx / SC; mouse.wy = (scrollY + mouse.cy) / SC; } else { mouse.wx = mouse.wy = -9999; }
        ship.calc();
        sphere.update(rdt);

        // 1. sky and water, one row at a time
        for (let r = 0; r < H; r++) {
            const wy = camRow + r;
            bx.fillStyle = css(wy < surfW ? skyAt(wy) : waterAt(metersAtW(wy)));
            bx.fillRect(0, r, W, 1);
        }
        const sR = surfW - camRow;
        const surfVis = sR > -30 && sR < H + 30;

        // 2. sky things
        if (sR > -10) {
            if (O.night) for (const s of stars) {
                const y = s.y - camRow;
                if (y < 0 || y > H || Math.sin(t * 2 + s.ph) < -0.6) continue;
                bx.fillStyle = Math.sin(t + s.ph) > 0.5 ? '#ffffff' : '#9fd8f5';
                bx.fillRect(Math.round(s.x), Math.round(y), 1, 1);
            }
            for (const e of ents) if (e.layer === 'sky' && e.draw) e.draw();
        }

        // 3. fill around the wave crest
        if (surfVis) {
            bx.fillStyle = css(skyAt(surfW - 1)); bx.fillRect(0, sR - 4, W, 8);
            bx.fillStyle = css(waterAt(0));
            bx.beginPath(); bx.moveTo(0, sR + 6);
            for (let x = 0; x <= W + 2; x += 2) bx.lineTo(x, crest(x) - camRow);
            bx.lineTo(W + 2, sR + 6); bx.closePath(); bx.fill();
        }

        // 4-6. far things, light rays, the middle layer
        for (const e of ents) if (e.layer === 'far' && e.draw) e.draw();
        drawRays();
        for (const e of ents) if (e.layer === 'mid' && e.draw) e.draw();

        // 7-9. surface things, the water over them, smoke
        if (surfVis || sR > 0) {
            for (const e of ents) if (e.layer === 'surface' && e.draw) e.draw();
        }
        if (surfVis) {
            const wc = waterAt(0);
            const g = bx.createLinearGradient(0, sR - 3, 0, sR + 20);
            g.addColorStop(0, css(wc, 0.6)); g.addColorStop(1, css(wc, 0.1));
            bx.fillStyle = g;
            bx.beginPath(); bx.moveTo(0, sR + 20);
            for (let x = 0; x <= W + 2; x += 2) bx.lineTo(x, crest(x) - camRow + 1);
            bx.lineTo(W + 2, sR + 20); bx.closePath(); bx.fill();
            const ft = Math.floor(t * 5);
            for (let x = 0; x < W; x++) {
                const y = Math.round(crest(x) - camRow);
                bx.fillStyle = '#6fdde0'; bx.fillRect(x, y, 1, 1);
                if (((x + ft) % 13) < 3) { bx.fillStyle = '#ffffff'; bx.fillRect(x, y - 1, 1, 1); }
            }
            if (!O.night) {
                const sun = ents[0];
                for (let i = 0; i < 12; i++) {
                    const k = Math.sin(i * 91.7 + Math.floor(t * 6) * 3.1);
                    if (k < 0.2) continue;
                    bx.fillStyle = '#ffffff';
                    bx.fillRect(Math.round(sun.x + Math.sin(i * 12.9) * 22), Math.round(sR + 3 + (i % 4) * 2), 2, 1);
                }
            }
        }
        for (const p of puffs) {
            const y = p.y - camRow;
            if (y < -10 || y > H + 10) continue;
            bx.fillStyle = O.night ? `rgba(107,107,128,${p.life * 0.7})` : `rgba(223,244,255,${p.life * 0.8})`;
            bx.beginPath(); bx.arc(p.x, y, p.r, 0, TAU); bx.fill();
        }

        // 10-11. you (the bathysphere), bubbles, torpedoes, the player sub
        sphere.draw();
        for (const b of bubbles) drawBubble(b);
        for (const p of torps) {
            const y = Math.round(p.y - camRow), x = Math.round(p.x);
            bx.fillStyle = '#b4b4c4'; bx.fillRect(x - 2, y, 5, 1);
            bx.fillStyle = '#ff9a1f'; bx.fillRect(x - Math.sign(p.vx) * 3, y, 1, 1);
        }
        drawGame();
        if (player) {
            const tx = mouse.inside ? mouse.cx / SC : W / 2, ty = mouse.inside ? (mouse.cy + (scrollY - camRow * SC)) / SC : H / 2;
            const ddx = tx - player.x;
            if (Math.abs(ddx) > 2) player.dir = ddx > 0 ? 1 : -1;
            player.x += ddx * Math.min(1, rdt * 5);
            player.y += (ty - player.y) * Math.min(1, rdt * 5);
            const o = { x: player.x, y: player.y, s: 7, ry: player.dir > 0 ? -0.25 : Math.PI + 0.25, rx: 0.15, light: 1 };
            if (!(game && game.inv > 0 && Math.floor(t * 10) % 2)) S.drawMesh(bx, mesh('sub', M.sub), o);
            const pp = S.project([-1.38, 0, 0], o), a = t * 18;
            S.drawMesh(bx, mesh('prop', M.prop), { ...o, x: pp[0], y: pp[1], deform: (p) => { const y2 = p[1], z = p[2]; p[1] = y2 * Math.cos(a) - z * Math.sin(a); p[2] = y2 * Math.sin(a) + z * Math.cos(a); } });
        }

        // 12. darkness, with holes cut out by every light source
        const dTop = darkAt(metersAtW(camRow)), dBot = darkAt(metersAtW(camRow + H));
        if (!O.sub && (dTop > 0.01 || dBot > 0.01)) {
            dx.globalCompositeOperation = 'source-over';
            dx.clearRect(0, 0, W, H);
            const g = dx.createLinearGradient(0, 0, 0, H);
            for (let k = 0; k <= 6; k++) g.addColorStop(k / 6, `rgba(0,0,0,${darkAt(metersAtW(camRow + (k / 6) * H))})`);
            dx.fillStyle = g; dx.fillRect(0, 0, W, H);
            dx.globalCompositeOperation = 'destination-out';
            if (mouse.inside) light(dx, mouse.cx / SC, (mouse.cy + (scrollY - camRow * SC)) / SC, clamp(W * 0.11, 30, 70), 1);
            for (const e of ents) e.dark && e.dark(dx);
            if (player) light(dx, player.x + player.dir * 12, player.y, 34, 0.95);
            dx.globalCompositeOperation = 'source-over';
            bx.drawImage(dk, 0, 0);
        }

        // 13. things that glow in the dark
        for (const s of snow) {
            const y = (((s.y + t * s.v - camRow * s.d) % H) + H) % H;
            if (metersAtW(camRow + y) < 120) continue;
            bx.fillStyle = 'rgba(200,215,235,0.45)';
            bx.fillRect(Math.round(s.x), Math.round(y), 1, 1);
        }
        for (const b of bio) {
            const y = b.y - camRow;
            if (y < 0 || y > H || Math.sin(t * 1.7 + b.ph) < 0.55) continue;
            bx.fillStyle = b.c;
            bx.fillRect(Math.round(b.x), Math.round(y), 1, 1);
        }
        for (const e of ents) e.glow && e.glow();
        drawKraken();
        if (performance.now() < flashUntil) { bx.fillStyle = css(flashCol, 0.35); bx.fillRect(0, 0, W, H); }

        // 14. dither everything to the palette, anchored to the world so it doesn't shimmer when scrolling
        const img = bx.getImageData(0, 0, W, H);
        S.dither(img, O.sub ? GB_PAL : S.SEA_PAL, O.sub ? 60 : 34, 0, camRow);
        ctx.putImageData(img, 0, 0);
    }

    /* ---------- loop ---------- */
    let last = performance.now(), acc = 0, lastScroll = -1;
    function loop(now) {
        requestAnimationFrame(loop);
        if (document.hidden || paused) { last = now; return; }
        const fps = O.turbo ? 60 : reduced ? 4 : 12;
        const step = 1 / fps;
        const rdt = Math.min(0.1, (now - last) / 1000);
        acc += Math.min(0.25, (now - last) / 1000);
        last = now;
        let ticked = false, n = 0;
        while (acc >= step && n++ < 5) { acc -= step; tick(step); ticked = true; }
        const sy = window.scrollY;
        const settling = sphere && Math.abs(sphere.y - Math.max(surfW + 14 + sphere.r, camRow + H * 0.52)) > 0.3;
        if (ticked || sy !== lastScroll || O.dirty || settling) {
            render(sy, rdt);
            lastScroll = sy;
            O.dirty = false;
        }
    }

    O.init = () => {
        cv = document.getElementById('ocean');
        ctx = cv.getContext('2d');
        buf = document.createElement('canvas');
        bx = buf.getContext('2d', { willReadFrequently: true });
        dk = document.createElement('canvas');
        dx = dk.getContext('2d');
        resize();
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
        const move = (x, y) => { mouse.cx = x; mouse.cy = y; mouse.inside = true; mouse.moved = performance.now(); lastPoke = mouse.moved; O.dirty = true; };
        window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
        window.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY), { passive: true });
        document.addEventListener('pointerleave', () => { mouse.inside = false; O.dirty = true; });
        window.addEventListener('scroll', () => { lastPoke = performance.now(); }, { passive: true });
        window.addEventListener('keydown', () => { lastPoke = performance.now(); });
        requestAnimationFrame(loop);
    };
})();

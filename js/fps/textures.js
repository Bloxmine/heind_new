/* Small hand-made textures, drawn on canvases at load: board-marked concrete, orange steel, grating, wood, coal.
   They are tiny (64 px) and sampled without filtering, so they stay chunky under the dither. */
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function canvasTex(size, draw, seed = 7) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    const r = rng(seed);
    const px = (i, j, col, k = 1) => {
        i = ((i % size) + size) % size; j = ((j % size) + size) % size;
        const o = (j * size + i) * 4, d = img.data;
        d[o] = d[o] * (1 - k) + col[0] * k; d[o + 1] = d[o + 1] * (1 - k) + col[1] * k; d[o + 2] = d[o + 2] * (1 - k) + col[2] * k; d[o + 3] = 255;
    };
    draw({ px, r, size, img });
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = window.__aniso || 4;      // keeps floors from streaking at low angles
    return t;
}
// fill with a base colour plus per-pixel noise
function base(g, col, amt) {
    const c = hex(col);
    for (let j = 0; j < g.size; j++) for (let i = 0; i < g.size; i++) {
        const n = (g.r() - 0.5) * amt;
        g.px(i, j, [c[0] + n, c[1] + n, c[2] + n]);
    }
}
const shade = (col, k) => hex(col).map((v) => Math.max(0, Math.min(255, v * k)));
function blob(g, cx, cy, rad, col, k) {
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) {
        const d = Math.hypot(i, j) / rad;
        if (d < 1 && g.r() > d * 0.7) g.px(cx + i, cy + j, col, k * (1 - d * 0.6));
    }
}

const DRAW = {
    // board-marked concrete: horizontal formwork boards, panel seams, tie holes and rain stains
    wall: (g) => {
        base(g, '#86837c', 22);
        for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x++) g.px(x, y, shade('#86837c', 0.82), 0.6);
        for (let y = 0; y < 64; y++) { g.px(0, y, shade('#86837c', 0.7), 0.8); g.px(32, y, shade('#86837c', 0.8), 0.4); }
        for (const [x, y] of [[8, 12], [24, 12], [40, 12], [56, 12], [8, 44], [24, 44], [40, 44], [56, 44]]) { g.px(x, y, [40, 40, 40]); g.px(x + 1, y, [55, 55, 55]); }
        for (let k = 0; k < 6; k++) { const x = Math.floor(g.r() * 64), y0 = Math.floor(g.r() * 64), L = 10 + g.r() * 30; for (let y = 0; y < L; y++) g.px(x + (g.r() < 0.2 ? 1 : 0), y0 + y, [70, 68, 62], 0.25); }
    },
    floor: (g) => {
        base(g, '#67645f', 18);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [52, 50, 47]); g.px(0, i, [52, 50, 47]); }
        for (let k = 0; k < 5; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 3 + Math.floor(g.r() * 6), [40, 38, 36], 0.35);
        for (let k = 0; k < 40; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [150, 146, 138], 0.5);
    },
    ceil: (g) => { base(g, '#55524e', 14); for (let i = 0; i < 64; i++) { g.px(i, 0, [38, 37, 35]); g.px(i, 32, [44, 43, 41]); } },
    conc2: (g) => {
        base(g, '#99958d', 16);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [120, 117, 110]); g.px(0, i, [110, 107, 100]); }
        for (let k = 0; k < 4; k++) blob(g, Math.floor(g.r() * 64), 50 + Math.floor(g.r() * 14), 4, [90, 86, 80], 0.3);
    },
    steel: (g) => {
        base(g, '#3f4955', 10);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [30, 35, 42]); g.px(0, i, [30, 35, 42]); }
        for (const [x, y] of [[4, 4], [60, 4], [4, 60], [60, 60], [32, 4], [32, 60]]) { g.px(x, y, [100, 110, 122]); g.px(x + 1, y + 1, [22, 26, 30]); }
        for (let k = 0; k < 10; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 6; i++) g.px(x + i, y + (i >> 2), [95, 104, 114], 0.4); }
    },
    grate: (g) => {
        base(g, '#5a636e', 10);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (x % 4 !== 0 && y % 4 !== 0) g.px(x, y, [26, 28, 32], 0.82);
    },
    stair: (g) => {
        base(g, '#d4581e', 10);
        for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x++) g.px(x, y, [150, 52, 18], 0.6);
        for (let k = 0; k < 30; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [90, 70, 60], 0.5);
    },
    orange: (g) => {
        base(g, '#de5f1e', 8);
        for (let y = 0; y < 64; y++) { g.px(0, y, [160, 60, 20]); g.px(31, y, [170, 66, 22], 0.5); }
        for (let x = 0; x < 64; x++) for (let y = 56; y < 64; y++) g.px(x, y, [120, 46, 18], 0.15 + (y - 56) * 0.03);
    },
    rail: (g) => { base(g, '#30353b', 8); for (let i = 0; i < 64; i++) g.px(i, 2, [80, 88, 96], 0.5); },
    crate: (g) => {
        base(g, '#9c6c3b', 16);
        for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x++) { g.px(x, y, [60, 38, 20]); g.px(x, y + 1, [80, 52, 28], 0.6); }
        for (let i = 0; i < 64; i++) { g.px(i, i, [110, 76, 42]); g.px(i + 1, i, [70, 45, 24]); g.px(0, i, [60, 38, 20]); g.px(63, i, [60, 38, 20]); }
        for (let k = 0; k < 40; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 5; i++) g.px(x + i, y, [130, 92, 52], 0.35); }
    },
    cart: (g) => {
        base(g, '#6c3b24', 20);
        for (let k = 0; k < 7; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 3 + Math.floor(g.r() * 5), [168, 86, 36], 0.6);
        for (let x = 0; x < 64; x += 8) { g.px(x, 3, [180, 160, 140]); g.px(x, 60, [180, 160, 140]); }
        for (let i = 0; i < 64; i++) { g.px(i, 0, [40, 22, 14]); g.px(i, 63, [40, 22, 14]); }
    },
    belt: (g) => { base(g, '#25272b', 8); for (let x = 0; x < 64; x += 6) for (let y = 0; y < 64; y++) g.px(x, y, [55, 58, 62], 0.7); },
    coal: (g) => {
        base(g, '#17171b', 10);
        for (let k = 0; k < 60; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); g.px(x, y, [70, 74, 86], 0.7); g.px(x + 1, y, [40, 42, 50], 0.6); }
    },
    // ----- outdoor and other maps -----
    sand: (g) => {
        base(g, '#b48e74', 12);
        for (let k = 0; k < 9; k++) { const y0 = Math.floor(g.r() * 64); for (let x = 0; x < 64; x++) g.px(x, y0 + Math.round(Math.sin(x / 9 + k) * 2), [168, 112, 82], 0.35); }
        for (let k = 0; k < 50; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [150, 100, 72] : [214, 170, 136], 0.5);
    },
    asphalt: (g) => {
        base(g, '#75716b', 14);
        for (let k = 0; k < 160; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [120, 116, 110] : [70, 66, 62], 0.7);
        for (let k = 0; k < 2; k++) { let x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 24; i++) { g.px(x, y, [48, 46, 44], 0.8); x += g.r() < 0.5 ? 1 : 0; y += 1; } }
    },
    night: (g) => { base(g, '#46443f', 12); for (let k = 0; k < 140; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [96, 92, 86] : [52, 50, 47], 0.7); },
    sidewalk: (g) => {
        base(g, '#aaa498', 12);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [130, 125, 116]); g.px(0, i, [130, 125, 116]); g.px(i, 32, [138, 133, 124]); g.px(32, i, [138, 133, 124]); }
        for (let k = 0; k < 40; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [150, 145, 136], 0.6);
    },
    rock: (g) => {
        // red sandstone: soft strata, and vertical fluting where rain has run down it
        const bands = ['#a0563c', '#984f36', '#a85c3e', '#9c5338'];
        let y = 0, bi = 0;
        while (y < 64) { const h = 6 + Math.floor(g.r() * 10), c = hex(bands[bi++ % bands.length]); for (let j = y; j < Math.min(64, y + h); j++) for (let x = 0; x < 64; x++) { const n = (g.r() - 0.5) * 12; g.px(x, j, [c[0] + n, c[1] + n * 0.6, c[2] + n * 0.5]); } y += h; }
        for (let k = 0; k < 9; k++) { let x = Math.floor(g.r() * 64); const dk = g.r() < 0.5; for (let j = 0; j < 64; j++) { g.px(x, j, dk ? [120, 60, 40] : [178, 104, 72], 0.35); if (g.r() < 0.1) x += g.r() < 0.5 ? 1 : -1; } }
    },
    scree: (g) => { base(g, '#a8664a', 16); for (let k = 0; k < 90; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); g.px(x, y, g.r() < 0.5 ? [130, 70, 48] : [196, 130, 96], 0.7); g.px(x + 1, y, [120, 64, 44], 0.5); } },
    adobe: (g) => { base(g, '#c9a07a', 12); for (let k = 0; k < 6; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 5, [210, 178, 140], 0.4); for (let i = 0; i < 64; i++) g.px(i, 63, [150, 110, 80], 0.5); },
    rust: (g) => {
        base(g, '#8c4c2c', 18);
        for (let k = 0; k < 9; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 3 + Math.floor(g.r() * 6), g.r() < 0.5 ? [170, 82, 36] : [92, 52, 36], 0.6);
        for (let k = 0; k < 8; k++) { const x = Math.floor(g.r() * 64); for (let j = 0; j < 64; j++) if (g.r() < 0.7) g.px(x, j, [60, 34, 22], 0.35); }
        for (let i = 0; i < 64; i++) g.px(i, 0, [52, 30, 20]);
    },
    paint: (g) => {
        base(g, '#6c7883', 10);
        for (let k = 0; k < 10; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 2 + Math.floor(g.r() * 4), [130, 70, 40], 0.7);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [50, 56, 62]); g.px(0, i, [50, 56, 62]); }
    },
    grass: (g) => {
        base(g, '#5d7c38', 18);
        for (let k = 0; k < 260; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); g.px(x, y, g.r() < 0.5 ? [110, 150, 60] : [60, 86, 34], 0.8); g.px(x, y - 1, [90, 120, 50], 0.4); }
    },
    gravel: (g) => { base(g, '#8a8378', 26); for (let k = 0; k < 220; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [160, 154, 144] : [80, 76, 70], 0.8); },
    stone: (g) => {
        base(g, '#b4ada2', 12);
        // irregular paving stones
        const rows = [0, 14, 30, 44, 64];
        for (let r = 0; r < 4; r++) {
            const y0 = rows[r], y1 = rows[r + 1];
            for (let x = 0; x < 64; x++) g.px(x, y0, [108, 102, 94]);
            let x = Math.floor(g.r() * 10);
            while (x < 64) { for (let j = y0; j < y1; j++) g.px(x, j, [108, 102, 94]); x += 10 + Math.floor(g.r() * 14); }
            for (let k = 0; k < 3; k++) blob(g, Math.floor(g.r() * 64), y0 + Math.floor(g.r() * (y1 - y0)), 3, [196, 190, 180], 0.3);
        }
    },
    plaster: (g) => { base(g, '#d8c7a6', 10); for (let k = 0; k < 6; k++) blob(g, Math.floor(g.r() * 64), 40 + Math.floor(g.r() * 24), 6, [180, 160, 128], 0.35); },
    brick: (g) => {
        base(g, '#a68c6a', 14);
        for (let y = 0; y < 64; y += 8) { for (let x = 0; x < 64; x++) g.px(x, y, [120, 100, 76]); const off = (y / 8) % 2 ? 8 : 0; for (let x = off; x < 64; x += 16) for (let j = y; j < y + 8; j++) g.px(x, j, [120, 100, 76]); }
    },
    canvas: (g) => {
        base(g, '#a8262a', 8);
        for (let x = 0; x < 64; x += 16) for (let y = 0; y < 64; y++) g.px(x, y, [130, 26, 30], 0.7);
        for (let x = 0; x < 64; x++) for (let y = 58; y < 64; y++) g.px(x, y, [240, 232, 220], (x >> 2) % 2 ? 0.9 : 0);
    },
    carpet: (g) => {
        base(g, '#8a1e22', 10);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const e = Math.min(x, y, 63 - x, 63 - y);
            if (e < 4) g.px(x, y, [40, 50, 110]); else if (e < 6) g.px(x, y, [210, 170, 80]);
            else if (Math.abs(x - 32) + Math.abs(y - 32) < 14 && (Math.abs(x - 32) + Math.abs(y - 32)) % 4 < 2) g.px(x, y, [210, 170, 80]);
        }
    },
    wood: (g) => { base(g, '#7a5232', 12); for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x++) g.px(x, y, [48, 30, 18]); for (let k = 0; k < 30; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 6; i++) g.px(x + i, y, [100, 70, 44], 0.4); } },
    deck: (g) => {
        base(g, '#c9c4b8', 8);
        for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x++) g.px(x, y, [176, 170, 160], 0.6);
        for (let k = 0; k < 5; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 4, [180, 175, 166], 0.4);
    },
    chalk: (g) => {
        // white chalk in layers, with dark bands of flint
        base(g, '#dcdacb', 10);
        for (let y = 0; y < 64; y += 10 + Math.floor(g.r() * 6)) for (let x = 0; x < 64; x++) { if (g.r() < 0.7) g.px(x, y, [70, 74, 70], 0.55); g.px(x, y + 1, [180, 178, 166], 0.4); }
        for (let k = 0; k < 6; k++) { let x = Math.floor(g.r() * 64); for (let j = 0; j < 64; j++) { g.px(x, j, [196, 194, 182], 0.5); if (g.r() < 0.15) x += g.r() < 0.5 ? 1 : -1; } }
        for (let k = 0; k < 4; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 5, [170, 172, 150], 0.25);
    },
    pebbles: (g) => {
        base(g, '#9a958a', 20);
        for (let k = 0; k < 120; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64), c = g.r() < 0.33 ? [190, 186, 176] : g.r() < 0.5 ? [120, 116, 108] : [160, 150, 128]; g.px(x, y, c); g.px(x + 1, y, c, 0.8); g.px(x, y + 1, c, 0.6); }
    },
    hedge: (g) => { base(g, '#3e5a26', 26); for (let k = 0; k < 200; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [90, 120, 50] : [30, 44, 20], 0.8); },
    slate: (g) => { base(g, '#4a525c', 10); for (let y = 0; y < 64; y += 6) for (let x = 0; x < 64; x++) g.px(x + ((y / 6) % 2) * 4, y, [34, 38, 44], 0.8); },
    // ----- the office -----
    officecarpet: (g) => {
        base(g, '#5a5547', 10);
        for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) if ((i + (j >> 1)) % 3 === 0) g.px(i, j, [74, 70, 58], 0.5);
        for (let k = 0; k < 6; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 4 + Math.floor(g.r() * 5), [70, 66, 54], 0.25);
    },
    ceiltile: (g) => {
        base(g, '#7c7864', 8);
        for (let k = 0; k < 220; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [96, 92, 76], 0.7);
        for (let i = 0; i < 64; i++) for (const y of [0, 32]) { g.px(i, y, [52, 50, 42]); g.px(y, i, [52, 50, 42]); }
    },
    partition: (g) => {
        base(g, '#8e8a77', 12);
        for (let k = 0; k < 300; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [120, 116, 100] : [116, 112, 96], 0.4);
        for (let y = 0; y < 64; y++) { g.px(0, y, [88, 88, 92]); g.px(1, y, [70, 70, 74]); }
    },
    desk: (g) => { base(g, '#c0bba8', 6); for (let i = 0; i < 64; i++) { g.px(i, 0, [110, 106, 96]); g.px(i, 1, [150, 146, 132], 0.5); } },
    drywall: (g) => { base(g, '#8c8874', 8); for (let k = 0; k < 4; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 7, [128, 124, 104], 0.2); for (let i = 0; i < 64; i++) g.px(i, 63, [60, 58, 50], 0.8); },
    crt: (g) => { base(g, '#b3ab90', 6); for (let y = 6; y < 20; y += 3) for (let x = 40; x < 58; x++) g.px(x, y, [120, 114, 96]); for (let i = 0; i < 64; i++) { g.px(i, 0, [140, 134, 112]); g.px(0, i, [140, 134, 112]); } },
    rack: (g) => {
        base(g, '#1c1f24', 6);
        for (let y = 0; y < 64; y += 8) { for (let x = 0; x < 64; x++) g.px(x, y, [44, 48, 56]); for (let x = 6; x < 58; x += 4) g.px(x, y + 4, g.r() < 0.6 ? [60, 230, 110] : g.r() < 0.5 ? [255, 176, 40] : [80, 170, 255]); }
        for (let y = 0; y < 64; y++) { g.px(0, y, [70, 74, 82]); g.px(63, y, [70, 74, 82]); }
    },
    // ----- the mall -----
    terrazzo: (g) => {
        base(g, '#d6cab0', 8);
        for (let k = 0; k < 260; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.4 ? [150, 120, 90] : g.r() < 0.5 ? [120, 116, 108] : [236, 228, 210], 0.8);
        for (let i = 0; i < 64; i++) { g.px(i, 0, [170, 150, 120], 0.6); g.px(0, i, [170, 150, 120], 0.6); }
    },
    fascia: (g) => { base(g, '#e2d8c4', 5); for (let i = 0; i < 64; i++) { g.px(i, 52, [120, 86, 56]); g.px(i, 53, [140, 104, 70]); } },
    redcarpet: (g) => { base(g, '#9a2a1a', 12); for (let k = 0; k < 200; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [120, 40, 26], 0.5); },
    planter: (g) => { base(g, '#6a4a2e', 10); for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x++) g.px(x, y, [40, 28, 18]); for (let y = 0; y < 64; y++) g.px((y >> 4) % 2 ? 16 : 48, y, [40, 28, 18]); },
    shutter: (g) => { base(g, '#8a8c88', 6); for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x++) { g.px(x, y, [60, 62, 60]); g.px(x, y + 1, [150, 152, 148], 0.6); } },
    mallwall: (g) => { base(g, '#c8b89a', 8); for (let k = 0; k < 5; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 6, [210, 196, 168], 0.25); },
    brass: (g) => { base(g, '#8a6a34', 10); for (let y = 0; y < 64; y++) if (y % 8 < 2) for (let x = 0; x < 64; x++) g.px(x, y, [190, 150, 80], 0.6); },
    // ----- the snowy forest -----
    snow: (g) => {
        base(g, '#c6ced2', 6);
        for (let k = 0; k < 8; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 6 + Math.floor(g.r() * 6), [178, 188, 196], 0.35);
        for (let k = 0; k < 40; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), [240, 246, 250], 0.8);
    },
    snowroad: (g) => {
        base(g, '#a3aaac', 10);
        for (let k = 0; k < 6; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 5, [130, 136, 138], 0.35);
        for (let k = 0; k < 90; k++) g.px(Math.floor(g.r() * 64), Math.floor(g.r() * 64), g.r() < 0.5 ? [200, 206, 210] : [110, 114, 116], 0.6);
    },
    ice: (g) => {
        base(g, '#6f8a94', 8);
        for (let k = 0; k < 7; k++) { let x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 30; i++) { g.px(x, y, [196, 214, 220], 0.7); x += g.r() < 0.6 ? 1 : 0; y += g.r() < 0.5 ? 1 : -1; } }
        for (let k = 0; k < 5; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 6, [150, 172, 180], 0.3);
    },
    logwall: (g) => {
        base(g, '#5e4430', 10);
        for (let y = 0; y < 64; y++) { const v = y % 10; const k = v < 2 ? 0.45 : 1 - Math.abs(v - 5.5) * 0.05; for (let x = 0; x < 64; x++) g.px(x, y, shade('#6a4c34', k), 0.7); }
        for (let k = 0; k < 30; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 7; i++) g.px(x + i, y, [80, 58, 40], 0.4); }
    },
    snowrock: (g) => {
        base(g, '#4b4f52', 14);
        for (let k = 0; k < 10; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 32), 4 + Math.floor(g.r() * 5), [196, 204, 208], 0.75);
        for (let k = 0; k < 6; k++) { let x = Math.floor(g.r() * 64); for (let j = 0; j < 64; j++) { g.px(x, j, [40, 42, 44], 0.4); if (g.r() < 0.2) x += g.r() < 0.5 ? 1 : -1; } }
    },
    corrugated: (g) => { base(g, '#5c6268', 8); for (let x = 0; x < 64; x += 4) for (let y = 0; y < 64; y++) { g.px(x, y, [80, 86, 92]); g.px(x + 2, y, [44, 48, 52], 0.7); } for (let k = 0; k < 6; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 4, [110, 70, 46], 0.35); },
    // ----- the soft play centre -----
    mats: (g) => {
        const cols = ['#d8262a', '#2a5ad8', '#f0c020', '#2aa84a'];
        for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
            const c = hex(cols[((i >> 5) + (j >> 5) * 3) % 4]), e = Math.min(i % 32, j % 32, 31 - (i % 32), 31 - (j % 32));
            const k = e < 1 ? 0.55 : e < 3 ? 0.85 : 1, n = (g.r() - 0.5) * 8;
            g.px(i, j, [c[0] * k + n, c[1] * k + n, c[2] * k + n]);
        }
        for (let k = 0; k < 6; k++) { const x = Math.floor(g.r() * 64), y = Math.floor(g.r() * 64); for (let i = 0; i < 5; i++) g.px(x + i, y + (i >> 1), [255, 255, 255], 0.35); }
    },
    mural: (g) => {
        base(g, '#8ac8e8', 6);
        for (let k = 0; k < 5; k++) { const y0 = 10 + k * 12, c = hex(['#3ab04a', '#f0c020', '#e8402a', '#2a6ad8', '#b04aff'][k]); for (let x = 0; x < 64; x++) { const y = y0 + Math.round(Math.sin(x / 10 + k * 1.7) * 3); for (let j = 0; j < 3; j++) g.px(x, y + j, c, 0.85); } }
        for (let k = 0; k < 5; k++) blob(g, Math.floor(g.r() * 64), Math.floor(g.r() * 64), 4, [255, 255, 255], 0.35);
    },
    netfloor: (g) => {
        base(g, '#2a2c30', 6);
        for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) if ((i + j) % 8 === 0 || (i - j + 64) % 8 === 0) g.px(i, j, [200, 200, 190]);
    },
    slide: (g) => { base(g, '#f2c21a', 5); for (let y = 0; y < 64; y++) { g.px(0, y, [200, 150, 10]); g.px(63, y, [200, 150, 10]); } for (let k = 0; k < 12; k++) { const x = Math.floor(g.r() * 60); for (let i = 0; i < 4; i++) g.px(x + i, Math.floor(g.r() * 64), [255, 240, 160], 0.6); } },
    ceilwhite: (g) => { base(g, '#d8dce0', 5); for (let i = 0; i < 64; i++) { g.px(i, 0, [170, 174, 180]); g.px(0, i, [170, 174, 180]); } },
    tramp: (g) => {
        base(g, '#1b1c21', 8);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const e = Math.min(x, y, 63 - x, 63 - y);
            if (e < 7) g.px(x, y, (Math.floor((x + y) / 6) % 2) ? [40, 110, 230] : [250, 220, 60]);
            else if (e === 7) g.px(x, y, [200, 200, 210]);
            else if ((x - 32) ** 2 + (y - 32) ** 2 < 36) g.px(x, y, [250, 220, 60], 0.8);
        }
    }
};
// padded vinyl in the soft play colours: a soft sheen and seams
const PADS = { padred: '#d8262a', padblue: '#2a4ed0', padyellow: '#f0c020', padgreen: '#2aa84a', padpurple: '#8a3ad0' };
for (const [k, col] of Object.entries(PADS)) DRAW[k] = (g) => {
    base(g, col, 5);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { const v = j % 32; if (v < 2) g.px(i, j, shade(col, 0.6), 0.8); else if (v < 8) g.px(i, j, shade(col, 1.18), 0.25); }
    for (let j = 0; j < 64; j++) g.px(0, j, shade(col, 0.6), 0.8);
};
// metres covered by one repeat of each texture; `local` maps the whole texture onto each face
export const MATS = {
    wall: { size: 2.4 }, floor: { size: 2 }, ceil: { size: 2.4 }, slab: { size: 2.4, top: 'floor', side: 'wall' },
    conc2: { size: 1.6 }, steel: { size: 1.2 }, grate: { size: 0.8, side: 'steel' }, stair: { size: 0.9 },
    orange: { size: 1.6 }, rail: { size: 1.0 }, crate: { size: 1, local: true }, cart: { size: 1.3 }, belt: { size: 1 },
    coal: { size: 1.2 }, tramp: { size: 1, local: true, side: 'steel' },
    sand: { size: 3 }, scree: { size: 2.5 }, asphalt: { size: 3, side: 'sidewalk' }, night: { size: 3, side: 'sidewalk' }, sidewalk: { size: 2 }, rock: { size: 6 }, adobe: { size: 2.5 },
    rust: { size: 2 }, paint: { size: 2 }, grass: { size: 2, side: 'gravel' }, gravel: { size: 2 }, stone: { size: 2.4 }, plaster: { size: 2.5 }, brick: { size: 1.6 },
    canvas: { size: 1.6 }, chalk: { size: 5 }, cliff: { size: 2, top: 'grass', side: 'chalk' }, pebbles: { size: 2 }, hedge: { size: 1.5 }, slate: { size: 1.5 }, carpet: { size: 1.2, local: true }, wood: { size: 1.2 }, deck: { size: 3 },
    officecarpet: { size: 1.2 }, ceiltile: { size: 1.2 }, partition: { size: 1.5 }, desk: { size: 1.2 }, drywall: { size: 2.5 }, crt: { size: 0.5, local: true }, rack: { size: 1, local: true },
    officefloor: { size: 1.2, top: 'officecarpet', side: 'ceiltile' },
    terrazzo: { size: 2 }, fascia: { size: 2 }, mallslab: { size: 2, top: 'terrazzo', side: 'fascia' }, redcarpet: { size: 1.5 }, planter: { size: 1 }, lounge: { size: 1.5, top: 'redcarpet', side: 'planter' },
    shutter: { size: 1.2 }, mallwall: { size: 2.5 }, brass: { size: 1 },
    snow: { size: 4 }, snowroad: { size: 3, side: 'snow' }, ice: { size: 4 }, logwall: { size: 1.6 }, snowrock: { size: 3, top: 'snow' }, mats: { size: 4 }, mural: { size: 6 }, netfloor: { size: 1.2 }, slide: { size: 2 }, ceilwhite: { size: 2.4 },
    padred: { size: 1.6 }, padblue: { size: 1.6 }, padyellow: { size: 1.6 }, padgreen: { size: 1.6 }, padpurple: { size: 1.6 },
    corrugated: { size: 1.2 }, hill: { size: 4, top: 'snow', side: 'snowrock' }
};
export const DRAWN = new Set(Object.keys(DRAW));

let cache = null;
export function textures() {
    if (cache) return cache;
    cache = {};
    let seed = 11;
    for (const k of Object.keys(DRAW)) cache[k] = canvasTex(64, DRAW[k], seed += 17);
    return cache;
}

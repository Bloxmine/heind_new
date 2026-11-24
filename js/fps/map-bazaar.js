/* GRAND BAZAAR: a sunny market street with red awnings, crossed by a long covered hall lit by lanterns
   and slots of daylight. Shops in alcoves along both, side alleys, two courtyards, and a rooftop route
   of plank bridges over the streets. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, stair, decor, light } = K;
const D = 2.2;          // shop depth

box(-33, -2, -33, 33, 0, 33, 'stone');
// the city wall around it all
box(-33, 0, -33, 33, 7, -32, 'brick'); box(-33, 0, 32, 33, 7, 33, 'brick'); box(-33, 0, -32, -32, 7, 32, 'brick'); box(32, 0, -32, 33, 7, 32, 'brick');
for (const e of [[-36, -36, -32, 36], [32, -36, 36, 36], [-36, -36, 36, -32], [-36, 32, 36, 36]]) K.clip(e[0], e[1], e[2], e[3], 0, 40);

/* A block of shops, 5 m high with a flat roof. faces: which sides open onto a street with shop alcoves. */
const SHOP_COLS = ['#8a1e22', '#2a3a7a', '#a85a1e', '#5a2a5a', '#c89a3a', '#2a6a4a'];
let shopN = 0;
function block(x0, z0, x1, z1, faces = '') {
    const e = faces.includes('e'), w = faces.includes('w'), n = faces.includes('n'), s = faces.includes('s');
    const cx0 = w ? x0 + D : x0, cx1 = e ? x1 - D : x1, cz0 = s ? z0 + D : z0, cz1 = n ? z1 - D : z1;
    box(cx0, 0, cz0, cx1, 5, cz1, 'plaster');
    // strips along x faces run the full length; z faces fill between them
    const strips = [];
    if (e) strips.push(['x', x1 - D, x1, z0, z1, 1]);
    if (w) strips.push(['x', x0, x0 + D, z0, z1, -1]);
    if (n) strips.push(['z', z1 - D, z1, cx0, cx1, 1]);
    if (s) strips.push(['z', z0, z0 + D, cx0, cx1, -1]);
    for (const [ax, a0, a1, b0, b1, dir] of strips) {
        const L = b1 - b0, cnt = Math.max(1, Math.floor((L - 1) / 4)), used = cnt * 3 + (cnt - 1) * 1, pad = (L - used) / 2;
        let b = b0;
        const P = (p0, p1, y0, y1, m) => (ax === 'x' ? box(a0, y0, p0, a1, y1, p1, m) : box(p0, y0, a0, p1, y1, a1, m));
        P(b, b + pad, 0, 5, 'brick'); b += pad;
        for (let i = 0; i < cnt; i++) {
            P(b, b + 3, 3, 5, 'brick');                                     // lintel over the alcove
            // goods in the alcove, a lantern, a carpet on the back wall
            const mid = b + 1.5, back = dir > 0 ? a0 + 0.3 : a1 - 0.3, front = dir > 0 ? a1 : a0;
            const p = (u, y, v) => (ax === 'x' ? [u, y, v] : [v, y, u]);
            const col = SHOP_COLS[shopN++ % SHOP_COLS.length];
            if (shopN % 3 === 0) { const [x, , z] = p(back + (dir > 0 ? 0.5 : -0.5), 0, mid); box(x - 0.5, 0, z - 0.9, x + 0.5, 1.0, z + 0.9, 'wood'); }
            decor({ t: 'stack', p: p((back + front) / 2 - dir * 0.2, 0, mid - 0.8), w: 1.0, d: 0.7, n: 5 + (shopN % 4) });
            decor({ t: 'banner', p: p(back - dir * 0.05, 2.8, mid + 0.6), w: 1.0, h: 1.6, ry: ax === 'x' ? Math.PI / 2 : 0, m: shopN % 2 ? 'carpet' : null, c: col });
            decor({ t: 'lantern', p: p(front - dir * 0.6, 3, mid), drop: 0.3, glow: shopN % 2 ? '#ffb85a' : '#ffd890' });
            b += 3;
            if (i < cnt - 1) { P(b, b + 1, 0, 5, 'brick'); b += 1; }
        }
        P(b, b1, 0, 5, 'brick');
    }
}
// the grid: blocks A..D across x, E..H across z; streets between them
const X = [[-32, -20], [-16, -4], [4, 16], [20, 32]], Z = [[-32, -20], [-17, -4], [4, 17], [20, 32]];
const faceOf = (xi, zi) => (xi === 1 ? 'e' : xi === 2 ? 'w' : '') + (zi === 1 ? 'n' : zi === 2 ? 's' : '');
for (let xi = 0; xi < 4; xi++) for (let zi = 0; zi < 4; zi++) {
    if ((xi === 0 && zi === 0) || (xi >= 2 && zi === 3)) continue;      // the two courtyards
    block(X[xi][0], Z[zi][0], X[xi][1], Z[zi][1], faceOf(xi, zi));
}

/* ---------- the covered hall (east-west) ---------- */
for (const z of [-4.4, 4]) for (const [a, b] of [[-32, -4], [4, 32]]) box(a, 5, z, b, 7, z + 0.4, 'brick');
for (let x = -32; x < 32; x += 6) {
    const x1 = Math.min(32, x + 4.5);
    if (x1 <= -4 || x >= 4) box(Math.max(x, x < -4 ? -32 : 4), 7, -4.4, x1 > -4 && x < -4 ? -4 : x1, 7.5, 4.4, 'brick');
}
for (let x = -29; x < 32; x += 6) if (Math.abs(x) > 5) {
    light(x, 5.6, 0, [1, 0.66, 0.34], 1.1, 8);
    decor({ t: 'lantern', p: [x, 7, 0], drop: 1.2 });
    decor({ t: 'vbox', min: [x + 1.6, 6.4, -4], max: [x + 2.3, 7, 4], m: 'brick' });
}
// alley crossings are under the hall too: the gaps in its walls there get arches
for (const x of [-20, 16]) decor({ t: 'vbox', min: [x, 4.4, -4.4], max: [x + 4, 5, -4], m: 'brick' }, { t: 'vbox', min: [x, 4.4, 4], max: [x + 4, 5, 4.4], m: 'brick' });

/* ---------- awnings along the main street: deep red canvas sloping down over the shop fronts ---------- */
for (const [a, b] of [[-32, -4.2], [4.2, 32]]) {
    ramp(-4, a, -1.5, b, 'x', 4.3, 3.3, 0.1, 'canvas', { noNav: true });
    ramp(1.5, a, 4, b, 'x', 3.3, 4.3, 0.1, 'canvas', { noNav: true });
}
for (let z = -30; z <= 30; z += 4) if (Math.abs(z) > 5) for (const x of [-1.6, 1.5]) decor({ t: 'vbox', min: [x, 3.3, z], max: [x + 0.1, 3.5, z + 0.1], c: '#5a3a24' });

/* ---------- courtyards ---------- */
// south-west: a stair up to the roofs, across the alley
stair(-30, -29.6, -28, -21, 'z', 0, 5, { m: 'wood', sides: 'rail', rail: 'wood' });
box(-30, 4.8, -21, -28, 5, -17, 'wood');
box(-26, 0, -27, -23, 0.7, -24, 'stone'); box(-25.5, 0, -26.5, -23.5, 1.3, -24.5, 'brick');           // a well
// north-east: the big courtyard with a fountain and trees, a stair to the roofs
box(16, 0, 24, 20, 0.6, 28, 'stone');
box(17.4, 0.6, 25.4, 18.6, 2, 26.6, 'stone');
stair(28, 21, 30, 29.6, 'z', 5, 0, { m: 'wood', sides: 'rail', rail: 'wood' });
box(28, 4.8, 17, 30, 5, 21, 'wood');
for (const [x, z] of [[8, 24], [8, 29], [24, 30], [12, 23]]) box(x - 0.3, 0, z - 0.3, x + 0.3, 3, z + 0.3, 'wood', { hide: true });
box(6, 0, 30, 9, 1.0, 31.5, 'crate'); box(22, 0, 21, 24, 0.9, 22.5, 'crate');

/* ---------- plank bridges between the roofs ---------- */
box(-4, 4.8, -13, 4, 5, -11.6, 'wood'); box(-4, 4.8, 10.6, 4, 5, 12, 'wood');
box(-20, 4.8, -10, -16, 5, -8.8, 'wood'); box(16, 4.8, 8, 20, 5, 9.2, 'wood'); box(16, 4.8, -12, 20, 5, -10.8, 'wood');
box(-20, 4.8, 24, -16, 5, 25.2, 'wood'); box(16, 4.8, -26, 20, 5, -24.8, 'wood');
box(-26, 4.8, -20, -24.8, 5, -17, 'wood'); box(24, 4.8, -20, 25.2, 5, -17, 'wood'); box(-10, 4.8, 17, -8.8, 5, 20, 'wood');
// little domes and chimneys on the roofs (solid, so you can't walk through them)
for (const [x, z, r] of [[-10, -26, 2], [10, -11, 2.2], [-26, 10, 1.8], [26, -26, 2], [-10, 26, 2.2], [26, 10, 1.6]]) {
    box(x - r * 0.7, 5, z - r * 0.7, x + r * 0.7, 5 + r * 0.8, z + r * 0.7, 'plaster', { hide: true });
    decor({ t: 'dome', p: [x, 5.4, z], r, drum: 0.4, c: '#d8c7a6' });
}

/* ---------- the main street: stalls, sacks, bunting ---------- */
for (const [x, z] of [[-1.6, -24], [1.6, -14], [-1.6, 14], [1.6, 24]]) {
    box(x - 0.8, 0, z - 1.2, x + 0.8, 1.0, z + 1.2, 'wood');
    decor({ t: 'stack', p: [x, 1.0, z], w: 1.4, d: 2.0, n: 3, cols: ['#c8501e', '#d8a020', '#8a2a1a', '#6a7a2a'] });
}
for (const [x, z] of [[-18, -26], [18, 0], [-18, 12], [18, 26]]) box(x - 0.6, 0, z - 0.6, x + 0.6, 0.9, z + 0.6, 'crate');
for (let z = -28; z <= 28; z += 7) if (Math.abs(z) > 5) decor({ t: 'flags', a: [-3.9, 5.2, z], b: [3.9, 5.2, z + 3], n: 12, sag: 0.7, cols: ['#d8262a', '#f4f0e8', '#d8262a', '#2a6ad8'] });
for (const z of [-30, -22, 22, 30]) decor({ t: 'banner', p: [-4.05, 4.9, z], w: 1.2, h: 2.2, ry: Math.PI / 2, c: '#c8262a', emblem: '#f4f0e8' }, { t: 'banner', p: [4.05, 4.9, z + 3], w: 1.2, h: 2.2, ry: -Math.PI / 2, c: '#c8262a', emblem: '#f4f0e8' });
decor(
    ...[[-30, -26], [-24, -30], [10, 26], [26, 25], [14, 30]].map(([x, z]) => ({ t: 'tree', p: [x, 0, z], s: 0.9, cols: ['#4a7a30', '#5e8c3a', '#3a6626'] })),
    { t: 'decal', p: [18, 0.6, 26], w: 3.6, d: 3.6, c: '#3a8acf' },
    // the city beyond the wall: roofs and a minaret
    { t: 'vbox', min: [-80, 0, -70], max: [-34, 12, -34], c: '#c8b898', shadow: false },
    { t: 'vbox', min: [34, 0, -60], max: [70, 10, 40], c: '#bfae90', shadow: false },
    { t: 'vbox', min: [-60, 0, 34], max: [30, 9, 70], c: '#c4b494', shadow: false },
    { t: 'cyl', p: [-50, 0, 50], r: 1.4, h: 34, c: '#d8cfc0', shadow: false, dome: 2.2, r2: 1.1 },
    { t: 'dome', p: [45, 10, 50], r: 12, c: '#9aa0a8', shadow: false },
    { t: 'vbox', min: [-600, -0.5, -600], max: [600, -0.05, -36], c: '#b4ada2', shadow: false }
);

const PAL = ['#060504', '#0d0a09', '#1b1513', '#2e140f', '#2b231e', '#431f1a', '#1c234b', '#6c0f11', '#3b302a', '#562b24', '#4e3d36', '#6b342c', '#982d25', '#6e473b', '#5b4f4a', '#894a2f',
    '#815949', '#70615e', '#ae6934', '#946b59', '#847573', '#ab816a', '#8fb0d8', '#d6993f', '#b09789', '#9c9dad', '#c7ac99', '#b4b6cb', '#d6c2b4', '#e6dad0', '#f4f2f0', '#ffffff'];

export const BAZAAR = {
    id: 'bazaar',
    name: 'Grand Bazaar',
    blurb: 'Red awnings in the sun, a lantern-lit hall, and a rooftop way round.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -32, x1: 32, z0: -32, z1: 32, y0: 0, y1: 8 },
    ambient: [0.05, 0.042, 0.036],
    bake: { D: 2, sky: [0.34, 0.33, 0.33], skyLen: 30, bounce: [0.17, 0.12, 0.08] },
    sun: { dir: [0.42, -0.78, -0.46], color: '#fff0d8', i: 2.7 },
    sky: { top: '#9ebde0', horizon: '#ece6dc', ground: '#b4ada2', curve: 0.5, sun: '#fffbea' },
    farProbe: [0.4, 0.37, 0.34],
    fog: { color: '#e0dcd4', near: 60, far: 260 },
    far: 320,
    navStep: 4,
    navExtra: [[29, 0, 30.8], [26.5, 0, 30.8], [-29, 0, -30.8], [-26.5, 0, -30.8]],
    song: 'market',
    titleCam: { c: [0, 2.4, -20], r: 2, h: 0.6, look: [0, 3, 20], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 20, ink: '#060504', line: '#f4f2f0', grade: { sat: 1.08, con: 1.05, vig: 0.22, shadow: [0.98, 0.98, 1.02], high: [1.06, 1.0, 0.94] } },
    spawns: [
        [0, 0, -30], [0, 0, 30], [-30, 0, 0], [30, 0, 0], [-18, 0, -30], [18, 0, 30], [-18, 0, 20], [18, 0, -20], [-22, 0, -22],
        [12, 0, 28], [-10, 5, -10], [10, 5, 12], [-26, 5, 26], [26, 5, -10], [0, 0, -18], [0, 0, 18]
    ],
    items: [
        ['w:rocket', 0, 0, 0], ['w:golf', -26, 5, -10], ['w:tennis', 26, 5, 14], ['w:blower', -18, 0, 0], ['w:balloon', 18, 0, -8], ['w:bat', 0, 4.8, -12.3],
        ['w:slicer', -28, 0, -24], ['w:rake', 12, 0, 22], ['w:whip', 18, 0, 14], ['w:pistol', 0, 0, 20], ['w:rc', -26, 5, 26],
        ['a:rocket', 28, 0, 0], ['a:rocket', -28, 0, 0], ['a:golf', 10, 5, -26], ['a:tennis', -10, 5, 10], ['a:blower', -18, 0, -24], ['a:balloon', 14, 0, 26], ['a:bat', 0, 0, -28], ['a:pistol', 6, 0, 0],
        ['h:kit', -12, 0, 0], ['h:kit', 12, 0, 0], ['h:kit', 0, 0, -8], ['h:kit', 0, 0, 8], ['h:kit', -18, 0, -18.5], ['h:kit', 18, 0, 18.5],
        ['h:soda', -30, 0, 2], ['h:soda', 30, 0, -2], ['h:soda', -18, 0, 28], ['h:soda', 18, 0, -28],
        ['h:cake', 22, 5, 14], ['r:helmet', -13, 5, 22], ['r:pads', 25, 0, 28], ['r:pads', -24, 0, -22], ['r:ring', 0, 4.8, 11.3],
        ['p:sauce', -24, 0, -28], ['p:espresso', 0, 0, 4], ['p:sneakers', 22, 5, -22], ['p:box', -18, 0, 9]
    ]
};

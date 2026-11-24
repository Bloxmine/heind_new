/* FOUNTAIN COURT: a 1970s shopping mall on three floors round a skylit atrium. Pools and a brass fan
   sculpture on the ground floor, red-carpet lounges, escalators criss-crossing the void, a bridge on the top
   floor, galleries of shops (some shut), and stairs in both ends. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, stair, decor, light, glow, slab } = K;
const FL = [0, 5, 10], ROOF = 15;
const WARM = [1.0, 0.84, 0.62], SHOP = [1.0, 0.9, 0.74], SKY = [0.84, 0.9, 1.0], POOL = [0.6, 0.95, 0.9];
const X0 = -28, X1 = 28, Z0 = -19, Z1 = 19;
const ATRIUM = [-16, -8, 16, 8];

/* ---------- the shell ---------- */
box(X0, -1, Z0, X1, 0, Z1, 'terrazzo');
box(X0 - 0.5, 0, Z0 - 0.5, X1 + 0.5, ROOF, Z0, 'mallwall'); box(X0 - 0.5, 0, Z1, X1 + 0.5, ROOF, Z1 + 0.5, 'mallwall');
box(X0 - 0.5, 0, Z0, X0, ROOF, Z1, 'mallwall'); box(X1, 0, Z0, X1 + 0.5, ROOF, Z1, 'mallwall');
// the roof, open over the atrium, with beams across the skylight
slab(X0, Z0, X1, Z1, ROOF, ROOF + 0.5, 'fascia', [[-14, -6, 14, 6]], { noNav: true });
for (const x of [-10.5, -7, -3.5, 0, 3.5, 7, 10.5]) box(x - 0.12, ROOF, -6, x + 0.12, ROOF + 0.4, 6, 'brass');
box(-14, ROOF, -0.12, 14, ROOF + 0.35, 0.12, 'brass');

/* ---------- floors: galleries round the atrium, with the stairwells cut out ---------- */
const WELL = { e1: [24.4, -10, 27.6, -1], e2: [24.4, 1, 27.6, 10], w1: [-27.6, 1, -24.4, 10], w2: [-27.6, -10, -24.4, -1] };
slab(X0, Z0, X1, Z1, FL[1] - 0.5, FL[1], 'mallslab', [ATRIUM, WELL.e1, WELL.w1]);
slab(X0, Z0, X1, Z1, FL[2] - 0.5, FL[2], 'mallslab', [ATRIUM, WELL.e2, WELL.w2]);
// stairs at both ends: ground to the first floor, then on up to the second
stair(WELL.e1[0], WELL.e1[1], WELL.e1[2], WELL.e1[3], 'z', 0, 5, { m: 'terrazzo', sides: 'rail', rail: 'brass' });
stair(WELL.e2[0], WELL.e2[1], WELL.e2[2], WELL.e2[3], 'z', 5, 10, { m: 'terrazzo', sides: 'rail', rail: 'brass' });
stair(WELL.w1[0], WELL.w1[1], WELL.w1[2], WELL.w1[3], 'z', 5, 0, { m: 'terrazzo', sides: 'rail', rail: 'brass' });
stair(WELL.w2[0], WELL.w2[1], WELL.w2[2], WELL.w2[3], 'z', 10, 5, { m: 'terrazzo', sides: 'rail', rail: 'brass' });
// guard rails round the stairwells' open ends
box(24.4, 5, -10.1, 27.6, 6.05, -10, 'brass'); box(24.4, 10, 0.9, 27.6, 11.05, 1, 'brass');
box(-27.6, 5, 10, -24.4, 6.05, 10.1, 'brass'); box(-27.6, 10, -1, -24.4, 11.05, -0.9, 'brass');
box(24.3, 5, -10, 24.4, 6.05, -1, 'brass'); box(24.3, 10, 1, 24.4, 11.05, 10, 'brass');
box(-24.4, 5, 1, -24.3, 6.05, 10, 'brass'); box(-24.4, 10, -10, -24.3, 11.05, -1, 'brass');

/* ---------- escalators ---------- */
const esc = (x0, z0, x1, z1, ax, ya, yb) => stair(x0, z0, x1, z1, ax, ya, yb, { m: 'steel', th: 1.2, sides: 'panel', panel: 'fascia' });
// two from the ground floor, crossing the middle, each onto a landing at a gallery
esc(-12, -1.5, -3, -0.1, 'x', 5, 0); box(-16, 4.5, -1.6, -12, 5, 0, 'mallslab');
esc(3, 0.1, 12, 1.5, 'x', 0, 5); box(12, 4.5, 0, 16, 5, 1.6, 'mallslab');
box(-16, 5, -1.76, -12, 6.0, -1.6, 'fascia'); box(-16, 5, 0, -12, 6.0, 0.06, 'fascia');
box(12, 5, -0.06, 16, 6.0, 0, 'fascia'); box(12, 5, 1.6, 16, 6.0, 1.76, 'fascia');
// one from the first floor's north gallery up over the void to a bridge on the second
esc(-0.7, -8, 0.7, 1, 'z', 5, 10);
box(-1.6, 9.5, 1, 1.6, 10, 8, 'mallslab');
box(-1.7, 10, 1, -1.6, 11.05, 8, 'brass'); box(1.6, 10, 1, 1.7, 11.05, 8, 'brass');
box(-1.6, 10, 0.9, -0.86, 11.05, 1, 'brass'); box(0.86, 10, 0.9, 1.6, 11.05, 1, 'brass');

/* ---------- the galleries' railings, with gaps where the escalators and the bridge come in ---------- */
function railX(z0, z1, x0, x1, y, gaps = []) {
    let a = x0;
    for (const [g0, g1] of [...gaps, [x1, x1]]) { if (g0 > a) box(a, y, z0, g0, y + 1.05, z1, 'brass'); a = g1; }
}
function railZ(x0, x1, z0, z1, y, gaps = []) {
    let a = z0;
    for (const [g0, g1] of [...gaps, [z1, z1]]) { if (g0 > a) box(x0, y, a, x1, y + 1.05, g0, 'brass'); a = g1; }
}
railX(-8.1, -8, -16, 16, 5, [[-0.86, 0.86]]); railX(8, 8.1, -16, 16, 5);
railZ(-16.1, -16, -8, 8, 5, [[-1.76, 0.06]]); railZ(16, 16.1, -8, 8, 5, [[-0.06, 1.76]]);
railX(-8.1, -8, -16, 16, 10); railX(8, 8.1, -16, 16, 10, [[-1.6, 1.6]]);
railZ(-16.1, -16, -8, 8, 10); railZ(16, 16.1, -8, 8, 10);
// big round columns at the atrium's corners and halfway along
for (const x of [-16, -8, 8, 16]) for (const z of [-8, 8]) {
    box(x - 0.55, 0, z - 0.55, x + 0.55, ROOF, z + 0.55, 'mallwall', { hide: true });
    decor({ t: 'cyl', p: [x, 0, z], r: 0.62, h: ROOF, c: '#f4ecd8', seg: 16 });
}

/* ---------- shops: six units along each side of every floor ---------- */
const SIGNS = ['#e8402a', '#ffb43a', '#3ad0ff', '#ff3a6e', '#4aff7a', '#f4ead0', '#ff8a1a', '#b04aff'];
let shopN = 0;
for (const [fi, y] of FL.entries()) {
    const top = fi === 2 ? ROOF : y + 4.5;
    for (const side of [-1, 1]) {
        const zf = side < 0 ? -12 : 12, zb = side < 0 ? Z0 : Z1;       // front (on the gallery) and back wall
        const zlo = Math.min(zf, zb), zhi = Math.max(zf, zb), out = -side;   // out: from the shop towards the gallery
        for (let i = 0; i < 6; i++) {
            const x0 = -24 + i * 8, x1 = x0 + 8, xc = x0 + 4, zc = (zf + zb) / 2, k = shopN++;
            box(x0 - 0.15, y, zlo, x0 + 0.15, top, zhi, 'mallwall');
            if (i === 5) box(x1 - 0.15, y, zlo, x1 + 0.15, top, zhi, 'mallwall');
            // the shopfront: a fascia with the sign on it, and pilasters
            const fz0 = side < 0 ? zf - 0.3 : zf, fz1 = side < 0 ? zf : zf + 0.3;
            box(x0, y + 3.4, fz0, x1, top, fz1, 'fascia');
            box(x0, y, fz0, x0 + 0.5, y + 3.4, fz1, 'mallwall'); box(x1 - 0.5, y, fz0, x1, y + 3.4, fz1, 'mallwall');
            const sz = side < 0 ? zf + 0.002 : zf - 0.06;
            const open = (i + fi) % 3 !== 2;
            glow(x0 + 1.4, y + 3.65, sz, x1 - 1.4, y + 4.15, sz + 0.058, SIGNS[k % SIGNS.length], !open);
            if (!open) { box(x0 + 0.5, y, side < 0 ? zf - 0.25 : zf + 0.1, x1 - 0.5, y + 3.4, side < 0 ? zf - 0.1 : zf + 0.25, 'shutter'); continue; }
            // inside: a counter at the back, shelves on the walls, a table of goods in the middle
            const cb = zb + out * 1.2;
            box(x0 + 2, y, Math.min(cb, cb + out * 0.8), x1 - 2, y + 1.0, Math.max(cb, cb + out * 0.8), k % 2 ? 'wood' : 'desk');
            for (const sx of [x0 + 0.15, x1 - 0.75]) box(sx, y, zlo + 1, sx + 0.6, y + 2.0, zhi - 1.6, 'wood');
            box(xc - 1.1, y, zc - 0.6 + out * 0.8, xc + 1.1, y + 0.9, zc + 0.6 + out * 0.8, k % 3 ? 'wood' : 'redcarpet');
            decor({ t: 'stack', p: [xc, y + 0.9, zc + out * 0.8], w: 1.8, d: 1.0, n: 3 + (k % 3), cols: [SIGNS[k % SIGNS.length], '#e8dcc0', '#6a4a2e', '#3a5a8a'] });
            light(xc, y + 4.1, zc, SHOP, 1.1, 7.5);
        }
    }
}
// the end walls between the stairwells: shopfronts for the toilets and the way out
for (const sx of [-1, 1]) {
    const xw = sx * 24;
    glow(sx * 27.98 - sx * 0.02, 0, -1, sx * 27.98 + sx * 0.02, 3.2, 1, '#cfe2ff', true);    // the doors out, daylight behind
    light(sx * 26.5, 2.5, 0, SKY, 1.0, 7, false);
}

/* ---------- the ground floor: pools, the fan, red-carpet lounges ---------- */
function pool(x0, z0, x1, z1) {
    const t = 0.4, h = 0.45;
    box(x0, 0, z0, x1, h, z0 + t, 'planter'); box(x0, 0, z1 - t, x1, h, z1, 'planter');
    box(x0, 0, z0 + t, x0 + t, h, z1 - t, 'planter'); box(x1 - t, 0, z0 + t, x1, h, z1 - t, 'planter');
    decor({ t: 'vbox', min: [x0 + t, 0.01, z0 + t], max: [x1 - t, 0.28, z1 - t], c: '#2a6a66', shadow: false });
    for (const [x, z] of [[x0 + t + 0.3, (z0 + z1) / 2], [x1 - t - 0.3, (z0 + z1) / 2]]) light(x, 0.35, z, POOL, 0.5, 3.5, false);
    for (let x = x0 + 1.2; x < x1 - 0.8; x += 1.4) decor({ t: 'lantern', p: [x, 0.5, z0 + t + 0.15], drop: 0.05, size: 0.06, glow: '#fff4d0' });
}
pool(-12, -7.5, -4, -3); pool(4, -7.5, 12, -3); pool(-12, 3, -4, 7.5); pool(4, 3, 12, 7.5);
// the brass fan: rods spraying up out of a stem in the south-east pool
box(7.6, 0, 4.85, 8.4, 2.4, 5.65, 'brass', { hide: true });
decor({ t: 'cyl', p: [8, 0, 5.25], r: 0.25, r2: 0.12, h: 2.2, c: '#a88440', seg: 8 });
for (let i = 0; i < 17; i++) {
    const a = -1.2 + i * 0.15, L = 3.6 + Math.cos(a * 1.3) * 0.6;
    decor({ t: 'pipe', a: [8, 2.1, 5.25], b: [8 + Math.sin(a) * L, 2.1 + Math.cos(a) * L, 5.25 + (i % 2 ? 0.25 : -0.25)], r: 0.035, c: '#c8a050', seg: 4 });
}
// red-carpet lounges in the west and east galleries, with benches and plants
for (const sx of [-1, 1]) {
    const xa = sx * 17.4, xb = sx * 22.6;
    box(Math.min(xa, xb), 0, -6, Math.max(xa, xb), 0.35, 6, 'lounge');
    for (const z of [-4.5, 4.5]) box(Math.min(xa, xb) + 0.8, 0.35, z - 0.35, Math.max(xa, xb) - 0.8, 0.8, z + 0.35, 'planter');
    for (const z of [-2, 2]) { box(sx * 20 - 0.5, 0.35, z - 0.5, sx * 20 + 0.5, 0.9, z + 0.5, 'planter'); decor({ t: 'tree', p: [sx * 20, 0.9, z], s: 0.6, cols: ['#3a5a2a', '#4a6a30', '#2e4a22'] }); }
}
// benches and planters along the first floor
for (const x of [-20, 20]) for (const z of [-10, 10]) { box(x - 1.2, 5, z - 0.3, x + 1.2, 5.45, z + 0.3, 'wood'); }

/* ---------- lights ---------- */
for (const [x, z] of [[-10, -3], [0, -3], [10, -3], [-10, 3], [0, 3], [10, 3]]) light(x, ROOF - 1, z, SKY, 1.3, 22, false);
for (const [fi, y] of FL.entries()) {
    const ly = (fi === 2 ? ROOF : FL[fi + 1] - 0.5) - 0.2;
    for (let x = -21; x <= 21; x += 6) for (const z of [-10, 10]) light(x, ly, z, WARM, 1.0, 8);
    for (const x of [-20, 20]) for (const z of [-4, 4]) light(x, ly, z, WARM, 1.0, 8);
    for (const sx of [-1, 1]) light(sx * 26, ly, (fi === 1 ? -sx : sx) * 6, WARM, 0.9, 7);
}

/* ---------- edges ---------- */
for (const e of [[-32, -23, -28, 23], [28, -23, 32, 23], [-32, -23, 32, -19], [-32, 19, 32, 23]]) K.clip(e[0], e[1], e[2], e[3], -2, 20);

const PAL = ['#040202', '#170c09', '#23130d', '#2a1d14', '#382a1e', '#4e2717', '#453826', '#593921', '#7e2216', '#4f4c2e', '#6a4525', '#9d271a', '#595f39', '#7e5a23',
    '#6f5539', '#87682e', '#63724b', '#856c4b', '#977634', '#98824a', '#af8539', '#9b8765', '#ae9253', '#baa064', '#b09d7b', '#c3ae7b', '#cbba8f', '#d5c5a1', '#ebd5b7', '#fff8d6', '#2a6a66', '#4a9a90'];

export const MALL = {
    id: 'mall',
    name: 'Fountain Court',
    blurb: 'A seventies mall: three floors of shops round fountains, escalators across the void.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: X0, x1: X1, z0: Z0, z1: Z1, y0: 0, y1: 14.7 },
    ambient: [0.08, 0.068, 0.052],
    bake: { D: 1.4 },
    sun: { dir: [-0.28, -1, -0.22], color: '#fff0d8', i: 1.8 },
    skyGlass: [-14, ROOF + 0.45, -6, 14, 6],
    fog: { color: '#2a2018', near: 50, far: 140 },
    far: 160,
    navStep: 4,
    navExtra: [[-13.5, 5, -0.8], [13.5, 5, 0.8], [0, 5, -9], [0, 10, 4.5], [0, 10, 9], [-2.4, 0, -0.8], [2.4, 0, 0.8]],
    song: 'mall',
    titleCam: { c: [-13, 8.2, 7], r: 1.2, h: 0.3, look: [8, 1.5, -4], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 20, ink: '#040202', line: '#fff8d6', grade: { sat: 1.08, con: 1.04, vig: 0.26, shadow: [1.0, 0.98, 0.96], high: [1.06, 1.02, 0.92] } },
    spawns: [
        [-17.8, 0, -13], [20, 0, 10], [-20, 0.35, 0], [20, 0.35, 0], [0, 0, -10], [0, 0, 10], [-26, 0, -15], [26, 0, 15],
        [-12, 5, -10], [12, 5, 10], [-20, 5, 0], [20, 5, 0], [-12, 10, 10], [12, 10, -10], [0, 10, 5], [-26, 10, 15]
    ],
    items: [
        ['w:rocket', 0, 10, 4.5], ['w:golf', -20, 10, -4], ['w:tennis', 20, 10, 4], ['w:blower', 0, 0, 0], ['w:balloon', -8, 0, -5.2], ['w:bat', 8, 5, -10],
        ['w:slicer', -17, 5, 10], ['w:rake', 26, 0, -15], ['w:whip', -17.8, 0, 13], ['w:pistol', 0, 5, 10], ['w:rc', 26, 10, -15],
        ['a:rocket', -26, 5, 15], ['a:rocket', 26, 0, -15], ['a:golf', -14, 10, 10], ['a:tennis', 14, 10, -10], ['a:blower', 4, 0, 10], ['a:balloon', -8, 0, 5.2],
        ['a:bat', -8, 5, 10], ['a:pistol', 8, 5, -10.8], ['h:kit', -20, 0.35, -3], ['h:kit', 20, 0.35, 3], ['h:kit', -17.8, 5, -13], ['h:kit', 22.2, 5, 13],
        ['h:kit', 4, 10, -10], ['h:kit', -1.8, 10, 13], ['h:soda', 0, 0, -2.2], ['h:soda', 3, 0, -1], ['h:soda', -14, 5, -10], ['h:soda', 14, 5, 10], ['h:cake', 0, 10, 7],
        ['r:helmet', -26, 0, 0], ['r:pads', 26, 5, 0], ['r:pads', -26, 10, 0], ['r:ring', 26, 10, 15], ['p:sauce', 0, 5, -10], ['p:espresso', -14, 0, 10],
        ['p:sneakers', 14, 0, -10], ['p:box', -1.8, 5, -13]
    ]
};

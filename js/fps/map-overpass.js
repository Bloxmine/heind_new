/* INTERCHANGE: a highway junction at night. Two raised decks on flared pillars with on-ramps,
   a higher deck crossing over both with a glowing yellow fascia, a street-level crossroads with traffic
   lights, and rows of lamps under every deck. Trampolines and a scaffold stair get you to the top. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, stair, rail, decor, light, glow } = K;
const LAMP = [0.95, 0.95, 0.84], STREET = [1, 0.78, 0.5];

/* ---------- ground: gravel, roads, pavements ---------- */
box(-46, -2, -46, 46, 0, 46, 'gravel');
box(-8, 0, -46, 8, 0.06, 46, 'night'); box(-46, 0, -6, -8, 0.06, 6, 'night'); box(8, 0, -6, 46, 0.06, 6, 'night');
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx > 0 ? 8 : -10.5, x1 = sx > 0 ? 10.5 : -8, z0 = sz > 0 ? 8.5 : -46, z1 = sz > 0 ? 46 : -8.5;
    box(x0, 0, z0, x1, 0.18, z1, 'sidewalk');
    const a0 = sx > 0 ? 8 : -46, a1 = sx > 0 ? 46 : -8, b0 = sz > 0 ? 6 : -8.5, b1 = sz > 0 ? 8.5 : -6;
    box(a0, 0, b0, a1, 0.18, b1, 'sidewalk');
}

/* ---------- deck A (west): an embankment ramp from the north, then on pillars ---------- */
const deck = (x0, x1, z0, z1, top) => box(x0, top - 1.2, z0, x1, top, z1, 'deck');
deck(-24, -14, -46, 10, 8);
ramp(-24, 10, -14, 40, 'z', 8, 0.06, 9, 'deck');
// deck B (east): mirrored, its ramp from the south
deck(14, 24, -10, 46, 8);
ramp(14, -40, 24, -10, 'z', 0.06, 8, 9, 'deck');
// deck C: high across everything, east-west
deck(-46, 46, -28, -20, 15);
// pillars (round in the picture, square to bump into)
const pillar = (x, z, top) => { box(x - 1, 0, z - 1, x + 1, top - 1.2, z + 1, 'deck', { hide: true }); decor({ t: 'flare', p: [x, 0, z], r: 1.0, h: top - 1.2 - 1.6, cap: 1.6, top: 2.6, squash: 0.75, c: '#cfcabe', flutes: true }); };
for (const z of [-40, -10, 0]) pillar(-19, z, 8);
for (const z of [2, 17, 32]) pillar(19, z, 8);
for (const x of [-35, -10.5, 10.5, 35]) pillar(x, -24, 15);
// jersey barriers along the deck edges, low enough to hop
const barrier = (x0, z0, x1, z1, y) => rail(x0, y, z0, x1, z1, 'conc2', 0.9);
barrier(-24, -46, -23.6, 10, 8); barrier(-14.4, -46, -14, 10, 8);
barrier(14, -10, 14.4, 46, 8); barrier(23.6, -10, 24, 46, 8);
ramp(-24, 10, -23.6, 40, 'z', 8.9, 0.96, 0.9, 'conc2', { noNav: true }); ramp(-14.4, 10, -14, 40, 'z', 8.9, 0.96, 0.9, 'conc2', { noNav: true });
ramp(14, -40, 14.4, -10, 'z', 0.96, 8.9, 0.9, 'conc2', { noNav: true }); ramp(23.6, -40, 24, -10, 'z', 0.96, 8.9, 0.9, 'conc2', { noNav: true });
barrier(-46, -28, 32, -27.6, 15); barrier(34, -28, 46, -27.6, 15);
barrier(-46, -20.4, 32, -20, 15); barrier(34, -20.4, 46, -20, 15);

/* ---------- getting up to deck C: trampolines on A and B, and a scaffold stair ---------- */
box(-20, 8, -37, -18, 8.3, -35, 'tramp', { tramp: { to: [-19, 15, -24], peak: 18.2 } });
box(18, 8, -7, 20, 8.3, -5, 'tramp', { tramp: { to: [19, 15, -24], peak: 18.2 } });
stair(32, -7, 34, 2, 'z', 7.5, 0.18, { m: 'grate', sides: 'rail' });
box(32, 7.2, -9, 34, 7.5, -7, 'grate');
stair(32, -18, 34, -9, 'z', 15, 7.5, { m: 'grate', sides: 'rail' });
box(32, 14.7, -20, 34, 15, -18, 'grate');
for (const [x, z] of [[32, -9], [33.7, -9], [32, -18.3], [33.7, -18.3]]) box(x, 0, z, x + 0.3, z < -10 ? 14.7 : 7.2, z + 0.3, 'paint');

/* ---------- cover at street level ---------- */
for (const [x, z, along] of [[-3, -16, 'z'], [3, 18, 'z'], [-30, 3, 'x'], [28, -3, 'x'], [-3, 34, 'z'], [3, -36, 'z']]) {
    if (along === 'z') box(x - 0.3, 0.06, z - 3, x + 0.3, 0.95, z + 3, 'conc2'); else box(x - 3, 0.06, z - 0.3, x + 3, 0.95, z + 0.3, 'conc2');
}
// parked and abandoned vehicles: a box to hit, a model to see
const car = (x, z, ry, c, L = 4.4, W = 1.8, H = 1.45, van = false, y = 0.06) => {
    const ax = Math.abs(Math.sin(ry)) > 0.5;
    box(x - (ax ? L : W) / 2, y, z - (ax ? W : L) / 2, x + (ax ? L : W) / 2, y + H, z + (ax ? W : L) / 2, 'paint', { hide: true });
    decor({ t: 'car', p: [x, y, z], ry, c, L, W, H, van, lights: true });
};
car(4, -26, 0, '#b8b4ac'); car(-5, 22, Math.PI, '#2a4a8a'); car(30, 2.5, Math.PI / 2, '#8a2a2a'); car(-36, -2.5, -Math.PI / 2, '#3a3a40', 6.5, 2.3, 2.6, true);
car(-19, -30, 0.1, '#d8d0b0', 4.4, 1.8, 1.45, false, 8); car(19, 28, Math.PI - 0.15, '#4a6a4a', 6.5, 2.3, 2.6, true, 8); car(-5, -24, 0, '#a83a2a', 4.4, 1.8, 1.45, false, 15);
// the construction site in the south-west corner: a site cabin, pallets
box(-38, 0, -40, -32, 2.8, -37.5, 'paint'); box(-30, 0, -34, -28.5, 1.0, -32.5, 'crate'); box(-27.8, 0, -34, -26.3, 1.4, -32.5, 'crate');
box(36, 0, 36, 40, 1.2, 40, 'crate');

/* ---------- lights: lamps under every deck, street lamps ---------- */
for (let z = -42; z <= 8; z += 6) for (const x of [-22, -16]) { light(x, 6.6, z, LAMP, 2.0, 12, false); decor({ t: 'downlight', p: [x, 6.8, z] }); }
for (let z = -8; z <= 44; z += 6) for (const x of [16, 22]) { light(x, 6.6, z, LAMP, 2.0, 12, false); decor({ t: 'downlight', p: [x, 6.8, z] }); }
for (let x = -42; x <= 42; x += 7) for (const z of [-26, -22]) { light(x, 13.6, z, LAMP, 2.0, 14, false); decor({ t: 'downlight', p: [x, 13.8, z] }); }
for (const [x, z, ry] of [[10.2, 20, Math.PI / 2], [-10.2, -38, -Math.PI / 2], [10.2, -40, Math.PI / 2], [-10.2, 30, -Math.PI / 2], [30, 8.2, 0], [-32, -8.2, Math.PI], [40, -8.2, Math.PI], [-40, 8.2, 0]]) {
    decor({ t: 'lamp', p: [x, 0.18, z], h: 7, ry, glow: '#ffd9a0' });
    const fx = -Math.sin(ry) * 1.5, fz = -Math.cos(ry) * 1.5;
    light(x + fx, 6.6, z + fz, STREET, 2.2, 15, false);
}
// the glowing fascia along deck C, like the picture
glow(-46, 13.85, -28.12, 46, 14.25, -28.02, '#e8e8a0'); glow(-46, 13.85, -20.02, 46, 14.25, -19.9, '#e8e8a0');
for (let x = -42; x <= 42; x += 12) { light(x, 13.5, -29, [0.95, 0.95, 0.6], 0.8, 7, false); light(x, 13.5, -19, [0.95, 0.95, 0.6], 0.8, 7, false); }
light(-36, 2.5, -36.8, [1, 0.6, 0.3], 1.2, 6);
// a dark city all round, with lit windows
for (const [x0, z0, x1, z1, h] of [[-120, -140, -60, -90, 40], [-40, -150, 30, -100, 26], [60, -130, 110, -80, 52], [100, -40, 150, 30, 34], [90, 60, 140, 120, 60], [-20, 100, 50, 150, 30],
    [-130, 70, -70, 130, 44], [-160, -40, -100, 20, 28]]) {
    decor({ t: 'vbox', min: [x0, 0, z0], max: [x1, h, z1], c: '#14161c', shadow: false, lit: false });
    let i = 0;
    for (let y = 4; y < h - 2; y += 4) for (let u = 0.1; u < 0.95; u += 0.12) if ((i++ * 7) % 5 < 2) {
        const fx = x0 + (x1 - x0) * u, fz = z0 + (z1 - z0) * u;
        if (Math.abs(x0) < Math.abs(x1) ? x0 > 0 : x1 < 0) glow(x0 > 0 ? x0 - 0.1 : x1, y, fz, x0 > 0 ? x0 : x1 + 0.1, y + 1.2, fz + 1.5, i % 3 ? '#ffd890' : '#a8c8ff', true);
        else glow(fx, y, z0 > 0 ? z0 - 0.1 : z1, fx + 1.5, y + 1.2, z0 > 0 ? z0 : z1 + 0.1, i % 3 ? '#ffd890' : '#a8c8ff', true);
    }
}

/* ---------- edges ---------- */
for (const e of [[-50, -50, -46, 50], [46, -50, 50, 50], [-50, -50, 50, -46], [-50, 46, 50, 50]]) K.clip(...e);

/* ---------- details ---------- */
decor(
    // markings
    ...Array.from({ length: 18 }, (_, i) => -44 + i * 5).filter((z) => Math.abs(z) > 9).map((z) => ({ t: 'decal', p: [0, 0.06, z], w: 0.18, d: 3, c: '#d8c040' })),
    ...Array.from({ length: 18 }, (_, i) => -44 + i * 5).filter((x) => Math.abs(x) > 9).map((x) => ({ t: 'decal', p: [x, 0.06, 0], w: 3, d: 0.18, c: '#d8c040' })),
    ...[-6.5, 6.5].flatMap((z) => Array.from({ length: 7 }, (_, i) => ({ t: 'decal', p: [-6 + i * 2, 0.06, z + Math.sign(z) * 1.2], w: 1, d: 2.2, c: '#d8d4c8' }))),
    ...[-7, 7].flatMap((x) => Array.from({ length: 5 }, (_, i) => ({ t: 'decal', p: [x + Math.sign(x) * 1.2, 0.06, -4 + i * 2], w: 2.2, d: 1, c: '#d8d4c8' }))),
    ...[[-19, 8.0, -20], [19, 8.0, 20], [0, 15, -24]].map(([x, y, z]) => ({ t: 'decal', p: [x, y, z], w: z === -24 ? 80 : 0.15, d: z === -24 ? 0.15 : 50, c: '#e8e4d8' })),
    // traffic lights at the corners
    { t: 'traffic', p: [9.3, 0.18, 7.3], ry: Math.PI / 2, len: 6, lit: 'r' }, { t: 'traffic', p: [-9.3, 0.18, -7.3], ry: -Math.PI / 2, len: 6, lit: 'r' },
    { t: 'traffic', p: [9.3, 0.18, -7.3], ry: 0, len: 6, lit: 'g' }, { t: 'traffic', p: [-9.3, 0.18, 7.3], ry: Math.PI, len: 6, lit: 'g' },
    // the construction site's red pennants
    { t: 'flags', a: [-40, 0.9, -28], b: [-28, 0.9, -28], n: 14, sag: 0.25, cols: ['#d8342a', '#e85a2a'] },
    { t: 'flags', a: [-28, 0.9, -28], b: [-28, 0.9, -42], n: 14, sag: 0.25, cols: ['#d8342a', '#e85a2a'] },
    ...[[-40, -28], [-34, -28], [-28, -28], [-28, -35], [-28, -42]].map(([x, z]) => ({ t: 'vbox', min: [x - 0.04, 0, z - 0.04], max: [x + 0.04, 1.0, z + 0.04], c: '#c8c0b0' })),
    ...[[-2, 14], [2, -14], [-1, -32], [5, 30], [-26, -14], [30, 14]].map(([x, z]) => ({ t: 'cyl', p: [x, 0.06, z], r: 0.25, r2: 0.04, h: 0.7, c: '#ff6a1a', seg: 6 })),
    // the decks run on beyond the map
    { t: 'vbox', min: [-24, 6.8, -160], max: [-14, 8, -46], m: 'deck', shadow: false },
    { t: 'vbox', min: [14, 6.8, 46], max: [24, 8, 160], m: 'deck', shadow: false },
    { t: 'vbox', min: [-200, 13.8, -28], max: [-46, 15, -20], m: 'deck', shadow: false }, { t: 'vbox', min: [46, 13.8, -28], max: [200, 15, -20], m: 'deck', shadow: false },
    { t: 'vbox', min: [-600, -0.5, -600], max: [600, -0.04, -46], c: '#1c1d20', shadow: false }, { t: 'vbox', min: [-600, -0.5, 46], max: [600, -0.04, 600], c: '#1c1d20', shadow: false },
    { t: 'vbox', min: [-600, -0.5, -46], max: [-46, -0.04, 46], c: '#1c1d20', shadow: false }, { t: 'vbox', min: [46, -0.5, -46], max: [600, -0.04, 46], c: '#1c1d20', shadow: false }
);

const PAL = ['#020304', '#050609', '#0b1220', '#18243a', '#0c0d11', '#131415', '#1d1e1d', '#282825', '#36342d', '#403d36', '#4c4843', '#2a3a5a', '#69403e', '#565145', '#d8402a', '#5d584d',
    '#cfe0ff', '#625c52', '#3aff6a', '#666256', '#ffb020', '#6c685b', '#756555', '#716b60', '#787264', '#817c6f', '#8d877b', '#9c968a', '#b1aa99', '#bdb7ad', '#e6e6b1', '#ffffcf'];

export const OVERPASS = {
    id: 'overpass',
    name: 'Interchange',
    blurb: 'A highway junction at night: lit decks, a crossroads below, a long drop.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -46, x1: 46, z0: -46, z1: 46, y0: 0, y1: 16 },
    ambient: [0.04, 0.045, 0.06],
    bake: { D: 1.4, sky: [0.06, 0.07, 0.11], skyLen: 30, bounce: [0.035, 0.032, 0.028] },
    sun: { dir: [0.3, -0.8, 0.5], color: '#8ea4d8', i: 0.3 },
    sky: { top: '#03050a', horizon: '#1c2232', ground: '#0c0d10', curve: 0.45, stars: 700, moon: '#e8ecf8', moonDir: [-0.3, 0.5, -0.8] },
    farProbe: [0.05, 0.05, 0.07],
    fog: { color: '#141822', near: 50, far: 240 },
    far: 320,
    navStep: 5,
    song: 'neon',
    titleCam: { c: [0, 1.6, 30], r: 3, h: 0.4, look: [0, 9, -20], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 24, ink: '#020304', line: '#e6e6b1', grade: { sat: 1.0, con: 1.08, vig: 0.3, shadow: [0.94, 0.98, 1.08], high: [1.06, 1.04, 0.94] } },
    spawns: [
        [0, 0.06, -40], [0, 0.06, 40], [-40, 0.06, 0], [40, 0.06, 0], [-30, 0, -20], [30, 0, 20], [-30, 0, 30], [30, 0, -36],
        [-19, 8, -42], [-19, 8, 4], [19, 8, -4], [19, 8, 42], [-40, 15, -24], [40, 15, -24], [12, 0.18, 12], [-12, 0.18, -12]
    ],
    items: [
        ['w:golf', 0, 15, -24], ['w:rocket', -19, 8, -12], ['w:tennis', 19, 8, 12], ['w:blower', 0, 0.06, 0], ['w:balloon', -30, 0, 30], ['w:bat', 30, 0, -30],
        ['w:slicer', -12, 0.18, 12], ['w:rake', 12, 0.18, -12], ['w:whip', -40, 0.06, -3], ['w:pistol', 40, 0.06, 3], ['w:rc', -42, 15, -24],
        ['a:rocket', -19, 8, -44], ['a:rocket', 19, 8, 44], ['a:golf', 42, 15, -24], ['a:tennis', 19, 8, -2], ['a:blower', -6, 0.06, -10], ['a:balloon', 30, 0, 30], ['a:bat', -30, 0, -14], ['a:pistol', 0, 0.06, 44],
        ['h:kit', -19, 8, 6], ['h:kit', 19, 8, -8.5], ['h:kit', -30, 0, -10], ['h:kit', 30, 0, 10], ['h:kit', 0, 0.06, -20], ['h:kit', 0, 0.06, 20],
        ['h:soda', -36, 0, -42], ['h:soda', 36, 0, 42], ['h:soda', 20, 15, -24], ['h:soda', -20, 15, -24],
        ['h:cake', -19, 8, -24], ['r:helmet', 19, 8, 24], ['r:pads', -12, 0.18, -30], ['r:pads', 12, 0.18, 30], ['r:ring', 33, 7.5, -8],
        ['p:sauce', 0, 15, -21.2], ['p:espresso', -40, 0.06, 4], ['p:sneakers', 40, 0.06, -4], ['p:box', -34, 0, -34]
    ]
};

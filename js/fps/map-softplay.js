/* TUMBLE TOWN: an indoor soft play centre after closing. Four padded climbing towers on three levels in
   red, blue, yellow and green, joined by net bridges; safety netting you can shoot through but not walk
   through; a big ball pit and a small one, a yellow slide, a covered tube slide from the top deck, padded
   stairs, punch bags, a toddler corner and the parents' café. Bright, busy, and very loud colours. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, stair, decor, light, glow, slab } = K;
const L1 = 2.4, L2 = 4.8, L3 = 7.2, CE = 10;
const STRIP = [0.95, 0.97, 1.0], WARM = [1.0, 0.85, 0.65];
const PIPES = ['#f0c020', '#2a4ed0', '#2aa84a', '#8a3ad0', '#d8262a'];

/* ---------- the hall ---------- */
box(-24, -1, -18, 24, 0, 18, 'mats');
box(-24.5, 0, -18.5, 24.5, CE, -18, 'mural'); box(-24.5, 0, 18, 24.5, CE, 18.5, 'mural');
box(-24.5, 0, -18, -24, CE, 18, 'mural'); box(24, 0, -18, 24.5, CE, 18, 'mural');
box(-24, CE, -18, 24, CE + 0.5, 18, 'ceilwhite', { noNav: true });

// a platform: a padded deck 0.3 thick with its top at y
const deck = (x0, z0, x1, z1, y, m, holes) => slab(x0, z0, x1, z1, y - 0.3, y, m, holes);
// safety netting: stops you, not your shots
function net(x0, z0, x1, z1, y0, y1) {
    const t = 0.05;
    if (x0 === x1) K.add({ ...box(x0 - t, y0, z0, x0 + t, y1, z1, 'wall'), clip: true, noShot: true }); else K.add({ ...box(x0, y0, z0 - t, x1, y1, z0 + t, 'wall'), clip: true, noShot: true });
    decor({ t: 'net', a: [x0, y0, z0], b: [x1, y1, z1] });
}
// a tower's corner posts, padded, with a bar along the top
function posts(x0, z0, x1, z1, top, ci) {
    const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    P.forEach(([x, z], i) => {
        box(x - 0.15, 0, z - 0.15, x + 0.15, top, z + 0.15, 'padblue', { hide: true });
        decor({ t: 'cyl', p: [x, 0, z], r: 0.15, h: top, c: PIPES[(ci + i) % PIPES.length], seg: 8, bands: [0.6, top * 0.5, top - 0.4], bandC: '#2a4ed0' });
        const [nx, nz] = P[(i + 1) % 4];
        decor({ t: 'pipe', a: [x, top, z], b: [nx, top, nz], r: 0.1, c: PIPES[(ci + i + 2) % PIPES.length], seg: 6 });
    });
}

/* ---------- tower A (north-west): three levels ---------- */
deck(-20, -14, -12, -4, L1, 'padblue');
deck(-20, -14, -12, -4, L2, 'padred', [[-14, -13, -12.5, -7]]);
deck(-20, -14, -12, -4, L3, 'padyellow', [[-19.5, -11, -18, -6]]);
ramp(-14, -13, -12.5, -7, 'z', L2, L1, 0.3, 'padgreen', { steps: true });
ramp(-19.5, -11, -18, -6, 'z', L2, L3, 0.3, 'padpurple', { steps: true });
// the cargo net up to the first level, from the north
ramp(-18, -17.5, -15, -14, 'z', 0, L1, 0.3, 'netfloor');
posts(-20, -14, -12, -4, L3 + 1.9, 0);
net(-20, -14, -20, -6, L1, L3 + 1.8); net(-20, -6, -20, -4, L1, L3 - 0.3);
net(-20, -14, -18, -14, L1, L3 + 1.8); net(-15, -14, -12, -14, L1, L3 + 1.8); net(-18, -14, -15, -14, L2, L3 + 1.8);
// punch bags hanging under the second level
for (const [x, z, c] of [[-16, -9.5, '#d8262a'], [-17.6, -6.5, '#2a4ed0']]) {
    box(x - 0.3, L1 + 0.6, z - 0.3, x + 0.3, L2 - 0.3, z + 0.3, 'padred', { hide: true });
    decor({ t: 'cyl', p: [x, L1 + 0.6, z], r: 0.3, h: 1.5, c, seg: 10, bands: [0.2, 1.3], bandC: '#f0c020' });
}

/* ---------- tower B (south-west) ---------- */
deck(-20, 4, -12, 14, L1, 'padgreen');
deck(-20, 4, -12, 14, L2, 'padpurple', [[-19.5, 5, -17, 12]]);
ramp(-19.5, 5, -17, 12, 'z', L2, L1, 0.3, 'padyellow', { steps: true });
// big padded steps up from the floor (the second photo)
stair(-12, 10, -7, 13, 'x', L1, 0, { m: 'padred', th: 0.4 });
for (let i = 0; i < 5; i++) decor({ t: 'vbox', min: [-12 + i, 0.02, 9.99], max: [-11 + i, L1 - i * 0.48, 10.0], c: ['#d8262a', '#2aa84a', '#8a3ad0', '#2a4ed0', '#f0c020'][i] });
posts(-20, 4, -12, 14, L2 + 1.9, 2);
net(-20, 4, -20, 14, L1, L2 + 1.8); net(-20, 14, -12, 14, L1, L2 + 1.8);
// the net bridge between A and B at the second level
box(-18, L2 - 0.3, -4, -14, L2, 4, 'netfloor');
net(-18, -4, -18, 4, L2, L2 + 1.6); net(-14, -4, -14, 4, L2, L2 + 1.6);
for (const z of [-2, 0, 2]) decor({ t: 'cyl', p: [-16, L2 + 1.0, z], r: 0.06, h: 0.9, c: '#d8262a', seg: 6 });     // rings to swing on, hanging

/* ---------- tower C (north, middle) and D (north-east) ---------- */
deck(-10, -14, -2, -6, L1, 'padyellow');
deck(-10, -14, -2, -6, L2, 'padblue', [[-9.5, -13, -8, -8]]);
ramp(-9.5, -13, -8, -8, 'z', L2, L1, 0.3, 'padred', { steps: true });
stair(-8, -6, -4.5, -1, 'z', L1, 0, { m: 'padgreen', th: 0.4 });
deck(2, -14, 10, -6, L1, 'padgreen');
deck(2, -14, 10, -6, L2, 'padred', [[8.5, -13, 10, -8]]);
ramp(8.5, -13, 10, -8, 'z', L2, L1, 0.3, 'padpurple', { steps: true });
stair(3, -6, 6.5, -1, 'z', L1, 0, { m: 'padblue', th: 0.4 });
posts(-10, -14, -2, -6, L2 + 1.9, 1); posts(2, -14, 10, -6, L2 + 1.9, 3);
net(-10, -14, -2, -14, L1, L2 + 1.8); net(2, -14, 10, -14, L1, L2 + 1.8);
net(10, -14, 10, -12, L1, L2 + 1.8); net(10, -9.5, 10, -6, L1, L2 + 1.8); net(10, -12, 10, -9.5, L1, L2);
// bridges: A to C at the first level, C to D at the second
box(-12, L1 - 0.3, -12, -10, L1, -8, 'netfloor');
net(-12, -12, -10, -12, L1, L1 + 1.6); net(-12, -8, -10, -8, L1, L1 + 1.6);
box(-2, L2 - 0.3, -12, 2, L2, -8, 'netfloor');
net(-2, -12, 2, -12, L2, L2 + 1.6); net(-2, -8, 2, -8, L2, L2 + 1.6);

/* ---------- slides ---------- */
function slideRamp(x0, z0, x1, z1, ya, yb) {
    ramp(x0, z0, x1, z1, 'x', ya, yb, 0.3, 'slide');
    ramp(x0, z0 - 0.15, x1, z0, 'x', ya + 0.45, yb + 0.45, 0.5, 'slide', { noNav: true });
    ramp(x0, z1, x1, z1 + 0.15, 'x', ya + 0.45, yb + 0.45, 0.5, 'slide', { noNav: true });
}
slideRamp(10, -12, 17, -9.5, L2, 0.3);            // from D's second level into the little pit
slideRamp(-12, 6, -4, 8.5, L1, 0.3);              // from B's first level into the big pit
// the tube slide: from the top of A, down the west wall, covered over
box(-23.4, L3 - 0.3, -6, -20, L3, -4, 'padyellow');
ramp(-23.4, -4, -20.4, 14, 'z', L3, 0.25, 0.3, 'slide');
ramp(-23.6, -4, -23.4, 14, 'z', L3 + 2.0, 2.25, 2.0, 'padblue', { noNav: true });
ramp(-20.4, -4, -20.2, 14, 'z', L3 + 2.0, 2.25, 2.0, 'padblue', { noNav: true });
ramp(-23.6, -4, -20.2, 14, 'z', L3 + 2.2, 2.45, 0.2, 'padred', { noNav: true });

/* ---------- the ball pits ---------- */
function pit(x0, z0, x1, z1, gaps, m) {
    const t = 0.4, h = 0.9;
    const side = (a0, a1, fixed, ax, gs) => {
        let a = a0;
        for (const [g0, g1] of [...gs, [a1, a1]]) { if (g0 > a) ax === 'x' ? box(a, 0, fixed, g0, h, fixed + t, m) : box(fixed, 0, a, fixed + t, h, g0, m); a = g1; }
    };
    side(x0, x1, z0, 'x', gaps.n || []); side(x0, x1, z1 - t, 'x', gaps.s || []);
    side(z0 + t, z1 - t, x0, 'z', gaps.w || []); side(z0 + t, z1 - t, x1 - t, 'z', gaps.e || []);
    decor({ t: 'balls', min: [x0 + t, 0, z0 + t], max: [x1 - t, 0.7, z1 - t] });
}
pit(-6, 0, 8, 14, { n: [[0, 2]], w: [[6, 8.5]], e: [[10, 12]] }, 'padblue');
pit(10.5, -15, 20, -6, { s: [[14, 16]], w: [[-12, -9.5]] }, 'padred');

/* ---------- the toddler corner: foam blocks and a wedge ---------- */
for (const [x, z, s, m] of [[13, -2, 1, 'padred'], [14.2, -2, 1, 'padblue'], [13.6, -2, 0.8, 'padyellow'], [17, 1, 1.2, 'padgreen'], [20, -1.5, 1, 'padpurple'], [21, 2.5, 0.9, 'padred']])
    box(x - s / 2, m === 'padyellow' ? 1 : 0, z - s / 2, x + s / 2, (m === 'padyellow' ? 1 : 0) + s, z + s / 2, m);
ramp(17.5, 3, 20.5, 5, 'x', 0, 1.0, 1.0, 'padyellow');
box(20.5, 0, 3, 22, 1.0, 5, 'padyellow');

/* ---------- the café, behind a net ---------- */
net(12, 6, 12, 8, 0, 3); net(12, 10, 12, 17.5, 0, 3);
for (const [x, z] of [[15, 9], [15, 14], [19, 9], [19, 14]]) {
    box(x - 0.7, 0, z - 0.7, x + 0.7, 0.75, z + 0.7, 'padred');
    for (const [dx, dz] of [[-1.1, 0], [1.1, 0]]) decor({ t: 'vbox', min: [x + dx - 0.25, 0, z + dz - 0.25], max: [x + dx + 0.25, 0.45, z + dz + 0.25], c: '#d8262a' }, { t: 'vbox', min: [x + dx + (dx > 0 ? 0.2 : -0.25), 0.45, z - 0.25], max: [x + dx + (dx > 0 ? 0.25 : -0.2), 0.95, z + 0.25], c: '#d8262a' });
}
box(22.4, 0, 7, 24, 1.1, 15, 'desk');
glow(23.95, 2.0, 8, 24, 3.2, 14, '#f4ead0', true);
for (const z of [9, 13]) light(18, CE - 0.3, z, WARM, 1.0, 9);

/* ---------- lights: strips across the ceiling ---------- */
for (let x = -20; x <= 20; x += 6.5) for (const z of [-14, -7, 0, 7, 14]) if (!(x > 12 && z > 5)) light(x, CE - 0.25, z, STRIP, 1.25, 12);
// and a few under the decks, where it would be dark
for (const [x, z, y] of [[-16, -9, L1 - 0.4], [-16, 9, L1 - 0.4], [-6, -10, L1 - 0.4], [6, -10, L1 - 0.4], [-16, -9, L2 - 0.4]]) light(x, y, z, STRIP, 0.6, 5, false);

/* ---------- edges ---------- */
for (const e of [[-28, -22, -24, 22], [24, -22, 28, 22], [-28, -22, 28, -18], [-28, 18, 28, 22]]) K.clip(e[0], e[1], e[2], e[3], -2, 14);

// the photos' colours, both of them
const PAL = ['#17171a', '#35333b', '#1b268a', '#882224', '#27a54c', '#7f6552', '#47708d', '#db373b', '#b5be1a', '#2c7af1', '#94a783', '#659fc0', '#e8856e', '#8bc3d5', '#d7dee3', '#faffff',
    '#183920', '#1a3865', '#5a352c', '#cd1738', '#25b04d', '#797739', '#1674cc', '#794f8f', '#be9120', '#e3c42d', '#7dcf8d', '#b8959a', '#f1e07f', '#e6f2d1', '#a8aeb4', '#ff6aa0'];

export const SOFTPLAY = {
    id: 'softplay',
    name: 'Tumble Town',
    blurb: 'A soft play centre after closing: padded towers, net bridges, ball pits, a tube slide.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -24, x1: 24, z0: -18, z1: 18, y0: 0, y1: 9.6 },
    ambient: [0.19, 0.19, 0.2],
    bake: { D: 2 },
    sun: { dir: [-0.3, -1, -0.4], color: '#ffffff', i: 0, shadow: false },
    fog: { color: '#2a3036', near: 40, far: 110 },
    far: 120,
    navStep: 3,
    navExtra: [[-16.5, 0, -17.6], [-16.5, L1, -13.4], [-13.25, L1, -6.4], [-13.25, L2, -13.5], [-18.75, L2, -11.5], [-18.75, L3, -5.4], [-21.7, L3, -5], [-21.7, 0.25, 14.6],
        [-18.25, L1, 12.5], [-18.25, L2, 4.5], [-16, L2, 0], [-11, L1, -10], [0, L2, -10], [-8.75, L1, -7.5], [-8.75, L2, -13.5], [9.25, L1, -7.5], [9.25, L2, -13.5]],
    song: 'toybox',
    titleCam: { c: [8, 1.6, 15], r: 1.2, h: 0.25, look: [-6, 2.5, -2], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 18, ink: '#17171a', line: '#faffff', grade: { sat: 1.12, con: 1.04, vig: 0.18, shadow: [0.98, 1.0, 1.04], high: [1.04, 1.02, 0.98] } },
    spawns: [
        [-22, 0, -16], [0, 0, -16.5], [22, 0, -16], [-22, 0, 16], [8, 0, 16], [22, 0, -3], [-17, L1, -12], [-16, L2, -9], [-16, L3, -9],
        [-16, L1, 9], [-16, L2, 9], [-6, L1, -10], [-6, L2, -10], [6, L1, -10], [6, L2, -10], [16, 0, 12]
    ],
    items: [
        ['w:rocket', -16, L3, -12.5], ['w:golf', -16, L2, 0], ['w:tennis', 6, L2, -12.5], ['w:blower', 1, 0.0, 7], ['w:balloon', -14, L1, 12.5], ['w:bat', -6, L2, -12.5],
        ['w:slicer', 18.5, 0, -7.5], ['w:rake', -22, 0, 0], ['w:whip', 22, 0, -12], ['w:pistol', 0, 0, -3], ['w:rc', -21.7, L3, -5],
        ['a:rocket', 18, 0, -16.5], ['a:rocket', -10, 0, 16.5], ['a:golf', -13, L2, 12.5], ['a:tennis', 3.5, L1, -12.5], ['a:blower', 4, 0, 4], ['a:balloon', -2, 0, 11],
        ['a:bat', -3.5, L1, -12.5], ['a:pistol', 22, 0, 16], ['h:kit', -16, 0, -9], ['h:kit', -16, 0, 9], ['h:kit', 6, 0, -10], ['h:kit', 16, 0, 16.5], ['h:kit', -13, L3, -5],
        ['h:kit', 18, 0, -2], ['h:soda', -6, 0, -10], ['h:soda', 0, L2, -11], ['h:soda', -16, L2, -3], ['h:soda', 15, 0, -13], ['h:cake', -18.75, L3, -13],
        ['r:helmet', -16, L2, 2.5], ['r:pads', 7, L1, -12.5], ['r:pads', -22, 0, 16.5], ['r:ring', 18, 0, 3.5], ['p:sauce', -11, L1, -10], ['p:espresso', 22, 0, 9.2],
        ['p:sneakers', -16, L1, 5], ['p:box', 9, L2, -7]
    ]
};

/* BLAST FURNACE: an old ironworks gone green. A rusty blast furnace ringed by three floors of grating,
   hot-blast stoves, a long ore-bunker wall with trees on top, a giant pipe you can run along, and a
   conveyor bridge over the path. Bright midday sun. */
import { kit, ACCENTS, farRing } from './mapkit.js';

const K = kit();
const { box, ramp, stair, rail, decor, light } = K;

/* ---------- ground ---------- */
box(-41, -2, -36, 41, 0, 36, 'grass');
box(-3, 0, -36, 3, 0.05, 36, 'gravel');                   // the path through the middle, like the photo
box(6, 0, -16, 32, 0.05, 12, 'floor');                    // the concrete under the furnace floors
box(3, 0, -2, 6, 0.05, 2, 'gravel');

/* ---------- the furnace and its floors ---------- */
box(16.5, 0, -5.5, 23.5, 28, 1.5, 'rust', { hide: true });
box(8, 5.7, -14, 30, 6, 10, 'grate');                     // first floor (6)
box(12, 11.7, -10, 28, 12, 6, 'grate'); box(23, 11.7, 6, 28, 12, 9, 'grate');           // second (12)
box(15, 17.7, -7, 25, 18, 3, 'grate'); box(21, 17.7, -9.5, 25, 18, -7, 'grate');         // third (18)
box(8, 8.7, -19, 12, 9, -14, 'grate');                    // the pipe landing (9)
for (const [x, z] of [[8.2, -13.7], [8.2, -2], [8.2, 9.4], [14, -13.7], [14, 9.4], [26, -13.7], [26, 9.4], [29.4, -13.7], [29.4, -2], [29.4, 9.4]]) box(x, 0.05, z, x + 0.5, 5.7, z + 0.5, 'paint');
for (const [x, z] of [[12.2, -9.8], [27.4, -9.8], [12.2, 5.4], [27.4, 5.4]]) box(x, 6, z, x + 0.4, 11.7, z + 0.4, 'paint');
for (const [x, z] of [[15.2, -6.8], [24.5, -6.8], [15.2, 2.5], [24.5, 2.5]]) box(x, 12, z, x + 0.3, 17.7, z + 0.3, 'paint');
for (const [x, z] of [[8.2, -18.7], [11.5, -18.7]]) box(x, 0, z, x + 0.3, 8.7, z + 0.3, 'paint');
stair(8, 10, 10.5, 19, 'z', 6, 0, { m: 'grate', sides: 'rail' });            // ground to the first floor
stair(14, 7, 23, 9, 'x', 6, 12, { m: 'grate', sides: 'rail' });              // first to second
stair(13, -9.5, 21, -7.5, 'x', 12, 18, { m: 'grate', sides: 'rail' });       // second to third
stair(9, -14, 11, -10, 'z', 9, 6, { m: 'grate', sides: 'rail' });            // first floor to the pipe
// railings
rail(10.5, 6, 9.88, 30, 10); rail(8, 6, -14, 9, -13.88); rail(11, 6, -14, 30, -13.88); rail(29.88, 6, -14, 30, 10);
rail(8, 6, -14, 8.12, 7); rail(8, 6, 9.5, 8.12, 10);
rail(12, 12, -10, 13, -9.88); rail(21, 12, -10, 28, -9.88); rail(27.88, 12, -10, 28, 9); rail(12, 12, -10, 12.12, 6); rail(12, 12, 5.88, 23, 6); rail(23, 12, 8.88, 28, 9);
rail(15, 18, -7, 15.12, 3); rail(15, 18, 2.88, 25, 3); rail(24.88, 18, -9.5, 25, 3); rail(15, 18, -7.12, 21, -7);
rail(8, 9, -19, 12, -18.88); rail(8, 9, -19, 8.12, -14); rail(11.88, 9, -19, 12, -14);

/* ---------- the stoves, the dust catcher ---------- */
for (const z of [-15, -5, 5]) { box(31.2, 0, z - 2.8, 36.8, 24, z + 2.8, 'rust', { hide: true }); }
box(-15, 0, -31, -9, 14, -25, 'rust', { hide: true });

/* ---------- the walkable pipe ---------- */
box(-22, 8.2, -17.8, 8, 9, -16.2, 'rust', { hide: true });
for (const x of [-15, -6, 2]) box(x, 0, -17.2, x + 0.4, 7.3, -16.8, 'paint');

/* ---------- the ore-bunker wall (west) ---------- */
const pockets = [-24, -14, -4, 6, 16];
let zz = -30;
for (const zc of pockets) {
    box(-30, 0, zz, -22, 9, zc - 1.5, 'wall');
    box(-30, 0, zc - 1.5, -25, 9, zc + 1.5, 'wall'); box(-25, 4.2, zc - 1.5, -22, 9, zc + 1.5, 'wall');
    zz = zc + 1.5;
}
box(-30, 0, zz, -22, 9, 25, 'wall');
box(-22, 8.7, 10, -19.8, 9, 13, 'grate');
stair(-21.8, 13, -19.8, 24, 'z', 9, 0, { m: 'grate', sides: 'rail' });
rail(-19.92, 9, 10, -19.8, 13); rail(-22, 9, 9.88, -19.8, 10);
for (const [x, z] of [[-26, -8], [-27, 12], [-25, -26], [-28, 3]]) box(x - 0.25, 9, z - 0.25, x + 0.25, 12, z + 0.25, 'wood', { hide: true });

/* ---------- the conveyor bridge, from the wall top over the path to the first floor ---------- */
ramp(-22, 7, 8, 9.5, 'x', 9, 6, 0.4, 'grate');
ramp(-22, 6.92, 8, 7, 'x', 10.05, 7.05, 0.08, 'rail', { noNav: true }); ramp(-22, 9.5, 8, 9.58, 'x', 10.05, 7.05, 0.08, 'rail', { noNav: true });
for (const [x, top] of [[-10, 7.4], [-3.6, 6.75], [3.4, 6.05]]) { box(x, 0, 6.9, x + 0.4, top, 7.3, 'paint'); box(x, 0, 9.2, x + 0.4, top, 9.6, 'paint'); }

/* ---------- the pump house (south-west) ---------- */
box(-16, 0, 18, -8, 4, 18.4, 'brick'); box(-16, 0, 25.6, -8, 4, 26, 'brick'); box(-16, 0, 18, -15.6, 4, 26, 'brick');
box(-8.4, 0, 18, -8, 4, 21, 'brick'); box(-8.4, 0, 23, -8, 4, 26, 'brick'); box(-8.4, 2.4, 21, -8, 4, 23, 'brick');
box(-16.3, 4, 17.7, -7.7, 4.4, 26.3, 'paint');
box(-15.4, 0, 18.6, -13, 1.2, 20, 'crate');
box(-7.6, 0, 24.5, -6.4, 1.0, 25.7, 'crate'); box(-6.3, 0, 24.5, -5.1, 2.0, 25.7, 'crate');    // crates up to its roof
light(-12, 3.5, 22, [1, 0.85, 0.6], 1.3, 8);

/* ---------- cover on the ground ---------- */
const container = (x, z, alongX, c) => box(x - (alongX ? 3 : 1.25), 0, z - (alongX ? 1.25 : 3), x + (alongX ? 3 : 1.25), 2.6, z + (alongX ? 1.25 : 3), c);
container(-12, -6, false, 'rust'); container(12, 22, true, 'paint'); container(-34, -12, false, 'rust'); container(24, 26, true, 'rust');
box(23.5, 2.6, 24.8, 26.5, 5.2, 27.2, 'paint');
for (const [x, z] of [[-14, 2], [-14, 6.5]]) box(x - 1.2, 0, z - 1.6, x + 1.2, 1.5, z + 1.6, 'cart');
for (const [x, z, w, d] of [[8, -27, 3, 1.2], [-8, -20, 1.2, 3], [16, 18, 2.4, 1.2], [-6, 30, 3, 1.2], [36, -28, 1.2, 3], [-36, 30, 3, 1.2], [6, -6, 1.2, 2.4]]) box(x - w / 2, 0, z - d / 2, x + w / 2, 1.1, z + d / 2, 'conc2');
for (const [x, z] of [[-34, 18], [36, 18]]) box(x - 1.5, 0, z - 1.5, x + 1.5, 1.2, z + 1.5, 'crate');

/* ---------- edges ---------- */
for (const e of [[-45, -40, -40, 40], [40, -40, 45, 40], [-45, -40, 45, -35], [-45, 35, 45, 40]]) K.clip(...e);

/* ---------- decor ---------- */
decor(
    { t: 'cyl', p: [20, 0, -2], r: 4.2, r2: 3.4, h: 24, m: 'rust', seg: 18, bands: [6, 12, 18, 23.5], bandC: '#3a2418' },
    { t: 'cyl', p: [20, 24, -2], r: 2.2, h: 5, m: 'rust', seg: 12, dome: 0.5 },
    { t: 'cyl', p: [20, 29, -2], r: 0.5, h: 7, c: '#5a5c60', seg: 6 },
    ...[-15, -5, 5].map((z) => ({ t: 'cyl', p: [34, 0, z], r: 3, h: 21, m: 'rust', seg: 16, dome: 0.55, bands: [3, 10, 17] })),
    { t: 'cyl', p: [-12, 0, -28], r: 3, r2: 2.4, h: 14, m: 'rust', seg: 14, dome: 0.8 },
    // pipes: the big hot-blast main, the downcomer, bustle pipes
    { t: 'pipe', a: [-24, 8.1, -17], b: [8.5, 8.1, -17], r: 0.95, m: 'rust', flanges: 6 },
    { t: 'pipe', a: [8.5, 8.1, -17], b: [17, 13, -6], r: 0.95, m: 'rust', flanges: 2 },
    ...[-15, -5, 5].map((z) => ({ t: 'pipe', a: [34, 21.5, z], b: [23.2, 16, -2 + z * 0.2], r: 0.75, m: 'rust', flanges: 3 })),
    { t: 'pipe', a: [20, 26, -2], b: [-12, 16, -28], r: 1.1, m: 'rust', flanges: 5 },
    { t: 'pipe', a: [30, 15, 12], b: [-2, 15, 12], r: 0.45, c: '#6a5a4a', flanges: 4 },
    { t: 'pipe', a: [-2, 15, 12], b: [-2, 0.3, 12], r: 0.45, c: '#6a5a4a' },
    { t: 'pipe', a: [33, 3, 9], b: [33, 3, 30], r: 0.6, m: 'paint', flanges: 4 },
    // the conveyor's roof
    { t: 'vbox', min: [-22, 0, 6.8], max: [8, 0.1, 9.7], c: '#5a6068', shadow: false, ry: 0 },
    // trees: on the wall, along the path, in the corners
    ...[[-26, 9, -8], [-27, 9, 12], [-25, 9, -26], [-28, 9, 3]].map((p, i) => ({ t: 'tree', p, s: 0.9 + i * 0.1 })),
    ...[[-6, 0, -12], [-7, 0, 14], [5, 0, -30], [6, 0, 30], [-18, 0, -32], [-36, 0, -30], [-37, 0, 8], [37, 0, 31], [24, 0, -31], [-20, 0, 31]].map((p, i) => ({ t: 'tree', p, s: 1 + (i % 3) * 0.2 })),
    ...[[-5, 0, -20], [-5.5, 0, 0], [5, 0, 16], [4.5, 0, -22], [-20, 0, -2], [-38, 0, -2], [30, 0, 20], [10, 0, 30], [-30, 0, 32], [38, 0, -10], [-4.5, 0, 22]].map((p) => ({ t: 'shrub', p, s: 1.3 })),
    // lamp posts along the path
    ...[-28, -12, 4, 20].map((z) => ({ t: 'lamp', p: [3.6, 0, z], h: 5.5, ry: Math.PI / 2 })),
    // rails for the ore wagons
    { t: 'vbox', min: [-14.8, 0, -10], max: [-14.65, 0.12, 12], c: '#6a6660' }, { t: 'vbox', min: [-13.35, 0, -10], max: [-13.2, 0.12, 12], c: '#6a6660' },
    // chimneys and sheds in the distance
    { t: 'cyl', p: [90, 0, -60], r: 3, r2: 2, h: 70, c: '#7a5a48', seg: 10, shadow: false },
    { t: 'cyl', p: [-110, 0, 40], r: 2.5, r2: 1.8, h: 55, c: '#8a6a58', seg: 10, shadow: false },
    { t: 'vbox', min: [60, 0, 50], max: [120, 22, 80], c: '#5a6068', shadow: false },
    { t: 'vbox', min: [-140, 0, -90], max: [-80, 16, -60], c: '#6a5a50', shadow: false },
    ...farRing('grass', 41, 600),
    ...[[-60, -50], [-55, 0], [-62, 40], [60, -10], [55, 40], [0, 60], [30, -60], [-30, 62]].map(([x, z], i) => ({ t: 'tree', p: [x, 0, z], s: 1.6 + (i % 3) * 0.3, shadow: false }))
);

const PAL = ['#03050a', '#080a16', '#222629', '#323537', '#3d4044', '#48563c', '#b8cde8', '#484d56', '#585852', '#565c65', '#68764f', '#696462', '#636a75', '#78756e', '#707985', '#88935d',
    '#8d8a80', '#7f8996', '#a2af68', '#5c8ce0', '#8198b3', '#a49f95', '#6597e8', '#8a4a2a', '#80a5d7', '#bdc779', '#76abf1', '#b0643a', '#c5b9aa', '#85b7f1', '#d9d4c6', '#faf5e6'];

export const STEELWORKS = {
    id: 'steelworks',
    name: 'Blast Furnace',
    blurb: 'An old ironworks gone green: grating, pipes and rust in the midday sun.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -40, x1: 40, z0: -35, z1: 35, y0: 0, y1: 30 },
    ambient: [0.06, 0.065, 0.07],
    bake: { D: 1.6, sky: [0.36, 0.44, 0.6], skyLen: 35, bounce: [0.12, 0.13, 0.09] },
    sun: { dir: [-0.72, -0.62, 0.14], color: '#fff3e0', i: 2.6 },
    sky: { top: '#5a8be0', horizon: '#c2d4ec', ground: '#5e6e4a', curve: 0.5, sun: '#fffbea' },
    farProbe: [0.3, 0.32, 0.34],
    fog: { color: '#bccbe0', near: 90, far: 420 },
    far: 500,
    navStep: 5,
    navExtra: [[-9.4, 0, 22], [-6.6, 0, 22], [-12, 0, 22], [12.56, 12, -6.2], [12.56, 12, -8.5]],
    song: 'volcano',
    titleCam: { c: [-2, 4, 26], r: 6, h: 2, look: [14, 14, -6], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 22, ink: '#03050a', line: '#faf5e6', grade: { sat: 1.05, con: 1.04, vig: 0.16, shadow: [0.95, 1.0, 1.06], high: [1.05, 1.02, 0.96] } },
    spawns: [
        [-5, 0, -30], [-5, 0, 32], [0, 0.05, 0], [20, 0.05, 14], [15, 0.05, -20], [-17, 0, 12], [-18, 0, -12], [-35, 0, 0], [38.5, 0, 15], [-26, 9, -20],
        [11, 6, -6], [27, 12, -8], [10, 9, -17], [36, 0, -32], [-12, 4.4, 22], [-26, 9, 22]
    ],
    items: [
        ['w:rocket', 20, 18, 2.25], ['w:golf', -26, 9, -28], ['w:tennis', 28, 6, -12], ['w:blower', 12, 0.05, -8], ['w:balloon', -12, 0, 22], ['w:bat', -26, 9, 20],
        ['w:slicer', 0, 0.05, -30], ['w:rake', -35, 0, -20], ['w:whip', 6, 0, 30], ['w:pistol', 0, 0.05, 10], ['w:rc', -26, 9, 0],
        ['a:rocket', 26, 12, 2], ['a:rocket', -34, 0, 22], ['a:golf', -26, 9, -12], ['a:tennis', 20, 0.05, 10.5], ['a:blower', 14, 0, 26], ['a:bat', -18, 0, 28], ['a:balloon', -5, 0, -8], ['a:pistol', 30, 0, -24],
        ['h:kit', 10, 0.05, -14], ['h:kit', -12, 0, 24.5], ['h:kit', -35, 0, 25], ['h:kit', 35, 0, 0], ['h:kit', 26, 12, -8], ['h:kit', 0, 0.05, 30],
        ['h:soda', -6, 9, -17], ['h:soda', -2, 9, -17], ['h:soda', 2, 9, -17], ['h:soda', -14, 9, -17],
        ['h:cake', 17, 18, -6.25],
        ['r:helmet', -26, 9, 8], ['r:pads', 0, 0.05, -18], ['r:pads', 22, 6, 8], ['r:ring', 10, 9, -18],
        ['p:sauce', 23, 18, -6.25], ['p:espresso', -10, 9, -17], ['p:sneakers', -35, 0, 10], ['p:box', 14, 0.05, 0]
    ]
};

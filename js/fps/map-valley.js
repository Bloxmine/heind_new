/* MITTEN JUNCTION: a desert crossroads under a red sandstone butte, in low late-afternoon sun.
   Big and open: roads, a trading post, a water tower, rock outcrops, a mesa and the butte itself,
   with a rock path up its face to a ledge over the junction. Made for big games and vehicles. */
import { kit, ACCENTS, farRing } from './mapkit.js';

const K = kit();
const { box, ramp, stair, rail, decor, light } = K;

/* ---------- ground and roads ---------- */
box(-71, -2, -71, 71, 0, 71, 'sand');
box(-71, 0, -5, 71, 0.08, 5, 'asphalt');                  // the main road, east-west
box(-5, 0, -71, 5, 0.08, -5, 'asphalt');                  // the road north
box(-52, 0, -46, -18, 0.08, -24, 'asphalt');              // the trading post's car park
box(-18, 0, -38, -5, 0.08, -32, 'asphalt');               // its drive
// the corner by the stop sign: a curb and a strip of pavement
box(5, 0, 5, 19, 0.15, 7.5, 'sidewalk');
box(5, 0, 7.5, 7.5, 0.15, 16, 'sidewalk');

/* ---------- the butte ---------- */
// a scree skirt all round (walkable slopes), the sheer butte on top, fluted with buttresses, and its thumb
ramp(20, 4, 50, 20, 'z', 0, 8, 9, 'scree'); ramp(20, 40, 50, 56, 'z', 8, 0, 9, 'scree');
ramp(8, 20, 24, 40, 'x', 0, 8, 9, 'scree'); ramp(46, 20, 62, 40, 'x', 8, 0, 9, 'scree');
for (const [x0, z0, x1, z1] of [[14, 12, 24, 20], [46, 12, 56, 20], [14, 40, 24, 48], [46, 40, 56, 48]]) box(x0, 0, z0, x1, 4.5, z1, 'rock');
box(24, 0, 20, 46, 40, 40, 'rock');
box(26, 40, 22, 42, 42.5, 37, 'rock'); box(30, 42.5, 24, 38, 44, 33, 'rock');
const flutes = [[25.5, 33], [28, 37], [31, 30], [34, 38], [37.5, 26], [40.5, 35], [43.5, 31]];
for (const [x, h] of flutes) { box(x, 4, 19.4, x + 1.1, h, 20, 'rock'); box(x - 0.5, 4, 40, x + 0.7, h - 3, 40.6, 'rock'); }
for (const [z, h] of [[22.5, 34], [26, 28], [30, 37], [34, 31], [37.5, 26]]) { box(23.4, 4, z, 24, h, z + 1.2, 'rock'); box(46, 4, z - 0.6, 46.6, h - 2, z + 0.6, 'rock'); }
box(48, 7, 25, 52.5, 34, 31, 'rock'); box(48.6, 34, 25.8, 51.8, 37, 30, 'rock'); box(46, 7, 27, 48, 21, 29, 'rock');
// a ledge path up the north face, from the skirt to a lookout over the junction
ramp(25, 17.6, 41, 19.4, 'x', 7.2, 14.5, 8, 'rock');
box(41, 6, 15.5, 46, 14.5, 19.4, 'rock');
rail(41, 14.5, 15.5, 46, 15.62, 'rock', 0.7);
box(14, 0, 54, 20, 1.2, 60, 'rock'); box(60, 0, 6, 66, 1.6, 14, 'rock');   // fallen blocks

/* ---------- the small mesa (west) ---------- */
box(-58, 0, 26, -38, 9, 44, 'rock');
box(-56, 9, 28, -42, 9.5, 40, 'rock');
ramp(-38, 30, -26, 34, 'x', 9, 0, 3, 'sand');   // a long sand ramp up the east side
box(-50, 9.5, 32, -48, 10.6, 34, 'rock');      // a little cairn on top for cover

/* ---------- the trading post (north-west) ---------- */
const TP = { x0: -44, x1: -30, z0: -40, z1: -30, h: 4.2 };
box(TP.x0, 0, TP.z0, TP.x1, TP.h, TP.z0 + 0.4, 'adobe');                       // north wall
box(TP.x0, 0, TP.z1 - 0.4, -38, TP.h, TP.z1, 'adobe'); box(-36, 0, TP.z1 - 0.4, TP.x1, TP.h, TP.z1, 'adobe'); box(-38, 2.4, TP.z1 - 0.4, -36, TP.h, TP.z1, 'adobe');   // south wall and door
box(TP.x0, 0, TP.z0, TP.x0 + 0.4, TP.h, TP.z1, 'adobe');                       // west wall
box(TP.x1 - 0.4, 0, TP.z0, TP.x1, TP.h, -36, 'adobe'); box(TP.x1 - 0.4, 0, -34, TP.x1, TP.h, TP.z1, 'adobe'); box(TP.x1 - 0.4, 2.4, -36, TP.x1, TP.h, -34, 'adobe');   // east wall and door
box(TP.x0 - 0.3, TP.h, TP.z0 - 0.3, TP.x1 + 0.3, TP.h + 0.4, TP.z1 + 0.3, 'adobe');   // flat roof
for (const [a, b, c, d] of [[TP.x0 - 0.3, TP.z0 - 0.3, TP.x1 + 0.3, TP.z0], [TP.x0 - 0.3, TP.z1, TP.x1 + 0.3, TP.z1 + 0.3], [TP.x1, TP.z0, TP.x1 + 0.3, TP.z1]]) box(a, TP.h + 0.4, b, c, TP.h + 1.1, d, 'adobe');
stair(-52, -36, -44.3, -33.5, 'x', 0, TP.h + 0.4, { m: 'wood', sides: 'rail', rail: 'wood' });
box(-42, 0, -39.4, -38, 1.0, -38.4, 'wood');                                 // the counter
box(-34, 0, -39.4, -31, 1.8, -38.6, 'crate'); box(-34, 1.8, -39.2, -32, 2.6, -38.6, 'crate');
light(-37, 3.6, -35, [1, 0.78, 0.5], 1.4, 9);
// a porch roof over the south door
box(-40, 2.9, -30, -34, 3.1, -27.5, 'wood');
for (const x of [-39.8, -34.2]) box(x - 0.12, 0, -27.7, x + 0.12, 2.9, -27.5, 'wood');

/* ---------- the water tower (west) ---------- */
for (const [x, z] of [[-55, 8], [-49.3, 8], [-55, 13.7], [-49.3, 13.7]]) box(x, 0, z, x + 0.3, 6, z + 0.3, 'paint');
box(-55.5, 6, 7.5, -48.5, 6.3, 14.5, 'grate');
stair(-54, -1.5, -52, 7.5, 'z', 0, 6.3, { m: 'grate', sides: 'rail' });
rail(-55.5, 6.3, 7.5, -54, 7.6); rail(-52, 6.3, 7.5, -48.5, 7.6); rail(-55.5, 6.3, 14.4, -48.5, 14.5); rail(-55.5, 6.3, 7.5, -55.4, 14.5); rail(-48.6, 6.3, 7.5, -48.5, 14.5);
box(-53.6, 6.3, 9.4, -50.4, 10.5, 12.6, 'paint', { hide: true });
decor({ t: 'cyl', p: [-52, 6.3, 11], r: 2.2, h: 4.3, m: 'paint', seg: 14, r2: 2.2, dome: 0.3 });

/* ---------- the picnic shelter (north-east of the junction) ---------- */
for (const [x, z] of [[10, -20], [17.7, -20], [10, -14.3], [17.7, -14.3]]) box(x, 0, z, x + 0.3, 3, z + 0.3, 'wood');
box(9.5, 3, -20.5, 18.5, 3.3, -13.5, 'wood');
box(11.5, 0, -18, 16.5, 0.8, -16.3, 'wood'); box(11.5, 0, -19.4, 16.5, 0.45, -18.9, 'wood'); box(11.5, 0, -15.4, 16.5, 0.45, -14.9, 'wood');

/* ---------- rock outcrops and boulders, for cover ---------- */
const rocks = [
    [-20, 18, 6, 4, 3], [-17, 21, 3, 3, 4.5], [-8, 30, 5, 6, 2.2], [3, 40, 7, 5, 3.5], [-28, 55, 6, 8, 4], [-12, 58, 4, 4, 2.5],
    [22, -30, 6, 5, 3], [26, -27, 3, 3, 5], [40, -48, 8, 6, 4], [55, -20, 5, 7, 3], [60, -55, 9, 9, 7], [-25, -10, 4, 3, 1.6],
    [-60, -12, 6, 5, 3.5], [-35, 12, 4, 4, 2], [15, 25, 3, 3, 1.4], [-62, 58, 10, 8, 6], [62, 60, 8, 8, 4], [-5, -45, 3, 4, 2], [12, -55, 5, 4, 2.6]
];
for (const [x, z, w, d, h] of rocks) {
    box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'rock');
    if (h > 2.5) box(x - w / 2 + 0.6, h, z - d / 2 + 0.4, x + w / 2 - 0.9, h + Math.min(2, h * 0.35), z + d / 2 - 0.7, 'rock');
}
// sand drifts against some of them: slopes to run (or drive) up
ramp(-29, 16.5, -23, 19.5, 'x', 0, 3, 2, 'sand');
ramp(13, -32.5, 19, -27.5, 'x', 0, 3, 2, 'sand');
ramp(44, -51, 50, -45, 'x', 4, 0, 3, 'sand');
ramp(-6.5, 38, -0.5, 42, 'x', 0, 3.5, 2, 'sand');
ramp(-37, 52, -31, 58, 'x', 0, 4, 2, 'sand');
// dunes: humps for jumps
for (const [x, z] of [[-40, -15], [30, -12], [-15, 45], [48, -30]]) { ramp(x - 6, z - 2, x, z + 2, 'x', 0, 1.4, 1.4, 'sand'); ramp(x, z - 2, x + 6, z + 2, 'x', 1.4, 0, 1.4, 'sand'); }

/* ---------- parked cars, the RV ---------- */
box(-48, 0, -44, -40.5, 3.2, -41.4, 'paint', { hide: true }); decor({ t: 'car', p: [-44.25, 0.08, -42.7], ry: Math.PI / 2, L: 7.5, W: 2.6, H: 3.2, c: '#e8e2d4', van: true });
box(-26.2, 0, -44, -24.2, 1.5, -39.6, 'paint', { hide: true }); decor({ t: 'car', p: [-25.2, 0.08, -41.8], c: '#a8322a' });
box(20, 0, -3.2, 24.4, 1.5, -1.2, 'paint', { hide: true }); decor({ t: 'car', p: [22.2, 0.08, -2.2], ry: Math.PI / 2, c: '#2a5a8a' });

/* ---------- the edge of the world ---------- */
for (const e of [[-75, -75, -71, 75], [71, -75, 75, 75], [-75, -75, 75, -71], [-75, 71, 75, 75]]) K.clip(...e);
// a ranch fence along the edges
for (let i = -70; i <= 70; i += 10) for (const [x, z] of [[i, -70.5], [i, 70.5], [-70.5, i], [70.5, i]]) decor({ t: 'vbox', min: [x - 0.1, 0, z - 0.1], max: [x + 0.1, 1.4, z + 0.1], c: '#7a5a40' });

/* ---------- details ---------- */
decor(
    { t: 'stop', p: [7, 0.15, 6.5], ry: Math.PI * 0.75 },
    { t: 'sign', p: [-7, 0, -14], ry: 0, c: '#2a6a3a', w: 1.6, sh: 0.7 },
    { t: 'sign', p: [-12, 0, -29], ry: Math.PI / 2, c: '#8a4a2a', w: 2.2, sh: 0.9, h: 2.2 },
    // markings: the dashed centre line, the stop line, painted arrows and blocks, like the photo
    ...Array.from({ length: 28 }, (_, i) => ({ t: 'decal', p: [-68 + i * 5, 0.08, 0], w: 2.4, d: 0.14, c: '#e8dcae' })).filter((d) => Math.abs(d.p[0]) > 6),
    ...Array.from({ length: 13 }, (_, i) => ({ t: 'decal', p: [0, 0.08, -68 + i * 5], w: 0.14, d: 2.4, c: '#e8dcae' })).filter((d) => d.p[2] < -7),
    { t: 'decal', p: [0, 0.08, -6], w: 10, d: 0.4, c: '#ecebe4' },
    { t: 'decal', p: [8.5, 0.08, -2.8], w: 3.6, d: 0.3, c: '#ecebe4' },
    ...[-2.6, 2.6].map((x) => ({ t: 'decal', p: [x, 0.08, 3], w: 1.3, d: 0.8, c: '#d8c8a0' })),
    { t: 'decal', p: [12, 0.08, 2.5], w: 0.5, d: 3.2, shape: 'arrow', ry: Math.PI / 2, c: '#ecebe4' },
    { t: 'decal', p: [-12, 0.08, -2.5], w: 0.5, d: 3.2, shape: 'arrow', ry: -Math.PI / 2, c: '#ecebe4' },
    { t: 'decal', p: [2.5, 0.08, -14], w: 0.5, d: 3.2, shape: 'arrow', ry: Math.PI, c: '#ecebe4' },
    ...[[-45, -45], [-42, -45], [-39, -45], [-36, -45], [-33, -45]].map(([x, z]) => ({ t: 'decal', p: [x + 1.5, 0.08, z + 2.5], w: 0.12, d: 5, c: '#ecebe4' })),
    // power poles along the main road
    ...[-60, -40, -20, 20, 40, 60].map((x, i, a) => ({ t: 'pole', p: [x, 0, -7.5], h: 8, to: i < a.length - 1 ? [a[i + 1], 0, -7.5] : null })),
    // desert scrub
    ...[[9, 13], [11, 12], [30, 8], [-14, 9], [-22, 28], [-31, 22], [5, 22], [18, -10], [26, -18], [-10, -20], [-28, -18], [33, -38], [-40, 2], [-50, -8],
        [45, 0], [58, 30], [62, 10], [-15, 50], [0, 60], [-48, 50], [35, 58], [-62, -35], [-58, -60], [50, -62], [-25, -55], [10, -38]].map(([x, z], i) => ({ t: 'shrub', p: [x, 0, z], s: 0.8 + (i % 4) * 0.25, cols: ['#6e7a44', '#7f8a4e', '#5e6a3a'] })),
    ...[[12, 14], [-18, 26], [6, 30], [-36, -4], [24, -8], [40, -20], [-44, 18], [-8, -36], [52, 48], [-54, -20]].map(([x, z]) => ({ t: 'grass', p: [x, 0, z], c: '#9a8a52' })),
    // the far desert, and mesas on the horizon
    ...farRing('sand', 71, 900),
    { t: 'mesa', p: [-260, 0, 140], w: 110, d: 40, h: 34, layers: 3, skirt: 2, far: true, seed: 3 },
    { t: 'mesa', p: [-120, 0, 330], w: 40, d: 30, h: 70, layers: 6, skirt: 3, far: true, seed: 5, spire: [24, 0, 7, 58] },
    { t: 'mesa', p: [60, 0, 380], w: 46, d: 34, h: 78, layers: 7, skirt: 3, far: true, seed: 7 },
    { t: 'mesa', p: [300, 0, 160], w: 160, d: 50, h: 26, layers: 2, skirt: 2, far: true, seed: 9 },
    { t: 'mesa', p: [280, 0, -200], w: 60, d: 40, h: 46, layers: 4, skirt: 3, far: true, seed: 11 },
    { t: 'mesa', p: [-300, 0, -220], w: 200, d: 60, h: 22, layers: 2, skirt: 2, far: true, seed: 13 },
    { t: 'mesa', p: [-40, 0, -400], w: 260, d: 60, h: 18, layers: 2, skirt: 1, far: true, seed: 17 }
);

// the colours of the photo (32), plus the accents every map keeps
const PAL = ['#281c13', '#593e2b', '#5d5444', '#7a8350', '#b5603e', '#6b5e4d', '#716351', '#8f5f46', '#786956', '#7f725f', '#a67052', '#e7355d', '#917f6a', '#ad845f',
    '#a18f79', '#5d94bc', '#679bc3', '#ac9b87', '#70a1c7', '#77a7cb', '#7facd0', '#caa992', '#84b1d3', '#adafb7', '#8ab6d7', '#91b9d9', '#97bedb', '#9ec2dc',
    '#a5c6df', '#adc8dd', '#b6cbdd', '#d4ebff'];

export const VALLEY = {
    id: 'valley',
    name: 'Mitten Junction',
    blurb: 'A desert crossroads under a sandstone butte. Big, open, low sun.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -71, x1: 71, z0: -71, z1: 71, y0: 0, y1: 45 },
    ambient: [0.03, 0.032, 0.04],
    bake: { D: 1.1, sky: [0.24, 0.32, 0.46], skyLen: 45, bounce: [0.17, 0.09, 0.055] },
    sun: { dir: [-0.25, -0.42, 0.87], color: '#ffdcae', i: 2.5 },
    sky: { top: '#5a92bd', horizon: '#c6d3dc', ground: '#b98c6c', curve: 0.6, sun: '#fff4dc' },
    farProbe: [0.36, 0.3, 0.3],
    fog: { color: '#c3cdd3', near: 110, far: 640 },
    far: 700,
    conquest: {
        flags: [
            { id: 'A', name: 'TRADING POST', x: -37, y: 0, z: -27, r: 9, dy: 6, owner: 0 },
            { id: 'B', name: 'PICNIC SHELTER', x: 14, y: 0, z: -17, r: 8 },
            { id: 'C', name: 'JUNCTION', x: 0, y: 0.08, z: 0, r: 9 },
            { id: 'D', name: 'THE MESA', x: -48, y: 9.5, z: 34, r: 8, dy: 3 },
            { id: 'E', name: 'THE BUTTE', x: 35, y: 5, z: 13, r: 8, dy: 6, owner: 1 }
        ],
        hq: [
            { x: -60, z: -60, spawns: [[-62, 0, -62], [-58, 0, -63], [-63, 0, -57], [-56, 0, -57], [-60, 0, -54], [-54, 0, -61], [-65, 0, -64], [-52, 0, -64]] },
            { x: 40, z: 65, spawns: [[38, 0, 64], [42, 0, 66], [36, 0, 67], [44, 0, 63], [40, 0, 68], [34, 0, 64], [46, 0, 67], [31, 0, 67]] }
        ],
        vehicles: [
            ['van', -50, 0, -63, -2.36, 0], ['buggy', -57, 0, -51, -2.36, 0], ['mower', -46, 0, -57, -2.36, 0], ['cart', -63, 0, -50, -2.36, 0], ['cart', -66, 0, -47, -2.36, 0],
            ['van', 52, 0, 64, 0.5, 1], ['buggy', 28, 0, 63, 0, 1], ['mower', 45, 0, 59, 0.5, 1], ['cart', 22, 0, 66, 0, 1], ['cart', 18, 0, 64, 0, 1],
            ['cart', 2, 0.08, -32, 0, -1], ['cart', -20, 0, 40, 1.2, -1]
        ]
    },
    navStep: 7,
    navExtra: [[-37, 0, -31.4], [-37, 0.08, -28.4], [-31.4, 0, -35], [-28.6, 0.08, -35], [-37, 0, -35]],
    song: 'canyon',
    titleCam: { c: [-14, 4, -16], r: 10, h: 2, look: [34, 16, 30], speed: 0.04 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 20, ink: '#281c13', line: '#f4f0e4', grade: { sat: 1.05, con: 0.96, vig: 0.14, shadow: [0.96, 1.0, 1.06], high: [1.06, 1.0, 0.94] } },
    spawns: [
        [-40, 0.08, -26], [-20, 0.08, -40], [0, 0.08, -60], [20, 0, -40], [45, 0, -60], [62, 0, -30], [64, 0.08, 0], [40, 0, 0.5],
        [-64, 0.08, 0], [-50, 0, 18], [-30, 0, 45], [0, 0, 50], [-10, 0.08, -3], [10, 0.15, 6], [52, 0, 66], [-64, 0, 64]
    ],
    items: [
        ['w:golf', 43, 14.5, 17.5], ['w:rocket', -47, 9.5, 36], ['w:bat', -37, 4.6, -35], ['w:tennis', -52, 6.3, 13], ['w:blower', 20, 0, -17],
        ['w:balloon', 4, 0, 30], ['w:slicer', -36, 0, -33], ['w:whip', 0, 0.08, -40], ['w:rake', -20, 0, 30], ['w:pistol', 15, 0.15, 6.2], ['w:rc', 0, 0.08, -66],
        ['a:golf', 30, 0, 58], ['a:rocket', -44, 9.5, 30], ['a:rocket', 50, 0, -45], ['a:bat', -36, 0.08, -26], ['a:tennis', -50, 0, 6], ['a:blower', 18, 0, -12],
        ['a:balloon', 5, 0, 30], ['a:pistol', -20, 0.08, 0], ['a:golf', -60, 0, -50],
        ['h:kit', -38, 0, -33], ['h:kit', 14, 0, -22], ['h:kit', 30, 0, 2], ['h:kit', -50, 0, 22], ['h:kit', 64, 0, 40], ['h:kit', -6, 0, 62],
        ['h:soda', 0, 0.08, 0], ['h:soda', 2, 0.08, 0], ['h:soda', -2, 0.08, 0], ['h:soda', 0, 0.08, -30], ['h:soda', 30, 0.08, 0],
        ['h:cake', 44.8, 14.5, 17.5],
        ['r:helmet', -54.6, 6.3, 9], ['r:pads', 16, 0, -38], ['r:pads', -12, 0, 30], ['r:ring', -49, 9.5, 30],
        ['p:sauce', 0, 0.08, -20], ['p:espresso', -60, 0.08, -2], ['p:sneakers', 52, 0, 50], ['p:box', -42, 4.6, -32]
    ]
};

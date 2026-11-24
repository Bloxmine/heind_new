/* CHALK CLIFFS: white cliffs over a pebble beach and a turquoise sea. A grassy top with a chapel, a golf
   course, hedgerows, an old bunker and a farm; the cliff with its arch and a sea stack; a stair cut into a
   cleft in the chalk, and a slope down to the beach at the town end. The sea is deep: don't fall in. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, rail, decor, light } = K;
const TOP = 0, BEACH = -26;

/* ---------- the land: the cliff top is one big block, cut by a cleft and a slope ---------- */
box(-76, -30, -66, 76, TOP, -10, 'cliff');
box(-76, -30, -10, -32, TOP, 5, 'cliff');
box(-32, -30, -10, -26, TOP, -4, 'cliff');
box(-26, -30, -10, 40, TOP, 5, 'cliff');
ramp(40, -10, 71, 5, 'x', TOP, BEACH, 30, 'cliff');                    // the slope down to the beach at the town end
box(71, -30, -10, 76, BEACH, 5, 'pebbles');
// the headland, the arch you can walk over, and its outer leg
box(-76, -30, 5, -60, TOP, 12, 'cliff');
box(-76, -9, 12, -62, TOP, 27, 'cliff');
box(-76, -30, 27, -62, TOP, 33, 'cliff');
// buttresses along the cliff face
box(-48, -30, 5, -40, -4, 8.5, 'chalk'); box(-10, -30, 5, -2, TOP, 7.5, 'cliff'); box(18, -30, 5, 26, -2, 9, 'chalk');
// the beach, sloping into the sea
box(-76, -32, 5, 76, BEACH, 24, 'pebbles');
ramp(-76, 24, 76, 34, 'z', BEACH, -28.6, 3, 'pebbles');

/* ---------- the stair in the cleft: six short flights, back and forth ---------- */
for (let k = 0; k < 6; k++) {
    const z1 = 5 - 1.5 * k, z0 = z1 - 1.5, y0 = BEACH + (26 / 6) * k, y1 = BEACH + (26 / 6) * (k + 1);
    // even flights rise towards the west, odd ones towards the east
    if (k % 2 === 0) ramp(-32, z0, -26, z1, 'x', y1, y0, 30, 'chalk', { steps: true });
    else ramp(-32, z0, -26, z1, 'x', y0, y1, 30, 'chalk', { steps: true });
}
// little landings where the flights turn, so the step between one flight and the next isn't a lip
for (let k = 0; k < 5; k++) { const y = BEACH + (26 / 6) * (k + 1), [x0, x1] = k % 2 === 0 ? [-32, -31.4] : [-26.6, -26]; box(x0, y - 0.3, 5 - 1.5 * (k + 2), x1, y, 5 - 1.5 * k, 'chalk'); }
light(-29, -12, 0, [1, 0.85, 0.6], 1.2, 12);

/* ---------- the chapel ---------- */
box(32, TOP, -36, 38, 5, -35.5, 'chalk'); box(32, TOP, -36, 32.5, 5, -24, 'chalk'); box(37.5, TOP, -36, 38, 5, -24, 'chalk');
box(32, TOP, -24.5, 34.2, 5, -24, 'chalk'); box(35.8, TOP, -24.5, 38, 5, -24, 'chalk'); box(34.2, 2.8, -24.5, 35.8, 5, -24, 'chalk');
ramp(31.6, -36.4, 35, -23.6, 'x', 5, 7.4, 0.3, 'slate', { noNav: true }); ramp(35, -36.4, 38.4, -23.6, 'x', 7.4, 5, 0.3, 'slate', { noNav: true });
box(33.5, TOP, -39.5, 36.5, 11, -36, 'chalk');
box(33, TOP, -33, 37, 0.5, -31, 'wood'); box(33, TOP, -29.5, 37, 0.5, -27.5, 'wood');
light(35, 4.2, -30, [1, 0.8, 0.55], 1.2, 9);

/* ---------- the old bunker on the cliff edge ---------- */
box(-18, TOP, -7, -12, 2.6, -6.6, 'conc2'); box(-18, TOP, -7, -17.6, 2.6, -1, 'conc2'); box(-12.4, TOP, -7, -12, 2.6, -3.4, 'conc2');
box(-18, TOP, -1.4, -12, 1.3, -1, 'conc2'); box(-18, 1.9, -1.4, -12, 2.6, -1, 'conc2');                 // a firing slit to the sea
box(-18.3, 2.6, -7.3, -11.7, 3.1, -0.7, 'conc2');
light(-15, 2.2, -4, [0.8, 0.85, 1], 0.8, 6);

/* ---------- the farm ---------- */
box(-56, TOP, -52, -44, 4.5, -51.6, 'wood'); box(-56, TOP, -44.4, -52, 4.5, -44, 'wood'); box(-48, TOP, -44.4, -44, 4.5, -44, 'wood'); box(-52, 3.2, -44.4, -48, 4.5, -44, 'wood');
box(-56, TOP, -52, -55.6, 4.5, -44, 'wood'); box(-44.4, TOP, -52, -44, 4.5, -44, 'wood');
ramp(-56.4, -52.4, -50, -43.6, 'x', 4.5, 7, 0.3, 'slate', { noNav: true }); ramp(-50, -52.4, -43.6, -43.6, 'x', 7, 4.5, 0.3, 'slate', { noNav: true });
box(-54, TOP, -50, -51, 1.6, -48, 'crate'); box(-47, TOP, -50, -45, 1.0, -47, 'crate');
light(-50, 3.8, -48, [1, 0.8, 0.55], 1.0, 8);

/* ---------- hedgerows and walls across the top: cover, with gaps ---------- */
for (const [x0, z0, x1, z1] of [[-64, -36, -40, -34.8], [-34, -36, -8, -34.8], [6, -20, 28, -18.8], [-2, -62, -0.8, -44], [-2, -38, -0.8, -24], [44, -48, 66, -46.8], [-40, -22, -38.8, -12], [48, -24, 49.2, -12]])
    box(x0, TOP, z0, x1, 1.5, z1, 'hedge');
for (const [x0, z0, x1, z1] of [[-30, -52, -18, -51.4], [12, -50, 24, -49.4], [-60, -20, -54, -19.4], [56, -36, 62, -35.4]]) box(x0, TOP, z0, x1, 1.1, z1, 'wall');

/* ---------- the beach: groynes, boats, huts, a lifeguard tower ---------- */
// groynes, with gaps to walk through (bots can't hop them)
for (const x of [-42, -14, 14, 44]) for (const [z0, z1] of [[8, 12.4], [16.6, 30]]) box(x, BEACH, z0, x + 0.6, BEACH + 0.9, z1, 'wood');
box(-22, BEACH, 12, -19.6, BEACH + 1.2, 17, 'paint', { hide: true }); box(4, BEACH, 15, 6.4, BEACH + 1.2, 20, 'paint', { hide: true });
for (let i = 0; i < 5; i++) box(30 + i * 3, BEACH, 6.2, 32.2 + i * 3, BEACH + 2.6, 8.6, 'wood');
for (const [x, z] of [[-2, 15], [1, 15], [-2, 18], [1, 18]]) box(x, BEACH, z, x + 0.3, BEACH + 3, z + 0.3, 'wood');
box(-2.3, BEACH + 3, 14.7, 1.6, BEACH + 3.3, 18.6, 'wood');
ramp(-1.5, 18.6, 0.8, 24, 'z', BEACH + 3.3, BEACH, 0.2, 'wood', { steps: true });

/* ---------- edges: the sea is deadly, invisible walls keep the rest in ---------- */
for (const e of [[-80, -70, -76, 70], [76, -70, 80, 70], [-80, -70, 80, -66], [-80, 60, 80, 64]]) K.clip(e[0], e[1], e[2], e[3], -40, 60);

/* ---------- decor ---------- */
decor(
    // the sea: shallows near the beach, deeper water beyond, out to the horizon
    { t: 'vbox', min: [-80, -27.6, 24], max: [80, -27.3, 60], c: '#3aa6a0', shadow: false },
    { t: 'vbox', min: [-900, -27.7, 60], max: [900, -27.4, 900], c: '#1c6f8c', shadow: false },
    { t: 'vbox', min: [-900, -27.7, 24], max: [-80, -27.4, 60], c: '#2a8a98', shadow: false }, { t: 'vbox', min: [80, -27.7, 24], max: [900, -27.4, 60], c: '#2a8a98', shadow: false },
    { t: 'vbox', min: [-900, -0.6, -900], max: [900, -0.02, -66], m: 'grass', shadow: false },
    // the sea stack
    { t: 'vbox', min: [-52, -30, 42], max: [-46, -6, 47], m: 'chalk' }, { t: 'vbox', min: [-51.2, -6, 42.8], max: [-47, 1, 46.2], m: 'chalk' }, { t: 'vbox', min: [-50.4, 1, 43.4], max: [-48, 5, 45.6], m: 'chalk' },
    { t: 'vbox', min: [-51.5, 5, 43.6], max: [-47.8, 5.6, 45.4], c: '#6a8a3a' },
    // cliffs running on to the west and east, beyond the map
    { t: 'vbox', min: [-400, -30, -66], max: [-76, 2, 5], m: 'cliff', shadow: false }, { t: 'vbox', min: [-400, 2, -66], max: [-76, 2.4, 4], c: '#6a8a3a', shadow: false },
    { t: 'vbox', min: [76, -30, -66], max: [400, -6, -10], m: 'chalk', shadow: false },
    // the chapel's spire, the golf course, the cliff path
    { t: 'cyl', p: [35, 11, -37.75], r: 1.8, r2: 0.1, h: 5, seg: 4, c: '#4a525c' },
    ...[[12, -40, 9], [-24, -24, 8], [40, -52, 8]].flatMap(([x, z, r]) => [
        { t: 'decal', p: [x, TOP, z], w: r, d: r, c: '#8cc048' },
        { t: 'cyl', p: [x + 1, TOP, z - 1], r: 0.025, h: 2.2, c: '#f0f0f0', seg: 4 },
        { t: 'banner', p: [x + 1.35, TOP + 2.2, z - 1], w: 0.6, h: 0.4, c: '#e8302a' }
    ]),
    ...[[18, -44, 3, 2], [-18, -28, 2.5, 2]].map(([x, z, w, d]) => ({ t: 'decal', p: [x, TOP, z], w, d, c: '#e0cf98' })),
    ...Array.from({ length: 30 }, (_, i) => ({ t: 'decal', p: [-58 + i * 4, TOP, 0.5 + Math.sin(i) * 0.6], w: 2.4, d: 1.2, c: '#b4ab8c' })).filter((d) => d.p[0] < -33 || d.p[0] > -25),
    // fishing boats, beach-hut stripes
    { t: 'car', p: [-20.8, BEACH, 14.5], L: 5, W: 2.4, H: 1.2, c: '#2a5a9a' }, { t: 'car', p: [5.2, BEACH, 17.5], L: 5, W: 2.4, H: 1.2, c: '#c8302a' },
    ...Array.from({ length: 5 }, (_, i) => ({ t: 'vbox', min: [30 + i * 3, BEACH + 1, 8.62], max: [32.2 + i * 3, BEACH + 1.4, 8.64], c: ['#e8302a', '#2a6ad8', '#3ab040', '#f0c020', '#e86aa0'][i] })),
    // trees and bushes on top
    ...[[-66, -60], [-40, -60], [-20, -60], [10, -62], [30, -60], [55, -60], [-62, -30], [66, -30], [-30, -44], [24, -28]].map(([x, z], i) => ({ t: 'tree', p: [x, TOP, z], s: 1 + (i % 3) * 0.25 })),
    ...[[-50, -10], [-35, -26], [5, -10], [20, -30], [52, -40], [-8, -48], [30, -12]].map(([x, z]) => ({ t: 'shrub', p: [x, TOP, z], s: 1.2 })),
    // the town at the far end of the beach
    ...[[90, -18, 8], [96, -8, 10], [104, -20, 7], [112, -6, 9]].map(([x, z, h]) => ({ t: 'vbox', min: [x - 4, -26, z - 4], max: [x + 4, -26 + h, z + 4], c: '#d8d0c0', shadow: false }))
);

const PAL = ['#0f1414', '#222c2c', '#034d56', '#035b63', '#40473c', '#2b415a', '#056874', '#087761', '#656e25', '#057687', '#445f68', '#128d80', '#027ea2', '#636f5a', '#808630', '#56727f',
    '#058abd', '#41988d', '#73837d', '#8e925d', '#3094c5', '#a2a146', '#69869f', '#4f99c5', '#849990', '#7098bd', '#b7a679', '#9fab99', '#bec2b6', '#d3cd9b', '#eae5b8', '#ffffd6'];

export const COAST = {
    id: 'coast',
    name: 'Chalk Cliffs',
    blurb: 'White cliffs, a pebble beach and a long way down to the sea.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -76, x1: 76, z0: -66, z1: 60, y0: -27, y1: 12 },
    killY: -27.4,
    ambient: [0.03, 0.035, 0.04],
    bake: { D: 1.0, sky: [0.26, 0.34, 0.5], skyLen: 45, bounce: [0.1, 0.12, 0.1] },
    sun: { dir: [-0.35, -0.6, -0.72], color: '#fff4e0', i: 2.6 },
    sky: { top: '#2f86d0', horizon: '#c0d8e6', ground: '#1c6f8c', curve: 0.55, sun: '#fffbea' },
    farProbe: [0.35, 0.36, 0.38],
    fog: { color: '#c4d8e4', near: 120, far: 640 },
    far: 700,
    navStep: 7,
    // the turns of the cleft stair, the beach in front of it, and the chapel door
    navExtra: [[-26.4, BEACH, 6.0], [-26.34, BEACH, 4.25], ...Array.from({ length: 6 }, (_, k) => [k % 2 ? -26.34 : -31.66, BEACH + (26 / 6) * (k + 1) - 0.05, 4.25 - 1.5 * k]),
        ...Array.from({ length: 5 }, (_, k) => [k % 2 ? -26.34 : -31.66, BEACH + (26 / 6) * (k + 1), 2.75 - 1.5 * k]), [-25, TOP, -3.25], [35, TOP, -23.2], [35, TOP, -25.2]],
    song: 'coast',
    titleCam: { c: [-36, 3, -8], r: 6, h: 1.5, look: [-66, -8, 26], speed: 0.04 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 20, ink: '#0f1414', line: '#ffffd6', grade: { sat: 1.08, con: 1.0, vig: 0.14, shadow: [0.96, 1.0, 1.04], high: [1.04, 1.02, 0.96] } },
    conquest: {
        flags: [
            { id: 'A', name: 'THE CHAPEL', x: 35, y: TOP, z: -30, r: 9, dy: 6, owner: 1 },
            { id: 'B', name: 'THE GOLF COURSE', x: 4, y: TOP, z: -40, r: 9 },
            { id: 'C', name: 'THE BUNKER', x: -15, y: TOP, z: -4, r: 8, dy: 4 },
            { id: 'D', name: 'THE BEACH', x: 2, y: BEACH, z: 12, r: 10, dy: 5 },
            { id: 'E', name: 'THE ARCH', x: -69, y: TOP, z: 19, r: 7, dy: 4, owner: 0 }
        ],
        hq: [
            { x: -64, z: -56, spawns: [[-66, 0, -58], [-62, 0, -58], [-66, 0, -54], [-60, 0, -55], [-64, 0, -61], [-58, 0, -60], [-68, 0, -62], [-56, 0, -57]] },
            { x: 64, z: 14, spawns: [[64, BEACH, 12], [60, BEACH, 14], [66, BEACH, 18], [58, BEACH, 10], [62, BEACH, 20], [68, BEACH, 10], [56, BEACH, 16], [70, BEACH, 16]] }
        ],
        vehicles: [
            ['van', -58, 0, -50, -2.36, 0], ['buggy', -68, 0, -48, -2.36, 0], ['buggy', -52, 0, -60, -2.36, 0], ['mower', -48, 0, -56, -2.36, 0], ['cart', -70, 0, -54, -2.36, 0],
            ['van', 60, BEACH, 20, 1.57, 1], ['buggy', 52, BEACH, 12, 1.57, 1], ['mower', 70, BEACH, 20, 1.57, 1], ['cart', 66, BEACH, 8, 1.57, 1], ['cart', 54, BEACH, 20, 1.57, 1],
            ['buggy', 8, 0, -30, 0, -1], ['cart', -10, BEACH, 20, 1.57, -1]
        ]
    },
    spawns: [
        [-60, 0, -56], [-30, 0, -50], [0, 0, -56], [30, 0, -50], [60, 0, -56], [-50, 0, -20], [-22, 0, -14], [20, 0, -10], [50, 0, -22], [35, 0, -25.5],
        [-40, BEACH, 15], [-5, BEACH, 10], [25, BEACH, 14], [60, BEACH, 12], [-68, 0, 16], [10, 0, -26]
    ],
    items: [
        ['w:golf', -69, 0, 22], ['w:rocket', 35, 0, -27], ['w:tennis', -50, 0, -48], ['w:blower', -15, 0, -4], ['w:balloon', 2, BEACH, 12], ['w:bat', 20, 0, -40],
        ['w:slicer', -29, BEACH, 8], ['w:rake', -40, 0, -44], ['w:whip', 73, BEACH, -3], ['w:pistol', 0, 0, -20], ['w:rc', 60, BEACH, 16],
        ['a:golf', -66, 0, 8], ['a:rocket', 36, 0, -34], ['a:rocket', -10, BEACH, 12], ['a:tennis', -46, 0, -46], ['a:blower', -15, 0, -9], ['a:balloon', 25, BEACH, 12], ['a:bat', 26, 0, -40], ['a:pistol', -30, 0, -30],
        ['h:kit', -60, 0, -40], ['h:kit', 0, 0, -48], ['h:kit', 44, 0, -40], ['h:kit', -20, BEACH, 10], ['h:kit', 40, BEACH, 12], ['h:kit', -29, -10.8, -0.25],
        ['h:soda', -40, 0, -8], ['h:soda', 10, 0, -8], ['h:soda', 30, 0, -8], ['h:soda', -1, BEACH + 3.3, 16.5],
        ['h:cake', 35, 0, -34.6], ['r:helmet', -15, 0, -5.5], ['r:pads', -50, 0, -28], ['r:pads', 50, BEACH, 15], ['r:ring', -69, 0, 30],
        ['p:sauce', 0, 0, -40], ['p:espresso', 62, -18.4, -3], ['p:sneakers', -36, BEACH, 20], ['p:box', -50, 0, -46]
    ]
};

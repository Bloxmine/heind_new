/* COAL WORKS: a duel map in the shell of an old coal washery. A tall concrete hall with three floors of galleries,
   linked by stairways clad in orange steel with glowing handrails, a grand staircase up the middle to a bridge
   under the skylight, and two trampolines up to the control room and the roof perch. Units are metres. */
import { box, ramp } from './geom.js';

const S = [];          // solids
const RAILS = [];      // glowing handrail strips: [x0,y0,z0, x1,y1,z1]
const LIGHTS = [];     // baked lights: { p:[x,y,z], c:[r,g,b], i, r }
const add = (...a) => { S.push(...a); return a[0]; };
const light = (x, y, z, c, i, r, fix = true) => LIGHTS.push({ p: [x, y, z], c, i, r, fix });
const WARM = [1.0, 0.82, 0.58], COOL = [0.72, 0.84, 1.0], ORANGE = [1.0, 0.42, 0.1], SKY = [0.66, 0.78, 1.0];

/* ---------- the shell ---------- */
add(box(-21, -1, -15, 21, 0, 15, 'floor'));
add(box(-21, 0, -15, -20, 19, 15, 'wall'), box(20, 0, -15, 21, 19, 15, 'wall'));
add(box(-21, 0, -15, 21, 19, -14, 'wall'), box(-21, 0, 14, 21, 19, 15, 'wall'));
// the ceiling, with a skylight over the middle
add(box(-21, 18, -15, 21, 19, -7, 'ceil'), box(-21, 18, 7, 21, 19, 15, 'ceil'), box(-21, 18, -7, -12, 19, 7, 'ceil'), box(12, 18, -7, 21, 19, 7, 'ceil'));
for (const x of [-8, -4, 0, 4, 8]) add(box(x - 0.15, 17.6, -7, x + 0.15, 18.4, 7, 'steel'));
for (const z of [-3.5, 0, 3.5]) add(box(-12, 18.1, z - 0.1, 12, 18.4, z + 0.1, 'steel'));

/* ---------- floors ---------- */
// first floor galleries (top at 5)
add(box(-20, 4.5, -14, 20, 5, -8, 'slab'), box(-20, 4.5, -8, -14, 5, 14, 'slab'), box(14, 4.5, -8, 20, 5, 14, 'slab'), box(-14, 4.5, 8, -6, 5, 14, 'slab'));
// second floor (top at 10): west and east balconies, the control room, and the bridge across under the skylight
add(box(-20, 9.5, -14, -14, 10, -0.8, 'slab'), box(-14, 9.5, -14, -8, 10, -11, 'slab'), box(-8, 9.5, -14, 8, 10, -6, 'slab'), box(14, 9.5, -3.2, 20, 10, 14, 'slab'));
add(box(-14, 9.5, -3.2, 14, 10, -0.8, 'grate'));
add(box(-14, 9.0, -3.2, 14, 9.5, -3.0, 'steel'), box(-14, 9.0, -1.0, 14, 9.5, -0.8, 'steel'));
// the roof perch (top at 14), only reachable by trampoline
add(box(-6, 13.6, -14, 6, 14, -11.5, 'grate'));

/* ---------- stairs, clad in orange with a glowing rail on each side ---------- */
// ax 'x' or 'z'; ya is the height at the low-coordinate end. Panels sit just outside the footprint.
function stair(x0, z0, x1, z1, ax, ya, yb, th = 0.5) {
    add(ramp(x0, z0, x1, z1, ax, ya, yb, th, 'stair', { steps: true }));
    const P = 0.16, H = 1.0;
    const sides = ax === 'x' ? [[x0, z0 - P, x1, z0], [x0, z1, x1, z1 + P]] : [[x0 - P, z0, x0, z1], [x1, z0, x1 + P, z1]];
    for (const [a, b, c, d] of sides) {
        add(ramp(a, b, c, d, ax, ya + H, yb + H, th + H, 'orange', { panel: true }));
        // the light strip along the panel's top, and baked lights along it
        const mx = (a + c) / 2, mz = (b + d) / 2;
        if (ax === 'x') RAILS.push([x0, ya + H, mz, x1, yb + H, mz]);
        else RAILS.push([mx, ya + H, z0, mx, yb + H, z1]);
        const len = ax === 'x' ? x1 - x0 : z1 - z0, n = Math.max(2, Math.round(len / 1.7));
        for (let i = 0; i <= n; i++) {
            const t = i / n, y = ya + (yb - ya) * t + H + 0.2;
            const inward = ax === 'x' ? (mz < (z0 + z1) / 2 ? 0.3 : -0.3) : (mx < (x0 + x1) / 2 ? 0.3 : -0.3);
            if (ax === 'x') light(x0 + len * t, y, mz + inward, ORANGE, 0.9, 5, false);
            else light(mx + inward, y, z0 + len * t, ORANGE, 0.9, 5, false);
        }
    }
}
stair(-14, 3.2, -5, 6, 'x', 5, 0);           // S1: ground to the west gallery
stair(5, -6, 14, -3.2, 'x', 0, 5);           // S2: ground to the east gallery
stair(-19.5, -0.8, -16.5, 8, 'z', 10, 5);    // S3: west gallery to the west balcony
stair(16.5, -12, 19.5, -3.2, 'z', 5, 10);    // S4: north gallery to the east balcony
stair(-1.6, -0.8, 1.6, 12.5, 'z', 10, 0, 0.6); // the grand staircase: ground floor to the bridge

/* ---------- railings ---------- */
const rail = (x0, y, z0, x1, z1) => add(box(x0, y, z0, x1, y + 1.05, z1, 'rail'));
// first floor
rail(-14, 5, -8.12, 14, -8);
rail(-14.12, 5, -8, -14, 3.2); rail(-14.12, 5, 6, -14, 8);
rail(-14, 5, 8, -6, 8.12); rail(-6.12, 5, 8, -6, 14);
rail(14, 5, -8, 14.12, -6); rail(14, 5, -3.2, 14.12, 14);
// second floor
rail(-14.12, 10, -11, -14, -3.2); rail(-16.5, 10, -0.92, -14, -0.8);
rail(-14, 10, -11, -8, -10.88);
rail(-8, 10, -11, -7.88, -6); rail(-8, 10, -6.12, 8, -6); rail(7.88, 10, -14, 8, -6);
rail(-14, 10, -3.2, 14, -3.08); rail(-14, 10, -0.92, -1.6, -0.8); rail(1.6, 10, -0.92, 14, -0.8);
rail(14, 10, -0.8, 14.12, 14); rail(14, 10, -3.2, 16.5, -3.08);
// the perch: a gap in the middle to drop back down
rail(-6, 14, -11.62, -1.2, -11.5); rail(1.2, 14, -11.62, 6, -11.5);

/* ---------- columns ---------- */
for (const z of [-4, 1.5, 10]) add(box(-15, 0, z - 0.45, -14.1, 4.5, z + 0.45, 'conc2'));
for (const z of [-1, 5, 11]) add(box(14.1, 0, z - 0.45, 15, 4.5, z + 0.45, 'conc2'));
for (const x of [-8, 0, 8]) add(box(x - 0.45, 0, -8.9, x + 0.45, 4.5, -8, 'conc2'));
add(box(-6.9, 0, 8, -6, 4.5, 8.9, 'conc2'));
add(box(-7.9, 0, -6.9, -7.1, 9.5, -6.1, 'steel'), box(7.1, 0, -6.9, 7.9, 9.5, -6.1, 'steel'));

/* ---------- cover ---------- */
add(box(-10, 0, -5, -8.8, 1.0, -3.8, 'crate'), box(-8.8, 0, -5, -7.6, 1.0, -3.8, 'crate'), box(-9.9, 1.0, -4.9, -8.9, 2.0, -3.9, 'crate'));
add(box(6, 0, 8.6, 8.6, 1.3, 10, 'cart'), box(9.2, 0, 8.6, 11.8, 1.3, 10, 'cart'));
add(box(9, 0, -12.8, 19.5, 1.0, -11.4, 'belt'));
add(box(-19.6, 0, -2, -17.2, 0.8, 2, 'coal'));
add(box(-1.4, 0, 4, 1.4, 1.2, 6, 'crate'));
add(box(6, 0, 1, 7.2, 1.1, 3.4, 'conc2'), box(-9, 0, 5.4, -7, 1.1, 6.6, 'conc2'));
add(box(-19, 5, -6, -17.8, 6, -4.8, 'crate'), box(17.6, 5, 4, 18.8, 6, 5.2, 'crate'));
add(box(-12, 5, -14, -6, 7, -13.4, 'steel'));
add(box(-19.5, 10, -10, -18.3, 11, -8.8, 'crate'), box(18.4, 10, 9, 19.6, 11, 10.2, 'crate'));
add(box(-3, 10, -13.8, 3, 11, -13, 'steel'));

/* ---------- trampolines ---------- */
add(box(-0.8, 0, -5.6, 0.8, 0.3, -4.0, 'tramp', { tramp: { to: [0, 10, -7.4], peak: 15 } }));
add(box(-5.8, 10, -9.3, -4.2, 10.3, -7.7, 'tramp', { tramp: { to: [-3, 14, -12.8], peak: 16.6 } }));

/* ---------- lights ---------- */
for (const [x, z] of [[-16, -10], [16, -10], [-16, 10], [16, 10]]) light(x, 17.2, z, WARM, 1.6, 15);
for (const [x, z] of [[-17, -11], [-6, -11], [6, -11], [17, -11], [-17, 0], [-17, 9], [17, 0], [17, 9], [-10, 11]]) light(x, 4.2, z, COOL, 1.4, 10);
for (const [x, z] of [[-17, -11], [-17, -4], [0, -11], [17, 3], [17, 11], [-11, -12.5]]) light(x, 9.2, z, WARM, 1.2, 9);
for (const [x, z] of [[-17, -8], [17, 6], [0, -12.8]]) light(x, 13.2, z, WARM, 1.3, 10);
for (const [x, z] of [[-7, -3], [7, -3], [-7, 4], [7, 4]]) light(x, 17.4, z, SKY, 1.5, 26, false);
light(19.4, 3, 13.4, [1, 0.15, 0.1], 1.2, 6);
light(-19.4, 8, -13.4, [1, 0.15, 0.1], 1.0, 6);

/* ---------- the rest ---------- */
export const COALWORKS = {
    id: 'coalworks',
    name: 'Coal Works',
    blurb: 'An old coal washery. Three floors, orange stairs, one skylight.',
    solids: S,
    rails: RAILS,
    lights: LIGHTS,
    bounds: { x0: -20, x1: 20, z0: -14, z1: 14, y0: 0, y1: 18 },
    ambient: [0.12, 0.125, 0.14],
    sun: { dir: [-0.42, -1, -0.55], color: '#fff1dc', i: 2.2 },
    skyGlass: [-12, 18.9, -7, 12, 7],
    fog: { color: '#141a22', near: 30, far: 90 },
    song: 'coalworks',
    titleCam: { c: [0, 6, 2], r: 8.5, h: 2.5, look: [0, 7.5, -3] },
    look: { hexes: ['#07090c', '#11151a', '#1c2229', '#2a3139', '#3b434c', '#4f5862', '#66707a', '#808a93', '#9ca5ad', '#bcc3c8', '#dde2e5', '#ffffff',
        '#0f2a28', '#1d4440', '#2f625a', '#4a8078', '#6fa39a', '#2e2a1e', '#4a4330', '#6a5f44', '#8c7d5a', '#ad9e78',
        '#5a2a1e', '#8a3a22', '#c2502a', '#e8783a', '#f2a85a', '#ffd27a', '#1a2a3e', '#2e4660', '#4a6a8a', '#7a9cbc',
        '#3ad0ff', '#ff3a6e', '#b04aff', '#4aff7a', '#ffe23a', '#8e8cc0', '#c4c0e4', '#a8c8e8'], spread: 22, ink: '#07090c', line: '#dde8ee',
        grade: { sat: 0.78, con: 1.1, vig: 0.38, shadow: [0.9, 1.0, 1.04], high: [1.1, 1.02, 0.92] } },
    spawns: [
        [-17, 0, -11], [8, 0, -10], [-17, 0, 6], [17, 0, 12], [-4, 0, 12], [11, 0, -1.5],
        [-17, 5, -11], [17, 5, 10], [-10, 5, 11], [0, 5, -10],
        [-17, 10, -6], [17, 10, 6], [3, 10, -11]
    ],
    // pickups: [type, x, y, z]
    items: [
        ['w:balloon', -11, 0, 10], ['w:blower', -6, 5, -11], ['w:bat', 17, 5, 8], ['w:tennis', 12, 0, 6],
        ['w:rocket', -17, 10, -8], ['w:golf', 17, 10, 8], ['w:slicer', 4, 0, -10.5], ['w:rake', -10, 5, 11.5],
        ['w:whip', 8, 5, -11], ['w:pistol', -8, 0, -11], ['w:rc', 0, 14, -12.9],
        ['a:balloon', -15.5, 0, 12.5], ['a:blower', -2, 5, -12.5], ['a:bat', 17, 5, 12.5], ['a:tennis', 17, 0, 6],
        ['a:rocket', -17, 10, -12.5], ['a:golf', 17, 10, 12.5], ['a:pistol', 17, 0, -2], ['a:rocket', 6, 10, -11],
        ['h:soda', 0, 0, 13.4], ['h:soda', -0.6, 0, 13.4], ['h:soda', 0.6, 0, 13.4],
        ['h:soda', -2, 10, -2], ['h:soda', 2, 10, -2], ['h:soda', -6, 10, -2], ['h:soda', 6, 10, -2],
        ['h:kit', -17, 0, -4], ['h:kit', 17, 0, 0.5], ['h:kit', -15.5, 5, -1], ['h:kit', 15.5, 5, -10.5], ['h:kit', -11, 10, -12.5],
        ['h:cake', 5, 10, -11],
        ['r:pads', -8, 0, 1], ['r:pads', 15.5, 5, 2], ['r:helmet', -17, 10, -3], ['r:ring', 0, 0, 2],
        ['p:sauce', 0, 10, -2], ['p:espresso', 16.5, 0, 9], ['p:sneakers', -17, 5, -2], ['p:box', 0, 0, 8.6]
    ],
    // bot waypoints (feet positions); walking links are worked out from the geometry, special ones are listed
    nodes: [
        [-17, 0, -11], [-8, 0, -11], [0, 0, -11], [8, 0, -10], [17, 0, -9.5], [-17, 0, -4], [-11, 0, -6.5], [-3, 0, -6.5], [0, 0, -4.8],
        [4, 0, -7], [4.4, 0, -4.6], [11, 0, -1.5], [17, 0, -2], [17, 0, 5], [17, 0, 12], [11, 0, 6], [4, 0, 12], [0, 0, 13.3], [-4, 0, 12],
        [-4.4, 0, 4.6], [-10, 0, 10], [-17, 0, 6], [-17, 0, 12], [-6, 0, 0], [3.5, 0, 0.5], [0, 0, 2], [-11, 0, 1], [11, 0, -6],
        [-17, 5, -11], [-8, 5, -11], [0, 5, -10], [8, 5, -11], [18, 5, -12.8], [14.8, 5, -4.6], [15.3, 5, 2], [17, 5, 8], [17, 5, 12.5],
        [-15.6, 5, -5], [-14.8, 5, 4.6], [-18, 5, 8.8], [-17, 5, 12.5], [-10, 5, 11], [-15.4, 5, -1],
        [-18, 10, -1.5], [-17, 10, -8], [-17, 10, -12.5], [-11, 10, -12.5], [-6, 10, -12], [0, 10, -7.4], [-5, 10, -8.5], [4, 10, -11],
        [-13, 10, -2], [0, 10, -1.4], [0, 5, 5.85], [13, 10, -2], [18, 10, -2.4], [17, 10, 4], [17, 10, 12], [0, 10, -10.2],
        [-3, 14, -12.8], [3, 14, -12.8], [0, 14, -12.1]
    ],
    // [from, to] one-way: trampolines and the drop from the perch
    links: [[[0, 0, -4.8], [0, 10, -7.4]], [[-5, 10, -8.5], [-3, 14, -12.8]], [[0, 14, -12.1], [0, 10, -10.2]]]
};

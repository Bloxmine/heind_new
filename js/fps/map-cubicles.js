/* CUBICLE FARM: an open-plan office after hours, under rows of humming ceiling panels. A long low hall of
   cubicles with partitions you can jump onto, and a two-storey east wing round an atrium: reception, a cold
   server room, glass-fronted offices, and upstairs the boss's office, a meeting room and the break room. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, decor, light, glow, slab } = K;
const CEIL = 3.5, UP = 4.0, ROOF = 7.6;
const PANEL = [0.92, 0.95, 0.84], SERVER = [0.5, 0.72, 1.0], DESK = [1.0, 0.8, 0.5];

/* ---------- the shell ---------- */
box(-30, -1, -20, 30, 0, 20, 'officecarpet');
box(-30.5, 0, -20.5, 4, CEIL, -20, 'drywall'); box(4, 0, -20.5, 30.5, 8, -20, 'drywall');
box(-30.5, 0, 20, 4, CEIL, 20.5, 'drywall'); box(4, 0, 20, 30.5, 8, 20.5, 'drywall');
box(-30.5, 0, -20, -30, CEIL, 20, 'drywall'); box(30, 0, -20, 30.5, 8, 20, 'drywall');
// the low hall's ceiling, and the solid block above it that is the upstairs' west wall
box(-30, CEIL, -20, 4, UP, 20, 'ceiltile');
box(-30, UP, -20, 4, 8, 20, 'drywall', { noNav: true });
// the east wing: an upper floor with the atrium and a stairwell cut out of it, and the roof
const ATRIUM = [8, -6, 20, 6], WELL = [4.6, -17, 7, -8];
slab(4, -20, 30, 20, CEIL, UP, 'officefloor', [ATRIUM, WELL]);
box(4, ROOF, -20, 30, 8, 20, 'ceiltile', { noNav: true });

/* ---------- stairs ---------- */
// the grand stair up the atrium's south side, landing on the east gallery
ramp(9, 3.6, 17, 6, 'x', 0, UP, 0.5, 'desk', { steps: true });
box(17, CEIL, 3.6, 20, UP, 6, 'officefloor');
ramp(9, 3.52, 17, 3.6, 'x', 1.05, UP + 1.05, 0.08, 'rail', { noNav: true });
box(17, UP, 3.52, 20, UP + 1.05, 3.6, 'rail');
// the service stair by the west wall, walled off from the hall
ramp(WELL[0], WELL[1], WELL[2], WELL[3], 'z', UP, 0, 0.5, 'desk', { steps: true });
box(4.3, 0, -17, 4.6, UP, -8, 'drywall');
ramp(7, -17, 7.08, -8, 'z', UP + 1.05, 1.05, 0.08, 'rail', { noNav: true });

/* ---------- railings round the atrium upstairs ---------- */
box(8, UP, -6.1, 20, UP + 1.05, -6, 'rail');
box(7.9, UP, -6, 8, UP + 1.05, 6, 'rail');
box(20, UP, -6, 20.1, UP + 1.05, 3.52, 'rail');
box(8, UP, 6, 14, UP + 1.05, 6.1, 'rail');

/* ---------- cubicles ---------- */
// a pod: a spine of partitions along x with n cubicles on each side, opening away from it
const C = 2.7, PH = 1.5;
let cubeN = 0;
function pod(x0, zc, n, sides = [-1, 1]) {
    box(x0 - 0.05, 0, zc - 0.05, x0 + n * C + 0.05, PH, zc + 0.05, 'partition');
    for (const sd of sides) {
        for (let i = 0; i <= n; i++) {
            const x = x0 + i * C;
            box(x - 0.05, 0, sd > 0 ? zc : zc - 2.5, x + 0.05, PH, sd > 0 ? zc + 2.5 : zc, 'partition');
        }
        for (let i = 0; i < n; i++) {
            const xa = x0 + i * C + 0.1, xb = x0 + (i + 1) * C - 0.1, k = cubeN++;
            // the desk along the spine, a monitor on it facing whoever sits there, and the chair
            const z0 = sd > 0 ? zc + 0.05 : zc - 0.8, z1 = sd > 0 ? zc + 0.8 : zc - 0.05;
            box(xa, 0, z0, xb, 0.75, z1, 'desk');
            const xm = xa + 0.9 + (k % 3) * 0.2, mz0 = sd > 0 ? zc + 0.12 : zc - 0.55, mz1 = mz0 + 0.43;
            if (k % 7 !== 3) {
                box(xm - 0.22, 0.75, mz0, xm + 0.22, 1.15, mz1, 'crt');
                const fz = sd > 0 ? mz1 + 0.005 : mz0 - 0.005, on = k % 4 === 1;
                glow(xm - 0.16, 0.81, fz - 0.004, xm + 0.16, 1.08, fz + 0.004, on ? '#6ab0a0' : '#1c2624', !on || k % 8 !== 1);
                if (on) light(xm, 1.0, fz + sd * 0.4, [0.45, 0.8, 0.75], 0.35, 2.2, false);
            }
            if (k % 5 === 2) decor({ t: 'shrub', p: [xb - 0.3, 0.75, (z0 + z1) / 2], s: 0.22, cols: ['#3a5a2a', '#4a6a30'] });
            if (k % 6 === 4) decor({ t: 'lantern', p: [xa + 0.3, 1.25, (z0 + z1) / 2], drop: 0.1, size: 0.08, glow: '#ffe0a0' });
            // the chair, pushed back or left at an angle
            const cz = zc + sd * (1.5 + (k % 3) * 0.2), cx = xm + ((k * 37) % 7 - 3) * 0.08;
            decor({ t: 'cyl', p: [cx, 0, cz], r: 0.04, h: 0.45, c: '#3a3c40', seg: 5 },
                { t: 'cyl', p: [cx, 0.45, cz], r: 0.26, h: 0.08, c: '#2c2a28', seg: 8 },
                { t: 'vbox', min: [cx - 0.22, 0.55, cz + sd * 0.2], max: [cx + 0.22, 1.1, cz + sd * 0.26], c: '#2c2a28' });
        }
    }
}
// the low hall: two columns of pods each side of the long central aisle
for (const zc of [-13.5, -5, 5, 13.5]) for (const x0 of [-28, -14]) pod(x0, zc, 4);
// the east wing: a pod downstairs south, one upstairs north
pod(5.4, 13.5, 2, [1]);
pod(9, -13, 3);
// upstairs, a pod north of the atrium
box(9, UP, -13.05, 9 + 3 * C, UP + PH, -12.95, 'partition');
for (let i = 0; i <= 3; i++) { const x = 9 + i * C; box(x - 0.05, UP, -15.5, x + 0.05, UP + PH, -10.5, 'partition'); }
for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const xa = 9 + i * C + 0.1; box(xa, UP, sd > 0 ? -12.95 : -13.75, xa + C - 0.2, UP + 0.75, sd > 0 ? -12.2 : -13.05, 'desk'); box(xa + 1, UP + 0.75, sd > 0 ? -12.85 : -13.5, xa + 1.44, UP + 1.15, sd > 0 ? -12.42 : -13.07, 'crt'); }

/* ---------- the low hall's furniture ---------- */
// printers, filing cabinets and a water cooler on the strip by the east wing
box(-1.5, 0, -18, 0.3, 1.1, -17, 'crt'); box(1, 0, -18, 2.2, 1.3, -17.2, 'partition');
box(-2, 0, 17, 2, 1.3, 17.6, 'partition');
for (const z of [-9, 9]) { box(-1, 0, z - 0.7, 0.6, 1.3, z + 0.7, 'partition'); }
box(2.6, 0, -0.5, 3.2, 1.25, 0.1, 'crt');
decor({ t: 'cyl', p: [2.9, 1.25, -0.2], r: 0.17, h: 0.4, c: '#8ab0c8', seg: 8 });
// big plants at the ends of the aisle
for (const [x, z] of [[-29, -2], [-29, 2], [-1, -2.3], [-1, 2.3]]) { box(x - 0.35, 0, z - 0.35, x + 0.35, 0.5, z + 0.35, 'planter'); decor({ t: 'shrub', p: [x, 0.5, z], s: 0.7, cols: ['#2e4a22', '#3e5a2a'] }); }
// columns along the edge of the east wing
for (const z of [-19, -4, 4, 12]) box(3.7, 0, z - 0.3, 4.3, CEIL, z + 0.3, 'drywall');

/* ---------- the server room (north-east, downstairs) ---------- */
box(20, 0, -20, 20.3, CEIL, -12.4, 'drywall'); box(20, 0, -10.6, 20.3, CEIL, -8, 'drywall'); box(20, 2.4, -12.4, 20.3, CEIL, -10.6, 'drywall');
box(20.3, 0, -8.3, 24, CEIL, -8, 'drywall'); box(25.8, 0, -8.3, 30, CEIL, -8, 'drywall'); box(24, 2.4, -8.3, 25.8, CEIL, -8, 'drywall');
for (const z of [-17.6, -14.4, -11.2]) {
    box(22, 0, z, 28.6, 2.2, z + 0.7, 'rack');
    glow(22.2, 2.0, z - 0.01, 28.4, 2.04, z + 0.71, '#3ad0ff', true);
    for (const x of [23.5, 27]) light(x, 3.2, z + 1.6, SERVER, 0.9, 6);
}
glow(29.9, 1.0, -16, 29.98, 1.8, -13, '#ff3a2a');           // a red status board on the back wall

/* ---------- reception, under the atrium ---------- */
box(12, 0, -2.6, 16, 1.1, -2, 'desk'); box(15.4, 0, -2, 16, 1.1, 1, 'desk');
box(13, 0.75, -2, 14.2, 1.15, -1.6, 'crt');
glow(19.92, 3.56, -3, 20.0, 3.94, 3, '#ffb43a');               // the company sign over the atrium (on the gallery's front)
for (const [x, z] of [[9, -5], [9, 5.2], [19, -5]]) { box(x - 0.4, 0, z - 0.4, x + 0.4, 0.55, z + 0.4, 'planter'); decor({ t: 'tree', p: [x, 0.55, z], s: 0.55, cols: ['#2e4a22', '#3e5a2a', '#2a4020'] }); }
// sofas in the lobby
box(21, 0, -6, 21.9, 0.8, -2, 'partition'); box(21, 0, 2, 21.9, 0.8, 6, 'partition');
// the lifts on the east wall, and vending machines in the corner
glow(29.95, 0, -2.4, 30, 2.4, -0.6, '#8a8c88', true); glow(29.95, 0, 0.6, 30, 2.4, 2.4, '#8a8c88', true);
glow(29.9, 2.55, -1.6, 29.95, 2.75, -1.4, '#ffb43a'); glow(29.9, 2.55, 1.4, 29.95, 2.75, 1.6, '#3aff6a');
for (const x of [5.5, 7]) { box(x, 0, -19.9, x + 1.2, 1.9, -19.1, 'steel'); glow(x + 0.15, 0.7, -19.11, x + 1.05, 1.75, -19.09, x < 6 ? '#ff6a4a' : '#5ab0ff'); }
light(6.6, 1.4, -18.4, [1, 0.55, 0.45], 0.6, 4, false);

/* ---------- glass-fronted offices (south-east, downstairs) ---------- */
// a wall of glass: a low sill, posts and a header, with gaps for doors. ax 'x' runs along x at z = at
function glassWall(ax, at, a0, a1, y, doors) {
    const B = (u0, y0, u1, y1) => (ax === 'x' ? box(u0, y0, at, u1, y1, at + 0.2, 'drywall') : box(at, y0, u0, at + 0.2, y1, u1, 'drywall'));
    B(a0, y + 2.4, a1, y ? ROOF : CEIL);
    let u = a0;
    for (const [d0, d1] of [...doors, [a1, a1]]) {
        // sill and posts from u to d0
        if (d0 > u) {
            B(u, y, d0, y + 1.0);
            for (let p = u; p < d0 - 0.1; p += 2.2) B(p, y + 1.0, p + 0.15, y + 2.4);
            B(d0 - 0.15, y + 1.0, d0, y + 2.4);
        }
        u = d1;
    }
}
glassWall('z', 20, 8.3, 20, 0, [[9, 10.6], [15, 16.6]]);
box(20.2, 0, 14, 30, CEIL, 14.3, 'drywall');
box(20, 0, 8, 30, CEIL, 8.3, 'drywall');
for (const z0 of [9, 15]) {
    box(25, 0, z0 + 1, 27, 0.78, z0 + 2.4, 'wood');
    box(29.4, 0, z0, 30, 1.4, z0 + 2, 'steel');
}

/* ---------- upstairs: the boss's office (north-east) ---------- */
box(22, UP, -20, 22.3, ROOF, -14.6, 'drywall'); box(22, UP, -13.2, 22.3, ROOF, -12, 'drywall'); box(22, UP + 2.4, -14.6, 22.3, ROOF, -13.2, 'drywall');
glassWall('x', -12.2, 22.3, 30, UP, [[24, 25.4]]);
box(25, UP, -18, 28.5, UP + 0.8, -16.6, 'wood');
box(29.4, UP, -19.8, 30, UP + 2.2, -14, 'wood');
glow(29.95, UP + 1.0, -19, 30, UP + 2.8, -16.5, '#1a2436', true);   // a window over the city at night
light(26.5, ROOF - 0.3, -16, DESK, 1.0, 7);

/* ---------- upstairs: the break room (south-east) ---------- */
box(22, UP, 8, 22.3, ROOF, 10.6, 'drywall'); box(22, UP, 12, 22.3, ROOF, 20, 'drywall'); box(22, UP + 2.4, 10.6, 22.3, ROOF, 12, 'drywall');
box(22.3, UP, 8, 30, ROOF, 8.3, 'drywall');
box(29.2, UP, 9, 30, UP + 0.95, 19, 'desk');
box(29.1, UP, 19, 30, UP + 2.1, 19.9, 'steel');
box(24.5, UP, 13, 26.5, UP + 0.76, 15, 'wood');
box(22.4, UP, 18.6, 24, UP + 1.9, 19.9, 'steel'); glow(22.55, UP + 0.6, 18.59, 23.85, UP + 1.8, 18.6, '#3aff6a');
light(26, ROOF - 0.3, 14, DESK, 1.1, 8);

/* ---------- upstairs: the meeting room (south-west) and the lounge ---------- */
glassWall('x', 12, 4, 16, UP, [[11.6, 13]]);
box(16, UP, 12.2, 16.3, ROOF, 20, 'drywall');
box(9, UP, 15, 14.5, UP + 0.75, 17, 'wood');
glow(4.0, UP + 1.0, 14, 4.08, UP + 2.4, 18, '#c4d0e0', true);      // the projector screen
// the lounge on the east gallery: a ping-pong table, sofas
box(24, UP, -3, 27, UP + 0.76, -1.5, 'paint');
box(28.8, UP, 0, 29.8, UP + 0.8, 5, 'partition');
box(23, UP, 4, 27, UP + 0.8, 5, 'partition');

/* ---------- lights ---------- */
for (let x = -27.5; x <= 3; x += 5) for (const z of [-17, -11, -5, 0, 5, 11, 17]) light(x, CEIL - 0.2, z, PANEL, 1.1, 7);
for (const x of [9.5, 15]) for (const z of [-18, -11]) light(x, CEIL - 0.2, z, PANEL, 1.1, 7);
for (const x of [6, 11.5, 17]) for (const z of [10, 17]) light(x, CEIL - 0.2, z, PANEL, 1.1, 7);
for (const z of [-4, 3, 11, 17]) light(25, CEIL - 0.2, z, PANEL, 1.1, 7);
for (const [x, z] of [[10, -3], [18, -3], [10, 3], [18, 3]]) light(x, ROOF - 0.2, z, PANEL, 1.3, 9.5);
for (const [x, z] of [[6, -18.5], [12, -18], [18, -18], [12, -9], [18, -9], [6, 0], [6, 9], [11, 8], [18, 8], [25, -9.5], [25, -4], [25, 3], [10, 16]]) light(x, ROOF - 0.2, z, PANEL, 1.15, 7);
light(5.8, ROOF - 0.2, -12, PANEL, 0.7, 6);
// red exit signs over the doors to the stairs
glow(4.65, 3.1, -7.9, 5.4, 3.4, -7.85, '#ff3a2a'); light(5, 3.0, -7.4, [1, 0.15, 0.1], 0.5, 3, false);

/* ---------- edges ---------- */
for (const e of [[-34, -24, -30, 24], [30, -24, 34, 24], [-34, -24, 34, -20], [-34, 20, 34, 24]]) K.clip(e[0], e[1], e[2], e[3], -2, 12);

// the colours of the photo, plus a few for the plants, the screens and the chairs
const PAL = ['#0b0a09', '#191815', '#24231e', '#2e2c25', '#3a3629', '#3d3a34', '#443f2f', '#41413c', '#4b4534', '#514c3a', '#565143', '#5c5543',
    '#645e4a', '#6f6853', '#7c755f', '#8e8a77', '#a5a191', '#c4c0b0', '#dedbd1', '#fffff4', '#2a3a26', '#3e5a2e', '#1c2624', '#3a6a62', '#6ab0a0',
    '#2a2c30', '#4a4c52', '#6a3a22', '#8a6a3a', '#1a2436', '#3a4a6a', '#b0a888'];

export const CUBICLES = {
    id: 'cubicles',
    name: 'Cubicle Farm',
    blurb: 'An office after hours: cubicles to hop across, a server room, the boss upstairs.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -30, x1: 30, z0: -20, z1: 20, y0: 0, y1: 7.3 },
    ambient: [0.075, 0.075, 0.063],
    bake: { D: 2 },
    sun: { dir: [-0.3, -1, -0.4], color: '#fff4e0', i: 0, shadow: false },
    fog: { color: '#1c1b16', near: 30, far: 90 },
    far: 120,
    navStep: 3,
    navExtra: [[20.2 - 1, 0, -11.5], [21, 0, -11.5], [24.9, 0, -7.3], [24.9, 0, -9], [21.6, UP, -13.9], [23, UP, -13.9], [24.7, UP, -11.5], [24.7, UP, -13],
        [21.6, UP, 11.3], [23, UP, 11.3], [12.3, UP, 11.4], [12.3, UP, 13], [19.4, 0, 9.8], [21, 0, 9.8], [19.4, 0, 15.8], [21, 0, 15.8], [5.8, 0, -7.2], [5.8, UP, -17.8],
        ...[-18.8, -15.65, -12.45, -9.4].flatMap((z) => [[21.1, 0, z], [29.3, 0, z]])],
    song: 'office',
    titleCam: { c: [-24, 1.7, 0], r: 1.2, h: 0.2, look: [10, 1.6, 0], speed: 0.05 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 18, ink: '#0b0a09', line: '#dedbd1', grade: { sat: 0.92, con: 1.06, vig: 0.32, shadow: [0.98, 1.0, 0.96], high: [1.04, 1.03, 0.94] } },
    spawns: [
        [-29, 0, -18.5], [-29, 0, 0], [-29, 0, 18.5], [-15.7, 0, -18.5], [-15.7, 0, 9.5], [-8, 0, 0], [1, 0, -15], [1, 0, 15],
        [12, 0, -17], [25, 0, -15.6], [14, 0, 10], [26, 0, -4], [11, UP, -18.5], [26, UP, -5.5], [12, UP, 9], [27, UP, -15]
    ],
    items: [
        ['w:rocket', 14, 0, 0], ['w:golf', 26.5, UP, -14], ['w:tennis', -21.6, 0, -9.3], ['w:blower', 25, 0, -12.6], ['w:balloon', -8, 0, 18.5], ['w:bat', 11, UP, 18],
        ['w:slicer', -29, 0, -9.2], ['w:rake', 25, UP, 17.5], ['w:whip', -8, 0, -18.5], ['w:pistol', -21.6, 0, 0], ['w:rc', 6, UP, -19],
        ['a:rocket', 25, 0, 12], ['a:rocket', 14, UP, -18.5], ['a:golf', -29, 0, 9.2], ['a:tennis', -15.5, 0, -1.8], ['a:blower', 25, 0, -9.6], ['a:balloon', -2, 0, 9],
        ['a:bat', 18, UP, 10], ['a:pistol', 9, 0, 8], ['h:kit', -15.5, 0, 18.5], ['h:kit', -15.5, 0, -18.5], ['h:kit', 21, 0, 0], ['h:kit', 25, UP, -6.8], ['h:kit', 9, UP, 9],
        ['h:kit', -29, 0, -18.5], ['h:soda', -3, 0, -1.8], ['h:soda', -3, 0, 1.8], ['h:soda', 6, 0, 18.5], ['h:soda', 24, UP, 10], ['h:cake', 27, UP, 12],
        ['r:helmet', 28, 0, -9.6], ['r:pads', -22, 0, 18.5], ['r:pads', 12.5, UP, -7], ['r:ring', 26.5, UP, -18.8],
        ['p:sauce', 13, UP, -11], ['p:espresso', -29, 0, -5], ['p:sneakers', 6, 0, -5], ['p:box', 23, 0, 18.6]
    ]
};

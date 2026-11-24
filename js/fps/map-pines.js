/* BLACK PINES: a snowy pine forest on a mountainside at night, under low cloud lit from below by a town in
   the valley. Packed-snow logging roads loop through the trees past a ranger's cabin, a logging yard, a
   frozen lake with ice-fishing huts, a snowplough depot, and a ridge with a fire lookout tower. A Conquest
   map: big, dark under the trees, lit only where people work. */
import { kit, ACCENTS } from './mapkit.js';

const K = kit();
const { box, ramp, stair, decor, light, glow } = K;
const SODIUM = [1.0, 0.6, 0.28], WARM = [1.0, 0.72, 0.42], FIRE = [1.0, 0.45, 0.16];
const RIDGE = 7;

// everything that's ground, so trees can be stood on it; and the spots trees must keep clear of
const TERR = [], CLEAR = [];
const keep = (x0, z0, x1, z1) => CLEAR.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
const ground = (x0, z0, x1, z1, y) => { TERR.push({ x0, z0, x1, z1, y }); };
const slope = (x0, z0, x1, z1, ax, ya, yb, th, m) => { ramp(x0, z0, x1, z1, ax, ya, yb, th, m); TERR.push({ x0, z0, x1, z1, ax, ya, yb }); };
function heightAt(x, z) {
    let h = 0;
    for (const t of TERR) {
        if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue;
        if (t.ax == null) h = Math.max(h, t.y);
        else { const k = t.ax === 'x' ? (x - t.x0) / (t.x1 - t.x0) : (z - t.z0) / (t.z1 - t.z0); h = Math.max(h, t.ya + (t.yb - t.ya) * k); }
    }
    return h;
}

/* ---------- the land ---------- */
box(-70, -3, -70, 70, 0, 70, 'snow');
// banks of forest rising at the north, east and west edges; the south side drops away to the valley
slope(-70, 62, 70, 70, 'z', 0, 5, 6, 'hill');
slope(62, -70, 70, 62, 'x', 0, 5, 6, 'hill');
slope(-70, -70, -62, 62, 'x', 5, 0, 6, 'hill');
// the ridge in the north-east, with three ways up
box(18, 0, 10, 50, RIDGE, 42, 'hill'); ground(18, 10, 50, 42, RIDGE);
slope(6, 18, 18, 30, 'x', 0, RIDGE, 8, 'hill');
slope(28, -2, 40, 10, 'z', 0, RIDGE, 8, 'hill');
slope(26, 42, 38, 52, 'z', RIDGE, 0, 8, 'hill');
keep(4, 16, 20, 32); keep(26, -4, 42, 12); keep(24, 40, 40, 54);
// rocks along the ridge's edges for cover up there
for (const [x0, z0, x1, z1, h] of [[19, 34, 22, 38, 1.6], [46, 12, 49, 15, 1.4], [24, 12, 26.5, 14, 1.2], [44, 38, 48, 41, 1.8]]) box(x0, RIDGE, z0, x1, RIDGE + h, z1, 'snowrock');

/* ---------- roads: packed snow with tyre ruts ---------- */
const ROADS = [
    [-57, -66, -51, -30], [-57, -30, 36, -24], [30, -24, 36, -2], [-46, -24, -40, 53], [-46, 53, 58, 59], [29, 52, 35, 53]
];
for (const [x0, z0, x1, z1] of ROADS) {
    box(x0, 0, z0, x1, 0.06, z1, 'snowroad');
    keep(x0 - 2.5, z0 - 2.5, x1 + 2.5, z1 + 2.5);
    const alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0, c = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2, m = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
    for (const o of [-1.6, -0.6, 0.6, 1.6]) decor({ t: 'decal', p: alongX ? [m, 0.06, c + o] : [c + o, 0.06, m], w: alongX ? L - 1 : 0.28, d: alongX ? 0.28 : L - 1, c: '#6e787c' });
}

/* ---------- A: the ranger's cabin ---------- */
const CB = { x0: -46, x1: -38, z0: -44, z1: -38, h: 3 };
// north wall (to the road): door and a window
box(CB.x0, 0, CB.z1 - 0.4, -43, CB.h, CB.z1, 'logwall'); box(-43, 2.2, CB.z1 - 0.4, -41.6, CB.h, CB.z1, 'logwall');
box(-41.6, 0, CB.z1 - 0.4, -40, CB.h, CB.z1, 'logwall'); box(-40, 0, CB.z1 - 0.4, -38.8, 1, CB.z1, 'logwall'); box(-40, 2, CB.z1 - 0.4, -38.8, CB.h, CB.z1, 'logwall');
box(-38.8, 0, CB.z1 - 0.4, CB.x1, CB.h, CB.z1, 'logwall');
// south wall: a window
box(CB.x0, 0, CB.z0, -42, CB.h, CB.z0 + 0.4, 'logwall'); box(-42, 0, CB.z0, -40.6, 1, CB.z0 + 0.4, 'logwall'); box(-42, 2, CB.z0, -40.6, CB.h, CB.z0 + 0.4, 'logwall');
box(-40.6, 0, CB.z0, CB.x1, CB.h, CB.z0 + 0.4, 'logwall');
// west wall with the chimney, east wall with a window
box(CB.x0, 0, CB.z0 + 0.4, CB.x0 + 0.4, CB.h, CB.z1 - 0.4, 'logwall');
box(CB.x1 - 0.4, 0, CB.z0 + 0.4, CB.x1, CB.h, -41.6, 'logwall'); box(CB.x1 - 0.4, 0, -41.6, CB.x1, 1, -40.2, 'logwall'); box(CB.x1 - 0.4, 2, -41.6, CB.x1, CB.h, -40.2, 'logwall');
box(CB.x1 - 0.4, 0, -40.2, CB.x1, CB.h, CB.z1 - 0.4, 'logwall');
box(-47.2, 0, -42, -46, 5.4, -40.4, 'snowrock');
// a snowy gable roof, a porch on the road side, a woodpile
ramp(CB.x0 - 0.6, CB.z0 - 0.6, CB.x1 + 0.6, -41, 'z', CB.h, 4.6, 0.3, 'hill', { noNav: true });
ramp(CB.x0 - 0.6, -41, CB.x1 + 0.6, CB.z1 + 0.6, 'z', 4.6, CB.h, 0.3, 'hill', { noNav: true });
box(-44.5, 0, -38, -39.5, 0.25, -36.4, 'wood');
box(-36.6, 0, -44, -35, 1.3, -41, 'wood');
box(-45.4, 0, -43.4, -43.2, 0.7, -42.4, 'wood'); box(-41, 0, -42.4, -39.4, 0.8, -40.8, 'wood');
glow(-45.62, 0.25, -41.8, -45.55, 0.95, -40.6, '#ff8a3a');
light(-44.8, 0.9, -41.2, FIRE, 1.2, 6, false);
light(-42, 2.6, -41, WARM, 1.2, 7, false);
light(-42.3, 2.7, -37.5, WARM, 1.0, 8);
keep(-50, -48, -33, -34);

/* ---------- B: the logging yard ---------- */
// the sawmill: an open shed on posts, its saw bench, and a log on the bench
for (const x of [40, 48]) for (const z of [-52, -44]) box(x - 0.15, 0, z - 0.15, x + 0.15, 4.3, z + 0.15, 'wood');
ramp(39.4, -52.6, 48.6, -48, 'z', 4.2, 5.4, 0.25, 'corrugated', { noNav: true });
ramp(39.4, -48, 48.6, -43.4, 'z', 5.4, 4.2, 0.25, 'corrugated', { noNav: true });
box(41.5, 0, -49.2, 46.5, 1.0, -46.8, 'steel');
decor({ t: 'pipe', a: [41, 1.3, -48], b: [47, 1.3, -48], r: 0.3, c: '#5a4030', seg: 8 });
decor({ t: 'cyl', p: [44, 1.0, -47.4], r: 0.7, h: 0.05, c: '#b8bcc0', seg: 16 });
// log piles: three layers of logs, solid underneath
function logs(x, z, len, n = 3) {
    box(x - len / 2, 0, z - 1.4, x + len / 2, n * 0.48, z + 1.4, 'wood', { hide: true });
    for (let l = 0; l < n; l++) for (let i = 0; i < 5 - l; i++) {
        const zz = z - 1.1 + i * 0.55 + l * 0.27, yy = 0.27 + l * 0.47;
        decor({ t: 'pipe', a: [x - len / 2, yy, zz], b: [x + len / 2, yy, zz], r: 0.27, c: ['#5a4030', '#6a4c34', '#4e3828'][(i + l) % 3], seg: 7 });
    }
}
logs(29, -38, 7); logs(29, -46, 7, 2); logs(34, -54, 8); logs(48, -36, 6, 2);
// the log truck, loaded
box(24.5, 0, -51, 27.5, 2.8, -42, 'paint', { hide: true });
decor({ t: 'car', p: [26, 0, -46.5], L: 9, W: 2.8, H: 2.6, c: '#6a2a1e', van: true });
for (const dx of [-0.8, 0, 0.8]) decor({ t: 'pipe', a: [26 + dx, 2.9, -50.5], b: [26 + dx, 2.9, -44], r: 0.3, c: '#5a4030', seg: 7 });
// floodlights on poles
for (const [x, z, ry] of [[38, -34, Math.PI], [50, -46, -Math.PI / 2], [26, -56, 0.4]]) {
    decor({ t: 'lamp', p: [x, 0, z], h: 8, ry, glow: '#ffc070' });
    box(x - 0.15, 0, z - 0.15, x + 0.15, 8, z + 0.15, 'steel', { hide: true });
    light(x - Math.sin(ry) * 1.5, 7.4, z - Math.cos(ry) * 1.5, SODIUM, 1.8, 18);
}
for (const [x, z] of [[44, -38], [45, -37.2], [36.5, -46]]) { box(x - 0.35, 0, z - 0.35, x + 0.35, 0.95, z + 0.35, 'rust', { hide: true }); decor({ t: 'cyl', p: [x, 0, z], r: 0.35, h: 0.95, c: '#3a4a6a', seg: 10 }); }
keep(22, -58, 52, -32);

/* ---------- C: the frozen lake ---------- */
box(-22, 0, -8, 12, 0.05, 18, 'ice');
keep(-24, -10, 14, 20);
// ice-fishing huts, with a lantern each
for (const [x, z, c] of [[-13, 2, '#8a2a1e'], [2, 11, '#2a4a7a'], [4, -3, '#6a6a2a']]) {
    box(x - 1, 0.05, z - 1, x + 1, 2.2, z + 1, 'wood');
    decor({ t: 'vbox', min: [x - 1.15, 2.2, z - 1.15], max: [x + 1.15, 2.45, z + 1.15], c: '#c6ced2' }, { t: 'vbox', min: [x - 1.02, 0.6, z - 1.02], max: [x + 1.02, 1.6, z + 1.02], c });
    decor({ t: 'lantern', p: [x + 1.2, 1.9, z], drop: 0.1, size: 0.1, glow: '#ffc070' });
    light(x + 1.6, 1.6, z, WARM, 0.8, 6, false);
    decor({ t: 'decal', p: [x + 2.4, 0.05, z + 1], w: 0.8, d: 0.8, c: '#1a2a30' });
}
// the jetty out from the south shore, and the boathouse
box(-8, 0.3, -15, -6, 0.5, -3, 'wood');
for (const z of [-14, -11, -8, -5]) for (const x of [-7.9, -6.1]) decor({ t: 'cyl', p: [x, 0, z], r: 0.1, h: 0.8, c: '#4a3a2a', seg: 5 });
box(-17, 0, -17, -10.6, 2.6, -16.6, 'wood'); box(-17, 0, -16.6, -16.6, 2.6, -11, 'wood'); box(-11, 0, -16.6, -10.6, 2.6, -11, 'wood');
ramp(-17.4, -17.4, -13.8, -10.6, 'x', 2.6, 3.6, 0.25, 'hill', { noNav: true }); ramp(-13.8, -17.4, -10.2, -10.6, 'x', 3.6, 2.6, 0.25, 'hill', { noNav: true });
decor({ t: 'car', p: [-13.8, 0, -14], L: 4.2, W: 1.5, H: 0.8, c: '#2a5a6a', ry: 0 });
light(-13.8, 2.3, -13, WARM, 0.9, 7);
// reeds and rocks round the shore
for (const [x, z] of [[-23, 0], [-23, 10], [13, 4], [13, 14], [-18, 19], [6, 19], [-22, -8], [10, -9]]) decor({ t: 'grass', p: [x, 0, z], c: '#5a5a3a', n: 6 });
for (const [x0, z0, x1, z1, h] of [[-26, 4, -24, 7, 1.4], [14, 8, 16.5, 10, 1.2], [-4, 19, -1, 21, 1.5], [12, -12, 14, -10, 1.0]]) box(x0, 0, z0, x1, h, z1, 'snowrock');

/* ---------- D: the snowplough depot ---------- */
const DP = { x0: -30, x1: -20, z0: 32, z1: 46, h: 5 };
box(DP.x0, 0, DP.z0, DP.x1, DP.h, DP.z0 + 0.3, 'corrugated'); box(DP.x0, 0, DP.z1 - 0.3, DP.x1, DP.h, DP.z1, 'corrugated');
box(DP.x1 - 0.3, 0, DP.z0, DP.x1, DP.h, DP.z1, 'corrugated');
box(DP.x0, 0, DP.z0, DP.x0 + 0.3, DP.h, 36, 'corrugated'); box(DP.x0, 0, 42, DP.x0 + 0.3, DP.h, DP.z1, 'corrugated'); box(DP.x0, 4, 36, DP.x0 + 0.3, DP.h, 42, 'corrugated');
box(DP.x0 - 0.3, DP.h, DP.z0 - 0.3, DP.x1 + 0.3, DP.h + 0.3, DP.z1 + 0.3, 'hill');
// a back door, the plough, shelves, drums
box(DP.x1 - 0.3, 0, 38, DP.x1, 2.3, 39.4, 'corrugated', { ghost: true });
box(-28, 0, 37, -22.5, 2.4, 41, 'paint', { hide: true });
decor({ t: 'car', p: [-25.2, 0, 39], L: 5.4, W: 2.4, H: 2.4, c: '#d8a020', van: true, ry: Math.PI / 2 },
    { t: 'vbox', min: [-28.6, 0.1, 36.6], max: [-28.1, 1.0, 41.4], c: '#c8501e' });
box(-21.2, 0, 33, -20.4, 2.2, 37, 'wood'); box(-21.2, 0, 41, -20.4, 2.2, 45, 'wood');
for (const [x, z] of [[-28.5, 33.2], [-27.6, 33.2], [-28.5, 44.8]]) { box(x - 0.35, 0, z - 0.35, x + 0.35, 0.95, z + 0.35, 'rust', { hide: true }); decor({ t: 'cyl', p: [x, 0, z], r: 0.35, h: 0.95, c: '#7a2a1e', seg: 10 }); }
light(-25, 4.6, 35, SODIUM, 1.2, 9); light(-25, 4.6, 43, SODIUM, 1.2, 9);
// the salt heap across the road, fuel tanks, a lamp by the door
slope(-62, 34, -55, 44, 'x', 0, 2.8, 3, 'snow'); slope(-55, 34, -48, 44, 'x', 2.8, 0, 3, 'snow');
for (const z of [30, 34]) { box(-17.6, 0, z - 1.3, -15, 2.8, z + 1.3, 'steel', { hide: true }); decor({ t: 'pipe', a: [-18, 1.4, z], b: [-14.6, 1.4, z], r: 1.3, c: '#8a8c88', seg: 12 }); }
decor({ t: 'lamp', p: [-31.5, 0, 33.5], h: 6, ry: -Math.PI / 2, glow: '#ffc070' });
light(-33, 5.5, 33.5, SODIUM, 1.5, 14);
keep(-64, 28, -12, 50);

/* ---------- E: the fire lookout on the ridge ---------- */
const TW = { x0: 37, x1: 43, z0: 27, z1: 33, top: 13 };
for (const x of [TW.x0, TW.x1 - 0.4]) for (const z of [TW.z0, TW.z1 - 0.4]) box(x, RIDGE, z, x + 0.4, TW.top - 0.4, z + 0.4, 'wood');
box(TW.x0, TW.top - 0.4, TW.z0, TW.x1, TW.top, TW.z1, 'wood');
// two flights up the east side, round a landing
ramp(45.6, 26, 47, 33, 'z', RIDGE, 10, 0.4, 'wood', { steps: true });
box(44.2, 9.6, 33, 47, 10, 34.4, 'wood');
ramp(44.2, 27.6, 45.6, 34.4, 'z', TW.top, 10, 0.4, 'wood', { steps: true });
box(43, TW.top - 0.4, 26.2, 45.6, TW.top, 27.6, 'wood'); box(43, TW.top - 0.4, 27.6, 44.2, TW.top, 29.4, 'wood');
// the cab: low walls, corner posts, a roof; the way in on the east side
box(TW.x0, TW.top, TW.z0, TW.x1, TW.top + 1, TW.z0 + 0.15, 'wood'); box(TW.x0, TW.top, TW.z1 - 0.15, TW.x1, TW.top + 1, TW.z1, 'wood');
box(TW.x0, TW.top, TW.z0, TW.x0 + 0.15, TW.top + 1, TW.z1, 'wood'); box(TW.x1 - 0.15, TW.top, 29.2, TW.x1, TW.top + 1, TW.z1, 'wood');
for (const x of [TW.x0, TW.x1 - 0.15]) for (const z of [TW.z0, TW.z1 - 0.15]) box(x, TW.top + 1, z, x + 0.15, TW.top + 2.6, z + 0.15, 'wood');
box(TW.x0 - 0.6, TW.top + 2.6, TW.z0 - 0.6, TW.x1 + 0.6, TW.top + 2.9, TW.z1 + 0.6, 'hill');
box(39.2, TW.top, 29.2, 40.8, TW.top + 0.9, 30.8, 'wood');
light(40, TW.top + 2.2, 30, WARM, 1.2, 9);
decor({ t: 'lantern', p: [40, TW.top + 2.6, 30], drop: 0.3, size: 0.14, glow: '#ffc070' });
light(42, RIDGE + 2.2, 24, WARM, 0.8, 8, false);
keep(34, 23, 49, 37);

/* ---------- the two headquarters: a camp each ---------- */
for (const [x, z, ry] of [[-38, -66.5, Math.PI / 2], [58, 52, Math.PI / 2]]) {
    const L = 7, W = 2.6;
    if (ry) box(x - L / 2, 0, z - W / 2, x + L / 2, 2.8, z + W / 2, 'paint', { hide: true }); else box(x - W / 2, 0, z - L / 2, x + W / 2, 2.8, z + L / 2, 'paint', { hide: true });
    decor({ t: 'car', p: [x, 0, z], L, W, H: 2.8, c: '#c8c0b0', van: true, ry });
    light(x + (ry ? 0 : 2.5), 2.4, z + (ry ? -2.5 : 0), WARM, 1.0, 9, false);
}
for (const [x, z] of [[-58, -54], [52, 60]]) {
    box(x - 0.6, 0, z - 0.6, x + 0.6, 0.35, z + 0.6, 'snowrock');
    glow(x - 0.3, 0.35, z - 0.3, x + 0.3, 0.6, z + 0.3, '#ff7a2a');
    light(x, 1.0, z, FIRE, 1.6, 9, false);
}
keep(-66, -70, -40, -46); keep(44, 46, 64, 64);

/* ---------- scattered cover: boulders, fallen trunks, an abandoned car ---------- */
for (const [x, z, w, d, h] of [[-30, -14, 3, 2.4, 1.6], [-16, -30, 2.4, 2, 1.3], [12, -24, 3, 2, 1.5], [-56, 0, 2.6, 3, 1.8], [-34, 16, 2, 2.4, 1.4], [-6, 30, 3, 2.2, 1.6],
    [16, 2, 2.4, 2, 1.3], [54, -14, 2.6, 2.4, 1.7], [50, 2, 2, 2.6, 1.4], [-20, 52, 2.8, 2, 1.5], [10, 46, 2.4, 2.4, 1.6], [-56, 24, 2, 2.4, 1.3], [0, -54, 3, 2, 1.4], [-30, -58, 2.4, 2, 1.5]]) {
    box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, 'snowrock');
    keep(x - w / 2 - 1.5, z - d / 2 - 1.5, x + w / 2 + 1.5, z + d / 2 + 1.5);
}
for (const [x0, z0, x1, z1] of [[-26, -40, -19, -38], [4, -46, 11, -44], [-52, 14, -50, 21], [20, -16, 27, -14], [-10, 44, -3, 46], [52, -26, 54, -19]]) {
    box(x0, 0, z0, x1, 0.7, z1, 'wood', { hide: true });
    const alongX = x1 - x0 > z1 - z0;
    decor({ t: 'pipe', a: alongX ? [x0, 0.35, (z0 + z1) / 2] : [(x0 + x1) / 2, 0.35, z0], b: alongX ? [x1, 0.35, (z0 + z1) / 2] : [(x0 + x1) / 2, 0.35, z1], r: 0.36, c: '#3a2c22', seg: 7 });
    decor({ t: 'vbox', min: [x0 + 0.3, 0.6, z0 + 0.25], max: [x1 - 0.3, 0.78, z1 - 0.25], c: '#c6ced2' });
    keep(x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2);
}
box(-2.3, 0, 26.4, 2.3, 1.5, 28.4, 'paint', { hide: true });
decor({ t: 'car', p: [0, 0, 27.4], L: 4.4, W: 1.9, H: 1.5, c: '#3a4a3a', ry: Math.PI / 2 }, { t: 'vbox', min: [-2.1, 1.48, 26.5], max: [2.1, 1.62, 28.3], c: '#c6ced2' });
keep(-4, 24, 4, 31);
// power lines along the road to the yard
for (let i = 0; i < 6; i++) {
    const x = -48 + i * 16;
    decor({ t: 'pole', p: [x, 0, -21.5], h: 8, ry: Math.PI / 2, to: i < 5 ? [x + 16, 0, -21.5] : null });
    box(x - 0.15, 0, -21.65, x + 0.15, 8, -21.35, 'wood', { hide: true });
}

/* ---------- conquest flags, spawns, items: kept clear of trees ---------- */
const FLAGS = [
    { id: 'A', name: 'RANGER CABIN', x: -42, y: 0, z: -35.5, r: 9, dy: 4, owner: 0 },
    { id: 'B', name: 'LOGGING YARD', x: 37, y: 0, z: -42, r: 10, dy: 5 },
    { id: 'C', name: 'FROZEN LAKE', x: -5, y: 0.05, z: 5, r: 10, dy: 3 },
    { id: 'D', name: 'PLOUGH DEPOT', x: -34, y: 0, z: 39, r: 9, dy: 4 },
    { id: 'E', name: 'FIRE LOOKOUT', x: 36, y: RIDGE, z: 22, r: 10, dy: 6, owner: 1 }
];
const SPAWNS = [
    [-54, 0.06, -48], [-42, 0, -33.5], [-24, 0, -46], [6, 0, -38], [22, 0, -54], [44, 0, -30], [10, 0, -14], [-30, 0, -8],
    [-52, 0, 8], [-36, 0, 28], [-12, 0, 40], [12, 0, 32], [20, 0, 50], [44, RIDGE, 18], [28, RIDGE, 36], [54, 0, 56]
];
const ITEMS = [
    ['w:golf', 38.2, TW.top, 28.2], ['w:rocket', -5, 0.05, 6], ['w:tennis', -42, 0, -41], ['w:blower', 44, 0, -44], ['w:balloon', -25, 0, 44], ['w:bat', 30, RIDGE, 20],
    ['w:slicer', -7, 0.5, -10], ['w:rake', 10, 0, -30], ['w:whip', -50, 0, 30], ['w:pistol', -30, 0, -20], ['w:rc', 46, RIDGE, 33.7],
    ['a:golf', 42, RIDGE, 22], ['a:rocket', 34, 0, -32], ['a:rocket', -36, 0, 46], ['a:tennis', -36, 0, -36], ['a:blower', 48, 0, -42], ['a:balloon', -14, 0, 38],
    ['a:bat', 26, RIDGE, 30], ['a:pistol', 0, 0, -20], ['a:golf', -56, 0, -20],
    ['h:kit', -43.5, 0, -40], ['h:kit', 30, 0, -42], ['h:kit', 4, 0.05, 2], ['h:kit', -22, 0, 34], ['h:kit', 40, RIDGE, 14], ['h:kit', -20, 0, -20],
    ['h:soda', -13.8, 0, -12.2], ['h:soda', 8, 0.05, 14], ['h:soda', -15, 0.05, 8], ['h:soda', 20, 0, 0], ['h:soda', -50, 0, -2],
    ['h:cake', 41.5, TW.top, 31.5], ['r:helmet', -21, 0, 39], ['r:pads', 28, 0, -50], ['r:pads', -48, 0, 20], ['r:ring', 22, RIDGE, 40],
    ['p:sauce', -5, 0.05, -4], ['p:espresso', 0, 0, 50], ['p:sneakers', 52, 0, -10], ['p:box', -60, 0, 50]
];
for (const f of FLAGS) keep(f.x - f.r - 2, f.z - f.r - 2, f.x + f.r + 2, f.z + f.r + 2);
for (const [x, , z] of SPAWNS) keep(x - 3, z - 3, x + 3, z + 3);
for (const [, x, , z] of ITEMS) keep(x - 2, z - 2, x + 2, z + 2);

/* ---------- the forest ---------- */
// trees on a jittered grid, thinned by a slow noise into dense stands and clearings; each gets a trunk to bump into
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(1234);
const density = (x, z) => 0.55 + 0.3 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) + 0.2 * Math.sin((x + z) * 0.11);
const clear = (x, z) => CLEAR.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);
const chunks = new Map(), farChunks = new Map();
const addTree = (map, x, y, z, s) => { const k = Math.floor(x / 36) + ',' + Math.floor(z / 36); if (!map.has(k)) map.set(k, []); map.get(k).push([x, y, z, s]); };
for (let gx = -68; gx <= 68; gx += 5.2) for (let gz = -68; gz <= 68; gz += 5.2) {
    const x = gx + (R() - 0.5) * 4, z = gz + (R() - 0.5) * 4, s = 0.8 + R() * 0.55;
    if (R() > density(x, z) || clear(x, z) || Math.abs(x) > 69 || Math.abs(z) > 69) continue;
    const y = heightAt(x, z);
    // not on the ridge's ramps or right at its edge (the trunk would hang off it)
    if (y > 0.05 && y < RIDGE - 0.05 && !(Math.abs(x) > 61 || z > 61)) continue;
    if (y === RIDGE && (x < 19.5 || x > 48.5 || z < 11.5 || z > 40.5)) continue;
    addTree(chunks, x, y, z, s);
    box(x - 0.3, y, z - 0.3, x + 0.3, y + 5 * s, z + 0.3, 'wood', { hide: true });
}
// beyond the edges the forest carries on, without trunks, and down the slope towards the valley
for (let gx = -150; gx <= 150; gx += 7) for (let gz = -108; gz <= 150; gz += 7) {
    const x = gx + (R() - 0.5) * 5, z = gz + (R() - 0.5) * 5;
    if (Math.abs(x) < 72 && z > -72 && z < 72) continue;
    if (R() > 0.6) continue;
    let y = 5;
    if (z < -70) { if (Math.abs(x) < 72 || z < -100) y = Math.max(-30, -(-70 - z) * 0.333); else y = 5 - (-70 - z) * 0.1; }
    if (z < -100 && Math.abs(x) < 120) continue;
    if (z < -70 && x > -58 && x < 14 && R() < 0.92) continue;      // a gap in the trees: the view down to the town
    addTree(farChunks, x, y, z, 0.9 + R() * 0.6);
}
for (const list of chunks.values()) decor({ t: 'pines', trees: list });
for (const list of farChunks.values()) decor({ t: 'pines', trees: list, snow: false, lod: true, shadow: false });

/* ---------- far away: the slope down, the valley, the town, the mountains ---------- */
decor(
    { t: 'vbox', min: [-900, -0.6, 70], max: [900, 4.98, 900], m: 'snow', shadow: false },
    { t: 'vbox', min: [-900, -0.6, -70], max: [-70, 4.98, 70], m: 'snow', shadow: false },
    { t: 'vbox', min: [70, -0.6, -70], max: [900, 4.98, 70], m: 'snow', shadow: false },
    { t: 'vbox', min: [-900, -16, -162.4], max: [900, -15, -67.6], rx: -0.3217, m: 'snow', shadow: false },
    { t: 'vbox', min: [-900, -32, -900], max: [900, -30.5, -158], c: '#101414', shadow: false },
    { t: 'lights', areas: [[-180, -30, -560, 160, -360, 1100], [-60, -30, -360, 40, -260, 260], [-400, -30, -760, -200, -560, 300], [160, -30, -700, 380, -520, 260], [-30, -30, -260, -10, -170, 40]], cols: ['#ffd890', '#ffb060', '#fff0d0', '#ffc878', '#cfe0ff'], size: 1.6, seed: 9 },
    ...[[-260, -40, -300, 190, 230], [300, -40, -300, 210, 220], [-480, -40, -60, 220, 260], [460, -40, 60, 230, 240], [-160, -10, 420, 200, 230], [220, -10, 460, 240, 260], [40, -60, -900, 300, 240]].flatMap(([x, y, z, r, h]) => [
        { t: 'cyl', p: [x, y, z], r, r2: 6, h, seg: 7, c: '#10141a', shadow: false, lit: false },
        { t: 'cyl', p: [x, y + h * 0.72, z], r: r * 0.29, r2: 6.2, h: h * 0.28, seg: 7, c: '#5a6670', shadow: false, lit: false }
    ])
);

/* ---------- edges ---------- */
for (const e of [[-74, -74, -70, 74], [70, -74, 74, 74], [-74, -74, 74, -70], [-74, 70, 74, 74]]) K.clip(e[0], e[1], e[2], e[3], -10, 60);

// the photos' colours: the green-black of the pines at dusk, the grey snow by night, and the town's lamps
const PAL = ['#010201', '#050a08', '#0a1513', '#11221e', '#1a332a', '#28483c', '#3d6157', '#669d94', '#93c8c0',
    '#0d0f0b', '#171915', '#1f211e', '#282b29', '#2f3634', '#353d40', '#3b4549', '#424e52', '#4c585a', '#5e6a6c', '#6e7a7c', '#8a968b', '#a4b1a5', '#bcc6c0', '#d4dcd8', '#eef4f2',
    '#3a2c22', '#5a4030', '#7a5a3c', '#c87a30', '#ffb060', '#ffd890', '#6a2a1e'];

export const PINES = {
    id: 'pines',
    name: 'Black Pines',
    blurb: 'A snowy pine forest at night: logging roads, a frozen lake, a lookout on the ridge.',
    solids: K.S, rails: K.RAILS, lights: K.L, glows: K.GLOWS, decor: K.DECOR,
    bounds: { x0: -70, x1: 70, z0: -70, z1: 70, y0: 0, y1: 18 },
    ambient: [0.028, 0.032, 0.036],
    bake: { D: 1.0, sky: [0.09, 0.104, 0.118], skyLen: 30, bounce: [0.03, 0.034, 0.038] },
    sun: { dir: [0.32, -0.85, 0.42], color: '#8ea6be', i: 0.95 },
    night: true,
    sky: { top: '#090b0d', horizon: '#3c3f3a', ground: '#141816', curve: 0.42 },
    farProbe: [0.05, 0.055, 0.06],
    fog: { color: '#1a1e1f', near: 30, far: 190 },
    far: 900,
    navStep: 7,
    navExtra: [[-42.3, 0, -37], [-42.3, 0, -39.5], [-42, 0, -41], [-31, 0, 39], [-28.5, 0, 39], [38.2, TW.top, 28.1], [43.6, TW.top, 28.1], [44.3, TW.top, 26.9], [46.3, 10, 33.7], [44.9, 10, 33.7], [-7, 0.5, -10], [-7, 0.5, -4]],
    song: 'pines',
    titleCam: { c: [-54, 1.8, -56], r: 1.5, h: 0.3, look: [-40, 0, -200], speed: 0.04 },
    look: { hexes: [...PAL, ...ACCENTS], spread: 20, ink: '#010201', line: '#d4dcd8', grade: { sat: 0.95, con: 1.06, vig: 0.3, shadow: [0.94, 1.02, 1.04], high: [1.04, 1.02, 0.98] } },
    conquest: {
        flags: FLAGS,
        hq: [
            { x: -54, z: -58, spawns: [[-56, 0, -58], [-52, 0, -58], [-56, 0, -55], [-58, 0, -61], [-54, 0, -54], [-60, 0, -56], [-48, 0, -56], [-60, 0, -51]] },
            { x: 54, z: 58, spawns: [[54, 0, 60], [50, 0.06, 56], [56, 0, 62], [48, 0, 61], [52, 0, 63], [56, 0, 56], [46, 0.06, 55], [60, 0, 58]] }
        ],
        vehicles: [
            ['van', -54, 0.06, -42, 0, 0], ['buggy', -46, 0, -60, 0, 0], ['buggy', -46, 0, -54, 0, 0], ['mower', -60, 0, -63, 0, 0], ['cart', -60, 0, -48, 0, 0],
            ['van', 40, 0.06, 56, -1.57, 1], ['buggy', 58, 0, 47, 3.14, 1], ['buggy', 52, 0, 47, 3.14, 1], ['mower', 44, 0, 61, -1.57, 1], ['cart', 40, 0, 61, -1.57, 1],
            ['buggy', -20, 0, -14, 1.57, -1], ['cart', -52, 0, 40, 0, -1]
        ]
    },
    spawns: SPAWNS,
    items: ITEMS
};

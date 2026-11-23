/* Free roam: an open world about 1.6 km across. Downtown in the middle, four areas around it
   (dunes, pine forest, frost peaks, a lighthouse coast), a four-lane ring highway, a railway loop with
   trains, traffic, rival sprints, stunt ramps and sixteen hidden golden ducks. The sky runs a day and
   night cycle and the weather comes and goes, and both change the light.
   The world answers the same query() the race tracks do, so the car physics doesn't know the difference. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel, glows, MAIN_ONLY } from './retro.js';
import { rng, treeTexture } from './textures.js';
import { CARS } from './car.js';
import { RIVALS } from './ai.js';

export const HALF = 800, SIZE = HALF * 2, CELL = 5, GN = SIZE / CELL, SEA = -1.5;
const GW = GN + 1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------- noise ---------- */
function hash(x, z, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s = 0) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s = 0, oct = 4) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let k = 0; k < oct; k++) { v += a * vnoise(x * f, z * f, s + k * 17); n += a; f *= 2.03; a *= 0.5; }
    return v / n;
}

/* ---------- the areas ---------- */
// "east" is -x: that's the right-hand side of the map, the way the minimap draws it
export const AREAS = [
    { id: 'city', name: 'DOWNTOWN' },
    { id: 'desert', name: 'DUNE SEA', ang: 0, surf: 'sand' },
    { id: 'forest', name: 'PINE FOREST', ang: Math.PI / 2, surf: 'grass' },
    { id: 'frost', name: 'FROST PEAKS', ang: Math.PI, surf: 'snow' },
    { id: 'coast', name: 'LIGHTHOUSE COAST', ang: -Math.PI / 2, surf: 'grass' }
];
const OASIS = [-600, 0], HEADLAND = [60, -590];
function weights(x, z, out) {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, -x) + (vnoise(x / 260, z / 260, 9) - 0.5) * 0.8;
    let sum = 0;
    for (let k = 1; k < 5; k++) { const c = Math.max(0, Math.cos(a - AREAS[k].ang)); out[k] = c * c * c * c; sum += out[k]; }
    const city = 1 - smooth(200, 290, r + (vnoise(x / 70, z / 70, 5) - 0.5) * 50);
    out[0] = city;
    for (let k = 1; k < 5; k++) out[k] = out[k] / (sum || 1) * (1 - city);
    return out;
}
const Wt = [0, 0, 0, 0, 0];
function rawHeight(x, z) {
    const w = weights(x, z, Wt), r = Math.hypot(x, z);
    const edge = smooth(650, 790, Math.max(Math.abs(x), Math.abs(z)));
    const n = fbm(x / 150, z / 150, 1, 3);
    let h = w[0] * 2;
    if (w[1] > 0.001) {
        const dune = Math.abs(Math.sin(x * 0.021 + z * 0.011 + n * 5));
        const ow = Math.exp(-((x - OASIS[0]) ** 2 + (z - OASIS[1]) ** 2) / (34 * 34));
        h += w[1] * (3 + 3 * n + 8 * dune * smooth(270, 400, r) * (1 - ow) - 9 * ow + edge * 70);
    }
    if (w[2] > 0.001) h += w[2] * (4 + 30 * fbm(x / 220, z / 220, 2, 4) * smooth(240, 420, r) + edge * 90);
    if (w[3] > 0.001) { const rid = 1 - Math.abs(fbm(x / 150, z / 150, 3, 4) * 2 - 1); h += w[3] * (5 + smooth(300, 720, r) * (28 + 80 * rid) + edge * 70); }
    if (w[4] > 0.001) {
        const head = Math.exp(-((x - HEADLAND[0]) ** 2 + (z - HEADLAND[1]) ** 2) / (70 * 70));
        h += w[4] * (lerp(4 + 5 * n, -10, smooth(520, 640, r)) * (1 - head) + 13 * head);
    }
    return h;
}

/* ---------- roads and rails ---------- */
const C = 215;
const loop = (n, f) => Array.from({ length: n }, (_, i) => f(i / n * Math.PI * 2));
const ROADS = [
    { id: 'ring', name: 'RING HIGHWAY', closed: true, w: 18, surface: 'tarmac', lines: 'highway', lamps: 44,
        pts: loop(48, (a) => { const r = 430 + 30 * Math.sin(3 * a + 1) + 15 * Math.sin(5 * a); return [Math.cos(a) * r, Math.sin(a) * r]; }) },
    ...[-150, -75, 0, 75, 150].map((c) => ({ id: 'ns' + c, straight: true, w: 11, surface: 'tarmac', lines: 'city', lamps: 30, pts: [[c, -C], [c, C]] })),
    ...[-150, -75, 0, 75, 150].map((c) => ({ id: 'ew' + c, straight: true, w: 11, surface: 'tarmac', lines: 'city', lamps: 30, pts: [[-C, c], [C, c]] })),
    { id: 'radN', w: 12, surface: 'tarmac', lines: 'city', lamps: 50, pts: [[0, C], [6, 300], [-4, 380], [0, 440], [-10, 479]] },
    { id: 'radS', w: 12, surface: 'tarmac', lines: 'city', lamps: 50, pts: [[0, -C], [-6, -300], [4, -380], [0, -431], [-8, -496]] },
    { id: 'radE', w: 12, surface: 'tarmac', lines: 'city', lamps: 50, pts: [[-C, 0], [-300, 6], [-360, -4], [-405, 0], [-463, -10]] },
    { id: 'radW', w: 12, surface: 'tarmac', lines: 'city', lamps: 50, pts: [[C, 0], [300, -6], [380, 4], [455, 0]] },
    { id: 'forest', name: 'FOREST TRAIL', closed: true, w: 9, surface: 'dirt', lines: 'dirt',
        pts: [[-150, 520], [-60, 470], [40, 490], [130, 520], [190, 600], [150, 690], [40, 720], [-60, 700], [-170, 650], [-210, 580]] },
    { id: 'desert', name: 'DUNE TRACK', closed: true, w: 10, surface: 'sand', lines: 'dirt',
        pts: [[-470, -60], [-540, -140], [-650, -120], [-720, -20], [-700, 110], [-600, 170], [-500, 120], [-460, 40]] },
    { id: 'pass', name: 'SUMMIT PASS', w: 9, surface: 'gravel', lines: 'dirt',
        pts: [[455, 0], [520, 30], [565, -25], [610, 35], [645, -30], [685, 25], [715, -20], [740, 50], [715, 120], [670, 150]] },
    { id: 'coast', name: 'COAST ROAD', w: 11, surface: 'tarmac', lines: 'city', lamps: 40,
        pts: [[-330, -455], [-240, -492], [-130, -503], [-40, -490], [20, -505], [55, -540], [62, -562]] },
    { id: 'pier', straight: true, w: 6, surface: 'concrete', bridge: true, pts: [[-170, -505], [-170, -650]] }
];
const RAIL = loop(40, (a) => { const r = 330 + 20 * Math.sin(2 * a + 0.5); return [Math.cos(a) * r, Math.sin(a) * r]; });

function resample(pts, closed, straight, step = 4) {
    if (straight || pts.length < 3) {
        const out = [], P = closed ? [...pts, pts[0]] : pts;
        for (let k = 0; k < P.length - 1; k++) {
            const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step));
            for (let i = 0; i < n; i++) out.push([lerp(ax, bx, i / n), lerp(az, bz, i / n)]);
        }
        if (!closed) out.push(P[P.length - 1]);
        return out;
    }
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), !!closed, 'centripetal');
    const n = Math.max(2, Math.round(curve.getLength() / step));
    const sp = curve.getSpacedPoints(n).map((v) => [v.x, v.z]);
    if (closed) sp.pop();
    return sp;
}
// a drivable line: points with tangents, right vectors and a speed profile (for traffic and rivals)
function makePath(pts, closed, o = {}) {
    const n = pts.length, P = { n, closed, x: new Float32Array(n), z: new Float32Array(n), tx: new Float32Array(n), tz: new Float32Array(n), v: new Float32Array(n) };
    pts.forEach(([x, z], i) => { P.x[i] = x; P.z[i] = z; });
    const at = (i) => (closed ? (i + n) % n : clamp(i, 0, n - 1));
    for (let i = 0; i < n; i++) {
        const a = at(i - 1), b = at(i + 1), dx = P.x[b] - P.x[a], dz = P.z[b] - P.z[a], l = Math.hypot(dx, dz) || 1;
        P.tx[i] = dx / l; P.tz[i] = dz / l;
    }
    const vmax = o.vmax || 20, lat = o.lat || 6, dec = o.dec || 6;
    for (let i = 0; i < n; i++) {
        const a = at(i - 3), b = at(i + 3);
        const k = Math.abs(angDiff(Math.atan2(P.tx[b], P.tz[b]), Math.atan2(P.tx[a], P.tz[a]))) / 24;
        P.v[i] = Math.min(vmax, Math.sqrt(lat / Math.max(k, 1e-4)));
    }
    for (let pass = 0; pass < 2; pass++) for (let i = n - 2; i >= 0; i--) { const j = at(i + 1); P.v[i] = Math.min(P.v[i], Math.sqrt(P.v[j] ** 2 + 2 * dec * 4)); }
    if (!closed) P.v[n - 1] = Math.min(P.v[n - 1], 8);
    P.at = at;
    return P;
}

/* ---------- time of day ---------- */
const KEYS = [
    [0, { top: '#04060e', hor: '#121a2c', fog: '#0a0e18', sun: '#5a6a9a', sunI: 0.55, amb: '#2a3656', gnd: '#0a0c12', ambI: 1.1, disc: '#c8d4ff', cloud: '#1c2232', stars: 1 }],
    [5, { top: '#060a18', hor: '#1e2440', fog: '#121624', sun: '#5a6a9a', sunI: 0.5, amb: '#2e3a5a', gnd: '#0c0e14', ambI: 1.1, disc: '#c8d4ff', cloud: '#262c40', stars: 0.8 }],
    [6.3, { top: '#2a3a6e', hor: '#f08a5a', fog: '#8a6a6e', sun: '#ff9a5a', sunI: 1.5, amb: '#7a6a8e', gnd: '#3a3022', ambI: 1.6, disc: '#ffb07a', cloud: '#f0a088', stars: 0.15 }],
    [8.5, { top: '#3a6ab8', hor: '#c8d8e8', fog: '#a8b8c8', sun: '#fff0d8', sunI: 3.0, amb: '#9ab0d0', gnd: '#4a5a3a', ambI: 2.2, disc: '#fff4d0', cloud: '#f4f4f0', stars: 0 }],
    [13, { top: '#2a6ac8', hor: '#b8d4ec', fog: '#b0c4d8', sun: '#ffffff', sunI: 3.4, amb: '#a8bcd8', gnd: '#4a5a3a', ambI: 2.4, disc: '#ffffe8', cloud: '#ffffff', stars: 0 }],
    [16.5, { top: '#3a5a9a', hor: '#e8c8a0', fog: '#c0b0a0', sun: '#ffe0b0', sunI: 3.0, amb: '#a8a8c0', gnd: '#4a4a3a', ambI: 2.2, disc: '#fff0c0', cloud: '#fff0e0', stars: 0 }],
    [18.6, { top: '#3a2a5a', hor: '#ff7a3a', fog: '#a05a4a', sun: '#ff7a3a', sunI: 1.8, amb: '#8a5a6a', gnd: '#3a2a22', ambI: 1.7, disc: '#ff8a4a', cloud: '#ff9a6a', stars: 0 }],
    [19.8, { top: '#121838', hor: '#5a3458', fog: '#2a2236', sun: '#8a6aaa', sunI: 0.6, amb: '#4a3a6a', gnd: '#141018', ambI: 1.2, disc: '#c8b8ff', cloud: '#3a2a48', stars: 0.5 }],
    [21.5, { top: '#04060e', hor: '#121a2c', fog: '#0a0e18', sun: '#5a6a9a', sunI: 0.55, amb: '#2a3656', gnd: '#0a0c12', ambI: 1.1, disc: '#c8d4ff', cloud: '#1c2232', stars: 1 }],
    [24, null]
].map(([h, o], i, all) => [h, o || all[0][1]]).map(([h, o]) => [h, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? new THREE.Color(v) : v]))]);
export const WEATHER = {
    clear: { name: 'CLEAR', cloud: 0.12, precip: 0, fog: 0, storm: 0 },
    cloudy: { name: 'OVERCAST', cloud: 0.75, precip: 0, fog: 0.15, storm: 0 },
    rain: { name: 'RAIN', cloud: 0.9, precip: 0.65, fog: 0.3, storm: 0 },
    storm: { name: 'STORM', cloud: 1, precip: 1, fog: 0.4, storm: 1 },
    fog: { name: 'FOG', cloud: 0.45, precip: 0, fog: 1, storm: 0 }
};
const WORDER = ['clear', 'cloudy', 'rain', 'storm', 'fog'];
const WCHANCE = { clear: 3, cloudy: 2, rain: 2, storm: 1, fog: 1 };

const SKY_FRAG = `
uniform vec3 uTop, uHor, uFog, uSun, uSunCol, uCloudCol; uniform float uCloud, uStars, uTime, uFlash;
varying vec3 vDir;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, y));
    float s = max(dot(d, normalize(uSun)), 0.0);
    c += uSunCol * pow(s, 6.0) * 0.45;
    if (y > 0.0) {
        float st = h21(floor(d.xz / (y + 0.25) * 160.0));
        if (st > 0.9965) c += vec3(uStars * (0.55 + 0.45 * sin(uTime * 2.0 + st * 400.0)));
        vec2 p = d.xz / (y + 0.15) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
        float n = vn(p) * 0.55 + vn(p * 2.3) * 0.3 + vn(p * 5.1) * 0.15;
        float th = 0.78 - uCloud * 0.62;
        float cov = smoothstep(th, th + 0.06, n);
        vec3 cc = mix(uCloudCol, uCloudCol * 0.7, step(th + 0.13, n));     // two flat tones
        c = mix(c, cc, cov * smoothstep(0.0, 0.12, y));
    }
    c = mix(c, uFog, smoothstep(0.12, -0.02, y));
    gl_FragColor = vec4(c + vec3(uFlash), 1.0);
}`;

/* ---------- small mesh helpers ---------- */
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const place = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => m4.compose(v3.set(x, y, z), q4.setFromAxisAngle(Y, ry), s3.set(sx, sy, sz)).clone();
function instanced(geo, mat, mats, cols) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
    im.count = mats.length;
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    if (cols) { const c = new THREE.Color(); cols.forEach((h, i) => im.setColorAt(i, c.set(h))); }
    return im;
}
const box1 = () => { const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0); return b; };
function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
    t.wrapS = t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function signTex(text, bg = '#1e6a3a', fg = '#f4f4f0') {
    return canvasTex(128, 32, (x, w, h) => {
        x.fillStyle = bg; x.fillRect(0, 0, w, h);
        x.strokeStyle = fg; x.lineWidth = 2; x.strokeRect(3, 3, w - 6, h - 6);
        x.fillStyle = fg; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(text, w / 2, h / 2 + 1);
    });
}

/* ================================================================== */
export function buildWorld(TX) {
    const t0 = performance.now();
    const group = new THREE.Group();
    const anim = [];
    const R = rng(4242);

    /* ---------- road samples ---------- */
    const S = [];
    const roads = ROADS.map((d) => Object.assign({}, d));
    for (const rd of roads) {
        const pts = resample(rd.pts, rd.closed, rd.straight);
        rd.i0 = S.length; rd.n = pts.length;
        pts.forEach(([x, z]) => S.push({ x, z, y: 0, tx: 0, tz: 1, rx: -1, rz: 0, w: rd.w, road: rd }));
        const at = (k) => (rd.closed ? (k + rd.n) % rd.n : clamp(k, 0, rd.n - 1));
        for (let k = 0; k < rd.n; k++) {
            const a = S[rd.i0 + at(k - 1)], b = S[rd.i0 + at(k + 1)], s = S[rd.i0 + k];
            const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
            s.tx = dx / l; s.tz = dz / l; s.rx = -s.tz; s.rz = s.tx; s.sx = s.rx; s.sz = s.rz;
        }
        // heights follow the land, smoothed along the road so it never gets bumpy
        let ys = [];
        for (let k = 0; k < rd.n; k++) ys.push(rawHeight(S[rd.i0 + k].x, S[rd.i0 + k].z));
        for (let pass = 0; pass < 6; pass++) {
            ys = ys.map((_, k) => { let s = 0, c = 0; for (let j = -6; j <= 6; j++) { const kk = rd.closed ? (k + j + rd.n) % rd.n : clamp(k + j, 0, rd.n - 1); s += ys[kk]; c++; } return s / c; });
        }
        for (let k = 0; k < rd.n; k++) S[rd.i0 + k].y = Math.max(ys[k], SEA + 1.4);
    }
    const roadById = (id) => roads.find((r) => r.id === id);
    // the railway: its own line, kept level with a lot of smoothing
    const railPts = resample(RAIL, true, false, 4);
    let railY = railPts.map(([x, z]) => rawHeight(x, z));
    for (let pass = 0; pass < 12; pass++) railY = railY.map((_, k) => { let s = 0; for (let j = -8; j <= 8; j++) s += railY[(k + j + railY.length) % railY.length]; return s / 17; });
    const rail = makePath(railPts, true);
    rail.y = Float32Array.from(railY, (y) => Math.max(y, SEA + 1.4));

    // grid of samples for fast "nearest road" lookups
    const RC = 24, rgrid = new Map(), rk = (cx, cz) => cx * 4096 + cz;
    S.forEach((s, i) => { const k = rk(Math.floor((s.x + HALF) / RC), Math.floor((s.z + HALF) / RC)); (rgrid.get(k) || rgrid.set(k, []).get(k)).push(i); });
    const info = (s, x, z) => {
        const dx = x - s.x, dz = z - s.z, along = Math.abs(dx * s.tx + dz * s.tz), across = Math.abs(dx * s.rx + dz * s.rz);
        return along <= 2.2 ? across : Math.hypot(across, along - 2.2);
    };
    // the road whose edge is nearest: {i, ad, e (distance past the edge)}
    function edge(x, z, rad = 1, skip) {
        const cx = Math.floor((x + HALF) / RC), cz = Math.floor((z + HALF) / RC);
        let best = null;
        for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
            const l = rgrid.get(rk(cx + a, cz + b)); if (!l) continue;
            for (const i of l) {
                const s = S[i]; if (skip && skip(s)) continue;
                const ad = info(s, x, z), e = ad - s.w / 2;
                if (!best || e < best.e) best = { i, ad, e };
            }
        }
        return best;
    }
    // the rail line works the same way, on its own grid
    const railGrid = new Map();
    for (let i = 0; i < rail.n; i++) { const k = rk(Math.floor((rail.x[i] + HALF) / RC), Math.floor((rail.z[i] + HALF) / RC)); (railGrid.get(k) || railGrid.set(k, []).get(k)).push(i); }
    function railNear(x, z) {
        const cx = Math.floor((x + HALF) / RC), cz = Math.floor((z + HALF) / RC);
        let best = null;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
            const l = railGrid.get(rk(cx + a, cz + b)); if (!l) continue;
            for (const i of l) { const d = Math.hypot(x - rail.x[i], z - rail.z[i]); if (!best || d < best.d) best = { i, d }; }
        }
        return best;
    }

    /* ---------- terrain heights, flattened under the roads ---------- */
    const H = new Float32Array(GW * GW);
    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
        const x = -HALF + i * CELL, z = -HALF + j * CELL;
        let h = rawHeight(x, z);
        const e = edge(x, z, 1, (s) => s.road.bridge);
        if (e) { const s = S[e.i], hw = s.w / 2; h = s.y + (h - s.y) * smooth(hw + 1.5, hw + 16, e.ad); }
        const rn = railNear(x, z);
        if (rn) { const ry = rail.y[rn.i] - 0.3; h = ry + (h - ry) * smooth(4, 16, rn.d); }
        H[j * GW + i] = h;
    }
    function heightAt(x, z) {
        let gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
        gx = clamp(gx, 0, GN - 1e-4); gz = clamp(gz, 0, GN - 1e-4);
        const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, o = j * GW + i;
        const a = H[o], b = H[o + 1], c = H[o + GW], d = H[o + GW + 1];
        return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    }
    const pier = roadById('pier');
    pier.deck = heightAt(S[pier.i0].x, S[pier.i0].z);
    for (let k = 0; k < pier.n; k++) S[pier.i0 + k].y = pier.deck;

    /* ---------- the ground: biome colours dithered together, roads painted on top ---------- */
    const SURF_NAMES = ['concrete', 'grass', 'sand', 'snow', 'rock', 'gravel', 'sand'];
    const MS = 512, MP = SIZE / MS;
    const surfGrid = new Uint8Array(MS * MS);
    const base = document.createElement('canvas'); base.width = base.height = MS;
    {
        const bx = base.getContext('2d'), img = bx.createImageData(MS, MS), D = img.data;
        const BAY = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
        const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
        const PAL = {
            city: ['#585c62', '#5e6268', '#54585e'].map(hex), grass: ['#3a5a2a', '#44662e', '#365226', '#4e7034'].map(hex),
            sand: ['#c8945a', '#d8a468', '#b88450', '#e0b070'].map(hex), snow: ['#e8eef4', '#dce4ec', '#f4f8fc', '#cad4de'].map(hex),
            tundra: ['#6a7468', '#7a8478', '#5a6458'].map(hex), rock: ['#6a645c', '#5c564e', '#78726a'].map(hex),
            beach: ['#e8d0a0', '#dcc490', '#d4bc88'].map(hex), wet: ['#a89070', '#9a8466'].map(hex), coastg: ['#5a7a3a', '#4e6e34', '#64843e'].map(hex),
            dgrass: ['#2e4a22', '#34522a', '#283f1e'].map(hex)
        };
        const w = [0, 0, 0, 0, 0];
        for (let py = 0; py < MS; py++) for (let px = 0; px < MS; px++) {
            const x = -HALF + (px + 0.5) * MP, z = -HALF + (py + 0.5) * MP;
            const h = heightAt(x, z), sl = Math.hypot(heightAt(x + 2, z) - heightAt(x - 2, z), heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
            weights(x, z, w);
            const t = (BAY[(px & 7) + (py & 7) * 8] + 0.5) / 64;
            let k = 0, acc = w[0];
            while (k < 4 && t > acc) { k++; acc += w[k]; }
            const nz = hash(px, py, 3);
            let pal, surf;
            if (k === 0) { pal = PAL.city; surf = 0; }
            else if (k === 1) { pal = PAL.sand; surf = 2; }
            else if (k === 2) { pal = fbm(x / 60, z / 60, 4, 2) > 0.55 ? PAL.dgrass : PAL.grass; surf = 1; }
            else if (k === 3) { if (h > 42 + nz * 8) { pal = PAL.snow; surf = 3; } else { pal = PAL.tundra; surf = 5; } }
            else { if (h < SEA + 0.6) { pal = PAL.wet; surf = 6; } else if (h < 4.5) { pal = PAL.beach; surf = 6; } else { pal = PAL.coastg; surf = 1; } }
            if (sl > 0.75 && k !== 0) { pal = PAL.rock; surf = 4; }
            const c = pal[(nz * pal.length) | 0], o = (py * MS + px) * 4;
            D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
            surfGrid[py * MS + px] = surf;
        }
        bx.putImageData(img, 0, 0);
    }
    const surfAt = (x, z) => SURF_NAMES[surfGrid[clamp(((z + HALF) / MP) | 0, 0, MS - 1) * MS + clamp(((x + HALF) / MP) | 0, 0, MS - 1)]];

    // downtown lots: what stands on each block
    const CENTERS = [-185, -112.5, -37.5, 37.5, 112.5, 185];
    const lots = [];
    for (const cx of CENTERS) for (const cz of CENTERS) {
        if (Math.hypot(cx, cz) > 250) continue;
        const kind = cx === 37.5 && cz === 112.5 ? 'park' : cx === -37.5 && cz === -37.5 ? 'plaza' : 'build';
        lots.push({ x: cx, z: cz, kind });
    }

    const TS = 2048, K = TS / SIZE;
    const big = document.createElement('canvas'); big.width = big.height = TS;
    const g2 = big.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.drawImage(base, 0, 0, TS, TS);
    const P = (x, z) => [(x + HALF) * K, (z + HALF) * K];
    for (const l of lots) {
        const [px, py] = P(l.x - 27, l.z - 27);
        g2.fillStyle = '#7a7e84'; g2.fillRect(px, py, 54 * K, 54 * K);     // sidewalk
        const [qx, qy] = P(l.x - 24, l.z - 24);
        g2.fillStyle = l.kind === 'park' ? '#3e6a34' : l.kind === 'plaza' ? '#8a8478' : '#46494e';
        g2.fillRect(qx, qy, 48 * K, 48 * K);
        if (l.kind === 'plaza') { g2.fillStyle = '#9a9488'; for (let i = 0; i < 48; i += 4) for (let j = (i / 4) % 2 * 2; j < 48; j += 4) g2.fillRect(qx + i * K, qy + j * K, 2 * K, 2 * K); }
        if (l.kind === 'park') { g2.fillStyle = '#b8a888'; g2.fillRect(qx + 22 * K, qy, 4 * K, 48 * K); g2.fillRect(qx, qy + 22 * K, 48 * K, 4 * K); }
    }
    const stroke = (pts, closed, width, col, dash) => {
        g2.strokeStyle = col; g2.lineWidth = width; g2.setLineDash(dash || []);
        g2.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g2.lineTo(px, py) : g2.moveTo(px, py); });
        if (closed) g2.closePath();
        g2.stroke();
    };
    g2.lineJoin = 'round'; g2.lineCap = 'round';
    // the railway: ballast, sleepers and two rails
    {
        const pts = Array.from({ length: rail.n }, (_, i) => [rail.x[i], rail.z[i]]);
        stroke(pts, true, 6 * K, '#6a625a');
        stroke(pts, true, 3.2 * K, '#4a3a2a', [1.2, 1.4]);
        for (const off of [-0.75, 0.75]) stroke(pts.map(([x, z], i) => [x - rail.tz[i] * off, z + rail.tx[i] * off]), true, 1, '#a8a8a8');
    }
    const ROADCOL = { tarmac: ['#6e6a60', '#34383e'], dirt: ['#7a6040', '#86643e'], sand: ['#a87a4a', '#c08a54'], gravel: ['#6a6660', '#7a766e'] };
    const sideLine = (rd, off) => Array.from({ length: rd.n }, (_, k) => { const s = S[rd.i0 + k]; return [s.x + s.rx * off, s.z + s.rz * off]; });
    for (const pass of [0, 1]) for (const rd of roads) {
        if (rd.bridge) continue;
        const pts = Array.from({ length: rd.n }, (_, k) => [S[rd.i0 + k].x, S[rd.i0 + k].z]);
        const [vcol, rcol] = ROADCOL[rd.surface] || ROADCOL.tarmac;
        if (pass === 0) stroke(pts, rd.closed, (rd.w + 3) * K, rd.lines === 'city' ? '#8a8e94' : vcol);
        if (pass === 1) stroke(pts, rd.closed, rd.w * K, rcol);
    }
    const groundTex = new THREE.CanvasTexture(big);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.magFilter = THREE.NearestFilter; groundTex.minFilter = THREE.LinearMipmapLinearFilter; groundTex.anisotropy = 8;
    const detail = (() => {
        const n = 16, d = new Uint8Array(n * n * 4), r = rng(77);
        for (let i = 0; i < n * n; i++) { const v = 90 + ((r() * 90) | 0); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
        const t = new THREE.DataTexture(d, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
        return t;
    })();
    const groundMat = cel({ map: groundTex }, false);
    groundMat.onBeforeCompile = (sh) => {
        sh.uniforms.uDetail = { value: detail };
        sh.fragmentShader = 'uniform sampler2D uDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb *= 0.7 + 0.6 * texture2D(uDetail, vMapUv * 380.0).r;`);
    };
    groundMat.customProgramCacheKey = () => 'world-ground';


    /* ---------- road surfaces: real ribbons with crisp markings, laid over the painted ground ---------- */
    {
        const asphalt = (x, seed) => { const r = rng(seed); for (let j = 0; j < 64; j += 2) for (let i = 0; i < 64; i += 2) { const v = (50 + r() * 14) | 0; x.fillStyle = `rgb(${v},${v + 2},${v + 6})`; x.fillRect(i, j, 2, 2); } };
        const HWY = canvasTex(64, 64, (x) => {
            asphalt(x, 3);
            x.fillStyle = '#e8e4d8'; x.fillRect(2, 0, 1, 64); x.fillRect(61, 0, 1, 64);              // edge lines
            x.fillStyle = '#e8c040'; x.fillRect(30, 0, 1, 64); x.fillRect(33, 0, 1, 64);             // double yellow
            x.fillStyle = '#e8e4d8'; x.fillRect(16, 0, 1, 24); x.fillRect(47, 0, 1, 24);             // lane dashes
        }, true);
        const CITY = canvasTex(64, 64, (x) => {
            asphalt(x, 5);
            x.fillStyle = '#9a9ea4'; x.fillRect(0, 0, 3, 64); x.fillRect(61, 0, 3, 64);              // kerbs
            x.fillStyle = '#e0d8c0'; x.fillRect(31, 0, 2, 22);                                         // centre dashes
        }, true);
        const mats = {
            highway: cel({ map: HWY, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, false),
            city: cel({ map: CITY, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, false)
        };
        for (const k of ['dirt', 'sand', 'gravel']) mats[k] = cel({ map: TX[k], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, false);
        const LIFT = { ring: 0.12, radN: 0.1, radS: 0.1, radE: 0.1, radW: 0.1 };
        for (const rd of roads) {
            if (rd.bridge) continue;
            const kind = rd.lines === 'highway' ? 'highway' : rd.surface === 'tarmac' ? 'city' : rd.surface;
            const tiled = kind !== 'highway' && kind !== 'city';
            const lift = LIFT[rd.id] || (rd.id.startsWith('ew') ? 0.08 : 0.06);
            const pos = [], uv = [], idx = [], n = rd.n + (rd.closed ? 1 : 0);
            let dist = 0;
            for (let k = 0; k < n; k++) {
                const s = S[rd.i0 + (k % rd.n)];
                if (k > 0) { const q = S[rd.i0 + ((k - 1) % rd.n)]; dist += Math.hypot(s.x - q.x, s.z - q.z); }
                for (const side of [-1, 1]) {
                    pos.push(s.x + s.rx * side * rd.w / 2, s.y + lift, s.z + s.rz * side * rd.w / 2);
                    uv.push(tiled ? (side + 1) / 2 * rd.w / 4 : (side + 1) / 2, dist / (tiled ? 4 : 16));
                }
                if (k > 0) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setIndex(idx); g.computeVertexNormals();
            group.add(new THREE.Mesh(g, mats[kind] || mats.city));
        }
    }

    // terrain chunks: 8 x 8, normals from the whole grid so the seams don't show
    const CH = 40;
    for (let cj = 0; cj < GN / CH; cj++) for (let ci = 0; ci < GN / CH; ci++) {
        const n = CH + 1, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), idx = [];
        for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
            const i = ci * CH + a, j = cj * CH + b, o = b * n + a;
            const x = -HALF + i * CELL, z = -HALF + j * CELL;
            pos[o * 3] = x; pos[o * 3 + 1] = H[j * GW + i]; pos[o * 3 + 2] = z;
            const hl = H[j * GW + Math.max(0, i - 1)], hr = H[j * GW + Math.min(GN, i + 1)], hd = H[Math.max(0, j - 1) * GW + i], hu = H[Math.min(GN, j + 1) * GW + i];
            v3.set(-(hr - hl) / (2 * CELL), 1, -(hu - hd) / (2 * CELL)).normalize();
            nor[o * 3] = v3.x; nor[o * 3 + 1] = v3.y; nor[o * 3 + 2] = v3.z;
            uv[o * 2] = (x + HALF) / SIZE; uv[o * 2 + 1] = 1 - (z + HALF) / SIZE;
        }
        for (let b = 0; b < CH; b++) for (let a = 0; a < CH; a++) {
            const A = b * n + a, B = A + 1, Cc = A + n, D = Cc + 1;
            idx.push(A, Cc, B, B, Cc, D);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeBoundingSphere();
        group.add(new THREE.Mesh(g, groundMat));
    }
    // the sea (and the oasis): one water plane at sea level
    const waterTex = TX.water.clone(); waterTex.repeat.set(500, 500); waterTex.needsUpdate = true;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), cel({ map: waterTex, color: '#a8c8e0' }, false));
    water.rotation.x = -Math.PI / 2; water.position.y = SEA;
    group.add(water);
    anim.push((t) => waterTex.offset.set(t * 0.3, t * 0.45));

    /* ---------- obstacles: buildings, trees, rocks, the trains ---------- */
    const OC = 32, OB = new Map(), CR = 1.1;
    const okey = (x, z) => rk(Math.floor((x + HALF) / OC), Math.floor((z + HALF) / OC));
    function addOb(o) {
        const r = (o.hw ? Math.hypot(o.hw, o.hd) : o.r) + CR + 1;
        const x0 = Math.floor((o.x - r + HALF) / OC), x1 = Math.floor((o.x + r + HALF) / OC);
        const z0 = Math.floor((o.z - r + HALF) / OC), z1 = Math.floor((o.z + r + HALF) / OC);
        for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
            const k = rk(a, b);
            (OB.get(k) || OB.set(k, []).get(k)).push(o);
        }
        return o;
    }
    const boxOb = (x, z, hw, hd, ry = 0) => addOb({ x, z, hw, hd, c: Math.cos(ry), s: -Math.sin(ry) });
    function hitOne(o, x, z, best) {
        const dx = x - o.x, dz = z - o.z;
        if (o.hw) {
            const pu = dx * o.c + dz * o.s, pv = -dx * o.s + dz * o.c;
            const eu = o.hw + CR - Math.abs(pu), ev = o.hd + CR - Math.abs(pv);
            if (eu <= 0 || ev <= 0) return best;
            let nx, nz, pen;
            if (eu < ev) { const sg = Math.sign(pu) || 1; pen = eu; nx = o.c * sg; nz = o.s * sg; } else { const sg = Math.sign(pv) || 1; pen = ev; nx = -o.s * sg; nz = o.c * sg; }
            return !best || pen > best.pen ? { pen, nx, nz } : best;
        }
        const rr = o.r + CR, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) return best;
        const d = Math.sqrt(d2) || 0.01, pen = rr - d;
        return !best || pen > best.pen ? { pen, nx: dx / d, nz: dz / d } : best;
    }
    const moving = [];     // train carriages, updated every frame
    function obHit(x, z) {
        let best = null;
        const l = OB.get(okey(x, z));
        if (l) for (const o of l) best = hitOne(o, x, z, best);
        for (const o of moving) if (Math.abs(o.x - x) < 12 && Math.abs(o.z - z) < 12) best = hitOne(o, x, z, best);
        return best;
    }
    const keep = [];        // spots kept clear of trees
    const kept = (x, z) => keep.some(([kx, kz, kr]) => (x - kx) ** 2 + (z - kz) ** 2 < kr * kr);
    // world edge: invisible walls just inside the mountains and the sea
    for (const sg of [-1, 1]) { boxOb(sg * (HALF - 12), 0, 4, HALF); boxOb(0, sg * (HALF - 12), HALF, 4); }

    /* ---------- downtown ---------- */
    const NEON = ['#3ad0ff', '#ff3a6e', '#b04aff', '#4aff7a', '#ffe23a', '#ff9a3a'];
    const windowMats = [];
    {
        const r = rng(901), cls = [[], [], []], cols = [[], [], []], reds = [], neons = [], roofs = [];
        const tint = ['#8a9098', '#6a7078', '#a8a090', '#7a6a5a', '#5a6a7a', '#9a8a7a', '#4a5058', '#b0b8c0'];
        for (const l of lots) {
            keep.push([l.x, l.z, 30]);
            if (l.kind !== 'build') continue;
            const split = r() < 0.3 ? 1 : r() < 0.55 ? 2 : 4, f = 1 - Math.hypot(l.x, l.z) / 270;
            const parts = split === 1 ? [[0, 0, 44, 44]] : split === 2 ? [[-11.5, 0, 21, 44], [11.5, 0, 21, 44]] : [[-11.5, -11.5, 21, 21], [11.5, -11.5, 21, 21], [-11.5, 11.5, 21, 21], [11.5, 11.5, 21, 21]];
            const flip = r() < 0.5;
            for (let [ox, oz, w, d] of parts) {
                if (flip) [ox, oz, w, d] = [oz, ox, d, w];
                const x = l.x + ox, z = l.z + oz;
                const h = 10 + r() * 16 + f * f * r() * (split === 1 ? 140 : 80);
                const gy = Math.min(heightAt(x - w / 2, z - d / 2), heightAt(x + w / 2, z + d / 2)) - 0.5;
                const c = h < 26 ? 0 : h < 60 ? 1 : 2;
                cls[c].push(place(x, gy, z, 0, w, h, d)); cols[c].push(tint[(r() * tint.length) | 0]);
                roofs.push(place(x, gy + h, z, 0, w * 0.6, 1.6, d * 0.6));
                boxOb(x, z, w / 2, d / 2);
                if (h > 55) reds.push([x, gy + h + 2.2, z]);
                if (r() < 0.45) {   // a neon sign on the street side
                    const side = r() < 0.5 ? 1 : -1, alongX = r() < 0.5;
                    const nx = alongX ? x : x + side * (w / 2 + 0.25), nz = alongX ? z + side * (d / 2 + 0.25) : z;
                    neons.push([nx, gy + 5 + r() * 6, nz, alongX ? 0 : Math.PI / 2, 4 + r() * 6, NEON[(r() * NEON.length) | 0]]);
                }
            }
        }
        const REP = [[2, 2], [3, 6], [3, 14]];
        // pale walls with glass by day; the same windows, some of them lit, by night
        const facade = (seed, lit) => canvasTex(32, 32, (x) => {
            const rr = rng(seed);
            x.fillStyle = lit ? '#000000' : '#e4e2dc'; x.fillRect(0, 0, 32, 32);
            if (!lit) { x.fillStyle = '#c8c6c0'; for (let i = 0; i < 32; i += 8) x.fillRect(i, 0, 1, 32); }
            for (let y = 2; y < 32; y += 5) for (let i = 1; i < 32; i += 4) {
                const on = rr() < 0.42;
                x.fillStyle = lit ? (on ? (rr() < 0.2 ? '#bfe0ff' : '#ffd890') : '#000000') : (rr() < 0.15 ? '#8aa0b4' : '#4a5a6a');
                x.fillRect(i, y, 3, 3);
            }
        }, true);
        cls.forEach((mats, c) => {
            const tex = facade(31 + c, false), em = facade(31 + c, true);
            for (const t of [tex, em]) { t.repeat.set(...REP[c]); t.needsUpdate = true; }
            const m = cel({ map: tex, emissive: '#ffffff', emissiveMap: em });
            windowMats.push(m);
            group.add(instanced(box1(), m, mats, cols[c]));
        });
        group.add(instanced(box1(), cel({ color: '#3a3e44' }), roofs));
        const redM = new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false });
        const redI = instanced(new THREE.BoxGeometry(0.9, 0.9, 0.9), redM, reds.map(([x, y, z]) => place(x, y, z)));
        group.add(glows(redI));
        anim.push((t) => { redM.color.set(Math.floor(t * 1.1) % 2 ? '#ff2a2a' : '#3a0808'); });
        const nm = [], nc = [];
        for (const [x, y, z, ry, w, col] of neons) { nm.push(place(x, y, z, ry, w, 1.2, 0.3)); nc.push(col); }
        group.add(glows(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nm, nc)));
        // billboards on tall poles at the city edge, facing the highway
        for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI * 2 + 0.3, rr = 395, x = Math.cos(a) * rr, z = Math.sin(a) * rr, gy = heightAt(x, z);
            const words = ['GRAVEL RIOT', 'DRINK FUEL', 'HOTEL NOVA', 'DUCK DAY', 'MEGA MART', 'RADIO 88'];
            const bb = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.8, 12, 0.8), cel({ color: '#3a3e44' })); pole.position.y = 6; bb.add(pole);
            const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ map: signTex(words[k], ['#ff3a6e', '#1a2a4a', '#b04aff', '#e8c020', '#2a5aa8', '#1a1a1a'][k], '#ffffff'), side: THREE.DoubleSide }));
            face.position.y = 14; bb.add(glows(face));
            bb.position.set(x, gy, z); bb.rotation.y = Math.atan2(-x, -z);
            group.add(bb);
            addOb({ x, z, r: 0.6 });
        }
        // the plaza fountain and the park's trees
        const pl = lots.find((l) => l.kind === 'plaza'), py = heightAt(pl.x, pl.z);
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1, 14), cel({ color: '#b8b0a0' })); basin.position.set(pl.x, py + 0.5, pl.z); group.add(basin);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 14), cel({ map: waterTex })); pool.rotation.x = -Math.PI / 2; pool.position.set(pl.x, py + 1.02, pl.z); group.add(pool);
        const jet = glows(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 4, 6), new THREE.MeshBasicMaterial({ color: '#9fd8f5', transparent: true, opacity: 0.8 }))); jet.position.set(pl.x, py + 3, pl.z); group.add(jet);
        anim.push((t) => { jet.scale.y = 0.8 + Math.sin(t * 6) * 0.2; });
        addOb({ x: pl.x, z: pl.z, r: 5.4 });
    }

    /* ---------- street lamps, with pools of light on the road at night ---------- */
    const lampHeadM = new THREE.MeshBasicMaterial({ color: '#ffd890', fog: false });
    const poolM = new THREE.MeshBasicMaterial({
        map: canvasTex(32, 32, (x) => {
            const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
            for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const d = Math.hypot(i - 15.5, j - 15.5) / 16; if (1 - d > (B[(i & 3) + (j & 3) * 4] + 0.5) / 16 * 1.1) { x.fillStyle = '#ffffff'; x.fillRect(i, j, 1, 1); } }
        }), color: '#6a5a3a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4
    });
    {
        const poles = [], heads = [], pools = [];
        for (const rd of roads) {
            if (!rd.lamps) continue;
            const step = Math.round(rd.lamps / 4);
            for (let k = 0, n = 0; k < rd.n; k += step, n++) {
                const s = S[rd.i0 + k], side = rd.lines === 'highway' ? (n % 2 ? 1 : -1) : (n % 2 ? 1 : -1), off = (s.w / 2 + 1.2) * side;
                const x = s.x + s.rx * off, z = s.z + s.rz * off;
                const other = edge(x, z, 1, (o) => o.road === rd);
                if (other && other.e < 1.5) continue;
                if (railNear(x, z)?.d < 5) continue;
                const gy = heightAt(x, z);
                poles.push(place(x, gy, z, 0, 0.22, 7.5, 0.22));
                const hx = x - s.rx * side * 1.4, hz = z - s.rz * side * 1.4;
                heads.push(place(hx, gy + 7.4, hz, Math.atan2(s.tx, s.tz), 0.5, 0.25, 1.4));
                pools.push(place(hx, s.y + 0.08, hz, 0, 11, 1, 11));
                addOb({ x, z, r: 0.25 });
            }
        }
        group.add(instanced(box1(), cel({ color: '#2a3139' }), poles));
        group.add(glows(instanced(new THREE.BoxGeometry(1, 1, 1), lampHeadM, heads)));
        const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
        const pi = instanced(pg, poolM, pools); pi.layers.set(MAIN_ONLY);
        group.add(pi);
    }

    /* ---------- highway sign gantries ---------- */
    {
        const ring = roadById('ring'), dests = [['DOWNTOWN', '#1e6a3a'], ['DUNE SEA', '#1e6a3a'], ['PINE FOREST', '#1e6a3a'], ['FROST PEAKS', '#1e6a3a'], ['COAST', '#1e6a3a'], ['EXIT 5', '#2a5aa8']];
        for (let k = 0; k < 6; k++) {
            const s = S[ring.i0 + Math.round((k + 0.5) / 6 * ring.n) % ring.n], g = new THREE.Group(), hw = s.w / 2 + 1.5;
            const postM = cel({ color: '#8a929a' });
            for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), postM); p.position.set(sg * hw, 4, 0); g.add(p); addOb({ x: s.x + s.rx * sg * hw, z: s.z + s.rz * sg * hw, r: 0.4 }); }
            const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.5, 0.6, 0.6), postM); beam.position.y = 8; g.add(beam);
            for (const [ox, txt] of [[-4.5, dests[k][0]], [4.5, dests[(k + 2) % 6][0]]]) {
                const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), new THREE.MeshBasicMaterial({ map: signTex(txt), side: THREE.DoubleSide }));
                sign.position.set(ox, 9.3, 0.35); g.add(sign);
            }
            g.position.set(s.x, s.y, s.z); g.rotation.y = Math.atan2(s.tx, s.tz) + Math.PI;
            group.add(g);
        }
    }

    /* ---------- the railway: rails, crossings, and two trains ---------- */
    const crossings = [];
    {
        const railMs = [], sleeperMs = [];
        for (let i = 0; i < rail.n; i++) {
            const j = (i + 1) % rail.n, mx = (rail.x[i] + rail.x[j]) / 2, mz = (rail.z[i] + rail.z[j]) / 2, my = (rail.y[i] + rail.y[j]) / 2, ry = Math.atan2(rail.tx[i], rail.tz[i]);
            const len = Math.hypot(rail.x[j] - rail.x[i], rail.z[j] - rail.z[i]);
            for (const off of [-0.75, 0.75]) railMs.push(place(mx - rail.tz[i] * off, my + 0.15, mz + rail.tx[i] * off, ry, 0.14, 0.18, len + 0.05));
            if (i % 2 === 0) sleeperMs.push(place(mx, my, mz, ry, 2.6, 0.16, 0.5));
        }
        group.add(instanced(box1(), cel({ color: '#9aa0a8' }), railMs));
        group.add(instanced(box1(), cel({ color: '#4a3a2a' }), sleeperMs));
        // level crossings where the line meets a road: posts with lights that flash when a train comes
        const seen = [];
        for (let i = 0; i < rail.n; i += 1) {
            const e = edge(rail.x[i], rail.z[i], 1);
            if (!e || e.e > -1) continue;
            if (seen.some(([x, z]) => Math.hypot(x - rail.x[i], z - rail.z[i]) < 30)) continue;
            seen.push([rail.x[i], rail.z[i]]);
            const s = S[e.i], lights = [];
            for (const sg of [-1, 1]) {
                const x = rail.x[i] + s.rx * sg * (s.w / 2 + 1.5) - rail.tx[i] * 4 * sg, z = rail.z[i] + s.rz * sg * (s.w / 2 + 1.5) - rail.tz[i] * 4 * sg, gy = heightAt(x, z);
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4, 0.25), cel({ color: '#e8e8e8' })); post.position.set(x, gy + 2, z); group.add(post);
                const xs = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.1), cel({ color: '#e8e8e8' })); xs.position.set(x, gy + 3.6, z); xs.rotation.y = Math.atan2(s.tx, s.tz); xs.rotation.z = 0.6; group.add(xs);
                for (const o of [-0.4, 0.4]) {
                    const L = glows(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: '#3a0808', fog: false })));
                    L.position.set(x + s.tx * o, gy + 2.8, z + s.tz * o); group.add(L); lights.push(L);
                }
                addOb({ x, z, r: 0.3 });
            }
            crossings.push({ i, lights, x: rail.x[i], z: rail.z[i] });
        }
    }
    const trains = [];
    {
        const mk = (cols, freight) => {
            const cars = [];
            cols.forEach((col, k) => {
                const g = new THREE.Group(), loco = k === 0;
                const body = new THREE.Mesh(box1(), cel({ color: col })); body.scale.set(3, loco ? 4 : 3.6, 13); body.position.y = 0.9; g.add(body);
                if (!freight || loco) {
                    const win = new THREE.Mesh(box1(), cel({ color: '#1a2230', emissive: '#ffd890', emissiveIntensity: 0.2 })); win.scale.set(3.05, 0.9, 11); win.position.y = 3; g.add(win);
                    windowMats.push(win.material);
                } else {
                    const stripe = new THREE.Mesh(box1(), cel({ color: ['#c8282a', '#2a5aa8', '#e8c020'][k % 3] })); stripe.scale.set(3.05, 2.6, 12.4); stripe.position.y = 1.4; g.add(stripe);
                }
                const under = new THREE.Mesh(box1(), cel({ color: '#1a1e24' })); under.scale.set(2.6, 0.9, 12); g.add(under);
                if (loco) {
                    const lamp = glows(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }))); lamp.position.set(0, 2.2, 6.6); g.add(lamp);
                    const nose = new THREE.Mesh(box1(), cel({ color: '#e8c020' })); nose.scale.set(3.02, 1.2, 0.4); nose.position.set(0, 1.2, 6.5); g.add(nose);
                }
                group.add(g);
                const ob = { x: 0, z: 0, hw: 1.5, hd: 6.5, c: 1, s: 0, top: 99 };
                moving.push(ob);
                cars.push({ g, ob });
            });
            return cars;
        };
        trains.push({ cars: mk(['#c8ccd4', '#c8ccd4', '#c8ccd4', '#c8ccd4', '#c8ccd4'], false), d: 0, v: 24, name: 'passenger' });
        trains.push({ cars: mk(['#2a3139', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a'], true), d: rail.n * 2, v: 17, name: 'freight' });
    }
    const railLen = rail.n * 4;
    function railPos(d) {
        d = ((d % railLen) + railLen) % railLen;
        const f = d / 4, i = Math.floor(f) % rail.n, j = (i + 1) % rail.n, t = f - Math.floor(f);
        return { x: lerp(rail.x[i], rail.x[j], t), z: lerp(rail.z[i], rail.z[j], t), y: lerp(rail.y[i], rail.y[j], t), h: Math.atan2(rail.tx[i], rail.tz[i]), i };
    }
    function updTrains(dt, t) {
        for (const tr of trains) {
            tr.d += tr.v * dt;
            tr.cars.forEach(({ g, ob }, k) => {
                const p = railPos(tr.d - k * 14), p2 = railPos(tr.d - k * 14 - 6), p1 = railPos(tr.d - k * 14 + 6);
                const h = Math.atan2(p1.x - p2.x, p1.z - p2.z);
                g.position.set(p.x, p.y + 0.4, p.z); g.rotation.y = h;
                ob.x = p.x; ob.z = p.z; ob.c = Math.cos(h); ob.s = -Math.sin(h);
            });
            tr.head = railPos(tr.d);
        }
        for (const c of crossings) {
            const near = trains.some((tr) => { const dd = Math.hypot(tr.head.x - c.x, tr.head.z - c.z); return dd < 160 || tr.cars.some(({ ob }) => Math.hypot(ob.x - c.x, ob.z - c.z) < 20); });
            c.lights.forEach((L, k) => L.material.color.set(near && (Math.floor(t * 3) + k) % 2 ? '#ff2a1a' : '#3a0808'));
        }
    }

    /* ---------- landmarks ---------- */
    // lighthouse on the headland, its beam sweeping out over the sea
    let beamM;
    {
        const coast = roadById('coast'), end = S[coast.i0 + coast.n - 1];
        const x = end.x + 4, z = end.z - 26, gy = heightAt(x, z), g = new THREE.Group();
        for (let k = 0; k < 6; k++) {
            const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - k * 0.22, 2.8 - k * 0.22, 3.4, 10), cel({ color: k % 2 ? '#e8e8e0' : '#c8282a' }));
            ring.position.y = 1.7 + k * 3.4; g.add(ring);
        }
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10), cel({ color: '#2a3139' })); top.position.y = 22; g.add(top);
        const lamp = glows(new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 6), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }))); lamp.position.y = 22; g.add(lamp);
        beamM = new THREE.MeshBasicMaterial({ color: '#4a4430', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        const beam = glows(new THREE.Mesh(new THREE.ConeGeometry(7, 90, 10, 1, true), beamM)); beam.rotation.z = Math.PI / 2; beam.position.x = 45;
        const pivot = new THREE.Group(); pivot.position.y = 22; pivot.add(beam); g.add(pivot);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.6, 10), cel({ color: '#c8282a' })); cap.position.y = 24; g.add(cap);
        const hut = new THREE.Mesh(box1(), cel({ color: '#e8e0d0' })); hut.scale.set(6, 4, 5); hut.position.set(5, 0, 3); g.add(hut);
        g.position.set(x, gy - 0.3, z); group.add(g);
        anim.push((t) => { pivot.rotation.y = t * 0.9; });
        addOb({ x, z, r: 3 }); boxOb(x + 5, z + 3, 3, 2.5);
        keep.push([x, z, 14]);
        group.userData.lighthouse = [x, z];
    }
    // the pier: a wooden deck out over the water
    {
        const a = S[pier.i0], b = S[pier.i0 + pier.n - 1], len = Math.hypot(b.x - a.x, b.z - a.z);
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, ry = Math.atan2(b.x - a.x, b.z - a.z);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(pier.w, 0.5, len), cel({ color: '#7a5a3a' })); deck.position.set(mx, pier.deck - 0.25, mz); deck.rotation.y = ry; group.add(deck);
        const posts = [], rails = [];
        for (let d = 4; d < len; d += 8) for (const sg of [-1, 1]) {
            const x = a.x + (b.x - a.x) * d / len + sg * pier.w / 2, z = a.z + (b.z - a.z) * d / len;
            posts.push(place(x, -12, z, 0, 0.5, pier.deck + 12, 0.5));
        }
        for (const sg of [-1, 1]) rails.push(place(mx + sg * (pier.w / 2 - 0.1), pier.deck + 0.6, mz, ry, 0.12, 0.12, len));
        group.add(instanced(box1(), cel({ color: '#5a4028' }), posts));
        group.add(instanced(box1(), cel({ color: '#5a4028' }), rails));
        const hut = new THREE.Mesh(box1(), cel({ color: '#4a8aa8' })); hut.scale.set(4, 3, 4); hut.position.set(b.x, pier.deck, b.z + 3); group.add(hut);
    }
    // the gas station on the way to the dunes
    {
        const x = -432, z = 26, gy = heightAt(x, z), g = new THREE.Group();
        const roof = new THREE.Mesh(box1(), cel({ color: '#e8e8e8' })); roof.scale.set(16, 0.8, 10); roof.position.y = 5; g.add(roof);
        const band = glows(new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.4, 10.2), new THREE.MeshBasicMaterial({ color: '#ff3a6e' }))); band.position.y = 5.2; g.add(band);
        for (const [px, pz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) { const p = new THREE.Mesh(box1(), cel({ color: '#c8c8c8' })); p.scale.set(0.5, 5, 0.5); p.position.set(px, 0, pz); g.add(p); addOb({ x: x + px, z: z + pz, r: 0.35 }); }
        for (const px of [-3, 3]) { const pump = new THREE.Mesh(box1(), cel({ color: '#c8282a' })); pump.scale.set(1, 1.8, 0.8); pump.position.set(px, 0, 0); g.add(pump); addOb({ x: x + px, z, r: 0.7 }); }
        const shop = new THREE.Mesh(box1(), cel({ map: TX.windows, emissive: '#ffffff', emissiveMap: TX.windows })); shop.scale.set(14, 5, 8); shop.position.set(0, 0, 13); g.add(shop);
        windowMats.push(shop.material);
        boxOb(x, z + 13, 7, 4);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTex('GAS · DINER', '#1a1a1a', '#ffd27a'), side: THREE.DoubleSide })); sign.position.set(0, 6.5, -5.2); g.add(glows(sign));
        g.position.set(x, gy, z); group.add(g);
        keep.push([x, z + 5, 18]);
    }
    // a log cabin in the forest, a radio mast on the summit
    {
        const x = 100, z = 600, gy = heightAt(x, z), g = new THREE.Group();
        const walls = new THREE.Mesh(box1(), cel({ color: '#6a4a2a' })); walls.scale.set(10, 4.5, 7); g.add(walls);
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1, 3), cel({ color: '#3a2a1e' })); roof.rotation.x = -Math.PI / 2; roof.rotation.z = Math.PI / 2; roof.scale.set(5, 11, 3.2); roof.position.y = 5.6; g.add(roof);
        const win = glows(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: '#ffd27a' }))); win.position.set(2, 2.2, 3.52); g.add(win);
        g.position.set(x, gy - 0.2, z); group.add(g);
        boxOb(x, z, 5, 3.5); keep.push([x, z, 16]);
        const pass = roadById('pass'), top = S[pass.i0 + pass.n - 1];
        const mx = top.x + 14, mz = top.z + 8, my = heightAt(mx, mz);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 34, 4), cel({ color: '#c8c8c8' })); mast.position.set(mx, my + 17, mz); group.add(mast);
        const bl = glows(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false }))); bl.position.set(mx, my + 34.5, mz); group.add(bl);
        anim.push((t) => { bl.visible = Math.floor(t * 1.4) % 2 === 0; });
        addOb({ x: mx, z: mz, r: 1 }); keep.push([mx, mz, 12]);
        group.userData.summit = [top.x, top.z];
    }
    // mesas in the dunes
    {
        const MESAS = [[-560, -270, 30, 40], [-690, -210, 24, 55], [-520, 250, 28, 34], [-670, 270, 22, 48], [-750, 90, 16, 60], [-470, -350, 18, 30]];
        const tex = TX.redrock || TX.rock;
        for (const [x, z, r, h] of MESAS) {
            if (edge(x, z, 2)?.e < r + 4) continue;
            const gy = heightAt(x, z) - 2;
            const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 9), cel({ map: tex })); m.position.set(x, gy + h / 2, z); group.add(m);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.8, h * 0.18, 9), cel({ map: tex })); cap.position.set(x + r * 0.1, gy + h * 1.09, z); group.add(cap);
            addOb({ x, z, r: r * 0.95 }); keep.push([x, z, r + 4]);
        }
    }
    // beach umbrellas and huts along the sand
    {
        const r = rng(55), um = [], uc = [], poles = [];
        for (let k = 0, tries = 0; k < 26 && tries < 600; tries++) {
            const a = -Math.PI / 2 + (r() - 0.5) * 1.6, rr = 530 + r() * 40, x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = heightAt(x, z);
            if (h < SEA + 0.8 || h > 4.5 || edge(x, z, 1)?.e < 3 || kept(x, z)) continue;
            um.push(place(x, h + 2.2, z, r() * 3, 2.4, 0.8, 2.4)); uc.push(['#ff3a6e', '#3ad0ff', '#ffe23a', '#e8e8e8'][k % 4]);
            poles.push(place(x, h, z, 0, 0.1, 2.3, 0.1));
            k++;
        }
        group.add(instanced(new THREE.ConeGeometry(1, 1, 8), cel({ color: '#ffffff' }), um, uc));
        group.add(instanced(box1(), cel({ color: '#e8e8e8' }), poles));
    }

    /* ---------- stunt ramps ---------- */
    const ramps = [];
    {
        const wedge = (() => {
            const g = new THREE.BufferGeometry(), w = 0.5, L = 1, h = 1;
            const v = [-w, 0, 0, w, 0, 0, -w, h, L, w, h, L, -w, 0, L, w, 0, L];
            g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0], 2));
            g.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5]);
            g.computeVertexNormals();
            return g;
        })();
        const tex = canvasTex(16, 16, (x) => { x.fillStyle = '#e8c020'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#1a1a1a'; for (let i = -16; i < 32; i += 8) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 4, 16); x.lineTo(i + 12, 0); x.lineTo(i + 8, 0); x.fill(); } }, true);
        tex.repeat.set(2, 3);
        const mat = cel({ map: tex, side: THREE.DoubleSide });
        const SPOTS = [['ring', 0.1, 14], ['ring', 0.62, -14], ['desert', 0.3, 0], ['desert', 0.75, 0], ['forest', 0.5, 0], ['ew0', 0.25, 0], ['coast', 0.3, -12], ['pass', 0.55, 0]];
        for (const [id, f, off] of SPOTS) {
            const rd = roadById(id), s = S[rd.i0 + Math.round(f * (rd.n - 1))];
            const x = s.x + s.rx * off, z = s.z + s.rz * off, ry = Math.atan2(s.tx, s.tz);
            const rp = { x, z, y0: heightAt(x, z), c: Math.cos(ry), s: -Math.sin(ry), tx: s.tx, tz: s.tz, hw: 3, len: 11, h: 4.2 };
            ramps.push(rp);
            const m = new THREE.Mesh(wedge, mat); m.scale.set(rp.hw * 2, rp.h, rp.len);
            m.position.set(x - s.tx * rp.len / 2, rp.y0 - 0.05, z - s.tz * rp.len / 2); m.rotation.y = ry;
            group.add(m);
            keep.push([x, z, 16]);
        }
    }
    function rampY(x, z) {
        let y = -Infinity;
        for (const r of ramps) {
            const dx = x - r.x, dz = z - r.z;
            if (dx * dx + dz * dz > 100) continue;
            const along = dx * r.tx + dz * r.tz + r.len / 2, across = dx * r.c + dz * r.s;
            if (along < 0 || along > r.len || Math.abs(across) > r.hw) continue;
            y = Math.max(y, r.y0 + r.h * along / r.len);
        }
        return y;
    }

    /* ---------- speed traps: a camera on a pole either side of the road ---------- */
    const traps = [];
    {
        const SPOTS = [['ring', 0.3, 'HIGHWAY NORTH'], ['ring', 0.8, 'HIGHWAY SOUTH'], ['radE', 0.55, 'DESERT ROAD'], ['radN', 0.5, 'FOREST ROAD'], ['coast', 0.5, 'COAST ROAD'], ['ew75', 0.5, 'DOWNTOWN']];
        const poleM = cel({ color: '#2a3139' }), camM = cel({ color: '#d8dce0' });
        SPOTS.forEach(([id, f, name], k) => {
            const rd = roadById(id), s = S[rd.i0 + Math.round(f * (rd.n - 1))], hw = s.w / 2 + 1.6;
            const flashes = [];
            for (const sg of [-1, 1]) {
                const x = s.x + s.rx * sg * hw, z = s.z + s.rz * sg * hw, gy = heightAt(x, z);
                const p = new THREE.Mesh(box1(), poleM); p.scale.set(0.25, 5, 0.25); p.position.set(x, gy, z); group.add(p);
                const cam = new THREE.Mesh(box1(), camM); cam.scale.set(0.6, 0.5, 0.9); cam.position.set(x, gy + 5, z); cam.rotation.y = Math.atan2(s.tx, s.tz); group.add(cam);
                const fl = glows(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: '#3a0a1a', fog: false })));
                fl.position.set(x - s.tx * 0.5, gy + 5.25, z - s.tz * 0.5); group.add(fl); flashes.push(fl);
                addOb({ x, z, r: 0.3 });
            }
            traps.push({ id: 'trap' + k, name, x: s.x, z: s.z, tx: s.tx, tz: s.tz, rx: s.rx, rz: s.rz, hw: s.w / 2 + 1, flashes });
            keep.push([s.x, s.z, 8]);
        });
    }
    /* ---------- smashables: cones and crates along the kerbs ---------- */
    const smash = [];
    {
        const r = rng(515), zero = new THREE.Matrix4().makeScale(0, 0, 0);
        for (const rd of roads) {
            if (rd.bridge || (rd.surface !== 'tarmac' && rd.id !== 'desert')) continue;
            const city = rd.id.startsWith('ns') || rd.id.startsWith('ew');
            for (let k = 6; k < rd.n - 3; k += 12 + ((r() * 10) | 0)) {
                const s = S[rd.i0 + k], side = r() < 0.5 ? -1 : 1, off = (s.w / 2 + 0.9) * side;
                const x = s.x + s.rx * off, z = s.z + s.rz * off;
                const other = edge(x, z, 1, (o) => o.road === rd);
                if (other && other.e < 1) continue;
                if (railNear(x, z)?.d < 5) continue;
                smash.push({ x, z, y: heightAt(x, z), kind: city && r() < 0.5 ? 'crate' : 'cone', alive: true, t: 0, ry: r() * 6 });
            }
        }
        const kinds = {
            cone: { geo: (() => { const g = new THREE.ConeGeometry(0.32, 0.85, 6); g.translate(0, 0.42, 0); return g; })(), mat: cel({ color: '#ff7a1a' }), col: ['#ff7a1a', '#e8e8e8'] },
            crate: { geo: box1(), mat: cel({ map: TX.crate || null, color: '#a07a4a' }), col: ['#a07a4a', '#6a4a2a'] }
        };
        for (const [kind, K2] of Object.entries(kinds)) {
            const list = smash.filter((o) => o.kind === kind);
            list.forEach((o, i) => { o.idx = i; o.m = kind === 'crate' ? place(o.x, o.y, o.z, o.ry, 0.9, 0.9, 0.9) : place(o.x, o.y, o.z, o.ry); o.col = K2.col; });
            const im = instanced(K2.geo, K2.mat, list.map((o) => o.m));
            list.forEach((o) => { o.im = im; });
            group.add(im);
        }
        smash.set = (o, on) => { o.alive = on; o.im.setMatrixAt(o.idx, on ? o.m : zero); o.im.instanceMatrix.needsUpdate = true; };
    }

    /* ---------- golden ducks ---------- */
    const lh = group.userData.lighthouse, sm = group.userData.summit;
    const DUCK_SPOTS = [
        ['pier', -170, -646], ['lighthouse', lh[0] - 6, lh[1] + 6], ['park', 37.5, 112.5], ['plaza', -30, -46], ['deadend', 150, -205],
        ['ramp-ring', null, 0], ['ramp-dunes', null, 2], ['oasis', OASIS[0] + 26, OASIS[1] + 6], ['dune', -720, -300],
        ['cabin', 100, 612], ['deepwood', -280, 690], ['hill', 300, 600], ['summit', sm[0] + 6, sm[1] - 10], ['frozen', 600, -330],
        ['cove', -300, -470], ['diner', -432, 46]
    ];
    const ducks = DUCK_SPOTS.map(([id, x, z]) => {
        let y;
        if (x == null) { const r = ramps[z]; x = r.x + r.tx * (r.len / 2 + 16); z = r.z + r.tz * (r.len / 2 + 16); y = r.y0 + r.h + 4.5; }
        else if (id === 'pier') y = pier.deck + 1.3;
        else y = Math.max(heightAt(x, z), SEA) + 1.3;
        keep.push([x, z, 6]);
        return { id, x, z, y };
    });
    const duckGeo = (() => {
        const body = new THREE.SphereGeometry(0.7, 8, 6); body.scale(1, 0.8, 1.25);
        const head = new THREE.SphereGeometry(0.45, 8, 6); head.translate(0, 0.75, 0.6);
        const tail = new THREE.ConeGeometry(0.3, 0.6, 6); tail.rotateX(-Math.PI / 2.6); tail.translate(0, 0.35, -0.85);
        return mergeGeometries([body, head, tail]);
    })();
    const beakGeo = new THREE.BoxGeometry(0.3, 0.14, 0.4); beakGeo.translate(0, 0.7, 1.1);
    const duckM = cel({ color: '#ffcc33', emissive: '#6a4a00' }), beakM = cel({ color: '#ff8a2a' });
    const haloM = new THREE.MeshBasicMaterial({ color: '#5a4410', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const d of ducks) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(duckGeo, duckM), new THREE.Mesh(beakGeo, beakM));
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), haloM); halo.layers.set(1); g.add(halo);
        g.position.set(d.x, d.y, d.z);
        group.add(g);
        d.mesh = g;
    }
    anim.push((t) => ducks.forEach((d, k) => { d.mesh.rotation.y = t * 1.6 + k; d.mesh.position.y = d.y + Math.sin(t * 2.5 + k) * 0.25; }));

    /* ---------- trees and rocks ---------- */
    {
        const kinds = { pine: [], snowpine: [], palm: [], cactus: [], leaf: [] }, r = rng(313), w = [0, 0, 0, 0, 0], STEP = 7;
        const plant = (kind, x, z, sc) => { kinds[kind].push(place(x, heightAt(x, z) - 0.2, z, r() * Math.PI, sc, sc, sc)); addOb({ x, z, r: 0.45 }); };
        for (let gz = 0; gz < SIZE / STEP; gz++) for (let gx = 0; gx < SIZE / STEP; gx++) {
            const x = -HALF + (gx + r()) * STEP, z = -HALF + (gz + r()) * STEP, roll = r(), pick = r();
            if (Math.abs(x) > HALF - 16 || Math.abs(z) > HALF - 16) continue;
            weights(x, z, w);
            let k = 0, acc = w[0]; while (k < 4 && pick > acc) { k++; acc += w[k]; }
            const dens = [0, 0.025, fbm(x / 90, z / 90, 8, 2) > 0.42 ? 0.5 : 0.04, 0.13, 0.05][k];
            if (roll > dens) continue;
            const h = heightAt(x, z);
            if (h < SEA + 0.8) continue;
            const e = edge(x, z, 1); if (e && e.e < 6.5) continue;
            if (railNear(x, z)?.d < 7) continue;
            if (kept(x, z)) continue;
            const sl = Math.hypot(heightAt(x + 2, z) - heightAt(x - 2, z), heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
            if (sl > 0.8) continue;
            if (k === 1) plant('cactus', x, z, 0.7 + r() * 0.4);
            else if (k === 2) plant('pine', x, z, 1.1 + r() * 0.9);
            else if (k === 3) { if (h < 80) plant('snowpine', x, z, 1 + r() * 0.8); }
            else if (k === 4) plant(h < 6 ? 'palm' : 'leaf', x, z, 0.9 + r() * 0.6);
        }
        // the park and the oasis
        const park = lots.find((l) => l.kind === 'park');
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = 12 + (i % 3) * 5; plant('leaf', park.x + Math.cos(a) * rr, park.z + Math.sin(a) * rr, 1.1); }
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, rr = 30 + (i % 2) * 6; plant('palm', OASIS[0] + Math.cos(a) * rr, OASIS[1] + Math.sin(a) * rr, 1.2); }
        const q1 = new THREE.PlaneGeometry(4, 8); q1.translate(0, 4, 0);
        const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
        const geo = mergeGeometries([q1, q2]);
        Object.entries(kinds).forEach(([kind, mats], i) => {
            if (!mats.length) return;
            group.add(instanced(geo, cel({ map: treeTexture(kind, i + 3), alphaTest: 0.5, side: THREE.DoubleSide }), mats));
        });
        const rocks = [];
        for (let k = 0, tries = 0; k < 140 && tries < 2000; tries++) {
            const x = (r() - 0.5) * (SIZE - 60), z = (r() - 0.5) * (SIZE - 60);
            weights(x, z, w);
            if (w[1] + w[3] < 0.6) continue;
            if (edge(x, z, 1)?.e < 6 || kept(x, z) || heightAt(x, z) < SEA + 1 || railNear(x, z)?.d < 8) continue;
            const s = 1.5 + r() * 3.5;
            rocks.push(place(x, heightAt(x, z) - s * 0.3, z, r() * 6, s, s * 0.7, s * 1.2));
            addOb({ x, z, r: s * 0.95 });
            k++;
        }
        group.add(instanced(new THREE.IcosahedronGeometry(1, 0), cel({ map: TX.rock }), rocks));
    }

    /* ---------- the sky ---------- */
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
            uSunCol: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() }, uCloud: { value: 0.2 }, uStars: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }
        },
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 14), skyMat);
    sky.renderOrder = -1; sky.frustumCulled = false;
    group.add(sky);

    /* ---------- the minimap picture ---------- */
    const mapC = document.createElement('canvas'); mapC.width = mapC.height = 256;
    {
        const x = mapC.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.setTransform(-0.5, 0, 0, -0.5, 256, 256); x.drawImage(base, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0);
        x.fillStyle = 'rgba(4,7,15,0.55)'; x.fillRect(0, 0, 256, 256);
        const M = (wx, wz) => [(HALF - wx) / SIZE * 256, (HALF - wz) / SIZE * 256];
        x.lineJoin = x.lineCap = 'round';
        x.strokeStyle = '#8a7a6a'; x.lineWidth = 1; x.setLineDash([2, 2]); x.beginPath();
        for (let i = 0; i <= rail.n; i++) { const [px, py] = M(rail.x[i % rail.n], rail.z[i % rail.n]); i ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke(); x.setLineDash([]);
        for (const rd of roads) {
            x.strokeStyle = rd.lines === 'highway' ? '#ffd27a' : rd.surface === 'tarmac' || rd.bridge ? '#dff4ff' : '#c8a878';
            x.lineWidth = rd.lines === 'highway' ? 3 : rd.surface === 'tarmac' ? 1.6 : 1.2;
            x.beginPath();
            for (let k = 0; k <= rd.n - (rd.closed ? 0 : 1); k++) { const s = S[rd.i0 + (k % rd.n)], [px, py] = M(s.x, s.z); k ? x.lineTo(px, py) : x.moveTo(px, py); }
            x.stroke();
        }
    }

    /* ---------- the physics query ---------- */
    const bridgeY = (x, z) => {
        const a = S[pier.i0], b = S[pier.i0 + pier.n - 1];
        if (Math.abs(x - a.x) > pier.w / 2 || z > Math.max(a.z, b.z) || z < Math.min(a.z, b.z)) return -Infinity;
        return pier.deck;
    };
    let lastI = 0;
    function query(x, z, hint) {
        const g = heightAt(x, z);
        let y = g, surface = null;
        const by = bridgeY(x, z);
        if (by > y - 0.5 && by > -Infinity) { y = Math.max(y, by); surface = 'concrete'; }
        const ry = rampY(x, z);
        if (ry > y) { y = ry; surface = 'concrete'; }
        const e = edge(x, z, 1, (s) => s.road.bridge && surface !== 'concrete');
        if (!surface) {
            if (e && e.e < 0) surface = S[e.i].road.surface;
            else if (e && e.e < 2.5) surface = 'verge';
            else if (railNear(x, z)?.d < 3) surface = 'gravel';
            else surface = surfAt(x, z);
        }
        const water = y < SEA - 0.3;
        if (water) surface = 'water';
        let i = e ? e.i : hint != null ? hint : -1;
        if (i < 0) { let bd = Infinity; S.forEach((s, k) => { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; i = k; } }); }
        lastI = i;
        const s = S[i];
        const q = { i, t: 0, prog: 0, y, surface, water, tx: s.tx, tz: s.tz, sx: s.rx, sz: s.rz, cx: s.x, cz: s.z, cy: s.y, side: 0, d: 0, ad: 0, wall: 1e9 };
        const hit = obHit(x, z);
        if (hit) { q.d = hit.pen; q.ad = hit.pen; q.wall = 0; q.sx = -hit.nx; q.sz = -hit.nz; }
        return q;
    }
    function areaAt(x, z) {
        const w = weights(x, z, [0, 0, 0, 0, 0]);
        if (w[0] > 0.5) return AREAS[0];
        let k = 1; for (let j = 2; j < 5; j++) if (w[j] > w[k]) k = j;
        return AREAS[k];
    }
    const spawn = { x: -2.7, z: -40, y: heightAt(-2.7, -40), heading: 0, i: edge(-2.7, -40, 1).i };

    const world = {
        isWorld: true, group, sky, S, N: S.length, roads, rail, trains, ducks, ramps, crossings, traps, smash, heightAt, query, areaAt, roadById, mapC,
        def: { id: 'world', name: 'FREE ROAM', headlights: 1, rain: false, surface: 'tarmac', fog: '#a8b8c8', fogNear: 100, fogFar: 800 },
        wet: false, rainK: 0, windowMats, lampHeadM, poolM, beamM, skyMat,
        gridSlot: () => spawn, spawn,
        animate(t) { anim.forEach((f) => f(t)); },
        updTrains,
        makePath, resample,
        buildMs: 0
    };
    world.buildMs = Math.round(performance.now() - t0);
    return world;
}

/* ================================================================== */
/* Day, night and weather: moves the sun and moon, colours the sky, fog and light, brings rain,
   snow (up in the peaks), fog banks and thunderstorms. */
export class Atmos {
    constructor(world, hour = 16.5) {
        this.w = world; this.hour = hour; this.rate = 24 / 720;    // a day lasts twelve minutes
        this.kind = 'clear'; this.cur = Object.assign({}, WEATHER.clear); this.next = 140;
        this.flash = 0; this.boltT = 5; this.thunder = 0;
        this.lampK = 0; this.rainK = 0; this.snow = false;
        this.c = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), amb: new THREE.Color(), gnd: new THREE.Color(), disc: new THREE.Color(), cloud: new THREE.Color() };
        this.grey = new THREE.Color(); this.tmp = new THREE.Color();
    }
    setWeather(k) { this.kind = k; this.next = 100 + Math.random() * 120; }
    cycleWeather() { this.setWeather(WORDER[(WORDER.indexOf(this.kind) + 1) % WORDER.length]); return WEATHER[this.kind].name; }
    get name() { return WEATHER[this.kind].name; }
    get clock() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    update(dt, env, o = {}) {
        this.hour = (this.hour + dt * this.rate * (o.fast ? 40 : 1)) % 24;
        if ((this.next -= dt) <= 0) {
            const opts = WORDER.filter((k) => k !== this.kind), tot = opts.reduce((s, k) => s + WCHANCE[k], 0);
            let r = Math.random() * tot, pick = opts[0];
            for (const k of opts) { r -= WCHANCE[k]; if (r <= 0) { pick = k; break; } }
            this.setWeather(pick);
            if (o.onChange) o.onChange(WEATHER[pick].name);
        }
        const tgt = WEATHER[this.kind], k = 1 - Math.exp(-dt / 10);
        for (const p of ['cloud', 'precip', 'fog', 'storm']) this.cur[p] += (tgt[p] - this.cur[p]) * k;
        const { cloud, precip, fog, storm } = this.cur;
        // blend the two time-of-day keys either side of now
        let a = KEYS[0], b = KEYS[1];
        for (let i = 0; i < KEYS.length - 1; i++) if (this.hour >= KEYS[i][0] && this.hour < KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
        const t = (this.hour - a[0]) / (b[0] - a[0]), A = a[1], B = b[1], c = this.c;
        for (const n of Object.keys(c)) c[n].lerpColors(A[n], B[n], t);
        const sunI = lerp(A.sunI, B.sunI, t), ambI = lerp(A.ambI, B.ambI, t), stars = lerp(A.stars, B.stars, t);
        // overcast: everything drifts toward a flat grey of the same brightness
        const lum = c.hor.r * 0.3 + c.hor.g * 0.55 + c.hor.b * 0.15;
        this.grey.setRGB(lum * 0.92, lum * 0.96, lum * 1.02);
        c.top.lerp(this.tmp.copy(this.grey).multiplyScalar(0.8), cloud * 0.85);
        c.hor.lerp(this.grey, cloud * 0.8);
        c.fog.lerp(this.grey, Math.max(cloud * 0.7, fog * 0.85));
        c.cloud.lerp(this.tmp.copy(this.grey).multiplyScalar(1.1 - storm * 0.5), cloud * 0.7);
        c.sun.lerp(this.grey, cloud * 0.5);
        c.amb.lerp(this.grey, cloud * 0.4);
        // sun and moon
        const th = (this.hour - 6) / 12 * Math.PI, sy = Math.sin(th);
        const day = smooth(-0.1, 0.15, sy);
        const sunV = new THREE.Vector3(-Math.cos(th), sy, -0.35).normalize();
        const moonV = new THREE.Vector3(Math.cos(th), Math.max(0.3, -sy), 0.35).normalize();
        const L = day > 0.5 ? sunV : moonV;
        env.sun.position.copy(L).multiplyScalar(100);
        env.sun.color.copy(c.sun); env.sun.intensity = sunI * (1 - 0.72 * cloud);
        // lightning
        if (storm > 0.6) {
            if ((this.boltT -= dt) <= 0) { this.flash = 1; this.boltT = 3 + Math.random() * 8; this.thunder = 0.4 + Math.random() * 1.6; }
        }
        if (this.thunder > 0 && (this.thunder -= dt) <= 0 && o.onThunder) o.onThunder();
        this.flash = Math.max(0, this.flash - dt * 5);
        const fl = this.flash > 0.5 || (this.flash > 0.2 && this.flash < 0.35) ? this.flash : 0;
        env.hemi.color.copy(c.amb); env.hemi.groundColor.copy(c.gnd); env.hemi.intensity = ambI * (1 - 0.1 * cloud) + fl * 5;
        env.sunDir.copy(sunV.y > -0.08 ? sunV : moonV);
        env.sunDisc.material.color.copy(sunV.y > -0.08 ? c.disc : this.tmp.set('#c8d4ff')).multiplyScalar(1 - cloud * 0.9);
        env.sunDisc.visible = cloud < 0.85;
        const far = lerp(lerp(820, 460, cloud * 0.6), 95, fog);
        env.scene.fog.color.copy(c.fog); env.scene.fog.far = far; env.scene.fog.near = far * 0.1;
        env.scene.background.copy(c.fog);
        const u = this.w.skyMat.uniforms;
        u.uTop.value.copy(c.top); u.uHor.value.copy(c.hor); u.uFog.value.copy(c.fog); u.uSun.value.copy(sunV);
        u.uSunCol.value.copy(c.disc).multiplyScalar(day * (1 - cloud));
        u.uCloud.value = Math.max(0.1, cloud); u.uCloudCol.value.copy(c.cloud); u.uStars.value = stars * (1 - cloud);
        u.uTime.value = (u.uTime.value + dt) % 10000; u.uFlash.value = fl * 0.6;
        this.lampK = clamp(1 - day + fog * 0.4 + precip * cloud * 0.35, 0, 1);
        this.rainK = precip > 0.05 ? precip : 0;
        this.snow = !!o.cold;
        this.dayK = day;
    }
}

/* ================================================================== */
/* A free roam session: traffic, rival sprints, ducks, ramps, areas. */
const TRAFFIC_PAINT = ['#c4c9d0', '#2a3139', '#7a1a1a', '#2a5aa8', '#e8e8e8', '#3a6a4a', '#c8a040', '#5a5a68', '#8a4a2a', '#1c1f24'];
const CHALLENGES = [
    { id: 'ring', name: 'RING SPRINT', rival: 0, road: 'ring', from: 0.04, to: 0.42 },
    { id: 'city', name: 'DOWNTOWN DASH', rival: 1, pts: [[-150, -200], [-150, 0], [0, 0], [0, 150], [150, 150], [150, -75], [75, -75]] },
    { id: 'dunes', name: 'DUNE RUN', rival: 2, road: 'desert', from: 0, to: 1 },
    { id: 'summit', name: 'SUMMIT CLIMB', rival: 3, road: 'pass', from: 0, to: 1 },
    { id: 'forest', name: 'FOREST RALLY', rival: 4, road: 'forest', from: 0.1, to: 1.05 },
    { id: 'coast', name: 'COAST RUN', rival: 5, road: 'coast', from: 0, to: 1 }
];
export class Roam {
    constructor(world, api) {
        this.w = world; this.api = api;
        const C = api.CFG;
        if (!C.roam) C.roam = { ducks: [], won: {}, hour: 16.5 };
        this.save = C.roam;
        this.atmos = new Atmos(world, this.save.hour || 16.5);
        this.area = null; this.areaT = 0; this.areaCand = null;
        this.npcs = []; this.ch = null; this.prevAir = 0; this.hinted = new Set(); this.promptT = 0; this.waterT = 0;
        this.group = new THREE.Group(); world.group.add(this.group);
        // the rival sprint markers: tall pillars of light
        this.markers = CHALLENGES.map((c) => {
            const path = this.route(c);
            const x = path.x[0], z = path.z[0], y = world.heightAt(x, z);
            const m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 70, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#1a4a5a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
            m.position.set(x, y + 35, z); glows(m); this.group.add(m);
            const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4, 16), new THREE.MeshBasicMaterial({ color: '#3ad0ff', side: THREE.DoubleSide }));
            ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.15, z); glows(ring); this.group.add(ring);
            return { c, path, x, z, m, ring };
        });
        this.paintMarkers();
        this.ducks = world.ducks;
        this.ducks.forEach((d) => { d.mesh.visible = !this.save.ducks.includes(d.id); });
        this.spawnTraffic();
        if (!this.save.traps) this.save.traps = {};
        if (!this.save.jumps) this.save.jumps = {};
        world.smash.forEach((o) => world.smash.set(o, true));
        this.trapSide = {};
    }
    route(c) {
        if (c.path) return c.path;
        let pts;
        if (c.pts) pts = this.w.resample(c.pts, false, true);
        else {
            const rd = this.w.roadById(c.road), n = rd.n, S = this.w.S;
            const a = Math.round(c.from * n), b = Math.round(c.to * (rd.closed ? n : n - 1));
            pts = []; for (let k = a; k <= b; k++) { const s = S[rd.i0 + (rd.closed ? k % n : Math.min(k, n - 1))]; pts.push([s.x, s.z]); }
        }
        return (c.path = this.w.makePath(pts, false, { vmax: 46, lat: 15, dec: 13 }));
    }
    paintMarkers() {
        for (const mk of this.markers) {
            const won = this.save.won[mk.c.id];
            mk.m.material.color.set(won ? '#5a4410' : '#1a4a5a');
            mk.ring.material.color.set(won ? '#ffd27a' : '#3ad0ff');
        }
    }
    spawnTraffic() {
        const W = this.w, base = CARS.filter((c) => !c.unlock), r = rng(99);
        const ring = W.roadById('ring');
        const ringPts = Array.from({ length: ring.n }, (_, k) => [W.S[ring.i0 + k].x, W.S[ring.i0 + k].z]);
        const routes = [
            { path: W.makePath(ringPts, true, { vmax: 25, lat: 6 }), lanes: [2.3, 6.2], count: 8 },
            { path: W.makePath([...ringPts].reverse(), true, { vmax: 25, lat: 6 }), lanes: [2.3, 6.2], count: 8 },
            { path: W.makePath(W.resample([[-75, -75], [75, -75], [75, 75], [-75, 75]], true, true), true, { vmax: 13, lat: 4 }), lanes: [2.7], count: 3 },
            { path: W.makePath(W.resample([[-150, 150], [150, 150], [150, -150], [-150, -150]], true, true), true, { vmax: 14, lat: 4 }), lanes: [2.7], count: 4 }
        ];
        for (const rt of routes) for (let k = 0; k < rt.count; k++) {
            const spec = Object.assign({}, base[(r() * base.length) | 0], { body: TRAFFIC_PAINT[(r() * TRAFFIC_PAINT.length) | 0], num: null });
            const i = Math.floor((k + r() * 0.4) / rt.count * rt.path.n), lane = rt.lanes[k % rt.lanes.length];
            const p = this.lanePos(rt.path, i, lane);
            const c = this.api.newCar(spec, { x: p.x, z: p.z, y: W.heightAt(p.x, p.z), heading: p.h });
            c.npc = { path: rt.path, i, f: i, lane, speed: rt.path.v[i] * (0.85 + r() * 0.2), far: false, kind: 'traffic' };
            this.api.addCar(c); this.npcs.push(c);
        }
    }
    lanePos(P, i, lane, frac = 0) {
        i = P.at(i); const j = P.at(i + 1);
        const x = lerp(P.x[i], P.x[j], frac), z = lerp(P.z[i], P.z[j], frac);
        return { x: x - P.tz[i] * lane, z: z + P.tx[i] * lane, h: Math.atan2(P.tx[i], P.tz[i]) };
    }
    // steering for traffic and rivals: follow the lane, slow for bends and for cars ahead
    drive(c, cars) {
        const n = c.npc, P = n.path;
        let i = n.i;
        const d2 = (k) => { const p = this.lanePos(P, k, n.lane); return (p.x - c.x) ** 2 + (p.z - c.z) ** 2; };
        for (let s = 0; s < 8; s++) { const j = P.at(i + 1); if (j !== i && d2(j) < d2(i)) i = j; else break; }
        n.i = i;
        if (n.count > 0) return { steer: 0, throttle: 0, brake: 1, handbrake: false };
        if (!P.closed && i >= P.n - 2) return { steer: 0, throttle: 0, brake: 1, handbrake: false };
        const look = 2 + Math.floor(c.speed / 5);
        const t = this.lanePos(P, i + look, n.lane);
        const d = angDiff(Math.atan2(t.x - c.x, t.z - c.z), c.h);
        let vmax = Math.min(P.v[P.at(i + 2)], P.v[P.at(i + 5)]) * (n.skill || 1);
        if (n.kind === 'traffic') {
            vmax = Math.min(vmax, n.speed);
            const fx = Math.sin(c.h), fz = Math.cos(c.h);
            for (const o of cars) {
                if (o === c) continue;
                const dx = o.x - c.x, dz = o.z - c.z;
                if (Math.abs(dx) > 22 || Math.abs(dz) > 22) continue;
                const fwd = dx * fx + dz * fz, side = dx * fz - dz * fx;
                if (fwd > 0 && fwd < 20 && Math.abs(side) < 2.4) vmax = Math.min(vmax, Math.max(0, (fwd - 7) * 0.8));
            }
            // stop for a train at a level crossing
            for (const cr of this.w.crossings) {
                const dx = cr.x - c.x, dz = cr.z - c.z, fwd = dx * fx + dz * fz;
                if (fwd > 0 && fwd < 26 && Math.abs(dx * fz - dz * fx) < 8 && cr.lights[0].material.color.r > 0.5) vmax = Math.min(vmax, Math.max(0, (fwd - 12) * 0.6));
            }
        } else if (n.band) vmax *= n.band;
        return { steer: clamp(-d * 2.6, -1, 1), throttle: c.speed < vmax ? 1 : 0, brake: c.speed > vmax + 2.5 ? 1 : 0, handbrake: false };
    }
    resetNpc(c) {
        const n = c.npc, p = this.lanePos(n.path, n.i, n.lane);
        c.place(p.x, this.w.heightAt(p.x, p.z) + 0.3, p.z, p.h);
        c.lastGy = c.y; c.stuckT = 0; c.health = 100; c.wrecked = 0; c.wrecking = false;
    }
    // far-away traffic just slides along its lane, no physics
    moveFar(c, dt, player) {
        const n = c.npc;
        const dd = Math.hypot(c.x - player.x, c.z - player.z);
        if (!n.far && dd > 240 && n.kind === 'traffic') { n.far = true; n.f = n.i; }
        if (n.far && dd < 200) {
            n.far = false;
            n.i = Math.floor(n.f) % n.path.n;
            const p = this.lanePos(n.path, n.i, n.lane), v = n.path.v[n.i] * 0.8;
            c.place(p.x, this.w.heightAt(p.x, p.z), p.z, p.h);
            c.vx = Math.sin(p.h) * v; c.vz = Math.cos(p.h) * v; c.lastGy = c.y;
        }
        if (n.far) {
            const P = n.path, i = Math.floor(n.f) % P.n;
            n.f = (n.f + Math.min(n.speed, P.v[i]) * dt / 4) % P.n;
            const k = Math.floor(n.f), p = this.lanePos(P, k, n.lane, n.f - k);
            c.x = p.x; c.z = p.z; c.h = p.h; c.y = this.w.heightAt(p.x, p.z); c.speed = 0; c.vx = c.vz = 0;
            c.q = this.w.query(c.x, c.z, c.q ? c.q.i : null); c.hint = c.q.i;
        }
        c.mesh.root.visible = dd < 520 && c.mesh.root.visible;
    }
    // one frame of the session (after the physics steps)
    frame(dt, inp) {
        const api = this.api, car = api.car, W = this.w;
        // time and weather
        const area = W.areaAt(car.x, car.z);
        this.atmos.update(dt, api.env, {
            fast: inp.fastTime, cold: area.id === 'frost',
            onChange: (n) => api.feed(`Weather: ${n.toLowerCase()}`, 0),
            onThunder: () => { api.audio.fx('boom'); api.shake(0.25); }
        });
        if (inp.nextWeather) api.feed(`Weather: ${this.atmos.cycleWeather().toLowerCase()}`, 0);
        this.save.hour = this.atmos.hour;
        const A = this.atmos;
        W.rainK = A.rainK; W.wet = A.rainK > 0.3 && !A.snow; W.def.rain = A.rainK > 0.2 && !A.snow;
        W.windowMats.forEach((m) => { m.emissiveIntensity = 0.06 + A.lampK * 0.9; });
        W.lampHeadM.color.set('#3a3c40').lerp(this.tmpC || (this.tmpC = new THREE.Color('#ffd890')), A.lampK);
        W.poolM.color.set('#6a5a3a').multiplyScalar(A.lampK);
        W.beamM.color.set('#4a4430').multiplyScalar(0.3 + A.lampK);
        if (car.lamps) { car.lamps.forEach((L) => { L.intensity = 34 * A.lampK; }); (car.mesh.beams || []).forEach((b) => { b.material.opacity = A.lampK; b.visible = A.lampK > 0.05; }); }
        // traffic far away
        for (const c of this.npcs) this.moveFar(c, dt, car);
        W.updTrains(dt, api.T);
        // trains: a horn when one passes close
        for (const tr of W.trains) {
            const d = Math.hypot(tr.head.x - car.x, tr.head.z - car.z);
            if (d < 70 && !tr.honked) { tr.honked = true; api.audio.beep(196, 0.5); setTimeout(() => api.audio.beep(233, 0.6), 520); }
            if (d > 140) tr.honked = false;
        }
        // which area are we in
        if (area !== this.area) {
            if (this.areaCand !== area) { this.areaCand = area; this.areaT = 0; }
            this.areaT += dt;
            if (this.areaT > 1.2 || !this.area) { this.area = area; api.message(area.name, 2.2); }
        } else this.areaCand = null;
        // speed traps: crossing the line between the poles
        for (const tp of W.traps) {
            const dx = car.x - tp.x, dz = car.z - tp.z, along = dx * tp.tx + dz * tp.tz, across = Math.abs(dx * tp.rx + dz * tp.rz);
            const side = along > 0 ? 1 : -1, was = this.trapSide[tp.id];
            this.trapSide[tp.id] = side;
            if (was && was !== side && across < tp.hw && Math.abs(along) < 8 && car.speed > 4) {
                const kmh = Math.round(car.speed * 3.6), best = this.save.traps[tp.id] || 0;
                tp.flashes.forEach((f) => f.material.color.set('#ffffff')); setTimeout(() => tp.flashes.forEach((f) => f.material.color.set('#3a0a1a')), 160);
                api.audio.beep(1760, 0.06);
                api.message(`SPEED TRAP ${api.speedTxt(car.speed)}`, 1.8, kmh < best);
                if (kmh > best) { this.save.traps[tp.id] = kmh; api.reward(best ? `New Record · ${tp.name.toLowerCase()}` : `Speed Trap · ${tp.name.toLowerCase()}`, Math.round(kmh / (best ? 4 : 2))); }
            }
        }
        // smashables
        for (const o of W.smash) {
            if (!o.alive) { if ((o.t -= dt) <= 0 && Math.hypot(o.x - car.x, o.z - car.z) > 60) W.smash.set(o, true); continue; }
            if (Math.abs(o.x - car.x) > 2.2 || Math.abs(o.z - car.z) > 2.2 || car.speed < 3) continue;
            W.smash.set(o, false); o.t = 90;
            for (let k = 0; k < 10; k++) api.puff(o.x, o.y + 0.5, o.z, o.col[k % 2], car.vx * 0.5 + (Math.random() - 0.5) * 6, 3 + Math.random() * 5, car.vz * 0.5 + (Math.random() - 0.5) * 6, 0.35, 0.2, 0.7);
            api.audio.thud(0.35);
            api.smashed();
        }
        // into the sea
        if (car.q.water && car.y < SEA - 0.2) {
            if (this.waterT === 0) { api.audio.splash(); for (let k = 0; k < 20; k++) api.puff(car.x + (Math.random() - 0.5) * 3, SEA + 0.3, car.z + (Math.random() - 0.5) * 3, '#c8e4f4', (Math.random() - 0.5) * 8, 4 + Math.random() * 5, (Math.random() - 0.5) * 8, 0.6, 2.4, 0.9); }
            this.waterT += dt;
            if (this.waterT > 1.1) { this.waterT = 0; api.message('SPLASH!', 1.2, true); api.reset(car); }
        } else this.waterT = 0;
        // golden ducks
        for (const d of this.ducks) {
            if (!d.mesh.visible) continue;
            const dist = Math.hypot(d.x - car.x, d.z - car.z);
            if (dist < 50 && !this.hinted.has(d.id)) { this.hinted.add(d.id); api.feed('Something golden is nearby', 0); }
            if (dist < 3.4 && Math.abs(car.y + 0.6 - d.y) < 3.2) {
                d.mesh.visible = false;
                this.save.ducks.push(d.id);
                const n = this.save.ducks.length;
                api.audio.fx('patch'); api.fx.sparkle(car, '#ffd27a'); api.fx.tint('#ffd27a', 0.8);
                api.message(`GOLDEN DUCK ${n}/${this.ducks.length}`, 2);
                api.reward('Golden Duck', 100);
                if (n === this.ducks.length) { api.message('EVERY DUCK FOUND!', 3); api.reward('All Golden Ducks', 2000); }
            }
        }
        this.challenge(dt, inp);
        api.saveCfg();
    }
    challenge(dt, inp) {
        const api = this.api, car = api.car;
        if (!this.ch) {
            // standing in a marker's light: offer the race
            this.promptT -= dt;
            for (const mk of this.markers) {
                const d = Math.hypot(mk.x - car.x, mk.z - car.z);
                if (d < 6 && car.speed < 7) {
                    if (this.promptT <= 0) { api.message(`${mk.c.name} vs ${RIVALS[mk.c.rival].name} · ENTER`, 1.8); this.promptT = 1.8; }
                    if (inp.ok) { this.startCh(mk); return; }
                } else if (d < 40 && !mk.told) { mk.told = true; api.feed(`${mk.c.name}: stop in the light to race`, 0); }
                if (d > 80) mk.told = false;
            }
            return;
        }
        const ch = this.ch, P = ch.path;
        ch.t += dt;
        if (ch.count > 0) {
            const before = Math.ceil(ch.count);
            ch.count -= dt;
            car.vx = car.vz = 0; car.w = 0; car.stall = 0.05;
            ch.rival.npc.count = ch.count;
            const now = Math.ceil(ch.count);
            if (now !== before) { if (now > 0) { api.message(String(now), 0.9); api.audio.beep(660, 0.18); } else { api.message('GO!', 1); api.audio.beep(1320, 0.35); ch.t = 0; } }
            return;
        }
        // rubber band: the rival eases off when far ahead and pushes when behind
        const gap = (ch.rival.npc.i - this.playerIdx()) * 4;
        ch.rival.npc.band = gap > 60 ? 0.86 : gap < -60 ? 1.12 : 1;
        // gates
        const g = ch.gates[ch.next];
        if (Math.hypot(g.x - car.x, g.z - car.z) < 11) {
            ch.next++;
            api.audio.beep(990, 0.08);
            if (ch.next >= ch.gates.length) return this.endCh(true);
            this.showGates();
        } else if (Math.hypot(g.x - car.x, g.z - car.z) > 320) return this.endCh(false, 'Sprint abandoned');
        if (ch.rival.npc.i >= P.n - 3 && !ch.rivalDone) { ch.rivalDone = true; return this.endCh(false); }
    }
    playerIdx() {
        const P = this.ch.path, car = this.api.car;
        let best = 0, bd = Infinity;
        for (let i = 0; i < P.n; i += 2) { const d = (P.x[i] - car.x) ** 2 + (P.z[i] - car.z) ** 2; if (d < bd) { bd = d; best = i; } }
        return best;
    }
    startCh(mk) {
        const api = this.api, car = api.car, P = mk.path, W = this.w;
        const p0 = this.lanePos(P, 2, -2.6), p1 = this.lanePos(P, 2, 2.6);
        car.place(p0.x, W.heightAt(p0.x, p0.z) + 0.2, p0.z, p0.h); car.lastGy = car.y;
        const info = RIVALS[mk.c.rival], base = CARS.filter((c) => !c.unlock);
        const rival = api.newCar(Object.assign({}, base[(mk.c.rival * 3 + 2) % base.length], { num: 7 + mk.c.rival * 11 }), { x: p1.x, z: p1.z, y: W.heightAt(p1.x, p1.z), heading: p1.h });
        rival.npc = { path: P, i: 2, lane: 2.6, kind: 'rival', skill: 0.95, count: 3, far: false };
        rival.driver = null; rival.rivalName = info.name;
        api.addCar(rival);
        const gates = [];
        for (let i = 30; i < P.n - 10; i += 30) gates.push({ i });
        gates.push({ i: P.n - 1, last: true });
        for (const g of gates) { const p = this.lanePos(P, g.i, 0); g.x = p.x; g.z = p.z; g.h = p.h; g.y = W.heightAt(p.x, p.z); }
        this.ch = { mk, path: P, rival, gates, next: 0, count: 3, t: 0, meshes: [] };
        api.message(`${mk.c.name} vs ${info.name}`, 1.4);
        api.audio.beep(880, 0.2);
        mk.m.visible = mk.ring.visible = false;
        this.showGates();
    }
    showGates() {
        const ch = this.ch;
        ch.meshes.forEach((m) => this.group.remove(m)); ch.meshes = [];
        ch.gates.slice(ch.next, ch.next + 2).forEach((g, k) => {
            const col = g.last ? '#ffd27a' : k === 0 ? '#3ad0ff' : '#1a5a6a';
            const grp = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: col, fog: false });
            for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), mat); p.position.set(sg * 9, 3.5, 0); grp.add(glows(p)); }
            const top = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.8, 0.4), mat); top.position.y = 7; grp.add(glows(top));
            grp.position.set(g.x, g.y, g.z); grp.rotation.y = g.h;
            this.group.add(grp); ch.meshes.push(grp);
        });
    }
    endCh(win, why) {
        const api = this.api, ch = this.ch;
        ch.meshes.forEach((m) => this.group.remove(m));
        const id = ch.mk.c.id, name = ch.rival.rivalName;
        if (win) {
            const first = !this.save.won[id];
            this.save.won[id] = true;
            api.message(`YOU BEAT ${name.toUpperCase()}!`, 2.6);
            api.reward(`${ch.mk.c.name} won · ${ch.t.toFixed(1)}s`, first ? 500 : 150);
            api.audio.fx('patch');
            if (CHALLENGES.every((c) => this.save.won[c.id])) api.feed('Every rival beaten!', 0, 'hot');
        } else {
            api.message(why ? why.toUpperCase() : `${name.toUpperCase()} WINS`, 2.4, true);
            api.audio.fx('hit');
        }
        const rv = ch.rival;
        setTimeout(() => api.removeCar(rv), win ? 2500 : 1500);
        ch.mk.m.visible = ch.mk.ring.visible = true;
        this.ch = null; this.paintMarkers();
    }
    // the HUD
    hud() {
        const A = this.atmos;
        return {
            ducks: this.save.ducks.length, of: this.ducks.length, clock: A.clock, weather: A.snow && A.rainK > 0.05 ? 'SNOW' : A.name,
            area: this.area ? this.area.name : '', gate: this.ch ? `Gate ${Math.min(this.ch.next + 1, this.ch.gates.length)}/${this.ch.gates.length}` : null,
            time: this.ch && this.ch.count <= 0 ? this.ch.t : null
        };
    }
    drawMap(x, cars, car) {
        const M = (wx, wz) => [(HALF - wx) / SIZE * 256, (HALF - wz) / SIZE * 256];
        const [cx, cy] = M(car.x, car.z);
        x.clearRect(0, 0, 64, 64);
        x.drawImage(this.w.mapC, Math.round(cx) - 32, Math.round(cy) - 32, 64, 64, 0, 0, 64, 64);
        const dot = (wx, wz, col, s = 3) => { const [px, py] = M(wx, wz), X = Math.round(px - cx + 32), Yy = Math.round(py - cy + 32); if (X < -2 || Yy < -2 || X > 66 || Yy > 66) return; x.fillStyle = '#04070f'; x.fillRect(X - (s >> 1) - 1, Yy - (s >> 1) - 1, s + 2, s + 2); x.fillStyle = col; x.fillRect(X - (s >> 1), Yy - (s >> 1), s, s); };
        for (const tr of this.w.trains) tr.cars.forEach(({ ob }) => dot(ob.x, ob.z, '#8a7a6a', 2));
        for (const c of cars) if (c !== car) dot(c.x, c.z, c.npc && c.npc.kind === 'rival' ? '#ff3a6e' : '#6a7480', 2);
        if (!this.ch) for (const mk of this.markers) dot(mk.x, mk.z, this.save.won[mk.c.id] ? '#ffd27a' : '#3ad0ff', 4);
        else this.ch.gates.slice(this.ch.next, this.ch.next + 1).forEach((g) => dot(g.x, g.z, '#ffe23a', 4));
        dot(car.x, car.z, '#ffe23a', 3);
        x.fillStyle = '#ffffff'; x.fillRect(32 - Math.round(Math.sin(car.h) * 4), 32 - Math.round(Math.cos(car.h) * 4), 1, 1);
    }
    // a jump finished: if it left from a ramp, keep the record for that ramp
    jumpRecord(fx, fz, dist) {
        const k = this.w.ramps.findIndex((r) => Math.hypot(r.x - fx, r.z - fz) < 12);
        if (k < 0) return;
        const best = this.save.jumps[k] || 0;
        if (dist > best) { this.save.jumps[k] = Math.round(dist); if (best) this.api.feed(`Ramp record ${Math.round(dist)} m`, 0, 'hot'); }
    }
    progress() {
        const W = this.w, s = this.save, per = {};
        W.ducks.forEach((d) => { const a = W.areaAt(d.x, d.z).name; per[a] = per[a] || [0, 0]; per[a][1]++; if (s.ducks.includes(d.id)) per[a][0]++; });
        return {
            ducks: [s.ducks.length, W.ducks.length], rivals: [CHALLENGES.filter((c) => s.won[c.id]).length, CHALLENGES.length],
            traps: [Object.keys(s.traps).length, W.traps.length], jumps: [Object.keys(s.jumps).length, W.ramps.length], per
        };
    }
    // the full map: the world picture with everything you can do on it
    drawBigMap(cv) {
        const x = cv.getContext('2d'), N = cv.width, W = this.w, s = this.save, car = this.api.car;
        const M = (wx, wz) => [(HALF - wx) / SIZE * N, (HALF - wz) / SIZE * N];
        x.imageSmoothingEnabled = false;
        x.drawImage(W.mapC, 0, 0, N, N);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = 'bold 11px "Pixelify Sans", sans-serif';
        for (const [name, wx, wz] of [['DOWNTOWN', 0, 0], ['DUNE SEA', -610, -40], ['PINE FOREST', 0, 640], ['FROST PEAKS', 610, -60], ['LIGHTHOUSE COAST', -60, -690]]) {
            const [px, py] = M(wx, wz);
            x.fillStyle = 'rgba(4,7,15,0.75)'; x.fillText(name, px + 1, py + 1); x.fillStyle = '#e8eef6'; x.fillText(name, px, py);
        }
        const mark = (wx, wz, col, shape, label) => {
            const [px, py] = M(wx, wz);
            x.fillStyle = '#04070f';
            if (shape === 'dia') { x.beginPath(); x.moveTo(px, py - 6); x.lineTo(px + 6, py); x.lineTo(px, py + 6); x.lineTo(px - 6, py); x.fill(); x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 4); x.lineTo(px + 4, py); x.lineTo(px, py + 4); x.lineTo(px - 4, py); x.fill(); }
            else if (shape === 'tri') { x.beginPath(); x.moveTo(px, py - 6); x.lineTo(px + 6, py + 4); x.lineTo(px - 6, py + 4); x.fill(); x.fillStyle = col; x.beginPath(); x.moveTo(px, py - 3); x.lineTo(px + 3.5, py + 2.5); x.lineTo(px - 3.5, py + 2.5); x.fill(); }
            else { x.fillRect(px - 4, py - 4, 8, 8); x.fillStyle = col; x.fillRect(px - 3, py - 3, 6, 6); }
            if (label) { x.font = '9px "Pixelify Sans", sans-serif'; x.fillStyle = '#04070f'; x.fillText(label, px + 1, py + 12); x.fillStyle = col; x.fillText(label, px, py + 11); }
        };
        W.ramps.forEach((r, k) => mark(r.x, r.z, s.jumps[k] ? '#ffe23a' : '#8a7a3a', 'tri', s.jumps[k] ? s.jumps[k] + 'm' : ''));
        W.traps.forEach((t) => mark(t.x, t.z, s.traps[t.id] ? '#ff5ab4' : '#7a3a5a', 'sq', s.traps[t.id] ? this.api.speedTxt(s.traps[t.id] / 3.6) : ''));
        this.markers.forEach((mk) => mark(mk.x, mk.z, s.won[mk.c.id] ? '#ffd27a' : '#3ad0ff', 'dia', s.won[mk.c.id] ? '' : RIVALS[mk.c.rival].name));
        W.ducks.forEach((d) => { if (s.ducks.includes(d.id)) { const [px, py] = M(d.x, d.z); x.fillStyle = '#04070f'; x.fillRect(px - 3, py - 3, 6, 6); x.fillStyle = '#ffcc33'; x.fillRect(px - 2, py - 2, 4, 4); } });
        for (const tr of W.trains) { const [px, py] = M(tr.head.x, tr.head.z); x.fillStyle = '#c8ccd4'; x.fillRect(px - 2, py - 2, 4, 4); }
        // you: an arrow
        const [px, py] = M(car.x, car.z);
        x.save(); x.translate(px, py); x.rotate(Math.atan2(-Math.cos(car.h), -Math.sin(car.h)));
        x.fillStyle = '#04070f'; x.beginPath(); x.moveTo(9, 0); x.lineTo(-6, 6); x.lineTo(-3, 0); x.lineTo(-6, -6); x.fill();
        x.fillStyle = '#ffe23a'; x.beginPath(); x.moveTo(7, 0); x.lineTo(-4, 4); x.lineTo(-2, 0); x.lineTo(-4, -4); x.fill();
        x.restore();
        return (cx, cy) => [HALF - cx / N * SIZE, HALF - cy / N * SIZE];
    }
    // fast travel: drop the car on the nearest road to a point on the map
    travel(wx, wz) {
        if (this.ch) return false;
        const W = this.w, S = W.S;
        let best = -1, bd = Infinity;
        S.forEach((s, i) => { if (s.road.bridge) return; const d = (s.x - wx) ** 2 + (s.z - wz) ** 2; if (d < bd) { bd = d; best = i; } });
        const s = S[best], car = this.api.car;
        car.place(s.x - s.rx * 2.6, s.y + 0.4, s.z - s.rz * 2.6, Math.atan2(s.tx, s.tz));
        car.lastGy = car.y; this.area = null;
        return true;
    }
    end() {
        if (this.ch) { this.ch.meshes.forEach((m) => this.group.remove(m)); this.ch = null; }
        this.w.group.remove(this.group);
        this.w.trains.forEach((tr) => { tr.honked = false; });
    }
}

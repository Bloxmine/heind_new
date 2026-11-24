/* Turns a map's solids into meshes and bakes its lighting into a lightmap: every visible face gets a patch
   of texels, and each texel adds up the map's lamps (with shadow rays) and a little ambient light
   darkened by ambient occlusion. A real-time sun with a shadow map comes on top of this. */
import * as THREE from 'three';
import { BOX, rampH, rayBox, rayRamp } from './geom.js';
import { MATS, DRAWN, textures } from './textures.js';
import { cel, glows } from '../rally/retro.js';
import { buildDecor } from './decor.js';

let D = 2.5;            // lightmap texels per metre (maps can ask for fewer)
const PAD = 1;
const V = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const raySolid = (s, o, d, maxT) => (s.k === BOX ? rayBox(s, o[0], o[1], o[2], d[0], d[1], d[2], maxT) : rayRamp(s, o[0], o[1], o[2], d[0], d[1], d[2], maxT));

/* ---------- faces ---------- */
function faceMat(s, n) {
    const m = MATS[s.m] || {};
    if (n[1] > 0.5 && m.top) return m.top;
    if (n[1] <= 0.5 && m.side) return m.side;
    return DRAWN.has(s.m) ? s.m : 'wall';
}

function makeFaces(level, map) {
    const faces = [];
    const B = map.bounds;
    const outside = (p) => p[0] < B.x0 - 0.05 || p[0] > B.x1 + 0.05 || p[2] < B.z0 - 0.05 || p[2] > B.z1 + 0.05 || p[1] < B.y0 - 0.05 || p[1] > B.y1 + 0.7;
    const quad = (p0, p1, p2, p3, n, s) => {
        // keep the winding facing the normal
        if (dot(cross(sub(p1, p0), sub(p2, p0)), n) < 0) { const t = p1; p1 = p3; p3 = t; }
        // hidden if every sample just in front of the face is inside another solid or outside the map
        const pts = [[0.5, 0.5], [0.08, 0.08], [0.92, 0.08], [0.92, 0.92], [0.08, 0.92]].map(([a, b]) => {
            const p = bilerp(p0, p1, p2, p3, a, b);
            return [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03];
        });
        if (pts.every((p) => outside(p) || level.inside(p[0], p[1], p[2]))) return;
        faces.push({ p: [p0, p1, p2, p3], n, s, m: faceMat(s, n) });
    };
    for (const s of level.solids) {
        if (s.ghost || s.clip || s.hide) continue;
        if (s.k === BOX) {
            const { x0, y0, z0, x1, y1, z1 } = s;
            quad(V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0), [1, 0, 0], s);
            quad(V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), [-1, 0, 0], s);
            quad(V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1), [0, 1, 0], s);
            quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y0, z0), V(x0, y0, z0), [0, -1, 0], s);
            quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), [0, 0, 1], s);
            quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), [0, 0, -1], s);
            continue;
        }
        // a ramp: work in (c along the axis, w across it), then map to world
        const ax = s.ax;
        const lo = ax === 0 ? s.x0 : s.z0, hi = ax === 0 ? s.x1 : s.z1, w0 = ax === 0 ? s.z0 : s.x0, w1 = ax === 0 ? s.z1 : s.x1;
        const P = (c, y, w) => (ax === 0 ? V(c, y, w) : V(w, y, c));
        const N = (nc, ny, nw) => norm(ax === 0 ? [nc, ny, nw] : [nw, ny, nc]);
        const k = (s.yb - s.ya) / (hi - lo), th = s.th;
        const ha = s.ya, hb = s.yb;
        if (s.steps) {
            const up = hb > ha ? 1 : -1, H0 = Math.min(ha, hb), H1 = Math.max(ha, hb);
            const n = Math.max(1, Math.round((H1 - H0) / 0.22)), dh = (H1 - H0) / n, run = (hi - lo) / n;
            // c position of the start of step i (counted from the bottom)
            const cAt = (i) => (up > 0 ? lo + run * i : hi - run * i);
            let prev = H0;
            for (let i = 0; i < n; i++) {
                const t = H0 + (i + 0.5) * dh, ca = cAt(i), cb = cAt(i + 1);
                quad(P(ca, prev, w0), P(ca, prev, w1), P(ca, t, w1), P(ca, t, w0), N(-up, 0, 0), s);     // riser
                quad(P(ca, t, w0), P(cb, t, w0), P(cb, t, w1), P(ca, t, w1), [0, 1, 0], s);               // tread
                prev = t;
            }
            quad(P(cAt(n), prev, w0), P(cAt(n), prev, w1), P(cAt(n), H1, w1), P(cAt(n), H1, w0), N(-up, 0, 0), s);
        } else {
            quad(P(lo, ha, w0), P(hi, hb, w0), P(hi, hb, w1), P(lo, ha, w1), N(-k, 1, 0), s);
        }
        quad(P(lo, ha - th, w0), P(hi, hb - th, w0), P(hi, hb - th, w1), P(lo, ha - th, w1), N(k, -1, 0), s);
        quad(P(lo, ha - th, w0), P(hi, hb - th, w0), P(hi, hb, w0), P(lo, ha, w0), N(0, 0, -1), s);
        quad(P(lo, ha - th, w1), P(hi, hb - th, w1), P(hi, hb, w1), P(lo, ha, w1), N(0, 0, 1), s);
        quad(P(lo, ha - th, w0), P(lo, ha - th, w1), P(lo, ha, w1), P(lo, ha, w0), N(-1, 0, 0), s);
        quad(P(hi, hb - th, w0), P(hi, hb - th, w1), P(hi, hb, w1), P(hi, hb, w0), N(1, 0, 0), s);
    }
    return faces;
}
function bilerp(p0, p1, p2, p3, a, b) {
    const r = [0, 0, 0];
    for (let i = 0; i < 3; i++) r[i] = (p0[i] * (1 - a) + p1[i] * a) * (1 - b) + (p3[i] * (1 - a) + p2[i] * a) * b;
    return r;
}

/* ---------- lighting ---------- */
// AO directions: a fixed cosine-weighted set around +z, turned onto each texel's normal
const AO_N = 10, AO_LEN = 2.4;
const AO_DIRS = Array.from({ length: AO_N }, (_, i) => {
    const u = (i + 0.5) / AO_N, phi = i * 2.399963;
    const r = Math.sqrt(u);
    return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)];
});
function basis(n) {
    const t = Math.abs(n[1]) < 0.9 ? norm(cross(n, [0, 1, 0])) : norm(cross(n, [1, 0, 0]));
    return [t, cross(n, t)];
}
export class Lighting {
    constructor(level, map) {
        this.level = level; this.map = map;
        this.lights = map.lights.map((L) => {
            const [x, y, z] = L.p, r = L.r;
            const cand = level.near(x - r, z - r, x + r, z + r).filter((s) => !s.ghost && !s.clip && s.y1 > y - r && s.y0 < y + r);
            return { ...L, cand };
        });
        this.amb = map.ambient;
        const B = map.bake || {};
        this.sky = B.sky || null;            // sky light: colour, and how far a ray must get to count as open sky
        this.skyLen = B.skyLen || 40;
        this.bounce = B.bounce || null;      // light thrown back up from the ground
        this.skyCache = new Map();
    }
    // how much of the sky a point facing n can see (0..1); cached on a coarse grid, it changes slowly
    skyVis(p, n) {
        const k = `${Math.floor(p[0] / 1.5)},${Math.floor(p[1] / 1.5)},${Math.floor(p[2] / 1.5)},${Math.round(n[0] * 2)},${Math.round(n[1] * 2)},${Math.round(n[2] * 2)}`;
        const c = this.skyCache.get(k);
        if (c != null) return c;
        const [t, b] = basis(n);
        let open = 0, tot = 0;
        for (const a of AO_DIRS) {
            const d = [t[0] * a[0] + b[0] * a[1] + n[0] * a[2], t[1] * a[0] + b[1] * a[1] + n[1] * a[2], t[2] * a[0] + b[2] * a[1] + n[2] * a[2]];
            const w = Math.max(0, d[1]) + 0.15;
            tot += w;
            if (d[1] > -0.1 && !this.level.ray(p[0], p[1], p[2], d[0], d[1], d[2], this.skyLen)) open += w;
        }
        const v = tot ? open / tot : 0;
        this.skyCache.set(k, v);
        return v;
    }
    // light arriving at p from the lamps; n = null means from every side (for characters)
    direct(p, n, own, lights = this.lights, out = [0, 0, 0]) {
        for (const L of lights) {
            const dx = L.p[0] - p[0], dy = L.p[1] - p[1], dz = L.p[2] - p[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > L.r * L.r) continue;
            const d = Math.sqrt(d2), dir = [dx / d, dy / d, dz / d];
            let ndl = n ? dot(n, dir) : 0.65;
            if (ndl <= 0) continue;
            const w = 1 - d2 / (L.r * L.r);
            const att = L.i * w * w * 4 / (1 + d2 * 0.35);
            let lit = true;
            for (const s of L.cand) { if (s === own) continue; const h = raySolid(s, p, dir, d - 0.05); if (h) { lit = false; break; } }
            if (!lit) continue;
            out[0] += L.c[0] * att * ndl; out[1] += L.c[1] * att * ndl; out[2] += L.c[2] * att * ndl;
        }
        return out;
    }
    ao(p, n, cand, own) {
        const [t, b] = basis(n);
        let occ = 0;
        for (const a of AO_DIRS) {
            const d = [t[0] * a[0] + b[0] * a[1] + n[0] * a[2], t[1] * a[0] + b[1] * a[1] + n[1] * a[2], t[2] * a[0] + b[2] * a[1] + n[2] * a[2]];
            let best = AO_LEN;
            for (const s of cand) { if (s === own) continue; const h = raySolid(s, p, d, best); if (h) best = h.t; }
            occ += 1 - best / AO_LEN;
        }
        return 1 - Math.min(1, occ / AO_N * 1.25);
    }
    // what a character standing here is lit by (besides the sun)
    probe(x, y, z) {
        const out = this.direct([x, y, z], null, null);
        const a = 0.9;
        const r = [this.amb[0] * a + out[0] * 0.5, this.amb[1] * a + out[1] * 0.5, this.amb[2] * a + out[2] * 0.5];
        if (this.sky) {
            const v = (this.skyVis([x, y, z], [0, 1, 0]) * 0.6 + this.skyVis([x, y, z], [1, 0, 0]) * 0.2 + this.skyVis([x, y, z], [-1, 0, 0]) * 0.2) * 0.55;
            for (let i = 0; i < 3; i++) r[i] += this.sky[i] * v + (this.bounce ? this.bounce[i] * 0.25 : 0);
        }
        return r;
    }
}

/* ---------- the atlas ---------- */
function pack(charts) {
    const area = charts.reduce((a, c) => a + c.w * c.h, 0);
    let W = 256;
    while (W * W < area * 1.35) W *= 2;
    for (;;) {
        const sorted = [...charts].sort((a, b) => b.h - a.h);
        let x = 0, y = 0, rowH = 0;
        for (const c of sorted) {
            if (x + c.w > W) { x = 0; y += rowH; rowH = 0; }
            c.x = x; c.y = y; x += c.w; rowH = Math.max(rowH, c.h);
        }
        const H = y + rowH;
        if (H <= W) { let h = 1; while (h < H) h *= 2; return { W, H: h }; }
        W *= 2;
    }
}

/* Build the map: meshes per material, with a baked lightmap. `progress(k)` is told how far along it is (0..1). */
export async function buildMap(level, map, progress = () => {}) {
    D = (map.bake && map.bake.D) || 2.5;
    const faces = makeFaces(level, map);
    const lighting = new Lighting(level, map);
    // a chart per face
    for (const f of faces) {
        const [p0, p1, p2, p3] = f.p;
        const ls = Math.max(len(sub(p1, p0)), len(sub(p2, p3))), lt = Math.max(len(sub(p3, p0)), len(sub(p2, p1)));
        f.cw = Math.max(1, Math.ceil(ls * D)); f.ch = Math.max(1, Math.ceil(lt * D));
        f.w = f.cw + PAD * 2; f.h = f.ch + PAD * 2;
        f.ls = ls; f.lt = lt;
    }
    const { W, H } = pack(faces);
    const data = new Float32Array(W * H * 4);
    const amb = map.ambient;
    let t0 = performance.now(), done = 0;
    for (const f of faces) {
        const [p0, p1, p2, p3] = f.p, n = f.n;
        // the lamps and solids that matter for this face
        let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
        for (const p of f.p) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bz0 = Math.min(bz0, p[2]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); bz1 = Math.max(bz1, p[2]); }
        const lights = lighting.lights.filter((L) => {
            const cx = Math.max(bx0, Math.min(L.p[0], bx1)), cy = Math.max(by0, Math.min(L.p[1], by1)), cz = Math.max(bz0, Math.min(L.p[2], bz1));
            return (cx - L.p[0]) ** 2 + (cy - L.p[1]) ** 2 + (cz - L.p[2]) ** 2 < L.r * L.r;
        });
        const R = AO_LEN;
        const cand = level.near(bx0 - R, bz0 - R, bx1 + R, bz1 + R).filter((s) => !s.ghost && !s.clip && s.y1 > by0 - R && s.y0 < by1 + R);
        const insetS = Math.min(0.03 / Math.max(f.ls, 0.01), 0.25), insetT = Math.min(0.03 / Math.max(f.lt, 0.01), 0.25);
        const col = [0, 0, 0];
        for (let j = 0; j < f.ch; j++) for (let i = 0; i < f.cw; i++) {
            const a = Math.min(1 - insetS, Math.max(insetS, (i + 0.5) / f.cw)), b = Math.min(1 - insetT, Math.max(insetT, (j + 0.5) / f.ch));
            const q = bilerp(p0, p1, p2, p3, a, b);
            const p = [q[0] + n[0] * 0.04, q[1] + n[1] * 0.04, q[2] + n[2] * 0.04];
            col[0] = col[1] = col[2] = 0;
            lighting.direct(p, n, f.s, lights, col);
            const ao = lighting.ao(p, n, cand, f.s);
            // ambient, a little brighter on surfaces that face up
            const up = 0.8 + 0.3 * n[1];
            const o = ((f.y + PAD + j) * W + (f.x + PAD + i)) * 4;
            const k = 0.35 + 0.65 * ao;
            let sr = 0, sg = 0, sb = 0;
            if (lighting.sky) {
                // open sky fills the shadows with blue; the warm ground throws light back up onto walls and undersides
                const v = lighting.skyVis(p, n);
                sr = lighting.sky[0] * v; sg = lighting.sky[1] * v; sb = lighting.sky[2] * v;
                if (lighting.bounce) { const bk = (0.55 - 0.45 * n[1]) * (0.4 + 0.6 * v); sr += lighting.bounce[0] * bk; sg += lighting.bounce[1] * bk; sb += lighting.bounce[2] * bk; }
            }
            data[o] = (amb[0] * up + col[0] + sr) * k;
            data[o + 1] = (amb[1] * up + col[1] + sg) * k;
            data[o + 2] = (amb[2] * up + col[2] + sb) * k;
            data[o + 3] = 1;
        }
        // fill the padding from the nearest texel inside, so filtering doesn't bleed in black
        for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
            if (i >= PAD && i < PAD + f.cw && j >= PAD && j < PAD + f.ch) continue;
            const si = Math.min(PAD + f.cw - 1, Math.max(PAD, i)), sj = Math.min(PAD + f.ch - 1, Math.max(PAD, j));
            const o = ((f.y + j) * W + f.x + i) * 4, so = ((f.y + sj) * W + f.x + si) * 4;
            data[o] = data[so]; data[o + 1] = data[so + 1]; data[o + 2] = data[so + 2]; data[o + 3] = 1;
        }
        done++;
        if (performance.now() - t0 > 40) { progress(done / faces.length); await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    }
    const half = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], 60000));
    const lm = new THREE.DataTexture(half, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
    lm.magFilter = THREE.LinearFilter; lm.minFilter = THREE.LinearFilter;
    lm.channel = 1; lm.flipY = false; lm.needsUpdate = true;

    // geometry per material
    const TX = textures();
    const groups = new Map();
    for (const f of faces) { if (!groups.has(f.m)) groups.set(f.m, []); groups.get(f.m).push(f); }
    const root = new THREE.Group();
    const mats = {};
    for (const [m, list] of groups) {
        const pos = [], nor = [], uv = [], uv1 = [];
        const size = (MATS[m] && MATS[m].size) || 2, local = MATS[m] && MATS[m].local;
        for (const f of list) {
            const n = f.n;
            const an = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
            const uvOf = (p, ci) => {
                if (local) return [[0, 0], [1, 0], [1, 1], [0, 1]][ci];
                if (an[1] >= an[0] && an[1] >= an[2]) return [p[0] / size, p[2] / size];
                if (an[0] >= an[2]) return [p[2] / size, p[1] / size];
                return [p[0] / size, p[1] / size];
            };
            const lmUV = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => [(f.x + PAD + a * f.cw) / W, (f.y + PAD + b * f.ch) / H]);
            for (const ci of [0, 1, 2, 0, 2, 3]) {
                const p = f.p[ci];
                pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]);
                const u = uvOf(p, ci); uv.push(u[0], u[1]);
                uv1.push(lmUV[ci][0], lmUV[ci][1]);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
        const mat = cel({ map: TX[m], lightMap: lm, lightMapIntensity: Math.PI }, false);
        mats[m] = mat;
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
    }
    // glowing handrails along the stairs
    const railMats = {};
    for (const [x0, y0, z0, x1, y1, z1, c = '#ffb066', w = 0.09] of map.rails || []) {
        const a = new THREE.Vector3(x0, y0 + 0.03, z0), b = new THREE.Vector3(x1, y1 + 0.03, z1);
        const L = a.distanceTo(b);
        const railMat = railMats[c] || (railMats[c] = new THREE.MeshBasicMaterial({ color: c }));
        const m = glows(new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.8, L), railMat));
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.lookAt(b);
        root.add(m);
    }
    // lamp fittings
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fff3d8' }), coolMat = new THREE.MeshBasicMaterial({ color: '#e6f2ff' }), redMat = new THREE.MeshBasicMaterial({ color: '#ff3a2a' });
    for (const L of map.lights) {
        if (L.fix !== true) continue;
        const red = L.c[1] < 0.3, cool = L.c[2] > L.c[0];
        const m = glows(new THREE.Mesh(new THREE.BoxGeometry(red ? 0.25 : 0.9, 0.08, red ? 0.25 : 0.22), red ? redMat : cool ? coolMat : lampMat));
        m.position.set(L.p[0], L.p[1] + 0.18, L.p[2]);
        root.add(m);
    }
    // the skylight glass
    if (map.skyGlass) {
        const [x0, y, z0, x1, z1] = map.skyGlass;
        const sky = glows(new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: '#cfe2ff', fog: false })));
        sky.rotation.x = Math.PI / 2;
        sky.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
        root.add(sky);
    }
    // glowing panels: signs, traffic lights, light strips
    for (const [x0, y0, z0, x1, y1, z1, c, flat] of map.glows || []) {
        // flat: lit but not blooming (rows of distant windows would turn into fog)
        const mm = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ color: c }));
        const m = flat ? mm : glows(mm);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        root.add(m);
    }
    if (map.decor) root.add(buildDecor(map, lighting));
    progress(1);
    return { root, lighting, lightmap: lm, mats, stats: { faces: faces.length, W, H } };
}

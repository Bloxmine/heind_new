/* Builds a drivable track from a definition: road ribbon, verges, banks or drops, scenery, and a fast "where am I" query for physics. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from './retro.js';
import { rng, treeTexture, skyTexture } from './textures.js';
import { addSigns } from './signs.js';
import { buildProps } from './scenery.js';

const SEG = 2;            // metres between samples
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const pnoise = (s, seed) => {
    let v = 0, n = 0, a = 1;
    for (let k = 1; k <= 4; k++) { v += Math.sin(s * Math.PI * 2 * (k * 3 + seed % 4) + seed * 2.1 + k) * a; n += a; a *= 0.6; }
    return v / n;
};

// Cross-section beside the road for one side, relative to the road centre.
function profile(w, H, barrier) {
    const hw = w / 2, sw = clamp(Math.abs(H) * 1.1, 4, 14);
    const steep = H > 0 && H / sw > 0.55;
    const drop = H < 0;
    return {
        off: [hw, hw + 1.5, hw + 3, hw + 3 + sw, hw + 3 + sw + 12, hw + 3 + sw + 13],
        hy: [0, 0.06, 0.3, H, H + (drop ? -1 : H < 1 ? 0 : 1.5), null],
        steep, drop,
        wall: barrier ? hw + 1.55 : drop ? hw + 1.3 : steep ? hw + 3 : hw + 3 + sw * 0.55
    };
}
const heightAt = (p, ad) => {
    if (ad <= p.off[0]) return p.hy[0];
    for (let k = 0; k < 4; k++) if (ad <= p.off[k + 1]) return lerp(p.hy[k], p.hy[k + 1], (ad - p.off[k]) / (p.off[k + 1] - p.off[k]));
    return p.hy[4];
};

export function buildTrack(def, TX) {
    const group = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(def.points.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    const L = curve.getLength();
    const N = Math.max(120, Math.round(L / SEG));
    const sp = curve.getSpacedPoints(N);
    const seg = L / N;
    for (const j of def.jumps || []) {
        const c = Math.round(j.at * N), up = Math.round(j.len / seg), down = Math.max(2, Math.round(up * 0.3));
        for (let k = -up; k <= down; k++) {
            const i = (c + k + N) % N;
            const f = k <= 0 ? 1 - (-k / up) ** 1.6 : 1 - k / down;
            sp[i].y += j.h * Math.max(0, f);
            if (i === 0) sp[N].y = sp[0].y;
        }
    }
    const S = [];
    for (let i = 0; i < N; i++) {
        const p = sp[i], a = sp[(i - 1 + N) % N], b = sp[i + 1];
        let tx = b.x - a.x, tz = b.z - a.z;
        const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const s = i / N, bk = def.bank;
        // banks near the start line stay low so the grid has room
        const calm = Math.min(1, Math.min(i, N - i) / 25);
        const hA = (bk.base + bk.amp * pnoise(s, bk.seed)) * (0.4 + 0.6 * calm);
        const hB = (bk.base + bk.amp * pnoise(s, bk.seed + 7)) * (0.4 + 0.6 * calm);
        S.push({ x: p.x, y: p.y, z: p.z, tx, tz, sx: -tz, sz: tx, w: def.width, h: [hA, hB] });
    }
    S.forEach((s) => { s.prof = [profile(s.w, s.h[0], def.barrier), profile(s.w, s.h[1], def.barrier)]; });
    // On the inside of a bend the ground beside the road must not reach past the bend's centre,
    // or it folds back over the road. Clamp each side to the local turning radius.
    const head = S.map((s) => Math.atan2(s.tx, s.tz));
    const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const kappa = S.map((s, i) => wrapA(head[(i + 3) % N] - head[(i - 3 + N) % N]) / (6 * seg));
    S.forEach((s, i) => {
        let k = 0;
        for (let j = -8; j <= 8; j++) { const v = kappa[(i + j + N) % N]; if (Math.abs(v) > Math.abs(k)) k = v; }
        if (Math.abs(k) < 1e-4) return;
        const inner = k > 0 ? 1 : 0;                   // heading increasing = turning left = left side is inside
        const lim = Math.max(s.w / 2 + 2, 0.85 / Math.abs(k));
        const p = s.prof[inner];
        for (let n = 1; n < p.off.length; n++) p.off[n] = Math.min(p.off[n], Math.max(p.off[n - 1] + 0.15, lim - (p.off.length - 1 - n) * 0.15));
        p.wall = Math.min(p.wall, p.off[3]);
    });

    const mat = (tex) => cel({ map: tex, side: THREE.DoubleSide }, false);
    const M = {
        road: mat(def.roadRepeat ? Object.assign(TX[def.surface].clone(), { needsUpdate: true }) : TX[def.surface]),
        verge: mat(TX.verge),
        terrain: mat(TX[def.terrain || 'grass']),
        cliff: mat(TX[def.cliff || 'rock'])
    };
    if (def.roadRepeat) M.road.map.repeat.set(def.roadRepeat, def.roadRepeat);

    /* ---------- road ribbon ---------- */
    {
        const pos = [], uv = [], idx = [];
        for (let i = 0; i <= N; i++) {
            const s = S[i % N], hw = s.w / 2, v = (i * seg) / 10;
            pos.push(s.x - s.sx * hw, s.y + 0.02, s.z - s.sz * hw, s.x + s.sx * hw, s.y + 0.02, s.z + s.sz * hw);
            uv.push(0, v, 1, v);
            if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        group.add(new THREE.Mesh(g, M.road));
    }

    /* ---------- verges, banks, drops ---------- */
    {
        const pos = [], uv = [], lists = { verge: [], terrain: [], cliff: [] };
        const K = 6;
        for (let side = 0; side < 2; side++) {
            const sg = side === 0 ? 1 : -1;
            const base = pos.length / 3;
            for (let i = 0; i <= N; i++) {
                const s = S[i % N], p = s.prof[side];
                for (let k = 0; k < K; k++) {
                    const o = p.off[k] * sg;
                    const y = k === 5 ? def.groundY : s.y + p.hy[k];
                    pos.push(s.x + s.sx * o, y, s.z + s.sz * o);
                    uv.push(p.off[k] / 6, (i * seg) / 6 + (k === 5 ? (y - s.y) / 6 : 0));
                }
            }
            for (let i = 0; i < N; i++) {
                const p = S[i].prof[side];
                for (let k = 0; k < K - 1; k++) {
                    const a = base + i * K + k, b = a + 1, c = a + K, d = c + 1;
                    const list = k === 0 ? lists.verge : k === 2 && p.steep ? lists.cliff : k === 4 ? lists.cliff : lists.terrain;
                    list.push(a, c, b, b, c, d);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const all = [...lists.verge, ...lists.terrain, ...lists.cliff];
        g.setIndex(all);
        g.addGroup(0, lists.verge.length, 0);
        g.addGroup(lists.verge.length, lists.terrain.length, 1);
        g.addGroup(lists.verge.length + lists.terrain.length, lists.cliff.length, 2);
        g.computeVertexNormals();
        group.add(new THREE.Mesh(g, [M.verge, M.terrain, M.cliff]));
    }

    /* ---------- the world around it ---------- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mat(TX[def.ground || def.terrain || 'grass']));
    ground.material = cel({ map: TX[def.ground || def.terrain || 'grass'].clone() }, false);
    ground.material.map.repeat.set(500, 500); ground.material.map.needsUpdate = true;
    ground.rotation.x = -Math.PI / 2; ground.position.y = def.groundY;
    if (def.groundGlow) { ground.material.emissive.set('#ffffff'); ground.material.emissiveMap = ground.material.map; ground.material.emissiveIntensity = 0.85; }
    const groundMap = ground.material.map;
    group.add(ground);

    const skyTex = skyTexture(def.sky);
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(900, 900, 340, 48, 1, true), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1;
    group.add(sky);

    /* ---------- scenery ---------- */
    const r = rng(def.id.length * 977 + 13);
    // trees
    const kinds = def.trees.kinds;
    kinds.forEach((kind, ki) => {
        const tex = treeTexture(kind, ki + 3);
        const q1 = new THREE.PlaneGeometry(4, 8); q1.translate(0, 4, 0);
        const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
        const geo = mergeGeometries([q1, q2]);
        const m = cel({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
        const mats = [];
        for (let i = 0; i < N; i += 2) {
            for (let side = 0; side < 2; side++) {
                const s = S[i], p = s.prof[side];
                if (p.drop || p.hy[3] < 1 || r() > def.trees.density / kinds.length) continue;
                const sg = side ? -1 : 1, o = (p.off[3] + 1 + r() * 9) * sg;
                const sc = 0.8 + r() * 0.7;
                const m4 = new THREE.Matrix4().compose(
                    new THREE.Vector3(s.x + s.sx * o + (r() - 0.5) * 2, s.y + p.hy[3] + 0.3, s.z + s.sz * o + (r() - 0.5) * 2),
                    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI), new THREE.Vector3(sc, sc, sc));
                mats.push(m4);
            }
        }
        const inst = new THREE.InstancedMesh(geo, m, mats.length);
        mats.forEach((m4, i) => inst.setMatrixAt(i, m4));
        group.add(inst);
    });

    // red and white marker posts every 20 m, guard rails along the drops
    {
        const postGeo = new THREE.BoxGeometry(0.16, 1.1, 0.16); postGeo.translate(0, 0.55, 0);
        const posts = [];
        const railGeo = new THREE.BoxGeometry(0.12, 0.32, seg * 1.02); railGeo.translate(0, 0.62, 0);
        const rails = [];
        const yAxis = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < N; i++) {
            const s = S[i], n = S[(i + 1) % N];
            for (let side = 0; side < 2; side++) {
                const sg = side ? -1 : 1, p = s.prof[side];
                const yaw = Math.atan2(s.tx, s.tz);
                if (p.drop) {
                    const o = (s.w / 2 + 1.3) * sg, o2 = (n.w / 2 + 1.3) * sg;
                    const ax = s.x + s.sx * o, az = s.z + s.sz * o, bx = n.x + n.sx * o2, bz = n.z + n.sz * o2;
                    rails.push(new THREE.Matrix4().compose(new THREE.Vector3((ax + bx) / 2, (s.y + n.y) / 2, (az + bz) / 2), new THREE.Quaternion().setFromAxisAngle(yAxis, Math.atan2(bx - ax, bz - az)), new THREE.Vector3(1, 1, 1)));
                    if (i % 2 === 0) posts.push(new THREE.Matrix4().compose(new THREE.Vector3(ax, s.y, az), new THREE.Quaternion().setFromAxisAngle(yAxis, yaw), new THREE.Vector3(0.8, 0.7, 0.8)));
                } else if (i % 10 === 0) {
                    const o = (s.w / 2 + 1.1) * sg;
                    posts.push(new THREE.Matrix4().compose(new THREE.Vector3(s.x + s.sx * o, s.y + 0.04, s.z + s.sz * o), new THREE.Quaternion().setFromAxisAngle(yAxis, yaw), new THREE.Vector3(1, 1, 1)));
                }
            }
        }
        const pm = new THREE.InstancedMesh(postGeo, cel({ map: TX.post }), posts.length);
        posts.forEach((m4, i) => pm.setMatrixAt(i, m4));
        group.add(pm);
        if (rails.length) {
            const rm = new THREE.InstancedMesh(railGeo, cel({ map: TX.rail }), rails.length);
            rails.forEach((m4, i) => rm.setMatrixAt(i, m4));
            group.add(rm);
        }
    }

    // start and finish gantry
    {
        const s = S[0], hw = s.w / 2 + 1.6;
        const g = new THREE.Group();
        const pole = new THREE.BoxGeometry(0.4, 6.5, 0.4); pole.translate(0, 3.25, 0);
        const pm = cel({ color: '#d8d8d8' });
        const p1 = new THREE.Mesh(pole, pm); p1.position.set(hw, 0, 0);
        const p2 = new THREE.Mesh(pole, pm); p2.position.set(-hw, 0, 0);
        const ban = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.4, 1.2, 0.2), cel({ map: TX.checker }));
        ban.position.set(0, 6, 0);
        const line = new THREE.Mesh(new THREE.PlaneGeometry(s.w, 1.2), cel({ map: TX.checker }));
        line.rotation.x = -Math.PI / 2; line.position.y = 0.05;
        g.add(p1, p2, ban, line);
        g.position.set(s.x, s.y, s.z);
        g.rotation.y = Math.atan2(s.tx, s.tz);
        group.add(g);
    }

    const signs = addSigns({ S, N }, group);
    const anim = [];
    buildProps({ S, N, seg, group, def, TX, anim });

    /* ---------- queries ---------- */
    const query = (x, z, hint) => {
        let best = 0, bd = Infinity;
        if (hint == null) { for (let i = 0; i < N; i++) { const s = S[i], d = (x - s.x) ** 2 + (z - s.z) ** 2; if (d < bd) { bd = d; best = i; } } }
        else for (let k = -24; k <= 24; k++) { const i = (hint + k + N * 4) % N, s = S[i], d = (x - s.x) ** 2 + (z - s.z) ** 2; if (d < bd) { bd = d; best = i; } }
        let i0 = best, a = S[i0], b = S[(i0 + 1) % N];
        let t = ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
        if (t < 0) { i0 = (best - 1 + N) % N; a = S[i0]; b = S[best]; t = ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2); }
        t = clamp(t, 0, 1);
        const cx = lerp(a.x, b.x, t), cz = lerp(a.z, b.z, t), cy = lerp(a.y, b.y, t);
        let sx = lerp(a.sx, b.sx, t), sz = lerp(a.sz, b.sz, t);
        const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
        const d = (x - cx) * sx + (z - cz) * sz, ad = Math.abs(d), side = d >= 0 ? 0 : 1;
        const pa = a.prof[side], pb = b.prof[side];
        const ya = heightAt(pa, ad), yb = heightAt(pb, ad);
        const hw = lerp(a.w, b.w, t) / 2;
        return {
            i: i0, t, prog: i0 + t, d, ad, side, cx, cz, cy, sx, sz, tx: sz, tz: -sx,
            y: cy + lerp(ya, yb, t),
            wall: lerp(pa.wall, pb.wall, t),
            surface: ad < hw ? def.surface : ad < hw + 3 ? 'verge' : (def.terrain || 'grass')
        };
    };

    // Positions on the grid, behind the start line.
    const gridSlot = (n) => {
        const row = Math.floor(n / 2), col = n % 2;
        const i = (N - 4 - row * 4) % N, s = S[i];
        const o = (col ? -1 : 1) * s.w * 0.22;
        return { x: s.x + s.sx * o, z: s.z + s.sz * o, y: s.y, heading: Math.atan2(s.tx, s.tz), i };
    };

    if (def.ground === 'water' || def.ground === 'lava') anim.push((t) => { groundMap.offset.set(t * 0.4, t * (def.ground === 'lava' ? 0.15 : 0.6)); });
    return { def, group, sky, S, N, L, seg, query, gridSlot, M, signs, animate: (t) => anim.forEach((f) => f(t)) };
}

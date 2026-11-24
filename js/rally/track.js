/* Builds a drivable track from a definition: road ribbon, verges, banks or drops, scenery, and a fast "where am I" query for physics. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from './retro.js';
import { rng, treeTexture, skyTexture } from './textures.js';
import { addSigns } from './signs.js';
import { buildProps } from './scenery.js';

const SEG = 2;            // metres between samples
const cutCache = new Map();  // the shortcuts found for each track (finding them takes a moment)
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
    // bridges: high enough above the ground, the road stands on pillars instead of earth
    // tunnels: by stretch of the lap, or wherever the road dips under a height
    S.forEach((s, i) => {
        s.bridge = def.elevated != null && s.y - def.groundY > def.elevated;
        const f = i / N;
        s.tunnel = (def.tunnels || []).some(([a, b]) => f >= a && f <= b) || (def.tunnelBelow != null && s.y < def.tunnelBelow);
        if (s.bridge) s.prof = [profile(s.w, -6, def.barrier), profile(s.w, -6, def.barrier)];
        if (s.tunnel) s.prof.forEach((p) => { p.wall = Math.min(p.wall, s.w / 2 + 1.2); });
    });
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
                const p = S[i].prof[side], br = S[i].bridge || S[(i + 1) % N].bridge;
                for (let k = 0; k < K - 1; k++) {
                    if (br && k > 0) continue;            // a bridge has a kerb and nothing below it
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

    const anim = [];
    /* ---------- bridges: a deck under the road and pillars down to the ground ---------- */
    if (S.some((s) => s.bridge)) {
        const deck = [], pillars = [], beams = [];
        const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
        const put = (list, x, y, z, ry, sx, sy, sz) => list.push(m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, ry), new THREE.Vector3(sx, sy, sz)).clone());
        for (let i = 0; i < N; i++) {
            const s = S[i], n = S[(i + 1) % N];
            if (!s.bridge && !n.bridge) continue;
            const ry = Math.atan2(n.x - s.x, n.z - s.z), len = Math.hypot(n.x - s.x, n.z - s.z, n.y - s.y);
            put(deck, (s.x + n.x) / 2, (s.y + n.y) / 2 - 1.4, (s.z + n.z) / 2, ry, s.w + 3.4, 1.38, len * 1.04);
            const h = s.y - 1.4 - def.groundY;
            const P = def.pillar;
            if (i % (P ? P.every : 9) === 0 && h > 2) {
                if (P) put(pillars, s.x, def.groundY, s.z, ry, s.w + P.across, h, P.len);
                else { put(pillars, s.x, def.groundY, s.z, ry, 2.4, h, 2.4); put(beams, s.x, s.y - 2.4, s.z, ry, s.w + 1, 1, 2.6); }
            }
        }
        const concrete = cel({ map: TX.concrete });
        let pmat = concrete;
        if (def.pillar && def.pillar.tex) {
            const t = TX[def.pillar.tex].clone(); t.repeat.set(...(def.pillar.repeat || [3, 10])); t.needsUpdate = true;
            pmat = cel(def.pillar.lit ? { map: t, emissive: '#ffffff', emissiveMap: t } : { map: t });
        }
        for (const list of [deck, pillars, beams]) {
            if (!list.length) continue;
            const im = new THREE.InstancedMesh(box, list === pillars ? pmat : concrete, list.length);
            list.forEach((m, k) => im.setMatrixAt(k, m));
            group.add(im);
        }
    }

    /* ---------- tunnels: an arched tube over the road with lamps along the roof ---------- */
    {
        const runs = [];
        for (let i = 0; i < N; i++) if (S[i].tunnel && !S[(i - 1 + N) % N].tunnel) { let j = i; while (S[(j + 1) % N].tunnel && j - i < N) j++; runs.push([i, j]); }
        if (S.every((s) => s.tunnel)) runs.splice(0, runs.length, [0, N]);
        const tex = TX[def.tunnelTex || 'concrete'];
        const lampM = new THREE.MeshBasicMaterial({ color: def.tunnelLight || '#ffb04a', fog: false });
        const lamps = [];
        const A = 12;
        for (const [a, b] of runs) {
            const pos = [], uv = [], idx = [];
            for (let i = a, r = 0; i <= b + 1; i++, r++) {
                const s = S[i % N], R = s.w / 2 + 1.8;
                for (let k = 0; k <= A; k++) {
                    const ang = k / A * Math.PI, c = Math.cos(ang), sn = Math.sin(ang);
                    pos.push(s.x + s.sx * R * c, s.y - 0.2 + sn * R * (def.tunnelH || 0.78), s.z + s.sz * R * c);
                    uv.push(k / A * 4, i * seg / 6);
                }
                if (r > 0) for (let k = 0; k < A; k++) { const p0 = (r - 1) * (A + 1) + k, p1 = p0 + A + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
                if (i % 5 === 0) lamps.push([s.x, s.y - 0.5 + R * (def.tunnelH || 0.78), s.z, Math.atan2(s.tx, s.tz)]);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setIndex(idx); g.computeVertexNormals();
            group.add(new THREE.Mesh(g, cel({ map: tex, side: THREE.DoubleSide, color: def.tunnelTint || '#ffffff' })));
        }
        if (lamps.length) {
            const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.18, 2.2), lampM, lamps.length);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
            lamps.forEach(([x, y, z, ry], k) => im.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(Y, ry), new THREE.Vector3(1, 1, 1))));
            im.layers.enable(1);
            group.add(im);
        }
    }

    /* ---------- boost pads: glowing chevrons on the road ---------- */
    const boosts = [];
    if (def.boosts) {
        const c = document.createElement('canvas'); c.width = 32; c.height = 32;
        const x = c.getContext('2d');
        x.fillStyle = '#3a1a08'; x.fillRect(0, 0, 32, 32);
        for (const [y0, col] of [[2, '#ffd23f'], [18, '#ff7a1a']]) { x.fillStyle = col; x.beginPath(); x.moveTo(2, y0 + 12); x.lineTo(16, y0); x.lineTo(30, y0 + 12); x.lineTo(24, y0 + 12); x.lineTo(16, y0 + 6); x.lineTo(8, y0 + 12); x.fill(); }
        const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter; tex.repeat.set(1, 2);
        const padM = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
        for (const f of def.boosts) {
            const i = Math.round(f * N) % N, s = S[i];
            const g = new THREE.PlaneGeometry(s.w * 0.55, 8); g.rotateX(-Math.PI / 2);
            const m = new THREE.Mesh(g, padM); m.layers.enable(1);
            m.position.set(s.x, s.y + 0.08, s.z); m.rotation.y = Math.atan2(s.tx, s.tz);
            group.add(m);
            boosts.push(i);
        }
        anim.push((t) => { tex.offset.y = -t * 2; });
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

    /* ---------- shortcuts and secret routes ----------
       Found by looking for bends where a straight dirt causeway across the inside saves a good stretch of road
       without crossing the road anywhere else or ducking under a bank. The best one is a signed shortcut; a second
       one, if there is one, is a secret route, unsigned. On a cut, query() answers from the cut instead: its own
       walls and height, and a lap progress blended between its two ends, so laps and positions still add up. */
    const hwMain = def.width / 2, cuts = [];
    const cutKey = def.id + ':' + def.width + ':' + N;
    if (cutCache.has(cutKey)) cuts.push(...cutCache.get(cutKey).map((c) => Object.assign({}, c)));
    else if (!def.noCuts && !def.isWorld) {
        // a coarse grid of the samples, so "nearest bit of road" is quick while hunting for cuts
        const G = new Map(), cell = 20, key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
        S.forEach((s2, i) => { const k = key(s2.x, s2.z); if (!G.has(k)) G.set(k, []); G.get(k).push(i); });
        const near = (x, z) => {
            const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
            let best = -1, bd = Infinity;
            for (let r = 1; r <= 3 && best < 0; r++) for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
                for (const i of G.get(gx + ',' + gz) || []) { const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
            }
            return best;
        };
        const cand = [];
        for (let i = 30; i < N - 30; i += 4) {
            const a = S[i];
            if (a.tunnel || a.bridge) continue;
            // the longest stretch first: the first that fits is the best from here
            for (let L = 170; L >= 50; L -= 10) {
                const j = i + Math.round(L / seg);
                if (j >= N - 20) continue;
                const b = S[j];
                if (b.tunnel || b.bridge || Math.abs(b.y - a.y) > 4) continue;
                // which side is the inside: towards the middle of the chord
                const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
                const side = Math.sign((mx - a.x) * a.sx + (mz - a.z) * a.sz) || 1;
                const ax = a.x + a.sx * side * hwMain * 0.6, az = a.z + a.sz * side * hwMain * 0.6;
                const bx = b.x + b.sx * side * hwMain * 0.6, bz = b.z + b.sz * side * hwMain * 0.6;
                const len = Math.hypot(bx - ax, bz - az), gain = L - len;
                if (len < 25 || gain < 30) continue;
                // never back over the road; over a bank it rides on top (a little crest), but not over a hill
                let ok = true;
                const hs = [];
                const n = Math.max(2, Math.round(len / 4));
                for (let k = 0; k <= n && ok; k++) {
                    const u = k / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
                    let y = a.y + (b.y - a.y) * u;
                    const d = u * len;
                    if (d > 7 && d < len - 7) {
                        const ni = near(x, z);
                        if (ni >= 0) {
                            const q = query(x, z, ni);
                            if (q.ad < hwMain + 4) ok = false;
                            else if (q.ad < hwMain + 30 && q.y > y) { if (q.y - y > 4) ok = false; else y = q.y + 0.05; }
                        }
                    }
                    hs.push(y);
                }
                if (ok) { cand.push({ i, j, side, ax, az, bx, bz, len, gain, ay: a.y, by: b.y, hs }); break; }
            }
        }
        cand.sort((p, q) => q.gain - p.gain);
        for (const c of cand) {
            if (cuts.length >= 2) break;
            if (cuts.some((o) => c.i < o.j + 20 && c.j > o.i - 20)) continue;
            cuts.push(c);
        }
        cutCache.set(cutKey, cuts.map((c) => Object.assign({}, c)));
    }
    {
        cuts.forEach((c, k) => {
            const ux = (c.bx - c.ax) / c.len, uz = (c.bz - c.az) / c.len;
            Object.assign(c, { ux, uz, lx: -uz, lz: ux, hw: 3.4, secret: k === 1, surface: def.surface === 'snow' ? 'snow' : 'dirt' });
            for (let r = 0; r < 2; r++) c.hs = c.hs.map((y, n, A) => (n === 0 || n === A.length - 1 ? y : Math.max(y, (A[n - 1] + 2 * y + A[n + 1]) / 4)));
            c.yAt = (u) => { const f = clamp(u, 0, 1) * (c.hs.length - 1), n = Math.min(c.hs.length - 2, Math.floor(f)); return lerp(c.hs[n], c.hs[n + 1], f - n); };
        });
    }
    const queryMain = query;
    const queryAll = (x, z, hint) => {
        const q = queryMain(x, z, hint);
        if (!cuts.length || q.ad < hwMain + 0.5) return q;
        for (const c of cuts) {
            const dx = x - c.ax, dz = z - c.az, u = (dx * c.ux + dz * c.uz) / c.len;
            if (u < -0.03 || u > 1.03) continue;
            const dl = dx * c.lx + dz * c.lz, adl = Math.abs(dl);
            if (adl > c.hw + 2.4) continue;
            const uc = clamp(u, 0, 1), y = c.yAt(uc), prog = c.i + (c.j - c.i) * uc;
            return {
                i: Math.floor(prog), t: prog % 1, prog, d: dl, ad: adl, side: dl >= 0 ? 0 : 1,
                cx: c.ax + c.ux * c.len * uc, cz: c.az + c.uz * c.len * uc, cy: y, sx: c.lx, sz: c.lz, tx: c.ux, tz: c.uz,
                y: y - Math.max(0, adl - c.hw) * 0.25, wall: c.hw + 1.6, surface: adl < c.hw ? c.surface : 'verge', cut: c
            };
        }
        return q;
    };
    // the causeways themselves, with earth sides down to the ground, and a sign at a shortcut's mouth
    for (const c of cuts) {
        const seg2 = Math.max(4, Math.round(c.len / 4)), pos = [], uv = [], idx = [];
        const top = c.hw + 0.6;
        for (let k = 0; k <= seg2; k++) {
            const u = k / seg2, x = c.ax + (c.bx - c.ax) * u, z = c.az + (c.bz - c.az) * u, y = c.yAt(u) + 0.04;
            const drop = clamp(y - def.groundY + 0.5, 0.5, 12);
            for (const [o, yy] of [[-top - drop, y - drop], [-top, y], [top, y], [top + drop, y - drop]]) { pos.push(x + c.lx * o, yy, z + c.lz * o); uv.push(o / 4, u * c.len / 4); }
            if (k) { const b = (k - 1) * 4, n = k * 4; for (let e = 0; e < 3; e++) idx.push(b + e, n + e, b + e + 1, b + e + 1, n + e, n + e + 1); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); g.computeVertexNormals();
        const tex = (TX[c.surface] || TX.dirt).clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
        group.add(new THREE.Mesh(g, cel({ map: tex, side: THREE.DoubleSide }, false)));
        if (!c.secret) {
            const cv = document.createElement('canvas'); cv.width = 64; cv.height = 24;
            const x = cv.getContext('2d'); x.fillStyle = '#ff9a1f'; x.fillRect(0, 0, 64, 24); x.fillStyle = '#111';
            for (let k = 0; k < 4; k++) { x.beginPath(); const ox = 6 + k * 14; x.moveTo(ox, 4); x.lineTo(ox + 8, 12); x.lineTo(ox, 20); x.lineTo(ox + 4, 20); x.lineTo(ox + 12, 12); x.lineTo(ox + 4, 4); x.fill(); }
            const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), cel({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
            const ex = c.ax + c.ux * 6 + c.lx * (c.hw + 1.2), ez = c.az + c.uz * 6 + c.lz * (c.hw + 1.2);
            board.position.set(ex, c.ay + 1.9, ez); board.rotation.y = Math.atan2(c.lx, c.lz);
            group.add(board);
            for (const s2 of [-1.2, 1.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), cel({ color: '#3a3a40' })); post.position.set(ex + c.ux * s2, c.ay + 0.95, ez + c.uz * s2); group.add(post); }
        }
    }
    // clear the trees, posts and barriers out of the way (instanced scenery inside a cut's corridor)
    if (cuts.length) {
        const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
        group.updateMatrixWorld(true);
        group.traverse((o) => {
            if (!o.isInstancedMesh) return;
            let changed = false;
            for (let n = 0; n < o.count; n++) {
                o.getMatrixAt(n, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
                for (const c of cuts) {
                    const dx = p.x - c.ax, dz = p.z - c.az, u = (dx * c.ux + dz * c.uz) / c.len, dl = Math.abs(dx * c.lx + dz * c.lz);
                    if (u > -0.08 && u < 1.08 && dl < c.hw + 3) { o.setMatrixAt(n, zero); changed = true; break; }
                }
            }
            if (changed) o.instanceMatrix.needsUpdate = true;
        });
    }

    // Positions on the grid, behind the start line.
    const gridSlot = (n) => {
        const row = Math.floor(n / 2), col = n % 2;
        const i = (N - 5 - row * 6 - col * 3) % N, s = S[i];      // rows 12 m apart, staggered like a real grid
        const o = (col ? -1 : 1) * s.w * 0.25;
        return { x: s.x + s.sx * o, z: s.z + s.sz * o, y: s.y, heading: Math.atan2(s.tx, s.tz), i };
    };

    if (def.ground === 'water' || def.ground === 'lava') anim.push((t) => { groundMap.offset.set(t * 0.4, t * (def.ground === 'lava' ? 0.15 : 0.6)); });
    return { def, group, sky, S, N, L, seg, query: queryAll, cuts, gridSlot, M, signs, boosts, animate: (t) => anim.forEach((f) => f(t)) };
}

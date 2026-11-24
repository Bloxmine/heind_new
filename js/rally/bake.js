/* Baked light for the tracks, the world and the arenas: the same idea as Yard Sale Showdown, for any meshes.
   Every vertex of the static scenery (and every tree, rock and barrier) is tested against the scene itself:
   one ray towards the sun for its shadow, a few rays around the sky for how open it is, and the lamps nearby.
   The results go in two small vertex attributes that the cel shader reads. It runs a slice at a time after
   the track appears, so the light settles in over a second or two instead of holding up the loading. */
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const SKY_DIRS = (() => {
    const out = [];
    for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, phi = i * 2.399963, r = Math.sqrt(u); out.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)]); }
    return out;
})();
const cache = new Map();          // finished bakes, by track, so a rebuilt track lights up at once
/* ...and kept in the browser (IndexedDB) between visits, so a track you've driven before lights up at once too.
   Bump VERSION when the bake itself changes. */
const VERSION = 3;
let dbP = null;
const db = () => dbP || (dbP = new Promise((res) => {
    try {
        const r = indexedDB.open('gravel-riot-light', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('bakes');
        r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch (e) { res(null); }
}));
const dbGet = async (k) => { const d = await db(); if (!d) return null; return new Promise((res) => { try { const q = d.transaction('bakes').objectStore('bakes').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); };
const dbPut = async (k, v) => { const d = await db(); if (!d) return; try { d.transaction('bakes', 'readwrite').objectStore('bakes').put(v, k); } catch (e) { /* full or private mode: no matter */ } };
/* Free roam's sun moves with the time of day, so its shadows are baked for four times of day and blended:
   SUNW holds how much of each to use right now (all zero anywhere else). */
export const SUNW = { value: new THREE.Vector4() };
export const SUN_HOURS = [7.5, 10.5, 13.5, 16.5];
// how strongly the baked lamps shine: free roam turns them down in the day
export const LAMPK = { value: 1 };
// Scenery throws shadows in the headlights, but not in the sun: the sun's shadows are already baked in, and the
// real-time sun shadow is only for the cars. The sun's shadow camera is the orthographic one; for that pass the
// mesh is squashed to a point, so it draws nothing.
function skipSun(r, o, cam, shadowCam) { if (shadowCam.isOrthographicCamera) o.modelViewMatrix.makeScale(0, 0, 0); }
// > 0 if the triangles, as wound, mostly face up; < 0 if mostly down
function windingUp(g) {
    const P = g.attributes.position, I = g.index, n = I ? I.count : P.count, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let s = 0;
    for (let i = 0; i + 2 < n; i += Math.max(3, Math.floor(n / 600) * 3)) {
        a.fromBufferAttribute(P, I ? I.getX(i) : i); b.fromBufferAttribute(P, I ? I.getX(i + 1) : i + 1); c.fromBufferAttribute(P, I ? I.getX(i + 2) : i + 2);
        s += (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);     // the y of (b - a) x (c - a)
    }
    return s;
}

// the attributes start at 0 = "nothing in the way", so anything not (yet) baked looks exactly as before
function patchMaterial(m) {
    if (!m || !m.isMeshToonMaterial || m.userData.baked) return;
    m.userData.baked = true;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(m, sh, r);
        sh.vertexShader = 'attribute vec2 bakeS;\nattribute vec3 bakeL;\nattribute vec4 bakeT;\nvarying vec2 vBakeS;\nvarying vec3 vBakeL;\nvarying vec4 vBakeT;\n' +
            sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBakeS = bakeS; vBakeL = bakeL; vBakeT = bakeT;');
        sh.uniforms.uLampK = LAMPK; sh.uniforms.uSunW = SUNW;
        sh.fragmentShader = 'uniform float uLampK;\nuniform vec4 uSunW;\nvarying vec2 vBakeS;\nvarying vec3 vBakeL;\nvarying vec4 vBakeT;\n' + sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
            reflectedLight.directDiffuse *= 1.0 - min(1.0, vBakeS.x + dot(vBakeT, uSunW)) * 0.86;
            reflectedLight.indirectDiffuse *= 1.0 - vBakeS.y * 0.62;
            reflectedLight.indirectDiffuse += diffuseColor.rgb * vBakeL * uLampK;`);
    };
    m.customProgramCacheKey = () => prevKey + '-baked';
    m.needsUpdate = true;
}

/* A car (or anything that moves) lit by the baked light where it is: its own two uniforms, which the Baker's
   probe() fills in. x: in the sun's shadow, y: how closed-in the sky is, l: the lamps' light. */
export function probeLit(root, u = { s: { value: new THREE.Vector2() }, l: { value: new THREE.Vector3() } }) {
    root.traverse((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const out = list.map((m) => {
            if (!m || !m.isMeshToonMaterial) return m;
            if (m.userData.probe) { if (m.userData.probe === u) return m; m = m.clone(); }
            m.userData.probe = u;
            const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
            m.onBeforeCompile = (sh, r) => {
                if (prev) prev.call(m, sh, r);
                sh.uniforms.uProbeS = u.s; sh.uniforms.uProbeL = u.l;
                sh.fragmentShader = 'uniform vec2 uProbeS;\nuniform vec3 uProbeL;\n' + sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
                    reflectedLight.directDiffuse *= 1.0 - uProbeS.x * 0.8;
                    reflectedLight.indirectDiffuse *= 1.0 - uProbeS.y * 0.55;
                    reflectedLight.indirectDiffuse += diffuseColor.rgb * uProbeL;`);
            };
            m.customProgramCacheKey = () => prevKey + '-probe';
            m.needsUpdate = true;
            return m;
        });
        o.material = Array.isArray(o.material) ? out : out[0];
    });
    return u;
}

export class Baker {
    /* group: the scenery; sunDir: towards the sun; opts.lampColor: colour of glowing fittings treated as lamps */
    constructor(group, sunDir, key, opts = {}) {
        this.sun = sunDir.clone().normalize(); this.done = false; this.noSun = !!opts.noSun;
        this.path = opts.sunPath ? opts.sunPath.map((d) => d.clone().normalize()) : null;     // free roam: sun at four times of day
        this.meshes = []; this.lamps = [];
        group.updateMatrixWorld(true);
        group.traverse((o) => {
            if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            // glowing fittings (on the glow layer) light the scenery around them
            if (mats[0] && mats[0].isMeshBasicMaterial && (o.layers.mask & 2)) {
                const c = mats[0].color, n = o.isInstancedMesh ? o.count : 1, m4 = new THREE.Matrix4(), p = new THREE.Vector3();
                for (let i = 0; i < n && this.lamps.length < 400; i++) {
                    if (o.isInstancedMesh) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); } else m4.copy(o.matrixWorld);
                    p.setFromMatrixPosition(m4);
                    const lc = opts.lampColor ? new THREE.Color(opts.lampColor) : c;
                    this.lamps.push({ p: [p.x, p.y - 0.3, p.z], c: [lc.r, lc.g, lc.b], i: opts.lampI || 1.2, r: opts.lampR || 12 });
                }
                return;
            }
            if (!mats.every((m) => m && m.isMeshToonMaterial) || mats.some((m) => m.transparent)) return;
            this.meshes.push(o);
        });
        // lamps by 12 m-ish cell, so each point only looks at the few nearby
        this.cell = Math.max(4, ...this.lamps.map((L) => L.r), 4);
        this.grid = new Map();
        for (const L of this.lamps) {
            const k = Math.floor(L.p[0] / this.cell) + ',' + Math.floor(L.p[2] / this.cell);
            if (!this.grid.has(k)) this.grid.set(k, []);
            this.grid.get(k).push(L);
        }
        // one big soup of triangles in world space for the rays to hit
        let tris = 0;
        for (const o of this.meshes) {
            const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
            tris += (n / 3) * (o.isInstancedMesh ? o.count : 1);
        }
        const pos = new Float32Array(tris * 9);
        let k = 0;
        const v = new THREE.Vector3(), m4 = new THREE.Matrix4();
        for (const o of this.meshes) {
            const g = o.geometry, P = g.attributes.position, I = g.index;
            const n = I ? I.count : P.count, copies = o.isInstancedMesh ? o.count : 1;
            for (let c = 0; c < copies; c++) {
                if (o.isInstancedMesh) { o.getMatrixAt(c, m4); m4.premultiply(o.matrixWorld); } else m4.copy(o.matrixWorld);
                for (let i = 0; i < n; i++) {
                    v.fromBufferAttribute(P, I ? I.getX(i) : i).applyMatrix4(m4);
                    pos[k++] = v.x; pos[k++] = v.y; pos[k++] = v.z;
                }
            }
        }
        const soup = new THREE.BufferGeometry();
        soup.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.bvh = new MeshBVH(soup, { maxLeafTris: 12 });
        this.ray = new THREE.Ray();
        // the work: every vertex of every plain mesh, every instance of every instanced one
        // (the key carries the scene's size, so a changed track never picks up an old bake)
        const verts = this.meshes.reduce((a, o) => a + (o.isInstancedMesh ? o.count : o.geometry.attributes.position.count), 0);
        this.key = `v${VERSION}:${key}:${this.meshes.length}:${verts}:${this.lamps.length}`;
        this.jobs = [];
        const old = cache.get(this.key);
        const seen = new Set();
        this.meshes.forEach((o, mi) => {
            // two meshes sharing one geometry would fight over its bake: give the second its own copy
            if (seen.has(o.geometry)) o.geometry = o.geometry.clone();
            seen.add(o.geometry);
            const g = o.geometry, n = o.isInstancedMesh ? o.count : g.attributes.position.count;
            let S = new Float32Array(n * 2), L = new Float32Array(n * 3), T = this.path ? new Float32Array(n * 4) : null, have = false;
            if (old && old[mi] && old[mi].S.length === S.length) { S = old[mi].S; L = old[mi].L; T = old[mi].T || T; have = true; }
            const A = o.isInstancedMesh ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
            g.setAttribute('bakeS', new A(S, 2)); g.setAttribute('bakeL', new A(L, 3));
            if (T) g.setAttribute('bakeT', new A(T, 4)); else g.deleteAttribute('bakeT');
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) patchMaterial(m);
            o.receiveShadow = true;
            o.castShadow = true; o.onBeforeShadow = skipSun;
            // double-sided ground (road ribbons, terrain) would shadow itself at the headlights' grazing angle:
            // only its far side goes in the shadow map, so crests still cast but the road doesn't darken itself
            // (which side is "far" depends on how the triangles are wound, so look at that)
            if (!o.isInstancedMesh && (Array.isArray(o.material) ? o.material : [o.material]).some((m) => m.side === THREE.DoubleSide)) {
                const up = windingUp(o.geometry);
                for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.side === THREE.DoubleSide) m.shadowSide = up >= 0 ? THREE.BackSide : THREE.FrontSide;
            }
            if (!have) this.jobs.push({ o, S, L, T, i: 0, n });
        });
        this.results = this.meshes.map((o) => ({ S: o.geometry.attributes.bakeS.array, L: o.geometry.attributes.bakeL.array, T: o.geometry.attributes.bakeT ? o.geometry.attributes.bakeT.array : null }));
        if (!this.jobs.length) { this.finish(true); return; }
        // baked on an earlier visit? then use that as soon as it's read back
        dbGet(this.key).then((got) => {
            if (this.done || !got || got.length !== this.results.length) return;
            if (!got.every((r, i) => r.S.length === this.results[i].S.length && r.L.length === this.results[i].L.length && (!this.results[i].T || (r.T && r.T.length === this.results[i].T.length)))) return;
            got.forEach((r, i) => {
                const R = this.results[i], g = this.meshes[i].geometry;
                R.S.set(r.S); R.L.set(r.L); if (R.T) R.T.set(r.T);
                g.attributes.bakeS.needsUpdate = true; g.attributes.bakeL.needsUpdate = true; if (g.attributes.bakeT) g.attributes.bakeT.needsUpdate = true;
            });
            this.jobs = [];
            this.fromDisk = true;
            this.finish(true);
        });
    }
    // how much of the sun and sky a point sees, and the lamps' light on it
    sample(p, n, out) {
        const R = this.ray, bvh = this.bvh, s = this.sun;
        R.origin.set(p.x + n.x * 0.25 + s.x * 0.1, p.y + n.y * 0.25 + s.y * 0.1, p.z + n.z * 0.25 + s.z * 0.1);
        R.direction.copy(s);
        out[0] = !this.noSun && n.dot(s) > -0.1 && bvh.raycastFirst(R, THREE.DoubleSide, 0, 600) ? 1 : 0;
        const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(n).normalize() : new THREE.Vector3(1, 0, 0).cross(n).normalize();
        const b = new THREE.Vector3().crossVectors(n, t);
        let hit = 0, tot = 0;
        for (const d of SKY_DIRS) {
            R.direction.set(t.x * d[0] + b.x * d[1] + n.x * d[2], t.y * d[0] + b.y * d[1] + n.y * d[2], t.z * d[0] + b.z * d[1] + n.z * d[2]);
            R.origin.set(p.x + n.x * 0.25, p.y + n.y * 0.25, p.z + n.z * 0.25);
            const w = 0.3 + Math.max(0, R.direction.y);
            tot += w;
            if (bvh.raycastFirst(R, THREE.DoubleSide, 0, 35)) hit += w;
        }
        out[1] = tot ? hit / tot : 0;
        this.lampsAt(p, n, out, 1);
        // free roam: the sun's shadow at four times of day
        if (this.path) for (let k = 0; k < 4; k++) {
            const d = this.path[k];
            R.origin.set(p.x + n.x * 0.25 + d.x * 0.1, p.y + n.y * 0.25 + d.y * 0.1, p.z + n.z * 0.25 + d.z * 0.1);
            R.direction.copy(d);
            out[5 + k] = n.dot(d) > -0.1 && bvh.raycastFirst(R, THREE.DoubleSide, 0, 600) ? 1 : 0;
        }
    }
    // the lamps' light at a point, each one only if nothing stands between (so posts and walls throw lamp shadows)
    lampsAt(p, n, out, ndlMin) {
        const R = this.ray, bvh = this.bvh;
        out[2] = out[3] = out[4] = 0;
        if (!this.lamps.length) return;
        const cx = Math.floor(p.x / this.cell), cz = Math.floor(p.z / this.cell);
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
          const list = this.grid.get(gx + ',' + gz);
          if (list) for (const L of list) {
            const dx = L.p[0] - p.x, dy = L.p[1] - p.y, dz = L.p[2] - p.z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > L.r * L.r) continue;
            const d = Math.sqrt(d2), ndl = n ? (n.x * dx + n.y * dy + n.z * dz) / d : ndlMin;
            if (ndl <= 0) continue;
            if (d > 1.2 && bvh) {
                const o = n || { x: 0, y: 0, z: 0 };
                R.origin.set(p.x + o.x * 0.2, p.y + o.y * 0.2, p.z + o.z * 0.2);
                R.direction.set(dx / d, dy / d, dz / d);
                if (bvh.raycastFirst(R, THREE.DoubleSide, 0, d - 0.9)) continue;
            }
            const w = 1 - d2 / (L.r * L.r), k = L.i * w * w * ndl * 2.5 / (1 + d2 * 0.2);
            out[2] += L.c[0] * k; out[3] += L.c[1] * k; out[4] += L.c[2] * k;
          }
        }
    }
    /* The light at a moving thing's position (see probeLit): sun from the live sun direction (so it works in free
       roam's day too), sky, lamps. Smoothed, so driving under a bridge fades rather than snaps. */
    probe(p, sunDir, u, k = 0.3) {
        if (!this.bvh) return;
        const R = this.ray, out = this._po || (this._po = [0, 0, 0, 0, 0]), up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
        R.origin.set(p.x, p.y + 1.1, p.z);
        R.direction.copy(sunDir).normalize();
        const sh = sunDir.y > 0 && this.bvh.raycastFirst(R, THREE.DoubleSide, 0, 400) ? 1 : 0;
        let hit = 0, tot = 0;
        for (const d of SKY_DIRS) {
            R.origin.set(p.x, p.y + 1.1, p.z);
            R.direction.set(d[0], d[2], d[1]);
            const w = 0.3 + d[2];
            tot += w;
            if (this.bvh.raycastFirst(R, THREE.DoubleSide, 0, 30)) hit += w;
        }
        const q = this._pq || (this._pq = new THREE.Vector3());
        q.set(p.x, p.y + 0.8, p.z);
        this.lampsAt(q, null, out, 0.7);
        u.s.value.x += (sh - u.s.value.x) * k;
        u.s.value.y += (hit / tot - u.s.value.y) * k;
        const l = u.l.value, lk = LAMPK.value * 0.6;
        l.x += (out[2] * lk - l.x) * k; l.y += (out[3] * lk - l.y) * k; l.z += (out[4] * lk - l.z) * k;
    }
    // do some of the work; returns true when it's all done
    step(ms = 6) {
        if (this.done) return true;
        const t0 = performance.now(), p = new THREE.Vector3(), n = new THREE.Vector3(), m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        while (this.jobs.length && performance.now() - t0 < ms) {
            const J = this.jobs[0], o = J.o, g = o.geometry;
            const P = g.attributes.position, N = g.attributes.normal;
            nm.getNormalMatrix(o.matrixWorld);
            for (let c = 0; c < 400 && J.i < J.n; c++, J.i++) {
                if (o.isInstancedMesh) {
                    // a tree or a rock: one sample at its top-middle
                    o.getMatrixAt(J.i, m4); m4.premultiply(o.matrixWorld);
                    p.setFromMatrixPosition(m4);
                    const sc = new THREE.Vector3().setFromMatrixScale(m4);
                    p.y += Math.max(sc.y, 0.5) * 0.6;
                    n.set(0, 1, 0);
                } else {
                    p.fromBufferAttribute(P, J.i).applyMatrix4(o.matrixWorld);
                    if (N) n.fromBufferAttribute(N, J.i).applyMatrix3(nm).normalize(); else n.set(0, 1, 0);
                }
                this.sample(p, n, out);
                J.S[J.i * 2] = out[0]; J.S[J.i * 2 + 1] = out[1];
                J.L[J.i * 3] = out[2]; J.L[J.i * 3 + 1] = out[3]; J.L[J.i * 3 + 2] = out[4];
                if (J.T) for (let k = 0; k < 4; k++) J.T[J.i * 4 + k] = out[5 + k];
            }
            if (J.i >= J.n) {
                g.attributes.bakeS.needsUpdate = true; g.attributes.bakeL.needsUpdate = true;
                if (g.attributes.bakeT) g.attributes.bakeT.needsUpdate = true;
                this.jobs.shift();
            }
        }
        if (!this.jobs.length) this.finish();
        return this.done;
    }
    finish(known) {
        this.done = true;
        cache.set(this.key, this.results);          // the rays' structure stays: the cars' probes use it
        if (!known) dbPut(this.key, this.results);
    }
}

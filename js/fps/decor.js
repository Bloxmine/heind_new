/* Things that aren't part of the collision boxes: round pillars, pipes, trees, distant mesas, signs, lamps,
   bunting, lanterns, road markings, parked cars, domes. They're cel-shaded and lit by the sun and the
   baked light around them (a probe), so they sit in the same light as the map. Plus the sky dome. */
import * as THREE from 'three';
import { glows } from '../rally/retro.js';
import { dyn } from './models.js';
import { textures } from './textures.js';

function rng(seed) { let s = (seed * 9973) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });
// the netting pattern: a diamond mesh of cord, transparent between
let NET = null;
function netTex() {
    if (NET) return NET;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.strokeStyle = '#ffffff'; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 32); x.moveTo(32, 0); x.lineTo(0, 32); x.moveTo(-16, 16); x.lineTo(16, -16); x.moveTo(16, 48); x.lineTo(48, 16); x.moveTo(-16, 16); x.lineTo(16, 48); x.moveTo(16, -16); x.lineTo(48, 16); x.stroke();
    NET = new THREE.CanvasTexture(c);
    NET.wrapS = NET.wrapT = THREE.RepeatWrapping; NET.magFilter = THREE.NearestFilter; NET.minFilter = THREE.LinearMipmapLinearFilter;
    return NET;
}

export function buildDecor(map, lighting) {
    const root = new THREE.Group();
    const TX = textures();
    const probeAt = (p) => { const v = lighting.probe(p[0], p[1], p[2]); return { value: new THREE.Color(v[0], v[1], v[2]) }; };
    // a material from a colour or a texture name, with a probe at p; rep = texture repeats
    const M = (d, p, rep = [1, 1], key = 'm') => {
        const pr = d.lit === false ? { value: new THREE.Color(0.5, 0.5, 0.5) } : probeAt(p);
        const tex = d[key] && TX[d[key]];
        if (tex) { const t = tex.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; return dyn('#ffffff', pr, { map: t }); }
        return dyn(d[key === 'm' ? 'c' : key] || '#888888', pr);
    };
    const put = (o, shadow = true) => { o.traverse((q) => { if (q.isMesh) { q.castShadow = shadow; q.receiveShadow = shadow; } }); root.add(o); return o; };

    for (const d of map.decor) {
        const g = new THREE.Group();
        const shadow = d.shadow !== false;
        switch (d.t) {
            case 'cyl': {
                const [x, y, z] = d.p, seg = d.seg || 14;
                const m = new THREE.Mesh(new THREE.CylinderGeometry(d.r2 != null ? d.r2 : d.r, d.r, d.h, seg, 1, !!d.open), M(d, [x, y + d.h / 2, z], [Math.max(1, Math.round(d.r * 6.28 / 3)), Math.max(1, Math.round(d.h / 3))]));
                m.position.set(x, y + d.h / 2, z);
                g.add(m);
                if (d.bands) for (const by of d.bands) { const b = new THREE.Mesh(new THREE.CylinderGeometry(d.r * 1.04, d.r * 1.04, 0.25, seg), dyn(d.bandC || '#4a2818', probeAt([x, y + by, z]))); b.position.set(x, y + by, z); g.add(b); }
                if (d.dome) { const s = new THREE.Mesh(new THREE.SphereGeometry(d.r2 != null ? d.r2 : d.r, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(d, [x, y + d.h, z])); s.position.set(x, y + d.h, z); s.scale.y = d.dome; g.add(s); }
                break;
            }
            case 'pipe': {
                const a = new THREE.Vector3(...d.a), b = new THREE.Vector3(...d.b), L = a.distanceTo(b);
                const m = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, L, d.seg || 10), M(d, [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], [1, Math.max(1, Math.round(L / 3))]));
                m.position.copy(a).add(b).multiplyScalar(0.5);
                m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
                g.add(m);
                if (d.flanges) for (let t = 0; t <= 1.001; t += 1 / d.flanges) {
                    const f = new THREE.Mesh(new THREE.CylinderGeometry(d.r * 1.18, d.r * 1.18, 0.12, d.seg || 10), dyn(d.flangeC || '#5a3020', probeAt(a.toArray())));
                    f.position.copy(a).lerp(b, t); f.quaternion.copy(m.quaternion); g.add(f);
                }
                break;
            }
            case 'flare': {
                // a highway pillar: a round shaft with a flared cap under the deck
                const [x, y, z] = d.p;
                const mat = M(d, [x, y + d.h / 2, z]);
                const s = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 1.05, d.h, 16), mat); s.position.set(x, y + d.h / 2, z); g.add(s);
                const c = new THREE.Mesh(new THREE.CylinderGeometry(d.top, d.r, d.cap, 16), mat); c.position.set(x, y + d.h + d.cap / 2, z); c.scale.z = d.squash || 1; g.add(c);
                if (d.flutes) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, d.h, 0.06), dyn('#a8a498', probeAt(d.p))); f.position.set(x + Math.cos(a) * d.r, y + d.h / 2, z + Math.sin(a) * d.r); g.add(f); }
                break;
            }
            case 'vbox': {
                const [x0, y0, z0] = d.min, [x1, y1, z1] = d.max;
                const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M(d, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [Math.max(1, Math.round((x1 - x0 + z1 - z0) / 4)), Math.max(1, Math.round((y1 - y0) / 3))]));
                m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                if (d.ry) m.rotation.y = d.ry;
                if (d.rx) m.rotation.x = d.rx;
                g.add(m);
                break;
            }
            case 'pines': {
                // a patch of snowy pines, merged into one mesh (a forest of single trees would be thousands of draw calls).
                // trees: [[x, y, z, s], ...]; the patch shares one light probe, taken at its middle
                const pos = [], nor = [], col = [];
                const c = new THREE.Color(), push = (geo, color, mx) => {
                    const gg = geo.toNonIndexed(); gg.applyMatrix4(mx); gg.computeVertexNormals();
                    const P = gg.attributes.position, N = gg.attributes.normal;
                    c.set(color);
                    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
                };
                const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3();
                let cx = 0, cz = 0, cy = 0;
                const greens = d.cols || ['#14241e', '#18302a', '#102019'], snowC = d.snow || '#c4ccd0';
                for (const [x, y, z, s0] of d.trees) {
                    const s = s0 || 1, r = rng(Math.round(x * 13 + z * 7));
                    cx += x; cz += z; cy += y;
                    e.set(0, r() * 6.28, 0); q.setFromEuler(e);
                    mx.compose(new THREE.Vector3(x, y + 1.6 * s, z), q, one.set(s, s, s));
                    // far trees (lod): three plain tiers and no trunk, a fraction of the triangles
                    if (!d.lod) push(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 5), '#2a2018', mx);
                    const tiers = d.lod ? 3 : 4 + (r() < 0.5 ? 1 : 0), seg = d.lod ? 5 : 7;
                    for (let i = 0; i < tiers; i++) {
                        const t = i / tiers, rad = (2.3 - t * 1.9) * (0.9 + r() * 0.2), h = (2.6 - t * 0.9) * (d.lod ? 1.5 : 1), yy = d.lod ? 1.2 + i * 2.3 : 1.6 + i * 1.55;
                        mx.compose(new THREE.Vector3(x, y + (yy + h / 2) * s, z), q, one.set(s, s, s));
                        push(new THREE.ConeGeometry(rad, h, seg, 1, !!d.lod), greens[i % greens.length], mx);
                        // snow lying on the upper side of each tier
                        if (d.snow !== false) {
                            mx.compose(new THREE.Vector3(x + (r() - 0.5) * 0.1, y + (yy + h * 0.62) * s, z), q, one.set(s, s, s));
                            push(new THREE.ConeGeometry(rad * 0.62, h * 0.5, 7, 1, true), snowC, mx);
                        }
                    }
                }
                const n = d.trees.length || 1;
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
                geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
                const m = new THREE.Mesh(geo, dyn('#ffffff', probeAt([cx / n, cy / n + 3, cz / n]), { vertexColors: true }));
                g.add(m);
                break;
            }
            case 'net': {
                // safety netting: a see-through mesh on an upright rectangle from a to b (one of x or z the same)
                const [x0, y0, z0] = d.a, [x1, y1, z1] = d.b, along = Math.hypot(x1 - x0, z1 - z0), h = y1 - y0;
                const t = netTex().clone(); t.repeat.set(Math.max(1, along / 0.6), Math.max(1, h / 0.6)); t.needsUpdate = true;
                const m = new THREE.Mesh(new THREE.PlaneGeometry(along, h), dyn('#ffffff', probeAt([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]), { map: t, alphaTest: 0.5, side: THREE.DoubleSide, color: d.c || '#d8d4c4' }));
                m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
                g.add(m);
                put(g, false);
                continue;
            }
            case 'balls': {
                // a ball pit: lots of little balls in bright colours, one instanced mesh
                const [x0, y0, z0] = d.min, [x1, y1, z1] = d.max, r = rng(Math.round(x0 * 7 + z0 * 3) + 5), R = d.r || 0.17;
                const n = d.n || Math.round((x1 - x0) * (z1 - z0) / (R * R * 4.2));
                const cols = (d.cols || ['#e8262a', '#2a6ad8', '#f0c020', '#3ab04a', '#ff6aa0', '#ff8a1a']).map((c) => new THREE.Color(c));
                const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(R, 1), dyn('#ffffff', probeAt([(x0 + x1) / 2, y1, (z0 + z1) / 2])), n);
                const mx = new THREE.Matrix4();
                for (let i = 0; i < n; i++) {
                    mx.makeTranslation(x0 + R + r() * (x1 - x0 - 2 * R), y0 + R + (y1 - y0 - 2 * R) * Math.sqrt(r()), z0 + R + r() * (z1 - z0 - 2 * R));
                    im.setMatrixAt(i, mx); im.setColorAt(i, cols[Math.floor(r() * cols.length)]);
                }
                g.add(im);
                put(g, false);
                continue;
            }
            case 'lights': {
                // far-off lights: a town down in the valley. Little points that don't fade in the fog
                const pos = [], cols = [], r = rng(d.seed || 3), c = new THREE.Color();
                for (const [x0, y0, z0, x1, z1, k] of d.areas) {
                    for (let i = 0; i < k; i++) {
                        pos.push(x0 + r() * (x1 - x0), y0 + r() * 0.5, z0 + r() * (z1 - z0));
                        c.set(d.cols[Math.floor(r() * d.cols.length)]); cols.push(c.r, c.g, c.b);
                    }
                }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
                const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: d.size || 1.5, sizeAttenuation: false, vertexColors: true, fog: false }));
                root.add(pts);
                continue;
            }
            case 'tree': case 'shrub': {
                const [x, y, z] = d.p, s = d.s || 1, r = rng(Math.round(x * 31 + z * 17));
                const pr = probeAt([x, y + 2 * s, z]);
                if (d.t === 'tree') { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.22 * s, 3 * s, 6), dyn('#5a4230', pr)); tr.position.set(x, y + 1.5 * s, z); g.add(tr); }
                const cols = d.cols || ['#4f7a2e', '#628f38', '#3e6626'];
                const n = d.t === 'tree' ? 4 : 2;
                for (let i = 0; i < n; i++) {
                    const k = (d.t === 'tree' ? 1.3 : 0.6) * s * (0.7 + r() * 0.5);
                    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(k, 0), dyn(cols[i % cols.length], pr));
                    f.position.set(x + (r() - 0.5) * 1.4 * s, y + (d.t === 'tree' ? 3.2 : 0.4) * s + (r() - 0.3) * 1.2 * s * (d.t === 'tree' ? 1 : 0.3), z + (r() - 0.5) * 1.4 * s);
                    f.rotation.set(r() * 3, r() * 3, 0);
                    g.add(f);
                }
                break;
            }
            case 'mesa': {
                // a butte or mesa: stacked, slightly shrinking slabs of banded rock on a sloped skirt
                const [x, y, z] = d.p, r = rng(d.seed || Math.round(x + z));
                const far = !!d.far;
                const mat = (cx, cy, cz, w, h) => { const t = TX.rock.clone(); t.repeat.set(Math.max(1, w / 8), Math.max(1, h / 8)); t.needsUpdate = true; return dyn('#ffffff', far ? { value: new THREE.Color(...(map.farProbe || [0.35, 0.3, 0.3])) } : probeAt([cx, cy, cz]), { map: t }); };
                let w = d.w, dd = d.d, yy = y;
                // skirt
                for (let i = 0; i < (d.skirt || 3); i++) {
                    const h = d.h * 0.06;
                    const sw = w * (1.9 - i * 0.28), sd = dd * (1.9 - i * 0.28);
                    const m = new THREE.Mesh(new THREE.BoxGeometry(sw, h, sd), mat(x, yy, z, sw, h)); m.position.set(x + (r() - 0.5) * 2, yy + h / 2, z + (r() - 0.5) * 2); m.rotation.y = (r() - 0.5) * 0.2; g.add(m); yy += h;
                }
                const layers = d.layers || 6, lh = (d.h - (yy - y)) / layers;
                for (let i = 0; i < layers; i++) {
                    const k = 1 - i * (d.taper || 0.03);
                    const m = new THREE.Mesh(new THREE.BoxGeometry(w * k + (r() - 0.5) * 1.5, lh * 1.02, dd * k + (r() - 0.5) * 1.5), mat(x, yy, z, w, lh));
                    m.position.set(x + (r() - 0.5) * 0.8, yy + lh / 2, z + (r() - 0.5) * 0.8); m.rotation.y = (r() - 0.5) * 0.08; g.add(m); yy += lh;
                }
                if (d.spire) { const [sx, sz, sw, sh] = d.spire; const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sw * 1.2), mat(x + sx, y + d.h * 0.5, z + sz, sw, sh)); m.position.set(x + sx, y + d.h * 0.25 + sh / 2, z + sz); g.add(m); }
                put(g, !far);
                continue;
            }
            case 'stop': case 'sign': {
                const [x, y, z] = d.p, pr = probeAt([x, y + 1.5, z]);
                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, d.h || 2.6, 6), dyn('#8a8c90', pr)); pole.position.set(x, y + (d.h || 2.6) / 2, z); g.add(pole);
                const sg = new THREE.Group(); sg.position.set(x, y + (d.h || 2.6), z); sg.rotation.y = d.ry || 0; g.add(sg);
                if (d.t === 'stop') {
                    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 8), dyn('#f4f4f0', pr)); o.rotation.set(Math.PI / 2, Math.PI / 8, 0); sg.add(o);
                    const i = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.035, 8), dyn('#d81e3a', pr)); i.rotation.set(Math.PI / 2, Math.PI / 8, 0); i.position.z = -0.005; sg.add(i);
                    const tx = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.04), dyn('#f4f4f0', pr)); tx.position.z = -0.01; sg.add(tx);
                } else {
                    const b = new THREE.Mesh(new THREE.BoxGeometry(d.w || 1, d.sh || 0.6, 0.04), dyn(d.c || '#2a7a3a', pr)); sg.add(b);
                    const st = new THREE.Mesh(new THREE.BoxGeometry((d.w || 1) * 0.8, 0.06, 0.045), dyn('#f4f4f0', pr)); sg.add(st);
                }
                break;
            }
            case 'pole': {
                const [x, y, z] = d.p, h = d.h || 9, pr = probeAt([x, y + h / 2, z]);
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, h, 6), dyn('#6a5040', pr)); p.position.set(x, y + h / 2, z); g.add(p);
                const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), dyn('#5a4232', pr)); c.position.set(x, y + h - 0.6, z); c.rotation.y = d.ry || 0; g.add(c);
                if (d.to) {
                    const a = new THREE.Vector3(x, y + h - 0.55, z), b = new THREE.Vector3(d.to[0], d.to[1] + h - 0.55, d.to[2]);
                    for (let i = 0; i < 8; i++) {
                        const p0 = a.clone().lerp(b, i / 8), p1 = a.clone().lerp(b, (i + 1) / 8);
                        p0.y -= Math.sin(i / 8 * Math.PI) * 0.8; p1.y -= Math.sin((i + 1) / 8 * Math.PI) * 0.8;
                        const L = p0.distanceTo(p1), w = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, L), dyn('#202020', pr));
                        w.position.copy(p0).add(p1).multiplyScalar(0.5); w.lookAt(p1); g.add(w);
                    }
                }
                break;
            }
            case 'lamp': {
                // a street lamp: post, arm, glowing head
                const [x, y, z] = d.p, h = d.h || 7, pr = probeAt([x, y + h / 2, z]);
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h, 6), dyn(d.c || '#7a7e84', pr)); p.position.set(x, y + h / 2, z); g.add(p);
                const arm = new THREE.Group(); arm.position.set(x, y + h, z); arm.rotation.y = d.ry || 0; g.add(arm);
                const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), dyn(d.c || '#7a7e84', pr)); a.position.z = -0.8; arm.add(a);
                const hd = glows(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.6), glowMat(d.glow || '#fff2c8'))); hd.position.set(0, -0.08, -1.5); arm.add(hd);
                break;
            }
            case 'downlight': {
                // a can light under a deck
                const [x, y, z] = d.p;
                const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 8), dyn('#3a3c40', probeAt([x, y - 1, z]))); can.position.set(x, y - 0.15, z); g.add(can);
                const lens = glows(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 8), glowMat(d.glow || '#fffbe8'))); lens.position.set(x, y - 0.31, z); g.add(lens);
                break;
            }
            case 'traffic': {
                const [x, y, z] = d.p, pr = probeAt([x, y + 3, z]);
                const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6), dyn('#4a4c50', pr)); p.position.set(x, y + 2.75, z); g.add(p);
                const arm = new THREE.Group(); arm.position.set(x, y + 5.3, z); arm.rotation.y = d.ry || 0; g.add(arm);
                const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, d.len || 4), dyn('#4a4c50', pr)); a.position.z = -(d.len || 4) / 2; arm.add(a);
                for (const off of d.heads || [-(d.len || 4) * 0.55, -(d.len || 4) * 0.95]) {
                    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.3), dyn('#16171a', pr)); box.position.set(0, -0.5, off); arm.add(box);
                    ['r', 'y', 'g'].forEach((k, i) => {
                        const on = (d.lit || 'r') === k;
                        const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), on ? glowMat({ r: '#ff2a2a', y: '#ffb020', g: '#3aff6a' }[k]) : dyn('#2a2a2a', pr));
                        if (on) glows(l);
                        l.position.set(0, -0.2 - i * 0.28, off + 0.16); arm.add(l);
                    });
                }
                break;
            }
            case 'flags': {
                // bunting: little triangles hanging off a sagging line
                const a = new THREE.Vector3(...d.a), b = new THREE.Vector3(...d.b), n = d.n || 12, cols = d.cols || ['#d8262a', '#f4f0e8'];
                const pr = probeAt([(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]);
                const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.38, 0], 3)); tri.computeVertexNormals();
                const mats = cols.map((c) => dyn(c, pr, { side: THREE.DoubleSide }));
                for (let i = 0; i < n; i++) {
                    const t = (i + 0.5) / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * (d.sag || 0.6);
                    const m = new THREE.Mesh(tri, mats[i % mats.length]); m.position.copy(p); m.lookAt(p.x + (b.z - a.z), p.y, p.z - (b.x - a.x)); g.add(m);
                }
                break;
            }
            case 'banner': {
                // a hanging cloth (a big flag or a carpet on display)
                const [x, y, z] = d.p;
                const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w || 1.2, d.h || 1.8), M(d, [x, y - (d.h || 1.8) / 2, z]));
                m.material.side = THREE.DoubleSide;
                m.position.set(x, y - (d.h || 1.8) / 2, z); m.rotation.y = d.ry || 0; g.add(m);
                if (d.emblem) { const e = new THREE.Mesh(new THREE.CircleGeometry((d.w || 1.2) * 0.22, 10), dyn(d.emblem, probeAt(d.p), { side: THREE.DoubleSide })); e.position.set(x, y - (d.h || 1.8) * 0.45, z); e.rotation.y = d.ry || 0; e.translateZ(0.01); g.add(e); }
                break;
            }
            case 'lantern': {
                const [x, y, z] = d.p;
                const chain = new THREE.Mesh(new THREE.BoxGeometry(0.03, d.drop || 0.8, 0.03), dyn('#2a2420', probeAt(d.p))); chain.position.set(x, y - (d.drop || 0.8) / 2, z); g.add(chain);
                const l = glows(new THREE.Mesh(new THREE.OctahedronGeometry(d.size || 0.15, 0), glowMat(d.glow || '#ffb85a'))); l.position.set(x, y - (d.drop || 0.8) - 0.2, z); l.scale.y = 1.4; g.add(l);
                break;
            }
            case 'decal': {
                // markings on a road or floor: a rectangle or an arrow, lying flat
                const [x, y, z] = d.p;
                let geo;
                if (d.shape === 'arrow') {
                    const s = new THREE.Shape(); const w = d.w || 0.5, L = d.d || 3;
                    s.moveTo(-w / 2, L / 2); s.lineTo(w / 2, L / 2); s.lineTo(w / 2, -L / 2 + w * 2); s.lineTo(w * 1.6, -L / 2 + w * 2); s.lineTo(0, -L / 2); s.lineTo(-w * 1.6, -L / 2 + w * 2); s.lineTo(-w / 2, -L / 2 + w * 2); s.lineTo(-w / 2, L / 2);
                    geo = new THREE.ShapeGeometry(s);
                } else geo = new THREE.PlaneGeometry(d.w, d.d);
                const mat = dyn(d.c || '#e8e4d8', probeAt([x, y + 0.5, z]), { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
                const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.rotation.z = d.ry || 0; m.position.set(x, y + 0.015, z);
                g.add(m);
                put(g, false); g.traverse((q) => { if (q.isMesh) q.receiveShadow = true; });
                continue;
            }
            case 'car': {
                const [x, y, z] = d.p, pr = probeAt([x, y + 1, z]), L = d.L || 4.4, W = d.W || 1.8, H = d.H || 1.45;
                const body = dyn(d.c || '#3a6ad8', pr), dark = dyn('#16171a', pr), glass = dyn('#1a2838', pr);
                const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = d.ry || 0; g.add(c);
                const b = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.45, L), body); b.position.y = H * 0.38; c.add(b);
                const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * 0.38, L * (d.van ? 0.85 : 0.5)), glass); cab.position.set(0, H * 0.78, d.van ? -0.1 : 0.15); c.add(cab);
                const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.06, L * (d.van ? 0.85 : 0.5)), body); roof.position.set(0, H * 0.98, d.van ? -0.1 : 0.15); c.add(roof);
                for (const [wx, wz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 8), dark); w.rotation.z = Math.PI / 2; w.position.set(wx * W * 0.47, 0.33, wz * L * 0.32); c.add(w); }
                if (d.lights) { const hl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.1, 0.04), glowMat('#c82a20')); hl.position.set(0, H * 0.5, L / 2 + 0.01); c.add(hl); }
                break;
            }
            case 'dome': {
                const [x, y, z] = d.p;
                const m = new THREE.Mesh(new THREE.SphereGeometry(d.r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), M(d, [x, y + d.r / 2, z], [3, 1]));
                m.position.set(x, y, z); g.add(m);
                if (d.drum) { const dr = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.drum, 14), M(d, [x, y, z])); dr.position.set(x, y - d.drum / 2, z); g.add(dr); }
                break;
            }
            case 'vault': {
                // a barrel vault over a hall, seen from below: half a cylinder along an axis
                const [x, y, z] = d.p;
                const m = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.L, 14, 1, true, Math.PI / 2, Math.PI), M(d, [x, y, z], [Math.round(d.L / 3), 2]));
                m.material.side = THREE.DoubleSide;
                m.rotation.z = Math.PI / 2; if (d.ax === 'z') m.rotation.set(Math.PI / 2, 0, 0);
                if (d.ax === 'z') m.rotation.set(Math.PI / 2, Math.PI / 2, 0);
                m.position.set(x, y, z); g.add(m);
                break;
            }
            case 'stack': {
                // a stack of folded carpets or sacks: boxes in rich colours
                const [x, y, z] = d.p, r = rng(Math.round(x * 7 + z * 13)), cols = d.cols || ['#8a1e22', '#2a3a7a', '#a85a1e', '#5a2a5a', '#c89a3a'];
                let yy = y;
                for (let i = 0; i < (d.n || 6); i++) {
                    const h = 0.12 + r() * 0.1;
                    const m = new THREE.Mesh(new THREE.BoxGeometry((d.w || 1.2) * (0.85 + r() * 0.2), h, (d.d || 0.8) * (0.85 + r() * 0.2)), dyn(cols[Math.floor(r() * cols.length)], probeAt([x, yy, z])));
                    m.position.set(x + (r() - 0.5) * 0.1, yy + h / 2, z + (r() - 0.5) * 0.1); m.rotation.y = (r() - 0.5) * 0.15; g.add(m); yy += h;
                }
                break;
            }
            case 'grass': {
                // tufts of dry grass on sand
                const [x, y, z] = d.p, r = rng(Math.round(x * 3 + z * 5)), pr = probeAt([x, y + 0.3, z]);
                for (let i = 0; i < (d.n || 5); i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4 + r() * 0.3, 5), dyn(d.c || '#8a8a4a', pr)); m.position.set(x + (r() - 0.5) * 1.6, y + 0.25, z + (r() - 0.5) * 1.6); g.add(m); }
                break;
            }
        }
        put(g, shadow);
    }
    return root;
}

/* ---------- the sky: a gradient dome, the sun or the moon, stars ---------- */
export function buildSky(map, radius) {
    const S = map.sky;
    const root = new THREE.Group();
    if (!S) return root;
    const geo = new THREE.SphereGeometry(radius, 32, 16);
    const col = [], c = new THREE.Color(), top = new THREE.Color(S.top), hor = new THREE.Color(S.horizon), gnd = new THREE.Color(S.ground || S.horizon);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / radius;
        if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, S.curve || 0.55)); else c.copy(hor).lerp(gnd, Math.min(1, -y * 6));
        col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    root.add(dome);
    const sd = new THREE.Vector3(...map.sun.dir).normalize().multiplyScalar(-1);
    if (S.sun) {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.016, 24), new THREE.MeshBasicMaterial({ color: '#fffdf4', fog: false, depthWrite: false }));
        disc.position.copy(sd).multiplyScalar(radius * 0.9); disc.lookAt(0, 0, 0); disc.renderOrder = -9;
        root.add(disc);
    }
    if (S.moon) {
        const md = new THREE.Vector3(...S.moonDir).normalize();
        const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.014, 20), new THREE.MeshBasicMaterial({ color: S.moon, fog: false, depthWrite: false }));
        disc.position.copy(md).multiplyScalar(radius * 0.9); disc.lookAt(0, 0, 0); disc.renderOrder = -9;
        root.add(disc);
    }
    if (S.stars) {
        const r = rng(7), pos = [];
        for (let i = 0; i < S.stars; i++) {
            const u = r() * 2 * Math.PI, v = 0.08 + r() * 0.92;
            const y = v, k = Math.sqrt(1 - y * y);
            pos.push(Math.cos(u) * k * radius * 0.95, y * radius * 0.95, Math.sin(u) * k * radius * 0.95);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.5, sizeAttenuation: false, fog: false, depthWrite: false }));
        pts.renderOrder = -9;
        root.add(pts);
    }
    return root;
}

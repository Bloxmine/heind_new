/* Track-specific scenery: desert mesas, harbour containers and cranes, floodlights that pool light on the road,
   concrete barriers, rocks and a neon roadside sign. Each track lists which of these it wants. */
import * as THREE from 'three';
import { cel, glows, GLOW } from './retro.js';
import { rng } from './textures.js';

const Y = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const yaw = (s) => Math.atan2(s.tx, s.tz);
const place = (x, y, z, ry, sx = 1, sy = 1, sz = 1) => m4.compose(v3.set(x, y, z), q.setFromAxisAngle(Y, ry), s3.set(sx, sy, sz)).clone();
const instanced = (geo, mat, mats, cols) => {
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    if (cols) { const c = new THREE.Color(); cols.forEach((h, i) => im.setColorAt(i, c.set(h))); }
    return im;
};
// A point beside the road at sample i: side 0 = right, 1 = left; offset measured from the road centre.
const beside = (S, i, side, off) => { const s = S[i], sg = side ? -1 : 1; return { x: s.x + s.sx * off * sg, z: s.z + s.sz * off * sg, y: s.y, s }; };
// Far enough from every part of the road?
const clear = (S, x, z, min) => { for (let i = 0; i < S.length; i += 3) if ((S[i].x - x) ** 2 + (S[i].z - z) ** 2 < min * min) return false; return true; };

const neonTex = (text, a, b) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 24;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 64, 24);
    x.strokeStyle = a; x.lineWidth = 1; x.strokeRect(1.5, 1.5, 61, 21);
    x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = b; x.fillText(text, 32, 13);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

export const PROPS = {
    // big red-rock plateaus out in the desert
    mesas(ctx, o) {
        const { S, group, TX } = ctx, r = rng(91);
        const mat = cel({ map: TX.redrock });
        for (let n = 0, tries = 0; n < (o.count || 14) && tries < 400; tries++) {
            const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, off = 50 + r() * 180;
            const p = beside(S, i, side, off);
            const rad = 14 + r() * 26;
            if (!clear(S, p.x, p.z, rad + 22)) continue;
            const h = 18 + r() * 40;
            const g = new THREE.CylinderGeometry(rad * (0.75 + r() * 0.15), rad, h, 7);
            const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rad * 0.4, uv.getY(k) * h / 8);
            const mesh = new THREE.Mesh(g, mat);
            mesh.position.set(p.x, ctx.def.groundY + h / 2 - 2, p.z);
            mesh.rotation.y = r() * 3;
            group.add(mesh);
            n++;
        }
    },
    rocks(ctx, o) {
        const { S, group, TX } = ctx, r = rng(17);
        const mats = [];
        for (let i = 4; i < S.length; i += 6) for (let side = 0; side < 2; side++) {
            if (r() > (o.density || 0.4)) continue;
            const s = S[i], p = s.prof[side];
            if (p.drop) continue;
            const off = p.off[2] + r() * (p.off[3] - p.off[2] + 6);
            const b = beside(S, i, side, off);
            const k = (off - p.off[2]) / Math.max(1, p.off[3] - p.off[2]);
            const sc = 0.6 + r() * 1.6;
            mats.push(place(b.x, s.y + Math.min(1, k) * p.hy[3] + sc * 0.3, b.z, r() * 6, sc, sc * 0.7, sc));
        }
        group.add(instanced(new THREE.DodecahedronGeometry(1, 0), cel({ map: TX[o.tex || 'rock'] }), mats));
    },
    // jersey barriers right beside the road; the track builder also turns them into walls
    barriers(ctx, o) {
        const { S, group, TX } = ctx, mats = [];
        const geo = new THREE.BoxGeometry(0.5, 0.9, ctx.seg * 1.02); geo.translate(0, 0.45, 0);
        for (let i = 0; i < S.length; i++) {
            const s = S[i], n = S[(i + 1) % S.length];
            for (let side = 0; side < 2; side++) {
                const sg = side ? -1 : 1, o = s.w / 2 + 1.9, o2 = n.w / 2 + 1.9;
                const ax = s.x + s.sx * o * sg, az = s.z + s.sz * o * sg, bx = n.x + n.sx * o2 * sg, bz = n.z + n.sz * o2 * sg;
                mats.push(place((ax + bx) / 2, (s.y + n.y) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az)));
            }
        }
        group.add(instanced(geo, cel({ map: TX[o.tex || 'barrier'] }), mats));
    },
    // stacks of shipping containers along the docks
    containers(ctx, o) {
        const { S, group, TX } = ctx, r = rng(55);
        const cols = ['#a8402a', '#2a5a8a', '#3a7a4a', '#c8a028', '#7a7e86', '#6a3a6a', '#c86a2a'];
        const mats = [], tint = [];
        const geo = new THREE.BoxGeometry(2.5, 2.6, 6.1); geo.translate(0, 1.3, 0);
        for (let i = 0; i < S.length; i += 4) for (let side = 0; side < 2; side++) {
            if (r() < 0.22) continue;
            const off = S[i].w / 2 + 6 + r() * 2;
            const b = beside(S, i, side, off);
            const rows = 1 + ((r() * 2) | 0);
            for (let row = 0; row < rows; row++) {
                const stack = 1 + ((r() * 3) | 0);
                for (let k = 0; k < stack; k++) {
                    const sgn = side ? -1 : 1, o2 = off + row * 2.7;
                    const bb = beside(S, i, side, o2);
                    mats.push(place(bb.x, S[i].y + S[i].h[side] + k * 2.62, bb.z, yaw(S[i]) + (r() - 0.5) * 0.06));
                    tint.push(cols[(r() * cols.length) | 0]);
                }
            }
        }
        group.add(instanced(geo, cel({ map: TX.container }), mats, tint));
    },
    // gantry cranes towering over the harbour, red lights blinking on top
    cranes(ctx, o) {
        const { S, group, anim } = ctx, r = rng(71);
        const steel = cel({ color: '#c8902a' });
        const blink = [];
        for (let n = 0, tries = 0; n < (o.count || 5) && tries < 200; tries++) {
            const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1;
            const b = beside(S, i, side, S[i].w / 2 + 26 + r() * 20);
            if (!clear(S, b.x, b.z, 20)) continue;
            const g = new THREE.Group();
            for (const [lx, lz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) {
                const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 30, 0.9), steel); leg.position.set(lx, 15, lz); g.add(leg);
            }
            const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 2), steel); beam.position.set(0, 30, -5); g.add(beam);
            const beam2 = beam.clone(); beam2.position.z = 5; g.add(beam2);
            const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 46), steel); boom.position.set(0, 31.5, 12); g.add(boom);
            const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), cel({ color: '#3a3e44' })); cab.position.set(0, 28.5, 0); g.add(cab);
            const lamp = glows(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false })));
            lamp.position.set(0, 33, 34); g.add(lamp); blink.push(lamp);
            g.position.set(b.x, S[i].y + S[i].h[side], b.z);
            g.rotation.y = yaw(S[i]) + Math.PI / 2 + (r() - 0.5) * 0.4;
            group.add(g);
            n++;
        }
        anim.push((t) => blink.forEach((l, k) => { l.visible = Math.floor(t * 1.2 + k * 0.37) % 2 === 0; }));
    },
    // floodlight poles; each throws a stylised pool of light onto the road
    floodlights(ctx, o) {
        const { S, group, TX } = ctx, every = o.every || 22;
        const pole = cel({ color: '#5a5e66' });
        const head = new THREE.MeshBasicMaterial({ color: o.color || '#ffe2a8', fog: false });
        const pool = new THREE.MeshBasicMaterial({ map: TX.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: o.color || '#ffe2a8' });
        const poolGeo = new THREE.PlaneGeometry(16, 16); poolGeo.rotateX(-Math.PI / 2);
        for (let i = 6, k = 0; i < S.length; i += every, k++) {
            const side = k % 2, s = S[i], off = s.w / 2 + (o.inset || 2.6);
            const b = beside(S, i, side, off);
            const H = o.height || 11;
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 0.3), pole); p.position.set(b.x, s.y + H / 2, b.z); group.add(p);
            const toward = beside(S, i, side, off - 2.4);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.6), pole); arm.position.set((b.x + toward.x) / 2, s.y + H, (b.z + toward.z) / 2);
            arm.rotation.y = Math.atan2(toward.x - b.x, toward.z - b.z); group.add(arm);
            const h = glows(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.6), head)); h.position.set(toward.x, s.y + H - 0.2, toward.z); h.rotation.y = arm.rotation.y; group.add(h);
            const at = beside(S, i, side, s.w * 0.2);
            const pm = new THREE.Mesh(poolGeo, pool); pm.position.set(at.x, s.y + 0.07, at.z); pm.renderOrder = 2; group.add(pm);
        }
    },
    // a glowing neon roadside sign
    neon(ctx, o) {
        const { S, group } = ctx;
        const i = o.at || 40, side = o.side || 0;
        const b = beside(S, i, side, S[i].w / 2 + (o.dist || 9));
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), cel({ color: '#3a3e44' })); post.position.y = 3.5; g.add(post);
        const board = glows(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: neonTex(o.text || 'CAFE', o.a || '#3ad0ff', o.b || '#ff3a6e'), side: THREE.DoubleSide })));
        board.position.y = 8; g.add(board);
        const arrow = glows(new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 3), new THREE.MeshBasicMaterial({ color: o.a || '#3ad0ff' })));
        arrow.position.set(3.8, 8, 0); arrow.rotation.z = -Math.PI / 2; g.add(arrow);
        g.position.set(b.x, S[i].y, b.z);
        g.rotation.y = yaw(S[i]) + Math.PI + (side ? -0.5 : 0.5);
        group.add(g);
    }
};

// --- town and city ---
// gabled houses in pastel colours shoulder to shoulder along the street
PROPS.houses = (ctx, o) => {
    const { S, group, TX } = ctx, r = rng(101);
    const cols = ['#e8d8b8', '#d8b0a0', '#b8c8d8', '#e8e0a8', '#c8d8b8', '#e0c0c8', '#f0e8e0'];
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const prism = new THREE.CylinderGeometry(0.72, 0.72, 1, 3); prism.rotateX(-Math.PI / 2); prism.scale(0.8, 0.5, 1);   // ridge along the street
    const walls = [], wallCol = [], roofs = [];
    for (let i = 0; i < S.length; i += 4) for (let side = 0; side < 2; side++) {
        if (r() < (o.gaps || 0.12)) continue;
        const s = S[i], depth = 8 + r() * 4, wid = 7.6 + r() * 1.5, hgt = 7 + r() * (o.tall || 6);
        const off = s.w / 2 + (o.inset || 4) + depth / 2;
        const b = beside(S, i, side, off);
        if (!clear(S, b.x, b.z, s.w / 2 + 3.5 + depth / 2 - 1)) continue;
        const yaw0 = yaw(s);
        walls.push(place(b.x, s.y - 0.5, b.z, yaw0, depth, hgt, wid));
        wallCol.push(cols[(r() * cols.length) | 0]);
        roofs.push(place(b.x, s.y - 0.5 + hgt + 0.76, b.z, yaw0, depth * 1.06, 4.2, wid * 1.02));
    }
    const wm = cel({ map: TX.facade });
    group.add(instanced(box, wm, walls, wallCol));
    group.add(instanced(prism, cel({ map: TX.roof }), roofs));
};
// a church tower with a spire, near the road
PROPS.church = (ctx, o) => {
    const { S, group, TX } = ctx;
    const i = o.at || 60, s = S[i], b = beside(S, i, o.side || 1, s.w / 2 + 14);
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 26, 7), cel({ map: TX.stone }));
    tower.position.y = 13; g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.2, 14, 4), cel({ color: '#3a5a6a' }));
    spire.position.y = 33; spire.rotation.y = Math.PI / 4; g.add(spire);
    const clock = glows(new THREE.Mesh(new THREE.CircleGeometry(1.6, 12), new THREE.MeshBasicMaterial({ color: '#ffe8b0' })));
    clock.position.set(0, 20, 3.55); g.add(clock);
    g.position.set(b.x, s.y - 1, b.z); g.rotation.y = yaw(s);
    group.add(g);
};
// skyscrapers with lit windows, an aircraft light on top
PROPS.towers = (ctx, o) => {
    const { S, group, TX, anim } = ctx, r = rng(131);
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const mats = [], tops = [];
    for (let i = 0; i < S.length; i += 6) for (let side = 0; side < 2; side++) {
        if (r() < 0.25) continue;
        const s = S[i], w = 14 + r() * 12, h = 30 + r() * (o.tall || 70);
        const b = beside(S, i, side, s.w / 2 + 10 + w / 2 + r() * 12);
        if (!clear(S, b.x, b.z, s.w / 2 + 8 + w / 2)) continue;
        const y0 = o.fromGround ? ctx.def.groundY : s.y - 1, hh = h + (o.fromGround ? s.y - y0 : 0);
        mats.push(place(b.x, y0, b.z, yaw(s) + (r() - 0.5) * 0.2, w, hh, w * (0.7 + r() * 0.5)));
        if (h > 60) tops.push([b.x, y0 + hh, b.z]);
    }
    const tex = TX.windows.clone(); tex.repeat.set(1.5, 3); tex.needsUpdate = true;
    group.add(instanced(box, cel({ map: tex, emissive: '#ffffff', emissiveMap: tex }), mats));
    const blink = [];
    for (const [x, y, z] of tops) { const l = glows(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false }))); l.position.set(x, y + 0.5, z); group.add(l); blink.push(l); }
    anim.push((t) => blink.forEach((l, k) => { l.visible = Math.floor(t * 1.1 + k * 0.29) % 2 === 0; }));
};
// lots of neon signs along the road
PROPS.neons = (ctx, o) => {
    const words = o.words || ['HOTEL', 'ARCADE', 'NOODLES', '24H', 'KARAOKE', 'CLUB', 'TAXI', 'DINER'];
    const pairs = [['#3ad0ff', '#ff3a6e'], ['#ff3a6e', '#ffe23a'], ['#b04aff', '#3ad0ff'], ['#4aff7a', '#ff9a3a']];
    const r = rng(151);
    for (let i = 20, k = 0; i < ctx.S.length - 10; i += o.every || 34, k++) {
        const [a, b] = pairs[k % pairs.length];
        PROPS.neon(ctx, { at: i, side: k % 2, text: words[k % words.length], a, b, dist: 7 + r() * 4 });
    }
};
// --- stadium ---
// grandstands full of crowd around the outside of the bowl
PROPS.stands = (ctx, o) => {
    const { S, group, TX } = ctx, r = rng(171);
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const steps = [], roofs = [];
    for (let i = 0; i < S.length; i += 5) for (let side = 0; side < 2; side++) {
        const s = S[i];
        for (let row = 0; row < 4; row++) {
            const b = beside(S, i, side, s.w / 2 + 7 + row * 2.4);
            if (!clear(S, b.x, b.z, s.w / 2 + 5)) break;
            steps.push(place(b.x, s.y - 0.5, b.z, yaw(s), 2.4, 1.2 + row * 1.4, ctx.seg * 5.2));
            if (row === 3) roofs.push(place(beside(S, i, side, s.w / 2 + 13).x, s.y + 9, beside(S, i, side, s.w / 2 + 13).z, yaw(s), 9, 0.4, ctx.seg * 5.2));
        }
    }
    const crowd = TX.crowd.clone(); crowd.repeat.set(1, 1); crowd.needsUpdate = true;
    group.add(instanced(box, cel({ map: crowd }), steps));
    group.add(instanced(box, cel({ color: '#2a3139' }), roofs));
};
// floodlight towers: tall masts with a bank of lights, pooling on the arena floor
PROPS.towerLights = (ctx, o) => {
    const { S, group, TX } = ctx;
    const mast = cel({ color: '#4a4e56' }), lamp = new THREE.MeshBasicMaterial({ color: '#fff4d8', fog: false });
    const pool = new THREE.MeshBasicMaterial({ map: TX.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#fff0c8' });
    const poolGeo = new THREE.PlaneGeometry(40, 40); poolGeo.rotateX(-Math.PI / 2);
    for (let k = 0; k < (o.count || 6); k++) {
        const i = Math.floor((k + 0.5) / (o.count || 6) * S.length), side = k % 2, s = S[i];
        const b = beside(S, i, side, s.w / 2 + 22);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 30, 1), mast); m.position.set(b.x, s.y + 15, b.z); group.add(m);
        const bank = glows(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), lamp)); bank.position.set(b.x, s.y + 30, b.z); bank.lookAt(s.x, s.y, s.z); group.add(bank);
        const at = beside(S, i, side, s.w * 0.1);
        const pm = new THREE.Mesh(poolGeo, pool); pm.position.set(at.x, s.y + 0.08, at.z); pm.renderOrder = 2; group.add(pm);
    }
};
// --- jungle ---
// stepped temple pyramids in the jungle, and fallen stone blocks near the road
PROPS.ruins = (ctx, o) => {
    const { S, group, TX } = ctx, r = rng(191);
    const stone = cel({ map: TX.stone });
    for (let n = 0, tries = 0; n < (o.count || 5) && tries < 300; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, off = 40 + r() * 70;
        const p = beside(S, i, side, off);
        if (!clear(S, p.x, p.z, 34)) continue;
        const g = new THREE.Group(), w = 24 + r() * 10;
        for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(w - k * 4.4, 4, w - k * 4.4), stone); m.position.y = k * 4 + 2; g.add(m); }
        const shrine = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), stone); shrine.position.y = 22.5; g.add(shrine);
        g.position.set(p.x, S[i].y + Math.max(0, S[i].h[side]) - 2, p.z); g.rotation.y = r() * 3;
        group.add(g); n++;
    }
    const blocks = [];
    for (let i = 8; i < S.length; i += 9) {
        if (r() > 0.5) continue;
        const side = r() < 0.5 ? 0 : 1, s = S[i], p = s.prof[side];
        if (p.drop) continue;
        const b = beside(S, i, side, p.off[2] + 1 + r() * 4);
        const sc = 1 + r() * 1.5;
        blocks.push(place(b.x, s.y + p.hy[2] + sc * 0.4, b.z, r() * 3, sc * 1.6, sc, sc));
    }
    group.add(instanced(new THREE.BoxGeometry(1, 1, 1), stone, blocks));
};

// --- coast ---
// a striped lighthouse on the cliffs, its beam sweeping round
PROPS.lighthouse = (ctx, o) => {
    const { S, group, anim } = ctx;
    const i = o.at || 50, s = S[i], b = beside(S, i, o.side || 0, s.w / 2 + (o.dist || 16));
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.6 - k * 0.22, 2.8 - k * 0.22, 3.4, 10), cel({ color: k % 2 ? '#e8e8e0' : '#c8282a' }));
        ring.position.y = 1.7 + k * 3.4; g.add(ring);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10), cel({ color: '#2a3139' })); top.position.y = 22; g.add(top);
    const lamp = glows(new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 6), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }))); lamp.position.y = 22; g.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#4a4430', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.layers.set(GLOW); beam.rotation.z = Math.PI / 2; beam.position.x = 30;
    const pivot = new THREE.Group(); pivot.position.y = 22; pivot.add(beam); g.add(pivot);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.6, 10), cel({ color: '#c8282a' })); cap.position.y = 24; g.add(cap);
    g.position.set(b.x, s.y + Math.max(0, s.h[o.side || 0]) - 0.5, b.z);
    group.add(g);
    anim.push((t) => { pivot.rotation.y = t * 0.9; });
};
// --- airfield ---
PROPS.hangars = (ctx, o) => {
    const { S, group, TX } = ctx, r = rng(211);
    for (let n = 0, tries = 0; n < (o.count || 4) && tries < 200; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i];
        const b = beside(S, i, side, s.w / 2 + 30);
        if (!clear(S, b.x, b.z, 24)) continue;
        const g = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 40, 12, 1, false, 0, Math.PI), cel({ map: TX.hangar, side: THREE.DoubleSide }));
        shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.position.y = 0; g.add(shell);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(22, 10), cel({ color: '#1a1e24', side: THREE.DoubleSide })); door.position.set(0, 5, 20.1); g.add(door);
        const sign = glows(new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.2), new THREE.MeshBasicMaterial({ color: '#ffd27a' }))); sign.position.set(0, 12, 20.2); g.add(sign);
        g.position.set(b.x, s.y - 0.4, b.z); g.rotation.y = yaw(s) + (side ? Math.PI / 2 : -Math.PI / 2);
        group.add(g); n++;
    }
};
// little low-poly planes parked by the road
PROPS.planes = (ctx, o) => {
    const { S, group } = ctx, r = rng(223);
    const cols = ['#e8e8e8', '#c8282a', '#2a5aa8', '#e8c020'];
    for (let n = 0, tries = 0; n < (o.count || 5) && tries < 200; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i];
        const b = beside(S, i, side, s.w / 2 + 12 + r() * 8);
        if (!clear(S, b.x, b.z, 10)) continue;
        const paint = cel({ color: cols[n % cols.length] }), dark = cel({ color: '#2a3139' });
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 9, 8), paint); body.rotation.x = Math.PI / 2; body.position.y = 1.6; g.add(body);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), dark); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.6, 5.1); g.add(nose);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 1.8), paint); wing.position.set(0, 1.8, 0.8); g.add(wing);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1), paint); tail.position.set(0, 1.9, -4); g.add(tail);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.2), paint); fin.position.set(0, 2.7, -4); g.add(fin);
        const prop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.08), dark); prop.position.set(0, 1.6, 5.85); g.add(prop);
        for (const sx of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.7), dark); w.position.set(sx, 0.4, 1.2); g.add(w); }
        g.position.set(b.x, s.y, b.z); g.rotation.y = yaw(s) + r() * 1.5;
        group.add(g); n++;
    }
};
// runway lights: glowing dots along both edges
PROPS.runwayLights = (ctx, o) => {
    const { S, group } = ctx, mats = [], cols = [];
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    for (let i = 0; i < S.length; i += 3) for (let side = 0; side < 2; side++) {
        const s = S[i], b = beside(S, i, side, s.w / 2 + 0.8);
        mats.push(place(b.x, s.y + 0.2, b.z, 0)); cols.push(side ? '#3ad0ff' : '#ffd27a');
    }
    const im = instanced(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), mats, cols);
    glows(im); group.add(im);
};
PROPS.tower = (ctx, o) => {
    const { S, group } = ctx, i = o.at || 40, s = S[i], b = beside(S, i, o.side || 1, s.w / 2 + 24);
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 18, 8), cel({ color: '#c8c8c0' })); shaft.position.y = 9; g.add(shaft);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 4, 8), cel({ color: '#3a4a58', emissive: '#203040' })); cab.position.y = 20; g.add(cab);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.6, 8), cel({ color: '#2a3139' })); roof.position.y = 22.3; g.add(roof);
    const beacon = glows(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: '#ff3a3a', fog: false }))); beacon.position.y = 23.2; g.add(beacon);
    g.position.set(b.x, s.y - 0.3, b.z);
    group.add(g);
};

// --- theme park ---
const stripes = (a, b, n = 8) => { const c = document.createElement('canvas'); c.width = 32; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 32 / n, 0, 32 / n, 8); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
const RAINBOW = ['#ff3a6e', '#ffd23f', '#4aff7a', '#3ad0ff', '#b04aff', '#ff9a3a'];
// a big wheel that turns, its gondolas hanging level, lights round the rim
PROPS.ferris = (ctx, o) => {
    const { S, group, anim } = ctx, i = o.at || 60, s = S[i], b = beside(S, i, o.side || 0, s.w / 2 + (o.dist || 34));
    const R = o.r || 22, g = new THREE.Group(), wheel = new THREE.Group(), steel = cel({ color: '#e8e8e8' });
    for (const sx of [-2, 2]) {
        for (const lean of [-0.35, 0.35]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, R + 6, 0.8), steel); leg.position.set(sx, (R + 4) / 2, Math.sin(lean) * (R + 4) / 2); leg.rotation.x = -lean; g.add(leg); }
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.45, 6, 32), steel); wheel.add(rim);
    const rim2 = rim.clone(); rim2.position.x = 1.6; wheel.add(rim2);
    const bulbs = [], cols = [];
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.25, R, 0.25), steel); sp.position.set(0.8, Math.cos(a) * R / 2, Math.sin(a) * R / 2); sp.rotation.x = a; wheel.add(sp);
    }
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; bulbs.push(place(-0.6, Math.cos(a) * R, Math.sin(a) * R)); cols.push(RAINBOW[k % RAINBOW.length]); }
    wheel.add(glows(instanced(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), bulbs, cols)));
    const pods = [];
    for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, piv = new THREE.Group();
        piv.position.set(0.8, Math.cos(a) * R, Math.sin(a) * R);
        const pod = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), cel({ color: RAINBOW[k % RAINBOW.length] })); pod.position.y = -1.6; piv.add(pod);
        wheel.add(piv); pods.push(piv);
    }
    wheel.position.y = R + 4; wheel.rotation.y = Math.PI / 2; g.add(wheel);
    g.position.set(b.x, s.y - 0.3, b.z); g.rotation.y = yaw(s);
    group.add(g);
    anim.push((t) => { const a = t * 0.12; wheel.rotation.x = a; pods.forEach((p) => { p.rotation.x = -a; }); });
};
// a roller coaster: a loop of track up on stilts with a little train running round it
PROPS.coaster = (ctx, o) => {
    const { S, group, anim } = ctx, i = o.at || 120, s = S[i], c = beside(S, i, o.side || 1, s.w / 2 + (o.dist || 60));
    const R = o.r || 38, pts = [];
    for (let k = 0; k < 14; k++) {
        const a = k / 14 * Math.PI * 2, rr = R * (0.75 + 0.25 * Math.sin(a * 3));
        pts.push(new THREE.Vector3(c.x + Math.cos(a) * rr, s.y + [26, 20, 8, 14, 5, 18, 10, 24, 6, 12, 4, 16, 9, 22][k], c.z + Math.sin(a) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const red = cel({ color: o.color || '#e8282a' }), white = cel({ color: '#e8e8e8' });
    for (const off of [-0.7, 0.7]) {
        const p2 = curve.getSpacedPoints(160).map((p, k, all) => { const n = all[(k + 1) % all.length], tx = n.x - p.x, tz = n.z - p.z, l = Math.hypot(tx, tz) || 1; return new THREE.Vector3(p.x - tz / l * off, p.y, p.z + tx / l * off); });
        group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p2, true), 240, 0.18, 5, true), red));
    }
    const legs = [];
    curve.getSpacedPoints(40).forEach((p) => { const h = p.y - s.y + 0.3; legs.push(place(p.x, s.y - 0.3, p.z, 0, 0.35, h, 0.35)); });
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    group.add(instanced(box, white, legs));
    const cars = [];
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 2.4), cel({ color: RAINBOW[k] })); group.add(m); cars.push(m); }
    let u = 0, last = 0;
    anim.push((t) => {
        const dt = Math.min(0.1, t - last); last = t;
        const p = curve.getPointAt(u), slope = curve.getTangentAt(u).y;
        u = (u + dt * (0.03 - slope * 0.035) + 1) % 1;            // slow up the climbs, fast down the drops
        cars.forEach((m, k) => {
            const uu = (u - k * 0.012 + 1) % 1, pp = curve.getPointAt(uu), tt = curve.getTangentAt(uu);
            m.position.set(pp.x, pp.y + 0.8, pp.z); m.lookAt(pp.x + tt.x, pp.y + 0.8 + tt.y, pp.z + tt.z);
        });
    });
};
// striped circus tents with a flag on top
PROPS.tents = (ctx, o) => {
    const { S, group } = ctx, r = rng(271), cols = [['#e8282a', '#f4f0e8'], ['#2a5aa8', '#ffd23f'], ['#b04aff', '#f4f0e8'], ['#2a8a4a', '#ffd23f']];
    for (let n = 0, tries = 0; n < (o.count || 4) && tries < 200; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], R = 8 + r() * 6;
        const b = beside(S, i, side, s.w / 2 + R + 8 + r() * 10);
        if (!clear(S, b.x, b.z, s.w / 2 + R + 4)) continue;
        const [a, bb] = cols[n % cols.length], tex = stripes(a, bb, 12);
        const g = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 5, 16, 1, true), cel({ map: tex, side: THREE.DoubleSide })); wall.position.y = 2.5; g.add(wall);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(R * 1.08, R * 0.9, 16), cel({ map: tex })); roof.position.y = 5 + R * 0.45; g.add(roof);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide })); flag.position.set(0.8, 5 + R * 0.9 + 1, 0); g.add(flag);
        g.position.set(b.x, s.y - 0.2, b.z);
        group.add(g); n++;
    }
};
// a carousel that turns, horses bobbing, a ring of bulbs under the roof
PROPS.carousel = (ctx, o) => {
    const { S, group, anim } = ctx, i = o.at || 200, s = S[i], b = beside(S, i, o.side || 0, s.w / 2 + (o.dist || 18));
    const g = new THREE.Group(), spin = new THREE.Group(), tex = stripes('#ff3a6e', '#fff4d8', 16);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.4, 0.8, 18), cel({ color: '#c8a040' })); base.position.y = 0.4; g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 3.4, 18), cel({ map: tex })); roof.position.y = 7.2; spin.add(roof);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 8), cel({ color: '#ffd23f' })); pole.position.y = 3.5; spin.add(pole);
    const horses = [], bulbs = [], cols = [];
    for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2, x = Math.cos(a) * 6, z = Math.sin(a) * 6;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 4), cel({ color: '#e8e8e8' })); rod.position.set(x, 3.4, z); spin.add(rod);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 2), cel({ color: k % 2 ? '#f4f0e8' : '#6a4a2a' })); h.position.set(x, 2.4, z); h.rotation.y = -a; spin.add(h); horses.push(h);
    }
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; bulbs.push(place(Math.cos(a) * 8.6, 5.6, Math.sin(a) * 8.6)); cols.push(RAINBOW[k % RAINBOW.length]); }
    spin.add(glows(instanced(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), bulbs, cols)));
    g.add(spin);
    g.position.set(b.x, s.y - 0.2, b.z);
    group.add(g);
    anim.push((t) => { spin.rotation.y = t * 0.5; horses.forEach((h, k) => { h.position.y = 2.4 + Math.sin(t * 3 + k) * 0.5; }); });
};
// strings of coloured bulbs hanging along both sides of the road
PROPS.stringLights = (ctx, o) => {
    const { S, group } = ctx, mats = [], cols = [], posts = [];
    const span = o.span || 12;
    for (let i = 0; i < S.length; i++) for (let side = 0; side < 2; side++) {
        const s = S[i], off = s.w / 2 + (o.inset || 2.6), b = beside(S, i, side, off), k = i % span;
        if (k === 0) posts.push(place(b.x, s.y, b.z, 0, 0.2, 5.4, 0.2));
        if (i % 2) continue;
        mats.push(place(b.x, s.y + 5.2 - Math.sin(k / span * Math.PI) * 1.4, b.z)); cols.push(RAINBOW[(i / 2 + side * 3) % RAINBOW.length]);
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    group.add(instanced(box, cel({ color: '#3a3e44' }), posts));
    group.add(glows(instanced(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), mats, cols)));
};
// fireworks bursting over the park
PROPS.fireworks = (ctx, o) => {
    const { S, group, anim } = ctx, r = rng(333), bursts = [];
    let cx = 0, cz = 0; S.forEach((s) => { cx += s.x; cz += s.z; }); cx /= S.length; cz /= S.length;
    const y0 = S[0].y;
    for (let k = 0; k < (o.count || 5); k++) {
        const n = 48, pos = new Float32Array(n * 3), vel = [];
        for (let j = 0; j < n; j++) { const a = r() * Math.PI * 2, e = Math.acos(2 * r() - 1), sp = 14 + r() * 6; vel.push([Math.sin(e) * Math.cos(a) * sp, Math.cos(e) * sp, Math.sin(e) * Math.sin(a) * sp]); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.PointsMaterial({ color: RAINBOW[k % RAINBOW.length], size: 2.2, sizeAttenuation: true, fog: false, transparent: true });
        const pts = glows(new THREE.Points(g, m)); pts.frustumCulled = false;
        group.add(pts);
        bursts.push({ pts, pos, vel, n, period: 3.2 + r() * 2.4, phase: r() * 5, at: [cx + (r() - 0.5) * 200, y0 + 60 + r() * 40, cz + (r() - 0.5) * 200] });
    }
    anim.push((t) => bursts.forEach((b) => {
        const u = ((t + b.phase) % b.period), life = 1.6;
        b.pts.visible = u < life;
        if (u >= life) return;
        for (let j = 0; j < b.n; j++) {
            const [vx, vy, vz] = b.vel[j];
            b.pos[j * 3] = b.at[0] + vx * u; b.pos[j * 3 + 1] = b.at[1] + vy * u - 6 * u * u; b.pos[j * 3 + 2] = b.at[2] + vz * u;
        }
        b.pts.material.opacity = 1 - u / life;
        b.pts.geometry.attributes.position.needsUpdate = true;
    }));
};
// --- the moon ---
PROPS.craters = (ctx, o) => {
    const { S, group, TX } = ctx, r = rng(401), rims = [], floors = [];
    for (let n = 0, tries = 0; n < (o.count || 26) && tries < 400; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], R = 4 + r() * 14;
        const b = beside(S, i, side, s.w / 2 + R + 6 + r() * 60);
        if (!clear(S, b.x, b.z, s.w / 2 + R + 2)) continue;
        rims.push(place(b.x, s.y + s.h[side] * 0.3 - 0.4, b.z, r() * 6, R, R * 0.12, R));
        floors.push(place(b.x, s.y + s.h[side] * 0.3 - 0.3, b.z, 0, R * 0.8, 1, R * 0.8));
        n++;
    }
    const torus = new THREE.TorusGeometry(1, 0.28, 5, 14); torus.rotateX(Math.PI / 2);
    group.add(instanced(torus, cel({ map: TX.moon }), rims));
    const disc = new THREE.CircleGeometry(1, 14); disc.rotateX(-Math.PI / 2);
    group.add(instanced(disc, cel({ color: '#5a5a58' }), floors));
};
PROPS.domes = (ctx, o) => {
    const { S, group, anim } = ctx, r = rng(409), blink = [];
    for (let n = 0, tries = 0; n < (o.count || 5) && tries < 200; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], R = 6 + r() * 6;
        const b = beside(S, i, side, s.w / 2 + R + 10 + r() * 20);
        if (!clear(S, b.x, b.z, s.w / 2 + R + 6)) continue;
        const g = new THREE.Group();
        const d = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cel({ color: '#e8eaee' })); g.add(d);
        const band = glows(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#3ad0ff', side: THREE.DoubleSide }))); band.position.y = R * 0.3; g.add(band);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 4), cel({ color: '#c8c8c8' })); ant.position.y = R + 2.5; g.add(ant);
        const l = glows(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false }))); l.position.y = R + 5.2; g.add(l); blink.push(l);
        g.position.set(b.x, s.y + s.h[side] * 0.4 - 0.5, b.z);
        group.add(g); n++;
    }
    // a rocket on its pad
    const i = o.rocketAt || 90, s = S[i], b = beside(S, i, 1, s.w / 2 + 30), g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 22, 12), cel({ color: '#f4f4f0' })); body.position.y = 13; g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 12), cel({ color: '#e8282a' })); nose.position.y = 27; g.add(nose);
    for (let k = 0; k < 4; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 3.4), cel({ color: '#e8282a' })); fin.position.set(Math.cos(k * Math.PI / 2) * 2.4, 4, Math.sin(k * Math.PI / 2) * 2.4); fin.rotation.y = -k * Math.PI / 2; g.add(fin); }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 30, 1.4), cel({ color: '#c8902a' })); tower.position.set(5, 15, 0); g.add(tower);
    g.position.set(b.x, s.y - 0.5, b.z); group.add(g);
    anim.push((t) => blink.forEach((l, k) => { l.visible = Math.floor(t * 1.3 + k * 0.4) % 2 === 0; }));
};
// --- the mine ---
PROPS.crystals = (ctx, o) => {
    const { S, group } = ctx, r = rng(419), mats = [], cols = [], C = ['#3ad0ff', '#b04aff', '#4aff7a', '#ff4fa8'];
    for (let i = 3; i < S.length; i += 4) for (let side = 0; side < 2; side++) {
        if (r() > (o.density || 0.45)) continue;
        const s = S[i], b = beside(S, i, side, s.w / 2 + 1.6 - r() * 0.3), sc = 0.4 + r() * 0.9;
        mats.push(place(b.x, s.y + 0.4 + r() * 2.6, b.z, r() * 6, sc, sc * (1.6 + r()), sc));
        cols.push(C[(r() * C.length) | 0]);
    }
    group.add(glows(instanced(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), mats, cols)));
};
// pit props: timber frames along the tunnel every few metres
PROPS.timbers = (ctx, o) => {
    const { S, group } = ctx, mats = [];
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    for (let i = 0; i < S.length; i += o.every || 7) {
        const s = S[i], R = s.w / 2 + 1.5, ry = yaw(s);
        for (const sg of [-1, 1]) mats.push(place(s.x + s.sx * R * sg, s.y - 0.2, s.z + s.sz * R * sg, ry, 0.5, 4.6, 0.5));
        mats.push(place(s.x, s.y + 4.3, s.z, ry, s.w + 3.4, 0.5, 0.5));
    }
    group.add(instanced(box, cel({ color: '#6a4a2a' }), mats));
};

// --- asian cities ---
// tall vertical neon signs, lettered top to bottom
const CJK = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif';
const vsignTex = (text, a, b) => {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24 * text.length + 8;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0c10'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = a; x.lineWidth = 2; x.strokeRect(1, 1, c.width - 2, c.height - 2);
    x.fillStyle = b; x.font = `bold 18px ${CJK}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    [...text].forEach((ch, i) => x.fillText(ch, 12, 16 + i * 24));
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
};
const SIGNS = ['拉麺', '酒場', '夜市', '電気', '薬局', '茶館', '旅館', '餃子', '麻雀', '劇場', '書店', '寿司'];
const SIGNCOL = [['#ff3a6e', '#ffd23f'], ['#3ad0ff', '#ffffff'], ['#ffd23f', '#ff3a6e'], ['#4aff7a', '#ffffff'], ['#b04aff', '#3ad0ff']];
PROPS.vneons = (ctx, o) => {
    const { S, group } = ctx, r = rng(503);
    for (let i = 10, k = 0; i < S.length - 5; i += o.every || 14, k++) {
        const side = k % 2, s = S[i], text = SIGNS[k % SIGNS.length], [a, b] = SIGNCOL[k % SIGNCOL.length];
        const bb = beside(S, i, side, s.w / 2 + (o.dist || 4) + r() * 3);
        const h = text.length * 2.4 + 1;
        const sign = glows(new THREE.Mesh(new THREE.PlaneGeometry(2.4, h), new THREE.MeshBasicMaterial({ map: vsignTex(text, a, b), side: THREE.DoubleSide })));
        sign.position.set(bb.x, s.y + (o.y || 4) + h / 2 + r() * 3, bb.z);
        sign.rotation.y = yaw(s) + Math.PI / 2;
        group.add(sign);
    }
};
// clutter on the rooftops either side of the road: water tanks, air conditioners, aerials
PROPS.rooftop = (ctx, o) => {
    const { S, group, def } = ctx, r = rng(509), tanks = [], acs = [], masts = [];
    const P = def.pillar || { every: 7, len: 13, across: 20 };
    for (let i = 0; i < S.length; i++) {
        const k = i % P.every; if (k < 1 || k > P.every - 2) continue;
        for (let side = 0; side < 2; side++) {
            if (r() > 0.45) continue;
            const s = S[i], off = s.w / 2 + 3 + r() * (P.across / 2 - 4), b = beside(S, i, side, off), y = s.y - 1.4;
            const pick = r();
            if (pick < 0.3) tanks.push(place(b.x, y, b.z, 0, 1.6, 3.2, 1.6));
            else if (pick < 0.8) acs.push(place(b.x, y, b.z, yaw(s), 1.6, 1.1, 1.2));
            else masts.push(place(b.x, y, b.z, 0, 0.12, 4 + r() * 5, 0.12));
        }
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); cyl.translate(0, 0.5, 0);
    group.add(instanced(cyl, cel({ color: '#8a7a6a' }), tanks));
    group.add(instanced(box, cel({ color: '#c8ccd0' }), acs));
    group.add(instanced(box, cel({ color: '#3a3e44' }), masts));
};
// night market stalls with striped awnings and a string of bulbs each
PROPS.stalls = (ctx, o) => {
    const { S, group } = ctx, r = rng(521), boxes = [], awn = [], acol = [], bulbs = [];
    const AW = ['#e8282a', '#ffd23f', '#2a8a4a', '#2a5aa8', '#ff9a3a', '#f4f0e8'];
    for (let i = 4; i < S.length; i += 3) for (let side = 0; side < 2; side++) {
        if (r() > (o.density || 0.55)) continue;
        const s = S[i], b = beside(S, i, side, s.w / 2 + 2.6);
        if (!clear(S, b.x, b.z, s.w / 2 + 1.8)) continue;
        boxes.push(place(b.x, s.y, b.z, yaw(s), 2.4, 1.1, 2.6));
        const a = beside(S, i, side, s.w / 2 + 2.2);
        awn.push(place(a.x, s.y + 2.5, a.z, yaw(s), 3.2, 0.15, 2.8)); acol.push(AW[(r() * AW.length) | 0]);
        bulbs.push(place(a.x, s.y + 2.3, a.z, yaw(s), 0.25, 0.25, 0.25));
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    group.add(instanced(box, cel({ color: '#6a4a2a' }), boxes));
    group.add(instanced(box, cel({ color: '#ffffff' }), awn, acol));
    group.add(glows(instanced(box, new THREE.MeshBasicMaterial({ color: '#ffe0a0', fog: false }), bulbs)));
};
// red paper lanterns strung across the street
PROPS.lanterns = (ctx, o) => {
    const { S, group } = ctx, lamps = [], wires = [];
    for (let i = 6; i < S.length; i += o.every || 6) {
        const s = S[i], n = 5;
        for (let k = 0; k < n; k++) {
            const f = (k + 0.5) / n, off = (f - 0.5) * (s.w + 4), sag = Math.sin(f * Math.PI) * 0.8;
            lamps.push(place(s.x + s.sx * off, s.y + 5.6 - sag, s.z + s.sz * off, 0, 0.9, 1.2, 0.9));
        }
        wires.push(place(s.x, s.y + 6.1, s.z, yaw(s), s.w + 5, 0.05, 0.05));
    }
    const sph = new THREE.SphereGeometry(0.5, 8, 6);
    group.add(glows(instanced(sph, new THREE.MeshBasicMaterial({ color: o.color || '#ff4a2a', fog: false }), lamps)));
    group.add(instanced(new THREE.BoxGeometry(1, 1, 1), cel({ color: '#1a1a1a' }), wires));
};
// torii gates: dense stretches make a tunnel of them, the rest stand alone
PROPS.torii = (ctx, o) => {
    const { S, group } = ctx, N = S.length, posts = [], beams = [], tops = [];
    const dense = (i) => (o.ranges || []).some(([a, b]) => i / N >= a && i / N <= b);
    for (let i = 0; i < N; i++) {
        if (!(dense(i) ? i % (o.every || 3) === 0 : i % (o.sparse || 40) === 0)) continue;
        const s = S[i], hw = s.w / 2 + 1.2, ry = yaw(s);
        for (const sg of [-1, 1]) posts.push(place(s.x + s.sx * hw * sg, s.y, s.z + s.sz * hw * sg, ry, 0.7, 6.4, 0.7));
        beams.push(place(s.x, s.y + 5.2, s.z, ry, hw * 2 + 1, 0.5, 0.5));
        tops.push(place(s.x, s.y + 6.3, s.z, ry, hw * 2 + 3, 0.55, 0.9));
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); cyl.translate(0, 0.5, 0);
    const red = cel({ color: '#e83a1a' });
    group.add(instanced(cyl, red, posts));
    group.add(instanced(box, red, beams));
    group.add(instanced(box, cel({ color: '#1a1a1a' }), tops));
};
// pagodas: stacked storeys with flared roofs
PROPS.pagodas = (ctx, o) => {
    const { S, group } = ctx;
    for (const [f, side] of o.at || [[0.45, 1]]) {
        const i = Math.round(f * S.length) % S.length, s = S[i], b = beside(S, i, side, s.w / 2 + (o.dist || 26));
        const g = new THREE.Group(), wall = cel({ color: '#e8dcc8' }), roofM = cel({ color: '#2a2e34' }), red = cel({ color: '#c83a1a' });
        let y = 0;
        for (let k = 0; k < 5; k++) {
            const w = 9 - k * 1.3, h = 3.4;
            const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), k % 2 ? wall : red); body.position.y = y + h / 2; g.add(body);
            const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 1.6, 4), roofM); roof.rotation.y = Math.PI / 4; roof.position.y = y + h + 0.6; g.add(roof);
            y += h + 1.1;
        }
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 6, 6), cel({ color: '#c8a040' })); spire.position.y = y + 3; g.add(spire);
        g.position.set(b.x, s.y - 0.3, b.z); g.rotation.y = yaw(s);
        group.add(g);
    }
};
// stone lanterns along the shrine road, glowing softly
PROPS.stoneLanterns = (ctx, o) => {
    const { S, group } = ctx, bases = [], lights = [];
    for (let i = 5, k = 0; i < S.length; i += o.every || 16, k++) {
        const s = S[i], b = beside(S, i, k % 2, s.w / 2 + 2.4);
        bases.push(place(b.x, s.y, b.z, yaw(s), 0.8, 1.8, 0.8));
        lights.push(place(b.x, s.y + 1.8, b.z, yaw(s), 0.9, 0.7, 0.9));
    }
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    group.add(instanced(box, cel({ color: '#8a8a82' }), bases));
    group.add(glows(instanced(box, new THREE.MeshBasicMaterial({ color: '#ffc870', fog: false }), lights)));
};
// --- the sky road ---
PROPS.blimps = (ctx, o) => {
    const { S, group, anim } = ctx, r = rng(541), list = [];
    for (let k = 0; k < (o.count || 3); k++) {
        const i = (r() * S.length) | 0, s = S[i], b = beside(S, i, k % 2, 60 + r() * 80);
        const g = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cel({ color: '#d8dce0' })); hull.scale.set(7, 7, 22); g.add(hull);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 4), cel({ color: '#e8282a' })); fin.position.set(0, 4, -18); g.add(fin);
        const ad = glows(new THREE.Mesh(new THREE.PlaneGeometry(18, 4.4), new THREE.MeshBasicMaterial({ map: neonTex(['GRAVEL RIOT', 'SKYWAY', 'HOLD ON'][k % 3], '#3ad0ff', '#ffd23f'), side: THREE.DoubleSide })));
        ad.position.set(7.05, 0, 0); ad.rotation.y = Math.PI / 2; g.add(ad);
        g.position.set(b.x, s.y + 30 + r() * 30, b.z); g.rotation.y = r() * 6;
        group.add(g); list.push(g);
    }
    anim.push((t) => list.forEach((g, k) => { g.rotation.y += 0.0006; g.position.y += Math.sin(t * 0.4 + k) * 0.01; }));
};
// --- the desert city ---
PROPS.spire = (ctx, o) => {
    const { S, group, anim } = ctx, i = Math.round((o.at || 0.5) * S.length) % S.length, s = S[i], b = beside(S, i, o.side || 1, s.w / 2 + (o.dist || 90));
    const g = new THREE.Group(), glass = cel({ color: '#8ab4d0' });
    let y = 0;
    for (let k = 0; k < 8; k++) { const w = 26 - k * 3, h = 38 - k * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), glass); m.position.y = y + h / 2; m.rotation.y = k * 0.12; g.add(m); y += h; }
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2, 60, 6), cel({ color: '#c8ccd0' })); needle.position.y = y + 30; g.add(needle);
    const tip = glows(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: '#ff2a2a', fog: false }))); tip.position.y = y + 61; g.add(tip);
    g.position.set(b.x, s.y - 1, b.z); group.add(g);
    anim.push((t) => { tip.visible = Math.floor(t * 1.2) % 2 === 0; });
};
// --- the giant bedroom ---
const letterTex = (ch, bg) => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 32, 32); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(2, 2, 28, 28);
    x.fillStyle = '#ffffff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 16, 18);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
};
PROPS.blocks = (ctx, o) => {
    const { S, group } = ctx, r = rng(557), cols = ['#e8282a', '#2a5aa8', '#ffd23f', '#2a8a4a', '#ff7a1a', '#b04aff'];
    for (let n = 0, tries = 0; n < (o.count || 16) && tries < 400; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], sz = 7 + r() * 6;
        const b = beside(S, i, side, s.w / 2 + sz + 4 + r() * 30);
        if (!clear(S, b.x, b.z, s.w / 2 + sz * 0.8 + 2)) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), cel({ map: letterTex('ABCXYZ123'[n % 9], cols[n % cols.length]) }));
        m.position.set(b.x, s.y - 0.3 + sz / 2 + (r() < 0.25 ? sz : 0), b.z); m.rotation.y = r() * 6;
        group.add(m); n++;
    }
};
PROPS.pencils = (ctx, o) => {
    const { S, group } = ctx, r = rng(563), cols = ['#ffd23f', '#e8282a', '#2a5aa8', '#2a8a4a'];
    for (let n = 0, tries = 0; n < (o.count || 6) && tries < 300; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], b = beside(S, i, side, s.w / 2 + 14 + r() * 30);
        if (!clear(S, b.x, b.z, s.w / 2 + 12)) continue;
        const g = new THREE.Group(), L = 34;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, L, 6), cel({ color: cols[n % cols.length] })); shaft.rotation.z = Math.PI / 2; g.add(shaft);
        const wood = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 6), cel({ color: '#e8c890' })); wood.rotation.z = -Math.PI / 2; wood.position.x = L / 2 + 2.5; g.add(wood);
        const lead = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), cel({ color: '#2a2a2a' })); lead.rotation.z = -Math.PI / 2; lead.position.x = L / 2 + 5.2; g.add(lead);
        const rub = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 6), cel({ color: '#ff9ac8' })); rub.rotation.z = Math.PI / 2; rub.position.x = -L / 2 - 1.5; g.add(rub);
        g.position.set(b.x, s.y + 1.3, b.z); g.rotation.y = r() * 6;
        group.add(g); n++;
    }
};
PROPS.books = (ctx, o) => {
    const { S, group } = ctx, r = rng(569), cols = ['#7a1a1a', '#1a3a6a', '#2a5a2a', '#c8a040', '#4a2a5a'];
    for (let n = 0, tries = 0; n < (o.count || 5) && tries < 300; tries++) {
        const i = (r() * S.length) | 0, side = r() < 0.5 ? 0 : 1, s = S[i], b = beside(S, i, side, s.w / 2 + 22 + r() * 30);
        if (!clear(S, b.x, b.z, s.w / 2 + 18)) continue;
        let y = s.y - 0.3;
        for (let k = 0; k < 2 + ((r() * 3) | 0); k++) {
            const w = 22 + r() * 6, d = 30 + r() * 6, h = 4 + r() * 2;
            const bk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cel({ color: cols[(n + k) % cols.length] })); bk.position.set(b.x, y + h / 2, b.z); bk.rotation.y = r() * 0.5; group.add(bk);
            const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 1, h - 1, d + 0.2), cel({ color: '#f4eedc' })); pages.position.copy(bk.position); pages.position.x += 0.6; pages.rotation.y = bk.rotation.y; group.add(pages);
            y += h;
        }
        n++;
    }
};
PROPS.lamp = (ctx, o) => {
    const { S, group } = ctx, i = Math.round((o.at || 0.3) * S.length) % S.length, s = S[i], b = beside(S, i, o.side || 1, s.w / 2 + 30);
    const g = new THREE.Group(), m = cel({ color: '#2a5aa8' });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 2.4, 14), m); base.position.y = 1.2; g.add(base);
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 34, 8), m); arm1.position.set(0, 17, 0); arm1.rotation.z = 0.35; g.add(arm1);
    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 26, 8), m); arm2.position.set(-12, 36, 0); arm2.rotation.z = -1.0; g.add(arm2);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(8, 10, 14, 1, true), cel({ color: '#2a5aa8', side: THREE.DoubleSide })); shade.position.set(-24, 40, 0); shade.rotation.z = 0.5; g.add(shade);
    const bulb = glows(new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }))); bulb.position.set(-25, 37, 0); g.add(bulb);
    g.position.set(b.x, s.y - 0.3, b.z); g.rotation.y = yaw(s) + (o.side ? -1 : 1) * Math.PI / 2;
    group.add(g);
};
PROPS.bigDuck = (ctx, o) => {
    const { S, group, anim } = ctx, i = Math.round((o.at || 0.7) * S.length) % S.length, s = S[i], b = beside(S, i, o.side || 0, s.w / 2 + 34);
    const g = new THREE.Group(), y = cel({ color: '#ffd23f' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), y); body.scale.set(1, 0.8, 1.3); body.position.y = 9; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 12), y); head.position.set(0, 21, 8); g.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 6), cel({ color: '#ff7a1a' })); beak.position.set(0, 20, 15.5); g.add(beak);
    for (const sx of [-3, 3]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), cel({ color: '#111111' })); eye.position.set(sx, 23.5, 13.6); g.add(eye); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(4, 8, 8), y); tail.rotation.x = -1.1; tail.position.set(0, 14, -15); g.add(tail);
    g.position.set(b.x, s.y - 0.5, b.z); g.rotation.y = yaw(s) + (o.side ? -0.6 : 0.6);
    group.add(g);
    anim.push((t) => { g.rotation.z = Math.sin(t * 0.8) * 0.04; });
};

export function buildProps(ctx) {
    for (const [name, opts] of Object.entries(ctx.def.props || {})) if (PROPS[name]) PROPS[name](ctx, opts === true ? {} : opts);
}

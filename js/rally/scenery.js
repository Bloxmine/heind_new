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
        mats.push(place(b.x, s.y - 1, b.z, yaw(s) + (r() - 0.5) * 0.2, w, h, w * (0.7 + r() * 0.5)));
        if (h > 60) tops.push([b.x, s.y + h, b.z]);
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

export function buildProps(ctx) {
    for (const [name, opts] of Object.entries(ctx.def.props || {})) if (PROPS[name]) PROPS[name](ctx, opts === true ? {} : opts);
}

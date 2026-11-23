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
    barriers(ctx) {
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
        group.add(instanced(geo, cel({ map: TX.barrier }), mats));
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
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 11, 0.3), pole); p.position.set(b.x, s.y + 5.5, b.z); group.add(p);
            const toward = beside(S, i, side, off - 2.4);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.6), pole); arm.position.set((b.x + toward.x) / 2, s.y + 11, (b.z + toward.z) / 2);
            arm.rotation.y = Math.atan2(toward.x - b.x, toward.z - b.z); group.add(arm);
            const h = glows(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.6), head)); h.position.set(toward.x, s.y + 10.8, toward.z); h.rotation.y = arm.rotation.y; group.add(h);
            const at = beside(S, i, side, s.w * 0.2);
            const pm = new THREE.Mesh(poolGeo, pool); pm.position.set(at.x, s.y + 0.07, at.z); pm.renderOrder = 2; group.add(pm);
        }
    },
    // a glowing neon roadside sign
    neon(ctx, o) {
        const { S, group } = ctx;
        const i = o.at || 40, side = o.side || 0;
        const b = beside(S, i, side, S[i].w / 2 + 9);
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

export function buildProps(ctx) {
    for (const [name, opts] of Object.entries(ctx.def.props || {})) if (PROPS[name]) PROPS[name](ctx, opts === true ? {} : opts);
}

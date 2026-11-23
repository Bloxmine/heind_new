/* Cars: low-poly models extruded from a side profile, and an arcade rally handling model. Forward is +z. */
import * as THREE from 'three';
import { cel, glows, GLOW } from './retro.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Side profiles as [z, y] (front is +z). Fictional cars, no real brands.
// tail: height of the rear lamps; spoiler: [z, y] or null.
const BODIES = {
    hatch: {
        len: 4.2, width: 1.8, wheelR: 0.36, wb: [1.32, -1.3], tail: 0.82, head: 0.68, spoiler: [-1.86, 1.52],
        body: [[2.08, 0.3], [2.15, 0.55], [2.04, 0.8], [1.25, 0.98], [0.75, 1.02], [-1.85, 1.06], [-2.08, 0.98], [-2.12, 0.55], [-2.04, 0.3]],
        cabin: [[0.78, 1.0], [0.08, 1.48], [-1.32, 1.5], [-1.96, 1.04]],
        roof: [0.08, -1.32, 1.5]
    },
    saloon: {
        len: 4.7, width: 1.85, wheelR: 0.36, wb: [1.45, -1.45], tail: 0.8, head: 0.66, spoiler: [-2.15, 1.12],
        body: [[2.3, 0.3], [2.38, 0.56], [2.25, 0.8], [1.3, 0.95], [0.85, 0.98], [-1.2, 1.0], [-2.05, 0.98], [-2.35, 0.92], [-2.38, 0.55], [-2.3, 0.3]],
        cabin: [[0.85, 0.97], [0.15, 1.42], [-0.95, 1.44], [-1.6, 1.0]],
        roof: [0.15, -0.95, 1.44]
    },
    coupe: {
        len: 4.4, width: 1.86, wheelR: 0.35, wb: [1.35, -1.35], tail: 0.72, head: 0.58, spoiler: [-2.0, 1.1],
        body: [[2.2, 0.28], [2.26, 0.5], [2.1, 0.72], [1.0, 0.88], [0.6, 0.9], [-1.6, 0.95], [-2.15, 0.88], [-2.2, 0.5], [-2.12, 0.28]],
        cabin: [[0.6, 0.89], [-0.15, 1.3], [-0.9, 1.32], [-1.75, 0.93]],
        roof: [-0.15, -0.9, 1.32]
    },
    muscle: {
        len: 5.0, width: 1.96, wheelR: 0.38, wb: [1.6, -1.55], tail: 0.84, head: 0.7, spoiler: [-2.35, 1.18],
        body: [[2.5, 0.3], [2.55, 0.62], [2.45, 0.9], [1.0, 1.0], [0.55, 1.02], [-1.7, 1.02], [-2.5, 0.98], [-2.55, 0.6], [-2.48, 0.3]],
        cabin: [[0.55, 1.0], [-0.15, 1.4], [-1.05, 1.42], [-1.75, 1.02]],
        roof: [-0.15, -1.05, 1.42]
    },
    estate: {
        len: 4.75, width: 1.85, wheelR: 0.37, wb: [1.45, -1.5], tail: 0.86, head: 0.66, spoiler: null,
        body: [[2.32, 0.3], [2.4, 0.56], [2.26, 0.8], [1.3, 0.95], [0.85, 0.98], [-2.2, 1.02], [-2.38, 0.95], [-2.4, 0.55], [-2.32, 0.3]],
        cabin: [[0.85, 0.97], [0.15, 1.46], [-2.1, 1.46], [-2.3, 1.0]],
        roof: [0.15, -2.1, 1.46]
    },
    pickup: {
        len: 5.1, width: 1.96, wheelR: 0.43, wb: [1.6, -1.6], tail: 0.95, head: 0.82, spoiler: null,
        body: [[2.5, 0.45], [2.56, 0.8], [2.42, 1.12], [1.25, 1.22], [0.75, 1.24], [-2.5, 1.2], [-2.55, 0.5], [-2.45, 0.45]],
        cabin: [[0.75, 1.22], [0.25, 1.76], [-0.65, 1.78], [-0.75, 1.22]],
        roof: [0.25, -0.65, 1.78]
    },
    kei: {
        len: 3.4, width: 1.48, wheelR: 0.3, wb: [1.1, -1.1], tail: 0.86, head: 0.7, spoiler: null,
        body: [[1.7, 0.3], [1.74, 0.6], [1.6, 0.86], [1.1, 0.95], [0.95, 0.98], [-1.6, 1.0], [-1.72, 0.9], [-1.74, 0.5], [-1.66, 0.3]],
        cabin: [[0.95, 0.97], [0.55, 1.55], [-1.55, 1.58], [-1.68, 1.0]],
        roof: [0.55, -1.55, 1.58]
    },
    supercar: {
        len: 4.5, width: 1.96, wheelR: 0.36, wb: [1.4, -1.4], tail: 0.66, head: 0.52, spoiler: [-2.05, 1.12],
        body: [[2.25, 0.25], [2.3, 0.42], [2.0, 0.6], [0.7, 0.82], [0.35, 0.86], [-1.9, 0.9], [-2.25, 0.82], [-2.28, 0.45], [-2.2, 0.25]],
        cabin: [[0.35, 0.85], [-0.4, 1.16], [-1.0, 1.16], [-1.95, 0.88]],
        roof: [-0.4, -1.0, 1.16]
    }
};

// the unlockable oddballs
Object.assign(BODIES, {
    van: {
        len: 4.8, width: 2.0, wheelR: 0.38, wb: [1.6, -1.5], tail: 1.0, head: 0.75, spoiler: null, noStripe: true,
        body: [[2.4, 0.4], [2.45, 0.9], [2.25, 1.25], [1.5, 1.35], [1.35, 2.3], [-2.35, 2.32], [-2.42, 2.2], [-2.45, 0.4]],
        cabin: [[1.5, 1.33], [1.36, 1.95], [0.95, 1.95], [0.9, 1.33]],
        roof: [1.36, 0.95, 1.95]
    },
    hearse: {
        len: 5.4, width: 1.9, wheelR: 0.38, wb: [1.7, -1.75], tail: 0.86, head: 0.66, spoiler: null,
        body: [[2.65, 0.3], [2.72, 0.56], [2.58, 0.8], [1.5, 0.95], [1.0, 0.98], [-2.55, 1.02], [-2.7, 0.95], [-2.72, 0.55], [-2.65, 0.3]],
        cabin: [[1.0, 0.97], [0.3, 1.5], [-2.45, 1.5], [-2.62, 1.0]],
        roof: [0.3, -2.45, 1.5]
    },
    monster: {
        len: 5.1, width: 2.2, wheelR: 0.85, wheelW: 0.6, wb: [1.65, -1.65], tail: 0.95, head: 0.82, spoiler: null, lift: 0.75,
        body: [[2.5, 0.45], [2.56, 0.8], [2.42, 1.12], [1.25, 1.22], [0.75, 1.24], [-2.5, 1.2], [-2.55, 0.5], [-2.45, 0.45]],
        cabin: [[0.75, 1.22], [0.25, 1.76], [-0.65, 1.78], [-0.75, 1.22]],
        roof: [0.25, -0.65, 1.78]
    },
    couch: {
        len: 2.6, width: 1.9, wheelR: 0.22, wb: [0.9, -0.9], tail: 0.6, head: 0.6, spoiler: null, noStripe: true,
        body: [[1.3, 0.3], [1.3, 0.85], [-0.45, 0.85], [-0.55, 1.6], [-1.3, 1.6], [-1.3, 0.3]],
        cabin: [[1.3, 0.85], [1.28, 0.9], [1.22, 0.9], [1.2, 0.85]],
        roof: [-0.55, -1.3, 1.6]
    },
    duck: {
        len: 3.6, width: 1.7, wheelR: 0.3, wb: [1.15, -1.15], tail: 0.8, head: 0.7, spoiler: null, noStripe: true,
        body: [[1.6, 0.35], [1.75, 0.7], [1.4, 1.1], [0.4, 1.25], [-1.0, 1.25], [-1.6, 1.55], [-1.85, 1.15], [-1.6, 0.35]],
        cabin: [[0.6, 1.24], [0.5, 1.3], [0.3, 1.3], [0.2, 1.24]],
        roof: [0.5, 0.3, 1.3]
    },
    ufo: {
        len: 3.6, width: 3.6, wheelR: 0.3, wb: [1.1, -1.1], tail: 0.55, head: 0.55, spoiler: null, noStripe: true, saucer: true, hideWheels: true, lift: 0.45,
        body: [[1.8, 0.4], [1.8, 0.6], [0.6, 0.9], [-0.6, 0.9], [-1.8, 0.6], [-1.8, 0.4]],
        cabin: [[0.6, 0.9], [0.3, 1.5], [-0.3, 1.5], [-0.6, 0.9]],
        roof: [0.3, -0.3, 1.5]
    }
});

/* Eight fictional cars. Stats are what the handling uses; the 1-5 ratings are for the garage screen.
   hp scales how much damage the car can take. */
export const CARS = [
    { id: 'volta', name: 'VOLTA HS', type: 'hatch', cls: 'C', style: 'BALANCED', body: '#c4c9d0', stripe: '#262c34', maxSpeed: 52, accel: 15, grip: 1.0, hp: 100, rate: { acc: 3, spd: 3, grip: 3, diff: 2 } },
    { id: 'kestrel', name: 'KESTREL GT', type: 'coupe', cls: 'B', style: 'AGILE', body: '#e8c020', stripe: '#1a1a1a', maxSpeed: 55, accel: 15.5, grip: 1.04, hp: 90, rate: { acc: 4, spd: 4, grip: 4, diff: 3 } },
    { id: 'brutus', name: 'BRUTUS 440', type: 'muscle', cls: 'B', style: 'POWER', body: '#7a1a1a', stripe: '#e8e8e8', maxSpeed: 58, accel: 16, grip: 0.86, hp: 115, rate: { acc: 4, spd: 5, grip: 2, diff: 4 } },
    { id: 'senta', name: 'SENTA TOURER', type: 'estate', cls: 'D', style: 'TOUGH', body: '#3a6a4a', stripe: '#d8d8d0', maxSpeed: 48, accel: 13.5, grip: 0.98, hp: 125, rate: { acc: 2, spd: 2, grip: 3, diff: 1 } },
    { id: 'orca', name: 'ORCA 6', type: 'saloon', cls: 'C', style: 'STEADY', body: '#1c1f24', stripe: '#c8102e', maxSpeed: 53, accel: 14.5, grip: 1.0, hp: 105, rate: { acc: 3, spd: 3, grip: 3, diff: 2 } },
    { id: 'mule', name: 'MULE 4X4', type: 'pickup', cls: 'D', style: 'OFF-ROAD', body: '#c86a2a', stripe: '#2a2a2a', maxSpeed: 47, accel: 13, grip: 0.94, hp: 135, offroad: true, rate: { acc: 2, spd: 2, grip: 3, diff: 2 } },
    { id: 'pixie', name: 'PIXIE K', type: 'kei', cls: 'D', style: 'GRIPPY', body: '#e8e8e0', stripe: '#3ad0ff', maxSpeed: 45, accel: 14, grip: 1.14, hp: 80, rate: { acc: 3, spd: 1, grip: 5, diff: 1 } },
    { id: 'nova', name: 'NOVA RS', type: 'supercar', cls: 'A', style: 'FAST', body: '#2a5aa8', stripe: '#e8e8e8', maxSpeed: 62, accel: 17, grip: 1.05, hp: 85, rate: { acc: 5, spd: 5, grip: 4, diff: 5 } },
    // unlocked with fans
    { id: 'softserve', name: 'SOFTSERVE', type: 'van', cls: 'X', style: 'ICE CREAM VAN', body: '#f4e8f0', stripe: '#ff9ac8', maxSpeed: 46, accel: 12.5, grip: 0.92, hp: 150, unlock: 800, rate: { acc: 2, spd: 2, grip: 2, diff: 3 } },
    { id: 'lastride', name: 'LAST RIDE', type: 'hearse', cls: 'X', style: 'HEARSE', body: '#121216', stripe: '#c8c8d0', maxSpeed: 56, accel: 14.5, grip: 0.95, hp: 120, unlock: 1600, glass: '#2a1430', rate: { acc: 3, spd: 4, grip: 3, diff: 3 } },
    { id: 'groundhog', name: 'GROUNDHOG', type: 'monster', cls: 'X', style: 'MONSTER TRUCK', body: '#2a8a3a', stripe: '#ffe23a', maxSpeed: 50, accel: 15, grip: 0.9, hp: 170, offroad: true, unlock: 2500, rate: { acc: 4, spd: 2, grip: 2, diff: 4 } },
    { id: 'couch', name: 'COUCH GTI', type: 'couch', cls: 'X', style: 'A SOFA', body: '#8a3a2a', stripe: '#d8b890', maxSpeed: 47, accel: 16, grip: 1.12, hp: 70, unlock: 3500, rate: { acc: 4, spd: 2, grip: 5, diff: 2 } },
    { id: 'quack', name: 'QUACKMOBILE', type: 'duck', cls: 'X', style: 'RUBBER DUCK', body: '#ffd23f', stripe: '#ff9a1f', maxSpeed: 57, accel: 15, grip: 0.84, hp: 95, unlock: 5000, rate: { acc: 3, spd: 4, grip: 2, diff: 4 } },
    { id: 'orbital', name: 'ORBITAL', type: 'ufo', cls: 'X', style: 'FLYING SAUCER', body: '#9ca5ad', stripe: '#4aff7a', maxSpeed: 64, accel: 17, grip: 0.8, hp: 75, unlock: 7000, rate: { acc: 5, spd: 5, grip: 1, diff: 5 } }
];

const mat = (o) => cel(o);

// decorations for the oddballs
const EXTRAS = {
    van(body, cabin, M, B) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), cel({ color: '#d9a060' })); cone.rotation.x = Math.PI; cone.position.set(0, 2.9, -0.6); body.add(cone);
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), cel({ color: '#ff9ac8' })); s1.position.set(0, 3.55, -0.6); body.add(s1);
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), cel({ color: '#fff4e0' })); s2.position.set(0, 4.0, -0.6); body.add(s2);
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.7, 1.6), M.dark); hatch.position.set(B.width / 2 + 0.01, 1.65, -0.6); body.add(hatch);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 1.8), M.stripe); awn.position.set(B.width / 2 + 0.2, 2.05, -0.6); awn.rotation.z = -0.3; body.add(awn);
    },
    hearse(body, cabin, M, B) {
        const chrome = cel({ color: '#c8c8d0' });
        for (const sx of [-1, 1]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.9), chrome); bar.position.set(sx * (B.width / 2 - 0.08), 1.3, -1.6); bar.rotation.x = 0.35; cabin.add(bar);
            const bar2 = bar.clone(); bar2.rotation.x = -0.35; bar2.position.z = -0.8; cabin.add(bar2);
        }
        const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.07, 4, 10), cel({ color: '#3a6a2e' })); wreath.position.set(0, 0.6, -B.len / 2 - 0.05); body.add(wreath);
    },
    monster(body, cabin, M, B) {
        const cage = cel({ color: '#ffe23a' });
        for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), cage); b.position.set(sx * 0.7, 1.95, -1.4); body.add(b); }
        const lights = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.2), new THREE.MeshBasicMaterial({ color: '#fff4c8' })); lights.position.set(0, 1.9, 0.3); body.add(lights);
    },
    couch(body, cabin, M, B) {
        for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 2.4), M.paint); arm.position.set(sx * (B.width / 2 - 0.15), 1.1, 0); body.add(arm); }
        for (const sx of [-0.45, 0.45]) {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 1.5), M.stripe); seat.position.set(sx, 0.95, 0.35); body.add(seat);
            const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.2), M.stripe); back.position.set(sx, 1.25, -0.5); back.rotation.x = -0.15; body.add(back);
        }
        const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.3, 6), cel({ color: '#fff1a6' })); lamp.position.set(0.75, 1.75, -1.0); body.add(lamp);
    },
    duck(body, cabin, M, B) {
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), M.paint); head.position.set(0, 1.85, 1.0); body.add(head);
        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), cel({ color: '#ff9a1f' })); beak.position.set(0, 1.75, 1.65); body.add(beak);
        for (const sx of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.12), cel({ color: '#111' })); eye.position.set(sx * 0.5, 2.0, 1.25); body.add(eye);
            const wing = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), M.paint); wing.scale.set(0.3, 0.6, 1.2); wing.position.set(sx * 0.85, 1.0, -0.2); body.add(wing);
        }
    },
    ufo(body, cabin, M, B) {
        // a ring of glowing lights round the rim
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const l = glows(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), new THREE.MeshBasicMaterial({ color: i % 2 ? '#4aff7a' : '#3ad0ff' })));
            l.position.set(Math.cos(a) * 1.65, 0.55, Math.sin(a) * 1.65); body.add(l);
        }
    }
};

export function makeCarMesh(spec) {
    const B = BODIES[spec.type];
    const root = new THREE.Group();      // yaw + position
    const body = new THREE.Group();      // pitch, roll, bounce
    root.add(body);
    const extrude = (pts, width, m) => {
        const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false });
        g.rotateY(Math.PI / 2);
        g.translate(-width / 2, 0, 0);
        g.computeVertexNormals();
        return new THREE.Mesh(g, m);
    };
    const paint = mat({ color: spec.body, flatShading: true });
    const stripe = mat({ color: spec.stripe, flatShading: true });
    const glass = mat({ color: spec.glass || '#3a4a58', emissive: '#0a1016', flatShading: true });
    const dark = mat({ color: '#1c1c22', flatShading: true });
    let shell;
    if (B.saucer) {
        // a flying saucer: a lens turned on a lathe, not an extruded side profile
        const prof = [[0, 0.32], [1.2, 0.36], [1.8, 0.55], [1.2, 0.85], [0.6, 0.92], [0, 0.94]].map(([r, y]) => new THREE.Vector2(r, y));
        shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), paint);
    } else shell = extrude(B.body, B.width, paint);
    body.add(shell);
    // from the driver's seat only the bonnet ahead of the windscreen should show, not the whole shell
    const front = B.body.filter(([z]) => z >= B.cabin[0][0]);
    const hood = B.saucer ? new THREE.Group() : extrude([...front, B.cabin[0], [B.cabin[0][0], B.body[0][1]]], B.width, paint);
    hood.visible = false;
    body.add(hood);
    const cabin = new THREE.Group();
    body.add(cabin);
    if (B.saucer) {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), glass);
        dome.position.y = 0.9; cabin.add(dome);
    } else cabin.add(extrude(B.cabin.concat([[B.cabin[B.cabin.length - 1][0], 0.98], [B.cabin[0][0], 0.98]]), B.width - 0.22, glass));
    const [rf, rr, ry] = B.roof;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.2, 0.06, rf - rr), stripe);
    roof.position.set(0, ry + 0.02, (rf + rr) / 2);
    if (!B.saucer) cabin.add(roof);
    // pillars so the glass reads as windows
    if (!B.saucer) for (const sx of [-1, 1]) {
        const ph = ry - 0.98, pz = (rf + rr) / 2;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, ph, 0.12), paint);
        p.position.set(sx * (B.width / 2 - 0.13), 0.98 + ph / 2, pz);
        cabin.add(p);
    }
    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 1.3), stripe);
    const hz = (B.cabin[0][0] + B.body[2][0]) / 2, hy = (B.cabin[0][1] + B.body[2][1]) / 2;
    hoodStripe.position.set(0, hy + 0.02, hz); hoodStripe.rotation.x = Math.atan2(B.cabin[0][1] - B.body[2][1], B.body[2][0] - B.cabin[0][0]);
    if (!B.noStripe) body.add(hoodStripe);
    // lights, plate, bumper
    const tail = new THREE.MeshBasicMaterial({ color: '#6a0c06' });
    const head = new THREE.MeshBasicMaterial({ color: '#fff0c4' });
    for (const sx of [-1, 1]) {
        const zb = -B.len / 2, zf = B.len / 2, lx = B.width / 2 - 0.3;
        const t = glows(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.05), tail)); t.position.set(sx * lx, B.tail, zb - 0.02); body.add(t);
        const h = glows(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), head)); h.position.set(sx * (lx - 0.02), B.head, zf + 0.02); body.add(h);
    }
    // anime star flares: a thin cross on each lamp, seen only in the glow pass
    const star = (col, size) => {
        const g = new THREE.Group();
        const sm = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: false });
        const a = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.08), sm);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.08, size * 0.6), sm);
        g.add(a, b);
        g.traverse((o) => o.layers.set(GLOW));
        return g;
    };
    const headStars = [];
    for (const sx of [-1, 1]) {
        const lx = B.width / 2 - 0.3;
        const ts = star('#c81c10', 1.1); ts.position.set(sx * lx, B.tail, -B.len / 2 - 0.06); body.add(ts);
        const hs = star('#fff0c8', 1.6); hs.position.set(sx * (lx - 0.02), B.head, B.len / 2 + 0.06); body.add(hs);
        headStars.push(hs);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.03), cel({ color: '#9a9ea4' }));
    plate.position.set(0, B.tail - 0.27, -B.len / 2 - 0.03); body.add(plate);
    const bump = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.1, 0.16, 0.2), dark);
    bump.position.set(0, 0.36, -B.len / 2 + 0.04); body.add(bump);
    // spoiler: the body's own, unless customised on or off
    const sp = B.spoiler || (spec.spoiler ? [-B.len / 2 + 0.3, B.body[B.body.length - 2][1] + 0.3] : null);
    if (sp && spec.spoiler !== false) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.3, 0.05, 0.32), stripe);
        w.position.set(0, sp[1], sp[0]); cabin.add(w);
        for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), dark); leg.position.set(sx * (B.width / 2 - 0.4), sp[1] - 0.12, sp[0]); cabin.add(leg); }
    }
    // a racing number on both doors
    if (spec.num != null && !B.saucer) {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const x = c.getContext('2d');
        x.fillStyle = '#f4f4f0'; x.beginPath(); x.arc(12, 12, 11, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#111'; x.font = 'bold 15px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(spec.num), 12, 13);
        const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
        const dm = cel({ map: t, transparent: true, alphaTest: 0.5 });
        const yMid = (0.3 + Math.min(B.tail, B.head)) / 2 + 0.25;
        for (const sx of [-1, 1]) {
            const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), dm);
            d.position.set(sx * (B.width / 2 + 0.01), yMid, 0); d.rotation.y = sx * Math.PI / 2;
            body.add(d);
        }
    }
    EXTRAS[spec.type] && EXTRAS[spec.type](body, cabin, { paint, stripe, glass, dark }, B, spec);
    // wheels
    const wheels = [];
    const ww = B.wheelW || 0.26;
    const tyre = new THREE.CylinderGeometry(B.wheelR, B.wheelR, ww, 10); tyre.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(B.wheelR * 0.55, B.wheelR * 0.55, ww + 0.02, 6); hub.rotateZ(Math.PI / 2);
    const tm = mat({ color: '#18181a', flatShading: true }), hm = mat({ color: spec.rims || '#a4a8b0', flatShading: true });
    for (const z of B.wb) for (const sx of [-1, 1]) {
        const pivot = new THREE.Group();     // steering
        const spin = new THREE.Group();      // rolling
        spin.add(new THREE.Mesh(tyre, tm), new THREE.Mesh(hub, hm));
        pivot.add(spin);
        pivot.position.set(sx * (B.width / 2 - 0.1 + (B.wheelW ? ww / 2 : 0)), B.wheelR, z);
        pivot.visible = !B.hideWheels;
        root.add(pivot);
        wheels.push({ pivot, spin, front: z > 0 });
    }
    // a hex-wire shield bubble, and nitro flames out of the exhaust (both drawn in the glow pass too)
    const bubble = glows(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffe23a', wireframe: true, fog: false })));
    bubble.scale.set(1.5, 1.2, 2.7); bubble.position.y = 0.8; bubble.visible = false;
    body.add(bubble);
    const flames = new THREE.Group();
    for (const sx of [-0.45, 0.45]) {
        const f = glows(new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 6), new THREE.MeshBasicMaterial({ color: '#8affd8', fog: false })));
        f.rotation.x = -Math.PI / 2; f.position.set(sx, 0.4, -B.len / 2 - 0.65);
        flames.add(f);
    }
    flames.visible = false;
    body.add(flames);
    // aura: only drawn in the glow pass, so it shows as a coloured halo around the car
    const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
    aura.scale.set(B.width * 0.62, 0.9, B.len * 0.55); aura.position.y = 0.75;
    aura.layers.set(GLOW); aura.visible = false;
    // neon underglow: drawn only in the glow pass, so it shows as a coloured light under the car
    if (spec.underglow || B.saucer) {
        const ug = new THREE.Mesh(new THREE.PlaneGeometry(B.width * 0.9, B.len * 0.85), new THREE.MeshBasicMaterial({ color: spec.underglow || '#4aff7a', fog: false, side: THREE.DoubleSide }));
        ug.rotation.x = -Math.PI / 2; ug.position.y = 0.12 - (B.lift || 0); ug.layers.set(GLOW);
        body.add(ug);
    }
    body.position.y = B.lift || 0;
    body.add(aura);
    return { root, body, cabin, shell, hood, wheels, B, tail, headStars, bubble, flames, aura };
}

/* ---------- handling ---------- */
// grip: how hard the tyres hold sideways. drag: extra rolling resistance off the racing surface.
export const SURF = {
    dirt: { grip: 0.82, drag: 0.02, dust: '#a58660' },
    gravel: { grip: 0.78, drag: 0.03, dust: '#b4a68c' },
    sand: { grip: 0.74, drag: 0.05, dust: '#d8945a' },
    snow: { grip: 0.6, drag: 0.03, dust: '#f4f8fc' },
    tarmac: { grip: 1.05, drag: 0.0, dust: null },
    verge: { grip: 0.7, drag: 0.35, dust: '#8a6a48' },
    grass: { grip: 0.62, drag: 0.6, dust: '#6aa822' },
    rock: { grip: 0.6, drag: 0.7, dust: '#6e665c' },
    concrete: { grip: 0.95, drag: 0.25, dust: null },
    mud: { grip: 0.7, drag: 0.05, dust: '#4a3424' },
    jungle: { grip: 0.6, drag: 0.6, dust: '#2e6430' },
    cobble: { grip: 0.94, drag: 0.01, dust: null },
    stone: { grip: 0.6, drag: 0.7, dust: '#6a6e5e' }
};

export class Car {
    constructor(spec, track) {
        this.spec = spec;
        this.track = track;
        this.mesh = makeCarMesh(spec);
        this.x = 0; this.z = 0; this.y = 0; this.vy = 0; this.h = 0;
        this.vx = 0; this.vz = 0; this.w = 0;
        this.hint = null; this.q = null;
        this.ground = true; this.air = 0;
        this.steer = 0; this.slip = 0; this.speed = 0; this.vf = 0;
        this.pitch = 0; this.roll = 0; this.bounce = 0; this.wheelSpin = 0;
        this.scrape = 0; this.land = 0;
        // combat state
        this.health = 100; this.shield = 0; this.nitro = 0; this.wrecked = 0; this.invuln = 0;
        this.flip = 0; this.flipRate = 0;
        this.slots = []; this.sel = 0;
    }
    flashAura(col, t = 0.6) { this.auraCol = col; this.auraT = Math.max(this.auraT || 0, t); }
    wreck() {
        this.wrecked = 2.6;
        this.flipRate = this.flipRate || (Math.random() < 0.5 ? -7 : 7);
        this.vy = Math.max(this.vy, 6); this.ground = false; this.y += 0.05;
        this.slots = []; this.shield = 0; this.nitro = 0;
    }
    // back on the road after a wreck: at the centre line where we were, facing the right way
    respawn() {
        const s = this.track.S[this.q.i];
        this.place(s.x, s.y + 0.3, s.z, Math.atan2(s.tx, s.tz));
        this.lastGy = this.y;
        this.health = 100; this.wrecked = 0; this.invuln = 1.8; this.flip = 0; this.flipRate = 0;
    }
    // Headlights for dark tracks: two real spotlights that light the road ahead in hard cel bands,
    // plus a faint beam that only shows up in the glow pass, as stylised haze.
    setHeadlights(k) {
        if (!k || this.lamps) return;
        const m = this.mesh;
        this.lamps = [];
        for (const sx of [-1, 1]) {
            const L = new THREE.SpotLight('#ffe6bc', 34 * k, 75, 0.46, 0.06, 1.25);
            L.position.set(sx * 0.58, m.B.head, m.B.len / 2 - 0.1);
            L.target.position.set(sx * 1.4, -0.4, 24);
            m.body.add(L, L.target);
            this.lamps.push(L);
        }
        const bm = new THREE.MeshBasicMaterial({ color: '#2a2216', transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        for (const sx of [-1, 1]) {
            const g = new THREE.BufferGeometry();
            const x0 = sx * 0.58, z0 = m.B.len / 2;
            g.setAttribute('position', new THREE.Float32BufferAttribute([x0, 0.7, z0, x0 + sx * 1.2 - 2.4, 0.2, 20, x0 + sx * 1.2 + 2.4, 0.2, 20], 3));
            const blade = new THREE.Mesh(g, bm);
            blade.layers.set(GLOW);
            m.body.add(blade);
            (m.beams || (m.beams = [])).push(blade);
        }
    }
    place(x, y, z, h) {
        Object.assign(this, { x, y, z, h, vx: 0, vz: 0, vy: 0, w: 0, hint: null });
        this.q = this.track.query(x, z, null);
        this.hint = this.q.i;
        this.y = this.q.y;
        this.sync(0);
    }
    step(dt, inp) {
        const sp = this.spec;
        this.invuln = Math.max(0, this.invuln - dt);
        this.shield = Math.max(0, this.shield - dt);
        this.nitro = Math.max(0, this.nitro - dt);
        if (this.wrecked > 0) { this.wrecked -= dt; inp = { steer: 0, throttle: 0, brake: 0.4, handbrake: false }; }
        if (this.stall > 0) { this.stall -= dt; inp = Object.assign({}, inp, { throttle: 0 }); }
        const fx = Math.sin(this.h), fz = Math.cos(this.h);
        const rx = -fz, rz = fx;                          // right
        let vf = this.vx * fx + this.vz * fz;
        let vr = this.vx * rx + this.vz * rz;
        const q = this.q;
        const base = SURF[q.surface] || SURF.dirt;
        const g = this.ground;
        // rain makes everything slippery; a puddle much more so, and it drags at the wheels
        this.inPuddle = this.track.puddleAt ? this.track.puddleAt(q) : false;
        const wet = this.track.wet ? 0.85 : 1;
        const offroad = sp.offroad && ['verge', 'grass', 'sand', 'snow', 'gravel'].includes(q.surface) ? 0.5 : 1;
        const surf0 = this.inPuddle ? { grip: base.grip * 0.55 * wet, drag: base.drag + 0.25 } : wet < 1 ? { grip: base.grip * wet, drag: base.drag } : base;
        const surf = offroad < 1 ? { grip: surf0.grip, drag: surf0.drag * offroad } : surf0;

        // steering: smoothed input, less lock at speed
        this.steer += (inp.steer - this.steer) * Math.min(1, dt * 10);
        this.braking = inp.brake > 0 && vf > 1;
        const spd = Math.abs(vf);
        if (g) {
            const lock = 2.3 - 1.25 * Math.min(1, spd / sp.maxSpeed);
            const turn = Math.min(1, spd / 6) * Math.sign(vf || 1);
            let wT = -this.steer * lock * turn;
            if (inp.handbrake && spd > 6) wT *= 1.45;
            this.w += (wT - this.w) * Math.min(1, dt * (5 + 5 * surf.grip * sp.grip));
        } else this.w *= 1 - dt * 0.5;
        this.h += this.w * dt;

        if (g) {
            // throttle and brakes
            if (this.nitro > 0) vf += sp.accel * 1.4 * dt * Math.max(0, 1 - vf / (sp.maxSpeed * 1.4));
            if (inp.throttle > 0) {
                const top = sp.maxSpeed * (1 - surf.drag * 0.5) * (this.nitro > 0 ? 1.35 : 1);
                const k = vf < 0 ? 2.2 : clamp(1 - (vf / top) ** 2, 0, 1);
                vf += sp.accel * inp.throttle * k * dt;
            }
            if (inp.brake > 0) {
                if (vf > 0.5) vf -= 26 * inp.brake * dt;
                else vf = Math.max(-12, vf - 9 * inp.brake * dt);
            }
            if (inp.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
            vf -= vf * (0.06 + surf.drag) * dt;
            if (!inp.throttle && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2 * dt);
            // sideways grip: low grip and the handbrake let the tail slide out
            const lat = (inp.handbrake ? 1.3 : 7.5) * surf.grip * sp.grip;
            const before = vr;
            vr *= Math.exp(-lat * dt);
            vf -= Math.abs(before - vr) * 0.1 * Math.sign(vf); // sliding scrubs speed
        }
        this.slip = Math.abs(vr);
        this.vx = fx * vf + rx * vr;
        this.vz = fz * vf + rz * vr;
        this.vf = vf;
        this.x += this.vx * dt;
        this.z += this.vz * dt;

        // where are we on the track, and did we hit the edge?
        let nq = this.track.query(this.x, this.z, this.hint);
        this.scrape = Math.max(0, this.scrape - dt);
        if (nq.ad > nq.wall) {
            const push = nq.ad - nq.wall, sg = Math.sign(nq.d);
            this.x -= nq.sx * sg * push; this.z -= nq.sz * sg * push;
            const out = (this.vx * nq.sx + this.vz * nq.sz) * sg;
            if (out > 0) {
                // bounce off (a third of the impact comes back), scrub speed by how head-on it was,
                // and kick the car's nose away from the wall
                const sp = Math.hypot(this.vx, this.vz) || 1;
                this.vx -= nq.sx * sg * out * 1.35; this.vz -= nq.sz * sg * out * 1.35;
                const scrub = Math.min(0.55, (out / sp) * 0.7 + 0.03);
                this.vx *= 1 - scrub; this.vz *= 1 - scrub;
                const fwdIn = Math.sin(this.h) * nq.sx * sg + Math.cos(this.h) * nq.sz * sg;   // >0 nose into the wall
                this.w += -sg * out * 0.09 * (fwdIn >= 0 ? 1 : -1) * Math.sign(this.vf || 1);
                this.scrape = Math.min(1, out / 8 + 0.2);
                if (out > (this.impact || 0)) { this.impact = out; this.impactX = this.x + nq.sx * sg * 1; this.impactZ = this.z + nq.sz * sg * 1; }
            }
            nq = this.track.query(this.x, this.z, nq.i);
        }
        this.q = nq; this.hint = nq.i;

        // height: follow the ground, fly off crests
        const gy = nq.y;
        this.vy -= 24 * dt;
        this.y += this.vy * dt;
        if (this.y <= gy) {
            const climb = (gy - this.lastGy) / dt;
            if (!this.ground && this.vy < -5) this.land = Math.min(1, -this.vy / 14);
            this.y = gy;
            this.vy = isFinite(climb) ? clamp(climb, -40, 40) : 0;
            this.ground = true; this.air = 0;
            if (this.flipRate) { this.flipRate = 0; this.flip = 0; this.land = Math.max(this.land, 0.8); }
        } else {
            this.ground = this.y - gy < 0.08;
            if (!this.ground) { this.air += dt; this.flip += this.flipRate * dt; }
        }
        this.lastGy = gy;
        this.speed = Math.hypot(this.vx, this.vz);
        // acceleration in the car's own frame (for the air freshener and the droplets)
        const ax = (this.vx - (this.pvx ?? this.vx)) / dt, az = (this.vz - (this.pvz ?? this.vz)) / dt;
        this.pvx = this.vx; this.pvz = this.vz;
        const lx = Math.cos(this.h), lz = -Math.sin(this.h);      // local +x (the car's left)
        const k = Math.min(1, dt * 12);
        this.accF = (this.accF || 0) + ((ax * fx + az * fz) - (this.accF || 0)) * k;
        this.accL = (this.accL || 0) + ((ax * lx + az * lz) - (this.accL || 0)) * k;
        this.accY = (this.accY || 0) + (((this.vy - (this.pvy ?? this.vy)) / dt) - (this.accY || 0)) * k;
        this.pvy = this.vy;
    }
    // Pose the model: body pitch and roll from the slope, cornering and landings.
    sync(dt) {
        const m = this.mesh, q = this.q;
        m.root.position.set(this.x, this.y, this.z);
        m.tail.color.set(this.braking ? '#ff3a24' : '#6a0c06');
        m.root.rotation.y = this.h;
        if (q && dt) {
            const fx = Math.sin(this.h), fz = Math.cos(this.h);
            const ahead = this.track.query(this.x + fx * 1.6, this.z + fz * 1.6, q.i).y;
            const behind = this.track.query(this.x - fx * 1.6, this.z - fz * 1.6, q.i).y;
            const pitchT = this.ground ? -Math.atan2(ahead - behind, 3.2) : this.pitch + (this.vy < 0 ? 0.2 : -0.05) * dt;
            this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 10);
            const rollT = clamp(this.w * this.speed * 0.006, -0.12, 0.12);
            this.roll += (rollT - this.roll) * Math.min(1, dt * 6);
            this.land = Math.max(0, this.land - dt * 3);
            this.bounce = Math.sin(performance.now() / 45) * Math.min(0.03, this.speed * 0.0008) * (q.surface === 'tarmac' ? 0.3 : 1) - this.land * 0.15;
        }
        m.root.rotation.order = 'YXZ';
        m.root.rotation.x = this.pitch;
        m.body.rotation.z = this.roll + this.flip;
        m.bubble.visible = this.shield > 0;
        if (this.shield > 0) { m.bubble.rotation.y += (dt || 0) * 1.5; m.bubble.visible = this.shield > 2 || Math.floor(this.shield * 8) % 2 === 0; }
        m.flames.visible = this.nitro > 0;
        this.auraT = Math.max(0, (this.auraT || 0) - (dt || 0));
        const auraOn = this.auraT > 0 || this.nitro > 0;
        m.aura.visible = auraOn;
        if (auraOn) {
            m.aura.material.color.set(this.nitro > 0 ? '#4aff7a' : this.auraCol);
            const k = this.nitro > 0 ? 1 : Math.min(1, this.auraT * 2.5);
            m.aura.material.color.multiplyScalar(0.35 + 0.65 * k * (0.75 + 0.25 * Math.sin(performance.now() / 40)));
        }
        if (this.nitro > 0) m.flames.scale.set(1, 1, 0.7 + Math.random() * 0.6);
        m.root.visible = !(this.invuln > 0 && Math.floor(this.invuln * 10) % 2);
        m.body.position.y = (m.B.lift || 0) + this.bounce + (m.B.saucer ? Math.sin(performance.now() / 300) * 0.08 : 0);
        this.wheelSpin += (this.vf / m.B.wheelR) * (dt || 0);
        m.wheels.forEach((wh) => {
            wh.spin.rotation.x = this.wheelSpin;
            if (wh.front) wh.pivot.rotation.y = -this.steer * 0.45;
        });
    }
}

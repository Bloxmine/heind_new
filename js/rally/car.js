/* Cars: low-poly models extruded from a side profile, and an arcade rally handling model. Forward is +z. */
import * as THREE from 'three';
import { cel, glows, GLOW } from './retro.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Side profiles as [z, y] (front is +z). Fictional cars, no real brands.
const BODIES = {
    hatch: {
        len: 4.2, width: 1.8, wheelR: 0.36, wb: [1.32, -1.3],
        body: [[2.08, 0.3], [2.15, 0.55], [2.04, 0.8], [1.25, 0.98], [0.75, 1.02], [-1.85, 1.06], [-2.08, 0.98], [-2.12, 0.55], [-2.04, 0.3]],
        cabin: [[0.78, 1.0], [0.08, 1.48], [-1.32, 1.5], [-1.96, 1.04]],
        roof: [0.08, -1.32, 1.5]
    }
};

export const CARS = [
    { id: 'volta', name: 'VOLTA HS', type: 'hatch', body: '#c4c9d0', stripe: '#262c34', maxSpeed: 52, accel: 15, grip: 1.0, spoiler: true }
];

const mat = (o) => cel(o);

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
    const glass = mat({ color: '#3a4a58', emissive: '#0a1016', flatShading: true });
    const dark = mat({ color: '#1c1c22', flatShading: true });
    body.add(extrude(B.body, B.width, paint));
    const cabin = new THREE.Group();
    body.add(cabin);
    cabin.add(extrude(B.cabin.concat([[B.cabin[B.cabin.length - 1][0], 0.98], [B.cabin[0][0], 0.98]]), B.width - 0.22, glass));
    const [rf, rr, ry] = B.roof;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.2, 0.06, rf - rr), stripe);
    roof.position.set(0, ry + 0.02, (rf + rr) / 2);
    cabin.add(roof);
    // pillars so the glass reads as windows
    for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.12), paint);
        p.position.set(sx * (B.width / 2 - 0.13), 1.25, -0.55);
        cabin.add(p);
    }
    const glint = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.5, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: '#e8f0f6' }));
    glint.position.set(0, 1.28, -1.68); glint.rotation.x = -0.75; glint.rotation.z = 0.25;
    cabin.add(glint);
    const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 1.3), stripe);
    hoodStripe.position.set(0, 0.99, 1.4); hoodStripe.rotation.x = 0.12;
    body.add(hoodStripe);
    // lights, plate, bumper
    const tail = new THREE.MeshBasicMaterial({ color: '#6a0c06' });
    const head = new THREE.MeshBasicMaterial({ color: '#fff0c4' });
    for (const sx of [-1, 1]) {
        const t = glows(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.05), tail)); t.position.set(sx * 0.6, 0.82, -2.1); body.add(t);
        const h = glows(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), head)); h.position.set(sx * 0.58, 0.68, 2.12); body.add(h);
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
        const ts = star('#c81c10', 1.1); ts.position.set(sx * 0.6, 0.82, -2.16); body.add(ts);
        const hs = star('#fff0c8', 1.6); hs.position.set(sx * 0.58, 0.68, 2.18); body.add(hs);
        headStars.push(hs);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: '#f4f4f4' }));
    plate.position.set(0, 0.55, -2.13); body.add(plate);
    const bump = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.1, 0.16, 0.2), dark);
    bump.position.set(0, 0.36, -2.06); body.add(bump);
    if (spec.spoiler) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(B.width - 0.3, 0.05, 0.32), paint);
        w.position.set(0, 1.52, -1.86); cabin.add(w);
    }
    // wheels
    const wheels = [];
    const tyre = new THREE.CylinderGeometry(B.wheelR, B.wheelR, 0.26, 10); tyre.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(B.wheelR * 0.55, B.wheelR * 0.55, 0.28, 6); hub.rotateZ(Math.PI / 2);
    const tm = mat({ color: '#18181a', flatShading: true }), hm = mat({ color: '#a4a8b0', flatShading: true });
    for (const z of B.wb) for (const sx of [-1, 1]) {
        const pivot = new THREE.Group();     // steering
        const spin = new THREE.Group();      // rolling
        spin.add(new THREE.Mesh(tyre, tm), new THREE.Mesh(hub, hm));
        pivot.add(spin);
        pivot.position.set(sx * (B.width / 2 - 0.1), B.wheelR, z);
        root.add(pivot);
        wheels.push({ pivot, spin, front: z > 0 });
    }
    return { root, body, cabin, wheels, B, tail, headStars };
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
    rock: { grip: 0.6, drag: 0.7, dust: '#6e665c' }
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
    }
    // Headlights for dark tracks: two real spotlights that light the road ahead in hard cel bands,
    // plus a faint beam that only shows up in the glow pass, as stylised haze.
    setHeadlights(k) {
        if (!k || this.lamps) return;
        const m = this.mesh;
        this.lamps = [];
        for (const sx of [-1, 1]) {
            const L = new THREE.SpotLight('#ffe6bc', 34 * k, 75, 0.46, 0.06, 1.25);
            L.position.set(sx * 0.58, 0.72, 2.0);
            L.target.position.set(sx * 1.4, -0.4, 24);
            m.body.add(L, L.target);
            this.lamps.push(L);
        }
        const bm = new THREE.MeshBasicMaterial({ color: '#2a2216', transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        for (const sx of [-1, 1]) {
            const g = new THREE.BufferGeometry();
            const x0 = sx * 0.58, z0 = 2.1;
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
        const surf = this.inPuddle ? { grip: base.grip * 0.55 * wet, drag: base.drag + 0.25 } : wet < 1 ? { grip: base.grip * wet, drag: base.drag } : base;

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
            if (inp.throttle > 0) {
                const top = sp.maxSpeed * (1 - surf.drag * 0.5);
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
                this.vx -= nq.sx * sg * out * 1.3; this.vz -= nq.sz * sg * out * 1.3;
                this.vx *= 0.97; this.vz *= 0.97;
                this.scrape = Math.min(1, out / 8 + 0.2);
                this.w += sg * out * 0.02;
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
        } else {
            this.ground = this.y - gy < 0.08;
            if (!this.ground) this.air += dt;
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
        m.body.rotation.z = this.roll;
        m.body.position.y = this.bounce;
        this.wheelSpin += (this.vf / m.B.wheelR) * (dt || 0);
        m.wheels.forEach((wh) => {
            wh.spin.rotation.x = this.wheelSpin;
            if (wh.front) wh.pivot.rotation.y = -this.steer * 0.45;
        });
    }
}

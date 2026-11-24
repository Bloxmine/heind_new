/* Draws the world: characters and their animation, ragdoll-ish deaths that pop into confetti, projectiles,
   pickups, traps, puddles and the RC car, particles, and the first-person viewmodel. */
import * as THREE from 'three';
import { glows } from '../rally/retro.js';
import { makeCharacter, setTeam, weaponModel, itemModel, ITEM_COL, projModel, carModel, trapModel, puddleModel, dyn, GLOBAL_PROBE, vehicleModel, flagModel } from './models.js';
import { CHARS, TEAMS, VEHICLES } from './defs.js';
const MARK_GEO = new THREE.OctahedronGeometry(0.12, 0);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const CONFETTI = [[1, 0.25, 0.4], [0.25, 0.8, 1], [1, 0.85, 0.2], [0.3, 1, 0.5], [0.75, 0.3, 1], [1, 1, 1]];
const WATER = [[0.35, 0.7, 1], [0.6, 0.85, 1], [0.85, 0.95, 1]];

/* ---------- particles: square points, a pool of a few thousand ---------- */
class Particles {
    constructor(scene, n = 3000) {
        this.n = n; this.i = 0;
        this.p = Array.from({ length: n }, () => ({ life: 0 }));
        const g = new THREE.BufferGeometry();
        this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n);
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        this.mat = new THREE.ShaderMaterial({
            uniforms: { uScale: { value: 360 } },
            vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC;
                uniform float uScale;
                void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size > 0.0 ? max(1.0, size * uScale / -mv.z) : 0.0; vC = color; }`,
            fragmentShader: 'varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }'
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.geo = g;
    }
    add(x, y, z, vx, vy, vz, c, size = 0.08, life = 1, gr = 9, drag = 1, flutter = 0) {
        const p = this.p[this.i]; this.i = (this.i + 1) % this.n;
        Object.assign(p, { x, y, z, vx, vy, vz, r: c[0], g: c[1], b: c[2], size, life, max: life, gr, drag, flutter, ph: Math.random() * 6 });
    }
    burst(x, y, z, n, cols, speed, size, life, gr = 9, drag = 1.5, flutter = 0, up = 0) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, u = rnd(-1, 1), s = Math.sqrt(1 - u * u), sp = speed * rnd(0.3, 1);
            this.add(x, y, z, Math.cos(a) * s * sp, u * sp + up, Math.sin(a) * s * sp, cols[i % cols.length], size * rnd(0.7, 1.3), life * rnd(0.6, 1.2), gr, drag, flutter);
        }
    }
    update(dt, level) {
        const P = this.pos, C = this.col, Z = this.size;
        for (let i = 0; i < this.n; i++) {
            const p = this.p[i];
            if (p.life <= 0) { Z[i] = 0; continue; }
            p.life -= dt;
            p.vy -= p.gr * dt;
            const k = Math.max(0, 1 - p.drag * dt);
            p.vx *= k; p.vy *= k; p.vz *= k;
            if (p.flutter) { p.ph += dt * 9; p.vx += Math.sin(p.ph) * p.flutter * dt; p.vz += Math.cos(p.ph * 1.3) * p.flutter * dt; }
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            // land on floors (cheaply: only falling confetti and droplets)
            if (p.vy < 0 && p.gr > 1 && level && (i & 3) === 0) {
                const g = level.ground(p.x, p.z, 0.01, p.y + 0.05);
                if (p.y < g) { p.y = g + 0.01; p.vx = p.vy = p.vz = 0; p.gr = 0; p.flutter = 0; }
            }
            const f = Math.min(1, p.life / (p.max * 0.3));
            P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
            C[i * 3] = p.r; C[i * 3 + 1] = p.g; C[i * 3 + 2] = p.b;
            Z[i] = p.size * (0.4 + 0.6 * f);
        }
        this.geo.attributes.position.needsUpdate = this.geo.attributes.color.needsUpdate = this.geo.attributes.size.needsUpdate = true;
    }
}

// how each weapon sits in the first-person view: position, rotation, scale
// first-person holds: [position], [rotation], scale. Everything sits in the lower right, clear of the crosshair
// and the ammo panel; long things (noodle, rake, bat, club) are held upright, tipped out to the right.
const HOLD = {
    noodle: [[0.32, -0.3, -0.55], [0.75, -0.3, -0.3], 0.48], slicer: [[0.28, -0.24, -0.48], [0.25, 0, 0], 0.7],
    rake: [[0.33, -0.3, -0.5], [1.0, -0.3, -0.3], 0.5], whip: [[0.3, -0.2, -0.5], [0.25, 0, 0], 0.85],
    pistol: [[0.26, -0.21, -0.52], [0, 0.04, 0], 0.6], balloon: [[0.27, -0.22, -0.48], [0, 0, 0], 0.7],
    blower: [[0.27, -0.23, -0.52], [0, 0.04, 0], 0.7], bat: [[0.3, -0.3, -0.5], [0.1, -0.1, -0.45], 0.65],
    tennis: [[0.27, -0.25, -0.55], [0, 0.04, 0], 0.62], rocket: [[0.27, -0.22, -0.52], [0, 0.03, 0], 0.75],
    golf: [[0.3, -0.3, -0.5], [0.9, -0.25, -0.35], 0.6], rc: [[0.24, -0.2, -0.5], [0.6, -0.2, 0], 0.6]
};
if (typeof window !== 'undefined') window.__HOLD = HOLD;     // for tuning the first-person holds

export class View {
    constructor(scene, world, lighting) {
        this.scene = scene; this.W = world; this.lighting = lighting;
        this.vis = new Map(); this.projV = new Map(); this.itemV = new Map(); this.trapV = new Map(); this.pudV = new Map(); this.carV = new Map();
        this.corpses = [];
        this.parts = new Particles(scene);
        this.root = new THREE.Group(); scene.add(this.root);
        this.t = 0;
        this.flashes = [];
        this.flashGeo = new THREE.SphereGeometry(1, 8, 6);
        // the first-person view: its own little scene, drawn over the world
        this.vmScene = new THREE.Scene();
        this.vmCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 300);
        const sun = new THREE.DirectionalLight('#fff1dc', 1.6); sun.position.set(0.4, 1, 0.3);
        this.vmScene.add(sun, new THREE.AmbientLight('#ffffff', 0.15));
        this.vmProbe = { value: new THREE.Color(0.4, 0.4, 0.42) };
        this.vm = new THREE.Group(); this.vmScene.add(this.vm);
        this.vmW = null; this.vmKey = '';
        this.vmState = { bob: 0, sx: 0, sy: 0, kick: 0, lastYaw: 0, lastPitch: 0, swing: 0, land: 0, lower: 0 };
        this.local = null;
        for (const it of world.items) this.makeItem(it);
        this.vehV = new Map(); this.dropV = new Map(); this.flagV = [];
        for (const f of world.flags || []) { const m = flagModel(f.r); m.position.set(f.x, f.y, f.z); this.root.add(m); this.flagV.push(m); }
    }
    clear() {
        for (const v of this.vis.values()) this.root.remove(v.J.root);
        this.vis.clear();
    }

    /* ---------- per frame ---------- */
    update(dt, localId, camPos) {
        this.t += dt;
        this.camPos = camPos;
        const W = this.W;
        this.local = localId;
        // players
        const seen = new Set();
        for (const a of W.actors) {
            seen.add(a.id);
            let v = this.vis.get(a.id);
            if (!v || v.char !== a.char || v.team !== (W.rules.teams ? a.team : -1)) {
                if (v) { this.root.remove(v.J.root); if (v.box) this.root.remove(v.box); this.root.remove(v.mk); }
                const probe = { value: new THREE.Color(0.3, 0.3, 0.33) };
                // a rim of light on the silhouette: the team colour, or warm white when it's everyone for themselves
                const tc = W.rules.teams ? new THREE.Color(TEAMS[a.team].col) : new THREE.Color('#ffe2a8');
                const rim = { value: tc.clone().multiplyScalar(W.rules.teams ? 0.55 : 0.35) };
                const J = makeCharacter(a.char, probe, W.rules.teams ? a.team : -1, rim);
                // and a little marker over the head that stays the same size on screen
                const mk = glows(new THREE.Mesh(MARK_GEO, new THREE.MeshBasicMaterial({ color: W.rules.teams ? TEAMS[a.team].col : '#ff4a6a', fog: false })));
                this.root.add(mk);
                v = { J, probe, rim, mk, char: a.char, team: W.rules.teams ? a.team : -1, w: '', probeT: 0, box: null };
                this.vis.set(a.id, v);
                this.root.add(J.root);
            }
            this.animate(a, v, dt, a.id === localId);
        }
        for (const [id, v] of this.vis) if (!seen.has(id)) { this.root.remove(v.J.root); if (v.box) this.root.remove(v.box); this.root.remove(v.mk); this.vis.delete(id); }
        this.updCorpses(dt);
        this.updProj(dt);
        this.updItems(dt);
        this.updTraps(dt);
        this.updPuddles();
        this.updCars(dt);
        if (W.cq) { this.updVehicles(dt); this.updFlags(); this.updDrops(); }
        // baby powder: a thick cloud, kept topped up with big soft puffs
        for (const c of W.clouds || []) {
            const n = c.life > 1.5 ? 14 : 4;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * c.r;
                this.parts.add(c.x + Math.cos(a) * r, c.y + 0.3 + Math.random() * 3.2, c.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.4, 0.15, (Math.random() - 0.5) * 0.4, Math.random() < 0.5 ? [0.95, 0.95, 0.97] : [0.85, 0.86, 0.9], 0.3 + Math.random() * 0.3, 1.6, 0, 0.6);
            }
        }
        for (const f of this.flashes) { f.t -= dt; f.m.scale.setScalar(f.r * (1 + (1 - f.t / f.max) * 0.8)); f.m.visible = f.t > 0; }
        this.flashes = this.flashes.filter((f) => { if (f.t <= 0) { this.root.remove(f.m); return false; } return true; });
        this.parts.update(dt, W.level);
    }
    animate(a, v, dt, isLocal) {
        const J = v.J, W = this.W;
        // the baked light where they stand
        v.probeT -= dt;
        // never darker than this, so nobody vanishes into a shadow or the night
        if (v.probeT <= 0 && this.lighting) { v.probeT = 0.2; const p = this.lighting.probe(a.x, a.y + 1.1, a.z); v.probe.value.setRGB(Math.max(0.2, p[0]), Math.max(0.2, p[1]), Math.max(0.22, p[2])); }
        const hidden = W.hidden(a);
        const seat = a.veh && W.vehicleSeat ? W.vehicleSeat(a) : null;
        const outside = isLocal && seat && !seat.gun && !seat.turret;      // a driver sees themselves from behind
        const show = a.alive && !(isLocal && !a.car && !outside) && !hidden && !(a.prot > 0 && Math.floor(this.t * 12) % 2 === 0);
        J.root.visible = show;
        v.mk.visible = show && !isLocal && a.alive;
        if (v.mk.visible && this.camPos) {
            const d = Math.hypot(a.x - this.camPos.x, a.y + a.h - this.camPos.y, a.z - this.camPos.z);
            v.mk.position.set(a.x, a.y + a.h + 0.35 + d * 0.012, a.z);
            v.mk.scale.setScalar(Math.max(0.8, d * 0.042));
            v.mk.rotation.y = this.t * 2;
        }
        if (hidden && a.alive && !isLocal) {
            if (!v.box) { v.box = itemModel('p:box'); v.box.scale.setScalar(2.4); this.root.add(v.box); }
            v.box.visible = true; v.box.position.set(a.x, a.y + 0.41, a.z); v.box.rotation.y = a.yaw;
        } else if (v.box) v.box.visible = false;
        if (!show) return;
        // the weapon in hand
        const wkey = a.cur + (a.dual ? '2' : '');
        if (v.w !== wkey) {
            J.hand.clear();
            const m = weaponModel(a.cur, { probe: v.probe, dual: a.dual });
            m.rotation.x = -Math.PI / 2;
            J.hand.add(m);
            v.w = wkey;
        }
        J.root.position.set(a.x, a.y, a.z);
        J.root.rotation.y = a.yaw;
        if (seat) {
            const v = W.vehicle(a.veh);
            if (v && !seat.gun && !seat.turret) J.root.rotation.y = v.yaw;
            if (!seat.push) {
                // sitting: thighs forward, shins down
                J.hips.position.y = 0.5; J.legL.rotation.x = J.legR.rotation.x = -1.45; J.legL.knee.rotation.x = J.legR.knee.rotation.x = 1.45;
                J.torso.rotation.x = 0.05; J.armL.rotation.set(seat.driver ? 1.1 : 0, 0, -0.1);
                if (seat.driver) J.armR.rotation.set(1.1, 0, 0.1);
                else J.armR.rotation.set(Math.PI / 2 + a.pitch * 0.9, 0, 0);
                J.neck.rotation.x = a.pitch * 0.5;
                return;
            }
        }
        const hs = Math.hypot(a.vx, a.vz), k = clamp(hs / 9, 0, 1);
        const ph = a.walk * 2.1;
        const sliding = a.slideT > 0, crouch = a.crouch, air = !a.ground;
        // legs and arms
        let lL = Math.sin(ph) * 0.75 * k, lR = -lL, kneeL = Math.max(0, -Math.sin(ph)) * 0.9 * k, kneeR = Math.max(0, Math.sin(ph)) * 0.9 * k;
        let hipsY = 0.9 + Math.abs(Math.cos(ph)) * 0.04 * k, lean = 0.12 * k, back = 0;
        if (air) { lL = -0.5; lR = 0.3; kneeL = 0.9; kneeR = 0.4; }
        if (crouch) { hipsY = 0.55; lL = lR = -1.0; kneeL = kneeR = 1.7; lean = 0.25; }
        if (sliding) { hipsY = 0.42; lL = -1.35; lR = -1.1; kneeL = 0.2; kneeR = 0.6; lean = -0.55; back = 0; }
        J.hips.position.y = lerp(J.hips.position.y, hipsY, Math.min(1, dt * 16));
        J.legL.rotation.x = lerp(J.legL.rotation.x, lL, Math.min(1, dt * 18)); J.legR.rotation.x = lerp(J.legR.rotation.x, lR, Math.min(1, dt * 18));
        J.legL.knee.rotation.x = kneeL; J.legR.knee.rotation.x = kneeR;
        J.torso.rotation.x = lerp(J.torso.rotation.x, -lean + back, Math.min(1, dt * 12));
        J.armL.rotation.x = -lL * 0.8 + (air ? -0.8 : 0); J.armL.rotation.z = air ? -0.5 : -0.08;
        // the weapon arm points where they aim, and swings for melee
        let ax = Math.PI / 2 + a.pitch * 0.9, ay = 0, az = 0;
        if (a.swing > 0) {
            const t = 1 - a.swing / (a.swingK ? 0.5 : 0.3);
            if (a.swingK) ax = Math.PI / 2 + 1.6 - t * 2.6; else { ay = 1.0 - t * 2.2; }
        }
        ax += a.fireAnim * 1.2;
        J.armR.rotation.set(ax - J.torso.rotation.x, ay, az);
        J.neck.rotation.x = a.pitch * 0.6 - J.torso.rotation.x * 0.5;
        if (a.stunT > 0) J.neck.rotation.z = Math.sin(this.t * 20) * 0.2; else J.neck.rotation.z = 0;
    }

    /* ---------- deaths: the body tumbles, flops and pops ---------- */
    corpse(e) {
        const a = this.W.byId(e.v), v = this.vis.get(e.v);
        const ci = a ? a.char : 0;
        const J = makeCharacter(ci, v ? v.probe : GLOBAL_PROBE, this.W.rules.teams && a ? a.team : -1);
        J.root.position.set(e.x, e.y, e.z);
        J.root.rotation.y = a ? a.yaw : 0;
        J.armL.rotation.z = -1.4; J.armR.rotation.z = 1.4; J.legL.rotation.z = -0.4; J.legR.rotation.z = 0.4;
        if (a && a.cur) { const m = weaponModel(a.cur, { dual: a.dual }); m.rotation.x = -Math.PI / 2; J.hand.add(m); }
        this.root.add(J.root);
        const s = Math.hypot(e.vx || 0, e.vz || 0);
        this.corpses.push({ J, x: e.x, y: e.y, z: e.z, vx: (e.vx || 0) * 0.6 + rnd(-2, 2), vy: 5 + rnd(0, 3) + Math.max(0, e.vy || 0) * 0.5, vz: (e.vz || 0) * 0.6 + rnd(-2, 2),
            rx: 0, rz: 0, wx: rnd(-8, 8) - s, wz: rnd(-8, 8), t: 2.4, flop: 0 });
        this.parts.burst(e.x, e.y + 1.1, e.z, 26, CONFETTI, 6, 0.09, 1.6, 4, 2, 6, 2);
    }
    updCorpses(dt) {
        const L = this.W.level;
        for (const c of this.corpses) {
            c.t -= dt;
            c.vy -= 22 * dt;
            c.x += c.vx * dt; c.z += c.vz * dt;
            if (L.blocked(c.x, c.y + 0.2, c.z, 0.25, 0.6, 0.3)) { c.x -= c.vx * dt; c.z -= c.vz * dt; c.vx *= -0.4; c.vz *= -0.4; }
            c.y += c.vy * dt;
            const g = L.ground(c.x, c.z, 0.25, c.y + 0.4);
            if (c.y < g + 0.15) {
                c.y = g + 0.15;
                if (c.vy < -3) { c.vy *= -0.35; c.wx *= 0.6; c.wz *= 0.6; } else { c.vy = 0; c.vx *= 0.85; c.vz *= 0.85; c.wx *= 0.8; c.wz *= 0.8; }
                c.flop = Math.min(1, c.flop + dt * 4);
            }
            c.rx += c.wx * dt; c.rz += c.wz * dt;
            // settle flat on its back
            if (c.flop > 0) { c.rx = lerp(c.rx, -Math.PI / 2, c.flop * dt * 6); c.rz = lerp(c.rz, 0, c.flop * dt * 6); }
            c.J.root.position.set(c.x, c.y, c.z);
            c.J.body.rotation.set(c.rx, 0, c.rz);
            c.J.body.position.y = 0.4;
            c.J.legL.rotation.x = Math.sin(this.t * 14) * 0.6 * (1 - c.flop); c.J.legR.rotation.x = -c.J.legL.rotation.x;
            if (c.t <= 0) {
                this.parts.burst(c.x, c.y + 0.3, c.z, 40, CONFETTI, 5, 0.1, 2.2, 3, 2.5, 7, 3);
                this.root.remove(c.J.root);
            }
        }
        this.corpses = this.corpses.filter((c) => c.t > 0);
    }

    /* ---------- projectiles ---------- */
    updProj(dt) {
        const seen = new Set();
        for (const p of this.W.proj) {
            seen.add(p.id);
            let m = this.projV.get(p.id);
            if (!m) { m = projModel(p.type, p.id); this.projV.set(p.id, m); this.root.add(m); if (p.type === 'blob') m.scale.setScalar(0.7 + (p.size || 0) * 0.8); }
            m.position.set(p.x, p.y, p.z);
            if (p.type === 'rocket') {
                m.lookAt(p.x - p.vx, p.y - p.vy, p.z - p.vz);
                if (Math.random() < 0.8) this.parts.add(p.x - p.vx * 0.012, p.y - p.vy * 0.012, p.z - p.vz * 0.012, rnd(-0.5, 0.5), rnd(0, 1), rnd(-0.5, 0.5), Math.random() < 0.5 ? [1, 1, 1] : [0.95, 0.85, 0.7], 0.12, 0.5, -1, 2);
            } else if (p.type === 'balloon' || p.type === 'bigballoon') {
                const w = Math.sin(this.t * 18 + p.id) * 0.12;
                m.scale.set(1 + w, 1 - w, 1 + w);
            } else if (p.type === 'blob' && Math.random() < 0.5) {
                this.parts.add(p.x, p.y, p.z, rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4), WATER[0], 0.06, 0.4, 9);
            } else if (p.type === 'acorn') m.rotation.x += dt * 20;
        }
        for (const [id, m] of this.projV) if (!seen.has(id)) { this.root.remove(m); this.projV.delete(id); }
    }
    /* ---------- pickups ---------- */
    makeItem(it) {
        const g = new THREE.Group();
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.06, 12), dyn('#2a2e36'));
        pad.position.y = 0.03; pad.receiveShadow = true; g.add(pad);
        const ring = glows(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 4, 16), new THREE.MeshBasicMaterial({ color: ITEM_COL[it.type[0]] })));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.07; g.add(ring);
        const m = itemModel(it.type); g.add(m);
        g.position.set(it.x, it.y, it.z);
        this.root.add(g);
        this.itemV.set(it.id, { g, m, ring, phase: it.id * 1.7 });
    }
    updItems(dt) {
        for (const it of this.W.items) {
            const v = this.itemV.get(it.id);
            if (!v) continue;
            const up = it.t <= 0;
            v.m.visible = up;
            v.m.position.y = 0.75 + Math.sin(this.t * 2.2 + v.phase) * 0.1;
            v.m.rotation.y = this.t * 1.6 + v.phase;
            v.ring.material.color.set(up ? ITEM_COL[it.type[0]] : '#2a3139');
            if (up && it.type[0] === 'p' && Math.random() < dt * 8) this.parts.add(it.x + rnd(-0.4, 0.4), it.y + 0.4, it.z + rnd(-0.4, 0.4), 0, 1.2, 0, [0.8, 0.4, 1], 0.07, 0.9, -0.5, 0.5);
        }
    }
    updTraps(dt) {
        const seen = new Set();
        for (const tr of this.W.traps) {
            seen.add(tr.id);
            let m = this.trapV.get(tr.id);
            if (!m) { m = trapModel(); m.position.set(tr.x, tr.y, tr.z); m.rotation.y = tr.yaw; this.root.add(m); this.trapV.set(tr.id, m); }
        }
        for (const [id, m] of this.trapV) if (!seen.has(id)) {
            // the handle swings up as it goes
            m.userData.gone = (m.userData.gone || 0) + dt;
            m.userData.handle.rotation.x = Math.min(1.3, m.userData.gone * 14);
            if (m.userData.gone > 0.6) { this.root.remove(m); this.trapV.delete(id); }
        }
    }
    updPuddles() {
        const seen = new Set();
        for (const p of this.W.puddles) {
            seen.add(p.id);
            let m = this.pudV.get(p.id);
            if (!m) { m = puddleModel(p.r); m.position.set(p.x, p.y + 0.03, p.z); this.root.add(m); this.pudV.set(p.id, m); }
            m.material.opacity = Math.min(0.55, (p.life == null ? 10 : p.life) * 0.2);
        }
        for (const [id, m] of this.pudV) if (!seen.has(id)) { this.root.remove(m); this.pudV.delete(id); }
    }
    updCars(dt) {
        const seen = new Set();
        for (const c of this.W.cars) {
            seen.add(c.id);
            let m = this.carV.get(c.id);
            if (!m) { m = carModel(); this.root.add(m); this.carV.set(c.id, m); }
            m.position.set(c.x, c.y, c.z); m.rotation.y = c.yaw;
            if (Math.random() < 0.5) this.parts.add(c.x + Math.sin(c.yaw) * 0.3, c.y + 0.1, c.z + Math.cos(c.yaw) * 0.3, rnd(-0.3, 0.3), 0.5, rnd(-0.3, 0.3), [0.5, 0.5, 0.52], 0.06, 0.5, -0.5, 2);
        }
        for (const [id, m] of this.carV) if (!seen.has(id)) { this.root.remove(m); this.carV.delete(id); }
    }
    updVehicles(dt) {
        const seen = new Set();
        for (const v of this.W.vehicles) {
            seen.add(v.id);
            let m = this.vehV.get(v.id);
            if (!m) {
                const probe = { value: new THREE.Color(0.4, 0.4, 0.42) }, rim = { value: new THREE.Color(0, 0, 0) };
                // turn round the middle of the body, not the ground under it
                const inner = vehicleModel(v.type, probe, rim), cm = VEHICLES[v.type].h * 0.45;
                inner.position.y = -cm;
                m = new THREE.Group(); m.add(inner);
                // whose it is: a pennant on a whip antenna at the back (a rim light filled whole flat panels with team colour)
                const V = VEHICLES[v.type], pen = new THREE.Group();
                const pole = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 0.03), new THREE.MeshBasicMaterial({ color: '#2a2a30' })); pole.position.y = 0.55;
                const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); cloth.position.set(0, 1.0, 0.22); cloth.rotation.y = Math.PI / 2;
                pen.add(pole, cloth); pen.position.set(V.w * 0.4, V.h * 0.75, V.l * 0.45); inner.add(pen);
                m.userData = Object.assign(inner.userData, { probe, rim, pt: 0, cm, pen, cloth });
                this.root.add(m); this.vehV.set(v.id, m);
            }
            m.visible = !v.dead;
            if (v.dead) continue;
            m.position.set(v.x, v.y + m.userData.cm, v.z); m.rotation.set(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ');
            const U = m.userData;
            U.pt -= dt;
            if (U.pt <= 0 && this.lighting) { U.pt = 0.3; const p = this.lighting.probe(v.x, v.y + 1, v.z); U.probe.value.setRGB(Math.max(0.2, p[0]), Math.max(0.2, p[1]), Math.max(0.22, p[2])); }
            U.pen.visible = v.team >= 0;
            if (v.team >= 0) U.cloth.material.color.set(TEAMS[v.team].col);
            U.cloth.rotation.y = Math.PI / 2 + Math.sin(this.t * 6 + (+v.id || 0)) * 0.3;
            const sp = (v.vx || 0) * -Math.sin(v.yaw) + (v.vz || 0) * -Math.cos(v.yaw);
            for (const [w, r] of U.wheels) w.rotation.x -= sp * dt / r;
            if (U.turret) { const g = v.seats[1] && this.W.byId(v.seats[1]); if (g) U.turret.rotation.y = g.yaw - v.yaw; }
            const kd = v.mk && v.mk.dir ? v.mk.dir * (v.mk.tier + 1) : v.kd || 0;
            if (kd && v.ground !== false) {
                const col = [[1, 0.91, 0.63], [0.23, 0.82, 1], [1, 0.29, 0.16], [0.77, 0.29, 1]][Math.abs(kd) - 1], V2 = VEHICLES[v.type];
                for (const sx of [-1, 1]) {
                    const ox = Math.cos(v.yaw) * sx * V2.w * 0.45 + Math.sin(v.yaw) * V2.l * 0.4, oz = -Math.sin(v.yaw) * sx * V2.w * 0.45 + Math.cos(v.yaw) * V2.l * 0.4;
                    if (Math.random() < 0.8) this.parts.add(v.x + ox, v.y + 0.08, v.z + oz, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, col, 0.06, 0.3, 9, 3);
                }
            }
            if (Math.hypot(v.vx || 0, v.vz || 0) > 4 && Math.random() < 0.5) this.parts.add(v.x + (Math.random() - 0.5), v.y + 0.1, v.z + (Math.random() - 0.5), 0, 0.6, 0, v.type === 'mower' ? [0.4, 0.62, 0.25] : [0.6, 0.56, 0.5], 0.08, 0.5, 2, 2);
        }
        for (const [id, m] of this.vehV) if (!seen.has(id)) { this.root.remove(m); this.vehV.delete(id); }
    }
    updFlags() {
        this.W.flags.forEach((f, i) => {
            const m = this.flagV[i]; if (!m) return;
            const c = f.v < 0 ? TEAMS[0].col : f.v > 0 ? TEAMS[1].col : '#f4f0e8';
            m.userData.cloth.material.color.set(c);
            m.userData.cloth.position.y = 1.2 + Math.abs(f.v) * 4.2;
            m.userData.cloth.rotation.y = Math.sin(this.t * 3 + i) * 0.25;
            m.userData.ring.material.color.set(f.contested && Math.floor(this.t * 4) % 2 ? '#ffe23a' : f.owner === 0 ? TEAMS[0].col : f.owner === 1 ? TEAMS[1].col : '#f4f0e8');
        });
    }
    updDrops() {
        const seen = new Set();
        for (const d of this.W.drops) {
            seen.add(d.id);
            let m = this.dropV.get(d.id);
            if (!m) { m = itemModel(d.kind === 'kit' ? 'h:kit' : 'a:rocket'); this.root.add(m); this.dropV.set(d.id, m); }
            m.position.set(d.x, d.y + 0.35 + Math.sin(this.t * 3 + d.id) * 0.06, d.z); m.rotation.y = this.t * 1.5;
        }
        for (const [id, m] of this.dropV) if (!seen.has(id)) { this.root.remove(m); this.dropV.delete(id); }
    }
    flash(x, y, z, r, col, t = 0.18) {
        const m = glows(new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({ color: col })));
        m.position.set(x, y, z); m.scale.setScalar(r);
        this.root.add(m);
        this.flashes.push({ m, t, max: t, r });
    }

    /* ---------- effects for world events ---------- */
    event(e, W, sfx) {
        const P = this.parts;
        const A = (id) => W.byId(id);
        const at = (a) => (a ? [a.x, a.y + 1, a.z] : null);
        const local = this.local;
        switch (e.t) {
            case 'fire': {
                const a = A(e.id); if (!a) break;
                const eye = W.eye(a), me = e.id === local;
                const S = { swing: 'swing', whack: 'whack', slice: 'slice', lunge: 'swing', sweep: 'swing', trap: 'trapset', crack: 'crack', grab: 'grab', squirt: 'squirt', blob: 'blob', throw: 'throw', spray: 'spray', blast: 'blast', pitch: 'pitch', bat: e.homerun ? 'homerun' : 'swing', serve: 'serve', lob: 'lob', rocket: 'rocket', load: 'load', drive: 'drive', deploy: 'deploy' }[e.k];
                if (S) sfx.play(S, me ? null : [eye[0], eye[1], eye[2]], me ? 0.7 : 1);
                if (me) this.vmFire(e);
                const mz = this.muzzleOf(a, me);
                if (e.k === 'squirt' && e.to) {
                    const dx = e.to[0] - mz[0], dy = e.to[1] - mz[1], dz = e.to[2] - mz[2], d = Math.hypot(dx, dy, dz) || 1;
                    for (let i = 0; i < 3; i++) { const s = 34 + i * 4; P.add(mz[0], mz[1], mz[2], dx / d * s, dy / d * s + 1, dz / d * s, WATER[i % 3], 0.05, d / s, 3, 0); }
                    if (e.wall || d < 59) P.burst(e.to[0], e.to[1], e.to[2], 3, WATER, 2.5, 0.05, 0.4, 9, 2);
                } else if ((e.k === 'drive' || e.k === 'crack' || e.k === 'grab') && e.to) {
                    const dx = e.to[0] - mz[0], dy = e.to[1] - mz[1], dz = e.to[2] - mz[2], d = Math.hypot(dx, dy, dz);
                    const n = Math.min(80, Math.ceil(d * (e.k === 'drive' ? 2.5 : 5)));
                    const col = e.k === 'drive' ? [1, 1, 1] : [0.45, 0.3, 0.2];
                    for (let i = 0; i <= n; i++) { const t = i / n; P.add(mz[0] + dx * t, mz[1] + dy * t, mz[2] + dz * t, 0, 0, 0, col, e.k === 'drive' ? 0.05 : 0.035, e.k === 'drive' ? 0.25 + t * 0.15 : 0.15, 0, 0); }
                    if (e.k === 'drive') { P.burst(e.to[0], e.to[1], e.to[2], 8, [[1, 1, 1], [0.8, 0.8, 0.8]], 3, 0.07, 0.4, 4, 3); if (e.head) sfx.play('headhit', e.to, 1.2); }
                    if (e.k === 'crack') P.burst(e.to[0], e.to[1], e.to[2], 5, [[1, 1, 0.8]], 3, 0.05, 0.25, 0, 3);
                } else if (e.k === 'spray') {
                    const d = W.aim(a); for (let i = 0; i < 10; i++) P.add(mz[0], mz[1], mz[2], d[0] * 8 + rnd(-2, 2), d[1] * 8 + rnd(-1, 2), d[2] * 8 + rnd(-2, 2), i % 2 ? [0.4, 0.6, 0.2] : [0.6, 0.45, 0.2], 0.07, 0.6, 6, 2, 4);
                } else if (e.k === 'blast') {
                    const d = W.aim(a); for (let i = 0; i < 24; i++) { const s = rnd(6, 16); P.add(mz[0], mz[1], mz[2], d[0] * s + rnd(-2.5, 2.5), d[1] * s + rnd(-2, 2), d[2] * s + rnd(-2.5, 2.5), i % 3 ? [0.75, 0.75, 0.72] : [0.5, 0.6, 0.3], 0.08, 0.45, 0, 3); }
                } else if (e.k === 'rocket') this.flash(mz[0], mz[1], mz[2], 0.25, '#ffe8c0', 0.08);
                break;
            }
            case 'proj': break;
            case 'burst': {
                const big = e.big, col = { blob: WATER, balloon: WATER, bigballoon: WATER, acorn: [[0.5, 0.35, 0.2], [0.55, 0.55, 0.52]], baseball: [[1, 1, 1]], tennis: [[0.85, 0.95, 0.25]], lob: [[0.85, 0.95, 0.25]], rocket: CONFETTI }[e.type] || CONFETTI;
                if (e.type === 'rocket') {
                    P.burst(e.x, e.y, e.z, 60, CONFETTI, 9, 0.1, 1.8, 4, 2.4, 6, 2);
                    P.burst(e.x, e.y, e.z, 20, [[1, 1, 1], [0.9, 0.85, 0.75]], 5, 0.18, 0.7, -1, 3);
                    this.flash(e.x, e.y, e.z, 1.4, '#fff0c8', 0.2);
                    sfx.play('boom', [e.x, e.y, e.z]);
                } else if (e.type === 'balloon' || e.type === 'bigballoon') {
                    P.burst(e.x, e.y, e.z, e.type === 'bigballoon' ? 60 : 40, WATER, 7, 0.08, 0.9, 12, 1.2);
                    sfx.play('pop', [e.x, e.y, e.z]);
                } else if (e.type === 'blob') { P.burst(e.x, e.y, e.z, 22, WATER, 5, 0.07, 0.7, 12, 1.2); sfx.play('splash', [e.x, e.y, e.z], 0.8); }
                else { P.burst(e.x, e.y, e.z, big ? 20 : 5, col, big ? 6 : 2.5, 0.06, 0.4, 9, 2); if (e.type === 'baseball' && e.hit) sfx.play('bat', [e.x, e.y, e.z], 0.6); }
                break;
            }
            case 'bounce': sfx.play(e.type === 'acorn' ? 'clang' : 'bounce', [e.x, e.y, e.z], 0.5); break;
            case 'deflect': P.burst(e.x, e.y, e.z, 8, [[1, 1, 0.6]], 4, 0.06, 0.3, 0, 3); if (e.homerun) sfx.play('homerun', [e.x, e.y, e.z]); break;
            case 'hurt': {
                const a = A(e.id); if (!a) break;
                P.burst(a.x, a.y + a.h * 0.7, a.z, e.head ? 10 : 5, e.head ? [[1, 0.95, 0.3], [1, 1, 1]] : [[1, 0.9, 0.3], [1, 0.6, 0.2]], 3, 0.06, 0.4, 3, 3);
                if (e.id !== local) sfx.play('hurt', at(a), 0.5);
                break;
            }
            case 'kill': this.corpse(e); sfx.play('die', [e.x, e.y + 1, e.z]); break;
            case 'spawn': { const a = A(e.id); if (a) P.burst(e.x, e.y + 1, e.z, 16, [[0.6, 0.9, 1], [1, 1, 1]], 2, 0.07, 0.6, -2, 2); if (e.id !== local) sfx.play('spawn', [e.x, e.y + 1, e.z], 0.6); break; }
            case 'pickup': {
                const it = W.items[e.id]; if (!it) break;
                const k = it.type[0];
                sfx.play(k === 'h' ? 'health' : k === 'r' ? 'armor' : k === 'p' ? 'power' : k === 'w' ? 'weapon' : 'pickup', e.by === local ? null : [it.x, it.y + 1, it.z], e.by === local ? 0.8 : 0.5);
                P.burst(it.x, it.y + 0.8, it.z, 10, [[1, 1, 1]], 2, 0.05, 0.4, 0, 3);
                break;
            }
            case 'itemback': { const it = W.items[e.id]; if (it) { P.burst(it.x, it.y + 0.7, it.z, 8, [[0.8, 1, 0.9]], 1.5, 0.05, 0.5, -1, 2); sfx.play('pickup', [it.x, it.y + 1, it.z], 0.25); } break; }
            case 'jump': if (e.id !== local) sfx.play('jump', at(A(e.id)), 0.6); else sfx.play('jump', null, 0.35); break;
            case 'land': { const a = A(e.id); if (a) { sfx.play('land', e.id === local ? null : at(a), 0.6); P.burst(a.x, a.y + 0.05, a.z, 6, [[0.5, 0.5, 0.5]], 1.5, 0.06, 0.4, 0, 3); if (e.id === local) this.vmState.land = Math.min(1, e.v / 14); } break; }
            case 'slide': { const a = A(e.id); if (a) sfx.play('slide', e.id === local ? null : at(a), 0.8); break; }
            case 'slidejump': case 'dodge': { const a = A(e.id); if (a) sfx.play('dodge', e.id === local ? null : at(a), 0.7); break; }
            case 'tramp': sfx.play('tramp', [e.x, e.y + 0.5, e.z]); P.burst(e.x, e.y + 0.4, e.z, 12, [[0.25, 0.5, 1], [1, 0.85, 0.3]], 3, 0.07, 0.5, 4, 2); break;
            case 'trap': sfx.play('trap', [e.x, e.y + 0.5, e.z]); P.burst(e.x, e.y + 1.2, e.z, 12, [[1, 0.95, 0.3]], 3, 0.08, 0.6, 0, 2, 6); break;
            case 'carboom':
                P.burst(e.x, e.y + 0.3, e.z, 140, CONFETTI, 12, 0.12, 2.4, 4, 2, 7, 3);
                P.burst(e.x, e.y + 0.3, e.z, 30, [[1, 1, 1], [0.9, 0.85, 0.75]], 7, 0.25, 0.9, -1, 2);
                this.flash(e.x, e.y + 0.4, e.z, 3, '#fff0c8', 0.3);
                sfx.play('bigboom', [e.x, e.y, e.z]);
                break;
            case 'switch': if (e.id === local) sfx.play('switch', null, 0.6); break;
            case 'flashbang':
                P.burst(e.x, e.y, e.z, 90, CONFETTI, 8, 0.1, 1.8, 3, 2.2, 7, 2);
                this.flash(e.x, e.y, e.z, 2.2, '#ffffff', 0.25);
                sfx.play('pop', [e.x, e.y, e.z], 1.2); sfx.play('bigmedal', [e.x, e.y, e.z], 0.4);
                break;
            case 'cloud': sfx.play('blast', [e.c.x, e.c.y, e.c.z], 0.6); break;
            case 'vboom':
                P.burst(e.x, e.y, e.z, 120, CONFETTI, 11, 0.12, 2.2, 4, 2, 7, 3);
                P.burst(e.x, e.y, e.z, 26, [[1, 1, 1], [0.9, 0.85, 0.75]], 6, 0.25, 0.9, -1, 2);
                this.flash(e.x, e.y, e.z, 2.6, '#fff0c8', 0.3);
                sfx.play('bigboom', [e.x, e.y, e.z]);
                break;
            case 'vhurt': { const v = W.vehicle(e.id); if (v) { P.burst(v.x, v.y + 1, v.z, 4, [[1, 0.9, 0.5], [0.8, 0.8, 0.8]], 3, 0.06, 0.3, 6, 2); sfx.play('clang', [v.x, v.y + 1, v.z], 0.8); } break; }
            case 'vcrash': sfx.play('land', [e.x, e.y, e.z], 1); sfx.play('clang', [e.x, e.y + 0.5, e.z], 1); break;
            case 'enter': case 'exit': { const a = A(e.id); if (a) sfx.play('switch', e.id === local ? null : at(a), 0.8); break; }
            case 'flag': sfx.play(e.owner === -1 ? 'tick' : 'power', null, 0.6); break;
            case 'drop': sfx.play('throw', [e.d.x, e.d.y + 1, e.d.z]); break;
            case 'dropped': sfx.play('health', null, e.by === local ? 0.8 : 0); break;
        }
    }
    muzzleOf(a, me) {
        if (me) {
            const v = new THREE.Vector3(0.18, -0.12, -0.6).applyQuaternion(this.camQ || new THREE.Quaternion());
            const e = this.W.eye(a);
            return [e[0] + v.x, e[1] + v.y, e[2] + v.z];
        }
        const e = this.W.eye(a), d = this.W.aim(a), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
        return [e[0] + d[0] * 0.6 + rx * 0.25, e[1] - 0.2 + d[1] * 0.6, e[2] + d[2] * 0.6 + rz * 0.25];
    }

    /* ---------- first person ---------- */
    vmFire(e) {
        const kick = { squirt: 0.15, blob: 0.6, throw: 0.4, spray: 1, blast: 0.8, pitch: 0.5, serve: 0.12, lob: 0.3, rocket: 1, drive: 0.2, deploy: 0.3, crack: 0.3, grab: 0.4 }[e.k];
        if (kick) this.vmState.kick = Math.min(1.2, this.vmState.kick + kick);
    }
    updateVM(dt, a, cam, opts) {
        const vm = this.vm, S = this.vmState;
        this.camQ = cam.quaternion;
        const seat = a && a.veh && this.W.vehicleSeat ? this.W.vehicleSeat(a) : null;
        const driving = !!(seat && !seat.gun && !seat.turret);
        document.body.classList.toggle('driving', driving);
        const show = a && a.alive && !a.car && !driving && !(seat && seat.turret) && !(a.cur === 'golf' && a.zoom) && opts.show;
        vm.visible = !!show;
        if (!show) return;
        const v = this.vis.get(a.id);
        if (v) this.vmProbe.value.copy(v.probe.value);
        const key = a.cur + (a.dual ? '2' : '') + (a.char || 0);
        if (this.vmKey !== key) {
            vm.clear();
            const w = weaponModel(a.cur, { probe: this.vmProbe, dual: a.dual, col: '#ff4a6a' });
            const ch = CHARS[a.char % CHARS.length];
            // a hand and a sleeve holding it
            const hand = new THREE.Group();
            const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.42), dyn(ch.id === 'lifeguard' || ch.id === 'coach' ? ch.skin : ch.top, this.vmProbe));
            sleeve.position.set(0.02, -0.07, 0.28);
            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.11), dyn(ch.extra === 'gloves' ? '#4a7a3a' : ch.skin, this.vmProbe));
            fist.position.set(0, -0.02, 0.04);
            hand.add(sleeve, fist, w);
            const H = HOLD[a.cur] || HOLD.pistol;
            hand.userData.base = H;
            hand.scale.setScalar(H[2]);
            vm.add(hand);
            this.vmHand = hand; this.vmW = w; this.vmKey = key;
            S.lower = 1;
        }
        const H = this.vmHand.userData.base;
        // bob, sway, kick, swings, switching
        const hs = Math.hypot(a.vx, a.vz), k = a.ground && a.slideT <= 0 ? clamp(hs / 9, 0, 1) : 0;
        S.bob = a.walk * 2.1;
        let dyaw = a.yaw - S.lastYaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        S.sx = lerp(S.sx, clamp(dyaw * 3, -0.08, 0.08), Math.min(1, dt * 10));
        S.sy = lerp(S.sy, clamp((a.pitch - S.lastPitch) * 3, -0.06, 0.06), Math.min(1, dt * 10));
        S.lastYaw = a.yaw; S.lastPitch = a.pitch;
        S.kick = Math.max(0, S.kick - dt * 6);
        S.land = Math.max(0, S.land - dt * 4);
        const lowerTo = a.next ? 1 : 0;
        S.lower = lerp(S.lower, lowerTo, Math.min(1, dt * 14));
        let px = H[0][0] + Math.sin(S.bob) * 0.012 * k + S.sx, py = H[0][1] - Math.abs(Math.cos(S.bob)) * 0.014 * k - S.sy - S.lower * 0.35 - S.land * 0.06, pz = H[0][2] + S.kick * 0.07;
        let rx = H[1][0] + S.kick * 0.25, ry = H[1][1] + S.sx * 2, rz = H[1][2] + (a.slideT > 0 ? 0.35 : 0);
        if (a.swing > 0) {
            const dur = a.swingK ? 0.5 : 0.3, t = 1 - a.swing / dur, s = Math.sin(t * Math.PI);
            if (a.swingK) { rx += 1.2 - t * 2.4; py += s * 0.1; pz -= s * 0.15; }
            else { ry += 0.9 - t * 2.0; px -= s * 0.22; pz -= s * 0.12; rz -= s * 0.5; }
        }
        if (a.cur === 'pistol' && a.charge > 0) { px += rnd(-1, 1) * 0.004 * a.charge; py += rnd(-1, 1) * 0.004 * a.charge; }
        if (a.cur === 'tennis' && this.vmW) this.vmW.rotation.z += dt * a.spin * 30;
        if (a.cur === 'rocket' && a.loaded) { py -= 0.02 * a.loaded; rx += 0.05 * a.loaded; }
        if (a.cur === 'balloon' && a.fireT > 0.1) py -= 0.3;
        if (a.cur === 'bat' && a.fireT > 0.3 && !a.swing) { px -= 0.05; }
        this.vmHand.position.set(px, py, pz);
        this.vmHand.rotation.set(rx, ry, rz);
        this.vmCam.position.copy(cam.position); this.vmCam.quaternion.copy(cam.quaternion);
        this.vm.position.copy(cam.position); this.vm.quaternion.copy(cam.quaternion);
        this.vmCam.aspect = cam.aspect; this.vmCam.updateProjectionMatrix();
    }
}

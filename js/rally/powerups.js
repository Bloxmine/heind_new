/* Power-ups: glowing pickup signs over the road, and what each one does when fired.
   Every effect is stylised: glowing shapes, hard halos from the glow pass, ink-black impact frames. */
import * as THREE from 'three';
import { glows, GLOW } from './retro.js';

export const PU = {
    volt: { name: 'VOLT', col: '#3ad0ff', ammo: 3, hint: 'three homing bolts' },
    seeker: { name: 'SEEKER', col: '#b04aff', hint: 'hunts the car ahead' },
    nitro: { name: 'NITRO', col: '#4aff7a', hint: 'a burst of speed' },
    barrier: { name: 'BARRIER', col: '#ffe23a', hint: 'blocks one hit' },
    patch: { name: 'PATCH', col: '#7affd0', hint: 'repairs your car' },
    mine: { name: 'MINE', col: '#ff3a6e', hint: 'drop behind, or throw ahead' },
    pulse: { name: 'PULSE', col: '#ff9a3a', hint: 'shoves nearby cars away' }
};
const WEIGHTS = { volt: 4, seeker: 2, nitro: 3, barrier: 2, patch: 1.5, mine: 2.5, pulse: 2 };
export const randomType = () => {
    let r = Math.random() * Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    for (const [k, w] of Object.entries(WEIGHTS)) if ((r -= w) <= 0) return k;
    return 'volt';
};

/* ---------- pixel icons ---------- */
function drawIcon(x, type, col) {
    const P = (pts) => pts.forEach(([a, b, w = 1, h = 1]) => x.fillRect(a, b, w, h));
    x.fillStyle = col;
    switch (type) {
        case 'volt': P([[9, 2, 3, 1], [8, 3, 3, 1], [7, 4, 3, 1], [6, 5, 3, 1], [5, 6, 3, 1], [5, 7, 7, 1], [8, 8, 3, 1], [7, 9, 3, 1], [6, 10, 3, 1], [5, 11, 3, 1], [5, 12, 2, 1], [4, 13, 2, 1]]); break;
        case 'seeker':
            P([[6, 2, 4, 1], [4, 3, 2, 1], [10, 3, 2, 1], [3, 4, 1, 2], [12, 4, 1, 2], [2, 6, 1, 4], [13, 6, 1, 4], [3, 10, 1, 2], [12, 10, 1, 2], [4, 12, 2, 1], [10, 12, 2, 1], [6, 13, 4, 1]]);
            P([[7, 6, 2, 4], [6, 7, 4, 2], [7, 0, 2, 2], [7, 14, 2, 2], [0, 7, 2, 2], [14, 7, 2, 2]]); break;
        case 'nitro': for (const y of [2, 7]) P([[7, y, 2, 1], [6, y + 1, 4, 1], [5, y + 2, 2, 1], [9, y + 2, 2, 1], [4, y + 3, 2, 1], [10, y + 3, 2, 1], [3, y + 4, 2, 1], [11, y + 4, 2, 1]]); break;
        case 'barrier': P([[3, 2, 10, 1], [3, 3, 1, 6], [12, 3, 1, 6], [4, 9, 1, 2], [11, 9, 1, 2], [5, 11, 1, 1], [10, 11, 1, 1], [6, 12, 4, 1], [7, 13, 2, 1], [5, 4, 6, 1], [5, 5, 1, 4], [7, 6, 2, 3]]); break;
        case 'patch': P([[6, 2, 4, 12], [2, 6, 12, 4]]); x.fillStyle = '#0a0d12'; P([[7, 3, 2, 10], [3, 7, 10, 2]]); x.fillStyle = col; P([[7, 7, 2, 2]]); break;
        case 'mine': P([[5, 5, 6, 6], [4, 6, 8, 4], [6, 4, 4, 8], [7, 1, 2, 3], [7, 12, 2, 3], [1, 7, 3, 2], [12, 7, 3, 2], [3, 3, 2, 2], [11, 3, 2, 2], [3, 11, 2, 2], [11, 11, 2, 2]]); x.fillStyle = '#0a0d12'; P([[7, 7, 2, 2]]); break;
        case 'pulse': P([[6, 7, 4, 2], [7, 6, 2, 4]]); x.globalAlpha = 0.85; P([[4, 4, 1, 8], [11, 4, 1, 8], [4, 4, 8, 1], [4, 11, 8, 1]]); x.globalAlpha = 0.6; P([[1, 2, 1, 12], [14, 2, 1, 12], [2, 1, 12, 1], [2, 14, 12, 1]]); x.globalAlpha = 1; break;
    }
}
// A glowing sign: dark rounded plate, coloured rim, icon. 32x32, pixel-crisp.
const cache = {};
export function iconCanvas(type) {
    if (cache[type]) return cache[type];
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const col = PU[type].col;
    x.fillStyle = col; x.fillRect(3, 1, 26, 30); x.fillRect(1, 3, 30, 26); x.fillRect(2, 2, 28, 28);
    x.fillStyle = '#0a0d12'; x.fillRect(4, 3, 24, 26); x.fillRect(3, 4, 26, 24);
    x.save(); x.translate(8, 8); drawIcon(x, type, col); x.restore();
    return (cache[type] = c);
}
const texCache = {};
const iconTex = (type) => {
    if (texCache[type]) return texCache[type];
    const t = new THREE.CanvasTexture(iconCanvas(type));
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return (texCache[type] = t);
};
export const iconURL = (type) => iconCanvas(type).toDataURL();

/* ---------- pickups along the track ---------- */
export class Pickups {
    constructor(track, scene) {
        this.track = track; this.scene = scene;
        this.items = [];
        this.group = new THREE.Group();
        scene.add(this.group);
        const { S, N } = track;
        const geo = new THREE.PlaneGeometry(1.9, 1.9);
        for (const f of [0.1, 0.35, 0.6, 0.85]) {
            const i = Math.round(f * N) % N, s = S[i];
            for (const lane of [-0.3, 0, 0.3]) {
                const o = lane * s.w;
                const type = randomType();
                const mat = new THREE.MeshBasicMaterial({ map: iconTex(type), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, fog: false });
                const m = glows(new THREE.Mesh(geo, mat));
                const x = s.x + s.sx * o, z = s.z + s.sz * o;
                m.position.set(x, s.y + 1.5, z);
                const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ color: PU[type].col, fog: false, side: THREE.DoubleSide }));
                halo.position.z = -0.05; halo.layers.set(GLOW);
                m.add(halo);
                const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 20), new THREE.MeshBasicMaterial({ color: PU[type].col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
                ring.rotation.x = -Math.PI / 2; ring.position.set(x, s.y + 0.08, z);
                glows(ring);
                this.group.add(m, ring);
                this.items.push({ m, halo, ring, x, z, y: s.y + 1.5, type, off: 0, ph: Math.random() * 6 });
            }
        }
    }
    dispose() { this.scene.remove(this.group); }
    update(dt, t, cars, cam, onPick) {
        for (const p of this.items) {
            if (p.off > 0) {
                p.off -= dt;
                if (p.off <= 0) {
                    p.type = randomType(); p.m.material.map = iconTex(p.type); p.m.visible = true; p.ring.visible = true;
                    p.halo.material.color.set(PU[p.type].col); p.ring.material.color.set(PU[p.type].col);
                }
                continue;
            }
            p.m.position.y = p.y + Math.sin(t * 3 + p.ph) * 0.15;
            p.ring.scale.setScalar(1 + Math.sin(t * 4 + p.ph) * 0.12);
            p.m.lookAt(cam.position.x, p.m.position.y, cam.position.z);
            for (const c of cars) {
                if (c.wrecked > 0 || c.slots.length >= 3) continue;
                if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 2.4 * 2.4 && Math.abs(c.y + 0.8 - p.y) < 2.5) {
                    c.slots.push({ type: p.type, ammo: PU[p.type].ammo || 1 });
                    p.off = 7; p.m.visible = false; p.ring.visible = false;
                    c.flashAura(PU[p.type].col, 0.45);
                    onPick(c, p.type, p);
                    break;
                }
            }
        }
    }
}

/* ---------- weapons and effects ---------- */
const glowMat = (col, opts = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: col, fog: false }, opts));
const ahead = (me, other, N) => { const d = (other.q.prog - me.q.prog + N) % N; return d < N / 2 ? d : d - N; };

export class Weapons {
    constructor(scene, track, fx) {
        this.scene = scene; this.track = track; this.fx = fx;
        this.shots = []; this.mines = []; this.rings = [];
        this.geo = {
            volt: new THREE.OctahedronGeometry(0.5, 0).scale(0.5, 0.5, 2.2),
            seeker: new THREE.IcosahedronGeometry(0.55, 0),
            mine: new THREE.CylinderGeometry(0.55, 0.55, 0.25, 8),
            ring: new THREE.TorusGeometry(1, 0.18, 4, 32)
        };
    }
    // a jagged line in the glow layer, redrawn every frame so it crackles
    arc(col) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(10 * 3), 3));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, fog: false }));
        l.layers.enable(GLOW);
        l.frustumCulled = false;
        return l;
    }
    crackle(l) {
        const a = l.geometry.attributes.position;
        for (let i = 0; i < 10; i++) a.setXYZ(i, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.2, -2 + i * 0.45);
        a.needsUpdate = true;
    }
    clear() {
        [...this.shots, ...this.mines, ...this.rings].forEach((o) => this.scene.remove(o.m));
        this.shots = []; this.mines = []; this.rings = [];
    }
    // the best target in front (or behind) of a car: inside a cone, the closest
    pick(me, cars, back, cone = 0.6, range = 90) {
        let best = null, bd = Infinity;
        const fx = Math.sin(me.h) * (back ? -1 : 1), fz = Math.cos(me.h) * (back ? -1 : 1);
        for (const c of cars) {
            if (c === me || c.wrecked > 0) continue;
            const dx = c.x - me.x, dz = c.z - me.z, d = Math.hypot(dx, dz);
            if (d > range || d < 1) continue;
            const cos = (dx * fx + dz * fz) / d;
            if (cos < Math.cos(cone)) continue;
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }
    // the car just ahead (or behind) in the race order
    nextInRace(me, cars, back) {
        let best = null, bd = Infinity;
        const N = this.track.N;
        for (const c of cars) {
            if (c === me || c.wrecked > 0) continue;
            const d = ahead(me, c, N) * (back ? -1 : 1);
            if (d > 0 && d < bd) { bd = d; best = c; }
        }
        return best;
    }
    fire(car, back, cars) {
        const slot = car.slots[car.sel || 0];
        if (!slot || car.wrecked > 0) return false;
        const type = slot.type, fx = this.fx;
        car.flashAura(PU[type].col, type === 'nitro' ? 0.2 : 0.7);
        if (car.isPlayer) fx.tint(PU[type].col, type === 'nitro' ? 2.4 : 0.7);
        const f = back ? -1 : 1, hx = Math.sin(car.h) * f, hz = Math.cos(car.h) * f;
        const spawn = (kind, col, speed, extra) => {
            const m = glows(new THREE.Mesh(this.geo[kind], glowMat(col)));
            m.position.set(car.x + hx * 2.8, car.y + 0.9, car.z + hz * 2.8);
            this.scene.add(m);
            const s = Object.assign({ kind, m, owner: car, x: m.position.x, y: m.position.y, z: m.position.z, vx: hx * speed + car.vx, vz: hz * speed + car.vz, life: 2, hint: car.q.i }, extra);
            this.shots.push(s);
            return s;
        };
        if (type === 'volt') { const s = spawn('volt', '#3ad0ff', 95, { target: this.pick(car, cars, back, 0.5, 80), life: 1.3, turn: 2.2 }); s.arc = this.arc('#9ff0ff'); s.m.add(s.arc); fx.sound('zap'); }
        else if (type === 'seeker') { spawn('seeker', '#b04aff', 62, { target: this.nextInRace(car, cars, back) || this.pick(car, cars, back, 1.2, 200), life: 7, turn: 5 }); fx.sound('whoosh'); }
        else if (type === 'mine') {
            const m = glows(new THREE.Mesh(this.geo.mine, glowMat('#ff3a6e')));
            const d = back ? -3.2 : 16;
            const x = car.x + Math.sin(car.h) * d, z = car.z + Math.cos(car.h) * d;
            const q = this.track.query(x, z, car.q.i);
            m.position.set(x, q.y + 0.15, z);
            this.scene.add(m);
            this.mines.push({ m, x, z, y: q.y, owner: car, arm: 0.6, life: 45 });
            fx.sound('drop');
        }
        else if (type === 'pulse') {
            const m = glows(new THREE.Mesh(this.geo.ring, glowMat('#ff9a3a', { transparent: true })));
            m.rotation.x = Math.PI / 2; m.position.set(car.x, car.y + 0.6, car.z);
            this.scene.add(m);
            this.rings.push({ m, t: 0, x: car.x, z: car.z });
            for (const c of cars) {
                if (c === car || c.wrecked > 0) continue;
                const dx = c.x - car.x, dz = c.z - car.z, d = Math.hypot(dx, dz);
                if (d < 16) {
                    const k = (1 - d / 16) * 18 + 6;
                    this.hit(c, { by: car, kind: 'pulse', dmg: 10, push: [dx / (d || 1) * k, dz / (d || 1) * k], up: 3, spin: (Math.random() - 0.5) * 3 });
                }
            }
            fx.sound('pulse'); fx.burst(0.6);
        }
        else if (type === 'nitro') { car.nitro = 2.4; fx.sound('nitro'); if (car.isPlayer) fx.burst(0.8); }
        else if (type === 'barrier') { car.shield = 15; fx.sound('shield'); }
        else if (type === 'patch') { car.health = Math.min(100, car.health + 50); fx.sound('patch'); fx.sparkle(car, '#7affd0'); }
        if (--slot.ammo <= 0) { car.slots.splice(car.sel || 0, 1); car.sel = Math.min(car.sel || 0, Math.max(0, car.slots.length - 1)); }
        return type;
    }
    hit(c, o) {
        const fx = this.fx;
        if (c.invuln > 0 || c.wrecked > 0) return;
        if (c.shield > 0) { c.shield = 0; fx.sound('block'); fx.sparkle(c, '#ffe23a'); fx.event(c, o.by, 'blocked', o.kind); return; }
        c.health -= o.dmg * 100 / (c.spec.hp || 100);
        if (PU[o.kind]) { c.flashAura(PU[o.kind].col, 0.8); if (c.isPlayer) fx.tint(PU[o.kind].col, 0.6); }
        if (o.push) { c.vx += o.push[0]; c.vz += o.push[1]; }
        if (o.lat) { const rx = -Math.cos(c.h), rz = Math.sin(c.h); c.vx += rx * o.lat; c.vz += rz * o.lat; }
        if (o.slow) { c.vx *= o.slow; c.vz *= o.slow; }
        if (o.up) { c.vy = Math.max(c.vy, o.up); c.y += 0.05; c.ground = false; }
        if (o.spin) c.w += o.spin;
        if (o.flip) c.flipRate = o.flip;
        fx.event(c, o.by, 'hit', o.kind);
        if (c.health <= 0) { c.health = 0; c.wreck(); fx.event(c, o.by, 'wreck', o.kind); }
    }
    update(dt, cars, t) {
        const fx = this.fx;
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const s = this.shots[i];
            s.life -= dt;
            // home in on the target, if it is still around
            if (s.target && s.target.wrecked <= 0) {
                const dx = s.target.x - s.x, dz = s.target.z - s.z;
                const sp = Math.hypot(s.vx, s.vz);
                let a = Math.atan2(s.vx, s.vz);
                let want = Math.atan2(dx, dz) - a;
                while (want > Math.PI) want -= Math.PI * 2; while (want < -Math.PI) want += Math.PI * 2;
                a += Math.max(-s.turn * dt, Math.min(s.turn * dt, want));
                s.vx = Math.sin(a) * sp; s.vz = Math.cos(a) * sp;
            }
            s.x += s.vx * dt; s.z += s.vz * dt;
            const q = this.track.query(s.x, s.z, s.hint);
            s.hint = q.i;
            s.y += ((q.y + 0.9) - s.y) * Math.min(1, dt * 12);
            s.m.position.set(s.x, s.y, s.z);
            s.m.rotation.y = Math.atan2(s.vx, s.vz);
            if (s.kind === 'seeker') { s.m.rotation.x += dt * 8; s.m.scale.setScalar(1 + Math.sin(t * 30) * 0.15); }
            else s.m.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.3, 1);   // crackling bolt
            if (s.arc) this.crackle(s.arc);
            if (Math.random() < 0.6) fx.trail(s.x, s.y, s.z, s.kind === 'volt' ? '#3ad0ff' : '#b04aff');
            let done = s.life <= 0 || (s.kind !== 'seeker' && q.ad > q.wall + 1);
            for (const c of cars) {
                if (done || c === s.owner || c.wrecked > 0) continue;
                if ((c.x - s.x) ** 2 + (c.z - s.z) ** 2 < 2.3 * 2.3 && Math.abs(c.y + 0.7 - s.y) < 2) {
                    if (s.kind === 'volt') this.hit(c, { by: s.owner, kind: 'volt', dmg: 14, lat: (Math.random() < 0.5 ? -1 : 1) * 9, spin: (Math.random() < 0.5 ? -1 : 1) * 3, slow: 0.82 });
                    else this.hit(c, { by: s.owner, kind: 'seeker', dmg: 32, up: 9, flip: (Math.random() < 0.5 ? -1 : 1) * 9, slow: 0.45 });
                    fx.boom(s.x, s.y, s.z, s.kind === 'volt' ? '#3ad0ff' : '#b04aff', s.kind === 'volt' ? 0.6 : 1);
                    done = true;
                }
            }
            if (done) { this.scene.remove(s.m); this.shots.splice(i, 1); }
        }
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.arm -= dt; m.life -= dt;
            m.m.visible = Math.floor(t * 4) % 2 === 0 || m.arm > 0;
            m.m.rotation.y += dt * 2;
            let boom = m.life <= 0;
            for (const c of cars) {
                if (boom || c.wrecked > 0 || (c === m.owner && m.arm > -1.5)) continue;
                if (m.arm <= 0 && (c.x - m.x) ** 2 + (c.z - m.z) ** 2 < 2.5 * 2.5) {
                    this.hit(c, { by: m.owner, kind: 'mine', dmg: 26, up: 7.5, spin: (Math.random() - 0.5) * 6, slow: 0.55, flip: (Math.random() < 0.5 ? -1 : 1) * 6 });
                    fx.boom(m.x, m.y + 0.5, m.z, '#ff3a6e', 1);
                    boom = true;
                }
            }
            if (boom) { this.scene.remove(m.m); this.mines.splice(i, 1); }
        }
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.t += dt;
            r.m.scale.setScalar(1 + r.t * 40);
            r.m.material.opacity = Math.max(0, 1 - r.t * 2.5);
            if (r.t > 0.4) { this.scene.remove(r.m); this.rings.splice(i, 1); }
        }
    }
}

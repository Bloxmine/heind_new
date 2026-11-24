/* Conquest: capture flags, tickets, classes, things to throw, and vehicles (shopping carts, lawnmowers,
   golf carts, ice cream vans). These are extra methods on the World; sim.js calls into them. */
import { VEHICLES, CLASSES, WEAPONS } from './defs.js';
import { rayAABB } from './geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CAP_TIME = 7;          // seconds for one player to turn a neutral flag
const BLEED_T = 4;
// how hard each weapon hits vehicles
const VMUL = { rocket: 3, cone: 2, rc: 1.5, bat: 1, golf: 0.8, balloon: 0.6, tennis: 0.5, blower: 0.4, pistol: 0.3, noodle: 0.4, slicer: 0.5, rake: 0.5, whip: 0.3, trap: 0 };

export function installConquest(World) {
    const P = World.prototype;

    P.cqInit = function () {
        const C = this.map.conquest;
        this.cq = C;
        this.tickets = [this.ticketsStart, this.ticketsStart];
        this.flags = C.flags.map((f, i) => ({ i, id: f.id, name: f.name, x: f.x, y: f.y, z: f.z, r: f.r || 8, dy: f.dy || 5, v: f.owner === 0 ? -1 : f.owner === 1 ? 1 : 0, owner: f.owner != null ? f.owner : -1, contested: false, spawns: f.spawns }));
        this.bleedT = BLEED_T;
        this.drops = [];
        this.vehicles = C.vehicles.map(([type, x, y, z, yaw, team = -1]) => this.newVehicle(type, x, y, z, yaw, team));
    };
    P.newVehicle = function (type, x, y, z, yaw, team) {
        const S = VEHICLES[type];
        const v = { id: this.nextId++, type, team, home: team, sx: x, sy: y, sz: z, syaw: yaw, r: Math.max(S.w, S.l) * 0.4, h: S.h * 0.8, seats: S.seats.map(() => 0) };
        this.resetVehicle(v);
        return v;
    };
    P.resetVehicle = function (v) {
        Object.assign(v, { x: v.sx, y: v.sy + 0.1, z: v.sz, yaw: v.syaw, vx: 0, vy: 0, vz: 0, speed: 0, pitch: 0, roll: 0, pv: 0, rv: 0, tumble: 0, flipT: 0, air: 0, w: 0, steer: 0, nitro: 0, mk: null, hp: VEHICLES[v.type].hp, dead: false, respawnT: 0, idleT: 0, ground: false, team: v.home, crashT: 0, bladeT: 0 });
    };
    P.vehicle = function (id) { return this.vehicles && this.vehicles.find((v) => v.id === id); };

    /* ---------- the rules ---------- */
    P.cqStep = function (dt) {
        if (this.state !== 'play' && this.state !== 'warmup') return;
        const live = this.state === 'play';
        for (const f of this.flags) {
            let n0 = 0, n1 = 0;
            const who = [];
            for (const a of this.actors) {
                if (!a.alive || Math.abs(a.y - f.y) > f.dy || (a.x - f.x) ** 2 + (a.z - f.z) ** 2 > f.r * f.r) continue;
                if (a.team === 0) n0++; else n1++;
                who.push(a);
            }
            f.contested = !!(n0 && n1);
            f.n = [n0, n1];
            if (!live || f.contested || !(n0 || n1)) continue;
            const team = n0 ? 0 : 1, n = n0 || n1, dir = team === 0 ? -1 : 1;
            const before = f.v;
            f.v = clamp(f.v + dir * (1 + 0.5 * Math.min(3, n - 1)) / CAP_TIME * dt, -1, 1);
            if (f.v === before) continue;
            // neutralised: it crossed the middle away from its owner
            if ((f.owner === 0 && f.v > 0) || (f.owner === 1 && f.v < 0)) {
                f.owner = -1;
                this.emit({ t: 'flag', id: f.i, owner: -1, by: team });
                for (const a of who) if (a.team === team) { a.score += 50; this.emit({ t: 'cap', id: a.id, pts: 50, what: 'neutral', flag: f.i }); }
            }
            if ((f.v <= -1 && f.owner !== 0) || (f.v >= 1 && f.owner !== 1)) {
                f.owner = team;
                this.emit({ t: 'flag', id: f.i, owner: team, by: team });
                for (const a of who) if (a.team === team) { a.score += 150; this.emit({ t: 'cap', id: a.id, pts: 150, what: 'captured', flag: f.i }); }
            }
        }
        if (live) {
            // the team holding more flags drains the other's tickets
            this.bleedT -= dt;
            if (this.bleedT <= 0) {
                this.bleedT = BLEED_T;
                const c0 = this.flags.filter((f) => f.owner === 0).length, c1 = this.flags.filter((f) => f.owner === 1).length;
                if (c0 > c1) this.tickets[1] = Math.max(0, this.tickets[1] - (c0 - c1));
                else if (c1 > c0) this.tickets[0] = Math.max(0, this.tickets[0] - (c1 - c0));
            }
            if (this.tickets[0] <= 0 || this.tickets[1] <= 0) this.end();
        }
        // thrown kits and crates
        for (const d of this.drops) d.life -= dt;
        const gone = this.drops.filter((d) => d.life <= 0);
        if (gone.length) { for (const d of gone) this.emit({ t: 'dropgone', id: d.id }); this.drops = this.drops.filter((d) => d.life > 0); }
        this.stepVehicles(dt);
    };
    P.cqWinner = function () { return this.tickets[0] === this.tickets[1] ? -1 : this.tickets[0] > this.tickets[1] ? 0 : 1; };

    /* ---------- spawning: HQ or a flag you hold, with your class's kit ---------- */
    P.cqSpawnPoints = function (a) {
        const C = this.cq, at = a.spawnAt;
        const f = at != null && at !== 'hq' ? this.flags.find((q) => q.id === at) : null;
        if (f && f.owner === a.team && !f.contested) {
            if (f.spawns) return f.spawns;
            return Array.from({ length: 8 }, (_, i) => { const t = i / 8 * Math.PI * 2; return [f.x + Math.cos(t) * f.r * 0.6, f.y, f.z + Math.sin(t) * f.r * 0.6]; });
        }
        return C.hq[a.team].spawns;
    };
    P.cqPickSpawn = function (a) {
        const pts = this.cqSpawnPoints(a).slice().sort(() => Math.random() - 0.5);
        for (const p of pts) {
            const g = this.level.ground(p[0], p[2], 0.35, p[1] + 1.5);
            if (g < p[1] - 3) continue;
            if (this.level.blocked(p[0], g, p[2], 0.38, 1.8, 0.3)) continue;
            if (this.actors.some((b) => b !== a && b.alive && Math.hypot(b.x - p[0], b.z - p[2]) < 1)) continue;
            return [p[0], g, p[2]];
        }
        return this.cq.hq[a.team].spawns[0];
    };
    P.applyClass = function (a) {
        const K = CLASSES[clamp(a.cls | 0, 0, CLASSES.length - 1)];
        a.inv = { noodle: true }; a.ammo = {}; a.dual = !!K.dual; a.armor = K.armor || 0;
        let first = null;
        for (const [w, n] of Object.entries(K.kit)) { a.inv[w] = true; if (n !== true) a.ammo[w] = this.rules.fullAmmo ? WEAPONS[w].ammo[1] : n; if (!first && WEAPONS[w].ammo) first = w; }
        if (a.inv.rake) a.traps = 2;
        a.cur = first || 'noodle';
        a.specialT = 0;
    };
    // G: throw your class's thing in front of you
    P.special = function (a) {
        const K = CLASSES[a.cls | 0];
        if (!K.special || (a.specialT || 0) > 0 || a.veh) return;
        a.specialT = 14;
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        let x = a.x + fx * 1.4, z = a.z + fz * 1.4;
        if (this.level.blocked(x, a.y, z, 0.3, 0.6, 0.4)) { x = a.x; z = a.z; }
        const y = this.level.ground(x, z, 0.3, a.y + 0.6);
        const d = { id: this.nextId++, kind: K.special, team: a.team, owner: a.id, x, y: Math.max(y, a.y - 2), z, life: 25 };
        this.drops.push(d);
        this.emit({ t: 'drop', d: { ...d } });
    };
    P.takeDrops = function (a) {
        for (const d of this.drops) {
            if (d.life <= 0 || d.team !== a.team || Math.abs(a.x - d.x) > 1 || Math.abs(a.z - d.z) > 1 || Math.abs(a.y - d.y) > 1.6) continue;
            if (d.kind === 'kit') { if (a.hp >= 100) continue; a.hp = Math.min(100, a.hp + 45); }
            else {
                let any = false;
                for (const w of Object.keys(a.inv)) { const W = WEAPONS[w]; if (!W.ammo || w === 'rc') continue; const m = W.ammo[1]; if ((a.ammo[w] || 0) < m) { a.ammo[w] = Math.min(m, (a.ammo[w] || 0) + Math.ceil(m * 0.5)); any = true; } }
                if (!any) continue;
            }
            d.life = 0;
            this.emit({ t: 'dropped', id: d.id, by: a.id, kind: d.kind });
            const giver = this.byId(d.owner);
            if (giver && giver !== a) { giver.score += 20; this.emit({ t: 'cap', id: giver.id, pts: 20, what: d.kind === 'kit' ? 'healed' : 'resupplied' }); }
        }
    };

    /* ---------- vehicles ---------- */
    // a point relative to the vehicle: x right, z back
    const toWorld = (v, ox, oy, oz) => { const c = Math.cos(v.yaw), s = Math.sin(v.yaw); return [v.x + c * ox + s * oz, v.y + oy, v.z - s * ox + c * oz]; };
    const toLocal = (v, x, z) => { const dx = x - v.x, dz = z - v.z, c = Math.cos(v.yaw), s = Math.sin(v.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
    P.vToWorld = toWorld;
    P.inVehicleBox = function (v, x, y, z, pad = 0) {
        const S = VEHICLES[v.type], [lx, lz] = toLocal(v, x, z);
        return Math.abs(lx) < S.w / 2 + pad && Math.abs(lz) < S.l / 2 + pad && y > v.y - pad && y < v.y + S.h + pad;
    };
    P.useVehicle = function (a) {
        if (!a.alive) return;
        if (a.veh) { this.exitVehicle(a); return; }
        let best = null, bd = 2.4;
        for (const v of this.vehicles || []) {
            if (v.dead) continue;
            const S = VEHICLES[v.type], [lx, lz] = toLocal(v, a.x, a.z);
            const d = Math.max(0, Math.abs(lx) - S.w / 2) + Math.max(0, Math.abs(lz) - S.l / 2);
            if (d > bd || Math.abs(a.y - v.y) > 2) continue;
            const enemyIn = v.seats.some((id) => { const o = id && this.byId(id); return o && o.team !== a.team; });
            if (enemyIn || !v.seats.includes(0)) continue;
            best = v; bd = d;
        }
        if (!best) return;
        const i = best.seats[0] === 0 ? 0 : best.seats.indexOf(0);
        best.seats[i] = a.id; a.veh = best.id; a.seat = i;
        best.team = a.team; best.idleT = 0;
        a.slideT = 0; a.zoom = false;
        this.emit({ t: 'enter', id: a.id, v: best.id, seat: i });
    };
    P.exitVehicle = function (a, eject = false) {
        const v = this.vehicle(a.veh);
        a.veh = 0; a.shielded = false;
        if (!v) return;
        v.seats = v.seats.map((id) => (id === a.id ? 0 : id));
        const S = VEHICLES[v.type];
        for (const [ox, oz] of [[-(S.w / 2 + 0.7), 0], [S.w / 2 + 0.7, 0], [0, S.l / 2 + 0.8], [0, -(S.l / 2 + 0.8)], [0, 0]]) {
            const [x, , z] = toWorld(v, ox, 0, oz);
            const g = this.level.ground(x, z, 0.38, v.y + (ox || oz ? 1.2 : S.h + 0.5));
            const y = ox || oz ? g : v.y + S.h;
            if (g < v.y - 2.5 && (ox || oz)) continue;
            if (this.level.blocked(x, y, z, 0.38, 1.8, 0.4)) continue;
            a.x = x; a.y = y; a.z = z; break;
        }
        a.vx = v.vx * 0.5; a.vz = v.vz * 0.5; a.vy = eject ? 6 : 0; a.ground = !eject; a.h = 1.8; a.eyeH = 1.62;
        if (a.remote) this.emit({ t: 'spawn', id: a.id, x: a.x, y: a.y, z: a.z, yaw: a.yaw, seq: ++a.seq, keep: true });
        this.emit({ t: 'exit', id: a.id, v: v.id });
    };
    // riders sit where their seat is
    P.ride = function (a) {
        const v = this.vehicle(a.veh);
        if (!v || v.dead) { if (this.authority) this.exitVehicle(a); else a.veh = 0; return; }
        const S = VEHICLES[v.type], seat = S.seats[a.seat] || S.seats[0];
        const [x, y, z] = toWorld(v, ...seat.off);
        a.x = x; a.y = seat.push ? v.y : y - 0.45; a.z = z;
        a.vx = v.vx; a.vy = 0; a.vz = v.vz;
        a.ground = true; a.slideT = 0; a.crouch = false;
        a.h = seat.push ? 1.8 : 1.35; a.eyeH = a.h - 0.18;
        a.shielded = !!seat.shield;
    };
    P.stepVehicles = function (dt) {
        for (const v of this.vehicles) {
            const S = VEHICLES[v.type];
            if (v.dead) {
                v.respawnT -= dt;
                if (v.respawnT <= 0 && !this.vehicles.some((o) => o !== v && !o.dead && Math.hypot(o.x - v.sx, o.z - v.sz) < 3)) { this.resetVehicle(v); this.emit({ t: 'vspawn', id: v.id }); }
                continue;
            }
            const drv = v.seats[0] ? this.byId(v.seats[0]) : null;
            const anyone = v.seats.some((id) => id);
            // an abandoned vehicle far from home goes back after a while
            v.idleT = anyone ? 0 : v.idleT + dt;
            if (v.idleT > 45 && Math.hypot(v.x - v.sx, v.z - v.sz) > 12) { v.dead = true; v.respawnT = 2; this.emit({ t: 'vgone', id: v.id }); continue; }
            if (!anyone && v.idleT > 2) v.team = v.home;
            const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw), px = -fz, pz = fx;
            const I = drv ? drv.in : { mx: 0, mz: 0, jump: false, crouch: false };
            // on its roof or side, or still tumbling: no driving
            const upset = Math.abs(v.pitch) > 1.15 || Math.abs(v.roll) > 1.15;
            /* Driving: Gravel Riot's handling. W/S gas and brake (then reverse), Shift the handbrake, Space hops into a
               kart drift: steer during the hop (or keep holding and steer) and it locks into a carving slide; the
               longer and tighter, the hotter the sparks, and letting go gives a boost. */
            const thr = Math.max(0, clamp(I.mz, -1, 1)), brk = Math.max(0, -clamp(I.mz, -1, 1)), st0 = drv ? clamp(I.mx, -1, 1) : 0;
            const driftIn = !!(drv && I.jump), hand = !!(drv && I.crouch);
            v.steer = (v.steer || 0) + (st0 - (v.steer || 0)) * Math.min(1, dt * 10);
            v.nitro = Math.max(0, (v.nitro || 0) - dt);
            let vf = v.vx * fx + v.vz * fz, vr = v.vx * px + v.vz * pz;
            const spd = Math.abs(vf), fast = S.speed * 0.45;
            const mk = v.mk || (v.mk = { dir: 0, charge: 0, tier: 0, armed: false, held: false, pend: false });
            if (driftIn && !mk.held) mk.armed = true;
            if (!driftIn) mk.armed = false;
            mk.held = driftIn;
            if (mk.armed && !mk.dir && v.ground && spd > fast && vf > 0 && !upset) {
                mk.armed = false; mk.pend = true;
                v.vy = 3.2; v.ground = false;
                mk.dir = Math.abs(st0) > 0.15 ? Math.sign(st0) : 0;
            }
            if (!mk.dir && driftIn && !mk.armed && Math.abs(st0) > 0.3 && spd > fast && vf > 0 && (mk.pend || v.ground)) mk.dir = Math.sign(st0);
            if (mk.dir && (!driftIn || spd < S.speed * 0.3 || vf < 0 || upset)) {
                if (!driftIn && mk.tier > 0) { v.nitro = Math.max(v.nitro, [0, 0.6, 1.1, 1.7][mk.tier]); this.emit({ t: 'vboost', id: v.id, tier: mk.tier }); }
                mk.dir = 0; mk.charge = 0; mk.tier = 0; mk.pend = false;
            }
            if (v.ground) mk.pend = false;
            if (v.ground && v.tumble <= 0 && !upset) {
                if (mk.dir) {
                    const tight = clamp(v.steer * mk.dir, -1, 1);
                    mk.charge += dt * (0.75 + 0.55 * Math.max(0, tight));
                    mk.tier = mk.charge > 3.4 ? 3 : mk.charge > 2.0 ? 2 : mk.charge > 0.9 ? 1 : 0;
                }
                // turning: a kart drift carves into its corner; otherwise steering, with less lock at speed
                let wT;
                if (mk.dir) { const tight = clamp(v.steer * mk.dir, -1, 1); wT = -mk.dir * (0.5 + 0.9 * (tight + 1) / 2) * Math.min(1, spd / (S.speed * 0.5)) * (S.turn / 2.3); }
                else {
                    const lock = S.turn * (1.3 - 0.6 * Math.min(1, spd / S.speed)), turn = Math.min(1, spd / 3) * Math.sign(vf || 1);
                    wT = -v.steer * lock * turn * (hand && spd > 3 ? 1.45 : 1);
                }
                v.w = (v.w || 0) + (wT - (v.w || 0)) * Math.min(1, dt * (5 + 5 * S.grip / 7));
                v.yaw += v.w * dt;
                // gas, brakes, reverse, handbrake
                const top = S.speed * (v.nitro > 0 ? 1.35 : 1);
                if (v.nitro > 0) vf += S.accel * 1.2 * dt * Math.max(0, 1 - vf / top);
                if (thr > 0) { const k = vf < 0 ? 2.2 : clamp(1 - (vf / top) ** 2, 0, 1); vf += S.accel * thr * k * dt; }
                if (brk > 0) { if (vf > 0.5) vf -= S.accel * 2.2 * brk * dt; else vf = Math.max(-S.speed * 0.45, vf - S.accel * 0.7 * brk * dt); }
                if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * dt);
                vf -= vf * 0.06 * dt;
                if (!thr && !brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2 * dt);
                // sideways grip: the handbrake and drifts let the tail slide out
                const lat = (hand ? 1.3 : mk.dir ? 4.6 : 7.5) * S.grip / 7, before = vr;
                vr *= Math.exp(-lat * dt);
                vf -= Math.abs(before - vr) * (mk.dir ? 0.035 : 0.1) * Math.sign(vf);
                v.vx = fx * vf + px * vr; v.vz = fz * vf + pz * vr; v.speed = vf; v.slip = Math.abs(vr);
            } else if (!v.ground) { v.w = (v.w || 0) * (1 - dt * 0.5); v.yaw += v.w * dt; }
            else if (v.ground) { const k = Math.max(0, 1 - (v.tumble > 0 ? 0.6 : 3) * dt); v.vx *= k; v.vz *= k; v.speed *= k; }
            v.vy -= 22 * dt;
            const sp0 = Math.hypot(v.vx, v.vz), wasGround = v.ground;
            v.bump = false;
            const landed = Math.max(this.level.move(v, dt / 2, 0.7), this.level.move(v, dt / 2, 0.7));
            this.vehicleAttitude(v, S, dt, wasGround, landed, drv);
            v.crashT = Math.max(0, v.crashT - dt);
            if (v.bump) {
                if (sp0 > 7 && v.crashT <= 0) { v.crashT = 0.6; this.damageVehicle(v, (sp0 - 7) * 6, drv, v.type); this.emit({ t: 'vcrash', id: v.id, x: v.x, y: v.y, z: v.z }); }
                v.speed = v.vx * fx + v.vz * fz;
            }
            if (v.ground && v.on && v.on.tramp) { this.launch(v, v.on.tramp); v.ground = false; }
            if (v.y < (this.map.killY != null ? this.map.killY : -20)) { this.explodeVehicle(v, null); continue; }
            // running people over (and the mower's blades)
            const sp = Math.hypot(v.vx, v.vz);
            v.bladeT = Math.max(0, v.bladeT - dt);
            for (const b of this.actors) {
                if (!b.alive || b.veh === v.id || (drv && !this.enemies(drv, b))) continue;
                if (!this.inVehicleBox(v, b.x, b.y + 0.5, b.z, 0.35)) continue;
                if (sp > 4) {
                    const dmg = sp * (S.blades ? 11 : 7);
                    if (!b.runT || this.time - b.runT > 0.5) { b.runT = this.time; this.damage(b, dmg, drv, v.type, { kind: 'hit' }); this.impulse(b, v.vx * 0.8, 5, v.vz * 0.8); }
                } else if (S.blades && v.bladeT <= 0 && drv) { v.bladeT = 0.35; this.damage(b, 18, drv, v.type, { kind: 'melee' }); }
            }
        }
    };
    /* How the vehicle sits and moves in pitch and roll. On the ground it follows the ground under its four corners;
       with a corner over nothing it tips over the edge; in the air it keeps spinning; a hard or crooked landing
       bounces it and sets it tumbling; and if it ends up on its roof it rights itself after a while. */
    const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    P.vehicleAttitude = function (v, S, dt, wasGround, landed, drv) {
        const c = Math.cos(v.yaw), s = Math.sin(v.yaw), hw = S.w * 0.45, hl = S.l * 0.45;
        const gh = (ox, oz) => Math.max(v.y - 2.5, this.level.ground(v.x + c * ox + s * oz, v.z - s * ox + c * oz, 0.05, v.y + 0.9));
        if (v.ground) {
            v.air = 0;
            const fl = gh(-hw, -hl), fr = gh(hw, -hl), bl = gh(-hw, hl), br = gh(hw, hl);
            const tp = Math.atan2((fl + fr) / 2 - (bl + br) / 2, S.l * 0.9), tr = Math.atan2((fr + br) / 2 - (fl + bl) / 2, S.w * 0.9);
            if (v.tumble > 0) {
                v.tumble -= dt;
                v.pitch = wrap(v.pitch + v.pv * dt); v.roll = wrap(v.roll + v.rv * dt);
                v.pv *= Math.max(0, 1 - 1.2 * dt); v.rv *= Math.max(0, 1 - 1.2 * dt);
            } else {
                const upset = Math.abs(v.pitch) > 1.15 || Math.abs(v.roll) > 1.15;
                // springs towards the ground's slope (or towards lying on its roof, if that's where it is)
                const gp = upset && Math.abs(v.pitch) > 1.15 ? Math.sign(v.pitch) * Math.PI / 2 : tp, gr = upset && Math.abs(v.roll) > 1.15 ? (Math.abs(v.roll) > 2.3 ? Math.sign(v.roll) * Math.PI : Math.sign(v.roll) * Math.PI / 2) : tr;
                v.pv += (wrap(gp - v.pitch) * 60 - v.pv * 10) * dt; v.rv += (wrap(gr - v.roll) * 60 - v.rv * 10) * dt;
                // hanging over an edge: the heavy end drops
                const lowF = (fl + fr) / 2 < v.y - 1.2, lowB = (bl + br) / 2 < v.y - 1.2, lowL = (fl + bl) / 2 < v.y - 1.2, lowR = (fr + br) / 2 < v.y - 1.2;
                if (lowF && !lowB) v.pv -= 14 * dt; if (lowB && !lowF) v.pv += 14 * dt;
                if (lowL && !lowR) v.rv -= 14 * dt; if (lowR && !lowL) v.rv += 14 * dt;
                v.pitch = wrap(v.pitch + v.pv * dt); v.roll = wrap(v.roll + v.rv * dt);
                // tipped far enough over the edge: it goes
                if (Math.abs(v.pitch - tp) > 0.7 || Math.abs(v.roll - tr) > 0.7) { v.ground = false; v.vy = Math.min(v.vy, -1); }
            }
            // on its roof and settled: right it after a few seconds
            const upset = Math.abs(v.pitch) > 1.15 || Math.abs(v.roll) > 1.15;
            if (upset && Math.abs(v.pv) + Math.abs(v.rv) < 1 && Math.hypot(v.vx, v.vz) < 2) {
                v.flipT += dt;
                if (v.flipT === dt) for (const id of v.seats) { const a = id && this.byId(id); if (a && !S.seats[a.seat].shield) this.exitVehicle(a, true); }
                if (v.flipT > 3.5) { v.flipT = 0; v.vy = 6; v.ground = false; v.pv = -v.pitch * 2.2; v.rv = -v.roll * 2.2; this.emit({ t: 'vflip', id: v.id }); }
            } else v.flipT = 0;
        } else {
            // in the air it keeps turning, and the front is a little heavier
            v.air += dt;
            if (wasGround && v.air <= dt) { v.pv += (Math.random() - 0.5) * 0.6; v.rv += (Math.random() - 0.5) * 0.8; }
            v.pv -= 0.9 * dt;
            v.pitch = wrap(v.pitch + v.pv * dt); v.roll = wrap(v.roll + v.rv * dt);
        }
        if (landed) {
            const crooked = Math.max(Math.abs(v.pitch), Math.abs(v.roll));
            if (landed > 9 || crooked > 0.8) {
                // a bad landing: bounce, spin, hurt
                const hit = landed + crooked * 6;
                v.vy = Math.min(9, landed * 0.32 + crooked * 2); v.ground = false;
                v.tumble = Math.min(2.5, 0.4 + hit * 0.08);
                v.pv += (Math.random() - 0.5) * hit * 0.5 + Math.sign(v.pitch || 1) * hit * 0.15;
                v.rv += (Math.random() - 0.5) * hit * 0.5 + Math.sign(v.roll || 1) * hit * 0.15;
                if (hit > 11) {
                    this.damageVehicle(v, (hit - 10) * 9, drv, v.type);
                    for (const id of v.seats) { const a = id && this.byId(id); if (a && !S.seats[a.seat].shield) this.damage(a, (hit - 10) * 3, drv && drv !== a ? drv : null, 'fall', { kind: 'splash' }); }
                }
                this.emit({ t: 'vcrash', id: v.id, x: v.x, y: v.y, z: v.z });
            } else { v.pv *= 0.3; v.rv *= 0.3; }
        }
    };
    P.damageVehicle = function (v, amt, src, wpn) {
        if (v.dead || !this.authority) return;
        const occupied = v.seats.some((id) => id);
        if (src && occupied && src.team === v.team && !v.seats.includes(src.id)) return;
        if (src && src.pw && src.pw.sauce > 0) amt *= 2;
        v.hp -= amt;
        this.emit({ t: 'vhurt', id: v.id, by: src ? src.id : 0, amt: Math.round(amt) });
        if (v.hp <= 0) this.explodeVehicle(v, src, wpn);
    };
    P.explodeVehicle = function (v, src, wpn) {
        if (v.dead) return;
        v.dead = true; v.respawnT = VEHICLES[v.type].respawn;
        for (const id of v.seats) {
            const a = id && this.byId(id);
            if (!a) continue;
            this.exitVehicle(a, true);
            this.damage(a, 80, src && src !== a ? src : null, wpn || v.type, { kind: 'splash' });
        }
        v.seats = v.seats.map(() => 0);
        this.emit({ t: 'vboom', id: v.id, x: v.x, y: v.y + 1, z: v.z, by: src ? src.id : 0 });
    };
    // weapons against vehicles
    P.rayVehicle = function (o, d, maxT) {
        let best = null, bt = maxT;
        for (const v of this.vehicles || []) {
            if (v.dead) continue;
            const S = VEHICLES[v.type];
            const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
            const ox = o[0] - v.x, oz = o[2] - v.z;
            const lo = [ox * c - oz * s, o[1] - v.y, ox * s + oz * c], ld = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
            const t = rayAABB(lo[0], lo[1], lo[2], ld[0], ld[1], ld[2], -S.w / 2, 0, -S.l / 2, S.w / 2, S.h, S.l / 2, bt);
            if (t >= 0 && t < bt) { bt = t; best = v; }
        }
        return best ? { v: best, t: bt } : null;
    };
    P.vehicleMul = (wpn) => (VMUL[wpn] != null ? VMUL[wpn] : 0.5);
}

/* The game world: players, their movement and weapons, projectiles, pickups, scoring.
   The host (or a solo game) runs all of it. A network client only moves its own player and mirrors the rest. */
import { WEAPONS, ITEMS, MELEE, PREFER, MEDALS, KILL_PTS, SUICIDE_PTS, MAX_ARMOR, MODES, VEHICLES, DEFAULT_KIT } from './defs.js';
import { segDist2, raySphere, rayAABB } from './geom.js';
import { installConquest } from './conquest.js';

export const TICK = 1 / 60;
const SUB = 2;
// movement
const RUN = 9.0, CROUCH = 4.2, ACC = 12, FRIC = 8, AIR_ACC = 16, GRAV = 22, JUMP = 7.6;
const SLIDE_SPEED = 13.5, SLIDE_FRIC = 0.75, SLIDE_T = 1.05, SLIDE_MIN = 5.5;
const DODGE_H = 12.5, DODGE_V = 4.8, DODGE_CD = 0.65;
const STAND_H = 1.8, LOW_H = 1.05, R = 0.38;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);

// projectile kinds: speed, gravity, damage on a direct hit, splash radius and damage, bounces, radius, life
export const PROJ = {
    blob: { g: 7, r: 0.18, life: 3, splash: 1.6, sdmg: 0, bounce: 0 },
    balloon: { g: 14, r: 0.2, life: 5, splash: 3.2, sdmg: 60, bounce: 0, self: 0.5, knock: 9 },
    bigballoon: { g: 14, r: 0.3, life: 5, splash: 3.0, sdmg: 35, bounce: 0, self: 0.4, knock: 7, puddle: true },
    acorn: { g: 8, r: 0.06, life: 1.2, dmg: 9, bounce: 1, knock: 1.2 },
    baseball: { g: 3, r: 0.1, life: 3, dmg: 55, bounce: 1, knock: 6 },
    tennis: { g: 2.5, r: 0.09, life: 2, dmg: 7, bounce: 1, knock: 0.8 },
    lob: { g: 16, r: 0.12, life: 3.5, dmg: 18, bounce: 3, knock: 3 },
    rocket: { g: 0, r: 0.16, life: 6, splash: 3.8, sdmg: 100, dmg: 0, bounce: 0, self: 0.5, knock: 14 },
    golfball: { g: 0, r: 0.05, life: 0, dmg: 0 },
    cone: { g: 9, r: 0.25, life: 5, splash: 3.2, sdmg: 70, bounce: 0, self: 0, knock: 10 },
    popper: { g: 14, r: 0.1, life: 1.3, bounce: 4 },
    powder: { g: 14, r: 0.12, life: 1.6, bounce: 4 }
};

export class World {
    constructor(map, level, opts = {}) {
        this.map = map; this.level = level;
        this.mode = opts.mode || 'dm';
        this.rules = MODES[this.mode];
        // Tactical style: classes, no pickups, health that comes back
        this.style = this.rules.styles ? opts.style || 'arena' : null;
        if (this.style === 'tactical') this.rules = Object.assign({}, this.rules, { noItems: true, regen: true, kits: true, fullAmmo: true });
        this.clouds = [];
        this.fragLimit = opts.frags != null ? opts.frags : this.rules.frags;
        this.timeLimit = (opts.time != null ? opts.time : this.rules.time) * 60;
        this.authority = opts.authority !== false;
        this.actors = []; this.proj = []; this.items = []; this.puddles = []; this.traps = []; this.cars = [];
        this.events = [];
        this.nextId = 1;
        this.time = 0;
        this.state = 'warmup'; this.stateT = 3;
        this.timeLeft = this.timeLimit;
        this.teamScore = [0, 0];
        this.firstBlood = false;
        this.ticketsStart = opts.tickets || this.rules.tickets || 150;
        // in Conquest the only pickups are health, armour and ammo; weapons come with your class
        const items = this.rules.noItems ? [] : this.rules.conquest ? map.items.filter(([t]) => /^[har]:/.test(t)) : map.items;
        items.forEach(([type, x, y, z], i) => this.items.push({ id: i, type, x, y, z, t: 0 }));
        this.vehicles = []; this.drops = []; this.flags = [];
        if (this.rules.conquest) this.cqInit();
    }
    emit(e) { this.events.push(e); return e; }
    byId(id) { return this.actors.find((a) => a.id === id); }

    /* ---------- players ---------- */
    addActor(o) {
        const a = {
            id: o.id || this.nextId++, name: o.name || 'Player', char: o.char || 0, team: o.team || 0,
            human: !!o.human, remote: !!o.remote, local: !!o.local, bot: null, peer: o.peer || null, seq: 0,
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: R, h: STAND_H, ground: false, on: null,
            yaw: 0, pitch: 0, alive: false, hp: 0, armor: 0, deadT: 0, prot: 0,
            crouch: false, slideT: 0, slideCd: 0, dodgeCd: 0, launchT: 0, stunT: 0, airT: 0, stillT: 0, lungeT: 0, lungeHit: false,
            inv: {}, ammo: {}, dual: false, traps: 0, cur: 'pistol', next: null, switchT: 0, fireT: 0, charge: 0, loaded: 0, loadT: 0, spin: 0, zoom: false,
            pw: { sauce: 0, espresso: 0, sneakers: 0, box: 0 },
            score: 0, kills: 0, deaths: 0, spree: 0, multiN: 0, multiT: -9, lastKiller: null, lastHit: null,
            in: { mx: 0, mz: 0, jump: false, crouch: false, fire1: false, fire2: false, dodge: null, wsel: null, wnext: 0, wpick: null, use: false, special: false, lethal: false, tactical: false },
            kit: o.kit || null, lethalN: 0, tacN: 0, flashT: 0,
            cls: o.cls || 0, spawnAt: 'hq', veh: 0, seat: 0, shielded: false, specialT: 0,
            prevJump: false, prevCrouch: false, prev1: false, prev2: false,
            car: null, swing: 0, swingK: 0, fireAnim: 0, walk: 0, eyeH: 1.62, landT: 0, hurtT: 0, ping: 0
        };
        if (a.id >= this.nextId) this.nextId = a.id + 1;
        this.actors.push(a);
        if (this.authority) this.respawn(a, true);
        return a;
    }
    removeActor(a) {
        if (a.car) this.explodeCar(a.car);
        if (a.veh) this.exitVehicle(a);
        this.actors = this.actors.filter((b) => b !== a);
        this.emit({ t: 'left', id: a.id, name: a.name });
    }
    enemies(a, b) { return a !== b && (!this.rules.teams || a.team !== b.team); }
    respawn(a, first) {
        if (a.veh) this.exitVehicle(a);
        const sp = this.cq ? this.cqPickSpawn(a) : this.pickSpawn(a);
        a.x = sp[0]; a.y = sp[1]; a.z = sp[2];
        a.vx = a.vy = a.vz = 0;
        a.yaw = Math.atan2(sp[0], sp[2]);             // face the middle of the map
        a.pitch = 0;
        a.alive = true; a.hp = 100; a.armor = 0; a.deadT = 0; a.prot = 1.2;
        a.h = STAND_H; a.crouch = false; a.slideT = 0; a.launchT = 0; a.stunT = 0;
        a.inv = { noodle: true, pistol: true }; a.ammo = { pistol: WEAPONS.pistol.ammo[0] }; a.dual = false; a.traps = 0;
        a.cur = 'pistol'; a.next = null; a.switchT = 0.3; a.fireT = 0; a.charge = 0; a.loaded = 0; a.spin = 0; a.zoom = false;
        a.pw = { sauce: 0, espresso: 0, sneakers: 0, box: 0 };
        a.car = null;
        if (this.rules.classes) this.applyClass(a);
        if (this.rules.kits) this.applyKit(a);
        a.flashT = 0;
        if (this.cq) { a.prot = 2; if (!first) this.tickets[a.team] = Math.max(0, this.tickets[a.team] - 1); }
        if (this.rules.gungame) { if (first) a.gg = 0; this.giveTier(a); }
        else if (this.rules.loadout) {
            a.inv = this.mode === 'melee' ? {} : { noodle: true }; a.ammo = {};
            for (const w of this.rules.loadout) { a.inv[w] = true; if (WEAPONS[w].ammo) a.ammo[w] = WEAPONS[w].ammo[1]; }
            if (a.inv.rake) a.traps = 3;
            a.cur = this.rules.loadout[0];
        }
        a.sinceHurt = 99;
        a.ground = true; a.eyeH = STAND_H - 0.18;
        a.seq++;
        this.emit({ t: 'spawn', id: a.id, x: a.x, y: a.y, z: a.z, yaw: a.yaw, first: !!first, seq: a.seq });
    }
    pickSpawn(a) {
        const sp = this.map.spawns;
        let best = sp[0], bs = -Infinity;
        for (const p of sp) {
            let d = 60;
            for (const b of this.actors) if (b !== a && b.alive) d = Math.min(d, Math.hypot(b.x - p[0], (b.y - p[1]) * 1.5, b.z - p[2]));
            const s = d + rnd(0, 8);
            if (s > bs) { bs = s; best = p; }
        }
        return best;
    }
    eye(a) { return [a.x, a.y + a.eyeH, a.z]; }
    aim(a) { const cp = Math.cos(a.pitch); return [-Math.sin(a.yaw) * cp, Math.sin(a.pitch), -Math.cos(a.yaw) * cp]; }

    /* ---------- the tick ---------- */
    step(dt) {
        this.time += dt;
        if (this.authority) { this.rulesStep(dt); if (this.cq) this.cqStep(dt); }
        for (const a of this.actors) {
            if (a.bot && this.authority) a.bot.think(this, dt);
            // a client moves only itself; the host moves everyone except remote players (they move themselves)
            if (this.authority ? !a.remote || a.veh : a.local) { if (a.veh && a.alive) this.ride(a); else this.moveActor(a, dt); }
            this.anim(a, dt);
        }
        if (!this.authority) { this.mirrorStep(dt); return; }
        for (const a of this.actors) {
            if (!a.alive) {
                a.deadT += dt;
                let wait = a.human ? (a.in.fire1 && a.deadT > 1.2) || a.deadT > 4 : a.deadT > 1.6 + (a.id % 3) * 0.3;
                // Conquest: a longer wait, people choose their class and spawn first, and it costs a ticket
                if (this.cq) wait = (a.human ? a.in.fire1 && a.deadT > 4 : a.deadT > 5 + (a.id % 3) * 0.4) && this.tickets[a.team] > 0;
                if (wait && this.state !== 'over') this.respawn(a);
                continue;
            }
            this.timers(a, dt);
            if (a.in.use) { a.in.use = false; if (this.cq) this.useVehicle(a); }
            if (a.in.special) { a.in.special = false; if (this.cq) this.special(a); }
            if (a.in.lethal) { a.in.lethal = false; if (this.rules.kits) this.throwLethal(a); }
            if (a.in.tactical) { a.in.tactical = false; if (this.rules.kits) this.throwTactical(a); }
            a.specialT = Math.max(0, (a.specialT || 0) - dt);
            if (this.state !== 'over') this.weapon(a, dt);
            this.pickups(a);
            if (this.cq) this.takeDrops(a);
        }
        this.stepProj(dt);
        for (const c of this.clouds) c.life -= dt;
        if (this.clouds.some((c) => c.life <= 0)) this.clouds = this.clouds.filter((c) => c.life > 0);
        this.stepCars(dt);
        this.stepTraps(dt);
        for (const p of this.puddles) p.life -= dt;
        this.puddles = this.puddles.filter((p) => p.life > 0);
        for (const it of this.items) if (it.t > 0) { it.t -= dt; if (it.t <= 0) { it.t = 0; this.emit({ t: 'itemback', id: it.id }); } }
    }
    // the bits a client still runs for the things it mirrors
    mirrorStep(dt) {
        for (const p of this.proj) {
            p.vy -= (PROJ[p.type].g || 0) * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        }
        for (const a of this.actors) if (a.local && a.alive) this.timers(a, dt);
        for (const v of this.vehicles) if (!v.dead) { v.x += (v.vx || 0) * dt; v.z += (v.vz || 0) * dt; }
    }
    rulesStep(dt) {
        if (this.state === 'warmup') {
            this.stateT -= dt;
            if (this.stateT <= 0) { this.state = 'play'; this.emit({ t: 'go' }); }
        } else if (this.state === 'play') {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); }
        } else if (this.state === 'over') this.stateT -= dt;
    }
    end() {
        if (this.state === 'over') return;
        this.state = 'over'; this.stateT = 12;
        for (const a of this.actors) { a.in.fire1 = a.in.fire2 = false; if (a.car) this.explodeCar(a.car); }
        if (this.cq) this.teamScore = [...this.tickets];
        this.emit({ t: 'over', ranking: this.ranking().map((a) => a.id), teams: [...this.teamScore] });
    }
    // a new match with the same players
    reset() {
        this.state = 'warmup'; this.stateT = 3; this.timeLeft = this.timeLimit; this.teamScore = [0, 0]; this.firstBlood = false;
        this.proj = []; this.puddles = []; this.traps = []; for (const c of this.cars) c.dead = true; this.cars = [];
        for (const it of this.items) it.t = 0;
        if (this.cq) { for (const a of this.actors) if (a.veh) this.exitVehicle(a); this.cqInit(); }
        for (const a of this.actors) { a.score = a.kills = a.deaths = a.spree = 0; a.multiN = 0; a.lastKiller = null; a.lastHit = null; this.respawn(a, true); }
        this.emit({ t: 'reset' });
    }
    /* ---------- Tactical: your own class, and things to throw ---------- */
    applyKit(a) {
        const K = Object.assign({}, DEFAULT_KIT, a.kit || {});
        a.inv = {}; a.ammo = {}; a.dual = false;
        for (const w of [K.melee, K.secondary, K.primary]) { a.inv[w] = true; if (WEAPONS[w].ammo) a.ammo[w] = WEAPONS[w].ammo[1]; }
        a.traps = 0;
        a.cur = K.primary;
        a.lethalN = 1; a.tacN = 2;
    }
    throwLethal(a) {
        const K = Object.assign({}, DEFAULT_KIT, a.kit || {});
        if (!(a.lethalN > 0) || a.veh) return;
        if (K.lethal === 'trap') { if (this.placeTrap(a)) a.lethalN--; return; }
        a.lethalN--;
        const d = this.aim(a), up = [d[0], d[1] + 0.15, d[2]], l = Math.hypot(...up);
        this.shoot(a, 'balloon', up.map((v) => v / l), 17);
        this.emit({ t: 'fire', id: a.id, w: 'balloon', k: 'throw' });
    }
    throwTactical(a) {
        const K = Object.assign({}, DEFAULT_KIT, a.kit || {});
        if (!(a.tacN > 0) || a.veh) return;
        a.tacN--;
        const d = this.aim(a), up = [d[0], d[1] + 0.2, d[2]], l = Math.hypot(...up);
        this.shoot(a, K.tactical, up.map((v) => v / l), 15);
        this.emit({ t: 'fire', id: a.id, w: 'balloon', k: 'throw' });
    }
    placeTrap(a) {
        if (!a.ground) return false;
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        let x = a.x + fx * 1.3, z = a.z + fz * 1.3;
        if (this.level.blocked(x, a.y, z, 0.3, 0.5, 0.3)) { x = a.x; z = a.z; }
        const y = this.level.ground(x, z, 0.2, a.y + 0.5);
        if (y < a.y - 1.5) return false;
        const tr = { id: this.nextId++, owner: a.id, x, y, z, yaw: a.yaw, life: 60, arm: 0.6 };
        this.traps.push(tr);
        this.emit({ t: 'trapset', tr: { ...tr } });
        return true;
    }
    // the confetti popper: anyone who can see the burst is dazzled, more so if they're looking at it
    flashbang(p) {
        for (const b of this.actors) {
            if (!b.alive) continue;
            const e = this.eye(b), dx = p.x - e[0], dy = p.y - e[1], dz = p.z - e[2], d = Math.hypot(dx, dy, dz);
            if (d > 11 || !this.level.clear(p.x, p.y + 0.1, p.z, e[0], e[1], e[2])) continue;
            const v = this.aim(b), facing = Math.max(0, (v[0] * dx + v[1] * dy + v[2] * dz) / (d || 1));
            b.flashT = Math.max(b.flashT || 0, (0.6 + 2.4 * facing) * (1 - d / 12));
        }
        this.emit({ t: 'flashbang', x: p.x, y: p.y, z: p.z });
    }
    // is the line between two points through a powder cloud?
    cloudBlocks(ax, ay, az, bx, by, bz) {
        for (const c of this.clouds) if (segDist2(c.x, c.y + 1, c.z, ax, ay, az, bx, by, bz) < c.r * c.r * 0.7) return true;
        return false;
    }
    ranking() { return [...this.actors].sort((a, b) => (this.rules.gungame ? (b.gg || 0) - (a.gg || 0) : 0) || b.score - a.score || b.kills - a.kills || a.deaths - b.deaths); }
    /* Gun Game: a kill with your current weapon moves you up; a noodle kill (before the last rung) knocks the victim down one */
    giveTier(a) {
        const L = this.rules.ladder, w = L[Math.min(a.gg || 0, L.length - 1)];
        a.inv = { noodle: true }; a.ammo = {}; a.dual = w === 'soaker';
        const wp = w === 'soaker' ? 'pistol' : w;
        a.inv[wp] = true;
        if (WEAPONS[wp].ammo) a.ammo[wp] = WEAPONS[wp].ammo[1];
        if (wp === 'rake') a.traps = 3;
        a.cur = wp; a.next = null; a.switchT = 0.25; a.charge = 0; a.loaded = 0; a.spin = 0; a.zoom = false;
    }
    ggKill(t, src, wpn, medals) {
        const L = this.rules.ladder;
        if (!src || src === t) { t.gg = Math.max(0, (t.gg || 0) - 1); return; }
        const tier = L[Math.min(src.gg || 0, L.length - 1)], tw = tier === 'soaker' ? 'pistol' : tier;
        if (wpn === 'noodle' && tw !== 'noodle') {
            t.gg = Math.max(0, (t.gg || 0) - 1);
            medals.push('humiliation'); src.score += MEDALS.humiliation[1];
            return;
        }
        if (wpn !== tw) return;
        src.gg = (src.gg || 0) + 1;
        if (src.gg >= L.length) { this.end(); return; }
        this.giveTier(src);
        this.emit({ t: 'level', id: src.id, gg: src.gg });
    }
    timers(a, dt) {
        a.prot = Math.max(0, a.prot - dt);
        a.dodgeCd = Math.max(0, a.dodgeCd - dt);
        a.slideCd = Math.max(0, a.slideCd - dt);
        a.stunT = Math.max(0, a.stunT - dt);
        a.flashT = Math.max(0, (a.flashT || 0) - dt);
        // modes without pickups: health creeps back once you've been out of trouble for a few seconds
        if (this.rules.regen && a.alive) { a.sinceHurt = (a.sinceHurt || 0) + dt; if (a.sinceHurt > 4 && a.hp < 100) a.hp = Math.min(100, a.hp + 30 * dt); }
        for (const k in a.pw) if (a.pw[k] > 0) { a.pw[k] = Math.max(0, a.pw[k] - dt); if (!a.pw[k] && this.authority) this.emit({ t: 'pwoff', id: a.id, pw: k }); }
    }

    /* ---------- movement ---------- */
    moveActor(a, dt) {
        if (!a.alive) return;
        const I = a.in;
        const mx = a.car ? 0 : I.mx, mz = a.car ? 0 : I.mz;
        const L = this.level;
        const fast = a.pw.espresso > 0 ? 1.35 : 1;
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
        let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
        const wl = Math.hypot(wx, wz);
        if (wl > 1) { wx /= wl; wz /= wl; }
        if (a.stunT > 0 || this.state === 'over') { wx = wz = 0; }
        const jumpEdge = I.jump && !a.prevJump; a.prevJump = I.jump;
        const crouchEdge = I.crouch && !a.prevCrouch; a.prevCrouch = I.crouch;
        const slip = this.onPuddle(a);
        const hs = Math.hypot(a.vx, a.vz);
        a.launchT = Math.max(0, a.launchT - dt);
        a.lungeT = Math.max(0, a.lungeT - dt);

        if (a.ground) {
            a.airT = 0;
            // start a slide when crouch is pressed while running (or still held when landing fast)
            if (a.slideT <= 0 && I.crouch && (crouchEdge || a.landT > 0) && hs > 6) {
                const boost = a.slideCd <= 0 ? SLIDE_SPEED * fast : hs;
                const k = Math.max(hs, boost) / (hs || 1);
                a.vx *= k; a.vz *= k;
                a.slideT = SLIDE_T; a.slideCd = 0.9;
                this.emit({ t: 'slide', id: a.id });
            }
            if (a.slideT > 0) {
                a.slideT -= dt * (slip ? 0.4 : 1);
                // a slide keeps its speed, slows a little, and can be steered a touch
                const f = slip ? 0.15 : SLIDE_FRIC;
                a.vx *= Math.max(0, 1 - f * dt); a.vz *= Math.max(0, 1 - f * dt);
                if (wl > 0.1) { a.vx += wx * 3 * dt; a.vz += wz * 3 * dt; }
                // downhill speeds you up
                const s = a.on;
                if (s && s.k === 1) {
                    const lo = s.ax === 0 ? s.x1 - s.x0 : s.z1 - s.z0, k = (s.yb - s.ya) / lo;
                    if (s.ax === 0) a.vx -= k * 14 * dt; else a.vz -= k * 14 * dt;
                }
                if (!I.crouch || a.slideT <= 0 || Math.hypot(a.vx, a.vz) < SLIDE_MIN) a.slideT = 0;
            } else {
                // friction, then accelerate towards the wished direction (Quake style)
                const fr = slip ? 1.2 : FRIC;
                if (hs > 0) { const drop = Math.max(hs, 2) * fr * dt, k = Math.max(0, hs - drop) / hs; a.vx *= k; a.vz *= k; }
                const max = (a.crouch ? CROUCH : RUN) * fast;
                const ws = wl > 0 ? max * Math.min(1, wl) : 0;
                if (ws > 0) {
                    const cur = a.vx * wx + a.vz * wz, add = ws - cur;
                    if (add > 0) { const acc = Math.min(add, ACC * ws * dt * (slip ? 0.3 : 1)); a.vx += wx * acc; a.vz += wz * acc; }
                }
            }
            if (jumpEdge && a.stunT <= 0) {
                a.vy = JUMP * (a.pw.sneakers > 0 ? 1.5 : 1);
                if (a.slideT > 0) { a.vx *= 1.06; a.vz *= 1.06; a.slideT = 0; this.emit({ t: 'slidejump', id: a.id }); }
                a.ground = false;
                this.emit({ t: 'jump', id: a.id });
            } else if (I.dodge && a.dodgeCd <= 0 && a.stunT <= 0) {
                const [dx, dz] = I.dodge;
                const ox = fx * dz + rx * dx, oz = fz * dz + rz * dx, ol = Math.hypot(ox, oz) || 1;
                a.vx = ox / ol * DODGE_H * fast; a.vz = oz / ol * DODGE_H * fast; a.vy = DODGE_V;
                a.slideT = 0; a.dodgeCd = DODGE_CD; a.ground = false;
                this.emit({ t: 'dodge', id: a.id });
            }
        } else {
            a.airT += dt;
            if (a.launchT <= 0 && wl > 0.05) {
                // air control: steer freely up to running speed, but never add speed past what you already have
                const before = Math.hypot(a.vx, a.vz);
                a.vx += wx * AIR_ACC * dt; a.vz += wz * AIR_ACC * dt;
                const after = Math.hypot(a.vx, a.vz), cap = Math.max(before, RUN * fast);
                if (after > cap) { a.vx *= cap / after; a.vz *= cap / after; }
            }
        }
        I.dodge = null;
        a.landT = Math.max(0, a.landT - dt);
        // crouching and sliding make you short; standing back up needs headroom
        const wantLow = a.slideT > 0 || I.crouch;
        if (wantLow) a.h = LOW_H;
        else if (a.h < STAND_H) { if (!L.blocked(a.x, a.y, a.z, a.r * 0.95, STAND_H, 0.05)) a.h = STAND_H; }
        a.crouch = a.h < STAND_H && a.slideT <= 0;
        a.eyeH += ((a.h - 0.18) - a.eyeH) * Math.min(1, dt * 14);

        a.vy -= GRAV * dt;
        a.bump = false;
        let landed = 0;
        for (let i = 0; i < SUB; i++) landed = Math.max(landed, L.move(a, dt / SUB));
        if (landed) {
            a.landT = 0.12;
            if (landed > 6) this.emit({ t: 'land', id: a.id, v: landed });
        }
        // trampolines
        if (a.ground && a.on && a.on.tramp && a.launchT <= 0) this.launch(a, a.on.tramp);
        // fell out of the world somehow
        if (a.y < (this.map.killY != null ? this.map.killY : -20) && this.authority) this.kill(a, null, 'fall');
    }
    launch(a, tr) {
        const [tx, ty, tz] = tr.to, g = GRAV;
        const vy = Math.sqrt(2 * g * (tr.peak - a.y)), tu = vy / g, td = Math.sqrt(2 * Math.max(0.1, tr.peak - ty) / g);
        a.vx = (tx - a.x) / (tu + td); a.vz = (tz - a.z) / (tu + td); a.vy = vy;
        a.ground = false; a.launchT = tu + td * 0.8; a.slideT = 0;
        this.emit({ t: 'tramp', id: a.id, x: a.x, y: a.y, z: a.z });
    }
    onPuddle(a) {
        if (!a.ground) return false;
        for (const p of this.puddles) if (Math.abs(a.y - p.y) < 0.4 && (a.x - p.x) ** 2 + (a.z - p.z) ** 2 < p.r * p.r) return true;
        return false;
    }
    anim(a, dt) {
        const hs = Math.hypot(a.vx, a.vz);
        if (a.ground && a.slideT <= 0) a.walk += hs * dt * 1.15;
        a.stillT = hs < 0.4 && a.ground ? a.stillT + dt : 0;
        a.swing = Math.max(0, a.swing - dt);
        a.fireAnim = Math.max(0, a.fireAnim - dt);
        a.hurtT = Math.max(0, a.hurtT - dt);
    }
    hidden(a) { return a.pw.box > 0 && a.stillT > 0.5; }

    /* ---------- weapons ---------- */
    has(a, w) { return !!a.inv[w] && (!WEAPONS[w].ammo || (a.ammo[w] || 0) > 0 || (w === 'rc' && a.car)); }
    select(a, w) {
        if (!this.has(a, w) || (a.cur === w && !a.next) || a.next === w) return;
        a.next = w; a.switchT = 0.22; a.charge = 0; a.loaded = 0; a.spin = 0; a.zoom = false;
    }
    selectSlot(a, slot) {
        const list = Object.keys(WEAPONS).filter((w) => WEAPONS[w].slot === slot && this.has(a, w));
        if (!list.length) return;
        const at = list.indexOf(a.next || a.cur);
        this.select(a, list[(at + 1) % list.length]);
    }
    cycle(a, dir) {
        const owned = Object.keys(WEAPONS).filter((w) => this.has(a, w));
        if (owned.length < 2) return;
        const at = owned.indexOf(a.next || a.cur);
        this.select(a, owned[(at + dir + owned.length) % owned.length]);
    }
    bestWeapon(a) { return PREFER.find((w) => this.has(a, w)) || 'noodle'; }
    weapon(a, dt) {
        const I = a.in;
        if (I.wsel) { this.selectSlot(a, I.wsel); I.wsel = null; }
        if (I.wnext) { this.cycle(a, I.wnext); I.wnext = 0; }
        if (I.wpick) { this.select(a, I.wpick); I.wpick = null; }
        a.fireT = Math.max(0, a.fireT - dt);
        if (a.next) {
            a.switchT -= dt;
            if (a.switchT <= 0) { a.cur = a.next; a.next = null; a.switchT = 0; this.emit({ t: 'switch', id: a.id, w: a.cur }); }
            a.prev1 = I.fire1; a.prev2 = I.fire2;
            return;
        }
        if (a.veh) {
            // drivers drive; gunners use their own weapons; the van's turret has its own
            const seat = this.vehicleSeat(a);
            if (seat && seat.turret) { a.fireT = Math.max(0, a.fireT); if (I.fire1 && a.fireT <= 0 && this.state === 'play') { a.fireT = 1.1; const d = this.aim(a); this.shoot(a, 'cone', [d[0], d[1] + 0.08, d[2]], 30, { wpn: 'cone' }); this.fired(a, 'cone'); } a.prev1 = I.fire1; return; }
            if (!seat || !seat.gun) { a.prev1 = I.fire1; a.prev2 = I.fire2; return; }
        }
        if (!this.has(a, a.cur) && !a.car) { this.select(a, this.bestWeapon(a)); return; }
        if (this.state === 'warmup') { a.prev1 = I.fire1; a.prev2 = I.fire2; return; }
        const f1 = I.fire1 && a.stunT <= 0, f2 = I.fire2 && a.stunT <= 0;
        const e1 = f1 && !a.prev1, e2 = f2 && !a.prev2;
        const H = HANDLERS[a.cur];
        if (H) H(this, a, dt, f1, f2, e1, e2);
        a.prev1 = I.fire1; a.prev2 = I.fire2;
        if (a.lungeT > 0 && !a.lungeHit) {
            const hit = this.melee(a, 1.8, 0.9, 45, { knock: 9, up: 3, wpn: 'slicer' });
            if (hit.length) { a.lungeHit = true; a.lungeT = 0; }
        }
    }
    use(a, n = 1) {
        if (!WEAPONS[a.cur].ammo) return true;
        if (this.rules.infinite) return (a.ammo[a.cur] || 0) >= n;
        if ((a.ammo[a.cur] || 0) < n) return false;
        a.ammo[a.cur] -= n;
        return true;
    }
    fired(a, kind, extra) { a.fireAnim = 0.15; return this.emit(Object.assign({ t: 'fire', id: a.id, w: a.cur, k: kind }, extra)); }
    // a point just in front of the eye, a little to the right and down, where things leave the weapon
    muzzle(a, d) {
        const e = this.eye(a), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
        const p = [e[0] + d[0] * 0.5 + rx * 0.18, e[1] - 0.14 + d[1] * 0.5, e[2] + d[2] * 0.5 + rz * 0.18];
        return this.level.clear(e[0], e[1], e[2], p[0], p[1], p[2]) ? p : e;
    }
    spread(d, k) {
        const x = d[0] + rnd(-k, k), y = d[1] + rnd(-k, k), z = d[2] + rnd(-k, k), l = Math.hypot(x, y, z);
        return [x / l, y / l, z / l];
    }
    // instant hit along a ray from the eye: the world, then whoever is in the way. Returns the hit point and victim.
    hitscan(a, d, range, dmg, opts = {}) {
        const e = this.eye(a);
        const w = this.level.ray(e[0], e[1], e[2], d[0], d[1], d[2], range);
        let t = w ? w.t : range, vic = null, head = false;
        for (const b of this.actors) {
            if (b === a || !b.alive || b.shielded) continue;
            const hy = b.y + b.h - 0.22;
            const th = raySphere(e[0], e[1], e[2], d[0], d[1], d[2], b.x, hy, b.z, 0.27, t);
            if (th >= 0 && th < t) { t = th; vic = b; head = true; }
            const tb = rayAABB(e[0], e[1], e[2], d[0], d[1], d[2], b.x - 0.36, b.y, b.z - 0.36, b.x + 0.36, b.y + b.h - 0.42, b.z + 0.36, t);
            if (tb >= 0 && tb < t) { t = tb; vic = b; head = false; }
        }
        if (this.cq) {
            const hv = this.rayVehicle(e, d, t);
            if (hv && !(a.veh === hv.v.id)) {
                t = hv.t; vic = null;
                this.damageVehicle(hv.v, dmg * this.vehicleMul(opts.wpn || a.cur), a, opts.wpn || a.cur);
            }
        }
        const p = [e[0] + d[0] * t, e[1] + d[1] * t, e[2] + d[2] * t];
        if (vic) {
            const amt = head && opts.head ? opts.head : dmg;
            this.damage(vic, amt, a, opts.wpn || a.cur, { head, kind: 'hit' });
            if (opts.knock) this.impulse(vic, d[0] * opts.knock, opts.up || 0, d[2] * opts.knock);
        }
        return { p, vic, head, wall: !vic && !!w, n: w ? [w.nx, w.ny, w.nz] : null };
    }
    // close-range hits in a cone in front: the best target, or everyone with `all`
    melee(a, range, cone, dmg, opts = {}) {
        const e = this.eye(a), d = this.aim(a), out = [];
        const cands = [];
        for (const b of this.actors) {
            if (b === a || !b.alive) continue;
            const cy = clamp(e[1], b.y + 0.3, b.y + b.h - 0.2);
            const vx = b.x - e[0], vy = cy - e[1], vz = b.z - e[2];
            const dist = Math.hypot(vx, vy, vz) - 0.35;
            if (dist > range) continue;
            const L = Math.hypot(vx, vy, vz) || 1;
            const ang = Math.acos(clamp((vx * d[0] + vy * d[1] + vz * d[2]) / L, -1, 1));
            if (ang > cone && dist > 0.4) continue;
            if (!this.level.clear(e[0], e[1], e[2], b.x, cy, b.z)) continue;
            cands.push([ang, b]);
        }
        cands.sort((p, q) => p[0] - q[0]);
        for (const [, b] of opts.all ? cands : cands.slice(0, 1)) {
            const hx = d[0], hz = d[2], hl = Math.hypot(hx, hz) || 1;
            this.damage(b, dmg, a, opts.wpn || a.cur, { kind: 'melee' });
            this.impulse(b, hx / hl * (opts.knock || 0), opts.up || 0, hz / hl * (opts.knock || 0));
            out.push(b);
        }
        return out;
    }
    shoot(a, type, d, speed, extra = {}) {
        const m = this.muzzle(a, d);
        const p = Object.assign({ id: this.nextId++, type, owner: a.id, x: m[0], y: m[1], z: m[2], vx: d[0] * speed, vy: d[1] * speed, vz: d[2] * speed, life: PROJ[type].life, bounces: PROJ[type].bounce || 0, age: 0 }, extra);
        // inherit a little of the shooter's own speed
        p.vx += a.vx * 0.3; p.vz += a.vz * 0.3;
        this.proj.push(p);
        this.emit({ t: 'proj', p: { id: p.id, type: p.type, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, owner: p.owner } });
        return p;
    }
    // bat swings and leaf blower blasts send projectiles back
    deflect(a, range, cone, mul, tag) {
        const e = this.eye(a), d = this.aim(a);
        let n = 0;
        for (const p of this.proj) {
            const vx = p.x - e[0], vy = p.y - e[1], vz = p.z - e[2], L = Math.hypot(vx, vy, vz);
            if (L > range || L < 1e-3) continue;
            if ((vx * d[0] + vy * d[1] + vz * d[2]) / L < Math.cos(cone)) continue;
            const sp = Math.max(Math.hypot(p.vx, p.vy, p.vz), 20) * mul;
            p.vx = d[0] * sp; p.vy = d[1] * sp; p.vz = d[2] * sp;
            if (p.owner !== a.id) { p.owner = a.id; p.age = 0; if (tag) p.homerun = true; }
            p.life = Math.max(p.life, 2);
            this.emit({ t: 'deflect', id: p.id, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, owner: a.id, homerun: !!tag });
            n++;
        }
        return n;
    }

    /* ---------- damage ---------- */
    impulse(b, vx, vy, vz) {
        if (!b.alive) return;
        if (b.remote) { this.emit({ t: 'imp', id: b.id, v: [vx, vy, vz] }); return; }
        b.vx += vx; b.vy = Math.max(b.vy, 0) + vy; b.vz += vz;
        if (vy > 0.5) b.ground = false;
    }
    damage(t, amt, src, wpn, f = {}) {
        if (!this.authority || !t.alive || this.state === 'over') return;
        if (t.prot > 0 && src !== t) return;
        if (src && src !== t && !this.enemies(src, t)) return;
        if (src && src !== t && src.pw.sauce > 0) amt *= 2;
        const absorb = Math.min(t.armor, amt * 0.66);
        t.armor -= absorb; amt -= absorb;
        t.hp -= amt;
        t.hurtT = 0.3; t.sinceHurt = 0;
        if (src && src !== t) t.lastHit = { by: src.id, wpn, time: this.time };
        this.emit({ t: 'hurt', id: t.id, by: src ? src.id : 0, amt: Math.round(amt + absorb), x: src ? src.x : t.x, z: src ? src.z : t.z, head: !!f.head, w: wpn });
        if (t.hp <= 0) this.kill(t, src, wpn, f);
    }
    kill(t, src, wpn, f = {}) {
        if (!t.alive) return;
        if (t.veh) this.exitVehicle(t);
        t.alive = false; t.deadT = 0; t.deaths++; t.hp = Math.min(t.hp, 0);
        if (t.car) this.explodeCar(t.car);
        const medals = [];
        let pts = 0;
        // a player knocked to their death by someone else counts as that player's kill
        if ((!src || src === t) && t.lastHit && this.time - t.lastHit.time < 3) { src = this.byId(t.lastHit.by); wpn = t.lastHit.wpn; }
        if (src && src !== t) {
            src.kills++; src.spree++;
            src.multiN = this.time - src.multiT < 4 ? src.multiN + 1 : 1; src.multiT = this.time;
            const M = (k) => { medals.push(k); pts += MEDALS[k][1]; };
            if (!this.firstBlood) { this.firstBlood = true; M('first'); }
            if (src.slideT > 0) M('slide');
            if (!t.ground && t.airT > 0.3 && !MELEE.includes(wpn)) M('air');
            if (MELEE.includes(wpn) && wpn !== 'trap') M('smack');
            if (f.homerun) M('homerun');
            if (f.head && wpn === 'golf') M('hole');
            if (wpn === 'trap') M('trap');
            if (wpn === 'rc' || VEHICLES[wpn]) M('road');
            if (src.lastKiller === t.id) { M('revenge'); src.lastKiller = null; }
            if (t.spree >= 5) M('stopper');
            const mk = ['', '', 'double', 'multi', 'mega', 'ultra'][Math.min(src.multiN, 5)];
            if (mk) M(mk);
            if (src.spree === 5) M('spree5'); else if (src.spree === 10) M('spree10'); else if (src.spree === 15) M('spree15'); else if (src.spree === 20) M('spree20');
            pts += KILL_PTS;
            src.score += pts;
            t.lastKiller = src.id;
            if (this.rules.teams) this.teamScore[src.team]++;
        } else {
            t.score += SUICIDE_PTS; pts = SUICIDE_PTS;
            if (this.rules.teams) this.teamScore[t.team] = Math.max(0, this.teamScore[t.team] - 1);
        }
        t.spree = 0;
        if (this.rules.gungame) this.ggKill(t, src, wpn, medals);
        this.emit({ t: 'kill', k: src && src !== t ? src.id : 0, v: t.id, w: wpn, medals, pts, x: t.x, y: t.y, z: t.z, vx: t.vx, vy: t.vy, vz: t.vz });
        if (src && src !== t && this.state === 'play') {
            const done = this.rules.teams ? this.teamScore[src.team] >= this.fragLimit : src.kills >= this.fragLimit;
            if (done && this.fragLimit > 0) this.end();
        }
    }

    /* ---------- projectiles ---------- */
    stepProj(dt) {
        const L = this.level, h = dt / SUB;
        for (const p of this.proj) {
            if (p.dead) continue;
            const P = PROJ[p.type];
            p.life -= dt; p.age += dt;
            if (p.life <= 0) { this.burst(p, null); continue; }
            for (let s = 0; s < SUB && !p.dead; s++) {
                p.vy -= (P.g || 0) * h;
                const sp = Math.hypot(p.vx, p.vy, p.vz), dist = sp * h;
                if (dist < 1e-6) continue;
                const dx = p.vx / sp, dy = p.vy / sp, dz = p.vz / sp;
                const w = L.ray(p.x, p.y, p.z, dx, dy, dz, dist + P.r);
                const ox = p.x, oy = p.y, oz = p.z;
                // players along the way
                const nx = p.x + p.vx * h, ny = p.y + p.vy * h, nz = p.z + p.vz * h;
                const vic = this.projHit(p, P, ox, oy, oz, nx, ny, nz);
                if (vic) { this.directHit(p, P, vic); break; }
                if (this.cq && p.age > 0.08) {
                    const own = this.byId(p.owner);
                    const hv = this.vehicles.find((v) => !v.dead && !(own && own.veh === v.id) && this.inVehicleBox(v, nx, ny, nz, P.r));
                    if (hv) { if (P.dmg) this.damageVehicle(hv, P.dmg * this.vehicleMul(p.wpn || weaponOf(p.type)), own, p.wpn || weaponOf(p.type)); this.burst(p, null); break; }
                }
                if (w && w.t <= dist + P.r) {
                    const t = Math.max(0, w.t - P.r);
                    p.x += dx * t; p.y += dy * t; p.z += dz * t;
                    if (p.bounces > 0) {
                        p.bounces--;
                        const vn = p.vx * w.nx + p.vy * w.ny + p.vz * w.nz;
                        p.vx = (p.vx - 2 * vn * w.nx) * 0.62; p.vy = (p.vy - 2 * vn * w.ny) * 0.62; p.vz = (p.vz - 2 * vn * w.nz) * 0.62;
                        this.emit({ t: 'bounce', id: p.id, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, type: p.type });
                    } else { this.burst(p, [w.nx, w.ny, w.nz]); }
                    break;
                }
                p.x = nx; p.y = ny; p.z = nz;
            }
        }
        this.proj = this.proj.filter((p) => !p.dead);
    }
    projHit(p, P, ox, oy, oz, nx, ny, nz) {
        for (const b of this.actors) {
            if (!b.alive || b.shielded || (b.id === p.owner && p.age < 0.25)) continue;
            if (b.id !== p.owner) { const o = this.byId(p.owner); if (o && !this.enemies(o, b)) continue; }
            const rr = 0.42 + P.r;
            // the body as a capsule; test the end of the step and its middle
            for (const [x, y, z] of [[nx, ny, nz], [(ox + nx) / 2, (oy + ny) / 2, (oz + nz) / 2]]) {
                if (segDist2(x, y, z, b.x, b.y + 0.42, b.z, b.x, b.y + b.h - 0.42, b.z) < rr * rr) return b;
            }
        }
        return null;
    }
    directHit(p, P, vic) {
        const owner = this.byId(p.owner);
        if (P.dmg) {
            const sp = Math.hypot(p.vx, p.vy, p.vz) || 1;
            this.damage(vic, P.dmg * (p.homerun ? 1.5 : 1) + (p.extra || 0), owner, p.wpn || weaponOf(p.type), { kind: 'hit', homerun: p.homerun });
            const k = P.knock || 0;
            this.impulse(vic, p.vx / sp * k, k * 0.3, p.vz / sp * k);
        }
        this.burst(p, null, vic);
    }
    // a projectile's end: splash damage, a puddle, an effect
    burst(p, n, direct) {
        if (p.dead) return;
        p.dead = true;
        const P = PROJ[p.type], owner = this.byId(p.owner);
        if (P.splash) {
            const dmg = (P.sdmg || 0) + (p.extra || 0);
            for (const b of this.actors) {
                if (!b.alive || b.shielded) continue;
                const cy = b.y + b.h * 0.5;
                const d = Math.hypot(b.x - p.x, cy - p.y, b.z - p.z);
                const reach = P.splash + 0.4;
                if (d > reach) continue;
                if (b !== direct && !this.level.clear(p.x, p.y, p.z, b.x, cy, b.z)) continue;
                const k = b === direct ? 1 : clamp(1 - d / reach, 0.2, 1);
                let amt = dmg * k;
                if (owner && b === owner) amt *= P.self || 0;
                if (amt > 0.5) this.damage(b, amt, owner, p.wpn || weaponOf(p.type), { kind: 'splash', homerun: p.homerun });
                if (P.knock) {
                    const dl = d || 1, kn = P.knock * k * (b === owner ? 1.15 : 1);
                    this.impulse(b, (b.x - p.x) / dl * kn, kn * 0.55 + 2, (b.z - p.z) / dl * kn);
                }
            }
        }
        if (this.cq && P.splash) {
            const dmg = (P.sdmg || 0) + (p.extra || 0), w = p.wpn || weaponOf(p.type);
            for (const v of this.vehicles) {
                if (v.dead) continue;
                const d = Math.hypot(v.x - p.x, v.y + 1 - p.y, v.z - p.z);
                if (d < P.splash + 1.5) this.damageVehicle(v, dmg * (1 - d / (P.splash + 2)) * this.vehicleMul(w), owner, w);
            }
        }
        if (p.type === 'popper') this.flashbang(p);
        if (p.type === 'powder') { const c = { id: this.nextId++, x: p.x, y: p.y, z: p.z, r: 5.5, life: 11 }; this.clouds.push(c); this.emit({ t: 'cloud', c: { ...c } }); }
        if (P.puddle) {
            const g = this.level.ground(p.x, p.z, 0.1, p.y + 0.5);
            if (g > p.y - 3) this.puddles.push({ id: this.nextId++, x: p.x, y: g, z: p.z, r: 2.6, life: 10 });
        }
        this.emit({ t: 'burst', id: p.id, type: p.type, x: p.x, y: p.y, z: p.z, n, hit: direct ? direct.id : 0, big: !!P.splash });
    }

    /* ---------- rake traps ---------- */
    stepTraps(dt) {
        for (const tr of this.traps) {
            tr.life -= dt; tr.arm -= dt;
            if (tr.arm > 0) continue;
            const owner = this.byId(tr.owner);
            for (const b of this.actors) {
                if (!b.alive || b.id === tr.owner || (owner && !this.enemies(owner, b))) continue;
                if (Math.abs(b.y - tr.y) < 0.7 && (b.x - tr.x) ** 2 + (b.z - tr.z) ** 2 < 0.8 * 0.8) {
                    tr.life = 0;
                    b.stunT = 0.8; b.vx *= 0.2; b.vz *= 0.2;
                    this.emit({ t: 'trap', id: tr.id, x: tr.x, y: tr.y, z: tr.z, vic: b.id });
                    this.damage(b, 45, owner, 'trap', { kind: 'melee' });
                    break;
                }
            }
        }
        const gone = this.traps.filter((t) => t.life <= 0);
        if (gone.length) { for (const t of gone) this.emit({ t: 'trapgone', id: t.id }); this.traps = this.traps.filter((t) => t.life > 0); }
    }

    /* ---------- the RC car ---------- */
    stepCars(dt) {
        for (const c of this.cars) {
            const o = this.byId(c.owner);
            if (!o || !o.alive) { this.explodeCar(c); continue; }
            c.life -= dt;
            const I = o.in;
            // the owner steers with the mouse; forward and back drive it
            c.yaw = o.yaw;
            const thr = I.mz !== 0 ? I.mz : 1;
            const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
            const want = 17 * thr;
            const cur = c.vx * fx + c.vz * fz;
            const ncur = cur + clamp(want - cur, -40 * dt, 30 * dt);
            c.vx = fx * ncur; c.vz = fz * ncur;
            c.vy -= GRAV * dt;
            for (let i = 0; i < SUB; i++) this.level.move(c, dt / SUB, 0.6);
            if (c.ground && c.on && c.on.tramp) { this.launch(c, c.on.tramp); }
            let boom = c.life <= 0 || c.y < (this.map.killY != null ? this.map.killY : -20) || (I.fire1 && !c.held1) || (I.fire2 && !c.held2);
            c.held1 = I.fire1; c.held2 = I.fire2;
            for (const b of this.actors) {
                if (b === o || !b.alive || !this.enemies(o, b)) continue;
                if (Math.abs(b.y + 0.5 - c.y) < 1.4 && (b.x - c.x) ** 2 + (b.z - c.z) ** 2 < 1.0) boom = true;
            }
            if (boom) this.explodeCar(c);
        }
        this.cars = this.cars.filter((c) => !c.dead);
    }
    deployCar(a) {
        const d = this.aim(a), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        let x = a.x + fx * 1.0, z = a.z + fz * 1.0;
        if (this.level.blocked(x, a.y, z, 0.3, 0.45, 0.4)) { x = a.x; z = a.z; }
        const c = { id: this.nextId++, owner: a.id, x, y: a.y + 0.05, z, vx: fx * 6, vy: 0, vz: fz * 6, yaw: a.yaw, r: 0.3, h: 0.45, ground: false, life: 14, held1: true, held2: a.in.fire2 };
        this.cars.push(c);
        a.car = c;
        this.emit({ t: 'car', id: c.id, owner: a.id });
        return c;
    }
    explodeCar(c) {
        if (c.dead) return;
        c.dead = true;
        const o = this.byId(c.owner);
        if (o) {
            o.car = null;
            if (!this.has(o, 'rc')) { delete o.inv.rc; o.next = null; o.cur = this.bestWeapon(o); o.switchT = 0; }
        }
        const R = 7;
        for (const b of this.actors) {
            if (!b.alive) continue;
            const cy = b.y + b.h * 0.5, d = Math.hypot(b.x - c.x, cy - c.y, b.z - c.z);
            if (d > R || !this.level.clear(c.x, c.y + 0.3, c.z, b.x, cy, b.z)) continue;
            const k = clamp(1 - d / R, 0.25, 1);
            this.damage(b, 230 * k * (b === o ? 0.6 : 1), o, 'rc', { kind: 'splash' });
            const dl = d || 1;
            this.impulse(b, (b.x - c.x) / dl * 16 * k, 9 * k + 2, (b.z - c.z) / dl * 16 * k);
        }
        this.emit({ t: 'carboom', id: c.id, x: c.x, y: c.y, z: c.z });
    }

    /* ---------- pickups ---------- */
    pickups(a) {
        for (const it of this.items) {
            if (it.t > 0) continue;
            if (Math.abs(a.x - it.x) > 0.95 || Math.abs(a.z - it.z) > 0.95 || a.y - it.y > 0.6 || it.y - a.y > 1.6) continue;
            this.take(a, it);
        }
    }
    take(a, it) {
        const D = ITEMS[it.type];
        if (!D) return false;
        if (D.hp) { if (a.hp >= D.cap) return false; a.hp = Math.min(D.cap, a.hp + D.hp); }
        else if (D.armor) { if (a.armor >= MAX_ARMOR) return false; a.armor = Math.min(MAX_ARMOR, a.armor + D.armor); }
        else if (D.power) { a.pw[D.power] = D.time; }
        else if (D.weapon) {
            const w = D.weapon, W = WEAPONS[w];
            const had = !!a.inv[w];
            if (w === 'rc' && (had || a.car)) return false;
            if (w === 'rake') { a.traps = Math.min(3, a.traps + 2); if (had) { this.itemTaken(a, it, D); return true; } }
            const upgrade = w === 'pistol' && had && !a.dual;
            if (W.ammo) {
                if (had && !upgrade && (a.ammo[w] || 0) >= W.ammo[1]) return false;
                if (upgrade) a.dual = true;
                a.ammo[w] = Math.min(W.ammo[1], (a.ammo[w] || 0) + W.ammo[0]);
            } else if (had && w !== 'rake') return false;
            a.inv[w] = true;
            if (!had && !a.in.fire1 && (!a.bot || a.bot.wants(w))) this.select(a, w);
        } else if (D.ammoFor) {
            const w = D.ammoFor, W = WEAPONS[w];
            if ((a.ammo[w] || 0) >= W.ammo[1]) return false;
            a.ammo[w] = Math.min(W.ammo[1], (a.ammo[w] || 0) + W.ammo[2]);
        }
        this.itemTaken(a, it, D);
        return true;
    }
    itemTaken(a, it, D) {
        it.t = D.respawn;
        this.emit({ t: 'pickup', id: it.id, by: a.id, type: it.type });
    }
}
installConquest(World);
World.prototype.vehicleSeat = function (a) { const v = this.vehicle(a.veh); return v ? VEHICLES[v.type].seats[a.seat] : null; };
const weaponOf = (type) => ({ cone: 'cone', blob: 'pistol', balloon: 'balloon', bigballoon: 'balloon', acorn: 'blower', baseball: 'bat', tennis: 'tennis', lob: 'tennis', rocket: 'rocket' }[type] || type);

/* ---------- what each weapon does ---------- */
const HANDLERS = {
    noodle(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        if (f1) { a.fireT = 0.38; a.swing = 0.3; a.swingK = 0; W.fired(a, 'swing'); W.melee(a, 2.4, 0.6, 16, { knock: 8, up: 3 }); }
        else if (f2) { a.fireT = 0.75; a.swing = 0.5; a.swingK = 1; W.fired(a, 'whack'); W.melee(a, 2.3, 0.5, 30, { knock: 2, up: 11 }); }
    },
    slicer(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        if (f1) { a.fireT = 0.28; a.swing = 0.22; a.swingK = 0; W.fired(a, 'slice'); W.melee(a, 2.1, 0.55, 20, { knock: 3, up: 1 }); }
        else if (f2) {
            a.fireT = 0.9; a.swing = 0.35; a.swingK = 1; a.lungeT = 0.24; a.lungeHit = false;
            const d = W.aim(a), hl = Math.hypot(d[0], d[2]) || 1;
            a.vx = d[0] / hl * 15; a.vz = d[2] / hl * 15; a.vy = Math.max(a.vy, 2.5); a.ground = false;
            W.fired(a, 'lunge');
        }
    },
    rake(W, a, dt, f1, f2, e1, e2) {
        if (a.fireT > 0) return;
        if (f1) { a.fireT = 0.65; a.swing = 0.45; a.swingK = 0; W.fired(a, 'sweep'); W.melee(a, 2.8, 1.0, 32, { knock: 6, up: 2, all: true }); }
        else if (e2 && a.traps > 0 && a.ground) {
            const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
            let x = a.x + fx * 1.3, z = a.z + fz * 1.3;
            if (W.level.blocked(x, a.y, z, 0.3, 0.5, 0.3)) { x = a.x; z = a.z; }
            const y = W.level.ground(x, z, 0.2, a.y + 0.5);
            if (y < a.y - 1.5) return;
            a.traps--; a.fireT = 0.6; a.swing = 0.3; a.swingK = 1;
            const tr = { id: W.nextId++, owner: a.id, x, y, z, yaw: a.yaw, life: 45, arm: 0.6 };
            W.traps.push(tr);
            W.fired(a, 'trap');
            W.emit({ t: 'trapset', tr: { ...tr } });
        }
    },
    whip(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        if (f1) {
            a.fireT = 0.55; a.swing = 0.3; a.swingK = 0;
            const r = W.hitscan(a, W.aim(a), 5.5, 24, { knock: 4, up: 2 });
            W.fired(a, 'crack', { to: r.p });
        } else if (f2) {
            a.fireT = 1.1; a.swing = 0.4; a.swingK = 1;
            const d = W.aim(a), e = W.eye(a);
            // grab an item if one is close to the line, else yank whoever is there
            let best = null, bt = 15;
            for (const it of W.items) {
                if (it.t > 0) continue;
                const vx = it.x - e[0], vy = it.y + 0.6 - e[1], vz = it.z - e[2];
                const t = vx * d[0] + vy * d[1] + vz * d[2];
                if (t < 0 || t > bt) continue;
                const off = Math.hypot(vx - d[0] * t, vy - d[1] * t, vz - d[2] * t);
                if (off < 0.9 && W.level.clear(e[0], e[1], e[2], it.x, it.y + 0.6, it.z)) { best = it; bt = t; }
            }
            const r = W.hitscan(a, d, 15, 6, { wpn: 'whip' });
            if (r.vic && Math.hypot(r.p[0] - e[0], r.p[1] - e[1], r.p[2] - e[2]) < bt) {
                const b = r.vic, dx = a.x - b.x, dz = a.z - b.z, L = Math.hypot(dx, dz) || 1;
                W.impulse(b, dx / L * Math.min(14, L * 2.2), 5, dz / L * Math.min(14, L * 2.2));
                W.fired(a, 'grab', { to: r.p, vic: b.id });
            } else if (best) {
                W.fired(a, 'grab', { to: [best.x, best.y + 0.6, best.z], item: best.id });
                W.take(a, best);
            } else W.fired(a, 'grab', { to: r.p });
        }
    },
    pistol(W, a, dt, f1, f2, e1, e2) {
        if (f2 && (a.ammo.pistol || 0) >= 5 && a.fireT <= 0) { a.charge = Math.min(1, a.charge + dt / 0.9); return; }
        if (a.charge > 0) {
            if (!f2) {
                const c = a.charge; a.charge = 0;
                if (W.use(a, 5)) {
                    a.fireT = 0.4;
                    W.shoot(a, 'blob', W.aim(a), 30, { extra: 18 + 42 * c, size: c });
                    W.fired(a, 'blob', { c });
                }
            }
            return;
        }
        if (f1 && a.fireT <= 0 && W.use(a, 1)) {
            a.fireT = a.dual ? 0.07 : 0.12;
            const r = W.hitscan(a, W.spread(W.aim(a), a.dual ? 0.022 : 0.012), 60, 8);
            W.fired(a, 'squirt', { to: r.p, wall: r.wall, n: r.n });
        }
    },
    balloon(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        const d = W.aim(a), up = [d[0], d[1] + 0.12, d[2]], l = Math.hypot(...up);
        const dir = up.map((v) => v / l);
        if (f1 && W.use(a, 1)) { a.fireT = 0.6; W.shoot(a, 'balloon', dir, 17); W.fired(a, 'throw'); }
        else if (f2 && W.use(a, 2)) { a.fireT = 0.9; W.shoot(a, 'bigballoon', dir, 13); W.fired(a, 'throw', { big: true }); }
    },
    blower(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        const d = W.aim(a);
        if (f1 && W.use(a, 1)) {
            a.fireT = 0.85;
            for (let i = 0; i < 9; i++) W.shoot(a, 'acorn', W.spread(d, 0.09), rnd(48, 58));
            W.fired(a, 'spray');
        } else if (f2 && W.use(a, 1)) {
            a.fireT = 0.8;
            const e = W.eye(a);
            for (const b of W.actors) {
                if (b === a || !b.alive) continue;
                const vx = b.x - e[0], vy = b.y + 1 - e[1], vz = b.z - e[2], L = Math.hypot(vx, vy, vz);
                if (L > 7.5 || (vx * d[0] + vy * d[1] + vz * d[2]) / L < Math.cos(0.6)) continue;
                if (!W.level.clear(e[0], e[1], e[2], b.x, b.y + 1, b.z)) continue;
                const k = 1 - L / 9;
                W.damage(b, 5, a, 'blower', { kind: 'hit' });
                W.impulse(b, d[0] * 17 * k, 5 + Math.max(0, d[1]) * 10 * k, d[2] * 17 * k);
            }
            W.deflect(a, 7, 0.6, 1.0, false);
            // and it pushes you back: aim at the floor and it's a blast jump
            W.impulse(a, -d[0] * 9, Math.max(0, -d[1]) * 10, -d[2] * 9);
            W.fired(a, 'blast');
        }
    },
    bat(W, a, dt, f1, f2) {
        if (a.fireT > 0) return;
        if (f1 && W.use(a, 1)) { a.fireT = 0.75; W.shoot(a, 'baseball', W.aim(a), 46); W.fired(a, 'pitch'); }
        else if (f2) {
            a.fireT = 0.55; a.swing = 0.35; a.swingK = 1;
            const n = W.deflect(a, 3.4, 0.95, 1.4, true);
            W.melee(a, 2.4, 0.7, 30, { knock: 10, up: 4 });
            W.fired(a, 'bat', { homerun: n > 0 });
        }
    },
    tennis(W, a, dt, f1, f2) {
        if (f1 && (a.ammo.tennis || 0) > 0) {
            a.spin = Math.min(1, a.spin + dt / 0.35);
            if (a.spin >= 1 && a.fireT <= 0 && W.use(a, 1)) {
                a.fireT = 0.072;
                W.shoot(a, 'tennis', W.spread(W.aim(a), 0.035), 62);
                W.fired(a, 'serve');
            }
            return;
        }
        a.spin = Math.max(0, a.spin - dt / 0.6);
        if (f2 && a.fireT <= 0 && W.use(a, 2)) {
            a.fireT = 0.33;
            const d = W.aim(a), up = [d[0], d[1] + 0.2, d[2]], l = Math.hypot(...up);
            W.shoot(a, 'lob', up.map((v) => v / l), 24);
            W.fired(a, 'lob');
        }
    },
    rocket(W, a, dt, f1, f2) {
        // hold alt to load up to three, let go to fire them in a fan
        if (f2 && a.fireT <= 0) {
            if (a.loaded === 0) { a.loaded = 1; a.loadT = 0; W.fired(a, 'load', { n: 1 }); }
            a.loadT += dt;
            if (a.loadT > 0.45 && a.loaded < Math.min(3, a.ammo.rocket || 0)) { a.loaded++; a.loadT = 0; W.fired(a, 'load', { n: a.loaded }); }
            return;
        }
        if (a.loaded > 0) {
            const n = Math.min(a.loaded, a.ammo.rocket || 0); a.loaded = 0;
            const d = W.aim(a), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
            for (let i = 0; i < n; i++) {
                const o = (i - (n - 1) / 2) * 0.09;
                const v = [d[0] + rx * o, d[1], d[2] + rz * o], l = Math.hypot(...v);
                if (W.use(a, 1)) W.shoot(a, 'rocket', v.map((q) => q / l), 24);
            }
            a.fireT = 1.0;
            W.fired(a, 'rocket', { n });
            return;
        }
        if (f1 && a.fireT <= 0 && W.use(a, 1)) { a.fireT = 0.9; W.shoot(a, 'rocket', W.aim(a), 24); W.fired(a, 'rocket', { n: 1 }); }
    },
    golf(W, a, dt, f1, f2) {
        a.zoom = f2;
        if (f1 && a.fireT <= 0 && W.use(a, 1)) {
            a.fireT = 1.25; a.swing = 0.4; a.swingK = 0;
            const r = W.hitscan(a, W.aim(a), 160, 70, { head: 140, knock: 3, up: 1 });
            W.fired(a, 'drive', { to: r.p, head: r.head && !!r.vic });
        }
    },
    rc(W, a, dt, f1, f2, e1) {
        if (a.car) return;
        if (e1 && a.fireT <= 0 && W.use(a, 1)) { a.fireT = 0.5; W.deployCar(a); W.fired(a, 'deploy'); }
    }
};

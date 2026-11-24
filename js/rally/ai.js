/* Rival drivers. Each track gets a racing line (cutting to the inside of bends) and a speed profile
   (how fast each corner can be taken, braking early enough to get there). Drivers follow it with their
   own skill, dodge cars ahead, steer for pickups, and use power-ups with simple tactics. */

import { DRIVERS } from './drivers.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/* Cars alongside. Without this every driver steers for its own line as if nobody else were there, and
   leans on whoever is beside it all the way down the straight. mem keeps a little state per driver.
   Returns a steering nudge away from cars beside us, and whether to drop back (we've been rubbing too long). */
export function traffic(c, cars, mem, ignore) {
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    let side = 0, touching = false;
    for (const o of cars || []) {
        if (o === c || o === ignore || o.out || o.wrecked > 0) continue;
        const ox = o.x - c.x, oz = o.z - c.z, fw = ox * fx + oz * fz, right = -ox * fz + oz * fx;
        if (fw < -5 || fw > 7 || Math.abs(right) > 3.8) continue;
        const push = 1 - Math.abs(right) / 3.8;
        side -= (Math.sign(right) || (c.x < o.x ? -1 : 1)) * push;                // steer right = +; away from them
        if (Math.abs(right) < 2.5 && fw > -3.5 && fw < 4.5) touching = true;
    }
    const now = performance.now() / 1000, dt = Math.min(0.1, now - (mem.t || now));
    mem.t = now;
    mem.side = (mem.side || 0) + (clamp(side, -1, 1) - (mem.side || 0)) * Math.min(1, dt * 8);
    mem.touch = touching ? (mem.touch || 0) + dt : Math.max(0, (mem.touch || 0) - dt * 2);
    // rubbing for a moment is racing; rubbing for longer means one of us has to give way, and it's us
    return { steer: mem.side * 0.7, yield: mem.touch > 0.35 };
}

// the rival drivers are the characters from drivers.js (the race grid uses rivalsFor, so whoever you pick isn't racing you)
export const RIVALS = DRIVERS.slice(0, 7);

// Racing line and speed profile for a track, computed once.
export function plan(track, grip = 1) {
    if (track.plan) return track.plan;
    const { S, N, seg } = track;
    const head = S.map((s) => Math.atan2(s.tx, s.tz));
    const kappa = S.map((s, i) => wrap(head[(i + 4) % N] - head[(i - 4 + N) % N]) / (8 * seg));
    // smooth the curvature, then lean towards the inside of each bend
    const sm = kappa.map((_, i) => { let a = 0; for (let k = -6; k <= 6; k++) a += kappa[(i + k + N) % N]; return a / 13; });
    // heading increasing = turning left = the left side (negative d) is the inside
    const line = sm.map((k) => clamp(-k * 90, -0.3, 0.3));
    // corner speed from the lateral grip, then a backwards pass so the car brakes in time
    const lat = 15 * grip;
    const v = sm.map((k) => Math.min(70, Math.sqrt(lat / Math.max(1e-4, Math.abs(k)))));
    const decel = 17;
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) {
        const n = (i + 1) % N;
        v[i] = Math.min(v[i], Math.sqrt(v[n] * v[n] + 2 * decel * seg));
    }
    return (track.plan = { line, v, kappa: sm });
}

export class Driver {
    constructor(car, info, skill) {
        this.car = car;
        this.name = info.name;
        this.style = info.style;
        this.skill = skill;
        this.bias = (Math.random() - 0.5) * 0.25;       // their favourite bit of road
        this.dodge = 0; this.dodgeT = 0;
        this.think = 0.5 + Math.random();
        this.lazy = 1;                                  // rubber band, so nobody is left alone
        this.mem = {};                                  // for traffic()
        this.ramT = 0; this.ramCool = 2 + Math.random() * 4;
    }
    drive(ctx) {
        const c = this.car, { track } = ctx, P = plan(track, c.spec.grip);
        const { S, N } = track, i = c.q.i;
        // where to aim: a point ahead on the racing line, shifted for dodging and pickups
        const look = 5 + Math.floor(c.speed / 3.5);
        const j = (i + look) % N, t = S[j];
        let off = P.line[j] + this.bias * 0.5 + this.dodge;
        if (this.wantPick != null) off = this.wantPick;
        // a nemesis hunts you: anywhere near, it lines up on your bit of the road
        const pl = ctx.player;
        if (this.nemesis && pl && pl !== c && pl.wrecked <= 0) {
            const gap = ((pl.q.prog - c.q.prog) % N + N) % N;
            if (gap < 40 || gap > N - 15) off = pl.q.d / Math.max(1, S[pl.q.i].w);
        }
        off = clamp(off, -0.4, 0.4) * t.w;
        const dx = t.x + t.sx * off - c.x, dz = t.z + t.sz * off - c.z;
        const err = wrap(Math.atan2(dx, dz) - c.h);
        // speed: the slowest corner just ahead, scaled by skill and rubber band
        let vmax = 99;
        for (let k = 0; k < 14; k += 2) vmax = Math.min(vmax, P.v[(i + k + Math.floor(c.speed / 6)) % N]);
        vmax *= this.skill * this.lazy * (c.spec.maxSpeed / 52);
        // ease off rather than run into the back of whoever is just ahead
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        for (const o of ctx.cars || []) {
            if (o === c || o.out || o.wrecked > 0) continue;
            const ox = o.x - c.x, oz = o.z - c.z, fwd = ox * fx + oz * fz, lat = Math.abs(ox * fz - oz * fx);
            if (fwd > 0 && fwd < 7 + c.speed * 0.4 && lat < 2.4 && c.speed > o.speed) vmax = Math.min(vmax, o.speed + Math.max(0, fwd - 5.5) * 0.9);
        }
        // aggressive drivers give the player one shove now and then, not a push all the way down the straight
        const now = performance.now() / 1000, dt = Math.min(0.1, now - (this.lastT || now));
        this.lastT = now;
        this.ramCool -= dt; this.ramT -= dt;
        let ram = 0;
        const p = ctx.player;
        if (p && p !== c && (this.style === 'aggressive' || this.nemesis) && p.wrecked <= 0 && c.speed > 12) {
            const ox = p.x - c.x, oz = p.z - c.z, fw = ox * fx + oz * fz, right = -ox * fz + oz * fx;
            const beside = fw > -3 && fw < 5 && Math.abs(right) > 1.2 && Math.abs(right) < 5;
            if (beside && this.ramCool <= 0 && this.ramT <= 0) { this.ramT = 0.5; this.ramCool = this.nemesis ? 2.5 + Math.random() * 2 : 5 + Math.random() * 4; }
            if (beside && this.ramT > 0) ram = Math.sign(right) * 0.5;
        }
        const tr = traffic(c, ctx.cars, this.mem, ram ? p : null);
        // show-offs (the title screen's drivers) kart-drift every bend: in when one is coming, out on the exit
        let drift = false;
        if (this.showoff) {
            let bend = 0;
            for (let a = 2; a < 12; a += 2) bend = Math.max(bend, Math.abs(P.kappa[(i + a + Math.floor(c.speed / 5)) % N]));
            if (!this.drifting && bend > 0.012 && c.speed > 15 && c.ground) this.drifting = true;
            else if (this.drifting && (bend < 0.005 || c.speed < 9)) this.drifting = false;
            drift = this.drifting;
        }
        const over = c.speed - vmax;
        return {
            steer: clamp(-err * 2.6 + ram + (ram ? 0 : tr.steer), -1, 1),
            throttle: tr.yield ? 0 : over < -1 ? 1 : over < 1 ? 0.4 : 0,
            brake: tr.yield && c.speed > 10 ? 0.25 : over > 3 ? clamp(over / 8, 0.3, 1) : 0,
            drift,
            handbrake: !drift && Math.abs(err) > 0.7 && c.speed > 18
        };
    }
    // called a few times a second: dodge traffic, chase pickups, fire things
    tactics(dt, ctx) {
        const c = this.car, { cars, track, weapons, rank, player, pickups } = ctx;
        const N = track.N;
        const ahead = (o) => { const d = (o.q.prog - c.q.prog + N) % N; return d < N / 2 ? d : d - N; };
        // dodge: a slower car just ahead on our line, move over
        this.dodgeT -= dt;
        if (this.dodgeT <= 0) {
            this.dodge *= 0.6;
            for (const o of cars) {
                if (o === c) continue;
                const a = ahead(o);
                if (a > 0 && a < 8 && Math.abs(o.q.d - c.q.d) < 2.4 && o.speed < c.speed + 2) {
                    this.dodge = (o.q.d > 0 ? -1 : 1) * 0.22; this.dodgeT = 1.2; break;
                }
            }
        }
        // pickups in the next stretch, if there is room for one
        this.wantPick = null;
        if (pickups && c.slots.length < 3) {
            for (const p of pickups.items) {
                if (p.off > 0) continue;
                const q = track.query(p.x, p.z, c.q.i);
                const a = (q.prog - c.q.prog + N) % N;
                if (a > 4 && a < 28) { this.wantPick = q.d / track.S[q.i].w; break; }
            }
        }
        // rubber band against the player
        if (player) {
            const gap = ahead(player);
            this.lazy = gap < -80 ? 0.93 : gap > 80 ? 1.07 : 1;
        }
        // power-ups, after a little reaction time
        this.think -= dt;
        if (this.think > 0 || !c.slots.length || c.wrecked > 0) return;
        this.think = this.style === 'aggressive' ? 0.35 : this.style === 'hoarder' ? 1.4 : 0.8;
        const slot = c.slots[c.sel || 0];
        const order = rank();
        const myPos = order.indexOf(c);
        const near = cars.filter((o) => o !== c && o.wrecked <= 0 && Math.hypot(o.x - c.x, o.z - c.z) < 11);
        const behind = cars.find((o) => o !== c && o.wrecked <= 0 && ahead(o) < 0 && ahead(o) > -14);
        const incoming = weapons.shots.some((s) => s.target === c && s.kind === 'seeker');
        let fire = null;
        switch (slot.type) {
            case 'volt': if (weapons.pick(c, cars, false, 0.45, 70)) fire = 'f'; else if (weapons.pick(c, cars, true, 0.4, 35)) fire = 'b'; break;
            case 'seeker': if (weapons.nextInRace(c, cars, false) && myPos > 0) fire = 'f'; break;
            case 'mine': if (behind) fire = 'b'; else if (weapons.pick(c, cars, false, 0.25, 25)) fire = 'f'; break;
            case 'pulse': if (near.length) fire = 'f'; break;
            case 'storm': if (myPos > 0) fire = 'f'; break;
            case 'nitro': { const P = plan(track); let curvy = 0; for (let k = 0; k < 30; k += 3) curvy = Math.max(curvy, Math.abs(P.kappa[(c.q.i + k) % N])); if (curvy < 0.01 && c.speed > 18) fire = 'f'; break; }
            case 'barrier': if (incoming || (c.health < 60 && near.length) || this.style === 'aggressive') fire = 'f'; break;
            case 'patch': if (c.health < 55) fire = 'f'; break;
        }
        // careful drivers keep a shield if they have one and something is coming
        if (incoming && c.slots.some((s) => s.type === 'barrier')) { c.sel = c.slots.findIndex((s) => s.type === 'barrier'); fire = 'f'; }
        if (fire) weapons.fire(c, fire === 'b', cars);
        else if (c.slots.length > 1 && Math.random() < 0.3) c.sel = (c.sel + 1) % c.slots.length;
    }
}

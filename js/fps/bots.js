/* Bots: a waypoint graph worked out from the map's geometry, and a simple brain that looks for enemies,
   picks up what it needs, chooses a weapon for the range, leads its shots, strafes, slides and dodges. */
import { ITEMS, WEAPONS, SKILLS, CLASSES, VEHICLES } from './defs.js';
import { PROJ } from './sim.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rnd = (a, b) => a + Math.random() * (b - a);

export class Nav {
    constructor(level, map, progress) {
        this.level = level;
        const pts = map.nodes ? map.nodes.map((p) => [...p]) : this.autoNodes(level, map);
        const N = this.nodes = pts.map(([x, y, z], i) => ({ i, x, y, z }));
        this.links = N.map(() => []);           // [to, cost]
        // a grid of nodes for quick neighbour lookups
        this.cs = 8; this.cells = new Map();
        for (const nd of N) { const k = this.key(nd.x, nd.z); if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(nd); }
        const has = (a, b) => this.links[a].some((l) => l[0] === b);
        const link = (a, b, c) => { if (!has(a, b)) this.links[a].push([b, c]); };
        const R = map.nodes ? 16 : (map.navStep || 5) * 2.3;
        for (const a of N) {
            for (const b of this.around(a.x, a.z, R)) {
                if (b.i <= a.i) continue;
                const d = Math.hypot(a.x - b.x, a.z - b.z);
                if (d > R) continue;
                if (this.walkable(a, b)) { const c = d + Math.abs(a.y - b.y) * 0.5; link(a.i, b.i, c); link(b.i, a.i, c); }
                else if (!map.nodes && d < 6) {
                    // off a ledge: one way down
                    if (a.y - b.y > 1.2 && this.droppable(a, b)) link(a.i, b.i, d + 1);
                    else if (b.y - a.y > 1.2 && this.droppable(b, a)) link(b.i, a.i, d + 1);
                }
            }
        }
        const specials = [...(map.links || [])];
        for (const s of level.solids) if (s.tramp) specials.push([[(s.x0 + s.x1) / 2, s.y1, (s.z0 + s.z1) / 2], s.tramp.to]);
        for (const [from, to] of specials) {
            const a = this.closest(...from), b = this.closest(...to);
            link(a.i, b.i, 3);
            a.tramp = true;
        }
        this.cache = new Map();
    }
    key(x, z) { return Math.floor(x / this.cs) * 100003 + Math.floor(z / this.cs); }
    around(x, z, r) {
        const out = [], n = Math.ceil(r / this.cs);
        const cx = Math.floor(x / this.cs), cz = Math.floor(z / this.cs);
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const c = this.cells.get((cx + i) * 100003 + cz + j); if (c) out.push(...c); }
        return out;
    }
    // waypoints on every walkable top surface, spaced out, where a body fits
    autoNodes(level, map) {
        const step = map.navStep || 5, out = [], B = map.bounds;
        const add = (x, y, z) => {
            if (!isFinite(y)) return;
            if (x < B.x0 + 0.5 || x > B.x1 - 0.5 || z < B.z0 + 0.5 || z > B.z1 - 0.5) return;
            const g = level.ground(x, z, 0.3, y + 0.35);
            if (Math.abs(g - y) > 0.3) return;
            y = g;
            if (level.blocked(x, y, z, 0.36, 1.75, 0.3)) return;
            for (const o of out) if (Math.abs(o[1] - y) < 1.2 && Math.hypot(o[0] - x, o[2] - z) < step * 0.5) return;
            out.push([x, y, z]);
        };
        // doorways and other spots the map asks for come first
        for (const [x, y, z] of map.navExtra || []) out.push([x, y, z]);
        // stairs and slopes first, so the ground grid makes way for their ends rather than the other way round
        const solids = level.solids.filter((s) => !(s.ghost || s.clip || s.noNav || s.tramp) && s.x1 - s.x0 >= 0.9 && s.z1 - s.z0 >= 0.9);
        for (const s of [...solids.filter((q) => q.k !== 0), ...solids.filter((q) => q.k === 0)]) {
            const w = s.x1 - s.x0, d = s.z1 - s.z0;
            if (s.k === 0) {
                const nx = Math.max(1, Math.round(w / step)), nz = Math.max(1, Math.round(d / step));
                for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) add(s.x0 + (i + 0.5) * w / nx, s.y1, s.z0 + (j + 0.5) * d / nz);
            } else if (s.steps || Math.abs(s.yb - s.ya) / (s.ax === 0 ? w : d) < 1.05) {
                // stairs and slopes: both ends and the middle
                const lo = s.ax === 0 ? s.x0 : s.z0, hi = s.ax === 0 ? s.x1 : s.z1, mid = s.ax === 0 ? (s.z0 + s.z1) / 2 : (s.x0 + s.x1) / 2;
                const n = Math.max(2, Math.round((hi - lo) / step));
                for (let i = 0; i <= n; i++) {
                    const c = lo + 0.35 + (hi - lo - 0.7) * i / n, y = s.ya + (s.yb - s.ya) * (c - lo) / (hi - lo);
                    if (s.ax === 0) add(c, y, mid); else add(mid, y, c);
                }
                // and just off each end, on whatever is there
                for (const [c, y] of [[lo - 0.6, s.ya], [hi + 0.6, s.yb]]) {
                    const x = s.ax === 0 ? c : mid, z = s.ax === 0 ? mid : c;
                    add(x, level.ground(x, z, 0.3, y + 0.3), z);
                }
            }
        }
        return out;
    }
    // can you walk in a straight line from a to b? The floor has to follow the line, and nothing may be in the way.
    walkable(a, b) {
        const L = this.level, d = Math.hypot(a.x - b.x, a.z - b.z), steps = Math.max(2, Math.ceil(d / 0.5));
        // nothing you can walk up is steeper than a stair: this keeps floors stacked above each other apart
        if (Math.abs(a.y - b.y) > d * 1.1 + 0.6) return false;
        for (let k = 0; k <= steps; k++) {
            const t = k / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
            const g = L.ground(x, z, 0.3, y + 0.75);
            if (g < y - 0.75) return false;
            if (L.blocked(x, g, z, 0.32, 1.6, 0.6)) return false;
        }
        return true;
    }
    // walking off an edge from a lands you at b, without walking into anything
    droppable(a, b) {
        const L = this.level, d = Math.hypot(a.x - b.x, a.z - b.z), steps = Math.max(2, Math.ceil(d / 0.4));
        let prev = a.y;
        for (let k = 0; k <= steps; k++) {
            const t = k / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
            const g = L.ground(x, z, 0.3, prev + 0.3);
            if (g > prev + 0.25 || g < b.y - 0.6) return false;
            if (L.blocked(x, Math.max(g, b.y), z, 0.32, 1.6, 0.5)) return false;
            prev = g;
        }
        return Math.abs(prev - b.y) < 0.6;
    }
    // the node to aim for to reach a spot: the nearest one that can see it (so not one round the other side of a wall)
    closestSeen(x, y, z) {
        const list = this.around(x, z, 14).filter((nd) => Math.abs(nd.y - y) <= 2.6).map((nd) => [Math.hypot(nd.x - x, nd.z - z) + Math.abs(nd.y - y) * 2, nd]).sort((p, q) => p[0] - q[0]);
        for (const [, nd] of list.slice(0, 10)) if (this.level.clear(x, y + 0.9, z, nd.x, nd.y + 0.9, nd.z)) return nd;
        return this.closest(x, y, z);
    }
    closest(x, y, z) {
        let best = null, bd = Infinity;
        let list = this.around(x, z, 12);
        if (!list.length) list = this.nodes;
        for (const nd of list) { const d = Math.hypot(nd.x - x, nd.z - z) + Math.abs(nd.y - y) * 3; if (d < bd) { bd = d; best = nd; } }
        return best || this.nodes[0];
    }
    // the node a body at (x,y,z) can head for: close, on about the same floor, in sight
    from(x, y, z) {
        const list = this.around(x, z, 14).map((nd) => [Math.hypot(nd.x - x, nd.z - z) + Math.abs(nd.y - y) * 4, nd]).filter(([, nd]) => Math.abs(nd.y - y) <= 2.6).sort((p, q) => p[0] - q[0]);
        for (const [, nd] of list.slice(0, 8)) if (this.level.clear(x, y + 0.9, z, nd.x, nd.y + 0.9, nd.z)) return nd;
        return this.closest(x, y, z);
    }
    // shortest paths from one node to all others, remembered for a while
    from1(a, links = this.links, cache = this.cache) {
        let r = cache.get(a.i);
        if (r) return r;
        const n = this.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
        dist[a.i] = 0;
        const heap = [[0, a.i]];
        const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        heap.length = 0; push([0, a.i]);
        while (heap.length) {
            const [d, i] = pop();
            if (d > dist[i]) continue;
            for (const [j, c] of links[i]) { const nd = d + c; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push([nd, j]); } }
        }
        r = { dist, prev };
        if (cache.size > 64) cache.delete(cache.keys().next().value);
        cache.set(a.i, r);
        return r;
    }
    path(a, b, links, cache) {
        const { dist, prev } = this.from1(a, links, cache);
        if (!isFinite(dist[b.i])) return null;
        const out = [];
        for (let i = b.i; i !== a.i && i >= 0 && out.length < 400; i = prev[i]) out.push(this.nodes[i]);
        return out.reverse();
    }
    cost(a, b) { const d = this.from1(a).dist[b.i]; return isFinite(d) ? d : 1e9; }
    /* The graph a vehicle can drive: the walking links that are wide enough for it, have no steps or stairs
       and aren't too steep. Worked out the first time a bot drives something that size. */
    vgraph(r) {
        const key = r > 1.2 ? 'big' : 'small', R = key === 'big' ? 1.7 : 0.95;
        this.vg = this.vg || {};
        if (this.vg[key]) return this.vg[key];
        const L = this.level, links = this.nodes.map(() => []);
        const ok = (a, b) => {
            const d = Math.hypot(a.x - b.x, a.z - b.z), steps = Math.max(2, Math.ceil(d / 0.6));
            if (Math.abs(a.y - b.y) > d * 0.7 + 0.3) return false;
            let prev = a.y;
            for (let k = 0; k <= steps; k++) {
                const t = k / steps, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
                const g = L.ground(x, z, 0.3, Math.max(prev, y) + 0.7);
                if (!isFinite(g) || Math.abs(g - prev) > 0.5 || Math.abs(g - y) > 1.0) return false;
                if (L.blocked(x, g, z, R, 1.4, 0.6)) return false;
                prev = g;
            }
            return true;
        };
        this.nodes.forEach((a, i) => {
            for (const [j, c] of this.links[i]) if (j > i && this.links[j].some((l) => l[0] === i) && ok(a, this.nodes[j])) { links[i].push([j, c]); links[j].push([i, c]); }
        });
        return (this.vg[key] = { links, cache: new Map(), R });
    }
    // the node a vehicle here should start its route from: near, on its graph, and in a straight clear line
    vstart(v, G, avoid) {
        const list = this.around(v.x, v.z, 18).filter((n) => G.links[n.i].length && Math.abs(n.y - v.y) < 2.5 && !(avoid && avoid.has(n.i))).map((n) => [Math.hypot(n.x - v.x, n.z - v.z), n]).sort((p, q) => p[0] - q[0]);
        for (const [, n] of list.slice(0, 6)) if (this.level.clear(v.x, v.y + 1, v.z, n.x, n.y + 1, n.z)) return n;
        return list.length ? list[0][1] : null;
    }
}

// shortest paths over a set of links, keeping off some nodes (for a vehicle finding another way round)
function vroute(links, n, from, avoid) {
    const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
        let i = -1, bd = Infinity;
        for (let k = 0; k < n; k++) if (!done[k] && dist[k] < bd) { bd = dist[k]; i = k; }
        if (i < 0) break;
        done[i] = 1;
        for (const [j, c] of links[i]) { if (avoid.has(j)) continue; const nd = bd + c; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; } }
    }
    return { dist, prev };
}
// how much a bot likes each weapon at a distance
function rate(w, d) {
    switch (w) {
        case 'noodle': return d < 2.6 ? 30 : 0;
        case 'slicer': return d < 2.4 ? 45 : d < 5 ? 25 : 0;
        case 'rake': return d < 2.8 ? 50 : 0;
        case 'whip': return d < 5 ? 40 : 0;
        case 'pistol': return d < 25 ? 32 : 20;
        case 'balloon': return d > 3 && d < 16 ? 58 : 12;
        case 'blower': return d < 6 ? 85 : d < 10 ? 50 : 8;
        case 'bat': return d < 30 ? 56 : 30;
        case 'tennis': return d < 25 ? 72 : 50;
        case 'rocket': return d < 3 ? 15 : d < 22 ? 88 : 52;
        case 'golf': return d > 14 ? 84 : 42;
        default: return 0;
    }
}
const SPEED = { balloon: 17, bat: 46, tennis: 62, rocket: 24, pistol: 1e9, golf: 1e9, blower: 52, whip: 1e9 };
const GRAV = { balloon: PROJ.balloon.g, bat: PROJ.baseball.g, tennis: PROJ.tennis.g, blower: PROJ.acorn.g };

export class Bot {
    constructor(actor, skillIx = 1) {
        this.a = actor; actor.bot = this;
        this.S = SKILLS[clamp(skillIx, 0, SKILLS.length - 1)];
        this.target = null; this.seen = {}; this.reactT = 0;
        this.path = null; this.goal = null; this.goalT = 0; this.repath = 0;
        this.errX = 0; this.errY = 0;
        this.strafe = 1; this.strafeT = 0; this.trickT = 0; this.crouchT = 0; this.jumpT = 0;
        this.stuckT = 0; this.lastPos = [0, 0, 0]; this.weaponT = 0; this.senseT = 0;
    }
    wants(w) { return w !== 'rc'; }
    think(W, dt) {
        const a = this.a, I = a.in;
        I.fire1 = I.fire2 = false; I.jump = false; I.dodge = null;
        if (!a.alive || W.state === 'over') {
            I.mx = I.mz = 0; I.crouch = false; this.path = null; this.target = null; this.goal = null;
            if (W.rules.classes && !a.alive && !this.chose) { this.chose = true; this.chooseClass(W); }
            return;
        }
        this.chose = false;
        // in a vehicle: drive it, or ride along and shoot
        if (a.veh) {
            const v = W.vehicle(a.veh);
            if (v && a.seat === 0 && !VEHICLES[v.type].seats[0].gun) { this.drive(W, v, dt); this.aimAndFire(W, dt, true); return; }
            if (v && !v.seats[0]) { this.leaveT = (this.leaveT || 0) + dt; if (this.leaveT > 1.5) { this.leaveT = 0; I.use = true; } } else this.leaveT = 0;
            I.mx = I.mz = 0;
            this.senseT -= dt; if (this.senseT <= 0) { this.senseT = 0.1; this.sense(W); }
            this.reactT -= dt;
            this.aimAndFire(W, dt);
            return;
        }
        this.senseT -= dt; this.goalT -= dt; this.weaponT -= dt; this.strafeT -= dt; this.trickT -= dt; this.reactT -= dt;
        if (this.senseT <= 0) { this.senseT = 0.1; this.sense(W); }
        const T = this.target;
        // where to go
        let mx = 0, mz = 0;
        if (T && this.visible) {
            const d = Math.hypot(T.x - a.x, T.z - a.z);
            const pref = this.prefRange();
            const tx = (T.x - a.x) / (d || 1), tz = (T.z - a.z) / (d || 1);
            const want = d > pref + 3 ? 1 : d < pref - 2 ? -1 : 0;
            if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = rnd(0.4, 1.3); }
            const st = this.S.strafe;
            mx = tx * want - tz * this.strafe * st; mz = tz * want + tx * this.strafe * st;
            // if the way towards them is blocked, use the graph
            if (want > 0 && d > 8) {
                this.goalBlocked = false;
                const s = this.steer(W, T.x, T.y, T.z);
                // no way over to them (they're up a cliff, say): keep strafing here instead of running at the wall
                if (this.goalBlocked) { this.goalBlocked = false; mx = -tz * this.strafe * st; mz = tx * this.strafe * st; }
                else if (s) { mx = s[0] * 0.8 + mx * 0.2; mz = s[1] * 0.8 + mz * 0.2; }
            }
            this.avoidEdges(W, mx, mz) || (mx = -mx * 0.3, mz = -mz * 0.3, this.strafe = -this.strafe);
        } else {
            if (!this.goal || this.goalT <= 0 || this.reached()) this.pickGoal(W);
                this.aim = null;
            const s = this.goal ? this.steer(W, this.goal.x, this.goal.y, this.goal.z) : null;
            if (s) { mx = s[0]; mz = s[1]; }
            // not getting any closer to where we're heading: plan again; after that, give up on it for a while
            if (this.aim) {
                const d = Math.hypot(this.aim[0] - a.x, this.aim[1] - a.z), key = this.aim[0].toFixed(1) + ',' + this.aim[1].toFixed(1);
                if (key !== this.aimKey || d < this.aimBest - 0.5) { this.aimKey = key; this.aimBest = d; this.aimT = W.time; }
                else if (W.time - this.aimT > 2.5) { this.aimT = W.time; this.path = null; this.repathAt = 0; this.noProg = (this.noProg || 0) + 1; if (this.noProg >= 2) this.goalBlocked = true; }
            }
            if (this.goalBlocked) {
                this.goalBlocked = false; this.noProg = 0;
                if (this.goal && this.goal.it) (this.avoid || (this.avoid = new Map())).set(this.goal.it, W.time + 15);
                this.goal = null; this.path = null;
            }
        }
        // a wall just ahead: slide along it rather than into it
        if ((mx || mz) && a.ground) { const s2 = this.slide(W, mx, mz); mx = s2[0]; mz = s2[1]; }
        // stuck? step aside, then jump, then plan the way again; after a few goes, give up on the goal
        const moved = Math.hypot(a.x - this.lastPos[0], a.z - this.lastPos[2]);
        this.lastPos = [a.x, a.y, a.z];
        if ((mx || mz) && a.ground && moved < dt * 1.5 && a.launchT <= 0) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
        if (this.sideT > 0) { this.sideT -= dt; const l = Math.hypot(mx, mz) || 1; const px = -mz / l * this.sideDir, pz = mx / l * this.sideDir; mx = px * 0.8 + mx * 0.2; mz = pz * 0.8 + mz * 0.2; }
        if (this.stuckT > 0.35 && !(this.sideT > 0) && this.stuckT < 0.7) { this.sideT = 0.45; this.sideDir = Math.random() < 0.5 ? -1 : 1; }
        if (this.stuckT > 0.8) I.jump = true;
        if (this.stuckT > 1.3) {
            this.stuckT = 0; this.path = null; this.repathAt = 0; this.footStuckN = (this.footStuckN || 0) + 1;
            if (this.footStuckN >= 3) { this.footStuckN = 0; this.goal = null; }
        }
        if (moved > dt * 4) this.footStuckN = Math.max(0, (this.footStuckN || 0) - dt * 0.2);
        // turn the world direction into stick input
        const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
        const ml = Math.hypot(mx, mz);
        if (ml > 0.01) { mx /= ml; mz /= ml; }
        I.mz = mx * fx + mz * fz; I.mx = mx * rx + mz * rz;
        // tricks: slide when running, slide-jump, hop and dodge in a fight
        const hs = Math.hypot(a.vx, a.vz);
        if (this.crouchT > 0) { this.crouchT -= dt; I.crouch = true; if (this.crouchT < 0.25 && Math.random() < this.S.tricks) I.jump = true; }
        else I.crouch = false;
        if (this.trickT <= 0) {
            this.trickT = rnd(0.6, 1.6);
            if (a.ground && hs > 7.5 && Math.random() < this.S.tricks * 1.5 && I.mz > 0.7) this.crouchT = rnd(0.45, 0.8);
            else if (T && this.visible && Math.random() < this.S.tricks) { if (Math.random() < 0.5) I.jump = true; else I.dodge = [this.strafe, 0]; }
        }
        if (a.hurtT > 0.25 && T && Math.random() < this.S.tricks * 0.3) I.dodge = [Math.random() < 0.5 ? -1 : 1, 0];
        this.aimAndFire(W, dt);
    }
    sense(W) {
        const a = this.a, e = W.eye(a);
        let best = null, bs = Infinity;
        this.wasVisible = this.visible;
        this.visible = false;
        for (const b of W.actors) {
            if (!b.alive || !W.enemies(a, b)) continue;
            const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
            if (W.hidden(b) && d > 3) continue;
            const ang = Math.abs(angDiff(Math.atan2(-dx, -dz), a.yaw));
            const hurtMe = a.lastHit && a.lastHit.by === b.id && W.time - a.lastHit.time < 1.5;
            if (ang > 1.4 && d > 5 && !hurtMe) continue;
            if (!W.level.clear(e[0], e[1], e[2], b.x, b.y + b.h - 0.4, b.z)) continue;
            if ((a.flashT || 0) > 0.3 || (W.clouds.length && W.cloudBlocks(e[0], e[1], e[2], b.x, b.y + 1.2, b.z))) continue;
            this.seen[b.id] = { t: W.time, x: b.x, y: b.y, z: b.z };
            const s = d * (b === this.target ? 0.6 : 1) * (0.7 + b.hp / 300) * (hurtMe ? 0.5 : 1);
            if (s < bs) { bs = s; best = b; }
        }
        if (best) {
            // a new target, or one coming back into view: a moment to react, and the first shots are off
            if (best !== this.target) { this.reactT = this.S.react * rnd(0.8, 1.3); this.errX = rnd(-1, 1) * 2; this.errY = rnd(-1, 1) * 1.2; this.errT = 0; }
            else if (!this.wasVisible) this.reactT = Math.max(this.reactT, this.S.react * rnd(0.4, 0.7));
            this.target = best; this.visible = true;
        } else if (this.target) {
            const s = this.seen[this.target.id];
            if (!this.target.alive || !s || W.time - s.t > 3) this.target = null;
            else if (!this.goal || this.goal.kind !== 'hunt') { this.goal = { kind: 'hunt', x: s.x, y: s.y, z: s.z }; this.path = null; this.goalT = 3; }
        }
        if (this.weaponT <= 0) { this.weaponT = 0.6; this.chooseWeapon(W); }
    }
    prefRange() {
        const w = this.a.cur;
        if (['noodle', 'slicer', 'rake'].includes(w)) return 1.5;
        if (w === 'whip') return 3.5;
        if (w === 'blower') return 4;
        if (w === 'golf') return 22;
        if (w === 'rocket' || w === 'balloon') return 9;
        return 12;
    }
    chooseWeapon(W) {
        const a = this.a;
        const d = this.target ? Math.hypot(this.target.x - a.x, this.target.y - a.y, this.target.z - a.z) : 12;
        let best = a.cur, bs = -1;
        for (const w of Object.keys(WEAPONS)) {
            if (w === 'rc' || !W.has(a, w)) continue;
            const s = rate(w, d) + (w === a.cur ? 6 : 0);
            if (s > bs) { bs = s; best = w; }
        }
        if (best !== a.cur && !a.in.fire1) W.select(a, best);
    }
    // pick something to go and get, or somewhere to go
    chooseClass(W) {
        const a = this.a;
        const enemyVans = W.vehicles.some((v) => !v.dead && v.seats.some((id) => id) && v.team !== a.team);
        const r = Math.random();
        a.cls = enemyVans && r < 0.35 ? 4 : [0, 0, 1, 2, 3, 4][Math.floor(Math.random() * 6)];
        // spawn at the flag we hold nearest to one we don't, else at HQ
        const ours = W.flags.filter((f) => f.owner === a.team && !f.contested);
        const theirs = W.flags.filter((f) => f.owner !== a.team);
        let best = null, bd = Infinity;
        for (const f of ours) for (const g of theirs) { const d = Math.hypot(f.x - g.x, f.z - g.z); if (d < bd) { bd = d; best = f; } }
        a.spawnAt = best && Math.random() < 0.8 ? best.id : 'hq';
    }
    // which flag to go for: defend ours under attack, else take the nearest we don't hold
    flagGoal(W, here) {
        const a = this.a, nav = W.nav;
        let best = null, bs = -Infinity;
        for (const f of W.flags) {
            const nd = nav.closest(f.x, f.y, f.z), c = nav.cost(here, nd);
            if (c >= 1e9) continue;
            let v = 0;
            if (f.owner !== a.team) v = 100 + (f.owner === -1 ? 20 : 0);
            else if (f.contested || (a.team === 0 ? f.v > -0.95 : f.v < 0.95)) v = 140;
            else continue;
            const sc = v - c * 0.8 + ((this.flagPick === f.i) ? 30 : 0) + Math.random() * 20;
            if (sc > bs) { bs = sc; best = f; }
        }
        return best;
    }
    pickGoal(W) {
        const a = this.a, nav = W.nav;
        const here = nav.from(a.x, a.y, a.z);
        if (W.cq && !(a.hp < 45 && Math.random() < 0.6)) {
            const f = this.flagGoal(W, here);
            if (f) {
                this.flagPick = f.i;
                const far = nav.cost(here, nav.closest(f.x, f.y, f.z)) > 55;
                // a long way to go: take a vehicle if one is free nearby
                if (far) {
                    const v = W.vehicles.find((q) => !q.dead && q.seats.includes(0) && (q.team === a.team || q.team === -1 || !q.seats.some((id) => id)) && Math.hypot(q.x - a.x, q.z - a.z) < 16);
                    if (v) { this.goal = { kind: 'vehicle', v, x: v.x, y: v.y, z: v.z, flag: f }; this.goalT = 10; this.path = null; return; }
                }
                const t = Math.random() * Math.PI * 2, r = Math.random() * f.r * 0.6;
                const gx = f.x + Math.cos(t) * r, gz = f.z + Math.sin(t) * r;
                this.goal = { kind: 'flag', f, x: gx, y: W.level.ground(gx, gz, 0.3, f.y + 2), z: gz };
                this.goalT = 6; this.path = null;
                return;
            }
        }
        let best = null, bs = 0;
        for (const it of W.items) {
            if (it.t > 1.5 || (this.avoid && this.avoid.get(it) > W.time)) continue;
            const D = ITEMS[it.type];
            let v = 0;
            if (D.hp) v = a.hp < D.cap ? (D.hp >= 25 ? 30 : 8) * (a.hp < 60 ? 3 : 1) : 0;
            else if (D.armor) v = a.armor < 150 ? D.armor * 0.5 : 0;
            else if (D.power) v = 70;
            else if (D.weapon) v = D.weapon === 'rc' ? 0 : !a.inv[D.weapon] ? 55 : (a.ammo[D.weapon] || 0) < 10 && WEAPONS[D.weapon].ammo ? 18 : 0;
            else if (D.ammoFor) v = a.inv[D.ammoFor] && (a.ammo[D.ammoFor] || 0) < WEAPONS[D.ammoFor].ammo[1] * 0.4 ? 15 : 0;
            if (!v) continue;
            const nd = nav.closest(it.x, it.y, it.z);
            const c = nav.cost(here, nd);
            if (c >= 1e9) continue;
            const s = v / (c + 6);
            if (s > bs) { bs = s; best = it; }
        }
        if (best && bs > 0.6 / 6) this.goal = { kind: 'item', x: best.x, y: best.y, z: best.z, it: best };
        else {
            // somewhere random that can be walked to
            let nd = null;
            for (let k = 0; k < 6 && !nd; k++) { const c = nav.nodes[Math.floor(Math.random() * nav.nodes.length)]; if (nav.cost(here, c) < 1e9) nd = c; }
            nd = nd || here;
            this.goal = { kind: 'roam', x: nd.x, y: nd.y, z: nd.z };
        }
        this.goalT = 12; this.path = null;
    }
    reached() {
        const g = this.goal, a = this.a;
        if (g.kind === 'vehicle') {
            g.x = g.v.x; g.y = g.v.y; g.z = g.v.z;
            if (g.v.dead || !g.v.seats.includes(0)) return true;
            if (Math.hypot(g.v.x - a.x, g.v.z - a.z) < 2.6) { a.in.use = true; this.driveTo = g.flag; return true; }
            return false;
        }
        if (g.kind === 'item' && g.it.t > 1.5) return true;
        return Math.hypot(g.x - a.x, g.z - a.z) < 0.8 && Math.abs(g.y - a.y) < 1.5;
    }
    // the direction to walk to get to (x,y,z): straight there if we can, else along the graph
    steer(W, x, y, z) {
        const a = this.a, nav = W.nav;
        if (a.launchT > 0) return null;
        const direct = Math.abs(y - a.y) < 1.2 && Math.hypot(x - a.x, z - a.z) < 10 && nav.walkable({ x: a.x, y: a.y, z: a.z }, { x, y, z });
        if (direct) { this.path = null; return this.dir(x, z); }
        if (!this.path || !this.path.length || W.time >= (this.repathAt || 0)) {
            this.repathAt = W.time + 1.5;
            const from = nav.from(a.x, a.y, a.z), to = nav.closestSeen(x, y, z);
            this.path = [from, ...(nav.path(from, to) || [])];
        }
        let n = this.path[0];
        while (n && Math.hypot(n.x - a.x, n.z - a.z) < (n.tramp ? 0.5 : 0.9) && Math.abs(n.y - a.y) < 1.6) { this.path.shift(); n = this.path[0]; }
        // cut corners: if the next point but one can be walked to straight from here, head for it instead
        if (this.path.length > 1 && !n.tramp && a.ground && W.time >= (this.smoothAt || 0)) {
            this.smoothAt = W.time + 0.25;
            const m = this.path[1];
            if (!m.tramp && Math.abs(m.y - a.y) < 1.0 && Math.abs(n.y - a.y) < 1.0 && nav.walkable({ x: a.x, y: a.y, z: a.z }, m)) { this.path.shift(); n = m; }
        }
        if (!n) {
            // the end of the path, and still no straight way there: it can't be reached from here
            if (Math.hypot(x - a.x, z - a.z) > 1.2 && !nav.walkable({ x: a.x, y: a.y, z: a.z }, { x, y, z })) this.goalBlocked = true;
            this.aim = [x, z];
            return this.dir(x, z);
        }
        this.aim = [n.x, n.z];
        return this.dir(n.x, n.z);
    }
    // turn a wanted direction so it doesn't push into a wall right in front: try a little either side
    slide(W, mx, mz) {
        const a = this.a, L = W.level, l = Math.hypot(mx, mz) || 1, dx = mx / l, dz = mz / l;
        const free = (ux, uz) => !L.blocked(a.x + ux * 0.6, a.y, a.z + uz * 0.6, 0.34, 1.6, 0.55);
        if (free(dx, dz)) return [mx, mz];
        const side = this.slideSide || 1;
        for (const ang of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
            const t = ang * side, c = Math.cos(t), s = Math.sin(t), ux = dx * c - dz * s, uz = dx * s + dz * c;
            if (free(ux, uz)) { this.slideSide = Math.sign(t) || 1; return [ux * l, uz * l]; }
        }
        return [mx, mz];
    }
    dir(x, z) { const a = this.a, dx = x - a.x, dz = z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; }
    // don't strafe off a ledge in a fight
    avoidEdges(W, mx, mz) {
        const a = this.a, l = Math.hypot(mx, mz);
        if (l < 0.01 || !a.ground) return true;
        const x = a.x + mx / l * 1.2, z = a.z + mz / l * 1.2;
        return W.level.ground(x, z, 0.2, a.y + 0.6) > a.y - 1.2;
    }
    aimAndFire(W, dt, lookOnly) {
        const a = this.a, I = a.in, T = this.target;
        let ty, tp;
        if (T && this.visible) {
            const e = W.eye(a), w = a.cur;
            let px = T.x, py = T.y + T.h * 0.6, pz = T.z;
            if (w === 'golf') py = T.y + T.h - 0.25;
            if (w === 'rocket' && T.ground) py = T.y + 0.3;
            const sp = SPEED[w] || 1e9;
            const d = Math.hypot(px - e[0], py - e[1], pz - e[2]);
            if (sp < 1e8) {
                const t = d / sp;
                px += T.vx * t * this.S.lead; pz += T.vz * t * this.S.lead;
                if (!T.ground) py += T.vy * t * 0.5;
                if (GRAV[w]) py += 0.5 * GRAV[w] * t * t;
            }
            ty = Math.atan2(-(px - e[0]), -(pz - e[2]));
            tp = Math.atan2(py - e[1], Math.hypot(px - e[0], pz - e[2]));
            // the aim wanders off by up to `err` metres at the target (more on a fast mover), drifting to a new
            // offset every half second or so: so shots miss by about that much, wherever the target is
            this.errT = (this.errT || 0) - dt;
            if (this.errT <= 0) {
                this.errT = rnd(0.3, 0.75);
                const k = 1 + Math.min(1.5, Math.hypot(T.vx, T.vz) / 9) * (1 - this.S.track) * 1.5;
                this.errTX = rnd(-1, 1) * k; this.errTY = rnd(-1, 1) * 0.6 * k;
            }
            this.errX += ((this.errTX || 0) - this.errX) * Math.min(1, dt * 3);
            this.errY += ((this.errTY || 0) - this.errY) * Math.min(1, dt * 3);
            const em = this.S.err / Math.max(d, 4);
            ty += this.errX * em; tp += this.errY * em;
        } else {
            // look where we're going
            const s = Math.hypot(a.vx, a.vz);
            if (s > 1) ty = Math.atan2(-a.vx, -a.vz);
            tp = 0;
        }
        const turn = this.S.turn * dt;
        if (ty != null) a.yaw += clamp(angDiff(ty, a.yaw), -turn, turn);
        a.pitch += clamp(tp - a.pitch, -turn, turn);
        a.pitch = clamp(a.pitch, -1.45, 1.45);
        if (!T || !this.visible || this.reactT > 0 || lookOnly) { a.zoom = false; return; }
        // shoot in bursts, with pauses (more of them at lower skill)
        this.burstT = (this.burstT || 0) - dt;
        if (this.burstT <= 0) { this.burstT = rnd(0.5, 1.1); this.pause = Math.random() < this.S.hold; }
        if (this.pause && !WEAPONS[a.cur].melee) return;
        const off = Math.abs(angDiff(ty, a.yaw)) + Math.abs(tp - a.pitch);
        const d = Math.hypot(T.x - a.x, T.y - a.y, T.z - a.z);
        const tol = Math.max(0.05, Math.atan2(0.7, d)) + (WEAPONS[a.cur].melee ? 0.4 : 0);
        if (off > tol) return;
        const w = a.cur;
        if (WEAPONS[w].melee) {
            if (d < 2.6) { if (Math.random() < 0.25 && w !== 'rake') I.fire2 = true; else I.fire1 = true; }
            else if (w === 'whip' && d < 5.4) I.fire1 = true;
            else if (w === 'slicer' && d < 5 && Math.random() < 0.05) I.fire2 = true;
            return;
        }
        if (w === 'rocket' && d > 6 && d < 18 && (a.ammo.rocket || 0) >= 3 && Math.random() < 0.012) { this.loadT = 1.2; }
        if (this.loadT > 0) { this.loadT -= dt; I.fire2 = this.loadT > 0; return; }
        if (w === 'bat' && this.incoming(W)) { I.fire2 = true; return; }
        if (w === 'golf' && d > 18) I.fire2 = true;
        if (W.rules.kits) {
            if (a.lethalN > 0 && d > 7 && d < 20 && Math.random() < 0.006) I.lethal = true;
            if (a.tacN > 0 && d > 6 && d < 16 && Math.random() < 0.003) I.tactical = true;
        }
        I.fire1 = true;
    }
    /* Drive a vehicle to the flag we're after, along the graph of links a vehicle fits through: aim at a point a
       little way down the route, ease off for corners, and if we're stuck against something, back out and
       find another way. Where the vehicle can't go any further, get out and walk. */
    drive(W, v, dt) {
        const a = this.a, I = a.in, nav = W.nav;
        const f = this.driveTo || this.flagGoal(W, nav.from(v.x, v.y, v.z));
        if (!f) { I.use = true; return; }
        this.driveTo = f;
        const sp = Math.hypot(v.vx, v.vz);
        const stop = () => { I.mz = (v.speed || 0) > 1 ? -1 : 0; I.mx = 0; I.jump = false; I.crouch = false; if (sp < 2) { I.use = true; this.driveTo = null; this.goal = null; this.vpath = null; } };
        if (Math.hypot(f.x - v.x, f.z - v.z) < f.r + 2) { stop(); return; }
        const G = nav.vgraph(v.r);
        this.vrepath = (this.vrepath || 0) - dt;
        if (!this.vpath || this.vrepath <= 0) {
            this.vrepath = 4;
            const avoid = this.vavoid || (this.vavoid = new Map());
            for (const [k, t] of avoid) if (t < W.time) avoid.delete(k);
            const st = nav.vstart(v, G, avoid);
            this.vpath = [];
            if (st) {
                // the drivable node nearest the flag, round any spots we got stuck at lately
                const { dist, prev } = avoid.size ? vroute(G.links, nav.nodes.length, st.i, avoid) : nav.from1(st, G.links, G.cache);
                let best = st, bd = Infinity;
                for (const n of nav.nodes) { if (!isFinite(dist[n.i])) continue; const d = Math.hypot(n.x - f.x, n.z - f.z) + Math.abs(n.y - f.y) * 2; if (d < bd) { bd = d; best = n; } }
                const path = [];
                for (let i = best.i; i !== st.i && i >= 0 && path.length < 400; i = prev[i]) path.push(nav.nodes[i]);
                this.vpath = [st, ...path.reverse()];
                this.vend = best; this.vendFar = bd > f.r + 6;
            }
        }
        // drop the points we've reached or driven past
        while (this.vpath.length > 1) {
            const n = this.vpath[0], m = this.vpath[1];
            const dn = Math.hypot(n.x - v.x, n.z - v.z), past = (v.x - n.x) * (m.x - n.x) + (v.z - n.z) * (m.z - n.z) > 0;
            if (dn < 3.5 || (past && dn < 9)) this.vpath.shift(); else break;
        }
        const n = this.vpath[0];
        // at the end of what we can drive: walk the rest
        if (n && this.vpath.length === 1 && this.vendFar && Math.hypot(n.x - v.x, n.z - v.z) < 4) { stop(); return; }
        // aim a little way down the route
        let tx = n ? n.x : f.x, tz = n ? n.z : f.z;
        const m = this.vpath[1];
        if (n && m) { const dn = Math.hypot(n.x - v.x, n.z - v.z), k = clamp(1 - dn / 7, 0, 0.7); tx += (m.x - tx) * k; tz += (m.z - tz) * k; }
        const want = Math.atan2(-(tx - v.x), -(tz - v.z)), diff = angDiff(want, v.yaw);
        // how sharp is the next corner, and how close
        let corner = 0;
        if (n && m) { const h1 = Math.atan2(-(n.x - v.x), -(n.z - v.z)), h2 = Math.atan2(-(m.x - n.x), -(m.z - n.z)); corner = Math.abs(angDiff(h2, h1)) * clamp(1 - Math.hypot(n.x - v.x, n.z - v.z) / 14, 0, 1); }
        // stuck against something: back out, turning, then plan again
        this.reverseT = Math.max(0, (this.reverseT || 0) - dt);
        this.turnT = Math.max(0, (this.turnT || 0) - dt);
        // backing out; if that isn't getting anywhere either, stop and turn on the spot instead
        if (this.reverseT > 0) {
            if (this.reverseT < 0.8 && sp < 0.4) { this.reverseT = 0; this.turnT = 0.9; }
            else { I.mz = -1; I.mx = diff > 0 ? 1 : -1; I.jump = false; return; }
        }
        if (this.turnT > 0) { I.mz = 0.6; I.mx = diff > 0 ? -1 : 1; I.jump = false; return; }
        const throttle = Math.abs(diff) > 1.3 ? 0.35 : Math.abs(diff) > 0.6 || corner > 0.9 ? 0.6 : 1;
        if (throttle > 0.3 && sp < 1.0 && v.ground) this.vstuck = (this.vstuck || 0) + dt; else this.vstuck = Math.max(0, (this.vstuck || 0) - dt * 2);
        if (sp > 4) this.vgoodT = (this.vgoodT || 0) + dt; else this.vgoodT = 0;
        if (this.vgoodT > 3) this.stuckN = 0;
        if (this.vstuck > 0.9) {
            this.vstuck = 0; this.reverseT = 1.2; this.vrepath = 1.3; this.stuckN = (this.stuckN || 0) + 1;
            if (n) (this.vavoid || (this.vavoid = new Map())).set(n.i, W.time + 20);
            if (this.stuckN > 3) { this.stuckN = 0; I.use = true; this.driveTo = null; this.goal = null; this.vpath = null; }
            return;
        }
        I.mz = throttle;
        I.mx = clamp(-diff * 2, -1, 1);
        // brake into sharp corners at speed; kart-drift the long ones
        const hard = (Math.abs(diff) > 1.0 && sp > 7) || (corner > 1.0 && sp > 9);
        if (hard) I.mz = sp > 9 ? -0.7 : 0.2;
        I.jump = !hard && corner > 0.45 && corner < 1.0 && sp > 8;
        I.crouch = false;
    }
    // an enemy projectile about to hit us?
    incoming(W) {
        const a = this.a;
        for (const p of W.proj) {
            if (p.owner === a.id) continue;
            const dx = a.x - p.x, dy = a.y + 1 - p.y, dz = a.z - p.z, d = Math.hypot(dx, dy, dz);
            if (d < 3.2 && (dx * p.vx + dy * p.vy + dz * p.vz) > 0 && Math.random() < this.S.tricks) return true;
        }
        return false;
    }
}

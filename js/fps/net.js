/* Online play, peer to peer over WebRTC (PeerJS; its free public server only introduces the players).
   The host runs the real game. Each client moves its own player and sends where it is and what it presses;
   the host decides every hit, pickup and score and sends snapshots back 20 times a second. */
import { WEAPONS } from './defs.js';

const PEER_JS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'yard-sale-showdown-';
const W_IDS = Object.keys(WEAPONS);
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

let loading = null;
export function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = PEER_JS; s.onload = () => res(); s.onerror = () => { loading = null; rej(new Error('Could not load PeerJS')); };
        document.head.appendChild(s);
    });
    return loading;
}
export const makeCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

/* ---------- what goes over the wire ---------- */
const PW = ['sauce', 'espresso', 'sneakers', 'box'];
export function packActor(a) {
    let pw = 0; PW.forEach((k, i) => { if (a.pw[k] > 0) pw |= 1 << i; });
    return [a.id, r2(a.x), r2(a.y), r2(a.z), r3(a.yaw), r3(a.pitch), r2(a.vx), r2(a.vy), r2(a.vz),
        (a.alive ? 1 : 0) | (a.ground ? 2 : 0) | (a.slideT > 0 ? 4 : 0) | (a.crouch ? 8 : 0) | (a.dual ? 16 : 0) | (a.zoom ? 32 : 0) | (a.human ? 64 : 0),
        Math.round(a.hp), Math.round(a.armor), W_IDS.indexOf(a.cur), a.score, a.kills, a.deaths, a.team, a.char, pw, r2(a.swing), a.swingK, r2(a.prot), r2(a.stunT), r2(a.h), a.ping | 0, a.name, a.veh | 0, a.seat | 0, a.cls | 0, a.gg | 0];
}
export function unpackActor(a, s, own) {
    const f = s[9];
    a.alive = !!(f & 1); a.hp = s[10]; a.armor = s[11];
    a.score = s[13]; a.kills = s[14]; a.deaths = s[15]; a.team = s[16]; a.char = s[17];
    if (!own) PW.forEach((k, i) => { a.pw[k] = s[18] & (1 << i) ? 1 : 0; });
    a.prot = s[21]; a.stunT = Math.max(a.stunT, s[22]); a.ping = s[24]; a.name = s[25];
    a.human = !!(f & 64);
    a.veh = s[26] || 0; a.seat = s[27] || 0;
    a.gg = s[29] || 0;
    if (own) return;
    a.cls = s[28] || 0;
    a.cur = W_IDS[s[12]] || 'pistol'; a.dual = !!(f & 16); a.zoom = !!(f & 32);
    a.ground = !!(f & 2); a.slideT = f & 4 ? 0.5 : 0; a.crouch = !!(f & 8); a.h = s[23];
    a.swing = Math.max(a.swing, s[19]); a.swingK = s[20];
    // remote players are drawn a little in the past, between two snapshots
    (a.buf || (a.buf = [])).push({ t: performance.now(), x: s[1], y: s[2], z: s[3], yaw: s[4], pitch: s[5], vx: s[6], vy: s[7], vz: s[8] });
    if (a.buf.length > 12) a.buf.shift();
}
// move mirrored players to where they were 100 ms ago
export function interpolate(a, now) {
    const B = a.buf;
    if (!B || !B.length) return;
    const t = now - 110;
    let i = B.length - 1;
    while (i > 0 && B[i - 1].t > t) i--;
    const p = B[Math.max(0, i - 1)], q = B[i];
    const k = q.t === p.t ? 1 : Math.max(0, Math.min(1.5, (t - p.t) / (q.t - p.t)));
    a.x = p.x + (q.x - p.x) * k; a.y = p.y + (q.y - p.y) * k; a.z = p.z + (q.z - p.z) * k;
    let dy = q.yaw - p.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    a.yaw = p.yaw + dy * Math.min(1, k); a.pitch = p.pitch + (q.pitch - p.pitch) * Math.min(1, k);
    a.vx = q.vx; a.vy = q.vy; a.vz = q.vz;
}
function privateState(a) {
    return { inv: a.inv, ammo: a.ammo, cur: a.cur, next: a.next, dual: a.dual, traps: a.traps, charge: r2(a.charge), loaded: a.loaded, spin: r2(a.spin), zoom: a.zoom, fireT: r2(a.fireT), switchT: r2(a.switchT), pw: a.pw, car: a.car ? a.car.id : 0, specialT: r2(a.specialT || 0), flashT: r2(a.flashT || 0), lethalN: a.lethalN || 0, tacN: a.tacN || 0 };
}
export function snapshot(W, events, me) {
    return {
        t: 'snap', st: W.state, sT: r2(W.stateT), tl: Math.round(W.timeLeft), ts: W.teamScore,
        A: W.actors.map(packActor),
        P: W.proj.map((p) => [p.id, p.type, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz), p.owner, r2(p.size || 0)]),
        I: W.items.map((it) => (it.t > 0 ? 1 : 0)).join(''),
        PU: W.puddles.map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z), p.r, r2(p.life)]),
        TR: W.traps.map((t) => [t.id, r2(t.x), r2(t.y), r2(t.z), r3(t.yaw), t.owner]),
        C: W.cars.map((c) => [c.id, r2(c.x), r2(c.y), r2(c.z), r3(c.yaw), c.owner]),
        E: events, me: me ? privateState(me) : null,
        CQ: W.cq ? {
            tk: W.tickets, F: W.flags.map((f) => [r2(f.v), f.owner, f.contested ? 1 : 0]),
            V: W.vehicles.map((v) => [v.id, v.type, r2(v.x), r2(v.y), r2(v.z), r3(v.yaw), Math.round(v.hp), v.dead ? 1 : 0, v.seats, v.team, r2(v.vx), r2(v.vz), r3(v.pitch), r3(v.roll), v.mk && v.mk.dir ? v.mk.dir * (v.mk.tier + 1) : 0]),
            D: W.drops.map((d) => [d.id, d.kind, r2(d.x), r2(d.y), r2(d.z), d.team])
        } : null,
        CL: W.clouds.map((c) => [c.id, r2(c.x), r2(c.y), r2(c.z), c.r, r2(c.life)])
    };
}
// a client copies a snapshot into its mirror of the world
export function applySnapshot(W, s, myId, addActor) {
    W.state = s.st; W.stateT = s.sT; W.timeLeft = s.tl; W.teamScore = s.ts;
    const seen = new Set();
    for (const row of s.A) {
        seen.add(row[0]);
        let a = W.byId(row[0]);
        if (!a) a = addActor(row);
        const own = row[0] === myId;
        const wasAlive = a.alive;
        unpackActor(a, row, own);
        if (own && a.alive && !wasAlive) { a.x = row[1]; a.y = row[2]; a.z = row[3]; a.yaw = row[4]; a.vx = a.vy = a.vz = 0; }
    }
    W.actors = W.actors.filter((a) => seen.has(a.id));
    W.proj = s.P.map(([id, type, x, y, z, vx, vy, vz, owner, size]) => ({ id, type, x, y, z, vx, vy, vz, owner, size }));
    W.items.forEach((it, i) => { it.t = s.I[i] === '1' ? 1 : 0; });
    W.puddles = s.PU.map(([id, x, y, z, r, life]) => ({ id, x, y, z, r, life }));
    W.traps = s.TR.map(([id, x, y, z, yaw, owner]) => ({ id, x, y, z, yaw, owner }));
    W.cars = s.C.map(([id, x, y, z, yaw, owner]) => ({ id, x, y, z, yaw, owner }));
    if (s.CQ && W.cq) {
        W.tickets = s.CQ.tk;
        s.CQ.F.forEach(([v, owner, c], i) => { const f = W.flags[i]; if (f) { f.v = v; f.owner = owner; f.contested = !!c; } });
        const seen = new Set();
        for (const [id, type, x, y, z, yaw, hp, dead, seats, team, vx, vz, pitch, roll, kd] of s.CQ.V) {
            seen.add(id);
            let v = W.vehicles.find((q) => q.id === id);
            if (!v) { v = W.newVehicle(type, x, y, z, yaw, team); v.id = id; W.vehicles.push(v); }
            let dy = yaw - (v.yaw || 0); while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
            Object.assign(v, { x, y, z, yaw: (v.yaw || 0) + dy, hp, dead: !!dead, seats, team, vx, vz, pitch, roll, kd: kd || 0 });
        }
        W.vehicles = W.vehicles.filter((v) => seen.has(v.id));
        W.drops = s.CQ.D.map(([id, kind, x, y, z, team]) => ({ id, kind, x, y, z, team }));
    }
    W.clouds = (s.CL || []).map(([id, x, y, z, r, life]) => ({ id, x, y, z, r, life }));
    const me = W.byId(myId);
    if (me && s.me) {
        const p = s.me;
        Object.assign(me, { inv: p.inv, ammo: p.ammo, cur: p.cur, next: p.next, dual: p.dual, traps: p.traps, charge: p.charge, loaded: p.loaded, spin: p.spin, zoom: p.zoom, fireT: p.fireT, switchT: p.switchT });
        me.car = p.car ? W.cars.find((c) => c.id === p.car) || null : null;
        me.specialT = p.specialT || 0;
        me.flashT = p.flashT || 0; me.lethalN = p.lethalN || 0; me.tacN = p.tacN || 0;
        for (const k of PW) me.pw[k] = p.pw[k];
    }
}

/* ---------- connections ---------- */
export class Host {
    constructor(code) { this.code = code; this.conns = new Map(); this.onJoin = null; this.onLeave = null; this.onMsg = null; }
    async open() {
        await loadPeer();
        return new Promise((res, rej) => {
            const p = this.peer = new window.Peer(PREFIX + this.code, { debug: 0 });
            p.on('open', () => res());
            p.on('error', (e) => { if (!this.ready) rej(e); else if (this.onError) this.onError(e); });
            p.on('connection', (c) => {
                c.on('open', () => this.conns.set(c.peer, c));
                c.on('data', (m) => { if (m && m.t === 'hello' && this.onJoin) this.onJoin(c, m); else if (this.onMsg) this.onMsg(c, m); });
                c.on('close', () => { this.conns.delete(c.peer); if (this.onLeave) this.onLeave(c); });
                c.on('error', () => {});
            });
            this.ready = true;
        });
    }
    send(c, m) { if (c.open) try { c.send(m); } catch (e) { /* dropped */ } }
    count() { return this.conns.size; }
    close() { for (const c of this.conns.values()) c.close(); if (this.peer) this.peer.destroy(); }
}
export class Client {
    constructor(code) { this.code = code; this.onMsg = null; this.onClose = null; }
    async open(hello) {
        await loadPeer();
        return new Promise((res, rej) => {
            const p = this.peer = new window.Peer({ debug: 0 });
            const fail = (e) => { clearTimeout(this.timer); rej(e); };
            p.on('error', fail);
            p.on('open', () => {
                const c = this.conn = p.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
                this.timer = setTimeout(() => fail(new Error('No answer from that game')), 12000);
                c.on('open', () => { clearTimeout(this.timer); c.send(hello); res(); });
                c.on('data', (m) => this.onMsg && this.onMsg(m));
                c.on('close', () => this.onClose && this.onClose());
                c.on('error', () => {});
            });
        });
    }
    send(m) { if (this.conn && this.conn.open) try { this.conn.send(m); } catch (e) { /* dropped */ } }
    close() { if (this.peer) this.peer.destroy(); }
}

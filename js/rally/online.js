/* Online races, peer to peer over WebRTC (PeerJS's public server only introduces the players).
   One player hosts and gets a four-letter code; up to seven friends join with it. The host picks the track and
   starts; empty grid slots are filled with computer rivals, which the host drives. Every player drives their own
   car on their own machine and sends where it is fifteen times a second; the host passes everything on.
   No power-ups online: just racing. */
const PEER_JS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'gravelriot-';
let loading = null;
function loadPeer() {
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
export const MAX_PLAYERS = 8;

// a car's state as a short array (positions to the centimetre, angles to a milliradian)
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
export function packCar(c) {
    const f = (c.ground ? 1 : 0) | (c.braking ? 2 : 0) | (c.nitro > 0 ? 4 : 0) | (c.wrecked > 0 ? 8 : 0);
    return [r2(c.x), r2(c.y), r2(c.z), r3(c.h), r2(c.vx), r2(c.vz), r2(c.vy), r3(c.pitch || 0), r3(c.roll || 0), r2(c.steer || 0), c.lapN || 0, f, c.mk && c.mk.dir ? c.mk.dir * (c.mk.tier + 1) : 0, r3(c.flip || 0)];
}

/* api: { onLobby(players, info), onStart(setup), onState(id, data, now), onFinish(id, time), onLeave(id), onClosed(why) } */
export class Online {
    constructor(api) { this.api = api; this.players = new Map(); this.isHost = false; this.id = null; this.info = {}; }
    me() { return this.players.get(this.id); }
    list() { return [...this.players.values()]; }
    // host a room: resolves with its code
    async host(me) {
        await loadPeer();
        this.isHost = true; this.code = makeCode(); this.conns = new Map();
        await new Promise((res, rej) => {
            const p = this.peer = new window.Peer(PREFIX + this.code, { debug: 0 });
            p.on('open', () => res());
            p.on('error', (e) => { if (!this.ready) rej(e); else this.api.onClosed && this.api.onClosed(e.type || 'error'); });
            p.on('connection', (c) => {
                c.on('data', (m) => this.hostMsg(c, m));
                c.on('close', () => this.drop(c.peer));
                c.on('error', () => {});
            });
        });
        this.ready = true;
        this.id = 'host';
        this.players.set('host', Object.assign({ id: 'host' }, me));
        this.lobby();
        return this.code;
    }
    async join(code, me) {
        await loadPeer();
        this.isHost = false; this.code = code.toUpperCase();
        await new Promise((res, rej) => {
            const p = this.peer = new window.Peer({ debug: 0 });
            const fail = (e) => { clearTimeout(this.timer); rej(e); };
            p.on('error', fail);
            p.on('open', () => {
                const c = this.conn = p.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
                this.timer = setTimeout(() => fail(new Error('No answer from that code')), 12000);
                c.on('open', () => { clearTimeout(this.timer); c.send(Object.assign({ t: 'hello' }, me)); res(); });
                c.on('data', (m) => this.clientMsg(m));
                c.on('close', () => this.api.onClosed && this.api.onClosed('host left'));
                c.on('error', () => {});
            });
        });
        this.ready = true;
    }
    send(c, m) { if (c && c.open) try { c.send(m); } catch (e) { /* dropped */ } }
    toAll(m, except) { for (const [id, c] of this.conns) if (id !== except) this.send(c, m); }
    /* ---- the host's side ---- */
    hostMsg(c, m) {
        if (!m || !m.t) return;
        if (m.t === 'hello') {
            if (this.players.size >= MAX_PLAYERS || this.racing) { this.send(c, { t: 'full' }); setTimeout(() => c.close(), 200); return; }
            this.conns.set(c.peer, c);
            this.players.set(c.peer, { id: c.peer, name: String(m.name || 'Player').slice(0, 14), car: m.car, driver: m.driver });
            this.send(c, { t: 'you', id: c.peer });
            this.lobby();
        } else if (m.t === 'st') {
            this.api.onState(c.peer, m.d, performance.now());
            this.toAll({ t: 'st', id: c.peer, d: m.d }, c.peer);
        } else if (m.t === 'fin') {
            this.api.onFinish(c.peer, m.time);
            this.toAll({ t: 'fin', id: c.peer, time: m.time }, c.peer);
        }
    }
    drop(peer) {
        if (!this.players.has(peer)) return;
        this.conns.delete(peer); this.players.delete(peer);
        this.toAll({ t: 'left', id: peer });
        this.api.onLeave && this.api.onLeave(peer);
        this.lobby();
    }
    // tell everyone who's here (and what the host has picked)
    lobby(info) {
        if (info) this.info = info;
        if (!this.isHost) return;
        const m = { t: 'lobby', players: this.list(), info: this.info };
        this.toAll(m);
        this.api.onLobby && this.api.onLobby(m.players, m.info);
    }
    start(setup) { this.racing = true; this.toAll({ t: 'start', setup }); this.api.onStart(setup); }
    back() { this.racing = false; this.toAll({ t: 'back' }); }
    /* ---- the joiner's side ---- */
    clientMsg(m) {
        if (!m || !m.t) return;
        if (m.t === 'you') this.id = m.id;
        else if (m.t === 'full') this.api.onClosed && this.api.onClosed('that race is full or already going');
        else if (m.t === 'lobby') { this.players = new Map(m.players.map((p) => [p.id, p])); this.info = m.info || {}; this.api.onLobby && this.api.onLobby(m.players, this.info); }
        else if (m.t === 'start') this.api.onStart(m.setup);
        else if (m.t === 'st') this.api.onState(m.id, m.d, performance.now());
        else if (m.t === 'ai') for (const [id, d] of m.d) this.api.onState(id, d, performance.now());
        else if (m.t === 'fin') this.api.onFinish(m.id, m.time);
        else if (m.t === 'left') { this.players.delete(m.id); this.api.onLeave && this.api.onLeave(m.id); }
        else if (m.t === 'back') this.api.onBack && this.api.onBack();
    }
    /* ---- both ---- */
    state(d) { if (this.isHost) this.toAll({ t: 'st', id: 'host', d }); else this.send(this.conn, { t: 'st', d }); }
    aiStates(list) { if (this.isHost && list.length) this.toAll({ t: 'ai', d: list }); }
    finished(time, id) {
        if (this.isHost) this.toAll({ t: 'fin', id: id || 'host', time });
        else this.send(this.conn, { t: 'fin', time });
    }
    leave() {
        try { if (this.isHost) for (const c of this.conns.values()) c.close(); } catch (e) { /* gone */ }
        if (this.peer) this.peer.destroy();
        this.peer = null; this.ready = false; this.players.clear();
    }
}

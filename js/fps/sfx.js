/* Sound effects, all synthesised: squirts, pops, bat cracks, fizzing rockets, confetti booms and slide whistles.
   Sounds in the world are panned and fade with distance from the listener. */
import { SONGS } from '../rally/music.js';

// the Coal Works track: an industrial breakbeat, for the music sequencer from Gravel Riot
SONGS.coalworks = {
    bpm: 146, key: { prog: [[52, 59, 64], [53, 60, 65], [52, 59, 64], [55, 62, 67]], roots: [28, 29, 28, 31] }, barsPerChord: 2, kit: 'industrial',
    kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', clank: '......x.......x.',
    bass: 'xx.x.xx.x.xx.x.o', bassType: 'dist', filter: 1900,
    mel: '0...3...1.0.....0...5...3.1.0...', melType: 'saw', scale: 'hijaz', tonic: 64
};
SONGS.showdown = {
    bpm: 118, key: { prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], roots: [45, 41, 43, 40] }, barsPerChord: 2, kit: 'electro',
    kick: 'x.......x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '......x.......x.',
    bass: 'x..x..x...x.x...', bassType: 'pluck', filter: 1200, pad: true,
    stab: '..x...x...x...x.', stabType: 'brass'
};
export class Sfx {
    constructor() { this.ctx = null; this.on = true; this.L = { x: 0, y: 0, z: 0, yaw: 0 }; this.loops = {}; }
    start() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = this.on ? 0.5 : 0;
        const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(c.destination);
        this.fx = c.createGain(); this.fx.gain.value = 1; this.fx.connect(this.master);
        const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.buf = buf;
    }
    setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05); }
    listener(x, y, z, yaw) { this.L.x = x; this.L.y = y; this.L.z = z; this.L.yaw = yaw; }
    // an output for a sound at a position (or right in your head without one)
    out(pos, vol = 1) {
        const c = this.ctx, g = c.createGain();
        let v = vol, pan = 0;
        if (pos) {
            const dx = pos[0] - this.L.x, dy = pos[1] - this.L.y, dz = pos[2] - this.L.z, d = Math.hypot(dx, dy, dz);
            if (d > 55) return null;
            v *= 1 / (1 + d * 0.11) * (1 - d / 55);
            const rx = Math.cos(this.L.yaw), rz = -Math.sin(this.L.yaw);
            pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0;
        }
        g.gain.value = v;
        if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.fx); }
        else g.connect(this.fx);
        return g;
    }
    tone(out, type, f0, f1, dur, vol, at = 0) {
        const c = this.ctx, t = c.currentTime + at;
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    }
    noise(out, dur, vol, type, f0, f1, q = 1, at = 0) {
        const c = this.ctx, t = c.currentTime + at;
        const s = c.createBufferSource(); s.buffer = this.buf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    play(name, pos, vol = 1) {
        if (!this.ctx || !this.on) return;
        const R = RECIPES[name];
        if (!R) return;
        const o = this.out(pos, vol);
        if (o) R(this, o);
    }
    // the RC car's buzzing motor, kept running while a car drives
    loop(key, pos, on, pitch = 1) {
        if (!this.ctx) return;
        let L = this.loops[key];
        if (!on) { if (L) { L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); L.o.stop(this.ctx.currentTime + 0.3); delete this.loops[key]; } return; }
        if (!L) {
            const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
            o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = 0;
            o.connect(f); f.connect(g); if (p) { g.connect(p); p.connect(this.fx); } else g.connect(this.fx);
            o.start();
            L = this.loops[key] = { o, g, p };
        }
        const dx = pos[0] - this.L.x, dy = pos[1] - this.L.y, dz = pos[2] - this.L.z, d = Math.hypot(dx, dy, dz);
        const v = this.on ? 0.16 / (1 + d * 0.15) : 0;
        L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        L.o.frequency.setTargetAtTime(110 * pitch, this.ctx.currentTime, 0.05);
        if (L.p) { const rx = Math.cos(this.L.yaw), rz = -Math.sin(this.L.yaw); L.p.pan.value = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * 0.8 : 0; }
    }
}

const RECIPES = {
    swing: (s, o) => s.noise(o, 0.18, 0.3, 'bandpass', 400, 1300, 2),
    whack: (s, o) => { s.noise(o, 0.25, 0.3, 'bandpass', 300, 900, 2); s.tone(o, 'sine', 160, 60, 0.22, 0.35); },
    boing: (s, o) => { s.tone(o, 'sine', 150, 520, 0.28, 0.5); s.tone(o, 'triangle', 300, 900, 0.18, 0.12, 0.03); },
    slice: (s, o) => { s.noise(o, 0.12, 0.35, 'highpass', 3000, 5000, 1); s.tone(o, 'square', 1800, 1200, 0.07, 0.07); },
    crack: (s, o) => { s.noise(o, 0.06, 0.8, 'highpass', 2200, 1500, 1); s.tone(o, 'square', 3000, 700, 0.04, 0.15); },
    squirt: (s, o) => s.noise(o, 0.09, 0.22, 'bandpass', 1700, 900, 3),
    blob: (s, o) => { s.noise(o, 0.25, 0.4, 'bandpass', 600, 300, 2); s.tone(o, 'sine', 260, 120, 0.2, 0.3); },
    splash: (s, o) => { s.noise(o, 0.45, 0.55, 'lowpass', 2200, 260, 1); s.noise(o, 0.2, 0.2, 'bandpass', 3000, 1200, 2, 0.04); },
    pop: (s, o) => { s.noise(o, 0.06, 0.8, 'bandpass', 1000, 800, 1); s.tone(o, 'sine', 700, 200, 0.1, 0.3); s.noise(o, 0.5, 0.5, 'lowpass', 2000, 240, 1, 0.03); },
    throw: (s, o) => s.noise(o, 0.16, 0.22, 'bandpass', 700, 300, 2),
    spray: (s, o) => { s.noise(o, 0.35, 0.5, 'lowpass', 1600, 500, 1); s.tone(o, 'sawtooth', 95, 70, 0.3, 0.12); for (let i = 0; i < 4; i++) s.tone(o, 'square', 1200 + Math.random() * 900, 900, 0.02, 0.05, 0.05 + i * 0.04); },
    blast: (s, o) => { s.noise(o, 0.5, 0.65, 'bandpass', 250, 1600, 1.2); s.tone(o, 'sawtooth', 110, 60, 0.4, 0.15); },
    pitch: (s, o) => s.noise(o, 0.14, 0.28, 'bandpass', 900, 2600, 3),
    bat: (s, o) => { s.tone(o, 'triangle', 420, 160, 0.1, 0.6); s.noise(o, 0.06, 0.6, 'bandpass', 2600, 2000, 2); },
    homerun: (s, o) => { RECIPES.bat(s, o); s.tone(o, 'sine', 800, 1800, 0.5, 0.18, 0.05); },
    serve: (s, o) => { s.tone(o, 'square', 950, 600, 0.03, 0.12); s.noise(o, 0.04, 0.22, 'bandpass', 2200, 1500, 2); },
    lob: (s, o) => s.tone(o, 'sine', 300, 520, 0.1, 0.3),
    bounce: (s, o) => s.tone(o, 'sine', 520, 700, 0.05, 0.2),
    rocket: (s, o) => { s.noise(o, 0.6, 0.45, 'bandpass', 2600, 500, 2); s.tone(o, 'sine', 140, 60, 0.25, 0.35); },
    load: (s, o) => { s.tone(o, 'square', 420, 760, 0.07, 0.1); s.noise(o, 0.1, 0.15, 'highpass', 4000, 4000, 1); },
    boom: (s, o) => {
        s.noise(o, 0.9, 1.0, 'lowpass', 1100, 70, 1); s.tone(o, 'sine', 95, 32, 0.55, 0.9);
        s.tone(o, 'sawtooth', 520, 600, 0.3, 0.12, 0.05); s.tone(o, 'sawtooth', 660, 760, 0.3, 0.1, 0.12);   // party horns
        for (let i = 0; i < 6; i++) s.noise(o, 0.05, 0.12, 'highpass', 5000, 5000, 1, 0.1 + i * 0.05);    // confetti
    },
    bigboom: (s, o) => { RECIPES.boom(s, o); s.tone(o, 'sine', 70, 25, 1.0, 0.8); s.noise(o, 1.4, 0.6, 'lowpass', 600, 50, 1, 0.1); },
    drive: (s, o) => { s.noise(o, 0.1, 0.4, 'highpass', 2500, 2500, 1); s.tone(o, 'sine', 2600, 2600, 0.3, 0.28); s.tone(o, 'sine', 3900, 3900, 0.18, 0.12); },
    deploy: (s, o) => { s.tone(o, 'square', 200, 420, 0.12, 0.15); s.tone(o, 'square', 420, 640, 0.1, 0.12, 0.12); },
    step: (s, o) => s.noise(o, 0.05, 0.16, 'lowpass', 450 + Math.random() * 200, 200, 1),
    clang: (s, o) => { s.noise(o, 0.05, 0.14, 'bandpass', 1800, 1500, 4); s.tone(o, 'triangle', 700 + Math.random() * 200, 600, 0.06, 0.06); },
    jump: (s, o) => s.noise(o, 0.1, 0.12, 'bandpass', 500, 1000, 2),
    land: (s, o) => s.noise(o, 0.14, 0.4, 'lowpass', 380, 90, 1),
    slide: (s, o) => { s.noise(o, 0.55, 0.3, 'bandpass', 900, 350, 2); s.noise(o, 0.4, 0.12, 'highpass', 3000, 2000, 1); },
    dodge: (s, o) => s.noise(o, 0.16, 0.28, 'bandpass', 700, 1700, 2),
    tramp: (s, o) => { s.tone(o, 'sine', 110, 620, 0.4, 0.55); s.tone(o, 'triangle', 220, 1240, 0.35, 0.15); },
    pickup: (s, o) => { s.tone(o, 'square', 880, 880, 0.05, 0.12); s.tone(o, 'square', 1320, 1320, 0.08, 0.12, 0.05); },
    health: (s, o) => { [660, 880, 1100].forEach((f, i) => s.tone(o, 'sine', f, f, 0.08, 0.25, i * 0.06)); },
    armor: (s, o) => { s.tone(o, 'triangle', 320, 150, 0.12, 0.4); s.noise(o, 0.06, 0.3, 'bandpass', 3000, 3000, 3); },
    power: (s, o) => { [440, 554, 659, 880].forEach((f, i) => s.tone(o, 'sawtooth', f, f * 1.01, 0.5, 0.08, i * 0.03)); },
    weapon: (s, o) => { s.tone(o, 'square', 300, 300, 0.04, 0.15); s.tone(o, 'square', 520, 520, 0.06, 0.15, 0.08); s.noise(o, 0.05, 0.2, 'highpass', 3000, 3000, 1, 0.08); },
    hit: (s, o) => s.tone(o, 'square', 1700, 1700, 0.035, 0.12),
    headhit: (s, o) => { s.tone(o, 'square', 2400, 2400, 0.05, 0.16); s.tone(o, 'square', 3200, 3200, 0.05, 0.1, 0.05); },
    ouch: (s, o) => { s.tone(o, 'square', 320, 160, 0.12, 0.25); s.noise(o, 0.1, 0.35, 'bandpass', 900, 400, 2); },
    heart: (s, o) => { s.tone(o, 'sine', 70, 50, 0.12, 0.7); s.tone(o, 'sine', 64, 46, 0.12, 0.55, 0.2); },
    hurt: (s, o) => { s.noise(o, 0.12, 0.4, 'lowpass', 700, 200, 1); s.tone(o, 'sine', 210, 120, 0.1, 0.25); },
    die: (s, o) => { s.tone(o, 'sine', 1300, 240, 0.75, 0.28); s.tone(o, 'sine', 160, 480, 0.25, 0.3, 0.75); },
    medal: (s, o) => { [523, 659, 784, 1046].forEach((f, i) => s.tone(o, 'square', f, f, 0.09, 0.1, i * 0.07)); },
    bigmedal: (s, o) => { [523, 659, 784, 1046, 1318].forEach((f, i) => s.tone(o, 'square', f, f, 0.12, 0.12, i * 0.06)); [1046, 1318, 1568].forEach((f) => s.tone(o, 'sawtooth', f, f, 0.5, 0.05, 0.32)); },
    spawn: (s, o) => s.tone(o, 'sine', 200, 820, 0.3, 0.2),
    trap: (s, o) => { s.tone(o, 'triangle', 160, 70, 0.16, 0.6); s.noise(o, 0.08, 0.5, 'bandpass', 1500, 900, 2); s.tone(o, 'sine', 900, 300, 0.3, 0.12, 0.08); },
    trapset: (s, o) => s.noise(o, 0.08, 0.3, 'bandpass', 900, 600, 3),
    switch: (s, o) => s.noise(o, 0.05, 0.12, 'bandpass', 2000, 1500, 2),
    tick: (s, o) => s.tone(o, 'square', 880, 880, 0.09, 0.15),
    go: (s, o) => { [523, 784, 1046].forEach((f) => s.tone(o, 'sawtooth', f, f, 0.6, 0.08)); },
    empty: (s, o) => s.tone(o, 'square', 300, 250, 0.04, 0.08),
    grab: (s, o) => { s.noise(o, 0.08, 0.6, 'highpass', 2200, 1500, 1); s.tone(o, 'sine', 400, 900, 0.2, 0.2, 0.04); },
    // an ice cream van's tune, on a music box
    jingle: (s, o) => { [72, 76, 79, 76, 77, 74, 72, 79].forEach((n, i) => { const f = 440 * Math.pow(2, (n - 69) / 12); s.tone(o, 'triangle', f, f, 0.28, 0.16, i * 0.3); s.tone(o, 'sine', f * 2, f * 2, 0.18, 0.05, i * 0.3); }); },
    chat: (s, o) => s.tone(o, 'square', 1200, 1200, 0.05, 0.08)
};

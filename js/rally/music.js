/* Synthesised electronic racing music: drum machine, filtered saw bass, plucked arpeggios through a delay,
   and pads. All original patterns, written as 16-step bars. */
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chords as MIDI notes; bass roots an octave or two below
const AM = { prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], roots: [45, 41, 48, 43] };   // Am F C G
const FSM = { prog: [[54, 57, 61], [50, 54, 57], [45, 49, 52], [52, 56, 59]], roots: [42, 38, 45, 40] };  // F#m D A E
const EM = { prog: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]], roots: [40, 36, 38, 35] };   // Em C D Bm

export const SONGS = {
    menu: {
        bpm: 100, key: AM, barsPerChord: 2,
        kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', open: '',
        bass: 'x.....x.....x...', arp: '0.1.2.1.0.2.1.2.', arpOct: 12, pad: true, lead: null, filter: 900
    },
    race1: {
        bpm: 128, key: AM, barsPerChord: 2,
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..x...x...x...x.',
        bass: 'xxoxxxoxxxoxxxox', arp: '0120120120120121', arpOct: 12, pad: true, lead: 'x..x..x...x..x..', filter: 1400
    },
    race2: {
        bpm: 140, key: FSM, barsPerChord: 1,
        kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'xxx.xxx.xxx.xxxx', open: '......x.......x.',
        bass: 'x.xo..x.x.xo..x5', arp: '0.2.1.2.0.2.1.20', arpOct: 24, pad: false, lead: 'x...x..x..x.x...', filter: 1800
    },
    race3: {
        bpm: 132, key: EM, barsPerChord: 2,
        kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', open: '..x.......x.....',
        bass: 'x.oxx.oxx.oxx.ox', arp: '0.1.2.0.1.2.0.1.', arpOct: 12, pad: true, lead: '..x...x...x.x...', filter: 1200
    },
    results: {
        bpm: 96, key: AM, barsPerChord: 1,
        kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', open: '',
        bass: 'x.......x.......', arp: '0.1.2.0.1.2.0.1.', arpOct: 12, pad: true, lead: null, filter: 800
    }
};

export class Music {
    constructor(audio) { this.audio = audio; this.on = true; this.song = null; this.name = ''; this.timer = null; }
    setup() {
        const c = this.audio.ctx;
        if (!c || this.bus) return !!c;
        this.bus = c.createGain(); this.bus.gain.value = this.on ? 0.3 : 0; this.bus.connect(this.audio.master);
        // a simple feedback delay for the arpeggios
        this.delay = c.createDelay(1); this.fb = c.createGain(); this.fb.gain.value = 0.35;
        this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.bus);
        this.noise = this.audio.buf;
        return true;
    }
    setOn(on) { this.on = on; if (this.bus) this.bus.gain.setTargetAtTime(on ? 0.3 : 0, this.audio.ctx.currentTime, 0.1); }
    play(name) {
        if (name === this.name) return;
        this.name = name;
        clearInterval(this.timer);
        if (!this.setup() || !SONGS[name]) { this.song = null; return; }
        this.song = SONGS[name];
        this.step = 0;
        this.next = this.audio.ctx.currentTime + 0.1;
        this.delay.delayTime.value = (60 / this.song.bpm) * 0.75;
        this.timer = setInterval(() => this.tick(), 25);
    }
    stop() { this.name = ''; clearInterval(this.timer); this.song = null; }
    // retry once the audio context exists (it only starts after a click or key)
    want(name) { if (!this.audio.ctx) { this.pending = name; return; } this.play(name); }
    poke() { if (this.pending && this.audio.ctx) { const n = this.pending; this.pending = null; this.play(n); } }
    tick() {
        const c = this.audio.ctx, s = this.song;
        if (!s || !c) return;
        const sixteenth = 60 / s.bpm / 4;
        while (this.next < c.currentTime + 0.12) {
            this.playStep(this.step, this.next, sixteenth);
            this.next += sixteenth;
            this.step++;
        }
    }
    playStep(n, t, dt) {
        const s = this.song, k = n % 16, bar = Math.floor(n / 16);
        const ci = Math.floor(bar / s.barsPerChord) % s.key.prog.length;
        const chord = s.key.prog[ci], root = s.key.roots[ci];
        if (s.kick[k] === 'x') this.kick(t);
        if (s.snare[k] === 'x') this.snare(t);
        if (s.hat[k] === 'x') this.hat(t, 0.035);
        if (s.open && s.open[k] === 'x') this.hat(t, 0.14);
        const b = s.bass[k];
        if (b && b !== '.') this.bass(t, midi(root + (b === 'o' ? 12 : b === '5' ? 7 : 0)), dt * 1.8, s.filter);
        const a = s.arp[k];
        if (a && a !== '.') this.pluck(t, midi(chord[+a] + s.arpOct), dt * 2);
        if (s.pad && k === 0 && bar % s.barsPerChord === 0) chord.forEach((m) => this.pad(t, midi(m), dt * 16 * s.barsPerChord));
        if (s.lead && s.lead[k] === 'x' && bar % 4 >= 2) this.pluck(t, midi(chord[(k / 2) % 3 | 0] + 24), dt * 1.5, 'square', 0.035);
    }
    env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    osc(type, f, t, dur, peak, dest, attack = 0.005) {
        const c = this.audio.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        this.env(g, t, attack, peak, dur);
        o.connect(g); g.connect(dest || this.bus); o.start(t); o.stop(t + attack + dur + 0.05);
        return o;
    }
    kick(t) { const o = this.osc('sine', 150, t, 0.28, 0.9); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
    snare(t) {
        const c = this.audio.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
        this.env(g, t, 0.002, 0.45, 0.16);
        s.connect(f); f.connect(g); g.connect(this.bus); s.start(t); s.stop(t + 0.25);
        this.osc('triangle', 190, t, 0.08, 0.25);
    }
    hat(t, len) {
        const c = this.audio.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7500;
        this.env(g, t, 0.001, 0.18, len);
        s.connect(f); f.connect(g); g.connect(this.bus); s.start(t); s.stop(t + len + 0.05);
    }
    bass(t, f, dur, cutoff) {
        const c = this.audio.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f / 2;
        lp.type = 'lowpass'; lp.Q.value = 6;
        lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(140, t + dur);
        this.env(g, t, 0.004, 0.42, dur);
        o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bus);
        o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    pluck(t, f, dur, type = 'triangle', vol = 0.06) {
        const c = this.audio.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
        o.type = type; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
        this.env(g, t, 0.003, vol, dur);
        o.connect(lp); lp.connect(g); g.connect(this.bus); g.connect(this.delay);
        o.start(t); o.stop(t + dur + 0.05);
    }
    pad(t, f, dur) {
        const c = this.audio.ctx, lp = c.createBiquadFilter(), g = c.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 1100;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
        lp.connect(g); g.connect(this.bus);
    }
}

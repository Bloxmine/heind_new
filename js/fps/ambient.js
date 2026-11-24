/* Ambient music for Yard Sale Showdown: slow, generative, one piece per map. Detuned-saw pads through a slowly
   swept low-pass, a sub drone that glides with the chords, sparse FM electric piano and bell notes, an occasional
   breathy lead, beds of filtered noise (wind, sea, furnace roar, crowd, traffic, fluorescent hum), brushed or no
   percussion, and long reverb and delay tails. Same interface as Gravel Riot's Music: want(), setOn(), poke(), stop(). */

const SCALES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], hijaz: [0, 1, 4, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10]
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* Each piece. root: MIDI note of the key; prog: scale degrees of the chords, barsPer each.
   pad: cut(off) Hz, sweep (how far the LFO opens it), lfo Hz, det(une) cents, lvl.
   keys: FM notes. ratio (1 = electric piano, 3.5 = bell), idx (brightness), dec(ay) s, p (chance a step), oct.
   lead: a breathy sine line now and then. noise: textures. perc: pattern of 16 steps per kind. */
export const AMBIENT = {
    // the menus: calm, slow, spacious
    showdown: { bpm: 64, root: 50, mode: 'dorian', prog: [0, 5, 3, 4], barsPer: 2, pad: { cut: 900, sweep: 700, lfo: 0.05, det: 9, lvl: 1 }, drone: 0.8,
        keys: { ratio: 1, idx: 1.6, dec: 3.2, p: 0.07, oct: 0 }, noise: [['room', 0.5]] },
    /* In a match: a driving groove kept low and out of the way: soft electronic drums, a pulsing filtered bass and a
       low FM pluck, a pad underneath, the map's texture. No lead melody. drums: 16 steps per bar for k(ick), s(nare),
       h(at), o(pen hat), sh(aker), r(im). bass: x root, o octave, 5 fifth, 7 seventh. arp: chord-tone indices. */
    coalworks: { act: true, bpm: 124, root: 40, mode: 'dorian', prog: [0, 0, 5, 6], barsPer: 1, pad: { cut: 900, sweep: 600, lfo: 0.1, det: 10, lvl: 0.5 },
        drums: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: '.......x......x.' }, bass: 'x..x..x...x.x..o', bassCut: 420,
        arp: { pat: '0.1.2.1.0.1.3.1.', oct: 1, ratio: 2, dec: 0.3 }, noise: [['hum', 0.5]] },
    canyon: { act: true, bpm: 112, root: 45, mode: 'mixo', prog: [0, 6, 3, 0], barsPer: 2, pad: { cut: 1300, sweep: 800, lfo: 0.06, det: 8, lvl: 0.55, fifths: true },
        drums: { k: 'x.......x.x.....', s: '....x.......x...', sh: 'xxxxxxxxxxxxxxxx', o: '..x...x...x...x.' }, bass: 'x.x...x.x.x...5.', bassCut: 380,
        arp: { pat: '0...2...1...3...', oct: 2, ratio: 3.5, dec: 0.9 }, noise: [['wind', 0.6]] },
    volcano: { act: true, bpm: 128, root: 37, mode: 'dorian', prog: [0, 0, 3, 4], barsPer: 1, pad: { cut: 700, sweep: 500, lfo: 0.12, det: 14, lvl: 0.45 },
        drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', r: 'x..x..x...x..x..' }, bass: 'xx.xx.x.xx.xx.o.', bassCut: 360,
        arp: { pat: '0.0.1.0.2.0.1.0.', oct: 1, ratio: 2.7, dec: 0.22 }, noise: [['rumble', 0.7]] },
    market: { act: true, bpm: 104, root: 50, mode: 'hijaz', prog: [0, 1, 0, 6], barsPer: 1, pad: { cut: 1400, sweep: 700, lfo: 0.08, det: 8, lvl: 0.45 },
        drums: { k: 'x.....x...x.....', s: '....x..x....x...', sh: 'x.xxx.xxx.xxx.xx', r: '..x.....x.....x.' }, bass: 'x..x.x..x..x.5..', bassCut: 450,
        arp: { pat: '0.1.2...2.1.0...', oct: 1, ratio: 2, dec: 0.35 }, noise: [['murmur', 0.5]] },
    neon: { act: true, bpm: 134, root: 41, mode: 'dorian', prog: [0, 5, 3, 4], barsPer: 2, pad: { cut: 1500, sweep: 900, lfo: 0.07, det: 12, lvl: 0.5, sevenths: true },
        drums: { k: 'x.........x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', o: '......x.......x.' }, bass: 'x.......x.x....o', bassCut: 300, reese: true,
        arp: { pat: '0.2.1.3.0.2.1.3.', oct: 1, ratio: 1, dec: 0.25 }, noise: [['traffic', 0.6]] },
    coast: { act: true, bpm: 118, root: 43, mode: 'mixo', prog: [0, 3, 4, 3], barsPer: 2, pad: { cut: 1600, sweep: 900, lfo: 0.05, det: 8, lvl: 0.55 },
        drums: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.', sh: '.x.x.x.x.x.x.x.x' }, bass: '..x...x...x...x.', bassCut: 400,
        arp: { pat: '0...1...2...1...', oct: 2, ratio: 3.5, dec: 0.8 }, noise: [['sea', 0.6]] },
    office: { act: true, bpm: 120, root: 45, mode: 'dorian', prog: [0, 3, 0, 4], barsPer: 1, pad: { cut: 1100, sweep: 500, lfo: 0.08, det: 6, lvl: 0.4, sevenths: true },
        drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: '..x..x....x..x..' }, bass: 'x..x....x.x..x..', bassCut: 500,
        arp: { pat: '0..1..2..1..0...', oct: 1, ratio: 1, dec: 0.3 }, noise: [['hum', 0.7]] },
    mall: { act: true, bpm: 110, root: 51, mode: 'lydian', prog: [0, 4, 5, 3], barsPer: 2, pad: { cut: 1800, sweep: 900, lfo: 0.05, det: 12, lvl: 0.55, sevenths: true },
        drums: { k: 'x.....x...x.....', s: '....x.......x...', h: '..x...x...x...x.', sh: 'x.x.x.x.x.x.x.x.' }, bass: 'x..o..x..x.o..5.', bassCut: 520,
        arp: { pat: '0.1.2.3.2.1.0...', oct: 1, ratio: 1, dec: 0.4 }, noise: [['hiss', 0.4]] },
    pines: { act: true, bpm: 126, root: 38, mode: 'dorian', prog: [0, 6, 5, 4], barsPer: 2, pad: { cut: 900, sweep: 900, lfo: 0.04, det: 10, lvl: 0.55 },
        drums: { k: 'x.....x...x.....', s: '....x.......x..x', h: 'x.xxx.xxx.xxx.xx' }, bass: 'x.x.x.x.x.x.x.x.', bassCut: 340,
        arp: { pat: '0...2...1...2...', oct: 2, ratio: 3.5, dec: 1.1 }, noise: [['wind', 0.8]] },
    toybox: { act: true, bpm: 122, root: 48, mode: 'lydian', prog: [0, 1, 5, 4], barsPer: 1, pad: { cut: 1300, sweep: 600, lfo: 0.08, det: 6, lvl: 0.4 },
        drums: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.', r: '...x.....x......' }, bass: 'x.xo..x.x.xo..x.', bassCut: 480,
        arp: { pat: '0.1.2.1.3.2.1.2.', oct: 2, ratio: 5, dec: 0.35 }, noise: [['room', 0.5]] }
};

export class Ambient {
    constructor(audio) { this.audio = audio; this.on = true; this.name = ''; this.timer = null; this.live = []; }
    setup() {
        if (this.bus) return;
        const c = this.audio.ctx;
        this.bus = c.createGain(); this.bus.gain.value = this.on ? 0.75 : 0; this.bus.connect(this.audio.master);
        // in a match the music is kept out of the way: a dip where gunfire, footsteps and cues sit, and a softer top
        this.eqIn = c.createGain();
        this.dip = c.createBiquadFilter(); this.dip.type = 'peaking'; this.dip.frequency.value = 2200; this.dip.Q.value = 0.8; this.dip.gain.value = 0;
        this.top = c.createBiquadFilter(); this.top.type = 'highshelf'; this.top.frequency.value = 6000; this.top.gain.value = 0;
        this.duckG = c.createGain(); this.duckG.gain.value = 1;
        this.eqIn.connect(this.dip); this.dip.connect(this.top); this.top.connect(this.duckG); this.duckG.connect(this.bus);
        this.dry = c.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.eqIn);
        // a long, dark reverb: decaying noise as the impulse
        this.verb = c.createConvolver();
        const len = Math.floor(c.sampleRate * 5), ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.35; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
        this.verb.buffer = ir;
        const vg = c.createGain(); vg.gain.value = 0.9; this.verb.connect(vg); vg.connect(this.eqIn);
        // a filtered feedback delay, for the tails
        this.delay = c.createDelay(3); const fb = c.createGain(), dl = c.createBiquadFilter();
        fb.gain.value = 0.48; dl.type = 'lowpass'; dl.frequency.value = 2200;
        this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.verb);
        const dg = c.createGain(); dg.gain.value = 0.5; dl.connect(dg); dg.connect(this.eqIn);
        this.sendV = c.createGain(); this.sendV.gain.value = 1; this.sendV.connect(this.verb);
        this.sendD = c.createGain(); this.sendD.gain.value = 1; this.sendD.connect(this.delay);
        // white noise, shared by the textures and the brushes
        const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
    }
    // pull the music down for a moment (shooting, getting hit), then let it come back up
    duck(k = 0.4) {
        const c = this.audio.ctx; if (!c || !this.duckG || !this.P || !this.P.act) return;
        const t = c.currentTime;
        if (this.duckUntil > t + 0.3 && this.duckK >= k) return;
        this.duckK = k; this.duckUntil = t + 0.6;
        this.duckG.gain.cancelScheduledValues(t); this.duckG.gain.setTargetAtTime(1 - k, t, 0.04); this.duckG.gain.setTargetAtTime(1, t + 0.6, 0.7);
    }
    setOn(on) { this.on = on; if (this.bus) this.bus.gain.setTargetAtTime(on ? 0.75 : 0, this.audio.ctx.currentTime, 0.3); }
    want(name) { if (!this.audio.ctx) { this.pending = name; return; } this.play(name); }
    poke() { if (this.pending && this.audio.ctx) { const n = this.pending; this.pending = null; this.play(n); } }
    stop() {
        this.name = ''; clearInterval(this.timer); this.timer = null;
        const c = this.audio.ctx; if (!c) return;
        const t = c.currentTime;
        for (const v of this.live) { try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.8); for (const s of v.src) s.stop(t + 4); } catch (e) { /* already stopped */ } }
        this.live = [];
    }
    play(name) {
        const P = AMBIENT[name] || AMBIENT.showdown;
        if (this.name === name && this.timer) return;
        this.stop(); this.setup();
        this.name = name; this.P = P;
        const c = this.audio.ctx;
        this.scale = SCALES[P.mode];
        this.step = 60 / P.bpm / 4; this.next = c.currentTime + 0.15; this.n = 0; this.ci = -1;
        this.delay.delayTime.setValueAtTime(Math.min(2.9, this.step * (P.act ? 3 : 6)), c.currentTime);    // a dotted eighth in a match, a dotted quarter in the menus
        this.dip.gain.setTargetAtTime(P.act ? -8 : 0, c.currentTime, 0.5); this.top.gain.setTargetAtTime(P.act ? -6 : 0, c.currentTime, 0.5);
        this.sendV.gain.setTargetAtTime(P.act ? 0.45 : 1, c.currentTime, 0.5);
        // fade the new piece in (the old one is fading out from stop())
        const t0 = c.currentTime;
        this.eqIn.gain.cancelScheduledValues(t0); this.eqIn.gain.setValueAtTime(0.0001, t0); this.eqIn.gain.linearRampToValueAtTime(1, t0 + (P.act ? 1.2 : 2.5));
        this.startTextures(P);
        this.timer = setInterval(() => this.sched(), 100);
    }
    note(deg, oct = 0) { const s = this.scale, o = Math.floor(deg / 7); return this.P.root + s[((deg % 7) + 7) % 7] + 12 * (o + oct); }
    sched() {
        const c = this.audio.ctx, P = this.P;
        if (!c || !P) return;
        // Behind (the page stalled while loading, or the tab was hidden): skip what was missed rather than
        // playing it all at once, which is what made the pile of loud notes when going back to the menu
        const now = c.currentTime;
        if (this.next < now) { const k = Math.ceil((now - this.next) / this.step) || 1; this.next += k * this.step; this.n += k; }
        while (this.next < now + 0.4) {
            const t = this.next, n = this.n, bar = Math.floor(n / 16), stepInBar = n % 16;
            // a new chord
            if (stepInBar === 0 && bar % P.barsPer === 0) {
                this.ci = (this.ci + 1) % P.prog.length;
                const d = P.prog[this.ci], dur = P.barsPer * 16 * this.step;
                this.chord = [d, d + 2, d + 4].concat(P.pad.sevenths ? [d + 6] : []);
                const po = P.act && P.root < 45 ? 1 : 0;
                this.pad(t, P.pad.fifths ? [this.note(d, po), this.note(d + 4, po), this.note(d, po + 1)] : this.chord.map((x) => this.note(x, po)), dur);
                this.drone(t, this.note(d, -2), P.drone);
            }
            // keys: sparse notes from the chord and the scale, sometimes a little run, sometimes a soft chord
            const K = P.keys;
            if (K && !P.act && Math.random() < K.p * (stepInBar % 4 === 0 ? 1.8 : 0.7)) {
                if (K.chords && stepInBar % 8 === 0) for (const x of this.chord.slice(0, 3)) this.fm(t + Math.random() * 0.03, hz(this.note(x, K.oct + 1)), K, 0.6);
                else {
                    const pool = this.chord.concat([this.chord[0] + 1, this.chord[0] + 5]), x = pool[Math.floor(Math.random() * pool.length)];
                    this.fm(t, hz(this.note(x, K.oct + 1)), K, 1);
                    if (K.run && Math.random() < 0.3) for (let i = 1; i < 4; i++) this.fm(t + i * this.step, hz(this.note(x - i, K.oct + 1)), K, 0.7 - i * 0.12);
                }
            }
            // a breathy lead phrase now and then, at the top of a bar
            if (P.lead && !P.act && stepInBar === 0 && Math.random() < P.lead.p) {
                let x = this.chord[Math.floor(Math.random() * 3)] + 7;
                for (let i = 0; i < 4; i++) { this.lead(t + i * this.step * 4, hz(this.note(x, P.lead.oct)), this.step * 5.5); x += [1, -1, -2, 2][Math.floor(Math.random() * 4)]; }
            }
            if (P.perc) for (const [k, pat] of Object.entries(P.perc)) if (pat[stepInBar] === 'x') this[k](t);
            if (P.act) this.groove(t, bar, stepInBar);
            this.next += this.step; this.n++;
        }
    }
    keep(src, g, until) { const v = { src, g, until }; this.live.push(v); this.live = this.live.filter((q) => q.until > this.audio.ctx.currentTime - 1); return v; }
    // the pad: three detuned saws a note, through a low-pass that breathes open and shut
    pad(t, notes, dur) {
        const c = this.audio.ctx, P = this.P.pad, att = Math.min(3, dur * 0.4), rel = 4.5, end = t + dur + rel;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022 * P.lvl, t + att); g.gain.setValueAtTime(0.022 * P.lvl, t + dur); g.gain.linearRampToValueAtTime(0, end);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2.5; f.frequency.value = P.cut;
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = P.lfo; lg.gain.value = P.sweep * 0.5; lfo.connect(lg); lg.connect(f.frequency);
        f.frequency.setValueAtTime(P.cut + P.sweep * 0.5, t);
        f.connect(g); g.connect(this.dry); g.connect(this.sendV);
        const src = [lfo];
        for (const m of notes) for (const dc of [-P.det, 0, P.det]) {
            const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = dc + (Math.random() - 0.5) * 3;
            o.connect(f); o.start(t); o.stop(end + 0.1); src.push(o);
        }
        lfo.start(t); lfo.stop(end + 0.1);
        this.keep(src, g, end);
    }
    // the drone: a sub sine and a soft triangle an octave up, gliding from chord to chord
    drone(t, m, lvl) {
        if (!lvl) return;
        const c = this.audio.ctx;
        if (!this.dr || this.dr.until < t + 1) {
            const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * lvl, t + 4);
            const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(g); g.connect(this.dry);
            const a = c.createOscillator(), b = c.createOscillator(); a.type = 'sine'; b.type = 'triangle';
            a.connect(lp); const bg = c.createGain(); bg.gain.value = 0.35; b.connect(bg); bg.connect(lp);
            a.start(t); b.start(t);
            this.dr = this.keep([a, b], g, Infinity); this.dr.a = a; this.dr.b = b;
        }
        this.dr.a.frequency.setTargetAtTime(hz(m), t, 0.6); this.dr.b.frequency.setTargetAtTime(hz(m + 12), t, 0.6);
    }
    // a two-operator FM note: electric piano at ratio 1, bells higher up
    fm(t, f, K, vel) {
        const c = this.audio.ctx, end = t + K.dec + 0.2;
        const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * K.ratio;
        mg.gain.setValueAtTime(f * K.idx, t); mg.gain.exponentialRampToValueAtTime(f * K.idx * 0.08 + 1, t + K.dec * 0.6);
        mod.connect(mg); mg.connect(car.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 * vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, end);
        car.connect(g); g.connect(this.dry); g.connect(this.sendV); g.connect(this.sendD);
        car.start(t); mod.start(t); car.stop(end); mod.stop(end);
        this.keep([car, mod], g, end);
    }
    // a breathy lead: a sine with slow vibrato and a little noise
    lead(t, f, dur) {
        const c = this.audio.ctx, end = t + dur + 0.6;
        const o = c.createOscillator(), v = c.createOscillator(), vg = c.createGain(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f; v.frequency.value = 4.6; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, end);
        o.connect(g); g.connect(this.dry); g.connect(this.sendV); g.connect(this.sendD);
        const n = c.createBufferSource(); n.buffer = this.noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 6;
        const ng = c.createGain(); ng.gain.value = 0.25; n.connect(bp); bp.connect(ng); ng.connect(g);
        o.start(t); v.start(t); n.start(t, Math.random() * 2); o.stop(end); v.stop(end); n.stop(end);
        this.keep([o, v, n], g, end);
    }
    // noise beds, running all through the piece
    startTextures(P) {
        const c = this.audio.ctx, t = c.currentTime;
        for (const [kind, lvl] of P.noise || []) {
            const g = c.createGain(); g.gain.setValueAtTime(0, t); g.connect(this.dry);
            const src = [];
            const noise = (f1, type, f, q = 0.7) => { const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; n.connect(fl); n.start(t, Math.random() * 2); src.push(n); return fl; };
            const lfo = (hzv, depth, param, type = 'sine') => { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = hzv; og.gain.value = depth; o.connect(og); og.connect(param); o.start(t); src.push(o); };
            let level = 0.03;
            if (kind === 'wind') { const f = noise(0, 'bandpass', 600, 0.9); const a = c.createGain(); a.gain.value = 0.6; f.connect(a); a.connect(g); lfo(0.07, 380, f.frequency); lfo(0.11, 0.45, a.gain); level = 0.05; }
            else if (kind === 'sea') { const f = noise(0, 'lowpass', 700, 0.5); const a = c.createGain(); a.gain.value = 0.55; f.connect(a); a.connect(g); lfo(0.12, 0.5, a.gain); lfo(0.12, 400, f.frequency); level = 0.06; }
            else if (kind === 'rumble') { const f = noise(0, 'lowpass', 160, 1.2); const a = c.createGain(); a.gain.value = 0.7; f.connect(a); a.connect(g); lfo(0.09, 0.3, a.gain); lfo(0.05, 60, f.frequency); level = 0.12; }
            else if (kind === 'murmur') { const f = noise(0, 'bandpass', 520, 1.8); const a = c.createGain(); a.gain.value = 0.6; f.connect(a); a.connect(g); lfo(1.7, 0.25, a.gain, 'triangle'); lfo(0.23, 0.2, a.gain); level = 0.04; }
            else if (kind === 'traffic') { const f = noise(0, 'lowpass', 380, 0.8); const a = c.createGain(); a.gain.value = 0.5; f.connect(a); a.connect(g); lfo(0.06, 0.45, a.gain); lfo(0.04, 160, f.frequency); level = 0.07; }
            else if (kind === 'hiss') { const f = noise(0, 'highpass', 3800, 0.5); f.connect(g); level = 0.012; }
            else if (kind === 'room') { const f = noise(0, 'lowpass', 280, 0.5); f.connect(g); level = 0.035; }
            else if (kind === 'hum') {
                // a fluorescent hum: 120 Hz with its overtones, wavering a touch
                for (const [fr, a] of [[120, 1], [240, 0.5], [360, 0.25]]) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = fr; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); src.push(o); }
                level = 0.0045;
            }
            g.gain.linearRampToValueAtTime(level * lvl, t + 3);
            this.keep(src, g, Infinity);
        }
    }
    // a match's groove for one step: drums, bass, the low pluck; every eighth bar a little fill
    groove(t, bar, i) {
        const P = this.P, D = P.drums, fill = bar % 8 === 7, drop = bar % 16 === 12;
        if (D.k && D.k[i] === 'x' && !(drop && i < 8)) this.kick(t);
        if (D.s && (D.s[i] === 'x' || (fill && i >= 12 && i % 2 === 0))) this.snare(t, fill && i >= 12 ? 0.6 : 1);
        if (D.h && D.h[i] === 'x') this.hat(t, false, i % 4 === 0 ? 1 : 0.65);
        if (D.o && D.o[i] === 'x') this.hat(t, true, 1);
        if (D.sh && D.sh[i] === 'x') this.shaker(t, i % 2 ? 0.6 : 1);
        if (D.r && D.r[i] === 'x') this.tick(t);
        const b = P.bass[i];
        if (b && b !== '.' && this.chord) { const d = this.chord[0] + (b === '5' ? 4 : b === '7' ? 6 : 0); this.bass(t, this.note(d, -1) + (b === 'o' ? 12 : 0), this.step * 1.6); }
        const A = P.arp, ch = A && A.pat[i];
        if (ch && ch !== '.' && this.chord) this.fm(t, hz(this.note(this.chord[+ch % this.chord.length] ?? this.chord[0], A.oct)), { ratio: A.ratio, idx: 1.1, dec: A.dec }, 0.45);
    }
    kick(t) {
        const c = this.audio.ctx, o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
        g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.32);
        o.connect(g); g.connect(this.dry); o.start(t); o.stop(t + 0.35);
    }
    snare(t, v = 1) {
        const c = this.audio.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.6;
        const g = c.createGain(); g.gain.setValueAtTime(0.055 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.2);
        n.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.sendV); n.start(t, Math.random() * 2); n.stop(t + 0.22);
        const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.value = 185; og.gain.setValueAtTime(0.04 * v, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
        o.connect(og); og.connect(this.dry); o.start(t); o.stop(t + 0.1);
    }
    hat(t, open, v = 1) {
        const c = this.audio.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
        const g = c.createGain(), d = open ? 0.22 : 0.045; g.gain.setValueAtTime(0.022 * v, t); g.gain.exponentialRampToValueAtTime(0.0004, t + d);
        n.connect(f); f.connect(g); g.connect(this.dry); n.start(t, Math.random() * 2); n.stop(t + d + 0.02);
    }
    shaker(t, v = 1) {
        const c = this.audio.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 1.2;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.014 * v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.07);
        n.connect(f); f.connect(g); g.connect(this.dry); n.start(t, Math.random() * 2); n.stop(t + 0.09);
    }
    // the bass: a saw and a square an octave down, through a low-pass that snaps open on each note
    bass(t, m, dur) {
        const c = this.audio.ctx, P = this.P, end = t + dur;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
        f.frequency.setValueAtTime(P.bassCut * 2.2, t); f.frequency.exponentialRampToValueAtTime(P.bassCut, t + 0.12);
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.075, t + 0.008); g.gain.setTargetAtTime(0.05, t + 0.05, 0.08); g.gain.linearRampToValueAtTime(0, end);
        const src = [];
        for (const [type, mm, det] of P.reese ? [['sawtooth', m, -12], ['sawtooth', m, 12]] : [['sawtooth', m, 0], ['square', m - 12, 0]]) {
            const o = c.createOscillator(); o.type = type; o.frequency.value = hz(mm); o.detune.value = det; o.connect(f); o.start(t); o.stop(end + 0.02); src.push(o);
        }
        f.connect(g); g.connect(this.dry);
        this.keep(src, g, end);
    }
    // percussion: brushes, a clock tick, a soft thump
    brush(t) {
        const c = this.audio.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 600; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.28);
        n.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.sendV); n.start(t, Math.random() * 2); n.stop(t + 0.3);
    }
    tick(t) {
        const c = this.audio.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = 'square'; o.frequency.value = 2400; g.gain.setValueAtTime(0.008, t); g.gain.exponentialRampToValueAtTime(0.0002, t + 0.03);
        o.connect(g); g.connect(this.dry); g.connect(this.sendD); o.start(t); o.stop(t + 0.04);
    }
    thump(t) {
        const c = this.audio.ctx, o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
        g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
        o.connect(g); g.connect(this.dry); g.connect(this.sendV); o.start(t); o.stop(t + 0.5);
    }
}

/* Synthesised car sounds: an engine that follows revs and gears, tyre skids and gravel under the wheels. */
export class CarAudio {
    constructor() { this.ctx = null; this.on = true; }
    start() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain(); this.master.gain.value = this.on ? 0.45 : 0; this.master.connect(c.destination);
        // engine: two detuned saws and a square sub, through a lowpass that opens with throttle
        this.eng = c.createGain(); this.eng.gain.value = 0;
        this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 600; this.lp.Q.value = 3;
        this.oscs = [['sawtooth', 1], ['sawtooth', 1.012], ['square', 0.5]].map(([type, mul]) => {
            const o = c.createOscillator(); o.type = type; o.frequency.value = 50; o.mul = mul;
            const g = c.createGain(); g.gain.value = type === 'square' ? 0.25 : 0.32;
            o.connect(g); g.connect(this.lp); o.start(); return o;
        });
        this.lp.connect(this.eng); this.eng.connect(this.master);
        // noise for tyres and gravel
        const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const noise = (type, f, q) => {
            const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
            const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
            const g = c.createGain(); g.gain.value = 0;
            s.connect(fl); fl.connect(g); g.connect(this.master); s.start();
            return { g, fl };
        };
        this.skid = noise('bandpass', 1400, 4);
        this.roll = noise('lowpass', 500, 0.7);
        this.rainN = noise('highpass', 2600, 0.4);
        this.buf = buf;
    }
    setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.45 : 0, this.ctx.currentTime, 0.05); }
    // rpm 0..1, throttle 0..1, slip m/s, speed m/s, rough 0..1 (gravel/grass)
    update(rpm, throttle, slip, speed, rough, air) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const f = 38 + rpm * 150;
        this.oscs.forEach((o) => o.frequency.setTargetAtTime(f * o.mul, t, 0.03));
        this.lp.frequency.setTargetAtTime(300 + throttle * 1400 + rpm * 600, t, 0.05);
        this.eng.gain.setTargetAtTime(0.18 + throttle * 0.22, t, 0.05);
        this.skid.g.gain.setTargetAtTime(air ? 0 : Math.min(0.32, Math.max(0, slip - 2.5) * 0.04), t, 0.05);
        this.roll.g.gain.setTargetAtTime(air ? 0 : Math.min(0.3, speed * 0.006) * (0.4 + rough), t, 0.08);
        this.roll.fl.frequency.setTargetAtTime(300 + rough * 900, t, 0.1);
    }
    setRain(k) { if (this.ctx) this.rainN.g.gain.setTargetAtTime(k * 0.08, this.ctx.currentTime, 0.3); }
    splash() {
        if (!this.ctx || !this.on) return;
        const c = this.ctx, t = c.currentTime;
        const s = c.createBufferSource(); s.buffer = this.buf;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
        const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.5);
    }
    thud(k = 1) {
        if (!this.ctx || !this.on) return;
        const c = this.ctx, t = c.currentTime;
        const s = c.createBufferSource(); s.buffer = this.buf;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
        const g = c.createGain(); g.gain.setValueAtTime(0.6 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.32);
    }
    beep(freq = 660, dur = 0.15) {
        if (!this.ctx || !this.on) return;
        const c = this.ctx, t = c.currentTime;
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = freq;
        const g = c.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    }
}

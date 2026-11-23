/* Subshootica DX: synthesised sound effects and a tiny chiptune tracker. No audio files. */
(() => {
    const S = window.SEA;
    const A = S.ga = { sfxOn: true, musicOn: true };
    let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, pulse = {};

    const ctx = () => {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ac = new AC();
            master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
            sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
            musBus = ac.createGain(); musBus.gain.value = 0.55; musBus.connect(master);
            noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            // Pulse waves with GameBoy-ish duty cycles.
            for (const duty of [0.125, 0.25, 0.5]) {
                const n = 40, re = new Float32Array(n), im = new Float32Array(n);
                for (let k = 1; k < n; k++) {
                    re[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
                    im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
                }
                pulse[duty] = ac.createPeriodicWave(re, im);
            }
        }
        if (ac.state === 'suspended') ac.resume();
        return ac;
    };
    A.unlock = () => ctx();

    const osc = (type, f0, f1, dur, vol, delay = 0, dest = sfxBus, slide = 'exp') => {
        const c = ctx(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain();
        const t0 = c.currentTime + Math.max(0, delay);
        if (pulse[type]) o.setPeriodicWave(pulse[type]); else o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        if (f1) slide === 'lin' ? o.frequency.linearRampToValueAtTime(f1, t0 + dur) : o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(dest);
        o.start(t0); o.stop(t0 + dur + 0.03);
    };
    const noise = (dur, vol, freq, delay = 0, type = 'lowpass', dest = sfxBus, f1) => {
        const c = ctx(); if (!c) return;
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        const t0 = c.currentTime + Math.max(0, delay);
        s.buffer = noiseBuf; s.loop = true;
        f.type = type; f.frequency.setValueAtTime(freq, t0);
        if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(dest);
        s.start(t0); s.stop(t0 + dur + 0.03);
    };

    const last = {};
    const SFX = {
        shot: () => osc(0.25, 1250, 620, 0.05, 0.035),
        homing: () => osc(0.125, 600, 1400, 0.07, 0.03),
        hit: () => noise(0.04, 0.12, 2400, 0, 'highpass'),
        clank: () => { osc('triangle', 380, 300, 0.06, 0.08); noise(0.03, 0.06, 4000, 0, 'highpass'); },
        pop: () => { noise(0.18, 0.3, 1400, 0, 'lowpass', sfxBus, 200); osc('square', 220, 60, 0.15, 0.06); },
        boom: () => { noise(0.5, 0.45, 900, 0, 'lowpass', sfxBus, 80); osc('sine', 120, 35, 0.4, 0.3); },
        bigboom: () => { noise(1.4, 0.6, 1200, 0, 'lowpass', sfxBus, 50); osc('sine', 90, 25, 1.2, 0.4); osc(0.5, 160, 40, 0.8, 0.06, 0.1); },
        bomb: () => { osc('sine', 60, 30, 1.0, 0.45); noise(1.2, 0.5, 600, 0, 'lowpass', sfxBus, 60); osc(0.125, 1800, 200, 0.6, 0.05); },
        hurt: () => { osc(0.5, 600, 80, 0.5, 0.12); noise(0.4, 0.4, 800, 0.05); },
        shield: () => { osc('sine', 1400, 300, 0.25, 0.15); noise(0.15, 0.2, 3000, 0, 'highpass'); },
        power: () => [523, 659, 784, 1047, 1319].forEach((f, i) => osc(0.25, f, 0, 0.09, 0.07, i * 0.05)),
        oneup: () => [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => osc(0.5, f, 0, 0.1, 0.07, i * 0.07)),
        pearl: () => osc('triangle', 1760 + Math.random() * 200, 0, 0.08, 0.06),
        warn: () => { for (let i = 0; i < 3; i++) { osc('sawtooth', 440, 880, 0.35, 0.05, i * 0.7, sfxBus, 'lin'); osc('sawtooth', 880, 440, 0.35, 0.05, i * 0.7 + 0.35, sfxBus, 'lin'); } },
        move: () => osc(0.5, 880, 0, 0.04, 0.05),
        select: () => { osc(0.25, 660, 0, 0.06, 0.06); osc(0.25, 990, 0, 0.1, 0.06, 0.06); },
        back: () => { osc(0.25, 660, 0, 0.06, 0.06); osc(0.25, 440, 0, 0.1, 0.06, 0.06); },
        type: () => osc(0.5, 1500 + Math.random() * 300, 0, 0.015, 0.02),
        pause: () => { osc(0.5, 988, 0, 0.06, 0.06); osc(0.5, 1319, 0, 0.12, 0.06, 0.07); },
        splash: () => { noise(0.8, 0.35, 2500, 0, 'bandpass', sfxBus, 300); osc('sine', 300, 900, 0.3, 0.06); },
        sonar: () => { osc('sine', 1180, 0, 1.3, 0.12); osc('sine', 1180, 0, 1.0, 0.04, 0.5); },
        charge: () => osc(0.125, 200, 1600, 0.6, 0.05),
        chomp: () => { noise(0.08, 0.4, 800); noise(0.1, 0.4, 500, 0.1); }
    };
    A.sfx = (name, arg) => {
        if (!A.sfxOn || !SFX[name] || !ac) return;
        const now = performance.now();
        if (last[name] && now - last[name] < 30) return; // no machine-gun stacking of the same sound
        last[name] = now;
        try { SFX[name](arg); } catch (e) { /* sound is optional */ }
    };

    /* ---------- tracker ----------
       Songs are written one token per step: a note like D5 or A#4, "-" holds it, "." is a rest.
       Drums: k = kick, s = snare, h = hat, x = kick + hat. Bars "|" are ignored. */
    const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const freq = (tok) => {
        const m = /^([A-G]#?)(-?\d)$/.exec(tok);
        if (!m) return 0;
        return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
    };
    const parse = (str) => {
        const toks = str.split(/\s+/).filter((t) => t && t !== '|');
        const ev = [];
        toks.forEach((t, i) => {
            if (t === '-') { if (ev.length && ev[ev.length - 1].open) ev[ev.length - 1].len++; return; }
            if (ev.length) ev[ev.length - 1].open = false;
            if (t === '.') return;
            ev.push({ step: i, tok: t, f: freq(t), len: 1, open: true });
        });
        const at = new Map(ev.map((e) => [e.step, e]));
        return { n: toks.length, at };
    };
    const rep = (s, n) => Array(n).fill(s).join(' ');

    const SONGS = {
        title: {
            bpm: 104, loop: true,
            lead: 'A4 - C5 E5 D5 - C5 B4 | A4 - - E4 G4 - A4 - | F4 - A4 C5 B4 - A4 G4 | E4 - - - - - . . | A4 - C5 E5 G5 - E5 D5 | C5 - D5 E5 A5 - G5 E5 | F5 - E5 D5 C5 - B4 G4 | A4 - - - - - . .',
            bass: 'A2 . A3 . A2 . A3 . | A2 . A3 . G2 . G3 . | F2 . F3 . F2 . F3 . | E2 . E3 . E2 . E3 . | A2 . A3 . A2 . A3 . | C3 . C4 . G2 . G3 . | F2 . F3 . G2 . G3 . | A2 . E3 . A2 . . .',
            drum: rep('k . h . s . h h', 8), duty: 0.25
        },
        stage1: {
            bpm: 150, loop: true,
            lead: 'E5 . E5 G5 . E5 D5 . | B4 . D5 E5 - - . . | E5 . E5 G5 . A5 B5 . | A5 G5 E5 D5 - - . . | C5 . C5 E5 . C5 B4 . | A4 . B4 C5 - - D5 . | E5 - D5 - B4 - G4 - | A4 - B4 - - - . .',
            bass: 'E2 E3 E2 E3 E2 E3 E2 E3 | E2 E3 E2 E3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 B1 B2 B1 B2',
            drum: rep('x . s h k x s h', 8), duty: 0.5
        },
        stage2: {
            bpm: 138, loop: true,
            lead: 'D5 . . F5 . . A5 . | G5 F5 E5 . C5 . . . | D5 . . F5 . . A5 . | C6 A5 G5 . A5 . . . | A#5 . A5 . G5 . F5 . | E5 . F5 . G5 . . . | F5 . E5 . D5 . C#5 . | D5 - - - - - . .',
            bass: 'D2 D3 D2 D3 D2 D3 D2 D3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 D2 D3 | F2 F3 F2 F3 C2 C3 C2 C3 | A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 | C2 C3 C2 C3 C2 C3 C2 C3 | A1 A2 A1 A2 A1 A2 A1 A2 | D2 D3 D2 D3 D2 . . .',
            drum: rep('k . h k s . h .', 8), duty: 0.25
        },
        stage3: {
            bpm: 120, loop: true,
            lead: 'B4 - - - . . F#5 . | G5 - F#5 - E5 - - . | B4 - - - . . D5 . | C#5 - - - - - . . | G5 - - - . . F#5 . | E5 - D5 - C#5 - - . | D5 - C#5 - B4 - A#4 . | B4 - - - - - - .',
            bass: 'B1 . . B1 B2 . . . | E2 . . E2 E3 . . . | B1 . . B1 B2 . . . | F#2 . . F#2 F#3 . . . | G2 . . G2 G3 . . . | E2 . . E2 E3 . . . | F#2 . . F#2 F#3 . . . | B1 . . B1 B2 . . .',
            drum: rep('k . . h s . . h', 8), duty: 0.125
        },
        stage4: {
            bpm: 158, loop: true,
            lead: 'G5 . G5 . A#5 . G5 F5 | D#5 . F5 . G5 - - . | G5 . G5 . A#5 . C6 D6 | C6 A#5 G5 . F5 - - . | D#5 . D#5 . F5 . D#5 D5 | C5 . D5 . D#5 - - . | D5 . D#5 . F5 . A5 . | G5 - - - - - . .',
            bass: 'G2 G2 G3 G2 G2 G3 G2 G3 | D#2 D#2 D#3 D#2 D#2 D#3 D#2 D#3 | G2 G2 G3 G2 G2 G3 G2 G3 | F2 F2 F3 F2 F2 F3 F2 F3 | C2 C2 C3 C2 C2 C3 C2 C3 | G#1 G#1 G#2 G#1 G#1 G#2 G#1 G#2 | D2 D2 D3 D2 D2 D3 D2 D3 | G2 G2 G3 G2 D2 D3 F#2 F#3',
            drum: rep('x h s h k x s h', 8), duty: 0.5
        },
        boss: {
            bpm: 172, loop: true,
            lead: 'E5 F5 E5 . B4 . E5 F5 | G5 F5 E5 . D5 . . . | E5 F5 E5 . B4 . E5 F5 | A5 G5 F5 . E5 . . . | C6 B5 A5 G5 F5 E5 F5 G5 | A5 - - - B5 - - - | C6 B5 A5 G5 F5 E5 D5 F5 | E5 - - - - - . .',
            bass: rep('E2 E2 E3 E2 E2 E3 E2 F2', 3) + ' ' + 'E2 E2 E3 E2 F2 F3 F2 F3 | ' + rep('A1 A1 A2 A1 A1 A2 A1 A#1', 2) + ' ' + 'F2 F2 F3 F2 G2 G3 G2 G3 | E2 E2 E3 E2 E2 E3 E2 E3',
            drum: rep('x h s h k x s s', 8), duty: 0.25
        },
        king: {
            bpm: 180, loop: true,
            lead: 'C5 D#5 G5 C6 B5 G5 D#5 D5 | C5 . C5 . D5 . D#5 . | F5 G#5 C6 F6 D#6 C6 G#5 G5 | F5 . G5 . G#5 . A#5 . | C6 . B5 . G#5 . G5 . | F5 . D#5 . D5 . B4 . | C5 D5 D#5 F5 G5 G#5 B5 D6 | C6 - - - C5 . . .',
            bass: rep('C2 C3 C2 C3 C2 C3 C2 C3', 2) + ' ' + rep('F2 F3 F2 F3 F2 F3 F2 F3', 2) + ' | G#1 G#2 G#1 G#2 G#1 G#2 G#1 G#2 | G1 G2 G1 G2 G1 G2 G1 G2 | ' + rep('C2 C3 C2 C3 C2 C3 C2 C3', 2),
            drum: rep('x s x s x s x x', 8), duty: 0.125
        },
        ending: {
            bpm: 96, loop: true,
            lead: 'C5 - E5 - G5 - - E5 | F5 - A5 - G5 - - - | E5 - G5 - C6 - B5 A5 | G5 - - - - - . . | A5 - G5 - F5 - E5 - | D5 - E5 - F5 - - - | E5 - D5 - C5 - B4 - | C5 - - - - - . .',
            bass: 'C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G3 . G2 . D3 . | C3 . G3 . C3 . . .',
            drum: rep('k . h . s . h .', 8), duty: 0.5
        },
        clear: { bpm: 160, loop: false, lead: 'C5 E5 G5 C6 - . G5 C6 - - - - . .', bass: 'C3 . . C3 - . G2 C3 - - - - . .', drum: 'k . . k . . k x . . . . . .', duty: 0.25 },
        gameover: { bpm: 110, loop: false, lead: 'E5 D5 C5 B4 A4 - - . G#4 - A4 - - - - .', bass: 'A2 . . . F2 . . . E2 - - . A1 - - .', drum: 'k . . . k . . . s . . . k . . .', duty: 0.5 }
    };
    Object.values(SONGS).forEach((s) => { s.ch = { lead: parse(s.lead), bass: parse(s.bass), drum: parse(s.drum) }; });

    let song = null, songName = '', step = 0, nextT = 0, timer = null, bus = null;
    const playStep = (s, i, t) => {
        const dt = 60 / s.bpm / 2, rel = t - ac.currentTime;
        const L = s.ch.lead, B = s.ch.bass, D = s.ch.drum;
        const li = s.loop ? i % L.n : i, bi = s.loop ? i % B.n : i, di = s.loop ? i % D.n : i;
        const l = L.at.get(li);
        if (l && l.f) { osc(s.duty, l.f, 0, l.len * dt * 0.92, 0.05, rel, bus); osc(s.duty, l.f * 1.003, 0, l.len * dt * 0.6, 0.015, rel + 0.012, bus); }
        const b = B.at.get(bi);
        if (b && b.f) osc('triangle', b.f, 0, Math.max(dt * 0.9, b.len * dt * 0.95), 0.16, rel, bus);
        const d = D.at.get(di);
        if (d) {
            const k = d.tok;
            if (k === 'k' || k === 'x') osc('sine', 150, 40, 0.12, 0.3, rel, bus);
            if (k === 's') { noise(0.11, 0.16, 1800, rel, 'bandpass', bus); osc('triangle', 220, 120, 0.06, 0.08, rel, bus); }
            if (k === 'h' || k === 'x') noise(0.03, 0.06, 7000, rel, 'highpass', bus);
        }
    };
    const tick = () => {
        if (!song || !ac) return;
        const dt = 60 / song.bpm / 2;
        const len = Math.max(song.ch.lead.n, song.ch.bass.n, song.ch.drum.n);
        while (nextT < ac.currentTime + 0.2) {
            if (!song.loop && step >= len) { const done = song.onEnd; song = null; done && done(); return; }
            playStep(song, step, nextT);
            step++;
            nextT += dt;
        }
    };
    A.music = (name, onEnd) => {
        if (name === songName && song && song.loop) return;
        A.stopMusic();
        songName = name;
        if (!name || !SONGS[name] || !A.musicOn) return;
        const c = ctx(); if (!c) return;
        song = Object.assign({}, SONGS[name], { onEnd });
        bus = c.createGain(); bus.gain.value = 1; bus.connect(musBus);
        step = 0; nextT = c.currentTime + 0.06;
        timer = setInterval(tick, 40);
        tick();
    };
    A.stopMusic = (fade = 0.08) => {
        clearInterval(timer); timer = null; song = null;
        if (bus && ac) { const b = bus; b.gain.setTargetAtTime(0, ac.currentTime, fade); setTimeout(() => b.disconnect(), 800); }
        bus = null;
    };
    A.current = () => songName;
    A.setMusic = (on) => { A.musicOn = on; if (!on) { const n = songName; A.stopMusic(); songName = n; } else if (songName) { const n = songName; songName = ''; A.music(n); } };
    A.duck = (on) => { if (musBus && ac) musBus.gain.setTargetAtTime(on ? 0.12 : 0.55, ac.currentTime, 0.1); };
})();

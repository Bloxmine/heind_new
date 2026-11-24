/* Every sound is synthesised with WebAudio: no files, just oscillators and noise. Off until you switch it on. */
(() => {
    const S = window.SEA;
    // Sound is on by default (unless the visitor switched it off before). Browsers only allow audio
    // after a click or key press, so it actually starts on the first interaction.
    const PREF = 'heind.sound';
    const pref = (() => { try { return localStorage.getItem(PREF); } catch (e) { return null; } })();
    const A = S.audio = { on: pref !== '0', midiOn: false };
    let ac = null, master = null, noiseBuf = null, unlocked = false;
    let amb = null, midiTimer = null, pingTimer = null;

    const ctx = () => {
        if (!ac) {
            ac = new (window.AudioContext || window.webkitAudioContext)();
            master = ac.createGain();
            master.gain.value = 0.55;
            master.connect(ac.destination);
            noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume();
        return ac;
    };

    const tone = (type, f0, f1, dur, vol = 0.2, delay = 0, dest) => {
        const c = ctx();
        const o = c.createOscillator(), g = c.createGain();
        const t0 = c.currentTime + delay;
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(dest || master);
        o.start(t0); o.stop(t0 + dur + 0.05);
    };

    const noise = (dur, vol, freq, delay = 0, type = 'lowpass') => {
        const c = ctx();
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        const t0 = c.currentTime + delay;
        s.buffer = noiseBuf;
        f.type = type; f.frequency.value = freq;
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(master);
        s.start(t0); s.stop(t0 + dur + 0.05);
    };

    const SFX = {
        blip: () => tone('square', 880, 0, 0.06, 0.06),
        click: () => tone('square', 1300, 0, 0.025, 0.04),
        bloop: () => tone('sine', 260, 900, 0.16, 0.25),
        pop: () => tone('sine', 600, 1500, 0.08, 0.2),
        horn: () => { tone('sawtooth', 98, 0, 1.0, 0.1); tone('sawtooth', 123.5, 0, 1.0, 0.07); tone('square', 49, 0, 1.0, 0.04); },
        quack: () => { tone('sawtooth', 560, 360, 0.13, 0.14); tone('square', 540, 330, 0.13, 0.05); tone('sawtooth', 560, 360, 0.13, 0.12, 0.17); },
        zap: () => { tone('square', 1800, 90, 0.25, 0.1); noise(0.15, 0.15, 3000, 0, 'highpass'); },
        switch: () => { tone('square', 300, 0, 0.03, 0.1); tone('square', 600, 0, 0.03, 0.08, 0.05); },
        clank: () => { tone('triangle', 210, 170, 0.35, 0.22); tone('square', 1210, 900, 0.08, 0.04); },
        chomp: () => { noise(0.1, 0.4, 700); noise(0.1, 0.4, 500, 0.12); },
        sonar: () => { tone('sine', 1180, 0, 1.5, 0.16); tone('sine', 1180, 0, 1.2, 0.05, 0.6); },
        whale: () => { tone('sine', 180, 420, 1.4, 0.18); tone('sine', 420, 230, 1.6, 0.14, 1.3); tone('sine', 300, 520, 1.2, 0.1, 2.8); },
        rumble: () => { noise(2.0, 0.7, 110); tone('sine', 45, 30, 2.0, 0.3); },
        pew: () => tone('square', 950, 110, 0.2, 0.08),
        boom: () => { noise(0.45, 0.5, 500); tone('sine', 140, 40, 0.35, 0.3); },
        error: () => { tone('square', 523, 0, 0.11, 0.08); tone('square', 392, 0, 0.22, 0.08, 0.12); },
        chord: () => [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone('triangle', f, 0, 1.1 - i * 0.15, 0.09, i * 0.09)),
        beep: (d = 0.12) => tone('sine', 740, 0, d, 0.18),
        type: () => tone('square', 1800 + Math.random() * 400, 0, 0.012, 0.015),
        vroom: () => { tone('sawtooth', 70, 230, 0.55, 0.11); tone('square', 35, 115, 0.55, 0.05); tone('sawtooth', 230, 160, 0.45, 0.09, 0.55); noise(0.25, 0.12, 900, 0.5); },
        kaching: () => { noise(0.06, 0.25, 4000, 0, 'highpass'); tone('square', 1568, 0, 0.09, 0.07, 0.05); tone('square', 2093, 0, 0.6, 0.07, 0.14); },
        flip: (n = 1) => { noise(0.025, Math.min(0.35, 0.04 + n * 0.006), 3500, 0, 'highpass'); if (n > 20) noise(0.03, 0.12, 2500, 0.02, 'highpass'); }
    };

    S.sfx = (name, arg) => {
        if (!A.on || !unlocked || !SFX[name]) return;
        try { SFX[name](arg); } catch (e) { /* audio is optional */ }
    };

    /* ---------- ambience: waves at the surface, a muffled rumble below ---------- */
    const startAmbient = () => {
        const c = ctx();
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        const lfo = c.createOscillator(), lg = c.createGain();
        s.buffer = noiseBuf; s.loop = true;
        f.type = 'lowpass'; f.frequency.value = 800; f.Q.value = 0.7;
        g.gain.value = 0.05;
        lfo.frequency.value = 0.12; lg.gain.value = 0.035;
        lfo.connect(lg); lg.connect(g.gain);
        s.connect(f); f.connect(g); g.connect(master);
        s.start(); lfo.start();
        amb = { s, f, g, lfo, lg };
        A.setDepth(A._m || 0);
        pingTimer = setInterval(() => {
            const m = A._m || 0;
            if (m > 900 && Math.random() < 0.5) SFX.sonar();
            else if (m <= 0 && Math.random() < 0.3) { tone('sine', 1900, 1500, 0.12, 0.03); tone('sine', 1900, 1400, 0.12, 0.03, 0.18); }
        }, 7000);
    };
    const stopAmbient = () => {
        if (!amb) return;
        try { amb.s.stop(); amb.lfo.stop(); } catch (e) { /* already stopped */ }
        amb = null;
        clearInterval(pingTimer);
    };
    A.setDepth = (m) => {
        A._m = m;
        if (!amb) return;
        const t = ac.currentTime;
        const cut = m <= 0 ? 900 : Math.max(90, 520 - Math.log10(1 + m) * 105);
        amb.f.frequency.setTargetAtTime(cut, t, 0.4);
        amb.lg.gain.setTargetAtTime(m <= 5 ? 0.035 : 0.008, t, 0.4);
        amb.g.gain.setTargetAtTime(m <= 5 ? 0.05 : 0.07, t, 0.4);
    };

    A.toggle = (force) => {
        A.on = force == null ? !A.on : force;
        try { localStorage.setItem(PREF, A.on ? '1' : '0'); } catch (e) { /* private mode */ }
        if (A.on) { unlocked = true; ctx(); if (!amb) startAmbient(); SFX.chord(); }
        else { stopAmbient(); A.toggleMidi(false); }
        return A.on;
    };

    const GESTURES = ['pointerdown', 'keydown', 'touchend'];
    const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        GESTURES.forEach((ev) => window.removeEventListener(ev, unlock, true));
        if (A.on) { try { ctx(); startAmbient(); } catch (e) { /* no audio */ } }
    };
    GESTURES.forEach((ev) => window.addEventListener(ev, unlock, true));

    /* ---------- the MIDI: "Drunken Sailor" (traditional), on a square wave and a triangle bass ---------- */
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const VERSE = [
        69, 2, 69, 1, 69, 1, 69, 2, 69, 1, 69, 1, 69, 2, 62, 2, 65, 2, 69, 2,
        67, 2, 67, 1, 67, 1, 67, 2, 67, 1, 67, 1, 67, 2, 60, 2, 64, 2, 67, 2,
        69, 2, 69, 1, 69, 1, 69, 2, 69, 1, 69, 1, 69, 2, 71, 2, 72, 2, 74, 2,
        72, 2, 69, 2, 67, 2, 64, 2, 62, 4, 62, 4
    ];
    const CHORUS = [
        69, 4, 69, 4, 69, 2, 62, 2, 65, 2, 69, 2,
        67, 4, 67, 4, 67, 2, 60, 2, 64, 2, 67, 2,
        69, 4, 69, 4, 69, 2, 71, 2, 72, 2, 74, 2,
        72, 2, 69, 2, 67, 2, 64, 2, 62, 4, 62, 4
    ];
    const SONG = [...VERSE, ...CHORUS];
    const BASS_ROOTS = [50, 48, 50, 48, 50, 48, 50, 48]; // one per 16 sixteenths: D C D (C→D)
    const SIX = 0.105;

    let songPos = 0, nextTime = 0, step16 = 0, out = null;
    const schedule = () => {
        const c = ctx();
        while (nextTime < c.currentTime + 0.15) {
            const n = SONG[songPos], d = SONG[songPos + 1];
            tone('square', N(n + 12), 0, d * SIX * 0.9, 0.035, nextTime - c.currentTime, out);
            for (let k = 0; k < d; k++) {
                const s = step16 + k;
                if (s % 2 === 0) {
                    const line = Math.floor(s / 16) % 8;
                    let root = BASS_ROOTS[line];
                    if (line % 4 === 3 && (s % 16) >= 8) root = 50;
                    const note = (s % 4 === 0) ? root : root + 7;
                    tone('triangle', N(note), 0, SIX * 1.8, 0.11, nextTime - c.currentTime + k * SIX, out);
                    if (s % 4 === 2) noise(0.03, 0.05, 6000, nextTime - c.currentTime + k * SIX, 'highpass');
                }
            }
            step16 += d;
            nextTime += d * SIX;
            songPos = (songPos + 2) % SONG.length;
        }
    };
    A.toggleMidi = (force) => {
        const want = force == null ? !A.midiOn : force;
        if (want && !A.on) A.toggle(true);
        A.midiOn = want;
        clearInterval(midiTimer);
        if (want) {
            const c = ctx();
            out = c.createGain(); out.gain.value = 1; out.connect(master);
            songPos = 0; step16 = 0; nextTime = c.currentTime + 0.1;
            midiTimer = setInterval(schedule, 40);
        } else if (out) {
            out.gain.setTargetAtTime(0, ac.currentTime, 0.05);
            out = null;
        }
        return A.midiOn;
    };
})();

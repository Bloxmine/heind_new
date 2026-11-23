/* Rally pace notes for the time trial: read the track's shape into calls like "medium right",
   "hairpin left into jump" and "crest", show them as arrows at the top of the screen,
   and (optionally) have a co-driver read them out. */
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function paceNotes(track) {
    const { S, N, def } = track, seg = track.seg || 2;
    const H = S.map((s) => Math.atan2(s.tx, s.tz));
    let k = Array.from({ length: N }, (_, i) => angDiff(H[(i + 2) % N], H[(i - 2 + N) % N]) / (4 * seg));
    for (let pass = 0; pass < 2; pass++) k = k.map((_, i) => { let s = 0; for (let j = -3; j <= 3; j++) s += k[(i + j + N) % N]; return s / 7; });
    const notes = [], TH = 1 / 140;
    // start scanning on a straight so no corner gets cut in two
    let start = 0; while (start < N - 1 && Math.abs(k[start]) > TH) start++;
    for (let n = 0; n < N;) {
        const j = (start + n) % N;
        if (Math.abs(k[j]) <= TH) { n++; continue; }
        const sg = Math.sign(k[j]);
        let m = n, maxk = 0, tot = 0;
        while (m < N) {
            const kk = k[(start + m) % N];
            if (Math.abs(kk) < TH * 0.7 || Math.sign(kk) !== sg) break;
            maxk = Math.max(maxk, Math.abs(kk)); tot += Math.abs(kk) * seg; m++;
        }
        if (tot > 0.32) {
            const r = 1 / maxk, len = (m - n) * seg;
            const sev = tot > 2.3 && r < 22 ? 'hairpin' : r < 26 ? 'tight' : r < 46 ? 'medium' : r < 85 ? 'fast' : 'easy';
            // steering right turns the heading down, so a falling heading is a right-hander
            notes.push({ i: j, kind: 'turn', dir: sg < 0 ? 'right' : 'left', sev, long: len > 70 && tot > 1.5, ang: tot });
        }
        n = m + 1;
    }
    for (const jp of def.jumps || []) notes.push({ i: Math.round(jp.at * N) % N, kind: 'jump' });
    // crests: the road falls away after a rise
    const far = (i, list) => list.every((o) => Math.min(Math.abs(o.i - i), N - Math.abs(o.i - i)) > 25);
    for (let i = 0; i < N; i++) {
        const c = (S[(i + 8) % N].y - 2 * S[i].y + S[(i - 8 + N) % N].y) / (16 * seg) ** 2 * 100;
        const c1 = (S[(i + 9) % N].y - 2 * S[(i + 1) % N].y + S[(i - 7 + N) % N].y) / (16 * seg) ** 2 * 100;
        const c0 = (S[(i + 7) % N].y - 2 * S[(i - 1 + N) % N].y + S[(i - 9 + N) % N].y) / (16 * seg) ** 2 * 100;
        if (c < -1.1 && c <= c0 && c <= c1 && far(i, notes.filter((o) => o.kind !== 'turn'))) notes.push({ i, kind: 'crest' });
    }
    notes.sort((a, b) => a.i - b.i);
    notes.forEach((o, n) => {
        const nx = notes[(n + 1) % notes.length];
        o.into = nx && nx !== o && (((nx.i - o.i + N) % N) * seg) < 45;
        o.text = o.kind === 'jump' ? 'JUMP' : o.kind === 'crest' ? 'CREST' : `${o.long ? 'LONG ' : ''}${o.sev.toUpperCase()} ${o.dir.toUpperCase()}`;
        o.say = o.kind === 'turn' ? `${o.long ? 'long ' : ''}${o.sev} ${o.dir}` : o.kind;
        o.id = n;
    });
    return notes;
}

// the arrow for a note: ink outline, yellow fill, bent as far as the corner turns
const icons = {};
export function noteIcon(o) {
    const key = o.kind === 'turn' ? `${o.dir}-${o.sev}` : o.kind;
    if (icons[key]) return icons[key];
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round';
    const drawPath = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); };
    const head = (px, py, h, s, col) => {
        x.fillStyle = col; x.beginPath();
        x.moveTo(px + Math.cos(h) * s, py + Math.sin(h) * s);
        x.lineTo(px + Math.cos(h + 2.4) * s, py + Math.sin(h + 2.4) * s);
        x.lineTo(px + Math.cos(h - 2.4) * s, py + Math.sin(h - 2.4) * s);
        x.fill();
    };
    if (o.kind === 'turn') {
        const ang = { easy: 0.4, fast: 0.75, medium: 1.2, tight: 1.6, hairpin: 2.9 }[o.sev], sg = o.dir === 'right' ? 1 : -1;
        let px = 16 - sg * (o.sev === 'hairpin' ? 6 : 3), py = 29, h = -Math.PI / 2;
        const pts = [[px, py]];
        for (let s = 0; s < 9; s++) { px += Math.cos(h); py += Math.sin(h); pts.push([px, py]); }
        const L = o.sev === 'hairpin' ? 20 : 15;
        for (let s = 0; s < L; s++) { h += sg * ang / L; px += Math.cos(h); py += Math.sin(h); pts.push([px, py]); }
        drawPath(pts, 7, '#0d0d12'); head(px, py, h, 8.5, '#0d0d12');
        drawPath(pts, 3.5, '#ffd23f'); head(px, py, h, 5.5, '#ffd23f');
    } else if (o.kind === 'jump') {
        x.fillStyle = '#0d0d12'; x.beginPath(); x.moveTo(2, 28); x.lineTo(14, 28); x.lineTo(14, 18); x.fill();
        x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(5, 27); x.lineTo(13, 27); x.lineTo(13, 21); x.fill();
        const arc = []; for (let t = 0; t <= 1; t += 0.1) arc.push([12 + t * 16, 17 - Math.sin(t * Math.PI) * 12 + t * 6]);
        drawPath(arc, 6, '#0d0d12'); drawPath(arc, 2.5, '#ffd23f');
        head(28, 23, 1.1, 6, '#0d0d12'); head(28, 23, 1.1, 3.5, '#ffd23f');
    } else {
        const hump = []; for (let t = 0; t <= 1; t += 0.08) hump.push([3 + t * 26, 27 - Math.sin(t * Math.PI) * 13]);
        drawPath(hump, 7, '#0d0d12'); drawPath(hump, 3.5, '#ffd23f');
        x.fillStyle = '#0d0d12'; x.fillRect(14, 4, 4, 5); x.fillRect(14, 10, 4, 2);
    }
    return (icons[key] = c.toDataURL());
}

// the co-driver: reads each call a little before you get there
export class CoDriver {
    constructor() { this.voice = null; }
    pickVoice() {
        if (this.voice || !window.speechSynthesis) return;
        const vs = speechSynthesis.getVoices();
        this.voice = vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
    }
    say(text) {
        if (!window.speechSynthesis) return;
        this.pickVoice();
        if (speechSynthesis.pending) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (this.voice) u.voice = this.voice;
        u.rate = 1.3; u.pitch = 0.9; u.volume = 0.9;
        speechSynthesis.speak(u);
    }
    stop() { if (window.speechSynthesis) speechSynthesis.cancel(); }
}

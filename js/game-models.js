/* Subshootica DX: the low-poly cast. Every model faces +x unless it says otherwise, and is roughly 1 unit = half a body length. */
(() => {
    const S = window.SEA;
    const { lathe, box, tri3, beam } = S.geo;
    const Mesh = S.Mesh;
    const C = (h) => S.hexToRgb(h);
    const G = S.gm = {};
    const TAU = Math.PI * 2;

    const move = (m, dx, dy, dz) => { m.v.forEach((p) => { p[0] += dx; p[1] += dy; p[2] += dz; }); return m; };
    const scale = (m, sx, sy = sx, sz = sx) => { m.v.forEach((p) => { p[0] *= sx; p[1] *= sy; p[2] *= sz; }); return m; };
    const rotZ = (m, a) => { const c = Math.cos(a), s = Math.sin(a); m.v.forEach((p) => { const x = p[0], y = p[1]; p[0] = x * c - y * s; p[1] = x * s + y * c; }); return m; };
    const rotX = (m, a) => { const c = Math.cos(a), s = Math.sin(a); m.v.forEach((p) => { const y = p[1], z = p[2]; p[1] = y * c - z * s; p[2] = y * s + z * c; }); return m; };
    const ball = (r, seg, rings, col, sy = 1, sz = 1) => {
        const prof = [];
        for (let i = 0; i <= rings; i++) { const a = (i / rings) * Math.PI; prof.push([Math.cos(a) * r, Math.sin(a) * r]); }
        return lathe(prof, seg, col, sy, sz, 0.3);
    };
    // A dome that points up (+y): lathe along x, then stood up.
    const dome = (prof, seg, col) => rotZ(lathe(prof, seg, col, 1, 1, 0.25), Math.PI / 2);
    const octa = (r, col, col2) => {
        const m = new Mesh();
        const v = [[r, 0, 0], [-r, 0, 0], [0, r * 1.3, 0], [0, -r * 1.3, 0], [0, 0, r], [0, 0, -r]].map((p) => m.vert(...p));
        const f = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
        f.forEach(([a, b, c], i) => m.tri(v[a], v[b], v[c], i % 2 ? col : col2));
        return m;
    };
    G.util = { move, scale, rotZ, rotX, ball, dome, octa };

    /* ---------- the player: the AUGURK (Dutch for gherkin) ---------- */
    const subMesh = (hull, top, dark, glass) => {
        const m = lathe([[1.3, 0], [1.2, 0.22], [0.95, 0.36], [0.5, 0.42], [-0.5, 0.42], [-0.95, 0.32], [-1.25, 0.16], [-1.4, 0.06]], 8, C(hull), 1, 1, 0.2);
        m.paint((x, y) => (y > 0.2 ? C(top) : y < -0.28 ? C(dark) : null));
        m.merge(move(ball(0.17, 6, 3, C('#9fd8f5')), 1.1, 0.08, 0));
        m.merge(box(0.62, 0.36, 0.28, C(top), 0.05, 0.56, 0));
        m.merge(box(0.68, 0.06, 0.32, C(dark), 0.05, 0.76, 0));
        m.merge(box(0.3, 0.12, 0.29, C(glass), 0.2, 0.6, 0));
        m.merge(beam([0.25, 0.76, 0], [0.25, 1.08, 0], 0.035, C(dark)));
        m.merge(beam([0.25, 1.06, 0], [0.47, 1.06, 0], 0.035, C(dark)));
        for (const px of [0.6, 0.15, -0.3]) {
            m.merge(box(0.17, 0.17, 0.02, C(glass), px, 0.04, 0.43));
            m.merge(box(0.17, 0.17, 0.02, C(glass), px, 0.04, -0.43));
        }
        m.merge(tri3([0.6, -0.05, 0.38], [0.25, -0.05, 0.8], [0.12, -0.05, 0.38], C(dark)));
        m.merge(tri3([0.6, -0.05, -0.38], [0.25, -0.05, -0.8], [0.12, -0.05, -0.38], C(dark)));
        m.merge(tri3([-1.0, 0.24, 0], [-1.36, 0.66, 0], [-1.4, 0.1, 0], C(dark)));
        m.merge(tri3([-1.0, -0.24, 0], [-1.36, -0.58, 0], [-1.4, -0.1, 0], C(dark)));
        m.merge(tri3([-1.0, 0, 0.24], [-1.36, 0, 0.62], [-1.4, 0, 0.1], C(dark)));
        m.merge(tri3([-1.0, 0, -0.24], [-1.36, 0, -0.62], [-1.4, 0, -0.1], C(dark)));
        m.propStart = m.v.length;
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU;
            m.merge(tri3([-1.46, 0, 0], [-1.46, Math.cos(a) * 0.36, Math.sin(a) * 0.36], [-1.46, Math.cos(a + 0.8) * 0.3, Math.sin(a + 0.8) * 0.3], C('#d9bd84')));
        }
        return m;
    };
    G.sub = () => subMesh('#3f9446', '#9bdc5a', '#1e5234', '#ffd23f');
    G.clansub = () => subMesh('#b52a2a', '#e8562a', '#3d2a1e', '#fff1a6');

    /* ---------- the Takoyaki Clan ---------- */
    G.squid = (body = '#ff4fd8', dark = '#6e1a2c') => {
        const b = C(body), d = C(dark), w = C('#ffffff'), k = C('#04070f');
        const m = lathe([[1.25, 0], [1.0, 0.22], [0.4, 0.38], [-0.3, 0.36], [-0.5, 0.26]], 6, b, 1, 0.9, 0.3);
        m.paint((x, y) => (y > 0.25 && x > 0 ? d : null));
        m.merge(tri3([1.15, 0.04, 0], [0.5, 0.62, 0], [0.35, 0.14, 0], d));
        m.merge(tri3([1.15, -0.04, 0], [0.5, -0.62, 0], [0.35, -0.14, 0], d));
        for (const z of [0.31, -0.31]) {
            m.merge(box(0.22, 0.2, 0.04, w, -0.22, 0.08, z));
            m.merge(box(0.1, 0.12, 0.03, k, -0.27, 0.06, z * 1.1));
        }
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + 0.3;
            m.merge(beam([-0.45, Math.cos(a) * 0.2, Math.sin(a) * 0.2], [-1.35, Math.cos(a) * 0.42, Math.sin(a) * 0.42], 0.06, b));
        }
        return m;
    };

    G.takoball = (r = 1) => {
        const m = ball(r, 8, 6, C('#c98a64'));
        const sauce = C('#3d2a1e'), mayo = C('#fff1a6'), nori = C('#3f9446');
        m.paint((x, y, z) => {
            if (y > 0.4 * r) {
                if (Math.abs(Math.sin(x * 5 / r + z * 4 / r)) < 0.3) return mayo;
                if (((x * 13 + z * 7) | 0) % 5 === 0) return nori;
                return sauce;
            }
            return y < -0.6 * r ? C('#7a4b2e') : null;
        });
        const fl = C('#f2c6a0');
        m.merge(tri3([0.1 * r, 0.95 * r, 0], [0.4 * r, 1.35 * r, 0.1], [0.35 * r, 0.9 * r, 0.2], fl));
        m.merge(tri3([-0.3 * r, 0.9 * r, -0.2], [-0.5 * r, 1.3 * r, -0.1], [-0.1 * r, 0.98 * r, 0], fl));
        return m;
    };

    G.tako = () => {
        const red = C('#e8562a'), dk = C('#b52a2a');
        const m = dome([[1.15, 0], [1.05, 0.45], [0.75, 0.78], [0.25, 0.9], [-0.15, 0.78], [-0.3, 0.5]], 8, red);
        m.paint((x, y) => (y > 0.85 ? dk : null));
        // the clan's headband (hachimaki) with its red sun
        m.merge(rotZ(lathe([[0.42, 0.86], [0.24, 0.92]], 8, C('#ffffff'), 1, 1, 0.25), Math.PI / 2));
        m.merge(box(0.08, 0.2, 0.2, C('#b52a2a'), 0.95, 0.34, 0));
        m.merge(tri3([-0.85, 0.36, 0], [-1.35, 0.6, 0.15], [-1.25, 0.2, -0.1], C('#ffffff')));
        for (const z of [0.3, -0.3]) {
            m.merge(box(0.08, 0.26, 0.2, C('#ffffff'), 0.82, 0.02, z));
            m.merge(box(0.06, 0.13, 0.1, C('#04070f'), 0.87, -0.02, z));
        }
        m.merge(lathe([[1.05, 0], [0.9, 0.14], [0.75, 0.14]], 6, dk, 1, 1, 0));
        m.legStart = m.v.length;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            const sx = Math.cos(a) * 0.5, sz = Math.sin(a) * 0.5;
            m.merge(beam([sx, -0.25, sz], [Math.cos(a) * 0.85, -0.95, Math.sin(a) * 0.85], 0.1, red));
            m.merge(beam([Math.cos(a) * 0.85, -0.95, Math.sin(a) * 0.85], [Math.cos(a) * 1.15, -1.15, Math.sin(a) * 1.15], 0.07, dk));
        }
        return m;
    };

    G.jelly = () => {
        const m = dome([[0.8, 0], [0.72, 0.45], [0.45, 0.85], [0.0, 1.0], [-0.2, 0.95]], 8, C('#6fdde0'));
        m.paint((x, y) => (y > 0.55 ? C('#b5f1e8') : null));
        m.merge(dome([[0.35, 0], [0.25, 0.3], [-0.05, 0.42]], 6, C('#ff4fd8')));
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU;
            m.merge(beam([Math.cos(a) * 0.7, -0.2, Math.sin(a) * 0.7], [Math.cos(a) * 0.55, -1.7 - (i % 3) * 0.25, Math.sin(a) * 0.55], 0.035, C(i % 2 ? '#ff4fd8' : '#b5f1e8')));
        }
        return m;
    };

    G.mine = () => {
        const m = ball(0.75, 8, 6, C('#2e2e3e'));
        m.paint((x, y) => (y > 0.35 ? C('#6b6b80') : null));
        const dirs = [];
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; dirs.push([Math.cos(a), Math.sin(a), 0]); }
        dirs.push([0, 0, 1], [0, 0, -1], [0.5, 0.5, 0.7], [-0.5, -0.5, -0.7]);
        for (const [dx, dy, dz] of dirs) {
            m.merge(beam([dx * 0.6, dy * 0.6, dz * 0.6], [dx * 1.15, dy * 1.15, dz * 1.15], 0.06, C('#b4b4c4')));
            m.merge(box(0.16, 0.16, 0.16, C('#e8562a'), dx * 1.18, dy * 1.18, dz * 1.18));
        }
        m.merge(box(0.6, 0.06, 0.06, C('#ffd23f'), 0, 0, -0.76));
        return m;
    };

    G.eelHead = () => {
        const m = lathe([[1.2, 0], [0.9, 0.3], [0.2, 0.45], [-0.6, 0.42]], 6, C('#1b8a99'), 1, 0.8, 0.3);
        m.paint((x, y) => (y < -0.15 ? C('#b5f1e8') : y > 0.3 ? C('#0e5f6e') : null));
        for (const z of [0.3, -0.3]) m.merge(box(0.18, 0.16, 0.06, C('#fff1a6'), 0.55, 0.15, z));
        m.merge(tri3([0.0, 0.42, 0], [-0.6, 0.75, 0], [-0.6, 0.4, 0], C('#ff9a1f')));
        for (let i = 0; i < 4; i++) m.merge(tri3([1.0 - i * 0.18, -0.1, 0.12], [0.94 - i * 0.18, -0.1, 0.12], [0.97 - i * 0.18, -0.28, 0.12], C('#ffffff')));
        return m;
    };
    G.eelSeg = () => {
        const m = ball(0.45, 6, 4, C('#1b8a99'), 1, 0.8);
        m.paint((x, y) => (y < -0.12 ? C('#b5f1e8') : y > 0.25 ? C('#0e5f6e') : null));
        m.merge(tri3([0.3, 0.38, 0], [-0.3, 0.7, 0], [-0.35, 0.36, 0], C('#ff9a1f')));
        return m;
    };

    G.crate = () => {
        const m = box(1.5, 0.95, 1.1, C('#dff4ff'));
        m.merge(box(1.6, 0.22, 1.2, C('#e8562a'), 0, 0.55, 0));
        m.merge(box(0.28, 1.0, 1.14, C('#e8562a'), 0, 0, 0));
        m.merge(box(0.5, 0.3, 0.02, C('#3d2a1e'), 0.45, 0.05, -0.57));
        m.merge(beam([-0.35, 0.65, 0], [0.35, 0.65, 0], 0.05, C('#7a4b2e')));
        return m;
    };

    G.capsule = (col, col2) => {
        const m = octa(0.9, C(col), C(col2));
        m.merge(lathe([[0.15, 1.02], [-0.15, 1.02]], 8, C('#ffffff')));
        return m;
    };

    G.pearl = () => {
        const m = ball(1, 10, 7, C('#ffffff'));
        m.paint((x, y) => (y < -0.3 ? C('#b4b4c4') : y < 0.3 ? C('#dff4ff') : null));
        return m;
    };

    G.fish = (a, b, c) => S.models.fish(a, b, c);
    G.ship = () => S.models.ship(false);

    G.bub = () => {
        const m = ball(0.8, 8, 6, C('#ffd23f'));
        m.paint((x, y) => (y < -0.3 ? C('#fff1a6') : null));
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            m.merge(tri3([Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.1], [Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0], [Math.cos(a + 0.3) * 0.7, Math.sin(a + 0.3) * 0.7, -0.1], C('#7a4b2e')));
        }
        m.merge(tri3([-0.7, 0, 0], [-1.25, 0.45, 0], [-1.25, -0.45, 0], C('#ff9a1f')));
        for (const z of [0.6, -0.6]) {
            m.merge(box(0.3, 0.3, 0.05, C('#ffffff'), 0.35, 0.25, z));
            m.merge(box(0.14, 0.16, 0.04, C('#04070f'), 0.42, 0.25, z * 1.06));
        }
        return m;
    };

    /* ---------- bosses (these face -x, toward the player) ---------- */
    G.griddle = () => {
        const iron = C('#2e2e3e'), edge = C('#6b6b80');
        const m = box(3.4, 0.55, 1.7, iron);
        m.merge(box(3.5, 0.12, 1.8, edge, 0, 0.3, 0));
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
            m.merge(move(G.takoball(0.34), -1.15 + i * 0.77, 0.52, -0.42 + j * 0.84));
        }
        m.merge(beam([1.7, 0.05, 0], [3.2, 0.25, 0], 0.09, edge));
        m.merge(box(0.9, 0.3, 0.3, C('#7a4b2e'), 3.5, 0.3, 0));
        // its angry face on the front
        for (const x of [-1.0, -0.2]) {
            m.merge(box(0.42, 0.26, 0.04, C('#ffffff'), x, 0.02, -0.87));
            m.merge(box(0.16, 0.16, 0.03, C('#04070f'), x - 0.08, -0.02, -0.9));
        }
        m.merge(tri3([-1.25, 0.24, -0.92], [-0.75, 0.12, -0.92], [-0.75, 0.24, -0.92], C('#04070f')));
        m.merge(tri3([0.05, 0.24, -0.92], [-0.45, 0.12, -0.92], [-0.45, 0.24, -0.92], C('#04070f')));
        m.flameStart = m.v.length;
        for (let i = 0; i < 5; i++) {
            const x = -1.3 + i * 0.65;
            m.merge(tri3([x - 0.25, -0.3, 0], [x + 0.25, -0.3, 0], [x, -0.95, 0], C(i % 2 ? '#ffd23f' : '#ff9a1f')));
            m.merge(tri3([x - 0.12, -0.3, -0.1], [x + 0.12, -0.3, -0.1], [x, -0.65, -0.1], C('#fff1a6')));
        }
        return m;
    };

    G.ika = () => {
        const pk = C('#ff4fd8'), pu = C('#8a3cff'), w = C('#ffffff');
        const m = lathe([[3.0, 0], [2.6, 0.42], [1.6, 0.82], [0.2, 0.9], [-0.6, 0.75], [-0.95, 0.5]], 9, pk, 1, 0.9, 0.2);
        m.paint((x, y) => (y > 0.45 ? pu : null));
        m.merge(tri3([3.0, 0.05, 0], [1.9, 1.5, 0], [1.6, 0.5, 0], pu));
        m.merge(tri3([3.0, -0.05, 0], [1.9, -1.5, 0], [1.6, -0.5, 0], pu));
        m.merge(box(0.5, 0.48, 0.05, w, -0.35, 0.15, -0.82));
        m.merge(box(0.28, 0.3, 0.04, C('#ffd23f'), -0.42, 0.12, -0.86));
        m.merge(box(0.12, 0.2, 0.03, C('#04070f'), -0.45, 0.12, -0.89));
        m.merge(tri3([-0.65, 0.48, -0.86], [-0.05, 0.36, -0.86], [-0.15, 0.52, -0.86], C('#04070f')));
        // a lady wears a bow
        m.merge(tri3([0.9, 0.95, 0], [0.4, 1.4, 0.25], [0.4, 1.4, -0.25], C('#ffd23f')));
        m.merge(tri3([0.9, 0.95, 0], [1.4, 1.4, 0.25], [1.4, 1.4, -0.25], C('#ffd23f')));
        m.armStart = m.v.length;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.2;
            const y0 = Math.cos(a) * 0.45, z0 = Math.sin(a) * 0.45;
            m.merge(beam([-0.9, y0, z0], [-2.0, y0 * 1.5, z0 * 1.5], 0.14, pk));
            m.merge(beam([-2.0, y0 * 1.5, z0 * 1.5], [-2.8, y0 * 1.9, z0 * 1.9], 0.09, pu));
        }
        for (const s of [1, -1]) {
            m.merge(beam([-0.9, 0.1 * s, 0], [-3.4, 0.5 * s, 0], 0.06, pk));
            m.merge(box(0.45, 0.24, 0.24, pu, -3.6, 0.55 * s, 0));
        }
        return m;
    };

    G.lure = () => {
        const metal = C('#6b6b80'), plate = C('#b4b4c4'), rust = C('#7a4b2e'), dk = C('#2e2e3e');
        const m = lathe([[-1.7, 0], [-1.6, 0.75], [-0.9, 1.25], [0.4, 1.15], [1.3, 0.65], [1.9, 0.2]], 9, metal, 1, 0.85, 0.2);
        m.paint((x, y, z) => (y > 0.6 ? plate : (((x * 7 + z * 11) | 0) % 6 === 0 ? rust : null)));
        m.merge(tri3([1.8, 0, 0], [2.8, 1.0, 0], [2.8, -1.0, 0], dk));
        m.merge(tri3([0.2, 1.1, 0], [0.9, 1.7, 0], [1.2, 0.85, 0], dk));
        m.merge(box(0.5, 0.36, 0.05, C('#e8562a'), -0.85, 0.42, -1.0));
        m.merge(box(0.22, 0.2, 0.04, C('#fff1a6'), -0.9, 0.42, -1.04));
        for (let i = 0; i < 6; i++) m.merge(box(0.1, 0.1, 0.04, plate, -0.5 + i * 0.35, 0.85 - Math.abs(i - 2) * 0.05, -0.82));
        for (let i = 0; i < 6; i++) m.merge(tri3([-1.6 + i * 0.16, -0.05, -0.7 + i * 0.25], [-1.5 + i * 0.16, -0.05, -0.6 + i * 0.25], [-1.55 + i * 0.16, 0.3, -0.65 + i * 0.25], C('#ffffff')));
        m.jawStart = m.v.length;
        const jaw = lathe([[-1.75, 0], [-1.6, 0.55], [-0.6, 0.85], [0.2, 0.5]], 8, dk, 0.5, 1, 0.2);
        move(jaw, 0, -0.35, 0);
        jaw.v.forEach((p) => { if (p[1] > -0.35) p[1] = -0.35; });
        m.merge(jaw);
        for (let i = 0; i < 6; i++) m.merge(tri3([-1.55 + i * 0.16, -0.36, -0.6 + i * 0.22], [-1.45 + i * 0.16, -0.36, -0.5 + i * 0.22], [-1.5 + i * 0.16, -0.7, -0.55 + i * 0.22], C('#ffffff')));
        m.jawEnd = m.v.length;
        m.merge(beam([-0.3, 1.15, 0], [-1.1, 2.1, 0], 0.06, dk));
        m.merge(beam([-1.1, 2.1, 0], [-2.1, 1.75, 0], 0.05, dk));
        m.merge(move(ball(0.3, 6, 4, C('#fff1a6')), -2.15, 1.5, 0));
        return m;
    };
    G.LURE_TIP = [-2.15, 1.5, 0];
    G.LURE_HINGE = [0.2, -0.35];

    G.crown = () => {
        const gold = C('#ffd23f'), dk = C('#ff9a1f');
        const m = lathe([[0.3, 0.75], [-0.3, 0.75]], 10, gold, 1, 1, 0.3);
        rotZ(m, Math.PI / 2);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU;
            const x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75;
            const x2 = Math.cos(a + 0.6) * 0.75, z2 = Math.sin(a + 0.6) * 0.75;
            m.merge(tri3([x, 0.3, z], [x2, 0.3, z2], [(x + x2) / 2, 0.95, (z + z2) / 2], i % 2 ? gold : dk));
            m.merge(box(0.18, 0.18, 0.18, C(i % 2 ? '#e8562a' : '#2a68b3'), x, 0.05, z));
        }
        return m;
    };
    G.king = (withCrown = true) => {
        const pu = C('#8a3cff'), dp = C('#2e2e3e'), red = C('#b52a2a'), w = C('#ffffff');
        const m = lathe([[2.6, 0], [2.3, 0.45], [1.3, 0.95], [0.1, 1.05], [-0.6, 0.9], [-0.95, 0.6]], 10, pu, 1, 0.9, 0.2);
        m.paint((x, y) => (y > 0.6 && x > 0.4 ? C('#ff4fd8') : null));
        m.merge(tri3([2.5, 0.05, 0], [1.6, 1.6, 0], [1.2, 0.5, 0], dp));
        m.merge(tri3([2.5, -0.05, 0], [1.6, -1.6, 0], [1.2, -0.5, 0], dp));
        // the royal cape
        m.merge(tri3([0.5, 0.8, 0.7], [1.7, -1.0, 1.0], [0.3, -0.9, 0.95], red));
        m.merge(tri3([0.5, 0.8, -0.7], [1.7, -1.0, -1.0], [0.3, -0.9, -0.95], red));
        for (const z of [-0.9]) {
            m.merge(box(0.6, 0.55, 0.05, w, -0.35, 0.25, z));
            m.merge(box(0.3, 0.34, 0.04, C('#e8562a'), -0.45, 0.22, z - 0.03));
            m.merge(box(0.14, 0.22, 0.03, C('#04070f'), -0.5, 0.2, z - 0.06));
            m.merge(tri3([-0.75, 0.6, z - 0.06], [-0.0, 0.46, z - 0.06], [-0.1, 0.64, z - 0.06], C('#04070f')));
            // a magnificent moustache
            m.merge(tri3([-0.85, -0.1, z - 0.05], [-0.2, -0.25, z - 0.05], [-1.35, 0.15, z - 0.05], w));
            m.merge(tri3([-0.85, -0.1, z - 0.05], [-0.4, 0.0, z - 0.05], [-0.2, -0.25, z - 0.05], w));
        }
        if (withCrown) m.merge(move(G.crown(), 0.5, 0.95, 0));
        m.armStart = m.v.length;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.2;
            const y0 = Math.cos(a) * 0.55, z0 = Math.sin(a) * 0.55;
            m.merge(beam([-0.9, y0, z0], [-2.1, y0 * 1.6, z0 * 1.6], 0.17, pu));
            m.merge(beam([-2.1, y0 * 1.6, z0 * 1.6], [-3.0, y0 * 2.1, z0 * 2.1], 0.11, dp));
        }
        return m;
    };

    // A few silhouettes for the story scenes.
    G.pedestal = () => {
        const m = lathe([[0.6, 0], [0.6, 0.9], [-0.5, 0.6], [-0.6, 0]], 8, C('#6b6b80'));
        rotZ(m, Math.PI / 2);
        m.merge(move(rotZ(lathe([[0.15, 0.8], [-0.15, 0.95]], 8, C('#b4b4c4')), Math.PI / 2), 0, 0.6, 0));
        return m;
    };
})();

/* A tiny flat-shaded software 3D renderer and the low-poly models it draws. */
(() => {
    const S = window.SEA;
    const C = (h) => S.hexToRgb(h);

    class Mesh {
        constructor() { this.v = []; this.f = []; }
        vert(x, y, z) { this.v.push([x, y, z]); return this.v.length - 1; }
        tri(a, b, c, col) { this.f.push([a, b, c, col]); return this; }
        quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); return this; }
        merge(m, tf) {
            const base = this.v.length;
            m.v.forEach((p) => this.v.push(tf ? tf(p.slice()) : p.slice()));
            m.f.forEach((f) => this.f.push([f[0] + base, f[1] + base, f[2] + base, f[3]]));
            return this;
        }
        // Recolour faces based on their centre point.
        paint(fn) {
            this.f.forEach((f) => {
                const a = this.v[f[0]], b = this.v[f[1]], c = this.v[f[2]];
                const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
                const col = fn(cx, cy, cz, f[3]);
                if (col) f[3] = col;
            });
            return this;
        }
    }

    // Revolve a profile [[x, r], ...] around the x axis.
    const lathe = (profile, seg, col, sy = 1, sz = 1, phase = 0) => {
        const m = new Mesh();
        const rings = profile.map(([x, r]) => {
            if (r <= 1e-4) { const i = m.vert(x, 0, 0); return Array(seg).fill(i); }
            const ring = [];
            for (let j = 0; j < seg; j++) {
                const a = phase + (j / seg) * Math.PI * 2;
                ring.push(m.vert(x, Math.cos(a) * r * sy, Math.sin(a) * r * sz));
            }
            return ring;
        });
        for (let i = 0; i < rings.length - 1; i++) {
            const A = rings[i], B = rings[i + 1];
            for (let j = 0; j < seg; j++) {
                const j2 = (j + 1) % seg;
                const a = A[j], b = A[j2], c = B[j], d = B[j2];
                if (a !== b) m.tri(a, b, d, col);
                if (c !== d) m.tri(a, d, c, col);
            }
        }
        return m;
    };

    const box = (w, h, d, col, cx = 0, cy = 0, cz = 0) => {
        const m = new Mesh();
        const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
        const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
            .map((q) => m.vert(...q));
        m.quad(p[0], p[1], p[2], p[3], col).quad(p[5], p[4], p[7], p[6], col)
         .quad(p[4], p[0], p[3], p[7], col).quad(p[1], p[5], p[6], p[2], col)
         .quad(p[3], p[2], p[6], p[7], col).quad(p[4], p[5], p[1], p[0], col);
        return m;
    };

    const tri3 = (a, b, c, col) => {
        const m = new Mesh();
        m.tri(m.vert(...a), m.vert(...b), m.vert(...c), col);
        return m;
    };

    // Thin beam between two points (for masts, A-frames, booms).
    const beam = (a, b, t, col) => {
        const m = new Mesh();
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * t, ny = (dx / len) * t;
        const v = [
            [a[0] - nx, a[1] - ny, a[2] - t], [a[0] + nx, a[1] + ny, a[2] - t], [b[0] + nx, b[1] + ny, b[2] - t], [b[0] - nx, b[1] - ny, b[2] - t],
            [a[0] - nx, a[1] - ny, a[2] + t], [a[0] + nx, a[1] + ny, a[2] + t], [b[0] + nx, b[1] + ny, b[2] + t], [b[0] - nx, b[1] - ny, b[2] + t]
        ].map((q) => m.vert(...q));
        m.quad(v[0], v[1], v[2], v[3], col).quad(v[4], v[5], v[6], v[7], col)
         .quad(v[0], v[4], v[7], v[3], col).quad(v[1], v[5], v[6], v[2], col);
        return m;
    };

    /* ---------- renderer ---------- */
    const L = (() => { const v = [-0.45, 0.75, -0.55]; const n = Math.hypot(...v); return v.map((x) => x / n); })();
    const P = [];
    const faceBuf = [];

    const xform = (p, o, cxr, sxr, cyr, syr, czr, szr) => {
        const x = p[0], y = p[1], z = p[2];
        const x1 = x * cyr + z * syr, z1 = -x * syr + z * cyr;
        const y1 = y * cxr - z1 * sxr, z2 = y * sxr + z1 * cxr;
        const x2 = x1 * czr - y1 * szr, y2 = x1 * szr + y1 * czr;
        return [x2, y2, z2];
    };

    // Project a model-space point to screen using the same transform as drawMesh.
    S.project = (p, o) => {
        const r = xform(p, o, Math.cos(o.rx || 0), Math.sin(o.rx || 0), Math.cos(o.ry || 0), Math.sin(o.ry || 0), Math.cos(o.rz || 0), Math.sin(o.rz || 0));
        return [o.x + r[0] * o.s, o.y - r[1] * o.s];
    };

    /* o: { x, y, s, rx, ry, rz, light (0..1), amb, fog:[r,g,b], fogAmt, deform(p, out) } -> screen bbox */
    S.drawMesh = (ctx, m, o) => {
        const cxr = Math.cos(o.rx || 0), sxr = Math.sin(o.rx || 0);
        const cyr = Math.cos(o.ry || 0), syr = Math.sin(o.ry || 0);
        const czr = Math.cos(o.rz || 0), szr = Math.sin(o.rz || 0);
        const n = m.v.length;
        const tmp = [0, 0, 0];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < n; i++) {
            let p = m.v[i];
            if (o.deform) { tmp[0] = p[0]; tmp[1] = p[1]; tmp[2] = p[2]; o.deform(tmp, i); p = tmp; }
            const r = xform(p, o, cxr, sxr, cyr, syr, czr, szr);
            const sx = o.x + r[0] * o.s, sy = o.y - r[1] * o.s;
            P[i] = [sx, sy, r[0], r[1], r[2]];
            if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
        }
        const light = o.light == null ? 1 : o.light;
        const amb = o.amb == null ? 0.35 : o.amb;
        const fog = o.fog, fa = o.fogAmt || 0;
        faceBuf.length = 0;
        for (const f of m.f) {
            const a = P[f[0]], b = P[f[1]], c = P[f[2]];
            const ux = b[2] - a[2], uy = b[3] - a[3], uz = b[4] - a[4];
            const vx = c[2] - a[2], vy = c[3] - a[3], vz = c[4] - a[4];
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            const d = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
            const br = (amb + (1 - amb) * d) * light;
            const col = f[3];
            let r = col[0] * br, g = col[1] * br, bl = col[2] * br;
            if (fog && fa) { r += (fog[0] - r) * fa; g += (fog[1] - g) * fa; bl += (fog[2] - bl) * fa; }
            faceBuf.push([a, b, c, (a[4] + b[4] + c[4]) / 3, `rgb(${r | 0},${g | 0},${bl | 0})`]);
        }
        faceBuf.sort((p, q) => q[3] - p[3]);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 0.6;
        for (const f of faceBuf) {
            ctx.beginPath();
            ctx.moveTo(f[0][0], f[0][1]);
            ctx.lineTo(f[1][0], f[1][1]);
            ctx.lineTo(f[2][0], f[2][1]);
            ctx.closePath();
            ctx.fillStyle = f[4];
            ctx.strokeStyle = f[4];
            ctx.fill();
            ctx.stroke();
        }
        return { x0, y0, x1, y1 };
    };

    /* ---------- models ---------- */
    const M = S.models = {};

    M.fish = (body, belly, fin) => {
        const m = lathe([[1.0, 0], [0.75, 0.26], [0.25, 0.42], [-0.35, 0.3], [-0.72, 0.1]], 5, C(body), 1, 0.42, 0.3);
        m.merge(tri3([-0.66, 0, 0], [-1.15, 0.42, 0], [-1.15, -0.42, 0], C(fin)));
        m.merge(tri3([0.25, 0.36, 0], [-0.35, 0.26, 0], [-0.15, 0.66, 0], C(fin)));
        m.paint((x, y) => (y < -0.12 && x > -0.7 ? C(belly) : null));
        return m;
    };

    M.ship = (dark) => {
        const m = new Mesh();
        const hullTop = C(dark ? '#2e2e3e' : '#1f4a8f');
        const hullBot = C(dark ? '#3d2a1e' : '#b52a2a');
        const deckC = C(dark ? '#3d2a1e' : '#c98a64');
        const white = C(dark ? '#6b6b80' : '#dff4ff');
        const st = [[-1.0, 0.32, 0.26, 0.26], [-0.5, 0.38, 0.22, 0.36], [0.3, 0.36, 0.25, 0.36], [0.8, 0.22, 0.33, 0.28], [1.18, 0.0, 0.44, 0.1]];
        const S5 = st.map(([x, w, h, d]) => [
            m.vert(x, h, -w), m.vert(x, -d * 0.45, -w * 0.85), m.vert(x, -d, 0), m.vert(x, -d * 0.45, w * 0.85), m.vert(x, h, w)
        ]);
        for (let i = 0; i < S5.length - 1; i++) {
            const A = S5[i], B = S5[i + 1];
            for (let k = 0; k < 4; k++) {
                const col = (k === 0 || k === 3) ? hullTop : hullBot;
                m.quad(A[k], B[k], B[k + 1], A[k + 1], col);
            }
            m.quad(A[0], B[0], B[4], A[4], deckC);
        }
        const T = S5[0];
        m.tri(T[0], T[1], T[2], hullTop).tri(T[0], T[2], T[4], hullTop).tri(T[2], T[3], T[4], hullTop);
        // wheelhouse
        m.merge(box(0.55, 0.38, 0.42, white, 0.05, 0.47, 0));
        m.merge(box(0.62, 0.06, 0.48, C(dark ? '#2e2e3e' : '#b52a2a'), 0.05, 0.69, 0));
        m.merge(box(0.02, 0.1, 0.36, C('#0b1530'), 0.335, 0.5, 0));
        // funnel
        m.merge(box(0.16, 0.3, 0.16, C(dark ? '#3d2a1e' : '#ff9a1f'), -0.42, 0.55, 0));
        m.merge(box(0.17, 0.07, 0.17, C('#070d1c'), -0.42, 0.72, 0));
        // mast + A-frame at the stern (the bathysphere cable hangs from here)
        m.merge(beam([0.6, 0.25, 0], [0.6, 1.2, 0], 0.025, white));
        m.merge(beam([0.6, 1.0, 0], [0.95, 0.35, 0], 0.012, white));
        m.merge(beam([-0.85, 0.26, -0.22], [-1.22, 0.95, -0.12], 0.025, C(dark ? '#2e2e3e' : '#ffd23f')));
        m.merge(beam([-0.85, 0.26, 0.22], [-1.22, 0.95, 0.12], 0.025, C(dark ? '#2e2e3e' : '#ffd23f')));
        m.merge(beam([-1.22, 0.95, -0.14], [-1.22, 0.95, 0.14], 0.03, C(dark ? '#2e2e3e' : '#ffd23f')));
        return m;
    };
    M.SHIP_HOOK = [-1.22, 0.92, 0];

    M.flag = () => tri3([0.6, 1.2, 0], [0.6, 1.05, 0], [0.92, 1.13, 0], C('#e8562a'));

    M.sphere = () => {
        const prof = [];
        for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; prof.push([Math.cos(a), Math.sin(a)]); }
        const m = lathe(prof, 8, C('#6b6b80'), 1, 1, 0.2);
        m.paint((x, y) => (y > 0.5 ? C('#b4b4c4') : null));
        m.merge(box(0.4, 0.22, 0.4, C('#2e2e3e'), 0, 1.02, 0));
        return m;
    };

    M.sub = () => {
        const g = C('#3f9446'), lg = C('#9bdc5a'), dk = C('#1e5234');
        const m = lathe([[1.25, 0], [1.12, 0.24], [0.82, 0.38], [-0.6, 0.38], [-1.0, 0.26], [-1.3, 0.1], [-1.36, 0]], 7, g, 1, 1, 0.2);
        m.paint((x, y) => (y > 0.2 ? lg : null));
        m.merge(box(0.46, 0.34, 0.2, lg, 0.1, 0.5, 0));
        m.merge(beam([0.2, 0.6, 0], [0.2, 0.9, 0], 0.025, dk));
        m.merge(beam([0.2, 0.9, 0], [0.38, 0.9, 0], 0.025, dk));
        m.merge(tri3([-1.0, 0.2, 0], [-1.3, 0.55, 0], [-1.32, 0.08, 0], dk));
        m.merge(tri3([-1.0, -0.2, 0], [-1.3, -0.5, 0], [-1.32, -0.08, 0], dk));
        m.merge(tri3([-1.0, 0, 0.2], [-1.3, 0, 0.55], [-1.32, 0, 0.08], dk));
        m.merge(tri3([-1.0, 0, -0.2], [-1.3, 0, -0.55], [-1.32, 0, -0.08], dk));
        for (const px of [0.55, 0.1, -0.35]) m.merge(box(0.14, 0.14, 0.02, C('#ffd23f'), px, 0.02, 0.385));
        return m;
    };

    M.prop = () => {
        const m = new Mesh();
        const col = C('#d9bd84');
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            m.merge(tri3([0, 0, 0], [0, Math.cos(a) * 0.32, Math.sin(a) * 0.32], [0, Math.cos(a + 0.7) * 0.28, Math.sin(a + 0.7) * 0.28], col));
        }
        return m;
    };

    M.whale = () => {
        const body = C('#2e3a52'), belly = C('#8b93a8');
        const m = lathe([[1.6, 0], [1.5, 0.32], [1.0, 0.6], [0, 0.68], [-1.0, 0.48], [-2.0, 0.2], [-2.6, 0.08]], 7, body, 0.85, 0.75, 0.25);
        m.paint((x, y) => (y < -0.25 && x > -1.6 ? belly : null));
        m.merge(tri3([0.7, -0.35, 0.35], [0.1, -0.95, 0.8], [0.3, -0.4, 0.45], body));
        m.merge(tri3([0.7, -0.35, -0.35], [0.1, -0.95, -0.8], [0.3, -0.4, -0.45], body));
        m.merge(tri3([-2.55, 0, 0], [-3.2, 0.12, 0.85], [-2.9, 0.0, 0.0], body));
        m.merge(tri3([-2.55, 0, 0], [-3.2, 0.12, -0.85], [-2.9, 0.0, 0.0], body));
        return m;
    };

    M.angler = () => {
        const body = C('#3d2a1e'), teeth = C('#dff4ff');
        const m = lathe([[0.95, 0], [0.88, 0.45], [0.4, 0.75], [-0.3, 0.62], [-0.8, 0.28], [-1.0, 0]], 6, body, 1, 0.8, 0.4);
        m.merge(tri3([-0.9, 0, 0], [-1.4, 0.45, 0], [-1.4, -0.45, 0], C('#7a4b2e')));
        for (let i = 0; i < 5; i++) {
            const z = -0.3 + i * 0.15;
            m.merge(tri3([0.86, -0.08, z - 0.04], [0.86, -0.08, z + 0.04], [0.94, 0.12, z], teeth));
            m.merge(tri3([0.84, -0.3, z - 0.04], [0.84, -0.3, z + 0.04], [0.92, -0.48, z], teeth));
        }
        return m;
    };
    M.ANGLER_ROD = [0.35, 0.72, 0];

    M.snailfish = () => {
        const m = lathe([[0.9, 0], [0.75, 0.3], [0.2, 0.36], [-0.6, 0.2], [-1.3, 0.04]], 5, C('#f2c6a0'), 1, 0.5, 0.3);
        m.paint((x, y) => (y > 0.1 ? C('#d9bd84') : null));
        return m;
    };

    S.Mesh = Mesh;
    S.geo = { lathe, box, tri3, beam };
})();

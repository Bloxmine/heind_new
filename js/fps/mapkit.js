/* Building blocks for maps: solids, stairs with railings, lights, and the accent colours every palette keeps. */
import { box, ramp } from './geom.js';

// pickups, confetti and team colours have to survive any map's palette
export const ACCENTS = ['#ff3a6e', '#3ad0ff', '#4aff7a', '#ffe23a', '#b04aff', '#ff8a1a', '#ffffff', '#000000'];

// the ground beyond the map: four slabs around it (never under it, where they'd fight the real floor for depth)
export function farRing(m, r, R) {
    const y0 = -0.6, y1 = -0.02;
    return [[-R, -R, R, -r], [-R, r, R, R], [-R, -r, -r, r], [r, -r, R, r]].map(([x0, z0, x1, z1]) => ({ t: 'vbox', min: [x0, y0, z0], max: [x1, y1, z1], m, shadow: false }));
}

export function kit() {
    const S = [], L = [], RAILS = [], GLOWS = [], DECOR = [];
    const k = {
        S, L, RAILS, GLOWS, DECOR,
        add: (...a) => { S.push(...a); return a[0]; },
        box: (x0, y0, z0, x1, y1, z1, m, extra) => { const b = box(x0, y0, z0, x1, y1, z1, m, extra); S.push(b); return b; },
        ramp: (x0, z0, x1, z1, ax, ya, yb, th, m, extra) => { const r = ramp(x0, z0, x1, z1, ax, ya, yb, th, m, extra); S.push(r); return r; },
        // an invisible wall at the edge of the map
        clip: (x0, z0, x1, z1, y0 = -5, y1 = 60) => S.push(box(x0, y0, z0, x1, y1, z1, 'wall', { clip: true, noShot: true })),
        light: (x, y, z, c, i, r, fix = true) => L.push({ p: [x, y, z], c, i, r, fix }),
        rail: (x0, y, z0, x1, z1, m = 'rail', h = 1.05) => S.push(box(x0, y, z0, x1, y + h, z1, m)),
        glow: (x0, y0, z0, x1, y1, z1, c, flat = false) => GLOWS.push([x0, y0, z0, x1, y1, z1, c, flat]),
        decor: (...d) => DECOR.push(...d),
        // a floor slab with rectangular holes in it ([x0, z0, x1, z1] each), for atriums and stairwells
        slab(x0, z0, x1, z1, y0, y1, m, holes = [], extra) {
            const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h[0], h[2]]).filter((v) => v > x0 && v < x1)])].sort((a, b) => a - b);
            for (let i = 0; i < xs.length - 1; i++) {
                const xa = xs[i], xb = xs[i + 1];
                const cut = holes.filter((h) => h[0] <= xa && h[2] >= xb).map((h) => [h[1], h[3]]).sort((a, b) => a[0] - b[0]);
                let z = z0;
                for (const [a, b] of cut) { if (a > z) S.push(box(xa, y0, z, xb, y1, Math.min(a, z1), m, extra)); z = Math.max(z, b); }
                if (z < z1) S.push(box(xa, y0, z, xb, y1, z1, m, extra));
            }
        },
        /* a flight of stairs. ax 'x' or 'z'; ya is the height at the low-coordinate end.
           sides: 'panel' (solid cladding), 'rail' (thin handrails) or none */
        stair(x0, z0, x1, z1, ax, ya, yb, o = {}) {
            const th = o.th || 0.5, m = o.m || 'stair';
            S.push(ramp(x0, z0, x1, z1, ax, ya, yb, th, m, { steps: true }));
            if (!o.sides) return;
            const P = o.sides === 'panel' ? 0.16 : 0.08, H = o.sides === 'panel' ? 1.0 : 1.05;
            const sides = ax === 'x' ? [[x0, z0 - P, x1, z0], [x0, z1, x1, z1 + P]] : [[x0 - P, z0, x0, z1], [x1, z0, x1 + P, z1]];
            for (const [a, b, c, d] of sides) {
                if (o.sides === 'panel') S.push(ramp(a, b, c, d, ax, ya + H, yb + H, th + H, o.panel || 'orange', { panel: true }));
                else S.push(ramp(a, b, c, d, ax, ya + H, yb + H, 0.08, o.rail || 'rail', { noNav: true }));
                if (o.glow) {
                    const mx = (a + c) / 2, mz = (b + d) / 2;
                    RAILS.push(ax === 'x' ? [x0, ya + H, mz, x1, yb + H, mz, o.glow] : [mx, ya + H, z0, mx, yb + H, z1, o.glow]);
                }
            }
        }
    };
    return k;
}

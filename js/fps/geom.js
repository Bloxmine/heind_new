/* The collision world. Everything solid is an axis-aligned box or a ramp (a sloped slab, used for stairs),
   which keeps movement, line of sight and the light baker simple and fast.
   A ramp rises along x or z: its top is at height ya at the low end of that axis and yb at the high end,
   and it is th thick below that surface. */

export const BOX = 0, RAMP = 1;
const EPS = 1e-4;

export function box(x0, y0, z0, x1, y1, z1, m = 'conc', extra) {
    return Object.assign({ k: BOX, x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), m }, extra);
}
// ramp over the footprint x0..x1, z0..z1; ax 'x' or 'z'; ya at the low coordinate end, yb at the high end
export function ramp(x0, z0, x1, z1, ax, ya, yb, th = 0.5, m = 'stair', extra) {
    const s = { k: RAMP, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), ax: ax === 'x' ? 0 : 2, ya, yb, th, m };
    s.y0 = Math.min(ya, yb) - th; s.y1 = Math.max(ya, yb);
    return Object.assign(s, extra);
}
// the height of a ramp's top surface at coordinate c along its axis
export function rampH(s, c) {
    const lo = s.ax === 0 ? s.x0 : s.z0, hi = s.ax === 0 ? s.x1 : s.z1;
    const t = Math.min(1, Math.max(0, (c - lo) / (hi - lo)));
    return s.ya + (s.yb - s.ya) * t;
}
// the vertical extent [bottom, top] a solid fills over a footprint, or null if it does not touch it
function span(s, x0, z0, x1, z1, out) {
    if (x1 <= s.x0 || x0 >= s.x1 || z1 <= s.z0 || z0 >= s.z1) return null;
    if (s.k === BOX) { out[0] = s.y0; out[1] = s.y1; return out; }
    const a = s.ax === 0 ? Math.max(x0, s.x0) : Math.max(z0, s.z0);
    const b = s.ax === 0 ? Math.min(x1, s.x1) : Math.min(z1, s.z1);
    const ha = rampH(s, a), hb = rampH(s, b);
    out[0] = Math.min(ha, hb) - s.th; out[1] = Math.max(ha, hb);
    return out;
}

export class Level {
    constructor(solids) {
        this.solids = solids;
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const s of solids) { x0 = Math.min(x0, s.x0); z0 = Math.min(z0, s.z0); x1 = Math.max(x1, s.x1); z1 = Math.max(z1, s.z1); }
        this.cs = 4;
        this.gx0 = x0; this.gz0 = z0;
        this.nx = Math.max(1, Math.ceil((x1 - x0) / this.cs)); this.nz = Math.max(1, Math.ceil((z1 - z0) / this.cs));
        this.cells = Array.from({ length: this.nx * this.nz }, () => []);
        solids.forEach((s, i) => {
            s.id = i; s._q = 0;
            const [a, b, c, d] = this.cellRect(s.x0, s.z0, s.x1, s.z1);
            for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) this.cells[z * this.nx + x].push(s);
        });
        this.stamp = 0;
        this.tmp = [0, 0];
        this.out = [];
    }
    cellRect(x0, z0, x1, z1) {
        const cl = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
        return [cl(Math.floor((x0 - this.gx0) / this.cs), this.nx), cl(Math.floor((x1 - this.gx0) / this.cs), this.nx),
            cl(Math.floor((z0 - this.gz0) / this.cs), this.nz), cl(Math.floor((z1 - this.gz0) / this.cs), this.nz)];
    }
    // the solids that might touch a rectangle on the ground plan (a fresh array each call)
    near(x0, z0, x1, z1) {
        const st = ++this.stamp, out = [];
        const [a, b, c, d] = this.cellRect(x0, z0, x1, z1);
        for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) {
            for (const s of this.cells[z * this.nx + x]) if (s._q !== st) { s._q = st; out.push(s); }
        }
        return out;
    }
    // is a body of radius r and height h, feet at y, blocked here? Solids whose top is within `step` of the feet don't count.
    blocked(x, y, z, r, h, step, skip) {
        for (const s of this.near(x - r, z - r, x + r, z + r)) {
            if (s.ghost || s === skip) continue;
            const sp = span(s, x - r, z - r, x + r, z + r, this.tmp);
            if (!sp || sp[1] <= y + step || sp[0] >= y + h) continue;
            return s;
        }
        return null;
    }
    // the highest surface under a body whose top is at or below maxY (ramps use a narrower foot, so stairs don't lift you early)
    ground(x, z, r, maxY) {
        let best = -Infinity, bs = null;
        for (const s of this.near(x - r, z - r, x + r, z + r)) {
            if (s.ghost) continue;
            const rr = s.k === RAMP ? Math.min(r, 0.12) : r;
            const sp = span(s, x - rr, z - rr, x + rr, z + rr, this.tmp);
            if (!sp || sp[1] > maxY + EPS) continue;
            if (sp[1] > best) { best = sp[1]; bs = s; }
        }
        this.groundSolid = bs;
        return best;
    }
    // the lowest underside above a body's head
    ceiling(x, z, r, minY) {
        let best = Infinity;
        for (const s of this.near(x - r, z - r, x + r, z + r)) {
            if (s.ghost) continue;
            const sp = span(s, x - r, z - r, x + r, z + r, this.tmp);
            if (!sp || sp[0] < minY - 0.05) continue;
            if (sp[0] < best) best = sp[0];
        }
        return best;
    }
    /* Move a body {x,y,z,vx,vy,vz,r,h,ground} by its velocity for dt. Walls stop it, it steps up stairs and kerbs,
       sticks to the ground going down stairs, and lands. Returns the impact speed when it landed this step, else 0. */
    move(b, dt, stepUp = 0.55) {
        const step = b.ground ? stepUp : 0.3;
        this.axis(b, 0, b.vx * dt, step);
        this.axis(b, 2, b.vz * dt, step);
        let landed = 0;
        if (b.vy > 0) {
            const c = this.ceiling(b.x, b.z, b.r * 0.9, b.y + b.h);
            let ny = b.y + b.vy * dt;
            if (ny + b.h > c) { ny = Math.max(b.y, c - b.h); b.vy = 0; }
            b.y = ny; b.ground = false;
        } else {
            const g = this.ground(b.x, b.z, b.r, b.y + step);
            const ny = b.y + b.vy * dt;
            if (ny <= g) {
                if (!b.ground) landed = -b.vy || 0.01;
                b.y = g; b.vy = 0; b.ground = true; b.on = this.groundSolid;
            } else if (b.ground && b.y - g < 0.6) {
                b.y = g; b.vy = 0; b.on = this.groundSolid;
            } else { b.y = ny; b.ground = false; b.on = null; }
        }
        return landed;
    }
    axis(b, ax, d, step) {
        if (!d) return;
        const ox = b.x, oz = b.z;
        if (ax === 0) b.x += d; else b.z += d;
        for (let i = 0; i < 3; i++) {
            const s = this.blocked(b.x, b.y, b.z, b.r, b.h, step);
            if (!s) return;
            // was it already in the way before this move (we're standing up into it, say)? then let it be
            if (this.blocked(ox, b.y, oz, b.r, b.h, step, null) === s) return;
            if (s.k === BOX) {
                if (ax === 0) b.x = d > 0 ? Math.min(b.x, s.x0 - b.r - EPS) : Math.max(b.x, s.x1 + b.r + EPS);
                else b.z = d > 0 ? Math.min(b.z, s.z0 - b.r - EPS) : Math.max(b.z, s.z1 + b.r + EPS);
            } else { b.x = ox; b.z = oz; }
            if (ax === 0) b.vx = 0; else b.vz = 0;
            b.bump = true;
        }
    }
    /* Ray cast from o along unit direction d up to maxT. Returns { t, nx, ny, nz, s } or null. */
    ray(ox, oy, oz, dx, dy, dz, maxT, skipGhost = true) {
        let best = null, bt = maxT;
        const test = (s) => {
            if ((skipGhost && s.ghost) || s.noShot) return;
            const h = s.k === BOX ? rayBox(s, ox, oy, oz, dx, dy, dz, bt) : rayRamp(s, ox, oy, oz, dx, dy, dz, bt);
            if (h && h.t < bt) { bt = h.t; best = h; best.s = s; }
        };
        const cs = this.cs, gx = (ox - this.gx0) / cs, gz = (oz - this.gz0) / cs;
        // short rays, or ones starting off the grid: test everything near the line
        if (maxT < cs * 2 || gx < 0 || gz < 0 || gx >= this.nx || gz >= this.nz) {
            const ex = ox + dx * maxT, ez = oz + dz * maxT;
            for (const s of this.near(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez))) test(s);
            return best;
        }
        // long rays: walk the grid cells along the line, nearest first, and stop once a hit is closer than the next cell
        const st = ++this.stamp;
        let cx = Math.floor(gx), cz = Math.floor(gz);
        const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
        const tdx = Math.abs(dx) > 1e-9 ? cs / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? cs / Math.abs(dz) : Infinity;
        let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? cx + 1 - gx : gx - cx) * cs) / Math.abs(dx) : Infinity;
        let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? cz + 1 - gz : gz - cz) * cs) / Math.abs(dz) : Infinity;
        for (;;) {
            for (const s of this.cells[cz * this.nx + cx]) if (s._q !== st) { s._q = st; test(s); }
            const tn = Math.min(tmx, tmz);
            if (tn >= bt) break;
            if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
            if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) break;
        }
        return best;
    }
    clear(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
        if (L < 1e-6) return true;
        return !this.ray(ax, ay, az, dx / L, dy / L, dz / L, L);
    }
    inside(x, y, z) {
        for (const s of this.near(x, z, x, z)) {
            if (s.ghost || s.clip || x <= s.x0 || x >= s.x1 || z <= s.z0 || z >= s.z1) continue;
            if (s.k === BOX) { if (y > s.y0 && y < s.y1) return s; }
            else { const h = rampH(s, s.ax === 0 ? x : z); if (y < h && y > h - s.th) return s; }
        }
        return null;
    }
}

const hit = (t, nx, ny, nz) => ({ t, nx, ny, nz, s: null });

export function rayBox(s, ox, oy, oz, dx, dy, dz, maxT) {
    let t0 = 0, t1 = maxT, ax = -1, sg = 0;
    const lo = [s.x0, s.y0, s.z0], hi = [s.x1, s.y1, s.z1], o = [ox, oy, oz], d = [dx, dy, dz];
    for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
        let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i], sgn = -1;
        if (a > b) { const t = a; a = b; b = t; sgn = 1; }
        if (a > t0) { t0 = a; ax = i; sg = sgn; }
        if (b < t1) t1 = b;
        if (t0 > t1) return null;
    }
    if (ax < 0) return hit(0, -dx, -dy, -dz);       // started inside
    return hit(t0, ax === 0 ? sg : 0, ax === 1 ? sg : 0, ax === 2 ? sg : 0);
}
// a ramp is a convex solid: clip the ray against its six planes (Cyrus-Beck)
export function rayRamp(s, ox, oy, oz, dx, dy, dz, maxT) {
    const lo = s.ax === 0 ? s.x0 : s.z0, hi = s.ax === 0 ? s.x1 : s.z1;
    const k = (s.yb - s.ya) / (hi - lo);
    // planes as n.p <= d
    const P = s.ax === 0
        ? [[-1, 0, 0, -s.x0], [1, 0, 0, s.x1], [0, 0, -1, -s.z0], [0, 0, 1, s.z1], [-k, 1, 0, s.ya - k * lo], [k, -1, 0, s.th - s.ya + k * lo]]
        : [[-1, 0, 0, -s.x0], [1, 0, 0, s.x1], [0, 0, -1, -s.z0], [0, 0, 1, s.z1], [0, 1, -k, s.ya - k * lo], [0, -1, k, s.th - s.ya + k * lo]];
    let t0 = 0, t1 = maxT, n = null;
    for (const p of P) {
        const den = p[0] * dx + p[1] * dy + p[2] * dz;
        const dist = p[3] - (p[0] * ox + p[1] * oy + p[2] * oz);
        if (Math.abs(den) < 1e-9) { if (dist < 0) return null; continue; }
        const t = dist / den;
        if (den < 0) { if (t > t0) { t0 = t; n = p; } } else if (t < t1) t1 = t;
        if (t0 > t1) return null;
    }
    if (!n) return hit(0, -dx, -dy, -dz);
    const L = Math.hypot(n[0], n[1], n[2]);
    return hit(t0, n[0] / L, n[1] / L, n[2] / L);
}

// distance from point p to segment a-b (squared)
export function segDist2(px, py, pz, ax, ay, az, bx, by, bz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const L = abx * abx + aby * aby + abz * abz;
    let t = L > 0 ? ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = ax + abx * t - px, dy = ay + aby * t - py, dz = az + abz * t - pz;
    return dx * dx + dy * dy + dz * dz;
}
// ray against a sphere: the entry distance or -1
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxT) {
    const lx = cx - ox, ly = cy - oy, lz = cz - oz;
    const tc = lx * dx + ly * dy + lz * dz;
    const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
    if (d2 > r * r) return -1;
    const t = tc - Math.sqrt(r * r - d2);
    return t >= 0 && t <= maxT ? t : (t < 0 && tc >= 0 && lx * lx + ly * ly + lz * lz < r * r ? 0 : -1);
}
// ray against an axis-aligned box given by centre and half sizes: entry distance or -1
export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
    const h = rayBox({ x0, y0, z0, x1, y1, z1 }, ox, oy, oz, dx, dy, dz, maxT);
    return h ? h.t : -1;
}

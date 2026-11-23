/* Rain: falling streaks, puddles on the road (with grip and spray), and droplets on the windscreen with
   their own little physics: gravity, airflow at speed, cornering and braking forces, merging, wipers. */
import * as THREE from 'three';
import { MAIN_ONLY } from './retro.js';
import { rng } from './textures.js';

// what falls (or blows) for each kind of weather
const FLAKE = {
    rain: { col: '#c8d4e0', fall: 26, streak: 0.07, op: 0.55 },
    storm: { col: '#d4dde8', fall: 34, wind: [7, 2], streak: 0.08, op: 0.7 },
    snow: { col: '#f4f8ff', fall: 3.2, flake: true },
    blizzard: { col: '#ffffff', fall: 7, wind: [12, 4], streak: 0.035, flake: true },
    embers: { col: '#ff8a2a', fall: -1.5, flake: true },
    leaves: { col: '#e8782a', fall: 3.2, flake: true },
    sand: { col: '#e8b070', fall: 1.2, wind: [22, 7], streak: 0.05, flake: true },
    petals: { col: '#ffb4d4', fall: 1.5, wind: [1.6, 0.7], flake: true }
};
export class Rain {
    constructor(scene, n = 480) {
        this.n = n;
        this.p = new Float32Array(n * 3);
        this.pos = new Float32Array(n * 6);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c8d4e0', transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
        this.lines.frustumCulled = false;
        this.lines.layers.set(MAIN_ONLY);
        this.lines.visible = false;
        scene.add(this.lines);
        this.init = false;
    }
    setOn(on, mode = 'rain') {
        this.lines.visible = on;
        this.mode = mode;
        this.M = FLAKE[mode] || FLAKE.rain;
        this.lines.material.color.set(this.M.col);
        this.lines.material.opacity = this.M.op || 0.9;
        this.flaky = !!this.M.flake;
    }
    update(dt, cam, car) {
        if (!this.lines.visible) return;
        const p = this.p, o = this.pos, c = cam.position;
        const vx = car ? car.vx : 0, vz = car ? car.vz : 0;
        const lim = this.n * (this.k == null ? 1 : this.k);
        for (let i = 0; i < this.n; i++) {
            if (i >= lim) { o.fill(0, i * 6, i * 6 + 6); continue; }
            let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
            const M = this.M || FLAKE.rain, snow = this.flaky, fall = M.fall, wx = M.wind ? M.wind[0] : 0, wz = M.wind ? M.wind[1] : 0;
            y -= fall * dt; x += wx * dt; z += wz * dt;
            if (snow) { x += Math.sin(y * 0.9 + i) * 0.8 * dt; z += Math.cos(y * 0.7 + i * 1.3) * 0.8 * dt; }
            if (!this.init || y < c.y - 6 || y > c.y + 18 || Math.abs(x - c.x) > 22 || Math.abs(z - c.z) > 22) {
                // respawn in a box around the camera, a little ahead of where we're going
                x = c.x + (Math.random() - 0.5) * 40 + vx * 0.4 - wx * 0.6;
                z = c.z + (Math.random() - 0.5) * 40 + vz * 0.4 - wz * 0.6;
                y = c.y - 4 + Math.random() * 16;
            }
            p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
            // streak along the apparent velocity: falling, minus our own speed
            // no rain inside the car itself
            if (car && Math.abs(x - car.x) < 2.6 && Math.abs(z - car.z) < 2.6 && y < car.y + 1.8) { o.fill(0, i * 6, i * 6 + 6); continue; }
            o[i * 6] = x; o[i * 6 + 1] = y; o[i * 6 + 2] = z;
            const k = M.streak || (snow ? 0.012 : 0.07);
            o[i * 6 + 3] = x - (wx - vx) * k; o[i * 6 + 4] = y + fall * k + (snow ? 0.12 : 0); o[i * 6 + 5] = z - (wz - vz) * k;
        }
        this.init = true;
        this.lines.geometry.attributes.position.needsUpdate = true;
    }
}

// Puddles: flat dark pools with a light rim and rippling rings, scattered along the road.
export function addPuddles(track) {
    const { S, N, seg, group } = track;
    const r = rng(track.def.id.length * 31 + 7);
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const rings = [];
    const draw = (t) => {
        x.clearRect(0, 0, 32, 32);
        x.fillStyle = '#4a5462'; x.beginPath(); x.ellipse(16, 16, 15.5, 15.5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#1a2028'; x.beginPath(); x.ellipse(16, 16, 13.5, 13.5, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#2e3a48'; x.fillRect(8, 9, 10, 2); x.fillRect(11, 12, 5, 1);    // a streak of sky in the water
        if (rings.length < 4 && Math.random() < 0.5) rings.push({ x: 6 + Math.random() * 20, y: 6 + Math.random() * 20, r: 0 });
        x.strokeStyle = '#8a98a8'; x.lineWidth = 1;
        for (let i = rings.length - 1; i >= 0; i--) {
            const g = rings[i]; g.r += 0.8;
            if (g.r > 6) { rings.splice(i, 1); continue; }
            x.beginPath(); x.ellipse(g.x, g.y, g.r, g.r * 0.6, 0, 0, Math.PI * 2); x.stroke();
        }
        tex.needsUpdate = true;
    };
    draw(0);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: false });
    const geo = new THREE.CircleGeometry(1, 14); geo.rotateX(-Math.PI / 2);
    const list = [];
    for (let i = 30; i < N - 10; i += 8 + Math.floor(r() * 16)) {
        const s = S[i], hw = s.w / 2;
        const d = (r() - 0.5) * hw * 1.3, rx = 1.1 + r() * 1.8, rz = 1.8 + r() * 3.5;
        const m = new THREE.Mesh(geo, mat);
        m.position.set(s.x + s.sx * d, s.y + 0.05, s.z + s.sz * d);
        m.rotation.y = Math.atan2(s.tx, s.tz);
        m.scale.set(rx, 1, rz);
        group.add(m);
        list.push({ i, d, rx, rz });
    }
    track.puddles = list;
    track.wet = true;
    track.puddleAt = (q) => {
        for (const p of list) {
            const along = (q.prog - p.i) * seg;
            if (Math.abs(along) > 8) continue;
            const lat = q.d - p.d;
            if ((along / p.rz) ** 2 + (lat / p.rx) ** 2 < 1) return true;
        }
        return false;
    };
    let acc = 0;
    track.animatePuddles = (dt) => { acc += dt; if (acc > 0.1) { acc = 0; draw(); } };
    // a wet road is darker
    track.M.road.color.set('#8c8c98');
    track.M.verge.color.set('#9a9aa4');
}

/* Windscreen droplets, simulated in screen space at half resolution. The texture stores a little
   normal for each drop (red, green) and a mask (blue); the post shader uses it to refract the view. */
export class Droplets {
    constructor(w = 160, h = 90) {
        this.w = w; this.h = h;
        this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
        this.x = this.c.getContext('2d');
        this.img = this.x.createImageData(w, h);
        this.tex = new THREE.CanvasTexture(this.c);
        this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false;
        this.d = [];
        this.any = false;
    }
    clear() { this.d.length = 0; }
    inside(q, px, py) {
        let s = 0;
        for (let i = 0; i < 4; i++) {
            const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4];
            const cr = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
            if (cr !== 0) { if (s === 0) s = Math.sign(cr); else if (Math.sign(cr) !== s) return false; }
        }
        return true;
    }
    update(dt, o) {
        const W = this.w, H = this.h, d = this.d;
        const q = o.quad.map(([u, v]) => [u * W, v * H]);
        // new drops land on the glass; more at speed
        if (o.rain) {
            let n = (40 + o.speed * 2.2) * dt;
            while (n > 0) {
                if (Math.random() < n) {
                    const u = Math.random(), v = Math.random();
                    const top = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
                    const bot = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
                    d.push({ x: top[0] + (bot[0] - top[0]) * v, y: top[1] + (bot[1] - top[1]) * v, r: 1.1 + Math.random() * 1.6, vx: 0, vy: 0, trail: [] });
                }
                n -= 1;
            }
        }
        const cx = W / 2, air = o.speed;
        for (const p of d) {
            // forces on the drop, in screen pixels per second squared
            let fx = (p.x - cx) / W * air * 2.2 + (o.accL || 0) * 2.4;
            let fy = 30 * Math.min(1, p.r / 2) - air * (0.6 + p.r * 0.35) - (o.accF || 0) * 2.0;
            // small drops cling to the glass until the push is strong enough
            const cling = 26 / p.r;
            if (Math.hypot(fx, fy) < cling) { fx = 0; fy = 0; p.vx *= 0.8; p.vy *= 0.8; }
            p.vx = (p.vx + fx * dt) * 0.96; p.vy = (p.vy + fy * dt) * 0.96;
            if (Math.abs(p.vx) + Math.abs(p.vy) > 4) { p.trail.unshift([p.x, p.y]); if (p.trail.length > 5) p.trail.pop(); }
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (!o.rain) p.r -= dt * 0.25;  // drying up
        }
        // merging: touching drops become one bigger drop
        for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) {
            const a = d[i], b = d[j];
            if (Math.abs(a.x - b.x) > 6 || Math.abs(a.y - b.y) > 6) continue;
            if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.75) {
                const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
                a.x = (a.x * ma + b.x * mb) / m; a.y = (a.y * ma + b.y * mb) / m;
                a.vx = (a.vx * ma + b.vx * mb) / m; a.vy = (a.vy * ma + b.vy * mb) / m;
                a.r = Math.min(4, Math.sqrt(m));
                d.splice(j--, 1);
            }
        }
        // wipers clear what they touch; anything that leaves the glass is gone
        const wl = (o.wipers || []).map(([ax, ay, bx, by]) => [ax * W, ay * H, bx * W, by * H]);
        for (let i = d.length - 1; i >= 0; i--) {
            const p = d[i];
            let gone = p.r < 0.4 || !this.inside(q, p.x, p.y) || d.length > 320;
            for (const [ax, ay, bx, by] of wl) {
                const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
                const t = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / l2));
                if (Math.hypot(p.x - (ax + vx * t), p.y - (ay + vy * t)) < 2.5 + p.r) gone = true;
            }
            if (gone) d.splice(i, 1);
        }
        this.draw();
        this.any = d.length > 0;
    }
    draw() {
        const W = this.w, H = this.h, a = this.img.data;
        a.fill(0);
        const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255; };
        for (const p of this.d) {
            for (const [tx, ty] of p.trail) put(Math.round(tx), Math.round(ty), 128, 128, 120);
            const R = Math.max(0.6, p.r), x0 = Math.floor(p.x - R), x1 = Math.ceil(p.x + R), y0 = Math.floor(p.y - R), y1 = Math.ceil(p.y + R);
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
                const dx = (x + 0.5 - p.x) / R, dy = (y + 0.5 - p.y) / R;
                if (dx * dx + dy * dy > 1) continue;
                put(x, y, 128 + dx * 127, 128 + dy * 127, 255);
            }
        }
        for (let i = 3; i < a.length; i += 4) a[i] = 255;
        this.x.putImageData(this.img, 0, 0);
        this.tex.needsUpdate = true;
    }
}

// Rain turns any track grey and close: darker sky, low clouds, fog, lights on.
// a track under a given weather: rain and storms darken it, fog, sandstorms and blizzards close it in
const mixHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const WX_FLAKES = { rain: 'rain', storm: 'storm', snow: 'snow', blizzard: 'blizzard', embers: 'embers', leaves: 'leaves', sandstorm: 'sand', sakura: 'petals' };
export function weathered(base, w) {
    const clone = () => { const c = JSON.parse(JSON.stringify(base)); c.points = base.points; c.bank = base.bank; c.trees = base.trees; return c; };
    let d;
    if (w === 'rain' || w === 'storm') {
        d = rainy(base);
        if (w === 'storm') {
            d.storm = true; d.fog = '#262c34'; d.fogNear = 24; d.fogFar = 210;
            Object.assign(d.sky, { top: '#0e1218', horizon: '#343c46', clouds: '#2a3038', cloudsDark: '#1a1e24' });
            d.light = Object.assign({}, d.light, { sun: '#6a7484', amb: '#4a5262' });
        }
    } else if (w === 'fog') {
        d = clone(); d.fog = mixHex(base.fog, '#a4acb4', 0.6); d.fogNear = 3; d.fogFar = 85;
        d.headlights = Math.max(base.headlights || 0, 0.8);
    } else if (w === 'sandstorm') {
        d = clone(); d.fog = '#c8823e'; d.fogNear = 2; d.fogFar = 85;
        Object.assign(d.sky, { top: '#8a5a32', horizon: '#d8a060' });
        d.light = Object.assign({}, base.light, { sun: '#ffb070', amb: '#b08a62', disc: '#ffd0a0' });
        d.headlights = Math.max(base.headlights || 0, 0.8);
    } else if (w === 'blizzard') {
        d = clone(); d.fog = '#e4ecf4'; d.fogNear = 2; d.fogFar = 72;
        Object.assign(d.sky, { top: '#a8b4c0', horizon: '#dde6ee' });
        d.light = Object.assign({}, base.light, { amb: '#b8c8d8' });
        d.headlights = Math.max(base.headlights || 0, 0.8);
    } else d = base === undefined ? base : clone();
    d.weatherName = w;
    d.flakes = WX_FLAKES[w] || null;
    return d;
}
// what a track might get when the weather is left to chance
export function weatherPool(base) {
    if (base.noWeather) return [base.weather || 'dry'];
    const cold = ['snow', 'blizzard'].includes(base.weather) || ['snow', 'ice'].includes(base.surface) || base.terrain === 'snow';
    const dusty = ['sand'].includes(base.terrain) || ['canyon', 'mirage'].includes(base.id);
    const pool = cold ? ['snow', 'blizzard', 'fog', 'dry'] : ['dry', 'rain', 'storm', 'fog'];
    if (dusty) pool.push('sandstorm', 'sandstorm');
    if (base.weather && !pool.includes(base.weather)) pool.push(base.weather, base.weather);
    return pool;
}
export function rainy(def) {
    const d = JSON.parse(JSON.stringify(def));
    d.points = def.points; d.bank = def.bank; d.trees = def.trees;
    Object.assign(d.sky, { top: '#2a323c', horizon: '#6a7480', far: '#3a424c', far2: '#343c46', snow: '#8a929c', snow2: '#6e7680', clouds: '#4a525c', cloudsDark: '#3a424c', near: '#262e2a', near2: '#222a26', peaks: def.sky.peaks });
    d.fog = '#4e565e'; d.fogNear = 30; d.fogFar = 260;
    d.light = Object.assign({}, def.light, { sun: '#a8b4c4', amb: '#6a7688', ground: '#2a2e2a', disc: '#3a424c' });
    d.headlights = 1;
    d.rain = true;
    return d;
}

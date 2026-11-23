/* Every texture is painted in code at phone-game sizes (16 to 64 pixels), then shown without smoothing. */
import * as THREE from 'three';

export const rng = (seed) => {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

function make(w, h, draw, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = opts.mip === false ? THREE.NearestFilter : THREE.NearestMipmapNearestFilter;
    t.generateMipmaps = opts.mip !== false;
    t.wrapS = opts.clampS ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.wrapT = opts.clampT ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.canvas = c;
    return t;
}
const speckle = (x, w, h, cols, block, seed) => {
    const r = rng(seed);
    for (let y = 0; y < h; y += block) for (let i = 0; i < w; i += block) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(i, y, block, block); }
};
const dots = (x, w, h, cols, n, size, seed) => {
    const r = rng(seed);
    for (let i = 0; i < n; i++) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect((r() * w) | 0, (r() * h) | 0, size, size); }
};

// Periodic noise so panoramas wrap around without a seam.
const pnoise = (u, seed, oct = 5) => {
    let v = 0, a = 1, n = 0;
    for (let k = 1; k <= oct; k++) { v += Math.sin(u * Math.PI * 2 * (k * 2 + (seed % 3)) + seed * 1.7 + k * 2.3) * a; n += a; a *= 0.55; }
    return v / n;
};

export function surfaceTextures() {
    return {
        dirt: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#6e5c4a', '#78644f', '#665444', '#7e6a54'], 8, 11);
            x.globalAlpha = 0.45; x.fillStyle = '#463a2e';
            x.fillRect(12, 0, 10, 64); x.fillRect(42, 0, 10, 64);
            x.globalAlpha = 1;
            dots(x, w, h, ['#9a8a72', '#4a3c30'], 26, 2, 5);
        }),
        gravel: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#9a8a74', '#8a7a64', '#aa9a82', '#7a6a56'], 4, 13);
            dots(x, w, h, ['#d8ccb4', '#5a4c3e', '#bcae96'], 140, 2, 7);
        }),
        sand: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#c8844a', '#d8945a', '#b8743e', '#e0a46a', '#c0804a'], 4, 17);
            dots(x, w, h, ['#f0c08a', '#8a4a24'], 50, 2, 3);
        }),
        snow: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#e8eef6', '#dce6f0', '#f4f8fc', '#cdd8e6'], 4, 19);
            x.globalAlpha = 0.35; x.fillStyle = '#9aaac0';
            x.fillRect(12, 0, 8, 64); x.fillRect(44, 0, 8, 64);
            x.globalAlpha = 1;
        }),
        tarmac: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#4a4a50', '#525258', '#44444a', '#5a5a60'], 2, 23);
            x.fillStyle = '#d8d8c8'; x.fillRect(31, 0, 2, 24);
            dots(x, w, h, ['#6a6a70', '#38383c'], 60, 1, 9);
        }),
        grass: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#56663a', '#5e6e40', '#4e5e34', '#667846'], 4, 21);
            const r = rng(8); x.fillStyle = '#3c4826';
            for (let i = 0; i < 70; i++) x.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 3);
        }),
        verge: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#56663a', '#5e6e40', '#6e5c4a', '#78644f', '#4e5e34'], 4, 25);
        }),
        rock: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#4a4846', '#545250', '#42403e', '#5c5a56'], 8, 31);
            x.strokeStyle = 'rgba(20,18,18,0.75)'; x.lineWidth = 1;
            const r = rng(3);
            for (let i = 0; i < 9; i++) { const y = r() * 64; x.beginPath(); x.moveTo(0, y); x.lineTo(64, y + 10 - r() * 20); x.stroke(); }
        }),
        redrock: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#a04a2a', '#b85a32', '#8a3c22', '#c86a3a', '#7a321c'], 4, 33);
            x.fillStyle = 'rgba(60,20,10,0.5)';
            for (let y = 6; y < 64; y += 14) x.fillRect(0, y, 64, 2);
        }),
        concrete: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#5a5c60', '#626468', '#56585c', '#5e6064'], 8, 41);
            x.fillStyle = '#3a3c40'; x.fillRect(0, 31, 64, 1); x.fillRect(31, 0, 1, 64);
            dots(x, w, h, ['#6e7074', '#4a4c50'], 40, 1, 2);
        }),
        container: make(32, 32, (x) => {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 32);
            x.fillStyle = '#c8c8c8'; for (let i = 1; i < 32; i += 3) x.fillRect(i, 2, 1, 28);
            x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 32, 2); x.fillRect(0, 30, 32, 2);
        }),
        barrier: make(32, 8, (x) => {
            x.fillStyle = '#b8b8b4'; x.fillRect(0, 0, 32, 8);
            for (let i = 0; i < 32; i += 8) { x.fillStyle = '#e8c020'; x.fillRect(i, 1, 4, 3); x.fillStyle = '#1a1a1a'; x.fillRect(i + 4, 1, 4, 3); }
            x.fillStyle = '#8a8a86'; x.fillRect(0, 6, 32, 2);
        }, { mip: false }),
        pool: make(32, 32, (x, w, h) => {
            // a stylised light pool: three hard rings, brightest in the middle
            x.clearRect(0, 0, w, h);
            for (const [r, a] of [[15, 0.25], [11, 0.45], [6, 0.7]]) { x.fillStyle = `rgba(255,220,160,${a})`; x.beginPath(); x.arc(16, 16, r, 0, Math.PI * 2); x.fill(); }
        }, { mip: false, clampS: true, clampT: true }),
        cobble: make(64, 64, (x, w, h) => {
            x.fillStyle = '#2a2826'; x.fillRect(0, 0, w, h);
            const r = rng(51), cols = ['#6e6a64', '#7a766e', '#625e58', '#86827a', '#5a5650'];
            for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
                const ox = (row % 2) * 4;
                x.fillStyle = cols[(r() * cols.length) | 0];
                x.fillRect((col * 8 + ox) % 64 + 1, row * 8 + 1, 6, 6);
                x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect((col * 8 + ox) % 64 + 1, row * 8 + 1, 6, 1);
            }
        }),
        mud: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#4a3424', '#523a28', '#42301e', '#5a4230'], 8, 61);
            x.globalAlpha = 0.5; x.fillStyle = '#2e2014'; x.fillRect(12, 0, 10, 64); x.fillRect(42, 0, 10, 64); x.globalAlpha = 1;
            dots(x, w, h, ['#6a5238', '#3a2a1a', '#4a6a3a'], 40, 2, 4);
        }),
        jungle: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#1e4a24', '#26582a', '#1a3e20', '#2e6430', '#3a7034'], 4, 63);
            const r = rng(9); x.fillStyle = '#4a8a3a';
            for (let i = 0; i < 40; i++) x.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 3);
        }),
        stone: make(64, 64, (x, w, h) => {
            speckle(x, w, h, ['#6a6e5e', '#5e6254', '#767a68', '#52564a'], 8, 67);
            x.fillStyle = 'rgba(20,24,16,0.7)';
            for (let y = 0; y < 64; y += 16) { x.fillRect(0, y, 64, 1); for (let xx = (y / 16) % 2 * 8; xx < 64; xx += 16) x.fillRect(xx, y, 1, 16); }
            x.fillStyle = 'rgba(60,110,50,0.6)'; dots(x, w, h, ['#3a6a2e', '#4a7a36'], 50, 2, 5);
        }),
        tires: make(32, 16, (x) => {
            x.fillStyle = '#121214'; x.fillRect(0, 0, 32, 16);
            for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
                x.fillStyle = '#2a2a2e'; x.fillRect(i * 8 + 1, j * 8 + 1, 6, 6);
                x.fillStyle = '#0a0a0c'; x.fillRect(i * 8 + 3, j * 8 + 3, 2, 2);
                if ((i + j) % 3 === 0) { x.fillStyle = '#e8e8e8'; x.fillRect(i * 8 + 1, j * 8 + 1, 6, 1); }
            }
        }, { mip: false }),
        facade: make(32, 32, (x) => {
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 32);
            x.fillStyle = '#d8d0c4'; x.fillRect(0, 28, 32, 4);
            for (let fy = 0; fy < 2; fy++) for (let fx = 0; fx < 3; fx++) {
                const X = 3 + fx * 10, Y = 4 + fy * 12;
                x.fillStyle = '#3a4652'; x.fillRect(X, Y, 6, 8);
                x.fillStyle = '#ffd27a'; if ((fx + fy) % 3 === 1) x.fillRect(X + 1, Y + 1, 4, 6);
                x.fillStyle = '#ffffff'; x.fillRect(X + 2, Y, 1, 8);
                x.fillStyle = '#8a6a4a'; x.fillRect(X - 1, Y + 8, 8, 1);
            }
        }, { mip: false }),
        roof: make(16, 16, (x) => {
            for (let y = 0; y < 16; y += 4) for (let i = 0; i < 16; i += 4) { x.fillStyle = (i / 4 + y / 4) % 2 ? '#9a3a28' : '#b04a30'; x.fillRect(i + (y / 4 % 2) * 2, y, 4, 4); }
            x.fillStyle = '#6a2418'; for (let y = 3; y < 16; y += 4) x.fillRect(0, y, 16, 1);
        }, { mip: false }),
        crowd: make(32, 16, (x) => {
            x.fillStyle = '#1a1c22'; x.fillRect(0, 0, 32, 16);
            const r = rng(71), cols = ['#e8562a', '#3ad0ff', '#ffe23a', '#ffffff', '#ff3a6e', '#4aff7a', '#c8c8c8', '#f2c6a0'];
            for (let y = 1; y < 16; y += 4) for (let i = 0; i < 32; i += 2) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(i, y + (r() < 0.3 ? -1 : 0), 2, 2); x.fillStyle = '#f2c6a0'; x.fillRect(i, y - 1, 1, 1); }
        }, { mip: false }),
        windows: make(32, 64, (x) => {
            x.fillStyle = '#0c1018'; x.fillRect(0, 0, 32, 64);
            const r = rng(83), cols = ['#ffd27a', '#3ad0ff', '#ff3a6e', '#ffffff', '#b04aff'];
            for (let y = 2; y < 64; y += 4) for (let i = 2; i < 32; i += 4) if (r() < 0.22) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(i, y, 2, 2); }
        }, { mip: false }),
        post: make(8, 16, (x) => {
            for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#e8e8e8' : '#d8302a'; x.fillRect(0, i * 4, 8, 4); }
        }, { mip: false }),
        checker: make(32, 8, (x) => {
            for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111111' : '#f4f4f4'; x.fillRect(i * 2, j * 2, 2, 2); }
        }, { mip: false }),
        rail: make(16, 8, (x) => {
            x.fillStyle = '#b4b8c0'; x.fillRect(0, 0, 16, 8);
            x.fillStyle = '#8a8e96'; x.fillRect(0, 3, 16, 2);
            x.fillStyle = '#e4e8ee'; x.fillRect(0, 1, 16, 1);
        }, { mip: false }),
        shadow: make(16, 32, (x, w, h) => {
            const g = x.createRadialGradient(8, 16, 2, 8, 16, 15);
            g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = g; x.fillRect(0, 0, w, h);
        }, { mip: false, clampS: true, clampT: true })
    };
}

// Tree sprites: pines and leafy trees, with hard alpha so they cut out cleanly.
export function treeTexture(kind = 'pine', seed = 1) {
    return make(32, 64, (x) => {
        const r = rng(seed);
        x.fillStyle = '#4a2e1c'; x.fillRect(14, 48, 4, 16);
        if (kind === 'pine') {
            const cols = ['#26362a', '#2e4232', '#1e2c22', '#38503c'];
            for (let y = 2; y < 54; y += 2) {
                const half = 2 + ((y % 14) / 14) * 4 + (y / 54) * 9;
                for (let i = -half; i < half; i += 2) { x.fillStyle = cols[(r() * cols.length) | 0]; x.fillRect(16 + i, y, 2, 2); }
            }
        } else if (kind === 'snowpine') {
            const cols = ['#2a6a4a', '#3a7a5a', '#e8eef6', '#1e5234'];
            for (let y = 2; y < 54; y += 2) {
                const half = 2 + ((y % 14) / 14) * 4 + (y / 54) * 9;
                for (let i = -half; i < half; i += 2) { x.fillStyle = (y % 14 < 4 && r() < 0.7) ? '#f4f8fc' : cols[(r() * cols.length) | 0]; x.fillRect(16 + i, y, 2, 2); }
            }
        } else if (kind === 'palm') {
            x.fillStyle = '#5a3e26'; for (let y = 22; y < 64; y++) x.fillRect(15 + Math.round(Math.sin(y / 9) * 2), y, 3, 1);
            const cols = ['#2e6a2a', '#3a8030', '#245a22'];
            for (let f = 0; f < 7; f++) {
                const a = (f / 7) * Math.PI * 2;
                for (let k = 0; k < 14; k++) { x.fillStyle = cols[(f + k) % 3]; x.fillRect((16 + Math.cos(a) * k) | 0, (22 + Math.sin(a) * k * 0.6 + k * k * 0.04) | 0, 2, 2); }
            }
        } else if (kind === 'fern') {
            const cols = ['#2a6a2a', '#3a8a34', '#1e5222'];
            for (let f = 0; f < 9; f++) {
                const a = Math.PI + (f / 8) * Math.PI;
                for (let k = 0; k < 13; k++) { x.fillStyle = cols[(f + k) % 3]; x.fillRect((16 + Math.cos(a) * k * 1.1) | 0, (60 + Math.sin(a) * k * 1.6 + k * k * 0.06) | 0, 2, 2); }
            }
        } else if (kind === 'cactus') {
            x.clearRect(0, 0, 32, 64);
            x.fillStyle = '#3e7a3a'; x.fillRect(13, 14, 6, 50); x.fillRect(5, 26, 4, 14); x.fillRect(5, 36, 8, 4); x.fillRect(23, 20, 4, 14); x.fillRect(19, 30, 8, 4);
            x.fillStyle = '#5a9a4a'; x.fillRect(14, 14, 2, 50);
        } else {
            const cols = ['#3a4a2c', '#465a34', '#2c3a22', '#566c3e'];
            for (let i = 0; i < 220; i++) {
                const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 13;
                x.fillStyle = cols[(r() * cols.length) | 0];
                x.fillRect((16 + Math.cos(a) * d) | 0, (24 + Math.sin(a) * d * 1.3) | 0, 2, 2);
            }
        }
    }, { mip: false, clampS: true, clampT: true });
}

// A painted 360-degree skyline: sky gradient, far snowy peaks, nearer hills.
export function skyTexture(sky) {
    return make(512, 128, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, 100);
        g.addColorStop(0, sky.top); g.addColorStop(1, sky.horizon);
        x.fillStyle = g; x.fillRect(0, 0, w, h);
        if (sky.sun) { x.fillStyle = sky.sun; x.beginPath(); x.arc(sky.sunX || 380, sky.sunY || 40, 9, 0, Math.PI * 2); x.fill(); }
        const r = rng(sky.seed || 7);
        if (sky.clouds) {
            for (let i = 0; i < 12; i++) {
                const cx = r() * w, cy = 14 + r() * 36, n = 4 + ((r() * 4) | 0);
                for (const [col, dy] of [[sky.cloudsDark || sky.clouds, 2], [sky.clouds, 0]]) {
                    x.fillStyle = col;
                    for (let k = 0; k < n; k++) { x.beginPath(); x.arc(cx + k * 7 - n * 3.5, cy + dy - Math.sin(k / (n - 1) * Math.PI) * 6, 6 + Math.sin(k / (n - 1) * Math.PI) * 4, 0, Math.PI * 2); x.fill(); }
                }
            }
        }
        if (sky.kind === 'roofs') {
            // gabled rooftops, chimneys and a couple of church spires against the dusk
            let px = 0;
            while (px < w) {
                const bw = 10 + ((r() * 14) | 0), top = 70 + ((r() * 18) | 0), peak = 6 + ((r() * 6) | 0);
                x.fillStyle = r() < 0.5 ? sky.far : sky.far2;
                x.fillRect(px, top, bw, h - top);
                x.beginPath(); x.moveTo(px, top); x.lineTo(px + bw / 2, top - peak); x.lineTo(px + bw, top); x.fill();
                if (r() < 0.4) x.fillRect(px + bw * 0.7, top - peak, 2, peak);
                if (r() < 0.25) { x.fillStyle = sky.window; x.fillRect(px + 3, top + 6, 1, 1); x.fillRect(px + bw - 4, top + 9, 1, 1); }
                if (r() < 0.06) { x.fillStyle = sky.far; x.fillRect(px + bw / 2 - 2, top - 34, 4, 34); x.beginPath(); x.moveTo(px + bw / 2 - 3, top - 34); x.lineTo(px + bw / 2, top - 46); x.lineTo(px + bw / 2 + 3, top - 34); x.fill(); }
                px += bw;
            }
            x.fillStyle = sky.near; x.fillRect(0, 100, w, h - 100);
            return;
        }
        if (sky.kind === 'city') {
            // a port city: blocks of buildings with lit windows, and a few red aircraft lights
            let px = 0;
            while (px < w) {
                const bw = 6 + ((r() * 14) | 0), bh = 14 + ((r() * 40) | 0) * (r() < 0.15 ? 1.8 : 1);
                const top = 100 - bh;
                x.fillStyle = r() < 0.5 ? sky.far : sky.far2;
                x.fillRect(px, top, bw, h - top);
                for (let wy = top + 3; wy < 98; wy += 3) for (let wx = px + 1; wx < px + bw - 1; wx += 2) {
                    if (r() < 0.22) { x.fillStyle = r() < 0.8 ? sky.window : sky.window2; x.fillRect(wx, wy, 1, 1); }
                }
                if (bh > 40) { x.fillStyle = '#ff3a3a'; x.fillRect(px + (bw >> 1), top - 1, 1, 1); }
                px += bw + ((r() * 3) | 0);
            }
            x.fillStyle = sky.near; x.fillRect(0, 100, w, h - 100);
            return;
        }
        for (let px = 0; px < w; px++) {
            const u = px / w;
            if (sky.kind === 'mesas') {
                // flat-topped plateaus with steep sides
                const m = pnoise(u, sky.seed || 3, 3) * 0.5 + 0.5;
                const top = m > 0.55 ? 62 - (m - 0.55) * 40 : m > 0.4 ? 92 - (m - 0.4) * 200 : 94;
                for (let y = Math.max(0, top | 0); y < h; y++) {
                    const band = ((y - top) | 0) % 9 < 2;
                    x.fillStyle = band ? sky.far2 : sky.far;
                    x.fillRect(px, y, 1, 1);
                }
                const near = 100 - (pnoise(u, (sky.seed || 3) + 5, 4) * 0.5 + 0.5) * 8;
                for (let y = near | 0; y < h; y++) { x.fillStyle = sky.near; x.fillRect(px, y, 1, 1); }
                continue;
            }
            const ridge = 1 - Math.abs(pnoise(u, sky.seed || 3, 6));               // sharp peaks
            const far = 92 - (ridge * 0.8 + (pnoise(u * 2, (sky.seed || 3) + 2, 3) * 0.5 + 0.5) * 0.35) * (sky.peaks || 44);
            for (let y = far | 0; y < h; y++) {
                const snow = y < far + 4 + (far < 60 ? 10 : 0) + pnoise(u * 3, 9, 3) * 4;
                const shade = pnoise(u * 9, 4, 2) > 0.2;
                x.fillStyle = snow && sky.snow ? (shade ? sky.snow : sky.snow2 || sky.snow) : (shade ? sky.far2 || sky.far : sky.far);
                x.fillRect(px, y, 1, 1);
            }
            const near = 96 - (pnoise(u, (sky.seed || 3) + 5, 4) * 0.5 + 0.5) * 16;
            for (let y = near | 0; y < h; y++) { x.fillStyle = (px * 7 + y * 3) % 5 === 0 ? sky.near2 || sky.near : sky.near; x.fillRect(px, y, 1, 1); }
        }
    }, { mip: false, clampT: true });
}

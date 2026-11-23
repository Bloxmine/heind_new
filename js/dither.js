/* Ordered (Bayer) dithering to a fixed palette, plus helpers for dithered images and tiles. */
(() => {
    const S = window.SEA;

    const hexToRgb = (h) => {
        const n = parseInt(h.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    S.hexToRgb = hexToRgb;

    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

    // Builds a 32x32x32 lookup table from RGB to the nearest palette index.
    S.makePalette = (hexes) => {
        const cols = hexes.map(hexToRgb);
        const n = cols.length;
        const pr = new Uint8Array(n), pg = new Uint8Array(n), pb = new Uint8Array(n);
        cols.forEach((c, i) => { pr[i] = c[0]; pg[i] = c[1]; pb[i] = c[2]; });
        const lut = new Uint8Array(32768);
        for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
            const R = r * 8 + 4, G = g * 8 + 4, B = b * 8 + 4;
            let best = 0, bd = Infinity;
            for (let i = 0; i < n; i++) {
                const dr = R - pr[i], dg = G - pg[i], db = B - pb[i];
                const rm = (R + pr[i]) / 2;
                const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
                if (d < bd) { bd = d; best = i; }
            }
            lut[(r << 10) | (g << 5) | b] = best;
        }
        return { cols, pr, pg, pb, lut, hexes };
    };

    // The house palette: sky, sea from shallow to abyss, ship paint, skin, fish, bioluminescence.
    S.SEA_PAL = S.makePalette([
        '#000000', '#04070f', '#070d1c', '#0b1530', '#11214a', '#183268', '#1f4a8f', '#2a68b3', '#3b8fd4',
        '#5ab4e8', '#9fd8f5', '#dff4ff', '#ffffff',
        '#0e5f6e', '#1b8a99', '#2bb5c9', '#6fdde0', '#b5f1e8',
        '#fff1a6', '#ffd23f', '#ff9a1f', '#e8562a', '#b52a2a', '#6e1a2c',
        '#f2c6a0', '#c98a64', '#7a4b2e', '#3d2a1e', '#d9bd84',
        '#1e5234', '#3f9446', '#9bdc5a',
        '#2e2e3e', '#6b6b80', '#b4b4c4',
        '#ff4fd8', '#8a3cff'
    ]);

    // Dither ImageData in place. ox/oy shift the Bayer grid so it can stay anchored to the world while scrolling.
    S.dither = (img, pal = S.SEA_PAL, spread = 40, ox = 0, oy = 0) => {
        const d = img.data, w = img.width, h = img.height;
        const off = new Int16Array(16);
        for (let i = 0; i < 16; i++) off[i] = Math.round(((BAYER[i] + 0.5) / 16 - 0.5) * spread);
        const { lut, pr, pg, pb } = pal;
        let i = 0;
        for (let y = 0; y < h; y++) {
            const row = ((y + oy) & 3) << 2;
            for (let x = 0; x < w; x++, i += 4) {
                const o = off[row | ((x + ox) & 3)];
                let r = d[i] + o, g = d[i + 1] + o, b = d[i + 2] + o;
                r = r < 0 ? 0 : r > 255 ? 255 : r;
                g = g < 0 ? 0 : g > 255 ? 255 : g;
                b = b < 0 ? 0 : b > 255 ? 255 : b;
                const k = lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
                d[i] = pr[k]; d[i + 1] = pg[k]; d[i + 2] = pb[k]; d[i + 3] = 255;
            }
        }
        return img;
    };

    // Small contrast and saturation push so photos survive the palette.
    const punch = (img, contrast = 1.12, sat = 1.25) => {
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i + 1], b = d[i + 2];
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
            d[i] = (r - 128) * contrast + 128;
            d[i + 1] = (g - 128) * contrast + 128;
            d[i + 2] = (b - 128) * contrast + 128;
        }
    };

    // Load an image and return a dithered canvas, or null if the browser won't let us read it (file://).
    S.ditherImage = (src, width = 160, opts = {}) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = width;
            const h = Math.round(img.naturalHeight * w / img.naturalWidth);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.imageSmoothingEnabled = true;
            x.imageSmoothingQuality = 'high';
            x.drawImage(img, 0, 0, w, h);
            try {
                const id = x.getImageData(0, 0, w, h);
                punch(id, opts.contrast, opts.sat);
                S.dither(id, opts.pal || S.SEA_PAL, opts.spread || 52);
                x.putImageData(id, 0, 0);
                resolve(c);
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });

    // Draw a small tile, dither it, and return a data URL for CSS backgrounds.
    S.tile = (w, h, draw, spread = 48, pal = S.SEA_PAL) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        draw(x, w, h);
        if (spread) {
            const id = x.getImageData(0, 0, w, h);
            S.dither(id, pal, spread);
            x.putImageData(id, 0, 0);
        }
        return c.toDataURL('image/png');
    };

    // Seeded random so layouts don't jump around between reloads.
    S.rng = (seed) => {
        let s = (typeof seed === 'string' ? [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7) : seed) >>> 0 || 1;
        return () => {
            s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    };
})();

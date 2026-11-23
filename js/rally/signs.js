/* Road signs, placed from the track's own geometry: curve warnings before bends, chevron boards around
   the outside of corners, hairpin and crest warnings. Painted as small pixel textures. */
import * as THREE from 'three';
import { cel } from './retro.js';

const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};
const px = (x, pts, col) => { x.fillStyle = col; pts.forEach(([a, b, w = 1, h = 1]) => x.fillRect(a, b, w, h)); };

// chevron board: white arrows on red, pointing the way the road turns
const chevron = (dir) => tex(16, 12, (x) => {
    x.fillStyle = '#c8281e'; x.fillRect(0, 0, 16, 12);
    x.fillStyle = '#f2f2ee';
    for (const cx of [2, 8]) for (let r = 0; r < 10; r++) {
        const off = r < 5 ? r : 9 - r;
        const xx = dir > 0 ? cx + off : cx + 4 - off;
        x.fillRect(xx, r + 1, 3, 1);
    }
    x.strokeStyle = '#1a1a1a'; x.strokeRect(0.5, 0.5, 15, 11);
});
// warning triangle with a symbol
const warn = (draw) => tex(16, 16, (x) => {
    x.fillStyle = '#c8281e';
    x.beginPath(); x.moveTo(8, 0.5); x.lineTo(15.5, 14.5); x.lineTo(0.5, 14.5); x.closePath(); x.fill();
    x.fillStyle = '#f4f2ea';
    x.beginPath(); x.moveTo(8, 3.5); x.lineTo(13, 13); x.lineTo(3, 13); x.closePath(); x.fill();
    draw(x);
});
const curve = (dir) => warn((x) => {
    const m = (a) => (dir > 0 ? a : 15 - a);
    px(x, [[m(7), 11], [m(7), 10], [m(7), 9], [m(8), 8], [m(9), 7], [m(9), 6], [m(9), 5], [m(8), 6], [m(10), 6]], '#141414');
});
const hairpin = (dir) => warn((x) => {
    const m = (a) => (dir > 0 ? a : 15 - a);
    px(x, [[m(6), 11], [m(6), 10], [m(6), 9], [m(6), 8], [m(7), 7], [m(8), 7], [m(9), 8], [m(9), 9], [m(9), 10], [m(8), 9], [m(10), 9]], '#141414');
});
const crest = () => warn((x) => { px(x, [[5, 11, 6, 1], [6, 10, 4, 1], [7, 9, 2, 1], [7, 6, 2, 2]], '#141414'); });
const bang = () => warn((x) => { px(x, [[7, 6, 2, 4], [7, 11, 2, 1]], '#141414'); });

export function addSigns(track, group) {
    const { S, N } = track;
    const heading = S.map((s) => Math.atan2(s.tx, s.tz));
    const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    const at = (i) => S[(i % N + N) % N];
    const turn = S.map((s, i) => wrap(heading[(i + 8) % N] - heading[(i - 8 + N) % N]));   // over 32 m
    const T = { chevL: chevron(-1), chevR: chevron(1), curveL: curve(-1), curveR: curve(1), pinL: hairpin(-1), pinR: hairpin(1), crest: crest(), bang: bang() };
    const back = cel({ color: '#6a6e74' });
    const postM = cel({ color: '#8a8e94' });
    const boards = {};
    const boardMat = (k) => boards[k] || (boards[k] = [back, back, back, back, cel({ map: T[k], emissive: '#1a1410' }), back]);
    const postGeo = new THREE.BoxGeometry(0.08, 1, 0.08); postGeo.translate(0, 0.5, 0);
    let count = 0;

    // a board on a post, `side` 0 = right of the road, 1 = left, facing oncoming traffic
    function place(i, side, key, w, h, off, height) {
        const s = at(i), sg = side ? -1 : 1, hw = s.w / 2;
        const p = s.prof[side];
        const o = Math.min(off, p.drop ? hw + 1.5 : p.off[2] - 0.2);
        const gx = s.x + s.sx * o * sg, gz = s.z + s.sz * o * sg, gy = s.y + 0.1;
        const g = new THREE.Group();
        const post = new THREE.Mesh(postGeo, postM); post.scale.y = height; g.add(post);
        const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), boardMat(key));
        board.position.y = height + h / 2 - 0.05;
        g.add(board);
        g.position.set(gx, gy, gz);
        g.rotation.y = heading[(i % N + N) % N] + Math.PI;   // face the driver coming towards it
        group.add(g);
        count++;
    }

    // find corners: runs where the road turns hard
    const corners = [];
    let run = null;
    for (let i = 0; i < N; i++) {
        const k = Math.abs(turn[i]);
        if (k > 0.42) { if (!run) run = { a: i, b: i, max: k, dir: Math.sign(turn[i]) }; run.b = i; run.max = Math.max(run.max, k); }
        else if (run) { corners.push(run); run = null; }
    }
    if (run) corners.push(run);
    for (const c of corners) {
        // heading decreasing = turning right; the outside of a right-hander is the left side
        const right = c.dir < 0;
        const outside = right ? 1 : 0;
        const sharp = c.max > 0.95;
        const before = c.a - (sharp ? 40 : 32);
        place(before, 0, sharp ? (right ? 'pinR' : 'pinL') : (right ? 'curveR' : 'curveL'), 1.1, 1.1, S[0].w / 2 + 2.2, 1.6);
        if (sharp) place(before - 12, 0, 'bang', 1.0, 1.0, S[0].w / 2 + 2.2, 1.6);
        for (let i = c.a - 2; i <= c.b + 2; i += sharp ? 3 : 4) place(i, outside, right ? 'chevR' : 'chevL', 1.0, 0.75, S[0].w / 2 + 2.0, 0.85);
    }
    // crests: the road rises then falls sharply
    for (let i = 0; i < N; i += 2) {
        const y0 = at(i - 12).y, y1 = at(i).y, y2 = at(i + 12).y;
        if (y1 - (y0 + y2) / 2 > 1.1 && !corners.some((c) => i > c.a - 50 && i < c.b + 10)) {
            place(i - 30, 0, 'crest', 1.0, 1.0, S[0].w / 2 + 2.2, 1.6);
            i += 60;
        }
    }
    return count;
}

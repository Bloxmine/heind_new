/* Battle mode: arenas instead of tracks, three balloons each, power-ups pop them, last car standing wins.
   An arena answers the same query() a track does, so cars, power-ups and the camera all just work. */
import * as THREE from 'three';
import { cel, glows } from './retro.js';
import { rng, skyTexture, treeTexture } from './textures.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------- the arenas ---------- */
export const ARENAS = [
    {
        id: 'colosseum', name: 'COLOSSEUM', blurb: 'a ring of stone, pillars in the middle and a roaring crowd',
        shape: 'circle', R: 64, surface: 'dirt', floor: 'dirt', wall: 'stone', song: 'colosseum', weather: 'dry',
        sky: { top: '#3a5aa8', horizon: '#ffc890', far: '#8a7a6a', far2: '#7a6a5a', near: '#5a6a4a', near2: '#506040', clouds: '#fff0e0', cloudsDark: '#d8c0b0', peaks: 20, seed: 5 },
        fog: '#e8c8a8', fogNear: 140, fogFar: 520,
        light: { sun: '#ffe0b0', amb: '#a8a0b8', ground: '#5a4a3a', dir: [-0.5, 0.6, 0.4], disc: '#ffe8c0' },
        height: (x, z, r) => 6 * smooth(52, 64, r) ** 2,
        obstacles: () => [
            ...Array.from({ length: 6 }, (_, k) => ({ x: Math.cos(k / 6 * Math.PI * 2) * 17, z: Math.sin(k / 6 * Math.PI * 2) * 17, r: 2.2, h: 9, kind: 'pillar' })),
            { x: 0, z: 0, r: 5, h: 3, kind: 'statue' }
        ],
        ramps: () => Array.from({ length: 4 }, (_, k) => { const a = k / 4 * Math.PI * 2 + 0.4; return { x: Math.cos(a) * 36, z: Math.sin(a) * 36, ry: a + Math.PI / 2, len: 9, hw: 3, h: 2.8 }; }),
        items: () => [...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2 + 0.5; return [Math.cos(a) * 26, Math.sin(a) * 26]; }), ...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2; return [Math.cos(a) * 44, Math.sin(a) * 44]; })],
        props: ['stands', 'torches']
    },
    {
        id: 'yard', name: 'CONTAINER YARD', blurb: 'a maze of shipping containers on the docks, at night in the rain',
        shape: 'square', R: 64, surface: 'concrete', floor: 'concrete', wall: 'container', song: 'yard', weather: 'rain',
        sky: { kind: 'city', top: '#05070e', horizon: '#1a2a3a', far: '#0c1018', far2: '#121824', near: '#080a10', window: '#ffb347', window2: '#3ad0ff', seed: 9 },
        fog: '#141c26', fogNear: 50, fogFar: 260,
        light: { sun: '#8a9ab8', amb: '#4a5a7a', ground: '#14181e', dir: [0.3, 0.8, 0.2], disc: '#141c26' },
        height: () => 0,
        obstacles: () => {
            const r = rng(71), out = [];
            for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
                if ((gx === 0 && gz === 0) || r() < 0.25) continue;
                const along = r() < 0.5, x = gx * 23 + (r() - 0.5) * 4, z = gz * 23 + (r() - 0.5) * 4;
                out.push({ x, z, hw: along ? 6.2 : 1.3, hd: along ? 1.3 : 6.2, h: 2.6 * (1 + ((r() * 2) | 0)), kind: 'container' });
            }
            return out;
        },
        ramps: () => [{ x: 0, z: -12, ry: 0, len: 9, hw: 3, h: 2.6 }, { x: 0, z: 12, ry: Math.PI, len: 9, hw: 3, h: 2.6 }],
        items: () => [[0, 0], [-34, -34], [34, -34], [-34, 34], [34, 34], [-11, 0], [11, 0], [0, -34], [0, 34], [-34, 0], [34, 0]],
        props: ['floodlights', 'crane']
    },
    {
        // built for Stunt Park (tricks only), but it's a fine place to battle too
        id: 'stuntpark', name: 'STUNT PARK', blurb: 'kickers, a table-top and a mega ramp: big air, big tricks', stunt: true,
        shape: 'square', R: 72, surface: 'concrete', floor: 'concrete', wall: 'concrete', song: 'skate', weather: 'dry',
        sky: { top: '#3a7ad8', horizon: '#c8e0f4', far: '#8a9aa8', far2: '#7a8a98', near: '#5a7a5a', near2: '#4a6a4a', clouds: '#ffffff', cloudsDark: '#d8e0e8', peaks: 14, seed: 41 },
        fog: '#d0e0ec', fogNear: 160, fogFar: 620,
        light: { sun: '#fff4e0', amb: '#a8bcd8', ground: '#4a5a4a', dir: [-0.5, 0.75, 0.35], disc: '#fff8e0' },
        height: (x, z) => {
            // tall quarter-pipes all round, a table-top across the middle and a bowl in two corners
            const e = Math.max(Math.abs(x), Math.abs(z));
            let h = 9 * smooth(50, 72, e) ** 2;
            if (Math.abs(z) < 10) h += 4.5 * (1 - smooth(9, 24, Math.abs(x)));
            for (const [bx, bz, br] of [[-46, -46, 15], [46, 46, 15]]) { const d = Math.hypot(x - bx, z - bz); if (d < br) h -= 4.5 * (1 - (d / br) ** 2); }
            return h;
        },
        obstacles: () => [],
        ramps: () => [
            { x: -28, z: -26, ry: Math.PI / 4, len: 9, hw: 3.5, h: 4 }, { x: 28, z: 26, ry: -3 * Math.PI / 4, len: 9, hw: 3.5, h: 4 },
            { x: 28, z: -26, ry: -Math.PI / 4, len: 9, hw: 3.5, h: 4 }, { x: -28, z: 26, ry: 3 * Math.PI / 4, len: 9, hw: 3.5, h: 4 },
            { x: 0, z: -40, ry: Math.PI, len: 16, hw: 4.5, h: 7.5 }       // the mega ramp, launching out over the table-top
        ],
        items: () => [[0, 0], [-40, 0], [40, 0], [0, 30], [-20, -40], [20, -40]],
        props: ['graffiti', 'floodlights']
    },
    {
        id: 'skate', name: 'SKATE PARK', blurb: 'bowls, quarter-pipes and a funbox: get some air',
        shape: 'square', R: 58, surface: 'concrete', floor: 'concrete', wall: 'concrete', song: 'skate', weather: 'dry',
        sky: { top: '#2a6ac8', horizon: '#b8d8f0', far: '#7a8a9a', far2: '#6a7a8a', near: '#4a6a4a', near2: '#406040', clouds: '#ffffff', cloudsDark: '#d8e0e8', peaks: 16, seed: 13 },
        fog: '#c8d8e8', fogNear: 150, fogFar: 560,
        light: { sun: '#fff4e0', amb: '#a8bcd8', ground: '#4a5a4a', dir: [0.4, 0.7, -0.3], disc: '#fff8e0' },
        height: (x, z) => {
            // quarter-pipes round the edge, two bowls sunk in the floor, a funbox in the middle
            const e = Math.max(Math.abs(x), Math.abs(z));
            let h = 5.5 * smooth(44, 58, e) ** 2;
            for (const [bx, bz, br] of [[-28, -26, 14], [28, 24, 13]]) { const d = Math.hypot(x - bx, z - bz); if (d < br) h -= 4 * (1 - (d / br) ** 2); }
            const fb = Math.max(Math.abs(x) - 6, Math.abs(z) - 4);
            h += 2.6 * (1 - smooth(0, 7, fb));
            return h;
        },
        obstacles: () => [{ x: -30, z: 20, hw: 0.3, hd: 8, h: 1, kind: 'rail' }, { x: 30, z: -20, hw: 8, hd: 0.3, h: 1, kind: 'rail' }],
        ramps: () => [{ x: -18, z: 34, ry: Math.PI / 2, len: 8, hw: 3, h: 3 }, { x: 18, z: -34, ry: -Math.PI / 2, len: 8, hw: 3, h: 3 }],
        items: () => [[0, 0], [-28, -26], [28, 24], [-36, 30], [36, -30], [0, -40], [0, 40], [-40, 0], [40, 0], [16, 12], [-16, -12]],
        props: ['graffiti']
    },
    {
        id: 'crater', name: 'LAVA CRATER', blurb: 'basalt pillars round pools of lava: fall in and you lose a balloon',
        shape: 'circle', R: 66, surface: 'basalt', floor: 'basalt', wall: 'basalt', song: 'crater', weather: 'embers',
        sky: { top: '#1a0a0a', horizon: '#c8401a', far: '#2a1614', far2: '#3a1a14', near: '#1a0e0c', near2: '#2a1410', clouds: '#3a2220', cloudsDark: '#1e1210', peaks: 85, seed: 19 },
        fog: '#5a2418', fogNear: 80, fogFar: 380,
        light: { sun: '#ffb07a', amb: '#b0705a', ground: '#c83a10', dir: [0.2, 0.6, 0.6], disc: '#ff6a2a' },
        height: (x, z, r) => 14 * smooth(54, 66, r) ** 2,
        lava: [[0, 0, 7.5], [30, 10, 8], [-22, 24, 7], [-12, -30, 8]],
        obstacles: () => { const r = rng(83), out = []; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + r(), d = 18 + r() * 30; out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 1.6 + r() * 1.4, h: 4 + r() * 6, kind: 'basalt' }); } return out.filter((o) => Math.hypot(o.x - 30, o.z - 10) > 12 && Math.hypot(o.x + 22, o.z - 24) > 11 && Math.hypot(o.x + 12, o.z + 30) > 12); },
        ramps: () => [{ x: 18, z: -8, ry: 1.2, len: 9, hw: 3, h: 3 }, { x: -30, z: 4, ry: -0.6, len: 9, hw: 3, h: 3 }],
        items: () => [[14, 0], [-14, 0], [0, 16], [0, -16], [40, -20], [-40, -20], [40, 30], [-40, 40], [10, 44], [24, -38]],
        props: []
    },
    {
        id: 'rink', name: 'ICE RINK', blurb: 'a frozen rink with no grip at all, boards all the way round',
        shape: 'circle', R: 56, surface: 'ice', floor: 'ice', wall: 'barrier', song: 'rink', weather: 'snow',
        sky: { top: '#020814', horizon: '#0a2440', far: '#1a2a3a', far2: '#22344a', near: '#e8f0f8', near2: '#d4e2ee', snow: '#f4f8ff', peaks: 30, seed: 89, stars: true, aurora: true },
        fog: '#0e2034', fogNear: 120, fogFar: 460,
        light: { sun: '#9ad8ff', amb: '#8aa8c8', ground: '#2a3a4a', dir: [0.2, 0.8, -0.3], disc: '#c8f0ff' },
        height: () => 0,
        obstacles: () => [{ x: 0, z: 0, r: 3.2, h: 4, kind: 'snowman' }, { x: -24, z: 18, r: 2.4, h: 3, kind: 'snowman' }, { x: 26, z: -16, r: 2.4, h: 3, kind: 'snowman' }],
        ramps: () => [{ x: 0, z: 30, ry: Math.PI / 2, len: 9, hw: 3, h: 2.5 }, { x: 0, z: -30, ry: -Math.PI / 2, len: 9, hw: 3, h: 2.5 }],
        items: () => [[12, 0], [-12, 0], [0, 14], [0, -14], [30, 30], [-30, -30], [30, -34], [-34, 30], [40, 0], [-40, 0]],
        props: ['lights']
    }
];

/* ---------- building one ---------- */
export function buildArena(def, TX) {
    const group = new THREE.Group(), anim = [];
    const R = def.R, CR = 1.1;
    const obs = def.obstacles().map((o) => (o.hw ? Object.assign({ c: 1, s: 0 }, o) : o));
    const ramps = def.ramps().map((r) => Object.assign({}, r, { tx: Math.sin(r.ry), tz: Math.cos(r.ry), c: Math.cos(r.ry), s: -Math.sin(r.ry), y0: 0 }));
    const lava = def.lava || [];
    const inLava = (x, z) => lava.some(([lx, lz, lr]) => (x - lx) ** 2 + (z - lz) ** 2 < lr * lr);
    const baseH = (x, z) => def.height(x, z, Math.hypot(x, z));
    ramps.forEach((r) => { r.y0 = baseH(r.x, r.z); });
    const rampY = (x, z) => {
        let y = -Infinity;
        for (const r of ramps) {
            const dx = x - r.x, dz = z - r.z;
            const along = dx * r.tx + dz * r.tz + r.len / 2, across = dx * r.c + dz * r.s;
            if (along < 0 || along > r.len || Math.abs(across) > r.hw) continue;
            y = Math.max(y, r.y0 + r.h * along / r.len);
        }
        return y;
    };
    const floorH = (x, z) => (inLava(x, z) ? -9 : baseH(x, z));

    /* the floor */
    const span = def.shape === 'circle' ? R * 2 + 16 : R * 2 + 4, segs = 110;
    const g = new THREE.PlaneGeometry(span, span, segs, segs); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, floorH(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const tex = TX[def.floor].clone(); tex.repeat.set(span / 6, span / 6); tex.needsUpdate = true;
    group.add(new THREE.Mesh(g, cel({ map: tex }, false)));
    // lava glows down in its pits
    for (const [lx, lz, lr] of lava) {
        const lt = TX.lava.clone(); lt.repeat.set(2, 2); lt.needsUpdate = true;
        const m = new THREE.Mesh(new THREE.CircleGeometry(lr + 0.6, 24), cel({ map: lt, emissive: '#ffffff', emissiveMap: lt, emissiveIntensity: 0.9 }, false));
        m.rotation.x = -Math.PI / 2; m.position.set(lx, -1.2, lz); glows(m);
        group.add(m);
        anim.push((t) => { lt.offset.set(t * 0.05, t * 0.03); });
    }
    /* the outer wall */
    const wallTex = TX[def.wall] || TX.concrete;
    if (def.shape === 'circle') {
        const wt = wallTex.clone(); wt.repeat.set(24, 1); wt.needsUpdate = true;
        const top = def.height(R, 0, R);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 4, 64, 1, true), cel({ map: wt, side: THREE.DoubleSide }));
        w.position.y = top + 1.4; group.add(w);
    } else {
        const wt = wallTex.clone(); wt.repeat.set(10, 1); wt.needsUpdate = true;
        const top = def.height(R, 0, R);
        for (const [x, z, ry] of [[R + 0.6, 0, 0], [-R - 0.6, 0, 0], [0, R + 0.6, Math.PI / 2], [0, -R - 0.6, Math.PI / 2]]) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, R * 2 + 2.4), cel({ map: wt })); w.position.set(x, top + 1.4, z); w.rotation.y = ry; group.add(w);
        }
    }
    /* obstacles */
    const COL = { pillar: '#d8c8a8', statue: '#c8b898', container: null, rail: '#c8c8d0', basalt: '#3a3230', snowman: '#f4f8ff' };
    const ccols = ['#a8402a', '#2a5a8a', '#3a7a4a', '#c8a028', '#7a7e86', '#6a3a6a', '#c86a2a'];
    obs.forEach((o, k) => {
        const y = baseH(o.x, o.z);
        let m;
        if (o.kind === 'container') m = new THREE.Mesh(new THREE.BoxGeometry(o.hw * 2, o.h, o.hd * 2), cel({ map: TX.container, color: ccols[k % ccols.length] }));
        else if (o.kind === 'snowman') {
            m = new THREE.Group();
            for (const [rr, yy] of [[o.r, o.r * 0.8], [o.r * 0.7, o.r * 2], [o.r * 0.45, o.r * 2.9]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(rr, 12, 8), cel({ color: '#f4f8ff' })); s.position.y = yy; m.add(s); }
            const nose = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 6), cel({ color: '#ff7a1a' })); nose.rotation.x = Math.PI / 2; nose.position.set(0, o.r * 2.9, o.r * 0.5); m.add(nose);
            m.position.set(o.x, y, o.z); group.add(m); return;
        }
        else if (o.hw) m = new THREE.Mesh(new THREE.BoxGeometry(o.hw * 2, o.h, o.hd * 2), cel({ color: COL[o.kind] || '#8a8a8a' }));
        else m = new THREE.Mesh(new THREE.CylinderGeometry(o.r * (o.kind === 'basalt' ? 0.8 : 1), o.r, o.h, o.kind === 'basalt' ? 6 : 12), cel({ map: o.kind === 'basalt' ? TX.basalt : TX.stone || null, color: COL[o.kind] }));
        m.position.set(o.x, y + o.h / 2, o.z);
        group.add(m);
        if (o.kind === 'pillar') { const cap = new THREE.Mesh(new THREE.BoxGeometry(o.r * 2.6, 0.8, o.r * 2.6), cel({ color: '#c8b898' })); cap.position.set(o.x, y + o.h + 0.4, o.z); group.add(cap); }
    });
    /* ramps */
    {
        const wedge = new THREE.BufferGeometry(), v = [-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 1, 0.5, 1, 1, -0.5, 0, 1, 0.5, 0, 1];
        wedge.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); wedge.setIndex([0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5]); wedge.computeVertexNormals();
        const rm = cel({ color: '#ffd23f', side: THREE.DoubleSide });
        for (const r of ramps) {
            const m = new THREE.Mesh(wedge, rm); m.scale.set(r.hw * 2, r.h, r.len);
            m.position.set(r.x - r.tx * r.len / 2, r.y0 - 0.05, r.z - r.tz * r.len / 2); m.rotation.y = r.ry;
            group.add(m);
        }
    }
    /* scenery round the edge */
    if (def.props.includes('stands')) {
        const crowd = TX.crowd.clone(); crowd.repeat.set(30, 1); crowd.needsUpdate = true;
        for (let k = 0; k < 4; k++) {
            const st = new THREE.Mesh(new THREE.CylinderGeometry(R + 6 + k * 4, R + 6 + k * 4, 3, 64, 1, true), cel({ map: crowd, side: THREE.DoubleSide }));
            st.position.y = 7 + k * 3; group.add(st);
        }
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 24, R + 24, 22, 48, 1, true), cel({ map: TX.stone || TX.concrete, side: THREE.DoubleSide, color: '#d8c8a8' })); ring.position.y = 11; group.add(ring);
    }
    if (def.props.includes('torches') || def.props.includes('lights') || def.props.includes('floodlights')) {
        const n = def.props.includes('floodlights') ? 8 : 16, col = def.props.includes('torches') ? '#ff9a3a' : def.props.includes('lights') ? '#9ad8ff' : '#ffe2a8';
        const tall = def.props.includes('floodlights') ? 16 : 5;
        for (let k = 0; k < n; k++) {
            const a = k / n * Math.PI * 2, x = def.shape === 'circle' ? Math.cos(a) * (R + 1.5) : clamp(Math.cos(a) * R * 1.5, -R - 1.5, R + 1.5), z = def.shape === 'circle' ? Math.sin(a) * (R + 1.5) : clamp(Math.sin(a) * R * 1.5, -R - 1.5, R + 1.5);
            const y = def.height(R, 0, R);
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, tall, 0.4), cel({ color: '#3a3e44' })); pole.position.set(x, y + tall / 2, z); group.add(pole);
            const lamp = glows(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), new THREE.MeshBasicMaterial({ color: col, fog: false }))); lamp.position.set(x, y + tall + 0.4, z); group.add(lamp);
        }
    }
    if (def.props.includes('crane')) {
        const steel = cel({ color: '#c8902a' }), cg = new THREE.Group();
        for (const [lx, lz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 30, 0.9), steel); leg.position.set(lx, 15, lz); cg.add(leg); }
        const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 60), steel); boom.position.set(0, 31, 10); cg.add(boom);
        cg.position.set(R + 14, 0, -20); group.add(cg);
    }
    if (def.props.includes('graffiti')) {
        const words = ['RIOT', 'SKATE', 'GO!', 'WOW', 'ZOOM', 'POW'], cols = ['#ff3a6e', '#3ad0ff', '#ffd23f', '#4aff7a', '#b04aff', '#ff9a3a'];
        words.forEach((w, k) => {
            const c = document.createElement('canvas'); c.width = 64; c.height = 24; const x = c.getContext('2d');
            x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 4; x.strokeStyle = '#111'; x.strokeText(w, 32, 13); x.fillStyle = cols[k]; x.fillText(w, 32, 13);
            const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
            const side = k % 4, off = -R + 12 + (k * 19) % (R * 2 - 24);
            const top = def.height(R, 0, R);
            if (side === 0) { m.position.set(off, top + 2, -R + 0.1); } else if (side === 1) { m.position.set(R - 0.1, top + 2, off); m.rotation.y = -Math.PI / 2; }
            else if (side === 2) { m.position.set(off, top + 2, R - 0.1); m.rotation.y = Math.PI; } else { m.position.set(-R + 0.1, top + 2, off); m.rotation.y = Math.PI / 2; }
            group.add(m);
        });
        const trees = treeTexture('leaf', 3), q1 = new THREE.PlaneGeometry(6, 10); q1.translate(0, 5, 0);
        for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, d = R + 10 + (k % 3) * 6; const m = new THREE.Mesh(q1, cel({ map: trees, alphaTest: 0.5, side: THREE.DoubleSide })); m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); m.rotation.y = a; group.add(m); }
    }
    /* a ground plane well beyond the walls, and the sky */
    const out = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), cel({ map: Object.assign(TX[def.floor].clone(), { repeat: new THREE.Vector2(400, 400), needsUpdate: true }) }, false));
    out.rotation.x = -Math.PI / 2; out.position.y = def.shape === 'circle' ? def.height(R, 0, R) - 0.2 : -0.6; group.add(out);
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(900, 900, 340, 48, 1, true), new THREE.MeshBasicMaterial({ map: skyTexture(def.sky), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; group.add(sky);

    /* spawn points round the edge, facing the middle */
    const S = Array.from({ length: 16 }, (_, k) => {
        const a = k / 16 * Math.PI * 2, d = R * 0.72, x = Math.cos(a) * d, z = Math.sin(a) * d;
        const tx = -Math.cos(a), tz = -Math.sin(a);
        return { x, z, y: baseH(x, z), tx, tz, sx: -tz, sz: tx, w: 10 };
    });
    const itemSpots = def.items().map(([x, z]) => ({ x, z, y: Math.max(baseH(x, z), rampY(x, z)) }));

    /* the physics query */
    function query(x, z) {
        let y = floorH(x, z), surface = inLava(x, z) ? 'lava' : def.surface;
        const ry = rampY(x, z);
        if (ry > y) { y = ry; surface = 'concrete'; }
        let best = 0, bd = Infinity;
        for (let k = 0; k < S.length; k++) { const d = (S[k].x - x) ** 2 + (S[k].z - z) ** 2; if (d < bd) { bd = d; best = k; } }
        const s = S[best];
        const q = { i: best, t: 0, prog: 0, y, surface, tx: s.tx, tz: s.tz, sx: s.sx, sz: s.sz, cx: s.x, cz: s.z, cy: s.y, side: 0, d: 0, ad: 0, wall: 1e9, lava: surface === 'lava' };
        // the outer wall, then anything standing in the arena
        let pen = 0, nx = 0, nz = 0;
        if (def.shape === 'circle') { const r = Math.hypot(x, z), lim = R - CR; if (r > lim) { pen = r - lim; nx = -x / r; nz = -z / r; } }
        else {
            const ex = Math.abs(x) - (R - CR), ez = Math.abs(z) - (R - CR);
            if (ex > 0 && ex >= ez) { pen = ex; nx = -Math.sign(x); nz = 0; } else if (ez > 0) { pen = ez; nx = 0; nz = -Math.sign(z); }
        }
        for (const o of obs) {
            const dx = x - o.x, dz = z - o.z;
            if (o.hw) {
                const eu = o.hw + CR - Math.abs(dx), ev = o.hd + CR - Math.abs(dz);
                if (eu <= 0 || ev <= 0) continue;
                if (eu < ev) { if (eu > pen) { pen = eu; nx = Math.sign(dx) || 1; nz = 0; } } else if (ev > pen) { pen = ev; nx = 0; nz = Math.sign(dz) || 1; }
            } else {
                const rr = o.r + CR, d2 = dx * dx + dz * dz;
                if (d2 >= rr * rr) continue;
                const d = Math.sqrt(d2) || 0.01;
                if (rr - d > pen) { pen = rr - d; nx = dx / d; nz = dz / d; }
            }
        }
        if (pen > 0) { q.d = pen; q.ad = pen; q.wall = 0; q.sx = -nx; q.sz = -nz; }
        return q;
    }
    // line of sight for the bots: is anything solid between here and there?
    function blocked(x0, z0, x1, z1) {
        for (let k = 1; k < 8; k++) { const f = k / 8, q = query(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f); if (q.wall === 0) return true; }
        return false;
    }
    // the minimap picture
    const mapC = document.createElement('canvas'); mapC.width = mapC.height = 64;
    {
        const x = mapC.getContext('2d'), sc = 28 / R, M = (wx, wz) => [32 - wx * sc, 32 - wz * sc];
        x.fillStyle = '#04070f'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#2a3442'; x.strokeStyle = '#dff4ff'; x.lineWidth = 2;
        x.beginPath(); if (def.shape === 'circle') x.arc(32, 32, R * sc, 0, Math.PI * 2); else x.rect(32 - R * sc, 32 - R * sc, R * 2 * sc, R * 2 * sc); x.fill(); x.stroke();
        x.fillStyle = '#ff6a2a'; for (const [lx, lz, lr] of lava) { const [px, py] = M(lx, lz); x.beginPath(); x.arc(px, py, lr * sc, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = '#8a96a4'; for (const o of obs) { const [px, py] = M(o.x, o.z); if (o.hw) x.fillRect(px - o.hw * sc, py - o.hd * sc, o.hw * 2 * sc, o.hd * 2 * sc); else { x.beginPath(); x.arc(px, py, Math.max(1, o.r * sc), 0, Math.PI * 2); x.fill(); } }
        x.fillStyle = '#ffd23f'; for (const r of ramps) { const [px, py] = M(r.x, r.z); x.fillRect(px - 1, py - 1, 3, 3); }
    }
    const arena = {
        isArena: true, def: Object.assign({ id: def.id, name: def.name, song: def.song, headlights: def.weather === 'rain' || def.id === 'rink' || def.id === 'yard' ? 1 : 0.3, rain: def.weather === 'rain', weatherName: def.weather, sky: def.sky, light: def.light, fog: def.fog, fogNear: def.fogNear, fogFar: def.fogFar, flakes: { rain: 'rain', snow: 'snow', embers: 'embers' }[def.weather] || null }),
        group, sky, S, N: S.length, seg: 2, query, blocked, itemSpots, noItems: ['storm'], mapC, R,
        gridSlot: (n) => { const s = S[(n * 2) % S.length]; return { x: s.x, y: s.y, z: s.z, heading: Math.atan2(s.tx, s.tz), i: (n * 2) % S.length }; },
        animate: (t) => anim.forEach((f) => f(t)),
        drawMap(mx, cars, car) {
            mx.clearRect(0, 0, 64, 64); mx.drawImage(mapC, 0, 0);
            const sc = 28 / R;
            for (const c of cars) {
                if (c.out) continue;
                const px = Math.round(32 - c.x * sc), py = Math.round(32 - c.z * sc);
                mx.fillStyle = '#04070f'; mx.fillRect(px - 2, py - 2, 5, 5);
                mx.fillStyle = c === car ? '#ffe23a' : '#ff3a6e'; mx.fillRect(px - 1, py - 1, 3, 3);
            }
        }
    };
    return arena;
}

/* ---------- the rules and the bots ---------- */
const BALLOON = ['#ff3a6e', '#3ad0ff', '#ffd23f', '#4aff7a', '#b04aff', '#ff9a3a'];
const TAU = Math.PI * 2;
const wrapPi = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
/* rule: 'balloons' (the battle), 'potato' (pass the bomb by bumping; whoever holds it when the fuse runs out is out)
   or 'stunt' (on your own, tricks for points against the clock). */
export class Battle {
    constructor(arena, api, rule = 'balloons') {
        this.a = arena; this.api = api; this.rule = rule;
        this.time = rule === 'stunt' ? 120 : rule === 'potato' ? 1e9 : 180; this.over = false; this.order = [];
        api.cars.forEach((c, k) => this.join(c, k));
        if (rule === 'potato') this.newRound();
        if (rule === 'stunt') { this.score = 0; this.combo = 0; this.comboT = 0; this.best = 0; api.car.stunt = true; }
    }
    join(c, k) {
        c.balloons = this.rule === 'balloons' ? 3 : 0; c.pops = 0; c.out = false; c.bInv = 0;
        const col = BALLOON[k % BALLOON.length];
        c.balloonM = [];
        for (let b = 0; b < (this.rule === 'balloons' ? 3 : 0); b++) {
            const g = new THREE.Group();
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), cel({ color: col, emissive: col, emissiveIntensity: 0.3 }));
            ball.scale.y = 1.2; ball.position.y = 0.5; g.add(ball);
            const str = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.03), new THREE.MeshBasicMaterial({ color: '#e8e8e8' })); str.position.y = 0.05; g.add(str);
            g.position.set((b - 1) * 0.55, 2.3, -0.4);
            c.mesh.root.add(g); c.balloonM.push(g);
        }
        if (!c.isPlayer) c.bot = { target: null, retarget: 0, stuck: 0, back: 0, fireT: 1 + Math.random() };
    }
    alive() { return this.api.cars.filter((c) => !c.out); }
    // a balloon gone: from a hit, a wreck or a fall into lava
    pop(c, by, why) {
        if (this.rule !== 'balloons') return;
        if (this.over || c.out || c.bInv > 0) return;
        c.bInv = 1.6;
        c.balloons--;
        const m = c.balloonM[c.balloons]; if (m) { this.api.fx.boom(c.x, c.y + 2.4, c.z, m.children[0].material.color.getStyle(), 0.4); m.visible = false; }
        this.api.audio.fx('pickup');
        if (by && by !== c && !by.out) { by.pops++; if (by.isPlayer) this.api.earn('Balloon Popped', 40); }
        if (c.isPlayer) this.api.message(why === 'lava' ? 'INTO THE LAVA!' : c.balloons ? `${c.balloons} LEFT` : 'OUT!', 1.6, true);
        if (c.balloons <= 0) this.eliminate(c, by);
    }
    eliminate(c, by) {
        c.out = true; this.order.unshift(c);
        this.api.fx.boom(c.x, c.y + 1, c.z, '#ffffff', 1.2);
        c.mesh.root.visible = false; c.wrecked = 1e9;
        if (!c.isPlayer) c.x = c.z = 9999;
        if (by && by.isPlayer) this.api.message(`${this.api.nameOf(c).toUpperCase()} IS OUT!`, 1.8);
        const left = this.alive();
        if (left.length <= 1 || c.isPlayer) this.finish();
    }
    finish() {
        if (this.over) return;
        this.over = true;
        if (this.bombM) this.bombM.parent && this.bombM.parent.remove(this.bombM);
        if (this.rule === 'stunt') {
            this.order = [this.api.car];
            this.api.message(`SCORE ${this.score.toLocaleString('en')}`, 3);
            this.api.earn('Stunt Show', Math.round(this.score / 40));
            this.api.done(this.order);
            return;
        }
        const left = this.alive().sort((a, b) => b.balloons - a.balloons || b.pops - a.pops);
        this.order = [...left, ...this.order];
        const win = this.order[0];
        this.api.message(win.isPlayer ? (this.rule === 'potato' ? 'LAST ONE STANDING!' : 'YOU WIN THE BATTLE!') : `${this.api.nameOf(win).toUpperCase()} WINS`, 3, !win.isPlayer);
        if (win.isPlayer) this.api.earn(this.rule === 'potato' ? 'Hot Potato Won' : 'Battle Won', 300);
        this.api.done(this.order);
    }
    /* ---- hot potato ---- */
    newRound() {
        const alive = this.alive();
        if (alive.length <= 1) { this.finish(); return; }
        this.fuse = 9 + alive.length * 2; this.passCool = 1.5; this.tick = Math.ceil(this.fuse);
        this.give(alive[(Math.random() * alive.length) | 0], null);
    }
    give(c, from) {
        this.holder = c;
        if (!this.bombM) {
            const g = new THREE.Group();
            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), cel({ color: '#1a1a22' }));
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 8), cel({ color: '#6b6b80' })); cap.position.y = 0.6;
            this.spark = glows(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffb84a' }))); this.spark.position.y = 0.85;
            g.add(ball, cap, this.spark);
            this.bombM = g;
        }
        c.mesh.root.add(this.bombM); this.bombM.position.set(0, 2.5, -0.3);
        this.api.audio.fx('pickup');
        if (c.isPlayer) this.api.message('YOU HAVE THE BOMB!', 1.4, true);
        else if (from && from.isPlayer) { this.api.message('PASSED IT ON!', 1.2); this.api.earn('Bomb Passed', 30); }
        else if (!from) this.api.message(`${this.api.nameOf(c).toUpperCase()} HAS THE BOMB`, 1.4);
    }
    // two cars touched (from main.js's collisions): the bomb jumps across
    touch(a, b) {
        if (this.rule !== 'potato' || this.over || this.passCool > 0) return;
        const h = this.holder;
        if (a !== h && b !== h) return;
        const o = a === h ? b : a;
        if (o.out) return;
        this.passCool = 1.2;
        this.give(o, h);
    }
    /* ---- stunts: car.js reports each landing in car.stuntLand ---- */
    landed(L) {
        const turns = (a, k = 0.6) => Math.floor((Math.abs(a) + k) / TAU);
        const spins = turns(L.yaw, 0.9), flips = turns(L.pitch), rolls = turns(L.roll);
        const parts = [];
        if (spins) parts.push(`${spins * 360}`);
        if (flips) parts.push(`${flips > 1 ? flips + 'x ' : ''}${L.pitch > 0 ? 'BACKFLIP' : 'FRONTFLIP'}`);
        if (rolls) parts.push(`${rolls > 1 ? rolls + 'x ' : ''}BARREL ROLL`);
        if (L.air > 1.6) parts.push('BIG AIR');
        if (!L.clean) { if (L.air > 0.4) { this.api.message('BAILED!', 1.2, true); this.api.audio.fx('hit'); } this.combo = 0; this.comboT = 0; return; }
        if (L.air < 0.5 && !parts.length) return;
        let pts = Math.round(L.air * 120) + spins * 400 + flips * 900 + rolls * 700;
        this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 3;
        pts *= this.combo;
        this.score += pts;
        this.api.message(`${parts.join(' + ') || 'AIR'}  +${pts.toLocaleString('en')}${this.combo > 1 ? ` ×${this.combo}` : ''}`, 1.5);
        this.api.audio.beep(660 + Math.min(6, this.combo) * 110, 0.12);
    }
    frame(dt) {
        if (this.over) return;
        this.time -= dt;
        if (this.rule === 'potato') {
            this.passCool -= dt; this.fuse -= dt;
            if (this.spark) { const k = 0.7 + Math.random() * 0.6; this.spark.scale.setScalar(k); this.spark.material.color.set(this.fuse < 4 ? '#ff3a3a' : '#ffb84a'); }
            if (this.fuse < this.tick - 1 && this.fuse > 0) { this.tick = Math.ceil(this.fuse); if (this.fuse < 6) this.api.audio.beep(this.fuse < 3 ? 1200 : 900, 0.06); }
            if (this.fuse <= 0) {
                const h = this.holder;
                this.api.fx.boom(h.x, h.y + 1.5, h.z, '#ff9a3a', 1.6);
                this.api.audio.fx('wreck');
                if (this.bombM.parent) this.bombM.parent.remove(this.bombM);
                this.eliminate(h, null);
                if (!this.over) this.newRound();
            }
        }
        if (this.rule === 'stunt') {
            const c = this.api.car;
            if (c.stuntLand) { const L = c.stuntLand; c.stuntLand = null; this.landed(L); }
            this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
        }
        for (const c of this.api.cars) {
            if (c.out) continue;
            c.bInv = Math.max(0, c.bInv - dt);
            c.balloonM.forEach((g, k) => { g.position.y = 2.3 + Math.sin(performance.now() / 300 + k * 2) * 0.12; g.rotation.z = Math.sin(performance.now() / 500 + k) * 0.15; });
            if (c.q && c.q.lava && c.y < -0.6) { this.pop(c, null, 'lava'); if (!c.out) this.api.reset(c); }
        }
        if (this.time <= 0) { this.time = 0; this.finish(); }
    }
    // the bots: hunt the nearest rival they can see, grab a box when they have nothing, shoot when lined up
    drive(c, dt) {
        const b = c.bot, A = this.a, cars = this.api.cars;
        b.retarget -= dt; b.fireT -= dt;
        if (b.back > 0) { b.back -= dt; return { steer: b.backSteer, throttle: 0, brake: 1, handbrake: false }; }
        if (this.rule === 'potato') {
            // with the bomb: ram whoever's nearest. Without it: keep away from whoever has it
            const h = this.holder;
            if (h === c) {
                let best = null, bd = Infinity;
                for (const o of cars) { if (o === c || o.out) continue; const d = Math.hypot(o.x - c.x, o.z - c.z); if (d < bd) { bd = d; best = o; } }
                b.target = best ? { x: best.x + best.vx * 0.4, z: best.z + best.vz * 0.4 } : { x: 0, z: 0 };
            } else if (h && Math.hypot(h.x - c.x, h.z - c.z) < 40) {
                const dx = c.x - h.x, dz = c.z - h.z, d = Math.hypot(dx, dz) || 1, R = A.def.R * 0.6;
                b.target = { x: clamp(c.x + dx / d * 25, -R, R), z: clamp(c.z + dz / d * 25, -R, R) };
            } else if (b.retarget <= 0 || !b.target) { b.retarget = 2; b.target = { x: (Math.random() - 0.5) * A.def.R, z: (Math.random() - 0.5) * A.def.R }; }
        } else if (b.retarget <= 0 || !b.target || (b.target.car && b.target.car.out)) {
            b.retarget = 1 + Math.random();
            const foes = cars.filter((o) => o !== c && !o.out);
            let best = null, bd = Infinity;
            for (const o of foes) { const d = Math.hypot(o.x - c.x, o.z - c.z) * (o.isPlayer ? 0.8 : 1); if (d < bd) { bd = d; best = o; } }
            if (!c.slots.length && this.api.items) {
                let ib = null, id = Infinity;
                for (const p of this.api.items()) { if (p.off > 0) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < id) { id = d; ib = p; } }
                if (ib && id < 60) { b.target = { x: ib.x, z: ib.z }; return this.drive(c, 0); }
            }
            b.target = best ? { car: best } : { x: 0, z: 0 };
        }
        const tg = b.target.car || b.target, tx = tg.x, tz = tg.z;
        const want = Math.atan2(tx - c.x, tz - c.z);
        let d = angDiff(want, c.h);
        // feel ahead for walls and steer round them
        const fx = Math.sin(c.h), fz = Math.cos(c.h), look = 6 + c.speed * 0.5;
        if (A.query(c.x + fx * look, c.z + fz * look).wall === 0) {
            const l = A.query(c.x + Math.sin(c.h + 0.7) * look, c.z + Math.cos(c.h + 0.7) * look).wall === 0;
            const r = A.query(c.x + Math.sin(c.h - 0.7) * look, c.z + Math.cos(c.h - 0.7) * look).wall === 0;
            d += !l ? 0.9 : !r ? -0.9 : 1.6;
        }
        // stuck against something: back out
        b.stuck = c.speed < 2 ? b.stuck + dt : 0;
        if (b.stuck > 1.2) { b.stuck = 0; b.back = 0.9; b.backSteer = Math.random() < 0.5 ? -1 : 1; }
        // fire when lined up
        if (this.rule === 'balloons' && c.slots.length && b.fireT <= 0) {
            const s = c.slots[0].type;
            const o = b.target.car;
            const dist = o ? Math.hypot(o.x - c.x, o.z - c.z) : 999, ang = Math.abs(d);
            const behind = cars.some((e) => e !== c && !e.out && Math.hypot(e.x - c.x, e.z - c.z) < 14 && Math.abs(angDiff(Math.atan2(e.x - c.x, e.z - c.z), c.h)) > 2.4);
            let shoot = false, back = false;
            if (['barrier', 'patch', 'nitro'].includes(s)) shoot = true;
            else if (s === 'pulse') shoot = cars.some((e) => e !== c && !e.out && Math.hypot(e.x - c.x, e.z - c.z) < 13);
            else if (s === 'mine') { shoot = behind; back = true; }
            else if (o && !o.out) shoot = (s === 'seeker' ? dist < 70 : dist < 40 && ang < 0.3) && !A.blocked(c.x, c.z, o.x, o.z);
            if (shoot) { this.api.fire(c, back); b.fireT = 0.8 + Math.random(); }
        }
        const sharp = Math.abs(d) > 1.4;
        return { steer: clamp(-d * 2.2, -1, 1), throttle: sharp && c.speed > 12 ? 0.4 : 1, brake: 0, handbrake: sharp && c.speed > 8 };
    }
    hud() {
        const me = this.api.car;
        if (this.rule === 'stunt') return { big: this.score.toLocaleString('en'), of: '', line: this.combo > 1 ? `combo ×${this.combo}` : 'tricks', time: this.time, best: `best ${this.api.stuntBest().toLocaleString('en')}` };
        if (this.rule === 'potato') {
            const mine = this.holder === me;
            return { big: String(Math.max(0, Math.ceil(this.fuse))), of: 's', line: `${this.alive().length}/${this.api.cars.length} left`, time: null, best: mine ? 'YOU HAVE THE BOMB' : `${this.api.nameOf(this.holder)} has it`, hot: mine };
        }
        return { balloons: me.out ? 0 : me.balloons, left: this.alive().length, total: this.api.cars.length, time: this.time, pops: me.pops };
    }
}

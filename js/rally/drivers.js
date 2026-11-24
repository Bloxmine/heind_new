/* The drivers: who sits in the car. You pick one in the garage; the rivals are the other seven.
   Each is a little model made of boxes and spheres, seated in the car, and a portrait for the menus. */
import * as THREE from 'three';
import { cel } from './retro.js';

// style: how they race as a rival (see ai.js). kind: what's on their head.
export const DRIVERS = [
    { id: 'vex', name: 'Vex', style: 'aggressive', tag: 'Punk. Sprays her own helmets.', perk: 'Bully: shoves other cars harder', skin: '#e8b890', suit: '#d8342c', kind: 'helmet', helmet: '#1a1a22', stripe: '#ff3a6e', visor: '#ff9a1f', extra: 'mohawk' },
    { id: 'juno', name: 'Juno', style: 'balanced', tag: 'Ex-test pilot. Never lifts.', perk: 'Flat out: 3% more top speed', skin: '#8a5a3a', suit: '#f2f0ea', kind: 'helmet', helmet: '#f2f0ea', stripe: '#3a8cff', visor: '#ffd23f' },
    { id: 'rafe', name: 'Rafe', style: 'careful', tag: 'Forty years of rallying, still in his flat cap.', perk: 'Old hand: more grip on dirt, gravel and snow', skin: '#f0c49a', suit: '#4f6a2c', kind: 'cap', hat: '#7a5a3a', extra: 'moustache' },
    { id: 'kiko', name: 'Kiko', style: 'aggressive', tag: 'Youngest on the grid. Cat ears on the lid.', perk: 'Spark plug: drift sparks charge 20% faster', skin: '#f2c8a8', suit: '#ff9ac8', kind: 'helmet', helmet: '#ff9ac8', stripe: '#ffffff', visor: '#3ad0ff', extra: 'ears' },
    { id: 'sol', name: 'Sol', style: 'hoarder', tag: 'Collects power-ups. And sunglasses.', perk: 'Collector: starts every race with a power-up', skin: '#6b4228', suit: '#ffd23f', kind: 'hair', hair: '#1a1a22', extra: 'shades' },
    { id: 'nadia', name: 'Nadia', style: 'balanced', tag: 'Two-time champion. Very calm on the radio.', perk: 'Clean lines: walls cost her less speed', skin: '#c88a5a', suit: '#1d4fa8', kind: 'helmet', helmet: '#1d4fa8', stripe: '#ffffff', visor: '#1a1a22' },
    { id: 'bram', name: 'Bram', style: 'careful', tag: 'Dairy farmer from Friesland. Races in his overalls.', perk: 'Tractor: barely slowed off the road', skin: '#f4c8a8', suit: '#3a6a8a', kind: 'beanie', hat: '#e8562a', extra: 'beard' },
    { id: 'quackers', name: 'Quackers', style: 'balanced', tag: 'A rubber duck. Nobody knows who entered it.', perk: 'Floats: puddles don\'t slow it down', kind: 'duck' }
];
export const driverById = (id) => DRIVERS.find((d) => d.id === id) || DRIVERS[0];
export const driverByName = (n) => DRIVERS.find((d) => d.name === n) || null;
// the seven rivals when you're driving as `id`
export const rivalsFor = (id) => DRIVERS.filter((d) => d.id !== id).slice(0, 7);

/* The model, with its hips at the origin, facing +z. snap: false for portraits, which aren't drawn at 320 x 180. */
export function driverModel(d, snap = true) {
    const g = new THREE.Group();
    const m = (color) => cel({ color }, snap);
    const box = (w, h, dz, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, dz), mat); o.position.set(x, y, z); g.add(o); return o; };
    const ball = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
    if (d.kind === 'duck') {
        // a rubber duck: one sphere of body, one of head, a beak, two dots for eyes
        const y = m('#ffd23f');
        ball(0.26, y, 0, 0.2, 0, 1, 0.8, 1.2);
        ball(0.17, y, 0, 0.55, 0.08);
        box(0.16, 0.06, 0.14, m('#ff9a1f'), 0, 0.53, 0.27);
        for (const sx of [-1, 1]) box(0.03, 0.05, 0.03, m('#111111'), sx * 0.09, 0.6, 0.22);
        g.userData.head = 0.55;
        return g;
    }
    const skin = m(d.skin), suit = m(d.suit);
    // body and arms reaching forward to the wheel
    box(0.4, 0.42, 0.24, suit, 0, 0.21, -0.02);
    for (const sx of [-1, 1]) {
        const arm = box(0.1, 0.1, 0.36, suit, sx * 0.17, 0.33, 0.16);
        arm.rotation.x = 0.35;
        ball(0.055, m(d.kind === 'helmet' ? '#1a1a22' : d.skin), sx * 0.15, 0.27, 0.34);
    }
    ball(0.07, skin, 0, 0.47, 0);                       // neck
    const hy = 0.6;
    if (d.kind === 'helmet') {
        ball(0.15, m(d.helmet), 0, hy, 0, 1, 1.02, 1.05);
        box(0.22, 0.07, 0.06, m(d.visor), 0, hy + 0.01, 0.13);
        box(0.035, 0.2, 0.31, m(d.stripe), 0, hy + 0.06, -0.01);
        if (d.extra === 'mohawk') for (let k = 0; k < 4; k++) box(0.04, 0.07 - k * 0.008, 0.06, m('#4aff7a'), 0, hy + 0.17, 0.06 - k * 0.07);
        if (d.extra === 'ears') for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), m(d.helmet)); e.position.set(sx * 0.09, hy + 0.15, 0); g.add(e); }
    } else {
        ball(0.13, skin, 0, hy, 0);
        for (const sx of [-1, 1]) box(0.025, 0.025, 0.02, m('#111111'), sx * 0.05, hy + 0.02, 0.12);
        if (d.kind === 'cap') { ball(0.135, m(d.hat), 0, hy + 0.05, -0.01, 1, 0.55, 1); box(0.2, 0.025, 0.1, m(d.hat), 0, hy + 0.05, 0.12); }
        if (d.kind === 'beanie') { ball(0.14, m(d.hat), 0, hy + 0.06, 0, 1, 0.75, 1); ball(0.04, m('#ffffff'), 0, hy + 0.18, 0); }
        if (d.kind === 'hair') ball(0.17, m(d.hair), 0, hy + 0.08, -0.03, 1.05, 0.8, 1);
        if (d.extra === 'shades') box(0.2, 0.04, 0.03, m('#111111'), 0, hy + 0.02, 0.125);
        if (d.extra === 'moustache') box(0.11, 0.025, 0.03, m('#d8d8d0'), 0, hy - 0.04, 0.125);
        if (d.extra === 'beard') ball(0.1, m('#c88a3a'), 0, hy - 0.07, 0.06, 1, 0.8, 0.7);
    }
    g.userData.head = hy;
    return g;
}

// where the driver sits in each kind of car: [x (the car's left is +x), hips y, z, scale]; low cars get a smaller
// driver, so the head shows above the door line without poking through the roof
function seatFor(B, type) {
    if (B.saucer) return [0, 0.75, 0, 1];
    if (type === 'couch') return [0.4, 1.04, 0.15, 1];
    if (type === 'duck') return [0, 1.25, -0.3, 1];
    const [rf, rr, ry] = B.roof;
    const k = Math.min(1, Math.max(0.75, (ry - 0.5) / 0.85));
    return [(B.width / 2 - 0.1) * 0.42, ry - 0.08 - 0.75 * k, Math.max(rr + 0.2, rf - 0.35), k];
}
// put a driver in a car (replacing whoever was there)
export function seatDriver(mesh, type, d) {
    if (mesh.driverG) mesh.body.remove(mesh.driverG);
    const g = driverModel(d);
    const [x, y, z, k] = seatFor(mesh.B, type);
    g.position.set(x, y, z);
    g.scale.setScalar(k);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    mesh.body.add(g);
    mesh.driverG = g;
    mesh.driverId = d.id;
    mesh.perk = d.id;
    return g;
}

/* Portraits for the menus: each driver's head and shoulders, rendered once into a small picture. */
const portraitCache = new Map();
export function driverPortrait(renderer, d, size = 64) {
    if (portraitCache.has(d.id)) return portraitCache.get(d.id);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1c2433');
    scene.add(new THREE.HemisphereLight('#ffffff', '#3a3040', 2.2));
    const key = new THREE.DirectionalLight('#fff4e0', 2.6); key.position.set(1, 1.5, 2); scene.add(key);
    const model = driverModel(d, false);
    model.rotation.y = -0.35;
    scene.add(model);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    const hy = model.userData.head || 0.6;
    cam.position.set(0, hy + 0.05, 1.25); cam.lookAt(0, hy - 0.08, 0);
    const rt = new THREE.WebGLRenderTarget(size, size);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
    const px = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
    rt.dispose();
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), img = x.createImageData(size, size);
    // the target holds linear light, upside down: flip it and encode for the screen
    for (let y = 0; y < size; y++) for (let i = 0; i < size; i++) {
        const s = ((size - 1 - y) * size + i) * 4, t = (y * size + i) * 4;
        for (let k = 0; k < 3; k++) img.data[t + k] = Math.round(255 * Math.pow(px[s + k] / 255, 1 / 2.2));
        img.data[t + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const url = c.toDataURL();
    portraitCache.set(d.id, url);
    return url;
}

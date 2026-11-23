/* Gravel Riot: menus, garage, test drive with power-ups and practice cars. */
import * as THREE from 'three';
import { RES, Post, setWobble, glows, MAIN_ONLY, GLOW } from './retro.js';
import { surfaceTextures } from './textures.js';
import { buildTrack } from './track.js';
import { Car, CARS, SURF, makeCarMesh } from './car.js';
import { TRACKS } from './tracks.js';
import { CarAudio } from './audio.js';
import { Cockpit } from './cockpit.js';
import { Rain, Droplets, addPuddles, rainy } from './weather.js';
import { PU, Pickups, Weapons, iconURL } from './powerups.js';
import { Driver, RIVALS, plan } from './ai.js';
import { Music, SONGS } from './music.js';
import { buildWorld, Roam } from './world.js';
import { paceNotes, noteIcon, CoDriver } from './pacenotes.js';

const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const fmt = (t) => (t == null || !isFinite(t) ? '-:--.--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);
const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();

/* ---------- settings ---------- */
const CFG = Object.assign({ look: 'night', fps: 30, wobble: 1, crt: true, sound: true, lines: true, ink: true, glow: true, view: 'chase', weather: 'auto', track: 'alpine', car: 'volta', targets: true, diff: 'normal', music: true, fansTotal: 0, wins: 0, custom: {}, trophies: {} }, store.get('heind.rally', {}));
if (!CFG.custom) CFG.custom = {};
if (!CFG.trophies) CFG.trophies = {};
const DIFFS = { easy: { name: 'EASY', skill: 0.84 }, normal: { name: 'NORMAL', skill: 0.91 }, hard: { name: 'HARD', skill: 0.98 } };
if (!DIFFS[CFG.diff]) CFG.diff = 'normal';
if (!CFG.stats) CFG.stats = {};
if (!CFG.ach) CFG.ach = {};
const ST = CFG.stats;
for (const k of ['races', 'km', 'top', 'drift', 'jump', 'near', 'smash', 'takedown', 'perfect', 'painted', 'ghost', 'drifts']) if (ST[k] == null) ST[k] = 0;
if (!['kmh', 'mph'].includes(CFG.units)) CFG.units = 'kmh';
const CODRIVER = ['voice', 'notes', 'off'];
if (!['kart', 'rally'].includes(CFG.driftStyle)) CFG.driftStyle = 'kart';
const SPARK = ['#ffe8a0', '#3ad0ff', '#ff4a2a', '#c44aff'];       // charging, then blue, red and purple
// a four-pointed spark star; the sprites glow, flicker and grow with the charge
const sparkTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    for (const [w, l] of [[3, 15], [2, 10]]) {
        for (let k = 0; k < (w === 3 ? 4 : 4); k++) {
            x.save(); x.translate(16, 16); x.rotate(k * Math.PI / 2 + (w === 3 ? 0 : Math.PI / 4));
            x.beginPath(); x.moveTo(-w, 0); x.lineTo(0, -l); x.lineTo(w, 0); x.fill(); x.restore();
        }
    }
    x.beginPath(); x.arc(16, 16, 4, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
})();
function sparkSprites(c) {
    if (c.sparkS) return c.sparkS;
    c.sparkS = [-1, 1].map((sx) => {
        const s = glows(new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: "#ffffff", alphaTest: 0.5, fog: false })));
        s.position.set(sx * 0.95, 0.35, -c.mesh.B.len * 0.5);
        s.visible = false;
        c.mesh.root.add(s);
        return s;
    });
    return c.sparkS;
}
if (!CODRIVER.includes(CFG.codriver)) CFG.codriver = 'voice';
const VIEWS = ['chase', 'far', 'hood', 'cockpit'], VIEWN = { chase: 'CHASE', far: 'FAR CHASE', hood: 'HOOD', cockpit: 'COCKPIT' };
if (!VIEWS.includes(CFG.view)) CFG.view = 'chase';
const speedTxt = (ms) => CFG.units === 'mph' ? `${Math.round(ms * 2.237)} mph` : `${Math.round(ms * 3.6)} km/h`;
// the radio: track music, or any station you like
const STATIONS = [[null, 'TRACK MUSIC'], ['world', 'STREET 104 · funk'], ['neon', 'NEON 80 · synthwave'], ['coast', 'SURF 101 · surf rock'], ['harbour', 'DOCKSIDE · drum & bass'],
    ['airfield', 'RUNWAY · trance'], ['autumn', 'LEAF FM · lo-fi'], ['volcano', 'MAGMA · industrial'], ['stadium', 'ARENA · big beat'], ['alpine', 'ALPINE FM · folk rock'],
    ['canyon', 'DUST 88 · desert twang'], ['jungle', 'CANOPY · tribal'], ['oldtown', 'PLAZA · polka'], ['frost', 'GLACIER · ice breaks'], ['race1', 'RIOT 1 · electro'], ['race2', 'RIOT 2 · electro'], ['race3', 'RIOT 3 · electro']];
if (!(CFG.radio >= 0 && CFG.radio < STATIONS.length)) CFG.radio = 0;
const SONG_FOR = { alpine: 'race1', canyon: 'race2', frost: 'race3', harbour: 'race2', stadium: 'race2', jungle: 'race3', oldtown: 'race1', neon: 'race2', coast: 'race1', volcano: 'race3', autumn: 'race1', airfield: 'race2', world: 'race3' };
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const WEATHERS = ['auto', 'dry', 'rain', 'snow'];
if (!WEATHERS.includes(CFG.weather)) CFG.weather = 'auto';
const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];
const saveCfg = () => store.set('heind.rally', CFG);
const SEA = window.SEA && window.SEA.SEA_PAL ? window.SEA.SEA_PAL.hexes : ['#000000', '#ffffff'];
// Night Drive: muted greys, teals and earth tones with a few neon accents for the power-ups.
const NIGHT = ['#07090c', '#11151a', '#1c2229', '#2a3139', '#3b434c', '#4f5862', '#66707a', '#808a93', '#9ca5ad', '#bcc3c8', '#dde2e5', '#ffffff',
    '#0f2a28', '#1d4440', '#2f625a', '#4a8078', '#6fa39a', '#2e2a1e', '#4a4330', '#6a5f44', '#8c7d5a', '#ad9e78',
    '#5a2a1e', '#8a3a22', '#c2502a', '#e8783a', '#f2a85a', '#ffd27a', '#1a2a3e', '#2e4660', '#4a6a8a', '#7a9cbc',
    '#3ad0ff', '#ff3a6e', '#b04aff', '#4aff7a', '#ffe23a'];
const MOODY = { sat: 0.7, con: 1.12, vig: 0.42, shadow: [0.88, 1.0, 1.04], high: [1.12, 1.02, 0.9] };
const LOOKS = {
    night: { name: 'NIGHT DRIVE', mode: 'palette', hexes: NIGHT, spread: 22, ink: '#07090c', line: '#dde8ee', grade: MOODY },
    java: { name: 'JAVA 4096', mode: 'java', spread: 17, ink: '#000000', line: '#ffffff', grade: MOODY },
    sea: { name: 'SEAOS COLOUR', mode: 'palette', hexes: SEA, spread: 30, ink: '#04070f', line: '#ffffff', grade: { sat: 1.15, con: 1.05, vig: 0.25, shadow: [1, 1, 1], high: [1, 1, 1] } },
    dmg: { name: 'DMG GREEN', mode: 'palette', hexes: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], spread: 66, ink: '#0f380f', line: '#9bbc0f' },
    raw: { name: 'NO DITHER', mode: 'raw', ink: '#07090c', line: '#dde8ee', grade: MOODY }
};
const FPS = [60, 30, 15];
// render resolution: the retro 320 x 180 by default, up to 1280 x 720
const RESK = [1, 2, 3, 4], RESN = ['RETRO 320', 'SHARP 640', 'HIGH 960', 'HD 1280'];
if (!RESK.includes(CFG.res)) CFG.res = 1;
const BASE = { w: 320, h: 180 };

/* ---------- renderer ---------- */
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RES.w, RES.h, false);
const post = new Post(renderer);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(62, RES.w / RES.h, 0.3, 1500);
const TX = surfaceTextures();

let track = null, car = null, shadow = null, cockpit = null, trackDef = null;
let cars = [], pickups = null, weapons = null;
const rain = new Rain(scene);
const drops = new Droplets();
const sun = new THREE.DirectionalLight('#ffffff', 3.2);
const hemi = new THREE.HemisphereLight('#ffffff', '#445533', 2.4);
scene.add(sun, hemi);
const sunDisc = glows(new THREE.Mesh(new THREE.CircleGeometry(34, 20), new THREE.MeshBasicMaterial({ color: '#ffd8a0', fog: false })));
scene.add(sunDisc);
const sunDir = new THREE.Vector3();

/* ---------- dust, spray and smoke: stylised cel-shaded puffs ---------- */
const PUFFS = 700;
const pPos = new Float32Array(PUFFS * 3), pCol = new Float32Array(PUFFS * 3), pSize = new Float32Array(PUFFS), pAlpha = new Float32Array(PUFFS);
const pSeed = Float32Array.from({ length: PUFFS }, () => Math.random() * 100);
const puffGeo = new THREE.BufferGeometry();
puffGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
puffGeo.setAttribute('pcol', new THREE.BufferAttribute(pCol, 3));
puffGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
puffGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
puffGeo.setAttribute('seed', new THREE.BufferAttribute(pSeed, 1));
const puffMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: RES.h * 0.85 } },
    vertexShader: `attribute float size; attribute float alpha; attribute float seed; attribute vec3 pcol; uniform float uScale; varying vec3 vC; varying float vA; varying float vS;
        void main() { vC = pcol; vA = alpha; vS = seed; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 40.0); }`,
    fragmentShader: `varying vec3 vC; varying float vA; varying float vS;
        const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            p.y *= 1.35;                                                  // a flatter cloud that hugs the ground
            float a = atan(p.y, p.x);
            float edge = 0.72 + 0.16 * sin(a * 3.0 + vS) + 0.1 * sin(a * 5.0 - vS * 1.7);   // ragged outline
            float r = length(p) / edge;
            if (r > 1.0) discard;
            // see-through: denser in the middle, thinning to the edge, all through an ordered dither
            float dens = vA * (1.0 - r * r) * 1.2;
            ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
            if (dens < (B[q.x + q.y * 4] + 0.5) / 16.0) discard;
            vec3 c = vC * (p.y < -0.25 ? 1.12 : 0.88);                    // a lighter top, two flat tones
            gl_FragColor = vec4(c, 1.0);
        }`
});
const puffs = new THREE.Points(puffGeo, puffMat);
puffs.frustumCulled = false;
puffs.layers.set(MAIN_ONLY);
scene.add(puffs);
const pp = Array.from({ length: PUFFS }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2 }));
let pI = 0;
const tmpC = new THREE.Color();
function puff(x, y, z, col, vx = 0, vy = 1, vz = 0, s0 = 0.6, s1 = 2.4, life = 1.2) {
    const p = pp[pI = (pI + 1) % PUFFS];
    Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, s0, s1 });
    tmpC.set(col); pCol[pI * 3] = tmpC.r; pCol[pI * 3 + 1] = tmpC.g; pCol[pI * 3 + 2] = tmpC.b;
}
function updPuffs(dt) {
    for (let i = 0; i < PUFFS; i++) {
        const p = pp[i];
        if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; p.vy *= 1 - dt * 0.8; }
        const k = p.life > 0 ? 1 - p.life / p.max : 1;
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.life > 0 ? p.y : -9999; pPos[i * 3 + 2] = p.z;
        pSize[i] = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
        pAlpha[i] = p.life > 0 ? Math.min(1, (1 - k) * 1.6) : 0;
    }
    for (const n of ['position', 'pcol', 'size', 'alpha']) puffGeo.attributes[n].needsUpdate = true;
}

/* ---------- track and cars ---------- */
function reloadTrack() {
    if (track && track.isWorld) return;
    loadTrack(trackById(CFG.track));
    if (mode === 'drive') startDrive(); else showCar(specFor(CFG.car));
}
function loadTrack(base) {
    trackDef = base;
    const w = CFG.weather === 'auto' ? base.weather || 'dry' : CFG.weather;
    const def = w === 'rain' ? rainy(base) : base;
    def.snowfall = w === 'snow' || w === 'embers' || w === 'leaves';
    clearRace();
    if (track) scene.remove(track.group);
    track = buildTrack(def, TX);
    if (def.rain) addPuddles(track);
    rain.setOn(!!def.rain || def.snowfall, def.rain ? 'rain' : w === 'snow' ? 'snow' : w);
    drops.clear();
    scene.add(track.group);
    scene.background = new THREE.Color(def.sky.top);
    scene.fog = new THREE.Fog(def.fog, def.fogNear, def.fogFar);
    sun.color.set(def.light.sun); sun.position.set(...(def.light.dir || [0.5, 1, 0.3]));
    sunDir.copy(sun.position).normalize();
    sunDisc.material.color.set(def.light.disc || '#ffd8a0');
    hemi.color.set(def.light.amb); hemi.groundColor.set(def.light.ground);
    drawMinimapBase();
}
function newCar(spec, slot, lights) {
    const c = new Car(spec, track);
    scene.add(c.mesh.root);
    const g = typeof slot === 'number' ? track.gridSlot(slot) : slot;
    c.place(g.x, g.y, g.z, g.heading);
    c.lastGy = c.y;
    if (lights) c.setHeadlights(track.def.headlights || 0);
    c.lapN = 0; c.lastProg = c.q.prog; c.stuckT = 0;
    return c;
}
function clearRace() {
    cars.forEach((c) => scene.remove(c.mesh.root));
    cars = []; car = null;
    if (pickups) { pickups.dispose(); pickups = null; }
    if (weapons) { weapons.clear(); weapons = null; }
}
// the single car shown on the menu and in the garage
function showCar(spec) {
    clearRace();
    car = newCar(spec, 0, true);
    car.isPlayer = true;
    cars = [car];
    cockpit = new Cockpit(car);
    if (!shadow) {
        shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.8), new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthWrite: false }));
        scene.add(shadow);
    }
}

/* ---------- input ---------- */
const keys = new Set(), hits = new Set();
const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'hand', ShiftLeft: 'ebrake', ShiftRight: 'ebrake', KeyR: 'reset', Escape: 'pause', KeyP: 'pause', Enter: 'ok', NumpadEnter: 'ok', KeyF: 'full',
    KeyZ: 'fire', KeyX: 'fireBack', KeyC: 'cycle', KeyV: 'view', Backspace: 'back', KeyT: 'time', KeyY: 'weather', KeyM: 'map', KeyH: 'photo', KeyN: 'radio'
};
const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
addEventListener('keydown', (e) => {
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!keys.has(a)) {
        hits.add(a);
        if (a === 'fire') hits.add('ok');
        if (a === 'pause' && e.code === 'Escape') hits.add('back');
        if (a === 'up' || a === 'down') hits.add(a === 'up' ? 'mup' : 'mdown');
    }
    keys.add(a);
    audio.start();
});
addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) keys.delete(a); });
addEventListener('blur', () => { keys.clear(); if (mode === 'drive' && !paused) setPause(true); });
const press = (a) => { if (hits.has(a)) { hits.delete(a); return true; } return false; };
const pad = { steer: 0, throttle: 0, brake: 0, hand: false, prev: {} };
function pollPad() {
    pad.steer = 0; pad.throttle = 0; pad.brake = 0; pad.hand = false;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (!gp) return;
    const b = (i) => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
    const ax = gp.axes[0] || 0;
    pad.steer = Math.abs(ax) > 0.12 ? ax : (b(15) - b(14));
    pad.throttle = Math.max(b(7), b(0));
    pad.brake = Math.max(b(6), b(1) ? 1 : 0);
    pad.hand = b(2) > 0.5;
    const edge = (i, a) => { const on = b(i) > 0.5; if (on && !pad.prev[i]) { hits.add(a); audio.start(); } pad.prev[i] = on; };
    edge(9, 'pause'); edge(0, 'ok'); edge(1, 'back'); edge(3, 'cycle'); edge(5, 'fire'); edge(4, 'fireBack'); edge(8, 'reset');
    edge(12, 'mup'); edge(13, 'mdown'); edge(14, 'left'); edge(15, 'right');
}
// touch: steering, brake, handbrake and fire buttons; the throttle is automatic
const touch = { left: false, right: false, brake: false, hand: false };
$$('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('down'); audio.start(); };
    const off = () => { touch[k] = false; b.classList.remove('down'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
$$('[data-tap]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); hits.add(b.dataset.tap); audio.start(); }));
const isTouch = () => document.body.classList.contains('touch');
let override = null;  // a test autopilot can drive instead of the player
function readDrive() {
    if (override) return override(car, track);
    const kSteer = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + (touch.right ? 1 : 0) - (touch.left ? 1 : 0);
    return {
        steer: clamp(kSteer + pad.steer, -1, 1),
        throttle: Math.max(keys.has('up') ? 1 : 0, pad.throttle, isTouch() && !touch.brake ? 1 : 0),
        brake: Math.max(keys.has('down') ? 1 : 0, pad.brake, touch.brake ? 1 : 0),
        // kart style: the drift button hops into a kart drift and Shift is the handbrake; rally style: it's the handbrake
        drift: CFG.driftStyle === 'kart' && (keys.has('hand') || pad.hand || touch.hand),
        handbrake: keys.has('ebrake') || (CFG.driftStyle !== 'kart' && (keys.has('hand') || pad.hand || touch.hand))
    };
}
// practice cars: follow the road on their own lane at their own pace (rivals with tactics come next)
function botDrive(b) {
    const S = track.S, N = track.N, i = b.q.i;
    const look = 6 + Math.floor(b.speed / 4);
    const t = S[(i + look) % N], lane = b.ai.lane * t.w;
    let d = angDiff(Math.atan2(t.x + t.sx * lane - b.x, t.z + t.sz * lane - b.z), b.h);
    const t2 = S[(i + look * 3) % N];
    const d2 = Math.abs(angDiff(Math.atan2(t2.x - b.x, t2.z - b.z), b.h));
    const vmax = b.ai.speed - d2 * 20;
    return { steer: clamp(-d * 3, -1, 1), throttle: b.speed < vmax ? 1 : 0, brake: b.speed > vmax + 4 ? 1 : 0, handbrake: false };
}

/* ---------- audio ---------- */
const audio = new CarAudio();
audio.on = CFG.sound;
const music = new Music(audio);
music.on = CFG.music;
document.addEventListener('pointerdown', () => audio.start());

/* ---------- cameras ---------- */
let camH = 0, camY = 0, fov = 62, shake = 0;
function chase(dt, snap) {
    const k = snap ? 1 : Math.min(1, dt * 4.2);
    camH += angDiff(car.h, camH) * k;
    if (CFG.view === 'hood') {
        // on the bonnet, looking down the road
        const fx = Math.sin(car.h), fz = Math.cos(car.h), L = car.mesh.B.len * 0.18;
        cam.position.set(car.x + fx * L, car.y + (car.mesh.B.head || 0.8) + 0.75 + (car.mesh.B.lift || 0), car.z + fz * L);
        cam.lookAt(car.x + fx * 30, car.y + 1.2 + Math.sin(-car.pitch) * 30, car.z + fz * 30);
        const wantF = 66 + Math.min(14, car.speed * 0.25) + (car.nitro > 0 ? 8 : 0);
        fov += (wantF - fov) * Math.min(1, dt * 3);
        cam.fov = fov; cam.clearViewOffset(); cam.updateProjectionMatrix();
        return;
    }
    const far = CFG.view === 'far', back = far ? 10.5 : 6.6, up = far ? 3.9 : 2.6;
    const cx = car.x - Math.sin(camH) * back, cz = car.z - Math.cos(camH) * back;
    const gq = track.query(cx, cz, car.q.i);
    const wantY = Math.max(car.y + up, gq.y + 1.2);
    camY = snap ? wantY : camY + (wantY - camY) * Math.min(1, dt * 6);
    const sh = shake * shake;
    cam.position.set(cx + (Math.random() - 0.5) * sh * 0.8, camY + (Math.random() - 0.5) * sh * 0.6, cz + (Math.random() - 0.5) * sh * 0.8);
    cam.lookAt(car.x + Math.sin(camH) * 4, car.y + 1.1, car.z + Math.cos(camH) * 4);
    const wantF = 60 + Math.min(12, car.speed * 0.22) + (car.nitro > 0 ? 8 : 0);
    fov += (wantF - fov) * Math.min(1, dt * 3);
    cam.fov = fov; cam.clearViewOffset(); cam.updateProjectionMatrix();
}
function orbit(t, r, h, shift) {
    const a = t * 0.22;
    cam.position.set(car.x + Math.sin(a) * r, car.y + h, car.z + Math.cos(a) * r);
    cam.lookAt(car.x, car.y + 0.8, car.z);
    cam.fov = 48;
    if (shift) cam.setViewOffset(RES.w, RES.h, -RES.w * shift, 0, RES.w, RES.h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
}

/* ---------- minimap ---------- */
const mm = $('#minimap'), mmx = mm.getContext('2d');
const dash2d = $('#dash2d'), dashX = dash2d.getContext('2d');
let lastRpm = 0, lastGear = 1;
let mmBase = null, mmT = null;
function trackOutline(size, line, under) {
    const S = track.S;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    S.forEach((s) => { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); });
    const pad = size * 0.14, sc = (size - pad * 2) / Math.max(x1 - x0, z1 - z0);
    const T = (x, z) => [size - pad - ((x - x0) * sc + (size - pad * 2 - (x1 - x0) * sc) / 2), size - pad - ((z - z0) * sc + (size - pad * 2 - (z1 - z0) * sc) / 2)];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.lineJoin = 'round';
    const path = () => { x.beginPath(); S.forEach((s, i) => { const [px, py] = T(s.x, s.z); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); };
    if (under) { x.strokeStyle = under; x.lineWidth = size / 12; path(); x.stroke(); }
    x.strokeStyle = line; x.lineWidth = size / 30; path(); x.stroke();
    return { c, T };
}
function drawMinimapBase() {
    const o = trackOutline(64, '#dff4ff', '#04070f');
    mmBase = o.c; mmT = o.T;
    const [sx, sy] = mmT(track.S[0].x, track.S[0].z);
    o.c.getContext('2d').fillStyle = '#ffd23f'; o.c.getContext('2d').fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
}
function drawMinimap() {
    if (roam) { roam.drawMap(mmx, cars, car); return; }
    mmx.clearRect(0, 0, 64, 64);
    mmx.drawImage(mmBase, 0, 0);
    for (const c of cars) {
        const [px, py] = mmT(c.x, c.z);
        mmx.fillStyle = '#04070f'; mmx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5);
        mmx.fillStyle = c === car ? '#ffe23a' : '#ff3a6e'; mmx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
        if (c === car) { mmx.fillStyle = '#ffffff'; mmx.fillRect(Math.round(px), Math.round(py), 1, 1); }
    }
}

/* ---------- HUD ---------- */
const hudCache = {};
const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; const el = $('#' + id); if (el) el.textContent = v; } };
const setHTML = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; const el = $('#' + id); if (el) el.innerHTML = v; } };
let msgT = 0, burst = 0, fans = 0;
const tint = { col: new THREE.Color(), t: 0, max: 1 };
const message = (txt, t = 1.6, bad) => {
    const el = $('#h-msg'); el.textContent = txt; el.hidden = false;
    el.classList.toggle('bad', !!bad); el.classList.toggle('big', /^([0-9]|GO!)$/.test(txt)); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); msgT = t;
};
function feed(text, pts, cls) {
    const box = $('#h-feed');
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.innerHTML = text + (pts ? ` <b>+${pts}</b>` : '');
    box.prepend(p);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => p.remove(), 2200);
    if (pts) fans += pts;
}
// the launch dial: the needle is your revs, the outer ring is the countdown.
// the white dot sweeps through the zones and freezes where you hit the throttle.
const REV_ZONES = [[3.99, 3.0, '#ff3a6e', 'TOO EARLY'], [3.0, 2.4, '#4aff7a', 'PERFECT'], [2.4, 1.6, '#ffe23a', 'GOOD'], [1.6, 0.6, '#5a6472', 'LATE']];
function drawRev() {
    const cv = $('#h-revc'), x = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = 40;
    const A0 = Math.PI * 0.8, A1 = Math.PI * 2.2, ang = (c) => A0 + (3.99 - clamp(c, 0.6, 3.99)) / 3.39 * (A1 - A0);
    x.clearRect(0, 0, W, H);
    x.lineCap = 'butt';
    // dial face: dark disc with a chunky ink rim
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 36, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#121a26'; x.beginPath(); x.arc(cx, cy, 33, 0, Math.PI * 2); x.fill();
    // outer timing ring, in its zones
    for (const [a, b, col] of REV_ZONES) { x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, 30, ang(a), ang(b)); x.stroke(); }
    x.strokeStyle = '#000'; x.lineWidth = 1;
    for (const [a] of REV_ZONES) { const t = ang(a); x.beginPath(); x.moveTo(cx + Math.cos(t) * 27, cy + Math.sin(t) * 27); x.lineTo(cx + Math.cos(t) * 33, cy + Math.sin(t) * 33); x.stroke(); }
    // rev segments: lit blocks up to the needle
    const segs = 14;
    for (let i = 0; i < segs; i++) {
        const t = A0 + (i + 0.15) / segs * (A1 - A0), t2 = A0 + (i + 0.85) / segs * (A1 - A0), on = i / segs < revHold;
        x.strokeStyle = on ? (i >= segs - 3 ? '#ff3a6e' : i >= segs - 6 ? '#ffe23a' : '#3ad0ff') : '#26303e';
        x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 22, t, t2); x.stroke();
    }
    // the timing dot: live, or frozen where you pressed
    const at = race.rev != null ? race.rev : race.count, ta = ang(at);
    x.fillStyle = '#000'; x.fillRect((cx + Math.cos(ta) * 30 - 3) | 0, (cy + Math.sin(ta) * 30 - 3) | 0, 6, 6);
    x.fillStyle = '#fff'; x.fillRect((cx + Math.cos(ta) * 30 - 2) | 0, (cy + Math.sin(ta) * 30 - 2) | 0, 4, 4);
    // needle with a bit of engine jitter
    const jit = revHold > 0.05 ? (Math.random() - 0.5) * 0.06 * (0.4 + revHold) : 0;
    const na = A0 + clamp(revHold + jit, 0, 1.02) * (A1 - A0);
    x.strokeStyle = '#000'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(na) * 26, cy + Math.sin(na) * 26); x.stroke();
    x.strokeStyle = '#ff8a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(na) * 25, cy + Math.sin(na) * 25); x.stroke();
    x.fillStyle = '#000'; x.fillRect(cx - 4, cy - 4, 8, 8); x.fillStyle = '#e8eef6'; x.fillRect(cx - 2, cy - 2, 4, 4);
    // the verdict tag underneath
    const z = REV_ZONES.find(([a, b]) => at <= a && at > b) || REV_ZONES[3];
    const lbl = race.rev != null ? z[3] : 'LAUNCH';
    const rv = $('#h-rev'); rv.style.setProperty('--rc', race.rev != null ? z[2] : '#3ad0ff');
    setText('h-revt', lbl);
}
function updateHUD() {
    if (mode !== 'drive' || !car) return;
    const rv = $('#h-rev'), onGrid = !!(race && race.count > 0);
    rv.hidden = !onGrid;
    if (onGrid) { drawRev(); rv.classList.toggle('max', revHold >= 1); }
    if (roam) {
        const h = roam.hud();
        setText('h-pos', String(h.ducks)); setText('h-of', String(h.of));
        setText('h-lap', h.weather);
        setText('h-time', h.time != null ? fmt(h.time) : h.clock);
        setText('h-best', h.gate || h.area);
    } else {
    const N = track.N, score = (c) => c.lapN * N + c.q.prog;
    const pos = 1 + cars.filter((c) => c !== car && score(c) > score(car)).length;
    setText('h-pos', String(pos)); setText('h-of', String(cars.length));
    setText('h-lap', race && race.kind === 'race' ? `${clamp(car.lapN, 1, race.laps)}/${race.laps}` : String(Math.max(1, car.lapN)));
    setText('h-time', lapStarted ? fmt(lapT) : '-:--.--');
    setText('h-best', fmt(best));
    }
    setText('h-speed', String(Math.round(car.speed * (CFG.units === 'mph' ? 2.237 : 3.6))));
    const dr = $('#h-drift'), dOn = drift.on && drift.score > 60;
    dr.hidden = !dOn;
    if (dOn) { setText('h-drift-n', Math.round(drift.score).toLocaleString('en')); setText('h-drift-x', '×' + drift.mult); dr.style.setProperty('--dk', Math.min(1, (drift.t % 1.5) / 1.5)); dr.style.setProperty('--tier', car.mk && car.mk.dir ? SPARK[car.mk.tier] : '#ff3d3d'); }
    setText('h-gear', car.vf < -0.5 ? 'R' : String(lastGear));
    setText('h-fans', String(fans));
    const hp = Math.ceil(car.health / 10);
    setHTML('h-hp', Array.from({ length: 10 }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join(''));
    $('#h-hp').classList.toggle('low', car.health < 35);
    setHTML('h-slots', [0, 1, 2].map((i) => {
        const s = car.slots[i];
        return `<i class="${s && i === car.sel ? 'sel' : ''}">${s ? `<img src="${iconURL(s.type)}" alt="${PU[s.type].name}">${s.ammo > 1 ? `<em>${s.ammo}</em>` : ''}` : ''}</i>`;
    }).join(''));
}

/* ---------- power-up effects ---------- */
const fx = {
    sound: (n) => audio.fx(n),
    burst: (k) => { burst = Math.max(burst, k); },
    boom(x, y, z, col, k = 1) {
        for (let i = 0; i < 22 * k; i++) { const a = Math.random() * 6.28, sp = 3 + Math.random() * 8 * k; puff(x, y, z, i % 3 ? col : '#ffffff', Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 0.4, 1.6 + k, 0.5 + Math.random() * 0.4); }
        for (let i = 0; i < 8 * k; i++) puff(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2, '#3b434c', (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, 1, 3.5, 1.4);
        audio.fx('boom');
        if (car && Math.hypot(car.x - x, car.z - z) < 30) burst = Math.max(burst, 0.7 * k);
    },
    trail(x, y, z, col) { puff(x, y, z, col, 0, 0.4, 0, 0.5, 0.15, 0.3); },
    tint(col, t) { tint.col.set(col); tint.t = Math.max(tint.t, t); tint.max = Math.max(t, 0.01); },
    sparkle(c, col) { for (let i = 0; i < 16; i++) puff(c.x + (Math.random() - 0.5) * 3, c.y + 0.6 + Math.random() * 1.5, c.z + (Math.random() - 0.5) * 3, col, 0, 2, 0, 0.5, 0.1, 0.6); },
    event(target, by, what, kind) {
        const name = PU[kind] ? title(PU[kind].name) : title(kind);
        if (what === 'wreck') target.wrecking = true;
        if (by === car && target !== car) {
            if (what === 'hit') feed(`${name} Hit`, { volt: 35, seeker: 60, mine: 45, pulse: 25, storm: 40 }[kind] || 20, 'hot');
            if (what === 'wreck') { feed('Takedown', 100, 'hot'); message('TAKEDOWN!', 1.6); ST.takedown++; }
            if (what === 'blocked') feed(`${name} Blocked`, 0);
        }
        if (target === car) {
            if (what === 'hit') { feed(`Hit by ${name}`, 0, 'bad'); burst = Math.max(burst, 0.9); }
            if (what === 'blocked') feed('Shield Saved You', 20, 'hot');
            if (what === 'wreck') { message('WRECKED!', 2.2, true); audio.fx('wreck'); }
        }
    }
};

/* ---------- game state ---------- */
let mode = 'menu', paused = false;
let lapT = 0, lapStarted = false, best = null, wrongWay = 0;
const bestKey = () => 'heind.rally.best.' + track.def.id;

let race = null, raceT = 0, results = 0, cup = null, banked = false, revHold = 0;
const rankCars = () => { const N = track.N; return [...cars].sort((a, b) => (b.done ? 1e9 - b.finishT : b.lapN * N + b.q.prog) - (a.done ? 1e9 - a.finishT : a.lapN * N + a.q.prog)); };
const CUPS = [
    { id: 'dirt', name: 'DIRT CUP', tracks: ['alpine', 'canyon', 'jungle', 'frost'] },
    { id: 'city', name: 'CITY CUP', tracks: ['harbour', 'oldtown', 'neon', 'stadium'] },
    { id: 'wild', name: 'WILD CUP', tracks: ['coast', 'autumn', 'airfield', 'volcano'] }
];
const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
// a car with the player's paint job and parts
const specFor = (id) => {
    const s = carById(id), c = CFG.custom[s.id] || {};
    return Object.assign({}, s, { body: c.body || s.body, stripe: c.stripe || s.stripe, rims: c.rims, num: c.num, spoiler: c.spoiler, underglow: c.glow });
};
const unlocked = (s) => !s.unlock || CFG.fansTotal >= s.unlock;
const nextUnlock = () => CARS.filter((s) => s.unlock && !unlocked(s)).sort((a, b) => a.unlock - b.unlock)[0];

function startDrive(kind = race ? race.kind : 'race') {
    mode = 'drive';
    document.body.dataset.mode = 'drive';
    document.body.dataset.kind = kind;
    paused = false;
    hideAll(); show('hud'); setMenu(null);
    race = { kind, laps: kind === 'race' ? trackById(CFG.track).laps || 3 : 0, count: kind === 'race' ? 3.99 : 0, order: [], done: false, rev: null };
    raceT = 0; results = 0; banked = false; revHold = 0;
    if (!unlocked(carById(CFG.car))) CFG.car = 'volta';
    if (roam) { roam.end(); roam = null; }
    showCar(specFor(CFG.car));
    setLabels(kind === 'roam');
    cockpit.setVisible(CFG.view === 'cockpit');
    if (kind === 'race') {
        // a full grid: the player starts in the middle, seven rivals around them
        const grid = 8, mine = 5;
        car.place(track.gridSlot(mine).x, track.gridSlot(mine).y, track.gridSlot(mine).z, track.gridSlot(mine).heading);
        car.lastGy = car.y; car.lastProg = car.q.prog;
        const others = CARS.filter((c) => c.id !== CFG.car && !c.unlock);
        const base = DIFFS[CFG.diff].skill;
        let r = 0;
        for (let slot = 0; slot < grid; slot++) {
            if (slot === mine) continue;
            const pick = cup ? cup.lineup[r] : { info: RIVALS[r], spec: others[r % others.length] };
            const b = newCar(Object.assign({}, pick.spec, { num: 2 + ((r * 17) % 90) }), slot, false);
            b.driver = new Driver(b, pick.info, base + (Math.random() - 0.5) * 0.05 + (pick.info.style === 'careful' ? -0.02 : pick.info.style === 'aggressive' ? 0.01 : 0));
            cars.push(b);
            r++;
        }
        plan(track);
    } else if (kind === 'roam') {
        roam = new Roam(world, roamApi);
    } else if (kind === 'test' && CFG.targets) {
        const others = CARS.filter((c) => c.id !== CFG.car && !c.unlock);
        for (let k = 0; k < 3; k++) {
            const i = (track.gridSlot(0).i + 30 + k * 28) % track.N, s = track.S[i];
            const lane = [-0.22, 0.2, 0][k];
            const b = newCar(others[(k * 3 + 1) % others.length], { x: s.x + s.sx * lane * s.w, z: s.z + s.sz * lane * s.w, y: s.y, heading: Math.atan2(s.tx, s.tz) }, false);
            b.ai = { lane, speed: 27 + k * 3 };
            cars.push(b);
        }
    }
    music.want(STATIONS[CFG.radio][0] || (SONGS[track.def.id] ? track.def.id : SONG_FOR[track.def.id] || 'race1'));
    pickups = kind === 'trial' || kind === 'roam' ? null : new Pickups(track, scene);
    weapons = new Weapons(scene, track, fx);
    weapons.rank = rankCars;
    lapT = 0; lapStarted = false; wrongWay = 0; fans = 0;
    best = store.get(bestKey(), null);
    rec = []; recAcc = 0;
    loadGhost(kind === 'trial');
    // a fly-through of the track before races and time trials
    notes = kind === 'trial' && CFG.codriver !== 'off' ? paceNotes(track) : null;
    $('#h-notes').hidden = true;
    tape = { frames: [], acc: 0, n: 0 };
    if (kind === 'race' || kind === 'trial') startIntro(kind);
    $('#h-feed').innerHTML = '';
    chase(0, true);
    if (cup) feed(`${cup.name} · race ${cup.idx + 1}/${cup.tracks.length}`, 0);
    if (kind === 'trial') { if (!race.intro) { message('TIME TRIAL', 1.6); audio.beep(880, 0.25); } }
    else if (kind === 'roam') { feed('Find the golden ducks · race the rivals in the light', 0); audio.beep(880, 0.25); }
    else if (kind !== 'race') { message('GO!', 1.2); audio.beep(880, 0.25); }
}
// free roam: the world is built the first time and kept, then swapped in for the track
let world = null, roam = null;
function startRoam() {
    if (!world) world = buildWorld(TX);
    if (track !== world) {
        clearRace();
        if (track) scene.remove(track.group);
        track = world; trackDef = world.def;
        scene.add(world.group);
        scene.fog = new THREE.Fog('#a8b8c8', 80, 800);
        scene.background = new THREE.Color('#a8b8c8');
        drops.clear();
    }
    cup = null;
    startDrive('roam');
}
function leaveWorld() {
    if (roam) { roam.end(); roam = null; }
    if (track && track.isWorld) { rain.k = 1; rain.roamMode = null; rain.setOn(false); sunDisc.visible = true; loadTrack(trackById(CFG.track)); }
    setLabels(false);
}
function setLabels(roaming) {
    const p = $('.b-pos small'), t = $$('.b-time small');
    p.textContent = roaming ? 'Ducks' : 'Position';
    t[0].firstChild.textContent = roaming ? '' : 'Lap ';
    t[1].firstChild.textContent = roaming ? '' : 'Best ';
}
const roamApi = {
    scene, CFG, saveCfg, message, audio, fx, puff,
    newCar: (spec, slot) => newCar(spec, slot, false),
    addCar: (c) => { cars.push(c); },
    removeCar: (c) => { scene.remove(c.mesh.root); cars = cars.filter((o) => o !== c); },
    reset: (c) => resetCar(c),
    shake: (k) => { shake = Math.max(shake, k); },
    feed: (t, p, cls) => feed(t, p, cls),
    reward(text, pts) {
        const before = CFG.fansTotal;
        feed(text, pts, 'hot');
        CFG.fansTotal += pts; saveCfg();
        const u = CARS.find((s) => s.unlock && before < s.unlock && CFG.fansTotal >= s.unlock);
        if (u) setTimeout(() => message(`NEW CAR: ${u.name}`, 2.4), 1200);
    },
    get car() { return car; }, get T() { return T; },
    speedTxt,
    smashed() { ST.smash++; earn('Smash', 5); },
    env: { sun, hemi, scene, sunDisc, sunDir }
};
function toMenu(sub) {
    replay = null; flow = null;
    codriver.stop(); notes = null; $('#h-notes').hidden = true;
    if (race && race.intro > 0) endIntro();
    $('#intro').hidden = true; document.body.dataset.intro = '';
    if (photo) setPhoto(false);
    if (mapOpen) setMap(false);
    $('#h-drift').hidden = true; endDrift(false);
    leaveWorld();
    mode = 'menu';
    document.body.dataset.mode = 'menu';
    paused = false;
    cup = null;
    loadGhost(false);
    hideAll(); show('title');
    if (!car || cars.length > 1 || car.spec.id !== CFG.car) showCar(specFor(CFG.car));
    else showCar(specFor(CFG.car));
    cockpit.setVisible(false);
    setMenu(null);
    openCarousel(sub || 'main');
    syncOptions();
}

/* ---------- time trial: a ghost of your best lap ---------- */
let ghost = null, ghostMesh = null, rec = [], recAcc = 0;
const ghostKey = () => 'heind.rally.ghost.' + track.def.id;
function loadGhost(on) {
    if (ghostMesh) { scene.remove(ghostMesh.root); ghostMesh = null; }
    ghost = on ? store.get(ghostKey(), null) : null;
    if (!ghost) return;
    const m = makeCarMesh(carById(ghost.car));
    const gm = new THREE.MeshBasicMaterial({ color: '#3ad0ff', wireframe: true, fog: false });
    m.root.traverse((o) => { if (o.isMesh) { o.material = gm; o.layers.enable(GLOW); } });
    [m.bubble, m.flames, m.aura].forEach((o) => { o.visible = false; });
    m.root.visible = false;
    scene.add(m.root);
    ghostMesh = m;
}
function updGhost() {
    if (!ghostMesh) return;
    const p = ghost.p, f = lapT * 10, i = Math.floor(f), k = f - i;
    if (!lapStarted || (i + 1) * 4 + 3 >= p.length) { ghostMesh.root.visible = false; return; }
    const a = i * 4, b = a + 4, L = (n) => p[a + n] + (p[b + n] - p[a + n]) * k;
    let dh = p[b + 3] - p[a + 3]; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    ghostMesh.root.visible = true;
    ghostMesh.root.position.set(L(0), L(1), L(2));
    ghostMesh.root.rotation.y = p[a + 3] + dh * k;
}

// one lap-crossing check for every car; the player also gets lap times
function laps(c, dt) {
    const N = track.N, p = c.q.prog;
    if (c.lastProg > N * 0.75 && p < N * 0.25) {
        c.lapN++;
        if (race && race.kind === 'race' && !c.done && c.lapN > race.laps) finish(c);
        if (c === car && race && race.kind === 'race' && c.lapN === race.laps && !c.done) { message('FINAL LAP', 1.6); audio.beep(1100, 0.2); }
        if (c === car) {
            if (lapStarted) {
                const t = lapT;
                if (best == null || t < best) { best = t; store.set(bestKey(), t); feed(`Best Lap ${fmt(t)}`, 50, 'hot'); audio.beep(1320, 0.3); }
                else feed(`Lap ${fmt(t)}`, 10);
                // a faster lap becomes the new ghost
                if (race.kind === 'trial' && (!ghost || t < ghost.t) && rec.length > 20) {
                    store.set(ghostKey(), { t, car: CFG.car, p: rec }); ST.ghost = 1;
                    feed('New Ghost', 0, 'hot');
                    loadGhost(true);
                }
            }
            lapStarted = true; lapT = 0; rec = []; recAcc = 0;
        }
    } else if (c.lastProg < N * 0.25 && p > N * 0.75) { c.lapN--; if (c === car) lapStarted = false; }
    c.lastProg = p;
    if (c === car && lapStarted) lapT += dt;
}
function finish(c) {
    c.done = true; c.finishT = raceT;
    race.order.push(c);
    if (c === car) {
        const pos = race.order.length;
        message(`${ordinal(pos).toUpperCase()} PLACE!`, 3, pos > 3);
        feed(`Finished ${ordinal(pos)}`, [500, 300, 200, 100, 50, 40, 30, 20][pos - 1] || 10, 'hot');
        audio.fx(pos === 1 ? 'patch' : 'pickup');
        // the car drives itself from here; the results come up after a moment
        car.driver = new Driver(car, { name: 'You', style: 'careful' }, 0.82);
        results = 3;
    }
}
const nameOf = (c) => (c === car ? 'You' : c.driver ? c.driver.name : '—');
function bankFans() {
    if (banked) return [];
    banked = true;
    const before = CFG.fansTotal;
    CFG.fansTotal = before + fans;
    saveCfg();
    return CARS.filter((s) => s.unlock && before < s.unlock && CFG.fansTotal >= s.unlock);
}
function showResults() {
    race.showed = true;
    music.want(STATIONS[CFG.radio][0] || 'results');
    ST.races++;
    setTimeout(checkAch, 400);
    const order = [...race.order, ...rankCars().filter((c) => !c.done)];
    const win = race.order[0];
    const pos = order.indexOf(car) + 1;
    if (pos === 1) CFG.wins++;
    $('#res-title').textContent = cup ? `${cup.name.toLowerCase()} · race ${cup.idx + 1}` : 'results';
    $('#res-list').innerHTML = order.map((c, i) => {
        const time = c.done ? (c === win ? fmt(c.finishT) : '+' + (c.finishT - win.finishT).toFixed(2)) : 'racing';
        return `<li class="${c === car ? 'me' : ''}"><span>${i + 1}</span><b>${nameOf(c)}</b><i>${c.spec.name}</i><em>${time}</em></li>`;
    }).join('');
    let extra = '', buttons = [['restart', 'Race again'], ['replay', 'Replay'], ['next', 'Next track'], ['quit', 'Menu']];
    if (cup) {
        order.forEach((c, i) => { cup.points[nameOf(c)] = (cup.points[nameOf(c)] || 0) + CUP_POINTS[i]; });
        const table = Object.entries(cup.points).sort((a, b) => b[1] - a[1]);
        const last = cup.idx >= cup.tracks.length - 1;
        const mine = table.findIndex(([n]) => n === 'You') + 1;
        extra = `<p class="res-cup">${last ? 'final standings' : 'cup standings'}: ${table.slice(0, 4).map(([n, p], i) => `<b class="${n === 'You' ? 'me' : ''}">${i + 1}. ${n} ${p}</b>`).join(' ')}${mine > 4 ? ` <b class="me">${mine}. You ${cup.points.You}</b>` : ''}</p>`;
        if (last) {
            const bonus = [1000, 600, 300][mine - 1] || 0;
            if (bonus) { fans += bonus; extra += `<p class="unlock">${['Gold', 'Silver', 'Bronze'][mine - 1]} trophy! <b>+${bonus}</b> fans</p>`; }
            const prev = CFG.trophies[cup.id] || 9;
            if (mine < prev) CFG.trophies[cup.id] = mine;
            buttons = [['cupdone', 'Finish cup'], ['replay', 'Replay']];
        } else buttons = [['cupnext', 'Next race'], ['replay', 'Replay'], ['quit', 'Quit cup']];
    }
    const newly = bankFans();
    extra += newly.map((s) => `<p class="unlock">New car unlocked: <b>${s.name}</b></p>`).join('');
    $('#res-extra').innerHTML = extra;
    $('#res-fans').innerHTML = `Fans <b>+${fans}</b> &middot; total <b>${CFG.fansTotal}</b> <i class="heart">&#9829;</i>`;
    $('#res-menu').innerHTML = buttons.map(([a, l]) => `<button type="button" data-act="${a}">${l}</button>`).join('');
    show('results'); setMenu($('#res-menu'));
}
function startCup(id) {
    const c = CUPS.find((x) => x.id === id);
    const others = CARS.filter((s) => s.id !== CFG.car && !s.unlock);
    cup = Object.assign({}, c, { idx: 0, points: {}, lineup: RIVALS.map((info, r) => ({ info, spec: others[r % others.length] })) });
    cupRace();
}
function cupRace() {
    CFG.track = cup.tracks[cup.idx]; saveCfg();
    loadTrack(trackById(CFG.track));
    startDrive('race');
}
// the rocket start: when the throttle went down decides how you leave the line
function startBoosts() {
    const p = race.rev;
    if (p != null) {
        if (p >= 3.0) { car.w = (Math.random() < 0.5 ? -1 : 1) * 5; car.stall = 1.1; message('OVERREVVED!', 1.6, true); audio.fx('hit'); }
        else if (p >= 2.4) { car.nitro = 1.4; feed('Perfect Start', 50, 'hot'); ST.perfect++; audio.fx('nitro'); fx.tint('#4aff7a', 1.2); }
        else if (p >= 1.6) { car.nitro = 0.6; feed('Good Start', 20); }
    }
    for (const c of cars) if (c !== car) {
        const r = Math.random();
        if (r < 0.2) c.nitro = 1.4; else if (r < 0.55) c.nitro = 0.6; else if (r < 0.62) { c.w = 4; c.stall = 1; }
    }
}
function resetCar(c) {
    const s = track.S[c.q.i];
    c.place(s.x, s.y + 0.4, s.z, Math.atan2(s.tx, s.tz));
    c.lastGy = c.y; c.stuckT = 0;
    if (c === car) { chase(0, true); feed('Back on the road', 0); }
}
const mass = (c) => (c.spec.hp || 100) / 100 * (c.mesh.B.len / 4.2);
const circles = (c) => { const L = c.mesh.B.len * 0.27, fx_ = Math.sin(c.h), fz = Math.cos(c.h); return [[c.x + fx_ * L, c.z + fz * L], [c.x - fx_ * L, c.z - fz * L]]; };
function collide(a, b) {
    if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7 || Math.abs(a.y - b.y) > 2) return;
    const R = 2.3;     // two radii of 1.15
    let best = null;
    for (const [ax, az] of circles(a)) for (const [bx, bz] of circles(b)) {
        const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
        if (d < R && (!best || d < best.d)) best = { d: Math.max(d, 0.01), nx: dx / (d || 1), nz: dz / (d || 1), cx: (ax + bx) / 2, cz: (az + bz) / 2 };
    }
    if (!best) return;
    const { nx, nz } = best, ma = mass(a), mb = mass(b);
    const push = R - best.d;
    a.x -= nx * push * mb / (ma + mb); a.z -= nz * push * mb / (ma + mb);
    b.x += nx * push * ma / (ma + mb); b.z += nz * push * ma / (ma + mb);
    const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (rel <= 0) return;
    // a proper impulse: heavier cars shove lighter ones, a little bounce
    const j = (1 + 0.38) * rel / (1 / ma + 1 / mb);
    a.vx -= nx * j / ma; a.vz -= nz * j / ma; b.vx += nx * j / mb; b.vz += nz * j / mb;
    // off-centre hits turn the car: the further from the middle the contact, the more it spins
    for (const [c, sg, m] of [[a, 1, ma], [b, -1, mb]]) {
        const rx = best.cx - c.x, rz = best.cz - c.z;
        const torque = (rx * nz - rz * nx) * sg;
        c.w += clamp(-torque * j / m * 0.06, -3, 3);
    }
    if (rel > 3) sparks(best.cx, (a.y + b.y) / 2 + 0.6, best.cz, rel);
    if (rel > 9) for (const c of [a, b]) if (c.invuln <= 0 && c.wrecked <= 0 && c.shield <= 0) { c.health -= (rel - 9) * 1.8 * 100 / (c.spec.hp || 100); if (c.health <= 0) { c.health = 0; c.wreck(); fx.event(c, c === a ? b : a, 'wreck', 'crash'); } }
    if (a === car || b === car) {
        (a === car ? b : a).nmHit = T;
        if (rel > 6) endDrift(false);
        audio.thud(Math.min(1, rel / 12)); if (rel > 5) audio.fx('hit');
        shake = Math.max(shake, Math.min(1, rel / 14)); if (rel > 6) burst = Math.max(burst, 0.5);
    }
}
// bright sparks and a puff of grit where metal meets metal (or concrete)
function sparks(x, y, z, k) {
    const n = Math.min(14, 3 + k * 0.8);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 3 + Math.random() * k * 0.6; puff(x, y, z, i % 3 ? '#ffd27a' : '#ffffff', Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp, 0.35, 0.05, 0.25 + Math.random() * 0.2); }
    puff(x, y - 0.3, z, '#808a93', 0, 1, 0, 0.6, 2.4, 0.8);
}
// walls: what the car physics reported this step
function wallHit(c) {
    const k = c.impact || 0;
    c.impact = 0;
    if (k < 3) return;
    sparks(c.impactX, c.y + 0.5, c.impactZ, k);
    if (k > 12 && c.invuln <= 0 && c.wrecked <= 0 && c.shield <= 0) {
        c.health -= (k - 12) * 1.5 * 100 / (c.spec.hp || 100);
        if (c.health <= 0) { c.health = 0; c.wreck(); fx.event(c, null, 'wreck', 'crash'); }
    }
    if (c === car && k > 6) endDrift(false);
    if (c === car) { audio.thud(Math.min(1, k / 12)); if (k > 7) audio.fx('hit'); shake = Math.max(shake, Math.min(1, k / 16)); if (k > 9) burst = Math.max(burst, 0.5); }
}
// dust, spray and smoke for one car
function carFx(c) {
    const fx_ = Math.sin(c.h), fz = Math.cos(c.h);
    if (c.inPuddle && c.speed > 5) {
        if (c === car && !c.splashed) { audio.splash(); c.splashed = true; }
        for (let k = 0; k < 3; k++) puff(c.x + (Math.random() - 0.5) * 2, c.y + 0.3, c.z + (Math.random() - 0.5) * 2, '#c8d4e0', c.vx * 0.3 + (Math.random() - 0.5) * 6, 2 + Math.random() * 3, c.vz * 0.3 + (Math.random() - 0.5) * 6, 0.5, 2.2, 0.7);
    } else c.splashed = false;
    const surf = SURF[c.q.surface];
    const wet = track.wet;
    // the spark stars at the back wheels
    const kd = c.mk && c.mk.dir && c.ground;
    if (kd || c.sparkS) {
        const ss = sparkSprites(c), t = kd ? c.mk.tier : 0;
        ss.forEach((s, k) => {
            s.visible = !!kd;
            if (!kd) return;
            const flick = 0.75 + Math.random() * 0.5, size = (t ? 1.15 + t * 0.4 : 0.6) * flick;
            s.scale.set(size, size, 1);
            s.material.color.set(Math.random() < 0.15 ? '#ffffff' : SPARK[t]);
            s.material.rotation = Math.random() * Math.PI;
            s.position.y = 0.3 + Math.random() * 0.12;
        });
    }
    if (c.mk && c.mk.dir && c.ground) {
        const t = c.mk.tier, rx = -fz, rz = fx, back = c.mesh.B.len * 0.38;
        const n = t === 0 ? (Math.random() < 0.35 ? 1 : 0) : 1 + t;
        for (const sx of [-1, 1]) for (let k = 0; k < n; k++) {
            const px = c.x - fx_ * back + rx * sx * 0.85, pz = c.z - fz * back + rz * sx * 0.85;
            const out = (Math.random() * 2 + 1) * sx * -c.mk.dir;
            puff(px, c.y + 0.2, pz, k % 3 === 2 ? '#ffffff' : SPARK[t], rx * out - fx_ * 2 + (Math.random() - 0.5), 1 + Math.random() * 2.5, rz * out - fz * 2 + (Math.random() - 0.5), t ? 0.5 : 0.28, 0.05, 0.2 + Math.random() * 0.15);
        }
    }
    if (c.ground && c.speed > 5 && ((surf && surf.dust) || wet)) {
        const rate = (0.35 + c.speed / 40 + c.slip / 6) * (wet ? 0.5 : 1);
        if (Math.random() < rate) for (const sx of [-1, 1]) {
            const col = wet ? '#8a96a4' : surf.dust;
            puff(c.x - fx_ * 1.8 + fz * sx * 0.8, c.y + 0.2, c.z - fz * 1.8 - fx_ * sx * 0.8, col,
                c.vx * 0.12 + (Math.random() - 0.5) * 3, 0.4 + Math.random() * 0.8, c.vz * 0.12 + (Math.random() - 0.5) * 3,
                0.5, 2.2 + c.slip * 0.12 + c.speed * 0.03, 1.0 + Math.random() * 0.7);
        }
    }
    if ((c.wrecked > 0 || c.health < 35) && Math.random() < (c.wrecked > 0 ? 0.6 : 0.25)) puff(c.x + fx_ * 1.2, c.y + 1, c.z + fz * 1.2, c.wrecked > 0 ? '#2a3139' : '#4f5862', 0, 2.5, 0, 0.6, 2.8, 1.5);
}
const HOLD = { steer: 0, throttle: 0, brake: 1, handbrake: false };
function updDrive(dt) {
    if (race && race.intro > 0) {
        race.intro -= dt; race.introT += dt;
        for (const c of cars) { c.vx = c.vz = 0; c.w = 0; }
        if (race.intro <= 0) endIntro();
        return;
    }
    if (race && race.count > 0) {
        const thr = readDrive().throttle > 0;
        if (thr && race.rev == null) race.rev = race.count;
        if (!thr) race.rev = null;
        revHold = thr ? Math.min(1, revHold + dt * 1.4) : Math.max(0, revHold - dt * 2);
        const before = Math.ceil(race.count);
        race.count -= dt;
        const now = Math.ceil(race.count);
        if (now !== before) {
            if (now > 0) { message(String(now), 0.9); audio.beep(660, 0.18); }
            else { message('GO!', 1.2); audio.beep(1320, 0.35); burst = 0.6; startBoosts(); }
        }
    } else if (race) raceT += dt;
    // time trial: record the lap at ten frames a second
    if (race && race.kind === 'trial' && lapStarted) {
        recAcc += dt;
        while (recAcc >= 0.1) { recAcc -= 0.1; rec.push(+car.x.toFixed(1), +car.y.toFixed(2), +car.z.toFixed(1), +car.h.toFixed(3)); }
    }
    const ctx = { track, cars, weapons, rank: rankCars, player: car, pickups };
    for (const c of cars) {
        if (race && race.count > 0) { c.vx = c.vz = 0; c.w = 0; continue; }     // everyone waits for GO
        if (c.npc && c.npc.far) continue;
        const inp = c.npc ? roam.drive(c, cars) : c.driver ? c.driver.drive(ctx) : c === car ? readDrive() : botDrive(c);
        c.step(dt, inp);
        wallHit(c);
        if (!roam) laps(c, dt);
        if (c.wrecking && c.wrecked <= 0) { c.respawn(); c.wrecking = false; c.lapN = c.lapN; }
        const thr = race && race.count > 0 ? 0 : c === car && !c.driver ? readDrive().throttle : 1;
        c.stuckT = c.speed < 1 && thr && c.wrecked <= 0 ? c.stuckT + dt : 0;
        if (c.npc) { if (c.stuckT > 5 || c.y < c.q.y - 6 || (c.wrecking && c.wrecked <= 0)) roam.resetNpc(c); }
        else if (c.stuckT > 4 || c.y < c.q.y - 6 || (c === car && press('reset'))) resetCar(c);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collide(cars[i], cars[j]);
    const fwd = Math.sin(car.h) * car.q.tx + Math.cos(car.h) * car.q.tz;
    wrongWay = !roam && fwd < -0.3 && car.speed > 4 ? wrongWay + dt : 0;
    if (car.scrape > 0.6 && !car.scrapeSnd) { audio.thud(car.scrape); car.scrapeSnd = true; }
    if (car.scrape < 0.1) car.scrapeSnd = false;
    if (!(race && race.count > 0) && !car.done) driving(dt);
    if (car.hopped) { car.hopped = false; audio.thud(0.25); }
    if (car.mkTierUp) { const t = car.mkTierUp; car.mkTierUp = 0; audio.beep(520 + t * 260, 0.07); car.flashAura(SPARK[t], 0.25); }
    if (car.mkBoost) {
        const t = car.mkBoost; car.mkBoost = 0;
        audio.fx('nitro'); fx.tint(SPARK[t], 0.5 + t * 0.15); burst = Math.max(burst, 0.4 + t * 0.2); car.flashAura(SPARK[t], 0.6);
        earn(['', 'Boost', 'Super Boost', 'Ultra Boost'][t], [0, 10, 25, 50][t]);
    }
    if (car.mkLost) { car.mkLost = false; feed('Boost lost', 0, 'bad'); }
    if (race && (race.kind === 'race' || race.kind === 'trial') && race.count <= 0 && !race.showed && tape.frames.length < 9000) {
        tape.acc += dt;
        while (tape.acc >= 0.1) { tape.acc -= 0.1; recordFrame(); }
    }
    if (car.land > 0.5 && !car.landSnd) { audio.thud(car.land); car.landSnd = true; burst = Math.max(burst, car.land); }
    if (car.land < 0.1) car.landSnd = false;
}

/* ---------- things that earn fans anywhere: drifts, near misses, jumps ---------- */
const drift = { on: false, score: 0, mult: 1, t: 0, calm: 0 };
let air0 = null, achT = 0;
// fans: free roam banks them straight away, races at the finish
const earn = (text, pts, cls = 'hot') => { if (roam) roamApi.reward(text, pts); else feed(text, pts, cls); };
function endDrift(ok) {
    if (!drift.on) return;
    const total = Math.round(drift.score * drift.mult);
    if (ok && total >= 150) { earn(`Drift ×${drift.mult} · ${total.toLocaleString('en')}`, Math.round(total / 25)); ST.drift = Math.max(ST.drift, total); ST.drifts++; }
    else if (!ok && total >= 150) feed('Drift lost', 0, 'bad');
    Object.assign(drift, { on: false, score: 0, mult: 1, t: 0, calm: 0 });
}
function driving(dt) {
    const c = car;
    ST.km += c.speed * dt / 1000;
    ST.top = Math.max(ST.top, Math.round(c.speed * 3.6));
    // drift: sliding sideways at speed; the longer it lasts, the bigger the multiplier
    const ang = Math.abs(angDiff(Math.atan2(c.vx, c.vz), c.h));
    if (c.wrecked > 0) endDrift(false);
    else if (c.ground && c.speed > 11 && ((c.mk && c.mk.dir) || c.slip > 3.2) && ang < 1.9 && c.vf > 0) {
        drift.on = true; drift.calm = 0; drift.t += dt;
        drift.score += dt * (c.mk && c.mk.dir ? c.speed * 4.5 : c.slip * 32);
        drift.mult = Math.min(5, 1 + Math.floor(drift.t / 1.5));
    } else if (drift.on && c.ground && (drift.calm += dt) > 0.6) endDrift(true);
    // near misses: something passes close and fast without touching
    for (const o of cars) {
        if (o === c || (o.npc && o.npc.far)) continue;
        const d = Math.hypot(o.x - c.x, o.z - c.z);
        if (d < 7) { o.nm = o.nm || { min: d, rel: 0 }; o.nm.min = Math.min(o.nm.min, d); o.nm.rel = Math.max(o.nm.rel, Math.hypot(o.vx - c.vx, o.vz - c.vz)); }
        else if (o.nm && d > 9) {
            if (o.nm.min < 3.6 && o.nm.rel > 11 && c.speed > 14 && !(T - (o.nmHit || -9) < 2)) { earn('Near Miss', 15); ST.near++; }
            o.nm = null;
        }
    }
    // jumps: how far from take-off to landing
    if (!c.ground && !air0 && c.wrecked <= 0) air0 = { x: c.x, z: c.z };
    if (c.ground && air0) {
        const dist = Math.hypot(c.x - air0.x, c.z - air0.z);
        if (c.air > 0.6 && dist > 12) {
            earn(`Jump ${Math.round(dist)} m`, Math.round(dist * (dist > 40 ? 1.5 : 1)));
            ST.jump = Math.max(ST.jump, Math.round(dist));
            if (roam) roam.jumpRecord(air0.x, air0.z, dist);
        }
        air0 = null;
    }
    if ((achT += dt) > 1) { achT = 0; checkAch(); }
}

/* ---------- trophies ---------- */
const roamSave = () => CFG.roam || { ducks: [], won: {}, traps: {}, jumps: {} };
const ACH = [
    ['first', 'First Blood', 'Win a race', () => CFG.wins >= 1],
    ['wins5', 'On a Roll', 'Win five races', () => CFG.wins >= 5],
    ['wins20', 'Champion', 'Win twenty races', () => CFG.wins >= 20],
    ['gold', 'Silverware', 'Take gold in any cup', () => Object.values(CFG.trophies).includes(1)],
    ['allgold', 'Triple Crown', 'Take gold in every cup', () => CUPS.every((c) => CFG.trophies[c.id] === 1)],
    ['perfect', 'Launch Control', 'Nail a perfect start', () => ST.perfect >= 1],
    ['takedown', 'Takedown', 'Wreck a rival with a power-up', () => ST.takedown >= 1],
    ['takedown10', 'Demolition', 'Ten takedowns', () => ST.takedown >= 10],
    ['drift1', 'Sideways', 'Score 1,000 in one drift', () => ST.drift >= 1000],
    ['drift2', 'Tyre Smoke', 'Score 5,000 in one drift', () => ST.drift >= 5000],
    ['near', 'Close Shave', 'Ten near misses', () => ST.near >= 10],
    ['speed1', 'Two Hundred', `Reach 200 km/h`, () => ST.top >= 200],
    ['speed2', 'Warp Speed', `Reach 250 km/h`, () => ST.top >= 250],
    ['km', 'Road Trip', 'Drive 50 km in total', () => ST.km >= 50],
    ['jump', 'Airtime', 'Jump 50 metres', () => ST.jump >= 50],
    ['duck', 'Lucky Duck', 'Find a golden duck', () => roamSave().ducks.length >= 1],
    ['ducks', 'Duck Hunter', 'Find all sixteen golden ducks', () => roamSave().ducks.length >= 16],
    ['rival', 'Street Cred', 'Beat a rival in free roam', () => Object.keys(roamSave().won).length >= 1],
    ['rivals', 'King of the Streets', 'Beat every free roam rival', () => Object.keys(roamSave().won).length >= 6],
    ['traps', 'Flash!', 'Set a speed at every speed trap', () => Object.keys(roamSave().traps || {}).length >= 6],
    ['smash', 'Wrecking Ball', 'Smash 50 cones and crates', () => ST.smash >= 50],
    ['night', 'Night Owl', 'Drive free roam at midnight', () => roam && (roam.atmos.hour > 23.5 || roam.atmos.hour < 0.5)],
    ['storm', 'Storm Chaser', 'Drive through a thunderstorm', () => roam && roam.atmos.kind === 'storm' && roam.atmos.cur.storm > 0.6],
    ['garage', 'Fresh Paint', 'Customise a car', () => ST.painted >= 1],
    ['ghost', 'Ghost Writer', 'Save a ghost in time trial', () => ST.ghost >= 1],
    ['weird', 'Collector', 'Unlock every car', () => CARS.every((s) => unlocked(s))]
];
function checkAch() {
    for (const [id, name, , test] of ACH) {
        if (CFG.ach[id]) continue;
        let ok = false; try { ok = test(); } catch (e) { ok = false; }
        if (!ok) continue;
        CFG.ach[id] = Date.now();
        toast(`Trophy: ${name}`);
        audio.fx('patch');
    }
    saveCfg();
}
let toastT = 0;
function toast(text) {
    const el = $('#toast');
    el.textContent = text; el.hidden = false;
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200);
}
function openTrophies() {
    const got = ACH.filter(([id]) => CFG.ach[id]).length;
    $('#tr-sum').textContent = `${got} of ${ACH.length} trophies`;
    $('#tr-list').innerHTML = ACH.map(([id, name, desc]) => `<li class="${CFG.ach[id] ? 'got' : ''}"><b>${name}</b><i>${desc}</i></li>`).join('');
    const rs = roamSave();
    const stat = [['Races', ST.races], ['Wins', CFG.wins], ['Fans', CFG.fansTotal.toLocaleString('en')], ['Distance', `${ST.km.toFixed(1)} km`], ['Top speed', speedTxt(ST.top / 3.6)],
        ['Best drift', ST.drift.toLocaleString('en')], ['Longest jump', `${ST.jump} m`], ['Near misses', ST.near], ['Takedowns', ST.takedown], ['Smashed', ST.smash], ['Golden ducks', `${rs.ducks.length}/16`], ['Rivals beaten', `${Object.keys(rs.won).length}/6`]];
    $('#tr-stats').innerHTML = stat.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    openPanel('trophies');
}

/* ---------- photo mode: freeze, hide the HUD, orbit the car ---------- */
let photo = null;
function setPhoto(on) {
    if (mode !== 'drive') return;
    if (on) {
        photo = { yaw: car.h + Math.PI * 0.8, pitch: 0.22, dist: 8 };
        paused = true; show('pause', false); setMenu(null); show('hud', false); $('#photo-hint').hidden = false;
    } else {
        photo = null; paused = false; show('hud', true); $('#photo-hint').hidden = true;
    }
}
function photoCam(dt) {
    car.mesh.root.visible = true; if (shadow) shadow.visible = true;
    const k = (a) => (keys.has(a) ? 1 : 0);
    photo.yaw += (k('right') - k('left')) * dt * 1.6;
    if (keys.has('hand')) photo.dist = clamp(photo.dist + (k('down') - k('up')) * dt * 8, 3, 30);
    else photo.pitch = clamp(photo.pitch + (k('up') - k('down')) * dt * 1.1, -0.05, 1.4);
    const p = photo, cy = Math.cos(p.pitch);
    cam.position.set(car.x + Math.sin(p.yaw) * cy * p.dist, car.y + 0.8 + Math.sin(p.pitch) * p.dist, car.z + Math.cos(p.yaw) * cy * p.dist);
    cam.lookAt(car.x, car.y + 0.8, car.z);
    cam.fov = 45; cam.clearViewOffset(); cam.updateProjectionMatrix();
}

/* ---------- the world map ---------- */
let mapOpen = false, mapToWorld = null;
function setMap(on) {
    if (!roam || mode !== 'drive') return;
    mapOpen = on;
    paused = on;
    show('wmap', on); show('hud', !on); show('pause', false); setMenu(null);
    if (on) {
        mapToWorld = roam.drawBigMap($('#wmap-c'));
        const p = roam.progress();
        $('#wm-prog').innerHTML = [['Golden ducks', p.ducks], ['Rivals beaten', p.rivals], ['Speed traps', p.traps], ['Ramp records', p.jumps]].map(([k, [a, b]]) => `<dt>${k}</dt><dd>${a}/${b}</dd>`).join('')
            + Object.entries(p.per).map(([k, [a, b]]) => `<dt class="sub">${title(k)} ducks</dt><dd class="sub">${a}/${b}</dd>`).join('');
        audio.beep(880, 0.05);
    }
}
$('#wmap-c').addEventListener('click', (e) => {
    if (!mapOpen || !mapToWorld) return;
    const r = e.currentTarget.getBoundingClientRect(), N = e.currentTarget.width;
    const [wx, wz] = mapToWorld((e.clientX - r.left) / r.width * N, (e.clientY - r.top) / r.height * N);
    if (roam.travel(wx, wz)) { setMap(false); chase(0, true); message('FAST TRAVEL', 1.2); audio.fx('whoosh'); }
    else message('NOT DURING A SPRINT', 1.4, true);
});

/* ---------- race intro: three camera shots, then the countdown ---------- */
/* ---------- replays: a tape of every car, played back by a camera director ---------- */
let tape = { frames: [], acc: 0, n: 0 }, replay = null;
const RW = 10;
function recordFrame() {
    const f = new Float32Array(cars.length * RW);
    cars.forEach((c, k) => {
        const o = k * RW;
        f[o] = c.x; f[o + 1] = c.y; f[o + 2] = c.z; f[o + 3] = c.h; f[o + 4] = c.pitch; f[o + 5] = c.roll + c.flip;
        f[o + 6] = c.nitro > 0 ? 1 : 0; f[o + 7] = c.braking ? 1 : 0; f[o + 8] = c.speed;
        f[o + 9] = c.mk && c.mk.dir ? c.mk.dir * (c.mk.tier + 1) : 0;
    });
    tape.frames.push(f); tape.n = cars.length;
}
function startReplay() {
    if (tape.frames.length < 20 || tape.n !== cars.length) { message('NO REPLAY', 1.2, true); return; }
    replay = {
        t: 0, speed: 1, playing: true, focus: Math.max(0, cars.indexOf(car)), shot: null, shotN: 0, len: (tape.frames.length - 1) * 0.1,
        save: cars.map((c) => ({ x: c.x, y: c.y, z: c.z, h: c.h, vx: c.vx, vz: c.vz, vy: c.vy, w: c.w, pitch: c.pitch, roll: c.roll, flip: c.flip, q: c.q, hint: c.hint, lastGy: c.lastGy, nitro: c.nitro }))
    };
    mode = 'replay'; document.body.dataset.mode = 'replay';
    show('results', false); show('hud', false); setMenu(null);
    $('#replay').hidden = false;
    $('#rp-name').textContent = trackById(CFG.track).name;
    cockpit.setVisible(false);
    audio.beep(880, 0.08);
    poseReplay(0);
    replay.shot = nextShot();
}
function exitReplay() {
    if (!replay) return;
    cars.forEach((c, k) => Object.assign(c, replay.save[k]));
    cars.forEach((c) => { if (c.mk) Object.assign(c.mk, { dir: 0, tier: 0, charge: 0, pend: false }); c.sync(0); });
    replay = null;
    mode = 'drive'; document.body.dataset.mode = 'drive';
    $('#replay').hidden = true;
    show('results', true); setMenu($('#res-menu'));
    cockpit.setVisible(CFG.view === 'cockpit');
}
function poseReplay(dt) {
    const F = tape.frames, f = Math.min(replay.t / 0.1, F.length - 1.001), i = Math.floor(f), k = f - i, A = F[i], B = F[Math.min(i + 1, F.length - 1)];
    cars.forEach((c, n) => {
        const o = n * RW, L = (j) => A[o + j] + (B[o + j] - A[o + j]) * k;
        c.x = L(0); c.y = L(1); c.z = L(2);
        c.h = A[o + 3] + angDiff(B[o + 3], A[o + 3]) * k;
        c.pitch = L(4); c.roll = L(5); c.flip = 0;
        c.nitro = A[o + 6] > 0.5 ? 0.3 : 0; c.braking = A[o + 7] > 0.5;
        c.speed = L(8); c.vf = c.speed; c.vx = Math.sin(c.h) * c.speed; c.vz = Math.cos(c.h) * c.speed; c.slip = 0;
        c.invuln = 0; c.ground = true; c.wrecked = 0; c.shield = 0;
        const kd = A[o + 9];
        c.mk = Object.assign(c.mk || {}, { dir: Math.sign(kd), tier: Math.max(0, Math.abs(kd) - 1), yaw: c.mk ? c.mk.yaw : 0 });
        c.q = track.query(c.x, c.z, c.q ? c.q.i : null);
        c.wheelSpin += c.speed * dt / c.mesh.B.wheelR;
        c.sync(0);
        if (dt > 0) carFx(c);
    });
}
// the director: mostly long-lens trackside cameras that pan as the car goes by, cut with helicopter,
// low chase, tracking and head-on shots
const SHOTS = ['track', 'track', 'heli', 'track', 'low', 'track', 'side', 'track', 'front'];
function nextShot() {
    const c = cars[replay.focus], S = track.S, N = track.N, kind = SHOTS[replay.shotN++ % SHOTS.length];
    if (kind === 'track') {
        const j = (c.q.i + 40 + ((Math.random() * 30) | 0)) % N, s = S[j], side = Math.random() < 0.5 ? 1 : -1, off = s.w / 2 + 5 + Math.random() * 9;
        const x = s.x + s.sx * off * side, z = s.z + s.sz * off * side;
        return { kind, x, z, y: Math.max(s.y + 1.2 + Math.random() * 4, track.query(x, z, j).y + 0.8), j, t: 0, max: 9 };
    }
    return { kind, t: 0, max: kind === 'heli' ? 5 : 4, side: Math.random() < 0.5 ? 1 : -1 };
}
function replayCam(dt) {
    const c = cars[replay.focus], fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx, N = track.N;
    let sh = replay.shot;
    sh.t += dt * replay.speed;
    if (sh.kind === 'track') {
        const past = ((c.q.i - sh.j) % N + N) % N, d = Math.hypot(sh.x - c.x, sh.z - c.z);
        if ((past > 14 && past < N / 2) || sh.t > sh.max || d > 170) sh = replay.shot = nextShot();
    } else if (sh.t > sh.max) sh = replay.shot = nextShot();
    let px, py, pz, look = [c.x, c.y + 0.8, c.z], fov = 48;
    if (sh.kind === 'track') {
        px = sh.x; py = sh.y; pz = sh.z;
        const d = Math.hypot(px - c.x, py - c.y, pz - c.z);
        fov = clamp(2 * Math.atan(4.5 / d) * 180 / Math.PI * 1.6, 7, 55);           // zoom to keep the car framed
    } else if (sh.kind === 'heli') { px = c.x - fx * 18 + rx * sh.side * 14; pz = c.z - fz * 18 + rz * sh.side * 14; py = c.y + 22; fov = 40; }
    else if (sh.kind === 'low') { px = c.x - fx * 4.6 + rx * sh.side * 1.3; pz = c.z - fz * 4.6 + rz * sh.side * 1.3; py = c.y + 0.6; look = [c.x + fx * 12, c.y + 0.9, c.z + fz * 12]; fov = 64; }
    else if (sh.kind === 'side') { px = c.x + rx * sh.side * 6.5 + fx; pz = c.z + rz * sh.side * 6.5 + fz; py = c.y + 1.1; fov = 46; }
    else { px = c.x + fx * 9 + rx * sh.side * 2; pz = c.z + fz * 9 + rz * sh.side * 2; py = c.y + 1; fov = 44; }
    if (sh.kind !== 'track') py = Math.max(py, track.query(px, pz, c.q.i).y + 0.5);
    cam.position.set(px, py, pz);
    cam.lookAt(look[0], look[1], look[2]);
    cam.fov = fov; cam.clearViewOffset(); cam.updateProjectionMatrix();
}
const RSPEEDS = [0.25, 0.5, 1, 2, 4];
function updReplay(dt) {
    const r = replay;
    if (press('ok') || press('back') || press('pause')) { exitReplay(); return; }
    if (press('hand')) r.playing = !r.playing;
    if (press('mup')) r.speed = RSPEEDS[Math.min(RSPEEDS.length - 1, RSPEEDS.indexOf(r.speed) + 1)];
    if (press('mdown')) r.speed = RSPEEDS[Math.max(0, RSPEEDS.indexOf(r.speed) - 1)];
    if (press('cycle')) { r.focus = (r.focus + 1) % cars.length; r.shot = nextShot(); }
    const seek = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    let step = r.playing ? dt * r.speed : 0;
    if (seek) { step = seek * dt * 8; }
    r.t = clamp(r.t + step, 0, r.len);
    if (r.t >= r.len && !seek) { r.t = 0; r.shot = nextShot(); }          // loop
    poseReplay(Math.abs(step));
    replayCam(dt);
    const c = cars[r.focus], pos = race.order.indexOf(c);
    setText('rp-car', `${nameOf(c)} · ${c.spec.name}${pos >= 0 ? ` · P${pos + 1}` : ''}`);
    setText('rp-time', `${fmt(r.t)} / ${fmt(r.len)}`);
    setText('rp-speed', r.playing ? `×${r.speed}` : 'PAUSED');
    $('#rp-bar').style.setProperty('--p', (r.t / r.len).toFixed(4));
}

const SHOT = 2.3;
function startIntro(kind) {
    race.intro = SHOT * 3; race.introT = 0;
    cockpit.setVisible(false);
    const t = trackById(CFG.track);
    $('#in-round').textContent = cup ? `${cup.name} · race ${cup.idx + 1}/${cup.tracks.length}` : kind === 'trial' ? 'time trial' : 'race';
    $('#in-name').textContent = t.name;
    $('#in-blurb').textContent = title(t.blurb);
    $('#in-meta').textContent = `${kind === 'trial' ? 'beat your ghost' : `${race.laps} laps · 8 cars`} · ${title(track.def.rain ? 'rain' : track.def.snowfall ? (t.weather === 'snow' || CFG.weather === 'snow' ? 'snow' : t.weather) : 'dry')}`;
    const el = $('#intro'); el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    document.body.dataset.intro = '1';
    introCam(0);
}
function endIntro() {
    if (!race || !race.intro && $('#intro').hidden) return;
    race.intro = 0;
    $('#intro').hidden = true;
    document.body.dataset.intro = '';
    cockpit.setVisible(CFG.view === 'cockpit');
    chase(0, true);
    if (race.kind === 'trial') { message('TIME TRIAL', 1.6); audio.beep(880, 0.25); }
}
function introCam(t) {
    const S = track.S, N = track.N, at = (i) => S[((Math.round(i) % N) + N) % N];
    const shot = Math.min(2, Math.floor(t / SHOT)), u = Math.min(1, (t - shot * SHOT) / SHOT), e = u * u * (3 - 2 * u);
    let px, py, pz, look;
    if (shot === 0) {
        // a high crane shot sweeping along the far side of the track
        const i = N * 0.3 + e * 40, s = at(i);
        px = s.x + s.sx * 24; pz = s.z + s.sz * 24; py = s.y + 28 - e * 12;
        const l = at(i + 30); look = [l.x, l.y, l.z];
    } else if (shot === 1) {
        // low by the roadside, panning as the road unwinds past the lens
        const s = at(N * 0.62), side = s.w / 2 + 3;
        px = s.x - s.sx * side; pz = s.z - s.sz * side; py = s.y + 1.4;
        const l = at(N * 0.62 - 35 + e * 70); look = [l.x, l.y + 1, l.z];
    } else {
        // swing round the grid and settle in behind your car
        const a = car.h + 0.4 + e * (Math.PI - 0.4), r = 16 - e * 9.4;
        px = car.x + Math.sin(a) * r; pz = car.z + Math.cos(a) * r; py = car.y + 7 - e * 4.4;
        const f = e * 4; look = [car.x + Math.sin(car.h) * f, car.y + 1.1, car.z + Math.cos(car.h) * f];
    }
    const g = track.query(px, pz, shot === 2 ? car.q.i : null).y;
    py = Math.max(py, g + 1.2);
    cam.position.set(px, py, pz);
    cam.lookAt(look[0], look[1], look[2]);
    cam.fov = 52; cam.clearViewOffset(); cam.updateProjectionMatrix();
    camH = car.h; camY = car.y + 2.6;
}

/* ---------- pace notes in the time trial ---------- */
let notes = null, notesHTML = '';
const codriver = new CoDriver();
function updNotes() {
    const el = $('#h-notes');
    if (!lapStarted && race.kind === 'trial' && car.speed < 1 && !race.intro) { /* still show the first calls on the line */ }
    if (race.intro > 0) { el.hidden = true; return; }
    const N = track.N, seg = track.seg || 2, p = car.q.prog;
    const ahead = notes.map((o) => ({ o, d: (((o.i - p) % N) + N) % N * seg })).filter((a) => a.d < 380).sort((a, b) => a.d - b.d).slice(0, 3);
    for (const { o, d } of ahead) {
        const callAt = Math.max(70, car.speed * 3.4);
        if (!o.called && d < callAt) {
            o.called = true;
            if (CFG.codriver === 'voice' && CFG.sound && !o.silent) {
                let text = o.say;
                if (o.into) { const nx = notes[(o.id + 1) % notes.length]; text += ` into ${nx.say}`; nx.silent = true; }
                codriver.say(text);
            }
        }
    }
    for (const o of notes) { const d = (((o.i - p) % N) + N) % N * seg; if (d > 420) { o.called = false; o.silent = false; } }
    el.hidden = !ahead.length;
    const html = ahead.map(({ o, d }, n) => `<div class="pn${n ? '' : ' next'}"><img src="${noteIcon(o)}" alt=""><b>${o.text}</b><small>${o.into && n === 0 ? 'into · ' : ''}${Math.round(d / 10) * 10} m</small></div>`).join('');
    if (html !== notesHTML) { notesHTML = html; el.innerHTML = html; }
}

function engineSound() {
    if (!car) return;
    const inp = mode === 'drive' && !paused ? readDrive() : { throttle: 0 };
    const r = clamp(car.speed / car.spec.maxSpeed, 0, 1.05);
    const gears = [0, 0.22, 0.4, 0.58, 0.76, 1.1];
    let g = 1; while (g < 5 && r > gears[g]) g++;
    const lo = gears[g - 1], hi = gears[g];
    let rpm = 0.25 + 0.75 * clamp((r - lo) / (hi - lo), 0, 1);
    if (!car.ground) rpm = Math.min(1, rpm + inp.throttle * 0.3);
    if (race && race.count > 0 && mode === 'drive') rpm = 0.25 + revHold * 0.7 + (revHold >= 1 ? Math.sin(performance.now() / 25) * 0.05 : 0);
    const rough = { dirt: 0.5, gravel: 0.7, sand: 0.6, snow: 0.3, tarmac: 0.05, verge: 0.8, grass: 0.9, mud: 0.6, cobble: 0.8, jungle: 0.9, concrete: 0.1 }[car.q.surface] || 0.5;
    lastRpm = rpm; lastGear = g;
    audio.update(mode === 'drive' ? rpm : 0.2, paused ? 0 : inp.throttle, paused ? 0 : car.slip, paused || mode !== 'drive' ? 0 : car.speed, rough, !car.ground);
}

/* ---------- main menu: the card carousel ---------- */
const iconCache = {};
function cardIcon(kind) {
    if (iconCache[kind]) return iconCache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#9ff0ff'; x.strokeStyle = '#9ff0ff'; x.lineCap = 'round'; x.lineJoin = 'round';
    const circle = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
    if (kind === 'race') { x.fillRect(10, 6, 3, 36); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) x.fillRect(13 + i * 6, 7 + j * 6, 6, 6); x.lineWidth = 1; x.strokeRect(13.5, 7.5, 24, 18); }
    if (kind === 'tracks') { x.lineWidth = 6; x.beginPath(); x.moveTo(8, 42); x.bezierCurveTo(8, 22, 38, 30, 34, 14); x.stroke(); x.lineWidth = 1.5; x.strokeStyle = '#0a1830'; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(8, 42); x.bezierCurveTo(8, 22, 38, 30, 34, 14); x.stroke(); x.setLineDash([]); circle(34, 10, 6); x.fillStyle = '#0a1830'; circle(34, 10, 2.5); }
    if (kind === 'garage') { x.beginPath(); x.moveTo(4, 30); x.lineTo(8, 22); x.lineTo(16, 20); x.lineTo(22, 12); x.lineTo(34, 12); x.lineTo(40, 20); x.lineTo(45, 23); x.lineTo(45, 31); x.lineTo(4, 31); x.fill(); x.fillStyle = '#0a1830'; x.fillRect(23, 14, 9, 6); circle(14, 32, 6); circle(36, 32, 6); x.fillStyle = '#9ff0ff'; circle(14, 32, 3); circle(36, 32, 3); }
    if (kind === 'options') { for (let i = 0; i < 8; i++) { x.save(); x.translate(24, 24); x.rotate(i * Math.PI / 4); x.fillRect(-4, -20, 8, 10); x.restore(); } circle(24, 24, 14); x.fillStyle = '#0a1830'; circle(24, 24, 6); }
    if (kind === 'controls') { x.beginPath(); x.roundRect(4, 14, 40, 22, 10); x.fill(); x.fillStyle = '#0a1830'; x.fillRect(11, 23, 10, 4); x.fillRect(14, 20, 4, 10); circle(33, 22, 2.5); circle(38, 27, 2.5); }
    if (kind === 'cup') { x.beginPath(); x.moveTo(12, 8); x.lineTo(36, 8); x.lineTo(33, 24); x.quadraticCurveTo(24, 32, 15, 24); x.closePath(); x.fill(); x.fillRect(22, 28, 4, 8); x.fillRect(15, 36, 18, 5); x.lineWidth = 3; x.beginPath(); x.arc(12, 14, 5, Math.PI * 0.5, Math.PI * 1.5); x.stroke(); x.beginPath(); x.arc(36, 14, 5, -Math.PI * 0.5, Math.PI * 0.5); x.stroke(); }
    if (kind === 'trial') { circle(24, 27, 16); x.fillRect(21, 5, 6, 6); x.fillStyle = '#0a1830'; circle(24, 27, 12); x.fillStyle = '#9ff0ff'; x.fillRect(23, 17, 2, 11); x.fillRect(23, 26, 8, 2); }
    if (kind === 'world') { circle(24, 24, 18); x.fillStyle = '#0a1830'; circle(24, 24, 15); x.fillStyle = '#9ff0ff'; x.beginPath(); x.moveTo(12, 14); x.lineTo(22, 12); x.lineTo(26, 20); x.lineTo(18, 26); x.lineTo(20, 34); x.lineTo(13, 30); x.fill(); x.beginPath(); x.moveTo(28, 28); x.lineTo(36, 24); x.lineTo(37, 34); x.lineTo(30, 37); x.fill(); }
    if (kind === 'home') { x.beginPath(); x.moveTo(24, 6); x.lineTo(44, 24); x.lineTo(4, 24); x.fill(); x.fillRect(10, 24, 28, 18); x.fillStyle = '#0a1830'; x.fillRect(20, 30, 8, 12); }
    return (iconCache[kind] = inkify(c));
}
// recolour a menu icon for the comic look: cyan becomes paper, navy becomes ink, and an ink outline goes round it
function inkify(src) {
    const w = src.width, h = src.height, sx = src.getContext('2d'), img = sx.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 40) continue;
        const dark = d[i] + d[i + 1] + d[i + 2] < 200;
        d[i] = dark ? 13 : 255; d[i + 1] = dark ? 13 : 246; d[i + 2] = dark ? 18 : 224;
    }
    sx.putImageData(img, 0, 0);
    const out = document.createElement('canvas'); out.width = w + 6; out.height = h + 6;
    const o = out.getContext('2d'), sil = document.createElement('canvas'); sil.width = w; sil.height = h;
    const s2 = sil.getContext('2d'); s2.drawImage(src, 0, 0); s2.globalCompositeOperation = 'source-in'; s2.fillStyle = '#0d0d12'; s2.fillRect(0, 0, w, h);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [3, 3]]) o.drawImage(sil, 3 + dx, 3 + dy);
    o.drawImage(src, 3, 3);
    return out.toDataURL();
}
const MAIN_CARDS = [
    { label: 'race', icon: 'race', desc: 'Eight cars, three laps, every power-up', act: () => { cup = null; flow = 'race'; openCarousel('tracks'); } },
    { label: 'free roam', icon: 'world', desc: 'An open world: traffic, trains, rivals, hidden ducks, day and night', act: () => startRoam() },
    { label: 'cups', icon: 'cup', desc: 'Four races, points for every finish, a trophy at the end', act: () => openCarousel('cups') },
    { label: 'time trial', icon: 'trial', desc: 'Just you and the ghost of your best lap', act: () => { cup = null; flow = 'trial'; openCarousel('tracks'); } },
    { label: 'test drive', icon: 'tracks', desc: 'Free laps with power-ups and three practice cars', act: () => { cup = null; startDrive('test'); } },
    { label: 'tracks', icon: 'tracks', desc: 'Pick where to race', act: () => openCarousel('tracks') },
    { label: 'garage', icon: 'garage', desc: 'Choose your car and paint it', act: () => openGarage() },
    { label: 'trophies', icon: 'cup', desc: 'Trophies to earn and your career stats', act: () => openTrophies() },
    { label: 'options', icon: 'options', desc: 'Look, camera, weather, sound', act: () => openPanel('opts') },
    { label: 'controls', icon: 'controls', desc: 'Keyboard, gamepad and touch', act: () => openPanel('ctrls') },
    { label: 'heind.nl', icon: 'home', desc: 'Back to the homepage', act: () => { location.href = 'index.html'; } }
];
const cardIdx = (label) => MAIN_CARDS.findIndex((c) => c.label === label);
const cupCards = () => CUPS.map((c) => ({
    label: c.name.toLowerCase(), img: () => cardIcon('cup'),
    desc: `${c.tracks.map((t) => title(trackById(t).name)).join(' · ')}${CFG.trophies[c.id] ? ` · best: ${ordinal(CFG.trophies[c.id])}` : ''}`,
    act: () => startCup(c.id)
}));
let carousel = { kind: 'main', items: MAIN_CARDS, sel: 0 };
let flow = null;      // 'race' or 'trial' while picking a track and then a car
function trackCards() {
    return TRACKS.map((t) => ({
        label: t.name.toLowerCase(), desc: `${title(t.blurb)} · ${t.weather === 'dry' ? 'dry' : t.weather}`,
        img: () => thumb(t), act: () => { CFG.track = t.id; saveCfg(); clearTimeout(previewT); if (!trackDef || trackDef.id !== t.id) { loadTrack(trackById(CFG.track)); showCar(specFor(CFG.car)); } previewId = null; if (flow) openGarage(); else openCarousel('main', cardIdx('tracks')); }
    }));
}
// a little glowing outline of a track, for its card
const thumbs = {};
function thumb(t) {
    if (thumbs[t.id]) return thumbs[t.id];
    const curve = new THREE.CatmullRomCurve3(t.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const pts = curve.getSpacedPoints(120);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); });
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d'), sc = 36 / Math.max(x1 - x0, z1 - z0);
    x.lineJoin = 'round';
    const P = (p) => [42 - ((p.x - x0) * sc + (36 - (x1 - x0) * sc) / 2), 42 - ((p.z - z0) * sc + (36 - (z1 - z0) * sc) / 2)];
    for (const [w, col, dx] of [[7, '#0d0d12', 1.5], [7, '#0d0d12', 0], [3.5, '#fff6e0', 0]]) {
        x.strokeStyle = col; x.lineWidth = w; x.beginPath();
        pts.forEach((p, i) => { const [px, py] = P(p); i ? x.lineTo(px + dx, py + dx) : x.moveTo(px + dx, py + dx); });
        x.stroke();
    }
    const [sx0, sy0] = P(pts[0]); x.fillStyle = '#0d0d12'; x.fillRect(sx0 - 3.5, sy0 - 3.5, 7, 7); x.fillStyle = '#ff3d3d'; x.fillRect(sx0 - 2, sy0 - 2, 4, 4);
    return (thumbs[t.id] = c.toDataURL());
}
// browsing the track list rebuilds the world behind the menu, after a short pause so
// flicking past cards stays smooth; leaving without picking puts the saved track back
let previewT = 0, previewId = null;
function previewTrack(id) {
    clearTimeout(previewT);
    previewT = setTimeout(() => {
        if (mode !== 'menu' || !trackDef || trackDef.id === id) return;
        previewId = id; loadTrack(trackById(id)); showCar(specFor(CFG.car));
    }, 220);
}
function unpreview() {
    clearTimeout(previewT);
    if (previewId && trackDef && trackDef.id !== CFG.track) { loadTrack(trackById(CFG.track)); showCar(specFor(CFG.car)); }
    previewId = null;
}
function openCarousel(kind, sel) {
    if (kind !== 'tracks') unpreview();
    hideAll(); show('title');
    music.want('menu');
    mode = 'menu'; menu = null;
    const items = kind === 'tracks' ? trackCards() : kind === 'cups' ? cupCards() : MAIN_CARDS;
    const start = sel != null ? sel : kind === 'tracks' ? Math.max(0, TRACKS.indexOf(trackById(CFG.track))) : 0;
    carousel = { kind, items, sel: start };
    $('#carousel').innerHTML = items.map((it, i) => `<button type="button" class="bcard" data-card="${i}"><span class="ctag">${it.label}</span><img src="${it.img ? it.img() : cardIcon(it.icon)}" alt=""></button>`).join('');
    $('#m-back').hidden = kind === 'main';
    if (kind !== 'tracks') flow = null;
    const st = $('#m-step'); st.hidden = !(flow && kind === 'tracks');
    if (!st.hidden) st.innerHTML = `${flow === 'race' ? 'Race' : 'Time trial'} · step 1 of 2 · <b>pick a track</b>`;
    placeCards();
}
function placeCards() {
    const { items, sel } = carousel;
    $$('.bcard').forEach((c, i) => {
        const k = i - sel, ak = Math.abs(k);
        c.style.transform = `translateX(calc(var(--gp) * ${k * 64})) translateZ(calc(var(--gp) * ${-ak * 42})) rotateY(${-k * 26}deg)`;
        c.style.opacity = ak > 3 ? 0 : 1 - ak * 0.2;
        c.style.zIndex = 10 - ak;
        c.classList.toggle('on', k === 0);
    });
    if (carousel.kind === 'tracks') previewTrack(TRACKS[sel].id);
    $('#m-label').textContent = items[sel].label;
    $('#m-desc').textContent = items[sel].desc;
    const t = trackById(CFG.track), b = store.get('heind.rally.best.' + t.id, null);
    const nu = nextUnlock();
    $('#m-status').innerHTML = `&#9829; ${CFG.fansTotal} fans · ${nu ? `next car at ${nu.unlock}` : 'every car unlocked'} · ${t.name} · best ${fmt(b)}`;
    $('.bbar').style.setProperty('--fill', nu ? Math.min(1, CFG.fansTotal / nu.unlock) : 1);
}
$('#carousel').addEventListener('click', (e) => {
    const c = e.target.closest('.bcard'); if (!c) return;
    const i = +c.dataset.card;
    if (i === carousel.sel) carousel.items[i].act(); else { carousel.sel = i; placeCards(); audio.beep(700, 0.04); }
});
function carouselInput() {
    if (mode !== 'menu' || $('#title').hidden) return;
    const n = carousel.items.length;
    if (press('left')) { carousel.sel = (carousel.sel + n - 1) % n; placeCards(); audio.beep(700, 0.04); }
    if (press('right')) { carousel.sel = (carousel.sel + 1) % n; placeCards(); audio.beep(700, 0.04); }
    if (press('ok')) { audio.beep(990, 0.06); carousel.items[carousel.sel].act(); }
    if (press('back') && carousel.kind !== 'main') { audio.beep(500, 0.06); const f = flow; flow = null; openCarousel('main', f ? cardIdx(f === 'race' ? 'race' : 'time trial') : cardIdx(carousel.kind)); }
}

/* ---------- garage: the cars in 3D, locked ones as silhouettes, and the paint shop ---------- */
let gIdx = 0, gCustom = false;
const PAINTS = ['#c4c9d0', '#e8e8e8', '#1c1f24', '#c8102e', '#e8562a', '#e8c020', '#4aff7a', '#3a6a4a', '#2a5aa8', '#3ad0ff', '#b04aff', '#ff5ab4', '#7a1a1a', '#6b6b80', '#f4e8f0', '#ffd23f'];
const RIMS = ['#a4a8b0', '#1c1f24', '#e8c020', '#e8e8e8', '#c8102e', '#3ad0ff', '#b04aff'];
const GLOWS = [null, '#3ad0ff', '#ff3a6e', '#4aff7a', '#b04aff', '#ffe23a', '#ff9a3a'];
function openGarage() {
    mode = 'garage';
    hideAll(); show('garage'); setMenu(null);
    const st = $('#g-step'); st.hidden = !flow;
    if (flow) st.innerHTML = `${flow === 'race' ? 'Race' : 'Time trial'} · step 2 of 2 · <b>pick your car</b> · ${title(trackById(CFG.track).name)}`;
    gIdx = Math.max(0, CARS.indexOf(carById(CFG.car)));
    setCustom(false);
    garageShow();
}
function garageShow() {
    const s = CARS[gIdx], open = unlocked(s);
    showCar(open ? specFor(s.id) : Object.assign({}, s, { body: '#07090c', stripe: '#07090c', rims: '#07090c', glass: '#07090c' }));
    $('#g-count').textContent = `${gIdx + 1}/${CARS.length}`;
    $('#g-cls').textContent = open ? s.cls : '?';
    $('#g-name').textContent = open ? s.name : '???';
    $('#g-style').textContent = open ? title(s.style) : `Unlock at ${s.unlock} fans`;
    const bar = (v) => Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
    $('#g-stats').innerHTML = [['Acceleration', s.rate.acc], ['Speed', s.rate.spd], ['Grip', s.rate.grip], ['Difficulty', s.rate.diff]].map(([k, v]) => `<dt>${k}</dt><dd>${bar(open ? v : 0)}</dd>`).join('');
    const hp = Math.round(Math.min(s.hp, 170) / 170 * 10);
    $('#g-hp').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${open && i < hp ? 'on' : ''}"></i>`).join('');
    $('#g-locked').hidden = open;
    syncCustom();
}
function setCustom(on) {
    gCustom = on;
    $('#garage').classList.toggle('custom', on);
    $('#g-custom').hidden = !on;
    setMenu(on ? $('#g-cmenu') : null);
    if (on) syncCustom();
}
function syncCustom() {
    const s = CARS[gIdx], c = CFG.custom[s.id] || {};
    const sw = (col) => `<b class="sw" style="background:${col || 'transparent'}">${col ? '' : 'off'}</b>`;
    const set = (k, html) => { const el = $(`[data-cycle="c-${k}"] em`); if (el) el.innerHTML = html; };
    set('paint', sw(c.body || s.body)); set('stripe', sw(c.stripe || s.stripe)); set('rims', sw(c.rims || '#a4a8b0'));
    set('num', c.num != null ? String(c.num) : 'none');
    set('spoiler', c.spoiler == null ? 'auto' : c.spoiler ? 'on' : 'off');
    set('glow', sw(c.glow));
}
function customCycle(k, dir) {
    const s = CARS[gIdx];
    if (!unlocked(s)) return;
    if (!ST.painted) { ST.painted = 1; setTimeout(checkAch, 200); }
    const c = CFG.custom[s.id] || (CFG.custom[s.id] = {});
    const step = (list, cur) => list[(list.indexOf(cur) + (dir > 0 ? 1 : list.length - 1) + list.length) % list.length];
    if (k === 'paint') c.body = step(PAINTS, PAINTS.includes(c.body || s.body) ? c.body || s.body : PAINTS[0]);
    if (k === 'stripe') c.stripe = step(PAINTS, PAINTS.includes(c.stripe || s.stripe) ? c.stripe || s.stripe : PAINTS[0]);
    if (k === 'rims') c.rims = step(RIMS, c.rims || RIMS[0]);
    if (k === 'num') { const n = c.num == null ? 0 : c.num; const nx = (n + (dir > 0 ? 1 : 99)) % 100; c.num = nx === 0 ? null : nx; }
    if (k === 'spoiler') c.spoiler = step([undefined, true, false], c.spoiler);
    if (k === 'glow') c.glow = step(GLOWS, c.glow || null);
    saveCfg();
    showCar(specFor(s.id));
    syncCustom();
}
function garageInput() {
    if (mode !== 'garage') return;
    if (gCustom) { if (press('back')) { setCustom(false); audio.beep(500, 0.06); } return; }
    const s = CARS[gIdx];
    if (press('left')) { gIdx = (gIdx + CARS.length - 1) % CARS.length; garageShow(); audio.beep(700, 0.04); }
    if (press('right')) { gIdx = (gIdx + 1) % CARS.length; garageShow(); audio.beep(700, 0.04); }
    if (press('cycle') && unlocked(s)) { setCustom(true); audio.beep(900, 0.05); }
    if (press('ok')) {
        if (!unlocked(s)) { audio.fx('block'); return; }
        CFG.car = s.id; saveCfg(); audio.fx('pickup');
        if (flow) { const f = flow; flow = null; startDrive(f); } else openCarousel('main', cardIdx('garage'));
    }
    if (press('back')) { showCar(specFor(CFG.car)); if (flow) openCarousel('tracks'); else openCarousel('main', cardIdx('garage')); }
}
$('#garage').addEventListener('click', (e) => {
    const a = e.target.closest('.g-arrow');
    if (a) { gIdx = (gIdx + (a.textContent === '◀' ? CARS.length - 1 : 1)) % CARS.length; garageShow(); }
});

/* ---------- panels (options, controls, pause) and their menus ---------- */
let menu = null, panel = null;
function openPanel(id) {
    hideAll(); show(id); panel = id; mode = 'panel';
    setMenu($(`#${id} .menu`));
}
function setMenu(el) {
    if (!el) { menu = null; return; }
    const items = $$('button', el).filter((b) => !b.hidden);
    menu = { el, items, i: 0 };
    items.forEach((b, j) => { b.onpointerenter = () => { if (menu && menu.el === el) { menu.i = j; markSel(); } }; });
    markSel();
}
function markSel() { if (menu) menu.items.forEach((b, j) => b.classList.toggle('sel', j === menu.i)); }
function menuInput() {
    if (mode === 'panel' && press('back')) { audio.beep(500, 0.06); openCarousel('main', cardIdx({ opts: 'options', ctrls: 'controls', trophies: 'trophies' }[panel] || 'race')); return; }
    if (!menu || menu.el.closest('[hidden]')) return;
    const n = menu.items.length;
    if (press('mup')) { menu.i = (menu.i + n - 1) % n; markSel(); audio.beep(880, 0.04); }
    if (press('mdown')) { menu.i = (menu.i + 1) % n; markSel(); audio.beep(880, 0.04); }
    const b = menu.items[menu.i];
    if (b.dataset.cycle) {
        if (press('left')) cycle(b.dataset.cycle, -1);
        if (press('right')) cycle(b.dataset.cycle, 1);
    }
    if (press('ok')) b.click();
}
const show = (id, on = true) => { const el = $('#' + id); if (el) el.hidden = !on; };
const hideAll = () => ['title', 'hud', 'pause', 'garage', 'opts', 'ctrls', 'results', 'trophies', 'wmap', 'replay'].forEach((id) => show(id, false));

function cycle(what, dir) {
    if (what.startsWith('c-')) { customCycle(what.slice(2), dir); audio.beep(660, 0.05); return; }
    if (what === 'look') { const k = Object.keys(LOOKS); CFG.look = k[(k.indexOf(CFG.look) + dir + k.length) % k.length]; }
    if (what === 'res') { CFG.res = RESK[(RESK.indexOf(CFG.res) + (dir > 0 ? 1 : RESK.length - 1)) % RESK.length]; setRes(); }
    if (what === 'fps') CFG.fps = FPS[(FPS.indexOf(CFG.fps) + (dir > 0 ? 1 : FPS.length - 1)) % FPS.length];
    if (what === 'wobble') CFG.wobble = (CFG.wobble + (dir > 0 ? 1 : 2)) % 3;
    if (what === 'sound') { CFG.sound = !CFG.sound; audio.setOn(CFG.sound); }
    if (what === 'crt') CFG.crt = !CFG.crt;
    if (what === 'lines') CFG.lines = !CFG.lines;
    if (what === 'ink') CFG.ink = !CFG.ink;
    if (what === 'glow') CFG.glow = !CFG.glow;
    if (what === 'view') { CFG.view = VIEWS[(VIEWS.indexOf(CFG.view) + (dir > 0 ? 1 : VIEWS.length - 1)) % VIEWS.length]; if (cockpit) cockpit.setVisible(mode === 'drive' && CFG.view === 'cockpit'); if (mode === 'drive') message(VIEWN[CFG.view], 0.8); }
    if (what === 'codriver') CFG.codriver = CODRIVER[(CODRIVER.indexOf(CFG.codriver) + 1) % CODRIVER.length];
    if (what === 'units') CFG.units = CFG.units === 'kmh' ? 'mph' : 'kmh';
    if (what === 'driftStyle') CFG.driftStyle = CFG.driftStyle === 'kart' ? 'rally' : 'kart';
    if (what === 'diff') { const k = Object.keys(DIFFS); CFG.diff = k[(k.indexOf(CFG.diff) + (dir > 0 ? 1 : k.length - 1)) % k.length]; }
    if (what === 'music') { CFG.music = !CFG.music; music.setOn(CFG.music); }
    if (what === 'weather') { CFG.weather = WEATHERS[(WEATHERS.indexOf(CFG.weather) + (dir > 0 ? 1 : WEATHERS.length - 1)) % WEATHERS.length]; saveCfg(); reloadTrack(); }
    saveCfg(); syncOptions(); audio.beep(660, 0.05);
}
function syncOptions() {
    post.setLook(LOOKS[CFG.look] || LOOKS.night);
    post.set({ ink: CFG.ink, glow: CFG.glow });
    setWobble(CFG.wobble);
    const set = (k, v) => $$(`[data-cycle="${k}"] b`).forEach((b) => { b.textContent = v; });
    set('look', (LOOKS[CFG.look] || LOOKS.night).name);
    set('lines', CFG.lines ? 'ON' : 'OFF');
    set('view', VIEWN[CFG.view]);
    set('units', CFG.units === 'mph' ? 'MPH' : 'KM/H');
    set('driftStyle', CFG.driftStyle === 'kart' ? 'KART' : 'RALLY');
    set('codriver', { voice: 'VOICE', notes: 'ARROWS', off: 'OFF' }[CFG.codriver]);
    set('radio', STATIONS[CFG.radio][1].split(' · ')[0]);
    $('.b-speed small').textContent = CFG.units === 'mph' ? 'mph' : 'km/h';
    set('weather', CFG.weather === 'auto' ? 'TRACK' : CFG.weather.toUpperCase());
    set('fps', CFG.fps + ' FPS');
    set('res', RESN[RESK.indexOf(CFG.res)]);
    set('wobble', ['OFF', 'ON', 'EXTRA'][CFG.wobble]);
    set('sound', CFG.sound ? 'ON' : 'OFF');
    set('music', CFG.music ? 'ON' : 'OFF');
    set('diff', DIFFS[CFG.diff].name);
    $('#screen').classList.toggle('crt', CFG.crt);
    $$('.mb-drop [data-opt]').forEach((b) => {
        const [k, v] = b.dataset.opt.split(':');
        const on = v ? String(CFG[k]) === v : !!CFG[k];
        b.parentElement.classList.toggle('on', on);
    });
    document.documentElement.dataset.pal = CFG.look === 'dmg' ? 'dmg' : CFG.look === 'sea' ? 'sea' : 'night';
}

function setRes() {
    RES.w = BASE.w * CFG.res; RES.h = BASE.h * CFG.res;
    renderer.setSize(RES.w, RES.h, false);
    post.resize();
    puffMat.uniforms.uScale.value = RES.h * 0.85;
    setWobble(CFG.wobble);
    document.body.dataset.res = CFG.res;
}
function setPause(on) {
    if (mode !== 'drive') return;
    paused = on;
    show('pause', on);
    $('#p-map').hidden = !roam;
    setMenu(on ? $('#pause .menu') : null);
    if (on) audio.beep(990, 0.08);
}

const ACTS = {
    drive: () => startDrive('test'),
    race: () => startDrive('race'),
    garage: () => { if (mode === 'drive') return; openGarage(); },
    resume: () => setPause(false),
    photo: () => setPhoto(true),
    map: () => setMap(true),
    restart: () => { paused = false; show('pause', false); show('results', false); startDrive(); },
    quit: () => toMenu(),
    cupnext: () => { cup.idx++; cupRace(); },
    replay: () => startReplay(),
    cupdone: () => toMenu('cups'),
    custom: () => { if (mode === 'garage') setCustom(true); },
    cdone: () => setCustom(false),
    next: () => { const i = TRACKS.indexOf(trackById(CFG.track)); CFG.track = TRACKS[(i + 1) % TRACKS.length].id; saveCfg(); loadTrack(trackById(CFG.track)); startDrive('race'); },
    pause: () => { if (mode === 'drive') setPause(!paused); },
    trback: () => openCarousel('main', cardIdx('trophies')),
    full: () => toggleFull(),
    zoom: () => toggleZoom(),
    home: () => { location.href = 'index.html'; },
    about: () => alertBox('About Gravel Riot', '<p><b>Gravel Riot</b> &middot; checkpoint 5: career, cups and the garage</p><p>A cel-shaded rally racer with power-ups, rendered small and run through the same dither as the rest of heind.nl. Built with Three.js; every texture and sound is generated in code.</p><p>Win races to earn fans and unlock stranger cars. Paint them in the garage.</p>'),
    view: () => cycle('view', 1),
    help: () => { if (mode === 'drive') { setPause(true); return; } openPanel('ctrls'); }
};
document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cycle]');
    if (c && !c.closest('.mb-drop')) { cycle(c.dataset.cycle, 1); return; }
    const opt = e.target.closest('[data-opt]');
    if (opt) {
        const [k, v] = opt.dataset.opt.split(':');
        if (v) { CFG[k] = isNaN(+v) ? v : +v; saveCfg(); if (k === 'res') setRes(); syncOptions(); if (k === 'track' || k === 'weather') reloadTrack(); } else cycle(k, 1);
        closeMenus(); return;
    }
    const a = e.target.closest('[data-act]');
    if (a && ACTS[a.dataset.act]) { closeMenus(); ACTS[a.dataset.act](); }
});

/* ---------- Mac chrome: menu bar, window boxes, full screen ---------- */
let openBtn = null;
const closeMenus = () => { $$('.mb-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false')); openBtn = null; };
$$('.mb-btn').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); const was = b.getAttribute('aria-expanded') === 'true'; closeMenus(); if (!was) { b.setAttribute('aria-expanded', 'true'); openBtn = b; if (mode === 'drive' && !paused) setPause(true); } });
    b.addEventListener('pointerenter', () => { if (openBtn && openBtn !== b) { closeMenus(); b.setAttribute('aria-expanded', 'true'); openBtn = b; } });
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.mb-item')) closeMenus(); });
const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
tickClock(); setInterval(tickClock, 15000);

function alertBox(heading, html) {
    const was = paused;
    if (mode === 'drive' && !paused) setPause(true);
    const box = document.createElement('div');
    box.className = 'dlg-back';
    box.innerHTML = `<div class="dlg" role="alertdialog" aria-label="${heading}"><div class="mac-title"><span class="mt-name"><span>${heading}</span></span></div><div class="dlg-body"><i class="dlg-ico"></i><div>${html}</div></div><div class="dlg-btns"><button class="btn default" type="button">OK</button></div></div>`;
    $('#dialogs').appendChild(box);
    $('button', box).addEventListener('click', () => { box.remove(); if (!was && mode === 'drive') setPause(false); });
    $('button', box).focus();
}
$('.box-close').addEventListener('click', () => {
    if (mode === 'drive' && !paused) setPause(true);
    const box = document.createElement('div');
    box.className = 'dlg-back';
    box.innerHTML = '<div class="dlg" role="alertdialog" aria-label="Quit"><div class="mac-title"><span class="mt-name"><span>Quit Gravel Riot?</span></span></div><div class="dlg-body"><i class="dlg-ico caution"></i><div><p><b>Park the car and go back to heind.nl?</b></p></div></div><div class="dlg-btns"><button class="btn" type="button" data-x="stay">Keep driving</button><button class="btn default" type="button" data-x="go">Park it</button></div></div>';
    $('#dialogs').appendChild(box);
    box.addEventListener('click', (e) => { const x = e.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'go') location.href = 'index.html'; box.remove(); });
});
$('.box-zoom').addEventListener('click', () => toggleZoom());
$('.box-shade').addEventListener('click', () => { $('#gamewin').classList.toggle('min'); if (mode === 'drive' && !paused) setPause(true); });

let zoomed = false, scale = 3;
function toggleZoom() { zoomed = !zoomed; document.body.classList.toggle('zoomed', zoomed); fit(); }
const isFull = () => document.body.classList.contains('fakefs');
function toggleFull(force) {
    const want = force == null ? !isFull() : force;
    document.body.classList.toggle('fakefs', want);
    fit();
    $$('[data-act="full"]').forEach((b) => { const li = b.closest('li'); if (li) li.classList.toggle('on', want); });
    $$('[data-act="full"] b').forEach((b) => { b.textContent = want ? 'ON' : 'OFF'; });
}
function fit() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('touch', coarse);
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const full = isFull();
    const chromeH = full ? 0 : zoomed ? 70 : 22 + 24 + 22 + 48;
    const aw = full ? innerWidth : vw - (vw < 600 ? 22 : 60), ah = vh - chromeH - (coarse ? 110 : 0);
    let s = Math.min(aw / BASE.w, ah / BASE.h);
    if (s >= 2 && !coarse && (!full || Math.floor(s) / s > 0.85)) s = Math.floor(s);
    scale = Math.max(1, s);
    const sc = $('#screen');
    sc.style.width = Math.round(BASE.w * scale) + 'px';
    sc.style.height = Math.round(BASE.h * scale) + 'px';
    sc.style.setProperty('--px', (scale * 0.75) + 'px');
    sc.style.setProperty('--gp', scale + 'px');
    const blk = Math.max(2, Math.round(scale * 0.6));
    const pc = document.getElementById('pix-c'), pm = document.getElementById('pix-m');
    if (pc) { pc.setAttribute('width', blk); pc.setAttribute('height', blk); pm.setAttribute('radius', Math.max(1, Math.floor(blk / 2))); }
}
addEventListener('resize', fit);

/* ---------- main loop ---------- */
const STEP = 1 / 120;
let last = performance.now(), acc = 0, renderAcc = 0, T = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    pollPad();
    if (press('full')) toggleFull();
    if (press('view')) cycle('view', 1);
    if (photo) {
        if (press('photo') || press('pause') || press('back')) setPhoto(false);
        hits.delete('pause');
    } else if (mapOpen) {
        if (press('map') || press('pause') || press('back')) setMap(false);
        hits.delete('pause');
    } else if (mode === 'drive' && press('pause') && !$('#dialogs').children.length) setPause(!paused);
    else hits.delete('pause');
    if (mode === 'drive' && !photo && !mapOpen) {
        if (press('photo')) setPhoto(true);
        if (press('map')) { if (roam) setMap(true); else message('MAP IS FOR FREE ROAM', 1.2, true); }
    }
    if (press('radio') && mode === 'drive') {
        CFG.radio = (CFG.radio + 1) % STATIONS.length; saveCfg();
        const [song, name] = STATIONS[CFG.radio];
        music.want(song || (SONGS[track.def.id] ? track.def.id : SONG_FOR[track.def.id] || 'race1'));
        toast(`♪ ${name}`); syncOptions();
    }
    if (mode === 'drive' && !paused && race && race.intro > 0 && (press('ok') || hits.has('fire'))) { hits.delete('fire'); hits.delete('ok'); endIntro(); }
    const roamIn = { ok: hits.has('ok'), fastTime: keys.has('time'), nextWeather: press('weather') };
    if (mode === 'drive' && !paused && !(race && race.count > 0) && !car.done) {
        if (press('cycle') && car.slots.length > 1) { car.sel = (car.sel + 1) % car.slots.length; audio.beep(760, 0.04); }
        if (press('fire')) weapons.fire(car, false, cars);
        if (press('fireBack')) weapons.fire(car, true, cars);
        hits.delete('ok');
    }
    carouselInput();
    garageInput();
    menuInput();
    if (!paused) {
        T += dt;
        if (mode === 'drive') {
            acc += dt;
            while (acc >= STEP) { updDrive(STEP); acc -= STEP; }
            cars.forEach((c) => { c.sync(dt); if (!(c.npc && c.npc.far)) carFx(c); });
            if (CFG.view === "hood" && !(race && race.intro > 0)) { car.mesh.root.visible = false; if (shadow) shadow.visible = false; } else if (shadow) shadow.visible = true;
            if (roam) roam.frame(dt, roamIn);
            updGhost();
            if (pickups) pickups.update(dt, T, cars, cam, (c, type) => { if (c === car) { audio.fx('pickup'); feed(`${title(PU[type].name)}`, 0); } });
            weapons.update(dt, cars, T);
            if (!race || race.count <= 0) { const ctx = { track, cars, weapons, rank: rankCars, player: car, pickups }; for (const c of cars) if (c.driver && c !== car) c.driver.tactics(dt, ctx); }
            if (results > 0 && (results -= dt) <= 0) showResults();
            if (race && race.intro > 0) introCam(race.introT);
            else if (CFG.view === 'cockpit') { cockpit.update(dt, track.def.rain); cockpit.place(cam); }
            else chase(dt);
            if (notes) updNotes();
        } else if (mode === 'replay' && replay) {
            updReplay(dt);
        } else {
            car.sync(dt);
            if (mode === 'garage') orbit(T * 1.6, 6.2, 1.5, 0.17); else orbit(T, 14, 3.5, 0);
        }
        const rainK = roam ? roam.atmos.rainK : track.def.rain ? 1 : 0;
        if (roam) {
            const want = rainK > 0.05 ? (roam.atmos.snow ? 'snow' : 'rain') : null;
            if (want !== rain.roamMode) { rain.roamMode = want; rain.setOn(!!want, want || 'rain'); }
            rain.k = Math.min(1, rainK * 1.3);
        }
        rain.update(dt, cam, mode === 'drive' ? car : null);
        if (track.animatePuddles) track.animatePuddles(dt);
        track.animate(T);
        const inCockpit = mode === 'drive' && CFG.view === 'cockpit';
        if (inCockpit) {
            car.mesh.body.updateWorldMatrix(true, true);
            drops.update(dt, { rain: !!track.def.rain, speed: car.speed, accL: car.accL, accF: car.accF, quad: cockpit.glassQuad(cam), wipers: cockpit.wiperLines(cam) });
        }
        post.set({ drops: inCockpit && drops.any ? drops.tex : null });
        const rv = mode === 'drive' ? car.speed : 0;
        const rainy = roam ? (roam.atmos.snow ? 0 : rainK) : rainK;
        post.set({ rain: rainy * (inCockpit ? 0.6 : 0.8), slant: 0.15 + Math.min(0.6, rv / 80) });
        audio.setRain(rainy * (inCockpit ? 1 : 0.6));
        updPuffs(dt);
        if (msgT > 0 && (msgT -= dt) <= 0) $('#h-msg').hidden = true;
        $('#h-wrong').hidden = !(wrongWay > 0.8 && mode === 'drive');
    }
    engineSound();
    music.poke();
    updateHUD();
    if (shadow && car) {
        shadow.position.set(car.x, car.q.y + 0.05, car.z);
        shadow.rotation.set(-Math.PI / 2, 0, car.h);
        shadow.material.opacity = clamp(1 - (car.y - car.q.y) * 0.25, 0.2, 1);
    }
    if (track) { if (track.isWorld) track.sky.position.copy(cam.position); else track.sky.position.set(cam.position.x, cam.position.y + 70, cam.position.z); }
    sunDisc.position.copy(cam.position).addScaledVector(sunDir, 820);
    sunDisc.lookAt(cam.position);
    burst = Math.max(0, burst - dt * 2.5);
    shake = Math.max(0, shake - dt * 2.2);
    let lineK = mode === 'drive' && CFG.lines && !paused ? clamp((car.speed - 16) / 30, 0, 1) : 0;
    if (mode === 'drive' && car.nitro > 0) lineK = 1;
    tint.t = Math.max(0, tint.t - dt);
    const tk = mode === 'drive' ? Math.min(0.32, tint.t / Math.min(tint.max, 0.7) * 0.32) : 0;
    post.set({ speed: lineK, burst: CFG.lines ? burst : 0, time: T, tint: [tint.col.r, tint.col.g, tint.col.b].map((v) => Math.pow(v, 1 / 2.2)), tintK: tk });
    renderAcc += dt;
    if (renderAcc >= 1 / CFG.fps - 0.002) {
        renderAcc = 0;
        const driving = mode === 'drive';
        if (driving) { if (cockpit.rt.width !== 96 * CFG.res) cockpit.rt.setSize(96 * CFG.res, 28 * CFG.res); cockpit.renderMirror(renderer, scene); }
        if (photo) photoCam(dt);
        post.setInset(cockpit.rt.texture, driving && CFG.view !== 'cockpit' && !photo && !mapOpen && !(race && race.intro > 0));
        post.render(scene, cam);
        if (driving) drawMinimap();
        const dashOn = driving && CFG.view === 'cockpit';
        dash2d.hidden = !dashOn;
        document.body.dataset.view = dashOn ? 'cockpit' : 'chase';
        if (dashOn) {
            cockpit.drawDash(dashX, 320, 180, {
                kmh: car.speed * 3.6, rpm: lastRpm, gear: car.vf < -0.5 ? 'R' : String(lastGear), steer: car.steer,
                nitro: car.nitro > 0, shield: car.shield > 0, damaged: car.health < 35, brake: !!car.braking
            });
        }
    }
    hits.clear();
}

/* ---------- boot ---------- */
setRes();
fit();
loadTrack(trackById(CFG.track));
showCar(specFor(CFG.car));
toMenu();
const ARROW = ['B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB', 'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB'];
const pix = (rows, map, sc = 1) => {
    const w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas'); c.width = w * sc; c.height = rows.length * sc;
    const x = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, i) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(i * sc, y * sc, sc, sc); } }));
    return `url(${c.toDataURL()})`;
};
const ANCHOR = ['.....KK.....', '....K..K....', '.....KK.....', '..KKKKKKKK..', '.....KK.....', '.....KK.....', 'K....KK....K', 'KK...KK...KK', '.KKK.KK.KKK.', '...KKKKKK...', '.....KK.....'];
const CARI = ['...KKKKK....', '..KWWWWWK...', '.KPPPPPPPKK.', 'KPPPPPPPPPPK', 'KPKKPPPPKKPK', '..KK....KK..'];
const rs = document.documentElement.style;
rs.setProperty('--cur-arrow', `${pix(ARROW, { B: '#000000', W: '#ffffff' }, 2)} 0 0, auto`);
rs.setProperty('--i-anchor', pix(ANCHOR, { K: '#1f4a8f' }));
rs.setProperty('--i-sub', pix(CARI, { K: '#000000', W: '#9fd8f5', P: '#3a8cff' }));
rs.setProperty('--i-subbig', pix(CARI, { K: '#000000', W: '#9fd8f5', P: '#3a8cff' }, 2));
// each letter of the tag sits at its own angle, like it was sprayed by hand
$$('.logo-word').forEach((el) => {
    el.innerHTML = [...'GRAVEL RIOT'].map((c, i) => c === ' ' ? '<span class="sp"> </span>'
        : `<span style="--i:${i};--r:${((i * 37) % 9 - 4) * 1.6 - 2}deg;--y:${((i * 13) % 7 - 3) * 0.7}">${c}</span>`).join('');
});
$('#loading')?.remove();
requestAnimationFrame(frame);

// for testing from the console
window.RALLY = {
    scene, cam, CFG, keys, hits, syncOptions, startDrive, toMenu, openGarage,
    set override(f) { override = f; }, get car() { return car; }, get cars() { return cars; }, get track() { return track; }, get mode() { return mode; },
    get rec() { return rec; }, get ghost() { return ghost; }, get lapStarted() { return lapStarted; },
    get race() { return race; }, get tape() { return tape; }, get replay() { return replay; }, startReplay, ST, checkAch, setMap, setPhoto, get drift() { return drift; }, startCup: (id) => startCup(id), get cup() { return cup; }, openCarousel: (k) => openCarousel(k), customCycle: (k, d) => customCycle(k, d), setCustom: (on) => setCustom(on),
    set gIdx(v) { gIdx = v; garageShow(); }, rankCars: () => rankCars(), showResults: () => showResults(),
    startRoam: () => startRoam(), audio, music, get world() { return world; }, get roam() { return roam; },
    give: (type, c = car) => { c.slots.push({ type, ammo: PU[type].ammo || 1 }); }, get weapons() { return weapons; }
};

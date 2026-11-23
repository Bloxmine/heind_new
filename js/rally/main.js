/* Gravel Riot: menus, garage, test drive with power-ups and practice cars. */
import * as THREE from 'three';
import { RES, Post, setWobble, glows, MAIN_ONLY } from './retro.js';
import { surfaceTextures } from './textures.js';
import { buildTrack } from './track.js';
import { Car, CARS, SURF } from './car.js';
import { TRACKS } from './tracks.js';
import { CarAudio } from './audio.js';
import { Cockpit } from './cockpit.js';
import { Rain, Droplets, addPuddles, rainy } from './weather.js';
import { PU, Pickups, Weapons, iconURL } from './powerups.js';
import { Driver, RIVALS, plan } from './ai.js';
import { Music } from './music.js';

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
const CFG = Object.assign({ look: 'night', fps: 30, wobble: 1, crt: true, sound: true, lines: true, ink: true, glow: true, view: 'chase', weather: 'auto', track: 'alpine', car: 'volta', targets: true, diff: 'normal', music: true }, store.get('heind.rally', {}));
const DIFFS = { easy: { name: 'EASY', skill: 0.84 }, normal: { name: 'NORMAL', skill: 0.91 }, hard: { name: 'HARD', skill: 0.98 } };
if (!DIFFS[CFG.diff]) CFG.diff = 'normal';
const SONG_FOR = { alpine: 'race1', canyon: 'race2', frost: 'race3', harbour: 'race2', stadium: 'race2', jungle: 'race3', oldtown: 'race1', neon: 'race2' };
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
    loadTrack(trackById(CFG.track));
    if (mode === 'drive') startDrive(); else showCar(carById(CFG.car));
}
function loadTrack(base) {
    trackDef = base;
    const w = CFG.weather === 'auto' ? base.weather || 'dry' : CFG.weather;
    const def = w === 'rain' ? rainy(base) : base;
    def.snowfall = w === 'snow';
    clearRace();
    if (track) scene.remove(track.group);
    track = buildTrack(def, TX);
    if (def.rain) addPuddles(track);
    rain.setOn(!!def.rain || def.snowfall, def.rain ? 'rain' : 'snow');
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
    Space: 'hand', ShiftLeft: 'hand', KeyR: 'reset', Escape: 'pause', KeyP: 'pause', Enter: 'ok', NumpadEnter: 'ok', KeyF: 'full',
    KeyZ: 'fire', KeyX: 'fireBack', KeyC: 'cycle', KeyV: 'view', Backspace: 'back'
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
        handbrake: keys.has('hand') || pad.hand || touch.hand
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
    const back = 6.6, up = 2.6;
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
function updateHUD() {
    if (mode !== 'drive' || !car) return;
    const N = track.N, score = (c) => c.lapN * N + c.q.prog;
    const pos = 1 + cars.filter((c) => c !== car && score(c) > score(car)).length;
    setText('h-pos', String(pos)); setText('h-of', String(cars.length));
    setText('h-lap', race && race.kind === 'race' ? `${clamp(car.lapN, 1, race.laps)}/${race.laps}` : String(Math.max(1, car.lapN)));
    setText('h-time', lapStarted ? fmt(lapT) : '-:--.--');
    setText('h-best', fmt(best));
    setText('h-speed', String(Math.round(car.speed * 3.6)));
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
            if (what === 'wreck') { feed('Takedown', 100, 'hot'); message('TAKEDOWN!', 1.6); }
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

let race = null, raceT = 0, results = 0;
const rankCars = () => { const N = track.N; return [...cars].sort((a, b) => (b.done ? 1e9 - b.finishT : b.lapN * N + b.q.prog) - (a.done ? 1e9 - a.finishT : a.lapN * N + a.q.prog)); };
function startDrive(kind = race ? race.kind : 'race') {
    mode = 'drive';
    document.body.dataset.mode = 'drive';
    paused = false;
    hideAll(); show('hud'); setMenu(null);
    race = { kind, laps: kind === 'race' ? trackById(CFG.track).laps || 3 : 0, count: kind === 'race' ? 3.99 : 0, order: [], done: false };
    raceT = 0; results = 0;
    showCar(carById(CFG.car));
    cockpit.setVisible(CFG.view === 'cockpit');
    if (kind === 'race') {
        // a full grid: the player starts in the middle, seven rivals around them
        const grid = 8, mine = 5;
        car.place(track.gridSlot(mine).x, track.gridSlot(mine).y, track.gridSlot(mine).z, track.gridSlot(mine).heading);
        car.lastGy = car.y; car.lastProg = car.q.prog;
        const others = CARS.filter((c) => c.id !== CFG.car);
        const base = DIFFS[CFG.diff].skill;
        let r = 0;
        for (let slot = 0; slot < grid; slot++) {
            if (slot === mine) continue;
            const info = RIVALS[r], spec = others[r % others.length];
            const b = newCar(spec, slot, false);
            b.driver = new Driver(b, info, base + (Math.random() - 0.5) * 0.05 + (info.style === 'careful' ? -0.02 : info.style === 'aggressive' ? 0.01 : 0));
            cars.push(b);
            r++;
        }
        plan(track);
        music.want(SONG_FOR[track.def.id] || 'race1');
    } else if (CFG.targets) {
        music.want(SONG_FOR[track.def.id] || 'race1');
        const others = CARS.filter((c) => c.id !== CFG.car);
        for (let k = 0; k < 3; k++) {
            const i = (track.gridSlot(0).i + 30 + k * 28) % track.N, s = track.S[i];
            const lane = [-0.22, 0.2, 0][k];
            const b = newCar(others[(k * 3 + 1) % others.length], { x: s.x + s.sx * lane * s.w, z: s.z + s.sz * lane * s.w, y: s.y, heading: Math.atan2(s.tx, s.tz) }, false);
            b.ai = { lane, speed: 27 + k * 3 };
            cars.push(b);
        }
    }
    pickups = new Pickups(track, scene);
    weapons = new Weapons(scene, track, fx);
    weapons.rank = rankCars;
    lapT = 0; lapStarted = false; wrongWay = 0; fans = 0;
    best = store.get(bestKey(), null);
    $('#h-feed').innerHTML = '';
    chase(0, true);
    if (kind !== 'race') { message('GO!', 1.2); audio.beep(880, 0.25); }
}
function toMenu(sub) {
    mode = 'menu';
    document.body.dataset.mode = 'menu';
    paused = false;
    hideAll(); show('title');
    if (!car || cars.length > 1 || car.spec.id !== CFG.car) showCar(carById(CFG.car));
    cockpit.setVisible(false);
    setMenu(null);
    openCarousel(sub || 'main');
    syncOptions();
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
            }
            lapStarted = true; lapT = 0;
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
function showResults() {
    music.want('results');
    const order = [...race.order, ...rankCars().filter((c) => !c.done)];
    const win = race.order[0];
    $('#res-list').innerHTML = order.map((c, i) => {
        const who = c === car ? 'You' : c.driver ? c.driver.name : '—';
        const time = c.done ? (c === win ? fmt(c.finishT) : '+' + (c.finishT - win.finishT).toFixed(2)) : 'racing';
        return `<li class="${c === car ? 'me' : ''}"><span>${i + 1}</span><b>${who}</b><i>${c.spec.name}</i><em>${time}</em></li>`;
    }).join('');
    $('#res-fans').textContent = fans;
    show('results'); setMenu($('#results .menu'));
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
    if (race && race.count > 0) {
        const before = Math.ceil(race.count);
        race.count -= dt;
        const now = Math.ceil(race.count);
        if (now !== before) {
            if (now > 0) { message(String(now), 0.9); audio.beep(660, 0.18); }
            else { message('GO!', 1.2); audio.beep(1320, 0.35); burst = 0.6; }
        }
    } else if (race) raceT += dt;
    const ctx = { track, cars, weapons, rank: rankCars, player: car, pickups };
    for (const c of cars) {
        if (race && race.count > 0) { c.vx = c.vz = 0; c.w = 0; continue; }     // everyone waits for GO
        const inp = c.driver ? c.driver.drive(ctx) : c === car ? readDrive() : botDrive(c);
        c.step(dt, inp);
        wallHit(c);
        laps(c, dt);
        if (c.wrecking && c.wrecked <= 0) { c.respawn(); c.wrecking = false; c.lapN = c.lapN; }
        const thr = race && race.count > 0 ? 0 : c === car && !c.driver ? readDrive().throttle : 1;
        c.stuckT = c.speed < 1 && thr && c.wrecked <= 0 ? c.stuckT + dt : 0;
        if (c.stuckT > 4 || c.y < c.q.y - 6 || (c === car && press('reset'))) resetCar(c);
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collide(cars[i], cars[j]);
    const fwd = Math.sin(car.h) * car.q.tx + Math.cos(car.h) * car.q.tz;
    wrongWay = fwd < -0.3 && car.speed > 4 ? wrongWay + dt : 0;
    if (car.scrape > 0.6 && !car.scrapeSnd) { audio.thud(car.scrape); car.scrapeSnd = true; }
    if (car.scrape < 0.1) car.scrapeSnd = false;
    if (car.land > 0.5 && !car.landSnd) { audio.thud(car.land); car.landSnd = true; burst = Math.max(burst, car.land); }
    if (car.land < 0.1) car.landSnd = false;
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
    if (kind === 'home') { x.beginPath(); x.moveTo(24, 6); x.lineTo(44, 24); x.lineTo(4, 24); x.fill(); x.fillRect(10, 24, 28, 18); x.fillStyle = '#0a1830'; x.fillRect(20, 30, 8, 12); }
    return (iconCache[kind] = c.toDataURL());
}
const MAIN_CARDS = [
    { label: 'race', icon: 'race', desc: 'Eight cars, three laps, every power-up', act: () => startDrive('race') },
    { label: 'test drive', icon: 'tracks', desc: 'Free laps with power-ups and three practice cars', act: () => startDrive('test') },
    { label: 'tracks', icon: 'tracks', desc: 'Pick where to race', act: () => openCarousel('tracks') },
    { label: 'garage', icon: 'garage', desc: 'Choose your car', act: () => openGarage() },
    { label: 'options', icon: 'options', desc: 'Look, camera, weather, sound', act: () => openPanel('opts') },
    { label: 'controls', icon: 'controls', desc: 'Keyboard, gamepad and touch', act: () => openPanel('ctrls') },
    { label: 'heind.nl', icon: 'home', desc: 'Back to the homepage', act: () => { location.href = 'index.html'; } }
];
let carousel = { kind: 'main', items: MAIN_CARDS, sel: 0 };
function trackCards() {
    return TRACKS.map((t) => ({
        label: t.name.toLowerCase(), desc: `${title(t.blurb)} · ${t.weather === 'dry' ? 'dry' : t.weather}`,
        img: () => thumb(t), act: () => { CFG.track = t.id; saveCfg(); loadTrack(trackById(CFG.track)); showCar(carById(CFG.car)); openCarousel('main', 2); }
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
    x.strokeStyle = '#9ff0ff'; x.lineWidth = 3.5; x.lineJoin = 'round';
    x.beginPath();
    pts.forEach((p, i) => { const px = 42 - ((p.x - x0) * sc + (36 - (x1 - x0) * sc) / 2), py = 42 - ((p.z - z0) * sc + (36 - (z1 - z0) * sc) / 2); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
    return (thumbs[t.id] = c.toDataURL());
}
function openCarousel(kind, sel) {
    hideAll(); show('title');
    music.want('menu');
    mode = 'menu'; menu = null;
    const items = kind === 'tracks' ? trackCards() : MAIN_CARDS;
    const start = sel != null ? sel : kind === 'tracks' ? Math.max(0, TRACKS.indexOf(trackById(CFG.track))) : 0;
    carousel = { kind, items, sel: start };
    $('#carousel').innerHTML = items.map((it, i) => `<button type="button" class="bcard" data-card="${i}"><span class="ctag">${it.label}</span><img src="${it.img ? it.img() : cardIcon(it.icon)}" alt=""></button>`).join('');
    $('#m-back').hidden = kind === 'main';
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
    $('#m-label').textContent = items[sel].label;
    $('#m-desc').textContent = items[sel].desc;
    const t = trackById(CFG.track), b = store.get('heind.rally.best.' + t.id, null);
    $('#m-status').textContent = `${t.name} · BEST ${fmt(b)} · ${carById(CFG.car).name}`;
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
    if (press('back') && carousel.kind !== 'main') { audio.beep(500, 0.06); openCarousel('main', 2); }
}

/* ---------- garage: the cars in 3D ---------- */
let gIdx = 0;
function openGarage() {
    mode = 'garage';
    hideAll(); show('garage'); setMenu(null);
    gIdx = Math.max(0, CARS.indexOf(carById(CFG.car)));
    garageShow();
}
function garageShow() {
    const s = CARS[gIdx];
    showCar(s);
    $('#g-count').textContent = `${gIdx + 1}/${CARS.length}`;
    $('#g-cls').textContent = s.cls;
    $('#g-name').textContent = s.name;
    $('#g-style').textContent = title(s.style);
    const bar = (v) => Array.from({ length: 5 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
    $('#g-stats').innerHTML = [['Acceleration', s.rate.acc], ['Speed', s.rate.spd], ['Grip', s.rate.grip], ['Difficulty', s.rate.diff]].map(([k, v]) => `<dt>${k}</dt><dd>${bar(v)}</dd>`).join('');
    const hp = Math.round(s.hp / 135 * 10);
    $('#g-hp').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join('');
}
function garageInput() {
    if (mode !== 'garage') return;
    if (press('left')) { gIdx = (gIdx + CARS.length - 1) % CARS.length; garageShow(); audio.beep(700, 0.04); }
    if (press('right')) { gIdx = (gIdx + 1) % CARS.length; garageShow(); audio.beep(700, 0.04); }
    if (press('ok')) { CFG.car = CARS[gIdx].id; saveCfg(); audio.fx('pickup'); openCarousel('main', 3); }
    if (press('back')) { showCar(carById(CFG.car)); openCarousel('main', 3); }
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
    if (mode === 'panel' && press('back')) { audio.beep(500, 0.06); openCarousel('main', panel === 'opts' ? 4 : 5); return; }
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
const hideAll = () => ['title', 'hud', 'pause', 'garage', 'opts', 'ctrls', 'results'].forEach((id) => show(id, false));

function cycle(what, dir) {
    if (what === 'look') { const k = Object.keys(LOOKS); CFG.look = k[(k.indexOf(CFG.look) + dir + k.length) % k.length]; }
    if (what === 'fps') CFG.fps = FPS[(FPS.indexOf(CFG.fps) + (dir > 0 ? 1 : FPS.length - 1)) % FPS.length];
    if (what === 'wobble') CFG.wobble = (CFG.wobble + (dir > 0 ? 1 : 2)) % 3;
    if (what === 'sound') { CFG.sound = !CFG.sound; audio.setOn(CFG.sound); }
    if (what === 'crt') CFG.crt = !CFG.crt;
    if (what === 'lines') CFG.lines = !CFG.lines;
    if (what === 'ink') CFG.ink = !CFG.ink;
    if (what === 'glow') CFG.glow = !CFG.glow;
    if (what === 'view') { CFG.view = CFG.view === 'chase' ? 'cockpit' : 'chase'; if (cockpit) cockpit.setVisible(mode === 'drive' && CFG.view === 'cockpit'); }
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
    set('view', CFG.view === 'chase' ? 'CHASE' : 'COCKPIT');
    set('weather', CFG.weather === 'auto' ? 'TRACK' : CFG.weather.toUpperCase());
    set('fps', CFG.fps + ' FPS');
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

function setPause(on) {
    if (mode !== 'drive') return;
    paused = on;
    show('pause', on);
    setMenu(on ? $('#pause .menu') : null);
    if (on) audio.beep(990, 0.08);
}

const ACTS = {
    drive: () => startDrive('test'),
    race: () => startDrive('race'),
    garage: () => { if (mode === 'drive') return; openGarage(); },
    resume: () => setPause(false),
    restart: () => { paused = false; show('pause', false); show('results', false); startDrive(); },
    quit: () => toMenu(),
    next: () => { const i = TRACKS.indexOf(trackById(CFG.track)); CFG.track = TRACKS[(i + 1) % TRACKS.length].id; saveCfg(); loadTrack(trackById(CFG.track)); startDrive('race'); },
    pause: () => { if (mode === 'drive') setPause(!paused); },
    full: () => toggleFull(),
    zoom: () => toggleZoom(),
    home: () => { location.href = 'index.html'; },
    about: () => alertBox('About Gravel Riot', '<p><b>Gravel Riot</b> &middot; checkpoint 4: rivals</p><p>A cel-shaded rally racer with power-ups, rendered small and run through the same dither as the rest of heind.nl. Built with Three.js; every texture and sound is generated in code.</p><p>Coming next: the cup, time trial with a ghost, and polish.</p>'),
    view: () => cycle('view', 1),
    help: () => { if (mode === 'drive') { setPause(true); return; } openPanel('ctrls'); }
};
document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cycle]');
    if (c && !c.closest('.mb-drop')) { cycle(c.dataset.cycle, 1); return; }
    const opt = e.target.closest('[data-opt]');
    if (opt) {
        const [k, v] = opt.dataset.opt.split(':');
        if (v) { CFG[k] = isNaN(+v) ? v : +v; saveCfg(); syncOptions(); if (k === 'track' || k === 'weather') reloadTrack(); } else cycle(k, 1);
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
    let s = Math.min(aw / RES.w, ah / RES.h);
    if (s >= 2 && !coarse && (!full || Math.floor(s) / s > 0.85)) s = Math.floor(s);
    scale = Math.max(1, s);
    const sc = $('#screen');
    sc.style.width = Math.round(RES.w * scale) + 'px';
    sc.style.height = Math.round(RES.h * scale) + 'px';
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
    if (mode === 'drive' && press('pause') && !$('#dialogs').children.length) setPause(!paused);
    else hits.delete('pause');
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
            cars.forEach((c) => { c.sync(dt); carFx(c); });
            pickups.update(dt, T, cars, cam, (c, type) => { if (c === car) { audio.fx('pickup'); feed(`${title(PU[type].name)}`, 0); } });
            weapons.update(dt, cars, T);
            if (!race || race.count <= 0) { const ctx = { track, cars, weapons, rank: rankCars, player: car, pickups }; for (const c of cars) if (c.driver && c !== car) c.driver.tactics(dt, ctx); }
            if (results > 0 && (results -= dt) <= 0) showResults();
            if (CFG.view === 'cockpit') { cockpit.update(dt, track.def.rain); cockpit.place(cam); }
            else chase(dt);
        } else {
            car.sync(dt);
            if (mode === 'garage') orbit(T * 1.6, 6.2, 1.5, 0.17); else orbit(T, 14, 3.5, 0);
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
        post.set({ rain: track.def.rain ? (inCockpit ? 0.6 : 0.8) : 0, slant: 0.15 + Math.min(0.6, rv / 80) });
        audio.setRain(track.def.rain ? (inCockpit ? 1 : 0.6) : 0);
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
    if (track) track.sky.position.set(cam.position.x, cam.position.y + 70, cam.position.z);
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
        if (driving) cockpit.renderMirror(renderer, scene);
        post.setInset(cockpit.rt.texture, driving && CFG.view !== 'cockpit');
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
fit();
loadTrack(trackById(CFG.track));
showCar(carById(CFG.car));
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
    get race() { return race; }, rankCars: () => rankCars(), showResults: () => showResults(),
    give: (type, c = car) => { c.slots.push({ type, ammo: PU[type].ammo || 1 }); }, get weapons() { return weapons; }
};

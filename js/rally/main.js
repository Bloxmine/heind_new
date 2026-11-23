/* Gravel Riot: checkpoint 1, the test drive. */
import * as THREE from 'three';
import { RES, Post, setWobble, glows, MAIN_ONLY } from './retro.js';
import { surfaceTextures } from './textures.js';
import { buildTrack } from './track.js';
import { Car, CARS, SURF } from './car.js';
import { TRACKS } from './tracks.js';
import { CarAudio } from './audio.js';
import { Cockpit } from './cockpit.js';
import { Rain, Droplets, addPuddles, rainy } from './weather.js';

const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const fmt = (t) => (t == null || !isFinite(t) ? '-:--.--' : `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`);

/* ---------- settings ---------- */
const CFG = Object.assign({ look: 'night', fps: 30, wobble: 1, crt: true, sound: true, lines: true, ink: true, glow: true, view: 'chase', weather: 'auto', track: 'alpine' }, store.get('heind.rally', {}));
const WEATHERS = ['auto', 'dry', 'rain', 'snow'];
if (!WEATHERS.includes(CFG.weather)) CFG.weather = 'auto';
const trackById = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
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
const rain = new Rain(scene);
const drops = new Droplets();
const sun = new THREE.DirectionalLight('#ffffff', 3.2);
const hemi = new THREE.HemisphereLight('#ffffff', '#445533', 2.4);
scene.add(sun, hemi);

function reloadTrack() {
    loadTrack(trackById(CFG.track));
    spawnCar(CARS[0]);
    if (mode === 'drive') startDrive();
}
function loadTrack(base) {
    trackDef = base;
    const w = CFG.weather === 'auto' ? base.weather || 'dry' : CFG.weather;
    const def = w === 'rain' ? rainy(base) : base;
    def.snowfall = w === 'snow';
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
function spawnCar(spec) {
    if (car) scene.remove(car.mesh.root);
    car = new Car(spec, track);
    scene.add(car.mesh.root);
    const g = track.gridSlot(0);
    car.place(g.x, g.y, g.z, g.heading);
    car.lastGy = car.y;
    car.setHeadlights(track.def.headlights || 0);
    cockpit = new Cockpit(car);
    cockpit.setVisible(mode === 'drive' && CFG.view === 'cockpit');
    if (!shadow) {
        shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.8), new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthWrite: false }));
        shadow.rotation.order = 'YXZ';
        scene.add(shadow);
    }
}

/* ---------- dust ---------- */
const DUST = 260;
const dustGeo = new THREE.BufferGeometry();
const dPos = new Float32Array(DUST * 3), dCol = new Float32Array(DUST * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 2, vertexColors: true, sizeAttenuation: false }));
dust.frustumCulled = false;
dust.layers.set(MAIN_ONLY);
const sunDisc = glows(new THREE.Mesh(new THREE.CircleGeometry(34, 20), new THREE.MeshBasicMaterial({ color: '#ffd8a0', fog: false })));
scene.add(sunDisc);
const sunDir = new THREE.Vector3();
scene.add(dust);
const dp = Array.from({ length: DUST }, () => ({ life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0 }));
let dI = 0;
const tmpC = new THREE.Color();
function emitDust(x, y, z, col, vx, vz) {
    const p = dp[dI = (dI + 1) % DUST];
    Object.assign(p, { life: 0.6 + Math.random() * 0.5, x, y: y + 0.2, z, vx: vx * 0.3 + (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.5, vz: vz * 0.3 + (Math.random() - 0.5) * 2 });
    tmpC.set(col); dCol[dI * 3] = tmpC.r; dCol[dI * 3 + 1] = tmpC.g; dCol[dI * 3 + 2] = tmpC.b;
}
function updDust(dt) {
    for (let i = 0; i < DUST; i++) {
        const p = dp[i];
        if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 1.5 * dt; }
        dPos[i * 3] = p.x; dPos[i * 3 + 1] = p.life > 0 ? p.y : -9999; dPos[i * 3 + 2] = p.z;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.color.needsUpdate = true;
}

/* ---------- input ---------- */
const keys = new Set(), hits = new Set();
const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'hand', ShiftLeft: 'hand', KeyR: 'reset', Escape: 'pause', KeyP: 'pause', Enter: 'ok', NumpadEnter: 'ok', KeyF: 'full', KeyZ: 'ok', Backspace: 'back', KeyC: 'view', KeyV: 'view'
};
const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
addEventListener('keydown', (e) => {
    if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!keys.has(a)) hits.add(a);
    if (a === 'up' || a === 'down') hits.add(a === 'up' ? 'mup' : 'mdown');
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
    pad.hand = b(2) > 0.5 || b(5) > 0.5;
    const edge = (i, a) => { const on = b(i) > 0.5; if (on && !pad.prev[i]) { hits.add(a); audio.start(); } pad.prev[i] = on; };
    edge(9, 'pause'); edge(0, 'ok'); edge(1, 'back'); edge(3, 'reset'); edge(12, 'mup'); edge(13, 'mdown');
}
// touch: steering buttons, brake and handbrake; the throttle is automatic
const touch = { left: false, right: false, brake: false, hand: false };
$$('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('down'); audio.start(); };
    const off = () => { touch[k] = false; b.classList.remove('down'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
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

/* ---------- audio ---------- */
const audio = new CarAudio();
audio.on = CFG.sound;
document.addEventListener('pointerdown', () => audio.start());

/* ---------- camera ---------- */
let camH = 0, camY = 0, fov = 62;
function chase(dt, snap) {
    const k = snap ? 1 : Math.min(1, dt * 4.2);
    camH += angDiff(car.h, camH) * k;
    const back = 6.6, up = 2.6;
    const cx = car.x - Math.sin(camH) * back, cz = car.z - Math.cos(camH) * back;
    const gq = track.query(cx, cz, car.q.i);
    const wantY = Math.max(car.y + up, gq.y + 1.2);
    camY = snap ? wantY : camY + (wantY - camY) * Math.min(1, dt * 6);
    cam.position.set(cx, camY, cz);
    cam.lookAt(car.x + Math.sin(camH) * 4, car.y + 1.1, car.z + Math.cos(camH) * 4);
    const wantF = 60 + Math.min(12, car.speed * 0.22);
    fov += (wantF - fov) * Math.min(1, dt * 3);
    cam.fov = fov; cam.updateProjectionMatrix();
}
function orbit(t) {
    const a = t * 0.25;
    cam.position.set(car.x + Math.sin(a) * 8, car.y + 2.4, car.z + Math.cos(a) * 8);
    cam.lookAt(car.x, car.y + 0.9, car.z);
    cam.fov = 50; cam.updateProjectionMatrix();
}

/* ---------- minimap ---------- */
const mm = $('#minimap'), mmx = mm.getContext('2d');
let mmBase = null, mmT = null;
function drawMinimapBase() {
    const S = track.S;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    S.forEach((s) => { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); });
    const sc = 56 / Math.max(x1 - x0, z1 - z0);
    // map is drawn as seen from above with the track's -x on the right, matching the chase view's left/right
    mmT = (x, z) => [60 - ((x - x0) * sc + (56 - (x1 - x0) * sc) / 2), 60 - ((z - z0) * sc + (56 - (z1 - z0) * sc) / 2)];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.lineJoin = 'round';
    const path = () => { x.beginPath(); S.forEach((s, i) => { const [px, py] = mmT(s.x, s.z); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); };
    x.strokeStyle = '#04070f'; x.lineWidth = 5; path(); x.stroke();
    x.strokeStyle = '#dff4ff'; x.lineWidth = 2; path(); x.stroke();
    const [sx, sy] = mmT(S[0].x, S[0].z); x.fillStyle = '#ffd23f'; x.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
    mmBase = c;
}
function drawMinimap() {
    mmx.clearRect(0, 0, 64, 64);
    mmx.drawImage(mmBase, 0, 0);
    const [px, py] = mmT(car.x, car.z);
    mmx.fillStyle = '#04070f'; mmx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5);
    mmx.fillStyle = '#e8562a'; mmx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
}

/* ---------- HUD ---------- */
const hudCache = {};
const setText = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $('#' + id).textContent = v; } };
let msgT = 0, burst = 0;
const message = (txt, t = 1.6) => { const el = $('#h-msg'); el.textContent = txt; el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); msgT = t; };

/* ---------- game state ---------- */
let mode = 'title', paused = false;
let lap = 0, lapT = 0, lapStarted = false, best = null, lastProg = 0, wrongWay = 0, stuckT = 0;
const bestKey = () => 'heind.rally.best.' + track.def.id;

function resetToRoad() {
    const s = track.S[car.q.i];
    car.place(s.x, s.y + 0.4, s.z, Math.atan2(s.tx, s.tz));
    car.lastGy = car.y;
    chase(0, true);
    message('BACK ON THE ROAD', 1);
}

function startDrive() {
    mode = 'drive';
    document.body.dataset.mode = 'drive';
    hideAll(); show('hud'); setMenu(null);
    spawnCar(CARS[0]);
    lap = 0; lapT = 0; lapStarted = false; lastProg = car.q.prog; wrongWay = 0;
    best = store.get(bestKey(), null);
    setText('h-track', track.def.name);
    cockpit.setVisible(CFG.view === 'cockpit');
    chase(0, true);
    message('TEST DRIVE: GO!', 1.6);
    audio.beep(880, 0.25);
}
function toTitle() {
    mode = 'title';
    document.body.dataset.mode = 'title';
    paused = false;
    hideAll(); show('title');
    spawnCar(CARS[0]);
    setMenu($('#title-menu'));
    syncOptions();
}

function updDrive(dt) {
    const inp = readDrive();
    car.step(dt, inp);
    // laps
    const N = track.N, p = car.q.prog;
    if (lastProg > N * 0.75 && p < N * 0.25) {
        if (lapStarted) {
            const t = lapT;
            if (best == null || t < best) { best = t; store.set(bestKey(), t); message(`BEST LAP ${fmt(t)}!`, 2.2); audio.beep(1320, 0.3); }
            else message(`LAP ${fmt(t)}`, 1.6);
        }
        lapStarted = true; lap++; lapT = 0;
    } else if (lastProg < N * 0.25 && p > N * 0.75) { lap = Math.max(0, lap - 1); lapStarted = false; }
    lastProg = p;
    if (lapStarted) lapT += dt;
    // wrong way and stuck detection
    const fwd = Math.sin(car.h) * car.q.tx + Math.cos(car.h) * car.q.tz;
    wrongWay = fwd < -0.3 && car.speed > 4 ? wrongWay + dt : 0;
    stuckT = car.speed < 1 && inp.throttle ? stuckT + dt : 0;
    if (press('reset') || stuckT > 4 || car.y < car.q.y - 6) { resetToRoad(); stuckT = 0; }
    if (car.scrape > 0.6 && !car.scrapeSnd) { audio.thud(car.scrape); car.scrapeSnd = true; }
    if (car.scrape < 0.1) car.scrapeSnd = false;
    if (car.land > 0.5 && !car.landSnd) { audio.thud(car.land); car.landSnd = true; burst = Math.max(burst, car.land); }
    if (car.land < 0.1) car.landSnd = false;
    // spray: puddles throw up a wall of water, wet roads a fine mist
    if (car.inPuddle && car.speed > 5) {
        if (!car.splashed) { audio.splash(); car.splashed = true; }
        for (let k = 0; k < 4; k++) emitDust(car.x + (Math.random() - 0.5) * 2, car.y + 0.2, car.z + (Math.random() - 0.5) * 2, '#c8d4e0', car.vx * 0.6 + (Math.random() - 0.5) * 8, car.vz * 0.6 + (Math.random() - 0.5) * 8);
    } else car.splashed = false;
    if (track.wet && car.ground && car.speed > 10 && Math.random() < car.speed / 160) {
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        emitDust(car.x - fx * 2, car.y, car.z - fz * 2, '#8a96a4', car.vx, car.vz);
    }
    // dust
    const surf = track.wet ? null : SURF[car.q.surface];
    if (surf && surf.dust && car.ground && car.speed > 6 && Math.random() < 0.3 + car.speed / 60 + car.slip / 10) {
        for (const sx of [-1, 1]) {
            const fx = Math.sin(car.h), fz = Math.cos(car.h);
            emitDust(car.x - fx * 1.7 + fz * sx * 0.8, car.y, car.z - fz * 1.7 - fx * sx * 0.8, surf.dust, car.vx, car.vz);
        }
    }
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
    const rough = { dirt: 0.5, gravel: 0.7, sand: 0.6, snow: 0.3, tarmac: 0.05, verge: 0.8, grass: 0.9 }[car.q.surface] || 0.5;
    audio.update(mode === 'title' ? 0.2 : rpm, paused ? 0 : inp.throttle, paused ? 0 : car.slip, paused ? 0 : car.speed, rough, !car.ground);
    if (mode === 'drive') {
        setText('h-speed', String(Math.round(car.speed * 3.6)));
        setText('h-gear', car.vf < -0.5 ? 'R' : String(g));
    }
}

/* ---------- menus (keyboard, gamepad, mouse) ---------- */
let menu = null;
function setMenu(el) {
    if (!el) { menu = null; return; }
    const items = $$('button', el).filter((b) => !b.hidden);
    menu = { el, items, i: 0 };
    items.forEach((b, j) => { b.onpointerenter = () => { if (menu && menu.el === el) { menu.i = j; markSel(); } }; });
    markSel();
}
function markSel() { if (menu) menu.items.forEach((b, j) => b.classList.toggle('sel', j === menu.i)); }
function menuInput() {
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
const hideAll = () => ['title', 'hud', 'pause'].forEach((id) => show(id, false));

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
    if (what === 'weather') { CFG.weather = WEATHERS[(WEATHERS.indexOf(CFG.weather) + (dir > 0 ? 1 : WEATHERS.length - 1)) % WEATHERS.length]; saveCfg(); reloadTrack(); }
    if (what === 'track') { const i = TRACKS.indexOf(trackById(CFG.track)); CFG.track = TRACKS[(i + (dir > 0 ? 1 : TRACKS.length - 1)) % TRACKS.length].id; saveCfg(); reloadTrack(); }
    saveCfg(); syncOptions(); audio.beep(660, 0.05);
}
function syncOptions() {
    post.setLook(LOOKS[CFG.look] || LOOKS.night);
    post.set({ ink: CFG.ink, glow: CFG.glow });
    setWobble(CFG.wobble);
    $$('[data-cycle="look"] b').forEach((b) => { b.textContent = (LOOKS[CFG.look] || LOOKS.night).name; });
    $$('[data-cycle="lines"] b').forEach((b) => { b.textContent = CFG.lines ? 'ON' : 'OFF'; });
    $$('[data-cycle="view"] b').forEach((b) => { b.textContent = CFG.view === 'chase' ? 'CHASE' : 'COCKPIT'; });
    $$('[data-cycle="weather"] b').forEach((b) => { b.textContent = CFG.weather === 'auto' ? 'TRACK' : CFG.weather.toUpperCase(); });
    $$('[data-cycle="track"] b').forEach((b) => { b.textContent = trackById(CFG.track).name; });
    $$('[data-cycle="fps"] b').forEach((b) => { b.textContent = CFG.fps + ' FPS'; });
    $$('[data-cycle="wobble"] b').forEach((b) => { b.textContent = ['OFF', 'ON', 'EXTRA'][CFG.wobble]; });
    $$('[data-cycle="sound"] b').forEach((b) => { b.textContent = CFG.sound ? 'ON' : 'OFF'; });
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
    drive: () => startDrive(),
    resume: () => setPause(false),
    restart: () => { paused = false; show('pause', false); startDrive(); },
    quit: () => toTitle(),
    pause: () => { if (mode === 'drive') setPause(!paused); },
    full: () => toggleFull(),
    zoom: () => toggleZoom(),
    home: () => { location.href = 'index.html'; },
    about: () => alertBox('About Gravel Riot', '<p><b>Gravel Riot</b> &middot; checkpoint 2: four tracks</p><p>A rally racer in the style of early-2000s phone 3D, run through the same dither as the rest of heind.nl. Built with Three.js; every texture and sound is generated in code.</p><p>Coming next: more tracks, rivals, and power-ups.</p>'),
    view: () => cycle('view', 1),
    help: () => alertBox('Controls', '<p><b>Driving</b></p><p>&uarr; / W accelerate &middot; &darr; / S brake &amp; reverse<br>&larr; &rarr; / A D steer &middot; SPACE handbrake<br>C cockpit / chase camera &middot; R back on the road<br>P pause &middot; F full screen</p><p>Gamepad: stick to steer, RT gas, LT brake, X handbrake.</p>')
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

function alertBox(title, html) {
    const was = paused;
    if (mode === 'drive' && !paused) setPause(true);
    const box = document.createElement('div');
    box.className = 'dlg-back';
    box.innerHTML = `<div class="dlg" role="alertdialog" aria-label="${title}"><div class="mac-title"><span class="mt-name"><span>${title}</span></span></div><div class="dlg-body"><i class="dlg-ico"></i><div>${html}</div></div><div class="dlg-btns"><button class="btn default" type="button">OK</button></div></div>`;
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
    const aw = full ? innerWidth : vw - (vw < 600 ? 22 : 60), ah = vh - chromeH - (coarse ? 76 : 0);
    let s = Math.min(aw / RES.w, ah / RES.h);
    if (s >= 2 && !coarse && (!full || Math.floor(s) / s > 0.85)) s = Math.floor(s);
    scale = Math.max(1, s);
    const sc = $('#screen');
    sc.style.width = Math.round(RES.w * scale) + 'px';
    sc.style.height = Math.round(RES.h * scale) + 'px';
    sc.style.setProperty('--px', (scale * 0.75) + 'px');
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
    if (press('pause') && mode === 'drive' && !$('#dialogs').children.length) setPause(!paused);
    menuInput();
    if (!paused) {
        T += dt;
        if (mode === 'drive') {
            acc += dt;
            while (acc >= STEP) { updDrive(STEP); acc -= STEP; }
            car.sync(dt);
            if (CFG.view === 'cockpit') { cockpit.update(dt, track.def.rain); cockpit.place(cam); }
            else chase(dt);
        } else if (mode === 'title') {
            car.sync(dt);
            orbit(T);
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
        // screen rain is lighter behind the glass (the wipers and drops do the work there) and slants with speed
        const rv = mode === 'drive' ? car.speed : 0;
        post.set({ rain: track.def.rain ? (inCockpit ? 0.6 : 0.8) : 0, slant: 0.15 + Math.min(0.6, rv / 80) });
        audio.setRain(track.def.rain ? (inCockpit ? 1 : 0.6) : 0);
        updDust(dt);
        if (msgT > 0 && (msgT -= dt) <= 0) $('#h-msg').hidden = true;
        $('#h-wrong').hidden = !(wrongWay > 0.8 && mode === 'drive');
        if (mode === 'drive') setText('h-time', lapStarted ? fmt(lapT) : '-:--.--');
        setText('h-lap', String(Math.max(1, lap)));
        setText('h-best', fmt(best));
    }
    engineSound();
    if (shadow && car) {
        shadow.position.set(car.x, car.q.y + 0.05, car.z);
        shadow.rotation.set(-Math.PI / 2, 0, 0); shadow.rotation.y = car.h; shadow.rotation.x = -Math.PI / 2;
        shadow.material.opacity = clamp(1 - (car.y - car.q.y) * 0.25, 0.2, 1);
    }
    if (track) track.sky.position.set(cam.position.x, cam.position.y + 70, cam.position.z);
    sunDisc.position.copy(cam.position).addScaledVector(sunDir, 820);
    sunDisc.lookAt(cam.position);
    burst = Math.max(0, burst - dt * 2.5);
    const lineK = mode === 'drive' && CFG.lines && !paused ? clamp((car.speed - 16) / 30, 0, 1) : 0;
    post.set({ speed: lineK, burst: CFG.lines ? burst : 0, time: T });
    renderAcc += dt;
    if (renderAcc >= 1 / CFG.fps - 0.002) {
        renderAcc = 0;
        if (mode === 'drive' && CFG.view === 'cockpit') cockpit.renderMirror(renderer, scene);
        post.render(scene, cam);
        if (mode === 'drive') drawMinimap();
    }
    hits.clear();
}

/* ---------- boot ---------- */
fit();
loadTrack(trackById(CFG.track));
toTitle();
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
rs.setProperty('--i-sub', pix(CARI, { K: '#000000', W: '#9fd8f5', P: '#5b46d8' }));
rs.setProperty('--i-subbig', pix(CARI, { K: '#000000', W: '#9fd8f5', P: '#5b46d8' }, 2));
const logo = $('.logo-word');
// each letter of the tag sits at its own angle, like it was sprayed by hand
if (logo) logo.innerHTML = [...'GRAVEL RIOT'].map((c, i) => c === ' ' ? '<span class="sp"> </span>'
    : `<span style="--i:${i};--r:${((i * 37) % 9 - 4) * 1.6 - 2}deg;--y:${((i * 13) % 7 - 3) * 0.7};--dl:${5 + ((i * 5) % 4) * 3}">${c}</span>`).join('');
$('#loading')?.remove();
requestAnimationFrame(frame);

// for testing from the console
window.RALLY = { scene, set override(f) { override = f; }, get car() { return car; }, get track() { return track; }, get mode() { return mode; }, startDrive, keys, hits, cam, CFG, syncOptions };

/* Yard Sale Showdown: the app. Renderer and look, input, menus, the HUD, and running a match:
   solo against bots, hosting an online game, or joining one. */
import * as THREE from 'three';
import { RES, Post, MAIN_ONLY, GLOW, setWobble } from '../rally/retro.js';
import { Ambient } from './ambient.js';
import { Level } from './geom.js';
import { MAPS, mapById } from './maps.js';
import { buildSky } from './decor.js';
import { buildMap } from './bake.js';
import { World, TICK } from './sim.js';
import { Nav, Bot } from './bots.js';
import { View } from './view.js';
import { Sfx } from './sfx.js';
import { WEAPONS, ITEMS, CHARS, TEAMS, MEDALS, MODES, SKILLS, SHORT, MELEE, VERBS, VEHICLES, CLASSES, STYLES, KIT, KIT_SLOTS, THROWN, DEFAULT_KIT, randomKit } from './defs.js';
import { Host, Client, makeCode, snapshot, applySnapshot, interpolate } from './net.js';
import { modeIcon } from './icons.js';
import { portraits, Stage } from './loadout.js';

const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const store = {
    get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ordinal = (n) => n + (['TH', 'ST', 'ND', 'RD'][(n % 100 - 20) % 10] || ['TH', 'ST', 'ND', 'RD'][n % 100] || 'TH');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CFG = Object.assign({ look: 'map', map: 'coalworks', res: 2, fps: 60, sens: 5, invert: false, fov: 95, dodge: true, assist: true, ink: true, glow: true, crt: true, wobble: 1,
    sound: true, music: true, mode: 'dm', style: 'arena', cls: 0, kit: null, bots: 3, skill: 1, frags: null, time: null, char: 0, name: '' }, store.get('heind.showdown', {}));
const save = () => store.set('heind.showdown', CFG);
// settings saved before maps had their own colours used the old default look
if (!CFG.v) { if (CFG.look === 'night') CFG.look = 'map'; CFG.v = 2; }

/* ---------- looks (the same palettes as Gravel Riot) ---------- */
const NIGHT = ['#07090c', '#11151a', '#1c2229', '#2a3139', '#3b434c', '#4f5862', '#66707a', '#808a93', '#9ca5ad', '#bcc3c8', '#dde2e5', '#ffffff',
    '#0f2a28', '#1d4440', '#2f625a', '#4a8078', '#6fa39a', '#2e2a1e', '#4a4330', '#6a5f44', '#8c7d5a', '#ad9e78',
    '#5a2a1e', '#8a3a22', '#c2502a', '#e8783a', '#f2a85a', '#ffd27a', '#1a2a3e', '#2e4660', '#4a6a8a', '#7a9cbc',
    '#3ad0ff', '#ff3a6e', '#b04aff', '#4aff7a', '#ffe23a', '#8e8cc0', '#c4c0e4', '#a8c8e8'];
const MOODY = { sat: 0.78, con: 1.1, vig: 0.38, shadow: [0.9, 1.0, 1.04], high: [1.1, 1.02, 0.92] };
const SEA = window.SEA && window.SEA.SEA_PAL ? window.SEA.SEA_PAL.hexes : NIGHT;
const LOOKS = {
    map: { name: 'MAP COLOURS' },
    night: { name: 'NIGHT SHIFT', mode: 'palette', hexes: NIGHT, spread: 22, ink: '#07090c', line: '#dde8ee', grade: MOODY },
    java: { name: 'JAVA 4096', mode: 'java', spread: 17, ink: '#000000', line: '#ffffff', grade: MOODY },
    sea: { name: 'SEAOS COLOUR', mode: 'palette', hexes: SEA, spread: 30, ink: '#04070f', line: '#ffffff', grade: { sat: 1.1, con: 1.05, vig: 0.25, shadow: [1, 1, 1], high: [1, 1, 1] } },
    dmg: { name: 'DMG GREEN', mode: 'palette', hexes: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], spread: 66, ink: '#0f380f', line: '#9bbc0f' },
    raw: { name: 'NO DITHER', mode: 'raw', ink: '#07090c', line: '#dde8ee', grade: MOODY }
};
if (!LOOKS[CFG.look]) CFG.look = 'map';
// the map's own palette, taken from its reference photo
const lookNow = () => (CFG.look === 'map' ? Object.assign({ name: 'MAP COLOURS', mode: 'palette', spread: 22, ink: '#07090c', line: '#dde8ee', grade: MOODY, hexes: NIGHT }, MAP.look || {}) : LOOKS[CFG.look]);

/* ---------- renderer ---------- */
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
window.__aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
// where the sun is on screen, for its flare (the post pass draws it)
function placeFlare() {
    const S = MAP.sky;
    if (!S || (!S.sun && !S.moon)) { post.sunFlare(cam, null); return; }
    post.sunFlare(cam, S.sun ? new THREE.Vector3(...MAP.sun.dir).multiplyScalar(-1) : new THREE.Vector3(...S.moonDir), S.sun || S.moon, S.sun ? 1 : 0.3, S.sun ? 1 : 0.4);
}
const post = new Post(renderer);
const scene = new THREE.Scene();
let MAP = mapById(CFG.map);
scene.background = new THREE.Color('#141a22');
scene.fog = new THREE.Fog('#141a22', 30, 90);
const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 300);
cam.rotation.order = 'YXZ';
const sun = new THREE.DirectionalLight('#ffffff', 1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);
// point the sun (or moon) and fit its shadow over the map
function placeSun() {
    const B = MAP.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, R = Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2 + 4;
    const d = new THREE.Vector3(...MAP.sun.dir).normalize();
    sun.color.set(MAP.sun.color); sun.intensity = MAP.sun.i;
    sun.target.position.set(cx, 0, cz);
    sun.position.copy(d).multiplyScalar(-(R + 40)).add(sun.target.position);
    const c = sun.shadow.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = R * 2 + 90;
    c.updateProjectionMatrix();
    sun.shadow.bias = MAP.sky ? -0.0004 : -0.0008; sun.shadow.normalBias = MAP.sky ? 0.06 : 0.03;
    sun.castShadow = MAP.sun.shadow !== false;
    sun.shadow.needsUpdate = true;
}
function setRes() {
    RES.w = 320 * CFG.res; RES.h = 180 * CFG.res;
    renderer.setSize(RES.w, RES.h, false);
    post.resize();
    if (view) view.parts.mat.uniforms.uScale.value = RES.h;
}
function applyLook() {
    post.setLook(lookNow());
    post.set({ ink: CFG.ink, glow: CFG.glow });
    $('#screen').classList.toggle('crt', CFG.crt);
    setWobble(CFG.wobble ? CFG.res : 0);
    document.body.dataset.pal = CFG.look;
}

/* ---------- audio ---------- */
const sfx = new Sfx();
sfx.on = CFG.sound;
const music = new Ambient(sfx);       // slow ambient pieces, one per map (see ambient.js)
music.on = CFG.music;
const wake = () => { sfx.start(); music.poke(); };

/* ---------- the map ---------- */
let level = null, lighting = null, nav = null, mapRoot = null, skyRoot = null;
const mapCache = {};
// switch to a map, building and baking it the first time
async function loadMap(id) {
    const def = mapById(id);
    if (mapRoot && MAP === def) return;
    if (mapRoot) scene.remove(mapRoot);
    if (skyRoot) scene.remove(skyRoot);
    MAP = def;
    let c = mapCache[def.id];
    if (!c) {
        const prev = mode;
        const ld = $('#loading');
        ld.hidden = false; loadBar.style.width = '0%';
        $('p', ld).textContent = `BAKING THE LIGHT: ${def.name.toUpperCase()}…`;
        setMode('loading');
        const lv = new Level(def.solids);
        const built = await buildMap(lv, def, (k) => { loadBar.style.width = Math.round(k * 90) + '%'; });
        await new Promise((r) => setTimeout(r, 0));
        const nv = new Nav(lv, def);
        loadBar.style.width = '100%';
        c = mapCache[def.id] = { level: lv, root: built.root, lighting: built.lighting, nav: nv };
        ld.hidden = true;
        setMode(prev === 'loading' ? 'title' : prev);
    }
    level = c.level; lighting = c.lighting; nav = c.nav; mapRoot = c.root;
    scene.add(mapRoot);
    const far = def.far || 300;
    cam.far = far; cam.updateProjectionMatrix();
    skyRoot = buildSky(def, far * 0.8);
    scene.add(skyRoot);
    scene.background = new THREE.Color(def.sky ? def.sky.horizon : def.fog.color);
    scene.fog.color.set(def.fog.color); scene.fog.near = def.fog.near; scene.fog.far = def.fog.far;
    placeSun();
    applyLook();
    if (window.YSS) Object.assign(window.YSS, { level, nav, MAP });
}
const loadBar = $('#load-bar');

/* ---------- state ---------- */
let mode = 'loading';          // loading, title, play
let S = null;                  // the running match
let view = null;
const setMode = (m) => { mode = m; document.body.dataset.mode = m; };

/* ---------- input ---------- */
const keys = new Set();
const KEYS = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    Space: 'jump', ShiftLeft: 'crouch', ShiftRight: 'crouch', KeyC: 'crouch', KeyF: 'full', Tab: 'scores', Escape: 'pause', KeyP: 'pause', KeyQ: 'last', KeyE: 'use', KeyG: 'special'
};
const DODGE = { f: [0, 1], b: [0, -1], l: [-1, 0], r: [1, 0] };
const tapAt = {};
const mouse = { b0: false, b2: false };
const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
let locked = false, lostAt = 0;
function lockMouse() {
    try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not now: the click-to-play prompt stays up */ }
}

addEventListener('keydown', (e) => {
    wake();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Escape' && performance.now() - lostAt < 400) return;     // that Esc just released the mouse
    if (typing()) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') { document.activeElement.blur(); if (e.key !== 'Tab') menuKey(e); e.preventDefault(); }
        return;
    }
    if (panel) { if (menuKey(e)) { e.preventDefault(); return; } }
    const a = KEYS[e.code];
    if (a) e.preventDefault();
    if (e.repeat) return;
    if (a === 'full') { toggleFull(); return; }
    if (mode !== 'play' || !S) { keys.add(a); return; }
    if (a === 'pause') { if (!panel || panel === 'scores') openPause(); return; }
    if (a) keys.add(a);
    const me = S.me;
    if (DODGE[a] && CFG.dodge) { const now = performance.now(); if (now - (tapAt[a] || 0) < 260) { me.in.dodge = DODGE[a]; tapAt[a] = 0; } else tapAt[a] = now; }
    // dead in Conquest: number keys pick a class, A/D pick where to spawn
    if (S.W.rules.kits) {
        if (!me.alive && e.code === 'KeyL') { openLoadout('ingame'); return; }
        if (a === 'special') { me.in.lethal = true; return; }
        if (a === 'last') { me.in.tactical = true; return; }
    }
    if (S.W.rules.classes && !me.alive) {
        if (/^Digit[1-5]$/.test(e.code)) me.cls = +e.code.slice(5) - 1;
        if (S.W.cq && (a === 'l' || a === 'r')) cycleSpawn(a === 'l' ? -1 : 1);
        return;
    }
    if (a === 'use') me.in.use = true;
    if (a === 'special') me.in.special = true;
    if (/^Digit[1-9]$/.test(e.code)) me.in.wsel = +e.code.slice(5);
    if (a === 'jump') S.jumpQ = true;          // a tap shorter than a frame still jumps
    if (a === 'last' && S.lastW) me.in.wpick = S.lastW;
});
addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) keys.delete(a); });
addEventListener('blur', () => { keys.clear(); mouse.b0 = mouse.b2 = false; });
canvas.addEventListener('mousedown', (e) => {
    wake();
    if (mode !== 'play' || panel) return;
    if (!locked && !padActive) { lockMouse(); return; }
    if (e.button === 0) mouse.b0 = true; if (e.button === 2) mouse.b2 = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.b0 = false; if (e.button === 2) mouse.b2 = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
$('#screen').addEventListener('contextmenu', (e) => { if (mode === 'play') e.preventDefault(); });
addEventListener('mousemove', (e) => {
    if (!locked || !S || mode !== 'play' || panel) return;
    const me = S.me, z = me.zoom ? 0.3 : 1;
    const k = 0.00042 * CFG.sens * z;
    me.yaw -= e.movementX * k;
    me.pitch = clamp(me.pitch - e.movementY * k * (CFG.invert ? -1 : 1), -1.5, 1.5);
});
addEventListener('wheel', (e) => { if (mode === 'play' && S && !panel && locked) { if (S.W.cq && !S.me.alive) cycleSpawn(e.deltaY > 0 ? 1 : -1); else S.me.in.wnext = e.deltaY > 0 ? 1 : -1; } }, { passive: true });
// the spawn points you may choose: your HQ and the flags you hold
const spawnOptions = () => (S && S.W.cq ? ['hq', ...S.W.flags.filter((f) => f.owner === S.me.team && !f.contested).map((f) => f.id)] : []);
function cycleSpawn(d) { const o = spawnOptions(); const i = o.indexOf(S.me.spawnAt); S.me.spawnAt = o[((i < 0 ? 0 : i) + d + o.length) % o.length]; }
document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    $('#screen').classList.toggle('locked', locked);
    if (!locked) { lostAt = performance.now(); mouse.b0 = mouse.b2 = false; if (mode === 'play' && S && !panel && !padActive) openPause(); }
    updClick();
});
const updClick = () => { $('#click').hidden = !(mode === 'play' && S && !panel && !locked && !padActive); };

// gamepad: sticks, triggers, buttons
let padActive = false;
const pad = { mx: 0, mz: 0, lx: 0, ly: 0, f1: false, f2: false, jump: false, crouch: false, prev: [] };
function pollPad(dt) {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    pad.mx = pad.mz = pad.lx = pad.ly = 0; pad.f1 = pad.f2 = pad.jump = pad.crouch = false;
    if (!gp) return;
    const b = (i) => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
    const dz = (v, d = 0.16) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
    const ax = (i) => gp.axes[i] || 0;
    pad.mx = dz(ax(0)); pad.mz = -dz(ax(1)); pad.lx = dz(ax(2), 0.12); pad.ly = dz(ax(3), 0.12);
    pad.f1 = b(7) > 0.4; pad.f2 = b(6) > 0.4; pad.jump = b(0) > 0.5; pad.crouch = b(1) > 0.5;
    const any = pad.mx || pad.mz || pad.lx || pad.ly || gp.buttons.some((x) => x.pressed);
    if (any && !padActive) { padActive = true; updClick(); }
    const edge = (i) => { const on = b(i) > 0.5, was = pad.prev[i]; pad.prev[i] = on; return on && !was; };
    const E = {}; for (const i of [0, 1, 2, 3, 4, 5, 8, 9, 11, 12, 13, 14, 15]) E[i] = edge(i);
    if (panel || mode !== 'play') {
        if (E[12] || (pad.mz > 0.6 && !pad.navT)) menuKey({ key: 'ArrowUp' });
        if (E[13] || (pad.mz < -0.6 && !pad.navT)) menuKey({ key: 'ArrowDown' });
        if (E[14] || (pad.mx < -0.6 && !pad.navT)) menuKey({ key: 'ArrowLeft' });
        if (E[15] || (pad.mx > 0.6 && !pad.navT)) menuKey({ key: 'ArrowRight' });
        pad.navT = Math.abs(pad.mz) > 0.6 || Math.abs(pad.mx) > 0.6 ? (pad.navT || 0) + 1 : 0;
        if (pad.navT > 14) pad.navT = 0;
        if (E[0]) menuKey({ key: 'Enter' });
        if (E[1]) menuKey({ key: 'Escape' });
        if (E[9] && mode === 'play') closePanels();
        return;
    }
    if (!S) return;
    const me = S.me;
    if (E[9]) { openPause(); return; }
    if (S.W.rules.classes && !me.alive) { if (E[14] || E[4]) cycleSpawn(-1); if (E[15] || E[5]) cycleSpawn(1); if (E[12]) me.cls = (me.cls + 4) % 5; if (E[13]) me.cls = (me.cls + 1) % 5; return; }
    if (S.W.cq && E[3]) me.in.use = true;
    if (S.W.cq && E[13]) me.in.special = true;
    if (E[5] || (E[3] && !S.W.cq) || E[15]) me.in.wnext = 1;
    if (E[4] || E[14]) me.in.wnext = -1;
    if (E[11] || E[12]) me.in.wsel = 1;
    if (E[13] && S.lastW) me.in.wpick = S.lastW;
    if (E[2]) me.in.dodge = Math.hypot(pad.mx, pad.mz) > 0.3 ? [Math.round(pad.mx), Math.round(pad.mz)] : [0, -1];
    pad.scores = b(8) > 0.5;
    // look, with a curve, and aim assist: slow down over a target and drift with it
    const speed = 3.4 * CFG.sens / 5 * (me.zoom ? 0.3 : 1);
    let lx = pad.lx * Math.abs(pad.lx), ly = pad.ly * Math.abs(pad.ly);
    if (CFG.assist && (lx || ly || pad.mx || pad.mz)) {
        const t = assistTarget(me);
        if (t) {
            lx *= 0.55; ly *= 0.55;
            const pull = 1.2 * dt * (1 - t.off / 0.09);
            me.yaw += clamp(t.dy, -pull, pull); me.pitch += clamp(t.dp, -pull, pull);
        }
    }
    me.yaw -= lx * speed * dt;
    me.pitch = clamp(me.pitch - ly * speed * 0.7 * dt * (CFG.invert ? -1 : 1), -1.5, 1.5);
}
function assistTarget(me) {
    const W = S.W, e = W.eye(me);
    let best = null;
    for (const b of W.actors) {
        if (!b.alive || !W.enemies(me, b) || W.hidden(b)) continue;
        const px = b.x - e[0], py = b.y + b.h * 0.6 - e[1], pz = b.z - e[2];
        const ty = Math.atan2(-px, -pz), tp = Math.atan2(py, Math.hypot(px, pz));
        let dy = ty - me.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        const dp = tp - me.pitch, off = Math.hypot(dy, dp);
        if (off > 0.09 || Math.hypot(px, pz) > 40) continue;
        if (!W.level.clear(e[0], e[1], e[2], b.x, b.y + b.h * 0.6, b.z)) continue;
        if (!best || off < best.off) best = { dy, dp, off };
    }
    return best;
}
// what the local player wants this frame
function gather() {
    const me = S.me, I = me.in;
    const k = (a) => keys.has(a);
    const playing = !panel || panel === 'scores';
    let mx = (k('r') ? 1 : 0) - (k('l') ? 1 : 0) + pad.mx, mz = (k('f') ? 1 : 0) - (k('b') ? 1 : 0) + pad.mz;
    if (!playing) mx = mz = 0;
    I.mx = clamp(mx, -1, 1); I.mz = clamp(mz, -1, 1);
    I.jump = playing && (k('jump') || pad.jump);
    I.crouch = playing && (k('crouch') || pad.crouch);
    I.fire1 = playing && (mouse.b0 || pad.f1);
    if (I.fire1) music.duck(0.3);             // the music steps back while you're shooting
    I.fire2 = playing && (mouse.b2 || pad.f2);
    if (me.cur !== S.curW) { if (S.curW) S.lastW = S.curW; S.curW = me.cur; }
}

/* ---------- menus ---------- */
let panel = null;
const stack = [];
const PANELS = ['title', 'setup', 'join', 'opts', 'ctrls', 'pause', 'results', 'scores', 'loadout'];
function showPanel(id, push = true) {
    if (push && panel && panel !== id && panel !== 'scores') stack.push(panel);
    panel = id;
    for (const p of PANELS) $('#' + p).hidden = p !== id;
    if (id === 'title') stack.length = 0;
    selIx = 0;
    refreshSel();
    refreshCycles();
    if (locked && id && id !== 'scores') document.exitPointerLock();
    updClick();
}
function closePanels() {
    for (const p of PANELS) $('#' + p).hidden = true;
    panel = null; stack.length = 0;
    if (S && S.kind === 'solo') S.paused = false;
    if (mode === 'play' && !padActive) lockMouse();
    updClick();
}
function back() {
    const prev = stack.pop();
    if (prev) showPanel(prev, false);
    else if (mode === 'play') closePanels();
    else showPanel('title', false);
}
let selIx = 0;
const items = () => (panel ? $$('#' + panel + ' .menu > button, #' + panel + ' .menu > label') : []);
function refreshSel() { items().forEach((b, i) => b.classList.toggle('sel', i === selIx)); }
function menuKey(e) {
    if (!panel || panel === 'scores') return false;
    const list = items();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!list.length) return true;
        selIx = (selIx + (e.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length;
        refreshSel(); sfx.play('switch', null, 0.5);
        return true;
    }
    const cur = list[selIx];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (cur && cur.dataset.cycle) { cycle(cur.dataset.cycle, e.key === 'ArrowLeft' ? -1 : 1); sfx.play('switch', null, 0.5); }
        return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
        if (!cur) return true;
        if (cur.tagName === 'LABEL') { const inp = $('input', cur); inp.focus(); inp.select(); return true; }
        cur.click();
        return true;
    }
    if (e.key === 'Escape' || e.key === 'Backspace') {
        if (panel === 'title') return true;
        if (panel === 'pause') { closePanels(); return true; }
        if (panel === 'results') return true;
        back();
        return true;
    }
    return false;
}
document.addEventListener('mouseover', (e) => {
    const b = e.target.closest('.menu > button, .menu > label');
    if (!b || !panel) return;
    const i = items().indexOf(b);
    if (i >= 0 && i !== selIx) { selIx = i; refreshSel(); }
});
document.addEventListener('click', (e) => {
    wake();
    const pm = e.target.closest('[data-pick-map]');
    if (pm) { CFG.map = pm.dataset.pickMap; if (!modesFor(CFG.map).includes(CFG.mode)) setMode2('tdm'); save(); refreshCycles(); sfx.play('switch', null, 0.5); return; }
    const ps = e.target.closest('[data-pick-style]');
    if (ps) { if (MODES[CFG.mode].styles) { CFG.style = ps.dataset.pickStyle; save(); refreshCycles(); sfx.play('switch', null, 0.5); } return; }
    const pd = e.target.closest('[data-pick-mode]');
    if (pd) { if (modesFor(CFG.map).includes(pd.dataset.pickMode)) { setMode2(pd.dataset.pickMode); save(); refreshCycles(); sfx.play('switch', null, 0.5); } return; }
    const c = e.target.closest('[data-cycle]');
    if (c && c.closest('.menu')) { const r = c.getBoundingClientRect(); cycle(c.dataset.cycle, e.clientX < r.left + r.width * 0.45 && c.querySelector('b') && c.textContent.includes('◀') ? -1 : 1); return; }
    const a = e.target.closest('[data-act]');
    if (a) { act(a.dataset.act); closeMenus(); }
    const o = e.target.closest('[data-opt]');
    if (o) { const k = o.dataset.opt; CFG[k] = !CFG[k]; applyOpt(k); refreshCycles(); closeMenus(); }
});

// the values each cycling row steps through
const FRAGS = [5, 10, 15, 20, 25, 30, 40, 50, 0], TIMES = [3, 5, 8, 10, 15, 20], FOVS = [80, 85, 90, 95, 100, 105, 110], FPSS = [60, 30];
/* ---------- the loadout screen ---------- */
let loKind = 'solo', stage = null;
// what this match lets you choose: a class (Conquest), a kit (Tactical), or just who you are (Arena)
function loadoutNeeds() {
    if (loKind === 'join') return { cls: true, kit: true, join: true };
    if (loKind === 'ingame') return { cls: !!S.W.rules.classes, kit: !!S.W.rules.kits };
    const M = MODES[CFG.mode];
    return { cls: !!M.classes, kit: !!M.styles && CFG.style === 'tactical' };
}
function openLoadout(kind) {
    loKind = kind;
    if (!stage) stage = new Stage();
    CFG.kit = Object.assign({}, DEFAULT_KIT, CFG.kit || {});
    renderLoadout();
    showPanel('loadout', kind !== 'ingame');
}
function renderLoadout() {
    const P = portraits(renderer), need = loadoutNeeds();
    const ingame = loKind === 'ingame' && S;
    const ch = ingame ? S.me.char : CFG.char;
    $('#lo-chars').innerHTML = CHARS.map((c, i) => '<button type="button" class="mcard' + (i === ch ? ' on' : '') + (ingame ? ' off' : '') + '" data-lo-char="' + i + '"><img src="' + P.chars[i] + '" alt=""><span class="nm">' + c.name + '</span></button>').join('');
    $('#lo-cls-wrap').hidden = !need.cls;
    $('#lo-cls-note').textContent = need.join ? 'IF THE HOST PLAYS CONQUEST' : '';
    $('#lo-classes').innerHTML = CLASSES.map((c, i) => '<button type="button" class="mcard' + (i === CFG.cls ? ' on' : '') + '" data-lo-cls="' + i + '"><span class="nm">' + c.name + '</span><span class="sub">' + c.role + '</span><span class="wp">' + Object.keys(c.kit).map((w) => '<img src="' + P.weapons[w] + '" alt="" title="' + WEAPONS[w].name + '">').join('') + '</span></button>').join('');
    $('#lo-kit-wrap').hidden = !need.kit;
    $('#lo-kit-note').textContent = need.join ? 'IF THE HOST PLAYS TACTICAL' : '';
    $('#lo-kit').innerHTML = KIT_SLOTS.map(([slot, label]) => '<div class="lo-kit-row"><b>' + label + '</b><div class="opts">' + KIT[slot].map((w) => '<button type="button" class="mcard' + (CFG.kit[slot] === w ? ' on' : '') + '" data-lo-kit="' + slot + ':' + w + '"><img src="' + (P.weapons[w === 'trap' ? 'rake' : w] || '') + '" alt=""><span class="nm">' + (THROWN[w] || WEAPONS[w]).name + '</span></button>').join('') + '</div></div>').join('');
    const K = CLASSES[CFG.cls];
    $('#lo-desc').innerHTML = need.kit ? 'Primary and secondary with full ammo, a melee weapon, one lethal and two tacticals. No pickups; health comes back.'
        : need.cls ? '<b>' + K.name + '</b> — ' + K.desc : 'Arena: you start with a pool noodle and a water pistol and pick up everything else on the map.';
    const c = CHARS[ch];
    $('#lo-name').innerHTML = esc(c.name) + '<small>' + c.job + (need.cls && !need.join ? ' · ' + K.name : '') + '</small>';
    stage.show(ch, need.kit ? -1 : CFG.cls, need.cls || need.kit, need.kit ? CFG.kit.primary : null);
}
function deployLoadout() {
    save();
    if (loKind === 'ingame') { if (S) { S.me.kit = Object.assign({}, CFG.kit); S.me.cls = CFG.cls; } closePanels(); return; }
    if (loKind === 'host') startHost(); else if (loKind === 'join') startJoin($('#code').value); else startSolo();
}
document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-lo-char]'), k = e.target.closest('[data-lo-cls]'), t = e.target.closest('[data-lo-kit]');
    if (c && loKind !== 'ingame') { CFG.char = +c.dataset.loChar; renderLoadout(); refreshCycles(); }
    if (k) { CFG.cls = +k.dataset.loCls; renderLoadout(); }
    if (t) { const [slot, w] = t.dataset.loKit.split(':'); CFG.kit = Object.assign({}, CFG.kit, { [slot]: w }); renderLoadout(); }
    if (c || k || t) sfx.play('switch', null, 0.5);
});
// picking a mode: reset the limits to its own, and fit the number of bots to it
function setMode2(m) {
    CFG.mode = m; CFG.frags = null; CFG.time = null;
    if (m === 'duel') CFG.bots = Math.min(CFG.bots, 1);
    else if (m === 'conquest') CFG.bots = Math.max(CFG.bots, 9);
    else CFG.bots = Math.min(CFG.bots, 7);
}
// the lobby's cards: a picture of each map, an icon for each mode
function renderSetup() {
    const mapsEl = $('#su-maps');
    if (!mapsEl) return;
    const sig = CFG.map + '|' + CFG.mode + '|' + CFG.style;
    if (renderSetup.sig === sig) return;
    renderSetup.sig = sig;
    mapsEl.innerHTML = MAPS.map((m) => {
        const B = m.bounds, area = (B.x1 - B.x0) * (B.z1 - B.z0);
        const size = area < 3000 ? 'SMALL' : area < 7000 ? 'MEDIUM' : 'LARGE';
        const kind = !m.sky ? 'INDOORS' : m.night || m.sky.stars ? 'NIGHT' : 'DAY';
        const tag = m.conquest ? '<i class="tag">CONQUEST</i>' : '';
        return '<button type="button" class="mcard' + (m.id === CFG.map ? ' on' : '') + '" data-pick-map="' + m.id + '"><img src="images/showdown/maps/' + m.id + '.png" alt="" onerror="this.style.visibility=\'hidden\'"><span class="nm">' + esc(m.name) + '</span><span class="sub">' + size + ' · ' + kind + '</span>' + tag + '</button>';
    }).join('');
    const ok = modesFor(CFG.map);
    $('#su-modes').innerHTML = Object.keys(MODES).map((k) => '<button type="button" class="mcard' + (k === CFG.mode ? ' on' : '') + (ok.includes(k) ? '' : ' off') + '" data-pick-mode="' + k + '" title="' + MODES[k].desc + '"><img src="' + modeIcon(k) + '" alt=""><span class="nm">' + MODES[k].name + '</span></button>').join('');
    const styled = !!MODES[CFG.mode].styles;
    $('#su-styles').innerHTML = Object.entries(STYLES).map(([k, st]) => '<button type="button" class="mcard style' + (styled && CFG.style === k ? ' on' : '') + (styled ? '' : ' off') + '" data-pick-style="' + k + '"><span class="nm">' + st.name + '</span><span class="sub">' + (k === 'arena' ? 'PICKUPS ON THE MAP' : 'CLASSES · NO PICKUPS') + '</span></button>').join('');
    $('#su-desc').innerHTML = '<b>' + MODES[CFG.mode].name + (styled ? ' · ' + STYLES[CFG.style].name : '') + '</b> — ' + (styled ? STYLES[CFG.style].desc : MODES[CFG.mode].desc);
}
// Conquest needs a map that has flags
const modesFor = (id) => Object.keys(MODES).filter((m) => m !== 'conquest' || mapById(id).conquest);
const maxPlayers = () => MODES[CFG.mode].max || 8;
const fragsOf = () => (CFG.frags != null ? CFG.frags : MODES[CFG.mode].frags);
const timeOf = () => (CFG.time != null ? CFG.time : MODES[CFG.mode].time);
const step = (list, v, d) => list[(Math.max(0, list.indexOf(v)) + d + list.length) % list.length];
function cycle(k, d) {
    switch (k) {
        case 'mode': setMode2(step(modesFor(CFG.map), CFG.mode, d)); break;
        case 'style': CFG.style = step(Object.keys(STYLES), CFG.style, d); break;
        case 'map': CFG.map = step(MAPS.map((m) => m.id), CFG.map, d); if (!modesFor(CFG.map).includes(CFG.mode)) setMode2('tdm'); break;
        case 'bots': { const mx = maxPlayers() - 1; CFG.bots = (CFG.bots + d + mx + 1) % (mx + 1); } if (CFG.mode === 'duel') CFG.bots = clamp(CFG.bots, setupKind === 'host' ? 0 : 1, 1); break;
        case 'skill': CFG.skill = (CFG.skill + d + SKILLS.length) % SKILLS.length; break;
        case 'frags': CFG.frags = step(FRAGS, fragsOf(), d); break;
        case 'time': CFG.time = step(TIMES, timeOf(), d); break;
        case 'char': CFG.char = (CFG.char + d + CHARS.length) % CHARS.length; break;
        case 'sens': CFG.sens = clamp(Math.round((CFG.sens + d * 0.5) * 2) / 2, 0.5, 15); break;
        case 'fov': CFG.fov = step(FOVS, CFG.fov, d); break;
        case 'look': { const L = Object.keys(LOOKS); CFG.look = step(L, CFG.look, d); applyLook(); break; }
        case 'res': CFG.res = ((CFG.res - 1 + d + 4) % 4) + 1; setRes(); applyLook(); break;
        case 'fps': CFG.fps = step(FPSS, CFG.fps, d); break;
        default: CFG[k] = !CFG[k]; applyOpt(k);
    }
    save(); refreshCycles();
}
function applyOpt(k) {
    if (k === 'sound') sfx.setOn(CFG.sound);
    if (k === 'music') music.setOn(CFG.music);
    if (k === 'ink' || k === 'glow' || k === 'crt') applyLook();
    save();
}
const ON = (v) => (v ? 'ON' : 'OFF');
function refreshCycles() {
    const V = {
        mode: MODES[CFG.mode].name, style: MODES[CFG.mode].styles ? STYLES[CFG.style].name : '—', map: mapById(CFG.map).name.toUpperCase(), bots: CFG.mode === 'duel' ? (CFG.bots ? '1' : 'NONE') : String(CFG.bots), skill: SKILLS[CFG.skill].name,
        frags: fragsOf() ? String(fragsOf()) : 'NONE', time: timeOf() + ' MIN', char: `${CHARS[CFG.char].name.toUpperCase()} · ${CHARS[CFG.char].job.toUpperCase()}`,
        sens: CFG.sens.toFixed(1), invert: ON(CFG.invert), fov: CFG.fov + '°', dodge: ON(CFG.dodge), assist: ON(CFG.assist), look: lookNow().name,
        res: ['RETRO 320', 'SHARP 640', 'HIGH 960', 'HD 1280'][CFG.res - 1], fps: CFG.fps + ' FPS', ink: ON(CFG.ink), glow: ON(CFG.glow), crt: ON(CFG.crt), sound: ON(CFG.sound), music: ON(CFG.music)
    };
    for (const el of $$('[data-cycle]')) { const b = el.querySelector('b'); if (b && V[el.dataset.cycle] != null) b.textContent = V[el.dataset.cycle]; }
    for (const el of $$('[data-opt]')) { const li = el.closest('li'); if (li) li.classList.toggle('on', !!CFG[el.dataset.opt]); }
    renderSetup();
}
let setupKind = 'solo';
function openSetup(kind) {
    setupKind = kind;
    if (S) leave();
    $('#setup-title').textContent = kind === 'host' ? 'host a game' : 'play vs bots';
    $('#start-btn').textContent = kind === 'host' ? 'Open the room' : 'Start';
    $('#setup-note').innerHTML = kind === 'host' ? 'You get a four-letter room code to give your friends. Bots fill the empty places and make way when people join (up to 8 players).' : '';
    if (CFG.mode === 'duel') CFG.bots = kind === 'host' ? Math.min(CFG.bots, 1) : 1;
    $('#name').value = CFG.name;
    showPanel('setup', mode === 'title');
}
function act(a) {
    switch (a) {
        case 'solo': openSetup('solo'); break;
        case 'host': openSetup('host'); break;
        case 'join': if (S) leave(); $('#name2').value = CFG.name; $('#code').value = ''; $('#join-note').textContent = 'Ask the host for the four-letter room code.'; showPanel('join', mode === 'title'); break;
        case 'options': showPanel('opts'); break;
        case 'help': showPanel('ctrls'); break;
        case 'back': back(); break;
        case 'start': CFG.name = cleanName($('#name').value); save(); openLoadout(setupKind); break;
        case 'connect': CFG.name = cleanName($('#name2').value); save(); openLoadout('join'); break;
        case 'deploy': deployLoadout(); break;
        case 'resume': closePanels(); break;
        case 'pause': if (mode === 'play') openPause(); break;
        case 'quit': if (S) { leave(); toTitle(); } break;
        case 'again': if (S && S.kind !== 'client') { S.W.reset(); closePanels(); } break;
        case 'menu': leave(); toTitle(); break;
        case 'full': toggleFull(); break;
        case 'home': location.href = 'index.html'; break;
        case 'about': about(); break;
    }
}
const cleanName = (s) => (s || '').replace(/[^\w .\-!?']/g, '').trim().slice(0, 12) || 'Player';
function openPause() {
    if (!S) return;
    if (S.kind === 'solo') S.paused = true;
    $('#pause-note').textContent = S.kind === 'solo' ? '' : S.kind === 'host' ? `Room ${S.code}: the match keeps going while you're here.` : 'The match keeps going while you\'re here.';
    showPanel('pause', false);
}
function toTitle() {
    setMode('title');
    $('#hud').hidden = true;
    showPanel('title');
    music.want('showdown');
}

/* ---------- running a match ---------- */
function newView(W) {
    if (view) { scene.remove(view.root); scene.remove(view.parts.points); }
    view = new View(scene, W, lighting);
    view.parts.mat.uniforms.uScale.value = RES.h;
}
function addBots(W, n, skill) {
    const used = new Set(W.actors.map((a) => a.char));
    for (let i = 0; i < n; i++) addBot(W, skill, used);
}
function addBot(W, skill, used = new Set(W.actors.map((a) => a.char))) {
    let ci = W.actors.length % CHARS.length; for (let k = 0; k < CHARS.length; k++) if (!used.has(k)) { ci = k; break; }
    used.add(ci);
    // with more players than characters, names repeat: number them
    const base = CHARS[ci].name, same = W.actors.filter((b) => b.name === base || b.name.startsWith(base + ' ')).length;
    const a = W.addActor({ name: same ? `${base} ${same + 1}` : base, char: ci, team: teamFor(W), cls: Math.floor(Math.random() * CLASSES.length), kit: randomKit() });
    new Bot(a, skill);
    return a;
}
const teamFor = (W) => { if (!W.rules.teams) return 0; const n = [0, 0]; for (const a of W.actors) n[a.team]++; return n[0] <= n[1] ? 0 : 1; };
function beginPlay(kind, W, me, extra = {}) {
    S = Object.assign({ kind, W, me, paused: false, acc: 0, curW: null, lastW: null, deadAt: null, shake: 0, pending: [], snapT: 0, sendT: 0, pingT: 0, medalStats: {} }, extra);
    newView(W);
    hud.reset();
    setMode('play');
    $('#hud').hidden = false;
    $('#h-room').hidden = kind !== 'host';
    if (kind === 'host') $('#h-room').textContent = `ROOM ${S.code}`;
    closePanels();
    music.want(MAP.song);
}
async function startSolo() {
    await loadMap(CFG.map);
    const W = new World(MAP, level, { mode: CFG.mode, frags: fragsOf(), time: timeOf(), style: CFG.style });
    W.nav = nav;
    const me = W.addActor({ name: CFG.name, char: CFG.char, team: 0, human: true, local: true, cls: CFG.cls, kit: CFG.kit });
    addBots(W, CFG.mode === 'duel' ? 1 : CFG.bots, CFG.skill);
    beginPlay('solo', W, me);
}
async function startHost() {
    await loadMap(CFG.map);
    const code = makeCode();
    $('#setup-note').textContent = 'Opening the room…';
    const host = new Host(code);
    try { await host.open(); }
    catch (e) { $('#setup-note').textContent = 'Could not open a room: ' + (e.type || e.message || 'no connection') + '. Try again.'; return; }
    const W = new World(MAP, level, { mode: CFG.mode, frags: fragsOf(), time: timeOf(), style: CFG.style });
    W.nav = nav;
    const me = W.addActor({ name: CFG.name, char: CFG.char, team: 0, human: true, local: true, cls: CFG.cls, kit: CFG.kit });
    const max = maxPlayers();
    addBots(W, Math.min(CFG.mode === 'duel' ? CFG.bots : CFG.bots, max - 1), CFG.skill);
    const peers = new Map();
    host.onJoin = (c, m) => {
        if (!S || S.host !== host) return;
        if (W.actors.length >= max) {
            const bot = [...W.actors].reverse().find((a) => a.bot);
            if (!bot) { host.send(c, { t: 'full' }); setTimeout(() => c.close(), 300); return; }
            W.removeActor(bot);
        }
        const a = W.addActor({ name: cleanName(m.name), char: clamp(m.char | 0, 0, CHARS.length - 1), team: teamFor(W), human: true, remote: true, peer: c.peer, cls: m.cls | 0, kit: m.kit || null });
        peers.set(c.peer, { c, a });
        host.send(c, { t: 'welcome', id: a.id, mode: W.mode, frags: W.fragLimit, time: W.timeLimit / 60, map: MAP.id, style: W.style });
        hud.feed(`<b>${esc(a.name)}</b> joined`);
        sfx.play('chat');
    };
    host.onLeave = (c) => {
        const p = peers.get(c.peer);
        if (!p) return;
        peers.delete(c.peer);
        W.removeActor(p.a);
        if (CFG.bots > 0 && W.actors.length < Math.min(max, CFG.bots + 1 + peers.size)) addBot(W, CFG.skill);
    };
    host.onMsg = (c, m) => {
        const p = peers.get(c.peer);
        if (!p) return;
        const a = p.a;
        if (m.t === 'in') {
            const I = a.in;
            I.fire1 = !!m.f1; I.fire2 = !!m.f2; I.mx = m.mx || 0; I.mz = m.mz || 0;
            if (m.ws) I.wsel = m.ws; if (m.wn) I.wnext = m.wn; if (m.wp) I.wpick = m.wp;
            if (m.use) I.use = true; if (m.sp) I.special = true; if (m.lt) I.lethal = true; if (m.tc) I.tactical = true;
            if (m.kit) a.kit = m.kit;
            I.jump = !!m.j; I.crouch = !!m.cr;
            a.cls = m.cls | 0; a.spawnAt = m.at || 'hq';
            if (!a.veh) a.yaw = m.s ? m.s[6] : a.yaw;
            if (a.veh && m.s) { a.yaw = m.s[6]; a.pitch = m.s[7]; }
            if (a.alive && m.seq === a.seq && m.s && !a.veh) {
                const s = m.s;
                a.x = s[0]; a.y = s[1]; a.z = s[2]; a.vx = s[3]; a.vy = s[4]; a.vz = s[5]; a.yaw = s[6]; a.pitch = s[7]; a.h = s[8];
                a.ground = !!(s[9] & 1); a.slideT = s[9] & 2 ? 0.5 : 0; a.crouch = !!(s[9] & 4);
                a.eyeH = a.h - 0.18;
            }
        } else if (m.t === 'pong') a.ping = Math.round(performance.now() - m.ts);
    };
    beginPlay('host', W, me, { host, code, peers });
}
async function startJoin(raw) {
    const code = (raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (code.length !== 4) { $('#join-note').textContent = 'A room code has four letters.'; return; }
    $('#join-note').textContent = `Knocking on room ${code}…`;
    const client = new Client(code);
    let welcomed = false;
    client.onMsg = (m) => {
        if (m.t === 'full') { $('#join-note').textContent = 'That room is full.'; client.close(); return; }
        if (m.t === 'welcome' && !welcomed) {
            welcomed = true;
            onWelcome(m);
            return;
        }
        if (!S || S.client !== client) return;
        if (m.t === 'snap') onSnap(m);
        else if (m.t === 'ping') client.send({ t: 'pong', ts: m.ts });
    };
    // the host's map may need building first; snapshots that arrive meanwhile are skipped
    const onWelcome = async (m) => {
        $('#join-note').textContent = `Loading ${mapById(m.map).name}…`;
        await loadMap(m.map);
        {
            const W = new World(MAP, level, { mode: m.mode, frags: m.frags, time: m.time, authority: false, style: m.style });
            W.nav = nav;
            const me = W.addActor({ id: m.id, name: CFG.name, char: CFG.char, human: true, local: true, cls: CFG.cls, kit: CFG.kit });
            beginPlay('client', W, me, { client, code });
        }
    };
    client.onClose = () => { if (S && S.client === client) { leave(); toTitle(); toast('The host closed the game'); } };
    try { await client.open({ t: 'hello', name: CFG.name, char: CFG.char, cls: CFG.cls, kit: CFG.kit }); }
    catch (e) {
        const why = e && e.type === 'peer-unavailable' ? 'There is no room with that code.' : e && e.type === 'network' ? 'Could not reach the matchmaking server.' : 'The connection didn\'t get through (a strict firewall can block it).';
        $('#join-note').textContent = `Couldn't join room ${code}. ${why}`;
        console.warn('join failed', e && (e.type || e.message || e));
        client.close();
    }
}
function onSnap(m) {
    const W = S.W, me = S.me;
    applySnapshot(W, m, me.id, (row) => W.addActor({ id: row[0], name: row[25], char: row[17], team: row[16] }));
    if (!W.byId(me.id)) W.actors.push(me);
    for (const e of m.E) {
        if (e.t === 'spawn' && e.id === me.id) { me.x = e.x; me.y = e.y; me.z = e.z; me.yaw = e.yaw; me.pitch = 0; me.vx = me.vy = me.vz = 0; me.seq = e.seq; me.alive = true; me.h = 1.8; me.eyeH = 1.62; }
        if (e.t === 'imp' && e.id === me.id) { me.vx += e.v[0]; me.vy = Math.max(me.vy, 0) + e.v[1]; me.vz += e.v[2]; if (e.v[1] > 0.5) me.ground = false; }
        if (e.t === 'reset') hud.reset();
        handleEvent(e);
    }
}
function leave() {
    if (!S) return;
    if (S.host) S.host.close();
    if (S.client) S.client.close();
    if (view) { scene.remove(view.root); scene.remove(view.parts.points); view.vm.visible = false; view = null; }
    sfx.loop('car', [0, 0, 0], false);
    for (const v of S.W.vehicles || []) sfx.loop('v' + v.id, [0, 0, 0], false);
    S = null;
    if (locked) document.exitPointerLock();
}

/* ---------- events: effects, sounds, HUD ---------- */
function handleEvent(e) {
    if (view) view.event(e, S.W, sfx);
    hud.event(e);
}

/* ---------- the HUD ---------- */
const POW = { noodle: 'BONK!', slicer: 'SNIP!', rake: 'THUNK!', whip: 'CRACK!', pistol: 'SPLISH!', balloon: 'SPLOOSH!', blower: 'WHOOSH!', bat: 'THWACK!',
    tennis: 'THOK!', rocket: 'KA-FIZZ!', golf: 'FORE!', rc: 'VROOM!', trap: 'TWANG!', cone: 'SPLAT!', cart: 'CLATTER!', mower: 'BZZZT!', buggy: 'BEEP!', van: 'DING-DONG!' };
const MEDAL_BIG = new Set(['mega', 'ultra', 'spree10', 'spree15', 'spree20', 'homerun', 'hole']);
const PW_COL = { sauce: '#ff5a3a', espresso: '#c89a6a', sneakers: '#ff6ab4', box: '#d8b878' };
const PW_NAME = { sauce: 'HOT SAUCE', espresso: 'ESPRESSO', sneakers: 'SNEAKERS', box: 'BOX' };
const hud = {
    cache: {}, medals: [], medalT: 0, centerT: 0, feedList: [], dmgN: 0,
    set(id, v, html) { if (this.cache[id] === v) return; this.cache[id] = v; const el = $('#' + id); if (el) el[html ? 'innerHTML' : 'textContent'] = v; },
    reset() { for (const id of ['h-flags', 'h-cap', 'h-prompt', 'h-veh', 'deploy']) $('#' + id).hidden = true; this.cache = {}; this.medals = []; this.medalT = 0; this.centerT = 0; this.feedList = []; $('#h-feed').innerHTML = ''; $('#h-center').textContent = ''; $('#h-medal').innerHTML = ''; this.resultsShown = false; if (S) S.medalStats = {}; },
    feed(html, me) {
        const li = document.createElement('li'); li.innerHTML = html; if (me) li.className = 'me';
        const ul = $('#h-feed'); ul.prepend(li);
        while (ul.children.length > 5) ul.lastChild.remove();
        setTimeout(() => li.remove(), 6000);
    },
    center(html, t = 2.2, cls = '') { const el = $('#h-center'); el.innerHTML = html; el.className = 'h-center ' + cls; this.centerT = t; },
    pick(txt) { const el = $('#h-pick'); el.textContent = txt; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); },
    event(e) {
        if (!S) return;
        const W = S.W, me = S.me, A = (id) => W.byId(id);
        const nm = (a) => (a ? `<b class="${W.rules.teams ? 'b' + a.team : ''}">${esc(a === me ? 'You' : a.name)}</b>` : '<b>?</b>');
        switch (e.t) {
            case 'kill': {
                const k = A(e.k), v = A(e.v);
                const verb = VERBS[e.w] || (WEAPONS[e.w] && WEAPONS[e.w].verb) || 'splatted';
                if (k) this.feed(`${nm(k)} <em>${verb}</em> ${nm(v)}`, k === me || v === me);
                else this.feed(`${nm(v)} <em>splatted themselves</em>`, v === me);
                if (k) { const st = S.medalStats[k.id] || (S.medalStats[k.id] = {}); for (const m of e.medals) st[m] = (st[m] || 0) + 1; }
                if (k === me) {
                    this.hit(true);
                    for (const m of e.medals) this.medals.push([MEDALS[m][0], '+' + MEDALS[m][1], MEDAL_BIG.has(m)]);
                    this.center(`${esc(v ? v.name.toUpperCase() : '')} <small>+${e.pts}</small>`, 1.4);
                } else if (v === me) {
                    S.deadAt = [me.x, me.y, me.z]; S.killer = k ? k.id : 0;
                    const w = e.w === 'trap' ? 'a rake' : WEAPONS[e.w] ? 'a ' + WEAPONS[e.w].name.toLowerCase() : VEHICLES[e.w] ? 'a ' + VEHICLES[e.w].name.toLowerCase() : e.w === 'cone' ? 'a soft-serve' : 'something';
                    this.center(k ? `<big>ELIMINATED</big>by ${esc(k.name)} · ${w}` : `<big>ELIMINATED</big>${e.pts} pts`, 99);
                    this.deadShown = true; this.respawnHint = false;
                    S.shake = 0.6;
                }
                break;
            }
            case 'hurt':
                if (e.by === me.id && e.id !== me.id) { this.hit(false, e.head); sfx.play(e.head ? 'headhit' : 'hit', null, 0.8); }
                if (e.id === me.id) { this.ouch(e); music.duck(0.5); }
                break;
            case 'pickup':
                if (e.by === me.id) {
                    const D = ITEMS[W.items[e.id].type];
                    let t = D.name;
                    if (D.hp) t = `+${D.hp} ${D.name}`; else if (D.armor) t = `+${D.armor} ${D.name}`; else if (D.power) t = `${D.name}: ${D.desc}`;
                    else if (D.weapon === 'pistol' && me.dual) t = 'SUPER SOAKER!';
                    this.pick(t);
                    if (D.power) S.burst = 0.6;
                }
                break;
            case 'pwoff': if (e.id === me.id) this.pick(`${PW_NAME[e.pw]} WORE OFF`); break;
            case 'go': this.center('<big>GO</big>', 1.0, 'count'); sfx.play('go'); break;
            case 'over': this.overAt = performance.now(); sfx.play('bigmedal'); break;
            case 'tramp': if (e.id === me.id) S.burst = 0.8; break;
            case 'carboom': S.shake = Math.max(S.shake, 0.5); break;
            case 'burst': if (e.type === 'rocket') { const d = Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z); if (d < 10) S.shake = Math.max(S.shake, 0.35 * (1 - d / 10)); } break;
            case 'left': this.feed(`<b>${esc(e.name)}</b> left`); break;
            case 'level': if (e.id === me.id) { const L = W.rules.ladder; this.medals.push([`LEVEL ${e.gg + 1}`, L[e.gg] === 'soaker' ? 'SUPER SOAKER' : WEAPONS[L[e.gg]].name, true]); } else { const a = W.byId(e.id); if (a && e.gg >= W.rules.ladder.length - 1) this.feed(`<b>${esc(a.name)}</b> <em>is on the noodle!</em>`); } break;
            case 'enter': if (e.id === me.id) { const v = W.vehicle(e.v); if (v) { me.yaw = v.yaw; me.pitch = -0.1; } } break;
            case 'flag': { const f = W.flags[e.id]; if (f) this.feed(e.owner === -1 ? `<b>${esc(f.name)}</b> <em>neutralised</em>` : `<b class="b${e.owner}">${TEAMS[e.owner].name}</b> <em>took</em> <b>${esc(f.name)}</b>`, e.by === me.team); break; }
            case 'cap': if (e.id === me.id) this.medals.push([{ captured: 'FLAG CAPTURED', neutral: 'NEUTRALISED', healed: 'HEALED A TEAMMATE', resupplied: 'RESUPPLIED' }[e.what] || 'NICE', '+' + e.pts, e.what === 'captured']); break;
        }
    },
    // you got hit: make it impossible to miss
    ouch(e) {
        const me = S.me;
        sfx.play('hurt', null, 1);
        sfx.play('ouch', null, 0.9);
        const k = Math.min(1, e.amt / 50);
        S.hurt = Math.min(1, (S.hurt || 0) + 0.35 + k * 0.6);
        S.shake = Math.max(S.shake, 0.15 + k * 0.35);
        S.kick = { p: 0.03 + k * 0.07, r: (Math.random() < 0.5 ? -1 : 1) * (0.02 + k * 0.05) };
        // which way it came from, relative to where you're looking (0 = in front)
        let ang = 0;
        const fromElsewhere = e.by && e.by !== me.id;
        if (fromElsewhere) {
            ang = Math.atan2(-(e.x - me.x), -(e.z - me.z)) - me.yaw;
            const i = document.createElement('i'); i.style.setProperty('--a', (-ang) + 'rad');
            $('#dmg').append(i); setTimeout(() => i.remove(), 1400);
        }
        const hp = $('.h-vital .hp'); hp.classList.remove('hit'); void hp.offsetWidth; hp.classList.add('hit');
        const l = document.createElement('i'); l.className = 'lose'; l.textContent = '-' + e.amt; hp.append(l); setTimeout(() => l.remove(), 950);
    },
    conquest(W, me) {
        // the flags across the top
        const here = W.flags.find((f) => me.alive && Math.abs(me.y - f.y) <= f.dy && (me.x - f.x) ** 2 + (me.z - f.z) ** 2 <= f.r * f.r);
        const fl = W.flags.map((f) => `<li class="${f.owner >= 0 ? 'o' + f.owner : ''}${f.contested ? ' c' : ''}${f === here ? ' here' : ''}" style="--p:${Math.abs(f.v).toFixed(2)};--c:${f.v < 0 ? '#e8402e' : '#2a6ad8'}"><b>${f.id}</b></li>`).join('');
        $('#h-flags').hidden = false;
        this.set('h-flags', fl, true);
        // standing in a zone: how it's going
        $('#h-cap').hidden = !here;
        if (here) {
            const mine = me.team === 0 ? -here.v : here.v;
            this.set('h-cap-t', here.contested ? `${here.name} · CONTESTED` : here.owner === me.team && mine >= 1 ? `${here.name} · HELD` : `CAPTURING ${here.name}`);
            $('#h-cap-b').style.width = Math.round(Math.max(0, mine) * 100) + '%';
            $('#h-cap-b').style.background = mine >= 0 ? '#ffe23a' : '#ff3a3a';
        }
        // vehicles: what you could get into, or the one you're in
        let prompt = '';
        if (me.alive && me.veh) {
            const v = W.vehicle(me.veh);
            if (v) {
                const VS = VEHICLES[v.type], seat = VS.seats[me.seat] || {};
                prompt = `E · GET OUT` + (seat.driver ? ' · SPACE DRIFT · SHIFT HANDBRAKE' : seat.turret ? ' · CLICK TO FIRE' : '');
                $('#h-veh').hidden = false;
                this.set('h-veh-n', VS.name);
                $('#h-veh-b').style.width = Math.round(Math.max(0, v.hp / VS.hp) * 100) + '%';
            }
        } else {
            $('#h-veh').hidden = true;
            if (me.alive) for (const v of W.vehicles) {
                if (v.dead || !v.seats.includes(0) || Math.hypot(v.x - me.x, v.z - me.z) > Math.max(VEHICLES[v.type].l, 2) / 2 + 2) continue;
                if (v.seats.some((id) => { const o = id && W.byId(id); return o && o.team !== me.team; })) continue;
                prompt = `E · ${v.seats[0] ? 'RIDE IN THE' : 'DRIVE THE'} ${VEHICLES[v.type].name}`;
                break;
            }
        }
        $('#h-prompt').hidden = !prompt; this.set('h-prompt', prompt);
        // your class's thing to throw
        const K = CLASSES[me.cls | 0];
        if (me.alive && K.special) this.set('h-alt', (me.specialT || 0) > 0 ? `G · ${K.special === 'kit' ? 'FIRST-AID KIT' : 'AMMO CRATE'} ${Math.ceil(me.specialT)}` : `G · THROW ${K.special === 'kit' ? 'FIRST-AID KIT' : 'AMMO CRATE'}`);
        this.deploy(W, me);
    },
    deployKit(W, me) {
        $('#deploy').hidden = me.alive || W.state === 'over';
        $('#dp-spawn-h').hidden = $('#dp-spawns').hidden = true;
        if (me.alive) { this.set('h-alt', `G ${THROWN[(me.kit || DEFAULT_KIT).lethal].name} ×${me.lethalN || 0} · Q ${THROWN[(me.kit || DEFAULT_KIT).tactical].name} ×${me.tacN || 0}`); return; }
        const K = Object.assign({}, DEFAULT_KIT, me.kit || {});
        this.set('dp-classes', KIT_SLOTS.map(([k, label]) => `<li class="on">${label.split(' ·')[0]} · ${(THROWN[K[k]] || WEAPONS[K[k]]).name}</li>`).join(''), true);
        this.set('dp-go', (me.deadT || 0) < 1.2 ? 'L · CHANGE LOADOUT' : `${padActive ? 'RT' : 'CLICK'} TO DEPLOY · L TO CHANGE`);
    },
    // dead: choose a class, and in Conquest where to come back
    deploy(W, me) {
        $('#deploy').hidden = me.alive || W.state === 'over';
        $('#dp-spawn-h').hidden = $('#dp-spawns').hidden = !W.cq;
        if (!me.alive && !W.cq) {
            this.set('dp-classes', CLASSES.map((c, i) => `<li class="${i === (me.cls | 0) ? 'on' : ''}">${i + 1} · ${c.name} <small>${c.role} — ${c.desc}</small></li>`).join(''), true);
            this.set('dp-go', (me.deadT || 0) < 1.2 ? 'CHOOSE A CLASS' : `${padActive ? 'RT' : 'CLICK'} TO DEPLOY`);
        }
        if (!me.alive && W.cq) {
            const opts = spawnOptions();
            if (!opts.includes(me.spawnAt)) me.spawnAt = 'hq';
            this.set('dp-classes', CLASSES.map((c, i) => `<li class="${i === (me.cls | 0) ? 'on' : ''}">${i + 1} · ${c.name} <small>${c.role} — ${c.desc}</small></li>`).join(''), true);
            this.set('dp-spawns', opts.map((o) => `<li class="${o === me.spawnAt ? 'on' : ''}">${o === 'hq' ? 'HQ' : W.flags.find((f) => f.id === o).name}</li>`).join(''), true);
            const left = Math.max(0, 4 - (me.deadT || 0));
            this.set('dp-go', W.tickets[me.team] <= 0 ? 'NO TICKETS LEFT' : left > 0 ? `DEPLOY IN ${Math.ceil(left)}` : `${padActive ? 'RT' : 'CLICK'} TO DEPLOY`);
        }
    },
    hit(kill, head) { const el = $('#hitm'); el.className = 'hitm'; void el.offsetWidth; el.className = 'hitm on' + (kill ? ' kill' : ''); },
    update(dt) {
        const W = S.W, me = S.me;
        // medals, one after another
        this.medalT -= dt;
        if (this.medalT <= 0 && this.medals.length) {
            const [txt, pts, big] = this.medals.shift();
            const el = $('#h-medal'); el.innerHTML = `<b class="${big ? 'big' : ''}">${txt}</b><small>${pts}</small>`;
            el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
            sfx.play(big ? 'bigmedal' : 'medal', null, 0.7);
            this.medalT = 1.25;
        }
        this.centerT -= dt;
        if (W.state === 'warmup') {
            const n = Math.ceil(W.stateT);
            this.set('h-center', `<big>${n}</big>${esc(MODES[W.mode].name)} · ${W.fragLimit ? W.fragLimit + (W.rules.teams ? ' TEAM KILLS' : ' KILLS') : 'NO KILL LIMIT'}`, true);
            $('#h-center').className = 'h-center count';
            if (n !== this.lastCount) { this.lastCount = n; sfx.play('tick', null, 0.6); }
        } else if (!me.alive && W.state === 'play') {
            const t = me.deadT || 0;
            if (S.kind === 'client') me.deadT = (me.deadT || 0) + dt;
            if (t > 1.2 && !this.respawnHint && !W.rules.classes) { this.respawnHint = true; $('#h-center').insertAdjacentHTML('beforeend', `<small>${padActive ? 'RT' : 'CLICK'} TO RESPAWN</small>`); }
        } else {
            if (me.alive && this.deadShown) { this.deadShown = false; this.respawnHint = false; this.centerT = 0; }
            if (this.centerT <= 0 && this.cache['h-center'] !== '') { this.set('h-center', ''); $('#h-center').className = 'h-center'; }
        }
        if (this.centerT > 0) this.cache['h-center'] = null;
        // vitals and ammo
        const hp = Math.max(0, Math.round(me.hp));
        this.set('h-hp', String(hp));
        $('#h-hp').className = hp <= 25 ? 'low' : hp > 100 ? 'over' : '';
        this.set('h-ar', String(Math.round(me.armor)));
        $('.h-vital .ar').classList.toggle('none', me.armor <= 0);
        const w = me.next || me.cur, Wd = WEAPONS[w];
        this.set('h-wname', w === 'pistol' && me.dual ? WEAPONS.pistol.name2 : Wd.name);
        const ammo = Wd.ammo && !W.rules.infinite ? String(me.ammo[w] || 0) : '∞';
        this.set('h-ammo', w === 'rake' ? `${me.traps} ` : ammo);
        $('#h-ammo').className = Wd.ammo && (me.ammo[w] || 0) <= Math.ceil(Wd.ammo[2] / 3) ? 'low' : '';
        let alt = '';
        if (w === 'rake') alt = 'TRAPS LEFT'; else if (w === 'pistol' && me.charge > 0) alt = 'CHARGE ' + '▮'.repeat(Math.ceil(me.charge * 5));
        else if (w === 'rocket' && me.loaded) alt = 'LOADED ×' + me.loaded; else if (w === 'tennis' && me.spin > 0 && me.spin < 1) alt = 'SPINNING UP';
        else if (me.car) alt = `CAR ${Math.max(0, Math.ceil(me.car.life || 0))}S · CLICK TO POP`;
        this.set('h-alt', alt);
        // the weapon bar
        const slots = [];
        for (let s = 1; s <= 9; s++) {
            const ws = Object.keys(WEAPONS).filter((k) => WEAPONS[k].slot === s);
            const own = ws.filter((k) => me.inv[k]);
            const show = own.includes(w) ? w : own[0] || ws[0];
            const dry = own.length && WEAPONS[show].ammo && !(me.ammo[show] > 0) && !(show === 'rc' && me.car);
            slots.push(`<li class="${own.length ? 'own' : ''}${own.includes(w) ? ' cur' : ''}${dry ? ' dry' : ''}"><i>${s}</i>${s === 2 && me.dual ? 'SOAKER×2' : SHORT[show]}</li>`);
        }
        this.set('h-slots', slots.join(''), true);
        $('#xh').className = 'xh' + (Wd.melee ? ' melee' : '') + (w === 'blower' || w === 'tennis' ? ' wide' : '');
        $('#zoom').hidden = !(me.zoom && me.cur === 'golf' && me.alive);
        // power-ups
        const pw = Object.keys(me.pw).filter((k) => me.pw[k] > 0).map((k) => `<li style="--c:${PW_COL[k]}" class="${me.pw[k] < 4 ? 'out' : ''}">${PW_NAME[k]} ${Math.ceil(me.pw[k])}</li>`).join('');
        this.set('h-pw', pw, true);
        // time, rank, score
        const tl = W.timeLeft;
        this.set('h-time', fmtT(tl));
        $('#h-time').classList.toggle('low', tl < 30 && W.state === 'play');
        $('#h-teams').hidden = !W.rules.teams;
        const TS = W.cq ? W.tickets : W.teamScore;
        if (W.rules.teams) { this.set('h-t0', String(TS[0])); this.set('h-t1', String(TS[1])); }
        if (W.cq) this.conquest(W, me);
        else if (W.rules.classes) this.deploy(W, me);
        else if (W.rules.kits) this.deployKit(W, me);
        $('#flashed').style.opacity = Math.min(1, (me.flashT || 0) / 1.4).toFixed(2);
        const rk = W.ranking(), pos = rk.indexOf(me) + 1;
        this.set('h-rank', W.rules.teams ? (TS[me.team] > TS[1 - me.team] ? 'WINNING' : TS[me.team] < TS[1 - me.team] ? 'LOSING' : 'TIED') : `${ordinal(pos)}/${rk.length}`);
        this.set('h-pts', `${me.score} PTS`);
        if (W.rules.gungame) { const L = W.rules.ladder, g = me.gg || 0; this.set('h-kills', `LEVEL ${g + 1}/${L.length}` + (g + 1 < L.length ? ` · NEXT ${SHORT[L[g + 1] === 'soaker' ? 'pistol' : L[g + 1]]}` : ' · FINAL')); }
        else this.set('h-kills', `${me.kills} KILLS` + (W.fragLimit ? ` / ${W.fragLimit}` : ''));
        // scores, while Tab is held or the match is over
        const showScores = (keys.has('scores') || pad.scores) && !panel;
        $('#scores').hidden = !showScores;
        if (showScores) this.scores('sc-body', false);
        if (W.state === 'over' && !this.resultsShown && performance.now() - (this.overAt || 0) > 1800) this.results();
        if (W.state !== 'over' && panel === 'results') closePanels();
    },
    scores(id, final) {
        const W = S.W, me = S.me;
        const rows = W.ranking().map((a, i) => {
            const st = S.medalStats[a.id] || {};
            const best = Object.keys(st).sort((p, q) => MEDALS[q][1] - MEDALS[p][1])[0];
            return `<tr class="${a === me ? 'me' : ''} ${W.rules.teams ? 't' + a.team : ''}"><td>${i + 1}</td><td>${esc(a.name)} <i>${a.bot ? 'BOT · ' : ''}${CHARS[a.char % 8].job.toUpperCase()}</i></td><td>${a.score}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${final ? (best ? MEDALS[best][0] : '–') : a.bot ? 'BOT' : (a.ping || '–')}</td></tr>`;
        });
        $('#' + id).innerHTML = rows.join('');
        if (!final) $('#sc-note').textContent = `${MODES[W.mode].name} · ${MAP.name.toUpperCase()}` + (S.code ? ` · ROOM ${S.code}` : '');
    },
    results() {
        this.resultsShown = true;
        const W = S.W, me = S.me, rk = W.ranking();
        let title;
        if (W.rules.teams) { const [r, b] = W.teamScore; title = r === b ? 'a draw!' : `${TEAMS[r > b ? 0 : 1].name} team wins`; }
        else title = rk[0] === me ? 'you win!' : `${rk[0].name} wins`;
        $('#res-title').textContent = title;
        this.scores('res-body', true);
        $('#res-note').textContent = W.rules.teams ? `RED ${W.teamScore[0]} · BLUE ${W.teamScore[1]}` : `You finished ${ordinal(rk.indexOf(me) + 1).toLowerCase()} with ${me.score} points.`;
        $('#res-menu').innerHTML = S.kind === 'client' ? '<button type="button" data-act="menu">Leave</button>'
            : '<button type="button" data-act="again">Play again</button><button type="button" data-act="menu">Menu</button>';
        if (S.kind === 'client') $('#res-note').textContent += ' The host starts the next match.';
        showPanel('results', false);
    }
};
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); setTimeout(() => { el.hidden = true; }, 3300); }

/* ---------- the camera ---------- */
const vfov = (h) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / (16 / 9)));
let titleT = 0, fovNow = 70, deathT = 0, roll = 0;
function cameraPlay(dt) {
    const W = S.W, me = S.me;
    let fov = vfov(CFG.fov);
    if (me.alive && me.car) {
        const c = W.cars.find((q) => q.id === me.car.id) || me.car;
        const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
        let px = c.x - fx * 2.4, pz = c.z - fz * 2.4, py = c.y + 1.1;
        const h = W.level.ray(c.x, c.y + 0.6, c.z, (px - c.x) / 2.6, (py - c.y - 0.6) / 2.6, (pz - c.z) / 2.6, 2.6);
        if (h) { const k = Math.max(0.2, h.t - 0.2) / 2.6; px = c.x + (px - c.x) * k; py = c.y + 0.6 + (py - c.y - 0.6) * k; pz = c.z + (pz - c.z) * k; }
        cam.position.set(px, py, pz);
        cam.lookAt(c.x + fx * 2, c.y + 0.3, c.z + fz * 2);
        fov += 8;
        deathT = 0;
    } else if (me.alive && me.veh && W.vehicle(me.veh) && !(W.vehicleSeat(me) || {}).gun && !(W.vehicleSeat(me) || {}).turret) {
        // driving: a chase camera you can swing round with the mouse
        const v = W.vehicle(me.veh), VS = VEHICLES[v.type];
        const p = clamp(me.pitch, -0.7, 0.5) - 0.2, cp = Math.cos(p);
        const d = [-Math.sin(me.yaw) * cp, Math.sin(p), -Math.cos(me.yaw) * cp];
        const tx = v.x, ty = v.y + VS.h * 0.9 + 0.4, tz = v.z;
        let dist = VS.l * 0.9 + 3.2;
        const h = W.level.ray(tx, ty, tz, -d[0], -d[1], -d[2], dist);
        if (h) dist = Math.max(0.6, h.t - 0.3);
        cam.position.set(tx - d[0] * dist, ty - d[1] * dist, tz - d[2] * dist);
        cam.lookAt(tx + d[0] * 6, ty + d[1] * 6 + 0.5, tz + d[2] * 6);
        fov += 6;
        deathT = 0;
    } else if (me.alive) {
        const e = W.eye(me);
        cam.position.set(e[0], e[1], e[2]);
        const want = (me.slideT > 0 ? 0.07 : 0) - me.in.mx * 0.012;
        roll += (want - roll) * Math.min(1, dt * 8);
        if (S.kick) { S.kick.p *= Math.max(0, 1 - dt * 9); S.kick.r *= Math.max(0, 1 - dt * 9); }
        const kp = S.kick ? S.kick.p : 0, kr = S.kick ? S.kick.r : 0;
        cam.rotation.set(me.pitch + kp, me.yaw, roll + kr, 'YXZ');
        if (me.slideT > 0) fov += 7;
        if (me.pw.espresso > 0) fov += 5;
        if (me.zoom && me.cur === 'golf') fov = 18;
        deathT = 0;
    } else {
        // the death camera: up and back from where you fell, looking at whoever did it
        deathT += dt;
        const p = S.deadAt || [me.x, me.y, me.z];
        const k = S.killer ? W.byId(S.killer) : null;
        const ang = deathT * 0.35;
        let cx = p[0] + Math.sin(ang) * 3.5, cy = p[1] + 2.2 + Math.min(2, deathT), cz = p[2] + Math.cos(ang) * 3.5;
        const h = W.level.ray(p[0], p[1] + 1, p[2], cx - p[0], cy - p[1] - 1, cz - p[2], 1);
        if (h) { const t = Math.max(0.1, h.t - 0.1); cx = p[0] + (cx - p[0]) * t; cy = p[1] + 1 + (cy - p[1] - 1) * t; cz = p[2] + (cz - p[2]) * t; }
        cam.position.set(cx, cy, cz);
        if (k && k.alive && W.level.clear(cx, cy, cz, k.x, k.y + 1.2, k.z)) cam.lookAt(k.x, k.y + 1.2, k.z); else cam.lookAt(p[0], p[1] + 0.4, p[2]);
    }
    if (shotCam) { cam.position.set(shotCam[0], shotCam[1], shotCam[2]); cam.lookAt(shotCam[3], shotCam[4], shotCam[5]); cam.fov = shotCam[6] || 62; cam.updateProjectionMatrix(); return; }   // debug camera
    // shake
    if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt * 1.6); const s = S.shake * 0.06; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.rotation.z += (Math.random() - 0.5) * s; }
    fovNow += (fov - fovNow) * Math.min(1, dt * (me.zoom ? 18 : 8));
    cam.fov = fovNow; cam.updateProjectionMatrix();
}
// a fixed camera for checking how a map looks: __shot([x, y, z, lookX, lookY, lookZ, fov])
let shotCam = null;
window.__shot = (v) => { shotCam = v; for (const p of PANELS) $('#' + p).hidden = true; };
function cameraTitle(dt) {
    titleT += dt;
    if (shotCam) { cam.position.set(shotCam[0], shotCam[1], shotCam[2]); cam.lookAt(shotCam[3], shotCam[4], shotCam[5]); cam.fov = shotCam[6] || 62; cam.updateProjectionMatrix(); return; }
    const T0 = MAP.titleCam || { c: [0, 6, 2], r: 8.5, h: 2.5, look: [0, 7.5, -3] };
    const t = titleT * (T0.speed || 0.06);
    cam.position.set(T0.c[0] + Math.sin(t) * T0.r, T0.c[1] + Math.sin(t * 1.7) * T0.h, T0.c[2] + Math.cos(t) * T0.r * 0.9);
    cam.lookAt(T0.look[0] + Math.sin(t + 0.8) * 2, T0.look[1], T0.look[2]);
    cam.fov = 62; cam.updateProjectionMatrix();
}

/* ---------- footsteps ---------- */
const stepPhase = new Map();
const METAL = new Set(['grate', 'stair', 'orange', 'steel', 'tramp']);
function footsteps() {
    const W = S.W;
    for (const a of W.actors) {
        if (!a.alive || !a.ground || a.slideT > 0) continue;
        const ph = Math.floor(a.walk * 2.1 / Math.PI);
        const was = stepPhase.get(a.id);
        stepPhase.set(a.id, ph);
        if (was == null || ph === was || Math.hypot(a.vx, a.vz) < 2) continue;
        const me = a === S.me;
        const metal = a.on && METAL.has(a.on.m);
        sfx.play(metal ? 'clang' : 'step', me ? null : [a.x, a.y, a.z], me ? 0.5 : 0.9);
    }
}

/* ---------- networking each frame ---------- */
function netFrame(dt) {
    const W = S.W, me = S.me;
    if (S.kind === 'host') {
        S.snapT += dt; S.pingT += dt;
        if (S.snapT >= 0.05) {
            S.snapT = 0;
            for (const { c, a } of S.peers.values()) S.host.send(c, snapshot(W, S.pending, a));
            S.pending = [];
        }
        if (S.pingT > 2) { S.pingT = 0; for (const { c } of S.peers.values()) S.host.send(c, { t: 'ping', ts: performance.now() }); }
        if (W.state === 'over' && W.stateT <= 0) W.reset();
    } else if (S.kind === 'client') {
        const now = performance.now();
        for (const a of W.actors) if (a !== me) interpolate(a, now);
        S.sendT += dt;
        if (S.sendT >= 1 / 30) {
            S.sendT = 0;
            const I = me.in;
            S.client.send({ t: 'in', seq: me.seq, f1: I.fire1, f2: I.fire2, mx: I.mx, mz: I.mz, ws: I.wsel, wn: I.wnext, wp: I.wpick, use: I.use, sp: I.special, lt: I.lethal, tc: I.tactical, kit: me.kit, cls: me.cls, at: me.spawnAt, j: I.jump, cr: I.crouch,
                s: me.alive ? [me.x, me.y, me.z, me.vx, me.vy, me.vz, me.yaw, me.pitch, me.h, (me.ground ? 1 : 0) | (me.slideT > 0 ? 2 : 0) | (me.crouch ? 4 : 0)].map((v) => Math.round(v * 1000) / 1000) : null });
            I.wsel = null; I.wnext = 0; I.wpick = null; I.use = false; I.special = false; I.lethal = false; I.tactical = false;
        }
    }
}

/* ---------- the loop ---------- */
// run the game for dt seconds, in fixed ticks
function simulate(dt) {
    const W = S.W, me = S.me;
    if (!S.paused) {
        S.acc += dt;
        let n = 0;
        while (S.acc >= TICK && n < 6) {
            if (S.jumpQ) { me.in.jump = true; S.jumpQ = false; }
            W.step(TICK);
            for (const e of W.events) { handleEvent(e); if (S.kind === 'host' && S.peers.size) S.pending.push(e); }
            W.events.length = 0;
            S.acc -= TICK; n++;
            if (!S) return;
        }
        if (n >= 6) S.acc = 0;
    }
    netFrame(dt);
}
// A host whose tab is in the background still has to run the game for everyone else; browsers stop
// animation frames there, so a worker's timer keeps it ticking.
let hiddenAt = 0;
const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 20);'], { type: 'text/javascript' })));
ticker.onmessage = () => {
    if (!document.hidden || !S || S.kind !== 'host' || mode !== 'play') { hiddenAt = 0; return; }
    const now = performance.now(), dt = hiddenAt ? Math.min(0.1, (now - hiddenAt) / 1000) : 0;
    hiddenAt = now;
    gather();
    simulate(dt);
};
let last = performance.now(), renderAcc = 0, T = 0;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (document.hidden || mode === 'loading') return;
    T += dt;
    pollPad(dt);
    if (S && mode === 'play') {
        const W = S.W, me = S.me;
        gather();
        simulate(dt);
        if (!S) return;
        view.update(S.paused ? 0 : dt, me.id, cam.position);
        hud.update(dt);
        cameraPlay(dt);
        view.updateVM(dt, me, cam, { show: true });
        footsteps();
        // the car's motor
        for (const v of W.vehicles) {
            const on = !v.dead && v.seats.some((id) => id);
            const sp = Math.hypot(v.vx || 0, v.vz || 0);
            sfx.loop('v' + v.id, [v.x, v.y + 1, v.z], on, { cart: 2.2, mower: 0.9, buggy: 3.2, van: 0.55 }[v.type] * (1 + sp / 20));
            if (on && v.type === 'van' && sp > 2) { v.jT = (v.jT || 0) - dt; if (v.jT <= 0) { v.jT = 2.6; sfx.play('jingle', [v.x, v.y + 2, v.z]); } }
        }
        const car = W.cars[0] ? W.cars : null;
        if (car) for (const c of W.cars) sfx.loop('car', [c.x, c.y, c.z], true, 1 + Math.hypot(c.vx || 0, c.vz || 0) / 17); else sfx.loop('car', [0, 0, 0], false);
        sfx.listener(cam.position.x, cam.position.y, cam.position.z, me.alive && !me.car ? me.yaw : Math.atan2(-cam.getWorldDirection(new THREE.Vector3()).x, -cam.getWorldDirection(new THREE.Vector3()).z));
        // screen effects: speed lines when sliding or flying, colour washes for damage and power-ups
        S.hurt = Math.max(0, (S.hurt || 0) - dt * 1.3);
        $('#hurtfx').style.opacity = Math.min(1, S.hurt * 1.2 + (me.alive && me.hp <= 30 ? 0.25 + Math.sin(T * 7) * 0.12 : 0)).toFixed(2);
        if (me.alive && me.hp <= 30) { S.beat = (S.beat || 0) - dt; if (S.beat <= 0) { S.beat = 0.85; sfx.play('heart', null, 0.8); } }
        S.burst = Math.max(0, (S.burst || 0) - dt * 2);
        const sp = Math.hypot(me.vx, me.vz);
        const lines = me.alive ? Math.max(me.slideT > 0 ? clamp((sp - 8) / 8, 0, 0.6) : 0, me.launchT > 0 ? 0.6 : 0, me.pw.espresso > 0 && sp > 8 ? 0.25 : 0) : 0;
        let tint = null, tk = 0;
        const lowHp = me.alive && me.hp <= 25 ? 0.25 + Math.sin(T * 6) * 0.1 : 0;
        if (S.hurt > 0 || lowHp) { tint = [1, 0.1, 0.1]; tk = Math.max(S.hurt * 0.8, lowHp); }
        else if (me.pw.sauce > 0) { tint = [1, 0.3, 0.1]; tk = 0.22; }
        else if (me.pw.sneakers > 0) { tint = [1, 0.4, 0.8]; tk = 0.15; }
        else if (me.pw.espresso > 0) { tint = [0.8, 0.55, 0.3]; tk = 0.15; }
        post.set({ time: T, speed: lines, burst: S.burst, tint: tint || [1, 1, 1], tintK: tk });
    } else {
        cameraTitle(dt);
        post.set({ time: T, speed: 0, burst: 0, tintK: 0 });
    }
    const minDt = 1 / CFG.fps - 0.002;
    renderAcc += dt;
    if (renderAcc < minDt) return;
    renderAcc = 0;
    if (panel === 'loadout' && stage) {
        stage.update(dt);
        post.mat.uniforms.uSunOn.value = 0;
        post.render(stage.scene, stage.cam, null, null);
        return;
    }
    const vm = view && S && mode === 'play' ? view : null;
    if (skyRoot) skyRoot.position.copy(cam.position);
    placeFlare();
    renderer.shadowMap.needsUpdate = true;
    post.render(scene, cam, vm ? vm.vmScene : null, vm ? vm.vmCam : null);
}

/* ---------- window, menu bar, full screen ---------- */
const BASE = { w: 320, h: 180 };
const isFull = () => document.body.classList.contains('fakefs');
function toggleFull(force) {
    const want = force == null ? !isFull() : force;
    document.body.classList.toggle('fakefs', want);
    try {
        if (want && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        if (!want && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) { /* not allowed */ }
    fit();
    $$('[data-act="full"]').forEach((b) => { const li = b.closest('li'); if (li) li.classList.toggle('on', want); });
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && isFull()) { document.body.classList.remove('fakefs'); fit(); } });
function fit() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const full = isFull();
    const chromeH = full ? 0 : 22 + 24 + 22 + 48;
    const aw = full ? innerWidth : vw - (vw < 600 ? 22 : 60), ah = vh - chromeH - (coarse ? 20 : 0);
    const s = Math.max(1, Math.min(aw / BASE.w, ah / BASE.h));
    const sc = $('#screen');
    sc.style.width = Math.round(BASE.w * s) + 'px';
    sc.style.height = Math.round(BASE.h * s) + 'px';
    sc.style.setProperty('--px', (s * 0.75) + 'px');
    sc.style.setProperty('--gp', s + 'px');
    const blk = Math.max(2, Math.round(s * 0.6));
    const pc = document.getElementById('pix-c'), pm = document.getElementById('pix-m');
    if (pc) { pc.setAttribute('width', blk); pc.setAttribute('height', blk); pm.setAttribute('radius', Math.max(1, Math.floor(blk / 2))); }
}
addEventListener('resize', fit);
let openBtn = null;
const closeMenus = () => { $$('.mb-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false')); openBtn = null; };
$$('.mb-btn').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); const was = b.getAttribute('aria-expanded') === 'true'; closeMenus(); if (!was) { b.setAttribute('aria-expanded', 'true'); openBtn = b; if (locked) document.exitPointerLock(); } });
    b.addEventListener('pointerenter', () => { if (openBtn && openBtn !== b) { closeMenus(); b.setAttribute('aria-expanded', 'true'); openBtn = b; } });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.mb-item')) closeMenus(); });
const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
tickClock(); setInterval(tickClock, 15000);
function about() {
    const back = document.createElement('div');
    back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg" role="dialog" aria-label="About"><div class="mac-title"><span class="mt-name"><span>About</span></span></div>
        <div class="dlg-body"><i class="dlg-ico"></i><div><p><b>Yard Sale Showdown</b></p><p>A fast arena shooter in the style of Gravel Riot: everyday people fighting with whatever was for sale. Slide, dodge, bounce on trampolines, and splat each other with pool noodles, water balloons and bottle rockets.</p><p>Play against bots, or host a room and send the code to friends. Online games go straight from browser to browser.</p></div></div>
        <div class="dlg-btns"><button type="button" class="btn default">OK</button></div></div>`;
    $('#dialogs').append(back);
    $('.btn', back).addEventListener('click', () => back.remove());
}
const pix = (rows, map, sc = 1) => {
    const w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas'); c.width = w * sc; c.height = rows.length * sc;
    const x = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, i) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(i * sc, y * sc, sc, sc); } }));
    return `url(${c.toDataURL()})`;
};
{
    const ARROW = ['B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB', 'BWWWWWWWWB', 'BWWWWWBBBBB', 'BWWBWWB', 'BWB BWWB', 'BB  BWWB', 'B    BWWB', '     BWWB', '      BB'];
    const ANCHOR = ['.....KK.....', '....K..K....', '.....KK.....', '..KKKKKKKK..', '.....KK.....', '.....KK.....', 'K....KK....K', 'KK...KK...KK', '.KKK.KK.KKK.', '...KKKKKK...', '.....KK.....'];
    const NOODLE = ['........KKK.', '.......KGGGK', '......KGGGK.', '.....KGGGK..', '....KGGGK...', '...KGGGK....', '..KGGGK.....', '.KGGGK......', 'KGGGK.......', '.KKK........'];
    const rs = document.documentElement.style;
    rs.setProperty('--cur-arrow', `${pix(ARROW, { B: '#000000', W: '#ffffff' }, 2)} 0 0, auto`);
    rs.setProperty('--i-anchor', pix(ANCHOR, { K: '#1f4a8f' }));
    rs.setProperty('--i-subbig', pix(NOODLE, { K: '#000000', G: '#3ee06a' }, 2));
}

/* ---------- boot ---------- */
async function boot() {
    setRes();
    fit();
    refreshCycles();
    await loadMap(CFG.map);
    window.YSS = { post, cam, level, nav, scene, MAP, get S() { return S; }, startSolo, startHost, startJoin, loadMap, CFG, mouse };
    $('#loading').hidden = true;
    setMode('title');
    showPanel('title');
    music.want('showdown');
    requestAnimationFrame(frame);
}
boot();

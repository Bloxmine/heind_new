/* Low-poly models built from boxes and cylinders: the characters, their weapons, pickups and projectiles.
   They use cel-shaded materials lit by the sun plus a per-object "probe" colour that stands in for the baked light. */
import * as THREE from 'three';
import { cel, glows } from '../rally/retro.js';
import { CHARS, TEAMS } from './defs.js';

export const GLOBAL_PROBE = { value: new THREE.Color(0.32, 0.32, 0.36) };
const matCache = new Map();
// a cel material that also takes the baked light around it (the probe)
const NO_RIM = { value: new THREE.Color(0, 0, 0) };
// rim: an optional colour that lights the silhouette's edges, so players stand out from the map
export function dyn(color, probe = GLOBAL_PROBE, opts = {}, rim = null) {
    const key = probe === GLOBAL_PROBE && !opts.emissive && !opts.transparent && !rim ? color : null;
    if (key && matCache.has(key)) return matCache.get(key);
    const m = cel(Object.assign({ color }, opts), true);
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
        prev.call(m, sh, r);
        sh.uniforms.uProbe = probe;
        sh.uniforms.uRim = rim || NO_RIM;
        sh.fragmentShader = 'uniform vec3 uProbe;\nuniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * uProbe * 1.6;
            float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            outgoingLight += uRim * step(0.55, rimF) * (0.6 + rimF);
            #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'dyn-probe-rim';
    if (key) matCache.set(key, m);
    return m;
}
const B = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
const C = (r0, r1, h, m, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.castShadow = true; return o; };
const S = (r, m, seg = 8) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), m); o.castShadow = true; return o; };
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });

/* ---------- characters ---------- */
// Feet at y = 0, facing -z. Returns the group plus its joints for animation.
export function makeCharacter(ci, probe, team = -1, rim = null) {
    const ch = CHARS[ci % CHARS.length];
    const M = (c) => dyn(c, probe, {}, rim);
    const skin = M(ch.skin), top = M(ch.top), bot = M(ch.bottom), shoe = M(ch.shoes), hatM = M(ch.hatC), dark = M('#17171c');
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.9; body.add(hips);
    const leg = (sx) => {
        const g = new THREE.Group(); g.position.set(sx * 0.12, 0, 0);
        const upper = B(0.2, 0.48, 0.24, bot, 0, -0.24, 0);
        const knee = new THREE.Group(); knee.position.y = -0.46;
        const lower = B(0.19, 0.42, 0.22, ch.bottom === ch.top && ch.id !== 'janitor' && ch.id !== 'gardener' ? skin : bot, 0, -0.2, 0);
        const sh = B(0.22, 0.1, 0.32, shoe, 0, -0.42, -0.04);
        knee.add(lower, sh);
        if (ch.extra === 'socks') knee.add(B(0.2, 0.12, 0.23, M('#ffffff'), 0, -0.31, 0));
        g.add(upper, knee); g.knee = knee;
        hips.add(g);
        return g;
    };
    const legL = leg(-1), legR = leg(1);
    const torso = new THREE.Group(); hips.add(torso);
    const chest = B(0.52, 0.6, 0.3, top, 0, 0.3, 0); torso.add(chest);
    if (ch.id === 'lifeguard') { torso.add(B(0.4, 0.2, 0.31, skin, 0, 0.5, 0)); }
    if (ch.extra === 'apron') torso.add(B(0.44, 0.62, 0.04, M('#7a4a2a'), 0, 0.2, -0.17));
    if (ch.extra === 'scarf') torso.add(B(0.3, 0.1, 0.33, M('#d8342c'), 0, 0.58, -0.01));
    if (ch.extra === 'badge') torso.add(B(0.08, 0.08, 0.02, M('#e8c040'), -0.13, 0.44, -0.16));
    if (ch.extra === 'whistle') torso.add(B(0.06, 0.08, 0.04, M('#ffd23f'), 0.05, 0.38, -0.17));
    if (ch.id === 'crossing') { const st = M('#d8dde4'); torso.add(B(0.53, 0.05, 0.31, st, 0, 0.12, 0), B(0.53, 0.05, 0.31, st, 0, 0.32, 0)); }
    if (ch.id === 'gardener' || ch.id === 'janitor') { torso.add(B(0.1, 0.36, 0.31, M(ch.id === 'janitor' ? '#d8d0c0' : '#e8e0c8'), 0, 0.42, 0)); }
    if (ch.id === 'chef') for (const y of [0.2, 0.34, 0.48]) torso.add(B(0.04, 0.04, 0.02, dark, -0.08, y, -0.16), B(0.04, 0.04, 0.02, dark, 0.08, y, -0.16));
    // the team band
    const band = B(0.55, 0.12, 0.33, M('#ffffff'), 0, 0.03, 0); band.visible = false; torso.add(band);
    const arm = (sx) => {
        const g = new THREE.Group(); g.position.set(sx * 0.34, 0.54, 0);
        g.add(B(0.15, 0.36, 0.17, ch.id === 'lifeguard' ? skin : top, 0, -0.16, 0));
        const el = new THREE.Group(); el.position.y = -0.32;
        el.add(B(0.14, 0.3, 0.16, ch.id === 'lifeguard' || ch.id === 'coach' ? skin : top, 0, -0.14, 0));
        el.add(B(0.13, 0.12, 0.14, ch.extra === 'gloves' ? M('#4a7a3a') : skin, 0, -0.33, 0));
        g.add(el); g.el = el;
        torso.add(g);
        return g;
    };
    const armL = arm(-1), armR = arm(1);
    const hand = new THREE.Group(); hand.position.set(0, -0.36, 0); armR.el.add(hand);
    const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
    const head = B(0.3, 0.32, 0.3, skin, 0, 0.17, 0); neck.add(head);
    neck.add(B(0.05, 0.05, 0.02, dark, -0.07, 0.2, -0.155), B(0.05, 0.05, 0.02, dark, 0.07, 0.2, -0.155));
    neck.add(B(0.06, 0.07, 0.05, skin, 0, 0.13, -0.17));
    neck.add(B(0.31, 0.08, 0.31, M(ch.id === 'coach' || ch.id === 'lifeguard' ? '#2a1a12' : ch.id === 'crossing' ? '#c8c0b8' : '#3a2a1e'), 0, 0.31, 0.01));
    const hat = new THREE.Group(); hat.position.y = 0.33; neck.add(hat);
    switch (ch.hat) {
        case 'cap': hat.add(B(0.33, 0.1, 0.33, hatM, 0, 0.03, 0), B(0.3, 0.03, 0.16, hatM, 0, -0.01, -0.2)); break;
        case 'toque': hat.add(C(0.15, 0.13, 0.08, hatM, 8), C(0.2, 0.15, 0.22, hatM, 8)); hat.children[0].position.y = 0.02; hat.children[1].position.y = 0.17; break;
        case 'visor': hat.add(B(0.33, 0.06, 0.33, hatM, 0, -0.03, 0), B(0.32, 0.03, 0.18, hatM, 0, -0.05, -0.22)); hat.children[0].scale.set(1, 1, 1); break;
        case 'peaked': hat.add(C(0.2, 0.18, 0.1, hatM, 8), B(0.3, 0.03, 0.14, dark, 0, -0.02, -0.19), B(0.32, 0.03, 0.02, M('#e8c040'), 0, 0.02, -0.16)); hat.children[0].position.y = 0.05; break;
        case 'straw': { const brim = C(0.34, 0.34, 0.03, hatM, 10); const crown = C(0.15, 0.17, 0.13, hatM, 8); crown.position.y = 0.07; hat.add(brim, crown, B(0.35, 0.03, 0.35, M('#8a3a2a'), 0, 0.02, 0)); hat.children[2].scale.set(0.95, 1, 0.95); break; }
        case 'band': hat.add(B(0.32, 0.06, 0.32, hatM, 0, -0.07, 0)); break;
        case 'beanie': hat.add(B(0.33, 0.14, 0.33, hatM, 0, 0.0, 0), S(0.06, hatM, 6)); hat.children[1].position.y = 0.1; break;
    }
    if (ch.extra === 'keys') hips.add(B(0.06, 0.1, 0.04, M('#c0c4c8'), 0.27, -0.06, 0));
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const J = { root, body, hips, torso, legL, legR, armL, armR, neck, hand, band, probe: probe || GLOBAL_PROBE, char: ch, rim };
    root.userData.J = J;
    if (team >= 0) setTeam(J, team);
    return J;
}
export function setTeam(J, team) {
    J.band.visible = team >= 0;
    if (team >= 0) J.band.material = dyn(TEAMS[team].col, J.probe, {}, J.rim);
}

/* ---------- weapons ---------- */
// held at the grip, pointing along -z
export function weaponModel(w, opts = {}) {
    const g = new THREE.Group(), M = (c) => dyn(c, opts.probe || GLOBAL_PROBE);
    const add = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
    const wood = M('#a87a48'), steel = M('#c0c8d0'), dark = M('#26282e');
    switch (w) {
        case 'noodle': {
            // one floppy foam tube, curving up a little towards the end
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.08), new THREE.Vector3(0, 0.02, -0.4), new THREE.Vector3(0, 0.1, -0.8), new THREE.Vector3(0, 0.24, -1.15)]);
            add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.055, 7), M(opts.alt ? '#ff5ab4' : '#3ee06a')));
            break;
        }
        case 'slicer':
            add(C(0.028, 0.028, 0.16, wood), 0, 0, 0, Math.PI / 2);
            add(B(0.13, 0.012, 0.16, steel), 0, 0.01, -0.17);
            add(B(0.11, 0.012, 0.012, M('#ffd040')), 0, 0.02, -0.13);
            break;
        case 'rake': {
            add(C(0.024, 0.024, 1.5, wood), 0, 0, -0.55, Math.PI / 2);
            const hm = M('#3ec05a');
            add(B(0.5, 0.05, 0.06, hm), 0, 0, -1.3);
            for (let i = 0; i < 7; i++) add(B(0.025, 0.16, 0.025, hm), -0.22 + i * 0.073, -0.09, -1.31);
            break;
        }
        case 'whip': {
            // a braided handle, and the lash hanging down from it in one curve
            add(C(0.03, 0.026, 0.26, M('#5a3420'), 8), 0, 0, 0, Math.PI / 2);
            add(S(0.036, M('#2a1a10'), 6), 0, 0, 0.13);
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.13), new THREE.Vector3(0, -0.04, -0.32), new THREE.Vector3(0.03, -0.18, -0.5), new THREE.Vector3(0.02, -0.4, -0.58), new THREE.Vector3(-0.04, -0.6, -0.5)]);
            add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.014, 5), M('#7a4a28')));
            break;
        }
        case 'pistol': {
            if (opts.dual) {
                add(B(0.08, 0.12, 0.44, M('#3ad060')), 0, 0.05, -0.12);
                add(C(0.07, 0.07, 0.24, M('#ff8a1a'), 8), 0, 0.16, -0.02, Math.PI / 2);
                add(C(0.02, 0.02, 0.16, M('#ffd040')), 0, 0.05, -0.4, Math.PI / 2);
                add(B(0.05, 0.14, 0.06, M('#2a7aff')), 0, -0.06, 0.02, 0.3);
                add(B(0.05, 0.1, 0.05, M('#2a7aff')), 0, -0.02, -0.24, 0.0);
            } else {
                add(B(0.06, 0.09, 0.24, M('#ff8a1a')), 0, 0.04, -0.08);
                add(C(0.045, 0.045, 0.12, M('#3ad0ff'), 8), 0, 0.11, -0.04, Math.PI / 2);
                add(C(0.014, 0.014, 0.1, M('#ffd040')), 0, 0.05, -0.24, Math.PI / 2);
                add(B(0.05, 0.13, 0.06, M('#ff8a1a')), 0, -0.05, 0.02, 0.3);
            }
            break;
        }
        case 'balloon': {
            add(S(0.1, M(opts.col || '#ff4a6a'), 8), 0, 0.06, -0.06);
            add(B(0.03, 0.04, 0.03, M(opts.col || '#ff4a6a')), 0, -0.04, -0.02);
            break;
        }
        case 'blower':
            add(B(0.2, 0.22, 0.3, M('#ff8a1a')), 0, 0.02, 0.06);
            add(B(0.16, 0.14, 0.08, dark), 0, 0.02, 0.24);
            add(C(0.055, 0.05, 0.7, M('#d8d8d0'), 8), 0.0, -0.04, -0.42, Math.PI / 2 + 0.08);
            add(B(0.04, 0.12, 0.2, dark), 0, 0.16, 0.04);
            break;
        case 'bat':
            add(C(0.045, 0.022, 0.85, wood, 8), 0, 0.3, -0.25, -0.6);
            if (opts.ball !== false) add(S(0.05, M('#f4f0e4'), 6), -0.22, -0.02, -0.12);
            break;
        case 'tennis': {
            add(B(0.3, 0.26, 0.38, M('#3a6a3a')), 0, 0.02, 0.02);
            add(C(0.06, 0.06, 0.34, M('#c8d040'), 8), 0, 0.02, -0.33, Math.PI / 2);
            const bm = M('#d8f040');
            for (let i = 0; i < 4; i++) add(S(0.05, bm, 6), -0.08 + (i % 2) * 0.13, 0.2, -0.05 + (i >> 1) * 0.12);
            add(B(0.32, 0.04, 0.04, dark), 0, -0.09, 0.22);
            break;
        }
        case 'rocket':
            add(C(0.075, 0.075, 0.8, M('#8c949c'), 8), 0, 0.04, -0.15, Math.PI / 2);
            add(C(0.06, 0.06, 0.22, M('#5a2a14'), 8), 0, 0.04, 0.32, Math.PI / 2);
            add(C(0.062, 0.062, 0.08, M('#d82a2a'), 8), 0, 0.04, 0.3, Math.PI / 2);
            add(B(0.04, 0.12, 0.06, dark), 0, -0.08, 0.06);
            add(B(0.03, 0.06, 0.03, M('#ffd23f')), 0, 0.14, -0.3);
            break;
        case 'golf':
            add(C(0.012, 0.014, 0.95, steel, 6), 0, 0.12, -0.42, -1.3);
            add(B(0.1, 0.05, 0.05, M('#30343a')), 0.02, 0.24, -0.88);
            add(C(0.02, 0.02, 0.18, M('#18181c'), 6), 0, 0.01, -0.02, -1.3);
            break;
        case 'popper':
            add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), M('#ff3a8a')), 0, 0.02, -0.05, -Math.PI / 2);
            add(B(0.02, 0.02, 0.08, M('#ffe23a')), 0.02, 0.02, -0.18); add(B(0.02, 0.02, 0.06, M('#3ad0ff')), -0.02, 0.03, -0.17);
            break;
        case 'powder':
            add(C(0.06, 0.06, 0.2, M('#f4f2fa'), 10), 0, 0.06, -0.02); add(C(0.03, 0.06, 0.05, M('#8ab8ff'), 10), 0, 0.18, -0.02);
            break;
        case 'rc':
            // the remote: a box with two sticks and a short aerial
            add(B(0.2, 0.05, 0.13, dark), 0, 0.02, -0.02);
            add(B(0.21, 0.02, 0.135, M('#d8262a')), 0, 0.045, -0.02);
            for (const sx of [-0.05, 0.05]) add(C(0.008, 0.008, 0.05, steel, 4), sx, 0.08, -0.02);
            add(C(0.005, 0.005, 0.16, steel, 4), 0.08, 0.11, -0.06, -0.3);
            break;
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
}

/* ---------- pickups ---------- */
export function itemModel(type) {
    const [k, v] = type.split(':');
    const g = new THREE.Group(), M = (c) => dyn(c);
    const add = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
    if (k === 'w') { const w = weaponModel(v); w.scale.setScalar(v === 'rake' || v === 'noodle' ? 0.8 : 1.5); w.rotation.y = Math.PI / 2; const b = new THREE.Box3().setFromObject(w); w.position.y -= (b.min.y + b.max.y) / 2; g.add(w); }
    else if (k === 'a') {
        add(B(0.4, 0.26, 0.3, M('#7a5a3a')));
        add(B(0.41, 0.08, 0.31, M({ pistol: '#ff8a1a', balloon: '#ff4a6a', blower: '#ff8a1a', bat: '#f4f0e4', tennis: '#d8f040', rocket: '#d82a2a', golf: '#c0c8d0' }[v] || '#fff')));
    } else if (type === 'h:soda') {
        add(C(0.07, 0.07, 0.24, M('#e02a2a'), 10)); add(C(0.06, 0.07, 0.03, M('#d0d4d8'), 10), 0, 0.13, 0);
        add(B(0.142, 0.06, 0.142, M('#ffffff')), 0, 0.01, 0, 0, 0.4).scale.set(1, 1, 1);
    } else if (type === 'h:kit') {
        add(B(0.4, 0.28, 0.16, M('#f4f4f0'))); const r = M('#e02a2a');
        add(B(0.06, 0.18, 0.17, r)); add(B(0.18, 0.06, 0.17, r)); add(B(0.16, 0.04, 0.04, M('#808890')), 0, 0.16, 0);
    } else if (type === 'h:cake') {
        add(C(0.32, 0.32, 0.18, M('#f2d0a8'), 12), 0, -0.1, 0); add(C(0.33, 0.33, 0.04, M('#ff6aa8'), 12), 0, -0.0, 0);
        add(C(0.22, 0.22, 0.14, M('#f2d0a8'), 12), 0, 0.09, 0); add(C(0.23, 0.23, 0.03, M('#ff6aa8'), 12), 0, 0.17, 0);
        add(C(0.015, 0.015, 0.12, M('#3ad0ff'), 4), 0, 0.24, 0); add(glows(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), glowMat('#ffd27a'))), 0, 0.33, 0);
    } else if (type === 'r:pads') {
        const m = M('#26282e'), b = M('#2a7aff');
        add(B(0.16, 0.22, 0.1, m), -0.12, 0, 0); add(B(0.16, 0.22, 0.1, m), 0.12, 0, 0); add(B(0.17, 0.06, 0.11, b), -0.12, 0.02, 0); add(B(0.17, 0.06, 0.11, b), 0.12, 0.02, 0);
    } else if (type === 'r:helmet') {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#2ad0c0')); h.castShadow = true; add(h, 0, -0.08, 0);
        add(B(0.05, 0.05, 0.44, M('#1a1a20')), 0, 0.12, 0); add(B(0.3, 0.02, 0.1, M('#1a1a20')), 0, -0.07, -0.2);
    } else if (type === 'r:ring') {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 6, 12), M('#ff7a1a')); t.castShadow = true; add(t, 0, 0, 0);
        for (let i = 0; i < 4; i++) add(B(0.12, 0.21, 0.08, M('#f4f4f0')), Math.cos(i * Math.PI / 2) * 0.28, Math.sin(i * Math.PI / 2) * 0.28, 0, 0, 0, i * Math.PI / 2);
    } else if (type === 'p:sauce') {
        add(C(0.08, 0.09, 0.3, M('#e02a1a'), 8)); add(C(0.03, 0.06, 0.1, M('#e02a1a'), 8), 0, 0.2, 0); add(C(0.035, 0.035, 0.06, M('#3ac040'), 8), 0, 0.27, 0);
        add(B(0.17, 0.12, 0.17, M('#fff4c0')), 0, 0, 0);
    } else if (type === 'p:espresso') {
        add(C(0.1, 0.08, 0.14, M('#f8f6f0'), 10), 0, 0.02, 0); add(C(0.08, 0.08, 0.01, M('#3a2014'), 10), 0, 0.09, 0);
        add(C(0.17, 0.15, 0.03, M('#f8f6f0'), 10), 0, -0.07, 0); add(B(0.04, 0.08, 0.03, M('#f8f6f0')), 0.12, 0.03, 0);
    } else if (type === 'p:sneakers') {
        add(B(0.16, 0.12, 0.34, M('#ff3a6e')), 0, 0.12, 0); add(B(0.17, 0.04, 0.35, M('#ffffff')), 0, 0.05, 0);
        for (let i = 0; i < 4; i++) add(C(0.06, 0.06, 0.03, M('#c0c8d0'), 8), 0, -0.02 - i * 0.05, 0);
    } else if (type === 'p:box') {
        add(B(0.44, 0.34, 0.36, M('#b88a52'))); add(B(0.45, 0.05, 0.37, M('#d8b878')), 0, 0.12, 0); add(B(0.08, 0.35, 0.37, M('#d8b878')));
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
}
export const ITEM_COL = { w: '#ff9a3a', a: '#9ca5ad', h: '#4aff7a', r: '#3ad0ff', p: '#c44aff' };

/* ---------- projectiles, the car, traps, puddles ---------- */
const BALLOON_COLS = ['#ff4a6a', '#3ad0ff', '#ffd23f', '#4aff7a', '#c44aff'];
export function projModel(type, id = 0) {
    const g = new THREE.Group(), M = (c) => dyn(c);
    switch (type) {
        case 'blob': { const m = S(0.16, dyn('#3ab0ff', GLOBAL_PROBE, { transparent: true, opacity: 0.85 }), 8); g.add(m); break; }
        case 'balloon': g.add(S(0.17, M(BALLOON_COLS[id % 5]), 8)); break;
        case 'bigballoon': g.add(S(0.28, M(BALLOON_COLS[(id + 2) % 5]), 10)); break;
        case 'acorn': { const a = B(0.07, 0.08, 0.07, M(id % 2 ? '#7a5030' : '#8a8a84')); a.rotation.set(id, id * 2, 0); g.add(a); break; }
        case 'baseball': g.add(S(0.08, M('#f4f0e4'), 8)); break;
        case 'popper': { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), M('#ff3a8a')); c.rotation.x = Math.PI / 2; g.add(c); break; }
        case 'powder': g.add(C(0.07, 0.07, 0.2, M('#f4f2fa'), 10)); break;
        case 'tennis': case 'lob': g.add(S(type === 'lob' ? 0.1 : 0.075, M('#d8f040'), 6)); break;
        case 'rocket': {
            const b = C(0.07, 0.07, 0.34, M('#5a2a14'), 8); b.rotation.x = Math.PI / 2; g.add(b);
            const l = C(0.073, 0.073, 0.12, M('#d82a2a'), 8); l.rotation.x = Math.PI / 2; g.add(l);
            const n = C(0.03, 0.07, 0.1, M('#5a2a14'), 8); n.rotation.x = -Math.PI / 2; n.position.z = -0.21; g.add(n);
            const f = glows(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), glowMat('#fff6d0'))); f.position.z = 0.22; g.add(f);
            break;
        }
    }
    return g;
}
export function carModel(probe) {
    const g = new THREE.Group(), M = (c) => dyn(c, probe);
    const body = M('#2a6aff'), white = M('#f4f4f0'), red = M('#ff3a3a'), tyre = M('#16161a'), glass = M('#0e1a2a');
    g.add(B(0.34, 0.12, 0.6, body, 0, 0.13, 0), B(0.35, 0.03, 0.61, white, 0, 0.16, 0), B(0.26, 0.1, 0.28, glass, 0, 0.24, 0.02), B(0.27, 0.02, 0.3, body, 0, 0.3, 0.02));
    g.add(B(0.36, 0.03, 0.1, red, 0, 0.27, 0.3), B(0.04, 0.08, 0.04, red, -0.12, 0.22, 0.3), B(0.04, 0.08, 0.04, red, 0.12, 0.22, 0.3));
    for (const [x, z] of [[-0.18, -0.2], [0.18, -0.2], [-0.18, 0.2], [0.18, 0.2]]) { const w = C(0.07, 0.07, 0.06, tyre, 8); w.rotation.z = Math.PI / 2; w.position.set(x, 0.07, z); g.add(w); }
    const lt = glows(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), glowMat('#fff8d0')));
    lt.position.set(-0.1, 0.14, -0.31); g.add(lt); const lt2 = lt.clone(); lt2.position.x = 0.1; g.add(lt2);
    return g;
}
export function trapModel() {
    const g = new THREE.Group();
    const handle = new THREE.Group(); g.add(handle);
    const h = C(0.024, 0.024, 1.4, dyn('#a87a48'), 6); h.rotation.x = Math.PI / 2; h.position.set(0, 0.03, 0.7); handle.add(h);
    const hm = dyn('#3ec05a');
    g.add(B(0.5, 0.04, 0.06, hm, 0, 0.06, 0));
    for (let i = 0; i < 7; i++) g.add(B(0.025, 0.12, 0.025, hm, -0.22 + i * 0.073, 0.02, -0.02).rotateX(-1.2));
    g.userData.handle = handle;
    return g;
}
export function puddleModel(r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: '#3a9adf', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    return m;
}

/* ---------- vehicles: origin on the ground at the centre, facing -z ---------- */
export function vehicleModel(type, probe = GLOBAL_PROBE, rim = null) {
    const g = new THREE.Group(), M = (c, o = {}) => dyn(c, probe, o, rim);
    const add = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
    const wheels = [];
    const wheel = (x, y, z, r, w = 0.12, c = '#17171b') => { const m = new THREE.Group(); const t = C(r, r, w, M(c), 10); t.rotation.z = Math.PI / 2; m.add(t); m.position.set(x, y, z); g.add(m); wheels.push([m, r]); return m; };
    switch (type) {
        case 'cart': {
            const chrome = M('#c8ced6'), red = M('#d8262a');
            add(B(0.62, 0.04, 0.95, chrome), 0, 0.42, 0);
            for (const x of [-0.31, 0.31]) add(B(0.03, 0.55, 0.95, chrome), x, 0.7, 0);
            add(B(0.62, 0.55, 0.03, chrome), 0, 0.7, -0.47); add(B(0.62, 0.45, 0.03, chrome), 0, 0.72, 0.47);
            for (const y of [0.56, 0.7, 0.84]) { add(B(0.64, 0.02, 0.02, chrome), 0, y, -0.48); for (const x of [-0.32, 0.32]) add(B(0.02, 0.02, 0.96, chrome), x, y, 0); }
            add(B(0.03, 0.42, 0.03, chrome), -0.28, 0.21, 0.42); add(B(0.03, 0.42, 0.03, chrome), 0.28, 0.21, 0.42); add(B(0.03, 0.42, 0.03, chrome), -0.28, 0.21, -0.42); add(B(0.03, 0.42, 0.03, chrome), 0.28, 0.21, -0.42);
            add(B(0.66, 0.06, 0.06, red), 0, 1.02, 0.55); add(B(0.04, 0.12, 0.12, chrome), -0.3, 0.98, 0.5); add(B(0.04, 0.12, 0.12, chrome), 0.3, 0.98, 0.5);
            add(B(0.5, 0.18, 0.02, red), 0, 0.88, 0.35, -0.3);
            for (const [x, z] of [[-0.28, -0.42], [0.28, -0.42], [-0.28, 0.42], [0.28, 0.42]]) wheel(x, 0.07, z, 0.07, 0.05);
            break;
        }
        case 'mower': {
            const red = M('#c8302a'), green = M('#2e7a3a'), dark = M('#1e1f22');
            add(B(0.9, 0.42, 1.0, red), 0, 0.58, -0.25);
            add(B(0.86, 0.3, 0.6, red), 0, 0.55, -0.85, -0.25);
            add(B(1.24, 0.12, 0.9, green), 0, 0.22, -0.2);
            add(B(0.5, 0.12, 0.45, dark), 0, 0.88, 0.32); add(B(0.5, 0.45, 0.1, dark), 0, 1.1, 0.55, 0.2);
            add(C(0.03, 0.03, 0.45, dark, 6), 0, 1.0, -0.25, -0.6);
            const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 10), dark); add(sw, 0, 1.2, -0.12, -0.9);
            add(B(0.3, 0.04, 0.3, M('#f4d040')), 0.35, 0.8, -0.3);
            wheel(-0.5, 0.33, 0.45, 0.33, 0.2); wheel(0.5, 0.33, 0.45, 0.33, 0.2); wheel(-0.42, 0.2, -0.75, 0.2, 0.14); wheel(0.42, 0.2, -0.75, 0.2, 0.14);
            break;
        }
        case 'buggy': {
            const white = M('#f2f0e8'), seat = M('#c8a878'), dark = M('#26282c');
            add(B(1.24, 0.42, 2.3, white), 0, 0.5, 0);
            add(B(1.2, 0.3, 0.5, white), 0, 0.75, -1.0);
            add(B(1.1, 0.14, 0.6, seat), 0, 0.78, -0.1); add(B(1.1, 0.5, 0.12, seat), 0, 1.05, 0.2);
            add(B(1.1, 0.14, 0.5, seat), 0, 0.82, 0.85); add(B(1.1, 0.4, 0.1, seat), 0, 1.05, 0.62);
            for (const [x, z] of [[-0.58, -0.75], [0.58, -0.75], [-0.58, 1.05], [0.58, 1.05]]) add(B(0.05, 1.2, 0.05, white), x, 1.35, z);
            add(B(1.34, 0.07, 2.2, white), 0, 1.96, 0.15);
            add(C(0.02, 0.02, 0.3, dark, 6), -0.32, 1.0, -0.62, -0.7);
            add(C(0.12, 0.12, 0.8, M('#2a5a9a'), 8), 0.3, 1.05, 1.2, 0.2);
            for (const [x, z] of [[-0.55, -0.8], [0.55, -0.8], [-0.55, 0.8], [0.55, 0.8]]) wheel(x, 0.25, z, 0.25, 0.16);
            break;
        }
        case 'van': {
            const white = M('#f6f2ea'), pink = M('#ff7ab4'), dark = M('#1c2430'), cream = M('#f4d8a0');
            add(B(2.1, 2.0, 3.4, white), 0, 1.45, 0.55);
            add(B(2.06, 1.3, 1.2, white), 0, 1.1, -1.75);
            add(B(1.9, 0.7, 0.04, dark), 0, 1.45, -2.36, -0.2);
            add(B(2.12, 0.3, 4.6, pink), 0, 0.75, 0); add(B(2.12, 0.12, 3.4, pink), 0, 2.2, 0.55);
            add(B(0.04, 0.9, 1.6, dark), 1.06, 1.6, 0.5); add(B(0.06, 0.08, 1.7, pink), 1.08, 1.12, 0.5);
            for (let i = 0; i < 6; i++) add(B(0.03, 0.18, 0.18, [cream, pink, M('#7ad0ff')][i % 3]), -1.07, 1.6 + (i % 2) * 0.3, -0.2 + Math.floor(i / 2) * 0.4);
            // the cone on the roof is the gunner's turret
            const tur = new THREE.Group(); tur.position.set(0, 2.45, 0.4); g.add(tur);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), M('#d8a860')); cone.rotation.x = Math.PI; cone.position.y = 0.55; tur.add(cone);
            const sc = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 7), pink); sc.position.y = 1.2; tur.add(sc);
            const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), cream); nz.rotation.x = Math.PI / 2; nz.position.set(0, 1.2, -0.55); tur.add(nz);
            g.userData.turret = tur;
            for (const [x, z] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.4], [0.95, 1.4]]) wheel(x, 0.42, z, 0.42, 0.26);
            break;
        }
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.wheels = wheels;
    return g;
}
// a capture point: a pole with a cloth that climbs as a team takes it, and a ring on the ground
export function flagModel(r) {
    const g = new THREE.Group();
    const pole = C(0.06, 0.08, 6, dyn('#b8bcc2'), 6); pole.position.y = 3; g.add(pole);
    const knob = S(0.12, dyn('#ffd23f'), 6); knob.position.y = 6.05; g.add(knob);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ color: '#f4f0e8', side: THREE.DoubleSide }));
    cloth.position.set(0.72, 5.4, 0); g.add(cloth);
    const ring = glows(new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 48), new THREE.MeshBasicMaterial({ color: '#f4f0e8', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    g.userData = { cloth, ring };
    return g;
}

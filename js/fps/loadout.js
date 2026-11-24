/* The loadout screen's pictures: portraits of the characters and their weapons, rendered once from the real models,
   and a little stage where the chosen character turns round holding the chosen class's weapon. */
import * as THREE from 'three';
import { makeCharacter, weaponModel } from './models.js';
import { CHARS, CLASSES, WEAPONS } from './defs.js';

const LIGHT = { value: new THREE.Color(0.46, 0.46, 0.5) };

function studio() {
    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight('#fff4e4', 2.2); key.position.set(1.5, 2.5, 2);
    const rim = new THREE.DirectionalLight('#9ec4ff', 1.4); rim.position.set(-2, 1.5, -2);
    scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.3));
    return scene;
}
// render a model into a small picture and return it as a data URL
function snapshot(renderer, obj, size, camSetup) {
    const scene = studio();
    scene.add(obj);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    camSetup(cam);
    const rt = new THREE.WebGLRenderTarget(size, size);
    const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()).getHex(), prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, cam);
    const px = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
    renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA);
    rt.dispose();
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), img = x.createImageData(size, size);
    // the render target is upside down, and in linear light: flip it and brighten for the screen
    for (let y = 0; y < size; y++) for (let i = 0; i < size; i++) {
        const s = ((size - 1 - y) * size + i) * 4, d = (y * size + i) * 4;
        for (let k = 0; k < 3; k++) img.data[d + k] = Math.min(255, Math.pow(px[s + k] / 255, 1 / 2.2) * 255);
        img.data[d + 3] = px[s + 3];
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL();
}

let cache = null;
export function portraits(renderer) {
    if (cache) return cache;
    cache = { chars: [], weapons: {} };
    CHARS.forEach((_, i) => {
        const J = makeCharacter(i, LIGHT);
        cache.chars.push(snapshot(renderer, J.root, 96, (cam) => { cam.position.set(0.55, 1.55, -1.9); cam.lookAt(0, 1.45, 0); }));
    });
    for (const w of [...Object.keys(WEAPONS), 'popper', 'powder']) {
        const m = weaponModel(w, { probe: LIGHT });
        const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
        m.position.sub(c);
        cache.weapons[w] = snapshot(renderer, m, 64, (cam) => { cam.position.set(s * 1.6, s * 0.9, s * 0.4); cam.lookAt(0, 0, 0); });
    }
    return cache;
}

// the turning character on the right of the loadout screen
export class Stage {
    constructor() {
        this.scene = studio();
        this.scene.background = new THREE.Color('#0d1016');
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ color: '#1c222c' }));
        floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.22, 48), new THREE.MeshBasicMaterial({ color: '#ffb43a' }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
        this.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 50);
        // the character stands right of centre, so the menu on the left doesn't cover it
        this.cam.position.set(-2.3, 1.3, 6.8); this.cam.lookAt(-2.3, 0.95, 0);
        this.cam.position.x -= 0; this.holder = new THREE.Group(); this.holder.position.set(0, 0, 0); this.scene.add(this.holder);
        this.key = '';
        this.t = 0;
    }
    show(ci, cls, armed, primary) {
        const key = ci + '|' + cls + '|' + armed + '|' + primary;
        if (key === this.key) return;
        this.key = key;
        this.holder.clear();
        const J = makeCharacter(ci, LIGHT);
        const K = CLASSES[cls] || CLASSES[0];
        const w = primary || (armed ? Object.keys(K.kit).find((k) => WEAPONS[k].ammo) || Object.keys(K.kit)[0] : 'pistol');
        const m = weaponModel(w, { probe: LIGHT, dual: armed && K.dual });
        m.rotation.x = -Math.PI / 2;
        J.hand.add(m);
        J.armR.rotation.x = Math.PI / 2 - 0.2;
        this.holder.add(J.root);
        this.J = J;
    }
    update(dt) {
        this.t += dt;
        this.holder.rotation.y = Math.sin(this.t * 0.6) * 0.7 + 0.35;
        if (this.J) { this.J.armL.rotation.x = Math.sin(this.t * 1.7) * 0.05; this.J.neck.rotation.y = Math.sin(this.t * 0.9) * 0.2; }
        this.cam.aspect = 16 / 9; this.cam.updateProjectionMatrix();
    }
}

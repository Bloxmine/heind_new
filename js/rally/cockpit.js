/* First-person cockpit: dashboard with glowing gauges, a steering wheel that turns, a rear-view mirror with a live
   view behind, a pine-tree air freshener swinging on real car forces, and wipers that sweep the windscreen. */
import * as THREE from 'three';
import { cel, glows, GLOW } from './retro.js';

const EYE = new THREE.Vector3(0.3, 1.31, -0.12);    // driver sits on the left (+x)
const GLASS = { bl: [-0.8, 1.0, 0.78], br: [0.8, 1.0, 0.78], tl: [-0.7, 1.46, 0.1], tr: [0.7, 1.46, 0.1] };

const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

export class Cockpit {
    constructor(car) {
        this.car = car;
        const g = this.group = new THREE.Group();
        g.visible = false;
        car.mesh.body.add(g);
        const dark = cel({ color: '#1a1c20' }), mid = cel({ color: '#2c3036' }), trim = cel({ color: '#4a5058' });

        // dashboard and roof lining
        const dash = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.14, 0.44), cel({ color: '#3a3e46' })); dash.position.set(0, 0.92, 0.6); g.add(dash);
        const lining = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.5), cel({ color: '#3a3e44', side: THREE.DoubleSide })); lining.position.set(0, 1.5, -0.62); g.add(lining);
        const header = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.1), mid); header.position.set(0, 1.48, 0.1); g.add(header);
        for (const sx of [-1, 1]) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.84), mid);
            p.position.set(sx * 0.77, 1.23, 0.44);
            p.rotation.x = Math.atan2(0.46, 0.68);
            g.add(p);
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 1.6), dark); door.position.set(sx * 0.84, 0.92, -0.2); g.add(door);
        }
        // gauges that glow
        const gauge = canvasTex(32, 16, (x) => {
            x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 32, 16);
            for (const cx of [8, 24]) {
                x.strokeStyle = '#3ad0ff'; x.beginPath(); x.arc(cx, 9, 6, Math.PI * 0.8, Math.PI * 2.2); x.stroke();
                x.fillStyle = '#ff3a6e'; x.fillRect(cx + 3, 4, 2, 2);
            }
        });
        const gm = glows(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ map: gauge })));
        gm.position.set(EYE.x, 0.99, 0.56); gm.rotation.order = 'YXZ'; gm.rotation.set(-0.35, Math.PI, 0);
        g.add(gm);
        this.needle = glows(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.004), new THREE.MeshBasicMaterial({ color: '#ffd27a' })));
        this.needle.geometry.translate(0, 0.035, 0);
        this.needle.position.set(EYE.x - 0.04, 0.98, 0.55); this.needle.rotation.order = 'YXZ'; this.needle.rotation.x = -0.35;
        g.add(this.needle);

        // steering wheel
        const wheel = this.wheel = new THREE.Group();
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 6, 18), dark);
        wheel.add(rim);
        for (const a of [0, 2.2, -2.2]) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.02), mid);
            s.geometry.translate(0, -0.085, 0); s.rotation.z = a; wheel.add(s);
        }
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8), trim); boss.rotation.x = Math.PI / 2; wheel.add(boss);
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), cel({ color: '#ff3a6e' })); mark.position.set(0, 0.17, 0); wheel.add(mark);
        const column = new THREE.Group();
        column.position.set(EYE.x, 0.97, 0.34);
        column.rotation.x = -0.45;    // tilt towards the driver
        column.add(wheel);
        g.add(column);
        [dash, gm, this.needle, column].forEach((o) => { o.visible = false; });

        // rear-view mirror with a live render behind the car
        this.rt = new THREE.WebGLRenderTarget(96, 28, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
        this.mcam = new THREE.PerspectiveCamera(36, 96 / 28, 0.5, 500);
        const mirror = this.mirror = new THREE.Group();
        mirror.position.set(0.14, 1.43, 0.32);
        mirror.rotation.y = 0.1;                      // angled a touch towards the driver
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.025), dark); mirror.add(frame);
        const mg = new THREE.PlaneGeometry(0.2, 0.052);
        const uv = mg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));   // mirrors flip left and right
        const glass = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ map: this.rt.texture }));
        glass.position.z = -0.014; glass.rotation.y = Math.PI;
        mirror.add(glass);
        const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), dark); stalk.position.set(0, 0.07, 0.02); mirror.add(stalk);
        g.add(mirror);

        // air freshener: a little pine tree on a string, a damped pendulum in two directions
        const tree = canvasTex(12, 20, (x) => {
            x.fillStyle = '#1e5234';
            for (let r = 0; r < 16; r++) { const w = 2 + Math.floor((r % 6) * 0.9) + Math.floor(r / 6) * 2; x.fillRect(6 - w / 2, r + 1, w, 1); }
            x.fillStyle = '#3f9446'; for (let r = 2; r < 16; r += 3) x.fillRect(5, r, 2, 1);
            x.fillStyle = '#ffd27a'; x.fillRect(4, 9, 4, 2);
            x.fillStyle = '#4a2e1c'; x.fillRect(5, 17, 2, 3);
            x.fillStyle = '#111'; x.fillRect(5, 0, 2, 1);
        });
        const fresh = this.fresh = new THREE.Group();
        fresh.position.set(0.14, 1.4, 0.3);
        const string = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.09, 0.004), new THREE.MeshBasicMaterial({ color: '#dddddd' }));
        string.position.y = -0.045; fresh.add(string);
        const card = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.1), cel({ map: tree, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false }));
        card.position.y = -0.14; card.rotation.y = 0.4; fresh.add(card);
        this.card = card;
        g.add(fresh);
        this.sw = { f: 0, vf: 0, s: 0, vs: 0, spin: 0.4, vspin: 0 };

        // wipers, lying on the windscreen
        const glassTilt = -Math.atan2(GLASS.bl[2] - GLASS.tl[2], GLASS.tl[1] - GLASS.bl[1]);
        this.wipers = [];
        for (const px of [0.18, -0.5]) {
            const base = new THREE.Group();
            base.position.set(px, 1.02, 0.75);
            base.rotation.x = glassTilt;
            const arm = new THREE.Group();
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.56, 0.012), cel({ color: '#0c0d10' }));
            blade.position.y = 0.3;
            arm.add(blade);
            const tip = new THREE.Object3D(); tip.position.y = 0.58; arm.add(tip);
            base.add(arm);
            g.add(base);
            this.wipers.push({ arm, tip, base });
        }
        this.wipeT = 0; this.wiping = false;
        this.tmp = new THREE.Vector3();
    }
    setVisible(on) {
        this.group.visible = on;
        this.car.mesh.cabin.visible = !on;
        this.car.mesh.shell.visible = !on;
        if (this.car.mesh.trim) this.car.mesh.trim.visible = !on;
        this.car.mesh.hood.visible = on;
        this.car.mesh.headStars.forEach((s) => { s.visible = !on; });
        (this.car.mesh.beams || []).forEach((b) => { b.visible = !on; });
    }
    // camera at the driver's eyes, looking down the road
    place(cam) {
        const b = this.car.mesh.body;
        b.updateWorldMatrix(true, false);
        cam.position.copy(EYE).applyMatrix4(b.matrixWorld);
        const look = this.tmp.set(EYE.x, EYE.y - 0.12, 14).applyMatrix4(b.matrixWorld);
        cam.up.set(0, 1, 0);
        cam.lookAt(look);
        cam.fov = 62 + Math.min(8, this.car.speed * 0.12);
        cam.updateProjectionMatrix();
    }
    update(dt, rain) {
        const c = this.car;
        this.wheel.rotation.z = -c.steer * 2.3;
        this.needle.rotation.z = 1.2 - Math.min(1, c.speed / 55) * 2.6;
        // pendulum: gravity plus the car's own acceleration, swung around by bumps
        const L = 0.12, sw = this.sw, gEff = 9.8 + (c.accY || 0) * 0.5;
        const af = sw.f, as = sw.s;
        sw.vf += (-(gEff / L) * Math.sin(af) + ((c.accF || 0) / L) * Math.cos(af) - 3.2 * sw.vf) * dt;
        sw.vs += (-(gEff / L) * Math.sin(as) - ((c.accL || 0) / L) * Math.cos(as) - 3.2 * sw.vs) * dt;
        if (c.ground && c.speed > 3 && c.q && c.q.surface !== 'tarmac') { sw.vs += (Math.random() - 0.5) * c.speed * 0.02; sw.vf += (Math.random() - 0.5) * c.speed * 0.015; }
        sw.vf = Math.max(-25, Math.min(25, sw.vf)); sw.vs = Math.max(-25, Math.min(25, sw.vs));
        sw.f = Math.max(-1.3, Math.min(1.3, sw.f + sw.vf * dt));
        sw.s = Math.max(-1.3, Math.min(1.3, sw.s + sw.vs * dt));
        sw.vspin += (-(sw.spin - 0.4) * 6 + sw.vs * 0.6 - sw.vspin * 1.5) * dt;
        sw.spin += sw.vspin * dt;
        this.fresh.rotation.set(sw.f, 0, sw.s);
        this.card.rotation.y = sw.spin;
        // wipers: on whenever it rains, a sweep and a short pause
        this.wiping = !!rain;
        if (this.wiping || this.wipeT % 1 > 0.01) this.wipeT += dt / 1.25;
        const ph = this.wipeT % 1;
        const k = ph < 0.7 ? 0.5 - 0.5 * Math.cos((ph / 0.7) * Math.PI * 2) : 0;
        this.wipers.forEach((w) => { w.arm.rotation.z = 1.5 - k * 1.75; });
    }
    // where the wiper blades are on screen, for clearing droplets (in 0..1 screen coords, y down)
    wiperLines(cam) {
        return this.wipers.map((w) => {
            w.base.updateWorldMatrix(true, true);
            const a = new THREE.Vector3().setFromMatrixPosition(w.base.matrixWorld).project(cam);
            const b = new THREE.Vector3().setFromMatrixPosition(w.tip.matrixWorld).project(cam);
            return [a.x * 0.5 + 0.5, 0.5 - a.y * 0.5, b.x * 0.5 + 0.5, 0.5 - b.y * 0.5];
        });
    }
    // the windscreen's corners on screen, so droplets only land on the glass
    glassQuad(cam) {
        const b = this.car.mesh.body.matrixWorld;
        return ['tl', 'tr', 'br', 'bl'].map((k) => {
            const v = new THREE.Vector3(...GLASS[k]).applyMatrix4(b).project(cam);
            return [v.x * 0.5 + 0.5, 0.5 - v.y * 0.5];
        });
    }
    /* A flat pixel-art dashboard over the bottom of the view, like an arcade cockpit:
       speedometer and rev counter with sweeping needles, a big gear digit, warning lights, the wheel. */
    drawDash(x, W, H, o) {
        x.clearRect(0, 0, W, H);
        x.imageSmoothingEnabled = false;
        const ink = '#07090c';
        // dashboard silhouette with a hump over the gauges
        x.beginPath();
        x.moveTo(0, H); x.lineTo(0, 146); x.lineTo(70, 136); x.lineTo(96, 122); x.lineTo(224, 122); x.lineTo(250, 136); x.lineTo(W, 146); x.lineTo(W, H); x.closePath();
        x.fillStyle = '#171a20'; x.fill();
        x.lineWidth = 2; x.strokeStyle = ink; x.stroke();
        x.fillStyle = '#2a3139'; x.fillRect(98, 123, 124, 2); x.fillRect(4, 146, 64, 1); x.fillRect(252, 146, 64, 1);
        // a gauge: dark face, ticks, a needle that sweeps from bottom-left to bottom-right
        const gauge = (cx, cy, r, v, max, label, red) => {
            x.fillStyle = ink; x.beginPath(); x.arc(cx, cy, r + 3, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#2e353e'; x.beginPath(); x.arc(cx, cy, r + 1, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#0b0e12'; x.beginPath(); x.arc(cx, cy, r - 1, 0, Math.PI * 2); x.fill();
            const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
            for (let k = 0; k <= 12; k++) {
                const a = a0 + (a1 - a0) * (k / 12);
                const hot = red && k >= 10;
                x.fillStyle = hot ? '#ff3a6e' : '#3ad0ff';
                const r0 = r - (k % 2 ? 4 : 6);
                for (let d = r0; d < r - 2; d++) x.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1);
            }
            x.fillStyle = '#6fa39a'; x.font = '8px Silkscreen, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillText(label, cx, cy + r * 0.45);
            const a = a0 + (a1 - a0) * Math.max(0, Math.min(1, v / max));
            x.strokeStyle = '#ffe23a'; x.lineWidth = 2;
            x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5)); x.stroke();
            x.fillStyle = '#ff3a6e'; x.fillRect(cx - 2, cy - 2, 4, 4);
        };
        gauge(126, 150, 25, o.kmh, 240, 'KM/H', false);
        gauge(194, 150, 25, o.rpm, 1, 'RPM', true);
        // digital speed and gear
        x.fillStyle = ink; x.fillRect(146, 128, 28, 26);
        x.fillStyle = '#0b0e12'; x.fillRect(148, 130, 24, 22);
        x.fillStyle = '#ffe23a'; x.font = '16px Silkscreen, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(o.gear, 160, 142);
        x.fillStyle = '#dde2e5'; x.font = '8px Silkscreen, monospace';
        x.fillText(String(Math.round(o.kmh)).padStart(3, '0'), 126, 168);
        // warning lights
        const lamp = (lx, on, col) => { x.fillStyle = ink; x.fillRect(lx - 1, 126, 8, 6); x.fillStyle = on ? col : '#22282f'; x.fillRect(lx, 127, 6, 4); };
        lamp(102, o.nitro, '#4aff7a'); lamp(112, o.shield, '#ffe23a'); lamp(206, o.damaged, '#ff3a6e'); lamp(216, o.brake, '#ff9a3a');
        // the steering wheel, mostly below the screen, turning with the input
        x.save();
        x.translate(160, 252);
        x.rotate(o.steer * 2.1);
        const R = 80;
        x.lineWidth = 13; x.strokeStyle = ink; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 9; x.strokeStyle = '#22262c'; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 9; x.strokeStyle = '#30353c';
        for (const a of [-2.4, -0.74]) { x.beginPath(); x.arc(0, 0, R, a, a + 0.5); x.stroke(); }    // grips
        x.lineWidth = 2; x.strokeStyle = '#3e454e'; x.beginPath(); x.arc(0, 0, R - 3, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
        x.fillStyle = '#ff3a6e'; x.fillRect(-3, -R - 4, 6, 8);                                         // top marker
        x.fillStyle = ink;
        for (const a of [Math.PI * 0.85, Math.PI * 0.15]) { x.save(); x.rotate(a); x.fillRect(0, -6, R, 12); x.restore(); }
        x.fillStyle = '#22262c';
        for (const a of [Math.PI * 0.85, Math.PI * 0.15]) { x.save(); x.rotate(a); x.fillRect(4, -4, R - 6, 8); x.restore(); }
        x.restore();
    }
    renderMirror(renderer, scene) {
        const b = this.car.mesh.body;
        const m = this.mcam;
        m.position.set(0, 1.55, -0.4).applyMatrix4(b.matrixWorld);
        m.lookAt(this.tmp.set(0, 1.0, -20).applyMatrix4(b.matrixWorld));
        const vis = this.group.visible;
        this.group.visible = false;
        m.layers.set(0);
        renderer.setRenderTarget(this.rt);
        renderer.render(scene, m);
        renderer.setRenderTarget(null);
        this.group.visible = vis;
    }
}

/* The look: cel-shaded 3D rendered small, ink outlines from the depth buffer, manga speed lines,
   then dithered to a palette (same maths as dither.js) and scaled up with hard pixels. */
import * as THREE from 'three';

export const RES = { w: 320, h: 180 };
// Layers: 0 = the world, 1 = things that glow (lights, sun, power-ups), 3 = only in the main pass (dust).
export const GLOW = 1, MAIN_ONLY = 3;
export const glows = (obj) => { obj.layers.enable(GLOW); return obj; };
const snap = { value: new THREE.Vector2(RES.w / 2, RES.h / 2) };

// Snap every projected vertex to the low-res pixel grid, so polygons jitter like old phone 3D.
export function retro(mat, doSnap = true) {
    if (!doSnap) return mat;
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uSnap = snap;
        sh.vertexShader = 'uniform vec2 uSnap;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            if (uSnap.x > 0.0 && gl_Position.w > 0.0) {
                vec2 sp = gl_Position.xy / gl_Position.w;
                sp = floor(sp * uSnap + 0.5) / uSnap;
                gl_Position.xy = sp * gl_Position.w;
            }`);
    };
    mat.customProgramCacheKey = () => 'retro-snap';
    return mat;
}
export const setWobble = (k) => { snap.value.set(k ? RES.w / 2 / k : 0, k ? RES.h / 2 / k : 0); };

// Three hard light bands: shadow, mid, lit.
const GRAD = (() => {
    const t = new THREE.DataTexture(new Uint8Array([125, 125, 125, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
})();
// snap: false for big ground surfaces, whose long triangles tear when their corners are snapped
export const cel = (opts = {}, snapIt = true) => {
    const o = Object.assign({}, opts);
    delete o.flatShading;
    return retro(new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, o)), snapIt);
};

const FRAG = `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tGlow;
uniform sampler2D tDrops;
uniform float uDropsOn;
uniform float uRain, uRainSlant;
uniform vec3 uTint;
uniform float uTintK;
uniform float uGlow;
uniform vec3 uPal[40];
uniform int uN;
uniform float uSpread;
uniform int uMode;
uniform vec2 uRes;
uniform float uNear, uFar;
uniform float uInkOn;
uniform vec3 uInk, uLine;
uniform float uSpeed, uTime, uBurst;
uniform float uSat, uCon, uVig;
uniform vec3 uShadow, uHigh;
varying vec2 vUv;
const float B[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float dist(vec2 uv) { float d = texture2D(tDepth, uv).x; return uNear * uFar / (uFar - d * (uFar - uNear)); }
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
    // windscreen droplets bend the view behind them
    vec2 uvS = vUv; vec2 dn = vec2(0.0); float wet = 0.0;
    if (uDropsOn > 0.5) {
        vec4 dr = texture2D(tDrops, vUv);
        if (dr.b > 0.2) { dn = (dr.rg - 0.5) * 2.0; wet = dr.b; uvS = vUv + vec2(dn.x, -dn.y) * 0.03 * wet; }
    }
    vec3 g = toSRGB(clamp(texture2D(tDiffuse, uvS).rgb, 0.0, 1.0));
    // grade: pull the saturation down, push contrast, teal shadows and warm highlights, dark corners
    float l = dot(g, vec3(0.299, 0.587, 0.114));
    g = mix(vec3(l), g, uSat);
    g = (g - 0.5) * uCon + 0.5;
    g *= mix(uShadow, uHigh, smoothstep(0.12, 0.75, l));
    vec2 vg = vUv - 0.5;
    g *= 1.0 - uVig * dot(vg, vg) * 2.4;
    // glow around lights: added before the dither, so the halo breaks into stylised bands
    vec3 gw = toSRGB(clamp(texture2D(tGlow, vUv).rgb, 0.0, 1.0));
    float gm = max(gw.r, max(gw.g, gw.b));
    float gq = floor(gm * 3.0 + 0.1) / 3.0;
    g += (gm > 0.002 ? gw / gm * gq : vec3(0.0)) * uGlow;
    // a power-up's colour washes in from the screen edges when it fires
    if (uTintK > 0.01) g = mix(g, uTint, uTintK * smoothstep(0.42, 0.9, length(vg) * 1.5));
    if (wet > 0.2) {
        g = g * 1.06 + 0.03;
        if (dn.y < -0.35 && dn.x < -0.1) g += 0.3;      // a glint on the top-left of each drop
        if (dn.y > 0.55) g *= 0.72;                      // and a dark rim at the bottom
    }
    vec3 c = clamp(g, 0.0, 1.0) * 255.0;
    ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
    float o = ((B[p.x + (3 - p.y) * 4] + 0.5) / 16.0 - 0.5) * uSpread;
    if (uMode != 0) {
        c = clamp(c + o, 0.0, 255.0);
        if (uMode == 1) {
            c = floor(c / 17.0 + 0.5) * 17.0;
        } else {
            vec3 best = uPal[0];
            float bd = 1e20;
            for (int i = 0; i < 40; i++) {
                if (i >= uN) break;
                vec3 q = uPal[i];
                vec3 d = c - q;
                float rm = (c.r + q.r) * 0.5;
                float dd = (2.0 + rm / 256.0) * d.r * d.r + 4.0 * d.g * d.g + (2.0 + (255.0 - rm) / 256.0) * d.b * d.b;
                if (dd < bd) { bd = dd; best = q; }
            }
            c = best;
        }
    }
    // ink: this pixel is in front of a neighbour by a clear margin, so it sits on an outline
    if (uInkOn > 0.5) {
        vec2 px = 1.0 / uRes;
        float z = dist(vUv);
        float zl = dist(vUv - vec2(px.x, 0.0)), zr = dist(vUv + vec2(px.x, 0.0));
        float zu = dist(vUv + vec2(0.0, px.y)), zd = dist(vUv - vec2(0.0, px.y));
        float edge = max(max(zl, zr), max(zu, zd)) - z;
        float k = step(z * 0.07 + 0.35, edge) * (1.0 - smoothstep(180.0, 420.0, z));
        c = mix(c, uInk, step(0.5, k));
    }
    // anime rain: slanted streaks in screen space, each column with its own speed and length
    if (uRain > 0.01 && dist(vUv) > 2.5) {
        vec2 fp = gl_FragCoord.xy;
        float u = fp.x + fp.y * uRainSlant;
        float col = floor(u / 3.0);
        float hc = hash(col * 3.1), hs = hash(col * 7.7 + 1.3);
        float v = fp.y + uTime * (260.0 + hs * 160.0) + hc * 400.0;
        float len = 6.0 + hs * 10.0;
        float on = step(hash(col + floor(v / 60.0) * 13.0), uRain * 0.28) * step(mod(v, 60.0), len) * step(abs(fract(u / 3.0) - 0.5), 0.2);
        c = mix(c, uLine, on * 0.7);
    }
    // manga speed lines: thin radial streaks from the edges, denser and longer the faster you go
    if (uSpeed > 0.01 || uBurst > 0.01) {
        vec2 q = (gl_FragCoord.xy - uRes * vec2(0.5, 0.56)) / uRes.y;
        float r = length(q);
        float a = atan(q.y, q.x) / 6.2831853 + 0.5;
        float bins = 150.0;
        float b = floor(a * bins);
        float ts = floor(uTime * 12.0);
        float h = hash(b + ts * 37.0), h2 = hash(b * 1.7 + ts * 11.0);
        float f = fract(a * bins);
        float r0 = mix(1.05, 0.42, uSpeed) + h2 * 0.28;
        float w = 0.12 + 0.3 * smoothstep(r0, r0 + 0.5, r);
        float on = step(1.0 - uSpeed * 0.5, h) * step(r0, r) * step(abs(f - 0.5), w);
        c = mix(c, mix(uLine, uTint * 255.0, min(1.0, uTintK * 1.6)), on);
        // a burst (big landing, boost) adds heavy black focus lines
        float rb = mix(0.9, 0.3, uBurst) + h * 0.2;
        float onb = step(1.0 - uBurst * 0.6, h2) * step(rb, r) * step(abs(f - 0.5), 0.1 + 0.35 * smoothstep(rb, rb + 0.4, r));
        c = mix(c, uInk, onb);
    }
    gl_FragColor = vec4(c / 255.0, 1.0);
}`;

export class Post {
    constructor(renderer) {
        this.r = renderer;
        this.rt = new THREE.WebGLRenderTarget(RES.w, RES.h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
        this.rt.depthTexture = new THREE.DepthTexture(RES.w, RES.h);
        this.rt.depthTexture.type = THREE.UnsignedIntType;
        const pal = []; for (let i = 0; i < 40; i++) pal.push(new THREE.Vector3());
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
                uPal: { value: pal }, uN: { value: 0 }, uSpread: { value: 30 }, uMode: { value: 2 },
                uRes: { value: new THREE.Vector2(RES.w, RES.h) }, uNear: { value: 0.3 }, uFar: { value: 1500 },
                uInkOn: { value: 1 }, uInk: { value: new THREE.Vector3(17, 18, 26) }, uLine: { value: new THREE.Vector3(255, 255, 255) },
                uSpeed: { value: 0 }, uTime: { value: 0 }, uBurst: { value: 0 },
                uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0 }, tGlow: { value: null }, uGlow: { value: 1.0 }, tDrops: { value: null }, uDropsOn: { value: 0 }, uRain: { value: 0 }, uRainSlant: { value: 0.18 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uTintK: { value: 0 },
                uShadow: { value: new THREE.Vector3(1, 1, 1) }, uHigh: { value: new THREE.Vector3(1, 1, 1) }
            },
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader: FRAG,
            depthTest: false, depthWrite: false
        });
        this.scene = new THREE.Scene();
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
        this.scene.add(this.quad);
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // glow: lights drawn over a black silhouette of the world, then blurred (wider sideways, for streaks)
        const gw = RES.w / 2, gh = RES.h / 2, lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
        this.glowRT = new THREE.WebGLRenderTarget(gw, gh, { ...lin, depthBuffer: true });
        this.blurA = new THREE.WebGLRenderTarget(gw, gh, lin);
        this.blurB = new THREE.WebGLRenderTarget(gw, gh, lin);
        this.black = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.blur = new THREE.ShaderMaterial({
            uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
                void main() {
                    vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
                    s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
                    s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
                    gl_FragColor = vec4(s * 1.06, 1.0);
                }`,
            depthTest: false, depthWrite: false
        });
        this.mat.uniforms.tGlow.value = this.blurB.texture;
        this.glowOn = true;
        this.clearBlack = new THREE.Color(0x000000);
    }
    // a small picture-in-picture (the rear-view mirror), mirrored left to right, at the top centre
    setInset(tex, on) {
        if (!this.inset) {
            this.inset = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ depthTest: false, side: THREE.DoubleSide }));
            this.inset.renderOrder = 2;
            const w = 69 / RES.w, top = 1 - 2 * 4.4 / RES.h, bot = 1 - 2 * 23.6 / RES.h;
            this.inset.scale.set(-2 * w, top - bot, 1);
            this.inset.position.set(0, (top + bot) / 2, 0);
            this.scene.add(this.inset);
        }
        if (tex) this.inset.material.map = tex;
        this.inset.visible = !!on;
    }
    blurPass(src, dst, dx, dy) {
        const iv = this.inset && this.inset.visible;
        if (this.inset) this.inset.visible = false;      // the mirror inset is not part of the glow
        this.quad.material = this.blur;
        this.blur.uniforms.tSrc.value = src.texture;
        this.blur.uniforms.uDir.value.set(dx / src.width, dy / src.height);
        this.r.setRenderTarget(dst);
        this.r.render(this.scene, this.cam);
        this.quad.material = this.mat;
        if (this.inset) this.inset.visible = iv;
    }
    renderGlow(scene, cam) {
        const r = this.r, bg = scene.background, fog = scene.fog;
        scene.background = this.clearBlack; scene.fog = null;
        // the world as a black silhouette (so lights get hidden behind things)
        scene.overrideMaterial = this.black;
        cam.layers.set(0);
        r.setRenderTarget(this.glowRT);
        r.clear();
        r.render(scene, cam);
        // the lights themselves, depth-tested against that silhouette
        scene.overrideMaterial = null;
        cam.layers.set(GLOW);
        const ac = r.autoClear; r.autoClear = false;
        scene.background = null;
        r.render(scene, cam);
        r.autoClear = ac;
        scene.background = bg; scene.fog = fog;
        // blur: sideways wide, then down, then sideways again for the anamorphic streak
        this.blurPass(this.glowRT, this.blurA, 1.5, 0);
        this.blurPass(this.blurA, this.blurB, 0, 1.2);
        this.blurPass(this.blurB, this.blurA, 4, 0);
        this.blurPass(this.blurA, this.blurB, 0, 2);
    }
    // look.mode: 'palette' (hexes), 'java' (4096 colours) or 'raw'
    setLook(look) {
        const u = this.mat.uniforms;
        u.uMode.value = look.mode === 'raw' ? 0 : look.mode === 'java' ? 1 : 2;
        u.uSpread.value = look.spread || 17;
        const v = (h, out) => { const n = parseInt(h.slice(1), 16); out.set((n >> 16) & 255, (n >> 8) & 255, n & 255); };
        if (look.hexes) { look.hexes.forEach((h, i) => v(h, u.uPal.value[i])); u.uN.value = look.hexes.length; }
        const gr = look.grade || { sat: 1, con: 1, vig: 0.15, shadow: [1, 1, 1], high: [1, 1, 1] };
        u.uSat.value = gr.sat; u.uCon.value = gr.con; u.uVig.value = gr.vig;
        u.uShadow.value.set(...gr.shadow); u.uHigh.value.set(...gr.high);
        v(look.ink || '#11121a', u.uInk.value);
        v(look.line || '#ffffff', u.uLine.value);
    }
    set(fx) {
        const u = this.mat.uniforms;
        if (fx.ink != null) u.uInkOn.value = fx.ink ? 1 : 0;
        if (fx.speed != null) u.uSpeed.value = fx.speed;
        if (fx.burst != null) u.uBurst.value = fx.burst;
        if (fx.time != null) u.uTime.value = fx.time;
        if (fx.rain != null) u.uRain.value = fx.rain;
        if (fx.tint) u.uTint.value.set(...fx.tint);
        if (fx.tintK != null) u.uTintK.value = fx.tintK;
        if (fx.slant != null) u.uRainSlant.value = fx.slant;
        if (fx.drops !== undefined) { u.tDrops.value = fx.drops; u.uDropsOn.value = fx.drops ? 1 : 0; }
        if (fx.glow != null) { this.glowOn = !!fx.glow; u.uGlow.value = fx.glow ? 1.0 : 0; }
    }
    render(scene, cam) {
        this.mat.uniforms.uNear.value = cam.near;
        this.mat.uniforms.uFar.value = cam.far;
        cam.layers.set(0); cam.layers.enable(MAIN_ONLY);
        this.r.setRenderTarget(this.rt);
        this.r.render(scene, cam);
        if (this.glowOn) this.renderGlow(scene, cam);
        cam.layers.set(0); cam.layers.enable(MAIN_ONLY);
        this.r.setRenderTarget(null);
        this.r.render(this.scene, this.cam);
    }
}

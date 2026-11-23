/* Track definitions. Points are [x, z, height] in metres; the road is a closed Catmull-Rom loop through them.
   bank: how high the ground rises (or falls, when negative) beside the road.
   jumps: kicker ramps at a fraction of the lap. props: scenery from scenery.js. weather: the default. */
export const TRACKS = [
    {
        id: 'alpine', name: 'ALPINE PASS', blurb: 'dirt switchbacks under snowy peaks',
        surface: 'dirt', width: 11, groundY: -40, laps: 3, weather: 'dry',
        points: [[0, 0, 0], [110, -20, 2], [210, 10, 7], [265, 95, 13], [250, 190, 17], [170, 250, 13], [95, 228, 7], [55, 160, 11],
            [-15, 125, 3], [-105, 168, 0], [-192, 132, -2], [-225, 48, 1], [-178, -28, 5], [-92, -44, 3]],
        jumps: [{ at: 0.43, h: 2.2, len: 26 }],
        bank: { base: 4, amp: 8, seed: 4 },
        sky: { top: '#1e2a38', horizon: '#d8885a', far: '#3e4652', far2: '#363e4a', snow: '#c4bcb8', snow2: '#948c90', near: '#2a3228', near2: '#242c22', clouds: '#4a4450', cloudsDark: '#2a2830', peaks: 70, seed: 3 },
        fog: '#8a7464', fogNear: 80, fogFar: 440,
        light: { sun: '#ffcc94', amb: '#7c8aa6', ground: '#3a3a30', dir: [-0.6, 0.34, 0.5], disc: '#ffd8a0' },
        trees: { kinds: ['pine', 'leaf'], density: 0.55 },
        terrain: 'grass', cliff: 'rock',
        props: { rocks: { density: 0.25 } },
        headlights: 0.8   // dusk: lights on
    },
    {
        id: 'canyon', name: 'RED CANYON', blurb: 'sand, mesas and two big jumps',
        surface: 'gravel', width: 12, groundY: -6, laps: 3, weather: 'dry',
        points: [[0, 0, 0], [95, 12, 1], [180, -6, 3], [238, -62, 6], [252, -140, 4], [214, -204, 1], [138, -212, 3], [86, -160, 7],
            [20, -178, 4], [-58, -226, 1], [-148, -200, 0], [-188, -122, 2], [-140, -58, 5], [-66, -34, 2]],
        jumps: [{ at: 0.2, h: 3.2, len: 30 }, { at: 0.62, h: 3.8, len: 34 }],
        bank: { base: 3, amp: 6, seed: 11 },
        sky: { kind: 'mesas', top: '#3a3440', horizon: '#e8a46a', far: '#9a5a40', far2: '#7a4430', near: '#b07448', clouds: '#8a6a64', cloudsDark: '#5a4a4c', seed: 5 },
        fog: '#c89070', fogNear: 110, fogFar: 520,
        light: { sun: '#ffd0a0', amb: '#a08a8a', ground: '#8a5a3a', dir: [0.7, 0.32, -0.4], disc: '#ffe0b0' },
        trees: { kinds: ['cactus'], density: 0.35 },
        terrain: 'sand', cliff: 'redrock', ground: 'sand',
        props: { mesas: { count: 16 }, rocks: { density: 0.35, tex: 'redrock' }, neon: { at: 30, side: 0, text: 'CAFE', a: '#3ad0ff', b: '#ff3a6e' } },
        headlights: 0
    },
    {
        id: 'frost', name: 'FROSTBITE RIDGE', blurb: 'snow, pines and very little grip',
        surface: 'snow', width: 10, groundY: -50, laps: 3, weather: 'snow',
        points: [[0, 0, 0], [100, 30, 6], [182, 100, 14], [174, 190, 22], [92, 232, 26], [12, 200, 21], [-28, 132, 13], [-108, 108, 9],
            [-188, 148, 11], [-250, 90, 7], [-232, 2, 2], [-150, -40, 0], [-70, -30, 1]],
        jumps: [{ at: 0.7, h: 2, len: 22 }],
        bank: { base: 5, amp: 9, seed: 21 },
        sky: { top: '#141c34', horizon: '#7a8cb8', far: '#4a5a7a', far2: '#42506e', snow: '#dde6f2', snow2: '#aab8d0', near: '#22304a', near2: '#1e2a42', clouds: '#5a6688', cloudsDark: '#3a4462', peaks: 80, seed: 8 },
        fog: '#6a7aa0', fogNear: 50, fogFar: 340,
        light: { sun: '#b8c8ff', amb: '#8a9cc8', ground: '#5a6a8a', dir: [0.3, 0.3, 0.8], disc: '#d8e4ff' },
        trees: { kinds: ['snowpine', 'pine'], density: 0.8 },
        terrain: 'snow', cliff: 'rock', ground: 'snow',
        props: { rocks: { density: 0.2 } },
        headlights: 0.9
    },
    {
        id: 'harbour', name: 'HARBOUR NIGHT', blurb: 'wet docks between the containers',
        surface: 'tarmac', width: 13, groundY: -3, laps: 3, weather: 'rain', barrier: true,
        points: [[0, 0, 0], [140, 0, 0], [176, 14, 0], [192, 50, 0], [192, 150, 0], [176, 186, 0], [140, 200, 0], [46, 200, 0], [14, 218, 2],
            [2, 252, 4], [-22, 282, 2], [-62, 292, 0], [-140, 292, 0], [-176, 276, 0], [-192, 240, 0], [-192, 40, 0], [-176, 12, 0], [-140, 0, 0]],
        bank: { base: 0.3, amp: 0.1, seed: 2 },
        sky: { kind: 'city', top: '#05070c', horizon: '#2a3444', far: '#141a24', far2: '#1a2230', near: '#0c1016', window: '#ffd27a', window2: '#3ad0ff', seed: 12 },
        fog: '#1e2632', fogNear: 40, fogFar: 300,
        light: { sun: '#8a9ab8', amb: '#4a5872', ground: '#1a1e26', dir: [0.2, 0.6, 0.3], disc: '#1e2632' },
        trees: { kinds: [], density: 0 },
        terrain: 'concrete', cliff: 'concrete', ground: 'concrete',
        props: { barriers: true, containers: true, cranes: { count: 6 }, floodlights: { every: 24, color: '#ffd8a0' } },
        headlights: 1
    }
];

/* Track definitions. Points are [x, z, height] in metres; the road is a closed Catmull-Rom loop through them.
   bank: how high the ground rises (or falls, when negative) beside the road. */
export const TRACKS = [
    {
        id: 'alpine', name: 'ALPINE PASS', blurb: 'dirt switchbacks under snowy peaks',
        surface: 'dirt', width: 11, groundY: -40, laps: 3,
        points: [[0, 0, 0], [110, -20, 2], [210, 10, 7], [265, 95, 13], [250, 190, 17], [170, 250, 13], [95, 228, 7], [55, 160, 11],
            [-15, 125, 3], [-105, 168, 0], [-192, 132, -2], [-225, 48, 1], [-178, -28, 5], [-92, -44, 3]],
        bank: { base: 4, amp: 8, seed: 4 },
        sky: { top: '#1e2a38', horizon: '#d8885a', far: '#3e4652', far2: '#363e4a', snow: '#c4bcb8', snow2: '#948c90', near: '#2a3228', near2: '#242c22', clouds: '#4a4450', cloudsDark: '#2a2830', peaks: 70, seed: 3 },
        fog: '#8a7464', fogNear: 80, fogFar: 440,
        light: { sun: '#ffcc94', amb: '#7c8aa6', ground: '#3a3a30', dir: [-0.6, 0.34, 0.5], disc: '#ffd8a0' },
        trees: { kinds: ['pine', 'leaf'], density: 0.55 },
        terrain: 'grass', cliff: 'rock',
        headlights: 0.8   // dusk: lights on
    }
];

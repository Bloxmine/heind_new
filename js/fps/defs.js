/* Yard Sale Showdown: the weapons, pickups, characters and medals. */

// slot, name, ammo: [start when picked up, max, from an ammo box]; melee has no ammo
export const WEAPONS = {
    noodle: { slot: 1, name: 'POOL NOODLE', melee: true, verb: 'bonked' },
    slicer: { slot: 1, name: 'CHEESE SLICER', melee: true, verb: 'grated' },
    rake: { slot: 1, name: 'RAKE', melee: true, verb: 'raked' },
    whip: { slot: 1, name: 'WHIP', melee: true, verb: 'whipped' },
    pistol: { slot: 2, name: 'WATER PISTOL', name2: 'SUPER SOAKER', ammo: [50, 150, 40], verb: 'soaked' },
    balloon: { slot: 3, name: 'WATER BALLOONS', ammo: [8, 30, 8], verb: 'splashed' },
    blower: { slot: 4, name: 'LEAF BLOWER', ammo: [14, 50, 12], verb: 'blew away' },
    bat: { slot: 5, name: 'BASEBALL BAT', ammo: [10, 30, 8], verb: 'beaned' },
    tennis: { slot: 6, name: 'TENNIS BALL MACHINE', ammo: [80, 250, 60], verb: 'aced' },
    rocket: { slot: 7, name: 'BOTTLE ROCKETS', ammo: [8, 36, 6], verb: 'fizzed' },
    golf: { slot: 8, name: 'GOLF CLUB', ammo: [8, 30, 6], verb: 'teed off on' },
    rc: { slot: 9, name: 'RC RALLY CAR', ammo: [1, 1, 0], verb: 'ran over' }
};
// what killed you when it wasn't a weapon you carry
export const VERBS = { cone: 'creamed', trap: 'raked', fall: 'took a dive', cart: 'ran over', mower: 'mowed down', buggy: 'ran over', van: 'creamed' };
export const ORDER = ['noodle', 'slicer', 'rake', 'whip', 'pistol', 'balloon', 'blower', 'bat', 'tennis', 'rocket', 'golf', 'rc'];
export const MELEE = ['noodle', 'slicer', 'rake', 'whip'];
// which weapon to fall back to when one runs dry, best first
export const PREFER = ['rocket', 'tennis', 'blower', 'balloon', 'bat', 'golf', 'pistol', 'whip', 'slicer', 'rake', 'noodle'];
// short names for the weapon bar
export const SHORT = { noodle: 'NOODLE', slicer: 'SLICER', rake: 'RAKE', whip: 'WHIP', pistol: 'SOAKER', balloon: 'BALLOON', blower: 'BLOWER', bat: 'BAT', tennis: 'TENNIS', rocket: 'ROCKET', golf: 'GOLF', rc: 'RC' };

// pickups: kind, what it gives, respawn seconds
export const ITEMS = {
    'h:soda': { name: 'SODA', hp: 5, cap: 199, respawn: 15 },
    'h:kit': { name: 'FIRST-AID KIT', hp: 25, cap: 100, respawn: 20 },
    'h:cake': { name: 'BIRTHDAY CAKE', hp: 100, cap: 199, respawn: 55 },
    'r:pads': { name: 'KNEE PADS', armor: 25, respawn: 20 },
    'r:helmet': { name: 'BIKE HELMET', armor: 50, respawn: 30 },
    'r:ring': { name: 'SWIM RING', armor: 100, respawn: 55 },
    'p:sauce': { name: 'HOT SAUCE', power: 'sauce', time: 30, respawn: 60, desc: 'DOUBLE DAMAGE' },
    'p:espresso': { name: 'ESPRESSO', power: 'espresso', time: 20, respawn: 50, desc: 'SPEED' },
    'p:sneakers': { name: 'SPRINGY SNEAKERS', power: 'sneakers', time: 30, respawn: 45, desc: 'HIGH JUMP' },
    'p:box': { name: 'CARDBOARD BOX', power: 'box', time: 30, respawn: 60, desc: 'STAND STILL TO HIDE' }
};
for (const k of Object.keys(WEAPONS)) {
    ITEMS['w:' + k] = { name: WEAPONS[k].name, weapon: k, respawn: k === 'rc' ? 90 : 20 };
    if (WEAPONS[k].ammo) ITEMS['a:' + k] = { name: WEAPONS[k].name + ' AMMO', ammoFor: k, respawn: 20 };
}
export const MAX_ARMOR = 150;

// colours: skin, top, bottom, hat style and colour, shoes, an extra
export const CHARS = [
    { id: 'janitor', name: 'Gus', job: 'Janitor', skin: '#e0ac7e', top: '#4f6f8f', bottom: '#3b5068', hat: 'cap', hatC: '#2c3e55', shoes: '#222', extra: 'keys' },
    { id: 'chef', name: 'Bruno', job: 'Chef', skin: '#f0c49a', top: '#f2f0ea', bottom: '#2a2a2e', hat: 'toque', hatC: '#ffffff', shoes: '#111', extra: 'scarf' },
    { id: 'lifeguard', name: 'Kai', job: 'Lifeguard', skin: '#b5794a', top: '#d8342c', bottom: '#d8342c', hat: 'visor', hatC: '#ffd23f', shoes: '#e8e0d0', extra: 'whistle' },
    { id: 'guard', name: 'Mr. Pim', job: 'Museum guard', skin: '#e8b890', top: '#26314c', bottom: '#1d2536', hat: 'peaked', hatC: '#1d2536', shoes: '#111', extra: 'badge' },
    { id: 'gardener', name: 'Hennie', job: 'Gardener', skin: '#d89c70', top: '#6a8a3a', bottom: '#4f6a2c', hat: 'straw', hatC: '#e2c272', shoes: '#4a3a22', extra: 'gloves' },
    { id: 'coach', name: 'Lou', job: 'Tennis coach', skin: '#8a5a3a', top: '#f6f6f0', bottom: '#f6f6f0', hat: 'band', hatC: '#d83a5a', shoes: '#fff', extra: 'socks' },
    { id: 'barista', name: 'Mo', job: 'Barista', skin: '#c88a5a', top: '#2b2b2e', bottom: '#3a3a40', hat: 'beanie', hatC: '#c84a2a', shoes: '#222', extra: 'apron' },
    { id: 'crossing', name: 'Doris', job: 'Lollipop lady', skin: '#f2c8a8', top: '#d8f040', bottom: '#2a2e3a', hat: 'cap', hatC: '#f4f4f4', shoes: '#111', extra: 'sign' }
];
export const TEAMS = [{ name: 'RED', col: '#ff3a3a', css: '#ff5a4a' }, { name: 'BLUE', col: '#2a7aff', css: '#4aa0ff' }];

export const MEDALS = {
    first: ['FIRST BLOOD', 100], slide: ['SLIDE KILL', 50], air: ['AIR MAIL', 50], smack: ['SMACK!', 75], homerun: ['HOME RUN!', 150],
    hole: ['HOLE IN ONE', 100], trap: ['RAKE TRAP', 100], revenge: ['REVENGE', 50], road: ['ROAD RAGE', 50], stopper: ['PARTY POOPER', 100],
    double: ['DOUBLE KILL', 50], multi: ['MULTI KILL', 100], mega: ['MEGA KILL', 150], ultra: ['ULTRA KILL', 200],
    spree5: ['KILLING SPREE', 100], spree10: ['RAMPAGE', 200], spree15: ['UNSTOPPABLE', 300], spree20: ['YARD SALE LEGEND', 400]
};
export const KILL_PTS = 100, SUICIDE_PTS = -50;

export const MODES = {
    dm: { name: 'DEATHMATCH', short: 'DM', teams: false, frags: 20, time: 8 },
    duel: { name: 'DUEL', short: '1v1', teams: false, frags: 15, time: 10, max: 2 },
    tdm: { name: 'TEAM DEATHMATCH', short: 'TDM', teams: true, frags: 40, time: 10 }
};
/* Bot skill. react: seconds before shooting a new target; err: how far off the aim wanders, in metres at the target;
   turn: radians a second; strafe/tricks: how much they move about and slide, hop and dodge; lead: how well they
   lead a moving target (1 = perfectly); track: how well they keep on a fast mover; hold: how often they pause firing. */
export const SKILLS = [
    { name: 'EASY', react: 0.85, err: 1.3, turn: 3.0, strafe: 0.25, tricks: 0.02, lead: 0.3, track: 0.25, hold: 0.45 },
    { name: 'NORMAL', react: 0.55, err: 0.8, turn: 4.4, strafe: 0.45, tricks: 0.07, lead: 0.55, track: 0.5, hold: 0.3 },
    { name: 'HARD', react: 0.36, err: 0.5, turn: 6.2, strafe: 0.65, tricks: 0.2, lead: 0.75, track: 0.7, hold: 0.15 },
    { name: 'GODLIKE', react: 0.2, err: 0.28, turn: 9.5, strafe: 0.9, tricks: 0.45, lead: 0.9, track: 0.88, hold: 0.05 }
];

/* ---------- Conquest ---------- */
MODES.conquest = { name: 'CONQUEST', short: 'CQ', teams: true, frags: 0, time: 20, tickets: 150, max: 16, conquest: true };

// what each class carries: weapon -> ammo (true for melee); special: a thing to throw with G
export const CLASSES = [
    { id: 'gardener', name: 'GARDENER', role: 'ASSAULT', kit: { rake: true, blower: 30, balloon: 12 }, armor: 25, desc: 'Rake, leaf blower, water balloons. Tough.' },
    { id: 'coach', name: 'COACH', role: 'SUPPORT', kit: { bat: 20, tennis: 220 }, special: 'ammo', desc: 'Bat and tennis ball machine. G: throw an ammo crate.' },
    { id: 'lifeguard', name: 'LIFEGUARD', role: 'MEDIC', kit: { pistol: 150 }, dual: true, special: 'kit', desc: 'Super soaker. G: throw a first-aid kit.' },
    { id: 'keeper', name: 'GROUNDSKEEPER', role: 'SNIPER', kit: { golf: 22, slicer: true, pistol: 60 }, desc: 'Golf club for long shots, cheese slicer up close.' },
    { id: 'caterer', name: 'CATERER', role: 'ANTI-VEHICLE', kit: { rocket: 16, slicer: true, pistol: 60 }, desc: 'Bottle rockets: triple damage to vehicles.' }
];

/* Vehicles. seats: driver steers (no weapon unless noted), gun seats use their own weapons, turret uses the vehicle's.
   off: seat position from the vehicle's centre (x right, y up, z back); shield: the rider can't be hit. */
export const VEHICLES = {
    cart: {
        name: 'SHOPPING CART', verb: 'ran over', hp: 130, speed: 13, accel: 16, turn: 2.8, grip: 6, w: 0.7, l: 1.1, h: 1.1, respawn: 20,
        seats: [{ driver: true, off: [0, 0, 1.0], push: true }, { gun: true, off: [0, 0.45, -0.1] }]
    },
    mower: {
        name: 'RIDE-ON LAWNMOWER', verb: 'mowed down', hp: 240, speed: 10, accel: 10, turn: 2.3, grip: 9, w: 1.0, l: 1.8, h: 1.2, respawn: 30, blades: true,
        seats: [{ driver: true, off: [0, 0.55, 0.25] }]
    },
    buggy: {
        name: 'GOLF CART', verb: 'ran over', hp: 280, speed: 15, accel: 11, turn: 2.0, grip: 7, w: 1.3, l: 2.4, h: 1.9, respawn: 30,
        seats: [{ driver: true, off: [-0.32, 0.55, -0.1] }, { gun: true, off: [0.32, 0.55, -0.1] }, { gun: true, off: [-0.32, 0.6, 0.85] }, { gun: true, off: [0.32, 0.6, 0.85] }]
    },
    van: {
        name: 'ICE CREAM VAN', verb: 'creamed', hp: 750, speed: 11, accel: 6, turn: 1.3, grip: 8, w: 2.1, l: 4.6, h: 2.6, respawn: 60, jingle: true,
        seats: [{ driver: true, off: [-0.5, 0.9, -1.4], shield: true }, { turret: true, off: [0, 2.3, 0.4], shield: true }]
    }
};
for (const [k, v] of Object.entries(VEHICLES)) v.id = k;

/* ---------- weapon modes and Gun Game: no pickups, infinite ammo, health comes back on its own ---------- */
const ONLY = (name, short, loadout) => ({ name, short, teams: false, frags: 20, time: 8, loadout, noItems: true, regen: true, infinite: true });
MODES.snipers = ONLY('SNIPERS ONLY', 'SNP', ['golf']);
MODES.shotguns = ONLY('SHOTGUNS ONLY', 'SG', ['blower']);
MODES.pistols = ONLY('PISTOLS ONLY', 'PST', ['pistol']);
MODES.rockets = ONLY('ROCKETS ONLY', 'RKT', ['rocket']);
MODES.melee = Object.assign(ONLY('MELEE ONLY', 'MEL', ['slicer', 'rake', 'whip']), { frags: 15 });
// work up the ladder one kill at a time; the last rung is the pool noodle
MODES.gungame = { name: 'GUN GAME', short: 'GG', teams: false, frags: 0, time: 10, noItems: true, regen: true, infinite: true, gungame: true,
    ladder: ['pistol', 'soaker', 'tennis', 'blower', 'balloon', 'bat', 'rocket', 'golf', 'whip', 'slicer', 'noodle'] };
MEDALS.humiliation = ['HUMILIATION', 100];
MEDALS.levelup = ['LEVEL UP', 0];

// one line for the mode cards
const MODE_DESC = {
    dm: 'Everyone for themselves. Pickups on the map; most points wins.', duel: 'One on one, first to the kill limit.',
    tdm: 'Red against blue. Every kill counts for the team.', conquest: 'Hold the flags, drain their tickets. Classes and vehicles.',
    snipers: 'Golf clubs only. No pickups; health comes back.', shotguns: 'Leaf blowers only, up close and loud.',
    pistols: 'Water pistols only. Aim is everything.', rockets: 'Bottle rockets only. Mind your feet.',
    melee: 'Slicers, rakes and whips. Get close.', gungame: 'A new weapon with every kill. First up the ladder wins.'
};
for (const [k, d] of Object.entries(MODE_DESC)) MODES[k].desc = d;
// the regular modes come in two styles
for (const k of ['dm', 'duel', 'tdm']) MODES[k].styles = true;
MODES.conquest.classes = true;
export const STYLES = {
    arena: { name: 'ARENA', desc: 'Unreal style: weapons, health and power-ups lie around the map. Grab what you can.' },
    tactical: { name: 'TACTICAL', desc: 'CoD style: pick a class when you spawn. No pickups, health comes back on its own.' }
};

/* ---------- Tactical: build your own class ---------- */
export const KIT = {
    primary: ['tennis', 'blower', 'golf', 'bat'],
    secondary: ['pistol', 'rocket'],
    melee: ['noodle', 'slicer', 'rake', 'whip'],
    lethal: ['balloon', 'trap'],
    tactical: ['popper', 'powder']
};
export const KIT_SLOTS = [['primary', 'PRIMARY'], ['secondary', 'SECONDARY'], ['melee', 'MELEE'], ['lethal', 'LETHAL · G'], ['tactical', 'TACTICAL · Q']];
export const THROWN = {
    balloon: { name: 'WATER BALLOON', desc: 'A grenade: bursts on impact with a big splash.' },
    trap: { name: 'RAKE TRAP', desc: 'Lay it down; whoever steps on it gets the handle.' },
    popper: { name: 'CONFETTI POPPER', desc: 'A flashbang: blinds anyone looking its way.' },
    powder: { name: 'BABY POWDER', desc: 'A smoke grenade: a thick white cloud to hide in.' }
};
export const DEFAULT_KIT = { primary: 'tennis', secondary: 'pistol', melee: 'slicer', lethal: 'balloon', tactical: 'popper' };
export const randomKit = () => Object.fromEntries(Object.entries(KIT).map(([k, l]) => [k, l[Math.floor(Math.random() * l.length)]]));

/* Synthesised music: a small drum machine with several kits, a handful of bass and lead instruments,
   and every track gets its own genre. All original patterns, written as 16-step bars (melodies as 32 steps). */
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chords as MIDI notes; bass roots an octave or two below
const K = {
    am: { prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], roots: [45, 41, 48, 43] },                 // Am F C G
    fsm: { prog: [[54, 57, 61], [50, 54, 57], [45, 49, 52], [52, 56, 59]], roots: [42, 38, 45, 40] },                // F#m D A E
    em: { prog: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 50, 54]], roots: [40, 36, 38, 35] },                 // Em C D Bm
    dmaj: { prog: [[62, 66, 69], [67, 71, 74], [69, 73, 76], [62, 66, 69]], roots: [38, 43, 45, 38] },               // D G A D
    epent: { prog: [[52, 55, 59], [55, 59, 62], [57, 60, 64], [52, 55, 59]], roots: [40, 43, 45, 40] },              // Em G Am Em
    frost: { prog: [[57, 60, 64, 71], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]], roots: [45, 41, 48, 43] }, // Am9 Fmaj7 Cmaj7 G6
    harb: { prog: [[53, 56, 60], [49, 53, 56], [51, 55, 58], [48, 51, 55]], roots: [41, 37, 39, 36] },               // Fm Db Eb Cm
    gmin: { prog: [[55, 58, 62], [51, 55, 58], [53, 57, 60], [55, 58, 62]], roots: [31, 27, 29, 31] },               // Gm Eb F Gm
    dorian: { prog: [[62, 65, 69], [67, 71, 74], [62, 65, 69], [60, 64, 67]], roots: [38, 43, 38, 36] },             // Dm G Dm C
    cmaj: { prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], roots: [36, 41, 43, 36] },               // C F G C
    cmin: { prog: [[60, 63, 67], [56, 60, 63], [51, 55, 58], [58, 62, 65]], roots: [48, 44, 39, 46] },               // Cm Ab Eb Bb
    amaj: { prog: [[57, 61, 64], [62, 66, 69], [64, 68, 71], [57, 61, 64]], roots: [45, 50, 52, 45] },               // A D E A
    phryg: { prog: [[52, 59, 64], [53, 60, 65], [52, 59, 64], [55, 62, 67]], roots: [28, 29, 28, 31] },              // E5 F5 E5 G5
    lofi: { prog: [[58, 62, 65, 69], [55, 58, 62, 65], [60, 63, 67, 70], [53, 57, 60, 63]], roots: [46, 43, 48, 41] }, // Bbmaj7 Gm7 Cm7 F7
    fmin: { prog: [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]], roots: [41, 37, 44, 39] },               // Fm Db Ab Eb
    funk: { prog: [[55, 58, 62, 65], [55, 58, 62, 65], [60, 64, 67, 70], [55, 58, 62, 65]], roots: [43, 43, 48, 43] } // Gm7 Gm7 C7 Gm7
};
const SC = {
    major: [0, 2, 4, 5, 7, 9, 11, 12, 14, 16], minor: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15], pent: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22],
    insen: [0, 1, 5, 7, 10, 12, 13, 17, 19, 22], hijaz: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16], majpent: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
    dorian: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15], mixo: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16]
};

export const SONGS = {
    menu: {
        bpm: 100, key: K.am, barsPerChord: 2,
        kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', open: '',
        bass: 'x.....x.....x...', arp: '0.1.2.1.0.2.1.2.', arpOct: 12, pad: true, lead: null, filter: 900
    },
    race1: {
        bpm: 128, key: K.am, barsPerChord: 2,
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', open: '..x...x...x...x.',
        bass: 'xxoxxxoxxxoxxxox', arp: '0120120120120121', arpOct: 12, pad: true, lead: 'x..x..x...x..x..', filter: 1400
    },
    race2: {
        bpm: 140, key: K.fsm, barsPerChord: 1,
        kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'xxx.xxx.xxx.xxxx', open: '......x.......x.',
        bass: 'x.xo..x.x.xo..x5', arp: '0.2.1.2.0.2.1.20', arpOct: 24, pad: false, lead: 'x...x..x..x.x...', filter: 1800
    },
    race3: {
        bpm: 132, key: K.em, barsPerChord: 2,
        kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', open: '..x.......x.....',
        bass: 'x.oxx.oxx.oxx.ox', arp: '0.1.2.0.1.2.0.1.', arpOct: 12, pad: true, lead: '..x...x...x.x...', filter: 1200
    },
    results: {
        bpm: 96, key: K.am, barsPerChord: 1,
        kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', open: '',
        bass: 'x.......x.......', arp: '0.1.2.0.1.2.0.1.', arpOct: 12, pad: true, lead: null, filter: 800
    },
    // --- one per track ---
    // Alpine Pass: folk rock, a squeezebox lead over a driving rock kit
    alpine: {
        bpm: 124, key: K.dmaj, barsPerChord: 1, kit: 'rock',
        kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'x...5...x...5.o.', bassType: 'pluck', filter: 1200,
        stab: '..x...x...x...x.', stabType: 'organ',
        mel: '0.2.4.2.4.5.4.2.1.1.3.1.4...2.0.', melType: 'organ', scale: 'major', tonic: 74
    },
    // Red Canyon: a dusty shuffle with a twangy guitar
    canyon: {
        bpm: 108, key: K.epent, barsPerChord: 2, kit: 'rock', swing: 0.28,
        kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', tom: '..............ml',
        bass: 'x..o..x.5..x..o.', bassType: 'pluck', filter: 900,
        mel: '0..2.3.4....3.2.0..2.3..4.6.5...', melType: 'twang', scale: 'pent', tonic: 64
    },
    // Frost Line: glassy bells and a slow, airy break
    frost: {
        bpm: 86, key: K.frost, barsPerChord: 2, kit: 'soft',
        kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x.x.x.', shaker: 'x.x.x.x.x.x.x.x.',
        bass: 'x.......x.......', bassType: 'sub', pad: true,
        arp: '0...2...3...1...', arpOct: 24, arpType: 'bell'
    },
    // Harbour Night: drum and bass, a growling reese under it
    harbour: {
        bpm: 172, key: K.harb, barsPerChord: 2, kit: 'dnb',
        kick: 'x.........x.....', snare: '....x..x.x..x...', hat: 'x.xxx.x.x.xxx.x.', open: '......x.........',
        bass: 'x.......x..x....', bassType: 'reese', filter: 700,
        arp: 'x...............', arpOct: 24, arpType: 'bell', pad: true
    },
    // Mud Bowl Arena: stomp stomp clap, fuzz bass and brass hits
    stadium: {
        bpm: 112, key: K.gmin, barsPerChord: 2, kit: 'big',
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.',
        bass: 'x.x...x.x.x...o.', bassType: 'dist', filter: 1600,
        stab: 'x.....x.........', stabType: 'brass'
    },
    // Jade Jungle: toms, shakers, a marimba and a breathy flute
    jungle: {
        bpm: 118, key: K.dorian, barsPerChord: 2, kit: 'soft',
        kick: 'x.....x...x.....', snare: '', hat: '', shaker: 'xxx.xxx.xxx.xxx.', tom: '..h.m...h.m.l.l.', rim: '....x.......x...',
        bass: 'x.....x...o.....', bassType: 'sub',
        arp: '0.1.2.1.0.2.1.2.', arpOct: 12, arpType: 'marimba',
        mel: '0...2.3.4...3.2.0.......5.4.3.2.', melType: 'flute', scale: 'dorian', tonic: 74
    },
    // Old Town: an oom-pah polka with an accordion tune
    oldtown: {
        bpm: 150, key: K.cmaj, barsPerChord: 1, kit: 'rock',
        kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
        bass: 'x.......5.......', bassType: 'pluck', filter: 1000,
        stab: '....x.......x...', stabType: 'organ',
        mel: '4.5.7.5.4.2.4...3.4.5.4.3.1.0...', melType: 'organ', scale: 'major', tonic: 72
    },
    // Neon District: synthwave, gated snare, big pads
    neon: {
        bpm: 100, key: K.cmin, barsPerChord: 2, kit: 'electro', gated: true,
        kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'xxxxxxxxxxxxxxxx', bassType: 'saw', filter: 900, pad: true,
        arp: '0.1.2.1.0.1.2.1.', arpOct: 12, arpType: 'saw',
        mel: '0...2...3...4.3.2.......0.2.3...', melType: 'square', scale: 'minor', tonic: 72
    },
    // Seaside Cliffs: surf rock, reverb-drenched tremolo guitar
    coast: {
        bpm: 152, key: K.amaj, barsPerChord: 1, kit: 'rock',
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', tom: '............hhml',
        bass: 'x.3.5.3.x.3.5.o.', bassType: 'pluck', filter: 1100,
        mel: '4.4.5.4.2.0.2.4.5.5.7.5.4...2...', melType: 'surf', scale: 'mixo', tonic: 69
    },
    // Volcano Ridge: industrial, chugging distorted bass and metal clanks
    volcano: {
        bpm: 140, key: K.phryg, barsPerChord: 1, kit: 'industrial',
        kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clank: '..x.......x..x..',
        bass: 'xx.xxx.xxx.xxx.x', bassType: 'dist', filter: 2200,
        stab: 'x...............', stabType: 'saw'
    },
    // Autumn Woods: lo-fi hip hop, a dusty electric piano and vinyl crackle
    autumn: {
        bpm: 82, key: K.lofi, barsPerChord: 2, kit: 'soft', swing: 0.22, crackle: true,
        kick: 'x......x..x.....', snare: '', rim: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'x.......x..o....', bassType: 'sub',
        stab: 'x.....x.........', stabType: 'epiano',
        mel: '....4.3.2.......0...2.3.1.......', melType: 'bell', scale: 'major', tonic: 70
    },
    // Airfield: trance, offbeat bass and a supersaw arp
    airfield: {
        bpm: 138, key: K.fmin, barsPerChord: 2, kit: 'electro',
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..x...x...x...x.',
        bass: '..x...x...x...x.', bassType: 'saw', filter: 1500, pad: true,
        arp: '0120120120120120', arpOct: 12, arpType: 'super'
    },
    // Tokyo Expressway: eurobeat, octave bass and a racing saw lead
    tokyo: {
        bpm: 155, key: K.fsm, barsPerChord: 1, kit: 'electro',
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..x...x...x...x.',
        bass: 'xoxoxoxoxoxoxoxo', bassType: 'saw', filter: 1700, pad: true,
        arp: '0120120120120120', arpOct: 24, arpType: 'super',
        mel: '0.2.3.4.3.2.0.2.4.5.4.3.2.0.2.3.', melType: 'saw', scale: 'minor', tonic: 66
    },
    // Moon Base: slow and spacey, bells drifting over a sub bass
    moon: {
        bpm: 84, key: K.frost, barsPerChord: 2, kit: 'soft',
        kick: 'x.........x.....', snare: '', rim: '....x.......x...', shaker: '..x...x...x...x.',
        bass: 'x.......x.......', bassType: 'sub', pad: true,
        arp: '0...1...2...3...', arpOct: 24, arpType: 'bell',
        mel: '0.......4.......3.......2.......', melType: 'bell', scale: 'pent', tonic: 69
    },
    // Crossover: fast punk, power chords and a driving bass
    cross: {
        bpm: 172, key: K.epent, barsPerChord: 1, kit: 'rock',
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', tom: '............hmml',
        bass: 'x.x.x.x.x.x.x.x.', bassType: 'dist', filter: 1800,
        stab: 'x.....x.x.......', stabType: 'saw'
    },
    // Ice Lake: chiptune, square-wave arps and a bright little tune
    icelake: {
        bpm: 140, key: K.dmaj, barsPerChord: 1, kit: 'electro',
        kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'x.x.o.x.x.x.o.x.', bassType: 'pluck', filter: 1400,
        arp: '0120012001200120', arpOct: 12, arpType: 'square',
        mel: '4.4.2.0.2.4.....5.5.4.2.4.......', melType: 'square', scale: 'major', tonic: 74
    },
    // Deep Mine: dark half-time, a growling bass, metal on metal
    mine: {
        bpm: 76, key: K.phryg, barsPerChord: 2, kit: 'industrial',
        kick: 'x.......x..x....', snare: '........x.......', hat: '..x...x...x...x.', clank: '......x.......x.',
        bass: 'x...........x...', bassType: 'reese', filter: 600, pad: true,
        arp: 'x...............', arpOct: 24, arpType: 'bell'
    },
    // Thrill Park: a carnival organ, oom-pah bass and a calliope tune
    park: {
        bpm: 168, key: K.cmaj, barsPerChord: 1, kit: 'rock',
        kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
        bass: 'x.......5.......', bassType: 'pluck', filter: 1000,
        stab: '....x.x.....x.x.', stabType: 'organ',
        mel: '0.2.4.7.6.4.2.4.5.4.2.0.1...0...', melType: 'organ', scale: 'major', tonic: 72
    },
    // Kowloon Rooftops: future funk, chopped and bouncing
    kowloon: {
        bpm: 118, key: K.funk, barsPerChord: 1, kit: 'electro', swing: 0.1,
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', open: '......x.......x.',
        bass: 'x..ox..ox..ox.o.', bassType: 'slap', filter: 1600, pad: true,
        stab: 'x..x..x...x..x..', stabType: 'epiano',
        mel: '4...3.2.....0.2.4...5.4.2.......', melType: 'super', scale: 'dorian', tonic: 67
    },
    // Taipei Night Market: a lazy plucked pentatonic tune over a soft beat
    market: {
        bpm: 98, key: K.am, barsPerChord: 2, kit: 'soft', swing: 0.15,
        kick: 'x......x..x.....', rim: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', shaker: '..x...x...x...x.',
        bass: 'x.......x..o....', bassType: 'sub',
        arp: '0.1.2...0.2.1...', arpOct: 12, arpType: 'marimba',
        mel: '4.3...2.0...2.3.4.......6.4.3...', melType: 'twang', scale: 'majpent', tonic: 69
    },
    // Kyoto Shrines: taiko drums and a koto-like pluck in the in-sen scale
    kyoto: {
        bpm: 92, key: K.am, barsPerChord: 2, kit: 'soft',
        kick: 'x.....x...x.....', snare: '', tom: 'l...m.l.h...m.ll', shaker: '', rim: '........x.......',
        bass: 'x.......x.......', bassType: 'sub',
        mel: '0.1.3...4.3.1...0...5.4.3.1.0...', melType: 'twang', scale: 'insen', tonic: 69
    },
    // Skyway: storm drum and bass, big and dramatic
    skyway: {
        bpm: 174, key: K.fmin, barsPerChord: 2, kit: 'dnb', gated: true,
        kick: 'x.........x.....', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx', open: '......x.........',
        bass: 'x.......x..x....', bassType: 'reese', filter: 900, pad: true,
        arp: '0.2.1.2.0.2.1.2.', arpOct: 24, arpType: 'super'
    },
    // Mirage City: a hijaz melody over hand drums
    mirage: {
        bpm: 124, key: K.phryg, barsPerChord: 1, kit: 'soft',
        kick: 'x.....x...x.....', rim: '..x...x...x.x.x.', tom: 'h.m.h...h.m.l.l.', shaker: 'x.x.x.x.x.x.x.x.',
        bass: 'x..x..x.x..x..x.', bassType: 'pluck', filter: 900,
        mel: '0.1.2.1.0...4.5.4.2.1.0.1.......', melType: 'flute', scale: 'hijaz', tonic: 64
    },
    // Toy Box: a bouncy toy piano and a xylophone
    toybox: {
        bpm: 128, key: K.cmaj, barsPerChord: 1, kit: 'soft',
        kick: 'x.......x.......', rim: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'x...5...x...5.o.', bassType: 'pluck', filter: 1200,
        arp: '0120212001202120', arpOct: 24, arpType: 'marimba',
        mel: '0.2.4.4.5.4.2...0.2.4.2.1.......', melType: 'bell', scale: 'major', tonic: 72
    },
    // --- battle arenas ---
    // Colosseum: war drums and brass fanfares
    colosseum: {
        bpm: 132, key: K.gmin, barsPerChord: 1, kit: 'big',
        kick: 'x.....x.x.......', clap: '....x.......x...', tom: 'l.l.m...l.l.h.hh', hat: '',
        bass: 'x.....x.x...o...', bassType: 'sub',
        stab: 'x.....x.....x.x.', stabType: 'brass',
        mel: '0...2.3.4...3.2.0.......4.5.4...', melType: 'brass', scale: 'minor', tonic: 67
    },
    // Container Yard: dark, slow hip hop with a growling bass
    yard: {
        bpm: 90, key: K.harb, barsPerChord: 2, kit: 'electro', swing: 0.18,
        kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.xxx.x.x.',
        bass: 'x.......x..x....', bassType: 'reese', filter: 700, pad: true,
        arp: '0.......2.......', arpOct: 24, arpType: 'bell'
    },
    // Skate Park: fast ska punk, offbeat organ chops
    skate: {
        bpm: 180, key: K.amaj, barsPerChord: 1, kit: 'rock',
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'x.3.5.3.x.3.5.o.', bassType: 'pluck', filter: 1200,
        stab: '..x...x...x...x.', stabType: 'organ'
    },
    // Lava Crater: a metal chug and a screaming lead
    crater: {
        bpm: 150, key: K.phryg, barsPerChord: 1, kit: 'industrial',
        kick: 'xx..xx..xx..x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
        bass: 'xxx.xxx.xx.xxx.x', bassType: 'dist', filter: 2400,
        mel: '0.1.0...4.3.1.0.................', melType: 'saw', scale: 'hijaz', tonic: 64
    },
    // Ice Rink: bright synth pop with bells
    rink: {
        bpm: 120, key: K.dmaj, barsPerChord: 1, kit: 'electro',
        kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.',
        bass: 'x.x.o.x.x.x.o.x.', bassType: 'saw', filter: 1300, pad: true,
        arp: '0120012001200120', arpOct: 24, arpType: 'bell',
        mel: '4...2.0.2.4.....5...4.2.4.......', melType: 'square', scale: 'major', tonic: 74
    },
    // Free roam: street funk, slap bass, clav and horn hits
    world: {
        bpm: 104, key: K.funk, barsPerChord: 1, kit: 'electro', swing: 0.12,
        kick: 'x.....x...x..x..', snare: '....x..x.x..x...', hat: 'xxxxxxxxxxxxxxxx', open: '..............x.',
        bass: 'x..o..b.x.x.o.5.', bassType: 'slap', filter: 1800,
        stab: '..x...x..x....x.', stabType: 'clav',
        mel: '..........4.3...0.......6.5.4...', melType: 'brass', scale: 'dorian', tonic: 67
    }
};

export class Music {
    constructor(audio) { this.audio = audio; this.on = true; this.song = null; this.name = ''; this.timer = null; }
    setup() {
        const c = this.audio.ctx;
        if (!c || this.bus) return !!c;
        this.bus = c.createGain(); this.bus.gain.value = this.on ? 0.3 : 0; this.bus.connect(this.audio.master);
        // a simple feedback delay for the plucks, bells and leads
        this.delay = c.createDelay(1); this.fb = c.createGain(); this.fb.gain.value = 0.35;
        this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.bus);
        this.noise = this.audio.buf;
        // a soft clipper for the fuzz bass and industrial kick
        this.shaper = c.createWaveShaper();
        const n = 1024, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 4); }
        this.shaper.curve = curve;
        this.shaperOut = c.createGain(); this.shaperOut.gain.value = 0.5;
        this.shaper.connect(this.shaperOut); this.shaperOut.connect(this.bus);
        return true;
    }
    setOn(on) { this.on = on; if (this.bus) this.bus.gain.setTargetAtTime(on ? 0.3 : 0, this.audio.ctx.currentTime, 0.1); }
    play(name) {
        if (name === this.name) return;
        this.name = name;
        clearInterval(this.timer);
        if (!this.setup() || !SONGS[name]) { this.song = null; return; }
        this.song = SONGS[name];
        this.step = 0;
        this.next = this.audio.ctx.currentTime + 0.1;
        this.delay.delayTime.value = (60 / this.song.bpm) * 0.75;
        this.fb.gain.value = this.song.melType === 'surf' ? 0.5 : 0.35;
        this.timer = setInterval(() => this.tick(), 25);
    }
    stop() { this.name = ''; clearInterval(this.timer); this.song = null; }
    // retry once the audio context exists (it only starts after a click or key)
    want(name) { if (!this.audio.ctx) { this.pending = name; return; } this.play(name); }
    poke() { if (this.pending && this.audio.ctx) { const n = this.pending; this.pending = null; this.play(n); } }
    tick() {
        const c = this.audio.ctx, s = this.song;
        if (!s || !c) return;
        const sixteenth = 60 / s.bpm / 4;
        while (this.next < c.currentTime + 0.12) {
            const t = this.next + (this.step % 2 ? (s.swing || 0) * sixteenth : 0);
            this.playStep(this.step, t, sixteenth);
            this.next += sixteenth;
            this.step++;
        }
    }
    playStep(n, t, dt) {
        const s = this.song, k = n % 16, bar = Math.floor(n / 16), kit = s.kit || 'electro';
        const ci = Math.floor(bar / s.barsPerChord) % s.key.prog.length;
        const chord = s.key.prog[ci], root = s.key.roots[ci];
        const on = (p) => p && p[k] === 'x';
        if (on(s.kick)) this.kick(t, kit);
        if (on(s.snare)) this.snare(t, kit, s.gated);
        if (on(s.clap)) this.clap(t);
        if (on(s.rim)) this.rim(t);
        if (on(s.hat)) this.hat(t, kit === 'soft' ? 0.025 : 0.035, kit === 'soft' ? 0.1 : 0.18);
        if (on(s.open)) this.hat(t, 0.14, 0.18);
        if (on(s.shaker)) this.shaker(t);
        if (on(s.clank)) this.clank(t);
        if (s.tom && s.tom[k] && s.tom[k] !== '.') this.tom(t, { h: 220, m: 160, l: 110 }[s.tom[k]] || 160);
        if (s.crackle && Math.random() < 0.5) this.crackle(t);
        const b = s.bass && s.bass[k];
        if (b && b !== '.') {
            const off = { o: 12, 5: 7, 3: chord[1] - chord[0], b: 10 }[b] || 0;
            this.bass(t, midi(root + off), dt * (s.bassType === 'reese' ? 7 : 1.8), s.filter || 1200, s.bassType || 'saw');
        }
        const a = s.arp && s.arp[k];
        if (a && a !== '.') this.lead(t, midi(chord[a === 'x' ? 0 : Math.min(+a, chord.length - 1)] + s.arpOct), dt * 2, s.arpType || 'triangle');
        if (s.pad && k === 0 && bar % s.barsPerChord === 0) chord.forEach((m) => this.pad(t, midi(m), dt * 16 * s.barsPerChord));
        if (on(s.stab)) chord.forEach((m) => this.lead(t, midi(m + (s.stabType === 'brass' || s.stabType === 'clav' ? 12 : 0)), dt * (s.stabType === 'epiano' ? 6 : 1.6), s.stabType, 0.035));
        if (s.lead && s.lead[k] === 'x' && bar % 4 >= 2) this.lead(t, midi(chord[(k / 2) % 3 | 0] + 24), dt * 1.5, 'square', 0.035);
        // the tune comes in on the second half of every eight bars
        if (s.mel && bar % 8 >= 4) {
            const ch = s.mel[(bar % 2) * 16 + k];
            if (ch && ch !== '.') {
                let len = 1; while (s.mel[((bar % 2) * 16 + k + len) % 32] === '.' && len < 4) len++;
                this.lead(t, midi(s.tonic + SC[s.scale][+ch]), dt * (len + 0.5), s.melType, 0.05);
            }
        }
    }
    env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    osc(type, f, t, dur, peak, dest, attack = 0.005) {
        const c = this.audio.ctx, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        this.env(g, t, attack, peak, dur);
        o.connect(g); g.connect(dest || this.bus); o.start(t); o.stop(t + attack + dur + 0.05);
        return o;
    }
    noiseHit(t, type, freq, q, peak, len, dest) {
        const c = this.audio.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
        this.env(g, t, 0.002, peak, len);
        s.connect(f); f.connect(g); g.connect(dest || this.bus); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
    }
    /* ---------- drums ---------- */
    kick(t, kit) {
        if (kit === 'industrial') { const o = this.osc('sine', 170, t, 0.3, 0.9, this.shaper); o.frequency.exponentialRampToValueAtTime(40, t + 0.1); return; }
        const big = kit === 'big', soft = kit === 'soft';
        const o = this.osc('sine', big ? 165 : 150, t, big ? 0.4 : soft ? 0.22 : 0.28, soft ? 0.6 : 0.9);
        o.frequency.exponentialRampToValueAtTime(big ? 36 : 42, t + (big ? 0.16 : 0.12));
        if (kit === 'rock' || big) this.noiseHit(t, 'lowpass', 2500, 0.5, 0.2, 0.012);
    }
    snare(t, kit, gated) {
        const len = gated ? 0.32 : kit === 'rock' ? 0.22 : kit === 'dnb' ? 0.12 : 0.16;
        this.noiseHit(t, 'bandpass', kit === 'rock' ? 1500 : 1900, 0.7, 0.45, len);
        this.osc('triangle', kit === 'dnb' ? 230 : 190, t, 0.08, 0.25);
        if (kit === 'industrial') this.clank(t);
    }
    clap(t) { for (const d of [0, 0.011, 0.022]) this.noiseHit(t + d, 'bandpass', 1200, 1.2, 0.35, d === 0.022 ? 0.14 : 0.01); }
    rim(t) { this.noiseHit(t, 'bandpass', 2600, 3, 0.25, 0.03); this.osc('square', 820, t, 0.025, 0.06); }
    hat(t, len, peak = 0.18) { this.noiseHit(t, 'highpass', 7500, 0.7, peak, len); }
    shaker(t) { this.noiseHit(t, 'highpass', 5200, 0.7, 0.07, 0.05); }
    tom(t, f) { const o = this.osc('sine', f, t, 0.26, 0.5); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.2); }
    clank(t) { for (const f of [520, 747, 1130]) this.osc('square', f, t, 0.09, 0.04); }
    crackle(t) { this.noiseHit(t + Math.random() * 0.05, 'highpass', 3000, 0.7, 0.03 + Math.random() * 0.03, 0.004); }
    /* ---------- bass ---------- */
    bass(t, f, dur, cutoff, type) {
        const c = this.audio.ctx, lp = c.createBiquadFilter(), g = c.createGain(), oscs = [];
        lp.type = 'lowpass';
        const mk = (ty, fr, det = 0) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = fr; o.detune.value = det; oscs.push(o); return o; };
        let peak = 0.42, dest = this.bus;
        if (type === 'sub') { mk('sine', f); mk('triangle', f).detune.value = 1200; lp.frequency.value = 600; peak = 0.5; }
        else if (type === 'pluck') { mk('triangle', f); mk('sawtooth', f); lp.Q.value = 3; lp.frequency.setValueAtTime(cutoff * 1.6, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur * 0.7); }
        else if (type === 'slap') { mk('sawtooth', f); mk('square', f * 2); lp.Q.value = 8; lp.frequency.setValueAtTime(cutoff * 2, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.12); peak = 0.36; }
        else if (type === 'reese') { mk('sawtooth', f, -16); mk('sawtooth', f, 16); lp.frequency.value = cutoff; lp.Q.value = 2; peak = 0.34; }
        else if (type === 'dist') { mk('sawtooth', f); mk('square', f / 2); lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(300, t + dur); dest = this.shaper; peak = 0.5; }
        else { mk('sawtooth', f); mk('square', f / 2); lp.Q.value = 6; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(140, t + dur); }
        this.env(g, t, type === 'reese' ? 0.03 : 0.004, peak, dur);
        oscs.forEach((o) => { o.connect(lp); o.start(t); o.stop(t + dur + 0.08); });
        lp.connect(g); g.connect(dest);
    }
    /* ---------- leads, arps and stabs ---------- */
    lead(t, f, dur, type = 'triangle', vol = 0.06) {
        const c = this.audio.ctx, lp = c.createBiquadFilter(), g = c.createGain(), oscs = [];
        const mk = (ty, fr, det = 0) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = fr; o.detune.value = det; oscs.push(o); return o; };
        let attack = 0.003, wet = true;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
        const vibrato = (rate, depth, delay = 0.08) => {
            const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay + 0.1);
            l.connect(lg); oscs.forEach((o) => lg.connect(o.detune)); l.start(t); l.stop(t + dur + 0.1);
        };
        if (type === 'organ') { mk('square', f, -7); mk('square', f, 7); mk('triangle', f * 2); lp.frequency.cancelScheduledValues(t); lp.frequency.value = 2200; attack = 0.02; vol *= 0.7; vibrato(6, 8, 0); }
        else if (type === 'twang' || type === 'surf') {
            const o1 = mk('sawtooth', f), o2 = mk('square', f, 5);
            for (const o of [o1, o2]) { o.frequency.setValueAtTime(f * 1.06, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); }
            lp.Q.value = 4; lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur + 0.3);
            vol *= 0.8; dur += 0.25;
        }
        else if (type === 'flute') { mk('sine', f); mk('triangle', f * 2).detune.value = 3; attack = 0.06; vol *= 1.1; vibrato(5, 14); this.noiseHit(t, 'bandpass', f * 2, 2, 0.02, 0.08); }
        else if (type === 'bell') { mk('sine', f); const h = mk('sine', f * 2.76); h.detune.value = 0; dur = Math.max(dur, 0.9); vol *= 0.8; }
        else if (type === 'marimba') { mk('sine', f); mk('sine', f * 4); dur = 0.25; vol *= 1.2; wet = false; }
        else if (type === 'brass') { mk('sawtooth', f, -8); mk('sawtooth', f, 8); attack = 0.04; lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.08); lp.frequency.exponentialRampToValueAtTime(900, t + dur); vol *= 0.8; wet = false; }
        else if (type === 'clav') { mk('square', f); mk('sawtooth', f * 2); lp.type = 'bandpass'; lp.Q.value = 2; lp.frequency.cancelScheduledValues(t); lp.frequency.value = 1500; dur = 0.12; wet = false; }
        else if (type === 'epiano') { mk('sine', f); mk('triangle', f * 2).detune.value = 4; attack = 0.008; lp.frequency.cancelScheduledValues(t); lp.frequency.value = 1800; vibrato(4, 6, 0); }
        else if (type === 'super') { mk('sawtooth', f, -14); mk('sawtooth', f); mk('sawtooth', f, 14); vol *= 0.55; }
        else if (type === 'saw') { mk('sawtooth', f, -5); mk('sawtooth', f, 5); vol *= 0.6; }
        else mk(type, f);
        this.env(g, t, attack, vol, dur);
        if (type === 'surf') {      // tremolo, the surf guitar wobble
            const l = c.createOscillator(), lg = c.createGain(), tg = c.createGain();
            l.frequency.value = 9; lg.gain.value = 0.5; tg.gain.value = 0.6; l.connect(lg); lg.connect(tg.gain); l.start(t); l.stop(t + dur + 0.1);
            g.connect(tg); tg.connect(this.bus); tg.connect(this.delay);
        } else { g.connect(this.bus); if (wet) g.connect(this.delay); }
        oscs.forEach((o) => { o.connect(lp); o.start(t); o.stop(t + attack + dur + 0.08); });
        lp.connect(g);
    }
    pluck(t, f, dur, type = 'triangle', vol = 0.06) { this.lead(t, f, dur, type, vol); }
    pad(t, f, dur) {
        const c = this.audio.ctx, lp = c.createBiquadFilter(), g = c.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 1100;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const d of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
        lp.connect(g); g.connect(this.bus);
    }
}

/* heind.nl: all the content lives here. Edit this file to add projects or posts. */
window.SEA = window.SEA || {};

(() => {
    const S = window.SEA;

    // Project links point to the live site, so this page works from anywhere.
    S.HOME = 'https://heind.nl/';
    // Pages that ship with this site stay relative, so they also work when testing locally.
    S.LOCAL = ['subshootica-dx.html'];
    S.link = (p) => (!p || p === '#') ? null : S.LOCAL.includes(p) ? p : new URL(p, S.HOME).href;

    // type: 'human' = handmade, 'partial-ai' = AI-assisted, 'full-ai' = vibe coded, null = no stamp
    S.PROJECTS = [
        { id: 'subshootica', title: 'Subshootica', year: 2024, date: '2024-03-27', img: 'subshootica', type: 'human', featured: true, pin: true,
          desc: "A shmup with GameBoy-style graphics. Find your way through the sea of green and defeat the evil Takoyaki Clan with your trusty green submarine!",
          tech: ['JavaScript', 'HTML5 Canvas'], demo: 'subshootica-dx.html', source: 'https://github.com/Bloxmine/Subshootica',
          post: 'building-subshootica',
          story: ["Subshootica was born from my love of classic GameBoy games and shoot 'em ups. I gave myself strict GameBoy rules: a 4-colour palette of greens, a 160×144 resolution, simple sprites, chiptune audio and very few buttons.",
                  "You pilot a submarine through trickier and trickier waves of enemies, with power-ups, boss fights against the leaders of the evil Takoyaki Clan, and a high score to chase. I drew every sprite in Aseprite; the game itself is vanilla JavaScript on an HTML5 canvas."],
          learned: ['game feel and feedback beat extra features', 'balancing difficulty curves and enemy patterns', 'playtest early, and often', 'constraints make you more creative', 'cutting my big upgrade tree made the game tighter and more fun'] },
        { id: 'ziswell', title: 'Ziswell', year: 2024, date: '2024-03-15', img: 'ziswell', type: 'human', featured: true,
          desc: 'Remember the 90s? Fortune favours the old.',
          tech: ['HTML', 'CSS', 'JavaScript'], demo: 'projects/ziswell/ziswell.html?fromhome' },
        { id: 'dumbphone-finder', title: 'Dumbphone Finder', year: 2025, date: '2025-10-05', img: 'dumbphone', type: 'human', featured: true,
          desc: 'A tool to help you find your perfect phone. With plenty of cool visual flair.',
          tech: ['JavaScript', 'Tailwind CSS'], demo: '/dumbphone', source: 'https://github.com/Bloxmine/dumbphone-finder' },
        { id: 'dummies', title: 'For Dummies, or not?', year: 2025, date: '2025-10-07', img: 'dummies', type: 'human', featured: true,
          desc: "Guess which 'For Dummies' title is real and which one is made up!",
          tech: ['JavaScript', 'CSS'], demo: '/dummies', source: 'https://github.com/Bloxmine/dummies-or-not' },
        { id: 'retro-apps', title: 'Retro Apps', year: 2025, date: '2025-05-10', img: 'retroapps', type: 'human', featured: true,
          desc: 'Miss your inner 2012 hipster? Oldstagram brings back the classic filters and frames from the golden age of Instagram.',
          tech: ['JavaScript', 'Web APIs'], demo: 'apps.html' },
        { id: 'threejs-experiments', title: 'Three.js experiments', year: 2024, date: '2024-04-12', img: 'spitfire', type: 'human', featured: true,
          desc: '3D games, concepts and animations in the browser. Starring one very low-flying Spitfire.',
          tech: ['Three.js', 'WebGL'], demo: 'threejs/spitfire/index.html',
          post: 'getting-started-threejs',
          story: ["Three.js makes WebGL approachable: a scene, a camera and a renderer, and you're drawing in 3D. I've been using it for 3D games, concepts and animations, which all started from one spinning cube."] },
        { id: 'mario-platformer', title: 'Mario Platformer', year: 2024, date: '2024-10-28', img: 'mario', type: 'human', featured: true,
          desc: 'Just a little bit of fun. Mario dances away.',
          tech: ['JavaScript', 'HTML5 Canvas'], demo: 'projects/marioplatformer/index.html', source: 'https://github.com/Bloxmine/thenewmario' },
        { id: 'gifcursors', title: 'GIFcursors', year: 2024, date: '2024-07-15', img: 'cursor', type: 'human', featured: false,
          desc: "Ever wanted Cursormania without the spyware? Here's your chance.",
          tech: ['JavaScript', 'CSS'], source: 'https://github.com/Bloxmine/GIFCursors' },
        { id: 'tikimixer', title: 'Tiki Mixer', year: 2025, date: '2025-10-01', img: 'tiki', type: 'partial-ai', featured: true,
          desc: 'Mix and create your own tropical tiki drinks, virtually. No hangover included.',
          tech: ['JavaScript', 'CSS'], demo: '/tiki', source: 'https://github.com/Bloxmine/tiki-mixer' },
        { id: 'radio', title: 'Radio', year: 2025, date: '2025-12-22', img: 'radio', type: 'partial-ai', featured: true,
          desc: 'A visualiser for online radio stations, with dynamic backgrounds.',
          tech: ['JavaScript', 'Tailwind CSS'], demo: '/radio' },
        { id: 'web-darts', title: 'Web Darts', year: 2024, date: '2024-05-20', img: 'darts', type: 'partial-ai', featured: false,
          desc: "A web version of the classic software aptly named 'Darts', which sadly stopped being maintained.",
          tech: ['JavaScript', 'HTML'], demo: 'darts', source: 'https://github.com/Bloxmine/webdarts' },
        { id: 'portfoliohelper', title: 'Portfolio Assistant', year: 2025, date: '2025-11-14', img: 'portfolioassistant', type: 'full-ai', featured: true,
          desc: 'Analyses your writing against the learning outcomes you put in, using a local LLM, and tells you how well it meets them.',
          tech: ['LLM', 'HTML'], demo: '/portfolioassistant', source: 'https://github.com/Bloxmine/llm-learnhelper',
          post: 'portfolio-assistant',
          story: ["Yes, you could let an LLM write your whole school portfolio, but how much does a model trained on Reddit posts know about you? This assistant takes your learning outcomes and your current draft, and gives feedback like an ever-available (but less vague) teacher: questions and gaps, never rewrites.",
                  "It runs on a local model (I use Gemma 3 12B), so your work stays on your own machine and there are no API costs."],
          learned: ['good feedback asks questions instead of handing out answers', 'I needed fewer feedback rounds each week', 'my portfolio still sounds like me, not like a chatbot'] },
        { id: 'pixelfont', title: 'Pixel Font', year: 2025, date: '2025-09-22', img: 'pixelfont', type: 'full-ai', featured: true,
          desc: 'A generator for retro-style bitmap fonts, for games and digital art.',
          tech: ['JavaScript', 'HTML'], demo: '/pixelfont' },
        { id: 'bottlecaps', title: 'Bottlecaps Pixelart', year: 2025, date: '2025-12-26', img: 'caps', type: 'full-ai', featured: false,
          desc: 'Want to know how many bottlecaps you need to make pixel art?',
          tech: ['Tailwind CSS', 'HTML'], demo: '/caps' },
        { id: 'ketelhuis-ar', title: 'Ketelhuis AR', year: 2026, date: '2026-05-11', img: 'ketelhuis', type: null, featured: false,
          desc: 'Web AR prototype for the Ketelhuis in Steyl: tap the floor to place a 3D model of the old boiler house. Needs a phone camera.',
          tech: ['A-Frame', '8th Wall', 'WebXR'], demo: '/ketelhuis' },
        { id: 'wiziwig', title: 'Wiziwig', year: 2026, date: '2026-01-01', img: 'wiziwig', type: null, featured: false,
          desc: 'A WYSIWYG writing app with a Word-style ribbon, themes, templates and export to HTML, Markdown and more.',
          tech: ['JavaScript', 'HTML', 'CSS'], demo: '/wysiwyg' },
        { id: 'meme-mirror', title: 'Meme Magic Mirror', year: 2026, date: '2026-02-11', img: 'memes', type: null, featured: false,
          desc: 'Strike a pose in front of your webcam and score points. Body and hand tracking with ml5.js, plus a hand-tracking juggling game.',
          tech: ['JavaScript', 'ml5.js'], demo: '/coolmemes', source: 'https://github.com/Bloxmine/coolmemes' },
        { id: 'flipdots', title: 'Flipdots', year: 2025, date: '2025-09-30', img: 'flipdots', type: null, featured: false,
          desc: 'Simulators and tools for an 84×28 flipdot display: scrolling text, clocks, a quiz and a pixel character creator.',
          tech: ['JavaScript', 'Canvas', 'Node.js'], demo: '/flipdots/letters.html', source: 'https://github.com/Bloxmine/node-flipdots',
          post: 'owow',
          story: ["OWOW, a web design studio, has its very own flipdot display: a mechanical screen of just 84×28 dots that click from black to yellow. Our team had 12 weeks to make something for it, and we landed on Pac-Xon, a Pac-Man-flavoured take on the arcade classic Qix: fill 90% of the grid while dodging ghosts.",
                  "I designed a custom 5×5 pixel font, led the visual design and the core game loop, and built a 3D-printed arcade joystick around an ESP32. Playtesting showed people thought it was Snake, so I added an attract mode and a paper manual styled like a photocopied 80s arcade guide. These simulators and tools came out of that project."],
          learned: ['writing Node.js for real, physical hardware', 'test with real people early (they thought it was Snake)', 'better group communication and task delegation', 'a proper set-up guide makes a project outlive the hand-over'] },
        { id: 'llms-let-loose', title: 'LLMs Let Loose', year: 2025, date: '2025-06-01', img: 'lcars', type: null, featured: false,
          desc: "Research project: can a chatbot run my house while I'm away? Written up as a Star Trek LCARS terminal.",
          tech: ['JavaScript', 'LLM'], demo: '/lcars' },
        { id: 'classified', title: 'Classified: The Mystery', year: 2025, date: '2025-03-01', img: 'classified', type: null, featured: false,
          desc: 'A Dutch choice-driven card game. Work with the organisation or secretly against it; the cards you play decide the story.',
          tech: ['JavaScript', 'HTML'], demo: '/dbgame/dbgame/startscreen.html' }
    ];

    S.STAMPS = {
        'human':      { label: 'HANDMADE',    note: 'typed by hand, every bug my own' },
        'partial-ai': { label: 'AI-ASSISTED', note: 'me + a robot co-pilot' },
        'full-ai':    { label: 'VIBE CODED',  note: 'i had the idea, the robot did the typing' }
    };

    S.POSTS = [
        { id: 'owow', date: '2025-12-12', title: 'Heind_ @ OWOW',
          excerpt: "How I built an 8-bit arcade game for a low-res flipdot display, a big mechanical screen that clicks every time a dot flips." },
        { id: 'portfolio-assistant', date: '2025-11-21', title: 'Building a Portfolio Assistant',
          excerpt: "AI that teaches instead of spoonfeeds. Yes, an LLM could write your school portfolio, but how much does a model trained on Reddit know about you?" },
        { id: 'getting-started-threejs', date: '2024-09-20', title: 'Getting Started with Three.js',
          excerpt: 'My journey into 3D on the web, and the key concepts that made it click.' },
        { id: 'building-subshootica', date: '2024-08-25', title: "Building Subshootica",
          excerpt: "The story behind a GameBoy-style submarine shoot 'em up: game design, pixel art and lots of green." }
    ];
    S.postLink = (id) => S.HOME + 'article.html?id=' + encodeURIComponent(id);

    S.TOOLS = [
        { name: 'Affinity', p: 95 }, { name: 'HTML', p: 90 }, { name: 'CSS', p: 80 }, { name: 'Figma', p: 80 },
        { name: 'Linux', p: 80 }, { name: 'JavaScript', p: 70 }, { name: 'Node.js', p: 45 }, { name: 'Three.js', p: 35 }
    ];

    S.MOODS = ['curious.', 'creative.', 'quirky.', 'driven.', 'resourceful.', 'adventurous.', 'passionate.', 'fun.', 'an all-round nerd.', 'slightly damp.'];

    S.CONTACT = {
        email: 'heindijstelbloem@hotmail.com',
        github: 'https://github.com/Bloxmine',
        linkedin: 'https://www.linkedin.com/in/hein-dijstelbloem-9a868424b/',
        photos: 'https://heind.nl/photography.html'
    };

    // Zone metadata: ids match the <section> ids in index.html.
    S.ZONES = {
        surface:  { name: 'surface',  file: 'index.htm' },
        sunlit:   { name: 'sunlit zone',   file: 'sunlit/about_me.htm' },
        twilight: { name: 'twilight zone', file: 'twilight/cargo_hold.htm' },
        midnight: { name: 'midnight zone', file: 'midnight/captains_log.htm' },
        abyss:    { name: 'the abyss',     file: 'abyss/send_a_signal.htm' },
        hadal:    { name: 'hadal zone',    file: 'hadal/the_bottom.htm' }
    };

    // Bub the pufferfish says these when you enter a zone (once per zone).
    S.BUB_ZONE = {
        surface:  "hi! i'm Bub. welcome aboard hein's homepage. scroll down to dive. ↓",
        sunlit:   "this is the sunlit zone. lots of light, lots of fish. that's hein up there in the window.",
        twilight: "the twilight zone. hein keeps all his projects down here. don't ask me why.",
        midnight: "no sunlight below 1000 m. good thing your cursor is a flashlight now.",
        abyss:    "2°C and about 500 atmospheres of pressure. lovely spot to send an email.",
        hadal:    "this is the bottom. nothing lives down here. probably. (try sitting very still...)"
    };

    S.BUB_HINTS = [
        "psst. old cheat codes still work here. ↑ ↑ ↓ ↓ ...",
        "try typing 'kraken'. anywhere. go on.",
        "the sun has a switch. i'm not saying where.",
        "have you tried Special > Empty Trash? no reason.",
        "the address bar knows a secret place. it's a lost city.",
        "the lightning bolt in the Control Strip (bottom left) is a TURBO switch. like on your dad's 486.",
        "there's a message in a bottle floating at the surface.",
        "fish don't like being clicked. do it anyway.",
        "typing 'duck' does exactly what you think.",
        "the windows can be dragged around. hein won't mind.",
        "if you sit still at the very bottom, something might notice.",
        "S.O.S. works in morse too. just type it.",
        "the anchor menu (top left) has a puzzle, a note pad and a calculator. very 1997.",
        "leave the site alone for a minute. something might fly by.",
        "the flipdot display in the midnight zone takes requests.",
        "click a crate to open it up. there's more inside.",
        "in a hurry? View > Skip the Dive turns all of this off."
    ];

    S.BOTTLE_NOTES = [
        "if found, please return to hein. or don't. it's just a bottle.",
        "help, i'm stuck in a portfolio.",
        "to whoever finds this: the konami code works here.",
        "remember to drink water. you're in the ocean, so that should be easy.",
        "S.O.S. = send oceanic snacks.",
        "this bottle: 100% handmade. this note: AI-assisted.",
        "day 41. the fish still won't tell me where they keep the wifi.",
        "you're doing great. keep diving."
    ];

    /* ---------- Ship's Papers (CV) ----------
       Only facts from hein's own site and posts. Empty fields are hidden on the page.
       TODO(hein): fill in lookingFor and cvUrl, and add anything missing. */
    S.CV = {
        name: 'Hein Dijstelbloem',
        rank: 'web developer & designer',
        homePort: 'the Netherlands',
        lookingFor: '',   // e.g. 'an internship from February 2027'
        cvUrl: '',        // e.g. 'files/cv-hein-dijstelbloem.pdf'
        education: [
            { when: '2023 – now', what: 'ICT & Media Design', where: 'Fontys University of Applied Sciences' }
        ],
        voyages: [
            { when: '2025 · 12 weeks', what: 'Pac-Xon for a flipdot display', where: 'OWOW (client project, team)',
              notes: 'led the visual design and the core game loop, designed a 5×5 pixel font, built an ESP32 arcade joystick, wrote the set-up & hand-over guide' }
        ],
        alsoHandy: ['Aseprite', '3D printing', 'ESP32 / microcontrollers', 'local LLMs (Ollama)', 'A-Frame & WebXR', 'ml5.js']
    };

    S.PHOTOS = [
        { id: 'seagull', caption: 'Seagull' }, { id: 'maas', caption: 'Maas' }, { id: 'buddies', caption: 'Buddies' },
        { id: 'jungle', caption: 'Jungle' }, { id: 'camera', caption: 'Camera' }, { id: 'digitalbw', caption: 'Digital B&W' },
        { id: 'meis', caption: 'Meis' }, { id: 'smartphone', caption: 'Smartphone' }
    ];

    S.FLIPDOT_MSGS = ['HELLO, SAILOR!', 'HEIN WAS HERE', 'FLIP FLIP FLIP', 'TYPE SOMETHING BELOW', '84 X 28 DOTS', 'PAC-XON @ OWOW'];

    // The shared guestbook lives in guestbook.php (needs PHP on the server). Without it, entries stay in the visitor's browser.
    S.GUESTBOOK_API = 'guestbook.php';

    S.GUESTBOOK_SEED = [
        { name: 'xX_angler_Xx', msg: 'cool site!! love the lighting', date: '1998-03-14' },
        { name: 'a squid', msg: 'i have 3 hearts and all of them like this page', date: '1999-07-02' },
        { name: 'Bub', msg: 'first!!!1', date: '1997-01-01' },
        { name: 'mysterious whale', msg: 'ooooooOOOOOOooooo', date: '1999-12-31' }
    ];
})();

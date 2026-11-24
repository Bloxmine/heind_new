# Yard Sale Showdown — design list

## Decisions so far
- Up to 8 players over P2P (one player hosts), bots fill empty slots and allow offline play.
- UT-style arsenal: carry everything you pick up, number keys / scroll wheel, every weapon has primary + alt-fire.
- Movement: run, jump, CoD slide, UT double-tap dodge, slide-jump keeps momentum. No double jump, no wall running.
- Style points + medals with callouts.
- Characters are everyday people who grabbed whatever was around.
- Cartoony hits: ragdoll flop, confetti / splashes, no blood.
- Maps inspired by the screenshots, shaped for play.
- Mouse + keyboard and gamepad (with aim assist).
- Same tech and look as Gravel Riot: three.js 0.160, dither shader, low-poly, baked lighting + shadow maps.

## Characters
Janitor, chef, lifeguard, museum guard, gardener, tennis coach, barista, lollipop lady. Team colour on vest / cap / apron.

## Weapons
| Slot | Role (UT equivalent) | Weapon | Primary | Alt-fire |
|---|---|---|---|---|
| 1 | Melee (spawn) | Pool noodle | Fast swats, big knockback, low damage | Overhead whack that launches people |
| 1 | Melee pickup | Cheese slicer | Quick slash combo | Lunge |
| 1 | Melee pickup | Rake | Wide sweep | Drop it on the floor as a trap: whoever steps on it gets smacked in the face |
| 1 | Melee pickup | Whip | Long-reach crack | Grab: pull a player or a pickup toward you |
| 2 | Starter (Enforcer) | Water pistol → Super soaker | Fast stream | Pumped charge blast |
| 3 | Grenades (Bio rifle) | Water balloons | Lob, splash damage | Leaves a puddle: slippery, slides go faster over it |
| 4 | Shotgun (Flak) | Leaf blower | Spray of acorns and gravel | Air blast: pushes players and you (blast-jumping) |
| 5 | Projectile (Shock rifle) | Baseball + bat | Pitch a fastball | Bat swing: hits back incoming projectiles ("Home run!") |
| 6 | Minigun | Tennis ball machine | Fast ball stream, spins up | Slow heavy lobs |
| 7 | Rockets | Cola + mints bottle rockets | Single fizz rocket | Hold to load up to 3 |
| 8 | Sniper | Golf club + golf balls | Hitscan drive, zoom | Chip shot over cover |
| 9 | Super weapon (Redeemer) | RC rally car (Gravel Riot crossover) | Drive it yourself, it blows up in confetti | Detonate early |

## Pickups (floating, respawning like UT)
- **Health:** soda can (+5, goes past 100 up to 199), first-aid kit (+25), whole birthday cake (+100 super health).
- **Armour:** knee pads (+25), bike helmet (+50), swim ring (+100 shield).
- **Power-ups:** hot sauce (double damage), espresso (speed), springy sneakers (high jump), cardboard box (near-invisible while you stand still).
- **Ammo:** one box per weapon, e.g. a bucket of balls or a crate of bottles.

## Modes
- **Duel (1v1)**, **Deathmatch**, **Team Deathmatch**, **CTF**: the flag is the team's garden gnome.

## Style points & medals
Base kill points plus bonuses: Slide kill, Air mail (mid-air kill), Smack (melee kill), Home run (kill with a batted-back projectile), Hole in one (golf headshot), Rake trap, Revenge, First blood, Double / Multi / Mega kill, Killing spree (5 / 10 / 15), Flag capture / return / assist.

## Maps
Each map takes its dither palette from its reference photo (plus 8 accent colours), with baked lighting (lamps, sky light, bounce, AO) and a real-time sun.
1. **Coal Works** (museum_corridors.jpg): orange-lit stairways in a concrete washery. Duel / DM. *Built.*
2. **Mitten Junction** (monumentvalley.jpg): desert crossroads under a sandstone butte, low afternoon sun. Big; DM, TDM and Conquest. *Built.*
3. **Blast Furnace** (steelworks.jpg): rusty furnace with three floors of grating, pipes to run along, an ore-bunker wall. *Built.*
4. **Grand Bazaar** (bazaar.jpg, bazaar_2.jpg): sunny awning street, lantern-lit covered hall, rooftop bridges. *Built.*
5. **Interchange** (highway.jpg): highway decks at night, lamps under every deck, crossroads below. *Built.*
6. **Chalk Cliffs** (coastline.jpg): cliff tops, the arch, the sea stack, the beach. Big; Conquest. *Built.*
7. **Cubicle Farm** (cubicles.jpg): an office after hours under ceiling panels. A long low hall of cubicles with partitions you can jump onto; a two-storey east wing round an atrium with reception, a server room, glass-fronted offices, and upstairs the boss's office, a meeting room and a break room. Small; DM / Duel. *Built.*
8. **Fountain Court** (mall.jpg): a seventies mall on three floors round a skylit atrium: fountain pools and a brass fan sculpture, red-carpet lounges, two escalators crossing the void and one up to a bridge, shops (some shuttered), stairs in both ends. Medium; DM / TDM. *Built.*
9. **Black Pines** (pine.jpg, pine2.jpg): a snowy pine forest at night under low cloud, the town's lights down in the valley. Logging roads loop past a ranger's cabin, a logging yard, a frozen lake with ice-fishing huts, a snowplough depot, and a fire lookout on the ridge. Big; Conquest. *Built.*
10. **Tumble Town** (indoorplayground.jpg, indoorplayground_2.jpg): a soft play centre after closing. Four padded climbing towers on up to three levels, net bridges, safety netting you can shoot through but not walk through, a big and a small ball pit, a yellow slide, a covered tube slide from the top deck, padded stairs, punch bags, a toddler corner and the café. Small; DM / Duel / TDM. *Built.*
11. **The Gallery** (museum.jpg): an idea, not planned yet.

## Conquest (Battlefield-style mode)
- Two teams, up to 16 players (8v8), bots fill the places.
- Capture points (flags): stand in the zone to turn it; more of your team = faster; contested = frozen.
- Tickets: each team starts with a pool; every respawn costs one, and holding more flags drains the other team. 0 tickets = lose.
- Spawn at your HQ or any flag you hold; pick a class every time:
  - **Gardener** (assault): rake, leaf blower, water balloons.
  - **Coach** (support): baseball bat, tennis ball machine; throws ammo crates.
  - **Lifeguard** (medic): pool noodle, super soaker; throws first-aid kits.
  - **Groundskeeper** (sniper): golf club, cheese slicer, water pistol.
  - **Caterer** (anti-vehicle): bottle rockets (extra damage to vehicles), cheese slicer, water pistol.
- Pickups are only health, armour and ammo.
- Vehicles (enter/leave with E):
  - **Shopping cart**: fast, 2 seats; one pushes and steers, the one in the basket shoots.
  - **Ride-on lawnmower**: 1 seat, sturdy; running people over is the weapon.
  - **Golf cart**: 4 seats, the team taxi; passengers shoot.
  - **Ice cream van**: the heavy one; armoured, a soft-serve cannon on the roof for the gunner, a jingle when it comes.

## Tech
- Page `showdown.html`, ES modules in `js/fps/`, reusing the dither/retro post-processing from Gravel Riot.
- Lighting baked into vertex colours / lightmaps at load time, plus a real-time shadow map for players and projectiles.
- P2P via WebRTC with join codes, host-authoritative, client-side prediction for movement.

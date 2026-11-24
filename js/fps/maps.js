/* Every map, in menu order. */
import { COALWORKS } from './map-coalworks.js';
import { VALLEY } from './map-valley.js';
import { STEELWORKS } from './map-steelworks.js';
import { BAZAAR } from './map-bazaar.js';
import { OVERPASS } from './map-overpass.js';
import { COAST } from './map-coast.js';
import { CUBICLES } from './map-cubicles.js';
import { MALL } from './map-mall.js';
import { PINES } from './map-pines.js';
import { SOFTPLAY } from './map-softplay.js';

export const MAPS = [COALWORKS, VALLEY, STEELWORKS, BAZAAR, OVERPASS, COAST, CUBICLES, MALL, PINES, SOFTPLAY];
export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

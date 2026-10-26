// The Egyptian architectural vocabulary (Late and Ptolemaic temple building).
import { registerStyle } from '../../core/build.js';
import { column } from './columns.js';
import { trim, opening } from './trim.js';
import { pylonTower, flagpole, falcon, naos, barque, barqueStand, altar, doorLeaves, palm, wingedDiscObj } from './objects.js';

export const egyptian = {
  column,
  trim,
  opening,
  elements: { pylon_tower: pylonTower },
  objects: { flagpole, falcon, naos, barque, barque_stand: barqueStand, altar, door_leaves: doorLeaves, palm, winged_disc: wingedDiscObj },
};

registerStyle('egyptian', egyptian);

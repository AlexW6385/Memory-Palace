// Worker: builds terrain chunks off the main thread.
import { buildChunk } from '../world/terrain-grid.js';

self.onmessage = (e) => {
  const { id, rect, step } = e.data;
  const c = buildChunk(rect, step);
  self.postMessage({ id, ...c }, [c.position.buffer, c.normal.buffer, c.ground.buffer, c.ground2.buffer, c.road.buffer, c.index.buffer]);
};

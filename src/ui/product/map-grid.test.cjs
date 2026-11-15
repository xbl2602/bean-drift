const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const grid = import(pathToFileURL(path.join(__dirname, 'map-grid.ts')).href);
test('three grid levels: two progressively finer minor intervals retain the 30 degree major grid', async () => {
  const { MAJOR_GRID_STEP_DEG, MINOR_GRID_LEVELS, gridDetailWeights } = await grid;
  assert.equal(MAJOR_GRID_STEP_DEG, 30);
  assert.deepEqual(MINOR_GRID_LEVELS.map(l => l.stepDeg), [10, 1]);
  assert.deepEqual(gridDetailWeights(3), [0, 0]);
  for (let i = 0; i < MINOR_GRID_LEVELS.length; i++) {
    const weights = gridDetailWeights(MINOR_GRID_LEVELS[i].minPixelsPerDegree * 1.21);
    assert.ok(weights[i] > 0.999);
    assert.ok(weights.every((w, j) => j === i || w === 0));
  }
  // The finest interval is reachable within the existing 2D maximum zoom.
  assert.ok(gridDetailWeights(32768 / 360)[1] > 0.5);
});
test('minor grids crossfade continuously and never accumulate more than full intensity', async () => {
  const { gridDetailWeights, MINOR_GRID_LEVELS } = await grid;
  for (let zoom = 0; zoom <= 150; zoom += 0.05) {
    const weights = gridDetailWeights(zoom);
    assert.ok(weights.every(w => Number.isFinite(w) && w >= 0 && w <= 1));
    assert.ok(weights.reduce((a,b) => a+b, 0) <= 1 + 1e-12);
  }
  for (const l of MINOR_GRID_LEVELS) for (const boundary of [l.minPixelsPerDegree, l.minPixelsPerDegree * 1.2]) {
    const a = gridDetailWeights(boundary - 1e-6), b = gridDetailWeights(boundary + 1e-6);
    assert.ok(a.every((w,i) => Math.abs(w-b[i]) < 1e-5));
  }
  assert.deepEqual(gridDetailWeights(NaN), [0,0]);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const timing = import(pathToFileURL(path.join(__dirname, 'handoff-timing.ts')).href);
const WAIT_AT = 4;

test('page not ready yet: animation time follows the clock, then the car waits parked for as long as it takes', async () => {
  const { sceneTimeAt } = await timing;
  assert.equal(sceneTimeAt(0, null, WAIT_AT), 0);
  assert.equal(sceneTimeAt(2.5, null, WAIT_AT), 2.5);
  assert.equal(sceneTimeAt(WAIT_AT, null, WAIT_AT), WAIT_AT);
  assert.equal(sceneTimeAt(500, null, WAIT_AT), WAIT_AT, 'no time limit: stays parked however long the page takes');
});

test('page ready before the car would leave: animation is not slowed down at all', async () => {
  const { sceneTimeAt } = await timing;
  for (const elapsed of [0, 1, 2.9, 3, 4.2, 5.5]) assert.ok(Math.abs(sceneTimeAt(elapsed, 2.9, WAIT_AT) - elapsed) < 1e-9);
});

test('page ready while the car waits: the car leaves from the parked moment, smoothly and without jumping', async () => {
  const { sceneTimeAt } = await timing;
  const readyAt = 6;
  assert.equal(sceneTimeAt(readyAt - 0.001, readyAt, WAIT_AT), WAIT_AT);
  assert.ok(Math.abs(sceneTimeAt(readyAt, readyAt, WAIT_AT) - WAIT_AT) < 1e-9);
  assert.ok(Math.abs(sceneTimeAt(readyAt + 1, readyAt, WAIT_AT) - (WAIT_AT + 1)) < 1e-9);
  let last = -1; // never goes backwards
  for (let t = 0; t < 12; t += 0.05) {
    const now = sceneTimeAt(t, readyAt, WAIT_AT);
    assert.ok(now >= last);
    last = now;
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const ranking = import(pathToFileURL(path.join(__dirname, 'rank-landing-sites.ts')).href);
const sites = ['a', 'b', 'c'].map((id, i) => ({ id, name: `Site ${id}`, latDeg: i, lonDeg: i * 10, createdAt: '2026-11-14T00:00:00Z' }));
const data = (slope, sunlight, earth = 0.5) => ({ scores: { slope, sunlight, earth, ice: 0.2, thermal: 0.6 } });
test('priorities reorder whole site columns while keeping their identity and fixed scores', async () => {
  const { rankLandingSites } = await ranking;
  const analyses = { a: data(0.9, 0.1), b: data(0.2, 0.8), c: data(0.1, 0.2) };
  const slope = rankLandingSites(sites, analyses, ['slope']);
  assert.deepEqual(slope.map((entry) => entry.site.id), ['a', 'b', 'c']);
  const sunlight = rankLandingSites(sites, analyses, ['sunlight']);
  assert.deepEqual(sunlight.map((entry) => entry.site.id), ['b', 'c', 'a']);
  assert.equal(sunlight[0].site.lonDeg, 10);
  assert.equal(sunlight[0].score, 0.8);
  assert.equal(rankLandingSites(sites.slice(0, 2), analyses, ['sunlight'])[0].score, 0.8);
});
test('equal weighting and duplicate priorities do not double-count', async () => {
  const { rankLandingSites } = await ranking;
  const result = rankLandingSites(sites.slice(0, 1), { a: data(0.8, 0.2) }, ['slope', 'sunlight', 'slope']);
  assert.equal(result[0].score, 0.5);
});
test('ties share the top rank with a stable order', async () => {
  const { rankLandingSites } = await ranking;
  const result = rankLandingSites(sites, { a: data(0.8, 0), b: data(0.8, 1), c: data(0.3, 0) }, ['slope']);
  assert.deepEqual(result.map((entry) => entry.rank), [1, 1, 3]);
  assert.deepEqual(result.map((entry) => entry.site.id), ['a', 'b', 'c']);
});
test('no selected priorities means no ranking or invented best site', async () => {
  const { rankLandingSites } = await ranking;
  const result = rankLandingSites(sites, { a: data(0.2, 0), b: data(1, 1), c: data(0.8, 0) }, []);
  assert.deepEqual(result.map((entry) => entry.site.id), ['a', 'b', 'c']);
  assert(result.every((entry) => entry.rank === null && entry.score === null));
});
test('missing, failed and non-finite data are excluded from ranking', async () => {
  const { rankLandingSites } = await ranking;
  const result = rankLandingSites(sites, { a: 'error', c: data(0.7, 0.8) }, ['slope']);
  assert.equal(result[0].site.id, 'c');
  assert.deepEqual(result.map((entry) => entry.state), ['ready', 'error', 'loading']);
  assert(result.slice(1).every((entry) => entry.rank === null));
  assert.equal(rankLandingSites([sites[0]], { a: data(NaN, 1) }, ['slope'])[0].state, 'error');
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const model = import(pathToFileURL(path.join(__dirname, 'analysis-model.ts')).href);
const weights = { slope: 1, sunlight: 1, earth: 1, ice: 1, thermal: 1 };
test('observational night cycle cools from dusk to dawn rather than using one night temperature', async () => {
  const { diurnalTemperatureK } = await model;
  assert.ok(Math.abs(diurnalTemperatureK(Math.PI / 2, 1) - 130) < 1e-9);
  assert.ok(Math.abs(diurnalTemperatureK(3 * Math.PI / 2, 1) - 95) < 1e-9);
  const quarters = [0, 0.25, 0.5, 0.75, 1].map(f => diurnalTemperatureK(Math.PI / 2 + f * Math.PI, 1));
  assert.ok(quarters.every((t, i) => i === 0 || t < quarters[i - 1]));
  for (let i = 0; i <= 200; i++) {
    const t = diurnalTemperatureK(Math.PI / 2 + i / 200 * Math.PI, 1);
    // Rounded published coefficients have a sub-0.1 K pre-dawn ripple.
    assert.ok(t >= 94.9 && t <= 130.01);
  }
});
test('cycle joins continuously at dawn, dusk and the local-noon longitude wrap', async () => {
  const { diurnalTemperatureK } = await model;
  for (const c of [0, 0.1, 0.5, 1]) for (const join of [0, Math.PI / 2, 3 * Math.PI / 2, Math.PI * 2]) {
    assert.ok(Math.abs(diurnalTemperatureK(join - 1e-10, c) - diurnalTemperatureK(join + 1e-10, c)) < 0.01);
  }
  for (const phase of [-20, -1, 0, 1, 20]) assert.ok(Math.abs(diurnalTemperatureK(phase, 0.7) - diurnalTemperatureK(phase + Math.PI * 2, 0.7)) < 1e-9);
});
test('radiance-averaged facets stay bounded and permanent shadow remains cold', async () => {
  const { computeSiteMetrics, thermalTemperatureK, THERMAL_FACETS } = await model;
  assert.ok(Math.abs(THERMAL_FACETS.reduce((sum, f) => sum + f[1], 0) - 1) < 1e-12);
  const suns = Array.from({ length: 24 }, (_, i) => [Math.cos(i * Math.PI / 12), Math.sin(i * Math.PI / 12), 0]);
  for (const lat of [-89, -70, 0, 70, 89]) for (let i = 0; i <= 48; i++) {
    const rad = lat * Math.PI / 180, lon = i * Math.PI / 24;
    const up = [Math.cos(rad) * Math.cos(lon), Math.cos(rad) * Math.sin(lon), Math.sin(rad)];
    const point = { latDeg: lat, up, normal: up, slopeDeg: 0, polar: null };
    const result = computeSiteMetrics(point, [1, 0, 0], suns, weights);
    assert.ok(result.temperatureNowK >= 55 && result.temperatureNowK <= 392);
    assert.ok(result.temperatureNowK <= result.maxTemperatureK + 1e-6);
    assert.equal(thermalTemperatureK(point, [1, 0, 0], 1), 55);
  }
});
test('resolved slope affects temperature without a globe-wide horizon clipping jump', async () => {
  const { thermalTemperatureK } = await model;
  const point = { latDeg: 0, up: [1, 0, 0], normal: [Math.SQRT1_2, Math.SQRT1_2, 0], slopeDeg: 45, polar: null };
  const sun = x => [x, Math.sqrt(1 - x * x), 0];
  for (const horizon of [-0.00466, 0, 0.00466]) assert.ok(Math.abs(thermalTemperatureK(point, sun(horizon - 1e-8), 0) - thermalTemperatureK(point, sun(horizon + 1e-8), 0)) < 0.01);
  assert.notEqual(thermalTemperatureK(point, [1, 0, 0], 0), thermalTemperatureK({ ...point, normal: point.up, slopeDeg: 0 }, [1, 0, 0], 0));
});

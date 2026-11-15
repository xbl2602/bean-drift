const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '../../..', name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { pointVisualSchema, timelineVisualSchema, comparisonPoints, percent } = require('../ui/visual-data.ts');
const { TOOLS } = require('../../../core/registry.ts');
const { runAgent } = require('../logic/run-agent.ts');
const { findFeaturesForPromptCoordinates } = require('../logic/gazetteer.ts');
const { nearbyMapSchema, projectNearby } = require('../logic/nearby-map.ts');
const run = (name, input) => { const tool = TOOLS.find(tool => tool.name === name); return tool.run(tool.inputSchema.parse(input)); };

test('visuals accept actual point and timeline responses, preserving periods and values', () => {
  const position = { latDeg: -89.9, lonDeg: 0, time: '2030-01-01T00:00:00Z' };
  const point = run('get_point_conditions', position);
  const parsed = pointVisualSchema.parse(point);
  assert.equal(parsed.yearStats.sun.visibleFraction, point.yearStats.sun.visibleFraction);
  assert.equal(parsed.yearStats.periodStartUtc, point.yearStats.periodStartUtc);
  const timeline = run('get_point_timeline', { ...position, durationH: 336 });
  assert.deepEqual(timelineVisualSchema.parse(timeline).both.windows, timeline.both.windows);
  assert.equal(comparisonPoints({ results: [point, point] }).length, 2);
  assert.deepEqual(comparisonPoints({ results: [point, {}] }), []);
});

test('unknown is not zero and invalid numeric data is not drawn', () => {
  assert.equal(percent(null), 'Unavailable');
  assert.equal(percent(0), '0.0%');
  const point = run('get_point_conditions', { latDeg: 0, lonDeg: 0 });
  point.yearStats.sun.visibleFraction = null;
  assert.equal(pointVisualSchema.parse(point).yearStats.sun.visibleFraction, null);
  point.yearStats.sun.visibleFraction = 2;
  assert.equal(pointVisualSchema.safeParse(point).success, false);
});

test('timeline rejects reversed ranges and windows outside the displayed period', () => {
  const timeline = run('get_point_timeline', { latDeg: 0, lonDeg: 0, time: '2030-01-01T00:00:00Z', durationH: 24 });
  assert.equal(timelineVisualSchema.safeParse({ ...timeline, endUtc: timeline.startUtc }).success, false);
  timeline.sun.windows = [{ startUtc: '2020-01-01T00:00:00Z', endUtc: timeline.endUtc, durationH: 24 }];
  assert.equal(timelineVisualSchema.safeParse(timeline).success, false);
});

test('surroundings reach the response even when the model makes no calculation call', async () => {
  const message = 'At 18.00°N 82.80°E what will surround me?';
  const result = await runAgent({ message }, { tools: TOOLS, signal: new AbortController().signal,
    complete: async () => ({ content: 'Nearby landmarks.', toolCalls: [] }) });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].tool, 'lunar_gazetteer');
  const data = nearbyMapSchema.parse(result.sources[0].result);
  assert.deepEqual(data.locations[0].queryCoord, { latDeg: 18, lonDeg: 82.8 });
  assert.deepEqual(data.locations, findFeaturesForPromptCoordinates(message));
  assert.ok(data.locations[0].nearbyFeatures.some(feature => feature.name === 'Cannon'));
});

test('coordinate parser accepts labels, deduplicates, bounds output and ignores invalid latitude', () => {
  assert.equal(findFeaturesForPromptCoordinates('18°N 82.8°E; latitude 18, longitude 82.8').length, 1);
  assert.equal(findFeaturesForPromptCoordinates('latitude -18, longitude -82.8')[0].queryCoord.latDeg, -18);
  assert.equal(findFeaturesForPromptCoordinates('91°N 0°E').length, 0);
  assert.equal(findFeaturesForPromptCoordinates('18°N 82°E 19°N 82°E 20°N 82°E 21°N 82°E 22°N 82°E').length, 4);
});

test('local map projection preserves cardinal direction and wraps the date line', () => {
  const origin = { latDeg: 0, lonDeg: 0 };
  const east = projectNearby(origin, { latDeg: 0, lonDeg: 1 });
  const north = projectNearby(origin, { latDeg: 1, lonDeg: 0 });
  assert.ok(east.eastKm > 30 && Math.abs(east.northKm) < 1e-6);
  assert.ok(north.northKm > 30 && Math.abs(north.eastKm) < 1e-6);
  assert.equal(projectNearby(origin, origin).distanceKm, 0);
  const wrap = projectNearby({ latDeg: 0, lonDeg: 179 }, { latDeg: 0, lonDeg: -179 });
  assert.ok(wrap.eastKm > 60 && wrap.eastKm < 61);
  assert.ok(Number.isFinite(projectNearby({ latDeg: 90, lonDeg: 0 }, { latDeg: 89, lonDeg: 90 }).northKm));
});

test('gazetteer source leaves at most seven tool executions and keeps eight-source response limit', async () => {
  let round = 0;
  const tool = { name: 'list_presets', access: 'read', description: '', inputSchema: require('zod').z.object({}), run: () => ({ presets: [] }) };
  const result = await runAgent({ message: '18°N 82.8°E' }, { tools: [tool], signal: new AbortController().signal,
    complete: async () => round++ === 0 ? { content: '', toolCalls: Array.from({ length: 7 }, (_, i) => ({ id: `source-${i}`, name: 'list_presets', arguments: {} })) } : { content: 'Done', toolCalls: [] } });
  assert.equal(result.sources.length, 8);
  assert.equal(result.sources[0].tool, 'lunar_gazetteer');
  assert.equal(nearbyMapSchema.safeParse({ locations: [{ queryCoord: { latDeg: 0, lonDeg: 0 }, nearbyFeatures: [] }] }).success, true);
  assert.equal(nearbyMapSchema.safeParse({ locations: [{ queryCoord: { latDeg: 91, lonDeg: 0 }, nearbyFeatures: [] }] }).success, false);
});

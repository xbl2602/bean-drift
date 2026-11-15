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

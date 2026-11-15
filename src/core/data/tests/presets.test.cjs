// 预设点位的数据检查：格式、唯一性、出处，以及两份独立来源互相对得上（防止经度换算抄错）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('./load-typescript-for-tests.cjs');
installTypescriptLoader();
const { listPresets } = require('../presets.ts');

const MOON_RADIUS_KM = 1737.4;
const byId = (id) => listPresets().find((preset) => preset.id === id);

/** 两点的大圆距离（km）。 */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latDeg - a.latDeg) * rad;
  const dLon = (b.lonDeg - a.lonDeg) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latDeg * rad) * Math.cos(b.latDeg * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.sqrt(h));
}

test('every preset has a unique kebab-case id, a valid kind, a position in range and a source', () => {
  const presets = listPresets();
  const ids = new Set();
  for (const preset of presets) {
    assert.match(preset.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${preset.id}`);
    assert.ok(!ids.has(preset.id), `duplicate id ${preset.id}`);
    ids.add(preset.id);
    assert.ok(['landing-site', 'place'].includes(preset.kind), `${preset.id}: bad kind`);
    assert.ok(preset.position.latDeg >= -90 && preset.position.latDeg <= 90, `${preset.id}: latitude out of range`);
    assert.ok(preset.position.lonDeg >= -180 && preset.position.lonDeg <= 180, `${preset.id}: longitude out of range`);
    for (const field of ['name', 'nameZh', 'description', 'positionSource']) {
      assert.ok(preset[field].trim().length > 0, `${preset.id}: empty ${field}`);
    }
  }
});

test('named features from the IAU gazetteer say they are not landing targets', () => {
  const features = listPresets().filter((preset) => preset.kind === 'place' && preset.positionSource.includes('IAU Gazetteer'));
  assert.ok(features.length >= 15, 'expected the south polar named features');
  for (const preset of features) assert.match(preset.description, /not a landing target/, preset.id);
});

test('the list stays under the 50 entries the AI answer card can draw', () => {
  // src/features/agent-search/ui/visual-data.ts 的 presetsVisualSchema 最多收 50 个；超过的话 AI 的预设点位卡片会整张不显示。
  assert.ok(listPresets().length <= 50, `${listPresets().length} presets`);
});

test('there are many south polar presets, both places and landing sites', () => {
  const polar = listPresets().filter((preset) => preset.position.latDeg <= -80);
  assert.ok(polar.filter((preset) => preset.kind === 'place').length >= 18);
  const polarLandings = polar.filter((preset) => preset.kind === 'landing-site').map((preset) => preset.id);
  assert.deepEqual(polarLandings.sort(), ['im-1-odysseus', 'im-2-athena']);
});

test('LROC-table landers agree with the independent NASA Apollo positions (longitude conversion is right)', () => {
  // Surveyor 3 就在阿波罗 12 号登月舱旁边（约 160 m）；勘测者 5 号离阿波罗 11 号约 25 km。两份来源互不相干，对得上才说明经度换算没抄错。
  const surveyor3ToApollo12 = distanceKm(byId('surveyor-3').position, byId('apollo-12').position);
  assert.ok(surveyor3ToApollo12 > 0.1 && surveyor3ToApollo12 < 0.25, `Surveyor 3 is ${surveyor3ToApollo12} km from Apollo 12`);
  const surveyor5ToApollo11 = distanceKm(byId('surveyor-5').position, byId('apollo-11').position);
  assert.ok(surveyor5ToApollo11 > 23 && surveyor5ToApollo11 < 27, `Surveyor 5 is ${surveyor5ToApollo11} km from Apollo 11`);
});

test('IM-2 sits within a few hundred metres of the site LROC named as its target', () => {
  const targetFromLroc = { latDeg: -84.78, lonDeg: 29.13 };
  const offsetKm = distanceKm(byId('im-2-athena').position, targetFromLroc);
  assert.ok(offsetKm < 1.5, `IM-2 is ${offsetKm} km from its intended site`);
});

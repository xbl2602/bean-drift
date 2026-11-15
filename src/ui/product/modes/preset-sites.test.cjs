// "Landing Sites" 模式的点位清单检查：产品页读 /api/presets 之后，
// chanjy0806 的 25 个任务、载人/无人筛选、按日期排序都还在，介绍文字没有因为 id 写错而悄悄丢掉。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('../../../core/data/tests/load-typescript-for-tests.cjs');
installTypescriptLoader();
const { listPresets } = require('../../../core/data/presets.ts');
const { loadPresetSites, filterLandingSites, nearestSite, MISSION_NOTE_IDS } = require('./preset-sites.ts');

const APOLLO = ['apollo-11', 'apollo-12', 'apollo-14', 'apollo-15', 'apollo-16', 'apollo-17'];
// 产品页原来手写清单里的 25 个成功软着陆任务（现在全部来自后端预设）
const ORIGINAL_25 = [
  ...APOLLO,
  'luna-9', 'luna-13', 'luna-16', 'luna-17', 'luna-20', 'luna-21', 'luna-24',
  'surveyor-1', 'surveyor-3', 'surveyor-5', 'surveyor-6', 'surveyor-7',
  'chang-e-3', 'chang-e-4', 'chang-e-5', 'chang-e-6', 'chandrayaan-3', 'slim', 'blue-ghost-1',
];

async function loadSites() {
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ presets: listPresets() }) });
  return loadPresetSites();
}

test('all 25 landing sites of the original list are still there, each with a date, an agency and a crewed/robotic class', async () => {
  const sites = await loadSites();
  for (const id of ORIGINAL_25) {
    const site = sites.find((entry) => entry.id === id);
    assert.ok(site, `${id} missing from the list`);
    assert.equal(site.kind, 'landing-site', id);
    assert.ok(site.landedUtc && site.agency, `${id}: no date or agency`);
    assert.equal(site.crew, APOLLO.includes(id) ? 'human' : 'robotic', id);
  }
});

test('every mission note belongs to a real preset (a wrong id would silently drop the text)', () => {
  const ids = new Set(listPresets().map((preset) => preset.id));
  for (const id of MISSION_NOTE_IDS) assert.ok(ids.has(id), `note for unknown preset id ${id}`);
});

test('the crewed filter shows exactly the six Apollo landings; places only appear under "all"', async () => {
  const sites = await loadSites();
  assert.deepEqual(filterLandingSites(sites, 'human').map((site) => site.id).sort(), [...APOLLO].sort());
  assert.ok(filterLandingSites(sites, 'robotic').every((site) => site.kind === 'landing-site'));
  assert.ok(filterLandingSites(sites, 'all').some((site) => site.kind === 'place'));
  assert.ok(sites.filter((site) => site.kind === 'place').every((site) => site.crew === null));
});

test('real landing sites are listed by landing date, then the south polar places', async () => {
  const sites = await loadSites();
  const missions = sites.filter((site) => site.kind === 'landing-site');
  const dates = missions.map((site) => site.landedUtc);
  assert.deepEqual(dates, [...dates].sort());
  assert.deepEqual(sites.slice(0, missions.length), missions, 'places must come after all missions');
});

test('clicking the map picks the nearest site within the radius, and nothing far away', async () => {
  const sites = await loadSites();
  const apollo11 = sites.find((site) => site.id === 'apollo-11');
  assert.equal(nearestSite(sites, { latDeg: apollo11.latDeg + 0.2, lonDeg: apollo11.lonDeg + 0.2 }, 3)?.id, 'apollo-11');
  assert.equal(nearestSite(sites, { latDeg: 60, lonDeg: 150 }, 3), null);
});

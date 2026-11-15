// 基线测试：点位、多时刻、时间线、找位置的完整输出，必须和"录下来的基线"逐字相同。
// 两份基线（怎么录、什么时候才该重录，见 record-point-output-baseline.cjs）：
//   point-output.baseline.json        全月数据那条路（80°S 以北的探测点 + 找位置）。极区数据接入【之前】录的，一直没重录：
//                                     极区数据是新增的，不许影响它。这份能通过，就证明"全月那条路一个数都没变"。
//   point-output-polar.baseline.json  极区 160 m 数据那条路（80°S 以南，含 80°S 的探测点）。接入后录的，防止以后误改。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot } = require('./load-typescript-for-tests.cjs');
const { computeProbeOutputs, PROBES, isPolarProbe } = require('./point-output-probes.cjs');

const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));
const globalBaseline = readJson(__dirname, 'baselines', 'point-output.baseline.json');
const polarBaseline = readJson(__dirname, 'baselines', 'point-output-polar.baseline.json');
const manifest = readJson(repoRoot, 'public', 'data', 'v1', 'manifest.json');
const polarManifest = readJson(repoRoot, 'public', 'data', 'polar-v1', 'manifest.json');

test('the baselines were recorded from the same data files that are in the repo now', () => {
  assert.equal(
    manifest.generatedUtc, globalBaseline.meta.manifestGeneratedUtc,
    'public/data/v1 was regenerated after the baseline was recorded. If that was on purpose, re-record: node src/core/data/tests/record-point-output-baseline.cjs',
  );
  assert.equal(
    polarManifest.generatedUtc, polarBaseline.meta.polarManifestGeneratedUtc,
    'public/data/polar-v1 was regenerated after the polar baseline was recorded. If that was on purpose, re-record: node src/core/data/tests/record-point-output-baseline.cjs',
  );
});

const actual = computeProbeOutputs();
const polarNames = new Set(PROBES.filter(isPolarProbe).map((probe) => probe.name));

/** 某个探测点的名字属于哪份基线（找位置没有"点名"，只属于全月那份）。 */
const ownedBy = (section, name) => (section === 'siteSearches' ? 'global' : polarNames.has(name) ? 'polar' : 'global');

test('between them the two baselines contain exactly the probes the code evaluates', () => {
  for (const [section, entries] of Object.entries(actual)) {
    const recorded = [...Object.keys(globalBaseline[section] ?? {}), ...Object.keys(polarBaseline[section] ?? {})].sort();
    assert.deepEqual(Object.keys(entries).sort(), recorded, `probe list of "${section}" differs from the baselines`);
  }
});

for (const [label, baseline, owner] of [['global', globalBaseline, 'global'], ['polar', polarBaseline, 'polar']]) {
  for (const [section, entries] of Object.entries(baseline)) {
    if (section === 'meta') continue;
    for (const [name, expected] of Object.entries(entries)) {
      test(`${label} baseline: ${section} / ${name} is unchanged`, () => {
        assert.equal(ownedBy(section, name), owner, `${section} / ${name} is in the wrong baseline file`);
        assert.deepStrictEqual(actual[section][name], expected);
      });
    }
  }
}

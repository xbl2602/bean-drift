// 基线测试：点位、多时刻、时间线、找位置的完整输出，必须和"改动前录下来的基线"逐字相同。
// 目的：以后动"按位置选数据源"的代码时，全月那条路的输出一个数都不许变；极区新数据是新增的，不能影响它。
// 运行：npm test。基线怎么来的、什么时候才该重录，见 record-point-output-baseline.cjs。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot } = require('./load-typescript-for-tests.cjs');
const { computeProbeOutputs } = require('./point-output-probes.cjs');

const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baselines', 'point-output.baseline.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'data', 'v1', 'manifest.json'), 'utf8'));

test('baseline was recorded from the same data files that are in the repo now', () => {
  assert.equal(
    manifest.generatedUtc, baseline.meta.manifestGeneratedUtc,
    'public/data/v1 was regenerated after the baseline was recorded. If that was on purpose, re-record: node src/core/data/tests/record-point-output-baseline.cjs',
  );
});

const actual = computeProbeOutputs();

test('the code evaluates exactly the probes the baseline contains', () => {
  for (const [section, entries] of Object.entries(baseline)) {
    if (section === 'meta') continue;
    assert.deepEqual(Object.keys(actual[section] ?? {}), Object.keys(entries), `probe list of "${section}" differs from the baseline`);
  }
});

for (const [section, entries] of Object.entries(baseline)) {
  if (section === 'meta') continue;
  for (const [name, expected] of Object.entries(entries)) {
    test(`${section} / ${name} is unchanged`, () => assert.deepStrictEqual(actual[section][name], expected));
  }
}

// 录制"基线"：用【当前代码和当前 public/data/v1】算一遍探测点的完整输出，写进 baselines/point-output.baseline.json。
// 用法：node src/core/data/tests/record-point-output-baseline.cjs
//
// 什么时候才该重录：你【有意】重新生成了 public/data/v1（npm run data），或有意改变了点位接口的输出。
// 重录前先搞清楚为什么基线测试失败：如果是"改了代码之后输出变了"，那是 bug，不是该重录的理由。
// 这个文件不以 .test.cjs 结尾，所以 npm test 不会运行它。
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot } = require('./load-typescript-for-tests.cjs');
const { computeProbeOutputs, EVALUATED_AT_MS, PROBES, isPolarProbe } = require('./point-output-probes.cjs');

// 两份基线：全月数据负责的探测点 + 找位置，和极区数据（80°S 以南）负责的探测点。
//   point-output.baseline.json        全月那条路。极区数据接入前录的；极区探测点不在其中。它们的输出必须一个数都不变。
//   point-output-polar.baseline.json  极区那条路（160 m 数据）。接入极区数据后录的。
const BASELINE_FILE = path.join(__dirname, 'baselines', 'point-output.baseline.json');
const POLAR_BASELINE_FILE = path.join(__dirname, 'baselines', 'point-output-polar.baseline.json');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'data', 'v1', 'manifest.json'), 'utf8'));
const polarManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'data', 'polar-v1', 'manifest.json'), 'utf8'));

const all = computeProbeOutputs();
const polarNames = new Set(PROBES.filter(isPolarProbe).map((probe) => probe.name));
/** 取出一部分探测点的输出；找位置（siteSearches）只属于全月那份。 */
const pick = (wantPolar) => Object.fromEntries(
  Object.entries(all).map(([section, entries]) => [
    section,
    section === 'siteSearches' ? (wantPolar ? {} : entries) : Object.fromEntries(Object.entries(entries).filter(([name]) => polarNames.has(name) === wantPolar)),
  ]).filter(([, entries]) => Object.keys(entries).length > 0),
);

const baseline = {
  meta: {
    note: 'Recorded output of the point, timeline and site-search functions before the data-source seam work. Regenerate only on purpose.',
    manifestVersion: manifest.version,
    manifestGeneratedUtc: manifest.generatedUtc,
    evaluatedAtUtc: new Date(EVALUATED_AT_MS).toISOString(),
  },
  ...pick(false),
};
const polarBaseline = {
  meta: {
    note: 'Recorded output of the probes south of and on 80 S, which the polar 160 m source answers. Regenerate only on purpose.',
    polarManifestVersion: polarManifest.version,
    polarManifestGeneratedUtc: polarManifest.generatedUtc,
    manifestGeneratedUtc: manifest.generatedUtc,
    evaluatedAtUtc: new Date(EVALUATED_AT_MS).toISOString(),
  },
  ...pick(true),
};

/** 每个探测点一行：文件小、git 差异能看出是哪个点变了。 */
function formatBaseline(value) {
  const sections = Object.entries(value);
  const lines = ['{'];
  sections.forEach(([section, content], sectionIndex) => {
    const sectionComma = sectionIndex < sections.length - 1 ? ',' : '';
    if (section === 'meta') { lines.push(` ${JSON.stringify(section)}: ${JSON.stringify(content)}${sectionComma}`); return; }
    lines.push(` ${JSON.stringify(section)}: {`);
    const entries = Object.entries(content);
    entries.forEach(([key, entry], entryIndex) => lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(entry)}${entryIndex < entries.length - 1 ? ',' : ''}`));
    lines.push(` }${sectionComma}`);
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
for (const [file, content] of [[BASELINE_FILE, baseline], [POLAR_BASELINE_FILE, polarBaseline]]) {
  fs.writeFileSync(file, formatBaseline(content));
  for (const [section, entries] of Object.entries(content)) if (section !== 'meta') console.log(`${path.basename(file)} ${section}: ${Object.keys(entries).length} 条`);
  console.log(`已写入 ${path.relative(repoRoot, file)}（${(fs.statSync(file).size / 1024).toFixed(0)} KB）`);
}

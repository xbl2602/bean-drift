// 录制"基线"：用【当前代码和当前 public/data/v1】算一遍探测点的完整输出，写进 baselines/point-output.baseline.json。
// 用法：node src/core/data/tests/record-point-output-baseline.cjs
//
// 什么时候才该重录：你【有意】重新生成了 public/data/v1（npm run data），或有意改变了点位接口的输出。
// 重录前先搞清楚为什么基线测试失败：如果是"改了代码之后输出变了"，那是 bug，不是该重录的理由。
// 这个文件不以 .test.cjs 结尾，所以 npm test 不会运行它。
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot } = require('./load-typescript-for-tests.cjs');
const { computeProbeOutputs, EVALUATED_AT_MS } = require('./point-output-probes.cjs');

const BASELINE_FILE = path.join(__dirname, 'baselines', 'point-output.baseline.json');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'data', 'v1', 'manifest.json'), 'utf8'));

const baseline = {
  meta: {
    note: 'Recorded output of the point, timeline and site-search functions before the data-source seam work. Regenerate only on purpose.',
    manifestVersion: manifest.version,
    manifestGeneratedUtc: manifest.generatedUtc,
    evaluatedAtUtc: new Date(EVALUATED_AT_MS).toISOString(),
  },
  ...computeProbeOutputs(),
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
fs.writeFileSync(BASELINE_FILE, formatBaseline(baseline));
for (const [section, content] of Object.entries(baseline)) if (section !== 'meta') console.log(`${section}: ${Object.keys(content).length} 条`);
console.log(`已写入 ${path.relative(repoRoot, BASELINE_FILE)}（${(fs.statSync(BASELINE_FILE).size / 1024).toFixed(0)} KB）`);

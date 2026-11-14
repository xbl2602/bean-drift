// 防绕过检查：只有下面白名单里的文件，才允许在 src/ 和 app/ 里直接引入文件系统（node:fs）去读预计算地图。
// 其他代码要数据，必须走 src/core/data 的统一出口（index.ts）。这样"按位置选数据源"只需要管白名单里的文件，不会有漏网的读取点。
// 新增了合理的读取点？把它加进下面的白名单并写明理由，这个动作本身就是一次有意识的审核。
// 白名单里的文件不再读文件时，也要从白名单里删掉，免得清单烂掉。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { repoRoot } = require('./load-typescript-for-tests.cjs');

const ALLOWED_READERS = {
  'src/core/data/precomputed-maps.ts': '单点查询的唯一读取点：读某点的地形、地平线',
  'src/core/data/site-search.ts': '"按条件找位置"要把整张高度、坡度、统计图读进内存，单独读取',
};

const FS_IMPORT = /(?:from|require\()\s*["'](?:node:)?fs(?:\/promises)?["']/;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'tests' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

test('only the allow-listed files import the file system', () => {
  const readers = ['src', 'app']
    .flatMap((root) => sourceFiles(path.join(repoRoot, root)))
    .filter((file) => FS_IMPORT.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(readers, Object.keys(ALLOWED_READERS).sort(), 'The set of files that read from disk changed. See the header of this test.');
});

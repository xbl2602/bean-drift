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
  'src/core/data/precomputed-maps.ts': '全月预计算地图的底层读取函数（单点读取要经 terrain-source-routing.ts 才能调用它，见下面第二道关）',
  'src/core/data/site-search.ts': '"按条件找位置"要把整张高度、坡度、统计图读进内存，单独读取',
  'src/features/agent-search/logic/gazetteer.ts': 'agent 的 IAU 月面地名表查找，读的是 public/product/moon/lunar-names.json（不是预计算地图）；已列入 next.config.ts 的 /api/agent 打包清单',
};

const FS_IMPORT = /(?:from|require\()\s*["'](?:node:)?fs(?:\/promises)?["']/;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === 'tests' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

// 第二道关：就算不碰文件系统，也不许绕过"选数据源"直接 import 底层读取函数（precomputed-maps）。
// 单点读取只能走 terrain-source-routing.ts；site-search.ts 是整张图的搜索（不是单点），目前只认全月数据。
// 以后"按条件找位置"要支持南极高精度图，要在那时单独做决定，所以它在白名单里是显式写出来的，不是被遗忘的。
const ALLOWED_PRECOMPUTED_MAPS_IMPORTERS = {
  'src/core/data/terrain-source-routing.ts': '单点读取的唯一入口，由它按位置选数据源',
  'src/core/data/site-search.ts': '整张图搜索，只读全月数据（尚未支持按区域换数据源）',
};

test('only the routing module and the whole-map search import the low-level map readers', () => {
  const importers = ['src', 'app']
    .flatMap((root) => sourceFiles(path.join(repoRoot, root)))
    .filter((file) => /from\s+["'][^"']*precomputed-maps["']/.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(importers, Object.keys(ALLOWED_PRECOMPUTED_MAPS_IMPORTERS).sort(), 'A file imports precomputed-maps directly. Point reads must go through terrain-source-routing.ts.');
});

test('only the allow-listed files import the file system', () => {
  const readers = ['src', 'app']
    .flatMap((root) => sourceFiles(path.join(repoRoot, root)))
    .filter((file) => FS_IMPORT.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file).split(path.sep).join('/'))
    .sort();
  assert.deepEqual(readers, Object.keys(ALLOWED_READERS).sort(), 'The set of files that read from disk changed. See the header of this test.');
});

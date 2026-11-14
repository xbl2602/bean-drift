// 测试专用：在内存里把仓库里真实的 TS 模块即时编译成 CommonJS 再加载（不生成文件、不加依赖）。
// 做法和 src/features/agent-search/tests/agent.test.cjs 一致：支持 "@/..." 别名，.ts 文件用 TypeScript 转译。
// 预计算地图是按 process.cwd() 找的（见 precomputed-maps.ts），所以这里把工作目录固定到仓库根目录，
// 不管从哪里启动测试，读到的都是同一份 public/data/v1。
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../../..');
const srcRoot = path.join(repoRoot, 'src');

function installTypescriptLoader() {
  process.chdir(repoRoot);
  if (require.extensions['.ts']) return;
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (specifier, ...args) {
    return resolve.call(this, specifier.startsWith('@/') ? path.join(srcRoot, specifier.slice(2)) : specifier, ...args);
  };
  require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
  ).outputText, filename);
}

module.exports = { installTypescriptLoader, repoRoot };

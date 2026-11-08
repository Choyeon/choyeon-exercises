/**
 * ts-require —— 让 node 能直接 require 项目里的 .ts 源文件。
 *
 * 为什么需要它：
 *   项目没有装 ts-jest / jest-expo（也没有 ts-node），但大量的核心逻辑
 *   （sanitize / strength / analytics / backup）都是不依赖 RN 运行时的纯 TS。
 *   为了能在 `npm test` 里直接测这些真身、而不是像旧脚本那样用正则从源码里
 *   「切」函数体出来跑（那套做法和真实代码极易漂移），这里做一层极薄的
 *   TypeScript → CommonJS 转译钩子。
 *
 *   只对 `.ts/.tsx` 生效，且不改动任何业务代码：转译结果只存在于内存里。
 *
 * 用法：在任何测试入口最前面 `require('./ts-require')`。
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

let ts;
try {
  ts = require('typescript');
} catch (e) {
  throw new Error(
    'ts-require 需要 typescript（devDependency）。请先执行 npm install。\n' + e.message
  );
}

const SRC_ROOT = path.join(__dirname, '..', 'src');

const COMPILER_OPTIONS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2021,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  resolveJsonModule: true,
  jsx: ts.JsxEmit.ReactJSX,
  // 必须开启：否则 `import type` / `export type` 在单文件转译下无法正确擦除
  isolatedModules: true,
};

/** 把 '@/foo/bar' 映射到 <src>/foo/bar（与 babel / metro 的 alias 保持一致） */
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(SRC_ROOT, request.slice(2));
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

function compile(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: COMPILER_OPTIONS,
    fileName: filename,
  });
  module._compile(outputText, filename);
}

require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

module.exports = { SRC_ROOT };

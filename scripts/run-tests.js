/**
 * run-tests —— 零新增依赖的单元测试跑批入口。
 *
 * 覆盖的是「不依赖 RN 运行时的纯逻辑层」：
 *   src/store/sanitize.ts   持久化脏数据防御
 *   src/utils/strength.ts   1RM / 杠铃片 / 单位换算
 *   src/utils/analytics.ts  容量聚合 / 连续天数 / 热力图
 *   src/utils/backup.ts     备份序列化与导入校验
 *
 * 这些模块任何一条断言被打破，都会直接表现为线上崩溃或数字算错，
 * 所以必须能在不启动模拟器、不装 jest-expo 的前提下跑起来。
 *
 * 运行：
 *   node scripts/run-tests.js            # 全部
 *   node scripts/run-tests.js backup     # 只跑文件名含 backup 的用例
 */

require('./ts-require');

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
const filter = process.argv[2] || '';

if (!fs.existsSync(TESTS_DIR)) {
  console.error('未找到 tests/ 目录：' + TESTS_DIR);
  process.exit(1);
}

const files = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => (filter ? f.includes(filter) : true))
  .sort();

if (files.length === 0) {
  console.error('没有匹配的测试文件（filter=' + (filter || '(none)') + '）');
  process.exit(1);
}

let total = 0;
let failed = 0;
const failedSuites = [];

console.log('单元测试');
console.log('='.repeat(64));

for (const file of files) {
  const suite = require(path.join(TESTS_DIR, file));
  const name = suite.name || file;
  const tests = Array.isArray(suite.tests) ? suite.tests : [];
  console.log('\n' + name);

  let suiteFailed = 0;
  for (const t of tests) {
    total += 1;
    try {
      t.fn();
      console.log('  PASS  ' + t.name);
    } catch (e) {
      failed += 1;
      suiteFailed += 1;
      console.log('  FAIL  ' + t.name);
      console.log('        → ' + (e && e.message ? e.message : String(e)));
    }
  }
  if (suiteFailed > 0) failedSuites.push(name);
}

console.log('\n' + '='.repeat(64));
console.log(`用例 ${total} 个：通过 ${total - failed}，失败 ${failed}`);
if (failed > 0) console.log('失败套件：' + failedSuites.join(' / '));

process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * check-icons —— 图标名合法性检查
 *
 * 背景：@expo/vector-icons 的 <Icon name="xxx"> 传错名字**不会报错**，
 * 只会在界面上静默渲染成一个问号方块。历史上本项目就因为这个原因，
 * 在「连续训练」「背部/腿部」「胸围」「无内容占位」等处显示过一串问号。
 *
 * 本脚本用 MaterialCommunityIcons 的 glyphmap（字体自带的权威清单）比对
 * 所有图标名引用，在提交前把这类错误拦下来。
 *
 * 覆盖三种引用方式：
 *   1. JSX 属性：      <Icon name="fire" /> / icon="fire" / icon={cond ? 'a' : 'b'}
 *   2. 对象字段：      { icon: 'fire' }
 *   3. 映射表：        BODY_PART_LABELS / EQUIPMENT_LABELS 里的 icon 字段
 *
 * 用法：node scripts/check-icons.js
 * 退出码 0 = 全部合法；1 = 存在非法图标名（可用于 CI / pre-commit）。
 */

const fs = require('fs');
const path = require('path');

const GLYPHMAP =
  '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

let valid;
try {
  valid = new Set(Object.keys(require(GLYPHMAP)));
} catch (err) {
  console.error('无法加载 MaterialCommunityIcons glyphmap，请先 npm install。');
  console.error(String(err && err.message));
  process.exit(1);
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', '.expo', 'android', 'ios']);
const SCAN_ROOTS = ['app', 'src'];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/** 这些不是图标名，只是恰好出现在 icon 语境里的普通字符串 */
const NOT_ICONS = new Set([
  'ios', 'android', 'web', 'default', 'card', 'button', 'header', 'tab',
  'zh', 'en', 'ja', 'es', 'ko', 'fr', 'ru',
]);

const PATTERNS = [
  // <Icon name="x" /> 或 name={cond ? 'a' : 'b'}
  { re: /<Icon\b[^>]*?\bname=\{[^}]*?['"]([a-z0-9-]+)['"]/g, kind: 'jsx' },
  { re: /<Icon\b[^>]*?\bname=["']([a-z0-9-]+)["']/g, kind: 'jsx' },
  // icon="x" / iconName="x"
  { re: /\bicon(?:Name)?=["']([a-z0-9-]+)["']/g, kind: 'prop' },
  // icon={cond ? 'a' : 'b'}
  { re: /\bicon(?:Name)?=\{[^}]*?['"]([a-z0-9-]+)['"]/g, kind: 'prop' },
  // { icon: 'x' }
  { re: /\bicon(?:Name)?:\s*['"]([a-z0-9-]+)['"]/g, kind: 'field' },
];

const problems = [];
let checked = 0;

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // 跳过注释行与 import 行，避免把文档示例、包路径当成图标名
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/\bfrom\s+['"]|require\(/.test(line)) return;

      for (const { re } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          const name = m[1];
          checked += 1;
          if (valid.has(name) || NOT_ICONS.has(name)) continue;
          problems.push({
            file,
            line: i + 1,
            name,
            text: line.trim().slice(0, 100),
          });
        }
      }
    });
  }
}

console.log(`图标名检查：扫描 ${checked} 处引用`);

if (problems.length === 0) {
  console.log('全部合法 ✅');
  process.exit(0);
}

console.log(`\n发现 ${problems.length} 处非法图标名（会渲染成问号）：\n`);
for (const p of problems) {
  console.log(`  ${p.file}:${p.line}`);
  console.log(`      name="${p.name}"`);
  console.log(`      ${p.text}\n`);
}
console.log('提示：用下面的命令查询正确的图标名：');
console.log('  node -e "const g=require(\'' + GLYPHMAP + '\');' +
  'console.log(Object.keys(g).filter(n=>n.includes(\'关键字\')).join(\', \'))"');
process.exit(1);

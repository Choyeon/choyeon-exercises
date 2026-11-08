#!/usr/bin/env node
/**
 * check-i18n —— 翻译键完整性检查
 *
 * 背景：i18next 找不到键时**不会抛错**，而是把键名原样吐回给 UI。
 * 屏幕上就会出现「PR.BADGELABELNONE」「templates.templateEmptyHint」
 * 这类工程噪音 —— 用户看到的是内部标识符，既看不懂也没法反馈。
 * 历史上本项目正是靠用户截图才发现这类问题，所以补上自动检查。
 *
 * 本脚本做四件事：
 *   1. 扫描所有 t('ns.key', ...) 调用（含带参调用），与 zh / en 资源比对，报出缺失键；
 *   2. 报出「缺键且没有 defaultValue 兜底」的高危调用点（必然裸奔到 UI）；
 *   3. 交叉比对 zh 与 en 的键集合，报出两边不一致的键；
 *   4. 单独列出模板串拼键的调用（静态无法校验，需人工确认是白名单枚举）。
 *
 * 用法：node scripts/check-i18n.js
 * 退出码 0 = 全部通过；1 = 存在缺失/不一致（可用于 CI / pre-commit）。
 */

const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join('src', 'i18n', 'translations');

// ---------------------------------------------------------------------------
// 1. 求值 translations/*.ts
//    它们是 `export const xx = {...} as const` 的纯字面量，剥掉类型语法后
//    直接求值即可，不引入任何额外依赖。
// ---------------------------------------------------------------------------
function loadLocale(code) {
  const file = path.join(TRANSLATIONS_DIR, `${code}.ts`);
  if (!fs.existsSync(file)) return null;
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/^\s*export\s+(default\s+)?const\s+\w+\s*(?::[^=]+)?=\s*/, '');
  src = src.replace(/\s*as\s+const\s*;?\s*$/, '');
  // eslint-disable-next-line no-new-func
  return new Function(`return (${src});`)();
}

/** 把嵌套对象拍平成 'a.b.c' 键集合 */
function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. 扫描调用点
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', '.expo']);
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

// 匹配 t('key', ...) / t("key", ...) / t('key')
// 关键：必须有第二个参数或闭合括号，因此能覆盖带 options 的调用。
const CALL_RE = /\bt\(\s*(['"])([^'"\n]+)\1\s*(,|\))/g;
// 模板串拼键：t(`session.setType_${type}`) —— 静态无法求值
const TEMPLATE_RE = /\bt\(\s*`([^`]*)`/g;

const usages = [];
const dynamic = [];

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

      CALL_RE.lastIndex = 0;
      let m;
      while ((m = CALL_RE.exec(line)) !== null) {
        const key = m[2];
        // 必须含 '.'，否则是 t('普通字符串')，不属于翻译调用
        if (!key.includes('.')) continue;
        // 向后看一段，判断有没有 defaultValue 兜底
        const tail = line.slice(m.index, m.index + 240);
        const hasDefault =
          /defaultValue\s*:/.test(tail) ||
          /,\s*['"][^'"]{3,}['"]\s*\)/.test(tail);
        usages.push({ file, line: i + 1, key, hasDefault });
      }

      TEMPLATE_RE.lastIndex = 0;
      while ((m = TEMPLATE_RE.exec(line)) !== null) {
        if (!m[1].includes('.')) continue;
        dynamic.push({ file, line: i + 1, snippet: line.trim().slice(0, 90) });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 3. 比对
// ---------------------------------------------------------------------------
const zh = flatten(loadLocale('zh'));
const en = flatten(loadLocale('en'));

const missingZh = [];
const missingEn = [];
const noDefault = [];

for (const u of usages) {
  const inZh = zh.has(u.key);
  const inEn = en.has(u.key);
  if (!inZh) missingZh.push(u);
  if (!inEn) missingEn.push(u);
  if (!u.hasDefault && (!inZh || !inEn)) noDefault.push(u);
}

const onlyInZh = [...zh].filter((k) => !en.has(k)).sort();
const onlyInEn = [...en].filter((k) => !zh.has(k)).sort();

// ---------------------------------------------------------------------------
// 4. 输出
// ---------------------------------------------------------------------------
console.log(
  `i18n 检查：静态 t() 调用 ${usages.length} 处，模板串调用 ${dynamic.length} 处`
);

let failed = false;

function report(title, items, fmt) {
  if (items.length === 0) return;
  failed = true;
  console.log(`\n${title}（${items.length}）\n`);
  for (const it of items) console.log('  ' + fmt(it));
}

report('缺少中文翻译 (zh)', missingZh, (u) => `${u.file}:${u.line}  ${u.key}`);
report('缺少英文翻译 (en)', missingEn, (u) => `${u.file}:${u.line}  ${u.key}`);
report(
  '缺键且无 defaultValue 兜底（会直接把键名渲染到 UI）',
  noDefault,
  (u) => `${u.file}:${u.line}  ${u.key}`
);
report('键仅存在于 zh，en 缺失', onlyInZh, (k) => k);
report('键仅存在于 en，zh 缺失', onlyInEn, (k) => k);

if (dynamic.length > 0) {
  console.log(
    `\n注意：${dynamic.length} 处用模板串拼键，静态无法校验（如 t(\`session.setType_${'${type}'}\`)）。`
  );
  console.log('      请确保传入值来自白名单枚举，并配 defaultValue 兜底。');
  for (const d of dynamic.slice(0, 10)) {
    console.log(`  ${d.file}:${d.line}  ${d.snippet}`);
  }
  if (dynamic.length > 10) console.log(`  …还有 ${dynamic.length - 10} 处`);
}

if (failed) process.exit(1);
console.log('全部通过 ✅');
process.exit(0);

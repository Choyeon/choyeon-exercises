/**
 * 动态 i18n 键校验器
 * ---------------------------------------------------------------------------
 * 为什么需要这个脚本：
 *   check-i18n.js 只能校验「静态字符串字面量」的 t() 调用，例如 t('pr.title')。
 *   但项目里有若干处是「模板串拼键」：
 *
 *       t(`body.${METRIC_LABEL_KEY[k]}`)
 *       t(`workout.level${upperFirst(tpl.level)}`)
 *       t(`session.setType_${type}`)
 *
 *   i18next 缺键时不会抛错，而是把键名原样回吐到 UI —— 用户就会看到
 *   「body.metricChest」「workout.goalFatLoss」这种工程噪音。
 *   因此这些动态键必须单独校验，且必须在 CI 里可拦截。
 *
 * 做法：
 *   把每个拼接点的「取值域」显式声明在这里（取值域来自 src/types 的类型联合
 *   或页面里的 Record 映射表），展开成完整键名，逐个到 7 个语种里查存在性。
 *
 * 维护约定：
 *   - 若 src/types/index.ts 里的 SetType / PlanTemplate['level'|'goal'] 增加了枚举值，
 *     必须同步更新下面的 DOMAINS，否则新值会漏校验。
 *   - 若 app/body/index.tsx 的 METRIC_LABEL_KEY / METRIC_UNIT_KEY 增加字段，
 *     同样必须同步。为此脚本额外做一次「源码枚举 vs 此处声明」的一致性交叉核对，
 *     两边不一致时直接报错，避免声明漂移。
 *
 * 用法：node scripts/check-dynamic-keys.js
 * 退出码：0 全部通过；1 存在缺失或漂移。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRANSLATIONS_DIR = path.join(ROOT, 'src', 'i18n', 'translations');
const LOCALES = ['zh', 'en', 'ja', 'es', 'ko', 'fr', 'ru'];

/** 读取语种资源：源文件是 `export const zh = { ... } as const;` */
function loadLocale(code) {
  let src = fs.readFileSync(path.join(TRANSLATIONS_DIR, `${code}.ts`), 'utf8');
  src = src.replace(
    /^\s*export\s+(default\s+)?const\s+\w+\s*(?::[^=]+)?=\s*/,
    ''
  );
  src = src.replace(/\s*as\s+const\s*;?\s*$/, '');
  return new Function(`return (${src});`)();
}

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ===========================================================================
// 取值域声明 —— 每一项都标注了来源，改动类型时必须同步
// ===========================================================================

/**
 * body.* 的标签/单位后缀
 * 来源：app/body/index.tsx 的 METRIC_LABEL_KEY / METRIC_UNIT_KEY
 */
const BODY_METRIC_LABELS = [
  'metricWeight',
  'metricBodyFat',
  'metricBMI',
  'metricHeight',
  'metricNeck',
  'metricChest',
  'metricWaist',
  'metricHip',
  'metricUpperArmL',
  'metricUpperArmR',
  'metricThighL',
  'metricThighR',
  'metricCalfL',
  'metricCalfR',
];

const BODY_METRIC_UNITS = ['unitKg', 'unitPercent', 'unitCm'];

/**
 * 来源：src/types/index.ts
 *   export type SetType = 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap';
 */
const SET_TYPES = ['warmup', 'working', 'dropset', 'failure', 'amrap'];

/**
 * 来源：src/types/index.ts PlanTemplate['level']
 *   'beginner' | 'intermediate' | 'advanced'
 * 拼接方式：t(`workout.level${upperFirst(level)}`)
 */
const PLAN_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

/**
 * 来源：src/types/index.ts PlanTemplate['goal']
 *   'hypertrophy' | 'strength' | 'conditioning' | 'fat-loss' | 'maintenance' | 'mobility'
 * 拼接方式：t(`workout.goal${goalEnumToPascal(goal)}`)
 * 注意 'fat-loss' 经 goalEnumToPascal 后是 FatLoss（连字符分段首字母大写后拼接）
 */
const PLAN_GOALS = [
  'Hypertrophy',
  'Strength',
  'Conditioning',
  'FatLoss',
  'Maintenance',
  'Mobility',
];

const DOMAINS = [
  {
    where: 'app/body/index.tsx:193,357 → METRIC_LABEL_KEY',
    keys: BODY_METRIC_LABELS.map((k) => `body.${k}`),
  },
  {
    where: 'app/body/index.tsx:208 → METRIC_UNIT_KEY',
    keys: BODY_METRIC_UNITS.map((k) => `body.${k}`),
  },
  {
    where: 'app/workout/start.tsx:1820 → session.setType_${type}',
    keys: SET_TYPES.map((k) => `session.setType_${k}`),
  },
  {
    where: 'app/templates/index.tsx:228 → workout.level${upperFirst(level)}',
    keys: PLAN_LEVELS.map((k) => `workout.level${k}`),
  },
  {
    where: 'app/templates/index.tsx:238 → workout.goal${goalEnumToPascal(goal)}',
    keys: PLAN_GOALS.map((k) => `workout.goal${k}`),
  },
];

// ===========================================================================
// 交叉核对：脚本声明的枚举 vs 源码里的真实枚举（防止声明漂移）
// ===========================================================================

/** 从源码里按「单行 key: 'value',」的紧致正则提取 Record 映射的取值，不跨行。 */
function extractRecordValues(file, constName) {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf(`const ${constName}`);
  if (start === -1) return null;
  const open = src.indexOf('{', start);
  const end = src.indexOf('\n};', open);
  if (open === -1 || end === -1) return null;
  const body = src.slice(open, end);
  const out = [];
  const re = /^\s*[\w$]+:\s*'([^']*)',?\s*$/gm;
  let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

/** 从 src/types/index.ts 提取字符串字面量联合类型 */
function extractUnion(file, typeName) {
  const src = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`type\\s+${typeName}\\s*=\\s*([^;]+);`);
  const m = re.exec(src);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

// ===========================================================================
// 执行
// ===========================================================================

const problems = [];
const locales = {};
for (const code of LOCALES) locales[code] = loadLocale(code);

let total = 0;
for (const domain of DOMAINS) {
  for (const key of domain.keys) {
    total += 1;
    const missing = LOCALES.filter(
      (c) => typeof get(locales[c], key) !== 'string'
    );
    if (missing.length) {
      problems.push(
        `缺键 ${key}\n    来源：${domain.where}\n    缺失语种：${missing.join(', ')}`
      );
    }
  }
}

// 交叉核对：body 枚举
const bodyFile = path.join(ROOT, 'app', 'body', 'index.tsx');
const srcLabels = extractRecordValues(bodyFile, 'METRIC_LABEL_KEY');
const srcUnits = extractRecordValues(bodyFile, 'METRIC_UNIT_KEY');
if (srcLabels) {
  const declared = new Set(BODY_METRIC_LABELS);
  const drift = [...new Set(srcLabels)].filter((v) => !declared.has(v));
  if (drift.length) {
    problems.push(
      `声明漂移：METRIC_LABEL_KEY 源码里有、但本脚本未声明 → ${drift.join(', ')}`
    );
  }
}
if (srcUnits) {
  const declared = new Set(BODY_METRIC_UNITS);
  const drift = [...new Set(srcUnits)].filter((v) => !declared.has(v));
  if (drift.length) {
    problems.push(
      `声明漂移：METRIC_UNIT_KEY 源码里有、但本脚本未声明 → ${drift.join(', ')}`
    );
  }
}

// 交叉核对：SetType
const typesFile = path.join(ROOT, 'src', 'types', 'index.ts');
const srcSetTypes = extractUnion(typesFile, 'SetType');
if (srcSetTypes) {
  const declared = new Set(SET_TYPES);
  const drift = srcSetTypes.filter((v) => !declared.has(v));
  if (drift.length) {
    problems.push(
      `声明漂移：SetType 源码里有、但本脚本未声明 → ${drift.join(', ')}`
    );
  }
}

// 交叉核对：PlanTemplate 的 level / goal 联合类型（用 Pascal 形态比对）
function extractPlanField(field) {
  const src = fs.readFileSync(typesFile, 'utf8');
  const re = new RegExp(`${field}:\\s*([^;]+);`);
  const m = re.exec(src);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
const srcLevels = extractPlanField('level');
if (srcLevels) {
  const toPascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const declared = new Set(PLAN_LEVELS);
  const drift = srcLevels.map(toPascal).filter((v) => !declared.has(v));
  if (drift.length) {
    problems.push(
      `声明漂移：PlanTemplate['level'] 源码里有、但本脚本未声明 → ${drift.join(', ')}`
    );
  }
}
const srcGoals = extractPlanField('goal');
if (srcGoals) {
  const toPascal = (s) =>
    s
      .split('-')
      .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
      .join('');
  const declared = new Set(PLAN_GOALS);
  const drift = srcGoals.map(toPascal).filter((v) => !declared.has(v));
  if (drift.length) {
    problems.push(
      `声明漂移：PlanTemplate['goal'] 源码里有、但本脚本未声明 → ${drift.join(', ')}`
    );
  }
}

// ===========================================================================
// 报告
// ===========================================================================

if (problems.length === 0) {
  console.log(
    `动态键检查：${DOMAINS.length} 个拼接点 / 展开 ${total} 个键 × ${LOCALES.length} 语种 → 全部存在 ✅`
  );
  process.exit(0);
}

console.error(`动态键检查：发现 ${problems.length} 个问题 ❌\n`);
for (const p of problems) console.error(`  - ${p}`);
console.error(
  '\n提示：缺键时 i18next 会把键名原样渲染到界面上（如 body.metricChest），务必补齐。'
);
process.exit(1);

/**
 * backup 层单测 —— 导出 / 导入 / 校验。
 *
 * 备份是用户唯一的数据救生索（本 App 不联网、无账号、无云同步）。
 * 因此导入路径必须「宽容」：宁可丢掉几条坏记录，也不要整份导入失败。
 */

const { assert, eq, deepEq } = require('./helpers');
const {
  BACKUP_APP_ID,
  BACKUP_VERSION,
  createBackup,
  serializeBackup,
  parseBackup,
  summarizeBackup,
  backupSizeKb,
} = require('../src/utils/backup');

const BASE = {
  settings: {
    language: 'zh',
    theme: 'dark',
    units: 'kg',
    defaultRestSeconds: 120,
    restTimerEnabled: true,
    autoRest: true,
    saveHistory: true,
    hapticFeedback: false,
    weeklyGoal: 5,
    oneRmFormula: 'brzycki',
    plateConfig: { barWeight: 20, plates: [25, 20, 10, 5] },
    countOnlyWorkingSets: true,
    onboarded: true,
  },
  favoriteIds: ['0001', '0002'],
  workouts: [
    {
      id: 'w1',
      name: '胸日',
      date: '2026-03-01T10:00:00.000Z',
      duration: 3600,
      exercises: [
        {
          exerciseId: '0001',
          sets: [
            { id: 's1', exerciseId: '0001', weight: 100, reps: 5, completed: true, type: 'working', rpe: 8 },
            { id: 's2', exerciseId: '0001', weight: 20, reps: 10, completed: true, type: 'warmup' },
          ],
        },
      ],
    },
  ],
  customTemplates: [],
  pinnedTemplateIds: ['t1'],
  bodyEntries: [{ id: 'b1', date: '2026-03-01', metrics: { weight: 70 }, createdAt: 'x' }],
  prRecords: [{ id: 'p1', exerciseId: '0001', weight: 100, reps: 5, date: '2026-03-01', createdAt: 'x' }],
  customExercises: [
    { id: 'custom-1', name: '单臂划船', body_part: 'back', equipment: 'dumbbell', target: 'lats', secondary_muscles: [], instructions: ['a'], createdAt: 'x' },
  ],
};

module.exports = {
  name: 'backup 备份导入导出',
  tests: [
    {
      name: 'createBackup + serializeBackup + parseBackup 往返无损',
      fn() {
        const text = serializeBackup(createBackup(BASE));
        const res = parseBackup(text);
        assert(res.ok, `解析失败: ${res.ok ? '' : res.error}`);
        eq(res.payload.workouts.length, 1);
        eq(res.payload.workouts[0].name, '胸日');
        eq(res.payload.workouts[0].exercises[0].sets.length, 2);
        eq(res.payload.workouts[0].exercises[0].sets[0].type, 'working', '组类型必须存活');
        eq(res.payload.workouts[0].exercises[0].sets[0].rpe, 8, 'RPE 必须存活');
        eq(res.payload.settings.weeklyGoal, 5);
        eq(res.payload.settings.plateConfig.barWeight, 20);
        deepEq(res.payload.settings.plateConfig.plates, [25, 20, 10, 5]);
        eq(res.payload.customExercises.length, 1);
        eq(res.payload.favoriteIds.length, 2);
        eq(res.payload.prRecords.length, 1);
        eq(res.payload.bodyEntries.length, 1);
      },
    },
    {
      name: '导出文本带 2 空格缩进（用户需要肉眼检查 / 手改）',
      fn() {
        const text = serializeBackup(createBackup(BASE));
        assert(text.includes('\n  "app"'), '未缩进');
        assert(text.includes(BACKUP_APP_ID));
      },
    },
    {
      name: '错误码：空 / 非 JSON / 非对象 / 非本 App / 版本不支持',
      fn() {
        eq(parseBackup('').error, 'empty');
        eq(parseBackup('   ').error, 'empty');
        eq(parseBackup(null).error, 'empty');
        eq(parseBackup(undefined).error, 'empty');
        eq(parseBackup('{oops').error, 'notJson');
        eq(parseBackup('[1,2,3]').error, 'notObject');
        eq(parseBackup('"str"').error, 'notObject');
        eq(parseBackup(JSON.stringify({ app: 'other-app', version: 1 })).error, 'wrongApp');
        // 来自「未来」的备份字段未知，强解会写坏 vault
        eq(parseBackup(JSON.stringify({ app: BACKUP_APP_ID, version: BACKUP_VERSION + 1 })).error, 'unsupportedVersion');
        eq(parseBackup(JSON.stringify({ app: BACKUP_APP_ID, version: 0 })).error, 'unsupportedVersion');
      },
    },
    {
      name: '空备份（无任何数据分片）判为 noData',
      fn() {
        const payload = { app: BACKUP_APP_ID, version: 1 };
        eq(parseBackup(JSON.stringify(payload)).error, 'noData');
      },
    },
    {
      name: '宽容导入：坏记录逐条丢弃，合法的照常进来',
      fn() {
        const payload = {
          app: BACKUP_APP_ID,
          version: 1,
          workouts: [
            null,
            'x',
            { date: 'not-a-date' },                                        // 日期非法
            { id: 'w2', date: '2026-03-02T10:00:00.000Z', duration: 10 },  // 合法（无 exercises）
            {
              id: 'w3',
              date: '2026-03-03T10:00:00.000Z',
              duration: -5,
              exercises: [{ exerciseId: 'e1', sets: [null, { weight: 'abc', reps: 1 }, { weight: 50, reps: 8, completed: true }] }],
            },
          ],
          prRecords: [null, { weight: 1 }, { exerciseId: 'e1', weight: 100, reps: 5, date: '2026-03-01' }],
          bodyEntries: [{ date: 123 }, { date: '2026-03-01', metrics: { weight: 70 } }],
          customExercises: [{ id: 'c1' }, { id: 'c2', name: 'ok' }],
          favoriteIds: ['a', 1, 'b'],
        };
        const res = parseBackup(JSON.stringify(payload));
        assert(res.ok, '不应整份失败');
        eq(res.payload.workouts.length, 2, '只保留 2 条合法训练');
        eq(res.payload.workouts[0].exercises.length, 0, '缺 exercises 应补空数组');
        eq(res.payload.workouts[0].duration, 10);
        eq(res.payload.workouts[1].duration, 0, '负时长应归 0');
        eq(res.payload.workouts[1].exercises[0].sets.length, 1, '脏 set 应被丢弃');
        eq(res.payload.prRecords.length, 1);
        eq(res.payload.bodyEntries.length, 1);
        eq(res.payload.customExercises.length, 1);
        // 注意这里不是「过滤掉非字符串」而是 map(String)：历史 vault 里
        // 动作 id 存过 NUMBER（exercises.json 是 STRING），直接过滤会让
        // 老用户的收藏静默消失。归一化比丢弃更安全。
        deepEq(res.payload.favoriteIds, ['a', '1', 'b']);
        assert(res.warnings.length > 0, '应给出丢弃告警');
      },
    },
    {
      name: '旧版本备份（无 v5 字段）导入后 settings 由默认值补齐',
      fn() {
        const payload = {
          app: BACKUP_APP_ID,
          version: 1,
          settings: { units: 'lb', defaultRestSeconds: 60 },
          workouts: [{ id: 'w1', date: '2026-03-01T10:00:00.000Z', duration: 600, exercises: [] }],
        };
        const res = parseBackup(JSON.stringify(payload));
        assert(res.ok, '不应失败');
        eq(res.payload.settings.units, 'lb', '用户值应保留');
        eq(res.payload.settings.defaultRestSeconds, 60);
        eq(res.payload.settings.weeklyGoal, 4, '缺失字段应补默认');
        eq(res.payload.settings.oneRmFormula, 'epley');
        assert(Array.isArray(res.payload.settings.plateConfig.plates), 'plateConfig 应补齐');
        eq(res.payload.customExercises.length, 0, '缺分片应为空数组');
      },
    },
    {
      name: 'settings 里值为 undefined 的键不会冲掉默认值',
      fn() {
        const res = parseBackup(JSON.stringify({
          app: BACKUP_APP_ID,
          version: 1,
          settings: { theme: null, units: 'kg', plateConfig: null },
          workouts: [{ id: 'w1', date: '2026-03-01T10:00:00.000Z', duration: 1, exercises: [] }],
        }));
        assert(res.ok);
        assert(res.payload.settings.theme === 'system', `theme 被冲掉: ${res.payload.settings.theme}`);
        assert(res.payload.settings.plateConfig.barWeight === 20, 'plateConfig=null 应回退默认');
      },
    },
    {
      name: 'summarizeBackup 统计准确（导入确认弹窗靠它）',
      fn() {
        const payload = createBackup(BASE);
        const s = summarizeBackup(payload);
        eq(s.workouts, 1);
        eq(s.sets, 2);
        eq(s.templates, 0);
        eq(s.bodyEntries, 1);
        eq(s.prRecords, 1);
        eq(s.customExercises, 1);
        eq(s.favorites, 2);
        assert(typeof s.exportedAt === 'string' && s.exportedAt.length > 0, 'exportedAt 缺失');
      },
    },
    {
      name: 'backupSizeKb 估算为正数（中文按 3 字节近似）',
      fn() {
        const text = serializeBackup(createBackup(BASE));
        assert(backupSizeKb(text) > 0, '体积应 > 0');
        eq(backupSizeKb(''), 0);
        eq(backupSizeKb('a'.repeat(1024)), 1, '纯 ASCII 1024 字符 = 1KB');
      },
    },
    {
      name: 'createBackup 对缺失分片做兜底（不因 undefined 崩）',
      fn() {
        const p = createBackup({ settings: null, favoriteIds: null, workouts: null, customTemplates: null, pinnedTemplateIds: null, bodyEntries: null, prRecords: null });
        eq(p.workouts.length, 0);
        eq(p.favoriteIds.length, 0);
        eq(p.settings.units, 'kg');
      },
    },
  ],
};

/**
 * sanitize 层回归 —— 持久化脏数据防御。
 *
 * 这一组用例的存在理由：App 崩溃的根因是渲染期对持久化数组做无保护访问
 * （.filter/.map/.reduce 落在 undefined 上）。sanitize 是阻止坏数据进入
 * 渲染树的第一道闸门，它自己绝不能抛异常，也不能放过结构残缺的对象。
 */

const { assert, eq } = require('./helpers');
const {
  sanitizeState,
  sanitizeWorkout,
  sanitizeUserTemplate,
  sanitizeCustomExercise,
} = require('../src/store/sanitize');

// 与旧版 scripts/test-sanitize.js 保持一致的一组「恶意 / 损坏」输入。
const HOSTILE = [
  { label: '全部字段缺失 (空对象)', v: {} },
  { label: 'null', v: null },
  { label: 'undefined', v: undefined },
  { label: '字符串', v: 'oops' },
  { label: '数字', v: 42 },
  { label: '数组', v: [1, 2, 3] },
  { label: 'workouts 是 null', v: { workouts: null } },
  { label: 'workouts 是对象而非数组', v: { workouts: { a: 1 } } },
  { label: 'workout.exercises 是 undefined', v: { workouts: [{ id: 'w1', name: 'n', date: 'd', duration: 1 }] } },
  { label: 'exercise.sets 是 undefined', v: { workouts: [{ id: 'w1', name: 'n', date: 'd', duration: 1, exercises: [{ exerciseId: 'e1' }] }] } },
  {
    label: 'sets 内含 null / 数字 / 字符串',
    v: {
      workouts: [
        {
          id: 'w1', name: 'n', date: 'd', duration: 1,
          exercises: [{ exerciseId: 'e1', sets: [null, 7, 'x', undefined, { id: 's1', weight: 'abc', reps: null, completed: 'yes' }] }],
        },
      ],
    },
  },
  { label: 'exercise 缺 exerciseId', v: { workouts: [{ id: 'w1', name: 'n', date: 'd', duration: 1, exercises: [{ sets: [] }, { exerciseId: 'ok', sets: [] }] }] } },
  { label: 'customTemplates 是 null', v: { customTemplates: null } },
  { label: 'template.sessions 是 undefined', v: { customTemplates: [{ id: 't1', name: { zh: 'a', en: 'b' } }] } },
  { label: 'session.exerciseIds 含 null / 数字', v: { customTemplates: [{ id: 't1', name: { zh: 'a', en: 'b' }, sessions: [{ day: 'd', name: { zh: 'x', en: 'y' }, exerciseIds: [null, 1, 'e', undefined] }] }] } },
  { label: 'session.defaults 是数组', v: { customTemplates: [{ id: 't1', name: { zh: 'a', en: 'b' }, sessions: [{ day: 'd', name: { zh: 'x', en: 'y' }, exerciseIds: [], defaults: [1, 2] }] }] } },
  { label: 'bodyEntries 含 null / 缺 date', v: { bodyEntries: [null, { date: 123 }, { date: '2026-01-01', weight: 70 }, 'x'] } },
  { label: 'prRecords 含 null / 缺 exerciseId', v: { prRecords: [null, 'x', { weight: 100 }, { exerciseId: 'e1', weight: 100 }] } },
  { label: 'pinnedTemplateIds 含非字符串', v: { pinnedTemplateIds: ['a', 1, null, 'b', {}] } },
  { label: 'favoriteIds 是对象', v: { favoriteIds: { a: 1 } } },
  { label: 'activeWorkout.exercises 含无 sets 的项', v: { activeWorkout: { exercises: [null, 1, { exerciseId: 'e1' }, { exerciseId: 'e2', sets: [] }] } } },
  { label: 'settings 是数组', v: { settings: [1, 2, 3] } },
  {
    label: 'duration 为 NaN / 负数 / 小数',
    v: {
      workouts: [
        { id: 'w1', name: 'n', date: 'd', duration: NaN, exercises: [] },
        { id: 'w2', name: 'n', date: 'd', duration: -5, exercises: [] },
        { id: 'w3', name: 'n', date: 'd', duration: 3.9, exercises: [] },
      ],
    },
  },
  // ---- v5 新增 ----
  { label: 'customExercises 是 null', v: { customExercises: null } },
  { label: 'customExercises 含 null / 缺 name', v: { customExercises: [null, { id: 'c1' }, { name: 'x' }, 'y'] } },
  { label: 'set.type 是非法值', v: { workouts: [{ id: 'w1', date: 'd', exercises: [{ exerciseId: 'e1', sets: [{ id: 's1', type: 'nonsense', weight: 10, reps: 5 }] }] }] } },
  { label: 'set.rpe / completedAt 是垃圾', v: { workouts: [{ id: 'w1', date: 'd', exercises: [{ exerciseId: 'e1', sets: [{ id: 's1', weight: 10, reps: 5, rpe: 'abc', completedAt: 'xyz', durationSec: null }] }] }] } },
];

module.exports = {
  name: 'sanitize 持久层防御',
  tests: [
    {
      name: '所有恶意输入都不抛异常，且输出结构完好',
      fn() {
        for (const c of HOSTILE) {
          let out;
          try {
            out = sanitizeState(c.v);
          } catch (e) {
            throw new Error(`[${c.label}] sanitizeState 抛异常: ${e.message}`);
          }
          if (out == null || typeof out !== 'object') continue;

          assert(Array.isArray(out.workouts), `[${c.label}] workouts 不是数组`);
          assert(Array.isArray(out.favoriteIds), `[${c.label}] favoriteIds 不是数组`);
          assert(Array.isArray(out.customTemplates), `[${c.label}] customTemplates 不是数组`);
          assert(Array.isArray(out.pinnedTemplateIds), `[${c.label}] pinnedTemplateIds 不是数组`);
          assert(Array.isArray(out.bodyEntries), `[${c.label}] bodyEntries 不是数组`);
          assert(Array.isArray(out.prRecords), `[${c.label}] prRecords 不是数组`);
          assert(Array.isArray(out.customExercises), `[${c.label}] customExercises 不是数组`);
          assert(
            out.settings != null && typeof out.settings === 'object' && !Array.isArray(out.settings),
            `[${c.label}] settings 未归一为对象`
          );

          for (const w of out.workouts) {
            assert(w && typeof w === 'object', `[${c.label}] workout 含非对象项`);
            assert(Array.isArray(w.exercises), `[${c.label}] workout.exercises 不是数组`);
            assert(
              typeof w.duration === 'number' && Number.isFinite(w.duration) && w.duration >= 0,
              `[${c.label}] duration 非法: ${w.duration}`
            );
            for (const e of w.exercises) {
              assert(e.exerciseId != null, `[${c.label}] exercise 缺 exerciseId`);
              assert(Array.isArray(e.sets), `[${c.label}] exercise.sets 不是数组`);
              for (const s of e.sets) {
                assert(s && typeof s === 'object', `[${c.label}] set 含非对象项`);
                assert(Number.isFinite(s.weight), `[${c.label}] set.weight 非法`);
                assert(Number.isFinite(s.reps), `[${c.label}] set.reps 非法`);
              }
            }
          }

          for (const t of out.customTemplates) {
            assert(typeof t.id === 'string' && t.id, `[${c.label}] template 缺 id`);
            assert(Array.isArray(t.sessions), `[${c.label}] template.sessions 不是数组`);
            for (const s of t.sessions) {
              assert(Array.isArray(s.exerciseIds), `[${c.label}] session.exerciseIds 不是数组`);
              for (const id of s.exerciseIds) assert(typeof id === 'string', `[${c.label}] exerciseId 未转字符串`);
              assert(
                s.defaults && typeof s.defaults === 'object' && !Array.isArray(s.defaults),
                `[${c.label}] session.defaults 未归一为对象`
              );
            }
          }

          for (const c2 of out.customExercises) {
            assert(typeof c2.id === 'string' && c2.id, `[${c.label}] customExercise 缺 id`);
            assert(typeof c2.name === 'string' && c2.name, `[${c.label}] customExercise 缺 name`);
            assert(Array.isArray(c2.instructions), `[${c.label}] customExercise.instructions 不是数组`);
          }

          if (out.activeWorkout) {
            assert(Array.isArray(out.activeWorkout.exercises), `[${c.label}] activeWorkout.exercises 不是数组`);
            for (const e of out.activeWorkout.exercises) assert(Array.isArray(e.sets), `[${c.label}] activeWorkout set 非数组`);
          }
        }
      },
    },
    {
      name: 'bodyEntries 过滤掉坏项，保留合法项',
      fn() {
        const out = sanitizeState({ bodyEntries: [null, { date: 123 }, { date: '2026-01-01', weight: 70 }, 'x'] });
        eq(out.bodyEntries.length, 1, '保留条数');
        eq(out.bodyEntries[0].date, '2026-01-01', '保留了错误的条目');
      },
    },
    {
      name: 'prRecords 过滤掉缺 exerciseId 的项',
      fn() {
        const out = sanitizeState({ prRecords: [null, 'x', { weight: 100 }, { exerciseId: 'e1', weight: 100 }] });
        eq(out.prRecords.length, 1, '保留条数');
      },
    },
    {
      name: 'favoriteIds 对象输入 → 空数组；合法数组保留',
      fn() {
        eq(sanitizeState({ favoriteIds: { a: 1 } }).favoriteIds.length, 0, '对象未被清空');
        const ok = sanitizeState({ favoriteIds: ['a', 'b'] }).favoriteIds;
        assert(ok.length === 2 && ok[0] === 'a', '合法数组被破坏');
      },
    },
    {
      name: 'duration 归一：NaN→0 / 负数→0 / 小数向下取整',
      fn() {
        const out = sanitizeState({
          workouts: [
            { id: 'w1', name: 'n', date: 'd', duration: NaN, exercises: [] },
            { id: 'w2', name: 'n', date: 'd', duration: -5, exercises: [] },
            { id: 'w3', name: 'n', date: 'd', duration: 3.9, exercises: [] },
          ],
        });
        eq(out.workouts[0].duration, 0, 'NaN');
        eq(out.workouts[1].duration, 0, '负数');
        eq(out.workouts[2].duration, 3, '小数');
      },
    },
    {
      name: 'set.weight / reps 字符串数字可解析，脏值归 0',
      fn() {
        const out = sanitizeState({
          workouts: [{
            id: 'w1', name: 'n', date: 'd', duration: 1,
            exercises: [{ exerciseId: 'e1', sets: [{ id: 's1', weight: '12.5', reps: '8', completed: 'yes' }, { id: 's2', weight: 'abc', reps: null }] }],
          }],
        });
        const sets = out.workouts[0].exercises[0].sets;
        assert(sets[0].weight === 12.5 && sets[0].reps === 8, `可解析值未被还原: ${JSON.stringify(sets[0])}`);
        eq(sets[0].completed, true, 'completed 未布尔化');
        assert(sets[1].weight === 0 && sets[1].reps === 0, `脏值未归 0: ${JSON.stringify(sets[1])}`);
        assert(typeof sets[0].id === 'string' && sets[0].id.length > 0, 'set.id 缺失未补 uid');
      },
    },
    {
      name: 'sanitizeState(null) 不抛异常且原样返回',
      fn() {
        eq(sanitizeState(null), null);
        eq(sanitizeState(undefined), undefined);
        eq(sanitizeState(42), 42);
      },
    },
    {
      name: 'v5：组类型 / RPE / completedAt 在 rehydrate 后必须保留',
      fn() {
        // 这是曾经会踩的坑：sanitize 若只重建白名单字段，用户选的「热身组」
        // 会在每次冷启动后被抹成正式组，总容量凭空虚高。
        const out = sanitizeState({
          workouts: [{
            id: 'w1', name: 'n', date: '2026-03-01T10:00:00.000Z', duration: 600,
            exercises: [{
              exerciseId: 'e1',
              sets: [
                { id: 's1', weight: 20, reps: 10, completed: true, type: 'warmup', rpe: 4 },
                { id: 's2', weight: 100, reps: 5, completed: true, type: 'working', rpe: 8.5, completedAt: 1772349600000 },
              ],
            }],
          }],
        });
        const sets = out.workouts[0].exercises[0].sets;
        eq(sets[0].type, 'warmup', '热身组类型被抹掉');
        eq(sets[1].type, 'working', '正式组类型被抹掉');
        eq(sets[1].rpe, 8.5, 'RPE 被抹掉');
        eq(sets[1].completedAt, 1772349600000, 'completedAt 被抹掉');
      },
    },
    {
      name: 'v5：非法组类型降级为 undefined（按 working 处理）',
      fn() {
        const out = sanitizeState({
          workouts: [{ id: 'w1', date: 'd', exercises: [{ exerciseId: 'e1', sets: [{ id: 's1', weight: 1, reps: 1, type: 'godmode' }] }] }],
        });
        eq(out.workouts[0].exercises[0].sets[0].type, undefined);
      },
    },
    {
      name: 'v5：customExercises 逐项校验，缺 id / name 的记录被丢弃',
      fn() {
        const out = sanitizeState({
          customExercises: [
            null,
            'x',
            { id: 'c1' },                        // 缺 name
            { name: 'no id' },                   // 缺 id
            { id: 'c2', name: '单臂哑铃划船', instructions: ['a', 2] },
          ],
        });
        eq(out.customExercises.length, 1, '保留条数');
        eq(out.customExercises[0].id, 'c2');
        eq(out.customExercises[0].instructions.length, 1, '非字符串 instruction 被过滤');
        eq(sanitizeCustomExercise({ id: 'c', name: '   ' }), null, '空白 name 应被丢弃');
      },
    },
    {
      name: 'settings 归一化：缺失 v5 字段时补齐默认值',
      fn() {
        const out = sanitizeState({ settings: { units: 'lb' } });
        eq(out.settings.units, 'lb', '用户值被覆盖');
        eq(out.settings.defaultRestSeconds, 90, '休息时长未补默认');
        assert(Number.isFinite(out.settings.weeklyGoal), 'weeklyGoal 缺失');
        assert(out.settings.plateConfig && out.settings.plateConfig.barWeight === 20, 'plateConfig 缺失');
        assert(Array.isArray(out.settings.plateConfig.plates) && out.settings.plateConfig.plates.length > 0, 'plates 缺失');
        eq(out.settings.countOnlyWorkingSets, true, 'countOnlyWorkingSets 缺失');
      },
    },
    {
      name: 'settings 归一化：值为 undefined 的键不会冲掉默认值',
      fn() {
        // JSON.stringify 之后 undefined 键会消失，但手改 / 跨版本 payload 常见
        // `{ theme: undefined }` 这种显式 undefined —— 逐字段兜底必须扛住。
        const out = sanitizeState({ settings: { theme: undefined, units: undefined, weeklyGoal: null } });
        assert(out.settings.theme === 'system', `theme 被冲掉: ${out.settings.theme}`);
        assert(out.settings.units === 'kg', `units 被冲掉: ${out.settings.units}`);
        assert(Number.isFinite(out.settings.weeklyGoal), 'weeklyGoal 未补默认');
      },
    },
    {
      name: 'settings 归一化：baseSettings 生效（首启动跟随系统语言）',
      fn() {
        const out = sanitizeState({}, { language: 'en' });
        eq(out.settings.language, 'en', 'baseSettings 未生效');
      },
    },
    {
      name: '幂等性：连洗两次结果一致（不会越洗越脏）',
      fn() {
        const dirty = {
          workouts: [{ id: 'w1', name: 'n', date: 'd', duration: 5, exercises: [{ exerciseId: 'e1', sets: [null, { id: 's1', weight: '10', reps: 5, completed: 1, type: 'dropset' }] }] }],
          customTemplates: [{ id: 't1', name: { zh: 'a', en: 'b' }, sessions: [{ day: 'd', name: { zh: 'x', en: 'y' }, exerciseIds: [1, 'e'], defaults: [] }] }],
          bodyEntries: [null, { date: '2026-01-01' }],
          customExercises: [{ id: 'c1', name: 'x' }],
        };
        const once = sanitizeState(dirty);
        const twice = sanitizeState(once);
        assert(JSON.stringify(once) === JSON.stringify(twice), '二次清洗改变了结果（非幂等）');
      },
    },
    {
      name: 'sanitizeWorkout / sanitizeUserTemplate 单独调用也安全',
      fn() {
        eq(sanitizeWorkout(null), null);
        eq(sanitizeWorkout('x'), null);
        eq(sanitizeUserTemplate({}), null, '缺 id 的模板应被丢弃');
        eq(sanitizeUserTemplate({ id: 't' }), null, '缺 name 的模板应被丢弃');
      },
    },
  ],
};

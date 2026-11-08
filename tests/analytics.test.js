/**
 * analytics 层单测 —— 容量聚合 / 连续天数 / 周目标 / 热力图 / 动作历史。
 *
 * 这一层是「数据面板」「首页周目标」「训练页上次参考」的唯一数据源。
 * 之前同样的口径散落在三个文件里各自漂移（Profile 有昨天宽限、Workout 没有），
 * 所以这里的断言同时锁定语义，防止再次分叉。
 */

const { assert, eq, close } = require('./helpers');
const {
  toDateKey,
  addDays,
  diffDays,
  startOfWeekKey,
  rangeDateKeys,
  isCountedSet,
  sessionStats,
  buildDailyVolumes,
  recentDailyVolumes,
  computeStreaks,
  muscleSetStats,
  exerciseHistory,
  bestEstimated1RM,
  lastSetsFor,
  computeOverview,
  weeklyProgress,
  heatmapLevels,
  averageRestSeconds,
} = require('../src/utils/analytics');

function mkSet(weight, reps, opts = {}) {
  return {
    id: opts.id || 's',
    exerciseId: opts.exerciseId || 'e1',
    weight,
    reps,
    completed: opts.completed !== undefined ? opts.completed : true,
    type: opts.type || 'working',
    rpe: opts.rpe,
    completedAt: opts.completedAt,
  };
}

function mkSession(id, date, exercises, duration = 600) {
  return { id, name: 'session', date, duration, exercises };
}

const ISO = (key) => `${key}T10:00:00.000Z`;

module.exports = {
  name: 'analytics 数据聚合',
  tests: [
    // ---------------- 日期工具 ----------------
    {
      name: 'toDateKey 用本地时区切日（不能用 UTC，否则东八区晚间训练记到明天）',
      fn() {
        eq(toDateKey(new Date(2026, 2, 4, 23, 30)), '2026-03-04', '本地 23:30 应仍算当天');
        eq(toDateKey('2026-03-04T23:30:00+08:00'), toDateKey(new Date(2026, 2, 4, 23, 30)));
        eq(toDateKey(null), '');
        eq(toDateKey('garbage'), '');
        eq(toDateKey(undefined), '');
      },
    },
    {
      name: 'addDays / diffDays / rangeDateKeys 自洽',
      fn() {
        eq(addDays('2026-03-01', 1), '2026-03-02');
        eq(addDays('2026-03-01', -1), '2026-02-28');
        // 跨闰年：2028 是闰年
        eq(addDays('2028-02-28', 1), '2028-02-29');
        eq(diffDays('2026-03-03', '2026-03-01'), 2);
        eq(diffDays('2026-03-01', '2026-03-03'), -2);
        const r = rangeDateKeys('2026-03-03', 3);
        eq(r.length, 3);
        eq(r.join(','), '2026-03-01,2026-03-02,2026-03-03');
        eq(rangeDateKeys('2026-03-03', 0).length, 0);
      },
    },
    {
      name: 'startOfWeekKey 周一起算',
      fn() {
        // 2026-03-04 是周三 → 周一是 2026-03-02
        eq(startOfWeekKey('2026-03-04', 1), '2026-03-02');
        // 周日 2026-03-08 仍归属 03-02 那一周
        eq(startOfWeekKey('2026-03-08', 1), '2026-03-02');
        // 周一起算时，周一自身就是周起点
        eq(startOfWeekKey('2026-03-02', 1), '2026-03-02');
        eq(startOfWeekKey('bad'), null);
      },
    },

    // ---------------- 计数口径 ----------------
    {
      name: 'isCountedSet：只认 completed，且 warmup 可排除',
      fn() {
        assert(isCountedSet(mkSet(100, 5)), '正常组应计入');
        assert(!isCountedSet(mkSet(100, 5, { completed: false })), '未完成组不应计入');
        assert(!isCountedSet(mkSet(100, 0)), '0 次组不应计入');
        assert(!isCountedSet(mkSet(-100, 5)), '负重量不应计入');
        assert(!isCountedSet(mkSet('abc', 5)), '脏值不应计入');
        assert(!isCountedSet(null));
        assert(isCountedSet(mkSet(20, 10, { type: 'warmup' }), {}), '默认口径含热身组');
        assert(!isCountedSet(mkSet(20, 10, { type: 'warmup' }), { countOnlyWorkingSets: true }), '排除热身组');
        assert(isCountedSet(mkSet(20, 10, { type: 'dropset' }), { countOnlyWorkingSets: true }), '递减组仍算正式组');
      },
    },
    {
      name: 'sessionStats：坏数据按 0 处理且不抛异常',
      fn() {
        const s = sessionStats(mkSession('w1', ISO('2026-03-01'), [
          { exerciseId: 'e1', sets: [mkSet(100, 5), mkSet(20, 10, { type: 'warmup' })] },
        ]));
        // 默认口径（countOnlyWorkingSets=false）与 v4 及更早保持一致：
        // 热身组也计入 → 100×5 + 20×10 = 700
        eq(s.volume, 700, '默认口径应含热身组');
        eq(s.sets, 2);
        eq(s.exercises, 1);

        const s2 = sessionStats(mkSession('w2', ISO('2026-03-01'), [
          { exerciseId: 'e1', sets: [mkSet(100, 5), mkSet(20, 10, { type: 'warmup' })] },
        ]), { countOnlyWorkingSets: true });
        eq(s2.volume, 500, '排除热身组后只剩 100×5');

        eq(sessionStats(null).volume, 0);
        eq(sessionStats({ id: 'w', date: 'x', duration: 0 }).volume, 0, 'exercises 缺失');
        eq(sessionStats({ id: 'w', date: 'x', duration: 0, exercises: [null] }).volume, 0, '含 null 项');
        eq(sessionStats({ id: 'w', date: 'x', duration: NaN, exercises: [] }).durationSec, 0, 'NaN 时长');
      },
    },

    // ---------------- 日聚合 ----------------
    {
      name: 'buildDailyVolumes：同日多次训练合并，非法日期丢弃',
      fn() {
        const out = buildDailyVolumes([
          mkSession('w1', ISO('2026-03-01'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }], 600),
          mkSession('w2', ISO('2026-03-01'), [{ exerciseId: 'e2', sets: [mkSet(50, 10)] }], 300),
          mkSession('w3', 'not-a-date', [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
        ]);
        eq(out.length, 1, '同日应合并为一条');
        eq(out[0].date, '2026-03-01');
        eq(out[0].sessions, 2);
        eq(out[0].volume, 1000, '500 + 500');
        eq(out[0].durationSec, 900);
        eq(buildDailyVolumes(null).length, 0);
        eq(buildDailyVolumes({ a: 1 }).length, 0);
      },
    },
    {
      name: 'recentDailyVolumes：补零填充断训日（否则曲线会假装容量暴涨）',
      fn() {
        const out = recentDailyVolumes(
          [mkSession('w1', ISO('2026-03-03'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }])],
          5,
          '2026-03-03'
        );
        eq(out.length, 5);
        eq(out.map((d) => d.date).join(','), '2026-02-27,2026-02-28,2026-03-01,2026-03-02,2026-03-03');
        eq(out[4].volume, 500);
        eq(out[0].volume, 0, '空缺日应为 0 而不是缺项');
        eq(out[0].sessions, 0);
      },
    },

    // ---------------- 连续天数 ----------------
    {
      name: 'computeStreaks：连续计数 + 昨天宽限',
      fn() {
        const keys = ['2026-03-01', '2026-03-02', '2026-03-03'];
        eq(computeStreaks(keys, '2026-03-03').current, 3, '今天练了');
        eq(computeStreaks(keys, '2026-03-04').current, 3, '今天没练 → 宽限到昨天');
        eq(computeStreaks(keys, '2026-03-04', false).current, 0, '关闭宽限后应为 0');
        eq(computeStreaks(keys, '2026-03-06').current, 0, '断了 2 天应为 0');
        eq(computeStreaks([], '2026-03-03').current, 0);
        eq(computeStreaks([], '2026-03-03').longest, 0);
      },
    },
    {
      name: 'computeStreaks：最长纪录能跨过断点',
      fn() {
        const keys = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
        const r = computeStreaks(keys, '2026-03-13');
        eq(r.current, 4);
        eq(r.longest, 4);
        // 最长段在更早（5 天）时不应被当前 streak 覆盖
        const r2 = computeStreaks(
          ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'],
          '2026-03-13'
        );
        eq(r2.longest, 5);
        eq(r2.current, 0);
      },
    },

    // ---------------- 肌群分布 ----------------
    {
      name: 'muscleSetStats：按肌群聚合组数并记录最近训练日',
      fn() {
        const sessions = [
          mkSession('w1', ISO('2026-03-01'), [
            { exerciseId: 'e1', sets: [mkSet(100, 5), mkSet(100, 5)] },
            { exerciseId: 'e2', sets: [mkSet(50, 10)] },
          ]),
          mkSession('w2', ISO('2026-03-05'), [
            { exerciseId: 'e1', sets: [mkSet(110, 3)] },
          ]),
        ];
        const resolve = (id) => (id === 'e1' ? 'chest' : id === 'e2' ? 'back' : null);
        const out = muscleSetStats(sessions, resolve, 30, '2026-03-05');
        eq(out.length, 2);
        const chest = out.find((x) => x.bodyPart === 'chest');
        const back = out.find((x) => x.bodyPart === 'back');
        eq(chest.sets, 3, 'chest 共 3 组');
        eq(chest.lastTrained, '2026-03-05');
        eq(back.sets, 1);
        assert(out[0].sets >= out[1].sets, '应按组数降序');
        // 未知动作（resolve 返回 null）不应污染结果
        eq(muscleSetStats(sessions, () => null, 30, '2026-03-05').length, 0);
      },
    },

    // ---------------- 动作历史 ----------------
    {
      name: 'exerciseHistory：按日期倒序，best1RM 取该次最佳',
      fn() {
        const sessions = [
          mkSession('w1', ISO('2026-03-01'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
          mkSession('w2', ISO('2026-03-08'), [{ exerciseId: 'e1', sets: [mkSet(105, 5), mkSet(90, 10)] }]),
          mkSession('w3', ISO('2026-03-02'), [{ exerciseId: 'e2', sets: [mkSet(50, 10)] }]),
        ];
        const h = exerciseHistory(sessions, 'e1');
        eq(h.length, 2, '只返回 e1 的记录');
        eq(h[0].date, '2026-03-08', '最新在前');
        eq(h[1].date, '2026-03-01');
        assert(h[0].best1RM > h[1].best1RM, 'best1RM 应递增');
        eq(exerciseHistory(sessions, 'nope').length, 0);
        eq(exerciseHistory(null, 'e1').length, 0);
      },
    },
    {
      name: 'lastSetsFor：返回上一次记录；从未练过返回 null（UI 需隐藏而非显示 0kg）',
      fn() {
        const sessions = [
          mkSession('w1', ISO('2026-03-01'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
          mkSession('w2', ISO('2026-03-08'), [{ exerciseId: 'e1', sets: [mkSet(105, 5, { id: 'a' })] }]),
        ];
        const last = lastSetsFor(sessions, 'e1');
        eq(last.date, '2026-03-08');
        eq(last.sets[0].weight, 105);
        eq(lastSetsFor(sessions, 'zzz'), null);
      },
    },
    {
      name: 'bestEstimated1RM：取历史最高，无记录为 0',
      fn() {
        const sessions = [mkSession('w1', ISO('2026-03-01'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }])];
        close(bestEstimated1RM(sessions, 'e1'), 116.7, 0.1);
        eq(bestEstimated1RM(sessions, 'zzz'), 0);
      },
    },

    // ---------------- 总览 ----------------
    {
      name: 'computeOverview：总量 / streak / 活跃天数',
      fn() {
        const now = new Date(2026, 2, 8);
        const sessions = [
          mkSession('w1', ISO('2026-03-07'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }], 600),
          mkSession('w2', ISO('2026-03-08'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }], 1200),
        ];
        const o = computeOverview({ sessions, weeklyGoal: 4, now });
        eq(o.totalSessions, 2);
        eq(o.totalVolume, 1000);
        eq(o.totalSets, 2);
        eq(o.totalDurationSec, 1800);
        eq(o.avgSessionSec, 900);
        eq(o.activeDays30, 2);
        eq(o.weekGoal, 4);
        eq(computeOverview({ sessions: null, now }).totalSessions, 0);
        eq(computeOverview({ sessions: null, now }).avgSessionSec, 0, '空数据不应除零');
      },
    },
    {
      name: 'computeOverview：上周容量为 0 时 volumeDeltaPct 返回 null（而非 Infinity）',
      fn() {
        const now = new Date(2026, 2, 8);
        const only = computeOverview({
          sessions: [mkSession('w1', ISO('2026-03-08'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }])],
          now,
        });
        eq(only.volumeDeltaPct, null, '上周无数据应返回 null');

        const both = computeOverview({
          sessions: [
            mkSession('w1', ISO('2026-03-01'), [{ exerciseId: 'e1', sets: [mkSet(100, 10)] }]), // 上周 1000
            mkSession('w2', ISO('2026-03-08'), [{ exerciseId: 'e1', sets: [mkSet(110, 10)] }]), // 本周 1100
          ],
          now,
        });
        close(both.volumeDeltaPct, 10, 0.2);
        assert(Number.isFinite(both.volumeDeltaPct), '不应产生 Infinity');
      },
    },
    {
      name: 'weeklyProgress：只统计本周（周一起），比例上限 1',
      fn() {
        const now = new Date(2026, 2, 4); // 周三
        const wk = startOfWeekKey(toDateKey(now), 1);
        const sessions = [
          mkSession('w1', ISO(wk), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
          mkSession('w2', ISO(addDays(wk, 1)), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
          // 上周的，不该计入
          mkSession('w3', ISO(addDays(wk, -1)), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }]),
        ];
        const p = weeklyProgress(sessions, 4, 1, now);
        eq(p.done, 2, '只算本周');
        eq(p.goal, 4);
        close(p.ratio, 0.5, 0.001);
        // 超额完成不溢出
        const over = weeklyProgress(sessions, 1, 1, now);
        eq(over.ratio, 1);
        eq(weeklyProgress(sessions, 0, 1, now).ratio, 0, '目标为 0 不应除零');
      },
    },

    // ---------------- 热力图 ----------------
    {
      name: 'heatmapLevels：按分位分档，全空数据全为 0 档',
      fn() {
        const sessions = [mkSession('w1', ISO('2026-03-03'), [{ exerciseId: 'e1', sets: [mkSet(100, 5)] }])];
        const out = heatmapLevels(sessions, 5, '2026-03-03');
        eq(out.length, 5);
        eq(out[4].level, 4, '唯一有训练的一天应落在最高档');
        eq(out[0].level, 0, '空缺日为 0 档');
        const empty = heatmapLevels([], 5, '2026-03-03');
        assert(empty.every((d) => d.level === 0), '全空数据应全为 0 档');
        eq(empty.length, 5, '全空时也必须补齐日期（否则日历格子错位）');
      },
    },

    // ---------------- 组间休息 ----------------
    {
      name: 'averageRestSeconds：过滤误触与中途离开，数据不足返回 null',
      fn() {
        const t0 = Date.parse(ISO('2026-03-01'));
        const sessions = [
          mkSession('w1', ISO('2026-03-01'), [
            { exerciseId: 'e1', sets: [mkSet(100, 5, { completedAt: t0 }), mkSet(100, 5, { completedAt: t0 + 90000 })] },
          ]),
        ];
        eq(averageRestSeconds(sessions), 90);
        eq(averageRestSeconds([]), null);
        // 间隔 2 秒 = 误触连点，应被过滤 → 无有效样本
        const spam = [
          mkSession('w1', ISO('2026-03-01'), [
            { exerciseId: 'e1', sets: [mkSet(100, 5, { completedAt: t0 }), mkSet(100, 5, { completedAt: t0 + 2000 })] },
          ]),
        ];
        eq(averageRestSeconds(spam), null, '过短间隔应被过滤');
      },
    },
  ],
};

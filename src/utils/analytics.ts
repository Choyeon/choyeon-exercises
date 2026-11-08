import type {
  BodyPart,
  DailyVolume,
  ExerciseHistoryEntry,
  MuscleSetStat,
  OneRmFormula,
  StatsOverview,
  WorkoutSession,
  WorkoutSet,
} from '@/types';
import { estimate1RM, setVolume } from './strength';

// ============================================================================
// analytics.ts —— 训练数据聚合层（纯函数）
//
// 为什么单独抽这一层：
//   · 同样的「总容量 / 连续天数 / 周目标」之前散落在 workout.tsx、profile.tsx、
//     store.streakDays() 三处，口径各自漂移（Profile 有「昨天宽限」，Workout 没有）。
//     现在所有派生数字只有一个来源，任何页面调用得到的一定一致。
//   · 纯函数 + 零 RN 依赖 → 可以直接被 Jest 单测覆盖（边界：空数据、坏数据、时区）。
//   · 输入侧的防御比输出侧重要：历史 vault 里 workouts/exercises/sets 任一层
//     都可能是 undefined（见 sanitizeState 的存在理由），这里逐层兜底而不是假设干净。
// ============================================================================

const DAY_MS = 86_400_000;

export interface VolumeOptions {
  /**
   * true  → 只统计正式组（working / dropset / failure / amrap），排除 warmup。
   *          （空杆热身 20kg×10 会把总容量稀释得毫无参考价值）
   * false → 统计所有 completed 组（兼容 v4 及更早的历史口径）
   */
  countOnlyWorkingSets?: boolean;
}

/** 该组类型是否属于「正式组」 */
function isWorkingType(type: WorkoutSet['type']): boolean {
  // 缺省（历史数据没有 type 字段）按 working 处理
  return (type ?? 'working') !== 'warmup';
}

// ---------------------------------------------------------------------------
// 日期工具 —— 统一用「本地时区 YYYY-MM-DD」做聚合键
// （不用 toISOString()，那会按 UTC 切日，东八区晚上 8 点后训练会被记到明天）
// ---------------------------------------------------------------------------

export function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 任意输入 → 本地时区日期键 YYYY-MM-DD；非法输入返回 '' */
export function toDateKey(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 日期键 → 当天 00:00 的 Date（用于加减天 / 比较） */
function keyToDate(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 日期键加减天数（返回新键） */
export function addDays(dateKey: string, delta: number): string {
  const d = keyToDate(dateKey);
  if (!d) return '';
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** 两个日期键相差天数（a - b） */
export function diffDays(a: string, b: string): number {
  const da = keyToDate(a);
  const db = keyToDate(b);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / DAY_MS);
}

/**
 * 这一天属于哪一週的周起始日（默认周一起算，和国内训练 App 习惯一致）。
 * 返回值是周一的日期键。
 */
export function startOfWeekKey(dateKey: string, weekStartsOn: 0 | 1 = 1): string | null {
  const d = keyToDate(dateKey);
  if (!d) return null;
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  const delta = (dow - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - delta);
  return toDateKey(d);
}

/** 生成 [endKey - days + 1 .. endKey] 的日期键数组（升序） */
export function rangeDateKeys(endKey: string, days: number): string[] {
  const safeDays = Math.max(0, Math.floor(days));
  const out: string[] = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    out.push(addDays(endKey, -i));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 计数口径
// ---------------------------------------------------------------------------

/**
 * 该组是否计入统计。
 * 与既有实现保持一致：只认 `completed === true`，且 weight/reps 都必须是有限数。
 * 注意 `reps <= 0` 直接淘汰 —— 用户新建的空组（0 次）不该拉低平均强度。
 */
export function isCountedSet(set: WorkoutSet | null | undefined, opts: VolumeOptions = {}): boolean {
  if (!set) return false;
  if (set.completed !== true) return false;
  const w = Number(set.weight);
  const r = Number(set.reps);
  if (!Number.isFinite(w) || !Number.isFinite(r)) return false;
  if (w < 0 || r <= 0) return false;
  if (opts.countOnlyWorkingSets) return isWorkingType(set.type);
  return true;
}

/** 单组容量 —— 复用 strength.setVolume（内部已做有限性校验） */
export function countedSetVolume(set: WorkoutSet, opts: VolumeOptions = {}): number {
  if (!isCountedSet(set, opts)) return 0;
  return setVolume(Number(set.weight), Number(set.reps));
}

export interface SessionStats {
  volume: number;
  sets: number;
  /** 参与统计的动作数（有至少一组计入） */
  exercises: number;
  durationSec: number;
}

/** 单次训练的聚合。坏数据（exercises/sets 缺失）按 0 处理而不是抛错。 */
export function sessionStats(session: WorkoutSession | null | undefined, opts: VolumeOptions = {}): SessionStats {
  const empty: SessionStats = { volume: 0, sets: 0, exercises: 0, durationSec: 0 };
  if (!session) return empty;

  let volume = 0;
  let sets = 0;
  let exercises = 0;

  if (Array.isArray(session.exercises)) {
    for (const ex of session.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      let exerciseHasSet = false;
      for (const set of ex.sets) {
        if (!isCountedSet(set, opts)) continue;
        volume += setVolume(Number(set.weight), Number(set.reps));
        sets += 1;
        exerciseHasSet = true;
      }
      if (exerciseHasSet) exercises += 1;
    }
  }

  const rawDuration = Number(session.duration);
  return {
    volume,
    sets,
    exercises,
    durationSec: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0,
  };
}

/** 安全取 sessions 数组（历史 vault 防御） */
export function safeSessions(sessions: unknown): WorkoutSession[] {
  return Array.isArray(sessions) ? (sessions.filter(Boolean) as WorkoutSession[]) : [];
}

// ---------------------------------------------------------------------------
// 日聚合（趋势图 / 热力图的最小单元）
// ---------------------------------------------------------------------------

/**
 * 把 sessions 聚合成按日期升序的 DailyVolume[]。
 * date 字段非法（NaN）的训练会被丢弃而不是聚到 1970-01-01 上。
 */
export function buildDailyVolumes(sessions: unknown, opts: VolumeOptions = {}): DailyVolume[] {
  const byDate = new Map<string, DailyVolume>();
  for (const session of safeSessions(sessions)) {
    const key = toDateKey(session.date);
    if (!key) continue;
    const s = sessionStats(session, opts);
    const prev = byDate.get(key);
    if (prev) {
      prev.volume += s.volume;
      prev.sets += s.sets;
      prev.sessions += 1;
      prev.durationSec += s.durationSec;
    } else {
      byDate.set(key, {
        date: key,
        volume: s.volume,
        sets: s.sets,
        sessions: 1,
        durationSec: s.durationSec,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * 取「最近 days 天」的日聚合，并补零填充空缺日期。
 * 趋势图必须补零 —— 否则断训 3 天会让曲线把「周二」直接连到「周五」，
 * 看起来像容量暴涨。
 */
export function recentDailyVolumes(
  sessions: unknown,
  days = 30,
  endDateKey = toDateKey(new Date()),
  opts: VolumeOptions = {}
): DailyVolume[] {
  const keys = rangeDateKeys(endDateKey, days);
  const map = new Map(buildDailyVolumes(sessions, opts).map((d) => [d.date, d]));
  return keys.map((date) => map.get(date) ?? { date, volume: 0, sets: 0, sessions: 0, durationSec: 0 });
}

// ---------------------------------------------------------------------------
// 连续训练天数
// ---------------------------------------------------------------------------

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * 连续训练天数。
 *
 * `grace` 语义（默认 true，与 store.streakDays() 一致）：
 *   今天还没练时，允许从「昨天」开始回数。否则用户早上 9 点打开 App
 *   会看到 streak 从 5 直接掉到 0 —— 那是惩罚而不是激励。
 */
export function computeStreaks(dateKeys: string[], todayKey = toDateKey(new Date()), grace = true): StreakResult {
  const unique = [...new Set(dateKeys.filter(Boolean))].sort();
  if (unique.length === 0) return { current: 0, longest: 0 };

  const set = new Set(unique);

  let current = 0;
  const cursor = todayKey;
  if (!set.has(cursor) && grace) {
    // 从昨天起算
    let c = addDays(cursor, -1);
    while (set.has(c)) {
      current += 1;
      c = addDays(c, -1);
    }
  } else {
    let c = cursor;
    while (set.has(c)) {
      current += 1;
      c = addDays(c, -1);
    }
  }

  // 最长连续：按升序扫描，用 diffDays 判断是否相邻
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (diffDays(unique[i], unique[i - 1]) === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest: Math.max(longest, current) };
}

// ---------------------------------------------------------------------------
// 肌群分布
// ---------------------------------------------------------------------------

/**
 * 近 N 天的肌群组数分布。
 *
 * @param resolveBodyPart exerciseId → BodyPart 的映射（由调用方注入，
 *        analytics 层刻意不 import 数据集，保持可测、可换数据源）。
 */
export function muscleSetStats(
  sessions: unknown,
  resolveBodyPart: (exerciseId: string) => BodyPart | null | undefined,
  days = 30,
  endDateKey = toDateKey(new Date()),
  opts: VolumeOptions = {}
): MuscleSetStat[] {
  const from = addDays(endDateKey, -(Math.max(1, Math.floor(days)) - 1));
  const acc = new Map<BodyPart, MuscleSetStat>();

  for (const session of safeSessions(sessions)) {
    const key = toDateKey(session.date);
    if (!key || key < from || key > endDateKey) continue;
    if (!Array.isArray(session.exercises)) continue;

    for (const ex of session.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      const part = resolveBodyPart(String(ex.exerciseId));
      if (!part) continue;

      let entry = acc.get(part);
      if (!entry) {
        entry = { bodyPart: part, sets: 0, volume: 0, lastTrained: null };
        acc.set(part, entry);
      }
      for (const set of ex.sets) {
        if (!isCountedSet(set, opts)) continue;
        entry.sets += 1;
        entry.volume += setVolume(Number(set.weight), Number(set.reps));
      }
      if (!entry.lastTrained || key > entry.lastTrained) entry.lastTrained = key;
    }
  }

  return [...acc.values()].sort((a, b) => b.sets - a.sets);
}

// ---------------------------------------------------------------------------
// 单动作历史
// ---------------------------------------------------------------------------

/**
 * 某动作的历史表现（按日期倒序，最新在前）。
 * 供动作详情页「历史表现」与训练页「上次参考」共用。
 */
export function exerciseHistory(
  sessions: unknown,
  exerciseId: string,
  formula: OneRmFormula = 'epley',
  opts: VolumeOptions = {}
): ExerciseHistoryEntry[] {
  const target = String(exerciseId);
  const out: ExerciseHistoryEntry[] = [];

  for (const session of safeSessions(sessions)) {
    const key = toDateKey(session.date);
    if (!key) continue;
    if (!Array.isArray(session.exercises)) continue;

    for (const ex of session.exercises) {
      if (!ex || String(ex.exerciseId) !== target || !Array.isArray(ex.sets)) continue;
      const sets: ExerciseHistoryEntry['sets'] = [];
      let volume = 0;
      let best1RM = 0;

      for (const set of ex.sets) {
        if (!set) continue;
        const w = Number(set.weight);
        const r = Number(set.reps);
        if (!Number.isFinite(w) || !Number.isFinite(r)) continue;
        const counted = isCountedSet(set, opts);
        if (counted) volume += setVolume(w, r);
        // 1RM 只从「真正举起过」的组里取，且需要有效次数
        if (w > 0 && r > 0) {
          const e1rm = estimate1RM(w, r, formula);
          if (e1rm > best1RM) best1RM = e1rm;
        }
        sets.push({ weight: w, reps: r, type: set.type, completed: set.completed });
      }

      if (sets.length === 0) continue;
      out.push({ sessionId: session.id, date: key, sets, best1RM, volume });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 该动作的历史最佳 1RM（kg）；无记录返回 0 */
export function bestEstimated1RM(
  sessions: unknown,
  exerciseId: string,
  formula: OneRmFormula = 'epley'
): number {
  let best = 0;
  for (const entry of exerciseHistory(sessions, exerciseId, formula)) {
    if (entry.best1RM > best) best = entry.best1RM;
  }
  return best;
}

/**
 * 该动作「上一次」的组数据 —— 训练页一键填充的数据源。
 * 返回 null 表示从未练过（UI 应隐藏参考行而不是显示 0kg）。
 *
 * 注意：这里**刻意不走** `exerciseHistory()`。后者为了返回完整历史会
 * 遍历所有 session 收集条目后再整体排序（O(W·E + H log H) + 一堆临时数组），
 * 而训练执行页每加一个动作就要问一次「上次多少」，用例数据是 N 个动作 ×
 * 每次全局 workouts 引用变化都要重算 —— 排序那部分完全是白做的。
 * 这里只做一次线性扫描并保留日期最大的那条，语义与 `exerciseHistory(...)[0]`
 * 完全一致（同日期并列时保留 sessions 数组里靠前的那条，与稳定排序一致）。
 */
export function lastSetsFor(
  sessions: unknown,
  exerciseId: string,
  opts: VolumeOptions = {}
): ExerciseHistoryEntry | null {
  const target = String(exerciseId);
  let best: ExerciseHistoryEntry | null = null;

  for (const session of safeSessions(sessions)) {
    const key = toDateKey(session.date);
    if (!key) continue;
    // 已经找到更新的日期：整段后续都无意义（日期只按容器内顺序比较，
    // 与 exerciseHistory 的稳定排序结果等价）。
    if (best && key < best.date) continue;
    if (!Array.isArray(session.exercises)) continue;

    for (const ex of session.exercises) {
      if (!ex || String(ex.exerciseId) !== target || !Array.isArray(ex.sets)) continue;

      const sets: ExerciseHistoryEntry['sets'] = [];
      let volume = 0;
      let best1RM = 0;

      for (const set of ex.sets) {
        if (!set) continue;
        const w = Number(set.weight);
        const r = Number(set.reps);
        if (!Number.isFinite(w) || !Number.isFinite(r)) continue;
        if (isCountedSet(set, opts)) volume += setVolume(w, r);
        // 1RM 只从「真正举起过」的组里取，且需要有效次数
        if (w > 0 && r > 0) {
          const e1rm = estimate1RM(w, r, 'epley');
          if (e1rm > best1RM) best1RM = e1rm;
        }
        sets.push({ weight: w, reps: r, type: set.type, completed: set.completed });
      }

      if (sets.length === 0) continue;
      const entry: ExerciseHistoryEntry = { sessionId: session.id, date: key, sets, best1RM, volume };
      if (!best || entry.date > best.date) best = entry;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// 总览
// ---------------------------------------------------------------------------

export interface OverviewInput {
  sessions: unknown;
  weeklyGoal?: number;
  weekStartsOn?: 0 | 1;
  now?: Date;
  opts?: VolumeOptions;
}

/**
 * 数据面板总览。
 *
 * volumeDeltaPct：本周容量 vs 上周容量的变化百分比。
 * 上周为 0 时返回 null（除以 0 得到 Infinity 会直接把 UI 打崩，
 * 历史上出现过「+∞%」的展示 bug）—— 宁可显示「暂无对比」。
 */
export function computeOverview(input: OverviewInput): StatsOverview {
  const { sessions, weeklyGoal = 0, weekStartsOn = 1, opts = {} } = input;
  const now = input.now ?? new Date();
  const todayKey = toDateKey(now);
  const list = safeSessions(sessions);

  let totalVolume = 0;
  let totalSets = 0;
  let totalDurationSec = 0;
  const dateKeys: string[] = [];

  const weekStart = startOfWeekKey(todayKey, weekStartsOn) ?? todayKey;
  const prevWeekStart = addDays(weekStart, -7);
  let weekVolume = 0;
  let prevWeekVolume = 0;
  let weekSessions = 0;

  for (const session of list) {
    const s = sessionStats(session, opts);
    const key = toDateKey(session.date);
    totalVolume += s.volume;
    totalSets += s.sets;
    totalDurationSec += s.durationSec;
    if (key) dateKeys.push(key);

    if (!key) continue;
    if (key >= weekStart) {
      weekVolume += s.volume;
      weekSessions += 1;
    } else if (key >= prevWeekStart) {
      prevWeekVolume += s.volume;
    }
  }

  const streaks = computeStreaks(dateKeys, todayKey);
  const window30Start = addDays(todayKey, -29);
  const activeDays30 = new Set(dateKeys.filter((k) => k >= window30Start && k <= todayKey)).size;

  let volumeDeltaPct: number | null = null;
  if (prevWeekVolume > 0) {
    volumeDeltaPct = Math.round(((weekVolume - prevWeekVolume) / prevWeekVolume) * 1000) / 10;
  }

  return {
    totalSessions: list.length,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalDurationSec: Math.round(totalDurationSec),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    weekSessions,
    weekGoal: Math.max(0, Math.floor(weeklyGoal)),
    activeDays30,
    avgSessionSec: list.length > 0 ? Math.round(totalDurationSec / list.length) : 0,
    volumeDeltaPct,
  };
}

/** 本周进度：已完成次数 / 目标次数 */
export function weeklyProgress(
  sessions: unknown,
  weeklyGoal: number,
  weekStartsOn: 0 | 1 = 1,
  now = new Date()
): { done: number; goal: number; ratio: number } {
  const goal = Math.max(0, Math.floor(weeklyGoal));
  const todayKey = toDateKey(now);
  const weekStart = startOfWeekKey(todayKey, weekStartsOn) ?? todayKey;
  let done = 0;
  for (const session of safeSessions(sessions)) {
    const key = toDateKey(session.date);
    if (key && key >= weekStart && key <= todayKey) done += 1;
  }
  // ratio 上限 1 —— 超额完成不该让进度条溢出
  return { done, goal, ratio: goal > 0 ? Math.min(1, done / goal) : 0 };
}

/**
 * 日历热力图数据：返回 { date, level } ，level 0-4 按当日容量在该窗口内的分位。
 * 用分位而不是绝对值做分档 —— 否则新手（日均 2t）和老手（日均 20t）
 * 会看到同样深浅的格子，热力图就失去意义了。
 */
export function heatmapLevels(
  sessions: unknown,
  days = 91,
  endDateKey = toDateKey(new Date()),
  opts: VolumeOptions = {}
): { date: string; volume: number; level: 0 | 1 | 2 | 3 | 4 }[] {
  const daily = recentDailyVolumes(sessions, days, endDateKey, opts);
  const positives = daily.map((d) => d.volume).filter((v) => v > 0).sort((a, b) => a - b);
  if (positives.length === 0) {
    return daily.map((d) => ({ date: d.date, volume: d.volume, level: 0 as const }));
  }
  const q = (p: number) => positives[Math.min(positives.length - 1, Math.floor(positives.length * p))];
  const t1 = q(0.25);
  const t2 = q(0.5);
  const t3 = q(0.75);

  return daily.map((d) => {
    if (d.volume <= 0) return { date: d.date, volume: d.volume, level: 0 as const };
    if (d.volume < t1) return { date: d.date, volume: d.volume, level: 1 as const };
    if (d.volume < t2) return { date: d.date, volume: d.volume, level: 2 as const };
    if (d.volume < t3) return { date: d.date, volume: d.volume, level: 3 as const };
    return { date: d.date, volume: d.volume, level: 4 as const };
  });
}

/** 平均组间休息（秒）—— 从 completedAt 差值推导；数据不足返回 null */
export function averageRestSeconds(sessions: unknown): number | null {
  const gaps: number[] = [];
  for (const session of safeSessions(sessions)) {
    if (!Array.isArray(session.exercises)) continue;
    const stamps: number[] = [];
    for (const ex of session.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      for (const set of ex.sets) {
        const t = Number(set?.completedAt);
        if (Number.isFinite(t) && t > 0) stamps.push(t);
      }
    }
    stamps.sort((a, b) => a - b);
    for (let i = 1; i < stamps.length; i++) {
      const gap = (stamps[i] - stamps[i - 1]) / 1000;
      // 只取合理区间：小于 5s 是误触/连点，大于 10min 基本是中途离开
      if (gap >= 5 && gap <= 600) gaps.push(gap);
    }
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

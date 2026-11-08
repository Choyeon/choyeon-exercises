import type {
  AppSettings,
  BodyProfileEntry,
  CustomExercise,
  LanguageCode,
  PersonalRecord,
  PlanSession,
  SetType,
  UserPlanTemplate,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '@/types';
import { withDefaultSettings } from '@/constants/settings';

// ============================================================================
// sanitize.ts —— 持久化层与 UI 层之间的最后一道闸门（纯函数，可被单测直接加载）
//
// 为什么从 useAppStore.ts 里拆出来：
//   · useAppStore.ts 顶层 import 了 AsyncStorage / zustand / expo-localization，
//     任何测试想碰这些函数都得先拉起整个 RN 运行时 —— 所以之前的回归脚本
//     只能用正则从源码里「切」函数体出来跑，脆弱且和真实代码容易漂移。
//   · 这一层本质上没有任何运行时依赖，抽出来之后测试可以 import 真身。
//
// 为什么需要它（背景）：`migrate` 只在 schema version 变化时被 zustand 调用。
// 如果用户在同一版本内因为异常退出、存储配额写坏、或被外部工具改写，导致
// vault 里出现 `exercises: null` / `sets: undefined` 这类结构性损坏，
// `migrate` 不会重跑，坏数据会直接进入组件并在 .reduce/.map/[0] 处抛异常 → 闪退。
// 本模块在每次 rehydrate 时把所有会被 UI 直接消费的字段强制归一化：
//   顶层非数组 → []；workouts[].exercises → 数组且剔除空项；
//   exercises[].sets → 数组且剔除空项 + 补全缺省数值。
// 即便 vault 被写坏，App 也能正常启动（只是丢掉损坏的那一条）。
// ============================================================================

/** 无法跟随系统语言时的兜底（不能从 '@/constants' 引入 —— 那个文件 import 了 react-native） */
const FALLBACK_LANGUAGE: LanguageCode = 'zh';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 组类型白名单校验：非法值一律降级为 undefined（= 按 working 处理） */
export function normalizeSetType(v: unknown): SetType | undefined {
  return v === 'warmup' || v === 'working' || v === 'dropset' || v === 'failure' || v === 'amrap'
    ? v
    : undefined;
}

/** 归一化一组 set 的 v5 新增可选字段（原样保留合法值，非法值归 undefined） */
function normalizeOptionalSetFields(s: any): Pick<WorkoutSet, 'type' | 'rpe' | 'durationSec' | 'completedAt'> {
  return {
    type: normalizeSetType(s?.type),
    rpe: Number.isFinite(Number(s?.rpe)) ? Number(s.rpe) : undefined,
    durationSec: Number.isFinite(Number(s?.durationSec)) ? Number(s.durationSec) : undefined,
    completedAt: Number.isFinite(Number(s?.completedAt)) ? Number(s.completedAt) : undefined,
  };
}

/** 自定义动作校验 —— 缺 id/name 的记录无法在列表里稳定渲染，直接丢弃 */
export function sanitizeCustomExercise(raw: any): CustomExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : null;
  if (!id || !name) return null;
  return {
    id,
    name,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : undefined,
    body_part:
      typeof raw.body_part === 'string' ? (raw.body_part as CustomExercise['body_part']) : 'waist',
    equipment: typeof raw.equipment === 'string' ? raw.equipment : 'other',
    target: typeof raw.target === 'string' ? raw.target : '',
    secondary_muscles: Array.isArray(raw.secondary_muscles)
      ? raw.secondary_muscles.filter((x: any) => typeof x === 'string')
      : [],
    instructions: Array.isArray(raw.instructions)
      ? raw.instructions.filter((x: any) => typeof x === 'string')
      : [],
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString(),
  };
}

/**
 * settings 归一化。
 *
 * @param raw  持久化里读出来的（可能是任意垃圾）
 * @param base 该安装实例的默认值（首启动跟随系统语言），缺省用全局默认
 *
 * 合并顺序是 默认 → base → raw，且走 withDefaultSettings 的逐字段 `??` 兜底，
 * 因此 raw 里「存在但为 undefined」的键不会把默认值冲掉（JSON 序列化常见）。
 */
export function normalizeLegacySettings(
  raw: any,
  base?: Partial<AppSettings>
): AppSettings {
  const out = withDefaultSettings({
    ...(base ?? {}),
    ...(raw && typeof raw === 'object' ? raw : {}),
  });
  if (out.language !== 'zh' && out.language !== 'en') {
    out.language = FALLBACK_LANGUAGE;
  }
  return out;
}

export function normalizeLegacyWorkouts(raw: any): WorkoutSession[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkoutSession[] = [];
  for (const w of raw) {
    if (!w || typeof w !== 'object') continue;
    const exercises: WorkoutExercise[] = Array.isArray(w.exercises)
      ? w.exercises
          .map((e: any) => {
            if (!e || typeof e !== 'object' || typeof e.exerciseId !== 'string') return null;
            const sets: WorkoutSet[] = Array.isArray(e.sets)
              ? e.sets
                  .map((s: any) => {
                    if (!s || typeof s !== 'object') return null;
                    const id = typeof s.id === 'string' && s.id.length ? s.id : uid();
                    const weight = Number.isFinite(Number(s.weight)) ? Number(s.weight) : 0;
                    const reps = Number.isFinite(Number(s.reps)) ? Number(s.reps) : 0;
                    return {
                      id,
                      exerciseId: String(e.exerciseId),
                      weight,
                      reps,
                      completed: !!s.completed,
                      note: typeof s.note === 'string' ? s.note : undefined,
                      ...normalizeOptionalSetFields(s),
                    } as WorkoutSet;
                  })
                  .filter(Boolean) as WorkoutSet[]
              : [];
            return { exerciseId: String(e.exerciseId), sets } as WorkoutExercise;
          })
          .filter(Boolean) as WorkoutExercise[]
      : [];
    const duration = Number.isFinite(Number(w.duration))
      ? Math.max(0, Math.floor(Number(w.duration)))
      : 0;
    out.push({
      id: typeof w.id === 'string' && w.id.length ? w.id : uid(),
      name: typeof w.name === 'string' && w.name.length ? w.name : '训练记录',
      date: typeof w.date === 'string' ? w.date : new Date().toISOString(),
      duration,
      exercises,
      note: typeof w.note === 'string' ? w.note : undefined,
    });
  }
  return out;
}

export function normalizeFavoriteIds(raw: any): string[] {
  return Array.isArray(raw) ? raw.filter((v) => typeof v === 'string') : [];
}

const EMPTY_WORKOUT = (): WorkoutSession => ({
  id: uid(),
  name: '训练记录',
  date: new Date().toISOString(),
  duration: 0,
  exercises: [],
});

export function sanitizeWorkout(raw: any): WorkoutSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const base = EMPTY_WORKOUT();
  const exercises: WorkoutExercise[] = Array.isArray(raw.exercises)
    ? raw.exercises
        .map((e: any): WorkoutExercise | null => {
          if (!e || typeof e !== 'object' || e.exerciseId == null) return null;
          const sets: WorkoutSet[] = Array.isArray(e.sets)
            ? e.sets
                .map((s: any): WorkoutSet | null => {
                  if (!s || typeof s !== 'object') return null;
                  return {
                    id: typeof s.id === 'string' && s.id ? s.id : uid(),
                    exerciseId: String(e.exerciseId),
                    weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 0,
                    reps: Number.isFinite(Number(s.reps)) ? Number(s.reps) : 0,
                    completed: !!s.completed,
                    note: typeof s.note === 'string' ? s.note : undefined,
                    // -- v5 字段必须原样保留：否则每次 rehydrate 都会把组类型 / RPE
                    //    抹成 undefined，表现为「用户选了热身组，重开 App 全变正式组」。
                    ...normalizeOptionalSetFields(s),
                  };
                })
                .filter(Boolean) as WorkoutSet[]
            : [];
          return { exerciseId: String(e.exerciseId), sets };
        })
        .filter(Boolean) as WorkoutExercise[]
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : base.name,
    date: typeof raw.date === 'string' && raw.date ? raw.date : base.date,
    duration: Number.isFinite(Number(raw.duration))
      ? Math.max(0, Math.floor(Number(raw.duration)))
      : 0,
    exercises,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

/** 深拷贝 + 校验单个 PlanSession，确保 exerciseIds/defaults 可用。 */
export function sanitizeUserTemplate(raw: any): UserPlanTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.id || typeof raw.id !== 'string') return null;
  if (!raw.name || typeof raw.name !== 'object') return null;
  const sessions: PlanSession[] = Array.isArray(raw.sessions)
    ? raw.sessions
        .map((s: any): PlanSession | null => {
          if (!s || typeof s !== 'object') return null;
          return {
            day: typeof s.day === 'string' ? s.day : '',
            name:
              s.name && typeof s.name === 'object'
                ? { zh: String(s.name.zh ?? ''), en: String(s.name.en ?? '') }
                : { zh: '', en: '' },
            exerciseIds: Array.isArray(s.exerciseIds)
              ? s.exerciseIds.filter((x: any) => x != null).map(String)
              : [],
            defaults:
              s.defaults && typeof s.defaults === 'object' && !Array.isArray(s.defaults)
                ? s.defaults
                : {},
          };
        })
        .filter(Boolean) as PlanSession[]
    : [];
  return {
    ...(raw as UserPlanTemplate),
    id: raw.id,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    sessions,
    pinned: !!raw.pinned,
  } as UserPlanTemplate;
}

/** 顶层状态整形：任何 rehydrate 之后都会跑一遍。 */
export function sanitizeState(state: any, baseSettings?: Partial<AppSettings>): any {
  if (!state || typeof state !== 'object') return state;
  return {
    ...state,
    workouts: Array.isArray(state.workouts)
      ? (state.workouts.map(sanitizeWorkout).filter(Boolean) as WorkoutSession[])
      : [],
    favoriteIds: normalizeFavoriteIds(state.favoriteIds),
    customTemplates: Array.isArray(state.customTemplates)
      ? (state.customTemplates.map(sanitizeUserTemplate).filter(Boolean) as UserPlanTemplate[])
      : [],
    pinnedTemplateIds: Array.isArray(state.pinnedTemplateIds)
      ? state.pinnedTemplateIds.filter((v: any) => typeof v === 'string')
      : [],
    bodyEntries: Array.isArray(state.bodyEntries)
      ? state.bodyEntries.filter(
          (b: any) => b && typeof b === 'object' && typeof b.date === 'string'
        )
      : [],
    prRecords: Array.isArray(state.prRecords)
      ? state.prRecords.filter((p: any) => p && typeof p === 'object' && p.exerciseId != null)
      : [],
    customExercises: Array.isArray(state.customExercises)
      ? (state.customExercises.map(sanitizeCustomExercise).filter(Boolean) as CustomExercise[])
      : [],
    settings: normalizeLegacySettings(state.settings ?? {}, baseSettings),
    // activeWorkout 不持久化，但防御性归一化：若被外部写入也保证结构完整
    activeWorkout:
      state.activeWorkout && typeof state.activeWorkout === 'object'
        ? {
            ...state.activeWorkout,
            exercises: Array.isArray(state.activeWorkout.exercises)
              ? state.activeWorkout.exercises.filter(
                  (e: any) => e && typeof e === 'object' && Array.isArray(e.sets)
                )
              : [],
          }
        : null,
  };
}

/** 便捷类型守卫：把任意输入强制成安全的 BodyProfileEntry[] */
export function sanitizeBodyEntries(raw: any): BodyProfileEntry[] {
  return Array.isArray(raw)
    ? raw.filter((b: any) => b && typeof b === 'object' && typeof b.date === 'string')
    : [];
}

/** 便捷类型守卫：把任意输入强制成安全的 PersonalRecord[] */
export function sanitizePrRecords(raw: any): PersonalRecord[] {
  return Array.isArray(raw)
    ? raw.filter((p: any) => p && typeof p === 'object' && p.exerciseId != null)
    : [];
}

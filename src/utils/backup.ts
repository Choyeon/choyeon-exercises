import type {
  AppSettings,
  BackupPayload,
  BodyProfileEntry,
  CustomExercise,
  PersonalRecord,
  PlanSession,
  UserPlanTemplate,
  WorkoutSession,
  WorkoutSet,
} from '@/types';
import { withDefaultSettings } from '@/constants/settings';

// ============================================================================
// backup.ts —— 本地备份的序列化 / 反序列化 / 校验（纯 JS，零新增依赖）
//
// 设计取舍：
//   · 不引入 expo-file-system / expo-sharing / expo-document-picker。
//     本 App 的定位是「纯离线工具」，多一个原生模块就多一份
//     权限声明与审核风险（尤其 Android 存储权限）。
//   · 备份形态 = 一段 JSON 文本。导出时展示在可全选复制的文本框里
//     （+ 尝试写系统剪贴板），导入时直接粘贴。用户可以自己存到
//     备忘录 / 邮件 / 任何地方，比限定在某个目录更耐用。
//   · 导入必须「宽容」：宁可丢掉几条坏记录，也不要整个导入失败。
//     用户手动编辑过文本、或者跨版本导入都是真实场景。
// ============================================================================

export const BACKUP_APP_ID = 'choyeon-gym' as const;
export const BACKUP_VERSION = 1;

export type BackupErrorCode =
  | 'empty'
  | 'notJson'
  | 'notObject'
  | 'wrongApp'
  | 'unsupportedVersion'
  | 'noData';

export type ParseBackupResult =
  | { ok: true; payload: BackupPayload; warnings: BackupWarning[] }
  | { ok: false; error: BackupErrorCode };

export type BackupWarning = 'droppedWorkouts' | 'droppedTemplates' | 'droppedBody' | 'droppedPrs' | 'droppedCustomExercises' | 'droppedSettings';

// ---------------------------------------------------------------------------
// 原始值强制转换工具（导入路径上一切都不可信）
// ---------------------------------------------------------------------------

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 生成 id —— 导入路径上缺失 id 的记录需要补一个，否则列表 key 会撞车 */
function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// 分片校验
// ---------------------------------------------------------------------------

function parseSet(raw: unknown, exerciseId: string): WorkoutSet | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id) || makeId('set');
  // weight/reps 非法直接淘汰：一条 NaN 会污染整页的容量统计
  const weight = num(raw.weight, -1);
  const reps = num(raw.reps, -1);
  if (weight < 0 || reps < 0) return null;
  const type = raw.type;
  return {
    id,
    exerciseId: str(raw.exerciseId) || exerciseId,
    weight,
    reps,
    completed: bool(raw.completed, true),
    note: typeof raw.note === 'string' ? raw.note : undefined,
    type:
      type === 'warmup' || type === 'working' || type === 'dropset' || type === 'failure' || type === 'amrap'
        ? type
        : undefined,
    rpe: Number.isFinite(Number(raw.rpe)) ? Number(raw.rpe) : undefined,
    durationSec: Number.isFinite(Number(raw.durationSec)) ? Number(raw.durationSec) : undefined,
    completedAt: Number.isFinite(Number(raw.completedAt)) ? Number(raw.completedAt) : undefined,
  };
}

function parseWorkout(raw: unknown): WorkoutSession | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id) || makeId('w');
  const date = str(raw.date);
  // date 是整条记录的锚点（聚合、排序、streak 全靠它），非法就丢弃
  if (!date || Number.isNaN(new Date(date).getTime())) return null;

  const exercises = asArray(raw.exercises)
    .map((e) => {
      if (!isObj(e)) return null;
      const exId = str(e.exerciseId);
      if (!exId) return null;
      const sets = asArray(e.sets)
        .map((s) => parseSet(s, exId))
        .filter((s): s is WorkoutSet => s !== null);
      return { exerciseId: exId, sets };
    })
    .filter((e): e is { exerciseId: string; sets: WorkoutSet[] } => e !== null);

  return {
    id,
    name: str(raw.name) || 'Workout',
    date,
    duration: Math.max(0, num(raw.duration, 0)),
    exercises,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function parseTemplate(raw: unknown): UserPlanTemplate | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const name = isObj(raw.name) ? { zh: str(raw.name.zh), en: str(raw.name.en) } : { zh: '', en: '' };
  const description = isObj(raw.description)
    ? { zh: str(raw.description.zh), en: str(raw.description.en) }
    : { zh: '', en: '' };
  const level = raw.level;
  const goal = raw.goal;
  const sessions = asArray(raw.sessions)
    .map((s): PlanSession | null => {
      if (!isObj(s)) return null;
      const defaults: Record<string, { sets: number; reps: number; restSec: number; tempo?: string }> = {};
      if (isObj(s.defaults)) {
        for (const [k, v] of Object.entries(s.defaults)) {
          if (!isObj(v)) continue;
          defaults[k] = {
            sets: Math.max(0, num(v.sets, 0)),
            reps: Math.max(0, num(v.reps, 0)),
            restSec: Math.max(0, num(v.restSec, 90)),
            tempo: typeof v.tempo === 'string' ? v.tempo : undefined,
          };
        }
      }
      return {
        day: str(s.day),
        name: isObj(s.name) ? { zh: str(s.name.zh), en: str(s.name.en) } : { zh: '', en: '' },
        exerciseIds: asArray(s.exerciseIds).map((x) => String(x)),
        defaults,
      };
    })
    .filter((s): s is PlanSession => s !== null);

  return {
    id,
    name,
    description,
    level:
      level === 'beginner' || level === 'intermediate' || level === 'advanced' ? level : 'beginner',
    goal:
      goal === 'hypertrophy' ||
      goal === 'strength' ||
      goal === 'conditioning' ||
      goal === 'fat-loss' ||
      goal === 'maintenance' ||
      goal === 'mobility'
        ? goal
        : 'maintenance',
    daysPerWeek: ([3, 4, 5, 6].includes(num(raw.daysPerWeek, 3)) ? num(raw.daysPerWeek, 3) : 3) as UserPlanTemplate['daysPerWeek'],
    durationMinPerSession: ([30, 45, 60, 75, 90, 120].includes(num(raw.durationMinPerSession, 45))
      ? num(raw.durationMinPerSession, 45)
      : 45) as UserPlanTemplate['durationMinPerSession'],
    equipmentRequired: asArray(raw.equipmentRequired).map((x) => String(x)),
    warmupId: typeof raw.warmupId === 'string' ? raw.warmupId : undefined,
    cooldownId: typeof raw.cooldownId === 'string' ? raw.cooldownId : undefined,
    sessions,
    sourceId: typeof raw.sourceId === 'string' ? raw.sourceId : null,
    createdAt: str(raw.createdAt) || new Date().toISOString(),
    pinned: bool(raw.pinned, false),
  };
}

function parseBodyEntry(raw: unknown): BodyProfileEntry | null {
  if (!isObj(raw)) return null;
  const date = str(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const metrics: BodyProfileEntry['metrics'] = {};
  if (isObj(raw.metrics)) {
    for (const [k, v] of Object.entries(raw.metrics)) {
      const n = Number(v);
      if (Number.isFinite(n)) metrics[k as keyof BodyProfileEntry['metrics']] = n;
    }
  }
  if (Object.keys(metrics).length === 0) return null;
  return {
    id: str(raw.id) || makeId('body'),
    date,
    metrics,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    createdAt: str(raw.createdAt) || new Date().toISOString(),
  };
}

function parsePr(raw: unknown): PersonalRecord | null {
  if (!isObj(raw)) return null;
  const exerciseId = str(raw.exerciseId);
  const weight = num(raw.weight, -1);
  if (!exerciseId || weight < 0) return null;
  return {
    id: str(raw.id) || makeId('pr'),
    exerciseId,
    weight,
    reps: Math.max(0, num(raw.reps, 0)),
    date: str(raw.date) || new Date().toISOString().slice(0, 10),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    createdAt: str(raw.createdAt) || new Date().toISOString(),
  };
}

function parseCustomExercise(raw: unknown): CustomExercise | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : undefined,
    body_part: str(raw.body_part, 'waist') as CustomExercise['body_part'],
    equipment: str(raw.equipment, 'other'),
    target: str(raw.target, ''),
    secondary_muscles: asArray(raw.secondary_muscles).map((x) => String(x)),
    instructions: asArray(raw.instructions).map((x) => String(x)),
    createdAt: str(raw.createdAt) || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export interface BackupSource {
  settings: AppSettings;
  favoriteIds: string[];
  workouts: WorkoutSession[];
  customTemplates: UserPlanTemplate[];
  pinnedTemplateIds: string[];
  bodyEntries: BodyProfileEntry[];
  prRecords: PersonalRecord[];
  customExercises?: CustomExercise[];
}

/** 组装备份载荷（不写盘、不联网，纯内存） */
export function createBackup(src: BackupSource): BackupPayload {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: withDefaultSettings(src.settings),
    favoriteIds: (src.favoriteIds ?? []).map(String),
    workouts: (src.workouts ?? []).filter(Boolean),
    customTemplates: (src.customTemplates ?? []).filter(Boolean),
    pinnedTemplateIds: (src.pinnedTemplateIds ?? []).map(String),
    bodyEntries: (src.bodyEntries ?? []).filter(Boolean),
    prRecords: (src.prRecords ?? []).filter(Boolean),
    customExercises: (src.customExercises ?? []).filter(Boolean),
  };
}

/**
 * 序列化为 JSON 文本。
 * 用 2 空格缩进 —— 用户可能要肉眼检查/手改，压缩成一行的 JSON 没法用。
 */
export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** 备份文本的大致体积（KB），导出前给用户一个心理预期 */
export function backupSizeKb(text: string): number {
  // Blob 不可用（RN 环境），用 UTF-8 近似：中文按 3 字节估
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
  }
  return Math.round((bytes / 1024) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 导入
// ---------------------------------------------------------------------------

/**
 * 解析并校验备份文本。
 *
 * 宽容策略：逐条校验，坏记录静默丢弃并把原因放进 warnings。
 * 只有「整体都不是本 App 的备份」才返回失败 —— 那是用户粘错了东西。
 */
export function parseBackup(text: string | null | undefined): ParseBackupResult {
  if (typeof text !== 'string' || text.trim().length === 0) return { ok: false, error: 'empty' };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }
  if (!isObj(raw)) return { ok: false, error: 'notObject' };
  if (str(raw.app) !== BACKUP_APP_ID) return { ok: false, error: 'wrongApp' };

  const version = num(raw.version, 0);
  // 只允许「同版本或更旧」；来自未来版本的备份字段未知，强解会写坏 vault
  if (version <= 0 || version > BACKUP_VERSION) return { ok: false, error: 'unsupportedVersion' };

  const warnings: BackupWarning[] = [];

  const rawWorkouts = asArray(raw.workouts);
  const workouts = rawWorkouts.map(parseWorkout).filter((w): w is WorkoutSession => w !== null);
  if (workouts.length !== rawWorkouts.length && rawWorkouts.length > 0) warnings.push('droppedWorkouts');

  const rawTemplates = asArray(raw.customTemplates);
  const customTemplates = rawTemplates.map(parseTemplate).filter((t): t is UserPlanTemplate => t !== null);
  if (customTemplates.length !== rawTemplates.length && rawTemplates.length > 0) warnings.push('droppedTemplates');

  const rawBody = asArray(raw.bodyEntries);
  const bodyEntries = rawBody.map(parseBodyEntry).filter((b): b is BodyProfileEntry => b !== null);
  if (bodyEntries.length !== rawBody.length && rawBody.length > 0) warnings.push('droppedBody');

  const rawPrs = asArray(raw.prRecords);
  const prRecords = rawPrs.map(parsePr).filter((p): p is PersonalRecord => p !== null);
  if (prRecords.length !== rawPrs.length && rawPrs.length > 0) warnings.push('droppedPrs');

  const rawCustom = asArray(raw.customExercises);
  const customExercises = rawCustom.map(parseCustomExercise).filter((c): c is CustomExercise => c !== null);
  if (customExercises.length !== rawCustom.length && rawCustom.length > 0) warnings.push('droppedCustomExercises');

  // settings 缺失不算「坏记录」，用默认值补上即可（旧版本备份没有 v5 字段是常态）
  let settings: AppSettings;
  if (isObj(raw.settings)) {
    settings = withDefaultSettings(raw.settings as Partial<AppSettings>);
    if (raw.settings.plateConfig == null) warnings.push('droppedSettings');
  } else {
    settings = withDefaultSettings(null);
    warnings.push('droppedSettings');
  }

  const favoriteIds = asArray(raw.favoriteIds).map(String).filter(Boolean);
  const pinnedTemplateIds = asArray(raw.pinnedTemplateIds).map(String).filter(Boolean);

  const hasAny =
    workouts.length > 0 ||
    customTemplates.length > 0 ||
    bodyEntries.length > 0 ||
    prRecords.length > 0 ||
    customExercises.length > 0 ||
    favoriteIds.length > 0;
  if (!hasAny) return { ok: false, error: 'noData' };

  return {
    ok: true,
    payload: {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      exportedAt: str(raw.exportedAt) || new Date().toISOString(),
      settings,
      favoriteIds,
      workouts,
      customTemplates,
      pinnedTemplateIds,
      bodyEntries,
      prRecords,
      customExercises,
    },
    warnings,
  };
}

/** 备份摘要 —— 导入确认弹窗里展示「将导入 N 条训练」 */
export function summarizeBackup(payload: BackupPayload): {
  workouts: number;
  sets: number;
  templates: number;
  bodyEntries: number;
  prRecords: number;
  customExercises: number;
  favorites: number;
  exportedAt: string | null;
} {
  let sets = 0;
  for (const w of payload.workouts) {
    if (Array.isArray(w.exercises)) {
      for (const e of w.exercises) {
        if (Array.isArray(e.sets)) sets += e.sets.length;
      }
    }
  }
  return {
    workouts: payload.workouts.length,
    sets,
    templates: payload.customTemplates.length,
    bodyEntries: payload.bodyEntries.length,
    prRecords: payload.prRecords.length,
    customExercises: payload.customExercises.length,
    favorites: payload.favoriteIds.length,
    exportedAt: payload.exportedAt || null,
  };
}

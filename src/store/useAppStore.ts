import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  AppSettings,
  LanguageCode,
  UserPlanTemplate,
  BodyProfileEntry,
  RestTimerRuntime,
  PlanSession,
  PersonalRecord,
  CustomExercise,
  ExerciseHistoryEntry,
  SetType,
} from '@/types';
import { STORAGE_KEYS, DEFAULT_LANGUAGE } from '@/constants';
import { withDefaultSettings } from '@/constants/settings';
import {
  uid,
  sanitizeState,
  normalizeLegacySettings,
  normalizeLegacyWorkouts,
  normalizeFavoriteIds,
} from '@/store/sanitize';
import { lastSetsFor, weeklyProgress } from '@/utils/analytics';
import { createBackup, parseBackup, serializeBackup, summarizeBackup } from '@/utils/backup';
import type { BackupPayload } from '@/types';
import {
  setAppLanguage,
  i18n as i18nInstance,
  normalizeLanguage,
  detectInitialLanguage,
} from '@/i18n';
import PRESET_PLANS_JSON from '@/data/plans.json';
import type { PlanTemplate } from '@/types';

// Used as a last-resort fallback when i18n hasn't finished bootstrapping and
// the caller needs a session name Right Now (tm).  Only `zh` and `en` are
// officially supported UI locales; the wider LanguageCode union covers
// exercise instruction translations.  normalizeLanguage() gates every read
// so a regional variant like en-US / zh-Hant always collapses to `zh` or
// `en`; the remaining keys are therefore passive safe-defaults in case a
// caller forgets the normalizer.
const DEFAULT_SESSION_NAME_FALLBACK: Record<LanguageCode, string> = {
  zh: '今日训练',
  en: "Today's session",
  es: "Today's session",
  it: "Today's session",
  tr: "Today's session",
  ru: "Today's session",
  hi: "Today's session",
  pl: "Today's session",
  ko: "Today's session",
  fr: "Today's session",
  ja: "Today's session",
};

/**
 * A tiny wrapper over AsyncStorage that maps STORAGE_KEYS into a single
 * "choyeon/vault" payload, with explicit schema versioning.  Keeping a
 * single storage key makes migrations trivial and avoids broken partial
 * state when the user upgrades between settings/workout schema bumps.
 */
// ⚠️ 存储 key 是「槽位名」，不是版本号 —— 绝对不要随 schema 版本改名。
// 一旦改成 '@choyeon/vault/v5'，persist 会去读一个不存在的 key，
// 老用户的所有训练历史会在升级后静默消失（且无法找回）。
// 升级只改下面的 PERSIST_VERSION，让 zustand 调用 migrate() 做原地转换。
const VAULT_KEY = '@choyeon/vault/v4';
const PERSIST_VERSION = 5;

interface PersistedShape {
  v: number;
  settings: AppSettings;
  favoriteIds: string[];
  workouts: WorkoutSession[];
  // -- v3 新增:
  customTemplates: UserPlanTemplate[];     // 用户自建模板 = 预置模板克隆 + 新建
  pinnedTemplateIds: string[];            // 最多 3 个 home 横滑置顶
  bodyEntries: BodyProfileEntry[];        // 身体数据记录
  // -- v4 新增: 个人 PR 记录列表
  prRecords: PersonalRecord[];
  // -- v5 新增: 用户自建动作
  customExercises: CustomExercise[];
}

const PRESET_PLANS = PRESET_PLANS_JSON as unknown as PlanTemplate[];

/**
 * 「更强」的唯一定义 —— 重量更高即更强，等重则次数更高更强。
 *
 * 之前这条口径散落在 endWorkout 的内联表达式、checkAndRecordPR 的内联表达式
 * 和 getBestPR 的排序比较器三处，一旦调整很容易漏改一处，产生「两个 PR 判定
 * 不一致」的诡异结果。收敛成一个谓词后三处共用同一套语义。
 */
function isStrongerSet(
  weight: number,
  reps: number,
  bestWeight: number,
  bestReps: number
): boolean {
  return weight > bestWeight || (weight === bestWeight && reps > bestReps);
}

const appStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      /* swallow to prevent UI crashes */
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      /* swallow */
    }
  },
};

async function migrate(persisted: any, version: number): Promise<any> {
  // If the payload never went through the vault, the `persisted` object may
  // be a partial shape emitted by earlier persist configs.  In that case try
  // to pull the legacy per-slice AsyncStorage keys as a best-effort merge.
  let settings: any = persisted?.settings;
  let favoriteIds: any = persisted?.favoriteIds;
  let workouts: any = persisted?.workouts;

  if (!settings || !favoriteIds || !workouts) {
    try {
      const [sLeg, fLeg, wLeg] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.FAVORITES),
        AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS),
      ]);
      if (sLeg) {
        const parsed = JSON.parse(sLeg);
        settings = settings ?? parsed?.state?.settings ?? parsed?.settings ?? parsed;
      }
      if (fLeg) {
        const parsed = JSON.parse(fLeg);
        favoriteIds = favoriteIds ?? parsed?.state?.favoriteIds ?? parsed?.favoriteIds ?? parsed;
      }
      if (wLeg) {
        const parsed = JSON.parse(wLeg);
        workouts = workouts ?? parsed?.state?.workouts ?? parsed?.workouts ?? parsed;
      }
    } catch {
      /* ignore legacy parse errors */
    }
  }

  const shape: PersistedShape = {
    v: PERSIST_VERSION,
    settings: normalizeLegacySettings(settings ?? {}, INITIAL_SETTINGS),
    favoriteIds: normalizeFavoriteIds(favoriteIds),
    workouts: normalizeLegacyWorkouts(workouts),
    customTemplates: [],
    pinnedTemplateIds: [],
    bodyEntries: [],
    prRecords: [],
    // -- v5
    customExercises: [],
  };
  // -- v3 新增字段安全初始化（从 v2 / v1 / legacy 进入 v3 时）
  shape.customTemplates = Array.isArray((persisted as any)?.customTemplates)
    ? (persisted as any).customTemplates
    : [];
  shape.pinnedTemplateIds = Array.isArray((persisted as any)?.pinnedTemplateIds)
    ? (persisted as any).pinnedTemplateIds.filter((v: any) => typeof v === 'string')
    : [];
  shape.bodyEntries = Array.isArray((persisted as any)?.bodyEntries)
    ? (persisted as any).bodyEntries
    : [];
  shape.prRecords = Array.isArray((persisted as any)?.prRecords) ? (persisted as any).prRecords : [];
  // -- v5: 用户自建动作
  shape.customExercises = Array.isArray((persisted as any)?.customExercises)
    ? (persisted as any).customExercises
    : [];

  // version tracking: zustand persist wraps the shape in { state, version }
  // at its outer level.  Here we return the inner state, and persist will
  // stamp version=PERSIST_VERSION on its own envelope.
  // Use `satisfies` first so TypeScript enforces PersistedShape against the
  // returned payload (catches forgotten fields on future schema bumps).
  const typed = shape satisfies PersistedShape;
  // 防御纵深：migrate 的输出也过一遍 sanitizeState。
  // 上面的 customTemplates / bodyEntries / prRecords 是直接从旧 payload 拷过来的，
  // 未逐项校验；虽然 rehydrate 之后 merge() 还会再洗一次，但不应依赖调用顺序 ——
  // 一旦 zustand 未来调整生命周期，脏数据就会直接进 store 并在渲染期炸掉。
  return sanitizeState(typed, INITIAL_SETTINGS) as unknown as any;
}

interface AppState {
  // ============ SETTINGS ============
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setSettings: (patch: Partial<AppSettings>) => void; // alias for screens that expect setSettings

  // ============ FAVORITES ============
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // ============ WORKOUT HISTORY ============
  workouts: WorkoutSession[];
  addWorkout: (workout: Omit<WorkoutSession, 'id' | 'date'>) => void;
  deleteWorkout: (id: string) => void;
  clearAllWorkouts: () => void;
  resetAllData: () => void; // clear everything + favorites + settings back to defaults

  // ============ ACTIVE WORKOUT ============
  activeWorkout: {
    startedAt: number | null;
    exercises: WorkoutExercise[];
    name: string;
  } | null;
  startWorkout: (name?: string) => void;
  endWorkout: (note?: string) => { session: WorkoutSession; newPRs: PersonalRecord[] } | null;
  cancelWorkout: () => void;
  addExerciseToActive: (exerciseId: string) => void;
  removeExerciseFromActive: (exerciseId: string) => void;
  addSetToExercise: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>
  ) => void;

  // ============ STATS ============
  totalVolumeKg: () => number;
  totalWorkouts: () => number;
  streakDays: () => number;
  /**
   * 某动作「上一次」的组记录 —— 训练执行页一键填充的数据源。
   * 从未练过返回 null（UI 应隐藏参考行，而不是显示 0kg×0）。
   */
  lastSetsFor: (exerciseId: string) => ExerciseHistoryEntry | null;
  /** 本周训练进度（已完成 / 目标 / 比例） */
  weeklyProgress: () => { done: number; goal: number; ratio: number };

  // ============ TEMPLATES (v3) ============
  /** 返回 6 个预置训练模板（只读，浅拷贝） */
  listPresetTemplates: () => PlanTemplate[];
  /** 我的模板（clone 预置 + 自建） */
  customTemplates: UserPlanTemplate[];
  /** home 横滑置顶 id 列表（最多 3 个，前端自行限制） */
  pinnedTemplateIds: string[];
  /** 克隆一个预置模板到我的模板（深拷贝 id/名称，重置 pinned=false） */
  cloneTemplate: (presetId: string) => UserPlanTemplate | null;
  /** 新建或覆盖保存自定义模板（id 存在=覆盖，不存在=新建） */
  saveCustomTemplate: (
    t: Omit<UserPlanTemplate, 'id' | 'createdAt'> & { id?: string }
  ) => UserPlanTemplate;
  /** 删除自定义模板（同步从 pinnedTemplateIds 中移除） */
  deleteCustomTemplate: (id: string) => void;
  /** Pin 置顶 / 取消置顶 */
  togglePinTemplate: (id: string) => void;
  /**
   * 从模板开启训练。
   * - 如果没有 activeWorkout：调用 startWorkout(name) 后填充 exercises
   * - 如果有 activeWorkout：追加 exercises（去重）
   * sessionIdx=第几个训练日 默认 0；sessionNameOverride 会替换模板 session name
   */
  startWorkoutFromTemplate: (
    templateId: string,
    sessionIdx?: number,
    sessionNameOverride?: string
  ) => void;

  // ============ BODY METRICS (v3) ============
  bodyEntries: BodyProfileEntry[];
  addBodyEntry: (
    e: Omit<BodyProfileEntry, 'id' | 'createdAt'> & { id?: string }
  ) => BodyProfileEntry;
  updateBodyEntry: (
    id: string,
    patch: { metrics?: BodyProfileEntry['metrics']; note?: string; date?: string }
  ) => void;
  deleteBodyEntry: (id: string) => void;

  // ============ REST TIMER (runtime only, 不持久化) ============
  restTimer: RestTimerRuntime;
  startRestTimer: (seconds: number, context?: RestTimerRuntime['nextContext']) => void;
  /** ±10 秒调节 */
  adjustRestTimer: (deltaSeconds: number) => void;
  /** 立即结束计时 = skip */
  stopRestTimer: () => void;

  // ============ PR / PERSONAL RECORDS (v4, 持久化) ============
  prRecords: PersonalRecord[];
  /**
   * 判断 weight/reps 是否突破 exerciseId 的历史最高，若是则写新 record 并返回。
   * - 规则：weight > 0 且 weight > 该 exerciseId 所有已存记录的 max weight → 新 PR
   * - 如果 weight == maxWeight 但是 reps > maxReps → 也算 PR（等重高次）
   * - 否则返回 null
   */
  checkAndRecordPR: (payload: {
    exerciseId: string;
    weight: number;
    reps: number;
    sessionId?: string;
    note?: string;
    forceDate?: string;  // 历史 session 使用，默认 today yyyy-mm-dd
  }) => PersonalRecord | null;
  /** 取某 exercise 的 PR（最佳 = 最大 weight；tiebreak higher reps） */
  getBestPR: (exerciseId: string) => PersonalRecord | null;
  /** 按 exerciseId 分组返回最新的 PR（每页详情用） */
  listRecentPRs: (limit?: number) => PersonalRecord[];
  /** 删除 PR 条目（用于误删/测试数据清理） */
  deletePR: (id: string) => void;

  // ============ CUSTOM EXERCISES (v5) ============
  /** 用户自建动作（数据集覆盖不到的自重力作 / 器械变式） */
  customExercises: CustomExercise[];
  addCustomExercise: (
    e: Omit<CustomExercise, 'id' | 'createdAt'> & { id?: string }
  ) => CustomExercise;
  updateCustomExercise: (id: string, patch: Partial<CustomExercise>) => void;
  deleteCustomExercise: (id: string) => void;

  // ============ BACKUP (v5, 纯本地文本) ============
  /** 导出为可复制的 JSON 文本 */
  exportBackup: () => string;
  /**
   * 从文本导入。
   * @param mode 'replace' 覆盖全部；'merge' 按 id 去重后追加（默认，更安全）
   */
  importBackup: (
    text: string,
    mode?: 'replace' | 'merge'
  ) => { ok: true; summary: ReturnType<typeof summarizeBackup>; mode: 'replace' | 'merge' } | { ok: false; error: string };
}

/**
 * First-run language resolution: on a fresh install we want the language to
 * follow the device's system locale, not a hard-coded "zh".  zustand persist
 * calls `migrate` synchronously during `create()`, but we can't block on
 * expo-localization's async `getLocales()` there.  Instead we resolve the
 * system locale once at module-load time and bake the result into the
 * initial settings.  This runs BEFORE any React component mounts, so the
 * very first render already has the correct language.
 */
function resolveInitialLanguageSync(): LanguageCode {
  try {
    // expo-localization getLocales() is synchronous — it reads from the
    // native Activity's Configuration which is always available by the
    // time JS boots.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    const first = locales?.[0]?.languageCode;
    const normalized = normalizeLanguage(first);
    return normalized;
  } catch {
    // Module resolution failed (shouldn't happen).  Fall back to DEFAULT.
    return DEFAULT_LANGUAGE;
  }
}

const SYSTEM_LANGUAGE = resolveInitialLanguageSync();

const INITIAL_SETTINGS: AppSettings = withDefaultSettings({
  language: SYSTEM_LANGUAGE, // follows device locale on first run
  restTimer: 90, // legacy alias
});

/** 倒计时运行态初始值（= inactive/空）。运行时不持久化。 */
const INITIAL_REST_TIMER: RestTimerRuntime = {
  active: false,
  totalSeconds: 0,
  remainingSeconds: 0,
  startedAt: null,
  nextContext: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: INITIAL_SETTINGS,
      updateSettings: (patch) =>
        set((s) => {
          const next: AppSettings = { ...s.settings, ...patch };
          // Language side-effect: keep i18next in sync with persisted choice so
          // toggles apply immediately without a restart.  Swallow errors to avoid
          // UI crashes if the i18n pipeline hasn't finished bootstrapping yet.
          if (patch.language) {
            setAppLanguage(patch.language).catch((err) => {
              // eslint-disable-next-line no-console
              console.error('[i18n] changeLanguage failed from updateSettings', err);
            });
          }
          return { settings: next };
        }),
      setSettings: (patch) => get().updateSettings(patch),

      // ------------------------------
      // FAVORITES
      // ------------------------------
      favoriteIds: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((f) => f !== id)
            : [...s.favoriteIds, id],
        })),
      isFavorite: (id) => get().favoriteIds.includes(id),

      // ------------------------------
      // WORKOUT HISTORY
      // ------------------------------
      workouts: [],
      addWorkout: (workout) =>
        set((s) => ({
          workouts: [
            {
              ...workout,
              id: uid(),
              date: new Date().toISOString(),
            },
            ...(Array.isArray(s.workouts) ? s.workouts : []),
          ],
        })),
      deleteWorkout: (id) =>
        set((s) => ({
          // 原实现 `w && w.id === id ? false : (w && w.id !== id)` 逻辑绕且有
          // null 项残留风险——改为直白的 filter，并顺带剔除数组中的空槽位。
          workouts: (Array.isArray(s.workouts) ? s.workouts : []).filter(
            (w) => w && String(w.id) !== String(id)
          ),
        })),
      clearAllWorkouts: () => set({ workouts: [] }),
      resetAllData: () =>
        set({
          workouts: [],
          favoriteIds: [],
          settings: { ...INITIAL_SETTINGS },
          activeWorkout: null,
          customTemplates: [],
          pinnedTemplateIds: [],
          bodyEntries: [],
          prRecords: [],
          customExercises: [],
          restTimer: INITIAL_REST_TIMER,
        }),

      // ------------------------------
      // TEMPLATES (v3)
      // ------------------------------
      listPresetTemplates: () => PRESET_PLANS.slice(),
      customTemplates: [],
      pinnedTemplateIds: [],
      cloneTemplate: (presetId) => {
        const preset = PRESET_PLANS.find((p) => p.id === presetId);
        if (!preset) return null;
        const cloned: UserPlanTemplate = {
          ...JSON.parse(JSON.stringify(preset)),
          id: uid(),
          sourceId: preset.id,
          createdAt: new Date().toISOString(),
          pinned: false,
        };
        set((s) => ({ customTemplates: [cloned, ...s.customTemplates] }));
        return cloned;
      },
      saveCustomTemplate: (t) => {
        // 原实现把 `let updated` 写在 set() 外面、在 map 的回调里赋值再 return
        // `updated!`。问题有三：
        //   1) 副作用藏在 reducer 里 —— StrictMode / 并发渲染下 set 的回调可能被
        //      重放，外部变量会被反复覆盖；
        //   2) 传入的 id 不存在时 `updated` 恒为 null，`return updated!` 会把
        //      undefined 当成 UserPlanTemplate 交给调用方，后续 `.sessions`
        //      访问直接炸；
        //   3) 无法一眼看出「新建」与「覆盖」两条分支。
        // 现在先在渲染/调用线程里算出结果对象，再一次性写入。
        const now = new Date().toISOString();
        const existing = t.id
          ? (Array.isArray(get().customTemplates) ? get().customTemplates : []).find(
              (c) => String(c?.id) === String(t.id)
            )
          : undefined;

        let saved: UserPlanTemplate;
        if (existing) {
          saved = {
            ...existing,
            ...(t as Partial<UserPlanTemplate>),
            // id / createdAt 是不可变字段：永远以已存在记录为准。
            id: existing.id,
            createdAt: existing.createdAt,
          } as UserPlanTemplate;
          set((s) => ({
            customTemplates: (Array.isArray(s.customTemplates) ? s.customTemplates : []).map(
              (c) => (String(c?.id) === String(existing.id) ? saved : c)
            ),
          }));
        } else {
          saved = {
            ...(t as Omit<UserPlanTemplate, 'id' | 'createdAt'>),
            id: uid(),
            createdAt: now,
            pinned: t.pinned ?? false,
          } as UserPlanTemplate;
          set((s) => ({
            customTemplates: [saved, ...(Array.isArray(s.customTemplates) ? s.customTemplates : [])],
          }));
        }
        return saved;
      },
      deleteCustomTemplate: (id) =>
        set((s) => ({
          customTemplates: s.customTemplates.filter((c) => c.id !== id),
          pinnedTemplateIds: s.pinnedTemplateIds.filter((pid) => pid !== id),
        })),
      togglePinTemplate: (id) =>
        set((s) => ({
          customTemplates: s.customTemplates.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c
          ),
          pinnedTemplateIds: (() => {
            const had = s.pinnedTemplateIds.includes(id);
            if (had) return s.pinnedTemplateIds.filter((pid) => pid !== id);
            // 最多 3 个；超过时保留最早的 2 个再加当前（让用户自行移除，这里做温和FIFO）
            const next = [...s.pinnedTemplateIds, id];
            return next.slice(-3);
          })(),
        })),
      startWorkoutFromTemplate: (templateId, sessionIdx = 0, sessionNameOverride) => {
        const allTemplates = [...PRESET_PLANS, ...get().customTemplates];
        const tpl = allTemplates.find((t) => t.id === templateId);
        if (!tpl || !tpl.sessions?.length) return;
        const session: PlanSession =
          tpl.sessions[Math.max(0, Math.min(sessionIdx, tpl.sessions.length - 1))];
        const lang = normalizeLanguage(get().settings.language || DEFAULT_LANGUAGE);
        const sessionName =
          sessionNameOverride?.length
            ? sessionNameOverride
            : (session.name?.[lang as 'zh' | 'en'] ??
              session.name?.zh ??
              tpl.name[lang as 'zh' | 'en'] ??
              tpl.name.zh);

        // 如果没有进行中的训练 → 先创建
        const cur = get().activeWorkout;
        if (!cur) {
          get().startWorkout(sessionName);
        } else {
          // 有进行中的训练，重命名（如果和默认 fallback 不一致时保留原名，只追加动作）
        }
        // 按 session.exerciseIds → defaults 建 WorkoutExercise[]
        const existingIds = new Set(
          (get().activeWorkout?.exercises || []).map((e) => e.exerciseId)
        );
        const toAppend: WorkoutExercise[] = [];
        for (const exId of session.exerciseIds) {
          if (existingIds.has(exId)) continue;
          const def = session.defaults?.[exId];
          const setsCount = Number.isFinite(def?.sets) ? Math.max(1, def!.sets) : 3;
          const repTarget = Number.isFinite(def?.reps) ? def!.reps : 10;
          const sets: WorkoutSet[] = Array.from({ length: setsCount }, () => ({
            id: uid(),
            exerciseId: exId,
            weight: 0,
            reps: repTarget,
            completed: false,
          }));
          toAppend.push({ exerciseId: exId, sets });
        }
        set((s) => {
          if (!s.activeWorkout) return s;
          return {
            activeWorkout: {
              ...s.activeWorkout,
              name:
                !cur /* first-creation just happened */ || cur.name === s.activeWorkout.name
                  ? sessionName
                  : s.activeWorkout.name,
              exercises: [...s.activeWorkout.exercises, ...toAppend],
            },
          };
        });
      },

      // ------------------------------
      // BODY METRICS (v3)
      // ------------------------------
      bodyEntries: [],
      addBodyEntry: (e) => {
        const entry: BodyProfileEntry = {
          ...e,
          id: e.id || uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          bodyEntries: [entry, ...s.bodyEntries].sort((a, b) =>
            a.date < b.date ? 1 : a.date > b.date ? -1 : 0
          ),
        }));
        return entry;
      },
      updateBodyEntry: (id, patch) =>
        set((s) => ({
          bodyEntries: s.bodyEntries.map((b) =>
            b.id !== id
              ? b
              : {
                  ...b,
                  ...(patch.date ? { date: patch.date } : {}),
                  ...(patch.note !== undefined ? { note: patch.note } : {}),
                  ...(patch.metrics ? { metrics: { ...b.metrics, ...patch.metrics } } : {}),
                }
          ),
        })),
      deleteBodyEntry: (id) =>
        set((s) => ({ bodyEntries: s.bodyEntries.filter((b) => b.id !== id) })),

      // ------------------------------
      // REST TIMER (runtime only)
      // ------------------------------
      restTimer: INITIAL_REST_TIMER,
      startRestTimer: (seconds, context) =>
        set({
          restTimer: {
            active: true,
            totalSeconds: Math.max(1, Math.floor(seconds || 0)),
            remainingSeconds: Math.max(1, Math.floor(seconds || 0)),
            startedAt: Date.now(),
            nextContext: context || null,
          },
        }),
      adjustRestTimer: (delta) =>
        set((s) => {
          if (!s.restTimer.active) return s;
          const remaining = Math.max(0, s.restTimer.remainingSeconds + Math.floor(delta));
          const total = Math.max(remaining, s.restTimer.totalSeconds);
          // 必须同时平移 startedAt，维持
          //   remainingSeconds === totalSeconds - (Date.now() - startedAt)
          // 这个不变量。否则 useRestTimer 的墙钟校正会用
          //「总时长 - 真实流逝」把用户刚加的 10 秒又减回去 ——
          // 表现为「点了 +10，几秒后自己跳回原值」。
          // 每秒 -1 的自然 tick 下，这行会让 startedAt 保持不变（正确）；
          // 手动 ±10 时才会真正平移截止时间。
          return {
            restTimer: {
              ...s.restTimer,
              remainingSeconds: remaining,
              totalSeconds: total,
              startedAt:
                s.restTimer.startedAt == null
                  ? s.restTimer.startedAt
                  : Date.now() - (total - remaining) * 1000,
            },
          };
        }),
      stopRestTimer: () =>
        set({
          restTimer: { ...INITIAL_REST_TIMER },
        }),

      // ------------------------------
      // ACTIVE WORKOUT
      // ------------------------------
      activeWorkout: null,
      startWorkout: (name) =>
        set((s) => {
          // Defensive: if a workout is already active (e.g. user double-taps
          // "Start" before the first tap navigates, or a new entry point forgets
          // the `if (!activeWorkout)` guard), return the existing state as-is
          // so in-progress exercises / sets are NOT silently overwritten.
          if (s.activeWorkout) return s;
          return {
            activeWorkout: {
              startedAt: Date.now(),
              exercises: [],
              // Resolve the session name from the current locale when the
              // caller hasn't supplied one.  Previously this defaulted to a
              // hard-coded Chinese string ("今日训练") which persisted into
              // History entries even for English-speaking users.
              //
              // Resolution order:
              //   1. Caller-provided `name` (non-empty) — wins outright.
              //   2. `i18n.t('workout.defaultSessionName')` — only if resources
              //      have finished loading (no raw key echo-back).
              //   3. `DEFAULT_SESSION_NAME_FALLBACK` keyed by CANONICAL
              //      normalizeLanguage() output — never by string-matching on
              //      i18n.language directly (fixes en-US / zh-CN mismatches).
              name:
                (name && name.length > 0)
                  ? name
                  : (() => {
                      try {
                        const resolved = i18nInstance.t('workout.defaultSessionName');
                        // `resolved` may fall back to the key itself when the
                        // resource isn't loaded yet.  Guard against using the
                        // raw "workout.defaultSessionName" key as a name.
                        if (resolved && !resolved.includes('defaultSessionName')) {
                          return resolved;
                        }
                      } catch {
                        /* i18n pipeline not ready */
                      }
                      // normalizeLanguage() guarantees a canonical 'zh' | 'en'
                      // result regardless of whether i18n.language reports a
                      // regional variant (en-US, zh-Hans-CN, …) or is empty.
                      const canonical = normalizeLanguage(
                        i18nInstance.language || get().settings.language || DEFAULT_LANGUAGE
                      );
                      return DEFAULT_SESSION_NAME_FALLBACK[canonical];
                    })(),
            },
          };
        }),
      endWorkout: (note) => {
        // Double-calling guard
        const { activeWorkout } = get();
        if (!activeWorkout || !activeWorkout.startedAt) return null;
        // Filter exercises with sets
        const exercisesWithSets = activeWorkout.exercises.filter(
          (e) => Array.isArray(e.sets) && e.sets.length > 0
        );
        if (exercisesWithSets.length === 0) {
          set({ activeWorkout: null });
          return null;
        }
        const duration = Math.round(
          (Date.now() - activeWorkout.startedAt) / 1000
        );
        const session: WorkoutSession = {
          id: uid(),
          name: activeWorkout.name,
          date: new Date().toISOString(),
          duration,
          exercises: exercisesWithSets,
          note,
        };
        // — PR 扫描：endWorkout 时遍历所有完成集
        //   深度防御(经验698545): 所有持久化数组强制 ?? [] ，防止旧 vault/merge 未初始化时 undefined.filter / ... spread 闪退
        //
        //   性能：原先每个 set 都 filter + sort 一次全量 prRecords —— 一次训练
        //   30 组 × 200 条 PR = 6000 次比较还带着 30 次完整排序。这里改成
        //   先按 exerciseId 建立「当前最佳」索引（一次线性扫描），后续每个 set
        //   都是 O(1) 查询，且同一次结训里新产生的记录也会同步进索引，
        //   保持「同重更高次数也算 PR」的原有判定结果完全一致。
        const today = new Date().toISOString().slice(0, 10);
        const collectedPRs: PersonalRecord[] = [];
        const storeNow = get();
        const snapshotPrRecords = Array.isArray(storeNow.prRecords) ? storeNow.prRecords : [];

        const bestByExercise = new Map<string, PersonalRecord>();
        const touch = (rec: PersonalRecord) => {
          const key = String(rec.exerciseId);
          const prev = bestByExercise.get(key);
          if (!prev || isStrongerSet(rec.weight, rec.reps, prev.weight, prev.reps)) {
            bestByExercise.set(key, rec);
          }
        };
        for (const p of snapshotPrRecords) {
          if (p && p.exerciseId != null) touch(p);
        }

        for (const ex of exercisesWithSets) {
          for (const set of ex.sets) {
            if (!set || !set.completed) continue;
            const w = Number(set.weight) || 0;
            const r = Math.max(0, Math.floor(Number(set.reps) || 0));
            if (w <= 0 || r <= 0) continue;
            const best = bestByExercise.get(String(ex.exerciseId));
            const isPR = !best ? true : isStrongerSet(w, r, best.weight, best.reps);
            if (isPR) {
              const record: PersonalRecord = {
                id: uid(),
                exerciseId: String(ex.exerciseId),
                weight: w,
                reps: r,
                date: today,
                sessionId: session.id,
                createdAt: new Date().toISOString(),
              };
              collectedPRs.push(record);
              touch(record);
            }
          }
        }
        // 一次性原子写入：workouts + activeWorkout + prRecords（1 次 subscriber 通知）
        // 所有 spread 源数组 ?? [] 兜底 (Experience 698545: 绝不让 undefined spread 进 iterable)
        set((s) => ({
          workouts: [session, ...(Array.isArray(s.workouts) ? s.workouts : [])],
          activeWorkout: null,
          prRecords: collectedPRs.length > 0 ? [...collectedPRs, ...(Array.isArray(s.prRecords) ? s.prRecords : [])] : (Array.isArray(s.prRecords) ? s.prRecords : []),
        }));
        return { session, newPRs: collectedPRs };
      },
      cancelWorkout: () => set({ activeWorkout: null }),

      addExerciseToActive: (exerciseId) =>
        set((s) => {
          if (!s.activeWorkout) return s;
          if (
            s.activeWorkout.exercises.some(
              (e) => e.exerciseId === exerciseId
            )
          ) {
            return s;
          }
          const firstSet: WorkoutSet = {
            id: uid(),
            exerciseId,
            weight: 0,
            reps: 0,
            completed: false,
          };
          return {
            activeWorkout: {
              ...s.activeWorkout,
              exercises: [
                ...s.activeWorkout.exercises,
                { exerciseId, sets: [firstSet] },
              ],
            },
          };
        }),
      removeExerciseFromActive: (exerciseId) =>
        set((s) => {
          if (!s.activeWorkout) return s;
          const targetId = String(exerciseId);
          return {
            activeWorkout: {
              ...s.activeWorkout,
              exercises: (Array.isArray(s.activeWorkout.exercises) ? s.activeWorkout.exercises : []).filter(
                (e) => e && String(e.exerciseId) !== targetId
              ),
            },
          };
        }),
      addSetToExercise: (exerciseId) =>
        set((s) => {
          if (!s.activeWorkout) return s;
          const targetId = String(exerciseId);
          const exercisesArr = Array.isArray(s.activeWorkout.exercises) ? s.activeWorkout.exercises : [];
          return {
            activeWorkout: {
              ...s.activeWorkout,
              exercises: exercisesArr.map((e) => {
                if (!e || String(e.exerciseId) !== targetId) return e;
                const setsArr = Array.isArray(e.sets) ? e.sets : [];
                const lastSet = setsArr[setsArr.length - 1];
                return {
                  ...e,
                  sets: [
                    ...setsArr,
                    {
                      id: uid(),
                      exerciseId: targetId,
                      weight: Number(lastSet?.weight) || 0,
                      reps: Number(lastSet?.reps) || 0,
                      completed: false,
                    },
                  ],
                };
              }),
            },
          };
        }),
      removeSet: (exerciseId, setId) =>
        set((s) => {
          if (!s.activeWorkout) return s;
          const targetId = String(exerciseId);
          const targetSetId = String(setId);
          return {
            activeWorkout: {
              ...s.activeWorkout,
              exercises: (Array.isArray(s.activeWorkout.exercises) ? s.activeWorkout.exercises : []).map((e) => {
                if (!e || String(e.exerciseId) !== targetId) return e;
                return {
                  ...e,
                  sets: (Array.isArray(e.sets) ? e.sets : []).filter((x) => x && String(x.id) !== targetSetId),
                };
              }),
            },
          };
        }),
      updateSet: (exerciseId, setId, patch) =>
        set((s) => {
          if (!s.activeWorkout) return s;
          const targetId = String(exerciseId);
          const targetSetId = String(setId);
          return {
            activeWorkout: {
              ...s.activeWorkout,
              exercises: (Array.isArray(s.activeWorkout.exercises) ? s.activeWorkout.exercises : []).map((e) => {
                if (!e || String(e.exerciseId) !== targetId) return e;
                return {
                  ...e,
                  sets: (Array.isArray(e.sets) ? e.sets : []).map((set) => {
                    if (!set || String(set.id) !== targetSetId) return set;
                    const next: WorkoutSet = { ...set, ...patch };
                    // 只在「未完成 → 完成」这一次跃迁上打时间戳。
                    // 对已完成的组改重量不该篡改完成时刻（否则组间隔分析会失真）；
                    // 取消打钩则清空时间戳，重新打钩时重新计时。
                    if (patch.completed === true && set.completed !== true) {
                      next.completedAt = Date.now();
                    } else if (patch.completed === false) {
                      next.completedAt = undefined;
                    }
                    return next;
                  }),
                };
              }),
            },
          };
        }),

      // ------------------------------
      // STATS
      // ------------------------------
      totalVolumeKg: () => {
        const safeWorkouts = Array.isArray(get().workouts) ? get().workouts : [];
        let total = 0;
        for (const w of safeWorkouts) {
          if (!Array.isArray(w.exercises)) continue;
          for (const e of w.exercises) {
            if (!Array.isArray(e.sets)) continue;
            for (const set of e.sets) {
              if (set && set.completed) total += (Number(set.weight) || 0) * (Number(set.reps) || 0);
            }
          }
        }
        return Math.round(total);
      },
      totalWorkouts: () => (Array.isArray(get().workouts) ? get().workouts.length : 0),
      streakDays: () => {
        const safeWorkouts = Array.isArray(get().workouts) ? get().workouts : [];
        if (safeWorkouts.length === 0) return 0;
        const dates = new Set(
          safeWorkouts.filter(w => w && w.date).map((w) => new Date(w.date).toDateString())
        );
        let streak = 0;
        const cursor = new Date();
        while (dates.has(cursor.toDateString())) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        // Check from yesterday if today is empty
        if (streak === 0) {
          cursor.setDate(new Date().getDate() - 1);
          while (dates.has(cursor.toDateString())) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
          }
        }
        return streak;
      },
      lastSetsFor: (exerciseId) => {
        const safeWorkouts = Array.isArray(get().workouts) ? get().workouts : [];
        return lastSetsFor(safeWorkouts, String(exerciseId), {
          countOnlyWorkingSets: get().settings.countOnlyWorkingSets,
        });
      },
      weeklyProgress: () =>
        weeklyProgress(get().workouts, get().settings.weeklyGoal ?? 0, 1, new Date()),

      // ------------------------------
      // PR / PERSONAL RECORDS (v4)
      // ------------------------------
      prRecords: [],
      checkAndRecordPR: (payload) => {
        const { exerciseId, weight, reps, sessionId, note, forceDate } = payload || {} as any;
        if (!exerciseId) return null;
        const safeWeight = Number(weight) || 0;
        const safeReps = Math.max(0, Math.floor(Number(reps) || 0));
        if (safeWeight <= 0 || safeReps <= 0) return null;
        const best = get().getBestPR(exerciseId);
        const isNew = !best ? true : isStrongerSet(safeWeight, safeReps, best.weight, best.reps);
        if (!isNew) return null;
        const today = new Date().toISOString().slice(0, 10);
        const record: PersonalRecord = {
          id: uid(),
          exerciseId: String(exerciseId),
          weight: safeWeight,
          reps: safeReps,
          date: forceDate && /^\d{4}-\d{2}-\d{2}$/.test(forceDate) ? forceDate : today,
          sessionId: sessionId ?? undefined,
          note: note ?? undefined,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ prRecords: [record, ...(Array.isArray(s.prRecords) ? s.prRecords : [])] }));
        return record;
      },
      getBestPR: (exerciseId) => {
        const arr = Array.isArray(get().prRecords) ? get().prRecords : [];
        // 原来是对过滤结果整体排序再取 [0]（O(n log n) 且会分配中间数组）；
        // 这个 selector 在打钩每组时都会被 checkAndRecordPR 调用一次，
        // 改成一次线性归约即可。
        let best: PersonalRecord | null = null;
        for (const p of arr) {
          if (!p || String(p.exerciseId) !== String(exerciseId)) continue;
          if (best === null || isStrongerSet(p.weight, p.reps, best.weight, best.reps)) {
            best = p;
          }
        }
        return best;
      },
      listRecentPRs: (limit = 5) => {
        const arr = Array.isArray(get().prRecords) ? get().prRecords : [];
        const safe = arr.filter(Boolean);
        const sorted = [...safe].sort((a, b) =>
          b.date < a.date ? 1 : b.date > a.date ? -1 : (b.createdAt || '') < (a.createdAt || '') ? 1 : -1
        );
        return limit > 0 ? sorted.slice(0, limit) : sorted;
      },
      deletePR: (id) => set(s => ({ prRecords: (Array.isArray(s.prRecords) ? s.prRecords : []).filter(r => r && r.id !== id) })),

      // ------------------------------
      // CUSTOM EXERCISES (v5)
      // ------------------------------
      customExercises: [],
      addCustomExercise: (e) => {
        const record: CustomExercise = {
          ...e,
          id: e.id && String(e.id).trim() ? String(e.id) : `custom-${uid()}`,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          customExercises: [record, ...(Array.isArray(s.customExercises) ? s.customExercises : [])],
        }));
        return record;
      },
      updateCustomExercise: (id, patch) =>
        set((s) => ({
          customExercises: (Array.isArray(s.customExercises) ? s.customExercises : []).map((c) =>
            c && String(c.id) === String(id) ? { ...c, ...patch, id: c.id } : c
          ),
        })),
      deleteCustomExercise: (id) =>
        set((s) => ({
          customExercises: (Array.isArray(s.customExercises) ? s.customExercises : []).filter(
            (c) => c && String(c.id) !== String(id)
          ),
          // 联动清理收藏，否则收藏列表里会留下一个永远查不到名字的幽灵 id
          favoriteIds: (Array.isArray(s.favoriteIds) ? s.favoriteIds : []).filter(
            (f) => String(f) !== String(id)
          ),
        })),

      // ------------------------------
      // BACKUP (v5) —— 纯文本，不落盘、不联网
      // ------------------------------
      exportBackup: () => {
        const s = get();
        return serializeBackup(
          createBackup({
            settings: s.settings,
            favoriteIds: s.favoriteIds,
            workouts: s.workouts,
            customTemplates: s.customTemplates,
            pinnedTemplateIds: s.pinnedTemplateIds,
            bodyEntries: s.bodyEntries,
            prRecords: s.prRecords,
            customExercises: s.customExercises,
          })
        );
      },
      importBackup: (text, mode = 'merge') => {
        const parsed = parseBackup(text);
        if (!parsed.ok) return { ok: false as const, error: parsed.error };
        const incoming: BackupPayload = parsed.payload;

        if (mode === 'replace') {
          set({
            settings: incoming.settings,
            favoriteIds: incoming.favoriteIds,
            workouts: incoming.workouts,
            customTemplates: incoming.customTemplates,
            pinnedTemplateIds: incoming.pinnedTemplateIds,
            bodyEntries: incoming.bodyEntries,
            prRecords: incoming.prRecords,
            customExercises: incoming.customExercises,
          });
          return { ok: true as const, summary: summarizeBackup(incoming), mode };
        }

        // merge：按 id 去重后追加，已存在的 id 以本地为准（本地是最新的）
        set((s) => {
          const mergeById = <T extends { id: string }>(local: T[], inc: T[]): T[] => {
            const seen = new Set((Array.isArray(local) ? local : []).map((x) => String(x?.id)));
            const out = [...(Array.isArray(local) ? local : [])];
            for (const item of Array.isArray(inc) ? inc : []) {
              if (!item || seen.has(String(item.id))) continue;
              seen.add(String(item.id));
              out.push(item);
            }
            return out;
          };
          return {
            workouts: mergeById(s.workouts, incoming.workouts),
            customTemplates: mergeById(s.customTemplates, incoming.customTemplates),
            bodyEntries: mergeById(s.bodyEntries, incoming.bodyEntries),
            prRecords: mergeById(s.prRecords, incoming.prRecords),
            customExercises: mergeById(s.customExercises, incoming.customExercises),
            // id 列表统一 String 归一化再去重 —— 备份文件里的 id 可能是数字
            // （旧版本序列化遗留），直接塞进 Set 会让 "1207" 与 1207 各留一份，
            // 表现为「取消了收藏却仍然显示」。
            favoriteIds: [
              ...new Set(
                [
                  ...(Array.isArray(s.favoriteIds) ? s.favoriteIds : []),
                  ...(Array.isArray(incoming.favoriteIds) ? incoming.favoriteIds : []),
                ]
                  .filter((v) => v != null)
                  .map(String)
              ),
            ],
            pinnedTemplateIds: [
              ...new Set(
                [
                  ...(Array.isArray(s.pinnedTemplateIds) ? s.pinnedTemplateIds : []),
                  ...(Array.isArray(incoming.pinnedTemplateIds) ? incoming.pinnedTemplateIds : []),
                ]
                  .filter((v) => v != null)
                  .map(String)
              ),
            ],
            // settings 在 merge 模式下不动 —— 用户当前的偏好优先于备份里的旧偏好
          };
        });
        return { ok: true as const, summary: summarizeBackup(incoming), mode };
      },
    }),
    {
      name: VAULT_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => appStorage),
      migrate,
      /**
       * merge —— 每次 rehydrate 都会执行（不像 migrate 只在版本变化时跑）。
       * 这里对持久化数据做一次完整整形，确保任何结构性损坏都不会进入 UI。
       * 这是「完成训练不闪退」最根本的一道防线：即便 vault 里存着
       * `exercises: null` 或 `sets: undefined`，App 也能正常启动并渲染。
       */
      merge: (persisted: unknown, current: AppState): AppState => {
        const raw =
          persisted && typeof persisted === 'object'
            ? (persisted as Record<string, unknown>)
            : {};
        const merged = { ...current, ...raw } as AppState;
        return sanitizeState(merged, INITIAL_SETTINGS) as AppState;
      },
      partialize: (state) => ({
        workouts: state.workouts,
        settings: state.settings,
        favoriteIds: state.favoriteIds,
        customTemplates: state.customTemplates,
        pinnedTemplateIds: state.pinnedTemplateIds,
        bodyEntries: state.bodyEntries,
        prRecords: state.prRecords,
        customExercises: state.customExercises,
      }),
    }
  )
);

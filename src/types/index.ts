export type LanguageCode =
  | 'en'
  | 'es'
  | 'it'
  | 'tr'
  | 'ru'
  | 'zh'
  | 'hi'
  | 'pl'
  | 'ko'
  | 'fr'
  | 'ja';

export type WeightUnit = 'kg' | 'lb';

export type BodyPart =
  | 'back'
  | 'cardio'
  | 'chest'
  | 'lower arms'
  | 'lower legs'
  | 'neck'
  | 'shoulders'
  | 'upper arms'
  | 'upper legs'
  | 'waist';

export interface Exercise {
  id: string;
  name: string;
  name_zh?: string;
  category: string;
  body_part: BodyPart;
  equipment: string;
  instructions: Record<LanguageCode, string[]>;
  instruction_steps?: Record<LanguageCode, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  animation?: string;
  attribution?: string;
  created_at?: string;
}

/**
 * 组类型 —— 对标训记 / 开练的记录粒度。
 * 训练容量统计只累计 working（正式）组，热身组不计入总量，
 * 否则「总容量」会被空杆热身组严重稀释。
 */
export type SetType = 'warmup' | 'working' | 'dropset' | 'failure' | 'amrap';

export const SET_TYPES: SetType[] = ['warmup', 'working', 'dropset', 'failure', 'amrap'];

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
  note?: string;
  /** 组类型，缺省按 working 处理（兼容历史数据） */
  type?: SetType;
  /** 主观强度 RPE 6-10，可选；用于强度分布统计 */
  rpe?: number;
  /** 本组实际耗时（秒），由计时器回填，可选 */
  durationSec?: number;
  /** 本组完成时刻（epoch ms），用于组间隔分析 */
  completedAt?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  date: string; // ISO timestamp
  duration: number; // seconds
  exercises: WorkoutExercise[];
  note?: string;
}

/** 杠铃片配置 —— 供杠铃片计算器使用（纯本地，无网络） */
export interface PlateConfig {
  /** 空杆重量（kg）。标准奥杆 20、小奥杆 15、曲杆 10 */
  barWeight: number;
  /** 单侧可用的杠铃片重量（kg），降序 */
  plates: number[];
}

export interface AppSettings {
  language: LanguageCode;
  theme: 'light' | 'dark' | 'system';
  units: 'kg' | 'lb';
  restTimer?: number; // legacy alias
  defaultRestSeconds: number;
  restTimerEnabled: boolean;
  autoRest: boolean;
  saveHistory: boolean;
  hapticFeedback: boolean;
  // ---------- v5 新增：训练目标 / 片配置 / 1RM 公式 ----------
  /** 每周训练次数目标（0 = 不设目标） */
  weeklyGoal: number;
  /** 1RM 估算公式 */
  oneRmFormula: OneRmFormula;
  plateConfig: PlateConfig;
  /** 是否只把 working 组计入总容量统计 */
  countOnlyWorkingSets: boolean;
  /** 已完成首次引导 */
  onboarded: boolean;
}

/** 1RM 估算公式族 —— 训记 / 开练 / Strong 等主流 App 的通用做法 */
export type OneRmFormula = 'epley' | 'brzycki' | 'lombardi' | 'oconner' | 'wathan';

export const ONE_RM_FORMULAS: OneRmFormula[] = [
  'epley',
  'brzycki',
  'lombardi',
  'oconner',
  'wathan',
];

export const DEFAULT_PLATE_CONFIG: PlateConfig = {
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/**
 * 自定义动作 —— 用户自建动作（数据集覆盖不到的自重力作 / 器械变式）。
 * 纯本地存储，不上传。id 使用 `custom-<uid>` 前缀避免与数据集 id 冲突。
 */
export interface CustomExercise {
  id: string;
  name: string;
  name_zh?: string;
  body_part: BodyPart;
  equipment: string;
  target: string;
  secondary_muscles: string[];
  instructions: string[];
  createdAt: string;
}

export type FilterMode = 'body_part' | 'equipment' | 'muscle_group';

export interface ExerciseFilters {
  bodyPart?: BodyPart | null;
  equipment?: string | null;
  muscleGroup?: string | null;
  target?: string | null;
  searchQuery?: string | null;
}

// ============================================================================
// v1.1.0 MVP 扩展类型（训练计划模板 + 身体数据 + 组间计时状态）
// ============================================================================

export interface PlanLocalized {
  zh: string;
  en: string;
}

export interface PlanSession {
  day: string;
  name: PlanLocalized;
  /** exercises.json 中的 canonical id (字符串 4 位, 如 "1207") */
  exerciseIds: string[];
  /** key = exerciseId, value = 建议默认组数/次数/休息 */
  defaults: Record<string, { sets: number; reps: number; restSec: number; tempo?: string }>;
}

export interface PlanTemplate {
  id: string;
  name: PlanLocalized;
  description: PlanLocalized;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'hypertrophy' | 'strength' | 'conditioning' | 'fat-loss' | 'maintenance' | 'mobility';
  daysPerWeek: 3 | 4 | 5 | 6;
  durationMinPerSession: 30 | 45 | 60 | 75 | 90 | 120;
  equipmentRequired: string[];
  warmupId?: string;
  cooldownId?: string;
  sessions: PlanSession[];
}

export interface UserPlanTemplate extends PlanTemplate {
  /** 预置模板的 id=sourceId；自定义=null */
  sourceId?: string | null;
  /** 自建时间 */
  createdAt: string;
  /** 用户是否收藏（收藏后显示在 home 横滑模板 前 3 位置）*/
  pinned?: boolean;
}

export type BodyMetricKey =
  | 'weight'
  | 'bodyFat'
  | 'bmi'
  | 'height'
  | 'neck'
  | 'chest'
  | 'waist'
  | 'hip'
  | 'upperArmLeft'
  | 'upperArmRight'
  | 'thighLeft'
  | 'thighRight'
  | 'calfLeft'
  | 'calfRight';

export interface BodyProfileEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  metrics: Partial<Record<BodyMetricKey, number>>;
  note?: string;
  createdAt: string;
}

/** 组间计时器运行态（不持久化到vault，仅 zustand 运行时） */
export interface RestTimerRuntime {
  active: boolean;
  /** 当前设置的总秒数 */
  totalSeconds: number;
  /** 剩余秒数 */
  remainingSeconds: number;
  /** 组结束（set 被 completed 打钩）wall time，用于后台回来补差值 */
  startedAt: number | null;
  /** 下一个动作 + 下一组文字摘要 */
  nextContext: { exerciseName?: string; setIndex?: number; totalSets?: number } | null;
}

/**
 * 个人记录 (Personal Record / PR)：当某动作某组完成时，其 weight>历史最高 即自动生成一条。
 */
export interface PersonalRecord {
  id: string;
  /** 关联 exercises 数据集的 exerciseId（= exercises.json primary id）*/
  exerciseId: string;
  /** 最大重量（使用 units kg/lb，按当时 settings.units 保存，后续换算在 UI 层做或不变）*/
  weight: number;
  /** 本次举起重物的次数 */
  reps: number;
  /** ISO date string YYYY-MM-DD of PR achieved */
  date: string;
  /** 关联的 WorkoutSession id，如果是热身/临时打钩则空 */
  sessionId?: string;
  /** 可选 note */
  note?: string;
  /** ISO timestamp when PR record created（createdAt）*/
  createdAt: string;
}

/**
 * 热身动作 = 轻量 5-10min 全身激活；拉伸动作 = 训练后静态 15-30s 保持。
 * 资源存本地 JSON src/data/warmups.json
 */
export interface WarmupOrStretch {
  id: string;
  /** 'warmup' = 热身；'stretch' = 拉伸 */
  category: 'warmup' | 'stretch';
  /** zh/en 双语，显示名 */
  name: { zh: string; en: string };
  /** zh/en 双语，一句话怎么练 */
  instruction: { zh: string; en: string };
  /** 建议持续秒数：warmup=30-45秒，stretch=20-30秒 */
  durationSec: number;
  /** 目标肌群/身体部位（用于色条配色映射）*/
  bodyPart: import('./index').BodyPart | 'full-body' | 'core' | 'cardio';
  /** MaterialCommunityIcons 名，用于无图时占位 */
  icon: string;
}

// ============================================================================
// v2 数据分析层 —— 支撑「数据面板」页面的聚合结果类型
// ============================================================================

/** 单日训练聚合（日历热力图 + 趋势图的最小单元） */
export interface DailyVolume {
  /** YYYY-MM-DD */
  date: string;
  /** 当日总容量（weight × reps，仅 completed 且计入统计的组） */
  volume: number;
  /** 当日组数 */
  sets: number;
  /** 当日训练条数 */
  sessions: number;
  /** 当日训练时长（秒） */
  durationSec: number;
}

/** 肌群组数分布（近 N 天） */
export interface MuscleSetStat {
  bodyPart: BodyPart;
  sets: number;
  volume: number;
  /** 最近一次训练该肌群的日期 YYYY-MM-DD */
  lastTrained: string | null;
}

/** 动作维度的历史表现（供详情页「历史表现」区块） */
export interface ExerciseHistoryEntry {
  sessionId: string;
  date: string;
  sets: { weight: number; reps: number; type?: SetType; completed?: boolean }[];
  best1RM: number;
  volume: number;
}

/** 数据面板总览 */
export interface StatsOverview {
  totalSessions: number;
  totalVolume: number;
  totalSets: number;
  totalDurationSec: number;
  currentStreak: number;
  longestStreak: number;
  /** 本周（周一起算）已完成训练次数 */
  weekSessions: number;
  weekGoal: number;
  /** 近 30 天活跃天数 */
  activeDays30: number;
  /** 平均单次时长（秒） */
  avgSessionSec: number;
  /** 与上一周期相比的容量变化百分比（null = 无可比数据） */
  volumeDeltaPct: number | null;
}

/** 完整备份载荷 —— 导出/导入的唯一结构 */
export interface BackupPayload {
  /** 备份格式标识，导入时校验 */
  app: 'choyeon-gym';
  /** schema 版本 */
  version: number;
  exportedAt: string;
  settings: AppSettings;
  favoriteIds: string[];
  workouts: WorkoutSession[];
  customTemplates: UserPlanTemplate[];
  pinnedTemplateIds: string[];
  bodyEntries: BodyProfileEntry[];
  prRecords: PersonalRecord[];
  customExercises: CustomExercise[];
}


import type { AppSettings, OneRmFormula, PlateConfig } from '@/types';
import { DEFAULT_PLATE_CONFIG } from '@/types';

// ============================================================================
// settings.ts —— AppSettings 的唯一默认值来源（纯常量，零 RN 依赖）
//
// 为什么单独一个文件：
//   · store 的 INITIAL_SETTINGS 与 backup 的「导入时补全缺失字段」必须共用
//     同一份默认值，否则用户换了手机导入备份后会得到两套不同的休息时长。
//   · src/constants/index.ts 顶部 import 了 react-native（Platform），
//     被 backup.ts / 单测引用会连带拉起 RN 运行时。这里刻意保持纯净。
// ============================================================================

/** 组间休息候选（秒）—— 训记/开练的常见档位 */
export const REST_PRESETS: number[] = [30, 60, 90, 120, 150, 180, 240, 300];

/** 每周训练次数目标候选（0 = 不设目标） */
export const WEEKLY_GOAL_PRESETS: number[] = [0, 2, 3, 4, 5, 6, 7];

/** 1RM 公式展示名（key 与 OneRmFormula 一致，UI 直接枚举） */
export const ONE_RM_FORMULA_LABELS: Record<OneRmFormula, { zh: string; en: string }> = {
  epley: { zh: 'Epley（通用）', en: 'Epley (general)' },
  brzycki: { zh: 'Brzycki（保守）', en: 'Brzycki (conservative)' },
  lombardi: { zh: 'Lombardi（高次）', en: 'Lombardi (high reps)' },
  oconner: { zh: "O'Conner（低次）", en: "O'Conner (low reps)" },
  wathan: { zh: 'Wathan（拟合）', en: 'Wathan (fitted)' },
};

/** 常见空杆重量候选（kg） */
export const BAR_WEIGHT_PRESETS: number[] = [20, 15, 10, 7];

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  theme: 'system',
  units: 'kg',
  defaultRestSeconds: 90,
  restTimerEnabled: true,
  autoRest: true,
  saveHistory: true,
  hapticFeedback: true,
  // --- v5 ---
  weeklyGoal: 4,
  oneRmFormula: 'epley',
  plateConfig: { ...DEFAULT_PLATE_CONFIG, plates: [...DEFAULT_PLATE_CONFIG.plates] },
  countOnlyWorkingSets: true,
  onboarded: false,
};

/**
 * 用默认值补全一份「可能来自旧版本 / 手改过的」settings。
 * 只补缺省字段，不做类型纠错 —— 纠错交给 store 的 sanitize。
 */
export function withDefaultSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  const p = partial ?? {};
  const d = DEFAULT_SETTINGS;
  const rawPlates = p.plateConfig?.plates;
  const plates = Array.isArray(rawPlates)
    ? rawPlates.map(Number).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  const rawBar = Number(p.plateConfig?.barWeight);
  const rawWeeklyGoal = Number(p.weeklyGoal);
  const rawRest = Number(p.defaultRestSeconds);

  // 逐字段兜底而不是 `{...DEFAULT, ...partial}` —— 后者在 partial 里
  // 存在值为 undefined 的键时会把默认值冲掉（JSON 序列化常见）。
  return {
    language: p.language ?? d.language,
    theme: p.theme ?? d.theme,
    units: p.units ?? d.units,
    restTimer: p.restTimer,
    defaultRestSeconds: Number.isFinite(rawRest) && rawRest > 0 ? rawRest : d.defaultRestSeconds,
    restTimerEnabled: typeof p.restTimerEnabled === 'boolean' ? p.restTimerEnabled : d.restTimerEnabled,
    autoRest: typeof p.autoRest === 'boolean' ? p.autoRest : d.autoRest,
    saveHistory: typeof p.saveHistory === 'boolean' ? p.saveHistory : d.saveHistory,
    hapticFeedback: typeof p.hapticFeedback === 'boolean' ? p.hapticFeedback : d.hapticFeedback,
    weeklyGoal:
      Number.isFinite(rawWeeklyGoal) && rawWeeklyGoal >= 0 && rawWeeklyGoal <= 14
        ? Math.floor(rawWeeklyGoal)
        : d.weeklyGoal,
    oneRmFormula: p.oneRmFormula ?? d.oneRmFormula,
    plateConfig: {
      barWeight: Number.isFinite(rawBar) && rawBar >= 0 ? rawBar : d.plateConfig.barWeight,
      plates: plates.length > 0 ? plates.sort((a, b) => b - a) : [...d.plateConfig.plates],
    },
    countOnlyWorkingSets:
      typeof p.countOnlyWorkingSets === 'boolean'
        ? p.countOnlyWorkingSets
        : d.countOnlyWorkingSets,
    onboarded: typeof p.onboarded === 'boolean' ? p.onboarded : d.onboarded,
  };
}

import type { OneRmFormula, PlateConfig } from '@/types';
import { DEFAULT_PLATE_CONFIG } from '@/types';

// ============================================================================
// strength.ts —— 力量训练领域的纯函数工具箱。
//
// 设计原则：
//   1) 纯函数、零 RN 依赖 → 可直接被 Jest 单测、可被 Web/iOS/Android 共用。
//   2) 所有入参都做有限性/边界校验（`Number.isFinite`、`reps <= 0`）→
//      绝不把 NaN / Infinity 泄漏给 UI 层（历史上出现过 `NaN kg` 展示）。
//   3) 单位换算只在边界发生：存储一律 kg，展示层再转 lb。
// ============================================================================

const KG_PER_LB = 0.45359237;

export function lbToKg(lb: number): number {
  if (!Number.isFinite(lb)) return 0;
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return kg / KG_PER_LB;
}

/** 双向换算。`to` 与当前单位相同则原样返回（避免浮点往返误差累积）。 */
export function convertWeight(value: number, from: 'kg' | 'lb', to: 'kg' | 'lb'): number {
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  return from === 'kg' ? kgToLb(value) : lbToKg(value);
}

/**
 * 把任意来源的重量归一到 kg（内部统一单位）。
 * 所有 PR / 容量比较都必须先过这一步，否则 kg/lb 混合会产生错误结论。
 */
export function toKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? lbToKg(value) : Number.isFinite(value) ? value : 0;
}

/** 展示用：按目标单位换算并四舍五入到「好看」的步长 */
export function displayWeight(valueKg: number, unit: 'kg' | 'lb'): number {
  const v = convertWeight(valueKg, 'kg', unit);
  // lb 下常见步长是 5，kg 下是 2.5 —— 统一按 0.5 取整已足够观感整洁
  return Math.round(v * 2) / 2;
}

// ============================================================================
// 1RM（One-Rep Max，单次极限重量）估算
// ============================================================================

/**
 * 由「重量 × 次数」估算 1RM。
 *
 * 各公式的适用区间（这是选择默认值 epley 的依据）：
 *   · Epley    : w × (1 + r/30)        —— 1~10 次区间误差最小，行业默认
 *   · Brzycki  : w × 36 / (37 − r)     —— 中低次数偏保守，r ≥ 37 时失效
 *   · Lombardi : w × r^0.1             —— 高次数（10+）更稳
 *   · O'Conner : w × (1 + r/40)        —— 低次数偏保守
 *   · Wathan   : 48.8w / (48.8 − 2.17r + 0.0147r²) —— 多项式拟合，全区间均衡
 *
 * @param weight 重量（kg）
 * @param reps   次数（必须 ≥ 1）
 * @returns 估算 1RM（kg）；入参非法或公式越界时返回 0
 */
export function estimate1RM(
  weight: number,
  reps: number,
  formula: OneRmFormula = 'epley'
): number {
  const w = Number(weight);
  const r = Math.floor(Number(reps));
  if (!Number.isFinite(w) || !Number.isFinite(r)) return 0;
  if (w <= 0 || r <= 0) return 0;

  let raw: number;
  switch (formula) {
    case 'epley':
      raw = w * (1 + r / 30);
      break;
    case 'brzycki':
      // r >= 37 时分母 ≤ 0 → 公式失效，退化为线性外推
      raw = r >= 37 ? w * (1 + r / 30) : (w * 36) / (37 - r);
      break;
    case 'lombardi':
      raw = w * Math.pow(r, 0.1);
      break;
    case 'oconner':
      raw = w * (1 + r / 40);
      break;
    case 'wathan': {
      const denom = 48.8 - 2.17 * r + 0.0147 * r * r;
      raw = denom <= 0 ? w * (1 + r / 30) : (48.8 * w) / denom;
      break;
    }
    default:
      raw = w * (1 + r / 30);
  }

  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 10) / 10;
}

/**
 * 1RM 反推：给定 1RM 与目标强度百分比，求「做 r 次应该用多重」。
 * 用于 %1RM 训练法（如 5×5 @ 75%）。
 */
export function weightForPercent(
  oneRm: number,
  percent: number,
  reps: number,
  formula: OneRmFormula = 'epley'
): number {
  const p = Math.min(Math.max(Number(percent), 1), 200) / 100;
  const r = Math.max(1, Math.floor(Number(reps) || 1));
  const base = Number(oneRm);
  if (!Number.isFinite(base) || base <= 0) return 0;

  // 用二分法求解 estimate1RM(w, r, formula) = base * p
  // （各公式对 w 单调，二分收敛快且不需要为每个公式手写逆函数）
  let lo = 0;
  let hi = base * p;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (estimate1RM(mid, r, formula) < base * p) lo = mid;
    else hi = mid;
  }
  return Math.round(hi * 2) / 2;
}

/** 该组强度占 1RM 的百分比（0~100+） */
export function intensityPercent(weight: number, oneRm: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(oneRm) || oneRm <= 0) return 0;
  const raw = (weight / oneRm) * 100;
  return Math.round(Math.min(raw, 300) * 10) / 10;
}

/** 组容量 = 重量 × 次数 */
export function setVolume(weight: number, reps: number): number {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r)) return 0;
  if (w <= 0 || r <= 0) return 0;
  return w * r;
}

// ============================================================================
// 杠铃片计算器
// ============================================================================

export interface PlateBreakdown {
  /** 目标重量（含杆） */
  target: number;
  /** 实际可配出的最接近重量（受可用片限制，可能 ≠ target） */
  achievable: number;
  /** 单侧需要的片子（降序，已配对） */
  perSide: number[];
  /** 是否精确命中目标 */
  exact: boolean;
  /** 空杆重量 */
  bar: number;
}

/**
 * 计算单侧杠铃片组合。
 *
 * 关键点：
 *   · 输入是「总重量（含杆）」，先扣掉杆重再对半分；
 *   · 贪心从大到小取片，天然得到最少片数（健身场景的标准答案）；
 *   · 取不到精确值时返回「最接近且不超重」的可达解，并置 exact=false，
 *     绝不静默给出配不出的方案（那会让用户在训练中途卡住）。
 */
export function computePlates(
  targetTotal: number,
  config: PlateConfig = DEFAULT_PLATE_CONFIG
): PlateBreakdown {
  const bar = Number.isFinite(config.barWeight) ? config.barWeight : 20;
  const target = Number(targetTotal);
  if (!Number.isFinite(target) || target <= 0) {
    return { target: 0, achievable: 0, perSide: [], exact: true, bar };
  }

  const plates = [...(config.plates ?? [])]
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => b - a);

  // 目标低于空杆 → 只能空杆（或提示不可达）
  const perSideTarget = (target - bar) / 2;
  if (perSideTarget <= 0) {
    return { target, achievable: bar, perSide: [], exact: Math.abs(target - bar) < 1e-6, bar };
  }

  const perSide: number[] = [];
  let remaining = perSideTarget;
  // 最小片的 1/2 作为容差：小于该值已无法再配
  const smallest = plates.length ? plates[plates.length - 1] : 0;
  const tolerance = smallest > 0 ? smallest / 2 : 0;

  // 两轮：先贪心，再尝试用更小片补齐残差（贪心对非标准片集合可能非最优）
  for (const p of plates) {
    while (remaining + 1e-6 >= p + (tolerance > 0 ? 0 : 0)) {
      perSide.push(p);
      remaining -= p;
    }
  }

  const achievable = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return {
    target,
    achievable: Math.round(achievable * 100) / 100,
    perSide,
    exact: Math.abs(achievable - target) < 1e-6,
    bar,
  };
}

/** 把重量四舍五入到「可用片能配出的最近值」（0.5 步进，受最小片限制） */
export function roundToLoadable(
  targetTotal: number,
  config: PlateConfig = DEFAULT_PLATE_CONFIG
): number {
  const plates = (config.plates ?? []).filter((p) => Number.isFinite(p) && p > 0);
  const step = plates.length ? Math.min(...plates) * 2 : 2.5;
  const bar = Number.isFinite(config.barWeight) ? config.barWeight : 20;
  const load = Math.max(0, targetTotal - bar);
  const snapped = bar + Math.round(load / step) * step;
  return Math.round(snapped * 100) / 100;
}

// ============================================================================
// 容量格式化 —— 大数字压缩（12000 → 12k），统一供所有统计卡片使用
// ============================================================================

export function formatVolumeShort(volume: number): string {
  const v = Number(volume);
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  if (abs >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return String(Math.round(v));
}

/** 秒 → "1h 05m" / "12m 30s" / "45s" */
export function formatDurationParts(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

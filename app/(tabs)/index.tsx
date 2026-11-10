import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation } from 'react-native-reanimated';
import type { BodyPart, Exercise, PlanTemplate } from '@/types';
import {
  useThemeColors,
  spacing,
  radius,
  layout,
  strokeFromColors,
} from '@/theme';
import type { Colors } from '@/theme';
import {
  PressableScale,
  Icon,
  MiniTag,
  HybridImage,
  Skeleton,
} from '@/components/UIKit';
import { useAppStore } from '@/store/useAppStore';
import { safeHaptic } from '@/utils/haptic';
import {
  getImageUrl,
  iconForBodyPart,
  iconForEquipment,
  labelForBodyPart,
  labelForEquipment,
  labelForMuscle,
  translateTargetPhrase,
  displayNameZh,
} from '@/constants';
import { useExercisesStore } from '@/data/exercises-store';

// ============================================================================
// HomeScreen v5 — HOME REDESIGN.
// Purpose: 主页不是筛选面板，而是：
//   · Hero 欢迎 + 训练状态 CTA（无「超研·动作训练馆」品牌logo露出要求删除）
//   · 快捷入口 3 格：肌群图谱 / 我的收藏 / 数据面板
//   · 今日精选推荐：横向滑动 6 个随机动作卡 + 换一批
//   · 底部巨形 CTA：浏览完整动作库 → 跳转动作库 tab
//
// Aesthetic: Neo-Brutalist Editorial (继续v4设计令牌，但不做筛选面板)
//   · 粗 2.5-3px 描边 + 3px 位移无模糊硬阴影
//   · 进入动画：逐块 staggered opacity + translateY 入场
//   · CTA 主按钮有 1px 持续的呼吸脉冲 (reanimated 2.5s)
// ============================================================================

const REC_COUNT = 6;
/**
 * Home 页样式工厂。
 *
 * 依赖被刻意收窄到 `(colors, hasActiveWorkout, bottomInset)` 三个**标量**，
 * 而不是 `activeWorkout` 对象本身 —— 后者每次训练改动组都会产生新 identity，
 * 导致 90+ 条样式在训练过程中被反复重建。
 */
function createHomeStyles(
  colors: Colors,
  hasActiveWorkout: boolean,
  bottomInset: number
) {
  // —— 统一走 theme 令牌，不再本文件手写 rgba ——
  const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);
  // 底部避让 = 安全区 + 悬浮玻璃胶囊高度 + 间距 + 呼吸空间。
  // iOS 26 的 Tab 栏是浮在内容之上的玻璃胶囊，不再是贴边不透明条。
  const bottomPad = Math.max(bottomInset, spacing.xs)
    + layout.floatingTabBar.bottomGap
    + layout.floatingTabBar.height
    + layout.floatingTabBar.contentGap;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingTop: spacing.md,
      // 注意：ScrollView 外层 style.paddingBottom 只影响容器边框与可视区域的距离，
      // 不会让最后一屏内容往下推。真正的底部tabBar避让必须写在 contentContainerStyle（下面 scrollContent 里）。
      // Apple HIG：iPad / 宽屏下限制可读列宽，避免超长行距损害可读性。
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center' },
    scrollContent: {
      paddingHorizontal: layout.paddingHorizontal,
      paddingTop: spacing.md,
      // ↓ 关键：把底部避让写在 scrollContent（contentContainerStyle），
      // 才能让 03 浏览完整动作库 CTA 卡片的底部在滚到末端时不被 floating tabBar 压住。
      paddingBottom: bottomPad,
      gap: spacing.xl },

    // ===== HERO =====
    heroRow: { gap: spacing.md },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md },
    greetingCol: { flex: 1, minWidth: 0, gap: spacing.xs, paddingHorizontal: spacing.md },
    statusPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: hasActiveWorkout ? colors.primary : colors.surfaceBorder,
      backgroundColor: hasActiveWorkout ? colors.primary + '1A' : colors.surface },
    statusPillText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: -0.1,
      color: hasActiveWorkout ? colors.primary : colors.textSecondary },
    megaTitle: {
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -0.5,
      lineHeight: 41,
      color: colors.textPrimary,
      includeFontPadding: false },
    megaTitleAccent: { color: colors.primary },
    statLine: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: spacing.sm },
    statNum: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.primary },
    statDash: {
      flex: 0,
      width: 22,
      height: 2,
      backgroundColor: colors.textSecondary + '66' },
    statText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.textSecondary },

    // ===== iOS filled CTA (开始/继续训练) =====
    ctaCard: {
      marginTop: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md },
    ctaTextCol: { flex: 1, minWidth: 0, gap: 2 },
    ctaLabel: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
      color: colors.textInverse,
      letterSpacing: -0.3 },
    ctaSubLabel: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '400',
      letterSpacing: -0.1,
      color: colors.textInverse + (isDark ? 'A6' : 'CC') },
    ctaPlay: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.textInverse + '26',
      alignItems: 'center',
      justifyContent: 'center' },

    // ===== Search wrap (neo 降柔：2.5→1.5px 描边 + blur shadow) =====
    searchWrap: {
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      ...softShadow,
      elevation: 2,
      backgroundColor: colors.surface },
    searchFakeInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      height: 48,
      borderRadius: radius.xl - 2 },
    searchFakeInputPlaceholder: {
      flex: 1,
      minWidth: 0,
      color: colors.textTertiary,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
      letterSpacing: -0.1 },
    searchFakeInputFilled: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '600',
      letterSpacing: -0.1 },
    searchClearBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center' },

    // ===== Section Header — iOS 分组列表样式：13pt 大写 tertiary 小标题 =====
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: spacing.sm },
    sectionIndexTag: {
      display: 'none' },
    sectionIndexText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.textInverse },
    sectionTitle: {
      flex: 1,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textTertiary },
    sectionRule: {
      display: 'none' },
    // ---- 本周目标进度条 ----
    weekCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg },
    weekIconTray: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success + '18' },
    weekBody: { flex: 1, minWidth: 0 },
    weekTitle: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.xs },
    weekTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden' },
    weekFill: { height: '100%', borderRadius: 3, backgroundColor: colors.success },
    weekMeta: {
      marginTop: spacing.xs - 1,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '600',
      color: colors.textSecondary },
    sectionCountTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface },
    sectionCountText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.textSecondary },
    sectionSubHead: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      letterSpacing: -0.1,
      color: colors.textSecondary },

    // ===== Quick entries: 3 列瓷片（最突兀的块 → 最大力度柔化 2.5→1.5 描边 + softShadow）=====
    quickGrid: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs },
    quickTile: {
      flex: 1,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      ...softShadow,
      elevation: 2 },
    quickIconWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      // 边框色由 JSX 覆盖（按肌群/accent/info 上色），这里给个兜底
      borderColor: frameStroke,
      alignItems: 'center',
      justifyContent: 'center' },
    quickTitle: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      letterSpacing: 0,
      color: colors.textPrimary },
    quickHint: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.textSecondary },

    // ===== Muscle Atlas 5x2 compact tiles（2→1.5 描边, shadow 柔化）=====
    atlasGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm },
    atlasTile: {
      width: `${100 / 2 - spacing.sm / 2}%`,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface,
      padding: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      ...softShadow,
      elevation: 2 },
    atlasIconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center' },
    atlasInfo: { flex: 1, minWidth: 0, gap: spacing.xs },
    atlasLabel: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary },
    atlasCount: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.textSecondary },
    indexChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface },
    indexChipText: {
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.textTertiary },

    // ===== Recommended horizontal swiper（2.5→2 描边, shadow柔化）=====
    recSwiperWrap: {
      marginTop: spacing.xs,
      marginHorizontal: -layout.paddingHorizontal, // 冲破父容器水平内边距，实现首卡片贴边不与scrollContent的padding叠加
    },
    recContent: {
      gap: spacing.md,
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.md, // 柔阴影 blur 半径加大 → 给更多裁切空间
    },
    recCard: {
      width: 220,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...softShadow,
      elevation: 3 },
    recThumb: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: frameStroke },
    recCardBody: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm },
    recTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1 },
    recMeta: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.textSecondary,
      flexShrink: 1 },
    recTagsRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: spacing.xs,
      minWidth: 0,
      overflow: 'hidden' },
    recActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
      gap: spacing.sm },
    recAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
      flex: 1,
      minWidth: 0,
      justifyContent: 'center' },
    recAddBtnText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.primary,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: 104 },
    recFavBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.bg },

    // ===== Shuffle pill =====
    rightPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface },
    rightPillText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.textSecondary },

    // ===== Library CTA — iOS 列表行（inset grouped，无阴影）=====
    libCard: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md },
    libIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '1A' },
    libBody: { flex: 1, minWidth: 0, gap: 2 },
    libTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.textPrimary },
    libSub: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      letterSpacing: -0.1,
      color: colors.textSecondary },
    libCtaPill: {
      paddingHorizontal: spacing.md,
      minHeight: 32,
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: colors.primary + '1A' },
    libCtaText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      letterSpacing: -0.1,
      color: colors.primary },

    // ===== Pinned Templates 横滑卡 (v1.1.0 MVP) =====
    pinHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.md },
    pinTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: colors.textPrimary },
    pinCount: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.4,
      textTransform: 'uppercase' },
    pinSwiperWrap: {
      marginHorizontal: -layout.paddingHorizontal },
    pinSwiperContent: {
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.xs,
      gap: spacing.md },
    pinCard: {
      width: 260,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: accentStroke,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...softShadow,
      elevation: 3,
      gap: spacing.sm,
      position: 'relative',
      overflow: 'hidden' },
    pinStar: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.accent + '22',
      alignItems: 'center',
      justifyContent: 'center' },
    pinNum: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.accent },
    pinCardTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1,
      maxWidth: 200,
      minWidth: 0,
      flexShrink: 1 },
    pinCardDesc: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      maxWidth: 220,
      minWidth: 0,
      flexShrink: 1 },
    pinBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    pinBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      flexShrink: 1,
      maxWidth: 180 },
    pinBadgeText: {
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.2,
      minWidth: 0,
      flexShrink: 1 },
    pinBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    pinBtnStart: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: accentStroke },
    pinBtnStartText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textInverse,
      letterSpacing: 0.3 },
    pinBtnOpen: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke },
    pinBtnOpenText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textSecondary } });
}

export type HomeStyles = ReturnType<typeof createHomeStyles>;

const ANIM_EASE = {
  duration: 520,
  easing: Easing.bezier(0.22, 1, 0.36, 1) };

function seededRand(n: number) {
  // 轻量：不引入随机种子库；使用Date天的日种子让当日不变，明天变化
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let x = Math.sin(seed * 9301 + n * 49297) * 233280;
  x -= Math.floor(x);
  return x;
}

function pickRandomN(arr: Exercise[], n: number, shuffleToken: number): Exercise[] {
  const total = arr.length;
  if (total === 0) return [];
  const picks: Exercise[] = [];
  const seen = new Set<number>();
  let i = 0;
  while (picks.length < Math.min(n, total)) {
    const r = Math.abs(Math.floor(seededRand(i * 31 + shuffleToken) * total));
    const idx = r % total;
    if (!seen.has(idx)) {
      seen.add(idx);
      picks.push(arr[idx]);
    }
    i++;
    if (i > 500) break; // safety
  }
  return picks;
}

// Small wrapper: withDelay doesn't exist in older re-export; fall back to setTimeout if missing
const withDelay: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('react-native-reanimated').withDelay ??
  ((ms: number, v: any) => v);

// ============================================================================
// StaggerIn — 逐块错峰入场容器。
//
// 此前这里是 `staggerStyleFor(idx, trigger)`：在 HomeScreen 的 render 体里
// 按顺序调用 hook。这种写法要求「调用次数与顺序」在每次渲染中完全一致，
// 一旦有人加入条件分支就会触发 "Rendered more hooks than expected" 直接崩。
// 做成真正的组件后 hook 归属清晰，且 React 能在 index/trigger 不变时整棵跳过。
// ============================================================================

const StaggerIn = memo(function StaggerIn({
  index,
  trigger,
  children }: {
  index: number;
  trigger: number;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(index * 80, withTiming(1, ANIM_EASE));
    // 卸载时取消动画：否则切换 tab 后 worklet 仍在后台驱动共享值，白白占用 UI 线程。
    return () => {
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, trigger]);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [18, 0], Extrapolation.CLAMP) },
    ] }));

  return <Animated.View style={anim}>{children}</Animated.View>;
});

// ============================================================================
// HomeSectionHeader — 章节标题（01 / 02 / 03 序号块 + 标题 + 规则线 + 右侧操作）。
//
// 之前这个组件定义在 HomeScreen 的 render 体内部：每次渲染都会得到一个新的
// 组件类型，React 判定为「换了个组件」→ 卸载旧子树 + 重新挂载，共享值复位、
// 入场动画被反复重播，还会丢失子树内部状态。提到模块级后，只有 props 真正
// 变化才会重渲染。
// ============================================================================

function HomeSectionHeader({
  index,
  title,
  right,
  subtitle,
  trigger,
  animIdx,
  styles }: {
  index: string;
  title: string;
  right?: React.ReactNode;
  subtitle?: string;
  trigger: number;
  animIdx: number;
  styles: HomeStyles;
}) {
  return (
    <StaggerIn index={animIdx} trigger={trigger}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIndexTag}>
          <Text style={styles.sectionIndexText}>{index}</Text>
        </View>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.sectionRule} pointerEvents="none" />
        {right}
      </View>
      {subtitle ? <Text style={styles.sectionSubHead}>{subtitle}</Text> : null}
    </StaggerIn>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const store = useExercisesStore();
  store.ensureReady();
  const insets = useSafeAreaInsets();

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  // ===== Subscriptions =====
  const activeWorkout = useAppStore((s) => s.activeWorkout);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const startWorkoutFromTemplate = useAppStore((s) => s.startWorkoutFromTemplate);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const addExerciseToActive = useAppStore((s) => s.addExerciseToActive);
  const totalWorkouts = useAppStore((s) => s.totalWorkouts());
  const streak = useAppStore((s) => s.streakDays());
  const pinnedTemplateIds = useAppStore((s) => s.pinnedTemplateIds);
  const customTemplates = useAppStore((s) => s.customTemplates);
  const listPresetTemplates = useAppStore((s) => s.listPresetTemplates);
  const weeklyGoal = useAppStore((s) => s.settings.weeklyGoal);
  const weeklyProgressFn = useAppStore((s) => s.weeklyProgress);
  const workouts = useAppStore((s) => s.workouts);

  /**
   * 本周达成度 —— 对标训记首页的「本周 X/Y 次」。
   * 口径直接复用 store.weeklyProgress（底层 analytics.weeklyProgress），
   * 与数据面板、设置页共用同一份定义，避免三处各算一套。
   */
  const weekStat = useMemo(
    () => weeklyProgressFn(),
    // workouts 必须进依赖：训练结束后本周次数要立刻反映到首页
    [weeklyProgressFn, workouts, weeklyGoal]
  );

  // ===== Home-only state =====
  const [query, setQuery] = useState('');
  const [shuffleToken, setShuffleToken] = useState(0);
  const animTrigger = useRef(0);
  const [animTick, setAnimTick] = useState(0);

  // 入场：每次卸载/再挂载触发一次；这里简单mount tick一次即可
  useEffect(() => {
    animTrigger.current += 1;
    setAnimTick(animTrigger.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allExercises = useMemo(() => store.filter({}), [store]);
  const recommended = useMemo(
    () => pickRandomN(allExercises, REC_COUNT, shuffleToken),
    [allExercises, shuffleToken],
  );

  // ===== Navigation =====
  const handleStartWorkout = useCallback(() => {
    safeHaptic('medium');
    if (!activeWorkout) startWorkout();
    router.push('/workout/start' as Parameters<typeof router.push>[0]);
  }, [activeWorkout, router, startWorkout]);

  const openLibrary = useCallback(
    (params?: { bodyPart?: BodyPart; equipment?: string; favorite?: boolean; searchQuery?: string }) => {
      safeHaptic('light');
      router.push({
        pathname: '/(tabs)/library',
        params: params as any } as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const goDetail = useCallback(
    (id: string) => {
      safeHaptic('light');
      router.push({
        pathname: '/exercise/[id]',
        params: { id } } as Parameters<typeof router.push>[0]);
    },
    [router],
  );

  const quickAdd = useCallback(
    (id: string) => {
      if (!activeWorkout) startWorkout();
      safeHaptic('success');
      addExerciseToActive(id);
    },
    [activeWorkout, startWorkout, addExerciseToActive],
  );

  const handleShuffle = useCallback(() => {
    safeHaptic('light');
    setShuffleToken((v) => v + 1);
    setAnimTick((x) => x + 1); // replay staggered
  }, []);

  // ===== Styles + design tokens (v1.1 全局视觉令牌统一) =====
  // 样式工厂提到模块层：以前整个 StyleSheet 依赖 `activeWorkout` **对象**，
  // 于是训练中每改一次组（对象 identity 变化）都会重建这里全部 ~90 条样式。
  // 现在只依赖 `hasActiveWorkout` 布尔值，mid-workout 不再有任何样式重建。
  const s = useMemo(
    () => createHomeStyles(colors, activeWorkout != null, insets.bottom),
    [colors, activeWorkout != null, insets.bottom]
  );

  // CTA 呼吸：循环 scale 0.985→1.02 每 2.5s
  const breathScale = useSharedValue(1);
  useEffect(() => {
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.018, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.988, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    // ★ 切 tab 后组件卸载，取消无限循环动画避免后台 CPU 持续消耗
    return () => {
      cancelAnimation(breathScale);
      breathScale.value = 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const breathAnim = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }] }));

  // ===== Render pieces =====
  const bodyPartCounts = useMemo(() => store.countByBodyPart(), [store]);

  // ====== Pinned templates (home 横滑 前3) ======
  const pinnedTemplates = useMemo(() => {
    const all = [...listPresetTemplates(), ...customTemplates];
    // keep pinnedTemplateIds 顺序 (slice 前 3)
    return pinnedTemplateIds
      .slice(0, 3)
      .map((id) => all.find((t) => t.id === id))
      .filter(Boolean) as PlanTemplate[];
  }, [listPresetTemplates, customTemplates, pinnedTemplateIds]);

  const handleStartTemplate = useCallback(
    (tplId: string) => {
      safeHaptic('medium');
      startWorkoutFromTemplate(tplId, 0);
      router.push('/workout/start' as any);
    },
    [router, startWorkoutFromTemplate]
  );
  const openTemplates = useCallback(() => {
    safeHaptic('light');
    router.push('/templates' as any);
  }, [router]);

  // ===== Handlers for the recommendation rail =====
  // 收藏按钮以前直接内联 `useAppStore.getState()` 捞 action，每次渲染都新建闭包；
  // 抽成稳定的 toggle 回调，推荐卡的 memo 才有意义。
  const toggleFavoriteById = useCallback((id: string) => {
    safeHaptic('light');
    useAppStore.getState().toggleFavorite(id);
  }, []);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        scrollEventThrottle={16}
      >
        {/* ===== 01 · HERO 欢迎 + CTA ===== */}
        <StaggerIn index={0} trigger={animTick}>
          <View style={s.heroRow}>
            <View style={s.greetingRow}>
              <View style={s.greetingCol}>
                <View style={s.statusPill} pointerEvents="none">
                  <Text style={s.statusPillText} numberOfLines={1}>
                    {activeWorkout ? `● ${t('home.greetingActive')}` : t('home.heroReady')}
                  </Text>
                </View>
                <Text style={s.megaTitle}>
                  <>
                    {t('home.megaTitleIntro')}
                    <Text style={s.megaTitleAccent}>{t('home.megaTitleAccent')}</Text>
                    {t('home.megaTitleSuffix')}
                  </>
                </Text>
                <View style={s.statLine}>
                  <Text style={s.statNum}>{store.total().toString().padStart(4, '0')}</Text>
                  <View style={s.statDash} pointerEvents="none" />
                  <Text style={s.statText}>
                    {effectiveLang === 'zh' ? t('home.heroSubLabelZh') : t('app.heroCount')}
                  </Text>
                </View>
              </View>
            </View>

            <PressableScale
              onPress={handleStartWorkout}
              style={s.ctaCard}
              scaleTo={0.975}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={activeWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
              testID="cta-start-workout"
            >
              <Animated.View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, breathAnim]}>
                <View style={s.ctaTextCol}>
                  <Text style={s.ctaLabel}>
                    {activeWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
                  </Text>
                  <Text style={s.ctaSubLabel}>
                    {activeWorkout ? t('home.ctaSubResume') : t('home.ctaSubStart')}
                  </Text>
                </View>
                <View style={s.ctaPlay} pointerEvents="none">
                  <Icon
                    name="play"
                    size={20}
                    color={colors.primary}
                  />
                </View>
              </Animated.View>
            </PressableScale>
          </View>
        </StaggerIn>

        {/* ===== 本周目标进度 ===== */}
        <StaggerIn index={1} trigger={animTick}>
          <PressableScale
            onPress={() => {
              safeHaptic('light');
              router.push('/stats' as Parameters<typeof router.push>[0]);
            }}
            style={s.weekCard}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={t('home.weekGoalA11y', { defaultValue: '查看训练数据面板' })}
          >
            <View style={s.weekIconTray} pointerEvents="none">
              <Icon name="calendar-check" size={17} color={colors.success} />
            </View>
            <View style={s.weekBody}>
              {weekStat.goal > 0 ? (
                <>
                  <Text style={s.weekTitle} numberOfLines={1}>
                    {t('home.weekGoal', {
                      defaultValue: '本周 {{done}} / {{goal}} 次',
                      done: weekStat.done,
                      goal: weekStat.goal })}
                    {weekStat.done >= weekStat.goal
                      ? ` · ${t('home.weekGoalDone', { defaultValue: '已达标' })}`
                      : ''}
                  </Text>
                  <View style={s.weekTrack} pointerEvents="none">
                    <View
                      style={[
                        s.weekFill,
                        { width: `${Math.round(Math.min(1, weekStat.ratio) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.weekMeta} numberOfLines={1}>
                    {t('home.weekGoalStreak', {
                      defaultValue: '连续训练 {{n}} 天',
                      n: streak })}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.weekTitle} numberOfLines={1}>
                    {t('home.weekGoalNone', { defaultValue: '本周已训练 {{done}} 次', done: weekStat.done })}
                  </Text>
                  <Text style={s.weekMeta} numberOfLines={1}>
                    {t('home.weekGoalSetHint', {
                      defaultValue: '去设置里定一个每周目标，首页会显示达成度。' })}
                  </Text>
                </>
              )}
            </View>
            <Icon name="chevron-right" size={14} color={colors.textTertiary} />
          </PressableScale>
        </StaggerIn>

        {/* ===== 搜索框（Home内只读展示样式：点击进入Library搜索页，避免Pressable包裹TextInput拦截输入）===== */}
        <StaggerIn index={1} trigger={animTick}>
          <PressableScale
            onPress={() => openLibrary({ searchQuery: query || undefined })}
            style={s.searchWrap}
            scaleTo={0.985}
            accessibilityRole="search"
            accessibilityLabel={t('home.searchPlaceholder')}
          >
            <View style={s.searchFakeInput}>
              <Icon
                name="magnify"
                size={20}
                color={colors.textSecondary}
              />
              <Text
                style={query ? s.searchFakeInputFilled : s.searchFakeInputPlaceholder}
                numberOfLines={1}
              >
                {query ? query : t('home.searchPlaceholder')}
              </Text>
              {!!query ? (
                <PressableScale
                  onPress={(ev) => { ev?.stopPropagation?.(); setQuery(''); safeHaptic('light'); }}
                  style={s.searchClearBtn}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.clear')}
                  scaleTo={0.92}
                >
                  <Icon name="close" size={12} color={colors.textSecondary} />
                </PressableScale>
              ) : null}
            </View>
          </PressableScale>
        </StaggerIn>

        {/* ===== 置顶模板横滑 (v1.1.0 MVP, 仅 pin>0 时显示) ===== */}
        {pinnedTemplates.length > 0 && (
          <StaggerIn index={2} trigger={animTick}>
            <View style={s.pinHeaderRow}>
              <Text style={s.pinTitle}>
                ★ {t('home.pinnedSection')}
              </Text>
              <PressableScale
                onPress={openTemplates}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('templates.title')}
              >
                <Text style={s.pinCount}>
                  {t('templates.title')} ›
                </Text>
              </PressableScale>
            </View>
            <View style={s.pinSwiperWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.pinSwiperContent}
                decelerationRate="fast"
                snapToAlignment="start"
                snapToInterval={260 + spacing.md}
                disableIntervalMomentum={Platform.OS !== 'web'}
              >
                {pinnedTemplates.map((tpl, idx) => {
                  const levelLabel =
                    t('workout.level' + tpl.level.charAt(0).toUpperCase() + tpl.level.slice(1));
                  const goalLabel = t(
                    'workout.goal' +
                      tpl.goal
                        .split('-')
                        .map((x: string) => x.charAt(0).toUpperCase() + x.slice(1))
                        .join('')
                  );
                  return (
                    <PressableScale
                      key={tpl.id}
                      style={s.pinCard}
                      scaleTo={0.97}
                      onPress={() => handleStartTemplate(tpl.id)}
                      accessibilityRole="button"
                      accessibilityLabel={tpl.name[effectiveLang]}
                    >
                      <View style={s.pinStar}>
                        <Icon name="star" size={12} color={colors.accent} />
                      </View>
                      <Text style={s.pinNum}>0{idx + 1}</Text>
                      <Text style={s.pinCardTitle} numberOfLines={1}>
                        {tpl.name[effectiveLang]}
                      </Text>
                      <Text style={s.pinCardDesc} numberOfLines={2}>
                        {tpl.description[effectiveLang]}
                      </Text>
                      <View style={s.pinBadgeRow}>
                        <View style={s.pinBadge}><Text style={s.pinBadgeText} numberOfLines={1}>{levelLabel.replace(/\{\{[nN]\}\}/g, '')}</Text></View>
                        <View style={s.pinBadge}><Text style={s.pinBadgeText} numberOfLines={1}>{goalLabel.replace(/\{\{[nN]\}\}/g, '')}</Text></View>
                        <View style={s.pinBadge}>
                          <Text style={s.pinBadgeText} numberOfLines={1}>
                            {/* 根因修复: 之前传 {count: X} 但翻译文件占位符是 {{n}} → react-i18next 找不到值原样输出 {{n}} → 现在改为 {n: value} */}
                            {t('workout.perWeek', { n: (tpl as any).daysPerWeek ?? 3 }).replace(/\{\{[nN]\}\}/g, '')}
                          </Text>
                        </View>
                        <View style={s.pinBadge}>
                          <Text style={s.pinBadgeText} numberOfLines={1}>
                            {t('workout.sessionCount', { n: (tpl as any).sessions?.length ?? 0 }).replace(/\{\{[nN]\}\}/g, '')}
                          </Text>
                        </View>
                      </View>
                      <View style={s.pinBtnRow}>
                        <PressableScale
                          onPress={(ev) => { ev?.stopPropagation?.(); handleStartTemplate(tpl.id); }}
                          style={s.pinBtnStart}
                          accessibilityRole="button"
                          accessibilityLabel={t('templates.start')}
                        >
                          <Icon
                            name="play"
                            size={12}
                            color={colors.textInverse}
                          />
                          <Text style={s.pinBtnStartText}>{t('templates.start')}</Text>
                        </PressableScale>
                        <PressableScale
                          onPress={(ev) => { ev?.stopPropagation?.(); openTemplates(); }}
                          style={s.pinBtnOpen}
                          accessibilityRole="button"
                          accessibilityLabel={t('home.detailsBtn')}
                        >
                          <Text style={s.pinBtnOpenText}>
                            {t('home.detailsBtn')}
                          </Text>
                        </PressableScale>
                      </View>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>
          </StaggerIn>
        )}

        {/* ===== 02 · 快捷入口 ===== */}
        <HomeSectionHeader
          index="01"
          title={t('home.quickEntries')}
          trigger={animTick}
          animIdx={pinnedTemplates.length > 0 ? 5 : 2}
          styles={s}
        />
        <StaggerIn index={3} trigger={animTick}>
          <View style={s.quickGrid}>
            {/* 肌群图谱 */}
            <PressableScale
              onPress={() => openLibrary()}
              style={s.quickTile}
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel={t('home.muscleOverview')}
            >
              <View style={[s.quickIconWrap, { backgroundColor: colors.primary + '1F', borderColor: colors.primary }]}>
                <Icon name="arm-flex-outline" size={18} color={colors.primary} />
              </View>
              <Text style={s.quickTitle} numberOfLines={1}>{t('home.muscleOverview')}</Text>
              <Text style={s.quickHint} numberOfLines={1}>{t('home.muscleOverviewHint')}</Text>
            </PressableScale>
            {/* 我的收藏 */}
            <PressableScale
              onPress={() => openLibrary({ favorite: true })}
              style={s.quickTile}
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel={t('home.favorites')}
            >
              <View style={[s.quickIconWrap, { backgroundColor: colors.accent + '1F', borderColor: colors.accent }]}>
                <Icon name="heart-outline" size={18} color={colors.accent} />
              </View>
              <Text style={s.quickTitle} numberOfLines={1}>{t('home.favorites')}</Text>
              <Text style={s.quickHint} numberOfLines={1}>
                {t('home.favoritesHint', { n: favoriteIds.length, defaultValue: '' }) || `${favoriteIds.length} ${effectiveLang === 'zh' ? '个已收藏' : 'favorites'}`}
              </Text>
            </PressableScale>
            {/* 数据面板 */}
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                // 曾指向 '/(tabs)/stats'，但 (tabs) 分组下并没有 stats 屏 →
                // 每次点击都静默失败（或退回动作库）。数据面板是栈上页面
                // app/stats/index.tsx，这里改为直接 push 真实路由。
                router.push('/stats' as Parameters<typeof router.push>[0]);
              }}
              style={s.quickTile}
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel={t('home.stats')}
            >
              <View style={[s.quickIconWrap, { backgroundColor: colors.info + '1F', borderColor: colors.info }]}>
                <Icon name="chart-bar" size={18} color={colors.info} />
              </View>
              <Text style={s.quickTitle} numberOfLines={1}>{t('home.stats')}</Text>
              <Text style={s.quickHint} numberOfLines={1}>
                {`${totalWorkouts} ${t('workout.heroUnitWorkouts')} · ${streak}${t('workout.heroUnitStreak')}`}
              </Text>
            </PressableScale>
          </View>
        </StaggerIn>

        {/* ===== 03 · 肌群图谱 mini 2×5 预览 ===== */}
        <StaggerIn index={4} trigger={animTick}>
          <View style={s.atlasGrid}>
            {bodyPartCounts.map((row, idx) => {
              const tint = (colors.muscle as any)?.[row.bodyPart] ?? colors.primary;
              const label = labelForBodyPart(row.bodyPart, effectiveLang);
              const indexStr = `${idx + 1}`.padStart(2, '0');
              return (
                <PressableScale
                  key={row.bodyPart}
                  onPress={() => openLibrary({ bodyPart: row.bodyPart })}
                  style={s.atlasTile}
                  scaleTo={0.965}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={[s.atlasIconWrap, { backgroundColor: tint }]}>
                    <Icon
                      name={iconForBodyPart(row.bodyPart)}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={s.atlasInfo}>
                    <Text style={s.atlasLabel} numberOfLines={1}>{label}</Text>
                    <Text style={s.atlasCount} numberOfLines={1}>
                      {`${row.count} ${t('home.countZhSuffix')}`}
                    </Text>
                  </View>
                  <View style={s.indexChip} pointerEvents="none">
                    <Text style={s.indexChipText}>#{indexStr}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </StaggerIn>

        {/* ===== 04 · 今日精选推荐 ===== */}
        <HomeSectionHeader
          index="02"
          title={t('home.recommendations')}
          subtitle={t('home.recommendationsHint')}
          trigger={animTick}
          animIdx={5}
          styles={s}
          right={
            <PressableScale
              onPress={handleShuffle}
              style={s.rightPill}
              scaleTo={0.93}
              accessibilityRole="button"
              accessibilityLabel={t('home.refreshRecommendation')}
            >
              <Icon name="shuffle-variant" size={12} color={colors.textSecondary} />
              <Text style={s.rightPillText} numberOfLines={1}>
                {t('home.refreshRecommendation')}
              </Text>
            </PressableScale>
          }
        />
        <StaggerIn index={6} trigger={animTick}>
          <View style={s.recSwiperWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.recContent}
              decelerationRate="fast"
              snapToAlignment="start"
              snapToInterval={220 + spacing.md}
              disableIntervalMomentum={Platform.OS !== 'web'}
            >
              {recommended.length === 0 ? (
                <>
                  <Skeleton height={200} width={220} borderRadius={18} />
                  <View style={{ width: spacing.md }} />
                  <Skeleton height={200} width={220} borderRadius={18} />
                  <View style={{ width: spacing.md }} />
                  <Skeleton height={200} width={220} borderRadius={18} />
                </>
              ) : (
                recommended.map((ex, idx) => {
                  const tint =
                    (colors.muscle as Record<string, string>)?.[ex.body_part] ?? colors.primary;
                  const isFav = favoriteIds.includes(ex.id);
                  // 简介：target translated + fallback zh instructions lead 60
                  const instrZh = (ex.instructions as any)?.zh ?? '';
                  const instrEn = (ex.instructions as any)?.en ?? '';
                  const lead = effectiveLang === 'zh' ? instrZh : instrEn;
                  const descText = translateTargetPhrase(ex.target ?? '', effectiveLang) || lead?.slice(0, 60) || '';
                  return (
                  <PressableScale
                    key={`${ex.id}-${idx}`}
                    onPress={() => goDetail(ex.id)}
                    style={s.recCard}
                    scaleTo={0.975}
                    accessibilityRole="button"
                    accessibilityLabel={displayNameZh(ex)}
                  >
                    <View style={[s.recThumb, { backgroundColor: tint + '22' }]}>
                      <HybridImage
                        uri={getImageUrl(ex.image)}
                        tint={tint}
                        iconName={iconForBodyPart(ex.body_part)}
                        fallbackBodyPart={ex.body_part}
                        fallbackTint={tint}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        iconRatio={0.45}
                      />
                    </View>
                    <View style={s.recCardBody}>
                      <Text style={s.recTitle} numberOfLines={2}>
                        {displayNameZh(ex)}
                      </Text>
                      <Text style={s.recMeta} numberOfLines={1}>
                        {`${translateTargetPhrase(ex.target ?? '', effectiveLang) || labelForEquipment(ex.equipment, effectiveLang)} · ${labelForEquipment(ex.equipment, effectiveLang)}`}
                      </Text>
                      {/* 简介 1 行 */}
                      {descText ? (
                        <Text style={[s.recMeta, { color: colors.textTertiary }]} numberOfLines={1} ellipsizeMode="tail">
                          {descText}
                        </Text>
                      ) : null}
                      <View style={s.recTagsRow}>
                        <MiniTag
                          icon={iconForBodyPart(ex.body_part)}
                          label={labelForBodyPart(ex.body_part, effectiveLang)}
                          color={tint}
                          size="sm"
                        />
                        <MiniTag
                          icon={iconForEquipment(ex.equipment)}
                          label={labelForEquipment(ex.equipment, effectiveLang)}
                          color={colors.info}
                          size="sm"
                        />
                        {(ex.secondary_muscles ?? []).slice(0, 2).map((m) => {
                          const zh = labelForMuscle(m, effectiveLang);
                          return (
                            <MiniTag
                              key={m}
                              // "muscle" 不在 glyphmap 里（会渲染成问号），次级肌群用 arm-flex-outline
                              icon="arm-flex-outline"
                              label={zh.length > 5 ? zh.slice(0, 5) : zh}
                              color={tint}
                              size="sm"
                            />
                          );
                        })}
                      </View>
                      <View style={s.recActions}>
                        <PressableScale
                          onPress={(ev) => {
                            ev?.stopPropagation?.();
                            quickAdd(ex.id);
                          }}
                          style={s.recAddBtn}
                          scaleTo={0.92}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.addToWorkout')}
                        >
                          <Icon name="plus" size={14} color={colors.primary} />
                          <Text style={s.recAddBtnText} numberOfLines={1}>
                            {t('common.addToWorkout')}
                          </Text>
                        </PressableScale>
                        <PressableScale
                          onPress={(ev) => {
                            ev?.stopPropagation?.();
                            toggleFavoriteById(ex.id);
                          }}
                          style={s.recFavBtn}
                          scaleTo={0.9}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={isFav ? t('common.unfavorite') : t('common.favorite')}
                        >
                          <Icon
                            name={isFav ? 'heart' : 'heart-outline'}
                            size={16}
                            color={isFav ? colors.accent : colors.textTertiary}
                          />
                        </PressableScale>
                      </View>
                    </View>
                  </PressableScale>
                );
              })
              )}
            </ScrollView>
          </View>
        </StaggerIn>

        {/* ===== 05 · 浏览完整动作库（巨型 CTA） ===== */}
        <HomeSectionHeader
          index="03"
          title={t('home.libraryEntry')}
          subtitle={t('home.libraryEntrySub')}
          trigger={animTick}
          animIdx={7}
          styles={s}
        />
        <StaggerIn index={8} trigger={animTick}>
          <PressableScale
            onPress={() => openLibrary()}
            style={s.libCard}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('home.libraryEntry')}
          >
            <View style={s.libIcon} pointerEvents="none">
              <Icon name="book-open-page-variant" size={18} color={colors.primary} />
            </View>
            <View style={s.libBody}>
              <Text style={s.libTitle} numberOfLines={1}>
                {t('library.title')}
              </Text>
              <Text style={s.libSub} numberOfLines={1}>
                {t('home.libraryEntrySub')}
              </Text>
            </View>
            <View style={s.libCtaPill} pointerEvents="none">
              <Text style={s.libCtaText}>
                {t('home.enterCta')}
              </Text>
            </View>
          </PressableScale>
        </StaggerIn>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { WorkoutSession } from '@/types';
import {
  useThemeColors,
  spacing,
  radius,
  layout,
  strokeFromColors,
  muscleColor,
} from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { getAllExercisesSync } from '@/data/queries';
import {
  iconForBodyPart,
  getImageUrl,
} from '@/constants';
import {
  PressableScale,
  Icon,
  MiniStat,
  SlabDivider,
  EmptyState,
  SectionHeader,
  HybridImage,
  Skeleton,
} from '@/components/UIKit';
import { safeHaptic } from '@/utils/haptic';
import { formatDurationHuman } from '@/utils/format';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

export default function WorkoutScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // Subscribe to stable slices — avoid calling expensive stats getters from
  // inside selectors. Methods like streakDays() / totalVolumeKg() iterate
  // the full workouts tree on every state change if invoked during select.
  const workouts = useAppStore((s) => s.workouts);
  const activeWorkout = useAppStore((s) => s.activeWorkout);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const listPresetTemplates = useAppStore((s) => s.listPresetTemplates);
  const startWorkoutFromTemplate = useAppStore((s) => s.startWorkoutFromTemplate);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);
  const units = useAppStore((s) => s.settings.units);

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  // Stats are derived once per `workouts` reference change.
  //
  // CRITICAL FIX: streak calculation previously lived in THREE places
  // (workout.tsx, profile.tsx, and store.streakDays()) and drifted apart
  // (Profile had "yesterday grace" but the Workout tab did not).  We now
  // delegate streak semantics EXCLUSIVELY to `store.streakDays()` so the
  // three tabs cannot disagree.  Local volume / total iteration remains
  // only because `totalVolumeKg()` returns kg regardless of settings.units
  // (we'd need a conversion step if we re-used it here).
  const { streak, total, volume } = useMemo(() => {
    const store = useAppStore.getState();
    let totalVol = 0;
    // 深度防御：workouts / exercises / sets 任一层都可能为 undefined（旧 vault），
    // 逐层归一化，避免历史数据缺字段时统计栏直接闪退。
    const safeWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
    for (const w of safeWorkouts) {
      if (!Array.isArray(w.exercises)) continue;
      for (const e of w.exercises) {
        if (!e || !Array.isArray(e.sets)) continue;
        for (const set of e.sets) {
          if (set && set.completed) {
            totalVol += (Number(set.weight) || 0) * (Number(set.reps) || 0);
          }
        }
      }
    }
    return {
      streak: store.streakDays(),
      total: safeWorkouts.length,
      volume: Math.round(totalVol) };
  }, [workouts]);

  const exercises = useMemo(() => getAllExercisesSync(), []);
  const exMap = useMemo(() => {
    // 双保险 String 强制统一：详见 start.tsx exMap 注释（exercises.json id=STRING，历史 vault 存 NUMBER）
    const m = new Map(exercises.map((e) => [String(e.id), e]));
    return m;
  }, [exercises]);

  const handleStart = useCallback(() => {
    safeHaptic('medium');
    const route = '/workout/start' as const;
    if (activeWorkout) {
      router.push(route as Parameters<typeof router.push>[0]);
    } else {
      startWorkout();
      router.push(route as Parameters<typeof router.push>[0]);
    }
  }, [activeWorkout, router, startWorkout]);

  const openTemplates = useCallback(() => {
    safeHaptic('light');
    router.push('/templates' as any);
  }, [router]);

  const handleStartFromTemplate = useCallback(
    (tplId: string) => {
      safeHaptic('medium');
      startWorkoutFromTemplate(tplId, 0);
      router.push('/workout/start' as any);
    },
    [router, startWorkoutFromTemplate]
  );

  // —— 6 预置模板（只读，横滑）
  const presetTemplates = useMemo(() => listPresetTemplates().slice(0, 6), [listPresetTemplates]);

  const handleDelete = useCallback(
    (id: string) => {
      // Previously the Alert title was `workout.historyTitle` — a generic
      // history list header.  Users need context that they are DELETING one
      // specific session, so we use the dedicated deleteOneTitle key.
      Alert.alert(t('workout.deleteOneTitle'), t('workout.deleteOneConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            safeHaptic('warning');
            deleteWorkout(id);
          } },
      ]);
    },
    [deleteWorkout, t]
  );

  const handleOpenActive = useCallback(() => {
    safeHaptic('light');
    router.push('/workout/start' as Parameters<typeof router.push>[0]);
  }, [router]);

  // 7 day bars + maxBar are coupled; compute together to avoid a stale
  // intermediate maxBar when workouts updates haven't propagated through
  // re-render yet (first paint would show old height + new data).
  const { last7Days, maxBar } = useMemo(() => {
    const week = new Array(7).fill(0) as number[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 深度防御：workouts 在旧 vault / 异常 merge 下可能不是数组。
    const safeWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
    for (const w of safeWorkouts) {
      if (!w || !w.date) continue;
      const d = new Date(w.date);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) {
        week[6 - diff]++;
      }
    }
    return { last7Days: week, maxBar: Math.max(1, ...week) };
  }, [workouts]);

  const dayLabels = useMemo(() => {
    // Semantic day labels via compact.day* keys.  Previously this array
    // was hardcoded CJK ("日一二三四五六") and leaked into EN/ja UIs as
    // undecipherable glyph soup even when every other label was English.
    const compactNames = [
      t('compact.daySun'), t('compact.dayMon'), t('compact.dayTue'),
      t('compact.dayWed'), t('compact.dayThu'), t('compact.dayFri'),
      t('compact.daySat'),
    ];
    const arr: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(compactNames[d.getDay()]);
    }
    return arr;
  }, [t]);

  // Weekly Volume (7-day) — Σ completed (weight × reps) per day.
  // Index convention matches last7Days: arr[0] = 6 days ago, arr[6] = today.
  const { weeklyVol, totalVol7, maxVol7 } = useMemo(() => {
    const vols = new Array(7).fill(0) as number[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const safeWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
    for (const w of safeWorkouts) {
      if (!w || !Array.isArray(w.exercises)) continue;
      if (!w.date) continue;
      const d = new Date(w.date);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) {
        let dayVol = 0;
        for (const e of w.exercises) {
          if (!e || !Array.isArray(e.sets)) continue;
          for (const set of e.sets) {
            if (set && set.completed) {
              dayVol += (Number(set.weight) || 0) * (Number(set.reps) || 0);
            }
          }
        }
        vols[6 - diff] += dayVol;
      }
    }
    const total = vols.reduce((a, b) => a + b, 0);
    const maxV = Math.max(0, ...vols);
    return { weeklyVol: vols, totalVol7: Math.round(total), maxVol7: maxV };
  }, [workouts]);

  const styles = useMemo(() => {
    // —— 统一走 theme 令牌，不再本文件手写 rgba ——
    const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);
    return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    // Apple HIG：iPad / 宽屏下限制可读列宽，避免超长行距损害可读性。
    readable: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
    content: { paddingHorizontal: layout.paddingHorizontal, paddingTop: spacing.sm },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: spacing.lg,
      gap: spacing.md },
    brandLine: {
      color: colors.accent,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700',
      marginBottom: spacing.xs },
    title: {
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: -0.5,
      lineHeight: 41,
      color: colors.textPrimary },
    primaryCTA: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      minHeight: 44,
      borderRadius: radius.md,
      flexShrink: 0 },
    primaryCTAHot: {
      backgroundColor: colors.accent },
    headerLeft: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: spacing.xs },
    ctaIconTray: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.textInverse + '18',
      alignItems: 'center',
      justifyContent: 'center' },
    ctaIconTrayActive: {
      backgroundColor: colors.textInverse + '20' },
    ctaText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textInverse,
      letterSpacing: 0.3 },
    activeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accent + '55',
      marginBottom: spacing.lg,
      position: 'relative',
      overflow: 'hidden',
      gap: spacing.sm },
    activeAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.accent },
    activeBody: {
      flex: 1 },
    activeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent + '22',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999 },
    activePulse: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent },
    activeBadgeText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: 'uppercase' },
    activeName: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginLeft: spacing.sm,
      letterSpacing: -0.1 },
    activeMeta: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: colors.textSecondary },
    activeChevron: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent + '18',
      alignItems: 'center',
      justifyContent: 'center' },
    statsStrip: {
      flexDirection: 'row',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      marginBottom: spacing.lg },
    weekCard: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      marginBottom: spacing.xl },
    weekHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md },
    weekTitle: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1 },
    barRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 84,
      gap: spacing.xs },
    barCol: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs },
    barBg: {
      width: '100%',
      maxWidth: 32,
      height: 72,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.sm,
      justifyContent: 'flex-end',
      overflow: 'hidden' },
    barFill: {
      width: '100%',
      borderRadius: radius.sm,
      minHeight: 8 },
    barLabel: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.4 },
    gapSm: { height: spacing.sm },
    headerBtnCol: {
      gap: spacing.xs,
      alignItems: 'flex-end' },
    openTemplatesBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 1,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder },
    openTemplatesBtnText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textSecondary },
    tplSectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
      gap: spacing.sm },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      gap: spacing.sm },
    tplSectionTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary },
    tplSectionCount: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.4,
      textTransform: 'uppercase' },
    tplSwiperWrap: {
      marginHorizontal: -layout.paddingHorizontal,
      marginBottom: spacing.lg },
    tplSwiperContent: {
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.xs,
      gap: spacing.md },
    tplCard: {
      width: 240,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      backgroundColor: colors.surface,
      padding: spacing.md,
      ...softShadow,
      elevation: 2,
      gap: spacing.sm,
      position: 'relative',
      overflow: 'hidden' },
    tplLevelStripe: {
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    tplTitle: {
      marginLeft: spacing.xs,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1 },
    tplDesc: {
      marginLeft: spacing.xs,
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 15 },
    tplBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginLeft: spacing.xs },
    tplBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder },
    tplBadgeText: {
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.2 },
    tplStartBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
      marginLeft: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: accentStroke },
    tplStartText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textInverse,
      letterSpacing: 0.3 },
    // Weekly Volume SVG card
    volCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...softShadow,
      elevation: 2 },
    volHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm },
    volTitleCol: {
      flex: 1,
      minWidth: 0 },
    volTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1 },
    volSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: spacing.xs,
      lineHeight: 15 },
    volEmpty: {
      height: 160,
      alignItems: 'center',
      justifyContent: 'center' },
    volEmptyText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textTertiary,
      textAlign: 'center' },
    // 底部占位：安全区 + 悬浮玻璃胶囊高度 + 间距 + 呼吸
    bottomInset: {
      height:
        Math.max(insets.bottom, spacing.xs)
        + layout.floatingTabBar.bottomGap
        + layout.floatingTabBar.height
        + layout.floatingTabBar.contentGap } });
  }, [colors, insets.bottom]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={[styles.screen, styles.readable]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandLine}>{t('ui.brandTrainingLog')}</Text>
            <Text style={styles.title}>{t('workout.title')}</Text>
          </View>
          <View style={styles.headerBtnCol}>
            <PressableScale
              onPress={handleStart}
              style={[
                styles.primaryCTA,
                activeWorkout && styles.primaryCTAHot,
              ]}
              accessibilityRole="button"
              accessibilityLabel={activeWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
            >
              <View style={[
                styles.ctaIconTray,
                activeWorkout && styles.ctaIconTrayActive,
              ]}>
                <Icon
                  name={activeWorkout ? 'lightning-bolt' : 'plus'}
                  size={14}
                  color={colors.textInverse}
                />
              </View>
              <Text style={styles.ctaText}>
                {activeWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
              </Text>
            </PressableScale>
            <PressableScale onPress={openTemplates} style={styles.openTemplatesBtn} accessibilityRole="button" accessibilityLabel={t('a11y.openTemplates')}>
              <Icon name="clipboard-list-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.openTemplatesBtnText} numberOfLines={1}>
                {t('templates.title')}
              </Text>
            </PressableScale>
          </View>
        </View>

        {/* ACTIVE WORKOUT CARD — uses stable handleOpenActive so the
            PressableScale prop doesn't churn re-renders every tick. */}
        {activeWorkout && (
          <PressableScale
            onPress={handleOpenActive}
            style={styles.activeCard}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openActiveSession')}
          >
            <View style={styles.activeAccent} />
            <View style={styles.activeBody}>
              <View style={styles.activeRow}>
                <View style={styles.activeBadge}>
                  <View style={styles.activePulse} />
                  <Text style={styles.activeBadgeText}>{t('workout.titleActive')}</Text>
                </View>
                <Text style={styles.activeName} numberOfLines={1}>
                  {activeWorkout.name}
                </Text>
              </View>
              <View style={styles.gapSm} />
              <Text style={styles.activeMeta}>
                {t('workout.activeCardMeta', {
                  count: Array.isArray(activeWorkout.exercises)
                    ? activeWorkout.exercises.filter(Boolean).length
                    : 0 })}
              </Text>
            </View>
            <View style={styles.activeChevron}>
              <Icon name="chevron-right" size={18} color={colors.accent} />
            </View>
          </PressableScale>
        )}

        {/* STATS STRIP */}
        <View style={styles.statsStrip}>
          <MiniStat
            label={t('compact.headerStreak')}
            value={`${streak}`}
            unit={t('workout.unitDays')}
            icon="fire"
            iconColor={colors.accent}
          />
          <MiniStat
            label={t('compact.headerWorkouts')}
            value={`${total}`}
            unit={t('workout.unitTimes')}
            icon="dumbbell"
            iconColor={colors.primary}
          />
          <MiniStat
            label={t('compact.headerVolume')}
            value={volume >= 1000 ? (volume / 1000).toFixed(1) + 'k' : String(Math.round(volume))}
            unit={units}
            icon="weight-kilogram"
            iconColor={colors.info}
          />
        </View>

        {/* PRESET TEMPLATES SWIPER (v1.1.0 MVP) */}
        <View style={styles.tplSectionHead}>
          <Text style={styles.tplSectionTitle}>{t('profile.sectionTemplates')}</Text>
          <Text style={styles.tplSectionCount}>
            {t('workout.sessionCount', { n: presetTemplates.length })}
          </Text>
        </View>
        <View style={styles.tplSwiperWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tplSwiperContent}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={240 + spacing.md}
            disableIntervalMomentum={Platform.OS !== 'web'}
          >
            {presetTemplates.map((tpl, idx) => {
              const levelColor =
                tpl.level === 'beginner' ? colors.info :
                tpl.level === 'intermediate' ? colors.primary : colors.accent;
              const goalLabel =
                t('workout.goal' + tpl.goal.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(''));
              const levelLabel =
                t('workout.level' + tpl.level.charAt(0).toUpperCase() + tpl.level.slice(1));
              return (
                <PressableScale
                  key={tpl.id}
                  onPress={() => handleStartFromTemplate(tpl.id)}
                  style={styles.tplCard}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={tpl.name[effectiveLang]}
                >
                  <View style={[styles.tplLevelStripe, { backgroundColor: levelColor }]} />
                  <Text style={styles.tplTitle} numberOfLines={1}>
                    {`0${idx + 1}  ${tpl.name[effectiveLang]}`}
                  </Text>
                  <Text style={styles.tplDesc} numberOfLines={2}>
                    {tpl.description[effectiveLang]}
                  </Text>
                  <View style={styles.tplBadgeRow}>
                    <View style={styles.tplBadge}>
                      <Text style={styles.tplBadgeText}>{levelLabel}</Text>
                    </View>
                    <View style={styles.tplBadge}>
                      <Text style={styles.tplBadgeText}>{goalLabel}</Text>
                    </View>
                    <View style={styles.tplBadge}>
                      <Text style={styles.tplBadgeText}>
                        {t('workout.perWeek', { n: tpl.daysPerWeek })}
                      </Text>
                    </View>
                    <View style={styles.tplBadge}>
                      <Text style={styles.tplBadgeText}>
                        {t('workout.minPerSession', { n: tpl.durationMinPerSession })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.tplStartBtn}>
                    <Icon name="play" size={12} color={colors.textInverse} />
                    <Text style={styles.tplStartText}>
                      {t('templates.start')}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>

        {/* 7-DAY BARS */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeaderRow}>
            <Text style={styles.weekTitle}>{t('workout.historyTitle')} · 7 {t('workout.unitDays')}</Text>
            <Icon name="chart-bar" size={16} color={colors.textTertiary} />
          </View>
          <View style={styles.barRow}>
            {last7Days.map((count, i) => {
              const h = 12 + (count / maxBar) * 60;
              const isToday = i === 6;
              const fillColor =
                count > 0
                  ? isToday
                    ? colors.primary
                    : colors.accent
                  : colors.surfaceElevated;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: h,
                          backgroundColor: fillColor },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isToday && { color: colors.primary },
                    ]}
                  >
                    {dayLabels[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* HISTORY LIST */}
        <SlabDivider accent={colors.primary} />
        <View style={styles.historyHeader}>
          <SectionHeader
            title={t('workout.historyTitle')}
            icon="clipboard-text-clock-outline"
            accent={colors.primary}
            note={`${workouts.length} ${t('workout.unitTimes')} · ${t('compact.historyEmptyNote')}`}
            inline
          />
        </View>

        {/* =================== Weekly Volume SVG Bar Chart =================== */}
        {(() => {
          const CHART_W = 1000;
          const CHART_H = 160;
          const padL = 24;
          const padR = 24;
          const padT = 16;
          const padB = 40;
          const innerW = CHART_W - padL - padR;
          const innerH = CHART_H - padT - padB;
          const barWidth = Math.max(8, (innerW - 24) / 7 - 4);
          const totalSpan = barWidth * 7 + 4 * 6; // 7 bars + 6 gaps
          const startX = padL + (innerW - totalSpan) / 2;
          const baseY = padT + innerH; // baseline Y (bottom of bars)
          const gridYs = [
            padT,
            padT + innerH * 0.5,
            baseY,
          ];
          const hasVolume = maxVol7 > 0;
          const unitLabel = units;
          return (
            <View style={styles.volCard}>
              <View style={styles.volHeaderRow}>
                <View style={styles.volTitleCol}>
                  <Text style={styles.volTitle} numberOfLines={1}>
                    {t('stats.weeklyVolume', { defaultValue: 'Weekly Volume' })}
                  </Text>
                  <Text style={styles.volSubtitle} numberOfLines={1}>
                    {t('stats.weeklyVolSub', {
                      units: unitLabel,
                      defaultValue: `Last 7 days · total ${totalVol7} ${unitLabel}` })}
                  </Text>
                </View>
                <Icon name="chart-bar" size={18} color={colors.textTertiary} />
              </View>
              {!hasVolume ? (
                <View style={styles.volEmpty}>
                  <Icon name="chart-line" size={26} color={colors.textTertiary} />
                  <Text style={[styles.volEmptyText, { marginTop: spacing.sm }]}>
                    {t('stats.emptyBar', {
                      defaultValue:
                        'Complete your first set to visualize weekly volume trends.' })}
                  </Text>
                </View>
              ) : (
                <Svg
                  width="100%"
                  height={CHART_H}
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  preserveAspectRatio="none"
                >
                  {/* 3 horizontal grid baselines (dashed) */}
                  {gridYs.map((gy, gi) => (
                    <Line
                      key={`g${gi}`}
                      x1={padL}
                      y1={gy}
                      x2={CHART_W - padR}
                      y2={gy}
                      stroke={colors.surfaceBorder}
                      strokeWidth={1.5}
                      strokeDasharray="3,3"
                    />
                  ))}
                  {/* Bars */}
                  {weeklyVol.map((vol, i) => {
                    const ratio = maxVol7 === 0 ? 0 : vol / maxVol7;
                    const barH = innerH * ratio;
                    const x = startX + i * (barWidth + 4);
                    const y = baseY - barH;
                    const isToday = i === 6;
                    const fill = isToday
                      ? colors.primary
                      : (colors.info ?? colors.primary) + '99';
                    const labelX = x + barWidth / 2;
                    return (
                      <React.Fragment key={`bar${i}`}>
                        <Rect
                          x={x}
                          y={barH <= 0 ? baseY - 1 : y}
                          width={barWidth}
                          height={barH <= 0 ? 1 : barH}
                          rx={barWidth * 0.2}
                          ry={barWidth * 0.2}
                          fill={fill}
                        />
                        <SvgText
                          x={labelX}
                          y={CHART_H - 12}
                          textAnchor="middle"
                          fontSize={22}
                          fontWeight="700"
                          fill={isToday ? colors.primary : colors.textTertiary}
                        >
                          {dayLabels[i]}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}
                </Svg>
              )}
            </View>
          );
        })()}

        {workouts.length === 0 ? (
          <View>
            <Skeleton height={110} width="100%" borderRadius={16} />
            <View style={{ height: spacing.md }} />
            <Skeleton height={110} width="100%" borderRadius={16} />
            <View style={{ height: spacing.lg }} />
            <EmptyState
              icon="weight-lifter"
              title={t('workout.historyEmpty')}
              desc={t('workout.historyEmptyDesc')}
              actionLabel={t('home.startWorkout')}
              onAction={handleStart}
            />
          </View>
        ) : (
          workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              session={w}
              exMap={exMap}
              units={units}
              onDelete={() => handleDelete(w.id)}
            />
          ))
        )}

        <View style={styles.bottomInset} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Sub components
// ============================================================

function WorkoutCard({
  session,
  exMap,
  units,
  onDelete }: {
  session: WorkoutSession;
  exMap: Map<string, any>;
  units: 'kg' | 'lb';
  onDelete: () => void;
}) {
  // i18n for nested card — intentionally NOT hoisted so translated labels
  // react to language toggle without a screen-level re-render boundary.
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Localized date formatting (not a module-level helper anymore because
  // the ZH/EN date pattern comes from i18n — ZH is "{{month}}月{{day}}日"
  // and EN is "{{month}}/{{day}}"; hardcoded CJK punctuation used to leak
  // into the EN UI making cards look half-translated).
  const d = new Date(session.date);
  const date = t('workout.dateMonthDay', { month: d.getMonth() + 1, day: d.getDate() });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // 深度防御（闪退修复）：历史 session 的 exercises / sets 可能缺失或非数组
  // （旧 vault 迁移、部分写入）。原实现直接 reduce + `.sets.length` / `.filter`
  // 会在渲染 WorkoutCard 时抛 undefined → 整个历史列表白屏/闪退。
  const safeSessionExercises = useMemo(
    () => (Array.isArray(session.exercises) ? session.exercises.filter(Boolean) : []),
    [session.exercises]
  );
  const totalSets = useMemo(
    () =>
      safeSessionExercises.reduce(
        (acc, e) => acc + (Array.isArray(e?.sets) ? e.sets.filter(Boolean).length : 0),
        0
      ),
    [safeSessionExercises]
  );
  const completedSets = useMemo(
    () =>
      safeSessionExercises.reduce(
        (acc, e) =>
          acc +
          (Array.isArray(e?.sets)
            ? e.sets.filter((s) => s && s.completed).length
            : 0),
        0
      ),
    [safeSessionExercises]
  );
  const volume = useMemo(
    () =>
      safeSessionExercises.reduce((acc, e) => {
        if (!Array.isArray(e?.sets)) return acc;
        return (
          acc +
          e.sets
            .filter((s) => s && s.completed)
            .reduce((a, s) => a + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
        );
      }, 0),
    [safeSessionExercises]
  );

  const previewExercises = useMemo(
    () => safeSessionExercises.slice(0, 4),
    [safeSessionExercises]
  );

  const cardStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      padding: spacing.lg,
      marginBottom: spacing.md },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm },
    dateCol: {
      flex: 1 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs },
    date: {
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
      lineHeight: 22,
      color: colors.textPrimary },
    time: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18 },
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.danger + '14',
      borderWidth: 1,
      borderColor: colors.danger + '30',
      alignItems: 'center',
      justifyContent: 'center' },
    sessionName: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.md,
      letterSpacing: -0.1 },
    statRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.surfaceDivider },
    statCol: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs },
    statIconTray: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center' },
    statValue: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1 },
    statLabel: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' },
    previewRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      flexWrap: 'wrap' },
    previewItem: {
      alignItems: 'center',
      width: 58,
      gap: spacing.xs },
    previewImgWrap: {
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden' },
    previewImg: {
      width: 54,
      height: 54,
      backgroundColor: colors.surfaceElevated },
    previewSets: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.2 },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceDivider },
    note: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 19 } }), [colors]);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <View style={cardStyles.dateCol}>
          <View style={cardStyles.dateRow}>
            <Icon name="calendar-today" size={13} color={colors.textTertiary} />
            <Text style={cardStyles.date}>{date}</Text>
          </View>
          <Text style={cardStyles.time}>
            <Icon name="clock-outline" size={11} color={colors.textTertiary} />{' '}
            {time} · {formatDurationHuman(session.duration)}
          </Text>
        </View>
        <PressableScale
          onPress={onDelete}
          style={cardStyles.deleteBtn}
          hitSlop={8}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.deleteSession')}
        >
          <Icon name="trash-can-outline" size={14} color={colors.danger} />
        </PressableScale>
      </View>

      {session.name ? (
        <Text style={cardStyles.sessionName} numberOfLines={1}>
          <Icon name="tag-outline" size={12} color={colors.primary} /> {session.name}
        </Text>
      ) : null}

      <View style={cardStyles.statRow}>
        <Stat
          label={t('compact.headerVolume')}
          value={`${Math.round(volume)} ${units}`}
          icon="weight-kilogram"
          color={colors.primary}
        />
        <Stat
          label={t('compact.headerDone')}
          value={`${completedSets}/${totalSets} ${t('compact.unitSets')}`}
          icon="check-circle-outline"
          color={colors.success}
        />
        <Stat
          label={t('compact.headerOverview')}
          value={`${safeSessionExercises.length} ${t('compact.exercises')}`}
          icon="format-list-numbered"
          color={colors.info}
        />
      </View>

      <View style={cardStyles.previewRow}>
        {previewExercises.map((e, pi) => {
          const ex = exMap.get(String(e.exerciseId));
          const color = ex ? muscleColor(colors, ex.body_part) : colors.primary;
          const setCount = Array.isArray(e?.sets) ? e.sets.filter(Boolean).length : 0;
          return (
            <View key={`${String(e.exerciseId)}-${pi}`} style={cardStyles.previewItem}>
              <HybridImage
                uri={ex ? getImageUrl(ex.image) : undefined}
                tint={color}
                iconName={ex ? iconForBodyPart(ex.body_part) : 'dumbbell'}
                fallbackBodyPart={ex?.body_part}
                fallbackTint={color}
                style={[
                  cardStyles.previewImg,
                  cardStyles.previewImgWrap,
                  { borderColor: color + '66' },
                ]}
                iconRatio={0.45}
              />
              <Text style={cardStyles.previewSets}>{setCount}{t('compact.setsHeader')}</Text>
            </View>
          );
        })}
      </View>

      {session.note ? (
        <View style={cardStyles.noteRow}>
          <Icon name="note-text-outline" size={12} color={colors.textTertiary} />
          <Text style={cardStyles.note} numberOfLines={2}>
            {' '}
            {session.note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  icon,
  color }: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  const colors = useThemeColors();
  const s = useMemo(() => StyleSheet.create({
    col: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs },
    iconTray: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center' },
    value: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -0.1 },
    label: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' } }), [colors]);
  return (
    <View style={s.col}>
      <View style={[s.iconTray, { backgroundColor: color + '18' }]}>
        <Icon name={icon} size={12} color={color} />
      </View>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

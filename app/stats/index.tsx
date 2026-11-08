import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { BodyPart } from '@/types';
import { useThemeColors, spacing, radius, typography, muscleColor } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { getAllExercisesSync } from '@/data/queries';
import { labelForBodyPart } from '@/constants';
import { Icon, MiniStat, EmptyState, SectionHeader } from '@/components/UIKit';
import { formatDurationHuman, dateShort } from '@/utils/format';
import {
  computeOverview,
  recentDailyVolumes,
  heatmapLevels,
  muscleSetStats,
  toDateKey,
} from '@/utils/analytics';
import { formatVolumeShort, formatDurationParts, displayWeight } from '@/utils/strength';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

// ============================================================================
// 数据面板 —— 纯本地统计，无联网 / 无社区 / 无商业化内容。
//
// 所有派生数字都来自 src/utils/analytics.ts，与首页 / 训练页 / 我的共用同一套
// 口径。此前「总容量 / 连续天数」在三处各算一遍并互相漂移（Profile 有「昨天
// 宽限」、Workout 没有），这里刻意不重复实现任何聚合逻辑。
// ============================================================================

const TAB_BAR_CONTENT_HEIGHT = 56;

/** 热力图：13 周 × 7 天 ≈ 一个季度 */
const HEATMAP_DAYS = 91;
const HEATMAP_WEEKS = 13;
const TREND_DAYS = 30;

/** 容量按分档的透明度（level 1~4 逐步加深） */
const HEAT_ALPHA: Record<number, string> = { 1: '33', 2: '59', 3: '8C', 4: 'CC' };

// ---------------------------------------------------------------------------
// 近 30 天容量柱状图
// ---------------------------------------------------------------------------

interface TrendChartProps {
  data: { date: string; volume: number }[];
  max: number;
  colorEmpty: string;
  colorBar: string;
  axisColor: string;
  width: number;
}

function VolumeTrend({ data, max, colorEmpty, colorBar, axisColor, width }: TrendChartProps) {
  const H = 132;
  const PAD_B = 20;
  const innerW = Math.max(1, width - 8);
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.62);
  const usableH = H - PAD_B;

  return (
    <Svg width={width} height={H}>
      <Line x1={0} y1={usableH} x2={innerW} y2={usableH} stroke={axisColor} strokeWidth={1} />
      {data.map((d, i) => {
        const ratio = max > 0 ? d.volume / max : 0;
        // 有训练但极小的柱子也要留 2px 可见高度，否则看起来像没练
        const h = d.volume > 0 ? Math.max(2, ratio * usableH) : 0;
        const x = i * slot + (slot - barW) / 2;
        return (
          <Rect
            key={d.date}
            x={x}
            y={usableH - h}
            width={barW}
            height={h}
            rx={Math.min(2, barW / 2)}
            fill={d.volume > 0 ? colorBar : colorEmpty}
          />
        );
      })}
      {data.length > 1 ? (
        <>
          <SvgText x={2} y={H - 5} fill={axisColor} fontSize={9}>
            {dateShort(data[0]?.date)}
          </SvgText>
          <SvgText x={innerW - 32} y={H - 5} fill={axisColor} fontSize={9}>
            {dateShort(data[data.length - 1]?.date)}
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// 训练日历热力图
// ---------------------------------------------------------------------------

interface HeatmapProps {
  cells: { date: string; volume: number; level: 0 | 1 | 2 | 3 | 4 }[];
  base: string;
  tint: string;
  cellSize: number;
  gap: number;
}

function TrainingHeatmap({ cells, base, tint, cellSize, gap }: HeatmapProps) {
  // 列 = 周，行 = 星期。第一列必须按首日是星期几做偏移，
  // 否则每周的格子会整体错位（周一跑到周三的位置上）。
  const columns = useMemo(() => {
    const cols: ({ date: string; level: number } | null)[][] = [];
    if (cells.length === 0) return cols;

    const first = cells[0].date;
    const d = new Date(
      Number(first.slice(0, 4)),
      Number(first.slice(5, 7)) - 1,
      Number(first.slice(8, 10))
    );
    // getDay() 是 0=周日，转成「周一起算」的 0..6
    const lead = (d.getDay() + 6) % 7;

    let idx = 0;
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: ({ date: string; level: number } | null)[] = [];
      for (let r = 0; r < 7; r++) {
        if (w === 0 && r < lead) {
          col.push(null);
          continue;
        }
        const cell = cells[idx];
        idx += 1;
        col.push(cell ? { date: cell.date, level: cell.level } : null);
      }
      cols.push(col);
    }
    return cols;
  }, [cells]);

  return (
    <View style={{ flexDirection: 'row', gap }}>
      {columns.map((col, ci) => (
        <View key={ci} style={{ flexDirection: 'column', gap }}>
          {col.map((cell, ri) => (
            <View
              key={ri}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: Math.max(2, cellSize * 0.22),
                backgroundColor: !cell
                  ? 'transparent'
                  : cell.level <= 0
                    ? base
                    : tint + (HEAT_ALPHA[cell.level] ?? 'CC'),
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

export default function StatsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();

  const workouts = useAppStore((s) => s.workouts);
  const settings = useAppStore((s) => s.settings);
  const prRecords = useAppStore((s) => s.prRecords);
  const customExercises = useAppStore((s) => s.customExercises);
  const listRecentPRs = useAppStore((s) => s.listRecentPRs);
  const weeklyProgressFn = useAppStore((s) => s.weeklyProgress);

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';
  const units = settings.units;

  /** 容量展示换算：内部一律 kg，展示层再转用户设置 */
  const toDisplay = (kg: number) => displayWeight(kg, units);

  /**
   * 动作 id → 显示名 / 所属部位 的联合索引（数据集 + 用户自建）。
   *
   * 之前「显示名」和「肌群分布」各自建了一张 1300+ 条的全量 Map，两处逻辑重复
   * 且遍历了两遍。合成一次遍历后，PR 墙与肌群分布共用同一份索引。
   */
  const exerciseIndex = useMemo(() => {
    const names = new Map<string, string>();
    const parts = new Map<string, BodyPart | null>();
    for (const e of getAllExercisesSync()) {
      const id = String(e.id);
      const zh = e.name_zh && /[一-龥]/.test(e.name_zh) ? e.name_zh : e.name;
      names.set(id, effectiveLang === 'zh' ? zh : e.name);
      parts.set(id, e.body_part ?? null);
    }
    for (const c of customExercises ?? []) {
      const id = String(c.id);
      names.set(id, effectiveLang === 'zh' ? c.name_zh || c.name : c.name);
      parts.set(id, c.body_part ?? null);
    }
    return { names, parts };
  }, [effectiveLang, customExercises]);

  const opts = useMemo(
    () => ({ countOnlyWorkingSets: settings.countOnlyWorkingSets }),
    [settings.countOnlyWorkingSets]
  );

  const overview = useMemo(
    () => computeOverview({ sessions: workouts, weeklyGoal: settings.weeklyGoal, opts }),
    [workouts, settings.weeklyGoal, opts]
  );

  const trend = useMemo(
    () => recentDailyVolumes(workouts, TREND_DAYS, toDateKey(new Date()), opts),
    [workouts, opts]
  );
  const trendMax = useMemo(() => Math.max(1, ...trend.map((d) => d.volume)), [trend]);
  const trendTotal = useMemo(() => trend.reduce((a, b) => a + b.volume, 0), [trend]);

  const heat = useMemo(
    () => heatmapLevels(workouts, HEATMAP_DAYS, toDateKey(new Date()), opts),
    [workouts, opts]
  );

  const muscles = useMemo(
    () =>
      muscleSetStats(
        workouts,
        (id) => exerciseIndex.parts.get(String(id)) ?? null,
        30,
        toDateKey(new Date()),
        opts
      ),
    [workouts, opts, exerciseIndex]
  );

  const progress = useMemo(
    () => weeklyProgressFn(),
    [weeklyProgressFn, workouts, settings.weeklyGoal]
  );
  const recentPRs = useMemo(() => listRecentPRs(8), [listRecentPRs, prRecords]);
  const muscleMax = useMemo(() => Math.max(1, ...muscles.map((m) => m.sets)), [muscles]);

  const hasData = workouts.length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        scroll: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + spacing.xl,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        },
        statRow: { flexDirection: 'row', alignItems: 'center' },
        goalHead: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        },
        goalValue: { ...typography.h2, color: colors.textPrimary },
        goalSub: { ...typography.caption, color: colors.textSecondary },
        track: {
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.surfaceElevated,
          overflow: 'hidden',
        },
        fill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
        trendMeta: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        trendValue: { ...typography.h2, color: colors.textPrimary },
        delta: { ...typography.caption, fontWeight: '700' },
        heatLegend: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          marginTop: spacing.sm,
        },
        legendCell: { width: 10, height: 10, borderRadius: 3 },
        legendText: {
          ...typography.caption,
          color: colors.textTertiary,
          marginHorizontal: spacing.xs,
        },
        muscleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        muscleName: { width: 62, ...typography.caption, color: colors.textSecondary },
        muscleTrack: {
          flex: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.surfaceElevated,
          overflow: 'hidden',
        },
        muscleCount: {
          width: 40,
          textAlign: 'right',
          ...typography.caption,
          color: colors.textPrimary,
          fontWeight: '700',
        },
        prRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.surfaceDivider,
          gap: spacing.sm,
        },
        prIndex: {
          width: 18,
          ...typography.caption,
          color: colors.textTertiary,
          fontWeight: '800',
        },
        prName: { flex: 1, ...typography.body, color: colors.textPrimary },
        prValue: { ...typography.body, fontWeight: '800', color: colors.primary },
        prDate: { ...typography.caption, color: colors.textTertiary },
        hint: {
          ...typography.caption,
          color: colors.textTertiary,
          marginTop: spacing.xs,
        },
      }),
    [colors, insets.bottom, typography]
  );

  const heatCellSize = Math.max(
    10,
    Math.floor((width - spacing.lg * 2 - (HEATMAP_WEEKS - 1) * 3) / HEATMAP_WEEKS)
  );

  const deltaText =
    overview.volumeDeltaPct === null
      ? null
      : `${overview.volumeDeltaPct > 0 ? '+' : ''}${overview.volumeDeltaPct}%`;
  const deltaColor =
    overview.volumeDeltaPct === null
      ? colors.textTertiary
      : overview.volumeDeltaPct >= 0
        ? colors.success
        : colors.danger;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{ headerTitle: t('statsPage.title', { defaultValue: '数据面板' }) }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {!hasData ? (
          <EmptyState
            icon="chart-bar"
            title={t('statsPage.emptyTitle', { defaultValue: '还没有训练数据' })}
            desc={t('statsPage.emptyDesc', {
              defaultValue: '完成第一次训练后，这里会显示容量趋势、训练日历与肌群分布。',
            })}
          />
        ) : (
          <>
            {/* ===== 01 · 总览 ===== */}
            <View style={styles.card}>
              <SectionHeader
                title={t('statsPage.overview', { defaultValue: '总览' })}
                icon="chart-areaspline"
              />
              <View style={styles.statRow}>
                <MiniStat
                  label={t('statsPage.totalSessions', { defaultValue: '总训练' })}
                  value={String(overview.totalSessions)}
                  unit={t('workout.heroUnitWorkouts', { defaultValue: '次' })}
                  icon="calendar-check"
                  iconColor={colors.primary}
                />
                <MiniStat
                  label={t('statsPage.totalVolume', { defaultValue: '总容量' })}
                  value={formatVolumeShort(toDisplay(overview.totalVolume))}
                  unit={units}
                  icon="weight-lifter"
                  iconColor={colors.accent}
                />
                <MiniStat
                  label={t('statsPage.totalSets', { defaultValue: '总组数' })}
                  value={String(overview.totalSets)}
                  unit={t('statsPage.unitSets', { defaultValue: '组' })}
                  icon="dumbbell"
                  iconColor={colors.info}
                />
                <MiniStat
                  label={t('statsPage.avgDuration', { defaultValue: '平均时长' })}
                  value={formatDurationParts(overview.avgSessionSec)}
                  icon="timer-outline"
                  iconColor={colors.success}
                />
              </View>
              <Text style={styles.hint}>
                {t('statsPage.totalTime', { defaultValue: '累计训练时长' })} ·{' '}
                {formatDurationHuman(overview.totalDurationSec)}
              </Text>
            </View>

            {/* ===== 02 · 本周目标 & 连续纪录 ===== */}
            <View style={styles.card}>
              <SectionHeader
                title={t('statsPage.weekGoal', { defaultValue: '本周目标' })}
                icon="target"
              />
              {progress.goal > 0 ? (
                <>
                  <View style={styles.goalHead}>
                    <Text style={styles.goalValue}>
                      {progress.done}
                      <Text style={styles.goalSub}> / {progress.goal}</Text>
                    </Text>
                    <Text style={styles.goalSub}>
                      {progress.done >= progress.goal
                        ? t('statsPage.goalReached', { defaultValue: '已达成' })
                        : t('statsPage.goalRemaining', {
                            defaultValue: '还差 {{n}} 次',
                            n: progress.goal - progress.done,
                          })}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%` }]} />
                  </View>
                </>
              ) : (
                <Text style={styles.goalSub}>
                  {t('statsPage.noGoal', { defaultValue: '未设置每周目标，可在「我的」中设置。' })}
                </Text>
              )}

              <View style={[styles.statRow, { marginTop: spacing.lg }]}>
                <MiniStat
                  label={t('statsPage.currentStreak', { defaultValue: '当前连续' })}
                  value={String(overview.currentStreak)}
                  unit={t('workout.heroUnitStreak', { defaultValue: '天' })}
                  icon="fire"
                  iconColor={colors.accent}
                />
                <MiniStat
                  label={t('statsPage.longestStreak', { defaultValue: '最长连续' })}
                  value={String(overview.longestStreak)}
                  unit={t('workout.heroUnitStreak', { defaultValue: '天' })}
                  icon="trophy-outline"
                  iconColor={colors.warning}
                />
                <MiniStat
                  label={t('statsPage.activeDays', { defaultValue: '近 30 天活跃' })}
                  value={String(overview.activeDays30)}
                  unit={t('workout.heroUnitStreak', { defaultValue: '天' })}
                  icon="calendar-month"
                  iconColor={colors.info}
                />
              </View>
            </View>

            {/* ===== 03 · 容量趋势 ===== */}
            <View style={styles.card}>
              <SectionHeader
                title={t('statsPage.volumeTrend', { defaultValue: '容量趋势' })}
                icon="chart-bar"
                note={t('statsPage.trendNote', {
                  defaultValue: '近 30 天 · 单位 {{units}}',
                  units,
                })}
              />
              <View style={styles.trendMeta}>
                <Text style={styles.trendValue}>
                  {formatVolumeShort(toDisplay(trendTotal))}
                  <Text style={styles.goalSub}> {units}</Text>
                </Text>
                {deltaText ? (
                  <Text style={[styles.delta, { color: deltaColor }]}>
                    {deltaText} {t('statsPage.vsLastWeek', { defaultValue: '较上周' })}
                  </Text>
                ) : null}
              </View>
              <VolumeTrend
                data={trend}
                max={trendMax}
                colorEmpty={colors.surfaceElevated}
                colorBar={colors.primary}
                axisColor={colors.textTertiary}
                width={width - spacing.lg * 4}
              />
            </View>

            {/* ===== 04 · 训练日历 ===== */}
            <View style={styles.card}>
              <SectionHeader
                title={t('statsPage.calendar', { defaultValue: '训练日历' })}
                icon="calendar-outline"
                note={t('statsPage.calendarNote', { defaultValue: '近 13 周' })}
              />
              <TrainingHeatmap
                cells={heat}
                base={colors.surfaceElevated}
                tint={colors.primary}
                cellSize={heatCellSize}
                gap={3}
              />
              <View style={styles.heatLegend}>
                <Text style={styles.legendText}>
                  {t('statsPage.less', { defaultValue: '少' })}
                </Text>
                {[0, 1, 2, 3, 4].map((lv) => (
                  <View
                    key={lv}
                    style={[
                      styles.legendCell,
                      {
                        backgroundColor:
                          lv === 0 ? colors.surfaceElevated : colors.primary + HEAT_ALPHA[lv],
                      },
                    ]}
                  />
                ))}
                <Text style={styles.legendText}>
                  {t('statsPage.more', { defaultValue: '多' })}
                </Text>
              </View>
            </View>

            {/* ===== 05 · 肌群分布 ===== */}
            {muscles.length > 0 ? (
              <View style={styles.card}>
                <SectionHeader
                  title={t('statsPage.muscleSplit', { defaultValue: '肌群分布' })}
                  icon="human-male-board-poll"
                  note={t('statsPage.muscleNote', { defaultValue: '近 30 天 · 按组数' })}
                />
                {muscles.slice(0, 10).map((m) => (
                  <View key={m.bodyPart} style={styles.muscleRow}>
                    <Text style={styles.muscleName} numberOfLines={1}>
                      {labelForBodyPart(m.bodyPart, effectiveLang === 'zh' ? 'zh' : 'en')}
                    </Text>
                    <View style={styles.muscleTrack}>
                      <View
                        style={{
                          width: `${Math.max(4, Math.round((m.sets / muscleMax) * 100))}%`,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: muscleColor(colors, m.bodyPart),
                        }}
                      />
                    </View>
                    <Text style={styles.muscleCount}>{m.sets}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ===== 06 · PR 墙 ===== */}
            {recentPRs.length > 0 ? (
              <View style={styles.card}>
                <SectionHeader
                  title={t('statsPage.prWall', { defaultValue: '个人记录' })}
                  icon="trophy-outline"
                  note={t('statsPage.prNote', { defaultValue: '按达成时间排序' })}
                />
                {recentPRs.map((pr, i) => (
                  <View key={pr.id} style={styles.prRow}>
                    <Text style={styles.prIndex}>{i + 1}</Text>
                    <Icon name="dumbbell" size={16} color={colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prName} numberOfLines={1}>
                        {exerciseIndex.names.get(String(pr.exerciseId)) ?? String(pr.exerciseId)}
                      </Text>
                      <Text style={styles.prDate}>{pr.date}</Text>
                    </View>
                    <Text style={styles.prValue}>
                      {displayWeight(pr.weight, units)}
                      <Text style={styles.goalSub}>
                        {' '}
                        {units} × {pr.reps}
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* 口径说明 —— 让用户知道为什么热身组不进总量 */}
            <Text style={styles.hint}>
              {settings.countOnlyWorkingSets
                ? t('statsPage.volumeRuleWorking', {
                    defaultValue: '总容量只统计正式组，热身组不计入（可在「我的」中修改）。',
                  })
                : t('statsPage.volumeRuleAll', {
                    defaultValue: '总容量含热身组（可在「我的」中改为只统计正式组）。',
                  })}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

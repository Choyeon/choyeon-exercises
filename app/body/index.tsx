import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useThemeColors,
  spacing,
  radius,
  typography,
  strokeFromColors,
  getSoftShadow,
  darkColors,
} from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { safeHaptic } from '@/utils/haptic';
import {
  Icon,
  PressableScale,
  EmptyState,
  SectionHeader,
} from '@/components/UIKit';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import type { BodyMetricKey, BodyProfileEntry } from '@/types';

// ============================================================================
// Constants + helpers
// ============================================================================

type ScopeKey = '7' | '30' | 'all';

const TAB_BAR_CONTENT_HEIGHT = 56;

const METRIC_KEYS: BodyMetricKey[] = [
  'weight',
  'bodyFat',
  'bmi',
  'height',
  'neck',
  'chest',
  'waist',
  'hip',
  'upperArmLeft',
  'upperArmRight',
  'thighLeft',
  'thighRight',
  'calfLeft',
  'calfRight',
];

/**
 * Maps a BodyMetricKey (camelCase, e.g. upperArmLeft) to the ZH/EN
 * translation keys (e.g. metricUpperArmL / unitKg).  The i18n source
 * uses compact L/R/L/R suffixes rather than Left/Right words, so
 * upperFirst(key) alone is insufficient — explicit mapping keeps the
 * coupling visible and typed.
 */
const METRIC_LABEL_KEY: Record<BodyMetricKey, string> = {
  weight: 'metricWeight',
  bodyFat: 'metricBodyFat',
  bmi: 'metricBMI',
  height: 'metricHeight',
  neck: 'metricNeck',
  chest: 'metricChest',
  waist: 'metricWaist',
  hip: 'metricHip',
  upperArmLeft: 'metricUpperArmL',
  upperArmRight: 'metricUpperArmR',
  thighLeft: 'metricThighL',
  thighRight: 'metricThighR',
  calfLeft: 'metricCalfL',
  calfRight: 'metricCalfR',
};

/**
 * Unit mapping — the i18n keys use *dimension* level (cm / kg / lb / %)
 * rather than per-metric unitWeight / unitHeight etc.  We map each key
 * to the correct dimension key.
 */
const METRIC_UNIT_KEY: Record<BodyMetricKey, string> = {
  weight: 'unitKg',
  bodyFat: 'unitPercent',
  bmi: 'unitPercent',
  height: 'unitCm',
  neck: 'unitCm',
  chest: 'unitCm',
  waist: 'unitCm',
  hip: 'unitCm',
  upperArmLeft: 'unitCm',
  upperArmRight: 'unitCm',
  thighLeft: 'unitCm',
  thighRight: 'unitCm',
  calfLeft: 'unitCm',
  calfRight: 'unitCm',
};

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function parseDate(s: string): number {
  const [y, m, d] = s.split('-').map((v) => parseInt(v, 10));
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function fmtNumber(n: number | undefined | null, digits = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '-';
  const pow = Math.pow(10, digits);
  return (Math.round(n * pow) / pow).toString();
}

// ============================================================================
// Metric input row
// ============================================================================

interface MetricRowProps {
  keyName: BodyMetricKey;
  value: string;
  onChange: (v: string) => void;
}

function MetricRow({ keyName, value, onChange }: MetricRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const s = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        label: {
          width: 104,
          ...typography.body,
          color: colors.textPrimary,
        },
        inputWrap: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          height: 40,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        },
        input: {
          flex: 1,
          color: colors.textPrimary,
          fontSize: 15,
          lineHeight: 20,
          fontWeight: '700',
          textAlign: 'right',
          paddingVertical: 0,
          height: 40,
        },
        unit: {
          marginLeft: spacing.sm,
          ...typography.captionBold,
          color: colors.textSecondary,
          minWidth: 32,
          textAlign: 'right',
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.surfaceDivider,
        },
      }),
    [colors]
  );

  return (
    <View>
      <View style={s.row}>
        <Text style={s.label} numberOfLines={1}>
          {t(`body.${METRIC_LABEL_KEY[keyName]}`)}
        </Text>
        <View style={s.inputWrap}>
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            placeholder="–"
            placeholderTextColor={colors.textTertiary}
            style={s.input}
            textAlign="right"
            maxLength={10}
            selectTextOnFocus
          />
        </View>
        <Text style={s.unit}>{t(`body.${METRIC_UNIT_KEY[keyName]}`)}</Text>
      </View>
      <View style={s.divider} />
    </View>
  );
}

// ============================================================================
// History card
// ============================================================================

interface HistoryCardProps {
  entry: BodyProfileEntry;
  prev: BodyProfileEntry | null;
  onDelete: () => void;
}

function HistoryCard({ entry, prev, onDelete }: HistoryCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: spacing.lg,
          marginBottom: spacing.md,
          ...softShadowCompat(colors.bg),
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        dateText: {
          ...typography.bodyBold,
          color: colors.textPrimary,
        },
        metricsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        metricCol: {
          flex: 1,
          alignItems: 'center',
          gap: spacing.xs,
        },
        metricValue: {
          ...typography.h3,
          color: colors.textPrimary,
        },
        metricLabel: {
          ...typography.small,
          color: colors.textTertiary,
          textTransform: 'uppercase',
        },
        deltaWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        deltaText: {
          ...typography.captionBold,
          fontSize: 12,
          lineHeight: 16,
        },
        actionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing.sm,
        },
        delBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.danger + '55',
          backgroundColor: colors.danger + '12',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        delBtnText: {
          ...typography.captionBold,
          color: colors.danger,
        },
      }),
    [colors]
  );

  const highlights: Array<{
    key: BodyMetricKey;
    icon: string;
  }> = [
    { key: 'weight', icon: 'scale-bathroom' },
    { key: 'bodyFat', icon: 'percent' },
    // 'human-male-chest' 不存在于 MaterialCommunityIcons 的 glyphmap。
    // 胸围是「量出来的尺寸」，用卷尺图标比人形更贴合语义。
    { key: 'chest', icon: 'tape-measure' },
  ];

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <Text style={s.dateText}>{entry.date}</Text>
        {entry.note && entry.note.length > 0 ? (
          <Text style={{ ...typography.caption, color: colors.textTertiary, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <View style={s.metricsRow}>
        {highlights.map((h) => {
          const v = entry.metrics?.[h.key];
          const prevVal = prev?.metrics?.[h.key];
          const delta =
            typeof v === 'number' && typeof prevVal === 'number' ? v - prevVal : null;
          let deltaColor = colors.textTertiary;
          let arrow = '';
          if (typeof delta === 'number') {
            if (delta > 0) {
              arrow = '↑';
              deltaColor = colors.accent;
            } else if (delta < 0) {
              arrow = '↓';
              deltaColor = colors.info;
            } else {
              arrow = '•';
            }
          }
          return (
            <View key={h.key} style={s.metricCol}>
              <Icon name={h.icon} size={14} color={colors.textTertiary} />
              <Text style={s.metricValue}>
                {v === undefined ? (
                  <Text style={{ color: colors.textTertiary }}>-</Text>
                ) : (
                  fmtNumber(v)
                )}
              </Text>
              <Text style={s.metricLabel}>{t(`body.${METRIC_LABEL_KEY[h.key]}`)}</Text>
              {typeof delta === 'number' ? (
                <View style={s.deltaWrap}>
                  <Text style={[s.deltaText, { color: deltaColor }]}>
                    {arrow} {delta > 0 ? '+' : ''}
                    {fmtNumber(delta)}
                  </Text>
                </View>
              ) : (
                <View style={{ height: 14 }} />
              )}
            </View>
          );
        })}
      </View>
      <View style={s.actionsRow}>
        <PressableScale onPress={onDelete} style={s.delBtn} scaleTo={0.95} accessibilityRole="button" accessibilityLabel={t('a11y.deleteEntry')}>
          <Icon name="trash-can-outline" size={13} color={colors.danger} />
          <Text style={s.delBtnText}>{t('common.delete')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

// 视觉一致性：旧的 softShadowCompat 硬编码 shadowOpacity 0.12 / elevation 2，
// 且忽略了传入的 bg（dark 模式下阴影过淡）。现统一走 theme 的 getSoftShadow。
function softShadowCompat(bg: string): object {
  return getSoftShadow(bg === darkColors.bg);
}

// ============================================================================
// Trend SVG (polyline + dots) — upgraded to support multi-metric switch
//
// • metricSel = 'multi'  → overlay weight (primary) + bodyFat (accent) lines
// • metricSel = BodyMetricKey → single metric line in primary color, with
//                                min / max labels for the selected metric
// ============================================================================

type MetricSel = 'multi' | BodyMetricKey;

interface TrendChartProps {
  entries: BodyProfileEntry[];
  metricSel: MetricSel;
}

function computeSeries(
  entries: BodyProfileEntry[],
  key: BodyMetricKey,
  CHART_W: number,
  CHART_H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number
): {
  points: string;
  pts: Array<{ x: number; y: number; v: number; date: string }>;
  minV: number;
  maxV: number;
  count: number;
} {
  const sorted = entries
    .slice()
    .filter((e) => typeof e.metrics?.[key] === 'number')
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const N = sorted.length;
  const values = sorted.map((e) => e.metrics?.[key] as number);
  let minV = 0;
  let maxV = 1;
  if (N > 0) {
    minV = Math.min(...values);
    maxV = Math.max(...values);
    if (maxV - minV < 0.0001) maxV = minV + 1;
  }
  const innerW = CHART_W - padL - padR;
  const innerH = CHART_H - padT - padB;
  const pts = sorted.map((e, i) => {
    const v = e.metrics?.[key] ?? 0;
    const x = N <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (N - 1);
    const yNorm = (v - minV) / (maxV - minV);
    const y = padT + innerH - yNorm * innerH;
    return { x, y, v, date: e.date };
  });
  const points = pts.map((p) => `${p.x},${p.y}`).join(' ');
  return { points, pts, minV, maxV, count: N };
}

function TrendChart({ entries, metricSel }: TrendChartProps) {
  const colors = useThemeColors();

  const CHART_W = 1000;
  const CHART_H = 160;
  const padL = 24;
  const padR = 16;
  const padT = 20;
  const padB = 18;

  const seriesData = useMemo(() => {
    if (metricSel === 'multi') {
      const weightS = computeSeries(
        entries,
        'weight',
        CHART_W,
        CHART_H,
        padL,
        padR,
        padT,
        padB
      );
      const fatS = computeSeries(
        entries,
        'bodyFat',
        CHART_W,
        CHART_H,
        padL,
        padR,
        padT,
        padB
      );
      return {
        kind: 'multi' as const,
        weight: weightS,
        fat: fatS,
        // For labels, prefer whichever series has more points (fallback weight)
        label: weightS.count >= fatS.count ? weightS : fatS,
      };
    }
    const single = computeSeries(
      entries,
      metricSel,
      CHART_W,
      CHART_H,
      padL,
      padR,
      padT,
      padB
    );
    return { kind: 'single' as const, single };
  }, [entries, metricSel]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: spacing.lg,
          marginBottom: spacing.md,
          ...softShadowCompat(colors.bg),
        },
        placeholder: {
          height: 160,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
      }),
    [colors]
  );

  const { t, i18n } = useTranslation();
  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  let chartTitle: string;
  let hasEnoughPts = false;
  let minDisplay = 0;
  let maxDisplay = 1;

  if (seriesData.kind === 'multi') {
    chartTitle =
      t('stats.chartTrendPrefix') +
      t('body.metricMulti', { defaultValue: '综合 All' });
    const totalPts = seriesData.weight.count + seriesData.fat.count;
    // At least 2 combined points across both series, OR ≥2 in either
    hasEnoughPts =
      seriesData.weight.count >= 2 ||
      seriesData.fat.count >= 2 ||
      totalPts >= 3;
    minDisplay = seriesData.label.minV;
    maxDisplay = seriesData.label.maxV;
  } else {
    const key = metricSel as BodyMetricKey;
    chartTitle =
      t('stats.chartTrendPrefix') +
      t(`body.${METRIC_LABEL_KEY[key]}`, { defaultValue: key });
    hasEnoughPts = seriesData.single.count >= 2;
    minDisplay = seriesData.single.minV;
    maxDisplay = seriesData.single.maxV;
  }

  if (!hasEnoughPts) {
    return (
      <View style={s.wrap}>
        <Text
          style={{
            ...typography.captionBold,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          {chartTitle}
        </Text>
        <View style={s.placeholder}>
          <Icon name="chart-line" size={28} color={colors.textTertiary} />
          <Text style={{ ...typography.caption, color: colors.textTertiary }}>
            {t('stats.trendHint', {
              defaultValue: t('body.emptyHint', {
                defaultValue: t('stats.trendHint'),
              }),
            })}
          </Text>
        </View>
      </View>
    );
  }

  const w = CHART_W;
  const h = CHART_H;

  return (
    <View style={s.wrap}>
      <Text
        style={{
          ...typography.captionBold,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        }}
      >
        {chartTitle}
      </Text>
      <Svg width="100%" height={160} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Baseline */}
        <Line
          x1={padL}
          y1={h - padB}
          x2={w - padR}
          y2={h - padB}
          stroke={colors.surfaceDivider}
          strokeWidth={1.5}
        />

        {seriesData.kind === 'multi' ? (
          <>
            {/* BodyFat line (accent) — drawn first so weight overlays on top */}
            {seriesData.fat.count >= 2 ? (
              <>
                <Polyline
                  points={seriesData.fat.points}
                  stroke={colors.accent}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
                {seriesData.fat.pts.map((p, i) => (
                  <Circle
                    key={`fat-${p.date}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={colors.surface}
                    stroke={colors.accent}
                    strokeWidth={2.5}
                  />
                ))}
              </>
            ) : null}
            {/* Weight line (primary) */}
            {seriesData.weight.count >= 2 ? (
              <>
                <Polyline
                  points={seriesData.weight.points}
                  stroke={colors.primary}
                  strokeWidth={4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {seriesData.weight.pts.map((p, i) => (
                  <Circle
                    key={`w-${p.date}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill={colors.surface}
                    stroke={colors.primary}
                    strokeWidth={3}
                  />
                ))}
              </>
            ) : null}
          </>
        ) : (
          <>
            {/* Single metric line in primary color */}
            <Polyline
              points={seriesData.single.points}
              stroke={colors.primary}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {seriesData.single.pts.map((p, i) => (
              <Circle
                key={`s-${p.date}-${i}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill={colors.surface}
                stroke={colors.primary}
                strokeWidth={3}
              />
            ))}
          </>
        )}

        {/* Min / Max labels (always in top-left / bottom-left corners) */}
        <SvgText
          x={padL + 2}
          y={14}
          fontSize={12}
          fontWeight="700"
          fill={colors.textTertiary}
        >
          {fmtNumber(maxDisplay, 1)}
        </SvgText>
        <SvgText
          x={padL + 2}
          y={h - 22}
          fontSize={12}
          fontWeight="700"
          fill={colors.textTertiary}
        >
          {fmtNumber(minDisplay, 1)}
        </SvgText>
      </Svg>
    </View>
  );
}

// ============================================================================
// Screen
// ============================================================================

export default function BodyIndexScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const bodyEntries = useAppStore((s) => s.bodyEntries);
  const addBodyEntry = useAppStore((s) => s.addBodyEntry);
  const updateBodyEntry = useAppStore((s) => s.updateBodyEntry);
  const deleteBodyEntry = useAppStore((s) => s.deleteBodyEntry);

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const [scope, setScope] = useState<ScopeKey>('30');
  const [dateStr, setDateStr] = useState<string>(todayStr());
  const [metricSel, setMetricSel] = useState<MetricSel>('multi');

  // 深度防御：bodyEntries 来自持久化 vault，旧数据可能缺失或非数组。
  // 统一归一化后所有下游 find/filter/map/length 都走这一份，避免闪退。
  const safeBodyEntries: BodyProfileEntry[] = useMemo(
    () => (Array.isArray(bodyEntries) ? bodyEntries.filter((e) => e && e.date) : []),
    [bodyEntries]
  );

  const initialVals = useMemo<Partial<Record<BodyMetricKey, string>>>(() => {
    const today = todayStr();
    const todayEntry = safeBodyEntries.find((e) => e.date === today);
    const seed: Partial<Record<BodyMetricKey, string>> = {};
    if (todayEntry?.metrics) {
      for (const k of Object.keys(todayEntry.metrics) as BodyMetricKey[]) {
        const v = todayEntry.metrics[k];
        if (typeof v === 'number') seed[k] = String(v);
      }
    }
    return seed;
  }, [safeBodyEntries]);

  const [vals, setVals] = useState<Partial<Record<BodyMetricKey, string>>>(initialVals);

  useEffect(() => {
    setVals((prev) => {
      const today = todayStr();
      if (dateStr !== today) return prev;
      const todayEntry = safeBodyEntries.find((e) => e.date === today);
      if (!todayEntry?.metrics) return prev;
      const next: Partial<Record<BodyMetricKey, string>> = { ...prev };
      for (const k of Object.keys(todayEntry.metrics) as BodyMetricKey[]) {
        const v = todayEntry.metrics[k];
        if (typeof v === 'number') next[k] = String(v);
      }
      return next;
    });
  }, [safeBodyEntries, dateStr]);

  const notify = useCallback(
    (msg: string, variant: 'success' | 'info' | 'error' = 'success') => {
      try {
        toast.show({ title: msg, variant });
      } catch {
        /* provider not mounted */
      }
    },
    [toast]
  );

  const handleSave = useCallback(() => {
    const metrics: Partial<Record<BodyMetricKey, number>> = {};
    for (const k of METRIC_KEYS) {
      const raw = (vals[k] ?? '').trim();
      if (!raw.length) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      metrics[k] = n;
    }
    if (Object.keys(metrics).length === 0) {
      notify(
        t('body.emptyHint', { defaultValue: 'Please enter at least one measurement.' }),
        'info'
      );
      return;
    }
    safeHaptic('medium');
    // 如果同日已有 entry → updateBodyEntry；否则 addBodyEntry。
    const existing = safeBodyEntries.find((e) => e.date === dateStr);
    if (existing) {
      updateBodyEntry(existing.id, { metrics });
    } else {
      addBodyEntry({ date: dateStr, metrics, note: '' });
    }
    notify(t('body.saveEntry'), 'success');
  }, [safeBodyEntries, dateStr, vals, addBodyEntry, updateBodyEntry, notify, t]);

  const handleDeleteEntry = useCallback(
    (entry: BodyProfileEntry) => {
      Alert.alert(t('common.delete'), t('body.deleteEntry'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            safeHaptic('error');
            deleteBodyEntry(entry.id);
            notify(t('body.deleteEntry'), 'info');
          },
        },
      ]);
    },
    [deleteBodyEntry, notify, t]
  );

  const scopeOptions = useMemo(
    () => [
      { label: t('body.last7'), value: '7' as const },
      { label: t('body.last30'), value: '30' as const },
      { label: t('body.all'), value: 'all' as const },
    ],
    [t]
  );

  const bottomPad =
    Math.max(insets.bottom, spacing.xs) + TAB_BAR_CONTENT_HEIGHT + spacing.xl;

  const filteredEntries = useMemo(() => {
    if (scope === 'all') return safeBodyEntries.slice();
    const days = scope === '7' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    return safeBodyEntries.filter((e) => parseDate(e.date) >= cutoff - 24 * 3600 * 1000);
  }, [scope, safeBodyEntries]);

  const sortedEntries = useMemo(
    () =>
      filteredEntries
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [filteredEntries]
  );

  const sortedAsc = useMemo(
    () => sortedEntries.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    [sortedEntries]
  );

  const metricOptions = useMemo<Array<{ label: string; value: MetricSel }>>(() => {
    const multiOpt: { label: string; value: MetricSel } = {
      label: t('body.metricMulti', {
        defaultValue: t('body.metricMulti'),
      }),
      value: 'multi',
    };
    const keyOpts: Array<{ label: string; value: MetricSel }> = METRIC_KEYS.filter(
      (k) => sortedAsc.some((e) => typeof e.metrics?.[k] === 'number')
    ).map((k) => ({
      label: t(`body.${METRIC_LABEL_KEY[k]}`, { defaultValue: k }),
      value: k as BodyMetricKey,
    }));
    return [multiOpt, ...keyOpts];
  }, [t, sortedAsc, effectiveLang]);

  const setVal = useCallback(
    (k: BodyMetricKey) => (v: string) => {
      setVals((prev) => ({ ...prev, [k]: v }));
    },
    []
  );

  // 视觉一致性：描边/isDark 统一走 theme 令牌
  // （此前此处用 rgba(0,0,0,0.10) 与全 App 的 rgba(16,20,24,0.10) 不一致）
  const { isDark, frameStroke } = strokeFromColors(colors);

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        header: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          backgroundColor: colors.bg,
        },
        title: {
          ...typography.h1,
          color: colors.textPrimary,
          paddingLeft: spacing.xs,
        },
        scopeBar: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        section: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: frameStroke,
          marginHorizontal: spacing.lg,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          marginBottom: spacing.lg,
          ...softShadowCompat(colors.bg),
        },
        rowHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        dateInput: {
          ...typography.captionBold,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceElevated,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        },
        saveBtn: {
          marginTop: spacing.md,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
        },
        saveText: {
          ...typography.bodyBold,
          color: colors.textInverse,
        },
        contentPad: {
          paddingHorizontal: spacing.lg,
        },
      }),
    [colors, frameStroke]
  );

  const headerTitle = t('body.title');

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ headerShown: false, title: headerTitle }} />
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 56, paddingRight: spacing.md }}>
          <Text style={s.title} numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>
      </View>

      <View style={s.scopeBar}>
        <SegmentedControl
          options={scopeOptions}
          value={scope}
          onChange={(next) => setScope(next as ScopeKey)}
          highlightColor={colors.primary}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader
          title={t('body.sectionRecord')}
          icon="plus-circle-outline"
          note={t('body.recordDate') + ' · ' + dateStr}
        />
        <View style={s.section}>
          <View style={s.rowHeader}>
            <Text
              style={{
                ...typography.captionBold,
                color: colors.textSecondary,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {t('body.recordDate')}
            </Text>
            <Text style={s.dateInput}>{dateStr}</Text>
          </View>
          {METRIC_KEYS.map((k) => (
            <MetricRow
              key={k}
              keyName={k}
              value={vals[k] ?? ''}
              onChange={setVal(k)}
            />
          ))}
          <PressableScale onPress={handleSave} style={s.saveBtn} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={t('a11y.saveEntry')}>
            <Icon name="content-save-outline" size={16} color={colors.textInverse} />
            <Text style={s.saveText}>{t('body.saveEntry')}</Text>
          </PressableScale>
        </View>

        <View style={{ marginHorizontal: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                ...typography.captionBold,
                color: colors.textPrimary,
                fontWeight: '900',
                fontSize: 14,
                lineHeight: 18,
              }}
              numberOfLines={1}
            >
              {t('stats.trendTitle', {
                defaultValue: t('stats.trendTitle'),
              })}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                flexShrink: 1,
              }}
            >
              <View style={{ flexShrink: 1, maxWidth: 360 }}>
                <SegmentedControl
                  options={metricOptions}
                  value={metricSel as string}
                  onChange={(next) => setMetricSel(next as MetricSel)}
                  highlightColor={colors.primary}
                />
              </View>
              <Text
                style={{ ...typography.captionBold, color: colors.textSecondary }}
                numberOfLines={1}
              >
                {t('stats.metric', {
                  defaultValue: t('stats.metric'),
                })}
              </Text>
            </View>
          </View>
          <TrendChart entries={sortedAsc} metricSel={metricSel} />
        </View>

        <View style={s.contentPad}>
          <SectionHeader
            title={t('body.sectionHistory')}
            icon="history"
            note={
              scope === 'all'
                ? `${sortedEntries.length}`
                : `${sortedEntries.length} / ${safeBodyEntries.length}`
            }
          />
          {sortedEntries.length === 0 ? (
            <EmptyState
              icon="clipboard-text-clock-outline"
              title={t('body.empty')}
              desc={t('body.emptyHint')}
            />
          ) : (
            sortedEntries.map((entry, i, arr) => {
              // prev in chronological order = next item in reverse list
              const idxAsc = arr.length - 1 - i;
              const prevSorted = sortedAsc[idxAsc - 1] ?? null;
              return (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  prev={prevSorted}
                  onDelete={() => handleDeleteEntry(entry)}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

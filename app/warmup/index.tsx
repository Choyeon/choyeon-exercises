import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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
  muscleColor,
} from '@/theme';
import { safeHaptic } from '@/utils/haptic';
import { formatMmss } from '@/utils/format';
import {
  Icon,
  PressableScale,
  SectionHeader,
  HybridImage,
} from '@/components/UIKit';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useRestTimer } from '@/hooks/useRestTimer';
import type { BodyPart } from '@/types';

// ============================================================================
// Warmup type — upstream will add WarmupOrStretch to @/types.  Declared
// locally here so tsc passes before the parallel types change lands.
// ============================================================================

type WarmupCategory = 'warmup' | 'stretch';
type WarmupBodyPart = BodyPart | 'full-body' | 'core' | 'cardio';

interface WarmupOrStretch {
  id: string;
  category: WarmupCategory;
  name: { zh: string; en: string };
  instruction: { zh: string; en: string };
  durationSec: number;
  bodyPart: WarmupBodyPart;
  icon: string;
}

// Upstream provides src/data/warmups.json.  Use `require` cast so a missing
// file never breaks tsc (JSON import resolution is project-config dependent).
// If the require fails at runtime we fall back to an empty array.
const WARMUPS: WarmupOrStretch[] = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('@/data/warmups.json');
    return Array.isArray(data) ? (data as WarmupOrStretch[]) : [];
  } catch {
    return [];
  }
})();

// ============================================================================
// Small helpers
// ============================================================================

const TAB_BAR_CONTENT_HEIGHT = 56;

/**
 * mm:ss —— 这一份实现不补分钟的前导零（"0:5"），与训练执行页的 "00:05"
 * 观感不一致。统一复用 utils/format 的 formatMmss。
 */
function secToMmss(total: number): string {
  return formatMmss(total);
}

/**
 * Map warmup bodyPart → muscle color.  Warmup can use the canonical
 * BodyPart keys ('upper arms', 'waist', etc.) plus 'full-body' and 'core'.
 * Unknown keys fall back to info blue so the card never looks broken.
 */
function muscleColorFor(
  bodyPart: WarmupBodyPart,
  colors: ReturnType<typeof useThemeColors>
): string {
  // 'full-body' / 'core' 不是 theme.muscle 的键，单独映射；
  // 其余直接走 theme 统一出口 muscleColor（未知键回退 primary，与全 App 一致）。
  if (bodyPart === 'full-body') return colors.primary;
  if (bodyPart === 'core') return colors.muscle.waist ?? colors.info;
  return muscleColor(colors, bodyPart);
}

// ============================================================================
// WarmupCard
// ============================================================================

interface WarmupCardProps {
  item: WarmupOrStretch;
  index: number;
  isPlaying: boolean;
  onStart: () => void;
  onPlus10: () => void;
  onMinus10: () => void;
  onSkip: () => void;
  ringProgress: number; // 0 — 100
  ringMmss: string;
}

function WarmupCard({
  item,
  index,
  isPlaying,
  onStart,
  onPlus10,
  onMinus10,
  onSkip,
  ringProgress,
  ringMmss,
}: WarmupCardProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  // 视觉一致性：描边/阴影/isDark 统一走 theme 令牌，杜绝各页面自己算 rgba
  const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);

  const barColor = muscleColorFor(item.bodyPart, colors);
  const a11yName = item.name[effectiveLang] || item.name.zh;

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: frameStroke,
          marginBottom: spacing.lg,
          overflow: 'hidden',
          ...softShadow,
        },
        accentBar: {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 5,
        },
        body: {
          padding: spacing.lg,
          paddingLeft: spacing.xxl,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          flex: 1,
        },
        title: {
          ...typography.h3,
          color: colors.textPrimary,
          flex: 1,
        },
        idxBadge: {
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: accentStroke,
        },
        idxText: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '800',
          color: colors.textSecondary,
        },
        imgWrap: {
          width: 64,
          height: 64,
          borderRadius: radius.md,
          borderWidth: 1.5,
          overflow: 'hidden',
          marginRight: spacing.md,
        },
        contentRow: {
          flexDirection: 'row',
          marginTop: spacing.sm,
          marginBottom: spacing.md,
        },
        textCol: {
          flex: 1,
          minWidth: 0,
          justifyContent: 'center',
        },
        instruction: {
          ...typography.caption,
          color: colors.textSecondary,
          lineHeight: 19,
          marginTop: spacing.xs + 2,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        startBtn: {
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.xs,
          borderWidth: 1.5,
          borderColor: accentStroke,
        },
        startBtnText: {
          ...typography.captionBold,
          color: isDark ? '#07090C' : '#FFFFFF',
        },
        smBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: accentStroke,
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 36,
        },
        smBtnText: {
          ...typography.captionBold,
          color: colors.textPrimary,
        },
        skipBtn: {
          backgroundColor: colors.surfaceElevated,
        },
        skipBtnText: {
          color: colors.textSecondary,
        },
        ringWrap: {
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.sm,
        },
      }),
    [colors, frameStroke, accentStroke, softShadow, isDark]
  );

  return (
    <View style={s.card}>
      <View style={[s.accentBar, { backgroundColor: barColor }]} />
      <View style={s.body}>
        <View style={s.topRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={s.idxBadge}>
              <Text style={s.idxText}>{index + 1}</Text>
            </View>
            <View style={s.titleRow}>
              <Text style={s.title} numberOfLines={2}>
                {a11yName}
              </Text>
              <Badge
                label={`${item.durationSec}s`}
                color={barColor}
                size="sm"
                variant="accent"
              />
            </View>
          </View>
          {isPlaying ? (
            <View style={s.ringWrap}>
              <ProgressRing
                value={ringProgress}
                size={52}
                strokeWidth={5}
                color={colors.primary}
                trackColor={colors.surfaceElevated}
                showLabel
                label={ringMmss}
                labelColor={colors.textPrimary}
              />
            </View>
          ) : null}
        </View>

        <View style={s.contentRow}>
          <HybridImage
            uri={undefined}
            tint={barColor}
            iconName={item.icon || 'dumbbell'}
            style={[s.imgWrap, { borderColor: barColor + '66' }]}
          />
          <View style={s.textCol}>
            <Text style={s.instruction} numberOfLines={2}>
              {item.instruction[effectiveLang] || item.instruction.zh}
            </Text>
          </View>
        </View>

        <View style={s.actionRow}>
          {isPlaying ? (
            <>
              <PressableScale
                onPress={onMinus10}
                style={s.smBtn}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`${a11yName} minus 10 seconds`}
              >
                <Text style={s.smBtnText}>-10</Text>
              </PressableScale>
              <PressableScale
                onPress={onPlus10}
                style={s.smBtn}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`${a11yName} plus 10 seconds`}
              >
                <Text style={s.smBtnText}>+10</Text>
              </PressableScale>
              <PressableScale
                onPress={onSkip}
                style={[s.smBtn, s.skipBtn]}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`${a11yName} skip`}
              >
                <Icon name="skip-next" size={14} color={colors.textSecondary} />
              </PressableScale>
            </>
          ) : (
            <PressableScale
              onPress={onStart}
              style={s.startBtn}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={`Start ${a11yName} ${item.durationSec} seconds`}
            >
              <Icon
                name="play"
                size={14}
                color={isDark ? '#07090C' : '#FFFFFF'}
              />
              <Text style={s.startBtnText}>
                {t('warmup.startAction', {
                  defaultValue: '开始',
                })}{' '}
                {item.durationSec}s
              </Text>
            </PressableScale>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Screen
// ============================================================================

export default function WarmupIndexScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { timer, mmss, progress, start, skip, plus10, minus10 } = useRestTimer();

  const [tab, setTab] = useState<WarmupCategory>('warmup');
  const [curPlayingId, setCurPlayingId] = useState<string | null>(null);

  // Keep track of the previous `active` flag so we can detect the
  // true→false transition (i.e. timer finished or was skipped).
  const prevActiveRef = useRef(timer.active);

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const bottomPad =
    Math.max(insets.bottom, spacing.xs) + TAB_BAR_CONTENT_HEIGHT + spacing.xl;

  // 视觉一致性：描边/阴影/isDark 统一走 theme 令牌，杜绝各页面自己算 rgba
  const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);

  const tabOptions = useMemo(
    () => [
      {
        label: t('warmup.tabWarmup', { defaultValue: 'Warmup' }),
        value: 'warmup' as const,
        icon: 'fire',
      },
      {
        label: t('warmup.tabStretch', { defaultValue: 'Stretching' }),
        value: 'stretch' as const,
        icon: 'flower-tulip',
      },
    ],
    [t]
  );

  const items = useMemo(
    () => WARMUPS.filter((w) => w.category === tab),
    [tab]
  );

  const totalDurationSec = useMemo(
    () => items.reduce((acc, it) => acc + (it.durationSec || 0), 0),
    [items]
  );

  const notify = useCallback(
    (msg: string, variant: 'success' | 'info' = 'success') => {
      try {
        toast.show({ title: msg, variant });
      } catch {
        /* provider not mounted */
      }
    },
    [toast]
  );

  /**
   * Find the next item in the current tab after the one with `afterId`.
   * Returns null if we're at the last item.
   */
  const findNextItem = useCallback(
    (afterId: string): WarmupOrStretch | null => {
      const idx = items.findIndex((it) => it.id === afterId);
      if (idx === -1 || idx >= items.length - 1) return null;
      return items[idx + 1] ?? null;
    },
    [items]
  );

  const handleStart = useCallback(
    (item: WarmupOrStretch) => {
      safeHaptic('medium');
      const ctxName = item.name[effectiveLang] || item.name.zh;
      setCurPlayingId(item.id);
      start(item.durationSec, { exerciseName: ctxName });
      notify(
        t('warmup.startedToast', {
          defaultValue: `${ctxName} · ${item.durationSec}s`,
        }),
        'info'
      );
    },
    [effectiveLang, notify, start, t]
  );

  const handleSkip = useCallback(() => {
    safeHaptic('light');
    skip();
  }, [skip]);

  // Watch for timer finishing (active true→false with remainingSeconds === 0
  // OR a skip).  When the active flag drops, advance to the next item
  // automatically if one exists.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = timer.active;
    if (!wasActive || timer.active) return;
    // Transition: active → inactive.
    const finishedId = curPlayingId;
    if (!finishedId) return;
    // If the timer reached 0 naturally, haptic success.
    if (timer.remainingSeconds <= 0) {
      safeHaptic('success');
    }
    const next = findNextItem(finishedId);
    if (next) {
      const ctxName = next.name[effectiveLang] || next.name.zh;
      setCurPlayingId(next.id);
      start(next.durationSec, { exerciseName: ctxName });
    } else {
      // End of list — clear playing state.
      setCurPlayingId(null);
      notify(
        t('warmup.completedToast', {
          defaultValue: t('warmup.completedToast'),
        }),
        'success'
      );
    }
  }, [timer.active, timer.remainingSeconds, curPlayingId, findNextItem, effectiveLang, start, notify, t]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        topBar: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          backgroundColor: colors.bg,
        },
        sectionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          gap: spacing.sm,
          backgroundColor: colors.bg,
        },
        sectionTitle: {
          ...typography.h3,
          color: colors.textPrimary,
          paddingLeft: spacing.xs,
        },
        sectionNote: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        listWrap: {
          paddingHorizontal: spacing.lg,
        },
        bottomHint: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        },
        hintText: {
          ...typography.caption,
          color: colors.textTertiary,
          lineHeight: 18,
          textAlign: 'center',
        },
        emptyFallbackCard: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: frameStroke,
          padding: spacing.lg,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          alignItems: 'center',
          ...softShadow,
        },
        emptyTitle: {
          ...typography.bodyBold,
          color: colors.textPrimary,
          marginTop: spacing.sm,
        },
        emptyDesc: {
          ...typography.caption,
          color: colors.textSecondary,
          marginTop: spacing.xs,
          textAlign: 'center',
          lineHeight: 18,
        },
      }),
    [colors, frameStroke, softShadow]
  );

  const headerTitle = t('warmup.title', {
    defaultValue: t('warmup.title'),
  });

  const sectionNoteText = useMemo(() => {
    const base =
      t('warmup.totalCountPrefix') +
      `${items.length}` +
      t('warmup.countZhSuffix');
    const dur =
      t('warmup.estDurationZh') +
      secToMmss(totalDurationSec);
    return base + dur;
  }, [items.length, totalDurationSec, t]);

  const emptyHintText = t('warmup.emptyHint', {
    defaultValue: t('warmup.emptyHint'),
  });

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ headerShown: false, title: headerTitle }} />

      <View style={s.topBar}>
        <SegmentedControl
          options={tabOptions}
          value={tab}
          onChange={(next) => {
            safeHaptic('selection');
            setTab(next as WarmupCategory);
            setCurPlayingId(null);
            skip();
          }}
          highlightColor={colors.primary}
        />
      </View>

      <View style={s.sectionRow}>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 56, paddingRight: spacing.md }}>
          <Text style={s.sectionTitle} numberOfLines={1}>
            {tab === 'warmup'
              ? t('warmup.sectionWarmup', {
                  defaultValue: t('warmup.sectionWarmup'),
                })
              : t('warmup.sectionStretch', {
                  defaultValue: t('warmup.sectionStretch'),
                })}
          </Text>
        </View>
        <Text style={s.sectionNote} numberOfLines={1}>
          {sectionNoteText}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <View style={s.emptyFallbackCard}>
            <Icon name="dumbbell" size={28} color={colors.textTertiary} />
            <Text style={s.emptyTitle}>
              {t('warmup.emptyTitle', {
                defaultValue: t('warmup.emptyTitle'),
              })}
            </Text>
            <Text style={s.emptyDesc}>{emptyHintText}</Text>
          </View>
        ) : (
          <View style={s.listWrap}>
            {items.map((it, idx) => {
              const playing = curPlayingId === it.id;
              return (
                <WarmupCard
                  key={it.id}
                  item={it}
                  index={idx}
                  isPlaying={playing}
                  onStart={() => handleStart(it)}
                  onPlus10={playing ? plus10 : () => {}}
                  onMinus10={playing ? minus10 : () => {}}
                  onSkip={handleSkip}
                  ringProgress={Math.round(progress * 100)}
                  ringMmss={mmss}
                />
              );
            })}
          </View>
        )}

        <View style={s.bottomHint}>
          <Text style={s.hintText}>{emptyHintText}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

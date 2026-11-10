import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Exercise, LanguageCode } from '@/types';
import { useThemeColors, typography, spacing, radius, muscleColor } from '@/theme';
import type { Colors } from '@/theme';
import {
  getImageUrl,
  getAnimationUrl,
  iconForBodyPart,
  iconForEquipment,
  labelForBodyPart,
  labelForEquipment,
  labelForMuscle,
  translateTargetPhrase,
  displayNameZh,
} from '@/constants';
import { useAppStore } from '@/store/useAppStore';
import { Icon, PressableScale } from '@/components/UIKit';
import { Badge as UIBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { GifPlayer } from '@/components/GifPlayer';
import { safeHaptic } from '@/utils/haptic';

/**
 * 把 instructions[lang]（string | string[] | undefined）归一成一段纯文本。
 * 数据集历史上两种形态都出现过，详情页与卡片此前各有一套假设。
 */
function instructionLead(
  instructions: Exercise['instructions'] | undefined | null,
  lang: LanguageCode
): string {
  const raw = instructions?.[lang];
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string').join(' \n ');
  if (typeof raw === 'string') return raw;
  return '';
}

/**
 * 卡片样式按主题缓存到模块级 —— ExerciseCard 会出现在 FlashList 里，
 * 每个可见 cell 都是一次组件实例化。以前 25+ 条 StyleSheet 在每个 cell 里
 * 各建一份（滚动时持续分配 + GC 压力）；现在同主题下所有 cell 共享一份。
 * colors 只有 dark/light 两个实例，用 WeakMap 缓存即可，避免主题切换泄漏。
 */
const cardStylesCache = new WeakMap<Colors, ReturnType<typeof createCardStyles>>();

function createCardStyles(colors: Colors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardCompact: {
    borderRadius: radius.md,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: 160,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  imageWrapCompact: {
    height: 104,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  favBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  infoWrap: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  nameZh: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  desc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  secondaryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    flexShrink: 0,
    borderWidth: 1,
  },
  secondaryTagText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  quickAddBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  // ===================== GRID MODE (3 columns) =====================
  cardGrid: {
    width: '100%',
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },
  imageWrapGrid: {
    height: 110,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  infoWrapGrid: {
    padding: spacing.sm,
    paddingTop: spacing.xs,
  },
  nameGrid: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  metaRowGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaTextGrid: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  });
}

function getCardStyles(colors: Colors) {
  let cached = cardStylesCache.get(colors);
  if (!cached) {
    cached = createCardStyles(colors);
    cardStylesCache.set(colors, cached);
  }
  return cached;
}

interface ExerciseCardProps {
  exercise?: Exercise;
  /** Override display language; when omitted the card reads the active
   *  i18n locale reactively — so flipping language in Settings rerenders
   *  every visible card with no caller-side plumbing required. */
  language?: LanguageCode;
  onPress?: () => void;
  compact?: boolean;
  grid?: boolean;
  showFavorite?: boolean;
  /** When true, the card renders a <Skeleton height={96} /> placeholder
   *  instead of real content.  Used while the exercises query is loading. */
  loading?: boolean;
}

function ExerciseCardImpl({
  exercise,
  language: languageProp,
  onPress,
  compact = false,
  grid = false,
  showFavorite = true,
  loading = false,
}: ExerciseCardProps) {
  const colors = useThemeColors();
  const { i18n, t } = useTranslation();

  // -------- loading short-circuit: 96px skeleton tile matching card size --------
  // 注意：此 early return 必须放在所有 hooks 之后（Rules of Hooks），否则
  // loading 由 true→false 时 hook 数量变化 → "Rendered fewer hooks than expected" 闪退。

  // `exercise` 在 loading 时可能为 undefined，用 ex 安全引用避免 hook 内崩溃
  const ex = exercise;

  // Resolve display language once per render: explicit prop wins, otherwise
  // fall back to the i18n instance's current language.  This keeps the
  // component language-correct even when a caller forgets to pass it.
  const effective: LanguageCode =
    languageProp ?? (i18n.language?.startsWith('en') ? 'en' : 'zh');

  const styles = getCardStyles(colors);

  const router = useRouter();
  const isFavorite = useAppStore((s) => s.isFavorite(ex?.id ?? ''));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  // rerender-deferred-reads: don't subscribe to the ENTIRE activeWorkout
  // object (which mutates on every set edit) — we only need a boolean to
  // decide whether the quick-add "+" button should render.  A stable getter
  // is O(1) and avoids thousands of FlashList re-renders for users with
  // 100+ visible cards while a workout is active.
  const hasActiveWorkout = useAppStore((s) => s.activeWorkout !== null);

  // Muscle accentColor + derived label/icon bundle.  Helpers are O(1) table reads,
  // but memoizing the whole bundle keeps downstream `Badge` memo() calls valid
  // and avoids thousands of re-reconciliations inside a 1000-row FlashList.
  // 统一走 theme 的 muscleColor()，不再各自手写 `colors.muscle[...] ?? primary`
  const accentColor: string = muscleColor(colors, ex?.body_part);

  // ----- Description: prefer translated `target`, else instructions lead -----
  const descriptionText = useMemo(() => {
    if (!ex) return '';
    // instructions[lang] 在数据集里既可能是 string[] 也可能是 string
    // （详情页已经这么处理了），这里统一成字符串再截断，
    // 否则数组会泄漏进 <Text> 渲染成 "[object Object]"。
    const lead = instructionLead(ex.instructions, effective);
    const raw = translateTargetPhrase(ex.target ?? '', effective);
    return raw || lead.slice(0, 80) || '';
  }, [ex, effective]);

  // ----- Secondary muscles translated (zh) -----
  const secondaryTags = useMemo(() => {
    // 深度防御：历史 vault 里 secondary_muscles 可能被写成 null/对象，
    // 直接 .slice 会抛 "slice is not a function" 并把整个 FlashList 打崩。
    const raw = ex?.secondary_muscles;
    const list: string[] = Array.isArray(raw) ? raw.filter((m) => typeof m === 'string') : [];
    return list.slice(0, 4).map((m) => {
      const zhLabel = labelForMuscle(m, effective);
      return zhLabel.length > 5 ? zhLabel.slice(0, 5) : zhLabel;
    });
  }, [ex?.secondary_muscles, effective]);

  const { bodyPartIcon, bodyPartLabel, equipIcon, equipLabel } = useMemo(
    () => ({
      bodyPartIcon: iconForBodyPart(ex?.body_part),
      bodyPartLabel: labelForBodyPart(ex?.body_part ?? '', effective),
      equipIcon: iconForEquipment(ex?.equipment),
      equipLabel: labelForEquipment(ex?.equipment ?? '', effective),
    }),
    [ex?.body_part, ex?.equipment, effective]
  );

  // Media URLs from the dataset: animated GIF is the primary content
  // (guaranteed playback via GifPlayer's 4-tier fallback chain), the static
  // JPG is the poster tier.  Memoized so FlashList recycling doesn't
  // recompute strings for unchanged cells.
  const gifUri = useMemo(
    () => getAnimationUrl(ex?.gif_url || ex?.animation || ''),
    [ex?.gif_url, ex?.animation]
  );
  const posterUri = useMemo(() => getImageUrl(ex?.image ?? ''), [ex?.image]);

  const handlePress = useCallback(() => {
    if (!ex) return;
    safeHaptic('light');
    if (onPress) {
      onPress();
      return;
    }
    const href = `/exercise/${encodeURIComponent(ex.id)}` as unknown as Parameters<typeof router.push>[0];
    router.push(href);
  }, [onPress, ex?.id, router]);

  const handleFavorite = useCallback((e: GestureResponderEvent) => {
    if (!ex) return;
    e.stopPropagation?.();
    safeHaptic('medium');
    toggleFavorite(ex.id);
  }, [ex?.id, toggleFavorite]);

  const handleQuickAdd = useCallback((e: GestureResponderEvent) => {
    if (!ex) return;
    e.stopPropagation?.();
    if (!hasActiveWorkout) {
      useAppStore.getState().startWorkout();
    }
    safeHaptic('success');
    useAppStore.getState().addExerciseToActive(ex.id);
  }, [hasActiveWorkout, ex?.id]);

  // ★ loading early return 放在所有 hooks 之后（Rules of Hooks 合规）
  //
  // ★ 同时覆盖 `!ex`：调用方完全可能传 `loading={false}` 但 exercise 仍为
  //   undefined（加载失败 / 索引越界 / 动作被删除）。原先下面用了一串 `ex!`
  //   非空断言，一旦发生就是 `Cannot read property 'name' of undefined` 闪退。
  if (loading || !ex) {
    return (
      <View style={[
        { marginBottom: spacing.md },
        compact && styles_shell.compactMargin,
        grid && styles_shell.gridCard,
      ]}>
        <Skeleton height={grid ? 164 : 96} borderRadius={compact ? radius.md : radius.lg} />
      </View>
    );
  }

  return (
    <PressableScale
      onPress={handlePress}
      style={[styles.card, compact && styles.cardCompact, grid && styles.cardGrid]}
      accessibilityRole="button"
      accessibilityLabel={effective === 'zh' ? displayNameZh(ex) : ex.name}
    >
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact, grid && styles.imageWrapGrid]}>
        <GifPlayer
          gifUri={gifUri}
          posterUri={posterUri}
          // ★ 性能修复：列表中只显示静态 poster 图，不自动播放 GIF。
          //   1324 条数据 FlashList 可见区 8-15 张卡同时解码 GIF 会造成严重内存压力与掉帧。
          //   GIF 动画在详情页播放。
          active={false}
          tint={accentColor}
          placeholderIcon={bodyPartIcon}
          contentFit="contain"
        />
      </View>

      <View style={[styles.infoWrap, grid && styles.infoWrapGrid]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, grid && styles.nameGrid]} numberOfLines={grid ? 2 : 1}>
            {effective === 'zh' ? displayNameZh(ex) : ex.name}
          </Text>
          {!grid && (
            <Text style={styles.nameZh} numberOfLines={1}>
              {effective === 'zh' ? ex.name : (ex.muscle_group ?? equipLabel)}
            </Text>
          )}
          {/* 简介行 2 行 */}
          {!grid && descriptionText && (
            <Text style={styles.desc} numberOfLines={2} ellipsizeMode="tail">
              {descriptionText}
            </Text>
          )}

          {!grid ? (
            <>
              <View style={styles.metaRow}>
                {/* M1 MVP: body-part tag — new UIBadge with muscle color. */}
                <UIBadge
                  icon={bodyPartIcon}
                  label={bodyPartLabel}
                  color={accentColor}
                  size="sm"
                />
                {/* M1 MVP: equipment tag — new UIBadge with info blue. */}
                <UIBadge
                  icon={equipIcon}
                  label={equipLabel}
                  color={colors.info}
                  size="sm"
                />
              </View>
              {secondaryTags.length > 0 && (
                <View style={styles.secondaryRow}>
                  {secondaryTags.map((label, i) => (
                    <View
                      key={`${label}-${i}`}
                      style={[
                        styles.secondaryTag,
                        {
                          backgroundColor: accentColor + '18',
                          borderColor: accentColor + '30',
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryTagText, { color: accentColor }]} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.metaRowGrid}>
              <Icon name={bodyPartIcon} size={11} color={accentColor} />
              <Text style={styles.metaTextGrid} numberOfLines={1}>
                {bodyPartLabel}
              </Text>
            </View>
          )}
        </View>

        {showFavorite && (
          <PressableScale
            onPress={handleFavorite}
            style={styles.favBtn}
            hitSlop={8}
            scaleTo={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.toggleFavorite')}
          >
            <Icon
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={grid ? 14 : 18}
              color={isFavorite ? colors.accent : colors.textSecondary}
            />
          </PressableScale>
        )}

        {hasActiveWorkout && !grid && (
          <PressableScale
            onPress={handleQuickAdd}
            style={styles.quickAddBtn}
            hitSlop={6}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.addToWorkout')}
          >
            <Icon name="plus" size={20} color={colors.textInverse} />
          </PressableScale>
        )}
      </View>
    </PressableScale>
  );
}

const styles_shell = StyleSheet.create({
  compactMargin: { marginBottom: spacing.md },
  gridCard: { width: '100%', marginBottom: spacing.md },
});

export const ExerciseCard = memo(ExerciseCardImpl);

import React, { memo, forwardRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  PressableProps,
  StyleSheet,
  TextInput,
  ViewStyle,
  StyleProp,
  Modal,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useThemeColors, typography, spacing, radius, layout, getScrim, strokeFromColors } from '@/theme';
import { useTranslation } from 'react-i18next';
// Direct import (not the ui/ barrel) to avoid a circular dependency:
// LiquidGlass only depends on the theme.
import { GlassSurface } from '@/components/ui/LiquidGlass';

// ==========================================================================
// Icon — single gateway for MaterialCommunityIcons.  Everything goes through
// here so icon library swaps or default size adjustments touch ONE place.
// ==========================================================================

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon = memo(function Icon({
  name,
  size = 18,
  color,
  style,
}: IconProps) {
  return (
    <MaterialCommunityIcons
      name={name as any}
      size={size}
      color={color}
      style={style}
    />
  );
});

// ==========================================================================
// PressableScale — consistent press feedback everywhere.
// 96% target scale, tight spring, zero overshoot so the "industrial slab"
// feeling stays intact rather than a bouncy AI mockup.
// ==========================================================================

const SPRING_CFG: WithSpringConfig = {
  mass: 0.55,
  stiffness: 420,
  damping: 24,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

export const PressableScale = memo(
  forwardRef<View, PressableScaleProps>(function PressableScale(
    { style, scaleTo = 0.965, children, onPressIn, onPressOut, ...rest },
    ref
  ) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
    const handlePressIn = (e: any) => {
      scale.value = withSpring(scaleTo, SPRING_CFG);
      onPressIn?.(e);
    };
    const handlePressOut = (e: any) => {
      scale.value = withSpring(1, SPRING_CFG);
      onPressOut?.(e);
    };
    return (
      <AnimatedPressable
        ref={ref as any}
        style={[animatedStyle, style as any]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  })
);

// ==========================================================================
// SectionHeader — stamped, machined section lead.
// Left: 3px vertical accent rule.  Icon (never emoji).  Bold h3 label.
// Never: pastel background, radial gradient, or rounded rule.
// ==========================================================================

export interface SectionHeaderProps {
  title: string;
  icon?: string;
  inline?: boolean;
  accent?: string;
  note?: string; // one-line category/action hint rendered under title
}

export function SectionHeader({
  title,
  icon,
  inline = false,
  accent,
  note,
}: SectionHeaderProps) {
  const colors = useThemeColors();
  const resolvedAccent = accent ?? colors.primary;
  const styles = useMemo(() => StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingTop: spacing.xs,
    },
    sectionHeaderInline: {
      marginBottom: 0,
      flex: 1,
    },
    // iOS 17 / Settings 风格图标托盘：圆角方形 + 柔和色底。
    iconTray: {
      width: 26,
      height: 26,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    sectionNote: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 17,
    },
  }), [colors]);

  return (
    <View
      style={[
        styles.sectionHeader,
        inline && styles.sectionHeaderInline,
      ]}
    >
      {icon ? (
        <View style={[styles.iconTray, { backgroundColor: resolvedAccent + '1A' }]}>
          <Icon name={icon} size={15} color={resolvedAccent} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
        {note ? (
          <Text style={styles.sectionNote} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ==========================================================================
// SlabDivider — iOS 风格标准 hairline 分隔线。
// HIG：分组列表内的分隔线应为 uniform hairline（0.5pt），不使用「金属折板
// 缺口」这类工业装饰，避免与 iOS 视觉语言冲突。
// ==========================================================================

export function SlabDivider({ accent }: { accent?: string }) {
  const colors = useThemeColors();
  const slabStyles = useMemo(() => StyleSheet.create({
    wrap: {
      height: StyleSheet.hairlineWidth,
      marginVertical: spacing.md,
      backgroundColor: colors.surfaceDivider,
    },
  }), [colors]);

  return <View style={slabStyles.wrap} />;
}

// ==========================================================================
// SearchBar — pill, icons for search + clear, no emoji fallbacks.
// ==========================================================================

export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

function SearchBarImpl({
  value,
  onChange,
  placeholder = 'Search exercises, muscles…',
  onClear,
}: SearchBarProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const searchStyles = useMemo(() => StyleSheet.create({
    // iOS 26 search field: liquid-glass capsule, 40pt tall, no hard border.
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      height: 40,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '400',
      letterSpacing: -0.2,
      height: '100%',
      paddingVertical: 0,
    },
    clearBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.textTertiary + '33',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), [colors]);

  return (
    <GlassSurface
      borderRadius={20}
      intensity={45}
      style={searchStyles.wrap}
      accessibilityRole="search"
    >
      <Icon
        name="magnify"
        size={19}
        color={colors.textSecondary}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        style={searchStyles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <PressableScale
          onPress={onClear || (() => onChange(''))}
          style={searchStyles.clearBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.clearSearch')}
        >
          <Icon
            name="close"
            size={12}
            color={colors.textSecondary}
          />
        </PressableScale>
      )}
    </GlassSurface>
  );
}

export const SearchBar = memo(SearchBarImpl);

// ==========================================================================
// StatsHero — 3 columns, tabular numbers, left accent top-rule.
// No radial gradients. No blobs. Just a slab with an accent strip.
// ==========================================================================

export interface StatsHeroProps {
  streak: number;
  workouts: number;
  volume: number;
  units?: 'kg' | 'lb';
  // Caller (screen-level) supplies i18n strings.  Keeping them as props
  // means UIKit itself never imports from react-i18next (single-responsibility)
  // and we guarantee these labels flip when language toggles at runtime.
  labelStreak: string;
  labelWorkouts: string;
  labelVolume: string;
  suffixStreak: string;
  suffixWorkouts: string;
  suffixVolume?: string;
}

export function StatsHero({
  streak,
  workouts,
  volume,
  units = 'kg',
  labelStreak,
  labelWorkouts,
  labelVolume,
  suffixStreak,
  suffixWorkouts,
  suffixVolume,
}: StatsHeroProps) {
  const colors = useThemeColors();
  const heroStyles = useMemo(() => StyleSheet.create({
    wrap: {
      marginBottom: spacing.lg,
      borderRadius: radius.xl,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
      position: 'relative',
    },
    accentRule: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 56,
      height: 3,
      backgroundColor: colors.primary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    vSep: {
      width: 1,
      height: 36,
      backgroundColor: colors.surfaceDivider,
    },
    statBlock: {
      alignItems: 'center',
      flex: 1,
      gap: spacing.xs,
    },
    iconTray: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    statValue: {
      ...typography.display,
      fontSize: 24,
      lineHeight: 32,
      color: colors.textPrimary,
      letterSpacing: -0.6,
    },
    statSuffix: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0,
    },
    statLabel: {
      ...typography.small,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: spacing.xs,
    },
  }), [colors]);

  return (
    <View style={heroStyles.wrap}>
      <View style={heroStyles.accentRule} />
      <View style={heroStyles.row}>
        <StatBlock
          colors={colors}
          heroStyles={heroStyles}
          label={labelStreak}
          value={streak}
          suffix={suffixStreak}
          icon="fire"
          highlight
        />
        <View style={heroStyles.vSep} />
        <StatBlock
          colors={colors}
          heroStyles={heroStyles}
          label={labelWorkouts}
          value={workouts}
          suffix={suffixWorkouts}
          icon="dumbbell"
        />
        <View style={heroStyles.vSep} />
        <StatBlock
          colors={colors}
          heroStyles={heroStyles}
          label={labelVolume}
          value={formatVolume(volume)}
          suffix={suffixVolume ?? units}
          icon="weight-kilogram"
        />
      </View>
    </View>
  );
}

function formatVolume(v: number): string | number {
  if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v);
}

interface StatBlockProps {
  label: string;
  value: number | string;
  suffix: string;
  icon: string;
  highlight?: boolean;
  colors: ReturnType<typeof useThemeColors>;
  heroStyles: any;
}

function StatBlock({ label, value, suffix, icon, highlight, colors, heroStyles }: StatBlockProps) {
  return (
    <View style={heroStyles.statBlock}>
      <View
        style={[
          heroStyles.iconTray,
          highlight && { backgroundColor: colors.primaryDim },
        ]}
      >
        <Icon
          name={icon}
          size={15}
          color={highlight ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          heroStyles.statValue,
          highlight && { color: colors.primary },
        ]}
      >
        {value}
        <Text style={heroStyles.statSuffix}> {suffix}</Text>
      </Text>
      <Text style={heroStyles.statLabel}>{label}</Text>
    </View>
  );
}

// ==========================================================================
// EmptyState — bold outline icon.  Two lines of copy. No emoji.
// ==========================================================================

export interface EmptyStateProps {
  icon: string;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, desc, actionLabel, onAction }: EmptyStateProps) {
  const colors = useThemeColors();
  const emptyStyles = useMemo(() => StyleSheet.create({
    wrap: {
      paddingVertical: spacing.xxxl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    iconBox: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
    },
    desc: {
      ...typography.sub,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 260,
    },
    actionBtn: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryDim,
    },
    actionText: {
      ...typography.captionBold,
      color: colors.primary,
      letterSpacing: 0.2,
    },
  }), [colors]);

  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconBox}>
        <Icon name={icon} size={28} color={colors.textTertiary} />
      </View>
      <Text style={emptyStyles.title}>{title}</Text>
      {desc ? <Text style={emptyStyles.desc}>{desc}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} style={emptyStyles.actionBtn} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Icon name="plus" size={14} color={colors.primary} />
          <Text style={emptyStyles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

// ==========================================================================
// MiniStat — inline stat, 3-up layout.  Icons only, no emoji.
// ==========================================================================

export interface MiniStatProps {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  iconColor?: string;
}

export function MiniStat({
  label,
  value,
  unit,
  icon,
  iconColor,
}: MiniStatProps) {
  const colors = useThemeColors();
  const resolvedIconColor = iconColor ?? colors.textSecondary;
  const { frameStroke } = strokeFromColors(colors);
  const miniStyles = useMemo(() => StyleSheet.create({
    // Apple HIG：统计块为 inset grouped 卡片（surface + hairline 描边）。
    col: {
      alignItems: 'center',
      flex: 1,
      gap: 2,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: frameStroke,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    iconTray: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    value: {
      ...typography.h2,
      fontSize: 22,
      lineHeight: 28,
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },
    unit: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: colors.textTertiary,
    },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
  }), [colors, frameStroke]);

  return (
    <View
      style={miniStyles.col}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${unit ? ' ' + unit : ''}`}
    >
      <View style={[miniStyles.iconTray, { backgroundColor: resolvedIconColor + '1A' }]}>
        <Icon name={icon} size={15} color={resolvedIconColor} />
      </View>
      <Text style={miniStyles.value}>
        {value}
        {unit ? <Text style={miniStyles.unit}> {unit}</Text> : null}
      </Text>
      <Text style={miniStyles.label}>{label}</Text>
    </View>
  );
}

// ==========================================================================
// Badge — compact icon + text chip (used in headers, meta rows).
// ==========================================================================

export interface BadgeProps {
  icon: string;
  label: string;
  color?: string;
  size?: 'sm' | 'md';
}

export function Badge({
  icon,
  label,
  color,
  size = 'md',
}: BadgeProps) {
  const colors = useThemeColors();
  const resolvedColor = color ?? colors.primary;
  const small = size === 'sm';
  const badgeStyles = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    wrapSm: {
      paddingHorizontal: spacing.sm - 2,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    text: {
      ...typography.small,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    textSm: {
      fontSize: 10,
      lineHeight: 14,
    },
  }), []);

  return (
    <View
      style={[
        badgeStyles.wrap,
        small && badgeStyles.wrapSm,
        { backgroundColor: resolvedColor + '16', borderColor: resolvedColor + '38' },
      ]}
    >
      <Icon name={icon} size={small ? 11 : 12} color={resolvedColor} />
      <Text style={[badgeStyles.text, small && badgeStyles.textSm, { color: resolvedColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ==========================================================================
// OptionPicker — modal bottom-sheet style radio-list picker. Replaces the
// 4x bespoke "Pressable + cycle through options array" inline loop-toggles
// that lived in Profile.tsx (language, units, theme, defaultRestSeconds).
//
// Benefits over the old cycle-toggle pattern:
//   • Direct selection (no 3 taps to reach option 4 in a 5-item list)
//   • Semantic a11y roles (radiogroup / radio)
//   • Consistent visual language with History/Exercise picker modals
//   • Type-safe generic <T> value via discriminated options array
// ==========================================================================

export interface OptionPickerOption<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: string;
  iconColor?: string;
}

export interface OptionPickerProps<T extends string | number> {
  visible: boolean;
  title: string;
  options: OptionPickerOption<T>[];
  value: T;
  onSelect: (v: T) => void;
  onClose: () => void;
  cancelLabel?: string;
  accent?: string;
}

function OptionPickerImpl<T extends string | number>(
  {
    visible,
    title,
    options,
    value,
    onSelect,
    onClose,
    cancelLabel = 'Cancel',
    accent,
  }: OptionPickerProps<T>,
  _ref: React.Ref<View>
) {
  const colors = useThemeColors();
  const resolvedAccent = accent ?? colors.primary;
  const op = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      // 视觉一致性：遮罩统一走 getScrim()，避免全 App 出现 0.45/0.62/0.18 混用
      backgroundColor: getScrim(strokeFromColors(colors).isDark),
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: '80%',
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceDivider,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.sm,
      justifyContent: 'space-between',
    },
    sheetTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      textAlign: 'center',
      flex: 1,
    },
    closeBtn: {
      width: 56,
      alignItems: 'flex-end',
      paddingVertical: spacing.xs,
    },
    closeText: {
      ...typography.captionBold,
      color: colors.textSecondary,
    },
    scroll: {
      maxHeight: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: spacing.sm,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowLabel: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    rowSublabel: {
      ...typography.caption,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  }), [colors]);

  const handleSelect = useCallback(
    (v: T) => {
      onSelect(v);
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={op.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
      >
        <Pressable style={op.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={op.sheetHandle} />

          <View style={op.headerRow}>
            <View style={{ width: 56 }} />
            <Text style={op.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
            <PressableScale
              onPress={onClose}
              style={op.closeBtn}
              hitSlop={8}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={op.closeText}>{cancelLabel}</Text>
            </PressableScale>
          </View>

          <ScrollView
            style={op.scroll}
            contentContainerStyle={{
              paddingHorizontal: layout.paddingHorizontal,
              paddingVertical: spacing.sm,
            }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <PressableScale
                  key={String(opt.value)}
                  onPress={() => handleSelect(opt.value)}
                  style={[
                    op.row,
                    selected && {
                      borderColor: resolvedAccent + '66',
                      backgroundColor: resolvedAccent + '10',
                    },
                  ]}
                  scaleTo={0.985}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.label}
                >
                  {opt.icon ? (
                    <View
                      style={[
                        op.rowIcon,
                        {
                          backgroundColor:
                            (opt.iconColor || resolvedAccent) + '16',
                        },
                      ]}
                    >
                      <Icon
                        name={opt.icon}
                        size={16}
                        color={selected ? resolvedAccent : (opt.iconColor || colors.textSecondary)}
                      />
                    </View>
                  ) : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        op.rowLabel,
                        selected && { color: resolvedAccent },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                    {opt.sublabel ? (
                      <Text style={op.rowSublabel} numberOfLines={2}>
                        {opt.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      op.radio,
                      selected && {
                        borderColor: resolvedAccent,
                        backgroundColor: resolvedAccent,
                      },
                    ]}
                  >
                    {selected ? (
                      <Icon name="check" size={12} color={colors.textInverse} />
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Standalone generic signature so JSX callers can write `<OptionPicker<T>>`
// after `memo()` / `forwardRef()` would otherwise erase generics.  The
// `as unknown as ...` cast is safe: it restores the T-parametric call
// surface that MemoExoticComponent drops, without altering runtime behavior.
type OptionPickerComponent = <T extends string | number>(
  p: OptionPickerProps<T> & { ref?: React.Ref<View> }
) => React.ReactElement | null;

export const OptionPicker = memo(
  forwardRef(OptionPickerImpl)
) as unknown as OptionPickerComponent & { displayName?: string };

// ———————————————————————————————————————————————————————————————————————
// OptionPicker inline "toggle cell" helper: wraps a Pressable pill +
// opens the modal.  Screens supply the open state via useState + setter.
// ———————————————————————————————————————————————————————————————————————

export interface OptionPickerToggleProps {
  label: string;
  onPress: () => void;
  accent?: string;
  iconName?: string;
}

export function OptionPickerToggle({
  label,
  onPress,
  accent,
  iconName = 'chevron-right',
}: OptionPickerToggleProps) {
  const colors = useThemeColors();
  const resolvedAccent = accent ?? colors.primary;
  const opToggle = useMemo(() => StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      minHeight: 30,
      paddingRight: spacing.sm,
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      maxWidth: 140,
    },
  }), [colors]);

  return (
    <PressableScale onPress={onPress} style={opToggle.pill} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[opToggle.label, { color: resolvedAccent }]} numberOfLines={1}>
        {label}
      </Text>
      <Icon name={iconName} size={11} color={resolvedAccent} />
    </PressableScale>
  );
}

// ============================================================================
// LocalImageCover — offline-only image placeholder.
//
// Replaces remote-loaded <Image source={getImageUrl(x.image)} /> calls with a
// zero-network, instant-render slab.  Every exercise in the dataset has a
// body_part and equipment, so we render a muscle-tinted background + the
// body-part icon.  This is visually informative (users scan cards by color
// first anyway) and guarantees no loading spinners, no CDN timeouts, and
// no transparent/black frames — even on first-launch airplane-mode.
// ============================================================================

export interface LocalImageCoverProps {
  /** Muscle group / accent tint.  Should come from `colors.muscle[body_part]`. */
  tint: string;
  /** MaterialCommunityIcons glyph name.  Usually the body-part icon. */
  iconName?: string;
  /** Optional style override (width / height / borderRadius / borderColor). */
  style?: StyleProp<ViewStyle>;
  /** Icon size as a fraction of container shortest-edge.  Default 0.45. */
  iconRatio?: number;
  /**
   * When true, draws an 88%-container circular "muscle ring" inset instead
   * of filling the whole rectangle.  Used by <HybridImage> fallback so
   * cards without a poster still look muscle-branded instead of showing
   * a flat "?" icon.  Default true.
   */
  circular?: boolean;
}

export const LocalImageCover = memo(function LocalImageCover({
  tint,
  iconName = 'dumbbell',
  style,
  iconRatio = 0.45,
  circular = true,
}: LocalImageCoverProps) {
  const colors = useThemeColors();
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const handleLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    },
    []
  );
  const edge = Math.min(dims.w, dims.h) || 0;
  const iconSize = edge > 0 ? Math.round(edge * iconRatio) : 32;
  // 88% inner circular placeholder (ring-style inset)
  const ringDiameter = edge > 0 ? Math.round(edge * 0.88) : 0;
  const ringBg = tint ? tint + '18' : colors.surface;
  const ringStroke = tint ? tint : colors.primary;

  if (!circular) {
    return (
      <View
        onLayout={handleLayout}
        style={[
          {
            backgroundColor: tint + '18',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Icon name={iconName} size={iconSize || 32} color={tint || colors.primary} />
      </View>
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: ringDiameter || '88%',
          aspectRatio: 1,
          borderRadius: ringDiameter / 2 || 9999,
          borderWidth: 1,
          borderColor: ringStroke,
          backgroundColor: ringBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={iconName} size={iconSize || 32} color={ringStroke} />
      </View>
    </View>
  );
});

// ============================================================================
// MiniTag — compact colored pill with icon + label.
// Used inline inside list rows to tag body parts / equipment / status.
// ============================================================================

export interface MiniTagProps {
  icon: string;
  label: string;
  color: string;
  /** 'xs' = extra-tight (10px label), 'sm' = standard (11px label). */
  size?: 'xs' | 'sm';
  /** Optional layout override (e.g. `marginRight`) applied to the outer pill. */
  style?: StyleProp<ViewStyle>;
}

export const MiniTag = memo(function MiniTag({
  icon,
  label,
  color,
  size = 'sm',
  style,
}: MiniTagProps) {
  const isXs = size === 'xs';
  const mt = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: isXs ? spacing.xs + 2 : spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
    },
    label: {
      fontSize: isXs ? 10 : 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
      maxWidth: 120,
    },
  }), [isXs]);
  return (
    <View style={[mt.wrap, style, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <Icon name={icon} size={isXs ? 10 : 11} color={color} />
      <Text style={[mt.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

// ============================================================================
// HybridImage — show real image from local (file:///android_asset/...) or any
// valid URI, with a muscle-tinted <LocalImageCover> as the ALWAYS-visible
// base layer.  Rendering semantics:
//
//   ┌────────────────────────────────┐  ← <View style /> container owns size
//   │  <LocalImageCover   absoluteFill>  ← ALWAYS drawn underneath (no flicker)
//   │  <ExpoImage         absoluteFill>  ← drawn on TOP only while !failed
//   └────────────────────────────────┘
//
// Result:
//   • Before the bitmap is decoded → the placeholder underneath shows,
//     so users never see a white / transparent / spinner rectangle.
//   • Image loads successfully → paints over the placeholder (opaque JPGs
//     cover it completely; for corrupted / missing URIs the next rule wins)
//   • ExpoImage.onError fires → `failed=true`, the overlay image is
//     unmounted, and the clean placeholder underneath is revealed.
//
// This is the exact "image component + onError fallback" pattern suggested
// by experience 545715, wrapped into a reusable unit so 5+ call sites don't
// duplicate the event / state / layering logic.
// ============================================================================

export interface HybridImageProps {
  /** Any image URI expo-image can decode.  Usually file:///android_asset/... */
  uri?: string | null;
  /** Muscle-group tint used for the placeholder underneath and on failure. */
  tint: string;
  /** MaterialCommunityIcon glyph for the placeholder underneath. */
  iconName?: string;
  /** Size/shape/border of the whole hybrid tile. */
  style?: StyleProp<ViewStyle>;
  /** How the bitmap should fit.  Default 'cover'. */
  contentFit?: 'cover' | 'contain' | 'fill';
  /** Icon ratio forwarded to <LocalImageCover>. */
  iconRatio?: number;
  /**
   * Body-part slug (e.g. `chest`, `upper legs`) used to auto-derive icon
   * and tint when the poster itself fails to load.  When present, tint
   * and iconName both fall back using this slug — so callers don't need
   * to pre-compute them.
   */
  fallbackBodyPart?: string;
  /** Override tint for the ring background. */
  fallbackTint?: string;
  /** Override icon for the fallback when body-part slug is missing. */
  fallbackIconName?: string;
}

export const HybridImage = memo(function HybridImage({
  uri,
  tint,
  iconName = 'dumbbell',
  style,
  contentFit = 'cover',
  iconRatio = 0.45,
  fallbackBodyPart,
  fallbackTint,
  fallbackIconName,
}: HybridImageProps) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState<boolean>(false);

  const handleError = useCallback(() => setFailed(true), []);

  // ★ 修复 FlashList 复用 bug：uri 变化时重置 failed 状态，否则上一张失败的卡片
  //   复用到新 uri 时永远显示占位图（shouldRenderImage 永远 false）
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  // Resolve the fallback tint.  Priority:
  //   1. explicit fallbackTint prop  2. original tint  3. colors.muscle[slug]  4. primary
  const resolvedTint: string =
    fallbackTint ||
    tint ||
    (fallbackBodyPart
      ? (colors.muscle as Record<string, string>)[fallbackBodyPart]
      : undefined) ||
    colors.primary;

  // Resolve the fallback icon similarly.
  let resolvedIcon = fallbackIconName ?? iconName ?? 'dumbbell';
  if (!fallbackIconName && fallbackBodyPart && (!iconName || iconName === 'dumbbell' || iconName === 'help-circle-outline')) {
    // Derive from constants via BODY_PART_LABELS if possible.
    // We don't want a circular import so we inline a tiny slug→icon map
    // that is guaranteed to match constants' canonical mapping.
    const BP_ICONS: Record<string, string> = {
      back: 'arm-flex-outline',
      cardio: 'run-fast',
      chest: 'heart-pulse',
      'lower arms': 'dumbbell',
      'lower legs': 'leg',
      neck: 'account-cowboy-hat-outline',
      shoulders: 'arm-flex-outline',
      'upper arms': 'dumbbell',
      'upper legs': 'leg',
      waist: 'weight-lifter',
    };
    resolvedIcon = BP_ICONS[fallbackBodyPart] || 'dumbbell';
  }

  const shouldRenderImage = !!uri && !failed;

  return (
    <View style={style}>
      <LocalImageCover
        tint={resolvedTint}
        iconName={resolvedIcon}
        style={StyleSheet.absoluteFill}
        iconRatio={iconRatio}
        circular
      />
      {shouldRenderImage && (
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          onError={handleError}
          recyclingKey={uri ?? undefined}
        />
      )}
    </View>
  );
});

// ============================================================================
// M1 gluestack-ui v2 MVP primitives — re-export from the ui/ barrel so
// every `import { Badge, useToast, HapticButton } from '@/components/UIKit'`
// keeps working transparently.
//
// NOTE: re-export must live AT THE BOTTOM so TSC sees type declarations
// (Badge, MiniTag, OptionPicker, etc.) from above before wildcard-import
// collides with the namespace.  ES2022 semantics: duplicate names from
// `export *` are silently dropped, so the legacy `Badge` / `MiniTag`
// signatures above take precedence and are NOT shadowed.
// ============================================================================
export * from './ui';

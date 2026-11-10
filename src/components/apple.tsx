import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useThemeColors,
  spacing,
  radius,
  typography,
  strokeFromColors,
  tint,
} from '@/theme';
import type { Colors } from '@/theme';
import { PressableScale, Icon } from '@/components/UIKit';
import { GlassSurface } from '@/components/ui/LiquidGlass';
import { safeHaptic } from '@/utils/haptic';

// ============================================================================
// CHOYEON GYM · Apple design primitives.
// Clean, calm, premium iOS-aligned building blocks: large titles, grouped
// inset cards, tinted buttons, disclosure rows, stat tiles. Consume
// useThemeColors() so they react to light/dark automatically.
// ============================================================================

type C = Colors;

// ----------------------------------------------------------------------------
// AppleHeader — iOS Large Title header.
// ----------------------------------------------------------------------------
export function AppleHeader({
  title,
  subtitle,
  right,
  large = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  large?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeHeaderStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text
          style={large ? styles.largeTitle : styles.title}
          numberOfLines={large ? 2 : 1}
        >
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function makeHeaderStyles(c: C) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    largeTitle: {
      flex: 1,
      minWidth: 0,
      ...typography.display,
      color: c.textPrimary,
      includeFontPadding: false,
    },
    title: {
      flex: 1,
      minWidth: 0,
      ...typography.h2,
      color: c.textPrimary,
    },
    right: { flexShrink: 0 },
    subtitle: {
      marginTop: spacing.xs,
      ...typography.sub,
      color: c.textSecondary,
    },
  });
}

// ----------------------------------------------------------------------------
// SectionLabel — uppercase tertiary eyebrow (iOS prefers this over number blocks).
// ----------------------------------------------------------------------------
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
      <Text
        style={{
          ...typography.label,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
        numberOfLines={1}
      >
        {children}
      </Text>
      {right}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Hairline — 1px separator between grouped rows.
// ----------------------------------------------------------------------------
export function Hairline() {
  const colors = useThemeColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceDivider, marginLeft: spacing.lg }} />;
}

// ----------------------------------------------------------------------------
// GroupedCard — iOS "Inset Grouped" card: white surface, hairline border,
// generous radius, subtle separation from the grouped background.
// ----------------------------------------------------------------------------
export function GroupedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const { frameStroke } = strokeFromColors(colors);
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ----------------------------------------------------------------------------
// GroupRow — a single disclosure-style row inside a GroupedCard.
// ----------------------------------------------------------------------------
export function GroupRow({
  title,
  subtitle,
  value,
  icon,
  iconTint,
  onPress,
  disclosure = true,
  trailing,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: string;
  iconTint?: string;
  onPress?: () => void;
  disclosure?: boolean;
  trailing?: React.ReactNode;
}) {
  const colors = useThemeColors();
  const Wrapper: any = onPress ? PressableScale : View;
  return (
    <Wrapper
      {...(onPress
        ? {
            onPress: () => {
              safeHaptic('light');
              onPress();
            },
            scaleTo: 0.98,
            accessibilityRole: 'button',
            accessibilityLabel: subtitle ? `${title}, ${subtitle}` : title,
            style: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
          }
        : { style: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md } })}
    >
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tint(iconTint ?? colors.primary, 'soft'),
          }}
        >
          <Icon name={icon as any} size={16} color={iconTint ?? colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ ...typography.body, color: colors.textPrimary }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={{ ...typography.caption, color: colors.textSecondary }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ ...typography.body, color: colors.textSecondary }} numberOfLines={1}>{value}</Text> : null}
      {trailing}
      {disclosure ? <Icon name="chevron-right" size={16} color={colors.textTertiary} /> : null}
    </Wrapper>
  );
}

// ----------------------------------------------------------------------------
// GroupedRows — iOS "Inset Grouped" list: a rounded surface card whose
// children are separated by uniform hairlines.  Automatically inserts the
// separator between children so callers never hand-roll dividers.
// ----------------------------------------------------------------------------
export function GroupedRows({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children).filter((c) => c !== null && c !== undefined);
  return (
    <GroupedCard style={[{ marginBottom: spacing.md }, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {child}
          {i < items.length - 1 ? <Hairline /> : null}
        </View>
      ))}
    </GroupedCard>
  );
}

// ----------------------------------------------------------------------------
// AppleButton — three iOS tiers: filled (primary bg), tinted (soft fill +
// colored text), plain (transparent + colored text).
// ----------------------------------------------------------------------------
export function AppleButton({
  title,
  onPress,
  variant = 'filled',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  fullWidth = true,
  haptic = 'medium',
}: {
  title?: string;
  onPress?: () => void;
  /** iOS 26: 'filled' = solid tinted, 'tinted'/'glass' = liquid-glass material. */
  variant?: 'filled' | 'tinted' | 'plain' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: 'light' | 'medium' | 'success' | 'warning';
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeButtonStyles(colors), [colors]);
  const padV = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.lg : spacing.md;

  // iOS 26 continuous curvature: buttons get rounder as they grow.
  const corner = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  const isGlass = variant === 'tinted' || variant === 'glass';

  const container: ViewStyle[] = [
    styles.base,
    { paddingVertical: padV, paddingHorizontal: spacing.lg, borderRadius: corner },
    fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
  ];
  const labelStyle: TextStyle[] = [styles.label];
  if (variant === 'filled') {
    container.push({ backgroundColor: disabled ? colors.surfaceElevated : colors.primary });
    labelStyle.push({ color: disabled ? colors.textTertiary : colors.textInverse });
  } else if (isGlass) {
    // Glass variant: the material carries the colour, not a flat fill.
    if (disabled) container.push({ backgroundColor: colors.surfaceElevated });
    labelStyle.push({ color: disabled ? colors.textTertiary : colors.primary });
  } else {
    container.push({ backgroundColor: 'transparent' });
    labelStyle.push({ color: disabled ? colors.textTertiary : colors.primary });
  }

  // Liquid-glass backdrop for the tinted / glass variants.
  const glassLayer =
    isGlass && !disabled ? (
      <GlassSurface
        borderRadius={corner}
        intensity={50}
        style={StyleSheet.absoluteFill}
        showEdge
      />
    ) : null;

  if (disabled) {
    return (
      <View
        style={container}
        accessibilityRole="button"
        accessibilityLabel={title ?? ''}
        accessibilityState={{ disabled: true }}
      >
        {icon ? <Icon name={icon as any} size={18} color={colors.textTertiary} /> : null}
        {title ? <Text style={labelStyle}>{title}</Text> : null}
        {iconRight ? <Icon name={iconRight as any} size={18} color={colors.textTertiary} /> : null}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={() => {
        safeHaptic(haptic);
        onPress?.();
      }}
      style={container}
      scaleTo={0.97}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title ?? ''}
      accessibilityState={{ disabled: false }}
    >
      {glassLayer}
      {icon ? <Icon name={icon as any} size={18} color={variant === 'filled' ? colors.textInverse : colors.primary} /> : null}
      {title ? <Text style={labelStyle}>{title}</Text> : null}
      {iconRight ? <Icon name={iconRight as any} size={18} color={variant === 'filled' ? colors.textInverse : colors.primary} /> : null}
    </PressableScale>
  );
}

function makeButtonStyles(c: C) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 44,
    },
    label: {
      ...typography.bodyBold,
      textAlign: 'center',
    },
  });
}

// ----------------------------------------------------------------------------
// StatTile — Apple-style metric card with a big number and a small label.
// ----------------------------------------------------------------------------
export function StatTile({
  value,
  label,
  accent,
  icon,
}: {
  value: string;
  label: string;
  accent?: string;
  icon?: string;
}) {
  const colors = useThemeColors();
  const { frameStroke } = strokeFromColors(colors);
  const a = accent ?? colors.primary;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: frameStroke,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      {icon ? (
        <Icon name={icon as any} size={18} color={a} />
      ) : null}
      <Text style={{ ...typography.h2, color: a, includeFontPadding: false }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textSecondary }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Pill — small rounded tag.
// ----------------------------------------------------------------------------
export function Pill({
  children,
  tintColor,
}: {
  children: React.ReactNode;
  tintColor?: string;
}) {
  const colors = useThemeColors();
  const t = tintColor ?? colors.primary;
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: tint(t, 'soft'),
      }}
    >
      <Text style={{ ...typography.captionBold, color: t }} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// AppleNavBar — iOS large-title navigation bar for screens that opt out of
// the native stack header (`headerShown: false`).
//
// Why this exists: several screens hide the native header in order to draw a
// custom large title, which also removed the only affordance for going back.
// HIG requires a persistent, discoverable back control.  This component
// restores it with the standard iOS chevron affordance while keeping the
// large-title typography.
// ----------------------------------------------------------------------------
export function AppleNavBar({
  title,
  onBack,
  right,
  large = true,
  style,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeNavBarStyles(colors), [colors]);
  const canGoBack = typeof onBack === 'function';
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        {canGoBack ? (
          <PressableScale
            onPress={() => {
              safeHaptic('light');
              onBack?.();
            }}
            scaleTo={0.9}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Icon name="chevron-left" size={26} color={colors.primary} />
          </PressableScale>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.right}>{right}</View>
      </View>
      <Text
        style={large ? styles.largeTitle : styles.title}
        numberOfLines={large ? 2 : 1}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
}

function makeNavBarStyles(c: C) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
      backgroundColor: c.bg,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 32,
      marginBottom: spacing.xs,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -spacing.sm,
    },
    backSpacer: { width: spacing.sm },
    right: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    largeTitle: {
      ...typography.display,
      color: c.textPrimary,
      includeFontPadding: false,
    },
    title: {
      ...typography.h1,
      color: c.textPrimary,
    },
  });
}

// ----------------------------------------------------------------------------
// Spinner — themed activity indicator.
// ----------------------------------------------------------------------------
export const AppleSpinner = memo(function AppleSpinner({ size = 'small' }: { size?: 'small' | 'large' }) {
  const colors = useThemeColors();
  return <ActivityIndicator size={size} color={colors.primary} />;
});

// ----------------------------------------------------------------------------
// Screen — universal page frame.  Wraps content in a safe-area background, a
// centered readable column (max 720pt — HIG: comfortable reading width on
// iPad / large phones) and an iOS-standard scroll container.  Pages keep their
// own inner layout; this guarantees consistent chrome across the whole app.
// ----------------------------------------------------------------------------
const MAX_CONTENT_WIDTH = 720;

export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomBar = 0,
  contentStyle,
  testID,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Extra bottom clearance for screens under a tab bar (e.g. 56). */
  bottomBar?: number;
  contentStyle?: ViewStyle;
  testID?: string;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const column = (
    <View
      style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}
      testID={testID}
    >
      {children}
    </View>
  );

  const bottomPad = insets.bottom + spacing.xl + bottomBar;

  if (!scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
        <View style={[{ flex: 1 }, contentStyle]}>{column}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          padded
            ? { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: bottomPad }
            : { paddingBottom: bottomPad },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {column}
      </ScrollView>
    </SafeAreaView>
  );
}

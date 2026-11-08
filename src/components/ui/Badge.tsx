import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useThemeColors, spacing, radius, tint, getFrameStroke } from '@/theme';

// ============================================================================
// Badge — compact tinted pill, variant-driven palette.
//
// 视觉一致性（v1.0.13 收口）：所有变体现统一取自 theme 语义色 +
// tint() 三档透明度，不再自带第二套 hex 调色板。此前 primary/info/accent
// 硬编码为 #BAFF2E / #4C9AFF / #FF7A59，与 theme 的 #BFF23D / #48C6FF /
// #FF6A3D 存在可见色差，导致同页 Badge 与按钮「绿得不一致」。
// ============================================================================

export type BadgeVariant =
  | 'primary'
  | 'info'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'dark'
  | 'outline';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface UIBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Optional MaterialCommunityIcons glyph rendered left of label. */
  icon?: string;
  /** Color override — takes precedence over variant color. */
  color?: string;
  /** Optional trailing component rendered on the right. */
  trailing?: React.ReactNode;
}

export const Badge: React.FC<UIBadgeProps> = function Badge({
  label,
  variant = 'primary',
  size = 'sm',
  icon,
  color,
  trailing,
}) {
  const colors = useThemeColors();

  // Resolve foreground / background / border color for the variant.
  // 统一走 tint() 三档体系，保证「同一语义色在任何组件里呈现一致」。
  const palette = useMemo(() => {
    if (color) {
      return {
        foreground: color,
        background: tint(color, 'soft'),
        border: tint(color, 'border'),
      };
    }
    const base = (() => {
      switch (variant) {
        case 'primary': return colors.primary;
        case 'info':    return colors.info;
        case 'accent':  return colors.accent;
        case 'success': return colors.success;
        case 'warning': return colors.warning;
        case 'error':   return colors.danger;
        default:        return null;
      }
    })();
    if (base) {
      return {
        foreground: base,
        background: tint(base, 'soft'),
        border: tint(base, 'border'),
      };
    }
    if (variant === 'dark') {
      return {
        foreground: colors.textPrimary,
        background: colors.surfaceElevated,
        border: getFrameStroke(colors.bg === '#07090C'),
      };
    }
    // outline
    return {
      foreground: colors.textSecondary,
      background: 'transparent',
      border: colors.surfaceBorder,
    };
  }, [variant, color, colors]);

  // Resolve size geometry: padding, font-size, icon-size, corner radius.
  const geom = useMemo<{
    padH: number;
    padV: number;
    gap: number;
    fontSize: number;
    lineHeight: number;
    iconSize: number;
    borderRadius: number;
  }>(() => {
    switch (size) {
      case 'xs':
        return { padH: spacing.sm, padV: spacing.xs, gap: spacing.xs, fontSize: 10, lineHeight: 14, iconSize: 10, borderRadius: radius.sm };
      case 'sm':
        return { padH: spacing.sm, padV: spacing.xs, gap: spacing.xs, fontSize: 11, lineHeight: 14, iconSize: 11, borderRadius: radius.sm };
      case 'md':
      default:
        return { padH: spacing.md, padV: spacing.sm, gap: spacing.sm, fontSize: 12, lineHeight: 16, iconSize: 12, borderRadius: radius.md };
    }
  }, [size]);

  const styles = useMemo(() => StyleSheet.create({
    wrap: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: geom.padH,
      paddingVertical: geom.padV,
      gap: geom.gap,
      borderRadius: geom.borderRadius,
      borderWidth: 1,
      backgroundColor: palette.background,
      borderColor: palette.border,
    },
    label: {
      fontSize: geom.fontSize,
      lineHeight: geom.lineHeight,
      fontWeight: '800' as const,
      letterSpacing: 0.1,
      color: palette.foreground,
    },
  }), [geom, palette]);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {icon ? (
        <MaterialCommunityIcons
          name={icon as any}
          size={geom.iconSize}
          color={palette.foreground}
        />
      ) : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
    </View>
  );
};

export default Badge;

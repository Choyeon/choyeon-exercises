import React, {
  forwardRef,
  memo,
  useCallback,
  useMemo,
} from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { safeHaptic } from '@/utils/haptic';

// ============================================================================
// HapticButton — PressableScale wrapper with expo-haptics impact.
//
// Haptic style is mapped from `variant`:
//   primary      → light  (quick tap, default CTA)
//   accent       → medium (stronger affirmative)
//   destructive  → heavy  (irreversible actions — delete, reset progress)
//   ghost        → light  (same as primary, low weight)
//
// The underlying press animation uses the same spring constants as
// UIKit's PressableScale (mass 0.55 / stiffness 420 / damping 24) so
// tactile feel is consistent across legacy & new UI.
// ============================================================================

export type HapticButtonVariant =
  | 'primary'
  | 'accent'
  | 'destructive'
  | 'ghost'
  | 'outline';

export interface HapticButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label?: string;
  /** Left-side MaterialCommunityIcons glyph. */
  icon?: string;
  /** Right-side MaterialCommunityIcons glyph (e.g. chevrons). */
  iconRight?: string;
  variant?: HapticButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** If false, skips haptic. Default true. Callers set false for "taps inside
   *  interactive cards" where the card already fires haptic. */
  haptic?: boolean;
  /** Override the text color (only used for ghost/outline variants). */
  tint?: string;
  /** Full-width variant — sets alignSelf: stretch. */
  fullWidth?: boolean;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.55,
  stiffness: 420,
  damping: 24,
  overshootClamping: true,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function hapticStyleFor(variant: HapticButtonVariant): 'light' | 'medium' | 'heavy' {
  switch (variant) {
    case 'destructive': return 'heavy';
    case 'accent':      return 'medium';
    case 'primary':
    case 'ghost':
    case 'outline':
    default:            return 'light';
  }
}

const HapticButtonInner = memo(
  forwardRef<View, HapticButtonProps>(function HapticButton(
    {
      label,
      icon,
      iconRight,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      style,
      children,
      haptic = true,
      tint,
      fullWidth,
      onPress,
      onPressIn,
      onPressOut,
      hitSlop,
      accessibilityLabel,
      accessibilityRole = 'button',
      accessibilityState,
      ...rest
    },
    ref
  ) {
    const colors = useThemeColors();
    const scale = useSharedValue(1);

    // Resolve token colors for the variant
    const palette = useMemo(() => {
      switch (variant) {
        case 'accent':
          return {
            bg: colors.accent,
            border: colors.accent,
            text: colors.textInverse,
          };
        case 'destructive':
          return {
            bg: colors.danger,
            border: colors.danger,
            text: colors.textInverse,
          };
        case 'ghost':
          return {
            bg: 'transparent',
            border: 'transparent',
            text: tint ?? colors.textPrimary,
          };
        case 'outline':
          return {
            bg: 'transparent',
            border: tint ?? colors.surfaceBorder,
            text: tint ?? colors.textPrimary,
          };
        case 'primary':
        default:
          return {
            bg: colors.primary,
            border: colors.primary,
            text: colors.textInverse,
          };
      }
    }, [variant, tint, colors]);

    // Size geometry
    const geom = useMemo(() => {
      switch (size) {
        case 'sm':
          return { padH: spacing.sm, padV: spacing.sm, font: 13, icon: 14, gap: 6 };
        case 'lg':
          return { padH: spacing.xl, padV: spacing.md + 2, font: 17, icon: 20, gap: spacing.sm };
        case 'md':
        default:
          return { padH: spacing.lg, padV: spacing.md, font: 15, icon: 18, gap: spacing.sm };
      }
    }, [size]);

    const btnStyle = useMemo(() => StyleSheet.create({
      base: {
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: geom.gap,
        paddingHorizontal: geom.padH,
        paddingVertical: geom.padV,
        borderRadius: size === 'sm' ? radius.md : radius.lg,
        borderWidth: 1,
        backgroundColor: palette.bg,
        borderColor: palette.border,
        opacity: disabled || loading ? 0.5 : 1,
      },
      label: {
        ...typography.bodyBold,
        fontSize: geom.font,
        color: palette.text,
        letterSpacing: -0.05,
      },
    }), [fullWidth, geom, size, palette, disabled, loading, palette.text]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback((e: any) => {
      scale.value = withSpring(0.965, SPRING_CFG);
      onPressIn?.(e);
    }, [scale, onPressIn]);

    const handlePressOut = useCallback((e: any) => {
      scale.value = withSpring(1, SPRING_CFG);
      onPressOut?.(e);
    }, [scale, onPressOut]);

    const handlePress = useCallback((e: any) => {
      if (disabled || loading) return;
      if (haptic) safeHaptic(hapticStyleFor(variant));
      onPress?.(e);
    }, [disabled, loading, haptic, variant, onPress]);

    return (
      <AnimatedPressable
        ref={ref as any}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={hitSlop}
        disabled={disabled || loading}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled: disabled || loading, busy: loading, ...accessibilityState }}
        accessibilityLabel={accessibilityLabel ?? label}
        {...rest}
      >
        <Animated.View style={[btnStyle.base, animatedStyle, style as any]}>
          {loading ? (
            <View style={styles_spinner.dot(palette.text)} pointerEvents="none" />
          ) : icon ? (
            <MaterialCommunityIcons name={icon as any} size={geom.icon} color={palette.text} />
          ) : null}
          {label ? (
            <Text style={btnStyle.label} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
          {children}
          {iconRight ? (
            <MaterialCommunityIcons name={iconRight as any} size={geom.icon} color={palette.text} />
          ) : null}
        </Animated.View>
      </AnimatedPressable>
    );
  })
);

const styles_spinner = {
  dot: (color: string): ViewStyle => ({
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  }),
};

export const HapticButton = HapticButtonInner;
export default HapticButton;

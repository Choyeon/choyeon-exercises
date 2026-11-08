import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View, I18nManager } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useThemeColors, radius } from '@/theme';
import { safeHaptic } from '@/utils/haptic';

// ============================================================================
// Switch — custom controlled toggle, NOT the built-in RN Switch (which
// renders with native defaults we can't style to match the neo-brutalist
// 1.5px stroke + tokens.primary500 thumb color requirement).
// ============================================================================

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Override active track color.  Default = theme tokens.primary500. */
  activeTrackColor?: string;
  /** Override active thumb color (defaults to white / textInverse). */
  activeThumbColor?: string;
  /** Optional accessibility label. */
  accessibilityLabel?: string;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.5,
  stiffness: 420,
  damping: 26,
  overshootClamping: true,
};

// Measured dimensions — shared with styles and translate math.
const TRACK_W = 50;
const TRACK_H = 30;
const PADDING = 3;
const THUMB_SIZE = TRACK_H - PADDING * 2;  // 24
const THUMB_TRANSLATE_ON = TRACK_W - THUMB_SIZE - PADDING; // 50 - 24 - 3 = 23

export const Switch: React.FC<SwitchProps> = function Switch({
  value,
  onValueChange,
  disabled = false,
  activeTrackColor,
  activeThumbColor,
  accessibilityLabel,
}) {
  const colors = useThemeColors();
  // 视觉一致性：激活轨道色统一走 theme.primary（原硬编码 #BAFF2E 与主题 #BFF23D 有色差）
  const accent = activeTrackColor ?? colors.primary;
  const thumbOn  = activeThumbColor ?? colors.textInverse;

  const position = useSharedValue(value ? THUMB_TRANSLATE_ON : PADDING);

  useEffect(() => {
    const target = value ? THUMB_TRANSLATE_ON : PADDING;
    position.value = withSpring(target, SPRING_CFG);
  }, [value, position]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    safeHaptic('light');
    onValueChange(!value);
  }, [disabled, onValueChange, value]);

  const s = useMemo(() => StyleSheet.create({
    track: {
      width: TRACK_W,
      height: TRACK_H,
      borderRadius: radius.pill,
      justifyContent: 'center',
      padding: PADDING,
      borderWidth: 1.5,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: radius.pill,
      backgroundColor: colors.textInverse,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
  }), [colors]);

  const trackAnimated = useAnimatedStyle(() => {
    // Interpolate background color smoothly between off and on.
    // Interpolating hex strings directly is sketchy; we use a step at ~50%
    // driven by position progress so it snaps to the "on" color once the
    // thumb passes the midpoint (perceptually identical to a fade and
    // cheap on the UI thread).
    const progress = (position.value - PADDING) / (THUMB_TRANSLATE_ON - PADDING);
    return {
      backgroundColor: progress > 0.5 ? accent : colors.surfaceElevated,
      borderColor:       progress > 0.5 ? accent : colors.surfaceBorder,
      opacity: disabled ? 0.45 : 1,
    };
  });

  const thumbAnimated = useAnimatedStyle(() => {
    const progress = (position.value - PADDING) / (THUMB_TRANSLATE_ON - PADDING);
    return {
      transform: [{ translateX: position.value - PADDING }],
      backgroundColor: progress > 0.5 ? thumbOn : colors.textPrimary,
    };
  });

  const isRTL = I18nManager.isRTL;

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      // ★ 修复可触摸区域：保证最小 48×48px (Material Design / WCAG 2.5.5)
      //   track 为 50×30，纵向 hitSlop=9 → 30+18=48px 达标
      hitSlop={{ top: 9, bottom: 9, left: 8, right: 8 }}
    >
      <Animated.View style={[s.track, trackAnimated, isRTL && styles_rtl.flipX]}>
        <Animated.View style={[s.thumb, thumbAnimated]} />
      </Animated.View>
    </Pressable>
  );
};

const styles_rtl = StyleSheet.create({
  flipX: { transform: [{ scaleX: -1 }] },
});

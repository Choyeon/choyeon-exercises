import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import {
  useThemeColors,
  typography,
} from '@/theme';

// ============================================================================
// ProgressRing — circular SVG progress indicator.
//
// Implementation notes:
//  • Uses react-native-svg Circle + strokeDashoffset trick for the fill.
//  • Animated with react-native-reanimated's useAnimatedProps so the
//    percentage animates smoothly on the native UI thread.
//  • Size is configurable via the `size` prop (square box).
// ============================================================================

export interface ProgressRingProps {
  /** 0 — 100, clamped internally. */
  value: number;
  /** Outer size (width = height). Default 64. */
  size?: number;
  /** Stroke width. Default 6. */
  strokeWidth?: number;
  /** Foreground fill color — defaults to primary. */
  color?: string;
  /** Optional second color to create a gradient fill. */
  colorEnd?: string;
  /** Background track color — defaults to surfaceElevated. */
  trackColor?: string;
  /** If true, an integer `X%` label renders in the center. */
  showLabel?: boolean;
  /** Override center label (useful for "12/20" style counts). */
  label?: string;
  /** Label color override. */
  labelColor?: string;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.55,
  stiffness: 240,
  damping: 20,
  overshootClamping: true,
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing: React.FC<ProgressRingProps> = function ProgressRing({
  value,
  size = 64,
  strokeWidth = 5,
  color,
  colorEnd,
  trackColor,
  showLabel = false,
  label,
  labelColor,
}) {
  const colors = useThemeColors();
  const clamped = Math.max(0, Math.min(100, value));
  const accent = color ?? colors.primary;
  const accentEnd = colorEnd ?? accent;
  const track = trackColor ?? colors.surfaceElevated;
  const txtColor = labelColor ?? colors.textPrimary;

  // v1.1 token spec: main progress strokeWidth max 5, track stroke max 1
  const mainStroke = Math.min(5, Math.max(1, strokeWidth));
  const trackStroke = Math.max(1, Math.round(mainStroke * 0.28));

  // Circle math
  const radius = (size - mainStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(clamped, SPRING_CFG);
  }, [clamped, progress]);

  const animatedProps = useAnimatedProps(() => {
    const offset = circumference * (1 - progress.value / 100);
    return {
      strokeDashoffset: offset,
    };
  });

  const showGradient = accentEnd !== accent;

  const labelFontSize = useMemo(() => {
    if (size >= 96) return 22;
    if (size >= 64) return 15;
    if (size >= 48) return 12;
    return 10;
  }, [size]);

  const gradId = `pg_${accent}_${accentEnd}`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {showGradient ? (
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%"  stopColor={accent} />
              <Stop offset="100%" stopColor={accentEnd} />
            </LinearGradient>
          </Defs>
        ) : null}
        {/* track — thin 1px stroke per v1.1 visual-token spec */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={track}
          strokeWidth={trackStroke}
          fill="none"
        />
        {/* progress fill */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={showGradient ? `url(#${gradId})` : accent}
          strokeWidth={mainStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          rotation={-90}
          originX={cx}
          originY={cy}
          animatedProps={animatedProps}
        />
      </Svg>
      {showLabel || label ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.labelWrap}>
            <Text
              style={[
                styles.label,
                {
                  color: txtColor,
                  fontSize: labelFontSize,
                  lineHeight: labelFontSize + 2,
                },
              ]}
            >
              {label ?? `${Math.round(clamped)}%`}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});

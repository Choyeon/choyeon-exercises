import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig } from 'react-native-reanimated';
import { useEffect } from 'react';
import {
  useThemeColors,
  spacing,
  typography,
} from '@/theme';

// ============================================================================
// Progress — horizontal progress bar 0-100.
// ============================================================================

export interface ProgressProps {
  /** 0 — 100.  Clamped internally. */
  value: number;
  /** Total bar height in px. Default 8. */
  height?: number;
  /** Fill color override — defaults to colors.primary. */
  color?: string;
  /** Track color override — defaults to surfaceElevated. */
  trackColor?: string;
  /** Optional label rendered INSIDE the filled part when space allows. */
  label?: string;
  /** Corner radius override (default pill). */
  rounded?: number;
  /** Optional accessibility label. */
  accessibilityLabel?: string;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.5,
  stiffness: 260,
  damping: 18,
  overshootClamping: true };

export const Progress: React.FC<ProgressProps> = function Progress({
  value,
  height = 6,
  color,
  trackColor,
  label,
  rounded,
  accessibilityLabel }) {
  const colors = useThemeColors();
  const clamped = Math.max(0, Math.min(100, value));
  const accent = color ?? colors.primary;
  const track = trackColor ?? colors.surfaceElevated;
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withSpring(clamped, SPRING_CFG);
  }, [clamped, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value}%` }));

  // v1.1 token spec: height max 6px, borderRadius always pill (999 → match half-height)
  const barHeight = Math.min(6, Math.max(2, height));
  const r = rounded ?? 999;

  const styles = useMemo(() => StyleSheet.create({
    track: {
      width: '100%',
      height: barHeight,
      borderRadius: r,
      backgroundColor: track,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceDivider },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      borderRadius: r,
      backgroundColor: accent,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm },
    label: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.textInverse,
      letterSpacing: 0.2 } }), [accent, colors, barHeight, r, track]);

  return (
    <View
      style={styles.track}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={accessibilityLabel}
    >
      <Animated.View style={[styles.fill, fillStyle]}>
        {label && clamped > 18 ? <Text style={styles.label}>{label}</Text> : null}
      </Animated.View>
    </View>
  );
};

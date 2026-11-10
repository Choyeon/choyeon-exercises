import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { safeHaptic } from '@/utils/haptic';
import { GlassSurface } from './LiquidGlass';

// ============================================================================
// SegmentedControl — iOS-style N-option pill selector.
//
// • Uses a "slab track + sliding highlight pill" approach so the active
//   indicator animates with spring physics when the index changes.
// • Layout is self-measuring via onLayout: the highlight pill's width and
//   translateX come from the measured widths of each segment, so the
//   component works equally well with 2, 3, or 5 segments of unequal label
//   length (no fixed per-segment widths required).
// • Accessibility: each segment is a "radio" inside a tablist, with the
//   proper `selected` state so screen readers announce it correctly.
// ============================================================================

export interface SegmentedControlOption<T extends string | number> {
  label: string;
  value: T;
  /** Optional MaterialCommunityIcons glyph rendered left of label. */
  icon?: string;
  /** Optional accessibility override for the label (e.g. long form). */
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string | number> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (next: T, index: number) => void;
  disabled?: boolean;
  /** Highlight color override. Default tokens.primary500. */
  highlightColor?: string;
  /** Highlight text color when the segment is selected. Default textInverse. */
  highlightTextColor?: string;
  /** Overall container override (width etc.). Default flex:1 behavior. */
  style?: ViewStyle;
  /** Track (unselected background) color override. */
  trackColor?: string;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.55,
  stiffness: 360,
  damping: 24,
  overshootClamping: true,
};

// Typed implementation — we make T-parametric via the helper pattern so
// callers get `SegmentedControlProps<T>` inference instead of `any`.
function SegmentedControlImpl<T extends string | number>(
  props: SegmentedControlProps<T>
) {
  const {
    options,
    value,
    onChange,
    disabled = false,
    highlightColor,
    highlightTextColor,
    style,
    trackColor,
  } = props;

  const colors = useThemeColors();
  const isDark = colors.bg === '#000000';
  // iOS 26: the track is a liquid-glass capsule and the selected segment is
  // a floating glass block that lifts out of it — no flat colour fill.
  const accent = highlightColor ?? colors.primary;
  const activeText = highlightTextColor ?? accent;

  const selectedIndex = options.findIndex((o) => o.value === value);

  // Measurement state — each segment stores its measured width so the
  // highlight pill can resize + slide.
  const [widths, setWidths] = useState<number[]>(() => options.map(() => 0));
  const [gap] = useState(spacing.xs); // internal gap between segments

  const selectedTranslate = useSharedValue(0);
  const selectedWidth = useSharedValue(0);

  const handleLayout = useCallback((idx: number) => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w <= 0) return;
    setWidths((prev) => {
      if (Math.abs(prev[idx] - w) < 0.5) return prev;
      const next = prev.slice();
      next[idx] = w;
      return next;
    });
  }, []);

  // Compute the current highlight rect any time measurements or selection
  // changes, then feed the shared values through a spring.
  // Using React.useMemo-like effect for shared values.
  React.useEffect(() => {
    if (selectedIndex < 0) return;
    // target x = sum of widths for segments 0..i-1 + gap * i
    let x = 0;
    for (let i = 0; i < selectedIndex; i++) x += (widths[i] || 0) + gap;
    const w = widths[selectedIndex] || 0;
    selectedTranslate.value = withSpring(x, SPRING_CFG);
    selectedWidth.value     = withSpring(w, SPRING_CFG);
  }, [selectedIndex, widths, gap, selectedTranslate, selectedWidth]);

  const highlightAnimated = useAnimatedStyle(() => ({
    transform: [{ translateX: selectedTranslate.value }],
    width: selectedWidth.value,
  }));

  const handleSelect = useCallback((opt: SegmentedControlOption<T>, idx: number) => {
    if (disabled) return;
    if (opt.value === value) return;
    safeHaptic('selection');
    onChange(opt.value, idx);
  }, [disabled, value, onChange]);

  const s = useMemo(() => StyleSheet.create({
    track: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.pill,
      padding: spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: trackColor ?? colors.surfaceElevated,
    },
    highlight: {
      position: 'absolute',
      top: spacing.xs,
      bottom: spacing.xs,
      left: spacing.xs,
      borderRadius: radius.pill - 2,
      // iOS 26 selected segment = floating glass block, not a solid fill.
      backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.12,
      shadowRadius: 10,
      elevation: isDark ? 4 : 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)',
    },
    segment: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      zIndex: 2,
      minWidth: 44,
    },
    label: {
      ...typography.captionBold,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
    },
  }), [accent, colors, trackColor, isDark]);

  return (
    <GlassSurface
      borderRadius={radius.pill}
      intensity={45}
      style={[s.track, style]}
      role="tablist"
      accessibilityRole="tablist"
    >
      {/* Highlight block sits UNDER the segments. */}
      <Animated.View
        pointerEvents="none"
        style={[s.highlight, highlightAnimated]}
      />
      {options.map((opt, idx) => {
        const selected = idx === selectedIndex;
        return (
          <Pressable
            key={String(opt.value)}
            onLayout={handleLayout(idx)}
            onPress={() => handleSelect(opt, idx)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            style={[s.segment]}
            hitSlop={6}
          >
            <SegmentContent
              label={opt.label}
              selected={selected}
              selectedText={activeText}
              defaultText={colors.textSecondary}
              selectedTextBold={colors.textPrimary}
              textStyle={s.label}
              disabled={disabled}
            />
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

// Inner content helper — keeps the Pressable's style prop tree simple and
// lets us memoize label rendering per segment.
function SegmentContent(props: {
  label: string;
  selected: boolean;
  selectedText: string;
  defaultText: string;
  selectedTextBold: string;
  textStyle: any;
  disabled: boolean;
}) {
  const { label, selected, selectedText, defaultText, textStyle, disabled } = props;
  const color = selected
    ? selectedText
    : disabled
    ? defaultText + '99'
    : defaultText;
  return (
    <Text
      style={[
        textStyle,
        { color },
        selected && { opacity: 1 },
        !selected && { fontWeight: '600' },
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
}

// Generic type-safe wrapper.  The `as unknown as` cast restores the
// parametric signature that React.FC (which always accepts `any` props)
// drops.  Safe because the impl is already parametric.
type SegmentedControlComponent = <T extends string | number>(
  p: SegmentedControlProps<T>
) => React.ReactElement | null;

export const SegmentedControl =
  SegmentedControlImpl as unknown as SegmentedControlComponent & {
    displayName?: string;
  };
(SegmentedControl as any).displayName = 'SegmentedControl';

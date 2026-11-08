import React, { useMemo, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';
import { useThemeColors } from '@/theme';

// ============================================================================
// Skeleton — shimmer placeholder with a single, dependency-free animation.
//
// Technique:
//  • A flat SVG <Rect> sits under the box (matches width/height/radius).
//  • A LinearGradient "sweep" moves across the box using a translateX
//    driven by react-native-reanimated.  No third-party skeleton lib —
//    the shimmer is a 3-stop gradient interpolated between three colors.
//
// The caller controls geometry via {width,height,borderRadius} props; we
// only guarantee the animation.  `width` defaults to '100%' so skeletons
// expand to fit a container (typical list-row placeholder pattern).
// ============================================================================

export interface SkeletonProps {
  /** Height in px.  Required so the row has definite size. */
  height: number;
  /** Width in px or string percent. Default `'100%'`. */
  width?: number | string;
  /** Corner radius in px. Default 8. */
  borderRadius?: number;
  /** Optional style override (margin/padding, etc.). */
  style?: any;
  /** If true, disables animation (static flat color). Useful for reduce-motion. */
  static?: boolean;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const SHIMMER_DURATION_MS = 1400;

// ---------------------------------------------------------------------------
// Color helpers — blend a base hex color with white/black at a given alpha.
// Used to keep skeleton shimmer delta ≤ 8% contrast (no blinding flashes).
// Accepts #RRGGBB; ignores short-form / rgba — skeleton theme tokens
// are always #RRGGBB so this branch is safe.
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const s = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${s(r)}${s(g)}${s(b)}`;
}
function blendWithWhite(hex: string, alpha: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * alpha, g + (255 - g) * alpha, b + (255 - b) * alpha);
  } catch { return hex; }
}
function blendWithBlack(hex: string, alpha: number): string {
  try {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - alpha), g * (1 - alpha), b * (1 - alpha));
  } catch { return hex; }
}

export const Skeleton: React.FC<SkeletonProps> = function Skeleton({
  height,
  width = '100%',
  borderRadius = 8,
  style,
  static: isStatic = false,
}) {
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();

  // Evaluate string widths like "100%" to pixel values for the SVG layer
  // that animates the gradient sweep.  numeric widths pass through.
  const boxWidthPx = useMemo(() => {
    if (typeof width === 'number') return width;
    // width is a percent — use layout width as a fallback approximation.
    // Callers passing percent widths usually want "full container", which
    // is approximately the screen minus padding in our layout.
    return screenWidth - 32;
  }, [width, screenWidth]);

  // Three stop colours drawn from the current theme palette:
  //  base → +8% delta highlight → base.
  // The "shimmer" illusion comes from sliding this band horizontally.
  // Delta kept at 8% (max) per v1.1 visual-token spec — avoids the
  // "blinding flash" that 15%+ contrast skeletons produce on dark themes.
  const { cA, cB, cC } = useMemo(() => {
    const base = colors.surfaceElevated;
    const isDark = colors.bg === '#07090C';
    // shimmer highlight = base + 8% opacity white (dark) / + 8% opacity black (light)
    // on top of base.  We approximate with the nearest theme token that is
    // at most ~8% delta from surfaceElevated: surfaceDivider is ~4% delta
    // which is conservative, then we nudge with a +0.08 overlay-style hex.
    const hi = isDark
      ? blendWithWhite(base, 0.08)
      : blendWithBlack(base, 0.08);
    return {
      cA: base,
      cB: hi,
      cC: base,
    };
  }, [colors]);

  // Animation driver: value goes 0 → 1, repeats forever, linear timing.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isStatic) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite repeat
      false // no reverse — sweep comes back to start after the end
    );
    return () => {
      // ★ 修复：卸载时取消无限循环动画，避免后台持续消耗 CPU
      cancelAnimation(progress);
      progress.value = 0;
    };
  }, [progress, isStatic]);

  const animatedSvgStyle = useAnimatedStyle(() => {
    if (isStatic) return {};
    // We animate the x-offset of the gradient band.
    // The gradient is 2.5× the box width wide; we sweep it from
    // -boxWidthPx → +boxWidthPx so the shimmer highlight appears to
    // travel across the entire visible skeleton.
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [-boxWidthPx, boxWidthPx],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateX }] };
  });

  const outerStyles = useMemo(() => [
    {
      width,
      height,
      borderRadius,
      overflow: 'hidden' as const,
      backgroundColor: cA,
      borderWidth: 1,
      borderColor: colors.surfaceDivider,
    },
    style,
  ], [width, height, borderRadius, cA, colors.surfaceDivider, style]);

  // SVG internal sweep band width = 2.5 × box.  Starts offscreen-left
  // and ends offscreen-right.  We render the SVG larger than the box
  // and clip with `overflow: hidden` on the outer View.
  const sweepW = boxWidthPx * 2.5;
  const sweepH = Math.max(1, height);

  return (
    <View style={outerStyles} aria-busy aria-live="polite">
      {!isStatic ? (
        <AnimatedSvg
          width={sweepW}
          height={sweepH}
          style={[StyleSheet.absoluteFill, animatedSvgStyle, { width: sweepW, left: -boxWidthPx }]}
        >
          <Defs>
            <LinearGradient id="skeletonShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%"   stopColor={cA} stopOpacity={1} />
              <Stop offset="45%"  stopColor={cB} stopOpacity={1} />
              <Stop offset="55%"  stopColor={cB} stopOpacity={1} />
              <Stop offset="100%" stopColor={cC} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={sweepW}
            height={sweepH}
            fill="url(#skeletonShimmer)"
            rx={0}
            ry={0}
          />
        </AnimatedSvg>
      ) : null}
    </View>
  );
};

export default Skeleton;

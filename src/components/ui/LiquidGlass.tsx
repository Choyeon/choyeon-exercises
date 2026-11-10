import React, { memo, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { Role } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
// Android 原生液态玻璃（expo-android-glass-view）：Jetpack Compose 渲染真实折射 /
// 模糊 / 晕彩 / 高光，直接采样同一窗口内 RN 画面作为背板，零权限、零自绘。
import { AndroidGlassView } from 'expo-android-glass-view';
import { useThemeColors, useIsDark } from '@/theme';

// ============================================================================
// iOS 26 · Liquid Glass primitives
// ----------------------------------------------------------------------------
// Rendering strategy, in priority order:
//
//   1. NATIVE LIQUID GLASS — iOS 26+ renders `expo-glass-effect`'s GlassView,
//      the real system material: it refracts whatever sits behind it, morphs
//      when the user presses it, and picks up the ambient light.
//
//   2. BLUR FALLBACK — older iOS gets expo-blur's BlurView (real backdrop
//      blur, but without refraction).
//
//   3. TINT FALLBACK — Android cannot blur sibling views, so the material is
//      reproduced with a translucent directional fill that mimics the way
//      light bends through the glass.
//
// On top of that, every platform gets the two signature details drawn by us:
// the bright specular rim (SVG gradient stroke) and the swelling lens behind
// a selected control (radial specular blob) — the iOS 26 "morphing" look.
// ============================================================================

export const glassRadius = {
  capsule: 34,
  control: 22,
  card: 26,
  chip: 18,
} as const;

/** True when the device can render the native iOS 26 liquid glass material. */
export function nativeLiquidGlassAvailable(): boolean {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** True when the native Android liquid glass view is usable. */
export function androidLiquidGlassAvailable(): boolean {
  try {
    return Platform.OS === 'android' && !!AndroidGlassView;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// GlassSurface — the material itself.
// ----------------------------------------------------------------------------
export const GlassSurface = memo(function GlassSurface({
  borderRadius = glassRadius.capsule,
  style,
  children,
  intensity = 60,
  tint,
  showEdge = true,
  fill,
  interactive = false,
  accessibilityLabel,
  accessible,
  accessibilityRole,
  role,
}: {
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Blur strength (iOS < 26 fallback, 0-100). */
  intensity?: number;
  /** Force the blur tint; defaults to light/dark depending on theme. */
  tint?: 'light' | 'dark';
  showEdge?: boolean;
  /** Override the translucent fill gradient (used by the non-native fallbacks). */
  fill?: readonly [string, string, ...string[]];
  /** Native glass reacts to presses (iOS 26 interactive material). */
  interactive?: boolean;
  accessibilityLabel?: string;
  accessible?: boolean;
  /** ARIA role forwarded to the underlying view. */
  role?: Role;
  /** RN accessibility role forwarded to the underlying view. */
  accessibilityRole?: 'none' | 'tablist' | 'button' | 'tab' | 'radio' | 'search' | 'summary' | 'image';
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const nativeGlass = nativeLiquidGlassAvailable();
  const blurTint = tint ?? (dark ? 'dark' : 'light');

  const fillColors = useMemo<readonly [string, string, ...string[]]>(() => {
    if (fill) return fill;
    // Light mode: milky glass.  Dark mode: deep smoked glass.
    // Android cannot blur sibling views, so the fallback has to be denser than
    // the real material — otherwise the content behind the capsule bleeds
    // through and destroys legibility.
    return dark
      ? ['rgba(30,30,34,0.95)', 'rgba(16,16,20,0.97)', 'rgba(24,24,28,0.96)']
      : ['rgba(252,252,254,0.93)', 'rgba(250,250,253,0.86)', 'rgba(255,255,255,0.90)'];
  }, [fill, dark]);

  const edgeOpacity = dark ? 0.34 : 0.85;

  // ---- native path -------------------------------------------------------
  if (nativeGlass) {
    return (
      <View
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        role={role}
        accessibilityRole={accessibilityRole}
        style={[{ borderRadius, overflow: 'hidden' }, style]}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive={interactive}
          colorScheme={dark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {showEdge ? <GlassRim borderRadius={borderRadius} opacity={edgeOpacity * 0.55} /> : null}
        {children}
      </View>
    );
  }

  // ---- Android native liquid glass ---------------------------------------
  // expo-android-glass-view renders the real thing with Jetpack Compose:
  // it samples what is drawn behind the view in the same window and refracts
  // it (blur + chromatic aberration + specular rim), so the material reacts
  // to the scrolling content underneath.
  if (androidLiquidGlassAvailable()) {
    return (
      <View
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        role={role}
        accessibilityRole={accessibilityRole}
        style={[{ borderRadius, overflow: 'hidden' }, style]}
      >
        <AndroidGlassView
          theme={dark ? 'dark' : 'light'}
          cornerRadius={borderRadius}
          blurRadius={9}
          refractionHeight={2}
          refractionAmount={3}
          tintColor={dark ? '#0B0B0F' : '#FFFFFF'}
          surfaceColor={dark ? '#2A2A2E' : '#F2F2F7'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {showEdge ? <GlassRim borderRadius={borderRadius} opacity={edgeOpacity} /> : null}
        {children}
      </View>
    );
  }

  // ---- fallback path (older iOS / Android without the native module) ------
  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      role={role}
      accessibilityRole={accessibilityRole}
      style={[{ borderRadius, overflow: 'hidden' }, style]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <LinearGradient
        colors={fillColors as unknown as [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {showEdge ? <GlassRim borderRadius={borderRadius} opacity={edgeOpacity} /> : null}

      {children}
    </View>
  );
});

// ----------------------------------------------------------------------------
// GlassRim — the bright specular edge of iOS 26 glass, plus a hint of
// chromatic dispersion on the fallback material.
// ----------------------------------------------------------------------------
const GlassRim = memo(function GlassRim({
  borderRadius,
  opacity,
  dispersion = false,
}: {
  borderRadius: number;
  opacity: number;
  dispersion?: boolean;
}) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id="glassEdge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={opacity} />
          <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={opacity * 0.22} />
          <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity={opacity * 0.42} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={opacity * 0.8} />
        </SvgLinearGradient>
      </Defs>
      {dispersion ? (
        <>
          <Rect
            x={-0.5}
            y={-0.5}
            width="100%"
            height="100%"
            rx={borderRadius}
            fill="none"
            stroke="#FF6B8A"
            strokeWidth={0.6}
            opacity={0.25}
          />
          <Rect
            x={1.5}
            y={1.5}
            width="100%"
            height="100%"
            rx={borderRadius}
            fill="none"
            stroke="#5AC8FA"
            strokeWidth={0.6}
            opacity={0.22}
          />
        </>
      ) : null}
      <Rect
        x={0.5}
        y={0.5}
        width="99%"
        height="99%"
        rx={borderRadius}
        fill="none"
        stroke="url(#glassEdge)"
        strokeWidth={1}
      />
    </Svg>
  );
});

// ----------------------------------------------------------------------------
// LiquidLens — specular blob that makes a control look like it bulges out of
// the glass.  Used behind the selected tab item (iOS 26 morphing behaviour).
// ----------------------------------------------------------------------------
export const LiquidLens = memo(function LiquidLens({
  size = 46,
  color = '#007AFF',
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`lens-${color}`} cx="50%" cy="32%" r="68%">
          <Stop offset="0" stopColor={color} stopOpacity={0.42 * opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.2 * opacity} />
          <Stop offset="0.78" stopColor={color} stopOpacity={0.05 * opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`lensSpec-${color}`} cx="50%" cy="22%" r="42%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55 * opacity} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#lens-${color})`} />
      <Ellipse cx="50%" cy="26%" rx="38%" ry="26%" fill={`url(#lensSpec-${color})`} />
    </Svg>
  );
});

// ----------------------------------------------------------------------------
// GlassDivider — hairline that fades out, like the etched separators inside
// iOS 26 glass menus.
// ----------------------------------------------------------------------------
export const GlassDivider = memo(function GlassDivider({
  inset = 0,
  color,
}: {
  inset?: number;
  color?: string;
}) {
  const c = useThemeColors();
  return (
    <View
      pointerEvents="none"
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: color ?? c.surfaceDivider,
      }}
    />
  );
});

import {
  StyleSheet,
  Dimensions,
  Platform,
  Appearance,
} from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { AppSettings } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// CHOYEON GYM — Apple Human Interface design system.
//
// Semantic, iOS-aligned palette: systemBlue as the primary brand accent,
// full system color ramps for semantic states, iOS label/separator/fill
// tiers, and an SF-style type scale with Apple's signature negative tracking.
// No neo-brutalist strokes, no neon. Clean, calm, premium.
// ============================================================================

export type Colors = {
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceBorder: string;
  surfaceDivider: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  primary: string;
  primaryHover: string;
  primaryDim: string;
  primaryStroke: string;
  accent: string;
  accentDim: string;
  accentStroke: string;
  info: string;
  infoDim: string;
  success: string;
  warning: string;
  danger: string;
  muscle: {
    back: string;
    cardio: string;
    chest: string;
    'lower arms': string;
    'lower legs': string;
    neck: string;
    shoulders: string;
    'upper arms': string;
    'upper legs': string;
    waist: string;
  };
};

// ============================================================================
// DARK palette — iOS "Dark" system colors.
// Background is true black with grouped gray; cards are secondary system
// background (#1C1C1E); labels are white with opacity tiers.
// ============================================================================
export const darkColors: Colors = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfaceBorder: 'rgba(84,84,88,0.60)',
  surfaceDivider: 'rgba(84,84,88,0.60)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(235,235,245,0.60)',
  textTertiary: 'rgba(235,235,245,0.30)',
  textInverse: '#FFFFFF',
  primary: '#0A84FF',
  primaryHover: '#409CFF',
  primaryDim: 'rgba(10,132,255,0.24)',
  primaryStroke: 'rgba(10,132,255,0.50)',
  accent: '#FF9F0A',
  accentDim: 'rgba(255,159,10,0.20)',
  accentStroke: 'rgba(255,159,10,0.50)',
  info: '#64D2FF',
  infoDim: 'rgba(100,210,255,0.20)',
  success: '#30D158',
  warning: '#FFD60A',
  danger: '#FF453A',
  muscle: {
    back: '#FF453A',
    cardio: '#FF375F',
    chest: '#30D158',
    'lower arms': '#FF9F0A',
    'lower legs': '#BF5AF2',
    neck: '#64D2FF',
    shoulders: '#0A84FF',
    'upper arms': '#FFD60A',
    'upper legs': '#5E5CE6',
    waist: '#FF6482' } } as Colors;

// ============================================================================
// LIGHT palette — iOS "Light" system colors.
// Grouped background (#F2F2F7), white cards, black labels with opacity tiers.
// ============================================================================
export const lightColors: Colors = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceBorder: 'rgba(60,60,67,0.29)',
  surfaceDivider: 'rgba(60,60,67,0.29)',
  textPrimary: '#000000',
  textSecondary: 'rgba(60,60,67,0.60)',
  textTertiary: 'rgba(60,60,67,0.30)',
  textInverse: '#FFFFFF',
  primary: '#007AFF',
  primaryHover: '#3399FF',
  primaryDim: 'rgba(0,122,255,0.12)',
  primaryStroke: 'rgba(0,122,255,0.40)',
  accent: '#FF9500',
  accentDim: 'rgba(255,149,0,0.12)',
  accentStroke: 'rgba(255,149,0,0.40)',
  info: '#5AC8FA',
  infoDim: 'rgba(90,200,250,0.14)',
  success: '#34C759',
  warning: '#FFCC00',
  danger: '#FF3B30',
  muscle: {
    back: '#FF3B30',
    cardio: '#FF2D55',
    chest: '#34C759',
    'lower arms': '#FF9500',
    'lower legs': '#AF52DE',
    neck: '#5AC8FA',
    shoulders: '#007AFF',
    'upper arms': '#FFCC00',
    'upper legs': '#5856D6',
    waist: '#FF6482' } } as Colors;

// ============================================================================
// Backwards-compatible default — keeps `import { colors } from '@/theme'`
// working in modules that still need the static dark palette for non-render
// contexts (e.g., default values).  Render components MUST use
// `useThemeColors()` so they react to setting/theme changes.
// ============================================================================
export const colors = darkColors;

// ============================================================================
// Theme resolution
// ============================================================================

function normalizeScheme(
  scheme: string | null | undefined
): 'light' | 'dark' | null {
  if (scheme === 'light' || scheme === 'dark') return scheme;
  return null;
}

function resolveFromSetting(
  theme: AppSettings['theme'],
  systemScheme: 'light' | 'dark' | null
): Colors {
  if (theme === 'light') return lightColors;
  if (theme === 'dark') return darkColors;
  return systemScheme === 'light' ? lightColors : darkColors;
}

export function getResolvedTheme(theme: AppSettings['theme']): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  const scheme = Appearance.getColorScheme();
  return scheme === 'light' ? 'light' : 'dark';
}

// ============================================================================
// React Context + Hook
// ============================================================================

const ThemeCtx = createContext<Colors>(darkColors);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.settings.theme);
  const [resolved, setResolved] = useState<Colors>(() => {
    const scheme = normalizeScheme(Appearance.getColorScheme());
    return resolveFromSetting(theme, scheme);
  });

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setResolved(resolveFromSetting(theme, normalizeScheme(colorScheme)));
    });
    // Also resolve immediately when the user's `theme` preference changes
    // (e.g. they toggle from "dark" to "system").
    setResolved(resolveFromSetting(theme, normalizeScheme(Appearance.getColorScheme())));
    return () => listener.remove();
  }, [theme]);

  return <ThemeCtx.Provider value={resolved}>{children}</ThemeCtx.Provider>;
}

export function useThemeColors(): Colors {
  return useContext(ThemeCtx);
}

/**
 * True when the resolved palette is the dark one.
 * 单一判定口径：暗色背景为纯黑（#000000），与 strokeFromColors 保持一致。
 */
export function useIsDark(): boolean {
  return useContext(ThemeCtx).bg === '#000000';
}

// ============================================================================
// Shared tokens — NOT theme-dependent.  These stay as plain constants because
// typography/spacing/radius/layout rarely change between themes.
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  xxxxl: 56 } as const;

// iOS text-style scale (SF Pro). Apple uses tight negative tracking on larger
// sizes and a 17pt body / 17pt headline baseline.
export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 41 },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
    lineHeight: 34 },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 28 },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 25 },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.2,
    lineHeight: 22 },
  bodyBold: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 22 },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18 },
  captionBold: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18 },
  small: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.4 },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.2 },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: -0.2 },
  sub: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: -0.1 },
  micro: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 13,
    letterSpacing: 0.3 },
  mono: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 21,
    letterSpacing: 0.2 } };

// iOS corner radii: 10 for controls, 14–20 for cards/sheets.
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999 } as const;

// ============================================================================
// 标准视觉令牌 — Apple 柔和描边/阴影统一规范。
// 任何 screen / component 自定义样式必须使用下列函数，不得硬编码纯 #FFFFFF/#000000 描边
// 或 shadowOpacity≥0.6 / shadowRadius≥8 / diagonal offset 的写法。
// ============================================================================

/** frameStroke — 普通卡片/容器描边：使用 iOS separator 色阶。 */
export function getFrameStroke(isDark: boolean): string {
  return isDark ? 'rgba(84,84,88,0.60)' : 'rgba(60,60,67,0.29)';
}

/** accentStroke — 主 CTA / 序号块等高识别度元素：40%不透明度 accent 色描边 */
export function getAccentStroke(accent: string): string {
  return accent + '66';
}

/**
 * softShadow — 统一柔和阴影标准（Apple 风格，极轻）：
 * shadowColor 永远 '#000'
 * shadowOffset 永远 {width:0, height:2} 仅向下
 * shadowRadius 8
 * shadowOpacity  dark=0.35 / light=0.10
 */
export function getSoftShadow(isDark: boolean) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 } as { width: number; height: number },
    shadowRadius: 8,
    shadowOpacity: isDark ? 0.35 : 0.1,
    elevation: isDark ? 3 : 2 };
}

/** 与 Colors 对象绑定的便捷版 — 直接从 colors.bg 判断 dark/light（Apple 暗色背景为真黑） */
export function strokeFromColors(colors: Colors) {
  const isDark = colors.bg === '#000000';
  return {
    frameStroke: getFrameStroke(isDark),
    accentStroke: getAccentStroke(colors.primary),
    softShadow: getSoftShadow(isDark),
    isDark };
}

// ============================================================================
// 语义色板块 — 统一三档填充体系，杜绝组件各自硬编码第二套调色板。
// ============================================================================

/** 语义色的三档填充：subtle(8%) / soft(14%) / border(38%) / strong(66%) */
export function tint(color: string, level: 'subtle' | 'soft' | 'border' | 'strong') {
  const alpha = level === 'subtle' ? '08' : level === 'soft' ? '14' : level === 'border' ? '38' : '66';
  return color + alpha;
}

/**
 * 肌群色映射的唯一出口，映射至 Apple system 色板，保证全 App 取色一致。
 */
export function muscleColor(c: Colors, bodyPart?: string | null): string {
  if (!bodyPart) return c.primary;
  const table = c.muscle as unknown as Record<string, string | undefined>;
  return table[bodyPart] ?? c.primary;
}

/**
 * 语义色映射 —— 把「语义名」映射到当前主题的实际色值。
 */
export function semanticColors(c: Colors) {
  return {
    primary: c.primary,
    info: c.info,
    accent: c.accent,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    neutral: c.textSecondary } as const;
}

export type SemanticName = keyof ReturnType<typeof semanticColors>;

/**
 * 模态遮罩色 —— 全 App 统一。iOS 使用半透明黑，暗色略深。
 */
export function getScrim(isDark: boolean): string {
  return isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.40)';
}

export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 } } as const;

export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  maxContentWidth: 720,
  tabBarHeight: Platform.OS === 'ios' ? 88 : 70,
  statusBarInset: Platform.OS === 'ios' ? 44 : 0,
  safeBottom: Platform.OS === 'ios' ? 34 : 0,
  paddingHorizontal: spacing.lg,
  // iOS 26 floating glass tab bar — the capsule hovers above the content,
  // so scrollable pages must reserve: bottom inset + gap + capsule + breathing.
  floatingTabBar: {
    height: 60,
    bottomGap: 10,
    contentGap: 22 },
} as const;

// ============================================================================
// Convenience: default dark global styles.  Render components should recreate
// these with useMemo when using useThemeColors().  Kept here for legacy.
// ============================================================================
export function createGlobalStyles(c: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    screenContent: {
      paddingHorizontal: layout.paddingHorizontal,
      // NOTE: 若页面在 (tabs) Tab 导航下，请改用页面内 useSafeAreaInsets().bottom 动态计算 bottomPad。
      // 这里是 legacy 兜底：layout.tabBarHeight (静态) + 额外 32px buffer + lg 防止 OEM 导航条溢出。
      paddingBottom: layout.tabBarHeight + spacing.xxl + spacing.lg },
    surfaceCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    column: { flexDirection: 'column' },
    center: { alignItems: 'center', justifyContent: 'center' },
    divider: {
      height: 1,
      backgroundColor: c.surfaceDivider,
      marginVertical: spacing.md },
    spacer: { height: spacing.lg },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface },
    chipSelected: {
      backgroundColor: c.primaryDim,
      borderColor: c.primary },
    primaryButton: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center' },
    primaryButtonText: { color: c.textInverse, ...typography.bodyBold },
    ghostButton: {
      backgroundColor: 'transparent',
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    textPrimary: { color: c.textPrimary },
    textSecondary: { color: c.textSecondary },
    textAccent: { color: c.primary },
    flex1: { flex: 1 } });
}

export const globalStyles = createGlobalStyles(darkColors);

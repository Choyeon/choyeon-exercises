import { StyleSheet, Dimensions, Platform, Appearance } from 'react-native';
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { AppSettings } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// DARK palette — original industrial gym aesthetic.  Steel slabs, neon lime
// CTA, rust accent for "active / hot" states.  No pastel gradients, no soft
// glassmorphism, no playful rounded corners.
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

export const darkColors: Colors = {
  bg: '#07090C',
  surface: '#0F1319',
  surfaceElevated: '#171D28',
  surfaceBorder: '#252C3B',
  surfaceDivider: '#1A202D',
  textPrimary: '#EEF1F6',
  textSecondary: '#8A92A6',
  textTertiary: '#515A6E',
  textInverse: '#07090C',
  primary: '#BFF23D',
  primaryHover: '#CFF76A',
  primaryDim: 'rgba(191, 242, 61, 0.14)',
  primaryStroke: 'rgba(191, 242, 61, 0.35)',
  accent: '#FF6A3D',
  accentDim: 'rgba(255, 106, 61, 0.14)',
  accentStroke: 'rgba(255, 106, 61, 0.35)',
  info: '#48C6FF',
  infoDim: 'rgba(72, 198, 255, 0.12)',
  success: '#3BD17C',
  warning: '#F5B543',
  danger: '#EF4545',
  muscle: {
    back: '#FF6A3D',
    cardio: '#48C6FF',
    chest: '#BFF23D',
    'lower arms': '#F5B543',
    'lower legs': '#C061FF',
    neck: '#F272AC',
    shoulders: '#34D399',
    'upper arms': '#FB923C',
    'upper legs': '#5D9CFF',
    waist: '#A78BFA',
  },
} as Colors;

// ============================================================================
// LIGHT palette — same accent family so the app keeps its gym identity.
// Backgrounds inverted to off-white/white, borders softened, high contrast
// for readability on light hardware.
// ============================================================================

export const lightColors: Colors = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF1F5',
  surfaceBorder: '#D9DEE6',
  surfaceDivider: '#E7EBF1',
  textPrimary: '#101418',
  textSecondary: '#586172',
  textTertiary: '#919AA9',
  textInverse: '#FFFFFF',
  primary: '#8AC01A',
  primaryHover: '#7AAA15',
  primaryDim: 'rgba(138, 192, 26, 0.14)',
  primaryStroke: 'rgba(138, 192, 26, 0.35)',
  accent: '#E54C20',
  accentDim: 'rgba(229, 76, 32, 0.12)',
  accentStroke: 'rgba(229, 76, 32, 0.32)',
  info: '#2E9EDD',
  infoDim: 'rgba(46, 158, 221, 0.12)',
  success: '#169A54',
  warning: '#D89A1C',
  danger: '#D43030',
  muscle: {
    back: '#D64A1C',
    cardio: '#2E9EDD',
    chest: '#8AC01A',
    'lower arms': '#C4830F',
    'lower legs': '#9447D2',
    neck: '#D85092',
    shoulders: '#168B5B',
    'upper arms': '#D06D20',
    'upper legs': '#3F75C2',
    waist: '#7B63CB',
  },
} as Colors;

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
  xxxxl: 56,
} as const;

export const typography = {
  display: {
    fontSize: 36,
    fontWeight: '900' as const,
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  h1: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '500' as const,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '800' as const,
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '800' as const,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 20,
    fontWeight: '800' as const,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  micro: {
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 12,
    letterSpacing: 0.3,
  },
  mono: {
    fontSize: 16,
    fontWeight: '800' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

// ============================================================================
// 标准视觉令牌 — v1.0.12「柔和描边/阴影」统一规范。
// 任何 screen / component 自定义样式必须使用下列函数，不得硬编码纯 #FFFFFF/#000000 描边
// 或 shadowOpacity≥0.6 / shadowRadius≥8 / diagonal offset 的 neo-brutalist 写法。
// ============================================================================

/** frameStroke — 普通卡片/容器描边：dark 28%白 / light 10%黑。不区分主题的「通用柔和描边」 */
export function getFrameStroke(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.28)' : 'rgba(16,20,24,0.10)';
}

/** accentStroke — 主 CTA / 序号块等高识别度元素：40%不透明度 accent 色描边 */
export function getAccentStroke(accent: string): string {
  return accent + '66';
}

/**
 * softShadow — 统一柔和阴影标准：
 * shadowColor 永远 '#000'
 * shadowOffset 永远 {width:0, height:2} 仅向下
 * shadowRadius 永远 6
 * shadowOpacity  dark=0.55 / light=0.18
 */
export function getSoftShadow(isDark: boolean) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 } as { width: number; height: number },
    shadowRadius: 6,
    shadowOpacity: isDark ? 0.55 : 0.18,
    elevation: isDark ? 4 : 2,
  };
}

/** 与 Colors 对象绑定的便捷版 — 直接从 colors.bg 判断 dark/light */
export function strokeFromColors(colors: Colors) {
  const isDark = colors.bg === '#07090C';
  return {
    frameStroke: getFrameStroke(isDark),
    accentStroke: getAccentStroke(colors.primary),
    softShadow: getSoftShadow(isDark),
    isDark,
  };
}

// ============================================================================
// 语义色板块 — v1.0.13「视觉一致性」收口。
//
// 问题：Badge / HapticButton 等基础组件曾各自硬编码一套「近似但不等价」的调色
// 板（#BAFF2E / #4C9AFF / #FF7A59），与 theme 的 primary / info / accent
// （#BFF23D / #48C6FF / #FF6A3D）存在肉眼可辨的色差。结果是同一个页面里
// Badge 的绿和按钮的绿不是同一种绿，整体显得廉价、不统一。
//
// 解决方案：把「填充档」统一为 `语义色 + 透明度后缀` 的三档体系，
// 任何组件都从这里取色，杜绝再出现第二套调色板。
// ============================================================================

/** 语义色的三档填充：subtle(8%) / soft(14%) / border(38%) */
export function tint(color: string, level: 'subtle' | 'soft' | 'border' | 'strong') {
  const alpha = level === 'subtle' ? '08' : level === 'soft' ? '14' : level === 'border' ? '38' : '66';
  return color + alpha;
}

/**
 * 肌群色映射的唯一出口。
 *
 * 之前 `colors.muscle[bodyPart] ?? colors.primary` 这个表达式散落在
 * Home / Library / 详情页 / 训练执行页 / 热身页等 8+ 个文件里，各自的兜底
 * 还不一样（有的兜 primary、有的兜 chest、有的直接写死 hex），同一肌群在
 * 不同页面呈现不同颜色。统一到这个函数后所有页面取色一致。
 */
export function muscleColor(c: Colors, bodyPart?: string | null): string {
  if (!bodyPart) return c.primary;
  const table = c.muscle as unknown as Record<string, string | undefined>;
  return table[bodyPart] ?? c.primary;
}

/**
 * 语义色映射 —— 把「语义名」映射到当前主题的实际色值。
 * 组件应使用 `semanticColors(colors).primary` 而非硬编码 hex。
 */
export function semanticColors(c: Colors) {
  return {
    primary: c.primary,
    info: c.info,
    accent: c.accent,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    neutral: c.textSecondary,
  } as const;
}

export type SemanticName = keyof ReturnType<typeof semanticColors>;

/**
 * 模态遮罩色 —— 全 App 统一。dark 用 62% 纯黑（保留深处墨感），
 * light 用 45% 中性黑（避免在浅色界面上过重）。此前各屏幕自己写
 * rgba(7,9,12,0.62) / rgba(0,0,0,0.45) / rgba(0,0,0,0.10) 三种不同值。
 */
export function getScrim(isDark: boolean): string {
  return isDark ? 'rgba(7,9,12,0.62)' : 'rgba(16,20,24,0.42)';
}

export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.55, shadowRadius: 6, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.55, shadowRadius: 6, elevation: 6 },
} as const;

export const layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  maxContentWidth: 720,
  tabBarHeight: Platform.OS === 'ios' ? 88 : 70,
  statusBarInset: Platform.OS === 'ios' ? 44 : 0,
  safeBottom: Platform.OS === 'ios' ? 34 : 0,
  paddingHorizontal: spacing.lg,
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
      paddingBottom: layout.tabBarHeight + spacing.xxl + spacing.lg,
    },
    surfaceCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    column: { flexDirection: 'column' },
    center: { alignItems: 'center', justifyContent: 'center' },
    divider: {
      height: 1,
      backgroundColor: c.surfaceDivider,
      marginVertical: spacing.md,
    },
    spacer: { height: spacing.lg },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface,
    },
    chipSelected: {
      backgroundColor: c.primaryDim,
      borderColor: c.primary,
    },
    primaryButton: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: c.textInverse, ...typography.bodyBold },
    ghostButton: {
      backgroundColor: 'transparent',
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    textPrimary: { color: c.textPrimary },
    textSecondary: { color: c.textSecondary },
    textAccent: { color: c.primary },
    flex1: { flex: 1 },
  });
}

export const globalStyles = createGlobalStyles(darkColors);

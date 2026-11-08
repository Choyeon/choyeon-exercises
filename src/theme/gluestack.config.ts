import { createConfig } from '@gluestack-ui/themed';

/**
 * ⚠️ DEPRECATED — 未接入任何 Provider，当前为死代码（dead config）。
 *
 * 本文件是早期 gluestack-ui v2 迁移尝试的遗留产物。项目最终未采用 gluestack，
 * `GluestackUIProvider` 在 app/ 与 src/ 中均无挂载点，本 config 也无任何 import。
 *
 * 风险：此处保留了一套与 src/theme/index.tsx「近似但不等价」的调色板
 * （#BAFF2E vs 主题 #BFF23D），一旦被误引入会重新造成全 App 色漂。
 *
 * 请勿从此文件取色。所有设计令牌以 src/theme/index.tsx 为准。
 * 保留文件仅为不破坏历史引用；确认无引用后可整体删除。
 */
const DARK_STROKE = 'rgba(255,255,255,0.28)';

const primary = {
  50:  '#F3FFD1',
  100: '#E8FFA8',
  200: '#DCFF7A',
  300: '#CCFF4D',
  400: '#BAFF2E', // semantic primary500-ish base — editorial green
  500: '#BAFF2E', // ← token used for active fills (primary500)
  600: '#A3E020',
  700: '#86BC16',
  800: '#69970E',
  900: '#4E7308',
  950: '#334E03',
};

const info = {
  50:  '#E6F0FF',
  100: '#CCE1FF',
  200: '#99C3FF',
  300: '#66A6FF',
  400: '#4C9AFF', // semantic info base
  500: '#4C9AFF',
  600: '#2E7DE0',
  700: '#1F62B8',
  800: '#134A90',
  900: '#0A3569',
  950: '#052245',
};

const accent = {
  50:  '#FFEBE3',
  100: '#FFD5C4',
  200: '#FFB59A',
  300: '#FF9573',
  400: '#FF7A59', // semantic accent base
  500: '#FF7A59',
  600: '#F05C37',
  700: '#D24421',
  800: '#AB3214',
  900: '#7E220B',
  950: '#541405',
};

const success = {
  50:  '#DEF7E9',
  500: '#3BD17C',
  600: '#29B364',
  700: '#1C8E4F',
};

const warning = {
  50:  '#FDF1D8',
  500: '#F5B543',
  600: '#D9981C',
  700: '#B07A0E',
};

const error = {
  50:  '#FCE1E1',
  500: '#EF4545',
  600: '#D32E2E',
  700: '#AE1D1D',
};

const dark = {
  50:  '#10151C',
  100: '#1A212C',
  200: '#252C3B',
  300: '#333C4F',
  400: '#445066',
  500: '#07090C',
  600: '#050608',
  700: '#030405',
  800: '#020203',
  900: '#010101',
};

// Surface / text tokens — pulled directly from src/theme so the two
// theming systems (useThemeColors + gluestack StyledProvider) agree.
const textDark = {
  50:  '#FFFFFF', // inverse text
  100: '#EEF1F6', // primary
  200: '#C6CCD8',
  300: '#8A92A6', // secondary
  400: '#515A6E', // tertiary
  500: '#3A4152',
  600: '#272C38',
  700: '#171B24',
  800: '#0C0F14',
  900: '#07090C',
};

const borderDark = {
  50:  DARK_STROKE,
  100: DARK_STROKE,
  200: '#252C3B', // surfaceBorder from theme
  300: '#1A202D', // surfaceDivider
  400: '#0F1319',
  500: '#07090C',
};

const backgroundDark = {
  50:  '#07090C', // bg
  100: '#0F1319', // surface
  200: '#171D28', // surfaceElevated
  300: '#1A202D',
  400: '#252C3B',
  500: '#07090C',
  600: '#050608',
};

// Light-theme equivalents — same structure so switching color mode is
// type-safe and predictable even if we default to "dark" in the MVP.
const textLight = {
  50:  '#07090C', // inverse
  100: '#101418', // primary
  200: '#333A47',
  300: '#586172', // secondary
  400: '#919AA9', // tertiary
  500: '#B3BAC5',
  600: '#D0D5DD',
  700: '#E7EBF1',
  800: '#F4F6F9',
  900: '#FFFFFF',
};

const borderLight = {
  50:  'rgba(0,0,0,0.10)',
  100: 'rgba(0,0,0,0.16)',
  200: '#D9DEE6', // surfaceBorder light
  300: '#E7EBF1', // surfaceDivider light
  400: '#F4F6F9',
  500: '#FFFFFF',
};

const backgroundLight = {
  50:  '#F4F6F9', // bg light
  100: '#FFFFFF', // surface
  200: '#EEF1F5', // surfaceElevated
  300: '#D9DEE6',
  400: '#C0C7D1',
  500: '#F4F6F9',
  600: '#FFFFFF',
  700: '#FFFFFF',
  800: '#FFFFFF',
  900: '#FFFFFF',
};

// Spacing mirrors src/theme spacing 1:1 so PressableScale paddings,
// card gaps, SectionHeader margins render identically whether built
// with StyleSheet or gluestack `$space.*` tokens.
const space = {
  'xs':   4,
  'sm':   8,
  'md':   12,
  'lg':   16,
  'xl':   20,
  '2xl':  28,
  '3xl':  40,
  '4xl':  56,
  // gluestack-style convention — numeric aliases so `$1` etc. work
  '0':    0,
  '0.5':  2,
  '1':    4,
  '1.5':  6,
  '2':    8,
  '2.5':  10,
  '3':    12,
  '3.5':  14,
  '4':    16,
  '5':    20,
  '6':    24,
  '7':    28,
  '8':    32,
  '9':    36,
  '10':   40,
  '12':   48,
  '16':   64,
  '20':   80,
  '24':   96,
  '32':   128,
  '40':   160,
  '48':   192,
  '56':   224,
  '64':   256,
  '72':   288,
  '80':   320,
  '96':   384,
};

const radius = {
  'none': 0,
  'xs':   4,
  'sm':   6,   // theme.radius.sm
  'md':   10,  // theme.radius.md
  'lg':   14,  // theme.radius.lg
  'xl':   18,  // theme.radius.xl
  '2xl':  24,
  '3xl':  32,
  'full': 999, // pill
  // numeric gluestack aliases
  '0':    0,
  '1':    2,
  '2':    4,
  '3':    6,
  '4':    8,
  '5':    12,
  '6':    16,
  '7':    20,
  '8':    26,
  '9':    34,
};

// Typography scale matches src/theme/typography exactly.  We expose
// "fonts" as the family name (system-defaults, no custom font import
// required for MVP), then map fontWeight / fontSize onto named keys.
const fonts = {
  heading: undefined as string | undefined,
  body:    undefined as string | undefined,
  mono:    undefined as string | undefined,
  custom:  undefined as string | undefined,
};

const fontWeights = {
  hairline: '100' as const,
  thin:     '200' as const,
  light:    '300' as const,
  normal:   '400' as const,
  medium:   '500' as const,  // body
  semibold: '600' as const,
  bold:     '700' as const,  // h3
  extrabold:'800' as const,  // bodyBold / captionBold
  black:    '900' as const,  // display / h1 / h2
};

const fontSizes = {
  '2xs': 10,  // size:'xs' label → ~10
  'xs':  11,  // small / mini-tag
  'sm':  13,  // caption
  'md':  15,  // body
  'lg':  17,  // h3
  'xl':  18,
  '2xl': 22,  // h2
  '3xl': 28,  // h1
  '4xl': 36,  // display
  '5xl': 44,
  '6xl': 56,
};

const lineHeights = {
  'xs':  14,
  'sm':  18,
  'md':  20,
  'lg':  22,
  'xl':  28,
  '2xl': 34,
  '3xl': 40,
  '4xl': 48,
};

const letterSpacings = {
  'xs':  0.2,
  'sm':  0.6,
  'md': -0.1,
  'lg': -0.2,
  'xl': -0.4,
  '2xl':-0.6,
  '3xl':-1.2,
};

// Gluestack semantic tokens — each resolves to the token above so light
// and dark modes each share the SAME structural keys (required by the
// StyledProvider type).  Callers write `$textLight500` etc. in gluestack
// styled() definitions, not the raw hex.
export const GSConfig = createConfig({
  tokens: {
    colors: {
      // Primary family (neo-brutalist editorial soft-lime)
      primary50:  primary[50],
      primary100: primary[100],
      primary200: primary[200],
      primary300: primary[300],
      primary400: primary[400],
      primary500: primary[500],
      primary600: primary[600],
      primary700: primary[700],
      primary800: primary[800],
      primary900: primary[900],
      primary950: primary[950],

      // Info family (editorial blue)
      info50:  info[50],
      info100: info[100],
      info200: info[200],
      info300: info[300],
      info400: info[400],
      info500: info[500],
      info600: info[600],
      info700: info[700],
      info800: info[800],
      info900: info[900],
      info950: info[950],

      // Accent family (warm orange)
      accent50:  accent[50],
      accent100: accent[100],
      accent200: accent[200],
      accent300: accent[300],
      accent400: accent[400],
      accent500: accent[500],
      accent600: accent[600],
      accent700: accent[700],
      accent800: accent[800],
      accent900: accent[900],
      accent950: accent[950],

      // Semantic success / warning / error
      success50:  success[50],
      success500: success[500],
      success600: success[600],
      success700: success[700],
      warning50:  warning[50],
      warning500: warning[500],
      warning600: warning[600],
      warning700: warning[700],
      error50:    error[50],
      error500:   error[500],
      error600:   error[600],
      error700:   error[700],

      // Dark base tokens
      dark50:  dark[50],
      dark100: dark[100],
      dark200: dark[200],
      dark300: dark[300],
      dark400: dark[400],
      dark500: dark[500],
      dark600: dark[600],
      dark700: dark[700],
      dark800: dark[800],
      dark900: dark[900],

      // Backdrop + overlay transparency helpers
      backdrop:   'rgba(7,9,12,0.65)',
      backdropDim:'rgba(7,9,12,0.45)',

      // White / black catch-alls
      white: '#FFFFFF',
      black: '#000000',

      // Text family (semantic; aligned with theme/index textLight)
      text0:   textLight[900],
      text50:  textLight[700],
      text100: textLight[100],
      text200: textLight[200],
      text300: textLight[300],
      text400: textLight[400],
      text500: textLight[500],
      text600: textLight[600],
      text700: textLight[700],
      text800: textLight[800],
      text900: textLight[900],
      text950: '#07090C',
      // textLight* aliases so themes can reference by explicit token name
      textLight0:   textLight[900],
      textLight50:  textLight[700],
      textLight100: textLight[100],
      textLight200: textLight[200],
      textLight300: textLight[300],
      textLight400: textLight[400],
      textLight500: textLight[500],
      textLight600: textLight[600],
      textLight700: textLight[700],
      textLight800: textLight[800],
      textLight900: textLight[900],

      // Background family (semantic)
      bg0:   backgroundLight[900],
      bg50:  backgroundLight[700],
      bg100: backgroundLight[100],
      bg200: backgroundLight[200],
      bg300: backgroundLight[300],
      bg400: backgroundLight[400],
      bg500: backgroundLight[500],
      bg600: backgroundLight[600],
      bg700: backgroundLight[700],
      bg800: backgroundLight[800],
      bg900: backgroundLight[900],
      bg950: backgroundLight[900],

      // Border / stroke tokens (1.5px soft-stroke spec from v1.0.12)
      border50:  DARK_STROKE,
      border100: DARK_STROKE,
      border200: 'rgba(255,255,255,0.20)',
      border300: 'rgba(255,255,255,0.14)',
      border400: 'rgba(255,255,255,0.08)',
      border500: 'rgba(255,255,255,0.04)',
    },
    space,
    borderWidths: {
      '0':   0,
      '0.5': 0.5,
      '1':   1,
      '1.5': 1.5,  // ← matches v1.0.12 soft-stroke thickness
      '2':   2,
      '4':   4,
      '8':   8,
    },
    radii: radius,
    breakpoints: {
      base: 0,
      sm: 480,
      md: 768,
      lg: 992,
      xl: 1280,
    },
    mediaQueries: {
      base: '@media screen and (min-width: 0)',
      sm:   '@media screen and (min-width: 480px)',
      md:   '@media screen and (min-width: 768px)',
      lg:   '@media screen and (min-width: 992px)',
      xl:   '@media screen and (min-width: 1280px)',
    },
    letterSpacings,
    lineHeights,
    fontWeights,
    fonts,
    fontSizes,
  },

  // Per-theme token overrides — keyed directly by category (NOT nested
  // under a `tokens:` wrapper, which violates ThemeStyles<T> shape).
  // Used by gluestack-style's `useToken()` + `StyledProvider` when it
  // flips colorMode.  Dark strokes use rgba(255,255,255,0.28) per the
  // v1.0.12 stroke specification.
  themes: {
    light: {
      colors: {
        textLight0:   textLight[900],
        textLight50:  textLight[700],
        textLight100: textLight[100],
        textLight200: textLight[200],
        textLight300: textLight[300],
        textLight400: textLight[400],
        textLight500: textLight[500],
        textLight600: textLight[600],
        textLight800: textLight[800],
        textLight900: textLight[900],

        textDark0:   textDark[900],
        textDark50:  textDark[50],
        textDark100: textDark[100],
        textDark200: textDark[200],
        textDark300: textDark[300],
        textDark400: textDark[400],
        textDark500: textDark[500],
        textDark600: textDark[600],
        textDark800: textDark[800],
        textDark900: textDark[900],

        text0:   textLight[900],
        text50:  textLight[700],
        text100: textLight[100],
        text200: textLight[200],
        text300: textLight[300],
        text400: textLight[400],
        text500: textLight[500],

        border0:   borderLight[500],
        border50:  borderLight[50],
        border100: borderLight[100],
        border200: borderLight[200],
        border300: borderLight[300],
        border400: borderLight[400],

        bg0:   backgroundLight[500],
        bg50:  backgroundLight[50],
        bg100: backgroundLight[100],
        bg200: backgroundLight[200],
        bg300: backgroundLight[300],
        bg400: backgroundLight[400],
        bg500: backgroundLight[500],
      },
    },
    dark: {
      colors: {
        textLight0:   textLight[900],
        textLight50:  textLight[700],
        textLight100: textLight[100],
        textLight200: textLight[200],
        textLight300: textLight[300],
        textLight400: textLight[400],
        textLight500: textLight[500],
        textLight600: textLight[600],
        textLight800: textLight[800],
        textLight900: textLight[900],

        textDark0:   textDark[900],
        textDark50:  textDark[50],
        textDark100: textDark[100],
        textDark200: textDark[200],
        textDark300: textDark[300],
        textDark400: textDark[400],
        textDark500: textDark[500],
        textDark600: textDark[600],
        textDark800: textDark[800],
        textDark900: textDark[900],

        text0:   textDark[50],
        text50:  textDark[50],
        text100: textDark[100],
        text200: textDark[200],
        text300: textDark[300],
        text400: textDark[400],
        text500: textDark[500],

        border0:   borderDark[500],
        border50:  DARK_STROKE,     // ← v1.0.12 soft dark stroke
        border100: DARK_STROKE,
        border200: borderDark[200],
        border300: borderDark[300],
        border400: borderDark[400],

        bg0:   backgroundDark[500],
        bg50:  backgroundDark[50],
        bg100: backgroundDark[100],
        bg200: backgroundDark[200],
        bg300: backgroundDark[300],
        bg400: backgroundDark[400],
        bg500: backgroundDark[500],
      },
    },
  },

  // Aliases mirror the semantic palette so gluestack-style sx props can
  // use familiar $primary / $bg / $surface notation.
  aliases: {
    bg:            'backgroundColor',
    bgColor:       'backgroundColor',
    color:         'color',
    textColor:     'color',
    h:             'height',
    w:             'width',
    minW:          'minWidth',
    maxW:          'maxWidth',
    minH:          'minHeight',
    maxH:          'maxHeight',
    rounded:       'borderRadius',
    roundedTop:    'borderTopLeftRadius',
    roundedBottom: 'borderBottomLeftRadius',
    p:             'padding',
    px:            'paddingHorizontal',
    py:            'paddingVertical',
    pt:            'paddingTop',
    pb:            'paddingBottom',
    pl:            'paddingLeft',
    pr:            'paddingRight',
    m:             'margin',
    mx:            'marginHorizontal',
    my:            'marginVertical',
    mt:            'marginTop',
    mb:            'marginBottom',
    ml:            'marginLeft',
    mr:            'marginRight',
    gap:           'gap',
    flexDir:       'flexDirection',
    align:         'alignItems',
    justify:       'justifyContent',
    wrap:          'flexWrap',
    border:        'borderWidth',
    borderX:       'borderHorizontalWidth',
    borderY:       'borderVerticalWidth',
    borderLeft:    'borderLeftWidth',
    borderRight:   'borderRightWidth',
    borderTop:     'borderTopWidth',
    borderBottom:  'borderBottomWidth',
    borderColor:   'borderColor',
    shadow:        'shadowColor',
    opacity:       'opacity',
  },

  // Global defaults applied to every component under StyledProvider.
  // Matches the 1.5px soft-stroke aesthetic delivered in v1.0.12.
  globalStyle: {} as any,
} as const);

export type GSConfigType = typeof GSConfig;

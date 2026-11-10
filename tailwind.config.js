/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: NativeWind v4 扫描路径 — 必须包含 app/ 和 src/ 下的所有 tsx/ts 文件
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],

  // ⚠️ darkMode 必须为 'class'，由 <ThemeProvider> 在根 View 上切换
  //   className="dark" 实现主题响应。NativeWind 通过 data-color-scheme 或 .dark 类切换。
  darkMode: 'class',

  theme: {
    extend: {
      // ======================================================================
      // 颜色令牌 — 与 src/theme/index.tsx 完全一致
      // 使用 CSS 变量动态切换 light/dark（由 useThemeColors + NativeWind 主题类驱动）
      // ======================================================================
      colors: {
        // --- Surface / 背景层 ---
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--color-surface-3) / <alpha-value>)',
        'surface-border': 'rgb(var(--color-surface-border) / <alpha-value>)',
        'surface-divider': 'rgb(var(--color-surface-divider) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        'surface-pressed': 'rgb(var(--color-surface-pressed) / <alpha-value>)',
        'surface-focus': 'rgb(var(--color-surface-focus) / <alpha-value>)',

        // --- Text ---
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        'text-inverse': 'rgb(var(--color-text-inverse) / <alpha-value>)',

        // --- Brand ---
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
        'primary-dim': 'rgb(var(--color-primary-dim) / <alpha-value>)',
        'primary-stroke': 'rgb(var(--color-primary-stroke) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-dim': 'rgb(var(--color-accent-dim) / <alpha-value>)',
        'accent-stroke': 'rgb(var(--color-accent-stroke) / <alpha-value>)',

        // --- Status ---
        info: 'rgb(var(--color-info) / <alpha-value>)',
        'info-dim': 'rgb(var(--color-info-dim) / <alpha-value>)',
        success: '#169A54',
        warning: '#D89A1C',
        danger: '#D43030',

        // --- Muscle groups (与 theme.muscle 一致) ---
        muscle: {
          back: '#D64A1C',
          cardio: '#2E9EDD',
          chest: '#8AC01A',
          'lower-arms': '#C4830F',
          'lower-legs': '#9447D2',
          neck: '#D85092',
          shoulders: '#168B5B',
          'upper-arms': '#D06D20',
          'upper-legs': '#3F75C2',
          waist: '#7B63CB',
        },
      },

      // ======================================================================
      // Spacing — 4px base grid
      // ======================================================================
      spacing: {
        '0': '0px',
        'px': '1px',
        '0.5': '2px',
        '1': '4px',   // xs
        '2': '8px',   // sm
        '3': '12px',  // md
        '4': '16px',  // lg
        '5': '20px',  // xl
        '7': '28px',  // xxl
        '10': '40px', // xxxl
        '14': '56px', // xxxxl
      },

      // ======================================================================
      // Border Radius
      // ======================================================================
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        'pill': '999px',
      },

      // ======================================================================
      // Font Size / Line Height — 与 typography 令牌对齐
      // ======================================================================
      fontSize: {
        'micro': ['10px', { lineHeight: '12px', letterSpacing: '0.3px', fontWeight: '700' }],
        'small': ['11px', { lineHeight: '14px', letterSpacing: '0.6px', fontWeight: '800' }],
        'label': ['12px', { lineHeight: '16px', letterSpacing: '0.2px', fontWeight: '700' }],
        'caption': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'caption-bold': ['13px', { lineHeight: '18px', fontWeight: '800' }],
        'sub': ['14px', { lineHeight: '20px', letterSpacing: '-0.1px', fontWeight: '500' }],
        'body': ['15px', { lineHeight: '22px', letterSpacing: '-0.1px', fontWeight: '500' }],
        'body-bold': ['15px', { lineHeight: '22px', letterSpacing: '-0.1px', fontWeight: '800' }],
        'h3': ['17px', { lineHeight: '22px', letterSpacing: '-0.2px', fontWeight: '700' }],
        'title': ['20px', { lineHeight: '26px', letterSpacing: '-0.3px', fontWeight: '800' }],
        'h2': ['22px', { lineHeight: '28px', letterSpacing: '-0.4px', fontWeight: '800' }],
        'h1': ['28px', { lineHeight: '34px', letterSpacing: '-0.6px', fontWeight: '700' }],
        'display': ['34px', { lineHeight: '41px', letterSpacing: '-0.5px', fontWeight: '700' }],
        'mono': ['16px', { lineHeight: '20px', letterSpacing: '0.2px', fontWeight: '800' }],
      },

      // ======================================================================
      // Shadows — soft elevation system (与 getSoftShadow 一致)
      // iOS: shadowColor/Offset/Radius/Opacity; Android: elevation
      // ======================================================================
      boxShadow: {
        'sm': '0px 2px 8px rgba(0,0,0,0.10)',
        'md': '0px 2px 8px rgba(0,0,0,0.35)',
        'lg': '0px 2px 8px rgba(0,0,0,0.35)',
      },
      elevation: {
        'sm': 2,
        'md': 4,
        'lg': 6,
      },

      // ======================================================================
      // Transition / Animation
      // ======================================================================
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
    },
  },

  plugins: [],
};

/**
 * Headless mocks so React Native components render in jsdom without a device.
 * Reanimated, expo-image and @expo/vector-icons are native/asset-heavy and are
 * replaced with lightweight stubs. i18n is stubbed so useTranslation works.
 */
// Manual reanimated stub — avoids pulling in react-native-worklets (native).
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView, FlatList, TouchableOpacity } = require('react-native');
  const Animated = {
    View,
    Text,
    Image,
    ScrollView,
    FlatList,
    TouchableOpacity,
    createAnimatedComponent: (c: any) => c,
  };
  const noopStyle = (f: any) => (typeof f === 'function' ? f() : {});
  const FadeIn = { duration: () => FadeIn, springify: () => FadeIn, delay: () => FadeIn };
  const FadeOut = { duration: () => FadeOut, springify: () => FadeOut, delay: () => FadeOut };
  return {
    __esModule: true,
    default: Animated,
    Animated,
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: noopStyle,
    useAnimatedProps: noopStyle,
    useDerivedValue: (f: any) => ({ value: typeof f === 'function' ? f() : 0 }),
    useAnimatedScrollHandler: () => () => {},
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    withDelay: (_d: any, v: any) => v,
    interpolate: (v: any) => v,
    Easing: {
      bezier: () => (x: any) => x,
      linear: (x: any) => x,
      inOut: (x: any) => x,
      out: (x: any) => x,
      in: (x: any) => x,
    },
    FadeIn,
    FadeOut,
    runOnJS: (f: any) => f,
    runOnUI: (f: any) => f,
    measure: () => ({}),
    cancelAnimation: () => {},
    WithSpringConfig: {},
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Img = (props: any) => React.createElement(View, props);
  return { Image: Img, ImageBackground: Img, default: Img };
});

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const Comp = (props: any) => React.createElement('Icon', props);
  Comp.default = Comp;
  return { __esModule: true, default: Comp };
});

// Native glass modules have no JS implementation on the test platform.
jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View } = require('react-native');
  const GlassView = (props: any) => React.createElement(View, props);
  return {
    __esModule: true,
    GlassView,
    GlassContainer: (props: any) => React.createElement(View, props),
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});

jest.mock('expo-android-glass-view', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const Native = (props: any) => React.createElement(View, props);
  const Tab = ({ icon, label }: any) =>
    React.createElement(View, null, icon ?? null, label ? React.createElement(Text, null, label) : null);
  return {
    __esModule: true,
    AndroidGlassView: Native,
    AndroidGlassButton: Native,
    AndroidGlassToggle: Native,
    AndroidGlassSlider: Native,
    AndroidGlassBottomTabs: Native,
    AndroidGlassTab: Tab,
    AndroidGlassMenu: Native,
    AndroidGlassMenuProvider: ({ children }: any) => children,
    MinimizeOnScrollProvider: ({ children }: any) => children,
    useMinimizeOnScroll: () => ({ minimized: false, setMinimized: () => {}, onScroll: undefined }),
    useMinimizeOnScrollHandler: () => undefined,
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BlurView = (props: any) => React.createElement(View, props);
  return { __esModule: true, BlurView, default: BlurView };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = (props: any) => React.createElement(View, props);
  return { __esModule: true, LinearGradient, default: LinearGradient };
});

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: any) => children,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// safe-area-context needs a provider; supply default insets for headless render.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const noop = (props: any) => React.createElement(View, props);
  return {
    __esModule: true,
    SafeAreaView: noop,
    SafeAreaProvider: noop,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    initialWindowMetrics: {
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      frame: { x: 0, y: 0, width: 0, height: 0 },
    },
  };
});

// gesture-handler test setup (needed for RNTL press events)
try {
  require('react-native-gesture-handler/jestSetup');
} catch (e) {
  /* not present — ignore */
}

// Allow React act() to work with test-renderer createRoot.
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

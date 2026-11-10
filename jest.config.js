/**
 * jest-expo config for Choyeon Gym UI / HIG test suite.
 *
 * Scope: component render tests (Apple primitives, UIKit components) and a
 * static HIG audit that traverses every screen. Kept separate from the
 * zero-dependency logic suite (scripts/run-tests.js) so `npm test` is untouched.
 *
 * Run: `npm run test:ui`
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/ui/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/tests/ui/setup.ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      { configFile: false, presets: ['babel-preset-expo'] },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native/setup-env$': '<rootDir>/tests/ui/__mocks__/react-native-setup-env.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gluestack-ui/.*|moti|@motify/.*|react-native-reanimated|@react-native-async-storage/.*|zustand|expo-router|@shopify/.*|superjson|dexie|dexie-react-hooks|.*-native|nativewind|@nativewind/.*|react-native-gesture-handler|@expo/vector-icons))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

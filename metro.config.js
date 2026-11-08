// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve @/* aliases in Metro
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  '@': path.resolve(__dirname, 'src'),
};

// NativeWind v4: 允许 .css 文件被 Metro 解析和转换
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), 'json', 'css'])
);

// Allow the large dataset (17MB) to be bundled without warning
config.maxWorkers = 2;

module.exports = config;

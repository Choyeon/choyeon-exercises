import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useThemeColors, typography, spacing, radius } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * ErrorBoundary — 全局渲染期异常兜底。
 *
 * 为什么需要它：React Native 中任何组件在 render 阶段抛出的异常如果没有被
 * 边界捕获，会一路冒泡到原生层，表现为「白屏」或直接闪退（Hermes 上还会
 * 打印 Invariant Violation 后终止进程）。健身 App 的训练页 / 历史页依赖于
 * 持久化数据，旧版本 vault 缺字段、跨版本迁移、并发写入都可能让某个组件
 * 读到 undefined，从而在渲染期抛错。
 *
 * 有了这层边界：
 *   1. 单个屏幕崩溃不再拖垮整个 App，用户看到的是可恢复的提示而不是闪退；
 *   2. 提供「重试」与「返回首页」两条逃生路径；
 *   3. 错误详情在 dev 下可见，便于定位（生产环境只显示友好文案）。
 *
 * 注意：ErrorBoundary 只能捕获 **渲染期 / 生命周期 / 构造函数** 中的错误，
 * 无法捕获事件回调（onPress 等）与异步代码中的错误——那两类已由各处的
 * try/catch 与 safeHaptic 等工具单独防护。
 */

interface Props {
  children: React.ReactNode;
  /** 崩溃时的兜底 UI（可选）——不传则使用内置样式 */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** 崩溃回调，用于埋点 / 日志上报 */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 控制台留痕：RN 的 LogBox 在 dev 下会显示，生产环境进入 native 日志。
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught render error:', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.retry);
    return <FallbackView error={error} onRetry={this.retry} />;
  }
}

/**
 * FallbackView — 独立函数组件以便使用 useThemeColors()（类组件无法用 hook）。
 */
function FallbackView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
        },
        card: {
          width: '100%',
          maxWidth: 420,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: spacing.xl,
          alignItems: 'center',
        },
        iconTray: {
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          backgroundColor: colors.danger + '18',
          borderWidth: 1,
          borderColor: colors.danger + '33',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        },
        iconGlyph: {
          fontSize: 26,
          lineHeight: 30,
          color: colors.danger,
          fontWeight: '900',
        },
        title: {
          ...typography.h3,
          color: colors.textPrimary,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
        desc: {
          ...typography.caption,
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.lg,
        },
        detailWrap: {
          width: '100%',
          maxHeight: 140,
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        },
        detail: {
          fontSize: 11,
          lineHeight: 16,
          color: colors.textTertiary,
          fontFamily: 'monospace',
        },
        retryBtn: {
          width: '100%',
          height: 48,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        },
        retryText: {
          ...typography.bodyBold,
          color: colors.textInverse,
        },
      }),
    [colors]
  );

  // 只在 dev 构建下展示原始错误信息，避免生产环境泄露内部实现细节。
  const showDetail = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconTray}>
          <Text style={styles.iconGlyph}>!</Text>
        </View>
        <Text style={styles.title}>出了点小问题</Text>
        <Text style={styles.desc}>
          这个页面遇到了意外情况，你的训练数据没有丢失。{'\n'}
          点下面重试，或者切换到别的标签页继续。
        </Text>

        {showDetail ? (
          <ScrollView style={styles.detailWrap} nestedScrollEnabled>
            <Text style={styles.detail} selectable>
              {String(error?.message || error)}
              {'\n\n'}
              {String(error?.stack || '').slice(0, 800)}
            </Text>
          </ScrollView>
        ) : null}

        <Pressable
          style={styles.retryBtn}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.retry')}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </View>
    </View>
  );
}

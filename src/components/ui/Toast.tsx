import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  WithSpringConfig } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useThemeColors,
  spacing,
  radius,
} from '@/theme';
import { safeHaptic } from '@/utils/haptic';

// ============================================================================
// Toast domain
// ============================================================================

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  title?: string;
  description?: string;
  /** Override variant (default 'info'). */
  variant?: ToastVariant;
  /** Duration in ms — default 3500. Pass null for no auto-dismiss. */
  duration?: number | null;
}

interface ToastEntry extends Required<Pick<ToastOptions, 'variant'>> {
  id: string;
  title: string;
  description?: string;
}

interface ToastContextValue {
  show: (opts: ToastOptions | string) => string;
  hide: (id: string) => void;
  hideAll: () => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

const SPRING_CFG: WithSpringConfig = {
  mass: 0.6,
  stiffness: 380,
  damping: 26,
  overshootClamping: true };

const SCREEN_W = Dimensions.get('window').width;

function iconFor(variant: ToastVariant): string {
  switch (variant) {
    case 'success': return 'check-circle-outline';
    case 'error':   return 'alert-circle-outline';
    case 'warning': return 'alert-outline';
    case 'info':    return 'information-outline';
  }
}

/**
 * Single toast tile.  Owns its own translation animation; the list
 * wrapper is responsible for stacking and y-offsets.
 */
function ToastTile({
  entry,
  onDone,
  yOffset }: {
  entry: ToastEntry;
  onDone: (id: string) => void;
  yOffset: number;
}) {
  const colors = useThemeColors();
  const translate = useSharedValue(120);
  const opacity = useSharedValue(0);

  const accent = useMemo(() => {
    switch (entry.variant) {
      case 'success': return colors.success;
      case 'error':   return colors.danger;
      case 'warning': return colors.warning;
      case 'info':    return colors.info;
    }
  }, [entry.variant, colors]);

  React.useEffect(() => {
    // enter
    opacity.value = withTiming(1, { duration: 220 });
    translate.value = withSpring(0, SPRING_CFG);
    return undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translate.value + yOffset }],
    opacity: opacity.value }));

  const styles = useMemo(() => {
    const border = entry.variant === 'error'
      ? colors.danger
      : entry.variant === 'warning'
      ? colors.warning
      : entry.variant === 'success'
      ? colors.success
      : colors.info;
    return StyleSheet.create({
      tile: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: 0,
        maxWidth: SCREEN_W - spacing.lg * 2,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
        elevation: 12 },
      iconTray: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent + '18',
        flexShrink: 0 },
      textWrap: { flex: 1, minWidth: 0 },
      title: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.1,
        lineHeight: 20 },
      desc: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 18,
        marginTop: spacing.xs } });
  }, [accent, colors, entry.variant]);

  return (
    <Animated.View
      style={[styles.tile, animStyle]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      onLayout={() => {
        // once measured, signal dismissal countdown from the manager via
        // setTimeout outside.  Keeping timers in the manager (one place)
        // avoids unmount-reorder race conditions.
      }}
    >
      <View style={styles.iconTray}>
        <MaterialCommunityIcons name={iconFor(entry.variant) as any} size={18} color={accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{entry.title}</Text>
        {entry.description ? (
          <Text style={styles.desc} numberOfLines={2}>{entry.description}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// Provider + public hook
// ============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counterRef = useRef<number>(1);

  const clearTimerFor = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const hide = useCallback((id: string) => {
    clearTimerFor(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearTimerFor]);

  const hideAll = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const show = useCallback((opts: ToastOptions | string): string => {
    const normalized: ToastOptions = typeof opts === 'string' ? { title: opts } : opts;
    const variant: ToastVariant = normalized.variant ?? 'info';
    const duration = normalized.duration ?? 3500;
    const id = `toast_${counterRef.current++}`;

    const entry: ToastEntry = {
      id,
      variant,
      title: normalized.title ?? variant.charAt(0).toUpperCase() + variant.slice(1),
      description: normalized.description };

    // Haptic feedback maps onto each variant type.  Matches native iOS
    // notification semantics (success = success haptic, warning = warning).
    const hapticKind: 'success' | 'error' | 'warning' | 'light' =
      variant === 'success' ? 'success'
      : variant === 'error' ? 'error'
      : variant === 'warning' ? 'warning'
      : 'light';
    safeHaptic(hapticKind);

    setToasts((prev) => [...prev, entry]);

    if (duration !== null) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, []);

  const value: ToastContextValue = useMemo(() => ({ show, hide, hideAll }), [show, hide, hideAll]);

  // ★ 修复内存泄漏：Provider 卸载时清理所有定时器，避免对已卸载组件 setState
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  // Render toasts stacked from the bottom.  Most recent toast is drawn at
  // the bottom of the screen; older ones are pushed up by tile height.
  // TILE_HEIGHT ≈ 60; we keep 14px between tiles so the stack breathes.
  const TILE_H = 68;
  const STACK_GAP = 10;

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* Toast overlay sits above the whole app but never steals touches.
          pointerEvents="box-none" allows taps to pass through to content
          between tiles. */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        accessibilityElementsHidden={toasts.length === 0}
      >
        {toasts.map((entry, i) => {
          // Newest toast at bottom of stack (largest index → yOffset closest to 0).
          const offsetFromBottom = (toasts.length - 1 - i) * (TILE_H + STACK_GAP);
          return (
            <ToastTile
              key={entry.id}
              entry={entry}
              yOffset={-offsetFromBottom}
              onDone={hide}
            />
          );
        })}
        {/* Padding so the bottommost tile sits above the tab bar even
            without knowing exact insets.  useSafeAreaInsets lives in
            the tab _layout; ToastProvider is a global provider so we
            reserve a comfortable 84px (~tabBarTotalHeight + 10 buffer). */}
        <View style={{ height: 84, position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }} />
      </View>
    </ToastCtx.Provider>
  );
}

/**
 * Primary Toast API — surfaces `show` / `hide` / `hideAll` to callers.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show({ title: 'Saved!', variant: 'success' });
 *   toast.show('Plain info toast');
 */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Graceful fallback outside the provider (dev UX only).  Returning
    // noops instead of throwing lets us test individual screens in
    // isolation without wrapping every Storybook-like sandbox.
    return useMemo<ToastContextValue>(() => ({
      show: (_: any) => 'noop',
      hide: (_: string) => {},
      hideAll: () => {} }), []);
  }
  return ctx;
}

// Re-export a plain <Toast /> stub so ui/index.ts can export both the
// component (for future extensibility) and the hook.  In practice
// callers use `useToast()` and never mount Toast by hand.
export const Toast: React.FC<ToastOptions> = function Toast(_opts) {
  return null;
};

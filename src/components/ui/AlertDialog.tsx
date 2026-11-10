import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  WithSpringConfig } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  useThemeColors,
  spacing,
  radius,
  typography,
  getScrim,
  strokeFromColors,
} from '@/theme';
import { safeHaptic } from '@/utils/haptic';

// ============================================================================
// ConfirmDialog — lightweight overlay modal, two-action confirm/cancel.
//
// Built on the native RN Modal (instead of gluestack's themed AlertDialog)
// so we control the 1.5px neo-brutalist stroke and softShadow aesthetic
// pixel-for-pixel without fighting a library's internal styleSheet.
// ============================================================================

export type ConfirmDialogVariant = 'destructive' | 'primary';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  desc?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: ConfirmDialogVariant;
  /** Optional icon glyph name (MaterialCommunityIcons) to render left of title. */
  icon?: string;
}

const SPRING_CFG: WithSpringConfig = {
  mass: 0.7,
  stiffness: 340,
  damping: 22,
  overshootClamping: true };

function AnimatedPressable({
  children,
  onPress,
  hitSlop,
  style,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  disabled,
  loading }: React.ComponentProps<typeof Pressable> & { loading?: boolean }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  // Narrow accessibilityRole to what the inner Pressable accepts; default to "button".
  const safeRole: 'button' | 'none' | undefined =
    accessibilityRole === 'none' ? 'none' : 'button';
  // Ensure accessibilityState.disabled is never null.
  type PState = { disabled?: boolean | undefined; busy?: boolean | undefined; [k: string]: any };
  const safeState: PState = accessibilityState
    ? { ...accessibilityState, disabled: !!(accessibilityState.disabled ?? disabled ?? loading), busy: !!(accessibilityState.busy ?? loading) }
    : { disabled: !!(disabled || loading), busy: !!loading };
  return (
    <AnimatedPressableInner
      styleArg={style}
      animStyle={anim}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={safeRole}
      accessibilityState={safeState}
      disabled={!!disabled}
      scaleRef={s}
    >
      {typeof children === 'function' ? (undefined as never) : (children as React.ReactNode)}
    </AnimatedPressableInner>
  );
}

// Helper so onPressIn/Out can read the shared-value ref without re-creating
// the Pressable closure on every render.
function AnimatedPressableInner(props: {
  styleArg?: React.ComponentProps<typeof Pressable>['style'];
  animStyle: any;
  onPress?: React.ComponentProps<typeof Pressable>['onPress'];
  hitSlop?: number | any;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'none';
  accessibilityState?: any;
  disabled?: boolean;
  scaleRef: SharedValue<number>;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      hitSlop={props.hitSlop}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole={props.accessibilityRole}
      accessibilityState={props.accessibilityState as any}
      disabled={props.disabled}
      onPressIn={() => {
        props.scaleRef.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        props.scaleRef.value = withTiming(1, { duration: 140 });
      }}
    >
      <Animated.View style={[props.styleArg as any, props.animStyle as any]}>
        {props.children}
      </Animated.View>
    </Pressable>
  );
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = function ConfirmDialog({
  visible,
  title,
  desc,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'destructive',
  icon }) {
  const colors = useThemeColors();
  const isDark = strokeFromColors(colors).isDark;
  const isDestructive = variant === 'destructive';
  const accent = isDestructive ? colors.danger : colors.primary;

  const backdropOpacity = useSharedValue(0);
  const sheetScale = useSharedValue(0.88);
  const sheetOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetOpacity.value = withTiming(1, { duration: 160 });
      sheetScale.value = withSpring(1, SPRING_CFG);
    } else {
      // Closing animations not needed — Modal unmounts instantly on the
      // next paint and avoids flicker from "modal backdrop removed then
      // content animates out on an empty background".
    }
  }, [visible, backdropOpacity, sheetScale, sheetOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value }));
  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sheetScale.value }],
    opacity: sheetOpacity.value }));

  const s = useMemo(() => StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: getScrim(isDark),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl },
    sheet: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.55,
      shadowRadius: 26,
      elevation: 20 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm },
    iconTray: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: accent + '16',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0 },
    title: {
      ...typography.h3,
      lineHeight: 22,
      color: colors.textPrimary,
      flex: 1 },
    desc: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: spacing.lg },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder },
    cancelText: {
      ...typography.bodyBold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textPrimary },
    confirmBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accent,
      borderWidth: 1,
      borderColor: accent },
    confirmText: {
      ...typography.bodyBold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textInverse } }), [accent, colors, isDestructive]);

  const handleCancel = () => {
    safeHaptic('light');
    onCancel?.();
  };
  const handleConfirm = () => {
    safeHaptic(isDestructive ? 'heavy' : 'medium');
    onConfirm?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={cancelText}
          />
          <Animated.View
            style={[s.sheet, sheetAnimStyle]}
            accessibilityViewIsModal
          >
            <View style={s.headerRow}>
              <View style={s.iconTray}>
                <MaterialCommunityIcons
                  name={(icon ?? (isDestructive ? 'alert-octagon-outline' : 'help-circle-outline')) as any}
                  size={20}
                  color={accent}
                />
              </View>
              <Text style={s.title} numberOfLines={2}>{title}</Text>
            </View>
            {desc ? <Text style={s.desc}>{desc}</Text> : null}

            <View style={s.footerRow}>
              <AnimatedPressable
                onPress={handleCancel}
                style={s.cancelBtn}
                accessibilityLabel={cancelText}
                accessibilityRole="button"
              >
                <Text style={s.cancelText}>{cancelText}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleConfirm}
                style={s.confirmBtn}
                accessibilityLabel={confirmText}
                accessibilityRole="button"
              >
                <Text style={s.confirmText}>{confirmText}</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Also expose a passthrough AlertDialog alias so ui/index.ts can export
// both a semantic primitive name and the high-level ConfirmDialog API.
export const AlertDialog = ConfirmDialog;

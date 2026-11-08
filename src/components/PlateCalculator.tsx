import React, { useMemo } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import type { PlateConfig } from '@/types';
import { Icon, PressableScale } from '@/components/UIKit';
import { safeHaptic } from '@/utils/haptic';
import { computePlates, roundToLoadable, displayWeight } from '@/utils/strength';

// ============================================================================
// PlateCalculator —— 杠铃片配重弹窗。
//
// 为什么需要：训练中途最烦的就是心算「102.5kg 每边挂几片」。
// 训记 / Strong / Hevy 都提供这个，属于高频刚需。
//
// 关键取舍：
//   · 配不出精确值时明确提示「配不出，最接近且不超重的是 X」，绝不静默给出
//     一个挂不上的方案 —— 那会让用户在杠铃前卡住，比不提示更糟。
//   · 纯计算、无网络、无原生依赖；逻辑全在 src/utils/strength.ts 且已被单测覆盖。
// ============================================================================

export interface PlateCalculatorProps {
  visible: boolean;
  /** 目标总重量（含杆，内部统一 kg） */
  targetKg: number;
  /** 展示单位 —— 仅影响文案，计算始终在 kg 域进行 */
  unit: 'kg' | 'lb';
  config: PlateConfig;
  onClose: () => void;
  /** 用户选择「改用最接近的可配重量」时回调（回传 kg） */
  onApplyLoadable?: (kg: number) => void;
}

export function PlateCalculator({
  visible,
  targetKg,
  unit,
  config,
  onClose,
  onApplyLoadable,
}: PlateCalculatorProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  const breakdown = useMemo(() => computePlates(targetKg, config), [targetKg, config]);
  const loadable = useMemo(() => roundToLoadable(targetKg, config), [targetKg, config]);

  /**
   * 计算始终在 kg 域进行（杠铃片规格本身就是公制的），
   * 但界面上必须按用户单位显示 —— 否则 lb 用户会看到「20 lb 空杆」这种
   * 数字对不上现实杠铃的鬼故事。
   */
  const show = (kg: number) => displayWeight(kg, unit);

  // 同一重量出现多次时聚合（25 / 25 / 10 → 25×2 / 10×1），
  // 否则大重量下会堆出十几片同值圆片，一眼数不清。
  const grouped = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of breakdown.perSide) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [breakdown.perSide]);

  const plateColorFor = (weight: number): string => {
    // 越重的片用越暖的色，贴近真实杠铃片的配色习惯（红 25 / 蓝 20 / 黄 10 …）
    if (weight >= 25) return colors.danger;
    if (weight >= 20) return colors.accent;
    if (weight >= 10) return colors.warning;
    if (weight >= 5) return colors.info;
    return colors.success;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.55)',
        },
        sheet: {
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        },
        grabber: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.surfaceBorder,
          alignSelf: 'center',
          marginBottom: spacing.md,
        },
        head: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        },
        title: { ...typography.h3, color: colors.textPrimary },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
        },
        targetRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.xs,
          marginBottom: spacing.md,
        },
        targetValue: { ...typography.display, fontSize: 28, color: colors.primary },
        targetUnit: { ...typography.body, color: colors.textSecondary },
        warnBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.warning + '18',
          borderWidth: 1,
          borderColor: colors.warning + '44',
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        warnText: { flex: 1, ...typography.caption, color: colors.textPrimary },
        sectionLabel: {
          ...typography.caption,
          color: colors.textTertiary,
          marginBottom: spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontWeight: '700',
        },
        plateRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        },
        plate: {
          minWidth: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
        },
        plateText: { ...typography.bodyBold, fontSize: 13 },
        plateCount: { ...typography.bodyBold, fontSize: 10 },
        emptyText: {
          ...typography.body,
          color: colors.textTertiary,
          marginBottom: spacing.lg,
        },
        barNote: {
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        applyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          marginBottom: spacing.md,
        },
        applyText: { ...typography.bodyBold, color: colors.textInverse },
      }),
    [colors, typography]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 遮罩先渲染铺满，面板随后渲染 → 面板天然在遮罩之上，
          点面板内部不会穿透到遮罩导致误关。 */}
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.grabber} />

            <View style={styles.head}>
              <Text style={styles.title}>
                {t('session.plateTitle', { defaultValue: '杠铃片配重' })}
              </Text>
              <PressableScale
                onPress={onClose}
                style={styles.closeBtn}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', { defaultValue: '关闭' })}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.targetRow}>
                <Text style={styles.targetValue}>{show(targetKg)}</Text>
                <Text style={styles.targetUnit}>{unit}</Text>
              </View>

              {!breakdown.exact ? (
                <View style={styles.warnBox}>
                  <Icon name="alert-outline" size={18} color={colors.warning} />
                  <Text style={styles.warnText}>
                    {t('session.plateNotExact', {
                      defaultValue:
                        '现有片配不出这个重量，最接近且不超重的是 {{v}} {{unit}}。',
                      v: show(breakdown.achievable),
                      unit,
                    })}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>
                {t('session.platePerSide', { defaultValue: '每侧' })}
              </Text>

              {grouped.length > 0 ? (
                <View style={styles.plateRow}>
                  {grouped.map(([w, n]) => {
                    const c = plateColorFor(w);
                    return (
                      <View
                        key={w}
                        style={[styles.plate, { borderColor: c, backgroundColor: c + '1F' }]}
                      >
                        <Text style={[styles.plateText, { color: c }]}>{show(w)}</Text>
                        {n > 1 ? (
                          <Text style={[styles.plateCount, { color: c }]}>×{n}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  {t('session.plateEmpty', { defaultValue: '空杆即可，无需加片。' })}
                </Text>
              )}

              <Text style={styles.barNote}>
                {t('session.plateBarNote', {
                  defaultValue: '空杆 {{bar}} {{unit}} · 达成总重 {{total}} {{unit}}',
                  bar: show(breakdown.bar),
                  total: show(breakdown.achievable),
                  unit,
                })}
              </Text>

              {!breakdown.exact && onApplyLoadable ? (
                <PressableScale
                  onPress={() => {
                    safeHaptic('medium');
                    onApplyLoadable(loadable);
                    onClose();
                  }}
                  style={styles.applyBtn}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={t('session.plateApply', { defaultValue: '改用可配重量' })}
                >
                  <Icon name="check" size={16} color={colors.textInverse} />
                  <Text style={styles.applyText}>
                    {t('session.plateApplyValue', {
                      defaultValue: '改用 {{v}} {{unit}}',
                      v: show(loadable),
                      unit,
                    })}
                  </Text>
                </PressableScale>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

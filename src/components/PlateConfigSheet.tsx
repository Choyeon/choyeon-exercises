import React, { useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors, spacing, radius, typography } from '@/theme';
import { Icon, PressableScale } from '@/components/UIKit';
import { safeHaptic } from '@/utils/haptic';
import type { PlateConfig } from '@/types';
import { DEFAULT_PLATE_CONFIG } from '@/types';
import { BAR_WEIGHT_PRESETS } from '@/constants/settings';

// ============================================================================
// PlateConfigSheet —— 杠铃杆重量 + 可用片规格编辑器。
//
// 为什么必须可配置：
//   健身房 / 家用杠铃的杆重（20kg 奥杆、15kg 训练杆、7kg 女子杆）和
//   片规格（有没有 1.25kg 片、有没有 15kg 片）千差万别。写死默认值的话，
//   训练页的配重计算器会给出「健身房根本不存在的片」，那比没有更糟。
// ============================================================================

/** 候选片规格（kg）—— 覆盖绝大多数商业健身房与家用组合 */
const PLATE_CANDIDATES: number[] = [50, 25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5];

export interface PlateConfigSheetProps {
  visible: boolean;
  /** 当前配置（kg 域） */
  config: PlateConfig;
  /** 展示单位 —— 只影响文案里的单位后缀与数值换算 */
  unit: 'kg' | 'lb';
  onClose: () => void;
  onChange: (next: PlateConfig) => void;
}

export function PlateConfigSheet({
  visible,
  config,
  unit,
  onClose,
  onChange,
}: PlateConfigSheetProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  // 编辑期用本地 state，避免每点一下芯片就写 store（那样 Modal 关闭前
  // 训练页的配重结果会一路抖动）。
  const [draft, setDraft] = useState<PlateConfig>(config);

  // 每次打开时用当前配置重置草稿 —— 否则上次编辑到一半的值会残留。
  const [lastVisible, setLastVisible] = useState(false);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setDraft({ barWeight: config.barWeight, plates: [...config.plates] });
  }

  const togglePlate = (w: number) => {
    safeHaptic('selection');
    setDraft((d) => {
      const has = d.plates.includes(w);
      const next = has
        ? d.plates.filter((x) => x !== w)
        // 始终保持从重到轻，computePlates 的贪心依赖这个顺序
        : [...d.plates, w].sort((a, b) => b - a);
      return { ...d, plates: next };
    });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
        sheet: {
          backgroundColor: colors.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          maxHeight: '85%',
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
          marginBottom: spacing.lg,
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
        sectionLabel: {
          ...typography.caption,
          color: colors.textTertiary,
          marginBottom: spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontWeight: '700',
        },
        pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
        pill: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          backgroundColor: colors.surface,
        },
        pillOn: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '1A',
        },
        pillText: { ...typography.captionBold, color: colors.textSecondary },
        pillTextOn: { color: colors.primary },
        currentBox: {
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        },
        currentText: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
        footRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
        primaryBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
        },
        primaryBtnText: { ...typography.bodyBold, color: colors.textInverse },
        ghostBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
        },
        ghostBtnText: { ...typography.bodyBold, color: colors.textSecondary },
        warnBox: {
          flexDirection: 'row',
          gap: spacing.sm,
          backgroundColor: colors.warning + '18',
          borderWidth: 1,
          borderColor: colors.warning + '44',
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        warnText: { flex: 1, ...typography.caption, color: colors.textPrimary },
      }),
    [colors, typography]
  );

  const tooFewPlates = draft.plates.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.grabber} />

            <View style={styles.head}>
              <Text style={styles.title}>
                {t('profile.plateConfigTitle', { defaultValue: '杠铃配置' })}
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
              <Text style={styles.sectionLabel}>
                {t('profile.plateBarWeight', { defaultValue: '空杆重量' })}
              </Text>
              <View style={styles.pillRow}>
                {BAR_WEIGHT_PRESETS.map((w) => {
                  const on = draft.barWeight === w;
                  return (
                    <PressableScale
                      key={w}
                      onPress={() => {
                        safeHaptic('selection');
                        setDraft((d) => ({ ...d, barWeight: w }));
                      }}
                      style={[styles.pill, on && styles.pillOn]}
                      scaleTo={0.94}
                      accessibilityRole="button"
                      accessibilityLabel={`${w}${unit}`}
                    >
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>
                        {w}
                        {unit}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>
                {t('profile.plateAvailable', { defaultValue: '可用片（单侧可选）' })}
              </Text>
              <View style={styles.pillRow}>
                {PLATE_CANDIDATES.map((w) => {
                  const on = draft.plates.includes(w);
                  return (
                    <PressableScale
                      key={w}
                      onPress={() => togglePlate(w)}
                      style={[styles.pill, on && styles.pillOn]}
                      scaleTo={0.94}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${w}${unit}`}
                    >
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>
                        {w}
                        {unit}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              {tooFewPlates ? (
                <View style={styles.warnBox}>
                  <Icon name="alert-outline" size={16} color={colors.warning} />
                  <Text style={styles.warnText}>
                    {t('profile.plateNoneWarn', {
                      defaultValue: '至少选一种片，否则配重计算器只能算空杆。',
                    })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.currentBox}>
                <Text style={styles.currentText}>
                  {t('profile.plateCurrent', { defaultValue: '当前配置' })}：{draft.barWeight}
                  {unit} {t('profile.plateBar', { defaultValue: '杆' })} ·{' '}
                  {draft.plates.length > 0 ? draft.plates.join(' / ') : '—'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footRow}>
              <PressableScale
                onPress={() => {
                  safeHaptic('light');
                  setDraft({
                    barWeight: DEFAULT_PLATE_CONFIG.barWeight,
                    plates: [...DEFAULT_PLATE_CONFIG.plates],
                  });
                }}
                style={styles.ghostBtn}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityLabel={t('common.resetDefault', { defaultValue: '恢复默认' })}
              >
                <Icon name="restore" size={15} color={colors.textSecondary} />
                <Text style={styles.ghostBtnText}>
                  {t('common.resetDefault', { defaultValue: '恢复默认' })}
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  safeHaptic('medium');
                  onChange({
                    barWeight: draft.barWeight,
                    plates: draft.plates.length > 0 ? draft.plates : [...DEFAULT_PLATE_CONFIG.plates],
                  });
                  onClose();
                }}
                style={styles.primaryBtn}
                scaleTo={0.98}
                accessibilityRole="button"
                accessibilityLabel={t('common.save', { defaultValue: '保存' })}
              >
                <Icon name="check" size={16} color={colors.textInverse} />
                <Text style={styles.primaryBtnText}>{t('common.save', { defaultValue: '保存' })}</Text>
              </PressableScale>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

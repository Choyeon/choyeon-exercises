import React, { memo, useCallback, useMemo } from 'react';
import { Text, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors, typography, spacing, radius, muscleColor } from '@/theme';
import { safeHaptic } from '@/utils/haptic';
import {
  BODY_PART_LABELS,
  EQUIPMENT_LABELS,
  iconForBodyPart,
  iconForEquipment,
  labelForBodyPart,
  labelForEquipment,
} from '@/constants';
import type { BodyPart, LanguageCode } from '@/types';
import { Icon, PressableScale } from '@/components/UIKit';

// ==========================================================================
// BodyPartChip
// Muscle-colored tinting tied to colors.muscle (deterministic per region).
// Label is picked by i18n language (zh / en) via the active locale so the
// chips rerender reactively when the user flips language in Settings.
// ==========================================================================

interface BodyPartChipProps {
  bodyPart: BodyPart;
  count?: number;
  selected?: boolean;
  onPress?: (bodyPart: BodyPart) => void;
  size?: 'sm' | 'md' | 'lg';
}

function BodyPartChipImpl({
  bodyPart,
  count,
  selected = false,
  onPress,
  size = 'md',
}: BodyPartChipProps) {
  const colors = useThemeColors();
  const { i18n } = useTranslation();
  const lang: LanguageCode = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const styles = useMemo(() => StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      gap: spacing.xs,
    },
    iconTray: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.captionBold,
      maxWidth: 160,
      letterSpacing: -0.1,
      marginLeft: 2,
    },
    countBadge: {
      marginLeft: spacing.sm,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      minWidth: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  }), []);

  const info = BODY_PART_LABELS[bodyPart] || {
    zh: labelForBodyPart(bodyPart),
    en: labelForBodyPart(bodyPart, 'en'),
    icon: iconForBodyPart(bodyPart),
  };
  const color =
    muscleColor(colors, bodyPart);

  const labelText = lang === 'en' ? info.en : info.zh;

  const handlePress = useCallback((_e: GestureResponderEvent) => {
    safeHaptic('light');
    onPress?.(bodyPart);
  }, [bodyPart, onPress]);

  // Stabilize size config so style arrays get the same object reference when
  // inputs don't change.  Without this, `memo()` on the chip still re-runs
  // shallow prop-compare of styles every time a sibling chip fires.
  const cfg = useMemo(
    () =>
      size === 'sm'
        ? { pH: spacing.sm, pV: spacing.xs, fSz: 12, iSz: 13, bSz: 20 }
        : size === 'lg'
        ? { pH: spacing.lg, pV: spacing.md, fSz: 16, iSz: 18, bSz: 28 }
        : { pH: spacing.md, pV: spacing.sm, fSz: 14, iSz: 16, bSz: 24 },
    [size]
  );

  return (
    <PressableScale
      onPress={handlePress}
      style={[
        styles.chip,
        {
          paddingHorizontal: cfg.pH,
          paddingVertical: cfg.pV,
          backgroundColor: selected ? color + '22' : colors.surface,
          borderColor: selected ? color : colors.surfaceBorder,
        },
      ]}
      accessibilityLabel={`${labelText}${typeof count === 'number' ? ` (${count})` : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.iconTray,
          {
            width: cfg.bSz,
            height: cfg.bSz,
            borderRadius: cfg.bSz / 2,
            backgroundColor: selected ? color + '28' : colors.surfaceElevated,
          },
        ]}
      >
        <Icon
          name={info.icon}
          size={cfg.iSz}
          color={selected ? color : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.label,
          {
            fontSize: cfg.fSz,
            color: selected ? color : colors.textPrimary,
            fontWeight: selected ? '800' : '600',
          },
        ]}
        numberOfLines={1}
      >
        {labelText}
      </Text>
      {typeof count === 'number' && (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: selected ? color : colors.surfaceElevated },
          ]}
        >
          <Text
            style={[
              styles.count,
              { color: selected ? colors.textInverse : colors.textSecondary },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

// ==========================================================================
// EquipmentChip
// Primary (lime) tinting since equipment is cross-regional.  Language-aware
// label follows the same zh/en i18n pattern as BodyPartChip.
// ==========================================================================

interface EquipmentChipProps {
  equipment: string;
  count?: number;
  selected?: boolean;
  onPress?: (equipment: string) => void;
  size?: 'sm' | 'md';
}

function EquipmentChipImpl({
  equipment,
  count,
  selected = false,
  onPress,
  size = 'md',
}: EquipmentChipProps) {
  const colors = useThemeColors();
  const { i18n } = useTranslation();
  const lang: LanguageCode = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const styles = useMemo(() => StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      gap: spacing.xs,
    },
    iconTray: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.captionBold,
      maxWidth: 160,
      letterSpacing: -0.1,
      marginLeft: 2,
    },
    countBadge: {
      marginLeft: spacing.sm,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      minWidth: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  }), []);

  const info = EQUIPMENT_LABELS[equipment] || {
    zh: labelForEquipment(equipment),
    en: labelForEquipment(equipment, 'en'),
    icon: iconForEquipment(equipment),
  };
  const labelText = lang === 'en' ? info.en : info.zh;

  const handlePress = useCallback((_e: GestureResponderEvent) => {
    safeHaptic('light');
    onPress?.(equipment);
  }, [equipment, onPress]);
  const small = size === 'sm';
  return (
    <PressableScale
      onPress={handlePress}
      style={[
        styles.chip,
        {
          paddingHorizontal: small ? spacing.sm : spacing.md,
          paddingVertical: small ? spacing.xs : spacing.sm,
          backgroundColor: selected
            ? colors.primaryDim
            : colors.surface,
          borderColor: selected ? colors.primary : colors.surfaceBorder,
        },
      ]}
      accessibilityLabel={`${labelText}${typeof count === 'number' ? ` (${count})` : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.iconTray,
          {
            width: small ? 20 : 24,
            height: small ? 20 : 24,
            borderRadius: small ? 10 : 12,
            backgroundColor: selected
              ? colors.primary + '26'
              : colors.surfaceElevated,
          },
        ]}
      >
        <Icon
          name={info.icon}
          size={small ? 12 : 14}
          color={selected ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.label,
          {
            fontSize: small ? 12 : 14,
            color: selected ? colors.primary : colors.textPrimary,
            fontWeight: selected ? '800' : '600',
          },
        ]}
        numberOfLines={1}
      >
        {labelText}
      </Text>
      {typeof count === 'number' && (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: selected
                ? colors.primary
                : colors.surfaceElevated,
            },
          ]}
        >
          <Text
            style={[
              styles.count,
              {
                color: selected ? colors.textInverse : colors.textSecondary,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

export const BodyPartChip = memo(BodyPartChipImpl);
export const EquipmentChip = memo(EquipmentChipImpl);

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Stack,
  useRouter,
} from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useThemeColors,
  spacing,
  radius,
  typography,
  strokeFromColors,
  layout,
} from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { safeHaptic } from '@/utils/haptic';
import {
  Icon,
  PressableScale,
  EmptyState,
  SectionHeader,
} from '@/components/UIKit';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { AppleNavBar } from '@/components/apple';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { labelForEquipment } from '@/constants';
import type { PlanTemplate, UserPlanTemplate } from '@/types';

// ============================================================================
// Small helpers
// ============================================================================

type TabKey = 'preset' | 'mine';

/** upperFirst("hello") → "Hello" */
function upperFirst(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "fat-loss" → "FatLoss"   (hyphen-segment upperFirst + concat drop hyphen)
 * "hypertrophy" → "Hypertrophy"
 * Used to build workout.goalFatLoss / workout.goalHypertrophy i18n keys.
 */
function goalEnumToPascal(s: string): string {
  return s
    .split('-')
    .map((seg) => upperFirst(seg))
    .join('');
}

const LEVEL_ICON: Record<PlanTemplate['level'], string> = {
  beginner: 'leaf',
  intermediate: 'fire',
  advanced: 'trophy-outline',
};

const GOAL_ICON: Record<PlanTemplate['goal'], string> = {
  hypertrophy: 'arm-flex-outline',
  strength: 'dumbbell',
  conditioning: 'run-fast',
  'fat-loss': 'scale-bathroom',
  maintenance: 'chart-line',
  mobility: 'yoga',
};

// ============================================================================
// TemplateCard
// ============================================================================

type TemplateMode =
  | { kind: 'preset' }
  | { kind: 'mine'; pinned: boolean; onPin: () => void; onEdit: () => void; onDelete: () => void };

interface TemplateCardProps {
  tpl: PlanTemplate | UserPlanTemplate;
  mode: TemplateMode;
  onStart: () => void;
  onClone?: () => void;
}

function TemplateCard({ tpl, mode, onStart, onClone }: TemplateCardProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  // 视觉一致性：描边/阴影/isDark 统一走 theme 令牌
  // （此前此处用 rgba(0,0,0,0.10) 与全 App 的 rgba(16,20,24,0.10) 不一致）
  const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);

  const levelColor =
    tpl.level === 'beginner'
      ? colors.info
      : tpl.level === 'intermediate'
      ? colors.primary
      : colors.accent;

  const sessionCount = Array.isArray(tpl.sessions) ? tpl.sessions.length : 0;

  const s = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          marginBottom: spacing.lg,
          overflow: 'hidden',
          ...softShadow,
        },
        accentBar: {
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 4,
        },
        body: {
          padding: spacing.lg,
          paddingLeft: spacing.xxl,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        title: {
          ...typography.h3,
          color: colors.textPrimary,
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
        },
        desc: {
          ...typography.caption,
          color: colors.textSecondary,
          lineHeight: 18,
          marginBottom: spacing.md,
          minWidth: 0,
          flexShrink: 1,
        },
        badgeRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        startBtn: {
          flex: 1,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.xs,
        },
        startText: {
          ...typography.bodyBold,
          color: colors.textInverse,
        },
        outlineBtn: {
          flex: 1,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.xs,
        },
        outlineText: {
          ...typography.captionBold,
          color: colors.textPrimary,
        },
        smBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: accentStroke,
          alignItems: 'center',
          justifyContent: 'center',
        },
        destructiveBtn: {
          borderColor: colors.danger + '66',
          backgroundColor: colors.danger + '14',
        },
        destructiveText: {
          color: colors.danger,
        },
        pinBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: accentStroke,
          backgroundColor: colors.surfaceElevated,
        },
        pinBtnActive: {
          borderColor: colors.warning + '66',
          backgroundColor: colors.warning + '14',
        },
      }),
    [colors, frameStroke, accentStroke, softShadow]
  );

  const levelBadge = (
    <Badge
      key="level"
      label={t(`workout.level${upperFirst(tpl.level)}`)}
      icon={LEVEL_ICON[tpl.level]}
      color={levelColor}
      size="sm"
    />
  );

  const goalBadge = (
    <Badge
      key="goal"
      label={t(`workout.goal${goalEnumToPascal(tpl.goal)}`)}
      icon={GOAL_ICON[tpl.goal]}
      variant="accent"
      size="sm"
    />
  );

  const perWeekBadge = (
    <Badge
      key="pw"
      label={t('workout.perWeek', { n: tpl.daysPerWeek })}
      icon="calendar-week"
      variant="info"
      size="sm"
    />
  );

  const minBadge = (
    <Badge
      key="dur"
      label={t('workout.minPerSession', { n: tpl.durationMinPerSession })}
      icon="clock-outline"
      variant="outline"
      size="sm"
    />
  );

  const gearBadge =
    Array.isArray(tpl.equipmentRequired) && tpl.equipmentRequired.length > 0 ? (
      <Badge
        key="gear"
        label={(function () {
          // 溢出修复: 器械≥3项时不拼长串避免badge溢出邻卡；≤2项保留详细原名
          const eqArr = (tpl.equipmentRequired as string[]).filter(Boolean);
          if (eqArr.length > 2) {
            // '器械：N 项' / 'Gear: N items'
            if (effectiveLang === 'zh') return t('workout.needsEquipment', { n: eqArr.length as any });
            const hasN = t('workout.needsEquipment', { n: 'X' });
            return hasN.includes('X') ? hasN.replace('X', String(eqArr.length)) : `${eqArr.length} items`;
          }
          const raw = eqArr.map((e) => labelForEquipment(e, effectiveLang as any)).join(' / ');
          // 兜底二次替换：防止翻译插值变量名错导致 {{n}} 残留
          return raw.slice(0, 32);
        })()}
        icon="weight-lifter"
        variant="dark"
        size="sm"
      />
    ) : null;

  const sessionBadge = sessionCount > 0 ? (
    <Badge
      key="sct"
      label={t('workout.sessionCount', { n: sessionCount })}
      icon="format-list-bulleted"
      variant="outline"
      size="sm"
    />
  ) : null;

  return (
    <View style={s.card}>
      <View style={[s.accentBar, { backgroundColor: levelColor }]} />
      <View style={s.body}>
        <View style={s.topRow}>
          <Text
            style={s.title}
            numberOfLines={2}
          >
            {tpl.name?.[effectiveLang] ?? tpl.name?.zh ?? ''}
          </Text>
          {mode.kind === 'mine' ? (
            <PressableScale
              onPress={mode.onPin}
              hitSlop={8}
              style={[s.pinBtn, mode.pinned && s.pinBtnActive]}
              scaleTo={0.92}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.togglePin')}
            >
              <Icon
                name={mode.pinned ? 'star' : 'star-outline'}
                size={16}
                color={mode.pinned ? colors.warning : colors.textSecondary}
              />
            </PressableScale>
          ) : null}
        </View>
        <Text style={s.desc} numberOfLines={2}>
          {tpl.description?.[effectiveLang] ?? tpl.description?.zh ?? ''}
        </Text>
        <View style={s.badgeRow}>
          {levelBadge}
          {goalBadge}
          {perWeekBadge}
          {minBadge}
          {gearBadge}
          {sessionBadge}
        </View>
        <View style={s.actionRow}>
          <PressableScale
            onPress={onStart}
            style={s.startBtn}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={t('templates.start')}
          >
            <Icon name="play-outline" size={16} color={colors.textInverse} />
            <Text style={s.startText}>{t('templates.start')}</Text>
          </PressableScale>
          {mode.kind === 'preset' ? (
            <PressableScale
              onPress={onClone}
              style={s.outlineBtn}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel={t('templates.clone')}
            >
              <Icon name="content-copy" size={14} color={colors.textPrimary} />
              <Text style={s.outlineText}>{t('templates.clone')}</Text>
            </PressableScale>
          ) : null}
          {mode.kind === 'mine' ? (
            <>
              <PressableScale
                onPress={mode.onEdit}
                style={s.smBtn}
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.editTemplate')}
              >
                <Icon name="pencil-outline" size={16} color={colors.textPrimary} />
              </PressableScale>
              <PressableScale
                onPress={mode.onDelete}
                style={[s.smBtn, s.destructiveBtn]}
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.deleteTemplate')}
              >
                <Icon name="trash-can-outline" size={16} color={colors.danger} />
              </PressableScale>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Screen
// ============================================================================

const TAB_BAR_CONTENT_HEIGHT = 56;

export default function TemplatesIndexScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const listPresetTemplates = useAppStore((s) => s.listPresetTemplates);
  const customTemplates = useAppStore((s) => s.customTemplates);
  const cloneTemplate = useAppStore((s) => s.cloneTemplate);
  const startWorkoutFromTemplate = useAppStore((s) => s.startWorkoutFromTemplate);
  const saveCustomTemplate = useAppStore((s) => s.saveCustomTemplate);
  const deleteCustomTemplate = useAppStore((s) => s.deleteCustomTemplate);
  const togglePinTemplate = useAppStore((s) => s.togglePinTemplate);

  const [tab, setTab] = useState<TabKey>('preset');

  const bottomPad =
    Math.max(insets.bottom, spacing.xs) + TAB_BAR_CONTENT_HEIGHT + spacing.xl;

  const { isDark, frameStroke, accentStroke, softShadow } = strokeFromColors(colors);

  const tabOptions = useMemo(
    () => [
      { label: t('templates.tabPreset'), value: 'preset' as const, icon: 'book-open-page-variant' },
      { label: t('templates.tabMine'), value: 'mine' as const, icon: 'folder-heart-outline' },
    ],
    [t]
  );

  const presetTemplates = useMemo(() => listPresetTemplates(), [listPresetTemplates]);

  const notify = useCallback(
    (msg: string, variant: 'success' | 'info' = 'success') => {
      try {
        toast.show({ title: msg, variant });
      } catch {
        /* provider not mounted */
      }
    },
    [toast]
  );

  const handleStart = useCallback(
    (id: string) => {
      safeHaptic('medium');
      startWorkoutFromTemplate(id, 0);
      notify(t('workout.startFromTemplate', { defaultValue: t('templates.start') }), 'success');
      try {
        router.push('/workout/start');
      } catch {
        /* router not ready */
      }
    },
    [notify, router, startWorkoutFromTemplate, t]
  );

  const handleClone = useCallback(
    (presetId: string) => {
      safeHaptic('medium');
      const result = cloneTemplate(presetId);
      if (result) {
        notify(t('templates.clonedToast'), 'success');
        setTab('mine');
      }
    },
    [cloneTemplate, notify, t]
  );

  const handleNewBlank = useCallback(() => {
    safeHaptic('medium');
    saveCustomTemplate({
      name: { zh: t('templates.newNameZh'), en: t('templates.newNameEn') },
      description: { zh: '', en: '' },
      level: 'beginner',
      goal: 'hypertrophy',
      daysPerWeek: 3,
      durationMinPerSession: 45,
      equipmentRequired: [],
      sessions: [],
      sourceId: null,
    });
    notify(t('templates.new'), 'info');
  }, [notify, saveCustomTemplate, t]);

  const handleEdit = useCallback(() => {
    safeHaptic('selection');
    notify(
      t('templates.editSoon'),
      'info'
    );
  }, [i18n.language, notify]);

  const handleDelete = useCallback(
    (tpl: UserPlanTemplate) => {
      const title = t('common.delete');
      const msg = t('templates.deletedToast');
      Alert.alert(title, msg, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            safeHaptic('error');
            deleteCustomTemplate(tpl.id);
            notify(t('templates.deletedToast'), 'success');
          },
        },
      ]);
    },
    [deleteCustomTemplate, notify, t]
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
        // Apple HIG：iPad / 宽屏下限制可读列宽。
        readable: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
          gap: spacing.sm,
          backgroundColor: colors.bg,
        },
        mineBtn: {
          paddingHorizontal: spacing.md,
          minHeight: 34,
          justifyContent: 'center',
          borderRadius: radius.sm,
          backgroundColor: colors.primary + '1A',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        mineBtnText: {
          ...typography.captionBold,
          color: colors.textPrimary,
        },
        topBar: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        newBtnWrap: {
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        newBtn: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.primary + '55',
          paddingVertical: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          ...softShadow,
        },
        newBtnText: {
          ...typography.bodyBold,
          color: colors.primary,
        },
        listWrap: {
          paddingHorizontal: spacing.lg,
        },
      }),
    [accentStroke, colors, softShadow]
  );

  const headerTitle = t('templates.title');

  return (
    <SafeAreaView edges={['top']} style={s.root}>
      <Stack.Screen options={{ headerShown: false, title: headerTitle }} />
      <AppleNavBar
        style={s.readable}
        title={headerTitle}
        onBack={() => router.back()}
        right={
          <PressableScale
            onPress={() => setTab('mine')}
            style={s.mineBtn}
            scaleTo={0.95}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.myTemplates')}
          >
            <Icon name="folder-heart-outline" size={14} color={colors.primary} />
            <Text style={[s.mineBtnText, { color: colors.primary }]}>
              {t('profile.sectionTemplates')}
            </Text>
          </PressableScale>
        }
      />

      <View style={[s.topBar, s.readable]}>
        <SegmentedControl
          options={tabOptions}
          value={tab}
          onChange={(next) => setTab(next as TabKey)}
          highlightColor={colors.primary}
        />
      </View>

      {tab === 'mine' ? (
        <View style={s.newBtnWrap}>
          <PressableScale onPress={handleNewBlank} style={s.newBtn} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={t('templates.new')}>
            <Icon name="plus" size={16} color={colors.primary} />
            <Text style={s.newBtnText}>{t('templates.new')}</Text>
          </PressableScale>
        </View>
      ) : null}

      <ScrollView
        style={s.readable}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'preset' ? (
          <View style={s.listWrap}>
            {presetTemplates.length > 0 ? (
              <SectionHeader
                title={t('templates.tabPreset')}
                icon="book-open-page-variant"
                note={`${presetTemplates.length} · ` + t('templates.noteCurated')}
              />
            ) : null}
            {presetTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                mode={{ kind: 'preset' }}
                onStart={() => handleStart(tpl.id)}
                onClone={() => handleClone(tpl.id)}
              />
            ))}
          </View>
        ) : (
          <View style={s.listWrap}>
            {customTemplates.length === 0 ? (
              <EmptyState
                icon="clipboard-text-clock-outline"
                title={t('workout.templateEmpty')}
                desc={t('workout.templateEmptyHint')}
                actionLabel={t('templates.new')}
                onAction={handleNewBlank}
              />
            ) : (
              <>
                <SectionHeader
                  title={t('templates.tabMine')}
                  icon="folder-heart-outline"
                  note={`${customTemplates.length} · ` + t('templates.noteCustom')}
                />
                {customTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    mode={{
                      kind: 'mine',
                      pinned: !!tpl.pinned,
                      onPin: () => {
                        safeHaptic('selection');
                        togglePinTemplate(tpl.id);
                      },
                      onEdit: handleEdit,
                      onDelete: () => handleDelete(tpl),
                    }}
                    onStart={() => handleStart(tpl.id)}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

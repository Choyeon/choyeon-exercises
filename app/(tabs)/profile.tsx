import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useThemeColors, spacing, radius, layout, muscleColor as muscleColorOf } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { normalizeLanguage } from '@/i18n';
import type { LanguageCode, WeightUnit, OneRmFormula } from '@/types';
import { getAllExercisesSync } from '@/data/queries';
import { displayNameZh } from '@/constants';
import { WEEKLY_GOAL_PRESETS, ONE_RM_FORMULA_LABELS } from '@/constants/settings';
import { BackupSheet } from '@/components/BackupSheet';
import { PlateConfigSheet } from '@/components/PlateConfigSheet';
import {
  PressableScale,
  Icon,
  SlabDivider,
  MiniStat,
  OptionPicker,
  useToast,
} from '@/components/UIKit';
import type { OptionPickerOption } from '@/components/UIKit';
import { safeHaptic } from '@/utils/haptic';
import { formatCompactCount, dateShort } from '@/utils/format';

// APP_VERSION is read from expo-constants manifest at runtime so this file
// never drifts again.  The static literal here is used ONLY as a fallback
// when Constants.expoConfig is unavailable (rare — only in unit tests).
const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ??
  (Constants.manifest?.version as string | undefined) ??
  '1.0.7';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  // Granular subscriptions — only primitive/array references, not the whole
  // store.  Derived figures (exercises/sets/volume/streak) are recomputed via
  // useMemo only when `workouts` reference changes.
  const workouts = useAppStore((s) => s.workouts);
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const resetAllData = useAppStore((s) => s.resetAllData);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRecentPRs = useAppStore((s: any) => s.listRecentPRs);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deletePR = useAppStore((s: any) => s.deletePR);
  const toast = useToast();
  const recentPRs = listRecentPRs(5);

  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';
  const allExercises = useMemo(() => getAllExercisesSync(), []);
  const exMap = useMemo(
    // 双保险 String 强制统一：详见 start.tsx exMap 注释
    () => new Map(allExercises.map((e) => [String(e.id), e])),
    [allExercises]
  );

  // ----------------------------------------------------------
  // Derived stats — computed once per `workouts` reference change.
  // This previously computed values on every render (including unrelated
  // updates like i18n language switching and settings toggles).  Putting
  // all figures (totalWorkouts/totalExercises/totalSets/totalVolume/streak)
  // into a single memoized bundle avoids duplicate work.
  // ----------------------------------------------------------
  const {
    totalWorkouts,
    totalExercises,
    totalSets,
    totalVolume,
    streak,
  } = useMemo(() => {
    const store = useAppStore.getState();
    let volAcc = 0;
    let setAcc = 0;
    // 深度防御：workouts / exercises / sets 逐层归一化，避免历史数据缺字段闪退
    const safeWorkouts = Array.isArray(workouts) ? workouts.filter(Boolean) : [];
    const exerAcc = safeWorkouts.reduce(
      (n, w) => n + (Array.isArray(w?.exercises) ? w.exercises.filter(Boolean).length : 0),
      0
    );
    for (const w of safeWorkouts) {
      if (!Array.isArray(w.exercises)) continue;
      for (const e of w.exercises) {
        if (!e || !Array.isArray(e.sets)) continue;
        for (const set of e.sets) {
          if (set && set.completed) {
            volAcc += (Number(set.weight) || 0) * (Number(set.reps) || 0);
            setAcc += 1;
          }
        }
      }
    }
    return {
      totalWorkouts: safeWorkouts.length,
      totalExercises: exerAcc,
      totalSets: setAcc,
      totalVolume: Math.round(volAcc),
      // Streak math lives only in the store to guarantee the same
      // "yesterday grace" semantics as the Workout tab; avoids the earlier
      // drift where Profile & Workout showed different streak numbers.
      streak: store.streakDays(),
    };
  }, [workouts]);

  // ----------------------------------------------------------
  // OptionPicker (Modal) visibility — only ONE picker open at a time.
  // Replaces the previous 4 "Pressable cycles next in list" interactions
  // which were undiscoverable (3+ value options) and couldn't be
  // screen-read as lists.  Stable callbacks wrapped in useCallback so
  // SettingRow props don't churn re-renders on every state tick.
  // ----------------------------------------------------------
  type PickerKind = 'lang' | 'units' | 'theme' | 'rest' | 'goal' | 'oneRm' | null;
  const [pickerOpen, setPickerOpen] = useState<PickerKind>(null);
  // 备份 / 杠铃配置 —— 内容较多，各自独立成底部面板而不是挤进 OptionPicker
  const [backupOpen, setBackupOpen] = useState(false);
  const [plateOpen, setPlateOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(null), []);
  const openPicker = useCallback((k: Exclude<PickerKind, null>) => {
    safeHaptic('light');
    setPickerOpen(k);
  }, []);

  const toggleKey = useCallback(
    (
      key:
        | 'restTimerEnabled'
        | 'autoRest'
        | 'saveHistory'
        | 'hapticFeedback'
        | 'countOnlyWorkingSets'
    ) => {
      safeHaptic('light');
      setSettings({ [key]: !settings[key] });
    },
    [setSettings, settings]
  );

  const applyUnits = useCallback(
    (next: WeightUnit) => {
      safeHaptic('light');
      setSettings({ units: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const applyLang = useCallback(
    (next: LanguageCode) => {
      safeHaptic('light');
      setSettings({ language: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const applyTheme = useCallback(
    (next: 'dark' | 'light' | 'system') => {
      safeHaptic('light');
      setSettings({ theme: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const applyRestSeconds = useCallback(
    (next: number) => {
      safeHaptic('light');
      setSettings({ defaultRestSeconds: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const applyWeeklyGoal = useCallback(
    (next: number) => {
      safeHaptic('light');
      setSettings({ weeklyGoal: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const applyOneRmFormula = useCallback(
    (next: OneRmFormula) => {
      safeHaptic('light');
      setSettings({ oneRmFormula: next });
      closePicker();
    },
    [setSettings, closePicker]
  );

  const handleReset = () => {
    Alert.alert(t('profile.resetAll'), t('profile.resetAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: () => {
          safeHaptic('warning');
          resetAllData();
        },
      },
    ]);
  };

  // Use normalizeLanguage so locale codes like zh-CN / en-US correctly map to
  // our canonical {zh,en}.  Previous ==='en' check produced wrong label for
  // any regional variant i18next picked up from expo-localization.
  //
  // NOTE: the displayed option uses the CANONICAL normalized language value
  // (not `settings.language`) so even if an older migration wrote 'zh-CN'
  // into storage, the picker still highlights the correct radio entry.
  const currentLang: LanguageCode = normalizeLanguage(
    i18n.language ?? settings.language
  );
  const volumeUnitLabel = useMemo(
    () => (settings.units === 'kg' ? t('workout.unitVolumeKg') : t('workout.unitVolumeLb')),
    [settings.units, t]
  );

  // Picker option arrays — memoized so <OptionPicker /> doesn't churn
  // selected-flag re-renders on each screen render.  Sub-labels provide
  // extra context for accessibility and longer option labels.
  const langOptions: OptionPickerOption<LanguageCode>[] = useMemo(
    () => [
      { value: 'zh', label: t('profile.languageZh'), sublabel: t('profile.optionLangZhSublabel') },
      { value: 'en', label: t('profile.languageEn'), sublabel: t('profile.optionLangEnSublabel') },
    ],
    [t]
  );

  const unitsOptions: OptionPickerOption<WeightUnit>[] = useMemo(
    () => [
      { value: 'kg', label: t('profile.unitsKg'), sublabel: t('profile.optionUnitsKgSublabel') },
      { value: 'lb', label: t('profile.unitsLb'), sublabel: t('profile.optionUnitsLbSublabel') },
    ],
    [t]
  );

  const themeOptions: OptionPickerOption<'dark' | 'light' | 'system'>[] = useMemo(
    () => [
      { value: 'dark', label: t('profile.themeDark'), sublabel: t('profile.optionThemeDarkSublabel') },
      { value: 'light', label: t('profile.themeLight'), sublabel: t('profile.optionThemeLightSublabel') },
      { value: 'system', label: t('profile.themeSystem'), sublabel: t('profile.optionThemeSystemSublabel') },
    ],
    [t]
  );

  const restOptions: OptionPickerOption<number>[] = useMemo(
    () => [
      { value: 60,  label: `60${t('profile.unitRestSeconds')}`,  sublabel: t('profile.optionRest60Sublabel')  },
      { value: 75,  label: `75${t('profile.unitRestSeconds')}`,  sublabel: t('profile.optionRest75Sublabel')  },
      { value: 90,  label: `90${t('profile.unitRestSeconds')}`,  sublabel: t('profile.optionRest90Sublabel')  },
      { value: 120, label: `120${t('profile.unitRestSeconds')}`, sublabel: t('profile.optionRest120Sublabel') },
      { value: 180, label: `180${t('profile.unitRestSeconds')}`, sublabel: t('profile.optionRest180Sublabel') },
    ],
    [t]
  );

  /** 每周目标：0 表示「不设目标」，文案单独给，避免显示成冰冷的 0 */
  const goalOptions: OptionPickerOption<number>[] = useMemo(
    () =>
      WEEKLY_GOAL_PRESETS.map((n) => ({
        value: n,
        label:
          n === 0
            ? t('profile.goalNone', { defaultValue: '不设目标' })
            : t('profile.goalPerWeek', { defaultValue: '每周 {{n}} 次', n }),
        sublabel:
          n === 0
            ? t('profile.goalNoneSub', { defaultValue: '只记录，不做达成度提醒' })
            : t('profile.goalSub', { defaultValue: '一周内完成 {{n}} 次训练即达标', n }),
      })),
    [t]
  );

  const oneRmOptions: OptionPickerOption<OneRmFormula>[] = useMemo(
    () =>
      (Object.keys(ONE_RM_FORMULA_LABELS) as OneRmFormula[]).map((k) => ({
        value: k,
        label: effectiveLang === 'zh' ? ONE_RM_FORMULA_LABELS[k].zh : ONE_RM_FORMULA_LABELS[k].en,
        sublabel: t('profile.oneRmSub', { defaultValue: '影响 1RM 估算与 %1RM 反推' }),
      })),
    [t, effectiveLang]
  );

  const goalCurrentLabel = useMemo(
    () =>
      settings.weeklyGoal === 0
        ? t('profile.goalNone', { defaultValue: '不设目标' })
        : t('profile.goalPerWeek', { defaultValue: '每周 {{n}} 次', n: settings.weeklyGoal }),
    [settings.weeklyGoal, t]
  );

  const oneRmCurrentLabel = useMemo(
    () =>
      effectiveLang === 'zh'
        ? ONE_RM_FORMULA_LABELS[settings.oneRmFormula].zh
        : ONE_RM_FORMULA_LABELS[settings.oneRmFormula].en,
    [settings.oneRmFormula, effectiveLang]
  );

  const langCurrentLabel = useMemo(
    () => (currentLang === 'zh' ? t('profile.languageZh') : t('profile.languageEn')),
    [currentLang, t]
  );

  const unitsCurrentLabel = useMemo(
    () => (settings.units === 'kg' ? t('profile.unitsKg') : t('profile.unitsLb')),
    [settings.units, t]
  );

  const themeCurrentLabel = useMemo(
    () =>
      settings.theme === 'dark'
        ? t('profile.themeDark')
        : settings.theme === 'light'
          ? t('profile.themeLight')
          : t('profile.themeSystem'),
    [settings.theme, t]
  );

  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: layout.paddingHorizontal, paddingTop: spacing.sm },
    header: { marginBottom: spacing.md, minWidth: 0, paddingHorizontal: spacing.md },
    brandLine: {
      color: colors.primary,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '800',
      marginBottom: spacing.xs,
      paddingLeft: spacing.xs,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.6,
      lineHeight: 34,
      color: colors.textPrimary,
      paddingLeft: spacing.xs,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatarTray: {
      width: 54,
      height: 54,
      borderRadius: radius.lg,
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primaryStroke,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLeftCol: {
      flex: 1,
      minWidth: 0,
    },
    heroName: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      color: colors.textPrimary,
      lineHeight: 26,
      marginBottom: spacing.xs,
    },
    heroSubtitle: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    heroRank: {
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    heroRankVal: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
      color: colors.accent,
      lineHeight: 22,
    },
    heroRankLabel: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '800',
      color: colors.textTertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    heroStats: {
      flexDirection: 'row',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.surfaceDivider,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.1,
    },
    sectionCount: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '800',
      color: colors.textTertiary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      flexDirection: 'row',
      alignItems: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      minHeight: 30,
      paddingRight: spacing.sm,
    },
    pillBtnLabel: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      color: colors.textSecondary,
      maxWidth: 140,
    },
    pillInfoAccent:    { color: colors.info },
    pillPrimaryAccent: { color: colors.primary },
    pillWarningAccent: { color: colors.warning },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.danger + '0E',
      borderWidth: 1,
      borderColor: colors.danger + '28',
      marginBottom: spacing.xl,
    },
    dangerIconTray: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger + '18',
    },
    dangerBody: {
      flex: 1,
    },
    dangerTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.danger,
      letterSpacing: -0.1,
      marginBottom: spacing.xs,
    },
    dangerSub: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18,
    },
    versionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    versionText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    gapMd: { height: spacing.md },
    prCardRow: {
      flexDirection: 'row',
      marginHorizontal: -layout.paddingHorizontal + spacing.sm,
      paddingHorizontal: layout.paddingHorizontal - spacing.sm,
      marginBottom: spacing.md,
    },
    prMiniCard: {
      width: 200,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginRight: spacing.sm,
      overflow: 'hidden',
      flexShrink: 0,
    },
    prTopStripe: {
      height: 4,
      width: '100%',
    },
    prCardBody: {
      padding: spacing.md,
    },
    prCardName: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.1,
      marginBottom: spacing.xs,
    },
    prCardValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    prCardStats: {
      flex: 1,
      minWidth: 0,
    },
    prCardValue: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.textPrimary,
      letterSpacing: -0.1,
      lineHeight: 18,
    },
    prCardDate: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: spacing.xs,
    },
    prDeleteBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger + '10',
      borderWidth: 1,
      borderColor: colors.danger + '22',
      flexShrink: 0,
    },
    prPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: colors.accent + '12',
      borderColor: colors.accent + '30',
      minHeight: 26,
    },
    prPillText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '800',
      color: colors.accent,
      letterSpacing: 0.1,
    },
    bottomInset: {
      height:
        Math.max(insets.bottom, spacing.xs)
        + (Platform.OS === 'ios' ? 58 : 56)
        + spacing.xxl,
    },
  }), [colors, insets.bottom]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER / PROFILE */}
        <View style={styles.header}>
          <Text style={styles.brandLine}>{t('ui.brandProfile')}</Text>
          <Text style={styles.title}>{t('profile.title')}</Text>
        </View>

        {/* =================== STATS =================== */}
        <SlabDivider accent={colors.primary} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.statsTitle')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="chart-box" size={10} color={colors.textTertiary} />
          </Text>
        </View>
        <View style={styles.statsRow}>
          <MiniStat
            label={t('profile.statSessions')}
            value={`${totalWorkouts}`}
            unit={t('profile.statUnits')}
            icon="dumbbell"
            iconColor={colors.primary}
          />
          <MiniStat
            label={t('profile.statStreak')}
            value={`${streak}`}
            unit={t('profile.statUnits')}
            // 'flame' 是 Ionicons 的叫法，MaterialCommunityIcons 里叫 'fire'。
            // 用错字体名不会报错，只会静默渲染成问号。
            icon="fire"
            iconColor={colors.accent}
          />
          <MiniStat
            label={t('profile.statVolume')}
            value={formatCompactCount(totalVolume)}
            unit={volumeUnitLabel}
            icon="lightning-bolt"
            iconColor={colors.success}
          />
          <MiniStat
            label={t('profile.statFavorites')}
            value={`${favoriteIds.length}`}
            unit={t('profile.statUnitFav')}
            icon="heart-outline"
            iconColor={colors.info}
          />
        </View>

        {/* =================== SETTINGS =================== */}
        <SlabDivider accent={colors.primary} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.sectionGeneral')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="cog" size={10} color={colors.textTertiary} /> {t('profile.version')} {APP_VERSION}
          </Text>
        </View>

        <SettingRow
          icon="translate"
          label={t('profile.language')}
          desc={t('profile.languageDesc')}
          accent={colors.info}
          right={
            <PressableScale onPress={() => openPicker('lang')} style={styles.pillBtn} accessibilityRole="button" accessibilityLabel={t('a11y.changeLanguage')}>
              <Text style={[styles.pillBtnLabel, styles.pillInfoAccent]}>
                {langCurrentLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.info} />
            </PressableScale>
          }
        />

        <SettingRow
          icon="weight-kilogram"
          label={t('profile.units')}
          desc={t('profile.unitsDesc')}
          accent={colors.primary}
          right={
            <PressableScale onPress={() => openPicker('units')} style={styles.pillBtn} accessibilityRole="button" accessibilityLabel={t('a11y.changeUnits')}>
              <Text style={[styles.pillBtnLabel, styles.pillPrimaryAccent]}>
                {unitsCurrentLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.primary} />
            </PressableScale>
          }
        />

        <SettingRow
          icon="theme-light-dark"
          label={t('profile.appearance')}
          desc={t('profile.themeDesc')}
          accent={colors.muscle.shoulders}
          right={
            <PressableScale onPress={() => openPicker('theme')} style={styles.pillBtn} accessibilityRole="button" accessibilityLabel={t('a11y.changeTheme')}>
              <Text style={styles.pillBtnLabel}>
                {themeCurrentLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.textSecondary} />
            </PressableScale>
          }
        />

        {/* section: Training */}
        <SlabDivider accent={colors.muscle.back} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.sectionTraining')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="clock-outline" size={10} color={colors.textTertiary} /> {settings.defaultRestSeconds}s
          </Text>
        </View>

        <SettingRow
          icon="timer-sand"
          label={t('profile.restTimerEnabled')}
          desc={t('profile.restTimerDesc')}
          accent={colors.accent}
          right={
            <Switch
              value={settings.restTimerEnabled}
              onValueChange={() => toggleKey('restTimerEnabled')}
              thumbColor={settings.restTimerEnabled ? colors.primary : colors.textTertiary}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary + '66' }}
              ios_backgroundColor={colors.surfaceElevated}
            />
          }
        />

        <SettingRow
          icon="autorenew"
          label={t('profile.autoRest')}
          desc={t('profile.autoRestDesc')}
          accent={colors.success}
          right={
            <Switch
              value={settings.autoRest}
              onValueChange={() => toggleKey('autoRest')}
              thumbColor={settings.autoRest ? colors.success : colors.textTertiary}
              trackColor={{ false: colors.surfaceElevated, true: colors.success + '66' }}
              ios_backgroundColor={colors.surfaceElevated}
            />
          }
        />

        <SettingRow
          icon="content-save-outline"
          label={t('profile.saveHistory')}
          desc={t('profile.saveHistoryDesc')}
          accent={colors.info}
          right={
            <Switch
              value={settings.saveHistory}
              onValueChange={() => toggleKey('saveHistory')}
              thumbColor={settings.saveHistory ? colors.info : colors.textTertiary}
              trackColor={{ false: colors.surfaceElevated, true: colors.info + '66' }}
              ios_backgroundColor={colors.surfaceElevated}
            />
          }
        />

        <SettingRow
          icon="vibrate"
          label={t('profile.hapticFeedback')}
          desc={t('profile.hapticDesc')}
          accent={colors.muscle.back}
          right={
            <Switch
              value={settings.hapticFeedback}
              onValueChange={() => toggleKey('hapticFeedback')}
              thumbColor={settings.hapticFeedback ? colors.muscle.back : colors.textTertiary}
              trackColor={{ false: colors.surfaceElevated, true: colors.muscle.back + '66' }}
              ios_backgroundColor={colors.surfaceElevated}
            />
          }
        />

        <SettingRow
          icon="timer-outline"
          label={t('profile.defaultRestSeconds')}
          desc={t('profile.defaultRestDesc')}
          accent={colors.warning}
          right={
            <PressableScale
              onPress={() => openPicker('rest')}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.changeRestSeconds')}
            >
              <Text style={[styles.pillBtnLabel, styles.pillWarningAccent]}>
                {settings.defaultRestSeconds}
                {t('profile.unitRestSeconds')}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.warning} />
            </PressableScale>
          }
        />

        {/* section: 目标与计算口径（v5） */}
        <SlabDivider accent={colors.muscle['upper legs']} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('profile.sectionGoal', { defaultValue: '目标与计算' })}
          </Text>
          <Text style={styles.sectionCount}>
            <Icon name="target" size={10} color={colors.textTertiary} />
          </Text>
        </View>

        <SettingRow
          icon="calendar-check"
          label={t('profile.weeklyGoal', { defaultValue: '每周训练目标' })}
          desc={t('profile.weeklyGoalDesc', {
            defaultValue: '决定首页与数据面板的「本周达成度」进度环。',
          })}
          accent={colors.success}
          right={
            <PressableScale
              onPress={() => openPicker('goal')}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.changeWeeklyGoal', { defaultValue: '修改每周目标' })}
            >
              <Text style={[styles.pillBtnLabel, { color: colors.success }]}>
                {goalCurrentLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.success} />
            </PressableScale>
          }
        />

        <SettingRow
          icon="chart-line"
          label={t('profile.oneRmFormula', { defaultValue: '1RM 估算公式' })}
          desc={t('profile.oneRmFormulaDesc', {
            defaultValue: '训练页的实时 1RM 徽标与强度百分比按此公式计算。',
          })}
          accent={colors.accent}
          right={
            <PressableScale
              onPress={() => openPicker('oneRm')}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.changeOneRmFormula', { defaultValue: '修改 1RM 公式' })}
            >
              <Text style={[styles.pillBtnLabel, { color: colors.accent }]} numberOfLines={1}>
                {oneRmCurrentLabel}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.accent} />
            </PressableScale>
          }
        />

        <SettingRow
          icon="filter-outline"
          label={t('profile.countOnlyWorkingSets', { defaultValue: '容量只统计正式组' })}
          desc={t('profile.countOnlyWorkingSetsDesc', {
            defaultValue: '开启后热身组不计入总容量与统计；关闭则全部计入。',
          })}
          accent={colors.info}
          right={
            <Switch
              value={settings.countOnlyWorkingSets}
              onValueChange={() => toggleKey('countOnlyWorkingSets')}
              thumbColor={settings.countOnlyWorkingSets ? colors.info : colors.textTertiary}
              trackColor={{ false: colors.surfaceElevated, true: colors.info + '66' }}
              ios_backgroundColor={colors.surfaceElevated}
            />
          }
        />

        <SettingRow
          icon="calculator-variant-outline"
          label={t('profile.plateConfig', { defaultValue: '杠铃配置' })}
          desc={t('profile.plateConfigDesc', {
            defaultValue: '设置空杆重量与你健身房实际有的片，配重计算才准。',
          })}
          accent={colors.warning}
          right={
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                setPlateOpen(true);
              }}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openPlateConfig', { defaultValue: '打开杠铃配置' })}
            >
              <Text style={[styles.pillBtnLabel, styles.pillWarningAccent]}>
                {settings.plateConfig.barWeight}
                {settings.units}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.warning} />
            </PressableScale>
          }
        />

        {/* section: 数据备份（纯文本，零权限零联网） */}
        <SlabDivider accent={colors.muscle.chest} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('backup.title', { defaultValue: '备份与恢复' })}
          </Text>
          <Text style={styles.sectionCount}>
            <Icon name="shield-check-outline" size={10} color={colors.textTertiary} />
          </Text>
        </View>
        <SettingRow
          icon="database-export-outline"
          label={t('profile.backup', { defaultValue: '导出 / 导入数据' })}
          desc={t('profile.backupDesc', {
            defaultValue: '全部数据都在本机。导出为一段文本自行保存；换机时贴回即可恢复。',
          })}
          accent={colors.primary}
          right={
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                setBackupOpen(true);
              }}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openBackup', { defaultValue: '打开备份' })}
            >
              <Text style={[styles.pillBtnLabel, styles.pillPrimaryAccent]}>
                {t('profile.backupOpen', { defaultValue: '打开' })}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.primary} />
            </PressableScale>
          }
        />

        {/* =================== MY CONTENT: 模板 + 身体数据 (v1.1.0 MVP) =================== */}
        <SlabDivider accent={colors.primary} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.sectionTemplates')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="clipboard-list-outline" size={10} color={colors.textTertiary} />
          </Text>
        </View>
        <SettingRow
          icon="clipboard-play-outline"
          label={t('profile.openTemplates')}
          // 命名空间是 workout.*，不是 templates.* —— 后者整个命名空间
          // 在翻译资源里根本不存在，写错就等于把 key 名当文案渲染出来。
          desc={t('workout.templateEmptyHint')}
          accent={colors.primary}
          right={
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                router.push('/templates' as any);
              }}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openTemplates')}
            >
              <Text style={[styles.pillBtnLabel, styles.pillPrimaryAccent]}>
                {t('templates.title')}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.primary} />
            </PressableScale>
          }
        />
        <SlabDivider accent={colors.accent} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.sectionBody')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="ruler" size={10} color={colors.textTertiary} />
          </Text>
        </View>
        <SettingRow
          icon="scale-bathroom"
          label={t('profile.openBody')}
          desc={t('body.emptyHint')}
          accent={colors.accent}
          right={
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                router.push('/body' as any);
              }}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openBodyMetrics')}
            >
              <Text style={styles.pillBtnLabel}>
                {t('body.title')}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.accent} />
            </PressableScale>
          }
        />

        {/* section: Warmup / Stretching */}
        <SlabDivider accent={colors.info} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('warmup.section', { defaultValue: 'Warmup & Stretching' })}
          </Text>
          <Text style={styles.sectionCount}>
            <Icon name="fire" size={10} color={colors.textTertiary} />
          </Text>
        </View>
        <SettingRow
          icon="fire"
          label={t('warmup.openFromProfile', { defaultValue: 'Open Warmup' })}
          desc={t('warmup.emptyHint', {
            defaultValue:
              'Dynamic warmup before training + static stretches post-workout to reduce injury risk.',
          })}
          accent={colors.info}
          right={
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                router.push('/warmup' as any);
              }}
              style={styles.pillBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openWarmup')}
            >
              <Text style={[styles.pillBtnLabel, styles.pillInfoAccent]}>
                {t('warmup.title', { defaultValue: 'Warmup' })}
              </Text>
              <Icon name="chevron-right" size={11} color={colors.info} />
            </PressableScale>
          }
        />

        {/* =================== RECENT PRs SECTION =================== */}
        <SlabDivider accent={colors.accent} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {(t('pr.sectionTop') || 'Recent PRs')}
          </Text>
          <View style={styles.prPill}>
            <Icon name="trophy-outline" size={10} color={colors.accent} />
            <Text style={styles.prPillText}>{recentPRs.length}</Text>
          </View>
        </View>

        {recentPRs.length === 0 ? (
          <SettingRow
            icon="trophy-outline"
            label={(t('pr.noneYet') || 'No PR yet')}
            desc={t('pr.startHint')}
            accent={colors.info}
            right={
              <PressableScale
                onPress={() => {
                  safeHaptic('light');
                  router.push('/(tabs)/workout' as any);
                }}
                style={[styles.pillBtn, { backgroundColor: colors.info + '12', borderColor: colors.info + '30' }]}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.startWorkout')}
              >
                <Text style={[styles.pillBtnLabel, { color: colors.info }]}>
                  Start →
                </Text>
              </PressableScale>
            }
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.prCardRow}
          >
            {recentPRs.map((pr: any) => {
              const exInfo = exMap.get(String(pr.exerciseId));
              const dispName = effectiveLang === 'zh'
                ? (exInfo ? displayNameZh(exInfo) : pr.exerciseId)
                : (exInfo?.name || pr.exerciseId);
              const muscleColor = exInfo ? muscleColorOf(colors, exInfo.body_part) : colors.primary;
              const bestText = t('pr.badgeBest', {
                weight: pr.weight,
                units: settings.units,
                reps: pr.reps,
                date: dateShort(pr.date),
              });
              // Remove 🏆 prefix if present (cleaner compact card display)
              const cleanedText = typeof bestText === 'string'
                ? bestText.replace(/^🏆\s*/u, '')
                : `${pr.weight ?? 0}${settings.units} × ${pr.reps ?? 0} · ${dateShort(pr.date)}`;
              return (
                <View key={pr.id} style={styles.prMiniCard}>
                  <View style={[styles.prTopStripe, { backgroundColor: muscleColor }]} />
                  <View style={styles.prCardBody}>
                    <Text style={styles.prCardName} numberOfLines={1}>
                      {dispName}
                    </Text>
                    <View style={styles.prCardValueRow}>
                      <View style={styles.prCardStats}>
                        <Text style={styles.prCardValue} numberOfLines={1}>
                          {cleanedText}
                        </Text>
                        <Text style={styles.prCardDate}>{dateShort(pr.date)}</Text>
                      </View>
                      <PressableScale
                        onPress={() => {
                          safeHaptic('warning');
                          Alert.alert(
                            t('common.confirm') || 'Confirm',
                            t('pr.deleteConfirm') || 'Delete this PR record?',
                            [
                              { text: t('common.cancel') || 'Cancel', style: 'cancel' },
                              {
                                text: t('common.delete') || 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                  deletePR(pr.id);
                                  safeHaptic('success');
                                  toast.show({
                                    title: t('pr.deleted') || 'PR deleted',
                                    variant: 'success',
                                  });
                                },
                              },
                            ]
                          );
                        }}
                        hitSlop={4}
                        style={styles.prDeleteBtn}
                        scaleTo={0.92}
                        accessibilityRole="button"
                        accessibilityLabel={t('a11y.deletePR')}
                      >
                        <Icon name="trash-can-outline" size={13} color={colors.danger} />
                      </PressableScale>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* =================== INFO / DATA =================== */}
        <SlabDivider accent={colors.info} />
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('profile.sectionData')}</Text>
          <Text style={styles.sectionCount}>
            <Icon name="information-outline" size={10} color={colors.textTertiary} /> {t('profile.about')}
          </Text>
        </View>

        <InfoCard
          icon="database-outline"
          title={t('profile.dataStorage')}
          desc={t('profile.aboutBody')}
          accent={colors.info}
        />
        <InfoCard
          icon="book-open-page-variant"
          title={t('profile.datasetCredits')}
          desc={t('app.poweredBy')}
          accent={colors.muscle.chest}
        />
        <InfoCard
          icon="shield-alert-outline"
          title={t('profile.dataResetInfo')}
          desc={t('profile.resetAllConfirm')}
          accent={colors.warning}
        />

        {/* DANGER ZONE */}
        <SlabDivider accent={colors.danger} />
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>{t('profile.resetAll')}</Text>
        </View>
        <PressableScale
          onPress={handleReset}
          style={styles.dangerBtn}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={t('profile.resetAll')}
        >
          <View style={styles.dangerIconTray}>
            <Icon name="trash-can-outline" size={16} color={colors.danger} />
          </View>
          <View style={styles.dangerBody}>
            <Text style={styles.dangerTitle}>{t('profile.resetAll')}</Text>
            <Text style={styles.dangerSub}>
              {t('profile.resetAllConfirm')}
            </Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.danger} />
        </PressableScale>

        {/* App version footer */}
        <View style={styles.versionRow}>
          <Icon name="copyright" size={10} color={colors.textTertiary} />
          <Text style={styles.versionText}>
            {t('app.title')} · v{APP_VERSION}
          </Text>
        </View>
        <View style={styles.bottomInset} />
      </ScrollView>

      {/* ============================================================
          OptionPicker Modals — all 4 pickers share a single visibility
          state (pickerOpen) so only one modal can ever be mounted at
          a time, avoiding stacked modals and broken tap-through.
          ============================================================ */}
      <OptionPicker<LanguageCode>
        visible={pickerOpen === 'lang'}
        title={t('profile.pickerTitleLanguage')}
        options={langOptions}
        value={currentLang}
        onSelect={applyLang}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.info}
      />
      <OptionPicker<WeightUnit>
        visible={pickerOpen === 'units'}
        title={t('profile.pickerTitleUnits')}
        options={unitsOptions}
        value={settings.units}
        onSelect={applyUnits}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.primary}
      />
      <OptionPicker<'dark' | 'light' | 'system'>
        visible={pickerOpen === 'theme'}
        title={t('profile.pickerTitleTheme')}
        options={themeOptions}
        value={settings.theme}
        onSelect={applyTheme}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.muscle.shoulders}
      />
      <OptionPicker<number>
        visible={pickerOpen === 'rest'}
        title={t('profile.pickerTitleRest')}
        options={restOptions}
        value={settings.defaultRestSeconds}
        onSelect={applyRestSeconds}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.warning}
      />
      <OptionPicker<number>
        visible={pickerOpen === 'goal'}
        title={t('profile.pickerTitleGoal', { defaultValue: '每周训练目标' })}
        options={goalOptions}
        value={settings.weeklyGoal}
        onSelect={applyWeeklyGoal}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.success}
      />
      <OptionPicker<OneRmFormula>
        visible={pickerOpen === 'oneRm'}
        title={t('profile.pickerTitleOneRm', { defaultValue: '1RM 估算公式' })}
        options={oneRmOptions}
        value={settings.oneRmFormula}
        onSelect={applyOneRmFormula}
        onClose={closePicker}
        cancelLabel={t('common.cancel')}
        accent={colors.accent}
      />

      {/* 备份 / 杠铃配置 —— 内容比 OptionPicker 复杂，独立成底部面板 */}
      <BackupSheet visible={backupOpen} onClose={() => setBackupOpen(false)} />
      <PlateConfigSheet
        visible={plateOpen}
        config={settings.plateConfig}
        unit={settings.units}
        onClose={() => setPlateOpen(false)}
        onChange={(next) => {
          setSettings({ plateConfig: next });
          safeHaptic('success');
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================
// Sub components
// ============================================================

function SettingRow({
  icon,
  label,
  desc,
  accent,
  right,
}: {
  icon: string;
  label: string;
  desc?: string;
  accent?: string;
  right: React.ReactNode;
}) {
  const colors = useThemeColors();
  const s = useMemo(() => StyleSheet.create({
    sRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    sIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sBody: {
      flex: 1,
      minWidth: 0,
      paddingRight: spacing.sm,
    },
    sLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.1,
      marginBottom: spacing.xs,
    },
    sDesc: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18,
    },
  }), [colors]);
  const accentColor = accent ?? colors.primary;
  return (
    <View style={s.sRow}>
      <View
        style={[
          s.sIcon,
          { backgroundColor: accentColor + '16' },
        ]}
      >
        <Icon name={icon} size={16} color={accentColor} />
      </View>
      <View style={s.sBody}>
        <Text style={s.sLabel} numberOfLines={1}>
          {label}
        </Text>
        {desc ? (
          <Text style={s.sDesc} numberOfLines={2}>
            {desc}
          </Text>
        ) : null}
      </View>
      <View>{right}</View>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  desc,
  accent,
}: {
  icon: string;
  title: string;
  desc: string;
  accent: string;
}) {
  const colors = useThemeColors();
  const i = useMemo(() => StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: spacing.sm,
    },
    left: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
      letterSpacing: -0.1,
      marginBottom: spacing.xs,
    },
    desc: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 18,
    },
  }), [colors]);
  return (
    <View style={i.card}>
      <View
        style={[
          i.left,
          { backgroundColor: accent + '14', borderColor: accent + '33' },
        ]}
      >
        <Icon name={icon} size={16} color={accent} />
      </View>
      <View style={i.body}>
        <Text style={[i.title, { color: accent }]} numberOfLines={1}>{title}</Text>
        <Text style={i.desc} numberOfLines={3}>{desc}</Text>
      </View>
    </View>
  );
}

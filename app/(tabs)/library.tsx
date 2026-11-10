// v1.0.1-REDESIGNED — LibraryScreen v2 [4HorizontalRails][112dpCards]
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import type { BodyPart, Exercise } from '@/types';
import {
  useThemeColors,
  spacing,
  radius,
  layout,
  typography,
  getFrameStroke,
  getAccentStroke,
  getSoftShadow,
  muscleColor,
} from '@/theme';
import { useExercisesStore } from '@/data/exercises-store';
import {
  SearchBar,
  Icon,
  EmptyState,
  PressableScale,
  Skeleton,
  HybridImage,
} from '@/components/UIKit';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAppStore } from '@/store/useAppStore';
import { safeHaptic } from '@/utils/haptic';
import {
  labelForBodyPart,
  labelForEquipment,
  labelForMuscle,
  translateTargetPhrase,
  BODY_REGIONS,
  EQUIPMENT_GROUPS,
  type BodyRegion,
  type EquipmentGroup,
  iconForBodyPart,
  iconForEquipment,
  displayNameZh,
  getImageUrl,
} from '@/constants';

// ============================================================================
// Constants
// ============================================================================

type TopTab = 'all' | 'favorites';
const TOP_TABS: { key: TopTab; icon: string; labelKey: string }[] = [
  { key: 'all', icon: 'view-grid-outline', labelKey: 'library.tabAll' },
  { key: 'favorites', icon: 'heart-outline', labelKey: 'library.tabFavorites' },
];

// Rail B: 10 canonical BodyParts (matches dataset)
const BODY_PARTS: BodyPart[] = [
  'chest',
  'back',
  'upper legs',
  'shoulders',
  'upper arms',
  'lower arms',
  'waist',
  'lower legs',
  'cardio',
  'neck',
];

// Rail D: top 13 equipment (canonical primary + other)
const EQUIPMENT: string[] = [
  'body weight',
  'dumbbell',
  'cable',
  'barbell',
  'leverage machine',
  'band',
  'smith machine',
  'kettlebell',
  'weighted',
  'stability ball',
  'ez barbell',
  'assisted',
  'other',
];

// ============================================================================
// Muscle ring color + icon utilities
//
// 视觉一致性（v1.0.13 收口）：此前这里硬编码了 8 个色值
// (#E8716B / #4A9B8A / #6388F0 / #E8B34D / #B47CD0 / #7CC176 / #F284A4 / #7D9199)
// 与 theme.colors.muscle 的十色体系完全不同 —— 导致同一肌肉群在
// Library 环圈和 Exercise 详情页标签上呈现两种颜色，整体显得杂乱。
// 现统一改由 theme 的 muscle 调色板供给，并接受 colors 参数以支持明暗主题。
// ============================================================================

interface MuscleColors {
  muscle: {
    back: string;
    cardio: string;
    chest: string;
    'lower arms': string;
    'lower legs': string;
    neck: string;
    shoulders: string;
    'upper arms': string;
    'upper legs': string;
    waist: string;
  };
  primary: string;
}

function muscleRingMeta(
  bodyPartKey: string,
  colors: MuscleColors
): { color: string; icon: string } {
  const bp = bodyPartKey ?? '';
  const fallback = colors.muscle.chest ?? colors.primary;
  const m = colors.muscle as unknown as Record<string, string | undefined>;
  const colorFor = (key: string) => m[key] ?? fallback;

  // chest group
  if (bp === 'chest') return { color: colorFor('chest'), icon: 'heart-pulse' };
  // back group
  // 'spine' 不是 MaterialCommunityIcons 的图标名（该字体里没有 spine），
  // 非法名会被渲染成一个问号方块。改用 human-handsdown 表示躯干背面。
  if (bp === 'back') return { color: colorFor('back'), icon: 'human-handsdown' };
  // legs group
  // 同理，'leg' 也不存在 —— 该字体里只有 seat-legroom-* 这类座位图标。
  // 腿部用 run（跑动的人形），上下肢分别换 distinct 的两个更便于一眼区分。
  if (bp === 'upper legs') return { color: colorFor('upper legs'), icon: 'run-fast' };
  if (bp === 'lower legs') return { color: colorFor('lower legs'), icon: 'walk' };
  // shoulders group
  if (bp === 'shoulders') return { color: colorFor('shoulders'), icon: 'arm-flex-outline' };
  // arms group
  if (bp === 'upper arms') return { color: colorFor('upper arms'), icon: 'dumbbell' };
  if (bp === 'lower arms') return { color: colorFor('lower arms'), icon: 'dumbbell' };
  // core / waist
  if (bp === 'waist') return { color: colorFor('waist'), icon: 'weight-lifter' };
  // cardio
  if (bp === 'cardio') return { color: colorFor('cardio'), icon: 'run-fast' };
  // neck
  if (bp === 'neck') return { color: colorFor('neck'), icon: 'account-cowboy-hat-outline' };
  // fallback
  return { color: fallback, icon: 'dumbbell' };
}

// ============================================================================
// Main Screen
// ============================================================================

/** 模块级 useDebounce — 修复每次渲染都重新创建 hook 闭包导致的性能问题 */
function useDebounce<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function LibraryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ bodyPart?: string; equipment?: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const currentLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const store = useExercisesStore();
  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const addExerciseToActive = useAppStore((s) => s.addExerciseToActive);
  const activeWorkout = useAppStore((s) => s.activeWorkout);

  useEffect(() => {
    store.ensureReady();
  }, [store]);

  // ===== Filter state =====
  const [activeTab, setActiveTab] = useState<TopTab>('all');
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion>('all');
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | null>(
    (params.bodyPart as BodyPart) ?? null,
  );
  const [selectedEquipGroup, setSelectedEquipGroup] = useState<EquipmentGroup>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(
    params.equipment ?? null,
  );
  const [searchText, setSearchText] = useState('');
  const [forceShowFilters, setForceShowFilters] = useState(false);

  // ===== Debounced search (fallback if searchText direct is acceptable) =====
  const debouncedSearch = useDebounce(searchText);

  // ====== Derived filter data ======
  const bodyPartCounts = useMemo(() => store.countByBodyPart(), [store, store.ready]);
  const equipmentCounts = useMemo(() => store.countByEquipment(), [store, store.ready]);

  const getMuscleColor = useCallback(
    (key: string | null | undefined) => muscleRingMeta(key ?? '', colors).color,
    [colors],
  );
  const getMuscleIcon = useCallback(
    (key: string | null | undefined) => muscleRingMeta(key ?? '', colors).icon,
    [colors],
  );

  // bodyPart count map for quick lookup on Rail B badges
  const bpCountMap = useMemo(() => {
    const m = new Map<string, number>();
    bodyPartCounts.forEach((r) => m.set(r.bodyPart, r.count));
    return m;
  }, [bodyPartCounts]);

  const eqCountMap = useMemo(() => {
    const m = new Map<string, number>();
    equipmentCounts.forEach((r) => m.set(r.equipment, r.count));
    return m;
  }, [equipmentCounts]);

  const filteredExercises = useMemo(() => {
    let bodyPartFilter: BodyPart | null = selectedBodyPart;
    if (!bodyPartFilter && selectedRegion !== 'all') {
      const parts = BODY_REGIONS.find((r) => r.key === selectedRegion)?.parts ?? [];
      if (parts.length === 1) bodyPartFilter = parts[0];
    }
    const equipmentFilter: string | null = selectedEquipment;
    const base = store.filter({
      bodyPart: bodyPartFilter,
      equipment: equipmentFilter,
      searchQuery: debouncedSearch });
    if (activeTab === 'favorites') {
      const set = new Set(favoriteIds);
      return base.filter((ex) => set.has(ex.id));
    }
    return base;
  }, [
    activeTab,
    favoriteIds,
    selectedRegion,
    selectedBodyPart,
    selectedEquipGroup,
    selectedEquipment,
    debouncedSearch,
    store,
    store.ready,
  ]);

  const hasAnyFilter =
    activeTab === 'favorites' ||
    selectedRegion !== 'all' ||
    selectedBodyPart !== null ||
    selectedEquipGroup !== 'all' ||
    selectedEquipment !== null ||
    searchText.trim().length > 0;

  // ===== Handlers =====
  const tap = useCallback(
    (fn: () => void, kind: 'light' | 'selection' | 'success' = 'light') => {
      safeHaptic(kind);
      fn();
    },
    [],
  );

  const handleTabPress = useCallback(
    (next: TopTab) =>
      tap(() => {
        setActiveTab(next);
      }, 'selection'),
    [tap],
  );

  const handleRegionPress = useCallback(
    (region: BodyRegion) =>
      tap(() => {
        setSelectedRegion((prev) => {
          const next = prev === region ? 'all' : region;
          if (next !== prev) setSelectedBodyPart(null);
          return next;
        });
      }, 'selection'),
    [tap],
  );

  const handleBodyPartPress = useCallback(
    (bodyPart: BodyPart) =>
      tap(() => {
        setSelectedBodyPart((prev) => (prev === bodyPart ? null : bodyPart));
        const region = BODY_REGIONS.find((r) => r.parts.includes(bodyPart));
        if (region) setSelectedRegion(region.key);
      }, 'selection'),
    [tap],
  );

  const handleEquipGroupPress = useCallback(
    (group: EquipmentGroup) =>
      tap(() => {
        setSelectedEquipGroup((prev) => {
          const next = prev === group ? 'all' : group;
          if (next !== prev) setSelectedEquipment(null);
          return next;
        });
      }, 'selection'),
    [tap],
  );

  const handleEquipmentPress = useCallback(
    (equipment: string) =>
      tap(() => {
        setSelectedEquipment((prev) => (prev === equipment ? null : equipment));
        const group = EQUIPMENT_GROUPS.find((g) => g.items.includes(equipment));
        if (group) setSelectedEquipGroup(group.key);
      }, 'selection'),
    [tap],
  );

  const handleReset = useCallback(
    () =>
      tap(() => {
        setSelectedRegion('all');
        setSelectedBodyPart(null);
        setSelectedEquipGroup('all');
        setSelectedEquipment(null);
        setSearchText('');
        setForceShowFilters(false);
      }),
    [tap],
  );

  const quickAdd = useCallback(
    (id: string) => {
      if (!activeWorkout) startWorkout();
      safeHaptic('success');
      addExerciseToActive(id);
    },
    [activeWorkout, startWorkout, addExerciseToActive],
  );

  const goDetail = useCallback(
    (id: string) =>
      tap(() => {
        router.push({
          pathname: '/exercise/[id]',
          params: { id } } as Parameters<typeof router.push>[0]);
      }),
    [tap, router],
  );

  // ===== Theme tokens + styles =====
  const isDark = colors.bg === '#000000';
  const frameStroke = getFrameStroke(isDark);
  const accentStroke = getAccentStroke(colors.primary);
  const softShadow = getSoftShadow(isDark);

  const bottomPad = useMemo(
    () =>
      Math.max(insets.bottom, spacing.xs) +
      layout.floatingTabBar.bottomGap +
      layout.floatingTabBar.height +
      layout.floatingTabBar.contentGap,
    [insets.bottom],
  );

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },

        // Apple HIG：iPad / 宽屏下限制可读列宽，避免超长行距损害可读性。
        readable: {
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center' },

        // Top bar area — Apple HIG large title + search + segmented tabs
        topBar: {
          paddingHorizontal: layout.paddingHorizontal,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          gap: spacing.md },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing.md },
        titleLeft: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: spacing.xs },
        pageTitle: {
          ...typography.display,
          color: colors.textPrimary,
          letterSpacing: -0.5 },
        titleCount: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '400',
          letterSpacing: -0.1,
          color: colors.textSecondary,
          flexShrink: 1,
          minWidth: 0 },
        searchWrap: { flex: 1, maxWidth: 320, flexShrink: 1 },

        // ===== 4 Rails area =====
        railsWrap: {
          gap: spacing.sm,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs },
        railContent: {
          paddingHorizontal: layout.paddingHorizontal,
          gap: spacing.sm },

        // Region chip (Rail A): 36dp height
        regionChip: {
          height: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surface },
        regionChipActive: {
          backgroundColor: colors.primary + '29',
          borderColor: colors.primary },
        regionChipText: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '700',
          color: colors.textSecondary },
        regionChipTextActive: {
          color: colors.primary,
          fontWeight: '700' },

        // BodyPart chip (Rail B): 40dp height, #XX index + icon + name + count
        bpChip: {
          height: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingRight: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surface,
          ...softShadow,
          elevation: isDark ? 4 : 2 },
        bpChipActive: {
          borderColor: accentStroke },
        bpIndexPill: {
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surfaceElevated },
        bpIndexText: {
          fontSize: 9,
          lineHeight: 12,
          fontWeight: '700',
          letterSpacing: 0.4,
          color: colors.textTertiary },
        bpIndexPillActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary },
        bpIndexTextActive: {
          color: colors.textInverse },
        bpText: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '700',
          color: colors.textPrimary },
        bpTextActive: {
          fontWeight: '700' },
        bpCountBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.surfaceElevated },
        bpCountBadgeActive: {
          backgroundColor: colors.primary + '1F' },
        bpCountText: {
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '700',
          color: colors.textTertiary,
          letterSpacing: 0.2 },
        bpCountTextActive: {
          color: colors.primary },

        // Equipment group chip (Rail C): 36dp height
        eqgChip: {
          height: 36,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surface },
        eqgChipActive: {
          backgroundColor: colors.info + '1F',
          borderColor: colors.info },
        eqgChipText: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '700',
          color: colors.textSecondary },
        eqgChipTextActive: {
          color: colors.info,
          fontWeight: '700' },

        // Equipment chip (Rail D): 40dp height
        eqChip: {
          height: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surface,
          ...softShadow,
          elevation: isDark ? 4 : 2 },
        eqChipActive: {
          backgroundColor: colors.info + '1F',
          borderColor: colors.info },
        eqText: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '700',
          color: colors.textPrimary },
        eqTextActive: {
          color: colors.info,
          fontWeight: '700' },
        eqCountBadge: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.surfaceElevated },
        eqCountBadgeActive: {
          backgroundColor: colors.info + '14' },
        eqCountText: {
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '700',
          color: colors.textTertiary },
        eqCountTextActive: {
          color: colors.info },

        // ===== Summary + badges row =====
        summaryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: layout.paddingHorizontal,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          flexWrap: 'nowrap' },
        summaryLeftWrap: {
          flex: 1,
          minWidth: 0,
          gap: spacing.xs },
        summaryLabelLine: {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: spacing.xs,
          flexShrink: 1,
          minWidth: 0 },
        summaryLabel: {
          color: colors.textPrimary,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: '700',
          letterSpacing: 0.1,
          flexShrink: 1,
          minWidth: 0 },
        summaryCount: {
          color: colors.primary,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: '700' },
        badgesRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flexWrap: 'nowrap',
          minWidth: 0 },
        badgesScroll: {
          flexGrow: 0 },
        badgesScrollContent: {
          gap: spacing.xs,
          paddingRight: spacing.xs },
        filterBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.surfaceBorder,
          backgroundColor: colors.surfaceElevated,
          height: 24 },
        filterBadgeText: {
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '700',
          color: colors.textSecondary },
        resetCapsule: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
          paddingVertical: 5,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.surfaceBorder,
          backgroundColor: colors.surface,
          height: 28,
          flexShrink: 0 },
        resetText: {
          fontSize: 10,
          lineHeight: 14,
          fontWeight: '700',
          letterSpacing: 0.2,
          color: colors.textSecondary },

        // ===== List container =====
        listWrap: { flex: 1, minHeight: 1, overflow: 'visible' },
        listContent: {
          paddingHorizontal: layout.paddingHorizontal,
          paddingTop: spacing.md },
        bottomInset: {
          height: 0,
          flexShrink: 0 },
        skeletonGap: { height: spacing.md },

        // ===== 144dp card (v3 — adds 2-line description row) =====
        cardWrap: { marginBottom: spacing.sm },
        cardRow: {
          height: 144,
          borderRadius: radius.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke,
          backgroundColor: colors.surface,
          shadowColor: softShadow.shadowColor,
          shadowOpacity: softShadow.shadowOpacity,
          shadowOffset: softShadow.shadowOffset,
          shadowRadius: softShadow.shadowRadius,
          elevation: softShadow.elevation },
        muscleRing: {
          width: 72,
          height: 72,
          borderRadius: radius.md,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: colors.surfaceElevated },
        centerCol: {
          flex: 1,
          minWidth: 0,
          gap: spacing.xs,
          height: 124,
          justifyContent: 'space-between',
          paddingVertical: 4 },
        cardTitle: {
          fontSize: 14,
          lineHeight: 20,
          fontWeight: '700',
          color: colors.textPrimary },
        cardSub: {
          fontSize: 12,
          lineHeight: 15,
          fontWeight: '400',
          color: colors.textSecondary },
        cardDesc: {
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '400',
          color: colors.textTertiary },
        muscleTagsRow: {
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: 4,
          alignItems: 'center',
          minWidth: 0 },
        muscleTag: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.primary + '1A',
          flexShrink: 0 },
        muscleTagText: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '700',
          color: colors.primary },
        moreTag: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.surfaceElevated,
          flexShrink: 0 },
        moreTagText: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '700',
          color: colors.textTertiary },
        rightCol: {
          width: 56,
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 124,
          flexShrink: 0,
          paddingVertical: 2 },
        equipBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: colors.surfaceBorder + '3D',
          maxWidth: 56,
          minWidth: 0,
          flexShrink: 1 },
        equipBadgeText: {
          fontSize: 9,
          lineHeight: 12,
          fontWeight: '400',
          color: colors.textSecondary,
          flexShrink: 1,
          minWidth: 0 },
        iconBtn28: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center' },
        favBtn: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frameStroke },
        addBtn: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '1A' } }),
    [colors, insets.bottom, frameStroke, accentStroke, softShadow, isDark],
  );

  // ===== Card renderItem =====
  const renderItem = useCallback(
    ({ item: ex }: { item: Exercise }) => {
      const ringColor = getMuscleColor(ex.body_part);
      const ringIcon = getMuscleIcon(ex.body_part);
      const isFav = favoriteIds.includes(ex.id);
      const favLabel = isFav ? t('common.unfavorite') : t('common.favorite');
      const addLabel = t('common.addToWorkout');
      const equipLabel = labelForEquipment(ex.equipment, currentLang);
      const equipIcon = iconForEquipment(ex.equipment);

      // ----- Description (line 3) — target preferred, fallback to zh instr 60ch -----
      const instrZh = (ex.instructions as any)?.zh ?? (ex.instructions as any)?.en ?? '';
      const instrEn = (ex.instructions as any)?.en ?? '';
      const instrLead = currentLang === 'zh' ? instrZh : instrEn;
      const rawDesc = translateTargetPhrase(ex.target ?? '', currentLang);
      let descText: string = rawDesc;
      if (!descText && instrLead) {
        descText = instrLead.slice(0, 60);
      }

      // ----- Secondary muscle tag chips (全中文) -----
      const secondary: string[] = ex.secondary_muscles ?? [];
      const displayMuscles = secondary.slice(0, 3);
      const moreCount = Math.max(0, secondary.length - 3);
      const moreLabel =
        currentLang === 'zh' ? `+${moreCount}` : `+${moreCount}`;

      return (
        <View style={s.cardWrap}>
          <PressableScale
            onPress={() => goDetail(ex.id)}
            hitSlop={8}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={currentLang === 'zh' ? displayNameZh(ex) : ex.name}
          >
            <View style={s.cardRow}>
              {/* Left: 72×72 hybrid poster + muscle-ring fallback */}
              <HybridImage
                uri={getImageUrl(ex.image)}
                tint={ringColor}
                iconName={ringIcon}
                fallbackBodyPart={ex.body_part}
                fallbackTint={ringColor}
                style={[s.muscleRing, { borderWidth: 1, borderColor: ringColor + '66' }]}
                contentFit="cover"
                iconRatio={0.45}
              />

              {/* Center column — 4 lines: name / meta / desc(2L) / chips */}
              <View style={s.centerCol}>
                <View style={{ minWidth: 0 }}>
                  {/* 行1: 动作名 bold primary */}
                  <Text style={s.cardTitle} numberOfLines={1} ellipsizeMode="tail">
                    {currentLang === 'zh' ? displayNameZh(ex) : ex.name}
                  </Text>
                  {/* 行2: 英文名 / 器械 （sub 小字） */}
                  <Text style={s.cardSub} numberOfLines={1} ellipsizeMode="tail">
                    {currentLang === 'zh'
                      ? `${ex.name ?? ''} · ${equipLabel}`
                      : `${equipLabel}`}
                  </Text>
                  {/* 行3: 动作简介 2 行 */}
                  <Text style={s.cardDesc} numberOfLines={2} ellipsizeMode="tail">
                    {descText}
                  </Text>
                </View>
                {/* 行4: MiniTags 中文 secondary_muscles + more */}
                <View style={s.muscleTagsRow}>
                  {displayMuscles.map((m, i) => {
                    const zhLabel = labelForMuscle(m, currentLang);
                    const short = zhLabel.length > 4 ? zhLabel.slice(0, 4) : zhLabel;
                    return (
                      <View key={`${m}-${i}`} style={s.muscleTag}>
                        <Text style={s.muscleTagText} numberOfLines={1}>
                          {short}
                        </Text>
                      </View>
                    );
                  })}
                  {moreCount > 0 && (
                    <View style={s.moreTag}>
                      <Text style={s.moreTagText}>{moreLabel}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right column */}
              <View style={s.rightCol}>
                <View style={s.equipBadge} pointerEvents="none">
                  <Icon name={equipIcon} size={9} color={colors.textSecondary} />
                  <Text style={s.equipBadgeText} numberOfLines={1}>
                    {equipLabel}
                  </Text>
                </View>

                <PressableScale
                  style={s.favBtn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    tap(() => toggleFavorite(ex.id), 'light');
                  }}
                  hitSlop={6}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={favLabel}
                >
                  <Icon
                    name={isFav ? 'heart' : 'heart-outline'}
                    size={16}
                    color={isFav ? colors.primary : colors.textSecondary}
                  />
                </PressableScale>

                <PressableScale
                  style={s.addBtn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    quickAdd(ex.id);
                  }}
                  hitSlop={6}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={addLabel}
                >
                  <Icon name="plus" size={16} color={colors.primary} />
                </PressableScale>
              </View>
            </View>
          </PressableScale>
        </View>
      );
    },
    [
      s,
      favoriteIds,
      goDetail,
      colors,
      t,
      currentLang,
      tap,
      toggleFavorite,
      quickAdd,
      getMuscleColor,
      getMuscleIcon,
    ],
  );

  const keyExtractor = useCallback((ex: Exercise) => String(ex.id), []);

  // ===== Active filter badges =====
  const activeBadges = useMemo(() => {
    type B = { key: string; label: string; clear: () => void; tint?: string };
    const badges: B[] = [];
    if (selectedRegion !== 'all') {
      const region = BODY_REGIONS.find((r) => r.key === selectedRegion);
      if (region)
        badges.push({
          key: 'region',
          label: currentLang === 'en' ? region.en : region.zh,
          clear: () => setSelectedRegion('all'),
          tint: colors.primary });
    }
    if (selectedBodyPart) {
      badges.push({
        key: 'bp',
        label: labelForBodyPart(selectedBodyPart, currentLang),
        clear: () => setSelectedBodyPart(null),
        tint: colors.primary });
    }
    if (selectedEquipGroup !== 'all') {
      const g = EQUIPMENT_GROUPS.find((x) => x.key === selectedEquipGroup);
      if (g)
        badges.push({
          key: 'eqg',
          label: currentLang === 'en' ? g.en : g.zh,
          clear: () => setSelectedEquipGroup('all'),
          tint: colors.info });
    }
    if (selectedEquipment) {
      badges.push({
        key: 'eq',
        label: labelForEquipment(selectedEquipment, currentLang),
        clear: () => setSelectedEquipment(null),
        tint: colors.info });
    }
    return badges;
  }, [
    selectedRegion,
    selectedBodyPart,
    selectedEquipGroup,
    selectedEquipment,
    currentLang,
    colors.primary,
    colors.info,
  ]);

  // ===== Empty / loading =====
  const emptyNode = useMemo(() => {
    if (!store.ready) return null;
    if (activeTab === 'favorites' && favoriteIds.length === 0) {
      return (
        <EmptyState
          icon="heart-off-outline"
          title={t('library.noFavorites')}
          desc={t('library.noFavoritesDesc')}
        />
      );
    }
    return (
      <EmptyState
        icon="file-search-outline"
        title={t('home.emptyTitle')}
        desc={t('home.emptyDesc')}
      />
    );
  }, [store.ready, activeTab, favoriteIds.length, t]);

  const loadingNodes = useMemo(
    () => (
      <View style={{ paddingHorizontal: layout.paddingHorizontal, paddingTop: spacing.md }}>
        <Skeleton height={112} width="100%" borderRadius={radius.lg} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={112} width="100%" borderRadius={radius.lg} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={112} width="100%" borderRadius={radius.lg} />
      </View>
    ),
    [],
  );

  const resultLabel = buildResultLabel({
    t,
    activeTab,
    selectedRegion,
    selectedBodyPart,
    selectedEquipGroup,
    selectedEquipment,
    currentLang });

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ===== TitleHeader + SearchBar + TopTabs ===== */}
      <View style={[s.topBar, s.readable]}>
        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.pageTitle}>{t('library.title')}</Text>
            <Text style={s.titleCount} numberOfLines={1}>
              {t('library.totalCount', {
                n: filteredExercises.length,
                total: store.total(),
                defaultValue: '' }) || `${t('common.total')} ${filteredExercises.length} / ${store.total()}`}
            </Text>
          </View>
          <View style={s.searchWrap}>
            <SearchBar
              value={searchText}
              onChange={(v) => {
                setSearchText(v);
                setForceShowFilters(true);
              }}
              onClear={() => setSearchText('')}
              placeholder={t('home.searchPlaceholder')}
            />
          </View>
        </View>

        <SegmentedControl
          options={TOP_TABS.map((tab) => ({
            label: t(tab.labelKey),
            value: tab.key,
            icon: tab.icon }))}
          value={activeTab}
          onChange={(next) => handleTabPress(next as TopTab)}
          highlightColor={colors.primary}
        />
      </View>

      {/* ===== 4 Horizontal Rails (always visible, constant height ≈ 232dp) ===== */}
      <View style={[s.railsWrap, s.readable]}>
        {/* Rail A: Region (36dp chip) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.railContent}
          keyboardShouldPersistTaps="handled"
        >
          {BODY_REGIONS.map((region) => {
            const isActive = selectedRegion === region.key;
            return (
              <PressableScale
                key={region.key}
                onPress={() => handleRegionPress(region.key)}
                style={[s.regionChip, isActive && s.regionChipActive]}
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={currentLang === 'en' ? region.en : region.zh}
              >
                <Icon
                  name={region.icon}
                  size={12}
                  color={isActive ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[s.regionChipText, isActive && s.regionChipTextActive]}
                  numberOfLines={1}
                >
                  {currentLang === 'en' ? region.en : region.zh}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* Rail B: BodyPart (40dp chip) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.railContent}
          keyboardShouldPersistTaps="handled"
        >
          {BODY_PARTS.map((bp, idx) => {
            const isSel = selectedBodyPart === bp;
            const tint = muscleColor(colors, bp);
            const indexStr = `${idx + 1}`.padStart(2, '0');
            const count = bpCountMap.get(bp) ?? 0;
            return (
              <PressableScale
                key={bp}
                onPress={() => handleBodyPartPress(bp)}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={labelForBodyPart(bp, currentLang)}
                style={[
                  s.bpChip,
                  isSel && [s.bpChipActive, { borderColor: tint + 'AA' }],
                ]}
              >
                <View
                  style={[s.bpIndexPill, isSel && [s.bpIndexPillActive, { borderColor: tint, backgroundColor: tint }]]}
                >
                  <Text style={[s.bpIndexText, isSel && s.bpIndexTextActive]}>#{indexStr}</Text>
                </View>
                <Icon
                  name={iconForBodyPart(bp)}
                  size={14}
                  color={isSel ? tint : colors.textSecondary}
                />
                <Text
                  style={[s.bpText, isSel && [s.bpTextActive, { color: tint }]]}
                  numberOfLines={1}
                >
                  {labelForBodyPart(bp, currentLang)}
                </Text>
                <View style={[s.bpCountBadge, isSel && s.bpCountBadgeActive]}>
                  <Text style={[s.bpCountText, isSel && [s.bpCountTextActive, { color: tint }]]}>
                    {count}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* Rail C: EquipmentGroup (36dp chip) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.railContent}
          keyboardShouldPersistTaps="handled"
        >
          {EQUIPMENT_GROUPS.map((group) => {
            const isActive = selectedEquipGroup === group.key;
            return (
              <PressableScale
                key={group.key}
                onPress={() => handleEquipGroupPress(group.key)}
                style={[s.eqgChip, isActive && s.eqgChipActive]}
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={currentLang === 'en' ? group.en : group.zh}
              >
                <Icon
                  name={group.icon}
                  size={12}
                  color={isActive ? colors.info : colors.textTertiary}
                />
                <Text
                  style={[s.eqgChipText, isActive && s.eqgChipTextActive]}
                  numberOfLines={1}
                >
                  {currentLang === 'en' ? group.en : group.zh}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* Rail D: Equipment (40dp chip) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.railContent}
          keyboardShouldPersistTaps="handled"
        >
          {EQUIPMENT.map((eq) => {
            const isSel = selectedEquipment === eq;
            const count = eqCountMap.get(eq) ?? 0;
            return (
              <PressableScale
                key={eq}
                onPress={() => handleEquipmentPress(eq)}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={labelForEquipment(eq, currentLang)}
                style={[s.eqChip, isSel && s.eqChipActive]}
              >
                <Icon
                  name={iconForEquipment(eq)}
                  size={14}
                  color={isSel ? colors.info : colors.textSecondary}
                />
                <Text style={[s.eqText, isSel && s.eqTextActive]} numberOfLines={1}>
                  {labelForEquipment(eq, currentLang)}
                </Text>
                <View style={[s.eqCountBadge, isSel && s.eqCountBadgeActive]}>
                  <Text style={[s.eqCountText, isSel && s.eqCountTextActive]}>{count}</Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      {/* ===== SummaryRow + filter Badges + Reset ===== */}
      <View style={s.summaryRow}>
        <View style={s.summaryLeftWrap}>
          <View style={s.summaryLabelLine}>
            <Text style={s.summaryLabel} numberOfLines={1}>
              {resultLabel}
            </Text>
            <Text style={s.summaryCount}>· {filteredExercises.length}/{store.total()}</Text>
          </View>
          {activeBadges.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.badgesScroll}
              contentContainerStyle={s.badgesScrollContent}
            >
              {activeBadges.map((b) => (
                <PressableScale
                  key={b.key}
                  onPress={() =>
                    tap(() => b.clear(), 'light')
                  }
                  scaleTo={0.93}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('common.clear')} ${b.label}`}
                  style={[s.filterBadge, b.tint ? { borderColor: b.tint + '55' } : null]}
                >
                  <Text style={[s.filterBadgeText, b.tint ? { color: b.tint } : null]}>
                    {b.label}
                  </Text>
                  <Icon name="close" size={10} color={b.tint ?? colors.textTertiary} />
                </PressableScale>
              ))}
            </ScrollView>
          )}
        </View>

        <PressableScale
          onPress={handleReset}
          style={[
            s.resetCapsule,
            !hasAnyFilter && { opacity: 0.5 },
          ]}
          scaleTo={hasAnyFilter ? 0.94 : 1}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.reset')}
          accessibilityState={{ disabled: !hasAnyFilter }}
        >
          <Icon name="refresh" size={12} color={colors.textSecondary} />
          <Text style={s.resetText} numberOfLines={1}>
            {t('common.reset')}
          </Text>
        </PressableScale>
      </View>

      {/* ===== FlashList ===== */}
      <View style={[s.listWrap, s.readable]}>
        {!store.ready ? (
          loadingNodes
        ) : (
          <FlashList<Exercise>
            data={filteredExercises}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={false}
            overrideProps={{ estimatedItemSize: 112, disableAutoLayout: true }}
            contentContainerStyle={[
              s.listContent,
              { paddingBottom: bottomPad },
            ]}
            ListEmptyComponent={filteredExercises.length === 0 ? emptyNode : null}
            ListFooterComponent={<View style={[{ height: bottomPad }, s.bottomInset]} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ========== Label builder ==========

function buildResultLabel(args: {
  t: (key: string) => string;
  activeTab: TopTab;
  selectedRegion: BodyRegion;
  selectedBodyPart: BodyPart | null;
  selectedEquipGroup: EquipmentGroup;
  selectedEquipment: string | null;
  currentLang: 'zh' | 'en';
}): string {
  const {
    t,
    activeTab,
    selectedRegion,
    selectedBodyPart,
    selectedEquipGroup,
    selectedEquipment,
    currentLang } = args;

  if (activeTab === 'favorites') return t('library.tabFavorites');

  const parts: string[] = [];
  if (selectedBodyPart) {
    parts.push(labelForBodyPart(selectedBodyPart, currentLang));
  } else if (selectedRegion !== 'all') {
    const region = BODY_REGIONS.find((r) => r.key === selectedRegion);
    if (region) parts.push(currentLang === 'en' ? region.en : region.zh);
  }
  if (selectedEquipment) {
    parts.push(labelForEquipment(selectedEquipment, currentLang));
  } else if (selectedEquipGroup !== 'all') {
    const group = EQUIPMENT_GROUPS.find((g) => g.key === selectedEquipGroup);
    if (group) parts.push(currentLang === 'en' ? group.en : group.zh);
  }
  return parts.length === 0 ? t('library.title') : parts.join(' · ');
}

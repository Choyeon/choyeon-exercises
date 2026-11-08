import React, { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { safeHaptic } from '@/utils/haptic';
import { formatDurationClock } from '@/utils/format';
import { useThemeColors, typography, spacing, radius, layout, muscleColor as muscleColorOf } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { getAllExercisesSync } from '@/data/queries';
import {
  BODY_PART_LABELS,
  labelForBodyPart,
  labelForEquipment,
  labelForMuscle,
  translateTargetPhrase,
  iconForBodyPart,
  iconForEquipment,
  getImageUrl,
  displayNameZh,
} from '@/constants';
import type {
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  ExerciseHistoryEntry,
  SetType,
} from '@/types';
import { SET_TYPES } from '@/types';
import { Icon, PressableScale, SearchBar, HybridImage, ProgressRing, useToast, EmptyState, MiniTag } from '@/components/UIKit';
import { PlateCalculator } from '@/components/PlateCalculator';
import { useRestTimer } from '@/hooks/useRestTimer';
import { estimate1RM, toKg, displayWeight } from '@/utils/strength';

export default function WorkoutStartScreen() {
  const { t, i18n } = useTranslation();
  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';
  const router = useRouter();
  const colors = useThemeColors();
  const activeWorkout = useAppStore((s) => s.activeWorkout);
  const settings = useAppStore((s) => s.settings);
  const endWorkout = useAppStore((s) => s.endWorkout);
  const cancelWorkout = useAppStore((s) => s.cancelWorkout);
  const stopRestTimer = useAppStore((s) => s.stopRestTimer);
  const addExerciseToActive = useAppStore((s) => s.addExerciseToActive);
  const removeExerciseFromActive = useAppStore(
    (s) => s.removeExerciseFromActive
  );
  const addSetToExercise = useAppStore((s) => s.addSetToExercise);
  const removeSet = useAppStore((s) => s.removeSet);
  const updateSet = useAppStore((s) => s.updateSet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkAndRecordPR = useAppStore((s: any) => s.checkAndRecordPR);
  const lastSetsFor = useAppStore((s) => s.lastSetsFor);
  const workouts = useAppStore((s) => s.workouts);
  const toast = useToast();

  // 杠铃片计算器弹窗状态：记录当前针对哪个动作。
  // weight 存的是「用户单位」下的数值（与 set.weight 同域），
  // 传给计算器时才 toKg 换算 —— 杠铃片规格本身是公制的。
  const [plateTarget, setPlateTarget] = useState<{
    exerciseId: string;
    weight: number;
  } | null>(null);

  // ===== Group-level REST TIMER (MVP v1.1.0: store + useRestTimer hook) =====
  const {
    timer: restTimerSt,
    mmss: restMmss,
    progress: restProgress,
    start: startRestGlobal,
    skip: restSkipFromHook,
    plus10: restPlus10,
    minus10: restMinus10,
  } = useRestTimer();
  const restActive = restTimerSt.active;

  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const navPoppedRef = useRef(false);
  useEffect(() => {
    navPoppedRef.current = false;
  }, []);

  const allExercises = useMemo(() => getAllExercisesSync(), []);
  const exMap = useMemo(
    // Map key STRONG 统一 String 类型：exercises.json id 是 4 位零填充 STRING ("0001","1207")
    // 但 persist vault 旧版本反序列化后 exerciseId 可能是 NUMBER (1207)，JS Map.get 严格类型匹配
    // 所以构造时用 [String(e.id), e]，调用时统一 exMap.get(String(we.exerciseId))
    () => new Map(allExercises.map((e) => [String(e.id), e])),
    [allExercises]
  );

  useEffect(() => {
    if (!activeWorkout?.startedAt) return;
    const start = activeWorkout.startedAt;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [activeWorkout?.startedAt]);

  useEffect(() => {
    if (activeWorkout || navPoppedRef.current) return;
    navPoppedRef.current = true;
    router.back();
  }, [activeWorkout, router]);

  // NOTE: 所有 hooks 必须在任何 return 之前声明（React Rules of Hooks）。
  // 之前 if(!activeWorkout) early return 在 line~101，导致 endWorkout 后
  // activeWorkout=null 时跳过了后续 11+ 个 hooks → "Rendered fewer hooks than
  // expected" → RN Hermes 闪退。现在把 early return 移到最后 return 之前。
  //
  // 深度防御：`exercises` 在旧 vault 数据里可能是 undefined，直接 `.length` 会闪退。
  const safeExercises: WorkoutExercise[] = useMemo(
    () =>
      Array.isArray(activeWorkout?.exercises)
        ? (activeWorkout!.exercises.filter(Boolean) as WorkoutExercise[])
        : [],
    [activeWorkout?.exercises]
  );

  const { totalVolume, completedSets, totalSets } = useMemo(() => {
    let tv = 0;
    let cs = 0;
    let ts = 0;
    for (const e of safeExercises) {
      if (!e || !Array.isArray(e.sets)) continue;
      for (const s of e.sets) {
        if (!s) continue;
        ts += 1;
        if (s.completed) {
          cs += 1;
          tv += (Number(s.weight) || 0) * (Number(s.reps) || 0);
        }
      }
    }
    return {
      totalVolume: tv,
      completedSets: cs,
      totalSets: ts,
    };
  }, [safeExercises]);

  // ==========================================================
  // 上次训练参考 —— 对标训记的核心体验：每个动作都能看到「上次举了多少」，
  // 并一键把上次的重量/次数铺到所有组上（渐进超负荷全靠这个对照）。
  // 数据来自 store.lastSetsFor（底层是 analytics.exerciseHistory），
  // 与数据面板 / 动作详情页共用同一口径，不在这里另算一套。
  // ==========================================================
  const lastEntries = useMemo(() => {
    const m = new Map<string, ExerciseHistoryEntry | null>();
    for (const we of safeExercises) {
      m.set(String(we.exerciseId), lastSetsFor(String(we.exerciseId)));
    }
    return m;
    // workouts 必须进依赖：训练结束后历史变化，「上次」要跟着更新
  }, [safeExercises, lastSetsFor, workouts]);

  /**
   * 把上次的重量/次数铺到当前动作的所有组上。
   *
   * 组数不够时先补组（addSetToExercise 会复制上一组的重量，所以补完再逐组覆写）；
   * 用 guard 限制循环次数 —— 万一组数补齐逻辑失效（store 未更新），
   * 也不能让 while 把主线程锁死。
   */
  const applyLastToExercise = useCallback(
    (exerciseId: string) => {
      const last = lastSetsFor(String(exerciseId));
      if (!last || !Array.isArray(last.sets) || last.sets.length === 0) return;

      const readSets = (): WorkoutSet[] => {
        const s = useAppStore.getState();
        const we = (s.activeWorkout?.exercises ?? []).find(
          (e) => e && String(e.exerciseId) === String(exerciseId)
        );
        return we && Array.isArray(we.sets) ? we.sets.filter(Boolean) : [];
      };

      let sets = readSets();
      let guard = 0;
      while (sets.length < last.sets.length && guard < 20) {
        guard += 1;
        addSetToExercise(exerciseId);
        const next = readSets();
        if (next.length === sets.length) break; // 没补上，避免死循环
        sets = next;
      }

      const finalSets = readSets();
      for (let i = 0; i < last.sets.length && i < finalSets.length; i++) {
        updateSet(exerciseId, finalSets[i].id, {
          weight: Number(last.sets[i].weight) || 0,
          reps: Number(last.sets[i].reps) || 0,
        });
      }
      safeHaptic('success');
      try {
        toast.show({
          title: t('session.appliedLast', {
            defaultValue: '已填入上次的重量与次数',
          }),
          variant: 'success',
        });
      } catch {
        /* toast provider 未挂载时忽略 */
      }
    },
    [lastSetsFor, addSetToExercise, updateSet, t, toast]
  );

  // 计算下一组上下文（当前 exerciseIdx / setIdx 的下一组）用于倒计时显示
  //
  // 深度防御（闪退修复）：历史 vault / 跨版本 merge / 并发 set 更新都可能让
  // 某个 exercise 的 `sets` 变成 undefined 或非数组，而这里原本直接访问
  // `curEx.sets.findIndex` / `nextEx.sets[...]`。只要用户在「完成一组」的瞬间
  // 同时删除该动作，或旧数据缺少 sets 字段，就会抛
  // "Cannot read property 'findIndex' of undefined" → RN Hermes 闪退。
  // 现在所有中间值都先做 Array.isArray 归一化，并在索引越界时返回 null。
  const getNextSetContext = useCallback(
    (curExerciseId: string, curSetId: string) => {
      // 从最新快照读取：不要依赖闭包里的 activeWorkout，否则每次组数据变化都会
      // 生成新的 getNextSetContext → 下游 useCallback/handleUpdateSet 全部失效。
      const activeWorkoutSnap = useAppStore.getState().activeWorkout;
      if (!activeWorkoutSnap) return null;
      const exercises = Array.isArray(activeWorkoutSnap.exercises)
        ? activeWorkoutSnap.exercises.filter(Boolean)
        : [];
      if (exercises.length === 0) return null;

      const exIdx = exercises.findIndex(
        (e) => e && String(e.exerciseId) === String(curExerciseId)
      );
      if (exIdx < 0) return null;

      const curEx = exercises[exIdx];
      const curSets = Array.isArray(curEx?.sets) ? curEx.sets.filter(Boolean) : [];
      const setIdx = curSets.findIndex((s) => s && String(s.id) === String(curSetId));

      // 先找同 exercise 下一个 set；越界 → 找下一个 exercise 的第 0 set
      let nextExIdx = exIdx;
      let nextSetIdx = setIdx + 1;
      if (setIdx < 0 || nextSetIdx >= curSets.length) {
        nextExIdx = exIdx + 1;
        nextSetIdx = 0;
      }
      if (nextExIdx >= exercises.length) return null;

      const nextEx = exercises[nextExIdx];
      const nextSets = Array.isArray(nextEx?.sets) ? nextEx.sets.filter(Boolean) : [];
      const nextSet = nextSets[nextSetIdx];
      if (!nextEx || !nextSet) return null;

      const exInfo = exMap.get(String(nextEx.exerciseId));
      const name =
        (effectiveLang === 'zh' ? exInfo?.name_zh : undefined) ||
        exInfo?.name ||
        String(nextEx.exerciseId);
      return {
        exerciseName: name,
        setIndex: nextSetIdx + 1,
        totalSets: nextSets.length,
      };
    },
    [exMap, effectiveLang]
  );

  /**
   * 打开杠铃片计算器：以该动作最新一组的重量作为配重基准。
   * 抽成独立（稳定引用）回调，供 ExerciseBlock 直接消费，避免在 map 里现场造闭包。
   */
  const openPlatesFor = useCallback((exerciseId: string) => {
    const st = useAppStore.getState();
    const we = (st.activeWorkout?.exercises ?? []).find(
      (e) => e && String(e.exerciseId) === String(exerciseId)
    );
    const setsArr = we && Array.isArray(we.sets) ? we.sets.filter(Boolean) : [];
    // 取最新一组（通常是当前正在做的目标重量）作为配重基准
    const w = Number(setsArr[setsArr.length - 1]?.weight) || 0;
    setPlateTarget({ exerciseId: String(exerciseId), weight: w });
  }, []);

  /**
   * 组更新总入口 —— 自动休息 + PR 判定都挂在这里。
   *
   * 之所以把原来散落在 JSX 里的这段逻辑提到组件外：
   *   · 保持引用稳定 → ExerciseBlock 的 memo 才不会每次 tick 失效；
   *   · 所有瞬时状态（设置 / 倒计时 / 当前 activeWorkout）在触发那一刻从
   *     store 快照读取，而不是渲染时的闭包，避免「点了 +10 之后才生效」这类
   *     陈旧闭包问题。
   */
  const handleUpdateSet = useCallback(
    (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => {
      updateSet(exerciseId, setId, patch);

      // ---- 1) 自动开启组间休息 ----
      // restTimer 与 settings 都走实时快照：倒计时 tick 不应该改变这个回调的引用。
      if (patch.completed === true) {
        const { settings: cfg, restTimer } = useAppStore.getState();
        if (cfg.restTimerEnabled && cfg.autoRest && !restTimer.active) {
          safeHaptic('medium');
          const ctx = getNextSetContext(exerciseId, setId);
          startRestGlobal(cfg.defaultRestSeconds, ctx ?? null);
        }
      }

      // ---- 2) PR 自动判定 & toast ----
      if (patch.completed === true) {
        // 防御：sets 可能是 undefined（旧数据 / 并发删除），find 前先归一化
        const st = useAppStore.getState();
        const we = (st.activeWorkout?.exercises ?? []).find(
          (e) => e && String(e.exerciseId) === String(exerciseId)
        );
        const setsArr = we && Array.isArray(we.sets) ? we.sets : [];
        const curSet = setsArr.find((s) => s && s.id === setId);
        const safeWeight = Number(patch.weight ?? curSet?.weight ?? 0) || 0;
        const safeReps = Number(patch.reps ?? curSet?.reps ?? 0) || 0;
        if (safeWeight > 0) {
          const pr = checkAndRecordPR({
            exerciseId,
            weight: safeWeight,
            reps: safeReps,
          });
          if (pr) {
            const exInfo = exMap.get(String(exerciseId));
            const dispName =
              effectiveLang === 'zh'
                ? exInfo
                  ? displayNameZh(exInfo)
                  : String(exerciseId)
                : exInfo?.name || String(exerciseId);
            const units = st.settings.units;
            safeHaptic('success');
            try {
              const titleRaw = t('pr.newHit', {
                exerciseName: dispName,
                weight: pr.weight,
                units,
                reps: pr.reps,
              });
              toast.show({
                title:
                  typeof titleRaw === 'string' && !titleRaw.includes('newHit')
                    ? titleRaw
                    : `🏆 NEW PR · ${dispName}: ${pr.weight}${units} × ${pr.reps}`,
                variant: 'success',
              });
            } catch {
              /* toast 不可用不阻塞训练 */
            }
          }
        }
      }
    },
    [updateSet, getNextSetContext, startRestGlobal, checkAndRecordPR, exMap, effectiveLang, t, toast]
  );

  const startRest = useCallback(() => {
    safeHaptic('light');
    startRestGlobal(settings.defaultRestSeconds, restTimerSt.nextContext ?? undefined);
  }, [settings.defaultRestSeconds, startRestGlobal, restTimerSt.nextContext]);

  const skipRest = useCallback(() => {
    safeHaptic('light');
    restSkipFromHook();
  }, [restSkipFromHook]);

  const openPicker = useCallback(() => {
    safeHaptic('medium');
    setPickerOpen(true);
    setPickerQuery('');
  }, []);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const handleFinish = () => {
    safeHaptic('success');
    // 1) 先锁 nav guard 防止双重 pop（activeWorkout effect 触发）
    navPoppedRef.current = true;
    // 2) 先停所有运行时，避免 endWorkout→render 期间 interval 仍然写入状态
    stopRestTimer();
    try {
      const result = endWorkout(note.trim().length > 0 ? note : undefined);
      if (result && result.session) {
        const vol = Math.round(totalVolume || 0);
        // 3) 若扫到 new PRs，先在 Alert 弹出前 toast 它们（toast 比 Alert 渲染快，不依赖 window modal host）
        if (Array.isArray(result.newPRs) && result.newPRs.length > 0) {
          result.newPRs.forEach((pr) => {
            const exInfo = exMap.get(String(pr.exerciseId));
            let display: string;
            if (effectiveLang === 'zh') {
              display = exInfo ? displayNameZh(exInfo) : (exInfo && 'name' in exInfo ? (exInfo as any).name : pr.exerciseId);
              if (!display) display = pr.exerciseId;
            } else {
              display = (exInfo && (exInfo as any).name) || pr.exerciseId;
            }
            try {
              if (toast && typeof toast.show === 'function') {
                const titleRaw = t('pr.newHit', {
                  exerciseName: display, weight: pr.weight, units: settings.units, reps: pr.reps,
                  defaultValue: `🏆 PR: ${display} ${pr.weight}${settings.units} × ${pr.reps}`,
                } as any);
                toast.show({
                  title:
                    (typeof titleRaw === 'string' && !titleRaw.includes('newHit')
                      ? titleRaw
                      : `🏆 NEW PR · ${display}: ${pr.weight}${settings.units} × ${pr.reps}`),
                  variant: 'success',
                });
              }
              safeHaptic('success');
            } catch { /* toast 失败不阻塞 */ }
          });
        }
        // 4) 再显示 session complete Alert — 确保此时 toast 已出
        Alert.alert(
          String(t('workoutSession.doneTitle', { defaultValue: 'Session complete!' } as any)),
          `${String(t('workout.statsVolume', { defaultValue: 'Volume' } as any))}: ${vol} ${settings.units}`,
          [
            {
              text: String(t('workout.historyTitle', { defaultValue: 'View history' } as any)),
              onPress: () => {
                // nav guard 已锁，直接 replace
                router.replace('/(tabs)/workout' as Parameters<typeof router.replace>[0]);
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert(
          String(t('workoutSession.emptyFinishTitle', { defaultValue: 'No sets completed' } as any)),
          String(t('workoutSession.emptyDesc', { defaultValue: 'This session had no logged sets.' } as any)),
          [
            { text: String(t('workout.restNext', { defaultValue: 'OK' } as any)) },
            {
              text: String(t('workoutSession.cancel', { defaultValue: 'Discard & Back' } as any)),
              style: 'destructive',
              onPress: () => {
                // cancel guard 已锁，不需要再次 cancel，直接 back
                router.back();
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (err) {
      // 如果发生任何 JS 异常，兜底直接回到 workout tab，不留给用户白屏
      console.error('[FINISH CRASH FALLBACK]', err);
      try { stopRestTimer(); } catch { /* noop */ }
      try { cancelWorkout(); } catch { /* noop */ }
      try { router.replace('/(tabs)/workout' as any); } catch { /* noop */ }
    }
  };

  const handleCancel = () => {
    // Cancelling a session: use the purpose-built cancel-warning key so the
    // dialog copy stays correct across locales (no auto-slicing of unrelated
    // settings text — previously resetAllConfirm was sliced to 12 chars which
    // made no semantic sense in EN/ja and truncated mid-word in ZH).
    Alert.alert(t('workoutSession.cancelConfirm'), t('session.cancelProgressWarn'), [
      { text: t('workout.restNext'), style: 'cancel' },
      {
        text: t('workoutSession.cancel'),
        style: 'destructive',
        onPress: () => {
          // Set ref FIRST before cancelling so the activeWorkout-watching
          // effect above skips its redundant `router.back()`.  Order matters:
          // cancelWorkout mutates zustand, which re-renders and fires the
          // effect synchronously in the same microtask on the next paint.
          navPoppedRef.current = true;
          cancelWorkout();
          router.back();
        },
      },
    ]);
  };

  const pickerResults = useMemo(() => {
    if (!pickerOpen) return [];
    const q = pickerQuery.trim().toLowerCase();
    let list = allExercises;
    if (q.length > 0) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.name_zh && e.name_zh.toLowerCase().includes(q)) ||
          e.target.toLowerCase().includes(q) ||
          (e.muscle_group || '').toLowerCase().includes(q) ||
          (e.instructions?.zh && String(e.instructions.zh).includes(pickerQuery.trim()))
      );
    }
    return list.slice(0, 50);
  }, [allExercises, pickerQuery, pickerOpen]);

  // Stable picker-item select: always checks `already` via fresh snapshot.
  // Using useCallback here flattens re-render churn on every keystroke in the
  // picker's search input (which was rebuilding 50 closures at a time).
  const handlePickExercise = useCallback(
    (exId: string) => {
      const active = useAppStore.getState().activeWorkout;
      if (!active) return;
      if (active.exercises.some((e) => e.exerciseId === exId)) return;
      safeHaptic('light');
      addExerciseToActive(exId);
      setPickerOpen(false);
    },
    [addExerciseToActive]
  );

  // ====== Theme-aware styles ======
  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    headerCancel: {
      color: colors.textSecondary,
      fontWeight: '700',
    },
    summaryBar: {
      flexDirection: 'row',
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    restBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: layout.paddingHorizontal,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      overflow: 'hidden',
    },
    restIconTray: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info + '18',
    },
    restBarText: {
      ...typography.bodyBold,
      color: colors.textSecondary,
      flex: 1,
    },
    restBarActive: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: layout.paddingHorizontal,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.accent + '14',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent + '55',
      gap: spacing.md,
      overflow: 'hidden',
    },
    restLabel: {
      ...typography.captionBold,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
      // 修复竖排：禁止软换行 + 最小宽度保护，即使父容器在极窄时也不会把1个汉字折成1行
      includeFontPadding: false,
    },
    restTimer: {
      ...typography.display,
      fontSize: 24,
      lineHeight: 32,
      color: colors.accent,
      flex: 1,
      fontVariant: ['tabular-nums'],
      fontWeight: '900',
      includeFontPadding: false,
    },
    restSkipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      backgroundColor: colors.accent + '22',
      borderWidth: 1,
      borderColor: colors.accent + '33',
    },
    restSkipText: {
      ...typography.captionBold,
      color: colors.accent,
    },
    adjust10Btn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minWidth: 44,
      alignItems: 'center',
      borderRadius: 999,
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent + '33',
    },
    adjust10BtnText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      color: colors.accent,
      fontVariant: ['tabular-nums'],
    },
    nextContextText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    content: {
      paddingHorizontal: layout.paddingHorizontal,
      paddingTop: spacing.xs,
    },
    emptyWrap: {
      padding: spacing.xxxl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginTop: spacing.md,
    },
    emptyIconTray: {
      width: 64,
      height: 64,
      borderRadius: radius.lg,
      backgroundColor: colors.primary + '16',
      borderWidth: 1,
      borderColor: colors.primaryStroke,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    emptyDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 260,
    },
    noteCard: {
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: spacing.lg,
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    noteIconTray: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.info + '16',
    },
    noteHeaderBody: {
      flex: 1,
    },
    bottomContentInset: {
      height: 180,
    },
    noteTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    noteSub: {
      ...typography.small,
      color: colors.textTertiary,
    },
    noteInput: {
      color: colors.textPrimary,
      ...typography.body,
      minHeight: 72,
      textAlignVertical: 'top',
      padding: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
    },
    bottomBar: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: layout.paddingHorizontal,
      paddingTop: spacing.md,
      paddingBottom: layout.safeBottom + spacing.md,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary + '66',
    },
    addBtnIconTray: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      ...typography.bodyBold,
      color: colors.primary,
      letterSpacing: 0.2,
    },
    finishBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    finishBtnDisabled: {
      backgroundColor: colors.surfaceElevated,
      opacity: 0.5,
    },
    finishBtnText: {
      ...typography.bodyBold,
      color: colors.textInverse,
      letterSpacing: 0.3,
    },
    modalScreen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.md,
    },
    modalCancel: {
      ...typography.bodyBold,
      color: colors.textSecondary,
      width: 50,
    },
    modalTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    modalTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    pickerImgWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 2,
      overflow: 'hidden',
    },
    pickerImg: {
      width: '100%',
      height: '100%',
    },
    pickerName: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    pickerMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // 原本靠每个 chip 的 marginRight(spacing.sm) + gap(spacing.xs) = 12 拉开间距；
      // 统一到 UIKit 的 MiniTag 后由容器 gap 承担，保持视觉间距一致。
      gap: spacing.md,
    },
    pickerAddBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    modalHeaderSpacer: { width: 50 },
    modalSearchWrap: {
      paddingHorizontal: layout.paddingHorizontal,
    },
    modalList: { flex: 1 },
    modalListContent: {
      paddingHorizontal: layout.paddingHorizontal,
      paddingVertical: spacing.md,
    },
    pickerItemDisabled: { opacity: 0.5 },
    pickerItemBody: {
      flex: 1,
      marginLeft: spacing.md,
    },
    pickerAddBtnActive: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    modalEmptyWrap: {
      padding: spacing.xxxl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    modalEmptyTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    modalEmptyDesc: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    modalEmptyIcon: {
      width: 58,
      height: 58,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
  }), [colors]);

  // ★ 所有 hooks 声明完毕后，最后做 early return（遵守 Rules of Hooks）
  if (!activeWorkout) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}
        edges={['top', 'bottom']}
      >
        <EmptyState
          icon="check-circle-outline"
          title={String(t('workoutSession.sessionClosed', { defaultValue: 'Session closed' }))}
          desc={String(t('workoutSession.navigatingBack', { defaultValue: 'Navigating back...' }))}
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: `${t('workout.titleActive')}  ${formatDurationClock(elapsed)}`,
          headerTintColor: colors.accent,
          headerLeft: () => (
            <Pressable onPress={handleCancel}>
              <Text style={styles.headerCancel}>
                {t('workoutSession.cancel')}
              </Text>
            </Pressable>
          ),
        }}
      />

      <SafeAreaView style={styles.screen} edges={['bottom']}>
        {/* SUMMARY BAR */}
        <View style={styles.summaryBar} testID="workout-summary-bar">
          <SummaryPill
            label={t('workout.statsVolume')}
            value={`${Math.round(totalVolume)}`}
            unit={settings.units}
            icon="weight-kilogram"
            accent={colors.primary}
          />
          <SummaryPill
            label={t('compact.headerDone')}
            value={`${completedSets}/${totalSets}`}
            unit={t('compact.unitSets')}
            icon="check-all"
            accent={colors.success}
          />
          <SummaryPill
            label={t('compact.rest')}
            value={formatDurationClock(elapsed)}
            icon="av-timer"
            accent={colors.info}
          />
        </View>

        {/* REST TIMER */}
        {restActive ? (
          <View style={[styles.restBarActive, { alignItems: 'center' }]}>
            <ProgressRing value={restProgress} size={56} strokeWidth={6} color={colors.accent} />
            {/* 修复"倒计时"文字竖排错乱：
                1) 去掉 minWidth:0（之前让 Yoga 在并排容器过多时挤压标签容器到 <64dp → 4 个汉字被迫 1 字/行=竖排错觉）
                2) 改为 minWidth:140，保证至少容纳 4汉字*18 + 3数字倒计时*24 + Next行 不换行不压缩
                3) 内部 Text 对齐左，垂直间距自然
            */}
            <View style={{ flex: 1, minWidth: 140, gap: spacing.xs, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 2 }}>
              <Text style={styles.restLabel}>{t('workoutSession.restTitle')}</Text>
              <Text style={styles.restTimer}>{restMmss}</Text>
              {restTimerSt.nextContext?.exerciseName && (
                <Text style={styles.nextContextText} numberOfLines={1}>
                  Next: {restTimerSt.nextContext.exerciseName} · Set{' '}
                  {restTimerSt.nextContext.setIndex}/{restTimerSt.nextContext.totalSets}
                </Text>
              )}
            </View>
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                restMinus10();
              }}
              style={styles.adjust10Btn}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={t('workout.restTimerMinus10', {
                defaultValue: '-10 秒',
              })}
            >
              <Text style={styles.adjust10BtnText}>-10</Text>
            </PressableScale>
            <PressableScale onPress={skipRest} style={styles.restSkipBtn} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={t('workoutSession.restSkip')}>
              <Text style={styles.restSkipText}>{t('workoutSession.restSkip')}</Text>
              <Icon name="arrow-right" size={12} color={colors.accent} />
            </PressableScale>
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                restPlus10();
              }}
              style={styles.adjust10Btn}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={t('workout.restTimerPlus10', {
                defaultValue: '+10 秒',
              })}
            >
              <Text style={styles.adjust10BtnText}>+10</Text>
            </PressableScale>
          </View>
        ) : (
          <PressableScale
            onPress={startRest}
            style={styles.restBar}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.startRestTimer')}
          >
            <View style={[styles.restIconTray, { backgroundColor: colors.info + '18' }]}>
              <Icon name="timer-sand" size={16} color={colors.info} />
            </View>
            <Text style={styles.restBarText}>
              {`${t('workoutSession.restTitle')} (${settings.defaultRestSeconds}s)`}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textTertiary} />
          </PressableScale>
        )}

        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {safeExercises.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconTray}>
                <Icon name="weight-lifter" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('workoutSession.newSession')}</Text>
              <Text style={styles.emptyDesc}>
                {t('workoutSession.emptyDesc')}
              </Text>
            </View>
          ) : (
            // ExerciseBlock 是 memo 组件：所有回调必须是稳定引用（store action 或
            // useCallback），否则每组数据 tick（1s 计时 / 倒计时）都会重建 N 个闭包，
            // 让 memo 完全失效并整棵高斯列表重渲染。
            safeExercises.map((we) => {
              const id = String(we.exerciseId);
              return (
                <ExerciseBlock
                  key={id}
                  exercise={exMap.get(id)}
                  workoutExercise={we}
                  units={settings.units}
                  lastEntry={lastEntries.get(id) ?? null}
                  onApplyLast={applyLastToExercise}
                  onOpenPlates={openPlatesFor}
                  onAddSet={addSetToExercise}
                  onRemoveSet={removeSet}
                  onUpdateSet={handleUpdateSet}
                  onRemove={removeExerciseFromActive}
                />
              );
            })
          )}

          {/* Note */}
          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <View style={styles.noteIconTray}>
                <Icon name="notebook-edit-outline" size={16} color={colors.info} />
              </View>
              <View style={styles.noteHeaderBody}>
                <Text style={styles.noteTitle}>{t('workout.historyTitle') + ' · ' + t('compact.instrHeader')}</Text>
                <Text style={styles.noteSub}>{t('chips.recent')}</Text>
              </View>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.noteInput}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          <View style={styles.bottomContentInset} />
        </ScrollView>

        {/* BOTTOM ACTIONS */}
        <View style={styles.bottomBar}>
          <PressableScale
            onPress={openPicker}
            style={styles.addBtn}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('workoutSession.addExercise')}
            testID="btn-add-exercise"
          >
            <View style={styles.addBtnIconTray}>
              <Icon name="plus" size={18} color={colors.primary} />
            </View>
            <Text style={styles.addBtnText}>{t('workoutSession.addExercise')}</Text>
          </PressableScale>

          <PressableScale
            onPress={handleFinish}
            style={[
              styles.finishBtn,
              totalSets === 0 && styles.finishBtnDisabled,
            ]}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('workoutSession.done')}
            testID="btn-finish-workout"
          >
            <Icon name="flag-checkered" size={18} color={colors.textInverse} />
            <Text style={styles.finishBtnText}>{t('workoutSession.done')}</Text>
          </PressableScale>
        </View>

        {/* EXERCISE PICKER MODAL */}
        <Modal
          visible={pickerOpen}
          animationType="slide"
          onRequestClose={closePicker}
        >
          <SafeAreaView style={styles.modalScreen}>
            <View style={styles.modalHeader}>
              <PressableScale onPress={closePicker} hitSlop={8} scaleTo={0.96} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
                <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
              </PressableScale>
              <View style={styles.modalTitleWrap}>
                <Icon name="clipboard-list-outline" size={14} color={colors.primary} />
                <Text style={styles.modalTitle}>{t('workoutSession.addExercise')}</Text>
              </View>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <View style={styles.modalSearchWrap}>
              <SearchBar
                value={pickerQuery}
                onChange={setPickerQuery}
                placeholder={t('home.searchPlaceholder')}
              />
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
            >
              {pickerResults.map((ex) => {
                const already = safeExercises.some(
                  (e) => String(e.exerciseId) === String(ex.id)
                );
                const muscleColor = muscleColorOf(colors, ex.body_part);
                return (
                  <PressableScale
                    key={ex.id}
                    onPress={() => handlePickExercise(ex.id)}
                    style={[
                      styles.pickerItem,
                      already && styles.pickerItemDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={effectiveLang === 'zh' ? displayNameZh(ex) : ex.name}
                    testID={`picker-exercise-${ex.id}`}
                  >
                    <HybridImage
                      uri={getImageUrl(ex.image)}
                      tint={muscleColor}
                      iconName={iconForBodyPart(ex.body_part)}
                      fallbackBodyPart={ex.body_part}
                      fallbackTint={muscleColor}
                      style={[styles.pickerImgWrap, { borderColor: muscleColor + '55' }]}
                      iconRatio={0.45}
                    />
                    <View style={styles.pickerItemBody}>
                      <Text style={styles.pickerName} numberOfLines={1}>
                        {effectiveLang === 'zh' ? displayNameZh(ex) : ex.name}
                      </Text>
                      <View style={styles.pickerMetaRow}>
                        <MiniTag
                          icon={iconForBodyPart(ex.body_part)}
                          label={labelForBodyPart(ex.body_part, effectiveLang)}
                          color={muscleColor}
                        />
                        <MiniTag
                          icon={iconForEquipment(ex.equipment)}
                          label={labelForEquipment(ex.equipment, effectiveLang)}
                          color={colors.info}
                        />
                      </View>
                    </View>
                    <View style={[
                      styles.pickerAddBtn,
                      already && styles.pickerAddBtnActive,
                    ]}>
                      <Icon
                        name={already ? 'check' : 'plus'}
                        size={16}
                        color={already ? colors.textInverse : colors.primary}
                      />
                    </View>
                  </PressableScale>
                );
              })}
              {pickerResults.length === 0 && (
                <View style={styles.modalEmptyWrap}>
                  <View style={styles.modalEmptyIcon}>
                    <Icon name="magnify-close" size={28} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.modalEmptyTitle}>
                    {t('home.emptyTitle')}
                  </Text>
                  <Text style={styles.modalEmptyDesc}>
                    {t('home.emptyDesc')}
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* 杠铃片配重弹窗 —— 训练中途不用心算每边挂几片 */}
        <PlateCalculator
          visible={plateTarget !== null}
          targetKg={plateTarget ? toKg(plateTarget.weight, settings.units) : 0}
          unit={settings.units}
          config={settings.plateConfig}
          onClose={() => setPlateTarget(null)}
          onApplyLoadable={(kg) => {
            if (!plateTarget) return;
            const nextWeight = displayWeight(kg, settings.units);
            const st = useAppStore.getState();
            const we = (st.activeWorkout?.exercises ?? []).find(
              (e) => e && String(e.exerciseId) === String(plateTarget.exerciseId)
            );
            const arr = we && Array.isArray(we.sets) ? we.sets.filter(Boolean) : [];
            const lastSet = arr[arr.length - 1];
            if (lastSet) {
              updateSet(plateTarget.exerciseId, lastSet.id, { weight: nextWeight });
              safeHaptic('medium');
            }
            setPlateTarget(null);
          }}
        />
      </SafeAreaView>
    </>
  );
}

// ============================
// Sub components
// ============================
function SummaryPillImpl({
  label,
  value,
  unit,
  icon,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  accent: string;
}) {
  const colors = useThemeColors();
  const pillStyles = useMemo(() => StyleSheet.create({
    wrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    iconTray: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      marginLeft: spacing.sm,
      flex: 1,
    },
    value: {
      ...typography.mono,
      fontSize: 14,
      lineHeight: 18,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    unit: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      color: colors.textTertiary,
    },
    label: {
      ...typography.small,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.xs,
    },
  }), [colors]);
  return (
    <View style={pillStyles.wrap}>
      <View style={[pillStyles.iconTray, { backgroundColor: accent + '18' }]}>
        <Icon name={icon} size={13} color={accent} />
      </View>
      <View style={pillStyles.body}>
        <Text style={pillStyles.value}>
          {value}
          {unit ? <Text style={pillStyles.unit}> {unit}</Text> : null}
        </Text>
        <Text style={pillStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const SummaryPill = memo(SummaryPillImpl);

function ExerciseBlockImpl({
  exercise,
  workoutExercise,
  units,
  lastEntry,
  onApplyLast,
  onOpenPlates,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onRemove,
}: {
  exercise: Exercise | undefined;
  workoutExercise: WorkoutExercise;
  units: 'kg' | 'lb';
  /** 该动作上一次训练的组数据；null = 从未练过（隐藏参考行） */
  lastEntry: ExerciseHistoryEntry | null;
  onApplyLast: (exerciseId: string) => void;
  onOpenPlates: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onUpdateSet: (exerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  onRemove: (exerciseId: string) => void;
}) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const oneRmFormula = useAppStore((s) => s.settings.oneRmFormula);
  // 新功能：点击动作卡片标题/图区域 → 进入动作介绍/动画详情页，pop返回时训练状态(zustand全局) + restTimer 完全保留可继续训练
  const router = useRouter();
  const goDetail = useCallback(() => {
    safeHaptic('light');
    router.push(`/exercise/${workoutExercise.exerciseId}` as any);
  }, [router, workoutExercise.exerciseId]);
  const detailLabel = exercise
    ? `${t('workout.sessionOpenExercise')} ${exercise.name}`
    : `${t('workout.sessionOpenExercise')} ${workoutExercise.exerciseId}`;
  const effectiveLang: 'zh' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'zh';

  // 把「父级稳定回调 + exerciseId」绑定成本组件内的稳定回调。
  // 这样 <SetRow> 拿到的是恒定引用，配合 memo 才能在 1s 计时 tick 时整块跳过。
  const exerciseId = String(workoutExercise.exerciseId);
  const removeThis = useCallback(() => onRemove(exerciseId), [onRemove, exerciseId]);
  const applyLast = useCallback(() => onApplyLast(exerciseId), [onApplyLast, exerciseId]);
  const openPlates = useCallback(() => onOpenPlates(exerciseId), [onOpenPlates, exerciseId]);
  const addSet = useCallback(() => onAddSet(exerciseId), [onAddSet, exerciseId]);

  const removeSetRow = useCallback(
    (setId: string) => onRemoveSet(exerciseId, setId),
    [onRemoveSet, exerciseId]
  );
  const toggleDone = useCallback(
    (setId: string, nextCompleted: boolean) => {
      if (nextCompleted) safeHaptic('light');
      onUpdateSet(exerciseId, setId, { completed: nextCompleted });
    },
    [onUpdateSet, exerciseId]
  );
  const changeWeight = useCallback(
    (setId: string, v: number) => onUpdateSet(exerciseId, setId, { weight: v }),
    [onUpdateSet, exerciseId]
  );
  const changeReps = useCallback(
    (setId: string, v: number) => onUpdateSet(exerciseId, setId, { reps: v }),
    [onUpdateSet, exerciseId]
  );
  const cycleType = useCallback(
    (setId: string, current: SetType | undefined) =>
      onUpdateSet(exerciseId, setId, { type: nextSetType(current) }),
    [onUpdateSet, exerciseId]
  );
  const exBlockStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 144,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    imgWrap: {
      width: 72,
      height: 72,
      borderRadius: radius.md,
      borderWidth: 2,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      flexShrink: 0,
    },
    img: { width: '100%', height: '100%' },
    name: {
      ...typography.bodyBold,
      fontSize: 15,
      lineHeight: 20,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    sub: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 2,
    },
    desc: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
      color: colors.textTertiary,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: 2,
    },
    infoCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      paddingVertical: 2,
    },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.danger + '14',
      borderWidth: 1,
      borderColor: colors.danger + '30',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      marginBottom: spacing.sm,
    },
    th: {
      ...typography.small,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginHorizontal: spacing.xs,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '800',
    },
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: radius.md,
      borderColor: colors.primary + '44',
      backgroundColor: colors.primary + '08',
    },
    addSetText: {
      ...typography.captionBold,
      color: colors.primary,
      letterSpacing: 0.3,
    },
    // ---- 上次参考条 ----
    refBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    refLabel: {
      ...typography.micro,
      color: colors.textTertiary,
    },
    refValue: {
      ...typography.captionBold,
      color: colors.textSecondary,
      marginTop: 1,
    },
    refAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.sm,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '3A',
      flexShrink: 0,
    },
    refActionText: {
      ...typography.micro,
      color: colors.primary,
      fontWeight: '700',
    },
    // ---- 徽标行（1RM / 配重）----
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      backgroundColor: colors.surfaceElevated,
    },
    badgeText: {
      ...typography.micro,
      fontWeight: '700',
    },
  }), [colors]);

  const color = exercise ? muscleColorOf(colors, exercise.body_part) : colors.primary;

  const safeSets = useMemo(
    () => (Array.isArray(workoutExercise.sets) ? workoutExercise.sets.filter(Boolean) : []),
    [workoutExercise.sets]
  );

  /**
   * 本次训练的预估 1RM —— 取已完成组里最高的那次估算。
   * 用户练到一半就能看到「今天状态对应的极限」，这是渐进超负荷最直接的反馈。
   */
  const liveBest1RM = useMemo(() => {
    let best = 0;
    for (const s of safeSets) {
      const w = Number(s?.weight) || 0;
      const r = Number(s?.reps) || 0;
      if (!s?.completed || w <= 0 || r <= 0) continue;
      const v = estimate1RM(w, r, oneRmFormula);
      if (v > best) best = v;
    }
    return best;
  }, [safeSets, oneRmFormula]);

  /** 上次对应组的参考值（按组序号对齐） */
  const previousFor = (idx: number): { weight: number; reps: number } | null => {
    if (!lastEntry || !Array.isArray(lastEntry.sets)) return null;
    const s = lastEntry.sets[idx];
    if (!s) return null;
    const w = Number(s.weight);
    const r = Number(s.reps);
    if (!Number.isFinite(w) || !Number.isFinite(r)) return null;
    return { weight: w, reps: r };
  };

  const lastSummary = useMemo(() => {
    if (!lastEntry || !Array.isArray(lastEntry.sets) || lastEntry.sets.length === 0) return null;
    return lastEntry.sets
      .slice(0, 4)
      .map((s) => `${Number(s.weight) || 0}×${Number(s.reps) || 0}`)
      .join(' · ');
  }, [lastEntry]);

  return (
    <View style={exBlockStyles.card}>
      <View style={exBlockStyles.header}>
        {/* 左侧"动作图 + 名称/肌群/器械标签/简介"做成点击区 → 进入动作介绍/动画详情；删除按钮独立在右侧不被导航包裹，互不干扰 */}
        <PressableScale
          onPress={goDetail}
          scaleTo={0.985}
          hitSlop={4}
          style={{ flexDirection: 'row', flex: 1, alignItems: 'center', height: '100%', gap: spacing.md }}
          accessibilityRole="button"
          accessibilityLabel={detailLabel}
          accessibilityHint={t('workout.accessHintExercise')}
        >
          <HybridImage
            uri={exercise ? getImageUrl(exercise.image) : undefined}
            tint={color}
            iconName={exercise ? iconForBodyPart(exercise.body_part) : 'target'}
            fallbackBodyPart={exercise?.body_part}
            fallbackTint={color}
            style={[exBlockStyles.imgWrap, { borderColor: color + '66' }]}
            iconRatio={0.45}
          />
          <View style={[exBlockStyles.infoCol, { minWidth: 0 }]}>
            {/* 行1: 动作名 */}
            <Text style={exBlockStyles.name} numberOfLines={1}>
              {exercise ? (effectiveLang === 'zh' ? displayNameZh(exercise) : exercise.name) : (effectiveLang === 'zh' ? `未知动作 · ${workoutExercise.exerciseId}` : `Unknown exercise · ${workoutExercise.exerciseId}`)}
            </Text>
            {/* 行2: 英文名/器械 sub */}
            {exercise && (
              <Text style={exBlockStyles.sub} numberOfLines={1}>
                {effectiveLang === 'zh'
                  ? `${exercise.name ?? ''} · ${labelForEquipment(exercise.equipment, effectiveLang)}`
                  : labelForEquipment(exercise.equipment, effectiveLang)}
              </Text>
            )}
            {/* 行3: 动作简介 2 行 (target translated or zh instructions lead) */}
            {exercise && (() => {
              const instrZh = (exercise.instructions as any)?.zh ?? '';
              const instrEn = (exercise.instructions as any)?.en ?? '';
              const lead = effectiveLang === 'zh' ? instrZh : instrEn;
              const rawDesc = translateTargetPhrase(exercise.target ?? '', effectiveLang);
              const text = rawDesc || lead?.slice(0, 60) || '';
              return text ? (
                <Text style={exBlockStyles.desc} numberOfLines={2} ellipsizeMode="tail">
                  {text}
                </Text>
              ) : null;
            })()}
            {/* 行4: MiniTags body part + equipment + secondary muscles (中文) */}
            <View style={exBlockStyles.metaRow}>
              <MiniTag
                icon={exercise ? iconForBodyPart(exercise.body_part) : 'alert-circle-outline'}
                label={
                  exercise
                    ? labelForBodyPart(exercise.body_part, effectiveLang)
                    : effectiveLang === 'zh'
                      ? `${t('workout.exerciseIdPrefix')}${workoutExercise.exerciseId}`
                      : `ID:${workoutExercise.exerciseId}`
                }
                color={color}
              />
              {exercise ? (
                <MiniTag
                  icon={iconForEquipment(exercise.equipment)}
                  label={labelForEquipment(exercise.equipment, effectiveLang)}
                  color={colors.info}
                />
              ) : (
                <MiniTag
                  icon="information-outline"
                  label={effectiveLang === 'zh' ? t('workout.metadataMissing') : 'Metadata missing'}
                  color={colors.info}
                />
              )}
              {exercise && (exercise.secondary_muscles ?? []).slice(0, 2).map((m) => {
                const zhLabel = labelForMuscle(m, effectiveLang);
                return (
                  <MiniTag
                    key={m}
                    // "muscle" 不在 glyphmap 里（会渲染成问号），次级肌群用 arm-flex-outline
                    icon="arm-flex-outline"
                    label={zhLabel.length > 5 ? zhLabel.slice(0, 5) : zhLabel}
                    color={color}
                  />
                );
              })}
            </View>
          </View>
        </PressableScale>
        <PressableScale
          onPress={() => {
            safeHaptic('light');
            Alert.alert(t('workoutSession.removeExerciseTitle'), t('session.removeExerciseWarn'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: removeThis,
              },
            ]);
          }}
          hitSlop={6}
          style={exBlockStyles.removeBtn}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.delete')}
        >
          <Icon name="trash-can-outline" size={14} color={colors.danger} />
        </PressableScale>
      </View>

      {/* ===== 上次训练参考 + 一键填充 + 1RM + 配重 ===== */}
      <View style={exBlockStyles.refBar}>
        {lastSummary ? (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={exBlockStyles.refLabel}>
                {t('session.lastTime', { defaultValue: '上次' })} · {lastEntry?.date}
              </Text>
              <Text style={exBlockStyles.refValue} numberOfLines={1}>
                {lastSummary}
              </Text>
            </View>
            <PressableScale
              onPress={() => {
                safeHaptic('light');
                applyLast();
              }}
              style={exBlockStyles.refAction}
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={t('session.applyLast', { defaultValue: '填入上次数据' })}
            >
              <Icon name="content-duplicate" size={12} color={colors.primary} />
              <Text style={exBlockStyles.refActionText}>
                {t('session.applyLast', { defaultValue: '填入上次数据' })}
              </Text>
            </PressableScale>
          </>
        ) : (
          <Text style={exBlockStyles.refLabel}>
            {t('session.noHistory', { defaultValue: '首次训练这个动作' })}
          </Text>
        )}
      </View>

      <View style={exBlockStyles.badgeRow}>
        {liveBest1RM > 0 ? (
          <View style={[exBlockStyles.badge, { borderColor: colors.accent + '55' }]}>
            <Icon name="chart-line" size={11} color={colors.accent} />
            <Text style={[exBlockStyles.badgeText, { color: colors.accent }]}>
              1RM ≈ {Math.round(liveBest1RM * 10) / 10} {units}
            </Text>
          </View>
        ) : null}
        {/* 杠铃片计算器：只对本动作当前有重量的场景开放 */}
        <PressableScale
          onPress={() => {
            safeHaptic('light');
            openPlates();
          }}
          style={[exBlockStyles.badge, { borderColor: colors.info + '55' }]}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={t('session.plateTitle', { defaultValue: '杠铃片配重' })}
        >
          <Icon name="calculator-variant-outline" size={11} color={colors.info} />
          <Text style={[exBlockStyles.badgeText, { color: colors.info }]}>
            {t('session.plateTitle', { defaultValue: '杠铃片配重' })}
          </Text>
        </PressableScale>
      </View>

      <View style={exBlockStyles.tableHeader}>
        <Text style={[exBlockStyles.th, { width: 36, textAlign: 'center' }]}>{t('workoutSession.colSet')}</Text>
        <Text style={[exBlockStyles.th, { flex: 1 }]}>{units.toUpperCase()}</Text>
        <Text style={[exBlockStyles.th, { flex: 1 }]}>{t('compact.unitReps')}</Text>
        <View style={{ width: 36, alignItems: 'center' }}>
          <Icon name="check-bold" size={10} color={colors.textTertiary} />
        </View>
        <Text style={[exBlockStyles.th, { width: 30 }]} />
      </View>

      {(Array.isArray(workoutExercise.sets) ? workoutExercise.sets : []).filter(Boolean).map((set, idx) => (
        <SetRow
          key={String(set.id ?? idx)}
          index={idx}
          set={set}
          previous={previousFor(idx)}
          onToggleDone={toggleDone}
          onChangeWeight={changeWeight}
          onChangeReps={changeReps}
          onCycleType={cycleType}
          onRemove={removeSetRow}
        />
      ))}

      <PressableScale
        onPress={() => {
          safeHaptic('light');
          addSet();
        }}
        style={exBlockStyles.addSetBtn}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={t('workoutSession.addSet')}
      >
        <Icon name="plus" size={14} color={colors.primary} />
        <Text style={exBlockStyles.addSetText}>{t('workoutSession.addSet')}</Text>
      </PressableScale>
    </View>
  );
}

/** 组类型循环：正式 → 热身 → 递减 → 力竭 → AMRAP → 正式 */
function nextSetType(cur: SetType | undefined): SetType {
  const i = SET_TYPES.indexOf(cur ?? 'working');
  return SET_TYPES[(i + 1) % SET_TYPES.length] ?? 'working';
}

// ============================================================================
// memo 边界
//
// 训练执行页每秒都会因「会话计时器 / 组间倒计时」重渲染一次。在没有 memo 的
// 情况下，一次 tick 会让 N 个 ExerciseBlock × M 个 SetRow 全部重建并重算样式，
// 中低端机上表现为输入框掉帧。下面三层 memo 把它压到只有真正变化的那一行走測。
// ============================================================================

/** ExerciseBlock：只有该动作自身的数据变化时重渲染 */
const ExerciseBlock = memo(ExerciseBlockImpl);

/**
 * SetRow：`previous` 每次渲染都是新对象（previousFor 返回字面量），所以默认浅比较
 * 会失效。这里逐字段比较。
 */
const SetRow = memo(SetRowImpl, (prev, next) => {
  if (prev.set !== next.set) return false;
  if (prev.index !== next.index) return false;
  if (
    prev.onToggleDone !== next.onToggleDone ||
    prev.onChangeWeight !== next.onChangeWeight ||
    prev.onChangeReps !== next.onChangeReps ||
    prev.onCycleType !== next.onCycleType ||
    prev.onRemove !== next.onRemove
  ) {
    return false;
  }
  const a = prev.previous;
  const b = next.previous;
  if (a === b) return true;
  if (!a || !b) return false;
  return a.weight === b.weight && a.reps === b.reps;
});

function SetRowImpl({
  index,
  set,
  previous,
  onToggleDone,
  onChangeWeight,
  onChangeReps,
  onCycleType,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  /** 上一次训练同序号组的数值；null 表示无历史 */
  previous: { weight: number; reps: number } | null;
  onToggleDone: (setId: string, nextCompleted: boolean) => void;
  onChangeWeight: (setId: string, v: number) => void;
  onChangeReps: (setId: string, v: number) => void;
  onCycleType: (setId: string, current: SetType | undefined) => void;
  onRemove: (setId: string) => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();

  const type = set.type ?? 'working';
  // 热身组用琥珀色、递减用蓝、力竭用红、AMRAP 用橙 —— 一眼能扫出这组是干嘛的
  const typeColor =
    type === 'warmup'
      ? colors.warning
      : type === 'dropset'
        ? colors.info
        : type === 'failure'
          ? colors.danger
          : type === 'amrap'
            ? colors.accent
            : null;
  const typeLabel = t(`session.setType_${type}`, {
    defaultValue:
      type === 'warmup'
        ? '热身组'
        : type === 'dropset'
          ? '递减组'
          : type === 'failure'
            ? '力竭组'
            : type === 'amrap'
              ? 'AMRAP'
              : '正式组',
  });
  const setRowStyles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      marginBottom: spacing.xs,
    },
    rowDone: {
      opacity: 0.75,
    },
    index: {
      ...typography.captionBold,
      color: colors.textSecondary,
    },
    inputFlex: {
      flex: 1,
    },
    checkBtn: {
      height: 36,
      borderRadius: radius.sm,
      marginHorizontal: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    checkBtnDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    deleteBtn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    // ---- 第二行：组类型徽标 + 上次参考 ----
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      // 与上方数字输入框左缘对齐（序号列 36 + 输入框外边距）
      paddingLeft: 36 + spacing.xs,
      marginTop: -2,
      marginBottom: spacing.xs,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    typeChipText: {
      ...typography.micro,
      fontWeight: '700',
    },
    prevText: {
      flex: 1,
      ...typography.micro,
      color: colors.textTertiary,
    },
  }), [colors]);

  // 第二行只在「有历史」或「非默认组类型」时出现 —— 正式组且无历史时不占额外高度，
  // 保证一趟十几个动作的长列表不会因为每行多一行而变得难以扫读。
  const showMeta = previous !== null || type !== 'working';

  return (
    <View>
      <View
        style={[
          setRowStyles.row,
          set.completed && setRowStyles.rowDone,
        ]}
      >
        <Text
          style={[
            setRowStyles.index,
            { width: 36, textAlign: 'center' },
            set.completed && { color: colors.textTertiary },
          ]}
        >
          {index + 1}
        </Text>

        <NumInput
          value={set.weight}
          onChange={(v) => onChangeWeight(set.id, v)}
          style={setRowStyles.inputFlex}
          highlight={set.completed}
        />
        <NumInput
          value={set.reps}
          onChange={(v) => onChangeReps(set.id, v)}
          style={setRowStyles.inputFlex}
          highlight={set.completed}
        />

        <PressableScale
          onPress={() => onToggleDone(set.id, !set.completed)}
          style={[
            setRowStyles.checkBtn,
            set.completed && setRowStyles.checkBtnDone,
            { width: 36 },
          ]}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.markSetDone')}
          testID={`set-check-${index}`}
        >
          {set.completed ? (
            <Icon name="check" size={14} color={colors.textInverse} />
          ) : null}
        </PressableScale>

        <PressableScale
          onPress={() => onRemove(set.id)}
          style={[setRowStyles.deleteBtn, { width: 30 }]}
          hitSlop={4}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.remove')}
        >
          <Icon name="close" size={12} color={colors.textTertiary} />
        </PressableScale>
      </View>

      {showMeta ? (
        <View style={setRowStyles.metaRow}>
          <PressableScale
            onPress={() => {
              safeHaptic('light');
              onCycleType(set.id, set.type);
            }}
            style={[
              setRowStyles.typeChip,
              {
                borderColor: (typeColor ?? colors.textTertiary) + '66',
                backgroundColor: typeColor ? typeColor + '14' : 'transparent',
              },
            ]}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={`${t('session.setType', { defaultValue: '组类型' })}: ${typeLabel}`}
          >
            <Icon
              name={
                type === 'warmup'
                  ? 'fire'
                  : type === 'dropset'
                    ? 'arrow-down-bold'
                    : type === 'failure'
                      ? 'flash-alert'
                      : type === 'amrap'
                        ? 'infinity'
                        : 'dumbbell'
              }
              size={9}
              color={typeColor ?? colors.textTertiary}
            />
            <Text style={[setRowStyles.typeChipText, { color: typeColor ?? colors.textSecondary }]}>
              {typeLabel}
            </Text>
          </PressableScale>

          {previous ? (
            <Text style={setRowStyles.prevText} numberOfLines={1}>
              {t('session.lastShort', { defaultValue: '上次' })} {previous.weight} × {previous.reps}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function NumInputImpl({
  value,
  onChange,
  style,
  highlight,
}: {
  value: number;
  onChange: (v: number) => void;
  style?: any;
  highlight?: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const numInp = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.sm,
      overflow: 'hidden',
      height: 36,
      marginHorizontal: spacing.xs,
    },
    btn: {
      width: 28,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      height: '100%',
      textAlign: 'center',
      color: colors.textPrimary,
      ...typography.mono,
      fontSize: 14,
      lineHeight: 18,
      padding: 0,
      minWidth: 36,
    },
    inputDone: {
      color: colors.primary,
      fontWeight: '800',
    },
  }), [colors]);
  return (
    <View style={[numInp.wrap, style]}>
      <PressableScale
        onPress={() => {
          safeHaptic('light');
          onChange(Math.max(0, (value || 0) - (value >= 20 ? 5 : 2.5)));
        }}
        style={numInp.btn}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.decreaseValue')}
      >
        <Icon name="minus" size={12} color={colors.textSecondary} />
      </PressableScale>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseFloat(t) || 0;
          onChange(n >= 0 ? n : 0);
        }}
        keyboardType="numeric"
        style={[
          numInp.input,
          highlight && numInp.inputDone,
        ]}
        placeholder="0"
        placeholderTextColor={colors.textTertiary}
      />
      <PressableScale
        onPress={() => {
          safeHaptic('light');
          onChange((value || 0) + (value >= 20 ? 5 : 2.5));
        }}
        style={numInp.btn}
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.increaseValue')}
      >
        <Icon name="plus" size={12} color={colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

/** 数值输入：value/highlight 是标量，onChange 由 memo 前非时保持稳定即可 */
const NumInput = memo(NumInputImpl);

// ============================================================
// End of file (all styles moved into components via useMemo + useThemeColors)
// ============================================================

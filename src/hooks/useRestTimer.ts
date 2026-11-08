import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { safeHaptic } from '@/utils/haptic';
import { formatMmss } from '@/utils/format';
import { useToast } from '@/components/ui/Toast';
import type { RestTimerRuntime } from '@/types';

/**
 * useRestTimer
 * --------------------------------------------------------------
 * Wraps the zustand-level `restTimer` runtime with:
 *   • a 1Hz tick loop driven by setInterval;
 *   • wall-clock drift correction based on `startedAt` (applied
 *     every 10 ticks so deep-sleep / app-switch drift never
 *     compounds);
 *   • 0-reached side-effects: stop + success haptic + toast.
 *
 * The hook deliberately keeps zero React-state copies of the
 * timer — the store is the single source of truth.  That way
 * any other screen that calls startRestTimer/adjustRestTimer
 * stays perfectly in sync with this consumer.
 */
export function useRestTimer(): {
  timer: RestTimerRuntime;
  progress: number;
  mmss: string;
  start: (sec: number, ctx?: RestTimerRuntime['nextContext']) => void;
  plus10: () => void;
  minus10: () => void;
  skip: () => void;
} {
  const { t } = useTranslation();
  const toast = useToast();

  const timer = useAppStore((s) => s.restTimer);
  const startRestTimer = useAppStore((s) => s.startRestTimer);
  const adjustRestTimer = useAppStore((s) => s.adjustRestTimer);
  const stopRestTimer = useAppStore((s) => s.stopRestTimer);

  // Counter used to trigger the "hard correction" every N ticks.
  const tickCounterRef = useRef(0);
  // Guard ref so reaching 0 fires side-effects exactly once even if
  // the interval fires an extra tick before stopRestTimer commits.
  const finishedRef = useRef(false);

  // i18n / toast 不该成为 interval 的依赖：语言切换只是文案变化，却会导致
  // setInterval 被销毁重建，正在跑的倒计时会肉眼可见地「卡一拍」。
  // 放进 ref 后，effect 只依赖真正的计时状态。
  const sideEffectsRef = useRef({ t, toast });
  useEffect(() => {
    sideEffectsRef.current = { t, toast };
  }, [t, toast]);

  /**
   * 倒计时归零的统一出口：停表 + 触感 + toast。
   *
   * 之前这段逻辑在「10 tick 校正」「回到前台」「常规 1s 自然走完」三个分支里
   * 各抄了一遍，将来加个音效就要改三处且容易漏。现在只有一个出口。
   */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    useAppStore.getState().stopRestTimer();
    safeHaptic('success');
    try {
      const { t: tr, toast: toaster } = sideEffectsRef.current;
      toaster.show({
        title: tr('workout.restTimerFinishAlert', {
          defaultValue: 'Rest is up · next set!',
        }),
        variant: 'success',
      });
    } catch {
      /* toast provider 未挂载 —— 忽略 */
    }
  }, []);

  /**
   * 把剩余时间按墙钟强行对齐到「真实流逝」。
   *
   * 抽成独立函数是因为有两个触发点：
   *   1) 每 10 次 tick（兜住系统轻度节流导致的累积漂移）；
   *   2) AppState 回到前台（iOS/Android 后台会几乎完全暂停 setInterval，
   *      只靠 10 tick 兜底的话，切回来最长要等 10 秒才跳到正确数字，
   *      用户会看到倒计时「卡住不动」然后突然掉一大截）。
   */
  const reconcileToWallClock = useCallback(() => {
    const snap = useAppStore.getState().restTimer;
    if (!snap.active || snap.startedAt == null) return;
    const expectedRemaining = Math.max(
      0,
      snap.totalSeconds - Math.floor((Date.now() - snap.startedAt) / 1000)
    );
    const diff = expectedRemaining - snap.remainingSeconds;
    if (diff === 0) return;
    useAppStore.getState().adjustRestTimer(diff);
  }, []);

  // 前台校正：切回 App 的瞬间立刻对齐，不等下一个 tick。
  useEffect(() => {
    if (!timer.active) return;
    const sub = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next !== 'active') return;
        reconcileToWallClock();
        // 后台期间可能已经跨过 0，对齐后立刻补一次完成判定
        const after = useAppStore.getState().restTimer;
        if (after.active && after.remainingSeconds <= 0) {
          finish();
        }
      }
    );
    return () => sub.remove();
  }, [timer.active, reconcileToWallClock, finish]);

  useEffect(() => {
    if (!timer.active) {
      tickCounterRef.current = 0;
      finishedRef.current = false;
      return;
    }
    const id = setInterval(() => {
      const snap = useAppStore.getState().restTimer;
      if (!snap.active) return;

      tickCounterRef.current += 1;

      // 1) Wall-clock hard correction every 10 ticks OR whenever the
      //    naive tick would produce a clearly wrong value.
      if (snap.startedAt && tickCounterRef.current % 10 === 0) {
        const elapsedMs = Date.now() - snap.startedAt;
        const expectedRemaining = Math.max(
          0,
          snap.totalSeconds - Math.floor(elapsedMs / 1000)
        );
        const diff = expectedRemaining - snap.remainingSeconds;
        if (diff !== 0) {
          useAppStore.getState().adjustRestTimer(diff);
          // 用校正后的值做 <=0 判定，避免读到校正前的旧快照。
          const corrected = useAppStore.getState().restTimer;
          if (corrected.remainingSeconds <= 0) {
            finish();
          }
          return;
        }
      }

      // 2) Normal 1-second path.
      if (snap.remainingSeconds <= 1) {
        finish();
        return;
      }
      useAppStore.getState().adjustRestTimer(-1);
    }, 1000);
    return () => clearInterval(id);
  }, [timer.active, timer.startedAt, finish]);

  const progress = useMemo(() => {
    if (timer.totalSeconds <= 0) return 0;
    const raw = timer.remainingSeconds / timer.totalSeconds;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(1, raw));
  }, [timer.remainingSeconds, timer.totalSeconds]);

  // 统一走 utils/format 的 formatMmss —— 这里以前自己抄了一份补零逻辑，
  // 与 warmup 页那份还不完全一致（补零规则差异）。
  const mmss = useMemo(() => formatMmss(timer.remainingSeconds), [timer.remainingSeconds]);

  const start = useCallback(
    (sec: number, ctx?: RestTimerRuntime['nextContext']) => {
      finishedRef.current = false;
      tickCounterRef.current = 0;
      startRestTimer(Math.max(1, Math.floor(sec || 0)), ctx);
    },
    [startRestTimer]
  );

  const plus10 = useCallback(() => {
    safeHaptic('selection');
    adjustRestTimer(10);
  }, [adjustRestTimer]);

  const minus10 = useCallback(() => {
    safeHaptic('selection');
    adjustRestTimer(-10);
  }, [adjustRestTimer]);

  const skip = useCallback(() => {
    safeHaptic('light');
    finishedRef.current = true;
    stopRestTimer();
  }, [stopRestTimer]);

  return { timer, progress, mmss, start, plus10, minus10, skip };
}

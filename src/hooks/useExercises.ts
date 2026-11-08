import { useMemo } from 'react';
import type { Exercise, ExerciseFilters } from '@/types';
import {
  countByBodyPart,
  countByEquipment,
  filterExercises,
} from '@/data/queries';
import { useExercisesStore } from '@/data/exercises-store';

// ============================================================================
// useExercises.ts —— 数据集的 React 读接口（薄适配层）
//
// 为什么改成委托给 @/data/exercises-store：
//   原来的实现每个 hook 实例都 `useState<Exercise[]>` 自己持有一份 1300+ 条的
//   数据集副本，Library 和 Home 同时挂载时内存里就有两份全量数据；更糟的是
//   `useFilteredExercises(filters)` 把 filters 整个对象放进 useMemo 依赖，
//   调用方几乎一定是写字面量对象 → 每次渲染都是新引用 → 每次渲染都重跑一遍
//   O(n) 的全表扫描。现在统一从单一数据源（zustand store，内含预建的 searchIndex）
//   读取，并按 filters 的**标量字段**建依赖。
// ============================================================================

/**
 * 订阅数据集并保证其就绪。
 *
 * `ensureReady()` 内部自带 ready 幂等守卫，重复调用等价于 no-op，
 * 因此可以安全地在渲染期间触发（这与 Home / Library 现有的调用方式一致）。
 */
function useReadyExercises(): { exercises: Exercise[]; loading: boolean } {
  const ready = useExercisesStore((s) => s.ready);
  if (!ready) {
    // 渲染期间同步补齐数据集：这样首次渲染就已经有数据，不会闪一帧空列表。
    useExercisesStore.getState().ensureReady();
  }
  const exercises = useExercisesStore((s) => s.exercises);
  return { exercises, loading: !ready };
}

export function useExercises() {
  const { exercises, loading } = useReadyExercises();
  return { exercises, loading };
}

export function useBodyPartCounts() {
  const { exercises } = useReadyExercises();
  return useMemo(() => countByBodyPart(exercises), [exercises]);
}

export function useEquipmentCounts() {
  const { exercises } = useReadyExercises();
  return useMemo(() => countByEquipment(exercises), [exercises]);
}

/**
 * 按条件过滤。
 *
 * 依赖表刻意用 filters 的标量字段而非 filters 对象本身 —— 调用方传字面量
 * 对象时对象引用每次都变，用对象做依赖会让 memo 形同虚设。
 */
export function useFilteredExercises(filters: ExerciseFilters) {
  const { exercises, loading } = useReadyExercises();
  const bodyPart = filters?.bodyPart ?? null;
  const equipment = filters?.equipment ?? null;
  const muscleGroup = filters?.muscleGroup ?? null;
  const target = filters?.target ?? null;
  const searchQuery = filters?.searchQuery ?? null;

  const filtered = useMemo(
    () =>
      filterExercises(exercises, {
        bodyPart,
        equipment,
        muscleGroup,
        target,
        searchQuery,
      }),
    [exercises, bodyPart, equipment, muscleGroup, target, searchQuery]
  );

  return { filtered, loading, total: exercises.length };
}

export function useExerciseById(id: string | undefined) {
  const { loading } = useReadyExercises();
  // 走 store 预建的 byId Map（O(1)），而不是对 1300 条做线性 find。
  const exercise = useExercisesStore((s) => (id ? s.byId.get(String(id)) : undefined));
  return { exercise, loading };
}

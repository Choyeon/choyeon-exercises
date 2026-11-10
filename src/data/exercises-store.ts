import { create } from 'zustand';
import type { Exercise } from '@/types';
import {
  countByBodyPart,
  countByEquipment,
  findExerciseById,
  getAllExercisesSync,
} from './queries';
import type { ExerciseFilters } from '@/types';

interface ExercisesState {
  exercises: Exercise[];
  byId: Map<string, Exercise>;
  searchIndex: string[]; // parallel with exercises, pre-computed haystack
  ready: boolean;
  ensureReady: () => void;
  filter: (filters: ExerciseFilters) => Exercise[];
  countByBodyPart: () => ReturnType<typeof countByBodyPart>;
  countByEquipment: () => ReturnType<typeof countByEquipment>;
  findById: (id: string) => Exercise | undefined;
  total: () => number;
}

function buildHaystack(e: Exercise): string {
  const instrZh = Array.isArray(e.instruction_steps?.zh)
    ? e.instruction_steps.zh.join(' \n ')
    : Array.isArray(e.instructions?.zh)
      ? e.instructions.zh.join(' \n ')
      : typeof e.instructions?.zh === 'string'
        ? e.instructions.zh
        : '';
  const instrEn = Array.isArray(e.instruction_steps?.en)
    ? e.instruction_steps.en.join(' \n ')
    : Array.isArray(e.instructions?.en)
      ? e.instructions.en.join(' \n ')
      : typeof e.instructions?.en === 'string'
        ? e.instructions.en
        : '';
  const secondary = (e.secondary_muscles || []).join(' ');
  return (
    `${e.name} ${e.name_zh ?? ''} ${e.target ?? ''} ${e.muscle_group ?? ''} ${secondary} ${e.equipment ?? ''} ${e.category ?? ''} ${e.body_part ?? ''}\n${instrZh}\n${instrEn}`.toLowerCase()
  );
}

export const useExercisesStore = create<ExercisesState>((set, get) => ({
  exercises: [],
  byId: new Map<string, Exercise>(),
  searchIndex: [],
  ready: false,
  ensureReady: () => {
    if (get().ready) return;
    const exercises = getAllExercisesSync();
    const byId = new Map<string, Exercise>();
    const searchIndex: string[] = new Array<string>(exercises.length);
    for (let i = 0; i < exercises.length; i++) {
      const e = exercises[i];
      byId.set(e.id, e);
      searchIndex[i] = buildHaystack(e);
    }
    set({ exercises, byId, searchIndex, ready: true });
  },
  filter: (filters) => {
    get().ensureReady();
    const { exercises, searchIndex } = get();
    const { bodyPart, equipment, muscleGroup, target, searchQuery } = filters;

    // Fast path: no filter → avoid O(n) closures.
    if (!bodyPart && !equipment && !muscleGroup && !target && !searchQuery) {
      return exercises;
    }

    const needTextSearch = !!searchQuery && searchQuery.trim().length > 0;
    const qZh = searchQuery?.trim() ?? '';
    const qLow = qZh.toLowerCase();

    const result: Exercise[] = [];
    for (let i = 0; i < exercises.length; i++) {
      const e = exercises[i];
      if (bodyPart && e.body_part !== bodyPart) continue;
      if (equipment && e.equipment !== equipment) continue;
      if (muscleGroup) {
        if (
          e.muscle_group !== muscleGroup &&
          !e.secondary_muscles.includes(muscleGroup)
        )
          continue;
      }
      if (target && e.target !== target) continue;
      if (needTextSearch) {
        const hay = searchIndex[i];
        // Only substring search — avoids per-row allocation of regex/split.
        if (!hay.includes(qLow) && !hay.includes(qZh)) continue;
      }
      result.push(e);
    }
    return result;
  },
  countByBodyPart: () => {
    get().ensureReady();
    return countByBodyPart(get().exercises);
  },
  countByEquipment: () => {
    get().ensureReady();
    return countByEquipment(get().exercises);
  },
  findById: (id: string) => {
    get().ensureReady();
    return findExerciseById(get().exercises, id) ?? get().byId.get(id);
  },
  total: () => {
    get().ensureReady();
    return get().exercises.length;
  } }));

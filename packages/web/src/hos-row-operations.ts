import { requiredPriorDutyDayCount } from './hos-requirements.js';
import type {
  CycleRecap,
  DailyDutyTotal,
  DriverHosInputs,
  SleeperPeriod,
  TripSetupState,
} from './model.js';

function withHos(state: TripSetupState, hos: DriverHosInputs): TripSetupState {
  return { ...state, hos, dirty: true };
}

function removeAt<T>(items: readonly T[], index: number): readonly T[] {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return items;
  return items.filter((_item, itemIndex): boolean => itemIndex !== index);
}

function updateAt<T>(items: readonly T[], index: number, value: T): readonly T[] {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return items;
  return items.map((item, itemIndex): T => (itemIndex === index ? value : item));
}

export function addPriorDutyTotal(state: TripSetupState): TripSetupState {
  const maximum = requiredPriorDutyDayCount(state.hos.cycleType);
  if (maximum === 0 || state.hos.priorDutyTotals.length >= maximum) return state;
  return withHos(state, {
    ...state.hos,
    priorDutyTotals: [...state.hos.priorDutyTotals, { date: '', onDutyMinutes: 0 }],
  });
}

export function updatePriorDutyTotal(
  state: TripSetupState,
  index: number,
  patch: Partial<DailyDutyTotal>,
): TripSetupState {
  const current = state.hos.priorDutyTotals[index];
  if (current === undefined) return state;
  return withHos(state, {
    ...state.hos,
    priorDutyTotals: updateAt(state.hos.priorDutyTotals, index, { ...current, ...patch }),
  });
}

export function removePriorDutyTotal(state: TripSetupState, index: number): TripSetupState {
  const priorDutyTotals = removeAt(state.hos.priorDutyTotals, index);
  return priorDutyTotals === state.hos.priorDutyTotals
    ? state
    : withHos(state, { ...state.hos, priorDutyTotals });
}

export function addCycleRecap(state: TripSetupState): TripSetupState {
  return withHos(state, {
    ...state.hos,
    cycleRecaps: [...state.hos.cycleRecaps, { availableAt: '', minutesReturning: 0 }],
  });
}

export function updateCycleRecap(
  state: TripSetupState,
  index: number,
  patch: Partial<CycleRecap>,
): TripSetupState {
  const current = state.hos.cycleRecaps[index];
  if (current === undefined) return state;
  return withHos(state, {
    ...state.hos,
    cycleRecaps: updateAt(state.hos.cycleRecaps, index, { ...current, ...patch }),
  });
}

export function removeCycleRecap(state: TripSetupState, index: number): TripSetupState {
  const cycleRecaps = removeAt(state.hos.cycleRecaps, index);
  return cycleRecaps === state.hos.cycleRecaps
    ? state
    : withHos(state, { ...state.hos, cycleRecaps });
}

export function addSleeperPeriod(state: TripSetupState): TripSetupState {
  return withHos(state, {
    ...state.hos,
    existingSleeperPeriods: [
      ...state.hos.existingSleeperPeriods,
      { startAt: '', endAt: '' },
    ],
  });
}

export function updateSleeperPeriod(
  state: TripSetupState,
  index: number,
  patch: Partial<SleeperPeriod>,
): TripSetupState {
  const current = state.hos.existingSleeperPeriods[index];
  if (current === undefined) return state;
  return withHos(state, {
    ...state.hos,
    existingSleeperPeriods: updateAt(state.hos.existingSleeperPeriods, index, {
      ...current,
      ...patch,
    }),
  });
}

export function removeSleeperPeriod(state: TripSetupState, index: number): TripSetupState {
  const existingSleeperPeriods = removeAt(state.hos.existingSleeperPeriods, index);
  return existingSleeperPeriods === state.hos.existingSleeperPeriods
    ? state
    : withHos(state, { ...state.hos, existingSleeperPeriods });
}

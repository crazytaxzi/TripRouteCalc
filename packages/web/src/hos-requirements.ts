import type { CycleType } from './model.js';

export function requiredPriorDutyDayCount(cycleType: CycleType): 0 | 7 | 8 {
  if (cycleType === '60_in_7') return 7;
  if (cycleType === '70_in_8') return 8;
  return 0;
}

export function priorDutyCountMessage(
  cycleType: CycleType,
  actualCount: number,
): string | undefined {
  const required = requiredPriorDutyDayCount(cycleType);
  if (required === 0 || actualCount === required) return undefined;
  return `Enter ${String(required)} prior daily on-duty totals for the selected cycle.`;
}

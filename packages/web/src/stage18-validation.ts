import { validateStage18CompleteFacts } from './stage18-details.js';
import type { TripSetupState, ValidationIssue } from './model.js';
import { validateTripSetup as validateLegacyTripSetup } from './model.js';
import {
  priorDutyCountMessage,
  requiredPriorDutyDayCount,
} from './hos-requirements.js';

function issue(path: string, message: string): ValidationIssue {
  return { path, message, severity: 'error' };
}

function addDays(date: string, days: number): string | undefined {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function priorDutyIssues(state: TripSetupState): readonly ValidationIssue[] {
  const required = requiredPriorDutyDayCount(state.hos.cycleType);
  if (required === 0) return [];
  const issues: ValidationIssue[] = [];
  const countMessage = priorDutyCountMessage(
    state.hos.cycleType,
    state.hos.priorDutyTotals.length,
  );
  if (countMessage !== undefined) {
    issues.push(issue('hos.priorDutyTotals', countMessage));
  }

  const departureDate = state.departureAt.slice(0, 10);
  if (departureDate.length !== 10) return issues;
  state.hos.priorDutyTotals.forEach((day, index): void => {
    const expectedDate = addDays(departureDate, index - required);
    if (expectedDate !== undefined && day.date !== expectedDate) {
      issues.push(
        issue(
          `hos.priorDutyTotals.${String(index)}.date`,
          `Enter ${expectedDate} to keep prior-duty history consecutive through the day before departure.`,
        ),
      );
    }
    if (day.onDutyMinutes > 1_440) {
      issues.push(
        issue(
          `hos.priorDutyTotals.${String(index)}.onDutyMinutes`,
          'A prior daily on-duty total cannot exceed 1,440 minutes.',
        ),
      );
    }
  });
  return issues;
}

export function validateStage18TripSetup(
  state: TripSetupState,
): readonly ValidationIssue[] {
  const legacyIssues = validateLegacyTripSetup(state).filter(
    (candidate): boolean =>
      candidate.path !== 'hos.priorDutyTotals' &&
      candidate.path !== 'driver' &&
      candidate.path !== 'tractor' &&
      candidate.path !== 'trailer' &&
      candidate.path !== 'load',
  );
  return [
    ...legacyIssues,
    ...priorDutyIssues(state),
    ...validateStage18CompleteFacts(state),
  ];
}

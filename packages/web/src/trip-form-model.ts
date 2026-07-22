import {
  loadDetailedDraft,
  saveDetailedDraft,
  validateDetailedEquipment,
} from './equipment-detail-model.js';
import { validateDraft as validateCoreDraft } from './model.js';
import type { TripDraft, ValidationIssue } from './types.js';

export const loadDraft = loadDetailedDraft;
export const saveDraft = saveDetailedDraft;

export function validateDraft(
  draft: TripDraft,
): readonly ValidationIssue[] {
  const combined = [
    ...validateCoreDraft(draft),
    ...validateDetailedEquipment(draft),
  ];
  const seen = new Set<string>();
  return combined.filter((issue) => {
    const key = `${issue.severity}:${issue.path}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

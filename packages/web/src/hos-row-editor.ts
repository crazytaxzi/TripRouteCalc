import type { DriverHosInputs } from './model.js';

export type HosRepeatingRows = Pick<
  DriverHosInputs,
  'cycleType' | 'priorDutyTotals' | 'cycleRecaps' | 'existingSleeperPeriods'
>;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character): string =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

function removeButton(kind: string, index: number, label: string): string {
  return `<button type="button" data-hos-row-action="remove" data-hos-row-kind="${kind}" data-hos-row-index="${String(index)}" aria-label="${escapeHtml(label)}">Remove</button>`;
}

export function renderPriorDutyRows(hos: HosRepeatingRows): string {
  const maximum = hos.cycleType === '60_in_7' ? 6 : 7;
  const rows = hos.priorDutyTotals
    .map(
      (entry, index): string => `<div class="grid three hos-row" data-hos-row-kind="prior-duty" data-hos-row-index="${String(index)}">
        <label class="field"><span>Date</span><input type="date" data-hos-row-field="date" value="${escapeHtml(entry.date)}"></label>
        <label class="field"><span>On-duty minutes</span><input type="number" min="0" step="1" inputmode="numeric" data-hos-row-field="onDutyMinutes" value="${String(entry.onDutyMinutes)}"></label>
        <div class="field row-action">${removeButton('prior-duty', index, `Remove prior-duty row ${String(index + 1)}`)}</div>
      </div>`,
    )
    .join('');
  const disabled = hos.priorDutyTotals.length >= maximum ? ' disabled' : '';
  return `<section class="repeatable-group" aria-labelledby="prior-duty-heading">
    <div class="section-heading"><h3 id="prior-duty-heading">Prior daily duty totals</h3><button type="button" data-hos-row-action="add" data-hos-row-kind="prior-duty"${disabled}>Add day</button></div>
    <p class="hint">Enter ${String(maximum)} prior days for the selected cycle.</p>
    ${rows === '' ? '<p class="empty-state">No prior-duty rows entered.</p>' : rows}
  </section>`;
}

export function renderCycleRecapRows(hos: HosRepeatingRows): string {
  const rows = hos.cycleRecaps
    .map(
      (entry, index): string => `<div class="grid three hos-row" data-hos-row-kind="cycle-recap" data-hos-row-index="${String(index)}">
        <label class="field"><span>Available at</span><input type="datetime-local" data-hos-row-field="availableAt" value="${escapeHtml(entry.availableAt)}"></label>
        <label class="field"><span>Minutes returning</span><input type="number" min="0" step="1" inputmode="numeric" data-hos-row-field="minutesReturning" value="${String(entry.minutesReturning)}"></label>
        <div class="field row-action">${removeButton('cycle-recap', index, `Remove recap row ${String(index + 1)}`)}</div>
      </div>`,
    )
    .join('');
  return `<section class="repeatable-group" aria-labelledby="cycle-recap-heading">
    <div class="section-heading"><h3 id="cycle-recap-heading">Cycle recaps</h3><button type="button" data-hos-row-action="add" data-hos-row-kind="cycle-recap">Add recap</button></div>
    ${rows === '' ? '<p class="empty-state">No cycle recaps entered.</p>' : rows}
  </section>`;
}

export function renderSleeperPeriodRows(hos: HosRepeatingRows): string {
  const rows = hos.existingSleeperPeriods
    .map(
      (entry, index): string => `<div class="grid three hos-row" data-hos-row-kind="sleeper-period" data-hos-row-index="${String(index)}">
        <label class="field"><span>Start</span><input type="datetime-local" data-hos-row-field="startAt" value="${escapeHtml(entry.startAt)}"></label>
        <label class="field"><span>End</span><input type="datetime-local" data-hos-row-field="endAt" value="${escapeHtml(entry.endAt)}"></label>
        <div class="field row-action">${removeButton('sleeper-period', index, `Remove sleeper period ${String(index + 1)}`)}</div>
      </div>`,
    )
    .join('');
  return `<section class="repeatable-group" aria-labelledby="sleeper-period-heading">
    <div class="section-heading"><h3 id="sleeper-period-heading">Existing sleeper periods</h3><button type="button" data-hos-row-action="add" data-hos-row-kind="sleeper-period">Add period</button></div>
    ${rows === '' ? '<p class="empty-state">No sleeper periods entered.</p>' : rows}
  </section>`;
}

export function renderHosRepeatingRows(hos: HosRepeatingRows): string {
  return `<div class="hos-repeatable-rows">${renderPriorDutyRows(hos)}${renderCycleRecapRows(hos)}${renderSleeperPeriodRows(hos)}</div>`;
}

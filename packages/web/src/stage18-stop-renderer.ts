import type { DutyStatus } from './model.js';
import type { StopPlanningFacts } from './stage18-details.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/gu, (character): string => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}
function selected(value: string, expected: string): string { return value === expected ? ' selected' : ''; }
function checked(value: boolean): string { return value ? ' checked' : ''; }
function numeric(value: number | null): string { return value === null || !Number.isFinite(value) ? '' : String(value); }

function stopField(
  localId: string,
  name: keyof StopPlanningFacts,
  label: string,
  value: string,
  type = 'text',
): string {
  return `<label class="field"><span>${label}</span><input data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="${String(name)}" type="${type}" value="${escapeHtml(value)}"></label>`;
}

function stopNumber(
  localId: string,
  name: keyof StopPlanningFacts,
  label: string,
  value: number | null,
): string {
  return `<label class="field"><span>${label}</span><input data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="${String(name)}" type="number" step="any" inputmode="decimal" value="${numeric(value)}"></label>`;
}

function dutyOptions(value: DutyStatus): string {
  return `<option value="off_duty"${selected(value, 'off_duty')}>Off duty</option><option value="sleeper_berth"${selected(value, 'sleeper_berth')}>Sleeper berth</option><option value="driving"${selected(value, 'driving')}>Driving</option><option value="on_duty_not_driving"${selected(value, 'on_duty_not_driving')}>On duty, not driving</option>`;
}

export function renderStopFacts(localId: string, facts: StopPlanningFacts): string {
  return `<div data-stage18-stop-enhanced><details open><summary>Resolved location evidence</summary><div class="grid three">${stopNumber(localId, 'latitude', 'Latitude', facts.latitude)}${stopNumber(localId, 'longitude', 'Longitude', facts.longitude)}<label class="field"><span>Resolution status</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="resolutionStatus"><option value="">Choose evidence</option><option value="user-confirmed"${selected(facts.resolutionStatus, 'user-confirmed')}>User confirmed</option><option value="resolved"${selected(facts.resolutionStatus, 'resolved')}>Provider resolved</option></select></label>${stopField(localId, 'sourceName', 'Evidence source', facts.sourceName)}${stopField(localId, 'providerReference', 'Provider reference', facts.providerReference)}<label class="field"><span>Time zone</span><input data-stage18-stop-time-zone="${escapeHtml(localId)}" value=""></label></div></details>
  <details><summary>Complete appointment and facility facts</summary><div class="grid three"><label class="field"><span>Appointment mode</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="appointmentMode"><option value="none"${selected(facts.appointmentMode, 'none')}>None</option><option value="earliest"${selected(facts.appointmentMode, 'earliest')}>Earliest</option><option value="latest"${selected(facts.appointmentMode, 'latest')}>Latest</option><option value="fixed"${selected(facts.appointmentMode, 'fixed')}>Fixed</option><option value="window"${selected(facts.appointmentMode, 'window')}>Window</option><option value="open-window"${selected(facts.appointmentMode, 'open-window')}>Open window</option></select></label>${stopField(localId, 'appointmentAt', 'Single appointment time', facts.appointmentAt, 'datetime-local')}${stopField(localId, 'appointmentStartAt', 'Window start', facts.appointmentStartAt, 'datetime-local')}${stopField(localId, 'appointmentEndAt', 'Window end', facts.appointmentEndAt, 'datetime-local')}${stopNumber(localId, 'lateToleranceMinutes', 'Late tolerance, min', facts.lateToleranceMinutes)}${stopNumber(localId, 'checkInMinutes', 'Check-in duration, min', facts.checkInMinutes)}</div><label class="field"><span>Facility hours</span><textarea data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="facilityHoursText" rows="3">${escapeHtml(facts.facilityHoursText)}</textarea><small>One line: local opening date-time|local closing date-time.</small></label><div class="grid two"><label class="check"><input data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="earlyParkingAllowed" type="checkbox"${checked(facts.earlyParkingAllowed)}> Early parking allowed</label><label class="check"><input data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="overnightParkingAllowed" type="checkbox"${checked(facts.overnightParkingAllowed)}> Overnight parking allowed</label></div></details>
  <details><summary>Waiting, check-in, and service</summary><div class="grid three"><label class="field"><span>Waiting duty status</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="waitingDutyStatus">${dutyOptions(facts.waitingDutyStatus)}</select></label><label class="field"><span>Check-in duty status</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="checkInDutyStatus">${dutyOptions(facts.checkInDutyStatus)}</select></label><label class="field"><span>Service duty status</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="serviceDutyStatus">${dutyOptions(facts.serviceDutyStatus)}</select></label><label class="field"><span>Service duration mode</span><select data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="serviceMode"><option value="exact"${selected(facts.serviceMode, 'exact')}>Exact</option><option value="expected"${selected(facts.serviceMode, 'expected')}>Expected</option><option value="range"${selected(facts.serviceMode, 'range')}>Range</option><option value="historical-average"${selected(facts.serviceMode, 'historical-average')}>Historical average</option></select></label>${stopNumber(localId, 'serviceMinutes', 'Exact/expected/historical minutes', facts.serviceMinutes)}${stopNumber(localId, 'serviceMinimumMinutes', 'Minimum minutes', facts.serviceMinimumMinutes)}${stopNumber(localId, 'serviceExpectedMinutes', 'Expected range minutes', facts.serviceExpectedMinutes)}${stopNumber(localId, 'serviceMaximumMinutes', 'Maximum minutes', facts.serviceMaximumMinutes)}${stopField(localId, 'historicalSourceName', 'Historical source', facts.historicalSourceName)}${stopNumber(localId, 'historicalSampleSize', 'Historical sample size', facts.historicalSampleSize)}</div></details>
  <label class="field"><span>Separate instructions</span><textarea data-stage18-stop-id="${escapeHtml(localId)}" data-stage18-stop-field="instructions" rows="3">${escapeHtml(facts.instructions)}</textarea></label></div>`;
}

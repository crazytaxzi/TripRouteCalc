import {
  STOP_TYPES,
  createInitialTripSetupState,
  duplicateStop,
  insertStop,
  moveStop,
  removeStop,
  restoreDraft,
  serializeDraft,
  updateStop,
  validateTripSetup,
  type TripSetupState,
} from './model.js';
import { RecalculationController, TripSetupApiClient, TripSetupValidationError } from './api-client.js';

const STORAGE_KEY = 'trip-route-calc-stage18-draft-v1';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character): string => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function inputNumber(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function minutesInput(name: string, label: string, value: number): string {
  return `<label class="field"><span>${label}</span><input name="${name}" type="number" min="0" step="1" inputmode="numeric" value="${String(value)}"></label>`;
}

function profileField(name: string, label: string, value: string, hint: string): string {
  return `<label class="field"><span>${label}</span><input name="${name}" autocomplete="off" value="${escapeHtml(value)}" placeholder="${hint}"></label>`;
}

function renderStop(stop: TripSetupState['stops'][number], count: number): string {
  const sequence = String(stop.sequence + 1);
  const types = STOP_TYPES.map((type): string => `<option value="${type}"${type === stop.type ? ' selected' : ''}>${type.replaceAll('_', ' ')}</option>`).join('');
  return `<article class="stop-card" data-stop-id="${stop.localId}" draggable="${stop.lockedPosition ? 'false' : 'true'}" aria-label="Stop ${sequence} of ${String(count)}">
    <header><div><strong>Stop ${sequence}</strong><span class="badge">${stop.required ? 'Required' : 'Optional'}</span>${stop.lockedPosition ? '<span class="badge">Position locked</span>' : ''}</div>
      <div class="button-row"><button type="button" data-action="move-up">Up</button><button type="button" data-action="move-down">Down</button><button type="button" data-action="duplicate">Duplicate</button><button type="button" data-action="insert-after">Insert</button><button type="button" data-action="remove"${stop.lockedPosition ? ' disabled' : ''}>Remove</button></div></header>
    <div class="grid two"><label class="field"><span>Stop type</span><select data-field="type">${types}</select></label><label class="field"><span>Label</span><input data-field="label" value="${escapeHtml(stop.label)}"></label></div>
    <label class="field"><span>Location or address</span><input data-field="address" value="${escapeHtml(stop.address)}" autocomplete="street-address"></label>
    <div class="grid two"><label class="check"><input data-field="required" type="checkbox"${stop.required ? ' checked' : ''}> Required stop</label><label class="check"><input data-field="lockedPosition" type="checkbox"${stop.lockedPosition ? ' checked' : ''}> Lock position</label></div>
    <details><summary>Appointment</summary><div class="grid two"><label class="field"><span>Appointment type</span><select data-field="appointment.mode"><option value="none"${stop.appointment.mode === 'none' ? ' selected' : ''}>None</option><option value="fixed"${stop.appointment.mode === 'fixed' ? ' selected' : ''}>Fixed</option><option value="window"${stop.appointment.mode === 'window' ? ' selected' : ''}>Window</option></select></label><label class="field"><span>Time zone</span><input data-field="appointment.timeZone" value="${escapeHtml(stop.appointment.timeZone)}"></label><label class="field"><span>Fixed time</span><input data-field="appointment.fixedAt" type="datetime-local" value="${escapeHtml(stop.appointment.fixedAt ?? '')}"></label><label class="field"><span>Earliest</span><input data-field="appointment.earliestAt" type="datetime-local" value="${escapeHtml(stop.appointment.earliestAt ?? '')}"></label><label class="field"><span>Latest</span><input data-field="appointment.latestAt" type="datetime-local" value="${escapeHtml(stop.appointment.latestAt ?? '')}"></label><label class="field"><span>Late tolerance minutes</span><input data-field="appointment.lateToleranceMinutes" type="number" min="0" value="${String(stop.appointment.lateToleranceMinutes)}"></label></div></details>
    <details><summary>Service</summary><div class="grid two"><label class="field"><span>Duration mode</span><select data-field="service.mode"><option value="exact"${stop.service.mode === 'exact' ? ' selected' : ''}>Exact</option><option value="expected"${stop.service.mode === 'expected' ? ' selected' : ''}>Expected</option><option value="range"${stop.service.mode === 'range' ? ' selected' : ''}>Range</option></select></label><label class="field"><span>Duty status during service</span><select data-field="service.dutyStatus"><option value="on_duty_not_driving"${stop.service.dutyStatus === 'on_duty_not_driving' ? ' selected' : ''}>On duty, not driving</option><option value="off_duty"${stop.service.dutyStatus === 'off_duty' ? ' selected' : ''}>Off duty</option><option value="sleeper_berth"${stop.service.dutyStatus === 'sleeper_berth' ? ' selected' : ''}>Sleeper berth</option><option value="driving"${stop.service.dutyStatus === 'driving' ? ' selected' : ''}>Driving</option></select></label><label class="field"><span>Exact minutes</span><input data-field="service.exactMinutes" type="number" min="0" value="${inputNumber(stop.service.exactMinutes)}"></label><label class="field"><span>Expected minutes</span><input data-field="service.expectedMinutes" type="number" min="0" value="${inputNumber(stop.service.expectedMinutes)}"></label><label class="field"><span>Minimum minutes</span><input data-field="service.minimumMinutes" type="number" min="0" value="${inputNumber(stop.service.minimumMinutes)}"></label><label class="field"><span>Maximum minutes</span><input data-field="service.maximumMinutes" type="number" min="0" value="${inputNumber(stop.service.maximumMinutes)}"></label></div></details>
    <label class="field"><span>Notes and instructions</span><textarea data-field="notes">${escapeHtml(stop.notes)}</textarea></label>
  </article>`;
}

export class TripSetupApp {
  readonly #root: HTMLElement;
  readonly #api: TripSetupApiClient;
  readonly #recalculate: RecalculationController;
  #state: TripSetupState;
  #draggedStopId: string | undefined;

  public constructor(root: HTMLElement) {
    this.#root = root;
    this.#state = restoreDraft(localStorage.getItem(STORAGE_KEY) ?? '') ?? createInitialTripSetupState();
    this.#api = new TripSetupApiClient(root.dataset.apiBaseUrl ?? '/api', (): string => sessionStorage.getItem('trip-route-calc-token') ?? '');
    this.#recalculate = new RecalculationController(async (): Promise<void> => { await this.#calculate(); });
    this.#render();
  }

  #setState(state: TripSetupState, focusSelector?: string): void {
    this.#state = state;
    localStorage.setItem(STORAGE_KEY, serializeDraft(state));
    this.#render();
    if (focusSelector !== undefined) this.#root.querySelector<HTMLElement>(focusSelector)?.focus();
    if (state.autoRecalculate && state.dirty) this.#recalculate.request();
  }

  #render(): void {
    const issues = validateTripSetup(this.#state);
    const status = this.#state.calculationPending ? 'Saving and calculating...' : this.#state.lastError ?? (this.#state.tripId === undefined ? 'Draft saved on this device' : `Server trip saved at revision ${String(this.#state.revisionNumber)}`);
    this.#root.innerHTML = `<main class="shell"><header class="page-header"><div><p class="eyebrow">TripRouteCalc</p><h1>Trip setup</h1><p>Enter the facts. The server remains the legal authority.</p></div><div class="status" role="status" aria-live="polite">${escapeHtml(status)}</div></header>
      ${issues.length > 0 ? `<section class="issues" aria-labelledby="issues-heading"><h2 id="issues-heading">Before calculation</h2><ul>${issues.map((issue): string => `<li><strong>${issue.severity === 'error' ? 'Required' : 'Check'}:</strong> ${escapeHtml(issue.message)}</li>`).join('')}</ul></section>` : ''}
      <form novalidate><section class="panel"><h2>1. Driver and departure</h2><div class="grid two">${profileField('driver', 'Driver name', this.#state.driver.displayName, 'Create or enter driver') }<label class="field"><span>Departure date and time</span><input name="departureAt" type="datetime-local" value="${escapeHtml(this.#state.departureAt)}"></label><label class="field"><span>Departure time zone</span><input name="departureTimeZone" value="${escapeHtml(this.#state.departureTimeZone)}"></label><label class="field"><span>Current duty status</span><select name="currentDutyStatus"><option value="">Choose status</option><option value="off_duty"${this.#state.currentDutyStatus === 'off_duty' ? ' selected' : ''}>Off duty</option><option value="sleeper_berth"${this.#state.currentDutyStatus === 'sleeper_berth' ? ' selected' : ''}>Sleeper berth</option><option value="driving"${this.#state.currentDutyStatus === 'driving' ? ' selected' : ''}>Driving</option><option value="on_duty_not_driving"${this.#state.currentDutyStatus === 'on_duty_not_driving' ? ' selected' : ''}>On duty, not driving</option></select></label><label class="field"><span>Status began at</span><input name="currentDutyStatusBeganAt" type="datetime-local" value="${escapeHtml(this.#state.currentDutyStatusBeganAt)}"></label></div><div class="clock-grid">${minutesInput('driveMinutesRemaining', 'Drive remaining (minutes)', this.#state.clocks.driveMinutesRemaining)}${minutesInput('shiftMinutesRemaining', 'Shift remaining (minutes)', this.#state.clocks.shiftMinutesRemaining)}${minutesInput('cycleMinutesRemaining', 'Cycle remaining (minutes)', this.#state.clocks.cycleMinutesRemaining)}</div></section>
      <section class="panel"><h2>2. Equipment and load</h2><div class="grid three">${profileField('tractor', 'Tractor public ID', this.#state.tractor.displayName, 'Existing tractor ID')}${profileField('trailer', 'Trailer public ID', this.#state.trailer.displayName, 'Existing trailer ID')}${profileField('load', 'Load public ID', this.#state.load.displayName, 'Existing load ID')}</div><p class="hint">Stage 17 exposes profile creation but not profile listing. Existing opaque IDs are accepted here; missing legal-critical data remains blocking.</p></section>
      <section class="panel"><div class="section-heading"><div><h2>3. Stops</h2><p>Appointments and service are separate for every stop.</p></div><button type="button" data-global-action="add-stop">Add stop</button></div><div class="stop-list">${this.#state.stops.map((stop): string => renderStop(stop, this.#state.stops.length)).join('')}</div></section>
      <section class="action-bar"><label class="check"><input name="autoRecalculate" type="checkbox"${this.#state.autoRecalculate ? ' checked' : ''}> Recalculate after settled changes</label><button type="button" data-global-action="save">Save trip</button><button type="button" data-global-action="calculate" class="primary">Save and calculate</button></section></form></main>`;
    this.#bind();
  }

  #bind(): void {
    const form = this.#root.querySelector('form');
    form?.addEventListener('input', (event): void => { this.#handleFormInput(event); });
    form?.addEventListener('change', (event): void => { this.#handleFormInput(event); });
    this.#root.querySelector('[data-global-action="add-stop"]')?.addEventListener('click', (): void => { this.#setState(insertStop(this.#state, this.#state.stops.length - 1)); });
    this.#root.querySelector('[data-global-action="save"]')?.addEventListener('click', (): void => { void this.#save(); });
    this.#root.querySelector('[data-global-action="calculate"]')?.addEventListener('click', (): void => { void this.#calculate(); });
    this.#root.querySelectorAll<HTMLElement>('.stop-card').forEach((card): void => {
      const localId = card.dataset.stopId;
      if (localId === undefined) return;
      card.querySelector('[data-action="move-up"]')?.addEventListener('click', (): void => { this.#setState(moveStop(this.#state, localId, -1)); });
      card.querySelector('[data-action="move-down"]')?.addEventListener('click', (): void => { this.#setState(moveStop(this.#state, localId, 1)); });
      card.querySelector('[data-action="duplicate"]')?.addEventListener('click', (): void => { this.#setState(duplicateStop(this.#state, localId)); });
      card.querySelector('[data-action="insert-after"]')?.addEventListener('click', (): void => { this.#setState(insertStop(this.#state, stopIndex(card) + 1)); });
      card.querySelector('[data-action="remove"]')?.addEventListener('click', (): void => { this.#setState(removeStop(this.#state, localId)); });
      card.addEventListener('dragstart', (): void => { this.#draggedStopId = localId; });
      card.addEventListener('dragover', (event): void => { event.preventDefault(); });
      card.addEventListener('drop', (event): void => { event.preventDefault(); this.#dropStop(localId); });
    });
  }

  #dropStop(targetId: string): void {
    const dragged = this.#draggedStopId;
    this.#draggedStopId = undefined;
    if (dragged === undefined || dragged === targetId) return;
    const targetIndex = this.#state.stops.findIndex((stop): boolean => stop.localId === targetId);
    let next = this.#state;
    const direction: -1 | 1 = next.stops.findIndex((stop): boolean => stop.localId === dragged) < targetIndex ? 1 : -1;
    while (next.stops.findIndex((stop): boolean => stop.localId === dragged) !== targetIndex) {
      const moved = moveStop(next, dragged, direction);
      if (moved === next) break;
      next = moved;
    }
    this.#setState(next);
  }

  #handleFormInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    const card = target.closest<HTMLElement>('.stop-card');
    if (card !== null) {
      const localId = card.dataset.stopId;
      const field = target.dataset.field;
      if (localId !== undefined && field !== undefined) this.#updateStopField(localId, field, target);
      return;
    }
    const name = target.name;
    if (name === 'autoRecalculate' && target instanceof HTMLInputElement) this.#setState({ ...this.#state, autoRecalculate: target.checked });
    else if (name === 'departureAt' || name === 'departureTimeZone' || name === 'currentDutyStatusBeganAt') this.#setState({ ...this.#state, [name]: target.value, dirty: true });
    else if (name === 'currentDutyStatus') this.#setState({ ...this.#state, currentDutyStatus: target.value as TripSetupState['currentDutyStatus'], dirty: true });
    else if (name === 'driver') this.#setState({ ...this.#state, driver: { selectedId: '', displayName: target.value }, dirty: true });
    else if (name === 'tractor' || name === 'trailer' || name === 'load') this.#setState({ ...this.#state, [name]: { selectedId: target.value.trim(), displayName: target.value }, dirty: true });
    else if (name in this.#state.clocks) this.#setState({ ...this.#state, clocks: { ...this.#state.clocks, [name]: Number(target.value) }, dirty: true });
  }

  #updateStopField(localId: string, field: string, target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    const stop = this.#state.stops.find((candidate): boolean => candidate.localId === localId);
    if (stop === undefined) return;
    if (field.startsWith('appointment.')) {
      const key = field.slice('appointment.'.length);
      const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : key === 'lateToleranceMinutes' ? Number(target.value) : target.value === '' ? undefined : target.value;
      this.#setState(updateStop(this.#state, localId, { appointment: { ...stop.appointment, [key]: value } }));
    } else if (field.startsWith('service.')) {
      const key = field.slice('service.'.length);
      const value = key.endsWith('Minutes') ? (target.value === '' ? undefined : Number(target.value)) : target.value;
      this.#setState(updateStop(this.#state, localId, { service: { ...stop.service, [key]: value } }));
    } else {
      const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
      this.#setState(updateStop(this.#state, localId, { [field]: value }));
    }
  }

  async #save(): Promise<void> {
    this.#setState({ ...this.#state, calculationPending: true, lastError: undefined });
    try {
      const saved = await this.#api.save(this.#state);
      this.#setState({ ...saved, calculationPending: false });
    } catch (error) {
      this.#setFailure(error);
    }
  }

  async #calculate(): Promise<void> {
    this.#setState({ ...this.#state, calculationPending: true, lastError: undefined });
    try {
      const saved = await this.#api.save(this.#state);
      await this.#api.calculate(saved);
      this.#setState({ ...saved, calculationPending: false, lastCalculationAt: new Date().toLocaleString(), lastError: undefined });
    } catch (error) {
      this.#setFailure(error);
    }
  }

  #setFailure(error: unknown): void {
    const message = error instanceof TripSetupValidationError ? error.issues.map((issue): string => issue.message).join(' ') : error instanceof Error ? error.message : 'The request failed. Your draft is preserved.';
    this.#setState({ ...this.#state, calculationPending: false, lastError: message });
  }
}

function stopIndex(card: HTMLElement): number {
  const value = card.getAttribute('aria-label')?.match(/Stop (\d+)/u)?.[1];
  return value === undefined ? 0 : Number(value) - 1;
}

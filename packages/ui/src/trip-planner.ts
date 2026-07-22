import {
  createInitialDraft,
  createStop,
  deserializeDraft,
  duplicateStop,
  moveStop,
  removeStop,
  serializeDraft,
  stopTypes,
  validateDraft,
  type TripSetupDraft,
  type TripStop,
} from "./model.js";

const draftKey = "trip-route-calc:trip-setup-draft:v1";

const escapeHtml = (value: string): string => value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
const selected = (value: string, expected: string): string => value === expected ? " selected" : "";
const checked = (value: boolean): string => value ? " checked" : "";
const numberValue = (value: number | null): string => value === null ? "" : String(value);

export class TripRoutePlannerElement extends HTMLElement {
  private draft: TripSetupDraft = createInitialDraft();
  private recalculateTimer: ReturnType<typeof setTimeout> | null = null;
  private draggedStopIndex: number | null = null;

  connectedCallback(): void {
    this.draft = deserializeDraft(globalThis.localStorage?.getItem(draftKey) ?? null) ?? createInitialDraft();
    this.render();
    this.addEventListener("input", this.handleInput);
    this.addEventListener("change", this.handleInput);
    this.addEventListener("click", this.handleClick);
    this.addEventListener("dragstart", this.handleDragStart);
    this.addEventListener("dragover", this.handleDragOver);
    this.addEventListener("drop", this.handleDrop);
  }

  disconnectedCallback(): void {
    this.removeEventListener("input", this.handleInput);
    this.removeEventListener("change", this.handleInput);
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("dragstart", this.handleDragStart);
    this.removeEventListener("dragover", this.handleDragOver);
    this.removeEventListener("drop", this.handleDrop);
    if (this.recalculateTimer) clearTimeout(this.recalculateTimer);
  }

  get value(): TripSetupDraft {
    return structuredClone(this.draft);
  }

  set value(value: TripSetupDraft) {
    this.draft = structuredClone(value);
    this.persistAndRender(false);
  }

  private handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    const path = target.dataset.path;
    if (!path) return;
    const value: string | number | boolean | null = target.type === "checkbox" && target instanceof HTMLInputElement
      ? target.checked
      : target.type === "number"
        ? target.value === "" ? null : Number(target.value)
        : target.value;
    this.setPath(path, value);
    this.persistAndRender(this.draft.immediateRecalculation);
  };

  private handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-action]") : null;
    if (!target) return;
    const index = Number(target.dataset.index);
    switch (target.dataset.action) {
      case "add-stop":
        this.draft.stops.push(createStop());
        break;
      case "insert-stop":
        this.draft.stops.splice(index + 1, 0, createStop());
        break;
      case "duplicate-stop": {
        const stop = this.draft.stops[index];
        if (stop) this.draft.stops.splice(index + 1, 0, duplicateStop(stop));
        break;
      }
      case "remove-stop":
        this.draft.stops = removeStop(this.draft.stops, index);
        break;
      case "move-up":
        this.draft.stops = moveStop(this.draft.stops, index, index - 1);
        break;
      case "move-down":
        this.draft.stops = moveStop(this.draft.stops, index, index + 1);
        break;
      case "calculate":
        this.requestCalculation("manual");
        return;
      case "clear-draft":
        this.draft = createInitialDraft();
        globalThis.localStorage?.removeItem(draftKey);
        this.render();
        this.dispatchEvent(new CustomEvent("trip-draft-cleared", { bubbles: true }));
        return;
      default:
        return;
    }
    this.persistAndRender(this.draft.immediateRecalculation);
  };

  private handleDragStart = (event: DragEvent): void => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-stop-index]") : null;
    if (!item) return;
    const index = Number(item.dataset.stopIndex);
    if (this.draft.stops[index]?.locked) {
      event.preventDefault();
      return;
    }
    this.draggedStopIndex = index;
    event.dataTransfer?.setData("text/plain", String(index));
  };

  private handleDragOver = (event: DragEvent): void => {
    if (event.target instanceof Element && event.target.closest("[data-stop-index]")) event.preventDefault();
  };

  private handleDrop = (event: DragEvent): void => {
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-stop-index]") : null;
    if (!item || this.draggedStopIndex === null) return;
    event.preventDefault();
    this.draft.stops = moveStop(this.draft.stops, this.draggedStopIndex, Number(item.dataset.stopIndex));
    this.draggedStopIndex = null;
    this.persistAndRender(this.draft.immediateRecalculation);
  };

  private setPath(path: string, value: string | number | boolean | null): void {
    const segments = path.split(".");
    let cursor: unknown = this.draft;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (!segment || typeof cursor !== "object" || cursor === null) return;
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    const finalSegment = segments.at(-1);
    if (finalSegment && typeof cursor === "object" && cursor !== null) (cursor as Record<string, unknown>)[finalSegment] = value;
  }

  private persistAndRender(recalculate: boolean): void {
    this.draft.updatedAt = new Date().toISOString();
    globalThis.localStorage?.setItem(draftKey, serializeDraft(this.draft));
    this.render();
    this.dispatchEvent(new CustomEvent("trip-draft-changed", { detail: this.value, bubbles: true }));
    if (recalculate) this.scheduleCalculation();
  }

  private scheduleCalculation(): void {
    if (this.recalculateTimer) clearTimeout(this.recalculateTimer);
    this.recalculateTimer = setTimeout(() => this.requestCalculation("automatic"), 600);
  }

  private requestCalculation(reason: "manual" | "automatic"): void {
    const issues = validateDraft(this.draft);
    const errors = issues.filter((issue) => issue.severity === "ERROR");
    this.render();
    if (errors.length > 0) {
      this.querySelector<HTMLElement>("#validation-summary")?.focus();
      return;
    }
    this.dispatchEvent(new CustomEvent("trip-calculation-requested", {
      detail: { reason, draft: this.value, issues },
      bubbles: true,
    }));
  }

  private render(): void {
    const issues = validateDraft(this.draft);
    const errors = issues.filter((issue) => issue.severity === "ERROR");
    const warnings = issues.filter((issue) => issue.severity === "WARNING");
    this.innerHTML = `
      <style>${styles}</style>
      <main class="planner" aria-labelledby="trip-planner-title">
        <header class="hero">
          <div><p class="eyebrow">TripRouteCalc</p><h1 id="trip-planner-title">Trip setup</h1><p>Enter the facts the calculation engine needs. Missing legal data stays visible instead of being politely buried under the rug.</p></div>
          <button type="button" class="secondary" data-action="clear-draft">Clear saved draft</button>
        </header>
        <section id="validation-summary" class="summary" tabindex="-1" aria-live="polite">
          <strong>${errors.length} blocking ${errors.length === 1 ? "issue" : "issues"}, ${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}</strong>
          ${issues.length ? `<ul>${issues.map((issue) => `<li><span class="severity">${issue.severity}</span> ${escapeHtml(issue.message)}</li>`).join("")}</ul>` : "<p>Required trip facts are ready for calculation.</p>"}
        </section>
        ${this.renderProfilesAndClocks()}
        ${this.renderLoad()}
        <section class="panel" aria-labelledby="stops-heading">
          <div class="section-heading"><div><p class="step">Step 4</p><h2 id="stops-heading">Stops and appointments</h2></div><button type="button" data-action="add-stop">Add stop</button></div>
          <p class="help">Drag unlocked stops, or use the move buttons. Every stop keeps its own appointment and service assumptions.</p>
          <ol class="stops">${this.draft.stops.map((stop, index) => this.renderStop(stop, index)).join("")}</ol>
        </section>
        <section class="actions" aria-label="Calculation controls">
          <label class="toggle"><input type="checkbox" data-path="immediateRecalculation"${checked(this.draft.immediateRecalculation)}> Recalculate automatically after edits</label>
          <button type="button" class="primary" data-action="calculate">Validate and calculate trip</button>
        </section>
      </main>`;
  }

  private renderProfilesAndClocks(): string {
    const c = this.draft.clocks;
    return `<section class="panel" aria-labelledby="driver-heading">
      <div class="section-heading"><div><p class="step">Steps 1 and 2</p><h2 id="driver-heading">Driver and departure clocks</h2></div></div>
      <div class="grid two"><label>Driver profile<input data-path="driver.label" value="${escapeHtml(this.draft.driver.label)}" autocomplete="name" required></label><label>Current duty status<select data-path="clocks.currentDutyStatus" required><option value="">Choose explicitly</option><option value="OFF_DUTY"${selected(c.currentDutyStatus,"OFF_DUTY")}>Off duty</option><option value="SLEEPER_BERTH"${selected(c.currentDutyStatus,"SLEEPER_BERTH")}>Sleeper berth</option><option value="ON_DUTY_NOT_DRIVING"${selected(c.currentDutyStatus,"ON_DUTY_NOT_DRIVING")}>On duty, not driving</option><option value="DRIVING"${selected(c.currentDutyStatus,"DRIVING")}>Driving</option></select></label><label>Duty status began<input type="datetime-local" data-path="clocks.dutyStatusBeganAt" value="${escapeHtml(c.dutyStatusBeganAt)}"></label><label>Departure date and time<input type="datetime-local" data-path="clocks.departureAt" value="${escapeHtml(c.departureAt)}" required></label><label>Departure IANA time zone<input data-path="clocks.departureTimeZone" value="${escapeHtml(c.departureTimeZone)}" placeholder="America/Boise" required></label></div>
      <div class="clock-grid"><label><span>Drive remaining</span><input type="number" min="0" step="1" data-path="clocks.driveMinutesRemaining" value="${c.driveMinutesRemaining}" aria-describedby="clock-units"><strong>${formatMinutes(c.driveMinutesRemaining)}</strong></label><label><span>Shift remaining</span><input type="number" min="0" step="1" data-path="clocks.shiftMinutesRemaining" value="${c.shiftMinutesRemaining}" aria-describedby="clock-units"><strong>${formatMinutes(c.shiftMinutesRemaining)}</strong></label><label><span>Cycle remaining</span><input type="number" min="0" step="1" data-path="clocks.cycleMinutesRemaining" value="${c.cycleMinutesRemaining}" aria-describedby="clock-units"><strong>${formatMinutes(c.cycleMinutesRemaining)}</strong></label></div><p id="clock-units" class="help">Enter each clock independently in minutes. The interface never invents one from another.</p>
      <div class="grid three"><label>Tractor profile<input data-path="tractor.label" value="${escapeHtml(this.draft.tractor.label)}" required></label><label>Trailer profile<input data-path="trailer.label" value="${escapeHtml(this.draft.trailer.label)}" required></label></div>
    </section>`;
  }

  private renderLoad(): string {
    const load = this.draft.load;
    return `<section class="panel" aria-labelledby="load-heading"><div class="section-heading"><div><p class="step">Step 3</p><h2 id="load-heading">Load facts</h2></div></div><div class="grid three"><label>Load identifier<input data-path="load.identifier" value="${escapeHtml(load.identifier)}" required></label><label>Commodity<input data-path="load.commodity" value="${escapeHtml(load.commodity)}"></label><label>Total combination weight, lb<input type="number" min="0" data-path="load.totalCombinationWeightPounds" value="${numberValue(load.totalCombinationWeightPounds)}"></label><label>Cargo weight, lb<input type="number" min="0" data-path="load.cargoWeightPounds" value="${numberValue(load.cargoWeightPounds)}"></label><label>Overall height, in<input type="number" min="0" data-path="load.heightInches" value="${numberValue(load.heightInches)}"></label><label>Overall width, in<input type="number" min="0" data-path="load.widthInches" value="${numberValue(load.widthInches)}"></label><label>Overall length, in<input type="number" min="0" data-path="load.lengthInches" value="${numberValue(load.lengthInches)}"></label><label class="toggle"><input type="checkbox" data-path="load.hazmat"${checked(load.hazmat)}> Hazmat load</label><label>Hazmat class<input data-path="load.hazmatClass" value="${escapeHtml(load.hazmatClass)}" ${load.hazmat ? "required" : ""}></label><label>Permit identifiers<input data-path="load.permitIdentifiers" value="${escapeHtml(load.permitIdentifiers)}"></label><label class="wide">Route restrictions<textarea data-path="load.routeRestrictions">${escapeHtml(load.routeRestrictions)}</textarea></label></div></section>`;
  }

  private renderStop(stop: TripStop, index: number): string {
    const prefix = `stops.${index}`;
    return `<li class="stop-card" data-stop-index="${index}" draggable="${!stop.locked}" aria-label="Stop ${index + 1}: ${escapeHtml(stop.label || stop.type)}">
      <div class="stop-heading"><div><span class="order">${index + 1}</span><strong>${escapeHtml(stop.label || stop.type.replaceAll("_", " "))}</strong></div><div class="button-row"><button type="button" class="icon" data-action="move-up" data-index="${index}" aria-label="Move stop ${index + 1} up" ${index === 0 || stop.locked ? "disabled" : ""}>↑</button><button type="button" class="icon" data-action="move-down" data-index="${index}" aria-label="Move stop ${index + 1} down" ${index === this.draft.stops.length - 1 || stop.locked ? "disabled" : ""}>↓</button><button type="button" class="secondary" data-action="insert-stop" data-index="${index}">Insert after</button><button type="button" class="secondary" data-action="duplicate-stop" data-index="${index}">Duplicate</button><button type="button" class="danger" data-action="remove-stop" data-index="${index}" ${stop.locked || this.draft.stops.length <= 2 ? "disabled" : ""}>Remove</button></div></div>
      <div class="grid three"><label>Stop type<select data-path="${prefix}.type">${stopTypes.map((type) => `<option value="${type}"${selected(stop.type,type)}>${type.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Stop name<input data-path="${prefix}.label" value="${escapeHtml(stop.label)}"></label><label>Location<input data-path="${prefix}.location" value="${escapeHtml(stop.location)}" required></label><label class="toggle"><input type="checkbox" data-path="${prefix}.required"${checked(stop.required)}> Required stop</label><label class="toggle"><input type="checkbox" data-path="${prefix}.locked"${checked(stop.locked)}> Lock position</label></div>
      <details><summary>Appointment and service</summary><div class="grid three"><label>Appointment<select data-path="${prefix}.appointmentMode"><option value="NONE"${selected(stop.appointmentMode,"NONE")}>None</option><option value="FIXED"${selected(stop.appointmentMode,"FIXED")}>Fixed time</option><option value="WINDOW"${selected(stop.appointmentMode,"WINDOW")}>Window</option></select></label><label>Start or fixed time<input type="datetime-local" data-path="${prefix}.appointmentStart" value="${escapeHtml(stop.appointmentStart)}"></label><label>Window end<input type="datetime-local" data-path="${prefix}.appointmentEnd" value="${escapeHtml(stop.appointmentEnd)}"></label><label>Appointment IANA zone<input data-path="${prefix}.appointmentTimeZone" value="${escapeHtml(stop.appointmentTimeZone)}" placeholder="America/Chicago"></label><label>Service estimate<select data-path="${prefix}.serviceMode"><option value="EXACT"${selected(stop.serviceMode,"EXACT")}>Exact</option><option value="EXPECTED"${selected(stop.serviceMode,"EXPECTED")}>Expected</option><option value="RANGE"${selected(stop.serviceMode,"RANGE")}>Range</option></select></label><label>Service minutes<input type="number" min="0" data-path="${prefix}.serviceMinutes" value="${stop.serviceMinutes}"></label><label>Minimum minutes<input type="number" min="0" data-path="${prefix}.serviceMinimumMinutes" value="${stop.serviceMinimumMinutes}"></label><label>Maximum minutes<input type="number" min="0" data-path="${prefix}.serviceMaximumMinutes" value="${stop.serviceMaximumMinutes}"></label><label>Duty status during service<select data-path="${prefix}.serviceDutyStatus"><option value="ON_DUTY_NOT_DRIVING"${selected(stop.serviceDutyStatus,"ON_DUTY_NOT_DRIVING")}>On duty, not driving</option><option value="OFF_DUTY"${selected(stop.serviceDutyStatus,"OFF_DUTY")}>Off duty</option><option value="SLEEPER_BERTH"${selected(stop.serviceDutyStatus,"SLEEPER_BERTH")}>Sleeper berth</option><option value="DRIVING"${selected(stop.serviceDutyStatus,"DRIVING")}>Driving</option></select></label><label class="wide">Notes and instructions<textarea data-path="${prefix}.notes">${escapeHtml(stop.notes)}</textarea></label></div></details>
    </li>`;
  }
}

const formatMinutes = (minutes: number): string => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const styles = `
:host{display:block;color:#172033;background:#f4f7fb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}.planner{max-width:1180px;margin:auto;padding:clamp(1rem,3vw,2rem)}.hero,.section-heading,.stop-heading,.actions{display:flex;gap:1rem;align-items:center;justify-content:space-between}.hero{margin-bottom:1rem}.hero h1{font-size:clamp(2rem,7vw,3.5rem);margin:.1rem 0}.hero p{max-width:70ch}.eyebrow,.step{font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4057a8;margin:0}.panel,.summary,.actions{background:white;border:1px solid #d7deea;border-radius:1rem;padding:clamp(1rem,3vw,1.5rem);margin:1rem 0;box-shadow:0 8px 30px rgba(22,31,55,.06)}.summary:focus{outline:3px solid #315efb}.summary ul{padding-left:1.3rem}.severity{font-weight:800}.grid{display:grid;gap:1rem;margin-top:1rem}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.wide{grid-column:1/-1}label{display:grid;gap:.4rem;font-weight:700}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;min-height:2.9rem;border:1px solid #9da9bc;border-radius:.65rem;padding:.65rem;background:white;color:inherit}textarea{min-height:5rem;resize:vertical}button{min-height:2.75rem;border:0;border-radius:.65rem;padding:.65rem .9rem;background:#243a73;color:white;font-weight:800;cursor:pointer}button.secondary{background:#e8edf8;color:#1e315f}button.danger{background:#7d2030}button.primary{background:#1746d1}button:disabled{opacity:.45;cursor:not-allowed}.clock-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin:1rem 0}.clock-grid label{background:#eef3ff;border:1px solid #ccd8fa;border-radius:.85rem;padding:1rem}.clock-grid strong{font-size:1.35rem}.help{color:#526078}.stops{padding:0;list-style:none}.stop-card{border:1px solid #ced6e3;border-radius:.9rem;padding:1rem;margin:1rem 0;background:#fbfcfe}.stop-heading>div:first-child{display:flex;align-items:center;gap:.65rem}.order{display:grid;place-items:center;width:2rem;height:2rem;border-radius:50%;background:#243a73;color:white;font-weight:900}.button-row{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end}.icon{width:2.75rem;padding:0}.toggle{display:flex;align-items:center;gap:.6rem;align-self:end;min-height:2.9rem}.toggle input{width:1.25rem;min-height:1.25rem}details{margin-top:1rem;border-top:1px solid #dce2eb;padding-top:.8rem}summary{font-weight:900;cursor:pointer;min-height:2.75rem;display:flex;align-items:center}.actions{position:sticky;bottom:.5rem;z-index:2}@media(max-width:760px){.hero,.section-heading,.stop-heading,.actions{align-items:stretch;flex-direction:column}.grid.two,.grid.three,.clock-grid{grid-template-columns:1fr}.button-row{justify-content:flex-start}.button-row button{flex:1 1 auto}.actions{position:static}.primary{width:100%}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

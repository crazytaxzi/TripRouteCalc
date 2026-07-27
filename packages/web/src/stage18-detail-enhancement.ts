import {
  createStage18CompleteFacts,
  ensureStopPlanningFacts,
  loadFactsFromProfile,
  loadStage18CompleteFacts,
  saveStage18CompleteFacts,
  tractorFactsFromProfile,
  trailerFactsFromProfile,
  updateStage18CompleteFacts,
  validateStage18CompleteFacts,
} from './stage18-details.js';
import type { Stage18CompleteFacts, StopPlanningFacts } from './stage18-details.js';
import {
  getStage18ProfileCache,
  renderDriverOptions,
  renderEquipmentHost,
  setStage18ProfileCache,
} from './stage18-equipment-renderer.js';
import type {
  EquipmentKind,
  ProfileCache,
  ProfileOption,
} from './stage18-equipment-renderer.js';
import { renderStopFacts } from './stage18-stop-renderer.js';
import { restoreDraft } from './model.js';
import type { DutyStatus, TripSetupState } from './model.js';

const LEGACY_STORAGE_KEY = 'trip-route-calc-stage18-draft-v1';
let loading: Promise<void> | undefined;

function fieldValue(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
  if (target instanceof HTMLInputElement && target.type === 'checkbox') return target.checked;
  if (target instanceof HTMLInputElement && target.type === 'number') {
    return target.value.trim() === '' ? null : Number(target.value);
  }
  return target.value;
}

function setLegacyEquipmentId(root: HTMLElement, kind: EquipmentKind, id: string): void {
  const input = root.querySelector<HTMLInputElement>(`input[name="${kind}"]`);
  if (input === null) return;
  input.value = id;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function profileById(kind: EquipmentKind, id: string): ProfileOption | undefined {
  return getStage18ProfileCache()[`${kind}s` as 'tractors' | 'trailers' | 'loads'].find(
    (candidate): boolean => candidate.id === id,
  );
}

function chooseEquipmentProfile(root: HTMLElement, kind: EquipmentKind, id: string): void {
  const current = loadStage18CompleteFacts();
  if (id === '') {
    const fresh = createStage18CompleteFacts()[kind];
    saveStage18CompleteFacts({ ...current, [kind]: fresh });
    setLegacyEquipmentId(root, kind, '');
    return;
  }
  const option = profileById(kind, id);
  if (option === undefined) return;
  const profile =
    kind === 'tractor'
      ? tractorFactsFromProfile(id, option.profile)
      : kind === 'trailer'
        ? trailerFactsFromProfile(id, option.profile)
        : loadFactsFromProfile(id, option.profile);
  saveStage18CompleteFacts({ ...current, [kind]: profile });
  setLegacyEquipmentId(root, kind, id);
}

function updateEquipmentField(
  kind: EquipmentKind,
  field: string,
  value: unknown,
): void {
  updateStage18CompleteFacts((facts) => ({
    ...facts,
    [kind]: {
      ...facts[kind],
      [field]: value,
      dirty: true,
    },
  }));
}

function updateStopField(localId: string, field: string, value: unknown): void {
  updateStage18CompleteFacts((facts) => ({
    ...facts,
    stops: {
      ...facts.stops,
      [localId]: {
        ...(facts.stops[localId] ?? ensureStopPlanningFacts(localId)),
        [field]: value,
      } as StopPlanningFacts,
    },
  }));
}

function legacyState(): TripSetupState | undefined {
  return restoreDraft(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '');
}

function issueList(root: HTMLElement): HTMLUListElement | undefined {
  const existing = root.querySelector<HTMLUListElement>('.issues ul');
  if (existing !== null) return existing;
  const form = root.querySelector('form');
  if (form === null) return undefined;
  const section = document.createElement('section');
  section.className = 'issues';
  section.setAttribute('aria-labelledby', 'issues-heading');
  section.innerHTML = '<h2 id="issues-heading">Before calculation</h2><ul></ul>';
  form.before(section);
  return section.querySelector('ul') ?? undefined;
}

function synchronizeIssues(root: HTMLElement): void {
  root.querySelectorAll('[data-stage18-complete-issue]').forEach((node): void => node.remove());
  const state = legacyState();
  if (state === undefined) return;
  const issues = validateStage18CompleteFacts(state);
  if (issues.length === 0) return;
  const list = issueList(root);
  if (list === undefined) return;
  issues.forEach((candidate): void => {
    const item = document.createElement('li');
    item.dataset.stage18CompleteIssue = 'true';
    const label = document.createElement('strong');
    label.textContent = candidate.severity === 'error' ? 'Required:' : 'Check:';
    item.append(label, ` ${candidate.message}`);
    list.append(item);
  });
}

function enhanceDriver(root: HTMLElement): void {
  if (root.querySelector('[data-stage18-driver-enhanced]') !== null) return;
  const input = root.querySelector<HTMLInputElement>('input[name="driver"]');
  if (input === null) return;
  const facts = loadStage18CompleteFacts();
  input.closest('label')?.insertAdjacentHTML('beforebegin', renderDriverOptions(facts));
  if (facts.driver.displayName === '' && input.value !== '') {
    saveStage18CompleteFacts({
      ...facts,
      driver: { displayName: input.value, dirty: true },
    });
  }
}

function enhanceEquipment(root: HTMLElement): void {
  if (root.querySelector('[data-stage18-equipment-enhanced]') !== null) return;
  const sections = root.querySelectorAll<HTMLElement>('section.panel');
  const panel = sections[1];
  if (panel === undefined) return;
  const legacyGrid = panel.querySelector<HTMLElement>('.grid.three');
  legacyGrid?.setAttribute('hidden', '');
  legacyGrid?.nextElementSibling?.setAttribute('hidden', '');
  const host = document.createElement('div');
  host.dataset.stage18EquipmentEnhanced = 'true';
  host.innerHTML = renderEquipmentHost(loadStage18CompleteFacts());
  panel.append(host);
}

function enhanceStops(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.stop-card').forEach((card): void => {
    if (card.querySelector('[data-stage18-stop-enhanced]') !== null) return;
    const localId = card.dataset.stopId;
    if (localId === undefined) return;
    const timeZoneInput = card.querySelector<HTMLInputElement>(
      '[data-field="appointment.timeZone"]',
    );
    const serviceMode = card.querySelector<HTMLSelectElement>(
      '[data-field="service.mode"]',
    );
    const serviceDuty = card.querySelector<HTMLSelectElement>(
      '[data-field="service.dutyStatus"]',
    );
    const facts = ensureStopPlanningFacts(localId, {
      appointment: {
        mode:
          card.querySelector<HTMLSelectElement>('[data-field="appointment.mode"]')
            ?.value === 'fixed'
            ? 'fixed'
            : card.querySelector<HTMLSelectElement>('[data-field="appointment.mode"]')
                  ?.value === 'window'
              ? 'window'
              : 'none',
        timeZone: timeZoneInput?.value ?? '',
        ...(card.querySelector<HTMLInputElement>('[data-field="appointment.fixedAt"]')?.value
          ? { fixedAt: card.querySelector<HTMLInputElement>('[data-field="appointment.fixedAt"]')?.value as string }
          : {}),
        ...(card.querySelector<HTMLInputElement>('[data-field="appointment.earliestAt"]')?.value
          ? { earliestAt: card.querySelector<HTMLInputElement>('[data-field="appointment.earliestAt"]')?.value as string }
          : {}),
        ...(card.querySelector<HTMLInputElement>('[data-field="appointment.latestAt"]')?.value
          ? { latestAt: card.querySelector<HTMLInputElement>('[data-field="appointment.latestAt"]')?.value as string }
          : {}),
        lateToleranceMinutes: Number(
          card.querySelector<HTMLInputElement>(
            '[data-field="appointment.lateToleranceMinutes"]',
          )?.value ?? 0,
        ),
        earlyParkingAllowed: false,
        overnightParkingAllowed: false,
      },
      service: {
        mode:
          serviceMode?.value === 'exact'
            ? 'exact'
            : serviceMode?.value === 'range'
              ? 'range'
              : 'expected',
        exactMinutes: Number(
          card.querySelector<HTMLInputElement>('[data-field="service.exactMinutes"]')
            ?.value ?? 0,
        ),
        expectedMinutes: Number(
          card.querySelector<HTMLInputElement>('[data-field="service.expectedMinutes"]')
            ?.value ?? 0,
        ),
        minimumMinutes: Number(
          card.querySelector<HTMLInputElement>('[data-field="service.minimumMinutes"]')
            ?.value ?? 0,
        ),
        maximumMinutes: Number(
          card.querySelector<HTMLInputElement>('[data-field="service.maximumMinutes"]')
            ?.value ?? 0,
        ),
        dutyStatus: (serviceDuty?.value ?? 'on_duty_not_driving') as DutyStatus,
      },
    });
    card.querySelectorAll(':scope > details').forEach((details): void => {
      details.setAttribute('hidden', '');
    });
    const host = document.createElement('div');
    host.innerHTML = renderStopFacts(localId, facts);
    const inserted = host.firstElementChild;
    if (inserted === null) return;
    const notes = card.querySelector<HTMLTextAreaElement>('[data-field="notes"]')?.closest('label');
    notes?.querySelector('span')?.replaceChildren('Notes');
    notes?.before(inserted);
    const mirrored = inserted.querySelector<HTMLInputElement>('[data-stage18-stop-time-zone]');
    if (mirrored !== null) mirrored.value = timeZoneInput?.value ?? '';
  });
}

function enhance(root: HTMLElement): void {
  enhanceDriver(root);
  enhanceEquipment(root);
  enhanceStops(root);
  synchronizeIssues(root);
}

function loadProfiles(root: HTMLElement): Promise<void> {
  loading ??= (async (): Promise<void> => {
    const baseUrl = (root.dataset.apiBaseUrl ?? '/api').replace(/\/$/u, '');
    const headers = {
      authorization: `Bearer ${sessionStorage.getItem('trip-route-calc-token') ?? ''}`,
    };
    const read = async (path: string): Promise<Record<string, unknown>> => {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      if (!response.ok) return {};
      const value: unknown = await response.json();
      return value !== null && !Array.isArray(value) && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    };
    const [drivers, tractors, trailers, loads] = await Promise.all([
      read('/drivers'),
      read('/equipment/tractors'),
      read('/equipment/trailers'),
      read('/equipment/loads'),
    ]);
    const options = (
      value: unknown,
      idName: string,
      label: (profile: Record<string, unknown>, row: Record<string, unknown>) => string,
    ): readonly ProfileOption[] =>
      (Array.isArray(value) ? value : []).flatMap((candidate) => {
        if (candidate === null || Array.isArray(candidate) || typeof candidate !== 'object') return [];
        const row = candidate as Record<string, unknown>;
        const id = row[idName];
        const profile =
          row.profile !== null && !Array.isArray(row.profile) && typeof row.profile === 'object'
            ? (row.profile as Record<string, unknown>)
            : {};
        return typeof id === 'string'
          ? [{ id, label: label(profile, row), profile: row.profile }]
          : [];
      });
    const nextCache: ProfileCache = {
      drivers: options(drivers.drivers, 'driverId', (_profile, row) => String(row.displayName ?? 'Driver')),
      tractors: options(tractors.tractors, 'tractorId', (profile) => String(profile.unitNumber ?? 'Tractor')),
      trailers: options(trailers.trailers, 'trailerId', (profile) => String(profile.trailerNumber ?? 'Trailer')),
      loads: options(loads.loads, 'loadId', (profile) => String(profile.loadIdentifier ?? 'Load')),
    };
    setStage18ProfileCache(nextCache);
    root.querySelector('[data-stage18-driver-enhanced]')?.remove();
    root.querySelector('[data-stage18-equipment-enhanced]')?.remove();
    enhance(root);
  })().catch((): void => {
    loading = undefined;
  });
  return loading;
}

export function installStage18DetailEnhancement(root: HTMLElement): MutationObserver {
  let queued = false;
  const schedule = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask((): void => {
      queued = false;
      enhance(root);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener('input', (event): void => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }
    if (target.name === 'driver') {
      updateStage18CompleteFacts((facts) => ({
        ...facts,
        driver: {
          ...facts.driver,
          displayName: target.value,
          dirty: true,
        },
      }));
    }
    const kind = target.dataset.stage18EquipmentKind;
    const field = target.dataset.stage18Field;
    if ((kind === 'tractor' || kind === 'trailer' || kind === 'load') && field !== undefined) {
      updateEquipmentField(kind, field, fieldValue(target));
    }
    const localId = target.dataset.stage18StopId;
    const stopFieldName = target.dataset.stage18StopField;
    if (localId !== undefined && stopFieldName !== undefined) {
      updateStopField(localId, stopFieldName, fieldValue(target));
    }
    const timeZoneId = target.dataset.stage18StopTimeZone;
    if (timeZoneId !== undefined) {
      const card = target.closest<HTMLElement>('.stop-card');
      const original = card?.querySelector<HTMLInputElement>(
        '[data-field="appointment.timeZone"]',
      );
      if (original !== undefined && original !== null) {
        original.value = target.value;
        original.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    schedule();
  });

  root.addEventListener('change', (event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) return;
    const driverSelection = target.dataset.stage18DriverSelect;
    if (driverSelection !== undefined) {
      const option = getStage18ProfileCache().drivers.find((candidate): boolean => candidate.id === target.value);
      const input = root.querySelector<HTMLInputElement>('input[name="driver"]');
      const current = loadStage18CompleteFacts();
      const driver =
        option === undefined
          ? { displayName: input?.value ?? '', dirty: true }
          : { id: option.id, displayName: option.label, dirty: false };
      saveStage18CompleteFacts({ ...current, driver });
      if (input !== null) {
        input.value = driver.displayName;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    const profileKind = target.dataset.stage18ProfileSelect;
    if (profileKind === 'tractor' || profileKind === 'trailer' || profileKind === 'load') {
      chooseEquipmentProfile(root, profileKind, target.value);
      return;
    }
    if (target.dataset.stage18RoutePolicy !== undefined) {
      updateStage18CompleteFacts((facts) => ({
        ...facts,
        route: { ...facts.route, policy: target.value as Stage18CompleteFacts['route']['policy'] },
      }));
    }
    const avoidance = target.dataset.stage18RouteAvoidance;
    if (avoidance !== undefined && target instanceof HTMLInputElement) {
      updateStage18CompleteFacts((facts) => {
        const set = new Set(facts.route.avoidances);
        if (target.checked) set.add(avoidance as never);
        else set.delete(avoidance as never);
        return { ...facts, route: { ...facts.route, avoidances: [...set] } };
      });
    }
    schedule();
  });

  schedule();
  void loadProfiles(root);
  return observer;
}

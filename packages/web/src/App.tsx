import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  PlanningApiError,
  TripPlanningClient,
} from './api-client.js';
import {
  CheckField,
  NumberField,
  ProfileSelect,
  Section,
  SelectField,
  StopCard,
  TextField,
  dutyStatusOptions,
  newStopTypeOptions,
} from './form-components.js';
import { HosEvidenceEditor } from './hos-evidence-editor.js';
import {
  clearDraft,
  defaultTripDraft,
  draftReducer,
  loadDraft,
  saveDraft,
  validateDraft,
} from './model.js';
import {
  loadFormFromProfile,
  tractorFormFromProfile,
  trailerFormFromProfile,
} from './profile-mapping.js';
import type {
  HosForm,
  LoadForm,
  PlanningOutcome,
  ProfileLists,
  RouteForm,
  StopType,
  TractorForm,
  TrailerForm,
  TripDraft,
  ValidationIssue,
} from './types.js';

const emptyProfiles: ProfileLists = {
  drivers: [],
  tractors: [],
  trailers: [],
  loads: [],
};

const idleOutcome: PlanningOutcome = {
  status: 'idle',
  message: 'Complete the required evidence, then calculate the trip.',
  warnings: [],
};

function numberValue(value: number | null, fallback = 0): number {
  return value ?? fallback;
}

function issueClass(issue: ValidationIssue): string {
  return `issue issue--${issue.severity}`;
}

function StepNav(props: { readonly draft: TripDraft }): ReactNode {
  const completed = [
    props.draft.driver.displayName.trim() !== '',
    props.draft.tractor.unitNumber.trim() !== '' &&
      props.draft.trailer.unitNumber.trim() !== '',
    props.draft.load.referenceNumber.trim() !== '',
    props.draft.stops.every(
      (stop) =>
        stop.locationDescription.trim() !== '' &&
        stop.latitude !== null &&
        stop.longitude !== null,
    ),
  ];
  const steps = ['Driver & HOS', 'Equipment', 'Load', 'Stops'];
  return (
    <nav className="step-nav" aria-label="Trip setup progress">
      {steps.map((step, index) => (
        <a key={step} href={`#step-${String(index + 1)}`}>
          <span className={completed[index] ? 'step-dot step-dot--done' : 'step-dot'}>
            {completed[index] ? '✓' : String(index + 1)}
          </span>
          <span>{step}</span>
        </a>
      ))}
    </nav>
  );
}

function RecoveryBanner(props: {
  readonly draft: TripDraft;
  readonly onRestore: () => void;
  readonly onDiscard: () => void;
}): ReactNode {
  return (
    <aside className="recovery-banner" role="status">
      <div>
        <strong>Saved setup found</strong>
        <p>
          A local draft from{' '}
          {props.draft.savedAt === undefined
            ? 'an earlier session'
            : new Date(props.draft.savedAt).toLocaleString()}{' '}
          is available. Authentication was not stored.
        </p>
      </div>
      <div className="button-row">
        <button type="button" onClick={props.onRestore}>Restore draft</button>
        <button type="button" className="button--quiet" onClick={props.onDiscard}>Discard</button>
      </div>
    </aside>
  );
}

function issueFieldName(issue: ValidationIssue, draft: TripDraft): string | undefined {
  const stopMatch = /^stops\.(\d+)\.(.+)$/u.exec(issue.path);
  if (stopMatch !== null) {
    const index = Number(stopMatch[1]);
    const stop = draft.stops[index];
    const suffix = stopMatch[2];
    if (stop === undefined || suffix === undefined) return undefined;
    if (suffix === 'locationDescription') return `${stop.localId}-location`;
    if (suffix === 'coordinates') return `${stop.localId}-latitude`;
    if (suffix === 'type') return `${stop.localId}-type`;
    return `${stop.localId}-location`;
  }
  const fields: Readonly<Record<string, string>> = {
    'driver.displayName': 'driver-name',
    'tractor.unitNumber': 'tractor-number',
    'trailer.unitNumber': 'trailer-number',
    'load.referenceNumber': 'load-reference',
    'load.commodityDescription': 'commodity',
    'route.ruleSetVersion': 'rule-set-version',
    hos: 'departure-time',
    equipment: 'tractor-number',
    stops: 'new-stop-type',
  };
  return fields[issue.path];
}

function focusNamedField(name: string | undefined): boolean {
  if (name === undefined) return false;
  const field = document.getElementsByName(name).item(0);
  if (!(field instanceof HTMLElement)) return false;
  field.focus();
  return true;
}

function preservesLockedIntermediatePositions(
  before: readonly TripDraft['stops'][number][],
  after: readonly TripDraft['stops'][number][],
): boolean {
  return before.every((stop, index) => {
    const intermediate = index > 0 && index < before.length - 1;
    return (
      !intermediate ||
      !stop.lockedPosition ||
      after[index]?.localId === stop.localId
    );
  });
}

export function App(): ReactNode {
  const [initialRecovery] = useState(() => ({ draft: loadDraft() }));
  const [draft, dispatch] = useReducer(draftReducer, undefined, defaultTripDraft);
  const [token, setToken] = useState(
    () => sessionStorage.getItem('trip-route-calc.stage18.token') ?? '',
  );
  const [profiles, setProfiles] = useState<ProfileLists>(emptyProfiles);
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
  const [outcome, setOutcome] = useState<PlanningOutcome>(idleOutcome);
  const [recoveredDraft, setRecoveredDraft] = useState<TripDraft | undefined>(
    initialRecovery.draft,
  );
  const [recoveryResolved, setRecoveryResolved] = useState(
    initialRecovery.draft === undefined,
  );
  const [saveStatus, setSaveStatus] = useState('Not saved yet');
  const [newStopType, setNewStopType] = useState<StopType>('shipper');
  const [dirty, setDirty] = useState(false);
  const [needsCalculation, setNeedsCalculation] = useState(false);
  const [stopAnnouncement, setStopAnnouncement] = useState('');
  const validationSummary = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const pendingStopFocus = useRef<number | undefined>(undefined);

  const issues = useMemo(() => validateDraft(draft), [draft]);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity !== 'error');
  const connected = connectionStatus === 'Connected to authenticated carrier account';

  const update = (action: Parameters<typeof dispatch>[0]): void => {
    setDirty(true);
    setNeedsCalculation(true);
    setOutcome(idleOutcome);
    dispatch(action);
  };

  const applyStopAction = (
    action: Parameters<typeof dispatch>[0],
    announcement: string,
    focusIndex?: number,
  ): boolean => {
    const next = draftReducer(draft, action);
    if (
      next === draft ||
      !preservesLockedIntermediatePositions(draft.stops, next.stops)
    ) {
      pendingStopFocus.current = undefined;
      setStopAnnouncement('Locked stop positions cannot be shifted by this edit.');
      return false;
    }
    if (focusIndex !== undefined) pendingStopFocus.current = focusIndex;
    setDirty(true);
    setNeedsCalculation(true);
    setOutcome(idleOutcome);
    dispatch({ type: 'replace', draft: next });
    setStopAnnouncement(announcement);
    return true;
  };

  useEffect(() => {
    sessionStorage.setItem('trip-route-calc.stage18.token', token);
  }, [token]);

  useEffect(() => {
    if (!recoveryResolved) return undefined;
    const timer = window.setTimeout(() => {
      saveDraft(draft);
      setSaveStatus(`Draft saved locally at ${new Date().toLocaleTimeString()}`);
      setDirty(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, recoveryResolved]);

  useEffect(() => {
    const index = pendingStopFocus.current;
    if (index === undefined) return;
    pendingStopFocus.current = undefined;
    const stop = draft.stops[index];
    window.requestAnimationFrame(() => {
      focusNamedField(stop === undefined ? undefined : `${stop.localId}-location`);
    });
  }, [draft.stops]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent): void => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const client = (signal?: AbortSignal): TripPlanningClient =>
    new TripPlanningClient({
      baseUrl: draft.apiBaseUrl,
      token,
      ...(signal === undefined ? {} : { signal }),
    });

  const connect = async (): Promise<void> => {
    setConnectionStatus('Connecting…');
    try {
      const loaded = await client().loadProfiles();
      setProfiles(loaded);
      setConnectionStatus('Connected to authenticated carrier account');
    } catch (error) {
      setConnectionStatus(
        error instanceof Error ? error.message : 'Connection failed.',
      );
    }
  };

  const submit = async (automatic = false): Promise<void> => {
    const currentIssues = validateDraft(draft);
    const currentErrors = currentIssues.filter(
      (issue) => issue.severity === 'error',
    );
    if (currentErrors.length > 0) {
      setOutcome({
        status: 'failed',
        message: 'Correct the blocking setup errors before calculation.',
        warnings: currentErrors.map((issue) => issue.message),
      });
      if (!automatic) {
        const firstError = currentErrors[0];
        const focused =
          firstError !== undefined &&
          focusNamedField(issueFieldName(firstError, draft));
        if (!focused) validationSummary.current?.focus();
      }
      return;
    }
    if (automatic && !connected) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOutcome({
      status: 'submitting',
      message: automatic
        ? 'Changes settled. Recalculating the saved trip…'
        : 'Saving and validating the trip…',
      warnings: [],
    });
    try {
      const result = await client(controller.signal).submitDraft(draft);
      dispatch({ type: 'replace', draft: result.draft });
      saveDraft(result.draft);
      setDirty(false);
      setNeedsCalculation(false);
      setOutcome(result.outcome);
      try {
        const loaded = await client().loadProfiles();
        setProfiles(loaded);
      } catch (refreshError) {
        setConnectionStatus(
          refreshError instanceof Error
            ? `Trip saved; profile refresh failed: ${refreshError.message}`
            : 'Trip saved; profile refresh failed.',
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof PlanningApiError) {
        const missingSetup = Array.isArray(error.details.missingSetup)
          ? error.details.missingSetup.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        setOutcome({
          status:
            error.statusCode === 422 || error.statusCode === 503
              ? 'blocked'
              : 'failed',
          message: `${error.code}: ${error.message}`,
          warnings: missingSetup,
        });
      } else {
        setOutcome({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Trip submission failed.',
          warnings: [],
        });
      }
    }
  };

  useEffect(() => {
    if (
      !recoveryResolved ||
      !draft.route.autoCalculate ||
      !connected ||
      !needsCalculation ||
      errors.length > 0 ||
      outcome.status !== 'idle'
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void submit(true);
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [
    connected,
    draft,
    errors.length,
    needsCalculation,
    outcome.status,
    recoveryResolved,
  ]);

  const moveStopTo = (sourceId: string, targetId: string): void => {
    const source = draft.stops.findIndex((stop) => stop.localId === sourceId);
    const target = draft.stops.findIndex((stop) => stop.localId === targetId);
    if (source < 0 || target < 0 || source === target) return;
    const direction: -1 | 1 = source < target ? 1 : -1;
    let next = draft;
    for (let index = source; index !== target; index += direction) {
      next = draftReducer(next, {
        type: 'move-stop',
        localId: sourceId,
        direction,
      });
    }
    if (
      next === draft ||
      !preservesLockedIntermediatePositions(draft.stops, next.stops)
    ) {
      setStopAnnouncement('Locked stop positions cannot be shifted by this edit.');
      return;
    }
    setDirty(true);
    setNeedsCalculation(true);
    setOutcome(idleOutcome);
    dispatch({ type: 'replace', draft: next });
    setStopAnnouncement(`Moved stop ${String(source + 1)} to position ${String(target + 1)}.`);
  };

  const selectDriver = (id: string | undefined): void => {
    if (id === undefined) {
      update({ type: 'driver', value: { displayName: draft.driver.displayName } });
      return;
    }
    const option = profiles.drivers.find((profile) => profile.id === id);
    if (option !== undefined) {
      update({ type: 'driver', value: { id, displayName: option.label } });
    }
  };

  const selectTractor = (id: string | undefined): void => {
    if (id === undefined) {
      update({ type: 'tractor', value: { ...draft.tractor, id: undefined } });
      return;
    }
    const option = profiles.tractors.find((profile) => profile.id === id);
    if (option?.profile !== undefined) {
      update({
        type: 'tractor',
        value: tractorFormFromProfile(
          id,
          option.profile,
          draft.tractor.fallbackSpeedMph,
        ),
      });
    }
  };

  const selectTrailer = (id: string | undefined): void => {
    if (id === undefined) {
      update({ type: 'trailer', value: { ...draft.trailer, id: undefined } });
      return;
    }
    const option = profiles.trailers.find((profile) => profile.id === id);
    if (option?.profile !== undefined) {
      update({
        type: 'trailer',
        value: trailerFormFromProfile(id, option.profile),
      });
    }
  };

  const selectLoad = (id: string | undefined): void => {
    if (id === undefined) {
      update({ type: 'load', value: { ...draft.load, id: undefined } });
      return;
    }
    const option = profiles.loads.find((profile) => profile.id === id);
    if (option?.profile !== undefined) {
      update({ type: 'load', value: loadFormFromProfile(id, option.profile) });
    }
  };

  const updateHos = <Key extends keyof HosForm>(
    key: Key,
    value: HosForm[Key],
  ): void => update({ type: 'hos', value: { ...draft.hos, [key]: value } });
  const updateTractor = <Key extends keyof TractorForm>(
    key: Key,
    value: TractorForm[Key],
  ): void => update({ type: 'tractor', value: { ...draft.tractor, [key]: value } });
  const updateTrailer = <Key extends keyof TrailerForm>(
    key: Key,
    value: TrailerForm[Key],
  ): void => update({ type: 'trailer', value: { ...draft.trailer, [key]: value } });
  const updateLoad = <Key extends keyof LoadForm>(
    key: Key,
    value: LoadForm[Key],
  ): void => update({ type: 'load', value: { ...draft.load, [key]: value } });
  const updateRoute = <Key extends keyof RouteForm>(
    key: Key,
    value: RouteForm[Key],
  ): void => update({ type: 'route', value: { ...draft.route, [key]: value } });

  return (
    <div className="app-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">Commercial trip planning</p>
          <h1>Build the trip before the road builds problems</h1>
          <p>
            Set the driver, clocks, equipment, load, and every stop. Missing route or legal evidence stays visible instead of receiving a suspiciously confident makeover.
          </p>
        </div>
        <div className="masthead__status">
          <span className={errors.length === 0 ? 'status-chip status-chip--ready' : 'status-chip'}>
            {errors.length === 0 ? 'Ready to submit' : `${String(errors.length)} blockers`}
          </span>
          <small>{saveStatus}</small>
        </div>
      </header>

      {!recoveryResolved && recoveredDraft !== undefined ? (
        <RecoveryBanner
          draft={recoveredDraft}
          onRestore={() => {
            dispatch({ type: 'replace', draft: recoveredDraft });
            setRecoveryResolved(true);
            setRecoveredDraft(undefined);
            setNeedsCalculation(false);
          }}
          onDiscard={() => {
            clearDraft();
            setRecoveryResolved(true);
            setRecoveredDraft(undefined);
            setNeedsCalculation(false);
          }}
        />
      ) : null}

      <StepNav draft={draft} />

      <main id="main-content">
        <Section
          id="connection"
          eyebrow="Secure boundary"
          title="Connect to the API"
          description="The bearer token stays in this browser session and is never written into the saved trip draft."
          actions={<button type="button" onClick={() => void connect()}>Load profiles</button>}
        >
          <div className="form-grid">
            <TextField
              name="api-base-url"
              label="API base URL"
              type="url"
              value={draft.apiBaseUrl}
              placeholder="Leave blank for the current host"
              onChange={(value) => {
                setConnectionStatus('Not connected');
                update({
                  type: 'replace',
                  draft: { ...draft, apiBaseUrl: value },
                });
              }}
            />
            <TextField
              name="bearer-token"
              label="Bearer token"
              type="password"
              value={token}
              required
              autoComplete="off"
              onChange={(value) => {
                setConnectionStatus('Not connected');
                setToken(value);
              }}
              hint="Stored only in sessionStorage. It is excluded from local trip recovery."
            />
          </div>
          <p className="connection-status" role="status">{connectionStatus}</p>
        </Section>

        <Section
          id="step-1"
          eyebrow="Step 1"
          title="Driver and departure HOS"
          description="Enter the clocks as evidence. The UI validates them but never silently grants an exception."
        >
          <div className="form-grid">
            <ProfileSelect name="driver-profile" label="Saved driver" selectedId={draft.driver.id} options={profiles.drivers} onSelect={selectDriver} />
            <TextField name="driver-name" label="Driver name or identifier" required value={draft.driver.displayName} onChange={(value) => update({ type: 'driver', value: { ...draft.driver, displayName: value } })} />
            <TextField name="departure-time" label="Planned departure" type="datetime-local" required value={draft.hos.departureLocal} onChange={(value) => updateHos('departureLocal', value)} />
            <TextField name="departure-timezone" label="Departure IANA time zone" required value={draft.hos.departureTimeZone} onChange={(value) => updateHos('departureTimeZone', value)} />
            <SelectField name="duty-status" label="Current duty status" value={draft.hos.currentDutyStatus} options={dutyStatusOptions} onChange={(value) => updateHos('currentDutyStatus', value)} />
            <TextField name="duty-status-started" label="Current status began" type="datetime-local" required value={draft.hos.currentDutyStatusStartedLocal} onChange={(value) => updateHos('currentDutyStatusStartedLocal', value)} />
            <NumberField name="drive-remaining" label="Drive remaining" unit="minutes" min={0} max={660} value={draft.hos.drivingMinutesRemaining} onChange={(value) => updateHos('drivingMinutesRemaining', numberValue(value))} />
            <NumberField name="shift-remaining" label="Shift remaining" unit="minutes" min={0} max={840} value={draft.hos.shiftMinutesRemaining} onChange={(value) => updateHos('shiftMinutesRemaining', numberValue(value))} />
            <NumberField name="cycle-remaining" label="Cycle remaining" unit="minutes" min={0} max={4_200} value={draft.hos.cycleMinutesRemaining} onChange={(value) => updateHos('cycleMinutesRemaining', numberValue(value))} />
            <SelectField
              name="cycle-type"
              label="Cycle"
              value={draft.hos.cycleType}
              options={[
                { value: 'SIXTY_HOURS_SEVEN_DAYS', label: '60 hours / 7 days' },
                { value: 'SEVENTY_HOURS_EIGHT_DAYS', label: '70 hours / 8 days' },
              ]}
              onChange={(value) => {
                const days = value === 'SEVENTY_HOURS_EIGHT_DAYS' ? 8 : 7;
                update({
                  type: 'hos',
                  value: {
                    ...draft.hos,
                    cycleType: value,
                    priorDutyMinutes: Array.from(
                      { length: days },
                      (_, index) => draft.hos.priorDutyMinutes[index] ?? 0,
                    ),
                    cycleMinutesRemaining: Math.min(
                      draft.hos.cycleMinutesRemaining,
                      value === 'SEVENTY_HOURS_EIGHT_DAYS' ? 4_200 : 3_600,
                    ),
                  },
                });
              }}
            />
            <NumberField name="since-break" label="Driven since qualifying interruption" unit="minutes" min={0} max={660} value={draft.hos.drivenMinutesSinceInterruption} onChange={(value) => updateHos('drivenMinutesSinceInterruption', numberValue(value))} />
            <NumberField name="on-duty-shift" label="On duty this shift" unit="minutes" min={0} max={840} value={draft.hos.onDutyMinutesCurrentShift} onChange={(value) => updateHos('onDutyMinutesCurrentShift', numberValue(value))} />
            <NumberField name="off-duty-before" label="Off duty before departure" unit="minutes" min={0} value={draft.hos.offDutyMinutesBeforeDeparture} onChange={(value) => updateHos('offDutyMinutesBeforeDeparture', numberValue(value))} />
            <NumberField name="carrier-drive-cap" label="Carrier daily drive cap" unit="minutes" min={1} max={660} value={draft.hos.carrierMaxDailyDrivingMinutes} onChange={(value) => updateHos('carrierMaxDailyDrivingMinutes', numberValue(value, 1))} />
            <NumberField name="carrier-duty-cap" label="Carrier duty cap" unit="minutes" min={1} max={840} value={draft.hos.carrierMaxDutyMinutes} onChange={(value) => updateHos('carrierMaxDutyMinutes', numberValue(value, 1))} />
          </div>
          <details className="advanced-block">
            <summary>Prior duty, recap, sleeper, and rule evidence</summary>
            <div className="form-grid">
              {draft.hos.priorDutyMinutes.map((minutes, index) => (
                <NumberField
                  key={index}
                  name={`prior-duty-${String(index)}`}
                  label={`Prior day ${String(index + 1)}`}
                  unit="minutes on duty"
                  min={0}
                  max={1_440}
                  value={minutes}
                  onChange={(value) => {
                    const next = [...draft.hos.priorDutyMinutes];
                    next[index] = numberValue(value);
                    updateHos('priorDutyMinutes', next);
                  }}
                />
              ))}
            </div>
            <div className="check-grid">
              <CheckField name="ten-hour-break" label="Qualifying 10-hour break completed" checked={draft.hos.qualifyingTenHourBreakCompleted} onChange={(value) => updateHos('qualifyingTenHourBreakCompleted', value)} />
              <CheckField name="sleeper-eligible" label="Sleeper berth eligible" checked={draft.hos.sleeperBerthEligible} onChange={(value) => updateHos('sleeperBerthEligible', value)} />
              <CheckField name="split-sleeper" label="Split sleeper selected" checked={draft.hos.splitSleeperEnabled} onChange={(value) => updateHos('splitSleeperEnabled', value)} hint="Selection still requires qualifying sleeper evidence." />
              <CheckField name="restart-planned" label="34-hour restart planned" checked={draft.hos.restart34HourPlanned} onChange={(value) => updateHos('restart34HourPlanned', value)} />
              <CheckField name="adverse-selected" label="Adverse-condition review requested" checked={draft.hos.adverseConditionSelected} onChange={(value) => updateHos('adverseConditionSelected', value)} hint="This does not automatically extend a clock." />
              <CheckField name="night-rest" label="Use nightly rest preference" checked={draft.hos.nightlyRestEnabled} onChange={(value) => updateHos('nightlyRestEnabled', value)} />
            </div>
            {!draft.hos.nightlyRestEnabled ? null : (
              <div className="form-grid">
                <TextField name="night-rest-start" label="Preferred rest begins" type="time" value={draft.hos.nightlyRestStart} onChange={(value) => updateHos('nightlyRestStart', value)} />
                <TextField name="night-rest-end" label="Preferred rest ends" type="time" value={draft.hos.nightlyRestEnd} onChange={(value) => updateHos('nightlyRestEnd', value)} />
              </div>
            )}
            <HosEvidenceEditor
              value={draft.hos}
              onChange={(value) => update({ type: 'hos', value })}
            />
          </details>
        </Section>

        <Section id="step-2" eyebrow="Step 2" title="Tractor and trailer" description="Reusable profiles keep physical measurements explicit. Units are shown beside every number.">
          <div className="profile-columns">
            <div className="subpanel">
              <h3>Tractor</h3>
              <ProfileSelect name="tractor-profile" label="Saved tractor" selectedId={draft.tractor.id} options={profiles.tractors} onSelect={selectTractor} />
              <div className="form-grid">
                <TextField name="tractor-number" label="Unit number" required value={draft.tractor.unitNumber} onChange={(value) => updateTractor('unitNumber', value)} />
                <SelectField name="tractor-type" label="Tractor type" value={draft.tractor.tractorType} options={[
                  { value: 'day-cab', label: 'Day cab' }, { value: 'sleeper', label: 'Sleeper' }, { value: 'cabover', label: 'Cabover' }, { value: 'other', label: 'Other' },
                ]} onChange={(value) => updateTractor('tractorType', value)} />
                <NumberField name="tractor-axles" label="Axles" unit="count" min={1} value={draft.tractor.axleCount} onChange={(value) => updateTractor('axleCount', numberValue(value, 1))} />
                <NumberField name="tractor-length" label="Overall length" unit="feet" min={0.1} step={0.1} value={draft.tractor.overallLengthFeet} onChange={(value) => updateTractor('overallLengthFeet', numberValue(value))} />
                <NumberField name="tractor-height" label="Height" unit="feet" min={0.1} step={0.1} value={draft.tractor.heightFeet} onChange={(value) => updateTractor('heightFeet', numberValue(value))} />
                <NumberField name="tractor-width" label="Width" unit="inches" min={1} value={draft.tractor.widthInches} onChange={(value) => updateTractor('widthInches', numberValue(value))} />
                <NumberField name="tractor-empty-weight" label="Empty weight" unit="lb" min={1} value={draft.tractor.emptyWeightPounds} onChange={(value) => updateTractor('emptyWeightPounds', numberValue(value))} />
                <NumberField name="tractor-registered-weight" label="Registered gross weight" unit="lb" min={1} value={draft.tractor.registeredGrossWeightPounds} onChange={(value) => updateTractor('registeredGrossWeightPounds', numberValue(value))} />
                <NumberField name="tractor-fuel" label="Fuel capacity" unit="US gal" min={1} value={draft.tractor.fuelCapacityGallons} onChange={(value) => updateTractor('fuelCapacityGallons', numberValue(value))} />
                <NumberField name="tractor-range" label="Estimated fuel range" unit="miles" min={1} value={draft.tractor.estimatedFuelRangeMiles} onChange={(value) => updateTractor('estimatedFuelRangeMiles', numberValue(value))} />
                <NumberField name="governed-speed" label="Governed speed" unit="mph" min={1} value={draft.tractor.governedSpeedMph} onChange={(value) => updateTractor('governedSpeedMph', numberValue(value))} />
                <NumberField name="planning-speed" label="Planning speed" unit="mph" min={1} value={draft.tractor.planningSpeedMph} onChange={(value) => updateTractor('planningSpeedMph', numberValue(value))} />
                <NumberField name="fallback-speed" label="Fallback average speed" unit="mph" min={1} value={draft.tractor.fallbackSpeedMph} onChange={(value) => updateTractor('fallbackSpeedMph', numberValue(value))} />
              </div>
              <div className="check-grid">
                <CheckField name="tractor-hazmat" label="Hazmat equipped" checked={draft.tractor.hazmatEquipped} onChange={(value) => updateTractor('hazmatEquipped', value)} />
                <CheckField name="tractor-apu" label="APU available" checked={draft.tractor.apuAvailable} onChange={(value) => updateTractor('apuAvailable', value)} />
                <CheckField name="tractor-idle" label="Idling allowed by entered policy" checked={draft.tractor.idleAllowed} onChange={(value) => updateTractor('idleAllowed', value)} />
              </div>
            </div>
            <div className="subpanel">
              <h3>Trailer</h3>
              <ProfileSelect name="trailer-profile" label="Saved trailer" selectedId={draft.trailer.id} options={profiles.trailers} onSelect={selectTrailer} />
              <div className="form-grid">
                <TextField name="trailer-number" label="Trailer number" required value={draft.trailer.unitNumber} onChange={(value) => updateTrailer('unitNumber', value)} />
                <SelectField name="trailer-type" label="Trailer type" value={draft.trailer.trailerType} options={[
                  { value: 'dry-van', label: 'Dry van' }, { value: 'refrigerated', label: 'Refrigerated' }, { value: 'flatbed', label: 'Flatbed' }, { value: 'similar-general-freight', label: 'Similar general freight' },
                ]} onChange={(value) => updateTrailer('trailerType', value)} />
                <SelectField name="trailer-axle-config" label="Axle configuration" value={draft.trailer.axleConfiguration} options={[
                  { value: 'fixed', label: 'Fixed' }, { value: 'sliding', label: 'Sliding tandem' },
                ]} onChange={(value) => updateTrailer('axleConfiguration', value)} />
                <NumberField name="trailer-axles" label="Axles" unit="count" min={1} value={draft.trailer.axleCount} onChange={(value) => updateTrailer('axleCount', numberValue(value, 1))} />
                <NumberField name="trailer-length" label="Length" unit="feet" min={0.1} step={0.1} value={draft.trailer.lengthFeet} onChange={(value) => updateTrailer('lengthFeet', numberValue(value))} />
                <NumberField name="trailer-height" label="Height" unit="feet" min={0.1} step={0.1} value={draft.trailer.heightFeet} onChange={(value) => updateTrailer('heightFeet', numberValue(value))} />
                <NumberField name="trailer-width" label="Width" unit="inches" min={1} value={draft.trailer.widthInches} onChange={(value) => updateTrailer('widthInches', numberValue(value))} />
                <NumberField name="trailer-kpra" label="Current KPRA" unit="feet" min={0.1} step={0.1} value={draft.trailer.currentKpraFeet} onChange={(value) => updateTrailer('currentKpraFeet', numberValue(value))} />
                <NumberField name="trailer-kpra-min" label="Minimum achievable KPRA" unit="feet" min={0.1} step={0.1} value={draft.trailer.minimumKpraFeet} onChange={(value) => updateTrailer('minimumKpraFeet', numberValue(value))} />
                <NumberField name="trailer-kpra-max" label="Maximum achievable KPRA" unit="feet" min={0.1} step={0.1} value={draft.trailer.maximumKpraFeet} onChange={(value) => updateTrailer('maximumKpraFeet', numberValue(value))} />
                <NumberField name="trailer-empty-weight" label="Empty weight" unit="lb" min={1} value={draft.trailer.emptyWeightPounds} onChange={(value) => updateTrailer('emptyWeightPounds', numberValue(value))} />
                <NumberField name="trailer-payload" label="Maximum payload" unit="lb" min={1} value={draft.trailer.maximumPayloadPounds} onChange={(value) => updateTrailer('maximumPayloadPounds', numberValue(value))} />
              </div>
              <div className="check-grid">
                <CheckField name="trailer-sliding" label="Sliding tandem capability" checked={draft.trailer.slidingTandemCapability} onChange={(value) => updateTrailer('slidingTandemCapability', value)} />
                <CheckField name="trailer-reefer" label="Reefer trailer" checked={draft.trailer.reefer} onChange={(value) => updateTrailer('reefer', value)} />
              </div>
            </div>
          </div>
        </Section>

        <Section id="step-3" eyebrow="Step 3" title="Load and weight evidence" description="Axle weights and dimensions are required for route and compliance review. Unknown permits remain visible as a blocker or confidence reason.">
          <ProfileSelect name="load-profile" label="Saved load" selectedId={draft.load.id} options={profiles.loads} onSelect={selectLoad} />
          <div className="form-grid">
            <TextField name="load-reference" label="Load reference" required value={draft.load.referenceNumber} onChange={(value) => updateLoad('referenceNumber', value)} />
            <TextField name="commodity" label="Commodity" required value={draft.load.commodityDescription} onChange={(value) => updateLoad('commodityDescription', value)} />
            <NumberField name="cargo-weight" label="Cargo weight" unit="lb" min={1} value={draft.load.cargoWeightPounds} onChange={(value) => updateLoad('cargoWeightPounds', numberValue(value))} />
            <NumberField name="steer-weight" label="Steer axle weight" unit="lb" min={1} value={draft.load.steerAxleWeightPounds} onChange={(value) => updateLoad('steerAxleWeightPounds', numberValue(value))} />
            <NumberField name="drive-weight" label="Drive axle weight" unit="lb" min={1} value={draft.load.driveAxleWeightPounds} onChange={(value) => updateLoad('driveAxleWeightPounds', numberValue(value))} />
            <NumberField name="trailer-axle-weight" label="Trailer axle weight" unit="lb" min={1} value={draft.load.trailerAxleWeightPounds} onChange={(value) => updateLoad('trailerAxleWeightPounds', numberValue(value))} />
            <NumberField name="gross-weight" label="Total gross combination weight" unit="lb" min={1} value={draft.load.totalGrossWeightPounds} onChange={(value) => updateLoad('totalGrossWeightPounds', numberValue(value))} />
            <NumberField name="load-length" label="Load length" unit="feet" min={0.1} step={0.1} value={draft.load.lengthFeet} onChange={(value) => updateLoad('lengthFeet', numberValue(value))} />
            <NumberField name="load-height" label="Load height" unit="feet" min={0.1} step={0.1} value={draft.load.heightFeet} onChange={(value) => updateLoad('heightFeet', numberValue(value))} />
            <NumberField name="load-width" label="Load width" unit="feet" min={0.1} step={0.1} value={draft.load.widthFeet} onChange={(value) => updateLoad('widthFeet', numberValue(value))} />
            <SelectField name="permit-requirement" label="Permit requirement" value={draft.load.permitRequirement} options={[
              { value: 'not-required', label: 'Carrier says not required' }, { value: 'required', label: 'Required' }, { value: 'unknown', label: 'Unknown, verify' },
            ]} onChange={(value) => updateLoad('permitRequirement', value)} />
            <TextField name="permit-identifiers" label="Permit identifiers" value={draft.load.permitIdentifiers.join(', ')} onChange={(value) => updateLoad('permitIdentifiers', value.split(',').map((item) => item.trim()).filter(Boolean))} hint="Separate multiple permit identifiers with commas." />
          </div>
          <div className="check-grid">
            <CheckField name="load-hazmat" label="Hazardous material" checked={draft.load.hazmat} onChange={(value) => updateLoad('hazmat', value)} />
          </div>
          {!draft.load.hazmat ? null : <TextField name="hazmat-class" label="Hazmat class" required value={draft.load.hazmatClass} onChange={(value) => updateLoad('hazmatClass', value)} />}
        </Section>

        <Section
          id="step-4"
          eyebrow="Step 4"
          title="Ordered stops"
          description="The first and final positions are structural. Intermediate stops may be required, optional, locked, duplicated, inserted, or reordered."
          actions={
            <div className="add-stop-controls">
              <SelectField name="new-stop-type" label="New stop type" value={newStopType} options={newStopTypeOptions} onChange={setNewStopType} />
              <button type="button" onClick={() => {
                applyStopAction(
                  { type: 'add-stop', stopType: newStopType },
                  `Added a ${newStopType.replaceAll('-', ' ')} stop before the final consignee.`,
                  draft.stops.length - 1,
                );
              }}>Add stop</button>
            </div>
          }
        >
          <p className="visually-hidden" aria-live="polite">{stopAnnouncement}</p>
          <div className="stop-list">
            {draft.stops.map((stop, index) => (
              <StopCard
                key={stop.localId}
                stop={stop}
                index={index}
                count={draft.stops.length}
                onChange={(value) => update({ type: 'stop', stop: value })}
                onRemove={() => {
                  applyStopAction(
                    { type: 'remove-stop', localId: stop.localId },
                    `Removed stop ${String(index + 1)}.`,
                  );
                }}
                onDuplicate={() => {
                  applyStopAction(
                    { type: 'duplicate-stop', localId: stop.localId },
                    `Duplicated stop ${String(index + 1)}.`,
                    index + 1,
                  );
                }}
                onInsertAfter={() => {
                  applyStopAction(
                    { type: 'insert-stop', afterLocalId: stop.localId },
                    `Inserted a new stop after stop ${String(index + 1)}.`,
                    index + 1,
                  );
                }}
                onMove={(direction) => {
                  applyStopAction(
                    { type: 'move-stop', localId: stop.localId, direction },
                    `Moved stop ${String(index + 1)} ${direction < 0 ? 'earlier' : 'later'}.`,
                  );
                }}
                onDropStop={moveStopTo}
              />
            ))}
          </div>
        </Section>

        <Section id="review" eyebrow="Review" title="Validation and calculation" description="Calculation is explicit by default. Optional immediate recalculation waits for changes to settle, aborts superseded requests, and never runs while required input is invalid.">
          <div className="form-grid">
            <TextField name="rule-set-version" label="Regulatory rule-set version" required value={draft.route.ruleSetVersion} onChange={(value) => updateRoute('ruleSetVersion', value)} hint="Use a reviewed, active rule-set version supplied by the carrier or compliance administrator." />
            <SelectField name="route-policy" label="Commercial route policy" value={draft.route.policy} options={[
              { value: 'fastest-compliant', label: 'Fastest compliant' }, { value: 'shortest-compliant', label: 'Shortest compliant' }, { value: 'balanced-compliant', label: 'Balanced compliant' },
            ]} onChange={(value) => updateRoute('policy', value)} />
          </div>
          <div className="check-grid">
            <CheckField name="avoid-tolls" label="Avoid tolls where compliant" checked={draft.route.avoidTolls} onChange={(value) => updateRoute('avoidTolls', value)} />
            <CheckField name="avoid-ferries" label="Avoid ferries" checked={draft.route.avoidFerries} onChange={(value) => updateRoute('avoidFerries', value)} />
            <CheckField name="avoid-tunnels" label="Avoid tunnels" checked={draft.route.avoidTunnels} onChange={(value) => updateRoute('avoidTunnels', value)} />
            <CheckField name="auto-calculate" label="Recalculate after valid changes settle" checked={draft.route.autoCalculate} onChange={(value) => updateRoute('autoCalculate', value)} hint="Requires a connected authenticated account. Changes are debounced for 1.2 seconds and superseded requests are aborted." />
          </div>

          <div className="validation-summary" ref={validationSummary} tabIndex={-1} aria-labelledby="validation-title">
            <h3 id="validation-title">Setup review</h3>
            {issues.length === 0 ? <p className="empty-state">No local validation issues remain.</p> : (
              <ul>
                {issues.map((issue, index) => (
                  <li className={issueClass(issue)} key={`${issue.path}-${String(index)}`}>
                    <strong>{issue.severity}</strong>
                    <span>{issue.message}</span>
                    <code>{issue.path}</code>
                  </li>
                ))}
              </ul>
            )}
            {warnings.length === 0 ? null : <p className="panel__description">Warnings and missing-evidence reasons remain visible after submission.</p>}
          </div>

          <div className={`outcome outcome--${outcome.status}`} role="status" aria-live="polite">
            <strong>{outcome.message}</strong>
            {outcome.tripId === undefined ? null : <span>Trip {outcome.tripId}</span>}
            {outcome.revisionNumber === undefined ? null : <span>Revision {String(outcome.revisionNumber)}</span>}
            {outcome.confidence === undefined ? null : <span>Confidence {outcome.confidence}</span>}
            {outcome.warnings.length === 0 ? null : (
              <ul>{outcome.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            )}
          </div>
          <div className="button-row button-row--primary">
            <button type="button" className="button--large" disabled={outcome.status === 'submitting'} onClick={() => void submit(false)}>
              {outcome.status === 'submitting' ? 'Saving and validating…' : 'Save and calculate trip'}
            </button>
            <button type="button" className="button--quiet" onClick={() => {
              abortRef.current?.abort();
              const fresh = defaultTripDraft();
              dispatch({ type: 'replace', draft: fresh });
              clearDraft();
              setOutcome(idleOutcome);
              setDirty(false);
              setNeedsCalculation(false);
              setStopAnnouncement('Started a new local trip draft.');
            }}>Start a new draft</button>
          </div>
        </Section>
      </main>

      <footer>
        <p>Planning aid only. The driver, carrier, safety department, permit office, and official authorities remain responsible for legal operation.</p>
      </footer>
    </div>
  );
}

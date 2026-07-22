import type {
  ChangeEvent,
  DragEvent,
  ReactNode,
} from 'react';

import type {
  DutyStatus,
  ProfileOption,
  StopForm,
  StopType,
} from './types.js';

function fieldId(name: string): string {
  return `field-${name.replace(/[^a-z0-9]+/giu, '-')}`;
}

export function Section(props: {
  readonly id: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}): ReactNode {
  return (
    <section className="panel" id={props.id} aria-labelledby={`${props.id}-title`}>
      <header className="panel__header">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <h2 id={`${props.id}-title`}>{props.title}</h2>
          <p className="panel__description">{props.description}</p>
        </div>
        {props.actions === undefined ? null : (
          <div className="panel__actions">{props.actions}</div>
        )}
      </header>
      {props.children}
    </section>
  );
}

export function TextField(props: {
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly type?: 'text' | 'datetime-local' | 'time' | 'password' | 'url';
  readonly hint?: string;
  readonly autoComplete?: string;
}): ReactNode {
  const id = fieldId(props.name);
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {props.label}
        {props.required === true ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        id={id}
        name={props.name}
        type={props.type ?? 'text'}
        value={props.value}
        required={props.required}
        disabled={props.disabled}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      />
      {props.hint === undefined ? null : (
        <span className="field__hint">{props.hint}</span>
      )}
    </label>
  );
}

export function NumberField(props: {
  readonly name: string;
  readonly label: string;
  readonly value: number | null;
  readonly unit: string;
  readonly onChange: (value: number | null) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly hint?: string;
}): ReactNode {
  const id = fieldId(props.name);
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {props.label}
        {props.required === true ? <span aria-hidden="true"> *</span> : null}
      </span>
      <span className="measurement">
        <input
          id={id}
          name={props.name}
          type="number"
          inputMode="decimal"
          value={props.value ?? ''}
          required={props.required}
          disabled={props.disabled}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            props.onChange(raw === '' ? null : Number(raw));
          }}
        />
        <span aria-hidden="true">{props.unit}</span>
      </span>
      {props.hint === undefined ? null : (
        <span className="field__hint">{props.hint}</span>
      )}
    </label>
  );
}

export function SelectField<T extends string>(props: {
  readonly name: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly Readonly<{ value: T; label: string }>[];
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
  readonly hint?: string;
}): ReactNode {
  const id = fieldId(props.name);
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{props.label}</span>
      <select
        id={id}
        name={props.name}
        value={props.value}
        disabled={props.disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          props.onChange(event.currentTarget.value as T)
        }
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.hint === undefined ? null : (
        <span className="field__hint">{props.hint}</span>
      )}
    </label>
  );
}

export function CheckField(props: {
  readonly name: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly hint?: string;
}): ReactNode {
  const id = fieldId(props.name);
  return (
    <label className="check-field" htmlFor={id}>
      <input
        id={id}
        name={props.name}
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      <span>
        <strong>{props.label}</strong>
        {props.hint === undefined ? null : <small>{props.hint}</small>}
      </span>
    </label>
  );
}

export function ProfileSelect(props: {
  readonly name: string;
  readonly label: string;
  readonly selectedId?: string | undefined;
  readonly options: readonly ProfileOption[];
  readonly onSelect: (id: string | undefined) => void;
}): ReactNode {
  const id = fieldId(props.name);
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{props.label}</span>
      <select
        id={id}
        value={props.selectedId ?? ''}
        onChange={(event) =>
          props.onSelect(
            event.currentTarget.value === ''
              ? undefined
              : event.currentTarget.value,
          )
        }
      >
        <option value="">Create a new profile</option>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const dutyOptions: readonly Readonly<{
  value: DutyStatus;
  label: string;
}>[] = [
  { value: 'OFF_DUTY', label: 'Off duty' },
  { value: 'SLEEPER_BERTH', label: 'Sleeper berth' },
  { value: 'DRIVING', label: 'Driving' },
  { value: 'ON_DUTY_NOT_DRIVING', label: 'On duty, not driving' },
];

const stopTypeOptions: readonly Readonly<{
  value: StopType;
  label: string;
}>[] = [
  { value: 'start-location', label: 'Start location' },
  { value: 'tractor-pickup', label: 'Tractor pickup' },
  { value: 'trailer-pickup', label: 'Trailer pickup' },
  { value: 'shipper', label: 'Shipper' },
  { value: 'intermediate-pickup', label: 'Intermediate pickup' },
  { value: 'intermediate-delivery', label: 'Intermediate delivery' },
  { value: 'final-consignee', label: 'Final consignee' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'scale', label: 'Scale' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'food', label: 'Food' },
  { value: 'driver-break', label: 'Driver break' },
  { value: 'sleeper-rest', label: 'Sleeper rest' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'border-crossing', label: 'Border crossing' },
  { value: 'other', label: 'Other' },
];

export function StopCard(props: {
  readonly stop: StopForm;
  readonly index: number;
  readonly count: number;
  readonly onChange: (stop: StopForm) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onInsertAfter: () => void;
  readonly onMove: (direction: -1 | 1) => void;
  readonly onDropStop: (sourceId: string, targetId: string) => void;
}): ReactNode {
  const stop = props.stop;
  const structuralEndpoint = props.index === 0 || props.index === props.count - 1;
  const patch = <Key extends keyof StopForm>(
    key: Key,
    value: StopForm[Key],
  ): void => props.onChange({ ...stop, [key]: value });
  const canMoveUp = props.index > 1 && !stop.lockedPosition;
  const canMoveDown = props.index < props.count - 2 && !stop.lockedPosition;

  const onDragStart = (event: DragEvent<HTMLElement>): void => {
    event.dataTransfer.setData('text/trip-stop-id', stop.localId);
    event.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/trip-stop-id');
    if (sourceId !== '' && sourceId !== stop.localId) {
      props.onDropStop(sourceId, stop.localId);
    }
  };

  const needsAppointmentStart = stop.appointmentMode !== 'none';
  const needsAppointmentEnd =
    stop.appointmentMode === 'window' || stop.appointmentMode === 'open-window';
  const needsLateTolerance =
    stop.appointmentMode === 'latest' ||
    stop.appointmentMode === 'fixed' ||
    needsAppointmentEnd;

  return (
    <article
      className="stop-card"
      data-stop-id={stop.localId}
      draggable={!stop.lockedPosition}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      aria-labelledby={`${stop.localId}-title`}
    >
      <header className="stop-card__header">
        <div className="stop-sequence" aria-label={`Stop ${String(props.index + 1)}`}>
          {String(props.index + 1).padStart(2, '0')}
        </div>
        <div>
          <h3 id={`${stop.localId}-title`}>
            {stop.locationDescription.trim() === ''
              ? stopTypeOptions.find((option) => option.value === stop.type)?.label
              : stop.locationDescription}
          </h3>
          <p>
            {stop.lockedPosition
              ? 'Position locked'
              : 'Drag this card or use the move buttons'}
            {stop.required ? ' · Required' : ' · Optional'}
          </p>
        </div>
        <div className="stop-card__controls">
          <button
            type="button"
            className="icon-button"
            disabled={!canMoveUp}
            onClick={() => props.onMove(-1)}
            aria-label={`Move stop ${String(props.index + 1)} earlier`}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!canMoveDown}
            onClick={() => props.onMove(1)}
            aria-label={`Move stop ${String(props.index + 1)} later`}
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={structuralEndpoint || stop.lockedPosition}
            onClick={props.onDuplicate}
            aria-label={`Duplicate stop ${String(props.index + 1)}`}
          >
            ⧉
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={props.index === props.count - 1}
            onClick={props.onInsertAfter}
            aria-label={`Insert stop after stop ${String(props.index + 1)}`}
          >
            +
          </button>
          <button
            type="button"
            className="icon-button icon-button--danger"
            disabled={stop.lockedPosition}
            onClick={props.onRemove}
            aria-label={`Remove stop ${String(props.index + 1)}`}
          >
            ×
          </button>
        </div>
      </header>

      <div className="check-grid">
        <CheckField
          name={`${stop.localId}-required`}
          label="Required stop"
          checked={stop.required}
          disabled={structuralEndpoint}
          onChange={(value) => patch('required', value)}
          hint="Optional stops remain in the plan but may be skipped by later operational decisions."
        />
        <CheckField
          name={`${stop.localId}-locked`}
          label="Lock this position"
          checked={stop.lockedPosition}
          disabled={structuralEndpoint}
          onChange={(value) => patch('lockedPosition', value)}
          hint="Locked stops cannot be moved or removed."
        />
      </div>

      <div className="form-grid">
        <SelectField
          name={`${stop.localId}-type`}
          label="Stop type"
          value={stop.type}
          options={stopTypeOptions}
          disabled={structuralEndpoint}
          onChange={(value) => patch('type', value)}
        />
        <TextField
          name={`${stop.localId}-location`}
          label="Location name"
          required
          value={stop.locationDescription}
          onChange={(value) => patch('locationDescription', value)}
        />
        <TextField
          name={`${stop.localId}-address`}
          label="Street address or facility note"
          value={stop.addressText}
          onChange={(value) => patch('addressText', value)}
        />
        <TextField
          name={`${stop.localId}-timezone`}
          label="IANA time zone"
          required
          value={stop.timeZone}
          placeholder="America/Los_Angeles"
          onChange={(value) => patch('timeZone', value)}
        />
        <NumberField
          name={`${stop.localId}-latitude`}
          label="Latitude"
          required
          unit="degrees"
          step={0.000001}
          min={-90}
          max={90}
          value={stop.latitude}
          onChange={(value) => patch('latitude', value)}
          hint="User-confirmed coordinates are required until a licensed geocoder is configured."
        />
        <NumberField
          name={`${stop.localId}-longitude`}
          label="Longitude"
          required
          unit="degrees"
          step={0.000001}
          min={-180}
          max={180}
          value={stop.longitude}
          onChange={(value) => patch('longitude', value)}
        />
        <SelectField
          name={`${stop.localId}-appointment-mode`}
          label="Appointment"
          value={stop.appointmentMode}
          options={[
            { value: 'none', label: 'No appointment' },
            { value: 'earliest', label: 'Earliest appointment' },
            { value: 'latest', label: 'Latest appointment' },
            { value: 'fixed', label: 'Fixed appointment' },
            { value: 'window', label: 'Appointment window' },
            { value: 'open-window', label: 'Open appointment window' },
          ]}
          onChange={(value) => patch('appointmentMode', value)}
        />
        {!needsAppointmentStart ? null : (
          <TextField
            name={`${stop.localId}-appointment-start`}
            label={
              stop.appointmentMode === 'fixed'
                ? 'Appointment time'
                : needsAppointmentEnd
                  ? 'Window opens'
                  : stop.appointmentMode === 'earliest'
                    ? 'Earliest service time'
                    : 'Latest service time'
            }
            type="datetime-local"
            required
            value={stop.appointmentStartLocal}
            onChange={(value) => patch('appointmentStartLocal', value)}
          />
        )}
        {!needsAppointmentEnd ? null : (
          <TextField
            name={`${stop.localId}-appointment-end`}
            label="Window closes"
            type="datetime-local"
            required
            value={stop.appointmentEndLocal}
            onChange={(value) => patch('appointmentEndLocal', value)}
          />
        )}
        {!needsLateTolerance ? null : (
          <NumberField
            name={`${stop.localId}-late-tolerance`}
            label="Late tolerance"
            unit="minutes"
            min={0}
            value={stop.lateToleranceMinutes}
            onChange={(value) => patch('lateToleranceMinutes', value ?? 0)}
          />
        )}
        <NumberField
          name={`${stop.localId}-check-in`}
          label="Check-in duration"
          unit="minutes"
          min={0}
          value={stop.checkInMinutes}
          onChange={(value) => patch('checkInMinutes', value ?? 0)}
        />
        <SelectField
          name={`${stop.localId}-service-mode`}
          label="Service duration source"
          value={stop.serviceMode}
          options={[
            { value: 'exact', label: 'Exact duration' },
            { value: 'expected', label: 'Expected duration' },
            { value: 'range', label: 'Minimum / expected / maximum' },
            { value: 'historical-average', label: 'Historical facility average' },
          ]}
          onChange={(value) => patch('serviceMode', value)}
        />
        {stop.serviceMode !== 'range' ? null : (
          <NumberField
            name={`${stop.localId}-service-minimum`}
            label="Minimum service"
            unit="minutes"
            min={0}
            value={stop.serviceMinimumMinutes}
            onChange={(value) => patch('serviceMinimumMinutes', value ?? 0)}
          />
        )}
        <NumberField
          name={`${stop.localId}-service`}
          label={
            stop.serviceMode === 'range'
              ? 'Expected service'
              : stop.serviceMode === 'historical-average'
                ? 'Historical average'
                : stop.serviceMode === 'exact'
                  ? 'Exact service'
                  : 'Expected service'
          }
          unit="minutes"
          min={0}
          value={stop.serviceMinutes}
          onChange={(value) => patch('serviceMinutes', value ?? 0)}
        />
        {stop.serviceMode !== 'range' ? null : (
          <NumberField
            name={`${stop.localId}-service-maximum`}
            label="Maximum service"
            unit="minutes"
            min={0}
            value={stop.serviceMaximumMinutes}
            onChange={(value) => patch('serviceMaximumMinutes', value ?? 0)}
          />
        )}
        {stop.serviceMode !== 'historical-average' ? null : (
          <>
            <TextField
              name={`${stop.localId}-historical-source`}
              label="Historical source"
              required
              value={stop.historicalSourceName}
              onChange={(value) => patch('historicalSourceName', value)}
            />
            <NumberField
              name={`${stop.localId}-historical-sample`}
              label="Historical sample size"
              unit="visits"
              min={1}
              value={stop.historicalSampleSize}
              onChange={(value) => patch('historicalSampleSize', value)}
            />
          </>
        )}
        <SelectField
          name={`${stop.localId}-waiting-duty`}
          label="Waiting duty status"
          value={stop.waitingDutyStatus}
          options={dutyOptions}
          onChange={(value) => patch('waitingDutyStatus', value)}
        />
        <SelectField
          name={`${stop.localId}-checkin-duty`}
          label="Check-in duty status"
          value={stop.checkInDutyStatus}
          options={dutyOptions}
          onChange={(value) => patch('checkInDutyStatus', value)}
        />
        <SelectField
          name={`${stop.localId}-service-duty`}
          label="Service duty status"
          value={stop.serviceDutyStatus}
          options={dutyOptions}
          onChange={(value) => patch('serviceDutyStatus', value)}
        />
        <TextField
          name={`${stop.localId}-facility-open`}
          label="Facility hours open"
          type="datetime-local"
          value={stop.facilityOpenLocal}
          onChange={(value) => patch('facilityOpenLocal', value)}
        />
        <TextField
          name={`${stop.localId}-facility-close`}
          label="Facility hours close"
          type="datetime-local"
          value={stop.facilityCloseLocal}
          onChange={(value) => patch('facilityCloseLocal', value)}
        />
      </div>
      <div className="check-grid">
        <CheckField
          name={`${stop.localId}-early-parking`}
          label="Early parking allowed"
          checked={stop.earlyParkingAllowed}
          onChange={(value) => patch('earlyParkingAllowed', value)}
        />
        <CheckField
          name={`${stop.localId}-overnight-parking`}
          label="Overnight parking allowed"
          checked={stop.overnightParkingAllowed}
          onChange={(value) => patch('overnightParkingAllowed', value)}
        />
      </div>
      <div className="form-grid">
        <TextField
          name={`${stop.localId}-notes`}
          label="Notes"
          value={stop.notes}
          onChange={(value) => patch('notes', value)}
        />
        <TextField
          name={`${stop.localId}-instructions`}
          label="Driver instructions"
          value={stop.instructions}
          onChange={(value) => patch('instructions', value)}
        />
      </div>
    </article>
  );
}

export const dutyStatusOptions = dutyOptions;
export const newStopTypeOptions = stopTypeOptions.filter(
  (option) =>
    option.value !== 'start-location' && option.value !== 'final-consignee',
);

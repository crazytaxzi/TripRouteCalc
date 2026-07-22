import type { ReactNode } from 'react';

import {
  CheckField,
  NumberField,
  SelectField,
  TextField,
} from './form-components.js';
import {
  createLoadPermitForm,
  createTrailerRailPositionMappingForm,
} from './equipment-details.js';
import type {
  CaliforniaComplianceStatus,
  LoadForm,
  LoadPermitForm,
  SecureParkingRequirement,
  TrailerForm,
  TrailerRailPositionMappingForm,
  TractorForm,
} from './types.js';

const californiaOptions: readonly Readonly<{
  value: CaliforniaComplianceStatus;
  label: string;
}>[] = [
  { value: 'not-evaluated', label: 'Not evaluated' },
  {
    value: 'carrier-asserted-compliant',
    label: 'Carrier asserted compliant',
  },
  {
    value: 'carrier-asserted-noncompliant',
    label: 'Carrier asserted noncompliant',
  },
  {
    value: 'manual-verification-required',
    label: 'Manual verification required',
  },
];

const secureParkingOptions: readonly Readonly<{
  value: SecureParkingRequirement;
  label: string;
}>[] = [
  { value: 'none', label: 'No special parking requirement' },
  { value: 'high-value', label: 'High-value controls' },
  { value: 'secure-parking', label: 'Secure parking required' },
  {
    value: 'high-value-and-secure-parking',
    label: 'High-value and secure parking',
  },
];

function numberValue(value: number | null): number {
  return value ?? 0;
}

function optionalNumber(value: number | null): number | null {
  return value;
}

function commaList(value: string): readonly string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function PermitEditor(props: {
  readonly permit: LoadPermitForm;
  readonly index: number;
  readonly onChange: (permit: LoadPermitForm) => void;
  readonly onRemove: () => void;
}): ReactNode {
  return (
    <div
      className="advanced-block"
      role="group"
      aria-labelledby={`permit-${props.permit.localId}-title`}
    >
      <h4 id={`permit-${props.permit.localId}-title`}>
        Permit {String(props.index + 1)}
      </h4>
      <div className="form-grid">
        <TextField
          name={`permit-${props.permit.localId}-identifier`}
          label="Permit identifier"
          required
          value={props.permit.identifier}
          onChange={(identifier) =>
            props.onChange({ ...props.permit, identifier })
          }
        />
        <TextField
          name={`permit-${props.permit.localId}-jurisdiction`}
          label="Jurisdiction code"
          value={props.permit.jurisdictionCode}
          onChange={(jurisdictionCode) =>
            props.onChange({ ...props.permit, jurisdictionCode })
          }
        />
        <TextField
          name={`permit-${props.permit.localId}-restrictions`}
          label="Permit restrictions"
          value={props.permit.restrictions.join(', ')}
          onChange={(value) =>
            props.onChange({
              ...props.permit,
              restrictions: commaList(value),
            })
          }
          hint="Separate restrictions with commas."
        />
      </div>
      <button type="button" className="button--quiet" onClick={props.onRemove}>
        Remove permit {String(props.index + 1)}
      </button>
    </div>
  );
}

function RailMappingEditor(props: {
  readonly mapping: TrailerRailPositionMappingForm;
  readonly index: number;
  readonly onChange: (mapping: TrailerRailPositionMappingForm) => void;
  readonly onRemove: () => void;
}): ReactNode {
  return (
    <div
      className="advanced-block"
      role="group"
      aria-labelledby={`rail-${props.mapping.localId}-title`}
    >
      <h4 id={`rail-${props.mapping.localId}-title`}>
        Rail mapping {String(props.index + 1)}
      </h4>
      <div className="form-grid">
        <TextField
          name={`rail-${props.mapping.localId}-position`}
          label="Rail position"
          required
          value={props.mapping.railPosition}
          onChange={(railPosition) =>
            props.onChange({ ...props.mapping, railPosition })
          }
        />
        <NumberField
          name={`rail-${props.mapping.localId}-kpra`}
          label="Mapped KPRA"
          unit="feet"
          min={0.1}
          step={0.1}
          required
          value={props.mapping.kpraFeet}
          onChange={(value) =>
            props.onChange({ ...props.mapping, kpraFeet: numberValue(value) })
          }
        />
        <TextField
          name={`rail-${props.mapping.localId}-source`}
          label="Verification source"
          required
          value={props.mapping.verificationSource}
          onChange={(verificationSource) =>
            props.onChange({ ...props.mapping, verificationSource })
          }
        />
        <TextField
          name={`rail-${props.mapping.localId}-verified-at`}
          label="Verified UTC timestamp"
          required
          value={props.mapping.verifiedAt}
          placeholder="2026-07-21T18:00:00Z"
          onChange={(verifiedAt) =>
            props.onChange({ ...props.mapping, verifiedAt })
          }
        />
        <TextField
          name={`rail-${props.mapping.localId}-explanation`}
          label="Mapping explanation"
          value={props.mapping.explanation}
          onChange={(explanation) =>
            props.onChange({ ...props.mapping, explanation })
          }
        />
      </div>
      <button type="button" className="button--quiet" onClick={props.onRemove}>
        Remove rail mapping {String(props.index + 1)}
      </button>
    </div>
  );
}

export function EquipmentDetailEditor(props: {
  readonly tractor: TractorForm;
  readonly trailer: TrailerForm;
  readonly load: LoadForm;
  readonly onTractorChange: (tractor: TractorForm) => void;
  readonly onTrailerChange: (trailer: TrailerForm) => void;
  readonly onLoadChange: (load: LoadForm) => void;
}): ReactNode {
  const railMappings = props.trailer.railPositionMappings ?? [];
  const permits =
    props.load.permits ??
    props.load.permitIdentifiers.map((identifierValue) =>
      createLoadPermitForm(identifierValue),
    );
  const updatePermits = (next: readonly LoadPermitForm[]): void => {
    props.onLoadChange({
      ...props.load,
      permits: next,
      permitIdentifiers: next
        .map((permit) => permit.identifier.trim())
        .filter(Boolean),
    });
  };

  return (
    <details className="advanced-block">
      <summary>Advanced equipment, permit, and cargo evidence</summary>
      <div className="profile-columns">
        <section className="subpanel" aria-labelledby="tractor-details-title">
          <h3 id="tractor-details-title">Tractor details</h3>
          <div className="form-grid">
            <TextField
              name="tractor-vin"
              label="VIN"
              value={props.tractor.vin ?? ''}
              onChange={(vin) =>
                props.onTractorChange({ ...props.tractor, vin })
              }
            />
            <NumberField
              name="tractor-wheelbase"
              label="Wheelbase"
              unit="feet"
              min={0}
              step={0.1}
              value={props.tractor.wheelbaseFeet ?? 0}
              onChange={(value) =>
                props.onTractorChange({
                  ...props.tractor,
                  wheelbaseFeet: numberValue(value),
                })
              }
            />
            <SelectField
              name="california-compliance-status"
              label="California compliance status"
              value={
                props.tractor.californiaComplianceStatus ?? 'not-evaluated'
              }
              options={californiaOptions}
              onChange={(californiaComplianceStatus) =>
                props.onTractorChange({
                  ...props.tractor,
                  californiaComplianceStatus,
                })
              }
            />
            <TextField
              name="california-compliance-source"
              label="Compliance evidence source"
              value={props.tractor.californiaComplianceSourceName ?? ''}
              onChange={(californiaComplianceSourceName) =>
                props.onTractorChange({
                  ...props.tractor,
                  californiaComplianceSourceName,
                })
              }
            />
            <TextField
              name="california-compliance-verified-at"
              label="Compliance verified UTC timestamp"
              value={props.tractor.californiaComplianceVerifiedAt ?? ''}
              placeholder="2026-07-21T18:00:00Z"
              onChange={(californiaComplianceVerifiedAt) =>
                props.onTractorChange({
                  ...props.tractor,
                  californiaComplianceVerifiedAt,
                })
              }
            />
            <TextField
              name="california-compliance-explanation"
              label="Compliance explanation"
              value={props.tractor.californiaComplianceExplanation ?? ''}
              onChange={(californiaComplianceExplanation) =>
                props.onTractorChange({
                  ...props.tractor,
                  californiaComplianceExplanation,
                })
              }
            />
            <TextField
              name="tractor-notes"
              label="Tractor notes"
              value={props.tractor.notes ?? ''}
              onChange={(notes) =>
                props.onTractorChange({ ...props.tractor, notes })
              }
            />
          </div>
        </section>

        <section className="subpanel" aria-labelledby="trailer-details-title">
          <div className="button-row">
            <div>
              <h3 id="trailer-details-title">Trailer details</h3>
              <p className="panel__description">
                Rail mappings require an explicit source and UTC verification time.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                props.onTrailerChange({
                  ...props.trailer,
                  railPositionMappings: [
                    ...railMappings,
                    createTrailerRailPositionMappingForm(),
                  ],
                })
              }
            >
              Add rail mapping
            </button>
          </div>
          <div className="form-grid">
            <TextField
              name="trailer-current-rail-position"
              label="Current rail position"
              value={props.trailer.currentRailPosition ?? ''}
              onChange={(currentRailPosition) =>
                props.onTrailerChange({
                  ...props.trailer,
                  currentRailPosition,
                })
              }
            />
            <TextField
              name="trailer-special-equipment"
              label="Special equipment"
              value={(props.trailer.specialEquipment ?? []).join(', ')}
              onChange={(value) =>
                props.onTrailerChange({
                  ...props.trailer,
                  specialEquipment: commaList(value),
                })
              }
              hint="Separate equipment names with commas."
            />
            <TextField
              name="trailer-notes"
              label="Trailer notes"
              value={props.trailer.notes ?? ''}
              onChange={(notes) =>
                props.onTrailerChange({ ...props.trailer, notes })
              }
            />
          </div>
          <CheckField
            name="trailer-liftgate"
            label="Liftgate installed"
            checked={props.trailer.liftgate ?? false}
            onChange={(liftgate) =>
              props.onTrailerChange({ ...props.trailer, liftgate })
            }
          />
          {railMappings.length === 0 ? (
            <p className="empty-state">No rail mappings entered.</p>
          ) : (
            railMappings.map((mapping, index) => (
              <RailMappingEditor
                key={mapping.localId}
                mapping={mapping}
                index={index}
                onChange={(updated) =>
                  props.onTrailerChange({
                    ...props.trailer,
                    railPositionMappings: railMappings.map((candidate) =>
                      candidate.localId === updated.localId
                        ? updated
                        : candidate,
                    ),
                  })
                }
                onRemove={() =>
                  props.onTrailerChange({
                    ...props.trailer,
                    railPositionMappings: railMappings.filter(
                      (candidate) => candidate.localId !== mapping.localId,
                    ),
                  })
                }
              />
            ))
          )}
        </section>
      </div>

      <section className="subpanel" aria-labelledby="load-details-title">
        <div className="button-row">
          <div>
            <h3 id="load-details-title">Load, permit, and parking details</h3>
            <p className="panel__description">
              Unknown or incomplete permit and temperature evidence remains a blocker or confidence reason.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              updatePermits([...permits, createLoadPermitForm()])
            }
          >
            Add permit
          </button>
        </div>
        <div className="form-grid">
          <NumberField
            name="load-front-overhang"
            label="Front overhang"
            unit="feet"
            min={0}
            step={0.1}
            value={props.load.frontOverhangFeet ?? 0}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                frontOverhangFeet: numberValue(value),
              })
            }
          />
          <NumberField
            name="load-rear-overhang"
            label="Rear overhang"
            unit="feet"
            min={0}
            step={0.1}
            value={props.load.rearOverhangFeet ?? 0}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                rearOverhangFeet: numberValue(value),
              })
            }
          />
          <NumberField
            name="temperature-minimum"
            label="Minimum temperature"
            unit="°F"
            value={props.load.temperatureMinimumFahrenheit ?? null}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                temperatureMinimumFahrenheit: optionalNumber(value),
              })
            }
          />
          <NumberField
            name="temperature-maximum"
            label="Maximum temperature"
            unit="°F"
            value={props.load.temperatureMaximumFahrenheit ?? null}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                temperatureMaximumFahrenheit: optionalNumber(value),
              })
            }
          />
          <NumberField
            name="temperature-set-point"
            label="Temperature set point"
            unit="°F"
            value={props.load.temperatureSetPointFahrenheit ?? null}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                temperatureSetPointFahrenheit: optionalNumber(value),
              })
            }
          />
          <TextField
            name="temperature-explanation"
            label="Temperature explanation"
            value={props.load.temperatureExplanation ?? ''}
            onChange={(temperatureExplanation) =>
              props.onLoadChange({
                ...props.load,
                temperatureExplanation,
              })
            }
          />
          <TextField
            name="escort-requirements"
            label="Escort requirements"
            value={(props.load.escortRequirements ?? []).join(', ')}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                escortRequirements: commaList(value),
              })
            }
            hint="Separate requirements with commas."
          />
          <TextField
            name="route-restrictions"
            label="Route restrictions"
            value={(props.load.routeRestrictions ?? []).join(', ')}
            onChange={(value) =>
              props.onLoadChange({
                ...props.load,
                routeRestrictions: commaList(value),
              })
            }
            hint="Separate restrictions with commas."
          />
          <SelectField
            name="secure-parking-requirement"
            label="Secure parking requirement"
            value={props.load.secureParkingRequirement ?? 'none'}
            options={secureParkingOptions}
            onChange={(secureParkingRequirement) =>
              props.onLoadChange({
                ...props.load,
                secureParkingRequirement,
              })
            }
          />
          <TextField
            name="load-notes"
            label="Load notes"
            value={props.load.notes ?? ''}
            onChange={(notes) =>
              props.onLoadChange({ ...props.load, notes })
            }
          />
        </div>
        <CheckField
          name="temperature-reefer-required"
          label="Reefer temperature control required"
          checked={props.load.temperatureReeferRequired ?? false}
          onChange={(temperatureReeferRequired) =>
            props.onLoadChange({
              ...props.load,
              temperatureReeferRequired,
            })
          }
        />
        {permits.length === 0 ? (
          <p className="empty-state">No permit records entered.</p>
        ) : (
          permits.map((permit, index) => (
            <PermitEditor
              key={permit.localId}
              permit={permit}
              index={index}
              onChange={(updated) =>
                updatePermits(
                  permits.map((candidate) =>
                    candidate.localId === updated.localId
                      ? updated
                      : candidate,
                  ),
                )
              }
              onRemove={() =>
                updatePermits(
                  permits.filter(
                    (candidate) => candidate.localId !== permit.localId,
                  ),
                )
              }
            />
          ))
        )}
      </section>
    </details>
  );
}

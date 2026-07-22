import type { ReactNode } from 'react';

import { NumberField, SelectField, TextField } from './form-components.js';
import {
  createCycleRecapReturnForm,
  createSleeperPeriodForm,
} from './hos-evidence.js';
import type {
  CycleRecapReturnForm,
  DutyEventSource,
  HosForm,
  SleeperCandidateRole,
  SleeperPeriodForm,
} from './types.js';

const candidateRoleOptions: readonly Readonly<{
  value: SleeperCandidateRole;
  label: string;
}>[] = [
  { value: 'SHORT_PERIOD', label: 'Short qualifying period' },
  { value: 'LONG_PERIOD', label: 'Long qualifying period' },
];

const sourceOptions: readonly Readonly<{
  value: DutyEventSource;
  label: string;
}>[] = [
  { value: 'USER_ENTERED', label: 'User entered' },
  { value: 'ELD_PROVIDER', label: 'ELD provider' },
  { value: 'CARRIER_SYSTEM', label: 'Carrier system' },
  { value: 'CALCULATED', label: 'Calculated record' },
  { value: 'VERIFIED_RECORD', label: 'Verified record' },
];

function numberValue(value: number | null): number {
  return value ?? 0;
}

export function HosEvidenceEditor(props: {
  readonly value: HosForm;
  readonly onChange: (value: HosForm) => void;
}): ReactNode {
  const replaceRecap = (updated: CycleRecapReturnForm): void => {
    props.onChange({
      ...props.value,
      recapReturns: props.value.recapReturns.map((entry) =>
        entry.localId === updated.localId ? updated : entry,
      ),
    });
  };
  const removeRecap = (localId: string): void => {
    props.onChange({
      ...props.value,
      recapReturns: props.value.recapReturns.filter(
        (entry) => entry.localId !== localId,
      ),
    });
  };
  const replaceSleeper = (updated: SleeperPeriodForm): void => {
    props.onChange({
      ...props.value,
      existingSleeperPeriods: props.value.existingSleeperPeriods.map((period) =>
        period.id === updated.id ? updated : period,
      ),
    });
  };
  const removeSleeper = (id: string): void => {
    props.onChange({
      ...props.value,
      existingSleeperPeriods: props.value.existingSleeperPeriods.filter(
        (period) => period.id !== id,
      ),
    });
  };

  return (
    <div className="profile-columns">
      <section className="subpanel" aria-labelledby="recap-evidence-title">
        <div className="button-row">
          <div>
            <h3 id="recap-evidence-title">Expected cycle recap returns</h3>
            <p className="panel__description">
              Enter only hours expected to return during the planned trip. The source date and availability time remain explicit evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              props.onChange({
                ...props.value,
                recapReturns: [
                  ...props.value.recapReturns,
                  createCycleRecapReturnForm(),
                ],
              })
            }
          >
            Add recap return
          </button>
        </div>
        {props.value.recapReturns.length === 0 ? (
          <p className="empty-state">No expected recap returns entered.</p>
        ) : (
          props.value.recapReturns.map((entry, index) => (
            <fieldset className="advanced-block" key={entry.localId}>
              <legend>Recap return {String(index + 1)}</legend>
              <div className="form-grid">
                <TextField
                  name={`recap-${entry.localId}-source-date`}
                  label="Source duty date"
                  required
                  value={entry.sourceDate}
                  placeholder="YYYY-MM-DD"
                  onChange={(sourceDate) => replaceRecap({ ...entry, sourceDate })}
                />
                <TextField
                  name={`recap-${entry.localId}-available`}
                  label="Available at"
                  type="datetime-local"
                  required
                  value={entry.availableLocal}
                  onChange={(availableLocal) =>
                    replaceRecap({ ...entry, availableLocal })
                  }
                />
                <NumberField
                  name={`recap-${entry.localId}-minutes`}
                  label="Time returned"
                  unit="minutes"
                  min={1}
                  required
                  value={entry.returnedMinutes}
                  onChange={(value) =>
                    replaceRecap({
                      ...entry,
                      returnedMinutes: numberValue(value),
                    })
                  }
                />
              </div>
              <button
                type="button"
                className="button--quiet"
                onClick={() => removeRecap(entry.localId)}
              >
                Remove recap return {String(index + 1)}
              </button>
            </fieldset>
          ))
        )}
      </section>

      <section className="subpanel" aria-labelledby="sleeper-evidence-title">
        <div className="button-row">
          <div>
            <h3 id="sleeper-evidence-title">Existing sleeper periods</h3>
            <p className="panel__description">
              Enter completed qualifying periods only. Selection of split sleeper never grants relief by itself.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              props.onChange({
                ...props.value,
                existingSleeperPeriods: [
                  ...props.value.existingSleeperPeriods,
                  createSleeperPeriodForm(),
                ],
              })
            }
          >
            Add sleeper period
          </button>
        </div>
        {props.value.existingSleeperPeriods.length === 0 ? (
          <p className="empty-state">No existing sleeper periods entered.</p>
        ) : (
          props.value.existingSleeperPeriods.map((period, index) => (
            <fieldset className="advanced-block" key={period.id}>
              <legend>Sleeper period {String(index + 1)}</legend>
              <div className="form-grid">
                <TextField
                  name={`sleeper-${period.id}-start`}
                  label="Period begins"
                  type="datetime-local"
                  required
                  value={period.startLocal}
                  onChange={(startLocal) =>
                    replaceSleeper({ ...period, startLocal })
                  }
                />
                <TextField
                  name={`sleeper-${period.id}-end`}
                  label="Period ends"
                  type="datetime-local"
                  required
                  value={period.endLocal}
                  onChange={(endLocal) => replaceSleeper({ ...period, endLocal })}
                />
                <NumberField
                  name={`sleeper-${period.id}-duration`}
                  label="Recorded duration"
                  unit="minutes"
                  min={1}
                  required
                  value={period.durationMinutes}
                  onChange={(value) =>
                    replaceSleeper({
                      ...period,
                      durationMinutes: numberValue(value),
                    })
                  }
                />
                <SelectField
                  name={`sleeper-${period.id}-role`}
                  label="Candidate role"
                  value={period.candidateRole}
                  options={candidateRoleOptions}
                  onChange={(candidateRole) =>
                    replaceSleeper({ ...period, candidateRole })
                  }
                />
                <TextField
                  name={`sleeper-${period.id}-pair`}
                  label="Pair identifier"
                  value={period.pairId}
                  onChange={(pairId) => replaceSleeper({ ...period, pairId })}
                  hint="Optional. Use the same identifier only for periods intended to form one split pair."
                />
                <SelectField
                  name={`sleeper-${period.id}-source`}
                  label="Evidence source"
                  value={period.source}
                  options={sourceOptions}
                  onChange={(source) => replaceSleeper({ ...period, source })}
                />
                <TextField
                  name={`sleeper-${period.id}-explanation`}
                  label="Evidence explanation"
                  required
                  value={period.explanation}
                  onChange={(explanation) =>
                    replaceSleeper({ ...period, explanation })
                  }
                />
              </div>
              <button
                type="button"
                className="button--quiet"
                onClick={() => removeSleeper(period.id)}
              >
                Remove sleeper period {String(index + 1)}
              </button>
            </fieldset>
          ))
        )}
      </section>
    </div>
  );
}

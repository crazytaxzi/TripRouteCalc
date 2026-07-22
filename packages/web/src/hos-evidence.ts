import type {
  CycleRecapReturnForm,
  SleeperPeriodForm,
} from './types.js';

function identifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createCycleRecapReturnForm(): CycleRecapReturnForm {
  return {
    localId: identifier('recap'),
    sourceDate: '',
    availableLocal: '',
    returnedMinutes: 0,
  };
}

export function createSleeperPeriodForm(): SleeperPeriodForm {
  return {
    id: identifier('sleeper-period'),
    startLocal: '',
    endLocal: '',
    durationMinutes: 0,
    candidateRole: 'LONG_PERIOD',
    pairId: '',
    source: 'USER_ENTERED',
    explanation: '',
  };
}

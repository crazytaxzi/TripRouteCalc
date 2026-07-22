import type {
  LoadPermitForm,
  TrailerRailPositionMappingForm,
} from './types.js';

function identifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createTrailerRailPositionMappingForm(): TrailerRailPositionMappingForm {
  return {
    localId: identifier('rail-mapping'),
    railPosition: '',
    kpraFeet: 0,
    verificationSource: '',
    verifiedAt: '',
    explanation: '',
  };
}

export function createLoadPermitForm(identifierValue = ''): LoadPermitForm {
  return {
    localId: identifier('permit'),
    identifier: identifierValue,
    jurisdictionCode: '',
    restrictions: [],
  };
}

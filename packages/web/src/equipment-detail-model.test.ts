// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  detailedLoadFromForm,
  detailedTractorFromForm,
  detailedTrailerFromForm,
  loadDetailedDraft,
  saveDetailedDraft,
  validateDetailedEquipment,
} from './equipment-detail-model.js';
import { createLoadPermitForm } from './equipment-details.js';
import { defaultTripDraft } from './model.js';
import {
  loadFormFromProfile,
  tractorFormFromProfile,
  trailerFormFromProfile,
} from './profile-mapping.js';
import type { TripDraft } from './types.js';

beforeEach(() => {
  localStorage.clear();
});

function detailedDraft(): TripDraft {
  const base = defaultTripDraft();
  return {
    ...base,
    tractor: {
      ...base.tractor,
      unitNumber: 'TR-DETAIL',
      vin: '1M8GDM9AXKP042788',
      wheelbaseFeet: 20.5,
      californiaComplianceStatus: 'carrier-asserted-compliant',
      californiaComplianceSourceName: 'Carrier compliance file',
      californiaComplianceVerifiedAt: '2026-07-21T18:00:00Z',
      californiaComplianceExplanation:
        'Carrier record was reviewed for the current tractor.',
      notes: 'Assigned sleeper tractor.',
    },
    trailer: {
      ...base.trailer,
      unitNumber: 'TL-DETAIL',
      currentRailPosition: '12',
      railPositionMappings: [
        {
          localId: 'rail-form-1',
          railPosition: '12',
          kpraFeet: 40.5,
          verificationSource: 'Trailer rail placard',
          verifiedAt: '2026-07-21T18:05:00Z',
          explanation: 'Position and KPRA were physically verified.',
        },
      ],
      liftgate: true,
      specialEquipment: ['pallet jack', 'load bars'],
      notes: 'Dry van with verified rail mapping.',
    },
    load: {
      ...base.load,
      referenceNumber: 'LOAD-DETAIL',
      commodityDescription: 'Temperature-controlled electronics',
      frontOverhangFeet: 1.5,
      rearOverhangFeet: 2.25,
      temperatureReeferRequired: true,
      temperatureMinimumFahrenheit: 35,
      temperatureMaximumFahrenheit: 45,
      temperatureSetPointFahrenheit: 40,
      temperatureExplanation: 'Customer tender requires 35-45 F.',
      permitRequirement: 'required',
      permitIdentifiers: ['PERMIT-CO-1'],
      permits: [
        {
          ...createLoadPermitForm('PERMIT-CO-1'),
          jurisdictionCode: 'US-CO',
          restrictions: ['daylight travel only'],
        },
      ],
      escortRequirements: ['front escort in urban work zone'],
      routeRestrictions: ['no Eisenhower Tunnel'],
      secureParkingRequirement: 'high-value-and-secure-parking',
      notes: 'Do not leave unattended outside approved facilities.',
    },
  };
}

describe('Stage 18 advanced equipment detail model', () => {
  it('serializes every detailed tractor, trailer, and load field', () => {
    const draft = detailedDraft();
    const tractor = detailedTractorFromForm(draft.tractor);
    const trailer = detailedTrailerFromForm(draft.trailer);
    const load = detailedLoadFromForm(draft.load);

    expect(tractor).toMatchObject({
      vin: '1M8GDM9AXKP042788',
      wheelbase: { value: 246, unit: 'inch' },
      californiaCompliance: {
        status: 'carrier-asserted-compliant',
        sourceName: 'Carrier compliance file',
        verifiedAt: '2026-07-21T18:00:00Z',
      },
      notes: 'Assigned sleeper tractor.',
    });
    expect(trailer).toMatchObject({
      currentRailPosition: '12',
      railPositionMappings: [
        {
          railPosition: '12',
          kpra: { value: 486, unit: 'inch' },
          verificationSource: 'Trailer rail placard',
          verifiedAt: '2026-07-21T18:05:00Z',
        },
      ],
      liftgate: true,
      specialEquipment: ['pallet jack', 'load bars'],
    });
    expect(load).toMatchObject({
      frontOverhang: { value: 18, unit: 'inch' },
      rearOverhang: { value: 27, unit: 'inch' },
      permitRequirement: 'required',
      permits: [
        {
          identifier: 'PERMIT-CO-1',
          jurisdictionCode: 'US-CO',
          restrictions: ['daylight travel only'],
        },
      ],
      escortRequirements: ['front escort in urban work zone'],
      routeRestrictions: ['no Eisenhower Tunnel'],
      secureParkingRequirement: 'high-value-and-secure-parking',
    });
    expect(load.temperatureRequirements?.minimum?.value).toBeCloseTo(
      1.666_666_666_7,
      6,
    );
    expect(load.temperatureRequirements?.maximum?.value).toBeCloseTo(
      7.222_222_222_2,
      6,
    );
    expect(load.temperatureRequirements?.setPoint?.value).toBeCloseTo(
      4.444_444_444_4,
      6,
    );
  });

  it('round-trips advanced profiles back into editable form state', () => {
    const draft = detailedDraft();
    const tractor = tractorFormFromProfile(
      'tractor-public-1',
      detailedTractorFromForm(draft.tractor),
      draft.tractor.fallbackSpeedMph,
    );
    const trailer = trailerFormFromProfile(
      'trailer-public-1',
      detailedTrailerFromForm(draft.trailer),
    );
    const load = loadFormFromProfile(
      'load-public-1',
      detailedLoadFromForm(draft.load),
    );

    expect(tractor).toMatchObject({
      id: 'tractor-public-1',
      vin: '1M8GDM9AXKP042788',
      wheelbaseFeet: 20.5,
      californiaComplianceStatus: 'carrier-asserted-compliant',
      notes: 'Assigned sleeper tractor.',
    });
    expect(trailer.railPositionMappings?.[0]).toMatchObject({
      railPosition: '12',
      kpraFeet: 40.5,
      verificationSource: 'Trailer rail placard',
    });
    expect(load).toMatchObject({
      id: 'load-public-1',
      frontOverhangFeet: 1.5,
      rearOverhangFeet: 2.25,
      temperatureMinimumFahrenheit: 35,
      temperatureMaximumFahrenheit: 45,
      temperatureSetPointFahrenheit: 40,
      secureParkingRequirement: 'high-value-and-secure-parking',
    });
    expect(load.permits?.[0]).toMatchObject({
      identifier: 'PERMIT-CO-1',
      jurisdictionCode: 'US-CO',
      restrictions: ['daylight travel only'],
    });
  });

  it('preserves advanced details across recovery and migrates legacy permit IDs', () => {
    const draft = detailedDraft();
    saveDetailedDraft(draft);
    const restored = loadDetailedDraft();

    expect(restored?.tractor.vin).toBe('1M8GDM9AXKP042788');
    expect(restored?.trailer.railPositionMappings?.[0]?.railPosition).toBe('12');
    expect(restored?.load.permits?.[0]?.identifier).toBe('PERMIT-CO-1');
    expect(restored?.load.temperatureSetPointFahrenheit).toBe(40);

    localStorage.clear();
    const legacy: TripDraft = {
      ...defaultTripDraft(),
      load: {
        ...defaultTripDraft().load,
        permitIdentifiers: ['LEGACY-PERMIT-1'],
      },
    };
    localStorage.setItem(
      'trip-route-calc.stage18.draft.v2',
      JSON.stringify(legacy),
    );
    const migrated = loadDetailedDraft();
    expect(migrated?.load.permits?.[0]).toMatchObject({
      identifier: 'LEGACY-PERMIT-1',
      jurisdictionCode: '',
      restrictions: [],
    });
  });

  it('returns blocking validation for malformed detailed evidence', () => {
    const draft = detailedDraft();
    const invalid: TripDraft = {
      ...draft,
      trailer: {
        ...draft.trailer,
        railPositionMappings: [
          {
            localId: 'invalid-rail',
            railPosition: '',
            kpraFeet: 0,
            verificationSource: '',
            verifiedAt: '',
            explanation: '',
          },
        ],
      },
    };
    const issues = validateDetailedEquipment(invalid);
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(issues.some((issue) => issue.path === 'equipment')).toBe(true);
  });
});

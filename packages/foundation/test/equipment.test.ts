import { describe, expect, it } from 'vitest';

import {
  buildEquipmentRoutePhysicalInput,
  distanceInMiles,
  fuelRateInUsGallonsPerHour,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  temperatureInFahrenheit,
  validateEquipmentCombination,
  validateLoadProfile,
  validateTrailerProfile,
  validateTractorProfile,
  volumeInUsGallons,
  weightInPounds,
} from '../src/index.js';
import type {
  EquipmentFieldEvidence,
  LoadProfile,
  TractorProfile,
  TrailerProfile,
} from '../src/index.js';

function evidence(...fieldPaths: string[]): readonly EquipmentFieldEvidence[] {
  return fieldPaths.map((fieldPath) => ({
    fieldPath,
    sourceType: 'measured',
  }));
}

function validTractor(): TractorProfile {
  return {
    unitNumber: 'T-101',
    vin: '1M8GDM9AXKP042788',
    tractorType: 'sleeper',
    axleCount: 3,
    overallLength: lengthInFeet(20),
    wheelbase: lengthInInches(235),
    height: lengthInFeet(13),
    width: lengthInInches(96),
    emptyWeight: weightInPounds(19_000),
    grossVehicleWeightRating: weightInPounds(52_000),
    registeredGrossWeight: weightInPounds(80_000),
    fuelCapacity: volumeInUsGallons(200),
    estimatedFuelRange: distanceInMiles(1_200),
    governedSpeed: speedInMilesPerHour(65),
    planningCruiseSpeed: speedInMilesPerHour(55),
    hazmatEquipped: true,
    californiaCompliance: { status: 'not-evaluated' },
    idleAuxiliaryPower: {
      idleAllowed: true,
      auxiliaryPowerUnitAvailable: true,
      estimatedIdleFuelRate: fuelRateInUsGallonsPerHour(0.8),
    },
    fieldEvidence: evidence(
      'overallLength',
      'wheelbase',
      'height',
      'width',
      'emptyWeight',
      'grossVehicleWeightRating',
      'registeredGrossWeight',
      'fuelCapacity',
      'estimatedFuelRange',
      'governedSpeed',
      'planningCruiseSpeed',
    ),
    extensionMetadata: {},
  };
}

function validTrailer(): TrailerProfile {
  return {
    trailerNumber: 'R-53',
    trailerType: 'dry-van',
    length: lengthInFeet(53),
    width: lengthInInches(102),
    height: lengthInFeet(13.5),
    axleCount: 2,
    slidingTandemCapability: true,
    axleConfiguration: 'sliding',
    currentKpra: lengthInFeet(40),
    minimumAchievableKpra: lengthInFeet(37),
    maximumAchievableKpra: lengthInFeet(43),
    currentRailPosition: '12',
    railPositionMappings: [
      {
        railPosition: '12',
        kpra: lengthInFeet(40),
        verificationSource: 'Physical tape measurement',
        verifiedAt: '2026-07-20T12:00:00.000Z',
      },
    ],
    emptyWeight: weightInPounds(14_000),
    grossVehicleWeightRating: weightInPounds(68_000),
    maximumPayload: weightInPounds(54_000),
    reefer: false,
    liftgate: false,
    specialEquipment: [],
    fieldEvidence: evidence(
      'length',
      'width',
      'height',
      'currentKpra',
      'minimumAchievableKpra',
      'maximumAchievableKpra',
      'emptyWeight',
      'grossVehicleWeightRating',
      'maximumPayload',
    ),
    extensionMetadata: {},
  };
}

function validLoad(): LoadProfile {
  return {
    loadIdentifier: 'L-1',
    commodity: 'Palletized food',
    hazmat: false,
    grossCargoWeight: weightInPounds(42_000),
    steerAxleWeight: weightInPounds(12_000),
    driveAxleWeight: weightInPounds(33_000),
    trailerAxleWeight: weightInPounds(33_000),
    totalGrossCombinationWeight: weightInPounds(78_000),
    length: lengthInFeet(48),
    width: lengthInInches(96),
    height: lengthInFeet(8),
    frontOverhang: lengthInInches(0),
    rearOverhang: lengthInInches(0),
    temperatureRequirements: {
      reeferRequired: false,
      minimum: temperatureInFahrenheit(35),
      maximum: temperatureInFahrenheit(75),
    },
    permitRequirement: 'not-required',
    permits: [],
    escortRequirements: [],
    routeRestrictions: [],
    secureParkingRequirement: 'none',
    fieldEvidence: evidence(
      'grossCargoWeight',
      'steerAxleWeight',
      'driveAxleWeight',
      'trailerAxleWeight',
      'totalGrossCombinationWeight',
      'length',
      'width',
      'height',
      'frontOverhang',
      'rearOverhang',
    ),
    extensionMetadata: {},
  };
}

describe('equipment and load validation', () => {
  it('builds explicit unit-bearing route input without claiming legality', () => {
    const result = buildEquipmentRoutePhysicalInput({
      tractor: validTractor(),
      trailer: validTrailer(),
      load: validLoad(),
    });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.input.totalAxleCount).toBe(5);
      expect(result.input.trailer.currentKpra.unit).toBe('inch');
      expect(result.input.load.totalGrossCombinationWeight.unit).toBe('pound');
      expect(result.input.legalityStatus).toBe('not-evaluated');
    }
  });

  it('surfaces missing critical measurements instead of fabricating them', () => {
    const result = validateTrailerProfile({
      ...validTrailer(),
      currentKpra: undefined,
      railPositionMappings: [],
    });

    expect(result.canSave).toBe(true);
    expect(result.routeInputReady).toBe(false);
    expect(result.missingDataConfidenceReasons.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['UNVERIFIED_RAIL_POSITION', 'MISSING_ROUTE_MEASUREMENT']),
    );
  });

  it('rejects physically impossible KPRA and capacity combinations', () => {
    const kpra = validateTrailerProfile({
      ...validTrailer(),
      currentKpra: lengthInFeet(44),
    });
    const capacity = validateEquipmentCombination({
      tractor: validTractor(),
      trailer: validTrailer(),
      load: {
        ...validLoad(),
        grossCargoWeight: weightInPounds(60_000),
        totalGrossCombinationWeight: weightInPounds(96_000),
      },
    });

    expect(kpra.blockingErrors.some((issue) => issue.code === 'KPRA_OUTSIDE_RANGE')).toBe(true);
    expect(capacity.blockingErrors.some((issue) => issue.code === 'INVALID_CAPACITY')).toBe(true);
  });

  it('rejects gross weight below known axle weights', () => {
    const result = validateLoadProfile({
      ...validLoad(),
      totalGrossCombinationWeight: weightInPounds(70_000),
    });

    expect(result.blockingErrors.some((issue) => issue.code === 'AXLE_WEIGHT_EXCEEDS_GROSS')).toBe(true);
  });

  it('requires hazmat class and explicit permit data', () => {
    const hazmat = validateLoadProfile({ ...validLoad(), hazmat: true });
    const permit = validateLoadProfile({
      ...validLoad(),
      permitRequirement: 'required',
      permits: [],
    });

    expect(hazmat.blockingErrors.some((issue) => issue.code === 'HAZMAT_CLASS_REQUIRED')).toBe(true);
    expect(permit.blockingErrors.some((issue) => issue.code === 'PERMIT_DATA_REQUIRED')).toBe(true);
  });

  it('separates physical errors, actions, and confidence reasons', () => {
    const tractor = validateTractorProfile({
      ...validTractor(),
      californiaCompliance: { status: 'carrier-asserted-compliant' },
      fieldEvidence: [],
    });

    expect(tractor.blockingErrors).toHaveLength(0);
    expect(tractor.actionRequiredWarnings).not.toHaveLength(0);
    expect(tractor.missingDataConfidenceReasons).not.toHaveLength(0);
  });
});

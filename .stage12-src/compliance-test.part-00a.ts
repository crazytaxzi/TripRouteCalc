import {
  distanceInMiles,
  durationInMinutes,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  utcInstant,
  validateJurisdictionRule,
  validateRegulatoryRuleSet,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import type {
  JurisdictionRule,
  RegulatoryEvaluationInput,
  RegulatoryRouteSegmentContext,
  RegulatoryRuleSet,
} from '@trip-route-calc/foundation';
import { describe, expect, it } from 'vitest';

import { evaluateRegulatoryCompliance } from '../src/index.js';

const source = {
  authorityType: 'state-dot' as const,
  authorityName: 'Test-only official authority',
  title: 'Test-only official regulatory fixture',
  reference: 'fixture://official/test-only',
  retrievedAt: utcInstant('2026-07-20T00:00:00Z'),
  version: 'fixture-1',
  lastVerifiedAt: utcInstant('2026-07-20T00:00:00Z'),
};

function equipment(kpraFeet = 40) {
  return {
    tractor: {
      axleCount: 3,
      overallLength: lengthInFeet(20),
      height: lengthInFeet(13),
      width: lengthInInches(96),
      emptyWeight: weightInPounds(19_000),
      registeredGrossWeight: weightInPounds(80_000),
      fuelCapacity: volumeInUsGallons(200),
      estimatedFuelRange: distanceInMiles(1_200),
      governedSpeed: speedInMilesPerHour(65),
      planningCruiseSpeed: speedInMilesPerHour(55),
      hazmatEquipped: false,
    },
    trailer: {
      axleCount: 2,
      length: lengthInFeet(53),
      height: lengthInFeet(13.5),
      width: lengthInInches(102),
      currentKpra: lengthInFeet(kpraFeet),
      emptyWeight: weightInPounds(14_000),
      maximumPayload: weightInPounds(54_000),
      reefer: false,
    },
    load: {
      hazmat: false,
      grossCargoWeight: weightInPounds(40_000),
      steerAxleWeight: weightInPounds(12_000),
      driveAxleWeight: weightInPounds(33_000),
      trailerAxleWeight: weightInPounds(32_000),
      totalGrossCombinationWeight: weightInPounds(77_000),
      length: lengthInFeet(48),
      height: lengthInFeet(8),
      width: lengthInFeet(8),
      permitRequirement: 'not-required' as const,
      permitIdentifiers: [],
    },
    totalAxleCount: 5,
    trailerCount: 1,
    combinedDimensions: {
      overallLength: lengthInFeet(72),
      height: lengthInFeet(13.5),
      width: lengthInInches(102),
    },
    legalityStatus: 'not-evaluated' as const,
  };
}

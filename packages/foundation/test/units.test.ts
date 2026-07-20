import { describe, expect, it } from 'vitest';

import {
  DistanceSchema,
  distanceInMiles,
  duration,
  durationInHours,
  lengthInFeet,
  speedInMilesPerHour,
  toFeet,
  toMilesPerHour,
  weight,
} from '../src/units.js';

describe('authoritative measurement primitives', () => {
  it('stores distance in meters and serializes the unit', () => {
    const value = distanceInMiles(1);

    expect(value).toEqual({ value: 1_609.344, unit: 'meter' });
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    expect(DistanceSchema.parse(value)).toEqual(value);
  });

  it('rejects ambiguous bare numbers', () => {
    expect(() => distanceInMiles(Number.NaN)).toThrow();
    expect(() => DistanceSchema.parse(40)).toThrow();
    expect(() => weight(80_000)).toThrow();
  });

  it('uses whole minutes for authoritative durations', () => {
    expect(durationInHours(1.5)).toEqual({ value: 90, unit: 'minute' });
    expect(duration({ value: 120, unit: 'second' })).toEqual({
      value: 2,
      unit: 'minute',
    });
    expect(() => duration({ value: 90, unit: 'second' })).toThrow(
      'whole minutes',
    );
  });

  it('preserves explicit length and speed conversions', () => {
    expect(toFeet(lengthInFeet(53))).toBeCloseTo(53, 12);
    expect(toMilesPerHour(speedInMilesPerHour(65))).toBeCloseTo(65, 12);
  });

  it('rejects negative and non-finite measurements', () => {
    expect(() => lengthInFeet(-1)).toThrow();
    expect(() => speedInMilesPerHour(Number.POSITIVE_INFINITY)).toThrow();
  });
});

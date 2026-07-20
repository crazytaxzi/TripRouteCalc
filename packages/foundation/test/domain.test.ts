import { describe, expect, it } from 'vitest';

import { entityId } from '../src/domain.js';
import {
  firstReleaseOperatingScope,
  MANUAL_VERIFICATION_MODES,
} from '../src/scope.js';
import { PRODUCT_TERMINOLOGY } from '../src/terminology.js';

describe('product language and operating boundaries', () => {
  it('keeps arrival, service completion, and departure distinct', () => {
    expect(PRODUCT_TERMINOLOGY.arrival.definition).not.toBe(
      PRODUCT_TERMINOLOGY.serviceCompletion.definition,
    );
    expect(PRODUCT_TERMINOLOGY.serviceCompletion.definition).not.toBe(
      PRODUCT_TERMINOLOGY.departure.definition,
    );
  });

  it('accepts only the supported first-release operating mode', () => {
    expect(
      firstReleaseOperatingScope({
        country: 'US',
        cargoOperation: 'property-carrying',
        routeJurisdiction: 'interstate',
        driverConfiguration: 'solo',
        hosRuleSet: 'federal-property-standard',
        vehicleCombination: 'tractor-semitrailer',
        freightEquipment: 'dry-van',
        automaticallyAppliedSpecialRules: [],
      }),
    ).toMatchObject({ driverConfiguration: 'solo' });

    expect(() =>
      firstReleaseOperatingScope({
        country: 'US',
        cargoOperation: 'property-carrying',
        routeJurisdiction: 'interstate',
        driverConfiguration: 'team',
        hosRuleSet: 'federal-property-standard',
        vehicleCombination: 'tractor-semitrailer',
        freightEquipment: 'dry-van',
        automaticallyAppliedSpecialRules: [],
      }),
    ).toThrow();
  });

  it('does not automatically apply special modes', () => {
    expect(MANUAL_VERIFICATION_MODES).toContain('adverse-driving-exception');
    expect(MANUAL_VERIFICATION_MODES).toContain('personal-conveyance');
  });

  it('validates entity identifiers at the domain boundary', () => {
    expect(
      entityId('driver', '01234567-89ab-4def-8123-456789abcdef'),
    ).toBe('01234567-89ab-4def-8123-456789abcdef');
    expect(() => entityId('driver', 'driver-123')).toThrow();
  });
});

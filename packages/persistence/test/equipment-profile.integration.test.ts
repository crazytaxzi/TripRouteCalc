import { randomUUID } from 'node:crypto';

import {
  EquipmentValidationError,
  distanceInMiles,
  fuelRateInUsGallonsPerHour,
  lengthInFeet,
  lengthInInches,
  speedInMilesPerHour,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  EquipmentProfileRepository,
  TenantObjectNotFoundError,
  createPersistenceClient,
  databaseUrlFromEnvironment,
} from '../src/index.js';
import type {
  LoadProfile,
  PersistenceClient,
  TenantContext,
  TractorProfile,
  TrailerProfile,
} from '../src/index.js';

interface SeededTenant {
  readonly context: TenantContext;
}

let client: PersistenceClient;

async function resetDatabase(): Promise<void> {
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_events", "trips", "loads", "trailers", "tractors", "carrier_memberships", "carriers", "users" CASCADE',
  );
}

async function seedTenant(label: string): Promise<SeededTenant> {
  const suffix = randomUUID();
  const user = await client.user.create({
    data: {
      email: `${label}-${suffix}@example.test`,
      displayName: `${label} user`,
    },
  });
  const carrier = await client.carrier.create({
    data: {
      legalName: `${label} carrier`,
      homeTerminalTimeZone: 'America/Los_Angeles',
    },
  });
  await client.carrierMembership.create({
    data: { carrierId: carrier.id, userId: user.id, role: 'OWNER' },
  });
  return { context: { carrierId: carrier.id, actorUserId: user.id } };
}

const evidence = (
  fieldPath: string,
): Readonly<{ fieldPath: string; sourceType: 'measured' }> => ({
  fieldPath,
  sourceType: 'measured' as const,
});

function tractor(unitNumber = 'T-101'): TractorProfile {
  return {
    unitNumber,
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
    fieldEvidence: [
      evidence('overallLength'),
      evidence('wheelbase'),
      evidence('height'),
      evidence('width'),
      evidence('emptyWeight'),
      evidence('grossVehicleWeightRating'),
      evidence('registeredGrossWeight'),
      evidence('fuelCapacity'),
      evidence('estimatedFuelRange'),
      evidence('governedSpeed'),
      evidence('planningCruiseSpeed'),
    ],
    extensionMetadata: {},
  };
}

function trailer(trailerNumber = 'R-53'): TrailerProfile {
  return {
    trailerNumber,
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
    fieldEvidence: [
      evidence('length'),
      evidence('width'),
      evidence('height'),
      evidence('currentKpra'),
      evidence('minimumAchievableKpra'),
      evidence('maximumAchievableKpra'),
      evidence('emptyWeight'),
      evidence('grossVehicleWeightRating'),
      evidence('maximumPayload'),
    ],
    extensionMetadata: {},
  };
}

function load(loadIdentifier = 'L-1'): LoadProfile {
  return {
    loadIdentifier,
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
    permitRequirement: 'not-required',
    permits: [],
    escortRequirements: [],
    routeRestrictions: [],
    secureParkingRequirement: 'none',
    fieldEvidence: [
      evidence('grossCargoWeight'),
      evidence('steerAxleWeight'),
      evidence('driveAxleWeight'),
      evidence('trailerAxleWeight'),
      evidence('totalGrossCombinationWeight'),
      evidence('length'),
      evidence('width'),
      evidence('height'),
    ],
    extensionMetadata: {},
  };
}

beforeAll(() => {
  client = createPersistenceClient(databaseUrlFromEnvironment());
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await client.$disconnect();
});

describe('equipment profile persistence', () => {
  it('supports carrier-scoped CRUD for tractor, trailer, and load profiles', async () => {
    const tenant = await seedTenant('crud');
    const repository = new EquipmentProfileRepository(client, tenant.context);

    const createdTractor = await repository.createTractor(tractor());
    const createdTrailer = await repository.createTrailer(trailer());
    const createdLoad = await repository.createLoad(load());

    expect((await repository.listTractors()).map((item) => item.id)).toEqual([
      createdTractor.id,
    ]);
    expect((await repository.listTrailers()).map((item) => item.id)).toEqual([
      createdTrailer.id,
    ]);
    expect((await repository.listLoads()).map((item) => item.id)).toEqual([
      createdLoad.id,
    ]);
    expect((await repository.getTrailer(createdTrailer.id))?.profile.currentKpra).toEqual(
      lengthInFeet(40),
    );

    const updated = await repository.updateLoad(
      createdLoad.id,
      load('L-1-updated'),
    );
    expect(updated.profile.loadIdentifier).toBe('L-1-updated');

    await repository.deleteLoad(createdLoad.id);
    await repository.deleteTrailer(createdTrailer.id);
    await repository.deleteTractor(createdTractor.id);

    await expect(repository.getLoad(createdLoad.id)).resolves.toBeNull();
    await expect(client.auditEvent.count()).resolves.toBe(7);
  });

  it('does not expose or mutate another carrier profile', async () => {
    const tenantA = await seedTenant('tenant-a');
    const tenantB = await seedTenant('tenant-b');
    const repositoryA = new EquipmentProfileRepository(client, tenantA.context);
    const repositoryB = new EquipmentProfileRepository(client, tenantB.context);
    const created = await repositoryA.createTractor(tractor());

    await expect(repositoryB.getTractor(created.id)).resolves.toBeNull();
    await expect(
      repositoryB.updateTractor(created.id, tractor('foreign-edit')),
    ).rejects.toBeInstanceOf(TenantObjectNotFoundError);
  });

  it('validates before writing and preserves an empty transaction on failure', async () => {
    const tenant = await seedTenant('validation');
    const repository = new EquipmentProfileRepository(client, tenant.context);

    await expect(
      repository.createLoad({
        ...load(),
        totalGrossCombinationWeight: weightInPounds(70_000),
      }),
    ).rejects.toBeInstanceOf(EquipmentValidationError);
    await expect(client.load.count()).resolves.toBe(0);
    await expect(client.loadProfileDetails.count()).resolves.toBe(0);
  });

  it('enforces the axle-to-gross invariant at the database boundary', async () => {
    const tenant = await seedTenant('constraint');
    const base = await client.load.create({
      data: {
        carrierId: tenant.context.carrierId,
        referenceNumber: 'constraint-load',
        cargoWeightValue: 10_000,
        cargoWeightUnit: 'pound',
      },
    });

    await expect(
      client.loadProfileDetails.create({
        data: {
          carrierId: tenant.context.carrierId,
          loadId: base.id,
          commodity: 'Test',
          hazmat: false,
          steerAxleWeightValue: 12_000,
          steerAxleWeightUnit: 'pound',
          totalGrossCombinationWeightValue: 10_000,
          totalGrossCombinationWeightUnit: 'pound',
          permitRequirement: 'not-required',
          permits: [],
          escortRequirements: [],
          routeRestrictions: [],
          secureParkingRequirement: 'none',
          fieldEvidence: [],
          extensionMetadata: {},
        },
      }),
    ).rejects.toThrow();
  });
});

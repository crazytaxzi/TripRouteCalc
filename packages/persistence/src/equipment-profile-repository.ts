import {
  loadProfile,
  tractorProfile,
  trailerProfile,
} from '@trip-route-calc/foundation';
import type {
  Distance,
  FuelRate,
  Length,
  LoadProfile,
  Speed,
  Temperature,
  TractorProfile,
  TrailerProfile,
  Volume,
  Weight,
} from '@trip-route-calc/foundation';

import type { PersistenceClient } from './client.js';
import { TenantObjectNotFoundError } from './errors.js';
import type { Prisma } from './generated/prisma/client.js';
import { toJsonValue } from './json.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

export interface PersistedTractorProfile {
  readonly id: string;
  readonly carrierId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly profile: TractorProfile;
}

export interface PersistedTrailerProfile {
  readonly id: string;
  readonly carrierId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly profile: TrailerProfile;
}

export interface PersistedLoadProfile {
  readonly id: string;
  readonly carrierId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly profile: LoadProfile;
}

type TractorRecord = Prisma.TractorGetPayload<object>;
type TractorDetailsRecord = Prisma.TractorProfileDetailsGetPayload<object>;
type TrailerRecord = Prisma.TrailerGetPayload<object>;
type TrailerDetailsRecord = Prisma.TrailerProfileDetailsGetPayload<object>;
type RailMappingRecord = Prisma.TrailerRailPositionMappingGetPayload<object>;
type LoadRecord = Prisma.LoadGetPayload<object>;
type LoadDetailsRecord = Prisma.LoadProfileDetailsGetPayload<object>;


function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as T;
}

function inputJson(value: unknown, path: string): Prisma.InputJsonValue {
  return toJsonValue(value, path) as Prisma.InputJsonValue;
}

function decimalValue(value: { toString(): string } | null): number | undefined {
  return value === null ? undefined : Number(value.toString());
}

function length(value: { toString(): string } | null): Length | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined ? undefined : { value: parsed, unit: 'inch' };
}

function weight(value: { toString(): string } | null): Weight | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined ? undefined : { value: parsed, unit: 'pound' };
}

function distance(value: { toString(): string } | null): Distance | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined ? undefined : { value: parsed, unit: 'meter' };
}

function speed(value: { toString(): string } | null): Speed | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined
    ? undefined
    : { value: parsed, unit: 'meter-per-second' };
}

function volume(value: { toString(): string } | null): Volume | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined ? undefined : { value: parsed, unit: 'us-gallon' };
}

function fuelRate(value: { toString(): string } | null): FuelRate | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined
    ? undefined
    : { value: parsed, unit: 'us-gallon-per-hour' };
}

function temperature(
  value: { toString(): string } | null,
): Temperature | undefined {
  const parsed = decimalValue(value);
  return parsed === undefined ? undefined : { value: parsed, unit: 'celsius' };
}

function evidenceSource(profile: TrailerProfile, fieldPath: string): string | null {
  const evidence = profile.fieldEvidence.find(
    (item) => item.fieldPath === fieldPath,
  );
  if (evidence === undefined) {
    return null;
  }
  return evidence.sourceName ?? evidence.sourceType;
}

function tractorBaseData(
  profile: TractorProfile,
): Omit<Prisma.TractorUncheckedCreateInput, 'carrierId'> {
  return compact({
    unitNumber: profile.unitNumber,
    grossVehicleWeightRatingValue: profile.grossVehicleWeightRating?.value,
    grossVehicleWeightRatingUnit:
      profile.grossVehicleWeightRating === undefined ? undefined : 'pound',
    heightValue: profile.height?.value,
    heightUnit: profile.height === undefined ? undefined : 'inch',
    widthValue: profile.width?.value,
    widthUnit: profile.width === undefined ? undefined : 'inch',
    lengthValue: profile.overallLength?.value,
    lengthUnit: profile.overallLength === undefined ? undefined : 'inch',
  }) as Omit<Prisma.TractorUncheckedCreateInput, 'carrierId'>;
}

function tractorDetailsData(
  profile: TractorProfile,
): Omit<Prisma.TractorProfileDetailsUncheckedCreateInput, 'carrierId' | 'tractorId'> {
  return compact({
    vin: profile.vin,
    tractorType: profile.tractorType,
    axleCount: profile.axleCount,
    wheelbaseValue: profile.wheelbase?.value,
    wheelbaseUnit: profile.wheelbase === undefined ? undefined : 'inch',
    emptyWeightValue: profile.emptyWeight?.value,
    emptyWeightUnit: profile.emptyWeight === undefined ? undefined : 'pound',
    registeredGrossWeightValue: profile.registeredGrossWeight?.value,
    registeredGrossWeightUnit:
      profile.registeredGrossWeight === undefined ? undefined : 'pound',
    fuelCapacityValue: profile.fuelCapacity?.value,
    fuelCapacityUnit:
      profile.fuelCapacity === undefined ? undefined : 'us-gallon',
    estimatedFuelRangeValue: profile.estimatedFuelRange?.value,
    estimatedFuelRangeUnit:
      profile.estimatedFuelRange === undefined ? undefined : 'meter',
    governedSpeedValue: profile.governedSpeed?.value,
    governedSpeedUnit:
      profile.governedSpeed === undefined ? undefined : 'meter-per-second',
    planningCruiseSpeedValue: profile.planningCruiseSpeed?.value,
    planningCruiseSpeedUnit:
      profile.planningCruiseSpeed === undefined
        ? undefined
        : 'meter-per-second',
    hazmatEquipped: profile.hazmatEquipped,
    californiaComplianceStatus: profile.californiaCompliance.status,
    californiaComplianceSource: profile.californiaCompliance.sourceName,
    californiaComplianceVerifiedAt:
      profile.californiaCompliance.verifiedAt === undefined
        ? undefined
        : new Date(profile.californiaCompliance.verifiedAt),
    californiaComplianceExplanation:
      profile.californiaCompliance.explanation,
    idleAllowed: profile.idleAuxiliaryPower.idleAllowed,
    auxiliaryPowerUnitAvailable:
      profile.idleAuxiliaryPower.auxiliaryPowerUnitAvailable,
    estimatedIdleFuelRateValue:
      profile.idleAuxiliaryPower.estimatedIdleFuelRate?.value,
    estimatedIdleFuelRateUnit:
      profile.idleAuxiliaryPower.estimatedIdleFuelRate === undefined
        ? undefined
        : 'us-gallon-per-hour',
    estimatedAuxiliaryPowerFuelRateValue:
      profile.idleAuxiliaryPower.estimatedAuxiliaryPowerFuelRate?.value,
    estimatedAuxiliaryPowerFuelRateUnit:
      profile.idleAuxiliaryPower.estimatedAuxiliaryPowerFuelRate === undefined
        ? undefined
        : 'us-gallon-per-hour',
    idleAuxiliaryPowerExplanation:
      profile.idleAuxiliaryPower.explanation,
    notes: profile.notes,
    fieldEvidence: inputJson(profile.fieldEvidence, 'tractor.fieldEvidence'),
    extensionMetadata: inputJson(
      profile.extensionMetadata,
      'tractor.extensionMetadata',
    ),
  }) as Omit<
    Prisma.TractorProfileDetailsUncheckedCreateInput,
    'carrierId' | 'tractorId'
  >;
}

function trailerBaseData(
  profile: TrailerProfile,
): Omit<Prisma.TrailerUncheckedCreateInput, 'carrierId'> {
  return compact({
    unitNumber: profile.trailerNumber,
    equipmentType: profile.trailerType,
    grossVehicleWeightRatingValue: profile.grossVehicleWeightRating?.value,
    grossVehicleWeightRatingUnit:
      profile.grossVehicleWeightRating === undefined ? undefined : 'pound',
    heightValue: profile.height?.value,
    heightUnit: profile.height === undefined ? undefined : 'inch',
    widthValue: profile.width?.value,
    widthUnit: profile.width === undefined ? undefined : 'inch',
    lengthValue: profile.length?.value,
    lengthUnit: profile.length === undefined ? undefined : 'inch',
    kpraValue: profile.currentKpra?.value,
    kpraUnit: profile.currentKpra === undefined ? undefined : 'inch',
    kpraVerificationSource: evidenceSource(profile, 'currentKpra'),
  }) as Omit<Prisma.TrailerUncheckedCreateInput, 'carrierId'>;
}

function trailerDetailsData(
  profile: TrailerProfile,
): Omit<Prisma.TrailerProfileDetailsUncheckedCreateInput, 'carrierId' | 'trailerId'> {
  return compact({
    axleCount: profile.axleCount,
    slidingTandemCapability: profile.slidingTandemCapability,
    axleConfiguration: profile.axleConfiguration,
    minimumKpraValue: profile.minimumAchievableKpra?.value,
    minimumKpraUnit:
      profile.minimumAchievableKpra === undefined ? undefined : 'inch',
    maximumKpraValue: profile.maximumAchievableKpra?.value,
    maximumKpraUnit:
      profile.maximumAchievableKpra === undefined ? undefined : 'inch',
    currentRailPosition: profile.currentRailPosition,
    emptyWeightValue: profile.emptyWeight?.value,
    emptyWeightUnit: profile.emptyWeight === undefined ? undefined : 'pound',
    maximumPayloadValue: profile.maximumPayload?.value,
    maximumPayloadUnit:
      profile.maximumPayload === undefined ? undefined : 'pound',
    reefer: profile.reefer,
    liftgate: profile.liftgate,
    specialEquipment: inputJson(
      profile.specialEquipment,
      'trailer.specialEquipment',
    ),
    notes: profile.notes,
    fieldEvidence: inputJson(profile.fieldEvidence, 'trailer.fieldEvidence'),
    extensionMetadata: inputJson(
      profile.extensionMetadata,
      'trailer.extensionMetadata',
    ),
  }) as Omit<
    Prisma.TrailerProfileDetailsUncheckedCreateInput,
    'carrierId' | 'trailerId'
  >;
}

function loadBaseData(
  profile: LoadProfile,
): Omit<Prisma.LoadUncheckedCreateInput, 'carrierId'> {
  return compact({
    referenceNumber: profile.loadIdentifier,
    cargoWeightValue: profile.grossCargoWeight?.value,
    cargoWeightUnit:
      profile.grossCargoWeight === undefined ? undefined : 'pound',
  }) as Omit<Prisma.LoadUncheckedCreateInput, 'carrierId'>;
}

function loadDetailsData(
  profile: LoadProfile,
): Omit<Prisma.LoadProfileDetailsUncheckedCreateInput, 'carrierId' | 'loadId'> {
  const temperatureRequirements = profile.temperatureRequirements;
  return compact({
    commodity: profile.commodity,
    hazmat: profile.hazmat,
    hazmatClass: profile.hazmatClass,
    steerAxleWeightValue: profile.steerAxleWeight?.value,
    steerAxleWeightUnit:
      profile.steerAxleWeight === undefined ? undefined : 'pound',
    driveAxleWeightValue: profile.driveAxleWeight?.value,
    driveAxleWeightUnit:
      profile.driveAxleWeight === undefined ? undefined : 'pound',
    trailerAxleWeightValue: profile.trailerAxleWeight?.value,
    trailerAxleWeightUnit:
      profile.trailerAxleWeight === undefined ? undefined : 'pound',
    totalGrossCombinationWeightValue:
      profile.totalGrossCombinationWeight?.value,
    totalGrossCombinationWeightUnit:
      profile.totalGrossCombinationWeight === undefined ? undefined : 'pound',
    lengthValue: profile.length?.value,
    lengthUnit: profile.length === undefined ? undefined : 'inch',
    widthValue: profile.width?.value,
    widthUnit: profile.width === undefined ? undefined : 'inch',
    heightValue: profile.height?.value,
    heightUnit: profile.height === undefined ? undefined : 'inch',
    frontOverhangValue: profile.frontOverhang?.value,
    frontOverhangUnit:
      profile.frontOverhang === undefined ? undefined : 'inch',
    rearOverhangValue: profile.rearOverhang?.value,
    rearOverhangUnit:
      profile.rearOverhang === undefined ? undefined : 'inch',
    reeferRequired: temperatureRequirements?.reeferRequired,
    minimumTemperatureValue: temperatureRequirements?.minimum?.value,
    minimumTemperatureUnit:
      temperatureRequirements?.minimum === undefined ? undefined : 'celsius',
    maximumTemperatureValue: temperatureRequirements?.maximum?.value,
    maximumTemperatureUnit:
      temperatureRequirements?.maximum === undefined ? undefined : 'celsius',
    temperatureSetPointValue: temperatureRequirements?.setPoint?.value,
    temperatureSetPointUnit:
      temperatureRequirements?.setPoint === undefined ? undefined : 'celsius',
    temperatureExplanation: temperatureRequirements?.explanation,
    permitRequirement: profile.permitRequirement,
    permits: inputJson(profile.permits, 'load.permits'),
    escortRequirements: inputJson(
      profile.escortRequirements,
      'load.escortRequirements',
    ),
    routeRestrictions: inputJson(
      profile.routeRestrictions,
      'load.routeRestrictions',
    ),
    secureParkingRequirement: profile.secureParkingRequirement,
    notes: profile.notes,
    fieldEvidence: inputJson(profile.fieldEvidence, 'load.fieldEvidence'),
    extensionMetadata: inputJson(
      profile.extensionMetadata,
      'load.extensionMetadata',
    ),
  }) as Omit<
    Prisma.LoadProfileDetailsUncheckedCreateInput,
    'carrierId' | 'loadId'
  >;
}

function mapTractor(
  base: TractorRecord,
  details: TractorDetailsRecord,
): PersistedTractorProfile {
  const californiaCompliance = {
    status: details.californiaComplianceStatus,
    ...(details.californiaComplianceSource === null
      ? {}
      : { sourceName: details.californiaComplianceSource }),
    ...(details.californiaComplianceVerifiedAt === null
      ? {}
      : { verifiedAt: details.californiaComplianceVerifiedAt.toISOString() }),
    ...(details.californiaComplianceExplanation === null
      ? {}
      : { explanation: details.californiaComplianceExplanation }),
  };
  const idleAuxiliaryPower = {
    idleAllowed: details.idleAllowed,
    auxiliaryPowerUnitAvailable: details.auxiliaryPowerUnitAvailable,
    ...(fuelRate(details.estimatedIdleFuelRateValue) === undefined
      ? {}
      : { estimatedIdleFuelRate: fuelRate(details.estimatedIdleFuelRateValue) }),
    ...(fuelRate(details.estimatedAuxiliaryPowerFuelRateValue) === undefined
      ? {}
      : {
          estimatedAuxiliaryPowerFuelRate: fuelRate(
            details.estimatedAuxiliaryPowerFuelRateValue,
          ),
        }),
    ...(details.idleAuxiliaryPowerExplanation === null
      ? {}
      : { explanation: details.idleAuxiliaryPowerExplanation }),
  };
  const profile = tractorProfile({
    unitNumber: base.unitNumber,
    ...(details.vin === null ? {} : { vin: details.vin }),
    tractorType: details.tractorType,
    axleCount: details.axleCount,
    ...(length(base.lengthValue) === undefined
      ? {}
      : { overallLength: length(base.lengthValue) }),
    ...(length(details.wheelbaseValue) === undefined
      ? {}
      : { wheelbase: length(details.wheelbaseValue) }),
    ...(length(base.heightValue) === undefined
      ? {}
      : { height: length(base.heightValue) }),
    ...(length(base.widthValue) === undefined
      ? {}
      : { width: length(base.widthValue) }),
    ...(weight(details.emptyWeightValue) === undefined
      ? {}
      : { emptyWeight: weight(details.emptyWeightValue) }),
    ...(weight(base.grossVehicleWeightRatingValue) === undefined
      ? {}
      : {
          grossVehicleWeightRating: weight(
            base.grossVehicleWeightRatingValue,
          ),
        }),
    ...(weight(details.registeredGrossWeightValue) === undefined
      ? {}
      : {
          registeredGrossWeight: weight(details.registeredGrossWeightValue),
        }),
    ...(volume(details.fuelCapacityValue) === undefined
      ? {}
      : { fuelCapacity: volume(details.fuelCapacityValue) }),
    ...(distance(details.estimatedFuelRangeValue) === undefined
      ? {}
      : { estimatedFuelRange: distance(details.estimatedFuelRangeValue) }),
    ...(speed(details.governedSpeedValue) === undefined
      ? {}
      : { governedSpeed: speed(details.governedSpeedValue) }),
    ...(speed(details.planningCruiseSpeedValue) === undefined
      ? {}
      : { planningCruiseSpeed: speed(details.planningCruiseSpeedValue) }),
    hazmatEquipped: details.hazmatEquipped,
    californiaCompliance,
    idleAuxiliaryPower,
    ...(details.notes === null ? {} : { notes: details.notes }),
    fieldEvidence: details.fieldEvidence,
    extensionMetadata: details.extensionMetadata,
  });
  return {
    id: base.id,
    carrierId: base.carrierId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    profile,
  };
}

function mapTrailer(
  base: TrailerRecord,
  details: TrailerDetailsRecord,
  mappings: readonly RailMappingRecord[],
): PersistedTrailerProfile {
  const profile = trailerProfile({
    trailerNumber: base.unitNumber,
    trailerType: base.equipmentType,
    ...(length(base.lengthValue) === undefined
      ? {}
      : { length: length(base.lengthValue) }),
    ...(length(base.widthValue) === undefined
      ? {}
      : { width: length(base.widthValue) }),
    ...(length(base.heightValue) === undefined
      ? {}
      : { height: length(base.heightValue) }),
    axleCount: details.axleCount,
    slidingTandemCapability: details.slidingTandemCapability,
    axleConfiguration: details.axleConfiguration,
    ...(length(base.kpraValue) === undefined
      ? {}
      : { currentKpra: length(base.kpraValue) }),
    ...(length(details.minimumKpraValue) === undefined
      ? {}
      : { minimumAchievableKpra: length(details.minimumKpraValue) }),
    ...(length(details.maximumKpraValue) === undefined
      ? {}
      : { maximumAchievableKpra: length(details.maximumKpraValue) }),
    ...(details.currentRailPosition === null
      ? {}
      : { currentRailPosition: details.currentRailPosition }),
    railPositionMappings: mappings.map((mapping) => ({
      railPosition: mapping.railPosition,
      kpra: { value: Number(mapping.kpraValue.toString()), unit: 'inch' },
      verificationSource: mapping.verificationSource,
      verifiedAt: mapping.verifiedAt.toISOString(),
      ...(mapping.explanation === null
        ? {}
        : { explanation: mapping.explanation }),
    })),
    ...(weight(details.emptyWeightValue) === undefined
      ? {}
      : { emptyWeight: weight(details.emptyWeightValue) }),
    ...(weight(base.grossVehicleWeightRatingValue) === undefined
      ? {}
      : {
          grossVehicleWeightRating: weight(
            base.grossVehicleWeightRatingValue,
          ),
        }),
    ...(weight(details.maximumPayloadValue) === undefined
      ? {}
      : { maximumPayload: weight(details.maximumPayloadValue) }),
    reefer: details.reefer,
    liftgate: details.liftgate,
    specialEquipment: details.specialEquipment,
    ...(details.notes === null ? {} : { notes: details.notes }),
    fieldEvidence: details.fieldEvidence,
    extensionMetadata: details.extensionMetadata,
  });
  return {
    id: base.id,
    carrierId: base.carrierId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    profile,
  };
}

function mapLoad(
  base: LoadRecord,
  details: LoadDetailsRecord,
): PersistedLoadProfile {
  const minimum = temperature(details.minimumTemperatureValue);
  const maximum = temperature(details.maximumTemperatureValue);
  const setPoint = temperature(details.temperatureSetPointValue);
  const hasTemperature =
    details.reeferRequired !== null ||
    minimum !== undefined ||
    maximum !== undefined ||
    setPoint !== undefined ||
    details.temperatureExplanation !== null;
  const temperatureRequirements = hasTemperature
    ? {
        reeferRequired: details.reeferRequired ?? false,
        ...(minimum === undefined ? {} : { minimum }),
        ...(maximum === undefined ? {} : { maximum }),
        ...(setPoint === undefined ? {} : { setPoint }),
        ...(details.temperatureExplanation === null
          ? {}
          : { explanation: details.temperatureExplanation }),
      }
    : undefined;
  const profile = loadProfile({
    loadIdentifier: base.referenceNumber,
    commodity: details.commodity,
    hazmat: details.hazmat,
    ...(details.hazmatClass === null
      ? {}
      : { hazmatClass: details.hazmatClass }),
    ...(weight(base.cargoWeightValue) === undefined
      ? {}
      : { grossCargoWeight: weight(base.cargoWeightValue) }),
    ...(weight(details.steerAxleWeightValue) === undefined
      ? {}
      : { steerAxleWeight: weight(details.steerAxleWeightValue) }),
    ...(weight(details.driveAxleWeightValue) === undefined
      ? {}
      : { driveAxleWeight: weight(details.driveAxleWeightValue) }),
    ...(weight(details.trailerAxleWeightValue) === undefined
      ? {}
      : { trailerAxleWeight: weight(details.trailerAxleWeightValue) }),
    ...(weight(details.totalGrossCombinationWeightValue) === undefined
      ? {}
      : {
          totalGrossCombinationWeight: weight(
            details.totalGrossCombinationWeightValue,
          ),
        }),
    ...(length(details.lengthValue) === undefined
      ? {}
      : { length: length(details.lengthValue) }),
    ...(length(details.widthValue) === undefined
      ? {}
      : { width: length(details.widthValue) }),
    ...(length(details.heightValue) === undefined
      ? {}
      : { height: length(details.heightValue) }),
    ...(length(details.frontOverhangValue) === undefined
      ? {}
      : { frontOverhang: length(details.frontOverhangValue) }),
    ...(length(details.rearOverhangValue) === undefined
      ? {}
      : { rearOverhang: length(details.rearOverhangValue) }),
    ...(temperatureRequirements === undefined
      ? {}
      : { temperatureRequirements }),
    permitRequirement: details.permitRequirement,
    permits: details.permits,
    escortRequirements: details.escortRequirements,
    routeRestrictions: details.routeRestrictions,
    secureParkingRequirement: details.secureParkingRequirement,
    ...(details.notes === null ? {} : { notes: details.notes }),
    fieldEvidence: details.fieldEvidence,
    extensionMetadata: details.extensionMetadata,
  });
  return {
    id: base.id,
    carrierId: base.carrierId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    profile,
  };
}

export class EquipmentProfileRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  private async audit(
    transaction: Prisma.TransactionClient,
    entityType: 'tractor' | 'trailer' | 'load',
    entityId: string,
    action: 'create' | 'update' | 'delete',
    metadata: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await transaction.auditEvent.create({
      data: {
        carrierId: this.context.carrierId,
        actorUserId: this.context.actorUserId,
        entityType,
        entityId,
        action,
        metadata: inputJson(metadata, `${entityType}.auditMetadata`),
      },
    });
  }

  public async createTractor(
    input: unknown,
  ): Promise<PersistedTractorProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = tractorProfile(input);
    const created = await this.client.$transaction(async (transaction) => {
      const base = tractorBaseData(profile);
      const tractor = await transaction.tractor.create({
        data: { ...base, carrierId: this.context.carrierId },
      });
      const details = await transaction.tractorProfileDetails.create({
        data: {
          ...tractorDetailsData(profile),
          carrierId: this.context.carrierId,
          tractorId: tractor.id,
        },
      });
      await this.audit(transaction, 'tractor', tractor.id, 'create', {
        unitNumber: profile.unitNumber,
      });
      return { tractor, details };
    });
    return mapTractor(created.tractor, created.details);
  }

  public async getTractor(id: string): Promise<PersistedTractorProfile | null> {
    await assertTenantMembership(this.client, this.context);
    const tractor = await this.client.tractor.findFirst({
      where: { id, carrierId: this.context.carrierId },
    });
    if (tractor === null) {
      return null;
    }
    const details = await this.client.tractorProfileDetails.findFirst({
      where: { tractorId: id, carrierId: this.context.carrierId },
    });
    return details === null ? null : mapTractor(tractor, details);
  }

  public async listTractors(): Promise<readonly PersistedTractorProfile[]> {
    await assertTenantMembership(this.client, this.context);
    const tractors = await this.client.tractor.findMany({
      where: { carrierId: this.context.carrierId },
      orderBy: { unitNumber: 'asc' },
    });
    const details = await this.client.tractorProfileDetails.findMany({
      where: {
        carrierId: this.context.carrierId,
        tractorId: { in: tractors.map((tractor) => tractor.id) },
      },
    });
    const byId = new Map(details.map((item) => [item.tractorId, item]));
    return tractors.flatMap((tractor) => {
      const detail = byId.get(tractor.id);
      return detail === undefined ? [] : [mapTractor(tractor, detail)];
    });
  }

  public async updateTractor(
    id: string,
    input: unknown,
  ): Promise<PersistedTractorProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = tractorProfile(input);
    const existing = await this.client.tractor.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Tractor was not found in the requested carrier account.',
      );
    }
    const updated = await this.client.$transaction(async (transaction) => {
      const base = tractorBaseData(profile);
      const tractor = await transaction.tractor.update({
        where: { id },
        data: base,
      });
      const details = await transaction.tractorProfileDetails.upsert({
        where: { tractorId: id },
        create: {
          ...tractorDetailsData(profile),
          carrierId: this.context.carrierId,
          tractorId: id,
        },
        update: tractorDetailsData(profile),
      });
      await this.audit(transaction, 'tractor', id, 'update', {
        unitNumber: profile.unitNumber,
      });
      return { tractor, details };
    });
    return mapTractor(updated.tractor, updated.details);
  }

  public async deleteTractor(id: string): Promise<void> {
    await assertTenantMembership(this.client, this.context);
    const existing = await this.client.tractor.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true, unitNumber: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Tractor was not found in the requested carrier account.',
      );
    }
    await this.client.$transaction(async (transaction) => {
      await transaction.tractor.delete({ where: { id } });
      await this.audit(transaction, 'tractor', id, 'delete', {
        unitNumber: existing.unitNumber,
      });
    });
  }

  public async createTrailer(
    input: unknown,
  ): Promise<PersistedTrailerProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = trailerProfile(input);
    const created = await this.client.$transaction(async (transaction) => {
      const base = trailerBaseData(profile);
      const trailer = await transaction.trailer.create({
        data: { ...base, carrierId: this.context.carrierId },
      });
      const details = await transaction.trailerProfileDetails.create({
        data: {
          ...trailerDetailsData(profile),
          carrierId: this.context.carrierId,
          trailerId: trailer.id,
        },
      });
      const mappings = await Promise.all(
        profile.railPositionMappings.map((mapping) =>
          transaction.trailerRailPositionMapping.create({
            data: {
              carrierId: this.context.carrierId,
              trailerId: trailer.id,
              railPosition: mapping.railPosition,
              kpraValue: mapping.kpra.value,
              kpraUnit: 'inch',
              verificationSource: mapping.verificationSource,
              verifiedAt: new Date(mapping.verifiedAt),
              explanation: mapping.explanation,
            },
          }),
        ),
      );
      await this.audit(transaction, 'trailer', trailer.id, 'create', {
        trailerNumber: profile.trailerNumber,
      });
      return { trailer, details, mappings };
    });
    return mapTrailer(created.trailer, created.details, created.mappings);
  }

  public async getTrailer(id: string): Promise<PersistedTrailerProfile | null> {
    await assertTenantMembership(this.client, this.context);
    const trailer = await this.client.trailer.findFirst({
      where: { id, carrierId: this.context.carrierId },
    });
    if (trailer === null) {
      return null;
    }
    const [details, mappings] = await Promise.all([
      this.client.trailerProfileDetails.findFirst({
        where: { trailerId: id, carrierId: this.context.carrierId },
      }),
      this.client.trailerRailPositionMapping.findMany({
        where: { trailerId: id, carrierId: this.context.carrierId },
        orderBy: { railPosition: 'asc' },
      }),
    ]);
    return details === null ? null : mapTrailer(trailer, details, mappings);
  }

  public async listTrailers(): Promise<readonly PersistedTrailerProfile[]> {
    await assertTenantMembership(this.client, this.context);
    const trailers = await this.client.trailer.findMany({
      where: { carrierId: this.context.carrierId },
      orderBy: { unitNumber: 'asc' },
    });
    return Promise.all(
      trailers.map(async (trailer) => {
        const profile = await this.getTrailer(trailer.id);
        if (profile === null) {
          throw new Error(`Trailer ${trailer.id} is missing Stage 09 profile details.`);
        }
        return profile;
      }),
    );
  }

  public async updateTrailer(
    id: string,
    input: unknown,
  ): Promise<PersistedTrailerProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = trailerProfile(input);
    const existing = await this.client.trailer.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Trailer was not found in the requested carrier account.',
      );
    }
    const updated = await this.client.$transaction(async (transaction) => {
      const base = trailerBaseData(profile);
      const trailer = await transaction.trailer.update({
        where: { id },
        data: base,
      });
      const details = await transaction.trailerProfileDetails.upsert({
        where: { trailerId: id },
        create: {
          ...trailerDetailsData(profile),
          carrierId: this.context.carrierId,
          trailerId: id,
        },
        update: trailerDetailsData(profile),
      });
      await transaction.trailerRailPositionMapping.deleteMany({
        where: { trailerId: id, carrierId: this.context.carrierId },
      });
      const mappings = await Promise.all(
        profile.railPositionMappings.map((mapping) =>
          transaction.trailerRailPositionMapping.create({
            data: {
              carrierId: this.context.carrierId,
              trailerId: id,
              railPosition: mapping.railPosition,
              kpraValue: mapping.kpra.value,
              kpraUnit: 'inch',
              verificationSource: mapping.verificationSource,
              verifiedAt: new Date(mapping.verifiedAt),
              explanation: mapping.explanation,
            },
          }),
        ),
      );
      await this.audit(transaction, 'trailer', id, 'update', {
        trailerNumber: profile.trailerNumber,
      });
      return { trailer, details, mappings };
    });
    return mapTrailer(updated.trailer, updated.details, updated.mappings);
  }

  public async deleteTrailer(id: string): Promise<void> {
    await assertTenantMembership(this.client, this.context);
    const existing = await this.client.trailer.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true, unitNumber: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Trailer was not found in the requested carrier account.',
      );
    }
    await this.client.$transaction(async (transaction) => {
      await transaction.trailer.delete({ where: { id } });
      await this.audit(transaction, 'trailer', id, 'delete', {
        trailerNumber: existing.unitNumber,
      });
    });
  }

  public async createLoad(input: unknown): Promise<PersistedLoadProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = loadProfile(input);
    const created = await this.client.$transaction(async (transaction) => {
      const base = loadBaseData(profile);
      const load = await transaction.load.create({
        data: { ...base, carrierId: this.context.carrierId },
      });
      const details = await transaction.loadProfileDetails.create({
        data: {
          ...loadDetailsData(profile),
          carrierId: this.context.carrierId,
          loadId: load.id,
        },
      });
      await this.audit(transaction, 'load', load.id, 'create', {
        loadIdentifier: profile.loadIdentifier,
      });
      return { load, details };
    });
    return mapLoad(created.load, created.details);
  }

  public async getLoad(id: string): Promise<PersistedLoadProfile | null> {
    await assertTenantMembership(this.client, this.context);
    const load = await this.client.load.findFirst({
      where: { id, carrierId: this.context.carrierId },
    });
    if (load === null) {
      return null;
    }
    const details = await this.client.loadProfileDetails.findFirst({
      where: { loadId: id, carrierId: this.context.carrierId },
    });
    return details === null ? null : mapLoad(load, details);
  }

  public async listLoads(): Promise<readonly PersistedLoadProfile[]> {
    await assertTenantMembership(this.client, this.context);
    const loads = await this.client.load.findMany({
      where: { carrierId: this.context.carrierId },
      orderBy: { referenceNumber: 'asc' },
    });
    const details = await this.client.loadProfileDetails.findMany({
      where: {
        carrierId: this.context.carrierId,
        loadId: { in: loads.map((load) => load.id) },
      },
    });
    const byId = new Map(details.map((item) => [item.loadId, item]));
    return loads.flatMap((load) => {
      const detail = byId.get(load.id);
      return detail === undefined ? [] : [mapLoad(load, detail)];
    });
  }

  public async updateLoad(
    id: string,
    input: unknown,
  ): Promise<PersistedLoadProfile> {
    await assertTenantMembership(this.client, this.context);
    const profile = loadProfile(input);
    const existing = await this.client.load.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Load was not found in the requested carrier account.',
      );
    }
    const updated = await this.client.$transaction(async (transaction) => {
      const base = loadBaseData(profile);
      const load = await transaction.load.update({
        where: { id },
        data: base,
      });
      const details = await transaction.loadProfileDetails.upsert({
        where: { loadId: id },
        create: {
          ...loadDetailsData(profile),
          carrierId: this.context.carrierId,
          loadId: id,
        },
        update: loadDetailsData(profile),
      });
      await this.audit(transaction, 'load', id, 'update', {
        loadIdentifier: profile.loadIdentifier,
      });
      return { load, details };
    });
    return mapLoad(updated.load, updated.details);
  }

  public async deleteLoad(id: string): Promise<void> {
    await assertTenantMembership(this.client, this.context);
    const existing = await this.client.load.findFirst({
      where: { id, carrierId: this.context.carrierId },
      select: { id: true, referenceNumber: true },
    });
    if (existing === null) {
      throw new TenantObjectNotFoundError(
        'Load was not found in the requested carrier account.',
      );
    }
    await this.client.$transaction(async (transaction) => {
      await transaction.load.delete({ where: { id } });
      await this.audit(transaction, 'load', id, 'delete', {
        loadIdentifier: existing.referenceNumber,
      });
    });
  }
}

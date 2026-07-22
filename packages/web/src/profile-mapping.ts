import {
  LoadProfileSchema,
  TractorProfileSchema,
  TrailerProfileSchema,
  toFahrenheit,
  toFeet,
  toMiles,
  toMilesPerHour,
} from '@trip-route-calc/foundation';

import {
  createLoadPermitForm,
  createTrailerRailPositionMappingForm,
} from './equipment-details.js';
import type {
  LoadForm,
  TractorForm,
  TrailerForm,
} from './types.js';

export function tractorFormFromProfile(
  id: string,
  value: unknown,
  fallbackSpeedMph: number,
): TractorForm {
  const profile = TractorProfileSchema.parse(value);
  return {
    id,
    unitNumber: profile.unitNumber,
    vin: profile.vin ?? '',
    tractorType: profile.tractorType,
    axleCount: profile.axleCount,
    overallLengthFeet:
      profile.overallLength === undefined ? 0 : toFeet(profile.overallLength),
    wheelbaseFeet:
      profile.wheelbase === undefined ? 0 : toFeet(profile.wheelbase),
    heightFeet: profile.height === undefined ? 0 : toFeet(profile.height),
    widthInches: profile.width?.value ?? 0,
    emptyWeightPounds: profile.emptyWeight?.value ?? 0,
    registeredGrossWeightPounds: profile.registeredGrossWeight?.value ?? 0,
    fuelCapacityGallons: profile.fuelCapacity?.value ?? 0,
    estimatedFuelRangeMiles:
      profile.estimatedFuelRange === undefined
        ? 0
        : toMiles(profile.estimatedFuelRange),
    governedSpeedMph:
      profile.governedSpeed === undefined
        ? 0
        : toMilesPerHour(profile.governedSpeed),
    planningSpeedMph:
      profile.planningCruiseSpeed === undefined
        ? 0
        : toMilesPerHour(profile.planningCruiseSpeed),
    fallbackSpeedMph,
    hazmatEquipped: profile.hazmatEquipped,
    californiaComplianceStatus: profile.californiaCompliance.status,
    californiaComplianceSourceName:
      profile.californiaCompliance.sourceName ?? '',
    californiaComplianceVerifiedAt:
      profile.californiaCompliance.verifiedAt ?? '',
    californiaComplianceExplanation:
      profile.californiaCompliance.explanation ?? '',
    apuAvailable: profile.idleAuxiliaryPower.auxiliaryPowerUnitAvailable,
    idleAllowed: profile.idleAuxiliaryPower.idleAllowed,
    notes: profile.notes ?? '',
  };
}

export function trailerFormFromProfile(
  id: string,
  value: unknown,
): TrailerForm {
  const profile = TrailerProfileSchema.parse(value);
  return {
    id,
    unitNumber: profile.trailerNumber,
    trailerType: profile.trailerType,
    axleCount: profile.axleCount,
    axleConfiguration: profile.axleConfiguration,
    slidingTandemCapability: profile.slidingTandemCapability,
    lengthFeet: profile.length === undefined ? 0 : toFeet(profile.length),
    heightFeet: profile.height === undefined ? 0 : toFeet(profile.height),
    widthInches: profile.width?.value ?? 0,
    currentKpraFeet:
      profile.currentKpra === undefined ? 0 : toFeet(profile.currentKpra),
    minimumKpraFeet:
      profile.minimumAchievableKpra === undefined
        ? 0
        : toFeet(profile.minimumAchievableKpra),
    maximumKpraFeet:
      profile.maximumAchievableKpra === undefined
        ? 0
        : toFeet(profile.maximumAchievableKpra),
    currentRailPosition: profile.currentRailPosition ?? '',
    railPositionMappings: profile.railPositionMappings.map((mapping) => ({
      ...createTrailerRailPositionMappingForm(),
      railPosition: mapping.railPosition,
      kpraFeet: toFeet(mapping.kpra),
      verificationSource: mapping.verificationSource,
      verifiedAt: mapping.verifiedAt,
      explanation: mapping.explanation ?? '',
    })),
    emptyWeightPounds: profile.emptyWeight?.value ?? 0,
    maximumPayloadPounds: profile.maximumPayload?.value ?? 0,
    reefer: profile.reefer,
    liftgate: profile.liftgate,
    specialEquipment: profile.specialEquipment,
    notes: profile.notes ?? '',
  };
}

export function loadFormFromProfile(id: string, value: unknown): LoadForm {
  const profile = LoadProfileSchema.parse(value);
  const temperature = profile.temperatureRequirements;
  const permitIdentifiers = profile.permits.map((permit) => permit.identifier);
  return {
    id,
    referenceNumber: profile.loadIdentifier,
    commodityDescription: profile.commodity,
    hazmat: profile.hazmat,
    hazmatClass: profile.hazmatClass ?? '',
    cargoWeightPounds: profile.grossCargoWeight?.value ?? 0,
    steerAxleWeightPounds: profile.steerAxleWeight?.value ?? 0,
    driveAxleWeightPounds: profile.driveAxleWeight?.value ?? 0,
    trailerAxleWeightPounds: profile.trailerAxleWeight?.value ?? 0,
    totalGrossWeightPounds: profile.totalGrossCombinationWeight?.value ?? 0,
    lengthFeet: profile.length === undefined ? 0 : toFeet(profile.length),
    heightFeet: profile.height === undefined ? 0 : toFeet(profile.height),
    widthFeet: profile.width === undefined ? 0 : toFeet(profile.width),
    frontOverhangFeet:
      profile.frontOverhang === undefined ? 0 : toFeet(profile.frontOverhang),
    rearOverhangFeet:
      profile.rearOverhang === undefined ? 0 : toFeet(profile.rearOverhang),
    temperatureReeferRequired: temperature?.reeferRequired ?? false,
    temperatureMinimumFahrenheit:
      temperature?.minimum === undefined
        ? null
        : toFahrenheit(temperature.minimum),
    temperatureMaximumFahrenheit:
      temperature?.maximum === undefined
        ? null
        : toFahrenheit(temperature.maximum),
    temperatureSetPointFahrenheit:
      temperature?.setPoint === undefined
        ? null
        : toFahrenheit(temperature.setPoint),
    temperatureExplanation: temperature?.explanation ?? '',
    permitRequirement: profile.permitRequirement,
    permitIdentifiers,
    permits: profile.permits.map((permit) => ({
      ...createLoadPermitForm(permit.identifier),
      jurisdictionCode: permit.jurisdictionCode ?? '',
      restrictions: permit.restrictions,
    })),
    escortRequirements: profile.escortRequirements,
    routeRestrictions: profile.routeRestrictions,
    secureParkingRequirement: profile.secureParkingRequirement,
    notes: profile.notes ?? '',
  };
}

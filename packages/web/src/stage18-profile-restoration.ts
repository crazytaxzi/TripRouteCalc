import type {
  LoadProfileFacts,
  TractorProfileFacts,
  TrailerProfileFacts,
} from './stage18-detail-types.js';
import {
  defaultLoad,
  defaultTractor,
  defaultTrailer,
  isRecord,
} from './stage18-detail-types.js';

function valueNumber(value: unknown): number {
  return typeof value === 'object' && value !== null && 'value' in value
    ? Number((value as { readonly value?: unknown }).value ?? 0)
    : 0;
}

function profileRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function tractorFactsFromProfile(
  id: string,
  value: unknown,
): TractorProfileFacts {
  const profile = profileRecord(value);
  const compliance = profileRecord(profile.californiaCompliance);
  const idle = profileRecord(profile.idleAuxiliaryPower);
  const overall = valueNumber(profile.overallLength);
  const wheelbase = valueNumber(profile.wheelbase);
  const height = valueNumber(profile.height);
  const speed = (input: unknown): number => valueNumber(input) / 0.447_04;
  return {
    ...defaultTractor(),
    id,
    dirty: false,
    unitNumber: stringValue(profile.unitNumber),
    vin: stringValue(profile.vin),
    tractorType: (profile.tractorType ?? 'sleeper') as TractorProfileFacts['tractorType'],
    axleCount: Number(profile.axleCount ?? 0),
    overallLengthFeet: overall / 12,
    wheelbaseFeet: wheelbase / 12,
    heightFeet: height / 12,
    widthInches: valueNumber(profile.width),
    emptyWeightPounds: valueNumber(profile.emptyWeight),
    grossVehicleWeightRatingPounds: valueNumber(profile.grossVehicleWeightRating),
    registeredGrossWeightPounds: valueNumber(profile.registeredGrossWeight),
    fuelCapacityGallons: valueNumber(profile.fuelCapacity),
    estimatedFuelRangeMiles: valueNumber(profile.estimatedFuelRange) / 1_609.344,
    governedSpeedMph: speed(profile.governedSpeed),
    planningCruiseSpeedMph: speed(profile.planningCruiseSpeed),
    hazmatEquipped: Boolean(profile.hazmatEquipped),
    californiaComplianceStatus: (compliance.status ?? 'not-evaluated') as TractorProfileFacts['californiaComplianceStatus'],
    californiaComplianceSource: stringValue(compliance.sourceName),
    californiaComplianceVerifiedAt: stringValue(compliance.verifiedAt),
    californiaComplianceExplanation: stringValue(compliance.explanation),
    idleAllowed: Boolean(idle.idleAllowed),
    auxiliaryPowerUnitAvailable: Boolean(idle.auxiliaryPowerUnitAvailable),
    notes: stringValue(profile.notes),
  };
}

export function trailerFactsFromProfile(
  id: string,
  value: unknown,
): TrailerProfileFacts {
  const profile = profileRecord(value);
  const mappings = Array.isArray(profile.railPositionMappings)
    ? profile.railPositionMappings
    : [];
  return {
    ...defaultTrailer(),
    id,
    dirty: false,
    trailerNumber: stringValue(profile.trailerNumber),
    trailerType: (profile.trailerType ?? 'dry-van') as TrailerProfileFacts['trailerType'],
    lengthFeet: valueNumber(profile.length) / 12,
    widthInches: valueNumber(profile.width),
    heightFeet: valueNumber(profile.height) / 12,
    axleCount: Number(profile.axleCount ?? 0),
    slidingTandemCapability: Boolean(profile.slidingTandemCapability),
    axleConfiguration: (profile.axleConfiguration ?? 'sliding') as TrailerProfileFacts['axleConfiguration'],
    currentKpraFeet: valueNumber(profile.currentKpra) / 12,
    minimumKpraFeet: valueNumber(profile.minimumAchievableKpra) / 12,
    maximumKpraFeet: valueNumber(profile.maximumAchievableKpra) / 12,
    currentRailPosition: stringValue(profile.currentRailPosition),
    railPositionMappingsText: mappings
      .map((mapping) => {
        const row = profileRecord(mapping);
        return [
          stringValue(row.railPosition),
          String(valueNumber(row.kpra) / 12),
          stringValue(row.verificationSource),
          stringValue(row.verifiedAt),
          stringValue(row.explanation),
        ].join('|');
      })
      .join('\n'),
    emptyWeightPounds: valueNumber(profile.emptyWeight),
    grossVehicleWeightRatingPounds: valueNumber(profile.grossVehicleWeightRating),
    maximumPayloadPounds: valueNumber(profile.maximumPayload),
    reefer: Boolean(profile.reefer),
    liftgate: Boolean(profile.liftgate),
    specialEquipmentText: Array.isArray(profile.specialEquipment)
      ? profile.specialEquipment.map(String).join('\n')
      : '',
    notes: stringValue(profile.notes),
  };
}

export function loadFactsFromProfile(
  id: string,
  value: unknown,
): LoadProfileFacts {
  const profile = profileRecord(value);
  const temperature = profileRecord(profile.temperatureRequirements);
  const permitRows = Array.isArray(profile.permits) ? profile.permits : [];
  const fahrenheitValue = (input: unknown): number | null => {
    const celsius = valueNumber(input);
    return input === undefined ? null : (celsius * 9) / 5 + 32;
  };
  return {
    ...defaultLoad(),
    id,
    dirty: false,
    loadIdentifier: stringValue(profile.loadIdentifier),
    commodity: stringValue(profile.commodity),
    hazmat: Boolean(profile.hazmat),
    hazmatClass: stringValue(profile.hazmatClass),
    grossCargoWeightPounds: valueNumber(profile.grossCargoWeight),
    steerAxleWeightPounds: valueNumber(profile.steerAxleWeight),
    driveAxleWeightPounds: valueNumber(profile.driveAxleWeight),
    trailerAxleWeightPounds: valueNumber(profile.trailerAxleWeight),
    totalGrossCombinationWeightPounds: valueNumber(profile.totalGrossCombinationWeight),
    lengthFeet: valueNumber(profile.length) / 12,
    widthFeet: valueNumber(profile.width) / 12,
    heightFeet: valueNumber(profile.height) / 12,
    frontOverhangFeet: valueNumber(profile.frontOverhang) / 12,
    rearOverhangFeet: valueNumber(profile.rearOverhang) / 12,
    reeferRequired: Boolean(temperature.reeferRequired),
    minimumTemperatureFahrenheit: fahrenheitValue(temperature.minimum),
    maximumTemperatureFahrenheit: fahrenheitValue(temperature.maximum),
    setPointTemperatureFahrenheit: fahrenheitValue(temperature.setPoint),
    temperatureExplanation: stringValue(temperature.explanation),
    permitRequirement: (profile.permitRequirement ?? 'unknown') as LoadProfileFacts['permitRequirement'],
    permitsText: permitRows
      .map((permit) => {
        const row = profileRecord(permit);
        return [
          stringValue(row.identifier),
          stringValue(row.jurisdictionCode),
          Array.isArray(row.restrictions) ? row.restrictions.map(String).join(';') : '',
        ].join('|');
      })
      .join('\n'),
    escortRequirementsText: Array.isArray(profile.escortRequirements)
      ? profile.escortRequirements.map(String).join('\n')
      : '',
    routeRestrictionsText: Array.isArray(profile.routeRestrictions)
      ? profile.routeRestrictions.map(String).join('\n')
      : '',
    secureParkingRequirement: (profile.secureParkingRequirement ?? 'none') as LoadProfileFacts['secureParkingRequirement'],
    notes: stringValue(profile.notes),
  };
}

import type {
  EquipmentEvidenceSource,
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

function lengthFeet(value: number): Readonly<{ value: number; unit: 'inch' }> {
  return { value: value * 12, unit: 'inch' };
}
function lengthInches(value: number): Readonly<{ value: number; unit: 'inch' }> {
  return { value, unit: 'inch' };
}
function weightPounds(value: number): Readonly<{ value: number; unit: 'pound' }> {
  return { value, unit: 'pound' };
}
function speedMph(value: number): Readonly<{ value: number; unit: 'meter-per-second' }> {
  return { value: value * 0.447_04, unit: 'meter-per-second' };
}
function distanceMiles(value: number): Readonly<{ value: number; unit: 'meter' }> {
  return { value: value * 1_609.344, unit: 'meter' };
}
function gallons(value: number): Readonly<{ value: number; unit: 'us-gallon' }> {
  return { value, unit: 'us-gallon' };
}
function fahrenheit(value: number): Readonly<{ value: number; unit: 'celsius' }> {
  return { value: ((value - 32) * 5) / 9, unit: 'celsius' };
}

function nonempty(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function list(value: string): readonly string[] {
  return value
    .split(/[\n,]/u)
    .map((entry): string => entry.trim())
    .filter((entry): boolean => entry !== '');
}

function evidence(
  sourceType: EquipmentEvidenceSource | '',
  sourceName: string,
  fieldPaths: readonly string[],
): readonly Readonly<Record<string, unknown>>[] {
  if (sourceType === '') return [];
  return fieldPaths.map((fieldPath) => ({
    fieldPath,
    sourceType,
    ...(nonempty(sourceName) === undefined ? {} : { sourceName: sourceName.trim() }),
    explanation: 'Source classification selected in the Stage 18 equipment form.',
  }));
}

export function tractorProfilePayload(
  facts: TractorProfileFacts,
): Readonly<Record<string, unknown>> {
  const paths = [
    'overallLength', 'wheelbase', 'height', 'width', 'emptyWeight',
    'grossVehicleWeightRating', 'registeredGrossWeight', 'fuelCapacity',
    'estimatedFuelRange', 'governedSpeed', 'planningCruiseSpeed',
  ];
  return {
    unitNumber: facts.unitNumber.trim(),
    ...(nonempty(facts.vin) === undefined ? {} : { vin: facts.vin.trim().toUpperCase() }),
    tractorType: facts.tractorType,
    axleCount: facts.axleCount,
    overallLength: lengthFeet(facts.overallLengthFeet),
    ...(facts.wheelbaseFeet > 0 ? { wheelbase: lengthFeet(facts.wheelbaseFeet) } : {}),
    height: lengthFeet(facts.heightFeet),
    width: lengthInches(facts.widthInches),
    ...(facts.emptyWeightPounds > 0 ? { emptyWeight: weightPounds(facts.emptyWeightPounds) } : {}),
    ...(facts.grossVehicleWeightRatingPounds > 0 ? { grossVehicleWeightRating: weightPounds(facts.grossVehicleWeightRatingPounds) } : {}),
    registeredGrossWeight: weightPounds(facts.registeredGrossWeightPounds),
    ...(facts.fuelCapacityGallons > 0 ? { fuelCapacity: gallons(facts.fuelCapacityGallons) } : {}),
    ...(facts.estimatedFuelRangeMiles > 0 ? { estimatedFuelRange: distanceMiles(facts.estimatedFuelRangeMiles) } : {}),
    governedSpeed: speedMph(facts.governedSpeedMph),
    planningCruiseSpeed: speedMph(facts.planningCruiseSpeedMph),
    hazmatEquipped: facts.hazmatEquipped,
    californiaCompliance: {
      status: facts.californiaComplianceStatus,
      ...(nonempty(facts.californiaComplianceSource) === undefined ? {} : { sourceName: facts.californiaComplianceSource.trim() }),
      ...(nonempty(facts.californiaComplianceVerifiedAt) === undefined ? {} : { verifiedAt: facts.californiaComplianceVerifiedAt.trim() }),
      ...(nonempty(facts.californiaComplianceExplanation) === undefined ? {} : { explanation: facts.californiaComplianceExplanation.trim() }),
    },
    idleAuxiliaryPower: {
      idleAllowed: facts.idleAllowed,
      auxiliaryPowerUnitAvailable: facts.auxiliaryPowerUnitAvailable,
    },
    ...(nonempty(facts.notes) === undefined ? {} : { notes: facts.notes.trim() }),
    fieldEvidence: evidence(facts.sourceType, facts.sourceName, paths),
    extensionMetadata: {},
  };
}

function railMappings(text: string): readonly Readonly<Record<string, unknown>>[] {
  return text
    .split(/\r?\n/u)
    .map((line): string => line.trim())
    .filter((line): boolean => line !== '')
    .map((line) => {
      const [railPosition = '', kpraFeet = '', source = '', verifiedAt = '', explanation = ''] = line.split('|');
      return {
        railPosition: railPosition.trim(),
        kpra: lengthFeet(Number(kpraFeet.trim())),
        verificationSource: source.trim(),
        verifiedAt: verifiedAt.trim(),
        ...(nonempty(explanation) === undefined ? {} : { explanation: explanation.trim() }),
      };
    });
}

export function trailerProfilePayload(
  facts: TrailerProfileFacts,
): Readonly<Record<string, unknown>> {
  const paths = [
    'length', 'width', 'height', 'currentKpra', 'minimumAchievableKpra',
    'maximumAchievableKpra', 'emptyWeight', 'grossVehicleWeightRating',
    'maximumPayload',
  ];
  return {
    trailerNumber: facts.trailerNumber.trim(),
    trailerType: facts.trailerType,
    length: lengthFeet(facts.lengthFeet),
    width: lengthInches(facts.widthInches),
    height: lengthFeet(facts.heightFeet),
    axleCount: facts.axleCount,
    slidingTandemCapability: facts.slidingTandemCapability,
    axleConfiguration: facts.axleConfiguration,
    currentKpra: lengthFeet(facts.currentKpraFeet),
    minimumAchievableKpra: lengthFeet(facts.minimumKpraFeet),
    maximumAchievableKpra: lengthFeet(facts.maximumKpraFeet),
    ...(nonempty(facts.currentRailPosition) === undefined ? {} : { currentRailPosition: facts.currentRailPosition.trim() }),
    railPositionMappings: railMappings(facts.railPositionMappingsText),
    ...(facts.emptyWeightPounds > 0 ? { emptyWeight: weightPounds(facts.emptyWeightPounds) } : {}),
    ...(facts.grossVehicleWeightRatingPounds > 0 ? { grossVehicleWeightRating: weightPounds(facts.grossVehicleWeightRatingPounds) } : {}),
    maximumPayload: weightPounds(facts.maximumPayloadPounds),
    reefer: facts.reefer,
    liftgate: facts.liftgate,
    specialEquipment: list(facts.specialEquipmentText),
    ...(nonempty(facts.notes) === undefined ? {} : { notes: facts.notes.trim() }),
    fieldEvidence: evidence(facts.sourceType, facts.sourceName, paths),
    extensionMetadata: {},
  };
}

function permits(text: string): readonly Readonly<Record<string, unknown>>[] {
  return text
    .split(/\r?\n/u)
    .map((line): string => line.trim())
    .filter((line): boolean => line !== '')
    .map((line) => {
      const [identifier = '', jurisdictionCode = '', restrictions = ''] = line.split('|');
      return {
        identifier: identifier.trim(),
        ...(nonempty(jurisdictionCode) === undefined ? {} : { jurisdictionCode: jurisdictionCode.trim() }),
        restrictions: restrictions
          .split(';')
          .map((entry): string => entry.trim())
          .filter((entry): boolean => entry !== ''),
      };
    });
}

export function loadProfilePayload(
  facts: LoadProfileFacts,
): Readonly<Record<string, unknown>> {
  const paths = [
    'grossCargoWeight', 'steerAxleWeight', 'driveAxleWeight',
    'trailerAxleWeight', 'totalGrossCombinationWeight', 'length', 'width',
    'height', 'frontOverhang', 'rearOverhang',
  ];
  const hasTemperature =
    facts.reeferRequired ||
    facts.minimumTemperatureFahrenheit !== null ||
    facts.maximumTemperatureFahrenheit !== null ||
    facts.setPointTemperatureFahrenheit !== null;
  return {
    loadIdentifier: facts.loadIdentifier.trim(),
    commodity: facts.commodity.trim(),
    hazmat: facts.hazmat,
    ...(facts.hazmat && nonempty(facts.hazmatClass) !== undefined ? { hazmatClass: facts.hazmatClass.trim() } : {}),
    grossCargoWeight: weightPounds(facts.grossCargoWeightPounds),
    steerAxleWeight: weightPounds(facts.steerAxleWeightPounds),
    driveAxleWeight: weightPounds(facts.driveAxleWeightPounds),
    trailerAxleWeight: weightPounds(facts.trailerAxleWeightPounds),
    totalGrossCombinationWeight: weightPounds(facts.totalGrossCombinationWeightPounds),
    length: lengthFeet(facts.lengthFeet),
    width: lengthFeet(facts.widthFeet),
    height: lengthFeet(facts.heightFeet),
    ...(facts.frontOverhangFeet > 0 ? { frontOverhang: lengthFeet(facts.frontOverhangFeet) } : {}),
    ...(facts.rearOverhangFeet > 0 ? { rearOverhang: lengthFeet(facts.rearOverhangFeet) } : {}),
    ...(hasTemperature
      ? {
          temperatureRequirements: {
            reeferRequired: facts.reeferRequired,
            ...(facts.minimumTemperatureFahrenheit === null ? {} : { minimum: fahrenheit(facts.minimumTemperatureFahrenheit) }),
            ...(facts.maximumTemperatureFahrenheit === null ? {} : { maximum: fahrenheit(facts.maximumTemperatureFahrenheit) }),
            ...(facts.setPointTemperatureFahrenheit === null ? {} : { setPoint: fahrenheit(facts.setPointTemperatureFahrenheit) }),
            ...(nonempty(facts.temperatureExplanation) === undefined ? {} : { explanation: facts.temperatureExplanation.trim() }),
          },
        }
      : {}),
    permitRequirement: facts.permitRequirement,
    permits: permits(facts.permitsText),
    escortRequirements: list(facts.escortRequirementsText),
    routeRestrictions: list(facts.routeRestrictionsText),
    secureParkingRequirement: facts.secureParkingRequirement,
    ...(nonempty(facts.notes) === undefined ? {} : { notes: facts.notes.trim() }),
    fieldEvidence: evidence(facts.sourceType, facts.sourceName, paths),
    extensionMetadata: {},
  };
}

function valueNumber(value: unknown): number {
  return typeof value === 'object' && value !== null && 'value' in value
    ? Number((value as { readonly value?: unknown }).value ?? 0)
    : 0;
}

function profileRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
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
    unitNumber: String(profile.unitNumber ?? ''),
    vin: String(profile.vin ?? ''),
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
    californiaComplianceSource: String(compliance.sourceName ?? ''),
    californiaComplianceVerifiedAt: String(compliance.verifiedAt ?? ''),
    californiaComplianceExplanation: String(compliance.explanation ?? ''),
    idleAllowed: Boolean(idle.idleAllowed),
    auxiliaryPowerUnitAvailable: Boolean(idle.auxiliaryPowerUnitAvailable),
    notes: String(profile.notes ?? ''),
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
    trailerNumber: String(profile.trailerNumber ?? ''),
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
    currentRailPosition: String(profile.currentRailPosition ?? ''),
    railPositionMappingsText: mappings
      .map((mapping) => {
        const row = profileRecord(mapping);
        return [
          String(row.railPosition ?? ''),
          String(valueNumber(row.kpra) / 12),
          String(row.verificationSource ?? ''),
          String(row.verifiedAt ?? ''),
          String(row.explanation ?? ''),
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
    notes: String(profile.notes ?? ''),
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
    loadIdentifier: String(profile.loadIdentifier ?? ''),
    commodity: String(profile.commodity ?? ''),
    hazmat: Boolean(profile.hazmat),
    hazmatClass: String(profile.hazmatClass ?? ''),
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
    temperatureExplanation: String(temperature.explanation ?? ''),
    permitRequirement: (profile.permitRequirement ?? 'unknown') as LoadProfileFacts['permitRequirement'],
    permitsText: permitRows
      .map((permit) => {
        const row = profileRecord(permit);
        return [
          String(row.identifier ?? ''),
          String(row.jurisdictionCode ?? ''),
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
    notes: String(profile.notes ?? ''),
  };
}

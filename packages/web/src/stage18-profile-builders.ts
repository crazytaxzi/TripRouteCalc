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

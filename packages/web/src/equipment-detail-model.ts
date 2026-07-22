import {
  buildStage18CommercialRouteRequest,
  distanceInMiles,
  lengthInFeet,
  lengthInInches,
  loadProfile,
  speedInMilesPerHour,
  temperatureInFahrenheit,
  tractorProfile,
  trailerProfile,
  utcInstant,
  validateEquipmentCombination,
  volumeInUsGallons,
  weightInPounds,
} from '@trip-route-calc/foundation';
import type {
  EquipmentCombination,
  LoadProfile,
  TractorProfile,
  TrailerProfile,
} from '@trip-route-calc/foundation';
import { z } from 'zod';

import { createLoadPermitForm } from './equipment-details.js';
import {
  DRAFT_STORAGE_KEY,
  commercialLocation,
  loadDraft,
  localToInstant,
} from './model.js';
import type {
  LoadForm,
  TrailerForm,
  TractorForm,
  TripDraft,
  ValidationIssue,
} from './types.js';

const finiteNumber = z.number().finite();
const optionalString = z.string().optional();
const railMappingSchema = z.object({
  localId: z.string().trim().min(1),
  railPosition: z.string(),
  kpraFeet: finiteNumber,
  verificationSource: z.string(),
  verifiedAt: z.string(),
  explanation: z.string(),
});
const permitSchema = z.object({
  localId: z.string().trim().min(1),
  identifier: z.string(),
  jurisdictionCode: z.string(),
  restrictions: z.array(z.string()),
});
const tractorDetailsSchema = z.object({
  vin: optionalString,
  wheelbaseFeet: finiteNumber.optional(),
  californiaComplianceStatus: z
    .enum([
      'not-evaluated',
      'carrier-asserted-compliant',
      'carrier-asserted-noncompliant',
      'manual-verification-required',
    ])
    .optional(),
  californiaComplianceSourceName: optionalString,
  californiaComplianceVerifiedAt: optionalString,
  californiaComplianceExplanation: optionalString,
  notes: optionalString,
});
const trailerDetailsSchema = z.object({
  currentRailPosition: optionalString,
  railPositionMappings: z.array(railMappingSchema).optional(),
  liftgate: z.boolean().optional(),
  specialEquipment: z.array(z.string()).optional(),
  notes: optionalString,
});
const loadDetailsSchema = z.object({
  frontOverhangFeet: finiteNumber.optional(),
  rearOverhangFeet: finiteNumber.optional(),
  temperatureReeferRequired: z.boolean().optional(),
  temperatureMinimumFahrenheit: finiteNumber.nullable().optional(),
  temperatureMaximumFahrenheit: finiteNumber.nullable().optional(),
  temperatureSetPointFahrenheit: finiteNumber.nullable().optional(),
  temperatureExplanation: optionalString,
  permits: z.array(permitSchema).optional(),
  escortRequirements: z.array(z.string()).optional(),
  routeRestrictions: z.array(z.string()).optional(),
  secureParkingRequirement: z
    .enum([
      'none',
      'high-value',
      'secure-parking',
      'high-value-and-secure-parking',
    ])
    .optional(),
  notes: optionalString,
});

function record(value: unknown): Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function optionalPositive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

function permitRows(form: LoadForm): readonly NonNullable<LoadForm['permits']>[number][] {
  if (form.permits !== undefined) return form.permits;
  return form.permitIdentifiers.map((identifierValue) =>
    createLoadPermitForm(identifierValue),
  );
}

export function detailedTractorFromForm(form: TractorForm): TractorProfile {
  const complianceStatus =
    form.californiaComplianceStatus ?? 'not-evaluated';
  const wheelbase = optionalPositive(form.wheelbaseFeet);
  const verifiedAt = optionalText(form.californiaComplianceVerifiedAt);
  return tractorProfile({
    unitNumber: form.unitNumber,
    ...(optionalText(form.vin) === undefined ? {} : { vin: form.vin }),
    tractorType: form.tractorType,
    axleCount: form.axleCount,
    overallLength: lengthInFeet(form.overallLengthFeet),
    ...(wheelbase === undefined ? {} : { wheelbase: lengthInFeet(wheelbase) }),
    height: lengthInFeet(form.heightFeet),
    width: lengthInInches(form.widthInches),
    emptyWeight: weightInPounds(form.emptyWeightPounds),
    registeredGrossWeight: weightInPounds(form.registeredGrossWeightPounds),
    fuelCapacity: volumeInUsGallons(form.fuelCapacityGallons),
    estimatedFuelRange: distanceInMiles(form.estimatedFuelRangeMiles),
    governedSpeed: speedInMilesPerHour(form.governedSpeedMph),
    planningCruiseSpeed: speedInMilesPerHour(form.planningSpeedMph),
    hazmatEquipped: form.hazmatEquipped,
    californiaCompliance: {
      status: complianceStatus,
      ...(optionalText(form.californiaComplianceSourceName) === undefined
        ? {}
        : { sourceName: form.californiaComplianceSourceName }),
      ...(verifiedAt === undefined
        ? {}
        : { verifiedAt: utcInstant(verifiedAt) }),
      ...(optionalText(form.californiaComplianceExplanation) === undefined
        ? {}
        : { explanation: form.californiaComplianceExplanation }),
    },
    idleAuxiliaryPower: {
      idleAllowed: form.idleAllowed,
      auxiliaryPowerUnitAvailable: form.apuAvailable,
    },
    ...(optionalText(form.notes) === undefined ? {} : { notes: form.notes }),
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function detailedTrailerFromForm(form: TrailerForm): TrailerProfile {
  return trailerProfile({
    trailerNumber: form.unitNumber,
    trailerType: form.trailerType,
    length: lengthInFeet(form.lengthFeet),
    width: lengthInInches(form.widthInches),
    height: lengthInFeet(form.heightFeet),
    axleCount: form.axleCount,
    slidingTandemCapability: form.slidingTandemCapability,
    axleConfiguration: form.axleConfiguration,
    currentKpra: lengthInFeet(form.currentKpraFeet),
    minimumAchievableKpra: lengthInFeet(form.minimumKpraFeet),
    maximumAchievableKpra: lengthInFeet(form.maximumKpraFeet),
    ...(optionalText(form.currentRailPosition) === undefined
      ? {}
      : { currentRailPosition: form.currentRailPosition }),
    railPositionMappings: (form.railPositionMappings ?? []).map((mapping) => ({
      railPosition: mapping.railPosition,
      kpra: lengthInFeet(mapping.kpraFeet),
      verificationSource: mapping.verificationSource,
      verifiedAt: utcInstant(mapping.verifiedAt),
      ...(optionalText(mapping.explanation) === undefined
        ? {}
        : { explanation: mapping.explanation }),
    })),
    emptyWeight: weightInPounds(form.emptyWeightPounds),
    maximumPayload: weightInPounds(form.maximumPayloadPounds),
    reefer: form.reefer,
    liftgate: form.liftgate ?? false,
    specialEquipment: (form.specialEquipment ?? []).filter(
      (item) => item.trim() !== '',
    ),
    ...(optionalText(form.notes) === undefined ? {} : { notes: form.notes }),
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function detailedLoadFromForm(form: LoadForm): LoadProfile {
  const minimum = form.temperatureMinimumFahrenheit;
  const maximum = form.temperatureMaximumFahrenheit;
  const setPoint = form.temperatureSetPointFahrenheit;
  const hasTemperature =
    form.temperatureReeferRequired === true ||
    minimum != null ||
    maximum != null ||
    setPoint != null ||
    optionalText(form.temperatureExplanation) !== undefined;
  return loadProfile({
    loadIdentifier: form.referenceNumber,
    commodity: form.commodityDescription,
    hazmat: form.hazmat,
    ...(form.hazmat && form.hazmatClass.trim() !== ''
      ? { hazmatClass: form.hazmatClass }
      : {}),
    grossCargoWeight: weightInPounds(form.cargoWeightPounds),
    steerAxleWeight: weightInPounds(form.steerAxleWeightPounds),
    driveAxleWeight: weightInPounds(form.driveAxleWeightPounds),
    trailerAxleWeight: weightInPounds(form.trailerAxleWeightPounds),
    totalGrossCombinationWeight: weightInPounds(form.totalGrossWeightPounds),
    length: lengthInFeet(form.lengthFeet),
    height: lengthInFeet(form.heightFeet),
    width: lengthInFeet(form.widthFeet),
    ...(optionalPositive(form.frontOverhangFeet) === undefined
      ? {}
      : { frontOverhang: lengthInFeet(form.frontOverhangFeet ?? 0) }),
    ...(optionalPositive(form.rearOverhangFeet) === undefined
      ? {}
      : { rearOverhang: lengthInFeet(form.rearOverhangFeet ?? 0) }),
    ...(hasTemperature
      ? {
          temperatureRequirements: {
            reeferRequired: form.temperatureReeferRequired ?? false,
            ...(minimum == null
              ? {}
              : { minimum: temperatureInFahrenheit(minimum) }),
            ...(maximum == null
              ? {}
              : { maximum: temperatureInFahrenheit(maximum) }),
            ...(setPoint == null
              ? {}
              : { setPoint: temperatureInFahrenheit(setPoint) }),
            ...(optionalText(form.temperatureExplanation) === undefined
              ? {}
              : { explanation: form.temperatureExplanation }),
          },
        }
      : {}),
    permitRequirement: form.permitRequirement,
    permits: permitRows(form).map((permit) => ({
      identifier: permit.identifier,
      ...(optionalText(permit.jurisdictionCode) === undefined
        ? {}
        : { jurisdictionCode: permit.jurisdictionCode }),
      restrictions: permit.restrictions.filter((item) => item.trim() !== ''),
    })),
    escortRequirements: (form.escortRequirements ?? []).filter(
      (item) => item.trim() !== '',
    ),
    routeRestrictions: (form.routeRestrictions ?? []).filter(
      (item) => item.trim() !== '',
    ),
    secureParkingRequirement: form.secureParkingRequirement ?? 'none',
    ...(optionalText(form.notes) === undefined ? {} : { notes: form.notes }),
    fieldEvidence: [],
    extensionMetadata: {},
  });
}

export function detailedEquipmentFromDraft(
  draft: TripDraft,
): EquipmentCombination {
  return {
    tractor: detailedTractorFromForm(draft.tractor),
    trailer: detailedTrailerFromForm(draft.trailer),
    load: detailedLoadFromForm(draft.load),
  };
}

export function validateDetailedEquipment(
  draft: TripDraft,
): readonly ValidationIssue[] {
  try {
    return validateEquipmentCombination(detailedEquipmentFromDraft(draft)).issues.map(
      (issue) => ({
        severity:
          issue.level === 'blocking-error'
            ? 'error'
            : issue.level === 'action-required-warning'
              ? 'warning'
              : 'information',
        path: issue.path,
        message: issue.message,
      }),
    );
  } catch (error) {
    return [
      {
        severity: 'error',
        path: 'equipment',
        message:
          error instanceof Error
            ? error.message
            : 'Advanced equipment validation failed.',
      },
    ];
  }
}

function routeIdentifier(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function detailedRouteRequestFromDraft(
  draft: TripDraft,
  publicStops: readonly TripDraft['stops'][number][],
): ReturnType<typeof buildStage18CommercialRouteRequest> {
  const first = publicStops[0];
  if (first === undefined || first.publicId === undefined) {
    throw new RangeError('The start stop must be persisted before routing.');
  }
  const avoidances = [
    ...(draft.route.avoidTolls ? (['tolls'] as const) : []),
    ...(draft.route.avoidFerries ? (['ferries'] as const) : []),
    ...(draft.route.avoidTunnels ? (['tunnels'] as const) : []),
  ];
  return buildStage18CommercialRouteRequest({
    requestId: routeIdentifier('route-request'),
    requestedAt: utcInstant(new Date().toISOString()),
    departureAt: localToInstant(
      draft.hos.departureLocal,
      draft.hos.departureTimeZone,
    ),
    equipment: detailedEquipmentFromDraft(draft),
    origin: commercialLocation(first, first.publicId),
    orderedStops: publicStops.slice(1).map((stop, index) => {
      if (stop.publicId === undefined) {
        throw new RangeError('Every route stop must be persisted before routing.');
      }
      return {
        stopId: stop.publicId,
        sequence: index + 1,
        required: stop.required,
        location: commercialLocation(stop, stop.publicId),
      };
    }),
    routePolicy: draft.route.policy,
    avoidances,
  });
}

export function saveDetailedDraft(draft: TripDraft): void {
  const saved: TripDraft = { ...draft, savedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(saved));
}

export function loadDetailedDraft(): TripDraft | undefined {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  let rawDraft: Record<string, unknown> = {};
  if (raw !== null) {
    try {
      rawDraft = record(JSON.parse(raw));
    } catch {
      return loadDraft();
    }
  }
  const base = loadDraft();
  if (base === undefined) return undefined;
  const rawTractor = tractorDetailsSchema.safeParse(record(rawDraft.tractor));
  const rawTrailer = trailerDetailsSchema.safeParse(record(rawDraft.trailer));
  const rawLoadRecord = record(rawDraft.load);
  const rawLoad = loadDetailsSchema.safeParse(rawLoadRecord);
  const rawPermitIdentifiers = rawLoadRecord.permitIdentifiers;
  const legacyPermitIdentifiers = Array.isArray(rawPermitIdentifiers)
    ? rawPermitIdentifiers.filter(
        (value): value is string => typeof value === 'string',
      )
    : base.load.permitIdentifiers;
  const merged: TripDraft = {
    ...base,
    tractor: {
      ...base.tractor,
      ...(rawTractor.success ? rawTractor.data : {}),
    },
    trailer: {
      ...base.trailer,
      ...(rawTrailer.success ? rawTrailer.data : {}),
    },
    load: {
      ...base.load,
      ...(rawLoad.success ? rawLoad.data : {}),
      permitIdentifiers: legacyPermitIdentifiers,
      permits:
        rawLoad.success && rawLoad.data.permits !== undefined
          ? rawLoad.data.permits
          : legacyPermitIdentifiers.map((identifierValue) =>
              createLoadPermitForm(identifierValue),
            ),
    },
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

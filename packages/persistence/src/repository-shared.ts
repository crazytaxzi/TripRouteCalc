import type { StopType, UtcInstant } from '@trip-route-calc/foundation';

import { TenantObjectNotFoundError } from './errors.js';
import { toJsonObject } from './json.js';
import type { Prisma } from './generated/prisma/client.js';

export function asInputJson(value: unknown, path: string): Prisma.InputJsonValue {
  return toJsonObject(value, path);
}

export function toDate(value: UtcInstant): Date {
  return new Date(value);
}

type PrismaStopType = Prisma.TripStopUncheckedCreateInput['type'];
type PrismaWarningSeverity = Prisma.ComplianceWarningUncheckedCreateInput['severity'];
type PrismaCalculationConfidence =
  Prisma.CalculationResultUncheckedCreateInput['confidence'];
type PrismaProviderStorageMode =
  Prisma.RouteProviderResponseUncheckedCreateInput['storageMode'];
type PrismaRuleSetStatus = NonNullable<
  Prisma.RegulatoryRuleSetUncheckedCreateInput['status']
>;

export const PRISMA_STOP_TYPES: Readonly<Record<StopType, PrismaStopType>> = {
  'start-location': 'START_LOCATION',
  'tractor-pickup': 'TRACTOR_PICKUP',
  'trailer-pickup': 'TRAILER_PICKUP',
  shipper: 'SHIPPER',
  'intermediate-pickup': 'INTERMEDIATE_PICKUP',
  'intermediate-delivery': 'INTERMEDIATE_DELIVERY',
  'final-consignee': 'FINAL_CONSIGNEE',
  fuel: 'FUEL',
  scale: 'SCALE',
  inspection: 'INSPECTION',
  maintenance: 'MAINTENANCE',
  food: 'FOOD',
  'driver-break': 'DRIVER_BREAK',
  'sleeper-rest': 'SLEEPER_REST',
  terminal: 'TERMINAL',
  'border-crossing': 'BORDER_CROSSING',
  other: 'OTHER',
};

export const PRISMA_WARNING_SEVERITIES: Readonly<
  Record<'information' | 'warning' | 'blocking', PrismaWarningSeverity>
> = {
  information: 'INFORMATION',
  warning: 'WARNING',
  blocking: 'BLOCKING',
};

export const PRISMA_CALCULATION_CONFIDENCE: Readonly<
  Record<'high' | 'moderate' | 'low' | 'unverified', PrismaCalculationConfidence>
> = {
  high: 'HIGH',
  moderate: 'MODERATE',
  low: 'LOW',
  unverified: 'UNVERIFIED',
};

export const PRISMA_PROVIDER_STORAGE_MODES: Readonly<
  Record<
    'raw-json' | 'normalized-snapshot' | 'provider-reference',
    PrismaProviderStorageMode
  >
> = {
  'raw-json': 'RAW_JSON',
  'normalized-snapshot': 'NORMALIZED_SNAPSHOT',
  'provider-reference': 'PROVIDER_REFERENCE',
};

export const PRISMA_RULE_SET_STATUSES: Readonly<
  Record<'draft' | 'active' | 'inactive', PrismaRuleSetStatus>
> = {
  draft: 'DRAFT',
  active: 'ACTIVE',
  inactive: 'INACTIVE',
};

export function positiveSequence(value: number, path: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${path} must be a positive safe integer.`);
  }
  return value;
}

export function assertSha256(value: string, path: string): string {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256 hex digest.`);
  }
  return value;
}

export async function assertOwnedOptionalReference(
  exists: Promise<{ id: string } | null>,
  label: string,
): Promise<void> {
  if ((await exists) === null) {
    throw new TenantObjectNotFoundError(
      `${label} was not found in the requested carrier account.`,
    );
  }
}

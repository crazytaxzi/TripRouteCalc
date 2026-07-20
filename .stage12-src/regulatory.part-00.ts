import { z } from 'zod';

import {
  CommercialRouteEquipmentSchema,
  CommercialRouteSegmentSchema,
} from './commercial-routing.js';
import type {
  CommercialRouteEquipment,
  CommercialRouteSegment,
} from './commercial-routing.js';
import { UtcInstantSchema } from './time.js';
import type { UtcInstant } from './time.js';
import { LengthSchema, WeightSchema } from './units.js';
import type { Length, Weight } from './units.js';

const nonEmptyText = z.string().trim().min(1);
const safeNonNegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export const REGULATORY_RULE_SEVERITIES = [
  'information',
  'advisory',
  'action-required',
  'route-restricted',
  'route-illegal',
  'manual-verification-required',
] as const;
export type RegulatoryRuleSeverity =
  (typeof REGULATORY_RULE_SEVERITIES)[number];

export const REGULATORY_RULE_SET_STATUSES = [
  'draft',
  'active',
  'inactive',
] as const;
export type RegulatoryRuleSetStatus =
  (typeof REGULATORY_RULE_SET_STATUSES)[number];

export const REGULATORY_AUTHORITY_TYPES = [
  'federal-regulation',
  'federal-agency',
  'state-legislature',
  'state-dot',
  'commercial-vehicle-enforcement',
  'municipal-ordinance',
  'permit-authority',
  'official-route-map',
  'contracted-commercial-routing',
  'other-official-authority',
] as const;
export type RegulatoryAuthorityType =
  (typeof REGULATORY_AUTHORITY_TYPES)[number];

export const REGULATORY_VEHICLE_TYPES = [
  'tractor-semitrailer',
  'straight-truck',
  'doubles',
  'triples',
  'passenger-carrying',
  'other-cmv',
] as const;
export type RegulatoryVehicleType =
  (typeof REGULATORY_VEHICLE_TYPES)[number];

export const REGULATORY_RULE_CATEGORIES = [
  'vehicle-dimension',
  'kpra',
  'axle-weight',
  'gross-weight',
  'bridge-weight',
  'low-clearance',
  'truck-route',
  'local-access',
  'hazmat',
  'permit',
  'seasonal',
  'closure',
  'inspection',
  'operating-time',
  'other',
] as const;
export type RegulatoryRuleCategory =
  (typeof REGULATORY_RULE_CATEGORIES)[number];

export const REGULATORY_DIRECTIONS = [
  'northbound',
  'southbound',
  'eastbound',
  'westbound',
  'both',
  'unknown',
] as const;
export type RegulatoryDirection = (typeof REGULATORY_DIRECTIONS)[number];

export const REGULATORY_COMPARISON_OPERATORS = [
  'greater-than',
  'greater-than-or-equal',
  'less-than',
  'less-than-or-equal',
  'equal',
  'not-equal',
] as const;
export type RegulatoryComparisonOperator =
  (typeof REGULATORY_COMPARISON_OPERATORS)[number];

export const REGULATORY_STRING_FACTS = [
  'segment.jurisdiction-code',
  'segment.road-identity',
  'segment.direction',
  'load.hazmat-class',
] as const;
export type RegulatoryStringFact =
  (typeof REGULATORY_STRING_FACTS)[number];

export const REGULATORY_BOOLEAN_FACTS = [
  'load.hazmat',
  'segment.local-access-verified',
] as const;
export type RegulatoryBooleanFact =
  (typeof REGULATORY_BOOLEAN_FACTS)[number];

export const REGULATORY_LENGTH_FACTS = [
  'vehicle.tractor.overall-length',
  'vehicle.tractor.height',
  'vehicle.tractor.width',
  'vehicle.trailer.length',
  'vehicle.trailer.height',
  'vehicle.trailer.width',
  'vehicle.trailer.kpra',
  'vehicle.combined.overall-length',
  'vehicle.combined.height',
  'vehicle.combined.width',
  'load.length',
  'load.height',
  'load.width',
  'load.front-overhang',
  'load.rear-overhang',
] as const;
export type RegulatoryLengthFact =
  (typeof REGULATORY_LENGTH_FACTS)[number];

export const REGULATORY_WEIGHT_FACTS = [
  'load.steer-axle-weight',
  'load.drive-axle-weight',
  'load.trailer-axle-weight',
  'load.total-gross-combination-weight',
] as const;
export type RegulatoryWeightFact =
  (typeof REGULATORY_WEIGHT_FACTS)[number];

export const REGULATORY_INTEGER_FACTS = [
  'vehicle.total-axle-count',
  'vehicle.trailer-count',
  'vehicle.tractor-axle-count',
  'vehicle.trailer-axle-count',
] as const;
export type RegulatoryIntegerFact =
  (typeof REGULATORY_INTEGER_FACTS)[number];

export const RegulatorySourceSchema = z
  .object({
    authorityType: z.enum(REGULATORY_AUTHORITY_TYPES),
    authorityName: nonEmptyText,
    title: nonEmptyText,
    reference: nonEmptyText,
    retrievedAt: UtcInstantSchema,
    version: nonEmptyText,
    lastVerifiedAt: UtcInstantSchema,
  })
  .strict();
export type RegulatorySource = Readonly<
  z.infer<typeof RegulatorySourceSchema>
>;

export const RegulatoryRequiredActionSchema = z
  .object({
    code: nonEmptyText,
    instruction: nonEmptyText,
    mustCompleteBeforeSegment: z.boolean(),
    requiredUpdatedFacts: z.array(nonEmptyText).default([]),
  })
  .strict();
export type RegulatoryRequiredAction = Readonly<
  z.infer<typeof RegulatoryRequiredActionSchema>
>;

export const RegulatoryRoadScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
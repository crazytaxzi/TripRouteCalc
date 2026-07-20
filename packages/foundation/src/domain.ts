import { z } from 'zod';

import type {
  IanaTimeZone,
  LocalAppointmentWindow,
  UtcInstant,
} from './time.js';
import type {
  Distance,
  Duration,
  Length,
  Speed,
  Weight,
} from './units.js';

export const DOMAIN_ENTITY_KINDS = Object.freeze([
  'user',
  'carrier',
  'driver',
  'driver-hos-state',
  'driver-duty-event',
  'tractor',
  'trailer',
  'load',
  'trip',
  'trip-revision',
  'trip-stop',
  'appointment-window',
  'route',
  'route-leg',
  'route-segment',
  'route-restriction',
  'jurisdiction-rule',
  'permit',
  'planned-event',
  'compliance-warning',
  'facility',
  'facility-service-profile',
  'calculation-assumption',
  'calculation-result',
] as const);

export type DomainEntityKind = (typeof DOMAIN_ENTITY_KINDS)[number];

export type EntityId<Kind extends DomainEntityKind> = string & {
  readonly __entityKind: Kind;
};

const UuidSchema = z.string().uuid();

export function entityId<Kind extends DomainEntityKind>(
  kind: Kind,
  value: unknown,
): EntityId<Kind> {
  void kind;
  return UuidSchema.parse(value) as EntityId<Kind>;
}

export const DutyStatusSchema = z.enum([
  'off-duty',
  'sleeper-berth',
  'driving',
  'on-duty-not-driving',
]);

export type DutyStatus = z.infer<typeof DutyStatusSchema>;

export const StopTypeSchema = z.enum([
  'start-location',
  'tractor-pickup',
  'trailer-pickup',
  'shipper',
  'intermediate-pickup',
  'intermediate-delivery',
  'final-consignee',
  'fuel',
  'scale',
  'inspection',
  'maintenance',
  'food',
  'driver-break',
  'sleeper-rest',
  'terminal',
  'border-crossing',
  'other',
]);

export type StopType = z.infer<typeof StopTypeSchema>;

export interface User {
  readonly id: EntityId<'user'>;
  readonly displayName: string;
}

export interface Carrier {
  readonly id: EntityId<'carrier'>;
  readonly legalName: string;
  readonly homeTerminalTimeZone: IanaTimeZone;
}

export interface Driver {
  readonly id: EntityId<'driver'>;
  readonly carrierId: EntityId<'carrier'>;
  readonly displayName: string;
}

export interface DriverHosState {
  readonly id: EntityId<'driver-hos-state'>;
  readonly driverId: EntityId<'driver'>;
  readonly asOf: UtcInstant;
  readonly currentDutyStatus: DutyStatus;
  readonly drivingClockRemaining: Duration;
  readonly shiftClockRemaining: Duration;
  readonly cycleClockRemaining: Duration;
}

export interface DriverDutyEvent {
  readonly id: EntityId<'driver-duty-event'>;
  readonly driverId: EntityId<'driver'>;
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly duration: Duration;
  readonly dutyStatus: DutyStatus;
  readonly eventType: string;
  readonly source: string;
  readonly explanation: string;
}

export interface Tractor {
  readonly id: EntityId<'tractor'>;
  readonly carrierId: EntityId<'carrier'>;
  readonly unitNumber: string;
  readonly grossVehicleWeightRating?: Weight;
  readonly height?: Length;
  readonly width?: Length;
  readonly length?: Length;
}

export interface Trailer {
  readonly id: EntityId<'trailer'>;
  readonly carrierId: EntityId<'carrier'>;
  readonly unitNumber: string;
  readonly equipmentType:
    | 'dry-van'
    | 'refrigerated'
    | 'flatbed'
    | 'similar-general-freight';
  readonly grossVehicleWeightRating?: Weight;
  readonly height?: Length;
  readonly width?: Length;
  readonly length?: Length;
  readonly kpra?: Length;
  readonly kpraVerificationSource?: string;
}

export interface Load {
  readonly id: EntityId<'load'>;
  readonly carrierId: EntityId<'carrier'>;
  readonly referenceNumber: string;
  readonly cargoWeight?: Weight;
  readonly stopIds: readonly EntityId<'trip-stop'>[];
}

export interface Trip {
  readonly id: EntityId<'trip'>;
  readonly carrierId: EntityId<'carrier'>;
  readonly driverId: EntityId<'driver'>;
  readonly currentRevisionId: EntityId<'trip-revision'>;
}

export interface TripRevision {
  readonly id: EntityId<'trip-revision'>;
  readonly tripId: EntityId<'trip'>;
  readonly revisionNumber: number;
  readonly createdAt: UtcInstant;
  readonly stopIds: readonly EntityId<'trip-stop'>[];
  readonly assumptionIds: readonly EntityId<'calculation-assumption'>[];
}

export interface TripStop {
  readonly id: EntityId<'trip-stop'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly sequence: number;
  readonly type: StopType;
  readonly required: boolean;
  readonly facilityId?: EntityId<'facility'>;
  readonly timeZone: IanaTimeZone;
  readonly appointmentWindowId?: EntityId<'appointment-window'>;
  readonly expectedServiceDuration: Duration;
}

export interface AppointmentWindow {
  readonly id: EntityId<'appointment-window'>;
  readonly stopId: EntityId<'trip-stop'>;
  readonly localWindow: LocalAppointmentWindow;
}

export interface Route {
  readonly id: EntityId<'route'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly legIds: readonly EntityId<'route-leg'>[];
  readonly totalDistance: Distance;
  readonly estimatedDrivingDuration: Duration;
  readonly verificationStatus:
    | 'unverified'
    | 'commercial-route-provider-verified';
  readonly verificationSource?: string;
  readonly verifiedAt?: UtcInstant;
}

export interface RouteLeg {
  readonly id: EntityId<'route-leg'>;
  readonly routeId: EntityId<'route'>;
  readonly originStopId: EntityId<'trip-stop'>;
  readonly destinationStopId: EntityId<'trip-stop'>;
  readonly segmentIds: readonly EntityId<'route-segment'>[];
  readonly distance: Distance;
  readonly estimatedDrivingDuration: Duration;
}

export interface RouteSegment {
  readonly id: EntityId<'route-segment'>;
  readonly routeLegId: EntityId<'route-leg'>;
  readonly sequence: number;
  readonly distance: Distance;
  readonly expectedSpeed?: Speed;
  readonly jurisdictionCode?: string;
}

export interface RouteRestriction {
  readonly id: EntityId<'route-restriction'>;
  readonly routeSegmentId: EntityId<'route-segment'>;
  readonly restrictionType: string;
  readonly sourceTitle: string;
  readonly sourceReference: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly verifiedAt: UtcInstant;
}

export interface JurisdictionRule {
  readonly id: EntityId<'jurisdiction-rule'>;
  readonly jurisdictionCode: string;
  readonly ruleType: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo?: UtcInstant;
  readonly sourceTitle: string;
  readonly sourceReference: string;
}

export interface Permit {
  readonly id: EntityId<'permit'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly jurisdictionCode: string;
  readonly permitNumber: string;
  readonly effectiveFrom: UtcInstant;
  readonly effectiveTo: UtcInstant;
  readonly verificationSource: string;
}

export interface PlannedEvent {
  readonly id: EntityId<'planned-event'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly type: string;
  readonly start: UtcInstant;
  readonly end: UtcInstant;
  readonly duration: Duration;
  readonly dutyStatus: DutyStatus;
  readonly stopId?: EntityId<'trip-stop'>;
  readonly explanation: string;
}

export interface ComplianceWarning {
  readonly id: EntityId<'compliance-warning'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly severity: 'information' | 'warning' | 'blocking';
  readonly code: string;
  readonly explanation: string;
  readonly sourceReference?: string;
  readonly routeSegmentId?: EntityId<'route-segment'>;
  readonly stopId?: EntityId<'trip-stop'>;
}

export interface Facility {
  readonly id: EntityId<'facility'>;
  readonly name: string;
  readonly timeZone: IanaTimeZone;
  readonly addressText: string;
}

export interface FacilityServiceProfile {
  readonly id: EntityId<'facility-service-profile'>;
  readonly facilityId: EntityId<'facility'>;
  readonly minimumDuration: Duration;
  readonly expectedDuration: Duration;
  readonly maximumDuration: Duration;
  readonly expectedDutyStatus: DutyStatus;
  readonly evidenceSource: string;
}

export interface CalculationAssumption {
  readonly id: EntityId<'calculation-assumption'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly key: string;
  readonly value: unknown;
  readonly explanation: string;
  readonly source: 'user' | 'carrier-policy' | 'system-default';
}

export interface CalculationResult {
  readonly id: EntityId<'calculation-result'>;
  readonly tripRevisionId: EntityId<'trip-revision'>;
  readonly calculatedAt: UtcInstant;
  readonly routeId?: EntityId<'route'>;
  readonly eventIds: readonly EntityId<'planned-event'>[];
  readonly warningIds: readonly EntityId<'compliance-warning'>[];
  readonly confidence: 'high' | 'medium' | 'low' | 'blocked';
  readonly confidenceReasons: readonly string[];
  readonly explanation: readonly string[];
}

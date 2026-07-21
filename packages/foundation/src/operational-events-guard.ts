export * from './operational-events.js';

import {
  OperationalLocationSchema,
  planFuelStops as planFuelStopsBase,
  scheduleOperationalEvent as scheduleOperationalEventBase,
  selectOperationalLocation as selectOperationalLocationBase,
  validateOperationalEventPlan,
} from './operational-events.js';
import type {
  FuelPlan,
  FuelPlanningInput,
  OperationalEventPlan,
  OperationalEventType,
  OperationalLocation,
  OperationalLocationCapability,
  OperationalLocationSelection,
  OperationalTimelineEvent,
  PlannedFuelStop,
} from './operational-events.js';
import type {
  DriverHosDepartureState,
  DutyEvent,
} from './hos.js';
import type { UtcInstant } from './time.js';
import {
  VolumeSchema,
  volumeInUsGallons,
} from './units.js';

const EVENT_TO_CAPABILITY = Object.freeze({
  FUEL: 'FUEL',
  SCALE: 'SCALE',
  CARGO_SECUREMENT_CHECK: 'CARGO_SECUREMENT_CHECK',
  REEFER_CHECK: 'REEFER_CHECK',
  MAINTENANCE: 'MAINTENANCE',
  BORDER_OR_AGRICULTURAL_INSPECTION:
    'BORDER_OR_AGRICULTURAL_INSPECTION',
  PARKING_SEARCH: 'PARKING',
  MEAL: 'MEAL',
  SHOWER: 'SHOWER',
}) satisfies Readonly<
  Partial<Record<OperationalEventType, OperationalLocationCapability>>
>;

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function explicitLocationProblems(
  plan: OperationalEventPlan,
  location: OperationalLocation,
): readonly string[] {
  const problems: string[] = [];
  const capability =
    plan.placement.requiredCapability ?? EVENT_TO_CAPABILITY[plan.type];

  if (!location.truckCompatible) {
    problems.push(
      'The explicitly selected location is not recorded as truck-compatible.',
    );
  }
  if (
    capability !== undefined &&
    !location.capabilities.includes(capability)
  ) {
    problems.push(
      `The explicitly selected location does not provide ${capability} capability.`,
    );
  }
  if (
    plan.placement.kind === 'AT_ROUTE_DISTANCE' &&
    plan.placement.routeDistance !== undefined &&
    location.routeDistance.value !== plan.placement.routeDistance.value
  ) {
    problems.push(
      'The explicitly selected location does not match the required route distance.',
    );
  }
  if (
    plan.placement.earliestRouteDistance !== undefined &&
    location.routeDistance.value < plan.placement.earliestRouteDistance.value
  ) {
    problems.push(
      'The explicitly selected location is before the allowed placement window.',
    );
  }
  if (
    plan.placement.latestRouteDistance !== undefined &&
    location.routeDistance.value > plan.placement.latestRouteDistance.value
  ) {
    problems.push(
      'The explicitly selected location is after the allowed placement window.',
    );
  }
  return freezeArray(problems);
}

export function selectOperationalLocation(
  planInput: OperationalEventPlan,
  locationInputs: readonly OperationalLocation[],
): OperationalLocationSelection {
  const plan = validateOperationalEventPlan(planInput);
  if (plan.location === undefined) {
    return selectOperationalLocationBase(plan, locationInputs);
  }

  const problems = explicitLocationProblems(plan, plan.location);
  if (problems.length > 0) {
    return freeze({
      status: 'UNAVAILABLE' as const,
      explanations: freezeArray([
        ...problems,
        'The planner did not accept an incompatible operational location.',
      ]),
    });
  }

  return freeze({
    status: 'SELECTED' as const,
    location: plan.location,
    explanations: freezeArray([
      `The event uses the explicitly selected location ${plan.location.description}.`,
    ]),
  });
}

export function scheduleOperationalEvent(
  planInput: OperationalEventPlan,
  startAt: UtcInstant,
  departureState: DriverHosDepartureState,
  priorDutyEvents: readonly DutyEvent[],
  availableLocations: readonly OperationalLocation[] = [],
): OperationalTimelineEvent {
  const plan = validateOperationalEventPlan(planInput);
  const priorDrivingExists = priorDutyEvents.some(
    (event) => event.dutyStatus === 'DRIVING',
  );

  if (plan.type === 'PRE_TRIP_INSPECTION' && priorDrivingExists) {
    return freeze({
      status: 'PLACEMENT_UNAVAILABLE' as const,
      plan,
      explanations: freezeArray([
        'A pre-trip inspection must be completed before the first driving event.',
      ]),
    });
  }
  if (plan.type === 'POST_TRIP_INSPECTION' && !priorDrivingExists) {
    return freeze({
      status: 'PLACEMENT_UNAVAILABLE' as const,
      plan,
      explanations: freezeArray([
        'A post-trip inspection cannot be placed before any driving has occurred.',
      ]),
    });
  }

  if (plan.location !== undefined) {
    const selection = selectOperationalLocation(plan, availableLocations);
    if (selection.status === 'UNAVAILABLE') {
      return freeze({
        status: 'PLACEMENT_UNAVAILABLE' as const,
        plan,
        explanations: selection.explanations,
      });
    }
  }

  return scheduleOperationalEventBase(
    plan,
    startAt,
    departureState,
    priorDutyEvents,
    availableLocations,
  );
}

function verifiedOriginFuelLocation(
  locations: readonly OperationalLocation[],
): OperationalLocation | undefined {
  for (const input of locations) {
    const parsed = OperationalLocationSchema.safeParse(input);
    if (!parsed.success) continue;
    const location = parsed.data;
    const verified =
      location.source.type === 'VERIFIED_LOCATION_PROVIDER' ||
      location.source.type === 'VERIFIED_RECORD';
    if (
      location.routeDistance.value === 0 &&
      location.truckCompatible &&
      location.capabilities.includes('FUEL') &&
      verified
    ) {
      return freeze({
        ...location,
        capabilities: freezeArray(location.capabilities),
        source: freeze(location.source),
      });
    }
  }
  return undefined;
}

function normalizeCoveredLocationGap(result: FuelPlan): FuelPlan {
  if (
    result.status === 'BLOCKED' &&
    result.blockingReason === 'NO_TRUCK_COMPATIBLE_LOCATION' &&
    result.stops.length > 0
  ) {
    return freeze({
      ...result,
      blockingReason: 'INSUFFICIENT_RANGE' as const,
      explanations: freezeArray([
        ...result.explanations,
        'Verified fuel locations existed, but the remaining route gap exceeded the entered usable range.',
      ]),
    });
  }
  return result;
}

export function planFuelStops(input: FuelPlanningInput): FuelPlan {
  const initial = normalizeCoveredLocationGap(planFuelStopsBase(input));
  if (
    initial.status !== 'BLOCKED' ||
    initial.blockingReason !== 'CURRENT_LEVEL_BELOW_RESERVE'
  ) {
    return initial;
  }

  const origin = verifiedOriginFuelLocation(input.locations);
  if (origin === undefined) return initial;

  const capacity = VolumeSchema.parse(input.fuelCapacity);
  const current = VolumeSchema.parse(input.currentFuelLevel);
  const continuation = normalizeCoveredLocationGap(
    planFuelStopsBase({
      ...input,
      currentFuelLevel: capacity,
    }),
  );
  const originStop: PlannedFuelStop = freeze({
    sequence: 1,
    location: origin,
    routeDistance: origin.routeDistance,
    arrivalFuel: current,
    gallonsAdded: volumeInUsGallons(capacity.value - current.value),
    departureFuel: capacity,
    explanation:
      'Planned immediate fueling at a supplied verified truck-compatible origin location before route movement.',
  });
  const stops = freezeArray([
    originStop,
    ...continuation.stops.map((stop, index) =>
      freeze({ ...stop, sequence: index + 2 }),
    ),
  ]);
  const status =
    continuation.status === 'NOT_REQUIRED'
      ? ('PLANNED' as const)
      : continuation.status;

  return freeze({
    status,
    ...(status === 'BLOCKED' && continuation.blockingReason !== undefined
      ? { blockingReason: continuation.blockingReason }
      : {}),
    routeDistance: initial.routeDistance,
    initialUsableFuel: initial.initialUsableFuel,
    initialRange: initial.initialRange,
    estimatedFuelConsumed: initial.estimatedFuelConsumed,
    stops,
    explanations: freezeArray([
      'Current fuel was below reserve, so the plan begins with explicit origin fueling rather than driving below reserve.',
      ...continuation.explanations,
    ]),
  });
}

import type {
  JurisdictionRule,
  RegulatoryActionLocation,
  RegulatoryComparisonOperator,
  RegulatoryComplianceFinding,
  RegulatoryComplianceResult,
  RegulatoryCondition,
  RegulatoryEvaluationInput,
  RegulatoryEvaluationStatus,
  RegulatoryIntegerFact,
  RegulatoryLengthFact,
  RegulatoryRequiredAction,
  RegulatoryRoadScope,
  RegulatoryRouteSegmentContext,
  RegulatoryRuleSeverity,
  RegulatorySource,
  RegulatoryStringFact,
  RegulatoryWeightFact,
} from '@trip-route-calc/foundation';
import { validateRegulatoryEvaluationInput } from '@trip-route-calc/foundation';
import type { Length, UtcInstant, Weight } from '@trip-route-calc/foundation';

interface EvaluationTrace {
  readonly status: 'matched' | 'unmatched' | 'unknown';
  readonly facts: Readonly<Record<string, unknown>>;
}

const severityRank: Readonly<Record<RegulatoryRuleSeverity, number>> = {
  information: 0,
  advisory: 1,
  'action-required': 2,
  'manual-verification-required': 3,
  'route-restricted': 4,
  'route-illegal': 5,
};

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function freezeArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function compareNumbers(
  actual: number,
  expected: number,
  operator: RegulatoryComparisonOperator,
): boolean {
  switch (operator) {
    case 'greater-than':
      return actual > expected;
    case 'greater-than-or-equal':
      return actual >= expected;
    case 'less-than':
      return actual < expected;
    case 'less-than-or-equal':
      return actual <= expected;
    case 'equal':
      return actual === expected;
    case 'not-equal':
      return actual !== expected;
  }
}

function stringFact(
  fact: RegulatoryStringFact,
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
): string | readonly string[] | undefined {
  switch (fact) {
    case 'segment.jurisdiction-code':
      return segment.segment.jurisdictionCodes;
    case 'segment.road-identity':
      return segment.roadIdentity;
    case 'segment.direction':
      return segment.direction;
    case 'load.hazmat-class':
      return input.equipment.load.hazmatClass;
  }
}

function lengthFact(
  fact: RegulatoryLengthFact,
  input: RegulatoryEvaluationInput,
): Length | undefined {
  switch (fact) {
    case 'vehicle.tractor.overall-length':
      return input.equipment.tractor.overallLength;
    case 'vehicle.tractor.height':
      return input.equipment.tractor.height;
    case 'vehicle.tractor.width':
      return input.equipment.tractor.width;
    case 'vehicle.trailer.length':
      return input.equipment.trailer.length;
    case 'vehicle.trailer.height':
      return input.equipment.trailer.height;
    case 'vehicle.trailer.width':
      return input.equipment.trailer.width;
    case 'vehicle.trailer.kpra':
      return input.equipment.trailer.currentKpra;
    case 'vehicle.combined.overall-length':
      return input.equipment.combinedDimensions.overallLength;
    case 'vehicle.combined.height':
      return input.equipment.combinedDimensions.height;
    case 'vehicle.combined.width':
      return input.equipment.combinedDimensions.width;
    case 'load.length':
      return input.equipment.load.length;
    case 'load.height':
      return input.equipment.load.height;
    case 'load.width':
      return input.equipment.load.width;
    case 'load.front-overhang':
      return input.equipment.load.frontOverhang;
    case 'load.rear-overhang':
      return input.equipment.load.rearOverhang;
  }
}

function weightFact(
  fact: RegulatoryWeightFact,
  input: RegulatoryEvaluationInput,
): Weight {
  switch (fact) {
    case 'load.steer-axle-weight':
      return input.equipment.load.steerAxleWeight;
    case 'load.drive-axle-weight':
      return input.equipment.load.driveAxleWeight;
    case 'load.trailer-axle-weight':
      return input.equipment.load.trailerAxleWeight;
    case 'load.total-gross-combination-weight':
      return input.equipment.load.totalGrossCombinationWeight;
  }
}

function integerFact(
  fact: RegulatoryIntegerFact,
  input: RegulatoryEvaluationInput,
): number {
  switch (fact) {
    case 'vehicle.total-axle-count':
      return input.equipment.totalAxleCount;
    case 'vehicle.trailer-count':
      return input.equipment.trailerCount;
    case 'vehicle.tractor-axle-count':
      return input.equipment.tractor.axleCount;
    case 'vehicle.trailer-axle-count':
      return input.equipment.trailer.axleCount;
  }
}

function mergeFacts(
  traces: readonly EvaluationTrace[],
): Readonly<Record<string, unknown>> {
  const facts: Record<string, unknown> = {};
  for (const trace of traces) Object.assign(facts, trace.facts);
  return freeze(facts);
}

function evaluateCondition(
  condition: RegulatoryCondition,
  input: RegulatoryEvaluationInput,
  segment: RegulatoryRouteSegmentContext,
): EvaluationTrace {
  switch (condition.kind) {
    case 'all': {
      const traces = condition.conditions.map((candidate) =>
        evaluateCondition(candidate, input, segment),
      );
      return freeze({
        status: traces.some((trace) => trace.status === 'unmatched')
          ? 'unmatched'
          : traces.some((trace) => trace.status === 'unknown')
            ? 'unknown'
            : 'matched',
        facts: mergeFacts(traces),
      });
    }
    case 'any': {
      const traces = condition.conditions.map((candidate) =>
        evaluateCondition(candidate, input, segment),
      );
      return freeze({
        status: traces.some((trace) => trace.status === 'matched')
          ? 'matched'
          : traces.some((trace) => trace.status === 'unknown')
            ? 'unknown'
            : 'unmatched',
        facts: mergeFacts(traces),
      });
    }
    case 'not': {
      const trace = evaluateCondition(condition.condition, input, segment);
      return freeze({
        status:
          trace.status === 'unknown'
            ? 'unknown'
            : trace.status === 'matched'
              ? 'unmatched'
              : 'matched',
        facts: trace.facts,
      });
    }
    case 'string': {
      const actual = stringFact(condition.fact, input, segment);
      const facts = freeze({
        [condition.fact]: actual ?? null,
        [`${condition.fact}.operator`]: condition.operator,
        [`${condition.fact}.expected`]: condition.value,
      });
      if (actual === undefined || (Array.isArray(actual) && actual.length === 0)) {
        return freeze({ status: 'unknown', facts });
      }
      const actualValues = typeof actual === 'string' ? [actual] : actual;
      const expectedValues =
        typeof condition.value === 'string' ? [condition.value] : condition.value;
      const overlaps = actualValues.some((value) => expectedValues.includes(value));
      const matched =
        condition.operator === 'not-equal'
          ? !overlaps
          : condition.operator === 'equal'
            ? overlaps
            : overlaps;
      return freeze({ status: matched ? 'matched' : 'unmatched', facts });
    }
    case 'boolean': {
      const actual =
        condition.fact === 'load.hazmat'
          ? input.equipment.load.hazmat
          : segment.localAccessVerified;
      return freeze({
        status: actual === condition.value ? 'matched' : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'length': {
      const actual = lengthFact(condition.fact, input);
      const facts = freeze({
        [condition.fact]: actual ?? null,
        [`${condition.fact}.operator`]: condition.operator,
        [`${condition.fact}.expected`]: condition.value,
      });
      if (actual === undefined) return freeze({ status: 'unknown', facts });
      return freeze({
        status: compareNumbers(actual.value, condition.value.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts,
      });
    }
    case 'weight': {
      const actual = weightFact(condition.fact, input);
      return freeze({
        status: compareNumbers(actual.value, condition.value.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.operator`]: condition.operator,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'integer': {
      const actual = integerFact(condition.fact, input);
      return freeze({
        status: compareNumbers(actual, condition.value, condition.operator)
          ? 'matched'
          : 'unmatched',
        facts: freeze({
          [condition.fact]: actual,
          [`${condition.fact}.operator`]: condition.operator,
          [`${condition.fact}.expected`]: condition.value,
        }),
      });
    }
    case 'permit': {
      const present = input.permitIdentifiers.length > 0;
      const contains =
        condition.permitIdentifier !== undefined &&
        input.permitIdentifiers.includes(condition.permitIdentifier);
      const matched =
        condition.operator === 'present'
          ? present
          : condition.operator === 'missing'
            ? !present
            : contains;
      return freeze({
        status: matched ? 'matched' : 'unmatched',
        facts: freeze({
          permitIdentifiers: input.permitIdentifiers,
          permitOperator: condition.operator,
          permitIdentifier: condition.permitIdentifier ?? null,
        }),
      });
    }

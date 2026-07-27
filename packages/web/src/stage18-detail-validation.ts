import type { TripSetupState, ValidationIssue } from './model.js';
import { loadStage18CompleteFacts } from './stage18-detail-types.js';
import type { EvidenceFacts, Stage18CompleteFacts } from './stage18-detail-types.js';

function issue(path: string, message: string): ValidationIssue {
  return { path, message, severity: 'error' };
}

function requirePositive(
  issues: ValidationIssue[],
  path: string,
  value: number,
  label: string,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    issues.push(issue(path, `Enter a positive ${label}.`));
  }
}

function validateEvidence(
  issues: ValidationIssue[],
  path: string,
  facts: EvidenceFacts,
): void {
  if (facts.sourceType === '') {
    issues.push(issue(`${path}.sourceType`, 'Choose how the equipment facts were obtained.'));
  }
}

export function validateStage18CompleteFacts(
  state: TripSetupState,
  facts = loadStage18CompleteFacts(),
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if ((facts.driver.id ?? state.driver.selectedId) === '' && facts.driver.displayName.trim() === '' && state.driver.displayName.trim() === '') {
    issues.push(issue('driver', 'Select an existing driver or enter a driver name.'));
  }

  const tractor = facts.tractor;
  const existingTractorId = tractor.id ?? state.tractor.selectedId;
  if (existingTractorId === '' && tractor.unitNumber.trim() === '') issues.push(issue('tractor.unitNumber', 'Enter the tractor unit number.'));
  if (existingTractorId === '') {
  requirePositive(issues, 'tractor.axleCount', tractor.axleCount, 'tractor axle count');
  requirePositive(issues, 'tractor.overallLengthFeet', tractor.overallLengthFeet, 'tractor overall length');
  requirePositive(issues, 'tractor.heightFeet', tractor.heightFeet, 'tractor height');
  requirePositive(issues, 'tractor.widthInches', tractor.widthInches, 'tractor width');
  requirePositive(issues, 'tractor.registeredGrossWeightPounds', tractor.registeredGrossWeightPounds, 'registered gross weight');
  requirePositive(issues, 'tractor.governedSpeedMph', tractor.governedSpeedMph, 'governed speed');
  requirePositive(issues, 'tractor.planningCruiseSpeedMph', tractor.planningCruiseSpeedMph, 'planning cruise speed');
  if (tractor.planningCruiseSpeedMph > tractor.governedSpeedMph) {
    issues.push(issue('tractor.planningCruiseSpeedMph', 'Planning cruise speed cannot exceed governed speed.'));
  }
  validateEvidence(issues, 'tractor', tractor);
  }

  const trailer = facts.trailer;
  const existingTrailerId = trailer.id ?? state.trailer.selectedId;
  if (existingTrailerId === '' && trailer.trailerNumber.trim() === '') issues.push(issue('trailer.trailerNumber', 'Enter the trailer number.'));
  if (existingTrailerId === '') {
  requirePositive(issues, 'trailer.lengthFeet', trailer.lengthFeet, 'trailer length');
  requirePositive(issues, 'trailer.heightFeet', trailer.heightFeet, 'trailer height');
  requirePositive(issues, 'trailer.widthInches', trailer.widthInches, 'trailer width');
  requirePositive(issues, 'trailer.currentKpraFeet', trailer.currentKpraFeet, 'current KPRA');
  requirePositive(issues, 'trailer.maximumPayloadPounds', trailer.maximumPayloadPounds, 'maximum payload');
  if (trailer.minimumKpraFeet > trailer.currentKpraFeet || trailer.currentKpraFeet > trailer.maximumKpraFeet) {
    issues.push(issue('trailer.currentKpraFeet', 'Current KPRA must be inside the entered achievable range.'));
  }
  validateEvidence(issues, 'trailer', trailer);
  }

  const load = facts.load;
  const existingLoadId = load.id ?? state.load.selectedId;
  if (existingLoadId === '' && load.loadIdentifier.trim() === '') issues.push(issue('load.loadIdentifier', 'Enter the load identifier.'));
  if (existingLoadId === '' && load.commodity.trim() === '') issues.push(issue('load.commodity', 'Enter the commodity.'));
  if (existingLoadId === '') {
  for (const [path, value, label] of [
    ['load.grossCargoWeightPounds', load.grossCargoWeightPounds, 'cargo weight'],
    ['load.steerAxleWeightPounds', load.steerAxleWeightPounds, 'steer axle weight'],
    ['load.driveAxleWeightPounds', load.driveAxleWeightPounds, 'drive axle weight'],
    ['load.trailerAxleWeightPounds', load.trailerAxleWeightPounds, 'trailer axle weight'],
    ['load.totalGrossCombinationWeightPounds', load.totalGrossCombinationWeightPounds, 'total gross combination weight'],
    ['load.lengthFeet', load.lengthFeet, 'load length'],
    ['load.widthFeet', load.widthFeet, 'load width'],
    ['load.heightFeet', load.heightFeet, 'load height'],
  ] as const) {
    requirePositive(issues, path, value, label);
  }
  if (load.hazmat && load.hazmatClass.trim() === '') {
    issues.push(issue('load.hazmatClass', 'Enter the hazmat class.'));
  }
  if (load.permitRequirement === 'required' && load.permitsText.trim() === '') {
    issues.push(issue('load.permitsText', 'Enter the required permit identifiers.'));
  }
  validateEvidence(issues, 'load', load);
  }

  if (facts.route.policy === '') {
    issues.push(issue('route.policy', 'Choose a commercial route policy.'));
  }

  state.stops.forEach((stop): void => {
    const stopFacts = facts.stops[stop.localId];
    const base = `stops.${String(stop.sequence)}`;
    if (stopFacts === undefined) {
      issues.push(issue(base, 'Complete the stop location evidence and service facts.'));
      return;
    }
    if (stopFacts.latitude === null || stopFacts.longitude === null) {
      issues.push(issue(`${base}.location`, 'Enter resolved latitude and longitude.'));
    }
    if (stopFacts.resolutionStatus === '') {
      issues.push(issue(`${base}.resolutionStatus`, 'Choose provider-resolved or user-confirmed location evidence.'));
    }
    if (stopFacts.sourceName.trim() === '') {
      issues.push(issue(`${base}.sourceName`, 'Identify the location evidence source.'));
    }
    if (stopFacts.resolutionStatus === 'resolved' && stopFacts.providerReference.trim() === '') {
      issues.push(issue(`${base}.providerReference`, 'Provider-resolved locations require the provider reference.'));
    }
    if (!Number.isFinite(stopFacts.checkInMinutes) || stopFacts.checkInMinutes < 0) {
      issues.push(issue(`${base}.checkInMinutes`, 'Enter a nonnegative check-in duration.'));
    }
    if (stopFacts.appointmentMode !== 'none') {
      if (
        (stopFacts.appointmentMode === 'fixed' ||
          stopFacts.appointmentMode === 'earliest' ||
          stopFacts.appointmentMode === 'latest') &&
        stopFacts.appointmentAt === ''
      ) {
        issues.push(issue(`${base}.appointmentAt`, 'Enter the appointment date and time.'));
      }
      if (
        (stopFacts.appointmentMode === 'window' ||
          stopFacts.appointmentMode === 'open-window') &&
        (stopFacts.appointmentStartAt === '' || stopFacts.appointmentEndAt === '')
      ) {
        issues.push(issue(`${base}.appointmentWindow`, 'Enter both ends of the appointment window.'));
      }
    }
    if (stopFacts.serviceMode === 'historical-average' && stopFacts.historicalSourceName.trim() === '') {
      issues.push(issue(`${base}.historicalSourceName`, 'Historical service averages require a source name.'));
    }
    if (stopFacts.instructions.trim() === '' && stop.required) {
      issues.push({
        path: `${base}.instructions`,
        message: 'Confirm there are no separate stop instructions or enter them.',
        severity: 'warning',
      });
    }
  });
  return issues;
}

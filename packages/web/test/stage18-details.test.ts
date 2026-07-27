import { describe, expect, it } from 'vitest';

import {
  completeStopPayload,
  createStage18CompleteFacts,
  defaultStopPlanningFacts,
  restoreStage18CompleteFacts,
  tractorProfilePayload,
  validateStage18CompleteFacts,
} from '../src/stage18-details.js';
import { createInitialTripSetupState } from '../src/model.js';

describe('Stage 18 complete fact model', () => {
  it('restores old or malformed supplemental drafts without fabricating evidence', () => {
    expect(restoreStage18CompleteFacts('{broken')).toEqual(
      createStage18CompleteFacts(),
    );
    const restored = restoreStage18CompleteFacts(
      JSON.stringify({ version: 1, route: { policy: 'fastest-compliant' } }),
    );
    expect(restored.route.policy).toBe('fastest-compliant');
    expect(restored.tractor.unitNumber).toBe('');
    expect(restored.stops).toEqual({});
  });

  it('blocks missing route-ready profiles and stop resolution evidence', () => {
    const state = createInitialTripSetupState();
    const issues = validateStage18CompleteFacts(state, createStage18CompleteFacts());
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'tractor.unitNumber',
        'trailer.trailerNumber',
        'load.loadIdentifier',
        'route.policy',
        'stops.0',
      ]),
    );
  });

  it('builds unit-bearing tractor payloads with explicit source evidence', () => {
    const initial = createStage18CompleteFacts().tractor;
    const payload = tractorProfilePayload({
      ...initial,
      unitNumber: 'TR-500',
      axleCount: 3,
      overallLengthFeet: 20,
      heightFeet: 13.5,
      widthInches: 96,
      registeredGrossWeightPounds: 80_000,
      governedSpeedMph: 65,
      planningCruiseSpeedMph: 55,
      sourceType: 'measured',
      sourceName: 'Fleet measurement sheet',
    });
    expect(payload).toMatchObject({
      unitNumber: 'TR-500',
      overallLength: { value: 240, unit: 'inch' },
      width: { value: 96, unit: 'inch' },
      registeredGrossWeight: { value: 80_000, unit: 'pound' },
    });
    expect(payload.fieldEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'overallLength',
          sourceType: 'measured',
          sourceName: 'Fleet measurement sheet',
        }),
      ]),
    );
  });

  it('serializes all stop appointment and service distinctions without raw JSON', () => {
    const stop = createInitialTripSetupState().stops[0];
    if (stop === undefined) throw new Error('Initial stop missing.');
    const payload = completeStopPayload(
      {
        ...stop,
        address: '123 Main Street',
        label: 'Origin',
        appointment: { ...stop.appointment, timeZone: 'America/Boise' },
        notes: 'Driver-facing note',
      },
      {
        ...defaultStopPlanningFacts(stop),
        latitude: 43.615,
        longitude: -116.202,
        resolutionStatus: 'resolved',
        sourceName: 'Licensed geocoder',
        providerReference: 'place-123',
        appointmentMode: 'open-window',
        appointmentStartAt: '2026-07-23T08:00',
        appointmentEndAt: '2026-07-23T12:00',
        lateToleranceMinutes: 15,
        facilityHoursText: '2026-07-23T06:00|2026-07-23T18:00',
        checkInMinutes: 20,
        waitingDutyStatus: 'off_duty',
        checkInDutyStatus: 'on_duty_not_driving',
        serviceDutyStatus: 'on_duty_not_driving',
        serviceMode: 'historical-average',
        serviceMinutes: 75,
        historicalSourceName: 'Facility history',
        historicalSampleSize: 12,
        earlyParkingAllowed: true,
        overnightParkingAllowed: false,
        instructions: 'Use gate four.',
      },
    );
    expect(payload).toMatchObject({
      appointment: {
        mode: 'open-window',
        window: {
          start: {
            localDateTime: '2026-07-23T08:00',
            timeZone: 'America/Boise',
          },
          end: {
            localDateTime: '2026-07-23T12:00',
            timeZone: 'America/Boise',
          },
        },
      },
      serviceDuration: {
        mode: 'historical-average',
        duration: { value: 75, unit: 'minute' },
        sourceName: 'Facility history',
        sampleSize: 12,
      },
      waitingDutyStatus: 'OFF_DUTY',
      checkInDutyStatus: 'ON_DUTY_NOT_DRIVING',
      notes: 'Driver-facing note',
      instructions: 'Use gate four.',
    });
  });
});

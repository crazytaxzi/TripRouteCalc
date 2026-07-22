import { describe, expect, it } from "vitest";

import {
  createInitialDraft,
  createStop,
  deserializeDraft,
  duplicateStop,
  moveStop,
  removeStop,
  serializeDraft,
  validateDraft,
} from "../src/model.js";

describe("trip setup draft", () => {
  it("keeps drive, shift, and cycle clocks independent", () => {
    const draft = createInitialDraft();
    draft.clocks.driveMinutesRemaining = 570;
    draft.clocks.shiftMinutesRemaining = 405;
    draft.clocks.cycleMinutesRemaining = 1320;

    expect(draft.clocks).toMatchObject({
      driveMinutesRemaining: 570,
      shiftMinutesRemaining: 405,
      cycleMinutesRemaining: 1320,
    });
  });

  it("requires explicit duty status and legal-data inputs", () => {
    const issues = validateDraft(createInitialDraft());

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "currentDutyStatus", severity: "ERROR" }),
      expect.objectContaining({ field: "load.totalCombinationWeightPounds", severity: "WARNING" }),
      expect.objectContaining({ field: "load.dimensions", severity: "WARNING" }),
    ]));
  });

  it("validates each stop appointment and service range independently", () => {
    const draft = createInitialDraft();
    draft.driver.label = "Driver 12";
    draft.tractor.label = "T-101";
    draft.trailer.label = "R-220";
    draft.load.identifier = "LOAD-7";
    draft.clocks.currentDutyStatus = "OFF_DUTY";
    draft.clocks.departureAt = "2026-07-22T08:00";
    draft.clocks.departureTimeZone = "America/Boise";
    draft.stops.forEach((stop) => { stop.location = "Known location"; });
    draft.stops[1]!.appointmentMode = "WINDOW";
    draft.stops[1]!.serviceMode = "RANGE";
    draft.stops[1]!.serviceMinimumMinutes = 90;
    draft.stops[1]!.serviceMaximumMinutes = 30;

    const issues = validateDraft(draft);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "stops.1.appointmentTimeZone" }),
      expect.objectContaining({ field: "stops.1.appointmentWindow" }),
      expect.objectContaining({ field: "stops.1.serviceRange" }),
    ]));
  });

  it("prevents moving or removing locked stops", () => {
    const first = createStop("START");
    const second = createStop("SHIPPER");
    const third = createStop("FINAL_CONSIGNEE");
    second.locked = true;
    const stops = [first, second, third];

    expect(moveStop(stops, 0, 1)).toEqual(stops);
    expect(moveStop(stops, 1, 2)).toEqual(stops);
    expect(removeStop(stops, 1)).toEqual(stops);
  });

  it("supports duplicate, reorder, and removal without mutating the source", () => {
    const source = [createStop("START"), createStop("SHIPPER"), createStop("FINAL_CONSIGNEE")];
    const copy = duplicateStop(source[1]!);
    const expanded = [...source.slice(0, 2), copy, ...source.slice(2)];
    const moved = moveStop(expanded, 2, 1);
    const removed = removeStop(moved, 2);

    expect(copy.id).not.toBe(source[1]!.id);
    expect(moved[1]!.id).toBe(copy.id);
    expect(removed).toHaveLength(3);
    expect(source).toHaveLength(3);
  });

  it("recovers valid saved work and rejects malformed storage", () => {
    const draft = createInitialDraft();
    draft.driver.label = "Recovered Driver";
    const saved = serializeDraft(draft);

    expect(deserializeDraft(saved)?.driver.label).toBe("Recovered Driver");
    expect(deserializeDraft("not-json")).toBeNull();
    expect(deserializeDraft(JSON.stringify({ stops: [] }))).toBeNull();
  });
});

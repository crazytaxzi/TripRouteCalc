export const stopTypes = [
  "START",
  "TRACTOR_PICKUP",
  "TRAILER_PICKUP",
  "SHIPPER",
  "INTERMEDIATE_PICKUP",
  "INTERMEDIATE_DELIVERY",
  "FINAL_CONSIGNEE",
  "FUEL",
  "SCALE",
  "INSPECTION",
  "MAINTENANCE",
  "FOOD",
  "DRIVER_BREAK",
  "SLEEPER_REST",
  "TERMINAL",
  "BORDER_CROSSING",
  "OTHER",
] as const;

export type StopType = (typeof stopTypes)[number];
export type DutyStatus = "OFF_DUTY" | "SLEEPER_BERTH" | "ON_DUTY_NOT_DRIVING" | "DRIVING";
export type AppointmentMode = "NONE" | "FIXED" | "WINDOW";
export type ServiceMode = "EXACT" | "EXPECTED" | "RANGE";

export interface ClockInput {
  driveMinutesRemaining: number;
  shiftMinutesRemaining: number;
  cycleMinutesRemaining: number;
  currentDutyStatus: DutyStatus | "";
  dutyStatusBeganAt: string;
  departureAt: string;
  departureTimeZone: string;
}

export interface ProfileReference {
  id: string;
  label: string;
}

export interface LoadFacts {
  identifier: string;
  commodity: string;
  cargoWeightPounds: number | null;
  totalCombinationWeightPounds: number | null;
  heightInches: number | null;
  widthInches: number | null;
  lengthInches: number | null;
  hazmat: boolean;
  hazmatClass: string;
  permitIdentifiers: string;
  routeRestrictions: string;
}

export interface TripStop {
  id: string;
  type: StopType;
  label: string;
  location: string;
  required: boolean;
  locked: boolean;
  appointmentMode: AppointmentMode;
  appointmentStart: string;
  appointmentEnd: string;
  appointmentTimeZone: string;
  serviceMode: ServiceMode;
  serviceMinutes: number;
  serviceMinimumMinutes: number;
  serviceMaximumMinutes: number;
  serviceDutyStatus: DutyStatus;
  notes: string;
}

export interface TripSetupDraft {
  driver: ProfileReference;
  tractor: ProfileReference;
  trailer: ProfileReference;
  clocks: ClockInput;
  load: LoadFacts;
  stops: TripStop[];
  immediateRecalculation: boolean;
  updatedAt: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createStop = (type: StopType = "OTHER"): TripStop => ({
  id: createId(),
  type,
  label: "",
  location: "",
  required: true,
  locked: false,
  appointmentMode: "NONE",
  appointmentStart: "",
  appointmentEnd: "",
  appointmentTimeZone: "",
  serviceMode: "EXPECTED",
  serviceMinutes: type === "SCALE" ? 15 : 30,
  serviceMinimumMinutes: 30,
  serviceMaximumMinutes: 60,
  serviceDutyStatus: "ON_DUTY_NOT_DRIVING",
  notes: "",
});

export const createInitialDraft = (): TripSetupDraft => ({
  driver: { id: "", label: "" },
  tractor: { id: "", label: "" },
  trailer: { id: "", label: "" },
  clocks: {
    driveMinutesRemaining: 660,
    shiftMinutesRemaining: 840,
    cycleMinutesRemaining: 4200,
    currentDutyStatus: "",
    dutyStatusBeganAt: "",
    departureAt: "",
    departureTimeZone: "",
  },
  load: {
    identifier: "",
    commodity: "",
    cargoWeightPounds: null,
    totalCombinationWeightPounds: null,
    heightInches: null,
    widthInches: null,
    lengthInches: null,
    hazmat: false,
    hazmatClass: "",
    permitIdentifiers: "",
    routeRestrictions: "",
  },
  stops: [createStop("START"), createStop("SHIPPER"), createStop("FINAL_CONSIGNEE")],
  immediateRecalculation: false,
  updatedAt: new Date().toISOString(),
});

export const duplicateStop = (stop: TripStop): TripStop => ({ ...stop, id: createId(), locked: false });

export const moveStop = (stops: readonly TripStop[], from: number, to: number): TripStop[] => {
  if (from < 0 || from >= stops.length || to < 0 || to >= stops.length || from === to) return [...stops];
  if (stops[from]?.locked || stops[to]?.locked) return [...stops];
  const next = [...stops];
  const [moved] = next.splice(from, 1);
  if (!moved) return [...stops];
  next.splice(to, 0, moved);
  return next;
};

export const removeStop = (stops: readonly TripStop[], index: number): TripStop[] => {
  const stop = stops[index];
  if (!stop || stop.locked || stops.length <= 2) return [...stops];
  return stops.filter((_, current) => current !== index);
};

export const validateDraft = (draft: TripSetupDraft): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!draft.driver.id && !draft.driver.label.trim()) issues.push({ field: "driver", message: "Select or create a driver.", severity: "ERROR" });
  if (!draft.clocks.currentDutyStatus) issues.push({ field: "currentDutyStatus", message: "Current duty status must be explicit.", severity: "ERROR" });
  if (!draft.clocks.departureAt) issues.push({ field: "departureAt", message: "Departure date and time are required.", severity: "ERROR" });
  if (!draft.clocks.departureTimeZone) issues.push({ field: "departureTimeZone", message: "Departure time zone is required.", severity: "ERROR" });
  for (const [field, value] of [
    ["driveMinutesRemaining", draft.clocks.driveMinutesRemaining],
    ["shiftMinutesRemaining", draft.clocks.shiftMinutesRemaining],
    ["cycleMinutesRemaining", draft.clocks.cycleMinutesRemaining],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) issues.push({ field, message: "Clock values must be zero or greater.", severity: "ERROR" });
  }
  if (!draft.tractor.id && !draft.tractor.label.trim()) issues.push({ field: "tractor", message: "Select or create a tractor.", severity: "ERROR" });
  if (!draft.trailer.id && !draft.trailer.label.trim()) issues.push({ field: "trailer", message: "Select or create a trailer.", severity: "ERROR" });
  if (!draft.load.identifier.trim()) issues.push({ field: "load.identifier", message: "Load identifier is required.", severity: "ERROR" });
  if (draft.load.hazmat && !draft.load.hazmatClass.trim()) issues.push({ field: "load.hazmatClass", message: "Hazmat class is required for hazmat loads.", severity: "ERROR" });
  if (draft.load.totalCombinationWeightPounds === null) issues.push({ field: "load.totalCombinationWeightPounds", message: "Weight legality cannot be evaluated without total combination weight.", severity: "WARNING" });
  if (draft.load.heightInches === null || draft.load.widthInches === null || draft.load.lengthInches === null) issues.push({ field: "load.dimensions", message: "Dimension legality cannot be evaluated until height, width, and length are provided.", severity: "WARNING" });
  if (draft.stops.length < 2) issues.push({ field: "stops", message: "At least a start and destination are required.", severity: "ERROR" });
  draft.stops.forEach((stop, index) => {
    if (!stop.location.trim()) issues.push({ field: `stops.${index}.location`, message: `Stop ${index + 1} needs a location.`, severity: "ERROR" });
    if (stop.appointmentMode !== "NONE" && !stop.appointmentTimeZone) issues.push({ field: `stops.${index}.appointmentTimeZone`, message: `Stop ${index + 1} appointment time zone is required.`, severity: "ERROR" });
    if (stop.appointmentMode === "FIXED" && !stop.appointmentStart) issues.push({ field: `stops.${index}.appointmentStart`, message: `Stop ${index + 1} fixed appointment is required.`, severity: "ERROR" });
    if (stop.appointmentMode === "WINDOW" && (!stop.appointmentStart || !stop.appointmentEnd)) issues.push({ field: `stops.${index}.appointmentWindow`, message: `Stop ${index + 1} appointment window is incomplete.`, severity: "ERROR" });
    if (stop.serviceMode === "RANGE" && stop.serviceMinimumMinutes > stop.serviceMaximumMinutes) issues.push({ field: `stops.${index}.serviceRange`, message: `Stop ${index + 1} service minimum cannot exceed maximum.`, severity: "ERROR" });
  });
  return issues;
};

export const serializeDraft = (draft: TripSetupDraft): string => JSON.stringify({ ...draft, updatedAt: new Date().toISOString() });

export const deserializeDraft = (value: string | null): TripSetupDraft | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<TripSetupDraft>;
    if (!parsed.clocks || !parsed.load || !Array.isArray(parsed.stops)) return null;
    return { ...createInitialDraft(), ...parsed, stops: parsed.stops.map((stop) => ({ ...createStop(), ...stop })) };
  } catch {
    return null;
  }
};

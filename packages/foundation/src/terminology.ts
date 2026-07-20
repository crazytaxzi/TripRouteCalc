export const PRODUCT_TERMINOLOGY = Object.freeze({
  arrival: Object.freeze({
    label: 'Arrival time',
    definition: 'The time the tractor reaches the location.',
  }),
  checkIn: Object.freeze({
    label: 'Check-in time',
    definition:
      'The time the driver is expected to complete gate entry or facility check-in.',
  }),
  serviceCompletion: Object.freeze({
    label: 'Service completion time',
    definition:
      'The time loading, unloading, drop-and-hook, inspection, paperwork, or other stop activity is expected to finish.',
  }),
  departure: Object.freeze({
    label: 'Departure time',
    definition:
      'The time the driver can legally and operationally leave the location.',
  }),
  drivingClock: Object.freeze({
    label: 'Driving clock',
    definition:
      'The driver’s available driving time under the applicable HOS rules.',
  }),
  shiftClock: Object.freeze({
    label: 'Shift clock',
    definition:
      'The remaining time in the driver’s consecutive-hour driving window.',
  }),
  cycleClock: Object.freeze({
    label: 'Cycle clock',
    definition:
      'The remaining on-duty time in the applicable multi-day cycle.',
  }),
  onDutyNotDriving: Object.freeze({
    label: 'On-duty not driving',
    definition:
      'Time spent performing work such as inspections, fueling, loading, unloading, paperwork, or facility activities without driving.',
  }),
  stop: Object.freeze({
    label: 'Stop',
    definition: 'Any route location requiring an arrival calculation.',
  }),
  kpra: Object.freeze({
    label: 'KPRA',
    definition:
      'Kingpin-to-rearmost-axle distance, stored as a verified physical measurement rather than inferred from an unverified rail marker.',
  }),
});

export type ProductTerm = keyof typeof PRODUCT_TERMINOLOGY;

import { z } from 'zod';

const METERS_PER_MILE = 1_609.344;
const METERS_PER_KILOMETER = 1_000;
const POUNDS_PER_KILOGRAM = 2.204_622_621_848_775_7;
const INCHES_PER_FOOT = 12;
const INCHES_PER_METER = 39.370_078_740_157_48;
const INCHES_PER_CENTIMETER = 0.393_700_787_401_574_8;
const METERS_PER_SECOND_PER_MILE_PER_HOUR = 0.447_04;
const METERS_PER_SECOND_PER_KILOMETER_PER_HOUR = 1 / 3.6;

const finiteNonNegativeNumber = z.number().finite().nonnegative();
const nonNegativeSafeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

function freeze<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export const DistanceSchema = z
  .object({
    value: finiteNonNegativeNumber,
    unit: z.literal('meter'),
  })
  .strict();

export type Distance = Readonly<z.infer<typeof DistanceSchema>>;

const DistanceInputSchema = z.discriminatedUnion('unit', [
  DistanceSchema,
  z.object({ value: finiteNonNegativeNumber, unit: z.literal('mile') }).strict(),
  z
    .object({ value: finiteNonNegativeNumber, unit: z.literal('kilometer') })
    .strict(),
]);

export function distance(input: unknown): Distance {
  const parsed = DistanceInputSchema.parse(input);
  const value =
    parsed.unit === 'meter'
      ? parsed.value
      : parsed.unit === 'mile'
        ? parsed.value * METERS_PER_MILE
        : parsed.value * METERS_PER_KILOMETER;

  return freeze(DistanceSchema.parse({ value, unit: 'meter' }));
}

export function distanceInMeters(value: number): Distance {
  return distance({ value, unit: 'meter' });
}

export function distanceInMiles(value: number): Distance {
  return distance({ value, unit: 'mile' });
}

export function toMiles(value: Distance): number {
  return DistanceSchema.parse(value).value / METERS_PER_MILE;
}

export function toKilometers(value: Distance): number {
  return DistanceSchema.parse(value).value / METERS_PER_KILOMETER;
}

export const DurationSchema = z
  .object({
    value: nonNegativeSafeInteger,
    unit: z.literal('minute'),
  })
  .strict();

export type Duration = Readonly<z.infer<typeof DurationSchema>>;

const wholeMinuteHours = finiteNonNegativeNumber.refine(
  (value) => Number.isSafeInteger(value * 60),
  'Hours must convert exactly to whole minutes.',
);

const wholeMinuteSeconds = nonNegativeSafeInteger.refine(
  (value) => value % 60 === 0,
  'Seconds must convert exactly to whole minutes.',
);

const DurationInputSchema = z.discriminatedUnion('unit', [
  DurationSchema,
  z.object({ value: wholeMinuteSeconds, unit: z.literal('second') }).strict(),
  z.object({ value: wholeMinuteHours, unit: z.literal('hour') }).strict(),
]);

export function duration(input: unknown): Duration {
  const parsed = DurationInputSchema.parse(input);
  const value =
    parsed.unit === 'minute'
      ? parsed.value
      : parsed.unit === 'second'
        ? parsed.value / 60
        : parsed.value * 60;

  return freeze(DurationSchema.parse({ value, unit: 'minute' }));
}

export function durationInMinutes(value: number): Duration {
  return duration({ value, unit: 'minute' });
}

export function durationInHours(value: number): Duration {
  return duration({ value, unit: 'hour' });
}

export const WeightSchema = z
  .object({
    value: finiteNonNegativeNumber,
    unit: z.literal('pound'),
  })
  .strict();

export type Weight = Readonly<z.infer<typeof WeightSchema>>;

const WeightInputSchema = z.discriminatedUnion('unit', [
  WeightSchema,
  z.object({ value: finiteNonNegativeNumber, unit: z.literal('kilogram') }).strict(),
]);

export function weight(input: unknown): Weight {
  const parsed = WeightInputSchema.parse(input);
  const value =
    parsed.unit === 'pound'
      ? parsed.value
      : parsed.value * POUNDS_PER_KILOGRAM;

  return freeze(WeightSchema.parse({ value, unit: 'pound' }));
}

export function weightInPounds(value: number): Weight {
  return weight({ value, unit: 'pound' });
}

export function toKilograms(value: Weight): number {
  return WeightSchema.parse(value).value / POUNDS_PER_KILOGRAM;
}

export const LengthSchema = z
  .object({
    value: finiteNonNegativeNumber,
    unit: z.literal('inch'),
  })
  .strict();

export type Length = Readonly<z.infer<typeof LengthSchema>>;

const LengthInputSchema = z.discriminatedUnion('unit', [
  LengthSchema,
  z.object({ value: finiteNonNegativeNumber, unit: z.literal('foot') }).strict(),
  z.object({ value: finiteNonNegativeNumber, unit: z.literal('meter') }).strict(),
  z
    .object({ value: finiteNonNegativeNumber, unit: z.literal('centimeter') })
    .strict(),
]);

export function length(input: unknown): Length {
  const parsed = LengthInputSchema.parse(input);
  const value =
    parsed.unit === 'inch'
      ? parsed.value
      : parsed.unit === 'foot'
        ? parsed.value * INCHES_PER_FOOT
        : parsed.unit === 'meter'
          ? parsed.value * INCHES_PER_METER
          : parsed.value * INCHES_PER_CENTIMETER;

  return freeze(LengthSchema.parse({ value, unit: 'inch' }));
}

export function lengthInInches(value: number): Length {
  return length({ value, unit: 'inch' });
}

export function lengthInFeet(value: number): Length {
  return length({ value, unit: 'foot' });
}

export function toFeet(value: Length): number {
  return LengthSchema.parse(value).value / INCHES_PER_FOOT;
}

export const SpeedSchema = z
  .object({
    value: finiteNonNegativeNumber,
    unit: z.literal('meter-per-second'),
  })
  .strict();

export type Speed = Readonly<z.infer<typeof SpeedSchema>>;

const SpeedInputSchema = z.discriminatedUnion('unit', [
  SpeedSchema,
  z
    .object({ value: finiteNonNegativeNumber, unit: z.literal('mile-per-hour') })
    .strict(),
  z
    .object({ value: finiteNonNegativeNumber, unit: z.literal('kilometer-per-hour') })
    .strict(),
]);

export function speed(input: unknown): Speed {
  const parsed = SpeedInputSchema.parse(input);
  const value =
    parsed.unit === 'meter-per-second'
      ? parsed.value
      : parsed.unit === 'mile-per-hour'
        ? parsed.value * METERS_PER_SECOND_PER_MILE_PER_HOUR
        : parsed.value * METERS_PER_SECOND_PER_KILOMETER_PER_HOUR;

  return freeze(SpeedSchema.parse({ value, unit: 'meter-per-second' }));
}

export function speedInMilesPerHour(value: number): Speed {
  return speed({ value, unit: 'mile-per-hour' });
}

export function toMilesPerHour(value: Speed): number {
  return (
    SpeedSchema.parse(value).value /
    METERS_PER_SECOND_PER_MILE_PER_HOUR
  );
}

export function toKilometersPerHour(value: Speed): number {
  return (
    SpeedSchema.parse(value).value /
    METERS_PER_SECOND_PER_KILOMETER_PER_HOUR
  );
}

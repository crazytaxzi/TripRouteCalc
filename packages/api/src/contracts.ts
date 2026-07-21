import {
  LoadProfileSchema,
  TractorProfileSchema,
  TrailerProfileSchema,
  TripStopPlanSchema,
} from '@trip-route-calc/foundation';
import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);
const publicIdentifier = z.string().trim().min(8).max(512);
const expectedRevisionNumber = z.number().int().nonnegative();
const jsonObject = z.record(z.unknown());

export const IdempotencyKeySchema = z.string().trim().min(8).max(256);

export const TripPathSchema = z
  .object({ tripId: publicIdentifier })
  .strict();
export const TripStopPathSchema = z
  .object({ tripId: publicIdentifier, stopId: publicIdentifier })
  .strict();

export const CreateTripBodySchema = z
  .object({
    driverId: publicIdentifier,
    ruleSetVersion: nonEmptyText.default('unselected'),
  })
  .strict();

export const PatchTripBodySchema = z
  .object({
    expectedRevisionNumber,
    tractorId: publicIdentifier.nullable().optional(),
    trailerId: publicIdentifier.nullable().optional(),
    loadId: publicIdentifier.nullable().optional(),
    driverHosStateId: publicIdentifier.nullable().optional(),
    ruleSetVersion: nonEmptyText.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.tractorId !== undefined ||
      value.trailerId !== undefined ||
      value.loadId !== undefined ||
      value.driverHosStateId !== undefined ||
      value.ruleSetVersion !== undefined,
    'At least one trip field must be changed.',
  );

export const CreateStopBodySchema = z
  .object({
    expectedRevisionNumber,
    stop: TripStopPlanSchema.omit({ id: true }),
  })
  .strict();

export const PatchStopBodySchema = z
  .object({
    expectedRevisionNumber,
    patch: TripStopPlanSchema.omit({ id: true, sequence: true })
      .partial()
      .strict(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value.patch).length > 0,
    'At least one stop field must be changed.',
  );

export const DeleteStopBodySchema = z
  .object({ expectedRevisionNumber })
  .strict();

export const ReorderStopsBodySchema = z
  .object({
    expectedRevisionNumber,
    stopIds: z.array(publicIdentifier).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.stopIds).size !== value.stopIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stopIds'],
        message: 'Stop reorder identifiers must be unique.',
      });
    }
  });

export const CalculateTripBodySchema = z
  .object({
    expectedRevisionNumber,
    simulation: jsonObject,
  })
  .strict();

export const CreateDriverBodySchema = z
  .object({ displayName: nonEmptyText.max(200) })
  .strict();

export const CreateTractorBodySchema = TractorProfileSchema;
export const CreateTrailerBodySchema = TrailerProfileSchema;
export const CreateLoadBodySchema = LoadProfileSchema;

export const ValidateRouteBodySchema = jsonObject;

export const RegulationVersionQuerySchema = z
  .object({
    name: nonEmptyText,
    at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const RevisionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    beforeRevisionNumber: z.coerce.number().int().positive().optional(),
  })
  .strict();

export type CreateTripBody = z.infer<typeof CreateTripBodySchema>;
export type PatchTripBody = z.infer<typeof PatchTripBodySchema>;
export type CreateStopBody = z.infer<typeof CreateStopBodySchema>;
export type PatchStopBody = z.infer<typeof PatchStopBodySchema>;
export type DeleteStopBody = z.infer<typeof DeleteStopBodySchema>;
export type ReorderStopsBody = z.infer<typeof ReorderStopsBodySchema>;
export type CalculateTripBody = z.infer<typeof CalculateTripBodySchema>;
export type CreateDriverBody = z.infer<typeof CreateDriverBodySchema>;
export type RegulationVersionQuery = z.infer<typeof RegulationVersionQuerySchema>;
export type RevisionListQuery = z.infer<typeof RevisionListQuerySchema>;

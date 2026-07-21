import {
  LoadProfileSchema,
  TractorProfileSchema,
  TrailerProfileSchema,
} from '@trip-route-calc/foundation';
import type {
  LoadProfile,
  TractorProfile,
  TrailerProfile,
} from '@trip-route-calc/foundation';
import { z } from 'zod';

const publicIdentifier = z.string().trim().min(8).max(512);
const nonEmptyText = z.string().trim().min(1);

export const DriverProfilePathSchema = z
  .object({ driverId: publicIdentifier })
  .strict();
export const TractorProfilePathSchema = z
  .object({ tractorId: publicIdentifier })
  .strict();
export const TrailerProfilePathSchema = z
  .object({ trailerId: publicIdentifier })
  .strict();
export const LoadProfilePathSchema = z
  .object({ loadId: publicIdentifier })
  .strict();

export const UpdateDriverProfileBodySchema = z
  .object({ displayName: nonEmptyText.max(200) })
  .strict();
export const UpdateTractorProfileBodySchema = TractorProfileSchema;
export const UpdateTrailerProfileBodySchema = TrailerProfileSchema;
export const UpdateLoadProfileBodySchema = LoadProfileSchema;

export interface PublicDriverProfile {
  readonly driverId: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicEquipmentProfile<Profile> {
  readonly profile: Profile;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PublicTractorProfile = PublicEquipmentProfile<TractorProfile> &
  Readonly<{ tractorId: string }>;
export type PublicTrailerProfile = PublicEquipmentProfile<TrailerProfile> &
  Readonly<{ trailerId: string }>;
export type PublicLoadProfile = PublicEquipmentProfile<LoadProfile> &
  Readonly<{ loadId: string }>;

export type UpdateDriverProfileBody = z.infer<
  typeof UpdateDriverProfileBodySchema
>;

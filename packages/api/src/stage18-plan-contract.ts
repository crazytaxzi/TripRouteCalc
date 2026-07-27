import { COMMERCIAL_ROUTE_AVOIDANCES, COMMERCIAL_ROUTE_POLICIES } from '@trip-route-calc/foundation';
import { z } from 'zod';

import { PlanTripBodySchema } from './contracts.js';

export const Stage18PlanTripBodySchema = PlanTripBodySchema.extend({
  routePolicy: z.enum(COMMERCIAL_ROUTE_POLICIES),
  avoidances: z.array(z.enum(COMMERCIAL_ROUTE_AVOIDANCES)).default([]),
});

export type Stage18PlanTripBody = z.infer<typeof Stage18PlanTripBodySchema>;

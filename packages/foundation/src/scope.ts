import { z } from 'zod';

export const FreightEquipmentTypeSchema = z.enum([
  'dry-van',
  'refrigerated',
  'flatbed',
  'similar-general-freight',
]);

export type FreightEquipmentType = z.infer<typeof FreightEquipmentTypeSchema>;

export const FirstReleaseOperatingScopeSchema = z
  .object({
    country: z.literal('US'),
    cargoOperation: z.literal('property-carrying'),
    routeJurisdiction: z.literal('interstate'),
    driverConfiguration: z.literal('solo'),
    hosRuleSet: z.literal('federal-property-standard'),
    vehicleCombination: z.literal('tractor-semitrailer'),
    freightEquipment: FreightEquipmentTypeSchema,
    automaticallyAppliedSpecialRules: z.tuple([]),
  })
  .strict();

export type FirstReleaseOperatingScope = Readonly<
  z.infer<typeof FirstReleaseOperatingScopeSchema>
>;

export const FIRST_RELEASE_SCOPE = Object.freeze({
  country: 'US',
  cargoOperation: 'property-carrying',
  routeJurisdiction: 'interstate',
  driverConfiguration: 'solo',
  hosRuleSet: 'federal-property-standard',
  vehicleCombination: 'tractor-semitrailer',
  freightEquipment: Object.freeze([
    'dry-van',
    'refrigerated',
    'flatbed',
    'similar-general-freight',
  ] as const),
  automaticallyAppliedSpecialRules: Object.freeze([]),
} as const);

export const MANUAL_VERIFICATION_MODES = Object.freeze([
  'team-drivers',
  'passenger-carrying',
  'canada',
  'mexico',
  'alaska-specific-rules',
  'intrastate-hos',
  'oilfield-rules',
  'agricultural-exemptions',
  'short-haul',
  'hazmat-specific-restrictions',
  'oversize-overweight-permits',
  'doubles-triples',
  'personal-conveyance',
  'yard-move',
  'eld-import',
  'emergency-declaration',
  'pilot-program',
  'adverse-driving-exception',
] as const);

export type ManualVerificationMode = (typeof MANUAL_VERIFICATION_MODES)[number];

export interface UnsupportedModeBoundary {
  readonly mode: ManualVerificationMode;
  readonly policy: 'explicit-selection-and-supporting-information-required';
  readonly automaticallyApplied: false;
}

export const UNSUPPORTED_MODE_BOUNDARIES: readonly UnsupportedModeBoundary[] =
  Object.freeze(
    MANUAL_VERIFICATION_MODES.map((mode) =>
      Object.freeze({
        mode,
        policy: 'explicit-selection-and-supporting-information-required' as const,
        automaticallyApplied: false as const,
      }),
    ),
  );

export function firstReleaseOperatingScope(
  input: unknown,
): FirstReleaseOperatingScope {
  return Object.freeze(FirstReleaseOperatingScopeSchema.parse(input));
}

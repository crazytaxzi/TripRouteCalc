-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'PLANNER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('off-duty', 'sleeper-berth', 'driving', 'on-duty-not-driving');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('start-location', 'tractor-pickup', 'trailer-pickup', 'shipper', 'intermediate-pickup', 'intermediate-delivery', 'final-consignee', 'fuel', 'scale', 'inspection', 'maintenance', 'food', 'driver-break', 'sleeper-rest', 'terminal', 'border-crossing', 'other');

-- CreateEnum
CREATE TYPE "RouteVerificationStatus" AS ENUM ('unverified', 'commercial-route-provider-verified');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('information', 'warning', 'blocking');

-- CreateEnum
CREATE TYPE "CalculationConfidence" AS ENUM ('high', 'medium', 'low', 'blocked');

-- CreateEnum
CREATE TYPE "ProviderSnapshotStorageMode" AS ENUM ('raw-json', 'normalized-snapshot', 'provider-reference');

-- CreateEnum
CREATE TYPE "RegulatoryRuleSetStatus" AS ENUM ('draft', 'active', 'inactive');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carriers" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "homeTerminalTimeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_memberships" (
    "carrierId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "TenantRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrier_memberships_pkey" PRIMARY KEY ("carrierId","userId")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_hos_states" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "asOf" TIMESTAMPTZ(3) NOT NULL,
    "currentDutyStatus" "DutyStatus" NOT NULL,
    "drivingClockRemainingValue" BIGINT NOT NULL,
    "drivingClockRemainingUnit" TEXT NOT NULL DEFAULT 'minute',
    "shiftClockRemainingValue" BIGINT NOT NULL,
    "shiftClockRemainingUnit" TEXT NOT NULL DEFAULT 'minute',
    "cycleClockRemainingValue" BIGINT NOT NULL,
    "cycleClockRemainingUnit" TEXT NOT NULL DEFAULT 'minute',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_hos_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_duty_events" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "durationValue" BIGINT NOT NULL,
    "durationUnit" TEXT NOT NULL DEFAULT 'minute',
    "dutyStatus" "DutyStatus" NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_duty_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tractors" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "grossVehicleWeightRatingValue" DECIMAL(18,6),
    "grossVehicleWeightRatingUnit" TEXT DEFAULT 'pound',
    "heightValue" DECIMAL(18,6),
    "heightUnit" TEXT DEFAULT 'inch',
    "widthValue" DECIMAL(18,6),
    "widthUnit" TEXT DEFAULT 'inch',
    "lengthValue" DECIMAL(18,6),
    "lengthUnit" TEXT DEFAULT 'inch',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trailers" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "grossVehicleWeightRatingValue" DECIMAL(18,6),
    "grossVehicleWeightRatingUnit" TEXT DEFAULT 'pound',
    "heightValue" DECIMAL(18,6),
    "heightUnit" TEXT DEFAULT 'inch',
    "widthValue" DECIMAL(18,6),
    "widthUnit" TEXT DEFAULT 'inch',
    "lengthValue" DECIMAL(18,6),
    "lengthUnit" TEXT DEFAULT 'inch',
    "kpraValue" DECIMAL(18,6),
    "kpraUnit" TEXT DEFAULT 'inch',
    "kpraVerificationSource" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loads" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "cargoWeightValue" DECIMAL(18,6),
    "cargoWeightUnit" TEXT DEFAULT 'pound',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "addressText" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_service_profiles" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "minimumDurationValue" BIGINT NOT NULL,
    "minimumDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "expectedDurationValue" BIGINT NOT NULL,
    "expectedDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "maximumDurationValue" BIGINT NOT NULL,
    "maximumDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "expectedDutyStatus" "DutyStatus" NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_service_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_service_observations" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "serviceProfileId" UUID,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "actualDurationValue" BIGINT NOT NULL,
    "actualDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "source" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_service_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "currentRevisionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_revisions" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculationTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "loadId" UUID,
    "tractorId" UUID,
    "trailerId" UUID,
    "driverHosStateId" UUID,
    "ruleSetVersion" TEXT NOT NULL,
    "routingProviderName" TEXT,
    "routingProviderVersion" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB,
    "warningsSnapshot" JSONB NOT NULL,
    "acknowledgementsSnapshot" JSONB NOT NULL,
    "overridesSnapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "trip_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "StopType" NOT NULL,
    "required" BOOLEAN NOT NULL,
    "facilityId" UUID,
    "timeZone" TEXT NOT NULL,
    "expectedServiceDurationValue" BIGINT NOT NULL,
    "expectedServiceDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_windows" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "stopId" UUID NOT NULL,
    "startLocalDateTime" TEXT NOT NULL,
    "startTimeZone" TEXT NOT NULL,
    "startRepeatedTimeChoice" TEXT,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endLocalDateTime" TEXT NOT NULL,
    "endTimeZone" TEXT NOT NULL,
    "endRepeatedTimeChoice" TEXT,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "totalDistanceValue" DECIMAL(18,6) NOT NULL,
    "totalDistanceUnit" TEXT NOT NULL DEFAULT 'meter',
    "estimatedDrivingDurationValue" BIGINT NOT NULL,
    "estimatedDrivingDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "verificationStatus" "RouteVerificationStatus" NOT NULL DEFAULT 'unverified',
    "verificationSource" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_legs" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "originStopId" UUID NOT NULL,
    "destinationStopId" UUID NOT NULL,
    "distanceValue" DECIMAL(18,6) NOT NULL,
    "distanceUnit" TEXT NOT NULL DEFAULT 'meter',
    "estimatedDrivingDurationValue" BIGINT NOT NULL,
    "estimatedDrivingDurationUnit" TEXT NOT NULL DEFAULT 'minute',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_segments" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "routeLegId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "distanceValue" DECIMAL(18,6) NOT NULL,
    "distanceUnit" TEXT NOT NULL DEFAULT 'meter',
    "expectedSpeedValue" DECIMAL(18,6),
    "expectedSpeedUnit" TEXT DEFAULT 'meter-per-second',
    "jurisdictionCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_restrictions" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "routeSegmentId" UUID NOT NULL,
    "restrictionType" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "evidenceSnapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permits" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3) NOT NULL,
    "verificationSource" TEXT NOT NULL,
    "evidenceSnapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_events" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "stopId" UUID,
    "type" TEXT NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "durationValue" BIGINT NOT NULL,
    "durationUnit" TEXT NOT NULL DEFAULT 'minute',
    "dutyStatus" "DutyStatus" NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planned_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_warnings" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "routeSegmentId" UUID,
    "stopId" UUID,
    "severity" "WarningSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "sourceReference" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warning_acknowledgements" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "warningId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "warning_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_assumptions" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_overrides" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_results" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL,
    "routeId" UUID,
    "confidence" "CalculationConfidence" NOT NULL,
    "confidenceReasons" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_provider_responses" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "routeId" UUID,
    "providerName" TEXT NOT NULL,
    "providerVersion" TEXT,
    "providerRequestId" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "storageMode" "ProviderSnapshotStorageMode" NOT NULL,
    "licenseAllowsRawStorage" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" JSONB,
    "normalizedSnapshot" JSONB,
    "providerReference" TEXT,
    "responseHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_provider_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_rule_sets" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "RegulatoryRuleSetStatus" NOT NULL DEFAULT 'draft',
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "sourceTitle" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceMetadata" JSONB NOT NULL,
    "lastVerifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "regulatory_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jurisdiction_rules" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "sourceTitle" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourceMetadata" JSONB NOT NULL,
    "lastVerifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ruleDefinition" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "jurisdiction_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_revision_rules" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "jurisdictionRuleId" UUID NOT NULL,
    "capturedVersion" TEXT NOT NULL,
    "capturedSourceMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_revision_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_rule_changes" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "ruleSetId" UUID NOT NULL,
    "changedByUserId" UUID NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "regulatory_rule_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "tripRevisionId" UUID NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "format" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "actorUserId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "carrier_memberships_userId_idx" ON "carrier_memberships"("userId");

-- CreateIndex
CREATE INDEX "drivers_carrierId_displayName_idx" ON "drivers"("carrierId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_id_carrierId_key" ON "drivers"("id", "carrierId");

-- CreateIndex
CREATE INDEX "driver_hos_states_carrierId_driverId_asOf_idx" ON "driver_hos_states"("carrierId", "driverId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "driver_hos_states_id_carrierId_key" ON "driver_hos_states"("id", "carrierId");

-- CreateIndex
CREATE INDEX "driver_duty_events_carrierId_driverId_startAt_idx" ON "driver_duty_events"("carrierId", "driverId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "driver_duty_events_id_carrierId_key" ON "driver_duty_events"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "tractors_carrierId_unitNumber_key" ON "tractors"("carrierId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tractors_id_carrierId_key" ON "tractors"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "trailers_carrierId_unitNumber_key" ON "trailers"("carrierId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "trailers_id_carrierId_key" ON "trailers"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "loads_carrierId_referenceNumber_key" ON "loads"("carrierId", "referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "loads_id_carrierId_key" ON "loads"("id", "carrierId");

-- CreateIndex
CREATE INDEX "facilities_carrierId_name_idx" ON "facilities"("carrierId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_id_carrierId_key" ON "facilities"("id", "carrierId");

-- CreateIndex
CREATE INDEX "facility_service_profiles_carrierId_facilityId_effectiveFro_idx" ON "facility_service_profiles"("carrierId", "facilityId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "facility_service_profiles_id_carrierId_key" ON "facility_service_profiles"("id", "carrierId");

-- CreateIndex
CREATE INDEX "facility_service_observations_carrierId_facilityId_observed_idx" ON "facility_service_observations"("carrierId", "facilityId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "facility_service_observations_id_carrierId_key" ON "facility_service_observations"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "trips_currentRevisionId_key" ON "trips"("currentRevisionId");

-- CreateIndex
CREATE INDEX "trips_carrierId_driverId_createdAt_idx" ON "trips"("carrierId", "driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trips_id_carrierId_key" ON "trips"("id", "carrierId");

-- CreateIndex
CREATE INDEX "trip_revisions_carrierId_tripId_createdAt_idx" ON "trip_revisions"("carrierId", "tripId", "createdAt");

-- CreateIndex
CREATE INDEX "trip_revisions_carrierId_contentHash_idx" ON "trip_revisions"("carrierId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "trip_revisions_tripId_revisionNumber_key" ON "trip_revisions"("tripId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "trip_revisions_id_carrierId_key" ON "trip_revisions"("id", "carrierId");

-- CreateIndex
CREATE INDEX "trip_stops_carrierId_tripRevisionId_sequence_idx" ON "trip_stops"("carrierId", "tripRevisionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trip_stops_tripRevisionId_sequence_key" ON "trip_stops"("tripRevisionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "trip_stops_id_carrierId_key" ON "trip_stops"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_windows_stopId_key" ON "appointment_windows"("stopId");

-- CreateIndex
CREATE INDEX "appointment_windows_carrierId_startAt_endAt_idx" ON "appointment_windows"("carrierId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_windows_id_carrierId_key" ON "appointment_windows"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "routes_tripRevisionId_key" ON "routes"("tripRevisionId");

-- CreateIndex
CREATE INDEX "routes_carrierId_tripRevisionId_idx" ON "routes"("carrierId", "tripRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "routes_id_carrierId_key" ON "routes"("id", "carrierId");

-- CreateIndex
CREATE INDEX "route_legs_carrierId_routeId_sequence_idx" ON "route_legs"("carrierId", "routeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "route_legs_routeId_sequence_key" ON "route_legs"("routeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "route_legs_id_carrierId_key" ON "route_legs"("id", "carrierId");

-- CreateIndex
CREATE INDEX "route_segments_carrierId_routeLegId_sequence_idx" ON "route_segments"("carrierId", "routeLegId", "sequence");

-- CreateIndex
CREATE INDEX "route_segments_carrierId_jurisdictionCode_idx" ON "route_segments"("carrierId", "jurisdictionCode");

-- CreateIndex
CREATE UNIQUE INDEX "route_segments_routeLegId_sequence_key" ON "route_segments"("routeLegId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "route_segments_id_carrierId_key" ON "route_segments"("id", "carrierId");

-- CreateIndex
CREATE INDEX "route_restrictions_carrierId_routeSegmentId_idx" ON "route_restrictions"("carrierId", "routeSegmentId");

-- CreateIndex
CREATE UNIQUE INDEX "route_restrictions_id_carrierId_key" ON "route_restrictions"("id", "carrierId");

-- CreateIndex
CREATE INDEX "permits_carrierId_tripRevisionId_idx" ON "permits"("carrierId", "tripRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "permits_carrierId_jurisdictionCode_permitNumber_key" ON "permits"("carrierId", "jurisdictionCode", "permitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "permits_id_carrierId_key" ON "permits"("id", "carrierId");

-- CreateIndex
CREATE INDEX "planned_events_carrierId_tripRevisionId_startAt_idx" ON "planned_events"("carrierId", "tripRevisionId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "planned_events_id_carrierId_key" ON "planned_events"("id", "carrierId");

-- CreateIndex
CREATE INDEX "compliance_warnings_carrierId_tripRevisionId_severity_idx" ON "compliance_warnings"("carrierId", "tripRevisionId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_warnings_tripRevisionId_code_key" ON "compliance_warnings"("tripRevisionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_warnings_id_carrierId_key" ON "compliance_warnings"("id", "carrierId");

-- CreateIndex
CREATE INDEX "warning_acknowledgements_carrierId_warningId_idx" ON "warning_acknowledgements"("carrierId", "warningId");

-- CreateIndex
CREATE UNIQUE INDEX "warning_acknowledgements_warningId_userId_key" ON "warning_acknowledgements"("warningId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "warning_acknowledgements_id_carrierId_key" ON "warning_acknowledgements"("id", "carrierId");

-- CreateIndex
CREATE INDEX "calculation_assumptions_carrierId_tripRevisionId_idx" ON "calculation_assumptions"("carrierId", "tripRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_assumptions_tripRevisionId_key_key" ON "calculation_assumptions"("tripRevisionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_assumptions_id_carrierId_key" ON "calculation_assumptions"("id", "carrierId");

-- CreateIndex
CREATE INDEX "user_overrides_carrierId_tripRevisionId_idx" ON "user_overrides"("carrierId", "tripRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_overrides_tripRevisionId_key_key" ON "user_overrides"("tripRevisionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "user_overrides_id_carrierId_key" ON "user_overrides"("id", "carrierId");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_results_tripRevisionId_key" ON "calculation_results"("tripRevisionId");

-- CreateIndex
CREATE INDEX "calculation_results_carrierId_calculatedAt_idx" ON "calculation_results"("carrierId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_results_id_carrierId_key" ON "calculation_results"("id", "carrierId");

-- CreateIndex
CREATE INDEX "route_provider_responses_carrierId_tripRevisionId_receivedA_idx" ON "route_provider_responses"("carrierId", "tripRevisionId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "route_provider_responses_carrierId_providerName_responseHas_key" ON "route_provider_responses"("carrierId", "providerName", "responseHash");

-- CreateIndex
CREATE UNIQUE INDEX "route_provider_responses_id_carrierId_key" ON "route_provider_responses"("id", "carrierId");

-- CreateIndex
CREATE INDEX "regulatory_rule_sets_carrierId_status_effectiveFrom_idx" ON "regulatory_rule_sets"("carrierId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_rule_sets_carrierId_name_version_key" ON "regulatory_rule_sets"("carrierId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_rule_sets_id_carrierId_key" ON "regulatory_rule_sets"("id", "carrierId");

-- CreateIndex
CREATE INDEX "jurisdiction_rules_carrierId_jurisdictionCode_ruleType_acti_idx" ON "jurisdiction_rules"("carrierId", "jurisdictionCode", "ruleType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "jurisdiction_rules_ruleSetId_jurisdictionCode_ruleType_vers_key" ON "jurisdiction_rules"("ruleSetId", "jurisdictionCode", "ruleType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "jurisdiction_rules_id_carrierId_key" ON "jurisdiction_rules"("id", "carrierId");

-- CreateIndex
CREATE INDEX "trip_revision_rules_carrierId_tripRevisionId_idx" ON "trip_revision_rules"("carrierId", "tripRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_revision_rules_tripRevisionId_jurisdictionRuleId_key" ON "trip_revision_rules"("tripRevisionId", "jurisdictionRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_revision_rules_id_carrierId_key" ON "trip_revision_rules"("id", "carrierId");

-- CreateIndex
CREATE INDEX "regulatory_rule_changes_carrierId_ruleSetId_changedAt_idx" ON "regulatory_rule_changes"("carrierId", "ruleSetId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_rule_changes_id_carrierId_key" ON "regulatory_rule_changes"("id", "carrierId");

-- CreateIndex
CREATE INDEX "export_history_carrierId_generatedAt_idx" ON "export_history"("carrierId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "export_history_carrierId_tripRevisionId_contentHash_key" ON "export_history"("carrierId", "tripRevisionId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "export_history_id_carrierId_key" ON "export_history"("id", "carrierId");

-- CreateIndex
CREATE INDEX "audit_events_carrierId_entityType_entityId_occurredAt_idx" ON "audit_events"("carrierId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_id_carrierId_key" ON "audit_events"("id", "carrierId");

-- AddForeignKey
ALTER TABLE "carrier_memberships" ADD CONSTRAINT "carrier_memberships_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_memberships" ADD CONSTRAINT "carrier_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_hos_states" ADD CONSTRAINT "driver_hos_states_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_hos_states" ADD CONSTRAINT "driver_hos_states_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_duty_events" ADD CONSTRAINT "driver_duty_events_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_duty_events" ADD CONSTRAINT "driver_duty_events_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tractors" ADD CONSTRAINT "tractors_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailers" ADD CONSTRAINT "trailers_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loads" ADD CONSTRAINT "loads_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_service_profiles" ADD CONSTRAINT "facility_service_profiles_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_service_profiles" ADD CONSTRAINT "facility_service_profiles_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_service_observations" ADD CONSTRAINT "facility_service_observations_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_service_observations" ADD CONSTRAINT "facility_service_observations_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_service_observations" ADD CONSTRAINT "facility_service_observations_serviceProfileId_fkey" FOREIGN KEY ("serviceProfileId") REFERENCES "facility_service_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "loads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_tractorId_fkey" FOREIGN KEY ("tractorId") REFERENCES "tractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revisions" ADD CONSTRAINT "trip_revisions_driverHosStateId_fkey" FOREIGN KEY ("driverHosStateId") REFERENCES "driver_hos_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_windows" ADD CONSTRAINT "appointment_windows_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_windows" ADD CONSTRAINT "appointment_windows_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_originStopId_fkey" FOREIGN KEY ("originStopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_legs" ADD CONSTRAINT "route_legs_destinationStopId_fkey" FOREIGN KEY ("destinationStopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_routeLegId_fkey" FOREIGN KEY ("routeLegId") REFERENCES "route_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_restrictions" ADD CONSTRAINT "route_restrictions_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_restrictions" ADD CONSTRAINT "route_restrictions_routeSegmentId_fkey" FOREIGN KEY ("routeSegmentId") REFERENCES "route_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_warnings" ADD CONSTRAINT "compliance_warnings_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_warnings" ADD CONSTRAINT "compliance_warnings_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_warnings" ADD CONSTRAINT "compliance_warnings_routeSegmentId_fkey" FOREIGN KEY ("routeSegmentId") REFERENCES "route_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_warnings" ADD CONSTRAINT "compliance_warnings_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_acknowledgements" ADD CONSTRAINT "warning_acknowledgements_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_acknowledgements" ADD CONSTRAINT "warning_acknowledgements_warningId_fkey" FOREIGN KEY ("warningId") REFERENCES "compliance_warnings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warning_acknowledgements" ADD CONSTRAINT "warning_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_assumptions" ADD CONSTRAINT "calculation_assumptions_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_assumptions" ADD CONSTRAINT "calculation_assumptions_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_overrides" ADD CONSTRAINT "user_overrides_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_overrides" ADD CONSTRAINT "user_overrides_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_overrides" ADD CONSTRAINT "user_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_provider_responses" ADD CONSTRAINT "route_provider_responses_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_provider_responses" ADD CONSTRAINT "route_provider_responses_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_provider_responses" ADD CONSTRAINT "route_provider_responses_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_rule_sets" ADD CONSTRAINT "regulatory_rule_sets_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurisdiction_rules" ADD CONSTRAINT "jurisdiction_rules_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jurisdiction_rules" ADD CONSTRAINT "jurisdiction_rules_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "regulatory_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revision_rules" ADD CONSTRAINT "trip_revision_rules_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revision_rules" ADD CONSTRAINT "trip_revision_rules_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_revision_rules" ADD CONSTRAINT "trip_revision_rules_jurisdictionRuleId_fkey" FOREIGN KEY ("jurisdictionRuleId") REFERENCES "jurisdiction_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_rule_changes" ADD CONSTRAINT "regulatory_rule_changes_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_rule_changes" ADD CONSTRAINT "regulatory_rule_changes_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "regulatory_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_rule_changes" ADD CONSTRAINT "regulatory_rule_changes_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_tripRevisionId_fkey" FOREIGN KEY ("tripRevisionId") REFERENCES "trip_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stage 03 safety constraints that are intentionally database-enforced.
ALTER TABLE "driver_hos_states"
  ADD CONSTRAINT "driver_hos_state_units_and_ranges"
  CHECK (
    "drivingClockRemainingValue" >= 0 AND "drivingClockRemainingUnit" = 'minute' AND
    "shiftClockRemainingValue" >= 0 AND "shiftClockRemainingUnit" = 'minute' AND
    "cycleClockRemainingValue" >= 0 AND "cycleClockRemainingUnit" = 'minute'
  );

ALTER TABLE "driver_duty_events"
  ADD CONSTRAINT "driver_duty_event_time_and_duration"
  CHECK ("endAt" > "startAt" AND "durationValue" >= 0 AND "durationUnit" = 'minute');

ALTER TABLE "trip_stops"
  ADD CONSTRAINT "trip_stop_order_and_duration"
  CHECK ("sequence" > 0 AND "expectedServiceDurationValue" >= 0 AND "expectedServiceDurationUnit" = 'minute');

ALTER TABLE "appointment_windows"
  ADD CONSTRAINT "appointment_window_moves_forward"
  CHECK ("endAt" > "startAt");

ALTER TABLE "routes"
  ADD CONSTRAINT "route_measurements_and_verification"
  CHECK (
    "totalDistanceValue" >= 0 AND "totalDistanceUnit" = 'meter' AND
    "estimatedDrivingDurationValue" >= 0 AND "estimatedDrivingDurationUnit" = 'minute' AND
    (
      "verificationStatus" = 'unverified' OR
      ("verificationSource" IS NOT NULL AND "verifiedAt" IS NOT NULL)
    )
  );

ALTER TABLE "route_legs"
  ADD CONSTRAINT "route_leg_order_and_measurements"
  CHECK (
    "sequence" > 0 AND
    "distanceValue" >= 0 AND "distanceUnit" = 'meter' AND
    "estimatedDrivingDurationValue" >= 0 AND "estimatedDrivingDurationUnit" = 'minute'
  );

ALTER TABLE "route_segments"
  ADD CONSTRAINT "route_segment_order_and_measurements"
  CHECK (
    "sequence" > 0 AND
    "distanceValue" >= 0 AND "distanceUnit" = 'meter' AND
    ("expectedSpeedValue" IS NULL OR ("expectedSpeedValue" >= 0 AND "expectedSpeedUnit" = 'meter-per-second'))
  );

ALTER TABLE "facility_service_profiles"
  ADD CONSTRAINT "facility_service_profile_durations"
  CHECK (
    "minimumDurationValue" >= 0 AND "minimumDurationUnit" = 'minute' AND
    "expectedDurationValue" >= "minimumDurationValue" AND "expectedDurationUnit" = 'minute' AND
    "maximumDurationValue" >= "expectedDurationValue" AND "maximumDurationUnit" = 'minute' AND
    ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
  );

ALTER TABLE "facility_service_observations"
  ADD CONSTRAINT "facility_service_observation_duration"
  CHECK ("actualDurationValue" >= 0 AND "actualDurationUnit" = 'minute');

ALTER TABLE "planned_events"
  ADD CONSTRAINT "planned_event_time_and_duration"
  CHECK ("endAt" > "startAt" AND "durationValue" >= 0 AND "durationUnit" = 'minute');

ALTER TABLE "permits"
  ADD CONSTRAINT "permit_effective_window"
  CHECK ("effectiveTo" > "effectiveFrom");

ALTER TABLE "route_restrictions"
  ADD CONSTRAINT "route_restriction_effective_window"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "regulatory_rule_sets"
  ADD CONSTRAINT "regulatory_rule_set_effective_window"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "jurisdiction_rules"
  ADD CONSTRAINT "jurisdiction_rule_effective_window"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "route_provider_responses"
  ADD CONSTRAINT "route_provider_response_retention_policy"
  CHECK (
    ("rawResponse" IS NULL OR "licenseAllowsRawStorage") AND
    (
      ("storageMode" = 'raw-json' AND "licenseAllowsRawStorage" AND "rawResponse" IS NOT NULL) OR
      ("storageMode" = 'normalized-snapshot' AND "rawResponse" IS NULL AND "normalizedSnapshot" IS NOT NULL) OR
      ("storageMode" = 'provider-reference' AND "rawResponse" IS NULL AND "providerReference" IS NOT NULL)
    )
  );

CREATE OR REPLACE FUNCTION reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and immutable', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "trip_revisions_append_only"
  BEFORE UPDATE OR DELETE ON "trip_revisions"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "trip_stops_append_only"
  BEFORE UPDATE OR DELETE ON "trip_stops"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "appointment_windows_append_only"
  BEFORE UPDATE OR DELETE ON "appointment_windows"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "calculation_assumptions_append_only"
  BEFORE UPDATE OR DELETE ON "calculation_assumptions"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "user_overrides_append_only"
  BEFORE UPDATE OR DELETE ON "user_overrides"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "calculation_results_append_only"
  BEFORE UPDATE OR DELETE ON "calculation_results"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "route_provider_responses_append_only"
  BEFORE UPDATE OR DELETE ON "route_provider_responses"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "trip_revision_rules_append_only"
  BEFORE UPDATE OR DELETE ON "trip_revision_rules"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

CREATE TRIGGER "export_history_append_only"
  BEFORE UPDATE OR DELETE ON "export_history"
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

-- Stage 10: additive stop, appointment, facility, and service-time details.
-- The Stage 03 trip_stops table already has the composite unique index required
-- by the tenant-safe relation. This migration only adds the new detail table.

CREATE TABLE "trip_stop_details" (
  "id" UUID NOT NULL,
  "carrierId" UUID NOT NULL,
  "tripStopId" UUID NOT NULL,
  "lockedPosition" BOOLEAN NOT NULL,
  "locationDescription" TEXT NOT NULL,
  "addressText" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "locationResolutionStatus" TEXT NOT NULL,
  "locationSourceName" TEXT,
  "locationProviderReference" TEXT,
  "appointmentMode" TEXT NOT NULL,
  "appointmentSnapshot" JSONB NOT NULL,
  "facilityHoursSnapshot" JSONB NOT NULL,
  "checkInDurationValue" BIGINT NOT NULL,
  "checkInDurationUnit" TEXT NOT NULL DEFAULT 'minute',
  "serviceDurationMode" TEXT NOT NULL,
  "serviceMinimumDurationValue" BIGINT,
  "serviceExpectedDurationValue" BIGINT NOT NULL,
  "serviceMaximumDurationValue" BIGINT,
  "serviceDurationUnit" TEXT NOT NULL DEFAULT 'minute',
  "historicalAverageSource" TEXT,
  "historicalAverageSampleSize" INTEGER,
  "waitingDutyStatus" TEXT NOT NULL,
  "checkInDutyStatus" TEXT NOT NULL,
  "serviceDutyStatus" TEXT NOT NULL,
  "earlyParkingAllowed" BOOLEAN NOT NULL,
  "overnightParkingAllowed" BOOLEAN NOT NULL,
  "notes" TEXT,
  "instructions" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "trip_stop_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trip_stop_details_tripStopId_key" UNIQUE ("tripStopId"),
  CONSTRAINT "trip_stop_details_tripStopId_carrierId_key" UNIQUE ("tripStopId", "carrierId"),
  CONSTRAINT "trip_stop_details_tripStopId_carrierId_fkey"
    FOREIGN KEY ("tripStopId", "carrierId")
    REFERENCES "trip_stops"("id", "carrierId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "trip_stop_details_location_resolution_status_check"
    CHECK ("locationResolutionStatus" IN ('resolved', 'user-confirmed')),
  CONSTRAINT "trip_stop_details_appointment_mode_check"
    CHECK ("appointmentMode" IN ('none', 'earliest', 'latest', 'fixed', 'window', 'open-window')),
  CONSTRAINT "trip_stop_details_service_duration_mode_check"
    CHECK ("serviceDurationMode" IN ('exact', 'expected', 'range', 'historical-average')),
  CONSTRAINT "trip_stop_details_check_in_duration_check"
    CHECK ("checkInDurationValue" >= 0 AND "checkInDurationUnit" = 'minute'),
  CONSTRAINT "trip_stop_details_service_expected_duration_check"
    CHECK ("serviceExpectedDurationValue" >= 0 AND "serviceDurationUnit" = 'minute'),
  CONSTRAINT "trip_stop_details_service_minimum_duration_check"
    CHECK ("serviceMinimumDurationValue" IS NULL OR "serviceMinimumDurationValue" >= 0),
  CONSTRAINT "trip_stop_details_service_maximum_duration_check"
    CHECK ("serviceMaximumDurationValue" IS NULL OR "serviceMaximumDurationValue" >= 0),
  CONSTRAINT "trip_stop_details_service_duration_order_check"
    CHECK (
      ("serviceMinimumDurationValue" IS NULL OR "serviceMinimumDurationValue" <= "serviceExpectedDurationValue")
      AND
      ("serviceMaximumDurationValue" IS NULL OR "serviceExpectedDurationValue" <= "serviceMaximumDurationValue")
    ),
  CONSTRAINT "trip_stop_details_historical_sample_size_check"
    CHECK ("historicalAverageSampleSize" IS NULL OR "historicalAverageSampleSize" > 0),
  CONSTRAINT "trip_stop_details_latitude_check"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  CONSTRAINT "trip_stop_details_longitude_check"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
  CONSTRAINT "trip_stop_details_waiting_duty_status_check"
    CHECK ("waitingDutyStatus" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING')),
  CONSTRAINT "trip_stop_details_check_in_duty_status_check"
    CHECK ("checkInDutyStatus" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING')),
  CONSTRAINT "trip_stop_details_service_duty_status_check"
    CHECK ("serviceDutyStatus" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING'))
);

CREATE INDEX "trip_stop_details_carrierId_appointmentMode_serviceDurationMode_idx"
  ON "trip_stop_details"("carrierId", "appointmentMode", "serviceDurationMode");

-- Stage 10: additive stop, appointment, facility, and service-time details.

CREATE UNIQUE INDEX "trip_stops_id_carrier_id_key"
  ON "trip_stops"("id", "carrier_id");

CREATE TABLE "trip_stop_details" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "carrier_id" UUID NOT NULL,
  "trip_stop_id" UUID NOT NULL,
  "locked_position" BOOLEAN NOT NULL,
  "location_description" TEXT NOT NULL,
  "address_text" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "location_resolution_status" TEXT NOT NULL,
  "location_source_name" TEXT,
  "location_provider_reference" TEXT,
  "appointment_mode" TEXT NOT NULL,
  "appointment_snapshot" JSONB NOT NULL,
  "facility_hours_snapshot" JSONB NOT NULL,
  "check_in_duration_value" BIGINT NOT NULL,
  "check_in_duration_unit" TEXT NOT NULL DEFAULT 'minute',
  "service_duration_mode" TEXT NOT NULL,
  "service_minimum_duration_value" BIGINT,
  "service_expected_duration_value" BIGINT NOT NULL,
  "service_maximum_duration_value" BIGINT,
  "service_duration_unit" TEXT NOT NULL DEFAULT 'minute',
  "historical_average_source" TEXT,
  "historical_average_sample_size" INTEGER,
  "waiting_duty_status" TEXT NOT NULL,
  "check_in_duty_status" TEXT NOT NULL,
  "service_duty_status" TEXT NOT NULL,
  "early_parking_allowed" BOOLEAN NOT NULL,
  "overnight_parking_allowed" BOOLEAN NOT NULL,
  "notes" TEXT,
  "instructions" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "trip_stop_details_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trip_stop_details_trip_stop_id_key" UNIQUE ("trip_stop_id"),
  CONSTRAINT "trip_stop_details_trip_stop_id_carrier_id_key" UNIQUE ("trip_stop_id", "carrier_id"),
  CONSTRAINT "trip_stop_details_trip_stop_id_carrier_id_fkey"
    FOREIGN KEY ("trip_stop_id", "carrier_id")
    REFERENCES "trip_stops"("id", "carrier_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "trip_stop_details_location_resolution_status_check"
    CHECK ("location_resolution_status" IN ('resolved', 'user-confirmed')),
  CONSTRAINT "trip_stop_details_appointment_mode_check"
    CHECK ("appointment_mode" IN ('none', 'earliest', 'latest', 'fixed', 'window', 'open-window')),
  CONSTRAINT "trip_stop_details_service_duration_mode_check"
    CHECK ("service_duration_mode" IN ('exact', 'expected', 'range', 'historical-average')),
  CONSTRAINT "trip_stop_details_check_in_duration_check"
    CHECK ("check_in_duration_value" >= 0 AND "check_in_duration_unit" = 'minute'),
  CONSTRAINT "trip_stop_details_service_expected_duration_check"
    CHECK ("service_expected_duration_value" >= 0 AND "service_duration_unit" = 'minute'),
  CONSTRAINT "trip_stop_details_service_minimum_duration_check"
    CHECK ("service_minimum_duration_value" IS NULL OR "service_minimum_duration_value" >= 0),
  CONSTRAINT "trip_stop_details_service_maximum_duration_check"
    CHECK ("service_maximum_duration_value" IS NULL OR "service_maximum_duration_value" >= 0),
  CONSTRAINT "trip_stop_details_service_duration_order_check"
    CHECK (
      ("service_minimum_duration_value" IS NULL OR "service_minimum_duration_value" <= "service_expected_duration_value")
      AND
      ("service_maximum_duration_value" IS NULL OR "service_expected_duration_value" <= "service_maximum_duration_value")
    ),
  CONSTRAINT "trip_stop_details_historical_sample_size_check"
    CHECK ("historical_average_sample_size" IS NULL OR "historical_average_sample_size" > 0),
  CONSTRAINT "trip_stop_details_latitude_check"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  CONSTRAINT "trip_stop_details_longitude_check"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)),
  CONSTRAINT "trip_stop_details_waiting_duty_status_check"
    CHECK ("waiting_duty_status" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING')),
  CONSTRAINT "trip_stop_details_check_in_duty_status_check"
    CHECK ("check_in_duty_status" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING')),
  CONSTRAINT "trip_stop_details_service_duty_status_check"
    CHECK ("service_duty_status" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING'))
);

CREATE INDEX "trip_stop_details_carrier_id_appointment_mode_service_duration_mode_idx"
  ON "trip_stop_details"("carrier_id", "appointment_mode", "service_duration_mode");

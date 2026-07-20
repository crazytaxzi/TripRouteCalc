CREATE TABLE "driver_hos_departure_state_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carrier_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departure_at" TIMESTAMPTZ(3) NOT NULL,
    "departure_time_zone" TEXT NOT NULL,
    "current_duty_status" TEXT NOT NULL,
    "current_duty_status_started_at" TIMESTAMPTZ(3) NOT NULL,
    "driving_remaining_minutes" BIGINT NOT NULL,
    "shift_remaining_minutes" BIGINT NOT NULL,
    "cycle_remaining_minutes" BIGINT NOT NULL,
    "cycle_type" TEXT NOT NULL,
    "state_payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,

    CONSTRAINT "driver_hos_departure_state_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_hos_departure_state_revisions_id_carrier_key" UNIQUE ("id", "carrier_id"),
    CONSTRAINT "driver_hos_departure_state_revisions_driver_fkey"
        FOREIGN KEY ("driver_id", "carrier_id")
        REFERENCES "drivers"("id", "carrierId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_hos_departure_state_revisions_actor_fkey"
        FOREIGN KEY ("carrier_id", "actor_user_id")
        REFERENCES "carrier_memberships"("carrierId", "userId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_hos_departure_state_revisions_status_check"
        CHECK ("current_duty_status" IN ('OFF_DUTY', 'SLEEPER_BERTH', 'DRIVING', 'ON_DUTY_NOT_DRIVING')),
    CONSTRAINT "driver_hos_departure_state_revisions_cycle_type_check"
        CHECK ("cycle_type" IN ('SIXTY_HOURS_SEVEN_DAYS', 'SEVENTY_HOURS_EIGHT_DAYS')),
    CONSTRAINT "driver_hos_departure_state_revisions_status_time_check"
        CHECK ("current_duty_status_started_at" <= "departure_at"),
    CONSTRAINT "driver_hos_departure_state_revisions_driving_minutes_check"
        CHECK ("driving_remaining_minutes" BETWEEN 0 AND 660),
    CONSTRAINT "driver_hos_departure_state_revisions_shift_minutes_check"
        CHECK ("shift_remaining_minutes" BETWEEN 0 AND 840),
    CONSTRAINT "driver_hos_departure_state_revisions_cycle_minutes_check"
        CHECK (
            ("cycle_type" = 'SIXTY_HOURS_SEVEN_DAYS' AND "cycle_remaining_minutes" BETWEEN 0 AND 3600)
            OR
            ("cycle_type" = 'SEVENTY_HOURS_EIGHT_DAYS' AND "cycle_remaining_minutes" BETWEEN 0 AND 4200)
        ),
    CONSTRAINT "driver_hos_departure_state_revisions_payload_check"
        CHECK (jsonb_typeof("state_payload") = 'object'),
    CONSTRAINT "driver_hos_departure_state_revisions_hash_check"
        CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "driver_hos_departure_state_revisions_carrier_driver_departure_idx"
    ON "driver_hos_departure_state_revisions"("carrier_id", "driver_id", "departure_at" DESC);

CREATE TABLE "driver_hos_duty_event_history_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carrier_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "state_revision_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "history_start_at" TIMESTAMPTZ(3) NOT NULL,
    "history_end_at" TIMESTAMPTZ(3) NOT NULL,
    "event_count" INTEGER NOT NULL,
    "event_payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,

    CONSTRAINT "driver_hos_duty_event_history_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "driver_hos_duty_event_history_revisions_state_key" UNIQUE ("state_revision_id"),
    CONSTRAINT "driver_hos_duty_event_history_revisions_driver_fkey"
        FOREIGN KEY ("driver_id", "carrier_id")
        REFERENCES "drivers"("id", "carrierId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_hos_duty_event_history_revisions_state_fkey"
        FOREIGN KEY ("state_revision_id", "carrier_id")
        REFERENCES "driver_hos_departure_state_revisions"("id", "carrier_id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_hos_duty_event_history_revisions_actor_fkey"
        FOREIGN KEY ("carrier_id", "actor_user_id")
        REFERENCES "carrier_memberships"("carrierId", "userId")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_hos_duty_event_history_revisions_time_check"
        CHECK ("history_start_at" < "history_end_at"),
    CONSTRAINT "driver_hos_duty_event_history_revisions_count_check"
        CHECK ("event_count" > 0),
    CONSTRAINT "driver_hos_duty_event_history_revisions_payload_check"
        CHECK (
            jsonb_typeof("event_payload") = 'array'
            AND jsonb_array_length("event_payload") = "event_count"
        ),
    CONSTRAINT "driver_hos_duty_event_history_revisions_hash_check"
        CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "driver_hos_duty_event_history_revisions_carrier_driver_start_idx"
    ON "driver_hos_duty_event_history_revisions"("carrier_id", "driver_id", "history_start_at" DESC);

CREATE OR REPLACE FUNCTION "prevent_driver_hos_revision_mutation"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Driver HOS revision evidence is append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "driver_hos_departure_state_revisions_append_only"
BEFORE UPDATE OR DELETE ON "driver_hos_departure_state_revisions"
FOR EACH ROW EXECUTE FUNCTION "prevent_driver_hos_revision_mutation"();

CREATE TRIGGER "driver_hos_duty_event_history_revisions_append_only"
BEFORE UPDATE OR DELETE ON "driver_hos_duty_event_history_revisions"
FOR EACH ROW EXECUTE FUNCTION "prevent_driver_hos_revision_mutation"();

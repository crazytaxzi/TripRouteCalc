CREATE TABLE "api_idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "carrier_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER,
  "response_snapshot" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "api_idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_idempotency_records_carrier_id_fkey"
    FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "api_idempotency_records_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "api_idempotency_records_response_pair_check"
    CHECK (
      ("response_status" IS NULL AND "response_snapshot" IS NULL)
      OR
      ("response_status" IS NOT NULL AND "response_snapshot" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "api_idempotency_records_scope_key"
  ON "api_idempotency_records"(
    "carrier_id",
    "actor_user_id",
    "operation",
    "key_hash"
  );

CREATE INDEX "api_idempotency_records_expiry"
  ON "api_idempotency_records"("expires_at");

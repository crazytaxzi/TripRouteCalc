import { createHash } from 'node:crypto';

import type { PersistenceClient } from './client.js';
import { IdempotencyConflictError, TenantObjectNotFoundError } from './errors.js';
import { hashJson, toJsonObject } from './json.js';
import type { JsonObject } from './json.js';
import type { TenantContext } from './tenant.js';
import { assertTenantMembership } from './tenant.js';

export interface BeginIdempotencyInput {
  readonly operation: string;
  readonly key: string;
  readonly request: unknown;
  readonly ttlSeconds?: number;
}

export type IdempotencyBeginResult =
  | Readonly<{
      status: 'started';
      recordId: string;
      requestHash: string;
    }>
  | Readonly<{
      status: 'replay';
      recordId: string;
      requestHash: string;
      responseStatus: number;
      response: JsonObject;
    }>;

interface IdempotencyRecordRow {
  readonly id: string;
  readonly requestHash: string;
  readonly responseStatus: number | null;
  readonly responseSnapshot: unknown;
}

function boundedText(
  value: string,
  label: string,
  minimumLength: number,
  maximumLength: number,
): string {
  const normalized = value.trim();
  if (
    normalized.length < minimumLength ||
    normalized.length > maximumLength
  ) {
    throw new RangeError(
      `${label} must contain between ${String(minimumLength)} and ${String(maximumLength)} characters.`,
    );
  }
  return normalized;
}

function positiveTtlSeconds(value: number | undefined): number {
  const ttlSeconds = value ?? 86_400;
  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 60 ||
    ttlSeconds > 604_800
  ) {
    throw new RangeError(
      'Idempotency retention must be between 60 and 604800 seconds.',
    );
  }
  return ttlSeconds;
}

function keyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class ApiIdempotencyRepository {
  public constructor(
    private readonly client: PersistenceClient,
    private readonly context: TenantContext,
  ) {}

  public async begin(
    input: BeginIdempotencyInput,
  ): Promise<IdempotencyBeginResult> {
    await assertTenantMembership(this.client, this.context);
    const operation = boundedText(input.operation, 'Idempotency operation', 1, 128);
    const key = boundedText(input.key, 'Idempotency key', 8, 256);
    const requestHash = hashJson(input.request);
    const hashedKey = keyHash(key);
    const ttlSeconds = positiveTtlSeconds(input.ttlSeconds);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000);

    return this.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        DELETE FROM api_idempotency_records
        WHERE expires_at <= ${now}
      `;

      const inserted = await transaction.$queryRaw<
        readonly { readonly id: string }[]
      >`
        INSERT INTO api_idempotency_records (
          carrier_id,
          actor_user_id,
          operation,
          key_hash,
          request_hash,
          expires_at
        ) VALUES (
          ${this.context.carrierId}::uuid,
          ${this.context.actorUserId}::uuid,
          ${operation},
          ${hashedKey},
          ${requestHash},
          ${expiresAt}
        )
        ON CONFLICT (
          carrier_id,
          actor_user_id,
          operation,
          key_hash
        ) DO NOTHING
        RETURNING id
      `;
      const created = inserted[0];
      if (created !== undefined) {
        return Object.freeze({
          status: 'started' as const,
          recordId: created.id,
          requestHash,
        });
      }

      const existingRows = await transaction.$queryRaw<
        readonly IdempotencyRecordRow[]
      >`
        SELECT
          id,
          request_hash AS "requestHash",
          response_status AS "responseStatus",
          response_snapshot AS "responseSnapshot"
        FROM api_idempotency_records
        WHERE carrier_id = ${this.context.carrierId}::uuid
          AND actor_user_id = ${this.context.actorUserId}::uuid
          AND operation = ${operation}
          AND key_hash = ${hashedKey}
        LIMIT 1
      `;
      const existing = existingRows[0];
      if (existing === undefined) {
        throw new Error(
          'Idempotency record disappeared while the operation was being claimed.',
        );
      }
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictError(
          'The idempotency key was already used with a different request.',
          'REQUEST_MISMATCH',
        );
      }
      if (
        existing.responseStatus === null ||
        existing.responseSnapshot === null
      ) {
        throw new IdempotencyConflictError(
          'An equivalent idempotent operation is already in progress.',
          'IN_PROGRESS',
        );
      }
      return Object.freeze({
        status: 'replay' as const,
        recordId: existing.id,
        requestHash,
        responseStatus: existing.responseStatus,
        response: toJsonObject(
          existing.responseSnapshot,
          'idempotency.responseSnapshot',
        ),
      });
    });
  }

  public async complete(
    recordId: string,
    responseStatus: number,
    response: unknown,
  ): Promise<void> {
    await assertTenantMembership(this.client, this.context);
    if (
      !Number.isSafeInteger(responseStatus) ||
      responseStatus < 100 ||
      responseStatus > 599
    ) {
      throw new RangeError('Idempotency response status must be between 100 and 599.');
    }
    const responseSnapshot = JSON.stringify(
      toJsonObject(response, 'idempotency.response'),
    );
    const updated = await this.client.$queryRaw<readonly { readonly id: string }[]>`
      UPDATE api_idempotency_records
      SET
        response_status = ${responseStatus},
        response_snapshot = ${responseSnapshot}::jsonb
      WHERE id = ${recordId}::uuid
        AND carrier_id = ${this.context.carrierId}::uuid
        AND actor_user_id = ${this.context.actorUserId}::uuid
        AND response_status IS NULL
      RETURNING id
    `;
    if (updated[0] === undefined) {
      throw new TenantObjectNotFoundError(
        'The idempotency record was not found or was already completed.',
      );
    }
  }

  public async abandon(recordId: string): Promise<void> {
    await assertTenantMembership(this.client, this.context);
    await this.client.$executeRaw`
      DELETE FROM api_idempotency_records
      WHERE id = ${recordId}::uuid
        AND carrier_id = ${this.context.carrierId}::uuid
        AND actor_user_id = ${this.context.actorUserId}::uuid
        AND response_status IS NULL
    `;
  }
}

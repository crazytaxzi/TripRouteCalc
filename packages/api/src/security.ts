import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { z } from 'zod';

import { ApiAuthenticationError, ApiValidationError } from './errors.js';

export const PUBLIC_ID_TYPES = [
  'trip',
  'stop',
  'revision',
  'driver',
  'hos-state',
  'tractor',
  'trailer',
  'load',
  'rule-set',
] as const;
export type PublicIdType = (typeof PUBLIC_ID_TYPES)[number];

const publicIdPrefix: Readonly<Record<PublicIdType, string>> = Object.freeze({
  trip: 'trp',
  stop: 'stp',
  revision: 'rev',
  driver: 'drv',
  'hos-state': 'hos',
  tractor: 'ctr',
  trailer: 'trl',
  load: 'lod',
  'rule-set': 'rul',
});

const uuidSchema = z.string().uuid();
const publicIdPayloadSchema = z
  .object({
    version: z.literal(1),
    type: z.enum(PUBLIC_ID_TYPES),
    internalId: uuidSchema,
  })
  .strict();

const bearerClaimsSchema = z
  .object({
    version: z.literal(1),
    carrierId: uuidSchema,
    actorUserId: uuidSchema,
    tokenId: z.string().trim().min(8).max(128),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type BearerClaims = z.infer<typeof bearerClaimsSchema>;

export interface AuthenticatedPrincipal {
  readonly carrierId: string;
  readonly actorUserId: string;
  readonly tokenId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export interface BearerAuthenticator {
  authenticate(
    authorizationHeader: string | undefined,
    nowEpochSeconds?: number,
  ): AuthenticatedPrincipal;
}

function base64UrlEncode(value: Buffer): string {
  return value.toString('base64url');
}

function base64UrlDecode(value: string, label: string): Buffer {
  try {
    return Buffer.from(value, 'base64url');
  } catch (error) {
    throw new ApiValidationError(`${label} is not valid base64url data.`, {}, {
      cause: error,
    });
  }
}

function validatedSecret(secret: string, label: string): Buffer {
  if (secret.length < 32) {
    throw new ApiValidationError(
      `${label} must contain at least 32 characters of server-only entropy.`,
    );
  }
  return Buffer.from(secret, 'utf8');
}

function derivedKey(secret: Buffer, label: string): Buffer {
  return createHash('sha256')
    .update('trip-route-calc:')
    .update(label)
    .update(':')
    .update(secret)
    .digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

const PUBLIC_ID_AAD = Buffer.from('trip-route-calc-public-id-v1', 'utf8');

export class PublicIdCodec {
  readonly #encryptionKey: Buffer;
  readonly #ivKey: Buffer;

  public constructor(secret: string) {
    const value = validatedSecret(secret, 'Public identifier secret');
    this.#encryptionKey = derivedKey(value, 'public-id-encryption');
    this.#ivKey = derivedKey(value, 'public-id-iv');
  }

  public encode(type: PublicIdType, internalIdRaw: string): string {
    const internalId = uuidSchema.parse(internalIdRaw);
    const payload = Buffer.from(
      JSON.stringify({ version: 1, type, internalId }),
      'utf8',
    );
    const iv = createHmac('sha256', this.#ivKey)
      .update(type)
      .update(':')
      .update(internalId)
      .digest()
      .subarray(0, 12);
    const cipher = createCipheriv('aes-256-gcm', this.#encryptionKey, iv);
    cipher.setAAD(PUBLIC_ID_AAD);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    return `${publicIdPrefix[type]}.${base64UrlEncode(
      Buffer.concat([iv, ciphertext, authenticationTag]),
    )}`;
  }

  public decode(value: string, expectedType: PublicIdType): string {
    const [prefix, encoded, extra] = value.split('.');
    if (
      prefix !== publicIdPrefix[expectedType] ||
      encoded === undefined ||
      extra !== undefined
    ) {
      throw new ApiValidationError(
        `Identifier must be a valid ${expectedType} public identifier.`,
      );
    }
    const packed = base64UrlDecode(encoded, 'Public identifier');
    if (packed.length <= 28) {
      throw new ApiValidationError('Public identifier payload is truncated.');
    }
    const iv = packed.subarray(0, 12);
    const authenticationTag = packed.subarray(packed.length - 16);
    const ciphertext = packed.subarray(12, packed.length - 16);
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.#encryptionKey,
        iv,
      );
      decipher.setAAD(PUBLIC_ID_AAD);
      decipher.setAuthTag(authenticationTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
      const payload = publicIdPayloadSchema.parse(JSON.parse(plaintext));
      if (payload.type !== expectedType) {
        throw new ApiValidationError(
          `Identifier is not valid for entity type ${expectedType}.`,
        );
      }
      return payload.internalId;
    } catch (error) {
      if (error instanceof ApiValidationError) throw error;
      throw new ApiValidationError(
        `Identifier must be a valid ${expectedType} public identifier.`,
        {},
        { cause: error },
      );
    }
  }
}

export class HmacBearerAuthenticator implements BearerAuthenticator {
  readonly #signingKey: Buffer;

  public constructor(secret: string) {
    this.#signingKey = derivedKey(
      validatedSecret(secret, 'Bearer-token secret'),
      'bearer-token-signing',
    );
  }

  public issue(claimsInput: BearerClaims): string {
    const claims = bearerClaimsSchema.parse(claimsInput);
    if (claims.expiresAt <= claims.issuedAt) {
      throw new ApiValidationError(
        'Bearer-token expiration must be after its issue time.',
      );
    }
    const payload = base64UrlEncode(
      Buffer.from(JSON.stringify(claims), 'utf8'),
    );
    const signature = createHmac('sha256', this.#signingKey)
      .update(payload)
      .digest();
    return `${payload}.${base64UrlEncode(signature)}`;
  }

  public authenticate(
    authorizationHeader: string | undefined,
    nowEpochSeconds = Math.floor(Date.now() / 1000),
  ): AuthenticatedPrincipal {
    if (authorizationHeader === undefined) {
      throw new ApiAuthenticationError(
        'AUTHENTICATION_REQUIRED',
        'A bearer token is required.',
      );
    }
    const match = /^Bearer\s+(.+)$/iu.exec(authorizationHeader.trim());
    if (match === null) {
      throw new ApiAuthenticationError(
        'AUTHENTICATION_INVALID',
        'Authorization must use the Bearer scheme.',
      );
    }
    const token = match[1];
    if (token === undefined) {
      throw new ApiAuthenticationError(
        'AUTHENTICATION_INVALID',
        'Bearer token is missing.',
      );
    }
    const [payload, encodedSignature, extra] = token.split('.');
    if (
      payload === undefined ||
      encodedSignature === undefined ||
      extra !== undefined
    ) {
      throw new ApiAuthenticationError(
        'AUTHENTICATION_INVALID',
        'Bearer token has an invalid structure.',
      );
    }
    const expectedSignature = createHmac('sha256', this.#signingKey)
      .update(payload)
      .digest();
    const suppliedSignature = base64UrlDecode(
      encodedSignature,
      'Bearer signature',
    );
    if (!safeEqual(expectedSignature, suppliedSignature)) {
      throw new ApiAuthenticationError(
        'AUTHENTICATION_INVALID',
        'Bearer token signature is invalid.',
      );
    }
    try {
      const claims = bearerClaimsSchema.parse(
        JSON.parse(base64UrlDecode(payload, 'Bearer payload').toString('utf8')),
      );
      if (claims.expiresAt <= nowEpochSeconds) {
        throw new ApiAuthenticationError(
          'AUTHENTICATION_INVALID',
          'Bearer token has expired.',
        );
      }
      if (claims.issuedAt > nowEpochSeconds + 300) {
        throw new ApiAuthenticationError(
          'AUTHENTICATION_INVALID',
          'Bearer token issue time is in the future.',
        );
      }
      return Object.freeze({
        carrierId: claims.carrierId,
        actorUserId: claims.actorUserId,
        tokenId: claims.tokenId,
        issuedAt: claims.issuedAt,
        expiresAt: claims.expiresAt,
      });
    } catch (error) {
      if (error instanceof ApiAuthenticationError) throw error;
      throw new ApiAuthenticationError(
        'AUTHENTICATION_INVALID',
        'Bearer token payload is invalid.',
        {},
        { cause: error },
      );
    }
  }
}

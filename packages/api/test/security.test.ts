import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ApiAuthenticationError,
  ApiValidationError,
  HmacBearerAuthenticator,
  PublicIdCodec,
} from '../src/index.js';

const secret = 'stage-17-test-secret-with-more-than-thirty-two-characters';

describe('PublicIdCodec', () => {
  it('returns a stable opaque identifier and decodes only the expected type', () => {
    const codec = new PublicIdCodec(secret);
    const internalId = randomUUID();

    const first = codec.encode('trip', internalId);
    const second = codec.encode('trip', internalId);

    expect(first).toBe(second);
    expect(first).not.toContain(internalId);
    expect(codec.decode(first, 'trip')).toBe(internalId);
    expect(() => codec.decode(first, 'stop')).toThrow(ApiValidationError);
  });

  it('rejects tampered identifiers before repository access', () => {
    const codec = new PublicIdCodec(secret);
    const encoded = codec.encode('revision', randomUUID());
    const finalCharacter = encoded.at(-1);
    expect(finalCharacter).toBeDefined();
    const tampered = `${encoded.slice(0, -1)}${finalCharacter === 'A' ? 'B' : 'A'}`;

    expect(() => codec.decode(tampered, 'revision')).toThrow(
      ApiValidationError,
    );
  });
});

describe('HmacBearerAuthenticator', () => {
  it('issues and verifies tenant-aware bearer credentials', () => {
    const authenticator = new HmacBearerAuthenticator(secret);
    const token = authenticator.issue({
      version: 1,
      carrierId: randomUUID(),
      actorUserId: randomUUID(),
      tokenId: 'token-stage-17',
      issuedAt: 1_000,
      expiresAt: 2_000,
    });

    const principal = authenticator.authenticate(`Bearer ${token}`, 1_500);

    expect(principal.tokenId).toBe('token-stage-17');
    expect(principal.expiresAt).toBe(2_000);
  });

  it('rejects missing, expired, future, and tampered credentials', () => {
    const authenticator = new HmacBearerAuthenticator(secret);
    const claims = {
      version: 1 as const,
      carrierId: randomUUID(),
      actorUserId: randomUUID(),
      tokenId: 'token-stage-17',
      issuedAt: 1_000,
      expiresAt: 2_000,
    };
    const token = authenticator.issue(claims);

    expect(() => authenticator.authenticate(undefined, 1_500)).toThrow(
      ApiAuthenticationError,
    );
    expect(() => authenticator.authenticate(`Bearer ${token}`, 2_000)).toThrow(
      ApiAuthenticationError,
    );
    expect(() =>
      authenticator.authenticate(
        `Bearer ${authenticator.issue({ ...claims, issuedAt: 2_000, expiresAt: 3_000 })}`,
        1_000,
      ),
    ).toThrow(ApiAuthenticationError);
    expect(() =>
      authenticator.authenticate(`Bearer ${token.slice(0, -1)}A`, 1_500),
    ).toThrow(ApiAuthenticationError);
  });
});

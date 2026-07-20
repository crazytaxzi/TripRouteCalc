import { PrismaPg } from '@prisma/adapter-pg';

import { PersistenceConfigurationError } from './errors.js';
import { PrismaClient } from './generated/prisma/client.js';

export type PersistenceClient = PrismaClient;

export function databaseUrlFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    throw new PersistenceConfigurationError('DATABASE_URL is required.');
  }

  if (
    !databaseUrl.startsWith('postgresql://') &&
    !databaseUrl.startsWith('postgres://')
  ) {
    throw new PersistenceConfigurationError(
      'DATABASE_URL must use the postgresql:// or postgres:// scheme.',
    );
  }

  return databaseUrl;
}

export function createPersistenceClient(databaseUrl: string): PersistenceClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function createPersistenceClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PersistenceClient {
  return createPersistenceClient(databaseUrlFromEnvironment(environment));
}

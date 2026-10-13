import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Singleton postgres client and drizzle database instances
 */
const globalForDb = globalThis as unknown as {
  pgClient?: postgres.Sql;
  db?: PostgresJsDatabase<typeof schema>;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Allow builds or initialization steps if DATABASE_URL is not set at build time,
  // but warn in development/production if accessed.
  if (process.env.NODE_ENV !== 'production') {
    console.warn('DATABASE_URL environment variable is not defined.');
  }
}

/**
 * Postgres client configured with pooling and timeouts.
 */
export const pgClient: postgres.Sql =
  globalForDb.pgClient ??
  postgres(connectionString || 'postgres://localhost:5432/postgres', {
    max: process.env.DB_MAX_CONNECTIONS ? Number(process.env.DB_MAX_CONNECTIONS) : 10,
    idle_timeout: 30, // Closes idle connections after 30 seconds
    connect_timeout: 10, // Timeout connection establishment after 10 seconds
  });

/**
 * Drizzle ORM instance initialized with all application schemas and relations.
 */
export const db: PostgresJsDatabase<typeof schema> =
  globalForDb.db ?? drizzle(pgClient, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = pgClient;
  globalForDb.db = db;
}

/**
 * Gracefully close postgres pool connections.
 */
export async function closeDb(): Promise<void> {
  if (globalForDb.pgClient) {
    await globalForDb.pgClient.end({ timeout: 5 });
    globalForDb.pgClient = undefined;
    globalForDb.db = undefined;
  } else {
    await pgClient.end({ timeout: 5 });
  }
}

export type Database = PostgresJsDatabase<typeof schema>;
export type DbOrTx =
  | Database
  | Parameters<Parameters<Database['transaction']>[0]>[0];

export { schema };

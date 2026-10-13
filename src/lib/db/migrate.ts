import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Migration runner script
 * Executes Drizzle database migrations from the database/migrations directory.
 */
export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Migration error: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  console.log('Connecting to database for migrations...');
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    const migrationsFolder = path.resolve(process.cwd(), 'database/migrations');
    console.log(`Running migrations from: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('Migrations applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
    console.log('Migration database connection closed.');
  }
}

// Automatically execute when run as script
void runMigrations();

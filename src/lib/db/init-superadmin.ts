import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ulid } from 'ulid';
import * as schema from './schema';

/**
 * Production Super Admin Initializer
 * Creates the primary platform super administrator account with zero demo/dummy data.
 *
 * Usage:
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD="your-strong-password" ADMIN_NAME="Company Super Admin" pnpm tsx src/lib/db/init-superadmin.ts
 */
export async function initSuperAdmin(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || '';
  const name = process.env.ADMIN_NAME || process.argv[4] || 'Platform Super Admin';

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    console.log('Usage:');
    console.log('  npx tsx src/lib/db/init-superadmin.ts <email> <password> [name]');
    console.log('  OR via environment variables:');
    console.log('  ADMIN_EMAIL=you@company.com ADMIN_PASSWORD="StrongPassword123!" npx tsx src/lib/db/init-superadmin.ts');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  console.log(`Connecting to database at ${databaseUrl.split('@')[1] || 'PostgreSQL'}...`);
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    const passwordHash = bcrypt.hashSync(password, 10);

    if (existing) {
      console.log(`User '${email}' already exists. Updating password and ensuring active status...`);
      await db
        .update(schema.users)
        .set({
          passwordHash,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existing.id));

      console.log(`Super Admin user '${email}' updated successfully!`);
    } else {
      const adminId = ulid();
      await db.insert(schema.users).values({
        id: adminId,
        email,
        name,
        passwordHash,
        status: 'active',
      });

      console.log(`Super Admin user '${email}' created successfully (ID: ${adminId})!`);
    }

    console.log('\nProduction Database is ready with 0 demo data.');
    console.log('You can now log in at your production domain: /login');
  } catch (error) {
    console.error('Failed to initialize Super Admin:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void initSuperAdmin();

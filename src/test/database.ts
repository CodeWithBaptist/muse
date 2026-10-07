import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/db/schema';

/**
 * A real Postgres engine for tests, running in process.
 *
 * PostgreSQL cannot be installed in every environment, and until this existed
 * the schema had never been executed by a real engine. The queries were checked
 * by TypeScript and the surrounding logic by mocked unit tests, which is how a
 * timestamp ordering assumption survived review: nothing ever ran the SQL.
 *
 * PGlite is Postgres compiled to WebAssembly, so migrations, foreign keys,
 * cascade rules, transactions, and index behaviour are the real thing rather
 * than an approximation. It is a development dependency only. Production still
 * runs against the PostgreSQL server configured through DATABASE_URL.
 *
 * Tests use this to verify what the database actually does, not what the
 * application code believes it does.
 */

export type TestDatabase = PgliteDatabase<typeof schema>;

export interface TestDatabaseHandle {
  db: TestDatabase;
  /** Raw access, for assertions the query builder cannot express. */
  client: PGlite;
  close: () => Promise<void>;
}

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url)
);

/** Creates an empty in-memory database with the committed migrations applied. */
export async function createTestDatabase(): Promise<TestDatabaseHandle> {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    client,
    close: () => client.close(),
  };
}

/** Inserts a user and returns it, with optional overrides. */
export async function seedUser(
  db: TestDatabase,
  overrides: Partial<typeof schema.users.$inferInsert> = {}
) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const [user] = await db
    .insert(schema.users)
    .values({
      spotifyId: `spotify-${suffix}`,
      displayName: 'Test Listener',
      email: `listener-${suffix}@example.com`,
      ...overrides,
    })
    .returning();

  return user;
}

/** Lists every table the migration created in the public schema. */
export async function listTables(client: PGlite): Promise<string[]> {
  const result = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  return result.rows.map((row) => row.tablename);
}

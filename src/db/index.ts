import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createServerlessPool(url?: string): Pool {
  const poolInstance = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

  if (!url) {
    const rejectUnconfigured = () =>
      Promise.reject(new Error("DATABASE_URL is not configured"));
    poolInstance.query = rejectUnconfigured as unknown as typeof poolInstance.query;
    poolInstance.connect = rejectUnconfigured as unknown as typeof poolInstance.connect;
  }

  return poolInstance;
}

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ?? createServerlessPool(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

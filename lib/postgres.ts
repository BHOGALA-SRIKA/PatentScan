import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const globalForPostgres = globalThis as unknown as {
  postgresPool?: Pool;
};

export const pool =
  globalForPostgres.postgresPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgresPool = pool;
}
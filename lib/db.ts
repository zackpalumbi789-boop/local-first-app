import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse a single pool in dev to avoid creating many connections.
const globalForPool = globalThis as unknown as { __pool?: Pool };

const pool =
  globalForPool.__pool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 5 * 60 * 1000,
    connectionTimeoutMillis: 10 * 1000,
    keepAlive: true,
  });

if (!globalForPool.__pool) {
  globalForPool.__pool = pool;
}

export const db = drizzle(pool, { schema });


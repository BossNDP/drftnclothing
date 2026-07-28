import { Pool as NeonPool, neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeonPool } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNeonHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in the environment variables');
}

const databaseUrl = process.env.DATABASE_URL;
const isNeon = databaseUrl.includes('neon.tech');

// Connect using Neon Serverless WebSocket pool driver to support database transactions,
// otherwise fall back to standard PostgreSQL Pool
export const db = isNeon
  ? drizzleNeonPool(new NeonPool({ connectionString: databaseUrl }), { schema })
  : (drizzlePg(new PgPool({ connectionString: databaseUrl }), { schema }) as any);

// Stateless HTTP driver for single-query serverless reads (zero WebSocket handshake cold-start)
export const dbHttp = isNeon
  ? drizzleNeonHttp(neon(databaseUrl), { schema })
  : db;

export type DbClient = typeof db;

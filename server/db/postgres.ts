import pg from 'pg';

const { Pool } = pg;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const connectionString = process.env.DATABASE_URL;

export const pool = connectionString
  ? new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX || 20), min: Number(process.env.DB_POOL_MIN || 2), idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000), connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000), ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  : new Pool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432), database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD'), max: Number(process.env.DB_POOL_MAX || 20), min: Number(process.env.DB_POOL_MIN || 2), idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000), connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000), ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined });

export async function query<T = any>(text: string, params: unknown[] = []) { return pool.query<T>(text, params); }

export async function withSecurityContext<T>(organizationId: string | null, isGlobalAdmin: boolean, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!organizationId && !isGlobalAdmin) throw new Error('organizationId is required for tenant context');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId || '']);
    await client.query(`SELECT set_config('app.is_global_admin', $1, true)`, [isGlobalAdmin ? 'true' : 'false']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function withTenant<T>(organizationId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> { return withSecurityContext(organizationId, false, fn); }

export async function healthCheck(): Promise<boolean> {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

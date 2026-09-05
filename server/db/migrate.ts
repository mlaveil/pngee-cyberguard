import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

const migrationUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');

const pool = new Pool({ connectionString: migrationUrl });

async function main() {
  const migrationsDir = path.join(process.cwd(), 'server', 'db', 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();

  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  for (const file of files) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
    if (exists.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

main().catch(error => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());

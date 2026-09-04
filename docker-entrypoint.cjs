const fs = require('fs');
const path = require('path');
const pg = require('pg');

async function main() {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: migrationUrl });
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const migrationDir = path.join('/app/server/db/migrations');
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (exists.rowCount) continue;
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[DB] Applied migration ${file}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
  } finally { await pool.end(); }
}

main().then(() => {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['dist/server.cjs'], { stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 1));
}).catch(error => { console.error('[DB] Migration failed', error); process.exit(1); });

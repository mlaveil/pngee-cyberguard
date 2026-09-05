import 'dotenv/config';
import { query, withSecurityContext, pool } from './postgres';
import { hashPassword } from '../services/authService';

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'PNGee Administrator';
  const organizationId = process.env.BOOTSTRAP_ORGANIZATION_ID || 'org-pngee-global';
  if (!email || !password) throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('Bootstrap password must be at least 12 characters');

  await query(`INSERT INTO organizations (id, name, slug, domain, contact_email, plan, status, max_assets) VALUES ($1, $2, $3, $4, $5, 'PNGEE_ENTERPRISE', 'ACTIVE', 10000) ON CONFLICT (id) DO NOTHING`, [organizationId, 'PNGee CyberGuard Global', 'pngee-global', email.split('@')[1] || '', email]);
  const passwordHash = await hashPassword(password);
  await withSecurityContext(null, true, client => client.query(`INSERT INTO users (id, organization_id, email, name, password_hash, role, status, mfa_enabled) VALUES ($1, $2, $3, $4, $5, 'PNGEE_SUPER_ADMIN', 'ACTIVE', true) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, status = 'ACTIVE', mfa_enabled = true`, [`usr-pngee-admin-${Date.now().toString(36)}`, organizationId, email, name, passwordHash]));
  console.log(`Bootstrap administrator ready: ${email}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());

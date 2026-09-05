import crypto from 'crypto';
import { pool, query, withSecurityContext } from './postgres';
import { issueAccessToken, issueMfaChallenge, verifyAccessToken, verifyMfaChallenge } from '../services/authService';

const TENANT_TABLES = [
  'users',
  'assets',
  'endpoint_identities',
  'enrollment_tokens',
  'security_events',
  'alerts',
  'incidents',
  'audit_logs',
  'detection_rules',
];

async function expectRejected(label: string, fn: () => Promise<unknown>) {
  let rejected = false;
  try { await fn(); } catch { rejected = true; }
  if (!rejected) throw new Error(`${label}: expected rejection`);
}

async function main() {
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const assetA = crypto.randomUUID();
  const assetB = crypto.randomUUID();
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const canaryA = `ISOLATION-CANARY-A-${crypto.randomBytes(12).toString('hex')}`;
  const canaryB = `ISOLATION-CANARY-B-${crypto.randomBytes(12).toString('hex')}`;

  try {
    // Schema-level controls: every tenant-owned table must have RLS and FORCE RLS.
    const inventory = await query<{ tablename: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relname AS tablename, c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1::text[])`, [TENANT_TABLES]);
    if (inventory.rows.length !== TENANT_TABLES.length) throw new Error('Tenant RLS inventory is incomplete');
    for (const row of inventory.rows) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) throw new Error(`RLS/FORCE RLS missing on ${row.tablename}`);
    }

    // Provision two tenants with unique canaries, then exercise the same transaction-scoped context used by the app.
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id,name,slug) VALUES ($1,'Adversarial A',$2),($3,'Adversarial B',$4)`, [orgA, `adv-a-${orgA.slice(0,8)}`, orgB, `adv-b-${orgB.slice(0,8)}`]);
      await client.query(`INSERT INTO users (id,organization_id,email,name,password_hash,role,status) VALUES ($1,$2,$3,'Adversarial A','not-a-real-password-hash','CUSTOMER_ADMIN','ACTIVE'),($4,$5,$6,'Adversarial B','not-a-real-password-hash','CUSTOMER_ADMIN','ACTIVE')`, [userA, orgA, `${userA}@invalid`, userB, orgB, `${userB}@invalid`]);
      await client.query(`INSERT INTO assets (id,organization_id,hostname,asset_type,payload) VALUES ($1,$2,'ADV-A','Server',$3),($4,$5,'ADV-B','Server',$6)`, [assetA, orgA, JSON.stringify({ canary: canaryA }), assetB, orgB, JSON.stringify({ canary: canaryB })]);
      await client.query(`INSERT INTO security_events (id,organization_id,event_category,event_description,severity) VALUES ($1,$2,'adversarial',$3,'HIGH'),($4,$5,'adversarial',$6,'HIGH')`, [crypto.randomUUID(), orgA, canaryA, crypto.randomUUID(), orgB, canaryB]);
    });

    // Horizontal isolation: reads and writes must not cross tenant boundaries.
    const aRead = await withSecurityContext(orgA, false, client => client.query(`SELECT id, payload FROM assets WHERE id IN ($1,$2)`, [assetA, assetB]));
    if (aRead.rows.length !== 1 || aRead.rows[0].id !== assetA || JSON.stringify(aRead.rows[0].payload).includes(canaryB)) throw new Error('Cross-tenant read isolation failed for tenant A');
    const bRead = await withSecurityContext(orgB, false, client => client.query(`SELECT id, payload FROM assets WHERE id IN ($1,$2)`, [assetA, assetB]));
    if (bRead.rows.length !== 1 || bRead.rows[0].id !== assetB || JSON.stringify(bRead.rows[0].payload).includes(canaryA)) throw new Error('Cross-tenant read isolation failed for tenant B');

    await expectRejected('Cross-tenant insert', () => withSecurityContext(orgA, false, client => client.query(
      `INSERT INTO assets (id,organization_id,hostname,asset_type) VALUES ($1,$2,'ADV-CROSS','Server')`, [crypto.randomUUID(), orgB])));
    await expectRejected('Cross-tenant update', () => withSecurityContext(orgA, false, client => client.query(
      `UPDATE assets SET hostname='ADV-HIJACK' WHERE id=$1`, [assetB])));
    await expectRejected('Cross-tenant delete', () => withSecurityContext(orgA, false, client => client.query(
      `DELETE FROM assets WHERE id=$1`, [assetB]));

    // Transaction-local context must not bleed across pooled connections.
    const afterA = await withSecurityContext(orgA, false, client => client.query(`SELECT current_setting('app.current_organization_id', true) AS org`));
    if (afterA.rows[0].org !== orgA) throw new Error('Tenant context was not established');
    const afterContext = await query<{ org: string }>(`SELECT current_setting('app.current_organization_id', true) AS org`);
    if (afterContext.rows[0].org) throw new Error('Tenant context leaked outside transaction');

    // JWT tamper and token-confusion resistance.
    const access = await issueAccessToken({ sub: userA, role: 'CUSTOMER_ADMIN', organizationId: orgA });
    await verifyAccessToken(access);
    const parts = access.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${Buffer.from(parts[2]).toString('base64url')}`;
    await expectRejected('Tampered access token', () => verifyAccessToken(tampered));
    const noneAlg = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${parts[1]}.`;
    await expectRejected('Unsecured JWT algorithm', () => verifyAccessToken(noneAlg));

    const mfa = await issueMfaChallenge(userA);
    const verifiedMfaUser = await verifyMfaChallenge(mfa);
    if (verifiedMfaUser !== userA) throw new Error('MFA challenge subject validation failed');
    const mfaParts = mfa.split('.');
    const tamperedMfa = `${mfaParts[0]}.${mfaParts[1]}.${Buffer.from(mfaParts[2]).toString('base64url')}`;
    await expectRejected('Tampered MFA challenge', () => verifyMfaChallenge(tamperedMfa));

    console.log('Security adversarial tests: PASS');
  } finally {
    await withSecurityContext(null, true, async client => {
      await client.query('DELETE FROM security_events WHERE organization_id IN ($1,$2)', [orgA, orgB]);
      await client.query('DELETE FROM assets WHERE id IN ($1,$2)', [assetA, assetB]);
      await client.query('DELETE FROM users WHERE id IN ($1,$2)', [userA, userB]);
      await client.query('DELETE FROM organizations WHERE id IN ($1,$2)', [orgA, orgB]);
    });
    await pool.end();
  }
}

main().catch(error => { console.error('[Security adversarial] test failed:', error); process.exitCode = 1; });

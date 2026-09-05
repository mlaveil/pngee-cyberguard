import crypto from 'crypto';
import { pool, query, withSecurityContext } from './postgres';

async function main() {
  const required = [
    ['users', 'mfa_pending_secret_enc'],
    ['refresh_tokens', 'family_id'],
    ['refresh_tokens', 'replaced_by'],
    ['mfa_challenges', 'challenge_hash'],
    ['mfa_challenges', 'used_at'],
  ];
  for (const [table, column] of required) {
    const result = await query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column]);
    if (!result.rowCount) throw new Error(`Missing ${table}.${column}`);
  }

  const userId = `auth-test-${crypto.randomBytes(8).toString('hex')}`;
  const orgId = `auth-test-org-${crypto.randomBytes(8).toString('hex')}`;
  const challengeHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
  try {
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id,name,slug,domain,contact_email) VALUES ($1,$2,$3,$4,$5)`, [orgId, 'Auth Test', `${orgId}-slug`, 'auth-test.invalid', 'auth-test@invalid']);
      await client.query(`INSERT INTO users (id,organization_id,email,name,password_hash,role,status) VALUES ($1,$2,$3,$4,$5,'CUSTOMER_ADMIN','ACTIVE')`, [userId, orgId, `${userId}@invalid`, 'Auth Test', 'not-a-real-password-hash']);
      await client.query(`INSERT INTO mfa_challenges (id,user_id,challenge_hash,expires_at) VALUES ($1,$2,$3,now()+interval '5 minutes')`, [crypto.randomBytes(16).toString('hex'), userId, challengeHash]);
      const first = await client.query(`UPDATE mfa_challenges SET used_at=now() WHERE challenge_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING id`, [challengeHash]);
      if (first.rowCount !== 1) throw new Error('MFA challenge first-use claim failed');
      const second = await client.query(`UPDATE mfa_challenges SET used_at=now() WHERE challenge_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING id`, [challengeHash]);
      if (second.rowCount !== 0) throw new Error('MFA challenge was reusable');

      const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(48)).digest('hex');
      const familyId = crypto.randomBytes(16).toString('hex');
      const tokenId = crypto.randomBytes(16).toString('hex');
      await client.query(`INSERT INTO refresh_tokens (id,user_id,token_hash,family_id,expires_at) VALUES ($1,$2,$3,$4,now()+interval '30 days')`, [tokenId, userId, tokenHash, familyId]);
      const refreshClaim = await client.query(`UPDATE refresh_tokens SET revoked_at=now(),replaced_by=$2 WHERE id=$1 AND revoked_at IS NULL RETURNING id`, [tokenId, crypto.randomBytes(16).toString('hex')]);
      if (refreshClaim.rowCount !== 1) throw new Error('Refresh token first-use rotation failed');
      const refreshReplay = await client.query(`UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id`, [tokenId]);
      if (refreshReplay.rowCount !== 0) throw new Error('Refresh token replay was accepted');
    });
    console.log('Auth/session hardening: PASS');
  } finally {
    await withSecurityContext(null, true, async client => {
      await client.query('DELETE FROM mfa_challenges WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM users WHERE id=$1', [userId]);
      await client.query('DELETE FROM organizations WHERE id=$1', [orgId]);
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());

import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { verifyLicense, requireAssetEntitlement } from '../services/licenseService';
import { withSecurityContext, pool } from './postgres';

async function main(){
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  process.env.LICENSE_PUBLIC_KEY = await exportSPKI(publicKey);
  process.env.LICENSE_ISSUER = 'pngee-license-authority';
  process.env.LICENSE_AUDIENCE = 'pngee-cyberguard';
  const orgId = `lic-test-${Date.now()}`;
  const token = await new SignJWT({ orgId, maxAssets: 2, features: ['endpoint_protection'] })
    .setProtectedHeader({ alg:'RS256' }).setIssuer(process.env.LICENSE_ISSUER).setAudience(process.env.LICENSE_AUDIENCE)
    .setSubject(orgId).setJti(`jti-${Date.now()}`).setIssuedAt().setExpirationTime('1h').sign(privateKey);
  const license = await verifyLicense(token, orgId);
  if(license.maxAssets !== 2 || license.orgId !== orgId) throw new Error('Signed license verification failed');
  let rejected = false;
  try { await verifyLicense(token, 'wrong-org'); } catch { rejected = true; }
  if(!rejected) throw new Error('Organization mismatch was not rejected');
  await withSecurityContext(null, true, async client => {
    await client.query(`INSERT INTO organizations (id,name,slug,domain,contact_email,license_jti,license_expires_at,license_max_assets,license_features) VALUES ($1,'License Test',$2,'test.invalid','test@test.invalid',$3,now()+interval '1 hour',2,'["endpoint_protection"]')`, [orgId, `${orgId}-slug`, license.jti]);
    await requireAssetEntitlement(client, orgId);
    await client.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
  });
  await pool.end();
  console.log('Signed licensing and entitlement tests passed.');
}
main().catch(async error=>{console.error(error);await pool.end();process.exit(1);});

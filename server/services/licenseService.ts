import { importSPKI, jwtVerify, type JWTPayload } from 'jose';

export interface CyberGuardLicense extends JWTPayload {
  orgId: string;
  maxAssets: number;
  features?: string[];
}

function publicKeyPem() {
  const value = process.env.LICENSE_PUBLIC_KEY?.replace(/\\n/g, '\n').trim();
  if (!value) throw new Error('LICENSE_PUBLIC_KEY is required for signed licensing');
  return value;
}

export async function verifyLicense(token: string, expectedOrgId: string): Promise<CyberGuardLicense> {
  if (!token || token.length > 16384) throw new Error('Invalid license token');
  const key = await importSPKI(publicKeyPem(), 'RS256');
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    issuer: process.env.LICENSE_ISSUER || 'pngee-license-authority',
    audience: process.env.LICENSE_AUDIENCE || 'pngee-cyberguard'
  });
  if (payload.orgId !== expectedOrgId) throw new Error('License organization mismatch');
  if (!Number.isInteger(payload.maxAssets) || Number(payload.maxAssets) < 1) throw new Error('License maxAssets is invalid');
  return payload as CyberGuardLicense;
}

export async function getLicense(client: any, organizationId: string) {
  const result = await client.query(`SELECT license_jti,license_expires_at,license_max_assets,license_features FROM organizations WHERE id=$1`, [organizationId]);
  if (!result.rowCount) throw new Error('Organization not found');
  const row = result.rows[0];
  if (!row.license_jti || !row.license_expires_at || !row.license_max_assets) throw new Error('No active license');
  if (new Date(row.license_expires_at).getTime() <= Date.now()) throw new Error('License expired');
  return { jti: row.license_jti, expiresAt: row.license_expires_at, maxAssets: Number(row.license_max_assets), features: row.license_features || [] };
}

export async function requireAssetEntitlement(client: any, organizationId: string) {
  const license = await getLicense(client, organizationId);
  const count = await client.query(`SELECT count(*)::int AS count FROM assets WHERE organization_id=$1`, [organizationId]);
  if (Number(count.rows[0].count) >= license.maxAssets) throw new Error(`Licensed endpoint limit reached (${license.maxAssets})`);
  return license;
}

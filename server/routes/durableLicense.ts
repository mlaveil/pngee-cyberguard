import { Router, Response } from 'express';
import { authMiddleware, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { withSecurityContext } from '../db/postgres';
import { verifyLicense, getLicense } from '../services/licenseService';

export const durableLicenseRouter = Router();
durableLicenseRouter.use(authMiddleware as any);
const GLOBAL = ['PNGEE_SUPER_ADMIN','STK_SUPER_ADMIN'];

// A license is a signed JWT issued outside the application. CyberGuard only verifies and stores it.
durableLicenseRouter.post('/system/license/update', requireRoles(GLOBAL) as any, async (req: AuthenticatedRequest, res: Response) => {
  const token = typeof req.body?.licenseKey === 'string' ? req.body.licenseKey.trim() : '';
  const organizationId = typeof req.body?.organizationId === 'string' ? req.body.organizationId : req.user!.organizationId;
  if (!token || !organizationId) return res.status(400).json({ error: 'licenseKey and organizationId are required' });
  try {
    const license = await verifyLicense(token, organizationId);
    await withSecurityContext(null, true, async client => {
      const exists = await client.query(`SELECT id FROM organizations WHERE id=$1`, [organizationId]);
      if (!exists.rowCount) throw new Error('Organization not found');
      await client.query(`UPDATE organizations SET license_token=$2,license_jti=$3,license_expires_at=to_timestamp($4),license_max_assets=$5,license_features=$6,updated_at=now() WHERE id=$1`, [organizationId, token, license.jti, Number(license.exp), license.maxAssets, JSON.stringify(license.features || [])]);
      await client.query(`INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource,resource_id,result,details,ip_address) VALUES (concat('aud-',gen_random_uuid()::text),$1,$2,'UPDATE_LICENSE','Organization',$1,'SUCCESS',$3,$4)`, [organizationId, req.user!.id, JSON.stringify({ jti:license.jti, expiresAt:license.exp, maxAssets:license.maxAssets }), req.ip || null]);
    });
    res.json({ status:'ACTIVE', organizationId, jti:license.jti, expiresAt:new Date(Number(license.exp)*1000).toISOString(), maxAssets:license.maxAssets, features:license.features || [] });
  } catch (error:any) { res.status(400).json({ error:'Invalid license', message:error?.message || 'License verification failed' }); }
});

durableLicenseRouter.get('/system/license', async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user!.organizationId;
  if (!organizationId) return res.status(400).json({ error:'Organization is required' });
  try {
    const result = await withSecurityContext(organizationId, false, async client => getLicense(client, organizationId));
    res.json({ status:'ACTIVE', organizationId, ...result });
  } catch (error:any) { res.status(402).json({ status:'UNLICENSED', organizationId, error:error?.message || 'No active license' }); }
});

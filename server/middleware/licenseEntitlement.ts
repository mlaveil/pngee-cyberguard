import { Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from './auth';
import { withSecurityContext } from '../db/postgres';
import { requireAssetEntitlement } from '../services/licenseService';

const GLOBAL = new Set(['PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','STK_SUPER_ADMIN','STK_SECURITY_ANALYST']);
const targetOrg = (req: AuthenticatedRequest) => GLOBAL.has(req.user!.role) ? (typeof req.body?.organizationId === 'string' ? req.body.organizationId : req.user!.organizationId) : req.user!.organizationId;

export async function requireAssetLicense(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.organizationId) return res.status(400).json({ error:'Organization is required' });
    const organizationId = targetOrg(authReq);
    if (!organizationId) return res.status(400).json({ error:'Organization is required' });
    await withSecurityContext(organizationId, GLOBAL.has(authReq.user.role), client => requireAssetEntitlement(client, organizationId));
    next();
  } catch (error:any) {
    res.status(402).json({ error:'Endpoint entitlement required', message:error?.message || 'No active license or licensed endpoint capacity available' });
  }
}

export const licensedAssetCreationMiddleware = [authMiddleware as any, requireAssetLicense];

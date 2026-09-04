import { Request, Response, NextFunction } from 'express';
import { withSecurityContext } from '../db/postgres';
import { verifyAccessToken } from '../services/authService';
import { User, UserRole } from '../../src/types';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      targetOrgId?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  targetOrgId?: string;
}

function mapUser(row: any): User {
  return {
    id: row.id, organizationId: row.organization_id, name: row.name, email: row.email,
    role: row.role, avatarUrl: row.avatar_url || undefined, phone: row.phone || undefined,
    mfaEnabled: Boolean(row.mfa_enabled), status: row.status,
    lastLoginAt: row.last_login_at || undefined, lastLoginIp: row.last_login_ip || undefined,
    createdAt: row.created_at,
  };
}

const globalRoles: UserRole[] = ['PNGEE_SUPER_ADMIN', 'PNGEE_SECURITY_ANALYST', 'STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST'];

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return void res.status(401).json({ error: 'Unauthorized', message: 'Bearer access token required.' });
    const claims = await verifyAccessToken(header.slice(7));
    const userId = claims.payload.sub;
    if (!userId || typeof userId !== 'string') throw new Error('Missing subject');
    const role = String(claims.payload.role || '') as UserRole;
    const organizationId = claims.payload.organizationId == null ? null : String(claims.payload.organizationId);
    const isGlobalAdmin = globalRoles.includes(role);
    const result = await withSecurityContext(organizationId, isGlobalAdmin, client => client.query(
      `SELECT id, organization_id, name, email, role, avatar_url, phone, mfa_enabled, status, last_login_at, last_login_ip, created_at FROM users WHERE id = $1 AND status = 'ACTIVE'`, [userId]));
    const row = result.rows[0];
    if (!row) return void res.status(401).json({ error: 'Unauthorized', message: 'User is disabled or no longer exists.' });
    req.user = mapUser(row);
    const requestedOrg = (req.query.orgId as string) || (req.body?.organizationId as string) || (req.params?.orgId as string);
    if (!isGlobalAdmin) {
      if (requestedOrg && requestedOrg !== req.user.organizationId && requestedOrg !== 'current') return void res.status(403).json({ error: 'Forbidden', message: 'Cross-tenant access denied.' });
      req.targetOrgId = req.user.organizationId;
    } else req.targetOrgId = requestedOrg || 'all';
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired access token.' });
  }
}

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });
    const expanded = new Set(allowedRoles);
    if (expanded.has('PNGEE_SUPER_ADMIN')) expanded.add('STK_SUPER_ADMIN');
    if (expanded.has('STK_SUPER_ADMIN')) expanded.add('PNGEE_SUPER_ADMIN');
    if (expanded.has('PNGEE_SECURITY_ANALYST')) expanded.add('STK_SECURITY_ANALYST');
    if (expanded.has('STK_SECURITY_ANALYST')) expanded.add('PNGEE_SECURITY_ANALYST');
    if (!expanded.has(req.user.role)) return void res.status(403).json({ error: 'Forbidden', message: `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}` });
    next();
  };
}
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/store';
import { User, UserRole } from '../../src/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  targetOrgId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Extract user ID from header or Authorization Bearer token or cookie
  const authHeader = req.headers['authorization'];
  const userIdHeader = (req.headers['x-user-id'] as string) || (req.query.userId as string);
  
  let user: User | undefined;

  if (userIdHeader) {
    user = db.users.find(u => u.id === userIdHeader && u.status === 'ACTIVE');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Support token formatted as `token_<userId>` or direct user lookup
    const foundUserId = token.startsWith('token_') ? token.replace('token_', '') : token;
    user = db.users.find(u => (u.id === foundUserId || u.email === token) && u.status === 'ACTIVE');
  }

  // Fallback to Super Admin ONLY in development/demo mode for local UI sandbox testing
  if (!user && db.appMode !== 'production') {
    user = db.users.find(u => u.role === 'PNGEE_SUPER_ADMIN');
  }

  if (!user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid authentication credentials required. Unauthenticated access prohibited in production mode.'
    });
    return;
  }

  req.user = user;

  // Determine requested Organization context
  const requestedOrg = (req.query.orgId as string) || (req.body?.organizationId as string) || (req.params?.orgId as string);

  // If user is a Customer Admin or Customer User, they are strictly locked to their own organization
  if (user.role === 'CUSTOMER_ADMIN' || user.role === 'CUSTOMER_USER') {
    if (requestedOrg && requestedOrg !== user.organizationId && requestedOrg !== 'current') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant Isolation Violation: You are not authorized to access data outside your assigned organization.'
      });
      return;
    }
    req.targetOrgId = user.organizationId;
  } else {
    // PNGee Staff can access any org or 'all'
    req.targetOrgId = requestedOrg || 'all';
  }

  next();
}

export function requireRoles(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Authentication required.'
      });
      return;
    }

    // Expand allowed roles to match both PNGEE and STK aliases
    const expandedAllowed = [...allowedRoles];
    if (allowedRoles.includes('PNGEE_SUPER_ADMIN') && !allowedRoles.includes('STK_SUPER_ADMIN')) {
      expandedAllowed.push('STK_SUPER_ADMIN');
    }
    if (allowedRoles.includes('STK_SUPER_ADMIN') && !allowedRoles.includes('PNGEE_SUPER_ADMIN')) {
      expandedAllowed.push('PNGEE_SUPER_ADMIN');
    }
    if (allowedRoles.includes('PNGEE_SECURITY_ANALYST') && !allowedRoles.includes('STK_SECURITY_ANALYST')) {
      expandedAllowed.push('STK_SECURITY_ANALYST');
    }
    if (allowedRoles.includes('STK_SECURITY_ANALYST') && !allowedRoles.includes('PNGEE_SECURITY_ANALYST')) {
      expandedAllowed.push('PNGEE_SECURITY_ANALYST');
    }

    if (!expandedAllowed.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}`
      });
      return;
    }
    next();
  };
}

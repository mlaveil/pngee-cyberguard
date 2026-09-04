import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
});

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded' },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts' },
});

export function rejectInsecureProductionRequests(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production' && req.path !== '/api/health') {
    const forwardedProto = req.header('x-forwarded-proto');
    const encrypted = req.secure || forwardedProto === 'https';
    if (!encrypted) {
      return res.status(400).json({ error: 'HTTPS required' });
    }
  }
  next();
}

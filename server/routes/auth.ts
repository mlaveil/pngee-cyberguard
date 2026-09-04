import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db/postgres';
import { hashPassword, verifyPassword, issueAccessToken, verifyAccessToken, hashRefreshToken } from '../services/authService';

const router = Router();
const REFRESH_COOKIE = 'pngee_refresh';

function publicUser(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatar_url || undefined,
    phone: row.phone || undefined,
    mfaEnabled: Boolean(row.mfa_enabled),
    status: row.status,
    lastLoginAt: row.last_login_at || undefined,
    lastLoginIp: row.last_login_ip || undefined,
    createdAt: row.created_at,
  };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000,
  });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await db.query(
      `SELECT id, organization_id, name, email, role, avatar_url, phone, mfa_enabled, status,
              last_login_at, last_login_ip, created_at, password_hash
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email.trim()]
    );
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE' || !row.password_hash || !(await verifyPassword(row.password_hash, password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const ip = req.ip;
    const accessToken = await issueAccessToken({
      sub: row.id,
      organizationId: row.organization_id,
      role: row.role,
      email: row.email,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshHash = hashRefreshToken(refreshToken);
    const expires = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000);

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomBytes(16).toString('hex'), row.id, refreshHash, expires.toISOString(), ip, req.get('user-agent') || null]
    );
    await db.query('UPDATE users SET last_login_at = now(), last_login_ip = $2 WHERE id = $1', [row.id, ip]);

    setRefreshCookie(res, refreshToken);
    res.json({ user: publicUser(row), accessToken });
  } catch (error) {
    console.error('Login failed', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }
    const tokenHash = hashRefreshToken(token);
    const result = await db.query(
      `SELECT rt.id AS refresh_id, rt.user_id, u.organization_id, u.name, u.email, u.role,
              u.avatar_url, u.phone, u.mfa_enabled, u.status, u.last_login_at, u.last_login_ip, u.created_at
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() LIMIT 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE') {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const nextRefresh = randomBytes(48).toString('base64url');
    await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.refresh_id]);
    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomBytes(16).toString('hex'), row.user_id, hashRefreshToken(nextRefresh), new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000).toISOString(), req.ip, req.get('user-agent') || null]
    );
    const accessToken = await issueAccessToken({ sub: row.user_id, organizationId: row.organization_id, role: row.role, email: row.email });
    setRefreshCookie(res, nextRefresh);
    res.json({ user: publicUser(row), accessToken });
  } catch (error) {
    console.error('Refresh failed', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashRefreshToken(token)]);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.status(204).send();
});

router.get('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }
  try {
    const claims = await verifyAccessToken(header.slice(7));
    const result = await db.query(
      `SELECT id, organization_id, name, email, role, avatar_url, phone, mfa_enabled, status,
              last_login_at, last_login_ip, created_at FROM users WHERE id = $1 AND status = 'ACTIVE'`,
      [claims.sub]
    );
    const row = result.rows[0];
    if (!row) {
      res.status(401).json({ error: 'User not found or disabled' });
      return;
    }
    const orgResult = await db.query('SELECT * FROM organizations WHERE id = $1', [row.organization_id]);
    res.json({ user: publicUser(row), organization: orgResult.rows[0] || null, availableOrgs: [] });
  } catch {
    res.status(401).json({ error: 'Invalid access token' });
  }
});

export default router;

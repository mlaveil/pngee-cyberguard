import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { query, withSecurityContext } from '../db/postgres';
import { verifyPassword, issueAccessToken, verifyAccessToken, hashRefreshToken } from '../services/authService';

const router = Router();
const REFRESH_COOKIE = 'pngee_refresh';

function publicUser(row: any) {
  return { id: row.id, organizationId: row.organization_id, name: row.name, email: row.email, role: row.role, avatarUrl: row.avatar_url || undefined, phone: row.phone || undefined, mfaEnabled: Boolean(row.mfa_enabled), status: row.status, lastLoginAt: row.last_login_at || undefined, lastLoginIp: row.last_login_ip || undefined, createdAt: row.created_at };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/v1/auth', maxAge: Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000 });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') { res.status(400).json({ error: 'Email and password are required' }); return; }
    const result = await withSecurityContext(null, true, client => client.query(`SELECT id, organization_id, name, email, role, avatar_url, phone, mfa_enabled, status, last_login_at, last_login_ip, created_at, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1`, [email.trim()]));
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE' || !row.password_hash || !(await verifyPassword(row.password_hash, password))) { res.status(401).json({ error: 'Invalid email or password' }); return; }

    const accessToken = await issueAccessToken({ sub: row.id, organizationId: row.organization_id, role: row.role });
    const refreshToken = randomBytes(48).toString('base64url');
    const expires = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000);
    await withSecurityContext(null, true, client => client.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)`, [randomBytes(16).toString('hex'), row.id, hashRefreshToken(refreshToken), expires.toISOString(), req.ip, req.get('user-agent') || null]));
    await withSecurityContext(null, true, client => client.query('UPDATE users SET last_login_at = now(), last_login_ip = $2 WHERE id = $1', [row.id, req.ip]));
    setRefreshCookie(res, refreshToken);
    res.json({ user: publicUser(row), accessToken });
  } catch (error) { console.error('Login failed', error); res.status(500).json({ error: 'Authentication service unavailable' }); }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) { res.status(401).json({ error: 'Refresh token required' }); return; }
    const result = await withSecurityContext(null, true, client => client.query(`SELECT rt.id AS refresh_id, rt.user_id, u.organization_id, u.name, u.email, u.role, u.avatar_url, u.phone, u.mfa_enabled, u.status, u.last_login_at, u.last_login_ip, u.created_at FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now() LIMIT 1`, [hashRefreshToken(token)]));
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE') { res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' }); res.status(401).json({ error: 'Invalid or expired refresh token' }); return; }
    const nextRefresh = randomBytes(48).toString('base64url');
    const nextId = randomBytes(16).toString('hex');
    await withSecurityContext(null, true, async client => {
      await client.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [row.refresh_id, nextId]);
      await client.query(`INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)`, [nextId, row.user_id, hashRefreshToken(nextRefresh), new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS || 30) * 86400000).toISOString(), req.ip, req.get('user-agent') || null]);
    });
    const accessToken = await issueAccessToken({ sub: row.user_id, organizationId: row.organization_id, role: row.role });
    setRefreshCookie(res, nextRefresh);
    res.json({ user: publicUser(row), accessToken });
  } catch (error) { console.error('Refresh failed', error); res.status(500).json({ error: 'Authentication service unavailable' }); }
});

router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashRefreshToken(token)]);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  res.status(204).send();
});

router.get('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Access token required' }); return; }
  try {
    const claims = await verifyAccessToken(header.slice(7));
    const userId = claims.payload.sub as string;
    const role = String(claims.payload.role || '');
    const organizationId = claims.payload.organizationId == null ? null : String(claims.payload.organizationId);
    const global = ['PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','STK_SUPER_ADMIN','STK_SECURITY_ANALYST'].includes(role);
    const result = await withSecurityContext(organizationId, global, client => client.query(`SELECT id, organization_id, name, email, role, avatar_url, phone, mfa_enabled, status, last_login_at, last_login_ip, created_at FROM users WHERE id = $1 AND status = 'ACTIVE'`, [userId]));
    const row = result.rows[0];
    if (!row) { res.status(401).json({ error: 'User not found or disabled' }); return; }
    const org = await withSecurityContext(organizationId, global, client => client.query('SELECT * FROM organizations WHERE id = $1', [row.organization_id]));
    res.json({ user: publicUser(row), organization: org.rows[0] || null, availableOrgs: [] });
  } catch { res.status(401).json({ error: 'Invalid access token' }); }
});

export default router;

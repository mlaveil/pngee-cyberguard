import argon2 from 'argon2';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be configured and at least 32 characters long');
  return new TextEncoder().encode(value);
}

const issuer = process.env.JWT_ISSUER || 'pngee-cyberguard';
const audience = process.env.JWT_AUDIENCE || 'pngee-cyberguard-web';

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function issueAccessToken(claims: { sub: string; role: string; organizationId?: string | null }) {
  return new SignJWT({ role: claims.role, organizationId: claims.organizationId ?? null })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_TTL || '15m')
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, secret(), { issuer, audience, algorithms: ['HS256'] });
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

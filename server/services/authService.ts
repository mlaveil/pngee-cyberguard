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
export async function hashPassword(password: string): Promise<string> { if (password.length < 12) throw new Error('Password must be at least 12 characters'); return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }); }
export async function verifyPassword(hash: string, password: string): Promise<boolean> { return argon2.verify(hash, password); }
export async function issueAccessToken(claims: { sub: string; role: string; organizationId?: string | null }) { return new SignJWT({ role: claims.role, organizationId: claims.organizationId ?? null }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(claims.sub).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(process.env.JWT_ACCESS_TTL || '15m').sign(secret()); }
export async function issueMfaChallenge(userId: string) { return new SignJWT({ purpose: 'mfa', nonce: crypto.randomUUID() }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(userId).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(secret()); }
export async function verifyAccessToken(token: string) { return jwtVerify(token, secret(), { issuer, audience, algorithms: ['HS256'] }); }
export async function verifyMfaChallenge(token: string) { const verified = await jwtVerify(token, secret(), { issuer, audience, algorithms: ['HS256'] }); if (verified.payload.purpose !== 'mfa' || typeof verified.payload.sub !== 'string' || typeof verified.payload.nonce !== 'string') throw new Error('Invalid MFA challenge'); return verified.payload.sub; }
export function hashMfaChallenge(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }
export function hashRefreshToken(token: string): string { return crypto.createHash('sha256').update(token).digest('hex'); }
export function generateRefreshToken(): string { return crypto.randomBytes(48).toString('base64url'); }
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes: Buffer): string { let bits=0,value=0,out=''; for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}} if(bits)out+=alphabet[(value<<(5-bits))&31]; return out; }
function base32Decode(input: string): Buffer { let bits=0,value=0;const out:number[]=[];for(const ch of input.replace(/=+$/,'').toUpperCase()){const i=alphabet.indexOf(ch);if(i<0)throw new Error('Invalid base32 secret');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out); }
export function generateTotpSecret(): string { return base32Encode(crypto.randomBytes(20)); }
export function verifyTotp(secretValue: string, code: string, window=1): boolean { if(!/^\d{6}$/.test(code))return false;const key=base32Decode(secretValue),counter=Math.floor(Date.now()/1000/30),supplied=Buffer.from(code);for(let offset=-window;offset<=window;offset++){const buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter+offset));const digest=crypto.createHmac('sha1',key).update(buffer).digest(),index=digest[digest.length-1]&15,otp=String((digest.readUInt32BE(index)&0x7fffffff)%1000000).padStart(6,'0'),candidate=Buffer.from(otp);if(crypto.timingSafeEqual(candidate,supplied))return true;}return false; }
function encryptionKey(): Buffer { return crypto.createHash('sha256').update(process.env.AUTH_SECRET || '').digest(); }
export function encryptMfaSecret(value: string): string { const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv),ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`; }
export function decryptMfaSecret(value: string): string { const [iv,tag,data]=value.split('.'),decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8'); }
export function hashRecoveryCode(code: string): string { return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex'); }
export function generateRecoveryCodes(count=10): string[] { return Array.from({length:count},()=>crypto.randomBytes(5).toString('hex').toUpperCase()); }

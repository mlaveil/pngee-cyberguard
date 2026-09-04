import crypto from 'crypto';
import { decryptMfaSecret, encryptMfaSecret, generateTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from '../services/authService';

function totpAt(secret: string, timestamp: number): string {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=0,value=0; const keyBytes:number[]=[];
  for(const ch of secret){const i=alphabet.indexOf(ch);if(i<0)throw new Error('invalid secret');value=(value<<5)|i;bits+=5;if(bits>=8){keyBytes.push((value>>>(bits-8))&255);bits-=8;}}
  const counter=Math.floor(timestamp/1000/30); const buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));
  const digest=crypto.createHmac('sha1',Buffer.from(keyBytes)).update(buffer).digest();const index=digest[digest.length-1]&15;return String((digest.readUInt32BE(index)&0x7fffffff)%1000000).padStart(6,'0');
}

async function main(){
  if(!process.env.AUTH_SECRET||process.env.AUTH_SECRET.length<32)throw new Error('AUTH_SECRET must be at least 32 characters');
  const secret=generateTotpSecret();const code=totpAt(secret,Date.now());
  if(!verifyTotp(secret,code))throw new Error('TOTP verification failed');
  if(verifyTotp(secret,'000000'))console.log('warning: 000000 happened to be valid');
  const encrypted=encryptMfaSecret(secret);if(encrypted===secret||decryptMfaSecret(encrypted)!==secret)throw new Error('MFA secret encryption round-trip failed');
  const codes=generateRecoveryCodes();if(codes.length!==10||new Set(codes).size!==10)throw new Error('Recovery code generation failed');
  if(hashRecoveryCode(codes[0])===codes[0])throw new Error('Recovery codes must be hashed');
  console.log('MFA primitives: PASS');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

// TOTP (RFC 6238): SHA-1, 6 digits, 30s step. Compatible with Google Authenticator, Authy, etc.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  let bits = "";
  for (const ch of input.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    bits += ALPHABET.indexOf(ch).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Returns the matching time step (allowing one step of clock drift each way), or null.
 * Steps <= lastUsedStep are rejected so a code cannot be replayed.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep = 0): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = currentStep();
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastUsedStep) continue;
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, username: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

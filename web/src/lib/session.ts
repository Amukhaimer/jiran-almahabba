// Signed, stateless tokens for the session cookie. No Next/Prisma imports: also used by proxy.ts.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "jiran_session";
export const PENDING_COOKIE = "jiran_pending";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const PENDING_TTL_SECONDS = 60 * 10;

/** "s" = full session, "p" = password verified, 2FA enrollment still pending. */
export type TokenKind = "s" | "p";

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET (32+ chars) is required in production");
  }
  return "dev-only-session-secret-not-for-production";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createToken(uid: string, kind: TokenKind, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = Buffer.from(JSON.stringify({ uid, kind, exp })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken(
  token: string | undefined,
  kind: TokenKind,
): { uid: string } | null {
  if (!token) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (data.kind !== kind || typeof data.uid !== "string") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

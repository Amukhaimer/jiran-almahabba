import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PENDING_COOKIE, SESSION_COOKIE, verifyToken } from "@/lib/session";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

// Databases created before login existed (e.g. a restored prod.db) have no User table.
// The production image has no Prisma CLI, so create it on first use. DDL mirrors schema.prisma.
let userTableReady: Promise<void> | null = null;

export function ensureUserTable(): Promise<void> {
  userTableReady ??= (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "username" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "totpSecret" TEXT,
        "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
        "totpLastStep" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
    );
  })().catch((error) => {
    userTableReady = null;
    throw error;
  });
  return userTableReady;
}

/** The fully signed-in user (password + 2FA), or null. */
export async function getSessionUser() {
  const store = await cookies();
  const payload = verifyToken(store.get(SESSION_COOKIE)?.value, "s");
  if (!payload) return null;
  await ensureUserTable();
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  return user?.totpEnabled ? user : null;
}

/** Guard for server actions: they are reachable by direct POST, so each one must check. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** User who passed the password step but still has to enroll 2FA. */
export async function getPendingUser() {
  const store = await cookies();
  const payload = verifyToken(store.get(PENDING_COOKIE)?.value, "p");
  if (!payload) return null;
  await ensureUserTable();
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  return user && !user.totpEnabled ? user : null;
}

// In-memory throttle; enough for a single-instance app. Resets on restart.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; until: number }>();

export function isLocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (entry.until < Date.now()) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);
  if (!entry || entry.until < now) {
    failures.set(key, { count: 1, until: now + LOCK_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

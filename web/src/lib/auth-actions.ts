"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  MIN_PASSWORD_LENGTH,
  clearFailures,
  ensureUserTable,
  getPendingUser,
  hashPassword,
  isLocked,
  recordFailure,
  verifyPassword,
} from "@/lib/auth";
import {
  PENDING_COOKIE,
  PENDING_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createToken,
} from "@/lib/session";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";

// Verified against when the username does not exist, so both cases take similar time.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function startSession(userId: string) {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
  store.set(SESSION_COOKIE, createToken(userId, "s", SESSION_TTL_SECONDS), {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });
}

async function startPending(userId: string) {
  const store = await cookies();
  store.set(PENDING_COOKIE, createToken(userId, "p", PENDING_TTL_SECONDS), {
    ...cookieOptions,
    maxAge: PENDING_TTL_SECONDS,
  });
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  const keys = [`u:${username}`, `ip:${await clientIp()}`];

  if (keys.some(isLocked)) redirect("/login?error=locked");

  await ensureUserTable();
  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    keys.forEach(recordFailure);
    redirect("/login?error=invalid");
  }

  if (!user.totpEnabled || !user.totpSecret) {
    // Account was created but 2FA enrollment was never finished.
    await startPending(user.id);
    redirect("/login/2fa");
  }

  const step = verifyTotp(user.totpSecret, code, user.totpLastStep);
  if (step === null) {
    keys.forEach(recordFailure);
    redirect("/login?error=invalid");
  }

  await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  keys.forEach(clearFailures);
  await startSession(user.id);
  redirect("/");
}

function setupTokenMatches(given: string): boolean {
  const expected = process.env.SETUP_TOKEN?.trim() ?? "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const a = Buffer.from(expected);
  const b = Buffer.from(given.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the first (and only) account. Disabled as soon as one user exists. */
export async function setupAccount(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const ipKey = `setup:${await clientIp()}`;
  const back = (error: string) =>
    redirect(`/setup?error=${error}&token=${encodeURIComponent(token)}`);

  await ensureUserTable();
  if ((await prisma.user.count()) > 0) redirect("/login");
  if (isLocked(ipKey)) redirect("/setup?error=locked");
  if (!setupTokenMatches(token)) {
    recordFailure(ipKey);
    redirect("/setup?error=token");
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) back("username");
  if (password.length < MIN_PASSWORD_LENGTH) back("password");
  if (password !== confirm) back("mismatch");

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      totpSecret: generateTotpSecret(),
    },
  });
  await startPending(user.id);
  redirect("/login/2fa");
}

/** Finishes 2FA enrollment: the first valid code proves the authenticator app is set up. */
export async function confirmTotp(formData: FormData) {
  const user = await getPendingUser();
  if (!user || !user.totpSecret) redirect("/login");

  const step = verifyTotp(user.totpSecret, String(formData.get("code") ?? ""));
  if (step === null) redirect("/login/2fa?error=code");

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpLastStep: step },
  });
  await startSession(user.id);
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(PENDING_COOKIE);
  redirect("/login");
}

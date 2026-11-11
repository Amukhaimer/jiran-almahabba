import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/setup"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Everything except the login/setup pages requires a valid signed session cookie.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Signature check only (no DB here). Pages and actions call requireUser() for the full check.
  const signedIn = verifyToken(request.cookies.get(SESSION_COOKIE)?.value, "s") !== null;
  if (!signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

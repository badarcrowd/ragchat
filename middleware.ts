import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Agent RAG Admin"'
    }
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function isAdminRequest(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export function middleware(request: NextRequest) {
  if (!isAdminRequest(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return unauthorized();
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) {
    return unauthorized();
  }

  const decoded = atob(header.slice("Basic ".length));
  const separator = decoded.indexOf(":");
  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);

  if (
    timingSafeEqual(suppliedUser, username) &&
    timingSafeEqual(suppliedPassword, password)
  ) {
    return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

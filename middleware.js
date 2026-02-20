import { NextResponse } from "next/server";

import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/user") && !pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const sessionValue = request.cookies.get(AUTH_COOKIE)?.value;
  const session = decodeSession(sessionValue);

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/user") && session.role !== "user") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/user", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*", "/admin/:path*"],
};

import { NextResponse } from "next/server";

import { AUTH_COOKIE, encodeSession, validateCredentials } from "@/lib/auth";

export async function POST(request) {
  const payload = await request.json();
  const username = String(payload?.username || "").trim();
  const password = String(payload?.password || "");

  if (!username || !password) {
    return NextResponse.json(
      { message: "Username and password are required" },
      { status: 400 },
    );
  }

  const user = validateCredentials(username, password);

  if (!user) {
    return NextResponse.json(
      { message: "Invalid username or password" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    authenticated: true,
    user: {
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    },
  });

  response.cookies.set(AUTH_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}

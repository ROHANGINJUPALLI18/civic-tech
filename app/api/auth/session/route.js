import { NextResponse } from "next/server";

import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export async function GET(request) {
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = decodeSession(raw);

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user: session });
}

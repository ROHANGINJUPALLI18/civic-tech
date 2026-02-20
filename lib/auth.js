export const AUTH_COOKIE = "civic_auth";

export const HARDCODED_USERS = [
  {
    username: "user",
    password: "user123",
    role: "user",
    displayName: "Citizen User",
  },
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    displayName: "Authority Admin",
  },
];

export function validateCredentials(username, password) {
  return (
    HARDCODED_USERS.find(
      (item) => item.username === username && item.password === password,
    ) || null
  );
}

export function encodeSession(user) {
  return Buffer.from(
    JSON.stringify({
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    }),
  ).toString("base64url");
}

export function decodeSession(rawValue) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(rawValue, "base64url").toString("utf8"),
    );
    if (!parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

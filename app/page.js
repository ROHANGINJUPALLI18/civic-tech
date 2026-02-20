"use client";

import { useEffect, useState } from "react";

import { SpotlightBanner } from "@/components/civic/spotlight-banner";
import { ReactBitsChip } from "@/components/civic/reactbits-chip";
import { Button } from "@/components/ui/button";

function Notice({ type = "info", children }) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-blue-200 bg-blue-50 text-blue-700";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function Pill({ children, tone = "blue" }) {
  const styles =
    tone === "purple"
      ? "bg-purple-100 text-purple-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload?.authenticated || !payload?.user?.role) return;
        window.location.href =
          payload.user.role === "admin" ? "/admin" : "/user";
      } catch {
        // stay on login
      }
    };

    checkSession();
  }, []);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      setFeedback({ type: "error", text: "Enter username and password." });
      return;
    }

    setBusy(true);
    setFeedback({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Login failed");
      }

      window.location.href =
        payload?.user?.role === "admin" ? "/admin" : "/user";
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Invalid login." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex w-full max-w-4xl items-center justify-center p-4 md:p-8">
        <div className="w-full space-y-4">
          <SpotlightBanner
            title="Civic Complaint System"
            subtitle="Simple hardcoded login for separate user and admin dashboards."
          />

          <div className="flex flex-wrap items-center gap-3">
            <ReactBitsChip />
            <Pill>Role-based access</Pill>
            <Pill tone="purple">Hardcoded backend auth</Pill>
          </div>

          <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Login</h2>

            <div className="space-y-3">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />

              <input
                type="password"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onLogin();
                }}
              />

              <Notice>
                <p className="font-medium">Demo credentials</p>
                <p>User: user / user123</p>
                <p>Admin: admin / admin123</p>
              </Notice>

              {feedback.text ? (
                <Notice type={feedback.type}>{feedback.text}</Notice>
              ) : null}

              <Button onClick={onLogin} disabled={busy} className="w-full">
                {busy ? "Signing in..." : "Login"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

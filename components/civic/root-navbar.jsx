"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Login" },
];

const AUTH_NAV_ITEMS = [
  { href: "/user", label: "User" },
  { href: "/admin", label: "Admin" },
];

function navItemClass(isActive) {
  if (isActive) {
    return "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white";
  }

  return "rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
}

export function RootNavbar() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) setAuthenticated(false);
          return;
        }

        const payload = await response.json();
        if (!cancelled) {
          setAuthenticated(Boolean(payload?.authenticated));
        }
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const navItems = useMemo(
    () =>
      authenticated
        ? [...BASE_NAV_ITEMS, ...AUTH_NAV_ITEMS]
        : BASE_NAV_ITEMS,
    [authenticated],
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="text-sm font-semibold text-slate-900">
          Civic-Tech
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={navItemClass(isActive)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

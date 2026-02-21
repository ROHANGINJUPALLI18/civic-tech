"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";

const BASE_NAV_ITEMS = [
  { href: "/", label: "Login" },
];

const AUTH_NAV_ITEMS = [
  { href: "/user", label: "User" },
];

export function RootNavbar() {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
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
  }, [pathname, mounted]);

  const navItems = useMemo(
    () =>
      mounted && authenticated
        ? [...BASE_NAV_ITEMS, ...AUTH_NAV_ITEMS]
        : BASE_NAV_ITEMS,
    [authenticated, mounted],
  );

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Toolbar sx={{ mx: "auto", width: "100%", maxWidth: "80rem", px: 2 }}>
        <Typography
          component={Link}
          href="/"
          variant="h6"
          color="text.primary"
          sx={{ 
            textDecoration: "none",
            textShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          Civic-Tech
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);

            return (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                variant={isActive ? "contained" : "text"}
                color={isActive ? "primary" : "inherit"}
                size="small"
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
